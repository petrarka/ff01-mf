import { leaderboard } from '../api.js';
import { esc, number, bountyURL, profileURL, load, empty, breadcrumbs, tabs, metric, date } from '../ui.js';

export async function render(ctx) {
  ctx.root.classList.add('leaderboard-view');
  const fetcher = () => leaderboard(ctx.value);
  await load(ctx, 'Leaderboard', fetcher, async (data, warning) => {
    let shown = 20;
    const rows = [...(data.entries || []), ...(data.rest || [])];
    const column = data.columns?.find(c => c.key === data.rank_key);
    const score = row => (typeof row.display === 'string' ? row.display : row.display?.[data.rank_key]) ?? row.value ?? row.values?.[data.rank_key] ?? '—';
    const competition = data.competition || {};
    ctx.root.innerHTML = `${warning}${breadcrumbs('Leaderboard', ctx.value)}<section class="leader-hero"><div><p class="eyebrow"><span class="accent">02 /</span> The work speaks for itself</p><h1>The leaderboard<span class="accent">.</span></h1><a class="back-link" href="${bountyURL(ctx.value)}">${esc(competition.title || ctx.value)} <span>↗</span></a></div><div class="leader-stamp" aria-hidden="true"><span>MAKE</span><b>✳</b><span>YOUR MARK</span></div></section><div class="metric-strip three">${metric('Entries on this board', number(rows.length), 'In the order published by make.fun')}${metric('Scoring', column?.title || data.rank_key || 'Not announced', data.view || 'Performance')}${metric('Current phase', data.phase?.title || 'Not announced', data.phase?.finalized_at ? 'Finalized ' + date(data.phase.finalized_at) : 'Live · results may change')}</div>${tabs(ctx.value, 'leaderboard')}<div class="notice ${data.phase?.placements_held ? 'warning' : ''}"><span class="notice-symbol">ⓘ</span>${data.phase?.scores_visible === false ? 'Scores are not public yet. The board will appear when make.fun releases them.' : data.phase?.placements_held ? 'Development standings are provisional. Final places will be confirmed after judging.' : 'Ranks and scores are shown exactly as make.fun publishes them.'}</div><div class="section-heading"><div><h2>${esc(data.phase?.title || 'Current')} standings</h2><p class="muted">${esc(column?.title || 'Score')} · ${column?.sorting === 'asc' ? 'Lower' : 'Higher'} is better${data.rank_key === 'judge' ? ' · millionths' : ''}</p></div><button class="text-button" data-refresh>↻ Refresh standings</button></div><div id="rankings"></div><div class="load-more"><button class="button" id="more">Show more entries ↓</button><p class="muted" id="entry-count"></p></div>`;
    const target = ctx.root.querySelector('#rankings'), more = ctx.root.querySelector('#more');
    function draw() {
      target.innerHTML = rows.length ? `<div class="table-wrap"><table class="leader-table"><caption class="sr-only">${esc(competition.title)} rankings</caption><thead><tr><th scope="col">Rank</th><th scope="col">Builder / entry</th><th scope="col" class="numeric">${esc(column?.title || 'Score')}</th><th scope="col" class="numeric interval-col">Score interval</th><th scope="col" class="numeric">Prize rank</th></tr></thead><tbody>${rows.slice(0, shown).map(row => `<tr><td><span class="rank ${row.rank <= 3 ? 'top-rank' : ''}">${row.rank == null ? '—' : '#' + esc(row.rank)}</span></td><td><div class="entry-person"><span class="avatar avatar-${(String(row.handle || '').length % 4)}" aria-hidden="true">${esc(String(row.handle || '?').slice(0, 2).toUpperCase())}</span><div><a href="${profileURL(row.handle || '')}">@${esc(row.handle || 'Unnamed builder')}</a>${row.house || row.baseline ? '<span class="tag">House</span>' : ''}<p class="entry-title">${esc(row.title || 'Untitled entry')}</p></div></div></td><td class="numeric score">${esc(score(row))}</td><td class="numeric interval-col muted">${row.interval ? `${esc(row.interval.low)} – ${esc(row.interval.high)}` : '—'}</td><td class="numeric">${row.prize_rank == null ? '—' : '#' + esc(row.prize_rank)}</td></tr>`).join('')}</tbody></table></div>` : empty(data.phase?.scores_visible === false ? 'The scores are under wraps.' : 'The field is still open.', data.phase?.scores_visible === false ? 'Check back when the public rankings are released.' : 'No ranked entries have been published for this phase.');
      more.hidden = shown >= rows.length;
      ctx.root.querySelector('#entry-count').textContent = `Showing ${Math.min(shown, rows.length)} of ${rows.length} entries`;
    }
    more.addEventListener('click', () => { shown += 20; draw(); });
    draw();
  });
}
