// One bounty: summary, rules, rewards with the live pot, dates, phases and entries.

import { api } from '../api.js';
import {
  ago, arrow, avatar, count, dateLabel, esc, md, money, pct, plural, potNote, potOf,
  shortDate, stateOf, statusPill, timeLeft,
} from '../ui.js';

function facts(item, now) {
  const t = timeLeft(item.deadline, now);
  const fees = Number(item.entryFeesUsd || 0);
  const payers = Number(item.entryFeePayers || 0);
  return `<div class="facts">
    <div class="fact"><span class="k">Base reward</span><span class="v">${esc(money(item.rewardAmount))}</span><span class="s">the prize put up</span></div>
    <div class="fact"><span class="k">Live pot</span><span class="v accent">${esc(money(potOf(item)))}</span><span class="s">${esc(potNote(item) || 'no entry fees yet')}</span></div>
    <div class="fact"><span class="k">Entry fee</span><span class="v">${item.entryFeeUsd ? esc(money(item.entryFeeUsd)) : 'Free'}</span><span class="s">${payers ? `${count(payers)} paid · all into the pot` : (fees ? `${esc(money(fees))} in fees` : 'no fee')}</span></div>
    <div class="fact"><span class="k">Entries</span><span class="v">${count(item.submissionCount)}</span><span class="s">${esc(stateOf(item, now).label)}</span></div>
    <div class="fact"><span class="k">Deadline</span><span class="v">${esc(shortDate(item.deadline))}</span><span class="s">${esc(t.label)} · ${esc(dateLabel(item.deadline))}</span></div>
    <div class="fact"><span class="k">Published</span><span class="v">${esc(shortDate(item.publishedAt))}</span><span class="s">${esc(ago(item.publishedAt))}</span></div>
  </div>`;
}

function rewardsTable(item) {
  const rows = Array.isArray(item.rewardsNow) && item.rewardsNow.length ? item.rewardsNow : [];
  if (!rows.length) {
    const legacy = item.rewards && typeof item.rewards === 'object' ? Object.keys(item.rewards) : [];
    if (!legacy.length) return '<p class="dim">No reward table yet.</p>';
    return `<table>
      <caption>Live pot ${esc(money(potOf(item)))}</caption>
      <thead><tr><th scope="col">Place</th><th class="n" scope="col">Prize</th></tr></thead>
      <tbody>${legacy
        .slice(0, 16)
        .map((place) => `<tr><td class="rank">${esc(place)}</td><td class="n">${esc(money(item.rewards[place]))}</td></tr>`)
        .join('')}</tbody>
    </table>`;
  }
  const shown = rows.slice(0, 16);
  return `<table>
    <caption>Live pot ${esc(money(potOf(item)))} · ${esc(potNote(item) || 'base prizes')}</caption>
    <thead><tr><th scope="col">Place</th><th class="n" scope="col">Base</th><th class="n" scope="col">Fees</th><th class="n" scope="col">Total</th></tr></thead>
    <tbody>${shown
      .map((r) => {
        const place = Number(r.place);
        const cls = place <= 3 ? 'rank top' : 'rank';
        return `<tr>
          <td class="${cls}">${esc(r.place)}</td>
          <td class="n">${esc(money(r.baseUsd))}</td>
          <td class="n dim">${esc(money(r.feeShareUsd))}</td>
          <td class="n"><strong>${esc(money(r.amountUsd))}</strong></td>
        </tr>`;
      })
      .join('')}</tbody>
    <tfoot><tr><td colspan="3">Pot paid out</td><td class="n">${esc(money(potOf(item)))}</td></tr></tfoot>
  </table>
  ${rows.length > shown.length ? `<p class="dim" style="margin:10px 0 0">and ${rows.length - shown.length} more places — the full table is on make.fun.</p>` : ''}`;
}

