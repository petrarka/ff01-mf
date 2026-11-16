import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.sessionStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value)
};
let calls = [];
let reply;
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  return reply(url, options);
};
const api = await import('../app/api.js');

test('ETag revalidation, 304 reuse, persistent recovery and stale fallback', async () => {
  reply = async () => new Response(JSON.stringify({ items: [{ slug: 'ours' }] }), { headers: { ETag: '"version-one"' } });
  const first = await api.get('/api/cache-test');
  assert.equal(first.stale, false);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.credentials, 'omit');
  reply = async () => new Response(null, { status: 304 });
  const next = await api.get('/api/cache-test');
  assert.deepEqual(next.data, first.data);
  assert.equal(calls.at(-1).options.headers['If-None-Match'], '"version-one"');
  const reloaded = await import('../app/api.js?fresh-memory');
  assert.deepEqual((await reloaded.get('/api/cache-test')).data, first.data);
  assert.equal(calls.at(-1).options.headers['If-None-Match'], '"version-one"');
  reply = async () => { throw new TypeError('Network unavailable'); };
  const stale = await api.get('/api/cache-test');
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.data, first.data);
  await assert.rejects(api.get('/api/uncached'), /Network unavailable/);
});

test('concurrent readers share one request and failed requests remain retryable', async () => {
  let release;
  reply = () => new Promise(resolve => { release = resolve; });
  const before = calls.length;
  const a = api.get('/api/dedupe'), b = api.get('/api/dedupe');
  assert.equal(a, b);
  release(new Response('{"ok":true}'));
  assert.equal((await a).data.ok, true);
  assert.equal(calls.length, before + 1);
  reply = async () => new Response('{"error":[{"message":"Try later"}]}', { status: 503 });
  await assert.rejects(api.get('/api/retry'), /Try later/);
  reply = async () => new Response('{"recovered":true}');
  assert.equal((await api.get('/api/retry')).data.recovered, true);
});

test('a browser-blocked conditional response falls back to a fresh full read', async () => {
  reply = async () => new Response('{"version":1}', { headers: { ETag: '"old"' } });
  await api.get('/api/cors-revalidation');
  reply = async (_url, options) => {
    if (options.headers['If-None-Match']) throw new TypeError('Failed to fetch');
    return new Response('{"version":2}', { headers: { ETag: '"new"' } });
  };
  const refreshed = await api.get('/api/cors-revalidation');
  assert.equal(refreshed.data.version, 2);
  assert.equal(refreshed.stale, false);
  assert.equal(calls.at(-2).options.headers['If-None-Match'], '"old"');
  assert.equal(calls.at(-1).options.headers['If-None-Match'], undefined);
});

test('public scores use their actual units and avatars stay on the API origin', async () => {
  const { score, avatarURL } = await import('../app/ui.js');
  assert.equal(score(949192, '949192', { key: 'judge' }), '94.92%');
  assert.equal(score(0, '0', { key: 'judge' }), '0.00%');
  assert.equal(score(null, null, { key: 'judge' }), '—');
  assert.equal(score('28100000', '28100000', { title: 'Net PnL (micro-USDC)' }), '$28.10');
  assert.equal(avatarURL({ image: 'https://elsewhere.invalid/avatar.png' }), '');
  assert.equal(avatarURL({ avatar: { url_small: '/api/avatars/test.webp' } }), 'https://make.fun/api/avatars/test.webp');
});

test('denied storage does not break live data, API paths stay restricted', async () => {
  globalThis.sessionStorage = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Full'); } };
  reply = async () => new Response('{"ok":true}');
  assert.equal((await api.get('/api/no-storage')).data.ok, true);
  await assert.rejects(api.get('https://elsewhere.invalid'), /Only make.fun/);
});

test('public descriptions are escaped and deadline states are honest', async () => {
  const { markdown, state, money } = await import('../app/ui.js');
  const html = markdown('# Brief\n\n<script>alert(1)</script>\n\n- **Own work**\n- `literal`\n\n[link](javascript:alert)');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>') && !html.includes('href='));
  assert.ok(html.includes('<ul>') && html.includes('<strong>Own work</strong>'));
  assert.equal(state({ status: 'open', deadline: '2020-01-01' })[0], 'closed');
  assert.equal(state({ status: 'resolved' })[0], 'resolved');
  assert.equal(money(null), '—');
  assert.equal(money('0.50'), '$0.50');
});
