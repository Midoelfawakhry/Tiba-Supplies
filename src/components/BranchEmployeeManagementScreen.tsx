import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, UserPlus, Users, RefreshCw, Phone, UserX, UserCheck, ShieldCheck, Pencil, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Employee = {
  user_id: string;
  username: string | null;
  display_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  office_name?: string | null;
};

const errorLabels: Record<string, string> = {
  AUTH_REQUIRED: 'انتهت جلسة الدخول. سجّل الدخول مرة أخرى.',
  INSUFFICIENT_ROLE: 'إنشاء حسابات موظفي الفرع متاح للمكتب الرئيسي فقط.',
  DISPLAY_NAME_REQUIRED: 'اكتب اسم الموظف كاملًا.',
  USERNAME_INVALID: 'اسم المستخدم من 3 إلى 30 حرفًا إنجليزيًا أو رقمًا، ويسمح بالنقطة والشرطة والشرطة السفلية.',
  PASSWORD_TOO_SHORT: 'كلمة المرور لازم تكون 10 أحرف على الأقل.',
  USERNAME_ALREADY_EXISTS: 'اسم المستخدم مستخدم بالفعل. اختار اسمًا مختلفًا.',
  PHONE_INVALID: 'رقم الموبايل المصري غير صحيح.',
  EXPECTED_ONE_ACTIVE_BRANCH_OFFICE: 'لازم يكون فيه مكتب فرعي نشط واحد فقط قبل إنشاء الحساب.',
  BRANCH_EMPLOYEE_NOT_FOUND: 'الموظف غير موجود.',
};

