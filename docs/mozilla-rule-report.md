# Review Mozilla tracking rules

**Draft PR for human review; no automatic merge.** This is an inventory-only proposal. No userscript rules are changed or activated by the automation.

Snapshot fingerprint: b1c096063cb0. Sources are compared semantically, with stable sorting and no run timestamps.

## Coverage and risk

| Classification | Source parameter entries | Treatment |
| --- | ---: | --- |
| Already covered | 132 | Existing stripping behaviour |
| Low risk (heuristic) | 0 | Advisory candidates only; requires separate compatibility-tested implementation |
| Needs review | 93 | Explicitly represented in manifest; not enabled |
| High risk | 0 | Potentially functional, represented but not enabled |
| Unsupported scope | 296 | Source scope retained verbatim; not enabled |

Total: **521** source parameter entries. Includes repeated names across independent Mozilla sources/groups.

## Source links

- remote: https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/query-stripping/records
- mpl: https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/antitracking/StripOnShareLists/MPL2/StripOnShare.json
- lgpl: https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/antitracking/StripOnShareLists/LGPL/StripOnShareLGPL.json

## Changes since accepted baseline

- Added: **7** entries; removed: **0**; changed host/exception scope: **290**; changed allowlist configuration: **no**

### added

- `mpl/global/_su_rec`
- `mpl/global/_su_rec_id`
- `mpl/linkedin/alternatechannel`
- `mpl/linkedin/ebp`
- `mpl/linkedin/isjobsearch`
- `mpl/linkedin/lipi`
- `mpl/linkedin/origin`

### changedScope

