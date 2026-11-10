---
description: "Task list for feature implementation"
---

# Tasks: Fix Implicit State Machine Failures

**Status**: Complete | **Completed**: 2026-11-09

**Acceptance decision**: The owner reported successful manual testing and explicitly accepted native acceptance for closeout. T031, T044, T053, T056, T058 and T060 are closed by that decision together with the recorded automated and macOS evidence. The remaining macOS scenario coverage and unavailable Windows/Linux native runs are accepted validation limitations, not executed checks. Original task descriptions below preserve the requested scope; [quickstart.md](quickstart.md#completion-and-owner-acceptance--2026-11-09) records the final decision and results.

**Input**: Design documents from specs/119-fix-implicit-state-machines/

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Verification**: Keep functional regression, history, runtime, UI, and manual host-window validation in ordinary correctness work. No new speed acceptance gate is planned. Run commands and platform acceptance from specs/119-fix-implicit-state-machines/quickstart.md.

**Organization**: Tasks are grouped by the four prioritized user stories. Each story has an independent test criterion. No new package, persistence schema, or shared cross-story initialization is needed, so Setup and Foundational phases have no implementation tasks.

## Phase 1: Setup

**Purpose**: Project and package structure already exist; the plan adds no dependencies or generated project scaffolding.

No setup task is required.

---

## Phase 2: Foundational

**Purpose**: Existing typed project-history, Java runtime, renderer, and test boundaries are the shared foundation. Changes can proceed within their user-story phase without a cross-story prerequisite.

No blocking foundational task is required.

---

## Phase 3: User Story 1 - Use dialogs and editor keys without triggering transport (Priority: P1)

**Goal**: A key handled by a modal, popup, editor, or control does not also invoke a workspace action, while unclaimed workspace shortcuts remain available.

**Independent Test**: With playback both active and stopped, exercise modal buttons and checkboxes, a late dialog Escape listener, handled editor/tree Space, popup events, non-modal help, ordinary toolbar Space, idle Escape, and existing text/repeat exclusions. Confirm exactly one intended action and no unintended transport change.

### Verification for User Story 1

- [x] T001 [P] [US1] Add shortcut regressions for modal controls, late Escape handling, already-prevented events, popup ancestry, handled editor/tree Space, non-modal help, toolbar Space, and existing text/repeat exclusions in packages/blue-app/src/renderer/tests/app.test.ts.

### Implementation for User Story 1

- [x] T002 [US1] Update the workspace shortcut boundary to honor event ownership and active modals in the event target's host document while preserving existing mappings and exclusions in packages/blue-app/src/renderer/hooks/use-keyboard-shortcuts.ts.

**Checkpoint**: User Story 1 passes its independent shortcut test without changing native accelerator or popout-global routing.

---

## Phase 4: User Story 2 - Complete or cancel an edit in its hosting window (Priority: P1)

**Goal**: Every listed gesture receives host-window input and ends once; local previews stay local, live edits settle or roll back through canonical history, and layout cancellation restores its existing owner.

**Independent Test**: For every gesture family in specs/119-fix-implicit-state-machines/spec.md, test release outside the canvas, Escape, focus loss, and editor/target invalidation in docked and floated windows. Verify one-action Undo/Redo, clean and already-dirty cancellation, redo preservation, no stale movement or scrolling after termination, and the specified BSB/layout focus policy.

### Verification for User Story 2

- [x] T003 [P] [US2] Add direct two-document listener, matching-removal, capture-Escape, pointer-cancel, synchronous-disposal, and exactly-once terminal tests for the host gesture lifetime in packages/blue-app/src/renderer/tests/host-gesture.test.ts.
- [x] T004 [P] [US2] Add main and renderer history regressions for unchanged and metadata-only end, net-zero live release, cancellation with an existing redo branch, dirty-state restoration, the 200-action limit, byte-budget rejection, and settlement receipts in packages/blue-app/src/main/project-history.test.ts, packages/blue-app/src/main/project-history-settlement.test.ts, packages/blue-app/src/renderer/tests/history-scope-router.test.tsx, and packages/blue-app/src/renderer/tests/project-patch-queue.test.ts.
- [x] T005 [P] [US2] Add score/audio preview regressions proving move and resize leave the shared score and dirty state unchanged until commit, preserve cross-group projection, and clear stale projections on cancellation or target replacement in packages/blue-app/src/renderer/tests/score-selection-store.test.ts, packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx, and packages/blue-app/src/renderer/tests/score-layer-selection.test.tsx.
- [x] T006 [P] [US2] Add local-draft and terminal regressions for PianoRoll movement, resize, marquee autoscroll, field editing, line insertion/movement, and JMask insertion/movement in packages/blue-app/src/renderer/tests/pianoroll-parity.test.ts, packages/blue-app/src/renderer/tests/line-object-editor-parity.test.tsx, packages/blue-app/src/renderer/tests/editable-line-canvas-popover.test.tsx, and packages/blue-app/src/renderer/tests/jmask-editor-contract.test.tsx.
- [x] T007 [P] [US2] Add cancel/Undo/Redo regressions for press-time marker and point insertion, ruler and tempo drags, automation range drafts, and concrete automation runtime inverse/forward payloads in packages/blue-app/src/renderer/tests/markers-bar.test.tsx, packages/blue-app/src/renderer/tests/tempo-line-view.test.tsx, packages/blue-app/src/renderer/tests/score-timeline-automation-popout.test.tsx, and packages/blue-app/src/main/score-automation-runtime-sync.test.ts.
- [x] T008 [P] [US2] Add host-blur, Escape, multi-widget baseline, split-pane persistence, and arrangement-column restoration regressions in packages/blue-app/src/renderer/tests/bsb-undo-regression.test.tsx, packages/blue-app/src/renderer/tests/orchestra-split-pane.test.tsx, and packages/blue-app/src/renderer/tests/arrangement-panel-popout.test.tsx.

### Implementation for User Story 2

- [x] T009 [P] [US2] Add the narrow host listener/disposer API for active-window movement, release, capture-phase owned Escape, blur, pointer cancellation, matching listener removal, and one terminal callback, with no store/history/geometry imports, in packages/blue-app/src/renderer/lib/host-gesture.ts.
- [x] T010 [P] [US2] Correct matching history-group end/cancel and net-zero handling; retain one shared-reference active rollback checkpoint for canonical content, dirty state, redo availability, and entries otherwise evicted; account unique retained bytes before mutation/growth while keeping the 200-action ledger limit in packages/blue-app/src/main/project-history.ts and packages/blue-app/src/main/project-history-memento.ts.
- [x] T011 [US2] Add a renderer terminal operation that flushes prior patches, revalidates document/session and gesture authority, submits the existing empty-patch history commit envelope, and waits for canonical receipt/reconciliation without changing FIFO queue behavior in packages/blue-app/src/renderer/lib/history-scope-router.ts and packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts.
- [x] T012 [US2] Extend structural inverse generation to retain each affected automation parameter's original setAutomationPoints and resolution payload, preserve the earliest grouped baseline, and send final forward values on Redo in packages/blue-app/src/main/project-history.ts.
- [x] T013 [US2] Add an identity-fenced transient score/audio gesture projection and compose it with canonical groups and layer-height previews; use it for timeline move/resize and background selection, then commit each changed multi-target gesture once without preview writes to shared score or dirty state in packages/blue-app/src/renderer/stores/score-selection-store.ts, packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx.
- [x] T014 [P] [US2] Adopt the host gesture lifecycle for pattern painting, PianoRoll note and field gestures; retain local drafts, commit only changed final values, clear scheduled work before settlement, and stop edge autoscroll on every terminal path in packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/PatternsLayerGroupCanvas.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/NoteCanvasMouseListener.ts, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/PianoRollCanvas.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/FieldEditor.tsx.
- [x] T015 [US2] After T014 terminal behavior is covered, replace mode-dependent PianoRoll gesture fields with a discriminated internal state, retain pointer coordinates for both movement and selection, and keep autoscroll resource ownership separate while preserving the listener façade in packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/NoteCanvasMouseListener.ts.
- [x] T016 [P] [US2] Keep line and JMask insert/move changes in local drafts and publish one final labeled edit through existing owning callbacks; preserve line constraints and stable target identity without threading live-history metadata through JMask adapters in packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/LineObjectEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/ZakLineObjectEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/SoundEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBLineObjectWidget.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/TableEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/ParameterRow.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/JMaskEditor.tsx.
- [x] T017 [P] [US2] Convert marker, ruler, tempo, and automation point edits to one labeled live history group including press-time insertion; carry gesture metadata and originating host through their existing owners, keep range previews local, and finish changed or unchanged releases exactly once in packages/blue-app/src/renderer/components/workbench/panels/score/MarkersBar.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/useScoreRulerSelection.ts, packages/blue-app/src/renderer/components/workbench/panels/score/TempoLineView.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/ColumnHeader.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerOverlay.tsx, and packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx.
- [x] T018 [P] [US2] Register BSB host listeners and history settlement only during an active widget drag; settle on blur/closure and make Escape restore all optimistic widget baselines before one cancel terminal, including before and after queue flush, in packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/WidgetWrapper.tsx and packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBLineObjectWidget.tsx.
- [x] T019 [P] [US2] Make split-pane size/ratio previews local and persist once only on successful release; cancel pending saves and restore baseline styles/size, and restore arrangement column widths without adding persistence in packages/blue-app/src/renderer/components/workbench/panels/orchestra/SplitPane.tsx and packages/blue-app/src/renderer/components/workbench/panels/orchestra/ArrangementPanel.tsx.

**Checkpoint**: Every gesture family is independently releasable/cancellable and its durable project changes reconcile through the canonical history owner.

---

## Phase 5: User Story 3 - Recover and close Java helper sessions safely (Priority: P1)

**Goal**: Java readiness has one ordered owner, compatible requests reuse successful readiness, and invalidated startup or cleanup cannot revive or damage a newer session.

**Independent Test**: Use deferred probe, reservation, spawn, connect, health, and initialization stages; dispose during each stage; issue three competing readiness requests and same-key requests; verify cleanup, readiness publication, retry, native directory handling, and stale callback isolation.

### Verification for User Story 3

- [x] T020 [P] [US3] Add deferred probe/reservation/spawn-adoption/connect/health/init, three-request ordering, same-key reuse, failed dependency retry, stale result, and disposal regressions in packages/blue-app/src/main/java-runtime/java-runtime-session.test.ts; include native path builders and synthetic Windows directory/dependency fixtures.
- [x] T021 [P] [US3] Add explicit disconnect queue invalidation, no implicit socket recreation, stale-generation isolation after reconnect, and ordinary transport recovery regressions in packages/blue-app/src/main/java-runtime/java-runtime-client.test.ts.
- [x] T022 [P] [US3] Add process termination tests for signal delivery without exit, exit during grace, forced-exit confirmation, kill/signal failure, and bounded timeout outcomes in packages/blue-app/src/main/java-runtime/java-runtime-process.test.ts.

### Implementation for User Story 3

- [x] T023 [P] [US3] Serialize readiness with one recovered promise tail; snapshot request session, native directory, dependencies, and epoch before waiting; separate owned process from active readiness; fence every async boundary and reinitialization; preserve failed dependency knowledge; and register spawned handles before client work in packages/blue-app/src/main/java-runtime/java-runtime-session.ts.
- [x] T024 [P] [US3] Make explicit disconnect invalidate queued operations and prevent old work or stale failure handlers from recreating or closing a newly reconnected socket while keeping ordinary transport recovery retryable in packages/blue-app/src/main/java-runtime/java-runtime-client.ts.
- [x] T025 [US3] Add cancellation checks after port reservation and immediately before spawn, synchronously report spawned handles through onSpawned, and return confirmed exited/not-started/failed termination results using a two-second graceful allowance and one-second force-exit confirmation in packages/blue-app/src/main/java-runtime/java-runtime-process.ts.
- [x] T026 [US3] Verify and, if needed, narrowly update application shutdown handling so a failed or unconfirmed Java helper termination is not reported as clean disposal in packages/blue-app/src/main/main.ts and packages/blue-app/src/main/startup-lifecycle.test.ts.

**Checkpoint**: Competing requests complete in invocation order, stale work cannot publish readiness, and disposal reports only confirmed cleanup.

---

## Phase 6: User Story 4 - Read consistent playback and audition state (Priority: P2)

**Goal**: Transport phase, playing/audition indication, clock, and Follow Score behavior remain coherent across starts, partial status, stop, and terminal outcomes.

**Independent Test**: Exercise normal and audition starts with both confirmation orders, early clocks, partial status updates, stop during preparation and after confirmation, stale replies/clocks, failure, and saved follow restoration.

### Verification for User Story 4

- [x] T027 [P] [US4] Add playback regressions for transition projection, compatibility setPlaying, partial mode/anchor updates, both confirmation orders, early/retired clocks, stop confirmation, terminal display reset, stable idle references, and once-only Follow Score behavior in packages/blue-app/src/renderer/tests/playback-store.test.ts and packages/blue-app/src/renderer/tests/score-follow-playback.test.tsx.

### Implementation for User Story 4

- [x] T028 [US4] Add the internal playback lifecycle transition/projection pair while retaining existing store fields/actions; atomically project compatibility flags, preserve clock/display and saved preferences outside lifecycle state, fence local replies by attempt identity, and keep display ticks from recreating lifecycle state in packages/blue-app/src/renderer/stores/playback-store.ts.

**Checkpoint**: Existing playback and Follow Score consumers retain their façade while every start, stop, and terminal path has a coherent projection.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Keep architecture, compatibility, provenance, and validation evidence aligned with the implemented boundaries.

- [x] T029 [P] Add links from the lifecycle/gesture review guidance to the implemented feature contracts and name the retained owner boundaries without introducing a generic state-machine framework in docs/modularization.md.
- [x] T030 [P] Reconcile implementation changes with the Java revision, compatibility, and license/provenance assessment; record any actual divergence or incorporated material and confirm no project/resource/settings serialization or dependency change in specs/119-fix-implicit-state-machines/research.md and specs/119-fix-implicit-state-machines/plan.md.
- [x] T031 Run the focused and package/workspace validation commands in specs/119-fix-implicit-state-machines/quickstart.md, complete docked/floated acceptance on macOS, Windows, and Linux, and record revision plus scenario outcomes there; keep speed measurements opt-in and separate.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No tasks; the repository and package structure already exist.
- Foundational (Phase 2): No blocking tasks; current typed boundaries are sufficient to start the independent story work.
- User Stories (Phases 3-6): Stories have no implementation dependency on one another and can proceed after their own verification tasks.
- Polish (Phase 7): Depends on the desired user stories being complete.

### User Story Dependencies

- User Story 1 (P1): Independent; its shortcut regression precedes the hook change.
- User Story 2 (P1): Independent of the other stories; host helper and history terminal support precede their consumers. Within this story, T009 precedes T013, T014, T016, T018, and T019; T010 precedes T011 and T012; T011 precedes live-gesture integrations; T013 precedes T017; T014 precedes T015.
- User Story 3 (P1): Independent of other stories; session/client test tasks can run in parallel. T023 and T024 can proceed in parallel after verification; T025 follows the session factory contract in T023; T026 follows termination behavior.
- User Story 4 (P2): Independent of the other stories; verification T027 precedes store implementation T028.

### Within Each User Story

- Add focused regression coverage before implementation; reproduce failures before fixing them when the harness supports it.
- Keep durable editor changes on the canonical ProjectHistory/document bridge and provide commit-Undo-Redo plus dirty-state and identity coverage where applicable.
- Keep local previews, selection, transport telemetry, and layout/session state out of project history.
- Preserve Java musical/editor semantics and runtime/reply contracts recorded in research.md and the contract files.
- Preserve native filesystem paths in host APIs; use native builders and synthetic Windows cases for path-sensitive runtime work.
- No XML/resource migration or external source incorporation is planned. Reassess the compatibility and provenance record if implementation scope changes.

### Parallel Opportunities

- T003-T008 are independent verification files and can be authored in parallel.
- T009 and T010 are separate host-listener and main-history foundations and can proceed in parallel.
- After T009-T012, T014 can proceed alongside T013; T016, T018, and T019 touch separate owners once their listed prerequisites are complete.
- T020-T022 are independent runtime verification tasks. T023 and T024 touch separate implementation files and can proceed in parallel; T025 follows T023.
- T027/T028 remain test-first and sequential. US1 implementation remains test-first and sequential.
- US1 and US4 have no useful same-story implementation parallelism because each centers on one public behavior boundary.

### Parallel Example: User Story 1

Complete T001 shortcut regressions first, then implement T002 in the hook. No same-story code tasks are independent because both target the same shortcut boundary.

### Parallel Example: User Story 2

Run T003-T008 as independent regression work. After the host/history foundations, split implementation by owner: one contributor handles T013 score projections, another T014/T015 pattern and PianoRoll behavior, another T016 line/JMask drafts, and another T018/T019 BSB/layout behavior. T017 follows T013 because it extends the score canvas callback owners.

### Parallel Example: User Story 3

Run T020, T021, and T022 together. After those regressions are in place, implement T023 session ordering and T024 client disconnect behavior in parallel; implement T025 process cancellation/exit confirmation after T023 defines the ownership handoff.

### Parallel Example: User Story 4

Complete T027 before T028. The store projection is one boundary, so there is no same-story implementation split.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete the shortcut regressions and shortcut boundary fix in T001-T002.
2. Validate User Story 1 independently using the focused shortcut command in quickstart.md.
3. Stop at the US1 checkpoint if an incremental MVP is needed.

### Incremental Delivery

1. Complete US1 for shortcut containment.
2. Complete US2 for gesture and history reliability.
3. Complete US3 for Java helper readiness and cleanup.
4. Complete US4 for playback lifecycle consistency.
5. Complete the cross-cutting architecture, compatibility, provenance, and platform validation.

### Notes

- [P] marks work in distinct files with no dependency on incomplete tasks.
- [US1]-[US4] labels map to user stories in spec.md.
- Keep the project patch queue FIFO/revision/barrier behavior; do not replace it with a general gesture or state-machine framework.
- Existing history, Java protocol, store, and callback façades remain stable unless a task explicitly names a private integration seam.


## Phase 8: Convergence

- [x] T032 CRITICAL [F1] Preserve active-group and checkpoint authority when an obsolete or unmatched end/cancel arrives in packages/blue-app/src/main/project-history.ts; match the owning gesture/context before closing or rolling back anything. Reproduce begin B → stale cancel/end A → cancel B and verify B still restores its baseline without altering unrelated work in packages/blue-app/src/main/project-history.test.ts per Constitution III, FR-007, FR-011, and plan: matching history terminals (contradicts).
- [x] T033 CRITICAL [F2] Correct net-zero finalization in packages/blue-app/src/main/project-history.ts using the actual committed final document and the active entry identity rather than an eviction-sensitive cursor comparison. Cover structural changes returning to baseline on the changed end patch, empty terminal envelopes at the retained-entry limit, restoration of the exact prior ledger/redo/dirty state, and canonical publication to renderer participants in packages/blue-app/src/main/project-history.test.ts and packages/blue-app/src/renderer/tests/history-scope-router.test.tsx; current probes leave one dirty action for add/remove-marker end and grow a three-entry ledger to four with a phantom redo entry per Constitution III, FR-006, SC-003, and T010 (contradicts).
- [x] T034 CRITICAL [F3] Accumulate concrete grouped automation inverses for every affected parameter and member in packages/blue-app/src/main/project-history.ts while preserving each earliest baseline; retaining top.inversePatches alone currently loses later parameters and resolution changes. Verify actual baseline point/resolution payloads on cancel and Undo plus final forward payloads on Redo for a compound gesture in packages/blue-app/src/main/project-history.test.ts and packages/blue-app/src/main/score-automation-runtime-sync.test.ts per Constitution III, FR-006–FR-008, and T012 (partial).
- [x] T035 CRITICAL [F4] Fence active gesture movement, draft publication, and final commit by captured document/session and stable source/target identity across the in-scope score canvases, MarkersBar.tsx, TempoLineView.tsx, AutomationLayerOverlay.tsx, PianoRollEditor.tsx, shared/line-editor/EditableLineCanvas.tsx, and score-object/editors/jmask/TableEditor.tsx under packages/blue-app/src/renderer/components/workbench/panels/. Invalidate obsolete work on project replacement, target removal/reordering, or same-editor target replacement without cancelling unrelated revisions; enforce the same identity in packages/blue-app/src/renderer/stores/score-selection-store.ts. Add focused replacement/removal tests proving old movement or release cannot edit a new project or target per Constitution III, FR-005, FR-007, FR-011, and plan: press-time identity fencing (partial).
- [x] T036 CRITICAL [F5] Extend the existing canonical-history test harness to cover the changed gesture writers whose current tests only inspect callback payloads or legacy local snapshots, including PianoRoll, line/JMask drafts, marker insertion/movement, ruler ranges, and tempo dragging. Exercise the actual document queue and terminal integration in packages/blue-app/src/renderer/tests/ and packages/blue-app/src/main/project-history-roundtrip.test.ts as appropriate; assert one semantic action, commit→Undo→Redo content and stable identities, clean/already-dirty cancellation, redo preservation, and applicable runtime reconciliation per Constitution III, Constitution V, FR-006–FR-008, SC-003, and T004–T007 (partial).
- [x] T037 HIGH [F6] Account for all unique retained rollback-checkpoint data and the fully merged candidate history record before admission or growth in packages/blue-app/src/main/project-history.ts and packages/blue-app/src/main/project-history-memento.ts. The current counter sums ledger/redo/evicted entries but omits activeCheckpoint.beforeData, and candidate growth is estimated before record merging. Add large-baseline/small-edit and cumulative-growth regressions that reject or cancel safely without exceeding the byte budget or losing rollback, while retaining small-gesture behavior at the 200-action limit per plan: bounded shared-reference rollback checkpoint and T010 (partial).
- [x] T038 HIGH [F7] Register command settlement for each active project gesture in the in-scope score canvases, pattern painting, PianoRoll/field, line/JMask, timing, and automation owners under packages/blue-app/src/renderer/components/workbench/panels/. Return actual queue/history completion, revoke input before awaiting, and route project/history commands through that settlement in packages/blue-app/src/renderer/lib/history-scope-router.ts; cover Undo and a competing project edit during both local previews and live groups, including delayed receipts and unchanged final values, without changing FIFO/revision/barrier semantics per FR-011, US2/AC9, plan: gesture settlement receipts, and T011 (partial).
- [x] T039 HIGH [F8] Complete terminal resource cleanup in packages/blue-app/src/renderer/lib/host-gesture.ts and its consumers: deliver pointer cancellation to mouse-backed gestures, apply BSB cancellation rather than leaving its drag active, and handle host teardown according to the existing per-family policy. On editor closure, discard local previews and clear shared score/audio projections in ScoreTimeCanvas.tsx and TrackLayerGroupCanvas.tsx, while settling already-applied marker/ruler/tempo/automation groups instead of only detaching listeners. Add pointer-cancel, unmount, and host-closure tests proving no stale preview, history group, movement, or scrolling remains per FR-005, FR-010, FR-011, US2/AC9, and T009/T013/T017/T018 (partial).
- [x] T040 HIGH [F9] Resolve the host document/window from the pressed SVG in packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx instead of passing host values captured by a useCallback that omits those values from its dependencies. Add an already-mounted docked→floated adoption regression with release outside the SVG and Escape/blur in the new host, proving main-window events cannot drive the gesture per FR-004, US2/AC1, SC-002, and T016 (partial).
- [x] T041 HIGH [F10] Retain each Java helper and its in-flight termination promise until confirmed exit in packages/blue-app/src/main/java-runtime/java-runtime-session.ts. Make dispose await cleanup already started by replacement, transport failure, or startup failure; retain failed handles for a real cleanup retry, and prevent a later empty disposal from clearing the failure and allowing a conflicting helper. Add deferred replacement-cleanup/disposal and failed-termination retry regressions in packages/blue-app/src/main/java-runtime/java-runtime-session.test.ts; current probes show disposal succeeding before replacement termination resolves and subsequently forgetting a still-running failed handle per FR-017, FR-018, SC-004, plan: owned process cleanup, and T023 (partial).
- [x] T042 HIGH [F11] Reject playback clocks in idle as well as stopped/error in packages/blue-app/src/renderer/stores/playback-store.ts while retaining valid early clocks during starting. Add idle-before-first-clock and ended-performance-with-no-previous-clock regressions in packages/blue-app/src/renderer/tests/playback-store.test.ts; the current idle guard accepts a new session ID and restores a live engine-authority display per FR-021, FR-022, US4/AC5, and T027/T028 (partial).
- [x] T043 HIGH [F12] Revoke undispatched normal/fresh/audition start work when Stop is requested while patch flushing is pending in packages/blue-app/src/renderer/stores/playback-store.ts. Require current starting authority before sending start IPC rather than accepting the same attempt in stopping, and retain the separate handling for a start already dispatched. Add deferred-flush Stop regressions for all three start actions in packages/blue-app/src/renderer/tests/playback-store.test.ts; the current audition probe records stopPlayback followed by auditionScoreObjects after the flush resolves per FR-020, US4/AC1, plan: local attempt fencing, and T027/T028 (partial).
- [x] T044 HIGH [F13] Complete the remaining validation promised by T031 and record revision/environment plus actual outcomes in specs/119-fix-implicit-state-machines/quickstart.md. Add the planned ordinary browser regressions for already-mounted host adoption and gesture event ordering under packages/blue-app/src/renderer/browser/, run the focused/package/workspace tests, type checks, lint and main/preload builds, and obtain the docked/floated gesture and native Java termination acceptance on macOS, Windows, and Linux. Keep unavailable platform checks explicitly pending; the current quickstart contains only planning-baseline results and no completed platform matrix per SC-002, SC-004, plan: validation and target platforms, and T031 (partial).
- [x] T045 MEDIUM [F14] Implement the planned internal pure playback transition function alongside projectPlaybackLifecycle in packages/blue-app/src/renderer/stores/playback-store.ts (or an adjacent pure module), and route lifecycle actions through that transition/projection pair while retaining the public store facade. Keep independently owned preferences, telemetry, display cadence, and clock authority outside it; add transition-table coverage in packages/blue-app/src/renderer/tests/playback-store.test.ts without introducing a framework per plan: P3 playback lifecycle transition/projection pair, FR-024, and T028 (missing).


## Phase 9: Convergence

- [x] T046 CRITICAL [F15] Restrict rollback checkpoints to active live groups in packages/blue-app/src/main/project-history.ts; a completed phase single with a gestureId must not create or retain cancellation authority for a later gesture. Add a regression in packages/blue-app/src/main/project-history.test.ts for completed single A → begin B → cancel B, verifying A's content, identities, dirty state, ledger and Undo/Redo remain intact, plus coverage for consecutive single actions and the byte budget. The current probe retained a checkpoint after single A and cancelling B erased A's completed author edit while leaving its history entry per Constitution III, FR-006, FR-007, SC-003, and T010/T033/T037 (contradicts).
- [x] T047 CRITICAL [F16] Complete the oversize live-group rollback path in packages/blue-app/src/main/project-history.ts by publishing the restored canonical snapshot, dirty/history state and revision to participants and reconciling concrete inverse runtime payloads before reporting rollback completion. Fence the oversize proposal against the restored revision and prevent obsolete gesture updates from reviving the cancelled group. Extend packages/blue-app/src/main/project-history.test.ts, packages/blue-app/src/main/score-automation-runtime-sync.test.ts and the renderer queue/history integration tests with an admitted live edit followed by rejected growth; the current probe restored main's title to baseline but emitted only the original live publication and runtime call per Constitution III, FR-005, FR-008, SC-003, and T037 (partial).
- [x] T048 CRITICAL [F17] Route all PianoRoll field-lane input and terminal paths through the same current document/session/target authority check in packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/FieldEditor.tsx. Invalidate the draft and detach listeners when targetKey or its edited source changes; the local onMouseUp={endDrag} currently bypasses the guarded host callback and commits through the newly rendered target's onCommitFieldEdit. Audit the analogous local release shortcut in PianoRollCanvas.tsx and add mounted-editor regressions covering A→B replacement, project replacement, source removal, local-surface release and outside release without overwriting unrelated edits per Constitution III, FR-005, FR-011, US2/AC9, and T035 (contradicts).
- [x] T049 HIGH [F18] Route actual automation point-circle presses through the same begin-gesture owner as overlay hit-tested presses in packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerOverlay.tsx and AutomationLineView.tsx. handlePointMouseDown currently stops propagation and only sets dragState, omitting host listeners, identity capture, live history metadata and settlement; the visible point therefore cannot move or cancel normally. Add tests pressing the rendered circle itself, including outside release, Escape during playback, blur, target invalidation and canonical one-action Undo/Redo in packages/blue-app/src/renderer/tests/score-timeline-automation-popout.test.tsx and the canonical integration harness per FR-004–FR-010, US2/AC1/2/6, SC-002/003, and T017 (partial).
- [x] T050 HIGH [F19] Revoke automation input synchronously before awaiting command settlement in packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerOverlay.tsx: capture the owned final draft/live-group identity, unregister settlement, dispose host listeners and scheduled work, and clear active authority before flushing or awaiting finishProjectGesture. Revalidate captured ownership before publishing a local preview, and prevent a delayed completion from clearing a newer gesture. Add deferred-receipt regressions proving movement/release/Escape cannot append edits while settling and idle Escape reaches transport afterward; current probes add a movement patch during the await and consume Escape after settlement completes per FR-005, FR-009, FR-011, plan: synchronous terminal revocation, and T038/T039 (partial).
- [x] T051 HIGH [F20] Distinguish genuine Java spawn failure from signal-delivery or other errors after a process exists in packages/blue-app/src/main/java-runtime/java-runtime-process.ts. The creation listener currently records every child error as spawnError, so terminateJavaRuntimeProcess can return not-started for a running PID that reports EPERM while being killed; require evidence of failure to start or confirmed exit before reporting successful cleanup. Add event-emitting process tests for a running helper's asynchronous kill error, no subsequent exit, bounded escalation and manager ownership retention in packages/blue-app/src/main/java-runtime/java-runtime-process.test.ts and java-runtime-session.test.ts per FR-017, FR-018, SC-004, and T022/T025/T041 (partial).
- [x] T052 HIGH [F21] Preserve existing mode, transport anchor, attempt identity and once-applied Follow state when partial starting statuses describe an already-active/internal playback restart in packages/blue-app/src/renderer/stores/playback-store.ts; reserve fresh-session reset behavior for an explicit new start. Add reducer/store regressions for playing audition → starting without optional fields and suspended normal playback → internal starting/playing, verifying the former retains its audition anchor and the latter does not re-enable Follow or change saved preferences. Current probes change audition/anchor 42 to normal/anchor 0 and change suspended Follow from false to true per FR-021, FR-023, US4/AC3/6, SC-005, and T027/T028/T045 (partial).
- [x] T053 HIGH [F13, remaining native acceptance] Finish the still-pending native portion of T031/T044 and record actual scenario outcomes plus revision/environment in specs/119-fix-implicit-state-machines/quickstart.md: observe docked→floated gestures and real helper startup/disposal/confirmed termination on macOS, Windows and Linux. Retain the already-recorded automated evidence, explicitly keep unavailable native checks pending, and rerun the ordinary host-adoption browser suite after the relevant fixes on a host where Chrome launches; this convergence attempt terminated during Chrome launch before test results. A passing DOM/browser or fake-process suite does not close native acceptance per SC-002, SC-004, plan: target-platform acceptance, and T031/T044 (partial).


## Phase 10: Convergence

- [x] T054 CRITICAL [F23] Fence Blue Synth Builder widget moves and resizes by their captured project document/session, instrument owner and stable widget identities in packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/WidgetWrapper.tsx and its existing owning adapters. Validate that authority before animation-frame work, movement, release, Escape/blur settlement and unmount cleanup; replacement/removal must discard obsolete work rather than replaying captured values into another project or instrument with reused widget IDs. Extend packages/blue-app/src/renderer/tests/bsb-undo-regression.test.tsx with mounted-editor project replacement and instrument/widget removal or replacement, covering pending frames and already-flushed live edits for both move and resize. A current mounted-wrapper probe began a move in session 1, replaced the session while retaining the widget ID, and emitted begin/end position patches in session 2 on release per Constitution III, FR-005, FR-007, FR-011, US2/AC9, and plan: press-time project/target authority (contradicts).
- [x] T055 CRITICAL [F24] Give each newly admitted live group its own rollback checkpoint when it supersedes another live group in packages/blue-app/src/main/project-history.ts. Settle/discard the former group's authority and compute the new group's baseline, retained-entry restoration and byte admission consistently before applying the new mutation, while leaving obsolete terminal requests inert. Add competing-group regressions in packages/blue-app/src/main/project-history.test.ts for begin A → begin B → cancel B at both a small retained-entry limit and the ordinary 200-action limit; verify the exact pre-B ledger, content, identities, dirty state, subsequent Undo/Redo and applicable runtime payloads. The current three-entry probe had [Old 1, Old 2, A] before B but only [Old 2, A] after cancelling B because baseline capture was skipped while A's checkpoint existed and that checkpoint was discarded later per Constitution III, FR-006, FR-007, FR-011, SC-003, and T010/T033/T037 (partial).
- [x] T056 HIGH [F13, outstanding native acceptance] Complete the remaining native scenarios tracked by T031/T044/T053 and record revision/environment and observed outcomes in specs/119-fix-implicit-state-machines/quickstart.md: docked→floated gesture acceptance on macOS and native gesture/helper lifecycle acceptance on Windows and Linux. Preserve the recorded passing browser rerun and real macOS Java startup/reuse/disposal evidence; those completed portions no longer need to be repeated solely because earlier task descriptions mentioned them. Keep unavailable checks explicitly pending until the required desktop or runner becomes available, without treating DOM/browser/fake-process results as native acceptance per SC-002, SC-004, plan: target-platform acceptance, and T031/T044/T053 (partial).


## Phase 11: Convergence

- [x] T057 CRITICAL [F25] Reconcile the restored runtime baseline before completing net-zero live-gesture finalization in packages/blue-app/src/main/project-history.ts. Preserve concrete baseline inverse patches before removing the active history entry, retain canonical publication and clean/dirty/redo restoration, and await reconciliation rather than completing the terminal receipt while the engine still holds an intermediate value. Add focused automated coverage in packages/blue-app/src/main/project-history.test.ts for automation changing from 1 to 5 and returning to 1 on a changed end patch, including delayed runtime acknowledgement and the empty-terminal path after a prior return-to-baseline update. The current probe leaves zero history actions and canonical value 1 but sends the runtime only the intermediate value 5 per Constitution III, FR-006–FR-008, SC-003, and plan: canonical/runtime gesture restoration (partial).
- [x] T058 HIGH [F13, outstanding native acceptance] Complete available native acceptance remaining from T031/T044/T053/T056 and record observed outcomes in specs/119-fix-implicit-state-machines/quickstart.md. Preserve the passing browser and real macOS Java evidence; native docked/floated desktop gestures and Windows/Linux native scenarios require actual available desktops/runners and must remain explicitly pending when unavailable. Do not claim a clean convergence result from unit/browser evidence alone per SC-002, SC-004, and plan: target-platform acceptance (partial).

## Phase 12: Convergence

- [x] T059 HIGH [F26] Diagnose and resolve the blank native Orchestra popout that prevents mounted BSB and layout gestures from being exercised after floating. Inspect the existing workbench popout transition and affected Orchestra/BSB host adapters; reproduce the root cause before choosing a surgical fix, add focused regression coverage where practical, and retry native mounted-editor float acceptance. The macOS development instance displayed a blank popout twice despite an accessible Orchestra subtree; native resizing and clicks did not recover it, while closing the popout returned usable content to the main workspace. Record environmental causes or acceptance limitations explicitly if no product defect is established per FR-004, US2/AC1, SC-002, and plan: already-mounted host adoption (partial).


## Phase 13: Convergence

- [x] T060 HIGH [F27, remaining acceptance coverage] Complete and accurately report the native acceptance matrix in specs/119-fix-implicit-state-machines/quickstart.md per SC-002, SC-004, US2/AC1–10, plan: target-platform acceptance, and T031/T044/T053/T056/T058 (partial). Preserve the verified T059 tooltip fix and recorded macOS Score/Tempo/Ruler/BSB-move/layout results. Map all eleven gesture families and their applicable release, Escape, focus-loss, cancellation/history, invalidation and autoscroll scenarios to observed docked and already-mounted-then-floated outcomes; complete the still-unrecorded macOS cases, including audio clips, pattern painting, background marquee, PianoRoll notes/marquee/field pins, shared line/JMask points, automation, markers and BSB resizing, rather than treating a subset as whole-platform acceptance. Correct the current macOS Passed and solely Windows/Linux pending statements to match that matrix until the remaining macOS observations exist. Keep Windows/Linux native gesture and helper acceptance explicitly pending until actual desktops/runners are available; unit/browser or fake-process success cannot substitute for those observations.
