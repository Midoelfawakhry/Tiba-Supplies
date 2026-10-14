import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Truck, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLiveSnapshot, LiveSnapshot } from '../services/liveData';

export const DirectLoadAssignmentScreen: React.FC = () => {
 const [snapshot,setSnapshot]=useState<LiveSnapshot|null>(null);
 const [orderId,setOrderId]=useState(''); const [driverId,setDriverId]=useState(''); const [vehicleId,setVehicleId]=useState('');
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState('');
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{setSnapshot(await getLiveSnapshot());}catch(e:any){setError(e?.message||'تعذر تحميل بيانات الإسناد.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 const activeBookings=useMemo(()=>(snapshot?.bookings??[]).filter(b=>['ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT'].includes(String(b.status).toUpperCase())),[snapshot]);
 const orders=(snapshot?.load_orders??[]).filter(o=>o.status==='PUBLISHED');
 const busyDrivers=new Set(activeBookings.map(b=>b.driver_id)); const busyVehicles=new Set(activeBookings.map(b=>b.vehicle_id));
 const drivers=(snapshot?.drivers??[]).filter(d=>d.is_active&&d.vehicle_id&&!busyDrivers.has(d.driver_id));
 const selectedDriver=drivers.find(d=>d.driver_id===driverId);
 const vehicles=(snapshot?.vehicles??[]).filter(v=>v.is_active&&!busyVehicles.has(v.vehicle_id)&&v.vehicle_id===selectedDriver?.vehicle_id);
 const selectedOrder=orders.find(o=>o.load_order_id===orderId);
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
