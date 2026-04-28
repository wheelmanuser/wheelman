import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type AuthState = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  setUser: (user: User | null, session: Session | null) => void;
  clearUser: () => void;
  initialize: () => Promise<() => void>;
};

let unsubscribeAuth: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  setUser: (user, session) =>
    set({
      user,
      session,
      isLoading: false,
    }),
  clearUser: () =>
    set({
      user: null,
      session: null,
      isLoading: false,
    }),
  initialize: async () => {
    const supabase = createClient();

    if (unsubscribeAuth) {
      unsubscribeAuth();
      unsubscribeAuth = null;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      set({ user: null, session: null, isLoading: false });
    } else {
      set({
        user: data.session.user,
        session: data.session,
        isLoading: false,
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        user: session?.user ?? null,
        session: session ?? null,
        isLoading: false,
      });
    });

    unsubscribeAuth = () => subscription.unsubscribe();
    return unsubscribeAuth;
  },
}));
