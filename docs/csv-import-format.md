# FallCon Ticket Conductor — CSV Import Format

Admins can bulk-import users, teams, ticket packs, and tickets from a CSV file via the admin panel at `/admin/users` (Import button) or via the API at `POST /api/admin/import`.

---

## Column Definitions

The CSV must have a header row. Column names are case-insensitive and whitespace is trimmed. Spaces in headers are normalized to underscores.

| Column | Required | Type | Description |
|---|:---:|---|---|
| email | Yes | Email address | The user's email. Used as the unique identifier. If a user with this email already exists, their profile is updated (not duplicated). |
| full_name | No | Text | The user's display name. If omitted, the profile is saved without a name. |
| team_name | No | Text | Name of the team to assign the user to. If the team does not exist, it is created. Case-insensitive match against existing teams. |
| event_name | No | Text | Name of an existing event to create a ticket pack for. Must exactly match (case-insensitive) an event in the system. If the event is not found, the row is counted as partial success with an error note. |
| pack_name | No | Text | Display name for the ticket pack. Required if creating a pack (i.e., if event_name is provided). |
| ticket_count | No | Integer | Number of tickets to generate in the pack. Must be a positive integer, max 500. Required if creating a pack. |

---

## Notes on Column Behavior

- `email` is the only required column. A row with only an email is valid — it creates or updates the user profile with no pack.
- `team_name`, `event_name`, `pack_name`, and `ticket_count` are all optional and only have effect when all four are present together.
- If `event_name` is provided but `pack_name` or `ticket_count` is missing, no pack is created for that row. No error is raised; the user is still created/updated.
- `ticket_count` is parsed as an integer. Non-numeric values (e.g., "four") are treated as 0, which skips pack creation.

---

## Example CSV

```csv
email,full_name,team_name,event_name,pack_name,ticket_count
jane.smith@example.com,Jane Smith,Engineering,FallCon 2026,Jane's Table,4
bob.jones@example.com,Bob Jones,Marketing,FallCon 2026,Bob's Group,2
carol@example.com,Carol White,,FallCon 2026,Carol's Tickets,6
dave@example.com,Dave Brown,Engineering,,, 
eve@example.com,,,,,
frank@example.com,Frank Hall,Sales,FallCon 2026,Frank's Pack,10
```

In the example above:
- Jane, Bob, Carol, and Frank each get a user profile, a team (if specified), and a ticket pack with tickets
- Dave gets a user profile and team assignment; no pack is created (no event specified)
- Eve gets a minimal user profile only; no team, no pack
- All users with new emails will have Supabase auth accounts created (email confirmed: true)

---

## What Happens During Import

The import processes each row sequentially. For each row:

### 1. Team Upsert (if team_name provided)
The importer checks for an existing team with a case-insensitive name match. If found, the existing team is reused. If not found, a new team is created. Teams are cached per import batch to avoid redundant database queries.

### 2. User Creation or Update
The importer checks Supabase Auth for an existing user with the given email:
- **New user**: A Supabase auth user is created with `email_confirm: true` (no password; they will log in via magic link). The `handle_new_auth_user` trigger creates the `app_users` row automatically. The importer then upserts the profile with the full name, team, and role.
- **Existing user**: The `app_users` profile is upserted with updated `full_name` and `team_id` if provided. The auth user is not modified.

All imported users are given the `ticket_owner` role regardless of any column values (role assignment is not a CSV import feature — use the admin Users panel for role changes).

### 3. Event Lookup (if event_name provided)
The importer looks up the event by name using a case-insensitive match (`ilike`). Events are cached per import batch. If the event is not found, a per-row error is recorded and the row is marked as a partial success (user was created, pack was not).

### 4. Ticket Pack Creation (if event resolved and pack info provided)
A `ticket_packs` row is inserted with the given `pack_name` and `ticket_count`. The database trigger `trg_generate_tickets` fires immediately and creates `ticket_count` rows in the `tickets` table, each with a unique QR code.

### 5. Audit Log
A single `pack.create` audit entry is written per pack created. After all rows are processed, a summary `user.create` audit entry records the overall import result (total rows, successes, errors, users created, packs created).

