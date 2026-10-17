import { NextResponse } from "next/server";
import { PRIVATE_CACHE_HEADERS, resolveLinkedObjectId } from "@/lib/xvision/linked-device";
import { isTripOwnedBy, SAFE_TRIP_ID } from "@/lib/xvision/trip-parse";
import { getDeviceTrips, getTripDetail } from "@/lib/xvision/trips";

export const dynamic = "force-dynamic";

const OWNERSHIP_WINDOW_DAYS = 30;

export async function GET(request: Request, { params }: { params: { tripId: string } }) {
  const tripId = params.tripId;
  if (!SAFE_TRIP_ID.test(tripId)) return NextResponse.json({ error: "Invalid trip id" }, { status: 400 });

  const linked = await resolveLinkedObjectId(new URL(request.url).searchParams.get("vehicleId"));
  if ("response" in linked) return linked.response;

  try {
    // Every user shares one xVision account, so the trip must appear in this vehicle's own device trips.
    const deviceTrips = await getDeviceTrips(linked.objectId, OWNERSHIP_WINDOW_DAYS);
    if (!isTripOwnedBy(tripId, deviceTrips, linked.objectId)) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
    const trip = deviceTrips.find((t) => t.tripId === tripId)!;
    return NextResponse.json({ trip: await getTripDetail(trip) }, { headers: PRIVATE_CACHE_HEADERS });
  } catch (err) {
    console.error("[xvision/trips/:id]", err);
    return NextResponse.json({ error: "Could not load trip" }, { status: 502 });
  }
}
