// make.fun's public API client: read-only GETs with an ETag-aware, two-tier cache.
//
// make.fun sends an ETag on every answer and binds it to the minute, so a repeat read is
// almost always a 304. Answers live in memory for the session and in localStorage across
// reloads; every call past the freshness window revalidates with If-None-Match and keeps a
// stale answer if the network fails. Nothing here writes or signs in.

const API = 'https://make.fun/api';
const ORIGIN = 'https://make.fun';
const LS_PREFIX = 'makefun.cache.v1.';
const LS_BUDGET = 3_200_000; // characters of JSON, well under the 5 MB localStorage cap
const FRESH_MS = 8_000; // serve from memory without a request inside this window

const mem = new Map(); // url -> { data, etag, at }
const inflight = new Map(); // url -> promise
const lsOrder = []; // keys written this session, oldest first

export const stats = {
  requests: 0,
  hits: 0,
  misses: 0,
  revalidated: 0, // 304 Not Modified
  stale: 0, // served from localStorage this session
  errors: 0,
};

const note = () => {
  const el = document.getElementById('cache-note');
  if (!el) return;
  const bits = [
    `${stats.requests} fetched`,
    `${stats.revalidated} revalidated (304)`,
    `${stats.hits} cache hit${stats.hits === 1 ? '' : 's'}`,
  ];
  if (stats.stale) bits.push(`${stats.stale} from disk`);
  el.textContent = 'ETag cache · ' + bits.join(' · ');
};

function lsKey(url) {
  return LS_PREFIX + url;
}

function lsRead(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function lsDrop(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode, quota, disabled */
  }
}

function lsSweep() {
  // Keep the cache inside its budget: drop the least recently written answers first.
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LS_PREFIX)) total += (localStorage.getItem(k) || '').length + k.length;
  }
  let guard = 0;
  while (total > LS_BUDGET && lsOrder.length && guard++ < 200) {
    const k = lsOrder.shift();
    const v = localStorage.getItem(k);
    if (v) total -= v.length + k.length;
    lsDrop(k);
  }
}

function remember(url, entry) {
  mem.set(url, entry);
  const key = lsKey(url);
  if (lsWrite(key, { e: entry.etag || null, d: entry.data, t: entry.at })) {
    if (!lsOrder.includes(key)) lsOrder.push(key);
    lsSweep();
  }
}

function hydrate(url) {
  const saved = lsRead(lsKey(url));
  if (!saved || typeof saved.t !== 'number' || !('d' in saved)) return null;
  const entry = { data: saved.d, etag: saved.e || null, at: saved.t };
  mem.set(url, entry);
  if (!lsOrder.includes(lsKey(url))) lsOrder.push(lsKey(url));
  stats.stale++;
  return entry;
}

function cached(url) {
  return mem.get(url) || hydrate(url);
}

/** The absolute URL of an API path, or a path already absolute. */
export function apiUrl(path) {
  return path.startsWith('http') ? path : API + path;
}

/** An API-relative path (/api/avatars/…) or absolute URL as a full URL. */
export function mediaUrl(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : ORIGIN + path;
}

async function send(url, etag, signal) {
  const headers = {};
  if (etag) headers['If-None-Match'] = etag;
  const res = await fetch(url, {
    headers,
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store', // the ETag handshake here is the cache
    signal,
  });
  if (res.status === 304) return { notModified: true };
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText || ''}`.trim());
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return { notModified: false, data, etag: res.headers.get('ETag') };
}

/**
 * GET an API path as JSON, cached and revalidated.
 * opts.fresh  ms a memory answer is used without asking (default 8s)
 * opts.signal an AbortSignal to cancel the request
 */
export async function getJSON(path, opts = {}) {
  const url = apiUrl(path);
  const fresh = opts.fresh === undefined ? FRESH_MS : opts.fresh;
  const now = Date.now();

  const have = cached(url);
  if (have && now - have.at < fresh) {
    stats.hits++;
    note();
    return have.data;
  }
  if (inflight.has(url)) {
    stats.hits++;
    return inflight.get(url);
  }

  const work = (async () => {
    stats.requests++;
    try {
      const res = await send(url, have && have.etag, opts.signal);
      if (res.notModified && have) {
        have.at = Date.now();
        stats.revalidated++;
        note();
        return have.data;
      }
      stats.misses++;
      remember(url, { data: res.data, etag: res.etag, at: Date.now() });
      note();
      return res.data;
    } catch (err) {
      stats.errors++;
      if (err && err.name === 'AbortError') throw err;
      if (have) {
        note();
        return have.data; // stale is better than blank
      }
      throw err;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, work);
  return work;
}

// ---------------------------------------------------------------- endpoints

const boardPath = (status) => `/competitions?status=${encodeURIComponent(status)}&activity=times&limit=60`;

export const api = {
  /** The board, one status at a time: 'open', 'closed' or 'resolved'. */
  board(status = 'open', opts) {
    return getJSON(boardPath(status), opts);
  },

  /** One bounty by slug: description, rules, rewards, dates, phases. */
  competition(slug, opts) {
    return getJSON(`/competitions/${encodeURIComponent(slug)}`, opts);
  },

  /** A bounty's leaderboard. view: 'performance' | 'overall' | 'cost' | 'efficiency'; rows: 'all' | 'first'. */
  leaderboard(slug, { view, phase, rows } = {}, opts) {
    const q = new URLSearchParams();
    if (view) q.set('view', view);
    if (phase) q.set('phase', phase);
    if (rows) q.set('rows', rows);
    const suffix = q.toString() ? `?${q}` : '';
    return getJSON(`/competitions/${encodeURIComponent(slug)}/leaderboard${suffix}`, opts);
  },

  /** A public account profile. */
  profile(handle, opts) {
    return getJSON(`/profiles/${encodeURIComponent(handle)}`, opts);
  },
};

/** The slugs the board cache already knows, for the header's find box. */
export function knownSlugs() {
  const found = new Set();
  for (const entry of mem.values()) {
    const items = entry.data && entry.data.items;
    if (!Array.isArray(items)) continue;
    for (const item of items) if (item && item.slug) found.add(item.slug);
  }
  return found;
}

export { API, ORIGIN, note as noteCache };
