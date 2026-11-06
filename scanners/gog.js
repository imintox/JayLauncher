const path = require('path');
const util = require('./util');

const ROOT = 'HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games';

// opts.reg lets tests inject fake registry access.
async function scan(opts = {}) {
  const { regQuery, regSubkeys } = opts.reg || util;
  const games = [];
  for (const key of await regSubkeys(ROOT)) {
    const [name, id, dir, exe] = await Promise.all([
      regQuery(key, 'gameName'),
      regQuery(key, 'gameID'),
      regQuery(key, 'path'),
      regQuery(key, 'exe'),
    ]);
    if (!name || !id || !exe) continue;
    games.push({
      id: `gog:${id}`,
      title: name,
      launcher: 'gog',
      launchUri: null,
      exe,
      installPath: dir || path.dirname(exe),
      art: null,
      artFallback: null,
    });
  }
  return games;
}

module.exports = { name: 'gog', scan };
