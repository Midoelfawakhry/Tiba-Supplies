# Native driver tracking implementation contract

## Goal
Keep a signed-in driver's live location updating during normal background operation, including when the app is swiped from Recents, without relying on a live JavaScript callback.

## Required behavior
- Start only after driver sign-in, explicit location permission, and a visible persistent foreground-service notification.
- Collect precise location only while the driver is signed in and tracking is enabled.
- Upload through `public.update_driver_live_location` with the driver's own short-lived Supabase access token and the public publishable key.
- Refresh an expired access token using the driver's refresh token over HTTPS; never use a service-role key.
- Store session material only using Android Keystore-backed encryption; clear it and stop the service on logout or account change.
- Preserve existing quality/rate limits: reject accuracy worse than 100 m; moving upload interval 10 minutes, slow movement 15 minutes, stationary 30 minutes; retry transient failures no more than once per minute.
- Keep office/branch authorization and database RPC checks unchanged.

## Build integration
The Android workflow currently creates the platform during CI. Any native plugin/service source must be copied into the generated Android project after `npx cap add android` and before Gradle build, or packaged as a maintained Capacitor plugin dependency. CI must compile the Java/Kotlin sources and produce the driver APK.

## Acceptance tests
1. Sign in and verify the persistent notification and initial location update.
2. Lock screen, swipe app from Recents, move at least 100 m, and verify the office's last-location timestamp advances without reopening the app.
3. Repeat after access-token expiry and during a temporary network outage.
4. Verify accuracy filtering and upload intervals.
5. Log out and confirm service termination, credential removal, and no subsequent updates.
6. Test on the actual HONOR handset; emulator/build success alone is insufficient.

## Current status
This document defines the implementation and release contract. It is not evidence that an independent native service has been implemented or that device acceptance tests have passed.