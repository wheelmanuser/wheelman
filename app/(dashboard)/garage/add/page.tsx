"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { canAddVehicle } from "@/constants/subscriptions";
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
  const [canAdd, setCanAdd] = useState<boolean | null>(null);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
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

  // Check whether the user is allowed to add another vehicle
  useEffect(() => {
    const checkLimit = async () => {
      const { count } = await supabase
        .from("vehicles")
        .select("id", { count: "exact", head: true });

      const { data: userRow } = await supabase
        .from("users")
        .select("subscription_tier")
        .maybeSingle();

      const tier =
        (userRow as { subscription_tier?: string } | null)?.subscription_tier ??
        "free";
      setCanAdd(canAddVehicle(count ?? 0, tier));
    };
    void checkLimit();
  }, [supabase]);

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

      <h2 className="mt-4 text-2xl font-semibold text-wm-text">Add Vehicle</h2>

      {canAdd === false ? (
        <div className="mt-6 rounded-xl border border-wm-gold/40 bg-wm-s1 p-6">
          <p className="text-sm text-wm-text2">
            Your Free plan supports 1 vehicle. Upgrade to add more vehicles.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-wm-gold px-4 py-2 text-sm font-medium text-wm-bg"
          >
            Upgrade Plan
          </button>
        </div>
      ) : (
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

          {submitError && (
            <p className="rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || canAdd === null}
            className="rounded-md bg-wm-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save Vehicle"}
          </button>
        </form>
      )}
    </div>
  );
}