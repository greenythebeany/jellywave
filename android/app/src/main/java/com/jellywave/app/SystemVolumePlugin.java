package com.jellywave.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.ContentObserver;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.core.content.ContextCompat;

// Lets the in-app volume slider drive the phone's real media volume
// (STREAM_MUSIC, the same stream the hardware keys control here -- see
// MainActivity's setVolumeControlStream) instead of a separate in-app
// level, and reports hardware-key/system changes back so the slider
// follows them. Levels cross the bridge as 0..1 fractions of the stream's
// max, since that max differs per device (commonly 15 or 25 steps).
@CapacitorPlugin(name = "JellyWaveSystemVolume")
public class SystemVolumePlugin extends Plugin {
    private AudioManager audioManager;
    private ContentObserver observer;
    private BroadcastReceiver receiver;
    private int lastVolume = -1;

    // Called from both sources below; only reports real changes.
    private void reportIfChanged() {
        int current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        if (current == lastVolume) return;
        lastVolume = current;
        notifyListeners("volumeChange", levelPayload(current));
    }

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) return;
        lastVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        // Primary: the system's volume-changed broadcast, sent the instant
        // the hardware keys / volume panel / Bluetooth change the level.
        // (Watching Settings.System alone lagged 1-2s behind, since Android
        // persists volume there lazily.)
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                int stream = intent.getIntExtra("android.media.EXTRA_VOLUME_STREAM_TYPE", -1);
                if (stream != -1 && stream != AudioManager.STREAM_MUSIC) return;
                reportIfChanged();
            }
        };
        ContextCompat.registerReceiver(getContext(), receiver,
            new IntentFilter("android.media.VOLUME_CHANGED_ACTION"), ContextCompat.RECEIVER_EXPORTED);
        // Fallback for devices/ROMs that don't send that broadcast.
        observer = new ContentObserver(new Handler(Looper.getMainLooper())) {
            @Override
            public void onChange(boolean selfChange) {
                reportIfChanged();
            }
        };
        getContext().getContentResolver().registerContentObserver(Settings.System.CONTENT_URI, true, observer);
    }

    @Override
    protected void handleOnDestroy() {
        if (receiver != null) {
            try { getContext().unregisterReceiver(receiver); } catch (IllegalArgumentException ignored) { }
            receiver = null;
        }
        if (observer != null) {
            getContext().getContentResolver().unregisterContentObserver(observer);
            observer = null;
        }
    }

    private JSObject levelPayload(int volume) {
        int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        JSObject data = new JSObject();
        data.put("level", max > 0 ? (double) volume / max : 0);
        data.put("steps", max);
        return data;
    }

    @PluginMethod
    public void getVolume(PluginCall call) {
        if (audioManager == null) {
            call.reject("AudioManager unavailable");
            return;
        }
        call.resolve(levelPayload(audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)));
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        if (audioManager == null) {
            call.reject("AudioManager unavailable");
            return;
        }
        double level = Math.max(0, Math.min(1, call.getDouble("level", 0.5)));
        int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int target = (int) Math.round(level * max);
        try {
            // Flags 0: no system volume panel popping up while the user is
            // already dragging our own slider.
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0);
            lastVolume = target;
            call.resolve(levelPayload(target));
        } catch (SecurityException e) {
            // Do Not Disturb can refuse volume changes on some devices.
            call.reject("Volume change not allowed: " + e.getMessage());
        }
    }
}
