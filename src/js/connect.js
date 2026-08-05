// Spotify-Connect-style device handoff, built on Jellyfin's own Sessions API
// and WebSocket remote-control protocol — the same mechanism the official
// Jellyfin apps use for "cast to device." Two directions:
//
// 1. Outbound: list other controllable sessions (getDevices) and hand this
//    device's current queue+position to one of them (sendToDevice).
// 2. Inbound: report this device's own playback over REST so it shows up as
//    a controllable target to other clients, and listen on a WebSocket for
//    Play/Playstate/GeneralCommand messages so another client (the official
//    app, or another JellyWave instance) can drive this one.
//
// Both directions are best-effort — a server that's unreachable, or a
// WebSocket that won't connect, should never interrupt local playback.

export function createConnect(jellyfin, player) {
  let ws = null;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let keepAliveTimer = null;
  let progressTimer = null;
  let playSessionId = null;
  let stopped = false;

  // ---------- Remote control (this device driving another JellyWave) ----------
  let connectedDevice = null; // { id, name }
  let lastRemoteState = null; // last polled SessionInfo for connectedDevice
  let remotePollTimer = null;
  const remoteStateListeners = [];

  function currentPositionTicks() {
    return Math.floor((player.audio.currentTime || 0) * 10000000);
  }

  function buildReportPayload(extra = {}) {
    const track = player.currentTrack;
    if (!track) return null;
    return {
      ItemId: track.Id,
      PlaySessionId: playSessionId,
      PlayMethod: 'DirectStream',
      PositionTicks: currentPositionTicks(),
      IsPaused: player.audio.paused,
      IsMuted: !!player.audio.muted,
      VolumeLevel: Math.round((player.baseVolume || 0) * 100),
      CanSeek: true,
      RepeatMode: player.repeat === 'all' ? 'RepeatAll' : player.repeat === 'one' ? 'RepeatOne' : 'RepeatNone',
      ShuffleMode: player.shuffle ? 'Shuffle' : 'Sorted',
      QueueableMediaTypes: ['Audio'],
      ...extra
    };
  }

  function reportStart() {
    playSessionId = `jellywave-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const payload = buildReportPayload();
    if (payload) jellyfin.reportPlaybackStart(payload).catch(() => {});
  }

  function reportProgress(extra) {
    const payload = buildReportPayload(extra);
    if (payload) jellyfin.reportPlaybackProgress(payload).catch(() => {});
  }

  function reportStopped() {
    if (!playSessionId) return;
    jellyfin.reportPlaybackStopped({
      PlaySessionId: playSessionId,
      PositionTicks: currentPositionTicks()
    }).catch(() => {});
    playSessionId = null;
  }

  // ---------- Inbound remote control ----------

  async function resolveTracks(itemIds) {
    const tracks = await Promise.all(itemIds.map((id) => jellyfin.getItem(id).catch(() => null)));
    return tracks.filter(Boolean);
  }

  async function handlePlay(data) {
    const itemIds = data.ItemIds || (data.ItemId ? [data.ItemId] : []);
    if (!itemIds.length) return;
    const tracks = await resolveTracks(itemIds);
    if (!tracks.length) return;
    player.setQueue(tracks, 0);
    const startTicks = data.StartPositionTicks || 0;
    if (startTicks > 0) {
      // The stream needs to actually be loaded before currentTime sticks —
      // poll briefly rather than seeking against an element with no duration yet.
      let attempts = 0;
      const trySeek = () => {
        if (player.audio.duration) { player.seekTo(startTicks / 10000000); return; }
        if (++attempts < 25) setTimeout(trySeek, 200);
      };
      trySeek();
    }
  }

  function handlePlaystate(data) {
    switch (data.Command) {
      case 'Pause': if (!player.audio.paused) player.togglePlay(); break;
      case 'Unpause': if (player.audio.paused) player.togglePlay(); break;
      case 'PlayPause': player.togglePlay(); break;
      case 'Stop': player.audio.pause(); break;
      case 'NextTrack': player.next(true); break;
      case 'PreviousTrack': player.previous(); break;
      case 'Seek': if (data.SeekPositionTicks != null) player.seekTo(data.SeekPositionTicks / 10000000); break;
    }
  }

  function handleGeneralCommand(data) {
    if (data.Name === 'SetVolume' && data.Arguments?.Volume != null) {
      player.setVolume(Math.min(1, Math.max(0, Number(data.Arguments.Volume) / 100)));
    } else if (data.Name === 'Mute') {
      player.audio.muted = true;
    } else if (data.Name === 'Unmute') {
      player.audio.muted = false;
    }
  }

  function sendKeepAlive() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ MessageType: 'KeepAlive' })); } catch (err) { /* connection is closing anyway */ }
    }
  }

  function handleMessage(evt) {
    let msg;
    try { msg = JSON.parse(evt.data); } catch (err) { return; }
    switch (msg.MessageType) {
      case 'Play': handlePlay(msg.Data || {}); break;
      case 'Playstate': handlePlaystate(msg.Data || {}); break;
      case 'GeneralCommand': handleGeneralCommand(msg.Data || {}); break;
      case 'ForceKeepAlive': sendKeepAlive(); break;
    }
  }

  function scheduleReconnect() {
    if (stopped) return;
    reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
    const delay = Math.min(30000, 1000 * 2 ** reconnectAttempt);
    reconnectTimer = setTimeout(connectSocket, delay);
  }

  function connectSocket() {
    if (stopped) return;
    let socket;
    try {
      socket = new WebSocket(jellyfin.wsUrl());
    } catch (err) {
      scheduleReconnect();
      return;
    }
    ws = socket;
    socket.addEventListener('open', () => {
      reconnectAttempt = 0;
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      keepAliveTimer = setInterval(sendKeepAlive, 30000);
    });
    socket.addEventListener('message', handleMessage);
    socket.addEventListener('close', () => {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      keepAliveTimer = null;
      if (ws === socket) ws = null;
      scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      try { socket.close(); } catch (err) { /* already closing */ }
    });
  }

  function start() {
    jellyfin.registerCapabilities().catch(() => {});
    connectSocket();
    player.on('trackchange', () => {
      // Report the new track directly rather than stopping first — Stopped
      // and Start are separate unawaited requests, and Stopped landing after
      // Start (easily possible over a real network) would briefly clear the
      // session's now-playing info right as a controller polls it. Playing a
      // new ItemId already supersedes whatever was playing before; Stopped
      // is only for genuinely stopping (queue ended, nothing next).
      if (player.currentTrack) reportStart();
      else reportStopped();
    });
    player.on('playstate', () => { if (player.currentTrack) reportProgress(); });
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(() => { if (player.currentTrack) reportProgress(); }, 10000);
  }

  function stop() {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    if (progressTimer) clearInterval(progressTimer);
    stopRemotePolling();
    connectedDevice = null;
    lastRemoteState = null;
    reportStopped();
    if (ws) { try { ws.close(); } catch (err) { /* ignore */ } ws = null; }
  }

  // ---------- Outbound: "Connect" device picker ----------

  async function getDevices() {
    try {
      return await jellyfin.getSessions();
    } catch (err) {
      return [];
    }
  }

  function emitRemoteState() {
    remoteStateListeners.forEach((cb) => cb(connectedDevice ? lastRemoteState : null));
  }

  function onRemoteStateChange(cb) {
    remoteStateListeners.push(cb);
  }

  function isConnected() {
    return !!connectedDevice;
  }

  function getConnectedDevice() {
    return connectedDevice;
  }

  // Polls the connected session's actual state (now-playing item, position,
  // pause state) so the local UI can mirror what's really happening on the
  // other device — Jellyfin only pushes this over WebSocket to the target
  // session itself, not to the controller, so polling is the only option.
  function stopRemotePolling() {
    if (remotePollTimer) clearInterval(remotePollTimer);
    remotePollTimer = null;
  }

  async function pollRemoteState() {
    if (!connectedDevice) return;
    let sessions;
    try {
      sessions = await jellyfin.getSessions();
    } catch (err) {
      return; // transient — try again next tick
    }
    const session = sessions.find((s) => s.Id === connectedDevice.id);
    if (!session) {
      // The other device closed/logged out — nothing left to control.
      disconnect();
      return;
    }
    lastRemoteState = session;
    emitRemoteState();
  }

  function startRemotePolling() {
    stopRemotePolling();
    pollRemoteState();
    remotePollTimer = setInterval(pollRemoteState, 3000);
  }

  // A command changes the remote device's state, but the poll loop might not
  // tick for up to 3s — nudge it after a short delay so the UI catches up
  // quickly instead of visibly lagging behind what you just did.
  function pollSoon() {
    setTimeout(pollRemoteState, 400);
  }

  // Hands the remaining queue (current track onward, at the current
  // position) to another session, then stops local playback — audio should
  // only come from the device you handed off to, not both at once.
  // Sending the whole remaining queue as one comma-separated list of GUIDs
  // in the URL works fine for an album/playlist, but for something like
  // "All Songs" it can run to hundreds of tracks — long enough to exceed a
  // reverse proxy's URL/header length limit, which tends to just drop the
  // connection rather than return a clean error (shows up as a plain
  // "Failed to fetch", not an HTTP error). Cap it well under that.
  const MAX_HANDOFF_TRACKS = 100;

  async function sendToDevice(sessionId, deviceName) {
    const track = player.currentTrack;
    if (!track || player.currentIndex < 0) return;
    const startTicks = currentPositionTicks();
    const remaining = player.queue.slice(player.currentIndex, player.currentIndex + MAX_HANDOFF_TRACKS).map((tr) => tr.Id);
    await jellyfin.sendPlayCommand(sessionId, remaining.length ? remaining : [track.Id], startTicks);
    player.audio.pause();
    connectedDevice = { id: sessionId, name: deviceName };
    startRemotePolling();
  }

  // Drops back to controlling local playback. Does not touch the other
  // device's playback — it keeps playing until the user pauses it there.
  function disconnect() {
    connectedDevice = null;
    lastRemoteState = null;
    stopRemotePolling();
    emitRemoteState();
  }

  async function remoteCommand(command, extra) {
    if (!connectedDevice) return;
    try {
      await jellyfin.sendPlaystateCommand(connectedDevice.id, command, extra);
      pollSoon();
    } catch (err) {
      // Best-effort — the poll loop will notice if the device is gone.
    }
  }

  function remoteTogglePlay() {
    remoteCommand(lastRemoteState?.PlayState?.IsPaused ? 'Unpause' : 'Pause');
  }

  function remoteNext() {
    remoteCommand('NextTrack');
  }

  function remotePrevious() {
    remoteCommand('PreviousTrack');
  }

  // percent: 0-100, position within the remote track's own duration.
  function remoteSeekPercent(percent) {
    const durationTicks = lastRemoteState?.NowPlayingItem?.RunTimeTicks || 0;
    if (!durationTicks) return;
    remoteCommand('Seek', { SeekPositionTicks: Math.floor((percent / 100) * durationTicks) });
  }

  // percent: 0-100 volume level, sent as-is — this is the remote device's
  // own volume, unrelated to any local perceptual taper curve.
  async function remoteSetVolume(percent) {
    if (!connectedDevice) return;
    try {
      await jellyfin.sendGeneralCommand(connectedDevice.id, 'SetVolume', { Volume: String(Math.round(percent)) });
      pollSoon();
    } catch (err) {
      // Best-effort.
    }
  }

  return {
    start, stop, getDevices, sendToDevice,
    isConnected, getConnectedDevice, disconnect, onRemoteStateChange,
    remoteTogglePlay, remoteNext, remotePrevious, remoteSeekPercent, remoteSetVolume
  };
}
