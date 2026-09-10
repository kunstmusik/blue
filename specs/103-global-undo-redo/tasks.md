---

description: "Actionable implementation tasks for global project undo and redo"
---

# Tasks: Global Project Undo and Redo

**Input**: Design documents from /specs/103-global-undo-redo/

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story so each increment can be implemented and
validated independently after the shared history foundation is complete.

**Scope boundary**: History is session-only project state. It does not enter .blue XML, application
preferences, window layout, search history, playback commands, external library database writes, or
filesystem deletion.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the typed seams, fixture locations, and evidence scaffolding required by the
implementation plan. No new dependency is required.

- [X] T001 [P] Define serializable project-history requests, replies, publication events, selection hints, runtime outcomes, and participant messages in packages/blue-app/src/shared/project-history.ts and packages/blue-app/src/shared/project-history.test.ts
- [X] T002 [P] Add history-copy, identity, XML, and CSD fixture entry points for representative score, mixer, instrument, BSB, BlueX7, PianoRoll, freeze, and unknown-data projects in packages/blue-data/src/blue-data-history-copy.test.ts and packages/blue-data/src/test-support/java-parity-fixtures.ts
- [X] T003 [P] Create deterministic main-process and renderer test support for two registered contexts, fake publication, fake performances, delayed acknowledgements, and the 100-action workload in packages/blue-app/src/main/project-history-test-support.ts and packages/blue-app/src/renderer/tests/global-history-test-support.ts
- [X] T004 [P] Record the new module boundaries, canonical owners, test seams, and feature evidence locations in docs/modularization.md and specs/103-global-undo-redo/quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the canonical-copy, publication, contract, lifecycle, settlement, and runtime
infrastructure that every user story depends on.

**Checkpoint**: No story work is complete until all canonical project writers use the preparation
boundary and all retained history state is detached from the live graph.

- [X] T005 Add an explicit history-copy mode to the existing BlueData traversal while preserving model IDs, aliases, nested/shared references, unknown XML, project-authored typography, freeze metadata, and duplication-oriented deepCopy behavior in packages/blue-data/src/blue-data.ts, packages/blue-data/src/deep-copyable.ts, and packages/blue-data/src/index.ts
- [X] T006 [P] Extend non-XML project-editor identity sidecars and transfer mappings so score objects, layers, mixer entries, parameters, BSB widgets, presets, dropdown links, and library references survive history capture and replay in packages/blue-app/src/shared/project-editor/identity.ts and packages/blue-app/src/shared/project-editor/identity.test.ts
- [X] T007 Add detached-memento regression coverage proving source, candidate, retained before-state, and retained after-state never share mutable aliases while XML and generated CSD remain compatible in packages/blue-data/src/blue-data-history-copy.test.ts, packages/blue-data/src/blue-data-deep-copy.test.ts, packages/blue-data/src/blue-data-csd-parity.test.ts, and packages/blue-data/tests/integration/csd-comparison.ts
- [X] T008 Extend ProjectSession with document lifetime identity, monotonically increasing publication revision, history state identity, canonical committed-document publication, and path-preserving replacement semantics in packages/blue-app/src/main/project-session.ts and packages/blue-app/src/main/project-session.test.ts
- [X] T009 Implement prepared scalar and structural transaction capture, target/precondition validation, identity sidecar transfer, exact no-throw rollback, and detached candidate publication in packages/blue-app/src/main/project-history-memento.ts, packages/blue-app/src/main/project-history-memento.test.ts, packages/blue-app/src/shared/project-editor/contract.ts, and packages/blue-app/src/shared/project-editor/patch-document.ts
- [X] T010 Implement the main-owned ProjectHistory coordinator with commit, undo, redo, read, adjacent gesture grouping, operation-id deduplication, stale/invalid/unchanged handling, bounded receipt cache, and chronological branch semantics in packages/blue-app/src/main/project-history.ts and packages/blue-app/src/main/project-history.test.ts
- [X] T011 Add deterministic retained-byte accounting, 200-action and 64 MiB limits, whole-entry eviction, saved-state checkpoint tokens, oversize proposal tokens, and fail-closed cancellation behavior in packages/blue-app/src/main/project-history.ts and packages/blue-app/src/main/project-history.test.ts
- [X] T012 Integrate history boundaries with load, save, Save As, close, and project replacement so successful writes checkpoint the exact written state and failed writes leave the prior checkpoint unchanged in packages/blue-app/src/main/project-lifecycle.ts, packages/blue-app/src/main/project-lifecycle.test.ts, packages/blue-app/src/main/project-replacement-flow.ts, and packages/blue-app/src/main/project-replacement-flow.test.ts
- [X] T013 Extend the project-document IPC registrar and preload bridge with typed commit, undo, redo, read, participant registration, boundary settlement, oversize confirmation, and runtime-outcome events in packages/blue-app/src/main/ipc/project-document-ipc.ts, packages/blue-app/src/main/ipc/ipc-registration.ts, packages/blue-app/src/main/ipc/project-document-ipc.test.ts, packages/blue-app/src/preload/preload.ts, packages/blue-app/src/renderer/types/global.d.ts, and packages/blue-app/src/preload/project-history-api.test.ts
- [X] T014 Route every canonical writer through one preparation boundary before mutation, including legacy document updates, patch batches, track/effect adapters, and direct main-process mutations, in packages/blue-app/src/main/main.ts, packages/blue-app/src/main/ipc/project-document-ipc.ts, packages/blue-app/src/shared/project-editor/patch-document.ts, and packages/blue-app/src/main/project-history-writer-audit.test.ts
- [X] T015 Implement the main pause/drain/release settlement barrier with per-context watermarks, bounded stale retry, composition completion, five-second timeout, disconnect abort, queued rapid commands, and draft-preserving release behavior in packages/blue-app/src/main/project-history.ts, packages/blue-app/src/shared/project-history.ts, and packages/blue-app/src/main/project-history-settlement.test.ts
- [X] T016 Add renderer queue participant controls for pausing durable submissions, draining a captured prefix, acknowledging zero outstanding work, preserving drafts, and rejecting delayed post-boundary writes in packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts, packages/blue-app/src/renderer/components/track-instrument-editor/track-instrument-patch-queue.ts, and packages/blue-app/src/renderer/tests/project-patch-queue.test.ts
- [X] T017 Implement the per-performance runtime reconciliation foundation with capability classification, immutable work plans, generation-scoped binding registries, ordered queues, and pending/applied/restart-required/failed outcomes in packages/blue-app/src/main/project-runtime-reconciliation.ts and packages/blue-app/src/main/project-runtime-reconciliation.test.ts
- [X] T018 Add an exhaustive preparation-classification test that enumerates every ProjectDocumentPatch member and rejects unexpected or unclassified durable variants instead of silently bypassing history in packages/blue-app/src/shared/project-editor/contract.ts and packages/blue-app/src/main/project-history-patch-classification.test.ts

---

## Phase 3: User Story 1 - Reverse Project Edits as Meaningful Actions (Priority: P1) 🎯 MVP

**Goal**: Make score, instrument, mixer, automation, and structural edits one chronological,
atomic, labeled project history with exact undo and redo.

**Independent Test**: Move a score object, delete a referenced instrument, and change a mixer
level; undo all three from a different editor and redo them, comparing values, identities,
ordering, references, and retained data.

### Verification for User Story 1

- [X] T019 [P] [US1] Add a main-process regression covering score move, referenced instrument deletion, mixer level change, compound drag, failed compound application, unchanged edits, redo-branch invalidation, and duplicate delivery in packages/blue-app/src/main/global-project-history.test.ts
- [X] T020 [P] [US1] Add a data-layer identity and round-trip oracle for nested score objects, layer ordering, mixer entries, instrument references, BSB presets, BlueX7 parameters, PianoRoll content, unknown XML, and generated CSD in packages/blue-data/src/blue-data-history-copy.test.ts and packages/blue-data/tests/integration/global-history-roundtrip.test.ts
- [X] T021 [P] [US1] Add typed IPC contract tests for stale revisions, invalid targets, conflicting operation IDs, all-or-nothing batches, unchanged replies, and committed publication metadata in packages/blue-app/src/main/ipc/project-document-ipc.test.ts and packages/blue-app/src/main/project-history.test.ts

### Implementation for User Story 1

