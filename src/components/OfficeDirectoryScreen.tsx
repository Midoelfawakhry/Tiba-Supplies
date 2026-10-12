import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Mountain, Users, UserX, Truck, ClipboardCheck, ClipboardList, Clock3, RefreshCw, AlertTriangle, Pencil, UserMinus, Phone } from 'lucide-react';
import { getLiveSnapshot, LiveSnapshot, liveName } from '../services/liveData';
import { supabase } from '../lib/supabase';
import { AddVehicleForm } from './AddVehicleForm';

type ScreenKey = 'factories' | 'quarries' | 'drivers' | 'vehicles' | 'waiting' | 'loads' | 'actual';
type Row = Record<string, any>;
const tabs: { key: ScreenKey; label: string; icon: React.ElementType }[] = [
  { key: 'factories', label: 'المصانع والعملاء', icon: Building2 },
  { key: 'quarries', label: 'المحاجر والموردون', icon: Mountain },
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
  if (key === 'factories') return liveName(row);
  if (key === 'quarries') return liveName(row);
  if (key === 'drivers') return row.name ?? row.driver_name ?? 'سائق بدون اسم';
  if (key === 'vehicles') return row.plate_number ?? row.vehicle_code ?? 'عربية بدون لوحة';
  if (key === 'waiting') return row.plate_number ?? row.driver_name ?? 'عنصر انتظار';
  if (key === 'loads') return liveName(row, row.load_order_id ?? 'أمر تحميل');
  return row.trip_code ?? row.ticket_number ?? row.record_number ?? row.actual_loading_record_id ?? 'سجل تحميل فعلي';
}
function rowDetails(row: Row, key: ScreenKey) {
  if (key === 'factories') return [row.code, row.address, row.phone, row.is_active === false ? 'غير نشط' : 'نشط'].filter(Boolean).join(' · ');
  if (key === 'quarries') return [row.code, row.address, row.phone, row.is_active === false ? 'غير نشط' : 'نشط'].filter(Boolean).join(' · ');
  if (key === 'drivers') return [row.phone, row.driver_code, row.is_active === false ? 'غير نشط' : 'نشط'].filter(Boolean).join(' · ');
  if (key === 'vehicles') return [row.owner_name ? 'المالك: ' + row.owner_name : '', row.truck_type ?? row.vehicle_type, row.capacity_tons ? row.capacity_tons + ' طن' : '', row.is_active === false ? 'غير نشطة' : 'نشطة'].filter(Boolean).join(' · ');
  if (key === 'waiting') return [row.driver_name, row.status, row.arrived_at ? new Date(row.arrived_at).toLocaleString('ar-EG') : ''].filter(Boolean).join(' · ');
  if (key === 'loads') return [row.status, row.requested_quantity ? 'المطلوب: ' + row.requested_quantity : '', row.created_at ? new Date(row.created_at).toLocaleString('ar-EG') : ''].filter(Boolean).join(' · ');
  return [row.loading_sequence_date || row.load_date, row.daily_load_number ? 'تحميل اليوم #' + row.daily_load_number : '', row.ticket_number ? 'تذكرة: ' + row.ticket_number : '', row.actual_weight != null ? 'الوزن: ' + row.actual_weight + ' طن' : 'الوزن لم يُسجل', row.driver_id ? 'معرّف السائق: ' + row.driver_id : '', row.vehicle_id ? 'معرّف العربية: ' + row.vehicle_id : '', row.created_at ? new Date(row.created_at).toLocaleString('ar-EG') : ''].filter(Boolean).join(' · ');
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
  const [passwordResetDriver, setPasswordResetDriver] = useState<Row | null>(null);
  const [newDriverPassword, setNewDriverPassword] = useState('');
  const [confirmDriverPassword, setConfirmDriverPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [driverCode, setDriverCode] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [entitySearch, setEntitySearch] = useState('');
  const [showMasterForm, setShowMasterForm] = useState(false);
  const [editingMasterEntry, setEditingMasterEntry] = useState<Row | null>(null);
  const [masterForm, setMasterForm] = useState({ name: '', code: '', address: '', phone: '', is_active: true });
  const [savingMaster, setSavingMaster] = useState(false);
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

  async function removeWaitingEntry(row: Row) {
    const driverName = String(row.driver_name ?? 'السائق');
    const plate = String(row.plate_number ?? 'العربية غير محددة');
    const reason = window.prompt(`اكتب سبب إزالة ${driverName} — ${plate} من قائمة الانتظار:`);
    if (!reason?.trim()) return;
    if (!window.confirm(`تأكيد إزالة ${driverName} من قائمة الانتظار؟ سيتم الاحتفاظ بسجل الدخول وتسجيل اسم منفّذ الإجراء وسببه.`)) return;
    setError('');
    setSuccess('');
    setSavingEdit(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('office_remove_waiting_entry', {
        p_entry_id: row.entry_id,
        p_reason: reason.trim(),
      });
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error('تعذر تأكيد إزالة السائق من قائمة الانتظار.');
      setSuccess('تمت إزالة السائق من قائمة الانتظار مع الاحتفاظ بالسجل التاريخي وتسجيل السبب.');
      await load();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const messages: Record<string, string> = {
        AUTH_REQUIRED: 'انتهت جلسة المكتب. سجّل الدخول مرة أخرى.',
        INSUFFICIENT_ROLE: 'إزالة السائق من قائمة الانتظار متاحة للمكتب الرئيسي فقط.',
        WAITING_ENTRY_NOT_FOUND: 'عنصر الانتظار غير موجود أو لم يعد في حالة انتظار.',
        WAITING_ENTRY_NOT_IN_BRANCH_QUEUE: 'عنصر الانتظار ليس ضمن قائمة انتظار رأس سدر الحالية.',
        REMOVE_REASON_REQUIRED: 'اكتب سبب الإزالة أولًا.',
      };
      const key = Object.keys(messages).find(code => raw.includes(code));
      setError(key ? messages[key] : raw || 'تعذر إزالة السائق من قائمة الانتظار.');
    } finally {
      setSavingEdit(false);
    }
  }

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

  async function deactivateDriver(row: Row) {
    const name = String(row.name ?? row.driver_name ?? 'السائق');
    if (!window.confirm('تأكيد إيقاف ' + name + '؟ سيتم منعه من الاختيارات الجديدة مع الاحتفاظ بكل سجلات التحميل والربط السابقة. لن يتم الإيقاف لو عليه نقلة نشطة.')) return;
    setError(''); setSuccess(''); setSavingEdit(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('set_operational_driver_active', { p_driver_id: row.driver_id, p_is_active: false });
      if (rpcError) throw rpcError; if (!data?.success) throw new Error('تعذر تأكيد إيقاف السائق.');
      setEditingDriver(null); setSuccess('تم إيقاف السائق مع الاحتفاظ بالسجلات التاريخية.'); await load();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const messages: Record<string,string> = { AUTH_REQUIRED: 'انتهت جلسة المكتب. سجّل الدخول مرة أخرى.', INSUFFICIENT_ROLE: 'إيقاف السائق متاح للمكتب الرئيسي فقط.', DRIVER_NOT_FOUND: 'السائق غير موجود.', DRIVER_HAS_ACTIVE_BOOKING: 'لا يمكن إيقاف السائق لأن عليه نقلة نشطة. أنهِ النقلة أو ألغها أولًا.' };
      const key = Object.keys(messages).find(code => raw.includes(code)); setError(key ? messages[key] : raw || 'تعذر إيقاف السائق.');
    } finally { setSavingEdit(false); }
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
        TEMPORARY_PASSWORD_TOO_SHORT: 'كلمة المرور يجب ألا تقل عن 8 أحرف.',
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
      setSuccess('تم إنشاء حساب السائق. اسم المستخدم هو رقم الموبايل، وكلمة المرور هي التي حددتها.');
      setPendingAccount(null);
      setDriverTemporaryPassword('');
      setDriverTemporaryPasswordConfirmation('');
    } catch (e: any) {
      setError(e?.message || 'تعذر إنشاء حساب السائق.');
    } finally {
      setRetryingInvite(false);
    }
  }

  async function resetDriverPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordResetDriver) return;
    setError('');
    setSuccess('');
    if (newDriverPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.');
      return;
    }
    if (newDriverPassword !== confirmDriverPassword) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    setResettingPassword(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-driver-account', {
        body: { action: 'reset_password', driver_id: passwordResetDriver.driver_id, temporary_password: newDriverPassword },
      });
      if (invokeError) throw invokeError;
      if (!data?.success) {
        const code = String(data?.error ?? 'PASSWORD_RESET_FAILED');
        const messages: Record<string, string> = {
          AUTH_REQUIRED: 'انتهت جلسة المكتب. سجّل الدخول مرة أخرى.',
          INSUFFICIENT_ROLE: 'إدارة كلمات المرور متاحة للمكتب الرئيسي فقط.',
          DRIVER_NOT_FOUND_OR_INACTIVE: 'السائق غير موجود أو غير نشط.',
          DRIVER_ACCOUNT_NOT_LINKED: 'السائق ليس لديه حساب دخول مرتبط. أنشئ حسابه أولًا من قائمة السائقين.',
          TEMPORARY_PASSWORD_TOO_SHORT: 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.',
        };
        throw new Error(messages[code] ?? 'تعذر تحديث كلمة مرور السائق.');
      }
      setPasswordResetDriver(null);
      setNewDriverPassword('');
      setConfirmDriverPassword('');
      setSuccess('تم تحديث كلمة المرور. سيستخدم السائق كلمة المرور الجديدة مباشرة.');
    } catch (e: any) {
      setError(e?.message || 'تعذر تحديث كلمة مرور السائق.');
    } finally {
      setResettingPassword(false);
    }
  }

  async function createDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (driverTemporaryPassword.length < 8) {
      setError('كلمة المرور يجب ألا تقل عن 8 أحرف.');
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
        setSuccess('تم حفظ السائق وربط العربية وإنشاء الحساب. اسم المستخدم هو رقم الموبايل، وكلمة المرور هي التي حددتها.');
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

  function beginMasterEntryEdit(row?: Row) {
    setEditingMasterEntry(row ?? null);
    setMasterForm({ name: String(row?.name ?? ''), code: String(row?.code ?? ''), address: String(row?.address ?? ''), phone: String(row?.phone ?? ''), is_active: row?.is_active !== false });
    setShowMasterForm(true); setError(''); setSuccess('');
  }

  async function saveMasterEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!['factories', 'quarries'].includes(active)) return;
    setSavingMaster(true); setError(''); setSuccess('');
    try {
      const { data, error: rpcError } = await supabase.rpc('save_master_directory_entry', {
        p_entity_type: active === 'factories' ? 'factory' : 'quarry',
        p_entity_id: editingMasterEntry ? (active === 'factories' ? editingMasterEntry.factory_id : editingMasterEntry.quarry_id) : null,
        p_name: masterForm.name.trim(), p_code: masterForm.code.trim() || null,
        p_address: masterForm.address.trim() || null, p_phone: masterForm.phone.trim() || null,
        p_is_active: masterForm.is_active,
      });
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error('تعذر تأكيد حفظ بيانات الدليل.');
      setShowMasterForm(false); setEditingMasterEntry(null);
      setMasterForm({ name: '', code: '', address: '', phone: '', is_active: true });
      setSuccess(editingMasterEntry ? 'تم تحديث بيانات الدليل بنجاح.' : 'تمت إضافة البيانات إلى دليل المكتب.');
      await load();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const messages: Record<string, string> = {
        AUTH_REQUIRED: 'انتهت جلسة المكتب. سجّل الدخول مرة أخرى.',
        INSUFFICIENT_ROLE: 'إضافة وتعديل المصانع والمحاجر متاحان للمكتب الرئيسي فقط.',
        INVALID_DIRECTORY_ENTITY_TYPE: 'نوع السجل غير صالح.',
        DIRECTORY_NAME_REQUIRED: 'اكتب اسم المصنع أو المحجر.',
        DIRECTORY_NAME_EXISTS: 'اسم المصنع أو المحجر مستخدم بالفعل في هذا الدليل.',
        DIRECTORY_CODE_EXISTS: 'الكود مستخدم بالفعل في هذا الدليل. راجع السجلات قبل الحفظ.',
        DIRECTORY_ENTRY_NOT_FOUND: 'السجل المراد تعديله لم يعد موجودًا.',
      };
      const key = Object.keys(messages).find(code => raw.includes(code));
      setError(key ? messages[key] : raw || 'تعذر حفظ بيانات الدليل. تأكد من نشر Migration المعتمدة أولًا.');
    } finally { setSavingMaster(false); }
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
  const visibleRows = active === 'drivers' ? rows.filter(row => String(row.name ?? row.driver_name ?? '').toLocaleLowerCase().includes(driverSearch.trim().toLocaleLowerCase())) : ['factories', 'quarries'].includes(active) ? rows.filter(row => [liveName(row), row.code, row.address, row.phone].some(value => String(value ?? '').toLocaleLowerCase().includes(entitySearch.trim().toLocaleLowerCase()))) : rows;
  const filteredAvailableVehicles = availableVehicles.filter((vehicle: Row) => [vehicle.plate_number, vehicle.vehicle_code].some(value => String(value ?? '').toLowerCase().includes(vehicleSearch.trim().toLowerCase())));
  const selectedVehicle = availableVehicles.find((vehicle: Row) => String(vehicle.vehicle_id) === selectedVehicleId);
  const ActiveIcon = tabs.find(tab => tab.key === active)?.icon ?? ClipboardList;

  return (
    <section className={`space-y-4 rounded-[2rem] p-2 transition-colors sm:p-3 ${sectionPalette[active].wash}`}>
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full bg-sky-100/70 blur-2xl"/>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md"><Building2 size={25}/></span><div><h2 className="text-xl font-black tracking-tight">إدارة المكتب</h2><p className="mt-1 text-sm leading-6 text-slate-500">مركز تشغيل موحّد لبيانات المكتب الفعلية.</p></div></div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/> تحديث البيانات</button>
        </div>
      </div>
      {showSectionTabs && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const selected = active === tab.key;
          return <button key={tab.key} type="button" onClick={() => setActive(tab.key)} aria-pressed={selected} className={selected ? `group flex min-h-[88px] items-center gap-3 rounded-2xl border p-3 text-right text-sm font-black text-white shadow-md ring-2 ring-offset-1 transition ${sectionPalette[tab.key].selected} ring-white/70` : 'group flex min-h-[88px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-right text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'}>
            <span className={selected ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20' : `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${sectionPalette[tab.key].wash} ${sectionPalette[tab.key].accent}`}><Icon size={22} strokeWidth={2.2}/></span>
            <span className="min-w-0 flex-1 leading-5">{tab.label}</span>
            <span className={selected ? 'flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 text-xs tabular-nums' : `flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs tabular-nums ${sectionPalette[tab.key].wash} ${sectionPalette[tab.key].accent}`}>{lists[tab.key].length}</span>
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
          <label className="text-sm font-bold text-slate-700">اسم السواق بالكامل<input required value={driverName} onChange={e => setDriverName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="اسم السواق"/><span className="mt-1 block text-xs font-normal text-slate-500">مسموح تكرار الاسم؛ التمييز بيكون برقم الموبايل وكود السائق إن وُجد.</span></label>
          <label className="text-sm font-bold text-slate-700">رقم الموبايل — اسم المستخدم<div className="relative mt-1.5"><Phone size={18} className="absolute right-3 top-3.5 text-slate-400"/><input required type="tel" inputMode="tel" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white p-3 pr-10 font-normal" placeholder="01012345678"/></div><span className="mt-1 block text-xs font-normal text-slate-500">السائق سيدخل بهذا الرقم وكلمة المرور التي تحددها.</span></label>
          <label className="text-sm font-bold text-slate-700">كلمة مرور السائق<input required type="password" autoComplete="new-password" minLength={8} value={driverTemporaryPassword} onChange={e => setDriverTemporaryPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" /><span className="mt-1 block text-xs font-normal text-slate-500">دي كلمة المرور التي ستنشئ بها حساب السائق. سلّمها له مباشرة.</span></label>
          <label className="text-sm font-bold text-slate-700">تأكيد كلمة المرور<input required type="password" autoComplete="new-password" minLength={8} value={driverTemporaryPasswordConfirmation} onChange={e => setDriverTemporaryPasswordConfirmation(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" /></label>
          <div className="text-sm font-bold text-slate-700">اختيار رقم العربية المرتبطة بالسائق
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
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button disabled={savingDriver} type="submit" className={`rounded-xl px-5 py-3 text-sm font-black text-white transition disabled:opacity-60 ${sectionPalette[active].action}`}>{savingDriver ? 'جاري حفظ البيانات وإنشاء الحساب...' : 'حفظ السواق وإنشاء الحساب'}</button><p className="text-xs leading-5 text-slate-500">رقم الموبايل هو اسم المستخدم، وكلمة المرور التي تحددها هنا هي كلمة الدخول. لا تُرسل رسائل أو إيميلات.</p></div>
        </form>}
      </section>}

      {passwordResetDriver && active === 'drivers' && <section className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4"><h3 className="font-black">تعيين كلمة مرور جديدة</h3><p className="mt-1 text-sm text-slate-500">السائق: {passwordResetDriver.name ?? passwordResetDriver.driver_name ?? 'سائق'}. سيتم طلب تغيير كلمة المرور عند أول دخول.</p></div>
        <form onSubmit={resetDriverPassword} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">كلمة المرور الجديدة<input required type="password" autoComplete="new-password" minLength={8} value={newDriverPassword} onChange={e => setNewDriverPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label>
          <label className="text-sm font-bold text-slate-700">تأكيد كلمة المرور<input required type="password" autoComplete="new-password" minLength={8} value={confirmDriverPassword} onChange={e => setConfirmDriverPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label>
          <div className="sm:col-span-2 flex flex-wrap gap-3"><button disabled={resettingPassword} type="submit" className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{resettingPassword ? 'جاري تحديث كلمة المرور...' : 'تأكيد كلمة المرور الجديدة'}</button><button type="button" onClick={() => { setPasswordResetDriver(null); setNewDriverPassword(''); setConfirmDriverPassword(''); }} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">إلغاء</button></div>
        </form>
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

      {['factories', 'quarries'].includes(active) && <>
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block flex-1 text-sm font-bold text-slate-700">البحث بالاسم أو الكود أو العنوان أو التليفون<input value={entitySearch} onChange={e => setEntitySearch(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" placeholder={active === 'factories' ? 'ابحث عن مصنع أو عميل...' : 'ابحث عن محجر أو مورد...'} /></label>
          <button type="button" onClick={() => beginMasterEntryEdit()} className={`rounded-xl px-4 py-3 text-sm font-black text-white ${sectionPalette[active].action}`}>إضافة {active === 'factories' ? 'مصنع / عميل' : 'محجر / مورد'}</button>
        </div>
        {showMasterForm && <form onSubmit={saveMasterEntry} className={`grid gap-3 rounded-3xl border bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5 ${sectionPalette[active].border}`}>
          <div className="sm:col-span-2"><h3 className="font-black">{editingMasterEntry ? 'تعديل بيانات' : 'إضافة'} {active === 'factories' ? 'مصنع / عميل' : 'محجر / مورد'}</h3><p className="mt-1 text-xs text-slate-500">الحفظ يتم في Supabase بصلاحيات المكتب الرئيسي، مع التحقق من عدم تكرار الكود.</p></div>
          <label className="text-sm font-bold text-slate-700">الاسم *<input required maxLength={200} value={masterForm.name} onChange={e => setMasterForm(v => ({...v, name:e.target.value}))} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
          <label className="text-sm font-bold text-slate-700">الكود<input maxLength={80} value={masterForm.code} onChange={e => setMasterForm(v => ({...v, code:e.target.value}))} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
          <label className="text-sm font-bold text-slate-700">العنوان / المنطقة<input maxLength={300} value={masterForm.address} onChange={e => setMasterForm(v => ({...v, address:e.target.value}))} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
          <label className="text-sm font-bold text-slate-700">رقم التليفون<input type="tel" maxLength={40} value={masterForm.phone} onChange={e => setMasterForm(v => ({...v, phone:e.target.value}))} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={masterForm.is_active} onChange={e => setMasterForm(v => ({...v, is_active:e.target.checked}))} /> سجل نشط</label>
          <div className="sm:col-span-2 flex flex-wrap gap-3"><button disabled={savingMaster} type="submit" className={`rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-60 ${sectionPalette[active].action}`}>{savingMaster ? 'جاري الحفظ...' : 'حفظ البيانات'}</button><button type="button" onClick={() => {setShowMasterForm(false);setEditingMasterEntry(null);}} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">إلغاء</button></div>
        </form>}
      </>}
      {active === 'drivers' && <div className="rounded-2xl border border-slate-200 bg-white p-3"><label className="block text-sm font-bold text-slate-700">البحث عن سائق بالاسم<input value={driverSearch} onChange={e => setDriverSearch(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" placeholder="اكتب اسم السائق..." /></label></div>}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className={`flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:p-5 ${sectionPalette[active].border} ${sectionPalette[active].wash}`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 ${sectionPalette[active].accent}`}><ActiveIcon size={25} strokeWidth={2.2}/></span>
            <div><h3 className="font-black">{tabs.find(tab => tab.key === active)?.label}</h3><p className="mt-1 text-xs text-slate-500">بيانات التشغيل الفعلية · محدثة من النظام</p></div>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-black shadow-sm ring-1 ring-black/5 ${sectionPalette[active].accent}`}><ClipboardList size={15}/>{visibleRows.length} سجل</span>
        </div>
        <div className="divide-y divide-slate-100">
          {visibleRows.map((row, index) => <article key={String(row.factory_id ?? row.quarry_id ?? row.driver_id ?? row.vehicle_id ?? row.entry_id ?? row.load_order_id ?? row.booking_id ?? row.actual_loading_record_id ?? index)} className={active === 'waiting' ? 'border-r-2 border-r-violet-400 px-2 py-1.5 transition-colors hover:bg-violet-50/60' : `border-r-4 p-4 transition-colors hover:bg-slate-50/70 sm:p-5 ${sectionPalette[active].row}`}>
            <div className={active === 'waiting' ? 'flex min-w-0 items-center gap-2 text-xs leading-5' : 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3'}>
              {active === 'waiting' && <span className="w-5 shrink-0 text-center font-bold tabular-nums text-violet-700">{index + 1}</span>}
              <div className={active === 'waiting' ? 'flex min-w-0 flex-1 items-center gap-2' : 'flex min-w-0 flex-1 items-start gap-3'}>
                {active !== 'waiting' && <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${sectionPalette[active].wash} ${sectionPalette[active].accent}`}><ActiveIcon size={20} strokeWidth={2.1}/></span>}
                <div className={active === 'waiting' ? 'flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5' : 'min-w-0 flex-1'}><h4 className={active === 'waiting' ? 'font-semibold text-xs leading-5' : 'font-black leading-6 [overflow-wrap:anywhere]'}>{active === 'waiting' ? `${row.plate_number || 'عربية غير محددة'} · ${row.driver_name || 'سائق غير محدد'} · ${row.arrived_at ? new Date(row.arrived_at).toLocaleDateString('ar-EG') : '—'}` : rowTitle(row, active)}</h4>{active !== 'waiting' && <p className="mt-1 break-words text-sm leading-6 text-slate-500">{rowDetails(active === 'vehicles' ? { ...row, owner_name: ownerDirectory.find(owner => String(owner.owner_id) === String(row.owner_id))?.name } : row, active) || 'لا توجد تفاصيل إضافية في السجل الحالي.'}{active === 'drivers' && row.vehicle_id ? ` · العربية: ${snapshot?.vehicles?.find((vehicle: Row) => String(vehicle.vehicle_id) === String(row.vehicle_id))?.plate_number ?? 'غير محددة'}` : ''}</p>}{active === 'drivers' && row.phone && <a href={`tel:${String(row.phone).replace(/[^+\d]/g, '')}`} onClick={event => event.stopPropagation()} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800"><Phone size={14}/> اتصال {row.phone}</a>}</div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{['factories', 'quarries'].includes(active) && <button type="button" onClick={() => beginMasterEntryEdit(row)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"><Pencil size={14}/> تعديل</button>}{active === 'waiting' && row.status === 'WAITING' && <button type="button" disabled={savingEdit} onClick={() => void removeWaitingEntry(row)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50"><UserMinus size={14}/> إزالة من الانتظار</button>}{active === 'drivers' && row.is_active !== false && row.auth_user_id && <button type="button" onClick={() => { setPasswordResetDriver(row); setNewDriverPassword(''); setConfirmDriverPassword(''); setEditingDriver(null); setError(''); setSuccess(''); }} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800">كلمة المرور</button>}{active === "drivers" && row.is_active !== false && <button type="button" disabled={savingEdit} onClick={() => void deactivateDriver(row)} aria-label="إيقاف السائق" className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50"><UserX size={14}/> إيقاف</button>}{(active === 'drivers' || active === 'vehicles') && <button type="button" onClick={() => active === 'drivers' ? void beginDriverEdit(row) : beginVehicleEdit(row)} aria-label={active === 'drivers' ? 'تعديل بيانات السائق' : 'تعديل بيانات العربية'} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"><Pencil size={14}/> تعديل</button>}
              {active === 'actual' && row.booking_id && !['CANCELLED', 'DELIVERED', 'COMPLETED'].includes(snapshot?.bookings?.find((b: Row) => b.booking_id === row.booking_id)?.status) && !row.delivery_confirmed_at && row.actual_weight == null && <button type="button" onClick={async () => {
                const reason = window.prompt('اكتب سبب إلغاء النقلة:');
                if (!reason?.trim()) return;
                const vehicleOut = window.confirm('هل العربية فيها عطل أو لازم تفضل خارج الخدمة؟ اضغط موافق لو خارج الخدمة، أو إلغاء لو ترجع لقائمة الانتظار.');
                setError(''); setSuccess('');
                try {
                  const { data, error: rpcError } = await supabase.rpc('office_cancel_booking', { p_booking_id: row.booking_id, p_reason: reason.trim(), p_vehicle_out_of_service: vehicleOut });
                  if (rpcError) throw rpcError;
                  if (!data?.success) throw new Error('تعذر تأكيد إلغاء النقلة.');
                  setSuccess(vehicleOut ? 'تم إلغاء النقلة وحفظ سجلها. العربية لم تُرجع لقائمة الانتظار لأنها خارج الخدمة.' : 'تم إلغاء النقلة وحفظ سجلها، وإرجاع العربية إلى آخر قائمة الانتظار كبداية دورة جديدة.');
                  await load();
                } catch (e: any) { setError(e?.message || 'تعذر إلغاء النقلة.'); }
              }} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700">إلغاء النقلة</button>}
              {active === 'actual' && row.booking_id && snapshot?.bookings?.find((b: Row) => b.booking_id === row.booking_id)?.status !== 'CANCELLED' && <button type="button" onClick={async () => {
                const factories = snapshot?.factories ?? [];
                const options = factories.map((f: Row) => `${f.name} [${f.factory_id}]`).join('\n');
                const chosen = window.prompt('اكتب معرّف المصنع الجديد كما هو ظاهر بين الأقواس:\n' + options, '');
                if (!chosen?.trim()) return;
                const match = chosen.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
                if (!match || !factories.some((f: Row) => f.factory_id === match[1])) { setError('معرّف المصنع غير صحيح. انسخه من القائمة المعروضة.'); return; }
                const reason = window.prompt('اكتب سبب إعادة توجيه النقلة:');
                if (!reason?.trim()) return;
                setError(''); setSuccess('');
                try {
                  const { data, error: rpcError } = await supabase.rpc('office_redirect_booking', { p_booking_id: row.booking_id, p_factory_id: match[1], p_reason: reason.trim() });
                  if (rpcError) throw rpcError;
                  if (!data?.success) throw new Error('تعذر تأكيد إعادة توجيه النقلة.');
                  setSuccess(row.delivery_confirmed_at || row.actual_weight != null || ['DELIVERED', 'COMPLETED'].includes(snapshot?.bookings?.find((b: Row) => b.booking_id === row.booking_id)?.status) ? 'تم تصحيح وجهة نقلة لها وزن/تسليم مسجل. احتفظ النظام ببيانات الوزن والتسليم وسجل الوجهة السابقة والجديدة وسبب التصحيح.' : 'تم تغيير وجهة النقلة إلى المصنع الجديد، مع حفظ سبب التوجيه وسجل الوجهة السابقة والجديدة.');
                  await load();
                } catch (e: any) { setError(e?.message || 'تعذر إعادة توجيه النقلة.'); }
              }} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800">إعادة توجيه</button>}{active !== 'waiting' && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">#{index + 1}</span>}</div></div>
          </article>)}
          {!loading && rows.length === 0 && <div className="p-10 text-center text-sm leading-6 text-slate-500">لا توجد سجلات في هذا القسم حاليًا. لن نعرض بيانات تجريبية بدل البيانات الحقيقية.</div>}
          {loading && <div className="p-8 text-center text-sm text-slate-500">جاري تحميل بيانات المكتب...</div>}
        </div>
      </div>
    </section>
  );
};
