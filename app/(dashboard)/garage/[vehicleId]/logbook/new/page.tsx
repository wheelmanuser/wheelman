import { notFound } from "next/navigation";
import { NewEntryModesClient } from "@/components/logbook/NewEntryModesClient";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/types/database";

type PageProps = {
  params: { vehicleId: string };
};

export default async function LogbookNewPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id,year,make,model,odometer_miles")
    .eq("id", params.vehicleId)
    .single();

  if (!vehicle) notFound();

  return (
    <NewEntryModesClient
      vehicle={vehicle as Pick<
        Vehicle,
        "id" | "year" | "make" | "model" | "odometer_miles"
      >}
    />
  );
}
