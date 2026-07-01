# FallCon Ticket Conductor — CHANGELOG

All notable decisions, solutions, and architectural choices are documented here.

Format: `[YYYY-MM-DD]` dated entries with bullet points for each decision.

---

## [2026-06-21] — Initial Build

### Project Requirements Defined

FallCon Ticket Conductor is a luxury ticket management system for events. The core requirements:
- Three user roles: admin, event_assistant, ticket_owner
- Magic link login (no passwords for end users)
- Admins can create events, import attendees via CSV, and manage ticket packs
- Ticket owners can assign names and emails to their tickets
- Event staff can scan QR codes or look up attendees at the door
- All visual styling is runtime-configurable by admins (no code deployments for theme changes)
- Complete audit trail for all significant actions

---

### Key Technology Decisions

**Next.js 16 (App Router)**
Selected for its first-class TypeScript support, server components, and file-system-based API routing. The App Router's route groups (`(admin)`, `(auth)`, `(user)`) provide clean layout separation without additional routing libraries. Next.js 16 is the latest stable release as of the build date.

**Supabase (Auth + Database)**
Selected for the combination of managed Postgres, row-level security, and Auth in a single platform. The `@supabase/ssr` package provides session handling that works correctly with Next.js server components and the Edge Middleware pattern. Key advantage: RLS provides a database-level safety net even if application-level auth checks have bugs.

**Resend (Transactional Email)**
Selected for its clean React Email template support and reliable deliverability. Used for magic link emails and ticket confirmation emails. The Resend SDK wraps the HTTP API; the `TicketConfirmation.tsx` template uses React Email components.

**Vercel (Hosting)**
Selected for zero-configuration Next.js deployments and native Edge Middleware support. The Edge Middleware pattern (session refresh on every request) requires Vercel's infrastructure to run efficiently. Preview deployments on each PR are a key workflow benefit.

**Tailwind CSS v4**
Selected over v3 for its new CSS-first configuration approach. Theme variables are injected as CSS custom properties via JavaScript rather than being compiled at build time, which is necessary for the runtime theming system. Tailwind v4 co-exists cleanly with CSS custom properties.

**Framer Motion**
Selected for declarative animation in React. Used for page transitions, stat card entrance animations, and the check-in result banner animations. All animations respect the `animations_enabled` theme setting via a wrapper.

**Howler.js**
Selected for cross-browser audio playback. Sound files are loaded lazily via dynamic `import('howler')` inside async functions — this prevents any server-side import issues. Two separate Zustand stores manage sound effects and the soundtrack independently.

**Zustand**
Selected over Redux or React Context for global state. Three stores: ThemeStore, SoundStore, SoundtrackStore. Zustand's minimal API reduces boilerplate; stores are imported directly without Provider wrappers.

**Zod + React Hook Form**
Selected for form validation. Zod schemas are defined once and used for both client-side form validation (via `@hookform/resolvers/zod`) and server-side API body validation (`schema.safeParse(body)`). This ensures consistent validation rules between client and server.

**QRCode (npm: qrcode)**
Selected for server-side QR code PNG generation. QR codes are generated as data URLs when displaying tickets. The QR code value itself is generated in the database trigger (`TKT-` + UUID), so it exists before any display code runs.

---

### Security Decisions

**Hashed passwords / API keys**
The `connect_config` table stores the Connect API key as a bcrypt hash (`api_key_hash`). The plaintext key is never stored. Admins can see only the last 4 characters (`api_key_hint`) for identification purposes. Supabase manages user passwords in `auth.users` using bcrypt; the application never handles raw passwords.

**Admin cannot view plaintext passwords or API keys**
By design, there is no "reveal key" or "show password" feature. If a key is lost, the admin must reset it and store the new value. This is enforced by the data model (hash stored, not plaintext) rather than by UI controls.

**shouldCreateUser: false on magic link**
The magic link route uses `supabase.auth.signInWithOtp({ shouldCreateUser: false })`. This means Supabase will never auto-create an auth user from the OTP flow. Only pre-provisioned accounts (created by an admin or via CSV import) can log in. Attempting a magic link with an unknown email returns 404 immediately, before OTP is sent.

**RLS on all tables**
Every table in the schema has `ENABLE ROW LEVEL SECURITY`. Policies are written to be restrictive by default (deny all, then grant specific access). The `current_user_role()` helper function is `SECURITY DEFINER` and `STABLE`, so it can be used safely in policy expressions without performance issues.

---

### Data Model Decisions

**DB trigger auto-generates tickets on pack creation**
When a `ticket_packs` row is inserted, the `trg_generate_tickets` trigger immediately creates `total_tickets` rows in the `tickets` table. Each ticket gets a unique QR code in the format `TKT-<32 uppercase hex chars>`. This means tickets always exist in a consistent state and the application does not need to manage ticket creation separately.

**app_users mirrors auth.users**
A trigger (`trg_on_auth_user_created`) fires after every insert into Supabase's `auth.users` and creates a matching row in `app_users`. This means the application can query `app_users` for profile data (role, team, name) without joining to the Supabase-internal auth tables. The `id` columns are identical UUIDs.

