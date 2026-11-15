import { profile } from '../api.js';
import { esc, money, number, profileURL, bountyURL, load, empty, date, markdown, metric, categoryClass, glyph } from '../ui.js';

export async function render(ctx) {
  await load(ctx, 'Builder profile', () => profile(ctx.value), async (p, warning) => {
    if (!p?.handle) { ctx.root.innerHTML = empty('No profile available.', 'This public account has not published a profile.'); return; }
    document.title = `@${p.handle} — make.fun`;
    const record = p.record || {}, solutions = p.solutions || [];
    let shown = 12;
    ctx.root.innerHTML = `${warning}<div class="breadcrumbs"><a href="#/">Bounties</a><span>/</span><span>The builders</span></div><div class="profile-tools"><p class="eyebrow"><span class="accent">03 /</span> Meet the people making things</p><form id="find-builder" class="profile-search"><label class="sr-only" for="handle">Find a builder by handle</label><input id="handle" name="handle" placeholder="Find a builder by handle" required maxlength="100"><button class="button" type="submit">Find ↗</button></form></div><section class="profile-hero"><div class="profile-avatar" aria-hidden="true">${esc(p.handle.slice(0, 2).toUpperCase())}<span>✳</span></div><div><span class="eyebrow">Public builder profile${p.house ? ' · House account' : ''}</span><h1>${esc(p.display_name || p.handle)}<span class="accent">.</span></h1><p class="handle">@${esc(p.handle)} <span>· Joined ${date(p.joined_at)}</span></p>${p.bio ? `<div class="profile-bio prose">${markdown(p.bio)}</div>` : '<p class="muted">Making things and putting them to the test.</p>'}</div></section><div class="metric-strip">${metric('Bounties entered', number(record.competitions_entered))}${metric('Wins', number(record.competitions_won))}${metric('Paid placements', number(record.competitions_placed))}${metric('Prize total', money(record.prize_usd), 'USDC · public record')}</div><div class="section-heading"><div><p class="eyebrow">From the workbench</p><h2>Entries & submissions <span class="count">${solutions.length}</span></h2></div><button class="text-button" data-refresh>↻ Refresh profile</button></div><div id="solutions" class="solution-grid"></div><div class="load-more"><button id="more" class="button">Show more entries ↓</button><p class="muted" id="solution-count"></p></div>`;
    ctx.root.querySelector('#find-builder').addEventListener('submit', event => {
      event.preventDefault();
      const handle = ctx.root.querySelector('#handle').value.trim().replace(/^@/, '');
      if (handle) location.hash = profileURL(handle);
    });
    const more = ctx.root.querySelector('#more');
    function draw() {
      ctx.root.querySelector('#solutions').innerHTML = solutions.length ? solutions.slice(0, shown).map(s => `<article class="solution-card"><div class="card-top"><span class="category-icon ${categoryClass(s.competition?.category)}" aria-hidden="true">${glyph(s.competition?.category)}</span><span class="category-name">${esc(s.competition?.category || 'Entry')}</span><span class="tag">${s.placement == null ? 'Unplaced' : '#' + esc(s.placement)}</span></div><h3>${esc(s.title || 'Untitled entry')}</h3><a class="solution-bounty" href="${bountyURL(s.competition?.slug || '')}">${esc(s.competition?.title || 'View bounty')} ↗</a><div class="solution-score"><span>${esc(s.score?.column?.title || 'Score')}<strong>${esc(s.score?.display ?? s.score?.value ?? 'Not published')}</strong></span><span>Prize<strong>${money(s.prize_usd)}</strong></span></div><div class="card-bottom"><span>Entered ${date(s.entered_at)}</span><a href="${bountyURL(s.competition?.slug || '')}/leaderboard">Standings ↗</a></div></article>`).join('') : empty('A fresh page.', 'No public entries yet. This builder’s work will appear here when it is available.');
      more.hidden = shown >= solutions.length;
      ctx.root.querySelector('#solution-count').textContent = `Showing ${Math.min(shown, solutions.length)} of ${solutions.length} public entries`;
    }
    more.addEventListener('click', () => { shown += 12; draw(); });
    draw();
  });
}
