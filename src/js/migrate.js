// One-time move from the JellyWave names (before 2.3) to Triptych. Imported
// first in app.js, so it runs before any module reads its storage at load.
// On desktop the data folder itself is moved by main.js; this renames the
// localStorage keys inside it and points downloaded files at the new folder.
// Phones get a new app id in 2.3, so there is nothing to carry over there.

const OLD_PREFIX = 'jellywave:';
const NEW_PREFIX = 'triptych:';

function migrateLocalStorage() {
  let keys;
  try {
    keys = Object.keys(localStorage);
  } catch (err) {
    return; // storage unavailable (private mode etc.)
  }
  for (const key of keys) {
    let newKey = null;
    if (key.startsWith(OLD_PREFIX)) newKey = NEW_PREFIX + key.slice(OLD_PREFIX.length);
    else if (key === 'jellywave_session') newKey = 'triptych_session';
    if (!newKey) continue;
    try {
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, localStorage.getItem(key));
      localStorage.removeItem(key);
    } catch (err) { /* leave it; the old key stays readable next time */ }
  }
}

// Desktop downloads are indexed by absolute path, e.g.
// C:\Users\x\AppData\Roaming\JellyWave\downloads\<id>.mp3.
function migrateDownloadPaths() {
  const key = `${NEW_PREFIX}downloads`;
  let index;
  try {
    index = JSON.parse(localStorage.getItem(key) || 'null');
  } catch (err) {
    return;
  }
  if (!index || typeof index !== 'object') return;
  const fix = (p) => (typeof p === 'string' ? p.replace(/([\\/])JellyWave([\\/]downloads[\\/])/i, '$1Triptych$2') : p);
  let changed = false;
  for (const entry of Object.values(index)) {
    if (!entry) continue;
    const path = fix(entry.path);
    const imagePath = fix(entry.imagePath);
    if (path !== entry.path || imagePath !== entry.imagePath) {
      entry.path = path;
      entry.imagePath = imagePath;
      changed = true;
    }
  }
  if (changed) {
    try { localStorage.setItem(key, JSON.stringify(index)); } catch (err) { /* ignore */ }
  }
}

migrateLocalStorage();
migrateDownloadPaths();
// The lyrics search index is a rebuildable cache: drop the old one.
try { indexedDB.deleteDatabase('jellywave-lyrics'); } catch (err) { /* ignore */ }
