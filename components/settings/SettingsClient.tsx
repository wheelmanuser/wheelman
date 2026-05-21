"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import type { User } from "@supabase/supabase-js";

type Settings = {
  id?: string;
  user_id?: string;
  driver_type?: string | null;
  distance_unit?: string;
  timezone?: string;
  theme?: string;
  email_reminders?: boolean;
  sms_reminders?: boolean;
  phone_number?: string | null;
  reminder_lead_time?: string;
  reminder_frequency?: string;
  avatar_url?: string | null;
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

function getInitial(name: string | null | undefined): string {
  if (!name) return "W";
  return name.trim().charAt(0).toUpperCase();
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
        checked ? "border-wm-accent bg-wm-accent" : "border-wm-border bg-wm-s3"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-wm-bg shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
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
  initialSettings: Settings | null;
}) {
  const supabase = createClient();
  const [settings, setSettings] = useState<Settings>(initialSettings ?? {});
  const [savedFlash, setSavedFlash] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    (user?.email?.split("@")[0] ?? "Driver");

  const showSaved = () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setSavedFlash(true);
    flashTimer.current = setTimeout(() => setSavedFlash(false), 2000);
  };

  const save = async (patch: Partial<Settings>) => {
    if (!user) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    const { error } = await supabase.from("user_settings").upsert(
      { ...next, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (!error) showSaved();
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
      await save({ avatar_url: data.publicUrl });
    }
    setAvatarUploading(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div className="flex items-center justify-between">
        <h2 className="font-headline text-2xl font-light tracking-wide text-wm-text">
          Profile &amp; Settings
        </h2>
        <span
          className={`label-technical text-wm-accent transition-opacity duration-300 ${savedFlash ? "opacity-100" : "opacity-0"}`}
        >
          Saved
        </span>
      </div>

      {/* PROFILE */}
      <section>
        <h3 className="label-technical mb-4 text-wm-text3">Profile</h3>
        <div className="space-y-5 border border-wm-border bg-wm-s1 p-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-wm-accent/40 bg-wm-accent-dark text-2xl font-medium text-wm-accent">
              {settings.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.avatar_url}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitial(displayName)
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

          {/* Display name (read-only) */}
          <div>
            <span className="label-technical mb-1 block text-wm-text3">Display Name</span>
            <p className="rounded-sm border border-wm-border bg-wm-s2/50 px-3 py-2 text-sm text-wm-text opacity-70">
              {displayName}
            </p>
          </div>

          {/* Driver type */}
          <div>
            <span className="label-technical mb-3 block text-wm-text3">Driver Type</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DRIVER_TYPES.map((dt) => {
                const active = settings.driver_type === dt.value;
                return (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => save({ driver_type: dt.value })}
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
                  onClick={() => save({ distance_unit: unit })}
                  className={`label-technical px-4 py-1.5 transition-colors ${
                    (settings.distance_unit ?? "miles") === unit
                      ? "bg-wm-accent-dark text-wm-accent"
                      : "text-wm-text3 hover:text-wm-text2"
                  }`}
                >
                  {unit === "miles" ? "Miles" : "Kilometers"}
                </button>
              ))}
            </div>
          </div>

          {/* Timezone */}
          <div>
            <span className="label-technical mb-1 block text-wm-text3">Timezone</span>
            <select
              value={settings.timezone ?? "America/Toronto"}
              onChange={(e) => save({ timezone: e.target.value })}
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
              {(["dark", "light"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => {
                    document.documentElement.setAttribute("data-theme", theme);
                    void save({ theme });
                  }}
                  className={`label-technical px-4 py-1.5 transition-colors ${
                    (settings.theme ?? "dark") === theme
                      ? "bg-wm-accent-dark text-wm-accent"
                      : "text-wm-text3 hover:text-wm-text2"
                  }`}
                >
                  {theme === "dark" ? "Dark" : "Light"}
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
            <Toggle
              checked={settings.email_reminders ?? true}
              onChange={(v) => save({ email_reminders: v })}
            />
          </div>

          {/* SMS reminders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-wm-text">SMS Reminders</p>
                <p className="text-xs text-wm-text3">Text alerts for upcoming service</p>
              </div>
              <Toggle
                checked={settings.sms_reminders ?? false}
                onChange={(v) => save({ sms_reminders: v })}
              />
            </div>
            {settings.sms_reminders && (
              <input
                type="tel"
                placeholder="e.g. +1 416 555 0100"
                value={settings.phone_number ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, phone_number: e.target.value }))
                }
                onBlur={(e) => save({ phone_number: e.target.value || null })}
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
                  onClick={() => save({ reminder_lead_time: opt.value })}
                  className={`flex-1 py-1.5 label-technical transition-colors ${
                    (settings.reminder_lead_time ?? "2_weeks") === opt.value
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
                  onClick={() => save({ reminder_frequency: opt.value })}
                  className={`flex-1 py-1.5 label-technical transition-colors ${
                    (settings.reminder_frequency ?? "once") === opt.value
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
    </div>
  );
}
