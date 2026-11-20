---
description: "Implementation tasks for publishing Blue’s Node tools and agent skill"
---

# Tasks for Publishing Blue’s Node Tools and Agent Skill

**Input** — [Spec](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [contracts](contracts/), and [quickstart](quickstart.md).

**Format** — `[ID] [P?] [Story?] Description`. Tasks marked `[P]` can run alongside the indicated tasks once their prerequisites are complete. Paths are relative to the repository root.

## Phase 1 — Setup

- [X] T001 [P] Reproduce native ESM import failure and confirm CommonJS loading on Node 22 using the current output from `packages/blue-data/package.json`. Record commands, source revision, and results in `specs/121-publish-blue-tooling/verification.md`.
- [X] T002 [P] Audit the package allowlists and license scopes using `LICENSING.md`, `packages/blue-data/THIRD_PARTY_NOTICES.md`, `packages/blue-data/resources/blue-x7-modern/provenance.json`, and `packages/blue-cli/THIRD_PARTY_NOTICES.md`. Record required archive files, fixture provenance, and the skill’s GPL-3.0-or-later license in `specs/121-publish-blue-tooling/research.md`.

## Phase 2 — Foundational

- [X] T003 Implement the shared archive-verification entry point in `scripts/verify-npm-packages.mjs`. Accept the exact two archive paths per the quickstart and enable focused single-package runs for story validation. Check public name and version, and enforce “Archives contain resolvable runtime dependencies, required resources, and applicable notices.” Install from the supplied files with normal npm behavior into disposable consumers outside the checkout.
- [X] T004 Record the fixture selection and boundary checks in `specs/121-publish-blue-tooling/verification.md`. Use `fixtures/smoke-test.blue`, one accepted historical case from `packages/blue-data/src/migration/project-xml-compatibility.test.ts`, and the existing CLI Java and host scenarios. Record that the feature preserves XML and CSD semantics. The standalone caller owns sample files, migration ownership stays with existing loaders, and the release adds no desktop project-history path. Apply Java-first review before any semantic fix discovered during verification.

**Checkpoint** — The archive verifier and regression baseline support focused library and CLI work.

## Phase 3 — US1. Inspect and edit projects from Node (P1)

**Goal** — An external consumer can import the scoped data package, inspect or edit a Blue project, and verify the saved copy.

**Independent test** — Install the data archive by itself in a clean Node 22 project. Both module-loading paths round-trip the project, TypeScript resolves the declarations, and an invalid case reports diagnostics without saving.

### Verification

- [X] T005 [P] [US1] Add data archive smoke cases in `scripts/npm-smoke/data.mjs` and connect them to `scripts/verify-npm-packages.mjs`. Check native named ESM imports against CommonJS names and `BlueData` identity, strict NodeNext declarations with `.mts` and `.cts` consumers, and a browser bundle that executes the portable entry point. Use the ESM reproduction from T001 before applying the package fix.
- [X] T006 [P] [US1] Define the runnable README example in `packages/blue-data/examples/inspect-edit.mjs` using `readProjectXml` and existing model/serializer APIs. Enforce “The walkthrough writes a separate copy and reloads it.” Take native input and output paths, surface load diagnostics, update the title, and verify the reloaded title before reporting success.

### Implementation

- [X] T007 [US1] Set shared release version `0.1.0`, scoped public `publishConfig`, and the Node 22 runtime floor in `packages/blue-data/package.json`. Add the Node export condition and its declaration target while preserving the portable browser export and existing workspace test-support subpaths. Use `packages/blue-data/vite.config.mts` for explicit emitted module-format metadata where needed.
- [X] T008 [US1] Exclude compiled test files from both data build outputs via `packages/blue-data/tsconfig.esm.json` and `packages/blue-data/tsconfig.cjs.json`. Update the allowlist in `packages/blue-data/package.json` and links in `packages/blue-data/THIRD_PARTY_NOTICES.md` so the archive ships the example, BlueX7 attribution and provenance, and the applicable license texts.
- [X] T009 [P] [US1] Add behavioral TSDoc in `packages/blue-data/src/blue-data.ts`, `packages/blue-data/src/blue-data/xml-policy.ts`, and `packages/blue-data/src/time/time-position.ts` for diagnostics, save normalization, timing units, and runtime-dependent generation. Replace stale examples in `packages/blue-data/README.md` with the verified npm, Node, and browser-bundler paths. Describe supported package-root API groups and QuickJS/Java requirements.
- [X] T010 [US1] Exercise the shipped example and current, historical, and malformed inputs in `scripts/npm-smoke/data.mjs`. Verify the title change and unaffected project content. Enforce “Failed loads produce diagnostics and leave the original intact.” Check that an invalid input produces no output. Confirm inspection of supported script-bearing XML without script execution. Run the affected data build, package tests, and isolated smoke and record results in `specs/121-publish-blue-tooling/verification.md`.

## Phase 4 — US2. Compile projects from the terminal (P1)

**Goal** — A standalone npm install runs the existing CLI on plain and Java-backed projects.

**Independent test** — Install the CLI archive by itself outside the checkout. Its installed command emits both expected CSDs, and a missing Java runtime reports failure while preserving the source and existing output.

### Verification

- [X] T011 [P] [US2] Define installed-binary scenarios in `scripts/npm-smoke/cli.mjs` against `packages/blue-cli/src/cli-smoke.test.ts`, `packages/blue-cli/src/cli-host.test.ts`, and `packages/blue-cli/src/java-runtime.test.ts`. Run the npm-installed shim for disk, realtime, and Blue Live, plus conflicting-mode and same-file rejection. Include a plain project with Java unavailable, a native path with spaces and relative resources, and a Java-backed project with a generated score or orchestra marker. Assert “Compilation failure preserves any existing output.” and “The source project remains unchanged.” using a sentinel output and a nonexistent native `JAVA_HOME`.

### Implementation

- [X] T012 [P] [US2] Set version `0.1.0`, public scoped `publishConfig`, and the Node 22 runtime floor in `packages/blue-cli/package.json`. Preserve the `blue-cli` bin mapping, external QuickJS and ZeroMQ dependencies, bundled workspace code, and Java pack lifecycle.
- [X] T013 [P] [US2] Validate the inventory produced by `packages/blue-cli/scripts/build.mjs` against `packages/blue-cli/THIRD_PARTY_NOTICES.md`. Keep the JAR, Python libraries, Java sources and POM, and applicable texts and notices. Correct archive-relative attribution links where necessary and add the required CLI files to the inventory assertions in `scripts/npm-smoke/cli.mjs` after T011.
- [X] T014 [P] [US2] Update `packages/blue-cli/README.md` with scoped install and on-demand invocation, supported platforms, Node and Java requirements, compilation modes, exit and output semantics, project code execution, and CSD versus audio rendering.
- [X] T015 [US2] Connect the CLI case to `scripts/verify-npm-packages.mjs` after the data entry-point integration. Build and pack through the existing lifecycle, run the affected CLI tests and focused consumer smoke, and record archive inventory and local results in `specs/121-publish-blue-tooling/verification.md`.

## Phase 5 — US3. Install the Blue projects skill (P2)

**Goal** — The installed skill can guide an agent through the two public workflows from a clean workspace.

**Independent test** — Install the candidate skill by name into a fresh Codex workspace and complete one inspect/edit/reload and one default CLI compilation using the matching archives. Repeat against the tagged GitHub source with exact registry versions at release.

### Verification

- [X] T016 [P] [US3] Specify clean-workspace discovery and walkthrough checks in `specs/121-publish-blue-tooling/verification.md`. Include the local candidate and tagged GitHub commands from `specs/121-publish-blue-tooling/quickstart.md`, expected installed files, unchanged input, edited copy, and generated CSD assertions. Enforce “Each local reference resolves from the installed skill directory.”

### Implementation

- [X] T017 [P] [US3] Create `skills/blue-projects/SKILL.md` with matching name, a description for project inspection/editing/compilation, compatible version and prerequisites, workflow selection, and a warning that compilation can execute project scripts and external score commands. Include the license in `skills/blue-projects/LICENSE`.
- [X] T018 [P] [US3] Add the standalone Node and CLI recipes to `skills/blue-projects/references/node.md` and an original asset-free project to `skills/blue-projects/assets/example.blue`. Use the documented library exports, diagnostics and sibling-save verification, and include all CLI modes with a runnable disk example.
- [X] T019 [US3] Install the candidate from the local source using `npx skills` and complete both walkthroughs with the verified archives, following `specs/121-publish-blue-tooling/quickstart.md`. Add the public by-name install command and package documentation links to `README.md` and capture the results in `specs/121-publish-blue-tooling/verification.md`.

## Phase 6 — Polish and Cross-Cutting Release Work

- [X] T020 Define focused release-state cases in `scripts/verify-npm-release.test.mjs` for a tag/manifest or archive mismatch, missing archive, partial publish, and retry with matching or conflicting registry integrity. Assert “Both packages agree with the tagged version and source.”, “Existing matching integrity counts as published.”, and “A mismatching integrity blocks that version.”
- [X] T021 Implement the release checks in `scripts/verify-npm-release.mjs` and the build and smoke jobs in `.github/workflows/npm-release.yml`. Pack the pair once from one `npm-v<version>` commit and retain both exact archives, full revision, inventory, and SHA-512 integrity across retries. Use the same archive bytes in correctness runs on macOS arm64, Windows x64, and Linux x64, including native Windows resource paths. Run verification without registry writes for relevant pull requests and provide a verification-only release candidate run.
- [X] T022 Add the isolated publisher to `.github/workflows/npm-release.yml`. Use the protected GitHub-hosted job, trusted publishing tool versions, and `id-token: write` only in the publisher. Enforce “Publisher uses the same bytes that passed verification.” Publish with explicit public access and `next` or `latest`, checking integrity before skipping an existing version. Continue a partial release with the retained missing archive and fail on a conflicting digest. Keep desktop publication independent.
- [X] T023 [P] Document the initial 2FA bootstrap, trusted publisher setup for each package, exact archive publication, version and tag policy, verification-only invocation, recovery, and maintainer dist-tag repair in `docs/npm-release-guide.md`. Link it from `docs/release-guide.md` and update `docs/dependency-license-inventory.md` with the checked distribution boundaries.
- [X] T024 Run the full prepublication quickstart, `pnpm test`, `pnpm lint`, and `git diff --check`. Record platform and runtime versions, archived digests, smoke results, and any scoped verification exceptions in `specs/121-publish-blue-tooling/verification.md`. Leave this task open until the verified archive pair and local skill evidence are available.
- [ ] T025 For an authorized maintainer release, use `docs/npm-release-guide.md` to bootstrap both verified archives and configure each trusted publisher. Verify both public package versions, digests, and dist-tags, the scoped on-demand CLI, and the tagged GitHub skill installation with exact package versions. Record the checks in `specs/121-publish-blue-tooling/verification.md` before announcing.

## Dependencies and Execution Order

- **Setup → foundation.** T001 and T002 have separate evidence files. T003 and T004 establish the shared archive and compatibility checks.
- **Foundation → US1 and US2.** The CLI bundles workspace source. It can be tested without publishing or installing the public data package. T005 and T015 both touch the common verifier, so integrate their entry points sequentially.
- **US3 authoring → both package smokes → US3 acceptance.** T016–T018 can start after foundation. T019 needs the passing data and CLI artifacts from T010 and T015.
- **Release preparation → prepublication gate → authorized publication.** T020 precedes T021 and T022. T023 can proceed once the release design is established, alongside T020–T022. T024 depends on both package smokes, the candidate skill run, and the release workflow. T025 depends on T024 and explicit publisher authorization.

## Parallel Examples

- **US1** — T005 develops import and browser verification while T006 writes the consumer example. T009 can proceed alongside T007–T008 using the agreed API and resolved package name.
- **US2** — T011 prepares binary scenarios while T012 configures package metadata and T014 updates the README. T013 waits for the CLI smoke file from T011 before adding inventory assertions.
- **US3** — T016 prepares acceptance cases while T017 writes the skill manifest and T018 authors the reference and fixture. T019 integrates and validates them.

## Requirement Coverage

| Requirements | Verification tasks |
| --- | --- |
| FR-001 and FR-008 / SC-004 | T020–T025 cover the paired release, registry channels, immutable versions, and recovery. |
| FR-002 and FR-003 / SC-001 | T005 and T010 cover module loading, declarations, browser bundling, the Node example, and load/save behavior. |
| FR-004 and FR-005 / SC-002 | T011 and T015 cover the installed CLI, runtime behavior, and documented compilation modes. |
| FR-006 / SC-003 | T016, T019, and T025 cover candidate and tagged skill installation and both walkthroughs. |
| FR-007 / SC-004 | T003, T008, T013, T021, and T024 cover exact-archive installs and distribution inventory. |

## Implementation Strategy

1. Complete setup and foundation. Treat **US1** as the first locally demonstrable MVP and use the data-only archive acceptance check.
2. Deliver the CLI and validate its installed behavior independently. Add the skill using both verified package artifacts.
3. Run the paired release gate and complete public validation as part of the authorized maintainer release. Generated TypeDoc HTML remains follow-up work.

## Phase 7: Convergence

- [X] T026 CRITICAL — Preserve native Windows argument boundaries in `scripts/npm-smoke/cli.mjs` and `scripts/verify-npm-packages.mjs`. Replace the argument-array plus `shell: true` launches with an invocation that preserves archive, shim, input, and output paths containing spaces. Keep the smoke on the installed CLI shim and add focused regression coverage for the Windows invocation per Constitution Host-Path Portability, FR-007, SC-002, and T011/T021 (contradicts)
- [X] T027 Enforce the paired release contract in `scripts/verify-npm-release.mjs` and `scripts/verify-npm-release.test.mjs`. Reject malformed SemVer, inconsistent tag, version, prerelease flag, or dist-tag, and extra or duplicate package records. Publish only the two validated archives. Add regressions that reject malformed manifests before registry lookups or writes per FR-001, FR-008, and T020–T022 (contradicts)
- [X] T028 Keep the original verified archive pair and manifest immutable across tagged workflow reruns in `.github/workflows/npm-release.yml`. A full rerun must reuse the retained pair or stop with documented recovery instructions. Verify downloader and publisher selection of the same archive identity and update `docs/npm-release-guide.md` for recovery after a failed publisher job or expired retention per FR-008, SC-004, and T021–T023 (contradicts)
- [X] T029 Require the initial 2FA bootstrap in `docs/npm-release-guide.md` to use the exact archive pair that passed the release matrix. After the Windows invocation and retry fixes, run verification-only checks on macOS arm64, Windows x64, and Linux x64 with Node 22 and Java 17 for one retained pair. Record its source revision, digests, and passing matrix evidence in `specs/121-publish-blue-tooling/verification.md` before T025 per FR-007, SC-002, SC-004, and T024 (contradicts)
- [X] T030 Retain per-package archive file inventories with the SHA-512 evidence in `scripts/verify-npm-release.mjs` and `.github/workflows/npm-release.yml`. Verify the recorded inventory against the archives and cover that check in `scripts/verify-npm-release.test.mjs` per FR-007 and T021 (partial)

## Phase 8: Convergence

- [X] T031 CRITICAL — Preserve literal Windows paths containing percent-delimited text through the installed npm and blue-cli shims in `scripts/verify-npm-packages.mjs` and `scripts/npm-smoke/cli.mjs`. Prevent command interpreter expansion and add a native Windows regression in `scripts/verify-npm-packages.test.mjs` or the Windows consumer smoke that asserts the exact path reaches the child, including a path with spaces. Verify this as part of T029 per Constitution Host-Path Portability, FR-007, SC-002, and T026 (contradicts)
- [X] T032 Use one matrix-resolved report path for the consumer smoke writer and artifact upload in `.github/workflows/npm-release.yml`. Make a missing report fail after successful smoke verification, and add a focused workflow assertion in `scripts/verify-npm-release.test.mjs`. Confirm the three uploaded reports identify the same archive pair when collecting T029 evidence per plan: retained verification evidence, FR-007, SC-004, and T029 (contradicts)
