// ==UserScript==
// @name         UTM Stripper
// @namespace    https://github.com/perennialtech/utm-stripper
// @version      0.3.0
// @description  Strip common tracking query parameters using global and host-specific rules.
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

  // Curated from Firefox's current navigation and Strip-on-Share lists (2026-10-23):
  // https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/query-stripping/records
  // https://searchfox.org/firefox-main/source/toolkit/components/antitracking/StripOnShareLists/
  // Only high-confidence tracking keys are global. Ambiguous names like
  // ref, source, id, tag, si, s and feature MUST NOT be stripped globally.
  const GLOBAL_TRACKING_PARAMS = new Set([
    // Ad click IDs and social link decoration.
    'fbclid', 'igshid', 'gclid', 'dclid', 'gbraid', 'wbraid',
    'msclkid', 'ttclid', 'twclid', 'yclid', 'li_fat_id',
    'srsltid', 'epik', 'gad_source', 'ndclid', 'gclsrc',

    // Analytics and marketing-email identifiers.
    '_gl', '_ga', 'mc_cid', 'mc_eid', 'mkt_tok',
    '_hsenc', '_hsmi', 'vero_id', 'vero_conv',
    'oly_anon_id', 'oly_enc_id', '__s', '_openstat',
    'wickedid', 'ysclid', '__hsfp', '__hssc', '__hstc',
    'hsctatracking', '_branch_match_id', 'ymid', 's_cid', 'wt_mc',

    // Distinctive campaign tags used by Matomo/Piwik and HubSpot.
    'matomo_campaign', 'matomo_cid', 'matomo_content', 'matomo_group',
    'matomo_keyword', 'matomo_medium', 'matomo_placement', 'matomo_source',
    'mtm_campaign', 'mtm_cid', 'mtm_content', 'mtm_group',
    'mtm_keyword', 'mtm_medium', 'mtm_placement', 'mtm_source',
    'pk_campaign', 'pk_cid', 'pk_content', 'pk_keyword', 'pk_kwd',
    'pk_medium', 'pk_source', 'piwik_campaign', 'piwik_keyword', 'piwik_kwd',
    'hsa_acc', 'hsa_ad', 'hsa_cam', 'hsa_grp', 'hsa_kw',
    'hsa_la', 'hsa_mt', 'hsa_net', 'hsa_ol', 'hsa_src',
    'hsa_tgt', 'hsa_ver',
  ]);

  // Exact host matching avoids leaking rules to unrelated domains or
  // subdomains. These are deliberately curated SUBSETS of Firefox's
  // per-site rules, not automatic imports of its entire lists.
  const SITE_RULES = [
    {
      hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
      params: ['ref_src', 'ref_url', 'refsrc', 'cxt', 's'],
    },
    {
      hosts: ['www.instagram.com', 'instagram.com'],
      params: ['ig_rid'],
    },
    {
      hosts: ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'],
      params: ['si'],
    },
    {
      hosts: ['www.reddit.com', 'reddit.com', 'old.reddit.com', 'new.reddit.com'],
      params: ['ref_source', 'ref_campaign', 'correlation_id', 'share_id'],
    },
    {
      hosts: ['open.spotify.com'],
      params: ['si'],
    },
    {
      hosts: ['www.amazon.com', 'amazon.com', 'www.amazon.co.uk', 'amazon.co.uk',
        'www.amazon.com.au', 'amazon.com.au', 'www.amazon.ca', 'amazon.ca',
        'www.amazon.de', 'amazon.de', 'www.amazon.fr', 'amazon.fr',
        'www.amazon.co.jp', 'amazon.co.jp', 'www.amazon.in', 'amazon.in',
        'www.amazon.it', 'amazon.it', 'www.amazon.es', 'amazon.es',
        'www.amazon.com.br', 'amazon.com.br', 'www.amazon.com.mx', 'amazon.com.mx',
        'www.amazon.nl', 'amazon.nl', 'www.amazon.pl', 'amazon.pl',
        'www.amazon.sg', 'amazon.sg'],
      params: ['pd_rd_r', 'pd_rd_w', 'pd_rd_wg', 'pd_rd_plhdr',
        'pf_rd_r', 'pf_rd_p', 'ref_pageloadid', 'ref_', 'social_share'],
    },
    {
      hosts: ['www.bilibili.com', 'space.bilibili.com', 'live.bilibili.com'],
      params: ['spm_id_from'],
    },
    {
      hosts: ['www.facebook.com', 'facebook.com'],
      params: ['mibextid'],
    },
  ];

  // MOZILLA_SYNC_GLOBAL_START
  // Newly proposed global rules are only applied after a human merges the PR.
  const MOZILLA_REVIEWED_GLOBAL = [];
  // MOZILLA_SYNC_GLOBAL_END
  // MOZILLA_SYNC_EXCEPTIONS_START
  // Remote Settings allowlisted hosts for newly reviewed navigation rules.
  const MOZILLA_REVIEWED_ALLOW_HOSTS = [];
  // MOZILLA_SYNC_EXCEPTIONS_END
  const reviewedGlobal = new Set(MOZILLA_REVIEWED_GLOBAL.map(name => name.toLowerCase()));
  const reviewedAllowHosts = new Set(MOZILLA_REVIEWED_ALLOW_HOSTS.map(name => name.toLowerCase()));

  // MOZILLA_SYNC_SITE_START
  // Site-specific rule proposals are reviewed before merging.
  const MOZILLA_REVIEWED_SITES = [];
  // MOZILLA_SYNC_SITE_END

  const siteTrackingParams = new Map();
  for (const { hosts, params } of [...SITE_RULES, ...MOZILLA_REVIEWED_SITES]) {
    for (const host of hosts) {
      const names = siteTrackingParams.get(host) || new Set();
      for (const name of params) names.add(name.toLowerCase());
      siteTrackingParams.set(host, names);
    }
  }

  // Edit these arrays to add a custom exact parameter name or exempt a
  // parameter that a particular site needs. Matching is case-insensitive.
  const ADDITIONAL_PARAMS = [];
  const PRESERVE_PARAMS = [];
  for (const name of ADDITIONAL_PARAMS) GLOBAL_TRACKING_PARAMS.add(name.toLowerCase());
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

    const hostname = parsed.hostname.toLowerCase();
    const siteParams = siteTrackingParams.get(hostname);
    const reviewedGlobalExcluded = [...reviewedAllowHosts].some(host =>
      hostname === host || hostname.endsWith('.' + host));
    let removed = false;
    for (const key of [...parsed.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (!preserveParams.has(normalized) &&
          (normalized.startsWith('utm_') || GLOBAL_TRACKING_PARAMS.has(normalized) ||
            (!reviewedGlobalExcluded && reviewedGlobal.has(normalized)) ||
            siteParams?.has(normalized))) {
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
