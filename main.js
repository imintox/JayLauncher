const { app, BrowserWindow, ipcMain, shell, dialog, session, nativeTheme, Tray, Menu, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const { Library } = require('./library');
const { Settings, ALL } = require('./config');
const { scanAll } = require('./scanners');
const { isSafeLaunchUri, isSafeAumid, isSafeExe } = require('./security');
const art = require('./art');
const { regQuery } = require('./scanners/util');

nativeTheme.themeSource = 'dark';

let lib;
let settings;
let lastReport = {};
let lastUpdate = null;
let mainWindow = null;
let tray = null;
let artCache = null;
let quitting = false;

// Only one copy at a time: starting it again just brings the open one forward.
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());
app.on('before-quit', () => { quitting = true; });

/* ---------- window ---------- */

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 360,
    show: false, // shown once painted, so there's no white flash
    backgroundColor: '#07060d',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'renderer', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: !app.isPackaged,
    },
  });
  mainWindow = win;
  const startHidden = settings.get().startMinimized;
  win.once('ready-to-show', () => {
    if (!startHidden) return win.show();
    if (settings.get().minimizeToTray || settings.get().closeToTray) updateTray(); // stays in the tray
    else win.showInactive(), win.minimize();
  });
  setTimeout(() => { if (!startHidden && !win.isDestroyed() && !win.isVisible()) win.show(); }, 4000);
  win.on('minimize', () => {
    if (settings.get().minimizeToTray) { updateTray(); win.hide(); }
  });
  win.on('close', (ev) => {
    if (!quitting && settings.get().closeToTray) { ev.preventDefault(); updateTray(); win.hide(); }
  });
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function showWindow() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// The tray icon exists only while a tray option is on (or the window is hidden).
function updateTray() {
  const s = settings.get();
  const need = s.minimizeToTray || s.closeToTray || s.startMinimized;
  if (!need && mainWindow && mainWindow.isVisible()) {
    if (tray) { tray.destroy(); tray = null; }
    return;
  }
  if (tray) return;
  const icon = nativeImage.createFromPath(path.join(__dirname, 'renderer', 'logo.png')).resize({ width: 32, height: 32 });
  tray = new Tray(icon);
  tray.setToolTip('Jay Launcher');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Jay Launcher', click: showWindow },
    { label: 'Rescan games', click: () => rescan().then(() => mainWindow && mainWindow.webContents.send('lib:changed')).catch(() => {}) },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);
}

// The app never opens other windows, navigates away, or embeds pages.
app.on('web-contents-created', (_e, wc) => {
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (ev) => ev.preventDefault());
  wc.on('will-attach-webview', (ev) => ev.preventDefault());
});

/* ---------- IPC: only our own window may call, and every input is checked ---------- */

function trusted(e) {
  return !!mainWindow && e.sender === mainWindow.webContents && (!e.senderFrame || !e.senderFrame.parent);
}

function handle(channel, fn) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e)) throw new Error('Blocked request from an untrusted sender.');
    return fn(e, ...args);
  });
}

const known = (id) => (typeof id === 'string' && id.length < 1000 ? lib.find(id) : undefined);

// Steam games start through steam.exe directly, with a clean environment. If Steam is closed this starts it
// (in the tray when "background" is on) and launches the game; if it's open, the game just starts.
// Launchers and games must not inherit Electron/Chromium settings from this app.
function cleanEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!/^(ELECTRON|CHROME|CHROMIUM|NODE|NPM_|npm_|ORIGINAL_|GDK_|QT_|SDL_|__COMPAT_LAYER)/i.test(k)) env[k] = v;
  }
  return env;
}

async function steamStart(g) {
  const id = g.launcher === 'steam' && (g.launchUri || '').match(/^steam:\/\/rungameid\/(\d{1,10})$/);
  if (!id) return false;
  const exe = (await regQuery('HKCU\\Software\\Valve\\Steam', 'SteamExe')) || '';
  const win = exe.replace(/\//g, '\\');
  if (!isSafeExe(win) || !/\\steam\.exe$/i.test(win)) return false;
  run(win, [...(settings.get().quietLaunch ? ['-silent'] : []), '-applaunch', id[1]]);
  return true;
}

function run(cmd, args, opts) {
  const c = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false, ...opts, env: cleanEnv() });
  c.on('error', () => {}); // a missing exe must not crash the app
  c.unref();
}

/* ---------- settings + updates ---------- */

// Saves the General settings and applies the ones that need the OS or the updater.
function applyPrefs(patch) {
  const p = settings.patch(patch && typeof patch === 'object' ? patch : {});
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: p.startWithWindows });
  if (p.minimizeToTray || p.closeToTray || p.startMinimized) updateTray();
  else if (tray && mainWindow && mainWindow.isVisible()) { tray.destroy(); tray = null; }
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
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
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
  art.apply(games, artCache);
  lib.setScanned(games);
  // Covers for non-Steam games are looked up in the background, then the window refreshes.
  art.fill(games, artCache, {
    online: settings.get().onlineArt,
    getIcon: async (exe) => {
      const img = await app.getFileIcon(exe, { size: 'large' });
      return img.isEmpty() ? null : img.toDataURL();
    },
  }).then((found) => {
    if (!found) return;
    art.apply(games, artCache);
    lib.setScanned(games);
    if (mainWindow) mainWindow.webContents.send('lib:changed');
  }).catch(() => {});
  return lib.all();
}

