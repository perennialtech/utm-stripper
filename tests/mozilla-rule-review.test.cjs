const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {
  sourceSnapshot, localRules, buildEntries, riskFor, analyze,
  proposedScript, markdownReport
} = require('../scripts/mozilla-rule-review.cjs');

// Fixture expectations must stay stable after generated review rules merge.
// The production script is separately tested end to end in script.test.cjs.
const local = fs.readFileSync(path.join(__dirname,'../utm-stripper.user.js'),'utf8')
  .replace(/const MOZILLA_REVIEWED_GLOBAL = \[[\s\S]*?\];/, 'const MOZILLA_REVIEWED_GLOBAL = [];')
  .replace(/const MOZILLA_REVIEWED_ALLOW_HOSTS = \[[\s\S]*?\];/, 'const MOZILLA_REVIEWED_ALLOW_HOSTS = [];')
  .replace(/const MOZILLA_REVIEWED_SITES = \[[\s\S]*?\];/, 'const MOZILLA_REVIEWED_SITES = [];');
function fixture() {
  return {
    remote: {data:[
      {id:'global',stripList:['fbclid','NEWclickid'],allowList:[]},
      {id:'exceptions',stripList:['AnotherClickid'],allowList:['allowed.example']}
    ]},
    mpl: {
      global:{isGlobal:true,queryParams:['utm_source','adgroupid','var']},
      twitter:{hosts:['x.com','www.twitter.com'],queryParams:['s','cxt','trackingId']},
      amazon:{hosts:['www.amazon.com','www.amazon.co.uk'],queryParams:['pd_rd_i','keywords','th']}
    },
    lgpl: {
      global:{isGlobal:true,queryParams:['at_campaign']},
      youtube:{hosts:['youtu.be','www.youtube.com'],queryParams:['si','feature','copy_tracking_id']},
      ebay:{hosts:[],schemelessSites:['ebay.com'],queryParams:['_trkparms']},
      newsite:{hosts:['new.example','other.example'],queryParams:['clicktracking','q']}
    }
  };
}
test('captures all source groups, unknown sites, schemeless scopes, global lists and exceptions', () => {
  const snap = sourceSnapshot(fixture());
  assert.equal(snap.groups.length, 7);
  assert.equal(snap.remote.length, 2);
  assert.deepEqual(snap.groups.find(x=>x.group==='ebay').schemelessSites,['ebay.com']);
  assert.deepEqual(snap.groups.find(x=>x.group==='newsite').hosts,['new.example','other.example']);
  const keys = buildEntries(snap).map(x=>x.source+'/'+x.group+'/'+x.param);
  assert.ok(keys.includes('mpl/global/adgroupid'));
  assert.ok(keys.includes('lgpl/newsite/clicktracking'));
  assert.ok(keys.includes('remote/exceptions/anotherclickid'));
});
test('keeps every uncovered rule in manifest while categorising independently of a fixed allowlist', () => {
  const snapshot = sourceSnapshot(fixture());
  const result = analyze(local,snapshot);
  assert.equal(result.entries.length, buildEntries(snapshot).length);
  const find = (source,group,param) => result.entries.find(x=>x.source===source && x.group===group && x.param===param);
  assert.equal(find('mpl','twitter','s').classification,'covered');
  assert.equal(find('mpl','amazon','th').classification,'high');
  assert.equal(find('lgpl','newsite','q').classification,'high');
  assert.equal(find('lgpl','newsite','clicktracking').classification,'low');
  assert.equal(find('lgpl','ebay','_trkparms').classification,'unsupported-scope');
  assert.equal(find('lgpl','global','at_campaign').classification,'review');
  assert.equal(find('remote','global','newclickid').classification,'low');
  assert.ok(result.entries.some(x=>x.hosts.includes('new.example')));
});
test('proposes low-risk navigation and exact-host site rules, never ambiguous or allowlisted keys', async () => {
  const result = analyze(local,sourceSnapshot(fixture()));
  assert.deepEqual(result.codeProposal.global,['anotherclickid','newclickid']);
  assert.deepEqual(result.codeProposal.allowHosts,['allowed.example']);
  assert.ok(result.codeProposal.site.some(x=>x.hosts.includes('www.amazon.com') &&
    x.params.includes('pd_rd_i')));
  assert.ok(result.codeProposal.site.some(x=>x.hosts.includes('new.example') &&
    x.params.includes('clicktracking')));
  assert.equal(result.entries.find(x=>x.source==='remote' && x.param==='anotherclickid').classification,'low');
  const modified=proposedScript(local,result);
  new vm.Script(modified);
  const rules=localRules(modified);
  assert.ok(rules.reviewedGlobal.includes('newclickid'));
  assert.ok(rules.reviewedGlobal.includes('anotherclickid'));
  assert.deepEqual(rules.reviewedAllowHosts,['allowed.example']);
  assert.ok(rules.reviewedSites.some(x=>x.params.includes('pd_rd_i')));
  assert.ok(!rules.reviewedSites.some(x=>x.params.includes('th') || x.params.includes('q')));
  const before=local.match(/^\/\/ @version\s+(\d+)\.(\d+)\.(\d+)/m);
  const after=modified.match(/^\/\/ @version\s+(\d+)\.(\d+)\.(\d+)/m);
  assert.equal(Number(after[3]),Number(before[3])+1);
  const calls=[];
  const page={URL,Request, document:{baseURI:'https://example.test/',addEventListener(){}},
    history:{state:null,replaceState(){},pushState(){}},
    location:{href:'https://example.test/?id=1'},navigator:{sendBeacon(){return true}},
    XMLHttpRequest:class {open(){}},fetch:async x=>{calls.push(x)}};
  page.window=page;
  vm.runInNewContext(modified,page);
  await page.fetch('https://example.test/?NEWclickid=123&th=1');
  await page.fetch('https://allowed.example/?anotherclickid=123&newclickid=123&th=1');
  await page.fetch('https://sub.allowed.example/?newclickid=123&q=still-here');
  await page.fetch('https://evilallowed.example/?newclickid=123&q=still-here');
  await page.fetch('https://www.amazon.com/?pd_rd_i=123&th=1&keywords=search');
  await page.fetch('https://other.example/?clicktracking=yes&q=still-there');
  assert.equal(calls[0],'https://example.test/?th=1');
  assert.equal(calls[1],'https://allowed.example/?anotherclickid=123&newclickid=123&th=1');
  assert.equal(calls[2],'https://sub.allowed.example/?newclickid=123&q=still-here');
  assert.equal(calls[3],'https://evilallowed.example/?q=still-here');
  assert.equal(calls[4],'https://www.amazon.com/?th=1&keywords=search');
  assert.equal(calls[5],'https://other.example/?q=still-there');
});
test('detects all additions, removals, site scope and remote exceptions changes', () => {
  const initial=sourceSnapshot(fixture());
  const newer=fixture();
  newer.remote.data[0].stripList.push('Brand_New');
  newer.remote.data[1].allowList=['changed.example'];
  newer.mpl.global.queryParams=['utm_source','var'];
  newer.mpl.amazon.hosts.push('www.amazon.com.au');
  const delta=analyze(local,sourceSnapshot(newer),initial).changes;
  assert.equal(delta.initial,false);
  assert.ok(delta.added.includes('remote/global/brand_new'));
  assert.ok(delta.removed.includes('mpl/global/adgroupid'));
  assert.ok(delta.changedScope.includes('mpl/amazon/pd_rd_i'));
  assert.ok(delta.changedScope.includes('remote/exceptions/anotherclickid'));
  assert.equal(delta.allowsChanged,true);
});
test('same upstream data is deterministic and results in no proposed update once baseline accepted', () => {
  const x=fixture(),y=fixture();
  y.mpl.amazon.queryParams.reverse();
  y.mpl.amazon.hosts.reverse();
  y.remote.data.reverse();
  assert.deepEqual(sourceSnapshot(x), sourceSnapshot(y));
  const initial=sourceSnapshot(x);
  const result=analyze(local,initial,initial);
  assert.deepEqual(result.changes.added,[]);
  assert.deepEqual(result.changes.removed,[]);
  assert.deepEqual(result.changes.changedScope,[]);
  assert.equal(result.changes.allowsChanged,false);
});
test('report explains risk, full manifest, PR review and first baseline', () => {
  const snapshot=sourceSnapshot(fixture());
  const result=analyze(local,snapshot);
  const report=markdownReport(snapshot,result);
  assert.match(report,/human review/i);
  assert.match(report,/mozilla-rule-candidates\.json/);
  assert.match(report,/Initial baseline/);
  assert.match(report,/Unsupported scope/);
});
test('malformed or empty remote and Mozilla lists fail visibly', () => {
  const a=fixture();a.remote.data=[];
  assert.throws(()=>sourceSnapshot(a),/Invalid\/empty/);
  const b=fixture();b.lgpl.newsite.queryParams='q';
  assert.throws(()=>sourceSnapshot(b),/Malformed Mozilla group/);
  const c=fixture();c.mpl.twitter.hosts=[null];
  assert.throws(()=>sourceSnapshot(c),/Invalid Mozilla/);
});
test('future remote rule with ambiguous name is never proposed executable', () => {
  const f=fixture();
  f.remote.data[0].stripList.push('t');
  const result=analyze(local,sourceSnapshot(f));
  assert.equal(result.entries.find(x=>x.source==='remote' && x.param==='t').classification,'high');
  assert.equal(result.codeProposal.global.includes('t'),false);
});
