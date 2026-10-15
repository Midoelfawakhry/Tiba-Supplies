-- Phase 1 change 2: keep one immutable trip code for the entire booking lifecycle.
-- Status changes and redirection to another load order must retain the original code.
-- This trigger only guards bookings.trip_code; it does not touch driver tracking.

create or replace function public.enforce_booking_trip_code_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.trip_code is distinct from old.trip_code then
    raise exception 'TRIP_CODE_IMMUTABLE'
      using errcode = '23514',
            hint = 'A trip keeps its original code for its entire lifecycle. Update status or load_order_id without replacing trip_code.';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_trip_code_immutable on public.bookings;
create trigger bookings_trip_code_immutable
before update of trip_code on public.bookings
for each row
execute function public.enforce_booking_trip_code_immutable();

comment on function public.enforce_booking_trip_code_immutable() is
  'Prevents changing a trip code after creation; status transitions and load-order redirects retain the same booking code.';
comment on trigger bookings_trip_code_immutable on public.bookings is
  'Trip code is immutable from booking creation through delivery or cancellation.';
