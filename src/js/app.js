import { JellyfinClient } from './jellyfin.js';
import { Player, RepeatMode, EQ_PRESETS } from './player.js';
import { fetchLyrics } from './lyrics.js';
import { getSettings, updateSettings, applySettings, currentBitrateKbps, PALETTES, AUDIO_QUALITIES } from './settings.js';
import { LOCALES, loadLocale, applyTranslations, t } from './i18n.js';
import { platform, isDesktop, isMobile, sessionStore, windowControls, wireHardwareBackButton, exitApp, requestNotificationPermission, setDiscordActivity, clearDiscordActivity, searchDeezerAlbumArt, hapticImpact } from './platform.js';
import { createConnect } from './connect.js';
import { isSupported as downloadsSupported, isDownloaded, downloadTrack, deleteDownload, onDownloadsChange } from './downloads.js';

// ---------- DOM refs ----------
const loginScreen = document.getElementById('login-screen');
const appRoot = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const btnLogin = document.getElementById('btn-login');
const btnRetryConnection = document.getElementById('btn-retry-connection');

const viewRoot = document.getElementById('view-root');
const playlistListEl = document.getElementById('playlist-list');
const globalSearchWrap = document.getElementById('global-search-wrap');
const globalSearchInput = document.getElementById('global-search');

const lyricsPanel = document.getElementById('lyrics-panel');
const lyricsBody = document.getElementById('lyrics-body');
const queueBody = document.getElementById('queue-body');
const tabLyrics = document.getElementById('tab-lyrics');
const tabQueue = document.getElementById('tab-queue');
const nowPlayingArt = document.getElementById('now-playing-art');
const nowPlayingArtWrap = document.querySelector('.now-playing-art-wrap');
const nowPlayingTitle = document.getElementById('now-playing-title');
const nowPlayingArtist = document.getElementById('now-playing-artist');
const nowPlayingBgArt = document.getElementById('now-playing-bg-art');
const nowPlayingLikeBtn = document.getElementById('now-playing-like-btn');

// Account menu
const btnAccount = document.getElementById('btn-account');
const accountAvatar = document.getElementById('account-avatar');
const accountUsername = document.getElementById('account-username');
const accountMenu = document.getElementById('account-menu');
const accountMenuName = document.getElementById('account-menu-name');
const menuSettings = document.getElementById('menu-settings');
const menuLogout = document.getElementById('menu-logout');

// Settings modal
const settingsOverlay = document.getElementById('settings-overlay');
const btnCloseSettings = document.getElementById('btn-close-settings');
const themeModeToggle = document.getElementById('theme-mode-toggle');
const paletteGrid = document.getElementById('palette-grid');
const audioQualitySelect = document.getElementById('audio-quality-select');
const languageSelect = document.getElementById('language-select');
const toggleArtBackground = document.getElementById('toggle-art-background');
const toggleDynamicAccentColor = document.getElementById('toggle-dynamic-accent-color');
const crossfadeSlider = document.getElementById('crossfade-slider');
const crossfadeValue = document.getElementById('crossfade-value');
const toggleReplayGain = document.getElementById('toggle-replaygain');
const toggleOfflineMode = document.getElementById('toggle-offline-mode');
const toggleEqualizer = document.getElementById('toggle-equalizer');
const equalizerBandsRow = document.getElementById('equalizer-bands-row');
const eqBandSliders = document.querySelectorAll('.eq-band-slider');
const btnEqReset = document.getElementById('btn-eq-reset');
const eqPresetSelect = document.getElementById('eq-preset-select');
const toggleCatJam = document.getElementById('toggle-cat-jam');
const catJamVideo = document.getElementById('cat-jam');
const catJamScaleRow = document.getElementById('cat-jam-scale-row');
const catJamScaleSlider = document.getElementById('cat-jam-scale-slider');
const catJamScaleValue = document.getElementById('cat-jam-scale-value');
const updateToast = document.getElementById('update-toast');
const updateToastText = document.getElementById('update-toast-text');
const updateToastLink = document.getElementById('update-toast-link');
const updateToastDismiss = document.getElementById('update-toast-dismiss');
const customCssInput = document.getElementById('custom-css-input');
const customCssStyle = document.getElementById('custom-css-style');
const mainBgArt = document.getElementById('main-bg-art');

// Create playlist modal
const btnNewPlaylist = document.getElementById('btn-new-playlist');
const createPlaylistOverlay = document.getElementById('create-playlist-overlay');
const btnCloseCreatePlaylist = document.getElementById('btn-close-create-playlist');
const createPlaylistForm = document.getElementById('create-playlist-form');
const inputPlaylistName = document.getElementById('input-playlist-name');

// Player bar elements
const playerBar = document.getElementById('player-bar');
const playerArt = document.getElementById('player-art');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const btnPlay = document.getElementById('btn-play');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');
const iconRepeat = document.getElementById('icon-repeat');
const seekBar = document.getElementById('seek-bar');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const volumeBar = document.getElementById('volume-bar');
const volumeIcon = document.getElementById('volume-icon');
const btnLyrics = document.getElementById('btn-lyrics');
const btnCloseLyrics = document.getElementById('btn-close-lyrics');
const btnSleepTimer = document.getElementById('btn-sleep-timer');
const btnSleepTimerMobile = document.getElementById('btn-sleep-timer-mobile');
const sleepTimerMenu = document.getElementById('sleep-timer-menu');
const sleepTimerBadge = document.getElementById('sleep-timer-badge');
const sleepTimerOff = document.getElementById('sleep-timer-off');
const btnConnect = document.getElementById('btn-connect');
const btnConnectMobile = document.getElementById('btn-connect-mobile');
const connectMenu = document.getElementById('connect-menu');
const connectDeviceList = document.getElementById('connect-device-list');

// Mobile full-screen player controls (mirror of the desktop mini-player ones above)
const mobileBtnPlay = document.getElementById('mobile-btn-play');
const mobileIconPlay = document.getElementById('mobile-icon-play');
const mobileIconPause = document.getElementById('mobile-icon-pause');
const mobileBtnPrev = document.getElementById('mobile-btn-prev');
const mobileBtnNext = document.getElementById('mobile-btn-next');
const mobileBtnShuffle = document.getElementById('mobile-btn-shuffle');
const mobileBtnRepeat = document.getElementById('mobile-btn-repeat');
const mobileIconRepeat = document.getElementById('mobile-icon-repeat');
const mobileSeekBar = document.getElementById('mobile-seek-bar');
const mobileTimeCurrent = document.getElementById('mobile-time-current');
const mobileTimeTotal = document.getElementById('mobile-time-total');

// ---------- State ----------
let jellyfin = null;
let player = null;
let connect = null;
let currentLyrics = null;
let lyricsTrackId = null;
let viewHistory = [];
let viewFuture = [];
let allSongsCache = null;
let musicLibraryId = null;
let activePanelTab = 'lyrics';
let playAllBtn = null;
let playAllTrackIds = [];
let cardRegistry = [];

// ---------- Window controls ----------
document.getElementById('btn-min').addEventListener('click', () => windowControls.minimize());
document.getElementById('btn-max').addEventListener('click', () => windowControls.maximize());
document.getElementById('btn-close').addEventListener('click', () => windowControls.close());
if (!isDesktop) document.body.classList.add('platform-' + platform);

// ---------- App icon (falls back gracefully until assets/icon.png exists) ----------
const titlebarIcon = document.getElementById('titlebar-icon');
titlebarIcon?.addEventListener('error', () => { titlebarIcon.style.display = 'none'; }, { once: true });

const loginIcon = document.getElementById('login-icon');
loginIcon?.addEventListener('error', () => {
  const fallback = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  fallback.setAttribute('viewBox', '0 0 24 24');
  fallback.setAttribute('width', '48');
  fallback.setAttribute('height', '48');
  fallback.innerHTML = '<circle cx="12" cy="12" r="11" fill="currentColor"/>';
  loginIcon.replaceWith(fallback);
}, { once: true });

// ---------- Utilities ----------
function ticksToSeconds(ticks) {
  return (ticks || 0) / 10000000;
}

// A native range thumb's center travels from thumbWidth/2 to (trackWidth -
// thumbWidth/2), not edge to edge — so a fill drawn as a plain `value%` of
// the track visibly overshoots the thumb early in the range and undershoots
// it late in the range. This maps value% onto that same inset travel range
// so the fill edge and thumb always line up.
function rangeFillPercent(valuePercent, trackEl, thumbWidthPx) {
  const trackWidth = trackEl.clientWidth;
  if (!trackWidth || trackWidth <= thumbWidthPx) return `${valuePercent}%`;
  const usable = trackWidth - thumbWidthPx;
  const fillPx = thumbWidthPx / 2 + (valuePercent / 100) * usable;
  return `${(fillPx / trackWidth) * 100}%`;
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Jellyfin sometimes stores a multi-artist collab as one un-split "A;B" name
// (unparsed tag delimiter) instead of separate entries — clean that up for display.
function formatDisplayName(name) {
  return (name || '').replace(/\s*;\s*/g, ', ');
}

function artistNames(item) {
  let raw;
  if (item.Artists && item.Artists.length) raw = item.Artists.join(', ');
  else if (item.AlbumArtist) raw = item.AlbumArtist;
  else raw = 'Unknown Artist';
  return formatDisplayName(raw);
}

// Maps a Jellyfin item Type to the "kind" strings this UI uses internally.
function typeToKind(type) {
  switch (type) {
    case 'Audio': return 'song';
    case 'MusicAlbum': return 'album';
    case 'MusicArtist': return 'artist';
    case 'Playlist': return 'playlist';
    default: return (type || '').toLowerCase();
  }
}

function placeholderArt(kind) {
  return kind === 'artist'
    ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23242424"/><circle cx="50" cy="40" r="18" fill="%23444"/><path d="M20 90c0-20 14-32 30-32s30 12 30 32" fill="%23444"/></svg>'
    : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23242424"/><path d="M35 30v34a9 9 0 1 0 4 7V42l30-6v24a9 9 0 1 0 4 7V24z" fill="%23555"/></svg>';
}

function artUrl(item, kind = 'album', maxSize) {
  return jellyfin.imageUrl(item, 'Primary', maxSize) || placeholderArt(kind);
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

// Plain `.hidden = bool` doesn't reliably reflect to the DOM attribute on
// SVG elements (only HTMLElement defines that IDL property), so toggle
// the attribute directly instead — works for any element type.
function setHidden(node, hidden) {
  if (hidden) node.setAttribute('hidden', '');
  else node.removeAttribute('hidden');
}

// Keeps the big play/pause button on album/playlist/artist pages in sync
// with whether the track currently playing actually belongs to that page.
function syncPlayAllButton() {
  if (!playAllBtn) return;
  const isThisPlaying = !!(player?.currentTrack && playAllTrackIds.includes(player.currentTrack.Id) && !player.audio.paused);
  setHidden(playAllBtn.querySelector('.icon-play-all-play'), isThisPlaying);
  setHidden(playAllBtn.querySelector('.icon-play-all-pause'), !isThisPlaying);
}

// Keeps album/playlist cards in grids (Home, Albums, Artist page) in sync
// with whether that specific collection is the one currently playing.
function syncCardStates() {
  cardRegistry.forEach(({ id, card, playBtn }) => {
    const isThisPlaying = !!(player?.currentTrack && player.queueSourceId === id && !player.audio.paused);
    card.classList.toggle('playing', isThisPlaying);
    setHidden(playBtn.querySelector('.icon-play-all-play'), isThisPlaying);
    setHidden(playBtn.querySelector('.icon-play-all-pause'), !isThisPlaying);
  });
}

// ---------- Session bootstrap ----------
async function init() {
  if (isMobile) requestNotificationPermission();
  if (isDesktop) wireUpdateToast();
  if (isDesktop) wireMediaKeys();
  wireSleepTimer();
  wireConnectMenu();
  volumeBar.style.setProperty('--pct', '50%');
  updateVolumeIcon(50);
  await loadLocale(getSettings().language);
  applyTranslations();
  customCssStyle.textContent = getSettings().customCss || '';
  wireSettingsUI();
  wireCreatePlaylistUI();
  wireBackButton();

  await tryRestoreSession();
}

// A stale/invalid token (401) genuinely needs a fresh login. Anything else —
// a network blip, the server restarting, a slow response — shouldn't nuke a
// perfectly good saved session and force re-entering credentials; retry a
// couple of times first, and if it's still unreachable, offer a "Retry"
// button that re-attempts with the same saved session rather than clearing it.
async function tryRestoreSession() {
  const saved = await sessionStore.load();
  if (!saved || !saved.serverUrl || !saved.accessToken || !saved.userId) {
    showLogin();
    return;
  }
  jellyfin = new JellyfinClient(saved);

  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    try {
      await jellyfin.ping();
      await enterApp(saved.username);
      return;
    } catch (err) {
      if (err?.status === 401) {
        jellyfin = null;
        await sessionStore.clear();
        showLogin();
        return;
      }
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (i + 1)));
        continue;
      }
      // Exhausted retries on a network/server error — keep the saved
      // session intact and let the user retry manually instead of forcing
      // them to log back in.
      showLogin();
      loginError.textContent = t('login.errorUnreachable');
      loginError.hidden = false;
      btnRetryConnection.hidden = false;
    }
  }
}

function showLogin() {
  loginScreen.hidden = false;
  appRoot.hidden = true;
}

