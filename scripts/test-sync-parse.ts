// Run: npx tsx --test scripts/test-sync-parse.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseExtraData,
  parseFuelEconomyMpg,
  parseLastContact,
  parseOdometerMiles,
  parsePercent,
  parseVolts,
  toIgnitionText,
  toIsOnline,
  toTelemetryRow,
} from "../supabase/functions/sync-telemetry/parse";

test("LastContact in CDT (UTC-5) converts to UTC", () => {
  assert.equal(parseLastContact("10/16/2026 05:40:00 PM"), "2026-10-16T22:40:00.000Z");
  assert.equal(parseLastContact("07/04/2026 12:00:00 PM"), "2026-07-04T17:00:00.000Z");
});

test("LastContact in CST (UTC-6) converts to UTC", () => {
  assert.equal(parseLastContact("01/15/2026 05:40:00 PM"), "2026-01-15T23:40:00.000Z");
  assert.equal(parseLastContact("12/25/2026 12:00:00 AM"), "2026-12-25T06:00:00.000Z");
});

test("LastContact rolls over the UTC date for late-evening Central times", () => {
  assert.equal(parseLastContact("10/16/2026 11:30:00 PM"), "2026-10-17T04:30:00.000Z");
  assert.equal(parseLastContact("12/31/2026 08:00:00 PM"), "2027-01-01T02:00:00.000Z");
});

test("LastContact handles the 2026 DST transitions", () => {
  // Spring forward: Sun 2026-03-08, 2:00 AM CST -> 3:00 AM CDT
  assert.equal(parseLastContact("03/08/2026 01:30:00 AM"), "2026-03-08T07:30:00.000Z");
  assert.equal(parseLastContact("03/08/2026 03:30:00 AM"), "2026-03-08T08:30:00.000Z");
  // Fall back: Sun 2026-11-01, 2:00 AM CDT -> 1:00 AM CST
  assert.equal(parseLastContact("11/01/2026 12:30:00 AM"), "2026-11-01T05:30:00.000Z");
  assert.equal(parseLastContact("11/01/2026 03:00:00 AM"), "2026-11-01T09:00:00.000Z");
});

test("LastContact accepts single-digit parts and lowercase meridiem", () => {
  assert.equal(parseLastContact("1/5/2026 9:07:01 am"), "2026-01-05T15:07:01.000Z");
});

test("LastContact rejects invalid or unexpected values", () => {
  for (const bad of [
    "13/40/2026 01:00:00 AM",
    "2/31/2026 01:00:00 AM",
    "10/16/2026 13:00:00 PM",
    "10/16/2026 00:30:00 AM",
    "10/16/2026 01:61:00 AM",
    "2026-10-16T14:05:09Z",
    "",
  ]) {
    assert.equal(parseLastContact(bad), null, bad);
  }
  assert.equal(parseLastContact(null), null);
  assert.equal(parseLastContact(undefined), null);
  assert.equal(parseLastContact(12345), null);
});

test("IsOnline accepts 1 / true / 'true' only", () => {
  for (const v of [1, true, "true"]) assert.equal(toIsOnline(v), true, String(v));
  for (const v of [0, false, "false", undefined, null]) assert.equal(toIsOnline(v), false, String(v));
});

test("Ignition is stored as text", () => {
  assert.equal(toIgnitionText(0), "0");
  assert.equal(toIgnitionText(1), "1");
  assert.equal(toIgnitionText(null), null);
  assert.equal(toIgnitionText(undefined), null);
});

test("toTelemetryRow maps a device payload", () => {
  const row = toTelemetryRow(
    { vehicle_id: "v", user_id: "u", object_id: "o" },
    { IsOnline: 1, Ignition: 0, LastContact: "10/16/2026 05:40:00 PM", Speed: 0, Latitude: 1.5 },
  );
  assert.equal(row.is_online, true);
  assert.equal(row.ignition, "0");
  assert.equal(row.speed, 0);
  assert.equal(row.latitude, 1.5);
  assert.equal(row.last_contact, "2026-10-16T22:40:00.000Z");
});

const NULLS = {
  odometer_miles: null,
  fuel_level_pct: null,
  input_voltage: null,
  fuel_economy_mpg: null,
  device_battery_pct: null,
};

