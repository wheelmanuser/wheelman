"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  vehicleFormSchema,
  VEHICLE_FORM_FIELDS,
  type VehicleFormValues,
} from "@/lib/vehicle-form";
import type { Vehicle } from "@/types/database";

type Props = {
  vehicle: Vehicle;
};

export function VehicleEditForm({ vehicle }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [odometer, setOdometer] = useState<string>(
    vehicle.odometer_miles != null ? String(vehicle.odometer_miles) : "",
  );

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim ?? "",
      color: vehicle.color ?? "",
      transmission: vehicle.transmission ?? "",
      vin: vehicle.vin ?? "",
      purchase_price: vehicle.purchase_price ?? undefined,
      estimated_miles_per_year: vehicle.estimated_miles_per_year ?? undefined,
    },
  });

  const onSubmit = async (values: VehicleFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const odometerValue = odometer.trim() !== "" ? Number(odometer) : null;

      const { error } = await supabase
        .from("vehicles")
        .update({
          year: values.year,
          make: values.make,
          model: values.model,
          trim: values.trim || null,
          color: values.color || null,
          transmission: values.transmission || null,
          vin: values.vin || null,
          purchase_price: values.purchase_price ?? null,
          estimated_miles_per_year: values.estimated_miles_per_year ?? null,
          odometer_miles: odometerValue,
          odometer_source: odometerValue != null ? "manual" : null,
        })
        .eq("id", vehicle.id);

      if (error) throw new Error(error.message);
      router.push(`/garage/${vehicle.id}`);
      router.refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm("Delete this vehicle and all related data? This cannot be undone.")) {
      return;
    }
    setDeleting(true);
    setSubmitError(null);
    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
      if (error) throw new Error(error.message);
      router.replace("/garage");
      router.refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={`/garage/${vehicle.id}`}
        className="text-sm text-wm-text2 hover:text-wm-text"
      >
        ← Back to vehicle
      </Link>

      <h2 className="mt-4 text-2xl font-semibold text-wm-text">Edit Vehicle</h2>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mt-6 space-y-4 rounded-xl border border-wm-border bg-wm-s1 p-6"
      >
        {VEHICLE_FORM_FIELDS.map((field) => {
          const errorMessage = form.formState.errors[field.name]?.message;
          const isNumber = field.type === "number";
          return (
            <label key={field.name} className="block">
              <span className="mb-1 block text-sm text-wm-text2">{field.label}</span>
              <input
                type={field.type}
                {...form.register(field.name, {
                  setValueAs: isNumber
                    ? (v) => (v === "" ? undefined : Number(v))
                    : undefined,
                })}
                className="w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text outline-none focus:border-wm-accent"
              />
              {errorMessage && (
                <span className="mt-1 block text-xs text-wm-red">{errorMessage}</span>
              )}
            </label>
          );
        })}

        {/* Odometer — kept separate since it lives outside the shared schema */}
        <label className="block">
          <span className="mb-1 block text-sm text-wm-text2">Current Odometer (miles)</span>
          <input
            type="number"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder="e.g. 45000"
            className="w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text outline-none focus:border-wm-accent"
          />
          <span className="mt-1 block text-xs text-wm-text3">
            Used to calculate miles remaining on service reminders.
          </span>
        </label>

        {submitError && (
          <p className="rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || deleting}
          className="rounded-md bg-wm-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <div className="mt-10 border-t border-wm-border pt-6">
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting || isSubmitting}
          className="rounded-md border border-wm-red/50 bg-wm-red/10 px-4 py-2 text-sm font-medium text-wm-red hover:bg-wm-red/20 disabled:opacity-60"
        >
          {deleting ? "Deleting..." : "Delete Vehicle"}
        </button>
      </div>
    </div>
  );
}