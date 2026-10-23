#!/usr/bin/env node
'use strict';
// Source-derived audit only. Automated discovery never changes executable rules.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const SOURCES = Object.freeze({
  remote: 'https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/query-stripping/records',
  mpl: 'https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/antitracking/StripOnShareLists/MPL2/StripOnShare.json',
  lgpl: 'https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/antitracking/StripOnShareLists/LGPL/StripOnShareLGPL.json'
});
const USERSCRIPT = path.resolve(__dirname, '..', 'utm-stripper.user.js');
const lower = v => v.toLowerCase();
const sorted = values => [...values].sort((a, b) => a.localeCompare(b, 'en'));
const unique = values => sorted(new Set([...values].map(lower)));
const outputJSON = value => JSON.stringify(value, null, 2) + '\n';

function names(values, label) {
  if (!Array.isArray(values) || values.some(v => typeof v !== 'string' || !v || v.length > 200))
    throw new Error('Invalid Mozilla rule field: ' + label);
  return unique(values);
}
function sourceSnapshot(input) {
  if (!input || !input.remote || !input.mpl || !input.lgpl ||
      !Array.isArray(input.remote.data) || !input.remote.data.length) {
    throw new Error('Invalid/empty Mozilla upstream payload');
  }
  const remoteRecords = input.remote.data.map((item, i) => {
    if (!item || typeof item.id !== 'string') throw new Error('Remote record without id');
    return {
      id: item.id,
      stripList: names(item.stripList, 'remote stripList ' + i),
      allowList: names(item.allowList, 'remote allowList ' + i)
    };
  }).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const groups = [];
  for (const source of ['mpl', 'lgpl']) {
    const list = input[source];
    if (!list || typeof list !== 'object' || !list.global)
      throw new Error('Invalid ' + source + ' groups');
    for (const [group, entry] of Object.entries(list)) {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.queryParams))
        throw new Error('Malformed Mozilla group ' + source + '/' + group);
      // Explicitly store schemelessSites and the *full* hostname list, not just
      // hosts we currently handle. No wildcard expansion is performed here.
      groups.push({
        source, group,
        scope: group === 'global' ? 'global' : 'site',
        hosts: names(entry.hosts || [], source + '/' + group + ' hosts'),
        schemelessSites: names(entry.schemelessSites || [], source + '/' + group + ' schemelessSites'),
        params: names(entry.queryParams, source + '/' + group + ' params')
      });
    }
  }
  groups.sort((a, b) => (a.source + '/' + a.group).localeCompare(b.source + '/' + b.group, 'en'));
  return {schemaVersion: 1, sources: SOURCES, remote: remoteRecords, groups};
}
async function fetchUpstream(fetcher = fetch) {
  const pairs = await Promise.all(Object.entries(SOURCES).map(async ([key, url]) => {
    const response = await fetcher(url, {headers: {Accept:'application/json'}, signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(key + ': HTTP ' + response.status);
    const body = await response.text();
    if (body.length > 3_000_000) throw new Error(key + ': oversized upstream response');
    return [key, JSON.parse(body)];
  }));
  return Object.fromEntries(pairs);
}
function extract(source, regex, label) {
  const match = source.match(regex);
  if (!match) throw new Error('Cannot extract local ' + label);
  const value = vm.runInNewContext('(' + match[1] + ')', {}, {timeout: 1000});
  if (!Array.isArray(value)) throw new Error('Invalid local array for ' + label);
  return JSON.parse(JSON.stringify(value));
}
function localRules(source) {
  return {
    global: extract(source, /const GLOBAL_TRACKING_PARAMS = new Set\((\[[\s\S]*?\])\);/, 'global rules'),
    sites: extract(source, /const SITE_RULES = (\[[\s\S]*?\]);/, 'site rules'),
    reviewedGlobal: extract(source, /const MOZILLA_REVIEWED_GLOBAL = (\[[\s\S]*?\]);/, 'reviewed global'),
    reviewedAllowHosts: extract(source, /const MOZILLA_REVIEWED_ALLOW_HOSTS = (\[[\s\S]*?\]);/, 'reviewed allowlist'),
    reviewedSites: extract(source, /const MOZILLA_REVIEWED_SITES = (\[[\s\S]*?\]);/, 'reviewed sites')
  };
}
const CONTEXT_SENSITIVE = new Set([
  'q', 's', 't', 'is', 'kw', 'feature', 'ref', 'tag', 'source',
  'redirect', 'url', 'id', 'hash', 'token', 'email_token', 'email_source',
  'code', 'state', 'session', 'signature', 'sig', 'auth', 'nonce',
  'redirect_uri', 'callback', 'key', 'access_token', 'id_token',
  'pp', 'th', 'psc', 'sr', 'keywords', 'linkcode', '_encoding',
  'initialissue', 'ipredirectfrom', 'ipredirectoriginalurl',
  'overridebasecountry', 'eventorigin', 'recsource', 'recid', 'searchid',
  'qid', 'visit_id', 'site', 'form', 'sort', 'page', 'biw', 'bih',
  'ref_', 'refsrc', 'ref_url', 'ref_source', 'ref_campaign',
  'linkid', 'link_id', 'share_id', 'correlation_id'
]);
// High-confidence *heuristic*, not a claim of guaranteed compatibility.
// It does not depend on any fixed list of 14 or any pre-existing destination.
// Short or uncertain names go to 'review', never disappear from the PR.
function riskFor(name, scope, source) {
  if (CONTEXT_SENSITIVE.has(name) || name.length <= 2)
    return {tier:'high', reason:'Short or potentially functional key; may change navigation, content or account flows'};
  if (source === 'remote' &&
      (/^utm_/i.test(name) || /(clid|clickid|tracking_id)$/i.test(name)))
    return {tier:'low', reason:'Distinct tracking/click identifier in Firefox navigation-stripping rules'};
  if (name === 'tracking' || name === 'clid')
    return {tier:'review', reason:'Tracking-like, but generic enough to affect site application behaviour'};
  if (scope === 'site' &&
      (/^(?:pd_rd_|pf_rd_)[a-z0-9_]+$/i.test(name) ||
       /^hv(?:adid|bmt|dev|locphy|netw|rand|targid)$/i.test(name) ||
       /^hydadcr$/i.test(name) ||
       /(?:^|[_-])(?:tracking|clickid|clicktracking)(?:[_-]|$)/i.test(name) ||
       /(?:clid|trackingid|clickid)$/i.test(name)))
    return {tier:'low', reason:'Distinct click/tracking identifier with an explicit Mozilla host scope; still requires manual compatibility review'};
  if (/^utm_/i.test(name) || /(?:^|_)(?:trk|track|tracking|campaign|cid|clid)(?:_|$)/i.test(name) ||
      /(?:clickid|trackingid)$/i.test(name) || /^pd_rd_|^pf_rd_|^hvadid$|^hvrand$|^hvtargid$/i.test(name))
    return {tier:'review', reason:'Tracking-shaped name, but Strip-on-Share context differs from automatic request interception'};
  return {tier:'review', reason:'Mozilla stripping rule; needs site/API compatibility review'};
}
function buildEntries(snapshot) {
  const records = [];
  for (const remote of snapshot.remote) {
    for (const param of remote.stripList) {
      records.push({source:'remote', group:remote.id, scope:'navigation', param, hosts:[],
        schemelessSites:[], allowHosts:remote.allowList});
    }
    // Preserve allowList-only records via snapshot even without matching stripList.
  }
  for (const group of snapshot.groups) {
    for (const param of group.params) {
      records.push({source:group.source, group:group.group, scope:group.scope, param,
        hosts:group.hosts, schemelessSites:group.schemelessSites, allowHosts:[]});
    }
  }
  records.sort((a,b)=>[a.source,a.group,a.param].join('/').localeCompare([b.source,b.group,b.param].join('/'), 'en'));
  return records;
}
function analyze(script, snapshot, previousSnapshot = null) {
  const local = localRules(script);
  const coveredGlobal = new Set([...local.global, ...local.reviewedGlobal].map(lower));
  const byHost = new Map();
  for (const {hosts, params} of [...local.sites, ...local.reviewedSites]) {
    for (const host of hosts) {
      const normalized = lower(host);
      if (!byHost.has(normalized)) byHost.set(normalized, new Set());
      for (const param of params) byHost.get(normalized).add(lower(param));
    }
  }
  const entries = buildEntries(snapshot).map(entry => {
    const alreadyGlobal = entry.param.startsWith('utm_') || coveredGlobal.has(entry.param);
    const supportedHosts = entry.hosts.filter(host => byHost.get(host)?.has(entry.param));
    const fullyCovered = alreadyGlobal ||
      (entry.scope === 'site' && entry.hosts.length > 0 && supportedHosts.length === entry.hosts.length);
    const risk = riskFor(entry.param, entry.scope, entry.source);
    const unsupportedScope = entry.scope === 'site' && (!entry.hosts.length || entry.schemelessSites.length > 0);
    const active = fullyCovered ? 'covered' : (unsupportedScope ? 'unsupported-scope' : risk.tier);
    return {...entry, classification:active, rationale: fullyCovered ? 'Already stripped in userscript' :
      unsupportedScope ? 'Has schemeless/domain-suffix scope or no exact hosts; needs scope modelling' : risk.reason,
      currentlyCoveredHosts:supportedHosts};
  });

  const previous = previousSnapshot ? buildEntries(previousSnapshot) : [];
  const keyOf = e => e.source + '/' + e.group + '/' + e.param;
  const oldEntries = new Map(previous.map(e=>[keyOf(e), e]));
  const newEntries = new Map(entries.map(e=>[keyOf(e), e]));
  const added = entries.filter(e=>!oldEntries.has(keyOf(e))).map(keyOf);
  const removed = previous.filter(e=>!newEntries.has(keyOf(e))).map(keyOf);
  const changedScope = entries.filter(e=>oldEntries.has(keyOf(e)) &&
    JSON.stringify({hosts:e.hosts,schemelessSites:e.schemelessSites,allowHosts:e.allowHosts}) !==
    JSON.stringify({hosts:oldEntries.get(keyOf(e)).hosts,schemelessSites:oldEntries.get(keyOf(e)).schemelessSites,allowHosts:oldEntries.get(keyOf(e)).allowHosts})).map(keyOf);
  const previousAllows = previousSnapshot ? JSON.stringify(previousSnapshot.remote.map(r=>[r.id,r.allowList])) : '';
  const currentAllows = JSON.stringify(snapshot.remote.map(r=>[r.id,r.allowList]));
  const allowsChanged = !!previousSnapshot && previousAllows !== currentAllows;
  const readyGlobal = entries.filter(e=>e.source==='remote' && e.classification==='low').map(e=>e.param);
  // Mozilla allows exemptions in separate records with empty stripList.
  // Treat the entire Remote Settings allowlist as applicable to reviewed
  // navigation rules, even if its hosts are not on the same record.
  const remoteAllowHosts = unique(snapshot.remote.flatMap(record=>record.allowList));
  // Low-risk, explicitly host-scoped site rules can be proposed for human
  // review. Other entries are recorded in full, but left inert.
  const hostCandidates = new Map();
  for (const entry of entries.filter(e=>e.scope==='site' && e.classification==='low')) {
    for (const host of entry.hosts) {
      if (entry.currentlyCoveredHosts.includes(host) ||
          !/^(?=.{1,253}$)[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(host)) continue;
      if (!hostCandidates.has(host)) hostCandidates.set(host,new Set());
      hostCandidates.get(host).add(entry.param);
    }
  }
  const groupByParams = new Map();
  for (const host of sorted(hostCandidates.keys())) {
    const params = unique(hostCandidates.get(host));
    const signature = JSON.stringify(params);
    if (!groupByParams.has(signature)) groupByParams.set(signature, {hosts:[],params});
    groupByParams.get(signature).hosts.push(host);
  }
  const readySites = [...groupByParams.values()].sort((a,b)=>a.hosts[0].localeCompare(b.hosts[0],'en'));
  // Advisory metadata only. Never promote these suggestions into the userscript.
  const reviewCandidates = {global:unique(readyGlobal), site:readySites, allowHosts:remoteAllowHosts};
  const scopePairs = reviewCandidates.site.reduce((count, group) =>
    count + group.hosts.length * group.params.length, 0);
  const distinctHosts = new Set(reviewCandidates.site.flatMap(group => group.hosts)).size;
  // Explicitly approved local rules must be audited against current upstream
  // sources on EVERY run; source removals and scope shrinkage are not additive.
  const upstreamGlobal = new Set(entries.filter(entry => entry.scope === 'global' ||
    entry.scope === 'navigation').map(entry => entry.param));
  const upstreamSites = new Map();
  for (const entry of entries.filter(entry => entry.scope === 'site')) {
    for (const host of entry.hosts) {
      if (!upstreamSites.has(host)) upstreamSites.set(host, new Set());
      upstreamSites.get(host).add(entry.param);
    }
  }
  const obsoleteReviewed = [];
  for (const param of unique(local.reviewedGlobal)) {
    if (!upstreamGlobal.has(param))
      obsoleteReviewed.push({scope:'global', param, reason:'No longer present in global or navigation upstream rules'});
  }
  for (const {hosts,params} of local.reviewedSites) {
    for (const host of hosts) {
      for (const param of params) {
        if (!upstreamSites.get(lower(host))?.has(lower(param)))
          obsoleteReviewed.push({scope:'site', host:lower(host), param:lower(param),
            reason:'Exact hostname/parameter pair is absent from current upstream site rules'});
      }
    }
  }
  obsoleteReviewed.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
  const candidateScope = {groups:reviewCandidates.site.length, hosts:distinctHosts, hostParameterPairs:scopePairs};
  const classificationCounts = {};
  for (const entry of entries) classificationCounts[entry.classification] = (classificationCounts[entry.classification]||0)+1;
  const changes = {initial: !previousSnapshot, added, removed, changedScope, allowsChanged};
  const fingerprint = crypto.createHash('sha256').update(outputJSON(snapshot)).digest('hex').slice(0,12);
  return {schemaVersion:2, fingerprint, classificationCounts, changes,
    reviewCandidates, candidateScope, obsoleteReviewed, entries};
}
function markdownReport(snapshot, result) {
  const {changes,classificationCounts,entries,fingerprint,reviewCandidates,candidateScope,obsoleteReviewed} = result;
  const total = entries.length;
  const count = category => classificationCounts[category] || 0;
  const lines = [
    '# Review Mozilla tracking rules', '',
    '**Draft PR for human review; no automatic merge.** This is an inventory-only proposal. No userscript rules are changed or activated by the automation.', '',
    'Snapshot fingerprint: '+fingerprint+'. Sources are compared semantically, with stable sorting and no run timestamps.', '',
    '## Coverage and risk', '',
    '| Classification | Source parameter entries | Treatment |','| --- | ---: | --- |',
    '| Already covered | '+count('covered')+' | Existing stripping behaviour |',
    '| Low risk (heuristic) | '+count('low')+' | Advisory candidates only; requires separate compatibility-tested implementation |',
    '| Needs review | '+count('review')+' | Explicitly represented in manifest; not enabled |',
    '| High risk | '+count('high')+' | Potentially functional, represented but not enabled |',
    '| Unsupported scope | '+count('unsupported-scope')+' | Source scope retained verbatim; not enabled |',
    '', 'Total: **'+total+'** source parameter entries. Includes repeated names across independent Mozilla sources/groups.', '',
    '## Source links', ''
  ];
  for (const [key,url] of Object.entries(SOURCES)) lines.push('- '+key+': '+url);
  lines.push('', '## Changes since accepted baseline', '');
  if (changes.initial) lines.push('Initial baseline: inventories all currently published rules.');
  else lines.push('- Added: **'+changes.added.length+'** entries; removed: **'+changes.removed.length+
    '**; changed host/exception scope: **'+changes.changedScope.length+'**; changed allowlist configuration: **'+(changes.allowsChanged?'yes':'no')+'**');
  for (const key of ['added','removed','changedScope']) {
    if (changes[key].length) lines.push('', '### '+key, '', ...changes[key].map(x=>'- '+String.fromCharCode(96)+x+String.fromCharCode(96)));
  }
  lines.push('', '## Advisory candidates (not enabled)', '',
    'Potential global navigation keys: '+
      (reviewCandidates.global.length ? reviewCandidates.global.join(', ') : '_None_')+'.', '',
    'Potential host-scoped groups: **'+candidateScope.groups+'** spanning **'+candidateScope.hosts+
      '** distinct exact hosts and **'+candidateScope.hostParameterPairs+'** host/parameter pairs. These are suggestions, **not changes to live stripping**.', '',
    'All remaining Strip-on-Share entries are recorded in the manifest, including every unsupported hostname and high-risk parameter.', '',
    '## Approved-rule drift requiring manual review', '',
    obsoleteReviewed.length ? '**'+obsoleteReviewed.length+'** previously reviewed global/site rules are absent from current upstream scope:' :
      'None detected for explicitly reviewed rules.',
    '', ...obsoleteReviewed.map(entry => '- `'+(entry.scope === 'site' ? entry.host+'/' : '')+entry.param+
      '` ('+entry.scope+'): '+entry.reason),
    '',
    '## Full review manifest', '',
    'In the PR Files changed tab, see docs/mozilla-rule-candidates.json for **every** rule, its source/group reference, coverage, risk tier and rationale. The companion docs/mozilla-source-snapshot.json preserves the complete hostname/schemeless-site scope, source rule group and exceptions without repeating huge host lists per parameter.', '',
    'Rules with benign-sounding names can still be functional, especially in API requests. Strip-on-Share is not proof of safety for automatic fetch/XHR/beacon/history interception; tier labels are only heuristics.', '',
    '## Checklist', '',
    '- [ ] Review upstream additions, removals, allowlists and site scope, including obsoleteReviewed entries.',
    '- [ ] Promote rules only in separate code changes with positive/negative tests and the appropriate link-only versus request scope.',
    '- [ ] Add positive/negative browser tests for promoted rules.',
    '- [ ] Review LGPL/MPL terms and retain source attribution.',
    '- [ ] Merge only after human approval.', ''
  );
  return lines.join('\n');
}
function cliArg(args, name) {
  const at = args.indexOf(name);
  if (at < 0) return null;
  if (!args[at+1]) throw new Error(name+' requires a path');
  return args[at+1];
}
async function run(args = process.argv.slice(2)) {
  const fixture = cliArg(args, '--fixture-dir');
  const output = cliArg(args, '--output-dir') || '.mozilla-review';
  const baseline = cliArg(args, '--baseline') || 'docs/mozilla-source-snapshot.json';
  const snapshotPath = cliArg(args, '--snapshot-file');
  if (snapshotPath && fixture) throw new Error('--snapshot-file and --fixture-dir are mutually exclusive');
  const upstream = fixture ? {
    remote: JSON.parse(fs.readFileSync(path.join(fixture,'remote.json'),'utf8')),
    mpl: JSON.parse(fs.readFileSync(path.join(fixture,'MPL2.json'),'utf8')),
    lgpl: JSON.parse(fs.readFileSync(path.join(fixture,'LGPL.json'),'utf8'))
  } : snapshotPath ? null : await fetchUpstream();
  const snapshot = snapshotPath ? JSON.parse(fs.readFileSync(snapshotPath,'utf8')) : sourceSnapshot(upstream);
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.remote) || !Array.isArray(snapshot.groups))
    throw new Error('Invalid source snapshot');
  const previous = fs.existsSync(baseline) ? JSON.parse(fs.readFileSync(baseline,'utf8')) : null;
  const script = fs.readFileSync(USERSCRIPT,'utf8');
  const result = analyze(script,snapshot,previous);
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'mozilla-source-snapshot.json'),outputJSON(snapshot));
  const compactReview = {...result,entries:result.entries.map(e=>({
    source:e.source,group:e.group,scope:e.scope,param:e.param,
    classification:e.classification,rationale:e.rationale,
    currentlyCoveredHosts:e.currentlyCoveredHosts
  }))};
  fs.writeFileSync(path.join(output,'mozilla-rule-candidates.json'),outputJSON(compactReview));
  fs.writeFileSync(path.join(output,'mozilla-rule-report.md'),markdownReport(snapshot,result));
  console.log(JSON.stringify({fingerprint:result.fingerprint, classificationCounts:result.classificationCounts, changes:result.changes, runtimeChanged:false}).slice(0,1000));
}
if (require.main===module) run().catch(error=>{console.error(error);process.exitCode=1});
module.exports={SOURCES,sourceSnapshot,fetchUpstream,localRules,riskFor,buildEntries,analyze,markdownReport,run};
