---

description: "Task list for implementing resizable Sound Layer and Track heights"
---

# Tasks: Resizable Layer Heights

**Input**: Design documents from `/specs/110-resizable-layer-heights/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Verification**: This feature changes portable model data, XML serialization, document contracts,
project history, runtime classification, and docked/floating UI behavior. The tasks therefore include
automated regression, serialization, contract, runtime, UI, project-history commit→undo→redo,
cross-platform host-window, Java-compatibility, performance, usability, and quickstart validation.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested
independently after the shared foundation is complete.

## Path Conventions

- Portable model code: `packages/blue-data/src/`
- Electron document/history code: `packages/blue-app/src/main/` and `packages/blue-app/src/shared/project-editor/`
- Renderer score code: `packages/blue-app/src/renderer/components/workbench/panels/score/`
- Renderer stores and queue: `packages/blue-app/src/renderer/stores/`
- Feature validation record: `specs/110-resizable-layer-heights/quickstart.md`

## Phase 1: Setup (Shared Test Infrastructure)

**Purpose**: Establish reusable fixtures for the model, document, and browser surfaces before feature
implementation begins.

- [x] T001 [P] Build the SoundLayer/Track XML fixture matrix for legacy, custom, malformed, boundary, group-default, copy, and CSD-preservation cases in `packages/blue-data/src/score/layer-height-serialization.test.ts`.
- [x] T002 [P] Build root, opened-root, nested, cross-group, Pattern, reorder, removal, and stable-`layerSelectionId` document fixtures in `packages/blue-app/src/shared/project-editor/layer-height-patches.test.ts`.
- [x] T003 [P] Build renderer and browser fixtures for docked/floating host documents, final rows, offscreen rows, automation mode, playback/audition, pointer capture, scrolling, and 80/100/150% zoom in `packages/blue-app/src/renderer/tests/layer-height-resize.test.tsx` and `packages/blue-app/src/renderer/browser/layer-height-resize.browser.test.tsx`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish canonical model state, typed patch boundaries, structural history handling,
runtime classification, and queue fencing. No user-story implementation should begin until this
phase is complete.

- [x] T004 Implement and export a browser-safe height policy in `packages/blue-data/src/score/layer-height-policy.ts` and `packages/blue-data/src/index.ts`, including logical-pixel bounds 22–660 inclusive, fixed presets, strict integer parsing, nearest fallback-index calculation with positive midpoint ties rounding upward, and valid legacy/default fallback resolution.
- [x] T005 Implement optional `customHeight` ownership, opaque invalid-attribute preservation, effective-height lookup, explicit-height encoding, no-op representation retention, load/save behavior, and history/deep-copy propagation in `packages/blue-data/src/sound-objects/sound-layer.ts`, `packages/blue-data/src/score/track/track.ts`, `packages/blue-data/src/sound-objects/poly-object.ts`, and `packages/blue-data/src/score/track/track-layer-group.ts`; preserve the data-model constraints that `customHeight` is an integer 22–660 inclusive, malformed raw values remain verbatim until a real edit, SoundLayer legacy heights above 660 remain unchanged, and Track’s existing legacy load clamp remains intact.
- [x] T006 Extend effective-height and default-height snapshots plus existing stable identity transfer in `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/shared/project-editor/snapshot-score.ts`, and `packages/blue-app/src/shared/project-editor/identity.ts`, including `PolyObjectLayerGroupSnapshot.defaultHeightIndex`, eligible `layerSelectionId` assignment, and no preview/raw-XML/UI state crossing the document boundary.
- [x] T007 Add `LayerHeightTarget`, `setLayerHeights`, and `setLayerGroupDefaultHeight` to `packages/blue-app/src/shared/project-editor/contract.ts` and define their serializable validation contract: nonnegative in-range indices must match stable selection identities; duplicate, unreachable, reordered, Pattern, stale, or wrong-scope targets reject; numeric heights must be finite integers in 22–660; only literal `'default'` resets; default indices are 0–8 for PolyObject and 0–9 for Track; an empty update list is an accepted no-op; and the complete batch is validated before any setter runs.
- [x] T008 Implement atomic main-side application of both height patch variants in `packages/blue-app/src/shared/project-editor/patch-score.ts`, including main-owned default resolution, absolute preset/custom writes, per-target reset, effective-value no-op detection, invalid-input errors, affected-target reporting, optimistic committed-state reduction, and preservation of legacy `updateLayerState.heightIndex` behavior with custom override clearing only on a genuine height change.
- [x] T009 Register both new variants as structural in `SCORE_PATCH_PREPARATION_CLASS`, extend structural preparation/affected-target handling and cosmetic runtime classification in `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/main/project-history-memento.ts`, `packages/blue-app/src/main/project-history.ts`, and `packages/blue-app/src/main/project-runtime-reconciliation.ts`, without adding engine operations or changing global receipt semantics.
- [x] T010 Preserve captured `expectedRevision`, `operationId`, `phase: 'single'`, origin, and selection hints through queue preparation and handle invalid/stale/error receipts with authoritative refresh in `packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts`, `packages/blue-app/src/renderer/stores/project-store.ts`, `packages/blue-app/src/renderer/lib/history-scope-router.ts`, and `packages/blue-app/src/main/project-history.ts`; support same-operation retry only for an uncertain transport result and never auto-rebase an index-based height request.
- [x] T011 Invalidate and republish nested/opened score snapshots after committed height patches and undo/redo, while keeping pointer previews out of canonical reducers and IPC, in `packages/blue-app/src/shared/project-editor/snapshot-score.ts`, `packages/blue-app/src/shared/project-editor/identity.ts`, and `packages/blue-app/src/renderer/stores/project-store.ts`.
- [x] T012 [P] Add foundational regression coverage for exhaustive structural classification, cosmetic commit/replay, revision fencing, rejected receipts, operation-id reuse, and queue refresh in `packages/blue-app/src/main/project-history-patch-classification.test.ts`, `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`, `packages/blue-app/src/main/project-history-roundtrip.test.ts`, and `packages/blue-app/src/renderer/tests/project-patch-queue.test.ts`.

**Checkpoint**: The canonical model, snapshot/patch contract, history preparation, runtime classification,
queue fencing, and test fixtures are ready; all three user stories can now use the same durable edit path.

---

## Phase 3: User Story 1 - Resize Where I Am Working (Priority: P1) 🎯 MVP

**Goal**: Let a composer resize one eligible Sound Layer or Track layer from its header boundary,
see one synchronized preview in the score, cancel safely, or commit one exact undoable edit.

**Independent Test**: On a Sound Layer and a Track layer, drag the header boundary +13 from 44 to 57
during playback, verify the score rows stay aligned and musical/routing state is unchanged, then
exercise Escape/blur cancellation, save, undo, redo, and Blue Electron reopen.

### Verification for User Story 1

- [x] T013 [P] [US1] Complete serialization and copy regression coverage for single-layer custom heights, legacy absence, 57/660 encoding, tie-up fallback, malformed-attribute preservation/clearing, legacy 902-pixel SoundLayer behavior, Track clamping, unchanged unrelated XML, and unchanged CSD in `packages/blue-data/src/score/layer-height-serialization.test.ts`.
- [x] T014 [P] [US1] Add single-target patch contract tests for absolute height, main-owned default reset, root/opened/nested scope, accepted effective-value no-op, and reject-before-mutation behavior in `packages/blue-app/src/shared/project-editor/layer-height-patches.test.ts`.
- [x] T015 [P] [US1] Add one-entry commit→undo→redo tests for exact heights, raw malformed-attribute restoration, stable identities/references, selection/content, dirty/save-state transitions, canonical publication, and cosmetic runtime behavior in `packages/blue-app/src/main/project-history-layer-height.test.ts`.
- [x] T016 [P] [US1] Add shared-preview unit tests for original-height arithmetic, rounded total delta, 22–660 clamping, zero-motion legacy-height no-op, animation-frame coalescing, pointer capture, Escape/blur/scroll/zoom/path cancellation, active-preview save/undo cancellation, and submitted-commit settlement in `packages/blue-app/src/renderer/tests/layer-height-resize.test.tsx`.
- [x] T017 [P] [US1] Add browser coverage for the header-only drag handle, final-row ownership, exact header-to-score alignment, pointer leaving the window, automation/object/MIDI/audition arbitration, playback continuity, two host documents, and app zoom in `packages/blue-app/src/renderer/browser/layer-height-resize.browser.test.tsx`.

### Implementation for User Story 1

- [x] T018 [US1] Implement the shared `idle → previewing → awaitingCommit → idle` lifecycle, captured document/session/revision/scope/target fences, original-height projection, client-coordinate delta, host-window listeners, rAF coalescing, cancellation, no-op release, and final-value retention in `packages/blue-app/src/renderer/components/workbench/panels/score/useLayerHeightResize.ts`.
- [x] T019 [US1] Implement the 4-logical-pixel lower-boundary affordance with scope and height readouts, row-resize cursor, `data-` marker, keyboard reachability, accessible layer name/action/current value/limits, and deliberate pointer capture in `packages/blue-app/src/renderer/components/workbench/panels/score/LayerHeightResizeHandle.tsx`.
- [x] T020 [US1] Integrate the shared hook and handle into header row rendering, feed projected heights to all row/group geometry and hit testing, keep the final row resizable, disable scroll anchoring during preview, and exempt only marked resize targets from selection, MIDI focus, audition stop, and reorder handlers in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`.
- [x] T021 [US1] Submit one isolated `setLayerHeights` transaction on changed release, flushing earlier work and checking the captured revision/identity/order before enqueue, then await receipt/refresh through the existing save/undo settlement path with semantic labels, selection hints, and authoritative recovery for rejection or uncertain transport in `packages/blue-app/src/renderer/components/workbench/panels/score/useLayerHeightResize.ts`, `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts`, `packages/blue-app/src/renderer/stores/project-store.ts`, and `packages/blue-app/src/renderer/lib/history-scope-router.ts`.

