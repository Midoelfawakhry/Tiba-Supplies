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

export const OfficeDirectoryScreen: React.FC<{ initialSection?: ScreenKey; showSectionTabs?: boolean }> = ({ initialSection = 'factories', showSectionTabs = true }) => {
  const [active, setActive] = useState<ScreenKey>(initialSection);
  useEffect(() => { setActive(initialSection); }, [initialSection]);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [waiting, setWaiting] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverCode, setDriverCode] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [availableVehicles, setAvailableVehicles] = useState<Row[]>([]);
  const [savingDriver, setSavingDriver] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLiveSnapshot();
      setSnapshot(data);
      const { data: waitingData, error: waitingError } = await supabase.rpc('get_office_waiting_list');
      if (waitingError) throw waitingError;
      setWaiting(Array.isArray(waitingData) ? waitingData : []);
      const { data: vehiclesData, error: vehiclesError } = await supabase.rpc('get_available_vehicles');
      if (vehiclesError) throw vehiclesError;
      setAvailableVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل دليل بيانات المكتب.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function createDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSavingDriver(true);
    try {
      const { data: result, error: createError } = await supabase.rpc('create_operational_driver', {
        p_name: driverName.trim(),
        p_phone: driverPhone.trim(),
        p_vehicle_id: selectedVehicleId,
        p_driver_code: driverCode.trim() || null,
      });
      if (createError) throw createError;
      if (!result?.success) throw new Error('تعذر تأكيد حفظ السواق في النظام.');
      setSuccess('تم حفظ بيانات السواق والعربية في قاعدة البيانات. حساب الدخول لم يتم إنشاؤه في هذه الخطوة.');
      setDriverName('');
      setDriverPhone('');
      setDriverCode('');
      setVehicleSearch('');
      setSelectedVehicleId('');
      setShowDriverForm(false);
      await load();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const messages: Record<string, string> = {
        DRIVER_PHONE_EXISTS: 'رقم الموبايل مسجل لسواق بالفعل.',
        VEHICLE_PLATE_EXISTS: 'رقم العربية مسجل بالفعل.',
        VEHICLE_NOT_AVAILABLE: 'العربية دي مش متاحة أو اتربطت بسواق آخر. حدّث القائمة واختار عربية تانية.',
        DRIVER_CODE_EXISTS: 'كود السواق مستخدم بالفعل.',
        REQUIRED_FIELDS_MISSING: 'اكتب اسم السواق ورقم الموبايل ورقم العربية.',
        INSUFFICIENT_ROLE: 'حسابك مش عنده صلاحية إضافة سواقين.',
        AUTH_REQUIRED: 'سجّل دخولك بحساب المكتب الأول.',
      };
      const key = Object.keys(messages).find(k => raw.includes(k));
      setError(key ? messages[key] : raw || 'تعذر حفظ بيانات السواق. تأكد من تطبيق تحديث قاعدة البيانات أولًا.');
    } finally {
      setSavingDriver(false);
    }
  }

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
  const filteredAvailableVehicles = availableVehicles.filter((vehicle: Row) => String(vehicle.plate_number ?? '').toLowerCase().includes(vehicleSearch.trim().toLowerCase()));
  const ActiveIcon = tabs.find(tab => tab.key === active)?.icon ?? ClipboardList;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="text-xl font-black">شاشات إدارة المكتب</h2><p className="mt-1 text-sm leading-6 text-slate-500">دليل موحّد لبيانات التشغيل الحقيقية المحمّلة من Supabase.</p></div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-bold disabled:opacity-60"><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/> تحديث البيانات</button>
      </div>
      {showSectionTabs && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const selected = active === tab.key;
          return <button key={tab.key} type="button" onClick={() => setActive(tab.key)} className={selected ? 'flex min-h-16 items-center gap-2 rounded-2xl border border-blue-600 bg-blue-600 p-3 text-right text-sm font-black text-white' : 'flex min-h-16 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-right text-sm font-bold text-slate-700'}>
            <Icon size={19} className="shrink-0"/><span>{tab.label}</span><span className="mr-auto text-xs opacity-80">{lists[tab.key].length}</span>
          </button>;
        })}
      </div>}
      {success && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>}
      {error && <div role="alert" className="flex gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} className="shrink-0"/><span>{error}</span></div>}
      {active === 'drivers' && <section className="rounded-3xl border border-blue-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-black">إضافة سائق جديد</h3><p className="mt-1 text-sm text-slate-500">تُحفظ البيانات التشغيلية في Supabase. إنشاء حساب الدخول خطوة منفصلة.</p></div>
          <button type="button" onClick={() => { setShowDriverForm(v => !v); setError(''); setSuccess(''); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">{showDriverForm ? 'إلغاء' : 'إضافة سائق'}</button>
        </div>
        {showDriverForm && <form onSubmit={createDriver} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">اسم السواق بالكامل<input required value={driverName} onChange={e => setDriverName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="اسم السواق"/></label>
          <label className="text-sm font-bold text-slate-700">رقم الموبايل<input required type="tel" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="رقم التواصل"/></label>
          <div className="text-sm font-bold text-slate-700">اختيار العربية
            <label className="relative mt-1.5 block"><span className="sr-only">ابحث برقم العربية</span><input value={vehicleSearch} onChange={e => { setVehicleSearch(e.target.value); setSelectedVehicleId(''); }} className="w-full rounded-xl border border-slate-300 bg-white p-3 pr-10 font-normal" placeholder="ابحث برقم اللوحة..."/><span className="absolute right-3 top-3 text-slate-400"><Truck size={18}/></span></label>
            <select required value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal">
              <option value="">اختار عربية متاحة</option>
              {filteredAvailableVehicles.map((vehicle: Row) => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.plate_number}</option>)}
            </select>
            <p className="mt-1 text-xs font-normal text-slate-500">{filteredAvailableVehicles.length} عربية متاحة للاختيار</p>
          </div>
          <label className="text-sm font-bold text-slate-700">كود السواق (اختياري)<input value={driverCode} onChange={e => setDriverCode(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="لو عنده كود بالفعل"/></label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button disabled={savingDriver} type="submit" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{savingDriver ? 'جاري الحفظ...' : 'حفظ السواق في النظام'}</button><p className="text-xs leading-5 text-slate-500">قبل استخدام الحفظ، لازم تكون ترقية قاعدة البيانات الخاصة بإضافة السواق مطبّقة في Supabase.</p></div>
        </form>}
      </section>}

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
