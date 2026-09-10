import type { ServiceSchedule, Vehicle } from "@/types/database";

export type ScheduleWithPct = ServiceSchedule & {
  pct_remaining: number | null;
  miles_remaining: number | null;
  computed_next_due_miles: number | null;
  computed_next_due_date: string | null;
  is_overdue: boolean;
};

export function enrichSchedules(
  vehicle: Pick<Vehicle, "odometer_miles">,
  schedules: ServiceSchedule[],
): ScheduleWithPct[] {
  const odometer = vehicle.odometer_miles != null ? Number(vehicle.odometer_miles) : null;
  const today = new Date();

  return schedules.map((s) => {
    const isRecurring = s.is_recurring !== false;
    const lastMiles = s.last_performed_miles != null ? Number(s.last_performed_miles) : null;
    const intervalMiles = s.interval_miles != null ? Number(s.interval_miles) : null;
    const intervalMonths = s.interval_months != null ? Number(s.interval_months) : null;

    let computed_next_due_miles: number | null = null;
    let computed_next_due_date: string | null = null;
    let miles_remaining: number | null = null;
    let pct_remaining: number | null = null;
    let is_overdue = false;

    if (isRecurring) {
      if (lastMiles != null && intervalMiles != null) {
        computed_next_due_miles = lastMiles + intervalMiles;
      }
      if (s.last_performed_date != null && intervalMonths != null) {
        const lastDate = new Date(s.last_performed_date);
        lastDate.setMonth(lastDate.getMonth() + intervalMonths);
        computed_next_due_date = lastDate.toISOString().split("T")[0];
      }
      if (computed_next_due_miles != null && odometer != null) {
        miles_remaining = computed_next_due_miles - odometer;
        is_overdue = miles_remaining < 0;
        if (lastMiles != null) {
          const interval = computed_next_due_miles - lastMiles;
          if (interval !== 0) {
            pct_remaining = (miles_remaining / interval) * 100;
          }
        }
      }
      if (computed_next_due_date != null && miles_remaining == null) {
        const dueDate = new Date(computed_next_due_date);
        is_overdue = dueDate < today;
        const daysUntil = (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        pct_remaining = is_overdue ? 0 : Math.min(100, (daysUntil / 30) * 100);
      }
    } else {
      if (s.due_miles != null) {
        computed_next_due_miles = Number(s.due_miles);
        if (odometer != null) {
          miles_remaining = computed_next_due_miles - odometer;
          is_overdue = miles_remaining < 0;
          pct_remaining = is_overdue ? 0 : Math.min(100, (miles_remaining / 500) * 100);
        }
      }
      if (s.due_date != null) {
        computed_next_due_date = s.due_date;
        const dueDate = new Date(s.due_date);
        is_overdue = dueDate < today;
        if (miles_remaining == null) {
          const daysUntil = (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
          pct_remaining = is_overdue ? 0 : Math.min(100, (daysUntil / 30) * 100);
        }
      }
    }

    return {
      ...s,
      miles_remaining,
      pct_remaining,
      computed_next_due_miles,
      computed_next_due_date,
      is_overdue,
    };
  });
}

export function statusToneClass(pct: number | null, isOverdue = false): string {
  if (isOverdue) return "text-wm-red";
  if (pct == null || Number.isNaN(pct)) return "text-wm-text2";
  if (pct <= 10) return "text-wm-red";
  if (pct <= 30) return "text-wm-orange";
  return "text-wm-green";
}