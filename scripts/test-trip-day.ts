// Run: npx tsx --test scripts/test-trip-day.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  centralDateOf,
  centralDayBounds,
  centralToday,
  centralWallClockMs,
  formatCentralTime,
  formatDayLabel,
  parseClockInput,
  validateDayParam,
} from "../lib/central-day";
import {
  buildWaypointRows,
  dayTotals,
  findTripAt,
  timelineSegments,
  timelineTicks,
  tripsStartingIn,
} from "../lib/trip-day";
import type { TripEvent, TripPoint } from "../lib/xvision/types";

const iso = (ms: number) => new Date(ms).toISOString();
const HOUR = 3_600_000;

// --- Central day boundaries -------------------------------------------------------------------------

test("Central day bounds on an ordinary CST day (Nov 3, 2026): 06:00Z to 06:00Z, 24h", () => {
  const b = centralDayBounds("2026-11-03");
  assert.equal(iso(b.startMs), "2026-11-03T06:00:00.000Z");
  assert.equal(iso(b.endMs), "2026-11-04T06:00:00.000Z");
  assert.equal(b.endMs - b.startMs, 24 * HOUR);
});

test("Central day bounds on an ordinary CDT day (Oct 30, 2026): starts 05:00Z", () => {
  const b = centralDayBounds("2026-10-30");
  assert.equal(iso(b.startMs), "2026-10-30T05:00:00.000Z");
  assert.equal(b.endMs - b.startMs, 24 * HOUR);
});

test("DST fall-back day (Nov 1, 2026) is 25 hours long", () => {
  const b = centralDayBounds("2026-11-01");
  assert.equal(iso(b.startMs), "2026-11-01T05:00:00.000Z");
  assert.equal(iso(b.endMs), "2026-11-02T06:00:00.000Z");
  assert.equal(b.endMs - b.startMs, 25 * HOUR);
});

test("DST spring-forward day (Mar 8, 2026) is 23 hours long", () => {
  const b = centralDayBounds("2026-03-08");
  assert.equal(iso(b.startMs), "2026-03-08T06:00:00.000Z");
  assert.equal(iso(b.endMs), "2026-03-09T05:00:00.000Z");
  assert.equal(b.endMs - b.startMs, 23 * HOUR);
});

test("a trip at 11:29 PM Central belongs to that Central day even though it is the next day in UTC", () => {
  const realTrip = Date.parse("2026-11-04T05:29:35Z"); // Waggie's 11:29 PM trip on Nov 3
  assert.equal(centralDateOf(realTrip), "2026-11-03");
  assert.equal(centralDateOf(Date.parse("2026-11-04T06:00:00Z")), "2026-11-04");
  assert.equal(tripsStartingIn([{ startAt: iso(realTrip) }], centralDayBounds("2026-11-03")).length, 1);
  assert.equal(tripsStartingIn([{ startAt: iso(realTrip) }], centralDayBounds("2026-11-04")).length, 0);
});

test("tripsStartingIn: start of day is included, the next midnight is excluded, missing start is dropped", () => {
  const b = centralDayBounds("2026-11-03");
  const trips = [{ startAt: iso(b.startMs) }, { startAt: iso(b.endMs - 1000) }, { startAt: iso(b.endMs) }, { startAt: null }];
  assert.deepEqual(tripsStartingIn(trips, b).map((t) => t.startAt), [iso(b.startMs), iso(b.endMs - 1000)]);
});

test("today is the Central date, not UTC's", () => {
  // 9 PM Central on Nov 3 is already Nov 4 in UTC.
  assert.equal(centralToday(Date.parse("2026-11-04T03:00:00Z")), "2026-11-03");
});

test("addDays steps across months and years", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2026-11-03", -90), "2026-08-05");
});

test("wall-clock times on a Central day resolve to the right instants", () => {
  assert.equal(iso(centralWallClockMs("2026-11-03", 23 * 60 + 29)), "2026-11-04T05:29:00.000Z");
  assert.equal(iso(centralWallClockMs("2026-10-30", 13 * 60 + 32)), "2026-10-30T18:32:00.000Z");
});

// --- date param validation --------------------------------------------------------------------------

