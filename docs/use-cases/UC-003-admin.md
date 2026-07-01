# Admin Use Cases

**Document:** UC-003
**Module:** Administration
**Last Updated:** 2026-06-21
**Status:** Approved

---

## UC-020: Create Event

**Actor:** admin

**Preconditions:**
- User is authenticated with role `admin`
- User is on the Events management page (`/admin/events`)

**Main Flow:**
1. Admin clicks "New Event"
2. System displays a Create Event form with fields:
   - Event Name (required)
   - Description (optional, rich text)
   - Start Date / Time (required)
   - End Date / Time (required)
   - Venue / Location (optional)
   - Edit Cutoff Date / Time (optional)
   - Status: `draft` | `published` | `archived` (default: `draft`)
   - Max Capacity (optional integer)
3. Admin fills in required fields and clicks "Create Event"
4. System calls `POST /api/events` with the payload
5. Server validates the payload and inserts a new record in the `events` table
6. Server logs the creation to the audit table
7. UI redirects to the new event's detail page
8. Success toast: "Event created successfully"

**Alternate Flows:**

- **AF-020a: Validation Error**
  - Required fields missing or end date before start date
  - Server returns 422 with field errors
  - Form shows inline errors; no record is created

- **AF-020b: Duplicate Name**
  - An event with the same name already exists for the same date
  - Server returns a warning (not a hard block)
  - Admin can proceed or rename

**Postconditions:**
- New event record exists in the database with `status = draft`
- Audit log records the creation with admin's user ID and timestamp

**Test References:** `tests/e2e/admin.spec.ts` — "Create event: fill form, save, verify in list"

---

## UC-021: Edit Event

**Actor:** admin

**Preconditions:**
- User is authenticated as admin
- The event exists and is not archived

**Main Flow:**
1. Admin navigates to `/admin/events/[eventId]`
2. System displays the event detail/edit form pre-populated with current values
3. Admin modifies fields (e.g., updates venue or changes edit cutoff)
4. Admin clicks "Save Changes"
5. System calls `PUT /api/events/[eventId]` with the payload
6. Server validates and updates the `events` record
7. Server logs the change to the audit table (storing old and new values)
8. UI shows success toast: "Event updated"

**Alternate Flows:**

- **AF-021a: Changing Cutoff That Has Already Passed**
  - Admin extends the edit cutoff to a future time
  - System re-opens the edit window for all packs under this event
  - Notification is surfaced in the audit log

- **AF-021b: Publishing a Draft Event**
  - Admin changes `status` from `draft` to `published`
  - Event becomes visible to check-in staff and ticket owners on the dashboard

**Postconditions:**
- Event record updated with new values
- Audit log entry created

**Test References:** `tests/e2e/admin.spec.ts` — Events page

---

## UC-022: Archive/Delete Event

**Actor:** admin

**Preconditions:**
- User is authenticated as admin
- The event exists

**Main Flow (Archive):**
1. Admin clicks "Archive" on the event
2. System displays confirmation: "Archive this event? It will be hidden from active views."
3. Admin confirms
4. System calls `PATCH /api/events/[eventId]` with `{ status: "archived" }`
5. Event is hidden from all non-admin views
6. Audit log records the action

**Main Flow (Delete):**
1. Admin clicks "Delete" — only available if the event has zero ticket packs
2. System displays a destructive confirmation dialog
3. Admin confirms by typing the event name
4. System calls `DELETE /api/events/[eventId]`
5. Event record and all related records are deleted (cascade)
6. Audit log records the deletion

**Alternate Flows:**

- **AF-022a: Delete Blocked by Existing Packs**
  - Event has one or more ticket packs
  - "Delete" button is disabled; tooltip explains: "Archive or reassign ticket packs before deleting"

**Postconditions:**
- Archived event: hidden from public/user views; accessible to admin with filter
- Deleted event: permanently removed from database

**Test References:** `tests/e2e/admin.spec.ts`

---

## UC-023: Create Ticket Pack (Assign to User)

**Actor:** admin

**Preconditions:**
- User is authenticated as admin
- Target event exists and is not archived
- Target user exists and has role `ticket_owner`

**Main Flow:**
1. Admin navigates to `/admin/events/[eventId]/packs`
2. Admin clicks "New Pack"
3. System displays a form:
   - Pack Name / Label (required)
   - Assigned User (searchable dropdown of ticket_owner users)
   - Number of Tickets (required integer ≥ 1)
   - Edit Cutoff (optional, defaults to event cutoff)
