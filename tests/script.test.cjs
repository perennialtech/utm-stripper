const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(new URL('../utm-stripper.user.js', `file://${__filename}`), 'utf8');

test('userscript metadata matches the package version', () => {
  const pkg = require('../package.json');
  const match = source.match(/^\/\/ @version\s+(\d+\.\d+\.\d+)$/m);
  assert.ok(match, 'userscript must declare a semantic version');
  assert.equal(match[1], pkg.version);
});

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

test('strips additional Firefox Remote Settings tracking identifiers globally', async () => {
  const { page, calls } = createPage('https://example.test/?id=1');
  await page.fetch('/?__s=abc&_openstat=1&wickedid=2&ysclid=3&__hssc=4&hsCtaTracking=5&token=live');
  assert.equal(calls.fetch[0][0], 'https://example.test/?token=live');
});

test('strips high-confidence campaign tags from Mozilla Strip-on-Share global rules', async () => {
  const { page, calls } = createPage();
  await page.fetch('/?matomo_campaign=a&mtm_source=b&pk_campaign=c&piwik_kwd=d&hsa_cam=e&gclsrc=f&ref=still-here');
  assert.equal(calls.fetch[0][0], 'https://example.test/?ref=still-here');
});

test('strips X/Twitter share decoration on exact hosts, not other sites', async () => {
  const { page, calls } = createPage();
  await page.fetch('https://x.com/user/status/123?s=20&cxt=abc&ref_src=twsrc%5Etfw&id=42');
  await page.fetch('https://www.twitter.com/user/status/123?refsrc=foo&ref_url=bar');
  await page.fetch('https://x.com.evil.test/user/status/123?s=20&ref_src=keep');
  await page.fetch('https://example.test/?s=search&cxt=valid&refsrc=valid');
  assert.equal(calls.fetch[0][0], 'https://x.com/user/status/123?id=42');
  assert.equal(calls.fetch[1][0], 'https://www.twitter.com/user/status/123');
  assert.equal(calls.fetch[2][0], 'https://x.com.evil.test/user/status/123?s=20&ref_src=keep');
  assert.equal(calls.fetch[3][0], 'https://example.test/?s=search&cxt=valid&refsrc=valid');
});

test('strips share IDs on YouTube and Spotify but preserves them elsewhere', async () => {
  const { page, calls } = createPage();
  await page.fetch('https://youtu.be/xyz?si=tracking&t=123');
  await page.fetch('https://m.youtube.com/watch?v=xyz&si=tracking&feature=share');
  await page.fetch('https://open.spotify.com/track/xyz?si=tracking&context=album');
  await page.fetch('https://example.test/?si=important');
  assert.equal(calls.fetch[0][0], 'https://youtu.be/xyz?t=123');
  assert.equal(calls.fetch[1][0], 'https://m.youtube.com/watch?v=xyz&feature=share');
  assert.equal(calls.fetch[2][0], 'https://open.spotify.com/track/xyz?context=album');
  assert.equal(calls.fetch[3][0], 'https://example.test/?si=important');
});

test('Amazon rules are destination-specific and preserve product choices', async () => {
  const { page, calls } = createPage();
  await page.fetch('https://www.amazon.com.au/dp/B000123?pd_rd_r=abc&pf_rd_p=def&ref_=foo&th=1&psc=1&tag=affiliate-20');
  await page.fetch('https://amazon.co.uk/dp/B000123?pd_rd_w=abc&ref=helpful');
  await page.fetch('https://amazon.com.au.evil.test/dp/B000123?pd_rd_r=keep');
  await page.fetch('https://example.test/dp/B000123?pd_rd_r=needed&ref_=needed');
  assert.equal(calls.fetch[0][0], 'https://www.amazon.com.au/dp/B000123?th=1&psc=1&tag=affiliate-20');
  assert.equal(calls.fetch[1][0], 'https://amazon.co.uk/dp/B000123?ref=helpful');
  assert.equal(calls.fetch[2][0], 'https://amazon.com.au.evil.test/dp/B000123?pd_rd_r=keep');
  assert.equal(calls.fetch[3][0], 'https://example.test/dp/B000123?pd_rd_r=needed&ref_=needed');
});

test('Reddit, Instagram, Bilibili, Facebook site rules preserve content IDs', async () => {
  const { page, calls } = createPage();
  await page.fetch('https://old.reddit.com/r/test/comments/abc?ref_source=share&share_id=123&ref=keep');
  await page.fetch('https://www.instagram.com/p/xyz?ig_rid=abc&img_index=2');
  await page.fetch('https://www.bilibili.com/video/BV123?spm_id_from=share&p=2');
  await page.fetch('https://www.facebook.com/story.php?mibextid=abc&story_fbid=123&id=456');
  assert.equal(calls.fetch[0][0], 'https://old.reddit.com/r/test/comments/abc?ref=keep');
  assert.equal(calls.fetch[1][0], 'https://www.instagram.com/p/xyz?img_index=2');
  assert.equal(calls.fetch[2][0], 'https://www.bilibili.com/video/BV123?p=2');
  assert.equal(calls.fetch[3][0], 'https://www.facebook.com/story.php?story_fbid=123&id=456');
});

test('custom preserve exceptions also override site-specific rules', async () => {
  const customized = source.replace('const PRESERVE_PARAMS = [];', "const PRESERVE_PARAMS = ['si', 's'];");
  const { page, calls } = createPage('https://example.test/?id=1', customized);
  await page.fetch('https://x.com/status/1?s=20&cxt=abc');
  await page.fetch('https://youtu.be/abc?si=important&utm_source=tracking');
  assert.equal(calls.fetch[0][0], 'https://x.com/status/1?s=20');
  assert.equal(calls.fetch[1][0], 'https://youtu.be/abc?si=important');
});

test('unreviewed upstream share-list candidates do not modify links or application requests', async () => {
  const {page,calls,handlers} = createPage('https://example.test/?id=1');
  const urls = [
    'https://www.imdb.com/title/tt123456/?pf_rd_i=homepage&keep=1',
    'https://www.amazon.com.au/dp/B000123?hvadid=ads&keep=1',
    'https://www.bestbuy.com/site/item?irclickid=ads&keep=1',
    'https://ca.linkedin.com/feed/?trackingid=abc&keep=1',
  ];
  for (const url of urls) {
    await page.fetch(url);
    const xhr = new page.XMLHttpRequest();
    xhr.open('GET',url,true);
    page.navigator.sendBeacon(url,'body');
    const link = {href:url,matches(s){return s==='a[href], area[href]';},
      hasAttribute(k){return k==='href';}};
    handlers.get('click')({composedPath(){return [link]}});
    assert.equal(link.href,url);
  }
  assert.deepEqual(calls.fetch.map(x=>x[0]),urls);
  assert.deepEqual(calls.xhr.map(x=>x[1]),urls);
  assert.deepEqual(calls.beacon.map(x=>x[0]),urls);
});