- [X] T022 [US1] Route score-object moves, multi-selection drags, deletes, layer edits, and structural score operations through labeled begin/update/end transactions with one completed history entry in packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/score-timeline-gesture-utils.ts, packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts, and packages/blue-app/src/renderer/stores/project-store.ts
- [X] T023 [US1] Route mixer channel levels, effect-chain edits, arrangement instrument changes, and track instrument replacement through typed prepared actions with semantic labels and exact preconditions in packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx, packages/blue-app/src/renderer/components/workbench/panels/mixer/EffectsChainContextMenu.tsx, packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentEditorPanel.tsx, packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx, and packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts
- [X] T024 [US1] Cover automation points, tempo and meter maps, layer timing, transport settings, MIDI project configuration, and Blue Live project configuration in the common preparation classifier and project-editor patch adapters in packages/blue-app/src/shared/project-editor/patch-score.ts, packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts, packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts, and packages/blue-app/src/shared/project-editor/contract.ts
- [X] T025 [US1] Use structural mementos for mixed or identity-changing actions, publish the restored canonical graph without replacing document ownership, and emit stable changed-target and origin-view hints in packages/blue-app/src/main/project-history-memento.ts, packages/blue-app/src/main/project-session.ts, packages/blue-app/src/main/project-history.ts, and packages/blue-app/src/shared/project-history.ts
- [X] T026 [US1] Replace optimistic renderer-only history assumptions with acknowledgement-aware canonical application that does not replay an own operation twice, preserves rejected redo branches, and never creates a history entry during replay in packages/blue-app/src/renderer/stores/project-store.ts, packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts, and packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts
- [X] T027 [US1] Add the end-to-end mixed score/instrument/mixer scenario and state comparison helpers for 100 alternating actions from two contexts in packages/blue-app/src/main/global-project-history.integration.test.ts and packages/blue-app/src/main/project-history-test-support.ts

**Checkpoint**: User Story 1 is complete when a mixed edit sequence can be undone and redone
without partial writes, lost order, identity changes, or a stale redo branch.

---

## Phase 4: User Story 2 - See Restored State in Every Window (Priority: P1)

**Goal**: Keep all views, detached panels, dedicated editor windows, dirty state, drafts, and
selection consistent with the latest canonical document after edits, undo, and redo.

**Independent Test**: Open two views of the same instrument, edit from one, undo from the other,
and verify both views, the dirty indicator, stable selection, and any conflicting draft.

### Verification for User Story 2

- [X] T028 [P] [US2] Add project-store and listener regressions for wrong-document rejection, older/equal revision rejection, revision-zero initial acceptance, authoritative dirty projection, own-operation acknowledgement, and replay echo suppression in packages/blue-app/src/renderer/tests/project-store.test.ts, packages/blue-app/src/renderer/tests/use-ipc-listeners.test.tsx, and packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts
- [X] T029 [P] [US2] Add a two-view browser scenario covering a detached panel, dedicated editor, structural restoration, restored origin selection, invalid selection reconciliation, and no unexpected focus theft in packages/blue-app/src/renderer/browser/global-project-history.browser.test.tsx and packages/blue-app/src/renderer/tests/score-canvas-popout-menus.test.tsx
- [X] T030 [P] [US2] Add barrier tests for pending work, composition completion, conflict-to-draft conversion, clean participant closure, disconnect, timeout, rapid queued undo, and delayed post-release submission in packages/blue-app/src/main/project-history-settlement.test.ts and packages/blue-app/src/renderer/tests/project-patch-queue.test.ts

### Implementation for User Story 2

- [X] T031 [US2] Register independent dedicated-window contexts, deliver prepare-history-boundary and release-history-boundary events, and publish canonical snapshots with document, session, revision, state, dirty, history, and selection metadata in packages/blue-app/src/main/project-history.ts, packages/blue-app/src/main/ipc/project-document-ipc.ts, packages/blue-app/src/main/workbench-window-host.ts, and packages/blue-app/src/shared/project-history.ts
- [X] T032 [US2] Split project-store load/reset from canonical refresh, preserve pending local overlays until acknowledgement, accept only current-document newer revisions, and compute dirty state from the authoritative saved checkpoint in packages/blue-app/src/renderer/stores/project-store.ts and packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts
- [X] T033 [US2] Add the renderer history client, focus registration, command availability subscription, and host-document-aware scope resolution for the main window, Dockview popouts, effect windows, and track-instrument windows in packages/blue-app/src/renderer/hooks/use-project-history.ts, packages/blue-app/src/renderer/types/global.d.ts, packages/blue-app/src/renderer/effect-editor.tsx, and packages/blue-app/src/renderer/track-instrument-editor.tsx
- [X] T034 [US2] Restore and reveal stable origin selections, clear or reconcile invalid selections in other views, ignore closed-origin hints, and keep selection metadata out of project XML in packages/blue-app/src/renderer/stores/score-selection-store.ts, packages/blue-app/src/renderer/components/workbench/panels/score/layer-selection-utils.ts, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx, and packages/blue-app/src/shared/project-editor/identity.ts
- [X] T035 [US2] Refresh the actually edited effect and track instrument after canonical publication, replace indefinite stale retries with bounded precondition-aware resolution, and mark deleted targets unavailable without forcing a closed editor to reopen in packages/blue-app/src/renderer/components/effect-editor/EffectEditorPage.tsx, packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx, packages/blue-app/src/renderer/components/track-instrument-editor/track-instrument-patch-queue.ts, and packages/blue-app/src/renderer/tests/effect-editor-window.test.tsx
- [X] T036 [US2] Add explicit draft-conflict resolution that retains, discards, or reapplies a draft only after current-target validation, with fail-closed destructive confirmation and no automatic stale submission in packages/blue-app/src/renderer/components/dialogs/ConfirmationDialog.tsx, packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx, packages/blue-app/src/renderer/stores/project-store.ts, and packages/blue-app/src/renderer/tests/global-project-history-drafts.test.tsx
- [X] T037 [US2] Integrate the canonical refresh and barrier flow into the two-document popup harness and dedicated-window test doubles so all affected views settle before a history command reports completion in packages/blue-app/src/renderer/tests/global-project-history-views.test.tsx, packages/blue-app/src/renderer/tests/mock-blueapi.ts, and packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts

**Checkpoint**: User Story 2 is complete when an undo from any participating window updates every
affected view and preserves or explicitly resolves drafts and selections.

---

## Phase 5: User Story 3 - Hear Live Reversals and Understand Pending Runtime Changes (Priority: P1)

**Goal**: Reconcile committed undo and redo with every active timeline or Blue Live performance
using acknowledged, generation-fenced runtime work without rolling back the document on engine failure.

**Independent Test**: During normal playback and Blue Live, reverse a supported live parameter,
reverse a compilation-dependent change, inject engine rejection and timeout, and verify the
document, history, performance status, and next restart.

### Verification for User Story 3

- [X] T038 [P] [US3] Add capability-matrix tests for mixer, BSB, BlueX7, effect, automation, cosmetic, structural, unclassified, and stopped-performance changes in packages/blue-app/src/main/project-runtime-reconciliation.test.ts, packages/blue-app/src/main/runtime-channel-sync.test.ts, and packages/blue-app/src/main/score-automation-runtime-sync.test.ts
- [X] T039 [P] [US3] Add negative acknowledgement, missing client, transport exception, timeout with late completion, partial success, topology invalidation, and per-performance generation isolation tests in packages/blue-app/src/main/project-runtime-reconciliation.test.ts, packages/blue-app/src/main/engine-bridge.test.ts, and packages/blue-app/src/main/engine-runtime-ipc.test.ts
- [X] T040 [P] [US3] Add normal-playback and Blue Live smoke coverage that verifies engine readback or audible reversal, restart-required status, regenerated CSD, and no late write into a new performance in packages/blue-app/src/main/global-history-engine.integration.test.ts and packages/blue-data/tests/integration/global-history-runtime-artifacts.test.ts

### Implementation for User Story 3

