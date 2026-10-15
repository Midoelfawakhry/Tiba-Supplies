import { supabase } from '../lib/supabase';

export type LiveSnapshot = {
  // The primary operational office that creates load orders.
  office: Record<string, any> | null;
  operational_office: Record<string, any> | null;
  // The office where drivers explicitly check in.
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
    office: data?.operational_office ?? data?.office ?? null,
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
  const rawName = record?.name ?? record?.factory_name ?? record?.quarry_name;
  if (!rawName) return fallback;
  // Internal factory/quarry codes may be embedded in legacy display names (e.g. FAC-002 · الجوهرة).
  // Keep the code in the database, but show only the human-readable name in every UI using liveName.
  return String(rawName).replace(/^\s*(?:FAC|QRY|FACTORY|QUARRY)[-_ ]?\d+\s*[·•|:-]\s*/i, '').trim() || fallback;
}
