// A bounty's leaderboard: ranks, rates, scores and sizes exactly as the API ranks them.

import { api } from '../api.js';
import {
  arrow, avatar, count, esc, kb, microUsd, pct, plural,
} from '../ui.js';

const PAGE = 30;

function cell(col, entry) {
  const value = entry.values ? entry.values[col.key] : undefined;
  const display = entry.display ? entry.display[col.key] : undefined;
  if (value === null || value === undefined) return '—';
  if (col.key === 'judge') return pct(value);
  if (col.key === 'judge_low' || col.key === 'judge_high') return pct(value);
  if (col.key === 'bytes') return kb(value);
  if (col.key === 'valid') return value ? 'yes' : 'no';
  if (display !== undefined && display !== null) return esc(display);
  if (typeof value === 'number') return esc(count(value));
  return esc(value);
}

function rawTitle(col, entry) {
  const value = entry.values ? entry.values[col.key] : undefined;
  if (value === null || value === undefined) return '';
  if (col.key === 'judge' || col.key === 'judge_low' || col.key === 'judge_high') {
    return `${col.title}: ${value} (micro)`;
  }
  return `${col.title}: ${typeof value === 'number' ? value : value}`;
}

function whoCell(entry) {
  const flags = [];
  if (entry.house) flags.push('<span class="chip">house</span>');
  if (entry.internal) flags.push('<span class="chip">internal</span>');
  if (!entry.ranked) flags.push('<span class="chip">unranked</span>');
  else if (entry.judge && entry.judge.provisional) flags.push('<span class="chip">provisional</span>');
  const repo = /^https?:\/\//i.test(entry.repo_url || '') ? entry.repo_url : '';
  const title = entry.title || 'untitled entry';
  const titleHtml = repo
    ? `<a href="${esc(repo)}" target="_blank" rel="noopener nofollow">${esc(title)}</a>`
    : `<span>${esc(title)}</span>`;
  const range = entry.rank_range && entry.rank_range.best
    ? `<span class="dim"> · range ${entry.rank_range.best}–${entry.rank_range.worst}</span>`
    : '';
  return `<div class="who-cell">
    ${avatar(entry.image, 'sm')}
    <div class="t">
      <b>${titleHtml}</b>
      <span><a class="handle" href="#/u/${encodeURIComponent(entry.handle || '')}">${esc(entry.handle || 'unknown')}</a>${range}${flags.length ? ' ' + flags.join(' ') : ''}</span>
    </div>
  </div>`;
}

function podium(entries, viewColumns) {
  const ranked = entries.filter((e) => e.rank != null).slice(0, 3);
  if (ranked.length < 3) return '';
  const judgeCol = viewColumns.find((c) => c.key === 'judge');
  return `<div class="podium">
    ${ranked
      .map((e) => {
        const rate = judgeCol ? cell(judgeCol, e) : '';
        const label = e.rank === 1 ? 'Judge favourite' : e.rank === 2 ? 'Second' : 'Third';
        return `<div class="card">
          ${avatar(e.image, 'md')}
          <div class="who">
            <b><a href="#/u/${encodeURIComponent(e.handle || '')}" style="color:var(--text)">${esc(e.handle || 'unknown')}</a></b>
            <span>rank ${esc(e.rank)} · ${esc(label)}</span>
          </div>
          <div class="rate"><b>${esc(rate)}</b><span>${judgeCol ? esc(judgeCol.title) : 'score'}</span></div>
        </div>`;
      })
      .join('')}
  </div>`;
}

