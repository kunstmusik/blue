---

description: "Actionable task list for Mixer Audio Mute and Solo"
---

# Tasks: Mixer Audio Mute and Solo

**Input**: Design documents from `/specs/111-mixer-mute-solo/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/mixer-mute-solo.md`, and `quickstart.md`

**Verification**: This feature crosses portable data, XML, CSD generation, Electron runtime, engine transport, UI, and project history. Tasks below include the constitution-required compatibility, state-ownership, boundary-contract, runtime, UI, host-path, serialization, and commit→undo→redo verification.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independently observable increment after the shared foundation.

## Path Conventions

- Portable data and CSD generation: `packages/blue-data/src/`
- Electron main/preload/renderer: `packages/blue-app/src/main/`, `src/preload/`, and `src/renderer/`
- Typed editor and history boundaries: `packages/blue-app/src/shared/project-editor/` and `packages/blue-app/src/shared/project-history.ts`
- Engine client: `packages/blue-engine-client/src/` with tests in `packages/blue-engine-client/tests/`
- Native batch-contract reference: `native/blue-engine/src/engine/RealtimeChannelMailbox.h`
- Feature design and validation records: `specs/111-mixer-mute-solo/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish implementation fixtures and confirm the parity/runtime seams before feature code is changed.

- [X] T001 Reconfirm Java-compatible event filtering and stored mixer-flag behavior against `/Users/stevenyi/work/nbprojects/blue/blue-score-layers-audio-core/src/main/java/blue/score/layers/audio/core/AudioLayer.java`, `/Users/stevenyi/work/nbprojects/blue/blue-score-layers-audio-core/src/main/java/blue/score/layers/audio/core/AudioLayerGroup.java`, `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/mixer/Channel.java`, and `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/mixer/MixerNode.java`; record any implementation-relevant divergence in `specs/111-mixer-mute-solo/research.md`.
- [X] T002 [P] Extend deterministic CSD/audio fixture support in `packages/blue-data/src/test-support/csd-render-fixtures.ts` and `packages/blue-data/src/test-support/csd-comparison.ts` for optimized versus pruning-disabled renders, exact sample-count/duration comparison, and a peak residual threshold of `-120 dBFS`.
- [X] T003 [P] Add injectable mixer-gate engine doubles for batched writes, reads, capability absence, queue-full responses, delayed applied tokens, and failed staging in `packages/blue-app/src/main/mixer-mute-solo-test-support.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define canonical ownership and typed boundaries that every user story relies on.

**⚠️ CRITICAL**: No user story work can be considered complete until this phase is complete.

- [X] T004 [P] Define serializable track-header mode, effective-mode diagnostic, detached mixer-route indicator, generation-scoped gate binding, and mixer-gate runtime operation types in `packages/blue-app/src/shared/project-editor/contract.ts`; export the public types from `packages/blue-app/src/shared/project-editor/index.ts` and align them with `specs/111-mixer-mute-solo/contracts/mixer-mute-solo.md`.
- [X] T005 [P] Add stable identity capture/lookup seams for channel, mixer-entry, and `Track.uniqueId` associations in `packages/blue-app/src/shared/project-editor/identity.ts`, `packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts`, and `packages/blue-app/src/shared/project-editor/snapshot-score.ts`; keep display names out of delayed runtime mapping.
- [X] T006 Add typed patch validation, preparation classification, and semantic action-label support for mixer M/S fields, track-header mode, mixer enable, and whole-patch master-solo rejection in `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/shared/project-editor/patch-document.ts`, `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`, and `packages/blue-app/src/shared/project-editor-action-labels.test.ts`.
- [X] T007 Add the `mixer-gates` runtime operation to generation/revision/performance classification and preserve pending, applied, restart-required, failed, and stale outcomes in `packages/blue-app/src/main/project-runtime-reconciliation.ts`, `packages/blue-app/src/shared/project-history.ts`, and `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`.
- [X] T008 Verify and, if needed, minimally extend the existing batch-channel capability guard and all-or-error `setChannels`/`getChannels` contract in `packages/blue-engine-client/src/engine-client.ts`, `packages/blue-engine-client/src/capabilities.ts`, `packages/blue-engine-client/tests/engine-client.test.ts`, and `packages/blue-engine-client/tests/capabilities.test.ts`; enforce the existing 256-entry request bound and compare behavior with `native/blue-engine/src/engine/RealtimeChannelMailbox.h` without introducing a new native protocol.
- [X] T009 Connect the existing main-to-renderer runtime outcome boundary to the new mixer-gate statuses in `packages/blue-app/src/preload/preload.ts`, `packages/blue-app/src/renderer/types/global.d.ts`, `packages/blue-app/src/renderer/stores/project-store.ts`, and `packages/blue-app/src/main/main.ts`; keep desired/applied revisions and diagnostics disposable rather than project XML state.
- [X] T010 Add a boundary regression suite in `packages/blue-app/src/shared/project-editor/mixer-mute-solo-contract.test.ts` proving that renderer intents are serializable, runtime symbols/route masks/applied tokens are not persisted, and canonical project values remain owned by the main document bridge.
- [X] T011 Add a shared project-history writer audit for the new patch fields in `packages/blue-app/src/main/project-history-writer-audit.test.ts`, proving that every durable mixer, mode, and mixer-enable writer supplies a semantic label and reaches the canonical `ProjectHistory` path.

