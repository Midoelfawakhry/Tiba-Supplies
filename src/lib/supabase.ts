import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const configurationError = (() => {
  if (!supabaseUrl || !supabasePublishableKey) {
    return 'إعدادات الاتصال ناقصة. راجع VITE_SUPABASE_URL وVITE_SUPABASE_PUBLISHABLE_KEY في إعدادات بيئة AI Studio، ثم أعد تشغيل Preview.';
  }
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      return 'رابط Supabase غير صالح. استخدم Project URL من إعدادات مشروع Supabase.';
    }
  } catch {
    return 'رابط Supabase غير صالح. استخدم Project URL من إعدادات مشروع Supabase.';
  }
  if (/YOUR_|placeholder/i.test(supabasePublishableKey)) {
    return 'مفتاح Supabase ما زال قيمة مؤقتة. أدخل publishable/anon key الحقيقي من إعدادات المشروع.';
  }
  return '';
})();

let client: SupabaseClient | null = null;
if (!configurationError) {
  client = createClient(supabaseUrl!, supabasePublishableKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

function getClient(): SupabaseClient {
  if (configurationError || !client) {
    throw new Error(configurationError || 'تعذر تهيئة اتصال Supabase.');
  }
  return client;
}

// Error-only handling when configuration is missing. No mock sessions, local data,
// LocalStorage persistence, or local RPC substitutes are provided.
export const supabase = {
  auth: {
    getSession: () => getClient().auth.getSession(),
    onAuthStateChange(callback: (event: string, session: any) => void) {
      if (!client) {
        callback('INITIAL_SESSION', null);
        return { data: { subscription: { unsubscribe: () => undefined } } };
      }
      return client.auth.onAuthStateChange(callback);
    },
    signInWithPassword: (credentials: { email: string; password: string }) =>
      getClient().auth.signInWithPassword(credentials),
    signOut: () => getClient().auth.signOut(),
  },
  rpc: (functionName: string, args?: Record<string, unknown>) =>
    getClient().rpc(functionName, args),
};

export const supabaseDiagnostics = {
  urlConfigured: Boolean(supabaseUrl),
  publishableKeyConfigured: Boolean(supabasePublishableKey),
  configurationError,
};