async function enterApp(username) {
  loginScreen.hidden = true;
  appRoot.hidden = false;

  player = new Player(jellyfin, currentBitrateKbps);
  const savedSettings = getSettings();
  player.setCrossfadeSeconds(savedSettings.crossfadeSeconds || 0);
  player.setReplayGainEnabled(!!savedSettings.replayGainEnabled);
  (savedSettings.eqGains || []).forEach((gain, i) => player.setEqualizerBand(i, gain));
  player.setEqualizerEnabled(!!savedSettings.eqEnabled);
  connect = createConnect(jellyfin, player);
  connect.start();
  connect.onRemoteStateChange(updateRemoteBarUI);

  // Picking something new to play (an album, a track row, a playlist) goes
  // through setQueue/playAt regardless of where the click came from — too
  // many call sites to route each one through a connected check, so instead
  // starting a fresh local play while connected just takes control back,
  // same as it would on Spotify.
  const localSetQueue = player.setQueue.bind(player);
  player.setQueue = (...args) => {
    if (connect.isConnected()) connect.disconnect();
    return localSetQueue(...args);
  };
  const localPlayAt = player.playAt.bind(player);
  player.playAt = (...args) => {
    if (connect.isConnected()) connect.disconnect();
    return localPlayAt(...args);
  };

  wirePlayer();

  accountUsername.textContent = username || '';
  accountMenuName.textContent = username || '';
  const initial = (username || '?').slice(0, 1).toUpperCase();
  const avatarUrl = jellyfin.avatarUrl();
  if (avatarUrl) {
    accountAvatar.innerHTML = `<img src="${avatarUrl}" alt="" />`;
    accountAvatar.querySelector('img').addEventListener('error', () => {
      accountAvatar.textContent = initial;
    }, { once: true });
  } else {
    accountAvatar.textContent = initial;
  }

  const libs = await jellyfin.getMusicLibraries();
  musicLibraryId = libs[0]?.Id;

  await loadPlaylistSidebar();
  navigateTo({ view: 'home' });
}

// ---------- Login form ----------
btnRetryConnection.addEventListener('click', async () => {
  btnRetryConnection.disabled = true;
  loginError.hidden = true;
  btnRetryConnection.hidden = true;
  await tryRestoreSession();
  btnRetryConnection.disabled = false;
});

loginForm.addEventListener('submit', async (evt) => {
  evt.preventDefault();
  loginError.hidden = true;
  btnRetryConnection.hidden = true;
  btnLogin.disabled = true;
  btnLogin.textContent = t('login.loggingIn');

  const serverUrl = document.getElementById('input-server').value.trim();
  const username = document.getElementById('input-username').value.trim();
  const password = document.getElementById('input-password').value;
  const remember = document.getElementById('input-remember').checked;

  try {
    const auth = await JellyfinClient.authenticate(serverUrl, username, password);
    jellyfin = new JellyfinClient(auth);
    if (remember) {
      await sessionStore.save(auth);
    }
    await enterApp(auth.username);
  } catch (err) {
    loginError.textContent = translateLoginError(err) || t('login.errorGeneric');
    loginError.hidden = false;
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = t('login.logIn');
  }
});

function translateLoginError(err) {
  if (err?.code === 'wrong_credentials') return t('login.errorWrongCredentials');
  if (err?.code === 'server_error') return t('login.errorServer', { status: err.status });
  return null;
}

// ---------- Account menu ----------
btnAccount.addEventListener('click', (evt) => {
  evt.stopPropagation();
  accountMenu.hidden = !accountMenu.hidden;
});
document.addEventListener('click', (evt) => {
  if (!accountMenu.hidden && !accountMenu.contains(evt.target) && evt.target !== btnAccount) {
    accountMenu.hidden = true;
  }
});
menuLogout.addEventListener('click', async () => {
  await sessionStore.clear();
  connect?.stop();
  jellyfin = null;
  player?.audio.pause();
  location.reload();
});
menuSettings.addEventListener('click', () => {
  accountMenu.hidden = true;
  openSettings();
});

// ---------- Settings modal ----------
function wireSettingsUI() {
  Object.entries(LOCALES).forEach(([code, label]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    languageSelect.appendChild(opt);
  });
  languageSelect.addEventListener('change', async () => {
    updateSettings({ language: languageSelect.value });
    await loadLocale(languageSelect.value);
    applyTranslations();
    populateLocalizedSettingsOptions();
    refreshSettingsUI();
    if (viewHistory.length) renderView(viewHistory[viewHistory.length - 1]);
    await loadPlaylistSidebar();
  });

  populateLocalizedSettingsOptions();

  paletteGrid.addEventListener('click', (evt) => {
    const swatch = evt.target.closest('.palette-swatch');
    if (!swatch) return;
    updateSettings({ palette: swatch.dataset.value });
    refreshSettingsUI();
  });

  themeModeToggle.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateSettings({ themeMode: btn.dataset.value });
      refreshSettingsUI();
    });
  });

  audioQualitySelect.addEventListener('change', () => {
    updateSettings({ audioQuality: audioQualitySelect.value });
  });

  toggleArtBackground.addEventListener('change', () => {
    updateSettings({ artBackground: toggleArtBackground.checked });
    updateBgArt();
  });

  toggleDynamicAccentColor.addEventListener('change', () => {
    updateSettings({ dynamicAccentColor: toggleDynamicAccentColor.checked });
    updateDynamicAccentColor();
  });

  crossfadeSlider.addEventListener('input', () => {
    const seconds = Number(crossfadeSlider.value);
    crossfadeValue.textContent = seconds === 0 ? 'Off' : `${seconds}s`;
    crossfadeSlider.style.setProperty('--pct', rangeFillPercent((seconds / 12) * 100, crossfadeSlider, 13));
    player?.setCrossfadeSeconds(seconds);
  });
  crossfadeSlider.addEventListener('change', () => {
    updateSettings({ crossfadeSeconds: Number(crossfadeSlider.value) });
  });

  toggleOfflineMode.addEventListener('change', () => {
    updateSettings({ offlineMode: toggleOfflineMode.checked });
    // Re-apply row availability across whatever's currently on screen —
    // per-row state is only set when a row is first built otherwise.
    if (viewHistory.length) renderView(viewHistory[viewHistory.length - 1]);
  });

  toggleReplayGain.addEventListener('change', () => {
    updateSettings({ replayGainEnabled: toggleReplayGain.checked });
    player?.setReplayGainEnabled(toggleReplayGain.checked);
  });

  toggleEqualizer.addEventListener('change', () => {
    updateSettings({ eqEnabled: toggleEqualizer.checked });
    player?.setEqualizerEnabled(toggleEqualizer.checked);
    setHidden(equalizerBandsRow, !toggleEqualizer.checked);
  });

  eqBandSliders.forEach((slider) => {
    const band = Number(slider.dataset.band);
    const valueEl = document.querySelector(`.eq-band-value[data-band-value="${band}"]`);
    slider.addEventListener('input', () => {
      const gain = Number(slider.value);
      valueEl.textContent = gain > 0 ? `+${gain}` : `${gain}`;
      player?.setEqualizerBand(band, gain);
    });
    slider.addEventListener('change', () => {
      const gains = getSettings().eqGains ? [...getSettings().eqGains] : [0, 0, 0, 0, 0];
      gains[band] = Number(slider.value);
      // A manual tweak no longer matches whatever preset was selected.
      eqPresetSelect.value = 'custom';
      setHidden(eqPresetSelect.querySelector('option[value="custom"]'), false);
      updateSettings({ eqGains: gains, eqPreset: 'custom' });
    });
  });

  eqPresetSelect.addEventListener('change', () => {
    const preset = eqPresetSelect.value;
    const gains = EQ_PRESETS[preset] ? [...EQ_PRESETS[preset]] : [0, 0, 0, 0, 0];
    applyEqGainsToUI(gains);
    updateSettings({ eqGains: gains, eqPreset: preset });
  });

  btnEqReset.addEventListener('click', () => {
    eqPresetSelect.value = 'flat';
    applyEqGainsToUI(EQ_PRESETS.flat);
    updateSettings({ eqGains: [...EQ_PRESETS.flat], eqPreset: 'flat' });
  });

  toggleCatJam.addEventListener('change', () => {
    updateSettings({ catJam: toggleCatJam.checked });
    setHidden(catJamScaleRow, !toggleCatJam.checked);
    syncCatJamVisibility();
  });

  catJamScaleSlider.addEventListener('input', () => {
    const scale = Number(catJamScaleSlider.value);
    catJamScaleValue.textContent = `${scale.toFixed(1)}x`;
    catJamVideo.style.setProperty('--cat-scale', scale);
    catJamScaleSlider.style.setProperty('--pct', rangeFillPercent(((scale - 0.5) / 2.5) * 100, catJamScaleSlider, 14));
  });
  catJamScaleSlider.addEventListener('change', () => {
    updateSettings({ catJamScale: Number(catJamScaleSlider.value) });
  });

  let customCssDebounce;
  customCssInput.addEventListener('input', () => {
    customCssStyle.textContent = customCssInput.value;
    clearTimeout(customCssDebounce);
    customCssDebounce = setTimeout(() => {
      updateSettings({ customCss: customCssInput.value });
    }, 400);
  });

  btnCloseSettings.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', (evt) => {
    if (evt.target === settingsOverlay) closeSettings();
  });

  refreshSettingsUI();
}

function populateLocalizedSettingsOptions() {
  paletteGrid.innerHTML = '';
  Object.entries(PALETTES).forEach(([key, palette]) => {
    const swatch = el('button', 'palette-swatch');
    swatch.type = 'button';
    swatch.dataset.value = key;
    swatch.innerHTML = `<span class="dot" style="background:${palette.accent}"></span><span>${t(`palette.${key}`)}</span>`;
    paletteGrid.appendChild(swatch);
  });

  audioQualitySelect.innerHTML = '';
  Object.entries(AUDIO_QUALITIES).forEach(([key]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = t(`audioQuality.${key}`);
    audioQualitySelect.appendChild(opt);
  });
}

function updateBgArt() {
  const s = getSettings();
  const track = player?.currentTrack;
  if (s.artBackground && track) {
    const art = artUrl(track);
    mainBgArt.style.backgroundImage = `url("${art}")`;
    mainBgArt.classList.add('visible');
    nowPlayingBgArt.style.backgroundImage = `url("${art}")`;
    nowPlayingBgArt.classList.add('visible');
  } else {
    mainBgArt.classList.remove('visible');
    nowPlayingBgArt.classList.remove('visible');
  }
}

// Dynamic accent color — samples the current track's cover art and overrides
// the palette's --accent/--seek-*/--accent-bg vars via inline styles on <html>
// (inline styles win over any selector-based rule, so this cleanly overrides
// whichever palette is active without touching the palette CSS itself).
let dynamicAccentTrackId = null;

async function updateDynamicAccentColor(track) {
  track = track || player?.currentTrack;
  if (!getSettings().dynamicAccentColor || !track) {
    clearDynamicAccentColor();
    dynamicAccentTrackId = null;
    return;
  }
  if (dynamicAccentTrackId === track.Id) return;
  dynamicAccentTrackId = track.Id;
  const rgb = await extractDominantColor(artUrl(track, 'album', 64));
  // Track may have changed (or the setting been turned off) while we awaited the image.
  if (player?.currentTrack?.Id !== track.Id || !getSettings().dynamicAccentColor) return;
  if (rgb) applyDynamicAccentColor(rgb);
  else clearDynamicAccentColor();
}

// Jellyfin doesn't send CORS headers on image responses by default, which
// taints the canvas and blocks getImageData() with a SecurityError. That's
// expected for many self-hosted setups — fail silently and just skip the
// dynamic color for that track rather than surfacing an error.
function extractDominantColor(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let sumR = 0, sumG = 0, sumB = 0, n = 0;
        let bestSat = -1, bestColor = null;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const lightness = max / 255;
          if (lightness < 0.12 || lightness > 0.92) continue; // near-black/near-white make poor accents
          const sat = max === 0 ? 0 : (max - min) / max;
          sumR += r; sumG += g; sumB += b; n++;
          if (sat > bestSat && lightness > 0.25 && lightness < 0.85) {
            bestSat = sat;
            bestColor = [r, g, b];
          }
        }
        if (bestColor && bestSat > 0.15) { resolve(bestColor); return; }
        if (n > 0) { resolve([Math.round(sumR / n), Math.round(sumG / n), Math.round(sumB / n)]); return; }
        resolve(null);
      } catch (err) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function toHex([r, g, b]) {
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
}

function applyDynamicAccentColor(rgb) {
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const hex = toHex(rgb);
  const hoverHex = toHex([r + 25, g + 25, b + 25]);
  const root = document.documentElement;
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-hover', hoverHex);
  root.style.setProperty('--accent-contrast', luminance > 0.6 ? '#0a0a0a' : '#ffffff');
  root.style.setProperty('--seek-start', hex);
  root.style.setProperty('--seek-end', hoverHex);
  root.style.setProperty('--accent-bg', hex);
}

function clearDynamicAccentColor() {
  const root = document.documentElement;
  ['--accent', '--accent-hover', '--accent-contrast', '--seek-start', '--seek-end', '--accent-bg'].forEach((prop) =>
    root.style.removeProperty(prop)
  );
}

// Discord Rich Presence — no-op on mobile/web (see setDiscordActivity).
// Discord only embeds Rich Presence images served over HTTPS, so a
// Jellyfin server on plain HTTP (typical for a LAN-only setup) can't be used
// directly as the cover art source. Instead, look the album up on Deezer
// (proxied through main.js, since its API doesn't send CORS headers) by
// artist + album name and use its artwork — falling back to the static logo
// asset when nothing matches.
const externalCoverArtCache = new Map(); // "artist|album" (lowercased) -> url or null

async function fetchExternalCoverArt(artist, album, trackName) {
  const key = `${artist}|${album}`.toLowerCase();
  if (externalCoverArtCache.has(key)) return externalCoverArtCache.get(key);
  const url = await searchDeezerAlbumArt(artist, album, trackName);
  externalCoverArtCache.set(key, url);
  return url;
}

