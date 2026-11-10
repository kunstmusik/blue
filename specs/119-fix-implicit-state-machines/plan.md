# Implementation Plan: Fix Implicit State Machine Failures

**Branch**: `codex/fix-implicit-state-machines` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Status**: Complete | **Completed**: 2026-11-09

**Input**: `specs/119-fix-implicit-state-machines/spec.md`

## Summary

Fix shortcut containment, hosted editor gestures, Java helper ownership, and renderer transport projections through small, separately reviewable changes. Preserve existing public store/class façades and typed document/history contracts. Add a narrow host-listener lifetime helper for the repeated gesture wiring; keep geometry, previews, history, and domain transitions with their existing owners. Use explicit internal state only where mutually exclusive phases justify it. No external state-machine library, queue rewrite, or new persistence format is required.

Research found that some apparent previews write the shared renderer score/dirty projection, automation mixes local and canonical updates, and history terminal handling needs a focused correction. Java cleanup also needs client-queue invalidation and confirmed child-exit handling; changing the session manager alone cannot satisfy the spec. See [research](research.md) for the evidence and decisions.

## Technical Context

**Language/Version**: Strict TypeScript; installed compiler 5.9.3. Existing Java sources are behavioral references, not implementation targets.

**Primary Dependencies**: Existing Electron 44.9.1, React 19.2.5, Zustand 5.0.15, Dockview, typed preload/document bridge, and Java runtime client. Versions describe the inspected installation; retain the existing lockfile. No dependency additions.

**Storage**: Canonical main-process `BlueData` and existing in-memory project history; existing app settings/layout persistence. Gesture previews and runtime/transport phases are disposable. No serialized-data changes or migrations.

**Testing**: Vitest 4.1.11; deferred promises, fake clocks, two-document DOM tests, existing canonical-history harnesses, ordinary Playwright browser tests, and explicit Electron/manual float acceptance.

**Target Platform**: Supported macOS, Windows, and Linux desktop builds. Window adoption and process termination require platform acceptance, not just DOM mocks.

**Project Type**: Electron desktop monorepo; changes are concentrated in `packages/blue-app`.

**Performance Goals**: Preserve the current display cadence (configured 1–120 FPS), shared ticker, snapping, automatic scrolling, and live feedback. Keep idle BSB drag work at zero; display ticks must not allocate/re-project lifecycle state. These are deterministic work/identity constraints, not new speed acceptance claims.

**Constraints**: One canonical project/history owner; host-owned processes; serializable IPC; no Zustand accessors; gesture-time host resolution; no stale publication after cancellation; one history action per gesture. Native path semantics remain unchanged.

**Scale/Scope**: Four user stories, 24 requirements, 11 gesture families covering the audited score, editor, BSB, and layout paths. A single desktop user may issue overlapping commands across windows and await multiple helper operations.

## Constitution Check

The columns retain the design review and now include implementation evidence. The pre-research gate checked the intended scope; the final gate includes the connected fixes found during research and the owner acceptance recorded in quickstart.

| Gate                                 | Before research                                                         | After design and evidence                                                                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portable data core                   | PASS: application-only lifecycle work                                   | PASS: no host/DOM changes in `@blue/data`; score preview transforms stay in app renderer modules                                                                                                  |
| Java and project compatibility       | PASS: preserve editing/scripting behavior; consult Java during research | PASS: Java revision and source anchors in research; preserve geometry, scripting persistence, `.blue`, standalone resources, and CSD. Escape/blur policies are named interaction changes          |
| Migration scope and ordering         | PASS: no persistence schema change                                      | PASS: no XML/resource/settings migrator, accepted-input expansion, or opaque retention mechanism                                                                                                  |
| Canonical ownership and contracts    | PASS: retain main document/runtime ownership                            | PASS: local score/editor previews, existing patch/history metadata, one JVM initializer, and derived renderer playback façade; see contracts                                                      |
| Project history and undo/redo        | PASS: all durable edits use canonical history                           | PASS: semantic labels, grouped multi-target commits, explicit end/cancel, baseline restoration, settlement receipts, and redo preservation. No non-undoable mutation exception                    |
| Runtime and engine isolation         | PASS: process work remains in main                                      | PASS: session/client/process fixes stay host-side; no engine/native protocol replacement                                                                                                          |
| Host-path portability                | PASS: preserve existing native directory comparison and APIs            | PASS: no separator conversion; process tests use native builders plus synthetic Windows directory/dependency cases; macOS native termination verified; Windows/Linux coverage limitation accepted by owner                                    |
| Verification evidence                | PASS: existing seams plus focused regressions planned                   | PASS: focused/browser/workspace tests, lint, renderer types and main/preload builds passed; owner accepted native coverage limitations on 2026-11-09; see quickstart |
| Correctness/performance separation   | PASS: no new elapsed-time performance gate                              | PASS: fake-clock scheduling and work counts stay ordinary correctness tests; existing opt-in measurement policy unchanged                                                                         |
| License compatibility and provenance | PASS: original work in existing app GPL-3.0-or-later scope              | PASS: consulted scope map, app notices/metadata, and Java headers. Behavioral reference only; no source translation, new dependency, asset, table, or distribution notice change                  |

