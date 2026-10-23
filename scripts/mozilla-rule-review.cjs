#!/usr/bin/env node
'use strict';
// Compare Firefox's current rules against the standalone userscript.
// Never commit to main automatically. Only propose reviewable changes in a PR.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const SOURCES = {
  remote: 'https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/query-stripping/records',
  mpl: 'https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/antitracking/StripOnShareLists/MPL2/StripOnShare.json',
  lgpl: 'https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/antitracking/StripOnShareLists/LGPL/StripOnShareLGPL.json'
};
const lower = value => value.toLowerCase();
const sorted = values => [...values].sort((a, b) => a.localeCompare(b, 'en'));
const scriptPath = path.join(__dirname, '..', 'utm-stripper.user.js');

function extract(source, expression, label) {
  const match = source.match(expression);
  if (!match) throw new Error('Cannot parse local '+label);
  const result = vm.runInNewContext('('+match[1]+')', {}, {timeout: 1000});
  if (!Array.isArray(result)) throw new Error('Expected a local array for '+label);
  return result;
}

function readRuleGroups(source) {
  return {
    global: extract(source, /const GLOBAL_TRACKING_PARAMS = new Set\((\[[\s\S]*?\])\);/, 'global rules'),
    site: extract(source, /const SITE_RULES = (\[[\s\S]*?\]);/, 'site rules'),
    reviewedGlobal: extract(source, /const MOZILLA_REVIEWED_GLOBAL = (\[[\s\S]*?\]);/, 'reviewed global rules'),
    reviewedSite: extract(source, /const MOZILLA_REVIEWED_SITES = (\[[\s\S]*?\]);/, 'reviewed site rules')
  };
}

function validateNames(values, label) {
  if (!Array.isArray(values) ||
      !values.every(s => typeof s === 'string' && s.length > 0 && s.length <= 150)) {
    throw new Error('Invalid Mozilla '+label);
  }
  return values;
}
function validateUpstream(upstream) {
  if (!Array.isArray(upstream.remote.data) || !upstream.remote.data.length) {
    throw new Error('Empty or invalid Remote Settings records');
  }
  for (const record of upstream.remote.data) {
    validateNames(record.stripList, 'stripList');
    validateNames(record.allowList, 'allowList');
  }
  for (const label of ['mpl', 'lgpl']) {
    const list = upstream[label];
    if (!list || typeof list !== 'object' || !list.global) throw new Error('Invalid '+label+' rules');
    for (const [name, rule] of Object.entries(list)) {
      validateNames(rule.queryParams, label+' '+name);
      if (name !== 'global') validateNames(rule.hosts || [], label+' '+name+' hosts');
    }
  }
}

