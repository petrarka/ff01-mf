// Small, dependency-free view helpers: escaping, numbers, dates, markdown and avatars.
// Every API string goes through esc() before it reaches innerHTML.

import { mediaUrl } from './api.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const arrow = '→';

export function money(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  const digits = Number.isInteger(n) ? 0 : 2;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** A micro-USD amount (1e-6 USD), as make.fun reports costs. */
export function microUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return '$' + (n / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A win rate in micro units (1e6 = 100%), as the judge column reports it. */
export function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return (n / 1e4).toFixed(2) + '%';
}

export function kb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n / 1024).toLocaleString('en-US') + ' KB';
}

export function count(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : String(value ?? '—');
}

export function plural(n, one, many) {
  return Number(n) === 1 ? one : many || one + 's';
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Time left as a label plus a state a stylesheet can colour. */
export function timeLeft(iso, now = Date.now()) {
  const then = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(then)) return { ms: NaN, label: 'no deadline', state: 'live' };
  const ms = then - now;
  const abs = Math.abs(ms);
  let label;
  if (ms <= 0) {
    if (abs < MINUTE) label = 'ended just now';
    else if (abs < HOUR) label = `ended ${Math.round(abs / MINUTE)}m ago`;
    else if (abs < DAY) label = `ended ${Math.round(abs / HOUR)}h ago`;
    else label = `ended ${Math.round(abs / DAY)}d ago`;
    return { ms, label, state: 'ended' };
  }
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  if (d >= 1) label = d >= 2 ? `${d}d ${h}h left` : `${d}d ${h}h left`;
  else if (h >= 1) label = `${h}h ${m}m left`;
  else if (m >= 1) label = `${m}m left`;
  else label = '<1m left';
  return { ms, label, state: ms < DAY ? 'soon' : 'live' };
}

/** The absolute date, in UTC, for tooltips and the facts list. */
export function dateLabel(iso) {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return '—';
  const day = t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const time = t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${day}, ${time} UTC`;
}

export function shortDate(iso) {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return '—';
  return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function ago(iso) {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return '';
  const abs = Date.now() - t;
  if (abs < 0) return 'just now';
  if (abs < HOUR) return `${Math.max(1, Math.round(abs / MINUTE))}m ago`;
  if (abs < DAY) return `${Math.round(abs / HOUR)}h ago`;
  if (abs < 30 * DAY) return `${Math.round(abs / DAY)}d ago`;
  return shortDate(iso);
}

/** A bounty's state, decided by its deadline first and the API's status second. */
export function stateOf(item, now = Date.now()) {
  const deadline = item && item.deadline ? new Date(item.deadline).getTime() : NaN;
  const resolved = item && item.status === 'resolved';
  const ended = Number.isFinite(deadline) && deadline <= now;
  const closed = item && item.acceptingSubmissions === false;
  if (resolved) return { key: 'resolved', label: 'Resolved', pill: 'neutral' };
  if (ended) return { key: 'ended', label: 'Ended', pill: 'ended' };
  if (closed) return { key: 'ended', label: 'Closed', pill: 'ended' };
  if (Number.isFinite(deadline) && deadline - now < DAY) return { key: 'soon', label: 'Closing soon', pill: 'soon' };
  return { key: 'live', label: 'Open', pill: 'live' };
}

export function statusPill(item, now = Date.now()) {
  const s = stateOf(item, now);
  return `<span class="pill ${s.pill}"><span class="dot" aria-hidden="true"></span>${esc(s.label)}</span>`;
}

/** The live pot: the base reward plus the entry fees paid in, when the API shows them. */
export function potOf(item) {
  if (item && item.potUsd !== undefined && item.potUsd !== null && item.potUsd !== '') return Number(item.potUsd);
  const base = Number(item?.rewardAmount ?? 0);
  const fees = Number(item?.entryFeesUsd ?? 0);
  return (Number.isFinite(base) ? base : 0) + (Number.isFinite(fees) ? fees : 0);
}

export function potNote(item) {
  const fees = Number(item?.entryFeesUsd ?? 0);
  if (!Number.isFinite(fees) || fees <= 0) return '';
  return `incl. ${money(fees)} fees`;
}

const AVATAR_PX = { sm: 28, md: 38, lg: 84 };

export function avatar(url, size = 'sm', alt = '') {
  const px = AVATAR_PX[size] || 28;
  if (!url) return `<span class="avatar ${size}" aria-hidden="true"></span>`;
  return (
    `<img class="avatar ${size}" src="${esc(mediaUrl(url))}" alt="${esc(alt)}" ` +
    `width="${px}" height="${px}" loading="lazy" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer">`
  );
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

