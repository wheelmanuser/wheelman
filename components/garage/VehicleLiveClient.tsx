"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { MapErrorBoundary } from "@/components/telematics/MapErrorBoundary";
import { CheckEngineStatus } from "@/components/telematics/CheckEngineStatus";
import { useCheckEngine } from "@/components/telematics/useCheckEngine";
import { useVisibleInterval } from "@/components/telematics/useVisibleInterval";
import { ConnectionDot, FleetStatusChip } from "@/components/dashboard/FleetStatusChip";
import {
  DayTimeline,
  LIVE_TRIP_ID,
  liveTripSummary,
  TripsDayPanel,
  useDayTrips,
  useTripDetail,
  waypointsFor,
} from "@/components/garage/LiveTrips";
import type { MapFocus } from "@/components/telematics/LiveMap";
import { useUserSettings } from "@/contexts/UserSettingsContext";
import { addDays, centralToday, DAY_PICKER_RANGE_DAYS } from "@/lib/central-day";
import { formatDistance } from "@/lib/format-distance";
import { formatLastSeen, hasCoordinates, type FleetVehicle } from "@/lib/fleet-status";
import {
  formatDeviceBattery,
  formatFuelLevel,
  formatIgnition,
  formatMpg,
  formatTelemetrySpeed,
  formatVolts,
} from "@/lib/telemetry-display";
import { formatDuration, formatTripDistance } from "@/lib/trip-display";
import { SAFE_TRIP_ID } from "@/lib/xvision/trip-parse";
import type { CurrentTrip } from "@/lib/xvision/types";

const LiveMap = dynamic(() => import("@/components/telematics/LiveMap").then((m) => m.LiveMap), { ssr: false });

type View = "overview" | "trips";
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

function Metric({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string | null }) {
  return (
    <div className="border border-l-4 border-wm-border border-l-wm-accent-dark bg-wm-s1 px-3 py-2">
      <div className="mb-0.5 flex items-center gap-1.5">
        <Icon name={icon} size={14} className="text-wm-accent" />
        <span className="label-technical text-wm-text3">{label}</span>
      </div>
      <p className="font-headline text-lg text-wm-text">{value}</p>
      {sub && <p className="text-xs text-wm-text3">{sub}</p>}
    </div>
  );
}

