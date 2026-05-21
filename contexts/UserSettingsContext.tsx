"use client";
import { createContext, useContext, useState, useEffect } from "react";

export type UserSettings = {
  display_name: string | null;
  avatar_url: string | null;
  distance_unit: string;
  timezone: string;
  theme: string;
};

const UserSettingsContext = createContext<{
  settings: UserSettings;
  updateSettings: (s: Partial<UserSettings>) => void;
}>({
  settings: { display_name: null, avatar_url: null, distance_unit: "miles", timezone: "America/Toronto", theme: "dark" },
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
