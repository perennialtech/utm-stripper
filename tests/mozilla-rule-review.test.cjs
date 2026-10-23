const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {
  compare, proposalSource, report, validateUpstream, readRuleGroups
} = require('../scripts/mozilla-rule-review.cjs');

// Fixture comparisons must remain stable even after previous proposals merge.
const source = fs.readFileSync(path.join(__dirname, '../utm-stripper.user.js'), 'utf8')
  .replace(/const MOZILLA_REVIEWED_GLOBAL = \[[\s\S]*?\];/, 'const MOZILLA_REVIEWED_GLOBAL = [];')
  .replace(/const MOZILLA_REVIEWED_SITES = \[[\s\S]*?\];/, 'const MOZILLA_REVIEWED_SITES = [];');

function fixtures() {
  return {
    remote: { data: [
      {stripList: ['fbclid', 'NEW_TRACKER'], allowList: ['googleadservices.com']}
    ] },
    mpl: {
      global: {isGlobal:true, queryParams: ['utm_source', 'adgroupid']},
      amazon: {hosts:['www.amazon.com', 'www.amazon.com.au'], queryParams:['pd_rd_i','keywords','ref_']}
    },
    lgpl: {
      global: {isGlobal:true, queryParams: ['at_campaign']},
      youtube: {hosts:['youtu.be'], queryParams:['si','feature']},
      unknown: {hosts:['other.example'], queryParams:['refer']}
    }
  };
}

test('new Remote Settings identifiers produce PR-ready global proposals', () => {
  const diff = compare(source, fixtures());
  assert.deepEqual(diff.proposal.global, ['new_tracker']);
  assert.deepEqual(diff.reviewOnlyGlobal.mpl, ['adgroupid']);
  assert.deepEqual(diff.reviewOnlyGlobal.lgpl, ['at_campaign']);
  assert.deepEqual(diff.allowList, ['googleadservices.com']);
});

test('only verified, existing exact hosts receive site-specific candidates', () => {
  const diff = compare(source, fixtures());
  const amazon = diff.proposal.site[0];
  assert.deepEqual(amazon.hosts, ['www.amazon.com', 'www.amazon.com.au']);
  assert.deepEqual(amazon.params, ['pd_rd_i']);
  assert.equal(diff.proposal.site.length, 1);
  assert.ok(diff.withheld.some(x => x.host === 'www.amazon.com' &&
    x.params.includes('keywords')));
  assert.ok(diff.withheld.some(x => x.host === 'youtu.be' &&
    x.params.includes('feature')));
  assert.ok(diff.unmatchedGroups.some(x => x.group === 'unknown'));
});

test('proposal is deterministic regardless of upstream record order', () => {
  const a = fixtures();
  const b = fixtures();
  b.remote.data[0].stripList.reverse();
  b.mpl.amazon.queryParams.reverse();
  b.mpl.amazon.hosts.reverse();
  assert.deepEqual(compare(source, a).proposal, compare(source, b).proposal);
  assert.equal(compare(source, a).fingerprint, compare(source, b).fingerprint);
});

test('generated script is valid and actually strips proposed rules only on proper hosts', async () => {
  const diff = compare(source, fixtures());
  const generated = proposalSource(source, diff.proposal);
  new vm.Script(generated);
  const globalList = readRuleGroups(generated);
  assert.deepEqual([...globalList.reviewedGlobal], ['new_tracker']);
  assert.equal(globalList.reviewedSite.length, 1);

  const calls = [];
  const document = {baseURI:'https://example.test/', addEventListener(){}};
  const history = {state: null, replaceState(){}, pushState(){}};
  const location = {href:'https://example.test/?id=1'};
  const page = {
    document, history, location, URL, Request,
    navigator:{sendBeacon(){return true}},
    XMLHttpRequest:class { open(){} },
    fetch:async function(input){calls.push(input)}
  };
  page.window = page;
  vm.runInNewContext(generated, page);
  await page.fetch('https://www.amazon.com/?pd_rd_i=123&ref_=abc&keywords=keep');
  await page.fetch('https://example.test/?pd_rd_i=keep&new_tracker=remove');
  assert.equal(calls[0], 'https://www.amazon.com/?keywords=keep');
  assert.equal(calls[1], 'https://example.test/?pd_rd_i=keep');
});

test('subsequent proposals preserve previously merged review additions', () => {
  const first = proposalSource(source, compare(source, fixtures()).proposal);
  const newer = fixtures();
  newer.remote.data[0].stripList = ['fbclid', 'another_tracker'];
  newer.mpl.amazon.queryParams = ['pf_rd_i'];
  const second = proposalSource(first, compare(first, newer).proposal);
  const rules = readRuleGroups(second);
  assert.deepEqual([...rules.reviewedGlobal], ['another_tracker', 'new_tracker']);
  assert.ok(rules.reviewedSite.some(x => x.params.includes('pd_rd_i')));
  assert.ok(rules.reviewedSite.some(x => x.params.includes('pf_rd_i')));
  const prev = Number(first.match(/^\/\/ @version\s+\d+\.\d+\.(\d+)/m)[1]);
  const next = Number(second.match(/^\/\/ @version\s+\d+\.\d+\.(\d+)/m)[1]);
  assert.equal(next, prev + 1);
});

test('unchanged upstream yields no proposal', () => {
  const f = fixtures();
  f.remote.data[0].stripList = ['fbclid'];
  f.mpl.amazon.queryParams = ['ref_'];
  f.mpl.amazon.hosts = ['www.amazon.com'];
  f.lgpl.youtube.queryParams = ['si'];
  const result = compare(source, f);
  assert.deepEqual(result.proposal, {global:[], site:[]});
  assert.match(report(result), /not deployed automatically/i);
});

test('rejects malformed Mozilla payloads instead of silently dropping rules', () => {
  const f = fixtures();
  f.remote.data = [];
  assert.throws(() => validateUpstream(f), /Remote Settings/);
  const g = fixtures();
  g.lgpl.youtube.queryParams = 'not an array';
  assert.throws(() => compare(source, g), /Invalid Mozilla/);
});
