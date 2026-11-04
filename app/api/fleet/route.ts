import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadFleet } from "@/lib/fleet";
import { isUuid } from "@/lib/fleet-status";

export const dynamic = "force-dynamic";

// Latest stored telemetry for the signed-in user's vehicles (RLS). No xVision calls: the cron syncs.
export async function GET(request: Request) {
  const vehicleId = new URL(request.url).searchParams.get("vehicleId");
  if (vehicleId !== null && !isUuid(vehicleId)) {
    return NextResponse.json({ error: "Invalid vehicleId" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const vehicles = await loadFleet(supabase, vehicleId ?? undefined);
    if (vehicleId && vehicles.length === 0) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    return NextResponse.json({ vehicles }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[api/fleet]", err);
    return NextResponse.json({ error: "Could not load fleet" }, { status: 500 });
  }
}
