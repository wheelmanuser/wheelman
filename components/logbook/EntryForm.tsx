"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { PartsEditor } from "@/components/logbook/PartsEditor";
import { saveLogbookEntry, type PartDraft } from "@/lib/logbook-save";
import { vehicleDisplayName } from "@/lib/vehicle-display";
import type { LogbookCategory, LogbookEntryMode, Vehicle } from "@/types/database";

const schema = z.object({
  category: z.enum(["maintenance", "modification", "other"]),
  title: z.string().trim().min(1, "Title is required"),
  odometer_miles: z.number().nonnegative(),
  event_date: z.string().min(1, "Date is required"),
  total_cost: z.number().nonnegative().optional(),
  shop_name: z.string().optional(),
  performed_by: z.string().optional(),
  notes: z.string().optional(),
});

export type EntryFormValues = z.infer<typeof schema>;

export function EntryForm({
  vehicle,
  mode = "form",
  initialValues,
}: {
  vehicle: Pick<Vehicle, "id" | "year" | "make" | "model" | "nickname" | "odometer_miles">;
  mode?: LogbookEntryMode;
  initialValues?: Partial<EntryFormValues> & { parts?: PartDraft[] };
}) {
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [parts, setParts] = useState<PartDraft[]>(
    initialValues?.parts ?? [{ part_name: "", quantity: 1, unit_cost: null }],
  );
  const [files, setFiles] = useState<File[]>([]);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: initialValues?.category ?? "maintenance",
      title: initialValues?.title ?? "",
      odometer_miles:
        initialValues?.odometer_miles ??
        Number(vehicle.odometer_miles ?? 0),
      event_date:
        initialValues?.event_date ?? new Date().toISOString().slice(0, 10),
      total_cost: initialValues?.total_cost,
      shop_name: initialValues?.shop_name ?? "",
      performed_by: initialValues?.performed_by ?? "",
      notes: initialValues?.notes ?? "",
    },
  });

  const computedCost = useMemo(() => {
    return parts.reduce((sum, p) => {
      const q = Number(p.quantity ?? 0);
      const c = Number(p.unit_cost ?? 0);
      return sum + (Number.isFinite(q) ? q : 0) * (Number.isFinite(c) ? c : 0);
    }, 0);
  }, [parts]);

  const effectiveCost = form.watch("total_cost");
  const shownCost = effectiveCost ?? computedCost;

  const fetchTitleAutocomplete = async (input: string) => {
    if (input.trim().length < 2) {
      setTitleSuggestions([]);
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
    setTitleSuggestions((data ?? []).map((d: { part_name: string }) => d.part_name));
  };

  const onSubmit = async (values: EntryFormValues) => {
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      await saveLogbookEntry(supabase, user, {
        vehicleId: vehicle.id,
        category: values.category as LogbookCategory,
        title: values.title,
        odometer_miles: values.odometer_miles,
        event_date: values.event_date,
        total_cost: values.total_cost ?? computedCost,
        shop_name: values.shop_name ?? null,
        performed_by: values.performed_by ?? null,
        notes: values.notes ?? null,
        parts,
        files,
        entry_mode: mode,
      });

      await queryClient.invalidateQueries({
        queryKey: ["logbook-entries", vehicle.id],
      });
      router.push(`/garage/${vehicle.id}/logbook`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  const vehicleLabel = vehicleDisplayName(vehicle);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-wm-text3">Vehicle</p>
        <p className="text-sm text-wm-text">{vehicleLabel}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["maintenance", "modification", "other"] as const).map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => form.setValue("category", category)}
            className={`rounded-lg border px-3 py-2 text-xs ${
              form.watch("category") === category
                ? "border-wm-accent bg-wm-accent/20 text-wm-text"
                : "border-wm-border bg-wm-s2 text-wm-text2"
            }`}
          >
            {category[0].toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      <div>
        <input
          {...form.register("title")}
          onChange={(e) => {
            form.setValue("title", e.target.value);
            void fetchTitleAutocomplete(e.target.value);
          }}
          placeholder="Title"
          className="w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text"
        />
        {titleSuggestions.length > 0 && (
          <div className="mt-1 rounded-md border border-wm-border bg-wm-s2">
            {titleSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  form.setValue("title", s);
                  setTitleSuggestions([]);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-wm-text2 hover:bg-wm-s3"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          type="number"
          {...form.register("odometer_miles", {
            setValueAs: (v) => Number(v),
          })}
          placeholder="Odometer"
          className="rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text"
        />
        <input
          type="date"
          {...form.register("event_date")}
          className="rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text"
        />
        <input
          type="number"
          {...form.register("total_cost", {
            setValueAs: (v) => (v === "" ? undefined : Number(v)),
          })}
          placeholder={`Total Cost (auto: ${computedCost.toFixed(2)})`}
          className="rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text"
        />
      </div>
      <p className="text-xs text-wm-text3">Current total: ${shownCost.toFixed(2)}</p>

      <PartsEditor parts={parts} onChange={setParts} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          {...form.register("shop_name")}
          placeholder="Shop"
          className="rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text"
        />
        <input
          {...form.register("performed_by")}
          placeholder="Performed By"
          className="rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text"
        />
      </div>

      <textarea
        {...form.register("notes")}
        rows={4}
        placeholder="Notes"
        className="w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text"
      />

      <div>
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm text-wm-text2"
        />
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((f, idx) => (
              <button
                key={`${f.name}-${idx}`}
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                className="rounded-full bg-wm-s3 px-2 py-1 text-xs text-wm-text2"
              >
                {f.name} ×
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-wm-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Entry"}
      </button>
    </form>
  );
}