// ---------------------------------------------------------------- markdown

const PLACEHOLDER = '\u0000';

function safeHref(href) {
  const raw = String(href || '').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^mailto:/i.test(raw)) return raw;
  if (/^\/bounty\/[A-Za-z0-9._~%/-]+$/.test(raw)) return '#/bounty/' + raw.slice('/bounty/'.length);
  if (/^\/u\/[A-Za-z0-9._~%/-]+$/.test(raw)) return '#/u/' + raw.slice('/u/'.length);
  if (raw.startsWith('#/') || raw === '#' || raw.startsWith('/api/')) return raw;
  return '#';
}

function inline(text) {
  let s = esc(text);
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, code) => {
    codes.push(`<code>${code}</code>`);
    return `${PLACEHOLDER}C${codes.length - 1}${PLACEHOLDER}`;
  });

  const links = [];
  s = s.replace(/\[([^\]\n]+)\]\((\S+?)\)/g, (_m, label, href) => {
    const url = safeHref(href);
    const ext = /^https?:/i.test(url) ? ' target="_blank" rel="noopener nofollow"' : '';
    links.push(`<a href="${esc(url)}"${ext}>${label}</a>`);
    return `${PLACEHOLDER}L${links.length - 1}${PLACEHOLDER}`;
  });

  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_m, pre, url) => {
    links.push(`<a href="${esc(url)}" target="_blank" rel="noopener nofollow">${esc(url)}</a>`);
    return `${pre}${PLACEHOLDER}L${links.length - 1}${PLACEHOLDER}`;
  });

  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');

  s = s.replace(new RegExp(`${PLACEHOLDER}L(\\d+)${PLACEHOLDER}`, 'g'), (_m, n) => links[+n]);
  s = s.replace(new RegExp(`${PLACEHOLDER}C(\\d+)${PLACEHOLDER}`, 'g'), (_m, n) => codes[+n]);
  return s;
}

/** The markdown-ish text the API returns: headings, lists, quotes, code, links, bold. */
export function md(source) {
  const text = String(source || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '';

  const blocks = [];
  const fenced = text.replace(/(```+)([A-Za-z0-9_-]*)\n([\s\S]*?)\1/g, (_m, _fence, lang, code) => {
    blocks.push(`<pre><code${lang ? ` class="lang-${esc(lang)}"` : ''}>${esc(code.replace(/\n$/, ''))}</code></pre>`);
    return `\n${PLACEHOLDER}B${blocks.length - 1}${PLACEHOLDER}\n`;
  });

  const lines = fenced.split('\n');
  const out = [];
  let i = 0;
  const blockOnly = /^\s*(\d+[.)]|[-*+])\s+/;
  const heading = /^(#{1,6})\s+(.*)$/;
  const bullet = /^\s*[-*+]\s+(.*)$/;
  const numbered = /^\s*\d+[.)]\s+(.*)$/;
  const quote = /^\s*>\s?(.*)$/;
  const rule = /^\s*([-*_])(?:\s*\1){2,}\s*$/;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const block = trimmed.match(new RegExp(`^${PLACEHOLDER}B(\\d+)${PLACEHOLDER}$`));
    if (block) {
      out.push(blocks[+block[1]]);
      i++;
      continue;
    }

    if (rule.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    const h = trimmed.match(heading);
    if (h) {
      const level = Math.min(6, h[1].length + 1);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (quote.test(line)) {
      const buf = [];
      while (i < lines.length && quote.test(lines[i])) {
        buf.push(lines[i].replace(quote, '$1'));
        i++;
      }
      out.push(`<blockquote>${md(buf.join('\n'))}</blockquote>`);
      continue;
    }

    if (bullet.test(line)) {
      const items = [];
      while (i < lines.length && bullet.test(lines[i])) {
        items.push(lines[i].replace(bullet, '$1'));
        i++;
      }
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`);
      continue;
    }

    if (numbered.test(line)) {
      const items = [];
      while (i < lines.length && numbered.test(lines[i])) {
        items.push(lines[i].replace(numbered, '$1'));
        i++;
      }
      out.push(`<ol>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ol>`);
      continue;
    }

    const para = [];
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) break;
      if (blockOnly.test(next) || heading.test(next) || rule.test(next) || quote.test(next)) break;
      if (new RegExp(`^${PLACEHOLDER}B(\\d+)${PLACEHOLDER}$`).test(next.trim())) break;
      para.push(next);
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }

  return out.join('\n');
}