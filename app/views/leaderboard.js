import {get, competition} from '../api.js';
import {esc, money, number, bountyURL, profileURL, rewards, score, badge, empty, retryButtons, pagination, wirePages, refreshButton} from '../ui.js';
export async function render(root, {slug, query, retry}) {
  const requested = query.get('phase');
  const phaseParam = ['dev','final'].includes(requested) ? '&phase=' + requested : '';
  const [b, board] = await Promise.all([competition(slug), get(`/api/competitions/${encodeURIComponent(slug)}/leaderboard?rows=all&ties=runs${phaseParam}`)]);
  const entries = board.entries || [];
  const final = Boolean(board.phase?.finalized_at && !board.phase?.placements_held);
  const ranked = entries.filter(r => r.ranked ?? r.rank != null).length;
  const prizeMap = new Map(rewards(b).map(r => [r.place, r.amount]));
  const key = board.rank_key || 'judge';
  const column = board.columns?.find(c => c.key === key);
  let page = Math.max(0, (Number(query.get('page')) || 1) - 1), size = 25, search = '';
  if (!root.isConnected) return;
  document.title = `Standings · ${b.title} — Fieldwork`;
  root.innerHTML = `<div class="standings-heading"><div><a class="back-link" href="${bountyURL(slug)}">← Bounty brief</a><h1>${esc(b.title)}</h1></div><div class="standings-pot"><span class="eyebrow">LIVE POT</span><strong>${money(b.potUsd ?? b.rewardAmount)}</strong></div></div>
    <div class="standings-summary"><div><h2>Standings</h2>${badge(final ? 'Final' : 'Provisional', final ? 'green' : 'amber')}<span>${number(ranked)} ranked of ${number(b.submissionCount)} entries</span></div><span class="muted standings-note">${final ? 'Published results' : 'Ranks and projected prizes may change'} · USDC</span></div>
    <div class="standings-toolbar"><div class="phase-control" role="group" aria-label="Leaderboard phase">${(b.phases || [{key:'dev', title:'Development'},{key:'final',title:'Final'}]).filter(p => ['dev','final'].includes(p.key)).map(p => `<a class="button ${p.key === board.phase?.key ? 'selected' : ''}" href="${bountyURL(slug)}/leaderboard?phase=${p.key}" ${p.key === board.phase?.key ? 'aria-current="true"' : ''}>${p.key === 'dev' ? 'Development' : 'Final results'}</a>`).join('')}</div><label class="search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Find an entrant" placeholder="Find an entrant…"></label><label class="rows-control">Rows <select aria-label="Rows per page"><option>25</option><option>50</option><option>100</option></select></label>${refreshButton()}<div id="standings-pages"></div></div>
    <div id="standings-results" aria-live="polite"></div><p class="table-footnote">${key === 'judge' ? 'Judge win rate is the fitted comparison score, shown as a percentage. ' : ''}Prizes follow reward place, not row number. House references cannot receive a prize.${!final ? ' Current amounts are projections, not payouts.' : ''}</p>`;
  function draw() {
    const rows = entries.filter(r => `${r.handle} ${r.title}`.toLowerCase().includes(search));
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / size) - 1));
    const pages = root.querySelector('#standings-pages');
    pages.innerHTML = pagination(page, rows.length, size);
    wirePages(pages, next => { page = next; draw(); });
    const region = root.querySelector('#standings-results');
    region.innerHTML = rows.length ? `<div class="table-wrap"><table class="standings"><caption class="sr-only">${esc(b.title)} ${final ? 'final' : 'provisional'} standings. Page ${page + 1}.</caption><thead><tr><th scope="col" class="rank">Rank</th><th scope="col">Entrant <span class="muted">/ entry</span></th><th scope="col" class="rate">${esc(key === 'judge' ? 'Judge win rate' : column?.title || key)} <span aria-hidden="true">↓</span></th><th scope="col" class="prize">${final ? 'Prize' : 'Proj. prize'}</th></tr></thead><tbody>${rows.slice(page * size, (page + 1) * size).map(r => {
      const amount = r.prize_eligible && !r.house && !r.baseline ? prizeMap.get(r.prize_rank) : null;
      const value = r.values?.[key];
      const pct = key === 'judge' && value != null ? Math.max(0, Math.min(100, Number(value) / 10000)) : null;
      return `<tr class="${amount != null ? 'paid-place' : ''}"><td class="rank"><span class="rank-number ${r.rank <= 3 ? 'top-rank' : ''}">${r.rank ?? '—'}</span></td><td><div class="entrant"><a href="${profileURL(r.handle)}" title="View @${esc(r.handle)}">${esc(r.handle || 'Unknown')}</a>${r.house || r.baseline ? badge('House', 'house') : ''}<span class="entry-title" title="${esc(r.title)}">${esc(r.title || 'Untitled entry')}</span>${r.status && r.status !== 'finished' ? badge(r.status) : ''}</div></td><td class="rate">${pct != null ? `<span class="rate-track" aria-hidden="true"><i style="width:${pct}%"></i></span>` : ''}<span>${score(value, key, r.display?.[key])}</span></td><td class="prize ${amount != null ? 'reward' : 'muted'}">${amount == null ? '—' : money(amount)}</td></tr>`;
    }).join('')}</tbody></table></div>` : empty(search ? 'No matching entrants' : board.phase?.scores_visible === false ? 'Results are not public yet' : 'No ranked entries yet', search ? 'Try a different handle or entry title.' : 'Entries appear here when make.fun publishes this phase. You can retry or switch phases.');
    retryButtons(root, retry);
  }
  root.querySelector('input[type=search]').oninput = e => { search = e.target.value.toLowerCase().trim(); page = 0; draw(); };
  root.querySelector('select').onchange = e => { size = Number(e.target.value); page = 0; draw(); };
  draw();
}