No constitution exception is needed. Re-run the checks if implementation changes these boundaries or incorporates external material.

## Project Structure

### Documentation (this feature)

```text
specs/119-fix-implicit-state-machines/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── gestures-and-history.md
    ├── java-runtime-lifecycle.md
    └── playback-and-shortcuts.md
```

`tasks.md` records the completed implementation and convergence tasks, including the owner-accepted native validation limitations.

### Source Code (repository root)

```text
packages/blue-app/src/
├── main/
│   ├── project-history.ts                         # terminal, net-zero, checkpoint and automation inverses
│   ├── project-history-memento.ts                 # reuse canonical/identity comparison support
│   └── java-runtime/
│       ├── java-runtime-session.ts
│       ├── java-runtime-client.ts
│       └── java-runtime-process.ts
├── shared/project-history.ts                     # reuse existing metadata/envelopes
└── renderer/
    ├── hooks/use-keyboard-shortcuts.ts
    ├── lib/host-gesture.ts                        # proposed small listener/disposer helper
    ├── lib/history-scope-router.ts                # existing settlement owner
    ├── stores/playback-store.ts
    ├── stores/score-selection-store.ts            # proposed transient score gesture projection
    ├── components/workbench/panels/ScorePanel.tsx
    ├── components/workbench/panels/score/          # canvases, timing, automation
    ├── components/workbench/panels/score-object/   # PianoRoll, shared line/JMask consumers
    ├── components/workbench/panels/orchestra/     # BSB and layout
    ├── tests/
    └── browser/
```

**Structure Decision**: Retain current domain owners. Extract only common listener lifetime wiring and an existing pure score-preview transformation if its current location prevents reuse. Preserve the project patch queue's FIFO/revision/barrier implementation. Consumer propagation paths and exact files are enumerated in research and contracts.

Implementation refinement: marker and tempo snapshots carry transient IDs through the existing app-side identity map and history copies, with creation metadata on the existing patch contract. These IDs are not serialized to project XML and do not change `@blue/data`; they distinguish an identically valued replacement from the original gesture target. Their retained memory is included in history estimates.

## Phase 0: Research Decisions

Research is complete for planning. [research.md](research.md) resolves mutation ownership, cancellation/settlement, host listener scope, JVM serialization and cleanup, parity/provenance, and transport projection. No unresolved design clarification remains. Local package sources and behavioral tests are the dependency evidence; no new package selection is needed.

## Phase 1: Design and Delivery Slices

These are sequencing/review boundaries, not an implementation task list.

### P0 — Shortcut containment (FR-001–FR-003, FR-009)

- Preserve existing shortcut mappings, text exclusions, repeat guards, and focused-toolbar Space behavior.
- At the renderer shortcut boundary, first honor `defaultPrevented`, then inspect the event's host document for active modal/alert-dialog surfaces and its target ancestry for portal popups using existing realm-safe helpers.
- Do not use an all-document `role=dialog` check: non-modal help only owns events within its surface. Preserve native-menu accelerator routing and current popout-global shortcut scope.
- Active gesture Escape is capture-phase input, before this bubble listener. Do not unify all modals in global state.

### P1a — Host gestures and history correctness (FR-004–FR-012)

