-- Tiba-Supplies Phase 1: allow multiple drivers to be assigned to one vehicle.
-- Keep the reverse invariant: each driver can have only one active vehicle assignment.
-- Keep booking-level protection: one active booking per vehicle.
DROP INDEX IF EXISTS public.driver_vehicle_one_active_vehicle;
