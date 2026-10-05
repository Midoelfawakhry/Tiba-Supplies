import React, { useState } from 'react';
import { X, Truck, Building2, Mountain, Package, FileText, UserCheck, AlertCircle, Check } from 'lucide-react';
import { Quarry, ClientFactory, FleetTruck, DailyOrder } from '../types/fleet';

interface NewLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  quarries: Quarry[];
  clients: ClientFactory[];
  trucks: FleetTruck[];
  onSubmit: (loadData: {
    clientName: string;
    factoryName: string;
    quarryName: string;
    material: string;
    notes: string;
    totalRequiredLoads: number;
    assignedDriverId?: string;
    assignedDriverName?: string;
    assignedTruckPlate?: string;
    priority: 'عاجل' | 'عادي' | 'أولوية قصوى';
    quarryCoords: { lat: number; lng: number };
    factoryCoords: { lat: number; lng: number };
  }) => void;
}

const COMMON_MATERIALS = [
  'سن 1',
  'سن 2',
  'سن 3',
  'سن فيلر',
  'سن بودرة',
  'رمل أصفر',
  'رمل أبيض (زجاجي)',
  'رمل مباني',
  'دبش مباني',
  'دبش تكاسي',
  'زلط فينو',
  'زلط عادة',
  'طفلة أسمنتية',
  'جبس خام',
  'حجر جيري'
];

