---

description: "Actionable task list for the validated cleanup first batch"
---

# Tasks: Validated Cleanup First Batch

**Input**: Design documents from `/specs/098-cleanup-first-batch/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cleanup-compatibility.md`, and `quickstart.md`

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested independently. The implementation is divided into four reviewable slices: behavioral cleanup, styling/dependencies, formatter setup/baseline, and enforcement/closure.

**Verification**: Compatibility, state ownership, boundary contracts, serialization, CSD, runtime, UI, packaging, cross-platform, formatter, and quickstart verification are included because they are required by the project constitution and feature plan.

## Phase 1: Setup (Shared Baseline)

**Purpose**: Establish the baseline and exact cleanup scope before changing source, configuration, or dependencies.

- [X] T001 Verify the feature branch, design artifacts, and pre-change pass/fail baseline against `specs/098-cleanup-first-batch/plan.md`, `specs/098-cleanup-first-batch/spec.md`, and `specs/098-cleanup-first-batch/quickstart.md`; run the affected package checks before edits.
- [X] T002 [P] Inventory every candidate and protected surface with `rg` across `packages/blue-app/src/renderer/`, `packages/blue-data/src/`, `scripts/`, `README.md`, and `packages/blue-data/README.md`; classify production, test, dynamic-import, export, audit, current-documentation, and historical references using `specs/098-cleanup-first-batch/contracts/cleanup-compatibility.md`.
- [X] T003 [P] Record the pre-migration renderer-entry and compatibility baseline from `packages/blue-app/vite.config.ts`, `packages/blue-data/src/test-support/java-parity-fixtures.ts`, `packages/blue-data/src/blue-data-root-compatibility.test.ts`, and `packages/blue-app/src/main/project-lifecycle.test.ts` for post-change comparison.

---

## Phase 2: Foundational (Blocking Compatibility and Boundary Checks)

**Purpose**: Confirm the canonical state owner, Java/reference baselines, and renderer/package contracts before any user-story implementation begins.

**⚠️ CRITICAL**: No user-story implementation should begin until this phase is complete.

- [X] T004 [P] Confirm that `BlueData` and `.blue` XML remain the canonical state and persistence owners, and that Electron main remains the host owner, by reviewing `packages/blue-data/src/index.ts`, `packages/blue-app/src/main/`, `packages/blue-app/src/preload/`, `packages/blue-app/src/shared/`, and `specs/098-cleanup-first-batch/contracts/cleanup-compatibility.md`; record no planned IPC, preload, engine, Java-runtime, or filesystem-boundary changes.
- [X] T005 [P] Run Java-first parity baselines against `~/work/nbprojects/blue/blue-core`, `~/work/nbprojects/blue/blue-ui-core`, `packages/blue-data/src/blue-data-csd-parity.test.ts`, `packages/blue-data/src/blue-data-csd-determinism.test.ts`, and `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts` for XML compatibility, CSD output, and unknown-data preservation.
- [X] T006 [P] Confirm the six renderer output contracts and package-input expectations from `packages/blue-app/vite.config.ts`, `scripts/verify-package-inputs.mjs`, `scripts/verify-package-inputs.test.mjs`, `.github/workflows/pr.yml`, and `.github/workflows/develop.yml` before the Tailwind migration.

**Checkpoint**: Baselines, ownership boundaries, deletion gates, and protected surfaces are understood; user stories may proceed independently.

---

## Phase 3: User Story 1 - Preserve Blue While Removing Dead Code (Priority: P1) 🎯 MVP

**Goal**: Remove only verified dead code and completed migration enforcement while preserving project data, score-object behavior, generated CSD, playback, rendering, libraries, and all protected surfaces.

**Independent Test**: Run the focused `@blue/data` and `@blue/app` checks, load representative current and legacy projects, edit/save/reopen them, compare XML and CSD output, exercise playback/render paths, and confirm the removal/protection searches in `specs/098-cleanup-first-batch/quickstart.md`.

### Verification for User Story 1