**Checkpoint**: Typed boundaries, identity rules, batch transport assumptions, and canonical history ownership are defined and tested; user-story implementation can now proceed.

---

## Phase 3: User Story 1 - Silence and audition mixer channels (Priority: P1) 🎯 MVP

**Goal**: Make explicit mute and additive, routing-aware solo work on instrument channels, track channels, subchannels, and master mute during realtime playback without restarting events.

**Independent Test**: Use two distinguishable sources with direct output, pre-fader sends, post-fader sends, a shared return, and a master channel; verify the route matrix, mute-wins behavior, meter placement, 100 ms response, and both timeline and BlueLive performance paths.

### Verification for User Story 1

> Add the regressions before implementation where the existing harness can reproduce the missing behavior.

- [X] T012 [P] [US1] Add pure route-policy regression cases for no solos, source solo, return solo, multiple-solo union, explicit mute winning over solo, muted master, ignored master solo, disconnected channels, shared summed buses, zero-amount enabled sends, disabled sends, and unresolved/cyclic topology in `packages/blue-data/src/mixer/mute-solo-policy.test.ts`.
- [X] T013 [P] [US1] Add CSD regressions for send-tap gates, post-effects final-output gates, effect/tail execution, master mute, initial silent values, 5 ms ramps, post-gate meters, deterministic numeric symbols, and all standard sync/async/BlueLive render profiles in `packages/blue-data/src/blue-data/csd-policy.test.ts`, `packages/blue-data/src/blue-live-csd.test.ts`, and `packages/blue-data/src/blue-data-csd-copy-safety.test.ts`.
- [X] T014 [P] [US1] Add runtime publication contract tests for complete-vector staging, inactive-bank selection, 256-entry batching, monotonically increasing commit tokens, applied-token observation, queue-full retry, missing capability, failed staging, uncertain acknowledgment, stale revisions, stale generations, and independent timeline/BlueLive outcomes in `packages/blue-app/src/main/mixer-mute-solo-runtime.test.ts`.
- [X] T015 [P] [US1] Add browser coverage for non-master M/S controls, master M-only controls, explicit-versus-derived exclusion indicators, wet-only send visibility, keyboard operation, accessible names/pressed state, and no master Solo action in `packages/blue-app/src/renderer/browser/mixer-mute-solo.browser.test.tsx` and `packages/blue-app/src/renderer/tests/mixer-panel.test.tsx`.
- [X] T016 [P] [US1] Add real-engine integration scenarios for transport continuity, no retriggered events, UI-to-audio latency under 100 ms, 32-source/64-send publication, and a gate vector larger than 256 entries in `packages/blue-app/src/main/global-history-engine.integration.test.ts`.

### Implementation for User Story 1

