const fs = require('fs');
const path = require('path');

// Every launcher the app has a scanner for.
const ALL = [
  { name: 'steam', label: 'Steam' },
  { name: 'epic', label: 'Epic Games' },
  { name: 'gog', label: 'GOG' },
  { name: 'ubisoft', label: 'Ubisoft Connect' },
  { name: 'ea', label: 'EA app' },
  { name: 'battlenet', label: 'Battle.net' },
  { name: 'xbox', label: 'Xbox / Game Pass' },
  { name: 'rockstar', label: 'Rockstar Games' },
];
const KNOWN = new Set(ALL.map((l) => l.name));

const DEFAULTS = {
  startWithWindows: false,
  startMinimized: false, // open hidden in the tray / minimized
  minimizeToTray: false, // minimizing hides to the tray instead of the taskbar
  closeToTray: false, // the X button keeps the app running in the tray
  minimizeOnLaunch: false, // minimize after starting a game
  autoUpdate: true,
  scanOnStart: true,
  closeOnLaunch: false,
  cardSize: 'medium', // small | medium | large
  defaultSort: 'title', // title | recent | fav
  customFolders: [], // [{ name, path }]
};

// installer writes lines like "steam=1"
function readInstallerConf(file) {
  try {
    const out = [];
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.trim().match(/^(\w+)=1$/);
      if (m && KNOWN.has(m[1])) out.push(m[1]);
    }
    return out.length ? out : null;
  } catch { return null; }
}

function clean(key, v) {
  switch (key) {
    case 'cardSize': return ['small', 'medium', 'large'].includes(v) ? v : DEFAULTS.cardSize;
    case 'defaultSort': return ['title', 'recent', 'fav'].includes(v) ? v : DEFAULTS.defaultSort;
    case 'customFolders':
      return (Array.isArray(v) ? v : [])
        .filter((f) => f && typeof f.path === 'string' && f.path)
        .slice(0, 50)
        .map((f) => ({ name: String(f.name || path.basename(f.path) || f.path).slice(0, 40), path: f.path }));
    default: return !!v;
  }
}

class Settings {
  constructor(userDir, installerConfPath) {
    this.file = path.join(userDir, 'settings.json');
    this.installerConf = installerConfPath;
  }

  _read() { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return {}; } }

  _write(obj) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(obj, null, 2));
  }

  // Priority: choice saved in Settings > choice made in installer (saved on first read) > everything (dev only).
  enabled() {
    const j = this._read();
    if (Array.isArray(j.enabled)) return j.enabled.filter((n) => KNOWN.has(n));
    const fromInstaller = readInstallerConf(this.installerConf);
    if (fromInstaller) {
      try { this._write({ ...j, enabled: fromInstaller }); } catch { /* keep going */ }
      return fromInstaller;
    }
    return ALL.map((l) => l.name);
  }

  set(list) {
    const enabled = list.filter((n) => KNOWN.has(n));
    this._write({ ...this._read(), enabled });
    return enabled;
  }

  get() {
    const j = this._read();
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = k in j ? clean(k, j[k]) : DEFAULTS[k];
    return out;
  }

  patch(p = {}) {
    const j = this._read();
    for (const k of Object.keys(DEFAULTS)) if (k in p) j[k] = clean(k, p[k]);
    this._write(j);
    return this.get();
  }
}

module.exports = { Settings, ALL, DEFAULTS };
