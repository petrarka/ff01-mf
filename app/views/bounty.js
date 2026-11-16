import { bounty } from '../api.js';
import { esc, number, money, profileURL, badge, timeLeft, date, load, empty, breadcrumbs, tabs, markdown, metric, glyph, categoryClass } from '../ui.js';

export async function render(ctx) {
  ctx.root.classList.add('bounty-view');
  await load(ctx, 'Bounty brief', () => bounty(ctx.value), async (b, warning) => {
    if (!b?.slug) { ctx.root.innerHTML = empty('No brief available.', 'This bounty has not published its details yet.'); return; }
    document.title = `${b.title} — make.fun`;
    const rewards = b.rewardsNow?.length ? b.rewardsNow : Object.entries(b.rewards || {}).map(([place, amountUsd]) => ({ place, baseUsd: amountUsd, amountUsd }));
    const finalPhase = b.phases?.find(phase => phase.key === 'final');
    const description = b.description || b.summary || 'The detailed brief has not been published.';
    const [intro, ...rest] = description.split(/\n\s*\n/);
    const rewardRow = r => `<tr><td><span class="rank ${Number(r.place) <= 3 ? 'top-rank' : ''}">${esc(r.place)}</span></td><td class="numeric">${money(r.baseUsd ?? b.rewards?.[r.place])}</td><td class="numeric muted">${money(r.feeShareUsd)}</td><td class="numeric prize">${money(r.amountUsd)}</td></tr>`;
    ctx.root.innerHTML = `${warning}${breadcrumbs('The brief')}<section class="detail-hero"><div class="title-meta"><span class="category-icon ${categoryClass(b.category)}" aria-hidden="true">${glyph(b.category)}</span><span class="eyebrow">${esc(b.category)} / ${esc(b.sponsor?.name || 'Independent bounty')}</span>${badge(b)}<div class="skill-list">${(b.skills || []).map(s => `<span>${esc(s)}</span>`).join('')}</div></div><h1>${esc(b.title)}</h1></section><div class="metric-strip five">${metric('Live pot', money(b.potUsd ?? b.rewardAmount), `${rewards.length} paid places · USDC`)}${metric('Entry fee', Number(b.entryFeeUsd || 0) === 0 ? 'Free' : money(b.entryFeeUsd), 'Per entrant')}${metric('Time left', timeLeft(b), 'Until the entry deadline')}${metric('Entries', number(b.submissionCount), 'Public submissions')}${metric('Base reward', money(b.rewardAmount), `${money(b.entryFeesUsd ?? 0)} in entry fees`)}</div>${tabs(b.slug, 'brief')}<div class="detail-layout"><article class="prose"><div class="section-heading"><h2>The brief</h2><button class="text-button" data-refresh>↻ Refresh</button></div>${markdown(intro)}${rest.length ? `<div class="brief-remainder">${markdown(rest.join('\n\n'))}</div>` : ''}${b.resolution?.summary ? `<section class="judging"><p class="eyebrow">How the work is judged</p><p>${esc(b.resolution.summary)}</p>${b.resolution.metric ? `<span class="tag">${esc(b.resolution.metric.name)} · ${esc(b.resolution.metric.better)} is better</span>` : ''}</section>` : ''}${b.rules ? `<details><summary>Read the complete rules <span>＋</span></summary>${markdown(b.rules)}</details>` : ''}${b.notices?.length ? `<details><summary>Organizer updates <span>${b.notices.length}</span></summary>${b.notices.map(n => `<h3>${esc(n.title || 'Update')}</h3>${markdown(n.body || n.text || n.content || '')}`).join('')}</details>` : ''}</article><aside class="detail-sidebar"><section class="panel rewards-panel"><div class="section-heading"><h2>The rewards</h2><span class="tag">${rewards.length} places</span></div><p class="muted">Base reward + entry fees. All amounts in USDC.</p>${rewards.length ? `<div class="table-wrap"><table class="reward-table"><caption class="sr-only">Reward distribution</caption><thead><tr><th scope="col">Place</th><th scope="col" class="numeric">Reward</th><th scope="col" class="numeric">Fee share</th><th scope="col" class="numeric">Amount</th></tr></thead><tbody>${rewards.slice(0, 10).map(rewardRow).join('')}</tbody><tfoot><tr><th scope="row">Total</th><td class="numeric">${money(b.rewardAmount)}</td><td class="numeric">${money(b.entryFeesUsd)}</td><td class="numeric prize">${money(b.potUsd ?? b.rewardAmount)}</td></tr></tfoot></table></div>${rewards.length > 10 ? `<details id="extra-rewards"><summary>All ${rewards.length} paid places <span>＋</span></summary><div class="table-wrap more-rewards"><table><thead><tr><th>Place</th><th>Reward</th><th>Fee share</th><th>Amount</th></tr></thead><tbody></tbody></table></div><button class="button" data-more-rewards>Show more places ↓</button></details>` : ''}` : '<p>No reward distribution has been published yet.</p>'}</section><dl class="dates"><div><dt>Opens</dt><dd>${date(b.opensAt || b.publishedAt, true)}</dd></div><div><dt>Deadline</dt><dd>${date(b.deadline, true)}</dd></div><div><dt>${b.resolvedAt ? 'Resolved' : 'Results'}</dt><dd>${date(b.resolvedAt || finalPhase?.endsAt, true)}${!b.resolvedAt && finalPhase?.endsAt ? ' · expected' : ''}</dd></div></dl>${b.winner?.handle ? `<section class="panel"><p class="eyebrow">Winning builder</p><a class="builder-link" href="${profileURL(b.winner.handle)}">@${esc(b.winner.handle)} ↗</a><p>${esc(b.winner.title)}</p></section>` : ''}<p class="aside-note">${b.placementsHeld ? 'Placements are provisional until final judging is complete.' : 'Rewards follow the published final placements.'}</p></aside></div>`;
    const extra = ctx.root.querySelector('#extra-rewards');
    if (extra) {
      let shown = 10;
      const more = extra.querySelector('[data-more-rewards]');
      const append = () => {
        const end = Math.min(shown + 25, rewards.length);
        extra.querySelector('tbody').insertAdjacentHTML('beforeend', rewards.slice(shown, end).map(rewardRow).join(''));
        shown = end;
        more.hidden = shown >= rewards.length;
      };
      extra.addEventListener('toggle', () => { if (extra.open && shown === 10) append(); });
      more.addEventListener('click', append);
    }
  });
}