4. Admin fills the form and clicks "Create Pack"
5. System calls `POST /api/ticket-packs` with the payload
6. Server creates the pack record and generates N blank ticket records
7. Server logs the action
8. UI shows the new pack in the list with 0/N assigned

**Alternate Flows:**

- **AF-023a: Assigning to a User with No Account**
  - Admin can enter an email that has no account yet
  - System creates a placeholder user record and sends an invite magic link

**Postconditions:**
- Ticket pack created and linked to the user
- N blank ticket records created under the pack
- User's dashboard will show the pack

**Test References:** `tests/e2e/admin.spec.ts`

---

## UC-024: Import Users from CSV

**Actor:** admin

**Preconditions:**
- User is authenticated as admin
- Admin has a CSV file with user data

**Main Flow:**
1. Admin navigates to `/admin/users`
2. Admin clicks "Import Users (CSV)"
3. System displays a file picker and format guide:
   - Columns: `email` (required), `first_name`, `last_name`, `role` (default: `ticket_owner`)
4. Admin uploads the CSV
5. System calls `POST /api/admin/users/import` with the file
6. Server parses and validates each row
7. Server returns a preview with validation results
8. Admin confirms the import
9. Server creates user records (or updates existing ones if email matches)
10. Server optionally sends magic link invites to all new accounts
11. UI shows: "X users created, Y updated, Z skipped"

**Alternate Flows:**

- **AF-024a: Duplicate Email**
  - A row's email already exists in the database
  - Server updates the existing user's name/role fields (upsert)

- **AF-024b: Invalid Role Value**
  - Row contains an unrecognized role
  - Row is skipped with an error message; other rows proceed

**Postconditions:**
- New users created in the `profiles` table
- Audit log records the bulk import

**Test References:** `tests/e2e/admin.spec.ts` — Users page

---

## UC-025: Send Magic Link to User

**Actor:** admin

**Preconditions:**
- User is authenticated as admin
- Target user exists and has `status = active`

**Main Flow:**
1. Admin navigates to `/admin/users`
2. Admin finds the target user in the list
3. Admin clicks the "Send Magic Link" action (kebab menu or button)
4. System calls `POST /api/admin/users/[userId]/magic-link`
5. Server triggers Supabase to generate and send a magic link to the user's email
6. UI shows toast: "Magic link sent to [email]"

**Alternate Flows:**

- **AF-025a: User Email Undeliverable**
  - Supabase returns a delivery error
  - UI shows: "Failed to send magic link. Check the user's email address."

- **AF-025b: Inactive User**
  - System blocks the action; toast: "Cannot send link to an inactive account."

**Postconditions:**
- User receives an email with a login link (valid for 1 hour)
- Admin-initiated magic link is logged in the audit table

**Test References:** `tests/e2e/admin.spec.ts`

---

## UC-026: Reset User Password

**Actor:** admin

**Preconditions:**
- User is authenticated as admin
- Target user exists

**Main Flow:**
1. Admin navigates to `/admin/users/[userId]`
2. Admin clicks "Reset Password"
3. System displays confirmation: "Send a password reset email to [email]?"
4. Admin confirms
5. System calls `POST /api/admin/users/[userId]/reset-password`
6. Server calls Supabase Admin API to trigger a password reset email
7. UI shows toast: "Password reset email sent"

**Alternate Flows:**

- **AF-026a: Set Temporary Password Inline**
  - Admin can alternatively set a specific temporary password
  - Server uses Supabase Admin API `updateUserById` to set the password
  - User is required to change it on next login (if enforced)

**Postconditions:**
- Password reset email sent to the user's address
- Audit log records the action (admin, target user, timestamp)

**Test References:** `tests/e2e/admin.spec.ts`

---

## UC-027: Impersonate User

**Actor:** admin

**Preconditions:**
- User is authenticated as admin
- Target user exists and is active

**Main Flow:**
1. Admin navigates to `/admin/users/[userId]`
2. Admin clicks "Impersonate"
3. System displays warning: "You are about to view the app as [user]. An audit log entry will be created."
4. Admin confirms
5. System calls `POST /api/admin/users/[userId]/impersonate`
6. Server generates a short-lived impersonation token and stores the admin's original session reference
7. System sets a flag/cookie: `impersonating = true`, `impersonating_as = [userId]`, `admin_session = [adminSessionId]`
8. UI navigates to the impersonated user's dashboard
9. A persistent banner displays: "Viewing as [User Name] — [Exit Impersonation]"
10. Admin clicks "Exit Impersonation"
11. System calls `POST /api/admin/impersonate/exit`
12. Original admin session is restored; admin is returned to the Users page

