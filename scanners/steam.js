const fs = require('fs/promises');
const path = require('path');
const { regQuery } = require('./util');

const IGNORE_IDS = new Set(['228980']); // Steamworks Common Redistributables
const IGNORE_NAMES = /^(Steam Linux Runtime|Proton|Steamworks Common)/i;

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function findSteamPath() {
  const fromReg = await regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath');
  const candidates = [fromReg, 'C:\\Program Files (x86)\\Steam'].filter(Boolean);
  for (const c of candidates) {
    if (await exists(path.join(c, 'steamapps'))) return c;
  }
  return null;
}

// Same folder can show up as "c:/program files (x86)/steam" (registry) and
// "C:\Program Files (x86)\Steam" (libraryfolders.vdf), so compare normalized.
const libKey = (p) => path.win32.resolve(p).toLowerCase();

async function findLibraries(steamPath) {
  const libs = new Map([[libKey(steamPath), steamPath]]);
  try {
    const vdf = await fs.readFile(path.join(steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
      const p = m[1].replace(/\\\\/g, '\\');
      if (!libs.has(libKey(p))) libs.set(libKey(p), p);
    }
  } catch { /* single library */ }
  return [...libs.values()];
}

// opts.steamPath lets tests point at a fake install.
async function scan(opts = {}) {
  const steamPath = opts.steamPath || (await findSteamPath());
  if (!steamPath) return [];
  const games = new Map(); // keyed by id so a game can never appear twice
  for (const lib of await findLibraries(steamPath)) {
    const apps = path.join(lib, 'steamapps');
    let files;
    try { files = await fs.readdir(apps); } catch { continue; }
    for (const f of files.filter((n) => /^appmanifest_\d+\.acf$/.test(n))) {
      try {
        const txt = await fs.readFile(path.join(apps, f), 'utf8');
        const appid = (txt.match(/"appid"\s+"(\d+)"/) || [])[1];
        const name = (txt.match(/"name"\s+"([^"]*)"/) || [])[1];
        const dir = (txt.match(/"installdir"\s+"([^"]*)"/) || [])[1];
        const flags = parseInt((txt.match(/"StateFlags"\s+"(\d+)"/) || [])[1] || '0', 10);
        if (!appid || !name || IGNORE_IDS.has(appid) || IGNORE_NAMES.test(name)) continue;
        if (!(flags & 4)) continue; // not fully installed
        const cdn = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}`;
        games.set(`steam:${appid}`, {
          id: `steam:${appid}`,
          title: name,
          launcher: 'steam',
          launchUri: `steam://rungameid/${appid}`,
          installPath: dir ? path.join(apps, 'common', dir) : null,
          art: `${cdn}/library_600x900.jpg`,
          artFallback: `${cdn}/header.jpg`,
        });
      } catch { /* skip bad manifest */ }
    }
  }
  return [...games.values()];
}

module.exports = { name: 'steam', scan };