test("ExtraData: full OBD payload (real device response)", () => {
  assert.deepEqual(
    parseExtraData({
      Odometer: "4062.5 mi",
      InputVoltage: "12.3 V",
      FuelLevel: "56.0 %",
      FuelEconomy: "15.04 MPG",
      DeviceBattery: "100 %",
    }),
    {
      odometer_miles: 4062.5,
      fuel_level_pct: 56,
      input_voltage: 12.3,
      fuel_economy_mpg: 15.04,
      device_battery_pct: 100,
    },
  );
});

test("ExtraData: XT1P payload (BatteryVoltage is a percentage) leaves OBD fields null", () => {
  assert.deepEqual(parseExtraData({ InputVoltage: "12.0 V", BatteryVoltage: "100.0 %" }), {
    ...NULLS,
    input_voltage: 12,
    device_battery_pct: 100,
  });
});

test("ExtraData: a real battery voltage is not mistaken for a percentage", () => {
  assert.equal(parseExtraData({ BatteryVoltage: "3.8 V" }).device_battery_pct, null);
  assert.equal(parseExtraData({ BatteryVoltage: "3.8" }).device_battery_pct, null);
});

test("ExtraData: missing / empty / malformed input yields all nulls, never 0", () => {
  assert.deepEqual(parseExtraData(undefined), NULLS);
  assert.deepEqual(parseExtraData(null), NULLS);
  assert.deepEqual(parseExtraData({}), NULLS);
  assert.deepEqual(parseExtraData("nonsense"), NULLS);
  assert.deepEqual(
    parseExtraData({ Odometer: "", InputVoltage: "N/A", FuelLevel: null, FuelEconomy: {}, DeviceBattery: "--" }),
    NULLS,
  );
});

test("Odometer converts km to miles and keeps miles as-is", () => {
  assert.equal(parseOdometerMiles("2346.3 mi"), 2346.3);
  assert.equal(parseOdometerMiles("1,234.5 miles"), 1234.5);
  assert.equal(parseOdometerMiles("100 km"), 62.1);
  assert.equal(parseOdometerMiles("5000 KM"), 3106.9);
  assert.equal(parseOdometerMiles("0 mi"), 0);
});

test("Odometer with a missing or unknown unit is null rather than a guess", () => {
  assert.equal(parseOdometerMiles("2346.3"), null);
  assert.equal(parseOdometerMiles("2346.3 m"), null);
  assert.equal(parseOdometerMiles(2346.3), null);
});

test("Percent and voltage parsing", () => {
  assert.equal(parsePercent("58.0 %"), 58);
  assert.equal(parsePercent("58"), 58);
  assert.equal(parsePercent("58", true), null);
  assert.equal(parsePercent("120 %"), null);
  assert.equal(parsePercent("-5 %"), null);
  assert.equal(parseVolts("13.1 V"), 13.1);
  assert.equal(parseVolts("13.1"), 13.1);
  assert.equal(parseVolts("13.1 A"), null);
});

test("Fuel economy normalises to MPG", () => {
  assert.equal(parseFuelEconomyMpg("19.5 MPG"), 19.5);
  assert.equal(parseFuelEconomyMpg("8.0 L/100km"), 29.4);
  assert.equal(parseFuelEconomyMpg("10 km/L"), 23.52);
  assert.equal(parseFuelEconomyMpg("0 L/100km"), null);
  assert.equal(parseFuelEconomyMpg("19.5"), null);
});

test("toTelemetryRow includes OBD columns and keeps ExtraData in raw", () => {
  const extra = { Odometer: "100 km", FuelLevel: "40 %" };
  const row = toTelemetryRow({ vehicle_id: "v", user_id: "u", object_id: "o" }, { Speed: 0 }, extra);
  assert.equal(row.odometer_miles, 62.1);
  assert.equal(row.fuel_level_pct, 40);
  assert.equal(row.input_voltage, null);
  assert.deepEqual((row.raw as { ExtraData: unknown }).ExtraData, extra);
});

test("toTelemetryRow without ExtraData (GetDevice failed) leaves OBD columns null", () => {
  const row = toTelemetryRow({ vehicle_id: "v", user_id: "u", object_id: "o" }, { Speed: 0 });
  assert.equal(row.odometer_miles, null);
  assert.equal(row.fuel_economy_mpg, null);
  assert.equal(row.device_battery_pct, null);
  assert.deepEqual(row.raw, { Speed: 0 });
});