export function VehicleLiveClient({ initialVehicle }: { initialVehicle: FleetVehicle }) {
  const { settings } = useUserSettings();
  const distanceUnit = settings.distance_unit ?? "miles";
  const searchParams = useSearchParams();
  const [vehicle, setVehicle] = useState(initialVehicle);
  const [current, setCurrent] = useState<CurrentTrip | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // Times and "today" depend on the clock, so they are only computed after mount; rendering them on the
  // server would not match the browser and break hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);

  // ?view=trips&date=YYYY-MM-DD&trip=<id> keeps the Trips tab state across refreshes and shared links.
  const [view, setView] = useState<View>(searchParams.get("view") === "trips" ? "trips" : "overview");
  const [dateParam, setDateParam] = useState<string | null>(() => {
    const d = searchParams.get("date");
    return d && DATE_SHAPE.test(d) ? d : null;
  });
  const [tripId, setTripId] = useState<string | null>(() => {
    const t = searchParams.get("trip");
    return t && (t === LIVE_TRIP_ID || SAFE_TRIP_ID.test(t)) ? t : null;
  });
  const [hoveredTripId, setHoveredTripId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const mapBoxRef = useRef<HTMLDivElement>(null);

  const id = vehicle.id;
  const { hasDevice } = vehicle;
  const { results: checkEngine } = useCheckEngine([id], hasDevice);

  const today = now !== null ? centralToday(now) : null;
  const earliest = today ? addDays(today, -DAY_PICKER_RANGE_DAYS) : null;
  const date =
    today && dateParam && dateParam <= today && earliest && dateParam >= earliest ? dateParam : today;
  const tripsOpen = view === "trips" && hasDevice;

  useEffect(() => {
    if (!date) return;
    const url = new URL(window.location.href);
    url.search = "";
    if (view === "trips") {
      url.searchParams.set("view", "trips");
      url.searchParams.set("date", date);
      if (tripId) url.searchParams.set("trip", tripId);
    }
    window.history.replaceState(null, "", url.toString());
  }, [view, date, tripId]);

  const loadCurrentTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/xvision/trips/current?vehicleId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const body = (await res.json()) as { current?: CurrentTrip };
      if (body.current) setCurrent(body.current);
    } catch {
      // keep the last known live trip
    }
  }, [id]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/fleet?vehicleId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = (await res.json()) as { vehicles?: FleetVehicle[] };
      if (res.ok && body.vehicles?.[0]) {
        setVehicle(body.vehicles[0]);
        setUpdatedAt(new Date());
        setNow(Date.now());
      }
    } catch {
      // keep the last good reading on screen
    }
    if (hasDevice) await loadCurrentTrip();
  }, [id, hasDevice, loadCurrentTrip]);

  useEffect(() => {
    setUpdatedAt(new Date());
    if (hasDevice) void loadCurrentTrip();
  }, [hasDevice, loadCurrentTrip]);

  // Same cadence as the sync cron; paused while the browser tab is hidden. Also refreshes the live trip.
  useVisibleInterval(refresh, 60_000);

  const isToday = date !== null && date === today;
  const day = useDayTrips(id, tripsOpen ? date : null, tripsOpen && isToday);
  const tripDetail = useTripDetail(id, date, tripsOpen ? tripId : null);
  const live = useMemo(() => (isToday ? liveTripSummary(current) : null), [isToday, current]);
  // On the timeline the live trip runs up to its latest point rather than showing as a sliver at its start.
  const liveEndAt = current?.live ? (current.points[current.points.length - 1]?.at ?? null) : null;
  const timelineTrips = useMemo(
    () => [...(live ? [{ ...live, endAt: liveEndAt }] : []), ...(day.trips ?? [])],
    [live, liveEndAt, day.trips],
  );

  const selectTrip = (next: string | null) => {
    setTripId(next);
    setFocus(null);
  };
  const changeDate = (next: string) => {
    setDateParam(next);
    selectTrip(null);
  };
  // On phones the map sits above the waypoint list, so bring it back on screen to show the point being panned to.
  const focusPoint = (next: MapFocus) => {
    setFocus(next);
    const box = mapBoxRef.current?.getBoundingClientRect();
    if (!box) return;
    const visible = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0);
    if (visible < box.height * 0.6) mapBoxRef.current?.scrollIntoView({ block: "nearest" });
  };
  const changeView = (next: View) => {
    setView(next);
    if (next === "overview") selectTrip(null);
  };

  const t = vehicle.telemetry;
  const position = hasCoordinates(t) ? { lat: t.latitude, lng: t.longitude } : null;
  const liveRoute = useMemo(() => (current?.live ? current.points : []), [current]);
  const mapTrip = useMemo(() => {
    if (!tripsOpen || !tripId) return null;
    if (tripId === LIVE_TRIP_ID) return current?.live ? { points: current.points, events: current.events } : null;
    return tripDetail.detail ? { points: tripDetail.detail.points, events: tripDetail.detail.events } : null;
  }, [tripsOpen, tripId, current, tripDetail.detail]);

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="flex w-fit items-center gap-1 text-sm text-wm-text2 hover:text-wm-text">
        <Icon name="arrow_back" size={16} /> Dashboard
      </Link>

      {/* Desktop: fill the viewport below the header (4rem), main padding (2 x 1.5rem) and the back link + gap
          (1.25rem + 1rem) = 9.25rem. The map flexes, the timeline stays under it, the side panel scrolls. */}
      <div className="grid grid-cols-1 border border-wm-border bg-wm-s1 lg:h-[calc(100vh-9.25rem)] lg:min-h-[520px] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)]">
        <div className="flex flex-col border-b border-wm-border lg:min-h-0 lg:border-b-0 lg:border-r">
          <div ref={mapBoxRef} className="h-[360px] lg:h-auto lg:min-h-0 lg:flex-1">
            {hasDevice ? (
              <MapErrorBoundary>
                <LiveMap
                  position={position}
                  name={vehicle.name}
                  status={vehicle.status}
                  route={liveRoute}
                  trip={mapTrip}
                  focus={focus}
                  onReturnToLive={() => selectTrip(null)}
                />
              </MapErrorBoundary>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 bg-wm-s2 p-6 text-center">
                <Icon name="sensors_off" size={28} className="text-wm-text3" />
                <p className="label-technical text-wm-text3">No device linked</p>
              </div>
            )}
          </div>
          {tripsOpen && date && (
            <DayTimeline
              date={date}
              trips={timelineTrips}
              selectedTripId={tripId}
              hoveredTripId={hoveredTripId}
              onHoverTrip={setHoveredTripId}
              onSelectTrip={(next) => selectTrip(next)}
            />
          )}
        </div>

        <aside className="space-y-4 p-5 lg:min-h-0 lg:overflow-y-auto">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-headline text-2xl font-light tracking-wide text-wm-text">{vehicle.name}</h2>
              <FleetStatusChip status={vehicle.status} />
            </div>
            <div className="mt-2 flex items-start gap-2">
              <span className="mt-1.5">
                <ConnectionDot status={vehicle.status} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-wm-text2">{t?.address ?? "—"}</p>
                {hasDevice && now !== null && (
                  <p className="text-xs text-wm-text3">
                    Last seen {formatLastSeen(t?.last_contact, now)}
                    {t?.last_contact ? ` · ${new Date(t.last_contact).toLocaleString()}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex border-b border-wm-border" role="tablist">
            {(["overview", "trips"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => changeView(v)}
                className={`label-technical -mb-px px-4 pb-2 transition-colors ${
                  view === v ? "border-b-2 border-wm-gold text-wm-text" : "text-wm-text3 hover:text-wm-text2"
                }`}
              >
                {v === "overview" ? "Overview" : "Trips"}
              </button>
            ))}
          </div>

          {!hasDevice ? (
            <div className="border border-dashed border-wm-border p-4 text-center">
              <p className="label-technical text-wm-text3">No device linked</p>
              <Link
                href={`/garage/${id}?tab=telematics`}
                className="label-technical mt-3 inline-flex border border-wm-accent px-4 py-2 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg"
              >
                Link a device
              </Link>
            </div>
          ) : view === "trips" ? (
            date && today ? (
              <TripsDayPanel
                date={date}
                today={today}
                distanceUnit={distanceUnit}
                trips={day.trips}
                loading={day.loading}
                error={day.error}
                live={live}
                selectedTripId={tripId}
                hoveredTripId={hoveredTripId}
                waypoints={waypointsFor(tripDetail.detail, current, tripId)}
                waypointsLoading={tripDetail.loading}
                waypointsError={tripDetail.error}
                focusedKey={focus?.key ?? null}
                onDateChange={changeDate}
                onSelectTrip={selectTrip}
                onHoverTrip={setHoveredTripId}
                onFocus={focusPoint}
              />
            ) : (
              <p className="text-sm text-wm-text2">Loading trips...</p>
            )
          ) : (
            <>
              {current?.live && (
                <div className="flex flex-wrap items-center gap-2 border border-l-4 border-wm-border border-l-wm-red bg-wm-s2 px-3 py-2 text-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-wm-red" />
                  <span className="label-technical text-wm-red">Trip in progress</span>
                  <span className="text-wm-text2">
                    {formatDuration(current.durationSec)} · {formatTripDistance(current.distanceMiles, distanceUnit)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Metric icon="speed" label="Speed" value={formatTelemetrySpeed(t?.speed, distanceUnit)} />
                <Metric icon="key" label="Ignition" value={formatIgnition(t?.ignition)} />
                <Metric icon="route" label="Odometer" value={formatDistance(t?.odometer_miles, distanceUnit)} />
                <Metric icon="local_gas_station" label="Fuel" value={formatFuelLevel(t?.fuel_level_pct)} />
                <Metric
                  icon="battery_charging_full"
                  label="Battery"
                  value={formatVolts(t?.input_voltage)}
                  sub={formatDeviceBattery(t?.device_battery_pct)}
                />
                <Metric icon="eco" label="Fuel economy" value={formatMpg(t?.fuel_economy_mpg)} />
              </div>

              <div className="border border-l-4 border-wm-border border-l-wm-accent-dark bg-wm-s1 px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <Icon name="warning_amber" size={14} className="text-wm-accent" />
                  <span className="label-technical text-wm-text3">Check engine</span>
                </div>
                <CheckEngineStatus state={checkEngine[id]} />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-wm-border pt-4">
                <button
                  type="button"
                  onClick={() => changeView("trips")}
                  className="label-technical inline-flex items-center gap-1 border border-wm-accent px-3 py-1.5 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg"
                >
                  <Icon name="route" size={14} /> View trips
                </button>
                <Link
                  href={`/garage/${id}`}
                  className="label-technical inline-flex items-center gap-1 border border-wm-border px-3 py-1.5 text-wm-text2 transition-colors hover:border-wm-accent hover:text-wm-text"
                >
                  <Icon name="directions_car" size={14} /> Vehicle details
                </Link>
              </div>

              <p className="label-technical text-wm-text3">
                {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
