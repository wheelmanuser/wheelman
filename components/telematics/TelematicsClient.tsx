"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { CheckEngineStatus } from "@/components/telematics/CheckEngineStatus";
import { useCheckEngine } from "@/components/telematics/useCheckEngine";
import { vehicleDisplayName } from "@/lib/vehicle-display";
import { formatDistance } from "@/lib/format-distance";
import { formatDeviceBattery, formatFuelLevel, formatMpg, formatVolts } from "@/lib/telemetry-display";
import { useUserSettings } from "@/contexts/UserSettingsContext";
import type { Vehicle, VehicleDevice, VehicleTelemetry } from "@/types/database";

type VehicleProp = Pick<Vehicle, "id" | "year" | "make" | "model" | "nickname">;

type Props = {
  vehicles: VehicleProp[];
  telemetryMap: Record<string, VehicleTelemetry | null>;
  deviceMap: Record<string, VehicleDevice | null>;
};

export function TelematicsClient({ vehicles, telemetryMap, deviceMap }: Props) {
  const router = useRouter();
  const { settings } = useUserSettings();
  const distanceUnit = settings.distance_unit ?? "miles";

  const connectedCount = vehicles.filter((v) => deviceMap[v.id] !== null).length;
  const onlineCount = vehicles.filter((v) => telemetryMap[v.id]?.is_online === true).length;
  const { results: checkEngineResults } = useCheckEngine(
    vehicles.filter((v) => deviceMap[v.id] !== null).map((v) => v.id),
  );
  const alertsCount = vehicles.filter((v) => {
    const state = checkEngineResults[v.id];
    return state?.status === "ok" && state.milOn;
  }).length;
  const allDisconnected = vehicles.length > 0 && vehicles.every((v) => deviceMap[v.id] === null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-headline text-2xl font-light tracking-wide text-wm-text">
            Fleet Telematics
          </h2>
          <p className="label-technical mt-1 text-wm-text3">Live Vehicle Intelligence</p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="label-technical border border-wm-accent px-4 py-2 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg"
        >
          Refresh All
        </button>
      </header>

      {allDisconnected && (
        <div className="label-technical border border-dashed border-wm-border p-6 text-center text-wm-text3">
          No devices linked yet — go to a vehicle&apos;s Telematics tab to link a WhereQube device.
        </div>
      )}

      {/* Fleet status bar */}
      <div className="grid grid-cols-2 gap-px bg-wm-border sm:grid-cols-4">
        {[
          { label: "Total Vehicles", value: vehicles.length, icon: "directions_car", active: true },
          { label: "Connected", value: connectedCount, icon: "sensors", active: connectedCount > 0 },
          { label: "Online Now", value: onlineCount, icon: "wifi", active: onlineCount > 0 },
          {
            label: "Active Alerts",
            value: alertsCount,
            icon: "warning_amber",
            active: alertsCount > 0,
            alert: alertsCount > 0,
          },
        ].map(({ label, value, icon, active, alert }) => (
          <div key={label} className="flex items-center gap-3 bg-wm-s1 px-5 py-4">
            <Icon name={icon} size={20} className={alert ? "text-wm-red" : active ? "text-wm-accent" : "text-wm-text3"} />
            <div>
              <p
                className={`font-headline text-2xl font-light ${
                  alert ? "text-wm-red" : active ? "text-wm-text" : "text-wm-text3"
                }`}
              >
                {value}
              </p>
              <p className="label-technical text-wm-text3">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="label-technical text-wm-text3">
        Page refreshed: {new Date().toLocaleTimeString()}
      </p>

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
          {vehicles.map((vehicle) => {
            const device = deviceMap[vehicle.id];
            const telemetry = telemetryMap[vehicle.id];
            const metrics: { icon: string; label: string; value: string; sub?: string | null }[] = [
              {
                icon: "speed",
                label: "Live Speed",
                value: telemetry?.speed != null ? `${formatDistance(telemetry.speed, distanceUnit)}/h` : "—",
              },
              { icon: "local_gas_station", label: "Fuel Level", value: formatFuelLevel(telemetry?.fuel_level_pct) },
              {
                icon: "battery_charging_full",
                label: "Battery",
                value: formatVolts(telemetry?.input_voltage),
                sub: formatDeviceBattery(telemetry?.device_battery_pct),
              },
              { icon: "route", label: "Odometer", value: formatDistance(telemetry?.odometer_miles, distanceUnit) },
              { icon: "eco", label: "Fuel Economy", value: formatMpg(telemetry?.fuel_economy_mpg) },
            ];

            return (
              <div
                key={vehicle.id}
                className="carbon-texture border border-l-4 border-wm-border border-l-wm-accent bg-wm-s1"
              >
                {/* Card header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wm-border px-5 py-4">
                  <div>
                    <Link
                      href={`/garage/${vehicle.id}`}
                      className="font-headline text-lg font-semibold text-wm-text hover:text-wm-accent"
                    >
                      {vehicleDisplayName(vehicle)}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          telemetry?.is_online === true
                            ? "bg-wm-accent"
                            : telemetry?.is_online === false
                            ? "bg-wm-red"
                            : "bg-wm-text3"
                        }`}
                      />
                      <span className="label-technical text-wm-text3">
                        {telemetry?.is_online === true ? "Online" : telemetry?.is_online === false ? "Offline" : "No Data"}
                      </span>
                      <span className="text-xs text-wm-text3">
                        · Last seen: {telemetry?.last_contact ? new Date(telemetry.last_contact).toLocaleString() : "Never"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`label-technical rounded-sm border px-2 py-1 ${
                      device ? "border-wm-accent text-wm-accent" : "border-wm-s3 text-wm-text3"
                    }`}
                  >
                    {device ? "Connected" : "No Device"}
                  </span>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 gap-px bg-wm-border sm:grid-cols-3">
                  {metrics.map(({ icon, label, value, sub }) => (
                    <div key={label} className="bg-wm-s1 px-4 py-3">
                      <div className="mb-1 flex items-center gap-2">
                        <Icon name={icon} size={14} className="text-wm-accent" />
                        <span className="label-technical text-wm-text3">{label}</span>
                      </div>
                      <span className="font-headline text-lg text-wm-text3">{value}</span>
                      {sub && <p className="mt-0.5 text-xs text-wm-text3">{sub}</p>}
                    </div>
                  ))}
                  <div className="bg-wm-s1 px-4 py-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Icon name="warning_amber" size={14} className="text-wm-accent" />
                      <span className="label-technical text-wm-text3">Check Engine</span>
                    </div>
                    <CheckEngineStatus state={checkEngineResults[vehicle.id]} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
