// Add a new launcher by dropping a file in this folder that exports
// { name, scan() }, listing it here, and adding it to ALL in ../config.js
// and to build/installer.nsh.
const scanners = [require('./steam'), require('./epic'), require('./gog'), require('./ubisoft')];

// enabled: array of launcher names to scan. Everything else is skipped entirely.
async function scanAll(enabled) {
  const wanted = scanners.filter((s) => !enabled || enabled.includes(s.name));
  const results = await Promise.all(
    wanted.map(async (s) => {
      try { return await s.scan(); } catch (e) { console.error(`[${s.name}] scan failed:`, e.message); return []; }
    })
  );
  // Safety net: never return two entries with the same id.
  return [...new Map(results.flat().map((g) => [g.id, g])).values()];
}

module.exports = { scanAll, scanners };
