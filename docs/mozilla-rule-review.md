# Proposed Mozilla query-stripping updates

**Manual review required.** These rules are proposed in a pull request, not deployed automatically.
Firefox Strip-on-Share and navigation stripping have different scopes than userscript fetch/XHR interception. Remove any risky rule before merging.

Proposal fingerprint: 2cae891e5f8d. No timestamps are committed; unchanged upstream data produces the same patch.

## Upstream sources

- remote: https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/query-stripping/records
- mpl: https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/antitracking/StripOnShareLists/MPL2/StripOnShare.json
- lgpl: https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/antitracking/StripOnShareLists/LGPL/StripOnShareLGPL.json

## Proposed globally

(none)

These global candidates come ONLY from Firefox Remote Settings navigation stripping. The source collection includes allowlisted hosts: `googleadservices.com`.

## Proposed for exact hostnames

- `www.amazon.ca`, `www.amazon.co.jp`, `www.amazon.co.uk`, `www.amazon.com`, `www.amazon.com.au`, `www.amazon.com.br`, `www.amazon.com.mx`, `www.amazon.de`, `www.amazon.es`, `www.amazon.fr`, `www.amazon.in`, `www.amazon.it`, `www.amazon.nl`, `www.amazon.pl`, `www.amazon.sg`: `hvadid`, `hvbmt`, `hvdev`, `hvlocphy`, `hvnetw`, `hvrand`, `hvtargid`, `hydadcr`, `pd_rd_i`, `pf_rd_i`, `pf_rd_m`, `pf_rd_s`, `pf_rd_t`, `pf_rd_w`

## Needs extra review (not proposed for execution)

The following are not automatically proposed, even when upstream calls them stripping candidates.

### MPL global list (78)

`_bta_c`, `_bta_tid`, `_ke`, `_kx`, `adgroupid`, `adid`, `adtype`, `bg_aid_k`, `bg_aid_v`, `bg_campaign`, `bg_kw`, `bg_source`, `bg_source_id`, `channable`, `cq_cmp`, `cq_con`, `cq_med`, `cq_net`, `cq_plac`, `cq_plt`, `cq_src`, `cq_term`, `cto_pld`, `dm_i`, `ef_id`, `fbadid`, `fbc_id`, `gad_campaignid`, `gadid`, `gpromocode`, `gqt`, `h_ad_id`, `im_ref`, `klar_adid`, `klar_cpid`, `klar_source`, `meta_placement`, `meta_site_source`, `mkwid`, `nb_adtype`, `nb_ap`, `nb_expid_meta`, `nb_fii`, `nb_klid`, `nb_kwd`, `nb_li_ms`, `nb_lp_ms`, `nb_mi`, `nb_mt`, `nb_pc`, `nb_pi`, `nb_placement`, `nb_ppi`, `nb_ti`, `nbt`, `padid`, `pcrid`, `pl_gc`, `redirect_log_mongo_id`, `redirect_mongo_id`, `rtbhc`, `rtid`, `s_kwcid`, `sb_referer_host`, `scadid`, `sccid`, `trk_contact`, `trk_module`, `trk_msg`, `trk_sid`, `ttadid`, `tw_adid`, `tw_campaign`, `tw_content`, `tw_kwdid`, `tw_source`, `tw_term`, `var`

### LGPL global list (13)

`at_campaign`, `at_campaign_type`, `at_creation`, `at_emailtype`, `at_link`, `at_link_id`, `at_link_origin`, `at_link_type`, `at_medium`, `at_ptr_name`, `at_recipient_id`, `at_recipient_list`, `at_send_date`

### Ambiguous per-site keys

