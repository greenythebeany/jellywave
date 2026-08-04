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
  language: 'en_US',
  customCss: '',
  crossfadeSeconds: 0, // 0-12, 0 = off (gapless preloading is always on regardless)
  replayGainEnabled: false,
  catJam: false,
  catJamScale: 1 // 0.5-3, multiplier on the cat's base 110px size
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

export function getSettings() {
  return current;
}

export function onSettingsChange(callback) {
  listeners.push(callback);
}

export function updateSettings(patch) {
  current = { ...current, ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  applySettings();
  listeners.forEach((cb) => cb(current));
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
