# Tasks: Track Layer Foundation

**Input**: Design documents from `/specs/066-track-layer-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Verification**: This feature changes canonical XML, score compilation, mixer reconciliation, main/preload IPC, program settings, and core timeline UI. Automated regression, serialization, contract, runtime, and renderer coverage is required before the matching implementation tasks are complete.

**Organization**: Tasks are grouped by user story. Phases 1–2 establish shared fixtures, Track models, generation options, placement metadata, and typed project contracts that all stories require.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its phase prerequisites because it primarily touches different files
- **[Story]**: Maps to the numbered user story in spec.md
- Every task names the concrete implementation or test path

## Phase 1: Setup (Shared Fixtures)

**Purpose**: Establish deterministic compatibility and UI fixtures before changing canonical models.

- [x] T001 Add representative Java and TypeScript Audio Layer XML fixtures with clips, automation IDs, and stable mixer associations in packages/blue-data/src/migration/fixtures/track-layer/legacy-java-audio-layers.blue.xml and packages/blue-data/src/migration/fixtures/track-layer/legacy-typescript-audio-layers.blue.xml
- [x] T002 [P] Add reusable mixed Track, instrument, and generated-CSD test builders in packages/blue-data/src/score/track/track-test-fixtures.ts
- [x] T003 [P] Add renderer snapshot and drag/clipboard builders for Track rows in packages/blue-app/src/renderer/tests/track-layer-fixtures.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the sole canonical Track model, exhaustive placement metadata, shared generation contract, and main-owned snapshot/patch boundary.

**⚠️ CRITICAL**: No user-story implementation begins until this phase passes focused data and shared-contract tests.

- [x] T004 [P] Add failing exhaustiveness and deny-by-default tests for every built-in SoundObject Track placement descriptor in packages/blue-data/src/sound-objects/sound-object-registry.test.ts
- [x] T005 Implement required Track placement and instrument-target descriptors for every registration in packages/blue-data/src/sound-objects/sound-object-registry.ts and packages/blue-data/src/sound-objects/register-sound-object-types.ts
- [x] T006 [P] Add failing Track/TrackLayerGroup deep-copy, mixed-order, optional-instrument, Note Processor, automation, and XML round-trip tests in packages/blue-data/src/score/track/track.test.ts and packages/blue-data/src/score/track/track-layer-group.test.ts
- [x] T007 Implement canonical Track, TrackLayerGroup, and provider models and exports in packages/blue-data/src/score/track/track.ts, packages/blue-data/src/score/track/track-layer-group.ts, packages/blue-data/src/score/track/track-layer-group-provider.ts, packages/blue-data/src/score/score.ts, and packages/blue-data/src/index.ts
- [x] T008 [P] Add failing generation-options and p1 replacement tests covering numeric, fractional, negative, named, malformed, preserved, and authored-data-neutral cases in packages/blue-data/src/score/score-generation-options.test.ts
- [x] T009 Implement static-import-safe ScoreGenerationOptions, nonserialized Note eligibility, and LayerGroup/SoundObject signature adaptation in packages/blue-data/src/score/score-generation-options.ts, packages/blue-data/src/sound-objects/note.ts, packages/blue-data/src/sound-objects/sound-object.ts, packages/blue-data/src/score/layers/layer-group.ts, packages/blue-data/src/score/score.ts, and packages/blue-data/src/score/patterns/patterns-layer-group.ts
- [x] T010 [P] Add failing Track snapshot, stable-target, stale-session, wrong-group, unsupported-payload, and no-partial-mutation contract tests in packages/blue-app/src/shared/project-editor-track-contract.test.ts
- [x] T011 Define TrackLayerGroupSnapshot, TrackSnapshot, TrackRef, Track instrument summary, mixed-item patch variants, and stable-ID resolution in packages/blue-app/src/shared/project-editor.ts
- [x] T012 Adapt renderer project state and selection/clipboard location types from audio rows to canonical Track rows in packages/blue-app/src/renderer/stores/project-store.ts, packages/blue-app/src/renderer/stores/score-selection-store.ts, and packages/blue-app/src/renderer/components/workbench/panels/score/types.ts
- [x] T013 Centralize AudioClip and capability-based SoundObject destination validation for add/paste/drag/move in packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/score-clipboard-utils.ts and packages/blue-app/src/shared/project-editor.ts

**Checkpoint**: The canonical in-memory Track model, registration policy, generation options, and main/renderer contract compile and pass their focused tests.

---

## Phase 3: User Story 1 - Compose With Mixed-Content Tracks (Priority: P1) 🎯 MVP

**Goal**: Users can directly edit, save, reopen, and compile AudioClips and compatible SoundObjects on one Track while retaining native editors and gestures.

**Independent Test**: Create one Track, add/move/edit one AudioClip and one PianoRoll on it, save/reopen, and verify ordered mixed content and normal type-specific editors.

### Verification for User Story 1

- [x] T014 [P] [US1] Add failing mixed Track item acceptance, ordering, mute/solo, render-window, and save/reopen tests in packages/blue-data/src/score/track/track-mixed-content.test.ts
- [x] T015 [P] [US1] Add failing canonical add/remove/move/paste and incompatible AudioFile no-mutation tests in packages/blue-app/src/shared/project-editor-track-items.test.ts
- [x] T016 [P] [US1] Add failing renderer tests for mixed hit-testing, marquee, overlap order, SoundObject add menu, AudioClip gestures, cross-group validation, and native double-click editors in packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx

### Implementation for User Story 1

- [x] T017 [US1] Implement mixed Track item generation and extract AudioClip playback event/fade/trim/loop behavior from AudioLayer in packages/blue-data/src/score/track/track.ts and packages/blue-data/src/score/track/track-audio-playback.ts
- [x] T018 [US1] Implement canonical mixed Track item add/remove/move/copy/paste patch handling with destination-first validation in packages/blue-app/src/shared/project-editor.ts
- [x] T019 [P] [US1] Extract shared score gesture, snapping, selection, and cross-group movement helpers from the two legacy canvases into packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/score-timeline-gesture-utils.ts
- [x] T020 [US1] Build the single mixed-content gesture coordinator and render AudioClip/SoundObject bars in packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx
- [x] T021 [US1] Route Track snapshots to the new canvas and preserve nested SoundObject editor navigation in packages/blue-app/src/renderer/components/workbench/panels/score/LayerPanel.tsx
- [x] T022 [US1] Rename current authoring choices and row operations to Track Layer Group/Track and expose explicit Track/SoundObject group additions in packages/blue-app/src/renderer/components/workbench/panels/score/ScoreManagerDialog.tsx and packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx
- [x] T023 [US1] Add an integration regression for mixed selection, ScoreObject Editor/Properties routing, project acknowledgement, and save/reopen projection in packages/blue-app/src/renderer/tests/score-track-layer-integration.test.tsx

**Checkpoint**: Mixed Tracks work without an assigned instrument and can be validated independently of the Track instrument UI.

---

## Phase 4: User Story 2 - Assign and Compile a Track Instrument (Priority: P1)

**Goal**: A Track owns one independently editable instrument; eligible SoundObject notes compile to its runtime p1, and users assign/edit it through the chosen menu, clipboard, library drop, and floating always-on-top editor workflows.

**Independent Test**: Assign a Generic Instrument, add a PianoRoll authored for another p1, compile CSD, and verify one Track instrument plus eligible runtime p1 replacement; then exercise non-modal editor use, cut/copy/paste, and Unified Library drop independence.

### Verification for User Story 2

- [x] T024 [P] [US2] Add failing sync/async CSD and host-runtime detection tests for deterministic Track instrument registration, UDO/ftable/global/parameter/string participation, eligible p1 replacement, runtime-backed Track contents/instruments, preserved special events, replacement, clear, and no stale runtime state in packages/blue-data/src/score/track/track-instrument-csd.test.ts
- [x] T025 [P] [US2] Add failing Instance ownership and all built-in compatible SoundObject eligibility-preservation tests, plus explicit PolyObject exclusion, in packages/blue-data/src/sound-objects/track-instrument-override.test.ts
- [x] T026 [P] [US2] Add failing main-owned create/replace/clear/update and shared cut/copy/paste independence tests in packages/blue-app/src/shared/project-editor-track-instrument.test.ts
- [x] T027 [P] [US2] Add failing Unified Library preview/apply tests for valid assignment, replacement, wrong source type, stale Track, unsupported payload, and independent copy in packages/blue-app/src/main/unified-library/track-instrument-transfer.test.ts
- [x] T028 [P] [US2] Add failing Track instrument control tests for menu contents/enablement, replacement, clipboard actions, drop feedback, and assigned/unassigned double-click behavior in packages/blue-app/src/renderer/tests/track-instrument-control.test.tsx
- [x] T029 [P] [US2] Add failing non-modal/always-on-top window, preload validation, canonical refresh, stale target, Track removal, instrument replacement/clear, and project-switch tests in packages/blue-app/src/main/track-instrument-editor-window-manager.test.ts, packages/blue-app/src/shared/track-instrument-editor-contract.test.ts, and packages/blue-app/src/renderer/tests/track-instrument-editor-window.test.tsx

### Implementation for User Story 2

- [x] T030 [US2] Add Track-aware host-runtime dependency traversal, deterministic instrument pre-registration, and Track ID runtime lookup before Arrangement dependency collection in every standard sync/async/disk path in packages/blue-data/src/compile-data.ts, packages/blue-data/src/score/score.ts, and packages/blue-data/src/blue-data.ts
- [x] T031 [P] [US2] Mark assignable musical notes in packages/blue-data/src/sound-objects/generic-score.ts, packages/blue-data/src/sound-objects/python-object.ts, packages/blue-data/src/sound-objects/clojure-object.ts, packages/blue-data/src/sound-objects/javascript-object.ts, packages/blue-data/src/sound-objects/external.ts, packages/blue-data/src/sound-objects/line-object.ts, packages/blue-data/src/sound-objects/zak-line-object.ts, packages/blue-data/src/sound-objects/pattern-object.ts, packages/blue-data/src/sound-objects/piano-roll.ts, packages/blue-data/src/sound-objects/j-mask.ts, packages/blue-data/src/sound-objects/tracker-object.ts, and packages/blue-data/src/sound-objects/object-builder.ts
- [x] T032 [P] [US2] Implement Instance-propagated and Sound/FrozenSoundObject/CSDSoundObject/Comment-preserved eligibility while keeping PolyObject Track-incompatible in packages/blue-data/src/sound-objects/instance.ts, packages/blue-data/src/sound-objects/sound.ts, packages/blue-data/src/sound-objects/frozen-sound-object.ts, packages/blue-data/src/sound-objects/csd-sound-object.ts, packages/blue-data/src/sound-objects/comment.ts, and packages/blue-data/src/sound-objects/register-sound-object-types.ts
- [x] T033 [US2] Implement Track instrument snapshot/reification and atomic create/replace/clear/update patches using independent copies in packages/blue-app/src/shared/project-editor.ts
- [x] T034 [US2] Extend typed Unified Library targets and transfer application for independent Track instrument replacement in packages/blue-app/src/shared/unified-library.ts and packages/blue-app/src/main/unified-library/service.ts
- [x] T035 [US2] Implement the left-row TrackInstrumentControl with Arrangement-equivalent Use New Instrument choices, shared Cut/Copy/Paste, and Unified Library drop target in packages/blue-app/src/renderer/components/workbench/panels/score/TrackInstrumentControl.tsx and packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx
- [x] T036 [US2] Define validated Track instrument editor document/request/patch contracts and preload APIs in packages/blue-app/src/shared/track-instrument-editor-contract.ts, packages/blue-app/src/preload/preload.ts, and packages/blue-app/src/renderer/types/global.d.ts
- [x] T037 [US2] Implement one non-modal, always-on-top child window per session-fenced stable Track target, project-update broadcasting, and stale-window cleanup in packages/blue-app/src/main/track-instrument-editor-window-manager.ts and packages/blue-app/src/main/main.ts
- [x] T038 [US2] Build the Track instrument editor entry page and adapt the reusable instrument editor to Track patches in packages/blue-app/src/renderer/track-instrument-editor.html, packages/blue-app/src/renderer/track-instrument-editor.tsx, packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx, and packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentEditorPanel.tsx

**Checkpoint**: Assignment, independent ownership, generation, and floating editor use are fully functional without requiring Track Note Processor or legacy migration work.

---

## Phase 5: User Story 3 - Process and Mix Each Track (Priority: P1)

**Goal**: Each Track owns a persistent Note Processor Chain and exactly one stable mixer source that receives assigned-instrument, AudioClip, and mixer-aware self-generated output in the specified order.

**Independent Test**: Add p1-changing Track processing to a Track containing a PianoRoll and AudioClip, compile, and verify object→override→Track→root processing plus shared mixer routing and state preservation.

### Verification for User Story 3

- [x] T039 [P] [US3] Add failing object/override/Track/group/root processor-order tests, including async runtime-backed and empty/error chains, in packages/blue-data/src/score/track/track-note-processor-order.test.ts
- [x] T040 [P] [US3] Add failing 100-cycle Track mixer add/remove/rename/reorder reconciliation tests preserving effects, sends, automation, level, and output routing in packages/blue-app/src/shared/project-editor-track-mixer.test.ts
- [x] T041 [P] [US3] Add failing generated-CSD routing tests for assigned instruments, Track AudioClip playback, Sound, FrozenSoundObject, mixer-disabled fallback, and missing association recovery in packages/blue-data/src/score/track/track-mixer-routing.test.ts
- [x] T042 [P] [US3] Add failing Track row Note Processor control and dialog persistence tests in packages/blue-app/src/renderer/tests/score-panel-session-reset.test.tsx and packages/blue-app/src/renderer/tests/note-processor-chain-dialog.test.tsx

### Implementation for User Story 3

- [x] T043 [US3] Apply Track Note Processor Chains after eligible p1 replacement in sync/async generation and retain root Score processing last in packages/blue-data/src/score/track/track.ts and packages/blue-data/src/score/score.ts
- [x] T044 [US3] Replace Audio-layer mixer descriptor/reconciliation with Track group/channel association logic in packages/blue-app/src/shared/project-editor.ts
- [x] T045 [US3] Make assigned instruments and Track audio playback resolve mixer channels association-first using Track ID, with name/Master recovery only, in packages/blue-data/src/arrangement.ts and packages/blue-data/src/score/track/track-audio-playback.ts
- [x] T046 [US3] Route mixer-aware Sound and FrozenSoundObject support instruments through the Track association without changing their p1 ownership in packages/blue-data/src/sound-objects/sound.ts and packages/blue-data/src/sound-objects/frozen-sound-object.ts
- [x] T047 [US3] Expose the Track Note Processor button, chain summary, and stable Track chain target in packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx and packages/blue-app/src/renderer/stores/project-store.ts

**Checkpoint**: Track processing order and one-channel routing are deterministic and independently testable.

---

## Phase 6: User Story 4 - Migrate Historical Audio Layers (Priority: P1)

**Goal**: Historical Audio Layer projects load as Tracks with complete covered data/mixer preservation, save only canonical Track XML, and reopen idempotently without legacy runtime classes.

**Independent Test**: Open each Phase 1 fixture, compare all covered fields and routing, save/reopen, and confirm Track-only XML and exactly one preserved channel per Track.

### Verification for User Story 4

- [x] T048 [P] [US4] Add failing raw-XML migration tests for Java/TypeScript versions, nested unknown siblings, empty groups, missing/duplicate IDs, automation, mixer associations, and idempotence in packages/blue-data/src/migration/migrate-audio-layers-to-tracks.test.ts
- [x] T049 [P] [US4] Add failing end-to-end `BlueData.loadFromString()` canonical save/reopen and generated-CSD equivalence tests for every legacy fixture in packages/blue-data/src/migration/track-layer-migration-integration.test.ts
- [x] T050 [P] [US4] Add failing app snapshot/mixer migration tests proving preserved effects/sends/automation/routing and no duplicate channels in packages/blue-app/src/shared/project-editor-track-migration.test.ts

### Implementation for User Story 4

- [x] T051 [US4] Implement idempotent structure-based `audioLayerGroup`/`audioLayers`/`audioLayer` raw conversion before deserialization in packages/blue-data/src/migration/migrate-audio-layers-to-tracks.ts and packages/blue-data/src/migration/upgrade-manager.ts
- [x] T052 [US4] Remove legacy AudioLayer loading/saving/provider paths and update Score/type exports to Track-only canonical runtime behavior in packages/blue-data/src/score/score.ts, packages/blue-data/src/score/audio/audio-layer.ts, packages/blue-data/src/score/audio/audio-layer-group.ts, packages/blue-data/src/score/audio/audio-layer-group-provider.ts, packages/blue-data/src/score/audio/audio-layer-listener.ts, and packages/blue-data/src/index.ts
- [x] T053 [US4] Remove legacy audio snapshot/store/canvas branches and rename affected tests/fixtures to Track semantics in packages/blue-app/src/shared/project-editor.ts, packages/blue-app/src/renderer/stores/project-store.ts, packages/blue-app/src/renderer/components/workbench/panels/score/LayerPanel.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/AudioLayerGroupCanvas.tsx
- [x] T054 [US4] Add a repository guard that fails on production AudioLayer/AudioLayerGroup model imports while permitting AudioClip/fade helpers and historical fixture strings in scripts/verify.mjs

**Checkpoint**: TypeScript Blue has one Track runtime model, loads historical Audio Layers, and writes no compatibility shadow data.

---

## Phase 7: User Story 5 - Choose the Default Layer Group (Priority: P2)

**Goal**: Program Options defaults new projects to Track Layer while allowing SoundObject Layer, with safe fallback for older settings.

**Independent Test**: Create new projects under each setting and from a saved settings file missing the new field; verify the initial group/row type and height without changing existing projects.

### Verification for User Story 5

- [x] T055 [P] [US5] Add failing factory, merge/normalization, validation, reset, and usage-matrix tests for Default Layer Group Type in packages/blue-app/src/shared/program-settings.test.ts and packages/blue-app/src/main/program-settings-usage.test.ts
- [x] T056 [P] [US5] Add failing new-project and generic add-group tests for Track/SoundObject choices, one initial row, default height, mixer channel creation, explicit-choice preservation, and no existing-project mutation in packages/blue-app/src/main/program-settings-application.test.ts and packages/blue-app/src/shared/project-editor-layer-group-default.test.ts
- [x] T057 [P] [US5] Add failing Project Defaults selector rendering/change/reset tests in packages/blue-app/src/renderer/tests/project-default-layer-group-setting.test.tsx

### Implementation for User Story 5

- [x] T058 [US5] Add normalized `defaultLayerGroupType: 'TRACK' | 'SOUND_OBJECT'` with TRACK factory fallback and usage-matrix entry in packages/blue-app/src/shared/program-settings.ts and packages/blue-app/src/main/program-settings-usage.ts
- [x] T059 [US5] Create the configured initial Track or SoundObject group during new-project setup and normalize omitted generic add-group intents while preserving explicit choices in packages/blue-app/src/main/program-settings-application.ts, packages/blue-app/src/main/main.ts, and packages/blue-app/src/shared/project-editor.ts
- [x] T060 [US5] Add the Default Layer Group Type selector to Program Options in packages/blue-app/src/renderer/components/settings/ProjectDefaultsSettings.tsx

**Checkpoint**: Future projects honor the app-wide choice, Track remains the safe default, and open projects remain untouched.

---

## Phase 8: Polish & Cross-Cutting Verification

**Purpose**: Prove performance, boundary discipline, compatibility divergence, and end-to-end usability across all stories.

- [x] T061 [P] Add a 1,000-item mixed Track interaction/compile regression and linear reconciliation assertion in packages/blue-app/src/renderer/tests/track-layer-performance.test.tsx and packages/blue-data/src/score/track/track-performance.test.ts
- [x] T062 [P] Update generated development guidance and feature status for Track Layer, the removed Audio runtime, and TypeScript-only Track XML in AGENTS.md and specs/066-track-layer-foundation/quickstart.md
- [x] T063 Run the complete manual workflow and retain migration/CSD/non-modal always-on-top editor evidence described in specs/066-track-layer-foundation/quickstart.md
- [x] T064 Run `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, affected package builds, then repository `pnpm test`, `pnpm lint`, and `pnpm build` from /Users/stevenyi/work/blue-electron
- [x] T065 Compare the final implementation against specs/066-track-layer-foundation/spec.md, plan.md, data-model.md, both contracts, all 27 requirement-checklist items, and the Java references before marking the spec complete

