---
description: "Dependency-ordered implementation tasks for Mono Clip Panning Compatibility"
---

# Tasks: Mono Clip Panning Compatibility

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/112-mono-clip-panning/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Verification**: Every durable model or editor mutation below includes serialization, contract,
ProjectHistory commit→undo→redo, runtime, UI, cross-platform host-path, and quickstart coverage
where applicable. Layout observations remain disposable and never become `.blue` XML state.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested
independently after the shared layout/preflight foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase once its stated inputs exist
- **[Story]**: The user story that owns the task; setup, foundation, and polish tasks have no story label
- Every task names at least one exact repository path and remains unchecked for implementation

## Path Conventions

- Portable data model and CSD generation: `packages/blue-data/src/` with co-located `*.test.ts`
- Electron main/preload/renderer: `packages/blue-app/src/main/`, `packages/blue-app/src/preload/`, and `packages/blue-app/src/renderer/`
- Shared serializable editor contracts: `packages/blue-app/src/shared/`
- Host paths: preserve native `fs`/`path` values, use `path.join()` and `os.tmpdir()` in fixtures,
  and convert only at the explicit embedded Csound-text boundary

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish reference behavior, deterministic fixtures, and baseline assertions before
changing the audio route.

- [x] T001 [P] Reconfirm Java Blue’s legacy mono/stereo playback and mixer behavior against `/Users/stevenyi/work/nbprojects/blue/blue-core`, `/Users/stevenyi/work/nbprojects/blue/blue-ui-core`, `/Users/stevenyi/work/blue/demo2026/01.csd`, and `specs/112-mono-clip-panning/research.md`; record only intentional TypeScript divergence and preserved ordering in `packages/blue-data/src/blue-data/blue-data-csd-parity.test.ts`.
- [x] T002 [P] Add deterministic mono, stereo, and three-channel WAV/PCM fixtures plus expected sample/gain constants for center and endpoint assertions in `packages/blue-data/src/score/audio/mono-clip-panning-fixtures.test.ts` and `packages/blue-app/src/main/mono-clip-panning.integration.test.ts`.
- [x] T003 [P] Capture pre-change legacy CSD snapshots and sync/async generation parity for mixer-disabled and ordinary mixer projects in `packages/blue-data/src/blue-data/csd-policy.test.ts`, `packages/blue-app/src/main/csd-generation.test.ts`, and `packages/blue-app/src/main/render-to-disk.test.ts`.
- [x] T004 [P] Turn the deterministic verification matrix, engine prerequisites, expected `1/sqrt(2)` center level, endpoint unity, and unsupported-layout cases into runnable instructions in `specs/112-mono-clip-panning/quickstart.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the typed, host-neutral layout contract and main-process preflight needed by all
stories. No story implementation should begin until this phase is complete.

- [x] T005 [P] Define browser-safe `AudioLayoutManifest`, source observation status, effective track layout, and stable layout identity types in `packages/blue-data/src/score/audio/audio-layout.ts` and `packages/blue-data/src/score/audio/audio-layout.test.ts`; encode the data-model rules that actual source layout is `1|2|unsupported`, all-mono requires only verified mono sources with no unclassified source/effect, and mixed/stereo/unknown routes use stereo balance.
- [x] T006 [P] Implement shared pan math and validation in `packages/blue-data/src/mixer/channel-pan.ts` and `packages/blue-data/src/mixer/channel-pan.test.ts`: `pan` is finite and in `[0,1]`, defaults to `0.5`, mono uses the specified equal-power gains, stereo balance uses `min(1, 2*(1-p))` and `min(1, 2*p)`, and `nchnls=1` has no second output.
- [x] T007 Extend the CSD policy and BlueData generation APIs with an explicit disposable panning compile context carrying the typed layout manifest in `packages/blue-data/src/blue-data/csd-policy.ts`, `packages/blue-data/src/blue-data.ts`, and `packages/blue-data/src/index.ts`; keep existing callers on the exact legacy route unless panning is explicitly enabled, and fail an enabled compile that lacks required observations with a typed recoverable error.
- [x] T008 [P] Implement main-owned actual-header preflight in `packages/blue-app/src/main/audio-layout-preflight.ts` and `packages/blue-app/src/main/audio-layout-preflight.test.ts` using `fs`, `path`, `os`, and the existing `parseAudioFileMetadata` boundary; deduplicate native file identities, make the real header authoritative over cached `AudioClip.numChannels`, and inject unreadable/permission failures rather than using POSIX `chmod`.
- [x] T009 [P] Define serializable layout summaries and stable diagnostics containing code, source path, observed channel count, and user-facing message in `packages/blue-app/src/shared/audio-layout.ts` and `packages/blue-app/src/shared/render-freeze-contract.ts`; add guards/tests that keep these observations transient and prevent raw filesystem or Csound command data from crossing preload IPC.
- [x] T010 Add detached-manifest propagation and render-snapshot copy safety in `packages/blue-data/src/blue-data/csd-policy.ts`, `packages/blue-data/src/blue-data-csd-copy-safety.test.ts`, and `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`; prove preflight/compile never changes canonical XML, unknown XML, dirty state, history cursor, stable identities, or runtime identities.
- [x] T011 [P] Define the preflight failure and structural-recompile handoff between main render entrypoints and runtime reconciliation in `packages/blue-app/src/main/project-runtime-reconciliation.ts`, `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`, and `packages/blue-app/src/main/main.ts`; distinguish layout/panning topology changes from live scalar parameter publication.
- [x] T012 [P] Add contract coverage for the new compile context across synchronous/asynchronous disk, realtime, and BlueLive generation in `packages/blue-data/src/blue-data-csd-determinism.test.ts`, `packages/blue-app/src/main/csd-generation.test.ts`, `packages/blue-app/src/main/render-to-disk.test.ts`, and `packages/blue-app/src/main/blue-live-engine.test.ts`.

**Checkpoint**: Typed layout observations, pan equations, error transport, and detached CSD
generation seams exist; legacy callers still produce the captured baseline CSD.

---

## Phase 3: User Story 1 - Mix Mono and Stereo Clips on One Track (Priority: P1) 🎯 MVP

**Goal**: With score panning enabled, verified mono clips are centered into stereo without
collapsing stereo clips, and mixed tracks remain stereo-safe; disabled panning retains the old route.

**Independent Test**: Generate and render a two-channel score containing overlapping mono and
stereo clips, compare left/right samples at center and endpoints, verify all-mono center equality and
`-3.01 dB` per channel, and compare the disabled result with the pre-change legacy CSD.

### Verification for User Story 1

- [x] T013 [P] [US1] Add playback-instrument regressions for verified mono upmix, stereo left/right preservation, `filenchnls`-driven source layout, and the unchanged disabled branch in `packages/blue-data/src/score/audio/playback-instrument-orc.test.ts` and `packages/blue-data/src/score/track/track-audio-playback.test.ts`.
- [x] T014 [P] [US1] Add deterministic CSD assertions for overlapping mono/stereo clips, all-mono clips, mixer-disabled direct output, and independent left/right buses in `packages/blue-data/src/blue-data/mono-clip-panning.test.ts` and `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts`.
- [x] T015 [P] [US1] Add synchronous/asynchronous disk, realtime, and BlueLive parity plus no-mutation tests for enabled and disabled layout-aware generation in `packages/blue-data/src/blue-data-csd-parity.test.ts`, `packages/blue-data/src/blue-data-csd-determinism.test.ts`, and `packages/blue-app/src/main/csd-generation.test.ts`.
- [x] T016 [P] [US1] Add numerical engine integration coverage for center `1/sqrt(2)` gains, unity endpoints, stereo channel independence, overlapping mixed clips, and no second mono output in `packages/blue-app/src/main/mono-clip-panning.integration.test.ts`.

### Implementation for User Story 1

- [x] T017 [US1] Thread the explicit enabled/disabled panning compile context and disposable layout manifest through `packages/blue-data/src/score/track/track-audio-playback.ts` and `packages/blue-data/src/score/audio/playback-instrument-orc.ts` without changing the existing legacy route when the context is disabled.
- [x] T018 [US1] Implement enabled mono upmix as `x/sqrt(2)` on both stereo buses and preserve stereo `(L,R)` pass-through in `packages/blue-data/src/score/audio/playback-instrument-orc.ts`; retain the old mono-first-output behavior for disabled panning and never synthesize a second channel for a mono output device.
- [x] T019 [US1] Compute effective source/track layout in `packages/blue-data/src/score/audio/audio-layout.ts` and `packages/blue-data/src/blue-data/csd-policy.ts`: all-mono is eligible for Mono Pan only when every source is verified mono and no effect can produce differing channels; stereo, mixed, unknown, subchannel, and master paths use Balance.
- [x] T020 [US1] Resolve every audio clip’s manifest entry by stable clip/file identity while generating track notes and playback instruments in `packages/blue-data/src/score/track/track-audio-playback.ts` and `packages/blue-data/src/score/audio/audio-clip.ts`; reject missing or unreadable observations only for enabled panning and do not treat cached metadata as authoritative.
- [x] T021 [US1] Integrate the enabled route into source, subchannel, master, and direct output CSD generation in `packages/blue-data/src/blue-data/csd-policy.ts` and `packages/blue-data/src/score/track/track-audio-playback.ts`; preserve mixed-track stereo width, existing channel indexing, unchanged send taps, and the exact mixer-disabled route.
- [x] T022 [US1] Invoke main preflight before timeline realtime, disk render, and BlueLive CSD generation in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/main/csd-generation.ts`, `packages/blue-app/src/main/render-to-disk.ts`, and `packages/blue-app/src/main/blue-live-engine.ts`, passing the detached manifest only after successful inspection.
- [x] T023 [US1] Update the disk/realtime/BlueLive generation wrappers to accept the preflight result and preserve their existing Java-runtime/session behavior in `packages/blue-app/src/main/csd-generation.ts`, `packages/blue-app/src/main/render-to-disk.ts`, and `packages/blue-app/src/main/blue-live-engine.ts`.
- [x] T024 [US1] Reconcile a score panning/layout context change as a structural CSD/runtime rebuild while allowing stable scalar bindings to remain live in `packages/blue-app/src/main/project-runtime-reconciliation.ts`, `packages/blue-app/src/main/main.ts`, and `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`.
- [x] T025 [US1] Add end-to-end assertions for overlapping clips through post-effects, sends, gates, meters, subchannels, and master routing in `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts` and `packages/blue-app/src/main/mono-clip-panning.integration.test.ts`; verify no send signal is panned twice.
- [x] T026 [US1] Run and record the complete mixed mono/stereo, all-mono, disabled, sync/async, and numerical render matrix in `specs/112-mono-clip-panning/quickstart.md`, including the captured CSD snippets and tolerance used for floating-point comparison.

