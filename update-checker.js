// Update checks + in-app download/install from GitHub releases (same
// approach as BeanyIK's updater.js). Instead of sending the user to the
// release page to run the installer by hand while JellyWave is still open,
// the installer is downloaded here, verified, started, and JellyWave quits
// itself so the installer never has to fight a running instance.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const REPO = 'greenythebeany/jellywave';
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'JellyWave-updater' };

function parseSemver(str) {
  const m = String(str || '').match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function isNewer(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

// JELLYWAVE_PRETEND_VERSION lets you test the updater from a dev build.
const currentVersion = () => process.env.JELLYWAVE_PRETEND_VERSION || app.getVersion();

let lastRelease = null;

async function checkForUpdates() {
  const res = await fetch(API_URL, { headers: HEADERS });
  if (res.status === 404) return { status: 'up-to-date', current: currentVersion() };
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const release = await res.json();

  const latest = parseSemver(release.tag_name) || parseSemver(release.name);
  const current = parseSemver(currentVersion());
  if (!latest || !current || !isNewer(latest, current)) return { status: 'up-to-date', current: currentVersion() };

  const assets = release.assets || [];
  // GitHub turns the spaces in "JellyWave Setup 1.2.3.exe" into dots.
  const asset = process.platform === 'win32' ? assets.find((a) => /setup.*\.exe$/i.test(a.name)) : null;
  const yml = assets.find((a) => a.name === 'latest.yml');
  lastRelease = { asset, yml, version: latest.join('.') };

  return {
    status: 'available',
    version: latest.join('.'),
    current: currentVersion(),
    url: release.html_url,
    // Only installs in place when packaged and there's an installer to grab;
    // otherwise the UI falls back to the release page link.
    canInstall: app.isPackaged && !!asset,
    size: asset?.size || 0
  };
}

// sha512 for the installer from electron-builder's latest.yml, if the
// release has one attached.
async function expectedSha512(name) {
  if (!lastRelease?.yml) return null;
  try {
    const text = await (await fetch(lastRelease.yml.browser_download_url, { headers: { 'User-Agent': HEADERS['User-Agent'] } })).text();
    // latest.yml names the file with spaces/dashes, the release asset with dots.
    const plain = (s) => s.replace(/[\s.-]+/g, '').toLowerCase();
    const block = text.split(/\n(?=\s*- url:)/).find((b) => plain(b).includes(plain(name)));
    const m = /sha512:\s*(\S+)/.exec(block || text);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

let downloading = null;

async function downloadUpdate(onProgress) {
  if (!lastRelease?.asset) throw new Error('No installer found for this update');
  if (downloading) return downloading;
  const { asset } = lastRelease;
  downloading = (async () => {
    const dir = path.join(app.getPath('temp'), 'JellyWave-update');
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, asset.name);
    const partial = `${target}.part`;

    const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
    const total = Number(res.headers.get('content-length')) || asset.size || 0;
    const hash = crypto.createHash('sha512');
    const out = fs.createWriteStream(partial);
    let received = 0;
    let lastSent = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      hash.update(value);
      if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
      const now = Date.now();
      if (now - lastSent > 100) { lastSent = now; onProgress?.({ received, total }); }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    onProgress?.({ received, total });

    if (asset.size && received !== asset.size) {
      fs.rmSync(partial, { force: true });
      throw new Error('Downloaded file is incomplete');
    }
    const sha = await expectedSha512(asset.name);
    if (sha && hash.digest('base64') !== sha) {
      fs.rmSync(partial, { force: true });
      throw new Error('Downloaded file failed the checksum check');
    }
    fs.rmSync(target, { force: true });
    fs.renameSync(partial, target);
    return { file: target, verified: !!sha };
  })();
  try {
    return await downloading;
  } finally {
    downloading = null;
  }
}

// Starts the installer detached, then hands off to `shutdown`, which must
// fully close JellyWave (child processes included) so nothing of it is
// still running -- or holding files open -- when the installer gets going.
function installAndQuit(file, shutdown) {
  if (!file || !fs.existsSync(file)) throw new Error('Update file is missing');
  const child = spawn(file, [], { detached: true, stdio: 'ignore', cwd: path.dirname(file) });
  child.unref();
  setTimeout(shutdown, 300);
}

module.exports = { checkForUpdates, downloadUpdate, installAndQuit };