### Corrective compliance pass

- [x] T066 [P] Preserve unmodeled Track Layer Group, tracks-container, and Track XML through canonical load/save/reopen and add fixture assertions in packages/blue-data/src/score/track/track-layer-group.ts, packages/blue-data/src/score/track/track.ts, and packages/blue-data/src/migration/track-layer-migration-integration.test.ts
- [x] T067 [P] Document the explicit removal of the unreleased, incomplete NotationObject from the registered/public SoundObject surface in specs/066-track-layer-foundation/spec.md, plan.md, research.md, data-model.md, contracts/persistence-generation.md, and quickstart.md
- [x] T068 [P] Make PolyObject Track-incompatible across creation, paste, and move boundaries while preserving correct Instance descendant p1 ownership in packages/blue-data/src/sound-objects/register-sound-object-types.ts, packages/blue-data/src/sound-objects/instance.ts, and focused data/app tests
- [x] T069 [P] Clarify and verify the Track instrument editor as a non-modal, always-on-top child that leaves the main window interactive in the spec, research, app contract, quickstart, and window tests
- [x] T070 [P] Expand the checked Track verification evidence for runtime detection, replacement/clear state, processor failures, routing, menu actions/enablement, and stale editor requests in the existing focused test files
- [x] T071 [P] Retain the first canonical mixer group/channel on duplicate associations and prove its state survives reconciliation in packages/blue-app/src/shared/project-editor.ts and packages/blue-app/src/shared/project-editor-track-mixer.test.ts
- [x] T072 [P] Require session/revision fences on every Track mutation/editor target and reject missing or stale targets in packages/blue-app/src/shared/project-editor.ts, packages/blue-app/src/shared/track-instrument-editor-contract.ts, related callers, and contract tests
- [x] T073 [P] Reconcile the mixer immediately when an omitted generic add-group intent resolves to Track and assert channel creation in packages/blue-app/src/shared/project-editor.ts and packages/blue-app/src/shared/project-editor-layer-group-default.test.ts
- [x] T074 [P] Match the Track instrument menu contract exactly as Use New Instrument, Cut, Copy, Paste with correct enablement and action tests in packages/blue-app/src/renderer/components/workbench/panels/score/TrackInstrumentControl.tsx and packages/blue-app/src/renderer/tests/track-instrument-control.test.tsx
- [x] T075 [P] Replace the ambiguous scale gate with explicit linear-work assertions plus a two-times comparative manual threshold in the spec, plan, quickstart, and Track performance tests
- [x] T076 Share Track sync/async range planning, item finalization, audio merge, p1 override, and unmarked-note preservation in packages/blue-data/src/score/track/track.ts without changing observable generation order
- [x] T077 Run focused Track data/app suites, affected builds, repository test/lint/build/verify, and the Karpathy complexity/diff checks for this corrective pass
- [x] T078 [P] Reproduce and cover Track BlueSynthBuilder copy loss so widget trees, independent parameter/preset identities, automation metadata, embedded UDOs, and generated replacements survive snapshot reification in packages/blue-app/src/shared/project-editor.ts and packages/blue-app/src/shared/project-editor-track-instrument.test.ts
- [x] T079 [P] Match Track embedded-UDO registration and generated ordering to Arrangement instruments, prevent duplicate parameter-channel declarations, and cover deterministic render output in packages/blue-data/src/score/track/track-instrument-udo-csd.test.ts and packages/blue-data/src/blue-data.ts
- [x] T080 Map compiled parameter names back to live Track instruments in render order and propagate Track preset/widget patches to regular playback and Blue Live in packages/blue-app/src/main/runtime-parameter-sync.ts, packages/blue-app/src/main/bsb-instrument-runtime-sync.ts, packages/blue-app/src/main/main.ts, and packages/blue-app/src/main/blue-live-engine.ts
- [x] T081 Diagnose, back up, repair, regenerate, and Csound-validate /Users/stevenyi/work/blue/test_tracks2.blue; retain focused regressions plus full package test/build evidence
- [x] T082 [P] Unify Track instrument copy/cut/paste with the typed Unified Library buffer, preserve enabled state and automation curve XML, and prove the complete Track/Arrangement/Unified-Library 3×3 transfer matrix plus all supported instrument-class portable round trips in packages/blue-app/src/main/unified-library/instrument-copy-matrix.test.ts and packages/blue-data/src/instruments/instrument-portable-copy.test.ts

