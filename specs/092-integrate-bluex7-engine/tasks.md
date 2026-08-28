# Tasks: Modern BlueX7 Engine and Automation

**Input**: Design documents from `/specs/092-integrate-bluex7-engine/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Verification**: Serialization, CSD generation, native/client protocol, runtime routing, UI, multi-instance stress, and migration evidence are mandatory under the project constitution.

**Organization**: Shared source/provenance and catalog primitives are foundational. Subsequent phases map directly to the five user stories and retain independent acceptance criteria.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after the containing phase's stated prerequisites because it uses different files and has no dependency on another incomplete task.
- **[Story]**: Maps to a user story in `spec.md`.
- Every task names the exact implementation or verification path.

## Phase 1: Setup (Shared Source and Provenance)

**Purpose**: Promote only the reviewed precursor orchestra into this repository and establish reproducible, attributed source generation without importing other transient assets.

- [X] T001 Import `/Users/stevenyi/work/csound/dx7-emulation/bluex7.orc` byte-for-byte at SHA-256 `2523caebbae4d28cba134a14b3a9f59d6647ebfaf3728d3dfba87de0f4732dda` into `packages/blue-data/resources/blue-x7-modern/bluex7.orc`, and verify no ROM, demo, render, or unrelated precursor file is copied
- [X] T002 [P] Create `packages/blue-data/resources/blue-x7-modern/provenance.json`, `packages/blue-data/resources/blue-x7-modern/ATTRIBUTION.md`, and `packages/blue-data/resources/blue-x7-modern/LICENSES/Apache-2.0.txt` with the precursor commit/digests, Blue modification ownership, incorporated MSFA notices, and reference-only Dexed/legacy Blue/Pinkston credits
- [X] T003 Add the deterministic `.orc`-to-TypeScript bundler and `generate:blue-x7` package script in `packages/blue-data/scripts/generate-blue-x7-modern-orchestra.mjs` and `packages/blue-data/package.json`, producing `packages/blue-data/src/instruments/blue-x7/modern-orchestra.generated.ts` without accessing the transient checkout
- [X] T004 Add stale-output, provenance, baseline-digest, no-external-checkout, and no-ROM regression coverage in `packages/blue-data/src/instruments/blue-x7/modern-orchestra.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the one authoritative Parameter/mapping catalog, project owner catalog, compilation bindings, and compile-once resource seam used by every story.

**⚠️ CRITICAL**: Complete this phase before starting any user-story implementation.

- [X] T005 [P] Add failing cardinality, domain, grouping, stable-key, update-class, shared-sync/PMS, and non-finite-value tests for all 151 descriptors in `packages/blue-data/src/instruments/blue-x7/parameter-catalog.test.ts`
- [X] T006 Implement the immutable 151-entry descriptor catalog, exact integer quantization, voice read/write accessors, and shared-field policy in `packages/blue-data/src/instruments/blue-x7/parameter-catalog.ts`
- [X] T007 [P] Add failing 155-slot transport and six-bit mask tests covering operator reversal, algorithm minus one, detune plus seven, name bytes, and every descriptor in `packages/blue-data/src/instruments/blue-x7/voice-transport.test.ts`
- [X] T008 Implement the pure validated voice transport and operator-mask builder in `packages/blue-data/src/instruments/blue-x7/voice-transport.ts` using catalog accessors from T006
- [X] T009 [P] Add failing BlueX7 Parameter reconciliation tests for legacy XML, malformed/duplicate metadata, stable same-owner IDs, disjoint deep-copy IDs, mixed shared values, whole-voice fixed-value replacement, and unknown-node preservation in `packages/blue-data/src/instruments/blue-x7.test.ts`
- [X] T010 Add the BlueX7-owned `ParameterList`, `getParameters()`, catalog reconciliation, XML persistence, atomic voice/fixed-value mutation helpers, and deep-copy identity rules in `packages/blue-data/src/instruments/blue-x7.ts`
- [X] T011 [P] Add deterministic arrangement/Track/mixer enumeration and duplicate-name owner-identity tests in `packages/blue-data/src/automation/project-parameter-catalog.test.ts`
- [X] T012 Implement the owner-aware project Parameter catalog and preserve the existing arrangement+mixer compatibility facade in `packages/blue-data/src/automation/project-parameter-catalog.ts`, `packages/blue-data/src/automation/parameter-helper.ts`, and `packages/blue-data/src/index.ts`
- [X] T013 [P] Add disposable compiled BlueX7 binding tests for owner identity, Parameter-ID channel lookup, Track runtime IDs, distinct hold/commit controls, and rebuild invalidation in `packages/blue-data/src/compile-data.test.ts`
- [X] T014 Implement render-scoped `CompiledBlueX7Binding` registration and lookup without persisted/runtime-global state in `packages/blue-data/src/compile-data.ts`
- [X] T015 [P] Add compile-once global-orchestra tests for distinct BlueX7 objects, arrangement plus prepared Track instruments, and independent render contexts in `packages/blue-data/src/arrangement.test.ts`
- [X] T016 Pass `CompileData` through the global-orchestra instrument seam and deduplicate the BlueX7 module with a render-scoped compilation key in `packages/blue-data/src/instruments/instrument.ts` and `packages/blue-data/src/arrangement.ts`
- [X] T017 Add validated, serializable BlueX7 arrangement/Track owner targets and base runtime result types with malformed-target contract tests in `packages/blue-app/src/shared/project-editor/contract.ts` and `packages/blue-app/src/shared/blue-x7-runtime-contract.test.ts`

