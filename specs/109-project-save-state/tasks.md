---

description: "Task list for Project Save State"
---

# Tasks: Project Save State

**Input**: Design documents from `/specs/109-project-save-state/`

**Prerequisites**: [plan.md](/Users/stevenyi/work/blue-electron/specs/109-project-save-state/plan.md), [spec.md](/Users/stevenyi/work/blue-electron/specs/109-project-save-state/spec.md), [research.md](/Users/stevenyi/work/blue-electron/specs/109-project-save-state/research.md), [data-model.md](/Users/stevenyi/work/blue-electron/specs/109-project-save-state/data-model.md), [contracts/save-state.md](/Users/stevenyi/work/blue-electron/specs/109-project-save-state/contracts/save-state.md)

**Verification**: Include regression, serialization, contract, runtime, UI, cross-platform host-path, and quickstart validation required by the constitution and plan. Save-state metadata is session-only and must not enter `.blue` XML or create a new IPC channel.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested independently after the shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase when they touch different files and have no incomplete dependency.
- **[Story]**: The user story served by the task; setup, foundational, and polish tasks omit this label.
- Every task names the concrete source, test, or validation path it changes or exercises.

## Path Conventions

- **Electron main**: `packages/blue-app/src/main/`
- **Shared contracts and formatting**: `packages/blue-app/src/shared/`
- **Renderer tests**: `packages/blue-app/src/renderer/tests/`
- **Feature validation**: `specs/109-project-save-state/`
- **Java parity references**: `~/work/nbprojects/blue/blue-core` and `~/work/nbprojects/blue/blue-ui-core`

---

## Phase 1: Setup (Feature Baseline)

**Purpose**: Confirm the existing seams and constraints before changing implementation code.

