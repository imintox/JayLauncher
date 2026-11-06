const fs = require('fs/promises');
const path = require('path');

// opts.manifestDir lets tests point at fake manifests.
async function scan(opts = {}) {
  const dir =
    opts.manifestDir ||
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  let files;
  try { files = await fs.readdir(dir); } catch { return []; }

  const games = [];
  for (const f of files.filter((n) => n.endsWith('.item'))) {
    try {
      const m = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      const app = m.AppName;
      if (!app || !m.DisplayName || m.bIsIncompleteInstall) continue;
      // Skip DLC / add-ons that point at a different main game.
      if (m.MainGameAppName && m.MainGameAppName !== app) continue;
      const ref = [m.CatalogNamespace, m.CatalogItemId, app].map(encodeURIComponent).join('%3A');
      games.push({
        id: `epic:${app}`,
        title: m.DisplayName,
        launcher: 'epic',
        launchUri: `com.epicgames.launcher://apps/${ref}?action=launch&silent=true`,
        installPath: m.InstallLocation || null,
        art: null,
        artFallback: null,
      });
    } catch { /* skip bad manifest */ }
  }
  return games;
}

module.exports = { name: 'epic', scan };
