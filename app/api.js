const origin = 'https://make.fun';
const memory = new Map();
const pending = new Map();
const prefix = 'fieldwork:v1:';
const capacity = 16;
let browserValidation = false;
try { browserValidation = sessionStorage.getItem('fieldwork:browser-validation') === 'true'; } catch {}
function read(path) {
  if (memory.has(path)) return memory.get(path);
  try {
    const saved = JSON.parse(sessionStorage.getItem(prefix + path));
    if (saved && typeof saved.etag === 'string' && 'data' in saved) {
      memory.set(path, saved);
      return saved;
    }
  } catch { /* A blocked or full storage area must not block a public read. */ }
}
function remember(path, answer) {
  memory.delete(path);
  memory.set(path, answer);
  while (memory.size > capacity) memory.delete(memory.keys().next().value);
  try {
    sessionStorage.setItem(prefix + path, JSON.stringify(answer));
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith(prefix));
    keys.filter(k => k !== prefix + path).slice(0, Math.max(0, keys.length - capacity)).forEach(k => sessionStorage.removeItem(k));
  } catch { /* The bounded in-memory cache still works when persistence is unavailable. */ }
}
export function get(path) {
  if (!path.startsWith('/api/')) return Promise.reject(new Error('Only public API paths are supported.'));
  if (pending.has(path)) return pending.get(path);
  const request = (async () => {
    const cached = read(path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const conditional = cached?.etag && !browserValidation;
      const request = headers => fetch(origin + path, {
        method: 'GET', credentials: 'omit', cache: 'no-cache', signal: controller.signal,
        headers: {Accept: 'application/json', ...headers}
      });
      let response;
      try {
        response = await request(conditional ? {'If-None-Match': cached.etag} : {});
      } catch (error) {
        if (!(conditional && error instanceof TypeError)) throw error;
        // Some API edges omit CORS headers on 304. Let the browser merge its
        // own conditional response with the cached 200 before the CORS check.
        browserValidation = true;
        try { sessionStorage.setItem('fieldwork:browser-validation', 'true'); } catch {}
        response = await request({});
      }
      if (response.status === 304 && cached) return cached.data;
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        const detail = problem.detail || problem.message || problem.error?.[0]?.message;
        throw new Error(response.status === 404 ? 'This bounty or builder is not available publicly. Check the address and try again.' : detail || `make.fun returned ${response.status}. Please retry in a moment.`);
      }
      const data = await response.json();
      remember(path, {etag: response.headers.get('ETag') || '', data});
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('make.fun took too long to respond. Please retry.');
      if (error instanceof TypeError) throw new Error('Could not reach make.fun. Check your connection, then retry.');
      throw error;
    } finally { clearTimeout(timer); }
  })();
  pending.set(path, request);
  request.finally(() => pending.delete(path)).catch(() => {});
  return request;
}
export const competition = slug => get(`/api/competitions/${encodeURIComponent(slug)}?submissions=summary`);
export const picture = handle => `${origin}/api/profiles/${encodeURIComponent(handle)}/picture.png`;
