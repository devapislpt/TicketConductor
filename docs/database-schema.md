# FallCon Ticket Conductor — Database Schema

## Entity Relationship Diagram

```
auth.users (Supabase managed)
    |
    | 1:1 (trigger: trg_on_auth_user_created)
    v
app_users
    |--- team_id ---------> teams
    |
    | 1:N (owner_id)
    v
ticket_packs
    |--- event_id --------> events
    |                           |
    | 1:N (trigger:             | 1:N
    |  trg_generate_tickets)    v
    v                       event_links
tickets
    |--- checked_in_by ---> app_users

theme_settings   (standalone — no FK)
audit_logs       |--- actor_id --------> app_users
connect_config   (standalone — singleton row)
media_assets     |--- created_by -------> app_users
```

---

## Enum Types

### `user_role`
Values: `admin`, `event_assistant`, `ticket_owner`

- `admin`: Full access to all features
- `event_assistant`: Check-in only (read ticket data, mark checked-in)
- `ticket_owner`: View and assign their own ticket packs

### `event_status`
Values: `draft`, `published`, `archived`

- `draft`: Visible only to admin/event_assistant; not available for check-in
- `published`: Visible to all authenticated users; check-in enabled
- `archived`: Hidden from most views; historical record

### `ticket_status`
Values: `unassigned`, `assigned`, `checked_in`

- `unassigned`: No recipient set
- `assigned`: recipient_name and recipient_email populated, confirmation may have been sent
- `checked_in`: Scanned at the door; checked_in_at and checked_in_by set

### `event_link_type`
Values: `zoom`, `maps`, `website`, `other`

Categorizes links attached to an event for display purposes.

### `theme_category`
Values: `color`, `typography`, `spacing`, `animation`, `sound`, `media`

Groups theme settings in the admin theming editor.

### `sync_status`
Values: `idle`, `syncing`, `error`

Tracks the state of the Connect integration sync.

