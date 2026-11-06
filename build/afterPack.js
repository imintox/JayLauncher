// Runs after electron-builder packs the app, before the installer is made.
// Flips Electron "fuses" in the exe so it can't be abused as a general-purpose Node.js runtime.
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  try {
    const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
    await flipFuses(exe, {
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.EnableCookieEncryption]: true,
    });
    console.log('  • security fuses applied to', exe);
  } catch (e) {
    // Release builds on GitHub (CI) must be hardened, so fail there; locally just warn.
    if (process.env.CI) throw e;
    console.warn('  ! WARNING: security fuses were NOT applied:', e.message);
  }
};