async function fetchUpstream(fetcher = fetch) {
  const entries = await Promise.all(Object.entries(SOURCES).map(async ([key, url]) => {
    const response = await fetcher(url, {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error('Cannot fetch '+key+': HTTP '+response.status);
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error('Upstream response too large: '+key);
    return [key, JSON.parse(body)];
  }));
  return Object.fromEntries(entries);
}

// High-risk keys stay manual triage, even when Mozilla can strip them
// in contexts unlike our userscript's fetch/XHR interception.
const REVIEW_ONLY = new Set([
  'ref', 'th', 'psc', 'sr', 'keywords', 'q', 't', 'pp', 'feature',
  'is', 'kw', 'tag', 'redirect', 'source', 'searchid', 'hash', 'qid',
  'linkcode', '_encoding', 'initialissue', 'ipredirectfrom',
  'ipredirectoriginalurl', 'overidebasecountry', 'overridebasecountry',
  'eventorigin', 'recsource', 'recid',
  'email_token', 'id'
]);

// Even on a matched site, source lists can contain parameters with functional
// consequences. Suggest only recognizable tracking IDs; put the rest in the
// manual-triage report. Extend this list only after review and tests.
const SCOPED_CANDIDATES = new Set([
  'pd_rd_i', 'pf_rd_i', 'pf_rd_m', 'pf_rd_s', 'pf_rd_t', 'pf_rd_w',
  'hvadid', 'hvrand', 'hvtargid', 'hvnetw', 'hvbmt', 'hvdev',
  'hvlocphy', 'hydadcr'
]);

function compare(localSource, upstream) {
  validateUpstream(upstream);
  const local = readRuleGroups(localSource);
  const globalCovered = new Set([...local.global, ...local.reviewedGlobal].map(lower));
  const sitesCovered = new Map();
  for (const entry of [...local.site, ...local.reviewedSite]) {
    for (const host of entry.hosts) {
      const key = lower(host);
      if (!sitesCovered.has(key)) sitesCovered.set(key, new Set());
      entry.params.forEach(param => sitesCovered.get(key).add(lower(param)));
    }
  }
  const globallyCovered = p => lower(p).startsWith('utm_') || globalCovered.has(lower(p));
  const globalCandidates = sorted(new Set(upstream.remote.data
    .flatMap(record => record.stripList).map(lower).filter(p => !globallyCovered(p))));
  const reviewOnlyGlobal = {};
  for (const source of ['mpl', 'lgpl']) {
    reviewOnlyGlobal[source] = sorted(new Set(upstream[source].global.queryParams.map(lower)
      .filter(p => !globallyCovered(p) && !globalCandidates.includes(p))));
  }
  const scoped = new Map();
  const unmatchedGroups = [];
  for (const source of ['mpl', 'lgpl']) {
    for (const [groupName, rule] of Object.entries(upstream[source])) {
      if (groupName === 'global') continue;
      const hosts = rule.hosts || [];
      const matches = hosts.map(lower).filter(host => sitesCovered.has(host));
      if (!matches.length) {
        const pending = rule.queryParams.filter(p => !globallyCovered(p));
        if (pending.length) unmatchedGroups.push({source, group:groupName, hosts:hosts.length, candidates:pending.length});
        continue;
      }
      for (const host of matches) {
        for (const original of rule.queryParams) {
          const param = lower(original);
          if (globallyCovered(param) || sitesCovered.get(host).has(param)) continue;
          if (!scoped.has(host)) scoped.set(host, new Set());
          scoped.get(host).add(param);
        }
      }
    }
  }
  const proposedByHost = sorted(scoped.keys()).map(host => ({
    hosts: [host],
    params: sorted([...scoped.get(host)].filter(p => !REVIEW_ONLY.has(p) && SCOPED_CANDIDATES.has(p)))
  })).filter(entry => entry.params.length > 0);
  // Group hosts whose proposed parameter sets are identical. This makes
  // common Amazon regional rules compact and easy to review.
  const grouped = new Map();
  for (const entry of proposedByHost) {
    const signature = JSON.stringify(entry.params);
    if (!grouped.has(signature)) grouped.set(signature, {hosts:[], params:entry.params});
    grouped.get(signature).hosts.push(...entry.hosts);
  }
  const siteCandidates = [...grouped.values()].map(entry => ({
    hosts:sorted(entry.hosts), params:entry.params
  })).sort((a,b)=>a.hosts[0].localeCompare(b.hosts[0], 'en'));
  const withheld = sorted(scoped.keys()).map(host => ({
    host,
    params: sorted([...scoped.get(host)].filter(p => REVIEW_ONLY.has(p) || !SCOPED_CANDIDATES.has(p)))
  })).filter(entry => entry.params.length > 0);
  const proposal = {global:globalCandidates, site:siteCandidates};
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(proposal)).digest('hex').slice(0,12);
  return {proposal, fingerprint, reviewOnlyGlobal, withheld, unmatchedGroups,
    allowList: sorted(new Set(upstream.remote.data.flatMap(record => record.allowList)))};
}

function replaceSection(source, startName, endName, valueName, values) {
  const start = '  // '+startName;
  const end = '  // '+endName;
  const index = source.indexOf(start), endIndex = source.indexOf(end);
  if (index < 0 || endIndex < index || source.indexOf(start, index+1) >= 0) {
    throw new Error('Missing or duplicate user script marker '+startName);
  }
  const indentJSON = JSON.stringify(values, null, 2).replaceAll('\n', '\n  ');
  return source.slice(0, index+start.length) +
    '\n  const '+valueName+' = '+indentJSON+';\n' +
    source.slice(endIndex);
}

function proposalSource(source, proposal) {
  if (proposal.global.length === 0 && proposal.site.length === 0) return source;
  // Never discard previously reviewed additions when proposing a later update.
  const current = readRuleGroups(source);
  const newGlobals = sorted(new Set([...current.reviewedGlobal, ...proposal.global].map(lower)));
  const siteMap = new Map();
  for (const entry of [...current.reviewedSite, ...proposal.site]) {
    for (const host of entry.hosts) {
      const key = lower(host);
      if (!siteMap.has(key)) siteMap.set(key, new Set());
      entry.params.forEach(param => siteMap.get(key).add(lower(param)));
    }
  }
  const grouped = new Map();
  for (const host of sorted(siteMap.keys())) {
    const params = sorted(siteMap.get(host));
    const signature = JSON.stringify(params);
    if (!grouped.has(signature)) grouped.set(signature, {hosts:[], params});
    grouped.get(signature).hosts.push(host);
  }
  const newSites = [...grouped.values()].sort((a,b) => a.hosts[0].localeCompare(b.hosts[0], 'en'));
  let output = replaceSection(source, 'MOZILLA_SYNC_GLOBAL_START', 'MOZILLA_SYNC_GLOBAL_END',
    'MOZILLA_REVIEWED_GLOBAL', newGlobals);
  output = replaceSection(output, 'MOZILLA_SYNC_SITE_START', 'MOZILLA_SYNC_SITE_END',
    'MOZILLA_REVIEWED_SITES', newSites);
  // Violentmonkey detects updates via @version: PRs must bump the patch version.
  const version = output.match(/^\/\/ @version\s+(\d+)\.(\d+)\.(\d+)\s*$/m);
  if (!version) throw new Error('Expected a semver userscript @version for bump');
  const next = version[1]+'.'+version[2]+'.'+(Number(version[3])+1);
  return output.replace(version[0], '// @version      '+next);
}

function namesText(names) {
  return names.length ? names.map(name => String.fromCharCode(96)+name+String.fromCharCode(96)).join(', ') : '(none)';
}
function report(result) {
  const {proposal, fingerprint, reviewOnlyGlobal, withheld, unmatchedGroups, allowList} = result;
  const lines = [
    '# Proposed Mozilla query-stripping updates', '',
    '**Manual review required.** These rules are proposed in a pull request, not deployed automatically.',
    'Firefox Strip-on-Share and navigation stripping have different scopes than userscript fetch/XHR interception. Remove any risky rule before merging.', '',
    'Proposal fingerprint: '+fingerprint+'. No timestamps are committed; unchanged upstream data produces the same patch.', '',
    '## Upstream sources', ''
  ];
  for (const [name,url] of Object.entries(SOURCES)) lines.push('- '+name+': '+url);
  lines.push('', '## Proposed globally', '', namesText(proposal.global), '',
    'These global candidates come ONLY from Firefox Remote Settings navigation stripping. The source collection includes allowlisted hosts: '+namesText(allowList)+'.', '',
    '## Proposed for exact hostnames', '');
  if (!proposal.site.length) lines.push('(none)');
  for (const entry of proposal.site) lines.push('- '+namesText(entry.hosts)+': '+namesText(entry.params));
  lines.push('', '## Needs extra review (not proposed for execution)', '',
    'The following are not automatically proposed, even when upstream calls them stripping candidates.', '');
  for (const [name,items] of Object.entries(reviewOnlyGlobal)) {
    lines.push('### '+name.toUpperCase()+' global list ('+items.length+')', '', namesText(items), '');
  }
  lines.push('### Ambiguous per-site keys', '');
  for (const entry of withheld) lines.push('- '+entry.host+': '+namesText(entry.params));
  if (!withheld.length) lines.push('(none)');
  lines.push('', '### New upstream site groups not yet supported', '',
    'These groups are tracked here for human consideration, not added as new host rules automatically.', '');
  for (const entry of unmatchedGroups) lines.push('- '+entry.source+'/'+entry.group+': '+entry.hosts+' hosts, '+entry.candidates+' uncovered key(s)');
  if (!unmatchedGroups.length) lines.push('(none)');
  lines.push('', '## Review checklist', '',
    '- [ ] Compare every proposed parameter to the current upstream source and its scope.',
    '- [ ] Confirm the rule does not break authentication, redirects, purchase flows, or site APIs.',
    '- [ ] Consider allowlisted hosts and unusual requests.',
    '- [ ] Add focused positive and negative tests for newly enabled rules.',
    '- [ ] Do not merge without review.', '');
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const find = name => { const at = args.indexOf(name); return at === -1 ? undefined : args[at+1]; };
  const fixtures = find('--fixture-dir');
  const output = find('--output-dir') || '.mozilla-review';
  const upstream = fixtures ? {
    remote: JSON.parse(fs.readFileSync(path.join(fixtures,'remote.json'),'utf8')),
    mpl: JSON.parse(fs.readFileSync(path.join(fixtures,'MPL2.json'),'utf8')),
    lgpl: JSON.parse(fs.readFileSync(path.join(fixtures,'LGPL.json'),'utf8'))
  } : await fetchUpstream();
  const source = fs.readFileSync(scriptPath,'utf8');
  const result = compare(source,upstream);
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'utm-stripper.user.js'),proposalSource(source,result.proposal));
  fs.writeFileSync(path.join(output,'report.md'),report(result));
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({
    fingerprint:result.fingerprint,
    global:result.proposal.global.length,
    scoped:result.proposal.site.reduce((n,x)=>n+x.params.length,0)
  },null,2)+'\n');
  console.log(JSON.stringify(result.proposal));
}

if (require.main === module) main().catch(error => {console.error(error);process.exitCode=1});
module.exports = {SOURCES, readRuleGroups, validateUpstream, fetchUpstream, compare, proposalSource, report};
