import {
  Quarry,
  ClientFactory,
  DailyOrder,
  FleetTruck,
  TripLoad,
  AppNotification,
  TripStatus,
  DestinationChange,
  GeoLocation
} from '../types/fleet';
import {
  INITIAL_QUARRIES,
  INITIAL_CLIENTS,
  INITIAL_TRUCKS,
  INITIAL_ORDERS,
  INITIAL_ACTIVE_TRIPS,
  INITIAL_NOTIFICATIONS
} from '../data/initialData';

const STORAGE_KEYS = {
  QUARRIES: 'tiba_quarries_v3',
  CLIENTS: 'tiba_clients_v3',
  TRUCKS: 'tiba_trucks_v3',
  ORDERS: 'tiba_orders_v3',
  TRIPS: 'tiba_trips_v3',
  NOTIFICATIONS: 'tiba_notifications_v3'
};

export const StorageService = {
  getQuarries(): Quarry[] {
    const data = localStorage.getItem(STORAGE_KEYS.QUARRIES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.QUARRIES, JSON.stringify(INITIAL_QUARRIES));
      return INITIAL_QUARRIES;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_QUARRIES;
    }
  },

  saveQuarries(quarries: Quarry[]) {
    localStorage.setItem(STORAGE_KEYS.QUARRIES, JSON.stringify(quarries));
  },

  getClients(): ClientFactory[] {
    const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(INITIAL_CLIENTS));
      return INITIAL_CLIENTS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_CLIENTS;
    }
  },

  saveClients(clients: ClientFactory[]) {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  },

  getTrucks(): FleetTruck[] {
    const data = localStorage.getItem(STORAGE_KEYS.TRUCKS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(INITIAL_TRUCKS));
      return INITIAL_TRUCKS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_TRUCKS;
    }
  },

  saveTrucks(trucks: FleetTruck[]) {
    localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(trucks));
  },

  getOrders(): DailyOrder[] {
    const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_ORDERS;
    }
  },

  saveOrders(orders: DailyOrder[]) {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  },

  getTrips(): TripLoad[] {
    const data = localStorage.getItem(STORAGE_KEYS.TRIPS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(INITIAL_ACTIVE_TRIPS));
      return INITIAL_ACTIVE_TRIPS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_ACTIVE_TRIPS;
    }
  },

  saveTrips(trips: TripLoad[]) {
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));
  },

  getNotifications(): AppNotification[] {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  },

  saveNotifications(notifs: AppNotification[]) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
  },

  addNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) {
    const list = this.getNotifications();
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      read: false
    };
    list.unshift(newNotif);
    this.saveNotifications(list);
    return newNotif;
  },

  markNotificationAsRead(id: string) {
    const list = this.getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
    this.saveNotifications(list);
  },

  markAllNotificationsAsRead(driverId?: string) {
    const list = this.getNotifications().map(n => {
      if (!driverId || n.targetDriverId === driverId || !n.targetDriverId) {
        return { ...n, read: true };
      }
      return n;
    });
    this.saveNotifications(list);
  },

  // Add new daily order & trigger driver notification if driver assigned
  createOrder(orderData: Omit<DailyOrder, 'id' | 'completedLoads' | 'inProgressLoads' | 'updatedAt'>): DailyOrder {
    const orders = this.getOrders();
    const newOrder: DailyOrder = {
      ...orderData,
      id: `order-${Date.now()}`,
      completedLoads: 0,
      inProgressLoads: 0,
      updatedAt: new Date().toISOString()
    };
    orders.unshift(newOrder);
    this.saveOrders(orders);

    // If a driver was assigned immediately upon creation:
    if (newOrder.assignedDriverId) {
      this.addNotification({
        targetDriverId: newOrder.assignedDriverId,
        title: 'حمولة جديدة مخصصة لك 🚛',
        message: `تم تكليفك بحمولة (${newOrder.material}) من [${newOrder.quarryName}] إلى [${newOrder.factoryName} - ${newOrder.clientName}]. ملاحظات: ${newOrder.notes || 'لا توجد ملاحظات'}. اضغط عليها لبدء السير.`,
        type: 'load_assigned',
        orderId: newOrder.id
      });
    }

    return newOrder;
  },

  updateOrder(orderId: string, updates: Partial<DailyOrder>): DailyOrder | null {
    const orders = this.getOrders();
    const index = orders.findIndex(o => o.id === orderId);
    if (index === -1) return null;

    const oldOrder = orders[index];
    const updatedOrder: DailyOrder = {
      ...oldOrder,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    orders[index] = updatedOrder;
    this.saveOrders(orders);

    // Check if critical details changed (factory, quarry, material, notes, or time)
    const driverId = updatedOrder.assignedDriverId;
    if (driverId) {
      let changeSummary = [];
      if (updates.factoryName && updates.factoryName !== oldOrder.factoryName) {
        changeSummary.push(`تغيير وجهة المصنع إلى: ${updates.factoryName}`);
      }
      if (updates.quarryName && updates.quarryName !== oldOrder.quarryName) {
        changeSummary.push(`تغيير المحجر إلى: ${updates.quarryName}`);
      }
      if (updates.material && updates.material !== oldOrder.material) {
        changeSummary.push(`تغيير نوع الحمولة إلى: ${updates.material}`);
      }
      if (updates.notes && updates.notes !== oldOrder.notes) {
        changeSummary.push(`تحديث الملاحظات: ${updates.notes}`);
      }

      if (changeSummary.length > 0) {
        this.addNotification({
          targetDriverId: driverId,
          title: '⚠️ تحديث هام على حمولتك',
          message: `تنبيه لسائق الحمولة: ${changeSummary.join(' | ')}. يرجى مراجعة تفاصيل النقلة.`,
          type: 'load_updated',
          orderId: updatedOrder.id
        });
      }
    }

    return updatedOrder;
  },

  deleteOrder(orderId: string) {
    const orders = this.getOrders().filter(o => o.id !== orderId);
    this.saveOrders(orders);
    // Also remove or cancel associated active trips
    const trips = this.getTrips().filter(t => t.dailyOrderId !== orderId);
    this.saveTrips(trips);
  },

  createTripFromOrder(order: DailyOrder, driverId: string, driverName: string, truckPlate: string): TripLoad {
    const trips = this.getTrips();
    // Default position is at the quarry or driver starting area
    const startLoc = {
      lat: order.quarryCoords.lat + (Math.random() - 0.5) * 0.005,
      lng: order.quarryCoords.lng + (Math.random() - 0.5) * 0.005,
      heading: 0,
      speedKmH: 45,
      lastUpdated: new Date().toISOString(),
      statusText: `انطلق إلى ${order.quarryName}`
    };

    const newTrip: TripLoad = {
      id: `trip-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dailyOrderId: order.id,
      clientName: order.clientName,
      factoryName: order.factoryName,
      quarryName: order.quarryName,
      material: order.material,
      notes: order.notes,
      driverId,
      driverName,
      truckPlate,
      status: 'claimed',
      startedAt: new Date().toISOString(),
      claimedAt: new Date().toISOString(),
      currentLocation: startLoc,
      quarryCoords: order.quarryCoords,
      factoryCoords: order.factoryCoords,
      isTrackingActive: true
    };

    trips.unshift(newTrip);
    this.saveTrips(trips);

    // Update order inProgressLoads count
    const orders = this.getOrders();
    const ordIndex = orders.findIndex(o => o.id === order.id);
    if (ordIndex !== -1) {
      orders[ordIndex].inProgressLoads = (orders[ordIndex].inProgressLoads || 0) + 1;
      this.saveOrders(orders);
    }

    // Update truck status
    const trucks = this.getTrucks();
    const truckIndex = trucks.findIndex(t => t.driverId === driverId || t.plateNumber === truckPlate);
    if (truckIndex !== -1) {
      trucks[truckIndex].status = 'في مأمورية';
      trucks[truckIndex].currentLocation = startLoc;
      this.saveTrucks(trucks);
    }

    return newTrip;
  },

  updateTripStatus(
    tripId: string,
    newStatus: TripStatus,
    extra?: { ticketNumber?: string; netWeightTons?: number; driverNotes?: string }
  ) {
    const trips = this.getTrips();
    const index = trips.findIndex(t => t.id === tripId);
    if (index === -1) return null;

    const trip = trips[index];
    trip.status = newStatus;
    if (extra?.ticketNumber) trip.ticketNumber = extra.ticketNumber;
    if (extra?.netWeightTons) trip.netWeightTons = extra.netWeightTons;
    if (extra?.driverNotes) trip.driverNotes = extra.driverNotes;

    const now = new Date().toISOString();
    if (newStatus === 'loaded') {
      trip.loadedAt = now;
      trip.currentLocation.lat = trip.quarryCoords.lat;
      trip.currentLocation.lng = trip.quarryCoords.lng;
      trip.currentLocation.statusText = `تم التحميل بمحجر ${trip.quarryName}، في طريق للمصنع`;
      trip.currentLocation.speedKmH = 55;
    } else if (newStatus === 'delivered') {
      trip.deliveredAt = now;
      trip.currentLocation.lat = trip.factoryCoords.lat;
      trip.currentLocation.lng = trip.factoryCoords.lng;
      trip.currentLocation.statusText = `تم التفريغ في ${trip.factoryName} بنجاح`;
      trip.currentLocation.speedKmH = 0;
      trip.isTrackingActive = false;

      // Update order completed loads count
      const orders = this.getOrders();
      const ordIdx = orders.findIndex(o => o.id === trip.dailyOrderId);
      if (ordIdx !== -1) {
        orders[ordIdx].completedLoads += 1;
        orders[ordIdx].inProgressLoads = Math.max(0, orders[ordIdx].inProgressLoads - 1);
        if (orders[ordIdx].completedLoads >= orders[ordIdx].totalRequiredLoads) {
          orders[ordIdx].status = 'مكتمل';
        }
        this.saveOrders(orders);
      }

      // Free truck
      const trucks = this.getTrucks();
      const trkIdx = trucks.findIndex(t => t.driverId === trip.driverId || t.plateNumber === trip.truckPlate);
      if (trkIdx !== -1) {
        trucks[trkIdx].status = 'متاح للتحميل';
        trucks[trkIdx].currentLocation = trip.currentLocation;
        this.saveTrucks(trucks);
      }

      // Add completion notification
      this.addNotification({
        title: '✅ تم إتمام وتسليم الحمولة',
        message: `أتم السائق ${trip.driverName} تسليم حمولة (${trip.material}) لمصنع ${trip.factoryName} (بون رقم: ${trip.ticketNumber || 'بدون'}).`,
        type: 'delivery_confirmed',
        orderId: trip.dailyOrderId
      });
    } else if (newStatus === 'at_quarry') {
      trip.currentLocation.lat = trip.quarryCoords.lat;
      trip.currentLocation.lng = trip.quarryCoords.lng;
      trip.currentLocation.speedKmH = 0;
      trip.currentLocation.statusText = `وصل محجر ${trip.quarryName} - جاري التحميل`;
    } else if (newStatus === 'in_transit') {
      // Midpoint towards factory
      trip.currentLocation.lat = (trip.quarryCoords.lat + trip.factoryCoords.lat) / 2;
      trip.currentLocation.lng = (trip.quarryCoords.lng + trip.factoryCoords.lng) / 2;
      trip.currentLocation.speedKmH = 65;
      trip.currentLocation.statusText = `على الطريق السريع متوجهاً لمصنع ${trip.factoryName}`;
    }

    trip.currentLocation.lastUpdated = now;
    trips[index] = trip;
    this.saveTrips(trips);
    return trip;
  },

  changeTripDestination(
    tripId: string,
    toFactoryName: string,
    toFactoryCoords: GeoLocation,
    reason: DestinationChange['reason'],
    notes?: string,
    changedBy?: string
  ): TripLoad | null {
    const trips = this.getTrips();
    const index = trips.findIndex(t => t.id === tripId);
    if (index === -1) return null;

    const trip = trips[index];
    if (trip.status === 'delivered' || trip.status === 'cancelled') return null;

    const now = new Date().toISOString();
    const fromFactoryName = trip.factoryName;
    const fromFactoryCoords = trip.factoryCoords;

    if (!trip.originalFactoryName) {
      trip.originalFactoryName = fromFactoryName;
      trip.originalFactoryCoords = fromFactoryCoords;
    }

    const change: DestinationChange = {
      id: `destination-change-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fromFactoryName,
      fromFactoryCoords,
      toFactoryName,
      toFactoryCoords,
      reason,
      notes,
      changedAt: now,
      changedBy
    };

    trip.destinationChanges = [...(trip.destinationChanges || []), change];
    trip.factoryName = toFactoryName;
    trip.factoryCoords = toFactoryCoords;
    trip.currentLocation.statusText = `تم تحويل الوجهة إلى ${toFactoryName}`;
    trip.currentLocation.lastUpdated = now;

    trips[index] = trip;
    this.saveTrips(trips);
    return trip;
  },

  updateDriverCoordinates(driverId: string, lat: number, lng: number, speedKmH: number = 50) {
    const trips = this.getTrips();
    let updated = false;
    for (const trip of trips) {
      if (trip.driverId === driverId && trip.isTrackingActive && trip.status !== 'delivered') {
        trip.currentLocation = {
          lat,
          lng,
          speedKmH,
          lastUpdated: new Date().toISOString(),
          statusText: `تتبع مباشر (سرعة ${speedKmH} كم/س)`
        };
        updated = true;
      }
    }
    if (updated) {
      this.saveTrips(trips);
    }
  },

  resetToDefault() {
    localStorage.removeItem(STORAGE_KEYS.QUARRIES);
    localStorage.removeItem(STORAGE_KEYS.CLIENTS);
    localStorage.removeItem(STORAGE_KEYS.TRUCKS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.TRIPS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    return {
      quarries: this.getQuarries(),
      clients: this.getClients(),
      trucks: this.getTrucks(),
      orders: this.getOrders(),
      trips: this.getTrips(),
      notifications: this.getNotifications()
    };
  }
};
