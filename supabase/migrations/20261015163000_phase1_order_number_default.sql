-- Phase 1 hardening: ensure every load order receives a unique order number.
-- Shadow only; preserve existing order numbers and advance the sequence past existing data.
alter table public.load_orders
  alter column order_number set default nextval('public.load_orders_order_number_seq'::regclass);

select setval(
  'public.load_orders_order_number_seq'::regclass,
  greatest(coalesce((select max(order_number) from public.load_orders), 0), 1),
  coalesce((select max(order_number) from public.load_orders), 0) > 0
);

notify pgrst, 'reload schema';
