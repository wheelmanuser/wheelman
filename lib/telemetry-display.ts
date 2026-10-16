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
