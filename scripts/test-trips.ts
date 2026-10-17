// Run: npx tsx --test scripts/test-trips.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  categorizeEvent,
  haversineKm,
  isTripOwnedBy,
  kmToMiles,
  normalizeTrip,
  parseTripPoints,
  parseTripTime,
  resolveTripDistanceKm,
  SAFE_TRIP_ID,
  summarizeTrip,
  tripSpeedStats,
} from "../lib/xvision/trip-parse";
import { formatDuration, formatSpeed, formatTimeRange, formatTripDistance, groupByDay } from "../lib/trip-display";
import { formatDistance } from "../lib/format-distance";
import { createTtlCache } from "../lib/ttl-cache";
import type { TripPoint } from "../lib/xvision/types";

const UUID = "3f2b8c1e-9d4a-4e7b-8a61-0c5d2e9f7a13";

test("trip times: account-timezone strings (America/Chicago), ISO, and epoch seconds/ms", () => {
  assert.equal(parseTripTime("10/15/2026 01:47:52 PM"), "2026-10-15T18:47:52.000Z"); // CDT
  assert.equal(parseTripTime("01/15/2026 01:47:52 PM"), "2026-01-15T19:47:52.000Z"); // CST
  assert.equal(parseTripTime("2026-10-15T18:47:52Z"), "2026-10-15T18:47:52.000Z");
  assert.equal(parseTripTime(1792090072), "2026-10-15T18:47:52.000Z");
  assert.equal(parseTripTime(1792090072000), "2026-10-15T18:47:52.000Z");
  assert.equal(parseTripTime("1792090072"), "2026-10-15T18:47:52.000Z");
  assert.equal(parseTripTime(null), null);
  assert.equal(parseTripTime("garbage"), null);
});

test("normalizeTrip: UUID or numeric trip ids, duration from timestamps", () => {
  const t = normalizeTrip({
    tripid: UUID,
    ObjectID: "obj-1",
    distance: 12.4,
    duration: 999999,
    dateStart: "10/15/2026 01:47:52 PM",
    dateEnd: "10/15/2026 02:10:22 PM",
  });
  assert.ok(t);
  assert.equal(t.tripId, UUID);
  assert.equal(t.objectId, "obj-1");
  assert.equal(t.apiDistance, 12.4);
  assert.equal(t.durationSec, 1350, "22m30s from the timestamps; the raw duration field is ignored");
  assert.equal(normalizeTrip({ tripid: 42 })?.tripId, "42");
  assert.equal(normalizeTrip({ distance: 1 }), null);
});

test("normalizeTrip: missing or reversed timestamps give a null duration, never 0", () => {
  assert.equal(normalizeTrip({ tripid: UUID, dateStart: "10/15/2026 01:47:52 PM" })?.durationSec, null);
  assert.equal(
    normalizeTrip({ tripid: UUID, dateStart: "10/15/2026 02:00:00 PM", dateEnd: "10/15/2026 01:00:00 PM" })?.durationSec,
    null,
  );
  assert.equal(normalizeTrip({ tripid: UUID, distance: "" })?.apiDistance, null);
});

test("parseTripPoints: drops invalid coordinates, keeps missing speed as null, sorts by time", () => {
  const { points } = parseTripPoints({
    TripPoints: [
      { dateTS: 1792090200, lat: 41.9, lng: -87.6, speed: 40 },
      { dateTS: 1792090100, lat: 41.88, lng: -87.63, speed: null },
      { dateTS: 1792090150, lat: 0, lng: 0, speed: 10 },
      { dateTS: 1792090160, lat: "abc", lng: -87.6 },
      { dateTS: 1792090170, lat: 95, lng: -87.6 },
      { DateTime: "10/15/2026 01:47:52 PM", lat: 41.87, lng: -87.64, speed: 0 },
    ],
  });
  assert.equal(points.length, 3);
  assert.deepEqual(points.map((p) => p.speedKmh), [0, null, 40]);
  assert.equal(points[0].at, "2026-10-15T18:47:52.000Z");
});

