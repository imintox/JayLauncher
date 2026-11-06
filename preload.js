const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  get: () => ipcRenderer.invoke('lib:get'),
  scan: () => ipcRenderer.invoke('lib:scan'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  addFolder: () => ipcRenderer.invoke('settings:addFolder'),
  removeFolder: (p) => ipcRenderer.invoke('settings:removeFolder', p),
  hidden: () => ipcRenderer.invoke('lib:hidden'),
  unhide: (id) => ipcRenderer.invoke('game:unhide', id),
  unhideAll: () => ipcRenderer.invoke('game:unhideAll'),
  launch: (id) => ipcRenderer.invoke('game:launch', id),
  fav: (id, v) => ipcRenderer.invoke('game:fav', id, v),
  hide: (id) => ipcRenderer.invoke('game:hide', id),
  addManual: () => ipcRenderer.invoke('game:addManual'),
  version: () => ipcRenderer.invoke('app:version'),
  getUpdate: () => ipcRenderer.invoke('update:get'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => ipcRenderer.on('update:status', (_e, s) => cb(s)),
});