---

## Import Response

The API returns a JSON summary:

```json
{
  "data": {
    "success": 5,
    "errors": [
      { "row": 3, "message": "Event not found: "NonExistentEvent"" }
    ],
    "created_users": 4,
    "created_packs": 4
  },
  "error": null
}
```

| Field | Description |
|---|---|
| success | Number of rows that were fully or partially processed without a fatal error |
| errors | Array of per-row errors with row number (1-indexed including header = row 2 is first data row) and message |
| created_users | Number of new Supabase auth users created |
| created_packs | Number of ticket packs created |

---

## Error Handling

Per-row errors do NOT stop the import. Processing continues through all rows. A row error is recorded if:

- `email` is missing or blank
- Supabase Auth user creation fails (e.g., rate limit, malformed email)
- Team creation fails (e.g., database error)
- Pack creation fails (e.g., ticket_count > 500)

The row is still counted in `success` if the user was created/updated even if the pack failed.

Fatal errors that abort the entire import:
- The uploaded file is not valid CSV (parse error on an otherwise empty file)
- No file was attached to the request
- The requesting user is not an admin

---

## Common Mistakes and Fixes

### "Event not found" error for a row
The `event_name` value in the CSV must exactly match (case-insensitive) an event's `name` field in the database.
- Fix: Check the exact event name in the admin Events panel and copy it into the CSV
- Note: Leading/trailing spaces in the CSV cell are trimmed automatically

### Duplicate packs for the same user/event
Each import run creates a new pack regardless of whether the user already has a pack for that event. If the same user appears in multiple import files, they will accumulate multiple packs.
- Fix: Before re-importing, review existing packs in the Ticket Packs panel and delete any duplicates

### User created but no pack appeared
This happens when `event_name` is in the CSV but the pack columns are incomplete (missing `pack_name` or `ticket_count`), or when `ticket_count` is 0 or non-numeric.
- Fix: Ensure all four columns (event_name, pack_name, ticket_count, and the user's email) are populated

### "Auth user create failed: User already registered"
This error means Supabase already has an auth user with that email but the importer could not retrieve their ID from the list. This can happen due to Supabase Admin API pagination limits on very large user bases.
- Fix: The user's profile will still be upserted. Check the admin Users panel to confirm the user exists. If the pack was not created, create it manually.

### Column names not recognized
The importer normalizes headers to lowercase with underscores. However, if your spreadsheet tool adds BOM characters or uses different quote styles, the first column header may be malformed.
- Fix: Open the CSV in a text editor and ensure the first line is exactly: `email,full_name,team_name,event_name,pack_name,ticket_count`

### ticket_count exceeds limit
The `ticket_packs.total_tickets` column has a CHECK constraint: `total_tickets > 0 AND total_tickets <= 500`. A value above 500 will fail the insert.
- Fix: Split large groups into multiple rows with separate pack names and 500 tickets each

---

## Uploading via the Admin UI

1. Navigate to `/admin/users`
2. Click the "Import CSV" button
3. Select your CSV file (must be `.csv` format; `.xlsx` not supported)
4. Click "Import"
5. Review the summary modal showing successes, created users, created packs, and any row errors

The import is processed server-side. For large files (hundreds of rows), expect the request to take 10–30 seconds depending on the number of new users being created.

---

## Uploading via the API

```bash
curl -X POST https://yourapp.vercel.app/api/admin/import \
  -H "Cookie: <your-admin-session-cookie>" \
  -F "file=@attendees.csv"
```

The file field must be named `file`. The `Content-Type` is automatically set to `multipart/form-data` by the `-F` flag.

---

## Exporting Data

To export current ticket data, use the CSV export at `/admin/reports` or:

```bash
curl -X GET "https://yourapp.vercel.app/api/admin/export?event_id=<uuid>" \
  -H "Cookie: <your-admin-session-cookie>" \
  --output export.csv
```

The export includes ticket status, recipient name/email, QR code, check-in timestamp, and pack/event information.
