let games = [];
let launcher = 'all';
let prefs = {};
let animate = true; // card entrance animation only on first load / filter / scan, not every tiny update

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
const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

/* ---------- toasts ---------- */

function toast(msg, actionText, onAction) {
  const t = el('div', 'toast');
  t.append(el('span', '', msg));
  const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
  if (actionText) t.append(button(actionText, () => { close(); onAction(); }));
  $('toasts').append(t);
  setTimeout(close, actionText ? 7000 : 3000);
}

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
  const counts = {};
  for (const g of games) counts[g.launcher] = (counts[g.launcher] || 0) + 1;
  const names = ['all', ...Object.keys(counts).sort()];
  if (!names.includes(launcher)) launcher = 'all';
  for (const n of names) {
    const chip = button(n, () => { launcher = n; animate = true; render(); }, 'chip' + (n === launcher ? ' on' : ''));
    chip.append(el('small', '', n === 'all' ? games.length : counts[n]));
    nav.append(chip);
  }
}

function artNode(g) {
  const wrap = el('div', 'art');
  wrap.style.setProperty('--h', hue(g.title));
  wrap.append(el('span', 'initial', (g.title.match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase()));
  const sources = [g.art, g.artFallback].filter(Boolean);
  if (!sources.length) return wrap;
  const img = el('img');
  img.alt = '';
  img.loading = 'lazy';
  let i = 0;
  img.src = sources[0];
  img.onload = () => img.classList.add('in');
  img.onerror = () => { i += 1; if (i < sources.length) img.src = sources[i]; else img.remove(); };
  wrap.append(img);
  return wrap;
}

function render() {
  renderFilters();
  const list = visible();
  $('count').textContent = list.length ? String(list.length) : '';
  const empty = list.length === 0;
  $('empty').hidden = !empty;
  if (empty) {
    const searching = !!$('search').value.trim() || launcher !== 'all';
    $('emptyTitle').textContent = searching ? 'Nothing matches' : 'No games yet';
    $('emptyText').textContent = searching ? 'Try a different search or launcher.' : 'Pick your launchers or add a game folder in Settings.';
    $('emptySettings').hidden = searching;
  }
  const grid = $('grid');
  grid.classList.toggle('noanim', !animate);
  grid.replaceChildren();
  list.forEach((g, i) => {
    const card = el('article', 'card');
    card.style.setProperty('--i', Math.min(i, 24));
    const meta = el('div', 'meta');
    const title = el('div', 'title', g.title);
    title.title = g.title;
    meta.append(title, el('div', 'src', g.launcher));

    const play = button('Play', async () => {
      play.textContent = 'Launching…';
      card.classList.add('launching');
      const ok = await window.api.launch(g.id);
      if (!ok) toast(`Couldn't start ${g.title}`);
      setTimeout(async () => { animate = false; games = await window.api.get(); render(); }, 900);
    }, 'play primary');
    const fav = button(g.fav ? '★' : '☆', async () => {
      fav.classList.add('pop');
      games = await window.api.fav(g.id, !g.fav);
      animate = false;
      setTimeout(render, 250);
    }, 'icon' + (g.fav ? ' on' : ''));
    fav.title = 'Favorite';
    const ex = button('⊘', async () => {
      games = await window.api.exclude(g.id);
      animate = false;
      render();
      toast(`Excluded ${g.title}`, 'Undo', async () => { games = await window.api.include(g.id); animate = false; render(); });
    }, 'icon ex');
    ex.title = 'Exclude from library (include again in Settings)';

    const actions = el('div', 'actions');
    actions.append(play, fav, ex);
    card.append(artNode(g), meta, actions);
    grid.append(card);
  });
}

function applyPrefs() {
  document.body.dataset.size = prefs.cardSize || 'medium';
}

async function rescan(label) {
  const bar = $('scanBar');
  const b = $('rescan');
  bar.hidden = false;
  b.disabled = true; b.textContent = 'Scanning…';
  try { games = await window.api.scan(); } catch { toast('Scan failed'); }
  bar.hidden = true;
  b.disabled = false; b.textContent = 'Rescan';
  animate = true;
  render();
  if (label) toast(`Found ${games.length} games`);
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
      renderFolders(prefs.customFolders); animate = false; render();
    }));
    box.append(row);
  }
}

async function renderExcluded() {
  const box = $('excludedList');
  box.replaceChildren();
  const list = await window.api.excluded();
  if (!list.length) { box.append(el('p', 'hint', 'No excluded games.')); return; }
  for (const g of list) {
    const row = el('div', 'row');
    const text = el('div', 'grow');
    text.append(el('div', 'rowtitle', g.title), el('small', 'path', g.launcher));
    row.append(text, button('Include', async () => { games = await window.api.include(g.id); animate = false; render(); renderExcluded(); }));
    box.append(row);
  }
  box.append(button('Include all', async () => { games = await window.api.includeAll(); animate = false; render(); renderExcluded(); }));
}

const CHECKS = {
  optStartup: 'startWithWindows', optMinStart: 'startMinimized', optMinTray: 'minimizeToTray',
  optCloseTray: 'closeToTray', optMinLaunch: 'minimizeOnLaunch', optClose: 'closeOnLaunch',
  optScan: 'scanOnStart', optUpdates: 'autoUpdate',
};

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
  for (const [id, key] of Object.entries(CHECKS)) $(id).checked = key in { scanOnStart: 1, autoUpdate: 1 } ? prefs[key] !== false : !!prefs[key];
  $('optSize').value = prefs.cardSize || 'medium';
  $('optSort').value = prefs.defaultSort || 'title';
  renderExcluded();
  $('settings').showModal();
}

const launcherBoxes = () => [...$('launcherList').querySelectorAll('input[type=checkbox]')];

$('settingsBtn').onclick = openSettings;
$('emptySettings').onclick = openSettings;
$('settingsCancel').onclick = () => $('settings').close();
$('selAll').onclick = () => launcherBoxes().forEach((c) => { c.checked = true; });
$('selNone').onclick = () => launcherBoxes().forEach((c) => { c.checked = false; });
$('addFolder').onclick = async () => {
  const r = await window.api.addFolder();
  if (!r) return;
  prefs = r.prefs; games = r.games;
  renderFolders(prefs.customFolders); animate = true; render();
};

$('settingsForm').onsubmit = async () => {
  const out = {};
  for (const [id, key] of Object.entries(CHECKS)) out[key] = $(id).checked;
  out.cardSize = $('optSize').value;
  out.defaultSort = $('optSort').value;
  $('scanBar').hidden = false;
  const r = await window.api.saveSettings({ enabled: launcherBoxes().filter((c) => c.checked).map((c) => c.value), prefs: out });
  $('scanBar').hidden = true;
  prefs = r.prefs; games = r.games;
  launcher = 'all';
  $('sort').value = prefs.defaultSort;
  applyPrefs();
  animate = true;
  render();
  toast('Settings saved');
};

/* ---------- toolbar, updates ---------- */

$('search').oninput = () => { animate = false; render(); };
$('sort').onchange = () => { animate = true; render(); };
$('add').onclick = async () => { games = await window.api.addManual(); animate = true; render(); };
$('rescan').onclick = () => rescan(true);
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== $('search') && !$('settings').open) { e.preventDefault(); $('search').focus(); }
  else if (e.key === 'Escape' && document.activeElement === $('search')) { $('search').value = ''; $('search').blur(); animate = false; render(); }
});

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
window.api.onChanged(async () => { games = await window.api.get(); animate = true; render(); });
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
  if (prefs.scanOnStart !== false || !games.length) await rescan(false);
})();
