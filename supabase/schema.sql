-- ============================================================
--  WHEELMAN — Supabase PostgreSQL Schema
--  Version: 1.0  |  Generated: 2026-03-16
--  Stack: Supabase (PostgreSQL 15 + PostGIS + pgcrypto)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  ENUMS
-- ============================================================

CREATE TYPE subscription_tier AS ENUM (
  'free',
  'rally_plus',
  'telematics',
  'telematics_annual'
);

CREATE TYPE subscription_status AS ENUM (
  'active',
  'cancelled',
  'past_due',
  'trialing'
);

CREATE TYPE logbook_category AS ENUM (
  'maintenance',
  'modification',
  'other'
);

CREATE TYPE logbook_entry_mode AS ENUM (
  'form',
  'ai',
  'ocr'
);

CREATE TYPE attachment_type AS ENUM (
  'photo',
  'receipt',
  'document',
  'video'
);

CREATE TYPE dtc_status AS ENUM (
  'active',
  'pending',
  'historical',
  'permanent'
);

CREATE TYPE rally_status AS ENUM (
  'draft',
  'open',
  'active',
  'completed',
  'cancelled'
);

CREATE TYPE rally_participant_status AS ENUM (
  'invited',
  'joined',
  'active',
  'finished',
  'dnf'
);

CREATE TYPE notification_type AS ENUM (
  'service_due',
  'dtc_alert',
  'rally_invite',
  'rally_start',
  'social_like',
  'social_comment',
  'social_follow',
  'geofence_enter',
  'geofence_exit',
  'subscription'
);

CREATE TYPE feed_item_type AS ENUM (
  'logbook_share',
  'trip_share',
  'rally_result',
  'route_share',
  'status_post'
);

CREATE TYPE shop_category AS ENUM (
  'dealer',
  'independent',
  'tuning',
  'detailing',
  'tyres',
  'bodywork',
  'other'
);

-- ============================================================
--  1. USERS
--  Extended profile on top of Supabase Auth (auth.users)
-- ============================================================

CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  bio             TEXT,
  avatar_url      TEXT,
  location        TEXT,
  -- Subscription
  subscription_tier     subscription_tier NOT NULL DEFAULT 'free',
  subscription_status   subscription_status,
  paypal_subscription_id TEXT,
  -- Preferences
  units           TEXT NOT NULL DEFAULT 'imperial',   -- 'imperial' | 'metric'
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  2. VEHICLES
-- ============================================================

CREATE TABLE public.vehicles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Identity
  vin             TEXT,
  year            SMALLINT NOT NULL,
  make            TEXT NOT NULL,
  model           TEXT NOT NULL,
  trim            TEXT,
  transmission    TEXT,
  color           TEXT,
  -- Ownership
  purchase_price  NUMERIC(12,2),
  purchase_date   DATE,
  estimated_miles_per_year INTEGER,
  -- Current state (updated by telematics or manual entry)
  odometer_miles  NUMERIC(10,1),
  odometer_source TEXT DEFAULT 'manual',  -- 'manual' | 'whereqube'
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicles_user_id ON public.vehicles(user_id);

-- ============================================================
--  3. TELEMATICS DEVICES (WhereQube OBD-II)
-- ============================================================

CREATE TABLE public.telematics_devices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Geometris / Flespi identifiers
  imei            TEXT UNIQUE NOT NULL,
  device_name     TEXT,
  flespi_device_id BIGINT,
  -- Last known telemetry (denormalised for fast dashboard reads)
  last_seen_at    TIMESTAMPTZ,
  last_lat        DOUBLE PRECISION,
  last_lng        DOUBLE PRECISION,
  last_speed_mph  NUMERIC(6,1),
  last_odometer   NUMERIC(10,1),
  last_rpm        INTEGER,
  last_coolant_f  NUMERIC(5,1),
  last_fuel_pct   NUMERIC(5,1),
  last_battery_v  NUMERIC(4,2),
  ignition_on     BOOLEAN DEFAULT FALSE,
  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_vehicle_id ON public.telematics_devices(vehicle_id);
