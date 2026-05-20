"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VehicleCard } from "@/components/garage/VehicleCard";
import { useVehicleStore } from "@/stores/vehicleStore";
import { enrichSchedules, type ScheduleWithPct } from "@/lib/service-schedule-display";
import type { Vehicle } from "@/types/database";

type FilterMode = "all" | "due";
type VehicleReminders = { vehicle: Vehicle; schedules: ScheduleWithPct[] };

function formatNextDue(s: ScheduleWithPct) {
  const parts: string[] = [];
  if (s.computed_next_due_miles != null)
    parts.push(`${s.computed_next_due_miles.toLocaleString()} mi`);
  if (s.computed_next_due_date != null) {
    const d = new Date(s.computed_next_due_date);
    parts.push(d.toLocaleDateString("en-US", { month: "short", year: "numeric" }));
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default function GaragePage() {
  const supabase = createClient();
  const { vehicles, fetchVehicles } = useVehicleStore();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceVehicleIds, setDeviceVehicleIds] = useState<Set<string>>(new Set());
  const [dueReminders, setDueReminders] = useState<VehicleReminders[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const { data: devices } = await supabase
          .from("telematics_devices")
          .select("vehicle_id")
          .eq("is_active", true);
        setDeviceVehicleIds(new Set((devices ?? []).map((d) => d.vehicle_id)));
        await fetchVehicles();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load garage.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (vehicles.length === 0) {
      setDueReminders([]);
      return;
    }
    const vehicleIds = vehicles.map((v) => v.id);
    supabase
      .from("service_schedules")
      .select("*")
      .in("vehicle_id", vehicleIds)
      .eq("is_active", true)
      .then(({ data }) => {
        if (!data) return;
        const grouped: VehicleReminders[] = [];
        for (const vehicle of vehicles) {
          const raw = data.filter((s) => s.vehicle_id === vehicle.id);
          const enriched = enrichSchedules(vehicle, raw);
          const due = enriched.filter(
            (s) => s.is_overdue || (s.pct_remaining != null && s.pct_remaining <= 30),
          );
          if (due.length > 0) grouped.push({ vehicle, schedules: due });
        }
        setDueReminders(grouped);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  const dueVehicleIds = useMemo(
    () => new Set(dueReminders.map((r) => r.vehicle.id)),
    [dueReminders],
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-wm-text">My Garage</h2>
          <p className="mt-1 text-sm text-wm-text2">{vehicles.length} vehicle(s)</p>
        </div>
        <Link
          href="/garage/add"
          className="inline-flex items-center gap-2 rounded-md bg-wm-accent px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Add Vehicle
        </Link>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1.5 text-xs ${
            filter === "all"
              ? "bg-wm-accent text-white"
              : "bg-wm-s2 text-wm-text2 hover:text-wm-text"
          }`}
        >
          All Vehicles
        </button>
        <button
          type="button"
          onClick={() => setFilter("due")}
          className={`rounded-full px-3 py-1.5 text-xs ${
            filter === "due"
              ? "bg-wm-orange text-wm-bg"
              : "bg-wm-s2 text-wm-text2 hover:text-wm-text"
          }`}
        >
          Service Due
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-wm-text2">Loading vehicles...</p>
      ) : filter === "due" ? (
        dueReminders.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-wm-border bg-wm-s1 p-8 text-center">
            <p className="text-sm font-medium text-wm-text">All services are up to date</p>
            <p className="mt-1 text-xs text-wm-text2">No reminders are due or overdue across your vehicles.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {dueReminders.map(({ vehicle, schedules }) => (
              <section key={vehicle.id}>
                <Link
                  href={`/garage/${vehicle.id}`}
                  className="mb-3 block text-sm font-semibold text-wm-text hover:text-wm-accent"
                >
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </Link>
                <ul className="space-y-2">
                  {schedules.map((s) => (
                    <li
                      key={s.id}
                      className={`rounded-lg border bg-wm-s1 px-4 py-3 text-sm ${s.is_overdue ? "border-wm-red/40" : "border-wm-border"}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-wm-text">{s.service_name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.is_overdue
                            ? "bg-wm-red/20 text-wm-red"
                            : "bg-wm-orange/20 text-wm-orange"
                        }`}>
                          {s.is_overdue ? "Overdue" : "Due soon"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-wm-text2">
                        Next due: {formatNextDue(s)}
                      </p>
                      {s.miles_remaining != null && (
                        <p className="mt-0.5 text-xs text-wm-text2">
                          Miles remaining:{" "}
                          <span className={s.is_overdue ? "text-wm-red" : "text-wm-orange"}>
                            {Math.round(s.miles_remaining).toLocaleString()}
                          </span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : vehicles.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-wm-border bg-wm-s1 p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-wm-s2" />
          <p className="mt-4 text-sm text-wm-text2">No vehicles yet.</p>
          <Link
            href="/garage/add"
            className="mt-4 inline-flex rounded-md bg-wm-accent px-3 py-2 text-sm font-medium text-white"
          >
            Add your first vehicle
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              hasDevice={deviceVehicleIds.has(vehicle.id)}
              serviceDueSoon={dueVehicleIds.has(vehicle.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