- [X] T017 [US1] Implement the host-neutral detached route policy in `packages/blue-data/src/mixer/mute-solo-policy.ts` using deterministic ordered edges and forward/reverse visited-set traversal; discover explicit non-master solos before pruning muted paths, preserve required feeder/return paths, make explicit mute win, ignore master solo, and return route indicators without mutating `Channel` objects.
- [X] T018 [US1] Build the compile-time route topology and generation-scoped gate catalog in `packages/blue-data/src/blue-data/csd-policy.ts`, extending `RenderCsdResult` with deterministic numeric gate locators, two bank names, initial targets, commit/applied token names, topology signature, and pre-clone editor/track identity locators; ensure derived bindings are absent when the mixer is disabled and are never serialized.
- [X] T019 [US1] Emit gates at every existing send tap and after each channel's local post-effects processing in `packages/blue-data/src/blue-data/csd-policy.ts`; retain events/effects, place output meters after the final output gate, apply master mute to master sends/output, initialize both banks, use reserved `gk_blue_mixgate_` numeric symbols, and implement the shared 5 ms transition ramp with exact 0/1 settling.
- [X] T020 [US1] Thread the complete gate-binding result through the stable data façade and every realtime generation entry point in `packages/blue-data/src/blue-data.ts` and `packages/blue-data/src/blue-data/csd-policy.ts`, covering standard synchronous/asynchronous playback and `toBlueLiveCSD()` while preserving existing low-level callers and CSD ordering.
- [X] T021 [US1] Implement the serialized per-performance gate publication coordinator in `packages/blue-app/src/main/mixer-mute-solo-runtime.ts`; stage the full detached target vector only in the inactive bank using batches of at most 256 entries, publish one commit token after successful staging, wait for the applied token before reporting success or reusing a bank, preserve the last audible bank on failure, and coalesce only current revisions.
- [X] T022 [US1] Wire the mixer-gate operation into `packages/blue-app/src/main/project-runtime-reconciliation.ts`, `packages/blue-app/src/main/engine-bridge.ts`, `packages/blue-app/src/main/blue-live-engine.ts`, and `packages/blue-app/src/main/main.ts`; use separate timeline/BlueLive catalogs and acknowledgments, keep M/S edits restart-free, and leave topology/mode/mixer-enable changes on the restart-required workflow.
- [X] T023 [US1] Route mixer M/S edits through committed document snapshots in `packages/blue-app/src/renderer/stores/project-store.ts`, `packages/blue-app/src/shared/project-editor/patch-document.ts`, and `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`; reject any master-solo patch before applying companion fields or creating history, then derive runtime targets only from the committed canonical state.
- [X] T024 [US1] Implement mixer strip controls and derived route presentation in `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`; show non-master M/S and master M only, preserve fader/effect state, distinguish explicit mute/solo from solo exclusion and allowed sends, expose accessible keyboard-operable controls, and show inactive/runtime status as supplied by the typed snapshot.
- [X] T025 [US1] Run the focused policy, CSD, runtime, browser, and real-engine checks described in `specs/111-mixer-mute-solo/quickstart.md`; verify every acceptance route, no partial audible bank publication, unchanged transport/event execution, and the documented 100 ms measurement on both performance kinds.

**Checkpoint**: A composer can mute or audition every supported mixer channel during playback, with master mute-only behavior and accurate explicit/derived indicators, while the existing project remains the canonical state owner.

---

## Phase 4: User Story 2 - Choose track header behavior without losing mixer controls (Priority: P1)

**Goal**: Persist Audio/Event track-header behavior, preserve legacy event semantics, synchronize Audio headers with associated mixer channels, and force Event behavior safely when the mixer is disabled.

**Independent Test**: Create a new project and open fixtures with absent, invalid, and explicit mode properties; exercise track headers, associated strips, event flags, audio flags, mode changes, and mixer bypass while checking saved XML and generated events.

### Verification for User Story 2

- [X] T026 [P] [US2] Add XML/default/copy regression cases for new-project Audio, missing `projectProperties` Event fallback, missing mode element Event fallback, explicit Audio/Event values, invalid raw values, untouched legacy omission, explicit replacement of an invalid raw value, unknown-data preservation, and master-solo compatibility in `packages/blue-data/src/project-properties.test.ts`, `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`, and `packages/blue-data/src/blue-data/xml-policy.ts`.
- [X] T027 [P] [US2] Add score-generation regressions for Audio mode ignoring track event flags and global track event solo, Event mode retaining existing score-wide filtering, effective Event behavior when mixer is disabled, synchronous/asynchronous parity, and no temporary mutation of `Track` flags in `packages/blue-data/src/score/score-generation-options.test.ts`, `packages/blue-data/src/score/score.test.ts`, and `packages/blue-data/src/score/track/track-layer-group.test.ts`.
- [X] T028 [P] [US2] Add typed patch and revision-race tests for mode changes, expected effective mode/association, missing association repair/reporting, preserved independent flag sets, and restart-required feedback in `packages/blue-app/src/shared/project-editor/mixer-mute-solo-contract.test.ts`, `packages/blue-app/src/shared/project-editor-track-mixer.test.ts`, and `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`.
- [X] T029 [P] [US2] Add browser and component coverage for Audio/Event selector behavior, explanatory independent-state messaging, synchronized Audio header/strip state, Event header independence, disabled-mixer override, inactive strip controls, accessible mode labels, and keyboard-operable header M/S buttons in `packages/blue-app/src/renderer/browser/track-header-mute-solo.browser.test.tsx`, `packages/blue-app/src/renderer/tests/track-header-mute-solo.test.tsx`, and `packages/blue-app/src/renderer/tests/project-properties-mute-solo.test.tsx`.

### Implementation for User Story 2

