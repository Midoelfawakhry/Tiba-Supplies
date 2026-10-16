-- Phase 1 hardening: persist the truthful outcome for every driver choice
-- and notify winners/losers after the five-minute dispatch window finalizes.
-- Shadow only; no synthetic operational rows are created.

ALTER TABLE public.driver_load_choices
  ADD COLUMN IF NOT EXISTS outcome_reason text;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.driver_load_choices'::regclass
      AND conname='driver_load_choices_outcome_reason_check'
  ) THEN
    ALTER TABLE public.driver_load_choices
      ADD CONSTRAINT driver_load_choices_outcome_reason_check
      CHECK (outcome_reason IS NULL OR outcome_reason IN (
        'DRIVER_OR_QUEUE_NO_LONGER_ELIGIBLE',
        'LOCATION_STALE_OR_INACCURATE',
        'OUTSIDE_GEOFENCE',
        'DRIVER_OR_VEHICLE_UNAVAILABLE',
        'LOAD_NO_LONGER_AVAILABLE',
        'QUANTITY_FILLED'
      ));
  END IF;
END;
$constraint$;

CREATE OR REPLACE FUNCTION public.finalize_dispatch_choice_not_allocated(
  p_choice_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_choice public.driver_load_choices%rowtype;
  v_body text;
BEGIN
  IF p_reason NOT IN (
    'DRIVER_OR_QUEUE_NO_LONGER_ELIGIBLE',
    'LOCATION_STALE_OR_INACCURATE',
    'OUTSIDE_GEOFENCE',
    'DRIVER_OR_VEHICLE_UNAVAILABLE',
    'LOAD_NO_LONGER_AVAILABLE',
    'QUANTITY_FILLED'
  ) THEN
    RAISE EXCEPTION 'INVALID_DISPATCH_OUTCOME_REASON';
  END IF;

  UPDATE public.driver_load_choices
  SET status='NOT_ALLOCATED', outcome_reason=p_reason,
      finalized_at=coalesce(finalized_at,now()), updated_at=now()
  WHERE choice_id=p_choice_id AND status='CHOSEN'
  RETURNING * INTO v_choice;

  IF NOT FOUND THEN RETURN; END IF;

  v_body := CASE p_reason
    WHEN 'DRIVER_OR_QUEUE_NO_LONGER_ELIGIBLE'
      THEN 'لم يتم تخصيص النقلة لك لأن حالة حساب السائق أو قائمة الانتظار لم تعد مؤهلة وقت التوزيع.'
    WHEN 'LOCATION_STALE_OR_INACCURATE'
      THEN 'لم يتم تخصيص النقلة لك لأن الموقع لم يعد حديثًا أو دقيقًا وقت التوزيع. حدّث موقعك وسجّل الوصول من جديد.'
    WHEN 'OUTSIDE_GEOFENCE'
      THEN 'لم يتم تخصيص النقلة لك لأن موقعك وقت التوزيع كان خارج نطاق مكتب رأس سدر.'
    WHEN 'DRIVER_OR_VEHICLE_UNAVAILABLE'
      THEN 'لم يتم تخصيص النقلة لك لأن السائق أو العربية لم يعد مستوفيًا لشروط التوزيع.'
    WHEN 'QUANTITY_FILLED'
      THEN 'لم يتم تخصيص النقلة لك لأن الكمية المطلوبة اكتملت قبل اعتماد اختيارك.'
    ELSE 'لم يتم تخصيص النقلة لك لأن طلب التحميل لم يعد متاحًا وقت انتهاء نافذة الاختيار.'
  END;

  INSERT INTO public.notifications(
    recipient_driver_id,notification_type,title,body,payload
  )
  VALUES (
    v_choice.driver_id,'LOAD_REQUEST_NOT_ALLOCATED','لم يتم تخصيص النقلة',
    v_body,
    jsonb_build_object(
      'choice_id',v_choice.choice_id,
      'load_order_id',v_choice.load_order_id,
      'dispatch_window_id',v_choice.dispatch_window_id,
      'outcome_reason',p_reason,
      'finalized_at',v_choice.finalized_at
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_dispatch_choice_not_allocated(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_dispatch_choice_not_allocated(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_expired_dispatch_windows()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_window public.dispatch_windows%rowtype;
  v_choice public.driver_load_choices%rowtype;
  v_entry public.waiting_list_entries%rowtype;
  v_driver public.drivers%rowtype;
  v_order public.load_orders%rowtype;
  v_office public.offices%rowtype;
  v_location public.driver_live_locations%rowtype;
  v_vehicle_id uuid;
  v_booking_id uuid;
  v_trip_code text;
  v_distance_m double precision;
  v_allocated integer := 0;
  v_reason text;
  v_factory_name text;
  v_quarry_name text;
BEGIN
  FOR v_window IN
    SELECT * FROM public.dispatch_windows
    WHERE status='OPEN' AND selection_ends_at<=now()
    ORDER BY selection_ends_at,opened_at
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO v_office FROM public.offices WHERE office_id=v_window.office_id;
    IF NOT FOUND THEN
      UPDATE public.dispatch_windows
      SET status='CANCELLED',closed_at=now()
      WHERE dispatch_window_id=v_window.dispatch_window_id;
      FOR v_choice IN SELECT * FROM public.driver_load_choices
        WHERE dispatch_window_id=v_window.dispatch_window_id AND status='CHOSEN'
      LOOP
        PERFORM public.finalize_dispatch_choice_not_allocated(
          v_choice.choice_id,'LOAD_NO_LONGER_AVAILABLE'
        );
      END LOOP;
      CONTINUE;
    END IF;

    FOR v_choice IN
      SELECT c.*
      FROM public.driver_load_choices c
      JOIN public.waiting_list_entries w ON w.entry_id=c.queue_entry_id
      WHERE c.dispatch_window_id=v_window.dispatch_window_id AND c.status='CHOSEN'
      ORDER BY w.arrived_at ASC,w.entry_id ASC,c.chosen_at ASC,c.choice_id ASC
      FOR UPDATE OF c
    LOOP
      v_reason := NULL;

      SELECT * INTO v_entry
      FROM public.waiting_list_entries
      WHERE entry_id=v_choice.queue_entry_id
      FOR UPDATE;

      SELECT * INTO v_driver
      FROM public.drivers
      WHERE driver_id=v_choice.driver_id AND is_active=true
      FOR UPDATE;

      IF NOT FOUND OR v_entry.status<>'WAITING' THEN
        v_reason := 'DRIVER_OR_QUEUE_NO_LONGER_ELIGIBLE';
      END IF;

      IF v_reason IS NULL THEN
        SELECT * INTO v_location
        FROM public.driver_live_locations
        WHERE driver_id=v_driver.driver_id;

        IF NOT FOUND
          OR v_location.captured_at<now()-interval '10 minutes'
          OR v_location.captured_at>now()+interval '1 minute'
          OR v_location.accuracy_m IS NULL
          OR v_location.accuracy_m>100 THEN
          v_reason := 'LOCATION_STALE_OR_INACCURATE';
        ELSE
          v_distance_m := 6371000*2*asin(sqrt(least(1,greatest(0,
            power(sin(radians(v_location.latitude-v_office.latitude)/2),2)
            +cos(radians(v_office.latitude))*cos(radians(v_location.latitude))
            *power(sin(radians(v_location.longitude-v_office.longitude)/2),2)
          )))));
          IF v_distance_m>coalesce(v_office.geofence_radius_m,10000) THEN
            v_reason := 'OUTSIDE_GEOFENCE';
          END IF;
        END IF;
      END IF;

      IF v_reason IS NULL THEN
        SELECT v.vehicle_id INTO v_vehicle_id
        FROM public.driver_vehicle_assignments a
        JOIN public.vehicles v ON v.vehicle_id=a.vehicle_id
        WHERE a.driver_id=v_driver.driver_id AND a.ended_at IS NULL
          AND v.is_active=true AND v.office_id=v_office.office_id
        LIMIT 1 FOR UPDATE OF v;

        IF v_vehicle_id IS NULL
          OR EXISTS(SELECT 1 FROM public.bookings b
            WHERE b.driver_id=v_driver.driver_id
              AND b.status IN ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT'))
          OR EXISTS(SELECT 1 FROM public.bookings b
            WHERE b.vehicle_id=v_vehicle_id
              AND b.status IN ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) THEN
          v_reason := 'DRIVER_OR_VEHICLE_UNAVAILABLE';
        END IF;
      END IF;

      IF v_reason IS NULL THEN
        SELECT * INTO v_order
        FROM public.load_orders
        WHERE load_order_id=v_choice.load_order_id
        FOR UPDATE;

        IF NOT FOUND
          OR v_order.dispatch_window_id<>v_window.dispatch_window_id
          OR v_order.status NOT IN ('PUBLISHED','IN_PROGRESS') THEN
          v_reason := 'LOAD_NO_LONGER_AVAILABLE';
        ELSIF (SELECT count(*) FROM public.bookings b
               WHERE b.load_order_id=v_order.load_order_id AND b.status<>'CANCELLED')
               >=v_order.requested_quantity THEN
          v_reason := 'QUANTITY_FILLED';
        END IF;
      END IF;

      IF v_reason IS NOT NULL THEN
        PERFORM public.finalize_dispatch_choice_not_allocated(v_choice.choice_id,v_reason);
        CONTINUE;
      END IF;

      SELECT f.name,q.name INTO v_factory_name,v_quarry_name
      FROM public.factories f,public.quarries q
      WHERE f.factory_id=v_order.factory_id AND q.quarry_id=v_order.quarry_id;

      v_trip_code := format('TIBA-%s',upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));

      INSERT INTO public.bookings(
        load_order_id,driver_id,vehicle_id,assigned_by,assignment_type,status,
        trip_code,direct_acceptance_status
      ) VALUES (
        v_order.load_order_id,v_driver.driver_id,v_vehicle_id,v_order.created_by,
        'QUEUE','ASSIGNED',v_trip_code,'NOT_REQUIRED'
      ) RETURNING booking_id INTO v_booking_id;

      UPDATE public.driver_load_choices
      SET status='ALLOCATED',outcome_reason=NULL,assigned_booking_id=v_booking_id,
          finalized_at=now(),updated_at=now()
      WHERE choice_id=v_choice.choice_id;

      UPDATE public.waiting_list_entries
      SET status='ASSIGNED',assigned_at=now(),updated_at=now()
      WHERE entry_id=v_entry.entry_id;

      UPDATE public.load_orders
      SET status='IN_PROGRESS',updated_at=now()
      WHERE load_order_id=v_order.load_order_id AND status='PUBLISHED';

      INSERT INTO public.notifications(
        recipient_driver_id,notification_type,title,body,payload
      ) VALUES (
        v_driver.driver_id,'LOAD_REQUEST_ACCEPTED','تم إسناد النقلة إليك بنجاح',
        format(
          'تم إسناد النقلة إليك بنجاح. برجاء التوجه إلى محجر %s للتحميل لصالح مصنع %s. كود النقلة: %s.',
          coalesce(v_quarry_name,'غير محدد'),coalesce(v_factory_name,'غير محدد'),v_trip_code
        ),
        jsonb_build_object(
          'choice_id',v_choice.choice_id,'booking_id',v_booking_id,
          'load_order_id',v_order.load_order_id,'trip_code',v_trip_code,
          'factory_name',v_factory_name,'quarry_name',v_quarry_name,
          'dispatch_window_id',v_window.dispatch_window_id
        )
      );

      INSERT INTO public.audit_log(
        actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details
      ) VALUES (
        NULL,NULL,'QUEUE_LOAD_ALLOCATED','BOOKING',v_booking_id,
        jsonb_build_object(
          'driver_id',v_driver.driver_id,'queue_entry_id',v_entry.entry_id,
          'choice_id',v_choice.choice_id,'load_order_id',v_order.load_order_id,
          'dispatch_window_id',v_window.dispatch_window_id,'trip_code',v_trip_code,
          'queue_arrived_at',v_entry.arrived_at,'chosen_at',v_choice.chosen_at
        )
      );

      v_allocated := v_allocated+1;
    END LOOP;

    -- Choices whose queue entry disappeared are still finalized with a persisted reason.
    FOR v_choice IN
      SELECT * FROM public.driver_load_choices
      WHERE dispatch_window_id=v_window.dispatch_window_id AND status='CHOSEN'
    LOOP
      PERFORM public.finalize_dispatch_choice_not_allocated(
        v_choice.choice_id,'DRIVER_OR_QUEUE_NO_LONGER_ELIGIBLE'
      );
    END LOOP;

    UPDATE public.waiting_list_entries w
    SET status='LEFT',left_at=now(),updated_at=now()
    WHERE w.office_id=v_window.office_id AND w.status='WAITING'
      AND EXISTS (
        SELECT 1 FROM public.driver_load_choices c
        WHERE c.dispatch_window_id=v_window.dispatch_window_id
          AND c.queue_entry_id=w.entry_id
      );

    UPDATE public.dispatch_windows
    SET status='CLOSED',closed_at=now()
    WHERE dispatch_window_id=v_window.dispatch_window_id;
  END LOOP;

  RETURN v_allocated;
END;
$function$;

CREATE OR REPLACE FUNCTION public.driver_get_dispatch_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_driver public.drivers%rowtype;
  v_office public.offices%rowtype;
  v_location public.driver_live_locations%rowtype;
  v_entry public.waiting_list_entries%rowtype;
  v_window public.dispatch_windows%rowtype;
  v_choice public.driver_load_choices%rowtype;
  v_distance_m double precision;
  v_inside boolean := false;
  v_position integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  SELECT * INTO v_driver FROM public.drivers
  WHERE auth_user_id=auth.uid() AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'DRIVER_NOT_FOUND' USING errcode='42501'; END IF;

  SELECT * INTO v_office FROM public.offices
  WHERE office_code='RAS_SEDR' AND office_type='BRANCH' AND is_active=true;
  IF NOT FOUND OR v_office.latitude IS NULL OR v_office.longitude IS NULL THEN
    RAISE EXCEPTION 'RAS_SEDR_GEOFENCE_NOT_CONFIGURED';
  END IF;

  SELECT * INTO v_location FROM public.driver_live_locations WHERE driver_id=v_driver.driver_id;
  IF FOUND AND v_location.captured_at>=now()-interval '10 minutes'
    AND v_location.captured_at<=now()+interval '1 minute'
    AND v_location.accuracy_m IS NOT NULL AND v_location.accuracy_m<=100 THEN
    v_distance_m:=6371000*2*asin(sqrt(least(1,greatest(0,
      power(sin(radians(v_location.latitude-v_office.latitude)/2),2)
      +cos(radians(v_office.latitude))*cos(radians(v_location.latitude))
      *power(sin(radians(v_location.longitude-v_office.longitude)/2),2)
    )))));
    v_inside:=v_distance_m<=coalesce(v_office.geofence_radius_m,10000);
  END IF;

  SELECT * INTO v_entry FROM public.waiting_list_entries
  WHERE driver_id=v_driver.driver_id AND office_id=v_office.office_id AND status='WAITING'
  ORDER BY arrived_at DESC LIMIT 1;

  IF FOUND THEN
    SELECT count(*)::integer+1 INTO v_position
    FROM public.waiting_list_entries w
    WHERE w.office_id=v_office.office_id AND w.status='WAITING'
      AND (w.arrived_at<v_entry.arrived_at OR (w.arrived_at=v_entry.arrived_at AND w.entry_id<v_entry.entry_id));
  END IF;

  SELECT * INTO v_window FROM public.dispatch_windows
  WHERE office_id=v_office.office_id ORDER BY opened_at DESC LIMIT 1;
  SELECT * INTO v_choice FROM public.driver_load_choices c
  WHERE c.driver_id=v_driver.driver_id AND c.dispatch_window_id=v_window.dispatch_window_id
  ORDER BY c.chosen_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'inside_geofence',v_inside,'distance_m',v_distance_m,
    'radius_m',coalesce(v_office.geofence_radius_m,10000),
    'location_updated_at',v_location.captured_at,'office_name',v_office.name,
    'queue_status',CASE
      WHEN NOT v_inside THEN 'OUTSIDE'
      WHEN v_entry.entry_id IS NOT NULL THEN 'WAITING'
      WHEN EXISTS(SELECT 1 FROM public.waiting_list_entries w
        WHERE w.driver_id=v_driver.driver_id AND w.office_id=v_office.office_id
          AND w.status='ASSIGNED' AND w.assigned_at>now()-interval '1 day') THEN 'ASSIGNED'
      ELSE 'NOT_REGISTERED' END,
    'queue_position',v_position,'queue_arrived_at',v_entry.arrived_at,
    'selection_window',CASE WHEN v_window.dispatch_window_id IS NULL THEN NULL ELSE jsonb_build_object(
      'dispatch_window_id',v_window.dispatch_window_id,'status',v_window.status,
      'opened_at',v_window.opened_at,'selection_ends_at',v_window.selection_ends_at,
      'closed_at',v_window.closed_at,'is_open',v_window.status='OPEN' AND now()<v_window.selection_ends_at
    ) END,
    'selected_load_order_id',v_choice.load_order_id,'choice_status',v_choice.status,
    'choice_outcome_reason',v_choice.outcome_reason,'chosen_at',v_choice.chosen_at,
    'available_loads',CASE
      WHEN v_inside AND v_entry.entry_id IS NOT NULL
        AND v_window.status='OPEN' AND now()<v_window.selection_ends_at
      THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'load_order_id',lo.load_order_id,'order_number',lo.order_number,
          'factory_name',f.name,'quarry_name',q.name,'factory_id',f.factory_id,'quarry_id',q.quarry_id,
          'requested_quantity',lo.requested_quantity,
          'committed_quantity',(SELECT count(*) FROM public.bookings b WHERE b.load_order_id=lo.load_order_id AND b.status<>'CANCELLED'),
          'remaining_quantity',greatest(0,lo.requested_quantity-(SELECT count(*) FROM public.bookings b WHERE b.load_order_id=lo.load_order_id AND b.status<>'CANCELLED')),
          'priority',lo.priority,'status',lo.status,'selection_ends_at',v_window.selection_ends_at,
          'is_selected',v_choice.load_order_id=lo.load_order_id AND v_choice.status='CHOSEN'
        ) ORDER BY lo.priority ASC,lo.created_at ASC)
        FROM public.load_orders lo
        JOIN public.factories f ON f.factory_id=lo.factory_id
        JOIN public.quarries q ON q.quarry_id=lo.quarry_id
        WHERE lo.dispatch_window_id=v_window.dispatch_window_id
          AND lo.status IN ('PUBLISHED','IN_PROGRESS')
          AND (SELECT count(*) FROM public.bookings b WHERE b.load_order_id=lo.load_order_id AND b.status<>'CANCELLED')<lo.requested_quantity
      ),'[]'::jsonb)
      ELSE '[]'::jsonb END,
    'notifications',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'notification_id',n.notification_id,'notification_type',n.notification_type,
        'title',n.title,'body',n.body,'created_at',n.created_at,'payload',n.payload
      ) ORDER BY n.created_at DESC)
      FROM (
        SELECT * FROM public.notifications
        WHERE recipient_driver_id=v_driver.driver_id
          AND notification_type IN ('LOAD_SELECTION_OPEN','LOAD_REQUEST_ACCEPTED','LOAD_REQUEST_NOT_ALLOCATED')
          AND created_at>=now()-interval '24 hours'
        ORDER BY created_at DESC LIMIT 5
      ) n
    ),'[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_expired_dispatch_windows() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_expired_dispatch_windows() TO service_role;
GRANT EXECUTE ON FUNCTION public.driver_get_dispatch_state() TO authenticated;

NOTIFY pgrst, 'reload schema';
