// Add a new launcher: create scanners/<name>.js exporting { name, scan() }, list it here,
// add it to ALL in ../config.js, and add a checkbox in ../build/installer.nsh.
const scanners = [
  require('./steam'), require('./epic'), require('./gog'), require('./ubisoft'),
  require('./ea'), require('./battlenet'), require('./xbox'), require('./rockstar'),
];

// enabled: launcher names to scan; everything else is skipped entirely.
// Returns { games, report } where report[name] = { count, error? } for the Launchers dialog.
const custom = require('./custom');

async function scanAll(enabled, extra = {}) {
  const wanted = scanners.filter((s) => !enabled || enabled.includes(s.name));
  const report = {};
  const results = await Promise.all(
    wanted.map(async (s) => {
      try {
        const g = await s.scan();
        report[s.name] = { count: g.length };
        return g;
      } catch (e) {
        console.error(`[${s.name}] scan failed:`, e.message);
        report[s.name] = { count: 0, error: e.message };
        return [];
      }
    })
  );
  if ((extra.customFolders || []).length) {
    try {
      const g = await custom.scan({ folders: extra.customFolders });
      report.custom = { count: g.length };
      results.push(g);
    } catch (e) {
      report.custom = { count: 0, error: e.message };
    }
  }
  // Never return two entries with the same id.
  const games = [...new Map(results.flat().map((g) => [g.id, g])).values()];
  return { games, report };
}

module.exports = { scanAll, scanners };
