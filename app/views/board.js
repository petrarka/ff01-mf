import {get} from '../api.js';
import {esc, money, number, bountyURL, status, state, remaining, date, fee, empty, retryButtons, pagination, wirePages, refreshButton} from '../ui.js';
export async function render(root, {retry}) {
  let data = await get('/api/competitions?limit=60&activity=times');
  let items = data.items || [], cursor = data.next_cursor;
  let page = 0, filter = 'all', search = '', sort = 'deadline';
  const size = 9;
  if (!root.isConnected) return;
  document.title = 'Bounty board — Fieldwork';
  root.innerHTML = `<section class="board-hero"><div><p class="eyebrow"><span class="tiny-cross">✳</span> THE OPEN BUILD ECONOMY</p><h1>Build something<br>worth <em>winning.</em></h1><p class="intro">Find your next challenge. Follow the builders. Watch the results.</p></div><div class="board-metrics" aria-label="Board summary"></div></section>
    <section aria-label="Bounty board"><div class="section-heading"><h2>Explore bounties <span id="board-count" class="count"></span></h2>${refreshButton()}</div>
    <div class="board-toolbar"><div class="filters" role="group" aria-label="Bounty status"><button data-filter="all" aria-pressed="true">All bounties</button><button data-filter="open" aria-pressed="false">Open</button><button data-filter="closing" aria-pressed="false">Closing soon</button><button data-filter="closed" aria-pressed="false">Closed</button></div><div class="search-controls"><label class="search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Find a bounty…" aria-label="Search bounties"></label><select aria-label="Sort bounties"><option value="deadline">Closing first</option><option value="reward">Largest pot</option><option value="entries">Most entries</option><option value="newest">Newest</option></select></div></div>
    <div id="board-results" aria-live="polite"></div><div id="board-pages"></div><div id="more"></div></section>`;
  function draw() {
    const open = items.filter(b => ['Open', 'Closing soon'].includes(state(b)[0]));
    root.querySelector('.board-metrics').innerHTML = `<div class="metric-lead"><span class="eyebrow"><i class="live-dot"></i> LIVE OPPORTUNITY</span><strong>${money(open.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0))}</strong><span>across ${number(open.length)} open bounties${cursor ? ' loaded' : ''}</span></div><div class="metric-pair"><div><strong>${number(items.reduce((sum, b) => sum + b.submissionCount, 0))}</strong><span>entries${cursor ? ' loaded' : ' on the board'}</span></div><div><strong>${number(items.filter(b => b.status === 'resolved').length)}</strong><span>settled bounties</span></div></div>`;
    root.querySelector('#board-count').textContent = items.length + (cursor ? '+' : '');
    const result = items.filter(b => {
      const s = state(b)[0];
      return (filter === 'all' || filter === 'open' && ['Open','Closing soon'].includes(s) || filter === 'closing' && s === 'Closing soon' || filter === 'closed' && ['Closed','Final'].includes(s)) && `${b.title} ${b.category} ${b.skills?.join(' ')}`.toLowerCase().includes(search);
    }).sort((a,b) => {
      if (sort === 'reward') return Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount);
      if (sort === 'entries') return b.submissionCount - a.submissionCount;
      if (sort === 'newest') return new Date(b.publishedAt) - new Date(a.publishedAt);
      const live = b => ['Open','Closing soon'].includes(state(b)[0]) ? 0 : state(b)[0] === 'Upcoming' ? 1 : 2;
      return live(a) - live(b) || (live(a) < 2 ? new Date(a.deadline) - new Date(b.deadline) : new Date(b.deadline) - new Date(a.deadline));
    });
    page = Math.min(page, Math.max(0, Math.ceil(result.length / size) - 1));
    root.querySelector('#board-results').innerHTML = result.length ? `<div class="bounty-grid">${result.slice(page * size, (page + 1) * size).map(b => `<article class="bounty-card ${b.slug === 'makefun-frontend-01' ? 'featured' : ''}"><div class="card-top"><span class="category"><span class="category-glyph" aria-hidden="true">${({Code:'⌘',Games:'♜',Growth:'↗',Forecasting:'⌁',Trading:'↗',Security:'◇',Automation:'⚙'})[b.category] || '✳'}</span>${esc(b.category)}</span>${status(b)}</div><h3><a href="${bountyURL(b.slug)}">${esc(b.title)}</a></h3><div class="card-money"><strong>${money(b.potUsd ?? b.rewardAmount)}</strong><span>USDC pot</span><span class="fee">${fee(b)}</span></div><div class="card-bottom"><span>${number(b.submissionCount)} entries</span><time datetime="${esc(b.deadline)}" title="${date(b.deadline)}">${remaining(b.deadline)}</time><a href="${bountyURL(b.slug)}/leaderboard" aria-label="Standings for ${esc(b.title)}">↗</a></div></article>`).join('')}</div>` : empty('No bounties found', 'Try another search or status filter.');
    root.querySelector('#board-pages').innerHTML = pagination(page, result.length, size, 'bounties');
    wirePages(root.querySelector('#board-pages'), next => { page = next; draw(); root.querySelector('.section-heading').scrollIntoView({block:'start'}); });
    root.querySelector('#more').innerHTML = cursor ? '<button type="button" class="load-more">Load more bounties from make.fun</button>' : '';
    root.querySelector('.load-more')?.addEventListener('click', async event => {
      const button = event.currentTarget; button.disabled = true; button.textContent = 'Loading more…';
      window.__shotReady = false;
      try {
        data = await get('/api/competitions?limit=60&activity=times&cursor=' + encodeURIComponent(cursor));
        items = [...new Map([...items, ...data.items].map(b => [b.slug,b])).values()]; cursor = data.next_cursor; draw();
      } catch (error) { button.disabled = false; button.textContent = 'Retry loading more'; button.setAttribute('title', error.message); }
      finally { if (root.isConnected) window.__shotReady = true; }
    });
    retryButtons(root, retry);
  }
  root.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => {
    filter = button.dataset.filter; page = 0;
    root.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); draw();
  });
  root.querySelector('input[type=search]').oninput = e => { search = e.target.value.trim().toLowerCase(); page = 0; draw(); };
  root.querySelector('select').onchange = e => { sort = e.target.value; page = 0; draw(); };
  draw();
}
