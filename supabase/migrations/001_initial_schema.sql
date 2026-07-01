-- ═══════════════════════════════════════════════════════════════════
-- FallCon Ticket Conductor — Initial Schema
-- ═══════════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── ENUMS ──────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'event_assistant', 'ticket_owner');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE ticket_status AS ENUM ('unassigned', 'assigned', 'checked_in');
CREATE TYPE event_link_type AS ENUM ('zoom', 'maps', 'website', 'other');
CREATE TYPE theme_category AS ENUM ('color', 'typography', 'spacing', 'animation', 'sound', 'media');
CREATE TYPE sync_status AS ENUM ('idle', 'syncing', 'error');

-- ─── TEAMS ──────────────────────────────────────────────────────────
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── APP USERS ──────────────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific data
CREATE TABLE app_users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  role            user_role NOT NULL DEFAULT 'ticket_owner',
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_sign_in_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EVENTS ─────────────────────────────────────────────────────────
CREATE TABLE events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT,
  details          TEXT,
  location_name    TEXT,
  location_address TEXT,
  google_maps_url  TEXT,
  start_date       TIMESTAMPTZ NOT NULL,
  end_date         TIMESTAMPTZ,
  cutoff_at        TIMESTAMPTZ,
  status           event_status NOT NULL DEFAULT 'draft',
  banner_url       TEXT,
  created_by       UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EVENT LINKS ────────────────────────────────────────────────────
CREATE TABLE event_links (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type       event_link_type NOT NULL DEFAULT 'other',
  label      TEXT NOT NULL,
  url        TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- ─── TICKET PACKS ───────────────────────────────────────────────────
CREATE TABLE ticket_packs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  pack_name       TEXT NOT NULL,
  total_tickets   INT NOT NULL CHECK (total_tickets > 0 AND total_tickets <= 500),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TICKETS ────────────────────────────────────────────────────────
CREATE TABLE tickets (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pack_id               UUID NOT NULL REFERENCES ticket_packs(id) ON DELETE CASCADE,
  recipient_name        TEXT,
  recipient_email       TEXT,
  qr_code               TEXT UNIQUE,
  status                ticket_status NOT NULL DEFAULT 'unassigned',
  checked_in_at         TIMESTAMPTZ,
  checked_in_by         UUID REFERENCES app_users(id) ON DELETE SET NULL,
  confirmation_sent_at  TIMESTAMPTZ,
  sort_order            INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AUDIT LOGS ─────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES app_users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── THEME SETTINGS ─────────────────────────────────────────────────
CREATE TABLE theme_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  category    theme_category NOT NULL DEFAULT 'color',
  label       TEXT NOT NULL,
  updated_by  UUID REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CONNECT INTEGRATION CONFIG ─────────────────────────────────────
-- Placeholder for future Connect system integration
CREATE TABLE connect_config (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_url       TEXT,
  api_key_hash  TEXT,             -- bcrypt hash, never plaintext
  api_key_hint  TEXT,             -- last 4 chars shown in UI
  is_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at  TIMESTAMPTZ,
  sync_status   sync_status DEFAULT 'idle',
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MEDIA ASSETS ───────────────────────────────────────────────────
CREATE TABLE media_assets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,      -- 'sound_effect' | 'soundtrack' | 'image'
  url         TEXT NOT NULL,
  mime_type   TEXT,
  size_bytes  BIGINT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX idx_app_users_email ON app_users(email);
CREATE INDEX idx_app_users_role ON app_users(role);
CREATE INDEX idx_app_users_team ON app_users(team_id);
CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_ticket_packs_event ON ticket_packs(event_id);
CREATE INDEX idx_ticket_packs_owner ON ticket_packs(owner_id);
CREATE INDEX idx_tickets_pack ON tickets(pack_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_qr_code ON tickets(qr_code);
CREATE INDEX idx_tickets_email ON tickets(recipient_email);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_theme_settings_key ON theme_settings(key);
CREATE INDEX idx_theme_settings_category ON theme_settings(category);

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGERS — updated_at
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ticket_packs_updated_at
  BEFORE UPDATE ON ticket_packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER — auto-create app_user on auth.users insert
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO app_users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'ticket_owner')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER — auto-generate tickets when pack is created
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION generate_tickets_for_pack()
RETURNS TRIGGER AS $$
DECLARE
  i INT;
  qr_val TEXT;
BEGIN
  FOR i IN 1..NEW.total_tickets LOOP
    qr_val := 'TKT-' || UPPER(REPLACE(uuid_generate_v4()::TEXT, '-', ''));
    INSERT INTO tickets (pack_id, qr_code, sort_order)
    VALUES (NEW.id, qr_val, i);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_tickets
  AFTER INSERT ON ticket_packs
  FOR EACH ROW EXECUTE FUNCTION generate_tickets_for_pack();

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE connect_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM app_users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- app_users: users see their own row; admins see all
CREATE POLICY "users_select_own" ON app_users
  FOR SELECT USING (id = auth.uid() OR current_user_role() = 'admin');

CREATE POLICY "admin_all_users" ON app_users
  FOR ALL USING (current_user_role() = 'admin');

-- events: published events visible to all authenticated users
CREATE POLICY "events_select_published" ON events
  FOR SELECT USING (
    status = 'published' OR current_user_role() IN ('admin', 'event_assistant')
  );

CREATE POLICY "admin_all_events" ON events
  FOR ALL USING (current_user_role() = 'admin');

-- event_links: same as events
CREATE POLICY "event_links_select" ON event_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
        AND (e.status = 'published' OR current_user_role() IN ('admin', 'event_assistant'))
    )
  );

CREATE POLICY "admin_all_event_links" ON event_links
  FOR ALL USING (current_user_role() = 'admin');

-- ticket_packs: owners see their own; admins/assistants see all
CREATE POLICY "packs_select_own" ON ticket_packs
  FOR SELECT USING (
    owner_id = auth.uid() OR current_user_role() IN ('admin', 'event_assistant')
  );

CREATE POLICY "packs_update_own" ON ticket_packs
  FOR UPDATE USING (owner_id = auth.uid() OR current_user_role() = 'admin');

CREATE POLICY "admin_all_packs" ON ticket_packs
  FOR ALL USING (current_user_role() = 'admin');

-- tickets: owners see tickets in their packs; assistants/admins see all
CREATE POLICY "tickets_select_own_pack" ON tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ticket_packs tp
      WHERE tp.id = pack_id
        AND (tp.owner_id = auth.uid() OR current_user_role() IN ('admin', 'event_assistant'))
    )
  );

