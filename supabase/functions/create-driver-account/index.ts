import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: "SERVER_CONFIGURATION_MISSING" }, 500);
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);
    const token = authorization.slice("Bearer ".length);
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) return json({ error: "AUTH_REQUIRED" }, 401);
    const callerId = callerData.user.id;
    const body = await req.json();

    if (body.action === "complete_password_setup") {
      const { data: driver, error: driverError } = await admin
        .from("drivers")
        .select("driver_id")
        .eq("auth_user_id", callerId)
        .eq("is_active", true)
        .maybeSingle();
      if (driverError) throw driverError;
      if (!driver) return json({ error: "DRIVER_NOT_FOUND_OR_INACTIVE" }, 403);

      const { data: currentUser, error: currentUserError } = await admin.auth.admin.getUserById(callerId);
      if (currentUserError) throw currentUserError;
      const appMetadata = currentUser.user.app_metadata ?? {};
      if (appMetadata.must_change_password !== true) return json({ success: true });

      const { error: updateError } = await admin.auth.admin.updateUserById(callerId, {
        app_metadata: { ...appMetadata, must_change_password: false },
      });
      if (updateError) throw updateError;
      return json({ success: true });
    }

    // Phase 1 authorization contract: use the authenticated caller's current
    // Main Office RPC guard instead of legacy app_users/user_roles schema.
    const { error: officeAccessError } = await callerClient.rpc("main_office_get_directory");
    if (officeAccessError) {
      const message = String(officeAccessError.message ?? "");
      const denied = /MAIN_OFFICE_ACCESS_REQUIRED|AUTH_REQUIRED|permission denied|42501|28000/i.test(message);
      return json({ error: denied ? "INSUFFICIENT_ROLE" : "AUTHORIZATION_CHECK_FAILED" }, denied ? 403 : 500);
    }

    const driverId = String(body.driver_id ?? "").trim();
    const temporaryPassword = String(body.temporary_password ?? "");
    if (!driverId) return json({ error: "DRIVER_ID_REQUIRED" }, 400);
    if (temporaryPassword.length < 8) return json({ error: "TEMPORARY_PASSWORD_TOO_SHORT" }, 400);

    if (body.action === "reset_password") {
      const { data: driver, error: driverError } = await admin
        .from("drivers")
        .select("driver_id,auth_user_id,is_active")
        .eq("driver_id", driverId)
        .maybeSingle();
      if (driverError) throw driverError;
      if (!driver || !driver.is_active) return json({ error: "DRIVER_NOT_FOUND_OR_INACTIVE" }, 404);
      if (!driver.auth_user_id) return json({ error: "DRIVER_ACCOUNT_NOT_LINKED" }, 409);

      const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(driver.auth_user_id);
      if (authUserError) throw authUserError;
      const appMetadata = authUser.user.app_metadata ?? {};
      const { data: driverPhoneRow, error: driverPhoneError } = await admin
        .from("drivers")
        .select("phone")
        .eq("driver_id", driverId)
        .maybeSingle();
      if (driverPhoneError) throw driverPhoneError;
      const phone = normalizeEgyptianPhone(driverPhoneRow?.phone);
      if (!phone) return json({ error: "DRIVER_PHONE_INVALID" }, 400);
      const { error: passwordError } = await admin.auth.admin.updateUserById(driver.auth_user_id, {
        email: driverLoginEmail(phone),
        email_confirm: true,
        password: temporaryPassword,
        app_metadata: { ...appMetadata, must_change_password: false },
      });
      if (passwordError) throw passwordError;
      return json({ success: true, driver_id: driverId, must_change_password: true });
    }

    const { data: driver, error: driverError } = await admin
      .from("drivers")
      .select("driver_id,name,phone,auth_user_id,is_active")
      .eq("driver_id", driverId)
      .maybeSingle();
    if (driverError) throw driverError;
    if (!driver || !driver.is_active) return json({ error: "DRIVER_NOT_FOUND_OR_INACTIVE" }, 404);
    if (driver.auth_user_id) return json({ error: "DRIVER_ACCOUNT_ALREADY_LINKED" }, 409);

    const phone = normalizeEgyptianPhone(driver.phone);
    if (!phone) return json({ error: "DRIVER_PHONE_INVALID" }, 400);

    // Phone digits are the visible username. This reserved alias enables password login
    // without requiring the phone auth provider, SMS, or a real email inbox.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: driverLoginEmail(phone),
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { display_name: driver.name, driver_phone: phone },
      app_metadata: { must_change_password: true },
    });
    if (createError) {
      const duplicate = /already|registered|exists/i.test(createError.message);
      return json(
        { error: duplicate ? "PHONE_ALREADY_REGISTERED" : "ACCOUNT_CREATION_FAILED" },
        duplicate ? 409 : 400,
      );
    }
    if (!created.user) return json({ error: "ACCOUNT_CREATION_FAILED" }, 500);

    const { data: linkedDriver, error: linkError } = await admin
      .from("drivers")
      .update({ auth_user_id: created.user.id })
      .eq("driver_id", driverId)
      .is("auth_user_id", null)
      .eq("is_active", true)
      .select("driver_id")
      .maybeSingle();

    if (linkError || !linkedDriver) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
      if (cleanupError) console.error("Unlinked driver auth cleanup failed", cleanupError);
      if (linkError) throw linkError;
      return json({ error: "DRIVER_ACCOUNT_ALREADY_LINKED" }, 409);
    }

    return json({ success: true, driver_id: driverId, phone_password_login: true });
  } catch (error) {
    console.error("create-driver-account failed", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});

function driverLoginEmail(normalizedPhone: string): string {
  const digits = normalizedPhone.replace(/\D/g, "");
  return `${digits}@driver-login.tiba.invalid`;
}

function normalizeEgyptianPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let phone = value.trim().replace(/[\s()-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (/^01[0125]\d{8}$/.test(phone)) phone = `+20${phone.slice(1)}`;
  if (/^20(10|11|12|15)\d{8}$/.test(phone)) phone = `+${phone}`;
  if (/^\+20(10|11|12|15)\d{8}$/.test(phone)) return phone;
  return null;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
