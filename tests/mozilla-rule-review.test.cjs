const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const {
  sourceSnapshot, localRules, buildEntries, riskFor, analyze, markdownReport
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
test('records candidates for human review without emitting executable rules', () => {
  const result = analyze(local,sourceSnapshot(fixture()));
  assert.deepEqual(result.reviewCandidates.global,['anotherclickid','newclickid']);
  assert.deepEqual(result.reviewCandidates.allowHosts,['allowed.example']);
  assert.ok(result.reviewCandidates.site.some(x=>x.hosts.includes('www.amazon.com') &&
    x.params.includes('pd_rd_i')));
  assert.ok(result.reviewCandidates.site.some(x=>x.hosts.includes('new.example') &&
    x.params.includes('clicktracking')));
  assert.equal(result.entries.find(x=>x.source==='remote' && x.param==='anotherclickid').classification,'low');
  assert.ok(result.candidateScope.hosts >= 4);
  assert.ok(result.candidateScope.hostParameterPairs >= result.candidateScope.hosts);
  assert.deepEqual(localRules(local).reviewedSites,[]);
  assert.deepEqual(localRules(local).reviewedGlobal,[]);
});

test('fixture CLI only emits documentation and never writes JavaScript', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'utm-mozilla-review-'));
  t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const fixtures = path.join(tmp,'fixtures');
  const output = path.join(tmp,'output');
  fs.mkdirSync(fixtures);
  const f = fixture();
  for (const [name,value] of [['remote.json',f.remote],['MPL2.json',f.mpl],['LGPL.json',f.lgpl]])
    fs.writeFileSync(path.join(fixtures,name),JSON.stringify(value));
  const scriptPath = path.join(__dirname,'../utm-stripper.user.js');
  const before = fs.readFileSync(scriptPath);
  const cli = spawnSync(process.execPath,[
    path.join(__dirname,'../scripts/mozilla-rule-review.cjs'),
    '--fixture-dir',fixtures,'--output-dir',output,'--baseline',path.join(tmp,'missing.json')
  ],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  assert.deepEqual(fs.readdirSync(output).sort(),[
    'mozilla-rule-candidates.json','mozilla-rule-report.md','mozilla-source-snapshot.json']);
  assert.deepEqual(fs.readFileSync(scriptPath),before);
  const m = JSON.parse(fs.readFileSync(path.join(output,'mozilla-rule-candidates.json'),'utf8'));
  assert.ok(m.reviewCandidates.site.length > 0);
  assert.match(fs.readFileSync(path.join(output,'mozilla-rule-report.md'),'utf8'),/inventory-only/i);
});

test('upstream removals or host-scope shrinkage flag explicitly reviewed rules for reconciliation', () => {
  const withReview = local
    .replace('const MOZILLA_REVIEWED_GLOBAL = [];', "const MOZILLA_REVIEWED_GLOBAL = ['newclickid', 'retired_clickid'];")
    .replace('const MOZILLA_REVIEWED_SITES = [];', "const MOZILLA_REVIEWED_SITES = [{hosts:['www.amazon.com','www.amazon.co.uk','obsolete.example'], params:['pd_rd_i']}];");
  const first = analyze(withReview, sourceSnapshot(fixture()));
  assert.deepEqual(first.obsoleteReviewed.map(x=>x.scope+':'+(x.host||'')+':'+x.param),[
    'global::retired_clickid','site:obsolete.example:pd_rd_i'
  ]);
  const newer=fixture();
  newer.mpl.amazon.hosts=['www.amazon.com'];
  newer.remote.data[0].stripList=['fbclid'];
  const next=analyze(withReview,sourceSnapshot(newer),sourceSnapshot(fixture()));
  assert.ok(next.obsoleteReviewed.some(x=>x.scope==='global'&&x.param==='newclickid'));
  assert.ok(next.obsoleteReviewed.some(x=>x.host==='www.amazon.co.uk'&&x.param==='pd_rd_i'));
  assert.ok(next.changes.changedScope.includes('mpl/amazon/pd_rd_i'));
  assert.ok(next.changes.removed.includes('remote/global/newclickid'));
  assert.match(markdownReport(sourceSnapshot(newer),next),/retired_clickid/);
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
  assert.equal(result.reviewCandidates.global.includes('t'),false);
});
