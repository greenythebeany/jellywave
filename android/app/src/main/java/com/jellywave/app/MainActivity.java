package com.jellywave.app;

import android.content.Context;
import android.media.AudioManager;
import android.media.audiofx.LoudnessEnhancer;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private LoudnessEnhancer loudnessEnhancer;

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

        // Proper audio focus/stream only fixes routing, not level — an HTML5
        // <audio> element's own volume can only attenuate (0-1), never boost
        // past the source signal, so it can't close a real loudness gap on
        // its own. LoudnessEnhancer runs natively at the OS level, attached
        // to session 0 (the process's global output mix) since the WebView's
        // internal <audio> pipeline doesn't expose its own session ID to
        // attach to directly — this is the standard approach for boosting
        // volume in WebView-based apps. +9dB is a moderate boost: enough to
        // close the gap with native apps without pushing already-loud
        // masters into audible clipping. Deliberately NOT using the Web
        // Audio API for this — that was already tried and disabled on
        // Android for causing a confirmed silent-audio bug; this effect
        // never touches the JS/WebView audio path at all.
        try {
            loudnessEnhancer = new LoudnessEnhancer(0);
            loudnessEnhancer.setTargetGain(900);
            loudnessEnhancer.setEnabled(true);
        } catch (Exception e) {
            // Not fatal — playback still works at normal volume without it.
        }
    }
}
