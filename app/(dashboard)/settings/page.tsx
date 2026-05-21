import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = user
    ? await supabase.from("user_settings").select("*").eq("user_id", user.id).single()
    : { data: null };

  return <SettingsClient user={user} initialSettings={settings} />;
}
