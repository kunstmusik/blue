# Tasks: Focused MIDI Instrument Routing

**Input**: Design documents from `specs/067-virtual-keyboard-track-targeting-research/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/midi-focus-routing.md`, `quickstart.md`

**Verification**: The project constitution requires focused regression, portable-data preservation, typed boundary success/failure, renderer UI, runtime lifecycle, compatibility, quickstart, test, lint, and build evidence.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an incremental slice after the shared routing foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its stated prerequisites because it changes different files
- **[Story]**: Maps the task to `US1`–`US4`; setup, foundation, and polish tasks have no story label
- Every task names the exact repository files it changes or records evidence in

## Phase 1: Setup And Compatibility Baseline

**Purpose**: Capture the behavior that Spec 067 must preserve before changing shared MIDI and Blue Live paths.

- [X] T001 Run the existing direct-channel, Virtual Keyboard, hardware MIDI, and Blue Live cleanup tests and record exact baseline commands/results in `specs/067-virtual-keyboard-track-targeting-research/quickstart.md`
- [X] T002 [P] Re-check Java `VirtualKeyboardPanel`, `VirtualKeyboardTopComponent`, and `MidiInputEngine` behavior under `/Users/stevenyi/work/nbprojects/blue/blue-ui-core` and record the preserved channel, note, velocity, and all-notes-off references in `specs/067-virtual-keyboard-track-targeting-research/research.md`

**Checkpoint**: The pre-change compatibility baseline and intentional focus-routing divergence are recorded.

---

## Phase 2: Foundational Routing Contracts And State

**Purpose**: Establish the typed target contract, disposable compiled catalog, renderer focus authority, target-aware note ledger, generic routing control, and session-fenced ingress required by every story.

**Critical**: No user-story implementation begins until this phase passes its focused tests.

### Foundation verification

- [X] T003 [P] Add failing portable-data tests proving `toBlueLiveCSD()` returns deterministic enabled Track and base-Orchestra target metadata from the exact render snapshot, excludes disabled/unassigned targets, rebuilds without stale entries, and leaves canonical Arrangement/XML unchanged in `packages/blue-data/src/blue-live-csd.test.ts` and `packages/blue-data/src/score/track/track-instrument-csd.test.ts`
- [X] T004 [P] Add failing shared-contract tests for Track, Orchestra, channel, omitted-target compatibility, bounded non-empty identities, channel disagreement, and nonnegative integer `liveSessionId` validation in `packages/blue-app/src/shared/project-editor-midi-routing.test.ts`
- [X] T005 [P] Add failing renderer-store tests for focus-default state, explicit Track/Orchestra replacement, mode changes, stable-identity metadata reconciliation, project-session clearing, Blue Live restart retention, target resolution, and absence of diagnostic state in `packages/blue-app/src/renderer/tests/midi-routing-store.test.ts`
- [X] T006 [P] Add failing router tests for target resolution at note-on, retained target/session on note-off, `(targetKey,midiNote)` aggregation, source idempotence, no-target rejection, failed-note bookkeeping, and silent typed failures in `packages/blue-app/src/renderer/tests/midi-note-router.test.ts`
- [X] T007 [P] Add failing main-session tests for validated catalog installation, duplicate identity rejection, malformed target/session failure, omitted-target compatibility, and zero score submission on unresolved targets in `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts`
- [X] T008 [P] Add failing shared-ingress and Virtual Keyboard tests for the default Focused Target control, accessible empty-target status, shared hardware/virtual mode resolution, unchanged normal key visuals, no rejection message, and fail-closed behavior when the router is unavailable in `packages/blue-app/src/renderer/tests/virtual-keyboard-panel.test.tsx` and `packages/blue-app/src/renderer/tests/midi-input-lifecycle.test.tsx`

### Foundation implementation

