# FallCon Ticket Conductor — Architecture

## System Overview

```
+---------------------------+     HTTPS      +---------------------------+
|                           |  <-----------> |                           |
|   Browser (React/Next.js) |                |   Next.js 16 App Router   |
|   - Zustand stores        |                |   - Server Components     |
|   - Framer Motion         |                |   - API Route Handlers    |
|   - Howler.js sounds      |                |   - Edge Middleware       |
|   - BarcodeDetector API   |                |                           |
+---------------------------+                +-------------+-------------+
                                                           |
                              +----------------------------+-----------------------------+
                              |                            |                             |
                   +----------+----------+    +-----------+-----------+    +------------+----------+
                   |                     |    |                       |    |                       |
                   |  Supabase Postgres  |    |   Supabase Auth       |    |   Resend Email        |
                   |  - app_users        |    |   - Magic link OTP    |    |   - Ticket confirm    |
                   |  - events           |    |   - Session cookies   |    |   - Magic link email  |
                   |  - ticket_packs     |    |   - auth.users table  |    |                       |
                   |  - tickets          |    |                       |    +------------------------+
                   |  - audit_logs       |    +-----------------------+
                   |  - theme_settings   |
                   |  - connect_config   |
                   |  - media_assets     |
                   |  - teams            |
                   +---------------------+
```

Hosting: Vercel (Next.js) + Supabase (DB + Auth) + Resend (Email)

---

## Data Flow: User Login to Dashboard

```
1. User visits /login
   |
   v
2. User enters email, submits form
   |
   v
3. POST /api/auth/magic-link
   - Checks app_users table for email (shouldCreateUser: false)
   - If not found: returns 404 "No account found"
   - If inactive: returns 403 "Account deactivated"
   - If found: calls supabase.auth.signInWithOtp()
   - Inserts audit_logs entry (user.magic_link_sent)
   |
   v
4. Supabase sends email with magic link
   Link target: /auth-callback?token_hash=...&type=email
   |
   v
5. User clicks link -> GET /auth-callback
   - Calls supabase.auth.exchangeCodeForSession()
   - Session cookie set by Supabase SSR
   |
   v
6. Next.js Middleware runs on every request
   - Reads session cookie via createServerClient()
   - Fetches app_users.role for the authenticated user
   - admin / event_assistant -> allowed on /admin routes
   - event_assistant -> restricted to /admin/check-in only
   - ticket_owner -> redirected to /dashboard if accessing /admin
   |
   v
7. /dashboard page renders
   - Server Component fetches user's ticket_packs + tickets
   - ThemeProvider component mounts, calls /api/admin/theme
   - ThemeStore.loadFromDB() applies CSS variables to document.documentElement
   - SoundStore loads Howler.js sounds lazily (client-side only)
```

---

## Data Flow: Admin Creates Event and Imports Users

```
1. Admin navigates to /admin/events/new
   |
   v
2. Fills EventForm (React Hook Form + Zod validation)
   |
   v
3. POST /api/events
   - Auth check: requires admin role
   - Validates slug uniqueness, appends random suffix if collision
   - Inserts into events table
   - Inserts into event_links table (if links provided)
   - Logs audit entry (event.create)
   |
   v
4. Admin navigates to /admin/users -> clicks "Import CSV"
   |
   v
5. Admin uploads CSV file (email, full_name, team_name, event_name, pack_name, ticket_count)
   |
   v
6. POST /api/admin/import (multipart/form-data)
   For each row:
   a. Upsert team (teams table, cached per import batch)
   b. Create or find Supabase auth.users record
      (admin.auth.createUser with email_confirm: true)
   c. Upsert app_users profile (role: ticket_owner)
   d. Resolve event by name
   e. Insert ticket_pack record
   f. DB trigger (trg_generate_tickets) auto-creates N ticket rows
      with QR codes in format: TKT-<UUID stripped of dashes, uppercased>
   g. Log audit entry per pack created
   - Per-row errors are collected and returned; they do NOT stop the import
   |
   v
7. Import summary returned: { success, errors, created_users, created_packs }
```

---

## Data Flow: Check-In Flow

