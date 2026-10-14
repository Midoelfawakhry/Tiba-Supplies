# Phase 1 Office Authority Contract

Status: authoritative product rule for implementation
Branch: shadow/phase1-hardening
Updated: 2026-10-14

## Fixed office model
Tiba-Supplies has exactly two offices:
- **HEAD_OFFICE — Main Office:** the sole operational command center and the only office role allowed to create/manage operational data and execute operational actions.
- **BRANCH — Ras Sedr Office:** the single active branch/site reference used for driver location and geofence eligibility. It is not a second operational command center.

Do not design for multiple branches. Treat Ras Sedr as the canonical active branch and fail closed if it is missing or ambiguous. A database constraint should enforce at most one active Ras Sedr BRANCH; bootstrap/health validation must also assert that exactly one active HEAD_OFFICE and one active Ras Sedr BRANCH exist.

## Authority matrix
| Capability | Main Office (HEAD_OFFICE / ADMIN as explicitly permitted) | Ras Sedr BRANCH | Driver |
|---|---|---|---|
| Create/edit/activate/deactivate factories | Allowed | Denied | Denied |
| Create/edit/activate/deactivate quarries | Allowed | Denied | Denied |
| Create/edit/activate/deactivate drivers | Allowed | Denied | Denied |
| Create/edit/activate/deactivate vehicles | Allowed | Denied | Denied |
| Manage vehicle owners | Allowed | Denied | Denied |
| Create/publish/cancel load orders | Allowed | Denied | Denied |
| Direct-assign load to a specific vehicle/driver | Allowed | Denied | Denied |
| Operational cancellation/redirect/remove waiting entry | Allowed | Denied | Denied |
| Monitor locations and operational dashboards | Allowed | Denied | Own permitted driver view only |
| View eligible nearby loads / queue | Not a driver queue | Not an operational authority | Only when location and assignment rules pass |
| Update own location / arrival / delivery confirmation | Denied | Denied | Own authenticated identity only |
| Change roles or office authority | Restricted administrative operation only | Denied | Denied |

ADMIN must not be treated as a blanket bypass unless the implementation explicitly maps and documents that authority. The Main Office is the sole operational input point. If a role is not specified by this contract, deny by default until assigned intentionally.

## Ownership and geofence
- All operational vehicles and drivers may be associated with the Ras Sedr branch as the location/dispatch reference, as a deliberate product rule.
- This association does **not** grant the branch staff operational write permissions.
- Use the configured Ras Sedr coordinates and 10 km eligibility radius (where the app's established rule requires 10 km). Require fresh location data; reject missing/stale/future-invalid coordinates.
- Geofence decides driver eligibility for nearby/queue load visibility and relevant arrival flows. It must not hide a driver's already assigned booking from their own portal.

## Implementation rules
1. Enforce authorization inside database RPCs and Edge Functions, not just UI visibility.
2. Resolve the single active HEAD_OFFICE and Ras Sedr BRANCH deterministically; never select an arbitrary office with `LIMIT 1` as a substitute for validation.
3. Main Office screens call authorized RPCs for all create/edit/delete/deactivate/dispatch/cancel actions. Branch app stays read-only for office operations; do not add operational input screens to it.
4. Deactivation/soft-delete should preserve booking, loading, delivery, and audit history. Hard-delete transactional history is prohibited unless a documented retention workflow explicitly allows it.
5. Scope office dashboards and directory responses to the fields and capabilities in this matrix.
6. Direct assignment must record the chosen driver and vehicle, validate active records and conflicts, generate/retain trip identity, and audit who assigned it.
7. All driver mutations must bind to `auth.uid()`; client-supplied driver IDs alone are not authorization.
8. Add tests for every matrix row, direct RPC invocation, unauthorized branch attempts, cross-office data leakage, and the one-office invariant.

## Safe rollout
This contract is for the Shadow development branch. Reconcile migration history and bootstrap Shadow before applying a new migration. Do not modify production during this hardening pass.