**Checkpoint**: The source is reproducible, `BlueX7` owns exactly 151 Parameters, every value has one transport mapping, project owners are deterministic, and a generated performance can register shared/per-instance resources without collisions.

---

## Phase 3: User Story 1 — Play Complete Voices Through the Modern Renderer (Priority: P1) 🎯 MVP

**Goal**: Replace the partial legacy orchestra with the complete modern renderer while preserving Blue pitch, gate, post-code, and output-routing contracts.

**Independent Test**: Generate and render representative voices through all 32 algorithms and confirm every stored sound field and operator mask reaches the modern renderer, the shared module occurs once, output remains finite/calibrated, and Blue p4/p5/p3/post/mixer semantics remain intact.

### Verification for User Story 1

- [X] T018 [P] [US1] Add failing generated-CSD assertions for one shared modern module, no legacy `dx701..dx732` body, and distinct per-instance transport allocations in `packages/blue-data/src/instruments/blue-x7/modern-orchestra.test.ts`
- [X] T019 [P] [US1] Add failing static BlueX7 CSD tests for complete field participation, p4-to-Hz-to-MIDI conversion, p5 velocity, `abs(p3)` gate/release, saved post code, mixer output, and no-mixer direct output in `packages/blue-data/src/instruments/blue-x7.test.ts` and `packages/blue-data/src/blue-data-csd-parity.test.ts`
- [X] T020 [P] [US1] Add deterministic Csound render tests for all 32 algorithms, corrected 6/20 carrier routing, zero-mask silence, release completion, finite samples, and accepted modern reference hashes in `packages/blue-data/src/instruments/blue-x7/modern-render.integration.test.ts`
- [X] T021 [P] [US1] Add preview/binding-report regressions that require every modern sound field and its active-note/next-note class and reject legacy dormant-field claims in `packages/blue-app/src/renderer/tests/blue-x7-csound-preview.test.tsx`

### Implementation for User Story 1