export const BranchEmployeeManagementScreen: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_branch_employee_directory');
      if (rpcError) throw rpcError;
      setEmployees(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const raw = String(e?.message || '');
      const key = Object.keys(errorLabels).find(code => raw.includes(code));
      setError(key ? errorLabels[key] : raw || 'تعذر تحميل قائمة موظفي الفرع.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-branch-employee', {
        body: { display_name: name.trim(), username: username.trim().toLowerCase(), phone: phone.trim() || null, password },
      });
      if (invokeError) throw invokeError;
      if (data?.error) {
        const key = Object.keys(errorLabels).find(code => data.error.includes(code));
        throw new Error(key ? errorLabels[key] : data.error);
      }
      if (!data?.success) throw new Error('تعذر تأكيد إنشاء الحساب.');
      setSuccess('تم إنشاء حساب موظف رأس سدر. سلّمه اسم المستخدم وكلمة المرور بشكل آمن.');
      setName('');
      setUsername('');
      setPhone('');
      setPassword('');
      await load();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const key = Object.keys(errorLabels).find(code => raw.includes(code));
      setError(key ? errorLabels[key] : raw || 'تعذر إنشاء الحساب.');
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(employee: Employee) {
    setEditing(employee); setEditName(employee.display_name || ''); setEditPhone(employee.phone || ''); setError(''); setSuccess('');
  }

  async function saveEmployeeEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    setBusyId(editing.user_id); setError(''); setSuccess('');
    try {
      const { data, error: rpcError } = await supabase.rpc('update_branch_employee_details', { p_user_id: editing.user_id, p_display_name: editName.trim(), p_phone: editPhone.trim() || null });
      if (rpcError) throw rpcError; if (!data?.success) throw new Error('تعذر تأكيد تعديل بيانات الموظف.');
      setEditing(null); setSuccess('تم تحديث بيانات الموظف.'); await load();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const labels: Record<string,string> = { AUTH_REQUIRED: 'انتهت جلسة الدخول. سجّل الدخول مرة أخرى.', INSUFFICIENT_ROLE: 'تعديل الموظفين متاح للمكتب الرئيسي فقط.', DISPLAY_NAME_REQUIRED: 'اكتب اسم الموظف كاملًا.', PHONE_INVALID: 'رقم الموبايل غير صحيح.', BRANCH_EMPLOYEE_NOT_FOUND: 'الموظف غير موجود أو ليس موظف فرع.' };
      const key = Object.keys(labels).find(code => raw.includes(code)); setError(key ? labels[key] : raw || 'تعذر تعديل بيانات الموظف.');
    } finally { setBusyId(''); }
  }
  async function removeEmployee(employee: Employee) {
    if (!employee.is_active) return;
    if (!window.confirm('حذف الموظف ' + employee.display_name + ' من قائمة الموظفين النشطين؟ سيتم إيقاف حسابه ومنعه من الدخول، مع الاحتفاظ بسجل العمليات.')) return;
    setBusyId(employee.user_id); setError(''); setSuccess('');
    try {
      const { data, error: rpcError } = await supabase.rpc('set_branch_employee_active', { p_user_id: employee.user_id, p_is_active: false });
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error('تعذر إيقاف حساب الموظف.');
      setSuccess('تمت إزالة الموظف من القائمة النشطة وإيقاف حسابه. سجل العمليات محفوظ.');
      await load();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const key = Object.keys(errorLabels).find(code => raw.includes(code));
      setError(key ? errorLabels[key] : raw || 'تعذر حذف الموظف من القائمة النشطة.');
    } finally { setBusyId(''); }
  }
  async function setActive(employee: Employee) {
    setBusyId(employee.user_id);
    setError('');
    setSuccess('');
    try {
      const { data, error: rpcError } = await supabase.rpc('set_branch_employee_active', {
        p_user_id: employee.user_id,
        p_is_active: !employee.is_active,
      });
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error('تعذر تحديث حالة الموظف.');
      setSuccess(employee.is_active ? 'تم إيقاف حساب الموظف ومنعه من الوصول لبيانات الفرع.' : 'تم تفعيل حساب الموظف.');
      await load();
    } catch (e: any) {
      const raw = String(e?.message || '');
      const key = Object.keys(errorLabels).find(code => raw.includes(code));
      setError(key ? errorLabels[key] : raw || 'تعذر تحديث حالة الموظف.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div dir="rtl" className="space-y-5">
      <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-100 text-indigo-700"><KeyRound size={24}/></div>
          <div>
            <h2 className="text-xl font-black">موظفو مكتب رأس سدر</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">أنشئ لكل موظف اسم مستخدم وكلمة مرور خاصة. حساب الفرع للعرض فقط، ولا يملك صلاحية تعديل التحميلات أو الحسابات.</p>
          </div>
        </div>
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {success && <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
        <form onSubmit={createEmployee} className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">اسم الموظف
            <input value={name} onChange={e=>setName(e.target.value)} required minLength={3} autoComplete="name" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="اسم الموظف بالكامل"/>
          </label>
          <label className="text-sm font-bold text-slate-700">اسم المستخدم
            <input value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/\s/g,''))} required minLength={3} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}" autoComplete="off" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="مثال: ahmed.ras_sedr"/>
          </label>
          <label className="text-sm font-bold text-slate-700">رقم الموبايل (اختياري)
            <input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" autoComplete="tel" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="01xxxxxxxxx"/>
          </label>
          <label className="text-sm font-bold text-slate-700">كلمة المرور الأولية
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required minLength={10} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="10 أحرف على الأقل"/>
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-slate-500">اسم المستخدم لا يحتاج بريدًا إلكترونيًا. لا تشارك كلمة المرور في جروب أو رسالة عامة.</p>
            <button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-3 font-black text-white disabled:opacity-50"><UserPlus className="ml-2 inline h-4 w-4"/>{saving ? 'جاري إنشاء الحساب...' : 'إنشاء حساب الموظف'}</button>
          </div>
        </form>
      </section>

      {editing && <section className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black">تعديل بيانات الموظف</h3>
        <form onSubmit={saveEmployeeEdit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">اسم الموظف<input required minLength={3} value={editName} onChange={e=>setEditName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label>
          <label className="text-sm font-bold text-slate-700">رقم الموبايل (اختياري)<input type="tel" value={editPhone} onChange={e=>setEditPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label>
          <div className="sm:col-span-2 flex gap-2"><button disabled={busyId===editing.user_id} className="rounded-xl bg-indigo-600 px-5 py-3 font-black text-white disabled:opacity-50">{busyId===editing.user_id ? 'جاري الحفظ...' : 'حفظ التعديل'}</button><button type="button" onClick={()=>setEditing(null)} className="rounded-xl border border-slate-300 px-5 py-3 font-bold"><X className="ml-1 inline h-4 w-4"/>إلغاء</button></div>
        </form>
      </section>}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h3 className="text-lg font-black">{showInactive ? 'الحسابات الموقوفة' : 'الموظفون النشطون'}</h3><p className="text-sm text-slate-500">يمكنك إزالة الموظف من القائمة النشطة دون مسح سجل العمليات.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={()=>setShowInactive(v=>!v)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">{showInactive ? 'عرض النشطين' : 'عرض المحذوفين/الموقوفين'}</button><button onClick={()=>void load()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"><RefreshCw className="ml-1 inline h-4 w-4"/>تحديث</button></div>
        </div>
        {loading ? <p className="py-8 text-center text-slate-500">جاري تحميل الموظفين...</p> : employees.filter(employee => showInactive ? !employee.is_active : employee.is_active).length === 0 ? <p className="rounded-xl bg-slate-50 p-6 text-center text-slate-500">{showInactive ? 'مفيش حسابات موقوفة.' : 'لسه مفيش موظفين نشطين للفرع.'}</p> : (
          <div className="space-y-3">
            {employees.filter(employee => showInactive ? !employee.is_active : employee.is_active).map(employee => <article key={employee.user_id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Users size={20}/></div>
                <div><div className="font-black">{employee.display_name}</div><div className="mt-1 text-sm text-slate-600">اسم المستخدم: <bdi className="font-bold">{employee.username || 'غير مسجل'}</bdi></div>
                  {employee.phone && <a href={'tel:'+employee.phone} className="mt-1 inline-flex items-center gap-1 text-sm text-blue-700"><Phone size={14}/>{employee.phone}</a>}
                  <div className="mt-1 text-xs text-slate-500">أُنشئ في {new Date(employee.created_at).toLocaleDateString('ar-EG')}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={employee.is_active ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"}>{employee.is_active ? "الحساب نشط" : "الحساب موقوف"}</span>
                <button disabled={busyId===employee.user_id} onClick={()=>beginEdit(employee)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"><Pencil className="ml-1 inline h-4 w-4"/>تعديل</button>
                <button disabled={busyId===employee.user_id} onClick={()=>void setActive(employee)} className={employee.is_active ? "rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50" : "rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-50"}>{employee.is_active ? <><UserX className="ml-1 inline h-4 w-4"/>إيقاف</> : <><UserCheck className="ml-1 inline h-4 w-4"/>تفعيل</>}</button>
                {employee.is_active && <button disabled={busyId===employee.user_id} onClick={()=>void removeEmployee(employee)} className="rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"><Trash2 className="ml-1 inline h-4 w-4"/>حذف</button>}
              </div>
            </article>)}
          </div>
        )}
      </section>
      <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><p>الصلاحيات مفروضة من قاعدة البيانات، مش من شكل الشاشة فقط. موظف الفرع لا يقدر ينفّذ أوامر المكتب الرئيسي حتى لو حاول استدعاء الدوال مباشرة.</p></div>
    </div>
  );
};
