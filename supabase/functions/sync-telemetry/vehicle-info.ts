// Shared by the sync-telemetry edge function (Deno) and the Next.js app: no imports, no runtime-specific APIs.
// Decides how a linked device's VIN and odometer flow into the vehicle record (WHE-26), and how the VIN is
// shown next to the OBD data (WHE-39).

// 17 characters; I, O and Q are never used in VINs.
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeVin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const vin = value.trim().toUpperCase();
  return VIN_PATTERN.test(vin) ? vin : null;
}

export function isValidVin(value: unknown): boolean {
  return normalizeVin(value) !== null;
}

// The sync stores the whole GetDevices record in vehicle_telemetry.raw; the device-reported VIN is raw.VIN.
export function deviceVinFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  return normalizeVin((raw as Record<string, unknown>).VIN);
}

export type VinDisplay = { vin: string | null; source: "device" | "record" | null; mismatch: boolean };

// Prefer the device-reported VIN; fall back to the vehicle record. A mismatch is flagged whenever the record has
// a VIN (valid or not) that differs from the device's.
export function vinDisplay(deviceVin: unknown, recordVin: unknown): VinDisplay {
  const device = normalizeVin(deviceVin);
  const record = typeof recordVin === "string" && recordVin.trim() ? recordVin.trim().toUpperCase() : null;
  if (device) return { vin: device, source: "device", mismatch: record !== null && record !== device };
  if (record) return { vin: record, source: "record", mismatch: false };
  return { vin: null, source: null, mismatch: false };
}

// Whole miles. Returns the new vehicles.odometer_miles, or null for "no change".
// - A missing / invalid reading never changes anything.
// - While the record is device-sourced it only moves forward.
// - A manual (or empty) record is replaced by the first device reading: once a device is linked it is the source
//   of truth, even if the hand-entered value was higher.
export function nextOdometer(
  current: { miles: number | string | null; source: string | null },
  reading: number | null | undefined,
): number | null {
  if (reading === null || reading === undefined || !Number.isFinite(reading) || reading < 0) return null;
  const next = Math.floor(reading);
  const miles = current.miles === null || current.miles === "" ? null : Number(current.miles);
  if (current.source !== "device" || miles === null || !Number.isFinite(miles)) return next === miles ? null : next;
  return next > miles ? next : null;
}

export type VinDecode = { year: number; make: string; model: string; trim: string | null };

const MAKE_CASING: Record<string, string> = {
  BMW: "BMW",
  GMC: "GMC",
  RAM: "RAM",
  MINI: "MINI",
  MCLAREN: "McLaren",
  SRT: "SRT",
  AMC: "AMC",
};