**Alternate Flows:**

- **AF-027a: Impersonation Timeout**
  - The impersonation token expires after 30 minutes of inactivity
  - System automatically reverts to the admin session
  - Admin is shown a notice on return

**Postconditions:**
- Admin can view the exact UI the user would see
- All actions during impersonation are logged with both admin and target user IDs
- No actual data changes are permitted during impersonation (read-only enforcement)

**Test References:** `tests/e2e/admin.spec.ts`

---

## UC-028: Export Full Event Roster CSV

**Actor:** admin

**Preconditions:**
- User is authenticated as admin
- The event exists and has at least one ticket pack

**Main Flow:**
1. Admin navigates to `/admin/reports` or `/admin/events/[eventId]`
2. Admin selects an event from the dropdown
3. Admin clicks "Export Full Roster (CSV)"
4. System calls `GET /api/admin/events/[eventId]/roster`
5. Server queries all ticket packs and their tickets for the event
6. Server generates a CSV with columns:
   `pack_id`, `pack_name`, `owner_name`, `owner_email`, `ticket_id`,
   `recipient_first`, `recipient_last`, `recipient_email`, `recipient_phone`,
   `notes`, `assigned`, `checked_in`, `checked_in_at`
7. Server returns the file as a download
8. Browser downloads: `roster-[event-slug]-[date].csv`

**Alternate Flows:**

- **AF-028a: No Packs / No Assignments**
  - Event exists but has no packs or all tickets are unassigned
  - CSV is generated with header row only (or with blank data rows)

**Postconditions:**
- Admin has a complete offline record of all attendees for the event
- No data is modified

**Test References:** `tests/e2e/admin.spec.ts` — "Reports page: select event, see roster"

---

## UC-029: View Audit Log

**Actor:** admin

**Preconditions:**
- User is authenticated as admin

**Main Flow:**
1. Admin navigates to `/admin/audit-log`
2. System calls `GET /api/admin/audit-log` with optional query params:
   - `userId` — filter by actor
   - `eventId` — filter by event
   - `action` — filter by action type
   - `from` / `to` — date range
   - `page` / `limit` — pagination
3. Server returns a paginated list of audit entries
4. UI renders a table with columns:
   - Timestamp
   - Actor (user name + email)
   - Action (e.g., `ticket.update`, `user.impersonate`)
   - Target (entity type + ID)
   - Details (diff of old/new values where applicable)
5. Admin can click any row to expand the full detail JSON

**Alternate Flows:**

- **AF-029a: Export Audit Log**
  - Admin clicks "Export to CSV"
  - Server generates a CSV of the current filtered result set

**Postconditions:**
- Admin has a full, searchable record of all system actions
- Audit log itself is append-only and cannot be edited or deleted via the UI

**Test References:** `tests/e2e/admin.spec.ts` — "Audit log page shows entries"

---

## UC-030: Change Theme Colors

**Actor:** admin

**Preconditions:**
- User is authenticated as admin

**Main Flow:**
1. Admin navigates to `/admin/settings/theme`
2. System displays current theme settings:
   - Primary Color (hex color picker)
   - Secondary Color
   - Accent Color
   - Logo Upload (image file)
   - Event Banner Image (image file)
3. Admin adjusts a color using the color picker
4. UI shows a live preview of the changes
5. Admin clicks "Save Theme"
6. System calls `PUT /api/admin/settings/theme` with the color values and image URLs
7. Server saves the settings to the `app_settings` table
8. CSS custom properties are updated globally (SSR or client-side injection)
9. All pages reflect the new theme on next load

**Alternate Flows:**

- **AF-030a: Reset to Defaults**
  - Admin clicks "Reset to Defaults"
  - System restores the default color palette
  - Confirmation dialog is shown before reset

- **AF-030b: Invalid Hex Value**
  - Admin manually types an invalid hex string
  - Client-side validation prevents saving; error shown inline

**Postconditions:**
- Theme settings stored in the database
- New theme applied site-wide

**Test References:** `tests/e2e/admin.spec.ts` — Admin dashboard
