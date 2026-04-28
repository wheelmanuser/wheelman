import { notFound } from "next/navigation";
import { MonthlySpendChart } from "@/components/garage/MonthlySpendChart";
import { createClient } from "@/lib/supabase/server";
import type { LogbookCategory, Vehicle } from "@/types/database";

type CostEntry = {
  id: string;
  category: LogbookCategory;
  total_cost: number | null;
  event_date: string;
  title: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function categoryMeta(category: LogbookCategory) {
  if (category === "maintenance") {
    return { icon: "🔧", label: "Maintenance", bar: "bg-wm-accent" };
  }
  if (category === "modification") {
    return { icon: "⚙️", label: "Modification", bar: "bg-wm-purple" };
  }
  return { icon: "📝", label: "Other", bar: "bg-wm-gold" };
}

export const dynamic = "force-dynamic";

type PageProps = {
  params: { vehicleId: string };
};

export default async function CostsPage({ params }: PageProps) {
  const supabase = createClient();

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id,year,make,model,odometer_miles")
    .eq("id", params.vehicleId)
    .single();

  if (vehicleError || !vehicle) notFound();

  const { data: rows, error: rowsError } = await supabase
    .from("logbook_entries")
    .select("id,category,total_cost,event_date,title")
    .eq("vehicle_id", params.vehicleId)
    .gt("total_cost", 0)
    .order("event_date", { ascending: false });

  if (rowsError) notFound();

  const entries = (rows ?? []) as CostEntry[];
  const now = new Date();
  const currentYear = now.getFullYear();

  const totalSpend = entries.reduce((sum, e) => sum + Number(e.total_cost ?? 0), 0);
  const odometer = Number((vehicle as Vehicle).odometer_miles ?? 0);
  const costPerMile = odometer > 0 ? totalSpend / odometer : 0;
  const ytdSpend = entries
    .filter((e) => new Date(e.event_date).getFullYear() === currentYear)
    .reduce((sum, e) => sum + Number(e.total_cost ?? 0), 0);

  const monthlyByYear: Record<number, Array<{ month: number; label: string; value: number }>> = {};
  for (const e of entries) {
    const d = new Date(e.event_date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    monthlyByYear[year] ??= MONTHS.map((label, idx) => ({
      month: idx + 1,
      label,
      value: 0,
    }));
    monthlyByYear[year][month - 1].value += Number(e.total_cost ?? 0);
  }
  if (!monthlyByYear[currentYear]) {
    monthlyByYear[currentYear] = MONTHS.map((label, idx) => ({
      month: idx + 1,
      label,
      value: 0,
    }));
  }
  const years = Object.keys(monthlyByYear)
    .map(Number)
    .sort((a, b) => b - a);

  const categoryTotals = (["maintenance", "modification", "other"] as const).map((category) => {
    const total = entries
      .filter((e) => e.category === category)
      .reduce((sum, e) => sum + Number(e.total_cost ?? 0), 0);
    const pct = totalSpend > 0 ? (total / totalSpend) * 100 : 0;
    return { category, total, pct };
  });

  const recent = entries.slice(0, 10);
  const v = vehicle as Pick<Vehicle, "year" | "make" | "model">;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-wm-text">Cost Dashboard</h2>
        <p className="mt-1 text-sm text-wm-text2">
          {v.year} {v.make} {v.model}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-wm-border bg-wm-s1 p-4">
          <p className="text-xs uppercase tracking-wide text-wm-text3">Total Spend</p>
          <p className="mt-2 text-2xl font-semibold text-wm-gold">${totalSpend.toFixed(2)}</p>
        </article>
        <article className="rounded-xl border border-wm-border bg-wm-s1 p-4">
          <p className="text-xs uppercase tracking-wide text-wm-text3">Cost Per Mile</p>
          <p className="mt-2 text-2xl font-semibold text-wm-text">${costPerMile.toFixed(2)}</p>
        </article>
        <article className="rounded-xl border border-wm-border bg-wm-s1 p-4">
          <p className="text-xs uppercase tracking-wide text-wm-text3">YTD Spend</p>
          <p className="mt-2 text-2xl font-semibold text-wm-text">${ytdSpend.toFixed(2)}</p>
        </article>
      </section>

      <MonthlySpendChart
        monthlyByYear={monthlyByYear}
        years={years}
        defaultYear={currentYear}
      />

      <section className="rounded-xl border border-wm-border bg-wm-s1 p-5">
        <h3 className="mb-4 text-sm font-semibold text-wm-text">By Category</h3>
        <div className="space-y-3">
          {categoryTotals.map((row) => {
            const meta = categoryMeta(row.category);
            return (
              <div key={row.category}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <p className="text-wm-text">
                    <span className="mr-2">{meta.icon}</span>
                    {meta.label}
                  </p>
                  <p className="text-wm-gold">
                    ${row.total.toFixed(2)} · {row.pct.toFixed(1)}%
                  </p>
                </div>
                <div className="h-2 w-full rounded-full bg-wm-s3">
                  <div
                    className={`h-2 rounded-full ${meta.bar}`}
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-wm-border bg-wm-s1 p-5">
        <h3 className="mb-4 text-sm font-semibold text-wm-text">Recent Entries</h3>
        <ul className="space-y-2">
          {recent.map((entry) => {
            const meta = categoryMeta(entry.category);
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-wm-border bg-wm-s2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-wm-text">
                    <span className="mr-2">{meta.icon}</span>
                    {entry.title}
                  </p>
                  <p className="text-xs text-wm-text3">{entry.event_date}</p>
                </div>
                <p className="ml-4 text-sm font-medium text-wm-gold">
                  ${Number(entry.total_cost ?? 0).toFixed(2)}
                </p>
              </li>
            );
          })}
          {recent.length === 0 && (
            <li className="text-sm text-wm-text2">No costed entries yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
