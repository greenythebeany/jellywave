package com.jellywave.app;

import android.content.Context;
import android.media.AudioManager;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(EqualizerPlugin.class);
        super.onCreate(savedInstanceState);

        // The WebView's <audio> playback otherwise runs without ever
        // claiming the music audio stream, which on many devices leaves it
        // noticeably quieter than native apps at the same hardware volume
        // (hardware volume keys and any system loudness handling target
        // STREAM_MUSIC, not whatever stream Chromium picks by default).
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            setVolumeControlStream(AudioManager.STREAM_MUSIC);
            audioManager.requestAudioFocus(
                focusChange -> {},
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
        }

        // A LoudnessEnhancer on session 0 used to run here for a general
        // volume boost. Removed — over Bluetooth (car head units using
        // AVRCP "absolute volume"), it threw off the phone-to-car volume
        // negotiation: the boosted signal read as louder than the reported
        // stream level, so the car under-drove actual playback while
        // untouched system/notification sounds played at their normal
        // level, making them blast by comparison. Not worth the tradeoff
        // for a passive volume bump — the equalizer (EqualizerPlugin, user
        // opt-in, per-band rather than a blanket signal boost) is the
        // supported way to shape loudness now.
    }
}
