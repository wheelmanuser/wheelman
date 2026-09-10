"use client";
import { createContext, useContext, useState } from "react";
import type { UserSettings } from "@/types/database";

export type { UserSettings };

const DEFAULT_SETTINGS: UserSettings = {
  id: "",
  user_id: "",
  driver_type: null,
  distance_unit: "miles",
  timezone: "America/Toronto",
  theme: "dark",
  email_reminders: null,
  sms_reminders: null,
  phone_number: null,
  reminder_lead_time: null,
  reminder_frequency: null,
  avatar_url: null,
  display_name: null,
  created_at: null,
  updated_at: null,
};

const UserSettingsContext = createContext<{
  settings: UserSettings;
  updateSettings: (s: Partial<UserSettings>) => void;
}>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
});

export function UserSettingsProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: UserSettings;
}) {
  const [settings, setSettings] = useState<UserSettings>(initial);
  const updateSettings = (s: Partial<UserSettings>) =>
    setSettings((prev) => ({ ...prev, ...s }));
  return (
    <UserSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export const useUserSettings = () => useContext(UserSettingsContext);
