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

It removes any parameter whose **decoded name starts with `utm_`**, including uppercase forms and custom names like `utm_custom`, plus a small, explicit list of known tracking keys:

| Category | Parameters |
| --- | --- |
| Advertising and social | `fbclid`, `igshid`, `gclid`, `dclid`, `gbraid`, `wbraid`, `msclkid`, `ttclid`, `twclid`, `yclid`, `li_fat_id`, `srsltid`, `epik`, `gad_source` |
| Analytics | `_gl`, `_ga` |
| Email marketing | `mc_cid`, `mc_eid`, `mkt_tok`, `_hsenc`, `_hsmi`, `vero_id`, `vero_conv`, `oly_anon_id`, `oly_enc_id` |

Names are matched **exactly** except for the `utm_` prefix. Unknown or potentially functional parameters such as `id`, `ref`, `source`, `tag`, `si`, `feature`, `q`, and `token` are left alone.

### Customising the list

At the beginning of `utm-stripper.user.js` you can edit two arrays:

- `ADDITIONAL_PARAMS` — extra exact parameter names to strip, e.g. `['my_tracking_id']`.
- `PRESERVE_PARAMS` — exact parameter names to keep, even if included in the built-in list, e.g. `['gclid']`.

Editing the installed script locally may be overwritten by future automatic updates. If you need permanent custom rules, maintain your own copy. Although these identifiers are generally used for tracking, removing them can interfere with some advertising, attribution, login, or site-specific flows.

This is a deliberately small allowlist of **parameters to remove**, rather than indiscriminately deleting unfamiliar query keys. For more comprehensive filtering, see [Firefox's query stripping documentation](https://firefox-source-docs.mozilla.org/toolkit/components/antitracking/anti-tracking/query-stripping/index.html) and [AdGuard's URL Tracking filter](https://adguard.com/en/blog/adguard-url-tracking-filter.html).

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
