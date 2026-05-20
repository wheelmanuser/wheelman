import { notFound } from "next/navigation";
import { VehicleLogbookClient } from "@/components/logbook/VehicleLogbookClient";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/types/database";
import { vehicleDisplayName } from "@/lib/vehicle-display";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { vehicleId: string };
};

export default async function LogbookPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id,year,make,model,nickname")
    .eq("id", params.vehicleId)
    .single();

  if (!vehicle) notFound();

  const v = vehicle as Pick<Vehicle, "id" | "year" | "make" | "model" | "nickname">;
  const title = vehicleDisplayName(v);

  return (
    <VehicleLogbookClient vehicleId={v.id} vehicleTitle={title} />
  );
}