- Introduce `renderer/lib/host-gesture.ts` solely for active host listener attachment, matching removal, capture-Escape ownership, pointer cancellation, and one terminal callback. Resolve the document/window at press. Keep timer/frame ownership, selection, state transitions, persistence, and history semantics in callers.
- Capture document/session/target identity and baseline at press. Clear active state and scheduled work synchronously before asynchronous completion. Hover stays local; avoid delivering a movement twice through canvas and window listeners.
- Score/audio move and resize previews must stop mutating `project-store.score` and `isDirty`. Add one transient, identity-fenced projection in the existing score selection/session domain and derive displayed groups from canonical groups plus that projection, then layer-height previews. Reuse the existing pure score movement transform. Do not restore a stale full score snapshot or call `refreshCanonicalSnapshot` as rollback.
- Retain local pattern, PianoRoll, field, and automation-range previews. Convert shared line and JMask point insertion/movement to local drafts with one final callback. Preserve linked endpoints, neighbor limits, snap rules, and cross-group previews.
- Keep marker/ruler/tempo and automation point edits live, but group every press-time insertion/change and movement under one semantic history action. Widen private callback metadata only through the actual owners listed in research.
- For BSB moves/resizes, register host listeners and history settlement only while active. Blur/closure settles; Escape restores optimistic baselines and sends exactly one terminal cancellation after any preceding baseline patches. Cover cancellation before and after a queue flush.
- Apply the focused history terminal/rollback changes in [the gesture contract](contracts/gestures-and-history.md): unchanged end closes its matching group, metadata-only controls are not lost as empty document patches, and cancellation preserves the prior redo branch. Keep the chronological action limit unchanged; one bounded active rollback checkpoint is not an additional published action, but all unique checkpoint bytes count against the byte budget. Reject/cancel before growth that cannot retain rollback safely, using existing oversize/failure handling. Do not disable small drags merely because the chronological ledger already has 200 actions. Keep queue ordering and revision checks intact.
- A preview committing for the first time uses single for one patch, or begin/update/end for multiple patches. An already-open live group uses update(s) and exactly one final end, never a second begin or single. A no-change final value still terminates a genuinely changed group; a net-zero group that moved away and back is removed with its original dirty/redo baseline restored. Settlement returns canonical queue completion, not a void callback invocation.
- Extend structural inverse generation for automation point edits: capture baseline setAutomationPoints (and resolution when affected) for each parameter from the original group memento. Reconcile those concrete inverse payloads on cancel/Undo, with final forward payloads on Redo; the existing generic structural-change fallback only requests restart and does not restore a live automation edit.
- Split-pane drags preview locally and persist once on successful release; cancellation clears pending drag saves and restores the initial size/ratio. Arrangement column widths are local today: restore them and host body styles without inventing persistence.

### P1b — PianoRoll representation refactor (independent follow-up)

Replace mode-dependent mutable gesture fields with a discriminated state inside `NoteCanvasMouseListener`, preserving its façade and P1a terminals. Store pointer coordinates for both MOVE and SELECTING; retain autoscroll resource ownership separately and clear it on all exits. This is separately reviewable/revertible and not a prerequisite for a complete P1a fix.

### P2 — Java helper lifecycle (FR-013–FR-019)

- Snapshot session/directory/dependency inputs and epoch at request invocation. Serialize readiness using one recovered promise tail; recheck cache and epoch after acquiring ownership. Different requests run in invocation order; same-key requests reuse successful readiness.
- Separate owned process from active-session readiness, record the requested dependency key before initialization, and only publish readiness/revision after a current successful response. Guard explicit Jython reinitialization too.
- Fence every startup await and cleanup by epoch and owned-handle identity. Record handles before connection. Constructor failure and stale returned handles have local cleanup. Production creation observes cancellation after port reservation and before spawning. It also invokes a synchronous onSpawned ownership callback before resolving its promise; the manager owns the produced handle even while its await continuation is pending, so disposal drains bounded cleanup across the spawn/adoption gap.
- Explicit client disconnect invalidates queued work and forbids implicit socket recreation. A stale generation's failure handler cannot reset a newer explicitly reconnected socket. Ordinary transport-failure socket reset remains recoverable for a current client; reconnect after explicit disconnect is deliberate.
- Disposal detaches state and starts termination before awaiting anything; it never queues shutdown behind initialization. Use confirmed child exit, not `child.killed`, for escalation. Preserve the existing two-second graceful allowance and add a one-second bounded force-exit confirmation. These are safety deadlines, not performance benchmarks. Failed termination is reported as failure, not clean disposal.
- Preserve the public session-manager methods and runtime reply envelopes. Internal process factory/cancellation and termination dependency signatures may change with all local callers/tests updated. No Java helper protocol or source changes are planned.

### P3 — Playback lifecycle projection (FR-020–FR-024)

- Add an internal pure lifecycle transition/projection pair in or next to `playback-store.ts`. Keep existing store fields/actions as the compatibility façade; every lifecycle action updates the union and projected booleans atomically, including `setPlaying` compatibility.
- Keep clock/display and independent settings outside the union. Reuse a stable frozen idle display value without mutating it. Display ticks do not recreate the lifecycle object.
- Local stopping retains prior confirmed activity; authoritative main stopping confirms the host was playing. Preserve partial mode/anchor values and explicit stop's audition-indication behavior. Apply follow-on-start exactly once at the first accepted normal-start confirmation, whether that arrives by status or local reply.
- Fence local asynchronous start replies/errors by attempt identity. Preserve early clocks in starting, reject terminal clocks, and reject older/retired clock session IDs and sequences while retaining current EngineBridge authority. No new playback IPC field is required.