CREATE INDEX idx_devices_user_id    ON public.telematics_devices(user_id);

-- ============================================================
--  4. LOGBOOK ENTRIES
-- ============================================================

CREATE TABLE public.logbook_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Content
  category        logbook_category NOT NULL,
  title           TEXT NOT NULL,
  notes           TEXT,
  entry_mode      logbook_entry_mode NOT NULL DEFAULT 'form',
  -- Event data
  odometer_miles  NUMERIC(10,1),
  event_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Cost
  total_cost      NUMERIC(10,2) DEFAULT 0,
  shop_name       TEXT,
  performed_by    TEXT,   -- 'self' or shop name
  -- Social
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logbook_vehicle_id ON public.logbook_entries(vehicle_id);
CREATE INDEX idx_logbook_user_id    ON public.logbook_entries(user_id);
CREATE INDEX idx_logbook_category   ON public.logbook_entries(category);
CREATE INDEX idx_logbook_event_date ON public.logbook_entries(event_date DESC);

-- ============================================================
--  5. LOGBOOK ENTRY PARTS (line items within an entry)
-- ============================================================

CREATE TABLE public.logbook_entry_parts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id        UUID NOT NULL REFERENCES public.logbook_entries(id) ON DELETE CASCADE,
  part_name       TEXT NOT NULL,
  part_number     TEXT,
  quantity        NUMERIC(8,2) DEFAULT 1,
  unit_cost       NUMERIC(10,2),
  -- Link to user parts library (optional)
  user_part_id    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parts_entry_id ON public.logbook_entry_parts(entry_id);

-- ============================================================
--  6. LOGBOOK ATTACHMENTS
-- ============================================================

CREATE TABLE public.logbook_attachments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id        UUID NOT NULL REFERENCES public.logbook_entries(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attachment_type attachment_type NOT NULL,
  storage_path    TEXT NOT NULL,   -- Supabase Storage path
  file_name       TEXT,
  file_size_bytes INTEGER,
  mime_type       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_entry_id ON public.logbook_attachments(entry_id);

-- ============================================================
--  7. USER PARTS LIBRARY
--  Stores user's frequently used parts for autocomplete
-- ============================================================

CREATE TABLE public.user_custom_parts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  part_name       TEXT NOT NULL,
  part_number     TEXT,
  brand           TEXT,
  default_cost    NUMERIC(10,2),
  use_count       INTEGER NOT NULL DEFAULT 1,
  -- Community promotion: promoted when use_count >= 50 across all users
  community_use_count INTEGER NOT NULL DEFAULT 0,
  is_community    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, part_name)
);

CREATE INDEX idx_parts_lib_user_id ON public.user_custom_parts(user_id);

-- ============================================================
--  8. SERVICE SCHEDULES
--  Manufacturer intervals + user overrides
-- ============================================================

CREATE TABLE public.service_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_name    TEXT NOT NULL,
  -- Interval (miles or months — whichever comes first)
  interval_miles  INTEGER,
  interval_months INTEGER,
  -- Last performed
  last_performed_miles  NUMERIC(10,1),
  last_performed_date   DATE,
  -- Computed next due (updated by trigger/function)
  next_due_miles        NUMERIC(10,1),
  next_due_date         DATE,
  -- Notification: fire at 10% remaining
  notify_pct_remaining  INTEGER NOT NULL DEFAULT 10,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Source: 'manufacturer' | 'user'
  source          TEXT NOT NULL DEFAULT 'user',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedules_vehicle_id ON public.service_schedules(vehicle_id);

-- ============================================================
--  9. TRIPS
--  GPS-tracked drives recorded via phone GPS + WhereQube
-- ============================================================

