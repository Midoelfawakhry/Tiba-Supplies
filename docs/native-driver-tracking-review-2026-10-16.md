# Native Driver Tracking Review — 2026-10-16

## Scope and safety
Review of `supabase/functions/driver-native-location/index.ts` and
`supabase/migrations/20261014_native_driver_tracking_sessions.sql` on
`shadow/phase1-hardening`. This is a source review only. No Supabase migrations,
Edge Functions, production data, or production settings were changed.

## Verified design elements
- Tracking tokens are generated from 32 random bytes and only their SHA-256 hashes are stored.
- Tracking sessions expire after 12 hours and can be revoked.
- Start/revoke actions validate a Supabase user session.
- Background posts validate token existence, revocation, expiry, coordinate bounds,
  timestamp age when provided, active driver linkage, and an active vehicle assignment.
- The session table enables RLS and revokes table privileges from PUBLIC, anon, and authenticated.

## Findings to resolve before device acceptance

### 1. Missing capture time is accepted
The handler sets `capturedMs = Date.now()` when `body.time` is absent. That turns a
payload without device-captured time into a fresh location. This conflicts with the
Phase 1 requirement to require captured driver-location time. Reject missing or
non-numeric `time` instead of synthesizing it.

### 2. Missing accuracy is accepted
The handler permits `accuracy` to be null and stores it as null. If dispatch eligibility
requires fresh, accurate GPS, this endpoint should reject missing accuracy (and retain
the configured maximum accuracy bound) or explicitly document why null is valid.
Acceptance tests must cover missing, negative, over-limit, stale, and future values.

### 3. Assignment lookup and stored location are not fully linked
The handler verifies an active driver-to-vehicle assignment but the upsert writes only
`driver_id`, `latitude`, `longitude`, `accuracy_m`, `captured_at`, and
`received_at`; it does not persist the selected `vehicle_id`. Confirm the live Shadow
schema and downstream consumers. If the location contract includes vehicle identity,
write the assignment's vehicle ID and test reassignment behavior.

### 4. Rate limit is session-level, not atomic
The code reads `last_seen_at`, then writes the location and updates the session.
Concurrent requests can pass the 60-second check before either updates it. If the
one-request-per-minute limit is a security/operational requirement, enforce it atomically
in a database RPC or conditional update and test concurrent requests.

### 5. Error handling for session start should be complete
The revocation update that precedes creation of a new session does not check its error
before inserting a new token. Check and handle that error so a failed revoke cannot
silently leave multiple active sessions for one user.

### 6. CORS is broad
The function returns `Access-Control-Allow-Origin: *`. Authentication is still required,
so this alone is not proof of an authorization defect, but restrict origins to the app's
known web origins where practical. Native clients do not rely on browser CORS.

## Migration dependency
The session migration references `auth.users` and `public.drivers(driver_id)`. It is
not a clean-bootstrap migration by itself; the authoritative base schema and migration
order must be established before applying it to Shadow.

## Verification status
- Source review: completed.
- PR #72 GitHub checks: Migration integrity and Phase 1 build passed on the checked
  commit; this does not prove live database or device acceptance.
- PR #62: no workflow run was returned for its checked head commit in this review.
- Shadow database migration/application and physical-device tests: not performed.
- Production: untouched.

## Required next tests
1. Missing/invalid/stale/future `time` and missing/invalid accuracy are rejected.
2. Inactive/unlinked driver, expired/revoked token, and missing vehicle assignment are rejected.
3. Concurrent posts cannot bypass the intended rate limit.
4. Vehicle reassignment updates location ownership consistently.
5. Android foreground/background delivery, token expiry/revocation, and network retry are
   tested on a physical device against the isolated Shadow environment.
