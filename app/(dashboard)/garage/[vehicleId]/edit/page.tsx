import { notFound } from "next/navigation";
import { VehicleEditForm } from "@/components/garage/VehicleEditForm";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/types/database";

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

  return <VehicleEditForm vehicle={vehicle as Vehicle} />;
}
