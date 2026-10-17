"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { MapErrorBoundary } from "@/components/telematics/MapErrorBoundary";
import { useVisibleInterval } from "@/components/telematics/useVisibleInterval";
import {
  formatDuration,
  formatSpeed,
  formatTimeRange,
  formatTripDistance,
  groupByDay,
} from "@/lib/trip-display";
import type { CurrentTrip, TripDetail, TripEvent, TripSummary } from "@/lib/xvision/types";

const TripMap = dynamic(() => import("@/components/telematics/TripMap").then((m) => m.TripMap), {
  ssr: false,
});

type Props = { vehicleId: string; distanceUnit: string; hasDevice: boolean };

function eventSummary(events: TripEvent[]): string | null {
  if (events.length === 0) return null;
  const counts = new Map<string, number>();
  for (const e of events) {
    const label = e.category === "other" ? e.type : e.category;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, n]) => `${n} ${label}`)
    .join(" · ");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-technical text-wm-text3">{label}</p>
      <p className="font-headline text-base text-wm-text">{value}</p>
    </div>
  );
}

export function TripsPanel({ vehicleId, distanceUnit, hasDevice }: Props) {
  const [days, setDays] = useState<7 | 30>(7);
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [current, setCurrent] = useState<CurrentTrip | null>(null);
  const requestedTrip = useRef<string | null>(null);

  useEffect(() => {
    if (!hasDevice) return;
    let cancelled = false;
    (async () => {
      setTripsLoading(true);
      setTripsError(null);
      setSelectedId(null);
      try {
        const res = await fetch(`/api/xvision/trips?vehicleId=${encodeURIComponent(vehicleId)}&days=${days}`);
        const body = (await res.json()) as { trips?: TripSummary[]; error?: string };
        if (!res.ok || !body.trips) throw new Error(body.error ?? "Could not load trips");
        if (!cancelled) setTrips(body.trips);
      } catch (err) {
        if (!cancelled) setTripsError(err instanceof Error ? err.message : "Could not load trips");
      } finally {
        if (!cancelled) setTripsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId, days, hasDevice]);

  const fetchCurrent = useCallback(async () => {
    try {
      const res = await fetch(`/api/xvision/trips/current?vehicleId=${encodeURIComponent(vehicleId)}`);
      if (!res.ok) return;
      const body = (await res.json()) as { current?: CurrentTrip };
      if (body.current) setCurrent(body.current);
    } catch {
      // keep the last known live trip on a failed refresh
    }
  }, [vehicleId]);

  useEffect(() => {
    if (hasDevice) void fetchCurrent();
  }, [hasDevice, fetchCurrent]);

  // Same cadence as the sync cron; paused while the browser tab is hidden.
  useVisibleInterval(fetchCurrent, 60_000, hasDevice);

  const toggleTrip = async (tripId: string) => {
    if (selectedId === tripId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(tripId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    requestedTrip.current = tripId;
    try {
      const res = await fetch(
        `/api/xvision/trips/${encodeURIComponent(tripId)}?vehicleId=${encodeURIComponent(vehicleId)}`,
      );
      const body = (await res.json()) as { trip?: TripDetail; error?: string };
      if (requestedTrip.current !== tripId) return;
      if (!res.ok || !body.trip) throw new Error(body.error ?? "Could not load trip");
      setDetail(body.trip);
    } catch (err) {
      if (requestedTrip.current === tripId) {
        setDetailError(err instanceof Error ? err.message : "Could not load trip");
      }
    } finally {
      if (requestedTrip.current === tripId) setDetailLoading(false);
    }
  };

  if (!hasDevice) {
    return (
      <div className="border border-dashed border-wm-border p-6 text-center label-technical text-wm-text3">
        Link a WhereQube device on the Telematics tab to see trips.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {current?.live && (
        <section className="border border-l-4 border-wm-border border-l-wm-red bg-wm-s1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wm-border px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-wm-red" />
              <span className="label-technical text-wm-red">Live</span>
              <span className="text-sm text-wm-text2">
                Started {current.startAt ? new Date(current.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}
              </span>
            </div>
            <div className="flex flex-wrap gap-6">
              <Stat label="Duration" value={formatDuration(current.durationSec)} />
              <Stat label="Distance" value={formatTripDistance(current.distanceKm, distanceUnit)} />
              <Stat label="Max speed" value={formatSpeed(current.maxSpeedKmh, distanceUnit)} />
            </div>
          </div>
          <MapErrorBoundary>
            <TripMap points={current.points} events={current.events} />
          </MapErrorBoundary>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs uppercase tracking-widest text-wm-text3">Trips</h3>
        <div className="flex gap-2">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`label-technical rounded-sm border px-3 py-1 transition-colors ${
                days === d
                  ? "border-wm-gold bg-wm-accent-dark text-wm-gold"
                  : "border-wm-border text-wm-text3 hover:border-wm-accent"
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {tripsLoading ? (
        <p className="text-sm text-wm-text2">Loading trips...</p>
      ) : tripsError ? (
        <p className="text-sm text-wm-red">{tripsError}</p>
      ) : !trips || trips.length === 0 ? (
        <div className="border border-dashed border-wm-border p-6 text-center label-technical text-wm-text3">
          No trips in the last {days} days.
        </div>
      ) : (
        <div className="space-y-6">
          {groupByDay(trips).map((group) => (
            <section key={group.label}>
              <h4 className="label-technical mb-2 text-wm-text3">{group.label}</h4>
              <ul className="space-y-2">
                {group.items.map((trip) => {
                  const open = selectedId === trip.tripId;
                  return (
                    <li
                      key={trip.tripId}
                      className={`border border-l-4 border-wm-border bg-wm-s1 ${open ? "border-l-wm-gold" : "border-l-wm-accent-dark"}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTrip(trip.tripId)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-wm-s2"
                      >
                        <div className="flex items-center gap-3">
                          <Icon name="route" className="text-wm-accent" size={18} />
                          <div>
                            <p className="font-headline text-base text-wm-text">
                              {formatTimeRange(trip.startAt, trip.endAt)}
                            </p>
                            <p className="text-xs text-wm-text3">{formatDuration(trip.durationSec)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-6">
                          <Stat label="Distance" value={formatTripDistance(trip.distanceKm, distanceUnit)} />
                          <Stat label="Max" value={formatSpeed(trip.maxSpeedKmh, distanceUnit)} />
                          <Stat label="Avg" value={formatSpeed(trip.avgSpeedKmh, distanceUnit)} />
                          <Icon
                            name={open ? "expand_less" : "expand_more"}
                            className="self-center text-wm-text3"
                            size={20}
                          />
                        </div>
                      </button>

                      {open && (
                        <div className="border-t border-wm-border">
                          {detailLoading ? (
                            <p className="px-4 py-3 text-sm text-wm-text2">Loading route...</p>
                          ) : detailError ? (
                            <p className="px-4 py-3 text-sm text-wm-red">{detailError}</p>
                          ) : detail ? (
                            <>
                              <MapErrorBoundary>
                                <TripMap points={detail.points} events={detail.events} />
                              </MapErrorBoundary>
                              {eventSummary(detail.events) && (
                                <p className="px-4 py-2 text-xs text-wm-text2">
                                  Events: {eventSummary(detail.events)}
                                </p>
                              )}
                            </>
                          ) : null}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
