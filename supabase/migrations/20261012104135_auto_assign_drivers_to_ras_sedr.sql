-- Automatically assign active drivers to the Ras Sedr branch office.
-- Covers operational-driver creation and linking an auth account to an existing driver.
-- Never overrides an existing active office assignment.
CREATE OR REPLACE FUNCTION public.auto_assign_driver_to_ras_sedr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_office_id uuid;
BEGIN
  -- Run for a newly created driver, or when an existing driver's login is linked.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.auth_user_id IS NULL OR OLD.auth_user_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  -- Resolve the one active Ras Sedr branch by its configured canonical name.
  SELECT o.office_id
    INTO v_office_id
  FROM public.offices o
  WHERE o.name = 'مكتب طيبة للتوريدات - رأس سدر'
    AND o.office_type = 'BRANCH'
    AND o.is_active = true
  ORDER BY o.created_at NULLS LAST, o.office_id
  LIMIT 1;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_RAS_SEDR_OFFICE_NOT_FOUND';
  END IF;

  -- Preserve any active office assignment; only supply the default if none exists.
  IF NOT EXISTS (
    SELECT 1
    FROM public.driver_office_assignments doa
    WHERE doa.driver_id = NEW.driver_id
      AND doa.assigned_to IS NULL
  ) THEN
    INSERT INTO public.driver_office_assignments
      (driver_id, office_id, assigned_from, assigned_to)
    VALUES
      (NEW.driver_id, v_office_id, now(), NULL);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_assign_driver_ras_sedr_insert ON public.drivers;
CREATE TRIGGER trg_auto_assign_driver_ras_sedr_insert
AFTER INSERT ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_driver_to_ras_sedr();

DROP TRIGGER IF EXISTS trg_auto_assign_driver_ras_sedr_auth_link ON public.drivers;
CREATE TRIGGER trg_auto_assign_driver_ras_sedr_auth_link
AFTER UPDATE OF auth_user_id ON public.drivers
FOR EACH ROW
WHEN (OLD.auth_user_id IS NULL AND NEW.auth_user_id IS NOT NULL)
EXECUTE FUNCTION public.auto_assign_driver_to_ras_sedr();

COMMENT ON FUNCTION public.auto_assign_driver_to_ras_sedr() IS
  'Assigns new active drivers to the active Ras Sedr branch only when they have no active office assignment.';
