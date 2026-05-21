import { createClient } from "@/lib/supabase/server";
import { DashboardLayoutClient } from "@/components/layout/DashboardLayoutClient";
import type { UserSettings } from "@/contexts/UserSettingsContext";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const defaultSettings: UserSettings = {
    display_name: null,
    avatar_url: null,
    distance_unit: "miles",
    timezone: "America/Toronto",
    theme: "dark",
  };

  let initialSettings = defaultSettings;
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("user_settings")
      .select("display_name,avatar_url,distance_unit,timezone,theme")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      initialSettings = {
        display_name: data.display_name ?? null,
        avatar_url: data.avatar_url ?? null,
        distance_unit: data.distance_unit ?? "miles",
        timezone: data.timezone ?? "America/Toronto",
        theme: data.theme ?? "dark",
      };
    }
  }

  return (
    <DashboardLayoutClient initialSettings={initialSettings}>
      {children}
    </DashboardLayoutClient>
  );
}
