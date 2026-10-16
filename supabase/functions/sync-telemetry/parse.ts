// deno-lint-ignore-file no-explicit-any

const CHICAGO_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

// Chicago's offset from UTC (local - UTC, in ms) at the given instant; -5h in CDT, -6h in CST.
function chicagoOffsetMs(utcMs: number): number {
  const instant = utcMs - (utcMs % 1000);
  const p: Record<string, string> = {};
  for (const part of CHICAGO_PARTS.formatToParts(new Date(instant))) p[part.type] = part.value;
  const localAsUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return localAsUtc - instant;
}

// Two passes so the offset is taken at the real instant, not the wall-clock guess (matters near DST changes).
// An ambiguous fall-back hour resolves to one of its two instants; a nonexistent spring-forward time shifts forward.
function chicagoWallClockToUtcMs(wallAsUtcMs: number): number {
  const firstGuess = wallAsUtcMs - chicagoOffsetMs(wallAsUtcMs);
  return wallAsUtcMs - chicagoOffsetMs(firstGuess);
}

// xVision sends LastContact ("MM/DD/YYYY hh:mm:ss AM") in US Central time (America/Chicago), not UTC.
// Inferred from live data (a reading recorded at 22:40 UTC reported 5:40 PM); not yet confirmed by xVision.
export function parseLastContact(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) ?(AM|PM)$/i);
  if (!m) return null;
  const [, month, day, year, hh, mm, ss, meridiem] = m;
  if (Number(hh) < 1 || Number(hh) > 12 || Number(mm) > 59 || Number(ss) > 59) return null;
  let hour = Number(hh) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;
  const wall = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hour, Number(mm), Number(ss)));
  if (
    Number.isNaN(wall.getTime()) ||
    wall.getUTCMonth() !== Number(month) - 1 ||
    wall.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return new Date(chicagoWallClockToUtcMs(wall.getTime())).toISOString();
}

// Event timestamps: ISO strings keep their own offset (no offset means UTC, unconfirmed); anything else is
// parsed like LastContact (US Central). Returns null if neither fits.
export function parseEventTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) {
    const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/i.test(v);
    const d = new Date(hasOffset ? v.replace(" ", "T") : `${v.replace(" ", "T")}Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return parseLastContact(v);
}

export function toIsOnline(value: unknown): boolean {
  return value === 1 || value === true || value === "true";
}

export function toIgnitionText(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

// ExtraData values are strings with units, e.g. "2346.3 mi", "13.1 V", "58.0 %", "19.5 MPG".
function parseWithUnit(raw: unknown): { value: number; unit: string } | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? { value: raw, unit: "" } : null;
  if (typeof raw !== "string") return null;
  const m = raw.trim().replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  return { value: Number(m[1]), unit: m[2].trim().toLowerCase() };
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

const MILES = ["mi", "mile", "miles"];
const KM = ["km", "kms", "kilometer", "kilometers", "kilometre", "kilometres"];

// Unknown or missing units return null rather than guessing, so a wrong number is never stored.
export function parseOdometerMiles(raw: unknown): number | null {
  const p = parseWithUnit(raw);
  if (!p) return null;
  if (MILES.includes(p.unit)) return p.value;
  if (KM.includes(p.unit)) return round(p.value * 0.621371, 1);
  return null;
}

export function parsePercent(raw: unknown, requireUnit = false): number | null {
  const p = parseWithUnit(raw);
  if (!p) return null;
  if (p.unit !== "%" && (requireUnit || p.unit !== "")) return null;
  return p.value >= 0 && p.value <= 100 ? p.value : null;
}

export function parseVolts(raw: unknown): number | null {
  const p = parseWithUnit(raw);
  if (!p) return null;
  return ["", "v", "volt", "volts"].includes(p.unit) ? p.value : null;
}

export function parseFuelEconomyMpg(raw: unknown): number | null {
  const p = parseWithUnit(raw);
  if (!p) return null;
  if (p.unit === "mpg") return p.value;
  if (p.unit === "km/l") return round(p.value * 2.35215, 2);
  if ((p.unit === "l/100km" || p.unit === "l/100 km") && p.value > 0) return round(235.215 / p.value, 2);
  return null;
}

export function parseExtraData(extra: unknown) {
  const e = (extra && typeof extra === "object" ? extra : {}) as Record<string, unknown>;
  return {
    odometer_miles: parseOdometerMiles(e.Odometer),
    fuel_level_pct: parsePercent(e.FuelLevel),
    input_voltage: parseVolts(e.InputVoltage),
    fuel_economy_mpg: parseFuelEconomyMpg(e.FuelEconomy),
    // Models without DeviceBattery (e.g. XT1P) report their internal battery as BatteryVoltage in "%".
    device_battery_pct: parsePercent(e.DeviceBattery) ?? parsePercent(e.BatteryVoltage, true),
  };
}

// A new reading is a duplicate of the previous row only if every one of these fields matches.
export const DEDUPE_FIELDS = [
  "last_contact",
  "latitude",
  "longitude",
  "speed",
  "is_online",
  "ignition",
  "vehicle_status",
  "odometer_miles",
  "fuel_level_pct",
  "input_voltage",
] as const;

function sameValue(field: string, a: unknown, b: unknown): boolean {
  const x = a ?? null;
  const y = b ?? null;
  if (x === null || y === null) return x === y;
  // The DB returns timestamptz as "...+00:00" while a new reading is "...Z", so compare instants.
  if (field === "last_contact") return Date.parse(String(x)) === Date.parse(String(y));
  if (typeof x === "number" || typeof y === "number") return Number(x) === Number(y);
  return x === y;
}

export function isDuplicateReading(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): boolean {
  if (!previous) return false;
  return DEDUPE_FIELDS.every((field) => sameValue(field, previous[field], next[field]));
}

export type LinkedDevice = { vehicle_id: string; user_id: string; object_id: string };

export function toTelemetryRow(linked: LinkedDevice, device: any, extraData?: unknown) {
  return {
    vehicle_id: linked.vehicle_id,
    user_id: linked.user_id,
    object_id: linked.object_id,
    speed: device.Speed ?? null,
    latitude: device.Latitude ?? null,
    longitude: device.Longitude ?? null,
    address: device.Address ?? null,
    altitude: device.Altitude ?? null,
    heading: device.Heading ?? null,
    is_online: toIsOnline(device.IsOnline),
    ignition: toIgnitionText(device.Ignition),
    vehicle_status: device.VehicleStatus ?? null,
    last_contact: parseLastContact(device.LastContact),
    ...parseExtraData(extraData),
    raw: extraData === undefined ? device : { ...device, ExtraData: extraData },
  };
}
