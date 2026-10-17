export function formatDistance(
  miles: number | null | undefined,
  unit: string,
  decimals = 0,
): string {
  if (miles == null) return "—";
  const value = unit === "km" ? miles * 1.60934 : miles;
  const text = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${text} ${unit === "km" ? "km" : "mi"}`;
}

export function formatDistanceUnit(unit: string): string {
  return unit === "km" ? "km" : "mi";
}