/* ---------- start ---------- */

app.whenReady().then(() => {
  // The app needs no browser permissions (camera, mic, location, notifications, ...).
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  lib = new Library(app.getPath('userData'));
  artCache = new art.ArtCache(app.getPath('userData'));
  // The installer drops launchers.conf next to the app exe.
  settings = new Settings(app.getPath('userData'), path.join(path.dirname(process.execPath), 'launchers.conf'));

  handle('lib:get', () => lib.all());
  handle('lib:scan', rescan);

  handle('settings:get', () => ({
    available: ALL,
    enabled: settings.enabled(),
    report: lastReport,
    prefs: settings.get(),
  }));
  handle('settings:save', async (_e, payload) => {
    const { enabled, prefs } = payload && typeof payload === 'object' ? payload : {};
    settings.set(Array.isArray(enabled) ? enabled.filter((n) => typeof n === 'string') : []);
    const p = applyPrefs(prefs);
    return { prefs: p, games: await rescan() };
  });
  handle('settings:addFolder', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { title: 'Pick a folder that contains your games', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const p = r.filePaths[0];
    const cur = settings.get().customFolders;
    if (!cur.some((f) => f.path.toLowerCase() === p.toLowerCase())) {
      settings.patch({ customFolders: [...cur, { name: path.basename(p) || p, path: p }] });
    }
    return { prefs: settings.get(), games: await rescan() };
  });
  handle('settings:removeFolder', async (_e, p) => {
    if (typeof p === 'string') {
      settings.patch({ customFolders: settings.get().customFolders.filter((f) => f.path !== p) });
    }
    return { prefs: settings.get(), games: await rescan() };
  });
  handle('lib:excluded', () => lib.hidden());
  handle('game:include', (_e, id) => {
    if (known(id)) lib.patchMeta(id, { hidden: false });
    return lib.all();
  });
  handle('game:includeAll', () => {
    lib.unhideAll();
    return lib.all();
  });

  handle('game:launch', async (_e, id) => {
    const g = known(id);
    if (!g) return false;
    try {
      if (g.launchUri) {
        if (!isSafeLaunchUri(g.launchUri)) return false;
        if (!(await steamStart(g))) {
          // Ask Windows' own shell to open the link. Epic, Ubisoft, Battle.net and GOG then start
          // from Explorer, not from this app, so they don't inherit anything from it.
          run('explorer.exe', [g.launchUri]);
        }
      } else if (g.aumid) {
        if (!isSafeAumid(g.aumid)) return false;
        run('explorer.exe', ['shell:AppsFolder\\' + g.aumid]);
      } else if (g.exe) {
        if (!isSafeExe(g.exe)) return false;
        if (/\.exe$/i.test(g.exe)) run(g.exe, [], { cwd: path.dirname(g.exe) });
        else if (await shell.openPath(g.exe)) return false; // non-empty string = error
      } else {
        return false;
      }
    } catch {
      return false;
    }
    lib.patchMeta(id, { lastPlayed: Date.now() });
    const st = settings.get();
    if (st.closeOnLaunch) setTimeout(() => { quitting = true; app.quit(); }, 2000);
    else if (st.minimizeOnLaunch && mainWindow) {
      if (st.minimizeToTray) { updateTray(); mainWindow.hide(); } else mainWindow.minimize();
    }
    return true;
  });

  handle('game:fav', (_e, id, value) => {
    if (known(id)) lib.patchMeta(id, { fav: !!value });
    return lib.all();
  });

  handle('game:exclude', (_e, id) => {
    if (known(id)) lib.patchMeta(id, { hidden: true });
    return lib.all();
  });

  handle('game:addManual', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Pick a game .exe',
      properties: ['openFile'],
      filters: [{ name: 'Executables', extensions: ['exe', 'lnk', 'bat'] }],
    });
    if (r.canceled || !r.filePaths[0]) return lib.all();
    const exe = r.filePaths[0];
    if (!isSafeExe(exe)) return lib.all();
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

  handle('app:version', () => app.getVersion());
  handle('update:get', () => lastUpdate);
  handle('update:check', () => {
    if (!app.isPackaged) return 'dev';
    autoUpdater.autoDownload = true; // a manual check always downloads
    autoUpdater.checkForUpdates().catch(() => {});
    return 'checking';
  });
  handle('update:install', () => {
    if (app.isPackaged) autoUpdater.quitAndInstall();
  });

  createWindow();
  setupUpdates();
  if (settings.get().minimizeToTray || settings.get().closeToTray) updateTray();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
