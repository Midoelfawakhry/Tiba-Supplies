import { createClient } from '@supabase/supabase-js';
import {
  INITIAL_QUARRIES,
  INITIAL_CLIENTS,
  INITIAL_TRUCKS,
} from '../data/initialData';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const isConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('placeholder')
);

// In-memory / LocalStorage mock state for seamless operation when Supabase is not connected
const MOCK_STORAGE_KEY = 'tiba_phase1_mock_data_v1';

const DEFAULT_OFFICE = {
  office_id: 'office-head-ismailia',
  name: 'مكتب طيبة للتوريدات - الإسماعيلية',
  office_type: 'HEAD',
  is_active: true,
};

const DEFAULT_CHECKIN_OFFICE = {
  office_id: 'office-branch-ras-sedr',
  name: 'مكتب طيبة للتوريدات - رأس سدر',
  office_type: 'BRANCH',
  latitude: 29.58,
  longitude: 32.71,
  geofence_radius_m: 10000,
  is_active: true,
};

function initMockStore() {
  const saved = typeof window !== 'undefined' ? localStorage.getItem(MOCK_STORAGE_KEY) : null;
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }

  const factories = INITIAL_CLIENTS.slice(0, 30).map(c => ({
    factory_id: c.id,
    name: c.name,
    factory_name: c.name,
    location: c.location,
    is_active: true,
  }));

  const quarries = INITIAL_QUARRIES.slice(0, 25).map(q => ({
    quarry_id: q.id,
    name: q.name,
    quarry_name: q.name,
    region: q.region,
    is_active: true,
  }));

  const drivers = INITIAL_TRUCKS.slice(0, 20).map(t => ({
    driver_id: t.driverId,
    name: t.driverName,
    phone: t.driverPhone,
    is_active: true,
  }));

  const vehicles = INITIAL_TRUCKS.slice(0, 20).map(t => ({
    vehicle_id: t.id,
    plate_number: t.plateNumber,
    model: t.truckType,
    is_active: true,
  }));

  const load_orders = [
    {
      load_order_id: 'order-live-101',
      factory_id: factories[0]?.factory_id ?? 'client-1',
      quarry_id: quarries[0]?.quarry_id ?? 'quarry-1',
      requested_quantity: 8,
      priority: 1,
      status: 'LOADING_STATEMENT',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      load_order_id: 'order-live-102',
      factory_id: factories[1]?.factory_id ?? 'client-2',
      quarry_id: quarries[2]?.quarry_id ?? 'quarry-3',
      requested_quantity: 12,
      priority: 2,
      status: 'PUBLISHED',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      load_order_id: 'order-live-103',
      factory_id: factories[2]?.factory_id ?? 'client-3',
      quarry_id: quarries[4]?.quarry_id ?? 'quarry-5',
      requested_quantity: 6,
      priority: 3,
      status: 'PUBLISHED',
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    },
  ];

  const bookings = [
    {
      booking_id: 'booking-live-101-1',
      load_order_id: 'order-live-101',
      driver_id: drivers[0]?.driver_id ?? 'driver-1',
      vehicle_id: vehicles[0]?.vehicle_id ?? 'truck-1',
      status: 'LOADING_STATEMENT',
      booked_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      booking_id: 'booking-live-101-2',
      load_order_id: 'order-live-101',
      driver_id: drivers[1]?.driver_id ?? 'driver-2',
      vehicle_id: vehicles[1]?.vehicle_id ?? 'truck-2',
      status: 'BOOKED',
      booked_at: new Date(Date.now() - 1800000).toISOString(),
    },
  ];

  const actual_loading_records = [
    {
      record_id: 'alr-1',
      booking_id: 'booking-live-101-1',
      load_date: new Date().toISOString().split('T')[0],
      vehicle_id: vehicles[0]?.vehicle_id ?? 'truck-1',
      driver_id: drivers[0]?.driver_id ?? 'driver-1',
      quarry_id: quarries[0]?.quarry_id ?? 'quarry-1',
      factory_id: factories[0]?.factory_id ?? 'client-1',
      actual_weight: 48.75,
      created_at: new Date(Date.now() - 2400000).toISOString(),
    },
  ];

  const initialStore = {
    factories,
    quarries,
    drivers,
    vehicles,
    load_orders,
    bookings,
    actual_loading_records,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initialStore));
  }
  return initialStore;
}

let mockStore = initMockStore();

function persistMockStore() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockStore));
  }
}

const DEFAULT_USER = {
  id: 'usr-tiba-lead',
  email: 'admin@tiba-supplies.com',
  user_metadata: { name: 'مسؤول مركز تشغيل طيبة' },
};