---

## Phase 9: Corrective Clipboard Parity

- [x] T083 [US1] Bridge single Track SoundObject Copy/Cut into the typed Library SoundObject buffer with guarded Cut removal and focused renderer tests in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx` and `packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx`
- [x] T084 [US2] Give Track-owned embedded UDOs exact stable source/destination owners, remove invalid project targets from standalone library instrument editors, and cover main/renderer transfer behavior in the Unified Library adapter and UDO table tests
- [x] T085 [US2] Make the active typed Library clipboard main-owned and shared across the main and Track instrument editor windows through the existing library snapshot contract, with service/store regression coverage
- [x] T086 [US3] Share the Note Processor buffer across chain editors and add detached cross-editor coverage; add missing detached shared-buffer coverage for Piano Roll notes
- [x] T087 [US2] Synchronize the type-isolated BSB widget buffer through the main-owned service snapshot so Arrangement and detached Track instrument canvases share Copy/Paste, with validator, service-clone, and renderer hydration/publication tests

---

## Phase 10: Corrective Track Presentation

- [x] T088 [US3] Flatten the associated Track channel from the automation chooser in Pre-Effects/dB/Post-Effects order, give unnamed Track mixer strips italic one-based fallback labels without persisting names, and add focused contract/renderer regressions in `packages/blue-app/src/shared/project-editor.ts`, `packages/blue-app/src/shared/score-timeline-automation-contract.test.ts`, `packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationTargetMenu.tsx`, `packages/blue-app/src/renderer/tests/score-timeline-automation-menu.test.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`, and `packages/blue-app/src/renderer/tests/mixer-panel.test.tsx`

---

## Phase 11: Corrective ScoreObject Interaction Parity

- [x] T089 [P] [US1] Add failing renderer regressions for Track Command-click paste, Track PianoRoll double-click selection stability, no-flash same-type ScoreObject editor loading, and chooser-backed Set Color on Track and SoundObject Layers in `packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx`, `packages/blue-app/src/renderer/tests/score-time-canvas-double-click-editor.test.tsx`, and `packages/blue-app/src/renderer/tests/score-object-editor-loading.test.tsx`
- [x] T090 [US1] Route empty-position Track modifier-click through the canonical Track paste helper and remove redundant Track double-click reselection in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`
- [x] T091 [US1] Share one ScoreObject color chooser across Track and SoundObject timelines, select the right-clicked SoundObject before its menu action, and retain the mounted ScoreObject editor while a replacement document loads in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreObjectColorPicker.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx`
- [x] T092 [US1] Run focused renderer regressions, the affected renderer build, Spec Kit consistency checks, and Karpathy complexity/diff review; record the corrective behavior in the feature specification, plan, research, app contract, checklist, and quickstart

---

## Phase 12: Corrective Render-Window Parity

- [x] T093 [P] [US1] Add paired failing Score-level regressions for nonzero render-start PianoRoll generation through Track and SoundObject Layers in synchronous and asynchronous paths, plus a Track AudioClip double-rebase guard, in `packages/blue-data/src/score/score-render-start-offset.test.ts`
- [x] T094 [US1] Share the SoundObject-event render-start rebase between root PolyObject and Track generation, applying it before Track AudioClip merge, in `packages/blue-data/src/utilities/score.ts`, `packages/blue-data/src/sound-objects/poly-object.ts`, and `packages/blue-data/src/score/track/track.ts`
- [x] T095 [US1] Record render-window origin parity and Java-first rationale in the feature specification, plan, research, persistence/generation contract, checklist, and quickstart
- [x] T096 [US1] Run focused and complete `@blue/data` tests/build, Spec Kit consistency checks, and Karpathy complexity/diff review

---

## Phase 13: Corrective Rapid Track Instrument Updates

- [x] T097 [P] [US2] Add failing detached-editor regressions for a three-value BSB burst, immediate runtime messages, one durable request in flight, pending-value coalescing, and stale-revision retry in `packages/blue-app/src/renderer/tests/track-instrument-editor-window.test.tsx` and `packages/blue-app/src/renderer/tests/track-instrument-patch-queue.test.ts`
- [x] T098 [P] [US2] Extend and validate the shared BSB realtime-control contract with a project-session/stable-Track target, preserve Arrangement targeting, and prove Track-owned compiled-channel resolution in `packages/blue-app/src/shared/project-editor.ts`, `packages/blue-app/src/shared/track-instrument-editor-contract.test.ts`, `packages/blue-app/src/main/bsb-instrument-runtime-sync.ts`, and `packages/blue-app/src/main/bsb-instrument-runtime-sync.test.ts`
- [x] T099 [US2] Separate immediate Track runtime feedback from a serialized/coalesced durable editor queue, return typed stale/current patch results for automatic rebase/retry, ignore older snapshots, and close old editors before instrument replacement in `packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx`, `packages/blue-app/src/renderer/components/track-instrument-editor/track-instrument-patch-queue.ts`, `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`
- [x] T100 [US2] Record rapid-control requirements, state ownership, runtime/persistence separation, recovery, measurable success, and manual validation in the feature specification, plan, research, data model, app and generation contracts, checklist, and quickstart
- [x] T101 [US2] Run focused runtime/editor suites, complete `@blue/app` tests and builds, Spec Kit consistency analysis, and Karpathy complexity/diff review

---

## Phase 14: Corrective Continuous Set Color Updates

- [x] T102 [P] [US1] Add failing renderer regressions that dispatch successive color edits through Track and SoundObject Layer Set Color actions in `packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx` and `packages/blue-app/src/renderer/tests/score-time-canvas-double-click-editor.test.tsx`
- [x] T103 [US1] Retain the invocation-scoped captured selection for the full picker interaction and dispatch each emitted color to all targets together in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`
- [x] T104 [US1] Record the continuous-picker contract, run focused and complete `@blue/app` tests plus the renderer build, and complete Spec Kit/Karpathy consistency checks

