import { notFound } from "next/navigation";
import { VehicleLiveClient } from "@/components/garage/VehicleLiveClient";
import { loadFleet } from "@/lib/fleet";
import { isUuid } from "@/lib/fleet-status";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function VehicleLivePage({ params }: { params: { vehicleId: string } }) {
  if (!isUuid(params.vehicleId)) notFound();
  // RLS limits this to the signed-in user's vehicles, so another user's vehicle id returns nothing -> 404.
  const [vehicle] = await loadFleet(createClient(), params.vehicleId);
  if (!vehicle) notFound();
  return <VehicleLiveClient initialVehicle={vehicle} />;
}
