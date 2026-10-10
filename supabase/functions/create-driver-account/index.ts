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

    const { data: appUser, error: appUserError } = await admin
      .from("app_users")
      .select("user_id,is_active")
      .eq("auth_user_id", callerId)
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
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!driverId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "DRIVER_ID_AND_VALID_EMAIL_REQUIRED" }, 400);
    }

    const { data: driver, error: driverError } = await admin
      .from("drivers")
      .select("driver_id,name,auth_user_id,is_active")
      .eq("driver_id", driverId)
      .maybeSingle();
    if (driverError) throw driverError;
    if (!driver || !driver.is_active) return json({ error: "DRIVER_NOT_FOUND_OR_INACTIVE" }, 404);
    if (driver.auth_user_id) return json({ error: "DRIVER_ACCOUNT_ALREADY_LINKED" }, 409);

    // Invite is sent by Supabase Auth. The service-role key stays server-side only.
    const siteUrl = Deno.env.get("SITE_URL");
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: driver.name, account_type: "driver" },
      ...(siteUrl ? { redirectTo: siteUrl } : {}),
    });
    if (inviteError) {
      const duplicate = /already|registered|exists/i.test(inviteError.message);
      return json({ error: duplicate ? "EMAIL_ALREADY_REGISTERED" : "INVITATION_FAILED" }, duplicate ? 409 : 400);
    }
    if (!invited.user) return json({ error: "INVITATION_FAILED" }, 500);

    const { error: linkError } = await admin
      .from("drivers")
      .update({ auth_user_id: invited.user.id })
      .eq("driver_id", driverId)
      .is("auth_user_id", null);
    if (linkError) {
      // Avoid leaving an unlinked invited identity when the DB link fails.
      await admin.auth.admin.deleteUser(invited.user.id);
      throw linkError;
    }

    return json({ success: true, driver_id: driverId, invited: true });
  } catch (error) {
    console.error("create-driver-account failed", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
