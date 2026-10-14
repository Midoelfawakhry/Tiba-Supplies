-- Phase 1: branch users are read-only identities scoped to the Ras Sedr office.
-- Shadow only. No operational rows or credentials are seeded.
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check
  check (role in ('ADMIN','HEAD_OFFICE','BRANCH'));

create or replace function public.current_ras_sedr_branch_user()
returns uuid language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_user_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select au.user_id into v_user_id from public.app_users au join public.offices o on o.office_id=au.office_id
 where au.auth_user_id=auth.uid() and au.is_active=true and au.role='BRANCH'
 and o.office_code='RAS_SEDR' and o.office_type='BRANCH' and o.is_active=true;
 if v_user_id is null then raise exception 'BRANCH_ACCOUNT_REQUIRED' using errcode='42501'; end if;
 return v_user_id;
end; $$;

create or replace function public.branch_get_snapshot()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_office public.offices%rowtype;
begin
 v_actor:=public.current_ras_sedr_branch_user();
 select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
 if not found then raise exception 'BRANCH_OFFICE_INACTIVE'; end if;
 return jsonb_build_object(
 'office',jsonb_build_object('office_id',v_office.office_id,'office_code',v_office.office_code,'name',v_office.name,'latitude',v_office.latitude,'longitude',v_office.longitude,'geofence_radius_m',v_office.geofence_radius_m),
 'available_loads',coalesce((select jsonb_agg(jsonb_build_object('load_order_id',lo.load_order_id,'order_number',lo.order_number,'factory_id',f.factory_id,'factory_name',f.name,'quarry_id',q.quarry_id,'quarry_name',q.name,'requested_quantity',lo.requested_quantity,'committed_quantity',coalesce(x.committed_quantity,0),'priority',lo.priority,'status',lo.status,'created_at',lo.created_at,'published_at',lo.published_at,'notes',lo.notes) order by lo.priority asc,lo.created_at asc)
 from public.load_orders lo join public.factories f on f.factory_id=lo.factory_id join public.quarries q on q.quarry_id=lo.quarry_id
 left join lateral (select count(*)::integer as committed_quantity from public.bookings b where b.load_order_id=lo.load_order_id and b.status<>'CANCELLED') x on true
 where lo.status in ('PUBLISHED','IN_PROGRESS')),'[]'::jsonb),
 'allocations',coalesce((select jsonb_agg(jsonb_build_object('booking_id',b.booking_id,'load_order_id',b.load_order_id,'order_number',lo.order_number,'driver_id',d.driver_id,'driver_name',d.name,'driver_code',d.driver_code,'driver_phone',d.phone,'vehicle_id',v.vehicle_id,'plate_number',v.plate_number,'vehicle_code',v.vehicle_code,'factory_name',f.name,'quarry_name',q.name,'trip_code',b.trip_code,'status',b.status,'assignment_type',b.assignment_type,'assigned_at',b.assigned_at,'arrived_at',b.arrived_at) order by b.assigned_at desc)
 from public.bookings b join public.drivers d on d.driver_id=b.driver_id join public.vehicles v on v.vehicle_id=b.vehicle_id join public.load_orders lo on lo.load_order_id=b.load_order_id join public.factories f on f.factory_id=lo.factory_id join public.quarries q on q.quarry_id=lo.quarry_id
 where d.office_id=v.office_id and d.office_id=v_office.office_id),'[]'::jsonb),
 'actual_loading_records',coalesce((select jsonb_agg(jsonb_build_object('actual_load_id',al.actual_load_id,'booking_id',al.booking_id,'actual_weight',al.actual_weight,'ticket_number',al.ticket_number,'loaded_at',al.loaded_at,'notes',al.notes,'driver_name',d.name,'plate_number',v.plate_number,'factory_name',f.name,'quarry_name',q.name,'trip_code',b.trip_code,'order_number',lo.order_number) order by al.loaded_at desc)
 from public.actual_loading_records al join public.bookings b on b.booking_id=al.booking_id join public.drivers d on d.driver_id=b.driver_id join public.vehicles v on v.vehicle_id=b.vehicle_id join public.load_orders lo on lo.load_order_id=b.load_order_id join public.factories f on f.factory_id=lo.factory_id join public.quarries q on q.quarry_id=lo.quarry_id
 where d.office_id=v_office.office_id and v.office_id=v_office.office_id),'[]'::jsonb),
 'waiting_list','[]'::jsonb,
 'directory',coalesce((select jsonb_agg(jsonb_build_object('driver_id',d.driver_id,'driver_code',d.driver_code,'name',d.name,'phone',d.phone,'is_active',d.is_active,'plate_number',v.plate_number,'vehicle_code',v.vehicle_code))
 from public.drivers d left join public.bookings b on b.driver_id=d.driver_id and b.status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT') left join public.vehicles v on v.vehicle_id=b.vehicle_id
 where d.office_id=v_office.office_id and d.is_active=true),'[]'::jsonb));
end; $$;

revoke all on function public.current_ras_sedr_branch_user() from public,anon,authenticated;
grant execute on function public.current_ras_sedr_branch_user() to authenticated;
revoke all on function public.branch_get_snapshot() from public,anon,authenticated;
grant execute on function public.branch_get_snapshot() to authenticated;