- [X] T009 Define `BlueLiveNoteTarget`, optional `target`/`liveSessionId` request fields, bounded validators/normalizers, and collision-safe target identity keys using static imports in `packages/blue-app/src/shared/project-editor.ts` and `packages/blue-app/src/shared/midi-input.ts`
- [X] T010 [P] Implement `CompiledMidiInstrumentTarget` output using pre-Track Arrangement identities and `CompileData.getTrackInstrumentIds()` so `toBlueLiveCSD()` returns derived target metadata without mutating project state in `packages/blue-data/src/blue-data.ts` and `packages/blue-data/src/compile-data.ts`
- [X] T011 [P] Implement the transient `MidiRoutingState` authority with focus-default mode, stable Track/Orchestra identities, snapshot reconciliation, project clearing, Blue Live restart retention, and target resolution in `packages/blue-app/src/renderer/stores/midi-routing-store.ts`
- [X] T012 Re-key `MidiNoteRouter` aggregates by target identity and note, retain the accepted target and Blue Live session ID in each held source note, and return typed failures without publishing UI state in `packages/blue-app/src/renderer/services/midi-note-router.ts`
- [X] T013 Install, validate, atomically replace, and clear the compiled target catalog with the main-owned Blue Live session ID, and add a fail-closed target/session resolver scaffold in `packages/blue-app/src/main/blue-live-engine.ts`
- [X] T014 Extend the preload and renderer-global contract to forward optional target/session fields unchanged and add forwarding coverage without project resolution outside main in `packages/blue-app/src/preload/preload.ts`, `packages/blue-app/src/renderer/types/global.d.ts`, and `packages/blue-app/src/renderer/tests/blue-live-contract.test.ts`
- [X] T015 Add the shared Focused Target/Direct Channel control and accessible target-status rendering without error-message state while preserving existing piano, octave, velocity, shortcut, and All Notes Off behavior in `packages/blue-app/src/renderer/components/workbench/panels/VirtualKeyboardPanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/virtual-keyboard/useVirtualKeyboardState.ts`
- [X] T016 Bind both hardware and Virtual Keyboard events to the routing store resolver and current `blue-live-store` session ID, release held notes at engine/project boundaries, preserve focus only across engine restarts, and remove the direct-trigger fallback that bypasses shared routing in `packages/blue-app/src/renderer/hooks/use-midi-input-service.ts` and `packages/blue-app/src/renderer/stores/blue-live-store.ts`

**Checkpoint**: Generic focus/channel selection, typed target/session transport, derived catalog ownership, and held-note semantics pass without any Track or Orchestra selection-surface wiring.

---

## Phase 3: User Story 1 - Play The Focused Track Instrument (Priority: P1) — MVP

**Goal**: Explicitly focusing a Track routes Virtual Keyboard and enabled hardware notes to that Track's compiled instrument without a channel assignment.

**Independent Test**: Load two Tracks with distinct enabled instruments and one Track without an eligible instrument, start Blue Live, focus each Track explicitly, and verify equivalent hardware/virtual note-on and note-off reach only the focused eligible Track while the unavailable Track is silently rejected.

### Verification for User Story 1

- [X] T017 [P] [US1] Add failing renderer tests for Track-header, empty-timeline, contained-object, and instrument-control focus; stable focused styling; non-focus controls that do not steal focus; rename reconciliation; and removed-Track clearing in `packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx` and `packages/blue-app/src/renderer/tests/track-instrument-control.test.tsx`
- [X] T018 [P] [US1] Add failing main and parity tests for exact Track runtime-ID note-on/off score text, project pitch/velocity mapping, hardware/Virtual Keyboard equivalence, more than sixteen Track identities, disabled/missing/stale Track rejection, and zero fallback submissions in `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts` and `packages/blue-app/src/renderer/tests/blue-live-hardware-parity.test.ts`

### Implementation for User Story 1