- [X] T022 [US1] Convert the imported baseline into the canonical Blue-maintained self-contained modern module, retaining the public voice boundary and applicable notices, in `packages/blue-data/resources/blue-x7-modern/bluex7.orc`
- [X] T023 [US1] Integrate `modern-orchestra.generated.ts`, the 155-value snapshot, operator mask, and compile-once global module into `packages/blue-data/src/instruments/blue-x7.ts`
- [X] T024 [US1] Generate one independent transport/table allocation and Blue host wrapper per arrangement or Track owner in `packages/blue-data/src/instruments/blue-x7.ts` and register its binding in `packages/blue-data/src/compile-data.ts`
- [X] T025 [US1] Preserve Blue pitch/velocity/gate conversion, release extension, `aout` post-processing position, mixer conversion, and direct-output fallback in `packages/blue-data/src/instruments/blue-x7.ts`
- [X] T026 [US1] Establish one corpus-wide output calibration factor and release-tail safety behavior in `packages/blue-data/resources/blue-x7-modern/bluex7.orc`, then lock the accepted values in `packages/blue-data/src/instruments/blue-x7/modern-render.integration.test.ts`
- [X] T027 [US1] Regenerate and verify the browser-safe orchestra artifact in `packages/blue-data/src/instruments/blue-x7/modern-orchestra.generated.ts` using `packages/blue-data/scripts/generate-blue-x7-modern-orchestra.mjs`
- [X] T028 [US1] Generate modern Csound preview text and binding diagnostics from the catalog/transport source in `packages/blue-data/src/instruments/blue-x7.ts` and render them in `packages/blue-app/src/renderer/components/instruments/blue-x7/csound-panel.tsx`
- [X] T029 [US1] Run the focused US1 suite named in `specs/092-integrate-bluex7-engine/quickstart.md` against `packages/blue-data/src/instruments/blue-x7*.test.ts`, `packages/blue-data/src/instruments/blue-x7/*.test.ts`, and `packages/blue-app/src/renderer/tests/blue-x7-csound-preview.test.tsx`

**Checkpoint**: Modern BlueX7 rendering is independently usable for project playback/render generation even before live editing and timeline automation are enabled.

---

## Phase 4: User Story 2 — Edit a Running BlueX7 in Real Time (Priority: P1)

**Goal**: Make fixed widget changes audible without recompilation, preserve explicit active-note/next-note semantics, commit whole voices atomically, and show engine-effective values without creating a second project owner.

**Independent Test**: Sustain notes, edit representative controls, automate one control, replace a whole voice, and verify sub-100 ms fixed updates, correct next-note capture, hold/commit atomicity, automation authority, 20 Hz effective readback, and safe stale-target failure.

### Verification for User Story 2

- [X] T030 [P] [US2] Add TypeScript golden-buffer and validation tests for batch get/set encoding, UTF-8 names, limits, duplicates, NULs, non-finite values, truncation, response order, and unchanged single-channel commands in `packages/blue-engine-client/tests/protocol.test.ts`
- [X] T031 [P] [US2] Add native all-or-error batch channel tests for validation-before-write, missing channels, exact f64 order, destroyed engines, and existing command compatibility in `native/blue-engine/tests/cpp/test_automation_protocol.cpp`
- [X] T032 [P] [US2] Add client/native capability-negotiation tests for supported and old-engine failure paths in `packages/blue-engine-client/tests/capabilities.test.ts` and `native/blue-engine/tests/cpp/test_engine_capabilities.cpp`
- [ ] T033 [P] [US2] Add live Csound regressions for active-note continuous/discrete updates, next-note algorithm/oscillator-sync/LFO-sync capture, mid-envelope edits, release-rate changes, and held complete-voice publication in `packages/blue-data/src/instruments/blue-x7/modern-live.integration.test.ts`
- [ ] T034 [P] [US2] Add fail-closed runtime tests for arrangement/Track resolution, ID/key mismatch, stale session/revision, automation authority, both playback sessions, hold-write-commit order, cleanup failure, and missing bindings in `packages/blue-app/src/main/blue-x7-runtime-sync.test.ts`
- [ ] T035 [P] [US2] Add preload/IPC validation tests for live intents and effective-value result unions in `packages/blue-app/src/preload/csound-runtime-api.test.ts` and `packages/blue-app/src/shared/blue-x7-runtime-contract.test.ts`
- [ ] T036 [P] [US2] Add renderer tests for next-note labels, stopped fixed values, automated effective values, late-response rejection, one in-flight visible-only request, and no readback project mutation in `packages/blue-app/src/renderer/tests/blue-x7-editor.test.tsx` and `packages/blue-app/src/renderer/browser/blue-x7-editor.browser.test.tsx`

### Implementation for User Story 2

