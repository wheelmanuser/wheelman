import { centralWallClockMs } from "@/lib/central-day";
import type { TripEvent, TripPoint, TripSummary } from "@/lib/xvision/types";

type Span = Pick<TripSummary, "tripId" | "startAt" | "endAt">;

export function tripsStartingIn<T extends Pick<TripSummary, "startAt">>(
  trips: T[],
  bounds: { startMs: number; endMs: number },
): T[] {
  return trips.filter((t) => {
    if (!t.startAt) return false;
    const ms = Date.parse(t.startAt);
    return ms >= bounds.startMs && ms < bounds.endMs;
  });
}

// Totals only add values that exist; if none of the trips has a value, the total is null ("—"), never 0.
export function dayTotals(trips: Pick<TripSummary, "distanceMiles" | "durationSec">[]) {
  const sum = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v !== null);
    return present.length ? present.reduce((a, b) => a + b, 0) : null;
  };
  return {
    count: trips.length,
    distanceMiles: sum(trips.map((t) => t.distanceMiles)),
    driveSec: sum(trips.map((t) => t.durationSec)),
  };
}

function spanMs(t: Span): { start: number; end: number } | null {
  if (!t.startAt) return null;
  const start = Date.parse(t.startAt);
  const end = t.endAt ? Date.parse(t.endAt) : start;
  return { start, end: Math.max(start, end) };
}

// The trip covering `atMs` (exact), otherwise the trip whose start or end is closest to it.
export function findTripAt(trips: Span[], atMs: number): { tripId: string; exact: boolean } | null {
  let best: { tripId: string; gap: number } | null = null;
  for (const t of trips) {
    const s = spanMs(t);
    if (!s) continue;
    if (atMs >= s.start && atMs <= s.end) return { tripId: t.tripId, exact: true };
    const gap = atMs < s.start ? s.start - atMs : atMs - s.end;
    if (!best || gap < best.gap) best = { tripId: t.tripId, gap };
  }
  return best ? { tripId: best.tripId, exact: false } : null;
}

export function timelineSegments(
  trips: Span[],
  bounds: { startMs: number; endMs: number },
): { tripId: string; leftPct: number; widthPct: number }[] {
  const total = bounds.endMs - bounds.startMs;
  const clamp = (ms: number) => Math.min(bounds.endMs, Math.max(bounds.startMs, ms));
  const segments: { tripId: string; leftPct: number; widthPct: number }[] = [];
  for (const t of trips) {
    const s = spanMs(t);
    if (!s) continue;
    const left = ((clamp(s.start) - bounds.startMs) / total) * 100;
    const width = ((clamp(s.end) - clamp(s.start)) / total) * 100;
    segments.push({ tripId: t.tripId, leftPct: left, widthPct: Math.max(width, 0.6) });
  }
  return segments;
}

// 12 AM, 6 AM, 12 PM, 6 PM, 12 AM placed by real elapsed time, so they stay right on 23- and 25-hour days.
export function timelineTicks(date: string, bounds: { startMs: number; endMs: number }) {
  const total = bounds.endMs - bounds.startMs;
  const ticks = [
    { label: "12 AM", minutes: 0 },
    { label: "6 AM", minutes: 6 * 60 },
    { label: "12 PM", minutes: 12 * 60 },
    { label: "6 PM", minutes: 18 * 60 },
  ].map((t) => ({ label: t.label, pct: ((centralWallClockMs(date, t.minutes) - bounds.startMs) / total) * 100 }));
  return [...ticks, { label: "12 AM", pct: 100 }];
}

export type WaypointKind = "start" | "waypoint" | "end" | "event";

export type WaypointRow = {
  key: string;
  at: string | null;
  kind: WaypointKind;
  label: string;
  lat: number;
  lng: number;
  speedMph: number | null;
  address: string | null;
};

const EVENT_LABEL: Record<TripEvent["category"], string | null> = {
  braking: "Braking",
  acceleration: "Acceleration",
  speeding: "Speeding",
  other: null,
};

// Route points become Start / Waypoint / End; events are merged in by time and labelled by category
// (falling back to xVision's own event name).
export function buildWaypointRows(points: TripPoint[], events: TripEvent[]): WaypointRow[] {
  const rows: WaypointRow[] = points.map((p, i) => {
    const kind: WaypointKind = i === 0 ? "start" : i === points.length - 1 ? "end" : "waypoint";
    return {
      key: `p${i}`,
      at: p.at,
      kind,
      label: kind === "start" ? "Start" : kind === "end" ? "End" : "Waypoint",
      lat: p.lat,
      lng: p.lng,
      speedMph: p.speedMph,
      address: p.address,
    };
  });
  events.forEach((e, i) => {
    rows.push({
      key: `e${i}`,
      at: e.at,
      kind: "event",
      label: EVENT_LABEL[e.category] ?? e.type,
      lat: e.lat,
      lng: e.lng,
      speedMph: e.speedMph,
      address: e.address,
    });
  });
  const time = (r: WaypointRow) => (r.at ? Date.parse(r.at) : Number.POSITIVE_INFINITY);
  // On equal timestamps Start sorts first and End last, so an event at the very end doesn't follow "End".
  const rank: Record<WaypointKind, number> = { start: 0, waypoint: 1, event: 1, end: 2 };
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => time(a.r) - time(b.r) || rank[a.r.kind] - rank[b.r.kind] || a.i - b.i)
    .map(({ r }) => r);
}

export const WAYPOINT_PAGE_SIZE = 50;
