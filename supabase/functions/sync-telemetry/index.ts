import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const XVISION_API_URL = Deno.env.get("XVISION_API_URL")!;
const XVISION_API_KEY = Deno.env.get("XVISION_API_KEY")!;
const XVISION_EMAIL = Deno.env.get("XVISION_EMAIL")!;
const XVISION_PASSWORD = Deno.env.get("XVISION_PASSWORD")!;

async function getXVisionToken(): Promise<string> {
  const res = await fetch(`${XVISION_API_URL}/User/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: XVISION_EMAIL, password: XVISION_PASSWORD }),
  });
  if (!res.ok) throw new Error(`xVision login failed: ${await res.text()}`);
  const data = await res.json();
  return data.access;
}

async function getDevices(token: string): Promise<any[]> {
  const res = await fetch(`${XVISION_API_URL}/Device/GetDevices`, {
    headers: { apikey: XVISION_API_KEY, token },
  });
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

  const token = await getXVisionToken();
  const devices = await getDevices(token);

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
