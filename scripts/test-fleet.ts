// Run: npx tsx --test scripts/test-fleet.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  computeMapView,
  filterFleet,
  fleetCounts,
  fleetPins,
  fleetStatus,
  formatLastSeen,
  isUuid,
  showLastSeen,
  SINGLE_PIN_ZOOM,
  toFleetVehicle,
  type FleetTelemetry,
  type FleetVehicle,
} from "../lib/fleet-status";
import { formatIgnition, formatTelemetrySpeed } from "../lib/telemetry-display";
import { activeNavHref, pageTitle } from "../lib/nav";

const NOW = Date.parse("2026-11-03T18:00:00Z");

function t(overrides: Partial<FleetTelemetry> = {}): FleetTelemetry {
  return {
    latitude: 42.07,
    longitude: -87.79,
    address: "1800 Glenview Rd, Glenview, IL",
    speed: 0,
    heading: null,
    ignition: "0",
    is_online: true,
    vehicle_status: "Parked",
    last_contact: new Date(NOW - 60_000).toISOString(),
    recorded_at: new Date(NOW - 30_000).toISOString(),
    odometer_miles: null,
    fuel_level_pct: null,
    input_voltage: null,
    fuel_economy_mpg: null,
    device_battery_pct: null,
    ...overrides,
  };
}

// Status mapping, including the real combinations seen in vehicle_telemetry.
test("status: no linked device", () => {
  assert.equal(fleetStatus(false, null), "no_device");
  assert.equal(fleetStatus(false, t({ ignition: "1", speed: 40 })), "no_device");
});

test("status: offline wins over a stale moving reading", () => {
  assert.equal(fleetStatus(true, t({ is_online: false })), "offline");
  assert.equal(fleetStatus(true, t({ is_online: false, ignition: "1", speed: 50, vehicle_status: "Moving" })), "offline");
});

test("status: a linked device with no reading yet is offline", () => {
  assert.equal(fleetStatus(true, null), "offline");
});

test("status: real 'Moving' readings (ignition on), including speed 0 at a light", () => {
  assert.equal(fleetStatus(true, t({ vehicle_status: "Moving", ignition: "1", speed: 24 })), "moving");
  assert.equal(fleetStatus(true, t({ vehicle_status: "Moving", ignition: "1", speed: 0 })), "moving");
});

test("status: real 'Idle' readings (ignition on, speed 0) count as moving", () => {
  assert.equal(fleetStatus(true, t({ vehicle_status: "Idle", ignition: "1", speed: 0 })), "moving");
});

test("status: real 'Parked' readings (ignition off, speed 0)", () => {
  assert.equal(fleetStatus(true, t({ vehicle_status: "Parked", ignition: "0", speed: 0 })), "parked");
  assert.equal(fleetStatus(true, t({ vehicle_status: "Parked", ignition: "0", speed: null })), "parked");
});

test("status: GPS drift on a parked car (Parked + ignition off + small speed) stays parked", () => {
  assert.equal(fleetStatus(true, t({ vehicle_status: "Parked", ignition: "0", speed: 2.6 })), "parked");
  assert.equal(fleetStatus(true, t({ vehicle_status: "Parked", ignition: "0", speed: 11.2 })), "parked");
});

test("status: speed > 0 is moving when not explicitly parked with ignition off", () => {
  assert.equal(fleetStatus(true, t({ vehicle_status: null, ignition: null, speed: 30 })), "moving");
  assert.equal(fleetStatus(true, t({ vehicle_status: "Parked", ignition: null, speed: 30 })), "moving");
  assert.equal(fleetStatus(true, t({ vehicle_status: null, ignition: "0", speed: 30 })), "moving");
});

test("status: speed 0 with ignition off and no status is parked; ignition variants are understood", () => {
  assert.equal(fleetStatus(true, t({ vehicle_status: null, ignition: "0", speed: 0 })), "parked");
  assert.equal(fleetStatus(true, t({ vehicle_status: null, ignition: "On", speed: 0 })), "moving");
  assert.equal(fleetStatus(true, t({ vehicle_status: "moving", ignition: null, speed: 0 })), "moving");
});

