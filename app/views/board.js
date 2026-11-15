// The board: every live bounty with its live pot, entry fee, entries and time left.

import { api } from '../api.js';
import {
  arrow, count, dateLabel, esc, money, plural, potNote, potOf, stateOf, statusPill, timeLeft,
} from '../ui.js';

const PAGE = 24;

function row(item, now) {
  const st = stateOf(item, now);
  const t = timeLeft(item.deadline, now);
  const fees = Number(item.entryFeesUsd || 0);
  const fee = item.entryFeeUsd ? money(item.entryFeeUsd) : 'Free';
  const closed = st.key === 'ended' || st.key === 'resolved';
  const skills = Array.isArray(item.skills) ? item.skills.slice(0, 3) : [];
  const sponsor = item.sponsor && item.sponsor.name ? item.sponsor.name : 'make.fun';

  return `<article class="row${closed ? ' ended' : ''}">
    <div class="row-main">
      <div class="row-tags">
        ${statusPill(item, now)}
        ${item.category ? `<span class="chip">${esc(item.category)}</span>` : ''}
        ${item.sponsor && item.sponsor.isVerified ? '<span class="chip">verified</span>' : ''}
      </div>
      <h3 class="row-title"><a href="#/bounty/${encodeURIComponent(item.slug)}" data-slug="${esc(item.slug)}">${esc(item.title)}</a></h3>
      <div class="row-sub">
        <span>${count(item.submissionCount)} ${plural(item.submissionCount, 'entry', 'entries')}</span>
        <span class="sep">·</span>
        <span>by ${esc(sponsor)}</span>
        ${skills.length ? `<span class="sep">·</span><span>${skills.map(esc).join(', ')}</span>` : ''}
        <span class="sep">·</span>
        <a href="#/bounty/${encodeURIComponent(item.slug)}/leaderboard">Leaderboard ${arrow}</a>
      </div>
    </div>
    <div class="row-nums">
      <div class="num reward" title="Base ${esc(money(item.rewardAmount))}${fees > 0 ? ` + ${esc(money(fees))} entry fees` : ''}">
        <span class="k">Live pot</span>
        <span class="v">${esc(money(potOf(item)))}</span>
        ${fees > 0 ? `<span class="sub">${esc(potNote(item))}</span>` : ''}
      </div>
      <div class="num"><span class="k">Entry fee</span><span class="v">${esc(fee)}</span></div>
      <div class="num"><span class="k">Entries</span><span class="v">${count(item.submissionCount)}</span></div>
      <div class="num time" title="${esc(dateLabel(item.deadline))}">
        <span class="k">Time left</span>
        <span class="v ${t.state}">${esc(t.label)}</span>
      </div>
    </div>
  </article>`;
}

function sortItems(items, sort, now) {
  const out = items.slice();
  const endedLast = (a, b) => {
    const ae = new Date(a.deadline).getTime() <= now ? 1 : 0;
    const be = new Date(b.deadline).getTime() <= now ? 1 : 0;
    return ae - be;
  };
  if (sort === 'pot') out.sort((a, b) => potOf(b) - potOf(a));
  else if (sort === 'entries') out.sort((a, b) => Number(b.submissionCount || 0) - Number(a.submissionCount || 0));
  else if (sort === 'newest') out.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  else {
    out.sort((a, b) => {
      const ended = endedLast(a, b);
      if (ended) return ended;
      return new Date(a.deadline || Infinity) - new Date(b.deadline || Infinity);
    });
  }
  return out;
}

