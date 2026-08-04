export const RepeatMode = {
  OFF: 'off',
  ALL: 'all',
  ONE: 'one'
};

// How soon before a track's natural end we start pre-buffering the next one
// (gapless) — needs to be enough time for the network fetch to get ahead of
// playback, but short enough not to waste bandwidth on tracks that get
// skipped anyway.
const PRELOAD_LEAD_SECONDS = 4;

export class Player {
  constructor(jellyfin, getBitrateKbps = () => 0) {
    this.jellyfin = jellyfin;
    this.getBitrateKbps = getBitrateKbps;

    // Two audio elements so the next track can be pre-buffered (gapless) or
    // crossfaded in while the current one is still playing. `audio` is a
    // getter for whichever is "active" so the rest of the app (seek bar,
    // volume slider, etc.) can keep treating `player.audio` as one stable
    // element without knowing about the swap underneath.
    this._audioA = new Audio();
    this._audioB = new Audio();
    this._activeIsA = true;
    this._wireAudioElement(this._audioA);
    this._wireAudioElement(this._audioB);

    this.baseVolume = 0.25; // matches the 50% default on the (quadratic-taper) volume slider
    this.crossfadeSeconds = 0; // 0 = off, up to 12
    this.replayGainEnabled = false;
    this._preloaded = false;
    this._transitioning = false;
    this._fadeRAF = null;

    this.queue = [];
    this.originalQueue = [];
    this.currentIndex = -1;
    this.shuffle = false;
    this.repeat = RepeatMode.OFF;
    this.queueSourceId = null; // Id of the album/playlist this queue came from, if any

    this.listeners = {
      trackchange: [],
      playstate: [],
      timeupdate: [],
      queuechange: []
    };

    this._applyVolume(this._audioA);
    this._applyVolume(this._audioB);
    this._setupMediaSession();
  }

  get audio() {
    return this._activeIsA ? this._audioA : this._audioB;
  }

  get _inactiveAudio() {
    return this._activeIsA ? this._audioB : this._audioA;
  }

  _wireAudioElement(el) {
    el.addEventListener('timeupdate', () => {
      if (el !== this.audio) return;
      this._emit('timeupdate');
      this._updateMediaSessionPosition();
      this._checkForTransition();
    });
    el.addEventListener('play', () => {
      if (el !== this.audio) return;
      this._emit('playstate');
      this._setMediaSessionPlaybackState();
    });
    el.addEventListener('pause', () => {
      if (el !== this.audio) return;
      this._emit('playstate');
      this._setMediaSessionPlaybackState();
    });
    el.addEventListener('ended', () => {
      if (el !== this.audio) return;
      this._onEnded();
    });
  }

  // ---------- ReplayGain / volume ----------

  _gainMultiplier(track) {
    if (!this.replayGainEnabled || !track || track.NormalizationGain == null) return 1;
    // NormalizationGain is in dB (ReplayGain-style); clamp so a bad/extreme
    // tag can't make a track silent or blow out the speakers.
    const linear = Math.pow(10, track.NormalizationGain / 20);
    return Math.min(2, Math.max(0.1, linear));
  }

  _applyVolume(el, track = this.currentTrack) {
    el.volume = Math.min(1, Math.max(0, this.baseVolume * this._gainMultiplier(track)));
  }

  setVolume(value) {
    this.baseVolume = Math.min(1, Math.max(0, value));
    if (!this._transitioning) this._applyVolume(this.audio);
  }

  setCrossfadeSeconds(seconds) {
    this.crossfadeSeconds = Math.min(12, Math.max(0, seconds));
  }

  setReplayGainEnabled(enabled) {
    this.replayGainEnabled = !!enabled;
    this._applyVolume(this.audio);
  }

  // ---------- MediaSession (lock-screen / notification controls) ----------
  //
  // Two backends: the plain Web MediaSession API (Electron desktop, browsers)
  // and, on Capacitor native builds, the @capgo/capacitor-media-session
  // plugin — the WebView's own navigator.mediaSession does NOT surface a real
  // Android system notification/foreground service, only real Chrome does,
  // so native builds need the plugin for lock-screen controls and for
  // playback to survive the app going to the background.

  _nativeMediaSession() {
    return (typeof window !== 'undefined' && window.Capacitor?.Plugins?.MediaSession) || null;
  }

