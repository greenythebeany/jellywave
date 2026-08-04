import { JellyfinClient } from './jellyfin.js';
import { Player, RepeatMode } from './player.js';
import { fetchLyrics } from './lyrics.js';
import { getSettings, updateSettings, applySettings, currentBitrateKbps, PALETTES, AUDIO_QUALITIES } from './settings.js';
import { LOCALES, loadLocale, applyTranslations, t } from './i18n.js';
import { platform, isDesktop, isMobile, sessionStore, windowControls, wireHardwareBackButton, exitApp, requestNotificationPermission, setDiscordActivity, clearDiscordActivity } from './platform.js';

// ---------- DOM refs ----------
const loginScreen = document.getElementById('login-screen');
const appRoot = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const btnLogin = document.getElementById('btn-login');

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
const crossfadeSlider = document.getElementById('crossfade-slider');
const crossfadeValue = document.getElementById('crossfade-value');
const toggleReplayGain = document.getElementById('toggle-replaygain');
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
  volumeBar.style.setProperty('--pct', '50%');
  updateVolumeIcon(50);
  await loadLocale(getSettings().language);
  applyTranslations();
  customCssStyle.textContent = getSettings().customCss || '';
  wireSettingsUI();
  wireCreatePlaylistUI();
  wireBackButton();

  const saved = await sessionStore.load();
  if (saved && saved.serverUrl && saved.accessToken && saved.userId) {
    jellyfin = new JellyfinClient(saved);
    try {
      await jellyfin.ping();
      await enterApp(saved.username);
      return;
    } catch (err) {
      jellyfin = null;
    }
  }
  showLogin();
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
loginForm.addEventListener('submit', async (evt) => {
  evt.preventDefault();
  loginError.hidden = true;
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

  crossfadeSlider.addEventListener('input', () => {
    const seconds = Number(crossfadeSlider.value);
    crossfadeValue.textContent = seconds === 0 ? 'Off' : `${seconds}s`;
    crossfadeSlider.style.setProperty('--pct', rangeFillPercent((seconds / 12) * 100, crossfadeSlider, 13));
    player?.setCrossfadeSeconds(seconds);
  });
  crossfadeSlider.addEventListener('change', () => {
    updateSettings({ crossfadeSeconds: Number(crossfadeSlider.value) });
  });

  toggleReplayGain.addEventListener('change', () => {
    updateSettings({ replayGainEnabled: toggleReplayGain.checked });
    player?.setReplayGainEnabled(toggleReplayGain.checked);
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

// Discord Rich Presence — no-op on mobile/web (see setDiscordActivity).
// Discord only embeds Rich Presence images served over HTTPS, so a
// Jellyfin server on plain HTTP (typical for a LAN-only setup) can't be used
// directly as the cover art source. Instead, look the album up on iTunes'
// search API (HTTPS, no key required, sends proper CORS headers) by artist +
// album name and use its artwork — falling back to the static logo asset
// when nothing matches.
const externalCoverArtCache = new Map(); // "artist|album" (lowercased) -> url or null

async function fetchExternalCoverArt(artist, album) {
  const key = `${artist}|${album}`.toLowerCase();
  if (externalCoverArtCache.has(key)) return externalCoverArtCache.get(key);
  let url = null;
  try {
    const query = encodeURIComponent(`${artist} ${album}`.trim());
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=album&limit=1`);
    const data = await res.json();
    const artwork = data.results?.[0]?.artworkUrl100;
    if (artwork) url = artwork.replace('100x100bb', '512x512bb');
  } catch (err) {
    // No network / no match — fall back to the logo below.
  }
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
  fetchExternalCoverArt(artist, album).then((art) => {
    if (!art || player?.currentTrack?.Id !== trackIdAtCall || player.audio.paused) return;
    setDiscordActivity(buildActivity(art));
  });
}

function refreshSettingsUI() {
  const s = getSettings();
  languageSelect.value = s.language;
  toggleArtBackground.checked = !!s.artBackground;
  crossfadeSlider.value = s.crossfadeSeconds || 0;
  crossfadeValue.textContent = s.crossfadeSeconds ? `${s.crossfadeSeconds}s` : 'Off';
  crossfadeSlider.style.setProperty('--pct', rangeFillPercent(((s.crossfadeSeconds || 0) / 12) * 100, crossfadeSlider, 13));
  toggleReplayGain.checked = !!s.replayGainEnabled;
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
      default: await renderHome();
    }
  } catch (err) {
    viewRoot.innerHTML = `<div class="empty-state">Something went wrong: ${err.message}</div>`;
    return;
  }
  syncCardStates();
}

// ---------- Views ----------
async function renderHome() {
  const [playlists, albums] = await Promise.all([
    jellyfin.getPlaylists(),
    jellyfin.getAlbums(musicLibraryId)
  ]);

  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('home.greeting')));

  if (playlists.length) {
    viewRoot.appendChild(el('div', 'section-title', 'Your Playlists'));
    viewRoot.appendChild(buildCardGrid(playlists.slice(0, 12), 'playlist'));
  }

  viewRoot.appendChild(el('div', 'section-title', 'Recently Added Albums'));
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
  viewRoot.appendChild(buildTrackTable(liked, liked));
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
    { view: 'artists', icon: 'fi-br-user', label: t('nav.artists') }
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
  viewRoot.appendChild(buildTrackTable(tracks, tracks, { sourceId: id }));
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

function buildTrackTable(tracks, queueRef, opts = {}) {
  const table = el('table', 'track-table');
  const thead = el('thead', '', `<tr><th style="width:36px">${t('track.index')}</th><th>${t('track.title')}</th><th style="width:26%">${t('track.album')}</th><th style="width:64px"></th><th style="width:60px;text-align:right">${t('track.time')}</th></tr>`);
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
    row.appendChild(addCell);

    row.appendChild(el('td', 'track-duration', formatTime(ticksToSeconds(track.RunTimeTicks))));

    row.addEventListener('click', () => {
      const startIdx = queueRef.findIndex((t) => t.Id === track.Id);
      player.setQueue(queueRef, startIdx >= 0 ? startIdx : 0);
    });

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

// ---------- Player wiring ----------
function wirePlayer() {
  btnPlay.addEventListener('click', () => player.togglePlay());
  btnPrev.addEventListener('click', () => player.previous());
  btnNext.addEventListener('click', () => player.next(true));
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
  mobileBtnPlay.addEventListener('click', () => player.togglePlay());
  mobileBtnPrev.addEventListener('click', () => player.previous());
  mobileBtnNext.addEventListener('click', () => player.next(true));
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
    const duration = player.audio.duration || 0;
    player.seekTo((Number(mobileSeekBar.value) / 100) * duration);
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
    const duration = player.audio.duration || 0;
    player.seekTo((Number(seekBar.value) / 100) * duration);
    seekBar.style.setProperty('--pct', rangeFillPercent(Number(seekBar.value), seekBar, 14));
  });

  volumeBar.addEventListener('input', () => {
    const val = Number(volumeBar.value);
    player.setVolume(sliderToVolume(val));
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
    updateDiscordPresence();

    if (!lyricsPanel.hidden) {
      if (activePanelTab === 'lyrics') loadLyricsForCurrentTrack();
      else renderQueue();
    } else {
      currentLyrics = null;
      lyricsTrackId = null;
    }
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
  });
}

// Quadratic taper: a slider that moves linearly in perceived loudness needs
// the underlying gain to grow with the square of the position, since human
// hearing perceives loudness roughly logarithmically.
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
  const img = document.createElement('img');
  img.src = artUrl(track);
  row.appendChild(img);
  const text = el('div', 'queue-row-text');
  text.innerHTML = `<div class="queue-row-title">${escapeHtml(track.Name)}</div><div class="queue-row-artist">${escapeHtml(artistNames(track))}</div>`;
  row.appendChild(text);
  row.addEventListener('click', () => player.playAt(idx));
  return row;
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