**Checkpoint**: A single Sound Layer or Track can be resized from the header panel with synchronized
preview, exact persistence, safe cancellation, one history entry, and unchanged runtime behavior.

---

## Phase 4: User Story 2 - Resize Selected Layers Together (Priority: P2)

**Goal**: Reuse existing selection to apply one relative drag delta to eligible rows across direct
layer groups while preserving selection, grouping, offscreen rows, and all-or-nothing validation.

**Independent Test**: Select 44- and 88-unit layers in two groups, drag +13, verify 57/101 and zero
unselected changes, then test an outside-selection drag, independent limit clamping/no drift, Pattern
disablement, cancellation, stale-target rejection, and one bulk undo/redo entry.

### Verification for User Story 2

- [x] T022 [P] [US2] Add aggregate patch tests for 44/88 +13 → 57/101, cross-root reset targets, direct-group scope, selected/unselected separation, independent clamps, duplicate/missing/reordered/Pattern rejection, and atomic no-mutation failure in `packages/blue-app/src/shared/project-editor/layer-height-patches.test.ts`.
- [x] T023 [P] [US2] Add bulk history tests proving one semantic entry covers every selected target, failed commits restore all previewed rows, unselected rows and child scores remain unchanged, and undo/redo preserves identities, selection, dirty state, and cosmetic runtime behavior in `packages/blue-app/src/main/project-history-layer-height.test.ts`.
- [x] T024 [P] [US2] Add selection-preview tests for stable target capture, current-score-path filtering, original-height clamping without drift, mixed Pattern disablement, selection preservation, offscreen group members, scroll anchoring, target reorder/removal, and stale revision cancellation in `packages/blue-app/src/renderer/tests/layer-height-resize.test.tsx`.
- [x] T025 [P] [US2] Add browser coverage for 20 selected rows across groups, selected-boundary relative drag, outside-selection single-row drag, offscreen targets, Pattern explanation/disabled state, final-row hit testing, and exact alignment in `packages/blue-app/src/renderer/browser/layer-height-resize.browser.test.tsx`.

