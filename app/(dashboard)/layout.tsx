"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";

const navItems = [
  { label: "Dashboard", href: "/dashboard", iconName: "speed" },
  { label: "My Garage", href: "/garage", iconName: "directions_car" },
];

function getInitial(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return "W";
  return nameOrEmail.trim().charAt(0).toUpperCase();
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const user = useAuthStore((state) => state.user);

  const title = useMemo(() => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname.startsWith("/garage")) return "My Garage";
    return "Wheelman";
  }, [pathname]);

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    (user?.email?.split("@")[0] ?? "Driver");

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-wm-bg text-wm-text md:flex">
      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-wm-bg/70 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-wm-border bg-wm-s1 p-5 transition-transform md:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 border-b border-wm-border pb-6">
          <div className="flex items-center justify-between">
            <Image
              src="/wheelman-logo.png"
              alt="Wheelman"
              width={140}
              height={36}
              priority
              className="h-8 w-auto object-contain"
            />
            <button
              type="button"
              className="p-1 text-wm-text2 hover:text-wm-text md:hidden"
              onClick={() => setMenuOpen(false)}
              aria-label="Close sidebar"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>

        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm uppercase tracking-widest transition-colors",
                  active
                    ? "border-wm-gold bg-wm-accent-dark/30 text-wm-text"
                    : "border-transparent text-wm-text2 hover:bg-wm-s2/60 hover:text-wm-text",
                )}
              >
                <Icon name={item.iconName} filled={active} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-wm-border pt-4">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-wm-accent/40 bg-wm-accent-dark text-xs font-medium text-wm-accent">
              {getInitial(displayName)}
            </div>
            <p className="truncate text-xs tracking-wide text-wm-text2">{displayName}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-3 flex w-full items-center justify-center gap-2 border border-wm-border px-3 py-2 text-xs uppercase tracking-widest text-wm-text3 hover:border-wm-accent/40 hover:text-wm-text2 disabled:opacity-60"
          >
            <Icon name="logout" size={14} />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="min-h-screen flex-1 md:ml-[240px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-wm-border bg-wm-bg/95 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            className="rounded-md p-1 text-wm-text2 hover:bg-wm-s2 md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open sidebar"
          >
            <Icon name="menu" size={20} />
          </button>
          <h1 className="font-headline text-lg tracking-wide text-wm-text">{title}</h1>
        </header>
        <main className="min-h-[calc(100vh-4rem)] overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
