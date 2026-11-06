const fs = require('fs/promises');
const path = require('path');

// Exes that are never the game itself.
const NOT_GAME = /(unins|uninst|setup|install|redist|vcredist|dxsetup|crashhandler|crashreport|unitycrash|helper|updater|prerequisite|dotnet|directx|easyanticheat|battleye)/i;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function exesIn(dir) {
  try {
    const out = [];
    for (const n of await fs.readdir(dir)) {
      if (!/\.exe$/i.test(n) || NOT_GAME.test(n)) continue;
      try {
        const st = await fs.stat(path.join(dir, n));
        if (st.isFile()) out.push({ file: path.join(dir, n), name: n, size: st.size });
      } catch { /* skip */ }
    }
    return out;
  } catch { return []; }
}

// Best guess at the game's exe: one named like the folder, otherwise the largest.
async function pickExe(dir, title) {
  const c = [...(await exesIn(dir)), ...(await exesIn(path.join(dir, 'bin')))];
  if (!c.length) return null;
  const t = norm(title);
  const exact = c.find((x) => norm(path.basename(x.name, '.exe')) === t);
  return (exact || c.sort((a, b) => b.size - a.size)[0]).file;
}

// Each sub-folder of a custom folder is one game. If there are none, the folder itself may be a game.
async function scan(opts = {}) {
  const games = [];
  for (const f of opts.folders || []) {
    if (!f || !f.path) continue;
    const label = f.name || path.basename(f.path) || 'Custom';
    let entries;
    try { entries = await fs.readdir(f.path, { withFileTypes: true }); } catch { continue; }
    const found = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const dir = path.join(f.path, e.name);
      const exe = await pickExe(dir, e.name);
      if (exe) found.push({ title: e.name, dir, exe });
    }
    if (!found.length) {
      const title = path.basename(f.path) || label;
      const exe = await pickExe(f.path, title);
      if (exe) found.push({ title, dir: f.path, exe });
    }
    for (const g of found) {
      games.push({
        id: `custom:${g.exe.toLowerCase()}`,
        title: g.title,
        launcher: label,
        launchUri: null,
        exe: g.exe,
        installPath: g.dir,
        art: null,
        artFallback: null,
      });
    }
  }
  return games;
}

module.exports = { name: 'custom', scan };
