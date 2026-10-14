# Shadow Phase 1 Acceptance Matrix

Branch: `shadow/phase1-hardening`
Environment: dedicated Shadow Supabase project only.

This matrix distinguishes source-level assertions from checks actually executed against the current Shadow database and app build. Do not mark a scenario accepted based on code inspection alone.

| Area | Acceptance scenario | Expected result | Evidence / current status |
| --- | --- | --- | --- |
| Authentication | Anonymous caller invokes a protected RPC | Rejected with an auth error | Source guard exists; authenticated runtime test not evidenced |
| Role access | Inactive or role-less account invokes protected RPC | Rejected | Source guard exists; runtime test not evidenced |
| Main Office scope | Only active ADMIN/HEAD_OFFICE profile linked to active `MAIN` office can mutate | All other roles rejected | Live RPC definition confirms this guard; no authenticated test identity available |
| Branch scope | Only active BRANCH profile linked to active `RAS_SEDR` office can read branch snapshot | Read-only, office-scoped response | Live RPC definition confirms the guard; authenticated runtime test not evidenced |
| Office reference data | One active `HEAD_OFFICE` office and one active `BRANCH` office | Correct canonical office types and branch geofence | Shadow query observed one active `HEAD_OFFICE` office (`MAIN`) and one active `BRANCH` office (`RAS_SEDR`, 10,000 m). Main Office coordinates are null; they are not used as the Ras Sedr driver geofence |
| RLS | Public-schema base tables have RLS enabled | No exposed table without RLS | Shadow catalog query returned 0 public tables with RLS disabled |
| Load lifecycle | Draft creation, publish, direct assignment, cancellation reconciliation | Valid state transitions; server checks authoritative | Migration/source assertions exist; full workflow runtime test not evidenced |
| Driver/vehicle | One active vehicle per driver and one active driver per vehicle; booking uses current link | Invalid or conflicting assignment rejected | Constraints/RPC guards exist in Shadow; concurrent runtime test not evidenced |
| Actual loading | Actual record resolves through its booking to exactly one load order | No factory/quarry-only inference; no duplicate booking record | Schema/source contract exists; runtime fixture test not evidenced |
| Delivery | Driver confirms own in-transit booking with fresh accurate GPS | Confirmation is authorized and idempotent; office cannot bypass it | Source/migration guards exist; authenticated runtime test not evidenced |
| Geofence | Driver location is fresh, accurate and within configured Ras Sedr radius | Otherwise available loads are empty | Live RPC definition confirms 10-minute freshness and branch-radius check; GPS device test not evidenced |
| Native tracking | Start/revoke requires user session; background posts use scoped, expiring hashed token | Only active driver with current vehicle assignment can update location | Deployed `driver-native-location` function is ACTIVE; device lifecycle test not evidenced |
| Driver account provisioning | Current Phase 1 Main Office authorization is applied by deployed function | Unauthorized callers cannot create/reset accounts | GitHub source contains the Phase 1 guard, but deployed `create-driver-account` source is older and still checks legacy `app_users` role logic. Deployment attempt was blocked; **release blocker** |
| Automated tests | `npm run test:phase1` | All contract/authorization tests pass | No successful test-run output verified |
| TypeScript/build | `npm run lint` and `npm run build` | Both exit successfully | No successful run output verified; GitHub status connector currently returns no status checks |
| Android artifacts | Office, Driver and Branch APKs build; Driver contains native tracking service | Artifacts exist and install | Workflow definitions are Shadow-scoped; generated artifacts and device installation are not yet verified |
| Signed release | Signing secrets available in GitHub Actions; signed APKs generated | All three signed APKs pass install/smoke test | Not verified; do not mark release-ready |

## Known blockers before calling the app complete

1. Deploy the current `supabase/functions/create-driver-account/index.ts` to the Shadow project through an approved deployment path. Do not route this operation to any other Supabase project.
2. Obtain verified CI output for `npm run test:phase1`, `npm run lint`, and `npm run build`.
3. Produce and inspect Office, Driver, and Branch build artifacts; smoke-test the signed Android APKs on devices.
4. Provision controlled test identities and isolated synthetic fixtures for authenticated workflow tests. Do not insert fake operational records into the shared Shadow database.
5. Exercise driver login/logout, backgrounding, permission denial, stale GPS, out-of-geofence behavior, arrival, loading, delivery, and audit/idempotency on a test device.

## Safety boundary

This is a Shadow-only acceptance matrix. It does not authorize production deployment, production database changes, or a release before the blockers above are resolved.
