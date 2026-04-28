"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LogbookEntry } from "@/types/database";

type Props = {
  vehicleId: string;
};

function monthKey(d: string) {
  return d.slice(0, 7);
}

export function LogbookTimeline({ vehicleId }: Props) {
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { data, error: qError } = await supabase
        .from("logbook_entries")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("event_date", { ascending: false });

      if (qError) {
        setError(qError.message);
        setEntries([]);
      } else {
        setEntries((data ?? []) as LogbookEntry[]);
      }
      setLoading(false);
    };
    void load();
  }, [vehicleId]);

  const grouped = useMemo(() => {
    const map = new Map<string, LogbookEntry[]>();
    for (const e of entries) {
      const key = monthKey(e.event_date);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  if (loading) {
    return <p className="text-sm text-wm-text2">Loading logbook...</p>;
  }
  if (error) {
    return (
      <p className="rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
        {error}
      </p>
    );
  }
  if (entries.length === 0) {
    return (
      <p className="text-sm text-wm-text2">
        No logbook entries yet. Add one from the Logbook tab route when ready.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(([month, rows]) => (
        <section key={month}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-wm-text3">
            {month}
          </h3>
          <ul className="space-y-3">
            {rows.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-wm-border bg-wm-s1 px-4 py-3"
              >
                <p className="text-sm font-medium text-wm-text">{entry.title}</p>
                <p className="mt-1 text-xs text-wm-text2">
                  {entry.event_date} · {entry.category}
                  {entry.total_cost != null && ` · $${entry.total_cost}`}
                </p>
                {entry.notes && (
                  <p className="mt-2 text-xs text-wm-text3 line-clamp-2">{entry.notes}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
