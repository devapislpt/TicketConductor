// ─── Roles ────────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'event_assistant' | 'ticket_owner'

// ─── Teams ────────────────────────────────────────────────────────────────────
export interface Team {
  id: string
  name: string
  created_at: string
}

// ─── Users ────────────────────────────────────────────────────────────────────
export interface AppUser {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  team_id: string | null
  team?: Team
  is_active: boolean
  last_sign_in_at: string | null
  created_at: string
  updated_at: string
}

// ─── Events ───────────────────────────────────────────────────────────────────
export type EventStatus = 'draft' | 'published' | 'archived'

export interface EventLink {
  id: string
  event_id: string
  type: 'zoom' | 'maps' | 'website' | 'other'
  label: string
  url: string
  sort_order: number
}

export interface AppEvent {
  id: string
  name: string
  slug: string
  description: string | null
  details: string | null
  location_name: string | null
  location_address: string | null
  google_maps_url: string | null
  start_date: string
  end_date: string | null
  cutoff_at: string | null          // deadline for ticket editing
  status: EventStatus
  banner_url: string | null
  links?: EventLink[]
  created_by: string
  created_at: string
  updated_at: string
}

// ─── Ticket Packs ─────────────────────────────────────────────────────────────
export interface TicketPack {
  id: string
  event_id: string
  event?: AppEvent
  owner_id: string
  owner?: AppUser
  pack_name: string
  total_tickets: number
  notes: string | null
  created_at: string
  updated_at: string
  tickets?: Ticket[]
}

// ─── Tickets ──────────────────────────────────────────────────────────────────
export type TicketStatus = 'unassigned' | 'assigned' | 'checked_in'

export interface Ticket {
  id: string
  pack_id: string
  pack?: TicketPack
  recipient_name: string | null
  recipient_email: string | null
  qr_code: string | null
  status: TicketStatus
  checked_in_at: string | null
  checked_in_by: string | null
  confirmation_sent_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export type AuditAction =
  | 'ticket.assign'
  | 'ticket.update'
  | 'ticket.unassign'
  | 'ticket.check_in'
  | 'pack.create'
  | 'pack.update'
  | 'pack.delete'
  | 'event.create'
  | 'event.update'
  | 'event.delete'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.impersonate'
  | 'user.password_reset'
  | 'user.magic_link_sent'
  | 'theme.update'
  | 'settings.update'

export interface AuditLog {
  id: string
  actor_id: string | null
  actor?: AppUser
  actor_email: string | null
  action: AuditAction
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ─── Theme Settings ───────────────────────────────────────────────────────────
export interface ThemeSetting {
  id: string
  key: string
  value: string
  category: 'color' | 'typography' | 'spacing' | 'animation' | 'sound' | 'media'
  label: string
  updated_by: string | null
  updated_at: string
}

export interface ThemeConfig {
  // Colors
  color_primary: string
  color_primary_foreground: string
  color_secondary: string
  color_secondary_foreground: string
  color_accent: string
  color_accent_foreground: string
  color_background: string
  color_foreground: string
  color_card: string
  color_card_foreground: string
  color_border: string
  color_muted: string
  color_muted_foreground: string
  color_destructive: string
  color_success: string

  // Typography
  font_heading: string
  font_body: string
  font_mono: string
  font_size_base: string
  font_weight_heading: string
  line_height_base: string
  letter_spacing_heading: string

  // Spacing
  border_radius: string
  spacing_unit: string

  // Animations
  animations_enabled: string          // 'true' | 'false'
  animation_duration: string          // ms
  animation_easing: string

  // Sounds
  sounds_enabled: string              // 'true' | 'false'
  sound_volume: string                // 0-1
  sound_click_url: string
  sound_success_url: string
  sound_error_url: string
  sound_checkin_url: string

  // Soundtrack
  soundtrack_enabled: string          // 'true' | 'false'
  soundtrack_url: string
  soundtrack_volume: string
  soundtrack_autoplay: string         // 'true' | 'false'
}

// ─── Connect Integration (Future) ─────────────────────────────────────────────
export interface ConnectConfig {
  id: string
  api_url: string | null
  api_key_hint: string | null       // last 4 chars only, never full key
  is_enabled: boolean
  last_sync_at: string | null
  sync_status: 'idle' | 'syncing' | 'error' | null
  error_message: string | null
  created_at: string
  updated_at: string
}

// ─── CSV Import ───────────────────────────────────────────────────────────────
export interface ImportRow {
  email: string
  full_name: string
  team_name?: string
  event_name?: string
  pack_name?: string
  ticket_count?: number
}

export interface ImportResult {
  success: number
  errors: Array<{ row: number; message: string }>
  created_users: number
  created_packs: number
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export interface AdminDashboardStats {
  total_events: number
  active_events: number
  total_ticket_packs: number
  total_tickets: number
  assigned_tickets: number
  unassigned_tickets: number
  checked_in_tickets: number
  total_users: number
}

export interface UserDashboardStats {
  total_orders: number
  total_tickets: number
  assigned_tickets: number
  unassigned_tickets: number
  upcoming_events: number
}
