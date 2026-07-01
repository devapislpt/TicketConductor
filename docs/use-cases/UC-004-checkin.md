# Check-In Use Cases

**Document:** UC-004
**Module:** Check-In
**Last Updated:** 2026-06-21
**Status:** Approved

---

## UC-040: View Check-In Hub (List of Events)

**Actor:** admin, event_assistant

**Preconditions:**
- User is authenticated with role `admin` or `event_assistant`
- At least one event with `status = published` exists

**Main Flow:**
1. User navigates to `/checkin`
2. System calls `GET /api/check-in/events` to retrieve published events
3. UI renders a list/grid of event cards, each showing:
   - Event Name
   - Event Date & Time
   - Venue
   - Total checked-in / total tickets (aggregate progress bar)
4. User clicks an event card to navigate to the check-in interface for that event

**Alternate Flows:**

- **AF-040a: No Published Events**
  - API returns an empty list
  - UI shows empty state: "No events are currently available for check-in."

- **AF-040b: Multiple Simultaneous Events**
  - Multiple events are published on the same day
  - All are shown; user selects the intended one
  - Events are sorted by start time ascending

**Postconditions:**
- User is on the event-specific check-in page
- Event selection is logged (optional, for analytics)

**Test References:** `tests/e2e/checkin.spec.ts` — "Check-in hub shows published events"

---

## UC-041: Scan QR Code to Check In

**Actor:** admin, event_assistant

**Preconditions:**
- User is on the check-in page for a specific event (`/checkin/[eventId]`)
- "QR Scan" mode is selected
- The attendee has a valid QR code (printed ticket or digital)
- The ticket belongs to this event and has a recipient assigned
- The ticket has not already been checked in

**Main Flow:**
1. User selects "QR Scan" mode (default on capable devices)
2. System activates the device camera via the browser's MediaDevices API
3. System continuously scans the video feed for a QR code
4. Attendee presents their QR code to the camera
5. QR code is decoded to a `ticketId` (UUID)
6. System calls `POST /api/check-in/scan` with `{ ticketId, eventId }`
7. Server looks up the ticket, verifies it belongs to `eventId`
8. Server marks the ticket as `checked_in = true` and records `checked_in_at = now()`
9. Server logs the check-in to the audit table with the operator's user ID
10. UI displays a success overlay:
    - Large green checkmark
    - Attendee name
    - Ticket number
    - "Check In Another" button
11. Overlay auto-dismisses after 3 seconds; scanner re-activates

**Alternate Flows:**

- **AF-041a: Already Checked In**
  - Server detects `checked_in = true`
  - Server returns 409 with `{ error: "already_checked_in", checkedInAt: "..." }`
  - UI displays an orange warning overlay: "Already Checked In — [Name] was checked in at [time]"

- **AF-041b: Ticket Belongs to Different Event**
  - Server detects `ticket.event_id !== params.eventId`
  - Server returns 422 with `{ error: "wrong_event" }`
  - UI displays a red error overlay: "Wrong Event — This ticket is for [Other Event Name]"

- **AF-041c: Invalid QR Code**
  - Decoded value is not a valid UUID or does not match any ticket
  - Server returns 404
  - UI displays: "Ticket not found"

- **AF-041d: Camera Not Available**
  - Browser cannot access camera (permission denied or no camera)
  - UI shows a message: "Camera not available. Please use Email Lookup mode."
  - Automatically switches to Email Lookup mode

**Postconditions:**
- On success: Ticket marked checked in with timestamp
- Stats panel increments checked-in count
- On failure: Ticket unchanged; error displayed

**Test References:** `tests/e2e/checkin.spec.ts` — QR Scan mode tests

---

## UC-042: Check In by Email Lookup

**Actor:** admin, event_assistant

**Preconditions:**
- User is on `/checkin/[eventId]`
- "Email Lookup" mode is selected or camera is unavailable
- Attendee can provide their email address

**Main Flow:**
1. User clicks "Email Lookup" mode button
2. UI shows a search input: "Enter attendee email"
3. User types the attendee's email (full or partial)
4. System calls `GET /api/check-in/lookup?email=[query]&eventId=[eventId]` on each keystroke (debounced 300ms)
5. Server returns matching tickets for the event filtered by recipient email
6. UI shows a results list with each match showing:
   - Attendee name
   - Email
   - Pack name / ticket number
   - Check-in status badge
7. User clicks "Check In" on the target result
8. System calls `POST /api/check-in/scan` with `{ ticketId, eventId }`
9. Server marks ticket as checked in
10. UI shows the success overlay (same as UC-041 step 10)

**Alternate Flows:**

- **AF-042a: No Matches Found**
  - Search returns zero results for the entered email
  - UI shows: "No tickets found for this email in this event."

