const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
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
  }
});
