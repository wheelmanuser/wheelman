// Verifies xVision trip units/timezone against real data. Read-only; prints no IDs, VINs, IMEIs,
// coordinates or tokens. Run: npx tsx --env-file=.env.local scripts/check-xvision-trips.ts
import { xvisionGet } from "../lib/xvision/client";
import { formatXVisionDateTime } from "../lib/xvision/events";
import { getXVisionDevices } from "../lib/xvision/devices";
import { haversineKm, normalizeTrip, parseTripPoints, tripSpeedStats } from "../lib/xvision/trip-parse";

const DAYS = 30;

async function main() {
  const devices = await getXVisionDevices();
  const now = Date.now();
  const window =
    `&FromDateTime=${encodeURIComponent(formatXVisionDateTime(new Date(now - (DAYS + 1) * 864e5)))}` +
    `&ToDateTime=${encodeURIComponent(formatXVisionDateTime(new Date(now + 864e5)))}`;

  for (let i = 0; i < devices.length; i++) {
    const d = devices[i];
    const raw = await xvisionGet<unknown>(`/Data/GetTrips?ObjectID=${encodeURIComponent(String(d.ObjectID))}${window}`);
    const trips = Array.isArray(raw) ? raw : [];
    console.log(`device #${i + 1}: ${trips.length} trips in ~${DAYS} days`);
    const sample = trips[0] as Record<string, unknown> | undefined;
    if (!sample) continue;

    console.log(`  trip fields: ${Object.keys(sample).join(", ")}`);
    console.log(`  tripid type: ${typeof sample.tripid}; dateStart sample: ${JSON.stringify(sample.dateStart)}`);
    const t = normalizeTrip(sample);
    const { points, events } = parseTripPoints(
      await xvisionGet<unknown>(`/Data/GetTripPoints?TripID=${encodeURIComponent(String(sample.tripid))}`),
    );
    const pathKm = haversineKm(points);
    const apiDistance = Number(sample.distance);
    console.log(`  points: ${points.length}, events: ${events.length} (${Array.from(new Set(events.map((e) => e.type))).join(", ") || "none"})`);
    console.log(`  distance: API=${sample.distance}  GPS path=${pathKm.toFixed(3)} km  ratio API/path_km=${(apiDistance / pathKm).toFixed(3)}`);
    console.log(`    ~1.0 => km, ~0.62 => miles, ~1000 => meters (path under-counts a little)`);
    const span = t?.durationSec ?? null;
    console.log(`  duration: API=${sample.duration}  dateEnd-dateStart=${span}s  ratio=${span ? (Number(sample.duration) / span).toFixed(3) : "n/a"}`);
    console.log(`    ~1 => seconds, ~1/60 => minutes, ~1000 => ms`);
    const first = points[0]?.at; const last = points[points.length - 1]?.at;
    console.log(`  timezone: parsed dateStart=${t?.startAt}  first point=${first ?? "n/a"}  (should be within a few minutes)`);
    console.log(`            parsed dateEnd=${t?.endAt}    last point=${last ?? "n/a"}`);
    const stats = tripSpeedStats(points);
    const avgFromDistance = span ? pathKm / (span / 3600) : null;
    console.log(`  speed: max=${stats.maxSpeedKmh} avg(points)=${stats.avgSpeedKmh?.toFixed(1)}  avg from path/time=${avgFromDistance?.toFixed(1)} km/h`);
    console.log(`    if avg(points) ~ path/time in km/h, point speeds are km/h; ~0.62x of it => mph`);
  }
}
main().catch((e) => {
  console.error(String(e?.message ?? e).slice(0, 300));
  process.exit(1);
});