- [X] T037 [US2] Add bounded batch channel command constants and binary encoders/decoders in `packages/blue-engine-client/src/protocol.ts`
- [X] T038 [US2] Expose queued `setChannels()`/`getChannels()` methods and capability guards in `packages/blue-engine-client/src/engine-client.ts` and `packages/blue-engine-client/src/capabilities.ts`
- [X] T039 [US2] Implement native batch command parsing, whole-payload validation, and ordered engine access in `native/blue-engine/src/protocol/Protocol.h`, `native/blue-engine/src/protocol/Capabilities.cpp`, `native/blue-engine/src/ipc/ZmqHandler.cpp`, and `native/blue-engine/src/engine/CsoundEngine.cpp`
- [X] T040 [US2] Expose session-aware batch get/set methods with unsupported-runtime diagnostics in `packages/blue-app/src/main/engine-bridge.ts` and `packages/blue-app/src/main/blue-live-engine.ts`
- [X] T041 [US2] Refactor the maintained orchestra to consume validated active-note Parameters at k-rate, capture the three next-note fields, smooth discontinuity-prone controls, update current/future envelope stages without replay, and maintain dynamic release safety in `packages/blue-data/resources/blue-x7-modern/bluex7.orc`
- [X] T042 [US2] Add per-instance hold/commit controls and double-buffered/staged complete-voice publication to `packages/blue-data/resources/blue-x7-modern/bluex7.orc` and emit their compiled binding names from `packages/blue-data/src/instruments/blue-x7.ts`
- [X] T043 [US2] Regenerate the live-capable source artifact in `packages/blue-data/src/instruments/blue-x7/modern-orchestra.generated.ts` and update its deterministic hash in `packages/blue-data/resources/blue-x7-modern/provenance.json`
- [X] T044 [US2] Implement owner/Parameter resolution, quantization, automation-authority checks, fixed deltas, complete snapshots, hold/commit cleanup, and batch readback in `packages/blue-app/src/main/blue-x7-runtime-sync.ts`
- [ ] T045 [US2] Route already-applied arrangement and Track BlueX7 patches, SysEx replacement, undo, and redo through runtime synchronization in `packages/blue-app/src/main/main.ts` without rolling back canonical `BlueData` on engine failure
- [ ] T046 [US2] Add validated live-update and effective-readback IPC/preload methods in `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/main/main.ts`
- [ ] T047 [US2] Implement visible-control 20 Hz polling, one-in-flight cancellation, session/owner late-result rejection, and disposable display state in `packages/blue-app/src/renderer/components/instruments/blue-x7/use-blue-x7-effective-values.ts`
- [ ] T048 [US2] Bind editor gestures and effective-value overlays to catalog metadata while keeping durable project patches authoritative in `packages/blue-app/src/renderer/components/instruments/blue-x7-editor.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/common-panel.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/lfo-panel.tsx`, and `packages/blue-app/src/renderer/components/instruments/blue-x7/operator-panel.tsx`

**Checkpoint**: One compiled arrangement or Track BlueX7 can be edited during playback/Blue Live, whole voices are atomic, and effective automation is visible without dirtying the project.

---

## Phase 5: User Story 3 — Automate BlueX7 on the Score Timeline (Priority: P1)

**Goal**: Expose all BlueX7 Parameters in owner-aware automation groups and keep live playback, Blue Live, disk render, export, seeks, and automation edits consistent for arrangement and Track instruments.

**Independent Test**: Assign representative parameters from every group to arrangement and Track automation layers, exercise edit/enable/disable/remove/seek/loop/nonzero-start flows, and compare engine-effective sequences with generated disk-render sequences within one k-period plus 50 ms.

### Verification for User Story 3

- [ ] T049 [P] [US3] Add snapshot/contract tests requiring all 151 targets, nested groups, stable owner IDs, Track association, and duplicate-name disambiguation in `packages/blue-app/src/shared/score-timeline-automation-contract.test.ts` and `packages/blue-app/src/shared/project-editor-blue-x7.test.ts`
- [ ] T050 [P] [US3] Add score runtime tests proving Track and arrangement Parameters resolve by ID and that edit/enable/disable/remove/clear operations remove stale engine automation in `packages/blue-app/src/main/score-automation-runtime-sync.test.ts`
- [ ] T051 [P] [US3] Add generated-CSD automation tests for integer/categorical quantization, fixed fallback, Track ownership, nonzero render start, and disk/live value-sequence equivalence in `packages/blue-data/src/blue-data-csd-automation.test.ts` and `packages/blue-data/src/score/track/track-automation.test.ts`
- [ ] T052 [P] [US3] Add chooser UI tests for Common/LFO/Pitch Envelope/Operator groups, same-name location labels, and finding any target within three interactions in `packages/blue-app/src/renderer/tests/score-timeline-automation-menu.test.tsx`
- [ ] T053 [P] [US3] Add live automation lifecycle tests for curve edits, disable/remove, seek, loop, pause/resume, engine rebuild, and automation-over-manual authority in `packages/blue-app/src/main/score-automation-runtime-sync.test.ts` and `packages/blue-app/src/main/runtime-parameter-sync.test.ts`
- [ ] T054 [P] [US3] Add real-time versus disk-render timing assertions with one-control-interval-plus-50-ms tolerance in `packages/blue-app/src/main/blue-x7-automation-equivalence.test.ts`

