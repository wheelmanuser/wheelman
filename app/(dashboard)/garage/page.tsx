"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VehicleCard } from "@/components/garage/VehicleCard";
import { useVehicleStore } from "@/stores/vehicleStore";
import type { ScheduleWithPct } from "@/lib/service-schedule-display";
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
        const today = new Date();
        const grouped: VehicleReminders[] = [];

        for (const vehicle of vehicles) {
          const vehicleSchedules = data.filter((s) => s.vehicle_id === vehicle.id);
          const odometer = vehicle.odometer_miles != null ? Number(vehicle.odometer_miles) : null;
          const due: ScheduleWithPct[] = [];

          for (const s of vehicleSchedules) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const raw = s as any;
            const lastMiles = s.last_performed_miles != null ? Number(s.last_performed_miles) : null;
            const intervalMiles = s.interval_miles != null ? Number(s.interval_miles) : null;
            const intervalMonths = s.interval_months != null ? Number(s.interval_months) : null;

            let miles_remaining: number | null = null;
            let pct_remaining: number | null = null;
            let computed_next_due_miles: number | null = null;
            let computed_next_due_date: string | null = null;
            let is_overdue = false;

            if (lastMiles != null && intervalMiles != null && odometer != null) {
              computed_next_due_miles = lastMiles + intervalMiles;
              miles_remaining = computed_next_due_miles - odometer;
              is_overdue = miles_remaining < 0;
              pct_remaining = (miles_remaining / intervalMiles) * 100;
            } else if (s.last_performed_date != null && intervalMonths != null) {
              const lastDate = new Date(s.last_performed_date);
              lastDate.setMonth(lastDate.getMonth() + intervalMonths);
              computed_next_due_date = lastDate.toISOString().split("T")[0];
              is_overdue = lastDate < today;
              const daysUntil = (lastDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
              pct_remaining = is_overdue ? 0 : Math.min(100, (daysUntil / 30) * 100);
            } else if (raw.due_miles != null && odometer != null) {
              computed_next_due_miles = Number(raw.due_miles);
              miles_remaining = computed_next_due_miles - odometer;
              is_overdue = miles_remaining < 0;
              pct_remaining = is_overdue ? 0 : Math.min(100, (miles_remaining / 500) * 100);
            } else if (raw.due_date != null) {
              computed_next_due_date = raw.due_date;
              const dueDate = new Date(raw.due_date);
              is_overdue = dueDate < today;
              const daysUntil = (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
              pct_remaining = is_overdue ? 0 : Math.min(100, (daysUntil / 30) * 100);
            }

            console.log("[ServiceDue]", s.service_name, {
              vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
              lastMiles,
              intervalMiles,
              odometer,
              computed_next_due_miles,
              miles_remaining,
              pct_remaining,
              is_overdue,
            });

            if (is_overdue || (pct_remaining != null && pct_remaining <= 30)) {
              due.push({
                ...s,
                miles_remaining,
                pct_remaining,
                computed_next_due_miles,
                computed_next_due_date,
                is_overdue,
              });
            }
          }

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