function updateDiscordPresence() {
  const track = player?.currentTrack;
  if (!track || player.audio.paused) {
    clearDiscordActivity();
    return;
  }
  const durationSeconds = ticksToSeconds(track.RunTimeTicks) || player.audio.duration || 0;
  const startTimestamp = Date.now() - player.audio.currentTime * 1000;
  const artist = artistNames(track);
  const album = track.Album || '';
  const trackIdAtCall = track.Id;

  const buildActivity = (largeImageKey) => ({
    type: 2, // Listening
    details: track.Name,
    state: artist,
    largeImageKey,
    largeImageText: album || undefined,
    smallImageKey: 'logo',
    smallImageText: 'JellyWave',
    startTimestamp,
    endTimestamp: durationSeconds ? startTimestamp + durationSeconds * 1000 : undefined,
    instance: false
  });

  const cacheKey = `${artist}|${album}`.toLowerCase();
  if (externalCoverArtCache.has(cacheKey)) {
    setDiscordActivity(buildActivity(externalCoverArtCache.get(cacheKey) || 'logo'));
    return;
  }

  // Show something immediately, then upgrade to real art once the lookup
  // resolves — guarded so a late response can't clobber a since-changed track.
  setDiscordActivity(buildActivity('logo'));
  fetchExternalCoverArt(artist, album, track.Name).then((art) => {
    if (!art || player?.currentTrack?.Id !== trackIdAtCall || player.audio.paused) return;
    setDiscordActivity(buildActivity(art));
  });
}

// ---------- Sleep timer ----------
let sleepTimerHandle = null;
let sleepTimerBadgeInterval = null;
let sleepTimerEndAt = null;
let sleepTimerAtEndOfTrack = false;

function clearSleepTimer() {
  if (sleepTimerHandle) clearTimeout(sleepTimerHandle);
  if (sleepTimerBadgeInterval) clearInterval(sleepTimerBadgeInterval);
  sleepTimerHandle = null;
  sleepTimerBadgeInterval = null;
  sleepTimerEndAt = null;
  sleepTimerAtEndOfTrack = false;
  sleepTimerBadge.hidden = true;
  sleepTimerOff.hidden = true;
  btnSleepTimer.classList.remove('active');
  btnSleepTimerMobile.classList.remove('active');
}

function updateSleepTimerBadge() {
  if (!sleepTimerEndAt) return;
  const minutesLeft = Math.max(1, Math.ceil((sleepTimerEndAt - Date.now()) / 60000));
  sleepTimerBadge.textContent = minutesLeft;
  sleepTimerBadge.hidden = false;
}

function setSleepTimer(minutes) {
  clearSleepTimer();
  sleepTimerEndAt = Date.now() + minutes * 60000;
  sleepTimerHandle = setTimeout(() => {
    if (!player.audio.paused) player.togglePlay();
    clearSleepTimer();
  }, minutes * 60000);
  updateSleepTimerBadge();
  sleepTimerBadgeInterval = setInterval(updateSleepTimerBadge, 15000);
  sleepTimerOff.hidden = false;
  btnSleepTimer.classList.add('active');
  btnSleepTimerMobile.classList.add('active');
}

function setSleepTimerEndOfTrack() {
  clearSleepTimer();
  sleepTimerAtEndOfTrack = true;
  sleepTimerBadge.textContent = '•';
  sleepTimerBadge.hidden = false;
  sleepTimerOff.hidden = false;
  btnSleepTimer.classList.add('active');
  btnSleepTimerMobile.classList.add('active');
}

function openSleepTimerMenuNear(triggerEl) {
  const rect = triggerEl.getBoundingClientRect();
  sleepTimerMenu.hidden = false;
  // Flip above the trigger if there's not enough room below (the desktop
  // player-bar button sits at the very bottom of the window).
  const menuHeight = sleepTimerMenu.offsetHeight;
  const opensUp = rect.bottom + menuHeight + 8 > window.innerHeight;
  sleepTimerMenu.style.top = opensUp ? `${rect.top - menuHeight - 8}px` : `${rect.bottom + 8}px`;
  const left = Math.min(rect.left, window.innerWidth - sleepTimerMenu.offsetWidth - 8);
  sleepTimerMenu.style.left = `${Math.max(8, left)}px`;
}

function wireSleepTimer() {
  const triggers = [btnSleepTimer, btnSleepTimerMobile];
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (!sleepTimerMenu.hidden) { sleepTimerMenu.hidden = true; return; }
      openSleepTimerMenuNear(trigger);
    });
  });
  document.addEventListener('click', (evt) => {
    if (!sleepTimerMenu.hidden && !sleepTimerMenu.contains(evt.target) && !triggers.includes(evt.target) && !evt.target.closest('.sleep-timer-wrap, #btn-sleep-timer-mobile')) {
      sleepTimerMenu.hidden = true;
    }
  });
  sleepTimerMenu.querySelectorAll('.sleep-timer-option[data-minutes]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSleepTimer(Number(btn.dataset.minutes));
      sleepTimerMenu.hidden = true;
    });
  });
  sleepTimerMenu.querySelector('[data-end-of-track]').addEventListener('click', () => {
    setSleepTimerEndOfTrack();
    sleepTimerMenu.hidden = true;
  });
  sleepTimerOff.addEventListener('click', () => {
    clearSleepTimer();
    sleepTimerMenu.hidden = true;
  });
}

// ---------- Connect (device handoff) ----------

function openConnectMenuNear(triggerEl) {
  const rect = triggerEl.getBoundingClientRect();
  connectMenu.hidden = false;
  const menuHeight = connectMenu.offsetHeight;
  const opensUp = rect.bottom + menuHeight + 8 > window.innerHeight;
  connectMenu.style.top = opensUp ? `${rect.top - menuHeight - 8}px` : `${rect.bottom + 8}px`;
  const left = Math.min(rect.left, window.innerWidth - connectMenu.offsetWidth - 8);
  connectMenu.style.left = `${Math.max(8, left)}px`;
}

async function loadConnectDevices() {
  if (!connect) {
    connectDeviceList.innerHTML = '';
    connectDeviceList.appendChild(el('div', 'connect-empty', t('connect.empty')));
    return;
  }

  const connected = connect.getConnectedDevice();
  if (connected) {
    connectDeviceList.innerHTML = '';
    const status = el('div', 'connect-status', t('connect.connectedTo', { device: connected.name || 'Device' }));
    connectDeviceList.appendChild(status);
    const disconnectBtn = el('button', 'connect-device-item danger');
    disconnectBtn.type = 'button';
    disconnectBtn.innerHTML = `<span class="connect-device-name">${escapeHtml(t('connect.disconnect'))}</span>`;
    disconnectBtn.addEventListener('click', () => {
      connect.disconnect();
      connectMenu.hidden = true;
    });
    connectDeviceList.appendChild(disconnectBtn);
    return;
  }

  connectDeviceList.innerHTML = `<div class="connect-loading">${escapeHtml(t('connect.loading'))}</div>`;
  const devices = await connect.getDevices();
  connectDeviceList.innerHTML = '';
  if (!devices.length) {
    connectDeviceList.appendChild(el('div', 'connect-empty', t('connect.empty')));
    return;
  }
  devices.forEach((session) => {
    const item = el('button', 'connect-device-item');
    item.type = 'button';
    const deviceName = session.DeviceName || session.Client || 'Device';
    const meta = session.NowPlayingItem
      ? t('connect.nowPlaying', { title: session.NowPlayingItem.Name })
      : (session.Client || '');
    item.innerHTML = `<span class="connect-device-name">${escapeHtml(deviceName)}</span><span class="connect-device-meta">${escapeHtml(meta)}</span>`;
    item.addEventListener('click', async () => {
      connectMenu.hidden = true;
      try {
        await connect.sendToDevice(session.Id, deviceName);
      } catch (err) {
        alert(err.message || t('connect.errorSend'));
      }
    });
    connectDeviceList.appendChild(item);
  });
}

function wireConnectMenu() {
  const triggers = [btnConnect, btnConnectMobile];
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (!connectMenu.hidden) { connectMenu.hidden = true; return; }
      openConnectMenuNear(trigger);
      loadConnectDevices();
    });
  });
  document.addEventListener('click', (evt) => {
    if (!connectMenu.hidden && !connectMenu.contains(evt.target) && !triggers.includes(evt.target) && !evt.target.closest('#btn-connect, #btn-connect-mobile')) {
      connectMenu.hidden = true;
    }
  });
}

// ---------- Cat Jam ----------
// Real bass-onset detection via Web Audio's AnalyserNode. Rather than
// overlaying a CSS bounce, the detected tempo instead drives the cat video's
// own playbackRate — same idea as the reference Spicetify extension, which
// speeds up/slows down its webm to match the track instead of animating it
// externally. REFERENCE_INTERVAL_MS is the beat interval the source video's
// own bob cycle was authored at (~120bpm); actual detected tempo scales
// speed relative to that.
const REFERENCE_INTERVAL_MS = 500;
let catJamRAF = null;
let catJamBassAvg = 0;
let catJamLastBeatAt = 0;
let catJamBeatIntervalMs = REFERENCE_INTERVAL_MS;

function catJamTick() {
  if (!getSettings().catJam) { catJamRAF = null; return; }
  catJamRAF = requestAnimationFrame(catJamTick);
  if (!player?.currentTrack || player.audio.paused) return;

  // Shares the player's Web Audio graph (see Player.getAnalyser) rather than
  // opening its own — a second createMediaElementSource() on the same
  // <audio> element would throw.
  const analyser = player.getAnalyser(player.audio);
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  const bassBins = 6; // roughly sub-bass/bass range at this fftSize
  let bassSum = 0;
  for (let i = 0; i < bassBins; i++) bassSum += data[i];
  const bass = bassSum / bassBins; // 0-255

  catJamBassAvg = catJamBassAvg * 0.92 + bass * 0.08;

  const now = performance.now();
  if (bass > catJamBassAvg * 1.35 && bass > 40 && now - catJamLastBeatAt > 220) {
    if (catJamLastBeatAt) {
      const interval = now - catJamLastBeatAt;
      // Only trust intervals in a plausible tempo range (~50-220bpm) —
      // a missed or extra detection would otherwise throw the estimate off.
      if (interval > 270 && interval < 1200) {
        catJamBeatIntervalMs = catJamBeatIntervalMs * 0.7 + interval * 0.3;
      }
    }
    catJamLastBeatAt = now;
  }

  const targetRate = REFERENCE_INTERVAL_MS / catJamBeatIntervalMs;
  catJamVideo.playbackRate = Math.min(2, Math.max(0.5, targetRate));
}

function syncCatJamVisibility() {
  const catJamOn = getSettings().catJam;
  const shouldShow = catJamOn && !!player?.currentTrack;

  if (isMobile) {
    // Mobile: a plain looping overlay on the cover art, no beat-sync — beat
    // detection needs Web Audio's createMediaElementSource, which reroutes
    // the <audio> element permanently for its lifetime and can silence real
    // output entirely on Android's WebView (playback state/timeupdate/the
    // native media notification all keep reporting normally regardless,
    // since none of those depend on where the audio graph routes to — see
    // the desktop branch below, which never runs on Android).
    if (catJamVideo.parentElement !== nowPlayingArtWrap) nowPlayingArtWrap.appendChild(catJamVideo);
    setHidden(catJamVideo, !shouldShow);
    if (shouldShow) {
      catJamVideo.playbackRate = 1;
      catJamVideo.play().catch(() => {});
    }
    return;
  }

  const enabled = isDesktop && catJamOn;
  setHidden(catJamVideo, !shouldShow);
  if (shouldShow) catJamVideo.play().catch(() => {});
  if (enabled && !catJamRAF) catJamTick();
}

function wireUpdateToast() {
  if (!window.api?.updates) return;
  updateToastDismiss.addEventListener('click', () => { updateToast.hidden = true; });
  window.api.updates.onAvailable((result) => {
    updateToastText.textContent = t('update.available', { version: result.version });
    updateToastLink.href = result.url;
    updateToast.hidden = false;
  });
}

function wireMediaKeys() {
  if (!window.api?.mediaKeys) return;
  window.api.mediaKeys.onKey((key) => {
    if (!player) return;
    if (key === 'playpause') uiTogglePlay();
    else if (key === 'next') uiNext();
    else if (key === 'previous') uiPrevious();
    else if (key === 'stop' && !connect?.isConnected() && !player.audio.paused) uiTogglePlay();
  });
}

// ---------- Transport controls: local playback, or the connected remote
// device when one is active (see wireConnectMenu / updateRemoteBarUI) ----------

function uiTogglePlay() {
  if (connect?.isConnected()) { connect.remoteTogglePlay(); return; }
  player.togglePlay();
}

function uiNext() {
  if (connect?.isConnected()) { connect.remoteNext(); return; }
  player.next(true);
}

function uiPrevious() {
  if (connect?.isConnected()) { connect.remotePrevious(); return; }
  player.previous();
}

function uiSeekPercent(pct) {
  if (connect?.isConnected()) { connect.remoteSeekPercent(pct); return; }
  const duration = player.audio.duration || 0;
  player.seekTo((pct / 100) * duration);
}

function uiSetVolumePercent(pct) {
  if (connect?.isConnected()) { connect.remoteSetVolume(pct); return; }
  player.setVolume(sliderToVolume(pct));
}

