const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client: DiscordRpcClient } = require('@xhayper/discord-rpc');

const CONFIG_PATH = path.join(app.getPath('userData'), 'session.dat');
const DISCORD_CLIENT_ID = '1534197353056174180';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
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
