let games = [];
let launcher = 'all';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

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
  for (const n of names) {
    const b = el('button', 'chip' + (n === launcher ? ' on' : ''), n);
    b.type = 'button';
    b.onclick = () => { launcher = n; render(); };
    nav.append(b);
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
    meta.append(el('div', 'title', g.title), el('div', 'src', g.launcher));
    meta.firstChild.title = g.title;

    const play = el('button', 'play', 'Play');
    play.type = 'button';
    play.onclick = async () => { await window.api.launch(g.id); games = await window.api.get(); render(); };

    const fav = el('button', '', g.fav ? '★' : '☆');
    fav.type = 'button';
    fav.title = 'Favorite';
    fav.onclick = async () => { games = await window.api.fav(g.id, !g.fav); render(); };

    const hide = el('button', '', '✕');
    hide.type = 'button';
    hide.title = 'Hide from library';
    hide.onclick = async () => { games = await window.api.hide(g.id); render(); };

    const actions = el('div', 'actions');
    actions.append(play, fav, hide);
    card.append(artNode(g), meta, actions);
    grid.append(card);
  }
}

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

async function openSettings() {
  const { available, enabled, report = {} } = await window.api.getSettings();
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
  $('settings').showModal();
}

$('settingsBtn').onclick = openSettings;
$('settingsCancel').onclick = () => $('settings').close();
$('settingsForm').onsubmit = async () => {
  const picked = [...$('launcherList').querySelectorAll('input:checked')].map((i) => i.value);
  launcher = 'all';
  games = await window.api.setSettings(picked);
  render();
};

(async () => {
  games = await window.api.get();
  render();
  games = await window.api.scan();
  render();
})();
