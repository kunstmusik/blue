# Tasks: Realtime Mixer Metering

**Input**: Design documents from `/specs/104-mixer-metering/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Verification**: Tasks include constitution-driven regression, binary serialization, IPC contract, native engine, UI canvas, and quickstart validation. Existing fixtures must remain byte-identical.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths are provided in each task description

---

## Phase 1: Setup (Shared Infrastructure & Protocol Constants)

**Purpose**: Define protocol constants, capability identifiers, and shared types across all layers.

- [X] T001 [P] Define `MIXER_METERING_FEATURE = 'mixer-metering-v1'` capability constant in `packages/blue-engine-client/src/capabilities.ts`
- [X] T002 [P] Define `ENGINE_METERS_TOPIC = 'engine.meters'` in `packages/blue-engine-client/src/protocol.ts`
- [X] T003 [P] Declare `mixer-metering-v1` in the native engine capability list in `native/blue-engine/src/Capabilities.cpp`
- [X] T004 [P] Create shared meter payload contracts (`MeterBindingMapPayload`, `MeterFramePayload`) in `packages/blue-app/src/shared/meter-types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core engine sampling, binary encoding, CSD generation, and IPC piping required before user story display work can begin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Create binary meter frame encoder and decoder with sanitization in `packages/blue-engine-client/src/meter-codec.ts`
- [X] T006 [P] Add unit tests for binary meter frame codec in `packages/blue-engine-client/tests/meter-codec.test.ts`
- [X] T007 Filter out `bm_meter_` channel prefix from shared memory mirroring in `native/blue-engine/src/CsoundEngine.cpp` and `native/blue-engine/src/ipc/SharedMemory.cpp`
- [X] T008 Implement Csound control-channel meter sampling and sequence-gated ZMQ publication on `engine.meters` in `native/blue-engine/src/ZmqHandler.h` and `native/blue-engine/src/ZmqHandler.cpp`
- [X] T009 Add `engine.meters` subscription and event callback support in `packages/blue-engine-client/src/engine-client.ts`
- [X] T010 Extend `packages/blue-data/src/mixer/mixer.ts` `getInitStatements` to emit `chn_k "bm_meter_..."` declarations for metered channels
- [X] T011 Extend `packages/blue-data/src/blue-data/csd-policy.ts` to emit post-fader meter taps in `generateBlueMixer` and construct `MeterBindingMap` in `toBlueLiveCSD`
- [X] T012 Update `RenderCsdResult` in `packages/blue-data/src/blue-data.ts` to include optional `meterBindingMap`
- [X] T013 Add unit tests for CSD meter emission and `MeterBindingMap` generation in `packages/blue-data/src/blue-data/csd-policy.test.ts`
- [X] T014 Forward meter frames and binding maps via `broadcastToWorkbenchWindows` in `packages/blue-app/src/main/engine-bridge.ts` and `packages/blue-app/src/main/main.ts`
- [X] T015 Expose typed meter listeners (`onMeterBindingMap`, `onMeterFrame`, `onMeterReset`) in `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts`

**Checkpoint**: Core data pipeline (engine → client → main → preload) is complete and verified with automated unit tests.

---

## Phase 3: User Story 1 - Watch live levels while the mix plays (Priority: P1) 🎯 MVP

**Goal**: Display live RMS and peak level meters beside every mixer fader (source, subchannel, master) with standard ballistics, peak hold, and clip latch during realtime playback.

**Independent Test**: Start playback of a multi-track project; verify that every channel strip in the mixer panel shows animated meters tracking audio, peak hold marks recent maximums, clipping latches red, and stopping playback promptly resets meters to silence.

### Verification for User Story 1

- [X] T016 [P] [US1] Create unit tests for renderer meter store ballistics (decay rate, peak-hold duration, clip latch) in `packages/blue-app/src/renderer/tests/meter-store.test.ts`
- [X] T017 [P] [US1] Create component rendering tests for `MeterCanvas` in `packages/blue-app/src/renderer/tests/meter-canvas.test.tsx`

### Implementation for User Story 1

