#![deny(clippy::all)]

use std::ffi::c_void;
use std::time::Duration;

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use souvlaki::{
    MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition,
    PlatformConfig, SeekDirection,
};

fn to_napi_err<E: std::fmt::Debug>(e: E) -> Error {
    Error::from_reason(format!("{:?}", e))
}

#[napi(object)]
pub struct JsMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    /// file:// or http(s):// URI -- see souvlaki's MediaMetadata::cover_url docs.
    pub cover_url: Option<String>,
    pub duration_ms: Option<f64>,
}

#[napi(object)]
pub struct JsSmtcEvent {
    pub kind: String,
    pub position_ms: Option<f64>,
}

fn event_to_js(event: MediaControlEvent) -> Option<JsSmtcEvent> {
    let (kind, position_ms) = match event {
        MediaControlEvent::Play => ("play", None),
        MediaControlEvent::Pause => ("pause", None),
        MediaControlEvent::Toggle => ("toggle", None),
        MediaControlEvent::Next => ("next", None),
        MediaControlEvent::Previous => ("previous", None),
        MediaControlEvent::Stop => ("stop", None),
        MediaControlEvent::Seek(SeekDirection::Forward) => ("seekforward", None),
        MediaControlEvent::Seek(SeekDirection::Backward) => ("seekbackward", None),
        MediaControlEvent::SeekBy(SeekDirection::Forward, d) => {
            ("seekby", Some(d.as_millis() as f64))
        }
        MediaControlEvent::SeekBy(SeekDirection::Backward, d) => {
            ("seekby", Some(-(d.as_millis() as f64)))
        }
        MediaControlEvent::SetPosition(MediaPosition(d)) => {
            ("setposition", Some(d.as_millis() as f64))
        }
        // Volume/OpenUri/Raise/Quit aren't wired up in JellyWave -- ignore.
        _ => return None,
    };
    Some(JsSmtcEvent {
        kind: kind.to_string(),
        position_ms,
    })
}

/// Thin N-API wrapper around souvlaki's Windows SystemMediaTransportControls
/// backend, so JellyWave (an unpackaged Win32 Electron app) can register as a
/// real OS media session -- Electron's Chromium build never bridges
/// navigator.mediaSession to Windows SMTC on its own (unlike stock Chrome),
/// which is why the app plays audio fine but never shows up in the taskbar
/// media flyout, lock screen, or third-party SMTC readers without this.
#[napi]
pub struct Smtc {
    controls: MediaControls,
}

#[napi]
impl Smtc {
    /// `hwnd` is the BigInt/Number read from Electron's
    /// `BrowserWindow.getNativeWindowHandle()` buffer (a raw HWND pointer).
    #[napi(constructor)]
    pub fn new(hwnd: i64) -> Result<Self> {
        let config = PlatformConfig {
            dbus_name: "jellywave",
            display_name: "JellyWave",
            hwnd: Some(hwnd as *mut c_void),
        };
        let controls = MediaControls::new(config).map_err(to_napi_err)?;
        Ok(Self { controls })
    }

    #[napi]
    pub fn attach(
        &mut self,
        callback: ThreadsafeFunction<JsSmtcEvent, ErrorStrategy::CalleeHandled>,
    ) -> Result<()> {
        self.controls
            .attach(move |event: MediaControlEvent| {
                if let Some(payload) = event_to_js(event) {
                    callback.call(Ok(payload), ThreadsafeFunctionCallMode::NonBlocking);
                }
            })
            .map_err(to_napi_err)
    }

    #[napi]
    pub fn set_metadata(&mut self, meta: JsMetadata) -> Result<()> {
        self.controls
            .set_metadata(MediaMetadata {
                title: meta.title.as_deref(),
                artist: meta.artist.as_deref(),
                album: meta.album.as_deref(),
                cover_url: meta.cover_url.as_deref(),
                duration: meta.duration_ms.map(|ms| Duration::from_millis(ms.max(0.0) as u64)),
            })
            .map_err(to_napi_err)
    }

    /// `state`: "playing" | "paused" | anything else is treated as "stopped".
    #[napi]
    pub fn set_playback(&mut self, state: String, position_ms: Option<f64>) -> Result<()> {
        let progress = position_ms.map(|ms| MediaPosition(Duration::from_millis(ms.max(0.0) as u64)));
        let playback = match state.as_str() {
            "playing" => MediaPlayback::Playing { progress },
            "paused" => MediaPlayback::Paused { progress },
            _ => MediaPlayback::Stopped,
        };
        self.controls.set_playback(playback).map_err(to_napi_err)
    }

    #[napi]
    pub fn detach(&mut self) -> Result<()> {
        self.controls.detach().map_err(to_napi_err)
    }
}
