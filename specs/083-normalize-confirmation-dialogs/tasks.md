---

description: "Actionable task list for normalizing application confirmation dialogs"
---

# Tasks: Normalize Application Confirmation Dialogs

**Input**: Design documents from `/specs/083-normalize-confirmation-dialogs/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/native-confirmation.md`, and `contracts/in-app-confirmation.md`

**Verification**: The task list includes semantic contract, runtime/IPC, UI accessibility, stale-target, regression, lint-audit, documentation, build, and quickstart verification required by the constitution and plan. Confirmation state remains transient and no `.blue`, CSD, settings, or library-format migration is planned.

**Path note**: Tasks use the live repository paths. In particular, the preload entry is `packages/blue-app/src/preload/preload.ts`, and the Code Repository/BSB/score panels use their nested paths under `packages/blue-app/src/renderer/components/workbench/panels/`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the repository-level dependency and verification entry points used by the feature.

- [x] T001 [P] Add the `typescript-eslint` development dependency and lockfile entry required by the scoped flat ESLint audit in `package.json` and `pnpm-lock.yaml`.
- [x] T002 [P] Confirm the feature test and build entry points remain covered by `packages/blue-app/vitest.config.ts`, `packages/blue-app/tsconfig.main.json`, `packages/blue-app/tsconfig.preload.json`, and `packages/blue-app/package.json` without widening the `@blue/data` or host-boundary scope.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared semantic model, verified compatibility baseline, and ownership rules before either user-story implementation begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Audit every row in `specs/083-normalize-confirmation-dialogs/research.md` against the live call sites in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/main/engine-recovery-dialog.ts`, `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/renderer/stores/library-store.ts`, and the affected renderer panels; compare the Java parity consequences in `~/work/nbprojects/blue/blue-core` and `~/work/nbprojects/blue/blue-ui-core` before changing behavior.
- [x] T004 Define the data-only serializable semantic request/result/action types and runtime validators from `specs/083-normalize-confirmation-dialogs/data-model.md` and `specs/083-normalize-confirmation-dialogs/contracts/native-confirmation.md` in `packages/blue-app/src/shared/confirmation-dialog.ts`, including unique IDs, declared default/cancel actions, bounded strings, optional checkbox rules, and safe failure outcomes.
- [x] T005 Add focused contract tests in `packages/blue-app/src/shared/confirmation-dialog.test.ts` for request validation, action uniqueness, default/cancel references, checkbox shape, transient-only state assumptions, and normalization of dismissal/failure to the declared cancel action.
- [x] T006 Create the initial durable ownership and compatibility record in `docs/confirmation-dialogs.md`, documenting main-owned native decisions, renderer-owned transient modal state, canonical project/library mutation owners, Java-affecting consequences, and the rule that confirmation state never enters `.blue` XML, generated CSD, settings, or library files.

**Checkpoint**: The semantic model, compatibility baseline, and state/persistence boundaries are explicit; User Stories 1 and 2 can proceed independently.

---

## Phase 3: User Story 1 - Confirm a host-owned operation without freezing the application (Priority: P1) 🎯 MVP

**Goal**: Move host-owned confirmations to one asynchronous, semantic native adapter that derives renderer ownership from the IPC sender, preserves each flow’s response semantics, and fails closed on dismissal, failure, or owner loss.

**Independent Test**: Exercise C1/C2 plus project replacement, settings, library-editor shutdown, import-mode, overwrite/export, and engine-recovery decisions from valid main, floating, and Settings owners. Verify semantic acceptance/cancel mappings, Escape/close cancellation, owner parenting, renderer responsiveness, stale-target protection, and no mutation on cancellation.

### Verification for User Story 1

> **Regression-first requirement**: Add or update these tests so the old response-index/owner assumptions are observable before the migration is complete.

- [x] T007 [P] [US1] Add native adapter contract regressions in `packages/blue-app/src/main/native-confirmation.test.ts` covering semantic-to-Electron button mapping, every declared default/cancel action, checkbox propagation, Escape/close/out-of-range responses, adapter rejection, destroyed/missing owners, and exactly one Electron invocation.
- [x] T008 [P] [US1] Add host-owned library regressions in `packages/blue-app/src/renderer/tests/library-store.test.ts` for linked SoundObject cut and fresh Libraries database creation, covering explicit acceptance, Cancel/Escape, owner/API failure, stale preview or confirmation-token rejection, and exactly-once mutation.

### Implementation for User Story 1

- [x] T009 [US1] Implement the main-only asynchronous native adapter in `packages/blue-app/src/main/native-confirmation.ts` with an injectable Electron dialog seam, explicit `BrowserWindow` ownership, semantic response mapping, optional checkbox results, and fail-closed `owner-unavailable`/`failed` outcomes; do not expose synchronous message-box APIs.
- [x] T010 [US1] Add the renderer-to-main boundary for native confirmations by defining the channel and API in `packages/blue-app/src/shared/confirmation-dialog.ts`, deriving `BrowserWindow.fromWebContents(event.sender)` in `packages/blue-app/src/main/main.ts`, exposing only the serializable method from `packages/blue-app/src/preload/preload.ts`, and declaring its typed result in `packages/blue-app/src/renderer/types/global.d.ts`.
- [x] T011 [US1] Migrate all decision-bearing `dialog.showMessageBox` call sites in `packages/blue-app/src/main/main.ts`—Csound warning/checkbox, render-in-progress acknowledgement, project replacement, unsaved library editors, CSD/ORC-SCO import modes, Settings close, and frozen-file overwrite—to `native-confirmation.ts`, preserving each flow’s semantic action order, default/cancel behavior, checkbox result, valid owner, and existing save/mutation boundary.
- [x] T012 [P] [US1] Route engine recovery and diagnostics decisions through the native adapter in `packages/blue-app/src/main/engine-recovery-dialog.ts`, preserving Restart/Diagnostics/Cancel semantics and the diagnostics acknowledgement, and update `packages/blue-app/src/main/engine-recovery-dialog.test.ts` for semantic outcomes and dismissal.
- [x] T013 [P] [US1] Route current/all library export review confirmations through the native adapter in `packages/blue-app/src/main/unified-library/ipc.ts`, preserving Cancel/Export and Cancel/Overwrite All order, the exact initiating owner, and the preflight preservation guarantees.
- [x] T014 [US1] Update the existing host-flow regressions in `packages/blue-app/src/main/project-replacement-flow.test.ts`, `packages/blue-app/src/main/settings-window.test.ts`, and `packages/blue-app/src/main/score-object-file-operations.test.ts` to assert semantic decisions, cancellation/dismissal safety, owner requirements, and no unsafe `undefined as BrowserWindow` fallback.
- [x] T015 [US1] Migrate C1 and C2 in `packages/blue-app/src/renderer/stores/library-store.ts` to the typed `window.blueAPI` native confirmation method, capture the preview/operation target before awaiting, revalidate it immediately before `cutLibraryToClipboard` or `createFreshLibraryDatabase`, and preserve current error/toast behavior without mutating on Cancel or failure.
- [x] T016 [US1] Extend `packages/blue-app/src/renderer/tests/library-store.test.ts` and the relevant preload/main test seams in `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts` to verify sender-derived ownership, serializable IPC payloads, renderer responsiveness while awaiting, and safe cancellation when the initiating owner disappears.

**Checkpoint**: User Story 1 is independently functional when all host-owned flows use semantic asynchronous decisions, preserve their existing outcomes, and pass the focused main/preload/library tests.

---

## Phase 4: User Story 2 - Confirm an editor-local action in a consistent accessible modal (Priority: P1)

**Goal**: Provide one composable renderer confirmation surface with safe destructive focus, accessible modal behavior, focus restoration, and at-most-once semantic decisions, then migrate existing and audited editor-local flows without moving mutations into the dialog.

**Independent Test**: Open each existing and audited renderer-local flow, accept and cancel by pointer and keyboard, verify accessible name/description, safe initial Cancel focus, Enter/Escape/backdrop behavior, Tab trapping, focus restoration, unchanged drafts/selections on cancellation, exactly-once mutation on acceptance, and stale-target rejection where previews or selections are involved.

### Verification for User Story 2

- [x] T017 [P] [US2] Add component-first regressions in `packages/blue-app/src/renderer/tests/confirmation-dialog.test.tsx` for accessible role/name/description, opener focus capture/restoration, topmost Tab and Shift+Tab trapping, Escape/backdrop cancellation, safe initial Cancel focus and Enter behavior for destructive actions, disabled actions, documented focus overrides, and the at-most-once decision guard.
- [x] T018 [P] [US2] Add editor/discard and preset-delete regressions in `packages/blue-app/src/renderer/tests/library-editing.test.tsx` and `packages/blue-app/src/renderer/tests/presets-manager-dialog.test.tsx` for draft preservation, explicit Delete wording, pointer/keyboard cancellation, and one mutation after acceptance.
- [x] T019 [P] [US2] Add rich-library and score-flow regressions in `packages/blue-app/src/renderer/tests/libraries-panel.test.tsx`, `packages/blue-app/src/renderer/tests/project-sound-object-library.test.tsx`, `packages/blue-app/src/renderer/tests/score-manager-dialog.test.tsx`, and `packages/blue-app/src/renderer/tests/score-time-canvas-cross-group.test.tsx` for preview/checkbox content, stale targets, selection preservation, Java-compatible affirmative-only mutation, and keyboard dismissal.

### Implementation for User Story 2

- [x] T020 [US2] Move the reusable focus behavior into `packages/blue-app/src/renderer/components/dialogs/use-dialog-focus.ts`, update imports in `packages/blue-app/src/renderer/components/instruments/blue-x7/algorithm-dialog.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/sysex-import-dialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/FreezeOperationDialog.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/RenderToDiskDialog.tsx`, and remove the obsolete Blue X7-local implementation in `packages/blue-app/src/renderer/components/instruments/blue-x7/use-dialog-focus.ts`.
- [x] T021 [US2] Implement `packages/blue-app/src/renderer/components/dialogs/ConfirmationDialog.tsx` as a controlled semantic-action component with accessible dialog/alert-dialog attributes, composable children, focus entry/trapping/restoration, topmost dismissal, Escape/backdrop-to-cancel behavior, safe destructive initial focus, disabled-action handling, and an internal resolved guard that calls `onDecision` at most once.
- [x] T022 [US2] Convert the existing confirmation-like surfaces into thin adopters of `ConfirmationDialog` in `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/LayerRemovalConfirmationDialog.tsx`, and `packages/blue-app/src/renderer/components/libraries/LibrarySessionDialog.tsx`, preserving library deletion previews, Save/Discard/Delete semantics, layer-removal checkbox state, and library-session multi-action outcomes while keeping mutation in the callers.
- [x] T023 [P] [US2] Migrate C3 dirty-close handling in `packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.tsx` to the shared component, preserving the draft and focus on Cancel/Escape/dismissal and closing/mutating only after the semantic discard decision.
- [x] T024 [P] [US2] Migrate C4 preset/folder deletion in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/PresetsManagerDialog.tsx` to the shared component with an explicit destructive Delete action, safe initial Cancel focus, and selection/state preservation on cancellation.
- [x] T025 [P] [US2] Replace both browser `window.prompt()` calls in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBPresetBar.tsx` with the existing local in-app name-entry pattern, including controlled draft state, validation, submit/cancel keyboard behavior, focus restoration, and no patch until a valid name is accepted.
- [x] T026 [P] [US2] Migrate C5 project SoundObject deletion in `packages/blue-app/src/renderer/components/workbench/panels/SoundObjectLibraryPanel.tsx` to the shared rich-preview confirmation, preserving linked-editor safeguards and revalidating the selected key, preview/token, and target immediately before `deleteProjectLibraryItem`.
- [x] T027 [P] [US2] Migrate C6 layer-group removal in `packages/blue-app/src/renderer/components/workbench/panels/score/ScoreManagerDialog.tsx` to the shared component, preserving explicit non-undoable copy, safe Cancel default, selected-group validation, and one `removeLayerGroup` project-document patch after acceptance.
- [x] T028 [P] [US2] Migrate C7 Object Builder conversion in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx` to the shared component, preserving the Java-documented non-undoable warning, captured score-object target validation, and the existing project-document mutation boundary.

