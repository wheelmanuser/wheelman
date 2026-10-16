import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCheckEngineStatus } from "@/lib/xvision/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const vehicleId = new URL(request.url).searchParams.get("vehicleId");
  if (!vehicleId) return NextResponse.json({ error: "vehicleId is required" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // RLS limits this to the caller's own devices, so a client can't query an arbitrary ObjectID.
  const { data: link } = await supabase
    .from("vehicle_devices")
    .select("object_id")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  if (!link) return NextResponse.json({ status: "no_device" });

  try {
    const result = await getCheckEngineStatus(link.object_id as string);
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[xvision/check-engine]", err);
    return NextResponse.json({ error: "Could not load check engine status" }, { status: 502 });
  }
}