- [X] T019 [US1] Wire explicit Track focus and focused-row/canvas styling through stable project-session, root-group, and Track identity from Track headers, timeline locations/objects, and instrument controls in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score/TrackInstrumentControl.tsx`
- [X] T020 [US1] Resolve Track targets exclusively through the active compiled catalog and generate project-mapped target-specific note-on/off score events without channel or other-target fallback in `packages/blue-app/src/main/blue-live-engine.ts`

**Checkpoint**: The Track-only MVP is complete when both input sources audition an explicitly focused Track and every unavailable Track case produces no sound, no error message, and no held-note debt.

---

## Phase 4: User Story 2 - Play The Focused Orchestra Instrument (Priority: P1)

**Goal**: Explicitly focusing an Orchestra assignment makes that exact compiled named or numbered identity the shared hardware/virtual target, independent of row position or channel.

**Independent Test**: Focus two Orchestra assignments, including a named or non-consecutive ID, and verify both input sources play/release only the selected identity while automatic editor selection and invalid assignments neither steal focus nor fall back.

### Verification for User Story 2

- [X] T021 [P] [US2] Add failing Orchestra UI tests separating explicit performance focus from initial/editor fallback selection, rendering focused styling and refreshed display metadata, and clearing removed or project-stale assignments in `packages/blue-app/src/renderer/tests/orchestra-arrangement.test.tsx` and `packages/blue-app/src/renderer/tests/orchestra-arrangement-ui.test.tsx`
- [X] T022 [P] [US2] Add failing main-session tests for exact numeric, named, and non-consecutive Orchestra target resolution plus disabled, removed, uncompiled, duplicate, and row-position fallback rejection in `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts`
- [X] T023 [P] [US2] Add failing parity tests for hardware/Virtual Keyboard Orchestra targeting, Track-to-Orchestra focus replacement, retained original-target release, mapped pitch/velocity, and silent invalid-assignment failure in `packages/blue-app/src/renderer/tests/blue-live-hardware-parity.test.ts` and `packages/blue-app/src/renderer/tests/virtual-keyboard-panel.test.tsx`

### Implementation for User Story 2

- [X] T024 [US2] Report explicit Orchestra row selection separately from editor fallback and wire focus/styling through stable project-session and assignment identity in `packages/blue-app/src/renderer/components/workbench/panels/OrchestraPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/ArrangementPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/types.ts`
- [X] T025 [US2] Resolve focused Orchestra requests by exact active-catalog assignment identity and reuse project MIDI mapping and note identity generation without arrangement row-position lookup in `packages/blue-app/src/main/blue-live-engine.ts`

**Checkpoint**: Track and Orchestra surfaces share one explicit performance focus, and both source kinds play the exact compiled assignment identity.

---

## Phase 5: User Story 3 - Retain Direct MIDI Channel Routing (Priority: P2)

**Goal**: Users can opt into the existing channel-based workflow for the Virtual Keyboard and native hardware channels without a retained focus overriding the selected channel.

**Independent Test**: Retain a focus target, switch to Direct Channel, play two mapped and one unmapped channel from virtual and hardware sources, and confirm pre-Spec-067 assignment/mapping behavior with silent rejection and no focus fallback.

### Verification for User Story 3

- [X] T026 [P] [US3] Add failing UI/router tests for mode switching, retained-but-ignored focus, one-based Virtual Keyboard channel display, native hardware channel resolution, shared session fencing, and mode changes that do not retarget held notes in `packages/blue-app/src/renderer/tests/virtual-keyboard-panel.test.tsx` and `packages/blue-app/src/renderer/tests/midi-note-router.test.ts`
- [X] T027 [P] [US3] Add failing main compatibility tests for omitted targets/session IDs, explicit matching channel targets, mismatched/out-of-range rejection, existing assignment ordering, project MIDI mapping, and silently rejected unmapped channels with zero fallback score text in `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts`

### Implementation for User Story 3

- [X] T028 [US3] Show and preserve the existing one-based Channel control only in Direct Channel mode while retaining focus metadata for later mode reuse in `packages/blue-app/src/renderer/components/workbench/panels/VirtualKeyboardPanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/virtual-keyboard/useVirtualKeyboardState.ts`
- [X] T029 [US3] Resolve Direct Channel from each normalized event so hardware uses its native channel and the Virtual Keyboard uses its selected channel while both use the current Blue Live session fence in `packages/blue-app/src/renderer/stores/midi-routing-store.ts` and `packages/blue-app/src/renderer/hooks/use-midi-input-service.ts`
- [X] T030 [US3] Normalize omitted targets to the request channel, validate explicit channel agreement, and preserve the existing Arrangement-index compatibility behavior without focused-target fallback in `packages/blue-app/src/main/blue-live-engine.ts`

**Checkpoint**: Specs 033 and 058 direct-channel scenarios pass unchanged while Focused Target remains the renderer-session default.

---

## Phase 6: User Story 4 - Keep Realtime Notes Safe Across Focus And Session Changes (Priority: P2)

**Goal**: Every note releases its original target and engine generation, while source, Blue Live, project, renderer, and app lifecycle boundaries clear target-aware state without collisions or stuck notes.

**Independent Test**: Hold identical pitches across multiple sources and targets, change focus/mode, disconnect one source, stop/restart or recompile Blue Live, replace the project, and shut down; releases remain target-correct, focus survives only Blue Live restart, stale requests submit nothing, and all ledgers/catalogs end empty.

### Verification for User Story 4

- [X] T031 [P] [US4] Add failing router regressions for focus/mode changes between note-on/off, equal pitch across different targets, same target across sources, source release, stored session reuse, failed cleanup, operation ordering, and 100-cycle stuck-note stress in `packages/blue-app/src/renderer/tests/midi-note-router.test.ts`
- [X] T032 [P] [US4] Add failing Blue Live lifecycle tests for cancelled/failed start, atomic successful recompile, stale `liveSessionId` rejection before lookup, stop cleanup, target removal after note-on, duplicate catalog identities, and no late score event into a replacement generation in `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts`
- [X] T033 [P] [US4] Add failing renderer lifecycle tests for Blue Live restart focus retention, project focus clearing, held-note release before new authority, source disconnect/disable, shutdown, no diagnostic state, and Strict Mode remount idempotence in `packages/blue-app/src/renderer/tests/midi-input-lifecycle.test.tsx` and `packages/blue-app/src/renderer/tests/midi-routing-store.test.ts`
- [X] T034 [P] [US4] Add failing project/engine integration tests proving project replacement fences previous focus and notes, failed starts leave no usable catalog, and successful restart reconciles a still-existing focus without retaining held notes in `packages/blue-app/src/renderer/tests/blue-live-project-lifecycle.test.ts` and `packages/blue-app/src/renderer/tests/blue-live-recompile.test.tsx`

### Implementation for User Story 4

- [X] T035 [US4] Make source release and final note-off use each held record's stored target/session, recompute target-aware aggregate counts, and clear ledgers before best-effort engine all-notes-off in `packages/blue-app/src/renderer/services/midi-note-router.ts`
- [X] T036 [US4] Fence compiled catalogs by the main-owned Blue Live session ID and atomically replace or clear them across start, cancellation, failure, recompile, stop, terminal state, and cleanup in `packages/blue-app/src/main/blue-live-engine.ts`
- [X] T037 [US4] Distinguish Blue Live lifecycle cleanup from project replacement so both release held notes, only project replacement clears focus, and snapshot reconciliation refreshes or removes the retained target before new notes route in `packages/blue-app/src/renderer/stores/midi-routing-store.ts` and `packages/blue-app/src/renderer/hooks/use-midi-input-service.ts`

**Checkpoint**: All target-aware lifecycle and stress tests pass with zero wrong-target releases, zero stale-generation score submissions, preserved restart focus, and empty router/session state after cleanup.

---

## Phase 7: Polish And Cross-Cutting Validation

**Purpose**: Close compatibility, state-ownership, boundary, performance, documentation, and repository verification obligations after all stories.

- [X] T038 [P] Audit static-import/browser-safe `@blue/data` boundaries, canonical owners, disposable catalog/focus/held-note state, absence of XML/settings writes, and absence of dormant LiveObject trigger coupling; record findings in `specs/067-virtual-keyboard-track-targeting-research/research.md`
- [X] T039 Execute every deterministic compiled-catalog, focus indicator, Track, Orchestra, direct-channel, collision, cleanup, hardware/Virtual Keyboard, and qualitative routing-delay scenario and record observed evidence in `specs/067-virtual-keyboard-track-targeting-research/quickstart.md`
- [X] T040 Run the focused suites, complete `@blue/data` and `@blue/app` tests, affected data/main/preload/renderer builds, repository `pnpm lint`, and repository `pnpm build`; record exact command outcomes in `specs/067-virtual-keyboard-track-targeting-research/quickstart.md`
- [X] T041 Review the implementation against `specs/067-virtual-keyboard-track-targeting-research/spec.md`, `specs/067-virtual-keyboard-track-targeting-research/contracts/midi-focus-routing.md`, Java channel behavior, Specs 033/058/066, and `.specify/memory/constitution.md`; document any explicitly approved divergence in `specs/067-virtual-keyboard-track-targeting-research/plan.md`

---

## Dependencies And Execution Order

### Phase dependencies

- **Setup (Phase 1)**: No dependencies; T001 and T002 may run together.
- **Foundation (Phase 2)**: Depends on the recorded baseline and blocks every user story.
- **US1 Focused Track (Phase 3)**: Depends on Foundation and is the suggested MVP.
- **US2 Focused Orchestra (Phase 4)**: Depends on Foundation; it can develop its selection and main-resolution work independently, then reuse the generic focus UI and ingress.
- **US3 Direct Channel (Phase 5)**: Depends on Foundation; it can proceed alongside either focus surface because mode and target resolution are already generic.
- **US4 Lifecycle Safety (Phase 6)**: Depends on Foundation; its tests can begin early, but final integration must cover every routing story included in the release.
- **Polish (Phase 7)**: Depends on all stories selected for delivery.

### Foundation dependency graph

```text
T001/T002 baseline
      |
      +--> T003 --> T010
      +--> T004 --> T009 --> T014
      +--> T005 --> T011 --+
      +--> T006 ------------+--> T012 --> T016
      +--> T007 --> T013 ---+
      +--> T008 --> T015 ---+
