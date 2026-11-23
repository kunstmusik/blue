# Documentation site verification

## Desktop and source

- **Source pin.** The local and public peeled `v3.0.0-beta.6` tag resolved to
  `308bc5c8ae479a44a047a96531edb1d673253069`. GitHub's release response
  reported a published prerelease. A direct product-site request on 2026-11-21
  showed that release and one manual link, which still points to the Java Blue
  site. [Release](https://github.com/kunstmusik/blue/releases/tag/v3.0.0-beta.6) · [Product site](https://blue.kunstmusik.com/)
- **Hosted desktop smoke.** `pnpm docs:site:build`, `pnpm docs:site:verify`,
  and `pnpm docs:site:smoke` passed for the tracked catalog. Chromium reached
  the three section selectors under `/blue/`, followed the beta.6
  recommendation to Score and its screenshot, and checked the About credits
  and GFDL link. Both tooling selectors showed the pending notice.
- **Offline build.** `pnpm build:manual` rendered all 35 chapters with Quarto
  1.10.18. The default profile still disables search and web fonts.
- **Packaged offline Help.** Verified the macOS arm64 beta.6 DMG against the
  release SHA-256 list, mounted it read-only, and launched Blue with an isolated
  profile. Playwright invoked the native **Help → Blue Manual** menu callback
  and captured the `shell.openPath` target from the package. Headless Chromium
  opened that same `file://` URL with its network context offline, followed
  Score, and loaded `score-timeline.png` with nonzero dimensions. The browser
  issued zero HTTP requests. The Help callback and browser navigation were
  exercised separately so the offline setting applied to the browser.
- **Strict API docs.** `pnpm --filter @blue/data docs:api` passed with no
  warnings. Removing the `BlueData.getProjectProperties` comment in a disposable
  checkout failed with exit code 4 and a missing documentation warning.
  Restored the comment in that checkout.

## Tooling publication

The public npm registry returned `0.0.0-stage` and `0.1.0-beta.1` for
both scoped packages on 2026-11-21. The latter tag resolves to
`6bd93b238946c1b54fa7f5e70cb6b7a3ac6202e2`, which lacks
`packages/blue-data/typedoc.json`. Both tooling section pages therefore mark
their first versioned edition pending. T020 requires a qualifying tag and both
matching public tarballs. [Blue CLI registry](https://www.npmjs.com/package/@kunstmusik/blue-cli) · [Blue Data registry](https://www.npmjs.com/package/@kunstmusik/blue-data)

### Controlled tooling rehearsal

- Tooling admission tests exercised missing or partial registry evidence,
  tag and version mismatch, integrity mismatch, and the absence of TypeDoc at
  the first beta tag.
- A disposable source checkout with synthetic `0.1.0-beta.2` package metadata
  rendered both guides with source revision `24f1376aec6b61ff20cb78e0623f5900de76fb2e`.
  The candidate contained 728 files and 3 fixed editions, including the
  unchanged beta.6 manual. The verifier checked the previous catalog and
  inventory, then Chromium opened both fixed tooling routes, followed the
  Node quickstart, searched for `BlueData`, and checked its exact source SHA
  and checkout-relative source path.
- The locally packed data fixture excluded TypeDoc output. Its README Node
  example loaded the fixture project and produced an output containing
  `<CsoundSynthesizer>`. The publicly released beta.1 CLI separately produced
  a 413-byte CSD with the sample from its own tag.

## Asset and license verification

- The tracked candidate contains 69 files and is 4.38 MB. It publishes 35
  beta.6 manual chapters under one fixed edition. The 16 emitted Quarto assets
  match the recorded SHA-256 inventory. The eight screenshots and
  `COPYING.GFDL` match the exact files at the beta.6 commit. Chromium fetched the
  hosted Quarto and GFDL notices through the manual links.
- In the synthetic tooling site, the emitted CLI and API package notices and
  BlueX7 attribution files match the pinned checkout. TypeDoc 0.28.20 and
  Lunr 2.3.9 license files match the pinned installation. The TypeDoc build
  retained all eight default browser assets, including the bundled search
  runtime and index. Pandoc 3.10 from Quarto 1.10.18 rendered the CLI guide and
  Node quickstart. Its output adds no browser dependencies.
- Complete the GFDL title, publisher, and History review before public
  deployment. The pinned manual already supplies its distinct Blue 3 title,
  source and contributor credits, source links, and unaltered license text.
  [Asset provenance](../../docs/site/provenance.md)

## Publication rehearsal

- The workflow contract tests cover read-only PR checks, trusted `develop`
  checkout at production job start, isolated concurrency, the protected
  environment, and run-attempt matching. The deploy action takes its artifact
  from the current build attempt. Existing desktop and npm workflows have no
  changes and no dependency on the Pages workflow.
- The actual baseline shell step passed a fake HTTP rehearsal. Two valid
  snapshots select retention. An explicitly trusted first dispatch can proceed
  when the home and both snapshots return 404. Missing input, partial baseline,
  and unexpected status fail.
- Artifact fixtures rejected a broken local page, asset, and anchor, an oversized
  candidate, mixed baseline snapshots, and rewritten editions. Separate desktop
  and tooling updates kept earlier paths and SHAs. A failed candidate left the
  previous verified output in place. A live deployment rehearsal remains part
  of T026.

## Workspace checks

- `pnpm test:scripts` passed 160 checks. The Windows-only npm invocation
  check was skipped on macOS.
- `pnpm lint` and `git diff --check` passed. The runtime and model packages
  and the existing release workflows have no diff.
- Both browser flows passed with the tracked catalog and the synthetic
  tooling catalog. Local commands used Node.js 26.13.1, pnpm 12.8.1, and
  Quarto 1.10.18. The workflow selects Node.js 22.

## Live operations

The [cutover plan](../../docs/site/legacy-cutover.md) records the live Blue 3 and controlled-link checks required before separately authorized retirement of the legacy repository and public site.

### Cutover readiness recheck

- GitHub still lists `develop` at `1a5857cbbd152470d646236518d4f23b891afc53`.
  The strict TypeDoc source commit `f55f875b9` is in the local feature history.
  First deployment needs those sources and the Pages workflow on the trusted
  branch. The Blue 3 Pages home returned HTTP 404.
- Both npm package histories still show only `0.0.0-stage` and
  `0.1.0-beta.1`. The latter remains the only public npm release tag and
  predates the reference. T020 remains open.
- In the earlier legacy repair, 181 URLs passed. This is historical evidence.
  Current cutover verification covers the active manual and project-controlled links.
  [Legacy deployment](https://github.com/kunstmusik/blue-manual/actions/runs/44930641915)
- The original title and named author, pinned adaptation source, and remaining
  publication attribution fields are recorded in the [provenance inventory](../../docs/site/provenance.md#manual-publication-attribution).
