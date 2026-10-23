import { useEffect, useState } from 'react';

export const REPO = 'greenythebeany/triptych';
export const GITHUB = `https://github.com/${REPO}`;
export const RELEASES = `${GITHUB}/releases/latest`;
export const ISSUES = `${GITHUB}/issues`;
export const JELLYFIN = 'https://jellyfin.org/downloads/server';
export const SITE = 'https://greenybeany.dev/triptych/';
export const BASE = import.meta.env.BASE_URL;

// Public files, with the build id appended so a deploy replaces cached copies.
export const media = (file) => `${BASE}media/${file}?v=${__BUILD__}`;

// Latest release from the GitHub API, for the version label and direct
// download links. Falls back to the releases page if it can't be reached.
export function useLatestRelease() {
  const [release, setRelease] = useState(null);
  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setRelease(data))
      .catch(() => {});
  }, []);
  const asset = (test) => release?.assets?.find((a) => test(a.name))?.browser_download_url || RELEASES;
  return {
    version: release?.tag_name || null,
    windows: asset((n) => /setup.*\.exe$/i.test(n)),
    android: asset((n) => /\.apk$/i.test(n)),
    appimage: asset((n) => /\.appimage$/i.test(n)),
    snap: asset((n) => /\.snap$/i.test(n)),
    ipa: asset((n) => /\.ipa$/i.test(n))
  };
}

// Animations on or off: the navbar switch, remembered in this browser.
// <html class="still"> is set before the first paint by index.html.
export const MOTION_KEY = 'triptych-motion';
export const motionOff = () => typeof document !== 'undefined' && document.documentElement.classList.contains('still');
export function setMotion(on) {
  document.documentElement.classList.toggle('still', !on);
  try { localStorage.setItem(MOTION_KEY, on ? 'on' : 'off'); } catch { /* storage blocked: this visit only */ }
  dispatchEvent(new CustomEvent('triptych:motion', { detail: on }));
}
