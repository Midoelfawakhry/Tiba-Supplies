import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export const AddVehicleForm: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const [plate, setPlate] = useState('');
  const [code, setCode] = useState('');
  const [owner, setOwner] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('create_operational_vehicle', {
        p_plate_number: plate.trim(),
        p_vehicle_code: code.trim(),
        p_owner_name: owner.trim(),
        p_owner_phone: phone.trim() || null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error('تعذر تأكيد الحفظ.');
      setMessage('تم حفظ العربية والمالك بنجاح.');
      setPlate(''); setCode(''); setOwner(''); setPhone('');
      onSaved();
    } catch (error: any) {
      const raw = String(error?.message || '');
      const messages: Record<string, string> = {
        VEHICLE_PLATE_EXISTS: 'رقم اللوحة مسجل بالفعل.',
        VEHICLE_CODE_EXISTS: 'كود العربية مستخدم بالفعل.',
        REQUIRED_FIELDS_MISSING: 'أكمل رقم اللوحة وكود العربية واسم المالك.',
        AUTH_REQUIRED: 'سجّل دخولك أولًا.',
        INSUFFICIENT_ROLE: 'حسابك لا يملك صلاحية إضافة عربية.',
      };
      const key = Object.keys(messages).find(item => raw.includes(item));
      setMessage(key ? messages[key] : raw || 'تعذر حفظ العربية.');
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-bold">رقم العربية / اللوحة *
      <input required value={plate} onChange={e => setPlate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" />
    </label>
    <label className="text-sm font-bold">كود العربية *
      <input required value={code} onChange={e => setCode(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" />
    </label>
    <label className="text-sm font-bold">اسم المالك *
      <input required value={owner} onChange={e => setOwner(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" />
    </label>
    <label className="text-sm font-bold">موبايل المالك (اختياري)
      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" />
    </label>
    {message && <p role="status" className="sm:col-span-2 text-sm">{message}</p>}
    <button disabled={saving} className="sm:col-span-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-60">{saving ? 'جاري الحفظ...' : 'حفظ العربية والمالك'}</button>
  </form>;
};