- [X] T007 [US1] Add or extend focused score-object regression coverage in `packages/blue-data/src/score/score-model-compatibility.test.ts` for property mutation, resizing, copying, and editor-observable behavior without listener subscribers; run it before and after observer cleanup.
- [X] T008 [P] [US1] Add or extend round-trip and unknown-data preservation assertions in `packages/blue-data/src/blue-data-root-compatibility.test.ts` and `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`, including legacy XML fields that may be associated with removed model classes.
- [X] T009 [P] [US1] Run the baseline CSD, playback, rendering, automation, and mixer suites in `packages/blue-data/src/blue-data-csd-parity.test.ts`, `packages/blue-data/src/blue-data-csd-automation.test.ts`, `packages/blue-app/src/main/csd-generation.test.ts`, `packages/blue-app/src/main/render-to-disk.test.ts`, and `packages/blue-app/src/main/blue-x7-automation-equivalence.test.ts` to pin preserved output.

### Implementation for User Story 1 — Behavioral Cleanup Slice

- [X] T010 [P] [US1] Delete the unwired machine-specific `test-csd.js` utility and remove any current `README.md` or `packages/blue-data/README.md` text that presents it as a supported validation path, while leaving historical `specs/` and `research/` records intact unless they instruct maintainers to use the retired workflow.
- [X] T011 [P] [US1] Delete the verified-unused score and project-panel components `packages/blue-app/src/renderer/components/workbench/panels/score/SnapGridOverlay.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ProjectTextEditorPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score/ScorePathBar.tsx` after the deletion-gate search confirms no active consumers.
- [X] T012 [P] [US1] Delete the verified-unused orchestra components `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBWidgetEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBOpcodeListEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentNameField.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/DeferredOpcodeListPanel.tsx` after the deletion-gate search confirms no active consumers.
- [X] T013 [US1] Retarget `packages/blue-app/src/renderer/tests/typography-tokens.test.ts` to remove only the `BSBWidgetEditor` source-audit assertion and retain active BSB typography checks; rerun the renderer typography audit.
- [X] T014 [US1] Remove the score-object observer contract atomically from `packages/blue-data/src/score/score-object-event.ts`, `packages/blue-data/src/score/score-object.ts`, `packages/blue-data/src/sound-objects/abstract-sound-object.ts`, `packages/blue-data/src/score/audio/audio-clip.ts`, `packages/blue-data/src/sound-objects/poly-object.ts`, and `packages/blue-data/src/index.ts`; delete the event types/export and listener state, methods, and firing while preserving unrelated constants, mutation, resizing, copying, XML, and CSD behavior.
- [X] T015 [US1] Delete `packages/blue-data/src/automation/parameter-name-manager.ts`, `packages/blue-data/src/automation/parameter-time-manager.ts`, `packages/blue-data/src/mixer/mixer-node.ts`, and `packages/blue-data/src/mixer/effect-manager.ts`; remove only their exports from `packages/blue-data/src/index.ts` and their misleading current-surface entries from `packages/blue-data/README.md`, while retaining `GeneratorRegistry` and active JMask behavior in `packages/blue-data/src/sound-objects/jmask-support.ts`.
- [X] T016 [P] [US1] Remove the completed track-runtime source scan from `scripts/verify.mjs` and the no-op `react-hooks` plugin stub from `eslint.config.mjs`, preserving every unrelated repository/release check and without presenting the removal as genuine React Hooks enforcement.
- [X] T017 [P] [US1] Run the post-cleanup reference and protection audits across `packages/blue-app/`, `packages/blue-data/`, `scripts/`, `README.md`, and `packages/blue-data/README.md`; confirm zero active removed-surface hits and confirm `packages/blue-app/src/renderer/components/workbench/panels/effects-library/EffectLibraryTree.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueX7Editor.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/next-note-badge.tsx`, and `packages/blue-data/src/sound-objects/jmask-support.ts` remain present and active.
- [X] T018 [US1] Run the focused compatibility matrix from `specs/098-cleanup-first-batch/quickstart.md`: `pnpm --filter @blue/data test`, `pnpm --filter @blue/data build`, `pnpm --filter @blue/app test`, and `pnpm --filter @blue/app build:main`; compare maintained round-trip, CSD, playback, render, automation, and mixer results with T001, T005, T007, T008, and T009.

**Checkpoint**: User Story 1 is independently complete when removed surfaces have no active references, protected surfaces remain, and compatibility tests show no project-data or generated-output drift.

---

## Phase 4: User Story 2 - Use One Supported Styling Pipeline (Priority: P2)

**Goal**: Move the renderer to the installed Tailwind CSS v4 Vite integration, remove the superseded PostCSS path and direct dependencies, and preserve styling in every renderer window and popout.

