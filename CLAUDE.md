# Wheelman — Claude Code Project Context

## Project Overview
Wheelman is a Next.js 14 web app for high-end car enthusiasts to manage their vehicle collection, track service history, monitor costs, and (in v2) view live telematics data from WhereQube OBD-II devices via the xVision API.

**Live URL:** https://wheelman.vercel.app  
**Repo:** GitHub (main branch auto-deploys to Vercel)  
**Project root:** `/Users/jinlee/Documents/Wheelman_mvp/wheelman`

---

## Tech Stack
- **Framework:** Next.js 14 (App Router, Server Components)
- **Database:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Styling:** Tailwind CSS with custom `wm-*` design tokens (CSS variables)
- **Forms:** react-hook-form
- **State:** React Context (`UserSettingsContext`), useState
- **Fonts:** Archivo Narrow (headlines), Hanken Grotesk (body), Material Symbols Outlined (icons)
- **Deployment:** Vercel

---

## Key Conventions

### Caching
Every page that reads user-specific data from Supabase must have:
```ts
export const dynamic = "force-dynamic";
```

### Supabase Client
- Server components: `import { createClient } from "@/lib/supabase/server"`
- Client components: `import { createClient } from "@/lib/supabase/client"`

### Distance Formatting
Always use `formatDistance(value, distanceUnit)` from `@/lib/format-distance` — never hardcode "mi" or "km".

### Vehicle Display Name
Always use `vehicleDisplayName(vehicle)` — never concatenate `year + make + model` directly. Respects the nickname field.

### Icons
Use the `<Icon>` component from `@/components/ui/Icon`:
```tsx
<Icon name="directions_car" className="text-wm-accent" size={24} />
```
Never use emoji for UI icons.

---

## Design System

### Color Tokens (CSS variables — support light/dark theme)
```
wm-bg, wm-s1, wm-s2, wm-s3    — backgrounds/surfaces
wm-border                       — borders
wm-text, wm-text2, wm-text3    — text hierarchy
wm-accent    (#a5d0bc)          — primary green
wm-accent-dark (#0c3729)        — brand dark green
wm-gold      (#e6c364)          — active states, gold accent
wm-red       (#cf6679)          — errors, overdue
```

### Typography
- Headlines: `font-headline` (Archivo Narrow)
- Labels/tags: `label-technical` class (uppercase, tracked, Archivo Narrow)
- Body: Hanken Grotesk (default)

### Component Patterns
- Cards: `border-l-4` accent border, `rounded-none` or `rounded-sm`
- Drawers: `fixed inset-y-0 right-0 carbon-texture aside` with backdrop button
- Buttons: ghost style `border border-wm-accent text-wm-accent hover:bg-wm-accent hover:text-wm-bg`
- Active nav: `border-b-2 border-wm-gold text-wm-text`
- Glass panels: `glass-panel` class
- Hero sections: `carbon-texture scanlines` classes

---

## Database Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `vehicles` | Vehicle records (year, make, model, nickname, vin, odometer, etc.) |
| `logbook_entries` | Service/maintenance log entries per vehicle |
| `service_schedules` | Service reminders (recurring + one-time) |
| `user_settings` | Per-user preferences (theme, units, timezone, notifications, avatar) |
| `vehicle_devices` | Links a WhereQube device (object_id) to a vehicle |
| `vehicle_telemetry` | Stores telematics snapshots from xVision API |

All tables have RLS enabled. Always use `auth.uid() = user_id` in policies.

---

## Key Files