### Implementation for User Story 2

- [x] T026 [US2] Extend target resolution in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-selection-utils.ts` and `packages/blue-app/src/renderer/components/workbench/panels/score/useLayerHeightResize.ts` to capture the complete existing selection only for the current score path, preserve selection/object/MIDI state, reject unsupported Pattern members as a whole operation, and keep stable group/index/selection-identity pairs throughout the gesture.
- [x] T027 [US2] Render selected-count scope feedback and projected cumulative row boundaries consistently across root, opened-root, nested, and Track group views in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/LayerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`.
- [x] T028 [US2] Complete aggregate bulk commit construction and receipt handling for captured selected targets in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/useLayerHeightResize.ts`, and `packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts`, ensuring one operationId/history entry, no per-row queue coalescing, atomic refresh on any rejection, and no retargeting after reorder or revision change.
- [x] T029 [US2] Verify the committed bulk reducer and nested-view refresh keep unrelated arrays/content and child score paths stable after commit, undo, and redo in `packages/blue-app/src/shared/project-editor/snapshot-score.ts`, `packages/blue-app/src/renderer/stores/project-store.ts`, and `packages/blue-app/src/main/project-history-layer-height.test.ts`.

**Checkpoint**: A selected eligible set can be resized as one relative, atomic operation across
groups, while unselected and nested rows remain untouched and every failure restores authoritative state.

---

## Phase 5: User Story 3 - Return to Predictable Sizes (Priority: P2)

**Goal**: Add explicit This Layer, Selected Layers, and This Layer Group commands for fixed presets,
custom numeric entry, reset, future-layer defaults, and applying defaults to existing rows.

**Independent Test**: Apply presets and custom 57 to a single layer and selection, verify Custom/Mixed
readouts and Track-only 220, reset cross-group rows to their own defaults, edit a group default without
moving existing rows, apply it explicitly in one history step, and complete the same actions by keyboard.

### Verification for User Story 3

- [x] T030 [P] [US3] Add command-patch tests for exact absolute presets, Custom/Mixed detection, numeric 22–660 validation, Track-only 220, This Layer/Selected Layers/This Layer Group scope, per-group default reset, and invalid numeric/default rejection in `packages/blue-app/src/shared/project-editor/layer-height-patches.test.ts`.
- [x] T031 [P] [US3] Add history tests distinguishing Change Default for New Layers from Apply Default to Group, covering future-row creation, existing-row preservation, cross-group reset, semantic labels, no-op entries, and exact undo/redo in `packages/blue-app/src/main/project-history-layer-height.test.ts`.
- [x] T032 [P] [US3] Add renderer tests for scope availability, exact preset matching, Mixed/Custom readouts, strict next-higher/lower modified-wheel behavior, numeric-form validation, Enter/Escape/blur/focus return, and host-document dismissal in `packages/blue-app/src/renderer/tests/layer-height-resize.test.tsx`.
- [x] T033 [P] [US3] Add browser coverage for keyboard context-menu invocation, focusable height affordances, presets, reset, Change Default, Apply Default, numeric errors without silent clamping, two-document popup behavior, and focus restoration in `packages/blue-app/src/renderer/browser/layer-height-resize.browser.test.tsx`.

### Implementation for User Story 3

- [x] T034 [US3] Implement shared command scope/preset resolution and update modified-wheel sizing to select the nearest strictly higher/lower effective preset without legacy-index rounding, while retaining Pattern disablement and Track’s 220 option, in `packages/blue-app/src/renderer/components/workbench/panels/score/useScoreWheelZoom.ts` and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-selection-utils.ts`.
- [x] T035 [US3] Add host-aware height commands to `packages/blue-app/src/renderer/components/workbench/panels/score/LayerPanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx` for This Layer, Selected Layers, and This Layer Group, with exact 22–198 presets, type-specific choices, Set Custom Height, Reset Height to Default, Custom/Mixed readouts, explained disabled states, and target-scope feedback.
- [x] T036 [US3] Compose the existing numeric-input and dialog primitives in `packages/blue-app/src/renderer/components/workbench/panels/score/LayerPanel.tsx` so custom entry is a disposable logical-pixel form with min 22, max 660, step 1, inline rejection of empty/fractional/string/out-of-range values, Enter-to-apply, Escape/Cancel/closure discard, and focus return without browser blocking dialogs.
- [x] T037 [US3] Wire Change Default for New Layers and Apply Default to Group through `setLayerGroupDefaultHeight` and `setLayerHeights` in `packages/blue-app/src/renderer/components/workbench/panels/score/LayerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/stores/project-store.ts`, and `packages/blue-app/src/renderer/lib/history-scope-router.ts`, using host portals/dismissal and semantic labels while preserving ProgramSettings and avoiding any new default/preset store.

