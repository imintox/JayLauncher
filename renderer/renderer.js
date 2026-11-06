let games = [];
let launcher = 'all';
let prefs = {};

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (text, onclick, cls) => {
  const b = el('button', cls || '', text);
  b.type = 'button';
  b.onclick = onclick;
  return b;
};

/* ---------- library ---------- */

function visible() {
  const q = $('search').value.trim().toLowerCase();
  const sort = $('sort').value;
  const list = games.filter(
    (g) => (launcher === 'all' || g.launcher === launcher) && (!q || g.title.toLowerCase().includes(q))
  );
  if (sort === 'recent') list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  if (sort === 'fav') list.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.title.localeCompare(b.title));
  return list;
}

function renderFilters() {
  const nav = $('filters');
  nav.replaceChildren();
  const names = ['all', ...new Set(games.map((g) => g.launcher))];
  if (!names.includes(launcher)) launcher = 'all';
  for (const n of names) {
    nav.append(button(n, () => { launcher = n; render(); }, 'chip' + (n === launcher ? ' on' : '')));
  }
}

function artNode(g) {
  const wrap = el('div', 'art');
  const sources = [g.art, g.artFallback].filter(Boolean);
  if (!sources.length) { wrap.textContent = g.title; return wrap; }
  const img = el('img', 'art');
  img.alt = g.title;
  img.loading = 'lazy';
  let i = 0;
  img.src = sources[i];
  img.onerror = () => {
    i += 1;
    if (i < sources.length) img.src = sources[i];
    else wrap.replaceChildren(document.createTextNode(g.title));
  };
  wrap.replaceChildren(img);
  wrap.style.padding = '0';
  return wrap;
}

function render() {
  renderFilters();
  const list = visible();
  $('count').textContent = `(${list.length})`;
  $('empty').hidden = list.length > 0;
  const grid = $('grid');
  grid.replaceChildren();
  for (const g of list) {
    const card = el('article', 'card');
    const meta = el('div', 'meta');
    const title = el('div', 'title', g.title);
    title.title = g.title;
    meta.append(title, el('div', 'src', g.launcher));

    const play = button('Play', async () => { await window.api.launch(g.id); games = await window.api.get(); render(); }, 'play');
    const fav = button(g.fav ? '★' : '☆', async () => { games = await window.api.fav(g.id, !g.fav); render(); });
    fav.title = 'Favorite';
    const hide = button('✕', async () => { games = await window.api.hide(g.id); render(); });
    hide.title = 'Hide from library (undo in Settings)';

    const actions = el('div', 'actions');
    actions.append(play, fav, hide);
    card.append(artNode(g), meta, actions);
    grid.append(card);
  }
}

function applyPrefs() {
  document.body.dataset.size = prefs.cardSize || 'medium';
}

/* ---------- settings ---------- */

function renderFolders(folders) {
  const box = $('folderList');
  box.replaceChildren();
  if (!folders.length) box.append(el('p', 'hint', 'No custom folders yet.'));
  for (const f of folders) {
    const row = el('div', 'row');
    const text = el('div', 'grow');
    text.append(el('div', 'rowtitle', f.name), el('small', 'path', f.path));
    row.append(text, button('Remove', async () => {
      const r = await window.api.removeFolder(f.path);
      prefs = r.prefs; games = r.games;
      renderFolders(prefs.customFolders); render();
    }));
    box.append(row);
  }
}

async function renderHidden() {
  const box = $('hiddenList');
  box.replaceChildren();
  const hidden = await window.api.hidden();
  if (!hidden.length) { box.append(el('p', 'hint', 'No hidden games.')); return; }
  for (const g of hidden) {
    const row = el('div', 'row');
    const text = el('div', 'grow');
    text.append(el('div', 'rowtitle', g.title), el('small', 'path', g.launcher));
    row.append(text, button('Unhide', async () => { games = await window.api.unhide(g.id); render(); renderHidden(); }));
    box.append(row);
  }
  box.append(button('Unhide all', async () => { games = await window.api.unhideAll(); render(); renderHidden(); }));
}