CREATE POLICY "tickets_update_own_pack" ON tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ticket_packs tp
      JOIN events e ON e.id = tp.event_id
      WHERE tp.id = pack_id
        AND tp.owner_id = auth.uid()
        AND (e.cutoff_at IS NULL OR e.cutoff_at > NOW())
    )
    OR current_user_role() IN ('admin', 'event_assistant')
  );

CREATE POLICY "admin_all_tickets" ON tickets
  FOR ALL USING (current_user_role() = 'admin');

-- audit_logs: admins only
CREATE POLICY "admin_all_audit_logs" ON audit_logs
  FOR ALL USING (current_user_role() = 'admin');

-- theme_settings: all authenticated users can read; admins can write
CREATE POLICY "theme_select_all" ON theme_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_all_theme" ON theme_settings
  FOR ALL USING (current_user_role() = 'admin');

-- teams: all authenticated users can read
CREATE POLICY "teams_select_all" ON teams
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_all_teams" ON teams
  FOR ALL USING (current_user_role() = 'admin');

-- connect_config: admins only
CREATE POLICY "admin_all_connect" ON connect_config
  FOR ALL USING (current_user_role() = 'admin');

-- media_assets: authenticated read; admin write
CREATE POLICY "media_select_all" ON media_assets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_all_media" ON media_assets
  FOR ALL USING (current_user_role() = 'admin');

