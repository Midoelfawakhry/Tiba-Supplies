import React, { useEffect, useState } from 'react';
import { MapPin, Truck, Clock3, ShieldCheck, LogOut, Navigation, CircleAlert, FileText } from 'lucide-react';
import { supabase, supabaseDiagnostics } from '../lib/supabase';
import { registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { Geolocation } from '@capacitor/geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

type PositionState = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

export const DriverApp: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [driverAuthorized, setDriverAuthorized] = useState(false);
  const [error, setError] = useState(supabaseDiagnostics.configurationError);
  const [position, setPosition] = useState<PositionState | null>(null);
  const [locating, setLocating] = useState(false);
  const [portal, setPortal] = useState<any>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const mustChangePassword = session?.user?.app_metadata?.must_change_password === true;

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | undefined;

    async function initialize() {
      if (supabaseDiagnostics.configurationError) {
        setLoading(false);
        return;
      }
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        setSession(data.session);
        const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
          if (active) setSession(next);
        });
        subscription = listener.subscription;
      } catch (e: any) {
        if (active) setError(e?.message || 'تعذر الاتصال بخدمة الدخول.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  async function refreshPortal() {
    if (!session) return;
    setPortalLoading(true);
    const { data, error: portalError } = await supabase.rpc('get_driver_portal_snapshot');
    if (portalError) {
      setError(portalError.message || 'تعذر تحميل حالة التشغيل.');
    } else {
      setPortal(data);
    }
    setPortalLoading(false);
  }

  useEffect(() => {
    if (!session || mustChangePassword) {
      setDriverAuthorized(false);
      return;
    }
    let active = true;
    setDriverAuthorized(false);
    void (async () => {
      const { data, error: portalError } = await supabase.rpc('get_driver_portal_snapshot');
      if (!active) return;
      if (portalError || !data?.driver_id) {
        setError('هذا الحساب غير مرتبط بسائق نشط في النظام.');
        await supabase.auth.signOut();
        if (active) setSession(null);
        return;
      }
      setPortal(data);
      setError('');
      setDriverAuthorized(true);
    })();
    return () => { active = false; };
  }, [session?.user?.id, mustChangePassword]);

  useEffect(() => {
    if (!session || !driverAuthorized || mustChangePassword) return;
    let active = true;
    let watcherId: string | undefined;
    let lastSentAt = 0;

    void (async () => {
      try {
        watcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'مشاركة موقعك مع طيبة مفعّلة أثناء العمل. أوقف التتبع بتسجيل الخروج.',
            backgroundTitle: 'Tiba Supplies — تتبع موقع السائق',
            requestPermissions: true,
            stale: false,
            distanceFilter: 10,
          },
          async (location, watcherError) => {
            if (!active) return;
            if (watcherError) {
              setError(watcherError.message || 'تعذر تشغيل تتبع الموقع في الخلفية.');
              return;
            }
            if (!location) return;

            const locationTimestamp = location.time ?? Date.now();
            const capturedAt = new Date(locationTimestamp).toISOString();
            setPosition({
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              capturedAt: new Date(locationTimestamp).toLocaleString('ar-EG'),
            });

            if (Date.now() - lastSentAt < 20000) return;
            lastSentAt = Date.now();
            const { error: locationError } = await supabase.rpc('update_driver_live_location', {
              p_latitude: location.latitude,
              p_longitude: location.longitude,
              p_accuracy_m: location.accuracy,
              p_heading: location.bearing ?? null,
              p_speed_kmh: location.speed == null ? null : location.speed * 3.6,
              p_captured_at: capturedAt,
            });
            if (!active) return;
            if (locationError) {
              setError(locationError.message || 'تعذر حفظ الموقع. تأكد من إعدادات السائق في النظام.');
            } else {
              setError('');
              void refreshPortal();
            }
          },
        );
      } catch (trackingError: any) {
        if (active) setError(trackingError?.message || 'تعذر تشغيل خدمة تتبع الموقع. راجع أذونات الموقع والإشعارات.');
      }
    })();

    return () => {
      active = false;
      if (watcherId) void BackgroundGeolocation.removeWatcher({ id: watcherId });
    };
  }, [session, driverAuthorized, mustChangePassword]);

  function normalizePhone(input: string) {
    let value = input.trim().replace(/[\s()-]/g, '');
    if (value.startsWith('00')) value = `+${value.slice(2)}`;
    if (/^01[0125]\d{8}$/.test(value)) value = `+20${value.slice(1)}`;
    if (/^20(10|11|12|15)\d{8}$/.test(value)) value = `+${value}`;
    if (/^\+20(10|11|12|15)\d{8}$/.test(value)) return value;
    throw new Error('أدخل رقم موبايل مصري صحيحًا مثل 01012345678.');
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setAuthBusy(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        phone: normalizePhone(phone),
        password,
      });
      if (signInError) throw signInError;
      if (!data.session) throw new Error('لم يتم إنشاء جلسة دخول.');
      setPassword('');
      setSession(data.session);
    } catch (e: any) {
      setError(e?.message || 'تعذر تسجيل الدخول.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function changeFirstPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    setAuthBusy(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      const { data, error: completionError } = await supabase.functions.invoke('create-driver-account', {
        body: { action: 'complete_password_setup' },
      });
      if (completionError) throw completionError;
      if (!data?.success) throw new Error('تعذر إنهاء إعداد كلمة المرور. حاول مرة أخرى.');
      await supabase.auth.signOut();
      setSession(null);
      setPassword('');
      setPasswordConfirmation('');
      setError('تم تغيير كلمة المرور. سجّل الدخول الآن بالكلمة الجديدة.');
    } catch (e: any) {
      setError(e?.message || 'تعذر تغيير كلمة المرور. حاول مرة أخرى.');
    } finally {
      setAuthBusy(false);
    }
  }

  function captureLocation() {
    setError('');
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع على هذا الجهاز.');
      return;
    }
    setLocating(true);
    void (async () => {
      try {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
          const requested = await Geolocation.requestPermissions();
          if (requested.location !== 'granted' && requested.coarseLocation !== 'granted') {
            setError('إذن الموقع غير ممنوح. افتح إعدادات الهاتف > التطبيقات > Tiba Supplies Driver > الأذونات > الموقع، واسمح بالموقع دائمًا (Allow all the time) من إعدادات أندرويد، وفعّل الإشعارات.');
            setLocating(false);
            return;
          }
        }
      } catch (permissionError: any) {
        setError(permissionError?.message || 'تعذر طلب إذن GPS من أندرويد. افتح إعدادات التطبيق واسمح بالموقع.');
        setLocating(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
      async ({ coords, timestamp }) => {
        setPosition({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          capturedAt: new Date(timestamp).toLocaleString('ar-EG'),
        });
        const { error: saveError } = await supabase.rpc('update_driver_live_location', {
          p_latitude: coords.latitude, p_longitude: coords.longitude, p_accuracy_m: coords.accuracy,
          p_heading: null, p_speed_kmh: null, p_captured_at: new Date(timestamp).toISOString(),
        });
        if (saveError) setError(saveError.message || 'تعذر حفظ الموقع. فعّل مشاركة الموقع وتأكد من ربط حسابك بالعربية.');
        else { setError(''); await refreshPortal(); }
        setLocating(false);
      },
      (locationError) => {
        const message = locationError.code === 1 ? 'تم رفض إذن الموقع. افتح إعدادات الهاتف > التطبيقات > Tiba Supplies > الأذونات > الموقع، واسمح بالموقع دائمًا (Allow all the time) من إعدادات أندرويد، وفعّل الإشعارات، ثم جرّب مرة أخرى.' : locationError.code === 2 ? 'الهاتف لم يستطع تحديد موقعك. فعّل GPS وحاول في مكان مفتوح.' : 'انتهت مهلة تحديد الموقع. تأكد من تشغيل GPS وحاول مرة أخرى.';
        setError(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    })();
  }

  if (loading) {
    return <div dir="rtl" className="min-h-screen grid place-items-center bg-slate-50 text-slate-700">جاري تجهيز تطبيق السائق...</div>;
  }

  if (!session) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-5 flex items-center justify-center">
        <form onSubmit={signIn} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Truck size={28} /></div>
          <p className="text-xs font-black tracking-widest text-blue-700">TIBA SUPPLIES · DRIVER</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">دخول السائق</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">استخدم رقم الموبايل وكلمة المرور التي استلمتها من المكتب.</p>
          {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <label className="mt-5 block text-sm font-bold text-slate-700">رقم الموبايل</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" />
          <label className="mt-4 block text-sm font-bold text-slate-700">كلمة المرور</label>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" />
          <button disabled={authBusy} className="mt-5 w-full rounded-xl bg-blue-600 p-3 font-black text-white disabled:opacity-60">{authBusy ? 'جارٍ الدخول...' : 'دخول'}</button>
        </form>
      </main>
    );
  }

  if (mustChangePassword) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-5 flex items-center justify-center">
        <form onSubmit={changeFirstPassword} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Truck size={28} /></div>
          <p className="text-xs font-black tracking-widest text-blue-700">TIBA SUPPLIES · DRIVER</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">غيّر كلمة المرور المؤقتة</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">اختر كلمة مرور جديدة خاصة بك. لن تظهر بيانات التطبيق قبل تغييرها.</p>
          {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <label className="mt-5 block text-sm font-bold text-slate-700">كلمة مرور جديدة</label>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={8} required className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" />
          <label className="mt-4 block text-sm font-bold text-slate-700">تأكيد كلمة المرور</label>
          <input value={passwordConfirmation} onChange={e => setPasswordConfirmation(e.target.value)} type="password" autoComplete="new-password" minLength={8} required className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" />
          <button disabled={authBusy} className="mt-5 w-full rounded-xl bg-blue-600 p-3 font-black text-white disabled:opacity-60">{authBusy ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور'}</button>
        </form>
      </main>
    );
  }

  if (!driverAuthorized) {
    return <div dir="rtl" className="min-h-screen grid place-items-center bg-slate-50 text-slate-700">جاري التحقق من حساب السائق...</div>;
  }


  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Truck size={23} /></div>
            <div><p className="text-xs font-black text-blue-700">TIBA SUPPLIES</p><h1 className="font-black">تطبيق السائق</h1></div>
          </div>
          <button aria-label="تسجيل الخروج" onClick={() => void supabase.auth.signOut()} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600"><LogOut size={18} /></button>
        </div>
      </header>
      <div className="mx-auto max-w-xl space-y-4 p-4 pb-10">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm text-slate-500">أهلًا بك</p><h2 className="mt-1 break-all text-lg font-black">{session.user?.phone}</h2></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">متصل</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4"><MapPin className="mb-2 text-blue-700" size={21}/><p className="text-xs text-slate-500">مكتب تسجيل الوصول</p><p className="mt-1 font-black">رأس سدر</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><Navigation className="mb-2 text-blue-700" size={21}/><p className="text-xs text-slate-500">نطاق الوصول</p><p className="mt-1 font-black">10 كم</p></div>
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><ShieldCheck className="text-blue-700" size={22}/><h2 className="font-black">تسجيل الوصول</h2></div>
          <p className="mt-2 text-sm leading-6 text-slate-600">مشاركة الموقع تعمل تلقائيًا بعد تسجيل الدخول. اضغط الزر لفحص موقعك ومعرفة هل أنت داخل نطاق 10 كم من مكتب رأس سدر.</p>
          <button onClick={captureLocation} disabled={locating} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 p-4 font-black text-white disabled:opacity-60">
            <MapPin size={20}/>{locating ? 'جاري فحص الموقع...' : 'أنا وصلت — فحص الموقع'}
          </button>
          {error && <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><CircleAlert className="shrink-0" size={18}/><span>{error}</span></div>}
          {position && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-black">تم تحديد الموقع على الجهاز</p>
            <p className="mt-2">دقة GPS: {Math.round(position.accuracy)} متر</p>
            <p>وقت القراءة: {position.capturedAt}</p>
            <p className="mt-2 break-all font-mono text-xs">{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</p>
            <p className="mt-3 text-xs leading-5">ملاحظة: قراءة الموقع لا تسجّل Check-in ولا تضيفك لقائمة الانتظار.</p>
          </div>}
          {error && <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><CircleAlert className="shrink-0" size={18}/><span>{error}</span></div>}
        </section>
        {!portal?.inside_geofence ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><ShieldCheck className="text-blue-700" size={22}/><h2 className="font-black">الخدمات داخل نطاق المكتب</h2></div>
            <p className="mt-2 text-sm leading-7 text-slate-600">لن تظهر الكمولات المتاحة أو ترتيب الانتظار أو سجل أوامرك إلا بعد أن يؤكد النظام وجودك داخل نطاق 10 كم من مكتب رأس سدر، مع موقع GPS حديث.</p>
            {portal && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{portal.location_updated_at ? 'آخر موقع محفوظ قد يكون خارج النطاق أو أقدم من 10 دقائق.' : 'لم يصل موقع GPS حديث للنظام حتى الآن.'}</p>}
            <p className="mt-3 text-sm font-bold text-slate-700">استخدم زر «أنا وصلت — فحص الموقع» أعلاه لتحديث موقعك والتحقق من النطاق.</p>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-700" size={22}/><h2 className="font-black">أنت داخل نطاق المكتب</h2></div>
              <p className="mt-2 text-sm text-slate-600">المسافة التقريبية: {Math.round(Number(portal.distance_m || 0))} متر من مكتب {portal.office_name || 'رأس سدر'}.</p>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Clock3 className="text-blue-700" size={22}/><h2 className="font-black">رقمك في الانتظار</h2></div>
              {portal.queue_status === 'WAITING' ? <p className="mt-3 text-2xl font-black text-blue-700">الدور رقم {portal.queue_position || '—'}</p> : <p className="mt-2 text-sm leading-7 text-slate-600">أنت داخل النطاق لكنك غير مسجل حاليًا في قائمة الانتظار. تسجيل الموقع وحده لا يضيفك تلقائيًا إلى القائمة.</p>}
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Truck className="text-blue-700" size={22}/><h2 className="font-black">الحمولات المتاحة</h2></div>
              {(portal.available_loads || []).length ? <div className="mt-4 space-y-3">{portal.available_loads.map((load: any) => <div key={load.load_order_id} className="rounded-2xl border border-slate-200 p-4"><div className="font-black">{load.factory_name || 'مصنع غير محدد'} <span className="text-slate-400">←</span> {load.quarry_name || 'محجر غير محدد'}</div><p className="mt-2 text-sm text-slate-600">المتبقي: {load.remaining_quantity} نقلة</p><p className="mt-1 text-xs text-slate-400">أمر: {String(load.load_order_id).slice(0, 8)}</p></div>)}</div> : <p className="mt-2 text-sm leading-7 text-slate-500">لا توجد حمولات متاحة حاليًا.</p>}
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><FileText className="text-blue-700" size={22}/><h2 className="font-black">أوامرك السابقة</h2></div>
              {(portal.my_bookings || []).length ? <div className="mt-4 space-y-3">{portal.my_bookings.map((booking: any) => <div key={booking.booking_id} className="rounded-2xl border border-slate-200 p-4"><div className="font-bold">{booking.factory_name || 'مصنع غير محدد'} ← {booking.quarry_name || 'محجر غير محدد'}</div><p className="mt-2 text-sm text-slate-600">الحالة: {({BOOKED:'محجوزة',LOADING_STATEMENT:'بيان تحميل',IN_TRANSIT:'في الطريق',DELIVERED:'تم التسليم',COMPLETED:'مكتملة'} as Record<string,string>)[booking.status] || booking.status}</p><p className="mt-1 text-xs text-slate-400">{booking.booked_at ? new Date(booking.booked_at).toLocaleString('ar-EG') : ''}</p></div>)}</div> : <p className="mt-2 text-sm leading-7 text-slate-500">لا توجد أوامر سابقة مرتبطة بحسابك.</p>}
            </section>
          </>
        )}
      </div>
    </main>
  );
};
