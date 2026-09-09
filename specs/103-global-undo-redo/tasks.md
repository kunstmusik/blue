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