**Checkpoint**: Presets, custom entry, reset, wheel behavior, group defaults, keyboard access, and
host-window popup behavior are complete without changing the existing application-wide creation defaults.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Close constitution, compatibility, cross-platform, performance, usability, and release
validation obligations after the desired stories are implemented.

- [x] T038 [P] Extend existing exhaustive regression suites for new patch variants and committed/replayed cosmetic behavior in `packages/blue-app/src/main/project-history-patch-classification.test.ts`, `packages/blue-app/src/main/project-history-roundtrip.test.ts`, `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`, `packages/blue-app/src/renderer/tests/project-patch-queue.test.ts`, `packages/blue-app/src/renderer/tests/score-wheel-zoom.test.tsx`, `packages/blue-app/src/renderer/tests/score-canvas-popout-menus.test.tsx`, `packages/blue-app/src/main/score-object-nested-target.test.ts`, and `packages/blue-app/src/renderer/tests/layer-selection-utils.test.ts`.
- [x] T039 [P] Run the automated Java-readable SoundLayer/Track, malformed XML, unknown-data, fallback, and copy/serialization checks, and record the exact Java/source/build evidence plus the unverified whole-project Java GUI/CSD portions in `specs/110-resizable-layer-heights/quickstart.md`.
- [x] T040 [P] Run the automated preview/history/runtime checks and record the unverified 100-row latency, 30-second real-playback, engine-restart, and five-person discoverability measurements in `specs/110-resizable-layer-heights/quickstart.md`.
- [x] T041 [P] Run the available docked/floating host, pointer/capture, zoom-fixture, temporary-file, synthetic Windows-path, and path-boundary checks, and record the Chromium and non-macOS environment limitations in `specs/110-resizable-layer-heights/quickstart.md`.
- [x] T042 [P] Review the finished changes for browser-safe static imports, canonical main-process ownership, no preview serialization, no new IPC channel, no new sidecar/default store, semantic history labels, and no raw typography/CSS or global-window usage in `packages/blue-data/src/index.ts`, `packages/blue-data/src/score/layer-height-policy.ts`, `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/preload/`, `packages/blue-app/src/renderer/stores/project-store.ts`, and `packages/blue-app/src/renderer/components/workbench/panels/score/LayerPanel.tsx`.
- [x] T043 Run the affected package tests first, then the feature quickstart commands, `pnpm --filter @blue/data build`, `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/app build:preload`, `pnpm --filter @blue/app build:renderer`, `pnpm test`, `pnpm lint`, and `git diff --check`; record exact results and scoped environment-limited checks in `specs/110-resizable-layer-heights/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 has no implementation dependency and can start immediately.
- Phase 2 depends on Phase 1 fixtures and blocks all user-story work.
- User Story 1 depends on Phase 2 and delivers the MVP direct-drag path.
- User Story 2 depends on Phase 2 plus User Story 1’s shared resize hook/handle and projected geometry.
- User Story 3 depends on Phase 2 plus User Story 1’s host-aware handle/panel integration; it is otherwise independent of the bulk-selection rules in User Story 2.
- Phase 6 depends on every desired user story and is the final release gate.

### User Story Dependencies

```text
Phase 1 → Phase 2 → US1 (P1)
                    ├─→ US2 (P2)
                    └─→ US3 (P2)