- [X] T030 [US2] Implement `trackLayerMuteSoloMode` persistence and provenance in `packages/blue-data/src/project-properties.ts` and `packages/blue-data/src/blue-data/xml-policy.ts`: honor the data-model rule `trackLayerMuteSoloMode: audio/event; New Audio, loaded absence/invalid Event. Preserve unsupported raw value until explicit replacement.`, retain presence/raw text across copy/save/load, default absent `projectProperties` to Event, and expose an unsupported-value diagnostic.
- [X] T031 [US2] Add the mode, raw/presence metadata, effective-mode diagnostic, and legacy active-mixer-state notice to serializable snapshots and canonical patch application in `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts`, `packages/blue-app/src/shared/project-editor/snapshot-score.ts`, `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`, `packages/blue-app/src/shared/project-editor/patch-document.ts`, and `packages/blue-app/src/renderer/stores/project-store.ts`.
- [X] T032 [US2] Extend `ScoreGenerationOptions` and both score-generation paths in `packages/blue-data/src/score/score-generation-options.ts`, `packages/blue-data/src/score/score.ts`, and `packages/blue-data/src/score/track/track-layer-group.ts` so that effective Event mode alone controls event inclusion; ensure Audio-mode Track groups opt out of global event-solo discovery, Event mode preserves the Java-compatible behavior, and no track flags are copied, cleared, or temporarily mutated.
- [X] T033 [US2] Resolve Audio header actions to the stable associated mixer channel and Event header actions to the existing layer-state patch in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/stores/project-store.ts`, `packages/blue-app/src/shared/project-editor/identity.ts`, and `packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts`; validate expected mode/association against the current revision and repair or report a missing association before accepting an edit.
- [X] T034 [US2] Add the Audio/Event selector, saved-versus-effective mode explanation, invalid-value diagnostic, and legacy mixer compatibility notice to `packages/blue-app/src/renderer/components/workbench/panels/ProjectPropertiesPanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/project-properties/ProjectInformationTab.tsx`; submit one semantic ProjectHistory action per mode change.
- [X] T035 [US2] Make mixer bypass behavior explicit in `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`: false mixer enable forces Event headers, keeps the saved preference and all channel flags intact, disables audio strip controls with an explanation, and restores the saved Audio authority when re-enabled.
- [X] T036 [US2] Classify mode and mixer-enable changes as restart-required while preserving audio M/S as live work in `packages/blue-app/src/main/project-runtime-reconciliation.ts`, `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/renderer/stores/project-store.ts`, and `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`; publish accurate status rather than silently applying the wrong domain.
- [X] T037 [US2] Run the compatibility, score-generation, browser, save/reload, and revision-race scenarios in `specs/111-mixer-mute-solo/quickstart.md`; verify both independent flag sets, legacy Event behavior, new-project Audio behavior, bypass override, rename/reorder association stability, and no state copying during mode switches.

**Checkpoint**: Track headers visibly and durably control the selected domain, legacy projects retain Event semantics, Audio headers share channel state, and mixer bypass is an explicit effective-mode override.

---

## Phase 5: User Story 3 - Render an equivalent mix with less unnecessary event work (Priority: P2)

**Goal**: Apply the same effective mute/solo policy to disk CSD generation, prune only provably inaudible AudioClip-only events, preserve duration, and leave uncertain projects unpruned.

**Independent Test**: Compare optimized and pruning-disabled deterministic renders for eligible AudioClip-only, mixed-content, shared-send, soloed-return, muted-master, tempo/window, and extra-render-time fixtures; check audio residual, sample count, event presence, and project immutability.

### Verification for User Story 3

- [X] T038 [P] [US3] Add disk-pruning eligibility and route-survival tests for direct output, pre/post sends, soloed returns, muted master/all-pruned output, mixed content, opaque effects, custom code, note processors, unknown extensions, unresolved routing, and cycles in `packages/blue-data/src/blue-data-csd-disk.test.ts`.
- [X] T039 [P] [US3] Add duration/scheduling regressions for pruning the longest clip, nonzero render windows, tempo mapping, AudioClip fades/looping, all-pruned output, global score duration, and mixer extra render time in `packages/blue-data/src/blue-data-csd-scheduling.test.ts` and `packages/blue-data/src/blue-data-csd-determinism.test.ts`.
- [X] T040 [P] [US3] Add export immutability and sync/async parity tests proving no project edits, dirty-state changes, or history entries on successful or failed export in `packages/blue-app/src/main/csd-export.test.ts`, `packages/blue-app/src/main/csd-generation.test.ts`, and `packages/blue-app/src/main/render-to-disk.test.ts`.

### Implementation for User Story 3

- [X] T041 [US3] Implement the conservative disk-pruning classifier in `packages/blue-data/src/blue-data/csd-policy.ts` and `packages/blue-data/src/score/score-generation-options.ts`; certify only built-in AudioClip-only Tracks with empty score note-processor chains, no custom global/track/orchestra code, no opaque enabled mixer effects, no unknown executable extensions, and valid acyclic routing, and fall back to ordinary gated rendering for every uncertain case.
- [X] T042 [US3] Share the unpruned duration-bound calculation with the event scheduler in `packages/blue-data/src/blue-data/csd-policy.ts`, `packages/blue-data/src/score/score.ts`, and `packages/blue-data/src/score/track/track-layer-group.ts`; preserve render-window, tempo, clip, global-duration, all-pruned, and mixer extra-render-time behavior without generating and discarding the omitted notes.
- [X] T043 [US3] Apply the same detached route policy with fixed disk gate targets and a test-only pruning-disable oracle across synchronous/asynchronous disk and realtime/BlueLive generation in `packages/blue-data/src/blue-data/csd-policy.ts`, `packages/blue-data/src/blue-data.ts`, and `packages/blue-data/src/blue-live-csd.test.ts`; retain effects and gates and never enable disk pruning in realtime.
- [X] T044 [US3] Keep export derivation detached from the canonical project and history in `packages/blue-app/src/main/csd-export.ts`, `packages/blue-app/src/main/csd-generation.ts`, `packages/blue-app/src/main/project-history.ts`, and `packages/blue-app/src/renderer/stores/project-store.ts`; verify failed exports leave the same XML, dirty state, history cursor, and runtime state.
- [X] T045 [US3] Run the deterministic optimized/unoptimized float-render comparisons and fallback fixtures in `specs/111-mixer-mute-solo/quickstart.md`; require identical sample counts/duration, peak residual no greater than `-120 dBFS`, absence of only eligible inaudible events, retention of soloed-return feeders, and no unsafe pruning for mixed or unknown content.

**Checkpoint**: Disk export saves event-generation work only when equivalence is proven, retains the same audible result and duration, and otherwise relies on the same audio gates without mutating the project.

---

## Phase 6: User Story 4 - Preserve edits and recover them (Priority: P2)

**Goal**: Make M/S, mode, and mixer-enable edits durable, semantically undoable, identity-stable, and accurately recoverable when runtime publication fails.

**Independent Test**: For each affected action, commit, save, reload, undo, redo, and repeat while stopped and during both timeline and BlueLive playback; compare canonical flags, mode, associations, dirty state, published snapshots, and runtime outcomes.

### Verification for User Story 4

- [X] T046 [P] [US4] Add commit→undo→redo coverage for channel mute/solo, master mute, track-header mode, mixer enable, and combined edits in `packages/blue-app/src/main/project-history-roundtrip.test.ts`, `packages/blue-app/src/main/global-project-history.test.ts`, and `packages/blue-app/src/main/project-history-writer-audit.test.ts`; assert semantic labels, canonical values, dirty state, and exactly one history action per edit.
- [X] T047 [P] [US4] Add runtime recovery tests for successful application, failed staging, missing capability, queue-full, stale revision/generation, uncertain commit acknowledgment, delayed applied token, and latest-canonical reconciliation in `packages/blue-app/src/main/mixer-mute-solo-runtime.test.ts` and `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`.
- [X] T048 [P] [US4] Add save/reload preservation tests for both event/audio flag sets, mode presence/raw metadata, unknown XML, channel associations, legacy master solo, and active legacy channel flags in `packages/blue-data/src/project-properties.test.ts`, `packages/blue-data/src/mixer/mixer.test.ts`, and `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`.
- [X] T049 [P] [US4] Add stopped/running timeline and BlueLive integration coverage for concurrent sessions, separate generations, current transport position, undo/redo runtime reconciliation, and one performance failing while the other succeeds in `packages/blue-app/src/main/global-history-engine.integration.test.ts`.

### Implementation for User Story 4

- [X] T050 [US4] Route every durable M/S, mode, and mixer-enable writer through the canonical commit path with semantic labels and exact rollback/redo preparation in `packages/blue-app/src/renderer/stores/project-store.ts`, `packages/blue-app/src/shared/project-editor/patch-document.ts`, `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`, and `packages/blue-app/src/main/project-history.ts`.
- [X] T051 [US4] Preserve stable channel/track identities and associations across history snapshots, save/load, rename/reorder, undo, and redo in `packages/blue-app/src/shared/project-editor/identity.ts`, `packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts`, `packages/blue-app/src/shared/project-editor/snapshot-score.ts`, and `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`.
- [X] T052 [US4] Surface saved intent versus pending/applied/failed playback state and reconcile failures to the canonical document in `packages/blue-app/src/main/project-runtime-reconciliation.ts`, `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/renderer/stores/project-store.ts`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx` without silently rolling back or overwriting the edit.
- [X] T053 [US4] Enforce whole-patch master-solo rejection before history preparation, retain legacy master-solo XML as inert compatibility data, and keep master capability/effective state separate in `packages/blue-app/src/shared/project-editor/patch-document.ts`, `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`, `packages/blue-app/src/shared/project-editor/contract.ts`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`.
- [X] T054 [US4] Execute the complete history/recovery matrix in `specs/111-mixer-mute-solo/quickstart.md`; confirm one undo and one redo restore canonical values, stable references, associations, dirty state, published views, and required runtime reconciliation for stopped and running performances.

**Checkpoint**: Every durable control edit can be saved/reloaded and committed/undone/redone without identity loss, while runtime failures remain visible and recover to the canonical project intent.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete parity, accessibility, portability, stress, and repository-level validation before delivery.

- [X] T055 [P] Audit new host/runtime fixtures and Csound text boundaries in `packages/blue-app/src/main/mixer-mute-solo-runtime.ts`, `packages/blue-app/src/main/mixer-mute-solo-runtime.test.ts`, and `packages/blue-data/src/blue-data/csd-policy.ts`; keep native filesystem paths native, use `path.join()`/`os.tmpdir()` for fixtures, use explicit embedded-text conversion, and add synthetic Windows path/error cases without relying on POSIX `chmod`.
- [X] T056 [P] Compare representative generated CSD against the Java/reference artifacts documented in `specs/111-mixer-mute-solo/precedents.md`, `specs/111-mixer-mute-solo/research.md`, `/Users/stevenyi/work/blue/demo2026/01.csd`, and `packages/blue-data/src/blue-data-csd-parity.test.ts`; document only intentional audio-gating/mode divergences and preserve existing ordering/formatting elsewhere.
- [X] T057 [P] Run the final accessibility/UI regression audit for keyboard focus, accessible names, pressed states, master Solo absence, mode explanations, bypass indicators, and saved-versus-applied status in `packages/blue-app/src/renderer/browser/mixer-mute-solo.browser.test.tsx`, `packages/blue-app/src/renderer/browser/track-header-mute-solo.browser.test.tsx`, and `packages/blue-app/src/renderer/browser/accessibility-focus.browser.test.tsx`.
- [X] T058 [P] Stress staged publication with more than 256 gate controls, simultaneous timeline/BlueLive sessions, rapid coalesced edits, and delayed acknowledgments in `packages/blue-app/src/main/global-history-engine.integration.test.ts` and `packages/blue-app/src/main/mixer-mute-solo-runtime.test.ts`.
- [X] T059 Update the implemented commands, engine prerequisites, recorded latency machine/device/versions, and manual fallback notes in `specs/111-mixer-mute-solo/quickstart.md` after the focused suites pass.
- [X] T060 Run affected-package validation from `specs/111-mixer-mute-solo/quickstart.md`: `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/engine-client test`, the three package builds, `pnpm --filter @blue/app test:browser`, and the focused real-engine integration checks.
- [X] T061 Run repository-level `pnpm test`, `pnpm lint`, and `git diff --check` from `/Users/stevenyi/work/blue-electron`; resolve or document any scoped failure in `specs/111-mixer-mute-solo/quickstart.md` before handoff.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; Java/reference review and deterministic test seams can begin immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories because typed contracts, identity rules, runtime outcome transport, and batch semantics are shared prerequisites.
- **User Stories (Phases 3–6)**: Depend on Phase 2. US1 and US2 are both P1 and can begin in parallel at their verification tasks; US2's Audio-header integration consumes the mixer snapshot/control contract produced by US1.
- **US3 (Phase 5)**: Depends on the route policy and render bindings from US1 plus effective-mode/event semantics from US2; its pruning and duration work can then proceed independently.
- **US4 (Phase 6)**: Depends on the durable writers and runtime behavior from US1 and US2; its history/recovery verification can run in parallel with US3 once those stories' core implementations are stable.
- **Polish (Phase 7)**: Depends on all desired stories and their focused validation.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2; no dependency on another story for its route-policy, CSD-gate, or runtime increment.
- **User Story 2 (P1)**: Can start after Phase 2; its core XML and score-mode work is independent, while header/strip synchronization integrates with US1's channel snapshot contract.
- **User Story 3 (P2)**: Depends on US1's detached route/gate policy and US2's effective mode; it is independently testable with disk fixtures after those contracts exist.
- **User Story 4 (P2)**: Depends on US1/US2 durable patch and runtime paths; it is independently testable by replaying each action through the canonical history boundary.

### Within Each User Story

- Verification tasks precede implementation for behavior regressions where the harness supports a failing reproduction.
- Detached models/policies precede CSD generation; CSD bindings precede host publication; host publication precedes renderer status presentation.
- Models and snapshot contracts precede services/patches; services/patches precede UI actions; core implementation precedes integration validation.
- Every durable project mutation must use `ProjectHistory` with a semantic label and focused commit→undo→redo coverage.
- Runtime acknowledgments are not treated as audible application until the applied token is observed; stale generations never report success.

### Parallel Opportunities

- Setup T002 and T003 can run in parallel with T001.
- Foundation T004, T005, and T008 can run in parallel; T006/T007/T009 follow their relevant contracts.
- US1 verification T012–T016 can run in parallel; after T017, CSD implementation T018–T020, runtime implementation T021–T023, and UI implementation T024 can be staffed across separate files with their stated contract dependencies.
- US2 verification T026–T029 can run in parallel; T030, T032, and the contract/UI work can be split once the snapshot shape in T031 is agreed.
- US3 verification T038–T040 can run in parallel; eligibility, duration, and export-safety work touch separate seams after the shared policy exists.
- US4 verification T046–T049 can run in parallel; identity, runtime status, and history-writer work can be staffed separately after the earlier story implementations land.
- Polish T055–T058 can run in parallel; T059–T061 are final validation gates.

---

## Parallel Example: User Story 1

```text
# After Phase 2, launch independent verification tasks together:
Task: "T012 route-policy matrix in packages/blue-data/src/mixer/mute-solo-policy.test.ts"
Task: "T013 CSD gate regressions in packages/blue-data/src/blue-data/csd-policy.test.ts"
Task: "T014 runtime publication contract in packages/blue-app/src/main/mixer-mute-solo-runtime.test.ts"
Task: "T015 browser controls in packages/blue-app/src/renderer/browser/mixer-mute-solo.browser.test.tsx"
Task: "T016 real-engine scenarios in packages/blue-app/src/main/global-history-engine.integration.test.ts"

