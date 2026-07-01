# FallCon Ticket Conductor — Connect Integration

## What is Connect?

Connect is the organization's existing ticketing and membership management platform. It is the system of record for attendee registrations, membership accounts, and ticket orders. FallCon Ticket Conductor is a focused luxury ticket management experience that sits alongside Connect, handling the assignment, QR issuance, and physical check-in workflow.

The long-term goal is for FallCon Ticket Conductor to pull order and attendee data from Connect automatically, eliminating manual CSV imports.

---

## Current State

A stub UI has been built at `/admin/connect`. It renders the Connect settings panel and allows admins to enter a Connect API URL and API key. The API key is stored as a bcrypt hash in `connect_config.api_key_hash`; only the last 4 characters (`api_key_hint`) are ever displayed in the UI.

**As of the initial release, no live integration exists.** The Connect panel:
- Allows saving API credentials (stored securely)
- Displays connection status (`idle`, `syncing`, `error`) from `connect_config.sync_status`
- Shows the last sync timestamp if one exists
- Does NOT make any outbound calls to Connect

The `connect_config` table has RLS restricted to admins only.

---

## Planned Integration Phases

### Phase 1 — Read Ticket Orders from Connect API

**Goal**: Automatically import ticket order data from Connect so admins do not need to upload CSVs manually.

**What changes**:
- A new API route `POST /api/admin/connect/sync` that calls the Connect REST API
- Fetches orders/registrations, creates or updates `ticket_packs` and `tickets` records
- Sets `connect_config.last_sync_at`, `sync_status`
- Errors stored in `connect_config.error_message`
- Admin can trigger a manual sync from the Connect panel

**Dependencies**:
- Connect must expose a paginated REST endpoint listing orders
- Authentication method agreed upon (API key in header is assumed)

**Estimated complexity**: Medium — data mapping work; no schema changes needed if Connect fields align cleanly

---

### Phase 2 — Sync Users from Connect Accounts

**Goal**: Automatically provision `app_users` records from Connect's attendee/member database.

**What changes**:
- Sync creates Supabase auth users (email_confirm: true) and `app_users` rows
- Assigns users to teams based on Connect group/organization data
- Handles deactivation: if a Connect account is cancelled, `is_active = false`
- Duplicate email detection: upsert on `email` field (same as current CSV import)

**Dependencies**:
- Connect must expose an attendees/members endpoint
- Agreed policy on what happens to tickets when an account is revoked

**Estimated complexity**: Medium — similar logic to existing CSV import route; sync scheduling needed

---

### Phase 3 — Real-Time Webhook Sync

**Goal**: Connect pushes changes to FallCon Ticket Conductor in real time rather than waiting for a manual sync.

**What changes**:
- New API route `POST /api/connect/webhook` (public, with HMAC signature verification)
- Handles event types: `order.created`, `order.cancelled`, `attendee.updated`
- Updates tickets/users immediately on webhook receipt
- Stores a webhook delivery log for debugging

**Dependencies**:
- Connect must support outbound webhooks
- Shared secret for HMAC-SHA256 signature verification

**Estimated complexity**: Medium-High — webhook infrastructure, replay protection (idempotency keys), error queuing

---

### Phase 4 — SSO with Connect

**Goal**: Users log in to FallCon Ticket Conductor using their Connect credentials, eliminating the separate magic link step.

**What changes**:
- Supabase configured with Connect as an OAuth 2.0 provider
- `auth-callback` extended to handle Connect-issued tokens
- User provisioning on first SSO login (no pre-provisioning required)
- Role mapping from Connect groups to `user_role` enum

**Dependencies**:
- Connect must implement OAuth 2.0 Authorization Code flow
- Connect must expose a `/userinfo` endpoint
- Supabase custom OAuth provider configuration

**Estimated complexity**: High — requires Connect-side OAuth implementation; significant Supabase Auth configuration

---

## API Contract (What Connect Would Need to Expose)

The following describes the endpoint interface FallCon Ticket Conductor will call. These are requirements for the Connect API, not endpoints in this application.

### Authentication

All requests will include:
```
Authorization: Bearer <api_key>
Content-Type: application/json
```

### Endpoint: List Orders

```
GET /api/v1/orders
```

Query parameters:
| Parameter | Type | Description |
|---|---|---|
| page | integer | Page number (1-indexed) |
| per_page | integer | Records per page (max 500) |
| updated_since | ISO8601 | Only return orders updated after this timestamp |
| event_id | string | Filter by Connect event ID |

Response:
```json
{
  "orders": [
    {
      "id": "ord_abc123",
      "event_id": "evt_xyz",
      "event_name": "FallCon 2026",
      "status": "confirmed",
      "quantity": 4,
      "attendee_email": "jane@example.com",
      "attendee_name": "Jane Smith",
      "group_name": "Acme Corp",
      "created_at": "2026-03-15T10:00:00Z",
      "updated_at": "2026-03-15T10:00:00Z"
    }
  ],
  "total": 142,
  "page": 1,
  "per_page": 100
}
```

### Endpoint: List Attendees/Members

```
GET /api/v1/members
```

Query parameters:
| Parameter | Type | Description |
|---|---|---|
| page | integer | Page number |
| per_page | integer | Records per page |
| updated_since | ISO8601 | Incremental sync filter |
| status | string | 'active', 'inactive', 'all' |

Response:
```json
{
  "members": [
    {
      "id": "mem_789",
      "email": "jane@example.com",
      "full_name": "Jane Smith",
      "status": "active",
      "organization": "Acme Corp",
      "membership_type": "standard",
      "updated_at": "2026-03-10T08:00:00Z"
    }
  ],
  "total": 89,
  "page": 1,
  "per_page": 100
}
```

### Webhook Events (Phase 3)

Connect would `POST` to `https://yourapp.vercel.app/api/connect/webhook` with:

```
X-Connect-Signature: sha256=<HMAC-SHA256 of request body with shared secret>
Content-Type: application/json
```

```json
{
  "event_type": "order.created",
  "timestamp": "2026-06-15T14:30:00Z",
  "data": {
    "order": { /* same shape as List Orders response item */ }
  }
}
```

Supported event types: `order.created`, `order.updated`, `order.cancelled`, `member.updated`, `member.deactivated`

---

## Data Mapping (Connect Fields to Our DB Fields)

| Connect Field | Our Table | Our Column | Notes |
|---|---|---|---|
| order.attendee_email | app_users | email | Create user if not exists |
| order.attendee_name | app_users | full_name | Update on sync |
| order.group_name | teams | name | Upsert team by name |
| order.event_name | events | name | Match existing event by name (case-insensitive) |
| order.id | ticket_packs | notes | Store Connect order ID for traceability |
| order.quantity | ticket_packs | total_tickets | Pack size |
| order.event_name + member name | ticket_packs | pack_name | Generated: "{event_name} — {attendee_name}" |
| member.status = 'active' | app_users | is_active | true |
| member.status = 'inactive' | app_users | is_active | false |
| member.email | app_users | email | Primary key for matching |

### Unresolved Mapping Questions

These must be settled with the Connect team before Phase 1 begins:

1. How does Connect identify which event an order belongs to? By name or by a stable ID?
2. Can one order contain tickets for multiple events?
3. What is the expected behavior when an order is cancelled after tickets have been assigned to recipients?
4. Does Connect have a concept of "ticket pack" (multiple tickets per order), or is it one ticket per order?
5. What timezone is used for timestamps in the Connect API?