---

## Phase 15: Corrective Persistent Color Picker Placement

- [x] T105 [P] [US1] Add focused regressions for persistent preset/hex/inside/repeated-trigger edits, outside-click and Escape dismissal, deterministic above/below placement, and Set Color row visibility in `packages/blue-app/src/renderer/tests/color-picker.test.tsx`, `packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx`, and `packages/blue-app/src/renderer/tests/score-time-canvas-double-click-editor.test.tsx`
- [x] T106 [US1] Implement one portal-rendered persistent picker with preset, HSL, and hexadecimal editing plus viewport-clamped placement in `packages/blue-app/src/renderer/components/ColorPicker.tsx` and `packages/blue-app/src/renderer/components/color-picker-utils.ts`
- [x] T107 [US1] Replace renderer-native color inputs in ScoreObject Properties, automation, line definitions, and BSB properties, and anchor Track/SoundObject Set Color outside the complete affected row
- [x] T108 [US1] Record the persistent-picker contract, run focused and complete `@blue/app` tests plus the renderer build, and complete Spec Kit/Karpathy consistency checks

---

## Phase 16: Final Feature Closeout

- [x] T109 [P] [US3] Move the Track-only automation XML/deep-copy regression from `packages/blue-data/src/score/audio/audio-layer-automation.test.ts` to `packages/blue-data/src/score/track/track-automation.test.ts`
- [x] T110 Record project-owner manual acceptance, run repository-wide test/lint/build/verify gates, update final feature status and evidence, and commit the completed specification

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 fixtures and blocks every user story.
- **US1 / Phase 3**: Depends on Phase 2 and establishes the mixed Track timeline.
- **US2 / Phase 4**: Depends on Phase 2 and the canonical Track row; its UI integration uses the US1 left/timeline projection.
- **US3 / Phase 5**: Depends on US1 Track audio generation and US2 instrument registration so it can prove shared routing/order.
- **US4 / Phase 6**: Depends on the final Track representation from US1–US3, then removes the legacy AudioLayer runtime paths.
- **US5 / Phase 7**: Depends on Phase 2 Track construction and US3 mixer reconciliation; otherwise it can be developed in parallel with US4.
- **Phase 8 (Polish)**: Depends on every story selected for delivery.
- **Phase 9 (Corrective Clipboard Parity)**: Depends on the completed US1–US3 clipboard surfaces and the detached Track instrument editor from US2.
- **Phase 10 (Corrective Track Presentation)**: Depends on the completed US3 Track mixer association and automation snapshot/menu surfaces.
- **Phase 11 (Corrective ScoreObject Interaction Parity)**: Depends on the completed US1 Track timeline, shared ScoreObject buffer, and existing ScoreObject editor routing.
- **Phase 12 (Corrective Render-Window Parity)**: Depends on the completed US1 mixed Track generation and preserves the established SoundObject Layer render-window contract.
- **Phase 13 (Corrective Rapid Track Instrument Updates)**: Depends on the completed US2 detached editor and T080 live parameter mapping; it preserves canonical revision fences while separating transient runtime feedback from durable persistence.
- **Phase 14 (Corrective Continuous Set Color Updates)**: Depends on the chooser-backed Track/SoundObject Layer Set Color implementation from Phase 11 and preserves one captured selection across all native input events in a picker invocation.
- **Phase 15 (Corrective Persistent Color Picker Placement)**: Depends on Phase 14's continuous captured-selection contract and extends one persistent in-app picker to every renderer color surface while keeping the edited timeline row visible.
- **Phase 16 (Final Feature Closeout)**: Depends on every corrective phase, records project-owner manual acceptance, colocates the remaining Track automation regression, and completes repository-wide validation before commit.