**Checkpoint**: A panning-enabled two-channel render mixes mono and stereo clips correctly, while
disabled panning and mixer-disabled generation remain byte/order-compatible with the baseline.

---

## Phase 4: User Story 2 - Open Legacy Scores Without Unrequested Audio Change (Priority: P1)

**Goal**: New scores opt into panning, while Java/pre-feature scores with an absent or invalid
setting open disabled, remain clean, preserve unknown data, and retain the old audio route until the
user explicitly enables the feature.

**Independent Test**: Load new, Java, missing-attribute, invalid-attribute, and missing-`score`
fixtures; assert the setting, dirty state, XML round-trip, generated legacy CSD, explicit toggle,
history label, and runtime restart behavior.

### Verification for User Story 2

- [x] T027 [P] [US2] Add Score model load/save/deep-copy tests for `panningEnabled: boolean`, new-score `true`, absent/invalid/missing-score `false`, explicit `true`, clean load state, and explicit attribute persistence in `packages/blue-data/src/score/score-panning.test.ts` and `packages/blue-data/src/score/score-model-compatibility.test.ts`.
- [x] T028 [P] [US2] Add XML-policy and Java-compatibility tests for a missing `<score>`, malformed/unknown panning attributes, preserved unknown project XML, Java score fixtures, and no accidental ProjectProperties fallback in `packages/blue-data/src/blue-data/xml-policy.test.ts`, `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`, and `packages/blue-data/src/blue-data/blue-data-csd-parity.test.ts`.
- [x] T029 [P] [US2] Add typed snapshot/patch/guard/classification tests for score panning state, a boolean patch, semantic action text, and structural runtime classification in `packages/blue-app/src/shared/project-editor/score-panning-contract.test.ts`, `packages/blue-app/src/shared/project-editor/contract.ts`, and `packages/blue-app/src/main/project-history-patch-classification.test.ts`.