## Boundary Review Records

| Boundary                    | Responsibility, façade, and owner                                                                                                   | Test seam and rollback                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Shortcut guard              | Existing hook, DOM event ownership; imports existing realm-safe helpers                                                             | App/follow shortcut tests; revert hook and tests                                                          |
| Host-listener helper        | Repeated resource lifetime wiring only; per-component semantics remain local; no import of stores or history                        | Direct two-realm/disposal tests plus canvas consumers; revert helper adoption with callers                |
| Transient score projection  | Existing selection/session owner, pure projection into ScorePanel; canonical main/renderer snapshot is not rewritten during preview | Cross-group/timing/dirty-state tests; revert score preview calls/projection together                      |
| Editor draft integration    | Existing editor callbacks; one final project commit; narrowly metadata-capable owning adapters                                      | PianoRoll, line, JMask and BSB canonical-history tests; revert each vertical editor path                  |
| History terminal correction | Existing main coordinator owns grouping/rollback; reuse current commit envelope and patch queue                                     | Main history and renderer queue/settlement regressions; revert together with new live gesture integration |
| Java session/client/process | Host-owned readiness/resource lifetime; class façade stable, private factory/termination changes only                               | Three focused runtime suites; revert connected P2 slice                                                   |
| Playback lifecycle          | Renderer transport projection; no back-import from pure helpers to store                                                            | Playback/follow/app tests; revert P3 independently                                                        |

Rejected: global modal/FSM state, replacing the transaction queue/history coordinator with an FSM, a generic gesture framework, a combined clock/lifecycle object updated at display cadence, and broad EngineBridge or render/freeze-store rewrites. Revisit only with a separate reproducible defect or demonstrated consumer boundary.

## Validation and Status

See [quickstart.md](quickstart.md) for final evidence, manual acceptance, and the FR/SC matrix. The original planning baseline was 6 files / 94 existing tests. Final workspace tests, focused and browser regressions, renderer type checking, main/preload builds, lint and whitespace checks passed. The owner manually tested the feature and accepted native acceptance on 2026-11-09, including the documented macOS coverage gaps and unavailable Windows/Linux native runs. All tasks are closed under that explicit acceptance; no unobserved native result or performance acceptance is claimed.

### Implementation Reconciliation

Implementation of User Stories 1 through 4 and all convergence work (Tasks T001–T060) is complete, with the remaining native coverage limitations accepted by the owner:

1. **Shortcut Containment**: Implemented in `use-keyboard-shortcuts.ts` and `cross-realm-dom.ts` with host-document active modal and popup ancestry checks.
2. **Host Gestures & Previews**: Implemented in `host-gesture.ts`, `score-selection-store.ts`, `ScorePanel.tsx`, `ScoreTimeCanvas.tsx`, `TrackLayerGroupCanvas.tsx`, `PatternsLayerGroupCanvas.tsx`, `NoteCanvasMouseListener.ts`, `PianoRollCanvas.tsx`, `FieldEditor.tsx`, `EditableLineCanvas.tsx`, `TableEditor.tsx`, `WidgetWrapper.tsx`, `SplitPane.tsx`, and `ArrangementPanel.tsx`.
3. **Project History & Settlement**: Implemented in `project-history.ts`, `project-history-memento.ts`, `history-scope-router.ts`, and `project-patch-queue.ts` with single rollback checkpoint, net-zero rollback, structural automation inverses, and empty-envelope terminal settlement.
4. **Java Runtime Lifecycle**: Implemented in `java-runtime-session.ts`, `java-runtime-client.ts`, `java-runtime-process.ts` with serialized readiness, pre-spawn cancellation checks, synchronous handle registration, bounded termination escalation, and client queue invalidation.
5. **Playback Lifecycle**: Implemented in `playback-store.ts` with pure internal lifecycle transitions, atomic compatibility projection, attempt fencing, clock watermark rejection, and frozen idle display.
6. **Floated Editor Rendering**: Scoped CodeMirror root styling to the editor element so its popout tooltip container cannot cover the workbench; removed the redundant popout reload and added a reproducing browser regression.

Zero persistence, serialization, schema, or third-party dependency changes were introduced. All code is original TypeScript authored under GPL-3.0-or-later.

## Complexity Tracking

No constitution violations or approved exceptions. The shared listener helper, transient score projection, and connected history/client/process corrections each have demonstrated consumers or failing-contract cases; none introduces an extensible framework.
