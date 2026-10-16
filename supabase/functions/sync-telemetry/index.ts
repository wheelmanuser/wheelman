import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DEDUPE_FIELDS, isDuplicateReading, toTelemetryRow } from "./parse.ts";

const XVISION_API_URL = Deno.env.get("XVISION_API_URL")!;
const XVISION_EMAIL = Deno.env.get("XVISION_EMAIL")!;
const XVISION_PASSWORD = Deno.env.get("XVISION_PASSWORD")!;
const XVISION_CUSTOMER_ID = Deno.env.get("XVISION_CUSTOMER_ID");

type Tokens = { access: string; refresh: string };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

function parseTokens(data: any): Tokens {
  const access = data?.access ?? data?.Access;
  const refresh = data?.refresh ?? data?.Refresh;
  if (typeof access !== "string" || typeof refresh !== "string") {
    throw new Error("xVision token response missing access/refresh");
  }
  return { access, refresh };
}

async function login(): Promise<Tokens> {
  const res = await fetch(`${XVISION_API_URL}/User/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Email: XVISION_EMAIL, Password: XVISION_PASSWORD }),
  });
  if (!res.ok) throw new Error(`xVision login failed: ${await res.text()}`);
  return parseTokens(await res.json());
}

async function refreshTokens(refresh: string): Promise<Tokens> {
  const res = await fetch(`${XVISION_API_URL}/User/RefreshTokens`, {
    headers: { SessionKey: refresh, RefreshKey: refresh },
  });
  if (!res.ok) throw new Error(`xVision refresh failed: ${await res.text()}`);
  return parseTokens(await res.json());
}

async function sessionExpired(res: Response): Promise<boolean> {
  if (res.status === 401) return true;
  if (res.ok) return false;
  return (await res.clone().text()).includes("SessionKey expired");
}

async function xvisionGet(path: string, tokens: Tokens): Promise<any> {
  const call = (access: string) =>
    fetch(`${XVISION_API_URL}${path}`, { headers: { SessionKey: access } });

  let res = await call(tokens.access);
  if (await sessionExpired(res)) {
    const fresh = await refreshTokens(tokens.refresh);
    tokens.access = fresh.access;
    tokens.refresh = fresh.refresh;
    res = await call(fresh.access);
  }
  if (!res.ok) throw new Error(`xVision GET ${path} failed: ${await res.text()}`);
  return res.json();
}

function asList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "Data", "Customers", "Devices"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

async function getCustomerId(tokens: Tokens): Promise<string> {
  if (XVISION_CUSTOMER_ID) return XVISION_CUSTOMER_ID;
  const customers = asList(await xvisionGet("/Customer/GetCustomers", tokens));
  if (customers.length === 0) throw new Error("xVision account has no customers");
  if (customers.length > 1) {
    throw new Error(`xVision account has ${customers.length} customers; set XVISION_CUSTOMER_ID`);
  }
  const c = customers[0];
  const id = c.CustomerID ?? c.CustomerId ?? c.ID ?? c.Id;
  if (id === undefined || id === null || id === "") {
    throw new Error("xVision customer record has no CustomerID field");
  }
  return String(id);
}

async function getDevices(tokens: Tokens): Promise<any[]> {
  const customerId = await getCustomerId(tokens);
  return asList(
    await xvisionGet(`/Device/GetDevices?CustomerID=${encodeURIComponent(customerId)}`, tokens),
  );
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get all linked devices
  const { data: linkedDevices, error } = await supabase
    .from("vehicle_devices")
    .select("vehicle_id, user_id, object_id");

  if (error) return json({ error: error.message }, 500);
  if (!linkedDevices?.length) return json({ message: "No linked devices" }, 200);

  let tokens: Tokens;
  let devices: any[];
  try {
    tokens = await login();
    devices = await getDevices(tokens);
  } catch (err) {
    console.error("[sync-telemetry] xVision request failed:", err);
    return json({ error: err instanceof Error ? err.message : "xVision request failed" }, 502);
  }

  // Match xVision devices to linked vehicles
  const matched = [];
  for (const linked of linkedDevices) {
    const device = devices.find((d: any) => d.ObjectID === linked.object_id);
    if (device) matched.push({ linked, device });
  }

  // GetDevices omits OBD data; GetDevice returns it under ExtraData. A failure here only costs that
  // device its OBD columns (they stay null), not the whole sync.
  const readings = await Promise.all(
    matched.map(async ({ linked, device }) => {
      let extraData: unknown;
      try {
        const detail = await xvisionGet(
          `/Device/GetDevice?ObjectID=${encodeURIComponent(linked.object_id)}`,
          tokens,
        );
        extraData = (Array.isArray(detail) ? detail[0] : detail)?.ExtraData;
      } catch (err) {
        console.error(`[sync-telemetry] GetDevice failed for ${linked.object_id}:`, err);
      }
      return toTelemetryRow(linked, device, extraData);
    }),
  );

  // Latest stored row per vehicle in a single query (embedded resource, ordered + limited per parent,
  // served by the (vehicle_id, recorded_at desc) index). If it fails, fall back to inserting everything.
  const latestByVehicle = new Map<string, Record<string, unknown>>();
  if (readings.length) {
    const { data: latestRows, error: latestError } = await supabase
      .from("vehicles")
      .select(`id, vehicle_telemetry(${DEDUPE_FIELDS.join(", ")})`)
      .in("id", readings.map((r) => r.vehicle_id))
      .order("recorded_at", { referencedTable: "vehicle_telemetry", ascending: false })
      .limit(1, { referencedTable: "vehicle_telemetry" });
    if (latestError) {
      console.error("[sync-telemetry] could not load latest readings, skipping dedupe:", latestError);
    } else {
      for (const v of latestRows ?? []) {
        const latest = (v as any).vehicle_telemetry?.[0];
        if (latest) latestByVehicle.set((v as any).id, latest);
      }
    }
  }

  const inserts = readings.filter((r) => !isDuplicateReading(latestByVehicle.get(r.vehicle_id), r));
  const skipped = readings.length - inserts.length;

  if (inserts.length) {
    const { error: insertError } = await supabase.from("vehicle_telemetry").insert(inserts);
    if (insertError) {
      console.error("[sync-telemetry] insert failed:", insertError);
      return json({ error: insertError.message }, 500);
    }
  }

  return json({ synced: inserts.length, skipped }, 200);
});
