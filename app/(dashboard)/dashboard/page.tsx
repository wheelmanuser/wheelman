import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

type VehicleRow = {
  id: string;
  year: number;
  make: string;
  model: string;
  odometer_miles: number | null;
  is_primary: boolean;
};

type LogbookRow = {
  id: string;
  vehicle_id: string;
  title: string;
  event_date: string;
  total_cost: number | null;
  category: "maintenance" | "modification" | "other";
};


type DueReminder = {
  id: string;
  vehicle_id: string;
  service_name: string;
  vehicle: { year: number; make: string; model: string };
  miles_remaining: number | null;
  pct_remaining: number | null;
  is_overdue: boolean;
};

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}


function SectionSkeleton() {
  return (
    <div className="border border-wm-border bg-wm-s1 p-5">
      <div className="h-4 w-40 animate-pulse bg-wm-s3" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full animate-pulse bg-wm-s3" />
        <div className="h-3 w-4/5 animate-pulse bg-wm-s3" />
        <div className="h-3 w-2/3 animate-pulse bg-wm-s3" />
      </div>
    </div>
  );
}

async function GreetingHeader() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let displayName = user?.email?.split("@")[0] ?? "Driver";

  if (user) {
    const profileQuery = (supabase as unknown as {
      from: (
        table: "users",
      ) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{
              data: { display_name?: string | null } | null;
            }>;
          };
        };
      };
    })
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const { data: profile } = await profileQuery;
    displayName = profile?.display_name ?? displayName;
  }

  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-headline text-4xl font-light tracking-wide text-wm-text">
          {greetingForNow()}, {displayName}
        </h2>
        <p className="mt-2 text-sm text-wm-text3">
          Start where you left off in your Wheelman workspace.
        </p>
      </div>
      <button
        type="button"
        className="rounded-sm border border-wm-border bg-wm-s1 p-2 text-wm-text2"
        aria-label="Notifications"
      >
        <Icon name="notifications" size={20} />
      </button>
    </header>
  );
}

