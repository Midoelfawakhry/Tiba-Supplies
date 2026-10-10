import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Mountain, Users, Truck, ClipboardCheck, ClipboardList, Clock3, RefreshCw, AlertTriangle, Pencil } from 'lucide-react';
import { getLiveSnapshot, LiveSnapshot, liveName } from '../services/liveData';
import { supabase } from '../lib/supabase';
import { AddVehicleForm } from './AddVehicleForm';

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

const sectionPalette: Record<ScreenKey, { selected: string; accent: string; border: string; action: string; row: string; wash: string }> = {
  factories: { selected: 'border-sky-600 bg-sky-600', accent: 'text-sky-700', border: 'border-sky-200', action: 'bg-sky-600 hover:bg-sky-700', row: 'border-r-sky-400', wash: 'bg-sky-50/50' },
  quarries: { selected: 'border-amber-600 bg-amber-600', accent: 'text-amber-700', border: 'border-amber-200', action: 'bg-amber-600 hover:bg-amber-700', row: 'border-r-amber-400', wash: 'bg-amber-50/50' },
  drivers: { selected: 'border-red-600 bg-red-600', accent: 'text-red-700', border: 'border-red-200', action: 'bg-red-600 hover:bg-red-700', row: 'border-r-red-400', wash: 'bg-red-50/50' },
  vehicles: { selected: 'border-blue-600 bg-blue-600', accent: 'text-blue-700', border: 'border-blue-200', action: 'bg-blue-600 hover:bg-blue-700', row: 'border-r-blue-400', wash: 'bg-blue-50/50' },
  waiting: { selected: 'border-violet-600 bg-violet-600', accent: 'text-violet-700', border: 'border-violet-200', action: 'bg-violet-600 hover:bg-violet-700', row: 'border-r-violet-400', wash: 'bg-violet-50/50' },
  loads: { selected: 'border-orange-600 bg-orange-600', accent: 'text-orange-700', border: 'border-orange-200', action: 'bg-orange-600 hover:bg-orange-700', row: 'border-r-orange-400', wash: 'bg-orange-50/50' },
  actual: { selected: 'border-emerald-600 bg-emerald-600', accent: 'text-emerald-700', border: 'border-emerald-200', action: 'bg-emerald-600 hover:bg-emerald-700', row: 'border-r-emerald-400', wash: 'bg-emerald-50/50' },
};

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
  if (key === 'vehicles') return [row.owner_name ? 'المالك: ' + row.owner_name : '', row.truck_type ?? row.vehicle_type, row.capacity_tons ? row.capacity_tons + ' طن' : '', row.is_active === false ? 'غير نشطة' : 'نشطة'].filter(Boolean).join(' · ');
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
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverTemporaryPassword, setDriverTemporaryPassword] = useState('');
  const [driverTemporaryPasswordConfirmation, setDriverTemporaryPasswordConfirmation] = useState('');
  const [pendingAccount, setPendingAccount] = useState<{ driverId: string; name: string } | null>(null);
  const [retryingInvite, setRetryingInvite] = useState(false);
  const [driverCode, setDriverCode] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [availableVehicles, setAvailableVehicles] = useState<Row[]>([]);
  const [ownerDirectory, setOwnerDirectory] = useState<Row[]>([]);
  const [editingDriver, setEditingDriver] = useState<Row | null>(null);
  const [driverEditName, setDriverEditName] = useState('');
  const [driverEditPhone, setDriverEditPhone] = useState('');
  const [driverEditCode, setDriverEditCode] = useState('');
  const [driverEditVehicleId, setDriverEditVehicleId] = useState('');
  const [driverEditVehicles, setDriverEditVehicles] = useState<Row[]>([]);
  const [driverEditOptionsLoaded, setDriverEditOptionsLoaded] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Row | null>(null);
  const [vehicleEditPlate, setVehicleEditPlate] = useState('');
  const [vehicleEditCode, setVehicleEditCode] = useState('');
  const [vehicleEditOwnerId, setVehicleEditOwnerId] = useState('');
  const [vehicleOwnerMode, setVehicleOwnerMode] = useState<'existing' | 'new'>('existing');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingDriver, setSavingDriver] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLiveSnapshot();
      const [waitingResult, vehiclesResult, ownersResult] = await Promise.all([
        supabase.rpc('get_office_waiting_list'),
        supabase.rpc('get_available_vehicles'),
        supabase.rpc('get_vehicle_owner_directory'),
      ]);
      if (waitingResult.error) throw waitingResult.error;
      if (vehiclesResult.error) throw vehiclesResult.error;
      if (ownersResult.error) throw ownersResult.error;
      setSnapshot(data);
      setWaiting(Array.isArray(waitingResult.data) ? waitingResult.data : []);
      setAvailableVehicles(Array.isArray(vehiclesResult.data) ? vehiclesResult.data : []);
      setOwnerDirectory(Array.isArray(ownersResult.data) ? ownersResult.data : []);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل دليل بيانات المكتب.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function beginDriverEdit(row: Row) {
    setError('');
    setSuccess('');
    setEditingDriver(row);
    setDriverEditName(String(row.name ?? row.driver_name ?? ''));
    setDriverEditPhone(String(row.phone ?? ''));
    setDriverEditCode(String(row.driver_code ?? ''));
    setDriverEditVehicleId('');
    setDriverEditVehicles([]);
    setDriverEditOptionsLoaded(false);
    try {
      const { data, error: optionsError } = await supabase.rpc('get_driver_edit_options', { p_driver_id: row.driver_id });
      if (optionsError) throw optionsError;
      setDriverEditVehicles(Array.isArray(data?.vehicles) ? data.vehicles : []);
      setDriverEditVehicleId(String(data?.current_vehicle_id ?? ''));
      setDriverEditOptionsLoaded(true);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل العربيات المتاحة لتعديل السائق.');
    }
  }

  function beginVehicleEdit(row: Row) {
    setError('');
    setSuccess('');
    setEditingVehicle(row);
    setVehicleEditPlate(String(row.plate_number ?? ''));
    setVehicleEditCode(String(row.vehicle_code ?? ''));
    setVehicleEditOwnerId(String(row.owner_id ?? ''));
    setVehicleOwnerMode('existing');
    setNewOwnerName('');
    setNewOwnerPhone('');
  }

  async function saveDriverEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDriver) return;
    setSavingEdit(true);
    setError('');
    setSuccess('');
    try {
      const { data, error: updateError } = await supabase.rpc('update_operational_driver', {
        p_driver_id: editingDriver.driver_id,
        p_name: driverEditName.trim(),
        p_phone: driverEditPhone.trim(),
        p_driver_code: driverEditCode.trim() || null,
        p_vehicle_id: driverEditVehicleId || null,
      });
      if (updateError) throw updateError;
      if (!data?.success) throw new Error('تعذر تأكيد تعديل السائق.');
      setEditingDriver(null);
      setSuccess('تم تحديث بيانات السائق وربط العربية. احتفظ النظام بسجل الربط السابق.');
      await load();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const messages: Record<string, string> = {
        AUTH_REQUIRED: 'انتهت جلسة المكتب. سجّل الدخول مرة أخرى.',
        INSUFFICIENT_ROLE: 'حسابك لا يملك صلاحية تعديل السائقين.',
        DRIVER_NOT_FOUND_OR_INACTIVE: 'السائق غير موجود أو غير نشط.',
        DRIVER_PHONE_EXISTS: 'رقم الموبايل مستخدم لسائق آخر.',
        DRIVER_PHONE_INVALID: 'أدخل رقم موبايل صحيحًا.',
        DRIVER_CODE_EXISTS: 'كود السائق مستخدم بالفعل.',
        VEHICLE_ALREADY_ASSIGNED: 'العربية مرتبطة بسائق آخر. اختر عربية متاحة.',
        VEHICLE_NOT_AVAILABLE: 'العربية غير متاحة أو غير نشطة.',
        DRIVER_LOGIN_PHONE_CHANGE_REQUIRES_ACCOUNT_UPDATE: 'رقم دخول السائق مرتبط بحسابه. لا يمكن تغييره من شاشة البيانات.',
      };
      const key = Object.keys(messages).find(code => raw.includes(code));
      setError(key ? messages[key] : raw || 'تعذر تعديل بيانات السائق.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveVehicleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVehicle) return;
    setSavingEdit(true);
    setError('');
    setSuccess('');
    try {
      const { data, error: updateError } = await supabase.rpc('update_operational_vehicle', {
        p_vehicle_id: editingVehicle.vehicle_id,
        p_plate_number: vehicleEditPlate.trim(),
        p_vehicle_code: vehicleEditCode.trim() || null,
        p_owner_id: vehicleOwnerMode === 'existing' ? (vehicleEditOwnerId || null) : null,
        p_new_owner_name: vehicleOwnerMode === 'new' ? newOwnerName.trim() : null,
        p_new_owner_phone: vehicleOwnerMode === 'new' ? newOwnerPhone.trim() || null : null,
      });
      if (updateError) throw updateError;
      if (!data?.success) throw new Error('تعذر تأكيد تعديل العربية.');
      setEditingVehicle(null);
      setSuccess('تم تحديث بيانات العربية وربطها بالمالك المحدد.');
      await load();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const messages: Record<string, string> = {
        AUTH_REQUIRED: 'انتهت جلسة المكتب. سجّل الدخول مرة أخرى.',
        INSUFFICIENT_ROLE: 'حسابك لا يملك صلاحية تعديل العربيات.',
        VEHICLE_NOT_FOUND_OR_INACTIVE: 'العربية غير موجودة أو غير نشطة.',
        VEHICLE_PLATE_REQUIRED: 'اكتب رقم اللوحة.',
        VEHICLE_PLATE_EXISTS: 'رقم اللوحة مستخدم لعربية أخرى.',
        VEHICLE_CODE_EXISTS: 'كود العربية مستخدم بالفعل.',
        OWNER_REQUIRED: 'اختر مالكًا موجودًا أو اكتب بيانات المالك الجديد.',
        OWNER_NOT_FOUND_OR_INACTIVE: 'المالك غير موجود أو غير نشط. اختر مالكًا نشطًا.',
      };
      const key = Object.keys(messages).find(code => raw.includes(code));
      setError(key ? messages[key] : raw || 'تعذر تعديل بيانات العربية.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function createDriverAccount(driverId: string, temporaryPassword: string) {
    const { data, error: invokeError } = await supabase.functions.invoke('create-driver-account', {
      body: { driver_id: driverId, temporary_password: temporaryPassword },
    });
    if (invokeError) throw invokeError;
    if (!data?.success) {
      const code = String(data?.error ?? 'ACCOUNT_CREATION_FAILED');
      const messages: Record<string, string> = {
        AUTH_REQUIRED: 'انتهت جلسة الدخول. سجّل دخول المكتب مرة تانية.',
        INSUFFICIENT_ROLE: 'حسابك مش عنده صلاحية إنشاء حسابات للسائقين.',
        PHONE_ALREADY_REGISTERED: 'رقم الموبايل مربوط بحساب موجود. راجع الحساب قبل إعادة المحاولة.',
        DRIVER_ACCOUNT_ALREADY_LINKED: 'السواق ده مربوط بحساب بالفعل.',
        DRIVER_NOT_FOUND_OR_INACTIVE: 'السواق غير موجود أو غير نشط.',
        DRIVER_PHONE_INVALID: 'رقم موبايل السواق غير صالح. استخدم رقمًا مصريًا صحيحًا.',
        DRIVER_ID_REQUIRED: 'معرّف السواق مطلوب لإنشاء الحساب.',
        TEMPORARY_PASSWORD_TOO_SHORT: 'كلمة المرور المؤقتة يجب ألا تقل عن 8 أحرف.',
        ACCOUNT_CREATION_FAILED: 'تعذر إنشاء حساب الدخول. تحقق من إعدادات Supabase Auth.',
        SERVER_CONFIGURATION_MISSING: 'وظيفة إنشاء الحساب محتاجة إعدادات Supabase على الخادم.',
      };
      throw new Error(messages[code] ?? 'تعذر إنشاء حساب الدخول للسواق.');
    }
  }

  async function retryDriverAccount() {
    if (!pendingAccount) return;
    setRetryingInvite(true);
    setError('');
    try {
      await createDriverAccount(pendingAccount.driverId, driverTemporaryPassword);
      setSuccess('تم إنشاء الحساب. اسم الدخول رقم الموبايل، والسائق يغيّر كلمة المرور بعد أول دخول.');
      setPendingAccount(null);
      setDriverTemporaryPassword('');
      setDriverTemporaryPasswordConfirmation('');
    } catch (e: any) {
      setError(e?.message || 'تعذر إنشاء حساب السائق.');
    } finally {
      setRetryingInvite(false);
    }
  }

  async function createDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (driverTemporaryPassword.length < 8) {
      setError('كلمة المرور المؤقتة يجب ألا تقل عن 8 أحرف.');
      return;
    }
    if (driverTemporaryPassword !== driverTemporaryPasswordConfirmation) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    setSavingDriver(true);
    try {
      const { data: result, error: createError } = await supabase.rpc('create_operational_driver', {
        p_name: driverName.trim(),
        p_phone: driverPhone.trim(),
        p_vehicle_id: selectedVehicleId,
        p_driver_code: driverCode.trim() || null,
      });
      if (createError) throw createError;
      if (!result?.success || !result?.driver_id) throw new Error('تعذر تأكيد حفظ السواق في النظام.');
      const savedDriver = { driverId: String(result.driver_id), name: driverName.trim() };
      setDriverName('');
      setDriverPhone('');
      setDriverCode('');
      setVehicleSearch('');
      setSelectedVehicleId('');
      setShowDriverForm(false);
      setPendingAccount(savedDriver);
      try {
        await createDriverAccount(savedDriver.driverId, driverTemporaryPassword);
        setSuccess('تم حفظ السواق وربط العربية وإنشاء الحساب. اسم الدخول رقم الموبايل، والسائق يغيّر كلمة المرور بعد أول دخول.');
        setPendingAccount(null);
        setDriverTemporaryPassword('');
        setDriverTemporaryPasswordConfirmation('');
      } catch (inviteError: any) {
        setError(`تم حفظ بيانات السواق وربط العربية، لكن إنشاء حساب الدخول لم يكتمل: ${inviteError?.message || 'تعذر إنشاء الحساب'}`);
      }
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
  const filteredAvailableVehicles = availableVehicles.filter((vehicle: Row) => [vehicle.plate_number, vehicle.vehicle_code].some(value => String(value ?? '').toLowerCase().includes(vehicleSearch.trim().toLowerCase())));
  const selectedVehicle = availableVehicles.find((vehicle: Row) => String(vehicle.vehicle_id) === selectedVehicleId);
  const ActiveIcon = tabs.find(tab => tab.key === active)?.icon ?? ClipboardList;

  return (
    <section className={`space-y-4 rounded-[2rem] p-2 transition-colors sm:p-3 ${sectionPalette[active].wash}`}>
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="text-xl font-black">شاشات إدارة المكتب</h2><p className="mt-1 text-sm leading-6 text-slate-500">دليل موحّد لبيانات التشغيل الحقيقية المحمّلة من Supabase.</p></div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-bold disabled:opacity-60"><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/> تحديث البيانات</button>
      </div>
      {showSectionTabs && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const selected = active === tab.key;
          return <button key={tab.key} type="button" onClick={() => setActive(tab.key)} className={selected ? `flex min-h-16 items-center gap-2 rounded-2xl border p-3 text-right text-sm font-black text-white shadow-sm ${sectionPalette[tab.key].selected}` : 'flex min-h-16 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-right text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50'}>
            <Icon size={19} className="shrink-0"/><span>{tab.label}</span><span className="mr-auto text-xs opacity-80">{lists[tab.key].length}</span>
          </button>;
        })}
      </div>}
      {success && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>}
      {error && <div role="alert" className="flex gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} className="shrink-0"/><span>{error}</span></div>}
      {pendingAccount && <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm text-amber-950"><p className="font-black">بيانات السواق اتحفظت، ولسه إنشاء الحساب محتاج إعادة محاولة</p><p className="mt-1">{pendingAccount.name}</p><p className="mt-1 text-xs">رقم السجل: {pendingAccount.driverId}</p></div><button type="button" onClick={() => void retryDriverAccount()} disabled={retryingInvite} className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">{retryingInvite ? 'جاري إنشاء الحساب...' : 'إعادة محاولة إنشاء الحساب'}</button></div>}
      {active === 'vehicles' && <section className={`rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${sectionPalette[active].border}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-black">إضافة عربية جديدة</h3><p className="mt-1 text-sm text-slate-500">تسجيل العربية ومالكها. ربط السواق خطوة منفصلة.</p></div>
          <button type="button" onClick={() => setShowVehicleForm(v => !v)} className={`rounded-xl px-4 py-2.5 text-sm font-black text-white transition ${sectionPalette[active].action}`}>{showVehicleForm ? 'إلغاء' : 'إضافة عربية'}</button>
        </div>
        {showVehicleForm && <div className="mt-4"><AddVehicleForm onSaved={() => { void load(); setSuccess('تمت إضافة العربية ومالكها.'); }} /></div>}
      </section>}
      {active === 'drivers' && <section className={`rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${sectionPalette[active].border}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-black">إضافة سائق جديد</h3><p className="mt-1 text-sm text-slate-500">يُحفظ السائق ويرتبط برقم الموبايل والعربية، ثم يدخل برقم الموبايل وكلمة المرور.</p></div>
          <button type="button" onClick={() => { setShowDriverForm(v => !v); setError(''); setSuccess(''); }} className={`rounded-xl px-4 py-2.5 text-sm font-black text-white transition ${sectionPalette[active].action}`}>{showDriverForm ? 'إلغاء' : 'إضافة سائق'}</button>
        </div>
        {showDriverForm && <form onSubmit={createDriver} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">اسم السواق بالكامل<input required value={driverName} onChange={e => setDriverName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="اسم السواق"/></label>
          <label className="text-sm font-bold text-slate-700">رقم الموبايل<input required type="tel" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="رقم التواصل"/></label>
          <label className="text-sm font-bold text-slate-700">كلمة مرور مؤقتة للسائق<input required type="password" autoComplete="new-password" minLength={8} value={driverTemporaryPassword} onChange={e => setDriverTemporaryPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" /><span className="mt-1 block text-xs font-normal text-slate-500">اكتب كلمة مؤقتة من 8 أحرف على الأقل، وسلّمها للسائق مباشرة.</span></label>
          <label className="text-sm font-bold text-slate-700">تأكيد كلمة المرور المؤقتة<input required type="password" autoComplete="new-password" minLength={8} value={driverTemporaryPasswordConfirmation} onChange={e => setDriverTemporaryPasswordConfirmation(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" /></label>
          <div className="text-sm font-bold text-slate-700">اختيار العربية
            <label className="relative mt-1.5 block"><span className="sr-only">ابحث برقم العربية</span><input value={vehicleSearch} onChange={e => { setVehicleSearch(e.target.value); setSelectedVehicleId(''); }} className="w-full rounded-xl border border-slate-300 bg-white p-3 pr-10 font-normal" placeholder="ابحث برقم اللوحة أو كود العربية..."/><span className="absolute right-3 top-3 text-slate-400"><Truck size={18}/></span></label>
            <select required value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal">
              <option value="">اختار عربية متاحة</option>
              {filteredAvailableVehicles.map((vehicle: Row) => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.plate_number}{vehicle.vehicle_code ? ` · ${vehicle.vehicle_code}` : ''}</option>)}
            </select>
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-live="polite">
              <span className="block text-xs font-semibold text-slate-500">مالك العربية المرتبط بها تلقائيًا</span>
              <span className="mt-1 block font-bold text-slate-800">{selectedVehicle ? (selectedVehicle.owner_name || 'لا يوجد مالك مسجل لهذه العربية') : 'اختار العربية لعرض اسم المالك'}</span>
            </div>
            <p className="mt-1 text-xs font-normal text-slate-500">{filteredAvailableVehicles.length} عربية متاحة للاختيار</p>
          </div>
          <label className="text-sm font-bold text-slate-700">كود السواق (اختياري)<input value={driverCode} onChange={e => setDriverCode(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="لو عنده كود بالفعل"/></label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button disabled={savingDriver} type="submit" className={`rounded-xl px-5 py-3 text-sm font-black text-white transition disabled:opacity-60 ${sectionPalette[active].action}`}>{savingDriver ? 'جاري حفظ البيانات وإنشاء الحساب...' : 'حفظ السواق وإنشاء الحساب'}</button><p className="text-xs leading-5 text-slate-500">هيتم إنشاء الحساب باستخدام رقم الموبايل وكلمة المرور المؤقتة. السائق يغيّرها عند أول دخول؛ لا تُرسل رسائل أو إيميلات.</p></div>
        </form>}
      </section>}

      {editingDriver && active === 'drivers' && <section className="rounded-3xl border border-red-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4"><h3 className="font-black">تعديل بيانات السائق</h3><p className="mt-1 text-sm text-slate-500">غيّر بياناته أو انقله لعربية متاحة. يمكنك اختيار «بدون عربية» مؤقتًا.</p></div>
        <form onSubmit={saveDriverEdit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">اسم السائق<input required value={driverEditName} onChange={e => setDriverEditName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label>
          <label className="text-sm font-bold text-slate-700">رقم الموبايل<input required type="tel" disabled={Boolean(editingDriver.auth_user_id)} value={driverEditPhone} onChange={e => setDriverEditPhone(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal disabled:bg-slate-100"/>{editingDriver.auth_user_id && <span className="mt-1 block text-xs font-normal text-slate-500">هذا الرقم هو اسم دخول السائق، لذلك تعديله يحتاج إجراءً منفصلًا للحساب.</span>}</label>
          <label className="text-sm font-bold text-slate-700">كود السائق (اختياري)<input value={driverEditCode} onChange={e => setDriverEditCode(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label>
          <label className="text-sm font-bold text-slate-700">العربية المرتبطة<select value={driverEditVehicleId} onChange={e => setDriverEditVehicleId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"><option value="">بدون عربية مؤقتًا</option>{driverEditVehicles.map(vehicle => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.plate_number}{vehicle.owner_name ? ` · المالك: ${vehicle.owner_name}` : ''}</option>)}</select></label>
          <div className="sm:col-span-2 flex flex-wrap gap-3"><button disabled={savingEdit || !driverEditOptionsLoaded} type="submit" className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60">{savingEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}</button><button type="button" onClick={() => setEditingDriver(null)} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">إلغاء</button></div>
        </form>
      </section>}

      {editingVehicle && active === 'vehicles' && <section className="rounded-3xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4"><h3 className="font-black">تعديل بيانات العربية</h3><p className="mt-1 text-sm text-slate-500">عدّل اللوحة أو انقل الملكية لمالك موجود أو سجّل مالكًا جديدًا.</p></div>
        <form onSubmit={saveVehicleEdit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">رقم العربية / اللوحة<input required value={vehicleEditPlate} onChange={e => setVehicleEditPlate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label>
          <label className="text-sm font-bold text-slate-700">كود العربية<input value={vehicleEditCode} onChange={e => setVehicleEditCode(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label>
          <div className="sm:col-span-2">
            <div className="mb-2 text-sm font-bold text-slate-700">المالك</div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setVehicleOwnerMode('existing')} className={vehicleOwnerMode === 'existing' ? 'rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white' : 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold'}>مالك موجود</button>
              <button type="button" onClick={() => setVehicleOwnerMode('new')} className={vehicleOwnerMode === 'new' ? 'rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white' : 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold'}>مالك جديد</button>
            </div>
            {vehicleOwnerMode === 'existing' ? <select required value={vehicleEditOwnerId} onChange={e => setVehicleEditOwnerId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"><option value="">اختر المالك</option>{ownerDirectory.map(owner => <option key={owner.owner_id} value={owner.owner_id} disabled={!owner.is_active}>{owner.name}{owner.phone ? ` · ${owner.phone}` : ''}{!owner.is_active ? ' · غير نشط' : ''}</option>)}</select> : <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">اسم المالك الجديد<input required value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label><label className="text-sm font-bold text-slate-700">موبايل المالك (اختياري)<input type="tel" value={newOwnerPhone} onChange={e => setNewOwnerPhone(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label></div>}
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-3"><button disabled={savingEdit || (vehicleOwnerMode === 'existing' && ownerDirectory.length === 0)} type="submit" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60">{savingEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}</button><button type="button" onClick={() => setEditingVehicle(null)} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">إلغاء</button></div>
        </form>
      </section>}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 p-4 sm:p-5"><ActiveIcon className={sectionPalette[active].accent} size={23}/><div><h3 className="font-black">{tabs.find(tab => tab.key === active)?.label}</h3><p className="text-xs text-slate-500">{rows.length} سجل</p></div></div>
        <div className="divide-y divide-slate-100">
          {rows.map((row, index) => <article key={String(row.factory_id ?? row.quarry_id ?? row.driver_id ?? row.vehicle_id ?? row.entry_id ?? row.load_order_id ?? row.booking_id ?? row.actual_loading_record_id ?? index)} className={`border-r-4 p-4 transition-colors hover:bg-slate-50/70 sm:p-5 ${sectionPalette[active].row}`}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words font-black">{rowTitle(row, active)}</h4><p className="mt-1 break-words text-sm leading-6 text-slate-500">{rowDetails(active === 'vehicles' ? { ...row, owner_name: ownerDirectory.find(owner => String(owner.owner_id) === String(row.owner_id))?.name } : row, active) || 'لا توجد تفاصيل إضافية في السجل الحالي.'}</p></div><div className="flex shrink-0 items-center gap-2">{(active === 'drivers' || active === 'vehicles') && <button type="button" onClick={() => active === 'drivers' ? void beginDriverEdit(row) : beginVehicleEdit(row)} aria-label={active === 'drivers' ? 'تعديل بيانات السائق' : 'تعديل بيانات العربية'} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"><Pencil size={14}/> تعديل</button>}<span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">#{index + 1}</span></div></div>
          </article>)}
          {!loading && rows.length === 0 && <div className="p-10 text-center text-sm leading-6 text-slate-500">لا توجد سجلات في هذا القسم حاليًا. لن نعرض بيانات تجريبية بدل البيانات الحقيقية.</div>}
          {loading && <div className="p-8 text-center text-sm text-slate-500">جاري تحميل بيانات المكتب...</div>}
        </div>
      </div>
    </section>
  );
};
