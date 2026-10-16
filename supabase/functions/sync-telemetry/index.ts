import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const XVISION_API_URL = Deno.env.get("XVISION_API_URL")!;
const XVISION_EMAIL = Deno.env.get("XVISION_EMAIL")!;
const XVISION_PASSWORD = Deno.env.get("XVISION_PASSWORD")!;

type Tokens = { access: string; refresh: string };

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

async function getDevices(tokens: Tokens): Promise<any[]> {
  const call = (access: string) =>
    fetch(`${XVISION_API_URL}/Device/GetDevices`, { headers: { SessionKey: access } });

  let res = await call(tokens.access);
  if (await sessionExpired(res)) {
    res = await call((await refreshTokens(tokens.refresh)).access);
  }
  if (!res.ok) throw new Error(`GetDevices failed: ${await res.text()}`);
  return res.json();
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

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!linkedDevices?.length) return new Response(JSON.stringify({ message: "No linked devices" }), { status: 200 });

  const tokens = await login();
  const devices = await getDevices(tokens);

  // Match xVision devices to linked vehicles
  const inserts = [];
  for (const linked of linkedDevices) {
    const device = devices.find((d: any) => d.ObjectID === linked.object_id);
    if (!device) continue;
    inserts.push({
      vehicle_id: linked.vehicle_id,
      user_id: linked.user_id,
      object_id: linked.object_id,
      speed: device.Speed ?? null,
      latitude: device.Latitude ?? null,
      longitude: device.Longitude ?? null,
      address: device.Address ?? null,
      altitude: device.Altitude ?? null,
      heading: device.Heading ?? null,
      is_online: device.IsOnline === "true" || device.IsOnline === true,
      ignition: device.Ignition ?? null,
      vehicle_status: device.VehicleStatus ?? null,
      last_contact: device.LastContact ?? null,
      raw: device,
    });
  }

  if (inserts.length) {
    await supabase.from("vehicle_telemetry").insert(inserts);
  }

  return new Response(JSON.stringify({ synced: inserts.length }), { status: 200 });
});
