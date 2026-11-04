export type XVisionDeviceOption = {
  objectId: string;
  deviceName: string | null;
  imei: string | null;
  vin: string | null;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
};

export type TripPoint = {
  at: string | null;
  lat: number;
  lng: number;
  speedMph: number | null;
  heading: number | null;
  address: string | null;
};

export type TripEventCategory = "braking" | "acceleration" | "speeding" | "other";

export type TripEvent = {
  type: string;
  category: TripEventCategory;
  at: string | null;
  lat: number;
  lng: number;
  speedMph: number | null;
  address: string | null;
};

export type TripSummary = {
  tripId: string;
  startAt: string | null;
  endAt: string | null;
  durationSec: number | null;
  distanceMiles: number | null;
  maxSpeedMph: number | null;
  avgSpeedMph: number | null;
};

export type TripDetail = TripSummary & { points: TripPoint[]; events: TripEvent[] };

export type CurrentTrip = {
  live: boolean;
  startAt: string | null;
  durationSec: number | null;
  distanceMiles: number | null;
  maxSpeedMph: number | null;
  avgSpeedMph: number | null;
  points: TripPoint[];
  events: TripEvent[];
};
