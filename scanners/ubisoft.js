const path = require('path');
const util = require('./util');

const ROOT = 'HKLM\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs';

// Ubisoft doesn't store a display name in the registry, so the title is the
// install folder's name (usually the real game title).
async function scan(opts = {}) {
  const { regQuery, regSubkeys } = opts.reg || util;
  const games = [];
  for (const key of await regSubkeys(ROOT)) {
    const appId = key.split('\\').pop();
    const dir = await regQuery(key, 'InstallDir');
    if (!appId || !dir) continue;
    const clean = dir.replace(/[\\/]+$/, '');
    games.push({
      id: `ubisoft:${appId}`,
      title: path.basename(clean.replace(/\\/g, '/')),
      launcher: 'ubisoft',
      launchUri: `uplay://launch/${appId}/0`,
      installPath: clean,
      art: null,
      artFallback: null,
    });
  }
  return games;
}

module.exports = { name: 'ubisoft', scan };
