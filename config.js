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

class Settings {
  constructor(userDir, installerConfPath) {
    this.file = path.join(userDir, 'settings.json');
    this.installerConf = installerConfPath;
  }

  // Priority: choice made in Settings > choice made in installer > everything (dev only).
  enabled() {
    try {
      const j = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Array.isArray(j.enabled)) return j.enabled.filter((n) => KNOWN.has(n));
    } catch { /* none yet */ }
    const fromInstaller = readInstallerConf(this.installerConf);
    if (fromInstaller) {
      try { this.set(fromInstaller); } catch { /* keep going without saving */ }
      return fromInstaller;
    }
    return ALL.map((l) => l.name);
  }

  set(list) {
    const enabled = list.filter((n) => KNOWN.has(n));
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ enabled }, null, 2));
    return enabled;
  }
}

module.exports = { Settings, ALL };
