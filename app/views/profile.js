import {get, picture} from '../api.js';
import {esc, money, number, date, bountyURL, profileURL, badge, score, empty, retryButtons, pagination, wirePages, breadcrumbs, refreshButton} from '../ui.js';
export async function render(root, {username, retry}) {
  const p = await get('/api/profiles/' + encodeURIComponent(username));
  const record = p.record || {}, solutions = p.solutions || [];
  let page = 0, search = '', filter = 'all';
  const size = 15;
  if (!root.isConnected) return;
  document.title = `@${p.handle} — Fieldwork`;
  if (root.isConnected) document.querySelector('#profile-nav').href = profileURL(p.handle);
  root.innerHTML = `${breadcrumbs([['Builders', null], ['@' + p.handle, null]])}<section class="profile-hero"><div class="avatar-frame"><img class="avatar" src="${picture(p.handle)}" width="88" height="88" alt="${esc(p.handle)}’s public avatar"><span class="avatar-fallback" aria-hidden="true">${esc(p.handle.slice(0,2).toUpperCase())}</span></div><div class="profile-identity"><p class="eyebrow">BUILDER PROFILE ${p.house ? ' / HOUSE' : ''}</p><h1>${esc(p.display_name || p.handle)}</h1><p class="handle">@${esc(p.handle)} <span>· Joined ${date(p.joined_at)}</span></p>${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : '<p class="bio muted">Building in the open. Every entry leaves a record.</p>'}</div>${refreshButton()}</section>
    <div class="profile-stats">${[['Competitions entered', record.competitions_entered],['Placed',record.competitions_placed],['Wins',record.competitions_won],['Best finish',record.best_placement ? '#' + record.best_placement : '—'],['Prizes paid',money(record.prize_usd)]].map(([label,value]) => `<div><span class="eyebrow">${label}</span><strong>${esc(value ?? '—')}</strong></div>`).join('')}</div>
    <div class="profile-layout"><section><div class="section-heading"><h2>The work <span class="count">${solutions.length}</span></h2><span class="muted">Public submissions</span></div><div class="profile-toolbar"><div class="filters" role="group" aria-label="Filter submissions"><button data-filter="all" aria-pressed="true">All entries</button><button data-filter="placed" aria-pressed="false">Placed</button></div><label class="search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search the work…" aria-label="Search submissions"></label></div><div id="profile-results" aria-live="polite"></div><div id="profile-pages"></div></section><aside class="profile-aside"><section class="schedule-panel"><p class="eyebrow">BUILDER RECORD</p><dl><div><dt>Podium finishes</dt><dd>${number(record.podium_finishes)}</dd></div><div><dt>Other placements</dt><dd>${number(record.other_placements)}</dd></div>${p.github_login ? `<div><dt>GitHub identity</dt><dd>${esc(p.github_login)}</dd></div>` : ''}${p.x ? `<div><dt>X identity</dt><dd>${esc(typeof p.x === 'string' ? p.x : p.x.username || p.x.handle || 'Connected')}</dd></div>` : ''}${p.wallet ? `<div><dt>Linked wallet</dt><dd class="wallet" title="${esc(p.wallet.address)}">${esc(p.wallet.address.slice(0,6))}…${esc(p.wallet.address.slice(-6))}</dd></div>` : ''}</dl></section><section class="payouts"><p class="eyebrow">RECENT PAYOUTS</p>${(p.payouts || []).slice(0,8).map(pay => `<div class="payout"><div><a href="${bountyURL(pay.competition.slug)}">${esc(pay.competition.title)}</a><small>${date(pay.paid_at)} · Place ${pay.place}</small></div><strong>${money(pay.amount_usd)}</strong></div>`).join('') || '<p class="muted">No public payouts yet.</p>'}</section></aside></div>`;
  const avatar = root.querySelector('.avatar');
  avatar.addEventListener('error', () => { avatar.hidden = true; });
  function draw() {
    const rows = solutions.filter(s => (filter === 'all' || s.placement != null) && `${s.title} ${s.competition?.title}`.toLowerCase().includes(search));
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / size) - 1));
    root.querySelector('#profile-results').innerHTML = rows.length ? `<div class="solution-list">${rows.slice(page * size, (page + 1) * size).map(s => {
      const c = s.competition || {};
      const label = c.refunded ? 'Refunded' : s.placement ? 'Placed #' + s.placement : c.status === 'resolved' ? 'Completed' : s.score ? 'Scored' : 'Submitted';
      return `<article class="solution"><div class="solution-main"><a class="solution-title" href="${bountyURL(c.slug)}/leaderboard">${esc(s.title || 'Untitled entry')}</a><div class="solution-meta"><a href="${bountyURL(c.slug)}">${esc(c.title)}</a><span>${date(s.entered_at)}</span></div></div><div class="solution-result">${badge(label, s.placement ? 'green' : s.score ? 'amber' : '')}<span class="solution-score" title="${esc(s.prize_usd != null ? 'Prize amount' : s.score?.column?.title || 'Scoring status')}">${s.prize_usd != null ? money(s.prize_usd) : s.score ? score(s.score.value, s.score.column?.key, s.score.display) : 'Awaiting score'}</span></div></article>`;
    }).join('')}</div>` : empty('No public submissions found', 'Try another filter or check back after this builder enters a bounty.');
    root.querySelector('#profile-pages').innerHTML = pagination(page, rows.length, size);
    wirePages(root.querySelector('#profile-pages'), next => { page = next; draw(); });
    retryButtons(root, retry);
  }
  root.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; page = 0; root.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); draw(); });
  root.querySelector('input[type=search]').oninput = e => { search = e.target.value.trim().toLowerCase(); page = 0; draw(); };
  draw();
  if (!avatar.complete) await Promise.race([new Promise(resolve => { avatar.addEventListener('load', resolve, {once:true}); avatar.addEventListener('error', resolve, {once:true}); }), new Promise(resolve => setTimeout(resolve, 4000))]);
}
