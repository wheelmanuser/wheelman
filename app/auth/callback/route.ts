import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin;

  if (!code) {
    console.error("[callback] No OAuth code in request");
    return NextResponse.redirect(`${origin}/login?error=missing_oauth_code`);
  }

  // 1 — Exchange the code for a session
  const supabase = createServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[callback] Code exchange failed:", exchangeError.message);
    return NextResponse.redirect(`${origin}/login?error=auth_exchange_failed`);
  }

  // 2 — Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[callback] Could not get user after exchange:", userError?.message);
    return NextResponse.redirect(`${origin}/login?error=missing_authenticated_user`);
  }

  console.log("[callback] Authenticated user:", user.id, user.email);

  // 3 — Upsert the public.users profile row using the service role key
  //     (bypasses RLS so this always works regardless of session state)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceRoleKey) {
    console.error("[callback] SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.redirect(`${origin}/login?error=server_config_error`);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Build a clean username from the email prefix
  const emailPrefix = user.email?.split("@")[0] ?? "user";
  const username = emailPrefix
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    + "_" + user.id.slice(0, 6);

  const displayName =
    (user.user_metadata?.full_name as string) ??
    (user.user_metadata?.name as string) ??
    emailPrefix;

  const { error: upsertError } = await admin
    .from("users")
    .upsert(
      {
        id: user.id,
        username,
        display_name: displayName,
        subscription_tier: "free",
        units: "imperial",
        notifications_enabled: true,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

  if (upsertError) {
    console.error("[callback] Failed to upsert public.users row:", upsertError.message);
    return NextResponse.redirect(`${origin}/login?error=profile_sync_failed`);
  }

  console.log("[callback] Profile row upserted for:", user.id);

  // 4 — All good — send the user to the dashboard
  return NextResponse.redirect(`${origin}/dashboard`);
}