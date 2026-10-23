# UTM Stripper

A small, dependency-free [Violentmonkey](https://violentmonkey.github.io/) userscript that removes **all `utm_*` query parameters** (case-insensitively) from links and common web-page requests, without removing unrelated query parameters.

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
https://example.com/article?utm_source=newsletter&utm_campaign=fall&id=123#intro
                                   ↓
https://example.com/article?id=123#intro
```

It removes any parameter whose **decoded name starts with `utm_`**, including uppercase forms and custom names like `utm_custom`. Parameters such as `id`, `gclid`, and `fbclid` are left alone.

## Limits you should know

**A userscript is not a browser-wide network filter.** It cannot remove parameters from the *initial* request used to load the page; cleaning the address bar afterwards does not undo that request. It also cannot reliably intercept:

- Browser-managed resource loads (images, stylesheets, scripts, iframes).
- Requests from service workers, browser extensions, or other tabs/contexts.
- Every JavaScript navigation mechanism (e.g. direct assignment to `location.href`).
- Requests that happen before the script runs, or from pages that block page-context userscript injection.

In particular, if you click a UTM-tagged link *outside an already-running page script* (e.g. in another app), the destination still receives the original URL on the initial request.

For a strict **remove UTM parameters before *every* network request is sent** requirement, use a proper browser extension with network-level request filtering. This userscript is only best-effort.

## Development

Requires Node.js with built-in `node:test` and `fetch`/`Request` support:

```sh
npm test
```

No dependencies and no build step. The installable source is `utm-stripper.user.js`.

## License

MIT.
