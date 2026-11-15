// Router and first-load logic. Views are ES modules pulled in with import() only when a
// route asks for them, so the first load stays the shell, its styles and this file.

import { api, knownSlugs, noteCache } from './api.js';

const view = document.getElementById('view');
const findForm = document.getElementById('find');
const findInput = document.getElementById('q');

const routes = [
  {
    re: /^\/$/,
    nav: 'board',
    load: () => import('./views/board.js'),
  },
  {
    re: /^\/closing$/,
    nav: 'closing',
    load: () => import('./views/board.js'),
    params: { filter: 'closing' },
  },
  {
    re: /^\/leaderboard$/,
    nav: 'leaderboard',
    redirect: true,
  },
  {
    re: /^\/bounty\/([^/]+)\/leaderboard$/,
    nav: 'leaderboard',
    load: () => import('./views/leaderboard.js'),
    params: (m) => ({ slug: safeDecode(m[1]) }),
    title: (p) => `${p.slug} · leaderboard`,
  },
  {
    re: /^\/bounty\/([^/]+)$/,
    nav: 'board',
    load: () => import('./views/bounty.js'),
    params: (m) => ({ slug: safeDecode(m[1]) }),
    title: (p) => `${p.slug} · make.fun`,
  },
  {
    re: /^\/u\/([^/]+)$/,
    nav: 'profiles',
    load: () => import('./views/profile.js'),
    params: (m) => ({ handle: safeDecode(m[1]) }),
    title: (p) => `@${p.handle} · make.fun`,
  },
  {
    re: /^\/u$/,
    nav: 'profiles',
    load: () => import('./views/profile.js'),
    params: {},
    title: () => 'People · make.fun',
  },
];

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const cut = raw.indexOf('?');
  const path = (cut === -1 ? raw : raw.slice(0, cut)).replace(/\/+$/, '') || '/';
  const query = new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1));
  return { raw, path, query };
}

function match(path) {
  for (const route of routes) {
    const found = route.re.exec(path);
    if (found) return { route, match: found };
  }
  return null;
}

function setActiveNav(name) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.getAttribute('data-nav') === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function focusHeading(host) {
  const heading = host.querySelector('h1');
  if (!heading) return;
  heading.classList.add('focus-target');
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  try {
    heading.focus({ preventScroll: true });
  } catch {
    /* older browsers */
  }
}

function notFound(host, path) {
  host.innerHTML = `<div class="route">
    <p class="eyebrow">404</p>
    <h1 style="font-size:30px">Nothing at <span class="mono">${esc(path)}</span></h1>
    <p class="lede">That route is not one of this client's four surfaces. The board is a good place to start.</p>
    <p><a class="btn primary" href="#/">Bounties</a> <a class="btn" href="#/closing">Closing soon</a> <a class="btn" href="#/leaderboard">Leaderboards</a> <a class="btn" href="#/u">People</a></p>
  </div>`;
}

function failed(host, err) {
  host.innerHTML = `<div class="route">
    <p class="eyebrow">Something broke</p>
    <h1 style="font-size:28px">This view did not load</h1>
    <p class="lede">${esc(err && err.message ? err.message : String(err))}</p>
    <p class="dim">The app reads make.fun's public API; a hiccup there is usually brief.</p>
    <p><a class="btn primary" href="${esc(location.hash || '#/')}">Try again</a> <a class="btn" href="#/">Bounties</a></p>
  </div>`;
}

// Escaping for the two strings this file writes itself.
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

let token = 0;
let controller = null;
let booted = false;
let lastPath = null;

async function featuredLeaderboard() {
  let slug = 'makefun-frontend-01';
  try {
    const board = await api.board('open');
    const items = (board && board.items) || [];
    const preferred = items.find((i) => i.slug === slug);
    slug = (preferred || items.find((i) => i.status === 'open') || {}).slug || slug;
  } catch {
    /* keep the default */
  }
  return slug;
}

async function render() {
  const { raw, path, query } = parseHash();

  // In-page anchors (the skip link) are not routes.
  if (raw && !raw.startsWith('/')) {
    if (!booted) location.replace('#/');
    return;
  }

  const my = ++token;
  window.__shotReady = false;
  if (controller) controller.abort();
  controller = new AbortController();

  const found = match(path);
  setActiveNav(found ? found.route.nav : null);
  document.documentElement.dataset.route = found ? found.route.nav : '404';

  const host = document.createElement('div');
  host.className = 'wrap';
  view.replaceChildren(host);
  view.setAttribute('aria-busy', 'true');

  if (!found) {
    notFound(host, path);
    document.title = 'Not found · make.fun';
    if (booted && lastPath !== path) window.scrollTo(0, 0);
    lastPath = path;
    booted = true;
    view.setAttribute('aria-busy', 'false');
    window.__shotReady = true;
    noteCache();
    return;
  }

  const route = found.route;
  const params = Object.assign({}, route.params && typeof route.params === 'object' ? route.params : {}, Object.fromEntries(query));
  if (typeof route.params === 'function') Object.assign(params, route.params(found.match));

  if (route.redirect) {
    const slug = await featuredLeaderboard();
    const extra = query.get('view') ? `?view=${encodeURIComponent(query.get('view'))}` : '';
    location.replace(`#/bounty/${encodeURIComponent(slug)}/leaderboard${extra}`);
    view.setAttribute('aria-busy', 'false');
    window.__shotReady = true;
    return;
  }

  try {
    const mod = await route.load();
    if (my !== token) return;
    await mod.default(host, params, { signal: controller.signal });
    if (my !== token) return;

    if (route.title) document.title = route.title(params);
    focusHeading(host);
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    if (my !== token) return;
    failed(host, err);
  } finally {
    view.setAttribute('aria-busy', 'false');
    if (my === token) {
      if (booted && lastPath !== path) window.scrollTo(0, 0);
      lastPath = path;
      booted = true;
      window.__shotReady = true;
      noteCache();
    }
  }
}

findForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = findInput.value.trim().replace(/^@/, '');
  if (!value) return;
  const slug = knownSlugs().has(value) ? value : null;
  location.hash = slug ? `#/bounty/${encodeURIComponent(slug)}` : `#/u/${encodeURIComponent(value)}`;
  findInput.blur();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = (event.target && event.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  event.preventDefault();
  findInput.focus();
  findInput.select();
});

window.addEventListener('hashchange', render);

window.__shotReady = false;
render();