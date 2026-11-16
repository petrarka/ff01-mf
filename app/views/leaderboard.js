import { leaderboard, bounty } from '../api.js';
import { esc, number, money, profileURL, load, empty, tabs, score, pagination, notice } from '../ui.js';

export async function render(ctx) {
  ctx.root.classList.add('leaderboard-view');
  await load(ctx, 'Standings', async () => {
    const [board, brief] = await Promise.allSettled([leaderboard(ctx.value), bounty(ctx.value)]);
    if (board.status === 'rejected') throw board.reason;
    return { ...board.value, data: { board: board.value.data, brief: brief.status === 'fulfilled' ? brief.value : null } };
  }, async ({ board: data, brief }, warning) => {
    const rows = [...(data.entries || []), ...(data.rest || [])];
    const competition = brief?.data || data.competition || {};
    const ranked = rows.filter(row => row.rank != null && row.ranked !== false).length;
    const total = Math.max(rows.length, competition.submissionCount || 0);
    const final = Boolean(data.phase?.finalized_at) && !data.phase?.placements_held;
    const hidden = data.phase?.scores_visible === false;
    const column = data.columns?.find(c => c.key === data.rank_key) || { key: data.rank_key };
    const rewards = new Map((competition.rewardsNow || []).map(r => [Number(r.place), r.amountUsd]));
    Object.entries(competition.rewards || {}).forEach(([place, amount]) => {
      if (!rewards.has(Number(place))) rewards.set(Number(place), amount);
    });
    let page = 0;
    const size = 25, pages = Math.max(1, Math.ceil(rows.length / size));
    document.title = `${competition.title || ctx.value} · Standings — make.fun`;
    ctx.root.innerHTML = `${warning}${brief ? notice(brief) : '<div class="notice warning">Reward details are unavailable. <button class="text-button" data-retry>Retry</button></div>'}<header class="standings-heading"><h1>${esc(competition.title || ctx.value)}</h1><span class="badge ${final ? 'resolved' : 'soon'}">${final ? 'Final' : 'Provisional'}</span></header>${tabs(ctx.value, 'leaderboard')}<div class="table-toolbar"><div><strong>${number(ranked)} ranked <span class="muted">of ${number(total)} entries</span></strong><span class="standings-note">${esc(data.phase?.title || 'Current phase')} · ${final ? 'Confirmed results' : 'Prizes estimated; final judging pending'}</span></div><div class="table-actions"><button class="text-button" data-refresh aria-label="Refresh standings">↻ <span>Refresh</span></button><div id="pages"></div></div></div><div id="rankings"></div><p class="table-footnote" id="entry-count" role="status"></p>`;
    function draw() {
      const visible = rows.slice(page * size, (page + 1) * size);
      ctx.root.querySelector('#pages').innerHTML = pagination(page, pages, 'Standings');
      ctx.root.querySelector('#rankings').innerHTML = visible.length && !hidden ? `<div class="table-wrap"><table class="leader-table"><caption class="sr-only">${esc(competition.title)} · ${final ? 'Final' : 'Provisional'} standings</caption><colgroup><col class="rank-column"><col><col class="score-column"><col class="prize-column"></colgroup><thead><tr><th scope="col">Rank</th><th scope="col">Entrant <span class="muted">/ entry</span></th><th scope="col" class="numeric">${esc(column.title || 'Score')}${column.key === 'judge' ? ' (%)' : ''}</th><th scope="col" class="numeric">Prize${final ? '' : ' · est.'}</th></tr></thead><tbody>${visible.map(row => {
        const value = row.values?.[data.rank_key] ?? row.value;
        const display = typeof row.display === 'string' ? row.display : row.display?.[data.rank_key];
        const eligible = row.prize_eligible !== false && !row.house && !row.baseline;
        const prize = eligible && row.prize_rank != null ? rewards.get(Number(row.prize_rank)) : null;
        return `<tr><td><span class="rank ${row.rank <= 3 && row.rank != null ? 'top-rank' : ''}">${row.rank == null ? '—' : esc(String(row.rank).padStart(2, '0'))}</span></td><td><div class="entry-person"><a href="${profileURL(row.handle || '')}" title="View @${esc(row.handle)}">@${esc(row.handle || 'Unknown')}</a>${row.house || row.baseline ? '<span class="tag">House</span>' : ''}<span class="entry-title" title="${esc(row.title)}">${esc(row.title || 'Untitled entry')}</span></div></td><td class="numeric score">${esc(score(value, display, column))}</td><td class="numeric ${prize != null ? 'prize' : 'muted'}">${prize == null ? '—' : money(prize)}</td></tr>`;
      }).join('')}</tbody></table></div>` : empty(hidden ? 'Scores are not public yet.' : 'No ranked entries yet.', hidden ? 'This phase is waiting for its results to be released. Check back after judging.' : 'Standings will appear here as entries are judged.');
      ctx.root.querySelector('#entry-count').textContent = hidden ? 'Scores withheld by the organizer.' : `${rows.length ? page * size + 1 : 0}–${Math.min((page + 1) * size, rows.length)} of ${number(rows.length)} published entries · ${column.key === 'judge' ? 'Judge win rates shown as percentages' : (column.sorting === 'asc' ? 'Lower' : 'Higher') + ' scores rank first'} · Places follow make.fun’s published order.`;
    }
    ctx.root.querySelector('#pages').addEventListener('click', event => {
      const button = event.target.closest('[data-page]');
      if (!button || button.disabled) return;
      page += button.dataset.page === 'next' ? 1 : -1;
      draw();
      ctx.root.querySelector(`[data-page="${button.dataset.page}"]:not(:disabled)`)?.focus({ preventScroll: true });
    });
    draw();
  });
}
