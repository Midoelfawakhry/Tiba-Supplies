import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, LogOut, MapPin, Factory, Mountain, Truck, ClipboardList, CheckCircle2, Clock3, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
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

  const counts = useMemo(() => {
    const orders = data?.load_orders ?? [];
    const bookings = data?.bookings ?? [];
    const activeBookings = bookings.filter(b => ['BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT'].includes(b.status)).length;
    const requested = orders.reduce((n, o) => n + Number(o.requested_quantity || 0), 0);
    return { orders: orders.length, requested, activeBookings };
  }, [data]);

  if (loading && !data) {
    return <div dir="rtl" className="min-h-screen bg-zinc-950 text-white grid place-items-center">جاري تحميل بيانات التشغيل الحقيقية...</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-slate-800 bg-slate-950/90 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black text-cyan-300">TIBA SUPPLIES · LIVE CORE</div>
            <h1 className="text-xl sm:text-2xl font-black">مركز تشغيل رأس سدر</h1>
            <div className="text-xs text-slate-400 mt-1">
              <MapPin className="inline h-3 w-3 ml-1" />
              {data?.office?.name ?? 'مكتب طيبة للتوريدات - رأس سدر'} · نطاق التشغيل {Number(data?.office?.geofence_radius_m ?? 10000) / 1000} كم
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold">
              <RefreshCw className="inline h-4 w-4 ml-1" /> تحديث
            </button>
            <button onClick={() => supabase.auth.signOut()} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
              <LogOut className="inline h-4 w-4 ml-1" /> خروج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-5">
        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">خطأ: {error}</div>}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['طلبات التحميل', counts.orders, ClipboardList],
            ['إجمالي النقلات المطلوبة', counts.requested, Truck],
            ['تخصيصات نشطة', counts.activeBookings, CheckCircle2],
            ['السائقون النشطون', data?.drivers.length ?? 0, Users],
          ].map(([label, value, Icon]: any) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <Icon className="h-5 w-5 text-cyan-300" />
              <div className="mt-3 text-2xl font-black">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </section>

        <section className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h2 className="font-black text-lg">طلبات التحميل الحقيقية</h2>
              <p className="text-xs text-slate-500 mt-1">مصدرها load_orders في Supabase</p>
            </div>
            <div className="p-4 space-y-3">
              {(data?.load_orders ?? []).map(order => {
                const factory = data?.factories.find(f => f.factory_id === order.factory_id);
                const quarry = data?.quarries.find(q => q.quarry_id === order.quarry_id);
                const booked = (data?.bookings ?? []).filter(b => b.load_order_id === order.load_order_id).length;
                return (
                  <article key={order.load_order_id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-black">{liveName(factory)}</div>
                        <div className="text-xs text-slate-500 mt-1"><Mountain className="inline h-3 w-3 ml-1" />{liveName(quarry)}</div>
                      </div>
                      <span className="text-xs rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-300">{statusLabel[order.status] ?? order.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                      <div className="rounded-xl bg-slate-900 p-2"><b>{order.requested_quantity}</b><div className="text-[10px] text-slate-500">مطلوب</div></div>
                      <div className="rounded-xl bg-slate-900 p-2"><b>{booked}</b><div className="text-[10px] text-slate-500">محجوز</div></div>
                      <div className="rounded-xl bg-slate-900 p-2"><b>{Math.max(0, Number(order.requested_quantity) - booked)}</b><div className="text-[10px] text-slate-500">متبقي</div></div>
                    </div>
                    <div className="mt-3 text-[10px] text-slate-600">{order.load_order_id}</div>
                  </article>
                );
              })}
              {!data?.load_orders.length && <div className="py-10 text-center text-sm text-slate-500">مفيش طلبات تحميل حقيقية مسجلة للمكتب حتى الآن.</div>}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-black text-lg">البيانات الرئيسية</h2>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-2xl bg-slate-950 p-4"><Factory className="h-5 w-5 text-cyan-300" /><b className="block mt-2 text-xl">{data?.factories.length ?? 0}</b><span className="text-xs text-slate-500">مصنع نشط</span></div>
                <div className="rounded-2xl bg-slate-950 p-4"><Mountain className="h-5 w-5 text-orange-300" /><b className="block mt-2 text-xl">{data?.quarries.length ?? 0}</b><span className="text-xs text-slate-500">محجر نشط</span></div>
                <div className="rounded-2xl bg-slate-950 p-4"><Truck className="h-5 w-5 text-blue-300" /><b className="block mt-2 text-xl">{data?.vehicles.length ?? 0}</b><span className="text-xs text-slate-500">عربية نشطة</span></div>
                <div className="rounded-2xl bg-slate-950 p-4"><Clock3 className="h-5 w-5 text-violet-300" /><b className="block mt-2 text-xl">{data?.actual_loading_records.length ?? 0}</b><span className="text-xs text-slate-500">سجل تحميل فعلي</span></div>
              </div>
            </div>
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="text-sm font-black text-emerald-300">قاعدة التشغيل الأساسية</div>
              <div className="mt-2 text-sm text-slate-300">
                نقطة رأس سدر هي مركز التشغيل، ونطاق الأهلية 10 كم. أي تخصيص مباشر لاحقًا لن يتجاوز هذا القيد.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
