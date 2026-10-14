import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

type Owner = { owner_id: string; name: string; owner_code?: string; is_active?: boolean };
export const AddVehicleForm: React.FC<{ owners: Owner[]; onSaved: () => void }> = ({ owners, onSaved }) => {
  const [plate, setPlate] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      if (!owners.some(owner => owner.owner_id === ownerId && owner.is_active !== false)) {
        throw new Error('OWNER_REQUIRED');
      }
      const { data, error } = await supabase.rpc('main_office_create_vehicle', {
        p_plate_number: plate.trim(),
        p_owner_id: ownerId,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      if (!data?.success || !data?.vehicle_id || !data?.vehicle_code) throw new Error('تعذر تأكيد الحفظ.');
      setMessage(`تم حفظ العربية. الكود التلقائي: ${data.vehicle_code}`);
      setPlate(''); setOwnerId(''); setNotes('');
      onSaved();
    } catch (error: any) {
      const raw = String(error?.message || '');
      const messages: Record<string, string> = {
        PLATE_AND_OWNER_REQUIRED: 'أكمل رقم اللوحة واختار المالك.',
        OWNER_REQUIRED: 'لازم تختار مالكًا نشطًا من دليل الملاك أولًا.',
        OWNER_NOT_ACTIVE: 'المالك المحدد غير نشط. حدّث القائمة واختار مالكًا آخر.',
        AUTH_REQUIRED: 'سجّل دخولك أولًا.',
        MAIN_OFFICE_ACCESS_REQUIRED: 'إضافة العربيات متاحة للمكتب الرئيسي فقط.',
        vehicles_plate_number_key: 'رقم اللوحة مسجل بالفعل.',
      };
      const key = Object.keys(messages).find(item => raw.includes(item));
      setMessage(key ? messages[key] : raw || 'تعذر حفظ العربية.');
    } finally {
      setSaving(false);
    }
  }

  const activeOwners = owners.filter(owner => owner.is_active !== false);
  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-bold">رقم العربية / اللوحة *
      <input required maxLength={40} value={plate} onChange={e => setPlate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" />
    </label>
    <label className="text-sm font-bold">مالك العربية *
      <select required value={ownerId} onChange={e => setOwnerId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal">
        <option value="">اختار مالكًا مسجلًا</option>
        {activeOwners.map(owner => <option key={owner.owner_id} value={owner.owner_id}>{owner.name}{owner.owner_code ? ` · ${owner.owner_code}` : ''}</option>)}
      </select>
      {activeOwners.length === 0 && <span className="mt-1 block text-xs font-medium text-amber-700">أضف مالكًا من قسم إدارة ملاك العربيات أولًا.</span>}
    </label>
    <label className="text-sm font-bold sm:col-span-2">ملاحظات (اختياري)
      <input maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-normal" />
    </label>
    <p className="sm:col-span-2 text-xs text-slate-500">كود العربية بيتولد تلقائيًا من النظام، ومش محتاج تدخله يدويًا.</p>
    {message && <p role="status" className="sm:col-span-2 text-sm">{message}</p>}
    <button disabled={saving || activeOwners.length === 0} className="sm:col-span-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-60">{saving ? 'جاري الحفظ...' : 'حفظ العربية'}</button>
  </form>;
};