- [X] T018 [US1] Implement non-React transient meter state store with delta-time ballistics and lifecycle listeners in `packages/blue-app/src/renderer/stores/meter-store.ts`
- [X] T019 [US1] Implement HTML5 2D Canvas meter component with color zones (nominal/high/warning/clip) and `requestAnimationFrame` loop in `packages/blue-app/src/renderer/components/workbench/panels/mixer/MeterCanvas.tsx`
- [X] T020 [US1] Mount `MeterCanvas` beside the fader inside `.mixer-level-section` in `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`
- [X] T021 [US1] Handle playback stop/finish/destroy events to drain meters to silence and clear clip indicators in `packages/blue-app/src/renderer/stores/meter-store.ts`

**Checkpoint**: User Story 1 (MVP) is fully functional. Channels visibly animate levels during playback and smoothly decay to silence on stop.

---

## Phase 4: User Story 2 - Meters stay correct across mixer shapes and channel identities (Priority: P2)

**Goal**: Meters reliably bind to correct channel strips across channel renames, reorders, disabled mixer, silent channels, and malformed non-finite audio.

**Independent Test**: Reorder and rename channels, start playback, and verify each meter tracks its respective channel. Verify silent channels sit quietly at the floor, disabled mixer shows inactive meters without errors, and non-finite numbers do not freeze or crash the UI.

### Verification for User Story 2

- [X] T022 [P] [US2] Add unit tests verifying `MeterBindingMap` correctly maps reordered and renamed channels to compile-time identities in `packages/blue-data/src/mixer/mixer.test.ts`
- [X] T023 [P] [US2] Add test verifying non-finite values (NaN/Infinity) are clamped to 0.0 in `packages/blue-engine-client/src/meter-codec.test.ts` and `packages/blue-app/src/renderer/tests/meter-store.test.ts`

### Implementation for User Story 2

- [X] T024 [US2] Ensure subchannel name whitespace sanitization and collision fallback in `packages/blue-data/src/blue-data/csd-policy.ts` produces stable `MeterBindingMap` keys
- [X] T025 [US2] Enforce NaN/Infinity sanitization and clamping in `packages/blue-app/src/renderer/stores/meter-store.ts` to prevent canvas drawing exceptions
- [X] T026 [US2] Ensure silent channels and disabled mixer keep meters parked at the silence floor without flicker in `packages/blue-app/src/renderer/components/workbench/panels/mixer/MeterCanvas.tsx`

**Checkpoint**: User Stories 1 and 2 work reliably under complex project editing and edge-case signal conditions.

---

## Phase 5: User Story 3 - Metering costs nothing perceptible (Priority: P2)

**Goal**: Ensure metering is completely zero-impact on offline disk renders, screen exports, and older engine builds, while preserving UI 60fps interactivity under heavy channel load.

**Independent Test**: Run CSD disk render and export tests to verify 100% byte-identical output against existing fixtures. Run stress test with 64 metered channels to verify UI interactions (fader drag, solo/mute) do not lag. Test against engine build without metering capability to confirm silent fallback.

### Verification for User Story 3

- [X] T027 [P] [US3] Add regression test verifying disk-render CSD and CSD-to-screen remain byte-identical to pre-feature baseline in `packages/blue-data/src/blue-data-csd-disk.test.ts`
- [X] T028 [P] [US3] Add test for engine without `mixer-metering-v1` capability verifying graceful fallback and zero errors in `packages/blue-app/src/main/engine-bridge.test.ts`
- [X] T029 [P] [US3] Add performance/stress test with 64 channels animating at 30 Hz in `packages/blue-app/src/renderer/tests/meter-stress.test.ts`

### Implementation for User Story 3

- [X] T030 [US3] Ensure meter CSD emission is strictly gated so disk-render and screen CSD paths never emit meter statements in `packages/blue-data/src/blue-data/csd-policy.ts`
- [X] T031 [US3] Check `hasEngineFeature(capabilities, MIXER_METERING_FEATURE)` in `packages/blue-app/src/main/engine-bridge.ts` before enabling meter subscription and frame broadcasting
- [X] T032 [US3] Optimize `MeterCanvas` draw loop to skip repainting when strip is off-screen or levels remain at silence floor in `packages/blue-app/src/renderer/components/workbench/panels/mixer/MeterCanvas.tsx`

