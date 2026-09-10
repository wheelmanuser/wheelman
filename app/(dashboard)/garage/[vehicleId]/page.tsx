import { notFound } from "next/navigation";
import { VehicleDetailClient } from "@/components/garage/VehicleDetailClient";
import { enrichSchedules } from "@/lib/service-schedule-display";
import { createClient } from "@/lib/supabase/server";
import type { ServiceSchedule, Vehicle, VehicleDevice } from "@/types/database";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { vehicleId: string };
};

export default async function VehicleDetailPage({ params }: PageProps) {
  const supabase = createClient();

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", params.vehicleId)
    .single();

  if (vehicleError || !vehicle) {
    notFound();
  }

  const v = vehicle as Vehicle;

  const [{ data: schedules }, { data: deviceRow }] = await Promise.all([
    supabase
      .from("service_schedules")
      .select("*")
      .eq("vehicle_id", v.id)
      .order("service_name"),
    supabase
      .from("vehicle_devices")
      .select("*")
      .eq("vehicle_id", v.id)
      .maybeSingle(),
  ]);

  const scheduleRows = (schedules ?? []) as ServiceSchedule[];
  const enriched = enrichSchedules(v, scheduleRows);
  const device = (deviceRow ?? null) as VehicleDevice | null;
  const hasDevice = device !== null;

  return (
    <VehicleDetailClient
      vehicle={v}
      hasDevice={hasDevice}
      device={device}
      initialSchedules={enriched}
    />
  );
}