- [x] T001 [P] Baseline the save, replacement, settlement, history-publication, and window-title seams against `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/main/project-history.ts`, `packages/blue-app/src/main/project-replacement-flow.ts`, and `packages/blue-app/src/shared/window-title.ts`; keep the implementation scope aligned with the session-only, no-new-dependency decisions in `specs/109-project-save-state/plan.md`.
- [x] T002 [P] Reconfirm the intentional Java divergence by reviewing `~/work/nbprojects/blue/blue-core/blue-projects/src/main/java/blue/projects/BlueProjectManager.java` and `~/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/Installer.java`, and preserve the conditional prompt/title strings and no-XML-change decision recorded in `specs/109-project-save-state/research.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the typed state contract, authoritative query, checkpoint invariants, and compatibility evidence required by every story.

**⚠️ CRITICAL**: User-story implementation starts only after this phase is complete.

- [x] T003 [P] Define and export the serializable `ProjectSaveState` union (`'none' | 'unsaved' | 'saved' | 'modified'`) plus its runtime guard in `packages/blue-app/src/shared/project-history.ts`; keep save state main-owned, exclude it from `.blue` XML, and add no IPC channel.
- [x] T004 [P] Add shared-contract tests in `packages/blue-app/src/shared/project-history.test.ts` covering all four `ProjectSaveState` values, JSON round-trip behavior, and rejection of invalid values without changing existing history/event contract validation.
- [x] T005 Implement read-only constant-time `ProjectHistory.getSaveState()` in `packages/blue-app/src/main/project-history.ts` using the exact conditions from `specs/109-project-save-state/data-model.md`: `none` when no document, `unsaved` when the document has no `filePath`, `saved` when a path exists and `stateId === savedStateId`, and `modified` when a path exists and the IDs differ; leave `isDirty()` history-baseline semantics unchanged.
- [x] T006 Extend the state/checkpoint matrix in `packages/blue-app/src/main/project-history.test.ts` to cover none, new/unsaved, opened/saved, durable commit, undo/redo to and from the saved baseline, branch/prune, and saving before the redo tip; assert `getSaveState()` has no side effects on canonical data, history identity, cursor, or runtime reconciliation.
- [x] T007 [P] Preserve and explicitly verify lifecycle checkpoint/fence behavior in `packages/blue-app/src/main/project-lifecycle.ts` and `packages/blue-app/src/main/project-lifecycle.test.ts`: create yields `unsaved` even with a clean initial history, open yields `saved`, successful Save/Save As checkpoints the written `stateId`, close yields `none`, and a failed/cancelled operation preserves the prior path and checkpoint while async completion is fenced by `documentId`.
- [x] T008 Add serialization and compatibility regressions in `packages/blue-app/src/main/project-replacement-entry-points.test.ts` and `packages/blue-app/src/main/project-history-roundtrip.test.ts` proving existing `.blue` XML, unknown project/plugin data, identities, ordering, and references round-trip unchanged and no save-state field is serialized.

**Checkpoint**: The shared state contract, authoritative query, checkpoint rules, XML compatibility, and history/undo/redo matrix are verified; User Stories 1 and 2 can proceed in parallel.

---

## Phase 3: User Story 1 - Avoid unnecessary save prompts (Priority: P1) 🎯 MVP

**Goal**: Close and quit only prompt for a project whose authoritative state is `unsaved` or `modified`, while preserving Save / Don't Save / Cancel behavior and preventing failed saves from completing shutdown.

**Independent Test**: With one active `ProjectSession` shared by the main and floating editor windows, create, open, edit, save, undo, redo, cancel, and fail saves; close or quit after each transition and verify exactly the required prompt, successful completion, or protected-open outcome.

### Verification for User Story 1

- [x] T009 [P] [US1] Add failing reproductions in `packages/blue-app/src/main/project-replacement-flow.test.ts` for clean saved/empty projects being prompted, new projects bypassing Save As, cancelled/failed saves being treated as consent, and shutdown being triggered from a write helper; keep the regression cases red until the coordinator and main orchestration are corrected.

### Implementation for User Story 1

- [x] T010 [US1] Extend the injected save-decision seam in `packages/blue-app/src/main/project-replacement-flow.ts` to consume `ProjectSaveState`, settle editor participants before evaluation, bypass the native dialog for `none`/`saved`, preserve existing Save / Don't Save / Cancel outcomes for `unsaved`/`modified`, return explicit `saved`/`discarded`/`cancelled`/`blocked` results, and never perform application shutdown from a save or write helper.
- [x] T011 [US1] Integrate the state-aware coordinator into `confirmSaveBeforeReplace`, `closeProject`, `revertProject`, `newFile`, open/import/replacement entry points, and `requestQuit` in `packages/blue-app/src/main/main.ts`; run render/library guards first, hold one `projectHistory.runSettlementBarrier('replacement', ...)` boundary through state evaluation and the settled save/decision, and preserve accepted-target ordering.
- [x] T012 [US1] Refactor `saveCurrentProject`, `saveFileAs`, `saveFileAsInternal`, `doSave`, `writeProjectToDisk`, `requestQuit`, and `doQuit` in `packages/blue-app/src/main/main.ts` so internal save functions can run inside an existing barrier, public wrappers do not nest barriers, path/checkpoint publication remains success-only, `pendingQuit` is cleared on cancellation/failure, and write failures never call `doQuit`.
- [x] T013 [P] [US1] Complete injected coordinator tests in `packages/blue-app/src/main/project-replacement-flow.test.ts` for `none`/`saved` no-prompt paths, `unsaved`/`modified` Save As and Save paths, Don't Save, Cancel, settlement timeout/failure, write failure, and the ordering guarantee that only `requestQuit` owns the single terminal shutdown action.
- [x] T014 [P] [US1] Extend close/replacement integration coverage in `packages/blue-app/src/main/project-lifecycle.test.ts` and `packages/blue-app/src/main/project-replacement-entry-points.test.ts` for untouched new-project prompts, clean opened-project bypass, modified-project prompts, successful-save retry, Save As cancellation, failed writes, shared secondary-window drafts, per-session close behavior, stable identities, and async document-identity fencing.
- [x] T015 [P] [US1] Extend settlement/runtime coverage in `packages/blue-app/src/main/project-history-settlement.test.ts` and `packages/blue-app/src/main/global-project-history.integration.test.ts` for pending editor commits from multiple contexts, timeout-aborted close/quit, no nested barrier deadlock, commit→undo→redo runtime reconciliation, and unchanged canonical references/order after a blocked exit.

**Checkpoint**: User Story 1 is independently usable when clean projects close/quit without prompts, required decisions preserve existing choices, and every cancel/failure leaves the project open and protected.

---

## Phase 4: User Story 2 - See project state in the window title (Priority: P2)

**Goal**: Show the exact saved, never-saved, or modified marker in the Blue window title and refresh it in the same publication turn as the corresponding state change.

**Independent Test**: Move a project through none, new, saved, edited, undo-to-save-point, redo-away, Save As, and close states and compare every observed title with `contracts/save-state.md`, including Unicode, punctuation, `.blue` extension, and synthetic POSIX/Windows display paths.

### Verification for User Story 2

- [x] T016 [P] [US2] Add the title-format matrix in the new `packages/blue-app/src/shared/window-title.test.ts` before implementation, covering `Blue`, `Blue - New Project - [UNSAVED PROJECT]`, `Blue - {file basename}`, and `Blue - {file basename} - [modified]`, plus preserved extensions, Unicode/punctuation, both slash forms, and display-only POSIX/Windows path handling.

### Implementation for User Story 2

- [x] T017 [US2] Extend `getWindowTitle` in `packages/blue-app/src/shared/window-title.ts` to accept `ProjectSaveState` and emit the exact contract strings: `none → Blue`, `unsaved → Blue - New Project - [UNSAVED PROJECT]`, `saved → Blue - {file basename}`, and `modified → Blue - {file basename} - [modified]`; preserve the existing basename extraction and never normalize a native filesystem path for identity.
- [x] T018 [US2] Update `updateWindowTitle`, initial `BrowserWindow` creation, lifecycle publication, history mutation publication, checkpoint publication, project replacement/close, and active-project transitions in `packages/blue-app/src/main/main.ts` to use `projectHistory.getSaveState()` and refresh without waiting for a reopen; leave specialized floating-editor purpose titles unchanged.
- [x] T019 [P] [US2] Update the existing title assertions and renderer-facing shared formatter coverage in `packages/blue-app/src/renderer/tests/app.test.ts` to pass the explicit save state and assert the three specified project formats without changing renderer-local draft, selection, playback, or layout state.

**Checkpoint**: User Story 2 is independently usable when native and shared title observations match the exact state matrix after creation, load, edit, undo, redo, save, Save As, failure/cancel, and close.

---

## Phase 5: User Story 3 - Keep one consistent save-state answer (Priority: P3)

**Goal**: Ensure close protection and title display are two consumers of the same main-owned query, with no independent dirty flag, persistence, IPC, or runtime behavior introduced.

**Independent Test**: Run the complete state-transition matrix and assert that the prompt decision, title marker, `ProjectHistory` state, renderer history projection, XML, document identity, and runtime reconciliation agree at every step, including cancellation, failure, branch/prune, and save-before-redo-tip cases.

### Verification and Integration for User Story 3

- [x] T020 [P] [US3] Audit and update every save-prompt/title call site in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/shared/window-title.ts`, and `packages/blue-app/src/renderer/tests/app.test.ts` so all durable save decisions use `ProjectHistory.getSaveState()`, renderer `isDirty` remains a projection rather than an authority, and no new IPC or `.blue` field is added.
- [x] T021 [P] [US3] Add the cross-consumer transition matrix in new `packages/blue-app/src/main/project-save-state.integration.test.ts` using `ProjectSession`, `ProjectHistory`, the title formatter, and the injected confirmation flow to prove title and close behavior agree for create/open/edit/save/undo/redo/Save As/cancel/failure/branch/prune and save-before-redo-tip transitions.
- [x] T022 [P] [US3] Extend `packages/blue-app/src/main/ipc/project-document-ipc.test.ts`, `packages/blue-app/src/main/project-history-roundtrip.test.ts`, and `packages/blue-app/src/main/global-project-history.integration.test.ts` to verify existing typed document/history events, renderer dirty projections, runtime outcomes, serialization, stable identities/references/order, and transient selection/playback/preview activity remain unchanged.