**Checkpoint**: User Story 2 is independently functional when all renderer-local confirmation surfaces share behavior, rich content remains composable, cancellation preserves drafts/selections, and every accepted mutation runs once after validation.

---

## Phase 5: User Story 3 - Extend confirmation behavior without creating a new exception (Priority: P2)

**Goal**: Make the classification policy, audited inventory, adjacent browser-modal dispositions, lint guard, and maintainer update checklist durable and enforceable.

**Independent Test**: Run the scoped ESLint audit against production `@blue/app` TypeScript/TSX, verify disallowed browser and direct native confirmation calls fail while tests/fixtures/generated/user-authored content are excluded, inspect the complete inventory and exception rationale in `docs/confirmation-dialogs.md`, and verify Blue Share is visible but disabled with no placeholder command.

### Verification for User Story 3

- [x] T029 [P] [US3] Add the scoped flat ESLint rules in `eslint.config.mjs` to reject bare and `window`/`globalThis` `confirm`, `prompt`, and `alert` calls plus direct `dialog.showMessageBox`/`showMessageBoxSync` outside `packages/blue-app/src/main/native-confirmation.ts`, while excluding tests, fixtures, generated output, and user-authored project/example content, reporting unused disables, and requiring a rationale for any documented inline exception.
- [x] T030 [P] [US3] Wire the confirmation audit into the root lint workflow in `package.json` and `pnpm-lock.yaml` so `pnpm lint` executes the scoped ESLint configuration without enabling unrelated repository-wide style rules.

