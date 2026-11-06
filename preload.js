const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  get: () => ipcRenderer.invoke('lib:get'),
  scan: () => ipcRenderer.invoke('lib:scan'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (list) => ipcRenderer.invoke('settings:set', list),
  launch: (id) => ipcRenderer.invoke('game:launch', id),
  fav: (id, v) => ipcRenderer.invoke('game:fav', id, v),
  hide: (id) => ipcRenderer.invoke('game:hide', id),
  addManual: () => ipcRenderer.invoke('game:addManual'),
});