- [X] T041 [US3] Complete the runtime reconciliation coordinator with per-performance queues, stable owner/parameter bindings, immutable desired values, outcome precedence, one-second timeout recovery, and retry of current canonical state in packages/blue-app/src/main/project-runtime-reconciliation.ts and packages/blue-app/src/main/project-runtime-reconciliation.test.ts
- [X] T042 [US3] Repair engine helper contracts so positive and negative acknowledgements, missing clients, transport errors, and timeouts remain distinguishable and are never reported successful merely because a Promise resolved in packages/blue-app/src/main/engine-bridge.ts, packages/blue-app/src/main/runtime-channel-sync.ts, packages/blue-app/src/main/runtime-parameter-sync.ts, and packages/blue-app/src/main/score-automation-runtime-sync.ts
- [X] T043 [US3] Move BSB, mixer, effect, BlueX7, and automation preview and replay handlers onto the acknowledged generation-fenced route, draining or superseding closed gestures before undo reports the restored value in packages/blue-app/src/main/bsb-instrument-runtime-sync.ts, packages/blue-app/src/main/blue-x7-engine-sync.ts, packages/blue-app/src/main/runtime-channel-sync.ts, packages/blue-app/src/main/score-automation-runtime-sync.ts, and packages/blue-app/src/main/main.ts
- [X] T044 [US3] Replace positional compilation-name and singleton BlueX7 binding assumptions with performance-scoped stable owner/parameter registries and rebind them on every compile or restart in packages/blue-app/src/main/runtime-parameter-sync.ts, packages/blue-app/src/main/blue-x7-runtime-sync.ts, packages/blue-app/src/main/blue-x7-engine-sync.ts, and packages/blue-app/src/main/engine-session.ts
- [X] T045 [US3] Publish per-performance runtime outcomes and accessible pending, applied, restart-required, and failed status text through the typed bridge and existing status/toast surfaces in packages/blue-app/src/shared/project-history.ts, packages/blue-app/src/preload/preload.ts, packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts, packages/blue-app/src/renderer/stores/project-store.ts, and packages/blue-app/src/renderer/lib/toast-styles.ts
- [X] T046 [US3] Ensure user-requested playback start/restart compiles the current restored project, keeps playback running for restart-required edits, and clears restart-required only after the desired revision is compiled and acknowledged in packages/blue-app/src/main/main.ts, packages/blue-app/src/main/engine-session.ts, packages/blue-app/src/main/ipc/playback-runtime-ipc.ts, and packages/blue-app/src/main/engine-runtime.ts

**Checkpoint**: User Story 3 is complete when document history remains authoritative under every
engine outcome and each active performance reports its own synchronization state.

---

## Phase 6: User Story 4 - Use Consistent Text, Menu, and Keyboard Undo (Priority: P2)

**Goal**: Put committed project text and editor actions in the global chronology while preserving
local undo for temporary drafts, search fields, native inputs, and IME composition.

**Independent Test**: Commit a grouped code edit, make a score edit, undo twice from a project
editor, then undo an unapplied draft with an empty project history.

### Verification for User Story 4

- [X] T047 [P] [US4] Add editor tests for project-versus-draft scope, 500 ms typing grouping, IME composition boundaries, Apply/Cancel, local empty-history isolation, completion/syntax preservation, and replay selection clamping in packages/blue-app/src/renderer/tests/csound-editor-history.test.tsx and packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx
- [X] T048 [P] [US4] Add native menu and accelerator tests for Cmd+Z/Cmd+Shift+Z and Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z, ensuring one physical gesture has one owner across main, detached, and dedicated windows in packages/blue-app/src/main/application-menu.test.ts, packages/blue-app/src/main/application-menu.ts, and packages/blue-app/src/renderer/tests/native-menu-undo-redo.test.tsx
- [X] T049 [P] [US4] Add no-echo and selection-preservation regressions proving canonical text refresh does not create a second edit or undo entry and does not overwrite newer local input in packages/blue-app/src/renderer/tests/use-ipc-listeners.test.tsx, packages/blue-app/src/renderer/tests/project-store.test.ts, and packages/blue-app/src/renderer/tests/csound-editor-history.test.tsx

### Implementation for User Story 4

- [X] T050 [US4] Replace native undo/redo roles and competing project keybindings with application menu commands that dispatch through the focused registered webContents and report next-action labels in packages/blue-app/src/main/application-menu.ts, packages/blue-app/src/shared/workbench-menu.ts, packages/blue-app/src/main/main.ts, and packages/blue-app/src/main/application-menu.test.ts
- [X] T051 [US4] Implement host-document-aware project/draft/none scope routing for menu, context-menu, keyboard, and editor actions, including Dockview realm-safe focus resolution and native-input delegation in packages/blue-app/src/renderer/hooks/use-project-history.ts, packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-menu.ts, packages/blue-app/src/renderer/types/global.d.ts, and packages/blue-app/src/renderer/tests/native-menu-undo-redo.test.tsx
- [X] T052 [US4] Configure project CodeMirror fields without local history or competing keymap ownership while retaining completion, syntax, IME, selection, and popout tooltip behavior; retain local history in draft editors in packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/editors/editor-adapter-types.ts, and packages/blue-app/src/renderer/tests/csound-editor-history.test.tsx
- [X] T053 [US4] Migrate committed BlueX7, score-color, and PianoRoll edit stacks to project-history transactions while preserving local draft behavior and replacing replay-time mutations with non-user annotations in packages/blue-app/src/renderer/components/instruments/blue-x7/use-blue-x7-history.ts, packages/blue-app/src/renderer/stores/score-color-history-store.ts, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/pianoroll-undo-store.ts, and packages/blue-app/src/renderer/tests/score-color-history-store.test.ts
- [X] T054 [US4] Make committed code, UDO, table, project-property, BSB-code, and effect text Apply operations one project action and Cancel operations no action, with explicit grouping metadata and canonical echo suppression in packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBCodeEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/project-properties/ProjectPropertyFields.tsx, packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts, and packages/blue-app/src/renderer/tests/csound-editor-history.test.tsx
- [X] T055 [US4] Keep menu labels and enablement synchronized with project and local draft availability across all hosting windows without installing fallback handlers alongside native accelerators in packages/blue-app/src/main/application-menu.ts, packages/blue-app/src/main/workbench-window-manager.ts, packages/blue-app/src/main/workbench-window-host.ts, and packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts

**Checkpoint**: User Story 4 is complete when committed text participates exactly once in global
history and local draft/native-input undo never falls through to an unrelated project action.

---

## Phase 7: User Story 5 - Keep History Useful Throughout a Project Session (Priority: P2)

**Goal**: Preserve history across save, editor closure, runtime restart, and dependency
invalidation while isolating project replacement and handling retention limits safely.

**Independent Test**: Edit, save, edit, close an editor, restart playback, undo through the save
point, and then open another project to verify history isolation.

### Verification for User Story 5

- [X] T056 [P] [US5] Add lifecycle regressions for save checkpoint, delayed save completion, save failure, Save As path publication, editor closure, runtime restart, close, replacement, and new-project isolation in packages/blue-app/src/main/project-lifecycle.test.ts, packages/blue-app/src/main/project-session.test.ts, and packages/blue-app/src/main/project-replacement-flow.test.ts
- [X] T057 [P] [US5] Add retention regressions for complete-entry eviction, saved checkpoint eviction, 200-action and 64 MiB limits, deterministic retained-byte estimation, oversize proposal cancellation, stale confirmation, and one-use history reset in packages/blue-app/src/main/project-history.test.ts and packages/blue-app/src/renderer/tests/global-project-history-retention.test.tsx
- [X] T058 [P] [US5] Add external-resource regressions for freeze/unfreeze, missing-audio relink, project-side library insertion/replacement, native and synthetic Windows paths, and preservation of generated files and external library state in packages/blue-app/src/main/freeze-score-objects.test.ts, packages/blue-app/src/main/missing-audio-assets.test.ts, packages/blue-app/src/main/unified-library/project-adapter.test.ts, and packages/blue-app/src/main/example-library/path-boundary.test.ts

### Implementation for User Story 5

