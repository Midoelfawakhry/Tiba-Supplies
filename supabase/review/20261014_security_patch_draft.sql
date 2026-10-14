-- Tiba-Supplies security patch draft — 2026-10-14
-- REVIEW ARTIFACT ONLY. This file is intentionally outside supabase/migrations/.
-- Read-only preflight checks only. No schema/data changes are performed here.
-- Do not apply as a production migration.

-- 1) Office cardinality: first inspect whether the current "single active BRANCH"
-- assumption is true before considering a partial unique index.
SELECT office_type, count(*) AS active_office_count,
       array_agg(office_id ORDER BY name) AS active_office_ids,
       array_agg(name ORDER BY name) AS active_office_names
FROM public.offices
WHERE is_active = true
GROUP BY office_type
ORDER BY office_type;

-- 2) Find drivers with more than one active office assignment.
-- This is important before using driver_office_assignments as the canonical scope.
SELECT driver_id, count(*) AS active_assignment_count,
       array_agg(office_id ORDER BY assigned_from DESC) AS office_ids
FROM public.driver_office_assignments
WHERE assigned_to IS NULL
  AND assigned_from <= now()
GROUP BY driver_id
HAVING count(*) > 1
ORDER BY active_assignment_count DESC, driver_id;

-- 3) Find active drivers without an active office assignment.
-- Review the results; do not auto-assign them during a security patch.
SELECT d.driver_id, d.name, d.driver_code
FROM public.drivers d
WHERE d.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.driver_office_assignments doa
    JOIN public.offices o ON o.office_id = doa.office_id
    WHERE doa.driver_id = d.driver_id
      AND doa.assigned_to IS NULL
      AND doa.assigned_from <= now()
      AND o.is_active = true
  )
ORDER BY d.name;

-- 4) Detect load orders whose operational/check-in offices are invalid or inactive.
SELECT lo.load_order_id, lo.office_id, lo.check_in_office_id, lo.status
FROM public.load_orders lo
LEFT JOIN public.offices op ON op.office_id = lo.office_id
LEFT JOIN public.offices ci ON ci.office_id = lo.check_in_office_id
WHERE op.office_id IS NULL
   OR op.is_active IS DISTINCT FROM true
   OR op.office_type IS DISTINCT FROM 'HEAD'
   OR ci.office_id IS NULL
   OR ci.is_active IS DISTINCT FROM true
   OR ci.office_type IS DISTINCT FROM 'BRANCH'
ORDER BY lo.created_at DESC;

-- 5) Detect branch directory candidates outside each driver's current active
-- branch assignment. This is a diagnostic only; it does not decide whether the
-- business intends a global directory or a branch-scoped directory.
SELECT d.driver_id, d.name, doa.office_id AS assigned_office_id, o.name AS assigned_office_name
FROM public.drivers d
LEFT JOIN public.driver_office_assignments doa
  ON doa.driver_id = d.driver_id
 AND doa.assigned_to IS NULL
 AND doa.assigned_from <= now()
LEFT JOIN public.offices o ON o.office_id = doa.office_id
WHERE d.is_active = true
ORDER BY d.name, doa.assigned_from DESC;

-- 6) ACL audit: include special privileges, not just SELECT/INSERT/UPDATE/DELETE.
-- Compare this output with the intended RPC-only architecture before revoking grants.
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
  AND privilege_type IN (
    'SELECT', 'INSERT', 'UPDATE', 'DELETE',
    'TRUNCATE', 'REFERENCES', 'TRIGGER'
  )
ORDER BY table_name, grantee, privilege_type;

-- 7) Function inventory for explicit review. Keep overloads separate.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result_type,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

-- PROPOSED PATCHES — NOT EXECUTED
--
-- A. Office identity:
--    Replace ORDER BY ... LIMIT 1 office resolution in RPCs with a persisted,
--    validated office_id from the load or the authenticated driver's active
--    driver_office_assignments row.
--
-- B. Branch directory:
--    In get_branch_office_snapshot(), scope directory rows to the authenticated
--    branch office using app_users.office_id plus an active driver_office_assignments
--    row, unless the product owner explicitly confirms a global shared directory.
--
-- C. Branch isolation:
--    Keep get_phase1_snapshot() ADMIN/HEAD_OFFICE-only. Keep branch reads on
--    get_branch_office_snapshot(). Test direct RPC calls, not just UI visibility.
--
-- D. SECURITY DEFINER:
--    Review and explicitly replace each affected function definition. Do not use
--    broad source-text substitution as a substitute for reviewing the final SQL.
--    Preserve intended authenticated RPCs and remove direct execution from internal
--    trigger/helper functions where appropriate.
--
-- E. Migration history:
--    Do not replay or rename historical migrations to reconcile version mismatches.
--    Compare deployed definitions and ledger first, then add a uniquely versioned
--    forward migration after clean staging bootstrap.