### Implementation for User Story 3

- [x] T033 [P] [US3] Add the concise maintainer pointer to `docs/confirmation-dialogs.md` in root `AGENTS.md`, preserving the stable cross-cutting guidance boundary and leaving feature-specific inventory in the durable document.
- [x] T034 [US3] Reconcile the final implementation inventory and verification commands across `specs/083-normalize-confirmation-dialogs/spec.md`, `specs/083-normalize-confirmation-dialogs/research.md`, `specs/083-normalize-confirmation-dialogs/plan.md`, `specs/083-normalize-confirmation-dialogs/quickstart.md`, and `docs/confirmation-dialogs.md`, recording any intentional exception or evidence-based reclassification in the same change.

**Checkpoint**: User Story 3 is independently functional when maintainers have one durable policy and inventory, the production audit prevents regressions, adjacent browser modal paths are resolved, and the documentation points to runnable verification.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Run the complete verification matrix and close cross-package quality checks after the desired stories are implemented.

- [x] T035 [P] Run the focused native, renderer, and affected-flow tests from `specs/083-normalize-confirmation-dialogs/quickstart.md`, including `packages/blue-app/src/main/native-confirmation.test.ts`, `packages/blue-app/src/renderer/tests/confirmation-dialog.test.tsx`, `packages/blue-app/src/renderer/tests/library-store.test.ts`, `packages/blue-app/src/renderer/tests/presets-manager-dialog.test.tsx`, `packages/blue-app/src/renderer/tests/project-sound-object-library.test.tsx`, `packages/blue-app/src/renderer/tests/score-manager-dialog.test.tsx`, and `packages/blue-app/src/renderer/tests/score-time-canvas-cross-group.test.tsx`.
- [x] T036 [P] Run `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/app build:preload`, and `pnpm --filter @blue/app build:renderer` using the TypeScript project files in `packages/blue-app/tsconfig.main.json`, `packages/blue-app/tsconfig.preload.json`, and the renderer build configuration.
- [x] T037 Run the full repository verification in `specs/083-normalize-confirmation-dialogs/quickstart.md`: `pnpm lint`, `pnpm --filter @blue/app test`, `pnpm test`, and `git diff --check`; resolve failures without changing unrelated package behavior.
- [x] T038 Perform the manual Electron smoke matrix in `specs/083-normalize-confirmation-dialogs/quickstart.md` across main/floating/Settings owners, C1-C7, stale previews, rich dialogs, import/replacement/settings/overwrite/export/recovery flows, BSB name entry, Blue Share disabled state, and focus/keyboard behavior; update `docs/confirmation-dialogs.md` if observed behavior changes the policy.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001-T002 can start immediately; they establish the lint dependency and verify the existing `@blue/app` test/build boundaries.
- **Foundational (Phase 2)**: T003-T006 depend on Setup and block all user-story implementation. T003 establishes the live and Java compatibility baseline before the shared contract and ownership record are finalized.
- **User Story 1 (Phase 3)**: T007-T016 depend on Phase 2. T007-T008 are regression-first tests; T009 precedes T010-T016; T011-T015 migrate callers only after the adapter and boundary exist.
- **User Story 2 (Phase 4)**: T017-T019 depend on Phase 2 and are regression-first. T020 precedes T021; T022-T028 depend on the shared component and can be parallelized across disjoint renderer files after T021.
- **User Story 3 (Phase 5)**: T029-T030 and T033-T034 depend on Phase 1 and should be finalized after the implementation outcomes of User Stories 1 and 2 are known. T033-T034 must reflect their final inventory.
- **Polish (Phase 6)**: T035-T038 depend on all desired user stories and are the handoff gate.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Phase 2; no dependency on User Story 2. It is the suggested MVP.
- **User Story 2 (P1)**: Depends only on Phase 2; it can proceed in parallel with User Story 1 because its renderer interaction module has a separate owner and seam. It must not import Electron or rely on native response indexes.
- **User Story 3 (P2)**: Depends on the source changes from User Stories 1 and 2 for a complete inventory and audit, although the lint configuration can be started after T001.

