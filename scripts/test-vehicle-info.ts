// node:test — device VIN / odometer / VIN-decode rules (WHE-26, WHE-39).
// Run: npx tsx --test scripts/test-vehicle-info.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  decodedFields,
  decodeVin,
  deviceVinFromRaw,
  isValidVin,
  mapVpicResponse,
  nextOdometer,
  normalizeMake,
  normalizeVin,
  planDeviceUpdate,
  resolveDeviceUpdate,
  vinDisplay,
  type DecodeResult,
  type VehicleRecord,
} from "../supabase/functions/sync-telemetry/vehicle-info";

// Synthetic VINs (valid shape only; not real vehicles).
const VIN_A = "WUA1ABCD2PN900001";
const VIN_B = "1C4RJFBG0GC000002";

test("VIN validation: 17 chars, letters/digits, never I, O or Q; trimmed and upper-cased", () => {
  assert.equal(normalizeVin(VIN_A), VIN_A);
  assert.equal(normalizeVin(`  ${VIN_A.toLowerCase()} `), VIN_A);
  assert.equal(normalizeVin("WUA1ABCD2PN90000"), null, "16 chars");
  assert.equal(normalizeVin("WUA1ABCD2PN9000011"), null, "18 chars");
  assert.equal(normalizeVin("WUA1ABCD2PN90000I"), null, "contains I");
  assert.equal(normalizeVin("WUA1ABCD2PN90000O"), null, "contains O");
  assert.equal(normalizeVin("WUA1ABCD2PN90000Q"), null, "contains Q");
  assert.equal(normalizeVin("WUA1ABCD-PN900001"), null, "punctuation");
  assert.equal(normalizeVin(""), null);
  assert.equal(normalizeVin(null), null);
  assert.equal(normalizeVin(12345), null);
  assert.equal(isValidVin("ABC123456789"), false, "a 12-character placeholder is not a VIN");
});

test("device VIN comes from the stored GetDevices record (raw.VIN)", () => {
  assert.equal(deviceVinFromRaw({ VIN: VIN_A, ExtraData: {} }), VIN_A);
  assert.equal(deviceVinFromRaw({ VIN: "" }), null);
  assert.equal(deviceVinFromRaw({ VIN: null }), null);
  assert.equal(deviceVinFromRaw({}), null);
  assert.equal(deviceVinFromRaw(null), null);
  assert.equal(deviceVinFromRaw("not an object"), null);
});

test("VIN display: device first, record fallback, mismatch only when both exist and differ", () => {
  assert.deepEqual(vinDisplay(VIN_A, VIN_A), { vin: VIN_A, source: "device", mismatch: false });
  assert.deepEqual(vinDisplay(VIN_A, VIN_A.toLowerCase()), { vin: VIN_A, source: "device", mismatch: false });
  assert.deepEqual(vinDisplay(VIN_A, VIN_B), { vin: VIN_A, source: "device", mismatch: true });
  assert.deepEqual(vinDisplay(VIN_A, "ABC123456789"), { vin: VIN_A, source: "device", mismatch: true });
  assert.deepEqual(vinDisplay(VIN_A, null), { vin: VIN_A, source: "device", mismatch: false });
  assert.deepEqual(vinDisplay(VIN_A, "  "), { vin: VIN_A, source: "device", mismatch: false });
  assert.deepEqual(vinDisplay(null, VIN_B), { vin: VIN_B, source: "record", mismatch: false });
  assert.deepEqual(vinDisplay("garbage", VIN_B), { vin: VIN_B, source: "record", mismatch: false });
  assert.deepEqual(vinDisplay(null, null), { vin: null, source: null, mismatch: false });
});

test("odometer: device-sourced values only move forward, in whole miles", () => {
  const device = (miles: number | string | null) => ({ miles, source: "device" });
  assert.equal(nextOdometer(device(4186), 4190.7), 4190);
  assert.equal(nextOdometer(device(4186), 4186.9), null, "same whole mile");
  assert.equal(nextOdometer(device(4186), 4100), null, "never backwards");
  assert.equal(nextOdometer(device("4186.0"), 4200), 4200, "numeric strings from Postgres");
  assert.equal(nextOdometer(device(null), 4186.1), 4186);
});

test("odometer: the first device reading replaces a manual or empty value, even a higher one", () => {
  assert.equal(nextOdometer({ miles: 132000, source: "manual" }, 4186.1), 4186);
  assert.equal(nextOdometer({ miles: 166089, source: "manual" }, 167376.2), 167376);
  assert.equal(nextOdometer({ miles: null, source: null }, 20), 20);
  assert.equal(nextOdometer({ miles: 20, source: null }, 20.4), null, "already equal");
});

