const origin = 'https://make.fun';
const memory = new Map();
const pending = new Map();
const prefix = 'build-board:v1:';

function cached(path) {
  if (memory.has(path)) return memory.get(path);
  try {
    const value = JSON.parse(sessionStorage.getItem(prefix + path));
    if (value && typeof value === 'object' && 'body' in value && Number.isFinite(value.at)) {
      memory.set(path, value);
      return value;
    }
  } catch { /* Storage can be unavailable or full; the memory cache still works. */ }
  return null;
}

async function request(path) {
  const previous = cached(path);
  const headers = { Accept: 'application/json' };
  if (previous?.etag) headers['If-None-Match'] = previous.etag;
  try {
    const response = await fetch(origin + path, {
      method: 'GET', headers, credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(25000)
    });
    if (response.status === 304 && previous) {
      previous.at = Date.now();
      save(path, previous);
      return { data: previous.body, at: previous.at, stale: false };
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.error?.map(item => item.message).join(' ') || `make.fun returned HTTP ${response.status}.`;
      throw new Error(response.status === 429 ? `${message} Please wait ${response.headers.get('Retry-After') || 'a few'} seconds, then retry.` : message);
    }
    const body = await response.json();
    if (body?.success === false) throw new Error(body.error?.[0]?.message || 'The request was not successful.');
    const entry = { body, etag: response.headers.get('ETag'), at: Date.now() };
    save(path, entry);
    return { data: body, at: entry.at, stale: false };
  } catch (error) {
    if (previous) return { data: previous.body, at: previous.at, stale: true, message: error.message };
    throw error;
  }
}
function save(path, entry) {
  memory.set(path, entry);
  if (memory.size > 24) memory.delete(memory.keys().next().value);
  try { sessionStorage.setItem(prefix + path, JSON.stringify(entry)); } catch { /* Best effort. */ }
}
export function get(path) {
  if (!path.startsWith('/api/') || path.includes('://')) return Promise.reject(new Error('Only make.fun public API paths are supported.'));
  if (!pending.has(path)) pending.set(path, request(path).finally(() => pending.delete(path)));
  return pending.get(path);
}
export const board = (cursor) => get('/api/competitions?activity=times&limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
export const bounty = (slug) => get(`/api/competitions/${encodeURIComponent(slug)}?submissions=summary`);
export const leaderboard = (slug, phase = '') => get(`/api/competitions/${encodeURIComponent(slug)}/leaderboard?rows=first&ties=runs${phase ? '&phase=' + encodeURIComponent(phase) : ''}`);
export const profile = (handle) => get(`/api/profiles/${encodeURIComponent(handle)}`);