// Mirrors the connected device's actual playback state into the player bar
// (art/title/artist/seek/time/play state/volume) — called on every Connect
// poll tick, and once with `null` right when a connection drops so the bar
// falls back to reflecting local state again.
function updateRemoteBarUI(session) {
  playerBar.classList.toggle('connected-remote', !!session);
  btnConnect.classList.toggle('active', !!session);
  btnConnectMobile.classList.toggle('active', !!session);
  if (!session) {
    // Disconnected — restore the bar to whatever's actually loaded locally
    // (paused, since it was stopped for the handoff) instead of leaving the
    // last-seen remote track showing.
    const track = player.currentTrack;
    if (track) {
      playerArt.src = artUrl(track);
      playerTitle.textContent = track.Name;
      playerArtist.textContent = artistNames(track);
      nowPlayingArt.src = artUrl(track, 'album', 800);
      nowPlayingTitle.textContent = track.Name;
      nowPlayingArtist.textContent = artistNames(track);
      nowPlayingLikeBtn.classList.toggle('liked', !!track.UserData?.IsFavorite);
      const playing = !player.audio.paused;
      setHidden(iconPlay, playing);
      setHidden(iconPause, !playing);
      setHidden(mobileIconPlay, playing);
      setHidden(mobileIconPause, !playing);
      const duration = ticksToSeconds(track.RunTimeTicks) || player.audio.duration || 0;
      const current = player.audio.currentTime || 0;
      const pct = duration ? (current / duration) * 100 : 0;
      seekBar.value = pct;
      seekBar.style.setProperty('--pct', rangeFillPercent(pct, seekBar, 14));
      mobileSeekBar.value = pct;
      mobileSeekBar.style.setProperty('--pct', rangeFillPercent(pct, mobileSeekBar, 12));
      timeCurrent.textContent = formatTime(current);
      mobileTimeCurrent.textContent = formatTime(current);
      if (duration) { timeTotal.textContent = formatTime(duration); mobileTimeTotal.textContent = formatTime(duration); }
    }
    const volPct = Math.round(Math.sqrt(player.baseVolume) * 100);
    volumeBar.value = volPct;
    volumeBar.style.setProperty('--pct', rangeFillPercent(volPct, volumeBar, 14));
    updateVolumeIcon(volPct);
    return;
  }

  playerBar.hidden = false;
  appRoot.classList.add('has-track');

  const item = session.NowPlayingItem;
  const playState = session.PlayState || {};
  if (item) {
    const art = jellyfin.imageUrl(item) || placeholderArt('album');
    playerArt.src = art;
    playerTitle.textContent = item.Name || '';
    playerArtist.textContent = artistNames(item);
    nowPlayingArt.src = jellyfin.imageUrl(item, 'Primary', 800) || art;
    nowPlayingTitle.textContent = item.Name || '';
    nowPlayingArtist.textContent = artistNames(item);
    nowPlayingLikeBtn.classList.toggle('liked', !!item.UserData?.IsFavorite);
    const posSeconds = (playState.PositionTicks || 0) / 10000000;
    const durSeconds = (item.RunTimeTicks || 0) / 10000000;
    const pct = durSeconds ? (posSeconds / durSeconds) * 100 : 0;
    seekBar.value = pct;
    seekBar.style.setProperty('--pct', rangeFillPercent(pct, seekBar, 14));
    mobileSeekBar.value = pct;
    mobileSeekBar.style.setProperty('--pct', rangeFillPercent(pct, mobileSeekBar, 12));
    timeCurrent.textContent = formatTime(posSeconds);
    mobileTimeCurrent.textContent = formatTime(posSeconds);
    timeTotal.textContent = formatTime(durSeconds);
    mobileTimeTotal.textContent = formatTime(durSeconds);
  }

  const playing = !playState.IsPaused;
  setHidden(iconPlay, playing);
  setHidden(iconPause, !playing);
  setHidden(mobileIconPlay, playing);
  setHidden(mobileIconPause, !playing);

  if (playState.VolumeLevel != null) {
    volumeBar.value = playState.VolumeLevel;
    volumeBar.style.setProperty('--pct', rangeFillPercent(playState.VolumeLevel, volumeBar, 14));
    updateVolumeIcon(playState.VolumeLevel);
  }
}

function refreshSettingsUI() {
  const s = getSettings();
  languageSelect.value = s.language;
  toggleArtBackground.checked = !!s.artBackground;
  toggleDynamicAccentColor.checked = !!s.dynamicAccentColor;
  crossfadeSlider.value = s.crossfadeSeconds || 0;
  crossfadeValue.textContent = s.crossfadeSeconds ? `${s.crossfadeSeconds}s` : 'Off';
  crossfadeSlider.style.setProperty('--pct', rangeFillPercent(((s.crossfadeSeconds || 0) / 12) * 100, crossfadeSlider, 13));
  toggleOfflineMode.checked = !!s.offlineMode;
  toggleReplayGain.checked = !!s.replayGainEnabled;
  toggleEqualizer.checked = !!s.eqEnabled;
  setHidden(equalizerBandsRow, !s.eqEnabled);
  const eqPreset = s.eqPreset || 'flat';
  setHidden(eqPresetSelect.querySelector('option[value="custom"]'), eqPreset !== 'custom');
  eqPresetSelect.value = eqPreset;
  const eqGains = s.eqGains || [0, 0, 0, 0, 0];
  eqBandSliders.forEach((slider) => {
    const band = Number(slider.dataset.band);
    const gain = eqGains[band] || 0;
    slider.value = gain;
    const valueEl = document.querySelector(`.eq-band-value[data-band-value="${band}"]`);
    valueEl.textContent = gain > 0 ? `+${gain}` : `${gain}`;
  });
  toggleCatJam.checked = !!s.catJam;
  setHidden(catJamScaleRow, !s.catJam);
  const catScale = s.catJamScale || 1;
  catJamScaleSlider.value = catScale;
  catJamScaleValue.textContent = `${catScale.toFixed(1)}x`;
  catJamScaleSlider.style.setProperty('--pct', rangeFillPercent(((catScale - 0.5) / 2.5) * 100, catJamScaleSlider, 14));
  catJamVideo.style.setProperty('--cat-scale', catScale);
  if (document.activeElement !== customCssInput) customCssInput.value = s.customCss || '';
  themeModeToggle.querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === s.themeMode);
  });
  paletteGrid.querySelectorAll('.palette-swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.value === s.palette);
  });
  audioQualitySelect.value = s.audioQuality;
}

function openSettings() {
  refreshSettingsUI();
  settingsOverlay.hidden = false;
}
function closeSettings() {
  settingsOverlay.hidden = true;
}

// ---------- Create playlist modal ----------
function wireCreatePlaylistUI() {
  btnNewPlaylist.addEventListener('click', () => {
    inputPlaylistName.value = '';
    createPlaylistOverlay.hidden = false;
    inputPlaylistName.focus();
  });
  btnCloseCreatePlaylist.addEventListener('click', closeCreatePlaylist);
  createPlaylistOverlay.addEventListener('click', (evt) => {
    if (evt.target === createPlaylistOverlay) closeCreatePlaylist();
  });
  createPlaylistForm.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const name = inputPlaylistName.value.trim();
    if (!name) return;
    const submitBtn = createPlaylistForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const created = await jellyfin.createPlaylist(name);
      closeCreatePlaylist();
      await loadPlaylistSidebar();
      navigateTo({ view: 'playlist', id: created.Id, name });
    } catch (err) {
      alert(err.message || t('errors.couldNotCreatePlaylist'));
    } finally {
      submitBtn.disabled = false;
    }
  });
}
function closeCreatePlaylist() {
  createPlaylistOverlay.hidden = true;
}

// ---------- Hardware back button (Android) ----------
let lastBackPressAt = 0;
function wireBackButton() {
  if (!isMobile) return;
  wireHardwareBackButton(() => {
    // Close whatever's on top first, in the order a user would expect.
    if (!settingsOverlay.hidden) { closeSettings(); return; }
    if (!createPlaylistOverlay.hidden) { closeCreatePlaylist(); return; }
    if (!accountMenu.hidden) { accountMenu.hidden = true; return; }
    if (activeAddMenu) { closeAddToPlaylistMenu(); return; }
    if (!lyricsPanel.hidden) { lyricsPanel.hidden = true; return; }

    if (viewHistory.length > 1) { goBack(); return; }

    // At root: require a second press within 2s to actually exit.
    const now = Date.now();
    if (now - lastBackPressAt < 2000) {
      exitApp();
    } else {
      lastBackPressAt = now;
    }
  });
}

// ---------- Sidebar / bottom-nav navigation ----------
document.querySelectorAll('.nav-item, .bottom-nav-item').forEach((btn) => {
  btn.addEventListener('click', () => navigateTo({ view: btn.dataset.view }));
});

async function loadPlaylistSidebar() {
  playlistListEl.innerHTML = '';
  const playlists = await jellyfin.getPlaylists();
  if (!playlists.length) {
    playlistListEl.appendChild(el('div', 'playlist-empty', t('playlist.sidebarEmpty')));
    return;
  }
  playlists.forEach((pl) => {
    const item = el('button', 'playlist-item');
    const img = document.createElement('img');
    img.className = 'pl-thumb';
    img.src = artUrl(pl);
    item.appendChild(img);
    const span = document.createElement('span');
    span.textContent = pl.Name;
    item.appendChild(span);
    item.addEventListener('click', () => navigateTo({ view: 'playlist', id: pl.Id, name: pl.Name }));
    wirePlaylistDropTarget(item, pl.Id);
    playlistListEl.appendChild(item);
  });
}

// ---------- View router with back/forward ----------
function navigateTo(state, pushHistory = true) {
  if (pushHistory && viewHistory.length) viewFuture = [];
  if (pushHistory) viewHistory.push(state);
  renderView(state);
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  globalSearchWrap.hidden = state.view !== 'search';
  if (state.view === 'search') globalSearchInput.focus();
}

function goBack() {
  if (viewHistory.length < 2) return;
  viewFuture.push(viewHistory.pop());
  renderView(viewHistory[viewHistory.length - 1]);
}
function goForward() {
  if (!viewFuture.length) return;
  const state = viewFuture.pop();
  viewHistory.push(state);
  renderView(state);
}

document.getElementById('btn-back').addEventListener('click', goBack);
document.getElementById('btn-forward').addEventListener('click', goForward);

// Mouse "back"/"forward" side buttons (button 3 / button 4) — Chromium would
// otherwise try to navigate the window's own history, which this app doesn't use.
window.addEventListener('mouseup', (evt) => {
  if (evt.button === 3) {
    evt.preventDefault();
    goBack();
  } else if (evt.button === 4) {
    evt.preventDefault();
    goForward();
  }
});

async function renderView(state) {
  viewRoot.innerHTML = '<div class="empty-state">Loading…</div>';
  playAllBtn = null;
  playAllTrackIds = [];
  cardRegistry = [];
  try {
    switch (state.view) {
      case 'home': await renderHome(); break;
      case 'search': await renderSearch(); break;
      case 'songs': await renderAllSongs(); break;
      case 'liked': await renderLikedSongs(); break;
      case 'library': renderLibrary(); break;
      case 'genres': await renderGenres(); break;
      case 'genre': await renderGenreDetail(state.id, state.name); break;
      case 'albums': await renderAlbums(); break;
      case 'artists': await renderArtists(); break;
      case 'playlist': await renderPlaylistDetail(state.id, state.name); break;
      case 'album': await renderAlbumDetail(state.id); break;
      case 'artist': await renderArtistDetail(state.id, state.name); break;
      case 'stats': await renderStats(); break;
      case 'smartMix': await renderSmartMix(state); break;
      default: await renderHome();
    }
  } catch (err) {
    viewRoot.innerHTML = `<div class="empty-state">Something went wrong: ${err.message}</div>`;
    return;
  }
  syncCardStates();
}

// ---------- Views ----------

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function ensureAllSongsCache() {
  if (!allSongsCache) allSongsCache = await jellyfin.getAllSongs(musicLibraryId);
  return allSongsCache;
}

// A collab track's Artists can be several names ("Avantasia" + "Tobias
// Sammet" + guest features) — count each one individually rather than the
// joined display string, or every distinct lineup becomes its own "artist".
function individualArtistNames(track) {
  if (track.Artists && track.Artists.length) return track.Artists.map(formatDisplayName);
  if (track.AlbumArtist) return [formatDisplayName(track.AlbumArtist)];
  return [];
}

// "Most Played" / "On Repeat" / "Recently Played" / stats all read Jellyfin's
// own UserData (PlayCount, LastPlayedDate) instead of anything stored
// locally — UserData lives on the account server-side, so these follow the
// user across devices instead of being stuck in one browser's storage.
function accountRecentlyPlayed(limit = 12) {
  if (!allSongsCache) return [];
  return allSongsCache
    .filter((tr) => tr.UserData?.LastPlayedDate)
    .sort((a, b) => new Date(b.UserData.LastPlayedDate) - new Date(a.UserData.LastPlayedDate))
    .slice(0, limit);
}

function accountMostPlayed(limit = 30) {
  if (!allSongsCache) return [];
  return allSongsCache
    .filter((tr) => (tr.UserData?.PlayCount || 0) > 0)
    .sort((a, b) => (b.UserData.PlayCount || 0) - (a.UserData.PlayCount || 0))
    .slice(0, limit);
}

function accountOnRepeat(limit = 30) {
  if (!allSongsCache) return [];
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return allSongsCache
    .filter((tr) => (tr.UserData?.PlayCount || 0) >= 3 && tr.UserData?.LastPlayedDate && new Date(tr.UserData.LastPlayedDate).getTime() >= cutoff)
    .sort((a, b) => (b.UserData.PlayCount || 0) - (a.UserData.PlayCount || 0))
    .slice(0, limit);
}

function accountStats() {
  const tracks = allSongsCache || [];
  let totalPlays = 0;
  let totalMs = 0;
  const artistCounts = new Map();
  const albumCounts = new Map();
  const topTracks = [];
  for (const tr of tracks) {
    const count = tr.UserData?.PlayCount || 0;
    if (count <= 0) continue;
    totalPlays += count;
    totalMs += count * ((tr.RunTimeTicks || 0) / 10000);
    individualArtistNames(tr).forEach((artist) => {
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + count);
    });
    if (tr.Album) albumCounts.set(tr.Album, (albumCounts.get(tr.Album) || 0) + count);
    topTracks.push(tr);
  }
  topTracks.sort((a, b) => (b.UserData.PlayCount || 0) - (a.UserData.PlayCount || 0));
  const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([artist, count]) => ({ artist, count }));
  const topAlbums = [...albumCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([album, count]) => ({ album, count }));
  return {
    totalPlays,
    totalMinutes: Math.round(totalMs / 60000),
    topArtists,
    topAlbums,
    topTracks: topTracks.slice(0, 10)
  };
}

