const path = require('path');
const util = require('./util');

const ROOT = 'HKLM\\SOFTWARE\\WOW6432Node\\Rockstar Games';
// Rockstar doesn't store the exe name, so only titles we know are listed.
const EXES = {
  'grand theft auto v': 'PlayGTAV.exe',
  'red dead redemption 2': 'RDR2.exe',
  'max payne 3': 'MaxPayne3.exe',
  'l.a. noire': 'LANoire.exe',
};

async function scan(opts = {}) {
  const { regQuery, regSubkeys } = opts.reg || util;
  const games = [];
  for (const key of await regSubkeys(ROOT)) {
    const leaf = key.split('\\').pop();
    const exeName = EXES[leaf.toLowerCase()];
    if (!exeName) continue;
    const dir = await regQuery(key, 'InstallFolder');
    if (!dir) continue;
    games.push({
      id: `rockstar:${leaf}`,
      title: leaf,
      launcher: 'rockstar',
      launchUri: null,
      exe: path.join(dir, exeName),
      installPath: dir,
      art: null,
      artFallback: null,
    });
  }
  return games;
}

module.exports = { name: 'rockstar', scan };
