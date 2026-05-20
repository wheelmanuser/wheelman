export function vehicleDisplayName(vehicle: {
  nickname?: string | null;
  year: number;
  make: string;
  model: string;
}): string {
  return vehicle.nickname?.trim() || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}
