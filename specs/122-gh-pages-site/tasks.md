---
description: "Implementation tasks for the Blue documentation site"
---

# Tasks for the Blue Documentation Site

**Input** [Specification](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [publication contract](contracts/publication.md), and [validation guide](quickstart.md)

**Verification** This feature changes documentation and publishing. The project model, Java parity, XML migration, CSD generation, runtime, and project history have no behavior changes. Use the existing CLI fixture in a temporary directory. Test publication correctness in ordinary CI.

**Format** `[ID] [P?] [Story?] Action and file path`. `[P]` identifies tasks that can run alongside the other indicated tasks after their shared prerequisites.

## Phase 1. Setup

- [X] T001 Create `docs/site/README.md` with the source owners, public product and docs site boundaries, and existing Quarto, TypeDoc, and Node toolchain. Confirm the single generated output `build/docs-site/` is ignored in `.gitignore`.
- [X] T002 [P] In `docs/site/provenance.md`, open the asset and license inventory from `LICENSING.md`, `docs/manual/COPYING.GFDL`, the package notices, and [the research](research.md#copyright-and-attribution). Identify the pinned sources and keep the hosted notices with their corresponding sections.

## Phase 2. Foundational

- [X] T003 Define the maintainer-reviewed edition catalog in `docs/site/editions.json` and document its contract in `docs/site/README.md`. Desktop rows carry key, channel, display label, source SHA, and optional desktop tag. Tooling rows carry package version, channel, source SHA, and npm release tag. Enforce the recommendation rules “Points to entries in the same catalog” and “A pending tooling edition has no pointer.”
- [X] T004 [P] In `scripts/docs-site-catalog.test.mjs`, add cases for validation of desktop and tooling fields, duplicate keys and routes, dangling or cross-series pointers, independent recommendation changes, and rejection of a removed or rewritten previously published edition. Exercise a prerelease, a source-only preview, and absence of the first tooling edition.
- [X] T005 [P] In `scripts/verify-docs-site.test.mjs`, add artifact checks for the three stable sections, fixed URLs, source revision labels, complete retained editions, broken pages/assets/anchors, and the published size limit with a small injected test limit. Cover root-relative URLs under `/blue/`, native input paths, and synthetic Windows path inputs.
- [X] T006 Implement parsing, invariants, route derivation, and append-only comparison in `scripts/docs-site-catalog.mjs`. Enforce “Edition keys and routes are unique within their series” and “Existing published entries are append-only.” Derive section, edition key, fixed URL, and SHA from the catalog. Keep URL separators independent of native paths.
- [X] T007 Implement the assembler in `scripts/build-docs-site.mjs` and expose `pnpm docs:site:build` in `package.json`. Stage a complete candidate from the tracked catalog in a disposable location, build from isolated pinned checkouts, regenerate the publication inventory, and move the result to `build/docs-site/` only after successful assembly.
- [X] T008 Implement `scripts/verify-docs-site.mjs` and expose `pnpm docs:site:verify` in `package.json`. Compare assembled routes and source revisions to the catalog and earlier published entries, crawl local links and assets including anchors, and enforce the 1 GB published-site limit. Wire focused script tests into the root script suite.

**Checkpoint**. Fixture catalogs build and validate a complete artifact. Ownership, fixed-route retention, and failure behavior are covered independently of deployment.

## Phase 3. User Story 1 — Find the right desktop manual (P1)

**Independent test**. From the assembled home, reach all three section entries and open a version-labeled Blue 3 chapter and image under `/blue/`. Open the same manual from the installed desktop with networking disabled. Verify the product-site manual link leads to the active Blue 3 manual during cutover.

- [X] T009 [P] [US1] Add a browser smoke for the docs home and edition navigation in `scripts/docs-site-manual.browser.test.mjs`. Check the prerelease label, chapter link, image, About credits, license, and back-link to the product site at the hosted path prefix.
- [X] T010 [P] [US1] Author the landing page and section navigation in `docs/site/index.html` and `docs/site/section.html`. Link directly to manual, CLI, API, and product routes. Show the recommended edition and list fixed links or the tooling availability notice when its pointer is absent.
- [X] T011 [US1] Seed `docs/site/editions.json` with the verified Blue 3 `v3.0.0-beta.6` tag and pinned SHA recorded in `specs/122-gh-pages-site/research.md`. Apply “Stable or prerelease entries match the named published GitHub desktop release” and “A source-only preview identifies the SHA, uses a distinct key such as `preview-<short-sha>`, and displays Preview.” Apply “New source-only previews receive new keys when their SHA changes.”
- [X] T012 [US1] Implement the desktop edition render in `scripts/render-docs-manual.mjs` and connect it in `scripts/build-docs-site.mjs`. Check release/tag agreement or a trusted preview SHA. Reuse `docs/manual/_quarto.yml` from the edition, keep default offline settings, preserve published chapter paths and assets, and link the matching Quarto source with its GFDL text, About credits, and screenshot attribution.
- [X] T013 [US1] Run the hosted-path browser smoke and `pnpm build:manual`. Open a chapter and screenshot from the installed Help menu offline and record the result and checked edition in `specs/122-gh-pages-site/verification.md`. Record which release the product site offers for the later link cutover.

**Checkpoint**. The manual increment works as a local or read-only preview. Production publication uses the protected workflow in US3.

## Phase 4. User Story 2 — Use the CLI and library for the installed version (P2)

**Independent test**. From an assembled site containing an eligible edition, run the versioned CLI compile example and the Blue Data Node example, search TypeDoc for `BlueData`, and repeat through the fixed edition routes. When no eligible release exists, verify both landing notices and the regression scenarios with controlled release fixtures.

- [X] T014 [P] [US2] In `scripts/docs-site-tooling.test.mjs`, cover absent or partial npm publication, wrong tag commit, mismatched package versions or integrity, and rejection of the first beta as a TypeDoc edition. Check fixed-version examples, pinned source links, and the pending landing state.
- [X] T015 [P] [US2] Add a hosted tooling smoke in `scripts/docs-site-tooling.browser.test.mjs` for exact-version guide labels, a reachable Node quickstart, and a TypeDoc search result at the nested API edition route.
- [X] T016 [US2] Implement tooling admission in `scripts/docs-site-tooling.mjs`. Apply “One record produces both CLI and Blue Data sections.” Enforce “The tag is `npm-v<version>`. The tag commit and source package versions agree, and both exact scoped versions must be public.” Match the published tarball integrity to release evidence or recorded maintainer verification. Require the reference sources at that revision. Apply “A tooling pointer supplies both section links.”
- [X] T017 [P] [US2] Implement the CLI edition render in `scripts/render-docs-cli.mjs` using the pinned `packages/blue-cli/README.md`. Preserve prerequisites, flags, exit behavior, and troubleshooting. Bind install and compile examples to the exact npm version and resolve source links to the pinned revision.
- [X] T018 [P] [US2] Implement the API edition render in `scripts/render-docs-api.mjs` using the pinned `packages/blue-data/typedoc.json` and Node quickstart in `packages/blue-data/README.md`. Retain the search assets and strict coverage checks, pin TypeDoc source links, and add the quickstart link without adding generated files to the npm archive.
- [X] T019 [US2] Connect both tooling outputs to `scripts/build-docs-site.mjs` as one edition. Check npm evidence before adding the first eligible pair to `docs/site/editions.json`. While publication is pending, keep both landing notices and reserve fixed edition URLs for eligible releases.
- [ ] T020 [US2] Execute the guide and Node example in a temporary directory against the exact published packages using the tagged `skills/blue-projects/assets/example.blue`. Verify valid CSD output, TypeDoc search and source links, and package tarball exclusions. Record the result in `specs/122-gh-pages-site/verification.md`. If the release is pending, document the dependency and keep this task open.

**Checkpoint**. The tooling build and validation can be tested with fixtures. Live edition acceptance requires a qualifying public release.

## Phase 5. User Story 3 — Publish updates and retire the legacy manual (P3)

**Independent test**. Rehearse a failed read-only build and a successive desktop/tooling update. Confirm the deployed artifact retains previous editions. Verify the active Blue 3 manual live, then check the updated project-controlled links before any separately authorized retirement.

- [X] T021 [P] [US3] In `scripts/docs-pages-workflow.test.mjs`, verify the permissions and event contract for `.github/workflows/docs-pages.yml`. Cover read-only PR validation, strict coverage failure, trusted branch-only deployment, protected environment, one production concurrency group, and no dependency on desktop or npm release jobs.
- [X] T022 [P] [US3] Document the Blue 3 live checks, project-controlled links, and separate retirement authorization in `docs/site/legacy-cutover.md`.
- [X] T023 [US3] Add `.github/workflows/docs-pages.yml` with read-only relevant-PR validation, a strict `pnpm --filter @blue/data docs:api` check, and an inspectable artifact. For trusted `develop` pushes or dispatches, serialize the full production run, resolve the current trusted catalog when the run starts, and upload only the complete verified artifact. Give Pages write and ID-token permissions only to the `github-pages` deployment job. Validate production retention against the last successful published inventory, with an explicit first-deploy case.
- [X] T024 [US3] Rehearse missing comments, broken links, stale queued dispatch, invalid editions, and independent desktop and tooling updates. Confirm that production deployments keep prior fixed routes and a failed run leaves the previous site available. Record the workflow and artifact evidence in `specs/122-gh-pages-site/verification.md`.
- [X] T025 [US3] Compare emitted Quarto, TypeDoc, CLI, and quickstart assets with the inventory in `docs/site/provenance.md`. Verify emitted notices and license text, record exact renderer and redistributed asset versions, and update `docs/dependency-license-inventory.md` where distribution changes. Run the local build, link, and smoke checks in `specs/122-gh-pages-site/quickstart.md` before deployment.
- [X] T026 [US3] With maintainer authorization, configure the GitHub Actions publishing source and protected environment, deploy the validated site, and smoke-test the live routes, edition labels, and documented asset/license links. Record the deployment revision and checks in `docs/site/legacy-cutover.md`.
- [ ] T027 [US3] After live verification and with maintainer authorization, update the product-site manual link and other project-controlled links that point to the old manual. Follow the published links to the active Blue 3 manual and record the results in `docs/site/legacy-cutover.md`.
- [ ] T028 [US3] After T026 and T027, obtain separate authorization for retirement of the legacy public site and `blue-manual` repository. Carry out only the separately authorized retirement and record the outcome in `docs/site/legacy-cutover.md`.

**Checkpoint**. The public Blue 3 manual and updated controlled links have live verification evidence before separately authorized retirement.

## Phase 6. Polish and Cross-Cutting Verification

- [X] T029 Run the [validation guide](quickstart.md) and record source, browser, offline, and release-independence results in `specs/122-gh-pages-site/verification.md`. Run `pnpm test:scripts`, `pnpm lint`, and `git diff --check`. After filling the evidence, verify the runtime and model package diff contains no behavior changes.
- [X] T030 Update publication and troubleshooting instructions in `docs/site/README.md` and link them from `docs/README.md`. Include how to add a catalog entry, pick a recommendation, retry from current `develop`, and link release notes to fixed editions.

## Dependencies and Execution Order

- **Setup**. T001 and T002 are independent. Both precede the foundation.
- **Foundation**. T003 defines the catalog. T004 and T005 start after T003 and can run together. T006 and T007 lead into T008.
- **US1**. T009 and T010 can start after the foundation. T011 and T012 create the first manual edition. T013 consumes the finished increment.
- **US2**. T014 and T015 can start after the foundation. T017 and T018 have separate renderers and can run together after the tooling contract is settled. T019 owns shared assembly and should follow T012. T020 requires an eligible public npm release.
- **US3**. T021 and T022 can start after the foundation. T023 needs the shared build and verification commands. T024 can use fixture tooling editions while T020 is pending. T025 gates the live deployment in T026, which precedes the controlled-link updates in T027 and separately authorized retirement in T028. Tooling release acceptance remains independent of the manual cutover.
- **Polish**. T029 consolidates live evidence after the applicable external steps. T030 can land with the workflow.

## Parallel Examples

- **US1**. Implement the browser assertions in T009 while another contributor writes the landing templates in T010.
- **US2**. Implement CLI rendering in T017 and the TypeDoc renderer in T018 in parallel, then integrate them in T019.
- **US3**. Build the workflow contract test in T021 while the maintainer prepares the cutover plan in T022.

## Implementation Strategy

Start with the documentation home and the versioned Blue 3 manual preview. Keep the installed manual usable offline. Add versioned CLI and API output and validate it independently, keeping the public pending notices until an eligible release is available. Use the protected deployment workflow for the first live site. Verify the live Blue 3 manual, update and verify the links the project controls, then retire the legacy site and repository in a separately authorized operation.