# After T017 defines the policy, staff the independent implementation seams:
Task: "T018/T019/T020 CSD bindings and render emission in packages/blue-data/src/blue-data/csd-policy.ts"
Task: "T021/T022 runtime publication in packages/blue-app/src/main/mixer-mute-solo-runtime.ts"
Task: "T024 strip UI in packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx"
```

## Parallel Example: User Story 2

```text
# Launch independent verification tasks together:
Task: "T026 XML compatibility in packages/blue-data/src/project-properties.test.ts"
Task: "T027 score-generation mode matrix in packages/blue-data/src/score/score-generation-options.test.ts"
Task: "T028 patch/association races in packages/blue-app/src/shared/project-editor/mixer-mute-solo-contract.test.ts"
Task: "T029 header and selector browser tests in packages/blue-app/src/renderer/browser/track-header-mute-solo.browser.test.tsx"

# After T030/T031 establish the canonical mode shape:
Task: "T032 effective event filtering in packages/blue-data/src/score/score.ts"
Task: "T033 header authority in packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx"
Task: "T034 mode selector and diagnostics in packages/blue-app/src/renderer/components/workbench/panels/ProjectPropertiesPanel.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 plus compatibility guard)

1. Complete Phase 1 and Phase 2.
2. Complete US1 route policy, CSD gates, runtime coordinator, strip UI, and focused real-engine validation.
3. Include the minimum US2 load fallback needed to keep absent/legacy mode properties in Event behavior before exposing new Audio header controls.
4. **STOP and VALIDATE**: verify the full US1 independent test and the legacy compatibility guard from `specs/111-mixer-mute-solo/quickstart.md`.