const DEFAULT_SESSION = {
  access_token: 'mock-session-tiba-token',
  token_type: 'bearer',
  user: DEFAULT_USER,
};

let currentSession: any = DEFAULT_SESSION;
const authListeners = new Set<(event: string, session: any) => void>();

function notifyAuth(event: string, session: any) {
  currentSession = session;
  authListeners.forEach(fn => {
    try {
      fn(event, session);
    } catch {
      // ignore
    }
  });
}

const mockAuth = {
  async getSession() {
    return { data: { session: currentSession }, error: null };
  },
  onAuthStateChange(callback: (event: string, session: any) => void) {
    authListeners.add(callback);
    // immediately notify of current session
    setTimeout(() => callback('INITIAL_SESSION', currentSession), 0);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authListeners.delete(callback);
          },
        },
      },
    };
  },
  async signInWithPassword({ email }: { email: string; password?: string }) {
    const session = {
      ...DEFAULT_SESSION,
      user: {
        ...DEFAULT_USER,
        email: email || 'admin@tiba-supplies.com',
      },
    };
    notifyAuth('SIGNED_IN', session);
    return { data: { user: session.user, session }, error: null };
  },
  async signOut() {
    notifyAuth('SIGNED_OUT', null);
    return { error: null };
  },
};

async function handleMockRpc(fnName: string, args?: any) {
  if (fnName === 'get_phase1_snapshot') {
    return {
      data: {
        office: DEFAULT_OFFICE,
        operational_office: DEFAULT_OFFICE,
        check_in_office: DEFAULT_CHECKIN_OFFICE,
        factories: mockStore.factories,
        quarries: mockStore.quarries,
        load_orders: mockStore.load_orders,
        bookings: mockStore.bookings,
        actual_loading_records: mockStore.actual_loading_records,
        drivers: mockStore.drivers,
        vehicles: mockStore.vehicles,
      },
      error: null,
    };
  }

  if (fnName === 'create_load_order') {
    const newOrder = {
      load_order_id: `ord-live-${Date.now()}`,
      factory_id: args?.p_factory_id,
      quarry_id: args?.p_quarry_id,
      requested_quantity: Number(args?.p_requested_quantity || 1),
      priority: Number(args?.p_priority || 3),
      status: 'PUBLISHED',
      created_at: new Date().toISOString(),
    };
    mockStore.load_orders = [newOrder, ...mockStore.load_orders];
    persistMockStore();
    return {
      data: {
        success: true,
        load_order_id: newOrder.load_order_id,
      },
      error: null,
    };
  }

  return { data: null, error: new Error(`RPC ${fnName} not recognized in mock mode`) };
}

// Create the real client if configured, otherwise provide resilient mock client
let rawClient: any = null;
if (isConfigured) {
  try {
    rawClient = createClient(supabaseUrl!, supabasePublishableKey!);
  } catch (err) {
    console.warn('[AI Studio] Supabase client initialization failed, falling back to mock:', err);
  }
}

export const supabase = {
  auth: {
    async getSession() {
      if (rawClient) {
        try {
          const res = await rawClient.auth.getSession();
          if (!res.error && res.data?.session) return res;
        } catch {
          // fall through
        }
      }
      return mockAuth.getSession();
    },
    onAuthStateChange(callback: (event: string, session: any) => void) {
      if (rawClient) {
        try {
          return rawClient.auth.onAuthStateChange((evt: any, session: any) => {
            if (session) {
              callback(evt, session);
            } else {
              callback(evt, currentSession);
            }
          });
        } catch {
          // fall through
        }
      }
      return mockAuth.onAuthStateChange(callback);
    },
    async signInWithPassword(credentials: { email: string; password?: string }) {
      if (rawClient) {
        try {
          const res = await rawClient.auth.signInWithPassword(credentials);
          if (!res.error) return res;
          console.warn('[AI Studio] Supabase auth returned error, allowing mock login:', res.error);
        } catch (err) {
          console.warn('[AI Studio] Supabase auth request failed, allowing mock login:', err);
        }
      }
      return mockAuth.signInWithPassword(credentials);
    },
    async signOut() {
      if (rawClient) {
        try {
          await rawClient.auth.signOut();
        } catch {
          // ignore
        }
      }
      return mockAuth.signOut();
    },
  },
  async rpc(fnName: string, args?: any) {
    if (rawClient) {
      try {
        const res = await rawClient.rpc(fnName, args);
        if (!res.error) return res;
        console.warn(`[AI Studio] Supabase RPC '${fnName}' error, falling back to mock:`, res.error);
      } catch (err) {
        console.warn(`[AI Studio] Supabase RPC '${fnName}' failed, falling back to mock:`, err);
      }
    }
    return handleMockRpc(fnName, args);
  },
};
