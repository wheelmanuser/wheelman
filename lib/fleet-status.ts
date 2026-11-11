import { vehicleDisplayName } from "@/lib/vehicle-display";

export type FleetStatus = "moving" | "parked" | "offline" | "no_device";
export type FleetFilter = "all" | "moving" | "parked" | "offline";

export const FLEET_TELEMETRY_COLUMNS = [
  "latitude",
  "longitude",
  "address",
  "speed",
  "heading",
  "ignition",
  "is_online",
  "vehicle_status",
  "last_contact",
  "recorded_at",
  "odometer_miles",
  "fuel_level_pct",
  "input_voltage",
  "fuel_economy_mpg",
  "device_battery_pct",
] as const;

export type FleetTelemetry = {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  speed: number | null;
  heading: number | null;
  ignition: string | null;
  is_online: boolean | null;
  vehicle_status: string | null;
  last_contact: string | null;
  recorded_at: string | null;
  odometer_miles: number | null;
  fuel_level_pct: number | null;
  input_voltage: number | null;
  fuel_economy_mpg: number | null;
  device_battery_pct: number | null;
};

export type FleetVehicle = {
  id: string;
  name: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
  hasDevice: boolean;
  deviceName: string | null;
  // WHE-39: the vehicle record's VIN and the VIN its device reports (newest telemetry row's raw.VIN).
  recordVin: string | null;
  deviceVin: string | null;
  telemetry: FleetTelemetry | null;
  status: FleetStatus;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID.test(value);
}

export function isIgnitionOn(value: unknown): boolean {
  return value === true || value === 1 || (typeof value === "string" && /^(1|on|true)$/i.test(value.trim()));
}

export function isIgnitionOff(value: unknown): boolean {
  return value === false || value === 0 || (typeof value === "string" && /^(0|off|false)$/i.test(value.trim()));
}

// Mapping checked against real vehicle_telemetry rows: vehicle_status is "Moving", "Parked" or "Idle".
// - Offline wins: a device that reports is_online=false is offline whatever its last reading said.
// - Ignition on is Moving. That includes "Idle" and "Moving" readings at speed 0 (stopped at a light).
// - Speed > 0 is Moving, except "Parked" with ignition off: in real data those speeds are GPS drift
//   (0.6–11.2, avg 2.6) on a parked car.
// - Everything else is Parked. A linked device with no reading yet counts as Offline.
export function fleetStatus(hasDevice: boolean, t: FleetTelemetry | null): FleetStatus {
  if (!hasDevice) return "no_device";
  if (!t || t.is_online === false) return "offline";
  if (isIgnitionOn(t.ignition)) return "moving";
  const status = t.vehicle_status?.trim().toLowerCase() ?? null;
  if (status === "moving") return "moving";
  const parkedWithIgnitionOff = status === "parked" && isIgnitionOff(t.ignition);
  if ((t.speed ?? 0) > 0 && !parkedWithIgnitionOff) return "moving";
  return "parked";
}

export function fleetCounts(vehicles: Pick<FleetVehicle, "status">[]) {
  const counts = { total: vehicles.length, devices: 0, moving: 0, parked: 0, offline: 0 };
  for (const v of vehicles) {
    if (v.status === "no_device") continue;
    counts.devices++;
    counts[v.status]++;
  }
  return counts;
}

export function filterFleet<T extends Pick<FleetVehicle, "status">>(vehicles: T[], filter: FleetFilter): T[] {
  return filter === "all" ? vehicles : vehicles.filter((v) => v.status === filter);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatLastSeen(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "Never";
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "Never";
  const ago = now - at;
  if (ago < MINUTE) return "just now";
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)}m ago`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)}h ago`;
  return `${Math.floor(ago / DAY)}d ago`;
}

// Dashboard tiles show "Last seen" only for Offline cars; a parked car that simply hasn't reported in a
// while is still shown as Parked without it. (The live page always shows it.)
export function showLastSeen(v: Pick<FleetVehicle, "status">): boolean {
  return v.status === "offline";
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function first(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

// Normalizes one row of the embedded query. PostgREST returns vehicle_devices as an object (one-to-one,
// vehicle_id is unique) or an array depending on how it detects the relationship, so accept both.
export function toFleetVehicle(row: Record<string, unknown>): FleetVehicle {
  const device = first(row.vehicle_devices);
  const t = first(row.vehicle_telemetry);
  const telemetry: FleetTelemetry | null = t
    ? {
        latitude: num(t.latitude),
        longitude: num(t.longitude),
        address: str(t.address),
        speed: num(t.speed),
        heading: num(t.heading),
        ignition: str(t.ignition),
        is_online: typeof t.is_online === "boolean" ? t.is_online : null,
        vehicle_status: str(t.vehicle_status),
        last_contact: str(t.last_contact),
        recorded_at: str(t.recorded_at),
        odometer_miles: num(t.odometer_miles),
        fuel_level_pct: num(t.fuel_level_pct),
        input_voltage: num(t.input_voltage),
        fuel_economy_mpg: num(t.fuel_economy_mpg),
        device_battery_pct: num(t.device_battery_pct),
      }
    : null;
  const vehicle = {
    year: Number(row.year),
    make: String(row.make ?? ""),
    model: String(row.model ?? ""),
    nickname: str(row.nickname),
  };
  const hasDevice = device !== null;
  return {
    id: String(row.id),
    name: vehicleDisplayName(vehicle),
    ...vehicle,
    hasDevice,
    deviceName: device ? str(device.device_name) : null,
    recordVin: str(row.vin),
    deviceVin: t ? str(t.device_vin) : null,
    telemetry,
    status: fleetStatus(hasDevice, telemetry),
  };
}

export type FleetPin = { id: string; name: string; status: FleetStatus; lat: number; lng: number };

export function hasCoordinates(t: FleetTelemetry | null): t is FleetTelemetry & { latitude: number; longitude: number } {
  return (
    !!t &&
    t.latitude !== null &&
    t.longitude !== null &&
    Math.abs(t.latitude) <= 90 &&
    Math.abs(t.longitude) <= 180 &&
    !(t.latitude === 0 && t.longitude === 0)
  );
}

export function fleetPins(vehicles: FleetVehicle[]): FleetPin[] {
  const pins: FleetPin[] = [];
  for (const v of vehicles) {
    if (!v.hasDevice || !hasCoordinates(v.telemetry)) continue;
    pins.push({ id: v.id, name: v.name, status: v.status, lat: v.telemetry.latitude, lng: v.telemetry.longitude });
  }
  return pins;
}

export type MapView =
  | { kind: "empty" }
  | { kind: "center"; center: [number, number]; zoom: number }
  | { kind: "bounds"; bounds: [[number, number], [number, number]] };

export const SINGLE_PIN_ZOOM = 14;
// Pins closer than this (degrees, ~50 m) are treated as one spot: fitting bounds to them would zoom to the max.
const SAME_SPOT_DEG = 0.0005;

export function computeMapView(pins: { lat: number; lng: number }[]): MapView {
  if (pins.length === 0) return { kind: "empty" };
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  if (maxLat - minLat < SAME_SPOT_DEG && maxLng - minLng < SAME_SPOT_DEG) {
    return { kind: "center", center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2], zoom: SINGLE_PIN_ZOOM };
  }
  return { kind: "bounds", bounds: [[minLng, minLat], [maxLng, maxLat]] };
}

export const STATUS_LABEL: Record<FleetStatus, string> = {
  moving: "Moving",
  parked: "Parked",
  offline: "Offline",
  no_device: "No device",
};