CREATE TABLE public.trips (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id       UUID REFERENCES public.telematics_devices(id),
  -- Trip data
  name            TEXT,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  -- Metrics
  distance_miles  NUMERIC(8,2),
  duration_secs   INTEGER,
  avg_speed_mph   NUMERIC(6,1),
  max_speed_mph   NUMERIC(6,1),
  max_rpm         INTEGER,
  -- Driving score (computed)
  driving_score   SMALLINT,   -- 0-100
  score_acceleration SMALLINT,
  score_braking   SMALLINT,
  score_speed     SMALLINT,
  score_cornering SMALLINT,
  -- Route (PostGIS linestring)
  route_geom      GEOMETRY(LINESTRING, 4326),
  -- Rally link (optional)
  rally_id        UUID,
  -- Social
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trips_vehicle_id ON public.trips(vehicle_id);
CREATE INDEX idx_trips_user_id    ON public.trips(user_id);
CREATE INDEX idx_trips_started_at ON public.trips(started_at DESC);
CREATE INDEX idx_trips_route_geom ON public.trips USING GIST(route_geom);

-- ============================================================
--  10. DTC EVENTS
--  Diagnostic trouble codes from WhereQube
-- ============================================================

CREATE TABLE public.dtc_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  device_id       UUID NOT NULL REFERENCES public.telematics_devices(id) ON DELETE CASCADE,
  -- DTC data
  code            TEXT NOT NULL,          -- e.g. 'P0301'
  description     TEXT,
  dtc_status      dtc_status NOT NULL DEFAULT 'active',
  -- Timestamps
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleared_at      TIMESTAMPTZ,
  -- Linked logbook entry (optional — user can log a fix)
  logbook_entry_id UUID REFERENCES public.logbook_entries(id)
);

CREATE INDEX idx_dtc_vehicle_id ON public.dtc_events(vehicle_id);
CREATE INDEX idx_dtc_status     ON public.dtc_events(dtc_status);

-- ============================================================
--  11. GEOFENCES
-- ============================================================

