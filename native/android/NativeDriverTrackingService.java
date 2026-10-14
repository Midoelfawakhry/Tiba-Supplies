package com.tibasupplies.tracking;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;

/**
 * Foreground-service lifecycle shell for driver location tracking.
 * This class deliberately does not collect or transmit location until the
 * authenticated, consented session contract is wired and reviewed.
 */
public final class NativeDriverTrackingService extends Service {
    public static final String ACTION_START = "com.tibasupplies.tracking.START";
    public static final String ACTION_STOP = "com.tibasupplies.tracking.STOP";
    private static final String CHANNEL_ID = "driver_tracking";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        createChannel();
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Tiba Supplies")
            .setContentText("خدمة تتبّع السائق مفعّلة أثناء العمل")
            .setSmallIcon(getApplicationInfo().icon)
            .setOngoing(true)
            .build();
        startForeground(4207, notification);
        return START_STICKY;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "تتبّع السائق", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}