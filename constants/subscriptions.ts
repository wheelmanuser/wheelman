export const TIER_LIMITS = {
  free: { maxVehicles: 1 },
  rally_plus: { maxVehicles: Number.POSITIVE_INFINITY },
  telematics: { maxVehicles: Number.POSITIVE_INFINITY },
  telematics_annual: { maxVehicles: Number.POSITIVE_INFINITY },
} as const;

export type SubscriptionTier = keyof typeof TIER_LIMITS;

export function canAddVehicle(_currentCount: number, _tier: string): boolean {
  // TODO: re-enable tier limits before launch
  return true;
}
