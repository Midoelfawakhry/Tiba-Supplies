import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Truck, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLiveSnapshot, LiveSnapshot } from '../services/liveData';

export const DirectLoadAssignmentScreen: React.FC = () => {
 const [snapshot,setSnapshot]=useState<LiveSnapshot|null>(null);
 const [orderId,setOrderId]=useState(''); const [driverId,setDriverId]=useState(''); const [vehicleId,setVehicleId]=useState('');
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [busyBookingId,setBusyBookingId]=useState<string|null>(null); const [error,setError]=useState(''); const [success,setSuccess]=useState('');
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{setSnapshot(await getLiveSnapshot());}catch(e:any){setError(e?.message||'تعذر تحميل بيانات الإسناد.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 const activeBookings=useMemo(()=>(snapshot?.bookings??[]).filter(b=>['ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT'].includes(String(b.status).toUpperCase())),[snapshot]);
 const orders=(snapshot?.load_orders??[]).filter(o=>o.status==='PUBLISHED');
 const busyDrivers=new Set(activeBookings.map(b=>b.driver_id)); const busyVehicles=new Set(activeBookings.map(b=>b.vehicle_id));
 const drivers=(snapshot?.drivers??[]).filter(d=>d.is_active&&d.vehicle_id&&!busyDrivers.has(d.driver_id));
 const selectedDriver=drivers.find(d=>d.driver_id===driverId);
 const vehicles=(snapshot?.vehicles??[]).filter(v=>v.is_active&&!busyVehicles.has(v.vehicle_id)&&v.vehicle_id===selectedDriver?.vehicle_id);
 const selectedOrder=orders.find(o=>o.load_order_id===orderId);
 async function redirectBooking(booking: Record<string,any>) {
  const reason = window.prompt('اكتب سبب إعادة توجيه النقلة. السبب إلزامي وسيُحفظ في سجل المراجعة:');
  if (reason === null) return;
  if (!reason.trim()) { setError('سبب إعادة التوجيه إلزامي.'); return; }
  const choices = orders.filter(o => o.load_order_id !== booking.load_order_id);
  if (!choices.length) { setError('لا يوجد أمر تحميل منشور آخر متاح لإعادة التوجيه.'); return; }
  const options = choices.map(o => '#' + o.order_number + ' · ' + o.factory_name + ' ← ' + o.quarry_name).join('\n');
  const selected = window.prompt('اختار رقم أمر التحميل الجديد بكتابة رقمه من القائمة:\n' + options);
  if (selected === null) return;
  const nextOrder = choices.find(o => String(o.order_number) === selected.trim());
  if (!nextOrder) { setError('رقم أمر التحميل الجديد غير صحيح.'); return; }
  if (!window.confirm('تأكيد إعادة توجيه النقلة ' + booking.trip_code + ' إلى الأمر #' + nextOrder.order_number + '؟ كود النقلة سيظل ثابتًا.\nالسبب: ' + reason.trim())) return;
  setBusyBookingId(booking.booking_id); setError(''); setSuccess('');
  try {
   const { data, error: rpcError } = await supabase.rpc('main_office_redirect_booking', {
    p_booking_id: booking.booking_id, p_new_load_order_id: nextOrder.load_order_id, p_reason: reason.trim(),
   });
   if (rpcError) throw rpcError;
   if (!data?.booking_id || data?.trip_code !== booking.trip_code || data?.load_order_id !== nextOrder.load_order_id) throw new Error('لم يؤكد النظام إعادة التوجيه مع الحفاظ على كود النقلة.');
   setSuccess('تمت إعادة توجيه النقلة بنجاح. كودها الثابت: ' + data.trip_code + ' · الأمر الجديد #' + nextOrder.order_number + '.');
   await refresh();
  } catch (e:any) {
   const raw=String(e?.message||'');
   const messages:Record<string,string>={REDIRECT_REASON_REQUIRED:'سبب إعادة التوجيه إلزامي.',TRIP_NOT_REDIRECTABLE:'حالة النقلة الحالية لا تسمح بإعادة التوجيه.',TRIP_ALREADY_CONFIRMED:'لا يمكن إعادة توجيه نقلة بعد تأكيد التسليم.',NEW_LOAD_ORDER_NOT_AVAILABLE:'أمر التحميل الجديد غير متاح؛ حدّث القائمة.',SAME_LOAD_ORDER:'العربية مرتبطة بالفعل بأمر التحميل ده.',BOOKING_NOT_FOUND:'النقلة غير موجودة.',MAIN_OFFICE_ACCESS_REQUIRED:'إعادة التوجيه متاحة للمكتب الرئيسي فقط.'};
   const key=Object.keys(messages).find(k=>raw.includes(k)); setError(key?messages[key]:raw||'تعذر إعادة توجيه النقلة.');
  } finally { setBusyBookingId(null); }
 }
 async function cancelBooking(booking: Record<string,any>) {
  const reason = window.prompt('اكتب سبب إلغاء النقلة. السبب إلزامي وسيُحفظ في سجل المراجعة:');
  if (reason === null) return;
  if (!reason.trim()) { setError('سبب إلغاء النقلة إلزامي.'); return; }
  if (!window.confirm('تأكيد إلغاء النقلة ' + booking.trip_code + ' نهائيًا؟ سيُحتفظ بسجلها، ولن يُحذف التاريخ.\nالسبب: ' + reason.trim())) return;
  setBusyBookingId(booking.booking_id); setError(''); setSuccess('');
  try {
   const { data, error: rpcError } = await supabase.rpc('main_office_cancel_booking', {
    p_booking_id: booking.booking_id, p_reason: reason.trim(),
   });
   if (rpcError) throw rpcError;
   if (data?.status !== 'CANCELLED' || data?.booking_id !== booking.booking_id) throw new Error('لم يؤكد النظام إلغاء النقلة.');
   setSuccess('تم إلغاء النقلة ' + data.trip_code + ' مع الاحتفاظ بالسجل. لو هتسند نقلة جديدة، هيتولد لها كود جديد.');
   await refresh();
  } catch (e:any) {
   const raw=String(e?.message||'');
   const messages:Record<string,string>={CANCELLATION_REASON_REQUIRED:'سبب إلغاء النقلة إلزامي.',TRIP_NOT_CANCELLABLE:'النقلة ملغاة أو مكتملة بالفعل.',TRIP_ALREADY_CONFIRMED:'لا يمكن إلغاء نقلة بعد تأكيد التسليم.',BOOKING_NOT_FOUND:'النقلة غير موجودة.',MAIN_OFFICE_ACCESS_REQUIRED:'إلغاء النقلة متاح للمكتب الرئيسي فقط.'};
   const key=Object.keys(messages).find(k=>raw.includes(k)); setError(key?messages[key]:raw||'تعذر إلغاء النقلة.');
  } finally { setBusyBookingId(null); }
 }
 async function assign(){
  if(!orderId||!driverId||!vehicleId){setError('اختار أمر تحميل منشور وسائق وعربية.');return;}
  setSaving(true);setError('');setSuccess('');
  try{
   const {data,error:rpcError}=await supabase.rpc('main_office_direct_assign',{p_load_order_id:orderId,p_driver_id:driverId,p_vehicle_id:vehicleId});
   if(rpcError)throw rpcError;
   if(!data?.booking_id||data?.status!=='ASSIGNED')throw new Error('لم يتم تأكيد الإسناد من النظام.');
   setSuccess(`تم الإسناد بنجاح. كود النقلة: ${data.trip_code||'—'} · رقم الأمر: ${selectedOrder?.order_number??'—'}`);
   setOrderId('');setDriverId('');setVehicleId('');await refresh();
  }catch(e:any){
   const raw=String(e?.message||'');const messages:Record<string,string>={LOAD_ORDER_NOT_FOUND:'أمر التحميل غير موجود.',LOAD_ORDER_NOT_PUBLISHED:'أمر التحميل لم يعد منشورًا.',DRIVER_NOT_ACTIVE:'السائق غير نشط.',VEHICLE_NOT_ACTIVE:'العربية غير نشطة.',DRIVER_OR_VEHICLE_NOT_ASSIGNED_TO_RAS_SEDR:'السائق أو العربية غير مرتبطين بمرجع رأس سدر.',VEHICLE_NOT_ASSIGNED_TO_DRIVER:'العربية المختارة مش هي العربية المرتبطة بالسائق. راجع ربط السائق بالعربية في إدارة البيانات.',DRIVER_HAS_ACTIVE_BOOKING:'السائق عليه نقلة نشطة بالفعل.',VEHICLE_HAS_ACTIVE_BOOKING:'العربية عليها نقلة نشطة بالفعل.',RAS_SEDR_BRANCH_CONFIGURATION_INVALID:'إعداد مكتب رأس سدر غير سليم.',MAIN_OFFICE_ACCESS_REQUIRED:'الإسناد متاح للمكتب الرئيسي فقط.'};
   const key=Object.keys(messages).find(k=>raw.includes(k));setError(key?messages[key]:raw||'تعذر تنفيذ الإسناد.');
  }finally{setSaving(false);}
 }
 return <section className="space-y-5">
  <header className="rounded-3xl border border-emerald-200 bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800"><Truck size={26}/></div><div className="min-w-0 flex-1"><h2 className="text-xl font-black sm:text-2xl">إسناد نقلة من أمر تحميل</h2><p className="mt-2 text-sm leading-7 text-slate-600">الإسناد مرتبط بأمر منشور من المكتب الرئيسي، وبسائق وعربية نشطين. التحقق النهائي من الصلاحيات وحالة السائق والعربية يتم على الخادم.</p></div><button type="button" onClick={()=>void refresh()} disabled={loading} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-60"><RefreshCw size={16} className={loading?'animate-spin':''}/><span className="hidden sm:inline">تحديث</span></button></div></header>
  {error&&<div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><AlertTriangle size={18} className="mt-1 shrink-0"/><span>{error}</span></div>}
  {success&&<div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"><CheckCircle2 size={18} className="mt-1 shrink-0"/><span>{success}</span></div>}
  <section className="rounded-3xl border border-amber-200 bg-white p-5 sm:p-6 space-y-4">
   <div><h3 className="text-lg font-black">إدارة النقلات المسندة</h3><p className="mt-1 text-sm leading-6 text-slate-600">لو حصلت مشكلة، المكتب الرئيسي يقدر يعيد توجيه النقلة أو يلغيها. لازم تكتب السبب وتؤكد العملية. إعادة التوجيه تحتفظ بنفس كود النقلة؛ الإلغاء يحفظ السجل، وأي إسناد جديد يحصل بعده يأخذ كودًا جديدًا.</p></div>
   {activeBookings.length===0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">لا توجد نقلات نشطة حاليًا.</p> : <div className="space-y-3">{activeBookings.map((booking:any)=>{
    const order=(snapshot?.load_orders??[]).find(o=>o.load_order_id===booking.load_order_id);
    const driver=(snapshot?.drivers??[]).find(d=>d.driver_id===booking.driver_id);
    const vehicle=(snapshot?.vehicles??[]).find(v=>v.vehicle_id===booking.vehicle_id);
    const redirectable=['ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT'].includes(String(booking.status).toUpperCase());
    return <article key={booking.booking_id} className="rounded-2xl border border-slate-200 p-4">
     <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="font-black text-slate-900">كود النقلة: {booking.trip_code||'—'}</p><p className="mt-1 text-sm text-slate-600">السائق: {booking.driver_name||driver?.name||'—'} · العربية: {booking.plate_number||vehicle?.plate_number||'—'}</p><p className="mt-1 text-sm text-slate-600">المسار الحالي: {order?.factory_name||'مصنع غير محدد'} ← {order?.quarry_name||'محجر غير محدد'}</p><p className="mt-1 text-xs font-bold text-slate-500">الحالة: {String(booking.status||'').toUpperCase()}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={saving||busyBookingId!==null||!redirectable} onClick={()=>void redirectBooking(booking)} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-900 disabled:opacity-40">{busyBookingId===booking.booking_id?'جارٍ التنفيذ...':'إعادة توجيه'}</button><button type="button" disabled={saving||busyBookingId!==null||!redirectable} onClick={()=>void cancelBooking(booking)} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-black text-red-800 disabled:opacity-40">إلغاء النقلة</button></div>
     </div>
    </article>;
   })}</div>}
  </section>
  <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5"><div><h3 className="text-lg font-black">بيانات الإسناد</h3><p className="mt-1 text-sm text-slate-500">المتاح: {orders.length} أمر منشور · {drivers.length} سائق غير مشغول · {vehicles.length} عربية غير مشغولة</p></div>
   <label className="block text-sm font-bold">أمر التحميل المنشور<select value={orderId} onChange={e=>setOrderId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-normal" disabled={loading}><option value="">اختار أمر التحميل</option>{orders.map(o=><option key={o.load_order_id} value={o.load_order_id}>#{o.order_number} · {o.factory_name} ← {o.quarry_name} · المطلوب {o.requested_quantity}</option>)}</select></label>
   {selectedOrder&&<div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><ClipboardList className="ml-1 inline" size={16}/> المصنع: {selectedOrder.factory_name} · المحجر: {selectedOrder.quarry_name} · الكمية: {selectedOrder.requested_quantity}</div>}
   <label className="block text-sm font-bold">السائق<select value={driverId} onChange={e=>{const next=e.target.value;setDriverId(next);setVehicleId(drivers.find(d=>d.driver_id===next)?.vehicle_id??'');}} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-normal" disabled={loading}><option value="">اختار السائق</option>{drivers.map(d=><option key={d.driver_id} value={d.driver_id}>{d.name} · {d.driver_code}</option>)}</select></label>
   <label className="block text-sm font-bold">العربية المرتبطة بالسائق<select value={vehicleId} onChange={e=>setVehicleId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-normal" disabled={loading||!driverId}><option value="">{driverId?'العربية المرتبطة بالسائق':'اختار السائق الأول'}</option>{vehicles.map(v=><option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_number} · {v.vehicle_code}</option>)}</select>{driverId&&vehicles.length===0&&<span className="mt-1 block text-xs font-normal text-amber-700">العربية المرتبطة بالسائق مش متاحة حاليًا؛ راجع حالة العربية أو النقلة النشطة.</span>}</label>
   {orders.length===0&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">لا توجد أوامر منشورة متاحة. أنشئ أمرًا من مركز التشغيل وانشره أولًا.</p>}
   <button type="button" disabled={saving||loading||!orderId||!driverId||!vehicleId} onClick={()=>void assign()} className="w-full rounded-xl bg-emerald-600 p-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving?'جاري التحقق وتثبيت الإسناد...':'تأكيد إسناد النقلة'}</button>
  </div>
 </section>;
};
