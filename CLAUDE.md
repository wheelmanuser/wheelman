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

contexts/
  UserSettingsContext.tsx   — reactive settings (theme, units, avatar)

types/
  database.ts               — Vehicle, VehicleDevice, VehicleTelemetry, etc.

scripts/
  test-xvision.ts           — connectivity test for xVision API
  test-sync-parse.ts        — node:test: LastContact (Central→UTC), ExtraData parsing   (npx tsx --test scripts/test-sync-parse.ts)
  test-telemetry-ui.ts      — node:test: MIL summarizing, display formatters            (npx tsx --test scripts/test-telemetry-ui.ts)
  test-sync-auth.ts         — node:test: SYNC_TELEMETRY_KEY bearer check                  (npx tsx --test scripts/test-sync-auth.ts)
  test-visible-interval.ts  — node:test: pause/resume interval on tab visibility        (npx tsx --test scripts/test-visible-interval.ts)

supabase/
  functions/
    sync-telemetry/         — Deno edge function; polls xVision, writes vehicle_telemetry
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
- **Customer scoping:** `GET /Customer/GetCustomers` → customer ID; `lib/xvision/devices.ts` uses it automatically if exactly one customer comes back (else set optional `XVISION_CUSTOMER_ID`).
- **Key endpoint:** `GET /Device/GetDevices?CustomerID=<id>` → per device: ObjectID (xVision UUID), IMEI, SerialNo, VIN, DeviceName, Speed, Lat, Lng, Address, IsOnline (1/0), Ignition (0/1), LastContact (`MM/DD/YYYY hh:mm:ss AM`, no timezone — assumed UTC, TODO confirm with xVision)
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