export const NewLoadModal: React.FC<NewLoadModalProps> = ({
  isOpen,
  onClose,
  quarries,
  clients,
  trucks,
  onSubmit
}) => {
  const [clientName, setClientName] = useState('');
  const [factoryName, setFactoryName] = useState('');
  const [quarryName, setQuarryName] = useState('');
  const [material, setMaterial] = useState('سن 2');
  const [customMaterial, setCustomMaterial] = useState('');
  const [notes, setNotes] = useState('');
  const [totalRequiredLoads, setTotalRequiredLoads] = useState<number>(5);
  const [assignedTruckId, setAssignedTruckId] = useState<string>('');
  const [priority, setPriority] = useState<'عاجل' | 'عادي' | 'أولوية قصوى'>('عادي');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSelectFactory = (factoryId: string) => {
    const f = clients.find(c => c.id === factoryId);
    if (f) {
      setFactoryName(f.name);
      setClientName(f.clientName);
      if (f.unloadingNotes && !notes) {
        setNotes(`تعليمات التفريغ: ${f.unloadingNotes}`);
      }
    }
  };

  const handleSelectQuarry = (quarryId: string) => {
    const q = quarries.find(item => item.id === quarryId);
    if (q) {
      setQuarryName(q.name);
      if (q.materialsAvailable.length > 0 && !material) {
        setMaterial(q.materialsAvailable[0]);
      }
      if (q.gateNotes && !notes.includes(q.gateNotes)) {
        setNotes(prev => prev ? `${prev} | تعليمات المحجر: ${q.gateNotes}` : `تعليمات المحجر: ${q.gateNotes}`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setErrorMsg('يرجى إدخال اسم العميل');
      return;
    }
    if (!factoryName.trim()) {
      setErrorMsg('يرجى إدخال اسم المصنع');
      return;
    }
    if (!quarryName.trim()) {
      setErrorMsg('يرجى إدخال اسم المحجر');
      return;
    }
    const finalMaterial = material === 'أخرى' ? customMaterial.trim() : material;
    if (!finalMaterial) {
      setErrorMsg('يرجى تحديد نوع الحمولة أو كتابته');
      return;
    }

    // Coordinates lookup or fallback
    const matchedQuarry = quarries.find(q => q.name.includes(quarryName) || quarryName.includes(q.name));
    const matchedFactory = clients.find(c => c.name.includes(factoryName) || factoryName.includes(c.name));

    const quarryCoords = matchedQuarry?.location || { lat: 29.8732, lng: 32.4285 };
    const factoryCoords = matchedFactory?.location || { lat: 29.9721, lng: 32.5123 };

    let assignedDriverId: string | undefined = undefined;
    let assignedDriverName: string | undefined = undefined;
    let assignedTruckPlate: string | undefined = undefined;

    if (assignedTruckId) {
      const truck = trucks.find(t => t.id === assignedTruckId);
      if (truck) {
        assignedDriverId = truck.driverId;
        assignedDriverName = truck.driverName;
        assignedTruckPlate = truck.plateNumber;
      }
    }

    onSubmit({
      clientName: clientName.trim(),
      factoryName: factoryName.trim(),
      quarryName: quarryName.trim(),
      material: finalMaterial,
      notes: notes.trim(),
      totalRequiredLoads: Number(totalRequiredLoads) || 1,
      assignedDriverId,
      assignedDriverName,
      assignedTruckPlate,
      priority,
      quarryCoords,
      factoryCoords
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-2xl rounded-2xl shadow-2xl text-zinc-100 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">إدخال تفاصيل حمولة جديدة (أمر تحميل)</h2>
              <p className="text-xs text-zinc-400">سيتم إرسال ونشر تفاصيل الحمولة فوراً للسائقين المعينين وتتبعها</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick pick existing factories & quarries */}
          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-xs text-zinc-400 space-y-2">
            <div className="font-semibold text-zinc-300">اختيار سريع من الكشوفات المسجلة:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 text-[11px] text-zinc-400">اختيار مصنع/عميل مسجل:</label>
                <select
                  aria-label="اختيار مصنع أو عميل مسجل"
                  onChange={(e) => handleSelectFactory(e.target.value)}
                  defaultValue=""
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200"
                >
                  <option value="" disabled>-- اختر المصنع المسجل --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.clientName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-[11px] text-zinc-400">اختيار محجر مسجل:</label>
                <select
                  aria-label="اختيار محجر مسجل"
                  onChange={(e) => handleSelectQuarry(e.target.value)}
                  defaultValue=""
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200"
                >
                  <option value="" disabled>-- اختر المحجر المسجل --</option>
                  {quarries.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.name} - {q.region}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Grid: Client & Factory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-500" />
                <span>اسم العميل / الشركة *</span>
              </label>
              <input
                type="text"
                placeholder="مثال: مجموعة السويس للأسمنت"
                value={clientName}
                onChange={(e) => { setClientName(e.target.value); setErrorMsg(''); }}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-500" />
                <span>اسم المصنع / موقع التسليم *</span>
              </label>
              <input
                type="text"
                placeholder="مثال: مصنع أسمنت السويس - السيلو 4"
                value={factoryName}
                onChange={(e) => { setFactoryName(e.target.value); setErrorMsg(''); }}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          {/* Grid: Quarry & Material */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Mountain className="w-3.5 h-3.5 text-amber-500" />
                <span>اسم المحجر (مكان التحميل) *</span>
              </label>
              <input
                type="text"
                placeholder="مثال: محجر عتاقة الرئيسي - كسارة السويس"
                value={quarryName}
                onChange={(e) => { setQuarryName(e.target.value); setErrorMsg(''); }}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-amber-500" />
                <span>نوع الحمولة / المادة *</span>
              </label>
              <select
                aria-label="نوع الحمولة أو المادة"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {COMMON_MATERIALS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="أخرى">مادة أخرى (كتابة يدوية)</option>
              </select>
              {material === 'أخرى' && (
                <input
                  type="text"
                  placeholder="اكتب نوع المادة هنا..."
                  value={customMaterial}
                  onChange={(e) => setCustomMaterial(e.target.value)}
                  className="w-full mt-2 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500"
                  required
                />
              )}
            </div>
          </div>

          {/* Grid: Loads Count, Assign Driver, Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                عدد الحمولات المطلوبة:
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={totalRequiredLoads}
                onChange={(e) => setTotalRequiredLoads(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                <span>تعيين سائق وسيارة محددة:</span>
              </label>
              <select
                aria-label="تعيين سائق وسيارة محددة"
                value={assignedTruckId}
                onChange={(e) => setAssignedTruckId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="">-- حمولة عامة مفتوحة لأي سائق --</option>
                {trucks.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.driverName} - {t.plateNumber} ({t.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                درجة الأولوية:
              </label>
              <select
                aria-label="درجة أولوية الحمولة"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="عادي">عادي</option>
                <option value="عاجل">عاجل</option>
                <option value="أولوية قصوى">أولوية قصوى</option>
              </select>
            </div>
          </div>

          {/* Notes field */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>أي ملاحظات أخرى (تعليمات هامة للسائقين)</span>
            </label>
            <textarea
              rows={3}
              placeholder="مثال: ضرورة الوزن على ميزان البسكول، التواصل مع مسؤول الاستلام م. طارق هاتفياً قبل الوصول بربع ساعة، التأكد من فرد المشمع."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 leading-relaxed"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow transition-transform active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>تأكيد ونشر الحمولة للسائقين</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
