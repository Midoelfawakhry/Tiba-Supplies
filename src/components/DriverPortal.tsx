import React, { useState } from 'react';
import {
  Truck,
  Building2,
  Mountain,
  Package,
  FileText,
  MapPin,
  Phone,
  CheckCircle2,
  Navigation,
  Scale,
  Clock,
  ArrowRight,
  Radio,
  AlertTriangle,
  ExternalLink,
  Archive,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DailyOrder, TripLoad, FleetTruck, AppNotification, TripStatus } from '../types/fleet';

interface DriverPortalProps {
  currentDriver: FleetTruck;
  allTrucks: FleetTruck[];
  onSwitchDriver: (truck: FleetTruck) => void;
  orders: DailyOrder[];
  activeTrips: TripLoad[];
  notifications: AppNotification[];
  onClaimOrder: (order: DailyOrder) => void;
  onUpdateTripStatus: (tripId: string, status: TripStatus, extra?: { ticketNumber?: string; netWeightTons?: number; driverNotes?: string }) => void;
  onMarkNotificationRead: (id: string) => void;
}

export const DriverPortal: React.FC<DriverPortalProps> = ({
  currentDriver,
  allTrucks,
  onSwitchDriver,
  orders,
  activeTrips,
  notifications,
  onClaimOrder,
  onUpdateTripStatus,
  onMarkNotificationRead
}) => {
  const [ticketInput, setTicketInput] = useState<{ [tripId: string]: string }>({});
  const [weightInput, setWeightInput] = useState<{ [tripId: string]: string }>({});
  const [showWeightModalForTrip, setShowWeightModalForTrip] = useState<string | null>(null);
  const [showCompletedArchive, setShowCompletedArchive] = useState(false);
  const [recentlyClaimedIds, setRecentlyClaimedIds] = useState<string[]>([]);
  const [claimToast, setClaimToast] = useState<string | null>(null);

  // Active ongoing trips for this driver
  const myActiveTrips = activeTrips.filter(
    t => (t.driverId === currentDriver.driverId || t.truckPlate === currentDriver.plateNumber) && t.status !== 'delivered'
  );

  // Completed delivered trips for this driver
  const myDeliveredTrips = activeTrips.filter(
    t => (t.driverId === currentDriver.driverId || t.truckPlate === currentDriver.plateNumber) && t.status === 'delivered'
  );

  // Assigned orders waiting to be started (MUST be erased from view as soon as clicked or currently running)
  const myAssignedOrders = orders.filter(o => {
    if (o.status !== 'نشط ومتاح') return false;
    if (o.assignedDriverId !== currentDriver.driverId) return false;
    // Erase if driver clicked it recently
    if (recentlyClaimedIds.includes(o.id)) return false;
    // Erase if this driver is currently hauling an active trip for this order
    const isCurrentlyHauling = activeTrips.some(
      t => t.dailyOrderId === o.id && (t.driverId === currentDriver.driverId || t.truckPlate === currentDriver.plateNumber) && t.status !== 'delivered'
    );
    if (isCurrentlyHauling) return false;
    // Erase if completed all required
    if (o.completedLoads >= o.totalRequiredLoads) return false;
    return true;
  });

  // Open fleet loads available (MUST be erased from view as soon as claimed or if no capacity remains)
  const openAvailableOrders = orders.filter(o => {
    if (o.status !== 'نشط ومتاح') return false;
    // If assigned to a specific other driver, do not show
    if (o.assignedDriverId && o.assignedDriverId !== currentDriver.driverId) return false;
    // Erase if driver clicked it recently
    if (recentlyClaimedIds.includes(o.id)) return false;

    // Remaining loads calculation
    const remainingLoads = o.totalRequiredLoads - o.completedLoads - (o.inProgressLoads || 0);
    if (remainingLoads <= 0) return false;

    // Erase if this driver already has an active trip for this order
    const isAlreadyHauling = activeTrips.some(
      t => t.dailyOrderId === o.id && (t.driverId === currentDriver.driverId || t.truckPlate === currentDriver.plateNumber) && t.status !== 'delivered'
    );
    if (isAlreadyHauling) return false;

    return true;
  });

  // Unread notifications for this driver
  const myNotifications = notifications.filter(
    n => (!n.targetDriverId || n.targetDriverId === currentDriver.driverId) && !n.read
  );

  // Immediate claim handler with instant removal from view
  const handleClaim = (order: DailyOrder) => {
    setRecentlyClaimedIds(prev => [...prev, order.id]);
    setClaimToast(`تم استلام نقلة (${order.material}) بنجاح! تم مسحها من الواجهة وتفعيل التتبع المباشر 🚛`);
    setTimeout(() => {
      setClaimToast(null);
    }, 4500);
    onClaimOrder(order);
  };

  return (
    <div className="space-y-6">
      
      {/* Driver Identity Card & Switcher */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-black text-xl shadow-md">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono font-bold">
                {currentDriver.plateNumber}
              </span>
              <span className="text-xs text-zinc-400">({currentDriver.truckType})</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
              كابينة السائق: {currentDriver.driverName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
              <span className="flex items-center gap-1 text-emerald-400">
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                تتبع GPS والموقع نشط تلقائياً
              </span>
              <span>·</span>
              <span>حمولة {currentDriver.capacityTons} طن</span>
            </div>
          </div>
        </div>

        {/* Change driver account switch */}
        <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-800">
          <span className="text-xs text-zinc-400 whitespace-nowrap">تبديل السائق للتجربة:</span>
          <select
            aria-label="تبديل السائق المعروض"
            value={currentDriver.id}
            onChange={(e) => {
              const trk = allTrucks.find(t => t.id === e.target.value);
              if (trk) onSwitchDriver(trk);
            }}
            className="bg-zinc-900 border border-zinc-700 text-xs rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-amber-500"
          >
            {allTrucks.map(t => (
              <option key={t.id} value={t.id}>
                {t.driverName} - {t.plateNumber}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Claim confirmation toast */}
      {claimToast && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500 rounded-xl text-emerald-200 flex items-center justify-between gap-3 shadow-xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{claimToast}</span>
          </div>
          <button
            onClick={() => setClaimToast(null)}
            className="text-xs text-emerald-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Driver Instant Notification Banner */}
      {myNotifications.length > 0 && (
        <div className="space-y-2">
          {myNotifications.map((notif) => (
            <div
              key={notif.id}
              className="p-3.5 bg-amber-950/40 border border-amber-500/50 rounded-xl text-amber-200 flex items-start justify-between gap-3 shadow-md animate-in slide-in-from-top-2"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-2">
                    <span>{notif.title}</span>
                    <span className="text-[10px] text-amber-400/70 font-mono">
                      {new Date(notif.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-amber-100 mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onMarkNotificationRead(notif.id)}
                className="text-xs font-bold text-amber-400 hover:text-white px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/40 rounded-lg transition shrink-0"
              >
                فهمت ذلك ✓
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Section 1: Active In-Progress Trips for this driver */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Navigation className="w-5 h-5 text-amber-500" />
            <span>نقلتي الجارية حالياً على الطريق</span>
            {myActiveTrips.length > 0 && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono">
                {myActiveTrips.length} جارية
              </span>
            )}
          </h3>

          {myDeliveredTrips.length > 0 && (
            <button
              onClick={() => setShowCompletedArchive(!showCompletedArchive)}
              className="text-xs text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>سجل النقلات المكتملة اليوم ({myDeliveredTrips.length})</span>
              {showCompletedArchive ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {myActiveTrips.length === 0 ? (
          <div className="bg-zinc-900/60 border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-zinc-400">
            <Truck className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
            <p className="font-semibold text-zinc-300">لا توجد نقلة قيد التنفيذ الآن</p>
            <p className="text-xs text-zinc-500 mt-1">
              اختر إحدى الحمولات المعينة لك أو الحمولات العامة المتاحة بالأسفل للبدء. بمجرد الضغط عليها سيتم مسحها من الواجهة وتفعيل التتبع فوراً.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {myActiveTrips.map((trip) => {
              return (
                <div
                  key={trip.id}
                  className="bg-zinc-900 border-2 border-amber-500/60 rounded-2xl p-5 shadow-xl text-zinc-100 space-y-4 animate-in fade-in"
                >
                  {/* Top Bar of Trip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-500 text-zinc-950">
                        {trip.material}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        سيارة: {trip.truckPlate}
                      </span>
                      {trip.ticketNumber && (
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                          بون: {trip.ticketNumber} ({trip.netWeightTons || '45'} طن)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                      <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                      <span>{trip.currentLocation.statusText}</span>
                    </div>
                  </div>

                  {/* Core Required Details Card: Client, Factory, Quarry, Material, Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Quarry (Origin) */}
                    <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1.5">
                      <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                        <Mountain className="w-3.5 h-3.5" />
                        <span>مكان التحميل (المحجر):</span>
                      </div>
                      <div className="text-sm font-bold text-white">
                        {trip.quarryName}
                      </div>
                      <div className="flex items-center gap-2 pt-1 text-xs">
                        <a
                          href={`https://maps.google.com/?q=${trip.quarryCoords.lat},${trip.quarryCoords.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>فتح الموقع على خرائط Google</span>
                        </a>
                      </div>
                    </div>

                    {/* Factory & Client (Destination) */}
                    <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1.5">
                      <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>وجهة التسليم (المصنع والعميل):</span>
                      </div>
                      <div className="text-sm font-bold text-white">
                        {trip.factoryName}
                      </div>
                      <div className="text-xs text-zinc-400">
                        العميل: {trip.clientName}
                      </div>
                      <div className="flex items-center gap-2 pt-1 text-xs">
                        <a
                          href={`https://maps.google.com/?q=${trip.factoryCoords.lat},${trip.factoryCoords.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>فتح موقع المصنع على خرائط Google</span>
                        </a>
                      </div>
                    </div>

                  </div>

                  {/* Highlighted Notes for Driver */}
                  {trip.notes && (
                    <div className="p-3.5 bg-zinc-950/80 border-r-4 border-amber-500 rounded-xl text-xs space-y-1">
                      <div className="font-bold text-amber-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>ملاحظات وتعليمات خاصة بالحمولة:</span>
                      </div>
                      <p className="text-zinc-200 leading-relaxed">{trip.notes}</p>
                    </div>
                  )}

                  {/* Step-by-Step Road Actions */}
                  <div className="pt-2 border-t border-zinc-800 space-y-3">
                    <div className="text-xs font-semibold text-zinc-400">
                      تحديث مرحلة النقلة الحالية (اضغط عند الوصول أو التحميل):
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      
                      {/* Step 1: Arrived at Quarry */}
                      <button
                        onClick={() => onUpdateTripStatus(trip.id, 'at_quarry')}
                        disabled={trip.status === 'at_quarry'}
                        className={`px-3 py-2.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition ${
                          trip.status === 'at_quarry'
                            ? 'bg-amber-500 text-zinc-950 shadow-md ring-2 ring-amber-400'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        }`}
                      >
                        <Mountain className="w-4 h-4" />
                        <span>وصلت المحجر للتحميل</span>
                      </button>

                      {/* Step 2: Loaded & Ticket */}
                      <button
                        onClick={() => setShowWeightModalForTrip(trip.id)}
                        className={`px-3 py-2.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition ${
                          trip.status === 'loaded'
                            ? 'bg-amber-500 text-zinc-950 shadow-md ring-2 ring-amber-400'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        }`}
                      >
                        <Scale className="w-4 h-4" />
                        <span>تم التحميل والوزن</span>
                      </button>

                      {/* Step 3: In Transit to Factory */}
                      <button
                        onClick={() => onUpdateTripStatus(trip.id, 'in_transit')}
                        disabled={trip.status === 'in_transit'}
                        className={`px-3 py-2.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition ${
                          trip.status === 'in_transit'
                            ? 'bg-amber-500 text-zinc-950 shadow-md ring-2 ring-amber-400'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        }`}
                      >
                        <Truck className="w-4 h-4" />
                        <span>في الطريق للمصنع</span>
                      </button>

                      {/* Step 4: Delivered - Clears from active view */}
                      <button
                        onClick={() => onUpdateTripStatus(trip.id, 'delivered')}
                        className="px-3 py-2.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم التفريغ والتسليم</span>
                      </button>

                    </div>
                  </div>

                  {/* Inline Modal for Ticket / Weight Entry */}
                  {showWeightModalForTrip === trip.id && (
                    <div className="p-4 bg-zinc-950 rounded-xl border border-amber-500/40 space-y-3 mt-3 animate-in fade-in">
                      <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                        <span>تسجيل بيانات الميزان والبون</span>
                        <button
                          onClick={() => setShowWeightModalForTrip(null)}
                          className="text-zinc-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">رقم بون الميزان:</label>
                          <input
                            type="text"
                            placeholder="مثال: BON-99410"
                            value={ticketInput[trip.id] || ''}
                            onChange={(e) => setTicketInput({ ...ticketInput, [trip.id]: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">الوزن الصافي (بالطن):</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="مثال: 45.5"
                            value={weightInput[trip.id] || ''}
                            onChange={(e) => setWeightInput({ ...weightInput, [trip.id]: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onUpdateTripStatus(trip.id, 'loaded', {
                            ticketNumber: ticketInput[trip.id] || 'BON-' + Math.floor(Math.random() * 90000 + 10000),
                            netWeightTons: parseFloat(weightInput[trip.id]) || 45
                          });
                          setShowWeightModalForTrip(null);
                        }}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-2 rounded-lg text-xs"
                      >
                        حفظ بيانات التحميل ومواصلة السير للمصنع
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Trips Archive (Collapsible) */}
      {showCompletedArchive && myDeliveredTrips.length > 0 && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-3 animate-in fade-in">
          <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>سجل النقلات التي أتممت تسليمها اليوم ({myDeliveredTrips.length})</span>
          </div>

          <div className="divide-y divide-zinc-800">
            {myDeliveredTrips.map(dt => (
              <div key={dt.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-white">{dt.material}</span>
                  <span className="text-zinc-400 mx-1.5">من {dt.quarryName}</span>
                  <span className="text-emerald-400">إلى {dt.factoryName}</span>
                </div>
                <div className="text-zinc-400 font-mono text-[11px] flex items-center gap-2">
                  <span>بون: {dt.ticketNumber || 'مسجل'}</span>
                  <span>{dt.netWeightTons || '45'} طن</span>
                  <span className="text-emerald-500 font-bold">تم التسليم ✓</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Assigned Orders specifically for this Driver (Waiting to be started) */}
      <div>
        <h3 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-500" />
          <span>حمولات معينة لي شخصياً من الإدارة (بانتظار الانطلاق)</span>
          <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono">
            {myAssignedOrders.length}
          </span>
        </h3>

        {myAssignedOrders.length === 0 ? (
          <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 text-xs text-zinc-400 text-center">
            لا توجد حمولات معينة جديدة بانتظار الانطلاق. تم مسح النقلات الجارية وتحويلها للرادار.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myAssignedOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-zinc-900 border border-zinc-700 hover:border-amber-500/80 rounded-2xl p-5 shadow-lg space-y-3 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-500 text-zinc-950">
                      {ord.material}
                    </span>
                    <span className="text-xs text-zinc-400">
                      أولوية: {ord.priority}
                    </span>
                  </div>
                  <span className="text-xs text-amber-400 font-semibold">
                    معينة لسيارتك {currentDriver.plateNumber}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-300">
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <Mountain className="w-3.5 h-3.5 text-amber-500" />
                    <span>المحجر: {ord.quarryName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <Building2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>المصنع: {ord.factoryName} ({ord.clientName})</span>
                  </div>
                </div>

                {ord.notes && (
                  <div className="p-2.5 bg-zinc-950 rounded-lg text-xs text-zinc-300 border border-zinc-800">
                    <span className="font-bold text-amber-400">ملاحظات: </span>
                    {ord.notes}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <a
                    href={`https://maps.google.com/?q=${ord.quarryCoords.lat},${ord.quarryCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-400 hover:text-amber-400 flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>خريطة المحجر</span>
                  </a>

                  {/* Clicking this button immediately claims and erases the load from this interface */}
                  <button
                    onClick={() => handleClaim(ord)}
                    className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow active:scale-95 transition"
                  >
                    <Truck className="w-4 h-4" />
                    <span>بدء النقلة والانطلاق الآن 🚛</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Open Fleet Loads Available for Grabs */}
      <div>
        <h3 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Truck className="w-5 h-5 text-amber-500" />
          <span>حمولات مفتوحة للأسطول (متاحة للتحميل الفوري)</span>
          <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono">
            {openAvailableOrders.length}
          </span>
        </h3>

        {openAvailableOrders.length === 0 ? (
          <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 text-xs text-zinc-400 text-center">
            لا توجد حمولات عامة متاحة حالياً. جميع الحمولات محجوزة أو قيد التحميل.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openAvailableOrders.map((ord) => {
              const remaining = ord.totalRequiredLoads - ord.completedLoads - (ord.inProgressLoads || 0);
              return (
                <div
                  key={ord.id}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-amber-400">
                      {ord.material}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      متبقي للحجز: {remaining} من {ord.totalRequiredLoads} نقلة
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-zinc-200">
                    <div className="font-bold text-white">المصنع: {ord.factoryName}</div>
                    <div className="text-zinc-400">العميل: {ord.clientName}</div>
                    <div className="text-amber-400">مكان التحميل: {ord.quarryName}</div>
                  </div>

                  {ord.notes && (
                    <div className="p-2 bg-zinc-950 rounded text-[11px] text-zinc-400 line-clamp-2">
                      {ord.notes}
                    </div>
                  )}

                  {/* Clicking this button immediately claims and erases the load from this interface */}
                  <button
                    onClick={() => handleClaim(ord)}
                    className="w-full bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-white font-bold text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <span>احجز هذه النقلة لسيارتك</span>
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
