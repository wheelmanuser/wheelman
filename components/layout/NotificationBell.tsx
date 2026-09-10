"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { vehicleDisplayName } from "@/lib/vehicle-display";

type DueReminder = {
  id: string;
  vehicle_id: string;
  service_name: string;
  vehicle_name: string;
  is_overdue: boolean;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<DueReminder[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReminders = async () => {
      const supabase = createClient();
      const { data: vehicles } = await supabase
        .from("vehicles")
        .select("id,year,make,model,nickname,odometer_miles");

      if (!vehicles?.length) return;

      const vehicleIds = vehicles.map((v) => v.id);
      const { data: schedules } = await supabase
        .from("service_schedules")
        .select("*")
        .in("vehicle_id", vehicleIds)
        .eq("is_active", true);

      if (!schedules?.length) return;

      const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
      const today = new Date();
      const due: DueReminder[] = [];

      for (const s of schedules) {
        const vehicle = vehicleMap.get(s.vehicle_id);
        if (!vehicle) continue;

        const odometer = vehicle.odometer_miles != null ? Number(vehicle.odometer_miles) : null;
        const lastMiles = s.last_performed_miles != null ? Number(s.last_performed_miles) : null;
        const intervalMiles = s.interval_miles != null ? Number(s.interval_miles) : null;
        const intervalMonths = s.interval_months != null ? Number(s.interval_months) : null;
        const isRecurring = s.is_recurring !== false;

        let pct_remaining: number | null = null;
        let is_overdue = false;

        if (isRecurring) {
          if (lastMiles != null && intervalMiles != null && odometer != null) {
            const milesRemaining = lastMiles + intervalMiles - odometer;
            is_overdue = milesRemaining < 0;
            pct_remaining = (milesRemaining / intervalMiles) * 100;
          } else if (s.last_performed_date != null && intervalMonths != null) {
            const lastDate = new Date(s.last_performed_date);
            lastDate.setMonth(lastDate.getMonth() + intervalMonths);
            is_overdue = lastDate < today;
            const daysUntil = (lastDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
            pct_remaining = is_overdue ? 0 : Math.min(100, (daysUntil / 30) * 100);
          }
        } else {
          if (s.due_miles != null && odometer != null) {
            const milesRemaining = Number(s.due_miles) - odometer;
            is_overdue = milesRemaining < 0;
            pct_remaining = is_overdue ? 0 : Math.min(100, (milesRemaining / 500) * 100);
          } else if (s.due_date != null) {
            const dueDate = new Date(s.due_date);
            is_overdue = dueDate < today;
            const daysUntil = (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
            pct_remaining = is_overdue ? 0 : Math.min(100, (daysUntil / 30) * 100);
          }
        }

        if (is_overdue || (pct_remaining != null && pct_remaining <= 30)) {
          due.push({
            id: s.id,
            vehicle_id: s.vehicle_id,
            service_name: s.service_name,
            vehicle_name: vehicleDisplayName(vehicle),
            is_overdue,
          });
        }
      }

      due.sort((a, b) => (a.is_overdue === b.is_overdue ? 0 : a.is_overdue ? -1 : 1));
      setReminders(due);
    };

    void fetchReminders();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const count = reminders.length;
  const shown = reminders.slice(0, 5);

  return (
    <div ref={ref} className="relative">
      <div
        className="relative cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-label="Notifications"
      >
        <Icon
          name="notifications"
          size={28}
          className="text-wm-text2 transition-colors hover:text-wm-text"
        />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-wm-red text-[10px] font-bold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 border border-wm-border bg-wm-s1 shadow-xl">
          <div className="border-b border-wm-border px-4 py-2">
            <span className="label-technical text-wm-text3">
              {count === 0
                ? "No reminders due"
                : `${count} reminder${count === 1 ? "" : "s"} due`}
            </span>
          </div>

          {shown.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-wm-text2">
              All services are up to date
            </div>
          ) : (
            <ul className="divide-y divide-wm-border">
              {shown.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/garage/${r.vehicle_id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-wm-s2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="label-technical text-wm-text3">{r.vehicle_name}</p>
                      <p className="font-medium text-wm-text">{r.service_name}</p>
                    </div>
                    <span
                      className={`label-technical ml-2 shrink-0 rounded-sm px-2 py-0.5 ${
                        r.is_overdue
                          ? "bg-wm-red/20 text-wm-red"
                          : "bg-wm-gold/20 text-wm-gold"
                      }`}
                    >
                      {r.is_overdue ? "Overdue" : "Due Soon"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-wm-border px-4 py-2">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="label-technical text-wm-accent hover:text-wm-text"
            >
              View All →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