CREATE TABLE public.geofences (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_id      UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- PostGIS polygon
  area_geom       GEOMETRY(POLYGON, 4326) NOT NULL,
  radius_meters   NUMERIC(8,1),   -- for circle-based geofences
  notify_enter    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_exit     BOOLEAN NOT NULL DEFAULT TRUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geofences_user_id   ON public.geofences(user_id);
CREATE INDEX idx_geofences_area_geom ON public.geofences USING GIST(area_geom);

-- ============================================================
--  12. ROUTES
--  Community-shared driving routes
-- ============================================================

CREATE TABLE public.routes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  tags            TEXT[],   -- e.g. ARRAY['scenic','sport','coastal']
  -- PostGIS
  route_geom      GEOMETRY(LINESTRING, 4326),
  start_point     GEOMETRY(POINT, 4326),
  end_point       GEOMETRY(POINT, 4326),
  -- Metrics
  distance_miles  NUMERIC(8,2),
  est_duration_mins INTEGER,
  -- Community
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  avg_rating      NUMERIC(3,2) DEFAULT 0,
  rating_count    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routes_created_by  ON public.routes(created_by);
CREATE INDEX idx_routes_start_point ON public.routes USING GIST(start_point);
CREATE INDEX idx_routes_route_geom  ON public.routes USING GIST(route_geom);

-- ============================================================
--  13. RALLIES
-- ============================================================

CREATE TABLE public.rallies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  route_id        UUID REFERENCES public.routes(id),
  name            TEXT NOT NULL,
  description     TEXT,
  -- Schedule
  scheduled_start TIMESTAMPTZ,
  actual_start    TIMESTAMPTZ,
  actual_end      TIMESTAMPTZ,
  -- Settings
  status          rally_status NOT NULL DEFAULT 'draft',
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  max_participants INTEGER DEFAULT 50,
  -- Leaderboard type: 'score' | 'time' | 'none'
  leaderboard_type TEXT NOT NULL DEFAULT 'score',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rallies_created_by ON public.rallies(created_by);
CREATE INDEX idx_rallies_status     ON public.rallies(status);

-- ============================================================
--  14. RALLY PARTICIPANTS
-- ============================================================

CREATE TABLE public.rally_participants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rally_id        UUID NOT NULL REFERENCES public.rallies(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_id      UUID REFERENCES public.vehicles(id),
  trip_id         UUID REFERENCES public.trips(id),
  status          rally_participant_status NOT NULL DEFAULT 'invited',
  -- Live tracking (updated in realtime during rally)
  current_lat     DOUBLE PRECISION,
  current_lng     DOUBLE PRECISION,
  current_speed   NUMERIC(6,1),
  -- Results
  final_score     SMALLINT,
  finish_time_secs INTEGER,
  leaderboard_position SMALLINT,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  UNIQUE(rally_id, user_id)
);

CREATE INDEX idx_rally_part_rally_id ON public.rally_participants(rally_id);
CREATE INDEX idx_rally_part_user_id  ON public.rally_participants(user_id);

-- ============================================================
--  15. FOLLOWS (social graph)
-- ============================================================

CREATE TABLE public.follows (
  follower_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX idx_follows_follower   ON public.follows(follower_id);
CREATE INDEX idx_follows_following  ON public.follows(following_id);

-- ============================================================
--  16. FEED ITEMS
-- ============================================================

CREATE TABLE public.feed_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_type       feed_item_type NOT NULL,
  -- Polymorphic reference (one of these will be set)
  logbook_entry_id UUID REFERENCES public.logbook_entries(id) ON DELETE CASCADE,
  trip_id         UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  rally_id        UUID REFERENCES public.rallies(id) ON DELETE CASCADE,
  route_id        UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  -- Freeform post
  body_text       TEXT,
  media_urls      TEXT[],
  -- Social counts (denormalised)
  like_count      INTEGER NOT NULL DEFAULT 0,
  comment_count   INTEGER NOT NULL DEFAULT 0,
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_user_id    ON public.feed_items(user_id);
CREATE INDEX idx_feed_created_at ON public.feed_items(created_at DESC);

-- ============================================================
--  17. LIKES
-- ============================================================

CREATE TABLE public.likes (
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feed_item_id    UUID NOT NULL REFERENCES public.feed_items(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, feed_item_id)
);

CREATE INDEX idx_likes_feed_item ON public.likes(feed_item_id);

-- ============================================================
--  18. COMMENTS
-- ============================================================

CREATE TABLE public.comments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_item_id    UUID NOT NULL REFERENCES public.feed_items(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_feed_item ON public.comments(feed_item_id);
CREATE INDEX idx_comments_user_id   ON public.comments(user_id);

-- ============================================================
--  19. SHOPS
--  B2B shop / dealer listings
-- ============================================================

CREATE TABLE public.shops (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  category        shop_category NOT NULL DEFAULT 'independent',
  description     TEXT,
  -- Contact
  phone           TEXT,
  website         TEXT,
  email           TEXT,
  -- Location
  address_line1   TEXT,
  address_city    TEXT,
  address_state   TEXT,
  address_zip     TEXT,
  location_geom   GEOMETRY(POINT, 4326),
  -- Community
  avg_rating      NUMERIC(3,2) DEFAULT 0,
  review_count    INTEGER DEFAULT 0,
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shops_location ON public.shops USING GIST(location_geom);
CREATE INDEX idx_shops_category ON public.shops(category);

-- ============================================================
--  20. SHOP REVIEWS
-- ============================================================

CREATE TABLE public.shop_reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, user_id)
);

CREATE INDEX idx_reviews_shop_id ON public.shop_reviews(shop_id);

-- ============================================================
--  21. SUBSCRIPTIONS
--  PayPal subscription records
-- ============================================================

CREATE TABLE public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  paypal_subscription_id TEXT UNIQUE NOT NULL,
  paypal_plan_id        TEXT NOT NULL,
  tier                  subscription_tier NOT NULL,
  status                subscription_status NOT NULL DEFAULT 'active',
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);

-- ============================================================
--  22. NOTIFICATIONS
-- ============================================================

CREATE TABLE public.notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type            notification_type NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT,
  -- Deep link target
  target_type     TEXT,   -- 'vehicle' | 'logbook_entry' | 'rally' | 'feed_item' etc.
  target_id       UUID,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user_id ON public.notifications(user_id);
CREATE INDEX idx_notif_unread  ON public.notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================================
--  23. AI PARSE EVENTS (rate limiting)
-- ============================================================

CREATE TABLE public.ai_parse_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_parse_events_user_created_at
  ON public.ai_parse_events(user_id, created_at DESC);

-- ============================================================
--  TRIGGERS — updated_at auto-maintenance
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','vehicles','telematics_devices','logbook_entries',
    'user_custom_parts','service_schedules','routes','rallies',
    'feed_items','comments','shops','shop_reviews','subscriptions'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON public.%s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
--  TRIGGER — sync users.subscription_tier from subscriptions
-- ============================================================

CREATE OR REPLACE FUNCTION sync_user_subscription_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.users
    SET subscription_tier   = NEW.tier,
        subscription_status = NEW.status,
        paypal_subscription_id = NEW.paypal_subscription_id
    WHERE id = NEW.user_id;
  ELSIF NEW.status IN ('cancelled','past_due') THEN
    UPDATE public.users
    SET subscription_tier   = 'free',
        subscription_status = NEW.status
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_subscription
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION sync_user_subscription_tier();

-- ============================================================
--  TRIGGER — maintain like_count / comment_count on feed_items
-- ============================================================

CREATE OR REPLACE FUNCTION update_feed_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_items SET like_count = like_count + 1 WHERE id = NEW.feed_item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_items SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.feed_item_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_like_count
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION update_feed_like_count();

CREATE OR REPLACE FUNCTION update_feed_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_items SET comment_count = comment_count + 1 WHERE id = NEW.feed_item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_items SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.feed_item_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comment_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION update_feed_comment_count();

-- ============================================================
--  TRIGGER — maintain shop avg_rating on review insert/update
-- ============================================================

CREATE OR REPLACE FUNCTION update_shop_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.shops
  SET avg_rating   = (SELECT AVG(rating) FROM public.shop_reviews WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id)),
      review_count = (SELECT COUNT(*) FROM public.shop_reviews WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id))
  WHERE id = COALESCE(NEW.shop_id, OLD.shop_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_shop_rating
AFTER INSERT OR UPDATE OR DELETE ON public.shop_reviews
FOR EACH ROW EXECUTE FUNCTION update_shop_rating();

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all user-data tables
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telematics_devices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbook_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbook_entry_parts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbook_attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_parts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dtc_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofences            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rallies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rally_participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_parse_events      ENABLE ROW LEVEL SECURITY;

-- ── Users ──
CREATE POLICY "Users: own row read"   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users: own row update" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users: public profile" ON public.users FOR SELECT USING (TRUE);  -- usernames visible

-- ── Vehicles (private to owner) ──
CREATE POLICY "Vehicles: owner all"   ON public.vehicles FOR ALL USING (auth.uid() = user_id);

-- ── Telematics devices (private to owner) ──
CREATE POLICY "Devices: owner all"    ON public.telematics_devices FOR ALL USING (auth.uid() = user_id);

-- ── Logbook entries (private + optionally public) ──
CREATE POLICY "Logbook: owner all"    ON public.logbook_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Logbook: public read"  ON public.logbook_entries FOR SELECT USING (is_public = TRUE);

-- ── Logbook parts (via entry ownership) ──
CREATE POLICY "LogParts: owner all"   ON public.logbook_entry_parts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.logbook_entries e WHERE e.id = entry_id AND e.user_id = auth.uid()));

