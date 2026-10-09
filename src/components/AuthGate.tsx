import React, { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
  }

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">جاري تشغيل النظام...</div>;
  }

  if (!session) {
    return (
      <div dir="rtl" className="min-h-screen bg-zinc-950 text-white grid place-items-center p-5">
        <form onSubmit={signIn} className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
          <div className="mb-6">
            <div className="text-xs font-bold text-cyan-300">TIBA SUPPLIES · LIVE</div>
            <h1 className="mt-2 text-3xl font-black">دخول مركز التشغيل</h1>
            <p className="mt-2 text-sm text-slate-400">النسخة دي متوصلة بقاعدة البيانات الحقيقية، مش LocalStorage.</p>
          </div>
          <div className="space-y-3">
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="البريد الإلكتروني" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none" />
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="كلمة المرور" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none" />
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
            <button className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">دخول</button>
          </div>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};
