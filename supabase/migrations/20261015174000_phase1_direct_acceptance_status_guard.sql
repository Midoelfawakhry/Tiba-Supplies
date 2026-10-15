-- Phase 1 change 3: enforce pending direct acceptance across every status-changing RPC.
-- This guards booking status only and deliberately leaves GPS/tracking functions and tables unchanged.

create or replace function public.enforce_direct_assignment_acceptance_before_status_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.assignment_type = 'DIRECT'
     and old.direct_acceptance_status = 'PENDING'
     and new.status is distinct from old.status
     and new.status <> 'CANCELLED' then
    raise exception 'DRIVER_ACCEPTANCE_REQUIRED'
      using errcode = '23514',
            hint = 'The assigned driver must explicitly accept the direct assignment before the trip can progress.';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_direct_acceptance_status_guard on public.bookings;
create trigger bookings_direct_acceptance_status_guard
before update of status on public.bookings
for each row
execute function public.enforce_direct_assignment_acceptance_before_status_change();

comment on trigger bookings_direct_acceptance_status_guard on public.bookings is
  'Prevents a pending direct assignment from progressing before explicit driver acceptance; cancellation remains allowed.';
notify pgrst, 'reload schema';
