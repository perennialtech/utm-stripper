// ==UserScript==
// @name         UTM Stripper
// @namespace    https://github.com/perennialtech/utm-stripper
// @version      0.2.0
// @description  Remove UTM and known click-tracking parameters from links and common page requests.
// @author       perennialtech
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        none
// @inject-into  page
// @downloadURL  https://raw.githubusercontent.com/perennialtech/utm-stripper/main/utm-stripper.user.js
// @updateURL    https://raw.githubusercontent.com/perennialtech/utm-stripper/main/utm-stripper.user.js
// ==/UserScript==

(() => {
  'use strict';

  // Known tracking-only query parameters from advertising, social sharing,
  // analytics, and email campaigns. Do not add ambiguous keys such as
  // "ref", "source", "id", "tag", "si", or "feature" here: websites may need them.
  const TRACKING_PARAMS = new Set([
    // Ad click IDs and social link decoration.
    'fbclid', 'igshid', 'gclid', 'dclid', 'gbraid', 'wbraid',
    'msclkid', 'ttclid', 'twclid', 'yclid', 'li_fat_id',
    'srsltid', 'epik', 'gad_source',

    // Analytics and marketing-email identifiers.
    '_gl', '_ga', 'mc_cid', 'mc_eid', 'mkt_tok',
    '_hsenc', '_hsmi', 'vero_id', 'vero_conv',
    'oly_anon_id', 'oly_enc_id',
  ]);

  // Edit these arrays to add a custom exact parameter name or exempt a
  // parameter that a particular site needs. Matching is case-insensitive.
  const ADDITIONAL_PARAMS = [];
  const PRESERVE_PARAMS = [];
  for (const name of ADDITIONAL_PARAMS) TRACKING_PARAMS.add(name.toLowerCase());
  const preserveParams = new Set(PRESERVE_PARAMS.map(name => name.toLowerCase()));

  // Return the original value unchanged when there is nothing to remove.
  // This avoids unexpectedly rewriting relative URLs or other query parameters.
  function stripTrackingParams(value) {
    if (typeof value !== 'string' && !(value instanceof URL)) return value;

    let parsed;
    try {
      parsed = new URL(value, document.baseURI);
    } catch {
      return value;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return value;

    let removed = false;
    for (const key of [...parsed.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (!preserveParams.has(normalized) &&
          (normalized.startsWith('utm_') || TRACKING_PARAMS.has(normalized))) {
        parsed.searchParams.delete(key);
        removed = true;
      }
    }
    return removed ? parsed.href : value;
  }

  function cleanLink(link) {
    if (!link || !link.hasAttribute('href')) return;
    const oldURL = link.href;
    const newURL = stripTrackingParams(oldURL);
    if (newURL !== oldURL) link.href = newURL;
  }

  function eventLink(event) {
    // composedPath handles links inside open shadow DOM.
    const path = typeof event.composedPath === 'function'
      ? event.composedPath() : [event.target];
    for (const element of path) {
      if (element?.matches?.('a[href], area[href]')) return element;
    }
    return event.target?.closest?.('a[href], area[href]') ?? null;
  }

  // Run before page click handlers where possible. Also cover middle-click,
  // keyboard focus, and copying a link through its context menu.
  for (const type of ['pointerdown', 'mousedown', 'click', 'auxclick', 'contextmenu', 'focusin']) {
    document.addEventListener(type, event => cleanLink(eventLink(event)), true);
  }

  // A script cannot undo the already-sent initial navigation request.
  // This only tidies the current history entry/address bar.
  try {
    const cleaned = stripTrackingParams(location.href);
    if (cleaned !== location.href) history.replaceState(history.state, '', cleaned);
  } catch {
    // Some documents restrict history operations.
  }

  // Tidy URLs that single-page applications write into browser history.
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    if (typeof original !== 'function') continue;
    history[method] = function (state, title, url) {
      if (arguments.length < 3) return original.apply(this, arguments);
      return original.call(this, state, title, stripTrackingParams(url));
    };
  }

  // Programmatic new-tab/window navigation.
  if (typeof window.open === 'function') {
    const original = window.open;
    window.open = function (url, ...rest) {
      return original.call(this, stripTrackingParams(url), ...rest);
    };
  }

  // fetch() accepts a URL/string or a Request object. For Request objects,
  // copy the request to retain its method, headers, credentials, and body.
  if (typeof window.fetch === 'function') {
    const original = window.fetch;
    window.fetch = function (input, init) {
      if (typeof Request !== 'undefined' && input instanceof Request) {
        const cleaned = stripTrackingParams(input.url);
        if (cleaned !== input.url) input = new Request(cleaned, input);
      } else {
        input = stripTrackingParams(input);
      }
      return original.call(this, input, init);
    };
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    const original = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      return original.call(this, method, stripTrackingParams(url), ...rest);
    };
  }

  if (typeof navigator.sendBeacon === 'function') {
    const original = navigator.sendBeacon;
    navigator.sendBeacon = function (url, data) {
      return original.call(this, stripTrackingParams(url), data);
    };
  }
})();