### Within Each User Story

- Constitution-required regression and contract tests precede their implementation where the harness supports it.
- Semantic contracts and shared behavior precede caller migrations.
- Native adapter work precedes IPC exposure and native caller migration; renderer component work precedes in-app adopters.
- Captured previews, revisions, selections, and confirmation tokens are revalidated immediately before mutation.
- Cancellation, dismissal, owner loss, adapter failure, save failure, and mutation failure never imply acceptance.
- Existing project/document/library owners remain responsible for mutations; confirmation components return semantic decisions only.

### Parallel Opportunities

- T001-T002 can run in parallel.
- After T009, T012 and T013 can run in parallel with separate native modules; T007 and T008 are independent regression files.
- T017-T019 can run in parallel because they target separate renderer test files.
- After T021, T023-T028 can run in parallel by flow/file, with T024 and T025 touching separate BSB components.
- T029 and T033 can run in parallel after their prerequisites; T033 is independent of the lint implementation.
- T035 and T036 can run in parallel; T037 remains the repository-wide final check because it includes the full lint/test pass.

## Parallel Example: User Story 1

```text
# After Phase 2 and the shared adapter contract are ready:
Task: "T012 [US1] Route engine recovery and diagnostics through packages/blue-app/src/main/engine-recovery-dialog.ts"
Task: "T013 [US1] Route library export review through packages/blue-app/src/main/unified-library/ipc.ts"
Task: "T008 [US1] Verify C1/C2 acceptance, cancellation, and stale-token safety in packages/blue-app/src/renderer/tests/library-store.test.ts"
```

