import { notFound } from "next/navigation";
import { VehicleEditForm } from "@/components/garage/VehicleEditForm";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/types/database";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { vehicleId: string };
};

export default async function VehicleEditPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", params.vehicleId)
    .single();

  if (error || !vehicle) {
    notFound();
  }

  // While a device is linked the odometer is synced from it and shown read-only (WHE-26).
  const { data: device } = await supabase
    .from("vehicle_devices")
    .select("id")
    .eq("vehicle_id", params.vehicleId)
    .maybeSingle();

  return <VehicleEditForm vehicle={vehicle as Vehicle} hasDevice={!!device} />;
}
