package com.tibasupplies.driver;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

/**
 * Explicitly invoked bridge for the driver's visible foreground tracking service.
 * The service must only be started for the authenticated, consented driver session.
 */
@CapacitorPlugin(name = "NativeDriverTracking")
public class NativeDriverTrackingPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        String accessToken = call.getString("accessToken");
        String refreshToken = call.getString("refreshToken");
        String userId = call.getString("userId");
        String projectUrl = call.getString("projectUrl");
        String publishableKey = call.getString("publishableKey");
        if (accessToken == null || refreshToken == null || userId == null ||
            projectUrl == null || publishableKey == null) {
            call.reject("بيانات جلسة السائق غير مكتملة.");
            return;
        }
        Intent intent = new Intent(getContext(), NativeDriverTrackingService.class);
        intent.setAction(NativeDriverTrackingService.ACTION_START);
        intent.putExtra("accessToken", accessToken);
        intent.putExtra("refreshToken", refreshToken);
        intent.putExtra("userId", userId);
        intent.putExtra("projectUrl", projectUrl);
        intent.putExtra("publishableKey", publishableKey);
        intent.putExtra("expiresAt", call.getLong("expiresAt", 0L));
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            JSObject out = new JSObject();
            out.put("started", true);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("تعذر بدء خدمة تتبع الموقع.", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            // stopService triggers onDestroy, which clears encrypted session material.
            getContext().stopService(new Intent(getContext(), NativeDriverTrackingService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("تعذر إيقاف خدمة تتبع الموقع.", e);
        }
    }
}