function buildSmartMixCard({ title, subtitle, art, onPlay, onOpen }) {
  const card = el('div', 'card');
  const artWrap = el('div', 'card-art-wrap');
  const img = document.createElement('img');
  img.className = 'card-art';
  img.src = art || placeholderArt('album');
  artWrap.appendChild(img);
  const playBtn = el('button', 'card-play-btn');
  playBtn.innerHTML = '<svg class="icon-play-all-play" viewBox="0 0 24 24"><path d="M8 5v14l12-7z"/></svg>';
  playBtn.addEventListener('click', (evt) => { evt.stopPropagation(); onPlay(); });
  artWrap.appendChild(playBtn);
  card.appendChild(artWrap);
  card.appendChild(el('div', 'card-title', escapeHtml(title)));
  if (subtitle) card.appendChild(el('div', 'card-subtitle', escapeHtml(subtitle)));
  // Clicking the card body opens the mix's track list, same as any other
  // collection card — only the dedicated play button starts playback directly.
  card.addEventListener('click', onOpen);
  return card;
}

function buildSmartMixCards(genres) {
  const cards = [];
  const mostPlayed = accountMostPlayed(30);
  const onRepeat = accountOnRepeat(30);

  if (mostPlayed.length >= 3) {
    cards.push(buildSmartMixCard({
      title: t('home.mostPlayed'),
      subtitle: t('home.songsCount', { count: mostPlayed.length }),
      art: artUrl(mostPlayed[0]),
      onPlay: () => player.setQueue(mostPlayed, 0, 'smart:most-played'),
      onOpen: () => navigateTo({ view: 'smartMix', mixKind: 'most-played', title: t('home.mostPlayed') })
    }));
  }

  if (onRepeat.length >= 3) {
    cards.push(buildSmartMixCard({
      title: t('home.onRepeat'),
      subtitle: t('home.songsCount', { count: onRepeat.length }),
      art: artUrl(onRepeat[0]),
      onPlay: () => player.setQueue(onRepeat, 0, 'smart:on-repeat'),
      onOpen: () => navigateTo({ view: 'smartMix', mixKind: 'on-repeat', title: t('home.onRepeat') })
    }));
  }

  genres.slice(0, 2).forEach((genre) => {
    cards.push(buildSmartMixCard({
      title: genre.Name,
      subtitle: t('home.genreMix'),
      art: artUrl(genre, 'album'),
      onPlay: async () => {
        const tracks = await jellyfin.getSongsByGenre(genre.Id);
        if (tracks.length) player.setQueue(shuffleArray(tracks).slice(0, 50), 0, `smart:genre:${genre.Id}`);
      },
      onOpen: () => navigateTo({ view: 'smartMix', mixKind: 'genre', genreId: genre.Id, title: genre.Name })
    }));
  });

  return cards;
}

async function renderSmartMix(state) {
  let tracks;
  if (state.mixKind === 'most-played') {
    await ensureAllSongsCache();
    tracks = accountMostPlayed(30);
  } else if (state.mixKind === 'on-repeat') {
    await ensureAllSongsCache();
    tracks = accountOnRepeat(30);
  } else {
    tracks = shuffleArray(await jellyfin.getSongsByGenre(state.genreId)).slice(0, 50);
  }

  viewRoot.innerHTML = '';
  viewRoot.appendChild(buildDetailHeader({
    kind: t('home.madeForYou'),
    title: state.title,
    sub: t(tracks.length === 1 ? 'playlist.songCount' : 'playlist.songCountPlural', { count: tracks.length }),
    art: tracks[0] ? artUrl(tracks[0]) : placeholderArt('album'),
    round: false,
    onPlayAll: tracks.length ? () => player.setQueue(tracks, 0, `smart:${state.mixKind}:${state.genreId || ''}`) : undefined,
    trackIds: tracks.map((tr) => tr.Id)
  }));
  if (!tracks.length) {
    viewRoot.appendChild(el('div', 'empty-state', t('playlist.empty')));
    return;
  }
  viewRoot.appendChild(buildTrackTable(tracks, tracks));
}

async function renderHome() {
  const [playlists, albums, genres] = await Promise.all([
    jellyfin.getPlaylists(),
    jellyfin.getAlbums(musicLibraryId),
    jellyfin.getMusicGenres().catch(() => []),
    ensureAllSongsCache()
  ]);

  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('home.greeting')));

  const recentlyPlayed = accountRecentlyPlayed(12);
  if (recentlyPlayed.length) {
    viewRoot.appendChild(el('div', 'section-title', t('home.recentlyPlayed')));
    viewRoot.appendChild(buildCardRow(recentlyPlayed, 'song'));
  }

  const smartMixCards = buildSmartMixCards(genres);
  if (smartMixCards.length) {
    viewRoot.appendChild(el('div', 'section-title', t('home.madeForYou')));
    const grid = el('div', 'card-grid');
    smartMixCards.forEach((card) => grid.appendChild(card));
    viewRoot.appendChild(grid);
  }

  if (playlists.length) {
    viewRoot.appendChild(el('div', 'section-title', t('home.yourPlaylists')));
    viewRoot.appendChild(buildCardGrid(playlists.slice(0, 12), 'playlist'));
  }

  viewRoot.appendChild(el('div', 'section-title', t('home.recentAlbums')));
  viewRoot.appendChild(buildCardGrid(albums.slice(0, 12), 'album'));
}

async function renderSearch() {
  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('search.title')));
  const resultsEl = el('div', 'card-grid');
  viewRoot.appendChild(resultsEl);

  let debounceTimer;
  globalSearchInput.oninput = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const term = globalSearchInput.value.trim();
      resultsEl.innerHTML = '';
      if (!term) return;
      let items;
      try {
        items = await jellyfin.search(term);
      } catch (err) {
        resultsEl.appendChild(el('div', 'empty-state', t('search.failed', { error: err.message })));
        return;
      }
      if (!items.length) {
        resultsEl.appendChild(el('div', 'empty-state', t('search.noResults')));
        return;
      }
      items.forEach((item) => resultsEl.appendChild(buildCard(item, typeToKind(item.Type))));
    }, 300);
  };
}

async function renderAllSongs() {
  if (!allSongsCache) allSongsCache = await jellyfin.getAllSongs(musicLibraryId);
  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('songs.title')));
  if (!allSongsCache.length) {
    viewRoot.appendChild(el('div', 'empty-state', t('songs.empty')));
    return;
  }
  viewRoot.appendChild(buildTrackTable(allSongsCache, allSongsCache));
}

async function renderLikedSongs() {
  const liked = await jellyfin.getLikedSongs();
  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('liked.title')));
  if (!liked.length) {
    viewRoot.appendChild(el('div', 'empty-state', t('liked.empty')));
    return;
  }
  viewRoot.appendChild(buildTrackTable(liked, liked, { isLikedView: true }));
}

async function renderStats() {
  await ensureAllSongsCache();
  const stats = accountStats();
  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('stats.title')));

  if (!stats.totalPlays) {
    viewRoot.appendChild(el('div', 'empty-state', t('stats.empty')));
    return;
  }

  const hours = Math.floor(stats.totalMinutes / 60);
  const mins = stats.totalMinutes % 60;
  const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const summary = el('div', 'stats-summary');
  summary.appendChild(el('div', 'stat-box', `<div class="stat-value">${stats.totalPlays}</div><div class="stat-label">${escapeHtml(t('stats.totalPlays'))}</div>`));
  summary.appendChild(el('div', 'stat-box', `<div class="stat-value">${escapeHtml(timeLabel)}</div><div class="stat-label">${escapeHtml(t('stats.timeListened'))}</div>`));
  summary.appendChild(el('div', 'stat-box', `<div class="stat-value">${stats.topArtists.length}</div><div class="stat-label">${escapeHtml(t('stats.artistsPlayed'))}</div>`));
  viewRoot.appendChild(summary);

  const playsLabel = (count) => t(count === 1 ? 'stats.plays' : 'stats.playsPlural', { count });

  if (stats.topTracks.length) {
    viewRoot.appendChild(el('div', 'section-title', t('stats.topTracks')));
    viewRoot.appendChild(buildCardGrid(stats.topTracks, 'song'));
  }

  const buildRankedList = (rows, labelKey) => {
    const list = el('div', 'stats-list');
    rows.forEach((row, i) => {
      const item = el('div', 'stats-list-row');
      item.innerHTML = `<span class="stats-list-rank">${i + 1}</span><span class="stats-list-name">${escapeHtml(row[labelKey])}</span><span class="stats-list-count">${escapeHtml(playsLabel(row.count))}</span>`;
      list.appendChild(item);
    });
    return list;
  };

  if (stats.topArtists.length) {
    viewRoot.appendChild(el('div', 'section-title', t('stats.topArtists')));
    viewRoot.appendChild(buildRankedList(stats.topArtists, 'artist'));
  }

  if (stats.topAlbums.length) {
    viewRoot.appendChild(el('div', 'section-title', t('stats.topAlbums')));
    viewRoot.appendChild(buildRankedList(stats.topAlbums, 'album'));
  }
}

async function renderAlbums() {
  const albums = await jellyfin.getAlbums(musicLibraryId);
  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('albums.title')));
  if (!albums.length) {
    viewRoot.appendChild(el('div', 'empty-state', t('albums.empty')));
    return;
  }
  viewRoot.appendChild(buildCardGrid(albums, 'album'));
}

async function renderArtists() {
  const artists = await jellyfin.getArtists(musicLibraryId);
  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('artists.title')));
  if (!artists.length) {
    viewRoot.appendChild(el('div', 'empty-state', t('artists.empty')));
    return;
  }
  viewRoot.appendChild(buildCardGrid(artists, 'artist'));
}

// Phone-layout only: the sidebar's categories collapsed into one tappable list.
function renderLibrary() {
  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('nav.library')));
  const grid = el('div', 'card-grid');
  const entries = [
    { view: 'songs', icon: 'fi-br-list-music', label: t('nav.songs') },
    { view: 'liked', icon: 'fi-br-heart', label: t('nav.liked') },
    { view: 'genres', icon: 'fi-br-guitars', label: t('nav.genres') },
    { view: 'albums', icon: 'fi-br-album', label: t('nav.albums') },
    { view: 'artists', icon: 'fi-br-user', label: t('nav.artists') },
    { view: 'stats', icon: 'fi-br-stats', label: t('nav.stats') }
  ];
  entries.forEach(({ view, icon, label }) => {
    const card = el('div', 'card genre-card');
    card.innerHTML = `<i class="fi ${icon}" style="font-size:28px"></i><div class="genre-card-title" style="margin-top:10px">${escapeHtml(label)}</div>`;
    card.addEventListener('click', () => navigateTo({ view }));
    grid.appendChild(card);
  });
  viewRoot.appendChild(grid);

  viewRoot.appendChild(el('div', 'section-title', t('nav.playlists')));
  const plGrid = el('div', 'card-grid');
  viewRoot.appendChild(plGrid);
  jellyfin.getPlaylists().then((playlists) => {
    if (!playlists.length) {
      plGrid.replaceWith(el('div', 'empty-state', t('playlist.sidebarEmpty')));
      return;
    }
    playlists.forEach((pl) => plGrid.appendChild(buildCard(pl, 'playlist')));
  });
}

async function renderGenres() {
  const genres = await jellyfin.getMusicGenres();
  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('genres.title')));
  if (!genres.length) {
    viewRoot.appendChild(el('div', 'empty-state', t('genres.empty')));
    return;
  }
  const grid = el('div', 'card-grid');
  genres.forEach((genre) => {
    const card = el('div', 'card genre-card');
    card.appendChild(el('div', 'genre-card-title', escapeHtml(genre.Name)));
    card.addEventListener('click', () => navigateTo({ view: 'genre', id: genre.Id, name: genre.Name }));
    grid.appendChild(card);
  });
  viewRoot.appendChild(grid);
}

async function renderGenreDetail(id, name) {
  const songs = await jellyfin.getSongsByGenre(id);
  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', name || t('genres.title')));
  if (!songs.length) {
    viewRoot.appendChild(el('div', 'empty-state', t('genres.emptyDetail')));
    return;
  }
  viewRoot.appendChild(buildTrackTable(songs, songs));
}

async function renderPlaylistDetail(id, name) {
  const [playlist, tracks] = await Promise.all([
    jellyfin.getItem(id),
    jellyfin.getPlaylistItems(id)
  ]);
  const displayName = name || playlist.Name;
  viewRoot.innerHTML = '';
  viewRoot.appendChild(buildDetailHeader({
    kind: t('kind.playlist'),
    title: displayName,
    sub: t(tracks.length === 1 ? 'playlist.songCount' : 'playlist.songCountPlural', { count: tracks.length }),
    art: jellyfin.imageUrl(playlist) || (tracks[0] ? artUrl(tracks[0]) : placeholderArt('album')),
    round: false,
    onPlayAll: tracks.length ? () => player.setQueue(tracks, 0, id) : undefined,
    trackIds: tracks.map((t) => t.Id),
    onChangeArt: async (file) => {
      try {
        await jellyfin.uploadPlaylistImage(id, file);
        await loadPlaylistSidebar();
        await renderPlaylistDetail(id, displayName);
      } catch (err) {
        alert(err.message || t('errors.couldNotUploadArt'));
      }
    }
  }));
  if (!tracks.length) {
    viewRoot.appendChild(el('div', 'empty-state', t('playlist.empty')));
    return;
  }
  viewRoot.appendChild(buildTrackTable(tracks, tracks, { sourceId: id, playlistId: id }));
}

