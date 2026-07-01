# Ticket Management Use Cases

**Document:** UC-002
**Module:** Ticket Pack Management
**Last Updated:** 2026-06-21
**Status:** Approved

---

## UC-010: View My Ticket Packs

**Actor:** ticket_owner (primary); admin (secondary, via impersonation or direct access)

**Preconditions:**
- User is authenticated with role `ticket_owner`
- At least one ticket pack has been assigned to the user

**Main Flow:**
1. User navigates to `/dashboard`
2. System calls `GET /api/ticket-packs` with the authenticated user's ID
3. System returns all ticket packs owned by the user
4. UI renders a card for each pack showing:
   - Pack name / event name
   - Total tickets in pack
   - Number assigned vs. unassigned
   - Progress bar (assigned / total)
   - Cutoff date/time
5. Packs with active cutoff windows show an "Edit Open" badge
6. Packs past cutoff show a "Locked" badge
7. User can click a pack card to navigate to `/orders/[packId]`

**Alternate Flows:**

- **AF-010a: No Packs Assigned**
  - The API returns an empty array
  - UI renders an empty-state illustration with message: "No ticket packs have been assigned to you yet."

- **AF-010b: All Packs Locked**
  - All packs are past their edit cutoff
  - All cards show "Locked" badge
  - UI shows informational banner: "All your packs are past the edit deadline."

**Postconditions:**
- User has a summary view of all their ticket obligations
- Navigation to individual pack detail is available

**Test References:** `tests/e2e/ticket-management.spec.ts` — "Dashboard shows ticket packs with progress stats"

---

## UC-011: Assign Recipient to Ticket

**Actor:** ticket_owner

**Preconditions:**
- User is authenticated
- User owns the ticket pack containing this ticket
- The ticket's `recipient_name` is null (unassigned)
- Current time is before the pack's `edit_cutoff` timestamp

**Main Flow:**
1. User navigates to `/orders/[packId]`
2. System displays all tickets in the pack; unassigned tickets show an "Assign Ticket" button
3. User clicks "Assign Ticket" on an unassigned ticket
4. System opens an assignment form/modal with fields:
   - First Name (required)
   - Last Name (required)
   - Email (required, valid format)
   - Phone (optional)
   - Dietary / accessibility notes (optional)
5. User fills in the required fields and clicks "Save"
6. System calls `PUT /api/tickets/[id]` with the form data
7. System validates the payload server-side
8. System updates the ticket record and logs to the audit table
9. UI closes the modal and updates the ticket card to show the recipient's name
10. Progress stats on the pack update accordingly

**Alternate Flows:**

- **AF-011a: Validation Error**
  - Required field(s) missing or email invalid
  - Server returns 422 with field-level errors
  - UI displays inline errors; form stays open

- **AF-011b: Cutoff Passed During Session**
  - User had the form open when the cutoff time elapsed
  - Server returns 403 "Edit window has closed"
  - UI dismisses the form and displays: "The edit deadline has passed. No changes were saved."
  - Ticket card shows "Locked" state

**Postconditions:**
- Ticket `recipient_name`, `recipient_email` (and optional fields) are saved
- Audit log entry created with actor, ticket ID, and timestamp
- Pack assignment count increments

**Test References:** `tests/e2e/ticket-management.spec.ts` — "Assigning a ticket: fill form, save, see updated card"

---

## UC-012: Edit Existing Ticket Assignment

**Actor:** ticket_owner

**Preconditions:**
- User is authenticated and owns the pack
- The ticket already has a recipient assigned
- Current time is before the pack's `edit_cutoff`

**Main Flow:**
1. User navigates to `/orders/[packId]`
2. Assigned ticket cards show an "Edit" (pencil) icon button
3. User clicks "Edit"
4. System opens the assignment form pre-populated with current recipient data
5. User modifies one or more fields (e.g., changes `First Name`)
6. User clicks "Save"
7. System calls `PUT /api/tickets/[id]` with the updated payload
8. System stores the update and logs the change to the audit table (including previous values)
9. UI closes the modal and updates the ticket card with the new data

**Alternate Flows:**

- **AF-012a: No Changes Made**
  - User opens the form but clicks "Cancel" without editing
  - No API call is made; ticket is unchanged

- **AF-012b: Cutoff Passed During Edit Session**
  - Same as AF-011b

**Postconditions:**
- Ticket record updated with new recipient data
- Audit log includes both old and new values for changed fields

**Test References:** `tests/e2e/ticket-management.spec.ts` — "Editing assignment: change name, verify update"

---

## UC-013: Remove Recipient from Ticket

**Actor:** ticket_owner

**Preconditions:**
- User is authenticated and owns the pack
- The ticket has a recipient assigned
- Current time is before the pack's `edit_cutoff`

