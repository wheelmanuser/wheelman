// deno-lint-ignore-file no-explicit-any

// TODO: confirm with xVision which timezone LastContact is reported in; assuming UTC for now.
export function parseLastContact(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) ?(AM|PM)$/i);
  if (!m) return null;
  const [, month, day, year, hh, mm, ss, meridiem] = m;
  let hour = Number(hh) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hour, Number(mm), Number(ss)));
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== Number(month) - 1) return null;
  return d.toISOString();
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