async function renderAlbumDetail(id) {
  const tracks = await jellyfin.getAlbumTracks(id);
  const first = tracks[0];
  viewRoot.innerHTML = '';
  viewRoot.appendChild(buildDetailHeader({
    kind: t('kind.album'),
    title: first?.Album || 'Album',
    sub: artistNames(first || {}),
    art: first ? artUrl(first) : placeholderArt('album'),
    round: false,
    onPlayAll: tracks.length ? () => player.setQueue(tracks, 0, id) : undefined,
    trackIds: tracks.map((t) => t.Id)
  }));
  if (!tracks.length) {
    viewRoot.appendChild(el('div', 'empty-state', t('album.empty')));
    return;
  }
  viewRoot.appendChild(buildTrackTable(tracks, tracks, { hideArt: true, sourceId: id }));
}

async function renderArtistDetail(id, name) {
  const [artistItem, albums, songs] = await Promise.all([
    jellyfin.getItem(id),
    jellyfin.getAlbumsByArtist(id),
    jellyfin.getSongsByArtist(id)
  ]);
  viewRoot.innerHTML = '';
  viewRoot.appendChild(buildDetailHeader({
    kind: t('kind.artist'),
    title: name || artistItem.Name || (albums[0] ? artistNames(albums[0]) : (songs[0] ? artistNames(songs[0]) : 'Artist')),
    sub: `${t(songs.length === 1 ? 'playlist.songCount' : 'playlist.songCountPlural', { count: songs.length })} · ${albums.length} ${t('kind.album').toLowerCase()}${albums.length === 1 ? '' : 's'}`,
    art: jellyfin.imageUrl(artistItem, 'Primary') || placeholderArt('artist'),
    round: true,
    onPlayAll: songs.length ? () => player.setQueue(songs, 0, id) : undefined,
    trackIds: songs.map((t) => t.Id)
  }));

  if (!albums.length && !songs.length) {
    viewRoot.appendChild(el('div', 'empty-state', t('artists.empty2')));
    return;
  }

  if (songs.length) {
    viewRoot.appendChild(el('div', 'section-title', t('artists.songsSection')));
    viewRoot.appendChild(buildTrackTable(songs, songs, { sourceId: id }));
  }

  if (albums.length) {
    viewRoot.appendChild(el('div', 'section-title', t('artists.albumsSection')));
    viewRoot.appendChild(buildCardGrid(albums, 'album'));
  }
}

// ---------- Reusable builders ----------
function buildCardGrid(items, kind) {
  const grid = el('div', 'card-grid');
  items.forEach((item) => grid.appendChild(buildCard(item, kind)));
  return grid;
}

// A single horizontally-scrolling row instead of a wrapping grid — for
// sections where the list can get long and a multi-row grid would push
// everything else down the page.
function buildCardRow(items, kind) {
  const wrap = el('div', 'card-row-wrap');
  const row = el('div', 'card-row');
  items.forEach((item) => row.appendChild(buildCard(item, kind)));
  wrap.appendChild(row);

  // Not everyone's mouse has horizontal/tilt scroll — let a normal vertical
  // wheel scroll the row while hovering it, and back that up with visible
  // nav arrows (desktop only; touch already scrolls this natively).
  row.addEventListener('wheel', (evt) => {
    if (evt.deltaY === 0) return;
    evt.preventDefault();
    row.scrollBy({ left: evt.deltaY, behavior: 'auto' });
  }, { passive: false });

  const scrollAmount = () => Math.max(300, row.clientWidth * 0.8);
  const prevBtn = el('button', 'card-row-nav card-row-nav-prev', '<i class="fi fi-br-angle-small-left"></i>');
  prevBtn.type = 'button';
  prevBtn.addEventListener('click', () => row.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
  const nextBtn = el('button', 'card-row-nav card-row-nav-next', '<i class="fi fi-br-angle-small-right"></i>');
  nextBtn.type = 'button';
  nextBtn.addEventListener('click', () => row.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));
  wrap.appendChild(prevBtn);
  wrap.appendChild(nextBtn);

  return wrap;
}

function buildCard(item, kind) {
  const card = el('div', kind === 'artist' ? 'card artist-card' : 'card');
  const artWrap = el('div', 'card-art-wrap');
  const img = document.createElement('img');
  img.className = 'card-art';
  img.src = artUrl(item, kind === 'artist' ? 'artist' : 'album');
  artWrap.appendChild(img);

  if (kind === 'album' || kind === 'playlist' || kind === 'song') {
    const playBtn = el('button', 'card-play-btn');
    playBtn.innerHTML =
      '<svg class="icon-play-all-play" viewBox="0 0 24 24"><path d="M8 5v14l12-7z"/></svg>' +
      '<svg class="icon-play-all-pause" viewBox="0 0 24 24" hidden><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
    playBtn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      if (player.currentTrack && player.queueSourceId === item.Id) player.togglePlay();
      else await playCollection(item, kind);
    });
    artWrap.appendChild(playBtn);

    if (kind === 'album' || kind === 'playlist') {
      cardRegistry.push({ id: item.Id, card, playBtn });
    }
  }
  card.appendChild(artWrap);

  const title = el('div', 'card-title', escapeHtml(formatDisplayName(item.Name) || 'Unknown'));
  card.appendChild(title);

  let subtitle = '';
  if (kind === 'album') subtitle = artistNames(item);
  else if (kind === 'playlist') subtitle = 'Playlist';
  else if (kind === 'artist') subtitle = 'Artist';
  else if (kind === 'song') subtitle = artistNames(item);
  if (subtitle) card.appendChild(el('div', 'card-subtitle', escapeHtml(subtitle)));

  card.addEventListener('click', () => openCollection(item, kind));
  if (kind === 'playlist') wirePlaylistDropTarget(card, item.Id);
  return card;
}

async function openCollection(item, kind) {
  if (kind === 'album') navigateTo({ view: 'album', id: item.Id });
  else if (kind === 'artist') navigateTo({ view: 'artist', id: item.Id, name: formatDisplayName(item.Name) });
  else if (kind === 'playlist') navigateTo({ view: 'playlist', id: item.Id, name: item.Name });
  else if (kind === 'song') {
    if (!allSongsCache) allSongsCache = await jellyfin.getAllSongs(musicLibraryId);
    const idx = allSongsCache.findIndex((t) => t.Id === item.Id);
    if (idx >= 0) player.setQueue(allSongsCache, idx);
    else player.setQueue([item], 0);
  }
}

async function playCollection(item, kind) {
  if (kind === 'album') {
    const tracks = await jellyfin.getAlbumTracks(item.Id);
    if (tracks.length) player.setQueue(tracks, 0, item.Id);
  } else if (kind === 'playlist') {
    const tracks = await jellyfin.getPlaylistItems(item.Id);
    if (tracks.length) player.setQueue(tracks, 0, item.Id);
  } else if (kind === 'song') {
    await openCollection(item, kind);
  }
}

function buildDetailHeader({ kind, title, sub, art, round, onPlayAll, trackIds, onChangeArt }) {
  const wrap = el('div', '');
  const header = el('div', 'detail-header');
  const artWrap = el('div', 'detail-art-wrap');
  const img = document.createElement('img');
  img.className = round ? 'detail-art round' : 'detail-art';
  img.src = art;
  artWrap.appendChild(img);

  if (onChangeArt) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) onChangeArt(fileInput.files[0]);
    });
    const editBtn = el('button', 'detail-art-edit', '<i class="fi fi-br-camera"></i>');
    editBtn.type = 'button';
    editBtn.title = t('track.changeCoverArt');
    editBtn.addEventListener('click', () => fileInput.click());
    artWrap.appendChild(editBtn);
    artWrap.appendChild(fileInput);
  }
  header.appendChild(artWrap);

  const meta = el('div', 'detail-meta');
  meta.appendChild(el('div', 'detail-kind', kind));
  meta.appendChild(el('div', 'detail-title', escapeHtml(title || '')));
  if (sub) meta.appendChild(el('div', 'detail-sub', escapeHtml(sub)));
  header.appendChild(meta);
  wrap.appendChild(header);

  if (onPlayAll) {
    const actions = el('div', 'detail-actions');
    const playBtn = el('button', 'play-all-btn');
    playBtn.innerHTML =
      '<svg class="icon-play-all-play" viewBox="0 0 24 24"><path d="M8 5v14l12-7z"/></svg>' +
      '<svg class="icon-play-all-pause" viewBox="0 0 24 24" hidden><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
    playBtn.addEventListener('click', () => {
      if (player.currentTrack && (trackIds || []).includes(player.currentTrack.Id)) {
        player.togglePlay();
      } else {
        onPlayAll();
      }
    });
    actions.appendChild(playBtn);
    wrap.appendChild(actions);

    playAllBtn = playBtn;
    playAllTrackIds = trackIds || [];
    syncPlayAllButton();
  } else {
    playAllBtn = null;
    playAllTrackIds = [];
  }
  return wrap;
}

// ---------- Offline downloads ----------

function downloadButtonIcon(state) {
  if (state === 'downloading') return '<i class="fi fi-br-spinner track-download-spin"></i>';
  if (state === 'downloaded') return '<i class="fi fi-br-check"></i>';
  return '<i class="fi fi-br-download"></i>';
}

function setDownloadButtonState(btn, state) {
  btn.innerHTML = downloadButtonIcon(state);
  btn.classList.toggle('downloaded', state === 'downloaded');
  btn.classList.toggle('downloading', state === 'downloading');
  btn.title = state === 'downloaded' ? t('track.removeDownload') : t('track.download');
}

function wireDownloadButton(btn, track, row) {
  setDownloadButtonState(btn, isDownloaded(track.Id) ? 'downloaded' : 'idle');
  btn.addEventListener('click', async (evt) => {
    evt.stopPropagation();
    if (isDownloaded(track.Id)) {
      await deleteDownload(track.Id);
      setDownloadButtonState(btn, 'idle');
      if (row) applyOfflineRowState(row, track);
      return;
    }
    setDownloadButtonState(btn, 'downloading');
    try {
      await downloadTrack(track, jellyfin);
      setDownloadButtonState(btn, 'downloaded');
    } catch (err) {
      setDownloadButtonState(btn, 'idle');
      alert(err.message || t('errors.couldNotDownload'));
    }
    if (row) applyOfflineRowState(row, track);
  });
}

// Offline Mode (a Settings toggle, not literal network detection) restricts
// playback to already-downloaded tracks — everything else is visibly
// disabled rather than clickable-but-guaranteed-to-fail.
function applyOfflineRowState(row, track) {
  const unavailable = !!getSettings().offlineMode && !isDownloaded(track.Id);
  row.classList.toggle('offline-unavailable', unavailable);
}

function buildTrackTable(tracks, queueRef, opts = {}) {
  const table = el('table', 'track-table');
  const thead = el('thead', '', `<tr><th style="width:36px">${t('track.index')}</th><th>${t('track.title')}</th><th style="width:26%">${t('track.album')}</th><th style="width:92px"></th><th style="width:60px;text-align:right">${t('track.time')}</th></tr>`);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  tracks.forEach((track, idx) => {
    const row = el('tr', 'track-row');
    row.dataset.id = track.Id;

    const idxCell = el('td', 'track-index');
    idxCell.innerHTML = `<span class="track-index-num">${idx + 1}</span><svg class="track-index-play" viewBox="0 0 24 24" width="14" height="14"><path d="M8 5v14l12-7z"/></svg>`;
    row.appendChild(idxCell);

    const titleCell = document.createElement('td');
    const titleWrap = el('div', 'track-title-cell');
    if (!opts.hideArt) {
      const img = document.createElement('img');
      img.src = artUrl(track);
      titleWrap.appendChild(img);
    }
    const textWrap = el('div', 'track-title-text');
    textWrap.innerHTML = `<span class="t-name">${escapeHtml(track.Name)}</span><span class="t-artist">${escapeHtml(artistNames(track))}</span>`;
    titleWrap.appendChild(textWrap);
    titleCell.appendChild(titleWrap);
    row.appendChild(titleCell);

    row.appendChild(el('td', 'track-album-cell', escapeHtml(track.Album || '')));

    const addCell = el('td', 'track-add-cell');
    const addCellInner = el('div', 'track-add-inner');
    addCell.appendChild(addCellInner);

    const likeBtn = el('button', track.UserData?.IsFavorite ? 'track-add-btn liked' : 'track-add-btn', '<i class="fi fi-br-heart"></i>');
    likeBtn.type = 'button';
    likeBtn.title = t('track.like');
    likeBtn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      const liked = !track.UserData?.IsFavorite;
      likeBtn.classList.toggle('liked', liked);
      track.UserData = { ...(track.UserData || {}), IsFavorite: liked };
      try {
        if (liked) await jellyfin.likeItem(track.Id);
        else await jellyfin.unlikeItem(track.Id);
      } catch (err) {
        likeBtn.classList.toggle('liked', !liked);
        track.UserData.IsFavorite = !liked;
        alert(err.message || t('errors.couldNotUpdateLike'));
      }
    });
    addCellInner.appendChild(likeBtn);

    const addBtn = el('button', 'track-add-btn', '<i class="fi fi-br-add"></i>');
    addBtn.type = 'button';
    addBtn.title = t('track.addToPlaylist');
    addBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      openAddToPlaylistMenu(track, addBtn);
    });
    addCellInner.appendChild(addBtn);

    if (downloadsSupported()) {
      const downloadBtn = el('button', 'track-add-btn track-download-btn');
      downloadBtn.type = 'button';
      wireDownloadButton(downloadBtn, track, row);
      addCellInner.appendChild(downloadBtn);
    }

    row.appendChild(addCell);

    row.appendChild(el('td', 'track-duration', formatTime(ticksToSeconds(track.RunTimeTicks))));

    applyOfflineRowState(row, track);

    row.addEventListener('click', () => {
      if (row.classList.contains('offline-unavailable')) return;
      const startIdx = queueRef.findIndex((t) => t.Id === track.Id);
      player.setQueue(queueRef, startIdx >= 0 ? startIdx : 0);
    });

    // Swipe right always queues the track up next; swipe left's meaning
    // depends on what list this is — remove from playlist, unlike, or
    // (elsewhere, like All Songs/Album) nothing, since there's no sensible
    // "remove" for those.
    let onSwipeLeft = null;
    if (opts.playlistId && track.PlaylistItemId) {
      onSwipeLeft = async () => {
        try {
          await jellyfin.removeFromPlaylist(opts.playlistId, track.PlaylistItemId);
          row.remove();
        } catch (err) {
          alert(err.message || t('errors.couldNotRemoveFromPlaylist'));
        }
      };
    } else if (opts.isLikedView) {
      onSwipeLeft = async () => {
        try {
          await jellyfin.unlikeItem(track.Id);
          row.remove();
        } catch (err) {
          alert(err.message || t('errors.couldNotUpdateLike'));
        }
      };
    }
    wireSwipeActions(row, { onSwipeRight: () => player.enqueue(track), onSwipeLeft });
    wireTrackDragSource(row, track);

    if (isDesktop) {
      row.addEventListener('contextmenu', (evt) => {
        openContextMenu(evt, buildTrackContextMenuItems(track, {
          queueRef,
          anchorEl: row,
          onRemove: onSwipeLeft
        }));
      });
    }

    tbody.appendChild(row);
  });

  table.appendChild(tbody);

  // highlightPlayingRow() only runs on the player's own trackchange event —
  // it never fires just because a table got (re)built, so a freshly rendered
  // view (navigating back to it, or it auto-advancing while you're elsewhere)
  // needs its own sync here or the currently playing row shows unhighlighted.
  const currentId = player?.currentTrack?.Id;
  if (currentId) {
    tbody.querySelectorAll('.track-row').forEach((row) => {
      row.classList.toggle('playing', row.dataset.id === currentId);
    });
  }

  return table;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// Swipe right = onSwipeRight (e.g. add to queue), swipe left = onSwipeLeft