// vPIC returns makes in upper case ("AUDI", "MERCEDES-BENZ", "LAND ROVER").
export function normalizeMake(make: string): string {
  const upper = make.trim().toUpperCase();
  if (MAKE_CASING[upper]) return MAKE_CASING[upper];
  return upper
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function field(row: Record<string, unknown>, key: string): string | null {
  const v = row[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// Maps a vPIC DecodeVinValues response (`{ Results: [{ ModelYear, Make, Model, Trim, ... }] }`) to the fields we
// store. Returns null unless year, make and model are all usable.
export function mapVpicResponse(json: unknown, now: Date = new Date()): VinDecode | null {
  const results = (json as { Results?: unknown } | null)?.Results;
  const row = Array.isArray(results) ? results[0] : null;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const year = Number(field(r, "ModelYear"));
  const make = field(r, "Make");
  const model = field(r, "Model");
  if (!Number.isInteger(year) || year < 1900 || year > now.getFullYear() + 2 || !make || !model) return null;
  return { year, make: normalizeMake(make), model, trim: field(r, "Trim") };
}

export function vpicUrl(vin: string): string {
  return `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
}

// ok:false = the request itself failed (network / HTTP), so it is worth retrying later.
// ok:true with decode:null = vPIC answered but had nothing usable for this VIN; retrying won't help.
export type DecodeResult = { ok: true; decode: VinDecode | null } | { ok: false; error: string };

export async function decodeVin(
  vin: string,
  fetchFn: (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }> = fetch,
): Promise<DecodeResult> {
  try {
    const res = await fetchFn(vpicUrl(vin), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, error: `vPIC HTTP ${res.status}` };
    return { ok: true, decode: mapVpicResponse(await res.json()) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "vPIC request failed" };
  }
}

export type VehicleRecord = {
  vin: string | null;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  odometer_miles: number | string | null;
  odometer_source: string | null;
};

export type VehicleUpdate = Partial<{
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  odometer_miles: number;
  odometer_source: "device";
}>;

// What the device would change on the vehicle, before any VIN decode. `decodeVin` is set when the device VIN is
// about to be written to the record (the record's VIN is blank or not a valid VIN) — that is the one moment a
// VIN is decoded, so the record's own VIN doubles as "last decoded VIN" and no VIN is decoded twice. A record
// with a different *valid* VIN is kept as is; the UI shows the mismatch instead.
export function planDeviceUpdate(
  vehicle: VehicleRecord,
  device: { vin: unknown; odometerMiles: number | null | undefined },
): { update: VehicleUpdate; decodeVin: string | null } {
  const update: VehicleUpdate = {};
  let decode: string | null = null;
  const deviceVin = normalizeVin(device.vin);
  if (deviceVin && !isValidVin(vehicle.vin)) {
    update.vin = deviceVin;
    decode = deviceVin;
  }
  const odometer = nextOdometer({ miles: vehicle.odometer_miles, source: vehicle.odometer_source }, device.odometerMiles);
  if (odometer !== null) {
    update.odometer_miles = odometer;
    update.odometer_source = "device";
  } else if (vehicle.odometer_source !== "device" && device.odometerMiles != null && Number.isFinite(device.odometerMiles)) {
    // Same value as the manual entry: just record that the device now owns it.
    update.odometer_source = "device";
  }
  return { update, decodeVin: decode };
}

// Year/make/model always come from the decode. Trim:
// - same car (make and model match) with a trim already entered: keep it. A hand-entered trim is usually more
//   specific than vPIC's ("75th Anniversary" vs vPIC's "Laredo" on the real Jeep).
// - same car without a trim: take vPIC's, if any.
// - a different car: the old trim belonged to the old car, so use vPIC's or clear it.
export function decodedFields(vehicle: Pick<VehicleRecord, "make" | "model" | "trim">, decode: VinDecode): VehicleUpdate {
  const fields: VehicleUpdate = { year: decode.year, make: decode.make, model: decode.model };
  const sameCar =
    vehicle.make.trim().toLowerCase() === decode.make.toLowerCase() &&
    vehicle.model.trim().toLowerCase() === decode.model.toLowerCase();
  const currentTrim = vehicle.trim?.trim() || null;
  if (sameCar) {
    if (!currentTrim && decode.trim) fields.trim = decode.trim;
  } else if (decode.trim !== currentTrim) {
    fields.trim = decode.trim;
  }
  return fields;
}

// Applies the plan plus (if needed) a VIN decode. When the decode request fails, the VIN is left out of the update
// too, so the next sync retries; when vPIC simply has no data for the VIN, the VIN is still stored.
export async function resolveDeviceUpdate(
  vehicle: VehicleRecord,
  device: { vin: unknown; odometerMiles: number | null | undefined },
  decodeFn: (vin: string) => Promise<DecodeResult> = decodeVin,
  log: (message: string) => void = () => {},
): Promise<VehicleUpdate> {
  const { update, decodeVin: vin } = planDeviceUpdate(vehicle, device);
  if (!vin) return update;
  const result = await decodeFn(vin);
  if (!result.ok) {
    log(`VIN decode failed (${result.error}); will retry`);
    const rest = { ...update };
    delete rest.vin;
    return rest;
  }
  if (!result.decode) {
    log("VIN decode returned no usable year/make/model; keeping the vehicle's details");
    return update;
  }
  return { ...update, ...decodedFields(vehicle, result.decode) };
}
