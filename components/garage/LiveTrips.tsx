"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useVisibleInterval } from "@/components/telematics/useVisibleInterval";
import {
  addDays,
  centralDayBounds,
  centralWallClockMs,
  DAY_PICKER_RANGE_DAYS,
  formatCentralTime,
  formatDayLabel,
  parseClockInput,
} from "@/lib/central-day";
import { formatDuration, formatSpeed, formatTripDistance } from "@/lib/trip-display";
import {
  buildWaypointRows,
  dayTotals,
  findTripAt,
  timelineSegments,
  timelineTicks,
  WAYPOINT_PAGE_SIZE,
  type WaypointRow,
} from "@/lib/trip-day";
import type { CurrentTrip, TripDetail, TripSummary } from "@/lib/xvision/types";
import type { MapFocus } from "@/components/telematics/LiveMap";

export const LIVE_TRIP_ID = "live";

// The in-progress trip shown as a card alongside the day's finished trips.
export function liveTripSummary(current: CurrentTrip | null): TripSummary | null {
  if (!current?.live) return null;
  return {
    tripId: LIVE_TRIP_ID,
    startAt: current.startAt,
    endAt: null,
    durationSec: current.durationSec,
    distanceMiles: current.distanceMiles,
    maxSpeedMph: current.maxSpeedMph,
    avgSpeedMph: current.avgSpeedMph,
  };
}

// Trips starting on a Central day. Today's list is refreshed every 60s while the tab is visible, so a trip
// that just finished moves from "Live" into the list.
export function useDayTrips(vehicleId: string, date: string | null, isToday: boolean) {
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef<string | null>(null);

  const load = useCallback(
    async (showLoading: boolean) => {
      if (!date) return;
      requested.current = date;
      if (showLoading) {
        setLoading(true);
        setTrips(null);
      }
      setError(null);
      try {
        const res = await fetch(`/api/xvision/trips?vehicleId=${encodeURIComponent(vehicleId)}&date=${date}`);
        const body = (await res.json()) as { trips?: TripSummary[]; error?: string };
        if (requested.current !== date) return;
        if (!res.ok || !body.trips) throw new Error(body.error ?? "Could not load trips");
        setTrips(body.trips);
      } catch (err) {
        if (requested.current === date) setError(err instanceof Error ? err.message : "Could not load trips");
      } finally {
        if (requested.current === date) setLoading(false);
      }
    },
    [vehicleId, date],
  );

  useEffect(() => {
    void load(true);
  }, [load]);
  useVisibleInterval(() => void load(false), 60_000, isToday);

  return { trips, loading, error };
}