**Main Flow:**
1. User navigates to `/orders/[packId]`
2. User clicks the "Remove" (trash) icon on an assigned ticket card
3. System displays a confirmation dialog: "Remove [Name] from this ticket? This cannot be undone."
4. User clicks "Confirm"
5. System calls `DELETE /api/tickets/[id]/recipient` (or `PUT` with null recipient fields)
6. System clears the recipient fields on the ticket record
7. System logs the removal to the audit table
8. UI closes the dialog and resets the ticket card to the unassigned state
9. Pack progress stats update

**Alternate Flows:**

- **AF-013a: User Cancels Confirmation**
  - User clicks "Cancel" on the confirmation dialog
  - No API call is made; ticket remains assigned

- **AF-013b: Cutoff Passed**
  - Server returns 403; UI shows the cutoff-passed message
  - Ticket card transitions to locked state

**Postconditions:**
- Ticket recipient fields are null
- Audit log records the removal with the previous recipient's data

**Test References:** `tests/e2e/ticket-management.spec.ts` — "Removing assignment: confirm dialog, verify card resets to unassigned"

---

## UC-014: Cutoff Enforcement (Editing Blocked After Cutoff)

**Actor:** ticket_owner

**Preconditions:**
- User is authenticated and owns the pack
- The pack's `edit_cutoff` timestamp is in the past

**Main Flow:**
1. User navigates to `/orders/[packId]`
2. System detects that `edit_cutoff < now()`
3. UI renders a banner: "The edit window for this pack closed on [date/time]. No further changes can be made."
4. All "Assign", "Edit", and "Remove" buttons are hidden or disabled
5. Ticket data is displayed in read-only mode

**Alternate Flows:**

- **AF-014a: Direct API Attempt After Cutoff**
  - User (or an automated script) sends `PUT /api/tickets/[id]` after cutoff
  - Server middleware checks `edit_cutoff` against `now()`
  - Server returns `403 Forbidden` with body `{ error: "edit_window_closed" }`
  - No data is changed

- **AF-014b: Pack Has No Cutoff**
  - `edit_cutoff` is null for the pack
  - Pack is always editable; no banner or locking is applied

**Postconditions:**
- No ticket data can be modified after cutoff, neither via UI nor API
- Read-only view of assignments is always available

**Test References:** `tests/e2e/ticket-management.spec.ts` — "Cutoff passed: no edit buttons visible, banner displayed"  
`tests/unit/utils.test.ts` — "isCutoffPassed: past cutoff → true, future cutoff → false, null → false"

---

## UC-015: Bulk Import Recipients via CSV

**Actor:** ticket_owner (for their own pack); admin (for any pack)

**Preconditions:**
- User has access to the pack
- Current time is before the pack's `edit_cutoff`
- User has a CSV file with recipient data

**Main Flow:**
1. User navigates to `/orders/[packId]`
2. User clicks "Import CSV"
3. System displays a file picker and a CSV format guide (column headers: `first_name`, `last_name`, `email`, `phone`, `notes`)
4. User selects and uploads the CSV file
5. System calls `POST /api/ticket-packs/[packId]/import` with the file
6. Server parses the CSV, validates each row
7. Server returns a preview table showing parsed rows and any validation errors per row
8. User reviews the preview and clicks "Confirm Import"
9. Server writes valid rows to the tickets table, skipping rows with errors
10. UI shows a summary: "X tickets assigned, Y rows skipped (see details)"
11. Pack assignment count updates

**Alternate Flows:**

- **AF-015a: Invalid CSV Format**
  - File is not valid CSV or missing required columns
  - Server returns 400 with: "CSV must include columns: first_name, last_name, email"
  - No data is imported

- **AF-015b: Partial Errors**
  - Some rows have invalid email formats or missing required fields
  - Valid rows are imported; invalid rows are listed in an error report
  - User can download an "error report" CSV

- **AF-015c: More Rows Than Available Tickets**
  - CSV has more rows than unassigned tickets remain in the pack
  - Server imports up to the number of available tickets and reports the surplus

**Postconditions:**
- Valid recipient rows are saved to the database
- Audit log records the bulk import action with the actor and pack ID

**Test References:** Covered by admin E2E and integration tests

---

## UC-016: Export Pack to CSV

**Actor:** ticket_owner (their own pack); admin (any pack)

**Preconditions:**
- User has access to the pack
- Pack has at least some data (assigned or unassigned)

**Main Flow:**
1. User navigates to `/orders/[packId]` or the admin roster page
2. User clicks "Export CSV"
3. System calls `GET /api/ticket-packs/[packId]/export`
4. Server generates a CSV with columns: `ticket_id`, `first_name`, `last_name`, `email`, `phone`, `notes`, `assigned`, `checked_in`
5. Server returns the CSV as a download with `Content-Disposition: attachment; filename="pack-[packId].csv"`
6. Browser downloads the file
7. Unassigned tickets appear as rows with empty name/email columns

**Alternate Flows:**

- **AF-016a: Empty Pack**
  - All tickets are unassigned
  - CSV is still generated with header row and blank data rows (one per ticket slot)

**Postconditions:**
- User has a local CSV file with the current pack data
- No data is modified by this operation

**Test References:** `tests/e2e/admin.spec.ts` — "Reports page: select event, see roster"
