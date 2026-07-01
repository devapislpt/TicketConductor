# Authentication Use Cases

**Document:** UC-001
**Module:** Authentication
**Last Updated:** 2026-06-21
**Status:** Approved

---

## UC-001: Magic Link Login

**Actor:** Any registered user (admin, event_assistant, ticket_owner)

**Preconditions:**
- User has an account in the system with an active status
- User has a valid email address on file
- User is not currently authenticated

**Main Flow:**
1. User navigates to `/login`
2. System displays the Login page with two tabs: "Magic Link" and "Password"
3. User selects the "Magic Link" tab (default)
4. User enters their email address
5. User clicks "Send Magic Link"
6. System calls `POST /api/auth/magic-link` with the email
7. System validates the email exists in the user table and is active
8. System triggers Supabase to send a magic link email
9. System displays success message: "Check your email for a login link"
10. User receives email and clicks the link
11. Supabase validates the token and creates a session
12. System redirects user to the appropriate dashboard based on their role

**Alternate Flows:**

- **AF-001a: Unknown Email**
  - At step 7, the email is not found in the user table
  - System returns an error response
  - UI displays: "No account found with that email address"
  - Flow ends; user remains on login page

- **AF-001b: Inactive Account**
  - At step 7, the email exists but the account status is `inactive`
  - System returns a 403 error
  - UI displays: "Your account has been deactivated. Please contact the organizer."
  - Flow ends; user remains on login page

- **AF-001c: Magic Link Already Sent**
  - User submits the form a second time within the cooldown window
  - System displays: "A link was already sent. Please check your email or wait before requesting another."

- **AF-001d: Expired Magic Link**
  - User clicks a magic link that has expired (>1 hour old)
  - Supabase rejects the token
  - System redirects to `/login?error=link_expired`
  - UI displays: "This link has expired. Please request a new one."

**Postconditions:**
- On success: User session is created; user is redirected to their role-appropriate dashboard
- On failure: No session created; user remains on login page with an error message

**Test References:** `tests/e2e/auth.spec.ts` — "Magic Link form: submitting unknown email shows error", "Magic Link form: submitting valid email shows success"

---

## UC-002: Password Login

**Actor:** Any registered user with a password set

**Preconditions:**
- User has an account with `active` status
- User has set a password (either initially or via reset)
- User is not currently authenticated

**Main Flow:**
1. User navigates to `/login`
2. System displays Login page
3. User selects the "Password" tab
4. User enters their email address and password
5. User clicks "Sign In"
6. System calls `POST /api/auth/login` with credentials
7. Supabase authenticates the credentials
8. System fetches user profile and role from the database
9. System creates a session
10. System redirects user to the role-appropriate dashboard

**Alternate Flows:**

- **AF-002a: Wrong Password**
  - At step 7, Supabase returns an authentication error
  - UI displays: "Invalid email or password"
  - Flow ends; user remains on login page

- **AF-002b: Account Inactive**
  - At step 8, the system detects `status = inactive`
  - System destroys the newly-created Supabase session
  - UI displays: "Your account has been deactivated."
  - Flow ends

- **AF-002c: Too Many Attempts**
  - After 5 consecutive failed attempts, Supabase rate-limits the account
  - UI displays: "Too many login attempts. Please try again later or use a magic link."

**Postconditions:**
- On success: Authenticated session established; user at role dashboard
- On failure: No persistent session; error displayed

**Test References:** `tests/e2e/auth.spec.ts` — "Password form: wrong password shows error", "Successful login redirects to correct page based on role"

---

## UC-003: Password Reset

**Actor:** Any registered user

**Preconditions:**
- User has an account in the system
- User knows their registered email address

**Main Flow:**
1. User clicks "Forgot Password?" on the Password tab of `/login`
2. System navigates to `/login/reset` or opens a modal
3. User enters their email address
4. User clicks "Send Reset Link"
5. System calls `POST /api/auth/reset-password` with the email
6. System looks up the account (silently succeeds even if not found, to prevent enumeration)
7. If account exists and is active, Supabase sends a password reset email
8. UI displays: "If an account exists with that email, you will receive a reset link shortly."
9. User clicks the link in the email
10. System navigates to `/login/update-password?token=...`
11. User enters new password and confirms it
12. User clicks "Update Password"
13. System validates passwords match and meet complexity requirements (≥8 chars)
14. System calls Supabase to update the password
15. System displays success and redirects to `/login`

