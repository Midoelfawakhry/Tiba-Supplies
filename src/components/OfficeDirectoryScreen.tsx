import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Mountain, Users, Truck, ClipboardCheck, ClipboardList, Clock3, RefreshCw, AlertTriangle } from 'lucide-react';
import { getLiveSnapshot, LiveSnapshot, liveName } from '../services/liveData';
import { supabase } from '../lib/supabase';

type ScreenKey = 'factories' | 'quarries' | 'drivers' | 'vehicles' | 'waiting' | 'loads' | 'actual';
type Row = Record<string, any>;
const tabs: { key: ScreenKey; label: string; icon: React.ElementType }[] = [
  { key: 'factories', label: 'المصانع والعملاء', icon: Building2 },
  { key: 'quarries', label: 'المحاجر والخامات', icon: Mountain },
  { key: 'drivers', label: 'السائقون', icon: Users },
  { key: 'vehicles', label: 'أسطول السيارات', icon: Truck },
  { key: 'waiting', label: 'قائمة انتظار رأس سدر', icon: Clock3 },
  { key: 'loads', label: 'أوامر التحميل', icon: ClipboardList },
  { key: 'actual', label: 'التحميل الفعلي', icon: ClipboardCheck },
];

function rowTitle(row: Row, key: ScreenKey) {
  if (key === 'factories' || key === 'quarries') return liveName(row);
  if (key === 'drivers') return row.name ?? row.driver_name ?? 'سائق بدون اسم';
  if (key === 'vehicles') return row.plate_number ?? row.vehicle_code ?? 'عربية بدون لوحة';
  if (key === 'waiting') return row.plate_number ?? row.driver_name ?? 'عنصر انتظار';
  if (key === 'loads') return liveName(row, row.load_order_id ?? 'أمر تحميل');
  return row.ticket_number ?? row.record_number ?? row.actual_loading_record_id ?? 'سجل تحميل فعلي';
}
function rowDetails(row: Row, key: ScreenKey) {
  if (key === 'factories') return [row.client_name, row.address, row.phone].filter(Boolean).join(' · ');
  if (key === 'quarries') return [row.region, row.materials_available?.join?.('، '), row.address].filter(Boolean).join(' · ');
  if (key === 'drivers') return [row.phone, row.driver_code, row.is_active === false ? 'غير نشط' : 'نشط'].filter(Boolean).join(' · ');
  if (key === 'vehicles') return [row.truck_type ?? row.vehicle_type, row.capacity_tons ? row.capacity_tons + ' طن' : '', row.is_active === false ? 'غير نشطة' : 'نشطة'].filter(Boolean).join(' · ');
  if (key === 'waiting') return [row.driver_name, row.status, row.arrived_at ? new Date(row.arrived_at).toLocaleString('ar-EG') : ''].filter(Boolean).join(' · ');
  if (key === 'loads') return [row.status, row.requested_quantity ? 'المطلوب: ' + row.requested_quantity : '', row.created_at ? new Date(row.created_at).toLocaleString('ar-EG') : ''].filter(Boolean).join(' · ');
  return [row.load_date, row.driver_id ? 'معرّف السائق: ' + row.driver_id : '', row.vehicle_id ? 'معرّف العربية: ' + row.vehicle_id : '', row.created_at ? new Date(row.created_at).toLocaleString('ar-EG') : ''].filter(Boolean).join(' · ');
}

export const OfficeDirectoryScreen: React.FC = () => {
  const [active, setActive] = useState<ScreenKey>('factories');
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [waiting, setWaiting] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLiveSnapshot();
      setSnapshot(data);
      const { data: waitingData, error: waitingError } = await supabase.rpc('get_office_waiting_list');
      if (waitingError) throw waitingError;
      setWaiting(Array.isArray(waitingData) ? waitingData : []);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل دليل بيانات المكتب.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const lists: Record<ScreenKey, Row[]> = {
    factories: snapshot?.factories ?? [],
    quarries: snapshot?.quarries ?? [],
    drivers: snapshot?.drivers ?? [],
    vehicles: snapshot?.vehicles ?? [],
    waiting,
    loads: snapshot?.load_orders ?? [],
    actual: snapshot?.actual_loading_records ?? [],
  };
  const rows = lists[active] ?? [];
  const ActiveIcon = tabs.find(tab => tab.key === active)?.icon ?? ClipboardList;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="text-xl font-black">شاشات إدارة المكتب</h2><p className="mt-1 text-sm leading-6 text-slate-500">دليل موحّد لبيانات التشغيل الحقيقية المحمّلة من Supabase.</p></div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-bold disabled:opacity-60"><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/> تحديث البيانات</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const selected = active === tab.key;
          return <button key={tab.key} type="button" onClick={() => setActive(tab.key)} className={selected ? 'flex min-h-16 items-center gap-2 rounded-2xl border border-blue-600 bg-blue-600 p-3 text-right text-sm font-black text-white' : 'flex min-h-16 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-right text-sm font-bold text-slate-700'}>
            <Icon size={19} className="shrink-0"/><span>{tab.label}</span><span className="mr-auto text-xs opacity-80">{lists[tab.key].length}</span>
          </button>;
        })}
      </div>
      {error && <div role="alert" className="flex gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} className="shrink-0"/><span>{error}</span></div>}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 p-4 sm:p-5"><ActiveIcon className="text-blue-700" size={23}/><div><h3 className="font-black">{tabs.find(tab => tab.key === active)?.label}</h3><p className="text-xs text-slate-500">{rows.length} سجل</p></div></div>
        <div className="divide-y divide-slate-100">
          {rows.map((row, index) => <article key={String(row.factory_id ?? row.quarry_id ?? row.driver_id ?? row.vehicle_id ?? row.entry_id ?? row.load_order_id ?? row.booking_id ?? row.actual_loading_record_id ?? index)} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words font-black">{rowTitle(row, active)}</h4><p className="mt-1 break-words text-sm leading-6 text-slate-500">{rowDetails(row, active) || 'لا توجد تفاصيل إضافية في السجل الحالي.'}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">#{index + 1}</span></div>
          </article>)}
          {!loading && rows.length === 0 && <div className="p-10 text-center text-sm leading-6 text-slate-500">لا توجد سجلات في هذا القسم حاليًا. لن نعرض بيانات تجريبية بدل البيانات الحقيقية.</div>}
          {loading && <div className="p-8 text-center text-sm text-slate-500">جاري تحميل بيانات المكتب...</div>}
        </div>
      </div>
    </section>
  );
};
