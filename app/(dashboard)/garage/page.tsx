"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VehicleCard } from "@/components/garage/VehicleCard";
import { useVehicleStore } from "@/stores/vehicleStore";

type FilterMode = "all" | "due";

export default function GaragePage() {
  const supabase = createClient();
  const { vehicles, fetchVehicles } = useVehicleStore();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dueVehicleIds, setDueVehicleIds] = useState<Set<string>>(new Set());
  const [deviceVehicleIds, setDeviceVehicleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        await fetchVehicles();

        const db = supabase as unknown as {
          from: (
            table: "telematics_devices" | "vw_service_reminders",
          ) => {
            select: (fields: string) => {
              eq?: (
                column: string,
                value: boolean,
              ) => Promise<{ data: Array<{ vehicle_id: string }> | null }>;
              lte?: (
                column: string,
                value: number,
              ) => Promise<{ data: Array<{ vehicle_id: string }> | null }>;
            };
          };
        };

        const [devicesResult, dueResult] = await Promise.all([
          db.from("telematics_devices").select("vehicle_id").eq?.("is_active", true),
          db
            .from("vw_service_reminders")
            .select("vehicle_id,pct_remaining")
            .lte?.("pct_remaining", 10),
        ]);
        const devices = devicesResult?.data ?? [];
        const dueSchedules = dueResult?.data ?? [];

        setDeviceVehicleIds(new Set((devices ?? []).map((d) => d.vehicle_id)));
        setDueVehicleIds(new Set((dueSchedules ?? []).map((d) => d.vehicle_id)));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load garage.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [fetchVehicles, supabase]);

  const filteredVehicles = useMemo(() => {
    if (filter === "all") return vehicles;
    return vehicles.filter((v) => dueVehicleIds.has(v.id));
  }, [filter, vehicles, dueVehicleIds]);

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
      ) : filteredVehicles.length === 0 ? (
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
          {filteredVehicles.map((vehicle) => (
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