test("counts: devices excludes no-device vehicles; moving/parked/offline are counted", () => {
  const counts = fleetCounts([
    { status: "moving" },
    { status: "moving" },
    { status: "parked" },
    { status: "offline" },
    { status: "no_device" },
    { status: "no_device" },
  ]);
  assert.deepEqual(counts, { total: 6, devices: 4, moving: 2, parked: 1, offline: 1 });
  assert.deepEqual(fleetCounts([]), { total: 0, devices: 0, moving: 0, parked: 0, offline: 0 });
});

test("filter: All keeps no-device vehicles; status filters match exactly", () => {
  const list = [{ status: "moving" as const }, { status: "parked" as const }, { status: "no_device" as const }];
  assert.equal(filterFleet(list, "all").length, 3);
  assert.deepEqual(filterFleet(list, "moving"), [{ status: "moving" }]);
  assert.deepEqual(filterFleet(list, "offline"), []);
});

test("last seen: relative formatting", () => {
  assert.equal(formatLastSeen(null, NOW), "Never");
  assert.equal(formatLastSeen("garbage", NOW), "Never");
  assert.equal(formatLastSeen(new Date(NOW - 20_000).toISOString(), NOW), "just now");
  assert.equal(formatLastSeen(new Date(NOW + 60_000).toISOString(), NOW), "just now", "clock skew");
  assert.equal(formatLastSeen(new Date(NOW - 5 * 60_000).toISOString(), NOW), "5m ago");
  assert.equal(formatLastSeen(new Date(NOW - 59 * 60_000).toISOString(), NOW), "59m ago");
  assert.equal(formatLastSeen(new Date(NOW - 12 * 3_600_000).toISOString(), NOW), "12h ago");
  assert.equal(formatLastSeen(new Date(NOW - 3 * 86_400_000).toISOString(), NOW), "3d ago");
});

test("last seen on dashboard tiles: Offline only, not stale Parked cars", () => {
  assert.equal(showLastSeen({ status: "offline" }), true);
  assert.equal(showLastSeen({ status: "parked" }), false, "even if it hasn't reported for hours");
  assert.equal(showLastSeen({ status: "moving" }), false);
  assert.equal(showLastSeen({ status: "no_device" }), false);
});

test("toFleetVehicle: device as object (one-to-one) or array, telemetry as array; name via vehicleDisplayName", () => {
  const base = { id: "a", year: 2019, make: "Porsche", model: "911", nickname: null };
  const asObject = toFleetVehicle({ ...base, vehicle_devices: { id: "d", device_name: "XT" }, vehicle_telemetry: [{ ...t(), speed: "12" }] });
  assert.equal(asObject.hasDevice, true);
  assert.equal(asObject.deviceName, "XT");
  assert.equal(asObject.name, "2019 Porsche 911");
  assert.equal(asObject.telemetry?.speed, 12);
  const asArray = toFleetVehicle({ ...base, nickname: "The Beast", vehicle_devices: [{ id: "d" }], vehicle_telemetry: [] });
  assert.equal(asArray.hasDevice, true);
  assert.equal(asArray.telemetry, null);
  assert.equal(asArray.status, "offline");
  assert.equal(asArray.name, "The Beast");
  const none = toFleetVehicle({ ...base, vehicle_devices: null, vehicle_telemetry: [] });
  assert.equal(none.status, "no_device");
});

test("toFleetVehicle: missing numbers stay null, never 0", () => {
  const v = toFleetVehicle({
    id: "a", year: 2020, make: "BMW", model: "M3", nickname: null,
    vehicle_devices: { id: "d" },
    vehicle_telemetry: [{ latitude: null, longitude: "", speed: undefined, odometer_miles: null, is_online: true }],
  });
  assert.equal(v.telemetry?.latitude, null);
  assert.equal(v.telemetry?.longitude, null);
  assert.equal(v.telemetry?.speed, null);
  assert.equal(v.telemetry?.odometer_miles, null);
});

function vehicle(id: string, status: FleetVehicle["status"], lat: number | null, lng: number | null, hasDevice = true): FleetVehicle {
  return {
    id, name: id, year: 2020, make: "X", model: "Y", nickname: null, hasDevice, deviceName: null,
    telemetry: lat === null ? null : t({ latitude: lat, longitude: lng }), status,
  };
}

