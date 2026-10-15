package com.jellywave.app;

import android.content.Context;
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
    private int lastVolume = -1;

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) return;
        lastVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        // Volume changes are persisted to Settings.System, so observing it
        // catches hardware keys, the system volume panel and Bluetooth
        // remote volume alike -- without the hidden VOLUME_CHANGED_ACTION
        // broadcast or any extra permission.
        observer = new ContentObserver(new Handler(Looper.getMainLooper())) {
            @Override
            public void onChange(boolean selfChange) {
                int current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
                if (current == lastVolume) return;
                lastVolume = current;
                notifyListeners("volumeChange", levelPayload(current));
            }
        };
        getContext().getContentResolver().registerContentObserver(Settings.System.CONTENT_URI, true, observer);
    }

    @Override
    protected void handleOnDestroy() {
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