### Incremental Delivery

1. Complete Setup + Foundation → typed, identity-safe runtime seam.
2. Add US1 → live mixer auditioning MVP → test independently.
3. Add US2 → persisted header authority and legacy compatibility → test independently.
4. Add US3 → conservative disk pruning and duration-preserving equivalence → test independently.
5. Add US4 → durable recovery and complete undo/redo evidence → test independently.
6. Complete Polish → Java parity review, accessibility, stress, package validation, and repository checks.

### Parallel Team Strategy

1. Team completes Setup + Foundation together.
2. After Phase 2, Developer A owns US1 data/CSD/runtime, Developer B owns US2 XML/score/UI, and a verification owner prepares the independent tests.
3. Once US1/US2 contracts stabilize, Developer C can implement US3 pruning while the history owner implements US4 recovery.
4. Integrate only after each story's checkpoint and focused validation pass.

## Notes

- `[P]` marks work that can use different files and has no dependency on incomplete work in the same phase.
- `[US1]`–`[US4]` map directly to the user stories in `specs/111-mixer-mute-solo/spec.md`.
- No new native engine protocol is planned; existing batch channels and their 256-entry limit are reused and tested.
- `@blue/data` production changes must remain host-neutral with top-level static imports; main owns filesystem/process/engine work and the renderer submits typed serializable intents.
- Export, derived route masks, gate symbols, runtime tokens, and applied revisions are disposable; only the specified project fields belong in `.blue` XML.