- [X] T059 [US5] Expose retention limits and oversize proposals with accessible status and a fail-closed destructive ConfirmationDialog that revalidates document, revision, and payload before resetting retained history in packages/blue-app/src/main/project-history.ts, packages/blue-app/src/main/ipc/project-document-ipc.ts, packages/blue-app/src/renderer/components/dialogs/ConfirmationDialog.tsx, and packages/blue-app/src/renderer/stores/project-store.ts
- [X] T060 [US5] Preserve history and the saved checkpoint through successful save, editor-window disposal, runtime dependency invalidation, and playback restart while clearing history on close or replacement in packages/blue-app/src/main/project-lifecycle.ts, packages/blue-app/src/main/project-session.ts, packages/blue-app/src/main/project-replacement-flow.ts, packages/blue-app/src/main/main.ts, packages/blue-app/src/main/effect-editor-window-manager.ts, and packages/blue-app/src/main/track-instrument-editor-window-manager.ts
- [X] T061 [US5] Audit and migrate every remaining canonical writer, including patch batches, legacy IPC, score-object editors, freeze/unfreeze, missing-audio relink, unified-library project adapters, and persisted transport/Blue Live/MIDI settings, in packages/blue-app/src/main/main.ts, packages/blue-app/src/main/ipc/project-document-ipc.ts, packages/blue-app/src/main/freeze-score-objects.ts, packages/blue-app/src/main/missing-audio-assets.ts, packages/blue-app/src/main/unified-library/project-adapter.ts, packages/blue-app/src/main/score-object-file-operations.ts, and packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts
- [X] T062 [US5] Preserve external references and native path strings at the project-history boundary without deleting generated audio, reversing external library writes, fabricating missing files, or normalizing filesystem paths in packages/blue-app/src/main/freeze-score-objects.ts, packages/blue-app/src/main/missing-audio-assets.ts, packages/blue-app/src/main/unified-library/project-adapter.ts, packages/blue-app/src/main/example-library/path-boundary.ts, and packages/blue-app/src/shared/project-editor/patch-document.ts
- [X] T063 [US5] Keep history and runtime outcome ownership independent so a performance restart rebuilds bindings from the current project while history remains available and the next start uses the restored document in packages/blue-app/src/main/project-runtime-reconciliation.ts, packages/blue-app/src/main/engine-session.ts, packages/blue-app/src/main/project-lifecycle.ts, and packages/blue-app/src/main/main.ts
- [X] T064 [US5] Fence late save, freeze, library, and engine results by document lifetime, context epoch, operation ID, and performance generation so project replacement cannot mutate the newly opened project in packages/blue-app/src/main/project-session.ts, packages/blue-app/src/main/project-history.ts, packages/blue-app/src/main/project-runtime-reconciliation.ts, packages/blue-app/src/main/freeze-score-objects.ts, and packages/blue-app/src/main/unified-library/project-adapter.ts

**Checkpoint**: User Story 5 is complete when session operations do not erase valid history,
retention never fabricates a clean state, and no late asynchronous result crosses a project boundary.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Complete coverage, parity evidence, native-platform validation, performance evidence,
and removal of legacy bypasses.

- [X] T065 [P] Complete the FR-002 canonical-writer coverage matrix and map every patch union member to a preparation classification and test scenario in specs/103-global-undo-redo/contracts/project-history.md and specs/103-global-undo-redo/quickstart.md
- [X] T066 [P] Add the deterministic 1,000-clip, 32-instrument-assignment, and 128-automation-parameter performance workload plus 100-action timing and heap measurements in packages/blue-data/tests/integration/performance-benchmark.test.ts and packages/blue-app/src/main/global-project-history.performance.test.ts
- [X] T067 [P] Compare Java Blue reference behavior, .blue XML, generated CSD, unknown-data preservation, identity sidecars, project-authored typography, and external path text against the TypeScript implementation in packages/blue-data/src/test-support/java-parity-fixtures.ts, packages/blue-data/src/blue-data-history-copy.test.ts, packages/blue-data/src/blue-data-csd-parity.test.ts, and specs/103-global-undo-redo/research.md
- [X] T068 Validate native menu ownership, Cmd/Ctrl accelerators, IME composition, detached and dedicated windows, normal playback, Blue Live, relink/freeze path behavior, and failure recovery on macOS, Windows, and Linux using specs/103-global-undo-redo/quickstart.md and packages/blue-app/src/renderer/tests/native-menu-undo-redo.test.tsx
- [X] T069 Remove legacy direct mutation, renderer-local committed histories, unbounded stale retries, positional runtime binding, and unacknowledged preview paths only after the coverage matrix passes in packages/blue-app/src/main/main.ts, packages/blue-app/src/main/ipc/project-document-ipc.ts, packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts, packages/blue-app/src/renderer/components/instruments/blue-x7/use-blue-x7-history.ts, and packages/blue-app/src/main/runtime-parameter-sync.ts
- [X] T070 Run the affected package test suites, data build, engine-client build, main/preload/renderer builds, and browser suite from the commands documented in specs/103-global-undo-redo/quickstart.md
- [X] T071 Run repository-wide pnpm test, pnpm lint, and git diff --check, then attach package/build/lint, per-domain, native-platform, XML/CSD, runtime-outcome, and performance evidence to specs/103-global-undo-redo/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; T001-T004 can run in parallel.
- **Foundational (Phase 2)**: Depends on the shared contracts and fixtures from Phase 1; T005-T008 can begin in parallel, T009-T018 follow their listed contract and publication prerequisites, and this phase blocks all story work.
- **User Story 1 (Phase 3)**: Depends on the complete foundational phase; it establishes the first independently demonstrable global commit/undo/redo slice.
- **User Story 2 (Phase 4)**: Depends on the User Story 1 publication path plus the foundational IPC contract; its view and barrier work can then proceed in parallel by surface.
- **User Story 3 (Phase 5)**: Depends on the foundational runtime contract and User Story 1 committed before/after transitions; runtime adapters can proceed in parallel with User Story 2 after those seams are stable.
- **User Story 4 (Phase 6)**: Depends on the shared history client and User Story 1 commit semantics; editor-scope and native-menu work can proceed in parallel after the routing contract is fixed.
- **User Story 5 (Phase 7)**: Depends on foundational lifecycle/checkpoint support and the committed publication path; retention and external-resource migrations can proceed in parallel with editor work.
- **Polish (Phase 8)**: Depends on all desired user stories and is the release gate for complete FR-002 coverage.

### User Story Dependencies

- **US1 (P1)**: Foundational only; no dependency on another story.
- **US2 (P1)**: Uses US1's committed publication and selection metadata, but its two-view scenario is independently testable once those contracts exist.
- **US3 (P1)**: Uses US1's immutable before/after transition; runtime correctness is independently testable with fake performance adapters.
- **US4 (P2)**: Uses the shared history API from US1; local draft isolation is independently testable with an empty project history.
- **US5 (P2)**: Uses foundational lifecycle/checkpoint state; session isolation and retention are independently testable without the full editor migration.

### Parallel Opportunities

- T005, T006, and T008 can be implemented in parallel because they touch separate data/session seams.
- T019-T021 can run in parallel because they are independent regression suites.
- T028-T030 can run in parallel once the publication and participant contracts are stable.
- T038-T040 can run in parallel with fake runtime adapters and separate smoke fixtures.
- T047-T049 can run in parallel because menu, editor, and replay-echo tests use separate seams.
- T056-T058 can run in parallel because lifecycle, retention, and external-resource tests use separate adapters.
- T065-T067 can run in parallel after story implementation; T068 must follow the native-platform
  scenarios, and T069-T071 are final sequential validation tasks because they remove bypasses and
  update the shared evidence record.

## Parallel Example: User Story 1

~~~text
Task: T019 [US1] Main chronological history regression
Task: T020 [US1] Data identity and XML/CSD oracle
Task: T021 [US1] IPC stale/invalid/duplicate contract tests

After those tests are in place:
Task: T022 [US1] Score gesture and structural transaction routing
Task: T023 [US1] Mixer and instrument transaction routing
Task: T024 [US1] Automation, timing, and persisted project settings coverage
~~~

## Parallel Example: User Story 2

~~~text
Task: T028 [US2] Store and listener revision/dirty regressions
Task: T029 [US2] Two-view browser and selection scenario
Task: T030 [US2] Barrier timeout/conflict/disconnect tests
~~~

## Parallel Example: User Story 3

~~~text
Task: T038 [US3] Capability matrix tests
Task: T039 [US3] Acknowledgement and generation-fence tests
Task: T040 [US3] Normal-playback and Blue Live smoke coverage
~~~

## Parallel Example: User Story 4

~~~text
Task: T047 [US4] CodeMirror scope/grouping/IME tests
Task: T048 [US4] Native accelerator ownership tests
Task: T049 [US4] Canonical replay echo/selection tests
~~~

## Parallel Example: User Story 5

~~~text
Task: T056 [US5] Lifecycle and project-isolation tests
Task: T057 [US5] Retention and oversize tests
Task: T058 [US5] External-resource and native-path tests
~~~

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1 verification and implementation.
3. Stop and validate mixed score/instrument/mixer undo and redo, identity preservation, branch
   invalidation, and atomic failure behavior.
4. Demo the first project-wide history slice before migrating all editors and runtime adapters.

### Incremental Delivery

1. Add User Story 2 to make canonical restoration visible in every view.
2. Add User Story 3 to reconcile supported live changes and restart-required outcomes.
3. Add User Story 4 to unify committed text and platform commands while preserving drafts.
4. Add User Story 5 to finish lifecycle, retention, external-resource, and project-isolation work.
5. Complete Phase 8 and do not declare the feature complete while any FR-002 writer remains outside
   the preparation classification matrix.

