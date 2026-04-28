import type { ServiceSchedule, Vehicle } from "@/types/database";

export type ScheduleWithPct = ServiceSchedule & {
  pct_remaining: number | null;
  miles_remaining: number | null;
};

export function enrichSchedules(
  vehicle: Pick<Vehicle, "odometer_miles">,
  schedules: ServiceSchedule[],
): ScheduleWithPct[] {
  const odometer = vehicle.odometer_miles != null ? Number(vehicle.odometer_miles) : null;

  return schedules.map((s) => {
    const next = s.next_due_miles != null ? Number(s.next_due_miles) : null;
    const last = s.last_performed_miles != null ? Number(s.last_performed_miles) : null;

    let miles_remaining: number | null = null;
    let pct_remaining: number | null = null;

    if (next != null && odometer != null) {
      miles_remaining = next - odometer;
    }
    if (
      next != null &&
      odometer != null &&
      last != null &&
      next - last !== 0
    ) {
      pct_remaining = ((next - odometer) / (next - last)) * 100;
    }

    return { ...s, miles_remaining, pct_remaining };
  });
}

export function statusToneClass(pct: number | null): string {
  if (pct == null || Number.isNaN(pct)) return "text-wm-text2";
  if (pct <= 10) return "text-wm-red";
  if (pct <= 30) return "text-wm-orange";
  return "text-wm-green";
}
