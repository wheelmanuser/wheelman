export const TIER_LIMITS = {
  free: { maxVehicles: 1 },
  rally_plus: { maxVehicles: Number.POSITIVE_INFINITY },
  telematics: { maxVehicles: Number.POSITIVE_INFINITY },
  telematics_annual: { maxVehicles: Number.POSITIVE_INFINITY },
} as const;

export type SubscriptionTier = keyof typeof TIER_LIMITS;

export function canAddVehicle(currentCount: number, tier: string): boolean {
  const maxVehicles =
    tier in TIER_LIMITS
      ? TIER_LIMITS[tier as SubscriptionTier].maxVehicles
      : TIER_LIMITS.free.maxVehicles;
  return currentCount < maxVehicles;
}
