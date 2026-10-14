# Driver background location: implementation status and acceptance gate

## Implemented in the candidate branch

- Added a Capacitor bridge named `NativeDriverTracking` to start/stop an Android foreground service.
- Added `NativeDriverTrackingService`, which uses Android location providers and uploads directly to the existing Supabase RPC without relying on WebView callbacks.
- The service displays a persistent notification with an explicit stop action and declares a location foreground-service type.
- Access and refresh tokens are encrypted with AES-GCM using a key held by Android Keystore. The service clears stored session material when stopped.
- The service uses the driver's access token and public publishable key only; it does not use a service-role key.
- Uploads retain the current thresholds: accuracy worse than 100 metres is skipped; moving interval 10 minutes, slow movement 15 minutes, stationary 30 minutes; transient errors are retried on later location callbacks.
- The Android build workflow copies native source files, registers the Capacitor plugin, and declares the service in the manifest for the driver APK only.
- The driver UI starts the native service after the existing background-location permission flow and requests service stop during logout/effect cleanup.

## Known caveats before release

- This is a candidate implementation, not yet verified by a successful Android build or physical-device acceptance test.
- The background-location permission flow depends on the installed background-geolocation plugin and Android/OEM permission screens; verify it on Android 11+ and the target HONOR device.
- Verify Supabase refresh-token rotation behavior against the project's deployed Auth configuration.
- A user-initiated Android Force Stop from Settings is expected to stop the service; swipe-away from Recents is the required acceptance case.

## Required verification

1. Run TypeScript/lint and the driver Android Gradle build on the candidate commit.
2. Install the driver APK on the physical target device; grant precise/background location and notification permissions.
3. Sign in as a linked test driver and verify the persistent notification.
4. With the screen locked and app swiped from Recents, move at least 100 metres and wait through the configured upload interval; verify the office's last-location timestamp advances without reopening the app.
5. Repeat with network interruption and token expiry; verify recovery and no duplicate/high-frequency uploads.
6. Log out and verify service termination, encrypted-session removal, and no subsequent updates.
7. Test battery restrictions on the actual HONOR device.

Do not release based on source changes alone. The CI build and screen-off/swipe-away device test are release gates.
