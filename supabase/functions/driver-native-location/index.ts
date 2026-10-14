import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const response = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearer(request: Request): string {
  const value = request.headers.get("Authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "METHOD_NOT_ALLOWED" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !serviceKey || !publishableKey) return response(500, { error: "SERVER_CONFIGURATION_ERROR" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = bearer(request);
  if (!token) return response(401, { error: "AUTH_REQUIRED" });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return response(400, { error: "INVALID_JSON" });
  }

  // App-controlled start/revoke actions require a valid Supabase user session.
  if (body.action === "start" || body.action === "revoke") {
    const userClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return response(401, { error: "INVALID_USER_SESSION" });

    if (body.action === "revoke") {
      const { error } = await admin.from("driver_location_tracking_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("auth_user_id", userData.user.id)
        .is("revoked_at", null);
      if (error) return response(500, { error: "REVOKE_FAILED" });
      return response(200, { success: true });
    }

    const { data: driver, error: driverError } = await admin.from("drivers")
      .select("driver_id")
      .eq("auth_user_id", userData.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (driverError || !driver) return response(403, { error: "DRIVER_ACCOUNT_NOT_LINKED" });

    const trackingTokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const trackingToken = Array.from(trackingTokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    await admin.from("driver_location_tracking_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("auth_user_id", userData.user.id)
      .is("revoked_at", null);
    const { error: insertError } = await admin.from("driver_location_tracking_sessions").insert({
      auth_user_id: userData.user.id,
      driver_id: driver.driver_id,
      token_hash: await sha256(trackingToken),
      expires_at: expiresAt,
    });
    if (insertError) return response(500, { error: "TRACKING_SESSION_CREATE_FAILED" });
    return response(200, { trackingToken, expiresAt });
  }

  // Native background POST: token is scoped to this driver's location endpoint only.
  const { data: trackingSession, error: sessionError } = await admin.from("driver_location_tracking_sessions")
    .select("session_id,auth_user_id,driver_id,expires_at,revoked_at,last_seen_at")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (sessionError || !trackingSession || trackingSession.revoked_at ||
      new Date(trackingSession.expires_at).getTime() <= Date.now()) {
    return response(401, { error: "TRACKING_TOKEN_INVALID_OR_EXPIRED" });
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy = body.accuracy == null ? null : Number(body.accuracy);
  const heading = body.bearing == null ? null : Number(body.bearing);
  const speedMps = body.speed == null ? null : Number(body.speed);
  const capturedMs = body.time == null ? Date.now() : Number(body.time);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100)) ||
      !Number.isFinite(capturedMs) || capturedMs > Date.now() + 60_000 ||
      capturedMs < Date.now() - 15 * 60_000) {
    return response(400, { error: "INVALID_OR_STALE_LOCATION" });
  }
  if (trackingSession.last_seen_at &&
      Date.now() - new Date(trackingSession.last_seen_at).getTime() < 60_000) {
    return response(429, { error: "LOCATION_RATE_LIMITED" });
  }

  const { data: driver, error: driverError } = await admin.from("drivers")
    .select("driver_id,is_active")
    .eq("driver_id", trackingSession.driver_id)
    .eq("auth_user_id", trackingSession.auth_user_id)
    .eq("is_active", true)
    .maybeSingle();
  if (driverError || !driver) return response(403, { error: "DRIVER_NOT_ACTIVE" });

  const { data: assignment, error: assignmentError } = await admin.from("vehicle_driver_assignments")
    .select("vehicle_id,vehicles!inner(vehicle_id,is_active)")
    .eq("driver_id", driver.driver_id)
    .is("assigned_to", null)
    .lte("assigned_from", new Date().toISOString())
    .eq("vehicles.is_active", true)
    .order("assigned_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (assignmentError || !assignment) return response(403, { error: "NO_ACTIVE_VEHICLE_ASSIGNMENT" });

  const { error: upsertError } = await admin.from("driver_live_locations").upsert({
    driver_id: driver.driver_id,
    vehicle_id: assignment.vehicle_id,
    latitude,
    longitude,
    accuracy_m: accuracy,
    heading,
    speed_kmh: speedMps === null || !Number.isFinite(speedMps) ? null : speedMps * 3.6,
    captured_at: new Date(capturedMs).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "driver_id" });
  if (upsertError) return response(500, { error: "LOCATION_WRITE_FAILED" });

  await admin.from("driver_location_tracking_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("session_id", trackingSession.session_id);
  return response(200, { success: true });
});