### Verification Order

1. Run focused @blue/data history-copy and XML/CSD tests.
2. Run focused @blue/app project-history, lifecycle, queue, IPC, renderer, and runtime tests.
3. Run browser and native Electron scenarios from quickstart.md.
4. Run package builds, repository tests, lint, and git diff --check.

## Notes

- Every task above has a sequential ID and an explicit repository file path.
- [P] marks tasks that can use separate files and fixtures without depending on incomplete work in
  another task.
- User-story labels map directly to the five stories in spec.md.
- Structural restoration must use detached history copies; XML round trips are compatibility
  evidence, not a fallback that can normalize away in-session identity.
- Runtime failure never rolls back a successful document commit; it creates a per-performance
  outcome and a recoverable retry or restart path.

## Phase 9: Convergence

**Presentation revision (2026-09-09, manual-testing feedback):** The user requested removal of the history-usage strip, runtime-status/recovery strip, and routine restart-required toasts. This supersedes the persistent presentation portions of T045, T082, T086, and T094; do not reintroduce them during convergence. Keep retention enforcement, oversize confirmation, runtime classification/fences, genuine error reporting, and recovery via existing controls. T085/T087 acceptance follows the revised spec: compilation-dependent edits remain quiet and take effect on the next user-requested start.

- [X] T072 CRITICAL Validate all history IPC request payloads before invoking the coordinator in packages/blue-app/src/main/main.ts using shared validators in packages/blue-app/src/shared/project-history.ts; reject malformed requests, invalid sequences, and invalid participant acknowledgements with explicit serializable failures and focused IPC tests per Constitution III, FR-005, and T013 (implemented; shared contract, sender ownership, revision/sequence fencing, and focused IPC/settlement coverage).
- [X] T073 CRITICAL Connect dedicated project effect and track-instrument windows to history context registration, document/revision initialization, native command routing, pause/drain/release settlement, and disposal in packages/blue-app/src/renderer/effect-editor.tsx, packages/blue-app/src/renderer/track-instrument-editor.tsx, and their editor pages; prove pending dedicated-window edits settle before undo and commands execute from either window per FR-001, FR-005, FR-010, and T033 (implemented; dedicated hook plus effect/track window regression coverage).
- [X] T074 HIGH Route asynchronous freeze publication and other direct structural writers through the common prepared transaction/order boundary in packages/blue-app/src/main/main.ts and packages/blue-app/src/main/project-history.ts; avoid capturing an entire before-state before asynchronous work and absorbing intervening edits into its history entry, fence obsolete results, and test editing/undo during delayed freeze with exact independent replay per FR-003, FR-005, T014, and T064 (implemented; prepared candidate/revision fence and direct-writer audit coverage).
- [X] T075 HIGH Apply pre-commit oversize proposal, cancellation, and one-use confirmation semantics to commitDirectMutation and recordDirectStructureMutation callers in packages/blue-app/src/main/project-history.ts and packages/blue-app/src/main/main.ts; do not publish and then silently evict an oversized direct action, and test cancellation preserves the document and redo branch per FR-013, T011, and T059 (implemented; freeze/relink confirmation flows and direct-writer cancel/confirm tests).
- [X] T076 HIGH Deduplicate in-flight undo/redo operations as well as completed receipts in packages/blue-app/src/main/project-history.ts; concurrent requests with the same operation ID must share one execution/result, with incompatible reuse rejected, and add concurrent duplicate tests to packages/blue-app/src/main/project-history-settlement.test.ts per FR-005 and T010 (implemented; shared in-flight/completed receipt cache and concurrent settlement coverage).
- [X] T077 HIGH Wire committed text fields to stable field/context grouping metadata and a 500 ms typing boundary in packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx, its project callers, and packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts; end grouping on selection/editor/action/save/undo changes and settle complete IME compositions before history commands, with production-path tests per FR-008, FR-009, T047, and T054 (implemented; project editor callers carry stable metadata and boundary flushing/IME coverage).
- [X] T078 HIGH Publish focused local draft/native-input history availability and labels to application menus in packages/blue-app/src/main/application-menu.ts, packages/blue-app/src/main/main.ts, and packages/blue-app/src/renderer/lib/history-scope-router.ts; ensure local undo remains accessible when project history is empty and an empty draft never invokes project history per FR-010 and T055 (implemented; menu labels/availability and local-scope routing coverage).
- [X] T079 HIGH Replace global-constructor native input checks in packages/blue-app/src/renderer/lib/history-scope-router.ts with realm-safe checks; cover inputs and textareas in an actual secondary document with and without explicit draft scope so commands never fall through to project history per FR-009, FR-010, and T051 (implemented; secondary-document input/textarea regression coverage).
- [X] T080 HIGH Retain action-origin view and selection hints in history entries and publish those hints on replay in packages/blue-app/src/main/project-history.ts; supply origin metadata from production callers and restore/reveal only valid open-origin selections while reconciling other selections in packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts and packages/blue-app/src/renderer/stores/score-selection-store.ts per FR-007 and T034 (implemented; origin metadata, replay publications, and valid/invalid selection reconciliation coverage).
- [X] T081 HIGH Fence history projections and runtime-outcome presentation by current document, revision, and performance generation in packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts and packages/blue-app/src/renderer/stores/project-store.ts; move projection updates after stale-event checks, clear obsolete performance state, and test out-of-order events and project/restart transitions per FR-006, FR-017, T028, and T045 (implemented; canonical/runtime event fences and out-of-order/clear-state tests).
- [X] T082 HIGH Render accessible per-performance pending/applied/restart-required/failed status from runtimeOutcomeStatusText/runtimeOutcomes and provide an applicable retry or restart action through the existing status/toast surfaces in packages/blue-app/src/renderer/stores/project-store.ts and renderer components, with typed main/preload wiring where needed and UI tests proving acknowledgement-controlled completion per FR-015, FR-017, and T045 (implemented; accessible runtime status banner with retry/restart actions and UI coverage).
- [X] T083 HIGH Fence asynchronous effect snapshot refreshes against document/revision changes and out-of-order completion in packages/blue-app/src/renderer/components/effect-editor/EffectEditorPage.tsx; clear the unavailable error when undo restores the effect and test delete/undo plus delayed refresh races in packages/blue-app/src/renderer/tests/effect-editor-window.test.tsx per FR-006 and T035 (implemented; document/revision fenced refresh and dedicated-window coverage).
- [X] T084 HIGH Suspend pending debounce and unmount submissions when a draft conflict is detected in packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx; keep/discard must not later submit the stale draft, and Apply must validate the current target/version, with timer and unmount regressions in packages/blue-app/src/renderer/tests/global-project-history-drafts.test.tsx per FR-007 and T036 (implemented; generation cancellation, conflict suppression, and draft regressions).
- [X] T085 HIGH Complete actual-boundary validation in packages/blue-app/src/renderer/browser/global-project-history.browser.test.tsx and packages/blue-app/src/main/global-history-engine.integration.test.ts: mount production history listeners across real hosting documents/dedicated contexts and exercise the versioned engine client against a running engine for timeline and Blue Live replay; execute the remaining native Windows/Linux shortcut/path/runtime gates and record accurate evidence in specs/103-global-undo-redo/quickstart.md per SC-006, SC-008, T029, T040, and T068 (accepted by the explicit 2026-09-09 acceptance disposition; native Windows/Linux and running-engine evidence remain unavailable on this macOS host and are not being represented as passed).
- [X] T086 MEDIUM Display history retention limits and complete-entry eviction status through packages/blue-app/src/renderer/hooks/use-project-history.ts and an accessible renderer status surface; verify that users can identify the remaining history limit after eviction in packages/blue-app/src/renderer/tests/global-project-history-retention.test.tsx per FR-013 and T059 (implemented; accessible retention status and eviction-limit regression coverage).
- [X] T087 MEDIUM Extend packages/blue-app/src/main/global-project-history.performance.test.ts and the browser/runtime acceptance harness to measure physical command receipt through painted canonical views in all affected windows and positive live engine acknowledgement on the representative workload; record p50/p95/max, status-render latency, retained bytes, and heap evidence in specs/103-global-undo-redo/quickstart.md per SC-003, SC-004, and T066 (implemented; the real-Chrome two-view harness records 100 paint/status samples, the opt-in real blue-engine harness records 100 positive timeline and Blue Live readbacks, and coordinator retention/heap metrics are emitted).

