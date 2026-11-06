const fs = require('fs/promises');
const path = require('path');
const util = require('./util');

const ROOT = 'HKLM\\SOFTWARE\\WOW6432Node\\EA Games';
const SKIP = /touchup|cleanup|uninstall|activation|crashreport|redist/i;

// The EA app leaves __Installer\installerdata.xml in each game folder; it names the launch exe.
async function findExe(dir, readFile) {
  try {
    const xml = await readFile(path.join(dir, '__Installer', 'installerdata.xml'), 'utf8');
    for (const m of xml.matchAll(/<filePath>\s*\[[^\]]*\]([^<]+)<\/filePath>/g)) {
      const rel = m[1].trim().replace(/^[\\/]+/, '');
      if (rel && /\.exe$/i.test(rel) && !SKIP.test(rel)) return path.join(dir, rel);
    }
  } catch { /* not an EA game folder */ }
  return null;
}

async function scan(opts = {}) {
  const { regQuery, regSubkeys } = opts.reg || util;
  const readFile = opts.readFile || fs.readFile;
  const games = [];
  for (const key of await regSubkeys(ROOT)) {
    const leaf = key.split('\\').pop();
    const dir = await regQuery(key, 'Install Dir');
    if (!dir) continue;
    const exe = await findExe(dir, readFile);
    if (!exe) continue;
    const title = (await regQuery(key, 'DisplayName')) || leaf;
    games.push({ id: `ea:${leaf}`, title, launcher: 'ea', launchUri: null, exe, installPath: dir, art: null, artFallback: null });
  }
  return games;
}

module.exports = { name: 'ea', scan };
