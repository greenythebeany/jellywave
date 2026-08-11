package com.jellywave.app;

import android.content.Context;
import android.media.AudioManager;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Native volume boost + equalizer for the WebView's <audio> playback, plus
// proper audio focus handling.
//
// Both effects attach to session 0 (the global output mix) rather than a
// per-player session, since a WebView doesn't hand its internal <audio>
// element's actual session ID to the embedding app through any
// Capacitor/WebView API. An earlier attempt at this found session-0 effects
// failing outright with ERROR_INVALID_OPERATION and concluded it was a HAL
// capability gap -- that testing predated this app declaring
// android.permission.MODIFY_AUDIO_SETTINGS, which is required to attach an
// effect to the global mix. Once that permission was added, the loudness
// boost below started working fine on session 0, so the equalizer gets the
// same treatment now instead of the discovery-based approach that was
// briefly tried and reverted.
@CapacitorPlugin(name = "JellyWaveLoudness")
public class LoudnessPlugin extends Plugin {
    private LoudnessEnhancer loudnessEnhancer;
    private AudioManager audioManager;
    private AudioManager.OnAudioFocusChangeListener focusChangeListener;

    private Equalizer equalizer;
    private boolean eqEnabled = false;
    private final float[] eqGainsDb = new float[]{0, 0, 0, 0, 0};
    // Same center frequencies as the desktop Web Audio equalizer (see
    // EQ_BANDS in player.js) -- kept identical so the same 5-slider UI
    // means the same thing on both platforms. A device's own native
    // Equalizer usually exposes a *different* number of bands at different
    // frequencies though (sometimes fewer than 5), and applyBandGain()
    // below maps each of these onto whichever real band affects it most --
    // on a device with fewer native bands than 5, two of these sliders can
    // end up mapped to the same underlying band and affect each other.
    private static final int[] BAND_FREQUENCIES_HZ = {60, 250, 1000, 4000, 12000};

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
        try {
            eqEnabled = call.getBoolean("enabled", false);
            ensureEqualizer();
            if (equalizer != null) {
                equalizer.setEnabled(eqEnabled);
                if (eqEnabled) {
                    for (int i = 0; i < BAND_FREQUENCIES_HZ.length; i++) applyBandGain(i);
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not set equalizer state: " + e.getMessage());
        }
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

    private void ensureEqualizer() {
        if (equalizer != null) return;
        equalizer = new Equalizer(0, 0);
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
