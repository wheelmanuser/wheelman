"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import {
  EntryCard,
  type LogbookEntryWithDetails,
} from "@/components/logbook/EntryCard";
import type { LogbookCategory } from "@/types/database";

type Filter = "all" | LogbookCategory;
type RecurrenceFilter = "all" | "recurring" | "one_time";

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
  const [recurrenceFilter, setRecurrenceFilter] = useState<RecurrenceFilter>("all");
  const [editingEntry, setEditingEntry] = useState<LogbookEntryWithDetails | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMiles, setEditMiles] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const supabase = createClient();

  useEffect(() => {
    if (!editingEntry) return;
    setEditTitle(editingEntry.title);
    setEditDate(editingEntry.event_date);
    setEditMiles(editingEntry.odometer_miles != null ? String(editingEntry.odometer_miles) : "");
    setEditCost(editingEntry.total_cost != null ? String(editingEntry.total_cost) : "");
    setEditNotes(editingEntry.notes ?? "");
    setEditError(null);
  }, [editingEntry]);

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
      const byRecurrence =
        recurrenceFilter === "all" ||
        (recurrenceFilter === "recurring" && e.is_recurring === true) ||
        (recurrenceFilter === "one_time" && (e.is_recurring === false || e.is_recurring === null));
      return byFilter && bySearch && byRecurrence;
    });
  }, [entries, filter, search, recurrenceFilter]);

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    if (!editTitle.trim()) {
      setEditError("Service name is required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);

    const { error } = await supabase
      .from("logbook_entries")
      .update({
        title: editTitle.trim(),
        event_date: editDate,
        odometer_miles: editMiles.trim() ? Number(editMiles) : null,
        total_cost: editCost.trim() ? Number(editCost) : null,
        notes: editNotes.trim() || null,
      })
      .eq("id", editingEntry.id);

    if (error) {
      setEditError(error.message);
      setEditSaving(false);
      return;
    }

    setEditingEntry(null);
    setEditSaving(false);
    await query.refetch();
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-headline text-2xl font-light tracking-wide text-wm-text">Logbook</h2>
          <p className="text-sm text-wm-text2">
            {filtered.length} entr{filtered.length === 1 ? "y" : "ies"} · {vehicleTitle}
          </p>
        </div>
        <Link
          href={`/garage/${vehicleId}/logbook/new`}
          className="label-technical border border-wm-accent bg-transparent px-4 py-2 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg"
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
            className={`label-technical rounded-sm px-3 py-1 transition-colors ${
              filter === pill
                ? "border border-wm-accent bg-wm-accent-dark text-wm-accent"
                : "border border-wm-border bg-wm-s2 text-wm-text3 hover:text-wm-text"
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
        className="mt-4 w-full rounded-sm border border-wm-border bg-wm-s1 px-3 py-2 text-sm text-wm-text outline-none focus:border-wm-accent"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "All Entries"],
            ["recurring", "Recurring"],
            ["one_time", "One-Time"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setRecurrenceFilter(value)}
            className={`label-technical rounded-sm border px-3 py-1 transition-colors ${
              recurrenceFilter === value
                ? "border-wm-gold bg-wm-accent-dark text-wm-gold"
                : "border-wm-border text-wm-text3 hover:border-wm-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <p className="mt-6 text-sm text-wm-text2">Loading entries...</p>
      ) : query.isError ? (
        <p className="mt-6 rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
          {(query.error as Error).message}
        </p>
      ) : filtered.length === 0 ? (
        <div className="mt-8 border border-dashed border-wm-border bg-wm-s1 p-8 text-center">
          <p className="text-sm text-wm-text2">No entries yet.</p>
          <Link
            href={`/garage/${vehicleId}/logbook/new`}
            className="label-technical mt-4 inline-flex border border-wm-accent bg-transparent px-4 py-2 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg"
          >
            Add your first entry
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.map(([month, rows]) => (
            <section key={month}>
              <h3 className="label-technical mb-3 text-wm-text3">
                {month}
              </h3>
              <div className="space-y-3">
                {rows.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} onEdit={setEditingEntry} />
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
          className="label-technical mt-6 rounded-sm border border-wm-border bg-wm-s2 px-4 py-2 text-wm-text disabled:opacity-60"
        >
          {query.isFetchingNextPage ? "Loading..." : "Load more"}
        </button>
      )}

      {editingEntry && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-wm-bg/70"
            aria-label="Close drawer"
            onClick={() => setEditingEntry(null)}
          />
          <aside className="carbon-texture fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-wm-border bg-wm-s1 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-xl tracking-wide text-wm-text">Edit Entry</h3>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="text-wm-text2 hover:text-wm-text"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <form
              className="mt-6 flex flex-1 flex-col gap-4 overflow-y-auto"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
            >
              <label className="block text-sm">
                <span className="text-wm-text2">Service Name</span>
                <input
                  className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="text-wm-text2">Date</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="text-wm-text2">Mileage</span>
                <input
                  type="number"
                  placeholder="Odometer reading"
                  className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                  value={editMiles}
                  onChange={(e) => setEditMiles(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="text-wm-text2">Cost (optional)</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 59.99"
                  className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="text-wm-text2">Notes (optional)</span>
                <textarea
                  rows={3}
                  placeholder="Any notes about this service..."
                  className="mt-1 w-full resize-none rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </label>

              {editError && <p className="text-sm text-wm-red">{editError}</p>}

              <button
                type="submit"
                disabled={editSaving}
                className="mt-auto rounded-sm border border-wm-accent bg-wm-accent-dark py-2 text-xs uppercase tracking-wider text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg disabled:opacity-60"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}