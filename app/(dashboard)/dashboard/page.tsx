import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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

type ReminderRow = {
  vehicle_id: string;
  service_name: string;
  pct_remaining: number | null;
};

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function ReminderTone({ pct }: { pct: number | null }) {
  const className =
    pct == null ? "text-wm-text2" : pct <= 10 ? "text-wm-red" : pct <= 30 ? "text-wm-orange" : "text-wm-green";
  return <span className={className}>{pct == null ? "—" : `${Math.round(pct)}% left`}</span>;
}

function SectionSkeleton() {
  return (
    <div className="rounded-xl border border-wm-border bg-wm-s1 p-5">
      <div className="h-4 w-40 animate-pulse rounded bg-wm-s3" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-wm-s3" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-wm-s3" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-wm-s3" />
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
        <h2 className="text-3xl font-semibold text-wm-text">
          {greetingForNow()}, {displayName}
        </h2>
        <p className="mt-2 text-sm text-wm-text2">
          Start where you left off in your Wheelman workspace.
        </p>
      </div>
      <button
        type="button"
        className="rounded-full border border-wm-border bg-wm-s1 p-2 text-wm-text2"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
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
    <section className="rounded-xl border border-wm-border bg-wm-s1 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-wm-text">Your Garage</h3>
        {vehicles.length > 3 && (
          <Link href="/garage" className="text-xs text-wm-accent hover:underline">
            View all →
          </Link>
        )}
      </div>
      {shown.length === 0 ? (
        <Link
          href="/garage/add"
          className="block rounded-lg border border-dashed border-wm-border bg-wm-s2 p-4 text-sm text-wm-text2 hover:bg-wm-s3"
        >
          Add your first vehicle
        </Link>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {shown.map((v) => (
            <Link
              key={v.id}
              href={`/garage/${v.id}`}
              className="rounded-lg border border-wm-border bg-wm-s2 p-3 hover:border-wm-accent/60"
            >
              <p className="text-sm font-medium text-wm-text">
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
    <section className="rounded-xl border border-wm-border bg-wm-s1 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-wm-text">Recent Logbook Activity</h3>
        <Link href="/garage" className="text-xs text-wm-accent hover:underline">
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
              className="flex items-center justify-between rounded-lg border border-wm-border bg-wm-s2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-wm-text">
                  {vehicleMap.get(e.vehicle_id) ?? "Vehicle"} · {e.title}
                </p>
                <p className="text-xs text-wm-text3">
                  {e.event_date} · {e.category}
                </p>
              </div>
              <p className="ml-3 text-sm text-wm-gold">${Number(e.total_cost ?? 0).toFixed(2)}</p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

async function ServiceRemindersSection() {
  const supabase = createClient();
  const remindersQuery = (supabase as unknown as {
    from: (
      table: "vw_service_reminders",
    ) => {
      select: (columns: string) => {
        order: (
          column: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{
            data: Array<
              ReminderRow & { year: number; make: string; model: string }
            > | null;
          }>;
        };
      };
    };
  })
    .from("vw_service_reminders")
    .select("vehicle_id,service_name,pct_remaining,year,make,model")
    .order("pct_remaining", { ascending: true })
    .limit(3);
  const { data } = await remindersQuery;
  const reminders = (data ?? []) as Array<
    ReminderRow & { year: number; make: string; model: string }
  >;

  return (
    <section className="rounded-xl border border-wm-border bg-wm-s1 p-5">
      <h3 className="mb-4 text-sm font-semibold text-wm-text">Service Reminders</h3>
      <div className="space-y-2">
        {reminders.length === 0 ? (
          <p className="text-sm text-wm-text2">No active reminders.</p>
        ) : (
          reminders.map((r, idx) => (
            <Link
              key={`${r.vehicle_id}-${r.service_name}-${idx}`}
              href={`/garage/${r.vehicle_id}`}
              className="flex items-center justify-between rounded-lg border border-wm-border bg-wm-s2 px-3 py-2"
            >
              <div>
                <p className="text-sm text-wm-text">{r.service_name}</p>
                <p className="text-xs text-wm-text3">
                  {r.year} {r.make} {r.model}
                </p>
              </div>
              <ReminderTone pct={r.pct_remaining} />
            </Link>
          ))
        )}
      </div>
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
    <section className="rounded-xl border border-wm-border bg-wm-s1 p-5">
      <h3 className="mb-4 text-sm font-semibold text-wm-text">Quick Actions</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/garage/add"
          className="group rounded-lg border border-wm-border bg-wm-s2 p-4 hover:border-wm-accent/60"
        >
          <p className="text-sm font-medium text-wm-text">Add Vehicle</p>
          <p className="mt-1 flex items-center text-xs text-wm-text2 group-hover:text-wm-text">
            Create vehicle <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </p>
        </Link>
        <Link
          href={logServiceHref}
          className="group rounded-lg border border-wm-border bg-wm-s2 p-4 hover:border-wm-accent/60"
        >
          <p className="text-sm font-medium text-wm-text">Log Service</p>
          <p className="mt-1 flex items-center text-xs text-wm-text2 group-hover:text-wm-text">
            Add log entry <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </p>
        </Link>
        <Link
          href={viewCostsHref}
          className="group rounded-lg border border-wm-border bg-wm-s2 p-4 hover:border-wm-accent/60"
        >
          <p className="text-sm font-medium text-wm-text">View Costs</p>
          <p className="mt-1 flex items-center text-xs text-wm-text2 group-hover:text-wm-text">
            Open dashboard <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
