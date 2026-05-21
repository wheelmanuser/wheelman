"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { vehicleDisplayName } from "@/lib/vehicle-display";
import type { Vehicle } from "@/types/database";

type VehicleProp = Pick<Vehicle, "id" | "year" | "make" | "model" | "nickname">;

const METRICS = [
  { icon: "speed", label: "Live Speed", value: "— mph" },
  { icon: "local_gas_station", label: "Fuel Level", value: "—%" },
  { icon: "thermostat", label: "Engine Temp", value: "—°F" },
  { icon: "battery_charging_full", label: "Battery", value: "— V" },
  { icon: "route", label: "Odometer", value: "— mi" },
  { icon: "warning_amber", label: "DTC Codes", value: "—" },
];

export function TelematicsClient({ vehicles }: { vehicles: VehicleProp[] }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page header */}
      <header>
        <h2 className="font-headline text-2xl font-light tracking-wide text-wm-text">
          Fleet Telematics
        </h2>
        <p className="label-technical mt-1 text-wm-text3">Live Vehicle Intelligence</p>
      </header>

      {/* Coming in v2 banner */}
      <div className="border border-dashed border-wm-border bg-wm-s1 px-5 py-4">
        <div className="flex items-center gap-3">
          <Icon name="info" size={18} className="shrink-0 text-wm-accent" />
          <div>
            <span className="label-technical text-wm-accent">WhereQube Integration — Coming in v2</span>
            <p className="mt-0.5 text-xs text-wm-text3">
              Connect a plug-and-play OBD-II adapter for real-time data, GPS tracking, and vehicle health diagnostics.
            </p>
          </div>
        </div>
      </div>

      {/* Fleet status bar */}
      <div className="grid grid-cols-3 gap-px bg-wm-border">
        {[
          { label: "Total Vehicles", value: vehicles.length, icon: "directions_car" },
          { label: "Connected", value: 0, icon: "sensors", dim: true },
          { label: "Active Alerts", value: 0, icon: "warning_amber", dim: true },
        ].map(({ label, value, icon, dim }) => (
          <div key={label} className="flex items-center gap-3 bg-wm-s1 px-5 py-4">
            <Icon name={icon} size={20} className={dim ? "text-wm-text3" : "text-wm-accent"} />
            <div>
              <p className={`font-headline text-2xl font-light ${dim ? "text-wm-text3" : "text-wm-text"}`}>
                {value}
              </p>
              <p className="label-technical text-wm-text3">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-vehicle cards */}
      {vehicles.length === 0 ? (
        <div className="border border-dashed border-wm-border bg-wm-s1 p-8 text-center">
          <p className="text-sm text-wm-text2">No vehicles in your garage yet.</p>
          <Link
            href="/garage/add"
            className="label-technical mt-4 inline-flex border border-wm-accent px-4 py-2 text-wm-accent hover:bg-wm-accent hover:text-wm-bg transition-colors"
          >
            Add a Vehicle
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="carbon-texture border border-l-4 border-wm-border border-l-wm-accent bg-wm-s1"
            >
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-wm-border px-5 py-4">
                <div>
                  <Link
                    href={`/garage/${vehicle.id}`}
                    className="font-headline text-lg font-semibold text-wm-text hover:text-wm-accent"
                  >
                    {vehicleDisplayName(vehicle)}
                  </Link>
                </div>
                <span className="label-technical rounded-sm border border-wm-border px-2 py-1 text-wm-text3">
                  WhereQube Not Connected
                </span>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-px bg-wm-border sm:grid-cols-3">
                {METRICS.map(({ icon, label, value }) => (
                  <div key={label} className="bg-wm-s1 px-4 py-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Icon name={icon} size={14} className="text-wm-accent" />
                      <span className="label-technical text-wm-text3">{label}</span>
                    </div>
                    <span className="font-headline text-lg text-wm-text3">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
