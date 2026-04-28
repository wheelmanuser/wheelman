"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuthStore } from "@/stores/authStore";

const SupabaseContext = createContext<SupabaseClient | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const initializeAuth = useAuthStore((state) => state.initialize);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createBrowserClient(url, key);
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void initializeAuth().then((unsubscribe) => {
      cleanup = unsubscribe;
    });
    return () => {
      cleanup?.();
    };
  }, [initializeAuth]);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase(): SupabaseClient {
  const client = useContext(SupabaseContext);
  if (!client) {
    throw new Error(
      "Supabase client unavailable. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, and render under SupabaseProvider.",
    );
  }
  return client;
}