export function useTripDetail(vehicleId: string, date: string | null, tripId: string | null) {
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (!date || !tripId || tripId === LIVE_TRIP_ID) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/xvision/trips/${encodeURIComponent(tripId)}?vehicleId=${encodeURIComponent(vehicleId)}&date=${date}`,
        );
        const body = (await res.json()) as { trip?: TripDetail; error?: string };
        if (cancelled) return;
        if (!res.ok || !body.trip) throw new Error(body.error ?? "Could not load trip");
        setDetail(body.trip);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load trip");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId, date, tripId]);

  return { detail, loading, error };
}

function DayPicker({ date, today, onChange }: { date: string; today: string; onChange: (date: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const earliest = addDays(today, -DAY_PICKER_RANGE_DAYS);
  const openCalendar = () => {
    const input = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    try {
      input?.showPicker?.();
    } catch {
      input?.focus();
    }
  };
  const arrow = "flex h-8 w-8 items-center justify-center border border-wm-border text-wm-text2 transition-colors hover:border-wm-accent hover:text-wm-text disabled:opacity-30 disabled:hover:border-wm-border";
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" aria-label="Previous day" className={arrow} disabled={date <= earliest} onClick={() => onChange(addDays(date, -1))}>
        <Icon name="chevron_left" size={18} />
      </button>
      <div className="relative flex-1 text-center">
        <button type="button" onClick={openCalendar} className="font-headline inline-flex items-center gap-1.5 text-base text-wm-text hover:text-wm-accent">
          <Icon name="calendar_month" size={16} className="text-wm-accent" />
          {date === today ? `Today · ${formatDayLabel(date)}` : formatDayLabel(date)}
        </button>
        <input
          ref={inputRef}
          type="date"
          aria-label="Pick a day"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          min={earliest}
          max={today}
          value={date}
          onChange={(e) => {
            if (e.target.value && e.target.value >= earliest && e.target.value <= today) onChange(e.target.value);
          }}
        />
      </div>
      <button type="button" aria-label="Next day" className={arrow} disabled={date >= today} onClick={() => onChange(addDays(date, 1))}>
        <Icon name="chevron_right" size={18} />
      </button>
    </div>
  );
}

const KIND_CLASS: Record<WaypointRow["kind"], string> = {
  start: "bg-wm-accent/20 text-wm-accent",
  end: "bg-wm-s3 text-wm-text",
  waypoint: "text-wm-text3",
  event: "bg-wm-red/20 text-wm-red",
};

function WaypointList({
  rows,
  distanceUnit,
  focusedKey,
  onFocus,
}: {
  rows: WaypointRow[];
  distanceUnit: string;
  focusedKey: string | null;
  onFocus: (focus: MapFocus) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, WAYPOINT_PAGE_SIZE);
  if (rows.length === 0) return <p className="px-3 py-2 text-xs text-wm-text3">No route points for this trip.</p>;
  return (
    <div className="border-t border-wm-border">
      <ul className="divide-y divide-wm-border">
        {visible.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => onFocus({ key: r.key, lat: r.lat, lng: r.lng })}
              className={`grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-wm-s3 ${
                focusedKey === r.key ? "bg-wm-s3 shadow-[inset_2px_0_0_#e6c364]" : ""
              }`}
            >
              <span className="whitespace-nowrap font-mono text-wm-text2">{formatCentralTime(r.at, true)}</span>
              <span className="min-w-0">
                <span className={`label-technical rounded-sm px-1.5 py-0.5 ${KIND_CLASS[r.kind]}`}>{r.label}</span>
                {r.address && <span className="mt-0.5 block truncate text-wm-text3">{r.address}</span>}
              </span>
              <span className="whitespace-nowrap text-wm-text2">{formatSpeed(r.speedMph, distanceUnit)}</span>
            </button>
          </li>
        ))}
      </ul>
      {!showAll && rows.length > WAYPOINT_PAGE_SIZE && (
        <button type="button" onClick={() => setShowAll(true)} className="label-technical w-full border-t border-wm-border py-2 text-wm-accent hover:bg-wm-s2">
          Show all {rows.length}
        </button>
      )}
    </div>
  );
}

type PanelProps = {
  date: string;
  today: string;
  distanceUnit: string;
  trips: TripSummary[] | null;
  loading: boolean;
  error: string | null;
  live: TripSummary | null;
  selectedTripId: string | null;
  hoveredTripId: string | null;
  waypoints: WaypointRow[] | null;
  waypointsLoading: boolean;
  waypointsError: string | null;
  focusedKey: string | null;
  onDateChange: (date: string) => void;
  onSelectTrip: (tripId: string | null) => void;
  onHoverTrip: (tripId: string | null) => void;
  onFocus: (focus: MapFocus) => void;
};

export function TripsDayPanel(props: PanelProps) {
  const { date, today, distanceUnit, trips, loading, error, live, selectedTripId, hoveredTripId } = props;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [findText, setFindText] = useState("");
  // A note about a found trip is shown only while that trip stays selected.
  const [findNote, setFindNote] = useState<{ text: string; tripId: string | null } | null>(null);
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});
  // Hovering a timeline segment scrolls its card into view; hovering the card itself must not.
  const cardHover = useRef<string | null>(null);

  useEffect(() => {
    setExpandedId(null);
    setFindNote(null);
  }, [date]);
  useEffect(() => {
    if (hoveredTripId && hoveredTripId !== cardHover.current) {
      cardRefs.current[hoveredTripId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [hoveredTripId]);

  const cards = [...(live && date === today ? [live] : []), ...(trips ?? [])];
  // Totals include today's in-progress trip so far.
  const totals = dayTotals(cards);

  const findTime = (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = parseClockInput(findText);
    if (minutes === null) {
      setFindNote({ text: "Enter a time like 2:30 PM.", tripId: null });
      return;
    }
    // The live trip runs until now, so a time since it started finds it.
    const nowIso = new Date().toISOString();
    const spans = cards.map((t) => (t.tripId === LIVE_TRIP_ID ? { ...t, endAt: nowIso } : t));
    const match = findTripAt(spans, centralWallClockMs(date, minutes));
    if (!match) {
      setFindNote({ text: "No trips on this day.", tripId: null });
      return;
    }
    props.onSelectTrip(match.tripId);
    setExpandedId(match.tripId);
    const trip = cards.find((t) => t.tripId === match.tripId);
    setFindNote(
      match.exact
        ? null
        : {
            text: `No trip at ${findText.trim()} — showing the nearest (${formatCentralTime(trip?.startAt)}–${trip?.endAt ? formatCentralTime(trip.endAt) : "now"}).`,
            tripId: match.tripId,
          },
    );
  };

  return (
    <div className="space-y-4">
      <DayPicker date={date} today={today} onChange={props.onDateChange} />

      {loading ? (
        <p className="text-sm text-wm-text2">Loading trips...</p>
      ) : error ? (
        <p className="text-sm text-wm-red">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px border border-wm-border bg-wm-border text-center">
            {[
              { label: "Trips", value: String(totals.count) },
              { label: "Distance", value: formatTripDistance(totals.distanceMiles, distanceUnit) },
              { label: "Drive time", value: formatDuration(totals.driveSec) },
            ].map((s) => (
              <div key={s.label} className="bg-wm-s1 px-1 py-2">
                <p className="font-headline text-lg text-wm-text">{s.value}</p>
                <p className="label-technical whitespace-nowrap text-wm-text3">{s.label}</p>
              </div>
            ))}
          </div>

          <form onSubmit={findTime} className="space-y-1">
            <div className="flex gap-2">
              <input
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="Find time, e.g. 2:30 PM"
                aria-label="Find time"
                className="min-w-0 flex-1 rounded-sm border border-wm-border bg-wm-s2 px-3 py-1.5 text-sm text-wm-text outline-none focus:border-wm-accent"
              />
              <button type="submit" className="label-technical border border-wm-accent px-3 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg">
                Find
              </button>
            </div>
            {findNote && (findNote.tripId === null || findNote.tripId === selectedTripId) && (
              <p className="text-xs text-wm-text3">{findNote.text}</p>
            )}
          </form>

          {cards.length === 0 ? (
            <div className="border border-dashed border-wm-border p-6 text-center label-technical text-wm-text3">No trips on this day.</div>
          ) : (
            <ul className="space-y-2">
              {cards.map((t) => {
                const isLive = t.tripId === LIVE_TRIP_ID;
                const selected = selectedTripId === t.tripId;
                const highlighted = selected || hoveredTripId === t.tripId;
                const expanded = expandedId === t.tripId;
                return (
                  <li
                    key={t.tripId}
                    ref={(el) => {
                      cardRefs.current[t.tripId] = el;
                    }}
                    onMouseEnter={() => {
                      cardHover.current = t.tripId;
                      props.onHoverTrip(t.tripId);
                    }}
                    onMouseLeave={() => {
                      cardHover.current = null;
                      props.onHoverTrip(null);
                    }}
                    className={`border border-l-4 border-wm-border bg-wm-s1 transition-colors ${
                      isLive ? "border-l-wm-red" : highlighted ? "border-l-wm-gold" : "border-l-wm-accent-dark"
                    } ${highlighted ? "bg-wm-s2" : ""} ${isLive && selected ? "ring-1 ring-wm-gold/60" : ""}`}
                  >
                    <button type="button" onClick={() => props.onSelectTrip(selected ? null : t.tripId)} className="w-full px-3 py-2.5 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-headline text-base text-wm-text">
                          {formatCentralTime(t.startAt)} – {isLive ? "now" : formatCentralTime(t.endAt)}
                        </span>
                        {isLive && (
                          <span className="label-technical inline-flex items-center gap-1 text-wm-red">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-wm-red" /> Live
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-wm-text2">
                        <span>{formatTripDistance(t.distanceMiles, distanceUnit)}</span>
                        <span>{formatDuration(t.durationSec)}</span>
                        <span>Max {formatSpeed(t.maxSpeedMph, distanceUnit)}</span>
                        <span>Avg {formatSpeed(t.avgSpeedMph, distanceUnit)}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = expanded ? null : t.tripId;
                        setExpandedId(next);
                        if (next) props.onSelectTrip(next);
                      }}
                      className="label-technical flex w-full items-center gap-1 border-t border-wm-border px-3 py-1.5 text-wm-text3 hover:text-wm-accent"
                    >
                      <Icon name={expanded ? "expand_less" : "expand_more"} size={16} /> Trip details
                    </button>
                    {expanded && selected && (
                      props.waypointsLoading ? (
                        <p className="border-t border-wm-border px-3 py-2 text-xs text-wm-text2">Loading waypoints...</p>
                      ) : props.waypointsError ? (
                        <p className="border-t border-wm-border px-3 py-2 text-xs text-wm-red">{props.waypointsError}</p>
                      ) : props.waypoints ? (
                        <WaypointList
                          key={t.tripId}
                          rows={props.waypoints}
                          distanceUnit={distanceUnit}
                          focusedKey={props.focusedKey}
                          onFocus={props.onFocus}
                        />
                      ) : null
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function DayTimeline({
  date,
  trips,
  selectedTripId,
  hoveredTripId,
  onHoverTrip,
  onSelectTrip,
}: {
  date: string;
  trips: TripSummary[];
  selectedTripId: string | null;
  hoveredTripId: string | null;
  onHoverTrip: (tripId: string | null) => void;
  onSelectTrip: (tripId: string) => void;
}) {
  const bounds = centralDayBounds(date);
  const segments = timelineSegments(trips, bounds);
  const ticks = timelineTicks(date, bounds);
  return (
    <div className="shrink-0 border-t border-wm-border px-4 py-3">
      <div className="relative h-6 bg-wm-s2">
        {segments.map((s) => {
          const trip = trips.find((t) => t.tripId === s.tripId);
          const active = s.tripId === selectedTripId || s.tripId === hoveredTripId;
          return (
            <button
              key={s.tripId}
              type="button"
              aria-label={`Trip ${formatCentralTime(trip?.startAt)}`}
              title={`${formatCentralTime(trip?.startAt)} – ${trip?.endAt ? formatCentralTime(trip.endAt) : "now"}`}
              onMouseEnter={() => onHoverTrip(s.tripId)}
              onMouseLeave={() => onHoverTrip(null)}
              onClick={() => onSelectTrip(s.tripId)}
              style={{ left: `${s.leftPct}%`, width: `${s.widthPct}%` }}
              className={`absolute inset-y-0 transition-colors ${
                s.tripId === LIVE_TRIP_ID ? "bg-wm-red" : active ? "bg-wm-gold" : "bg-wm-accent"
              }`}
            />
          );
        })}
      </div>
      <div className="relative mt-1 h-4">
        {ticks.map((t, i) => (
          <span
            key={`${t.label}-${i}`}
            className="label-technical absolute whitespace-nowrap text-wm-text3"
            style={{ left: `${t.pct}%`, transform: i === 0 ? "none" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function waypointsFor(detail: TripDetail | null, live: CurrentTrip | null, tripId: string | null): WaypointRow[] | null {
  if (tripId === LIVE_TRIP_ID) return live?.live ? buildWaypointRows(live.points, live.events) : null;
  return detail ? buildWaypointRows(detail.points, detail.events) : null;
}
