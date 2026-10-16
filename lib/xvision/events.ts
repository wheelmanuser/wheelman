import { parseEventTime } from "@/supabase/functions/sync-telemetry/parse";
import { xvisionGet } from "./client";
import { extractList } from "./devices";

export type CheckEngineStatus = { milOn: boolean; lastEventAt: string | null };

const WINDOW_DAYS = 30;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

// GetEvents takes FromDateTime / ToDateTime as "YYYY-MM-DD HH:MM:SS". The timezone isn't documented; UTC is used.
export function formatXVisionDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function buildMilEventsPath(objectId: string, now: number = Date.now()): string {
  const from = formatXVisionDateTime(new Date(now - WINDOW_MS));
  const to = formatXVisionDateTime(new Date(now));
  return (
    `/Data/GetEvents?ObjectID=${encodeURIComponent(objectId)}&Events=MIL` +
    `&FromDateTime=${encodeURIComponent(from)}&ToDateTime=${encodeURIComponent(to)}`
  );
}

// The window is also applied here as a safety net in case the server returns older events.
// An event whose time can't be parsed still counts (better to warn than hide a possible fault).
export function summarizeMilEvents(events: unknown[], now: number = Date.now()): CheckEngineStatus {
  let milOn = false;
  let latest: string | null = null;

  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const e = event as Record<string, unknown>;
    if (typeof e.EventType === "string" && e.EventType.toUpperCase() !== "MIL") continue;

    const at = parseEventTime(e.EventTime ?? e.DateTime);
    if (at && Date.parse(at) < now - WINDOW_MS) continue;

    milOn = true;
    if (at && (!latest || at > latest)) latest = at;
  }
  return { milOn, lastEventAt: latest };
}

export async function getCheckEngineStatus(objectId: string): Promise<CheckEngineStatus> {
  const now = Date.now();
  const payload = await xvisionGet<unknown>(buildMilEventsPath(objectId, now));
  return summarizeMilEvents(extractList(payload), now);
}