**Independent Test**: Build the production renderer, confirm all six HTML/CSS outputs exist, then smoke-test the main, settings, effect editor, track instrument editor, about, and Dockview popout windows against the pre-migration appearance and behavior.

### Verification for User Story 2

- [X] T019 [P] [US2] Capture the pre-migration CSS and renderer baseline for `packages/blue-app/src/renderer/styles/index.css` and all six inputs listed in `packages/blue-app/vite.config.ts`; verify existing package-input expectations in `scripts/verify-package-inputs.test.mjs`.
- [X] T020 [US2] Confirm the styling checklist covers theme variables, semantic typography roles, application and third-party overrides, animations, scrollbars, pseudo-elements, and Dockview popouts in `packages/blue-app/src/renderer/styles/index.css`, `packages/blue-app/src/renderer/tests/typography-tokens.test.ts`, and `specs/098-cleanup-first-batch/contracts/cleanup-compatibility.md`.

### Implementation for User Story 2 — Styling and Dependency Slice

- [X] T021 [US2] Register the installed `@tailwindcss/vite` plugin in `packages/blue-app/vite.config.ts` while preserving the React/Electron plugins, six HTML entry points, shared stylesheet imports, output paths, and renderer aliases.
- [X] T022 [P] [US2] Delete `packages/blue-app/postcss.config.mjs` and `packages/blue-app/tailwind.config.mjs` after Vite integration is active, while retaining the canonical `@import "tailwindcss"` and all application-owned CSS in `packages/blue-app/src/renderer/styles/index.css`.
- [X] T023 [US2] Remove direct `@tailwindcss/postcss`, `postcss`, `autoprefixer`, and `ajv` entries from `packages/blue-app/package.json`; regenerate the corresponding importer and package records in `pnpm-lock.yaml`, retaining direct `tailwindcss` and `@tailwindcss/vite`.
- [X] T024 [P] [US2] Verify `packages/blue-app/package.json`, `pnpm-lock.yaml`, and `packages/blue-app/vite.config.ts` contain exactly one active Tailwind integration; run `pnpm install --frozen-lockfile`, `pnpm --filter @blue/app why ajv`, and `pnpm why ajv` to confirm tool-owned transitive AJV 6/8 remains valid.
- [X] T025 [US2] Build every production renderer entry with `pnpm --filter @blue/app build:renderer` and inspect `packages/blue-app/dist/renderer/index.html`, `settings.html`, `effect-editor.html`, `track-instrument-editor.html`, `about.html`, `popout.html`, and generated CSS for retained utilities, tokens, overrides, and animations.
- [X] T026 [US2] Manually smoke-test the production main, settings, effect editor, track instrument editor, about, and Dockview popout windows using `specs/098-cleanup-first-batch/quickstart.md`; compare layout, typography, colors, interactive states, theme variables, and popup styling with T019.

**Checkpoint**: User Story 2 is independently complete when one Vite-owned Tailwind integration builds all six outputs and all required windows show no material styling or interaction regression.

---

## Phase 5: User Story 3 - Make Formatting Intentional (Priority: P3)

**Goal**: Make Prettier a bounded, documented, write/check repository workflow with an isolated baseline and no changes to excluded content.

**Independent Test**: Run `pnpm format:check` on the clean baseline, prove a malformed supported file fails and recovers, prove an excluded file is untouched, and confirm lint gates the read-only check only after the baseline passes.

### Implementation for User Story 3 — Formatter Setup and Baseline Slice

- [X] T027 [US3] Add stable explicit Prettier 3 options to `.prettierrc.json` for repository-owned source, scripts, configuration, and active documentation, aligned with the installed version declared in `package.json`.
- [X] T028 [US3] Add `.prettierignore` rules for `node_modules`, `dist`, `.worktrees`, `coverage`, `release`, generated content, fixtures, vendored assets, example projects, and `pnpm-lock.yaml`/other package-manager lockfiles, matching the supported and excluded corpus in `specs/098-cleanup-first-batch/data-model.md`.
- [X] T029 [US3] Add root `format` and `format:check` scripts to `package.json` using the bounded repository corpus and ignore policy; ensure `format` writes changes while `format:check` is read-only and exits nonzero on drift.
- [X] T030 [US3] Update the Development/Linting & Formatting section of `README.md` to document `pnpm format` and `pnpm format:check`, replacing the obsolete narrow Prettier invocation while preserving Java-first and repository-boundary guidance.
- [X] T031 [US3] Run `pnpm format` once to establish the repository baseline across the supported corpus, then isolate the resulting formatting-only diff from behavioral cleanup, styling/dependency migration, and enforcement changes in the review/commit history for `.prettierrc.json`, `.prettierignore`, `package.json`, `README.md`, and supported source paths.
- [X] T032 [US3] After the baseline passes, append `pnpm format:check` to the existing root `lint` script in `package.json`; do not add duplicate formatting jobs to `.github/workflows/pr.yml` or `.github/workflows/develop.yml`.

