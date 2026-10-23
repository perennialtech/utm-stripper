const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(new URL('../utm-stripper.user.js', `file://${__filename}`), 'utf8');

function createPage(url = 'https://example.test/?utm_source=mail&id=1#top', script = source) {
  const calls = { fetch: [], xhr: [], beacon: [], open: [], history: [] };
  const handlers = new Map();
  const location = { href: url };
  const document = {
    baseURI: 'https://example.test/page',
    addEventListener(name, listener) { handlers.set(name, listener); },
  };
  const history = {
    state: { intact: true },
    replaceState(state, title, next) {
      calls.history.push(['replaceState', state, title, next]);
      if (next !== undefined) location.href = String(next);
    },
    pushState(state, title, next) {
      calls.history.push(['pushState', state, title, next]);
      if (next !== undefined) location.href = String(next);
    },
  };
  class XMLHttpRequest {
    open(...args) { calls.xhr.push(args); }
  }
  const navigator = {
    sendBeacon(...args) { calls.beacon.push(args); return true; },
  };
  const page = {
    URL, Request, document, history, location, XMLHttpRequest, navigator,
    open(...args) { calls.open.push(args); },
    async fetch(...args) { calls.fetch.push(args); return { ok: true }; },
  };
  page.window = page;
  vm.runInNewContext(script, page, { filename: 'utm-stripper.user.js' });
  return { page, calls, handlers };
}

test('cleans the current URL without losing other query parameters, fragments or history state', () => {
  const { page, calls } = createPage('https://example.test/?utm_source=x&ID=1&UTM_CUSTOM=y&x=2#frag');
  assert.equal(page.location.href, 'https://example.test/?ID=1&x=2#frag');
  assert.deepEqual(calls.history[0][1], { intact: true });
});

test('does not rewrite an unrelated URL', async () => {
  const { page, calls } = createPage('https://example.test/page?foo=1#frag');
  assert.equal(calls.history.length, 0);
  await page.fetch('/api?q=hello%20world');
  assert.equal(calls.fetch[0][0], '/api?q=hello%20world');
});

test('cleans dynamically encountered links on click and context menu', () => {
  const { handlers } = createPage();
  const anchor = {
    href: 'https://example.test/?utm_content=ad&keep=yes',
    matches(selector) { return selector === 'a[href], area[href]'; },
    hasAttribute(name) { return name === 'href'; },
  };
  const event = { composedPath() { return [anchor]; } };
  handlers.get('pointerdown')(event);
  assert.equal(anchor.href, 'https://example.test/?keep=yes');
  anchor.href = 'https://example.test/?utm_medium=social&x=3';
  handlers.get('contextmenu')(event);
  assert.equal(anchor.href, 'https://example.test/?x=3');
});

test('intercepts common programmatic navigation and requests', async () => {
  const { page, calls } = createPage();
  await page.fetch('/collect?%75tm_source=email&ok=1#anchor');
  assert.equal(calls.fetch[0][0], 'https://example.test/collect?ok=1#anchor');

  const xhr = new page.XMLHttpRequest();
  xhr.open('GET', '/data?UTM_CAMPAIGN=ad&x=2', true);
  assert.equal(calls.xhr[0][1], 'https://example.test/data?x=2');

  page.navigator.sendBeacon('/track?utm_medium=x&keep=1', 'payload');
  assert.equal(calls.beacon[0][0], 'https://example.test/track?keep=1');

  page.open('https://other.test/?utm_term=a&value=b', '_blank');
  assert.equal(calls.open[0][0], 'https://other.test/?value=b');

  page.history.pushState({ v: 1 }, '', '/route?utm_source=abc&z=1');
  assert.equal(page.location.href, 'https://example.test/route?z=1');
});

test('preserves POST method, headers and body for fetch(Request)', async () => {
  const { page, calls } = createPage();
  const request = new Request('https://example.test/post?utm_campaign=test&keep=1', {
    method: 'POST',
    headers: { 'X-Test': 'present' },
    body: 'hello world',
  });
  await page.fetch(request);
  const rewritten = calls.fetch[0][0];
  assert.equal(rewritten.url, 'https://example.test/post?keep=1');
  assert.equal(rewritten.method, 'POST');
  assert.equal(rewritten.headers.get('X-Test'), 'present');
  assert.equal(await rewritten.text(), 'hello world');
  // Like native fetch(Request), constructing a replacement may consume the original body stream.
});

test('removes common advertising and social tracking keys, preserving regular parameters', async () => {
  const { page, calls } = createPage('https://example.test/?id=1');
  await page.fetch('https://example.test/story?FBCLID=one&gclid=two&msclkid=three&ttclid=four&igshid=five&srsltid=six&epik=seven&ref=needed&si=useful');
  assert.equal(calls.fetch[0][0], 'https://example.test/story?ref=needed&si=useful');
  assert.equal(page.location.href, 'https://example.test/?id=1');
});

test('removes email and analytics tracking keys', async () => {
  const { page, calls } = createPage();
  await page.fetch('/?MC_EID=abc&mkt_tok=def&_hsenc=ghi&vero_id=123&_gl=a1&token=real');
  assert.equal(calls.fetch[0][0], 'https://example.test/?token=real');
});

test('removes repeated and percent-encoded tracking key names', async () => {
  const { page, calls } = createPage();
  await page.fetch('/?%66bclid=one&fbclid=two&UTM_SOURCE=three&utm_source=four&k=1');
  assert.equal(calls.fetch[0][0], 'https://example.test/?k=1');
});

test('does not remove ambiguous parameters used by real websites', async () => {
  const { page, calls } = createPage();
  const url = '/?ref=abc&source=internal&tag=aff&id=42&si=share&feature=related&q=geese&token=abc&campaign=buy&clickid=something';
  await page.fetch(url);
  assert.equal(calls.fetch[0][0], url);
});

test('custom additions and preserve exceptions override the defaults', async () => {
  const customized = source
    .replace('const ADDITIONAL_PARAMS = [];', "const ADDITIONAL_PARAMS = ['My_Tracking'];")
    .replace('const PRESERVE_PARAMS = [];', "const PRESERVE_PARAMS = ['UTM_SOURCE', 'gclid'];");
  const { page, calls } = createPage('https://example.test/?id=1', customized);
  await page.fetch('/?my_tracking=abc&UTM_SOURCE=keep&gclid=keep&fbclid=remove&x=2');
  assert.equal(calls.fetch[0][0], 'https://example.test/?UTM_SOURCE=keep&gclid=keep&x=2');
});