US2 and US3 may be developed in parallel after US1 only when ownership of shared
LayerPanel/ScorePanel files is coordinated; serial delivery avoids those file conflicts.
```

### Within Each User Story

- Write the story’s verification tasks before or alongside implementation and keep them runnable independently.
- Keep models and patch contracts ahead of UI callers; keep target resolution ahead of aggregate submission.
- Keep every durable edit on the structural `ProjectHistory` route with one semantic label and focused commit→undo→redo coverage.
- Keep preview, hover, selection, popup, playback telemetry, and pointer state disposable; cancellation must restore canonical state.
- Treat invalid, stale, and uncertain receipts as distinct outcomes; refresh authoritative state before claiming rollback.

### Parallel Opportunities

- T001–T003 can run in parallel because they touch separate fixture files.
- T012 can run in parallel with final foundational implementation review once the contract symbols exist.
- T013–T017 can run in parallel because they cover separate test boundaries.
- T022–T025 can run in parallel because they cover separate bulk-selection test boundaries.
- T030–T033 can run in parallel because they cover separate command/UI test boundaries.
- T039–T042 can run in parallel after implementation; T043 is the final serialized validation task.

## Parallel Example: User Story 1

```text
After Phase 2, run these verification tasks together:
Task T013: data/XML serialization and copy regression
Task T014: single-target patch contract tests
Task T015: ProjectHistory commit→undo→redo tests
Task T016: renderer lifecycle tests
Task T017: browser surface and host-window tests
```

## Parallel Example: User Story 2

```text
After US1’s shared gesture exists, run these verification tasks together:
Task T022: aggregate patch atomicity and target validation
Task T023: bulk history and failure restoration
Task T024: selection-preview arithmetic and cancellation
Task T025: cross-group browser interaction
```

## Parallel Example: User Story 3

```text
After US1’s panel/handle integration exists, run these verification tasks together:
Task T030: command patch contract cases
Task T031: default/reset history cases
Task T032: renderer command and wheel cases
Task T033: keyboard, popup, and numeric-entry browser cases
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 fixtures.
2. Complete Phase 2 model, snapshot, patch, history, runtime, queue, and refresh foundation.
3. Complete Phase 3 User Story 1.
4. Stop and validate both drag surfaces, cancellation, persistence, undo/redo, playback continuity, and Java fallback evidence.
5. Demo or ship the direct single-layer resize increment before adding bulk commands.

