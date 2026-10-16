# v191 Baseline Clarification — AI Assistant — 2026-10-16

## User-confirmed baseline
The user confirms the AI assistant in installed signed APK/build v191 works very well. Therefore, preserve the v191 assistant behavior and do not treat the failed optional deployment workflow as an AI runtime defect.

## Source alignment
The temporary branch-only change that required `office_code = 'RAS_SEDR'` in the AI assistant audience guard has been reverted on `shadow/phase1-hardening`. The related test file has also been restored to the v191 baseline. Both are restored to the content at source commit `722471be9a547a1e28b795a2b6a923c93dbb1f43`.

- Revert assistant source commit: `7d676d9583db10b7cd865d8b46c5be95beb8a97e`
- Restore authorization test commit: `1d296b780aec8099cecbc7f843ac5b3fd10fa0e6`

These are source changes on the review branch. No Edge Function was deployed by this action. A later CI workflow may run automatically because GitHub Actions is configured on this branch; its result should be checked before claiming completion.

## Security review scope
The separate RPC authorization findings remain candidates for a controlled review and isolated testing. They do not justify changing the working AI assistant. The RPC migration remains prepared but unapplied.

## Change guardrails
- Keep the v191 AI behavior as the reference.
- Do not deploy the AI Edge Function solely to match the review branch.
- Do not apply RPC migrations to any database until isolated-target tests pass.
- Do not change the production project or replace the installed v191 APK.