**Soft deletes for users**
Deleting a user via `DELETE /api/admin/users` sets `is_active = false` rather than removing the row. This preserves audit log references and ticket history. The auth.users record is also left intact (the user simply cannot log in because their account is checked before the magic link is sent).

**cutoff_at on events**
Events have an optional `cutoff_at` timestamp. The tickets RLS policy for `UPDATE` enforces that ticket owners can only modify tickets before this deadline: `e.cutoff_at IS NULL OR e.cutoff_at > NOW()`. This allows admins to lock down ticket assignments before an event.

---

### Auth Flow Decisions

**Magic link with shouldCreateUser: false**
The auth flow was designed around pre-provisioned accounts. The magic link request endpoint checks `app_users` first and returns a 404 if the email is not found. This gives users a clear message ("No account found") rather than Supabase's default behavior of silently not sending an email.

**Role-based redirect on login**
After the Supabase OTP callback exchanges the token for a session, the `auth-callback` route determines the user's role and redirects accordingly:
- `admin` or `event_assistant` -> `/admin` (or `/admin/check-in` for assistants)
- `ticket_owner` -> `/dashboard`

This is enforced additionally by the Next.js Middleware on every subsequent request.

**event_assistant is restricted to check-in**
Event assistants can only access `/admin/check-in`. Attempting to navigate to any other `/admin/*` path redirects them to `/admin/check-in`. This is enforced in `src/lib/supabase/middleware.ts`.

---

### Theming Decisions

**All styles driven from DB theme_settings**
Rather than hardcoding design tokens in Tailwind config or CSS files, all theme values live in the `theme_settings` database table. The `ThemeProvider` component fetches them on mount and applies them as CSS custom properties on `document.documentElement`. This allows admins to change colors, fonts, spacing, and sounds at runtime without any deployment.

**CSS_VAR_MAP is the single mapping source of truth**
The `CSS_VAR_MAP` object in `theme.store.ts` defines the exact mapping from database key names to CSS variable names. Every key that exists in the database must have an entry in this map. New theme variables require a corresponding entry in: the DB (or seed), `ThemeConfig` TypeScript interface, `CSS_VAR_MAP`, and `defaultTheme`.

**Font fallbacks are applied automatically**
When the ThemeStore applies a font family to the DOM, it appends a system fallback: serif for headings, sans-serif for body, monospace for code. This means partial font loading (e.g., a slow Google Fonts load) gracefully falls back.

---

### Sound System Decisions

**Howler.js, lazy-loaded for SSR safety**
Howler.js references `window` and the Web Audio API, which do not exist in Node.js. All Howl instances are created via dynamic `import('howler')` inside async functions. This ensures the import never runs during server-side rendering or in Next.js API routes.

**Sound effects and soundtrack are separate stores**
Sound effects (click, success, error, check-in) are short and use `html5: false` (in-memory buffered audio, lower latency). The soundtrack is long-form and uses `html5: true` (streaming). Separating them into two Zustand stores keeps the volume, enabled state, and playback logic independent.

**Fade in/out for soundtrack**
The SoundtrackStore uses Howler's `.fade()` method to fade in over 1500ms and fade out over 1500ms. This is intentional for the luxury experience — abrupt start/stop of background music would feel jarring.

---

### Check-In System Decisions

**BarcodeDetector API with graceful degradation**
The CheckInScanner component uses the browser's native `window.BarcodeDetector` API (available in Chrome and Edge) for QR scanning. If the API is unavailable (Firefox, older Safari), the scanner UI is hidden and only the manual entry form is shown. No error is surfaced to the user — the fallback is seamless.

**Manual entry fallback**
Staff can always look up tickets by typing a recipient's email address into the lookup form. The `GET /api/check-in/lookup?email=...` route does a case-insensitive `ilike` search on `recipient_email`. This handles cases where the attendee's QR code is damaged, on a dead phone battery, or otherwise unavailable.

**Already-checked-in tickets return success, not error**
The check-in endpoint returns `{ success: false, already_checked_in: true }` with HTTP 200 (not 4xx) when a ticket has already been checked in. This allows the UI to display a warning with the original check-in timestamp rather than treating it as a failure. The distinction between "already used" and "not found" is important for gate staff.

---

### Connect Integration Decisions

**Stub UI built, no active integration**
The Connect panel (`/admin/connect`) was built to capture the configuration (API URL, API key) and show the integration's status, but no outbound API calls are made. This allows admins to see the feature exists and understand the integration path without any risk of incomplete integration affecting production data.

**API key bcrypt hashed at write time**
When an admin saves a Connect API key, the plaintext key must be hashed before storage. The application stores only the bcrypt hash and the last 4 characters as a hint. This decision was made before the Connect API is even available — it ensures the security model is correct from day one.

---

### Testing Decisions

**Jest for unit tests, Playwright for E2E**
Jest with `jest-environment-jsdom` handles unit and component tests. Playwright handles end-to-end browser testing. Both test runners are configured in `package.json`; Jest runs via `npm test` and Playwright via `npm run test:e2e`.

**`--passWithNoTests` on Jest**
The Jest config uses `--passWithNoTests` so CI does not fail when the test suite is being built out. This flag will be removed once a baseline set of tests is established.
