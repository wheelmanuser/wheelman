import { STATUS_LABEL, type FleetStatus } from "@/lib/fleet-status";

const CHIP_CLASS: Record<FleetStatus, string> = {
  moving: "bg-wm-accent/20 text-wm-accent",
  parked: "bg-wm-gold/20 text-wm-gold",
  offline: "bg-wm-red/20 text-wm-red",
  no_device: "bg-wm-s3 text-wm-text3",
};

export function FleetStatusChip({ status }: { status: FleetStatus }) {
  return (
    <span className={`label-technical shrink-0 rounded-sm px-2 py-0.5 ${CHIP_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Green when the device is reporting, red when offline, grey when there is no device.
export function ConnectionDot({ status }: { status: FleetStatus }) {
  const color = status === "no_device" ? "bg-wm-text3" : status === "offline" ? "bg-wm-red" : "bg-wm-accent";
  const label = status === "no_device" ? "No device" : status === "offline" ? "Offline" : "Online";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} title={label} aria-label={label} />;
}