- live.bilibili.com: `broadcast_type`, `is_room_feed`, `live_from`
- m.youtube.com: `feature`, `is`, `kw`, `pp`
- space.bilibili.com: `broadcast_type`, `is_room_feed`, `live_from`
- www.amazon.ca: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.co.jp: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.co.uk: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.com: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.com.au: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.com.br: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.com.mx: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.de: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.es: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.fr: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.in: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.it: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.nl: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.pl: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.amazon.sg: `__mk_de_de`, `_encoding`, `aaxitk`, `adgrpid`, `ascsubtag`, `content-id`, `creative`, `creativeasin`, `creativeid`, `crid`, `dchild`, `dib`, `dib_tag`, `eac_id`, `eac_link`, `eac_selected`, `field-lbr_brands_browse-bin`, `hsa_cr_id`, `ingress`, `initialissue`, `ipredirectfrom`, `ipredirectoriginalurl`, `keywords`, `linkcode`, `linkid`, `lp_asins`, `lp_query`, `lp_slot`, `overridebasecountry`, `pageloadid`, `plattr`, `plink`, `psc`, `qid`, `qualifier`, `rdc`, `ref`, `refrid`, `s_prefix`, `sbo`, `source_code`, `sp_csd`, `spia`, `sprefix`, `sr`, `store_ref`, `th`, `ts_id`, `visitid`, `vtr`
- www.bilibili.com: `broadcast_type`, `is_room_feed`, `live_from`
- www.facebook.com: `__cft__[0]`, `__cft__%5b0%5d`, `__tn__`, `extid`, `tracking`
- www.reddit.com: `ref`
- www.youtube.com: `feature`, `is`, `kw`, `pp`
- youtu.be: `feature`, `is`, `kw`, `pp`
- youtube.com: `feature`, `is`, `kw`, `pp`

### New upstream site groups not yet supported

These groups are tracked here for human consideration, not added as new host rules automatically.

- mpl/handelsblatt: 1 hosts, 1 uncovered key(s)
- mpl/shopee: 11 hosts, 2 uncovered key(s)
- mpl/tokopedia: 1 hosts, 1 uncovered key(s)
- mpl/meetup: 1 hosts, 4 uncovered key(s)
- mpl/wikimedia: 4 hosts, 1 uncovered key(s)
- mpl/humblebundle: 1 hosts, 3 uncovered key(s)
- mpl/linkedin: 1 hosts, 1 uncovered key(s)
- mpl/ebay: 0 hosts, 2 uncovered key(s)
- lgpl/carousell: 5 hosts, 11 uncovered key(s)
- lgpl/etsy: 1 hosts, 4 uncovered key(s)
- lgpl/wallstreetjournal: 1 hosts, 1 uncovered key(s)
- lgpl/theathletic: 1 hosts, 1 uncovered key(s)
- lgpl/forbes: 1 hosts, 1 uncovered key(s)
- lgpl/bloomberg: 1 hosts, 3 uncovered key(s)
- lgpl/tiktok: 1 hosts, 13 uncovered key(s)
- lgpl/bbc: 1 hosts, 9 uncovered key(s)
- lgpl/cnn: 3 hosts, 1 uncovered key(s)
- lgpl/imdb: 2 hosts, 7 uncovered key(s)
- lgpl/mirror: 1 hosts, 1 uncovered key(s)
- lgpl/wise: 1 hosts, 4 uncovered key(s)
- lgpl/lazada: 6 hosts, 12 uncovered key(s)
- lgpl/msn: 1 hosts, 3 uncovered key(s)
- lgpl/aliexpress: 3 hosts, 20 uncovered key(s)
- lgpl/wired: 2 hosts, 1 uncovered key(s)
- lgpl/yandex: 1 hosts, 10 uncovered key(s)
- lgpl/ebay: 2 hosts, 12 uncovered key(s)
- lgpl/flipkart: 1 hosts, 9 uncovered key(s)
- lgpl/google: 189 hosts, 26 uncovered key(s)
- lgpl/bing: 1 hosts, 7 uncovered key(s)
- lgpl/twitch: 2 hosts, 2 uncovered key(s)
- lgpl/cnet: 1 hosts, 1 uncovered key(s)
- lgpl/nytimes: 1 hosts, 1 uncovered key(s)
- lgpl/github: 1 hosts, 2 uncovered key(s)
- lgpl/linkedin: 2 hosts, 3 uncovered key(s)
- lgpl/newyorker: 1 hosts, 5 uncovered key(s)
- lgpl/bestbuy: 1 hosts, 6 uncovered key(s)

## Review checklist

- [ ] Compare every proposed parameter to the current upstream source and its scope.
- [ ] Confirm the rule does not break authentication, redirects, purchase flows, or site APIs.
- [ ] Consider allowlisted hosts and unusual requests.
- [ ] Add focused positive and negative tests for newly enabled rules.
- [ ] Do not merge without review.
