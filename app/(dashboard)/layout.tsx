import { createClient } from "@/lib/supabase/server";
import { DashboardLayoutClient } from "@/components/layout/DashboardLayoutClient";
import type { UserSettings } from "@/types/database";

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
    id: "",
    user_id: user?.id ?? "",
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

  let initialSettings = defaultSettings;
  if (user) {
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    const row = data as UserSettings | null;
    if (row) {
      initialSettings = {
        ...row,
        distance_unit: row.distance_unit ?? "miles",
        timezone: row.timezone ?? "America/Toronto",
        theme: row.theme ?? "dark",
      };
    }
  }

  return (
    <DashboardLayoutClient initialSettings={initialSettings}>
      {children}
    </DashboardLayoutClient>
  );
}
