// =============================================================
//  Preload Script — Bridge de Comunicação com Electron
// =============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktopApp: true,
  minimizeToTray: () => ipcRenderer.send('app:minimize-to-tray'),
  showNotification: (title, body) => ipcRenderer.send('app:notify', { title, body }),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
});