test("pins: only vehicles with a device and real coordinates get a pin", () => {
  const pins = fleetPins([
    vehicle("a", "parked", 42.07, -87.79),
    vehicle("b", "no_device", 42.0, -87.7, false),
    vehicle("c", "offline", null, null),
    vehicle("d", "parked", 0, 0),
    vehicle("e", "moving", 41.88, -87.63),
  ]);
  assert.deepEqual(pins.map((p) => p.id), ["a", "e"]);
  assert.equal(pins[0].status, "parked");
});

test("map view: no pins is empty; one pin centers at a sensible zoom", () => {
  assert.deepEqual(computeMapView([]), { kind: "empty" });
  assert.deepEqual(computeMapView([{ lat: 42.07, lng: -87.79 }]), { kind: "center", center: [-87.79, 42.07], zoom: SINGLE_PIN_ZOOM });
});

test("map view: pins at the same spot center instead of zooming to the max", () => {
  const view = computeMapView([{ lat: 42.0700, lng: -87.7900 }, { lat: 42.0702, lng: -87.7901 }]);
  assert.equal(view.kind, "center");
  if (view.kind === "center") {
    assert.ok(Math.abs(view.center[0] + 87.79005) < 1e-9);
    assert.ok(Math.abs(view.center[1] - 42.0701) < 1e-9);
  }
});

test("map view: spread pins fit bounds as [[minLng,minLat],[maxLng,maxLat]]", () => {
  assert.deepEqual(computeMapView([
    { lat: 42.07, lng: -87.79 },
    { lat: 41.88, lng: -87.63 },
    { lat: 41.95, lng: -87.70 },
  ]), { kind: "bounds", bounds: [[-87.79, 41.88], [-87.63, 42.07]] });
});

test("uuid guard for route and page params", () => {
  assert.equal(isUuid("13d468f3-c79a-42c9-a8b5-45f53018d635"), true);
  for (const bad of ["", "abc", "13d468f3-c79a-42c9-a8b5-45f53018d63", "13d468f3c79a42c9a8b545f53018d635", null, undefined]) {
    assert.equal(isUuid(bad), false, String(bad));
  }
});

test("live panel formatting: device speed is mph (verified from fixes); ignition on/off; missing is —", () => {
  assert.equal(formatTelemetrySpeed(25, "miles"), "25 mph");
  assert.equal(formatTelemetrySpeed(25, "km"), "40 km/h");
  assert.equal(formatTelemetrySpeed(0, "miles"), "0 mph");
  assert.equal(formatTelemetrySpeed(null, "miles"), "—");
  assert.equal(formatIgnition("1"), "On");
  assert.equal(formatIgnition("0"), "Off");
  assert.equal(formatIgnition(null), "—");
});

test("nav: the live location page highlights Dashboard, other garage pages stay on My Garage", () => {
  assert.equal(activeNavHref("/garage/13d468f3-c79a-42c9-a8b5-45f53018d635/live"), "/dashboard");
  assert.equal(activeNavHref("/garage/13d468f3-c79a-42c9-a8b5-45f53018d635/live/"), "/dashboard");
  assert.equal(activeNavHref("/garage/13d468f3-c79a-42c9-a8b5-45f53018d635"), "/garage");
  assert.equal(activeNavHref("/garage/13d468f3-c79a-42c9-a8b5-45f53018d635/logbook"), "/garage");
  assert.equal(activeNavHref("/garage"), "/garage");
  assert.equal(activeNavHref("/garage/add"), "/garage");
  assert.equal(activeNavHref("/dashboard"), "/dashboard");
  assert.equal(activeNavHref("/telematics"), "/telematics");
  assert.equal(activeNavHref("/settings"), null);
  assert.equal(activeNavHref("/garage-sale"), null, "prefix match needs a path boundary");
});

test("nav: the header title follows the highlighted item", () => {
  assert.equal(pageTitle("/garage/13d468f3-c79a-42c9-a8b5-45f53018d635/live"), "Dashboard");
  assert.equal(pageTitle("/garage/13d468f3-c79a-42c9-a8b5-45f53018d635"), "My Garage");
  assert.equal(pageTitle("/telematics"), "Telematics");
  assert.equal(pageTitle("/settings"), "Settings");
  assert.equal(pageTitle("/other"), "Wheelman");
});
