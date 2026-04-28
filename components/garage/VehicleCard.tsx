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
      className="block rounded-xl border border-wm-border bg-gradient-to-br from-wm-s1 to-wm-s2 p-5 transition hover:border-wm-accent/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-wm-text">{title}</h3>
          <p className="mt-1 text-sm text-wm-text2">
            {vehicle.color ?? "Colour N/A"} ·{" "}
            {vehicle.transmission ?? vehicle.trim ?? "Transmission N/A"}
          </p>
        </div>
        <span
          className={
            hasDevice
              ? "rounded-full bg-wm-accent/20 px-2 py-1 text-xs text-wm-accent"
              : "rounded-full bg-wm-s3 px-2 py-1 text-xs text-wm-text2"
          }
        >
          {hasDevice ? "WhereQube Connected" : "No Device"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-wm-text2">
          Odometer:{" "}
          <span className="text-wm-text">
            {vehicle.odometer_miles?.toLocaleString() ?? "N/A"}
          </span>
        </p>
        {serviceDueSoon && (
          <span className="rounded-full bg-wm-orange/20 px-2 py-1 text-xs text-wm-orange">
            Service due soon
          </span>
        )}
      </div>
    </Link>
  );
}