test("date param: today and past days are accepted", () => {
  const now = Date.parse("2026-11-04T03:00:00Z"); // Nov 3, 9 PM Central
  assert.deepEqual(validateDayParam("2026-11-03", now), { ok: true, date: "2026-11-03" });
  assert.deepEqual(validateDayParam("2026-10-30", now), { ok: true, date: "2026-10-30" });
});

test("date param: future days are rejected, judged by the Central date", () => {
  const now = Date.parse("2026-11-04T03:00:00Z"); // UTC already says Nov 4, Central is still Nov 3
  const result = validateDayParam("2026-11-04", now);
  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /future/);
});

test("date param: bad formats and impossible dates are rejected", () => {
  for (const bad of ["", "2026-1-3", "2026/11/03", "2026-11-3", "2026-02-30", "2026-13-01", "20261103", "2026-11-03T00:00", "abc", null, undefined]) {
    assert.equal(validateDayParam(bad as string, Date.parse("2026-11-04T12:00:00Z")).ok, false, String(bad));
  }
});

// --- formatting and Find time -----------------------------------------------------------------------

test("day label and Central times", () => {
  assert.equal(formatDayLabel("2026-10-23"), "Fri, Oct 23, 2026");
  assert.equal(formatDayLabel("2026-11-03"), "Tue, Nov 3, 2026");
  assert.equal(formatCentralTime("2026-11-04T05:29:35.000Z"), "11:29 PM");
  assert.equal(formatCentralTime("2026-11-04T05:29:35.000Z", true), "11:29:35 PM");
  assert.equal(formatCentralTime(null), "—");
});

test("Find time input: 12-hour (and 24-hour) times, invalid input is null", () => {
  assert.equal(parseClockInput("2:30 PM"), 870);
  assert.equal(parseClockInput("2:30pm"), 870);
  assert.equal(parseClockInput("02:30 p.m."), 870);
  assert.equal(parseClockInput("12:05 AM"), 5);
  assert.equal(parseClockInput("12:00 PM"), 720);
  assert.equal(parseClockInput("14:30"), 870);
  for (const bad of ["13:00 PM", "0:30 AM", "2:61 PM", "2 PM", "abc", ""]) assert.equal(parseClockInput(bad), null, bad);
});

// Waggie's real Oct 30 trips (Central): 1:32–2:22 PM, 7:00–7:08 PM, 7:11–7:16 PM.
const OCT30 = [
  { tripId: "c", startAt: iso(centralWallClockMs("2026-10-30", 19 * 60 + 11)), endAt: iso(centralWallClockMs("2026-10-30", 19 * 60 + 16)) },
  { tripId: "b", startAt: iso(centralWallClockMs("2026-10-30", 19 * 60)), endAt: iso(centralWallClockMs("2026-10-30", 19 * 60 + 8)) },
  { tripId: "a", startAt: iso(centralWallClockMs("2026-10-30", 13 * 60 + 32)), endAt: iso(centralWallClockMs("2026-10-30", 14 * 60 + 22)) },
];
const at = (h: number, m: number) => centralWallClockMs("2026-10-30", h * 60 + m);

test("Find time: a time inside a trip selects it exactly", () => {
  assert.deepEqual(findTripAt(OCT30, at(14, 0)), { tripId: "a", exact: true });
  assert.deepEqual(findTripAt(OCT30, at(19, 8)), { tripId: "b", exact: true }, "end time is inclusive");
});

test("Find time: between or outside trips picks the nearest one, not exact", () => {
  assert.deepEqual(findTripAt(OCT30, at(19, 10)), { tripId: "c", exact: false }, "1 min before c vs 2 min after b");
  assert.deepEqual(findTripAt(OCT30, at(8, 0)), { tripId: "a", exact: false });
  assert.deepEqual(findTripAt(OCT30, at(23, 0)), { tripId: "c", exact: false });
  assert.equal(findTripAt([], at(12, 0)), null);
});

test("Find time: a trip with no end time matches only its start", () => {
  const live = [{ tripId: "live", startAt: iso(at(9, 0)), endAt: null }];
  assert.deepEqual(findTripAt(live, at(9, 0)), { tripId: "live", exact: true });
  assert.deepEqual(findTripAt(live, at(9, 5)), { tripId: "live", exact: false });
});