## Parallel Example: User Story 2

```text
# After T021 implements ConfirmationDialog:
Task: "T023 [US2] Migrate CodeRepositoryDialog.tsx"
Task: "T024 [US2] Migrate PresetsManagerDialog.tsx"
Task: "T026 [US2] Migrate SoundObjectLibraryPanel.tsx"
Task: "T027 [US2] Migrate ScoreManagerDialog.tsx"
Task: "T028 [US2] Migrate ScoreTimeCanvas.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete T007-T016 for the native contract, owner-safe IPC, existing native flows, and C1/C2.
3. Stop and validate the independent User Story 1 test criteria from `specs/083-normalize-confirmation-dialogs/quickstart.md`.
4. Demo the non-blocking native confirmation behavior before expanding the renderer surface.

### Incremental Delivery

1. Add User Story 2 after the shared foundation; validate the accessible in-app component and each migrated renderer flow independently.
2. Add User Story 3 to enforce the production audit, remove adjacent browser-modal exceptions, and publish the durable maintainer policy.
3. Run Phase 6 after each desired story or as the final integration gate; each story must preserve the prior story’s semantic and cancellation behavior.

### Parallel Team Strategy

1. One contributor completes Phase 1-2 and the shared state/contract baseline.
2. After Phase 2, one contributor owns User Story 1 native/main/preload work while another owns User Story 2 renderer/dialog work.
3. A third contributor can prepare T029-T030 lint configuration and T033 documentation pointer, then reconcile T033-T034 after both P1 stories settle.

## Notes

- Every task uses the required `- [ ] T###` checklist form; `[P]` appears only on tasks with disjoint files and no incomplete dependency; `[US#]` appears only inside a user-story phase.
- `@blue/data` is intentionally absent from implementation paths because the feature is host/UI-owned and confirmation state is transient.
- `showErrorBox` remains outside the confirmation contract as the documented non-confirmation error surface unless implementation evidence changes its semantics.
- Any intentional exception to the production audit or focus-default rule must be recorded in `docs/confirmation-dialogs.md` with a rationale and focused verification.

## Phase 7: Convergence

