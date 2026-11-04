import { formatDistance } from "@/lib/format-distance";
import { formatTelemetrySpeed } from "@/lib/telemetry-display";

// Trip distances are often under a mile, so show one decimal rather than rounding them to 0.
export function formatTripDistance(miles: number | null | undefined, unit: string): string {
  return formatDistance(miles, unit, 1);
}

// Trip speeds are mph, like the live device speed, so they share its formatter.
export function formatSpeed(mph: number | null | undefined, unit: string): string {
  return formatTelemetrySpeed(mph, unit);
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec < 0) return "—";
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function timeOf(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
}

export function formatTimeRange(startIso: string | null, endIso: string | null): string {
  const start = timeOf(startIso);
  const end = timeOf(endIso);
  if (!start && !end) return "—";
  return `${start ?? "—"} – ${end ?? "—"}`;
}

export function groupByDay<T extends { startAt: string | null }>(items: T[]): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = item.startAt
      ? new Date(item.startAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : "Unknown date";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
