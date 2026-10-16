-- Preserve assignment history and release a vehicle when its driver is deactivated.
create or replace function public.close_driver_vehicle_assignment_on_deactivation()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if old.is_active=true and new.is_active=false then
  update public.driver_vehicle_assignments set ended_at=now()
  where driver_id=new.driver_id and ended_at is null;
 end if;
 return new;
end $$;
revoke all on function public.close_driver_vehicle_assignment_on_deactivation() from public,anon,authenticated;
-- Clean-baseline chain creates this trigger only once; no DROP is needed.
create trigger close_driver_vehicle_assignment_after_deactivation
after update of is_active on public.drivers
for each row execute function public.close_driver_vehicle_assignment_on_deactivation();