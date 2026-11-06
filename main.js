const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { Library } = require('./library');
const { Settings, ALL } = require('./config');
const { scanAll } = require('./scanners');

let lib;
let settings;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 360,
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

async function rescan() {
  lib.setScanned(await scanAll(settings.enabled()));
  return lib.all();
}

app.whenReady().then(() => {
  lib = new Library(app.getPath('userData'));
  // The installer drops launchers.conf next to the app exe.
  settings = new Settings(app.getPath('userData'), path.join(path.dirname(process.execPath), 'launchers.conf'));

  ipcMain.handle('lib:get', () => lib.all());
  ipcMain.handle('lib:scan', rescan);

  ipcMain.handle('settings:get', () => ({ available: ALL, enabled: settings.enabled() }));
  ipcMain.handle('settings:set', async (_e, list) => {
    settings.set(list);
    return rescan();
  });

  ipcMain.handle('game:launch', async (_e, id) => {
    const g = lib.find(id);
    if (!g) return false;
    if (g.launchUri) {
      await shell.openExternal(g.launchUri);
    } else if (g.exe) {
      spawn(g.exe, [], { detached: true, stdio: 'ignore', cwd: path.dirname(g.exe) }).unref();
    } else {
      return false;
    }
    lib.patchMeta(id, { lastPlayed: Date.now() });
    return true;
  });

  ipcMain.handle('game:fav', (_e, id, value) => {
    lib.patchMeta(id, { fav: !!value });
    return lib.all();
  });

  ipcMain.handle('game:hide', (_e, id) => {
    lib.patchMeta(id, { hidden: true });
    return lib.all();
  });

  ipcMain.handle('game:addManual', async () => {
    const r = await dialog.showOpenDialog({
      title: 'Pick a game .exe',
      properties: ['openFile'],
      filters: [{ name: 'Executables', extensions: ['exe', 'lnk', 'bat'] }],
    });
    if (r.canceled || !r.filePaths[0]) return lib.all();
    const exe = r.filePaths[0];
    lib.addManual({
      id: `manual:${exe.toLowerCase()}`,
      title: path.basename(exe, path.extname(exe)),
      launcher: 'manual',
      exe,
      installPath: path.dirname(exe),
      art: null,
      artFallback: null,
    });
    return lib.all();
  });

  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
