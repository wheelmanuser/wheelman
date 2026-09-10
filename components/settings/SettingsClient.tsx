"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { useUserSettings } from "@/contexts/UserSettingsContext";
import type { User } from "@supabase/supabase-js";
import type { UserSettings } from "@/types/database";

type FormState = {
  display_name: string;
  driver_type: string | null;
  distance_unit: string;
  timezone: string;
  theme: string;
  email_reminders: boolean;
  sms_reminders: boolean;
  phone_number: string;
  reminder_lead_time: string;
  reminder_frequency: string;
  avatar_url: string | null;
};

const DRIVER_TYPES = [
  { value: "track_rat", label: "Track Rat", icon: "flag_circle", desc: "Built for circuit" },
  { value: "car_restorer", label: "Restorer", icon: "build_circle", desc: "Breathing life back in" },
  { value: "weekend_warrior", label: "Weekend Warrior", icon: "wb_sunny", desc: "Lives for the weekend drive" },
  { value: "daily_driver", label: "Daily Driver", icon: "commute", desc: "Every mile counts" },
  { value: "collector", label: "Collector", icon: "garage", desc: "The rarer the better" },
];

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Phoenix",
  "America/Halifax",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "W";
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        value ? "bg-wm-accent" : "bg-wm-s3"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
          value ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function SettingsClient({
  user,
  initialSettings,
}: {
  user: User | null;
  initialSettings: UserSettings | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { updateSettings } = useUserSettings();
  const emailDefault = user?.email?.split("@")[0] ?? "";

  const [form, setForm] = useState<FormState>({
    display_name: initialSettings?.display_name ?? emailDefault,
    driver_type: initialSettings?.driver_type ?? null,
    distance_unit: initialSettings?.distance_unit ?? "miles",
    timezone: initialSettings?.timezone ?? "America/Toronto",
    theme: initialSettings?.theme ?? "dark",
    email_reminders: initialSettings?.email_reminders ?? true,
    sms_reminders: initialSettings?.sms_reminders ?? false,
    phone_number: initialSettings?.phone_number ?? "",
    reminder_lead_time: initialSettings?.reminder_lead_time ?? "2_weeks",
    reminder_frequency: initialSettings?.reminder_frequency ?? "once",
    avatar_url: initialSettings?.avatar_url ?? null,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayNameForAvatar = form.display_name || emailDefault;

  const showSaved = () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSaved(true);
    savedTimer.current = setTimeout(() => setSaved(false), 3000);
  };

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const handleThemeChange = (theme: string) => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("wm-theme", theme);
    } catch {}
    set("theme", theme);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      const msg = authError?.message ?? "Not authenticated";
      console.error("[Settings] getUser failed:", msg);
      setSaveError(`Auth error: ${msg}`);
      setSaving(false);
      return;
    }

    const liveUserId = authData.user.id;
    const payload = {
      user_id: liveUserId,
      display_name: form.display_name || null,
      driver_type: form.driver_type,
      distance_unit: form.distance_unit,
      timezone: form.timezone,
      theme: form.theme,
      email_reminders: form.email_reminders,
      sms_reminders: form.sms_reminders,
      phone_number: form.phone_number || null,
      reminder_lead_time: form.reminder_lead_time,
      reminder_frequency: form.reminder_frequency,
      avatar_url: form.avatar_url,
      updated_at: new Date().toISOString(),
    };

    console.log("[Settings] user_id:", liveUserId);
    console.log("[Settings] payload:", payload);

    const { error } = await supabase
      .from("user_settings")
      .upsert(payload, { onConflict: "user_id" });

    console.log("[Settings] upsert error:", error);

    setSaving(false);
    if (error) {
      setSaveError(`Save failed: ${error.message} (code: ${error.code})`);
    } else {
      updateSettings({
        display_name: form.display_name || null,
        avatar_url: form.avatar_url,
        distance_unit: form.distance_unit,
        timezone: form.timezone,
        theme: form.theme,
      });
      showSaved();
      router.refresh();
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      set("avatar_url", data.publicUrl);
      await supabase.from("user_settings").upsert(
        { user_id: user.id, avatar_url: data.publicUrl, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
      showSaved();
    }
    setAvatarUploading(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <h2 className="font-headline text-2xl font-light tracking-wide text-wm-text">
        Profile &amp; Settings
      </h2>

      {/* PROFILE */}
      <section>
        <h3 className="label-technical mb-4 text-wm-text3">Profile</h3>
        <div className="space-y-5 border border-wm-border bg-wm-s1 p-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-wm-accent/40 bg-wm-accent-dark text-2xl font-medium text-wm-accent">
              {form.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                getInitial(displayNameForAvatar)
              )}
            </div>
            <div>
              <label className="cursor-pointer">
                <span className="label-technical border border-wm-accent px-3 py-1.5 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg">
                  {avatarUploading ? "Uploading..." : "Upload Photo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
              </label>
              <p className="mt-1 text-xs text-wm-text3">JPG, PNG, or WebP</p>
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="label-technical mb-1 block text-wm-text3" htmlFor="display-name">
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={form.display_name}
              onChange={(e) => set("display_name", e.target.value)}
              placeholder={emailDefault}
              className="w-full rounded-sm border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text outline-none focus:border-wm-accent"
            />
          </div>

          {/* Driver type */}
          <div>
            <span className="label-technical mb-3 block text-wm-text3">Driver Type</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DRIVER_TYPES.map((dt) => {
                const active = form.driver_type === dt.value;
                return (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => set("driver_type", dt.value)}
                    className={`flex flex-col items-start gap-1 border p-3 text-left transition-colors ${
                      active
                        ? "border-wm-gold bg-wm-accent-dark text-wm-gold"
                        : "border-wm-border bg-wm-s2 text-wm-text2 hover:border-wm-accent/40 hover:text-wm-text"
                    }`}
                  >
                    <Icon
                      name={dt.icon}
                      size={20}
                      className={active ? "text-wm-gold" : "text-wm-text3"}
                    />
                    <span className="font-headline text-sm font-semibold">{dt.label}</span>
                    <span className="text-xs opacity-70">{dt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* PREFERENCES */}
      <section>
        <h3 className="label-technical mb-4 text-wm-text3">Preferences</h3>
        <div className="space-y-5 border border-wm-border bg-wm-s1 p-6">
          {/* Distance units */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-wm-text">Distance Units</span>
            <div className="flex border border-wm-border">
              {(["miles", "km"] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => {
                    set("distance_unit", unit);
                    updateSettings({ distance_unit: unit });
                  }}
                  className={`label-technical px-4 py-1.5 transition-colors ${
                    form.distance_unit === unit
                      ? "bg-wm-accent-dark text-wm-accent"
                      : "text-wm-text3 hover:text-wm-text2"
                  }`}
                >
                  {unit === "miles" ? "Miles" : "Km"}
                </button>
              ))}
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="label-technical mb-1 block text-wm-text3" htmlFor="timezone">
              Timezone
            </label>
            <select
              id="timezone"
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              className="w-full rounded-sm border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text outline-none focus:border-wm-accent"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-wm-text">Theme</span>
            <div className="flex border border-wm-border">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleThemeChange(t)}
                  className={`label-technical px-4 py-1.5 transition-colors ${
                    form.theme === t
                      ? "bg-wm-accent-dark text-wm-accent"
                      : "text-wm-text3 hover:text-wm-text2"
                  }`}
                >
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* NOTIFICATIONS */}
      <section>
        <h3 className="label-technical mb-4 text-wm-text3">Notifications</h3>
        <div className="space-y-5 border border-wm-border bg-wm-s1 p-6">
          {/* Email reminders */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-wm-text">Email Reminders</p>
              <p className="text-xs text-wm-text3">Service alerts sent to {user?.email}</p>
            </div>
            <Toggle value={form.email_reminders} onChange={(v) => set("email_reminders", v)} />
          </div>

          {/* SMS reminders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-wm-text">SMS Reminders</p>
                <p className="text-xs text-wm-text3">Text alerts for upcoming service</p>
              </div>
              <Toggle value={form.sms_reminders} onChange={(v) => set("sms_reminders", v)} />
            </div>
            {form.sms_reminders && (
              <input
                type="tel"
                placeholder="e.g. +1 416 555 0100"
                value={form.phone_number}
                onChange={(e) => set("phone_number", e.target.value)}
                className="w-full rounded-sm border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text outline-none focus:border-wm-accent"
              />
            )}
          </div>

          {/* Reminder lead time */}
          <div>
            <span className="label-technical mb-2 block text-wm-text3">Reminder Lead Time</span>
            <div className="flex border border-wm-border">
              {(
                [
                  { value: "1_week", label: "1 Week" },
                  { value: "2_weeks", label: "2 Weeks" },
                  { value: "1_month", label: "1 Month" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("reminder_lead_time", opt.value)}
                  className={`flex-1 label-technical py-1.5 transition-colors ${
                    form.reminder_lead_time === opt.value
                      ? "bg-wm-accent-dark text-wm-accent"
                      : "text-wm-text3 hover:text-wm-text2"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reminder frequency */}
          <div>
            <span className="label-technical mb-2 block text-wm-text3">Reminder Frequency</span>
            <div className="flex border border-wm-border">
              {(
                [
                  { value: "once", label: "Once" },
                  { value: "weekly", label: "Weekly" },
                  { value: "until_resolved", label: "Until Resolved" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("reminder_frequency", opt.value)}
                  className={`flex-1 label-technical py-1.5 transition-colors ${
                    form.reminder_frequency === opt.value
                      ? "bg-wm-accent-dark text-wm-accent"
                      : "text-wm-text3 hover:text-wm-text2"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center justify-end pb-10">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="label-technical border border-wm-accent bg-wm-accent-dark px-6 py-2.5 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border border-wm-red bg-wm-red/10 px-6 py-3 shadow-xl">
          <Icon name="error" className="text-wm-red" size={18} />
          <span className="label-technical text-wm-red tracking-widest">{saveError}</span>
        </div>
      )}

      {/* Toast */}
      {saved && (
        <div className="animate-fade-in fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border border-wm-accent bg-wm-accent-dark px-6 py-3 shadow-xl">
          <Icon name="task_alt" className="text-wm-accent" size={18} />
          <span className="label-technical text-wm-accent tracking-widest">Changes Saved</span>
        </div>
      )}
    </div>
  );
}
