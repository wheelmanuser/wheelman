import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Resolves the xVision ObjectID for a vehicle from the signed-in user's own vehicle_devices link (RLS),
// never from client input. Returns a ready-made error response when that isn't possible.
export async function resolveLinkedObjectId(
  vehicleId: string | null,
): Promise<{ objectId: string } | { response: NextResponse }> {
  if (!vehicleId) return { response: NextResponse.json({ error: "vehicleId is required" }, { status: 400 }) };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };

  const { data: link } = await supabase
    .from("vehicle_devices")
    .select("object_id")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  if (!link?.object_id) {
    return { response: NextResponse.json({ error: "No device linked to this vehicle" }, { status: 404 }) };
  }
  return { objectId: String(link.object_id) };
}

export const PRIVATE_CACHE_HEADERS = { "Cache-Control": "private, max-age=60" };
