const view = document.querySelector('#view');
let generation = 0;
let controller;
const loaders = {
  board: () => import('./views/board.js'),
  bounty: () => import('./views/bounty.js'),
  leaderboard: () => import('./views/leaderboard.js'),
  profile: () => import('./views/profile.js')
};

async function route() {
  window.__shotReady = false;
  const turn = ++generation;
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const root = document.createElement('section');
  root.className = 'route';
  root.innerHTML = '<div class="state" role="status"><span class="loader" aria-hidden="true"></span><h1>Finding the good stuff…</h1><p>Loading live make.fun data.</p></div>';
  view.replaceChildren(root);
  view.setAttribute('aria-busy', 'true');
  const current = () => turn === generation;
  let kind, value;
  let pageLoaded = false;
  try {
    const path = location.hash.slice(1) || '/';
    if (path === '/') kind = 'board';
    else {
      const match = path.match(/^\/(bounty|u)\/([^/]+)(\/leaderboard)?\/?$/);
      if (!match || (match[1] === 'u' && match[3])) throw new Error('This page does not exist. Choose a destination from the navigation.');
      kind = match[1] === 'u' ? 'profile' : match[3] ? 'leaderboard' : 'bounty';
      value = decodeURIComponent(match[2]);
    }
    document.querySelectorAll('[data-nav]').forEach(link => {
      if (link.dataset.nav === kind) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      if (value && ['bounty', 'leaderboard'].includes(kind) && ['bounty', 'leaderboard'].includes(link.dataset.nav)) {
        link.href = `#/bounty/${encodeURIComponent(value)}${link.dataset.nav === 'leaderboard' ? '/leaderboard' : ''}`;
      }
    });
    const module = await loaders[kind]();
    pageLoaded = true;
    if (!current()) return;
    await module.render({ root, value, signal, current, retry: route });
  } catch (error) {
    if (!current()) return;
    root.innerHTML = '<div class="state" role="alert"><span class="state-symbol">↻</span><h1>We hit a little snag.</h1><p></p><button class="button primary">Retry</button> <a class="button" href="#/">Back to bounties</a></div>';
    root.querySelector('p').textContent = error.message || 'The page could not load. Check your connection and try again.';
    root.querySelector('button').addEventListener('click', pageLoaded ? route : () => location.reload());
  } finally {
    if (current()) {
      view.setAttribute('aria-busy', 'false');
      window.__shotReady = true;
    }
  }
}
window.addEventListener('hashchange', () => {
  if (location.hash === '#view') { view.focus(); return; }
  window.scrollTo(0, 0);
  route();
  view.focus({ preventScroll: true });
});
route();
