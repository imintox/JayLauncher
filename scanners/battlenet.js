const util = require('./util');

const ROOTS = [
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];
const norm = (s) => s.toLowerCase().replace(/[®™©]/g, '').replace(/[:\-–]/g, ' ').replace(/\s+/g, ' ').trim();
// Battle.net product codes used by battlenet://<code>
const CODES = Object.fromEntries(
  Object.entries({
    'World of Warcraft': 'WoW', 'Diablo III': 'D3', 'Diablo IV': 'Fen', 'Overwatch': 'Pro', 'Overwatch 2': 'Pro',
    'Hearthstone': 'WTCG', 'StarCraft II': 'S2', 'StarCraft': 'S1', 'Heroes of the Storm': 'Hero',
    'Warcraft III': 'W3', 'Warcraft III Reforged': 'W3',
  }).map(([k, v]) => [norm(k), v])
);

// Blizzard games register an uninstall entry with Publisher "Blizzard Entertainment".
async function scan(opts = {}) {
  const { regQuery, regSearch } = opts.reg || util;
  const games = new Map();
  for (const root of ROOTS) {
    for (const key of await regSearch(root, 'Blizzard Entertainment')) {
      const [name, dir, pub] = await Promise.all([
        regQuery(key, 'DisplayName'), regQuery(key, 'InstallLocation'), regQuery(key, 'Publisher'),
      ]);
      if (!name || !/blizzard/i.test(pub || '')) continue;
      const code = CODES[norm(name)];
      if (!code) continue;
      games.set(`battlenet:${code}`, {
        id: `battlenet:${code}`,
        title: name.replace(/[®™]/g, '').trim(),
        launcher: 'battlenet',
        launchUri: `battlenet://${code}`,
        installPath: dir || null,
        art: null,
        artFallback: null,
      });
    }
  }
  return [...games.values()];
}

module.exports = { name: 'battlenet', scan };