### Incremental Delivery

1. Phase 1 + Phase 2 establish canonical ownership and safe durable mutation.
2. US1 delivers direct single-layer resizing as the MVP.
3. US2 adds selected-layer relative resizing with atomic all-or-nothing behavior.
4. US3 adds absolute presets, numeric entry, reset, wheel stepping, and group-default controls.
5. Phase 6 records manual evidence and runs the full repository validation gate.

### Notes

- `[P]` means the task uses separate files or a separate verification boundary and has no unfinished task dependency at the point it is scheduled.
- `[US1]`, `[US2]`, and `[US3]` map directly to the priorities and scenarios in `spec.md`.
- No task introduces a new engine operation, IPC channel, persistence store, project UUID, Java Track migration, or generic resize framework.
- The feature’s intentional Java divergence is custom-height loss on Java save-back; existing Electron TrackLayerGroup Java incompatibility remains explicitly qualified.

## Phase 7: Convergence

- [x] T044 Preserve the existing layer/object/MIDI selection when opening height context menus or invoking them from the keyboard; compute Selected Layers from the pre-existing eligible selection even when the context row is unselected, and keep This Layer bound to the context row, with multi-selection and keyboard context-menu regression coverage per `contracts/layer-height-interactions.md:9,16,29-31,42` (contradicts)
- [x] T045 Carry the captured document/session/revision and target-identity fence through drag, keyboard, numeric, preset, reset, group-default-apply, and modified-wheel height commands; submit `expectedRevision` through non-Clojure queue preparation, flush earlier height work, and reject stale requests without rebasing, with queue and renderer regression coverage per `plan.md:134-138` and `contracts/layer-height-patches.md:43-54` (contradicts)
- [x] T046 Cancel active previews on application zoom and external scroll or host-document changes, ignore score wheel height/zoom handling while previewing, and retain released preview values through canonical acknowledgement; add 80/100/150% and two-host coverage per `contracts/layer-height-interactions.md:17-20,47-53` and `plan.md:140-145` (contradicts)
- [x] T047 Handle unexpected `lostpointercapture` separately from deliberate pointerup release, cancel and recover on unexpected capture loss, and preserve the pointer/host fence through that transition with pointer-capture and window-closure tests per `contracts/layer-height-interactions.md:9,17,20` and `quickstart.md:35,50,55-56` (partial)
- [x] T048 Resolve imported group defaults through type-specific bounds before reset and new-layer creation, falling back to 22 without rewriting the invalid stored default until an explicit default edit, and add malformed-default coverage per `data-model.md:13,25,51-55` and `contracts/layer-height-patches.md:35-38` (partial)
- [x] T049 Correct height-handle accessibility and bulk feedback by using horizontal separator semantics, exposing This Layer versus selected-count scope, and rendering one host-scoped active readout for a multi-target drag instead of one badge per active row, with browser assertions per `contracts/layer-height-interactions.md:5,16,41-49` (partial)
- [x] T050 Clarify group-scope reset commands so `Reset Height to Default` and `Apply Default to Group` are not duplicate actions with the same patch and label, while retaining the explicit future-layer default command and adding scope-menu coverage per `contracts/layer-height-interactions.md:23-37` (unrequested)
- [x] T051 Run and record the automated Java-readable SoundLayer/Track, nested/default, malformed XML, unknown-data, fallback, copy, and serialization checks with the exact planning-stage Java/source/build evidence; record whole-project Java GUI/CSD comparison as unverified per `spec.md:SC-005` and `quickstart.md`.
- [x] T052 Run and record the automated preview/geometry/history/runtime checks; record the required 100-row p95, 30-second playback/restart, and machine-metadata measurements as unverified because the browser/electron performance exercise was unavailable per `spec.md:SC-004` and `quickstart.md`.
- [x] T053 Run and record available host-document, pointer/capture, zoom-fixture, and path-boundary checks; record Chromium launch failure and unavailable Windows/Linux native coverage per `tasks.md:T041` and `quickstart.md`.
- [x] T054 Record SC-006 as unverified because no participant study was run, per `spec.md:SC-006` and `quickstart.md`.