### Implementation for User Story 3

- [ ] T055 [US3] Build arrangement/Track BlueX7 automation snapshot groups from the authoritative project Parameter catalog in `packages/blue-app/src/shared/project-editor/snapshot-score.ts` and `packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts`
- [ ] T056 [US3] Route score automation patch lookup and engine synchronization through owner-aware Parameter entries in `packages/blue-app/src/main/score-automation-runtime-sync.ts` and `packages/blue-app/src/shared/project-editor/patch-score.ts`
- [ ] T057 [US3] Reconcile compiled Parameter names to canonical arrangement, Track, and mixer owners deterministically after compilation/rebuild in `packages/blue-app/src/main/runtime-parameter-sync.ts` and `packages/blue-app/src/main/engine-bridge.ts`
- [ ] T058 [US3] Render catalog-defined nested labels, update classes, and location disambiguators in `packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationTargetMenu.tsx`
- [ ] T059 [US3] Synchronize live automation create/update/enable/disable/delete/clear operations and restore fixed values without stale ownership in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/engine-bridge.ts`
- [ ] T060 [US3] Align seek, loop, pause/resume, nonzero render start, Blue Live, and disk-render Parameter timing through `packages/blue-data/src/automation/csd-parameter-automation.ts`, `packages/blue-data/src/blue-data/csd-policy.ts`, and `packages/blue-app/src/main/engine-bridge.ts`

**Checkpoint**: Every BlueX7 control is an owner-aware automation target and produces equivalent effective sequences across supported render/playback modes.

---

## Phase 6: User Story 4 — Use Multiple Independent BlueX7 Instruments (Priority: P1)

**Goal**: Prove that any number of same-named arrangement and Track instruments retain independent persistent IDs, compiled bindings, editors, live edits, automation, notes, and engine lifecycles.

**Independent Test**: Run two arrangement and two Track instruments with identical names but different voices/automation for 60 seconds at 32 notes while issuing 600 targeted changes; observe zero cross-instance values, stuck notes, non-finite samples, or stale writes through save/reopen, copy, removal, replacement, reorder, and rebuild.

### Verification for User Story 4

- [ ] T061 [US4] Create a deterministic four-owner fixture with two arrangement and two Track BlueX7 instruments, duplicate display names, distinct voices/masks/automation, and synthetic notes in `packages/blue-app/src/shared/blue-x7-multi-instance-test-utils.ts`
- [ ] T062 [P] [US4] Add compile isolation tests for one shared module, four disjoint Parameter/channel/transport bindings, Track runtime IDs, reorder, removal, and engine rebuild in `packages/blue-data/src/blue-data-csd-determinism.test.ts` and `packages/blue-data/src/compile-data.test.ts`
- [ ] T063 [P] [US4] Add runtime isolation tests that issue 600 owner-targeted fixed/automated changes and assert no cross-owner channel writes or readback in `packages/blue-app/src/main/blue-x7-runtime-sync.test.ts`
- [ ] T064 [P] [US4] Add save/reopen, deep-copy, paste, library instantiation, and Track assignment tests proving stable same-owner IDs and disjoint new-owner IDs in `packages/blue-data/src/instruments/blue-x7.test.ts` and `packages/blue-app/src/main/unified-library/project-transfer.test.ts`
- [ ] T065 [P] [US4] Add two-open-editor rapid-edit tests for patch order, local undo, visible-value isolation, duplicate labels, and popout hosting in `packages/blue-app/src/renderer/browser/blue-x7-editor.browser.test.tsx` and `packages/blue-app/src/renderer/tests/blue-x7-hosts.test.tsx`

### Implementation for User Story 4

- [ ] T066 [US4] Make compiled binding lookup and invalidation explicitly owner-scoped across delete, disable, reorder, replacement, stop, and rebuild in `packages/blue-app/src/main/blue-x7-runtime-sync.ts` and `packages/blue-app/src/main/engine-bridge.ts`
- [ ] T067 [US4] Add an automated 32-note/60-second/four-owner stress harness with latency, finite-output, stuck-note, and engine-error assertions in `packages/blue-app/src/main/blue-x7-multi-instance.integration.test.ts`
- [ ] T068 [US4] Ensure project and Track editor targets carry stable owner references through snapshots, patches, undo history, and popout sessions in `packages/blue-app/src/shared/project-editor/identity.ts`, `packages/blue-app/src/shared/project-editor/snapshot-score.ts`, and `packages/blue-app/src/renderer/components/instruments/blue-x7/use-blue-x7-history.ts`
- [ ] T069 [US4] Run the four-instance scenario and record deterministic command/results in `specs/092-integrate-bluex7-engine/validation.md`, including the 95th-percentile 100-ms edit target and zero-leak acceptance counts

**Checkpoint**: Four same-named owners satisfy the validated concurrency floor, and routing correctness depends only on owner/Parameter identity.

---

## Phase 7: User Story 5 — Migrate Existing Projects Deliberately and Safely (Priority: P2)

**Goal**: Load legacy Java/TypeScript BlueX7 data without loss, add stable Parameter metadata, preserve automation across whole-voice operations, and document the intentional modern sonic migration.

**Independent Test**: Load Java and boundary/unknown fixtures without Parameter metadata, save/reopen them, import and undo/redo whole voices during playback, and verify all voice/unknown data, IDs, curves, assignments, and atomic runtime snapshots while documenting intentional sound differences.

### Verification for User Story 5

- [ ] T070 [P] [US5] Add legacy Java-default and boundary/unknown XML migration fixtures with exact known-field, unknown-node, mixed-shared-field, first-save-ID, and reopen assertions in `packages/blue-data/src/instruments/blue-x7/test-fixtures/` and `packages/blue-data/src/instruments/blue-x7.test.ts`
- [ ] T071 [P] [US5] Add SysEx/whole-voice import, cancellation, failure, undo, and redo tests proving retained Parameter IDs/curves/assignments and old-or-new-only runtime observation in `packages/blue-app/src/main/blue-x7-sysex-import.test.ts` and `packages/blue-app/src/shared/project-editor-blue-x7.test.ts`
- [ ] T072 [P] [US5] Add library/copy/Track migration tests covering eligible automation content, regenerated IDs at new ownership boundaries, and no source references in `packages/blue-app/src/main/unified-library/project-transfer.test.ts` and `packages/blue-app/src/shared/project-editor-track-migration.test.ts`
- [ ] T073 [P] [US5] Add Csound preview migration tests proving the modern module, active/next-note binding report, and absence of legacy stored-only claims after reopen in `packages/blue-app/src/renderer/tests/blue-x7-csound-preview.test.tsx`

### Implementation for User Story 5

- [ ] T074 [US5] Apply complete voice plus fixed-Parameter replacement as one canonical project mutation while retaining automation metadata in `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`, `packages/blue-app/src/shared/project-editor/patch-score.ts`, and `packages/blue-data/src/instruments/blue-x7.ts`
- [ ] T075 [US5] Preserve additive `parameterList` XML, established Java voice ordering/defaults, and unknown content across load/save/reopen in `packages/blue-data/src/instruments/blue-x7.ts` using the existing `Element`/`Elements` utilities
- [ ] T076 [US5] Ensure SysEx replacement emits one durable patch and one owner-scoped complete runtime snapshot, with cancellation/failure changing neither project nor engine, in `packages/blue-app/src/main/blue-x7-sysex-import.ts` and `packages/blue-app/src/main/main.ts`
- [ ] T077 [US5] Document the modern-renderer migration, legacy Java Parameter-metadata limitation, calibration, algorithms 6/20 corrections, and accepted LFO/sync/AMS/PCM differences in `docs/blue-x7-modern-renderer.md`

**Checkpoint**: Existing project voice data remains lossless, new metadata stabilizes after first save, whole-voice operations retain automation, and intentional sonic differences are explicit.

---

## Phase 8: Polish & Cross-Cutting Verification

**Purpose**: Close repository-wide portability, UI, attribution, performance, and handoff obligations after the desired stories are complete.

- [ ] T078 [P] Add a repository-contained-source audit that rejects `dx7-emulation` path references, ROM/demo/render assets, stale generated output, or missing attribution/license files in `packages/blue-data/src/instruments/blue-x7/modern-orchestra.test.ts`
- [ ] T079 [P] Add native-path and synthetic Windows-path coverage for bundler arguments without converting host filesystem paths globally in `packages/blue-data/scripts/generate-blue-x7-modern-orchestra.test.mjs`
- [ ] T080 [P] Run and fix BlueX7 accessibility, typography-role, and host-window popup regressions in `packages/blue-app/src/renderer/tests/blue-x7-a11y-layout.test.tsx`, `packages/blue-app/src/renderer/tests/blue-x7-hosts.test.tsx`, and `packages/blue-app/src/renderer/tests/blue-x7-csound-preview.test.tsx`
- [ ] T081 [P] Finalize attribution, source-role classification, modification notices, and current hashes in `packages/blue-data/resources/blue-x7-modern/ATTRIBUTION.md`, `packages/blue-data/resources/blue-x7-modern/provenance.json`, and `packages/blue-data/resources/blue-x7-modern/LICENSES/`
- [ ] T082 Run the latency, 20-Hz readback, automation-tolerance, atomic-100-operation, all-algorithm, and four-instance stress checks from `specs/092-integrate-bluex7-engine/quickstart.md` and record results in `specs/092-integrate-bluex7-engine/validation.md`
- [ ] T083 Run affected builds and suites from `/Users/stevenyi/work/blue-electron/package.json`: `pnpm --filter @blue/data test`, `pnpm --filter @blue/engine-client test`, `ctest --test-dir native/blue-engine/build-darwin-arm64-release --output-on-failure`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`, and `pnpm --filter @blue/app build:preload`; record scoped failures in `specs/092-integrate-bluex7-engine/validation.md`
- [ ] T084 Run repository-wide `pnpm test`, `pnpm lint`, and `git diff --check` from `/Users/stevenyi/work/blue-electron/package.json` and record results or approved scoped exceptions in `specs/092-integrate-bluex7-engine/validation.md`
- [ ] T085 Review `packages/blue-data/src/`, `packages/blue-app/src/`, `packages/blue-engine-client/src/`, and `native/blue-engine/src/` against `AGENTS.md`, `docs/modularization.md`, `.specify/memory/constitution.md`, `specs/092-integrate-bluex7-engine/spec.md`, and `specs/092-integrate-bluex7-engine/plan.md`, then resolve unexplained boundary, compatibility, or verification violations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately. T003 depends on T001; T004 depends on T002–T003.
- **Foundational (Phase 2)**: Depends on Setup. Tests T005, T007, T009, T011, T013, T015, and T017 can be authored in parallel. T006 precedes T008/T010; T012 precedes owner-aware runtime consumers; T014/T016 establish compiled binding/module seams.
- **US1 (Phase 3)**: Depends on all foundational tasks. It is the static-rendering MVP.
- **US2 (Phase 4)**: Depends on US1's maintained orchestra and compiled bindings; protocol tests T030–T032 and UI/runtime tests T033–T036 can be authored in parallel.
- **US3 (Phase 5)**: Depends on foundational Parameter ownership and US2 engine/runtime transport. Verification tasks T049–T054 can be authored in parallel.
- **US4 (Phase 6)**: Depends on US2 and US3 so it can stress both fixed and automated routing. T061 precedes fixture consumers T062–T065/T067.
- **US5 (Phase 7)**: Depends on foundational persistence and US2 atomic runtime transport. Its fixture/test work can overlap US3, but final acceptance uses US1–US4 behavior.
- **Polish (Phase 8)**: Depends on every story selected for delivery.

