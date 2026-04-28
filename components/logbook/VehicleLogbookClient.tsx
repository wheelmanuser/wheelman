"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  EntryCard,
  type LogbookEntryWithDetails,
} from "@/components/logbook/EntryCard";
import type { LogbookCategory } from "@/types/database";

type Filter = "all" | LogbookCategory;

const PAGE_SIZE = 20;

function monthLabel(isoDate: string) {
  const d = new Date(isoDate);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function VehicleLogbookClient({
  vehicleId,
  vehicleTitle,
}: {
  vehicleId: string;
  vehicleTitle: string;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const supabase = createClient();

  const query = useInfiniteQuery({
    queryKey: ["logbook-entries", vehicleId],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("logbook_entries")
        .select("*, logbook_attachments(*), logbook_entry_parts(*)")
        .eq("vehicle_id", vehicleId)
        .order("event_date", { ascending: false })
        .range(from, to);

      if (error) throw new Error(error.message);

      const rows = (data ?? []).map((row) => {
        const attachments = row.logbook_attachments ?? [];
        return {
          ...row,
          attachment_count: attachments.length,
        } as LogbookEntryWithDetails;
      });

      return {
        rows,
        nextPage: rows.length < PAGE_SIZE ? undefined : pageParam + 1,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage,
  });

  const entries = useMemo(
    () => query.data?.pages.flatMap((p) => p.rows) ?? [],
    [query.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const byFilter = filter === "all" || e.category === filter;
      const bySearch =
        q.length === 0 ||
        e.title.toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q);
      return byFilter && bySearch;
    });
  }, [entries, filter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, LogbookEntryWithDetails[]>();
    for (const entry of filtered) {
      const key = monthLabel(entry.event_date);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      <Link
        href={`/garage/${vehicleId}`}
        className="text-sm text-wm-text2 hover:text-wm-text"
      >
        ← Back to vehicle
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-wm-text">Logbook</h2>
          <p className="text-sm text-wm-text2">
            {filtered.length} entr{filtered.length === 1 ? "y" : "ies"} · {vehicleTitle}
          </p>
        </div>
        <Link
          href={`/garage/${vehicleId}/logbook/new`}
          className="rounded-md bg-wm-accent px-3 py-2 text-sm font-medium text-white"
        >
          New Entry
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "maintenance", "modification", "other"] as const).map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => setFilter(pill)}
            className={`rounded-full px-3 py-1.5 text-xs ${
              filter === pill
                ? "bg-wm-accent text-white"
                : "bg-wm-s2 text-wm-text2 hover:text-wm-text"
            }`}
          >
            {pill === "all" ? "All" : pill[0].toUpperCase() + pill.slice(1)}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search entries..."
        className="mt-4 w-full rounded-md border border-wm-border bg-wm-s1 px-3 py-2 text-sm text-wm-text outline-none focus:border-wm-accent"
      />

      {query.isLoading ? (
        <p className="mt-6 text-sm text-wm-text2">Loading entries...</p>
      ) : query.isError ? (
        <p className="mt-6 rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
          {(query.error as Error).message}
        </p>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-wm-border bg-wm-s1 p-8 text-center">
          <p className="text-sm text-wm-text2">No entries yet.</p>
          <Link
            href={`/garage/${vehicleId}/logbook/new`}
            className="mt-4 inline-flex rounded-md bg-wm-accent px-3 py-2 text-sm font-medium text-white"
          >
            Add your first entry
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.map(([month, rows]) => (
            <section key={month}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-wm-text3">
                {month}
              </h3>
              <div className="space-y-3">
                {rows.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="mt-6 rounded-md border border-wm-border bg-wm-s2 px-4 py-2 text-sm text-wm-text disabled:opacity-60"
        >
          {query.isFetchingNextPage ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}