// --- day totals and timeline ------------------------------------------------------------------------

test("day totals: count, summed distance and drive time; missing values never become 0", () => {
  assert.deepEqual(
    dayTotals([
      { distanceMiles: 8.7, durationSec: 1343 },
      { distanceMiles: 3.2, durationSec: null },
      { distanceMiles: null, durationSec: 531 },
    ]),
    { count: 3, distanceMiles: 11.899999999999999, driveSec: 1874 },
  );
  assert.deepEqual(dayTotals([{ distanceMiles: null, durationSec: null }]), { count: 1, distanceMiles: null, driveSec: null });
  assert.deepEqual(dayTotals([]), { count: 0, distanceMiles: null, driveSec: null });
});

test("timeline: segments are placed by elapsed time across the Central day", () => {
  const b = centralDayBounds("2026-10-30");
  const seg = timelineSegments([{ tripId: "noon", startAt: iso(at(12, 0)), endAt: iso(at(13, 12)) }], b);
  assert.equal(seg[0].leftPct, 50);
  assert.equal(Number(seg[0].widthPct.toFixed(3)), 5);
});

test("timeline: a trip running past midnight is clipped to the day; tiny trips stay visible", () => {
  const b = centralDayBounds("2026-11-03");
  const [late] = timelineSegments([{ tripId: "late", startAt: iso(b.endMs - HOUR), endAt: iso(b.endMs + HOUR) }], b);
  assert.ok(Math.abs(late.leftPct + late.widthPct - 100) < 1e-9);
  const [tiny] = timelineSegments([{ tripId: "tiny", startAt: iso(b.startMs), endAt: iso(b.startMs + 1000) }], b);
  assert.ok(tiny.widthPct >= 0.6);
});

test("timeline ticks follow real elapsed time, including the 25-hour DST day", () => {
  const normal = timelineTicks("2026-10-30", centralDayBounds("2026-10-30"));
  assert.deepEqual(normal.map((t) => Number(t.pct.toFixed(2))), [0, 25, 50, 75, 100]);
  const fallBack = timelineTicks("2026-11-01", centralDayBounds("2026-11-01"));
  assert.equal(Number(fallBack[1].pct.toFixed(2)), 28, "6 AM is 7 of 25 hours in on the fall-back day");
});

// --- waypoint labels --------------------------------------------------------------------------------

function point(min: number, extra: Partial<TripPoint> = {}): TripPoint {
  return { at: iso(at(19, 0) + min * 60_000), lat: 42 + min / 1000, lng: -87.8, speedMph: 20, heading: null, address: `Addr ${min}`, ...extra };
}
function event(min: number, type: string, category: TripEvent["category"]): TripEvent {
  return { type, category, at: iso(at(19, 0) + min * 60_000), lat: 42, lng: -87.8, speedMph: 30, address: null };
}

test("waypoint labels: Start / Waypoint / End, events labelled by category, merged in time order", () => {
  const rows = buildWaypointRows(
    [point(0), point(2), point(4), point(8)],
    [event(3, "Brake", "braking"), event(5, "HarshAcceleration", "acceleration"), event(6, "Speeding", "speeding"), event(7, "Idle", "other")],
  );
  assert.deepEqual(rows.map((r) => r.label), ["Start", "Waypoint", "Braking", "Waypoint", "Acceleration", "Speeding", "Idle", "End"]);
  assert.equal(rows[0].address, "Addr 0");
  assert.equal(rows[2].kind, "event");
});

test("waypoint labels: an event at the end timestamp still comes before End; Start stays first", () => {
  const rows = buildWaypointRows([point(0), point(5)], [event(5, "Brake", "braking"), event(0, "Brake", "braking")]);
  assert.deepEqual(rows.map((r) => r.label), ["Start", "Braking", "Braking", "End"]);
});

test("waypoint labels: a single point is just Start; no points gives only events", () => {
  assert.deepEqual(buildWaypointRows([point(0)], []).map((r) => r.label), ["Start"]);
  assert.deepEqual(buildWaypointRows([], [event(1, "Brake", "braking")]).map((r) => r.label), ["Braking"]);
});