async function GarageSection() {
  const supabase = createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id,year,make,model,odometer_miles,is_primary")
    .order("created_at", { ascending: false });
  const vehicles = (data ?? []) as VehicleRow[];
  const shown = vehicles.slice(0, 3);

  return (
    <section className="border border-wm-border border-l-4 border-l-wm-accent-dark bg-wm-s1 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="label-technical text-wm-text3">Your Garage</h3>
        {vehicles.length > 3 && (
          <Link href="/garage" className="label-technical text-wm-accent hover:text-wm-text">
            View all →
          </Link>
        )}
      </div>
      {shown.length === 0 ? (
        <Link
          href="/garage/add"
          className="block border border-dashed border-wm-border bg-wm-s2 p-4 text-sm text-wm-text2 hover:bg-wm-s3"
        >
          Add your first vehicle
        </Link>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {shown.map((v) => (
            <Link
              key={v.id}
              href={`/garage/${v.id}`}
              className="border border-wm-border border-l-2 border-l-wm-accent-dark bg-wm-s2 p-3 transition-colors hover:border-l-wm-gold"
            >
              <p className="font-headline text-sm font-medium text-wm-text">
                {v.year} {v.make} {v.model}
              </p>
              <p className="mt-1 text-xs text-wm-text2">
                {v.odometer_miles != null ? `${Math.round(v.odometer_miles)} mi` : "Odometer —"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

async function RecentActivitySection() {
  const supabase = createClient();
  const { data } = await supabase
    .from("logbook_entries")
    .select("id,vehicle_id,title,event_date,total_cost,category")
    .order("event_date", { ascending: false })
    .limit(3);
  const entries = (data ?? []) as LogbookRow[];

  const vehicleIds = Array.from(new Set(entries.map((e) => e.vehicle_id)));
  const vehicleMap = new Map<string, string>();
  if (vehicleIds.length > 0) {
    const vehiclesQuery = (supabase as unknown as {
      from: (
        table: "vehicles",
      ) => {
        select: (columns: string) => {
          in: (column: string, ids: string[]) => Promise<{
            data: Array<{ id: string; year: number; make: string; model: string }> | null;
          }>;
        };
      };
    })
      .from("vehicles")
      .select("id,year,make,model")
      .in("id", vehicleIds);
    const { data: vehicles } = await vehiclesQuery;
    for (const v of vehicles ?? []) {
      vehicleMap.set(v.id, `${v.year} ${v.make} ${v.model}`);
    }
  }

  return (
    <section className="border border-wm-border border-l-4 border-l-wm-accent-dark bg-wm-s1 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="label-technical text-wm-text3">Recent Logbook Activity</h3>
        <Link href="/garage" className="label-technical text-wm-accent hover:text-wm-text">
          View full logbook →
        </Link>
      </div>
      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-wm-text2">No logbook entries yet.</p>
        ) : (
          entries.map((e) => (
            <Link
              key={e.id}
              href={`/garage/${e.vehicle_id}/logbook`}
              className="flex items-center justify-between border border-wm-border border-l-4 border-l-wm-accent-dark bg-wm-s2 px-3 py-2 transition-colors hover:border-l-wm-gold"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-wm-text">
                  {vehicleMap.get(e.vehicle_id) ?? "Vehicle"} · {e.title}
                </p>
                <p className="label-technical mt-0.5 text-wm-text3">
                  {e.event_date} · {e.category}
                </p>
              </div>
              <p className="ml-3 text-sm font-medium text-wm-gold">${Number(e.total_cost ?? 0).toFixed(2)}</p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

async function ServiceRemindersSection() {
  const supabase = createClient();
  const today = new Date();

  const { data: vehicleData } = await supabase
    .from("vehicles")
    .select("id,year,make,model,odometer_miles");
  const vehicles = (vehicleData ?? []) as VehicleRow[];
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  const due: DueReminder[] = [];

  if (vehicles.length > 0) {
    const vehicleIds = vehicles.map((v) => v.id);
    const { data: scheduleData } = await supabase
      .from("service_schedules")
      .select("*")
      .in("vehicle_id", vehicleIds)
      .eq("is_active", true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schedules = (scheduleData ?? []) as any[];

    for (const s of schedules) {
      const vehicle = vehicleMap.get(s.vehicle_id);
      if (!vehicle) continue;

      const odometer = vehicle.odometer_miles != null ? Number(vehicle.odometer_miles) : null;
      const lastMiles = s.last_performed_miles != null ? Number(s.last_performed_miles) : null;
      const intervalMiles = s.interval_miles != null ? Number(s.interval_miles) : null;
      const intervalMonths = s.interval_months != null ? Number(s.interval_months) : null;
      const isRecurring = s.is_recurring !== false;

      let miles_remaining: number | null = null;
      let pct_remaining: number | null = null;
      let is_overdue = false;

      if (isRecurring) {
        if (lastMiles != null && intervalMiles != null && odometer != null) {
          const next_due_miles = lastMiles + intervalMiles;
          miles_remaining = next_due_miles - odometer;
          is_overdue = miles_remaining < 0;
          pct_remaining = (miles_remaining / intervalMiles) * 100;
        } else if (s.last_performed_date != null && intervalMonths != null) {
          const lastDate = new Date(s.last_performed_date);
          lastDate.setMonth(lastDate.getMonth() + intervalMonths);
          is_overdue = lastDate < today;
          const daysUntil = (lastDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
          pct_remaining = is_overdue ? 0 : Math.min(100, (daysUntil / 30) * 100);
        }
      } else {
        if (s.due_miles != null && odometer != null) {
          miles_remaining = Number(s.due_miles) - odometer;
          is_overdue = miles_remaining < 0;
          pct_remaining = is_overdue ? 0 : Math.min(100, (miles_remaining / 500) * 100);
        } else if (s.due_date != null) {
          const dueDate = new Date(s.due_date);
          is_overdue = dueDate < today;
          const daysUntil = (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
          pct_remaining = is_overdue ? 0 : Math.min(100, (daysUntil / 30) * 100);
        }
      }

      console.log("[ServiceReminders]", s.service_name, {
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        isRecurring,
        lastMiles,
        intervalMiles,
        odometer,
        due_miles: s.due_miles,
        due_date: s.due_date,
        miles_remaining,
        pct_remaining,
        is_overdue,
      });

      if (is_overdue || (pct_remaining != null && pct_remaining <= 30)) {
        due.push({
          id: s.id,
          vehicle_id: s.vehicle_id,
          service_name: s.service_name,
          vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model },
          miles_remaining,
          pct_remaining,
          is_overdue,
        });
      }
    }
  }

  due.sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
    return (a.pct_remaining ?? 0) - (b.pct_remaining ?? 0);
  });

  const shown = due.slice(0, 5);

  return (
    <section className="border border-wm-border border-l-4 border-l-wm-red/60 bg-wm-s1 p-5">
      <h3 className="label-technical mb-4 text-wm-text3">Service Reminders</h3>
      {shown.length === 0 ? (
        <p className="text-sm text-wm-text2">All services are up to date.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <Link
              key={r.id}
              href={`/garage/${r.vehicle_id}`}
              className={`flex items-center justify-between border border-wm-border bg-wm-s2 px-3 py-2 transition-colors hover:border-wm-accent/40 ${
                r.is_overdue ? "border-l-4 border-l-wm-red" : "border-l-4 border-l-wm-gold"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-headline text-sm font-medium text-wm-text">{r.service_name}</p>
                  <span className={`label-technical rounded-sm px-2 py-0.5 ${
                    r.is_overdue ? "bg-wm-red/20 text-wm-red" : "bg-wm-gold/20 text-wm-gold"
                  }`}>
                    {r.is_overdue ? "Overdue" : "Due soon"}
                  </span>
                </div>
                <p className="label-technical mt-0.5 text-wm-text3">
                  {r.vehicle.year} {r.vehicle.make} {r.vehicle.model}
                </p>
              </div>
              {r.miles_remaining != null && (
                <p className={`ml-3 shrink-0 text-xs font-medium ${r.is_overdue ? "text-wm-red" : "text-wm-gold"}`}>
                  {Math.round(r.miles_remaining).toLocaleString()} mi
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

async function QuickActionsSection() {
  const supabase = createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id,is_primary")
    .order("created_at", { ascending: false });
  const vehicles = (data ?? []) as Array<{ id: string; is_primary: boolean }>;
  const singleVehicle = vehicles.length === 1 ? vehicles[0] : null;
  const primaryVehicle = vehicles.find((v) => v.is_primary) ?? vehicles[0];

  const logServiceHref = singleVehicle
    ? `/garage/${singleVehicle.id}/logbook/new`
    : "/garage";
  const viewCostsHref = primaryVehicle ? `/garage/${primaryVehicle.id}/costs` : "/garage";

  return (
    <section className="border border-wm-border border-l-4 border-l-wm-accent-dark bg-wm-s1 p-5">
      <h3 className="label-technical mb-4 text-wm-text3">Quick Actions</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/garage/add"
          className="group border border-wm-border border-l-2 border-l-wm-accent-dark bg-wm-s2 p-4 transition-colors hover:border-l-wm-gold"
        >
          <p className="font-headline text-sm font-medium text-wm-text">Add Vehicle</p>
          <p className="mt-1 flex items-center text-xs text-wm-text2 group-hover:text-wm-text">
            Create vehicle <Icon name="arrow_forward" size={14} className="ml-1" />
          </p>
        </Link>
        <Link
          href={logServiceHref}
          className="group border border-wm-border border-l-2 border-l-wm-accent-dark bg-wm-s2 p-4 transition-colors hover:border-l-wm-gold"
        >
          <p className="font-headline text-sm font-medium text-wm-text">Log Service</p>
          <p className="mt-1 flex items-center text-xs text-wm-text2 group-hover:text-wm-text">
            Add log entry <Icon name="arrow_forward" size={14} className="ml-1" />
          </p>
        </Link>
        <Link
          href={viewCostsHref}
          className="group border border-wm-border border-l-2 border-l-wm-accent-dark bg-wm-s2 p-4 transition-colors hover:border-l-wm-gold"
        >
          <p className="font-headline text-sm font-medium text-wm-text">View Costs</p>
          <p className="mt-1 flex items-center text-xs text-wm-text2 group-hover:text-wm-text">
            Open dashboard <Icon name="arrow_forward" size={14} className="ml-1" />
          </p>
        </Link>
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <Suspense fallback={<SectionSkeleton />}>
        <GreetingHeader />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <GarageSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <RecentActivitySection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <ServiceRemindersSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <QuickActionsSection />
      </Suspense>
    </main>
  );
}