export default async function mount(root, params = {}, ctx = {}) {
  const signal = ctx.signal;
  const first = ['live', 'closing', 'ended', 'all'].includes(params.filter) ? params.filter : 'live';
  const state = {
    filter: first,
    sort: 'ending',
    q: '',
    limit: PAGE,
    live: null,
    ended: null,
    endedLoading: false,
  };

  root.innerHTML = `<div class="route">
    <div class="board-top">
      <div class="page-head">
        <p class="eyebrow">make.fun · live board</p>
        <h1 class="focus-target" tabindex="-1">Bounties</h1>
        <p class="lede">Every live bounty, its reward as it stands now — base prize plus entry fees paid in — its entry fee, its entries and the time left.</p>
      </div>
      <div class="stats" id="stats"></div>
    </div>
    <div class="controls">
      <div class="tabs" role="group" aria-label="Filter bounties">
        <button class="tab" type="button" data-filter="live" aria-pressed="true">Live<span class="count" data-count="live">—</span></button>
        <button class="tab" type="button" data-filter="closing" aria-pressed="false">Closing soon<span class="count" data-count="closing">—</span></button>
        <button class="tab" type="button" data-filter="ended" aria-pressed="false">Ended<span class="count" data-count="ended">—</span></button>
        <button class="tab" type="button" data-filter="all" aria-pressed="false">All<span class="count" data-count="all">—</span></button>
      </div>
      <span class="spacer"></span>
      <label class="sr-only" for="bq">Search bounties</label>
      <input id="bq" type="search" placeholder="Filter by title, sponsor…" spellcheck="false">
      <label class="sr-only" for="bs">Sort bounties</label>
      <select id="bs">
        <option value="ending">Ending soon</option>
        <option value="pot">Biggest pot</option>
        <option value="newest">Newest</option>
        <option value="entries">Most entries</option>
      </select>
    </div>
    <p class="dim" id="stamp" style="margin:0 0 12px"></p>
    <h2 class="sr-only">Bounty list</h2>
    <div class="rows" id="rows"><div class="empty">Loading live bounties…</div></div>
    <div class="more" id="more"></div>
  </div>`;

  const $ = (sel) => root.querySelector(sel);
  const rows = $('#rows');
  const more = $('#more');
  const stats = $('#stats');
  const stamp = $('#stamp');

  for (const t of root.querySelectorAll('[data-filter]')) {
    t.setAttribute('aria-pressed', String(t.getAttribute('data-filter') === state.filter));
  }

  const openItems = () => (state.live ? state.live.items || [] : []);
  const resolvedItems = () => (state.ended ? state.ended.items || [] : []);
  const isEnded = (item, now) => {
    const st = stateOf(item, now);
    return st.key === 'ended' || st.key === 'resolved';
  };
  // A bounty is live only while its deadline is ahead, whatever status the API still shows.
  const liveItems = () => {
    const now = Date.now();
    return openItems().filter((i) => !isEnded(i, now));
  };
  const endedItems = () => {
    const now = Date.now();
    return openItems().filter((i) => isEnded(i, now)).concat(resolvedItems());
  };

  function counts() {
    const now = Date.now();
    const live = liveItems();
    return {
      live: live.length,
      closing: live.filter((i) => stateOf(i, now).key === 'soon').length,
      ended: state.ended ? endedItems().length : openItems().filter((i) => isEnded(i, now)).length,
      all: state.ended ? openItems().length + resolvedItems().length : null,
    };
  }

  function current() {
    const now = Date.now();
    let items;
    if (state.filter === 'ended') items = endedItems();
    else if (state.filter === 'all') items = openItems().concat(resolvedItems());
    else items = liveItems();
    if (state.filter === 'closing') items = items.filter((i) => stateOf(i, now).key === 'soon');
    const q = state.q.trim().toLowerCase();
    if (q) {
      items = items.filter((i) =>
        [i.title, i.slug, i.category, i.sponsor && i.sponsor.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    return sortItems(items, state.sort, now);
  }

  function paintStats() {
    const c = counts();
    const now = Date.now();
    const live = liveItems();
    const pot = live.reduce((sum, i) => sum + (potOf(i) || 0), 0);
    const soon = live.filter((i) => stateOf(i, now).key === 'soon').length;
    stats.innerHTML = `
      <div class="stat"><span class="k">Live bounties</span><span class="v">${count(c.live)}</span></div>
      <div class="stat"><span class="k">Prizes live</span><span class="v accent">${esc(money(pot))}</span></div>
      <div class="stat"><span class="k">Closing in 24h</span><span class="v">${count(soon)}</span></div>`;
    for (const key of ['live', 'closing', 'ended', 'all']) {
      const el = root.querySelector(`[data-count="${key}"]`);
      if (el) el.textContent = c[key] === null ? '—' : count(c[key]);
    }
    stamp.textContent = state.live
      ? `Live from make.fun · refreshed ${new Date().toISOString().slice(11, 16)} UTC · pot = base reward + entry fees`
      : '';
  }

  function paintList() {
    const items = current();
    if (!state.live && !state.ended) {
      rows.innerHTML = '<div class="empty">Loading live bounties…</div>';
      more.innerHTML = '';
      return;
    }
    if (!items.length) {
      rows.innerHTML = `<div class="empty">Nothing here${state.q ? ` for “${esc(state.q)}”` : ' yet'}. Try another filter or search.</div>`;
      more.innerHTML = '';
      return;
    }
    const now = Date.now();
    rows.innerHTML = items.slice(0, state.limit).map((i) => row(i, now)).join('');
    const rest = items.length - state.limit;
    more.innerHTML = rest > 0
      ? `<button class="btn" type="button" id="more-btn">Show ${Math.min(PAGE, rest)} more <span class="dim">(${rest} left)</span></button>`
      : '';
    const btn = root.querySelector('#more-btn');
    if (btn) btn.addEventListener('click', () => {
      state.limit += PAGE;
      paintList();
    }, { signal });
  }

  function repaint() {
    paintStats();
    paintList();
  }

  async function ensureEnded() {
    if (state.ended) {
      repaint();
      return;
    }
    if (state.endedLoading) return;
    state.endedLoading = true;
    paintStats();
    try {
      state.ended = await api.board('resolved');
    } catch {
      state.ended = { items: [] };
    } finally {
      state.endedLoading = false;
    }
    repaint();
  }

  root.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-filter]');
    if (!tab) return;
    const filter = tab.getAttribute('data-filter');
    if (filter === state.filter) return;
    state.filter = filter;
    state.limit = PAGE;
    for (const t of root.querySelectorAll('[data-filter]')) {
      t.setAttribute('aria-pressed', String(t.getAttribute('data-filter') === filter));
    }
    const base = filter === 'live' ? '#/' : filter === 'closing' ? '#/closing' : `#/?filter=${filter}`;
    if (location.hash !== base) history.replaceState(null, '', base);
    if (filter === 'ended' || filter === 'all') ensureEnded();
    else repaint();
  }, { signal });

  root.addEventListener('input', (event) => {
    if (event.target.id !== 'bq') return;
    state.q = event.target.value;
    state.limit = PAGE;
    paintList();
  }, { signal });

  root.addEventListener('change', (event) => {
    if (event.target.id !== 'bs') return;
    state.sort = event.target.value;
    paintList();
  }, { signal });

  try {
    state.live = await api.board('open');
    if (signal && signal.aborted) return;
    if (state.filter === 'ended' || state.filter === 'all') await ensureEnded();
    repaint();
  } catch (err) {
    rows.innerHTML = `<div class="fail"><h2>The board did not load</h2><p>${esc(err.message || String(err))}</p><p>The public API is read-only and CORS-open; a hiccup is usually temporary.</p></div>`;
    more.innerHTML = '';
  }
}