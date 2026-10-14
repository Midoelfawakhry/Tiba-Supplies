# Driver background location: implementation status and acceptance gate

## Current client-side safeguards

- Native location watcher requests background location and shows an ongoing notification.
- Uploads use the Supabase RPC `update_driver_live_location` through native HTTP on Android.
- Upload attempts now refresh the Supabase session when the access token expires within two minutes, because foreground refresh timers can be suspended while the app is backgrounded.
- Existing throttles remain: 10 minutes while moving, 15 minutes at low speed, 30 minutes while stationary; fixes with accuracy worse than 100 metres are skipped.
- The RPC remains responsible for authenticating the user and validating the active driver/vehicle assignment. No service-role key is used.

## Important limitation — not yet a complete swipe-away fix

The upload callback is still delivered through the Capacitor JavaScript bridge. The current background-geolocation plugin service/receiver lifecycle can stop or fail to dispatch callbacks when the activity/bridge is destroyed. Refreshing the token and using native HTTP do not solve a missing callback.

Therefore this change must not be described as a verified fix for force-stop/swipe-away behavior. A robust follow-up needs a native foreground tracking/upload path that can continue independently of WebView callbacks, securely persist/refresh the driver's Supabase session (Android Keystore-backed storage), and stop/clear that session on logout. It must not store access/refresh tokens in plaintext or embed a service-role key.

## Required verification before release

1. Run TypeScript/lint and Android build on the candidate commit.
2. Install the driver APK on the physical target device; grant precise/background location and notification permissions.
3. Sign in as a linked test driver and verify the persistent notification.
4. With the screen locked and app swiped from Recents, move at least 100 metres and wait through the configured upload interval; verify the office's last-location timestamp advances without manual refresh.
5. Repeat with network interruption and token expiry; verify recovery and no duplicate/high-frequency uploads.
6. Log out and verify uploads stop and any native session material is cleared.
7. Test battery restrictions on the actual HONOR device; OEM battery policies can differ from emulator behavior.

Do not release based on a successful build alone. The screen-off/swipe-away test is the acceptance gate.
