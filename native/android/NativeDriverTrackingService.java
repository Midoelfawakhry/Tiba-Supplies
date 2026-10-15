package com.tibasupplies.driver;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

/**
 * Consent-based, visible foreground location service. Uploads only for the
 * currently signed-in driver and stops/clears credentials when asked to stop.
 */
public final class NativeDriverTrackingService extends Service implements LocationListener {
    public static final String ACTION_START = "com.tibasupplies.driver.START_TRACKING";
    public static final String ACTION_STOP = "com.tibasupplies.driver.STOP_TRACKING";
    private static final String CHANNEL_ID = "tiba_driver_tracking";
    private static final String KEY_ALIAS = "tiba_driver_tracking_session_v1";
    private static final String PREFS = "native_driver_tracking";
    private static final String SESSION = "encrypted_session";
    private static final String TAG = "TibaDriverTracking";
    private static final long RETRY_MS = 60_000L;
    // Keep the server's 10-minute freshness gate comfortably below its limit.
    private static final long MOVING_UPLOAD_INTERVAL_MS = 60_000L;
    private static final long SLOW_UPLOAD_INTERVAL_MS = 2 * 60_000L;
    private static final long STATIONARY_UPLOAD_INTERVAL_MS = 5 * 60_000L;
    private static final long LOCATION_REQUEST_INTERVAL_MS = 30_000L;
    private static final float LOCATION_DISTANCE_FILTER_M = 25f;
    private static final float MAX_ACCURACY_M = 100f;
    private LocationManager locationManager;
    private long lastSentAt;
    private long lastAttemptAt;
    private long expiresAt;
    private String accessToken;
    private String refreshToken;
    private String userId;
    private String projectUrl;
    private String publishableKey;
    private boolean stopped;

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopAndClear();
            return START_NOT_STICKY;
        }
        if (intent != null && ACTION_START.equals(intent.getAction())) {
            accessToken = intent.getStringExtra("accessToken");
            refreshToken = intent.getStringExtra("refreshToken");
            userId = intent.getStringExtra("userId");
            projectUrl = trimSlash(intent.getStringExtra("projectUrl"));
            publishableKey = intent.getStringExtra("publishableKey");
            expiresAt = intent.getLongExtra("expiresAt", 0L);
            if (empty(accessToken) || empty(refreshToken) || empty(userId) ||
                empty(projectUrl) || empty(publishableKey)) {
                stopAndClear();
                return START_NOT_STICKY;
            }
            try { persistEncryptedSession(); }
            catch (Exception e) { stopSelf(); return START_NOT_STICKY; }
        } else if (accessToken == null) {
            try { restoreEncryptedSession(); }
            catch (Exception e) { stopAndClear(); return START_NOT_STICKY; }
        }
        stopped = false;
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(4207, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(4207, buildNotification());
        }
        startLocationUpdates();
        return START_STICKY;
    }

    private Notification buildNotification() {
        createChannel();
        Intent stopIntent = new Intent(this, NativeDriverTrackingService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 4208, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
        return builder.setContentTitle("Tiba Supplies")
            .setContentText("مشاركة موقعك مفعّلة أثناء العمل")
            .setSmallIcon(getApplicationInfo().icon)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "إيقاف التتبّع", stopPending)
            .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "تتبّع السائق", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("إشعار ظاهر أثناء مشاركة موقع السائق مع المكتب");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private void startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopAndClear();
            return;
        }
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER))
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, LOCATION_REQUEST_INTERVAL_MS, LOCATION_DISTANCE_FILTER_M, this, Looper.getMainLooper());
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, LOCATION_REQUEST_INTERVAL_MS, LOCATION_DISTANCE_FILTER_M, this, Looper.getMainLooper());
        } catch (SecurityException e) { stopAndClear(); }
    }

    @Override public void onLocationChanged(Location location) {
        if (stopped || location == null || !location.hasAccuracy() || location.getAccuracy() > MAX_ACCURACY_M) return;
        long now = System.currentTimeMillis();
        float speed = location.hasSpeed() ? location.getSpeed() : 0f;
        long interval = speed >= 2f ? MOVING_UPLOAD_INTERVAL_MS : speed >= 0.5f ? SLOW_UPLOAD_INTERVAL_MS : STATIONARY_UPLOAD_INTERVAL_MS;
        if (now - lastSentAt < interval || now - lastAttemptAt < RETRY_MS) return;
        lastAttemptAt = now;
        new Thread(() -> {
            try {
                ensureFreshToken();
                JSONObject body = new JSONObject();
                body.put("p_latitude", location.getLatitude());
                body.put("p_longitude", location.getLongitude());
                body.put("p_accuracy_m", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
                body.put("p_captured_at", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                    .format(new java.util.Date(location.getTime())));
                JSONObject result = postJson(projectUrl + "/rest/v1/rpc/driver_update_live_location", body, accessToken);
                if (result != null) { lastSentAt = System.currentTimeMillis(); persistEncryptedSession(); }
            } catch (Exception error) {
                // Keep tracking alive, but retain a diagnostic for Android log capture.
                Log.e(TAG, "Location upload failed; will retry on a later GPS fix", error);
            }
        }, "tiba-location-upload").start();
    }

    private void ensureFreshToken() throws Exception {
        if (expiresAt > System.currentTimeMillis() + 120_000L) return;
        JSONObject body = new JSONObject(); body.put("refresh_token", refreshToken);
        JSONObject response = postJson(projectUrl + "/auth/v1/token?grant_type=refresh_token", body, null);
        if (response == null || empty(response.optString("access_token", null)) ||
            empty(response.optString("refresh_token", null))) throw new Exception("Session refresh failed");
        accessToken = response.getString("access_token");
        refreshToken = response.getString("refresh_token");
        expiresAt = System.currentTimeMillis() + response.optLong("expires_in", 3600L) * 1000L;
        persistEncryptedSession();
    }

    private JSONObject postJson(String endpoint, JSONObject body, String bearer) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        try {
            connection.setRequestMethod("POST"); connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
            connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("apikey", publishableKey);
            if (bearer != null) connection.setRequestProperty("Authorization", "Bearer " + bearer);
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = connection.getOutputStream()) { out.write(bytes); }
            int code = connection.getResponseCode();
            InputStream stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
            StringBuilder text = new StringBuilder();
            if (stream != null) try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line; while ((line = reader.readLine()) != null) text.append(line);
            }
            if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
            String response = text.toString();
            return response.isEmpty() ? new JSONObject().put("ok", true) : new JSONObject(response);
        } finally { connection.disconnect(); }
    }

    private void persistEncryptedSession() throws Exception {
        JSONObject json = new JSONObject();
        json.put("accessToken", accessToken); json.put("refreshToken", refreshToken); json.put("userId", userId);
        json.put("projectUrl", projectUrl); json.put("publishableKey", publishableKey); json.put("expiresAt", expiresAt);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] encrypted = cipher.doFinal(json.toString().getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        byte[] combined = new byte[iv.length + encrypted.length];
        System.arraycopy(iv, 0, combined, 0, iv.length); System.arraycopy(encrypted, 0, combined, iv.length, encrypted.length);
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(SESSION, Base64.encodeToString(combined, Base64.NO_WRAP)).apply();
    }

    private void restoreEncryptedSession() throws Exception {
        String encoded = getSharedPreferences(PREFS, MODE_PRIVATE).getString(SESSION, null);
        if (encoded == null) throw new Exception("No stored session");
        byte[] combined = Base64.decode(encoded, Base64.NO_WRAP);
        byte[] iv = java.util.Arrays.copyOfRange(combined, 0, 12);
        byte[] encrypted = java.util.Arrays.copyOfRange(combined, 12, combined.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
        JSONObject json = new JSONObject(new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8));
        accessToken = json.getString("accessToken"); refreshToken = json.getString("refreshToken");
        userId = json.getString("userId"); projectUrl = json.getString("projectUrl");
        publishableKey = json.getString("publishableKey"); expiresAt = json.optLong("expiresAt", 0L);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        java.security.Key key = store.getKey(KEY_ALIAS, null);
        if (key instanceof SecretKey) return (SecretKey) key;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }

    private void stopAndClear() {
        stopped = true;
        if (locationManager != null) locationManager.removeUpdates(this);
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove(SESSION).apply();
        accessToken = null; refreshToken = null; userId = null; projectUrl = null; publishableKey = null;
        stopForeground(true); stopSelf();
    }

    private static boolean empty(String value) { return value == null || value.trim().isEmpty(); }
    private static String trimSlash(String value) { if (value == null) return null; while (value.endsWith("/")) value = value.substring(0, value.length()-1); return value; }
    @Override public void onDestroy() { if (locationManager != null) locationManager.removeUpdates(this); super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, android.os.Bundle extras) {}
}