```
1. Event assistant navigates to /admin/check-in
   |
   v
2. Selects event from dropdown
   |
   v
3a. QR Scanner path:
    - CheckInScanner component starts camera stream
    - Uses window.BarcodeDetector API (Chrome/Edge native)
    - Falls back to manual entry if BarcodeDetector unavailable
    - On successful scan: qr_code value extracted
    |
    v
3b. Manual lookup path:
    - Staff types recipient email
    - GET /api/check-in/lookup?email=...
    - Returns matching tickets for published events
    |
    v
4. POST /api/check-in/[ticketId]
   - Auth: admin or event_assistant required
   - Validates ticket exists
   - Validates event.status = 'published'
   - If already checked_in: returns { success: false, already_checked_in: true }
   - If valid: updates ticket (status=checked_in, checked_in_at, checked_in_by)
   - Logs audit entry (ticket.check_in)
   |
   v
5. Response displayed with Framer Motion animation
   - Success: green banner, checkin.mp3 sound plays
   - Already checked in: amber warning with original check-in timestamp
   - Error: red banner, error.mp3 sound plays
   |
   v
6. Scanner resets and awaits next scan
```

---

## Role-Based Access Control Matrix

| Feature | admin | event_assistant | ticket_owner |
|---|:---:|:---:|:---:|
| View own tickets | Yes | No | Yes |
| Assign ticket recipients | Yes | No | Yes (within cutoff) |
| View own events | Yes | No | Yes (published only) |
| Download ticket QR | Yes | No | Yes |
| QR check-in scanning | Yes | Yes | No |
| Manual ticket lookup | Yes | Yes | No |
| View check-in stats | Yes | Yes | No |
| Create / edit events | Yes | No | No |
| Manage ticket packs | Yes | No | No |
| Create / manage users | Yes | No | No |
| CSV import | Yes | No | No |
| CSV export | Yes | No | No |
| View audit logs | Yes | No | No |
| Edit theme settings | Yes | No | No |
| Manage sounds / soundtrack | Yes | No | No |
| Configure Connect integration | Yes | No | No |
| View admin dashboard | Yes | No | No |

Route enforcement is handled at two layers:
1. Next.js Middleware (src/middleware.ts) — redirects before page renders
2. API route handlers — return 401/403 if role check fails

---

## API Route Inventory

### Auth

| Method | Route | Auth Required | Description |
|---|---|---|---|
| POST | /api/auth/magic-link | No | Request magic link email. Checks app_users first; shouldCreateUser=false |
| POST | /api/auth/signin | No | Email + password sign-in (fallback for admin accounts) |
| GET | /api/auth/callback | No | Supabase OTP exchange; sets session cookie |

### Events

| Method | Route | Auth Required | Description |
|---|---|---|---|
| GET | /api/events | Yes (any) | List events. Non-admins see published only |
| POST | /api/events | Yes (admin) | Create event with optional links |
| GET | /api/events/[eventId] | Yes (any) | Get single event with links |
| PATCH | /api/events/[eventId] | Yes (admin) | Update event fields and links |
| DELETE | /api/events/[eventId] | Yes (admin) | Archive event (sets status=archived) |

### Ticket Packs

| Method | Route | Auth Required | Description |
|---|---|---|---|
| GET | /api/ticket-packs | Yes (any) | List packs. Owners see own; admins see all |
| POST | /api/ticket-packs | Yes (admin) | Create pack; triggers auto ticket generation |
| GET | /api/ticket-packs/[packId]/tickets | Yes (owner or admin) | List all tickets in a pack |

### Tickets

| Method | Route | Auth Required | Description |
|---|---|---|---|
| PATCH | /api/tickets/[ticketId] | Yes (owner or admin) | Assign recipient name/email to ticket |

### Check-In

| Method | Route | Auth Required | Description |
|---|---|---|---|
| GET | /api/check-in/lookup | Yes (admin, event_assistant) | Search tickets by email or exact QR code |
| POST | /api/check-in/[ticketId] | Yes (admin, event_assistant) | Mark ticket as checked in |
| GET | /api/check-in/stats | Yes (admin, event_assistant) | Check-in counts per event |

### Admin — Users

| Method | Route | Auth Required | Description |
|---|---|---|---|
| GET | /api/admin/users | Yes (admin) | List users with optional search/filter |
| POST | /api/admin/users | Yes (admin) | Create user, send magic link |
| PATCH | /api/admin/users | Yes (admin) | Update profile, send magic link, reset password, impersonate |
| DELETE | /api/admin/users?id=... | Yes (admin) | Deactivate user (soft delete, is_active=false) |

### Admin — Import / Export

| Method | Route | Auth Required | Description |
|---|---|---|---|
| POST | /api/admin/import | Yes (admin) | Bulk CSV import: users, teams, packs, tickets |
| GET | /api/admin/export | Yes (admin) | Export tickets as CSV with filter params |

### Admin — Theme

