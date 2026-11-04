"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { MapErrorBoundary } from "@/components/telematics/MapErrorBoundary";
import { CheckEngineStatus } from "@/components/telematics/CheckEngineStatus";
import { useCheckEngine } from "@/components/telematics/useCheckEngine";
import { useVisibleInterval } from "@/components/telematics/useVisibleInterval";
import { ConnectionDot, FleetStatusChip } from "@/components/dashboard/FleetStatusChip";
import { useUserSettings } from "@/contexts/UserSettingsContext";
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
import type { CurrentTrip } from "@/lib/xvision/types";

const LiveMap = dynamic(() => import("@/components/telematics/LiveMap").then((m) => m.LiveMap), { ssr: false });

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
  const [vehicle, setVehicle] = useState(initialVehicle);
  const [current, setCurrent] = useState<CurrentTrip | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // Relative times depend on the clock (and toLocaleString on the timezone), so they are only rendered
  // after mount; rendering them on the server would not match the browser and break hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);
  const id = vehicle.id;
  const { hasDevice } = vehicle;
  const { results: checkEngine } = useCheckEngine([id], hasDevice);

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

  // Same cadence as the sync cron; paused while the browser tab is hidden.
  useVisibleInterval(refresh, 60_000);

  const t = vehicle.telemetry;
  const position = hasCoordinates(t) ? { lat: t.latitude, lng: t.longitude } : null;
  const route = current?.live ? current.points : [];

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-wm-text2 hover:text-wm-text">
        <Icon name="arrow_back" size={16} /> Dashboard
      </Link>

      <div className="grid grid-cols-1 border border-wm-border bg-wm-s1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[360px] border-b border-wm-border lg:h-[600px] lg:border-b-0 lg:border-r">
          {hasDevice ? (
            <MapErrorBoundary>
              <LiveMap position={position} name={vehicle.name} status={vehicle.status} route={route} />
            </MapErrorBoundary>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-wm-s2 p-6 text-center">
              <Icon name="sensors_off" size={28} className="text-wm-text3" />
              <p className="label-technical text-wm-text3">No device linked</p>
            </div>
          )}
        </div>

        <aside className="space-y-4 p-5">
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
            </>
          )}

          <div className="flex flex-wrap gap-2 border-t border-wm-border pt-4">
            <Link
              href={`/garage/${id}?tab=trips`}
              className="label-technical inline-flex items-center gap-1 border border-wm-accent px-3 py-1.5 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg"
            >
              <Icon name="route" size={14} /> View trips
            </Link>
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
        </aside>
      </div>
    </div>
  );
}