**Checkpoint**: All stories are complete when the title, close/quit guard, history state, renderer projections, XML, and runtime reconciliation agree without introducing another state owner.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Run the constitution-required validation and record deterministic desktop evidence.

- [x] T023 [P] Run the affected Vitest suites for `packages/blue-app/src/main/project-history.test.ts`, `packages/blue-app/src/main/project-lifecycle.test.ts`, `packages/blue-app/src/main/project-replacement-flow.test.ts`, `packages/blue-app/src/main/project-replacement-entry-points.test.ts`, `packages/blue-app/src/main/project-history-settlement.test.ts`, `packages/blue-app/src/shared/window-title.test.ts`, and `packages/blue-app/src/renderer/tests/app.test.ts`; resolve failures without weakening the state or shutdown assertions.
- [x] T024 [P] Run the main and preload type/build checks from the repository root with `pnpm --filter @blue/app build:main` and `pnpm --filter @blue/app build:preload`, confirming strict TypeScript boundaries and no accidental `@blue/data` or host-runtime dependency changes in `packages/blue-app/`.
- [x] T025 [P] Run the repository-wide validation commands `pnpm test`, `pnpm lint`, and `git diff --check` from `/Users/stevenyi/work/blue-electron`; fix cross-package regressions and whitespace errors before handoff.
- [x] T026 [P] Execute every automated command and transition scenario in `specs/109-project-save-state/quickstart.md`, including failed-write injection, settlement timeout, async identity fencing, existing `.blue` fixtures, and synthetic Windows/POSIX title paths; record results and any scoped exception in that quickstart file.
- [x] T027 Perform the desktop smoke scenarios from `specs/109-project-save-state/quickstart.md` with the built Blue app: untouched new project, saved/modified undo-redo cycle, Save As cancellation, failed-save protection, buffered drafts in a floating editor, clean app-menu/native close gestures, Don't Save, playback/selection non-modification, and title after close; record platform and native-chrome results in `specs/109-project-save-state/quickstart.md`.
- [x] T028 Review the final implementation against `specs/109-project-save-state/spec.md`, `specs/109-project-save-state/plan.md`, `specs/109-project-save-state/contracts/save-state.md`, `specs/109-project-save-state/data-model.md`, `.specify/memory/constitution.md`, and the Java references in `~/work/nbprojects/blue/`; confirm no new dependency, persistence store, IPC channel, XML field, unexplained divergence, or non-undoable project mutation was introduced.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 and T002 can run immediately and in parallel.
- **Foundational (Phase 2)**: Depends on Phase 1. T003, T004, T005, and T008 establish the contract/query/compatibility baseline; T006 and T007 validate the resulting checkpoint behavior. This phase blocks all stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2. T009 is the failing reproduction; T010 must define the coordinator before T011/T012 integrate it. T013–T015 verify the complete P1 flow.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and can proceed in parallel with User Story 1. T016 is the title regression matrix; T017 precedes T018/T019.
- **User Story 3 (Phase 5)**: Depends on the shared foundation and the P1/P2 consumer seams. T020 can begin once the call sites are known; T021/T022 complete cross-consumer verification.
- **Polish (Phase 6)**: Depends on all desired stories being implemented and their checkpoints passing.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2; no dependency on User Story 2.
- **User Story 2 (P2)**: Can start after Phase 2; no dependency on User Story 1 for the formatter matrix, though its main refresh wiring shares the history publication seam.
- **User Story 3 (P3)**: Integrates the completed P1 confirmation consumer and P2 title consumer; it is intentionally last so the consistency matrix exercises the real consumers.

