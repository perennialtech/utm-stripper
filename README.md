# UTM Stripper

A small, dependency-free [Violentmonkey](https://violentmonkey.github.io/) userscript that removes **`utm_*` and other known tracking query parameters** (case-insensitively) from links and common web-page requests, without removing unrelated query parameters.

## Install

1. Install Violentmonkey for your browser.
2. **[Install UTM Stripper](https://raw.githubusercontent.com/perennialtech/utm-stripper/main/utm-stripper.user.js)** — open the `.user.js` link, confirm installation in Violentmonkey.
3. The script runs automatically on HTTP and HTTPS websites. Violentmonkey will check the same URL for updates.

## What it handles

- Normal links, including middle clicks, context menus, and links added dynamically.
- URLs shown in the address bar (without triggering another page load).
- Same-page history changes via `history.pushState` / `history.replaceState`.
- Calls to `window.open()`, `fetch()`, `XMLHttpRequest.open()`, and `navigator.sendBeacon()`.
- `Request` objects passed to `fetch()` (reconstructed with the original request settings).

For example:

```text
https://example.com/article?utm_source=newsletter&fbclid=abc123&id=123#intro
                                   ↓
https://example.com/article?id=123#intro
```

It removes any parameter whose **decoded name starts with `utm_`**, including uppercase forms and custom names like `utm_custom`, plus reviewed tracking keys:

| Category | Parameters |
| --- | --- |
| Advertising and social | `fbclid`, `igshid`, `gclid`, `dclid`, `gbraid`, `wbraid`, `msclkid`, `ttclid`, `twclid`, `yclid`, `li_fat_id`, `srsltid`, `epik`, `gad_source`, `ysclid`, `wickedid`, `ndclid` |
| Analytics | `_gl`, `_ga`, `__s`, `__hssc`, `__hstc`, `__hsfp`, `hsctatracking`, `matomo_campaign`, `mtm_source`, `pk_campaign` (and other specific campaign keys) |
| Email marketing | `mc_cid`, `mc_eid`, `mkt_tok`, `_hsenc`, `_hsmi`, `vero_id`, `vero_conv`, `oly_anon_id`, `oly_enc_id`, `_openstat` |

Names are matched **exactly** except for the `utm_` prefix. Unknown or potentially functional parameters such as `id`, `ref`, `source`, `tag`, `feature`, `q`, and `token` are left alone by default.

### Site-specific cleanup

Some short parameter names are too ambiguous to strip everywhere. They are removed **only when the destination URL has a known matching hostname**, such as:

| Destination | Parameters removed there |
| --- | --- |
| X / Twitter | `s`, `cxt`, `refsrc`, `ref_src`, `ref_url` |
| YouTube | `si` |
| Spotify | `si` |
| Amazon (selected country domains, including `.com.au`) | `pd_rd_r`, `pd_rd_w`, `pd_rd_wg`, `pf_rd_r`, `pf_rd_p`, `ref_` and related decoration |
| Reddit | `ref_source`, `ref_campaign`, `correlation_id`, `share_id` |
| Instagram, Facebook, Bilibili | Selected sharing and referral IDs |

For example, `s=20` is removed from a link to `x.com` but **kept** on `example.com`; `si` is removed from YouTube/Spotify links but preserved everywhere else. Host checks are exact, so `x.com.evil.example` does not get X-specific rules. Fields like Amazon's `th`, `psc`, `tag`, and generic `ref` are deliberately preserved.

### Customising the list

At the beginning of `utm-stripper.user.js` you can edit two arrays:

- `ADDITIONAL_PARAMS` — extra exact parameter names to strip, e.g. `['my_tracking_id']`.
- `PRESERVE_PARAMS` — exact parameter names to keep, even if included in global **or site-specific** lists, e.g. `['gclid', 'si']`.

Editing the installed script locally may be overwritten by future automatic updates. If you need permanent custom rules, maintain your own copy. Although these identifiers are generally used for tracking, removing them can interfere with some advertising, attribution, login, or site-specific flows.

### Sources and maintenance

The bundled list was reviewed against **Firefox source and live Remote Settings rules on 23 October 2026**, not just the (partly outdated) Firefox query-stripping documentation:

- [Firefox's live Remote Settings query-stripping collection](https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/query-stripping/records)
- [Firefox Strip-on-Share rules (MPL 2.0)](https://searchfox.org/firefox-main/source/toolkit/components/antitracking/StripOnShareLists/MPL2/StripOnShare.json)
- [Additional Strip-on-Share rules (LGPL)](https://searchfox.org/firefox-main/source/toolkit/components/antitracking/StripOnShareLists/LGPL/StripOnShareLGPL.json)

This is a **manually curated subset** of the lists, not a vendored copy or a live feed. Firefox's own rules also have different applicability and exception handling. Automatically importing every Firefox rule (especially short names like `s`, `ref`, or `var`) into a userscript that rewrites page requests could break websites. Add new rules only after checking their intended scope and adding tests for both matching and nonmatching websites.

### Automated Mozilla review PRs

The [Propose Mozilla tracking rule updates](.github/workflows/mozilla-rule-review.yml) workflow runs every Monday at 03:37 UTC and can also be started manually from GitHub Actions. It fetches the live Remote Settings collection and the current MPL/LGPL Strip-on-Share rule sources, compares them against the last **human-approved upstream snapshot**, and **opens or updates a draft pull request whenever the upstream rules change** — even when no new rule is safe to enable.

- The PR includes **all upstream parameter rules**, across all Mozilla groups and destinations, rather than a fixed allowlist of candidate names. The manifest labels each entry as already covered, lower risk, needs review, high risk, or unsupported scope; no new rule is hidden merely because it requires manual evaluation.
- Complete source groups, host lists, schemeless-domain rules, and Firefox Remote Settings allowlists are preserved in the PR's source snapshot. Newly added, removed, and scope-modified rules are identified against the merged baseline.
- Lower-risk tracking identifiers can be proposed as executable changes when their source scope is specific enough; all others remain in the review manifest. **Nothing in a draft PR is installed until a person approves and merges it.** Unlike Firefox, this userscript intercepts page-initiated requests, so even low-risk candidates need testing.
- A single stable PR branch (`automation/mozilla-rule-inventory`) prevents recurring duplicate PRs. Generated files are deterministic, with no run timestamps.
- Executable proposals increment the userscript's patch version for Violentmonkey updates **after** merging. The workflow tests proposed code and never commits straight to `main`; metadata-only PRs do not unnecessarily bump the version.
- **No issue fallback:** if PR creation is disallowed or fails, the workflow fails visibly instead.

This workflow requires the repository option **Allow GitHub Actions to create and approve pull requests** and scoped token permissions (`contents: write`, `pull-requests: write`). The generated PRs are drafts and are never auto-merged. PR checks triggered by `GITHUB_TOKEN`-created PRs may not run automatically; the scheduled workflow runs the Node tests before creating/updating its PR.

Run a local comparison with `node scripts/mozilla-rule-review.cjs --output-dir .mozilla-review`. Examine the full source snapshot, classified candidates, review report, and proposed userscript; none is automatically installed.

Mozilla's source data includes MPL-2.0 and LGPL-licensed lists. See [upstream rule attribution](docs/UPSTREAM-NOTICE.md) before redistributing modified copies. The local userscript's existing MIT license does not relicense Mozilla's source data.

## Limits you should know

**A userscript is not a browser-wide network filter.** It cannot remove parameters from the *initial* request used to load the page; cleaning the address bar afterwards does not undo that request. It also cannot reliably intercept:

- Browser-managed resource loads (images, stylesheets, scripts, iframes).
- Requests from service workers, browser extensions, or other tabs/contexts.
- Every JavaScript navigation mechanism (e.g. direct assignment to `location.href`).
- Requests that happen before the script runs, or from pages that block page-context userscript injection.

In particular, if you click a tracking-tagged link *outside an already-running page script* (e.g. in another app), the destination still receives the original URL on the initial request.

For a strict **remove tracking parameters before *every* network request is sent** requirement, use a proper browser extension with network-level request filtering. This userscript is only best-effort.

## Development

Requires Node.js with built-in `node:test` and `fetch`/`Request` support:

```sh
npm test
```

No dependencies and no build step. The installable source is `utm-stripper.user.js`.

## License

MIT.