// (e.g. remove) — mobile only. Omit whichever side has no meaningful action
// for a given row (e.g. no swipe-left on a plain "All Songs" row, since
// there's nothing sensible to remove it from) and that direction just won't
// drag. onSwipeLeft is expected to remove the row from the DOM itself (via
// a re-render) once its own async work finishes — this only animates it.
function wireSwipeActions(rowEl, { onSwipeRight, onSwipeLeft } = {}) {
  if (!isMobile || (!onSwipeRight && !onSwipeLeft)) return;
  const THRESHOLD = 70;
  let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false;

  rowEl.style.touchAction = 'pan-y';

  rowEl.addEventListener('touchstart', (evt) => {
    if (evt.touches.length !== 1) return;
    startX = evt.touches[0].clientX;
    startY = evt.touches[0].clientY;
    dx = 0; dragging = true; decided = false; horizontal = false;
  }, { passive: true });

  rowEl.addEventListener('touchmove', (evt) => {
    if (!dragging) return;
    const x = evt.touches[0].clientX;
    const y = evt.touches[0].clientY;
    const rawDx = x - startX;
    if (!decided) {
      if (Math.abs(rawDx) < 8 && Math.abs(y - startY) < 8) return;
      horizontal = Math.abs(rawDx) > Math.abs(y - startY);
      decided = true;
    }
    if (!horizontal) return;
    if ((rawDx > 0 && !onSwipeRight) || (rawDx < 0 && !onSwipeLeft)) return;
    dx = rawDx;
    evt.preventDefault();
    rowEl.style.transform = `translateX(${dx}px)`;
    rowEl.classList.toggle('swipe-queue', dx > 20);
    rowEl.classList.toggle('swipe-remove', dx < -20);
  }, { passive: false });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    rowEl.style.transition = 'transform 0.18s ease';
    if (horizontal && dx > THRESHOLD && onSwipeRight) {
      hapticImpact('light');
      onSwipeRight();
      rowEl.style.transform = 'translateX(0)';
    } else if (horizontal && dx < -THRESHOLD && onSwipeLeft) {
      hapticImpact('medium');
      rowEl.style.transform = 'translateX(-100%)';
      rowEl.style.opacity = '0';
      onSwipeLeft();
    } else {
      rowEl.style.transform = '';
    }
    setTimeout(() => {
      rowEl.style.transition = '';
      rowEl.classList.remove('swipe-queue', 'swipe-remove');
    }, 200);
    dx = 0;
  };
  rowEl.addEventListener('touchend', finish);
  rowEl.addEventListener('touchcancel', finish);
}

// ---------- Player wiring ----------
function wirePlayer() {
  btnPlay.addEventListener('click', () => uiTogglePlay());
  btnPrev.addEventListener('click', () => uiPrevious());
  btnNext.addEventListener('click', () => uiNext());
  btnShuffle.addEventListener('click', () => {
    player.toggleShuffle();
    btnShuffle.classList.toggle('active', player.shuffle);
    mobileBtnShuffle.classList.toggle('active', player.shuffle);
  });
  btnRepeat.addEventListener('click', () => {
    const mode = player.cycleRepeat();
    btnRepeat.classList.toggle('active', mode !== RepeatMode.OFF);
    mobileBtnRepeat.classList.toggle('active', mode !== RepeatMode.OFF);
    const repeatIconClass = mode === RepeatMode.ONE ? 'fi fi-br-arrows-repeat-1' : 'fi fi-br-arrows-repeat';
    iconRepeat.className = repeatIconClass;
    mobileIconRepeat.className = repeatIconClass;
  });

  // Mobile full-screen player controls — same player calls as the desktop ones.
  mobileBtnPlay.addEventListener('click', () => uiTogglePlay());
  mobileBtnPrev.addEventListener('click', () => uiPrevious());
  mobileBtnNext.addEventListener('click', () => uiNext());
  mobileBtnShuffle.addEventListener('click', () => {
    player.toggleShuffle();
    btnShuffle.classList.toggle('active', player.shuffle);
    mobileBtnShuffle.classList.toggle('active', player.shuffle);
  });
  mobileBtnRepeat.addEventListener('click', () => btnRepeat.click());
  mobileSeekBar.addEventListener('input', () => {
    const pct = Number(mobileSeekBar.value);
    mobileSeekBar.style.setProperty('--pct', rangeFillPercent(pct, mobileSeekBar, 12));
  });
  mobileSeekBar.addEventListener('change', () => {
    uiSeekPercent(Number(mobileSeekBar.value));
    mobileSeekBar.style.setProperty('--pct', rangeFillPercent(Number(mobileSeekBar.value), mobileSeekBar, 12));
  });

  // Tapping the mini-player (but not its play button) opens the full-screen panel.
  playerBar.addEventListener('click', (evt) => {
    if (!document.body.classList.contains('platform-mobile') && window.innerWidth > 820) return;
    if (evt.target.closest('#btn-play')) return;
    lyricsPanel.hidden = false;
    showPanelTab(activePanelTab);
  });

  seekBar.addEventListener('input', () => {
    const pct = Number(seekBar.value);
    seekBar.style.setProperty('--pct', rangeFillPercent(pct, seekBar, 14));
  });
  seekBar.addEventListener('change', () => {
    uiSeekPercent(Number(seekBar.value));
    seekBar.style.setProperty('--pct', rangeFillPercent(Number(seekBar.value), seekBar, 14));
  });

  volumeBar.addEventListener('input', () => {
    const val = Number(volumeBar.value);
    uiSetVolumePercent(val);
    volumeBar.style.setProperty('--pct', rangeFillPercent(val, volumeBar, 14));
    updateVolumeIcon(val);
  });

  btnLyrics.addEventListener('click', () => {
    lyricsPanel.hidden = !lyricsPanel.hidden;
    if (!lyricsPanel.hidden) showPanelTab(activePanelTab);
  });
  btnCloseLyrics.addEventListener('click', () => { lyricsPanel.hidden = true; });

  nowPlayingLikeBtn.addEventListener('click', async () => {
    const track = player.currentTrack;
    if (!track) return;
    const liked = !track.UserData?.IsFavorite;
    nowPlayingLikeBtn.classList.toggle('liked', liked);
    track.UserData = { ...(track.UserData || {}), IsFavorite: liked };
    try {
      if (liked) await jellyfin.likeItem(track.Id);
      else await jellyfin.unlikeItem(track.Id);
    } catch (err) {
      nowPlayingLikeBtn.classList.toggle('liked', !liked);
      track.UserData.IsFavorite = !liked;
      alert(err.message || t('errors.couldNotUpdateLike'));
    }
  });

  tabLyrics.addEventListener('click', () => showPanelTab('lyrics'));
  tabQueue.addEventListener('click', () => showPanelTab('queue'));

  player.on('queuechange', () => {
    if (!lyricsPanel.hidden && activePanelTab === 'queue') renderQueue();
  });

  player.on('trackchange', () => {
    const track = player.currentTrack;
    if (!track) return;
    playerBar.hidden = false;
    appRoot.classList.add('has-track');
    const art = artUrl(track);
    playerArt.src = art;
    playerTitle.textContent = track.Name;
    playerArtist.textContent = artistNames(track);
    timeTotal.textContent = formatTime(ticksToSeconds(track.RunTimeTicks));
    seekBar.value = 0;
    seekBar.style.setProperty('--pct', rangeFillPercent(0, seekBar, 14));
    mobileSeekBar.value = 0;
    mobileSeekBar.style.setProperty('--pct', rangeFillPercent(0, mobileSeekBar, 12));
    highlightPlayingRow(track.Id);

    nowPlayingArt.src = artUrl(track, 'album', 800);
    nowPlayingTitle.textContent = track.Name;
    nowPlayingArtist.textContent = artistNames(track);
    nowPlayingLikeBtn.classList.toggle('liked', !!track.UserData?.IsFavorite);
    syncPlayAllButton();
    syncCardStates();
    updateBgArt();
    updateDynamicAccentColor(track);
    updateDiscordPresence();
    syncCatJamVisibility();

    if (!lyricsPanel.hidden) {
      if (activePanelTab === 'lyrics') loadLyricsForCurrentTrack();
      else renderQueue();
    } else {
      currentLyrics = null;
      lyricsTrackId = null;
    }
  });

  // Only fires when a track actually finishes (natural end, gapless swap, or
  // crossfade handoff) — not on a manual skip — so this is what should count
  // as "a play" server-side. Marking it played on Jellyfin's account, rather
  // than tracking locally, is what makes Most Played/On Repeat/stats follow
  // the user across devices.
  player.on('trackended', (track) => {
    if (!track?.Id) return;
    jellyfin.markPlayed(track.Id).then(() => {
      // Optimistic local update so Home/Stats reflect it immediately,
      // without waiting for a full re-fetch of allSongsCache.
      const cached = allSongsCache?.find((tr) => tr.Id === track.Id);
      if (cached) {
        cached.UserData = { ...(cached.UserData || {}), PlayCount: (cached.UserData?.PlayCount || 0) + 1, LastPlayedDate: new Date().toISOString() };
      }
    }).catch(() => {});
  });

  player.on('playstate', () => {
    const playing = !player.audio.paused;
    setHidden(iconPlay, playing);
    setHidden(iconPause, !playing);
    setHidden(mobileIconPlay, playing);
    setHidden(mobileIconPause, !playing);
    syncPlayAllButton();
    syncCardStates();
    updateDiscordPresence();
  });

  player.on('timeupdate', () => {
    // Jellyfin's RunTimeTicks is available immediately from metadata and is
    // always accurate; audio.duration can read as NaN/Infinity or simply be
    // stale for a moment on some Android WebView + transcoded-stream
    // combinations before the media pipeline finishes probing the file.
    const ticksSeconds = ticksToSeconds(player.currentTrack?.RunTimeTicks);
    const audioDuration = player.audio.duration;
    const duration = ticksSeconds || (isFinite(audioDuration) ? audioDuration : 0);
    const current = player.audio.currentTime || 0;
    const pct = duration ? (current / duration) * 100 : 0;
    seekBar.value = pct;
    seekBar.style.setProperty('--pct', rangeFillPercent(pct, seekBar, 14));
    mobileSeekBar.value = pct;
    mobileSeekBar.style.setProperty('--pct', rangeFillPercent(pct, mobileSeekBar, 12));
    timeCurrent.textContent = formatTime(current);
    mobileTimeCurrent.textContent = formatTime(current);
    if (duration) { timeTotal.textContent = formatTime(duration); mobileTimeTotal.textContent = formatTime(duration); }
    updateActiveLyricLine(current);

    // "End of track" sleep timer: pause just short of the natural end so it
    // never lets the next track start, rather than pausing after the fact.
    if (sleepTimerAtEndOfTrack && duration && duration - current < 0.5) {
      player.togglePlay();
      clearSleepTimer();
    }
  });
}

// Quadratic taper: a slider that moves linearly in perceived loudness needs
// the underlying gain to grow with the square of the position, since human
// hearing perceives loudness roughly logarithmically.
// Pushes a full set of 5 band gains into the slider UI + the live player —
// used by preset selection and the reset button, which both replace all
// bands at once (unlike a single slider drag, handled inline where it's wired).
function applyEqGainsToUI(gains) {
  eqBandSliders.forEach((slider) => {
    const band = Number(slider.dataset.band);
    const gain = gains[band] || 0;
    slider.value = gain;
    const valueEl = document.querySelector(`.eq-band-value[data-band-value="${band}"]`);
    if (valueEl) valueEl.textContent = gain > 0 ? `+${gain}` : `${gain}`;
    player?.setEqualizerBand(band, gain);
  });
}

