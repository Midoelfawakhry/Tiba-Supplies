import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Mountain, RefreshCw, Printer, FileText, Scale } from 'lucide-react';
import { getLiveSnapshot, LiveSnapshot } from '../services/liveData';
import { supabase } from '../lib/supabase';

type StatementKind = 'factory' | 'quarry';
type Row = Record<string, any>;

const dateValue = (row: Row) => String(row.loading_sequence_date ?? row.load_date ?? row.created_at ?? '').slice(0, 10);
const formatDate = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('ar-EG') : '—';
const numericWeight = (row: Row) => {
  if (!row.delivery_confirmed_at) return 0;
  const value = row.actual_weight ?? row.actual_weight_tons ?? row.weight_tons ?? row.net_weight;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const AccountStatementsScreen: React.FC<{ kind: StatementKind }> = ({ kind }) => {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [statementRows, setStatementRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entityId, setEntityId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [snapshotData, statementResult] = await Promise.all([
        getLiveSnapshot(),
        supabase.rpc('get_account_statement_records', { p_from: fromDate || null, p_to: toDate || null }),
      ]);
      if (statementResult.error) throw statementResult.error;
      setSnapshot(snapshotData);
      setStatementRows(Array.isArray(statementResult.data) ? statementResult.data : []);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل كشف الحساب.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { void load(); }, [load]);

  const entities = kind === 'factory' ? (snapshot?.factories ?? []) : (snapshot?.quarries ?? []);
  const entityKey = kind === 'factory' ? 'factory_id' : 'quarry_id';
  const entityName = kind === 'factory' ? 'factory_name' : 'quarry_name';
  const Icon = kind === 'factory' ? Building2 : Mountain;
  const records = useMemo(() => statementRows.filter((row: Row) => {
    if (entityId && String(row[entityKey] ?? '') !== entityId) return false;
    const date = dateValue(row);
    if (fromDate && (!date || date < fromDate)) return false;
    if (toDate && (!date || date > toDate)) return false;
    return true;
  }).sort((a: Row, b: Row) => dateValue(b).localeCompare(dateValue(a))), [statementRows, entityId, entityKey, fromDate, toDate]);

  const totalWeight = records.reduce((sum: number, row: Row) => sum + numericWeight(row), 0);
  const selectedEntity = entities.find((entity: Row) => String(entity[entityKey]) === entityId);
  const factories = snapshot?.factories ?? [];
  const quarries = snapshot?.quarries ?? [];
  const drivers = snapshot?.drivers ?? [];
  const vehicles = snapshot?.vehicles ?? [];
  const lookupName = (items: Row[], key: string, id: unknown, fallback = '—') =>
    items.find(item => String(item[key]) === String(id))?.name ?? fallback;

  return <section dir="rtl" className="space-y-4 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className={kind === 'factory' ? 'grid h-11 w-11 place-items-center rounded-2xl bg-sky-100 text-sky-700' : 'grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700'}><Icon size={22}/></span>
        <div><h2 className="text-lg font-black">{kind === 'factory' ? 'كشف تحميل المصنع' : 'كشف تحميل المحجر'}</h2><p className="mt-1 text-xs text-slate-500">كشف حركة التحميل الفعلي حسب الفترة المحددة</p></div>
      </div>
      <div className="flex gap-2 print:hidden">
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/> تحديث</button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Printer size={15}/> طباعة / PDF</button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3 print:hidden">
      <label className="text-xs font-bold text-slate-700">{kind === 'factory' ? 'المصنع / العميل' : 'المحجر'}
        <select value={entityId} onChange={e => setEntityId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal">
          <option value="">كل {kind === 'factory' ? 'المصانع' : 'المحاجر'}</option>
          {entities.map((entity: Row) => <option key={entity[entityKey]} value={entity[entityKey]}>{entity.name ?? entity[entityName] ?? 'بدون اسم'}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-slate-700">من تاريخ<input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
      <label className="text-xs font-bold text-slate-700">إلى تاريخ<input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
    </div>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">عدد التحميلات الفعلية</p><p className="mt-1 text-xl font-black tabular-nums">{records.length.toLocaleString('ar-EG')}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">إجمالي الوزن المسجل</p><p className="mt-1 text-xl font-black tabular-nums">{totalWeight.toLocaleString('ar-EG', { maximumFractionDigits: 3 })} <span className="text-xs font-bold">طن</span></p></div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">الفترة</p><p className="mt-1 text-sm font-black">{fromDate || 'من البداية'} — {toDate || 'حتى الآن'}</p></div>
    </div>

    <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
      <FileText size={17} className="mt-0.5 shrink-0"/>
      <p>ده سجل تشغيل للتحميل الفعلي بالأوزان فقط. كود النقلة والرقم اليومي ثابتين وبيستخدموا لربط نفس النقلة بين شاشات التشغيل والتقارير، والوزن يظهر عند تسجيله وتأكيد التسليم.</p>
    </div>

    {loading && !snapshot ? <p className="py-8 text-center text-sm text-slate-500">جاري تحميل البيانات...</p> : records.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><Scale className="mx-auto mb-2 text-slate-400" size={25}/><p className="text-sm font-bold text-slate-700">لا توجد تحميلات فعلية مطابقة للفلاتر</p><p className="mt-1 text-xs text-slate-500">جرّب تغيير المصنع أو المحجر أو الفترة.</p></div> :
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[920px] text-right text-xs">
          <thead className="bg-slate-100 text-slate-700"><tr>
            <th className="px-3 py-3 font-black">التاريخ</th><th className="px-3 py-3 font-black">كود النقلة</th><th className="px-3 py-3 font-black">تحميل اليوم</th><th className="px-3 py-3 font-black">رقم التذكرة</th><th className="px-3 py-3 font-black">العربية</th><th className="px-3 py-3 font-black">السائق</th><th className="px-3 py-3 font-black">المصنع</th><th className="px-3 py-3 font-black">المحجر</th><th className="px-3 py-3 text-left font-black">الوزن (طن)</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">{records.map((row: Row, index: number) => <tr key={String(row.actual_load_id ?? row.actual_loading_record_id ?? row.booking_id ?? index)} className="hover:bg-slate-50">
            <td className="whitespace-nowrap px-3 py-3">{formatDate(dateValue(row))}</td>
            <td className="whitespace-nowrap px-3 py-3 font-black">{row.trip_code ?? '—'}</td>
            <td className="whitespace-nowrap px-3 py-3 font-bold">{row.daily_load_number ?? '—'}</td>
            <td className="px-3 py-3 font-bold">{row.ticket_number ?? row.record_number ?? '—'}</td>
            <td className="px-3 py-3">{lookupName(vehicles, 'vehicle_id', row.vehicle_id, row.plate_number ?? '—')}</td>
            <td className="px-3 py-3">{lookupName(drivers, 'driver_id', row.driver_id, row.driver_name ?? '—')}</td>
            <td className="px-3 py-3">{lookupName(factories, 'factory_id', row.factory_id, row.factory_name ?? '—')}</td>
            <td className="px-3 py-3">{lookupName(quarries, 'quarry_id', row.quarry_id, row.quarry_name ?? '—')}</td>
            <td className="whitespace-nowrap px-3 py-3 text-left font-bold tabular-nums">{numericWeight(row) ? numericWeight(row).toLocaleString('ar-EG', { maximumFractionDigits: 3 }) : '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    <p className="text-[10px] text-slate-400">Tiba Supplies · {selectedEntity?.name ?? (kind === 'factory' ? 'كشف تحميل المصانع' : 'كشف تحميل المحاجر')}</p>
  </section>;
};
