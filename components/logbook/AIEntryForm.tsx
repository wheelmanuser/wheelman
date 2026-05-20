"use client";

import { useState } from "react";
import { EntryForm, type EntryFormValues } from "@/components/logbook/EntryForm";
import type { Vehicle } from "@/types/database";

type ParsedPayload = Partial<EntryFormValues> & {
  parts?: Array<{ part_name: string; quantity?: number; unit_cost?: number }>;
};

export function AIEntryForm({
  vehicle,
  onEditInForm,
  seedText,
}: {
  vehicle: Pick<Vehicle, "id" | "year" | "make" | "model" | "nickname" | "odometer_miles">;
  onEditInForm: (draft: ParsedPayload) => void;
  seedText?: string;
}) {
  const [text, setText] = useState(seedText ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedPayload | null>(null);
  const [confirmMode, setConfirmMode] = useState(false);

  const parse = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, vehicleId: vehicle.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Parse failed");
      setParsed(body.parsed ?? body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmMode && parsed) {
    return <EntryForm vehicle={vehicle} mode="ai" initialValues={parsed} />;
  }

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Describe what you did in plain English"
        className="w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text"
      />
      <button
        type="button"
        onClick={parse}
        disabled={loading || text.trim().length === 0}
        className="rounded-md bg-wm-purple px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Parsing your description..." : "✨ Parse"}
      </button>
      {error && (
        <p className="rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
          {error}
        </p>
      )}

      {parsed && (
        <div className="rounded-xl border border-wm-border bg-wm-s2 p-4">
          <h3 className="text-sm font-semibold text-wm-text">Parsed Review</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-wm-text2 md:grid-cols-2">
            <label>
              Title
              <input
                value={parsed.title ?? ""}
                onChange={(e) =>
                  setParsed((p) => ({ ...(p ?? {}), title: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-wm-border bg-wm-s1 px-2 py-1 text-wm-text"
              />
            </label>
            <label>
              Category
              <select
                value={parsed.category ?? "maintenance"}
                onChange={(e) =>
                  setParsed((p) => ({
                    ...(p ?? {}),
                    category: e.target.value as EntryFormValues["category"],
                  }))
                }
                className="mt-1 w-full rounded-md border border-wm-border bg-wm-s1 px-2 py-1 text-wm-text"
              >
                <option value="maintenance">maintenance</option>
                <option value="modification">modification</option>
                <option value="other">other</option>
              </select>
            </label>
            <label>
              Odometer
              <input
                type="number"
                value={parsed.odometer_miles ?? ""}
                onChange={(e) =>
                  setParsed((p) => ({
                    ...(p ?? {}),
                    odometer_miles: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-md border border-wm-border bg-wm-s1 px-2 py-1 text-wm-text"
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={parsed.event_date ?? new Date().toISOString().slice(0, 10)}
                onChange={(e) =>
                  setParsed((p) => ({ ...(p ?? {}), event_date: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-wm-border bg-wm-s1 px-2 py-1 text-wm-text"
              />
            </label>
            <label className="md:col-span-2">
              Notes
              <textarea
                rows={3}
                value={parsed.notes ?? ""}
                onChange={(e) =>
                  setParsed((p) => ({ ...(p ?? {}), notes: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-wm-border bg-wm-s1 px-2 py-1 text-wm-text"
              />
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmMode(true)}
              className="rounded-md bg-wm-accent px-3 py-2 text-sm font-medium text-white"
            >
              Confirm & Save
            </button>
            <button
              type="button"
              onClick={() => onEditInForm(parsed)}
              className="rounded-md border border-wm-border px-3 py-2 text-sm text-wm-text2 hover:bg-wm-s1"
            >
              Edit in Form
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