-- ── Logbook attachments ──
CREATE POLICY "Attachments: owner all" ON public.logbook_attachments FOR ALL USING (auth.uid() = user_id);

-- ── User parts library ──
CREATE POLICY "Parts lib: owner all"  ON public.user_custom_parts FOR ALL USING (auth.uid() = user_id);

-- ── Service schedules ──
CREATE POLICY "Schedules: owner all"  ON public.service_schedules FOR ALL USING (auth.uid() = user_id);

-- ── Trips (private + optionally public) ──
CREATE POLICY "Trips: owner all"      ON public.trips FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Trips: public read"    ON public.trips FOR SELECT USING (is_public = TRUE);

-- ── DTC events ──
CREATE POLICY "DTC: owner all"        ON public.dtc_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.user_id = auth.uid()));

-- ── Geofences ──
CREATE POLICY "Geofences: owner all"  ON public.geofences FOR ALL USING (auth.uid() = user_id);

-- ── Routes (public read, owner write) ──
CREATE POLICY "Routes: owner write"   ON public.routes FOR ALL USING (auth.uid() = created_by);
CREATE POLICY "Routes: public read"   ON public.routes FOR SELECT USING (is_public = TRUE);

-- ── Rallies (public read, owner write) ──
CREATE POLICY "Rallies: owner write"  ON public.rallies FOR ALL USING (auth.uid() = created_by);
CREATE POLICY "Rallies: public read"  ON public.rallies FOR SELECT USING (is_public = TRUE);

