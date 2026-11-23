# Documentation Catalog and Cutover Data

## Catalog

A maintainer-reviewed file on `develop` is the canonical inventory of editions eligible for publication. Build output and npm dist-tags are derived or external inputs and cannot rewrite a catalog entry.

| Entity | Fields | Rules |
| --- | --- | --- |
| Desktop edition | Key, channel, display label, source SHA, optional desktop tag | Stable or prerelease entries match the named published GitHub desktop release. A source-only preview identifies the SHA, uses a distinct key such as `preview-<short-sha>`, and displays Preview. |
| Tooling edition | Package version, channel, source SHA, npm release tag | One record produces both CLI and Blue Data sections. The tag is `npm-v<version>`. The tag commit and source package versions agree, and both exact scoped versions must be public. |
| Recommended edition | Desktop edition key, optional tooling edition key | Points to entries in the same catalog. A tooling pointer supplies both section links. A pending tooling edition has no pointer. |
| Publication inventory | Section, edition key, fixed URL, source SHA | Derived from the catalog for route and retention checks. Stable section landing pages display the recommended edition and list fixed URLs. |
| Manual cutover record | Live Blue 3 edition and source revision, controlled link locations and destinations, verification result, retirement authorization | Record the live manual and link checks before separately authorized retirement. |

Edition keys and routes are unique within their series. Existing published entries are append-only. Moving the recommendation changes section navigation and keeps all published edition URLs at their original source revisions. New source-only previews receive new keys when their SHA changes. Keep catalog validation and candidate deployment separate from product-site link changes.

## Lifecycle

A candidate edition is proposed, verified, and deployed. Verification rejects missing or mismatched sources, invalid pointers, missing assets, and removed or rewritten published entries. Deployment stages a single complete site after all verification. The live revision advances only after the trusted deployment succeeds.

The cutover progresses from live Blue 3 manual verification to updating and verifying project-controlled links, then to separately authorized retirement. Old Java Blue bookmarks and third-party links may stop working after retirement.
