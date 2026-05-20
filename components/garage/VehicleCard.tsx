"use client";

import Link from "next/link";
import type { Vehicle } from "@/types/database";

type VehicleCardProps = {
  vehicle: Vehicle;
  hasDevice: boolean;
  serviceDueSoon: boolean;
};

export function VehicleCard({
  vehicle,
  hasDevice,
  serviceDueSoon,
}: VehicleCardProps) {
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  return (
    <Link
      href={`/garage/${vehicle.id}`}
      className="block border border-wm-border border-l-2 border-l-wm-accent/40 bg-gradient-to-br from-wm-s1 to-wm-s2 p-5 transition-colors hover:border-wm-accent/60 hover:border-l-wm-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-light tracking-wide text-wm-text">{title}</h3>
          <p className="mt-1 text-xs uppercase tracking-wider text-wm-text3">
            {vehicle.color ?? "Colour N/A"} ·{" "}
            {vehicle.transmission ?? vehicle.trim ?? "Transmission N/A"}
          </p>
        </div>
        <span
          className={
            hasDevice
              ? "border border-wm-accent/30 px-2 py-0.5 text-xs uppercase tracking-widest text-wm-accent"
              : "border border-wm-border px-2 py-0.5 text-xs uppercase tracking-widest text-wm-text3"
          }
        >
          {hasDevice ? "WhereQube Connected" : "No Device"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-wm-text3">
          <span className="uppercase tracking-widest">Odometer</span>{" "}
          <span className="text-wm-text2">
            {vehicle.odometer_miles != null ? `${vehicle.odometer_miles.toLocaleString()} mi` : "—"}
          </span>
        </p>
        {serviceDueSoon && (
          <span className="border border-wm-orange/40 px-2 py-0.5 text-xs uppercase tracking-widest text-wm-orange">
            Service Due
          </span>
        )}
      </div>
    </Link>
  );
}
