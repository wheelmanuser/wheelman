import type { SupabaseClient } from "@supabase/supabase-js";
import { FLEET_TELEMETRY_COLUMNS, toFleetVehicle, type FleetVehicle } from "@/lib/fleet-status";

// One RLS-scoped query: every vehicle in the signed-in user's garage, its device link (if any) and only its
// newest vehicle_telemetry row (embedded resource ordered + limited per vehicle, served by the
// (vehicle_id, recorded_at desc) index). Reads Supabase only; the cron keeps telemetry fresh.
export async function loadFleet(supabase: SupabaseClient, vehicleId?: string): Promise<FleetVehicle[]> {
  let query = supabase
    .from("vehicles")
    .select(
      `id, year, make, model, nickname, created_at, vehicle_devices(id, device_name), vehicle_telemetry(${FLEET_TELEMETRY_COLUMNS.join(", ")})`,
    )
    .order("created_at", { ascending: false })
    .order("recorded_at", { referencedTable: "vehicle_telemetry", ascending: false })
    .limit(1, { referencedTable: "vehicle_telemetry" });
  if (vehicleId) query = query.eq("id", vehicleId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  // The select string is built at runtime, so supabase-js cannot infer the row type.
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toFleetVehicle);
}