**Alternate Flows:**

- **AF-003a: Passwords Don't Match**
  - At step 13, the two password fields do not match
  - UI displays inline validation: "Passwords do not match"
  - Form is not submitted

- **AF-003b: Password Too Short**
  - At step 13, password is fewer than 8 characters
  - UI displays: "Password must be at least 8 characters"

- **AF-003c: Expired Reset Token**
  - At step 14, Supabase rejects the token
  - UI displays: "This reset link has expired. Please request a new one."

**Postconditions:**
- On success: User's password updated; user redirected to login
- On failure: Password unchanged; appropriate error displayed

**Test References:** `tests/unit/validators.test.ts` — "resetPasswordSchema: passwords match", "resetPasswordSchema: passwords don't match", "resetPasswordSchema: too short"

---

## UC-004: Role-Based Redirect on Login

**Actor:** Any authenticated user completing login

**Preconditions:**
- User has successfully authenticated (via magic link or password)
- User profile has a `role` field set to one of: `admin`, `event_assistant`, `ticket_owner`

**Main Flow:**
1. Authentication completes (session established)
2. System fetches user profile from `profiles` table
3. System reads the `role` field
4. **Admin:** Redirected to `/admin/dashboard`
5. **Event Assistant:** Redirected to `/checkin`
6. **Ticket Owner:** Redirected to `/dashboard`

**Alternate Flows:**

- **AF-004a: Role Not Set**
  - User's profile has no role or an unrecognized role
  - System redirects to `/dashboard` (default fallback)
  - System logs a warning in the audit log

- **AF-004b: Deep-Link Redirect**
  - User was redirected to `/login` from a protected route (e.g., `/admin/events`)
  - After successful login, system checks `next` query param
  - If the `next` URL is an internal path the user is authorized to access, redirect there
  - Otherwise, fall back to role-based default

**Postconditions:**
- User lands on the correct dashboard for their role
- No user can land on a page their role cannot access

**Test References:** `tests/e2e/auth.spec.ts` — "Successful login redirects to correct page based on role"

---

## UC-005: Inactive Account Blocked

**Actor:** Any user with `status = inactive`

**Preconditions:**
- User exists in the system
- User's account `status` is set to `inactive` by an admin

**Main Flow:**
1. User attempts to log in via any method (magic link or password)
2. System detects `status = inactive` during authentication or session validation
3. System blocks access
4. UI displays: "Your account has been deactivated. Please contact the event organizer."
5. No session is created (or any created session is immediately invalidated)

**Alternate Flows:**

- **AF-005a: Previously Active Session**
  - User was logged in before an admin deactivated their account
  - On next page load or API call, middleware detects `status = inactive`
  - User is logged out and redirected to `/login` with the deactivation message

**Postconditions:**
- Inactive user cannot access any authenticated route
- Active sessions are invalidated when account is deactivated

**Test References:** `tests/e2e/auth.spec.ts` — implicit in blocked-login scenarios

---

## UC-006: Unknown Email Blocked from Magic Link

**Actor:** Anonymous user (not registered)

**Preconditions:**
- The submitted email address does not exist in the `profiles` table

**Main Flow:**
1. User navigates to `/login`
2. User selects "Magic Link" tab
3. User enters an email not registered in the system
4. User clicks "Send Magic Link"
5. System calls `POST /api/auth/magic-link`
6. System queries the database and finds no matching account
7. System returns a 404/400 error
8. UI displays: "No account found with that email address"
9. User remains on login page

**Alternate Flows:**

- **AF-006a: Typo in Email**
  - User enters a malformed email (e.g., missing `@`)
  - Client-side Zod validation catches it before submission
  - UI displays: "Please enter a valid email address"

**Postconditions:**
- No magic link is sent
- No information about which emails ARE registered is revealed beyond the explicit error (acceptable per product decision)
- User remains unauthenticated

**Test References:** `tests/e2e/auth.spec.ts` — "Magic Link form: submitting unknown email shows error 'No account found'"