```
app/
  (dashboard)/
    layout.tsx              — sidebar nav, UserSettingsProvider
    dashboard/page.tsx      — main dashboard with greeting + reminders
    garage/
      page.tsx              — vehicle list with device badges
      [vehicleId]/
        page.tsx            — vehicle detail server component
        edit/page.tsx       — vehicle edit form
        logbook/page.tsx    — logbook list
        logbook/new/page.tsx — new logbook entry
        costs/page.tsx      — costs dashboard
    settings/page.tsx       — user profile & settings
    telematics/page.tsx     — fleet telematics overview

components/
  garage/
    VehicleDetailClient.tsx — tabs: Overview, Logbook, Costs, Telematics
    VehicleEditForm.tsx
  logbook/
    VehicleLogbookClient.tsx
  settings/
    SettingsClient.tsx
  telematics/
    TelematicsClient.tsx
    VehicleMap.tsx          — Mapbox GL marker view for one vehicle's last position
  ui/
    Icon.tsx                — Material Symbols wrapper

lib/
  supabase/client.ts
  supabase/server.ts
  service-schedule-display.ts  — enrichSchedules(), statusToneClass()
  format-distance.ts           — formatDistance(), formatDistanceUnit()
  xvision/
    auth.ts                 — getXVisionToken(), refreshXVisionToken() (in-memory token cache)
    client.ts               — xvisionGet<T>(), xvisionPost<T>() (SessionKey header; retry once on expiry)
    devices.ts              — getXVisionCustomerId(), getXVisionDevices(), toDeviceOption()
    types.ts                — XVisionDeviceOption (client-safe type)
    events.ts               — getCheckEngineStatus(), summarizeMilEvents() (30-day MIL window)
  telemetry-display.ts      — formatFuelLevel/Volts/Mpg/DeviceBattery ("—" when null)
  central-day.ts            — America/Chicago days: centralToday, centralDayBounds (23/25h DST days), validateDayParam, parseClockInput
  trip-day.ts               — day history helpers: tripsStartingIn, dayTotals, findTripAt, timelineSegments/Ticks, buildWaypointRows

contexts/
  UserSettingsContext.tsx   — reactive settings (theme, units, avatar)

types/
  database.ts               — Vehicle, VehicleDevice, VehicleTelemetry, etc.

scripts/
  test-xvision.ts           — connectivity test for xVision API
  test-sync-parse.ts        — node:test: LastContact (Central→UTC), ExtraData parsing   (npx tsx --test scripts/test-sync-parse.ts)
  test-telemetry-ui.ts      — node:test: MIL summarizing, display formatters            (npx tsx --test scripts/test-telemetry-ui.ts)
  test-sync-auth.ts         — node:test: SYNC_TELEMETRY_KEY bearer check                  (npx tsx --test scripts/test-sync-auth.ts)
  test-fleet.ts             — node:test: fleet status, counts, last seen, map view      (npx tsx --test scripts/test-fleet.ts)
  test-trips.ts             — node:test: trip parsing, units, stats, ownership check     (npx tsx --test scripts/test-trips.ts)
  test-trip-day.ts          — node:test: Central-day bounds (incl. DST), date param, totals, Find time, timeline, waypoint rows (npx tsx --test scripts/test-trip-day.ts)
  test-vehicle-info.ts      — node:test: VIN validation/display/mismatch, odometer rules, vPIC mapping, device→vehicle updates (npx tsx --test scripts/test-vehicle-info.ts)
  check-xvision-trips.ts    — live read-only check of trip units/timezone
  test-visible-interval.ts  — node:test: pause/resume interval on tab visibility        (npx tsx --test scripts/test-visible-interval.ts)

supabase/
  functions/
    sync-telemetry/         — Deno edge function; polls xVision, writes vehicle_telemetry
      vehicle-info.ts       — shared (Deno + Next) device→vehicle rules: VIN, odometer, vPIC decode
                              (not part of the Next.js tsconfig — see supabase/functions exclude)
```

---