test("parseTripPoints: events read EventTime first, fall back to DateTime, and are categorized", () => {
  const { events } = parseTripPoints({
    Events: [
      { EventType: "HarshBraking", Latitude: 41.9, Longitude: -87.6, Speed: 50, EventTime: "2026-10-15T18:50:00Z", DateTime: "2026-01-01T00:00:00Z" },
      { EventType: "HarshAcceleration", Latitude: 41.9, Longitude: -87.6, DateTime: "10/15/2026 01:55:00 PM" },
      { EventType: "Speeding", Latitude: 41.9, Longitude: -87.6 },
      { EventType: "Idle", Latitude: 41.9, Longitude: -87.6 },
      { EventType: "HarshBraking", Latitude: null, Longitude: -87.6 },
    ],
  });
  assert.equal(events.length, 4);
  assert.equal(events[0].at, "2026-10-15T18:50:00.000Z");
  assert.equal(events[1].at, "2026-10-15T18:55:00.000Z");
  assert.deepEqual(events.map((e) => e.category), ["braking", "acceleration", "speeding", "other"]);
  assert.equal(events[2].speedKmh, null);
  assert.equal(categorizeEvent("HARD_BRAKE"), "braking");
});

test("parseTripPoints: empty / malformed payloads yield no points", () => {
  assert.deepEqual(parseTripPoints(null), { points: [], events: [] });
  assert.deepEqual(parseTripPoints({ TripPoints: "nope", Events: {} }), { points: [], events: [] });
});

test("haversine: one degree of latitude is ~111.2 km", () => {
  const km = haversineKm([
    { lat: 41, lng: -87 },
    { lat: 42, lng: -87 },
  ]);
  assert.ok(Math.abs(km - 111.2) < 0.1, String(km));
  assert.equal(haversineKm([{ lat: 41, lng: -87 }]), 0);
});

function pt(sec: number, speed: number | null): TripPoint {
  return { at: new Date(1792090000000 + sec * 1000).toISOString(), lat: 41.9, lng: -87.6, speedKmh: speed, heading: null };
}

test("speed stats: max and a time-weighted average over irregular samples", () => {
  // 0->60 over 60s, then 60 held for 540s: plain mean of [0,60,60] = 40, time-weighted = 57
  const stats = tripSpeedStats([pt(0, 0), pt(60, 60), pt(600, 60)]);
  assert.equal(stats.maxSpeedKmh, 60);
  assert.equal(stats.avgSpeedKmh, 57);
});

test("speed stats: no speed samples -> null, not 0; missing timestamps -> plain mean", () => {
  assert.deepEqual(tripSpeedStats([pt(0, null), pt(60, null)]), { maxSpeedKmh: null, avgSpeedKmh: null });
  assert.deepEqual(tripSpeedStats([]), { maxSpeedKmh: null, avgSpeedKmh: null });
  const noTimes = [pt(0, 20), pt(1, 40)].map((p) => ({ ...p, at: null }));
  assert.equal(tripSpeedStats(noTimes).avgSpeedKmh, 30);
});

test("distance: API value (assumed km) is kept when the GPS path roughly agrees", () => {
  assert.equal(resolveTripDistanceKm(10, 8.5), 10);
  assert.equal(resolveTripDistanceKm(10, 26), 10);
});

test("distance: an API value off by >3x from the path (e.g. meters) falls back to the path length", () => {
  assert.equal(resolveTripDistanceKm(12400, 12.1), 12.1);
  assert.equal(resolveTripDistanceKm(0.002, 2), 2);
});

test("distance: missing API value uses the path; nothing usable is null, never 0", () => {
  assert.equal(resolveTripDistanceKm(null, 3.2), 3.2);
  assert.equal(resolveTripDistanceKm(null, 0), null);
  assert.equal(resolveTripDistanceKm(null, null), null);
  assert.equal(resolveTripDistanceKm(500, 0.1), 500, "too short a path to second-guess the API");
});

