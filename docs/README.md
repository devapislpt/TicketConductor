# FallCon Ticket Conductor — Documentation

> A luxury ticket management system for events. Built with Next.js 16, Supabase, and Tailwind CSS v4.

---

## About the Project

FallCon Ticket Conductor is a full-stack web application that manages the complete lifecycle of event tickets — from issuance to check-in. It supports three user roles: **admin**, **event_assistant**, and **ticket_owner**.

Key capabilities:
- Admins create events, import attendees via CSV, and issue ticket packs
- Ticket owners log in via magic link, view their tickets, and assign them to recipients by name and email
- Event assistants scan QR codes or look up attendees by email at the door
- The entire visual experience (colors, fonts, sounds) is configurable at runtime from the admin panel
- All actions are recorded in a tamper-evident audit log

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is sufficient)
- A [Resend](https://resend.com) account for transactional email
- Git

### 1. Clone and Install

```bash
git clone <repo-url> fallcon-ticket-conductor
cd fallcon-ticket-conductor
npm install
```

### 2. Environment Variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Resend (email)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=tickets@yourdomain.com

# App URL (used for magic link redirect)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Supabase Setup

Apply the database schema migration:

```bash
# Option A — Supabase CLI
npx supabase db push

# Option B — Supabase Dashboard
# Open supabase/migrations/001_initial_schema.sql in the SQL editor and run it.
```

Enable magic link auth in the Supabase dashboard:
- Authentication > Providers > Email > Enable "Magic Link"
- Set Site URL to `http://localhost:3000`
- Add `http://localhost:3000/auth-callback` to the redirect allow-list

Create your first admin user in the Supabase dashboard:
```sql
-- In the SQL editor, after creating the auth user through the Supabase UI:
UPDATE app_users SET role = 'admin' WHERE email = 'you@example.com';
```

### 4. Run the Development Server

```bash
npm run dev
```

Open http://localhost:3000. You will be redirected to /login.

Use the magic link form to log in with your admin email.

---

## Documentation Index

| Document | Description |
|---|---|
| architecture.md | System overview, data flows, API inventory, middleware, state management |
| database-schema.md | All tables, columns, RLS policies, triggers, indexes |
| theming-guide.md | Theme variables, CSS custom properties, sounds, soundtrack |
| connect-integration.md | Connect integration roadmap and API contract |
| CHANGELOG.md | Decisions log — what was built, why, and how |
| csv-import-format.md | CSV import format, column definitions, error handling |
| use-cases/ | Individual use-case specifications |

---

## Project Structure

```
fallcon-ticket-conductor/
|
+-- src/
|   +-- app/                        # Next.js App Router pages and API routes
|   |   +-- (admin)/                # Admin route group (requires admin/event_assistant role)
|   |   |   +-- admin/
|   |   |       +-- check-in/       # QR scanner and manual lookup
|   |   |       +-- connect/        # Connect integration stub
|   |   |       +-- events/         # Event CRUD
|   |   |       +-- logs/           # Audit log viewer
|   |   |       +-- reports/        # Export and statistics
|   |   |       +-- settings/       # App settings and theming editor
|   |   |       +-- ticket-packs/   # Pack management
|   |   |       +-- users/          # User management
|   |   |
|   |   +-- (auth)/                 # Auth route group (unauthenticated)
|   |   |   +-- login/              # Magic link request form
|   |   |   +-- magic-link/         # Check your email confirmation page
|   |   |   +-- reset-password/     # Password reset form
|   |   |   +-- auth-callback/      # Supabase OAuth/OTP redirect handler
|   |   |
|   |   +-- (user)/                 # User route group (requires ticket_owner role)
|   |   |   +-- dashboard/          # Ticket summary and stats
|   |   |   +-- events/[eventId]/   # Event detail view
|   |   |   +-- orders/[packId]/    # Ticket pack detail and assignment
|   |   |
|   |   +-- api/                    # Next.js API routes
|   |       +-- admin/              # Admin-only endpoints
|   |       |   +-- export/         # CSV export
|   |       |   +-- import/         # CSV import
|   |       |   +-- settings/       # App settings CRUD
|   |       |   +-- theme/          # Theme settings CRUD
|   |       |   +-- users/          # User management
|   |       +-- auth/               # Auth endpoints
|   |       |   +-- callback/       # Supabase callback handler
|   |       |   +-- magic-link/     # Send magic link
|   |       |   +-- signin/         # Email/password sign-in
|   |       +-- check-in/           # Check-in endpoints
|   |       |   +-- [ticketId]/     # Perform check-in
|   |       |   +-- lookup/         # Search tickets by email or QR
|   |       |   +-- stats/          # Check-in statistics
|   |       +-- events/             # Event CRUD endpoints
|   |       |   +-- [eventId]/      # Single event operations
|   |       +-- ticket-packs/       # Pack endpoints
|   |       |   +-- [packId]/tickets/ # Tickets within a pack
|   |       +-- tickets/[ticketId]/ # Individual ticket operations
|   |
|   +-- components/                 # Reusable React components
|   |   +-- admin/                  # Admin-only components
|   |   |   +-- SoundtrackPlayer.tsx  # Ambient music player widget
|   |   |   +-- ThemePreview.tsx      # Live theme preview panel
|   |   |   +-- ThemingEditor.tsx     # Theme settings form
|   |   +-- check-in/
|   |   |   +-- CheckInScanner.tsx    # BarcodeDetector + manual fallback
|   |   +-- layout/
|   |   |   +-- AdminNav.tsx          # Admin sidebar navigation
|   |   |   +-- AppNav.tsx            # User top navigation
|   |   |   +-- ThemeProvider.tsx     # Loads theme from DB on mount
|   |   +-- tickets/
|   |   |   +-- TicketPackManager.tsx # Inline ticket assignment UI
|   |   |   +-- TicketQRCode.tsx      # QR code renderer
|   |   +-- ui/                     # Design system primitives
|   |       +-- badge.tsx
|   |       +-- button.tsx
|   |       +-- card.tsx
|   |       +-- data-table.tsx
|   |       +-- input.tsx
|   |       +-- modal.tsx
|   |       +-- toast.tsx
|   |
|   +-- lib/
|   |   +-- resend/
|   |   |   +-- client.ts           # Resend SDK wrapper
|   |   |   +-- emails/
|   |   |       +-- TicketConfirmation.tsx  # Email template
|   |   +-- stores/                 # Zustand global state
|   |   |   +-- theme.store.ts      # Theme config + DOM application
|   |   |   +-- sound.store.ts      # Sound effects (Howler.js)
|   |   |   +-- soundtrack.store.ts # Background music (Howler.js)
|   |   +-- supabase/
|   |   |   +-- client.ts           # Browser Supabase client
|   |   |   +-- middleware.ts       # Session refresh + route guard logic
|   |   |   +-- server.ts           # Server-side clients (anon + service role)
|   |   +-- types/
|   |   |   +-- index.ts            # All TypeScript interfaces and enums
|   |   +-- utils/
|   |   |   +-- audit.ts            # logAudit() helper
|   |   |   +-- cn.ts               # clsx + tailwind-merge
|   |   |   +-- format.ts           # Date formatting, slugify, etc.
|   |   |   +-- qrcode.ts           # QR code PNG generator
|   |   +-- validators/
|   |       +-- auth.ts             # Zod schemas for auth forms
|   |
|   +-- middleware.ts               # Next.js Edge Middleware entry point
|
+-- supabase/
|   +-- migrations/
|       +-- 001_initial_schema.sql  # Full DB schema, RLS, triggers, seed data
|
+-- public/
|   +-- sounds/                     # Static sound effect files
|       +-- click.mp3
|       +-- success.mp3
|       +-- error.mp3
|       +-- checkin.mp3
|
+-- docs/                           # This documentation directory
+-- tests/                          # Jest unit tests
+-- next.config.ts
+-- tsconfig.json
+-- package.json
```

---

## Deployment

### Vercel

1. Push the repository to GitHub/GitLab.
2. Import the project in the Vercel dashboard (https://vercel.com/new).
3. Add all environment variables (see the list in Quick Start above; VERCEL_URL is set automatically).
4. Set the Framework Preset to Next.js.
5. Deploy. Vercel will run `npm run build` automatically.

The magic link redirect URL for production must be added to Supabase:
- Authentication > URL Configuration > Add `https://yourdomain.vercel.app/auth-callback`

### Supabase (Production)

1. Create a new Supabase project for production.
2. Run the migration SQL via the SQL editor or Supabase CLI:
   ```bash
   npx supabase db push --db-url <your-production-db-url>
   ```
3. Copy the production NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY into Vercel's environment variables.
4. Create the initial admin user through the Supabase authentication dashboard, then set their role:
   ```sql
   UPDATE app_users SET role = 'admin' WHERE email = 'admin@yourdomain.com';
   ```

### DNS and Email

- Configure your sending domain in Resend and verify the DNS records.
- Update RESEND_FROM_EMAIL to use your verified domain.