### User Story Completion Order

```text
Setup -> Foundation -> US1 (modern static renderer)
                         |
                         v
                       US2 (live control/readback)
                         |
                         v
                       US3 (timeline automation)
                         |
                         v
                       US4 (four-owner stress)

Foundation + US1 + US2 --------> US5 (migration/atomic replacement)

All selected stories ----------> Polish and full validation
```

### Within Each User Story

- Add the constitution-required failing regression/contract tests before changing the corresponding behavior when the harness supports it.
- Complete portable model/Csound source work before Electron main/preload/renderer integration.
- Complete versioned client/native protocol work before main process consumers.
- Keep `BlueData` mutations in typed project patches; treat engine bindings/readback as disposable session state.
- Validate each story at its checkpoint before starting dependent work.

## Parallel Opportunities

- Setup attribution T002 can proceed while the exact orchestra import T001 is verified.
- Foundational test tasks T005, T007, T009, T011, T013, T015, and T017 target separate files and can proceed together.
- US1 verification T018–T021 can proceed in parallel before renderer integration.
- US2 client, native, live-Csound, main-runtime, preload, and renderer test tasks T030–T036 are independent verification seams.
- US3 snapshot, runtime, CSD, UI, lifecycle, and timing tests T049–T054 are independent seams.
- After T061, US4 compile, runtime, identity, and editor tests T062–T065 can proceed together.
- US5 XML, SysEx, ownership, and preview tests T070–T073 can proceed together.
- Polish audits T078–T081 touch different paths and can proceed together.

