const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const PS =
  "Get-AppxPackage | Where-Object { $_.InstallLocation -like '*XboxGames*' -or ($_.InstallLocation -and (Test-Path (Join-Path $_.InstallLocation 'MicrosoftGame.config'))) } | Select-Object Name,PackageFamilyName,InstallLocation,IsResourcePackage,IsFramework | ConvertTo-Json -Compress";
const NOT_GAMES = /^Microsoft\.(GamingApp|XboxApp|GamingServices|XboxIdentityProvider|XboxGameOverlay|XboxGamingOverlay|Xbox\.TCUI|XboxSpeechToTextOverlay)/i;

function listPackages() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS],
      { windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 }, (err, out) => {
        if (err || !out.trim()) return resolve([]);
        try { const j = JSON.parse(out); resolve(Array.isArray(j) ? j : [j]); } catch { resolve([]); }
      });
  });
}

async function readOrEmpty(readFile, p) {
  try { return await readFile(p, 'utf8'); } catch { return ''; }
}

async function scan(opts = {}) {
  const list = opts.listPackages || listPackages;
  const readFile = opts.readFile || fs.readFile;
  const games = [];
  for (const pkg of await list()) {
    if (!pkg || !pkg.Name || !pkg.PackageFamilyName || !pkg.InstallLocation || NOT_GAMES.test(pkg.Name)) continue;
    if (pkg.IsResourcePackage || pkg.IsFramework) continue; // language packs, runtimes
    const loc = pkg.InstallLocation;
    const cfg = await readOrEmpty(readFile, path.join(loc, 'MicrosoftGame.config'));
    const man = await readOrEmpty(readFile, path.join(loc, 'appxmanifest.xml'));
    // DLC and add-on packages have no app to start. A real game's manifest has an <Application>.
    if (man && !/<Application[\s>]/.test(man)) continue;
    let title = (cfg.match(/DefaultDisplayName="([^"]+)"/) || [])[1];
    if (!title || /^ms-resource/i.test(title)) {
      title = (loc.match(/XboxGames[\\/]+([^\\/]+)/i) || [])[1] || pkg.Name;
    }
    const appId = (man.match(/<Application\s[^>]*?Id="([^"]+)"/) || [])[1] || 'Game';
    games.push({
      id: `xbox:${pkg.PackageFamilyName}`,
      title,
      launcher: 'xbox',
      launchUri: null,
      aumid: `${pkg.PackageFamilyName}!${appId}`,
      installPath: loc,
      art: null,
      artFallback: null,
    });
  }
  return games;
}

module.exports = { name: 'xbox', scan };
