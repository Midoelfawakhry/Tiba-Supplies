import React, { useEffect, useState } from 'react';
import { MapPin, Truck, Clock3, ShieldCheck, LogOut, Navigation, CircleAlert } from 'lucide-react';
import { supabase, supabaseDiagnostics } from '../lib/supabase';

type PositionState = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

export const DriverApp: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(supabaseDiagnostics.configurationError);
  const [position, setPosition] = useState<PositionState | null>(null);
  const [locating, setLocating] = useState(false);

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

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!data.session) throw new Error('لم يتم إنشاء جلسة دخول.');
      setSession(data.session);
    } catch (e: any) {
      setError(e?.message || 'تعذر تسجيل الدخول.');
    }
  }

  function captureLocation() {
    setError('');
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع على هذا الجهاز.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => {
        setPosition({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          capturedAt: new Date(timestamp).toLocaleString('ar-EG'),
        });
        setLocating(false);
      },
      (locationError) => {
        setError(locationError.message || 'تعذر تحديد الموقع. راجع صلاحيات الموقع في الهاتف.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
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
          <p className="mt-2 text-sm leading-6 text-slate-500">سجّل الدخول بحساب السائق المعتمد لعرض حالة التشغيل الخاصة بك.</p>
          {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <label className="mt-5 block text-sm font-bold text-slate-700">البريد الإلكتروني</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" />
          <label className="mt-4 block text-sm font-bold text-slate-700">كلمة المرور</label>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" />
          <button className="mt-5 w-full rounded-xl bg-blue-600 p-3 font-black text-white">دخول</button>
        </form>
      </main>
    );
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
            <div><p className="text-sm text-slate-500">أهلًا بك</p><h2 className="mt-1 break-all text-lg font-black">{session.user?.email}</h2></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">متصل</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4"><MapPin className="mb-2 text-blue-700" size={21}/><p className="text-xs text-slate-500">مكتب تسجيل الوصول</p><p className="mt-1 font-black">رأس سدر</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><Navigation className="mb-2 text-blue-700" size={21}/><p className="text-xs text-slate-500">نطاق الوصول</p><p className="mt-1 font-black">10 كم</p></div>
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><ShieldCheck className="text-blue-700" size={22}/><h2 className="font-black">تسجيل الوصول</h2></div>
          <p className="mt-2 text-sm leading-6 text-slate-600">حدّد موقعك الحالي للتحقق من صلاحية الموقع ودقته. سيتم تفعيل تسجيل الوصول الفعلي وربطه بقائمة الانتظار في خطوة الربط مع إجراء قاعدة البيانات المعتمد.</p>
          <button onClick={captureLocation} disabled={locating} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 font-black text-white disabled:opacity-60">
            <MapPin size={18}/>{locating ? 'جاري تحديد الموقع...' : 'تحديد موقعي الحالي'}
          </button>
          {position && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-black">تم تحديد الموقع على الجهاز</p>
            <p className="mt-2">دقة GPS: {Math.round(position.accuracy)} متر</p>
            <p>وقت القراءة: {position.capturedAt}</p>
            <p className="mt-2 break-all font-mono text-xs">{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</p>
            <p className="mt-3 text-xs leading-5">ملاحظة: الموقع تم قراءته فقط ولم يتم تسجيل Check-in أو إضافتك لقائمة الانتظار.</p>
          </div>}
          {error && <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><CircleAlert className="shrink-0" size={18}/><span>{error}</span></div>}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Clock3 className="text-blue-700" size={22}/><h2 className="font-black">حالة الدور</h2></div>
          <p className="mt-2 text-sm leading-6 text-slate-500">سيظهر هنا ترتيبك في قائمة الانتظار وأوامر التحميل المرتبطة بحسابك بعد ربط شاشة السائق بإجراءات التشغيل الفعلية.</p>
        </section>
      </div>
    </main>
  );
};