```

### User-story dependency graph

```text
Setup -> Foundation -> US1 (MVP)
                    +-> US2
                    +-> US3
                    +-> US4 tests

US1 + US2 + US3 + US4 final integration -> Polish
```

### Within each user story

- Add or update the focused regression before implementation when the harness supports it.
- Stable/compiled identities and boundary validation precede renderer integration.
- Main target success/failure contracts precede end-to-end source-parity claims.
- A story reaches its checkpoint only after its independent test passes.

## Parallel Opportunities

- T001 and T002 can run in parallel.
- T003–T008 are independent failing-test groups across portable data, shared contracts, store, router, main, and renderer ingress.
- After T009 defines the request contract, T010 and T011 can proceed in parallel; T012 and T013 then integrate the renderer and main boundaries independently.
- After Foundation, US1, US2, and US3 verification can be authored in parallel because their primary selection and compatibility surfaces differ.
- T031–T034 independently cover router, main, renderer, and project lifecycle boundaries before T035–T037 integrate cleanup.
- T038 can run alongside preparation for manual validation; T039–T041 require the final selected story set.

## Parallel Example: User Story 1

```text
Task T017: Track selection-surface focus regressions
Task T018: Track runtime target and hardware/virtual parity regressions
```

## Parallel Example: User Story 2

```text
Task T021: Orchestra explicit-focus renderer regressions
Task T022: Exact compiled Orchestra identity main regressions
Task T023: Track-to-Orchestra source-parity regressions
```

## Parallel Example: User Story 3

```text
Task T026: Direct-channel UI/router regressions
Task T027: Direct-channel main compatibility regressions
```

## Parallel Example: User Story 4

```text
Task T031: Router target/session lifecycle stress regressions
Task T032: Main compiled-catalog generation regressions
Task T033: Renderer focus/held-note lifecycle regressions
Task T034: Project replacement and recompile integration regressions
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation through T016.
2. Complete US1 through T020.
3. Run the focused Track independent test with both input sources.
4. Stop for review if a Track-only MVP is desired.

