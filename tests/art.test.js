const assert = require('assert');
const os = require('os'), fs = require('fs'), path = require('path');
const art = require('../art');

(async () => {
  assert.ok(art.sameGame('The Witcher® 3: Wild Hunt', 'the witcher 3 wild hunt'));
  assert.ok(!art.sameGame('Hades', 'Hades II'));

  const cache = new art.ArtCache(fs.mkdtempSync(path.join(os.tmpdir(), 'a')));
  const games = [
    { id: 'e1', title: 'Hades', launcher: 'epic' },
    { id: 'e2', title: 'Obscure Indie', launcher: 'epic', exe: 'C:\\g\\o.exe' },
    { id: 's1', title: 'Portal', launcher: 'steam', art: 'x' },
  ];
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    const hades = url.includes('Hades');
    return { ok: true, json: async () => ({ items: hades ? [{ id: 1145360, name: 'Hades II' }, { id: 1145350, name: 'Hades' }] : [] }) };
  };
  const found = await art.fill(games, cache, { fetchFn, getIcon: async () => 'data:image/png;base64,AAA' });
  assert.ok(found);
  art.apply(games, cache);
  assert.ok(games[0].art.includes('/1145350/'), 'matched the exact title, not the sequel');
  assert.strictEqual(games[1].icon, 'data:image/png;base64,AAA');
  assert.strictEqual(calls, 2, 'Steam games are not looked up');

  await art.fill(games, cache, { fetchFn, getIcon: async () => null });
  assert.strictEqual(calls, 2, 'results are cached');

  const off = await art.fill([{ id: 'n', title: 'X', launcher: 'gog' }], cache, { online: false, fetchFn });
  assert.strictEqual(off, false);
  assert.strictEqual(calls, 2, 'offline mode makes no requests');
  console.log('art tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