### Implementation for User Story 2

- [x] T030 [US2] Add Score-owned `panningEnabled` with the exact rules “new true; absent/invalid or missing score false,” serialize it as `<score panningEnabled="true|false">`, and preserve the state through deep copy in `packages/blue-data/src/score/score.ts`.
- [x] T031 [US2] Make the XML loader force `panningEnabled=false` for an absent `<score>` or invalid/missing attribute without marking a legacy document dirty in `packages/blue-data/src/blue-data/xml-policy.ts` and `packages/blue-data/src/score/score.ts`.
- [x] T032 [US2] Extend the serializable score snapshot, empty snapshot, typed patch union, runtime guard, canonical patch application, preparation classification, and renderer store projection in `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/shared/project-editor/snapshot-score.ts`, `packages/blue-app/src/shared/project-editor/patch-score.ts`, `packages/blue-app/src/shared/project-editor/patch-document.ts`, and `packages/blue-app/src/renderer/stores/project-store.ts`.
- [x] T033 [US2] Add the canonical score-setting writer with semantic `Set Score Panning` history labeling, one durable patch per toggle, and correct expected-revision handling in `packages/blue-app/src/renderer/stores/project-store.ts`, `packages/blue-app/src/main/project-history.ts`, and `packages/blue-app/src/main/project-history-roundtrip.test.ts`.
- [x] T034 [US2] Add an accessible `Enable Panning` checkbox to Score Settings and wire it to the typed history patch in `packages/blue-app/src/renderer/components/workbench/panels/score/ScoreSettingsDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, and `packages/blue-app/src/renderer/stores/project-store.ts`; show the saved state without mutating it during preview or dialog cancellation.
- [x] T035 [US2] Make the score setting select the legacy or enabled CSD route in `packages/blue-data/src/blue-data/csd-policy.ts`, `packages/blue-data/src/blue-data.ts`, and `packages/blue-data/src/blue-data/blue-data-csd-parity.test.ts`; prove an untouched legacy document’s generated route is unchanged and a new score defaults to enabled.
- [x] T036 [US2] Classify a score panning toggle as structural/restart-required and reconcile the latest canonical value before relaunch in `packages/blue-app/src/main/project-runtime-reconciliation.ts`, `packages/blue-app/src/main/main.ts`, and `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`.
- [x] T037 [US2] Add end-to-end legacy open/save/reopen and explicit-enable coverage across disk, realtime, and BlueLive paths in `packages/blue-app/src/main/csd-generation.test.ts`, `packages/blue-app/src/main/render-to-disk.test.ts`, `packages/blue-app/src/main/blue-live-engine.test.ts`, and `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`; assert no unrequested audio, XML, unknown-data, dirty-state, or history change on load.
- [x] T038 [US2] Run and record new-score, Java/pre-feature, absent/invalid, missing-score, explicit-enable, save/reopen, history, and runtime-toggle scenarios in `specs/112-mono-clip-panning/quickstart.md`.

**Checkpoint**: Legacy projects load disabled and clean, new projects visibly default enabled, and an
explicit toggle is the only action that changes the persisted audio behavior.

---

## Phase 5: User Story 3 - Predictable Pan and Balance Behavior (Priority: P1)

**Goal**: All-mono tracks expose equal-power Mono Pan; stereo, mixed, and unknown layouts expose
Balance; values are durable/automatable, bounded, correctly staged, and live when a stable binding exists.

**Independent Test**: Set channel position to `0`, `0.5`, and `1` on verified all-mono, stereo,
mixed, and unknown layouts; inspect CSD gains, output-stage ordering, XML, parameter catalog,
automation, UI label/inactive state, and commit→undo→redo while playback is running.

### Verification for User Story 3

- [x] T039 [P] [US3] Add Channel XML, Java volume-only load, default-center, invalid XML, and deep-copy tests for a distinct identifiable Pan Parameter in `packages/blue-data/src/mixer/channel.test.ts` and `packages/blue-data/src/mixer/channel-pan.test.ts`.
- [x] T040 [P] [US3] Add parameter-helper/catalog tests proving Pan is enumerated once for every source/sub/master channel, retains stable unique identity through history copies, and receives deterministic compilation names in `packages/blue-data/src/automation/parameter-helper.test.ts` and `packages/blue-data/src/automation/project-parameter-catalog.test.ts`.
- [x] T041 [P] [US3] Add CSD equation and stage-order tests for equal-power Mono Pan, no-crossfeed Stereo Balance, center unity, endpoint behavior, post-effect/send ordering, gate/meter placement, and conservative sub/master handling in `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts` and `packages/blue-data/src/blue-data/mono-clip-panning.test.ts`.
- [x] T042 [P] [US3] Add typed patch, finite-range rejection, semantic label, live/restart capability, automation, and missing-binding tests in `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.test.ts`, `packages/blue-app/src/shared/project-editor/project-history-patch-classification.test.ts`, and `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`.
- [x] T043 [P] [US3] Add browser/component coverage for `Pan` versus `Balance`, accessible range `0..1`, center marker/value, keyboard operation, disabled/inactive state, and unknown-layout Balance in `packages/blue-app/src/renderer/browser/mono-clip-panning.browser.test.tsx` and `packages/blue-app/src/renderer/tests/mono-clip-panning.test.tsx`.

### Implementation for User Story 3

- [x] T044 [US3] Add a distinct Channel Pan Parameter named/identified separately from Volume, with fixed-value synchronization only when automation is off, legacy volume-only loading, `<parameter>` persistence, and history-mode identity preservation in `packages/blue-data/src/mixer/channel.ts` and `packages/blue-data/src/automation/parameter.ts`.
- [x] T045 [US3] Enforce the data-model constraint “pan is finite in `[0,1]`, default `0.5`; reject nonfinite/out-of-range user and automation values; invalid XML falls back to center” across Channel setters, mixer patches, and automation application in `packages/blue-data/src/mixer/channel.ts`, `packages/blue-data/src/mixer/channel-pan.ts`, `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`, and `packages/blue-app/src/shared/project-editor/patch-score.ts`.
- [x] T046 [US3] Include the Pan Parameter in every authoritative automation enumeration and runtime compilation order without disturbing existing Volume/send/effect ordering in `packages/blue-data/src/automation/parameter-helper.ts`, `packages/blue-data/src/automation/project-parameter-catalog.ts`, and `packages/blue-data/src/blue-data/csd-policy.ts`.
- [x] T047 [US3] Add disposable effective position mode and layout confidence to mixer snapshots, compute `Pan` only for verified all-mono tracks and `Balance` for stereo/mixed/unknown/sub/master layouts, and keep the mode inactive when score panning is off in `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts`, `packages/blue-app/src/shared/project-editor/snapshot-score.ts`, and `packages/blue-app/src/main/main.ts`.
- [x] T048 [US3] Generate the position stage after post-effects and send taps but before output gate, meter, and parent routing in `packages/blue-data/src/blue-data/csd-policy.ts`; use equal-power Mono Pan for eligible all-mono source signals, no-crossfeed Balance otherwise, no-op for `nchnls=1`, and a conservative Balance policy for sub/master until proven otherwise.
- [x] T049 [US3] Register the distinct Pan Parameter in compiled runtime bindings and make live updates depend on a stable resolved binding/graph in `packages/blue-app/src/main/runtime-parameter-sync.ts`, `packages/blue-app/src/main/project-runtime-reconciliation.ts`, and `packages/blue-app/src/main/runtime-parameter-sync.test.ts`.
- [x] T050 [US3] Add the renderer position control and integrate it into every ChannelStrip/MixerPanel source, subchannel, and master path in `packages/blue-app/src/renderer/components/workbench/panels/mixer/MixerPanSlider.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`; use accessible `Pan`/`Balance` labels and submit `Set Channel Pan` patches through the existing history boundary.
- [x] T051 [US3] Wire live preview, commit, cancel, keyboard, and automation gestures for position edits while restoring canonical state on cancellation in `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`, `packages/blue-app/src/renderer/stores/project-store.ts`, and `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`.
- [x] T052 [US3] Add commit→undo→redo integration for fixed Pan and automated Pan while stopped and during playback; assert canonical value, distinct Parameter identity, dirty state, semantic label, runtime publication/restart choice, and send/meter behavior in `packages/blue-app/src/main/project-history-roundtrip.test.ts`, `packages/blue-app/src/main/global-history-engine.integration.test.ts`, and `packages/blue-app/src/main/runtime-parameter-sync.test.ts`.
- [x] T053 [US3] Run and record the all-mono Pan, stereo/mixed/unknown Balance, endpoints/center, automation, live playback, undo/redo, send, meter, subchannel, master, and disabled-setting scenarios in `specs/112-mono-clip-panning/quickstart.md`.

**Checkpoint**: Channel position is a durable, automatable, identity-stable control whose DSP
meaning and UI label follow verified effective layout without changing send semantics.

---

## Phase 6: User Story 4 - Handle Unsupported Channel Layouts Clearly (Priority: P2)

**Goal**: Mono output remains valid, while wider output/input, unreadable files, missing observations,
and unsupported source layouts fail before audio launch with stable diagnostics and preserved project data.

**Independent Test**: Exercise `nchnls=1`, `nchnls=2`, `nchnls>2`, source files with one/two/more than
two channels, stale cache metadata, missing files, injected read failures, and legacy disabled mode;
assert launch outcome, diagnostic code/path/count, XML, dirty state, and source preservation.

### Verification for User Story 4

- [x] T054 [P] [US4] Add preflight unit tests for actual-header wins, one-header-per-unique-file deduplication, unreadable files, source `>2` channels, missing observations, output `nchnls` values, and synthetic Windows paths in `packages/blue-app/src/main/audio-layout-preflight.test.ts`.
- [x] T055 [P] [US4] Add CSD policy tests proving `nchnls=1` emits one valid mono output with no pan stage, `nchnls=2` uses the supported rules, and `nchnls>2`/input `>2`/missing layout observations fail clearly without truncation in `packages/blue-data/src/blue-data/csd-policy.test.ts` and `packages/blue-data/src/blue-data/mono-clip-panning.test.ts`.
- [x] T056 [P] [US4] Add serializable diagnostic guard and render-operation failure tests for stable code, file, count, message, no raw command/path leakage, and recoverable disk/BlueLive/timeline status in `packages/blue-app/src/shared/audio-layout.test.ts`, `packages/blue-app/src/shared/render-freeze-contract.test.ts`, and `packages/blue-app/src/main/render-to-disk.test.ts`.
- [x] T057 [P] [US4] Add no-mutation tests for unsupported/unreadable preflight, stale cached `AudioClip` metadata, unknown XML, dirty/history state, and disabled legacy fallback in `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`, `packages/blue-app/src/main/csd-export-immutability.test.ts`, and `packages/blue-app/src/main/csd-generation.test.ts`.

### Implementation for User Story 4

- [x] T058 [US4] Block panning-enabled timeline, disk, and BlueLive launch before engine creation when preflight reports unreadable, missing, source `>2`, output `>2`, or absent required observations; preserve disabled legacy launch in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/main/render-to-disk.ts`, `packages/blue-app/src/main/csd-generation.ts`, and `packages/blue-app/src/main/blue-live-engine.ts`.
- [x] T059 [US4] Propagate typed layout diagnostics into render-operation status, preload IPC, and renderer error presentation with stable code, relevant file, observed count, and an actionable message in `packages/blue-app/src/shared/audio-layout.ts`, `packages/blue-app/src/shared/render-freeze-contract.ts`, `packages/blue-app/src/preload/preload.ts`, `packages/blue-app/src/main/main.ts`, and `packages/blue-app/src/renderer/stores/project-store.ts`.
- [x] T060 [US4] Keep native filesystem identities and paths unchanged through preflight and convert only escaped forward-slash paths at the Csound text boundary in `packages/blue-app/src/main/audio-layout-preflight.ts`, `packages/blue-data/src/score/track/track-audio-playback.ts`, and `packages/blue-app/src/main/audio-layout-preflight.test.ts`.
- [x] T061 [US4] Preserve project XML/source metadata and leave the canonical document untouched after a rejected layout, while allowing an explicit later repair/retry to re-run preflight in `packages/blue-app/src/main/render-to-disk.ts`, `packages/blue-app/src/main/project-runtime-reconciliation.ts`, `packages/blue-data/src/blue-data/csd-policy.ts`, and `packages/blue-app/src/main/render-to-disk.test.ts`.
- [x] T062 [US4] Run and record the unsupported source/output, unreadable, missing-observation, stale-cache, mono-output, diagnostic, retry, and legacy-disabled matrix in `specs/112-mono-clip-panning/quickstart.md`.

