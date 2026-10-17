import { createTtlCache } from "@/lib/ttl-cache";
import { xvisionGet } from "./client";
import { formatXVisionDateTime } from "./events";
import { normalizeTrip, parseTripPoints, summarizeTrip } from "./trip-parse";
import type { CurrentTrip, TripDetail, TripSummary } from "./types";

const TTL_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

type NormalizedTrip = NonNullable<ReturnType<typeof normalizeTrip>>;
type ParsedPoints = ReturnType<typeof parseTripPoints>;

const tripsCache = createTtlCache<NormalizedTrip[]>(TTL_MS);
const pointsCache = createTtlCache<ParsedPoints>(TTL_MS);
const summariesCache = createTtlCache<TripSummary[]>(TTL_MS);
const currentCache = createTtlCache<CurrentTrip>(TTL_MS);

// The request window is padded by a day on each side because the timezone xVision applies to
// FromDateTime/ToDateTime is undocumented; trips are then filtered precisely on their parsed start time.
export async function getDeviceTrips(objectId: string, days: number, now = Date.now()): Promise<NormalizedTrip[]> {
  const key = `${objectId}:${days}`;
  const cached = tripsCache.get(key);
  if (cached) return cached;

  const from = formatXVisionDateTime(new Date(now - (days + 1) * DAY_MS));
  const to = formatXVisionDateTime(new Date(now + DAY_MS));
  const payload = await xvisionGet<unknown>(
    `/Data/GetTrips?ObjectID=${encodeURIComponent(objectId)}` +
      `&FromDateTime=${encodeURIComponent(from)}&ToDateTime=${encodeURIComponent(to)}`,
  );
  const cutoff = now - days * DAY_MS;
  const trips = (Array.isArray(payload) ? payload : [])
    .map((t) => (t && typeof t === "object" ? normalizeTrip(t as Record<string, unknown>) : null))
    .filter((t): t is NormalizedTrip => t !== null)
    .filter((t) => !t.startAt || Date.parse(t.startAt) >= cutoff)
    .sort((a, b) => (b.startAt ?? "").localeCompare(a.startAt ?? ""));
  tripsCache.set(key, trips);
  return trips;
}

export async function getTripPoints(tripId: string): Promise<ParsedPoints> {
  const cached = pointsCache.get(tripId);
  if (cached) return cached;
  const parsed = parseTripPoints(
    await xvisionGet<unknown>(`/Data/GetTripPoints?TripID=${encodeURIComponent(tripId)}`),
  );
  pointsCache.set(tripId, parsed);
  return parsed;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// Speed stats need each trip's points, fetched a few at a time. A failed points call leaves that trip's
// speeds null ("—") and its distance on the API value rather than failing the list.
export async function getTripSummaries(objectId: string, days: number): Promise<TripSummary[]> {
  const key = `${objectId}:${days}`;
  const cached = summariesCache.get(key);
  if (cached) return cached;
  const trips = await getDeviceTrips(objectId, days);
  const summaries = await mapLimit(trips, 5, async (trip) => {
    try {
      return summarizeTrip(trip, (await getTripPoints(trip.tripId)).points);
    } catch (err) {
      console.error(`[xvision/trips] GetTripPoints failed for ${trip.tripId}:`, err);
      return summarizeTrip(trip, null);
    }
  });
  summariesCache.set(key, summaries);
  return summaries;
}

export async function getTripDetail(trip: NormalizedTrip): Promise<TripDetail> {
  const { points, events } = await getTripPoints(trip.tripId);
  return { ...summarizeTrip(trip, points), points, events };
}

export async function getCurrentTrip(objectId: string): Promise<CurrentTrip> {
  const cached = currentCache.get(objectId);
  if (cached) return cached;
  const { points, events } = parseTripPoints(
    await xvisionGet<unknown>(`/Data/GetCurrentTripPoints?ObjectID=${encodeURIComponent(objectId)}`),
  );
  const startAt = points[0]?.at ?? null;
  const lastAt = points[points.length - 1]?.at ?? null;
  const summary = summarizeTrip(
    { tripId: "current", objectId, startAt, endAt: lastAt, durationSec: null, apiDistance: null },
    points,
  );
  const current: CurrentTrip = {
    live: points.length > 0,
    startAt,
    durationSec:
      startAt && lastAt ? Math.max(0, Math.round((Date.parse(lastAt) - Date.parse(startAt)) / 1000)) : null,
    distanceKm: summary.distanceKm,
    maxSpeedKmh: summary.maxSpeedKmh,
    avgSpeedKmh: summary.avgSpeedKmh,
    points,
    events,
  };
  currentCache.set(objectId, current);
  return current;
}
