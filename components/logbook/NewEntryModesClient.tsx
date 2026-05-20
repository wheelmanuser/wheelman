"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EntryForm, type EntryFormValues } from "@/components/logbook/EntryForm";
import { AIEntryForm } from "@/components/logbook/AIEntryForm";
import { OCRScanner } from "@/components/logbook/OCRScanner";
import { vehicleDisplayName } from "@/lib/vehicle-display";
import type { Vehicle } from "@/types/database";

type EntryMode = "form" | "ai" | "ocr";

const MODES: Array<{ id: EntryMode; label: string }> = [
  { id: "form", label: "📋 Form" },
  { id: "ai", label: "✨ AI" },
  { id: "ocr", label: "📷 OCR" },
];

function coerceMode(value: string | null): EntryMode {
  if (value === "ai" || value === "ocr") return value;
  return "form";
}

export function NewEntryModesClient({
  vehicle,
}: {
  vehicle: Pick<Vehicle, "id" | "year" | "make" | "model" | "nickname" | "odometer_miles">;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [formDraft, setFormDraft] = useState<Partial<EntryFormValues> | undefined>();
  const [aiSeedText, setAiSeedText] = useState<string | undefined>();

  const mode = coerceMode(searchParams.get("mode"));
  const toModeHref = (nextMode: EntryMode) =>
    `${pathname}?mode=${nextMode}`;

  const title = useMemo(
    () => vehicleDisplayName(vehicle),
    [vehicle],
  );

  const switchMode = (next: EntryMode) => {
    router.push(toModeHref(next));
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        href={`/garage/${vehicle.id}/logbook`}
        className="text-sm text-wm-text2 hover:text-wm-text"
      >
        ← Back to logbook timeline
      </Link>

      <h2 className="mt-4 text-2xl font-semibold text-wm-text">New Entry</h2>
      <p className="mt-1 text-sm text-wm-text2">{title}</p>

      <div className="mt-5 flex gap-3 border-b border-wm-border">
        {MODES.map((tab) => (
          <Link
            key={tab.id}
            href={toModeHref(tab.id)}
            className={`pb-2 text-sm font-medium ${
              mode === tab.id
                ? "border-b-2 border-wm-accent text-wm-text"
                : "text-wm-text2 hover:text-wm-text"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <section className="mt-6 rounded-xl border border-wm-border bg-wm-s1 p-6">
        {mode === "form" && (
          <EntryForm
            vehicle={vehicle}
            mode="form"
            initialValues={formDraft}
          />
        )}
        {mode === "ai" && (
          <AIEntryForm
            vehicle={vehicle}
            seedText={aiSeedText}
            onEditInForm={(draft) => {
              setFormDraft(draft);
              switchMode("form");
            }}
          />
        )}
        {mode === "ocr" && (
          <OCRScanner
            onParsedText={(text) => {
              setAiSeedText(text);
              switchMode("ai");
            }}
          />
        )}
      </section>
    </div>
  );
}
