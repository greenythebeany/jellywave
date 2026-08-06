package com.jellywave.app;

import android.content.Context;
import android.media.AudioManager;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
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
    }
}
