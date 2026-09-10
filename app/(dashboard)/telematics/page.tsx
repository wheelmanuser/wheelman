import { createClient } from "@/lib/supabase/server";
import { TelematicsClient } from "@/components/telematics/TelematicsClient";
import type { Vehicle, VehicleDevice, VehicleTelemetry } from "@/types/database";

export const dynamic = "force-dynamic";

type VehicleProp = Pick<Vehicle, "id" | "year" | "make" | "model" | "nickname">;

export default async function TelematicsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id,year,make,model,nickname")
    .order("created_at", { ascending: false });

  const vehicles = (data ?? []) as VehicleProp[];
  const vehicleIds = vehicles.map((v) => v.id);

  const telemetryMap: Record<string, VehicleTelemetry | null> = {};
  const deviceMap: Record<string, VehicleDevice | null> = {};
  for (const v of vehicles) {
    telemetryMap[v.id] = null;
    deviceMap[v.id] = null;
  }

  if (vehicleIds.length > 0) {
    const [{ data: telemetryRows }, { data: deviceRows }] = await Promise.all([
      supabase
        .from("vehicle_telemetry")
        .select("*")
        .in("vehicle_id", vehicleIds)
        .order("recorded_at", { ascending: false }),
      supabase.from("vehicle_devices").select("*").in("vehicle_id", vehicleIds),
    ]);

    for (const row of (telemetryRows ?? []) as VehicleTelemetry[]) {
      if (telemetryMap[row.vehicle_id] === null) telemetryMap[row.vehicle_id] = row;
    }
    for (const row of (deviceRows ?? []) as VehicleDevice[]) {
      deviceMap[row.vehicle_id] = row;
    }
  }

  return (
    <TelematicsClient vehicles={vehicles} telemetryMap={telemetryMap} deviceMap={deviceMap} />
  );
}
