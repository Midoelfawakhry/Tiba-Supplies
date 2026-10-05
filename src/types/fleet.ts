export type MaterialType =
  | 'سن 1'
  | 'سن 2'
  | 'سن 3'
  | 'سن فيلر'
  | 'سن بودرة'
  | 'رمل أصفر'
  | 'رمل أبيض (زجاجي)'
  | 'رمل مباني'
  | 'دبش مباني'
  | 'دبش تكاسي'
  | 'زلط فينو'
  | 'زلط عادة'
  | 'طفلة أسمنتية'
  | 'جبس خام'
  | 'حجر جيري'
  | string;

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface Quarry {
  id: string;
  name: string;
  region: string;
  location: GeoLocation;
  googleMapsUrl?: string;
  materialsAvailable: string[];
  contactName?: string;
  contactPhone?: string;
  operatingHours?: string;
  gateNotes?: string;
}

export interface ClientFactory {
  id: string;
  name: string; // اسم المصنع
  clientName: string; // اسم العميل / الشركة
  industrialZone: string;
  location: GeoLocation;
  address?: string;
  googleMapsUrl?: string;
  contactName?: string;
  contactPhone?: string;
  unloadingNotes?: string;
}

export interface AppNotification {
  id: string;
  targetDriverId?: string; // إذا كان موجه لسائق محدد أو لجميع السائقين
  title: string;
  message: string;
  type: 'load_assigned' | 'load_updated' | 'alert' | 'delivery_confirmed';
  timestamp: string;
  read: boolean;
  orderId?: string;
}

export interface DailyOrder {
  id: string;
  date: string;
  clientId: string;
  clientName: string; // اسم العميل
  factoryName: string; // اسم المصنع
  quarryId: string;
  quarryName: string; // اسم المحجر
  material: string; // نوع الحمولة
  totalRequiredLoads: number;
  completedLoads: number;
  inProgressLoads: number;
  notes?: string; // أي ملاحظات أخرى
  assignedDriverId?: string; // معرف السائق المعين
  assignedDriverName?: string; // اسم السائق المعين
  assignedTruckPlate?: string; // رقم لوحة السيارة المعينة
  pricePerLoad?: number;
  allowanceAdvance?: number;
  priority: 'عاجل' | 'عادي' | 'أولوية قصوى';
  status: 'نشط ومتاح' | 'مكتمل' | 'موقوف مؤقتاً';
  quarryCoords: GeoLocation;
  factoryCoords: GeoLocation;
  updatedAt?: string;
}

export type TripStatus =
  | 'claimed'          // تم قبول الحمولة وانطلاق السائق للمحجر
  | 'at_quarry'        // وصل المحجر وجاري التحميل
  | 'loaded'           // تم التحميل والوزن
  | 'in_transit'       // في الطريق للمصنع
  | 'delivered'        // تم التفريغ والتسليم
  | 'cancelled';

export interface DriverLiveLocation {
  lat: number;
  lng: number;
  heading?: number;
  speedKmH?: number;
  lastUpdated: string;
  statusText: string;
}

export interface TripLoad {
  id: string;
  dailyOrderId: string;
  clientName: string;
  factoryName: string;
  quarryName: string;
  material: string;
  notes?: string;
  driverId: string;
  driverName: string;
  driverPhone?: string;
  truckPlate: string;
  status: TripStatus;
  ticketNumber?: string;
  netWeightTons?: number;
  startedAt: string;
  claimedAt: string;
  loadedAt?: string;
  deliveredAt?: string;
  driverNotes?: string;
  currentLocation: DriverLiveLocation;
  quarryCoords: GeoLocation;
  factoryCoords: GeoLocation;
  isTrackingActive: boolean;
}

export interface FleetTruck {
  id: string;
  driverId: string;
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  truckType: string;
  capacityTons: number;
  status: 'متاح للتحميل' | 'في مأمورية' | 'في الصيانة' | 'في استراحة';
  currentLocation: DriverLiveLocation;
}
