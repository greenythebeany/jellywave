const STORAGE_KEY = 'jellywave:settings';

export const PALETTES = {
  jellyfin: { label: 'Jellyfin', accent: '#00a4dc', accentHover: '#22b8ec' },
  spotify: { label: 'Spotify', accent: '#1ed760', accentHover: '#3be275' },
  purple: { label: 'Purple', accent: '#aa5cc3', accentHover: '#bd74d4' },
  mono: { label: 'Monochrome', accent: '#e6e6e6', accentHover: '#ffffff' }
};

export const AUDIO_QUALITIES = {
  auto: { label: 'Automatic (best available)', bitrateKbps: 0 },
  high: { label: 'High — 320 kbps', bitrateKbps: 320 },
  medium: { label: 'Medium — 192 kbps', bitrateKbps: 192 },
  low: { label: 'Low — 96 kbps', bitrateKbps: 96 }
};

const DEFAULTS = {
  themeMode: 'dark', // 'dark' | 'light' | 'system'
  palette: 'jellyfin',
  audioQuality: 'auto',
  artBackground: false,
  dynamicAccentColor: false,
  language: 'en_US',
  customCss: '',
  crossfadeSeconds: 0, // 0-12, 0 = off (gapless preloading is always on regardless)
  replayGainEnabled: false,
  catJam: false,
  catJamScale: 1, // 0.5-3, multiplier on the cat's base 110px size
  eqEnabled: false,
  eqGains: [0, 0, 0, 0, 0], // dB, one per EQ_BANDS entry in player.js, -12 to 12
  eqPreset: 'flat',
  loudnessBoostPct: 25, // Android-only native volume boost, 0-50 (50 = 150% volume), 0 = off
  offlineMode: false, // when on, only downloaded tracks are playable/clickable
  updatedAt: 0 // bumped on every local change — lets initRemoteSync tell
  // whether this device's settings or the server's saved copy is newer
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

let current = load();
const listeners = [];

// Set once logged in (see initRemoteSync) — updateSettings() pushes to the
// server through this from then on. Settings applied before login (or when
// offline) just stay local until a sync is possible.
let jellyfinClient = null;
let pushTimer = null;

export function getSettings() {
  return current;
}

export function onSettingsChange(callback) {
  listeners.push(callback);
}

export function updateSettings(patch) {
  current = { ...current, ...patch, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  applySettings();
  listeners.forEach((cb) => cb(current));
  schedulePush();
}

// Debounced so rapid successive changes (e.g. dragging then nudging a
// slider a couple more times) collapse into one request instead of one per
// change — best-effort throughout, a failed/offline push just means this
// device's settings stay local until the next successful sync.
function schedulePush() {
  if (!jellyfinClient) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    jellyfinClient.saveSyncedSettings(current).catch(() => {});
  }, 1500);
}

// Called once after login (see app.js's enterApp), which awaits this
// before showing the app — a hung fetch on a slow/degraded connection
// (as opposed to no connection at all, which fails fast) would otherwise
// stall app entry indefinitely, so this gives up and falls back to local
// settings after a few seconds rather than risk that.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))
  ]);
}

// Whichever side — this device's local settings, or whatever's saved on
// the server — has the newer updatedAt wins; the other side then adopts
// it, so the same tuning (EQ, theme, loudness boost, etc.) follows the
// account across devices instead of being stuck per-install.
export async function initRemoteSync(client) {
  jellyfinClient = client;
  try {
    const remote = await withTimeout(client.getSyncedSettings(), 4000);
    if (remote && (remote.updatedAt || 0) > (current.updatedAt || 0)) {
      current = { ...DEFAULTS, ...remote };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      applySettings();
      listeners.forEach((cb) => cb(current));
    } else {
      client.saveSyncedSettings(current).catch(() => {});
    }
  } catch (err) {
    // Offline/unreachable at login — already-applied local settings are
    // unaffected, this device just isn't synced for this session.
  }
}

function resolvedThemeMode() {
  if (current.themeMode === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return current.themeMode;
}

export function applySettings() {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolvedThemeMode());
  root.setAttribute('data-palette', current.palette);
}

export function currentBitrateKbps() {
  return AUDIO_QUALITIES[current.audioQuality]?.bitrateKbps || 0;
}

applySettings();
