import React, { useState } from 'react';
import { Truck, Bell, MapPin, ClipboardList, CheckCircle2, AlertTriangle, Shield, UserCheck } from 'lucide-react';
import { AppNotification, FleetTruck } from '../types/fleet';

interface HeaderProps {
  activeTab: 'admin' | 'driver' | 'map' | 'directory';
  setActiveTab: (tab: 'admin' | 'driver' | 'map' | 'directory') => void;
  notifications: AppNotification[];
  selectedDriver: FleetTruck;
  onSelectDriver: (truck: FleetTruck) => void;
  trucks: FleetTruck[];
  onMarkNotificationRead: (id: string) => void;
  onResetData: () => void;
  onOpenNewLoadModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  notifications,
  selectedDriver,
  onSelectDriver,
  trucks,
  onMarkNotificationRead,
  onResetData,
  onOpenNewLoadModal
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  // Filter unread notifications for active context
  const unreadCount = notifications.filter(n => !n.read && (!n.targetDriverId || n.targetDriverId === selectedDriver.driverId)).length;

  return (
    <header className="sticky top-0 z-50 bg-zinc-900 border-b border-zinc-800 text-zinc-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        
        {/* Zone 1: Single text element brand title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500 text-zinc-950 flex items-center justify-center font-black text-xl shadow-lg">
            <Truck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Tiba Supplies</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                طيبة للتوريدات
              </span>
            </h1>
            <p className="text-xs text-zinc-400 hidden sm:block">إدارة وتتبع نقلات المحاجر والمصانع لحظة بلحظة</p>
          </div>
        </div>

        {/* Zone 2: Navigation views */}
        <nav className="flex items-center gap-1 sm:gap-2 bg-zinc-950/70 p-1 rounded-xl border border-zinc-800 text-xs sm:text-sm font-medium">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'admin'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>لوحة الإدارة</span>
          </button>

          <button
            onClick={() => setActiveTab('driver')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'driver'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>كابينة السائق</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'map'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span className="hidden md:inline">خريطة التتبع المباشر</span>
            <span className="md:hidden">الخريطة</span>
          </button>

          <button
            onClick={() => setActiveTab('directory')}
            className={`hidden lg:flex px-3 py-2 rounded-lg transition-colors items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'directory'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <span>المحاجر والعملاء</span>
          </button>
        </nav>

        {/* Zone 3: Actions & Notifications */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Driver identity switch (visible when in driver mode or fast testing) */}
          <div className="relative hidden sm:block">
            <select
              aria-label="تحديد السائق الحالي"
              value={selectedDriver.id}
              onChange={(e) => {
                const found = trucks.find(t => t.id === e.target.value);
                if (found) onSelectDriver(found);
              }}
              className="bg-zinc-800 border border-zinc-700 text-xs rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              {trucks.map(t => (
                <option key={t.id} value={t.id}>
                  👤 السائق: {t.driverName} ({t.plateNumber})
                </option>
              ))}
            </select>
          </div>

          {/* New Load Button for Admin */}
          <button
            onClick={onOpenNewLoadModal}
            className="hidden sm:flex bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-lg items-center gap-1.5 shadow transition-all active:scale-95 whitespace-nowrap"
          >
            <span>+ حمولة جديدة</span>
          </button>

          {/* Notifications button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="relative p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
              title="الإشعارات والتنبيهات"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-zinc-900 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifMenu && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-amber-500" />
                    تنبيهات وإشعارات السائقين
                  </span>
                  <span className="text-xs text-zinc-400">
                    {unreadCount} غير مقروء
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800 mt-2 space-y-1">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      لا توجد إشعارات حالياً
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => onMarkNotificationRead(n.id)}
                        className={`p-2.5 rounded-lg cursor-pointer transition-colors text-right ${
                          n.read ? 'bg-zinc-900/50 hover:bg-zinc-800/40 text-zinc-400' : 'bg-zinc-800/90 hover:bg-zinc-800 text-zinc-200 border-r-4 border-amber-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white flex items-center gap-1">
                            {n.type === 'load_assigned' && <Truck className="w-3.5 h-3.5 text-amber-400" />}
                            {n.type === 'load_updated' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                            {n.type === 'delivery_confirmed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                            {n.title}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {new Date(n.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-xs">
                  <button
                    onClick={onResetData}
                    className="text-zinc-400 hover:text-zinc-200 hover:underline"
                  >
                    استعادة البيانات التجريبية
                  </button>
                  <button
                    onClick={() => setShowNotifMenu(false)}
                    className="text-amber-500 hover:underline font-semibold"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
};
