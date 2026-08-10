package com.jellywave.app;

import android.content.Context;
import android.media.AudioManager;
import android.media.AudioPlaybackConfiguration;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

// Native volume boost + equalizer for the WebView's <audio> playback, plus
// proper audio focus handling.
//
// The equalizer used to attach directly to session 0 (new Equalizer(0, 0)),
// which is Android's *global output mix*, not a real per-player session --
// that's a different thing, and on-device testing found it fails outright
// with ERROR_INVALID_OPERATION on real hardware. A WebView doesn't hand its
// internal <audio> element's actual session ID to the embedding app through
// any Capacitor/WebView API, so this discovers it indirectly instead:
// AudioManager.AudioPlaybackCallback (API 26+) reports every currently
// active playback session visible to this app, including this app's own
// WebView, each with a real, effect-attachable session ID. Attach there,
// never to session 0.
@CapacitorPlugin(name = "JellyWaveLoudness")
public class LoudnessPlugin extends Plugin {
    private LoudnessEnhancer loudnessEnhancer;
    private AudioManager audioManager;
    private AudioManager.OnAudioFocusChangeListener focusChangeListener;

    private Equalizer equalizer;
    private int attachedSessionId = 0; // 0 = nothing attached yet (also the global-mix sentinel, so never a valid target)
    private boolean eqEnabled = false;
    private final float[] eqGainsDb = new float[]{0, 0, 0, 0, 0};
    // Same center frequencies as the desktop Web Audio equalizer (see
    // EQ_BANDS in player.js) -- kept identical so the same 5-slider UI
    // means the same thing on both platforms. A device's own native
    // Equalizer usually exposes a *different* number of bands at different
    // frequencies though (sometimes fewer than 5), and getBand() below maps
    // each of these onto whichever real band affects it most -- on a
    // device with fewer native bands than 5, two of these sliders can end
    // up mapped to the same underlying band and affect each other.
    private static final int[] BAND_FREQUENCIES_HZ = {60, 250, 1000, 4000, 12000};

    private AudioManager.AudioPlaybackCallback playbackCallback;

    @PluginMethod
    public void setLoudnessGain(PluginCall call) {
        try {
            int gainMillibels = call.getInt("gainMillibels", 0);
            if (loudnessEnhancer == null) {
                loudnessEnhancer = new LoudnessEnhancer(0);
            }
            if (gainMillibels <= 0) {
                loudnessEnhancer.setEnabled(false);
            } else {
                loudnessEnhancer.setTargetGain(gainMillibels);
                loudnessEnhancer.setEnabled(true);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not set loudness gain: " + e.getMessage());
        }
    }

    // ---------- Equalizer ----------

    @PluginMethod
    public void setEqualizerEnabled(PluginCall call) {
        eqEnabled = call.getBoolean("enabled", false);
        ensurePlaybackWatcher();
        attachToActiveSession(); // try immediately, don't just wait for the next config-change callback
        applyEqualizerState();
        call.resolve();
    }

    @PluginMethod
    public void setEqualizerBand(PluginCall call) {
        int band = call.getInt("band", -1);
        double gainDb = call.getDouble("gainDb", 0.0);
        if (band < 0 || band >= BAND_FREQUENCIES_HZ.length) {
            call.reject("Invalid band index");
            return;
        }
        eqGainsDb[band] = (float) gainDb;
        applyBandGain(band);
        call.resolve();
    }

    private void ensurePlaybackWatcher() {
        if (Build.VERSION.SDK_INT < 26) return; // AudioPlaybackConfiguration needs API 26 (Android 8.0)
        if (playbackCallback != null) return; // already registered
        if (audioManager == null) {
            audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        }
        if (audioManager == null) return;

        playbackCallback = new AudioManager.AudioPlaybackCallback() {
            @Override
            public void onPlaybackConfigChanged(List<AudioPlaybackConfiguration> configs) {
                attachToActiveSession();
            }
        };
        audioManager.registerAudioPlaybackCallback(playbackCallback, new Handler(Looper.getMainLooper()));
    }

    private void attachToActiveSession() {
        if (!eqEnabled || audioManager == null) return;
        List<AudioPlaybackConfiguration> configs = audioManager.getActivePlaybackConfigurations();
        int sessionId = 0;
        for (AudioPlaybackConfiguration config : configs) {
            int id = config.getSessionId();
            // Session 0 is the global mix, not a real per-player session --
            // never attach effects there, same mistake as before.
            if (id != 0) {
                sessionId = id;
                break;
            }
        }
        if (sessionId == 0 || sessionId == attachedSessionId) return;

        try {
            if (equalizer != null) {
                equalizer.release();
            }
            equalizer = new Equalizer(0, sessionId);
            attachedSessionId = sessionId;
            applyEqualizerState();
        } catch (Exception e) {
            // This device rejects it even with a real (non-zero) session --
            // a deeper HAL limitation this app can't work around. Leave
            // audio playing normally, just without EQ.
            equalizer = null;
            attachedSessionId = 0;
        }
    }

    private void applyEqualizerState() {
        if (equalizer == null) return;
        try {
            equalizer.setEnabled(eqEnabled);
            if (eqEnabled) {
                for (int i = 0; i < BAND_FREQUENCIES_HZ.length; i++) applyBandGain(i);
            }
        } catch (Exception e) {
            // Same reasoning as attachToActiveSession's catch.
        }
    }

    private void applyBandGain(int band) {
        if (equalizer == null || !eqEnabled) return;
        try {
            short nativeBand = equalizer.getBand(BAND_FREQUENCIES_HZ[band] * 1000); // Hz -> milliHz
            short[] range = equalizer.getBandLevelRange(); // millibels
            int millibels = Math.round(eqGainsDb[band] * 100);
            millibels = Math.max(range[0], Math.min(range[1], millibels));
            equalizer.setBandLevel(nativeBand, (short) millibels);
        } catch (Exception e) {
            // Quietly skip this one band rather than failing the whole EQ.
        }
    }

    // MainActivity used to request audio focus once with an empty
    // callback — enough to make the hardware volume keys/STREAM_MUSIC
    // routing correct, but with nothing reacting to focus *changes*.
    // Chromium's own WebView audio pipeline still pauses playback on its
    // own the moment focus is lost (another app's notification sound,
    // switching apps, a brief call ping), but nothing was listening for
    // focus being *regained* — so playback stayed paused indefinitely
    // after any interruption, only "resuming" once the user noticed and
    // pressed play again. This forwards every focus change to JS so
    // Player can pause/auto-resume itself appropriately.
    @PluginMethod
    public void requestAudioFocus(PluginCall call) {
        try {
            audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) {
                call.reject("AudioManager unavailable");
                return;
            }
            focusChangeListener = this::handleAudioFocusChange;
            audioManager.requestAudioFocus(
                focusChangeListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not request audio focus: " + e.getMessage());
        }
    }

    private void handleAudioFocusChange(int focusChange) {
        String state;
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
                state = "loss";
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                state = "transientLoss";
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                state = "transientLossCanDuck";
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                state = "gain";
                break;
            default:
                return;
        }
        JSObject data = new JSObject();
        data.put("state", state);
        notifyListeners("audioFocusChange", data);
    }
}
