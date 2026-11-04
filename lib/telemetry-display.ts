function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Every formatter returns "—" for a missing value; none ever falls back to 0.
export function formatFuelLevel(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return n === null ? "—" : `${Math.round(n)}%`;
}

export function formatVolts(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return n === null ? "—" : `${n.toFixed(1)} V`;
}

export function formatMpg(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return n === null ? "—" : `${n.toFixed(1)} MPG`;
}

export function formatDeviceBattery(value: number | string | null | undefined): string | null {
  const n = toNumber(value);
  return n === null ? null : `Device battery ${Math.round(n)}%`;
}

// Device Speed is reported in mph (the account's units): verified against GPS distance/time between
// consecutive fixes (median ratio 0.68 vs km/h; mph = 0.62).
export function formatTelemetrySpeed(mph: number | string | null | undefined, unit: string): string {
  const n = toNumber(mph);
  if (n === null) return "—";
  return unit === "km" ? `${Math.round(n * 1.609344)} km/h` : `${Math.round(n)} mph`;
}

export function formatIgnition(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (/^(1|on|true)$/i.test(value)) return "On";
  if (/^(0|off|false)$/i.test(value)) return "Off";
  return value;
}
