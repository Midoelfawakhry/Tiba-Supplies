import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, LogOut, MapPin, Factory, Mountain, Truck, ClipboardList, CheckCircle2, Clock3, Users, HandCoins } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { VehicleTrackingScreen } from './VehicleTrackingScreen';
import { OfficeDirectoryScreen } from './OfficeDirectoryScreen';
import { DirectLoadAssignmentScreen } from './DirectLoadAssignmentScreen';
import { getLiveSnapshot, LiveSnapshot, liveName } from '../services/liveData';

const statusLabel: Record<string, string> = {
  PUBLISHED: 'متاح',
  LOADING_STATEMENT: 'جاري التحميل',
  BOOKED: 'مكتمل التخصيص',
  CANCELLED: 'ملغي',
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
  const [activeScreen, setActiveScreen] = useState<'dashboard' | 'tracking' | 'directory' | 'direct' | 'drivers' | 'vehicles' | 'waiting' | 'orders' | 'actual' | 'factories' | 'quarries'>('dashboard');

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
      const { data: result, error: rpcError } = await supabase.rpc('create_load_order', {
        p_factory_id: factoryId,
        p_quarry_id: quarryId,
        p_requested_quantity: requestedQuantity,
        p_priority: orderPriority,
      });
      if (rpcError) throw rpcError;
      if (!result?.success) throw new Error('تعذر تأكيد إنشاء أمر التحميل.');

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
    return <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 grid place-items-center">جاري تحميل بيانات التشغيل الحقيقية...</div>;
  }

  const operationalOffice = data?.operational_office ?? data?.office;
  const checkInOffice = data?.check_in_office;
  const checkInRadiusKm = Number(checkInOffice?.geofence_radius_m ?? 10000) / 1000;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <header className="relative sm:sticky sm:top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 w-full sm:w-auto">
            <div className="text-[10px] leading-4 sm:text-xs font-black tracking-wide text-blue-700 whitespace-normal break-words">TIBA SUPPLIES · LIVE CORE</div>
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
        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">خطأ: {error}</div>}

        {successMessage && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">{successMessage}</div>}

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
                ['vehicles', 'كل العربيات', Truck],
                ['waiting', 'قائمة الانتظار', Clock3],
                ['orders', 'أوامر التحميل', ClipboardList],
                ['actual', 'التحميل الفعلي', CheckCircle2],
                ['factories', 'المصانع والعملاء', Factory],
                ['quarries', 'المحاجر والخامات', Mountain],
                ['tracking', 'تتبع السيارات', MapPin],
                ['directory', 'دليل البيانات الكامل', Users],
                ['direct', 'التحميل بالأمر المباشر', HandCoins],
              ] as const).map(([key, label, Icon]) => {
                const selected = activeScreen === key;
                return <button key={key} type="button" onClick={() => setActiveScreen(key as typeof activeScreen)} className={selected ? 'flex min-h-11 items-center gap-3 rounded-xl bg-blue-600 px-3 py-2.5 text-right text-sm font-black text-white shadow-sm' : 'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900'}>
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="min-w-0 flex-1">{label}</span>
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </button>;
              })}
            </nav>
          </aside>
          <section className="min-w-0 flex-1 space-y-5">
        {activeScreen === 'tracking' ? <VehicleTrackingScreen /> : activeScreen === 'drivers' ? <OfficeDirectoryScreen initialSection="drivers" showSectionTabs={false} /> : activeScreen === 'vehicles' ? <OfficeDirectoryScreen initialSection="vehicles" showSectionTabs={false} /> : activeScreen === 'waiting' ? <OfficeDirectoryScreen initialSection="waiting" showSectionTabs={false} /> : activeScreen === 'orders' ? <OfficeDirectoryScreen initialSection="loads" showSectionTabs={false} /> : activeScreen === 'actual' ? <OfficeDirectoryScreen initialSection="actual" showSectionTabs={false} /> : activeScreen === 'factories' ? <OfficeDirectoryScreen initialSection="factories" showSectionTabs={false} /> : activeScreen === 'quarries' ? <OfficeDirectoryScreen initialSection="quarries" showSectionTabs={false} /> : activeScreen === 'directory' ? <OfficeDirectoryScreen /> : activeScreen === 'direct' ? <DirectLoadAssignmentScreen /> : <>
        <section className="rounded-3xl border border-blue-200 bg-white p-5">
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
              <button type="submit" disabled={savingOrder || !data?.factories.length || !data?.quarries.length} className="w-full rounded-xl bg-blue-600 p-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
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
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <Icon className="h-5 w-5 text-blue-700" />
              <div className="mt-3 text-2xl font-black">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </section>

        <section className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="font-black text-lg">طلبات التحميل الحقيقية</h2>
              <p className="text-xs text-slate-500 mt-1">مصدرها load_orders في Supabase</p>
            </div>
            <div className="p-4 space-y-3">
              {(data?.load_orders ?? []).map(order => {
                const factory = data?.factories.find(f => f.factory_id === order.factory_id);
                const quarry = data?.quarries.find(q => q.quarry_id === order.quarry_id);
                const booked = (data?.bookings ?? []).filter(b => b.load_order_id === order.load_order_id).length;
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
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h2 className="font-black text-lg">البيانات الرئيسية</h2>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-2xl bg-slate-50 p-4"><Factory className="h-5 w-5 text-blue-700" /><b className="block mt-2 text-xl">{data?.factories.length ?? 0}</b><span className="text-xs text-slate-500">مصنع نشط</span></div>
                <div className="rounded-2xl bg-slate-50 p-4"><Mountain className="h-5 w-5 text-orange-600" /><b className="block mt-2 text-xl">{data?.quarries.length ?? 0}</b><span className="text-xs text-slate-500">محجر نشط</span></div>
                <div className="rounded-2xl bg-slate-50 p-4"><Truck className="h-5 w-5 text-blue-600" /><b className="block mt-2 text-xl">{data?.vehicles.length ?? 0}</b><span className="text-xs text-slate-500">عربية نشطة</span></div>
                <div className="rounded-2xl bg-slate-50 p-4"><Clock3 className="h-5 w-5 text-violet-600" /><b className="block mt-2 text-xl">{data?.actual_loading_records.length ?? 0}</b><span className="text-xs text-slate-500">سجل تحميل فعلي</span></div>
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