## Phase 10: Convergence

- [X] T088 HIGH Make dedicated-window boundary drains await existing in-flight writes and a captured pending prefix, propagate failed/unresolved submissions into the acknowledgement, and carry the active barrier ID through dedicated history contexts and main effect/track adapters in packages/blue-app/src/renderer/hooks/use-dedicated-project-history.ts, packages/blue-app/src/renderer/components/effect-editor/EffectEditorPage.tsx, packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx, packages/blue-app/src/shared/project-editor/contract.ts, and packages/blue-app/src/main/main.ts; test delayed writes, queued writes, and rejected writes against the real ProjectHistory barrier rather than acknowledgement-only mocks per FR-005, US2/AC3, and T073 (implemented; dedicated queues drain in-flight work and captured prefixes, report failed/unresolved counts, and propagate barrier IDs through adapters and settlement tests).
- [X] T089 HIGH Resolve focused project/draft/none scope before executing native history commands in packages/blue-app/src/renderer/hooks/use-dedicated-project-history.ts using packages/blue-app/src/renderer/lib/history-scope-router.ts; keep dedicated project identity for project commands while routing CodeMirror drafts and native text inputs locally, and test empty local history with nonempty project history per FR-009, FR-010, US4/AC3, and T073 (implemented; focused routing preserves dedicated project identity and keeps local draft/input commands out of project history).
- [X] T090 HIGH Replace hasLoadedProject-based draft availability in packages/blue-app/src/main/main.ts with a typed focused-history availability/label projection from the renderer; select the focused scope instead of OR-ing project and draft availability in packages/blue-app/src/main/application-menu.ts, and cover focus transitions, empty stacks, and draft editing without an open project per FR-010, US4/AC4, and T078 (implemented; the renderer publishes typed focused availability through the project-document listener and menus select that scope without OR-ing project and draft state).
- [X] T091 HIGH Integrate editor debounce and IME composition state into workbench and dedicated settlement participation in packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx, packages/blue-app/src/renderer/lib/history-scope-router.ts, and packages/blue-app/src/renderer/hooks/use-dedicated-project-history.ts; prevent zero-delay submissions and command-triggered flushes from splitting active composition, and settle pending text in other editors/windows before save/undo while preserving drafts on timeout per FR-005, FR-008, US4/AC2, and T077 (implemented; editor settlement waits for composition/debounce completion, command/save barriers settle participants, and aborts preserve drafts).
- [X] T092 HIGH Capture a coherent immutable canonical publication for each committed revision before awaiting runtime reconciliation in packages/blue-app/src/main/project-history.ts and packages/blue-app/src/main/main.ts; prevent snapshot:null fallback from attaching later project content to earlier revision/state/dirty metadata, and test concurrent commits and project replacement during delayed runtime acknowledgements per FR-005, FR-006, and SC-007 (implemented; publication snapshots and dirty state are captured before runtime awaits and snapshot:null fallback is rejected, with delayed replacement/replay coverage).
- [X] T093 HIGH Preserve pending runtime outcomes that arrive before their canonical document publication in packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts and packages/blue-app/src/renderer/stores/project-store.ts, or publish the canonical pending state before awaiting acknowledgement in packages/blue-app/src/main/project-history.ts; retain document/generation fences and test that the production status banner visibly remains pending until delayed acknowledgement per FR-015, US3/AC1, T081, and T082 (implemented; runtime events buffer by document/revision, canonical revisions retire obsolete outcomes, and delayed acknowledgement status remains fenced and visible).
- [X] T094 HIGH Route runtime recovery to the affected performance kind in packages/blue-app/src/renderer/components/notifications/ProjectRuntimeStatusBanner.tsx using timeline restart or Blue Live recompile as applicable; publish generation-scoped reset/applied state on successful compile and clear stopped-performance outcomes through packages/blue-app/src/main/project-runtime-reconciliation.ts, packages/blue-app/src/main/main.ts, and the typed bridge, with Blue Live-only and successful restart/stop UI regressions per FR-016, FR-017, US3/AC3, and T082 (implemented; recovery actions target the affected timeline or Blue Live performance and successful lifecycle/recompile events clear generation-scoped status).
- [X] T095 HIGH Correct mixed scalar/structural history grouping in packages/blue-app/src/main/project-history.ts so scalar-to-structural groups retain the state before the first scalar edit and structural-to-scalar groups create a valid detached after-memento rather than reading candidate from a scalar transaction; add exact undo/redo, identity, and XML tests for both orders within one gesture per FR-003, FR-004, FR-008, and T025 (implemented; mixed groups preserve detached before/after mementos and exact XML/identity replay is covered in both gesture orders).
- [X] T096 HIGH Put commitDirectMutation and commitPreparedStructuralMutation in packages/blue-app/src/main/project-history.ts under the same ordering/settlement rules as ordinary commits and revalidate prepared revisions after waiting; test direct library/relink/freeze publication while an undo/save barrier is paused and while replay is awaiting runtime completion per FR-005, SC-007, and T074 (implemented; direct and prepared writers share ordered settlement, detached library candidates are revalidated, and replay cannot be overtaken by delayed publication).
- [X] T097 HIGH Use retained origin view/context identity when applying replay selection hints in packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts and packages/blue-app/src/renderer/stores/score-selection-store.ts; restore and reveal only the still-open origin, preserve valid unrelated selections, clear invalid selections even without hints, and exercise actual origin/non-origin/closed-origin views per FR-007, US2/AC2, and T080 (implemented; replay hints are identity/open-state fenced, valid unrelated selections survive, and canonical pruning clears invalid selections without hints).

## Phase 11: Convergence

- [X] T098 HIGH Pause the workbench patch queue synchronously on prepare-history-boundary before awaiting editor settlement in packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts and packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts; tag settlement-produced patches with the active barrier ID and prevent an ordinary timer submission from waiting for release while the boundary drain waits for that same submission; cover delayed IME completion alongside a pending queue timer against the real ProjectHistory coordinator per FR-005, US2/AC3, T088, and T091 (implemented; synchronous pause captures settlement-produced patches with the active barrier ID, failed/unresolved acknowledgements abort immediately, and queue/barrier regressions pass).
- [X] T099 HIGH Include registered editor settlement in dedicated effect/track history barriers in packages/blue-app/src/renderer/hooks/use-dedicated-project-history.ts before capturing and draining their patch prefixes, while keeping durable submissions paused; test undo/save requested from another window during a dedicated editor debounce and composition so no delayed text write reapplies after replay per FR-005, FR-008, US2/AC3, and T091 (implemented; dedicated barriers pause first, settle registered editors, then drain their prefixes; dedicated settlement coverage passes).
- [X] T100 HIGH Make unresolved composition and editor-settlement failures fail closed in packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx and packages/blue-app/src/renderer/lib/history-scope-router.ts; do not resolve settlement successfully after the one-second timer while composition is still active or swallow a settlement failure, propagate unresolved input to barrier abortion, preserve the draft, and test composition longer than one second plus completion after abort per FR-005, FR-008, US4/AC2, and T091 (implemented; composition timeout rejects, router failures propagate, coordinator aborts on unresolved acknowledgement, and late completion retains the draft).
- [X] T101 HIGH Refresh dedicated-window project history availability from accepted canonical publications and command responses in packages/blue-app/src/renderer/hooks/use-dedicated-project-history.ts and integrate that same projection with packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx; avoid publishing a registration-time projection or an uninitialized workbench projection after dedicated edits, and test opening with empty history, editing, undo/redo, and refocusing without reopening per FR-010, US4/AC4, and T090 (implemented; accepted publications and undo/redo responses update the shared projection, project editors ignore an uninitialized projection, and dedicated availability coverage passes).
- [X] T102 HIGH Preserve unresolved per-performance restart-required/failed/pending state across cosmetic or otherwise no-runtime-work commits in packages/blue-app/src/main/project-runtime-reconciliation.ts, packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts, and packages/blue-app/src/renderer/stores/project-store.ts; project revision advancement alone must not clear a runtime mismatch, and status must remain until acknowledged recovery or performance disposal; test a compiled-code edit followed by a cosmetic edit, plus a failed live update followed by cosmetic work, per FR-015, FR-016, FR-017, T093, and T094 (implemented; no-work reconciliation remains untouched and renderer outcome retirement is per performance kind, with restart/failed cosmetic-follow-up regressions passing).

## Phase 12: Convergence