  _setupMediaSession() {
    const native = this._nativeMediaSession();
    if (native) {
      native.setActionHandler({ action: 'play' }, () => this.togglePlay());
      native.setActionHandler({ action: 'pause' }, () => this.togglePlay());
      native.setActionHandler({ action: 'previoustrack' }, () => this.previous());
      native.setActionHandler({ action: 'nexttrack' }, () => this.next(true));
      native.setActionHandler({ action: 'seekto' }, (details) => {
        if (details?.seekTime != null) this.seekTo(details.seekTime);
      });
      native.setActionHandler({ action: 'seekbackward' }, () => {
        this.seekTo(Math.max(0, this.audio.currentTime - 10));
      });
      native.setActionHandler({ action: 'seekforward' }, () => {
        this.seekTo(Math.min(this.audio.duration || Infinity, this.audio.currentTime + 10));
      });
      return;
    }
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.next(true));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) this.seekTo(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      this.seekTo(Math.max(0, this.audio.currentTime - (details.seekOffset || 10)));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      this.seekTo(Math.min(this.audio.duration || Infinity, this.audio.currentTime + (details.seekOffset || 10)));
    });
  }

  _updateMediaSessionMetadata() {
    const track = this.currentTrack;
    const artist = track ? ((track.Artists && track.Artists.length ? track.Artists.join(', ') : track.AlbumArtist) || '') : '';
    const artUrl = track ? this.jellyfin.imageUrl(track) : null;
    const artwork = artUrl ? [96, 192, 256, 384, 512].map((size) => ({ src: artUrl, sizes: `${size}x${size}`, type: 'image/jpeg' })) : [];

    const native = this._nativeMediaSession();
    if (native) {
      native.setMetadata({ title: track?.Name || '', artist, album: track?.Album || '', artwork }).catch(() => {});
      return;
    }
    if (!('mediaSession' in navigator)) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.Name || '', artist, album: track.Album || '', artwork });
  }

  _setMediaSessionPlaybackState() {
    const state = this.audio.paused ? 'paused' : 'playing';
    const native = this._nativeMediaSession();
    if (native) {
      native.setPlaybackState({ playbackState: state }).catch(() => {});
      return;
    }
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state;
  }

  _updateMediaSessionPosition() {
    const duration = this.audio.duration;
    if (!isFinite(duration) || duration <= 0) return;
    const position = Math.min(this.audio.currentTime, duration);
    const playbackRate = this.audio.playbackRate || 1;

    const native = this._nativeMediaSession();
    if (native) {
      native.setPositionState({ duration, playbackRate, position }).catch(() => {});
      return;
    }
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    try {
      navigator.mediaSession.setPositionState({ duration, playbackRate, position });
    } catch (err) {
      // Some WebView versions throw if called with stale/invalid state; harmless to skip.
    }
  }

  on(event, callback) {
    this.listeners[event]?.push(callback);
  }

  _emit(event) {
    this.listeners[event]?.forEach((cb) => cb());
  }

  get currentTrack() {
    return this.currentIndex >= 0 ? this.queue[this.currentIndex] : null;
  }

  setQueue(tracks, startIndex = 0, sourceId = null) {
    this._cancelTransition();
    this.originalQueue = [...tracks];
    this.queue = this.shuffle ? this._shuffled(tracks) : [...tracks];
    const startTrackId = tracks[startIndex]?.Id;
    this.currentIndex = this.shuffle ? this.queue.findIndex((t) => t.Id === startTrackId) : startIndex;
    this.queueSourceId = sourceId;
    this._emit('queuechange');
    this._loadCurrent(true);
  }

  _shuffled(tracks) {
    const arr = [...tracks];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  toggleShuffle() {
    this._cancelTransition();
    const currentId = this.currentTrack?.Id;
    this.shuffle = !this.shuffle;
    if (this.shuffle) {
      this.queue = this._shuffled(this.originalQueue);
    } else {
      this.queue = [...this.originalQueue];
    }
    this.currentIndex = currentId ? this.queue.findIndex((t) => t.Id === currentId) : -1;
    this._emit('queuechange');
  }

  cycleRepeat() {
    const order = [RepeatMode.OFF, RepeatMode.ALL, RepeatMode.ONE];
    const next = order[(order.indexOf(this.repeat) + 1) % order.length];
    this.repeat = next;
    return next;
  }

  _loadCurrent(autoplay) {
    this._cancelTransition();
    const track = this.currentTrack;
    if (!track) return;
    const el = this.audio;
    el.src = this.jellyfin.streamUrl(track, this.getBitrateKbps());
    this._applyVolume(el, track);
    if (autoplay) el.play().catch(() => {});
    this._updateMediaSessionMetadata();
    this._setMediaSessionPlaybackState();
    this._emit('trackchange');
  }

  playAt(index) {
    if (index < 0 || index >= this.queue.length) return;
    this._cancelTransition();
    this.currentIndex = index;
    this._loadCurrent(true);
  }

  togglePlay() {
    if (!this.currentTrack) return;
    if (this.audio.paused) this.audio.play().catch(() => {});
    else this.audio.pause();
  }

  next(userTriggered = true) {
    this._cancelTransition();
    if (this.queue.length === 0) return;
    if (this.repeat === RepeatMode.ONE && !userTriggered) {
      this._loadCurrent(true);
      return;
    }
    let nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.queue.length) {
      if (this.repeat === RepeatMode.ALL) nextIndex = 0;
      else return this._stopAtEnd();
    }
    this.currentIndex = nextIndex;
    this._loadCurrent(true);
  }

  previous() {
    this._cancelTransition();
    if (this.queue.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    let prevIndex = this.currentIndex - 1;
    if (prevIndex < 0) prevIndex = this.repeat === RepeatMode.ALL ? this.queue.length - 1 : 0;
    this.currentIndex = prevIndex;
    this._loadCurrent(true);
  }

  _onEnded() {
    // If gapless pre-buffering already has the next track loaded and ready
    // in the inactive element, swap to it instantly instead of doing a
    // fresh network fetch — that's the whole point of gapless playback.
    if (this._preloaded && this.crossfadeSeconds === 0) {
      this._advanceIndexForNext();
      this._activeIsA = !this._activeIsA;
      this._preloaded = false;
      const el = this.audio;
      el.currentTime = 0;
      this._applyVolume(el);
      el.play().catch(() => {});
      this._updateMediaSessionMetadata();
      this._setMediaSessionPlaybackState();
      this._emit('trackchange');
      return;
    }
    this.next(false);
  }

  _stopAtEnd() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this._emit('playstate');
  }

  seekTo(seconds) {
    this.audio.currentTime = seconds;
  }

  // ---------- Gapless preloading / crossfade ----------

  _peekNextTrack() {
    if (this.repeat === RepeatMode.ONE) return this.queue[this.currentIndex];
    let nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.queue.length) {
      if (this.repeat === RepeatMode.ALL) nextIndex = 0;
      else return null;
    }
    return this.queue[nextIndex] || null;
  }

  _advanceIndexForNext() {
    if (this.repeat === RepeatMode.ONE) return;
    let nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.queue.length) nextIndex = 0; // only reachable when repeat === ALL, per _peekNextTrack
    this.currentIndex = nextIndex;
  }

  _checkForTransition() {
    const el = this.audio;
    const duration = el.duration;
    if (!isFinite(duration) || duration <= 0 || el.paused) return;
    const remaining = duration - el.currentTime;

    if (this.crossfadeSeconds > 0) {
      if (remaining <= this.crossfadeSeconds && !this._transitioning) {
        this._beginCrossfade();
      }
    } else if (remaining <= PRELOAD_LEAD_SECONDS && !this._preloaded) {
      this._preloadNext();
    }
  }

  _preloadNext() {
    const nextTrack = this._peekNextTrack();
    if (!nextTrack) return;
    this._preloaded = true;
    const inactive = this._inactiveAudio;
    inactive.src = this.jellyfin.streamUrl(nextTrack, this.getBitrateKbps());
    this._applyVolume(inactive, nextTrack);
    inactive.load();
  }

  _beginCrossfade() {
    const nextTrack = this._peekNextTrack();
    if (!nextTrack) return;
    this._transitioning = true;

    const outgoing = this.audio;
    const incoming = this._inactiveAudio;
    incoming.src = this.jellyfin.streamUrl(nextTrack, this.getBitrateKbps());
    incoming.currentTime = 0;
    incoming.volume = 0;
    incoming.play().catch(() => {});

    const fadeMs = this.crossfadeSeconds * 1000;
    const outgoingTarget = outgoing.volume;
    const incomingTarget = Math.min(1, Math.max(0, this.baseVolume * this._gainMultiplier(nextTrack)));
    const startedAt = performance.now();

    const step = () => {
      const t = Math.min(1, (performance.now() - startedAt) / fadeMs);
      outgoing.volume = outgoingTarget * (1 - t);
      incoming.volume = incomingTarget * t;
      if (t < 1) {
        this._fadeRAF = requestAnimationFrame(step);
        return;
      }
      outgoing.pause();
      outgoing.currentTime = 0;
      this._advanceIndexForNext();
      this._activeIsA = !this._activeIsA;
      this._transitioning = false;
      this._preloaded = false;
      this._fadeRAF = null;
      this._updateMediaSessionMetadata();
      this._setMediaSessionPlaybackState();
      this._emit('trackchange');
    };
    this._fadeRAF = requestAnimationFrame(step);
  }

  _cancelTransition() {
    if (this._fadeRAF) cancelAnimationFrame(this._fadeRAF);
    this._fadeRAF = null;
    if (this._transitioning) {
      // A manual skip mid-crossfade: stop whichever element was fading in
      // on the side that's about to become inactive again.
      this._inactiveAudio.pause();
    }
    this._transitioning = false;
    this._preloaded = false;
  }
}
