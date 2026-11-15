// Public profiles: #/u (a directory of people on the live leaderboards) and #/u/<handle>.

import { api } from '../api.js';
import { avatar, count, esc, loading, money, onRetry, retryButton, shortDate, timeLeft } from '../ui.js';

function stat(value, label) {
  return `<div class="stat"><span class="k">${esc(label)}</span><span class="v">${esc(value)}</span></div>`;
}

function solution(item) {
  const comp = item.competition || {};
  const score = item.score || null;
  const scoreText = score ? String(score.display != null ? score.display : score.value ?? '') : '';
  const status = comp.deadline ? timeLeft(comp.deadline) : null;
  return `<li class="solution">
    <div class="t">
      <b><a href="#/bounty/${encodeURIComponent(comp.slug || '')}">${esc(item.title || 'untitled entry')}</a></b>
      <span>${esc(comp.title || comp.slug || '')} · ${esc(comp.category || '')} · pot ${esc(money(comp.pot_usd || comp.reward_usd))} · ${esc(status ? status.label : comp.status || '')}</span>
      <span>${item.placement ? `Placed #${esc(item.placement)} · ${esc(money(item.prize_usd))}` : 'Entered'} · ${esc(shortDate(item.entered_at))}</span>
    </div>
    <div class="side">
      <b>${esc(scoreText || (item.placement ? '#' + item.placement : '—'))}</b>
      <span>${score && score.column ? esc(score.column.title) : 'score'}</span>
    </div>
  </li>`;
}

function socials(p) {
  const links = [];
  const wallet = typeof p.wallet === 'string' ? p.wallet : p.wallet?.address;
  if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}" target="_blank" rel="noopener nofollow">GitHub</a>`);
  if (p.x) links.push(`<a href="https://x.com/${encodeURIComponent(String(p.x).replace(/^@/, ''))}" target="_blank" rel="noopener nofollow">X</a>`);
  if (p.discord) links.push(`<span class="chip">Discord · ${esc(p.discord)}</span>`);
  if (typeof wallet === 'string' && wallet) links.push(`<span class="chip mono" title="${esc(wallet)}">${esc(wallet.slice(0, 4))}…${esc(wallet.slice(-4))}</span>`);
  return links.length ? `<div class="socials">${links.join('')}</div>` : '';
}

function profileView(p) {
  const record = p.record || {};
  const solutions = Array.isArray(p.solutions) ? p.solutions : [];
  return `<div class="route">
    <nav class="crumbs"><a href="#/">Bounties</a><span>/</span><a href="#/u">People</a><span>/</span><span>${esc(p.handle)}</span></nav>

    <div class="card" style="margin-bottom:20px">
      <div class="profile-head">
        ${avatar(p.image || (p.avatar && p.avatar.url), 'lg', p.display_name || p.handle)}
        <div class="profile-id">
          <h1 class="focus-target" tabindex="-1">${esc(p.display_name || p.handle)}</h1>
          <p class="handle" style="margin:0">@${esc(p.handle)}${p.house ? ' · house account' : ''}</p>
          ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
          <p class="dim" style="margin:8px 0 0;font-size:13px">Joined ${esc(shortDate(p.joined_at))}</p>
          ${socials(p)}
        </div>
      </div>
      <div class="statgrid">
        ${stat(count(record.competitions_entered), 'Entered')}
        ${stat(count(record.podium_finishes), 'Podiums')}
        ${stat(count(record.competitions_won), 'Wins')}
        ${stat(money(record.prize_usd), 'Prize money')}
      </div>
    </div>

    <section class="section">
      <h2>Entries <span class="rule"></span></h2>
      ${
        solutions.length
          ? `<ul class="solutions" style="list-style:none;padding:0;margin:0">${solutions.map(solution).join('')}</ul>`
          : '<div class="empty" role="status">No public entries yet.</div>'
      }
    </section>
  </div>`;
}