test("summarizeTrip combines API fields with point-derived stats", () => {
  const trip = normalizeTrip({ tripid: UUID, distance: 1.0, dateStart: "10/15/2026 01:47:52 PM", dateEnd: "10/15/2026 01:57:52 PM" })!;
  const s = summarizeTrip(trip, [pt(0, 30), pt(600, 50)]);
  assert.equal(s.durationSec, 600);
  assert.equal(s.maxSpeedKmh, 50);
  assert.equal(s.distanceKm, 1.0);
  const noPoints = summarizeTrip(trip, null);
  assert.equal(noPoints.maxSpeedKmh, null);
  assert.equal(noPoints.distanceKm, 1.0);
});

test("unit conversion: km to miles and the user's distance setting", () => {
  assert.equal(kmToMiles(null), null);
  assert.ok(Math.abs((kmToMiles(16.09344) as number) - 10) < 1e-9);
  assert.equal(formatTripDistance(16.09344, "miles"), "10.0 mi");
  assert.equal(formatTripDistance(16.09344, "km"), "16.1 km");
  assert.equal(formatTripDistance(0.6, "miles"), "0.4 mi", "short trips keep a decimal instead of showing 0");
  assert.equal(formatSpeed(100, "km"), "100 km/h");
  assert.equal(formatSpeed(100, "miles"), "62 mph");
});

test("display: missing values render as an em dash, never 0", () => {
  assert.equal(formatTripDistance(null, "miles"), "—");
  assert.equal(formatSpeed(null, "miles"), "—");
  assert.equal(formatSpeed(undefined, "km"), "—");
  assert.equal(formatDuration(null), "—");
  assert.equal(formatTimeRange(null, null), "—");
  assert.equal(formatDistance(null, "miles"), "—");
});

test("display: durations and the unchanged default distance format", () => {
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(1350), "22m");
  assert.equal(formatDuration(3725), "1h 02m");
  assert.equal(formatDistance(4062.5, "miles"), "4,063 mi");
  assert.equal(formatDistance(100, "km"), "161 km");
});

test("ownership: a trip id must appear in the vehicle's own device trips", () => {
  const deviceTrips = [
    { tripId: UUID, objectId: "obj-1" },
    { tripId: "trip-2", objectId: null },
  ];
  assert.equal(isTripOwnedBy(UUID, deviceTrips, "obj-1"), true);
  assert.equal(isTripOwnedBy("trip-2", deviceTrips, "obj-1"), true, "records without ObjectID rely on list membership");
  assert.equal(isTripOwnedBy("someone-elses-trip", deviceTrips, "obj-1"), false);
  assert.equal(isTripOwnedBy(UUID, deviceTrips, "obj-2"), false, "same id under a different device is rejected");
  assert.equal(isTripOwnedBy(UUID, [], "obj-1"), false);
});

test("ownership: trip ids are validated before use", () => {
  assert.equal(SAFE_TRIP_ID.test(UUID), true);
  assert.equal(SAFE_TRIP_ID.test("12345"), true);
  for (const bad of ["../etc", "a b", "x&TripID=y", "", "a".repeat(65)]) assert.equal(SAFE_TRIP_ID.test(bad), false, bad);
});

test("ttl cache: entries expire after the TTL and the oldest are evicted", () => {
  const cache = createTtlCache<number>(60_000, 2);
  cache.set("a", 1, 0);
  assert.equal(cache.get("a", 59_999), 1);
  assert.equal(cache.get("a", 60_000), undefined);
  cache.set("a", 1, 0);
  cache.set("b", 2, 0);
  cache.set("c", 3, 0);
  assert.equal(cache.get("a", 1), undefined);
  assert.equal(cache.get("c", 1), 3);
});

test("groupByDay keeps order and groups consecutive same-day trips", () => {
  const groups = groupByDay([
    { startAt: "2026-10-15T18:00:00.000Z" },
    { startAt: "2026-10-15T17:00:00.000Z" },
    { startAt: "2026-10-12T17:00:00.000Z" },
    { startAt: null },
  ]);
  assert.deepEqual(groups.map((g) => g.items.length), [2, 1, 1]);
  assert.equal(groups[2].label, "Unknown date");
});
