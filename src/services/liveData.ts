import { supabase } from '../lib/supabase';

export type LiveSnapshot = {
  office: Record<string, any> | null;
  operational_office: Record<string, any> | null;
  check_in_office: Record<string, any> | null;
  factories: Record<string, any>[];
  quarries: Record<string, any>[];
  load_orders: Record<string, any>[];
  bookings: Record<string, any>[];
  actual_loading_records: Record<string, any>[];
  drivers: Record<string, any>[];
  vehicles: Record<string, any>[];
};

export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const { data, error } = await supabase.rpc('get_phase1_snapshot');
  if (error) throw error;

  return {
    office: data?.office ?? data?.operational_office ?? null,
    operational_office: data?.operational_office ?? data?.office ?? null,
    check_in_office: data?.check_in_office ?? null,
    factories: data?.factories ?? [],
    quarries: data?.quarries ?? [],
    load_orders: data?.load_orders ?? [],
    bookings: data?.bookings ?? [],
    actual_loading_records: data?.actual_loading_records ?? [],
    drivers: data?.drivers ?? [],
    vehicles: data?.vehicles ?? [],
  };
}

export function liveName(record: Record<string, any> | undefined, fallback = 'غير محدد') {
  return record?.name ?? record?.factory_name ?? record?.quarry_name ?? fallback;
}
