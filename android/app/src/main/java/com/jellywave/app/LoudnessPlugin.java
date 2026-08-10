package com.jellywave.app;

import android.content.Context;
import android.media.AudioManager;
import android.media.audiofx.LoudnessEnhancer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// A fixed native volume boost attempt for the WebView's <audio> playback,
// plus proper audio focus handling. There was previously a full native
// equalizer here too (and a user-adjustable boost slider in Settings), but
// on-device testing found android.media.audiofx effects — both Equalizer
// and LoudnessEnhancer alike — fail with ERROR_INVALID_OPERATION when
// attached to the global output mix (session 0) on at least one real
// device. That's a HAL capability gap this app can't work around, so the
// loudness side is deliberately minimal now: one fixed-gain attempt, no
// settings, no error reporting — it quietly helps on devices where
// session-0 effects work, and quietly does nothing where they don't.
@CapacitorPlugin(name = "JellyWaveLoudness")
public class LoudnessPlugin extends Plugin {
    private LoudnessEnhancer loudnessEnhancer;
    private AudioManager audioManager;
    private AudioManager.OnAudioFocusChangeListener focusChangeListener;

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
