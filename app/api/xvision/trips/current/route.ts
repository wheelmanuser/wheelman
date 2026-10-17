import { NextResponse } from "next/server";
import { PRIVATE_CACHE_HEADERS, resolveLinkedObjectId } from "@/lib/xvision/linked-device";
import { getCurrentTrip } from "@/lib/xvision/trips";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const linked = await resolveLinkedObjectId(new URL(request.url).searchParams.get("vehicleId"));
  if ("response" in linked) return linked.response;

  try {
    return NextResponse.json({ current: await getCurrentTrip(linked.objectId) }, { headers: PRIVATE_CACHE_HEADERS });
  } catch (err) {
    console.error("[xvision/trips/current]", err);
    return NextResponse.json({ error: "Could not load current trip" }, { status: 502 });
  }
}