test("odometer: missing or invalid readings change nothing", () => {
  for (const reading of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -5]) {
    assert.equal(nextOdometer({ miles: 4186, source: "device" }, reading), null);
    assert.equal(nextOdometer({ miles: 132000, source: "manual" }, reading), null);
  }
});

test("make casing: vPIC upper case becomes brand casing", () => {
  assert.equal(normalizeMake("AUDI"), "Audi");
  assert.equal(normalizeMake("BMW"), "BMW");
  assert.equal(normalizeMake("MERCEDES-BENZ"), "Mercedes-Benz");
  assert.equal(normalizeMake("LAND ROVER"), "Land Rover");
  assert.equal(normalizeMake("MCLAREN"), "McLaren");
  assert.equal(normalizeMake("jeep"), "Jeep");
});

const vpic = (row: Record<string, string>) => ({ Count: 1, Message: "Results returned successfully", Results: [row] });
const NOW = new Date("2026-11-10T12:00:00Z");

test("vPIC mapping: year/make/model required, trim optional", () => {
  assert.deepEqual(
    mapVpicResponse(vpic({ ModelYear: "2023", Make: "AUDI", Model: "RS 6 Avant", Trim: "", ErrorCode: "0" }), NOW),
    { year: 2023, make: "Audi", model: "RS 6 Avant", trim: null },
  );
  assert.deepEqual(
    mapVpicResponse(vpic({ ModelYear: "2016", Make: "JEEP", Model: "Grand Cherokee", Trim: " Limited " }), NOW),
    { year: 2016, make: "Jeep", model: "Grand Cherokee", trim: "Limited" },
  );
});

test("vPIC mapping: empty, partial and error responses give null", () => {
  assert.equal(mapVpicResponse(vpic({ ModelYear: "", Make: "", Model: "", ErrorCode: "11" }), NOW), null);
  assert.equal(mapVpicResponse(vpic({ ModelYear: "2023", Make: "AUDI", Model: "" }), NOW), null);
  assert.equal(mapVpicResponse(vpic({ ModelYear: "2023", Make: "", Model: "RS 6" }), NOW), null);
  assert.equal(mapVpicResponse(vpic({ ModelYear: "abc", Make: "AUDI", Model: "RS 6" }), NOW), null);
  assert.equal(mapVpicResponse(vpic({ ModelYear: "1850", Make: "AUDI", Model: "RS 6" }), NOW), null);
  assert.equal(mapVpicResponse(vpic({ ModelYear: "2031", Make: "AUDI", Model: "RS 6" }), NOW), null, "too far ahead");
  assert.equal(mapVpicResponse({ Results: [] }, NOW), null);
  assert.equal(mapVpicResponse({ Message: "error" }, NOW), null);
  assert.equal(mapVpicResponse(null, NOW), null);
});

test("decodeVin: HTTP and network failures are retryable; an empty answer is not", async () => {
  const ok = (body: unknown) => async () => ({ ok: true, status: 200, json: async () => body });
  const httpError = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const network = async () => {
    throw new Error("network down");
  };
  assert.deepEqual(await decodeVin(VIN_A, ok(vpic({ ModelYear: "2023", Make: "AUDI", Model: "RS 6 Avant" }))), {
    ok: true,
    decode: { year: 2023, make: "Audi", model: "RS 6 Avant", trim: null },
  });
  assert.deepEqual(await decodeVin(VIN_A, ok(vpic({ ModelYear: "", Make: "", Model: "" }))), { ok: true, decode: null });
  assert.deepEqual(await decodeVin(VIN_A, httpError), { ok: false, error: "vPIC HTTP 503" });
  assert.deepEqual(await decodeVin(VIN_A, network), { ok: false, error: "network down" });
});

const record = (over: Partial<VehicleRecord> = {}): VehicleRecord => ({
  vin: null,
  year: 2003,
  make: "BMW",
  model: "325i",
  trim: "Touring",
  odometer_miles: 132000,
  odometer_source: "manual",
  ...over,
});

test("plan: a blank or invalid record VIN is filled from the device and decoded once", () => {
  assert.deepEqual(planDeviceUpdate(record({ vin: null }), { vin: VIN_A, odometerMiles: null }), {
    update: { vin: VIN_A },
    decodeVin: VIN_A,
  });
  assert.deepEqual(planDeviceUpdate(record({ vin: "ABC123456789" }), { vin: VIN_A, odometerMiles: null }), {
    update: { vin: VIN_A },
    decodeVin: VIN_A,
  });
});

test("plan: a valid record VIN is kept (mismatch shown in the UI), and a matching one decodes nothing", () => {
  assert.deepEqual(planDeviceUpdate(record({ vin: VIN_B }), { vin: VIN_A, odometerMiles: null }), {
    update: {},
    decodeVin: null,
  });
  assert.deepEqual(planDeviceUpdate(record({ vin: VIN_A }), { vin: VIN_A, odometerMiles: null }), {
    update: {},
    decodeVin: null,
  });
  assert.deepEqual(planDeviceUpdate(record({ vin: null }), { vin: "", odometerMiles: null }), {
    update: {},
    decodeVin: null,
  });
});

