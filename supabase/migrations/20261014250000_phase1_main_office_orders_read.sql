-- Main Office read-only load-order list for Phase 1.
create or replace function public.main_office_get_orders()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid;
begin
 v_actor:=public.current_main_office_user();
 return coalesce((select jsonb_agg(jsonb_build_object(
 'load_order_id',lo.load_order_id,'order_number',lo.order_number,'factory_id',lo.factory_id,'factory_name',f.name,
 'quarry_id',lo.quarry_id,'quarry_name',q.name,'requested_quantity',lo.requested_quantity,'priority',lo.priority,
 'status',lo.status,'created_at',lo.created_at,'published_at',lo.published_at,'notes',lo.notes
 ) order by lo.created_at desc) from public.load_orders lo join public.factories f on f.factory_id=lo.factory_id
 join public.quarries q on q.quarry_id=lo.quarry_id),'[]'::jsonb);
end; $$;
revoke all on function public.main_office_get_orders() from public,anon,authenticated;
grant execute on function public.main_office_get_orders() to authenticated;
