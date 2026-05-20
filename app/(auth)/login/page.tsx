"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const errorMessages: Record<string, string> = {
  missing_oauth_code: "Missing OAuth code. Please try signing in again.",
  auth_exchange_failed: "Sign-in failed while exchanging the OAuth session.",
  missing_authenticated_user: "Sign-in failed because no authenticated user was found.",
  profile_sync_failed: "Signed in, but profile sync failed. Please try again.",
};

export default function LoginPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [callbackMessage, setCallbackMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get("error");
    if (callbackError) {
      setCallbackMessage(
        errorMessages[callbackError] ?? "Sign-in failed. Please try again.",
      );
    }

    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // Keep the user on login if env/session check fails.
      }
      setIsCheckingSession(false);
    };
    void checkAuth();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setLocalError(error.message);
        setIsLoading(false);
      }
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Unexpected sign-in error.",
      );
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-wm-bg px-6">
        <p className="text-sm text-wm-text2">Preparing sign in...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-wm-bg px-6">
      <section className="w-full max-w-md border border-wm-border border-l-4 border-l-wm-accent bg-wm-s1 p-8">
        <h1 className="font-headline text-center text-4xl font-bold tracking-[0.18em]">
          <span className="text-wm-text">WHEEL</span>
          <span className="text-wm-gold">MAN</span>
        </h1>
        <p className="mt-3 text-center text-sm text-wm-text2">
          Your premium automotive companion
        </p>

        {(callbackMessage || localError) && (
          <p className="mt-4 rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
            {localError ?? callbackMessage}
          </p>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="label-technical mt-6 w-full rounded-sm border border-wm-accent bg-wm-accent-dark px-4 py-2 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Redirecting..." : "Continue with Google"}
        </button>

        <p className="mt-6 text-center text-xs text-wm-text3">
          By continuing, you agree to our{" "}
          <Link href="#" className="text-wm-text2 hover:text-wm-text">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="text-wm-text2 hover:text-wm-text">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