---

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- fuzzy text search (future use)
```

---

## Tables

### `teams`

Organizational groupings for users (e.g., company departments, sports teams).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | Unique identifier |
| name | TEXT | NOT NULL, UNIQUE | Team display name |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | Creation timestamp |

**RLS Policies**:
- `teams_select_all`: Any authenticated user can read
- `admin_all_teams`: Admins can INSERT, UPDATE, DELETE

---

### `app_users`

Application user profiles. Every row corresponds to a row in Supabase's `auth.users`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, FK -> auth.users(id) ON DELETE CASCADE | Matches Supabase auth user ID |
| email | TEXT | NOT NULL, UNIQUE | User email address |
| full_name | TEXT | nullable | Display name |
| role | user_role | NOT NULL, default 'ticket_owner' | Access level |
| team_id | UUID | nullable, FK -> teams(id) ON DELETE SET NULL | Team membership |
| is_active | BOOLEAN | NOT NULL, default TRUE | Soft-delete flag |
| last_sign_in_at | TIMESTAMPTZ | nullable | Updated externally or via trigger |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | Profile creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, default NOW() | Auto-updated by trigger |

**RLS Policies**:
- `users_select_own`: Users can read their own row; admins can read all rows
- `admin_all_users`: Admins can INSERT, UPDATE, DELETE

**Notes**:
- The `id` column must match `auth.users.id`. The `trg_on_auth_user_created` trigger handles automatic insertion when a new auth user is created.
- Deletion is soft: `is_active = false`. Auth users are not deleted from `auth.users`.

---

### `events`

An event that ticket packs are issued for.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | Unique identifier |
| name | TEXT | NOT NULL | Event display name |
| slug | TEXT | NOT NULL, UNIQUE | URL-safe identifier (e.g., "fall-con-2026") |
| description | TEXT | nullable | Short public description |
| details | TEXT | nullable | Long-form details (markdown supported) |
| location_name | TEXT | nullable | Venue name |
| location_address | TEXT | nullable | Street address |
| google_maps_url | TEXT | nullable | Direct Google Maps link |
| start_date | TIMESTAMPTZ | NOT NULL | Event start |
| end_date | TIMESTAMPTZ | nullable | Event end (optional) |
| cutoff_at | TIMESTAMPTZ | nullable | Deadline for ticket_owner edits |
| status | event_status | NOT NULL, default 'draft' | Visibility and check-in availability |
| banner_url | TEXT | nullable | Header image URL |
| created_by | UUID | NOT NULL, FK -> app_users(id) ON DELETE RESTRICT | Creator reference |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, default NOW() | Auto-updated by trigger |

**RLS Policies**:
- `events_select_published`: Authenticated users see published events; admin/assistant see all
- `admin_all_events`: Admins can INSERT, UPDATE, DELETE

---

### `event_links`

External links attached to an event (Zoom calls, Google Maps, websites).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | Unique identifier |
| event_id | UUID | NOT NULL, FK -> events(id) ON DELETE CASCADE | Parent event |
| type | event_link_type | NOT NULL, default 'other' | Link category |
| label | TEXT | NOT NULL | Display text |
| url | TEXT | NOT NULL | Target URL |
| sort_order | INT | NOT NULL, default 0 | Display ordering |

**RLS Policies**:
- `event_links_select`: Readable if the parent event is readable
- `admin_all_event_links`: Admins can INSERT, UPDATE, DELETE

---

### `ticket_packs`

A named bundle of tickets issued to a specific user for a specific event.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | Unique identifier |
| event_id | UUID | NOT NULL, FK -> events(id) ON DELETE CASCADE | Parent event |
| owner_id | UUID | NOT NULL, FK -> app_users(id) ON DELETE CASCADE | Ticket holder |
| pack_name | TEXT | NOT NULL | Display name for the pack |
| total_tickets | INT | NOT NULL, CHECK > 0 AND <= 500 | Number of tickets to generate |
| notes | TEXT | nullable | Internal admin notes |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, default NOW() | Auto-updated by trigger |

**RLS Policies**:
- `packs_select_own`: Owners see their own packs; admin/assistant see all
- `packs_update_own`: Owners can update their own packs; admins always can
- `admin_all_packs`: Admins can INSERT, DELETE

**Notes**:
- Inserting a row into `ticket_packs` automatically triggers `trg_generate_tickets`, which creates `total_tickets` rows in the `tickets` table.

---

### `tickets`

An individual ticket within a pack. Generated automatically by trigger.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | Unique identifier |
| pack_id | UUID | NOT NULL, FK -> ticket_packs(id) ON DELETE CASCADE | Parent pack |
| recipient_name | TEXT | nullable | Assigned attendee name |
| recipient_email | TEXT | nullable | Assigned attendee email |
| qr_code | TEXT | UNIQUE, nullable | QR code value (format: TKT-<32 hex chars uppercase>) |
| status | ticket_status | NOT NULL, default 'unassigned' | Current state |
| checked_in_at | TIMESTAMPTZ | nullable | Timestamp of check-in |
| checked_in_by | UUID | nullable, FK -> app_users(id) ON DELETE SET NULL | Staff who checked in |
| confirmation_sent_at | TIMESTAMPTZ | nullable | When confirmation email was sent |
| sort_order | INT | NOT NULL, default 0 | Display order within pack |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, default NOW() | Auto-updated by trigger |

**RLS Policies**:
- `tickets_select_own_pack`: Owners see tickets in their own packs; admin/assistant see all
- `tickets_update_own_pack`: Owners can update tickets in their packs (before cutoff_at); admin/assistant always can
- `admin_all_tickets`: Admins can INSERT, DELETE

---

### `audit_logs`

Immutable append-only log of all significant actions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | Unique identifier |
| actor_id | UUID | nullable, FK -> app_users(id) ON DELETE SET NULL | Who performed the action |
| actor_email | TEXT | nullable | Email snapshot (preserved if user deleted) |
| action | TEXT | NOT NULL | Action identifier (e.g., "ticket.check_in") |
| entity_type | TEXT | NOT NULL | What was affected (e.g., "ticket", "user") |
| entity_id | UUID | nullable | ID of the affected record |
| old_value | JSONB | nullable | State before the change |
| new_value | JSONB | nullable | State after the change |
| ip_address | INET | nullable | Client IP from x-forwarded-for |
| user_agent | TEXT | nullable | Browser/client identifier |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | When the action occurred |

**RLS Policies**:
- `admin_all_audit_logs`: Admins only. No UPDATE or DELETE policies exist — audit logs are effectively immutable via the application.

**Known action values** (from `AuditAction` TypeScript type):
`ticket.assign`, `ticket.update`, `ticket.unassign`, `ticket.check_in`,
`pack.create`, `pack.update`, `pack.delete`,
`event.create`, `event.update`, `event.delete`,
`user.create`, `user.update`, `user.delete`, `user.impersonate`, `user.password_reset`, `user.magic_link_sent`,
`theme.update`, `settings.update`

---

### `theme_settings`

Key-value store for all runtime theme configuration. Seeded with defaults on migration.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | Unique identifier |
| key | TEXT | NOT NULL, UNIQUE | Theme variable key (e.g., "color_primary") |
| value | TEXT | NOT NULL | Current value |
| category | theme_category | NOT NULL, default 'color' | Grouping for the admin UI |
| label | TEXT | NOT NULL | Human-readable label |
| updated_by | UUID | nullable, FK -> app_users(id) ON DELETE SET NULL | Last editor |
| updated_at | TIMESTAMPTZ | NOT NULL, default NOW() | Last update time |

**RLS Policies**:
- `theme_select_all`: Any authenticated user can read (needed for ThemeProvider)
- `admin_all_theme`: Admins can INSERT, UPDATE, DELETE

---

### `connect_config`

Singleton configuration table for the Connect integration. Expected to have at most one row.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | Unique identifier |
| api_url | TEXT | nullable | Base URL of the Connect API |
| api_key_hash | TEXT | nullable | bcrypt hash of the API key (never stored plaintext) |
| api_key_hint | TEXT | nullable | Last 4 characters shown in UI |
| is_enabled | BOOLEAN | NOT NULL, default FALSE | Whether integration is active |
| last_sync_at | TIMESTAMPTZ | nullable | Last successful sync timestamp |
| sync_status | sync_status | nullable, default 'idle' | Current sync state |
| error_message | TEXT | nullable | Last error message |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, default NOW() | Last update |

**RLS Policies**:
- `admin_all_connect`: Admins only

---

### `media_assets`

Tracks uploaded media files (sounds, images) managed through the admin panel.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | Unique identifier |
| name | TEXT | NOT NULL | Display name |
| type | TEXT | NOT NULL | Asset type: 'sound_effect', 'soundtrack', 'image' |
| url | TEXT | NOT NULL | Public URL (Supabase Storage or external CDN) |
| mime_type | TEXT | nullable | MIME type (e.g., "audio/mpeg") |
| size_bytes | BIGINT | nullable | File size |
| is_active | BOOLEAN | NOT NULL, default TRUE | Whether to show in pickers |
| sort_order | INT | NOT NULL, default 0 | Display ordering |
| created_by | UUID | nullable, FK -> app_users(id) ON DELETE SET NULL | Uploader |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | Upload timestamp |

**RLS Policies**:
- `media_select_all`: Any authenticated user can read
- `admin_all_media`: Admins can INSERT, UPDATE, DELETE

---

## Triggers

### `trg_app_users_updated_at`
- **Table**: app_users | **Event**: BEFORE UPDATE
- **Function**: `update_updated_at()` — sets `NEW.updated_at = NOW()`

### `trg_events_updated_at`
- **Table**: events | **Event**: BEFORE UPDATE
- **Function**: `update_updated_at()`

### `trg_ticket_packs_updated_at`
- **Table**: ticket_packs | **Event**: BEFORE UPDATE
- **Function**: `update_updated_at()`

### `trg_tickets_updated_at`
- **Table**: tickets | **Event**: BEFORE UPDATE
- **Function**: `update_updated_at()`

### `trg_on_auth_user_created`
- **Table**: auth.users | **Event**: AFTER INSERT
- **Function**: `handle_new_auth_user()`
- **Effect**: Inserts a matching row into `app_users` with role defaulting to `ticket_owner`. Uses `ON CONFLICT (id) DO NOTHING` so re-runs are safe. The function is `SECURITY DEFINER` to bypass RLS on `app_users` during the insert.

### `trg_generate_tickets`
- **Table**: ticket_packs | **Event**: AFTER INSERT
- **Function**: `generate_tickets_for_pack()`
- **Effect**: Loops from 1 to `NEW.total_tickets`, generating a unique QR code value for each iteration in the format `TKT-` + uppercase UUID (dashes stripped). Inserts each as a `tickets` row with `status = 'unassigned'`. This means tickets are always created synchronously at pack creation time.

---

## Indexes

| Index Name | Table | Columns | Rationale |
|---|---|---|---|
| idx_app_users_email | app_users | email | Magic link lookup, email search |
| idx_app_users_role | app_users | role | Role-based filtering in admin |
| idx_app_users_team | app_users | team_id | Team membership queries |
| idx_events_slug | events | slug | URL routing |
| idx_events_status | events | status | Status filtering (published events) |
| idx_events_start_date | events | start_date | Chronological ordering |
| idx_ticket_packs_event | ticket_packs | event_id | Packs by event |
| idx_ticket_packs_owner | ticket_packs | owner_id | Owner's pack list |
| idx_tickets_pack | tickets | pack_id | Tickets within a pack |
| idx_tickets_status | tickets | status | Status filtering (unassigned, checked_in) |
| idx_tickets_qr_code | tickets | qr_code | QR scan lookup (most performance-critical) |
| idx_tickets_email | tickets | recipient_email | Email-based check-in lookup |
| idx_audit_logs_actor | audit_logs | actor_id | Audit trail by user |
| idx_audit_logs_entity | audit_logs | entity_type, entity_id | Audit trail for a specific record |
| idx_audit_logs_action | audit_logs | action | Filter by action type |
| idx_audit_logs_created | audit_logs | created_at DESC | Chronological admin log view |
| idx_theme_settings_key | theme_settings | key | Key-based lookup |
| idx_theme_settings_category | theme_settings | category | Category-based grouping in admin UI |

---

## Helper Function: `current_user_role()`

```sql
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM app_users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

Used in all RLS policies. `STABLE` allows PostgreSQL to cache the result within a single query. `SECURITY DEFINER` ensures it runs with elevated privileges to read `app_users` even when RLS is active.

---

## Supabase Setup Instructions

### Applying the Migration

**Via Supabase CLI** (recommended for teams):
```bash
# Install CLI if not present
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref <your-project-ref>

# Push migrations
supabase db push
```

**Via Supabase Dashboard**:
1. Open your project at https://supabase.com/dashboard
2. Navigate to SQL Editor
3. Open `supabase/migrations/001_initial_schema.sql`
4. Copy the entire contents and paste into the editor
5. Click "Run"

### Verifying the Setup

Run these queries in the SQL editor to verify:

```sql
-- Check all tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check theme defaults were seeded
SELECT count(*) FROM theme_settings;
-- Expected: 36

-- Check triggers exist
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';
```

### Auth Configuration

In the Supabase Dashboard, go to Authentication > Settings:
1. Enable "Email" provider
2. Enable "Magic Link" (OTP via email)
3. Set Site URL to your app URL
4. Add your app's `/auth-callback` path to "Redirect URLs"
5. Optionally configure custom SMTP via Resend for production email delivery
