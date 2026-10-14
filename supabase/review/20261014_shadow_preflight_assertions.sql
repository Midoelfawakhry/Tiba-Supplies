-- Tiba-Supplies Shadow preflight assertions
-- READ-ONLY: safe to run against a staging database; these statements do not mutate data.
-- Do not treat output as a production repair plan without reviewing the full live function definitions.

-- 1) Office cardinality: every type expected to be unique must have exactly one active office.
select office_type, count(*) filter (where is_active) as active_count
from public.offices
group by office_type
order by office_type;

-- 2) SECURITY DEFINER functions: verify exact signature, search_path, and direct EXECUTE access.
select p.oid::regprocedure::text as signature,
       coalesce(array_to_string(p.proconfig, ','), '(default search_path)') as function_config,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by signature;

-- 3) SECURITY DEFINER functions without an explicit search_path.
-- Empty search_path may be intentional, but requires all object references to be schema-qualified.
select p.oid::regprocedure::text as signature,
       coalesce(array_to_string(p.proconfig, ','), '(default search_path)') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and (p.proconfig is null or not exists (
    select 1 from unnest(p.proconfig) as cfg
    where cfg like 'search_path=%'
  ))
order by signature;

-- 4) Drivers with multiple current office assignments; zero or multiple assignment policy must be explicit.
select driver_id, count(*) as active_assignment_count
from public.driver_office_assignments
where assigned_to is null
  and assigned_from <= now()
group by driver_id
having count(*) > 1
order by active_assignment_count desc, driver_id;

-- 5) Active drivers with no current office assignment; investigate before enforcing assignment constraints.
select d.driver_id, d.name, d.is_active
from public.drivers d
where d.is_active
  and not exists (
    select 1
    from public.driver_office_assignments a
    where a.driver_id = d.driver_id
      and a.assigned_to is null
      and a.assigned_from <= now()
  )
order by d.name;

-- 6) Load office consistency: inspect mismatches between operational HEAD and check-in BRANCH.
select lo.load_order_id, lo.office_id, h.office_type as operational_type,
       lo.check_in_office_id, b.office_type as check_in_type, lo.status
from public.load_orders lo
left join public.offices h on h.office_id = lo.office_id
left join public.offices b on b.office_id = lo.check_in_office_id
where h.office_type is distinct from 'HEAD'
   or b.office_type is distinct from 'BRANCH'
   or lo.check_in_office_id is null
order by lo.created_at desc;

-- 7) Duplicate active booking pressure by driver or vehicle.
-- This is a diagnostic only; the statuses must be aligned with the canonical state machine.
select 'driver' as entity_type, driver_id as entity_id, count(*) as active_booking_count
from public.bookings
where status in ('BOOKED','LOADING_STATEMENT','IN_TRANSIT')
group by driver_id
having count(*) > 1
union all
select 'vehicle' as entity_type, vehicle_id as entity_id, count(*) as active_booking_count
from public.bookings
where status in ('BOOKED','LOADING_STATEMENT','IN_TRANSIT')
group by vehicle_id
having count(*) > 1
order by entity_type, active_booking_count desc;

-- 8) Duplicate actual-loading rows per booking; review before adding a unique constraint.
select booking_id, count(*) as actual_record_count
from public.actual_loading_records
where booking_id is not null
group by booking_id
having count(*) > 1
order by actual_record_count desc;

-- 9) Duplicate trip codes (both current and historical constraints need review before cleanup).
select trip_code, count(*) as row_count
from public.actual_loading_records
where trip_code is not null
group by trip_code
having count(*) > 1
order by row_count desc, trip_code;

-- 10) Direct assignment audit must be one-to-one with booking; report orphan or duplicate audit rows.
select booking_id, count(*) as audit_rows
from public.standalone_direct_load_audit
group by booking_id
having count(*) > 1
order by audit_rows desc;

select s.booking_id
from public.standalone_direct_load_audit s
left join public.bookings b on b.booking_id = s.booking_id
where b.booking_id is null;

-- 11) Public tables with RLS disabled; public schema is exposed by default in Supabase.
select schemaname, tablename
from pg_tables t
where schemaname = 'public'
  and not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = t.schemaname
      and c.relname = t.tablename
      and c.relrowsecurity
  )
order by tablename;

-- No UPDATE/DELETE/DDL is present in this file. Use the result set to design explicit staging tests.
