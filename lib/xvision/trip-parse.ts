import { parseEventTime } from "@/supabase/functions/sync-telemetry/parse";
import type { TripEvent, TripEventCategory, TripPoint, TripSummary } from "./types";

// Units CONFIRMED on real trips (2026-11-04, scripts/check-xvision-trips.ts, 3 devices): API distance / GPS
// path in miles = 1.003, 0.998, 1.002; average point speed ~ path/time in mph; duration is seconds. xVision
// returns numbers in the account's display units (Units "mph"), so speed is mph and distance is miles.
export const ASSUMED_TRIP_DISTANCE_UNIT = "mi";
export const ASSUMED_SPEED_UNIT = "mph";

const KM_PER_MILE = 1.609344;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

// Epoch seconds or milliseconds, or a date string (ISO, or the account-timezone "MM/DD/YYYY hh:mm:ss AM").
export function parseTripTime(value: unknown): string | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
  if (n !== null) {
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return parseEventTime(value);
}

function validCoordinate(lat: number | null, lng: number | null): lat is number {
  return (
    lat !== null &&
    lng !== null &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export function categorizeEvent(type: string): TripEventCategory {
  if (/brak/i.test(type)) return "braking";
  if (/accel/i.test(type)) return "acceleration";
  if (/speed/i.test(type)) return "speeding";
  return "other";
}

export function parseTripPoints(payload: unknown): { points: TripPoint[]; events: TripEvent[] } {
  const body = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const rawPoints = Array.isArray(body.TripPoints) ? body.TripPoints : [];
  const rawEvents = Array.isArray(body.Events) ? body.Events : [];

  const points: TripPoint[] = [];
  for (const p of rawPoints) {
    if (!p || typeof p !== "object") continue;
    const r = p as Record<string, unknown>;
    const lat = num(r.lat);
    const lng = num(r.lng);
    if (!validCoordinate(lat, lng)) continue;
    points.push({
      at: parseTripTime(r.dateTS) ?? parseTripTime(r.DateTime),
      lat,
      lng: lng as number,
      speedMph: num(r.speed),
      heading: num(r.heading),
    });
  }
  points.sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : 0));

  const events: TripEvent[] = [];
  for (const e of rawEvents) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    const lat = num(r.Latitude);
    const lng = num(r.Longitude);
    if (!validCoordinate(lat, lng)) continue;
    const type = text(r.EventType) ?? "Event";
    events.push({
      type,
      category: categorizeEvent(type),
      at: parseTripTime(r.EventTime) ?? parseTripTime(r.DateTime),
      lat,
      lng: lng as number,
      speedMph: num(r.Speed),
    });
  }
  return { points, events };
}

export function haversineKm(points: Pick<TripPoint, "lat" | "lng">[]): number {
  const R = 6371.0088;
  const rad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total;
}

export function haversineMiles(points: Pick<TripPoint, "lat" | "lng">[]): number {
  return haversineKm(points) / KM_PER_MILE;
}

// Max speed, and an average weighted by the time each sample covers (samples can be irregular).
// Falls back to a plain mean when timestamps are missing. Null when there are no speed samples.
export function tripSpeedStats(points: TripPoint[]): { maxSpeedMph: number | null; avgSpeedMph: number | null } {
  const samples = points.filter((p) => p.speedMph !== null);
  if (samples.length === 0) return { maxSpeedMph: null, avgSpeedMph: null };
  const maxSpeedMph = Math.max(...samples.map((p) => p.speedMph as number));

  let weighted = 0;
  let totalSec = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (!a.at || !b.at) continue;
    const sec = (Date.parse(b.at) - Date.parse(a.at)) / 1000;
    if (sec <= 0) continue;
    weighted += (((a.speedMph as number) + (b.speedMph as number)) / 2) * sec;
    totalSec += sec;
  }
  const avgSpeedMph =
    totalSec > 0
      ? weighted / totalSec
      : samples.reduce((sum, p) => sum + (p.speedMph as number), 0) / samples.length;
  return { maxSpeedMph, avgSpeedMph };
}

// Trust the API distance (assumed miles) unless the GPS path says it's off by more than 3x, which means the
// unit assumption is wrong (e.g. meters); then use the path length. Miles vs km (1.6x) can't be told apart
// this way, which is why check-xvision-trips.ts exists; it confirmed miles on real trips.
const MIN_PATH_MILES_TO_CROSS_CHECK = 0.125;

export function resolveTripDistanceMiles(apiDistance: number | null, pathMiles: number | null): number | null {
  if (apiDistance === null) return pathMiles !== null && pathMiles > 0 ? pathMiles : null;
  if (pathMiles !== null && pathMiles >= MIN_PATH_MILES_TO_CROSS_CHECK) {
    const ratio = apiDistance / pathMiles;
    if (ratio > 3 || ratio < 1 / 3) return pathMiles;
  }
  return apiDistance;
}

export type RawTrip = Record<string, unknown>;

export function normalizeTrip(raw: RawTrip): {
  tripId: string;
  objectId: string | null;
  startAt: string | null;
  endAt: string | null;
  durationSec: number | null;
  apiDistance: number | null;
} | null {
  const tripId = text(raw.tripid ?? raw.TripID ?? raw.tripId);
  if (!tripId) return null;
  const startAt = parseTripTime(raw.dateStart);
  const endAt = parseTripTime(raw.dateEnd);
  // Duration from the parsed timestamps, so the undocumented unit of `duration` doesn't matter.
  const durationSec =
    startAt && endAt && Date.parse(endAt) >= Date.parse(startAt)
      ? Math.round((Date.parse(endAt) - Date.parse(startAt)) / 1000)
      : null;
  return {
    tripId,
    objectId: text(raw.ObjectID),
    startAt,
    endAt,
    durationSec,
    apiDistance: num(raw.distance),
  };
}

export function summarizeTrip(
  trip: NonNullable<ReturnType<typeof normalizeTrip>>,
  points: TripPoint[] | null,
): TripSummary {
  const pathMiles = points && points.length > 1 ? haversineMiles(points) : null;
  const stats = points ? tripSpeedStats(points) : { maxSpeedMph: null, avgSpeedMph: null };
  return {
    tripId: trip.tripId,
    startAt: trip.startAt,
    endAt: trip.endAt,
    durationSec: trip.durationSec,
    distanceMiles: resolveTripDistanceMiles(trip.apiDistance, pathMiles),
    ...stats,
  };
}

// A trip belongs to a device only if it appears in that device's own GetTrips result (and, when the
// record carries an ObjectID, that ObjectID matches). Client-supplied trip IDs are never trusted alone.
export function isTripOwnedBy(
  tripId: string,
  deviceTrips: { tripId: string; objectId: string | null }[],
  objectId: string,
): boolean {
  return deviceTrips.some((t) => t.tripId === tripId && (t.objectId === null || t.objectId === objectId));
}

export const SAFE_TRIP_ID = /^[A-Za-z0-9-]{1,64}$/;