**Checkpoint**: Unsupported layouts never reach the engine silently, diagnostics are actionable and
serializable, and a failed inspection does not alter the project or its legacy compatibility data.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Close parity, accessibility, portability, performance, and repository validation gaps.

- [x] T063 [P] Compare representative enabled/disabled CSD against the Java sources and artifacts in `/Users/stevenyi/work/nbprojects/blue/blue-core`, `/Users/stevenyi/work/nbprojects/blue/blue-ui-core`, `/Users/stevenyi/work/blue/demo2026/01.csd`, and `packages/blue-data/src/blue-data/blue-data-csd-parity.test.ts`; document any intentional TypeScript-only panning behavior in `specs/112-mono-clip-panning/research.md`.
- [x] T064 [P] Audit all host-path and filesystem fixtures for native path preservation, `path.join()`/`os.tmpdir()` construction, synthetic Windows paths, and injected `EACCES`/`EPERM` behavior in `packages/blue-app/src/main/audio-layout-preflight.ts`, `packages/blue-app/src/main/audio-layout-preflight.test.ts`, and `specs/112-mono-clip-panning/quickstart.md`.
- [x] T065 [P] Run the UI accessibility audit for Score Settings and mixer position controls—labels, focus order, keyboard range editing, disabled explanation, Pan/Balance announcements, and diagnostic visibility—in `packages/blue-app/src/renderer/browser/mono-clip-panning.browser.test.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/ScoreSettingsDialog.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/MixerPanSlider.tsx`.
- [x] T066 [P] Verify preflight reads each unique source once, CSD generation remains deterministic, and position DSP adds no avoidable per-sample work in `packages/blue-app/src/main/audio-layout-preflight.test.ts`, `packages/blue-data/src/blue-data-csd-determinism.test.ts`, and `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts`.
- [x] T067 Update `specs/112-mono-clip-panning/quickstart.md` with the final commands, engine/runtime prerequisites, fixture locations, expected tolerances, known limitations, and any platform-specific validation notes after focused suites pass.
- [x] T068 Run affected-package validation from `specs/112-mono-clip-panning/quickstart.md`: `pnpm --filter @blue/data test`, `pnpm --filter @blue/data build`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`, relevant browser tests, and focused real-engine integration tests.
- [x] T069 Run repository-level `pnpm test`, `pnpm lint`, and `git diff --check` from `/Users/stevenyi/work/blue-electron`; resolve or document failures in `specs/112-mono-clip-panning/quickstart.md` and retain Windows/native validation for path-sensitive behavior.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependencies; reference review and deterministic fixture work can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks every story because it defines the portable layout manifest, pan equations, main preflight, diagnostic boundary, and detached compile context.
- **User Story 1 (Phase 3)**: Depends on Phase 2 and is the MVP; its route/CSD integration establishes the enabled audio path used by later position behavior.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and can begin in parallel with US1 for model/UI work; its setting selects the enabled/legacy route produced by US1.
- **User Story 3 (Phase 5)**: Depends on the layout-aware route from US1 and the score setting/snapshot contract from US2 for the complete UI/runtime behavior; Channel parameter work can begin after Phase 2.
- **User Story 4 (Phase 6)**: Depends on the preflight/generation entrypoints from Phase 2 and US1, and validates the failure behavior used by the enabled setting in US2.
- **Polish (Phase 7)**: Depends on every desired story and its focused validation.

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2; no dependency on another story for the core mono/stereo route.
- **US2 (P1)**: Can start after Phase 2; it integrates with US1 only when selecting the enabled route.
- **US3 (P1)**: Core Channel/Parameter work can start after Phase 2; final CSD/UI/runtime integration depends on US1’s effective-layout route and US2’s score setting.
- **US4 (P2)**: Depends on US1’s enabled generation path and the shared main preflight; disabled compatibility tests remain independently runnable.

### Within Each User Story

- Verification tasks precede the implementation they protect, especially for CSD and compatibility regressions.
- Portable model/validation work precedes CSD generation; CSD binding work precedes main publication; main publication precedes renderer status/UI behavior.
- All durable score/channel edits use the canonical `ProjectHistory` patch path with semantic labels and commit→undo→redo assertions for canonical state, stable identities, dirty state, and runtime reconciliation.
- Transient layout observations and previews never enter XML/history; cancellation restores canonical document/runtime state.

### Parallel Opportunities

- Setup T001–T004 can run in parallel.
- Foundation T005, T006, T008, T009, T011, and T012 can be staffed independently; T007 and T010 consume their contracts.
- US1 verification T013–T016 can run in parallel; playback/CSD work T017–T021, main integration T022–T024, and test hardening T025 can then be split by package.
- US2 verification T027–T029 can run in parallel; T030–T032 and T034 can be developed separately before T033/T036 integration.
- US3 verification T039–T043 can run in parallel; T044–T046, T047, T048–T049, and T050–T051 are separable after their contracts exist.
- US4 verification T054–T057 can run in parallel; T058–T061 can be split between launch gating, IPC/UI status, path boundaries, and retry preservation.
- Polish T063–T066 can run in parallel; T067–T069 are final gates.

## Parallel Example: User Story 1

```text
# After Phase 2:
Workstream A: T013 -> T017 -> T018 -> T020 (playback instrument and track layout)
Workstream B: T014 -> T019 -> T021 (CSD route and effective-layout policy)
Workstream C: T015 -> T022 -> T023 -> T024 (main generation/runtime handoff)
Workstream D: T016 -> T025 (numeric engine and route integration)
Integrator: T026 (quickstart matrix after A-D)
```

## Parallel Example: User Story 2

```text
# After Phase 2, alongside US1 if desired:
Workstream A: T027 -> T030 -> T031 (Score/XML compatibility)
Workstream B: T028 -> T032 (snapshot, patch, and guards)
Workstream C: T029 -> T033 -> T036 (history and runtime classification)
Workstream D: T034 -> T037 (Score Settings and compatibility UI)
Integrator: T035 -> T038 (route selection and quickstart)
```

## Parallel Example: User Story 3

```text
# After US1/US2 contracts are available:
Workstream A: T039 -> T044 -> T045 (Channel persistence and validation)
Workstream B: T040 -> T046 -> T049 (catalog and runtime binding)
Workstream C: T041 -> T048 (CSD equations and stage ordering)
Workstream D: T043 -> T047 -> T050 -> T051 (snapshot and renderer controls)
Integrator: T042 -> T052 -> T053 (history/runtime matrix)
```

## Implementation Strategy

1. **MVP first**: Complete Phase 2 and US1 to support explicit enabled mono/stereo mixing with exact legacy fallback and deterministic numeric verification.
2. **Compatibility next**: Complete US2 so new/legacy defaults, XML round-trips, Score Settings, history, and structural runtime reconciliation are safe before broad UI rollout.
3. **Position controls**: Complete US3’s distinct Pan Parameter, effective-layout UI, DSP stage, automation, and live binding while preserving sends and meters.
4. **Failure clarity**: Complete US4 so actual file/output layouts are validated before launch and all unsupported cases are recoverable without project mutation.
5. **Handoff gate**: Run the quickstart, focused package tests/builds, repository tests/lint, `git diff --check`, and native Windows/path-sensitive validation before delivery.

---

## Phase 8: Convergence

- [x] T070 Thread `preflightAudioLayout` and its resolved manifest through timeline realtime playback by invoking preflight and passing `preflight.manifest` to `toRealtimePlaybackCSD`/`toRealtimePlaybackCSDAsync` in `startPlayback` (`packages/blue-app/src/main/main.ts`), covering the togglePlay, restartPlayback, audition, and loop callers, so panning-enabled scores with audio clips launch with the typed layout diagnostic instead of failing generation with `MISSING_AUDIO_LAYOUT` (`packages/blue-data/src/score/track/track-audio-playback.ts` throws when the manifest is absent) per T022, T058, FR-013, FR-014, US1/AC1 (missing, CRITICAL: blocks timeline playback for the new-score panning-enabled default).
- [x] T071 Add numerical engine integration coverage that renders panning-enabled CSD through Csound and asserts center `1/sqrt(2)` gains per side, unity endpoints, stereo channel independence, overlapping mixed clips, and a single valid mono output in `packages/blue-app/src/main/mono-clip-panning.integration.test.ts` (currently fixture/constants only) per T016, T025, FR-016, SC-001, SC-005 (partial).
- [x] T072 Add CSD-level assertions for the BlueMixer pan/balance stage — equal-power Mono Pan versus no-crossfeed Balance emission, placement after post-effects and send taps but before output gate, output meter, and parent routing, conservative sub/master balance, and no send panned twice — in `packages/blue-data/src/blue-data/mono-clip-panning.test.ts` (file absent) and `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts` (no panning references) per T014, T041, T055, FR-012, FR-016, SC-005 (partial).
- [x] T073 Add pan Parameter enumeration tests proving Pan appears exactly once per source/subchannel/master channel, retains a stable unique identity through history copies, and receives deterministic compilation names in `packages/blue-data/src/automation/parameter-helper.test.ts` (file absent) and `packages/blue-data/src/automation/project-parameter-catalog.test.ts` (no pan coverage) per T040, T046, FR-016 (partial).
- [x] T074 Add XML-policy panning compatibility tests for missing/invalid `panningEnabled` attributes, a missing `<score>` element, unknown project XML preservation, and a legacy load leaving the document clean in `packages/blue-data/src/blue-data/xml-policy.test.ts` (file absent) and `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts` per T028, FR-015 (partial).
- [x] T075 Add browser-level coverage for Pan versus Balance labeling, center indication, keyboard range editing, inactive-when-panning-disabled state, and the Score Settings `Enable Panning` checkbox in `packages/blue-app/src/renderer/browser/mono-clip-panning.browser.test.tsx` (file absent) per T043, T065, FR-009, SC-009 (partial).
- [x] T076 Run and record the promised verification matrices in `specs/112-mono-clip-panning/quickstart.md` (currently instructions only): mixed mono/stereo, all-mono, disabled, sync/async, and numerical render results with captured CSD snippets and tolerances (T026); legacy open/save/reopen and explicit-enable scenarios (T038); pan/balance/automation/undo-redo/live scenarios (T053); unsupported-layout matrix (T062); final commands, prerequisites, and limitations (T067) per SC-008 (partial).
- [x] T077 Add focused assertions for the `${channelId}::pan` runtime binding in `packages/blue-app/src/main/runtime-parameter-sync.test.ts` and for the `layoutDiagnostic` render-status field guard in `packages/blue-app/src/shared/render-freeze-contract.test.ts` per T049, T056, FR-016 (partial).

## Phase 9: Convergence

- [x] T078 **CRITICAL** Run the supported Windows CI or equivalent native path-sensitive validation for audio-layout preflight, native file identity handling, and embedded Csound paths, then record the result and any scoped limitation in `specs/112-mono-clip-panning/quickstart.md` per Constitution: Host-Path Portability and Boundary Forms, T064, and T069 (partial).
- [x] T079 [US3] Align the mixer snapshot layout classifier with the CSD classifier by treating only enabled stereo-generating `Effect` entries as upstream layout risks and excluding `Send` entries; share the effective-layout predicate or equivalent contract and add regressions for disabled effects and sends so `positionMode` matches the emitted Mono Pan or Stereo Balance law in `packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts`, `packages/blue-data/src/blue-data/csd-policy.ts`, and their focused tests per FR-006, FR-007, T047, and T048 (partial).
- [x] T080 [US3] Preserve the centered `Pan` heading and value-free strip while disclosing the effective law as `Mono Pan` or `Stereo Balance` in the position control's tooltip and/or accessible name, using `positionMode`; update component/browser coverage and the verification matrix so Balance-law channels remain identifiable per FR-009, SC-009, T050, and T065 (contradicts).
- [x] T081 [US4] Run `preflightAudioLayout` for the disk-profile Generate CSD to Screen entrypoint, pass its detached manifest to `generateDiskCsdForScreen`, and add enabled-audio regression coverage so this path does not fail with `MISSING_AUDIO_LAYOUT` after the other panning-aware entrypoints have been preflighted in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/csd-generation.test.ts` per the plan render-pipeline decision, T022, T058, and FR-014 (missing).
- [x] T082 [US4] Carry validated `AudioLayoutDiagnostic` objects through timeline playback, Blue Live, realtime/disk CSD-to-screen, preload IPC, and renderer error presentation instead of reducing preflight failures to plain strings; extend the status guards and focused failure tests so missing, unreadable, unsupported-source, and unsupported-output cases remain stable and recoverable per T059, FR-013, and SC-007 (partial).
- [x] T083 [P] Add a reusable platform-aware native audio-file identity boundary for preflight deduplication, preserving each original path as a manifest alias while collapsing relative/absolute, separator/case, and supported symlink aliases to one header inspection; add path-sensitive tests without changing native paths passed to filesystem APIs per T008, T060, T064, T066, and the plan performance/path decisions (partial).
- [x] T084 Refresh `specs/112-mono-clip-panning/quickstart.md` after the current implementation and convergence fixes: update test counts, Pan/Balance disclosure and tooltip/drag semantics, diagnostic-path coverage, CSD-to-screen coverage, and the Windows validation status per T067, T076, and SC-008 (partial).

## Phase 10: Convergence

- [x] T085 **CRITICAL** Run the supported Windows CI or equivalent native Windows path-sensitive validation for audio-layout preflight, reusable native audio-file identity handling, and embedded Csound paths; record the result or a scoped environment limitation in `specs/112-mono-clip-panning/quickstart.md` per Constitution: Host-Path Portability and Boundary Forms, T064, and T069 (partial).

## Phase 11: Convergence

- [x] T086 **CRITICAL** Complete the remaining supported-Windows path-sensitive validation for audio-layout preflight, reusable native audio-file identity handling, and embedded Csound paths, then record the native result or explicitly approved environment limitation in `specs/112-mono-clip-panning/quickstart.md` per Constitution: Host-Path Portability and Boundary Forms, T078, and T085 (partial).