### Within Each User Story

- Add or update the regression harness before behavior implementation when the existing seam supports reproducing the failure (T009 and T016).
- Keep `ProjectHistory.getSaveState()` read-only and constant-time; do not replace or reinterpret existing `isDirty()` semantics.
- Settle buffered editor changes before evaluating save state and keep one settlement boundary through the decision, internal save, and terminal action.
- Preserve success-only path/checkpoint publication and fence async save completion with `documentId`/`stateId`.
- Keep project mutations on the existing history path; this feature adds no new durable mutation and no undo/redo entry.
- Models/contracts precede consumers, consumers precede integration, and each story must pass its independent test criteria before the next priority is accepted.

### Parallel Opportunities

- **After setup**: T003, T004, T005, and T008 can be prepared in parallel where their file boundaries permit; T006 follows T005, and T007 follows the checkpoint contract.
- **User Story 1**: T014 and T015 can run in parallel after T011/T012 because they touch different test files; T013 is independent once T010 is available.
- **User Story 2**: T016, T017, and T019 can be prepared in parallel at the contract level; T018 integrates the formatter after T017.
- **User Story 3**: T020 and T022 can run in parallel; T021 consumes the shared seams once the audit is complete.
- **Polish**: T023–T026 are independent validation jobs and can run concurrently when the workspace and desktop fixture allow it; T027 requires a built app and T028 follows the validation results.

---

## Parallel Example: User Story 1