## Phase 8: Convergence

- [x] T055 [P1] Route every durable height command from the This Layer, Selected Layers, group/default context-menu actions, and modified-wheel path through one command-fence helper that flushes earlier queued patches, captures and revalidates document/session/revision/scope/target identity, and submits one labeled isolated `phase: single` operation with its captured `expectedRevision` and `operationId`; stale menu or wheel requests must cancel and refresh rather than enqueue against a changed document, with queue/renderer race coverage per `plan.md:134-138` and `contracts/layer-height-patches.md:32,43-54` (contradicts). Implemented in the shared resize hook; the focused renderer suite covers fenced commits, stale refresh, menu routing, keyboard routing, modified-wheel routing, and the prior queue revision tests remain green (57/57 focused renderer tests).
- [x] T056 [P1] Reconcile the group-scope reset contract and implementation: expose an explicit group reset affordance required by `contracts/layer-height-interactions.md:33`, while retaining the separately named `Apply Default to Group` action required by `:35`, or amend the contract to define the latter as the group reset before implementation; document the distinct target/label/history semantics and add menu/history coverage per `spec.md:FR-008,FR-009` and `plan.md:146-150` (contradicts). Added distinct group reset and apply actions, labels, and contract wording; context-menu coverage verifies both affordances and history tests cover their separate semantic operations.
- [x] T057 [P2] Align resize feedback and accessibility with the actual command scope: derive header hover text from whether the clicked row is selected and eligible, expose This Layer versus Selected Layers plus current value and bounds in the handle's accessible name/value text, and retain the clicked/dragged target for the active readout instead of assuming the first resolved target; cover header scope, score geometry, mixed-selection, legacy-height, and multi-target cases per `spec.md:FR-003,FR-006,FR-010` and `contracts/layer-height-interactions.md:16,41-45` (partial). Header handles use the clicked-row selection state; the score only consumes the shared projected geometry. Active readout and accessible text retain the clicked target/scope. Focused renderer tests cover selected/unselected scope, legacy values, bounds, and multi-target readout behavior.
- [x] T058 [P2] Re-run the feature browser suite on a functioning Chromium/Electron host and record SC-001–SC-003 evidence for exact 57px drag/keyboard entry, 20-layer selection behavior, one undo/redo, final-row and automation hit testing, keyboard/context-menu selection preservation, zoom, and two-host alignment per `spec.md:SC-001,SC-002,SC-003` and `quickstart.md` (partial). Re-run attempted on 2026-09-15, but Chrome exited with `SIGABRT` before any browser test ran; SC-001–SC-003 remain unverified.
- [x] T059 [P2] Measure and record the supported-machine presented-frame p95 for 100 visible rows and the 30-second resize-during-playback restart/interruption result, including machine metadata, per `spec.md:SC-004` and the performance procedure in `quickstart.md` (partial). No supported presented-frame/playback measurement was available; SC-004 remains unverified and is recorded as such in `quickstart.md`.
- [x] T060 [P2] Complete the whole-project Java-readable SoundLayer/nested PolyObject open/save and deterministic CSD comparison, then record Electron Track fixture format preservation and round-trip evidence without claiming Java Track support, per `spec.md:SC-005`, `plan.md:39-42`, and `quickstart.md` (partial). The automated Electron fixtures and planning-stage Java layer probe are recorded, but the whole-project Java GUI/CSD exercise was not run; SC-005 remains partial/unverified at that scope.
- [x] T061 [P3] Run and record native Windows/Linux modifier behavior plus supported cross-platform host/popup interaction checks once those environments are available, per `plan.md:152-156` and the cross-platform evidence requirements in `quickstart.md` (partial). Windows/Linux hosts were unavailable; macOS/jsdom host and synthetic-path checks are recorded, with native cross-platform behavior remaining unverified.

