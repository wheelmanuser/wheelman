import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xvisionGet } from "@/lib/xvision/client";
import { getXVisionDevices } from "@/lib/xvision/devices";
import { resolveLinkedObjectId } from "@/lib/xvision/linked-device";
import { parseExtraData } from "@/supabase/functions/sync-telemetry/parse";
import { resolveDeviceUpdate, type VehicleRecord } from "@/supabase/functions/sync-telemetry/vehicle-info";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Called right after a device is linked (WHE-26): copies the device's VIN (decoding year/make/model from it) and
// odometer into the vehicle record straight away instead of waiting for the next sync-telemetry run. Same rules as
// the sync (shared vehicle-info.ts). The device is resolved from the user's own link, the write goes through RLS.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { vehicleId?: unknown };
  const vehicleId = typeof body.vehicleId === "string" ? body.vehicleId : null;
  const linked = await resolveLinkedObjectId(vehicleId);
  if ("response" in linked) return linked.response;

  const supabase = createClient();
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("vin, year, make, model, trim, odometer_miles, odometer_source")
    .eq("id", vehicleId as string)
    .maybeSingle();
  if (error || !vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  let deviceVin: unknown = null;
  let odometerMiles: number | null = null;
  try {
    const device = (await getXVisionDevices()).find((d) => String(d.ObjectID) === linked.objectId);
    deviceVin = device?.VIN ?? null;
    const detail = await xvisionGet<unknown>(`/Device/GetDevice?ObjectID=${encodeURIComponent(linked.objectId)}`);
    const extra = (Array.isArray(detail) ? detail[0] : detail) as { ExtraData?: unknown } | null;
    odometerMiles = parseExtraData(extra?.ExtraData).odometer_miles;
  } catch (err) {
    console.error("[apply-device-info] xVision request failed:", err);
    return NextResponse.json({ error: "Could not reach the device service" }, { status: 502 });
  }

  const update = await resolveDeviceUpdate(
    vehicle as VehicleRecord,
    { vin: deviceVin, odometerMiles },
    undefined,
    (message) => console.log(`[apply-device-info] ${message}`),
  );
  const fields = Object.keys(update);
  if (fields.length) {
    const { error: updateError } = await supabase.from("vehicles").update(update).eq("id", vehicleId as string);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ updated: fields });
}
