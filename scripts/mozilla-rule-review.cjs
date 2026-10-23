#!/usr/bin/env node
'use strict';
// Source-derived review proposals. No Mozilla rule is deployed without a merge.
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
  const codeProposal = {global:unique(readyGlobal), site:readySites, allowHosts:remoteAllowHosts};
  const classificationCounts = {};
  for (const entry of entries) classificationCounts[entry.classification] = (classificationCounts[entry.classification]||0)+1;
  const changes = {initial: !previousSnapshot, added, removed, changedScope, allowsChanged};
  const fingerprint = crypto.createHash('sha256').update(outputJSON(snapshot)).digest('hex').slice(0,12);
  return {schemaVersion:1, fingerprint, classificationCounts, changes,
    codeProposal, entries};
}
function replaceMarked(source, startName, endName, name, values) {
  const begin = '  // '+startName, end = '  // '+endName;
  const a = source.indexOf(begin), b = source.indexOf(end);
  if (a < 0 || b <= a || source.indexOf(begin, a+1) >= 0) throw new Error('Malformed markers: '+startName);
  const json = JSON.stringify(values, null, 2).replaceAll('\n','\n  ');
  return source.slice(0,a+begin.length) + '\n  const '+name+' = '+json+';\n' + source.slice(b);
}
function proposedScript(script, result) {
  const current = localRules(script);
  const merged = unique([...current.reviewedGlobal,...result.codeProposal.global]);
  const newAllowHosts = merged.length ? result.codeProposal.allowHosts : [];
  if (!result.codeProposal.global.length && !result.codeProposal.site.length &&
      JSON.stringify(current.reviewedAllowHosts) === JSON.stringify(newAllowHosts)) return script;
  const sitesByHost = new Map();
  for (const entry of [...current.reviewedSites, ...result.codeProposal.site]) {
    for (const host of entry.hosts) {
      if (!sitesByHost.has(host)) sitesByHost.set(host, new Set());
      for (const param of entry.params) sitesByHost.get(host).add(param);
    }
  }
  const grouped = new Map();
  for (const host of sorted(sitesByHost.keys())) {
    const params = unique(sitesByHost.get(host)), signature = JSON.stringify(params);
    if (!grouped.has(signature)) grouped.set(signature, {hosts:[],params});
    grouped.get(signature).hosts.push(host);
  }
  const mergedSites = [...grouped.values()].sort((a,b)=>a.hosts[0].localeCompare(b.hosts[0], 'en'));
  let output = replaceMarked(script,'MOZILLA_SYNC_GLOBAL_START','MOZILLA_SYNC_GLOBAL_END','MOZILLA_REVIEWED_GLOBAL',merged);
  output = replaceMarked(output,'MOZILLA_SYNC_EXCEPTIONS_START','MOZILLA_SYNC_EXCEPTIONS_END','MOZILLA_REVIEWED_ALLOW_HOSTS',newAllowHosts);
  output = replaceMarked(output,'MOZILLA_SYNC_SITE_START','MOZILLA_SYNC_SITE_END','MOZILLA_REVIEWED_SITES',mergedSites);
  if (output === script) return script;
  const m = output.match(/^\/\/ @version\s+(\d+)\.(\d+)\.(\d+)\s*$/m);
  if (!m) throw new Error('Cannot bump userscript version');
  return output.replace(m[0], '// @version      '+m[1]+'.'+m[2]+'.'+(Number(m[3])+1));
}
function markdownReport(snapshot, result) {
  const {changes,classificationCounts,entries,fingerprint,codeProposal} = result;
  const total = entries.length;
  const count = category => classificationCounts[category] || 0;
  const lines = [
    '# Review Mozilla tracking rules', '',
    '**Draft PR for human review; no automatic merge.** This proposal inventories every Mozilla source rule, including ones not safe to deploy as a page-level request interceptor.', '',
    'Snapshot fingerprint: '+fingerprint+'. Sources are compared semantically, with stable sorting and no run timestamps.', '',
    '## Coverage and risk', '',
    '| Classification | Source parameter entries | Treatment |','| --- | ---: | --- |',
    '| Already covered | '+count('covered')+' | Existing stripping behaviour |',
    '| Low risk (heuristic) | '+count('low')+' | Proposed for review when navigation exceptions and exact host scope permit |',
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
  lines.push('', '## Proposed executable rules', '',
    'Global navigation keys (only when both name and upstream exception scope satisfy strict criteria): '+
      (codeProposal.global.length ? codeProposal.global.join(', ') : '_None_')+'.', '',
    'Host-scoped proposed key groups: '+codeProposal.site.length+'. The draft PR includes them as executable code changes **only after a human merges it**.', '',
    'All remaining Strip-on-Share entries are still recorded in the manifest, including every unsupported hostname and high-risk parameter.', '',
    '## Full review manifest', '',
    'In the PR Files changed tab, see docs/mozilla-rule-candidates.json for **every** rule, its source/group reference, coverage, risk tier and rationale. The companion docs/mozilla-source-snapshot.json preserves the complete hostname/schemeless-site scope, source rule group and exceptions without repeating huge host lists per parameter.', '',
    'Rules with benign-sounding names can still be functional, especially in API requests; tier labels are heuristics, not evidence of real-world safety.', '',
    '## Checklist', '',
    '- [ ] Review upstream additions, removals, allowlists and site scope.',
    '- [ ] Promote only tested rules; consider turning off fetch/XHR rewriting for Strip-on-Share-specific keys.',
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
  const upstream = fixture ? {
    remote: JSON.parse(fs.readFileSync(path.join(fixture,'remote.json'),'utf8')),
    mpl: JSON.parse(fs.readFileSync(path.join(fixture,'MPL2.json'),'utf8')),
    lgpl: JSON.parse(fs.readFileSync(path.join(fixture,'LGPL.json'),'utf8'))
  } : await fetchUpstream();
  const snapshot = sourceSnapshot(upstream);
  const previous = fs.existsSync(baseline) ? JSON.parse(fs.readFileSync(baseline,'utf8')) : null;
  const script = fs.readFileSync(USERSCRIPT,'utf8');
  const result = analyze(script,snapshot,previous);
  const proposed = proposedScript(script,result);
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'mozilla-source-snapshot.json'),outputJSON(snapshot));
  const compactReview = {...result,entries:result.entries.map(e=>({
    source:e.source,group:e.group,scope:e.scope,param:e.param,
    classification:e.classification,rationale:e.rationale,
    currentlyCoveredHosts:e.currentlyCoveredHosts
  }))};
  fs.writeFileSync(path.join(output,'mozilla-rule-candidates.json'),outputJSON(compactReview));
  fs.writeFileSync(path.join(output,'mozilla-rule-report.md'),markdownReport(snapshot,result));
  fs.writeFileSync(path.join(output,'utm-stripper.user.js'),proposed);
  console.log(JSON.stringify({fingerprint:result.fingerprint, classificationCounts:result.classificationCounts, changes:result.changes, runtimeChanged:proposed!==script}).slice(0,1000));
}
if (require.main===module) run().catch(error=>{console.error(error);process.exitCode=1});
module.exports={SOURCES,sourceSnapshot,fetchUpstream,localRules,riskFor,buildEntries,analyze,proposedScript,markdownReport,run};