| Method | Route | Auth Required | Description |
|---|---|---|---|
| GET | /api/admin/theme | No (public read) | Fetch all theme settings as flat key-value object |
| PATCH | /api/admin/theme | Yes (admin) | Update one or many theme keys |

### Admin — Settings

| Method | Route | Auth Required | Description |
|---|---|---|---|
| GET | /api/admin/settings | Yes (admin) | Get app settings including connect_config |
| PATCH | /api/admin/settings | Yes (admin) | Update app settings |

---

## Middleware

File: `src/middleware.ts` and `src/lib/supabase/middleware.ts`

The Next.js Edge Middleware runs on every request that is not a static asset. Its responsibilities:

1. **Session refresh**: Calls `updateSession()` which uses `@supabase/ssr`'s `createServerClient` to read and refresh the session cookie on every request. This keeps the JWT fresh without requiring explicit refresh calls.

2. **Route protection**:
   - Unauthenticated users attempting any non-public route are redirected to `/login`
   - Authenticated users on auth pages (login, magic-link, reset-password) are redirected to `/dashboard`
   - Users accessing `/admin/*` routes have their role fetched from `app_users`; non-admin/assistant roles are redirected to `/dashboard`
   - `event_assistant` role is further restricted: they can only access `/admin/check-in`; all other admin paths redirect them to `/admin/check-in`

3. **Public routes** (no auth required): `/login`, `/magic-link`, `/reset-password`, `/auth-callback`

The matcher excludes: `_next/static`, `_next/image`, `favicon.ico`, `public/`, and static file extensions.

---

## State Management

Three Zustand stores manage client-side global state:

### 1. ThemeStore (`src/lib/stores/theme.store.ts`)

Manages the active theme configuration loaded from the database.

- **State**: `theme: ThemeConfig`, `isLoaded: boolean`
- **`loadFromDB()`**: Fetches `/api/admin/theme` and merges with defaults. Called by `ThemeProvider` on mount.
- **`applyToDOM(config)`**: Iterates all theme keys and sets CSS custom properties on `document.documentElement`. Font values get fallback stacks appended. Animation duration is converted from raw ms to `Xms` format.
- **`updateKey(key, value)`**: Used by the theming editor for live preview without saving.
- The CSS variable map (`CSS_VAR_MAP`) is the single source of truth for `db key -> CSS var name` translation.

### 2. SoundStore (`src/lib/stores/sound.store.ts`)

Manages short sound effects (click, success, error, check-in).

- **State**: `enabled`, `volume`, `sounds: Record<SoundName, HowlInstance>`, `isReady`
- **SSR safety**: `import('howler')` is a dynamic import inside an async function; it never runs on the server.
- **`loadSounds(config)`**: Creates one Howl instance per sound name. Uses `Promise.allSettled` so a failed sound does not block the rest.
- **`play(name)`**: Guards against: sounds disabled, tab not visible, sound not loaded.
- **`setVolume(v)`**: Clamps to 0-1 and updates all loaded Howl instances.

### 3. SoundtrackStore (`src/lib/stores/soundtrack.store.ts`)

Manages continuous looping background music.

- **State**: `isPlaying`, `volume`, `url`, `isEnabled`, `howl: HowlInstance | null`
- Uses `html5: true` for streaming (suitable for longer audio files).
- **`play()`** / **`pause()`**: Fades in/out over 1500ms using Howler's `.fade()` method.
- **`load(url, autoplay?)`**: Unloads any existing Howl, creates a new one, optionally starts playback.
- **`toggle()`**: Used by the `SoundtrackPlayer` UI widget in the admin bar.

---

## Error Handling Strategy

**API routes**: All handlers are wrapped in try/catch. Errors are returned as `{ data: null, error: string }` with an appropriate HTTP status code. The `ApiResponse<T>` type union enforces this shape at the TypeScript level.

**Client components**: Use `react-hot-toast` for user-facing error messages. Sound effects accompany success (`success.mp3`) and error (`error.mp3`) states.

**CSV import**: Per-row errors are collected into `ImportResult.errors[]` and returned in the response. A single bad row does not abort the import. The calling UI displays a summary table of which rows failed and why.

**Supabase RLS**: Database-level policies provide a second line of defense. Even if an API route bug skips an auth check, the database will reject the query.

**Sound/Theme loading failures**: Both stores use `console.warn` for non-critical failures (e.g., a sound file 404) and fall back gracefully — the UI continues to work without audio.

**Missing BarcodeDetector**: The `CheckInScanner` component detects `window.BarcodeDetector` availability at runtime. If absent (Firefox, older Safari), it renders only the manual entry form with no error shown.
