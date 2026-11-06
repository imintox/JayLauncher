const fs = require('fs');
const path = require('path');

// Simple JSON store: { scanned: [], manual: [], meta: { [id]: { fav, lastPlayed, hidden } } }
class Library {
  constructor(dir) {
    this.file = path.join(dir, 'library.json');
    this.data = { scanned: [], manual: [], meta: {} };
    try { this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; } catch { /* first run */ }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  setScanned(games) {
    this.data.scanned = games;
    this.save();
  }

  addManual(game) {
    this.data.manual = this.data.manual.filter((g) => g.id !== game.id).concat(game);
    this.save();
  }

  patchMeta(id, patch) {
    this.data.meta[id] = { ...(this.data.meta[id] || {}), ...patch };
    this.save();
  }

  find(id) {
    return [...this.data.scanned, ...this.data.manual].find((g) => g.id === id);
  }

  hidden() {
    return [...this.data.scanned, ...this.data.manual]
      .map((g) => ({ ...g, ...(this.data.meta[g.id] || {}) }))
      .filter((g) => g.hidden)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  unhideAll() {
    for (const id of Object.keys(this.data.meta)) if (this.data.meta[id].hidden) this.data.meta[id].hidden = false;
    this.save();
  }

  all() {
    return [...this.data.scanned, ...this.data.manual]
      .map((g) => ({ ...g, ...(this.data.meta[g.id] || {}) }))
      .filter((g) => !g.hidden)
      .sort((a, b) => a.title.localeCompare(b.title));
  }
}

module.exports = { Library };
