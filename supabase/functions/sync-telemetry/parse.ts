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

export function toIsOnline(value: unknown): boolean {
  return value === 1 || value === true || value === "true";
}

export function toIgnitionText(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export type LinkedDevice = { vehicle_id: string; user_id: string; object_id: string };

export function toTelemetryRow(linked: LinkedDevice, device: any) {
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
    raw: device,
  };
}
