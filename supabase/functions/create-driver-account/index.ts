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

    const { data: appUser, error: appUserError } = await admin
      .from("app_users")
      .select("user_id")
      .eq("auth_user_id", callerData.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (appUserError) throw appUserError;
    if (!appUser) return json({ error: "INSUFFICIENT_ROLE" }, 403);

    const { data: roleLinks, error: rolesError } = await admin
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", appUser.user_id);
    if (rolesError) throw rolesError;
    const allowed = (roleLinks ?? []).some((link: any) =>
      ["ADMIN", "HEAD_OFFICE", "BRANCH"].includes(link.roles?.name)
    );
    if (!allowed) return json({ error: "INSUFFICIENT_ROLE" }, 403);

    const body = await req.json();
    const driverId = String(body.driver_id ?? "").trim();
    if (!driverId) return json({ error: "DRIVER_ID_REQUIRED" }, 400);

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

    // Create an unconfirmed phone account. The driver must prove possession by SMS OTP
    // before choosing a password or receiving a usable session.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      phone,
      phone_confirm: false,
      user_metadata: { display_name: driver.name },
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

    return json({ success: true, driver_id: driverId, phone_otp_required: true });
  } catch (error) {
    console.error("create-driver-account failed", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});

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
