import { chicagoWallClockToUtcMs } from "@/supabase/functions/sync-telemetry/parse";

// The xVision account's timezone. Trip days, "today" and trip times on the live page all use it, so a trip
// lands on the same day no matter where the viewer's browser is.
export const ACCOUNT_TIME_ZONE = "America/Chicago";

const DAY_PARAM = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DAY_PICKER_RANGE_DAYS = 90;

const DATE_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: ACCOUNT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function ymd(date: string): { y: number; m: number; d: number } | null {
  const match = DAY_PARAM.exec(date);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function centralDateOf(ms: number): string {
  const p: Record<string, string> = {};
  for (const part of DATE_PARTS.formatToParts(new Date(ms))) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

export function centralToday(now: number = Date.now()): string {
  return centralDateOf(now);
}

export function addDays(date: string, days: number): string {
  const p = ymd(date);
  if (!p) throw new Error(`Invalid date ${date}`);
  return new Date(Date.UTC(p.y, p.m - 1, p.d + days)).toISOString().slice(0, 10);
}

// Instant of a Central wall-clock time on `date`, `minutes` after midnight.
export function centralWallClockMs(date: string, minutes: number): number {
  const p = ymd(date);
  if (!p) throw new Error(`Invalid date ${date}`);
  return chicagoWallClockToUtcMs(Date.UTC(p.y, p.m - 1, p.d) + minutes * 60_000);
}

// [startMs, endMs) of a Central calendar day. 23 hours on the spring-forward day, 25 on the fall-back day.
export function centralDayBounds(date: string): { startMs: number; endMs: number } {
  return { startMs: centralWallClockMs(date, 0), endMs: centralWallClockMs(addDays(date, 1), 0) };
}

export type DayParamResult = { ok: true; date: string } | { ok: false; error: string };

export function validateDayParam(value: string | null | undefined, now: number = Date.now()): DayParamResult {
  if (!value || !ymd(value)) return { ok: false, error: "date must be a real calendar date as YYYY-MM-DD" };
  if (value > centralToday(now)) return { ok: false, error: "date cannot be in the future" };
  return { ok: true, date: value };
}

// "Fri, Oct 23, 2026". Formatted from noon UTC of the date itself, so no timezone can shift it a day.
export function formatDayLabel(date: string): string {
  const p = ymd(date);
  if (!p) return date;
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 12)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCentralTime(iso: string | null | undefined, withSeconds = false): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleTimeString("en-US", {
    timeZone: ACCOUNT_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

// "2:30 PM", "2:30pm", "02:30 am" (12h) or "14:30" (24h when there is no AM/PM). Minutes after midnight.
export function parseClockInput(text: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?\s*$/i.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59) return null;
  const meridiem = match[3]?.replace(/\./g, "").toLowerCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    return ((hour % 12) + (meridiem === "pm" ? 12 : 0)) * 60 + minute;
  }
  return hour > 23 ? null : hour * 60 + minute;
}
