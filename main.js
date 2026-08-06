const { app, BrowserWindow, ipcMain, safeStorage, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client: DiscordRpcClient } = require('@xhayper/discord-rpc');
const { checkForUpdates } = require('./update-checker');

const CONFIG_PATH = path.join(app.getPath('userData'), 'session.dat');
const DISCORD_CLIENT_ID = '1534197353056174180';
const DOWNLOADS_DIR = path.join(app.getPath('userData'), 'downloads');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 870,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${sourceId}:${line})`);
  });

  // Links with target="_blank" (e.g. the attribution credit) open in the
  // user's real browser instead of a bare Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:state', 'maximized'));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:state', 'normal'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Silent background check — only speaks up if something's actually newer.
  setTimeout(() => {
    checkForUpdates()
      .then((result) => {
        if (result.status === 'available' && mainWindow) {
          mainWindow.webContents.send('update:available', result);
        }
      })
      .catch(() => {});
  }, 4000);

  // Hardware media keys (play/pause/next/prev on a keyboard) — these are
  // global accelerators Electron recognizes specially, so they work even
  // when the app isn't focused, same as they would for any other player.
  const mediaKeyMap = {
    MediaPlayPause: 'playpause',
    MediaNextTrack: 'next',
    MediaPreviousTrack: 'previous',
    MediaStop: 'stop'
  };
  Object.entries(mediaKeyMap).forEach(([accelerator, key]) => {
    try {
      globalShortcut.register(accelerator, () => {
        mainWindow?.webContents.send('media-key', key);
      });
    } catch (err) {
      // Some OS/keyboard combos don't expose these — non-fatal either way.
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  // Release the Discord RPC IPC connection explicitly rather than leaving it
  // to process teardown — matters for the updater, which detects a running
  // instance by image name and can end up fighting a lingering handle.
  try {
    discordClient?.destroy();
  } catch (err) {
    // Already disconnected/never connected — nothing to clean up.
  }
});

ipcMain.handle('update:check', async () => {
  try {
    return await checkForUpdates();
  } catch (err) {
    return { status: 'error', error: err.message };
  }
});

// --- Window controls for the custom title bar ---
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

// --- Encrypted session storage (server URL, username, access token) ---
ipcMain.handle('session:save', (_event, data) => {
  try {
    const json = JSON.stringify(data);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(json);
      fs.writeFileSync(CONFIG_PATH, encrypted);
    } else {
      fs.writeFileSync(CONFIG_PATH, Buffer.from(json, 'utf-8'));
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('session:load', () => {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const buffer = fs.readFileSync(CONFIG_PATH);
    let json;
    if (safeStorage.isEncryptionAvailable()) {
      json = safeStorage.decryptString(buffer);
    } else {
      json = buffer.toString('utf-8');
    }
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
});

ipcMain.handle('session:clear', () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// --- Discord Rich Presence ---
// Only reachable if the Discord desktop client is running locally (it exposes
// an IPC socket, not something available over the network) — if it's not,
// login() rejects and we just silently skip until the next track/play event
// tries again, rate-limited so a closed Discord doesn't spam retries.
let discordClient = null;
let discordReady = false;
let lastDiscordAttempt = 0;
const DISCORD_RETRY_MS = 10000;

async function ensureDiscordConnected() {
  if (discordReady) return true;
  const now = Date.now();
  if (now - lastDiscordAttempt < DISCORD_RETRY_MS) return false;
  lastDiscordAttempt = now;

  if (!discordClient) {
    discordClient = new DiscordRpcClient({ clientId: DISCORD_CLIENT_ID });
    discordClient.on('ready', () => { discordReady = true; });
    discordClient.on('disconnected', () => { discordReady = false; });
  }
  try {
    await discordClient.login();
    return discordReady;
  } catch (err) {
    return false;
  }
}

ipcMain.handle('discord:setActivity', async (_event, activity) => {
  const connected = await ensureDiscordConnected();
  if (!connected) return { ok: false };
  try {
    await discordClient.user?.setActivity(activity);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('discord:clearActivity', async () => {
  if (!discordReady || !discordClient) return { ok: true };
  try {
    await discordClient.user?.clearActivity();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// Deezer's search API doesn't send CORS headers, so the renderer can't call
// it directly — proxied through here instead. Album metadata rarely matches
// Deezer's listing exactly (deluxe/remaster suffixes, "Vol." vs "Volume",
// OST naming, etc.), so try progressively looser queries before giving up.
async function deezerSearch(query, type) {
  try {
    const q = encodeURIComponent(query.trim());
    if (!q) return null;
    const endpoint = type === 'album' ? 'search/album' : 'search';
    const res = await fetch(`https://api.deezer.com/${endpoint}?q=${q}&limit=1`);
    const data = await res.json();
    const entry = data.data?.[0];
    const cover = type === 'album' ? entry?.cover_xl || entry?.cover_big : entry?.album?.cover_xl || entry?.album?.cover_big;
    return cover || null;
  } catch (err) {
    return null;
  }
}

ipcMain.handle('deezer:searchAlbumArt', async (_event, artist, album, trackName) => {
  return (
    (await deezerSearch(`${artist} ${album}`, 'album')) ||
    (await deezerSearch(`${artist} ${trackName}`, 'track')) ||
    (await deezerSearch(`${artist} ${album}`, 'track')) ||
    (await deezerSearch(album, 'album'))
  );
});

// --- Offline downloads ---
// Fetched here (not the renderer) so a multi-MB audio file never has to
// cross the IPC boundary as one big message — only the resulting file path
// does.
const EXT_BY_CONTENT_TYPE = {
  'audio/mpeg': '.mp3',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac'
};

function downloadedFilePath(itemId) {
  if (!fs.existsSync(DOWNLOADS_DIR)) return null;
  const match = fs.readdirSync(DOWNLOADS_DIR).find((name) => name.startsWith(`${itemId}.`));
  return match ? path.join(DOWNLOADS_DIR, match) : null;
}

ipcMain.handle('downloads:save', async (_event, itemId, url, headers) => {
  try {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const res = await fetch(url, { headers });
    if (!res.ok) return { ok: false, error: `Server responded ${res.status}` };
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    const ext = EXT_BY_CONTENT_TYPE[contentType] || '.mp3';
    const filePath = path.join(DOWNLOADS_DIR, `${itemId}${ext}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return { ok: true, path: filePath, sizeBytes: buffer.length };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('downloads:delete', (_event, itemId) => {
  try {
    const existing = downloadedFilePath(itemId);
    if (existing) fs.unlinkSync(existing);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('downloads:getPath', (_event, itemId) => {
  try {
    return downloadedFilePath(itemId);
  } catch (err) {
    return null;
  }
});