- [X] T103 HIGH Resolve the ordered-queue/settlement dependency cycle in packages/blue-app/src/main/project-history.ts and the workbench/dedicated participant queues: an ordinary edit submitted just after undo is enqueued behind the active undo, but its renderer awaits that in-flight edit before acknowledging the undo barrier, causing timeout and post-abort commitment. Define and enforce captured-prefix handling or explicit draft-preserving rejection for these already-submitted requests without bypassing document, sequence, or revision fences. Add a deterministic regression in packages/blue-app/src/main/project-history-settlement.test.ts that seeds one edit, starts undo, immediately submits an ordinary participant edit before prepare delivery, and has the participant await that submission before acknowledging; verify intended ordering completes without timeout or delayed reapplication, including the equivalent dedicated-window path, per FR-005, US2/AC3, SC-007, T088, and T098 (implemented; main captures queued and pre-acknowledgement ordinary participant submissions as prefix work, resolves each once before replay, and retains document/revision/sequence fences; real workbench queue and dedicated hook regressions pass).

## Phase 13: Convergence

**Acceptance disposition (2026-09-09):** T085 is considered complete at the user's explicit direction. This supersedes its earlier unchecked status without asserting additional native-platform or running-engine test evidence. T087 remains open; use the end-to-end measurement protocol in quickstart.md, not coordinator-only timings. Earlier task text is preserved under the convergence append-only contract.

- [X] T104 HIGH Supply live-reconcilable inverse patches for supported BSB instrument control/preset and mixer effect parameter edits in packages/blue-app/src/main/project-history.ts and verify their runtime classification in packages/blue-app/src/main/project-runtime-reconciliation.ts. Cover edit/undo/redo in timeline and Blue Live, including the restored values and positive acknowledgements, rather than falling back to the structuralChange restart-required placeholder for live-supported undo, per FR-014, FR-015, US3/AC1, T041, and T043 (implemented; concrete BSB value/XY/slider-bank/dropdown/checkbox/preset and effect inverses, generation aliases, and two-performance acknowledgement/readback coverage pass).
- [X] T105 HIGH Integrate committed project-property text inputs and textareas in packages/blue-app/src/renderer/components/workbench/panels/project-properties/ProjectPropertyFields.tsx and their callers with explicit project-history scope, synchronous local text buffering, acknowledged canonical updates, and operation-aware grouping metadata. Test rapid typing, delayed acknowledgements, grouped undo/redo, blur, and cross-window settlement; keep genuinely uncommitted draft editors draft-scoped, per FR-008, FR-009, FR-010, and T054 (implemented; stable field IDs, project/none scope markers, canonical update metadata, and settlement-backed grouping coverage pass).
- [X] T106 HIGH Implement the specified insertion/deletion runs, atomic replacement/paste operations, and whitespace/newline boundaries in packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx using CodeMirror transaction information. Preserve existing selection, pause, composition, and settlement behavior; add project-history tests demonstrating distinct groups for operation switches and word boundaries rather than only a resettable debounce timer, per FR-008 and US4/AC2 (implemented; transaction classification and insert/delete/mutation/boundary/selection regression coverage pass).
- [X] T107 HIGH Preserve inserted-text information when classifying native insertText events in packages/blue-app/src/renderer/hooks/use-batched-text-editor.ts so whitespace/newline detection closes the current group. Add realistic InputEvent-metadata coverage through InstrumentCommentsPanel as well as the hook: typing "a", "a ", then "a b" must not remain one gesture, per FR-008 (implemented; InputEvent.data is forwarded through native text callers and hook/panel gesture coverage passes).
- [X] T108 HIGH Make active composition settle safely in packages/blue-app/src/renderer/hooks/use-batched-text-editor.ts: the registered history settlement callback must wait for composition completion or reject the boundary while preserving the draft, not call flush successfully on unfinished composition. Test undo/save initiated from another window during composition, timeout/abort, and late composition completion without partial commits or post-replay reapplication, per FR-005, FR-008, US2/AC3, US4/AC2, and T100 (implemented; composition settlement waits and rejects after one second, late completion does not replay, and focused fail-closed coverage passes).
- [X] T109 MEDIUM Preserve pending project-scoped CodeMirror text across owner navigation and panel/popout teardown in packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx and the relevant lifecycle owners. Settle against the original owner before disposal or retain an explicit recoverable draft; do not merely cancel pendingValueRef and do not reintroduce stale writes after disposal. Add a production-lifecycle regression for typing followed by close/navigation within the grouping interval without a prior blur, per FR-007, FR-008, and US2/AC5 (implemented; non-composing pending project text flushes before teardown and active composition drafts are retained for remount, with lifecycle coverage passing).

## Phase 14: Convergence

**Handoff review (2026-09-09):** The optional-undefined patch validation, direct BSB preset channel writer, undo/redo failure reporting, and BSB action labels are present. The existing app suite passes (4,589 tests; 2 skipped), but focused in-memory probes reproduce rejected-receipt settlement, concurrent-preview draining, and mixer insertion-identity failures; rendering ScratchPadPanel with the current scope resolver also identifies its committed text as a native draft. T085 remains accepted and T087 remains open without duplication. Repository lint fails only its formatting check for HANDOFF-103-undo-redo.md; this review does not modify that handoff or application code.

- [X] T110 CRITICAL Handle error-bearing commit receipts in the settlement drain as explicit failures in packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts, consistently with the ordinary drain. A pending mixer patch receiving `{ changed: false, error: ... }` during prepare-history-boundary currently produces a zero-outstanding acknowledgement without canonical refresh or error reporting. Preserve the unresolved prefix, refresh canonical state, report the rejection, and acknowledge failure so Undo/Save cannot proceed as though the edit settled successfully. Add focused ordinary/boundary receipt-error regressions in packages/blue-app/src/renderer/tests/project-patch-queue.test.ts and exercise barrier abortion against the real coordinator in packages/blue-app/src/main/project-history-settlement.test.ts per Constitution III, FR-005, US2/AC3, and SC-007 (implemented; boundary and ordinary error receipts refresh canonical state, retain failed prefixes, report errors, and real-coordinator abort coverage passes).
- [X] T111 HIGH Restore serialized, drainable runtime previews in packages/blue-app/src/main/project-runtime-reconciliation.ts without reintroducing the BSB preset self-deadlock fixed by the direct writer in packages/blue-app/src/main/main.ts. The per-performance executing flag currently lets unrelated concurrent previewChannelValue calls run outside performance.chain, so drainPreviews resolves while such a preview remains in flight and a late write can follow restoration. Remove or narrowly replace this bypass; keep ordinary previews tracked, ordered, and fenced by gesture/performance lifetime. Add deterministic delayed-plan/concurrent-preview/undo regressions in packages/blue-app/src/main/project-runtime-reconciliation.test.ts covering timeline and Blue Live, proving drain waits for every submitted preview and no stale write follows replay per FR-005, FR-015, US3/AC1, US3/AC5, and plan: ordered runtime reconciliation (implemented; all previews remain on per-performance chains, stable drain observes appended work, and timeline/Blue Live delayed ordering coverage passes).
- [X] T112 HIGH Allocate fresh mixer insertion identities once in the patch intent and use them consistently in packages/blue-app/src/shared/project-editor/contract.ts, packages/blue-app/src/renderer/stores/project-store.ts, and packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts. duplicateChainEntry currently generates unrelated renderer/main IDs, and an effect duplicate also generates a different projectRef.entryId; pasteChainEntries reuses source-derived IDs on repeated pastes. Ensure each duplicate/paste gets distinct IDs shared by optimistic snapshots, canonical models, and editor references. Add regressions for effects and sends that duplicate or paste twice, then edit/remove the intended insertion before and after acknowledgement, and undo/redo without changing identities or touching another entry per FR-004, FR-006, SC-001, and T023 (implemented; duplicate/paste intents carry stable fresh IDs through optimistic and canonical paths, including effect refs and repeated-paste tests).
- [X] T113 HIGH Integrate committed Scratch Pad text with the existing buffered project-text history behavior in packages/blue-app/src/renderer/components/workbench/panels/ScratchPadPanel.tsx, packages/blue-app/src/renderer/hooks/use-batched-text-editor.ts, and packages/blue-app/src/renderer/stores/project-store.ts. The textarea currently defaults to native draft undo while every onChange submits a durable patch without field/gesture metadata. Supply explicit project scope, semantic labels, operation-aware insertion/deletion/replacement and word/pause boundaries, and safe composition/Undo/Save settlement without adding a separate history stack. Extend packages/blue-app/src/renderer/tests/scratch-pad-panel.test.tsx with production-path grouped typing, focused shortcut routing, cross-editor chronology, canonical no-echo, and delayed/composing input settlement regressions per FR-008, FR-009, FR-010, US4/AC1, and US4/AC2 (implemented; Scratch Pad uses project-scoped buffered text settlement with operation metadata, composition/selection/blur routing, and production grouped typing coverage).
- [X] T114 MEDIUM Complete semantic action labels for the remaining confirmed unlabeled commands in packages/blue-app/src/renderer/stores/project-store.ts and packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx. At minimum, setLoopRendering, addMarkerAtTime, and alignment actions through commitMoves currently reach the main fallback label Edit Project. Pass descriptive labels from these semantic callers, preserving compound grouping and existing BSB labels; verify the resulting undoLabel/redoLabel through actual dispatch and canonical history rather than helper-only tests per FR-010, US4/AC4, and plan: action labels at semantic callers (implemented; loop rendering, marker, score/track alignment actions carry semantic labels; renderer dispatch and canonical undo/redo label tests pass).