test("plan: odometer switches the record to device-sourced", () => {
  assert.deepEqual(planDeviceUpdate(record({ vin: VIN_A }), { vin: VIN_A, odometerMiles: 4186.1 }).update, {
    odometer_miles: 4186,
    odometer_source: "device",
  });
  assert.deepEqual(
    planDeviceUpdate(record({ vin: VIN_A, odometer_miles: 4186, odometer_source: "manual" }), { vin: VIN_A, odometerMiles: 4186.4 })
      .update,
    { odometer_source: "device" },
    "same value: only the source changes",
  );
  assert.deepEqual(
    planDeviceUpdate(record({ vin: VIN_A, odometer_miles: 4186, odometer_source: "device" }), { vin: VIN_A, odometerMiles: 4186.4 })
      .update,
    {},
    "nothing to write",
  );
});

test("decoded fields: a different car takes vPIC's trim, or clears the old car's trim", () => {
  const audi = { year: 2023, make: "Audi", model: "RS 6 Avant", trim: null };
  assert.deepEqual(decodedFields(record(), audi), { year: 2023, make: "Audi", model: "RS 6 Avant", trim: null });
  assert.deepEqual(decodedFields(record(), { ...audi, trim: "quattro" }), {
    year: 2023,
    make: "Audi",
    model: "RS 6 Avant",
    trim: "quattro",
  });
  assert.deepEqual(decodedFields(record({ trim: null }), audi), { year: 2023, make: "Audi", model: "RS 6 Avant" });
});

test("decoded fields: the same car keeps a hand-entered trim, and only fills a blank one", () => {
  const jeep = record({ year: 2016, make: "Jeep", model: "Grand Cherokee", trim: "75th Anniversary" });
  const decoded = { year: 2016, make: "Jeep", model: "Grand Cherokee", trim: "Laredo" };
  assert.deepEqual(decodedFields(jeep, decoded), { year: 2016, make: "Jeep", model: "Grand Cherokee" });
  assert.deepEqual(decodedFields({ ...jeep, trim: " " }, decoded), {
    year: 2016,
    make: "Jeep",
    model: "Grand Cherokee",
    trim: "Laredo",
  });
  assert.deepEqual(decodedFields({ ...jeep, make: "JEEP", model: "grand cherokee" }, decoded), {
    year: 2016,
    make: "Jeep",
    model: "Grand Cherokee",
  });
});

test("resolve: the real 'Audi' case becomes a 2023 Audi RS 6 Avant with the device's VIN and odometer", async () => {
  const decode = async (): Promise<DecodeResult> => ({
    ok: true,
    decode: { year: 2023, make: "Audi", model: "RS 6 Avant", trim: null },
  });
  assert.deepEqual(await resolveDeviceUpdate(record({ vin: "ABC123456789" }), { vin: VIN_A, odometerMiles: 4186.1 }, decode), {
    vin: VIN_A,
    odometer_miles: 4186,
    odometer_source: "device",
    year: 2023,
    make: "Audi",
    model: "RS 6 Avant",
    trim: null,
  });
});

test("resolve: a failed decode leaves the VIN out so the next sync retries; an empty decode stores the VIN only", async () => {
  const logs: string[] = [];
  const failed = async (): Promise<DecodeResult> => ({ ok: false, error: "vPIC HTTP 503" });
  const empty = async (): Promise<DecodeResult> => ({ ok: true, decode: null });
  assert.deepEqual(
    await resolveDeviceUpdate(record(), { vin: VIN_A, odometerMiles: 4186.1 }, failed, (m) => logs.push(m)),
    { odometer_miles: 4186, odometer_source: "device" },
  );
  assert.deepEqual(await resolveDeviceUpdate(record(), { vin: VIN_A, odometerMiles: null }, empty, (m) => logs.push(m)), {
    vin: VIN_A,
  });
  assert.equal(logs.length, 2);
  assert.ok(logs.every((m) => !m.includes(VIN_A)), "logs never contain the VIN");
});

test("resolve: no decode call when the VIN isn't being written", async () => {
  let calls = 0;
  const decode = async (): Promise<DecodeResult> => {
    calls++;
    return { ok: true, decode: null };
  };
  await resolveDeviceUpdate(record({ vin: VIN_B }), { vin: VIN_A, odometerMiles: 10 }, decode);
  await resolveDeviceUpdate(record({ vin: VIN_A }), { vin: VIN_A, odometerMiles: 10 }, decode);
  await resolveDeviceUpdate(record({ vin: null }), { vin: null, odometerMiles: 10 }, decode);
  assert.equal(calls, 0);
});
