import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, LogOut, MapPin, Factory, Mountain, Truck, ClipboardList, CheckCircle2, Clock3, Users, Bot, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { VehicleTrackingScreen } from './VehicleTrackingScreen';
import { OfficeDirectoryScreen } from './OfficeDirectoryScreen';
import { DirectLoadAssignmentScreen } from './DirectLoadAssignmentScreen';
import { VehicleOwnerReportsScreen } from './VehicleOwnerReportsScreen';
import { AccountStatementsScreen } from './AccountStatementsScreen';
import { BranchEmployeeManagementScreen } from './BranchEmployeeManagementScreen';
import { SystemAiAssistant } from './SystemAiAssistant';
import { getLiveSnapshot, LiveSnapshot, liveName } from '../services/liveData';

const statusLabel: Record<string, string> = {
  PUBLISHED: 'متاح',
  LOADING_STATEMENT: 'جاري التحميل',
  BOOKED: 'مكتمل التخصيص',
  CANCELLED: 'ملغي',
};

type OfficeScreen = 'dashboard' | 'tracking' | 'directory' | 'direct' | 'drivers' | 'vehicles' | 'waiting' | 'orders' | 'actual' | 'vehicleReports' | 'factoryStatement' | 'quarryStatement' | 'analytics' | 'employees' | 'assistant';
const screenPalette: Record<OfficeScreen, { selected: string; wash: string }> = {
  dashboard: { selected: 'bg-teal-600 hover:bg-teal-700', wash: 'bg-teal-50/40' },
  drivers: { selected: 'bg-red-600 hover:bg-red-700', wash: 'bg-red-50/50' },
  vehicles: { selected: 'bg-blue-600 hover:bg-blue-700', wash: 'bg-blue-50/50' },
  waiting: { selected: 'bg-violet-600 hover:bg-violet-700', wash: 'bg-violet-50/50' },
  orders: { selected: 'bg-orange-600 hover:bg-orange-700', wash: 'bg-orange-50/50' },
  actual: { selected: 'bg-emerald-600 hover:bg-emerald-700', wash: 'bg-emerald-50/50' },
  vehicleReports: { selected: 'bg-sky-700 hover:bg-sky-800', wash: 'bg-sky-50/50' },
  factoryStatement: { selected: 'bg-cyan-700 hover:bg-cyan-800', wash: 'bg-cyan-50/50' },
  quarryStatement: { selected: 'bg-amber-700 hover:bg-amber-800', wash: 'bg-amber-50/50' },
  analytics: { selected: 'bg-indigo-700 hover:bg-indigo-800', wash: 'bg-indigo-50/50' },
  tracking: { selected: 'bg-cyan-600 hover:bg-cyan-700', wash: 'bg-cyan-50/50' },
  directory: { selected: 'bg-indigo-600 hover:bg-indigo-700', wash: 'bg-indigo-50/50' },
  direct: { selected: 'bg-fuchsia-600 hover:bg-fuchsia-700', wash: 'bg-fuchsia-50/50' },
  employees: { selected: 'bg-indigo-600 hover:bg-indigo-700', wash: 'bg-indigo-50/50' },
  assistant: { selected: 'bg-violet-700 hover:bg-violet-800', wash: 'bg-violet-50/50' },
};