## Parallel Example: User Story 1

```text
Task T018: Generated-CSD shared-module/transport tests
Task T019: Blue host-boundary CSD tests
Task T020: All-algorithm render tests
Task T021: Preview/binding-report tests
```

## Parallel Example: User Story 2

```text
Task T030: TypeScript binary protocol tests
Task T031: Native engine protocol tests
Task T033: Live Csound semantic tests
Task T034: Main runtime routing tests
Task T035: IPC/preload contract tests
Task T036: Renderer effective-value tests
```

## Parallel Example: User Story 3

```text
Task T049: Automation snapshot/owner tests
Task T050: Score runtime Track lookup tests
Task T051: Generated CSD automation tests
Task T052: Automation chooser interaction tests
Task T053: Live lifecycle tests
Task T054: Live/static timing tests
```

## Parallel Example: User Story 4

```text
After T061 creates the fixture:
Task T062: Compile isolation
Task T063: Runtime write/readback isolation
Task T064: Save/copy/library identity isolation
Task T065: Two-editor/browser isolation
```

## Parallel Example: User Story 5

```text
Task T070: Legacy XML migration fixtures
Task T071: SysEx/undo/redo atomicity
Task T072: Copy/library/Track identity migration
Task T073: Preview/binding migration
```

## Implementation Strategy