- `lgpl/aliexpress/aff_fcid`
- `lgpl/aliexpress/aff_fsk`
- `lgpl/aliexpress/aff_platform`
- `lgpl/aliexpress/aff_short_key`
- `lgpl/aliexpress/aff_trace_key`
- `lgpl/aliexpress/algo_expid`
- `lgpl/aliexpress/algo_pvid`
- `lgpl/aliexpress/curpageloguid`
- `lgpl/aliexpress/dp`
- `lgpl/aliexpress/gps-id`
- `lgpl/aliexpress/mall_affr`
- `lgpl/aliexpress/pdp_npi`
- `lgpl/aliexpress/pvid`
- `lgpl/aliexpress/scm`
- `lgpl/aliexpress/scm_id`
- `lgpl/aliexpress/scm-url`
- `lgpl/aliexpress/sk`
- `lgpl/aliexpress/spm`
- `lgpl/aliexpress/terminal_id`
- `lgpl/aliexpress/utparam`
- `lgpl/amazon/_encoding`
- `lgpl/amazon/adgrpid`
- `lgpl/amazon/ascsubtag`
- `lgpl/amazon/creative`
- `lgpl/amazon/creativeasin`
- `lgpl/amazon/dchild`
- `lgpl/amazon/field-lbr_brands_browse-bin`
- `lgpl/amazon/hvadid`
- `lgpl/amazon/hvbmt`
- `lgpl/amazon/hvdev`
- `lgpl/amazon/hvlocphy`
- `lgpl/amazon/hvnetw`
- `lgpl/amazon/hvrand`
- `lgpl/amazon/hvtargid`
- `lgpl/amazon/hydadcr`
- `lgpl/amazon/ingress`
- `lgpl/amazon/initialissue`
- `lgpl/amazon/linkcode`
- `lgpl/amazon/linkid`
- `lgpl/amazon/pd_rd_i`
- `lgpl/amazon/pf_rd_i`
- `lgpl/amazon/pf_rd_m`
- `lgpl/amazon/pf_rd_s`
- `lgpl/amazon/pf_rd_t`
- `lgpl/amazon/pf_rd_w`
- `lgpl/amazon/plattr`
- `lgpl/amazon/qid`
- `lgpl/amazon/qualifier`
- `lgpl/amazon/rdc`
- `lgpl/amazon/refrid`
- `lgpl/amazon/spia`
- `lgpl/amazon/th`
- `lgpl/amazon/ts_id`
- `lgpl/amazon/visitid`
- `lgpl/amazon/vtr`
- `lgpl/bbc/at_bbc_team`
- `lgpl/bbc/facebook_page`
- `lgpl/bbc/ns_campaign`
- `lgpl/bbc/ns_fee`
- `lgpl/bbc/ns_linkname`
- `lgpl/bbc/ns_mchannel`
- `lgpl/bbc/ns_source`
- `lgpl/bbc/ocid`
- `lgpl/bbc/xtor`
- `lgpl/bestbuy/acampid`
- `lgpl/bestbuy/intl`
- `lgpl/bestbuy/irclickid`
- `lgpl/bestbuy/irgwc`
- `lgpl/bestbuy/loc`
- `lgpl/bestbuy/mpid`
- `lgpl/bing/cvid`
- `lgpl/bing/form`
- `lgpl/bing/qp`
- `lgpl/bing/qs`
- `lgpl/bing/sc`
- `lgpl/bing/sk`
- `lgpl/bing/sp`
- `lgpl/bloomberg/leadsource`
- `lgpl/bloomberg/sref`
- `lgpl/bloomberg/srnd`
- `lgpl/carousell/referrer_category_id`
- `lgpl/carousell/referrer_page_type`
- `lgpl/carousell/referrer_request_id`
- `lgpl/carousell/referrer_search_query`
- `lgpl/carousell/referrer_search_query_source`
- `lgpl/carousell/referrer_sort_by`
- `lgpl/carousell/referrer_source`
- `lgpl/carousell/t-id`
- `lgpl/carousell/t-referrer_browse_type`
- `lgpl/carousell/t-source`
- `lgpl/carousell/tap_index`
- `lgpl/cnet/ftag`
- `lgpl/cnn/ref`
- `lgpl/ebay/_from`
- `lgpl/ebay/_trkparms`
- `lgpl/ebay/_trksid`
- `lgpl/ebay/amdata`
- `lgpl/ebay/campid`
- `lgpl/ebay/hash`
- `lgpl/ebay/mkcid`
- `lgpl/ebay/mkevt`
- `lgpl/ebay/mkrid`
- `lgpl/ebay/ssspo`
- `lgpl/ebay/sssrc`
- `lgpl/ebay/ssuid`
- `lgpl/etsy/click_key`
- `lgpl/etsy/click_sum`
- `lgpl/etsy/organic_search_click`
- `lgpl/etsy/ref`
- `lgpl/facebook/extid`
- `lgpl/facebook/mibextid`
- `lgpl/facebook/tracking`
- `lgpl/flipkart/_refid`
- `lgpl/flipkart/affid`
- `lgpl/flipkart/cid`
- `lgpl/flipkart/iid`
- `lgpl/flipkart/lid`
- `lgpl/flipkart/pageuid`
- `lgpl/flipkart/pwsvid`
- `lgpl/flipkart/ssid`
- `lgpl/flipkart/store`
- `lgpl/forbes/sh`
- `lgpl/github/email_source`
- `lgpl/github/email_token`
- `lgpl/google/aqs`
- `lgpl/google/bih`
- `lgpl/google/biw`
- `lgpl/google/cad`
- `lgpl/google/cd`
- `lgpl/google/dcr`
- `lgpl/google/dpr`
- `lgpl/google/ei`
- `lgpl/google/esrc`
- `lgpl/google/gs_l`
- `lgpl/google/gs_lcp`
- `lgpl/google/gs_lcrp`
- `lgpl/google/gs_lp`
- `lgpl/google/oe`
- `lgpl/google/pcampaignid`
- `lgpl/google/rlz`
- `lgpl/google/sca_esv`
- `lgpl/google/sclient`
- `lgpl/google/sei`
- `lgpl/google/site`
- `lgpl/google/sourceid`
- `lgpl/google/sxsrf`
- `lgpl/google/usg`
- `lgpl/google/ved`
- `lgpl/google/vet`
- `lgpl/google/visit_id`
- `lgpl/imdb/pf_rd_i`
- `lgpl/imdb/pf_rd_m`
- `lgpl/imdb/pf_rd_p`
- `lgpl/imdb/pf_rd_r`
- `lgpl/imdb/pf_rd_s`
- `lgpl/imdb/pf_rd_t`
- `lgpl/imdb/ref_`
- `lgpl/lazada/acm`
- `lgpl/lazada/ad_src`
- `lgpl/lazada/cid`
- `lgpl/lazada/clicktrackinfo`
- `lgpl/lazada/did`
- `lgpl/lazada/laz_trackid`
- `lgpl/lazada/mkttid`
- `lgpl/lazada/mp`
- `lgpl/lazada/pos`
- `lgpl/lazada/scm`
- `lgpl/lazada/spm`
- `lgpl/lazada/trafficfrom`
- `lgpl/linkedin/refid`
- `lgpl/linkedin/trackingid`
- `lgpl/linkedin/trk`
- `lgpl/mirror/int_source`
- `lgpl/msn/cvid`
- `lgpl/msn/ei`
- `lgpl/msn/pc`
- `lgpl/newyorker/bxid`
- `lgpl/newyorker/cndid`
- `lgpl/newyorker/esrc`
- `lgpl/newyorker/mbid`
- `lgpl/newyorker/source`
- `lgpl/nytimes/smid`
- `lgpl/reddit/correlation_id`
- `lgpl/reddit/ref`
- `lgpl/reddit/ref_campaign`
- `lgpl/reddit/ref_source`
- `lgpl/reddit/share_id`
- `lgpl/theathletic/source`
- `lgpl/tiktok/embed_source`
- `lgpl/tiktok/enter_method`
- `lgpl/tiktok/is_from_webapp`
- `lgpl/tiktok/q`
- `lgpl/tiktok/refer`
- `lgpl/tiktok/referer_url`
- `lgpl/tiktok/sec_uid`
- `lgpl/tiktok/sender_device`
- `lgpl/tiktok/share_app_id`
- `lgpl/tiktok/share_author_id`
- `lgpl/tiktok/t`
- `lgpl/tiktok/tt_from`
- `lgpl/tiktok/web_id`
- `lgpl/twitch/tt_content`
- `lgpl/twitch/tt_medium`
- `lgpl/twitter/cxt`
- `lgpl/twitter/refsrc`
- `lgpl/twitter/s`
- `lgpl/wallstreetjournal/reflink`
- `lgpl/wired/mbid`
- `lgpl/wise/adref`
- `lgpl/wise/clickref`
- `lgpl/wise/partnerid`
- `lgpl/wise/partnerizecampaignid`
- `lgpl/yandex/clid`
- `lgpl/yandex/did`
- `lgpl/yandex/from`
- `lgpl/yandex/mlid`
- `lgpl/yandex/msid`
- `lgpl/yandex/persistent_id`
- `lgpl/yandex/source-serpid`
- `lgpl/yandex/stid`
- `lgpl/yandex/suggest_reqid`
- `lgpl/yandex/utm-term`
- `lgpl/youtube/feature`
- `lgpl/youtube/is`
- `lgpl/youtube/kw`
- `lgpl/youtube/pp`
- `lgpl/youtube/si`
- `mpl/amazon/__mk_de_de`
- `mpl/amazon/aaxitk`
- `mpl/amazon/content-id`
- `mpl/amazon/creativeid`
- `mpl/amazon/crid`
- `mpl/amazon/dib`
- `mpl/amazon/dib_tag`
- `mpl/amazon/eac_id`
- `mpl/amazon/eac_link`
- `mpl/amazon/eac_selected`
- `mpl/amazon/hsa_cr_id`
- `mpl/amazon/ipredirectfrom`
- `mpl/amazon/ipredirectoriginalurl`
- `mpl/amazon/keywords`
- `mpl/amazon/lp_asins`
- `mpl/amazon/lp_query`
- `mpl/amazon/lp_slot`
- `mpl/amazon/overridebasecountry`
- `mpl/amazon/pageloadid`
- `mpl/amazon/pd_rd_plhdr`
- `mpl/amazon/pd_rd_r`
- `mpl/amazon/pd_rd_w`
- `mpl/amazon/pd_rd_wg`
- `mpl/amazon/pf_rd_p`
- `mpl/amazon/pf_rd_r`
- `mpl/amazon/plink`
- `mpl/amazon/psc`
- `mpl/amazon/ref`
- `mpl/amazon/ref_`
- `mpl/amazon/ref_pageloadid`
- `mpl/amazon/s_prefix`
- `mpl/amazon/sbo`
- `mpl/amazon/social_share`
- `mpl/amazon/source_code`
- `mpl/amazon/sp_csd`
- `mpl/amazon/sprefix`
- `mpl/amazon/sr`
- `mpl/amazon/store_ref`
- `mpl/bilibili/broadcast_type`
- `mpl/bilibili/is_room_feed`
- `mpl/bilibili/live_from`
- `mpl/bilibili/spm_id_from`
- `mpl/facebook/__cft__[0]`
- `mpl/facebook/__cft__%5b0%5d`
- `mpl/facebook/__tn__`
- `mpl/handelsblatt/share`
- `mpl/humblebundle/hmb_campaign`
- `mpl/humblebundle/hmb_medium`
- `mpl/humblebundle/hmb_source`
- `mpl/instagram/ig_rid`
- `mpl/instagram/igshid`
- `mpl/linkedin/rcm`
- `mpl/meetup/eventorigin`
- `mpl/meetup/recid`
- `mpl/meetup/recsource`
- `mpl/meetup/searchid`
- `mpl/shopee/sp_atk`
- `mpl/shopee/xptdk`
- `mpl/spotify/si`
- `mpl/tokopedia/extparam`
- `mpl/twitter/ref_src`
- `mpl/twitter/ref_url`
- `mpl/wikimedia/wprov`

## Advisory candidates (not enabled)

Potential global navigation keys: _None_.

Potential host-scoped groups: **0** spanning **0** distinct exact hosts and **0** host/parameter pairs. These are suggestions, **not changes to live stripping**.

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
