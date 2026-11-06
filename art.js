// Finds cover art for games that don't come with any (everything except Steam).
// Order: Xbox package logo -> Steam store match by title -> the game's exe icon -> letter tile (renderer).
const fs = require('fs');
const path = require('path');
const { isInside } = require('./security');

const CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';
const DAY = 24 * 3600 * 1000;
const MAX_LOGO = 400 * 1024;

const norm = (t) =>
  String(t || '').toLowerCase().replace(/[™®©]/g, '').replace(/\b(game of the year|goty|definitive|deluxe|standard|complete|ultimate|remastered|edition)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

// Close enough to be the same game, but not a sequel ("Hades" must not match "Hades II").
function sameGame(a, b) {
  const x = norm(a), y = norm(b);
  return !!x && !!y && x === y;
}

async function steamMatch(title, fetchFn) {
  const url = 'https://store.steampowered.com/api/storesearch/?l=english&cc=us&term=' + encodeURIComponent(title.slice(0, 80));
  const res = await fetchFn(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('search failed');
  const j = await res.json();
  const hit = (j.items || []).find((i) => Number.isInteger(i.id) && sameGame(i.name, title));
  return hit ? { art: `${CDN}/${hit.id}/library_600x900.jpg`, artFallback: `${CDN}/${hit.id}/header.jpg` } : null;
}

async function xboxLogo(game, readFile) {
  const dir = game.installPath;
  if (!dir) return null;
  let man = '';
  try { man = await readFile(path.join(dir, 'appxmanifest.xml'), 'utf8'); } catch { return null; }
  const rel = (man.match(/Square150x150Logo="([^"]+)"/) || man.match(/<Logo>([^<]+)<\/Logo>/) || [])[1];
  if (!rel) return null;
  const base = rel.replace(/\.png$/i, '');
  for (const suffix of ['.scale-200', '.scale-400', '.scale-100', '']) {
    const file = path.win32.resolve(dir, base + suffix + '.png');
    if (!isInside(dir, file)) continue;
    try {
      const buf = await readFile(file);
      if (buf.length && buf.length <= MAX_LOGO) return 'data:image/png;base64,' + buf.toString('base64');
    } catch { /* try next */ }
  }
  return null;
}

class ArtCache {
  constructor(dir) {
    this.file = path.join(dir, 'art-cache.json');
    this.data = {};
    try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { /* first run */ }
  }
  save() {
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.data)); } catch { /* best effort */ }
  }
}

// Copies cached art onto the games (instant, offline).
function apply(games, cache) {
  for (const g of games) {
    const c = cache.data[g.id];
    if (c && !g.art) Object.assign(g, { art: c.art || null, artFallback: c.artFallback || null, icon: c.icon || null });
  }
}

// Looks up art for games that still have none. Returns true if anything new was found.
async function fill(games, cache, { online = true, fetchFn = globalThis.fetch, readFile = fs.promises.readFile, getIcon } = {}) {
  const todo = games.filter((g) => {
    if (g.art) return false;
    const c = cache.data[g.id];
    return !(c && Date.now() - c.at < (c.art || c.icon ? 30 : 7) * DAY);
  });
  let found = false;
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const g = todo[next++];
      const entry = { at: Date.now(), art: null, artFallback: null, icon: null };
      try {
        if (g.launcher === 'xbox') entry.icon = (await xboxLogo(g, readFile)) || null;
        if (!entry.icon && online && fetchFn) Object.assign(entry, (await steamMatch(g.title, fetchFn)) || {});
        if (!entry.art && !entry.icon && g.exe && getIcon) entry.icon = await getIcon(g.exe);
      } catch { entry.at = Date.now() - 6 * DAY; /* network hiccup: retry tomorrow */ }
      cache.data[g.id] = entry;
      if (entry.art || entry.icon) found = true;
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  if (todo.length) cache.save();
  return found;
}

module.exports = { ArtCache, apply, fill, norm, sameGame };