### MVP First: User Story 1

1. Complete Setup and Foundational phases.
2. Complete US1 through T029.
3. Stop and validate modern static rendering independently.
4. Demonstrate complete voice coverage, all algorithms, one shared module, and preserved Blue host semantics before adding live state.

### Incremental Delivery

1. **US1**: Modern static renderer and complete voice mapping.
2. **US2**: Live fixed controls, atomic voice commits, and effective readback.
3. **US3**: Arrangement/Track timeline automation across live and rendered modes.
4. **US4**: Four-owner concurrency and lifecycle hardening.
5. **US5**: Legacy migration and product documentation, using the already-proven atomic path.
6. **Polish**: Attribution, portability, stress evidence, full tests, lint, builds, and constitutional review.

### Stop/Review Points

- After T004: confirm only the authorized precursor `.orc` was imported.
- After T017: confirm the 151-entry catalog and owner/binding contracts before DSP integration.
- After T029: audition/approve modern static output and calibration.
- After T048: verify active/next-note semantics and effective-value UX.
- After T060: compare live and disk automation sequences.
- After T069: approve multi-instance stress evidence.
- After T077: review migration documentation and Java compatibility statement.
- After T085: implementation is ready for handoff.

## Notes

- `[P]` tasks modify distinct files after their phase prerequisites are satisfied.
- Story labels map directly to `spec.md` user stories.
- Do not import the precursor ROM, demos, renders, or generator tree.
- Do not route by display name, list position, or cached instrument number.
- Do not let effective-value readback mutate `BlueData`, fixed values, automation curves, or undo history.
- Commit after each task or coherent task group if the Git hook is selected.