export const LiveOperationsBoard: React.FC = () => {
  const [data, setData] = useState<LiveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [factoryId, setFactoryId] = useState('');
  const [quarryId, setQuarryId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [priority, setPriority] = useState('3');
  const [savingOrder, setSavingOrder] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeScreen, setActiveScreen] = useState<OfficeScreen>('dashboard');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getLiveSnapshot());
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات التشغيل');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const localNow = new Date();
  const todayKey = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`;
  const todaysActualCount = (data?.actual_loading_records ?? []).filter((row: Record<string, any>) => String(row.loading_sequence_date ?? row.load_date ?? '').slice(0, 10) === todayKey).length;

  async function createLoadOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!factoryId || !quarryId) {
      setError('اختار المصنع والمحجر الأول.');
      return;
    }

    const requestedQuantity = Number(quantity);
    const orderPriority = Number(priority);
    if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
      setError('الكمية المطلوبة لازم تكون عددًا صحيحًا أكبر من صفر.');
      return;
    }
    if (!Number.isInteger(orderPriority) || orderPriority < 1 || orderPriority > 5) {
      setError('الأولوية لازم تكون من 1 إلى 5.');
      return;
    }

    setSavingOrder(true);
    try {
      const { data: draft, error: createError } = await supabase.rpc('main_office_create_load_order', {
        p_factory_id: factoryId,
        p_quarry_id: quarryId,
        p_requested_quantity: requestedQuantity,
        p_priority: orderPriority,
        p_notes: null,
      });
      if (createError) throw createError;
      if (!draft?.load_order_id || draft?.status !== 'DRAFT') {
        throw new Error('لم يتم تأكيد إنشاء مسودة أمر التحميل.');
      }

      const { data: published, error: publishError } = await supabase.rpc('main_office_publish_load_order', {
        p_load_order_id: draft.load_order_id,
      });
      if (publishError) throw publishError;
      if (published?.status !== 'PUBLISHED') {
        throw new Error('تم إنشاء المسودة لكن لم يتم تأكيد نشر أمر التحميل.');
      }

      setSuccessMessage('تم إنشاء أمر التحميل ونشره بنجاح.');
      setQuantity('1');
      await load();
    } catch (e: any) {
      setError(e?.message || 'تعذر إنشاء أمر التحميل.');
    } finally {
      setSavingOrder(false);
    }
  }


  const counts = useMemo(() => {
    const orders = data?.load_orders ?? [];
    const bookings = data?.bookings ?? [];
    const activeBookings = bookings.filter(b => ['BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT'].includes(b.status)).length;
    const requested = orders.reduce((n, o) => n + Number(o.requested_quantity || 0), 0);
    return { orders: orders.length, requested, activeBookings };
  }, [data]);

  if (loading && !data) {
    return <div dir="rtl" className="grid min-h-screen place-items-center bg-gradient-to-br from-teal-50 via-white to-orange-50 p-6 text-slate-800"><div className="rounded-3xl border border-teal-100 bg-white/90 px-8 py-9 text-center shadow-lg shadow-teal-900/5"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-teal-100 text-teal-700"><ClipboardList size={30}/></div><p className="text-xs font-black tracking-widest text-teal-700">TIBA SUPPLIES</p><p className="mt-2 text-lg font-black">جاري تجهيز مركز التشغيل</p><p className="mt-1 text-sm text-slate-500">بنحمّل بيانات التشغيل الحقيقية...</p><div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-teal-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-teal-600"/></div></div></div>;
  }

  const operationalOffice = data?.operational_office ?? data?.office;
  const checkInOffice = data?.check_in_office;
  const checkInRadiusKm = Number(checkInOffice?.geofence_radius_m ?? 10000) / 1000;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <header className="relative sm:sticky sm:top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm shadow-slate-900/5 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 w-full sm:w-auto">
            <div className="inline-flex items-center gap-2 text-[10px] leading-4 sm:text-xs font-black tracking-wide text-teal-700 whitespace-normal break-words"><span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50"><Truck className="h-4 w-4" /></span>TIBA SUPPLIES · LIVE CORE</div>
            <h1 className="text-lg leading-7 sm:text-xl lg:text-2xl font-black break-words">مركز تشغيل طيبة للتوريدات</h1>
            <div className="text-xs sm:text-sm leading-5 text-slate-500 mt-1 break-words">
              <MapPin className="inline h-3 w-3 ml-1" />
              مكتب التشغيل: {operationalOffice?.name ?? 'طيبة للتوريدات - الإسماعيلية'}
              {' · '}
              تسجيل الوصول: {checkInOffice?.name ?? 'طيبة للتوريدات - رأس سدر'}
              {' · '}
              نطاق تسجيل الوصول {checkInRadiusKm} كم
            </div>
          </div>
          <div className="flex w-full sm:w-auto shrink-0 gap-2 sm:self-auto">
            <button onClick={load} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold">
              <RefreshCw className="inline h-4 w-4 ml-1" /> تحديث
            </button>
            <button onClick={() => supabase.auth.signOut()} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              <LogOut className="inline h-4 w-4 ml-1" /> خروج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-5">
        {error && <div className="rounded-2xl border border-red-500/30 bg-red-50 p-4 text-sm text-red-800">خطأ: {error}</div>}

        {successMessage && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-800">{successMessage}</div>}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <aside className="w-full shrink-0 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-28 lg:w-64" aria-label="القائمة الرئيسية للمكتب">
            <div className="px-3 pb-3 pt-2">
              <div className="text-[10px] font-black tracking-wider text-blue-700">TIBA SUPPLIES</div>
              <h2 className="mt-1 text-base font-black">إدارة المكتب</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">كل شاشات التشغيل في مكان واحد</p>
            </div>
            <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1" aria-label="التنقل بين شاشات المكتب">
              {([
                ['dashboard', 'مركز التشغيل', ClipboardList],
                ['drivers', 'قائمة السائقين', Users],
                ['analytics', 'تحليل البيانات والتقارير', BarChart3],
                ['vehicleReports', 'حسابات العربيات والملاك', Users],
                ['factoryStatement', 'كشف حساب المصانع والعملاء', Factory],
                ['quarryStatement', 'كشف حساب المحاجر', Mountain],
                ['waiting', 'قائمة الانتظار', Clock3],
                ['orders', 'أوامر التحميل', ClipboardList],
                ['actual', 'التحميل الفعلي', CheckCircle2],
                ['tracking', 'تتبع السيارات', MapPin],
                ['directory', 'دليل البيانات الكامل', Users],
                ['direct', 'إسناد نقلة مباشرة', ClipboardList],
                ['employees', 'موظفو مكتب رأس سدر', Users],
                ['assistant', 'مساعد النظام AI', Bot],
              ] as const).map(([key, label, Icon]) => {
                const selected = activeScreen === key;
                return <button key={key} type="button" onClick={() => setActiveScreen(key as typeof activeScreen)} className={selected ? `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-black text-white shadow-sm transition ${screenPalette[key].selected}` : 'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900'}>
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="min-w-0 flex-1">{label}</span>
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </button>;
              })}
            </nav>
          </aside>
          <section className={`min-w-0 flex-1 space-y-5 rounded-[2rem] p-2 transition-colors sm:p-3 ${screenPalette[activeScreen].wash}`}>
        {activeScreen === 'analytics' ? <section className="space-y-4 rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm"><div><h2 className="text-xl font-black text-slate-900">تحليل البيانات والتقارير</h2><p className="mt-1 text-sm leading-6 text-slate-500">اختار التقرير المطلوب من تقارير التشغيل المسجلة.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><button type="button" onClick={() => setActiveScreen('vehicleReports')} className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-right"><Users className="mb-3 h-7 w-7 text-sky-700"/><h3 className="font-black">حسابات العربيات والملاك</h3></button><button type="button" onClick={() => setActiveScreen('factoryStatement')} className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-right"><Factory className="mb-3 h-7 w-7 text-cyan-700"/><h3 className="font-black">كشف حساب المصانع والعملاء</h3></button><button type="button" onClick={() => setActiveScreen('quarryStatement')} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-right"><Mountain className="mb-3 h-7 w-7 text-amber-700"/><h3 className="font-black">كشف حساب المحاجر</h3></button></div></section> : activeScreen === 'assistant' ? <SystemAiAssistant audience="HEAD_OFFICE" context={{ office: data?.operational_office?.name ?? data?.office?.name ?? 'مكتب الإسماعيلية', check_in_office: data?.check_in_office?.name ?? 'مكتب رأس سدر', totals: { factories: data?.factories.length ?? 0, quarries: data?.quarries.length ?? 0, load_orders: data?.load_orders.length ?? 0, bookings: data?.bookings.length ?? 0, actual_loading_records: data?.actual_loading_records.length ?? 0, active_drivers: data?.drivers.filter(row => row.is_active !== false).length ?? 0, active_vehicles: data?.vehicles.filter(row => row.is_active !== false).length ?? 0 }, load_orders: (data?.load_orders ?? []).slice(0, 80).map(order => ({ factory: liveName(data?.factories.find(row => row.factory_id === order.factory_id)), quarry: liveName(data?.quarries.find(row => row.quarry_id === order.quarry_id)), status: order.status, requested_quantity: order.requested_quantity, priority: order.priority })), bookings_by_status: Object.entries((data?.bookings ?? []).reduce((acc: Record<string, number>, row) => { acc[row.status] = (acc[row.status] ?? 0) + 1; return acc; }, {})), actual_loads_today: todaysActualCount }} /> : activeScreen === 'employees' ? <BranchEmployeeManagementScreen /> : activeScreen === 'factoryStatement' ? <AccountStatementsScreen kind="factory" /> : activeScreen === 'quarryStatement' ? <AccountStatementsScreen kind="quarry" /> : activeScreen === 'vehicleReports' ? <VehicleOwnerReportsScreen /> : activeScreen === 'tracking' ? <VehicleTrackingScreen /> : activeScreen === 'drivers' ? <OfficeDirectoryScreen initialSection="drivers" showSectionTabs={false} /> : activeScreen === 'vehicles' ? <OfficeDirectoryScreen initialSection="vehicles" showSectionTabs={false} /> : activeScreen === 'waiting' ? <OfficeDirectoryScreen initialSection="waiting" showSectionTabs={false} /> : activeScreen === 'orders' ? <OfficeDirectoryScreen initialSection="loads" showSectionTabs={false} /> : activeScreen === 'actual' ? <OfficeDirectoryScreen initialSection="actual" showSectionTabs={false} /> : activeScreen === 'directory' ? <OfficeDirectoryScreen /> : activeScreen === 'direct' ? <DirectLoadAssignmentScreen /> : <>
        <section className="rounded-3xl border border-orange-200/80 bg-gradient-to-br from-white via-white to-orange-50/70 p-5 shadow-sm shadow-orange-900/5">
          <div className="mb-4">
            <h2 className="text-lg font-black">إنشاء أمر تحميل جديد</h2>
            <p className="mt-1 text-xs text-slate-500">يُنشأ الأمر على مكتب الإسماعيلية ويُوجَّه تسجيل وصول السواقين إلى مكتب رأس سدر.</p>
          </div>
          <form onSubmit={createLoadOrder} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs text-slate-500">
              المصنع
              <select value={factoryId} onChange={e => setFactoryId(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
                <option value="">اختار المصنع</option>
                {(data?.factories ?? []).map(factory => <option key={factory.factory_id} value={factory.factory_id}>{liveName(factory)}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              المحجر
              <select value={quarryId} onChange={e => setQuarryId(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
                <option value="">اختار المحجر</option>
                {(data?.quarries ?? []).map(quarry => <option key={quarry.quarry_id} value={quarry.quarry_id}>{liveName(quarry)}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              عدد النقلات المطلوبة
              <input type="number" min="1" step="1" required value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-500">
              الأولوية
              <select value={priority} onChange={e => setPriority(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
                <option value="1">1 — عاجلة جدًا</option>
                <option value="2">2 — عاجلة</option>
                <option value="3">3 — عادية</option>
                <option value="4">4 — منخفضة</option>
                <option value="5">5 — الأقل</option>
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={savingOrder || !data?.factories.length || !data?.quarries.length} className="w-full rounded-xl bg-orange-600 p-3 text-sm font-black text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
                {savingOrder ? 'جاري النشر...' : 'إنشاء ونشر الأمر'}
              </button>
            </div>
          </form>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['طلبات التحميل', counts.orders, ClipboardList],
            ['إجمالي النقلات المطلوبة', counts.requested, Truck],
            ['تخصيصات نشطة', counts.activeBookings, CheckCircle2],
            ['السائقون النشطون', data?.drivers.length ?? 0, Users],
          ].map(([label, value, Icon]: any) => (
            <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.03]">
              <Icon className="h-5 w-5 text-blue-700" />
              <div className="mt-3 text-2xl font-black">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </section>

        <section className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03] overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="font-black text-lg">طلبات التحميل الحقيقية</h2>
              <p className="text-xs text-slate-500 mt-1">مصدرها load_orders في Supabase</p>
            </div>
            <div className="p-4 space-y-3">
              {(data?.load_orders ?? []).map(order => {
                const factory = data?.factories.find(f => f.factory_id === order.factory_id);
                const quarry = data?.quarries.find(q => q.quarry_id === order.quarry_id);
                const committedStatuses = ['BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];
                const booked = (data?.bookings ?? []).filter(b => b.load_order_id === order.load_order_id && committedStatuses.includes(b.status)).length;
                return (
                  <article key={order.load_order_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-black">{liveName(factory)}</div>
                        <div className="text-xs text-slate-500 mt-1"><Mountain className="inline h-3 w-3 ml-1" />{liveName(quarry)}</div>
                      </div>
                      <span className="text-xs rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">{statusLabel[order.status] ?? order.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                      <div className="rounded-xl bg-white p-2"><b>{order.requested_quantity}</b><div className="text-[10px] text-slate-500">مطلوب</div></div>
                      <div className="rounded-xl bg-white p-2"><b>{booked}</b><div className="text-[10px] text-slate-500">محجوز</div></div>
                      <div className="rounded-xl bg-white p-2"><b>{Math.max(0, Number(order.requested_quantity) - booked)}</b><div className="text-[10px] text-slate-500">متبقي</div></div>
                    </div>
                    <div className="mt-3 text-[10px] text-slate-500">{order.load_order_id}</div>
                  </article>
                );
              })}
              {!data?.load_orders.length && <div className="py-10 text-center text-sm text-slate-500">مفيش طلبات تحميل حقيقية مسجلة للمكتب حتى الآن.</div>}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.03]">
              <h2 className="font-black text-lg">البيانات الرئيسية</h2>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-2xl bg-slate-50 p-4"><Factory className="h-5 w-5 text-blue-700" /><b className="block mt-2 text-xl">{data?.factories.length ?? 0}</b><span className="text-xs text-slate-500">مصنع نشط</span></div>
                <div className="rounded-2xl bg-slate-50 p-4"><Mountain className="h-5 w-5 text-orange-600" /><b className="block mt-2 text-xl">{data?.quarries.length ?? 0}</b><span className="text-xs text-slate-500">محجر نشط</span></div>
                <div className="rounded-2xl bg-slate-50 p-4"><Clock3 className="h-5 w-5 text-violet-600" /><b className="block mt-2 text-xl">{data?.actual_loading_records.length ?? 0}</b><span className="text-xs text-slate-500">إجمالي سجلات التحميل</span></div>
                <div className="rounded-2xl bg-emerald-50 p-4"><Truck className="h-5 w-5 text-emerald-700" /><b className="block mt-2 text-xl">{todaysActualCount}</b><span className="text-xs text-slate-500">تحميلات اليوم</span></div>
              </div>
            </div>
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="text-sm font-black text-emerald-700">قاعدة التشغيل الأساسية</div>
              <div className="mt-2 text-sm text-slate-300">
                أوامر التحميل تصدر من مكتب الإسماعيلية، وتسجيل وصول السواقين يتم في مكتب رأس سدر. وجود السواق داخل نطاق {checkInRadiusKm} كم وحده لا يضيفه لقائمة الانتظار؛ لازم يسجل وصوله صراحةً.
              </div>
            </div>
          </div>
        </section>
        </>}
          </section>
        </div>
      </main>
    </div>
  );
};
