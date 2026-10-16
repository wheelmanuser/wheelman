import { parseEventTime } from "@/supabase/functions/sync-telemetry/parse";
import { xvisionGet } from "./client";
import { extractList } from "./devices";

export type CheckEngineStatus = { milOn: boolean; lastEventAt: string | null };

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// xVision's date-range parameters for GetEvents aren't known, so the 30-day window is applied here.
// An event whose time can't be parsed still counts (better to warn than hide a possible fault).
export function summarizeMilEvents(events: unknown[], now: number = Date.now()): CheckEngineStatus {
  let milOn = false;
  let latest: string | null = null;

  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const e = event as Record<string, unknown>;
    if (typeof e.EventType === "string" && e.EventType.toUpperCase() !== "MIL") continue;

    const at = parseEventTime(e.DateTime ?? e.EventTime ?? e.Time);
    if (at && Date.parse(at) < now - WINDOW_MS) continue;

    milOn = true;
    if (at && (!latest || at > latest)) latest = at;
  }
  return { milOn, lastEventAt: latest };
}

export async function getCheckEngineStatus(objectId: string): Promise<CheckEngineStatus> {
  const payload = await xvisionGet<unknown>(
    `/Data/GetEvents?ObjectID=${encodeURIComponent(objectId)}&Events=MIL`,
  );
  return summarizeMilEvents(extractList(payload));
}
