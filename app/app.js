const view = document.querySelector('#view');
let generation = 0;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function route() {
  const turn = ++generation;
  window.__shotReady = false;
  const part = location.hash.slice(1).split('?');
  const path = part[0] || '/';
  const query = new URLSearchParams(part[1]);
  const match = path.match(/^\/bounty\/([^/]+)(\/leaderboard)?\/?$/);
  const person = path.match(/^\/u\/([^/]+)\/?$/);
  const kind = match ? (match[2] ? 'leaderboard' : 'bounty') : person ? 'profile' : 'board';
  document.body.dataset.view = kind;
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.dataset.nav === kind) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const mount = document.createElement('div');
  mount.className = 'route';
  view.replaceChildren(mount);
  view.setAttribute('aria-busy', 'true');
  mount.innerHTML = '<div class="state" role="status"><span class="loader" aria-hidden="true"></span><h1>Getting the latest…</h1><p>Reading the public make.fun board.</p><button type="button">Retry</button></div>';
  mount.querySelector('button').onclick = route;
  window.scrollTo(0, 0);
  let module;
  try {
    if (match) {
      const slug = decodeURIComponent(match[1]);
      document.querySelector('#bounty-nav').href = '#/bounty/' + encodeURIComponent(slug);
      document.querySelector('#leaderboard-nav').href = '#/bounty/' + encodeURIComponent(slug) + '/leaderboard';
      module = match[2] ? await import('./views/leaderboard.js') : await import('./views/bounty.js');
      await module.render(mount, {slug, query, retry: route});
    } else if (person) {
      module = await import('./views/profile.js');
      await module.render(mount, {username: decodeURIComponent(person[1]), query, retry: route});
    } else if (path === '/') {
      module = await import('./views/board.js');
      await module.render(mount, {query, retry: route});
    } else {
      throw new Error('This route does not exist. Use Bounties to find your way back.');
    }
  } catch (error) {
    mount.innerHTML = `<div class="state error" role="alert"><span class="state-symbol" aria-hidden="true">!</span><p class="eyebrow">CONNECTION INTERRUPTED</p><h1>We couldn’t load this view.</h1><p>${escape(error.message || 'Please try again.')}</p><div class="actions"><button class="primary" type="button">Retry</button><a class="button" href="#/">Back to bounties</a></div></div>`;
    mount.querySelector('button').onclick = !module && error instanceof TypeError ? () => location.reload() : route;
  } finally {
    if (turn === generation) {
      view.setAttribute('aria-busy', 'false');
      window.__shotReady = true;
    }
  }
}
window.addEventListener('hashchange', route);
document.querySelector('.skip').onclick = event => { event.preventDefault(); view.focus(); };
route();