**Context for task generation**: No additional arguments were supplied.

---

## Phase 8: Convergence

**Purpose**: Close implementation and evidence gaps found by comparing the completed work with the specification, plan, contracts, and constitution.

**Convergence review (2026-09-16):** The implementation covers the main route, gate-publication, UI, pruning, and history paths, but the review found the legacy XML fallback, mode metadata/history, missing-association, provenance, browser-evidence, and disk-validation gaps below. Existing unchecked T037, T045, and T054 remain the tracked manual verification work and are intentionally not duplicated here.

- [X] T062 CRITICAL [US2] Make `BlueData` XML loading treat an absent `projectProperties` block as loaded legacy Event mode with `trackLayerMuteSoloModePresent=false`, rather than retaining the fresh-project Audio default; preserve the untouched omission on save and add an enabled-mixer root fixture covering load/save/reload in `packages/blue-data/src/blue-data/xml-policy.ts` and the compatibility tests per FR-007, US2/AC2, T026, and T030 (contradicts).
- [X] T063 HIGH [US2] [US4] Carry `trackLayerMuteSoloModePresent` and retained raw mode text through `ProjectPropertiesSnapshot`, patch application, and scalar history records; restore omitted and invalid source metadata exactly through commit→undo→redo and save/reload, and clear invalid raw text on an explicit Event or Audio replacement even when the parsed mode is already Event in `packages/blue-app/src/shared/project-editor/contract.ts`, `snapshot-mixer-orchestra.ts`, `patch-mixer-bluelive.ts`, and `main/project-history-memento.ts` with focused tests per FR-007, FR-014, US4/AC1-2, T031, T048, and T050 (partial).
- [X] T064 HIGH [US2] Make an Audio-mode track-header M/S action with no associated mixer channel take an explicit repair/report path and produce no legacy Event-layer patch or history entry; retain the mode/association guard through the production ScorePanel/store path and add a regression for the missing-association edge case in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/stores/project-store.ts`, and the header tests per FR-009, the US2 missing-association edge case, T028, and T033 (partial).
- [ ] T065 HIGH [US1] Execute and record the documented physical UI-to-audio latency measurement for timeline and BlueLive playback, including transport continuity and no event retriggering, at the SC-002 ≤100 ms threshold; protocol-level applied-token timing is insufficient, as noted in `specs/111-mixer-mute-solo/quickstart.md`, per SC-002, US1/AC7, T016, and T025 (partial).
- [X] T066 HIGH [US2] Add and run the missing browser-level track-header/mode/bypass suite at `packages/blue-app/src/renderer/browser/track-header-mute-solo.browser.test.tsx`; cover Audio/Event selector authority, independent Event and mixer flags, missing/renamed associations, mixer bypass, accessible labels, and keyboard header M/S behavior so the browser acceptance evidence named by T029 and T057 actually exists per US2 AC1-6 and FR-007 through FR-009 (missing).
- [X] T067 MEDIUM [US2] Make `legacyActiveChannelStateNotice` depend on load-derived legacy provenance rather than any currently active non-master flag; distinguish loaded legacy channel flags from newly created or newly edited Audio-mode state and cover the canonical-to-renderer snapshot and Project Properties presentation per FR-015, the data-model derived-state rule, T031, T034, and T048 (partial).
- [X] T068 MEDIUM [US3] Complete the disk-pruning eligibility/fallback matrix with true mixed-content, note-processor, unknown-extension, pre-send, unresolved-route, and cyclic-routing fixtures, while retaining safe behavior for opaque effects, custom code, and absent associations in `packages/blue-data/src/blue-data/csd-disk-pruning.test.ts` and related CSD tests per FR-012, SC-004, and T038 (partial).
- [X] T069 MEDIUM [US3] Add feature-specific scheduling, deterministic sync/async parity, and export immutability regressions for nonzero windows, tempo mapping, fades/looping, global duration, extra render time, same sample count/duration, and successful/failed export state preservation in `packages/blue-data/src/blue-data-csd-scheduling.test.ts`, `blue-data-csd-determinism.test.ts`, and the app export/generation tests per SC-004, SC-005, T039, and T040 (partial).