### Verification for User Story 3

- [X] T033 [P] [US3] Validate clean read-only behavior by running `pnpm format:check` twice and confirming no changes under `package.json`, `.prettierrc.json`, `.prettierignore`, or supported source paths; finish with `git diff --check`.
- [X] T034 [P] [US3] Validate drift detection and recovery with a temporary malformed supported file such as `packages/blue-app/src/renderer/.format-probe.ts` and a temporary excluded file under `packages/blue-data/src/fixtures/.format-probe.ts`, following `specs/098-cleanup-first-batch/quickstart.md`; confirm the supported file fails then formats and the excluded file remains unchanged, removing both probes afterward.
- [X] T035 [US3] Run `pnpm lint` plus `pnpm format:check` after enforcement, confirming no new lint failures and no writes from check mode in `package.json`, `.github/workflows/pr.yml`, or `.github/workflows/develop.yml`.

**Checkpoint**: User Story 3 is independently complete when formatting is deterministic, bounded, documented, clean on the baseline, failure-tested, and gated through the existing lint command.

---

## Phase 6: Polish and Cross-Cutting Closure

**Purpose**: Complete the full validation matrix, cross-platform checks, compatibility review, and slice-boundary review before handoff.

- [X] T036 [P] Run dependency and packaging-input verification with `pnpm install --frozen-lockfile`, `pnpm --filter @blue/app verify:package-inputs`, and `scripts/verify-package-inputs.mjs`; confirm all renderer inputs and dependency boundaries remain valid.
- [X] T037 [P] Run the full repository validation commands from `package.json`: `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm verify`, and `git diff --check`; inspect `scripts/verify.mjs` to confirm unrelated release and repository checks remain active.
- [X] T038 [P] Re-run the removed/protected reference audit and verify final output files against `specs/098-cleanup-first-batch/contracts/cleanup-compatibility.md`, `specs/098-cleanup-first-batch/quickstart.md`, `packages/blue-app/src/renderer/`, and `packages/blue-data/src/`.
- [X] T039 Review `git diff`, `git status`, and `specs/098-cleanup-first-batch/plan.md` to confirm behavioral cleanup, styling/dependencies, formatter setup/baseline, and lint enforcement remain distinct and independently revertible, with no mixed mass-formatting noise in semantic changes.
- [X] T040 Complete the deterministic quickstart and supported-platform packaging follow-up from `specs/098-cleanup-first-batch/quickstart.md`, `.github/workflows/pr.yml`, and `.github/workflows/develop.yml`; record any platform-specific failure as a scoped exception before handoff.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T003 have no implementation dependencies and establish the baseline.
- **Foundational (Phase 2)**: T004–T006 depend on the Setup baseline and block user-story implementation.
- **User Story 1 (Phase 3)**: T007–T018 depend on Phase 2. T011 and T012 may run in parallel; T014 and T015 must be serialized because both update `packages/blue-data/src/index.ts`. T018 is the story checkpoint.
- **User Story 2 (Phase 4)**: T019–T026 depend on Phase 2 and can proceed in parallel with User Story 1. T021 precedes T022–T023; T024 follows dependency regeneration; T025–T026 follow the migrated build.
- **User Story 3 (Phase 5)**: T027–T030 can begin after Phase 2. T031 must follow the semantic/styling changes that it formats so the baseline remains a separate reviewable slice; T032 follows T031; T033–T035 follow the configured baseline and enforcement.
- **Polish (Phase 6)**: T036–T040 depend on all desired user stories and their checkpoints.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational Phase 2. This is the MVP and has no dependency on US2 or US3.
- **User Story 2 (P2)**: Depends only on Foundational Phase 2. It preserves styling and build boundaries independently of behavioral cleanup.
- **User Story 3 (P3)**: Configuration can begin after Phase 2, but its repository-wide baseline is intentionally sequenced after semantic changes so formatting remains separately reviewable.