function sliderToVolume(pos) {
  const t = Math.max(0, Math.min(100, pos)) / 100;
  return t * t;
}

function updateVolumeIcon(val) {
  let iconClass;
  if (val <= 0) iconClass = 'fi-br-volume-slash';
  else if (val <= 33) iconClass = 'fi-br-volume-off';
  else if (val <= 66) iconClass = 'fi-br-volume-down';
  else iconClass = 'fi-br-volume';
  volumeIcon.className = 'volume-icon fi ' + iconClass;
}

let activeAddMenu = null;

async function openAddToPlaylistMenu(track, anchorEl) {
  closeAddToPlaylistMenu();

  const menu = el('div', 'account-menu add-playlist-menu');
  const rect = anchorEl.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 216)}px`;
  menu.appendChild(el('div', 'account-menu-name', t('track.addToPlaylist')));

  const playlists = await jellyfin.getPlaylists();
  if (!playlists.length) {
    menu.appendChild(el('div', 'playlist-empty', t('playlist.sidebarEmpty')));
  } else {
    playlists.forEach((pl) => {
      const item = el('button', '', escapeHtml(pl.Name));
      item.type = 'button';
      item.addEventListener('click', async () => {
        try {
          await jellyfin.addToPlaylist(pl.Id, track.Id);
        } catch (err) {
          alert(err.message || t('errors.couldNotAddToPlaylist'));
        }
        closeAddToPlaylistMenu();
      });
      menu.appendChild(item);
    });
  }

  document.body.appendChild(menu);
  activeAddMenu = menu;

  setTimeout(() => {
    document.addEventListener('click', closeAddToPlaylistMenu, { once: true });
  }, 0);
}

function closeAddToPlaylistMenu() {
  if (activeAddMenu) {
    activeAddMenu.remove();
    activeAddMenu = null;
  }
}

// ---------- Drag-and-drop a track onto a playlist (desktop) ----------
const TRACK_DND_TYPE = 'application/x-jellywave-track-id';

function wireTrackDragSource(row, track) {
  if (!isDesktop) return;
  row.draggable = true;
  row.addEventListener('dragstart', (evt) => {
    evt.dataTransfer.setData(TRACK_DND_TYPE, track.Id);
    evt.dataTransfer.effectAllowed = 'copy';
    row.classList.add('dragging-source');
  });
  row.addEventListener('dragend', () => row.classList.remove('dragging-source'));
}

function wirePlaylistDropTarget(target, playlistId) {
  if (!isDesktop) return;
  target.addEventListener('dragover', (evt) => {
    if (!evt.dataTransfer.types.includes(TRACK_DND_TYPE)) return;
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy';
    target.classList.add('drop-target-active');
  });
  target.addEventListener('dragleave', () => target.classList.remove('drop-target-active'));
  target.addEventListener('drop', async (evt) => {
    if (!evt.dataTransfer.types.includes(TRACK_DND_TYPE)) return;
    evt.preventDefault();
    target.classList.remove('drop-target-active');
    const trackId = evt.dataTransfer.getData(TRACK_DND_TYPE);
    if (!trackId) return;
    try {
      await jellyfin.addToPlaylist(playlistId, trackId);
    } catch (err) {
      alert(err.message || t('errors.couldNotAddToPlaylist'));
    }
  });
}

// ---------- Right-click context menus (desktop) ----------
let activeContextMenu = null;

function closeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

// items: array of { label, icon, danger, onClick } or the string 'separator'.
function openContextMenu(evt, items) {
  evt.preventDefault();
  evt.stopPropagation();
  closeContextMenu();
  closeAddToPlaylistMenu();

  const menu = el('div', 'account-menu context-menu');
  items.forEach((item) => {
    if (item === 'separator') { menu.appendChild(el('div', 'context-menu-sep')); return; }
    const btn = el('button', item.danger ? 'danger' : '', `<i class="fi ${item.icon}"></i><span>${escapeHtml(item.label)}</span>`);
    btn.type = 'button';
    btn.addEventListener('click', () => { closeContextMenu(); item.onClick(); });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(evt.clientX, window.innerWidth - width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(evt.clientY, window.innerHeight - height - 8))}px`;
  activeContextMenu = menu;

  setTimeout(() => {
    document.addEventListener('click', closeContextMenu, { once: true });
  }, 0);
}

// Shared menu contents for a single track — used by both track-table rows
// and queue rows. `queueCtx` carries the queue this track lives in (so
// "Play" can start the right list) plus optional playlist/queue-removal info.
function buildTrackContextMenuItems(track, queueCtx = {}) {
  const items = [];
  items.push({
    label: t('player.play'),
    icon: 'fi-br-play',
    onClick: queueCtx.onPlay || (() => {
      const list = queueCtx.queueRef || [track];
      const startIdx = list.findIndex((tr) => tr.Id === track.Id);
      player.setQueue(list, startIdx >= 0 ? startIdx : 0);
    })
  });
  items.push({
    label: t('queue.addToQueue'),
    icon: 'fi-br-list-music',
    onClick: () => player.enqueue(track)
  });
  items.push({
    label: track.UserData?.IsFavorite ? t('queue.unlike') : t('track.like'),
    icon: 'fi-br-heart',
    onClick: async () => {
      const liked = !track.UserData?.IsFavorite;
      track.UserData = { ...(track.UserData || {}), IsFavorite: liked };
      try {
        if (liked) await jellyfin.likeItem(track.Id);
        else await jellyfin.unlikeItem(track.Id);
        syncCardStates();
      } catch (err) {
        track.UserData.IsFavorite = !liked;
        alert(err.message || t('errors.couldNotUpdateLike'));
      }
    }
  });
  items.push({
    label: t('track.addToPlaylist'),
    icon: 'fi-br-add',
    onClick: (evt) => openAddToPlaylistMenu(track, queueCtx.anchorEl || document.body)
  });
  if (downloadsSupported()) {
    const downloaded = isDownloaded(track.Id);
    items.push({
      label: downloaded ? t('track.removeDownload') : t('track.download'),
      icon: downloaded ? 'fi-br-trash' : 'fi-br-download',
      onClick: async () => {
        try {
          if (downloaded) await deleteDownload(track.Id);
          else await downloadTrack(track, jellyfin);
        } catch (err) {
          alert(err.message || t('errors.couldNotDownload'));
        }
      }
    });
  }
  items.push('separator');
  if (track.AlbumId) {
    items.push({ label: t('kind.album'), icon: 'fi-br-album', onClick: () => navigateTo({ view: 'album', id: track.AlbumId }) });
  }
  if (track.ArtistItems?.length) {
    const artist = track.ArtistItems[0];
    items.push({ label: t('kind.artist'), icon: 'fi-br-user', onClick: () => navigateTo({ view: 'artist', id: artist.Id, name: formatDisplayName(artist.Name) }) });
  }
  if (queueCtx.onRemove) {
    items.push('separator');
    items.push({ label: t('queue.remove'), icon: 'fi-br-trash', danger: true, onClick: queueCtx.onRemove });
  }
  return items;
}

function showPanelTab(tab) {
  activePanelTab = tab;
  tabLyrics.classList.toggle('active', tab === 'lyrics');
  tabQueue.classList.toggle('active', tab === 'queue');
  setHidden(lyricsBody, tab !== 'lyrics');
  setHidden(queueBody, tab !== 'queue');
  if (tab === 'lyrics') loadLyricsForCurrentTrack();
  else renderQueue();
}

function buildQueueRow(track, idx, isPlaying) {
  const row = el('div', isPlaying ? 'queue-row playing' : 'queue-row');
  row.dataset.idx = idx;
  const img = document.createElement('img');
  img.src = artUrl(track);
  row.appendChild(img);
  const text = el('div', 'queue-row-text');
  text.innerHTML = `<div class="queue-row-title">${escapeHtml(track.Name)}</div><div class="queue-row-artist">${escapeHtml(artistNames(track))}</div>`;
  row.appendChild(text);
  row.addEventListener('click', () => player.playAt(idx));

  // Can't remove/reorder what's currently playing this way — only "Up Next" rows.
  if (!isPlaying) {
    wireSwipeActions(row, {
      // Delay the actual removal slightly so the slide-out animation has
      // time to play before renderQueue() (triggered by queuechange) wipes
      // and rebuilds the whole list out from under it.
      onSwipeLeft: () => setTimeout(() => player.removeFromQueueAt(idx), 180)
    });
    const handle = el('div', 'queue-row-handle', '<i class="fi fi-br-grip-dots-vertical"></i>');
    handle.addEventListener('click', (evt) => evt.stopPropagation());
    row.appendChild(handle);
    wireQueueDragHandle(handle, row);
  }

  if (isDesktop) {
    row.addEventListener('contextmenu', (evt) => {
      openContextMenu(evt, buildTrackContextMenuItems(track, {
        onPlay: () => player.playAt(idx),
        anchorEl: row,
        onRemove: isPlaying ? null : () => player.removeFromQueueAt(idx)
      }));
    });
  }

  return row;
}

// Drag-to-reorder via a dedicated handle (rather than the whole row) so it
// never has to be disambiguated from the swipe-to-remove gesture on the
// same row — Pointer Events unify mouse (desktop) and touch (mobile).
function wireQueueDragHandle(handle, row) {
  handle.addEventListener('pointerdown', (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    const startY = evt.clientY;
    const fromIdx = Number(row.dataset.idx);
    let currentToIdx = fromIdx;
    row.classList.add('dragging');
    handle.setPointerCapture(evt.pointerId);

    const onMove = (moveEvt) => {
      const dy = moveEvt.clientY - startY;
      row.style.transform = `translateY(${dy}px)`;
      row.style.zIndex = '10';

      // Swap DOM position with whichever sibling row the dragged row's
      // center has now crossed, live, so the list visibly reshuffles as you
      // drag rather than only snapping into place on release.
      const siblings = [...row.parentElement.querySelectorAll('.queue-row:not(.playing)')];
      const rowRect = row.getBoundingClientRect();
      const rowCenter = rowRect.top + rowRect.height / 2;
      for (const sibling of siblings) {
        if (sibling === row) continue;
        const sibRect = sibling.getBoundingClientRect();
        const sibCenter = sibRect.top + sibRect.height / 2;
        const sibIdx = Number(sibling.dataset.idx);
        const movingDown = currentToIdx < sibIdx;
        const crossed = movingDown ? rowCenter > sibCenter : rowCenter < sibCenter;
        if (crossed) {
          if (movingDown) sibling.parentElement.insertBefore(row, sibling.nextSibling);
          else sibling.parentElement.insertBefore(row, sibling);
          currentToIdx = sibIdx;
          break;
        }
      }
    };

    const onUp = () => {
      handle.releasePointerCapture(evt.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      row.classList.remove('dragging');
      row.style.transform = '';
      row.style.zIndex = '';
      if (currentToIdx !== fromIdx) {
        hapticImpact('light');
        player.reorderQueueAt(fromIdx, currentToIdx);
      }
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  });
}

function renderQueue() {
  queueBody.innerHTML = '';
  if (!player.queue.length) {
    queueBody.appendChild(el('div', 'queue-empty', 'Queue is empty.'));
    return;
  }

  const current = player.currentTrack;
  if (current) {
    queueBody.appendChild(el('div', 'queue-section-title', 'Now Playing'));
    queueBody.appendChild(buildQueueRow(current, player.currentIndex, true));
  }

  // Only what's actually next in play order — the queue array is already in
  // shuffled order when shuffle is on, so slicing after currentIndex is correct.
  const upNext = player.queue.slice(player.currentIndex + 1);
  if (upNext.length) {
    queueBody.appendChild(el('div', 'queue-section-title', 'Up Next'));
    upNext.forEach((track, offset) => {
      queueBody.appendChild(buildQueueRow(track, player.currentIndex + 1 + offset, false));
    });
  }
}

function highlightPlayingRow(trackId) {
  document.querySelectorAll('.track-row').forEach((row) => {
    row.classList.toggle('playing', row.dataset.id === trackId);
  });
}

async function loadLyricsForCurrentTrack() {
  const track = player.currentTrack;
  if (!track) return;
  if (lyricsTrackId === track.Id && currentLyrics) return;
  lyricsTrackId = track.Id;
  lyricsBody.innerHTML = '<div class="lyrics-empty">Looking up lyrics…</div>';
  const result = await fetchLyrics({
    title: track.Name,
    artist: artistNames(track),
    album: track.Album,
    durationSeconds: ticksToSeconds(track.RunTimeTicks)
  });

  if (lyricsTrackId !== track.Id) return; // track changed while fetching
  currentLyrics = result;

  if (!result || (!result.synced && !result.plain)) {
    lyricsBody.innerHTML = '<div class="lyrics-empty">No lyrics found for this track.</div>';
    return;
  }

  lyricsBody.innerHTML = '';
  if (result.synced && result.synced.length) {
    result.synced.forEach((line) => {
      const p = el('p', 'lyric-line', escapeHtml(line.text || ' '));
      p.dataset.time = line.time;
      p.addEventListener('click', () => player.seekTo(line.time));
      lyricsBody.appendChild(p);
    });
  } else if (result.plain) {
    result.plain.split('\n').forEach((line) => {
      lyricsBody.appendChild(el('p', 'lyric-line', escapeHtml(line || ' ')));
    });
  }
}

function updateActiveLyricLine(currentTime) {
  if (lyricsPanel.hidden || !currentLyrics || !currentLyrics.synced) return;
  const lines = lyricsBody.querySelectorAll('.lyric-line');
  if (!lines.length) return;
  let activeIdx = -1;
  lines.forEach((line, i) => {
    const t = Number(line.dataset.time);
    if (!isNaN(t) && t <= currentTime) activeIdx = i;
  });
  lines.forEach((line, i) => line.classList.toggle('active', i === activeIdx));
  if (activeIdx >= 0) {
    lines[activeIdx].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

init();
