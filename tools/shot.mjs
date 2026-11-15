// Dev tool, not part of the entry: take one screenshot of the running app over CDP.
//
//   node tools/shot.mjs "http://localhost:8787/#/" screenshots/1-board.png
//   node tools/shot.mjs "http://localhost:8787/#/bounty/x" out.png 390 844
//
// It waits for window.__shotReady (the app sets it when a route's data has rendered), then
// captures the viewport. Console errors are printed, so a blank shot is never a surprise.

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromePath =
  process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = Number(process.env.CDP_PORT || 9333);
const [url, out = 'shot.png', w = '1280', h = '800', budget = '25000'] = process.argv.slice(2);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const slot = this.pending.get(msg.id);
        if (!slot) return;
        this.pending.delete(msg.id);
        if (msg.error) slot.reject(new Error(msg.error.message));
        else slot.resolve(msg.result);
        return;
      }
      for (const fn of this.handlers.get(msg.method) || []) fn(msg.params);
    });
  }

  static open(wsUrl) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      socket.addEventListener('open', () => resolve(new CDP(socket)));
      socket.addEventListener('error', () => reject(new Error('cannot open the devtools socket')));
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
}

const userData = mkdtempSync(join(tmpdir(), 'mf-shot-'));
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${w},${h}`,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userData}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function target() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  throw new Error('chrome did not open a devtools port');
}

const page = await target();
const cdp = await CDP.open(page.webSocketDebuggerUrl);

const errors = [];
cdp.on('Runtime.exceptionThrown', (e) => {
  const d = e.exceptionDetails || {};
  errors.push(d.exception?.description || d.text || 'exception');
});
cdp.on('Runtime.consoleAPICalled', (e) => {
  if (e.type === 'error' || e.type === 'warning') {
    errors.push(e.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
});
cdp.on('Log.entryAdded', (e) => {
  if (e.entry.level === 'error') errors.push(e.entry.text);
});

await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: Number(w),
  height: Number(h),
  deviceScaleFactor: 1,
  mobile: false,
});

const loaded = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve));
await cdp.send('Page.navigate', { url });
await Promise.race([loaded, sleep(15000)]);

let state = null;
const deadline = Date.now() + Number(budget);
while (Date.now() < deadline) {
  const probe = await cdp.send('Runtime.evaluate', {
    expression:
      'JSON.stringify({ready: window.__shotReady === true, text: document.body.innerText.length, ' +
      'title: document.title, route: document.documentElement.dataset.route || null, ' +
      'rows: document.querySelectorAll("article.row, .solution, .person, .who-cell").length})',
    returnByValue: true,
  });
  state = JSON.parse(probe.result.value);
  if (state.ready && state.text > 150) break;
  await sleep(200);
}

await sleep(500); // let avatars and late cards paint

if (process.env.EVAL) {
  const out = await cdp.send('Runtime.evaluate', {
    expression: process.env.EVAL,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log('EVAL', JSON.stringify(out.result && out.result.value !== undefined ? out.result.value : out));
}

if (process.env.INSPECT) {
  const info = await cdp.send('Runtime.evaluate', {
    expression:
      'JSON.stringify((() => {' +
      ' const box = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };' +
      ' const q = (s, n = 5) => Array.from(document.querySelectorAll(s)).slice(0, n).map((e) => [s, e.className, box(e)]);' +
      ' return { vw: innerWidth, scroll: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight,' +
      ' h1: q("h1"), stats: q(".stat"), rows: q("article.row"), nums: q(".row-nums"),' +
      ' table: q(".table-wrap"), fact: q(".fact"), prose: q(".prose"), aside: q("aside"), card: q("aside .card"),' +
      ' grids: (() => { const n = document.querySelector(".row-nums"); return n ? getComputedStyle(n).gridTemplateColumns : null; })(),' +
      ' nav: (() => { const n = document.querySelector(".nav"); const r = n.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.width), n.scrollWidth, n.clientWidth, getComputedStyle(n).overflowX]; })(),' +
      ' over: Array.from(document.querySelectorAll("body *")).filter((e) => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map((e) => [e.tagName, String(e.className).slice(0, 30), Math.round(e.getBoundingClientRect().right), Math.round(e.getBoundingClientRect().width)]) };' +
      '})())',
    returnByValue: true,
  });
  console.log(info.result.value);
}

const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const bytes = Buffer.from(shot.data, 'base64');
writeFileSync(out, bytes);

console.log(
  JSON.stringify(
    {
      out,
      bytes: bytes.length,
      url,
      width: w,
      height: h,
      ...state,
      errors: errors.slice(0, 8),
    },
    null,
    2,
  ),
);

cdp.socket.close();
chrome.kill('SIGKILL');
process.exit(errors.length ? 0 : 0);