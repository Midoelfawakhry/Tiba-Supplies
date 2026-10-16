import React, { useEffect, useState } from 'react';
import { FilePlus2, LoaderCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Option = { id: string; name: string; code?: string | null; plate_number?: string | null; is_active?: boolean };
type Directory = { vehicles?: Option[]; drivers?: Option[]; factories?: Option[]; quarries?: Option[] };
type ImportRow = { source_row_number: number; load_date: string; vehicle_code: string; driver_code: string; factory_code: string; quarry_code: string; actual_weight: string; ticket_number?: string; notes?: string; source_record_id?: string };
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (quoted) throw new Error('ملف CSV يحتوي على علامة اقتباس غير مكتملة.');
  row.push(cell);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  return rows;
};
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const PaperLoadingEntryScreen: React.FC = () => {
  const [directory, setDirectory] = useState<Directory>({});
  const [loadDate, setLoadDate] = useState(today());
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [factoryId, setFactoryId] = useState('');
  const [quarryId, setQuarryId] = useState('');
  const [actualWeight, setActualWeight] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadDirectory() {
    setLoadingDirectory(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('main_office_get_directory');
      if (rpcError) throw rpcError;
      const raw = (data ?? {}) as Directory;
      const normalize = (items: any[] = []): Option[] => items
        .filter(item => item?.is_active !== false)
        .map(item => ({ id: String(item.id), name: String(item.name ?? item.plate_number ?? item.code ?? ''), code: item.code ?? null, plate_number: item.plate_number ?? null }));
      setDirectory({
        vehicles: normalize(raw.vehicles),
        drivers: normalize(raw.drivers),
        factories: normalize(raw.factories),
        quarries: normalize(raw.quarries),
      });
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل دليل المكتب.');
    } finally {
      setLoadingDirectory(false);
    }
  }

  useEffect(() => { void loadDirectory(); }, []);

  async function prepareCsv(file: File | null) {
    setImportFile(file);
    setImportRows([]);
    setImportError('');
    setImportMessage('');
    if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error('ملف CSV لازم يحتوي على صف عناوين وصف بيانات واحد على الأقل.');
      const headers = parsed[0].map(value => value.trim().toLowerCase());
      const required = ['load_date','vehicle_code','driver_code','factory_code','quarry_code','actual_weight'];
      const missing = required.filter(header => !headers.includes(header));
      if (missing.length) throw new Error(`أعمدة مطلوبة ناقصة: ${missing.join(', ')}`);
      const rows = parsed.slice(1).map((values, index) => {
        const get = (key: string) => {
          const at = headers.indexOf(key);
          return at < 0 ? '' : String(values[at] ?? '').trim();
        };
        return {
          source_row_number: index + 2,
          load_date: get('load_date'),
          vehicle_code: get('vehicle_code'),
          driver_code: get('driver_code'),
          factory_code: get('factory_code'),
          quarry_code: get('quarry_code'),
          actual_weight: get('actual_weight'),
          ticket_number: get('ticket_number'),
          notes: get('notes'),
          source_record_id: get('source_record_id'),
        };
      });
      if (rows.length > 2000) throw new Error('الحد الأقصى للاستيراد في المرة الواحدة 2000 صف.');
      setImportRows(rows);
      setImportMessage(`تمت قراءة ${rows.length} صف. راجع المعاينة ثم ابدأ الاستيراد.`);
    } catch (e: any) {
      setImportError(e?.message || 'تعذر قراءة ملف CSV.');
    }
  }

  async function importCsv() {
    if (!importFile || importRows.length === 0) return;
    setImporting(true);
    setImportError('');
    setImportMessage('');
    try {
      const { data, error: rpcError } = await supabase.rpc('main_office_import_paper_loads', {
        p_source_file_name: importFile.name,
        p_rows: importRows,
      });
      if (rpcError) throw rpcError;
      if (data?.ok !== true) {
        const first = Array.isArray(data?.errors) ? data.errors[0] : null;
        throw new Error(first ? `رفض الاستيراد دون حفظ أي صف. الصف ${first.source_row_number ?? first.row}: ${first.error}` : 'فشل التحقق من بيانات الملف؛ لم يتم حفظ أي صف.');
      }
      setImportMessage(`اكتمل الاستيراد: ${data.inserted} سجل جديد، ${data.duplicates} صف مكرر تم تخطيه، من إجمالي ${data.received} صف.`);
      setImportFile(null);
      setImportRows([]);
      await loadDirectory();
    } catch (e: any) {
      setImportError(e?.message || 'تعذر استيراد ملف التحميلات الورقية.');
    } finally {
      setImporting(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const weight = Number(actualWeight);
    if (!loadDate || !vehicleId || !driverId || !factoryId || !quarryId) {
      setError('أكمل التاريخ والعربية والسائق والمصنع والمحجر.');
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) {
      setError('الوزن لازم يكون أكبر من صفر وبحد أقصى 1000 طن.');
      return;
    }
    setSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('main_office_record_paper_actual_load', {
        p_load_date: loadDate,
        p_vehicle_id: vehicleId,
        p_driver_id: driverId,
        p_factory_id: factoryId,
        p_quarry_id: quarryId,
        p_actual_weight: weight,
        p_ticket_number: ticketNumber.trim() || null,
        p_notes: notes.trim() || null,
        p_source_file_name: null,
        p_source_row_number: null,
        p_source_record_id: null,
      });
      if (rpcError) throw rpcError;
      if (data?.duplicate) {
        setSuccess(`السجل موجود بالفعل ولم تتم إضافته مرة ثانية. كود الرحلة: ${data.trip_code ?? '—'}`);
      } else if (data?.created) {
        setSuccess(`تم تسجيل التحميل الورقي بنجاح. كود الرحلة: ${data.trip_code} · رقم تحميل اليوم: ${data.daily_load_number}`);
        setActualWeight('');
        setTicketNumber('');
        setNotes('');
      } else {
        throw new Error('لم يتم تأكيد تسجيل التحميل.');
      }
    } catch (e: any) {
      const raw = String(e?.message || '');
      const messages: Record<string, string> = {
        AUTH_REQUIRED: 'سجّل الدخول بحساب المكتب الرئيسي.',
        INSUFFICIENT_ROLE: 'تسجيل التحميل الورقي متاح للمكتب الرئيسي فقط.',
        PAPER_LOAD_DATE_REQUIRED: 'تاريخ التحميل مطلوب.',
        PAPER_LOAD_DIRECTORY_FIELDS_REQUIRED: 'بيانات العربية والسائق والمصنع والمحجر مطلوبة.',
        PAPER_LOAD_WEIGHT_INVALID: 'الوزن غير صالح.',
        PAPER_LOAD_VEHICLE_NOT_FOUND: 'العربية المحددة غير موجودة في الدليل.',
        PAPER_LOAD_DRIVER_NOT_FOUND: 'السائق المحدد غير موجود في الدليل.',
        PAPER_LOAD_FACTORY_NOT_FOUND: 'المصنع المحدد غير موجود في الدليل.',
        PAPER_LOAD_QUARRY_NOT_FOUND: 'المحجر المحدد غير موجود في الدليل.',
      };
      const key = Object.keys(messages).find(code => raw.includes(code));
      setError(key ? messages[key] : raw || 'تعذر تسجيل التحميل الورقي. تأكد من اعتماد Migration ونشرها على Shadow.');
    } finally {
      setSaving(false);
    }
  }

  const options = (items: Option[] = []) => items.map(item => (
    <option key={item.id} value={item.id}>{item.name}{item.code ? ` · ${item.code}` : ''}{item.plate_number ? ` · ${item.plate_number}` : ''}</option>
  ));

  return <section dir="rtl" className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-800"><FilePlus2 size={22}/></span>
        <div>
          <h2 className="text-lg font-black text-slate-900">تسجيل تحميل من الورق</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">إدخال التحميل الفعلي من الدفاتر دون إنشاء حجز وهمي أو تأكيد تسليم للسائق.</p>
        </div>
      </div>
      <button type="button" onClick={() => void loadDirectory()} disabled={loadingDirectory} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"><RefreshCw size={15} className={loadingDirectory ? 'animate-spin' : ''}/> تحديث الدليل</button>
    </div>
    {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {success && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{success}</div>}
    <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
      <h3 className="font-black text-slate-900">استيراد شيت التحميلات الورقية (CSV)</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">استخدم أكواد العربية والسائق والمصنع والمحجر كما هي في دليل التطبيق. الاستيراد يتحقق من الملف كاملًا قبل الحفظ، ويمنع إعادة استيراد نفس اسم الملف ورقم الصف.</p>
      <p className="mt-2 text-xs leading-6 text-slate-600">الأعمدة المطلوبة: <code>load_date, vehicle_code, driver_code, factory_code, quarry_code, actual_weight</code>. اختيارية: <code>ticket_number, notes, source_record_id</code>.</p>
      <input type="file" accept=".csv,text/csv" disabled={importing} onChange={event => void prepareCsv(event.target.files?.[0] ?? null)} className="mt-3 block w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"/>
      {importError && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{importError}</div>}
      {importMessage && <div role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{importMessage}</div>}
      {importRows.length > 0 && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
        <span className="text-sm font-bold text-slate-700">معاينة: {importRows.length} صف · أول صف: {importRows[0].load_date} · {importRows[0].vehicle_code} · {importRows[0].actual_weight} طن</span>
        <button type="button" onClick={() => void importCsv()} disabled={importing} className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">{importing ? <LoaderCircle size={16} className="animate-spin"/> : <FilePlus2 size={16}/>} بدء الاستيراد</button>
      </div>}
    </div>
    {loadingDirectory ? <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin"/> تحميل دليل السيارات والسائقين والمصانع والمحاجر...</div> : <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-sm font-bold text-slate-700">تاريخ التحميل<input required type="date" value={loadDate} onChange={e => setLoadDate(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"/></label>
      <label className="space-y-1 text-sm font-bold text-slate-700">العربية<select required value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="">اختر العربية</option>{options(directory.vehicles)}</select></label>
      <label className="space-y-1 text-sm font-bold text-slate-700">السائق<select required value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="">اختر السائق</option>{options(directory.drivers)}</select></label>
      <label className="space-y-1 text-sm font-bold text-slate-700">المصنع<select required value={factoryId} onChange={e => setFactoryId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="">اختر المصنع</option>{options(directory.factories)}</select></label>
      <label className="space-y-1 text-sm font-bold text-slate-700">المحجر<select required value={quarryId} onChange={e => setQuarryId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="">اختر المحجر</option>{options(directory.quarries)}</select></label>
      <label className="space-y-1 text-sm font-bold text-slate-700">الوزن الفعلي (طن)<input required type="number" min="0.001" max="1000" step="0.001" value={actualWeight} onChange={e => setActualWeight(e.target.value)} placeholder="مثال: 32.500" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"/></label>
      <label className="space-y-1 text-sm font-bold text-slate-700">رقم تذكرة الميزان (اختياري)<input maxLength={120} value={ticketNumber} onChange={e => setTicketNumber(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"/></label>
      <label className="space-y-1 text-sm font-bold text-slate-700 sm:col-span-2">ملاحظات الدفتر (اختياري)<input maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"/></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3"><button type="submit" disabled={saving || loadingDirectory} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-60">{saving ? <LoaderCircle size={17} className="animate-spin"/> : <FilePlus2 size={17}/>} تسجيل التحميل الورقي</button><span className="text-xs leading-5 text-slate-500">لا يتم تعديل أي سجل تسليم سابق، ويُخصص رقم تحميل يومي من قاعدة البيانات.</span></div>
    </form>}
  </section>;
};
