# Tasks: Audio File Player

**Input**: Design documents from `/specs/057-audio-file-player/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/audio-player-ipc.md](./contracts/audio-player-ipc.md)
**Tests**: Focused Vitest coverage, Electron media smoke verification, typechecks, renderer production build, and workspace lint
**Status**: Complete (retrospective task ledger)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Work can proceed in parallel with another task.
- **[Story]**: User story that the task serves.
- Every task below is complete and retains its exact implementation path.

## Phase 1: Setup and Design

**Purpose**: Establish the player contract and delivery boundary.

- [X] T001 Document privileged local-media, renderer-session, and render-play design decisions in `specs/057-audio-file-player/research.md`.
- [X] T002 [P] Document transient player state and IPC/media contracts in `specs/057-audio-file-player/data-model.md` and `specs/057-audio-file-player/contracts/audio-player-ipc.md`.

---

## Phase 2: Foundational Playback Infrastructure

**Purpose**: Provide an isolated, seekable media source and render completion signal.

- [X] T003 Implement and test the canonical-path-authorized, range-aware `blue-audio://file/<encoded-path>` handler in `packages/blue-app/src/main/audio-stream-protocol.ts` and `packages/blue-app/src/main/audio-stream-protocol.test.ts`.
- [X] T004 Register the narrow media scheme and authorize file-picker/render paths in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`.
- [X] T005 Extend the disk-render completion contract with its requested action in `packages/blue-app/src/shared/render-freeze-contract.ts` and `packages/blue-app/src/shared/render-freeze-contract.test.ts`.

**Checkpoint**: A secure renderer media source and render-play signal are available.

---

## Phase 3: User Story 1 - Preview a Local Audio File (Priority: P1) 🎯 MVP

**Goal**: Open a local file and preview it inside a workbench panel.

**Independent Test**: Open the player, select a WAV, and use Play/Pause while
metadata populates.

- [X] T006 [P] [US1] Implement renderer URL encoding tests in `packages/blue-app/src/renderer/components/workbench/panels/audio-player/audio-url.test.ts`.
- [X] T007 [US1] Implement panel file selection, media playback, metadata decoding, and errors in `packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerPanel.tsx` and `AudioPlayerMetadata.tsx`.
- [X] T008 [US1] Register `AudioPlayerPanel` in `packages/blue-app/src/renderer/components/workbench/DockviewPanel.tsx`.
- [X] T009 [US1] Add the panel empty-state, icon-control, ordering, and time-readout render regression in `packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerPanel.test.tsx`.

**Checkpoint**: A composer can select, play, pause, and inspect a local file without leaving Blue.

---

## Phase 4: User Story 2 - Navigate an Audio Preview (Priority: P2)

**Goal**: Make waveform inspection, seeking, looping, and timing reliable and readable.

**Independent Test**: Load a short WAV, seek by clicking its waveform, enable loop, and confirm continuous visual output and millisecond times.

- [X] T010 [P] [US2] Reuse min/max waveform summaries and cover connected-envelope geometry in `packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerWaveform.test.ts`.
- [X] T011 [US2] Implement continuous envelope drawing, responsive canvas sizing, seeking, and a file-only canvas in `packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerWaveform.tsx`.
- [X] T012 [P] [US2] Implement and test shared millisecond time formatting in `packages/blue-app/src/renderer/components/workbench/panels/audio-player/audio-time.ts` and `audio-time.test.ts`.
- [X] T013 [US2] Place Lucide Play/Pause and Repeat controls plus the transport readout below the black waveform viewport in `packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerPanel.tsx`.

**Checkpoint**: The preview has a continuous waveform, direct seeking, looping, accessible icon controls, and consistent time formatting.

---

## Phase 5: User Story 3 - Audition a Disk Render in Blue (Priority: P3)

**Goal**: Route completed Play renders to the in-app player without changing Open renders.

**Independent Test**: Complete a Play render and verify the panel loads and
attempts playback of its output (reporting a platform denial); complete an Open
render and verify its existing behavior remains.

- [X] T014 [P] [US3] Implement and test retained render-play delivery in `packages/blue-app/src/renderer/components/workbench/panels/audio-player/audio-player-bus.ts` and `audio-player-bus.test.ts`.
- [X] T015 [US3] Implement and test render-status interception in `packages/blue-app/src/renderer/components/workbench/panels/audio-player/use-render-and-play.ts` and `use-render-and-play.test.tsx`.
- [X] T016 [US3] Mount the interceptor in `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx` and route Play completion in `packages/blue-app/src/main/main.ts`.

**Checkpoint**: Render-to-Disk Play remains inside Blue; Render-to-Disk Open remains external.

---

## Phase 6: Polish and Closeout

**Purpose**: Confirm behavior, document decisions, and record completion.

- [X] T017 [P] Run focused Vitest coverage, main/preload typechecks, renderer production build, and workspace lint from `packages/blue-app/`.
- [X] T018 [P] Run a real Electron media-pipeline smoke probe against a WAV with `packages/blue-app/src/main/audio-stream-protocol.ts`.
- [X] T019 Update verification and known-tradeoff documentation in `specs/057-audio-file-player/handoff.md`.
- [X] T020 Complete the Spec Kit closeout artifacts in `specs/057-audio-file-player/`.
- [X] T021 Harden local media authorization and verify playback under explicit CSP in `packages/blue-app/src/main/audio-stream-protocol.ts`, `packages/blue-app/src/renderer/index.html`, and `packages/blue-app/src/renderer/popout.html`.

## Dependencies & Execution Order

```text
Setup/Design → Playback Infrastructure → US1 Preview → US2 Navigation → US3 Render Play → Polish
```

- US1 depends on the foundational media source and IPC endpoints.
- US2 depends on a loadable player source from US1.
- US3 depends on the player registration from US1 and the render status contract.
- Polish validates the completed vertical slice.

## Parallel Opportunities

- T001 and T002 could proceed independently once the feature scope was known.
- T006 and T010/T012 target independent renderer helpers.
- T014 and T015 cover separate handoff modules.
- T017 and T018 use complementary automated and real-media verification.

## Implementation Strategy

The delivered MVP was US1: a local file preview. US2 added the waveform and
compact transport, and US3 integrated rendered output. The final polish phase
confirmed all three stories together and preserved existing external Open
behavior.
