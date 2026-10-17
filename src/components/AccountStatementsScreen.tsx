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
  const number = Number(row.actual_weight ?? row.actual_weight_tons ?? row.weight_tons ?? row.net_weight);
  return Number.isFinite(number) ? number : 0;
};

export const AccountStatementsScreen: React.FC<{ kind: StatementKind }> = ({ kind }) => {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [statementRows, setStatementRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entityId, setEntityId] = useState('');
  const [relatedEntityId, setRelatedEntityId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [tripCode, setTripCode] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [ownerId, setOwnerId] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [snapshotResult, statementResult, ownerReportResult] = await Promise.all([
        getLiveSnapshot(),
        supabase.rpc('get_account_statement_records', { p_from: fromDate || null, p_to: toDate || null }),
        supabase.rpc('get_vehicle_owner_reports', { p_from: fromDate || null, p_to: toDate || null }),
      ]);
      if (statementResult.error) throw statementResult.error;
      // The statement RPC already includes owner details; keep the report usable if the optional owner summary RPC is unavailable.
      const ownerReport = ownerReportResult.error ? {} : (ownerReportResult.data ?? {});
      const ownerVehicles: Row[] = Array.isArray(ownerReport.vehicles) ? ownerReport.vehicles : [];
      const keyOf = (v: Row) => String(v.vehicle_id ?? v.id ?? '');
      const ownerByVehicle = new Map(ownerVehicles.map((v: Row) => [keyOf(v), v] as const).filter(([id]) => Boolean(id)));
      const dashboardByVehicle = new Map(((snapshotResult as any).vehicles ?? []).map((v: Row) => [keyOf(v), v] as const).filter(([id]) => Boolean(id)));
      const vehicleIds = new Set([...dashboardByVehicle.keys(), ...ownerByVehicle.keys()]);
      const vehicles = [...vehicleIds].map(id => {
        const dashboardVehicle = dashboardByVehicle.get(id) ?? {};
        const ownerVehicle = ownerByVehicle.get(id) ?? {};
        return {
          ...dashboardVehicle,
          ...ownerVehicle,
          vehicle_id: ownerVehicle.vehicle_id ?? dashboardVehicle.vehicle_id ?? dashboardVehicle.id ?? ownerVehicle.id ?? id,
          plate_number: ownerVehicle.plate_number ?? dashboardVehicle.plate_number ?? dashboardVehicle.plate ?? null,
          vehicle_code: ownerVehicle.vehicle_code ?? dashboardVehicle.vehicle_code ?? dashboardVehicle.code ?? null,
          owner_id: ownerVehicle.owner_id ?? dashboardVehicle.owner_id ?? dashboardVehicle.owner?.id ?? null,
          owner_name: ownerVehicle.owner_name ?? dashboardVehicle.owner_name ?? dashboardVehicle.owner?.name ?? null,
        };
      });
      setSnapshot({ ...snapshotResult, vehicles } as LiveSnapshot);
      setStatementRows(Array.isArray(statementResult.data) ? statementResult.data : []);
    } catch (e: any) { setError(e?.message || 'تعذر تحميل كشف الحساب.'); }
    finally { setLoading(false); }
  }, [fromDate, toDate]);
  useEffect(() => { void load(); }, [load]);

  const entities = kind === 'factory' ? (snapshot?.factories ?? []) : (snapshot?.quarries ?? []);
  const entityKey = kind === 'factory' ? 'factory_id' : 'quarry_id';
  const entityName = kind === 'factory' ? 'factory_name' : 'quarry_name';
  const relatedEntityKey = kind === 'factory' ? 'quarry_id' : 'factory_id';
  const relatedEntityName = kind === 'factory' ? 'quarry_name' : 'factory_name';
  const Icon = kind === 'factory' ? Building2 : Mountain;
  const vehicles: Row[] = snapshot?.vehicles ?? [];
  const vehicleKey = (v: Row) => String(v.vehicle_id ?? v.id ?? '');
  const vehicleById = new Map(vehicles.map(v => [vehicleKey(v), v] as const).filter(([id]) => Boolean(id)));
  const owners = [...new Map(vehicles.filter(v => v.owner_id).map(v => [String(v.owner_id), { owner_id: String(v.owner_id), name: String(v.owner_name ?? v.owner?.name ?? 'مالك بدون اسم') }])).values()];
  const records = useMemo(() => statementRows.filter((row: Row) => {
    if (entityId && String(row[entityKey] ?? '') !== entityId) return false;
    if (relatedEntityId && String(row[relatedEntityKey] ?? '') !== relatedEntityId) return false;
    const date = dateValue(row);
    if (fromDate && (!date || date < fromDate)) return false;
    if (toDate && (!date || date > toDate)) return false;
    if (tripCode && !String(row.trip_code ?? '').toLowerCase().includes(tripCode.toLowerCase())) return false;
    if (vehicleId && String(row.vehicle_id ?? '') !== vehicleId) return false;
    if (ownerId && String(vehicleById.get(String(row.vehicle_id ?? ''))?.owner_id ?? row.owner_id ?? '') !== ownerId) return false;
    return true;
  }).sort((a: Row, b: Row) => dateValue(b).localeCompare(dateValue(a))), [statementRows, entityId, entityKey, relatedEntityId, relatedEntityKey, fromDate, toDate, tripCode, vehicleId, ownerId, vehicles]);

  const totalWeight = records.reduce((sum: number, row: Row) => sum + numericWeight(row), 0);
  const selectedEntity = entities.find((entity: Row) => String(entity[entityKey]) === entityId);
  const factories = snapshot?.factories ?? [];
  const quarries = snapshot?.quarries ?? [];
  const drivers = snapshot?.drivers ?? [];
  const lookupName = (items: Row[], key: string, id: unknown, fallback = '—') => items.find(item => String(item[key] ?? item.id) === String(id))?.name ?? fallback;
  // Only show related entities evidenced by actual loading records; never imply every quarry serves every factory.
  const relatedEntities = [...new Map(statementRows
    .filter((row: Row) => (!entityId || String(row[entityKey] ?? '') === entityId) && row[relatedEntityKey])
    .map((row: Row) => [String(row[relatedEntityKey]), {
      [relatedEntityKey]: String(row[relatedEntityKey]),
      name: row[relatedEntityName] ?? lookupName(kind === 'factory' ? quarries : factories, relatedEntityKey, row[relatedEntityKey], 'جهة مرتبطة'),
    } as Row] as const))].map(([, value]) => value);
  const selectClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal';

  return <section dir="rtl" className="space-y-4 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className={kind === 'factory' ? 'grid h-11 w-11 place-items-center rounded-2xl bg-sky-100 text-sky-700' : 'grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700'}><Icon size={22}/></span>
        <div><h2 className="text-lg font-black">{kind === 'factory' ? 'كشف أوزان المصانع والعملاء' : 'كشف أوزان المحاجر'}</h2><p className="mt-1 text-xs text-slate-500">كشف تشغيلي بالأوزان الفعلية المعتمدة بالطن فقط، دون أسعار أو مستحقات.</p></div>
      </div>
      <div className="flex gap-2 print:hidden">
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/> تحديث</button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Printer size={15}/> طباعة / PDF</button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
      <label className="text-xs font-bold text-slate-700">{kind === 'factory' ? 'المصنع / العميل' : 'المحجر'}
        <select value={entityId} onChange={e => { setEntityId(e.target.value); setRelatedEntityId(''); }} className={selectClass}><option value="">كل {kind === 'factory' ? 'المصانع' : 'المحاجر'}</option>{entities.map((entity: Row) => <option key={entity[entityKey]} value={entity[entityKey]}>{entity.name ?? entity[entityName] ?? 'بدون اسم'}</option>)}</select>
      </label>
      <label className="text-xs font-bold text-slate-700">{kind === 'factory' ? 'المحجر المرتبط بالتحميلات' : 'المصنع المرتبط بالتحميلات'}
        <select value={relatedEntityId} onChange={e => setRelatedEntityId(e.target.value)} className={selectClass}><option value="">{kind === 'factory' ? 'كل المحاجر الظاهرة بالتحميلات' : 'كل المصانع الظاهرة بالتحميلات'}</option>{relatedEntities.map((entity: Row) => <option key={entity[relatedEntityKey]} value={entity[relatedEntityKey]}>{entity.name}</option>)}</select>
      </label>
      <label className="text-xs font-bold text-slate-700">من تاريخ<input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} className={selectClass}/></label>
      <label className="text-xs font-bold text-slate-700">إلى تاريخ<input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} className={selectClass}/></label>
      <label className="text-xs font-bold text-slate-700">كود النقلة<input value={tripCode} onChange={e => setTripCode(e.target.value)} placeholder="اكتب كود النقلة" className={selectClass}/></label>
      <label className="text-xs font-bold text-slate-700">العربية<select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className={selectClass}><option value="">كل العربيات</option>{vehicles.map(v => <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_number ?? v.vehicle_code ?? 'عربية بدون رقم'}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-700">مالك العربية<select value={ownerId} onChange={e => setOwnerId(e.target.value)} className={selectClass}><option value="">كل الملاك</option>{owners.map(o => <option key={o.owner_id} value={o.owner_id}>{o.name}</option>)}</select></label>
      <div className="flex items-end gap-2"><button type="button" onClick={() => void load()} className="w-full rounded-xl bg-blue-700 px-3 py-2.5 text-sm font-bold text-white">عرض الفترة</button><button type="button" onClick={() => {setEntityId('');setRelatedEntityId('');setTripCode('');setVehicleId('');setOwnerId('');setFromDate('');setToDate('');}} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold">مسح الفلاتر</button></div>
    </div>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">عدد التحميلات الفعلية</p><p className="mt-1 text-xl font-black tabular-nums">{records.length.toLocaleString('ar-EG')}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">إجمالي الوزن المعتمد</p><p className="mt-1 text-xl font-black tabular-nums">{totalWeight.toLocaleString('ar-EG', { maximumFractionDigits: 3 })} <span className="text-xs font-bold">طن</span></p></div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">الفترة</p><p className="mt-1 text-sm font-black">{fromDate || 'من البداية'} — {toDate || 'حتى الآن'}</p></div>
    </div>

    <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900"><FileText size={17} className="mt-0.5 shrink-0"/><p>الوزن يظهر عند تأكيد التسليم وتسجيل الوزن الفعلي. كل كود عربية ثابت ومرتبط بمالكها المسجل. أي تغيير فعلي في العربية أو المالك يُسجل كعربية جديدة بكود مستقل. لا توجد مستحقات مالية في المرحلة الأولى.</p></div>

    {loading && !snapshot ? <p className="py-8 text-center text-sm text-slate-500">جاري تحميل البيانات...</p> : records.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><Scale className="mx-auto mb-2 text-slate-400" size={25}/><p className="text-sm font-bold text-slate-700">لا توجد تحميلات فعلية مطابقة للفلاتر</p><p className="mt-1 text-xs text-slate-500">غيّر الفترة أو أحد فلاتر التقرير.</p></div> :
      <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[920px] text-right text-xs">
        <thead className="bg-slate-100 text-slate-700"><tr><th className="px-3 py-3 font-black">التاريخ</th><th className="px-3 py-3 font-black">كود النقلة</th><th className="px-3 py-3 font-black">تحميل اليوم</th><th className="px-3 py-3 font-black">رقم التذكرة</th><th className="px-3 py-3 font-black">العربية</th><th className="px-3 py-3 font-black">السائق</th><th className="px-3 py-3 font-black">المالك العربية</th><th className="px-3 py-3 font-black">المصنع</th><th className="px-3 py-3 font-black">المحجر</th><th className="px-3 py-3 text-left font-black">الوزن (طن)</th></tr></thead>
        <tbody className="divide-y divide-slate-100 bg-white">{records.map((row: Row, index: number) => <tr key={String(row.actual_load_id ?? row.actual_loading_record_id ?? row.booking_id ?? index)} className="hover:bg-slate-50">
          <td className="whitespace-nowrap px-3 py-3">{formatDate(dateValue(row))}</td><td className="whitespace-nowrap px-3 py-3 font-black">{row.trip_code ?? '—'}</td><td className="whitespace-nowrap px-3 py-3 font-bold">{row.daily_load_number ?? '—'}</td><td className="px-3 py-3 font-bold">{row.ticket_number ?? row.record_number ?? '—'}</td>
          <td className="px-3 py-3">{row.plate_number ?? vehicleById.get(String(row.vehicle_id ?? ''))?.plate_number ?? lookupName(vehicles, 'vehicle_id', row.vehicle_id, '—')}</td><td className="px-3 py-3">{lookupName(drivers, 'driver_id', row.driver_id, row.driver_name ?? '—')}</td><td className="px-3 py-3">{row.owner_name ?? vehicleById.get(String(row.vehicle_id ?? ''))?.owner_name ?? 'غير مسجل'}</td><td className="px-3 py-3">{lookupName(snapshot?.factories ?? [], 'factory_id', row.factory_id, row.factory_name ?? '—')}</td><td className="px-3 py-3">{lookupName(snapshot?.quarries ?? [], 'quarry_id', row.quarry_id, row.quarry_name ?? '—')}</td><td className="whitespace-nowrap px-3 py-3 text-left font-bold tabular-nums">{numericWeight(row) ? numericWeight(row).toLocaleString('ar-EG', { maximumFractionDigits: 3 }) : '—'}</td>
        </tr>)}</tbody>
      </table></div>}
    <p className="text-[10px] text-slate-400">Tiba Supplies · {selectedEntity?.name ?? (kind === 'factory' ? 'كشف تحميل المصانع' : 'كشف تحميل المحاجر')}</p>
  </section>;
};
