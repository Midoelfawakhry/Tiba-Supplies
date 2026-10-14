# Battery-efficient driver location prototype

## Scope

This prototype is isolated on `prototype/battery-efficient-driver-location`. It changes only driver-side location sampling/upload behavior. It does not modify office UI, booking/check-in rules, Supabase schema, RPC contracts, or real operational records.

## Prototype behavior

- Native background-geolocation watcher remains enabled only for an authenticated, linked driver.
- Android watcher distance filter: 25 metres (previously 10 metres).
- Upload throttle while moving at 2 m/s or faster: at most one upload every 30 seconds.
- Upload throttle while stopped or moving slower than 2 m/s: at most one upload every 90 seconds.
- Skip sending a location fix when reported GPS accuracy is worse than 100 metres.
- Do not refresh the full driver portal snapshot after every location upload; the existing 15-second portal refresh remains responsible for portal data.
- Existing RPC contract `update_driver_live_location` and existing fields remain unchanged.

## Android configuration already present

The driver build workflow sets `android.useLegacyBridge: true`, adds location and foreground-service permissions, and the watcher supplies a persistent notification title/message. The background-geolocation plugin documentation notes that Android 13+ may also require the notification runtime permission. Verify this on-device; do not treat a manifest declaration alone as proof that runtime permission was granted.

## Test checklist before merge/release

1. Build the **driver** APK from this branch using the GitHub Actions `Build Tiba Supplies Office, Driver, and Branch Android APKs` workflow with `workflow_dispatch`.
2. Install on a physical Android device, grant precise location and notification permissions, sign in as a linked test driver, and start a work session.
3. Confirm the persistent location notification appears.
4. Walk/drive at least 100 metres with the screen on; verify the office map receives location updates and the recorded timestamp advances.
5. Lock the screen for at least 10 minutes while moving; verify updates continue and are not only foreground WebView updates.
6. Remain stationary for 5 minutes; confirm uploads do not continue at a high rate and the office shows the last-update timestamp rather than implying a fresh live fix.
7. Toggle location off/on, deny/revoke permission, and disable internet; confirm a clear recoverable state and that reconnecting restores updates.
8. Compare battery use against the previous build over the same route and duration.
9. Confirm logout removes the watcher and location updates stop.
10. Run `npm run lint` and `npm run build`; inspect the Android build log for manifest/foreground-service warnings.

## Known limitation / next gate

The current implementation sends the Supabase RPC through the web app's request path. Android WebView network throttling in long-running background sessions must be explicitly tested. If uploads stop after several minutes despite native location callbacks continuing, the next isolated step is to route the upload through a native HTTP path, then repeat the screen-off test. Do not merge or replace the production APK until the physical-device tests pass.