```text
After T010 is available, run these verification tracks in parallel:

Task T013: Complete injected save-decision outcome/order tests in packages/blue-app/src/main/project-replacement-flow.test.ts
Task T014: Exercise lifecycle/replacement close protection in packages/blue-app/src/main/project-lifecycle.test.ts and packages/blue-app/src/main/project-replacement-entry-points.test.ts
Task T015: Exercise settlement, timeout, multi-context, and runtime reconciliation in packages/blue-app/src/main/project-history-settlement.test.ts and packages/blue-app/src/main/global-project-history.integration.test.ts
```

## Parallel Example: User Story 2

```text
Prepare the formatter contract and consumer assertions in parallel:

Task T016: Build the exact title matrix in packages/blue-app/src/shared/window-title.test.ts
Task T017: Implement state-aware title formatting in packages/blue-app/src/shared/window-title.ts
Task T019: Update renderer-facing title assertions in packages/blue-app/src/renderer/tests/app.test.ts

Then run Task T018 to wire publication-time refreshes in packages/blue-app/src/main/main.ts.
```

## Parallel Example: User Story 3

```text
After the P1/P2 checkpoints, run these independent audits together:

Task T020: Audit the single authoritative consumer path in packages/blue-app/src/main/main.ts and packages/blue-app/src/renderer/tests/app.test.ts
Task T022: Verify IPC, serialization, runtime, and identity regressions in packages/blue-app/src/main/ipc/project-document-ipc.test.ts, packages/blue-app/src/main/project-history-roundtrip.test.ts, and packages/blue-app/src/main/global-project-history.integration.test.ts

Then run Task T021 to execute the full title-versus-confirmation transition matrix.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2, including the read-only `ProjectHistory.getSaveState()` query and checkpoint/compatibility tests.
2. Complete Phase 3: User Story 1, starting with the failing close/quit regressions.
3. **STOP and VALIDATE**: Run T013–T015 and the affected package tests; verify clean close, required prompts, cancellation, failed-save protection, settlement, and runtime reconciliation.
4. Demo or ship the prompt-protection increment only after the quickstart's P1 scenarios pass.

### Incremental Delivery

1. Foundation ready → deliver User Story 1 as the prompt-protection MVP.
2. Add User Story 2 → deliver exact title markers and publication-time updates.
3. Add User Story 3 → prove both consumers remain consistent across the full history/save matrix.
4. Run Phase 6 before release, including native desktop smoke validation on available supported platforms.

### Parallel Team Strategy

1. One developer completes the shared contract/query and checkpoint foundation.
2. After Phase 2, one developer owns P1 confirmation/quit orchestration while another owns P2 title formatting/refreshes.
3. A verification owner prepares P3 cross-consumer and compatibility/runtime tests as the P1/P2 seams stabilize.

---

## Notes

- `[P]` means different files and no incomplete dependency; it does not authorize concurrent edits to the same file.
- `[US1]`, `[US2]`, and `[US3]` map directly to the priorities and scenarios in `specs/109-project-save-state/spec.md`.
- Save-state metadata is derived session state; it is not a project mutation, history entry, XML field, renderer authority, or new IPC payload.
- Java reference behavior is used to validate the intentional divergence: conditional prompts and the three requested title strings take precedence while `.blue` compatibility remains unchanged.

---

## Phase 7: Convergence

**Purpose**: Close the remaining gaps identified by cross-artifact and implementation convergence review.

- [x] T029 Close the terminal-transition ordering gap by keeping one settlement barrier active from editor settlement and save-state evaluation through the library guard, Save/Save As, and the terminal close/quit/replacement action; use internal save helpers without nested public barriers, preserve accepted-target ordering, and add focused ordering tests in `packages/blue-app/src/main/project-replacement-flow.ts`, `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/main/project-history-settlement.test.ts`, and `packages/blue-app/src/main/project-replacement-entry-points.test.ts` per plan: settlement/terminal ordering, FR-010, and FR-011 (partial).
- [x] T030 Run the nine manual desktop smoke scenarios for native close/quit gestures, dialog choices, floating-editor drafts, title presentation, and clean shutdown on macOS and, where available, Windows/Linux; record platform results or an owner-approved scoped exception in `specs/109-project-save-state/quickstart.md` per plan: desktop smoke validation, SC-002, and SC-005 (partial).
