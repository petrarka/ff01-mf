import { board } from '../api.js';
import { esc, number, money, bountyURL, badge, fee, glyph, categoryClass, state, timeLeft, date, load, empty } from '../ui.js';

function card(b) {
  return `<article class="bounty-card"><div class="card-top"><span class="category-icon ${categoryClass(b.category)}" aria-hidden="true">${glyph(b.category)}</span><span class="category-name">${esc(b.category)}</span>${badge(b)}</div><h2><a href="${bountyURL(b.slug)}">${esc(b.title)}</a></h2><p class="card-summary">${esc(b.summary || b.description || 'Explore the brief, rewards and leaderboard.')}</p><div class="card-reward"><strong>${money(b.potUsd ?? b.rewardAmount)}<small> USDC</small></strong><span>${esc(fee(b))}</span></div><div class="card-bottom"><span title="${esc(date(b.deadline, true))}" class="${state(b)[0] === 'soon' ? 'closing' : ''}">◷ ${esc(timeLeft(b))}</span><span>${number(b.submissionCount)} entries</span><a href="${bountyURL(b.slug)}/leaderboard" aria-label="Leaderboard for ${esc(b.title)}">↗</a></div></article>`;
}
export async function render(ctx) {
  await load(ctx, 'The build board', () => board(), async (data, warning) => {
    let items = data.items || [], cursor = data.next_cursor, shown = 9;
    const active = items.filter(b => ['open', 'soon'].includes(state(b)[0]));
    const featured = items.find(b => b.slug === 'makefun-frontend-01') || active[0] || items[0];
    ctx.root.innerHTML = `${warning}<section class="board-hero"><div><p class="eyebrow"><span class="accent">01 /</span> A playground for ambitious ideas</p><h1>Build something<br> <span class="serif">worth making.</span><span class="accent">↗</span></h1><p class="hero-copy">Real challenges. Open competition. Rewards for the work.<br> Find your next reason to make something.</p><div class="hero-stats"><span><b>${active.length}</b> accepting entries</span><span><b>${money(active.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0))}</b> in live pots</span><span class="live-label"><i class="dot"></i> Live from make.fun</span></div></div>${featured ? `<aside class="spotlight"><div class="spotlight-top"><span class="eyebrow">In the spotlight</span><span aria-hidden="true">✳</span></div><a class="spotlight-title" href="${bountyURL(featured.slug)}">${esc(featured.title)} <span>↗</span></a><div class="spotlight-bottom"><div><span class="eyebrow">Live reward pot</span><strong>${money(featured.potUsd ?? featured.rewardAmount)}</strong></div><div>${badge(featured)}<span>${esc(fee(featured))} · ${number(featured.submissionCount)} entries</span></div></div></aside>` : ''}</section><section aria-labelledby="board-heading"><div class="section-heading"><div><span class="eyebrow">Find your next challenge</span><h2 id="board-heading">The bounty board <span class="count">${items.length}${cursor ? '+' : ''}</span></h2></div><button class="text-button" data-refresh>↻ Refresh board</button></div><div class="board-tools"><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Search bounties, skills, ideas…" aria-label="Search bounties"></label><label class="select-label">Status<select id="status"><option value="all">All statuses</option><option value="active">Accepting entries</option><option value="soon">Closing soon</option><option value="closed">Entries closed</option><option value="resolved">Resolved</option><option value="upcoming">Upcoming</option></select></label><label class="select-label">Sort<select id="sort"><option value="deadline">Deadline</option><option value="reward">Highest reward</option><option value="entries">Most entries</option><option value="newest">Newest</option></select></label></div><div class="category-filters" role="group" aria-label="Filter by category">${['All', ...new Set(items.map(b => b.category).filter(Boolean))].map(c => `<button data-category="${esc(c)}" aria-pressed="${c === 'All'}">${esc(c)}</button>`).join('')}</div><p id="results-label" class="results-label" role="status"></p><div class="card-grid" id="cards"></div><div class="load-more"><button class="button" id="more">Show more bounties <span>↓</span></button><p id="page-note" class="muted"></p></div></section>`;
    let category = 'All';
    const search = ctx.root.querySelector('#search'), status = ctx.root.querySelector('#status'), sort = ctx.root.querySelector('#sort'), more = ctx.root.querySelector('#more');
    function draw() {
      const query = search.value.trim().toLowerCase();
      const filtered = items.filter(b => (category === 'All' || b.category === category) && (!query || [b.title, b.summary, ...(b.skills || [])].join(' ').toLowerCase().includes(query)) && (status.value === 'all' || (status.value === 'active' ? ['open', 'soon'].includes(state(b)[0]) : state(b)[0] === status.value)));
      filtered.sort((a, b) => {
        if (sort.value === 'reward') return Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount);
        if (sort.value === 'entries') return (b.submissionCount || 0) - (a.submissionCount || 0);
        if (sort.value === 'newest') return Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0);
        const priority = b => ['open', 'soon'].includes(state(b)[0]) ? 0 : state(b)[0] === 'upcoming' ? 1 : 2;
        return priority(a) - priority(b) || (priority(a) < 2 ? Date.parse(a.deadline) - Date.parse(b.deadline) : Date.parse(b.deadline) - Date.parse(a.deadline));
      });
      ctx.root.querySelector('#cards').innerHTML = filtered.length ? filtered.slice(0, shown).map(card).join('') : empty('Nothing here just yet.', 'Try a different search or category, or retry the live board.');
      ctx.root.querySelector('#results-label').textContent = `${filtered.length} matching ${filtered.length === 1 ? 'bounty' : 'bounties'}${cursor ? ' in loaded results' : ''} · Rewards shown in USDC`;
      more.hidden = shown >= filtered.length && !cursor;
      ctx.root.querySelector('#page-note').textContent = `Showing ${Math.min(shown, filtered.length)} of ${filtered.length}${cursor ? '+ loaded matches' : ''}`;
    }
    [search, status, sort].forEach(control => control.addEventListener(control === search ? 'input' : 'change', () => { shown = 9; draw(); }));
    ctx.root.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
      category = button.dataset.category; shown = 9;
      ctx.root.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      draw();
    }));
    more.addEventListener('click', async () => {
      more.disabled = true;
      try {
        if (cursor) {
          const next = await board(cursor);
          const seen = new Set(items.map(b => b.slug));
          items.push(...(next.data.items || []).filter(b => !seen.has(b.slug)));
          cursor = next.data.next_cursor;
        }
        shown += 9; draw();
      } catch (error) { ctx.root.querySelector('#page-note').textContent = `${error.message} Use Show more to retry.`; }
      finally { more.disabled = false; }
    });
    draw();
  });
}
