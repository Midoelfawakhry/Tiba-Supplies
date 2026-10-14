create or replace function public.main_office_cancel_load_order(p_load_order_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
 v_actor uuid;
 v_order public.load_orders%rowtype;
begin
 v_actor:=public.current_main_office_user();
 if p_load_order_id is null then raise exception 'LOAD_ORDER_ID_REQUIRED'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
 select * into v_order from public.load_orders where load_order_id=p_load_order_id for update;
 if not found then raise exception 'LOAD_ORDER_NOT_FOUND'; end if;
 if v_order.status in ('COMPLETED','CANCELLED') then raise exception 'LOAD_ORDER_NOT_CANCELLABLE'; end if;
 if exists(select 1 from public.bookings b where b.load_order_id=p_load_order_id and b.status in ('LOADING','LOADED','IN_TRANSIT','DELIVERED')) then
  raise exception 'TRIP_PROGRESS_PREVENTS_ORDER_CANCELLATION';
 end if;
 update public.bookings
 set status='CANCELLED',cancelled_at=now(),cancellation_reason=trim(p_reason),updated_at=now()
 where load_order_id=p_load_order_id and status in ('ASSIGNED','ARRIVED');
 update public.load_orders
 set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,cancellation_reason=trim(p_reason),updated_at=now()
 where load_order_id=p_load_order_id;
 perform public.write_audit_event('CANCEL_LOAD_ORDER','LOAD_ORDER',p_load_order_id,jsonb_build_object('reason',trim(p_reason)));
 return jsonb_build_object('load_order_id',p_load_order_id,'status','CANCELLED');
end $$;
revoke all on function public.main_office_cancel_load_order(uuid,text) from public,anon,authenticated;
grant execute on function public.main_office_cancel_load_order(uuid,text) to authenticated;