-- ═══════════════════════════════════════════════════════════════════
-- DEFAULT THEME SEED DATA
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO theme_settings (key, value, category, label) VALUES
  -- Colors
  ('color_primary',              '#C9A84C', 'color', 'Primary'),
  ('color_primary_foreground',   '#0A0A0A', 'color', 'Primary Foreground'),
  ('color_secondary',            '#1A1A2E', 'color', 'Secondary'),
  ('color_secondary_foreground', '#E8E8E8', 'color', 'Secondary Foreground'),
  ('color_accent',               '#C9A84C', 'color', 'Accent'),
  ('color_accent_foreground',    '#0A0A0A', 'color', 'Accent Foreground'),
  ('color_background',           '#0A0A0A', 'color', 'Background'),
  ('color_foreground',           '#F0EDE6', 'color', 'Foreground'),
  ('color_card',                 '#141414', 'color', 'Card'),
  ('color_card_foreground',      '#F0EDE6', 'color', 'Card Foreground'),
  ('color_border',               '#2A2A2A', 'color', 'Border'),
  ('color_muted',                '#1C1C1C', 'color', 'Muted'),
  ('color_muted_foreground',     '#8A8A8A', 'color', 'Muted Foreground'),
  ('color_destructive',          '#E53E3E', 'color', 'Destructive'),
  ('color_success',              '#38A169', 'color', 'Success'),
  -- Typography
  ('font_heading',               'Cormorant Garamond, Georgia, serif', 'typography', 'Heading Font'),
  ('font_body',                  'Inter, system-ui, sans-serif',       'typography', 'Body Font'),
  ('font_mono',                  'JetBrains Mono, monospace',          'typography', 'Mono Font'),
  ('font_size_base',             '16px',     'typography', 'Base Font Size'),
  ('font_weight_heading',        '600',      'typography', 'Heading Weight'),
  ('line_height_base',           '1.6',      'typography', 'Line Height'),
  ('letter_spacing_heading',     '0.02em',   'typography', 'Heading Letter Spacing'),
  -- Spacing
  ('border_radius',              '0.5rem',   'spacing', 'Border Radius'),
  ('spacing_unit',               '4px',      'spacing', 'Spacing Unit'),
  -- Animations
  ('animations_enabled',         'true',     'animation', 'Enable Animations'),
  ('animation_duration',         '300',      'animation', 'Duration (ms)'),
  ('animation_easing',           'easeOut',  'animation', 'Easing'),
  -- Sounds
  ('sounds_enabled',             'true',     'sound', 'Enable Sound Effects'),
  ('sound_volume',               '0.4',      'sound', 'SFX Volume'),
  ('sound_click_url',            '/sounds/click.mp3',    'sound', 'Click Sound'),
  ('sound_success_url',          '/sounds/success.mp3',  'sound', 'Success Sound'),
  ('sound_error_url',            '/sounds/error.mp3',    'sound', 'Error Sound'),
  ('sound_checkin_url',          '/sounds/checkin.mp3',  'sound', 'Check-in Sound'),
  -- Soundtrack
  ('soundtrack_enabled',         'false',    'sound', 'Enable Soundtrack'),
  ('soundtrack_url',             '',         'sound', 'Soundtrack URL'),
  ('soundtrack_volume',          '0.2',      'sound', 'Soundtrack Volume'),
  ('soundtrack_autoplay',        'false',    'sound', 'Autoplay Soundtrack');

-- ═══════════════════════════════════════════════════════════════════
-- SYSTEM CONFIG — runtime credentials stored in DB
-- Values are AES-256 encrypted at the application layer before insert.
-- The encryption key itself lives only in SYSTEM_SECRET env var.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE system_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT,             -- encrypted ciphertext (or plaintext for non-sensitive)
  is_secret   BOOLEAN NOT NULL DEFAULT FALSE,
  label       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  updated_by  UUID REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write system_config
CREATE POLICY "admin_all_system_config" ON system_config
  FOR ALL USING (current_user_role() = 'admin');

CREATE TRIGGER trg_system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed with empty config keys (values filled in via admin UI)
INSERT INTO system_config (key, is_secret, label, description, category) VALUES
  ('resend_api_key',      TRUE,  'Resend API Key',        'Your Resend.com API key for sending emails', 'email'),
  ('resend_from_email',   FALSE, 'From Email Address',    'The email address tickets are sent from', 'email'),
  ('resend_from_name',    FALSE, 'From Display Name',     'Display name shown on outgoing emails', 'email'),
  ('app_name',            FALSE, 'Application Name',      'Displayed in emails and browser title', 'general'),
  ('app_url',             FALSE, 'Application URL',       'Full public URL (e.g. https://tickets.yourorg.com)', 'general'),
  ('support_email',       FALSE, 'Support Email',         'Shown in ticket emails for attendee help', 'general'),
  ('connect_api_url',     FALSE, 'Connect API URL',       'Base URL of your Connect system API', 'connect'),
  ('connect_api_key',     TRUE,  'Connect API Key',       'Authentication key for Connect API calls', 'connect');
