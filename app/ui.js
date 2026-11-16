export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = value => value == null ? '—' : new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits: Number(value) % 1 ? 2 : 0}).format(Number(value));
export const number = value => new Intl.NumberFormat('en-US').format(value ?? 0);
export const date = value => value ? new Date(value).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'}) : 'Not announced';
export const datetime = value => value ? `${date(value)} · ${new Date(value).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', timeZone:'UTC'})} UTC` : 'Not announced';
export const bountyURL = slug => '#/bounty/' + encodeURIComponent(slug);
export const profileURL = handle => '#/u/' + encodeURIComponent(handle);
export function state(bounty) {
  if (bounty.status === 'resolved') return ['Final', 'muted'];
  if (bounty.status === 'closed' || new Date(bounty.deadline) <= Date.now()) return ['Closed', 'muted'];
  if (bounty.status === 'draft' || new Date(bounty.opensAt || bounty.publishedAt) > Date.now()) return ['Upcoming', 'blue'];
  if (new Date(bounty.deadline) - Date.now() < 48 * 3600000) return ['Closing soon', 'amber'];
  return ['Open', 'green'];
}
export function badge(label, tone = '') { return `<span class="badge ${tone}">${esc(label)}</span>`; }
export const status = b => badge(...state(b));
export function remaining(value) {
  const ms = new Date(value) - Date.now();
  if (!Number.isFinite(ms)) return 'No deadline';
  if (ms <= 0) return 'Entries closed';
  const hours = Math.ceil(ms / 3600000);
  return hours >= 48 ? `${Math.floor(hours / 24)}d ${hours % 24}h left` : hours < 1 ? 'Closing now' : `${hours}h left`;
}
export function rewards(bounty) {
  return bounty.rewardsNow?.length ? bounty.rewardsNow.map(r => ({place: r.place, amount: Number(r.amountUsd)})) : Object.entries(bounty.rewards || {}).map(([place, amount]) => ({place: Number(place), amount: Number(amount)}));
}
export const fee = b => Number(b.entryFeeUsd) > 0 ? `${money(b.entryFeeUsd)} entry` : 'Free entry';
export function empty(title, detail = 'There is nothing here yet.') {
  return `<div class="state compact" role="status"><span class="state-symbol" aria-hidden="true">∅</span><h2>${esc(title)}</h2><p>${esc(detail)}</p><button data-retry type="button">Retry</button></div>`;
}
export function retryButtons(root, retry) { root.querySelectorAll('[data-retry]').forEach(b => b.onclick = retry); }
export function pagination(page, total, size, noun = 'entries') {
  const pages = Math.max(1, Math.ceil(total / size));
  return `<div class="pagination"><span class="muted">${total ? `${number(page * size + 1)}–${number(Math.min(total, (page + 1) * size))} of ${number(total)} ${noun}` : `0 ${noun}`}</span><div class="page-controls"><button data-page="${page - 1}" ${page === 0 ? 'disabled' : ''} aria-label="Previous page">←</button><label class="page-label">Page <input data-page-input type="number" min="1" max="${pages}" value="${page + 1}" aria-label="Page number"> / ${pages}</label><button data-page="${page + 1}" ${page >= pages - 1 ? 'disabled' : ''} aria-label="Next page">→</button></div></div>`;
}
export function wirePages(root, change) {
  root.querySelectorAll('[data-page]').forEach(b => b.onclick = () => change(Number(b.dataset.page)));
  root.querySelector('[data-page-input]')?.addEventListener('change', e => change(Math.max(0, Math.min(Number(e.target.max) - 1, (Number(e.target.value) || 1) - 1))));
}
export function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#/">Bounties</a>${items.map(([text, href]) => `<span aria-hidden="true">/</span>${href ? `<a href="${esc(href)}">${esc(text)}</a>` : `<span aria-current="page">${esc(text)}</span>`}`).join('')}</nav>`;
}
export function inline(text) {
  return esc(text).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
export function markdown(text = '') {
  const lines = text.replace(/\\n/g, '\n').split('\n');
  let html = '', list = '', code = false, buffer = [];
  const closeList = () => { if (list) html += `</${list}>`; list = ''; };
  const paragraph = () => { if (buffer.length) html += `<p>${inline(buffer.join(' '))}</p>`; buffer = []; };
  for (const line of lines) {
    if (line.startsWith('```')) { paragraph(); closeList(); html += code ? '</code></pre>' : '<pre><code>'; code = !code; continue; }
    if (code) { html += esc(line) + '\n'; continue; }
    const heading = line.match(/^#{1,6}\s+(.+)/);
    const item = line.match(/^\s*(?:([-*])|\d+\.)\s+(.+)/);
    if (heading) { paragraph(); closeList(); html += `<h3>${inline(heading[1])}</h3>`; }
    else if (item) { paragraph(); const kind = item[1] ? 'ul' : 'ol'; if (list !== kind) { closeList(); html += `<${kind}>`; list = kind; } html += `<li>${inline(item[2])}</li>`; }
    else if (!line.trim()) { paragraph(); closeList(); }
    else { closeList(); buffer.push(line.trim()); }
  }
  paragraph(); closeList(); if (code) html += '</code></pre>';
  return html;
}
export function score(value, key = 'judge', display) {
  if (value == null) return '—';
  return key === 'judge' ? `${(Number(value) / 10000).toFixed(2)}%` : esc(display ?? value);
}
export function refreshButton() { return '<button data-retry class="refresh" type="button" aria-label="Refresh live data">↻ <span>Refresh</span></button>'; }
