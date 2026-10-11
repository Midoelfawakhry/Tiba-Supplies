import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Truck, Users, Search, CalendarDays, Weight } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ReportVehicle = { vehicle_id: string; plate_number: string; vehicle_code?: string | null; owner_id?: string | null; owner_name?: string | null; owner_phone?: string | null; is_active: boolean };
type ReportOwner = { owner_id: string; name: string; phone?: string | null; vehicle_count: number; is_active: boolean };
type Trip = { actual_load_id: string; booking_id?: string | null; load_date?: string | null; created_at: string; vehicle_id?: string | null; plate_number?: string | null; owner_id?: string | null; owner_name?: string | null; driver_name?: string | null; quarry_name?: string | null; factory_name?: string | null; ticket_number?: string | null; actual_weight?: number | string | null; delivery_confirmed_at?: string | null; is_completed: boolean };
type Snapshot = { vehicles: ReportVehicle[]; owners: ReportOwner[]; trips: Trip[] };

const dateValue = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const displayDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('ar-EG') : '—';
const weight = (value: Trip['actual_weight']) => Number(value ?? 0);

export const VehicleOwnerReportsScreen: React.FC = () => {
  const today = new Date();
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
  const [from, setFrom] = useState(dateValue(weekAgo));
  const [to, setTo] = useState(dateValue(today));
  const [snapshot, setSnapshot] = useState<Snapshot>({ vehicles: [], owners: [], trips: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'vehicles' | 'owners'>('vehicles');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);

  async function refresh() {
    setLoading(true); setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_vehicle_owner_reports', {
        p_from: from || null,
        p_to: to || null,
      });
      if (rpcError) throw rpcError;
      setSnapshot({
        vehicles: Array.isArray(data?.vehicles) ? data.vehicles : [],
        owners: Array.isArray(data?.owners) ? data.owners : [],
        trips: Array.isArray(data?.trips) ? data.trips : [],
      });
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل حسابات العربيات والملاك.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  const completedTrips = useMemo(() => snapshot.trips.filter(t => t.is_completed && t.actual_weight != null), [snapshot.trips]);
  const visibleVehicles = snapshot.vehicles.filter(v => `${v.plate_number} ${v.vehicle_code ?? ''} ${v.owner_name ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const visibleOwners = snapshot.owners.filter(o => `${o.name} ${o.phone ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const vehicleTrips = completedTrips.filter(t => t.vehicle_id === selectedVehicle);
  const ownerTrips = completedTrips.filter(t => t.owner_id === selectedOwner);
  const selectedVehicleInfo = snapshot.vehicles.find(v => v.vehicle_id === selectedVehicle);
  const selectedOwnerInfo = snapshot.owners.find(o => o.owner_id === selectedOwner);

  function TripTable({ trips }: { trips: Trip[] }) {
    if (!trips.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">مفيش نقلات مكتملة بوزن فعلي في الفترة دي.</p>;
    return <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">التاريخ</th><th className="p-3">العربية</th><th className="p-3">السواق</th><th className="p-3">المحجر</th><th className="p-3">المصنع النهائي</th><th className="p-3">رقم التذكرة</th><th className="p-3">الوزن الفعلي (طن)</th></tr></thead><tbody>{trips.map(t => <tr key={t.actual_load_id} className="border-t border-slate-100"><td className="p-3">{displayDate(t.load_date ?? t.created_at)}</td><td className="p-3 font-bold">{t.plate_number ?? '—'}</td><td className="p-3">{t.driver_name ?? '—'}</td><td className="p-3">{t.quarry_name ?? '—'}</td><td className="p-3">{t.factory_name ?? '—'}</td><td className="p-3">{t.ticket_number ?? '—'}</td><td className="p-3 font-black tabular-nums">{weight(t.actual_weight).toLocaleString('en-US', { maximumFractionDigits: 3 })}</td></tr>)}</tbody></table></div>;
  }

  return <section className="space-y-4">
    <header className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black">حسابات العربيات والملاك</h2><p className="mt-1 text-sm text-slate-500">سجل واحد للتحميل الفعلي، بعرض منفصل لكل عربية أو لكل مالك. الأوزان تُحسب للنقلات المكتملة فقط.</p></div><button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>{loading ? 'جاري التحديث' : 'تحديث'}</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold text-slate-600">من تاريخ<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm"/></label><label className="text-xs font-bold text-slate-600">إلى تاريخ<input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm"/></label><div className="flex items-end"><button onClick={() => void refresh()} className="w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white"><CalendarDays className="ml-2 inline" size={16}/>عرض الفترة</button></div></div>
      {error && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-slate-50 p-3"><Truck size={18} className="text-blue-700"/><div className="mt-2 text-xl font-black">{snapshot.vehicles.length}</div><div className="text-xs text-slate-500">إجمالي العربيات</div></div><div className="rounded-2xl bg-slate-50 p-3"><Users size={18} className="text-violet-700"/><div className="mt-2 text-xl font-black">{snapshot.owners.length}</div><div className="text-xs text-slate-500">إجمالي الملاك</div></div><div className="rounded-2xl bg-slate-50 p-3"><Weight size={18} className="text-emerald-700"/><div className="mt-2 text-xl font-black">{completedTrips.length}</div><div className="text-xs text-slate-500">نقلات مكتملة بالفترة</div></div><div className="rounded-2xl bg-slate-50 p-3"><Weight size={18} className="text-emerald-700"/><div className="mt-2 text-xl font-black">{completedTrips.reduce((sum,t) => sum + weight(t.actual_weight),0).toLocaleString('en-US',{maximumFractionDigits:3})}</div><div className="text-xs text-slate-500">إجمالي الأوزان (طن)</div></div></div>
    </header>
    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2"><button onClick={() => {setMode('vehicles');setSelectedOwner(null)}} className={mode==='vehicles'?'rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white':'rounded-xl border px-4 py-2 text-sm font-bold'}>حساب العربية</button><button onClick={() => {setMode('owners');setSelectedVehicle(null)}} className={mode==='owners'?'rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white':'rounded-xl border px-4 py-2 text-sm font-bold'}>حساب المالك</button></div><label className="relative block sm:w-72"><Search size={16} className="absolute right-3 top-3 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={mode==='vehicles'?'ابحث برقم العربية أو المالك':'ابحث باسم المالك أو الهاتف'} className="w-full rounded-xl border border-slate-300 py-2.5 pr-9 pl-3 text-sm"/></label></div>
      {mode==='vehicles' ? <div className="mt-4 grid gap-3 md:grid-cols-2">{visibleVehicles.map(v => {const trips=completedTrips.filter(t=>t.vehicle_id===v.vehicle_id); const total=trips.reduce((s,t)=>s+weight(t.actual_weight),0);return <button key={v.vehicle_id} onClick={()=>setSelectedVehicle(v.vehicle_id)} className={selectedVehicle===v.vehicle_id?'rounded-2xl border-2 border-blue-600 bg-blue-50 p-4 text-right':'rounded-2xl border border-slate-200 p-4 text-right hover:bg-slate-50'}><div className="flex items-center justify-between"><span className="font-black">{v.plate_number}</span><span className="text-xs text-slate-500">{v.vehicle_code??'بدون كود'}</span></div><div className="mt-1 text-sm text-slate-500">المالك: {v.owner_name??'غير مسجل'}</div><div className="mt-3 flex justify-between text-sm"><span>{trips.length} نقلة مكتملة</span><strong>{total.toLocaleString('en-US',{maximumFractionDigits:3})} طن</strong></div></button>})}</div> : <div className="mt-4 grid gap-3 md:grid-cols-2">{visibleOwners.map(o => {const trips=completedTrips.filter(t=>t.owner_id===o.owner_id);const total=trips.reduce((s,t)=>s+weight(t.actual_weight),0);return <button key={o.owner_id} onClick={()=>setSelectedOwner(o.owner_id)} className={selectedOwner===o.owner_id?'rounded-2xl border-2 border-violet-600 bg-violet-50 p-4 text-right':'rounded-2xl border border-slate-200 p-4 text-right hover:bg-slate-50'}><div className="font-black">{o.name}</div><div className="mt-1 text-sm text-slate-500">{o.phone??'بدون هاتف'} · {o.vehicle_count} عربية</div><div className="mt-3 flex justify-between text-sm"><span>{trips.length} نقلة مكتملة</span><strong>{total.toLocaleString('en-US',{maximumFractionDigits:3})} طن</strong></div></button>})}</div>}
    </div>
    {(selectedVehicle && selectedVehicleInfo) && <section className="rounded-3xl border border-blue-200 bg-white p-4 sm:p-5"><div className="mb-3"><h3 className="text-lg font-black">كشف حركة العربية {selectedVehicleInfo.plate_number}</h3><p className="text-sm text-slate-500">المالك: {selectedVehicleInfo.owner_name??'غير مسجل'} · للفترة المحددة</p></div><TripTable trips={vehicleTrips}/></section>}
    {(selectedOwner && selectedOwnerInfo) && <section className="rounded-3xl border border-violet-200 bg-white p-4 sm:p-5"><div className="mb-3"><h3 className="text-lg font-black">كشف حركة المالك {selectedOwnerInfo.name}</h3><p className="text-sm text-slate-500">كل العربيات التابعة للمالك، مع تفاصيل كل رحلة</p></div><TripTable trips={ownerTrips}/></section>}
  </section>;
};
