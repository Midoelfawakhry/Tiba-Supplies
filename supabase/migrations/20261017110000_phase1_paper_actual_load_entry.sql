-- Secure Main Office entry for actual loading transcribed from paper.
-- Apply only after the clean Shadow migration chain and schema reconciliation have passed.
create or replace function public.main_office_record_paper_actual_load(
  p_load_date date,
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_factory_id uuid,
  p_quarry_id uuid,
  p_actual_weight numeric,
  p_ticket_number text default null,
  p_notes text default null,
  p_source_file_name text default null,
  p_source_row_number integer default null,
  p_source_record_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_existing public.actual_loading_records%rowtype;
  v_actual public.actual_loading_records%rowtype;
  v_weight numeric(12,3) := round(p_actual_weight,3);
begin
  v_actor := public.current_main_office_user();
  if p_load_date is null then raise exception 'PAPER_LOAD_DATE_REQUIRED'; end if;
  if p_vehicle_id is null or p_driver_id is null or p_factory_id is null or p_quarry_id is null then
    raise exception 'PAPER_LOAD_DIRECTORY_FIELDS_REQUIRED';
  end if;
  if p_actual_weight is null or p_actual_weight <= 0 or p_actual_weight > 1000 then
    raise exception 'PAPER_LOAD_WEIGHT_INVALID';
  end if;
  if p_ticket_number is not null and length(trim(p_ticket_number)) > 120 then
    raise exception 'PAPER_LOAD_TICKET_TOO_LONG';
  end if;
  if p_notes is not null and length(trim(p_notes)) > 2000 then
    raise exception 'PAPER_LOAD_NOTES_TOO_LONG';
  end if;
  if p_source_file_name is not null and length(trim(p_source_file_name)) > 255 then
    raise exception 'PAPER_SOURCE_FILE_NAME_TOO_LONG';
  end if;
  if (p_source_file_name is null) <> (p_source_row_number is null) then
    raise exception 'PAPER_SOURCE_FILE_AND_ROW_REQUIRED_TOGETHER';
  end if;
  if p_source_row_number is not null and p_source_row_number < 1 then
    raise exception 'PAPER_SOURCE_ROW_INVALID';
  end if;
  if p_source_record_id is not null and length(trim(p_source_record_id)) > 200 then
    raise exception 'PAPER_SOURCE_RECORD_ID_TOO_LONG';
  end if;

  if not exists (select 1 from public.vehicles where vehicle_id=p_vehicle_id) then
    raise exception 'PAPER_LOAD_VEHICLE_NOT_FOUND';
  end if;
  if not exists (select 1 from public.drivers where driver_id=p_driver_id) then
    raise exception 'PAPER_LOAD_DRIVER_NOT_FOUND';
  end if;
  if not exists (select 1 from public.factories where factory_id=p_factory_id) then
    raise exception 'PAPER_LOAD_FACTORY_NOT_FOUND';
  end if;
  if not exists (select 1 from public.quarries where quarry_id=p_quarry_id) then
    raise exception 'PAPER_LOAD_QUARRY_NOT_FOUND';
  end if;

  if p_source_file_name is not null then
    select * into v_existing from public.actual_loading_records
    where record_source='PAPER_IMPORT'
      and source_file_name=trim(p_source_file_name)
      and source_row_number=p_source_row_number
    limit 1;
    if found then
      return jsonb_build_object('created',false,'duplicate',true,'actual_load_id',v_existing.actual_load_id,
        'trip_code',v_existing.trip_code,'daily_load_number',v_existing.daily_load_number);
    end if;
  end if;
  if p_source_record_id is not null then
    select * into v_existing from public.actual_loading_records
    where record_source='PAPER_IMPORT' and source_record_id=trim(p_source_record_id)
    limit 1;
    if found then
      return jsonb_build_object('created',false,'duplicate',true,'actual_load_id',v_existing.actual_load_id,
        'trip_code',v_existing.trip_code,'daily_load_number',v_existing.daily_load_number);
    end if;
  end if;

  insert into public.actual_loading_records(
    booking_id, actual_weight, ticket_number, loaded_at, recorded_by, notes,
    load_date, vehicle_id, driver_id, quarry_id, factory_id, record_source,
    source_record_id, source_file_name, source_row_number, imported_at
  ) values (
    null, v_weight, nullif(trim(p_ticket_number), ''),
    (p_load_date::timestamp + time '12:00') at time zone 'Africa/Cairo',
    v_actor, nullif(trim(p_notes), ''),
    p_load_date, p_vehicle_id, p_driver_id, p_quarry_id, p_factory_id, 'PAPER_IMPORT',
    nullif(trim(p_source_record_id), ''), nullif(trim(p_source_file_name), ''),
    p_source_row_number, case when p_source_file_name is not null or p_source_record_id is not null then now() else null end
  ) returning * into v_actual;

  perform public.write_audit_event('PAPER_ACTUAL_LOAD_RECORDED','ACTUAL_LOADING_RECORD',v_actual.actual_load_id,
    jsonb_build_object('load_date',p_load_date,'vehicle_id',p_vehicle_id,'driver_id',p_driver_id,
      'factory_id',p_factory_id,'quarry_id',p_quarry_id,'actual_weight',v_weight,
      'source_file_name',nullif(trim(p_source_file_name), ''),
      'source_row_number',p_source_row_number,'source_record_id',nullif(trim(p_source_record_id), '')));

  return jsonb_build_object('created',true,'duplicate',false,'actual_load_id',v_actual.actual_load_id,
    'trip_code',v_actual.trip_code,'daily_load_number',v_actual.daily_load_number,
    'load_date',v_actual.load_date,'actual_weight',v_actual.actual_weight);
end;
$$;

revoke all on function public.main_office_record_paper_actual_load(date,uuid,uuid,uuid,uuid,numeric,text,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.main_office_record_paper_actual_load(date,uuid,uuid,uuid,uuid,numeric,text,text,text,integer,text) to authenticated;

notify pgrst, 'reload schema';
