# Canonical driver tracking baseline — APK v191

Date: 2026-10-16

## Decision

Treat the tracking implementation included in signed APK build v191 as the **behavioral reference baseline** for Tiba-Supplies driver tracking. Preserve its current behavior; do not replace it with a different tracking implementation merely because another branch or endpoint exists.

This is a source/configuration decision only. It does not authorize a production deployment, database migration, backend URL change, or APK rebuild.

## Exact build identity

- GitHub Actions run: https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38909767851
- Source commit: `722471be9a547a1e28b795a2b6a923c93dbb1f43`
- Source branch: `shadow/phase1-hardening`
- Android app version configured by workflow: `1.0.42` (run/artifact label v191 is not the Android version)
- Tracking files:
  - `src/components/DriverApp.tsx`
  - `native/android/NativeDriverTrackingPlugin.java`
  - `native/android/NativeDriverTrackingService.java`
  - `.github/workflows/android-signed-release.yml`

## How the v191 tracking path works

1. The driver must have a valid signed-in session and pass the existing active-driver authorization flow.
2. On Android, the app initializes the location permission watcher and starts the registered Capacitor plugin `NativeDriverTracking`.
3. The plugin starts a visible Android foreground service with a persistent notification and an explicit stop action.
4. The native service uses Android GPS/network location providers independently of WebView callbacks, skips fixes with accuracy worse than 100 metres, requests updates every 30 seconds, and rate-limits successful uploads to roughly one per minute.
5. It sends `p_latitude`, `p_longitude`, `p_accuracy_m`, and UTC `p_captured_at` to the configured project's existing PostgREST RPC:
   `/rest/v1/rpc/driver_update_live_location`.
6. It uses the signed-in driver's access/refresh tokens and public publishable key, refreshes an expiring session, and stores session material encrypted with AES-GCM backed by Android Keystore.
7. The UI also has a non-Android/background-geolocation fallback path. Logout/effect cleanup requests service shutdown and clears the encrypted stored session.

## Important distinction: this is NOT the Edge Function path

The native service in v191 posts directly to `driver_update_live_location`. It does not call `/functions/v1/driver-native-location`.

The separate `supabase/functions/driver-native-location/index.ts` implementation uses a different session-token protocol and writes `driver_live_locations`; it expects `driver_location_tracking_sessions` and a different assignment contract. Do not substitute, deploy, or combine that Edge Function with v191 without a separate schema/contract reconciliation and acceptance test.

## Backend configuration warning

The v191 build workflow embeds this Supabase project URL:

`https://awgppfjxegognuqozldl.supabase.co`

That is different from the known primary project `tnlcvwtphbunteifoonc` and the approved Shadow project `bvyxiahpxogblkmtjxyx`. The fact that the installed v191 app is working is evidence about the user's current installed configuration, but does not by itself prove which backend currently receives the location writes or authorize switching backends.

**Do not change this URL, apply migrations, deploy functions, or write to either primary or Shadow as part of adopting the tracking baseline.** First verify the intended project and confirm the deployed `driver_update_live_location` RPC contract in read-only mode.

## Known release checks still required

- Confirm which backend the installed v191 build is actually using and which deployed RPC receives the writes.
- Read-only compare the deployed RPC signature/behavior and location table with the native request payload.
- On the target HONOR Android device, test screen lock, swipe-away from Recents, network interruption, token refresh, logout/stop action, and whether the office map's last-location timestamp continues to advance.
- Keep production auto-deploy OFF. No database migration or function deployment is authorized by this document.

## Source references

- [v191 build](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38909767851)
- [Driver app integration](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/722471be9a547a1e28b795a2b6a923c93dbb1f43/src/components/DriverApp.tsx)
- [Native Android plugin](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/722471be9a547a1e28b795a2b6a923c93dbb1f43/native/android/NativeDriverTrackingPlugin.java)
- [Native Android service](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/722471be9a547a1e28b795a2b6a923c93dbb1f43/native/android/NativeDriverTrackingService.java)
- [Build workflow](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/722471be9a547a1e28b795a2b6a923c93dbb1f43/.github/workflows/android-signed-release.yml)
