import { NextResponse } from "next/server";
import { validateDayParam } from "@/lib/central-day";
import { PRIVATE_CACHE_HEADERS, resolveLinkedObjectId } from "@/lib/xvision/linked-device";
import { getDayTripSummaries, getTripSummaries } from "@/lib/xvision/trips";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ?days=7|30 for the vehicle Trips tab, or ?date=YYYY-MM-DD for the trips starting on that Central day.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const dateParam = params.get("date");

  let day: string | null = null;
  let days: number | null = null;
  if (dateParam !== null) {
    const result = validateDayParam(dateParam);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    day = result.date;
  } else {
    days = Number(params.get("days") ?? "7");
    if (days !== 7 && days !== 30) {
      return NextResponse.json({ error: "days must be 7 or 30" }, { status: 400 });
    }
  }

  const linked = await resolveLinkedObjectId(params.get("vehicleId"));
  if ("response" in linked) return linked.response;

  try {
    const trips = day
      ? await getDayTripSummaries(linked.objectId, day)
      : await getTripSummaries(linked.objectId, days as number);
    return NextResponse.json(day ? { trips, date: day } : { trips }, { headers: PRIVATE_CACHE_HEADERS });
  } catch (err) {
    console.error("[xvision/trips]", err);
    return NextResponse.json({ error: "Could not load trips" }, { status: 502 });
  }
}
