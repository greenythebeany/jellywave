const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    onStateChange: (callback) => {
      ipcRenderer.on('window:state', (_event, state) => callback(state));
    }
  },
  session: {
    save: (data) => ipcRenderer.invoke('session:save', data),
    load: () => ipcRenderer.invoke('session:load'),
    clear: () => ipcRenderer.invoke('session:clear')
  },
  discord: {
    setActivity: (activity) => ipcRenderer.invoke('discord:setActivity', activity),
    clearActivity: () => ipcRenderer.invoke('discord:clearActivity')
  },
  deezer: {
    searchAlbumArt: (artist, album, trackName) => ipcRenderer.invoke('deezer:searchAlbumArt', artist, album, trackName)
  },
  updates: {
    check: () => ipcRenderer.invoke('update:check'),
    onAvailable: (callback) => {
      ipcRenderer.on('update:available', (_event, result) => callback(result));
    }
  },
  mediaKeys: {
    onKey: (callback) => {
      ipcRenderer.on('media-key', (_event, key) => callback(key));
    }
  },
  downloads: {
    save: (itemId, url, headers) => ipcRenderer.invoke('downloads:save', itemId, url, headers),
    delete: (itemId) => ipcRenderer.invoke('downloads:delete', itemId),
    getPath: (itemId) => ipcRenderer.invoke('downloads:getPath', itemId)
  },
  grab: {
    pickFolder: () => ipcRenderer.invoke('grab:pickFolder'),
    start: (url, outputDir) => ipcRenderer.send('grab:start', { url, outputDir }),
    cancel: () => ipcRenderer.send('grab:cancel'),
    onEvent: (callback) => {
      ipcRenderer.on('grab:event', (_event, data) => callback(data));
    }
  }
});