-- ── Rally participants ──
CREATE POLICY "RallyPart: own row"    ON public.rally_participants FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "RallyPart: rally read" ON public.rally_participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rallies r WHERE r.id = rally_id AND r.is_public = TRUE));

-- ── Follows ──
CREATE POLICY "Follows: own rows"     ON public.follows FOR ALL USING (auth.uid() = follower_id);
CREATE POLICY "Follows: public read"  ON public.follows FOR SELECT USING (TRUE);

-- ── Feed items ──
CREATE POLICY "Feed: owner all"       ON public.feed_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Feed: public read"     ON public.feed_items FOR SELECT USING (is_public = TRUE);

-- ── Likes ──
CREATE POLICY "Likes: own rows"       ON public.likes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Likes: public read"    ON public.likes FOR SELECT USING (TRUE);

-- ── Comments ──
CREATE POLICY "Comments: owner all"   ON public.comments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Comments: public read" ON public.comments FOR SELECT USING (TRUE);

-- ── Notifications (private) ──
CREATE POLICY "Notif: owner all"      ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- ── Subscriptions (private) ──
CREATE POLICY "Sub: owner all"        ON public.subscriptions FOR ALL USING (auth.uid() = user_id);

-- ── AI parse events (private) ──
CREATE POLICY "AI Parse: owner all"   ON public.ai_parse_events FOR ALL USING (auth.uid() = user_id);

-- ── Shops (public read; insert/update via service role only) ──
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shops: public read"    ON public.shops FOR SELECT USING (is_active = TRUE);

-- ── Shop reviews ──
ALTER TABLE public.shop_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ShopRev: owner all"    ON public.shop_reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "ShopRev: public read"  ON public.shop_reviews FOR SELECT USING (TRUE);

-- ============================================================
--  USEFUL VIEWS
-- ============================================================

-- Active service reminders (vehicles with items due soon)
CREATE OR REPLACE VIEW public.vw_service_reminders AS
SELECT
  ss.*,
  v.user_id,
  v.make,
  v.model,
  v.year,
  v.odometer_miles AS current_odometer,
  (ss.next_due_miles - v.odometer_miles) AS miles_remaining,
  ROUND(
    ((ss.next_due_miles - v.odometer_miles) /
     NULLIF(ss.next_due_miles - ss.last_performed_miles, 0)) * 100
  ) AS pct_remaining
FROM public.service_schedules ss
JOIN public.vehicles v ON v.id = ss.vehicle_id
WHERE ss.is_active = TRUE
  AND ss.next_due_miles IS NOT NULL;

-- Feed with author info (for social screens)
CREATE OR REPLACE VIEW public.vw_feed_with_author AS
SELECT
  fi.*,
  u.username,
  u.display_name,
  u.avatar_url,
  u.subscription_tier
FROM public.feed_items fi
JOIN public.users u ON u.id = fi.user_id
WHERE fi.is_public = TRUE
ORDER BY fi.created_at DESC;

-- ============================================================
--  REALTIME CHANNELS
--  Enable on tables that need live updates
-- ============================================================

-- Enable realtime on rally participants (live tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE public.rally_participants;

-- Enable realtime on notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable realtime on telematics devices (live dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE public.telematics_devices;

-- ============================================================
--  END OF SCHEMA
-- ============================================================