function phases(list) {
  if (!Array.isArray(list) || !list.length) return '';
  const now = Date.now();
  const items = list
    .map((p) => {
      const start = new Date(p.startsAt).getTime();
      const end = new Date(p.endsAt).getTime();
      const live = now >= start && now <= end;
      const done = now > end;
      return `<li style="display:flex;gap:12px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)">
        <span class="pill ${live ? 'live' : done ? 'neutral' : 'soon'}">${live ? 'live' : done ? 'done' : 'next'}</span>
        <div>
          <b>${esc(p.title || p.key)}</b>
          <div class="dim" style="font-size:13px">${esc(shortDate(p.startsAt))} → ${esc(shortDate(p.endsAt))}${p.scoresVisible ? '' : ' · scores hidden'}</div>
          ${p.description ? `<p class="muted" style="margin:6px 0 0;font-size:14px">${esc(p.description)}</p>` : ''}
        </div>
      </li>`;
    })
    .join('');
  return `<section class="section"><h2>Phases</h2><div class="prose"><ul style="list-style:none;padding-left:0">${items}</ul></div></section>`;
}

function entriesList(list) {
  if (!Array.isArray(list) || !list.length) return '';
  const items = list
    .slice(0, 8)
    .map(
      (s) => `<li class="entry">
        <div class="who">
          <b><a href="#/u/${encodeURIComponent(s.hunter || s.handle || '')}">${esc(s.hunter || s.handle || 'unknown')}</a></b>
          <span>${esc(s.title || 'untitled entry')}</span>
        </div>
        <div class="score">${s.score != null ? esc(pct(s.score)) : esc(s.status || '')}</div>
      </li>`,
    )
    .join('');
  return `<section class="section"><h2>Latest entries <span class="rule"></span></h2><ul class="entries" style="list-style:none;padding:0;margin:0">${items}</ul><p class="dim" style="margin:10px 0 0">Showing ${Math.min(8, list.length)} of ${count(list.length)} recent entries.</p></section>`;
}

