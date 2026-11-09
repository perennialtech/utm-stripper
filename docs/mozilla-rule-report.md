# Review Mozilla tracking rules

**Draft PR for human review; no automatic merge.** This is an inventory-only proposal. No userscript rules are changed or activated by the automation.

Snapshot fingerprint: 78ae4e17ae1f. Sources are compared semantically, with stable sorting and no run timestamps.

## Coverage and risk

| Classification | Source parameter entries | Treatment |
| --- | ---: | --- |
| Already covered | 146 | Existing stripping behaviour |
| Low risk (heuristic) | 27 | Advisory candidates only; requires separate compatibility-tested implementation |
| Needs review | 282 | Explicitly represented in manifest; not enabled |
| High risk | 52 | Potentially functional, represented but not enabled |
| Unsupported scope | 12 | Source scope retained verbatim; not enabled |

Total: **519** source parameter entries. Includes repeated names across independent Mozilla sources/groups.

## Source links

- remote: https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/query-stripping/records
- mpl: https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/antitracking/StripOnShareLists/MPL2/StripOnShare.json
- lgpl: https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/antitracking/StripOnShareLists/LGPL/StripOnShareLGPL.json

## Changes since accepted baseline

- Added: **5** entries; removed: **0**; changed host/exception scope: **4**; changed allowlist configuration: **no**

### added

- `mpl/linkedin/alternatechannel`
- `mpl/linkedin/ebp`
- `mpl/linkedin/isjobsearch`
- `mpl/linkedin/lipi`
- `mpl/linkedin/origin`

### changedScope

- `lgpl/linkedin/refid`
- `lgpl/linkedin/trackingid`
- `lgpl/linkedin/trk`
- `mpl/linkedin/rcm`

## Advisory candidates (not enabled)

Potential global navigation keys: _None_.

Potential host-scoped groups: **4** spanning **39** distinct exact hosts and **643** host/parameter pairs. These are suggestions, **not changes to live stripping**.

All remaining Strip-on-Share entries are recorded in the manifest, including every unsupported hostname and high-risk parameter.

## Approved-rule drift requiring manual review

None detected for explicitly reviewed rules.


## Full review manifest

In the PR Files changed tab, see docs/mozilla-rule-candidates.json for **every** rule, its source/group reference, coverage, risk tier and rationale. The companion docs/mozilla-source-snapshot.json preserves the complete hostname/schemeless-site scope, source rule group and exceptions without repeating huge host lists per parameter.

Rules with benign-sounding names can still be functional, especially in API requests. Strip-on-Share is not proof of safety for automatic fetch/XHR/beacon/history interception; tier labels are only heuristics.

## Checklist

- [ ] Review upstream additions, removals, allowlists and site scope, including obsoleteReviewed entries.
- [ ] Promote rules only in separate code changes with positive/negative tests and the appropriate link-only versus request scope.
- [ ] Add positive/negative browser tests for promoted rules.
- [ ] Review LGPL/MPL terms and retain source attribution.
- [ ] Merge only after human approval.
