-- Accelerate active driver lookups by vehicle for the multi-driver directory.
CREATE INDEX IF NOT EXISTS driver_vehicle_assignments_active_vehicle_idx
  ON public.driver_vehicle_assignments (vehicle_id)
  WHERE ended_at IS NULL;
