import { notFound } from "next/navigation";
import { VehicleLogbookClient } from "@/components/logbook/VehicleLogbookClient";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/types/database";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { vehicleId: string };
};

export default async function LogbookPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id,year,make,model")
    .eq("id", params.vehicleId)
    .single();

  if (!vehicle) notFound();

  const v = vehicle as Pick<Vehicle, "id" | "year" | "make" | "model">;
  const title = `${v.year} ${v.make} ${v.model}`;

  return (
    <VehicleLogbookClient vehicleId={v.id} vehicleTitle={title} />
  );
}