- **AF-042b: Multiple Tickets for Same Email**
  - Attendee has more than one ticket (e.g., reassigned pack)
  - All tickets appear in results
  - User selects the correct one

- **AF-042c: Already Checked In**
  - The result card already shows a "Checked In" badge
  - "Check In" button is replaced with "Already Checked In" (disabled)
  - If user still sends the request, same 409 handling as AF-041a

**Postconditions:**
- Ticket checked in (or error handled gracefully)
- Operator's action is logged

**Test References:** `tests/e2e/checkin.spec.ts` — "Email lookup: type email, see matching result, click check in, see success overlay"

---

## UC-043: Already-Checked-In Ticket Handling

**Actor:** admin, event_assistant

**Preconditions:**
- A ticket has already been checked in (`checked_in = true`)

**Main Flow (QR Scan):**
1. Operator scans the QR code of an already-checked-in ticket
2. Server returns 409
3. UI displays orange warning overlay:
   - "ALREADY CHECKED IN"
   - Attendee name
   - Originally checked in at: [timestamp]
   - Checked in by: [operator name] (if available)
4. Overlay shows "Dismiss" and "Override (Re-check-in)" buttons (admin only)

**Main Flow (Email Lookup):**
1. Email lookup results show the ticket with a "Checked In ✓" badge
2. Check-In button is disabled
3. Hovering the badge shows: "Checked in at [time]"

**Alternate Flows:**

- **AF-043a: Admin Override Re-check-in**
  - Admin clicks "Override (Re-check-in)" from the warning overlay
  - System calls `POST /api/check-in/scan` with `{ ticketId, eventId, force: true }`
  - Server updates `checked_in_at` to current time
  - Audit log records the override with admin's ID and reason field

**Postconditions:**
- Duplicate check-ins are surfaced clearly to the operator
- No silent double-check-ins occur
- Override path is available to admins with full audit trail

**Test References:** `tests/e2e/checkin.spec.ts` — "Already checked-in ticket shows different state"

---

## UC-044: Ticket Belongs to Different Event (Reject)

**Actor:** admin, event_assistant

**Preconditions:**
- Operator is on the check-in page for Event A
- Scanned or looked-up ticket belongs to Event B

**Main Flow:**
1. Operator scans a QR code
2. System calls `POST /api/check-in/scan` with `{ ticketId, eventId: EventA_id }`
3. Server finds the ticket and checks `ticket.event_id`
4. `ticket.event_id !== EventA_id` — mismatch detected
5. Server returns 422 `{ error: "wrong_event", correctEvent: "Event B Name" }`
6. UI displays a red error overlay:
   - "WRONG EVENT"
   - "This ticket is for: [Event B Name]"
   - "Please go to the correct check-in station."
7. Overlay dismisses after 5 seconds or on button click; scanner re-activates

**Alternate Flows:**

- **AF-044a: Admin Redirected**
  - Admin sees an additional button: "Go to Event B check-in"
  - Clicking navigates to `/checkin/[EventB_id]`

**Postconditions:**
- Ticket is NOT checked in
- Clear, non-dismissible error is shown for 5 seconds
- No audit log entry (no action was taken)

**Test References:** `tests/e2e/checkin.spec.ts` — wrong event rejection

---

## UC-045: Event Assistant Access Restrictions

**Actor:** event_assistant

**Preconditions:**
- User is authenticated with role `event_assistant`

**Main Flow:**
1. Event assistant logs in and is redirected to `/checkin` (the check-in hub)
2. Event assistant can:
   - View the check-in hub
   - Access any published event's check-in page
   - Perform QR scan check-ins
   - Perform email lookup check-ins
   - View the stats panel (total / checked-in counts)
3. Event assistant attempts to access `/admin/*`
4. System middleware detects role mismatch
5. User is redirected to `/checkin` with a 403 error banner

**Explicit Restrictions for event_assistant:**
- Cannot view `/dashboard` (ticket owner area)
- Cannot view `/admin/*` (admin area)
- Cannot override already-checked-in tickets (Override button not rendered)
- Cannot view attendee email addresses in the stats panel (masked to `****@domain.com`)
- Cannot export rosters or download CSV files
- Cannot modify event details or ticket assignments

**Alternate Flows:**

- **AF-045a: Direct URL Attempt**
  - Event assistant types `/admin/events` directly into the browser
  - Server-side middleware checks role; returns 403
  - Client is redirected to `/checkin`

- **AF-045b: API Attempt**
  - Event assistant calls an admin API route directly
  - Server checks `Authorization` header and role claim
  - Returns 403 Forbidden

**Postconditions:**
- Event assistant is limited to read + check-in operations
- All unauthorized access attempts are logged in the audit table

**Test References:** `tests/e2e/checkin.spec.ts` — "Event assistant access restrictions"