### Incremental delivery

1. Foundation establishes generic target identity, session fencing, and silent fail-closed behavior.
2. US1 makes post-Spec-066 Track instruments playable.
3. US2 completes cross-surface focus with exact Orchestra identity.
4. US3 preserves the explicit compatibility/multi-timbral workflow.
5. US4 hardens every selected route across input, engine, project, and app lifecycles.
6. Polish records compatibility, manual hardware, latency, and repository verification evidence.

### Parallel team strategy

1. Complete Setup and Foundation together.
2. After Foundation, assign Track focus, Orchestra focus, and direct-channel verification to separate workers.
3. Integrate lifecycle safety across the completed routes before polish.

## Notes

- `[P]` marks work in different files that can run concurrently after earlier dependencies.
- `[US1]`–`[US4]` provide story traceability; setup, foundation, and polish intentionally omit story labels.
- Internal failures remain typed for bookkeeping/tests, but rejected notes never publish a routing error or retry another target.
- Focus persists across Blue Live restart; held notes and compiled catalogs do not. Project replacement clears focus and held notes.
- No task adds XML, settings, arming, per-Track device filters, recording, CC, bend, aftertouch, MPE, MIDI output, or LiveObject trigger semantics.
- Commit after each task or cohesive task group when requested by the project owner.

## Format Validation

- All 44 tasks use Markdown checkboxes and sequential IDs from `T001` through `T044`.
- Only parallel-safe tasks carry `[P]`.
- Every user-story task carries exactly one `[US1]`–`[US4]` label; non-story tasks carry none.
- Every task names at least one exact repository file path.

## Phase 8: Convergence

- [X] T042 [US2] Normalize named Orchestra runtime instrument IDs through the active engine catalog and add exact named/non-consecutive trigger regressions per US2/AC2, FR-008, FR-010, and FR-025 (partial) in `packages/blue-app/src/main/blue-live-engine.ts` and `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts`
- [X] T043 [US2] Add shared hardware/Virtual Keyboard Orchestra routing, focus-replacement/retained-release, and target-independent project MIDI mapping coverage per FR-002, FR-013, FR-021, T018, T023, and T027 (partial) in `packages/blue-app/src/renderer/tests/blue-live-hardware-parity.test.ts`, `packages/blue-app/src/renderer/tests/midi-note-router.test.ts`, and `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts`
- [X] T044 [US1] Add explicit Track header, empty-timeline, contained-object, and non-focus-control routing tests per FR-004, FR-006, and T017 (partial) in `packages/blue-app/src/renderer/tests/score-panel-session-reset.test.tsx` and `packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx`
