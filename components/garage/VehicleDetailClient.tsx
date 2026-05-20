"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import {
  enrichSchedules,
  statusToneClass,
  type ScheduleWithPct,
} from "@/lib/service-schedule-display";
import { VehicleLogbookClient } from "@/components/logbook/VehicleLogbookClient";
import { VehicleCostsClient } from "@/components/garage/VehicleCostsClient";
import type { Vehicle } from "@/types/database";

type Tab = "overview" | "logbook" | "costs";

type ReminderForm = {
  service_name: string;
  is_recurring: boolean;
  interval_miles: string;
  interval_months: string;
  last_performed_miles: string;
  last_performed_date: string;
  due_date: string;
  due_miles: string;
};

type DoneForm = {
  service_name: string;
  completion_date: string;
  completion_miles: string;
  cost: string;
  notes: string;
};

type Props = {
  vehicle: Vehicle;
  hasDevice: boolean;
  initialSchedules: ScheduleWithPct[];
};

export function VehicleDetailClient({ vehicle, hasDevice, initialSchedules }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithPct | null>(null);
  const [schedules, setSchedules] = useState<ScheduleWithPct[]>(initialSchedules);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const [doneSchedule, setDoneSchedule] = useState<ScheduleWithPct | null>(null);
  const [doneSaving, setDoneSaving] = useState(false);
  const [doneError, setDoneError] = useState<string | null>(null);

  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  const dueCount = useMemo(
    () => schedules.filter((s) => s.is_overdue || (s.pct_remaining != null && s.pct_remaining <= 20)).length,
    [schedules],
  );

  const specs = useMemo(
    () => [
      ["Year", String(vehicle.year)],
      ["Make", vehicle.make],
      ["Model", vehicle.model],
      ["Trim", vehicle.trim ?? "—"],
      ["Colour", vehicle.color ?? "—"],
      ["Transmission", vehicle.transmission ?? "—"],
      ["Purchase Price", vehicle.purchase_price != null ? `$${vehicle.purchase_price}` : "—"],
      ["Est. Mi/Year", vehicle.estimated_miles_per_year != null ? String(vehicle.estimated_miles_per_year) : "—"],
    ],
    [vehicle],
  );

  const reminderForm = useForm<ReminderForm>({
    defaultValues: {
      service_name: "",
      is_recurring: true,
      interval_miles: "",
      interval_months: "",
      last_performed_miles: "",
      last_performed_date: "",
      due_date: "",
      due_miles: "",
    },
  });

  const isRecurring = reminderForm.watch("is_recurring");

  const doneForm = useForm<DoneForm>({
    defaultValues: { service_name: "", completion_date: "", completion_miles: "", cost: "", notes: "" },
  });

  const openNewDrawer = () => {
    setEditingSchedule(null);
    reminderForm.reset({
      service_name: "",
      is_recurring: true,
      interval_miles: "",
      interval_months: "",
      last_performed_miles: "",
      last_performed_date: "",
      due_date: "",
      due_miles: "",
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (s: ScheduleWithPct) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = s as any;
    setEditingSchedule(s);
    reminderForm.reset({
      service_name: s.service_name,
      is_recurring: raw.is_recurring !== false,
      interval_miles: s.interval_miles != null ? String(s.interval_miles) : "",
      interval_months: s.interval_months != null ? String(s.interval_months) : "",
      last_performed_miles: s.last_performed_miles != null ? String(s.last_performed_miles) : "",
      last_performed_date: s.last_performed_date ?? "",
      due_date: raw.due_date ?? "",
      due_miles: raw.due_miles != null ? String(raw.due_miles) : "",
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingSchedule(null);
    setFormError(null);
  };

  const refreshSchedules = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("service_schedules")
      .select("*")
      .eq("vehicle_id", vehicle.id)
      .eq("is_active", true)
      .order("service_name");
    if (!error && data) setSchedules(enrichSchedules(vehicle, data));
  };

  const onDeleteReminder = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("service_schedules").delete().eq("id", id);
    if (!error) {
      await refreshSchedules();
      router.refresh();
    }
  };

  const onSaveReminder = async (values: ReminderForm) => {
    if (!values.service_name.trim()) {
      setFormError("Service name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFormError("Not signed in.");
      setSaving(false);
      return;
    }

    const parseOptInt = (s: string) => {
      if (!s.trim()) return null;
      const n = Number(s);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    };

    const payload = values.is_recurring
      ? {
          service_name: values.service_name.trim(),
          is_recurring: true,
          interval_miles: parseOptInt(values.interval_miles),
          interval_months: parseOptInt(values.interval_months),
          last_performed_miles: parseOptInt(values.last_performed_miles),
          last_performed_date: values.last_performed_date || null,
          due_date: null,
          due_miles: null,
        }
      : {
          service_name: values.service_name.trim(),
          is_recurring: false,
          interval_miles: null,
          interval_months: null,
          last_performed_miles: null,
          last_performed_date: null,
          due_date: values.due_date || null,
          due_miles: parseOptInt(values.due_miles),
        };

    let error;
    if (editingSchedule) {
      ({ error } = await supabase
        .from("service_schedules")
        .update(payload)
        .eq("id", editingSchedule.id));
    } else {
      ({ error } = await supabase.from("service_schedules").insert({
        ...payload,
        vehicle_id: vehicle.id,
        user_id: user.id,
        source: "user",
        is_active: true,
      }));
    }

    if (error) {
      setFormError(error.message);
    } else {
      closeDrawer();
      await refreshSchedules();
      router.refresh();
    }
    setSaving(false);
  };

  const openDoneModal = (s: ScheduleWithPct) => {
    setDoneSchedule(s);
    doneForm.reset({
      service_name: s.service_name,
      completion_date: new Date().toISOString().split("T")[0],
      completion_miles: vehicle.odometer_miles != null ? String(vehicle.odometer_miles) : "",
      cost: "",
      notes: "",
    });
    setDoneError(null);
    setDoneModalOpen(true);
  };

  const closeDoneModal = () => {
    setDoneModalOpen(false);
    setDoneSchedule(null);
    setDoneError(null);
  };

  const onSaveDone = async (values: DoneForm) => {
    if (!doneSchedule) return;
    setDoneSaving(true);
    setDoneError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setDoneError("Not signed in.");
      setDoneSaving(false);
      return;
    }

    const completionMiles = values.completion_miles.trim() ? Number(values.completion_miles) : null;
    const cost = values.cost.trim() ? Number(values.cost) : null;

    const { error: logError } = await supabase.from("logbook_entries").insert({
      vehicle_id: vehicle.id,
      user_id: user.id,
      category: "maintenance" as const,
      title: doneSchedule.service_name,
      event_date: values.completion_date,
      odometer_miles: completionMiles,
      total_cost: cost,
      notes: values.notes.trim() || null,
      entry_mode: "form" as const,
      is_public: false,
    });

    if (logError) {
      setDoneError(logError.message);
      setDoneSaving(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawDone = doneSchedule as any;
    const { error: schedError } = await supabase
      .from("service_schedules")
      .update(
        rawDone.is_recurring !== false
          ? { last_performed_miles: completionMiles, last_performed_date: values.completion_date, is_active: true }
          : { is_active: false },
      )
      .eq("id", doneSchedule.id);

    if (schedError) {
      setDoneError(schedError.message);
      setDoneSaving(false);
      return;
    }

    closeDoneModal();
    await refreshSchedules();
    router.refresh();
    setDoneSaving(false);
  };

  const formatNextDue = (s: ScheduleWithPct) => {
    const parts: string[] = [];
    if (s.computed_next_due_miles != null)
      parts.push(`${s.computed_next_due_miles.toLocaleString()} mi`);
    if (s.computed_next_due_date != null) {
      const d = new Date(s.computed_next_due_date);
      parts.push(d.toLocaleDateString("en-US", { month: "short", year: "numeric" }));
    }
    return parts.length > 0 ? parts.join(" · ") : "—";
  };

  return (
    <div>
      <Link href="/garage" className="text-sm text-wm-text2 hover:text-wm-text">
        ← Back to Garage
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold text-wm-text">{title}</h2>
        <Link
          href={`/garage/${vehicle.id}/edit`}
          className="rounded-md border border-wm-border bg-wm-s2 px-3 py-1.5 text-sm text-wm-text hover:bg-wm-s3"
        >
          Edit
        </Link>
      </div>

      <section className="relative mt-6 overflow-hidden rounded-sm border border-wm-border bg-gradient-to-br from-wm-s2 to-wm-s3 px-8 py-12">
        <div className="absolute right-4 top-4">
          <span className={hasDevice
            ? "border border-wm-accent/30 px-2 py-1 text-xs uppercase tracking-widest text-wm-accent"
            : "border border-wm-border px-2 py-1 text-xs uppercase tracking-widest text-wm-text3"
          }>
            {hasDevice ? "WhereQube" : "No Device"}
          </span>
        </div>
        <div className="flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-wm-text3">{vehicle.year}</p>
          <h3 className="mt-2 text-4xl font-light tracking-wide text-wm-text">{vehicle.make}</h3>
          <p className="mt-1 text-base font-light tracking-[0.25em] text-wm-text2">{vehicle.model}</p>
          {vehicle.vin && (
            <p className="mt-6 font-mono text-xs text-wm-text3">VIN {vehicle.vin}</p>
          )}
        </div>
      </section>

      <div className="mt-8 flex gap-8 border-b border-wm-border">
        {(["overview", "logbook", "costs"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`pb-2.5 text-xs uppercase tracking-widest transition-colors ${tab === id ? "border-b-2 border-wm-accent text-wm-text" : "text-wm-text3 hover:text-wm-text2"}`}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="space-y-8">
            <section>
              <h3 className="mb-3 text-xs uppercase tracking-widest text-wm-text3">Vehicle Specs</h3>
              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-wm-border bg-wm-border md:grid-cols-2">
                {specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 bg-wm-s1 px-4 py-3 text-sm">
                    <span className="text-wm-text2">{k}</span>
                    <span className="text-right text-wm-text">{v}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs uppercase tracking-widest text-wm-text3">Service Reminders</h3>
                  {dueCount > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-wm-red text-xs font-bold text-white">
                      {dueCount}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openNewDrawer}
                  className="rounded-sm bg-wm-accent px-3 py-1.5 text-xs uppercase tracking-wider text-white"
                >
                  Add Reminder
                </button>
              </div>

              {schedules.length === 0 ? (
                <p className="text-sm text-wm-text2">No service reminders yet.</p>
              ) : (
                <ul className="space-y-2">
                  {schedules.map((s) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const raw = s as any;
                    return (
                      <li
                        key={s.id}
                        className={`border border-wm-border bg-wm-s1 px-4 py-3 text-sm ${
                          s.is_overdue
                            ? "border-l-2 border-l-wm-red"
                            : s.pct_remaining != null && s.pct_remaining <= 30
                            ? "border-l-2 border-l-wm-orange"
                            : "border-l-2 border-l-wm-green"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-wm-text">{s.service_name}</span>
                              <span className="rounded-full bg-wm-s2 px-2 py-0.5 text-xs text-wm-text3">
                                {raw.is_recurring !== false ? "Recurring" : "One-time"}
                              </span>
                              {s.is_overdue && (
                                <span className="rounded-full bg-wm-red/20 px-2 py-0.5 text-xs text-wm-red">
                                  Overdue
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-wm-text2">
                              Next due: {formatNextDue(s)}
                            </p>
                            {s.miles_remaining != null && (
                              <p className="mt-0.5 text-xs text-wm-text2">
                                Miles remaining:{" "}
                                <span className={statusToneClass(s.pct_remaining, s.is_overdue)}>
                                  {Math.round(s.miles_remaining).toLocaleString()}
                                </span>
                                {s.pct_remaining != null && !Number.isNaN(s.pct_remaining) && (
                                  <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                    s.is_overdue
                                      ? "bg-wm-red/20 text-wm-red"
                                      : s.pct_remaining <= 30
                                      ? "bg-wm-orange/20 text-wm-orange"
                                      : "bg-wm-green/20 text-wm-green"
                                  }`}>
                                    {s.is_overdue ? "Overdue" : s.pct_remaining <= 30 ? "Due soon" : "Good"}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-3">
                            <button
                              type="button"
                              onClick={() => openDoneModal(s)}
                              className="text-xs uppercase tracking-wider text-wm-accent hover:opacity-70"
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditDrawer(s)}
                              className="text-xs uppercase tracking-wider text-wm-text3 hover:text-wm-text2"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteReminder(s.id)}
                              className="text-xs uppercase tracking-wider text-wm-red hover:opacity-70"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {!hasDevice && (
              <div className="rounded-xl border border-dashed border-wm-border bg-wm-s2/50 p-6 opacity-70">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-wm-text2">Connect WhereQube</p>
                  <span className="rounded-full bg-wm-s3 px-2 py-0.5 text-xs text-wm-text3">Coming in v2</span>
                </div>
                <p className="mt-2 text-xs text-wm-text3">Telematics integration will arrive in a future release.</p>
              </div>
            )}
          </div>
        )}

        {tab === "logbook" && (
          <VehicleLogbookClient vehicleId={vehicle.id} vehicleTitle={title} />
        )}

        {tab === "costs" && (
          <VehicleCostsClient vehicleId={vehicle.id} odometerMiles={vehicle.odometer_miles} />
        )}
      </div>

      {doneModalOpen && doneSchedule && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-wm-bg/70"
            aria-label="Close modal"
            onClick={closeDoneModal}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-wm-border bg-wm-s1 p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-wm-text">Mark as Done</h3>
                <button type="button" onClick={closeDoneModal} className="text-wm-text2 hover:text-wm-text">✕</button>
              </div>

              <form
                className="mt-6 flex flex-col gap-4"
                onSubmit={doneForm.handleSubmit(onSaveDone)}
              >
                <label className="block text-sm">
                  <span className="text-wm-text2">Service</span>
                  <input
                    readOnly
                    className="mt-1 w-full cursor-default rounded-md border border-wm-border bg-wm-s2/50 px-3 py-2 text-wm-text opacity-70"
                    {...doneForm.register("service_name")}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="text-wm-text2">Completion Date</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                      {...doneForm.register("completion_date")}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-wm-text2">Mileage</span>
                    <input
                      type="number"
                      placeholder="Odometer reading"
                      className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                      {...doneForm.register("completion_miles")}
                    />
                  </label>
                </div>

                <label className="block text-sm">
                  <span className="text-wm-text2">Cost (optional)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 59.99"
                    className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                    {...doneForm.register("cost")}
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-wm-text2">Notes (optional)</span>
                  <textarea
                    rows={3}
                    placeholder="Any notes about this service..."
                    className="mt-1 w-full resize-none rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                    {...doneForm.register("notes")}
                  />
                </label>

                {doneError && <p className="text-sm text-wm-red">{doneError}</p>}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeDoneModal}
                    className="flex-1 rounded-md border border-wm-border bg-wm-s2 py-2 text-sm font-medium text-wm-text hover:bg-wm-s3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={doneSaving}
                    className="flex-1 rounded-sm bg-wm-accent py-2 text-xs uppercase tracking-wider text-white disabled:opacity-60"
                  >
                    {doneSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {drawerOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-wm-bg/70"
            aria-label="Close drawer"
            onClick={closeDrawer}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-wm-border bg-wm-s1 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-wm-text">
                {editingSchedule ? "Edit Reminder" : "New Reminder"}
              </h3>
              <button type="button" onClick={closeDrawer} className="text-wm-text2 hover:text-wm-text">✕</button>
            </div>

            <form
              className="mt-6 flex flex-1 flex-col gap-4 overflow-y-auto"
              onSubmit={reminderForm.handleSubmit(onSaveReminder)}
            >
              <label className="block text-sm">
                <span className="text-wm-text2">Service Name</span>
                <input
                  className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                  placeholder="e.g. Oil Change"
                  {...reminderForm.register("service_name")}
                />
              </label>

              <div>
                <span className="text-sm text-wm-text2">Reminder Type</span>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => reminderForm.setValue("is_recurring", true)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      isRecurring
                        ? "border-wm-accent bg-wm-accent/10 text-wm-accent"
                        : "border-wm-border bg-wm-s2 text-wm-text2"
                    }`}
                  >
                    Recurring
                  </button>
                  <button
                    type="button"
                    onClick={() => reminderForm.setValue("is_recurring", false)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      !isRecurring
                        ? "border-wm-accent bg-wm-accent/10 text-wm-accent"
                        : "border-wm-border bg-wm-s2 text-wm-text2"
                    }`}
                  >
                    One-time
                  </button>
                </div>
              </div>

              {isRecurring ? (
                <>
                  <p className="text-xs text-wm-text3">
                    Set how often this service repeats and when it was last performed.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="text-wm-text2">Every (miles)</span>
                      <input
                        type="number"
                        placeholder="e.g. 5000"
                        className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                        {...reminderForm.register("interval_miles")}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-wm-text2">Every (months)</span>
                      <input
                        type="number"
                        placeholder="e.g. 6"
                        className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                        {...reminderForm.register("interval_months")}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="text-wm-text2">Last done (miles)</span>
                      <input
                        type="number"
                        placeholder="Odometer reading"
                        className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                        {...reminderForm.register("last_performed_miles")}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-wm-text2">Last done (date)</span>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                        {...reminderForm.register("last_performed_date")}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-wm-text3">
                    Set a specific date or mileage for this one-time reminder.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="text-wm-text2">Due date</span>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                        {...reminderForm.register("due_date")}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-wm-text2">Due mileage</span>
                      <input
                        type="number"
                        placeholder="e.g. 50000"
                        className="mt-1 w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-wm-text"
                        {...reminderForm.register("due_miles")}
                      />
                    </label>
                  </div>
                </>
              )}

              {formError && <p className="text-sm text-wm-red">{formError}</p>}

              <button
                type="submit"
                disabled={saving}
                className="mt-auto rounded-sm bg-wm-accent py-2 text-xs uppercase tracking-wider text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : editingSchedule ? "Update Reminder" : "Save Reminder"}
              </button>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}