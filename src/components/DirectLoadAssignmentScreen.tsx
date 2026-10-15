import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Truck, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLiveSnapshot, LiveSnapshot } from '../services/liveData';

export const DirectLoadAssignmentScreen: React.FC = () => {
 const [snapshot,setSnapshot]=useState<LiveSnapshot|null>(null);
 const [factoryId,setFactoryId]=useState(''); const [quarryId,setQuarryId]=useState(''); const [driverId,setDriverId]=useState(''); const [vehicleId,setVehicleId]=useState('');
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [busyBookingId,setBusyBookingId]=useState<string|null>(null); const [error,setError]=useState(''); const [success,setSuccess]=useState('');
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{setSnapshot(await getLiveSnapshot());}catch(e:any){setError(e?.message||'تعذر تحميل بيانات الإسناد.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 const activeBookings=useMemo(()=>(snapshot?.bookings??[]).filter(b=>['ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT'].includes(String(b.status).toUpperCase())),[snapshot]);
 const orders=(snapshot?.load_orders??[]).filter(o=>o.status==='PUBLISHED');
 const busyDrivers=new Set(activeBookings.map(b=>b.driver_id)); const busyVehicles=new Set(activeBookings.map(b=>b.vehicle_id));
 const vehicles=(snapshot?.vehicles??[]).filter(v=>v.is_active&&!busyVehicles.has(v.vehicle_id));
 const drivers=(snapshot?.drivers??[]).filter(d=>d.is_active&&d.vehicle_id&&!busyDrivers.has(d.driver_id)&&!busyVehicles.has(d.vehicle_id));
 const driversForSelectedVehicle=drivers.filter(d=>d.vehicle_id===vehicleId);
 const selectedDriver=(snapshot?.drivers??[]).find(d=>d.is_active&&d.driver_id===driverId);
 const selectedVehicle=(snapshot?.vehicles??[]).find(v=>v.vehicle_id===vehicleId);
 const factories=(snapshot?.factories??[]).filter(f=>f.is_active);
 const quarries=(snapshot?.quarries??[]).filter(q=>q.is_active);
 const selectedFactory=factories.find(f=>f.factory_id===factoryId);
 const selectedQuarry=quarries.find(q=>q.quarry_id===quarryId);
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
  if(!factoryId||!quarryId||!driverId||!vehicleId){setError('اختار المصنع والمحجر والعربية والسائق.');return;}
  if(!selectedVehicle||!selectedVehicle.is_active||selectedDriver?.vehicle_id!==vehicleId){setError('اختيار السائق والعربية غير متطابق. اختار سائقًا مرتبطًا بالعربية المحددة.');return;}
  if(busyDrivers.has(driverId)||busyVehicles.has(vehicleId)){setError('السائق أو العربية عليه نقلة نشطة بالفعل. حدّث البيانات وحاول مرة أخرى.');return;}
  setSaving(true);setError('');setSuccess('');
  try{
   const {data,error:rpcError}=await supabase.rpc('main_office_create_direct_trip',{p_factory_id:factoryId,p_quarry_id:quarryId,p_driver_id:driverId});
   if(rpcError)throw rpcError;
   if(!data?.booking_id||data?.status!=='ASSIGNED'||data?.direct_acceptance_status!=='PENDING'||!data?.trip_code||!data?.plate_number)throw new Error('لم يؤكد النظام إنشاء النقلة وإرسال طلب قبولها بالكامل.');
   setSuccess(`تم إنشاء النقلة وإرسال طلب قبول للسائق. النقلة لن تبدأ قبل ضغط «تأكيد» من السائق. كود النقلة: ${data.trip_code} · رقم الأمر: ${data.order_number} · المصنع: ${data.factory_name} · المحجر: ${data.quarry_name} · السائق: ${selectedDriver?.name||'—'} · العربية: ${data.plate_number} (${data.vehicle_code}).`);
   setFactoryId('');setQuarryId('');setDriverId('');setVehicleId('');await refresh();
  }catch(e:any){
   const raw=String(e?.message||'');const messages:Record<string,string>={FACTORY_QUARRY_DRIVER_REQUIRED:'اختار المصنع والمحجر والسائق.',FACTORY_NOT_ACTIVE:'المصنع غير نشط.',QUARRY_NOT_ACTIVE:'المحجر غير نشط.',ACTIVE_LINKED_VEHICLE_REQUIRED:'السائق ليس له عربية نشطة مرتبطة به.',DRIVER_NOT_ACTIVE:'السائق غير نشط.',DRIVER_OR_VEHICLE_NOT_ASSIGNED_TO_RAS_SEDR:'السائق أو العربية غير مرتبطين بمكتب رأس سدر.',DRIVER_HAS_ACTIVE_BOOKING:'السائق عليه نقلة نشطة بالفعل.',VEHICLE_HAS_ACTIVE_BOOKING:'العربية عليها نقلة نشطة بالفعل.',RAS_SEDR_BRANCH_CONFIGURATION_INVALID:'إعداد مكتب رأس سدر غير سليم.',MAIN_OFFICE_ACCESS_REQUIRED:'الإسناد متاح للمكتب الرئيسي فقط.'};
   const key=Object.keys(messages).find(k=>raw.includes(k));setError(key?messages[key]:raw||'تعذر تنفيذ الإسناد.');
  }finally{setSaving(false);}
 }
 return <section className="space-y-5">
  <header className="rounded-3xl border border-emerald-200 bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800"><Truck size={26}/></div><div className="min-w-0 flex-1"><h2 className="text-xl font-black sm:text-2xl">تخصيص مباشر — نقلة واحدة</h2><p className="mt-2 text-sm leading-7 text-slate-600">اختار المصنع والمحجر والسائق مباشرةً من غير قائمة انتظار التوزيع. النظام ينشئ أمر التحميل والتخصيص معًا، ثم يرسل للسائق طلب قبول مستقلًا. النقلة لا تبدأ قبل تأكيد السائق.</p></div><button type="button" onClick={()=>void refresh()} disabled={loading} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-60"><RefreshCw size={16} className={loading?'animate-spin':''}/><span className="hidden sm:inline">تحديث</span></button></div></header>
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
      <div><p className="font-black text-slate-900">كود النقلة: {booking.trip_code||'—'}</p><p className="mt-1 text-sm text-slate-600">السائق: {booking.driver_name||driver?.name||'—'} · العربية: {booking.plate_number||vehicle?.plate_number||'—'}</p><p className="mt-1 text-sm text-slate-600">المسار الحالي: {order?.factory_name||'مصنع غير محدد'} ← {order?.quarry_name||'محجر غير محدد'}</p><p className="mt-1 text-xs font-bold text-slate-500">الحالة التشغيلية: {String(booking.status||'').toUpperCase()}</p>{booking.assignment_type==='DIRECT'&&<p className="mt-1 text-xs font-bold text-amber-800">قبول السائق: {booking.direct_acceptance_status==='ACCEPTED'?'تم القبول'+(booking.direct_accepted_at?' · '+new Date(booking.direct_accepted_at).toLocaleString('ar-EG'):''):booking.direct_acceptance_status==='PENDING'?'في انتظار تأكيد السائق':booking.direct_acceptance_status==='LEGACY'?'تخصيص قديم قبل تسجيل القبول':'غير مطلوب'}</p>}</div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={saving||busyBookingId!==null||!redirectable} onClick={()=>void redirectBooking(booking)} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-900 disabled:opacity-40">{busyBookingId===booking.booking_id?'جارٍ التنفيذ...':'إعادة توجيه'}</button><button type="button" disabled={saving||busyBookingId!==null||!redirectable} onClick={()=>void cancelBooking(booking)} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-black text-red-800 disabled:opacity-40">إلغاء النقلة</button></div>
     </div>
    </article>;
   })}</div>}
  </section>
  <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
   <div><h3 className="text-lg font-black">إسناد نقلة مباشرة</h3><p className="mt-1 text-sm leading-6 text-slate-500">اختار المصنع والمحجر والسائق. النظام ينشئ أمرًا لنقلة واحدة ويحدد العربية المرتبطة بالسائق تلقائيًا. لا يوجد حقل كمية في الإسناد المباشر.</p></div>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="block text-sm font-bold">المصنع / العميل<select value={factoryId} onChange={e=>setFactoryId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-normal" disabled={loading}><option value="">اختار المصنع</option>{factories.map(f=><option key={f.factory_id} value={f.factory_id}>{f.name} · {f.factory_code}</option>)}</select></label>
    <label className="block text-sm font-bold">المحجر / المورد<select value={quarryId} onChange={e=>setQuarryId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-normal" disabled={loading}><option value="">اختار المحجر</option>{quarries.map(q=><option key={q.quarry_id} value={q.quarry_id}>{q.name} · {q.quarry_code}</option>)}</select></label>
   </div>
   <label className="block text-sm font-bold">العربية<select value={vehicleId} onChange={e=>{const nextVehicleId=e.target.value;setVehicleId(nextVehicleId);const linked=drivers.filter(d=>d.vehicle_id===nextVehicleId);setDriverId(linked.length===1?linked[0].driver_id:'');setError('');setSuccess('');}} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-normal" disabled={loading}><option value="">اختار العربية</option>{vehicles.map(v=><option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_number||'بدون رقم لوحة'}{v.vehicle_code?' · كود '+v.vehicle_code:''}</option>)}</select></label>
   <label className="block text-sm font-bold">السائق<select value={driverId} onChange={e=>{const nextDriverId=e.target.value;setDriverId(nextDriverId);const linkedDriver=drivers.find(d=>d.driver_id===nextDriverId);setVehicleId(linkedDriver?.vehicle_id||'');setError('');setSuccess('');}} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-normal" disabled={loading}><option value="">اختار السائق</option>{(vehicleId?driversForSelectedVehicle:drivers).map(d=><option key={d.driver_id} value={d.driver_id}>{d.name} · {d.driver_code}</option>)}</select></label>
   {vehicleId&&<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
    <p className="font-black text-slate-800">بيانات العربية والسائق المرتبط</p>
    {selectedVehicle?<div className="grid gap-2 sm:grid-cols-2"><p>رقم اللوحة: <strong>{selectedVehicle.plate_number||'—'}</strong></p><p>كود العربية: <strong>{selectedVehicle.vehicle_code||'—'}</strong></p><p>السائق المختار: <strong>{selectedDriver?.name||'اختار السائق المرتبط بالعربية'}</strong></p><p>حالة الإتاحة: <strong>متاحة مبدئيًا</strong></p></div>:<p className="text-amber-800">العربية المحددة غير متاحة. حدّث البيانات وحاول مرة أخرى.</p>}
    {driversForSelectedVehicle.length===0&&<p className="text-amber-800">لا يوجد سائق نشط مرتبط بالعربية المحددة.</p>}
   </div>}
   {factories.length===0&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">لا توجد مصانع نشطة متاحة.</p>}
   {quarries.length===0&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">لا توجد محاجر نشطة متاحة.</p>}
   <button type="button" disabled={saving||loading||!factoryId||!quarryId||!driverId||!vehicleId||!selectedVehicle||!selectedVehicle.is_active||selectedDriver?.vehicle_id!==vehicleId||busyDrivers.has(driverId)||busyVehicles.has(vehicleId)} onClick={()=>void assign()} className="w-full rounded-xl bg-emerald-600 p-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving?'جارٍ التحقق وإنشاء النقلة وإسنادها...':'إنشاء النقلة وتأكيد الإسناد'}</button>
  </div>
 </section>;
};