export default async function mount(root, params = {}, ctx = {}) {
  const slug = params.slug;
  const signal = ctx.signal;

  root.innerHTML = `<div class="route">
    <nav class="crumbs"><a href="#/">Bounties</a><span>/</span><span>${esc(slug)}</span></nav>
    <div class="empty">Loading ${esc(slug)}…</div>
  </div>`;

  let item;
  try {
    item = await api.competition(slug);
  } catch (err) {
    root.innerHTML = `<div class="route"><nav class="crumbs"><a href="#/">Bounties</a><span>/</span><span>${esc(slug)}</span></nav>
      <div class="fail"><h1 style="font-size:26px">Bounty not found</h1>
      <p><code>${esc(slug)}</code> did not load (${esc(err.message || err)}). It may have been renamed, or the API is having a moment.</p>
      <p><a class="btn primary" href="#/">Back to the board</a> <a class="btn" href="#/u/${encodeURIComponent(slug)}">Look for a person instead</a></p></div></div>`;
    return;
  }

  if (signal && signal.aborted) return;

  const now = Date.now();
  const st = stateOf(item, now);
  const t = timeLeft(item.deadline, now);
  const sponsor = item.sponsor && item.sponsor.name ? item.sponsor.name : 'make.fun';
  const skills = Array.isArray(item.skills) ? item.skills : [];
  const rules = item.rules || item.description || '';
  const description = item.description || item.summary || '';

  root.innerHTML = `<div class="route">
    <nav class="crumbs"><a href="#/">Bounties</a><span>/</span><span>${esc(item.category || 'bounty')}</span></nav>

    <header class="page-head">
      <div class="row-tags">
        ${statusPill(item, now)}
        ${item.category ? `<span class="chip">${esc(item.category)}</span>` : ''}
        ${item.sponsor && item.sponsor.isVerified ? '<span class="chip">verified sponsor</span>' : ''}
        ${skills.slice(0, 5).map((s) => `<span class="chip">${esc(s)}</span>`).join('')}
      </div>
      <h1 class="focus-target" tabindex="-1">${esc(item.title)}</h1>
      ${item.summary ? `<p class="lede">${esc(item.summary)}</p>` : ''}
      <p class="row-sub" style="margin-top:10px">
        <span>by ${esc(sponsor)}</span><span class="sep">·</span>
        <span>${count(item.submissionCount)} ${plural(item.submissionCount, 'entry', 'entries')}</span><span class="sep">·</span>
        <span>${esc(t.label)}</span><span class="sep">·</span>
        <a href="https://make.fun/bounty/${encodeURIComponent(item.slug)}" target="_blank" rel="noopener">on make.fun ${arrow}</a>
      </p>
      <div class="socials">
        <a class="btn primary" href="#/bounty/${encodeURIComponent(item.slug)}/leaderboard">Leaderboard ${arrow}</a>
        <a class="btn" href="#/">All bounties</a>
      </div>
    </header>

    ${facts(item, now)}

    <div class="split">
      <div>
        <section class="section">
          <h2>Overview <span class="rule"></span></h2>
          <div class="prose">${description ? md(description) : '<p class="dim">No description yet.</p>'}</div>
        </section>

        ${rules && rules !== description ? `<details class="rules" open><summary>Rules &amp; deliverables</summary><div class="prose">${md(rules)}</div></details>` : ''}

        ${phases(item.phases)}

        ${entriesList(item.submissions)}

        ${item.demand ? `<section class="section"><h2>Who it is for <span class="rule"></span></h2><div class="prose">${md(item.demand)}</div></section>` : ''}
      </div>

      <aside>
        <div class="card">
          <h2 style="font-size:16px">Rewards · live pot</h2>
          ${rewardsTable(item)}
        </div>

        <div class="card">
          <h2 style="font-size:16px">Key dates</h2>
          <dl class="dl">
            <dt>Opened</dt><dd>${esc(dateLabel(item.opensAt || item.publishedAt))}</dd>
            <dt>Deadline</dt><dd>${esc(dateLabel(item.deadline))}</dd>
            <dt>Time left</dt><dd>${esc(t.label)}</dd>
            ${item.resolvedAt ? `<dt>Resolved</dt><dd>${esc(dateLabel(item.resolvedAt))}</dd>` : ''}
            <dt>Entries</dt><dd>${count(item.submissionCount)}</dd>
            <dt>Status</dt><dd>${esc(st.label)}</dd>
          </dl>
        </div>

        <div class="card">
          <h2 style="font-size:16px">Entry fee</h2>
          <p class="muted" style="margin:0;font-size:14px">${
            item.entryFeeUsd
              ? `<strong style="color:var(--text)">${esc(money(item.entryFeeUsd))}</strong> to enter, paid in USDC on Solana. ${count(item.entryFeePayers)} paid so far; every fee joins the pot.`
              : 'Free to enter — no fee, and nothing is added to the pot.'
          }</p>
        </div>

        <div class="card">
          <h2 style="font-size:16px">Links</h2>
          <div class="links">
            <a href="#/bounty/${encodeURIComponent(item.slug)}/leaderboard">Full leaderboard <span class="arrow" aria-hidden="true">${arrow}</span></a>
            <a href="https://make.fun/bounty/${encodeURIComponent(item.slug)}" target="_blank" rel="noopener">Bounty page on make.fun <span class="arrow" aria-hidden="true">${arrow}</span></a>
          </div>
        </div>
      </aside>
    </div>
  </div>`;

  // Top of the leaderboard, if the API has one, in a side card. Waited on briefly so a
  // screenshot sees it, never long enough to hold the page up.
  const lb = await Promise.race([
    api.leaderboard(slug, { rows: 'first' }).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
  ]);
  if (lb && Array.isArray(lb.entries) && lb.entries.length) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h2 style="font-size:16px">Top entries</h2>
      <ul class="entries" style="list-style:none;padding:0;margin:0">
        ${lb.entries
          .slice(0, 5)
          .map((e) => {
            const value = e.values && e.values.judge != null ? pct(e.values.judge) : '';
            return `<li class="entry">
              ${avatar(e.image, 'sm')}
              <div class="who"><b><a href="#/u/${encodeURIComponent(e.handle || '')}">${esc(e.handle || 'unknown')}</a></b><span>${esc(e.title || '')}</span></div>
              <div class="score">${esc(value)}</div>
            </li>`;
          })
          .join('')}
      </ul>
      <p style="margin:12px 0 0"><a class="btn small" href="#/bounty/${encodeURIComponent(slug)}/leaderboard">All ${count(lb.entries.length)} ranked entries ${arrow}</a></p>`;
    const aside = root.querySelector('aside');
    if (aside) aside.appendChild(card);
  }
}
