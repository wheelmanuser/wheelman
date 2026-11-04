"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { MapErrorBoundary } from "@/components/telematics/MapErrorBoundary";
import { useVisibleInterval } from "@/components/telematics/useVisibleInterval";
import { FleetStatusChip, ConnectionDot } from "@/components/dashboard/FleetStatusChip";
import {
  filterFleet,
  fleetCounts,
  fleetPins,
  formatLastSeen,
  showLastSeen,
  type FleetFilter,
  type FleetVehicle,
} from "@/lib/fleet-status";

const FleetMap = dynamic(() => import("@/components/dashboard/FleetMap").then((m) => m.FleetMap), {
  ssr: false,
});

const FILTERS: { value: FleetFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "moving", label: "Moving" },
  { value: "parked", label: "Parked" },
  { value: "offline", label: "Offline" },
];

type Props = { initialVehicles: FleetVehicle[]; initialError?: boolean };

export function FleetOverview({ initialVehicles, initialError = false }: Props) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [error, setError] = useState(initialError);
  const [filter, setFilter] = useState<FleetFilter>("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // Relative times depend on the clock (and toLocaleString on the timezone), so they are only rendered
  // after mount; rendering them on the server would not match the browser and break hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);
  const tileRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    if (!initialError) setUpdatedAt(new Date());
  }, [initialError]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/fleet", { cache: "no-store" });
      const body = (await res.json()) as { vehicles?: FleetVehicle[] };
      if (!res.ok || !body.vehicles) throw new Error("fleet refresh failed");
      setVehicles(body.vehicles);
      setError(false);
      setUpdatedAt(new Date());
      setNow(Date.now());
    } catch {
      // keep the last good data on screen
    }
  }, []);

  // Same cadence as the sync cron; paused while the browser tab is hidden.
  useVisibleInterval(refresh, 60_000);

  const counts = useMemo(() => fleetCounts(vehicles), [vehicles]);
  const allPins = useMemo(() => fleetPins(vehicles), [vehicles]);
  const visible = useMemo(() => filterFleet(vehicles, filter), [vehicles, filter]);
  const visiblePins = useMemo(() => fleetPins(visible), [visible]);

  const hoverFromMap = useCallback((id: string | null) => {
    setHoveredId(id);
    if (id) tileRefs.current[id]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  const selectFromMap = useCallback((id: string) => router.push(`/garage/${id}/live`), [router]);

  if (error && vehicles.length === 0) {
    return (
      <section className="border border-wm-border border-l-4 border-l-wm-red bg-wm-s1 p-5">
        <h3 className="label-technical text-wm-text3">Live Fleet</h3>
        <p className="mt-2 text-sm text-wm-red">Couldn&apos;t load your fleet. Retrying every minute.</p>
      </section>
    );
  }

  if (vehicles.length === 0) {
    return (
      <section className="border border-wm-border border-l-4 border-l-wm-accent-dark bg-wm-s1 p-5">
        <h3 className="label-technical mb-4 text-wm-text3">Live Fleet</h3>
        <Link
          href="/garage/add"
          className="flex items-center gap-2 border border-dashed border-wm-border bg-wm-s2 p-4 text-sm text-wm-text2 hover:bg-wm-s3"
        >
          <Icon name="add" size={18} className="text-wm-accent" />
          Add your first vehicle
        </Link>
      </section>
    );
  }

  return (
    <section className="border border-wm-border border-l-4 border-l-wm-accent-dark bg-wm-s1">
      <div className="flex items-center justify-between border-b border-wm-border px-5 py-3">
        <h3 className="label-technical text-wm-text3">Live Fleet</h3>
        <span className="label-technical text-wm-text3">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* Map first on mobile, right-hand column on desktop */}
        <div className="order-1 h-[300px] border-b border-wm-border md:order-2 md:h-[420px] md:border-b-0">
          {allPins.length > 0 ? (
            <MapErrorBoundary>
              <FleetMap
                pins={visiblePins}
                framePins={allPins}
                hoveredId={hoveredId}
                onHover={hoverFromMap}
                onSelect={selectFromMap}
              />
            </MapErrorBoundary>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-wm-s2 p-6 text-center">
              <Icon name="map" size={28} className="text-wm-text3" />
              <p className="label-technical text-wm-text3">
                {counts.devices === 0
                  ? "Link a WhereQube device to see your cars on the map"
                  : "No location reported yet"}
              </p>
            </div>
          )}
        </div>

        <div className="order-2 flex flex-col md:order-1 md:h-[420px] md:border-r md:border-wm-border">
          <div className="grid grid-cols-3 gap-px border-b border-wm-border bg-wm-border">
            {[
              { label: "Devices", value: counts.devices },
              { label: "Moving", value: counts.moving },
              { label: "Parked", value: counts.parked },
            ].map((s) => (
              <div key={s.label} className="bg-wm-s1 px-3 py-2 text-center">
                <p className="font-headline text-xl text-wm-text">{s.value}</p>
                <p className="label-technical text-wm-text3">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-wm-border px-3 py-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`label-technical rounded-sm border px-2 py-0.5 transition-colors ${
                  filter === f.value
                    ? "border-wm-gold bg-wm-accent-dark text-wm-gold"
                    : "border-wm-border text-wm-text3 hover:border-wm-accent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <ul className="flex-1 divide-y divide-wm-border overflow-y-auto">
            {visible.length === 0 ? (
              <li className="px-4 py-6 text-center label-technical text-wm-text3">No vehicles match this filter.</li>
            ) : (
              visible.map((v) => {
                const hovered = hoveredId === v.id;
                return (
                  <li key={v.id}>
                    <Link
                      ref={(el) => {
                        tileRefs.current[v.id] = el;
                      }}
                      href={`/garage/${v.id}/live`}
                      onMouseEnter={() => setHoveredId(v.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(v.id)}
                      onBlur={() => setHoveredId(null)}
                      className={`block border-l-4 px-4 py-3 transition-colors ${
                        hovered ? "border-l-wm-gold bg-wm-s2" : "border-l-transparent hover:bg-wm-s2"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-headline truncate text-base font-medium text-wm-text">{v.name}</p>
                        <FleetStatusChip status={v.status} />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <ConnectionDot status={v.status} />
                        <p className="truncate text-xs text-wm-text2">{v.telemetry?.address ?? "—"}</p>
                      </div>
                      {now !== null && showLastSeen(v) && (
                        <p className="mt-1 text-xs text-wm-text3">Last seen {formatLastSeen(v.telemetry?.last_contact, now)}</p>
                      )}
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
