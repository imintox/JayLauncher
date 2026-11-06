const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const { Library } = require('./library');
const { Settings, ALL } = require('./config');
const { scanAll } = require('./scanners');

let lib;
let settings;
let lastReport = {};

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

let lastUpdate = null;

// Saves the General settings and applies the ones that need the OS or the updater.
function applyPrefs(patch) {
  const p = settings.patch(patch);
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: p.startWithWindows });
  autoUpdater.autoDownload = p.autoUpdate;
  return p;
}

// Checks GitHub Releases on start and every 6 hours; downloads in the background.
function setupUpdates() {
  if (!app.isPackaged) return;
  const send = (s) => {
    lastUpdate = s;
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('update:status', s));
  };
  autoUpdater.autoDownload = settings.get().autoUpdate;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (i) => send({ state: 'downloading', version: i.version }));
  autoUpdater.on('update-not-available', () => send({ state: 'current' }));
  autoUpdater.on('update-downloaded', (i) => send({ state: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => send({ state: 'error', message: String((e && e.message) || e).slice(0, 200) }));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  if (settings.get().autoUpdate) {
    check();
    setInterval(check, 6 * 60 * 60 * 1000);
  }
}

async function rescan() {
  const { games, report } = await scanAll(settings.enabled(), { customFolders: settings.get().customFolders });
  lastReport = report;
  lib.setScanned(games);
  return lib.all();
}

app.whenReady().then(() => {
  lib = new Library(app.getPath('userData'));
  // The installer drops launchers.conf next to the app exe.
  settings = new Settings(app.getPath('userData'), path.join(path.dirname(process.execPath), 'launchers.conf'));

  ipcMain.handle('lib:get', () => lib.all());
  ipcMain.handle('lib:scan', rescan);

  ipcMain.handle('settings:get', () => ({
    available: ALL,
    enabled: settings.enabled(),
    report: lastReport,
    prefs: settings.get(),
  }));
  ipcMain.handle('settings:save', async (_e, { enabled, prefs }) => {
    settings.set(Array.isArray(enabled) ? enabled : []);
    const p = applyPrefs(prefs);
    return { prefs: p, games: await rescan() };
  });
  ipcMain.handle('settings:addFolder', async () => {
    const r = await dialog.showOpenDialog({ title: 'Pick a folder that contains your games', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const p = r.filePaths[0];
    const cur = settings.get().customFolders;
    if (!cur.some((f) => f.path.toLowerCase() === p.toLowerCase())) {
      settings.patch({ customFolders: [...cur, { name: path.basename(p) || p, path: p }] });
    }
    return { prefs: settings.get(), games: await rescan() };
  });
  ipcMain.handle('settings:removeFolder', async (_e, p) => {
    settings.patch({ customFolders: settings.get().customFolders.filter((f) => f.path !== p) });
    return { prefs: settings.get(), games: await rescan() };
  });
  ipcMain.handle('lib:hidden', () => lib.hidden());
  ipcMain.handle('game:unhide', (_e, id) => {
    lib.patchMeta(id, { hidden: false });
    return lib.all();
  });
  ipcMain.handle('game:unhideAll', () => {
    lib.unhideAll();
    return lib.all();
  });

  ipcMain.handle('game:launch', async (_e, id) => {
    const g = lib.find(id);
    if (!g) return false;
    if (g.launchUri) {
      await shell.openExternal(g.launchUri);
    } else if (g.aumid) {
      spawn('explorer.exe', ['shell:AppsFolder\\' + g.aumid], { detached: true, stdio: 'ignore' }).unref();
    } else if (g.exe) {
      spawn(g.exe, [], { detached: true, stdio: 'ignore', cwd: path.dirname(g.exe) }).unref();
    } else {
      return false;
    }
    lib.patchMeta(id, { lastPlayed: Date.now() });
    if (settings.get().closeOnLaunch) setTimeout(() => app.quit(), 2000);
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

  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('update:get', () => lastUpdate);
  ipcMain.handle('update:check', () => {
    if (!app.isPackaged) return 'dev';
    autoUpdater.autoDownload = true; // a manual check always downloads
    autoUpdater.checkForUpdates().catch(() => {});
    return 'checking';
  });
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall());

  createWindow();
  setupUpdates();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
