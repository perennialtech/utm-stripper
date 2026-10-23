# Mozilla rule provenance and licensing

The automated review files under `docs/mozilla-source-snapshot.json` and
`docs/mozilla-rule-candidates.json` are derived from Mozilla's upstream
tracking-rule sources. They are distinct from this project's MIT-licensed
userscript.

Source references:

- [Mozilla Remote Settings query-stripping collection](https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/query-stripping/records)
- [Mozilla Strip-on-Share MPL2 rule list](https://github.com/mozilla-firefox/firefox/blob/main/toolkit/components/antitracking/StripOnShareLists/MPL2/StripOnShare.json) — Mozilla Public License 2.0 material
- [Mozilla Strip-on-Share LGPL rule list](https://github.com/mozilla-firefox/firefox/blob/main/toolkit/components/antitracking/StripOnShareLists/LGPL/StripOnShareLGPL.json) — LGPL-licensed upstream material

The generated snapshot and candidate manifest preserve the originating
source/group for each entry. Check the upstream repository's applicable license
notices and obligations when redistributing modified versions of those files.

Nothing in this project's MIT LICENSE is intended to replace or supersede the
licenses of upstream Mozilla-derived rule data.