function directory(entries, slug) {
  return `<div class="route">
    <nav class="crumbs"><a href="#/">Bounties</a><span>/</span><span>people</span></nav>
    <header class="page-head">
      <p class="eyebrow">make.fun · people</p>
      <h1 class="focus-target" tabindex="-1">Profiles</h1>
      <p class="lede">Public accounts behind the entries: their record, their prizes and every solution they have entered. Pick one below, or search by handle in the bar above.</p>
    </header>
    ${
      entries.length
        ? `<div class="people">${entries
            .map(
              (e) => `<a class="person" href="#/u/${encodeURIComponent(e.handle || '')}">
                ${avatar(e.image, 'md')}
                <span class="t"><b>${esc(e.handle || 'unknown')}</b><span>${e.rank ? `rank #${esc(e.rank)} on ${esc(slug)}` : 'on the board'}</span></span>
              </a>`,
            )
            .join('')}</div>`
        : '<div class="empty" role="status">No ranked people yet.</div>'
    }
    <p class="dim" style="margin-top:14px">People shown are the ranked entrants of the live bounties, from make.fun\'s public leaderboards.</p>
  </div>`;
}

export default async function mount(root, params = {}, ctx = {}) {
  const handle = params.handle || '';
  const signal = ctx.signal;
  const opts = ctx.retry ? { fresh: 0 } : {};

  if (!handle) {
    root.innerHTML = `<div class="route">${loading('Loading people…')}</div>`;
    let entries = [];
    let slug = 'makefun-frontend-01';
    try {
      try {
        const board = await api.board('open', opts);
        const items = (board && board.items) || [];
        const preferred = items.find((i) => i.slug === slug);
        slug = (preferred || items.find((i) => i.status === 'open') || {}).slug || slug;
      } catch {
        /* fall back to the featured bounty */
      }
      if (signal?.aborted) return;
      const lb = await api.leaderboard(slug, { rows: 'first' }, opts);
      entries = ((lb && lb.entries) || []).filter((e) => e.handle && e.rank).slice(0, 18);
    } catch (err) {
      if (signal?.aborted) return;
      root.innerHTML = `<div class="route"><div class="fail" role="alert"><h1>People did not load</h1><p>${esc(err.message || err)}</p>${retryButton}</div></div>`;
      onRetry(root, () => mount(root, params, { ...ctx, retry: true }), signal);
      return;
    }
    if (signal && signal.aborted) return;
    root.innerHTML = directory(entries, slug);
    return;
  }

  root.innerHTML = `<div class="route">
    <nav class="crumbs"><a href="#/">Bounties</a><span>/</span><a href="#/u">People</a><span>/</span><span>${esc(handle)}</span></nav>
    ${loading(`Loading @${handle}…`)}
  </div>`;

  let profile;
  try {
    profile = await api.profile(handle, opts);
  } catch (err) {
    if (signal?.aborted) return;
    const missing = err && err.status === 404;
    root.innerHTML = `<div class="route">
      <nav class="crumbs"><a href="#/">Bounties</a><span>/</span><a href="#/u">People</a></nav>
      <div class="fail" role="alert">
        <h1 style="font-size:26px">${missing ? 'No such person' : 'Profile did not load'}</h1>
        <p>${missing ? `There is no public make.fun account at <code>@${esc(handle)}</code> — or it has not entered anything yet.` : esc(err.message || String(err))}</p>
        <p>${retryButton} <a class="btn" href="#/u">Browse people</a> <a class="btn" href="#/">Bounties</a> <a class="btn" href="#/bounty/${encodeURIComponent(handle)}">Look for a bounty instead</a></p>
      </div>
    </div>`;
    onRetry(root, () => mount(root, params, { ...ctx, retry: true }), signal);
    return;
  }

  if (signal && signal.aborted) return;
  document.title = `${profile.display_name || profile.handle} · make.fun`;
  root.innerHTML = profileView(profile);
}

export { profileView };
