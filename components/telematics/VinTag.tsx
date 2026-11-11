"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { vinDisplay } from "@/supabase/functions/sync-telemetry/vehicle-info";

// The vehicle's VIN next to its OBD data (WHE-39): the device-reported VIN, falling back to the vehicle record,
// with a note when the two disagree.
export function VinTag({ deviceVin, recordVin, className = "" }: { deviceVin: unknown; recordVin: unknown; className?: string }) {
  const { vin, mismatch } = vinDisplay(deviceVin, recordVin);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!vin) return;
    try {
      await navigator.clipboard.writeText(vin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the text is still selectable
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="label-technical text-wm-text3">VIN</span>
        <span className="select-all font-mono text-xs tracking-widest text-wm-text2">{vin ?? "—"}</span>
        {vin && (
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "VIN copied" : "Copy VIN"}
            title={copied ? "Copied" : "Copy VIN"}
            className="text-wm-text3 transition-colors hover:text-wm-accent"
          >
            <Icon name={copied ? "check" : "content_copy"} size={14} />
          </button>
        )}
      </div>
      {mismatch && <p className="mt-0.5 text-xs text-wm-gold">Doesn&apos;t match vehicle record</p>}
    </div>
  );
}
