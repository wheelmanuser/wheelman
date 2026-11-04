export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", iconName: "speed" },
  { label: "My Garage", href: "/garage", iconName: "directions_car" },
  { label: "Telematics", href: "/telematics", iconName: "sensors" },
] as const;

// The live location page is opened from the dashboard's fleet map, so it belongs to Dashboard even though
// its URL sits under /garage.
const LIVE_LOCATION = /^\/garage\/[^/]+\/live\/?$/;

export function activeNavHref(pathname: string): string | null {
  if (LIVE_LOCATION.test(pathname)) return "/dashboard";
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href ?? null;
}

export function pageTitle(pathname: string): string {
  const active = NAV_ITEMS.find((item) => item.href === activeNavHref(pathname));
  if (active) return active.label;
  if (pathname.startsWith("/settings")) return "Settings";
  return "Wheelman";
}
