import React, { FormEvent, useEffect, useState } from 'react';
import { supabase, supabaseDiagnostics } from '../lib/supabase';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(supabaseDiagnostics.configurationError);

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | undefined;

    async function initialize() {
      if (supabaseDiagnostics.configurationError) {
        setError(supabaseDiagnostics.configurationError);
        setLoading(false);
        return;
      }
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (active) setSession(data.session);
        const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
          if (active) {
            setSession(next);
            setError('');
            setLoading(false);
          }
        });
        subscription = listener.subscription;
      } catch (e: any) {
        if (active) setError(e?.message || 'تعذر الاتصال بخدمة تسجيل الدخول في Supabase.');
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

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!data.session) throw new Error('لم يُرجع Supabase جلسة دخول. تأكد من المستخدم وكلمة المرور وإعدادات Auth.');
      setSession(data.session);
    } catch (e: any) {
      setError(e?.message || 'فشل تسجيل الدخول إلى Supabase.');
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 text-slate-900 grid place-items-center">جاري التحقق من الاتصال الحقيقي...</div>;
  }

  if (!session) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 grid place-items-center p-5">
        <form onSubmit={signIn} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
          <div className="mb-6">
            <div className="text-xs font-bold text-blue-700">TIBA SUPPLIES · LIVE</div>
            <h1 className="mt-2 text-3xl font-black">دخول مركز التشغيل</h1>
            <p className="mt-2 text-sm text-slate-600">تسجيل الدخول يتم عبر Supabase الحقيقي فقط.</p>
          </div>
          {supabaseDiagnostics.configurationError && (
            <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {supabaseDiagnostics.configurationError}
            </div>
          )}
          <div className="space-y-3">
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="البريد الإلكتروني" className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" />
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="كلمة المرور" className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" />
            {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <button disabled={Boolean(supabaseDiagnostics.configurationError)} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">دخول</button>
          </div>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};