### Parallel Opportunities

- T002–T003 and T004–T006 are independent inventory/baseline checks.
- After Phase 2, US1 and US2 can be staffed independently; US3 configuration can also begin before the baseline step.
- Within US1, T008–T009 can run in parallel with T007; T011, T012, and T016 touch different files and can run in parallel after the deletion gate.
- Within US2, T019–T020 can run in parallel; after T021, T022 (config deletion) and the dependency edit T023 can run in parallel, followed by T024–T026.
- Within US3, T027–T030 touch separate configuration/documentation files and can be prepared in parallel; T033 and T034 are independent probes after the baseline.
- T036–T038 are independent final validation tracks and can run in parallel where machine resources allow.

---

## Parallel Execution Examples

### User Story 1

```text
After Phase 2, run together:
- T007: score-object mutation/resize/copy regression in packages/blue-data/src/score/score-model-compatibility.test.ts
- T008: XML round-trip and unknown-data regression in packages/blue-data/src/blue-data-root-compatibility.test.ts and packages/blue-data/src/blue-data-frozen-roundtrip.test.ts
- T009: CSD/playback/render/automation/mixer baseline across the listed package test files

After the deletion gate, run together:
- T011: delete the score/project-panel component group
- T012: delete the orchestra component group
- T016: remove scripts/verify.mjs track-runtime guard and eslint.config.mjs no-op plugin
```

### User Story 2

```text
Run together before the migration:
- T019: capture the renderer/CSS output baseline from packages/blue-app/vite.config.ts
- T020: check the styling compatibility inventory in packages/blue-app/src/renderer/styles/index.css

After T021, run together:
- T022: delete packages/blue-app/postcss.config.mjs and packages/blue-app/tailwind.config.mjs
- T023: remove superseded direct dependencies and regenerate pnpm-lock.yaml
```

### User Story 3

```text
Prepare together:
- T027: add .prettierrc.json
- T028: add .prettierignore
- T029: add format and format:check scripts in package.json
- T030: document the workflow in README.md

After T031 and T032, run together:
- T033: clean read-only check
- T034: supported/excluded temporary-file probes
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 baseline and Phase 2 boundary checks.
2. Complete US1 verification and behavioral cleanup.
3. Stop at the US1 checkpoint and run the focused compatibility matrix plus removal/protection audits.
4. Deliver the MVP only when representative project XML, CSD, playback, rendering, and protected surfaces remain unchanged.

### Incremental Delivery

1. Add US2 after the MVP to migrate Tailwind and validate all six renderer outputs/windows.
2. Add US3 configuration and documentation, then establish the formatter baseline as its own reviewable change.
3. Add lint enforcement only after the formatter baseline passes.
4. Complete Phase 6 full repository, packaging, cross-platform, whitespace, and slice-boundary validation.

### Reviewable Slice Order

1. Behavioral cleanup: T007–T018.
2. Styling and dependencies: T019–T026.
3. Formatter setup and baseline: T027–T031.
4. Enforcement and final validation: T032–T040.

## Notes

- Every implementation task names the exact source, configuration, documentation, test, generated-output, or validation path it affects.
- `[P]` marks only tasks that can proceed concurrently without sharing an incomplete file or contract.
- The four removed data models and score-object observer API are intentionally not preserved with compatibility shims; all other `@blue/data` exports and runtime boundaries remain protected.
- Do not broaden a deletion into consumer migration if the deletion-gate search discovers an active consumer; defer that target and amend the feature scope instead.

---

## Phase 7: Convergence

- [X] T041 Add explicit nested `test-fixtures`, `.agents/skills`, and `.claude/skills` exclusions to `.prettierignore`, then verify temporary files in each excluded surface remain byte-identical after `pnpm format` per FR-013 and T028 (partial)
- [X] T042 Restore fixture and skill-bundle files changed by the Prettier baseline commit to their pre-baseline bytes, retain the valid supported-corpus formatting changes, and rerun `pnpm format:check`, `pnpm lint`, `pnpm test`, and `git diff --check` per SC-005 and `contracts/cleanup-compatibility.md` (contradicts)
