package com.jellywave.app;

import android.media.audiofx.Equalizer;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

// A native equalizer for the WebView's <audio> playback. The Web Audio API
// (used for this on desktop) is deliberately not an option on Android — it
// was already tried and disabled elsewhere in this app for causing a
// confirmed silent-audio bug. android.media.audiofx.Equalizer works
// entirely at the OS level instead, attached to session 0 (the process's
// global output mix) exactly like MainActivity's LoudnessEnhancer, so it
// never touches the WebView's own audio pipeline.
//
// Devices don't all expose the same band count/frequencies as this app's
// own 5-band UI (EQ_BANDS in player.js), so getBands() reports whatever the
// device actually has and the JS side resamples its gain curve onto that —
// see Player._syncNativeEqualizer.
@CapacitorPlugin(name = "JellyWaveEqualizer")
public class EqualizerPlugin extends Plugin {
    private Equalizer equalizer;

    private Equalizer getEqualizer() {
        if (equalizer == null) {
            equalizer = new Equalizer(0, 0);
        }
        return equalizer;
    }

    @PluginMethod
    public void getBands(PluginCall call) {
        try {
            Equalizer eq = getEqualizer();
            short numBands = eq.getNumberOfBands();
            short[] levelRange = eq.getBandLevelRange();

            JSArray bands = new JSArray();
            for (short i = 0; i < numBands; i++) {
                JSObject band = new JSObject();
                band.put("index", i);
                band.put("frequencyHz", eq.getCenterFreq(i) / 1000);
                bands.put(band);
            }

            JSObject result = new JSObject();
            result.put("bands", bands);
            result.put("minLevel", levelRange[0]);
            result.put("maxLevel", levelRange[1]);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Equalizer not available: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setBandLevels(PluginCall call) {
        try {
            JSArray levels = call.getArray("levels");
            if (levels == null) {
                call.reject("Missing levels");
                return;
            }
            Equalizer eq = getEqualizer();
            for (int i = 0; i < levels.length(); i++) {
                JSONObject entry = levels.getJSONObject(i);
                short band = (short) entry.getInt("band");
                short level = (short) entry.getInt("level");
                eq.setBandLevel(band, level);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not set band levels: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        try {
            Boolean enabled = call.getBoolean("enabled", true);
            getEqualizer().setEnabled(Boolean.TRUE.equals(enabled));
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not toggle equalizer: " + e.getMessage());
        }
    }
}
