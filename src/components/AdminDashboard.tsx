import React, { useState } from 'react';
import {
  ClipboardList,
  Plus,
  Truck,
  Building2,
  Mountain,
  Package,
  FileText,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Send,
  Trash2,
  Edit2
} from 'lucide-react';
import { DailyOrder, FleetTruck, TripLoad, Quarry, ClientFactory } from '../types/fleet';

interface AdminDashboardProps {
  orders: DailyOrder[];
  trucks: FleetTruck[];
  trips: TripLoad[];
  quarries: Quarry[];
  clients: ClientFactory[];
  onOpenNewLoadModal: () => void;
  onAssignDriver: (orderId: string, truckId: string) => void;
  onUpdateOrderNotes: (orderId: string, notes: string) => void;
  onDeleteOrder: (orderId: string) => void;
  onSendDriverAlert: (driverId: string, title: string, message: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  trucks,
  trips,
  quarries,
  clients,
  onOpenNewLoadModal,
  onAssignDriver,
  onUpdateOrderNotes,
  onDeleteOrder,
  onSendDriverAlert
}) => {
  const [selectedOrderForNotes, setSelectedOrderForNotes] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState('');
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [filterMaterial, setFilterMaterial] = useState<string>('all');

  // Operational metrics
  const totalRequired = orders.reduce((sum, o) => sum + o.totalRequiredLoads, 0);
  const totalCompleted = orders.reduce((sum, o) => sum + o.completedLoads, 0);
  const activeTripsCount = trips.filter(t => t.status !== 'delivered').length;
  const totalRemaining = Math.max(0, totalRequired - totalCompleted);

  // Generate WhatsApp daily broadcast text
  const generateWhatsAppBroadcast = () => {
    let text = `🚛 جدول تشغيل ونقلات Tiba Supplies (طيبة للتوريدات والنقل الثقيل) - ${new Date().toLocaleDateString('ar-EG')}:\n\n`;
    orders.forEach((o, idx) => {
      const remaining = o.totalRequiredLoads - o.completedLoads;
      text += `${idx + 1}. العميل: ${o.clientName}\n`;
      text += `   🏭 المصنع: ${o.factoryName}\n`;
      text += `   ⛰️ مكان التحميل: ${o.quarryName}\n`;
      text += `   📦 نوع المادة: ${o.material}\n`;
      text += `   📊 المطلوب: ${o.totalRequiredLoads} نقلة (متبقي: ${remaining})\n`;
      if (o.assignedDriverName) {
        text += `   👤 السائق المعين: ${o.assignedDriverName} (${o.assignedTruckPlate})\n`;
      }
      if (o.notes) {
        text += `   ⚠️ ملاحظات: ${o.notes}\n`;
      }
      text += `---------------------------\n`;
    });
    text += `\nيرجى من جميع السائقين متابعة كابينة السائق على تطبيق Tiba Supplies لتأكيد مراحل التحميل والتفريغ فوراً.`;
    return text;
  };

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(generateWhatsAppBroadcast());
    setCopiedWhatsapp(true);
    setTimeout(() => setCopiedWhatsapp(false), 3000);
  };

  const filteredOrders = filterMaterial === 'all'
    ? orders
    : orders.filter(o => o.material === filterMaterial);

  const materialsList = Array.from(new Set(orders.map(o => o.material)));

  return (
    <div className="space-y-6">
      
      {/* Top Operations KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="text-zinc-400 text-xs font-semibold">إجمالي الحمولات المطلوبة اليوم</div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1 tabular-nums">
            {totalRequired} <span className="text-xs font-normal text-zinc-400">نقلة</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">حسب طلبيات المصانع المسجلة</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="text-emerald-400 text-xs font-semibold">تم تسليمها وتفريغها بنجاح</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 tabular-nums">
            {totalCompleted} <span className="text-xs font-normal text-zinc-400">نقلة</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {totalRequired > 0 ? `${Math.round((totalCompleted / totalRequired) * 100)}% من المستهدف` : '0%'}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="text-amber-400 text-xs font-semibold">حمولات جارية على الطريق</div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 tabular-nums">
            {activeTripsCount} <span className="text-xs font-normal text-zinc-400">تريلا</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">بين التحميل في المحجر والوصول</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="text-zinc-400 text-xs font-semibold">الحمولات المتبقية للتنفيذ</div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-200 mt-1 tabular-nums">
            {totalRemaining} <span className="text-xs font-normal text-zinc-400">نقلة</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">متاحة للحجز من السائقين</div>
        </div>

      </div>

      {/* Main Administrative Daily Orders Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        
        {/* Table / Section Toolbar */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-950/60">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              <span>أوامر التحميل والنقلات اليومية (Daily Dispatch Board)</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              إدخال وتعيين تفاصيل كل حمولة: العميل، المصنع، المحجر، نوع الحمولة، والملاحظات الخاصة
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter by material */}
            <select
              aria-label="تصفية حسب نوع الحمولة"
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-xs rounded-lg px-2.5 py-2 text-zinc-200"
            >
              <option value="all">كل المواد والخامات</option>
              {materialsList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Quick WhatsApp broadcast generator button */}
            <button
              onClick={handleCopyWhatsApp}
              className="bg-emerald-600/90 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition active:scale-95 shadow-sm"
              title="نسخ كشف الطلبيات كرسالة واتساب منسقة لمشاركتها مع جروب السائقين"
            >
              {copiedWhatsapp ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              <span>{copiedWhatsapp ? 'تم نسخ رسالة الواتساب!' : 'نسخ كشف الواتساب'}</span>
            </button>

            {/* Add New Load Button */}
            <button
              onClick={onOpenNewLoadModal}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إضافة حمولة جديدة</span>
            </button>
          </div>
        </div>

        {/* Orders List / Cards Grid */}
        <div className="p-4 sm:p-5 space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              <Package className="w-12 h-12 mx-auto text-zinc-600 mb-2" />
              <p className="font-semibold text-zinc-300">لا توجد حمولات مدخلة حالياً</p>
              <p className="text-xs text-zinc-500 mt-1">اضغط على "إضافة حمولة جديدة" للبدء بإدخال تفاصيل النقلة وتعيين السائق</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOrders.map((ord) => {
                const remaining = ord.totalRequiredLoads - ord.completedLoads;
                const progressPercent = ord.totalRequiredLoads > 0
                  ? Math.min(100, Math.round((ord.completedLoads / ord.totalRequiredLoads) * 100))
                  : 0;

                return (
                  <div
                    key={ord.id}
                    className="bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 sm:p-5 transition space-y-4"
                  >
                    {/* Header Row: Material, Client, Priority, Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-black px-3 py-1 rounded-lg bg-amber-500 text-zinc-950">
                          {ord.material}
                        </span>
                        <div>
                          <span className="text-sm font-bold text-white">{ord.clientName}</span>
                          <span className="text-xs text-zinc-400 mr-2">· {ord.factoryName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          ord.priority === 'أولوية قصوى'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : ord.priority === 'عاجل'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {ord.priority}
                        </span>

                        <span className={`text-xs px-2.5 py-0.5 rounded font-semibold ${
                          ord.status === 'مكتمل'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}>
                          {ord.status}
                        </span>

                        <button
                          onClick={() => onDeleteOrder(ord.id)}
                          className="text-zinc-500 hover:text-red-400 p-1 rounded transition"
                          title="حذف أمر التحميل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Detailed Properties Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      
                      {/* Quarry details */}
                      <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
                        <div className="text-amber-400 font-bold flex items-center gap-1">
                          <Mountain className="w-3.5 h-3.5" />
                          <span>مكان التحميل (المحجر):</span>
                        </div>
                        <div className="text-white font-semibold text-sm">{ord.quarryName}</div>
                      </div>

                      {/* Factory / Delivery details */}
                      <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
                        <div className="text-amber-400 font-bold flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>وجهة التسليم (المصنع):</span>
                        </div>
                        <div className="text-white font-semibold text-sm">{ord.factoryName}</div>
                        <div className="text-zinc-400 text-[11px]">العميل: {ord.clientName}</div>
                      </div>

                      {/* Driver Assigned */}
                      <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
                        <div className="text-amber-400 font-bold flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>السائق والسيارة المعينة:</span>
                        </div>
                        {ord.assignedDriverName ? (
                          <div className="space-y-1">
                            <div className="text-white font-semibold text-sm">
                              {ord.assignedDriverName}
                            </div>
                            <div className="text-zinc-400 font-mono text-[11px]">
                              لوحة: {ord.assignedTruckPlate}
                            </div>
                          </div>
                        ) : (
                          <div className="text-zinc-400 text-xs">
                            حمولة عامة مفتوحة لأي سائق في الأسطول
                          </div>
                        )}

                        {/* Driver re-assignment dropdown */}
                        <div className="pt-1">
                          <select
                            aria-label="تغيير أو تعيين سائق للحمولة"
                            value={trucks.find(t => t.driverId === ord.assignedDriverId)?.id || ''}
                            onChange={(e) => onAssignDriver(ord.id, e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 text-[11px] rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-amber-500"
                          >
                            <option value="">-- تعيين أو تغيير السائق --</option>
                            {trucks.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.driverName} - {t.plateNumber}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                    </div>

                    {/* Progress Bar & Load Quota */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-zinc-300">
                        <span>إنجاز الحمولات:</span>
                        <span className="font-mono font-bold text-amber-400">
                          تم تسليم {ord.completedLoads} من {ord.totalRequiredLoads} نقلة (متبقي {remaining})
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Notes Box with inline edit */}
                    <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-400 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          <span>الملاحظات والتعليمات الموجهة للسائقين:</span>
                        </span>
                        <button
                          onClick={() => {
                            if (selectedOrderForNotes === ord.id) {
                              setSelectedOrderForNotes(null);
                            } else {
                              setSelectedOrderForNotes(ord.id);
                              setEditingNotesText(ord.notes || '');
                            }
                          }}
                          className="text-zinc-400 hover:text-amber-400 text-[11px] flex items-center gap-1 transition"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{selectedOrderForNotes === ord.id ? 'إغلاق التعديل' : 'تعديل الملاحظات وإشعار السائق'}</span>
                        </button>
                      </div>

                      {selectedOrderForNotes === ord.id ? (
                        <div className="space-y-2 pt-1 animate-in fade-in">
                          <textarea
                            rows={2}
                            value={editingNotesText}
                            onChange={(e) => setEditingNotesText(e.target.value)}
                            placeholder="اكتب التحديث أو الملاحظة هنا..."
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                onUpdateOrderNotes(ord.id, editingNotesText);
                                setSelectedOrderForNotes(null);
                              }}
                              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-3 py-1 rounded text-xs"
                            >
                              حفظ وإرسال إشعار فوري للسائق 🔔
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-zinc-300 leading-relaxed">
                          {ord.notes || 'لا توجد ملاحظات خاصة مسجلة لهذه الحمولة.'}
                        </p>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
