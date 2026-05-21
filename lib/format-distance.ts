export function formatDistance(
  miles: number | null | undefined,
  unit: string,
): string {
  if (miles == null) return "—";
  if (unit === "km") {
    return `${Math.round(miles * 1.60934).toLocaleString()} km`;
  }
  return `${Math.round(miles).toLocaleString()} mi`;
}

export function formatDistanceUnit(unit: string): string {
  return unit === "km" ? "km" : "mi";
}
