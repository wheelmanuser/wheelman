import { NextResponse } from "next/server";
import { PRIVATE_CACHE_HEADERS, resolveLinkedObjectId } from "@/lib/xvision/linked-device";
import { getTripSummaries } from "@/lib/xvision/trips";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const days = Number(params.get("days") ?? "7");
  if (days !== 7 && days !== 30) {
    return NextResponse.json({ error: "days must be 7 or 30" }, { status: 400 });
  }

  const linked = await resolveLinkedObjectId(params.get("vehicleId"));
  if ("response" in linked) return linked.response;

  try {
    const trips = await getTripSummaries(linked.objectId, days);
    return NextResponse.json({ trips }, { headers: PRIVATE_CACHE_HEADERS });
  } catch (err) {
    console.error("[xvision/trips]", err);
    return NextResponse.json({ error: "Could not load trips" }, { status: 502 });
  }
}
