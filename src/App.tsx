import React, { useState, useEffect, useCallback } from 'react';
import { StorageService } from './services/storage';
import { DailyOrder, FleetTruck, TripLoad, Quarry, ClientFactory, AppNotification, TripStatus } from './types/fleet';
import { Header } from './components/Header';
import { AdminDashboard } from './components/AdminDashboard';
import { DriverPortal } from './components/DriverPortal';
import { LiveTrackingMap } from './components/LiveTrackingMap';
import { QuarriesClientsDirectory } from './components/QuarriesClientsDirectory';
import { NewLoadModal } from './components/NewLoadModal';

// Audio tone notification helper using Web Audio API
const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {
    // Ignore audio autoplay restrictions
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'admin' | 'driver' | 'map' | 'directory'>('admin');
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [quarries, setQuarries] = useState<Quarry[]>([]);
  const [clients, setClients] = useState<ClientFactory[]>([]);
  const [trucks, setTrucks] = useState<FleetTruck[]>([]);
  const [trips, setTrips] = useState<TripLoad[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<FleetTruck | null>(null);
  const [isNewLoadModalOpen, setIsNewLoadModalOpen] = useState(false);

  // Initial load
  useEffect(() => {
    const loadedQuarries = StorageService.getQuarries();
    const loadedClients = StorageService.getClients();
    const loadedTrucks = StorageService.getTrucks();
    const loadedOrders = StorageService.getOrders();
    const loadedTrips = StorageService.getTrips();
    const loadedNotifs = StorageService.getNotifications();

    setQuarries(loadedQuarries);
    setClients(loadedClients);
    setTrucks(loadedTrucks);
    setOrders(loadedOrders);
    setTrips(loadedTrips);
    setNotifications(loadedNotifs);

    if (loadedTrucks.length > 0) {
      setSelectedDriver(loadedTrucks[0]);
    }
  }, []);

  // Handle adding a new load order from Admin
  const handleCreateOrder = (orderData: {
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
  }) => {
    const created = StorageService.createOrder({
      date: new Date().toISOString().split('T')[0],
      clientId: `c-${Date.now()}`,
      clientName: orderData.clientName,
      factoryName: orderData.factoryName,
      quarryId: `q-${Date.now()}`,
      quarryName: orderData.quarryName,
      material: orderData.material,
      totalRequiredLoads: orderData.totalRequiredLoads,
      notes: orderData.notes,
      assignedDriverId: orderData.assignedDriverId,
      assignedDriverName: orderData.assignedDriverName,
      assignedTruckPlate: orderData.assignedTruckPlate,
      priority: orderData.priority,
      status: 'نشط ومتاح',
      quarryCoords: orderData.quarryCoords,
      factoryCoords: orderData.factoryCoords
    });

    setOrders(StorageService.getOrders());
    setTrips(StorageService.getTrips());
    setTrucks(StorageService.getTrucks());
    setNotifications(StorageService.getNotifications());
    playNotificationSound();
  };

  // Driver claims an open load
  const handleDriverClaimOrder = (order: DailyOrder) => {
    if (!selectedDriver) return;

    StorageService.createTripFromOrder(
      order,
      selectedDriver.driverId,
      selectedDriver.driverName,
      selectedDriver.plateNumber
    );

    // Update order with in progress load
    const updatedOrders = StorageService.getOrders().map(o => {
      if (o.id === order.id) {
        return { ...o, inProgressLoads: o.inProgressLoads + 1 };
      }
      return o;
    });
    StorageService.saveOrders(updatedOrders);

    StorageService.addNotification({
      targetDriverId: selectedDriver.driverId,
      title: 'بدء نقلة جديدة 🚛',
      message: `تم بدء نقلة (${order.material}) من [${order.quarryName}] إلى [${order.factoryName}]. تم تفعيل التتبع المباشر.`,
      type: 'load_assigned',
      orderId: order.id
    });

    setOrders(updatedOrders);
    setTrips(StorageService.getTrips());
    setTrucks(StorageService.getTrucks());
    setNotifications(StorageService.getNotifications());
    playNotificationSound();
  };

  // Driver advances trip status
  const handleUpdateTripStatus = (
    tripId: string,
    status: TripStatus,
    extra?: { ticketNumber?: string; netWeightTons?: number; driverNotes?: string }
  ) => {
    StorageService.updateTripStatus(tripId, status, extra);
    setTrips(StorageService.getTrips());
    setOrders(StorageService.getOrders());
    setTrucks(StorageService.getTrucks());
    setNotifications(StorageService.getNotifications());
    playNotificationSound();
  };

  // Admin assigns driver to existing order
  const handleAssignDriver = (orderId: string, truckId: string) => {
    const truck = trucks.find(t => t.id === truckId);
    if (!truck) {
      StorageService.updateOrder(orderId, {
        assignedDriverId: undefined,
        assignedDriverName: undefined,
        assignedTruckPlate: undefined
      });
    } else {
      StorageService.updateOrder(orderId, {
        assignedDriverId: truck.driverId,
        assignedDriverName: truck.driverName,
        assignedTruckPlate: truck.plateNumber
      });
    }

    setOrders(StorageService.getOrders());
    setNotifications(StorageService.getNotifications());
    playNotificationSound();
  };

  // Admin updates notes on existing order
  const handleUpdateOrderNotes = (orderId: string, notes: string) => {
    StorageService.updateOrder(orderId, { notes });
    setOrders(StorageService.getOrders());
    setNotifications(StorageService.getNotifications());
    playNotificationSound();
  };

  // Admin deletes an order
  const handleDeleteOrder = (orderId: string) => {
    StorageService.deleteOrder(orderId);
    setOrders(StorageService.getOrders());
    setTrips(StorageService.getTrips());
  };

  // Mark notification read
  const handleMarkNotificationRead = (id: string) => {
    StorageService.markNotificationAsRead(id);
    setNotifications(StorageService.getNotifications());
  };

  // Reset to initial demo data
  const handleResetData = () => {
    const res = StorageService.resetToDefault();
    setQuarries(res.quarries);
    setClients(res.clients);
    setTrucks(res.trucks);
    setOrders(res.orders);
    setTrips(res.trips);
    setNotifications(res.notifications);
    if (res.trucks.length > 0) {
      setSelectedDriver(res.trucks[0]);
    }
  };

  // Real-time GPS movement simulation
  const handleSimulateTick = useCallback(() => {
    const allTrips = StorageService.getTrips();
    let changed = false;

    const updated = allTrips.map(trip => {
      if (trip.status === 'delivered' || !trip.isTrackingActive) return trip;

      let { lat, lng } = trip.currentLocation;
      const target = trip.status === 'claimed'
        ? trip.quarryCoords
        : trip.factoryCoords;

      // Small step towards target
      const dLat = (target.lat - lat) * 0.08;
      const dLng = (target.lng - lng) * 0.08;

      if (Math.abs(dLat) > 0.0001 || Math.abs(dLng) > 0.0001) {
        lat += dLat;
        lng += dLng;
        changed = true;
      }

      return {
        ...trip,
        currentLocation: {
          ...trip.currentLocation,
          lat,
          lng,
          speedKmH: trip.status === 'at_quarry' ? 0 : 58 + Math.floor(Math.random() * 12),
          lastUpdated: new Date().toISOString()
        }
      };
    });

    if (changed) {
      StorageService.saveTrips(updated);
      setTrips(updated);
    }
  }, []);

  // Add Quarry
  const handleAddQuarry = (qData: Omit<Quarry, 'id'>) => {
    const list = StorageService.getQuarries();
    const newQ: Quarry = { ...qData, id: `quarry-${Date.now()}` };
    list.unshift(newQ);
    StorageService.saveQuarries(list);
    setQuarries(list);
  };

  // Add Client
  const handleAddClient = (cData: Omit<ClientFactory, 'id'>) => {
    const list = StorageService.getClients();
    const newC: ClientFactory = { ...cData, id: `client-${Date.now()}` };
    list.unshift(newC);
    StorageService.saveClients(list);
    setClients(list);
  };

  // Delete Quarry
  const handleDeleteQuarry = (id: string) => {
    const list = StorageService.getQuarries().filter(q => q.id !== id);
    StorageService.saveQuarries(list);
    setQuarries(list);
  };

  // Delete Client
  const handleDeleteClient = (id: string) => {
    const list = StorageService.getClients().filter(c => c.id !== id);
    StorageService.saveClients(list);
    setClients(list);
  };

  // Bulk Import text parser
  const handleBulkImport = (rawText: string, type: 'quarry' | 'client') => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    if (type === 'quarry') {
      const currentList = StorageService.getQuarries();
      lines.forEach((line, idx) => {
        const parts = line.split('-').map(p => p.trim());
        const name = parts[0] || `محجر جديد ${idx + 1}`;
        const region = parts[1] || 'السويس / طريق السخنة';
        const materials = parts[2] ? parts[2].split('،') : ['سن 1', 'سن 2'];
        currentList.push({
          id: `q-bulk-${Date.now()}-${idx}`,
          name,
          region,
          location: { lat: 29.8 + (Math.random() - 0.5) * 0.3, lng: 32.3 + (Math.random() - 0.5) * 0.3 },
          materialsAvailable: materials
        });
      });
      StorageService.saveQuarries(currentList);
      setQuarries([...currentList]);
    } else {
      const currentList = StorageService.getClients();
      lines.forEach((line, idx) => {
        const parts = line.split('-').map(p => p.trim());
        const name = parts[0] || `مصنع جديد ${idx + 1}`;
        const zone = parts[1] || 'المنطقة الصناعية';
        currentList.push({
          id: `c-bulk-${Date.now()}-${idx}`,
          name,
          clientName: name,
          industrialZone: zone,
          location: { lat: 29.9 + (Math.random() - 0.5) * 0.3, lng: 32.4 + (Math.random() - 0.5) * 0.3 }
        });
      });
      StorageService.saveClients(currentList);
      setClients([...currentList]);
    }
  };

  const activeDriver = selectedDriver || trucks[0] || {
    id: 'default',
    driverId: 'default',
    plateNumber: '---',
    driverName: 'السائق',
    driverPhone: '',
    truckType: 'تريلا',
    capacityTons: 45,
    status: 'متاح للتحميل' as const,
    currentLocation: { lat: 29.8, lng: 32.4, lastUpdated: '', statusText: '' }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500 selection:text-zinc-950">
      
      {/* 3-Zone Clean Header Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notifications={notifications}
        selectedDriver={activeDriver}
        onSelectDriver={(t) => setSelectedDriver(t)}
        trucks={trucks}
        onMarkNotificationRead={handleMarkNotificationRead}
        onResetData={handleResetData}
        onOpenNewLoadModal={() => setIsNewLoadModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        
        {activeTab === 'admin' && (
          <AdminDashboard
            orders={orders}
            trucks={trucks}
            trips={trips}
            quarries={quarries}
            clients={clients}
            onOpenNewLoadModal={() => setIsNewLoadModalOpen(true)}
            onAssignDriver={handleAssignDriver}
            onUpdateOrderNotes={handleUpdateOrderNotes}
            onDeleteOrder={handleDeleteOrder}
            onSendDriverAlert={(dId, title, msg) => {
              StorageService.addNotification({
                targetDriverId: dId,
                title,
                message: msg,
                type: 'alert'
              });
              setNotifications(StorageService.getNotifications());
              playNotificationSound();
            }}
          />
        )}

        {activeTab === 'driver' && (
          <DriverPortal
            currentDriver={activeDriver}
            allTrucks={trucks}
            onSwitchDriver={(t) => setSelectedDriver(t)}
            orders={orders}
            activeTrips={trips}
            notifications={notifications}
            onClaimOrder={handleDriverClaimOrder}
            onUpdateTripStatus={handleUpdateTripStatus}
            onMarkNotificationRead={handleMarkNotificationRead}
          />
        )}

        {activeTab === 'map' && (
          <LiveTrackingMap
            quarries={quarries}
            clients={clients}
            trucks={trucks}
            trips={trips}
            onSimulateTick={handleSimulateTick}
          />
        )}

        {activeTab === 'directory' && (
          <QuarriesClientsDirectory
            quarries={quarries}
            clients={clients}
            onAddQuarry={handleAddQuarry}
            onAddClient={handleAddClient}
            onDeleteQuarry={handleDeleteQuarry}
            onDeleteClient={handleDeleteClient}
            onBulkImport={handleBulkImport}
          />
        )}

      </main>

      {/* New Load Entry Modal */}
      <NewLoadModal
        isOpen={isNewLoadModalOpen}
        onClose={() => setIsNewLoadModalOpen(false)}
        quarries={quarries}
        clients={clients}
        trucks={trucks}
        onSubmit={handleCreateOrder}
      />

      {/* Clean quiet footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 text-center text-xs text-zinc-600">
        منظومة Tiba Supplies لتشغيل وتتبع أسطول النقل الثقيل والمحاجر © {new Date().getFullYear()}
      </footer>

    </div>
  );
}
