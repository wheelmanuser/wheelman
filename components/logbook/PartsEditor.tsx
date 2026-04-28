"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PartDraft } from "@/lib/logbook-save";

type Props = {
  parts: PartDraft[];
  onChange: (parts: PartDraft[]) => void;
};

export function PartsEditor({ parts, onChange }: Props) {
  const supabase = createClient();
  const [suggestions, setSuggestions] = useState<Record<number, string[]>>({});

  useEffect(() => {
    if (parts.length === 0) {
      onChange([{ part_name: "", quantity: 1, unit_cost: null }]);
    }
  }, [parts.length, onChange]);

  const updatePart = (idx: number, next: Partial<PartDraft>) => {
    const clone = [...parts];
    clone[idx] = { ...clone[idx], ...next };
    onChange(clone);
  };

  const removePart = (idx: number) => {
    const clone = parts.filter((_, i) => i !== idx);
    onChange(clone.length > 0 ? clone : [{ part_name: "", quantity: 1 }]);
  };

  const addPart = () => {
    onChange([...parts, { part_name: "", quantity: 1, unit_cost: null }]);
  };

  const fetchSuggestions = async (idx: number, input: string) => {
    if (input.trim().length < 2) {
      setSuggestions((s) => ({ ...s, [idx]: [] }));
      return;
    }
    const query = (supabase as unknown as {
      from: (
        table: "user_custom_parts",
      ) => {
        select: (columns: string) => {
          ilike: (column: string, value: string) => {
            limit: (value: number) => Promise<{
              data: Array<{ part_name: string }> | null;
            }>;
          };
        };
      };
    })
      .from("user_custom_parts")
      .select("part_name")
      .ilike("part_name", `%${input}%`)
      .limit(5);
    const { data } = await query;
    setSuggestions((s) => ({
      ...s,
      [idx]: (data ?? []).map((d: { part_name: string }) => d.part_name),
    }));
  };

  return (
    <div className="space-y-3">
      {parts.map((part, idx) => (
        <div key={idx} className="rounded-lg border border-wm-border bg-wm-s2 p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
            <div className="md:col-span-6">
              <input
                value={part.part_name}
                onChange={(e) => {
                  const v = e.target.value;
                  updatePart(idx, { part_name: v });
                  void fetchSuggestions(idx, v);
                }}
                placeholder="Part name"
                className="w-full rounded-md border border-wm-border bg-wm-s1 px-3 py-2 text-sm text-wm-text outline-none focus:border-wm-accent"
              />
              {suggestions[idx]?.length ? (
                <div className="mt-1 rounded-md border border-wm-border bg-wm-s1">
                  {suggestions[idx].map((name) => (
                    <button
                      type="button"
                      key={name}
                      onClick={() => {
                        updatePart(idx, { part_name: name });
                        setSuggestions((s) => ({ ...s, [idx]: [] }));
                      }}
                      className="block w-full px-3 py-1.5 text-left text-xs text-wm-text2 hover:bg-wm-s3"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <input
              value={part.quantity ?? ""}
              onChange={(e) =>
                updatePart(idx, {
                  quantity: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              type="number"
              placeholder="Qty"
              className="rounded-md border border-wm-border bg-wm-s1 px-3 py-2 text-sm text-wm-text md:col-span-2"
            />
            <input
              value={part.unit_cost ?? ""}
              onChange={(e) =>
                updatePart(idx, {
                  unit_cost: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              type="number"
              placeholder="Unit Cost"
              className="rounded-md border border-wm-border bg-wm-s1 px-3 py-2 text-sm text-wm-text md:col-span-3"
            />
            <button
              type="button"
              onClick={() => removePart(idx)}
              className="rounded-md border border-wm-border px-2 py-2 text-xs text-wm-text2 hover:bg-wm-s3 md:col-span-1"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addPart}
        className="rounded-md border border-wm-border px-3 py-2 text-sm text-wm-text2 hover:bg-wm-s3"
      >
        Add Part
      </button>
    </div>
  );
}