### User story dependency graph

```text
Setup -> Foundation -> US1 Mixed Track -> US2 Instrument -> US3 Process/Mix -> US4 Migration
                         \                                      \
                          +--------------------------------------> US5 Defaults
```

US1 is the first demonstrable slice. US2 and US3 complete the Track's musical behavior. US4 deliberately lands after that behavior so historical data migrates directly to the final model. US5 can overlap late US4 work after mixer/default constructors are stable.

### Within each story

- Add the failing regression/contract tests first.
- Implement the portable data/compiler behavior before app projections.
- Implement canonical main-process mutation/validation before renderer controls.
- Keep sync and async generation changes together.
- Validate the story checkpoint before moving to its dependent story.

## Parallel Opportunities

### User Story 1

```text
T014 data mixed-content tests
T015 shared patch tests
T016 renderer canvas tests
```

After T018, the shared gesture extraction in T019 can proceed while data generation T017 is finalized; T020 then integrates both.

### User Story 2

```text
T024 CSD registration tests
T025 SoundObject eligibility tests
T026 project mutation/clipboard tests
T027 library transfer tests
T028 instrument control tests
T029 floating editor tests
```

After T030, simple note owners (T031) and Instance/special owners (T032) can proceed in parallel. Library transfer (T034), header control (T035), and floating editor contract/window/page work (T036–T038) touch separate boundaries but integrate in order.

