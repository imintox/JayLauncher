const path = require('path');

// Only these launcher protocols may ever be opened from a game entry.
const SAFE_URI = /^(steam|com\.epicgames\.launcher|uplay|battlenet|origin2|goggalaxy):\/\/[\x21-\x7e]*$/i;
// Package family name + "!" + app id, e.g. Microsoft.624F8B84B80_8wekyb3d8bbwe!Game
const SAFE_AUMID = /^[A-Za-z0-9.\-]+_[a-z0-9]+![A-Za-z0-9._\-]+$/;
const EXE_EXT = /\.(exe|bat|cmd|lnk)$/i;

function isSafeLaunchUri(u) {
  return typeof u === 'string' && u.length <= 2048 && SAFE_URI.test(u);
}

function isSafeAumid(a) {
  return typeof a === 'string' && a.length <= 300 && SAFE_AUMID.test(a);
}

// Absolute local path to an executable; no network shares, no odd characters.
function isSafeExe(p) {
  return (
    typeof p === 'string' &&
    p.length <= 1024 &&
    path.win32.isAbsolute(p) &&
    !/^\\\\/.test(p) &&
    !/[\0\r\n]/.test(p) &&
    EXE_EXT.test(p)
  );
}

// True if target is strictly inside base (blocks "..\.." path tricks).
function isInside(base, target) {
  const rel = path.win32.relative(path.win32.resolve(base), path.win32.resolve(target));
  return !!rel && !rel.startsWith('..') && !path.win32.isAbsolute(rel);
}

module.exports = { isSafeLaunchUri, isSafeAumid, isSafeExe, isInside };
