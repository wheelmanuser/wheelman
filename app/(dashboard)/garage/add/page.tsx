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

export default function GarageAddPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      nickname: "",
      year: new Date().getFullYear(),
      make: "",
      model: "",
      trim: "",
      color: "",
      transmission: "",
      vin: "",
      purchase_price: undefined,
      estimated_miles_per_year: undefined,
    },
  });

  const onSubmit = async (values: VehicleFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error: insertError } = await supabase
        .from("vehicles")
        .insert({
          user_id: user.id,
          nickname: values.nickname || null,
          year: values.year,
          make: values.make,
          model: values.model,
          trim: values.trim || null,
          color: values.color || null,
          transmission: values.transmission || null,
          vin: values.vin || null,
          purchase_price: values.purchase_price ?? null,
          estimated_miles_per_year: values.estimated_miles_per_year ?? null,
          odometer_miles: null,
          odometer_source: "manual",
          is_primary: false,
        })
        .select("id")
        .single();

      if (insertError || !data) {
        throw new Error(insertError?.message ?? "Failed to save vehicle");
      }

      router.push(`/garage/${data.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save vehicle.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/garage" className="text-sm text-wm-text2 hover:text-wm-text">
        ← Back to Garage
      </Link>

      <h2 className="font-headline mt-4 text-2xl font-light tracking-wide text-wm-text">Add Vehicle</h2>

      <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-6 space-y-4 border border-wm-border bg-wm-s1 p-6"
        >
          <label className="block">
            <span className="label-technical mb-1 block text-wm-text3">Nickname (optional)</span>
            <input
              type="text"
              {...form.register("nickname")}
              placeholder="e.g. The Beast, Track Car"
              className="w-full rounded-sm border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text outline-none focus:border-wm-accent"
            />
          </label>

          {VEHICLE_FORM_FIELDS.map((field) => {
            const errorMessage = form.formState.errors[field.name]?.message;
            const isNumber = field.type === "number";

            return (
              <label key={field.name} className="block">
                <span className="label-technical mb-1 block text-wm-text3">{field.label}</span>
                <input
                  type={field.type}
                  {...form.register(field.name, {
                    setValueAs: isNumber
                      ? (v) => (v === "" ? undefined : Number(v))
                      : undefined,
                  })}
                  className="w-full rounded-sm border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text outline-none focus:border-wm-accent"
                />
                {errorMessage && (
                  <span className="mt-1 block text-xs text-wm-red">{errorMessage}</span>
                )}
              </label>
            );
          })}

          {submitError && (
            <p className="rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-sm border border-wm-accent bg-wm-accent-dark px-4 py-2 text-xs uppercase tracking-wider text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save Vehicle"}
          </button>
        </form>
    </div>
  );
}