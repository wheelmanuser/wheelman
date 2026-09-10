export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SubscriptionTier =
  | "free"
  | "rally_plus"
  | "telematics"
  | "telematics_annual";

export type SubscriptionStatus = "active" | "cancelled" | "past_due" | "trialing";
export type LogbookCategory = "maintenance" | "modification" | "other";
export type LogbookEntryMode = "form" | "ai" | "ocr";
export type AttachmentType = "photo" | "receipt" | "document" | "video";

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus | null;
  paypal_subscription_id: string | null;
  units: string;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
  trim: string | null;
  transmission: string | null;
  color: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  estimated_miles_per_year: number | null;
  odometer_miles: number | null;
  odometer_source: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface LogbookEntry {
  id: string;
  vehicle_id: string;
  user_id: string;
  category: LogbookCategory;
  title: string;
  notes: string | null;
  entry_mode: LogbookEntryMode;
  odometer_miles: number | null;
  event_date: string;
  total_cost: number | null;
  shop_name: string | null;
  performed_by: string | null;
  is_public: boolean;
  is_recurring: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface LogbookEntryPart {
  id: string;
  entry_id: string;
  part_name: string;
  part_number: string | null;
  quantity: number | null;
  unit_cost: number | null;
  user_part_id: string | null;
  created_at: string;
}

export interface LogbookAttachment {
  id: string;
  entry_id: string;
  user_id: string;
  attachment_type: AttachmentType;
  storage_path: string;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface UserCustomPart {
  id: string;
  user_id: string;
  part_name: string;
  part_number: string | null;
  brand: string | null;
  default_cost: number | null;
  use_count: number;
  community_use_count: number;
  is_community: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceSchedule {
  id: string;
  vehicle_id: string;
  user_id: string;
  service_name: string;
  interval_miles: number | null;
  interval_months: number | null;
  last_performed_miles: number | null;
  last_performed_date: string | null;
  next_due_miles: number | null;
  next_due_date: string | null;
  notify_pct_remaining: number;
  is_active: boolean;
  is_recurring: boolean | null;
  due_date: string | null;
  due_miles: number | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export type VehicleDevice = {
  id: string;
  vehicle_id: string;
  user_id: string;
  object_id: string;
  imei: string | null;
  device_name: string | null;
  activated: boolean;
  created_at: string;
  updated_at: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  driver_type: string | null;
  distance_unit: string | null;
  timezone: string | null;
  theme: string | null;
  email_reminders: boolean | null;
  sms_reminders: boolean | null;
  phone_number: string | null;
  reminder_lead_time: string | null;
  reminder_frequency: string | null;
  avatar_url: string | null;
  display_name: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type VehicleTelemetry = {
  id: string;
  vehicle_id: string;
  user_id: string;
  object_id: string;
  speed: number | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  altitude: number | null;
  heading: number | null;
  is_online: boolean | null;
  ignition: string | null;
  vehicle_status: string | null;
  last_contact: string | null;
  raw: Json | null;
  recorded_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<User, "id">>;
        Relationships: [];
      };
      vehicles: {
        Row: Vehicle;
        Insert: Omit<Vehicle, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Vehicle, "id" | "user_id">>;
        Relationships: [];
      };
      logbook_entries: {
        Row: LogbookEntry;
        Insert: Omit<LogbookEntry, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<LogbookEntry, "id" | "user_id" | "vehicle_id">>;
        Relationships: [];
      };
      logbook_entry_parts: {
        Row: LogbookEntryPart;
        Insert: Omit<LogbookEntryPart, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<LogbookEntryPart, "id" | "entry_id">>;
        Relationships: [];
      };
      logbook_attachments: {
        Row: LogbookAttachment;
        Insert: Omit<LogbookAttachment, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<LogbookAttachment, "id" | "entry_id" | "user_id">>;
        Relationships: [];
      };
      user_custom_parts: {
        Row: UserCustomPart;
        Insert: Omit<UserCustomPart, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserCustomPart, "id" | "user_id">>;
        Relationships: [];
      };
      service_schedules: {
        Row: ServiceSchedule;
        Insert: Omit<ServiceSchedule, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ServiceSchedule, "id" | "vehicle_id" | "user_id">>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettings;
        Insert: Omit<UserSettings, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserSettings, "id" | "user_id">>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