**Checkpoint**: Offline exports remain byte-identical. Capability fallback and 64-channel performance requirements are validated.

---

## Phase 6: User Story 4 - Meters follow the mixer into detached windows (Priority: P3)

**Goal**: Meters animate smoothly and clean up gracefully when the mixer panel is detached into a popout window and re-docked.

**Independent Test**: Pop out the mixer panel during playback into a floating window; verify meters animate normally. Re-dock the mixer; verify meters continue without duplication or leaked timers.

### Verification for User Story 4

- [X] T033 [P] [US4] Add popout window test verifying `MeterCanvas` uses the correct window's `requestAnimationFrame` and document context in `packages/blue-app/src/renderer/tests/mixer-meter-popout.test.tsx`

### Implementation for User Story 4

- [X] T034 [US4] Wire `useHostDocument` in `packages/blue-app/src/renderer/components/workbench/panels/mixer/MeterCanvas.tsx` to bind rAF and canvas rendering to the hosting window's context
- [X] T035 [US4] Implement unmount/re-dock cleanup in `MeterCanvas.tsx` to cancel pending animation frames when detached windows close

**Checkpoint**: Popout and docked mixer panels render meters identically and clean up cleanly across window lifecycle transitions.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, code cleanup, style conformance, and documentation validation.

- [X] T036 Execute manual validation scenarios in `specs/104-mixer-metering/quickstart.md`
- [X] T037 [P] Run `git diff --check` to verify no whitespace errors across all changed packages
- [X] T038 Run full repository verification suite: `pnpm test`, `pnpm lint`, and `pnpm --filter @blue/app build:main`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories.
- **Phase 3 (User Story 1 - P1)**: Depends on Phase 2 — Deliverable as MVP.
- **Phase 4 (User Story 2 - P2)**: Depends on Phase 3 (extends binding & edge-case handling).
- **Phase 5 (User Story 3 - P2)**: Depends on Phase 3 (gates emission & verifies performance). Can run in parallel with Phase 4.
- **Phase 6 (User Story 4 - P3)**: Depends on Phase 3 (adapts canvas component to popouts).
- **Phase 7 (Polish)**: Depends on all desired user stories being complete.

### User Story Dependencies

```mermaid
graph TD
    P1[Phase 1: Setup] --> P2[Phase 2: Foundational]
    P2 --> US1[Phase 3: US1 - Live Level Meters (MVP)]
    US1 --> US2[Phase 4: US2 - Shapes & Identities]
    US1 --> US3[Phase 5: US3 - Zero Impact & Scale]
    US1 --> US4[Phase 6: US4 - Detached Windows]
    US2 --> Polish[Phase 7: Polish & Validation]
    US3 --> Polish
    US4 --> Polish
```

### Parallel Opportunities

- **Phase 1**: T001, T002, T003, T004 can all execute in parallel.
- **Phase 2**: T005 & T006 (codec), T007 & T008 (native), T010 & T011 & T012 (CSD generation) can be developed concurrently across package boundaries.
- **Phase 3**: Verification tests T016 and T017 can be written in parallel before implementation.
- **Phase 4, 5, 6**: Once US1 is in place, US2 (edge cases/identities), US3 (byte-identity & performance), and US4 (popout) can be implemented in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (constants, types)
2. Complete Phase 2: Foundational (codec, engine publisher, CSD taps, IPC forwarding)
3. Complete Phase 3: User Story 1 (meter store, `MeterCanvas`, strip integration)
4. **STOP and VALIDATE**: Play a multi-track project, confirm meters animate and stop cleanly.

### Incremental Delivery

1. Setup + Foundational → Pipeline ready
2. Add US1 → Core metering functional (MVP)
3. Add US2 → Robust under renaming/reordering/silent tracks/NaNs
4. Add US3 → Byte-identity safety and 64-channel performance verified
5. Add US4 → Popout window support completed
6. Polish → Quickstart validated, tests/lint/build passing