async function openSettings() {
  const { available, enabled, report = {}, prefs: p } = await window.api.getSettings();
  prefs = p;
  const list = $('launcherList');
  list.replaceChildren();
  for (const l of available) {
    const row = el('label', 'opt');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = l.name;
    cb.checked = enabled.includes(l.name);
    const r = report[l.name];
    const note = !r ? '' : r.error ? 'error' : `${r.count} found`;
    row.append(cb, el('span', '', l.label), el('small', '', note));
    list.append(row);
  }
  renderFolders(prefs.customFolders || []);
  $('optStartup').checked = !!prefs.startWithWindows;
  $('optScan').checked = prefs.scanOnStart !== false;
  $('optClose').checked = !!prefs.closeOnLaunch;
  $('optUpdates').checked = prefs.autoUpdate !== false;
  $('optSize').value = prefs.cardSize || 'medium';
  $('optSort').value = prefs.defaultSort || 'title';
  renderHidden();
  $('settings').showModal();
}

const launcherBoxes = () => [...$('launcherList').querySelectorAll('input[type=checkbox]')];

$('settingsBtn').onclick = openSettings;
$('settingsCancel').onclick = () => $('settings').close();
$('selAll').onclick = () => launcherBoxes().forEach((c) => { c.checked = true; });
$('selNone').onclick = () => launcherBoxes().forEach((c) => { c.checked = false; });
$('addFolder').onclick = async () => {
  const r = await window.api.addFolder();
  if (!r) return;
  prefs = r.prefs; games = r.games;
  renderFolders(prefs.customFolders); render();
};
$('settingsForm').onsubmit = async () => {
  const r = await window.api.saveSettings({
    enabled: launcherBoxes().filter((c) => c.checked).map((c) => c.value),
    prefs: {
      startWithWindows: $('optStartup').checked,
      scanOnStart: $('optScan').checked,
      closeOnLaunch: $('optClose').checked,
      autoUpdate: $('optUpdates').checked,
      cardSize: $('optSize').value,
      defaultSort: $('optSort').value,
    },
  });
  prefs = r.prefs; games = r.games;
  launcher = 'all';
  $('sort').value = prefs.defaultSort;
  applyPrefs();
  render();
};

/* ---------- toolbar, updates ---------- */

$('search').oninput = render;
$('sort').onchange = render;
$('add').onclick = async () => { games = await window.api.addManual(); render(); };
$('rescan').onclick = async () => {
  const b = $('rescan');
  b.disabled = true; b.textContent = 'Scanning…';
  games = await window.api.scan();
  b.disabled = false; b.textContent = 'Rescan';
  render();
};

function showUpdate(s) {
  if (!s) return;
  const bar = $('updateBar');
  if (s.state === 'ready') {
    $('updateMsg').textContent = `Update ${s.version} is ready.`;
    $('updateBtn').hidden = false;
    bar.hidden = false;
  } else if (s.state === 'downloading') {
    $('updateMsg').textContent = `Downloading update ${s.version}…`;
    $('updateBtn').hidden = true;
    bar.hidden = false;
  } else {
    bar.hidden = true;
  }
  $('updateStatus').textContent =
    s.state === 'current' ? 'You have the latest version.' : s.state === 'error' ? 'Could not check for updates.' : '';
}
$('updateBtn').onclick = () => window.api.installUpdate();
$('checkUpdate').onclick = async () => {
  const r = await window.api.checkUpdate();
  $('updateStatus').textContent = r === 'dev' ? 'Updates only work in the installed app.' : 'Checking…';
};
window.api.onUpdate(showUpdate);
window.api.getUpdate().then(showUpdate);
window.api.version().then((v) => { $('ver').textContent = 'v' + v; });

(async () => {
  const s = await window.api.getSettings();
  prefs = s.prefs;
  applyPrefs();
  $('sort').value = prefs.defaultSort || 'title';
  games = await window.api.get();
  render();
  // Scan at startup unless turned off (still scan if the library is empty, e.g. first run).
  if (prefs.scanOnStart !== false || !games.length) {
    games = await window.api.scan();
    render();
  }
})();
