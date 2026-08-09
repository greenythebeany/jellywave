package com.jellywave.app;

import android.media.audiofx.LoudnessEnhancer;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// A fixed native volume boost attempt for the WebView's <audio> playback.
// There was previously a full native equalizer here too (and a
// user-adjustable boost slider in Settings), but on-device testing found
// android.media.audiofx effects — both Equalizer and LoudnessEnhancer alike
// — fail with ERROR_INVALID_OPERATION when attached to the global output
// mix (session 0) on at least one real device. That's a HAL capability
// gap this app can't work around, so this is deliberately minimal now:
// one fixed-gain attempt, no settings, no error reporting — it quietly
// helps on devices where session-0 effects work, and quietly does nothing
// where they don't.
@CapacitorPlugin(name = "JellyWaveLoudness")
public class LoudnessPlugin extends Plugin {
    private LoudnessEnhancer loudnessEnhancer;

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
}
