-- Main Office paper-load import RPC. Apply only after reviewing the complete clean Shadow migration chain.
-- This migration is deliberately not applied to any Supabase project by this commit.

create unique index if not exists actual_loading_records_import_source_id_unique
  on public.actual_loading_records(source_file_name, source_record_id)
  where source_file_name is not null and source_record_id is not null;

create or replace function public.main_office_import_paper_loads(
  p_source_file_name text,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_row jsonb;
  v_index integer := 0;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_date date;
  v_weight numeric;
  v_vehicle_id uuid;
  v_driver_id uuid;
  v_factory_id uuid;
  v_quarry_id uuid;
  v_source_row integer;
  v_source_id text;
  v_ticket text;
  v_notes text;
  v_load_id uuid;
  v_errors jsonb := '[]'::jsonb;
begin
  v_actor := public.current_main_office_user();

  if p_source_file_name is null or length(trim(p_source_file_name)) < 1
     or length(trim(p_source_file_name)) > 240 then
    raise exception 'SOURCE_FILE_NAME_REQUIRED';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'PAPER_ROWS_MUST_BE_JSON_ARRAY';
  end if;
  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 2000 then
    raise exception 'PAPER_IMPORT_ROW_COUNT_OUT_OF_RANGE';
  end if;

  -- Validate the entire file before inserting anything, so a bad row cannot leave a partial import.
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_index := v_index + 1;
    begin
      v_source_row := nullif(trim(v_row->>'source_row_number'),'')::integer;
      if v_source_row is null or v_source_row < 1 then raise exception 'SOURCE_ROW_NUMBER_REQUIRED'; end if;
      v_date := nullif(trim(v_row->>'load_date'),'')::date;
      if v_date is null then raise exception 'LOAD_DATE_REQUIRED'; end if;
      v_weight := nullif(trim(v_row->>'actual_weight'),'')::numeric;
      if v_weight is null or v_weight <= 0 or v_weight > 1000 then raise exception 'ACTUAL_WEIGHT_OUT_OF_RANGE'; end if;
      if nullif(trim(v_row->>'vehicle_code'),'') is null
         or nullif(trim(v_row->>'driver_code'),'') is null
         or nullif(trim(v_row->>'factory_code'),'') is null
         or nullif(trim(v_row->>'quarry_code'),'') is null then
        raise exception 'VEHICLE_DRIVER_FACTORY_QUARRY_CODES_REQUIRED';
      end if;
      if nullif(trim(v_row->>'source_record_id'),'') is not null
         and length(trim(v_row->>'source_record_id')) > 200 then
        raise exception 'SOURCE_RECORD_ID_TOO_LONG';
      end if;
      if nullif(trim(v_row->>'ticket_number'),'') is not null
         and length(trim(v_row->>'ticket_number')) > 120 then
        raise exception 'TICKET_NUMBER_TOO_LONG';
      end if;
      if nullif(trim(v_row->>'notes'),'') is not null
         and length(trim(v_row->>'notes')) > 2000 then
        raise exception 'NOTES_TOO_LONG';
      end if;

      select vehicle_id into v_vehicle_id from public.vehicles
      where upper(trim(vehicle_code))=upper(trim(v_row->>'vehicle_code'));
      if v_vehicle_id is null then raise exception 'VEHICLE_CODE_NOT_FOUND'; end if;

      select driver_id into v_driver_id from public.drivers
      where upper(trim(driver_code))=upper(trim(v_row->>'driver_code'));
      if v_driver_id is null then raise exception 'DRIVER_CODE_NOT_FOUND'; end if;

      select factory_id into v_factory_id from public.factories
      where upper(trim(factory_code))=upper(trim(v_row->>'factory_code'));
      if v_factory_id is null then raise exception 'FACTORY_CODE_NOT_FOUND'; end if;

      select quarry_id into v_quarry_id from public.quarries
      where upper(trim(quarry_code))=upper(trim(v_row->>'quarry_code'));
      if v_quarry_id is null then raise exception 'QUARRY_CODE_NOT_FOUND'; end if;

      -- Existing source identity is a harmless idempotent duplicate; conflicting mappings are rejected.
      v_source_id := nullif(trim(v_row->>'source_record_id'),'');
      if exists (
        select 1 from public.actual_loading_records alr
        where alr.source_file_name=trim(p_source_file_name)
          and (alr.source_row_number=v_source_row
            or (v_source_id is not null and alr.source_record_id=v_source_id))
      ) then
        v_duplicates := v_duplicates + 1;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row',v_index,'source_row_number',nullif(v_row->>'source_row_number',''),
        'error',sqlerrm
      ));
    end;
  end loop;

  if jsonb_array_length(v_errors)>0 then
    return jsonb_build_object('ok',false,'inserted',0,'duplicates',0,
      'rejected',jsonb_array_length(v_errors),'errors',v_errors);
  end if;

  v_index := 0;
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_index := v_index + 1;
    v_source_row := (v_row->>'source_row_number')::integer;
    v_source_id := nullif(trim(v_row->>'source_record_id'),'');
    if exists (
      select 1 from public.actual_loading_records alr
      where alr.source_file_name=trim(p_source_file_name)
        and (alr.source_row_number=v_source_row
          or (v_source_id is not null and alr.source_record_id=v_source_id))
    ) then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    select vehicle_id into v_vehicle_id from public.vehicles
      where upper(trim(vehicle_code))=upper(trim(v_row->>'vehicle_code'));
    select driver_id into v_driver_id from public.drivers
      where upper(trim(driver_code))=upper(trim(v_row->>'driver_code'));
    select factory_id into v_factory_id from public.factories
      where upper(trim(factory_code))=upper(trim(v_row->>'factory_code'));
    select quarry_id into v_quarry_id from public.quarries
      where upper(trim(quarry_code))=upper(trim(v_row->>'quarry_code'));

    v_date := (v_row->>'load_date')::date;
    v_weight := (v_row->>'actual_weight')::numeric;
    v_ticket := nullif(trim(v_row->>'ticket_number'),'');
    v_notes := nullif(trim(v_row->>'notes'),'');

    insert into public.actual_loading_records(
      booking_id,actual_weight,ticket_number,scale_image_path,loaded_at,recorded_by,notes,
      load_date,vehicle_id,driver_id,quarry_id,factory_id,actual_weight_recorded_at,
      record_source,source_record_id,source_file_name,source_row_number,imported_at
    ) values (
      null,round(v_weight,3),v_ticket,null,(v_date::timestamp at time zone 'UTC'),null,v_notes,
      v_date,v_vehicle_id,v_driver_id,v_quarry_id,v_factory_id,now(),
      'PAPER_IMPORT',v_source_id,trim(p_source_file_name),v_source_row,now()
    ) returning actual_load_id into v_load_id;
    v_inserted := v_inserted + 1;
    perform public.write_audit_event('IMPORT_PAPER_LOADING_RECORD','ACTUAL_LOADING_RECORD',v_load_id,
      jsonb_build_object('source_file_name',trim(p_source_file_name),
        'source_row_number',v_source_row,'source_record_id',v_source_id,
        'vehicle_id',v_vehicle_id,'driver_id',v_driver_id,'factory_id',v_factory_id,
        'quarry_id',v_quarry_id,'load_date',v_date,'actual_weight',round(v_weight,3)));
  end loop;

  return jsonb_build_object('ok',true,'source_file_name',trim(p_source_file_name),
    'received',jsonb_array_length(p_rows),'inserted',v_inserted,'duplicates',v_duplicates,'rejected',0);
end;
$$;

revoke all on function public.main_office_import_paper_loads(text,jsonb) from public, anon, authenticated;
grant execute on function public.main_office_import_paper_loads(text,jsonb) to authenticated;

notify pgrst, 'reload schema';
