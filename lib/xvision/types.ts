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
  speedKmh: number | null;
  heading: number | null;
};

export type TripEventCategory = "braking" | "acceleration" | "speeding" | "other";

export type TripEvent = {
  type: string;
  category: TripEventCategory;
  at: string | null;
  lat: number;
  lng: number;
  speedKmh: number | null;
};

export type TripSummary = {
  tripId: string;
  startAt: string | null;
  endAt: string | null;
  durationSec: number | null;
  distanceKm: number | null;
  maxSpeedKmh: number | null;
  avgSpeedKmh: number | null;
};

export type TripDetail = TripSummary & { points: TripPoint[]; events: TripEvent[] };

export type CurrentTrip = {
  live: boolean;
  startAt: string | null;
  durationSec: number | null;
  distanceKm: number | null;
  maxSpeedKmh: number | null;
  avgSpeedKmh: number | null;
  points: TripPoint[];
  events: TripEvent[];
};