## Phase 9: Convergence

- [x] T062 [P1] Preserve valid legacy heights outside the 22–660 edit range when a resize delta is zero, make a no-motion gesture produce no patch/history entry, and cover legacy-height preview/commit/reversal plus keyboard/accessibility behavior per `spec.md:FR-002,FR-011,FR-012` and `contracts/layer-height-interactions.md:17` (partial). Zero-delta projection and release now preserve legacy values such as 902px; keyboard edits remain within the legal edit range while ARIA exposes the effective legacy value and bounds. Focused lifecycle and browser-surface tests cover reversal and no-op behavior.
- [x] T063 [P2] Keep the final projected height and active scope visible in the header resize handle while score geometry follows throughout `awaitingCommit` until canonical acknowledgement, including title/ARIA values and both canvas callers, per `spec.md:FR-003,FR-012` and `contracts/layer-height-patches.md:43-48` (partial). Release now publishes the final projection before awaiting the shared commit; the header handle retains active scope/value state until acknowledgement and Sound/PolyObject plus Track canvases retain the projected row geometry.
- [x] T064 [P2] Forward the originating owner `Document` from modified-wheel and keyboard/menu height commands through `commitAbsoluteHeight` into the shared command fence, and add a host-switch/popout regression case per `contracts/layer-height-interactions.md:47-49` and `plan.md:149-150` (partial). Absolute commands now carry owner documents from wheel, keyboard, custom-entry, and preset/reset menu paths; a focused popout host-switch test verifies stale-host refresh without enqueueing.

## Phase 10: Convergence

- [x] M065 [P1] Replace the newly introduced `.score-layer-header--active-selection` rule in `packages/blue-app/src/renderer/styles/index.css` with approved utility/class composition or an appropriate component-local style in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`, preserving the three-sided accent frame, the existing left accent border, and context-menu persistence; update focused selection tests as needed per `packages/blue-app/AGENTS.md` class-styling guidance and the styling behavior recorded in `walkthrough.md` (contradicts). Replaced the global selector with an inset-shadow utility in both header components; focused selection tests verify the frame and context-menu persistence.
- [x] M066 [P2] Reconcile stale header-versus-canvas resize references in the feature validation artifacts and tests: update the Phase 3 goal/independent-test wording, Phase 8/9 completion notes, `specs/110-resizable-layer-heights/quickstart.md`, and the browser suite’s T017/vertical-cursor labels to match the header-only requirement in `spec.md:FR-001`, `plan.md:140-145`, and `contracts/layer-height-interactions.md:5`; add an integration assertion that eligible headers render the resize affordance while `ScoreTimeCanvas` and `TrackLayerGroupCanvas` render none, while retaining header/score geometry-alignment coverage (contradicts). Phase 3, Phase 8/9 notes, quickstart, research/plan wording, and browser labels now distinguish the header-only gesture from score alignment; the ScorePanel integration test asserts header-only affordances and matching Sound/Track row heights.

## Phase 11: Convergence

- [x] T067 [P2] Reconcile the remaining stale resize-design wording in `specs/110-resizable-layer-heights/research.md`: change the recommended delivery from dragging both aligned boundaries to the settled header-only affordance, and update R4 to remove the obsolete hover/focus highlight-line behavior while retaining score-side geometry projection and synchronization per `spec.md:FR-001,FR-003`, `contracts/layer-height-interactions.md:5`, and M066 (contradicts). Updated the recommended delivery and R4 to describe header-only hit targets with score-side projection and no obsolete highlight-line behavior.

## Phase 12: Convergence

- [x] T068 [P2] Finish reconciling the resolved specification-stage interaction question in `specs/110-resizable-layer-heights/research.md`: replace the obsolete score-area-dragging affordance wording with the settled header-boundary hit target and score-side geometry projection, preserving the automation/clip interaction concern as a header-priority note per `spec.md:FR-001`, `contracts/layer-height-interactions.md:5`, and T067 (contradicts). Updated the interaction question to describe the header-only 4-pixel priority strip, score-side projection, and unchanged automation/clip behavior outside the strip.
