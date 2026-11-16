import { profile, ranking } from '../api.js';
import { esc, money, number, profileURL, bountyURL, load, empty, date, markdown, metric, score, avatarURL, pagination, notice, badge } from '../ui.js';

export async function render(ctx) {
  ctx.root.classList.add('profile-view');
  await load(ctx, 'Builder profile', async () => {
    const [person, standing] = await Promise.allSettled([profile(ctx.value), ranking(ctx.value)]);
    if (person.status === 'rejected') throw person.reason;
    return { ...person.value, data: { person: person.value.data, standing: standing.status === 'fulfilled' ? standing.value : null } };
  }, async ({ person: p, standing }, warning) => {
    if (!p?.handle) { ctx.root.innerHTML = empty('No profile available.', 'This public account has not published a profile.'); return; }
    document.title = `@${p.handle} — make.fun`;
    const record = { ...p.record, ...standing?.data.account?.record }, solutions = p.solutions || [];
    const account = standing?.data.account;
    const avatar = avatarURL(p);
    let page = 0, filter = 'all';
    const size = 12;
    ctx.root.innerHTML = `${warning}${standing ? notice(standing) : '<div class="notice warning">The global ranking is unavailable. The public profile is still shown. <button class="text-button" data-retry>Retry</button></div>'}<div class="profile-tools"><div class="breadcrumbs"><a href="#/">Bounties</a><span>/</span><span>Builder profile</span></div><form id="find-builder" class="profile-search"><label class="sr-only" for="handle">Find a builder by handle</label><input id="handle" name="handle" placeholder="Find a builder…" required maxlength="100" autocomplete="off"><button class="button" type="submit">Find ↗</button></form></div><section class="profile-hero"><div class="profile-avatar" aria-hidden="true"><span>${esc(p.handle.slice(0, 2).toUpperCase())}</span>${avatar ? `<img crossorigin="anonymous" src="${esc(avatar)}" alt="" width="88" height="88" referrerpolicy="no-referrer">` : ''}</div><div class="profile-identity"><p class="eyebrow">The people behind the work${p.house ? ' · House account' : ''}</p><h1>${esc(p.display_name || p.handle)}<span class="accent">.</span></h1><p class="handle">@${esc(p.handle)} <span>· Joined ${date(p.joined_at)} ${p.joined_at ? new Date(p.joined_at).getUTCFullYear() : ''}</span>${p.github_login ? `<span>· GitHub: ${esc(p.github_login)}</span>` : ''}</p>${p.bio ? `<div class="profile-bio prose">${markdown(p.bio)}</div>` : ''}</div><div class="global-rank"><span class="eyebrow">Global rank · wins</span><strong>${account?.rank == null ? '—' : '#' + number(account.rank)}</strong><span class="muted">${account?.rank == null ? (standing ? 'Not ranked yet' : 'Temporarily unavailable') : 'of ' + number(standing.data.total) + ' ranked builders'}</span></div></section><div class="metric-strip five">${metric('Prize money', money(record.prize_usd), 'USDC · public record')}${metric('Entered', number(record.competitions_entered), 'Competitions')}${metric('Placed', number(record.competitions_placed), 'Paid placements')}${metric('Won', number(record.competitions_won), 'First-place finishes')}${metric('Best place', record.best_placement == null ? '—' : '#' + number(record.best_placement), 'Across resolved bounties')}</div><div class="section-heading"><div><h2>Results & solutions <span class="count">${number(solutions.length)}</span></h2></div><button class="text-button" data-refresh>↻ Refresh profile</button></div><div class="table-toolbar"><div class="segmented" role="group" aria-label="Filter solutions"><button data-filter="all" aria-pressed="true">All entries</button><button data-filter="placed" aria-pressed="false">Placed</button><button data-filter="wins" aria-pressed="false">Wins</button></div><div id="pages"></div></div><div id="solutions"></div><p class="table-footnote" id="solution-count" role="status"></p>`;
    const portrait = ctx.root.querySelector('.profile-avatar img');
    if (portrait) portrait.addEventListener('error', () => portrait.remove(), { once: true });
    ctx.root.querySelector('#find-builder').addEventListener('submit', event => {
      event.preventDefault();
      const handle = ctx.root.querySelector('#handle').value.trim().replace(/^@/, '');
      if (handle) location.hash = profileURL(handle);
    });
    function draw() {
      const filtered = solutions.filter(s => filter === 'all' || (filter === 'wins' ? s.placement === 1 : s.placement != null));
      const pages = Math.max(1, Math.ceil(filtered.length / size));
      ctx.root.querySelector('#pages').innerHTML = pagination(page, pages, 'Solutions');
      ctx.root.querySelector('#solutions').innerHTML = filtered.length ? `<div class="table-wrap"><table class="solutions-table"><caption class="sr-only">@${esc(p.handle)} public results and solutions</caption><colgroup><col class="rank-column"><col><col class="status-column"><col class="score-column"><col class="prize-column"></colgroup><thead><tr><th scope="col">Place</th><th scope="col">Bounty / solution</th><th scope="col">Status</th><th scope="col" class="numeric">Score</th><th scope="col" class="numeric">Prize</th></tr></thead><tbody>${filtered.slice(page * size, (page + 1) * size).map(s => `<tr><td><span class="rank ${s.placement && s.placement <= 3 ? 'top-rank' : ''}">${s.placement == null ? '—' : '#' + esc(s.placement)}</span></td><td><a class="solution-bounty" href="${bountyURL(s.competition?.slug || '')}">${esc(s.competition?.title || 'View bounty')}</a><span class="solution-title" title="${esc(s.title)}">${esc(s.title || 'Untitled entry')}</span></td><td>${badge(s.competition || {})}</td><td class="numeric score" title="${esc(s.score?.column?.title || 'Score')}">${esc(score(s.score?.value, s.score?.display, s.score?.column))}</td><td class="numeric ${Number(s.prize_usd) > 0 ? 'prize' : 'muted'}">${money(s.prize_usd)}</td></tr>`).join('')}</tbody></table></div>` : empty(filter === 'all' ? 'No public solutions yet.' : 'No results in this view.', filter === 'all' ? 'This builder’s entries will appear here when make.fun publishes them.' : 'Choose All entries to see this builder’s published work.');
      ctx.root.querySelector('#solution-count').textContent = `${filtered.length ? page * size + 1 : 0}–${Math.min((page + 1) * size, filtered.length)} of ${number(filtered.length)} solutions · Placements reflect resolved competitions. Judge scores are win-rate percentages.`;
    }
    ctx.root.querySelector('#pages').addEventListener('click', event => {
      const button = event.target.closest('[data-page]');
      if (!button || button.disabled) return;
      page += button.dataset.page === 'next' ? 1 : -1;
      draw();
      ctx.root.querySelector(`[data-page="${button.dataset.page}"]:not(:disabled)`)?.focus({ preventScroll: true });
    });
    ctx.root.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
      filter = button.dataset.filter; page = 0;
      ctx.root.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      draw();
    }));
    draw();
    if (portrait) await portrait.decode().catch(() => portrait.remove());
  });
}