The Phase 13 renderer burst regression (T097) and shared/main runtime target coverage (T098) can proceed in parallel before the editor/main persistence integration (T099).

### User Story 3

```text
T039 processor-order tests
T040 mixer reconciliation tests
T041 routing CSD tests
T042 row control tests
```

Track processing (T043), reconciliation (T044), and renderer control (T047) can be implemented in parallel before routing integration T045–T046 is validated.

### User Story 4

```text
T048 raw migration tests
T049 BlueData round-trip/CSD tests
T050 app mixer preservation tests
```

Migration implementation T051 must precede removal tasks T052–T053. The repository guard T054 lands after those removals.

### User Story 5

```text
T055 settings model tests
T056 new-project application tests
T057 renderer selector tests
```

Settings model/usage T058 and UI T060 can proceed in parallel, followed by new-project construction T059 integration.

## Implementation Strategy

### MVP first

1. Complete Setup and Foundational phases.
2. Complete US1 to establish a saveable mixed Track timeline.
3. Stop and validate the US1 independent test before introducing Track instrument compilation.

### Full spec increment

1. Add US2 instrument ownership, compilation, assignment, and non-modal always-on-top editing.
2. Add US3 Track processing and one-channel routing.
3. Migrate historical Audio Layers directly to that final representation and remove legacy classes in US4.
4. Enable Track-first new projects in US5.
5. Complete scale, quickstart, package, repository, and final Spec Kit verification.

### Scope discipline

- Do not add InstrumentClip, linked Track instruments, multiple instruments, FX containers, launcher/session behavior, PatternLayer migration, or p1 editor hiding.
- Do not retain AudioLayer/AudioLayerGroup production models after US4.
- Do not require Java Blue to load canonical Track XML; do prove historical Java projects migrate without covered data loss.
- Reuse existing instrument editors, shared clipboard, Unified Library transfer service, bar renderers, and effect-window lifecycle patterns.
