import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, HandCoins, RefreshCw, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLiveSnapshot, LiveSnapshot, liveName } from '../services/liveData';

export const DirectLoadAssignmentScreen: React.FC = () => {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [factoryId, setFactoryId] = useState('');
  const [quarryId, setQuarryId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSnapshot(await getLiveSnapshot());
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات الإسناد والسيارات.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const factories = snapshot?.factories ?? [];
  const quarries = snapshot?.quarries ?? [];
  const availableVehicles = snapshot?.vehicles ?? [];


  async function assign() {
    if (!factoryId || !quarryId || !vehicleId) {
      setError('اختار المصنع والمحجر والعربية الأول.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data: result, error: rpcError } = await supabase.rpc('direct_assign_standalone_load', {
        p_factory_id: factoryId,
        p_quarry_id: quarryId,
        p_vehicle_id: vehicleId,
      });
      if (rpcError) throw rpcError;
      if (!result?.success) throw new Error('تعذر تأكيد الإسناد المباشر.');
      setSuccess(`تم إرسال الإسناد المباشر للسائق، وهو الآن في انتظار قبوله. المسافة من المكتب: ${result.distance_m} متر.`);
      setVehicleId('');
      await refresh();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const messages: Record<string, string> = {
        VEHICLE_LOCATION_MISSING_OR_STALE: 'لا يمكن الإسناد: موقع العربية غير متاح أو أقدم من 10 دقائق.',
        VEHICLE_OUTSIDE_GEOFENCE: 'لا يمكن الإسناد: العربية خارج نطاق الموقع الجغرافي المعتمد لفرع رأس سدر.',
        NO_ACTIVE_DRIVER_FOR_VEHICLE: 'العربية غير مرتبطة بسائق نشط حاليًا.',
        DRIVER_HAS_ACTIVE_BOOKING: 'السائق لديه نقلة نشطة بالفعل.',
        VEHICLE_HAS_ACTIVE_BOOKING: 'العربية عليها نقلة نشطة بالفعل.',
        OFFICE_GEOFENCE_NOT_CONFIGURED: 'إحداثيات فرع رأس سدر أو نطاقه غير مضبوط في قاعدة البيانات.',
      };
      const key = Object.keys(messages).find(k => raw.includes(k));
      setError(key ? messages[key] : raw || 'تعذر تنفيذ الإسناد المباشر.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <header className="rounded-3xl border border-emerald-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800"><HandCoins size={26}/></div>
          <div>
            <h2 className="text-xl font-black sm:text-2xl">التحميل بالأمر المباشر</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">إسناد نقلة مستقلة من المكتب الرئيسي (HEAD) إلى عربية محددة، من غير ارتباط بكميات مركز التشغيل أو أوامر التحميل المنشورة. فرع رأس سدر (BRANCH) يُستخدم للموقع الجغرافي والتحقق من نطاق الـ Geofence فقط.</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="mr-auto inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/><span className="hidden sm:inline">تحديث</span></button>
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><AlertTriangle size={18} className="mt-1 shrink-0"/><span>{error}</span></div>}
      {success && <div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"><CheckCircle2 size={18} className="mt-1 shrink-0"/><span>{success}</span></div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
          <h3 className="text-lg font-black">بيانات الإسناد</h3>
          <p className="mt-1 text-sm text-slate-500">المكتب الرئيسي فقط ينفّذ الإسناد. فرع رأس سدر مرجع الموقع الجغرافي وليس جهة إدخال التحميل.</p>
          <label className="mt-5 block text-sm font-bold text-slate-700">المصنع</label>
          <select value={factoryId} onChange={e => { setFactoryId(e.target.value); setError(''); setSuccess(''); }} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
            <option value="">اختار المصنع</option>
            {factories.map(factory => <option key={factory.factory_id} value={factory.factory_id}>{liveName(factory)}</option>)}
          </select>
          <label className="mt-5 block text-sm font-bold text-slate-700">المحجر</label>
          <select value={quarryId} onChange={e => { setQuarryId(e.target.value); setError(''); setSuccess(''); }} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
            <option value="">اختار المحجر</option>
            {quarries.map(quarry => <option key={quarry.quarry_id} value={quarry.quarry_id}>{liveName(quarry)}</option>)}
          </select>
          <label className="mt-5 block text-sm font-bold text-slate-700">العربية</label>
          <select value={vehicleId} onChange={e => { setVehicleId(e.target.value); setError(''); setSuccess(''); }} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
            <option value="">اختار العربية</option>
            {availableVehicles.map(vehicle => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.plate_number ?? vehicle.vehicle_code ?? vehicle.vehicle_id}</option>)}
          </select>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
            <b>شروط التأكيد:</b> السائق مرتبط بالعربية، وموقع GPS حديث (آخر 10 دقائق)، والعربية داخل النطاق الجغرافي المضبوط لفرع رأس سدر. لا يمكن إسناد نقلة نشطة ثانية لنفس السائق أو العربية.
          </div>
          <button type="button" disabled={saving || loading || !factoryId || !quarryId || !vehicleId} onClick={() => void assign()} className="mt-5 w-full rounded-xl bg-emerald-600 p-4 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'جاري التحقق وتثبيت الإسناد...' : 'تأكيد الإسناد المباشر'}</button>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><Truck size={20} className="text-blue-700"/><h3 className="font-black">ملخص الإسناد المباشر</h3></div>
            <div className="mt-4 space-y-3 text-sm">
              <div><span className="text-slate-500">المصنع</span><div className="mt-1 font-bold">{liveName(factories.find(f => f.factory_id === factoryId))}</div></div>
              <div><span className="text-slate-500">المحجر</span><div className="mt-1 font-bold">{liveName(quarries.find(q => q.quarry_id === quarryId))}</div></div>
              <div><span className="text-slate-500">العربية</span><div className="mt-1 font-bold">{String(availableVehicles.find(v => v.vehicle_id === vehicleId)?.plate_number ?? availableVehicles.find(v => v.vehicle_id === vehicleId)?.vehicle_code ?? 'لم يتم الاختيار')}</div></div>
            </div>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5"><h3 className="font-black">حالة البيانات</h3><div className="mt-3 text-sm leading-7 text-slate-600">{loading ? 'جاري تحميل البيانات...' : `مصانع: ${factories.length} · محاجر: ${quarries.length} · عربيات: ${availableVehicles.length}`}</div></section>
        </aside>
      </div>
    </section>
  );
};
