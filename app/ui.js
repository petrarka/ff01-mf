export const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const number = value => value == null ? '—' : new Intl.NumberFormat('en-US').format(value);
export const money = value => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Number(value) % 1 ? 2 : 0 }).format(Number(value));
export const bountyURL = slug => '#/bounty/' + encodeURIComponent(slug);
export const profileURL = handle => '#/u/' + encodeURIComponent(handle);
export function score(value, display, column = {}) {
  column ||= {};
  if (value == null && display == null) return '—';
  const raw = value ?? display;
  if ((column.source || '').endsWith('win_rate_micro') || column.key === 'judge') {
    return Number.isFinite(Number(raw)) ? `${(Number(raw) / 10000).toFixed(2)}%` : '—';
  }
  if (column.title?.includes('micro-USDC')) return money(Number(raw) / 1000000);
  if (column.title?.includes('lamports')) return `${number(Number(raw) / 1000000000)} SOL`;
  return String(display ?? number(raw));
}
export function avatarURL(profile) {
  const path = profile.avatar?.url_small || profile.avatar?.url || profile.image;
  if (!path) return '';
  try {
    const url = new URL(path, 'https://make.fun');
    return url.origin === 'https://make.fun' && url.pathname.startsWith('/api/') ? url.href : '';
  } catch { return ''; }
}
export function pagination(page, pages, label) {
  return `<nav class="pagination" aria-label="${esc(label)} pages"><button class="page-button" data-page="prev" aria-label="Previous page" ${page === 0 ? 'disabled' : ''}>←</button><span>Page <b>${page + 1}</b> / ${pages}</span><button class="page-button" data-page="next" aria-label="Next page" ${page + 1 >= pages ? 'disabled' : ''}>→</button></nav>`;
}
export function date(value, full = false) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Not announced';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(full ? { year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' } : {}) }).format(new Date(value)) + (full ? ' UTC' : '');
}
export function state(b) {
  if (b.status === 'resolved') return ['resolved', 'Resolved'];
  if (b.status === 'closed' || (b.deadline && Date.parse(b.deadline) <= Date.now())) return ['closed', 'Entries closed'];
  if (b.status === 'draft' || ((b.opensAt || b.publishedAt) && Date.parse(b.opensAt || b.publishedAt) > Date.now())) return ['upcoming', 'Upcoming'];
  if (b.deadline && Date.parse(b.deadline) - Date.now() < 48 * 3600000) return ['soon', 'Closing soon'];
  return ['open', 'Open'];
}
export function timeLeft(b) {
  const diff = Date.parse(b.deadline) - Date.now();
  if (!Number.isFinite(diff)) return 'No deadline';
  if (diff <= 0 || ['closed', 'resolved'].includes(b.status)) return 'Closed ' + date(b.deadline);
  if (diff < 3600000) return Math.max(1, Math.ceil(diff / 60000)) + 'm left';
  const hours = Math.floor(diff / 3600000);
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h left` : `${hours}h ${Math.floor(diff / 60000) % 60}m left`;
}
export const badge = b => `<span class="badge ${state(b)[0]}"><i class="dot"></i>${state(b)[1]}</span>`;
export const fee = b => b.entryFeeUsd == null || Number(b.entryFeeUsd) === 0 ? 'Free entry' : `${money(b.entryFeeUsd)} entry`;
export const glyph = category => ({ Code: '⌘', Games: '✳', Trading: '↗', Growth: '✺', Security: '⌁', Forecasting: '◈', Automation: '⤴' })[category] || '✳';
export const categoryClass = category => ['Code', 'Games', 'Trading', 'Growth', 'Security', 'Forecasting', 'Automation'].includes(category) ? category.toLowerCase() : 'code';
export const metric = (label, value, detail = '') => `<div class="metric"><span class="eyebrow">${esc(label)}</span><strong>${esc(value)}</strong>${detail ? `<span class="muted">${esc(detail)}</span>` : ''}</div>`;
export function empty(title, message) {
  return `<div class="state compact"><span class="state-symbol">○</span><h2>${esc(title)}</h2><p>${esc(message)}</p><button class="button" data-retry>Retry</button></div>`;
}
export function notice(result) {
  return result.stale ? `<div class="notice warning" role="status">Showing saved data from ${date(result.at, true)}. The live update failed. <button class="text-button" data-retry>Retry</button></div>` : '';
}
export async function load(ctx, title, fetcher, draw) {
  document.title = `${title} — make.fun`;
  const result = await fetcher();
  if (!ctx.current()) return;
  await draw(result.data, notice(result));
  ctx.root.addEventListener('click', event => {
    if (event.target.closest('[data-retry], [data-refresh]')) ctx.retry();
  }, { signal: ctx.signal });
}
export function breadcrumbs(title, slug) {
  return `<div class="breadcrumbs"><a href="#/">Bounties</a><span>/</span>${slug ? `<a href="${bountyURL(slug)}">The brief</a><span>/</span>` : ''}<span>${esc(title)}</span></div>`;
}
export function tabs(slug, selected) {
  return `<nav class="tabs" aria-label="Bounty navigation"><a href="${bountyURL(slug)}" ${selected === 'brief' ? 'aria-current="page"' : ''}>Overview <span>↗</span></a><a href="${bountyURL(slug)}/leaderboard" ${selected === 'leaderboard' ? 'aria-current="page"' : ''}>Leaderboard <span>↗</span></a></nav>`;
}
// A deliberately small, escaped Markdown renderer. Remote HTML and images never execute.
function inline(text) {
  return esc(text).replace(/!?\[([^\]]+)\]\(([^)]+)\)/g, '$1').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
export function markdown(text) {
  let html = '', paragraph = [], list = '', code = null;
  const flush = () => { if (paragraph.length) { html += `<p>${inline(paragraph.join(' '))}</p>`; paragraph = []; } if (list) { html += `</${list}>`; list = ''; } };
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('```')) { flush(); if (code !== null) { html += `<pre><code>${esc(code.join('\n'))}</code></pre>`; code = null; } else code = []; continue; }
    if (code !== null) { code.push(line); continue; }
    const heading = line.match(/^(#{1,6})\s+(.*)/), item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
    if (heading) { flush(); const level = Math.min(4, heading[1].length + 1); html += `<h${level}>${inline(heading[2])}</h${level}>`; }
    else if (item) { if (paragraph.length) flush(); const tag = /^\s*\d/.test(line) ? 'ol' : 'ul'; if (list !== tag) { flush(); html += `<${tag}>`; list = tag; } html += `<li>${inline(item[1])}</li>`; }
    else if (!line.trim()) flush();
    else { if (list) flush(); paragraph.push(line); }
  }
  flush();
  if (code !== null) html += `<pre><code>${esc(code.join('\n'))}</code></pre>`;
  return html;
}
