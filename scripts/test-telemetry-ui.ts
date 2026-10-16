// Run: npx tsx --test scripts/test-telemetry-ui.ts
import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMilEvents } from "../lib/xvision/events";
import { parseEventTime } from "../supabase/functions/sync-telemetry/parse";
import { formatDeviceBattery, formatFuelLevel, formatMpg, formatVolts } from "../lib/telemetry-display";
import { formatDistance } from "../lib/format-distance";

const NOW = Date.parse("2026-10-20T00:00:00Z");

test("no MIL events -> not on", () => {
  assert.deepEqual(summarizeMilEvents([], NOW), { milOn: false, lastEventAt: null });
});

test("a recent MIL event turns it on and reports its time", () => {
  assert.deepEqual(
    summarizeMilEvents([{ EventType: "MIL", DateTime: "2026-10-10T12:00:00Z" }], NOW),
    { milOn: true, lastEventAt: "2026-10-10T12:00:00.000Z" },
  );
});

test("multiple MIL events report the most recent time", () => {
  const r = summarizeMilEvents(
    [
      { EventType: "MIL", DateTime: "2026-10-01T08:00:00Z" },
      { EventType: "MIL", DateTime: "2026-10-15T08:00:00Z" },
      { EventType: "MIL", DateTime: "2026-10-05T08:00:00Z" },
    ],
    NOW,
  );
  assert.equal(r.lastEventAt, "2026-10-15T08:00:00.000Z");
});

test("events older than 30 days are ignored", () => {
  assert.equal(summarizeMilEvents([{ EventType: "MIL", DateTime: "2026-09-01T00:00:00Z" }], NOW).milOn, false);
  assert.equal(summarizeMilEvents([{ EventType: "MIL", DateTime: "2026-09-20T00:00:00Z" }], NOW).milOn, true);
  assert.equal(summarizeMilEvents([{ EventType: "MIL", DateTime: "2026-09-19T23:59:59Z" }], NOW).milOn, false);
});

test("non-MIL events are ignored", () => {
  assert.equal(summarizeMilEvents([{ EventType: "Idle", DateTime: "2026-10-10T12:00:00Z" }], NOW).milOn, false);
});

test("US-format event times are read as US Central", () => {
  assert.equal(
    summarizeMilEvents([{ EventType: "MIL", DateTime: "10/18/2026 05:40:00 PM" }], NOW).lastEventAt,
    "2026-10-18T22:40:00.000Z",
  );
});

test("an unparseable event time still counts, with no time shown", () => {
  assert.deepEqual(summarizeMilEvents([{ EventType: "MIL", DateTime: "yesterday-ish" }], NOW), {
    milOn: true,
    lastEventAt: null,
  });
});

test("malformed entries are skipped", () => {
  assert.equal(summarizeMilEvents([null, "x", 5, {}], NOW).milOn, true); // {} has no EventType: treated as a MIL result
  assert.equal(summarizeMilEvents([null, "x", 5], NOW).milOn, false);
});

test("parseEventTime handles ISO (with/without offset) and US formats", () => {
  assert.equal(parseEventTime("2026-10-10T12:00:00Z"), "2026-10-10T12:00:00.000Z");
  assert.equal(parseEventTime("2026-10-10T12:00:00-05:00"), "2026-10-10T17:00:00.000Z");
  assert.equal(parseEventTime("2026-10-10 12:00:00"), "2026-10-10T12:00:00.000Z");
  assert.equal(parseEventTime("10/16/2026 05:40:00 PM"), "2026-10-16T22:40:00.000Z");
  assert.equal(parseEventTime("nope"), null);
  assert.equal(parseEventTime(null), null);
});

test("missing values render as an em dash, never a zero", () => {
  for (const missing of [null, undefined, ""]) {
    assert.equal(formatFuelLevel(missing), "—");
    assert.equal(formatVolts(missing), "—");
    assert.equal(formatMpg(missing), "—");
    assert.equal(formatDeviceBattery(missing), null);
  }
  assert.equal(formatDistance(null, "miles"), "—");
  assert.equal(formatDistance(undefined, "km"), "—");
});

test("present values format with units", () => {
  assert.equal(formatFuelLevel(56), "56%");
  assert.equal(formatFuelLevel("58.0"), "58%");
  assert.equal(formatVolts(12.3), "12.3 V");
  assert.equal(formatMpg(15.04), "15.0 MPG");
  assert.equal(formatDeviceBattery(100), "Device battery 100%");
  assert.equal(formatDistance(4062.5, "miles"), "4,063 mi");
  assert.equal(formatDistance(100, "km"), "161 km");
});