## xVision / Telematics API
- **Base URL:** `https://api.xvisioncloud.net` (PRODUCTION — real devices live here). `https://api-dev.xvisioncloud.net` is the dev API; `app-dev.xvisioncloud.com` serves the web app only (`/User/Login` there returns HTML / 405). Dev and prod use separate accounts.
- **Auth:** POST `/User/Login` with body `{ Email, Password }` (capitalized) → returns `{ access, refresh, UserID, ... }`. Requests send the **access** token in a `SessionKey` header.
- **Refresh:** `GET /User/RefreshTokens` with headers `SessionKey` and `RefreshKey` both set to the **refresh** token → returns a new `{ access, refresh }`.
- **Expired session:** HTTP 400 with body `"SessionKey expired."` (other auth errors like "Not authorized." are also 400). `client.ts` retries once after refresh on 401 OR 400 + that message.
- **Token cache:** `lib/xvision/auth.ts` caches tokens in memory (55 min TTL, 1 min buffer).
- **OBD data:** `GetDevices` omits it. `GET /Device/GetDevice?ObjectID=<id>` returns `ExtraData` with string values + units (`Odometer "2346.3 mi"`, `InputVoltage "13.1 V"`, `FuelLevel "58.0 %"`, `FuelEconomy "19.5 MPG"`, `DeviceBattery "100 %"`). Keys vary by model — the XT1P only has `InputVoltage` and `BatteryVoltage` (which is a `%`, so it feeds `device_battery_pct`). `parseExtraData()` in `supabase/functions/sync-telemetry/parse.ts` strips units, converts km→mi, and returns null for missing/unknown values; sync stores them in `vehicle_telemetry.odometer_miles / fuel_level_pct / input_voltage / fuel_economy_mpg / device_battery_pct`. UI shows "—" for null, never 0.
- **Check engine:** `GET /Data/GetEvents?ObjectID=<id>&Events=MIL&FromDateTime=…&ToDateTime=…` (per the xVision docs; datetimes `YYYY-MM-DD HH:MM:SS`, timezone undocumented — UTC is used). Event time is `EventTime`, falling back to `DateTime`; MIL events carry `EventType` and `ExtraData.DTCCodes`. `lib/xvision/events.ts` requests a 30-day window and re-applies it client-side as a safety net. Served to the UI via `/api/xvision/check-engine?vehicleId=` (resolves the device server-side).
- **Freshness:** a 60s cron runs `sync-telemetry`, authenticating with `Authorization: Bearer <SYNC_TELEMETRY_KEY>` (the function is deployed with `--no-verify-jwt`, so this header is its only auth; checked in constant time by `supabase/functions/sync-telemetry/auth.ts`, 401 if wrong, 500 if the secret is unset). It skips inserting when the newest stored row for a vehicle already matches the new reading on last_contact, lat, lng, speed, is_online, ignition, vehicle_status, odometer, fuel level and input voltage (`isDuplicateReading` in `parse.ts`; response is `{ synced, skipped }`). If `GetDevice` fails for a device, the previous row's five OBD values are carried forward (`applyObdFallback`) so a transient failure doesn't blank the tiles or insert a spurious row; a successful response that lacks a key still yields null. The vehicle Telematics tab and the fleet page refetch every 60s while the browser tab is visible (`lib/visible-interval.ts`); the manual Refresh buttons remain. "Last updated" is the last fetch time; "Last seen" is the tracker's own `last_contact`.
- **Account settings (from the login response):** `TimeZone` (this account: `America/Chicago`), `DateTimeFormat` `%m/%d/%Y %h:%i:%S %p`, `Units` `mph`, `Metric` `0.6213712`. xVision formats timestamps (LastContact, trip dateStart/dateEnd) in the account `TimeZone`, which is why `parseLastContact` assumes Central — if the account timezone changes, that parsing must follow.
- **Trips:** `GET /Data/GetTrips?ObjectID&FromDateTime&ToDateTime` (all required), `GET /Data/GetTripPoints?TripID`, `GET /Data/GetCurrentTripPoints?ObjectID` → `{ TripPoints, Events }`. Parsing in `lib/xvision/trip-parse.ts`, fetching + 60s in-memory cache in `lib/xvision/trips.ts`. Routes `/api/xvision/trips?vehicleId&days=7|30` or `?vehicleId&date=YYYY-MM-DD` (trips *starting* in that America/Chicago day; 400 for a bad format, impossible date or a future day), `/api/xvision/trips/[tripId]?vehicleId[&date=]` (trip must be in that vehicle's own GetTrips — for that day when `date` is given, else the last 30 days), `/api/xvision/trips/current?vehicleId` — ObjectID always resolved from the user's own `vehicle_devices` link (`lib/xvision/linked-device.ts`). UI: Trips tab (`components/telematics/TripsPanel.tsx`, `TripMap.tsx`).
  - CONFIRMED on real trips (2026-11-04, `scripts/check-xvision-trips.ts`, 3 devices): trip `distance` is **miles** (API ÷ GPS path in miles = 1.003 / 0.998 / 1.002), point `speed` is **mph** (average point speed ≈ path/time in mph), `duration` is seconds, and `dateStart`/`dateEnd` parse correctly as account-timezone (Central) time — they match the first/last GPS point exactly. Real event type seen: `Brake`. Duration is still computed from the timestamps, and distance still falls back to the GPS path if the API value is off by more than 3x. Re-run the script if the account's units or timezone setting changes.
- **Live fleet (dashboard + /garage/[id]/live):** `lib/fleet.ts` `loadFleet()` — one RLS-scoped query of every vehicle + its device link + newest telemetry row (embedded, ordered + limited per vehicle). Served to the client by `/api/fleet` (optional `vehicleId`); no xVision calls. Dashboard section `components/dashboard/FleetOverview.tsx` (+ clustered `FleetMap.tsx`), live page `components/garage/VehicleLiveClient.tsx` (+ `components/telematics/LiveMap.tsx`).
- **Live page day history (`/garage/[id]/live`):** side panel tabs Overview / Trips; state lives in the URL as `?view=trips&date=YYYY-MM-DD&trip=<id|live>` (written with `history.replaceState`; a future/out-of-range date falls back to today, an invalid trip id is dropped; Overview clears the params). Trips tab (`components/garage/LiveTrips.tsx`): day picker (arrows + native date input, last 90 days, "today" is the Central day), day totals, Find time (h:mm AM/PM or 24h → covering trip, else nearest with a note), trip cards newest first with today's in-progress trip first as "Live" (refreshed every 60s while visible), "Trip details" waypoint list (first 50 + Show all; Start/Waypoint/End rows plus Braking/Acceleration/Speeding events merged by time; clicking a row pans the map and drops a gold ring), and a 12 AM–12 AM day timeline under the map (hover highlights the card, click selects). `LiveMap` shows the selected trip instead of the live pin: thick route with direction arrows (symbol layer, `symbol-placement: line`), green start / white end / event markers, fit to the route, and a "Return to current location" button. Note: `mapbox-gl.css` forces `.mapboxgl-map { position: relative }`, so the map container must be sized with `h-full w-full`, not `absolute inset-0`. On desktop the map + panel block is `h-[calc(100vh-9.25rem)]` (min 520px): 9.25rem = dashboard header (4rem) + main padding (2 × 1.5rem) + back link and gap (1.25rem + 1rem) — update it if the header or padding changes. The trip fit's top padding is the Return button's bottom edge + a full pin (41px), so no pin lands under the button. Both refresh every 60s while the tab is visible. The vehicle page accepts `?tab=trips|telematics|...`.
- **Fleet status (`fleetStatus` in `lib/fleet-status.ts`):** real `vehicle_status` values are `Moving`, `Parked`, `Idle`. No device → No device; `is_online=false` (or no reading yet) → Offline; ignition on (incl. Idle, and Moving at speed 0) → Moving; speed > 0 → Moving except Parked + ignition off (that is GPS drift, ≤11.2 in real data); otherwise Parked. Dashboard tiles show "Last seen" only for Offline cars; the live page always shows it. `/garage/[id]/live` highlights Dashboard in the sidebar (`lib/nav.ts`).
- **Speed units:** the device `Speed` (GetDevices → `vehicle_telemetry.speed`) is **mph** (account units) — verified: reported speed ÷ GPS-derived km/h between consecutive fixes has median 0.68 over 247 driving legs (mph = 0.62, km/h ≈ 1.0). `formatTelemetrySpeed` assumes mph; Trips uses the same formatter.
- **Customer scoping:** `GET /Customer/GetCustomers` → customer ID; `lib/xvision/devices.ts` uses it automatically if exactly one customer comes back (else set optional `XVISION_CUSTOMER_ID`).
- **Key endpoint:** `GET /Device/GetDevices?CustomerID=<id>` → per device: ObjectID (xVision UUID), IMEI, SerialNo, VIN, DeviceName, Speed, Lat, Lng, Address, IsOnline (1/0), Ignition (0/1), LastContact (`MM/DD/YYYY hh:mm:ss AM`, no timezone — assumed UTC, TODO confirm with xVision)
- **Device name in the UI:** the WhereQube hardware is branded **"WheelMan Connect Pro"** in every user-facing string (WHE-37). Code comments, docs and identifiers still say WhereQube (the vendor).
- **Device → vehicle record (WHE-26, `supabase/functions/sync-telemetry/vehicle-info.ts`, used by both the sync and `POST /api/xvision/apply-device-info`, which the link drawer calls right after linking):**
  - VIN: the device VIN (GetDevices `VIN`, also stored in `vehicle_telemetry.raw`) is written to `vehicles.vin` only when the record's VIN is blank or not a valid VIN (17 chars, no I/O/Q). A different *valid* record VIN is kept; the UI flags the mismatch.
  - Writing a VIN is the one moment it is decoded with NHTSA vPIC (`DecodeVinValues`, server-side, no key): year/make/model are overwritten (make casing normalized), the nickname is never touched. Trim: kept if the user entered one and the decode is the same make/model; otherwise vPIC's trim, or cleared when the car changed. The record's VIN doubles as "last decoded VIN". If the vPIC request fails, the VIN isn't written either, so the next sync retries; if vPIC has no data, the VIN is stored and nothing else changes.
  - Odometer: `vehicles.odometer_miles` follows the device in whole miles with `odometer_source = 'device'`; the first device reading replaces a manual value (even a higher one), after that it only moves forward; null readings change nothing. While a device is linked the edit form shows the odometer read-only ("Synced from WheelMan Connect Pro") and doesn't save it.
- **VIN display (WHE-39):** `components/telematics/VinTag.tsx` on the live page Overview header and the vehicle Telematics tab — device VIN first (from the newest telemetry row's `raw->>VIN`, selected as `device_vin` in `loadFleet`), record VIN as fallback, "Doesn't match vehicle record" when both exist and differ; copy button.
- **Device linking:** the link drawer loads `/api/xvision/devices` (auth required) and shows a dropdown; a device whose VIN matches the vehicle is preselected. Stores ObjectID + IMEI in `vehicle_devices`. Note: this lists every device on the shared xVision account to any signed-in user.
- **Credentials:** stored in `.env.local` as `XVISION_API_URL`, `XVISION_EMAIL`, `XVISION_PASSWORD`
- **Status:** Login/refresh verified on the dev API. Prod host + CustomerID flow implemented and mock-tested; needs a live run with prod credentials: `npx tsx --env-file=.env.local scripts/test-xvision.ts`. Flow inferred from the xVision web app's own client, not official docs.

---

## Current Phase
**Phase 3 — Telematics Integration (active)**
- WHE-16: xVision API connectivity test ✅ login + GetDevices verified live (no API key needed); no devices on the account yet
- WHE-17: Supabase schema ✅ done
- WHE-18: Vehicle data sync (poll/webhook) ✅ done (edge function; deploy + xVision credentials pending)
- WHE-19: Device linking UI ✅ done
- WHE-20: Per-vehicle live metrics UI ✅ done
- WHE-21: Fleet telematics overview ✅ done
- WHE-22: GPS map view ✅ done (needs `NEXT_PUBLIC_MAPBOX_TOKEN` set)
- WHE-23: DTC lookup — superseded by the Check Engine tile (MIL events); the old DTC lookup/badge code was removed

---

## Environment Variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=https://wheelman.vercel.app
XVISION_API_URL=https://api.xvisioncloud.net
XVISION_EMAIL=
XVISION_PASSWORD=
NEXT_PUBLIC_MAPBOX_TOKEN=
```