- [x] T039 [US3] Remove the `show-not-yet-implemented` native-menu command path, `buildPlaceholderItem`, and `onNotYetImplemented` wiring from `packages/blue-app/src/main/application-menu.ts`, `packages/blue-app/src/main/main.ts`, and `packages/blue-app/src/renderer/stores/workbench-store.ts`; render Tools > Blue Share as `{ label: 'Blue Share', enabled: false }` and add regression coverage in `packages/blue-app/src/main/application-menu.test.ts`. (implemented; source: FR-013, plan implementation sequence 5, SC-007)
- [x] T040 [US3] Complete the scoped confirmation lint audit in `eslint.config.mjs` and its regression fixtures/tests: cover bare, `window`, and `globalThis` `confirm`/`prompt`/`alert`, both `dialog.showMessageBox` and `showMessageBoxSync` outside the adapter, report unused disable directives, and require/document rationale for inline exceptions while preserving test, fixture, generated-output, and user-content exclusions. (implemented; source: FR-003, FR-016, T029)
- [x] T041 [US1] Replace the `undefined as unknown as BrowserWindow` fallbacks in the score-object file selection/save flows in `packages/blue-app/src/main/main.ts` with valid-owner or fail-closed behavior, and extend the score-object file-operation tests to prove no file dialog opens without a valid owner. (implemented; source: FR-004, FR-011, plan native-owner policy, T014)
- [x] T042 [US1] Revalidate C1's current linked SoundObject key, preview/token, and applicable library/project revision after native confirmation and immediately before `cutLibraryToClipboard`; add stale-selection/token regression coverage so the current self-comparisons cannot pass unchanged state. (implemented; source: FR-010, FR-011, T015)
- [x] T043 [US2] Revalidate C5's current selected project SoundObject key, preview token, project session/revision, and target existence after `ConfirmationDialog` acceptance and before `deleteProjectLibraryItem`; preserve selection on stale/cancel and add regression coverage. (implemented; source: FR-010, FR-011, T026)
- [x] T044 [US2] Revalidate C6's captured layer-group target against the current score, selection, and revision before the `removeLayerGroup` patch; a stale or missing group must close/fail closed without changing selection, with regression coverage. (implemented; source: FR-010, FR-011, T027)
- [x] T045 [US1] Make C1/C2 calls to `window.blueAPI.showNativeConfirmation` handle rejected IPC/preload promises as safe Cancel/failure without throwing into the action path; add mocked-rejection tests and preserve exactly-once mutation behavior. (implemented; source: FR-011, FR-016, T008, T015, T016)
- [x] T046 [US2] Fix the no-`onCancel` `LibrarySessionDialog` variant used for missing library items so `cancelActionId` always names a rendered safe action and Escape/backdrop dismissal closes the dialog without mutating the draft; add a missing-status regression. (implemented; source: FR-006, FR-011, User Story 2 Acceptance Scenario 2, T022)
- [x] T047 [US3] Reconcile `docs/confirmation-dialogs.md` with a complete current inventory and per-flow verification links, including Csound error/render-in-progress acknowledgements, library-session conflict/missing modals, all native export/overwrite/recovery/settings/import paths, and the finalized lint-exception scope; update linked artifacts only if evidence changes them. (implemented; source: FR-014, FR-015, SC-005, SC-006, T034)
- [x] T048 [US3] Resolve dangling references to omitted Phase 5 task IDs in the dependency, parallelization, and implementation-strategy sections of `specs/083-normalize-confirmation-dialogs/tasks.md` by removing/repointing stale references; verify every referenced task ID exists exactly once. (implemented; source: tasks.md dependency/parallel/strategy sections)

## Phase 8: Closure Convergence

- [x] T049 [US2] Capture C7's project session/revision with the pending ObjectBuilder conversion target, then revalidate the current session/revision and exact target identity immediately before `applyProjectDocumentPatch`; add regression coverage proving a stale revision or replaced target fails closed. (implemented; source: FR-010, FR-011, FR-016, SC-004, T028)
- [x] T050 [US1] Remove the recovery re-import preview path that creates a fresh active library database before import acceptance; restore file selection to a non-mutating preview contract and retain the existing explicit Create Fresh confirmation as the only database-reset path. (implemented; source: FR-011, FR-012, C2, SC-001)
- [x] T051 [US3] Mark the feature complete and record final automated verification evidence in the closure documentation after all focused and repository-wide gates pass. (implemented; source: FR-014, FR-015, FR-016, SC-006, SC-007)