export default async function mount(root, params = {}, ctx = {}) {
  const slug = params.slug;
  const signal = ctx.signal;
  const view = params.view || '';
  const state = { limit: PAGE };

  root.innerHTML = `<div class="route">
    <nav class="crumbs"><a href="#/">Bounties</a><span>/</span><a href="#/bounty/${encodeURIComponent(slug)}">${esc(slug)}</a><span>/</span><span>leaderboard</span></nav>
    <div class="empty">Loading the leaderboard…</div>
  </div>`;

  let data;
  try {
    data = await api.leaderboard(slug, view ? { view } : {});
  } catch (err) {
    root.innerHTML = `<div class="route"><nav class="crumbs"><a href="#/">Bounties</a><span>/</span><a href="#/bounty/${encodeURIComponent(slug)}">${esc(slug)}</a></nav>
      <div class="fail"><h1 style="font-size:26px">No leaderboard yet</h1>
      <p>${esc(err.message || err)}</p>
      <p><a class="btn primary" href="#/bounty/${encodeURIComponent(slug)}">Back to the bounty</a></p></div></div>`;
    return;
  }
  if (signal && signal.aborted) return;

  const comp = data.competition || {};
  const phase = data.phase || {};
  const columns = (data.columns || []).filter((c) => !c.hidden);
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const ranked = entries.filter((e) => e.rank != null);
  const views = Array.isArray(data.views) && data.views.length ? data.views : [data.view || 'performance'];
  const currentView = data.view || views[0];
  const title = comp.title || data.title || slug;
  const showCost = data.cost_key || entries.some((e) => e.cost && e.cost.micro_usd);
  const viewParam = (v) =>
    `#/bounty/${encodeURIComponent(slug)}/leaderboard${v && v !== views[0] ? `?view=${encodeURIComponent(v)}` : ''}`;

  root.innerHTML = `<div class="route">
    <nav class="crumbs">
      <a href="#/">Bounties</a><span>/</span>
      <a href="#/bounty/${encodeURIComponent(slug)}">${esc(slug)}</a><span>/</span><span>leaderboard</span>
    </nav>

    <header class="page-head">
      <p class="eyebrow">Results · ${esc(phase.title || phase.key || 'live')}</p>
      <h1 class="focus-target" tabindex="-1">${esc(title)}</h1>
      <p class="lede">Ranked by ${esc(String(data.rank_key || 'score').replace(/_/g, ' '))}${
        data.tie_break ? `, ties broken by ${esc(String(data.tie_break.title || data.tie_break.key).toLowerCase())}` : ''
      }. ${count(ranked.length)} of ${count(entries.length)} ${plural(entries.length, 'entry', 'entries')} ranked${
        phase.scores_visible === false ? ' · scores hidden' : ''
      }.</p>
      <div class="socials">
        <a class="btn" href="#/bounty/${encodeURIComponent(slug)}">← Bounty</a>
        <a class="btn" href="#/">All bounties</a>
      </div>
    </header>

    <div class="tabs-row">
      <div class="seg" role="group" aria-label="Leaderboard view">
        ${views
          .map(
            (v) =>
              `<a href="${viewParam(v)}"${v === currentView ? ' aria-current="page"' : ''}>${esc(
                String(v).replace(/^./, (c) => c.toUpperCase()),
              )}</a>`,
          )
          .join('')}
      </div>
      <span class="dim" style="font-size:13px">${data.metrics_withheld ? 'Intervals and costs are withheld while the heat runs.' : 'Live rates, recomputed as entries are judged.'}</span>
    </div>

    ${podium(entries, columns)}

    ${
      entries.length
        ? `<div class="table-wrap">
      <table>
        <caption class="sr-only">Leaderboard for ${esc(title)}</caption>
        <thead><tr>
          <th scope="col">Rank</th>
          <th scope="col">Entry</th>
          ${columns.map((c) => `<th scope="col" class="n" title="${esc(String(c.sorting || ''))}">${esc(c.title)}${c.sorting === 'desc' ? ' ↓' : c.sorting === 'asc' ? ' ↑' : ''}</th>`).join('')}
          ${showCost ? '<th scope="col" class="n">Cost</th>' : ''}
        </tr></thead>
        <tbody id="lb-rows"></tbody>
      </table>
    </div>
    <div class="lb-foot">
      <span>${count(entries.length)} ${plural(entries.length, 'entry', 'entries')} · ranks as make.fun gives them</span>
      <span>${data.phase && data.phase.scores === 'live' ? 'Provisional while the dev phase runs' : 'Final standings'}</span>
    </div>
    <div class="more" id="lb-more"></div>`
        : '<div class="empty">No ranked entries yet. As soon as the first entry is judged it appears here.</div>'
    }
  </div>`;

  const body = root.querySelector('#lb-rows');
  const more = root.querySelector('#lb-more');

  function paint() {
    if (!body) return;
    const shown = entries.slice(0, state.limit);
    body.innerHTML = shown
      .map((e) => {
        const rank = e.rank != null ? e.rank : '—';
        const cls = e.rank === 1 || e.rank === 2 || e.rank === 3 ? 'rank top' : 'rank';
        return `<tr>
          <td class="${cls}">${esc(rank)}</td>
          <td>${whoCell(e)}</td>
          ${columns.map((c) => `<td class="n" title="${esc(rawTitle(c, e))}">${cell(c, e)}</td>`).join('')}
          ${showCost ? `<td class="n">${e.cost ? esc(microUsd(e.cost.micro_usd)) : '—'}</td>` : ''}
        </tr>`;
      })
      .join('');
    const rest = entries.length - shown.length;
    if (more) {
      more.innerHTML =
        rest > 0
          ? `<button class="btn" type="button" id="lb-more-btn">Show ${Math.min(PAGE, rest)} more <span class="dim">(${rest} left)</span></button>`
          : '';
      const btn = root.querySelector('#lb-more-btn');
      if (btn) {
        btn.addEventListener(
          'click',
          () => {
            state.limit += PAGE;
            paint();
          },
          { signal },
        );
      }
    }
  }

  paint();
}
