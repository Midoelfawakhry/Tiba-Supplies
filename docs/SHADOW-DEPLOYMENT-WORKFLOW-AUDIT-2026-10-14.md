# Deployment Workflow Audit — 2026-10-14

Branch reviewed: `shadow/phase1-hardening`

## Confirmed deployment targets
The following existing workflows trigger on pushes to `main` and deploy Edge Functions to the production Supabase project reference `tnlcvwtphbunteifoonc`:
- `.github/workflows/deploy-driver-account-function.yml`
- `.github/workflows/deploy-branch-employee-function.yml`
- `.github/workflows/deploy-tiba-ai-assistant.yml`

This is a useful guardrail for the current shadow branch because those three workflows do not trigger on `shadow/phase1-hardening`. However, they are production deployment workflows and should remain untouched during Shadow-only work.

## Android release workflow
`.github/workflows/android-signed-release.yml` currently lists `main` and `fix/driver-arrival-waiting-checkin` as push branches, and has a manual dispatch trigger. Its build environment hardcodes the production Supabase URL and a publishable client key. The publishable key is designed for client use, but the production project URL means any manually dispatched build from this workflow must be treated as a production-connected build unless the workflow explicitly overrides the environment.

## Release safety requirements
1. Do not manually dispatch the existing production APK workflow from the Shadow branch.
2. Create a separate Shadow build workflow with an explicit Shadow project URL and Shadow publishable key supplied through GitHub variables/secrets.
3. Use a separate environment protection rule for any deployment or signed release.
4. Before any Edge Function deployment, assert that the selected project ref matches the intended environment and print only the ref, never secrets.
5. Do not reuse production service-role keys or Auth users in Shadow.
6. Production deploy workflows must stay restricted to `main` and should not use wildcard branch filters.

## Current limitation
This audit only reads workflow source. No workflow was dispatched and no function or APK was deployed. The production project has not been modified.