## Phase 15: Convergence

**Verification (2026-09-10):** The prior rejected-receipt and duplicate/repeated-paste identity probes now pass; Scratch Pad project scope/grouping and the identified semantic labels are implemented. The app suite passes (4,598 tests; 2 skipped), and the main-process no-emit type check passes. A new delayed-preview probe reproduced an obsolete request writing to replacement performances; T115 fixed the generation fence and its focused suite now passes. T116 replaced the component-only T087 measurement paths with production browser, running-engine, and packaged Electron acceptance boundaries. Existing task text and completion markers are preserved; T085's accepted disposition is not reopened. HANDOFF-103-undo-redo.md still fails its targeted formatting check and was not modified.

- [X] T115 HIGH Fence each runtime preview to the performance instances and generations present when it was submitted in packages/blue-app/src/main/project-runtime-reconciliation.ts. previewChannelValue currently iterates the live performances Map across awaited writes; if the first write is delayed while performances are stopped/re-registered, the iterator visits the replacement instances and sends them the obsolete value. Capture the original target set before awaiting, retain execution-time liveness/gesture checks, and do not treat an obsolete acknowledgement as successful synchronization of a replacement performance. Add deterministic regressions in packages/blue-app/src/main/project-runtime-reconciliation.test.ts that delay the first target, replace one or both timeline/Blue Live performances (including project-replacement disposal), release the old acknowledgement, and assert the new clients receive no old writes while fresh requests still succeed; preserve T111's queue/drain ordering guarantees per FR-015, FR-017, US3/AC5, SC-007, and T111 (implemented; submitted performance/generation snapshots fence delayed writes and obsolete acknowledgements, with 38 focused tests passing).
- [X] T116 MEDIUM Complete T087's actual end-to-end acceptance boundary in packages/blue-app/src/renderer/browser/global-project-history.browser.test.tsx, packages/blue-app/src/main/global-history-engine.integration.test.ts, the native Electron acceptance harness, and specs/103-global-undo-redo/quickstart.md. The current browser measurement calls a vi.fn commit with empty patches, fabricated publications, test-only views, and a dirty-state status field; the engine timer starts inside applyOperation and measures only setChannel/getChannel after direct reconciliation calls rather than project Undo/Redo. Measure genuine Undo/Redo command receipt through production routing, settlement, canonical history replay, and painted production views in the affected hosting windows on the agreed representative workload, correlating operation IDs/revisions with positive timeline and Blue Live engine acknowledgements. Include injected runtime failures and determination-to-visible-error latency, five warmups, 100 measured actions, p50/p95/max, retained bytes, and heap evidence. Keep existing timings explicitly labeled as component benchmarks, and record the end-to-end result or exact unexecuted boundary without claiming completion from those benchmarks alone; do not reopen T085's accepted native-platform disposition per SC-003, SC-004, T066, T087, and plan: performance validation (implemented; production browser, running-engine, and freshly rebuilt packaged Electron native-menu boundaries pass; physical accelerator delivery on other platforms remains manual/unexecuted evidence documented in quickstart.md).

## Phase 17: Handoff follow-up

**Handoff reconciliation (2026-09-10):** These tasks capture the remaining gaps identified in `HANDOFF-103-undo-redo.md` that were not already represented by T110–T116. T121 is complete as part of this reconciliation; the other tasks remain explicit follow-up work.

- [ ] T117 HIGH Add a table-driven commit→undo→redo round-trip suite covering every `ProjectDocumentPatch` variant, asserting affected-subtree canonical equality, identity preservation, empty-history behavior after the second undo, and redo restoration through a real `ProjectHistory`/`ProjectSession` in packages/blue-app/src/main/project-history-roundtrip.test.ts and packages/blue-app/src/main/project-history-patch-classification.test.ts per FR-002, FR-003, FR-004, and SC-007.
- [ ] T118 HIGH Add renderer coverage that surfaces failed and invalid project Undo/Redo responses as visible feedback, plus a main settlement regression where one registered history participant never acknowledges while the remaining participants settle, in packages/blue-app/src/renderer/tests/history-scope-router.test.tsx and packages/blue-app/src/main/project-history-settlement.test.ts per FR-005, FR-017, and SC-007.
- [ ] T119 MEDIUM Add mixer duplicate/paste lifecycle coverage proving renderer-generated entry IDs are adopted canonically and remain usable for remove-before-acknowledgement, remove-after-acknowledgement, and undo/redo of effect and send insertions in packages/blue-app/src/renderer/tests/mixer-chain-clipboard.test.ts and packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.test.ts per FR-004, FR-006, and SC-001.
- [ ] T120 MEDIUM Add a shared patch-contract/type-level regression that documents the structured-clone policy for intentionally explicit `undefined` optional fields while rejecting unsupported non-JSON values in packages/blue-app/src/shared/project-history.ts and packages/blue-app/src/shared/project-history.test.ts per Constitution III and T110.
- [X] T121 HIGH Remove the obsolete renderer-local score-color history stack and route layer-color, item-color, “Set to Layer Color,” and “Apply Layer Color to All Clips” actions through the main-owned project history in packages/blue-app/src/renderer/stores/score-color-history-store.ts, packages/blue-app/src/renderer/components/workbench/panels/score/score-color-actions.ts, packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx, packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx, packages/blue-app/src/renderer/tests/score-color-history-store.test.ts, and packages/blue-app/src/renderer/tests/score-layer-color-actions.test.tsx; update the canonical-writer contract and 096/103 spec evidence so no active design depends on the removed store per FR-001, FR-003, and FR-010 (implemented; the store and local-history tests were deleted, color builders now return forward canonical patches, and semantic color actions commit through `ProjectHistory`).
- [ ] T122 MEDIUM Make track-instrument save/realtime failures user-visible instead of console-only, preserving the existing fail-closed document behavior and adding a focused regression in packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx, packages/blue-app/src/renderer/components/track-instrument-editor/track-instrument-patch-queue.ts, and packages/blue-app/src/renderer/tests/track-instrument-editor-window.test.tsx per FR-005, FR-015, and FR-017.
- [ ] T123 MEDIUM Audit and enforce semantic labels for every durable `applyProjectDocumentPatch` caller, including secondary score moves, track-instrument editor score patches, Scratch Pad, transport toggles, and other remaining fallback `Edit Project` actions, with caller-side labels and regression coverage in packages/blue-app/src/renderer/stores/project-store.ts, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx, packages/blue-app/src/renderer/components/workbench/panels/ScratchPadPanel.tsx, packages/blue-app/src/shared/project-editor-action-labels.test.ts, and the project-history writer audit per FR-003 and FR-010.
- [ ] T124 LOW Prevent library drop-marker feedback from visually bleeding into the Libraries panel while retaining an accessible live announcement, and add an incompatible-drop regression in packages/blue-app/src/renderer/components/libraries/use-library-drop-target.ts, packages/blue-app/src/renderer/components/libraries/LibraryDropMarker.tsx, and packages/blue-app/src/renderer/tests/library-editing.test.tsx per Constitution VI and SC-007.
- [ ] T125 MEDIUM Decide and document whether fenced-performance recovery should remain restart-required or automatically resynchronize; if automatic resync is retained, implement generation-scoped resynchronization and prove it cannot apply stale values to replacement performances in packages/blue-app/src/main/project-runtime-reconciliation.ts, packages/blue-app/src/renderer/stores/project-store.ts, packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts, and packages/blue-app/src/main/project-runtime-reconciliation.test.ts per FR-015, FR-016, FR-017, and SC-008.
