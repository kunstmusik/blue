---
description: "Task list for explicit XML compatibility and migration contracts"
---

# Tasks: Explicit XML Compatibility and Migration Contracts

**Input**: Design documents from `specs/116-xml-compatibility-contracts/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and the
family evidence matrices

**Verification**: Cover current and historical serialization, migration composition, nested
contracts and diagnostics, standalone resource loading, host publication, library transactions,
runtime availability, copy ownership, ProjectHistory restoration, quickstart scenarios, and the
license/provenance obligations recorded in the design.

**Organization**: Tasks are grouped by user story. All four stories are P1; US1 is the smallest
project-opening MVP slice.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Freeze original synthetic fixture provenance before implementation work begins.

- [X] T001 Create `specs/116-xml-compatibility-contracts/fixtures/manifest.md` with stable case IDs from `project-evidence.md`, `resource-evidence.md`, and `sound-library-evidence.md`; record each fixture's original author/origin, source revision and support decision, root, migration owner, expected canonical state/output, and standalone/embedded applicability. Use only original synthetic XML and record the destination-scope check against `LICENSING.md` and the affected package notices.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Preserve XML evidence and provide shared, host-neutral validation and diagnostic primitives.

- [X] T002 [P] Add regression cases in `packages/blue-data/src/serialization/xml-reader.test.ts` and `packages/blue-data/src/utilities/xml.test.ts` for ordered text/CDATA preservation, significant whitespace, mixed-content evidence, independent element cloning, complete-token numeric parsing, and invalid present values.
- [X] T003 Repair text/CDATA parsing and direct structural cloning in `packages/blue-data/src/serialization/xml-reader.ts`; retain enough mixed-content evidence for owning validators to reject it before parsing loses it.
- [X] T004 [P] Add focused operation-context and report tests in the new `packages/blue-data/src/serialization/xml-load.test.ts` for deterministic indexed paths, source labels, warning/error results, and rejected results without partial values.
- [X] T005 Implement serializable load diagnostics, accepted/rejected result types, operation-scoped source/path context, nested context derivation, and strict error conversion in the new `packages/blue-data/src/serialization/xml-load.ts`; export the public types from `packages/blue-data/src/index.ts`.
- [X] T006 Implement checked XML scalar and shape conversions in `packages/blue-data/src/utilities/xml.ts` for full-token finite numbers, exact integral bounds, booleans, enums, duplicate/cardinality checks, and container/scalar text rules; preserve the existing exact-decimal behavior and make the tests from T002 pass.

**Checkpoint**: Shared XML evidence, validation primitives, and reports are ready for project and resource owners.

---

## Phase 3: User Story 1 - Open and Save Supported Projects Reliably (Priority: P1)

**Goal**: Load current and evidenced historical projects into complete canonical candidates, preserve supported content through save/reopen, and reject unsupported input before it can replace active work.

**Independent Test**: Use the current and historical project cases in `fixtures/manifest.md`; verify canonical state and save/reopen output, composed migration idempotence, source-file immutability, and actionable rejection for root/nested unexpected members and malformed known values.

### Verification for User Story 1

- [X] T007 [US1] Add current-project, unknown-root/member, invalid-value, alias-conflict, and `P-210-230-COMPOSE` / `P-ROOT-CONTEXT-ORDER` regression cases in `packages/blue-data/src/blue-data/xml-policy.test.ts` and the new `packages/blue-data/src/migration/project-xml-compatibility.test.ts`; assert independent expected state and canonical second-pass stability.

### Implementation for User Story 1

- [X] T008 [US1] Implement `readProjectXml(xml, source)` as an all-or-nothing candidate report in `packages/blue-data/src/blue-data/xml-policy.ts`; make `BlueData.loadFromString` in `packages/blue-data/src/blue-data.ts` a strict wrapper over the same checks and expose the report API from `packages/blue-data/src/index.ts`.
- [X] T009 [US1] Make project upgrades run in documented order without success-boolean short-circuiting in `packages/blue-data/src/migration/upgrade-manager.ts` and `packages/blue-data/src/migration/upgrades/upgrade-2.3.0.ts`; extract old PolyObject timing into TimeState, and implement the shape-selected context/tempo and old instrument-reference migrations in `packages/blue-data/src/migration/migrate-project-time-context.ts` before model construction. Reject conflicting or unaccounted meaningful old content.
- [X] T010 [P] [US1] Apply explicit current-member, value, default, and text contracts to project properties and section owners in `packages/blue-data/src/project-properties.ts`, `packages/blue-data/src/global-orc-sco.ts`, `packages/blue-data/src/tables.ts`, `packages/blue-data/src/score/score.ts`, and `packages/blue-data/src/blue-data/xml-policy.ts`; keep root validation and nested-owner validation separate.
- [X] T011 [P] [US1] Apply the timing contracts and historical conversions to `packages/blue-data/src/time/time-state.ts`, `packages/blue-data/src/time/time-context.ts`, `packages/blue-data/src/time/time-position.ts`, `packages/blue-data/src/time/time-duration.ts`, `packages/blue-data/src/time/tempo-map.ts`, `packages/blue-data/src/time/tempo-point.ts`, and `packages/blue-data/src/time/meter-map.ts`; add/extend focused assertions in `packages/blue-data/src/time/time-state.test.ts`, `packages/blue-data/src/time/time-context.test.ts`, and `packages/blue-data/src/time/time-duration.test.ts`.
- [X] T012 [P] [US1] Validate project marker, Live, MIDI, and plugin state under explicit owner contracts in `packages/blue-data/src/markers-list.ts`, `packages/blue-data/src/live-data.ts`, `packages/blue-data/src/live/live-object.ts`, `packages/blue-data/src/live/live-object-set.ts`, `packages/blue-data/src/live/live-object-set-list.ts`, `packages/blue-data/src/midi/midi-input-processor.ts`, and `packages/blue-data/src/plugins/clojure-project-data.ts`; preserve known unresolved IDs and unavailable-runtime metadata only under the named warning rules in `contracts/xml-loading.md`.

**Checkpoint**: User Story 1 accepts supported current/historical projects, rejects uncontracted data, and saves the specified current forms.

---

## Phase 4: User Story 2 - Reuse Historical Instruments and Effects Independently (Priority: P1)

**Goal**: Give independently serialized instruments, effects, SoundObjects, UDOs, presets, and nested resource owners the same documented local compatibility behavior used inside projects.

**Independent Test**: Load each supported current/historical resource directly and embedded, compare typed state and diagnostics, export/reimport it, and verify that resource compatibility needs neither a BlueData envelope nor a project version.

### Verification for User Story 2

- [X] T013 [US2] Add resource-owner regression cases for `R-H01`–`R-H10` and `SL-H01`–`SL-H11` in `packages/blue-data/src/instruments/blue-synth-builder.test.ts`, `packages/blue-data/src/instruments/blue-x7.test.ts`, `packages/blue-data/src/mixer/mixer.test.ts`, `packages/blue-data/src/automation/parameter.test.ts`, `packages/blue-data/src/sound-objects/sound.test.ts`, `packages/blue-data/src/sound-objects/line-object.test.ts`, and `packages/blue-data/src/note-processors/processor-serialization-parity.test.ts`; include standalone roots, embedded equivalence, nested unknown members, invalid values, duplicate/conflicting aliases, and canonical output.
- [X] T014 [US2] Add `readResourceXml(kind, xml, source)` coverage in the new `packages/blue-data/src/resource-xml-policy.test.ts` for instrument/effect/SoundObject/UDO/preset dispatch, root-kind mismatch, rejected results without partial values, and identical owner normalization through direct and embedded paths.

### Implementation for User Story 2

- [X] T015 [US2] Implement the shared standalone resource report boundary in the new `packages/blue-data/src/resource-xml-policy.ts`; dispatch exact supported roots and kinds, apply class-local normalization and canonical validation, and export it from `packages/blue-data/src/index.ts` without invoking project migrations.
- [X] T016 [P] [US2] Enforce exact instrument type/member contracts and remove typed acceptance of unknown placeholders in `packages/blue-data/src/instruments/instrument-registry.ts`, `packages/blue-data/src/instruments/unknown-instrument.ts`, `packages/blue-data/src/instruments/generic-instrument.ts`, `packages/blue-data/src/instruments/javascript-instrument.ts`, and `packages/blue-data/src/instruments/python-instrument.ts`; keep runtime availability separate from XML acceptance.
- [X] T017 [P] [US2] Validate BlueSynthBuilder, BlueX7, and every nested widget, grid/interface, and preset owner enumerated in `specs/116-xml-compatibility-contracts/resource-evidence.md`, including `packages/blue-data/src/instruments/blue-synth-builder.ts`, `packages/blue-data/src/instruments/blue-x7.ts`, `packages/blue-data/src/instruments/blue-synth-builder/bsb-graphic-interface.ts`, `packages/blue-data/src/instruments/blue-synth-builder/bsb-widget.ts`, `packages/blue-data/src/instruments/blue-synth-builder/preset.ts`, and `packages/blue-data/src/instruments/blue-synth-builder/preset-group.ts`; accept only listed aliases/defaults and reject arbitrary retained XML.
- [X] T018 [P] [US2] Apply the shared Line, Parameter, resolution, relative-point, and declared-map rules in `packages/blue-data/src/automation/parameter.ts`, `packages/blue-data/src/automation/parameter-list.ts`, `packages/blue-data/src/automation/parameter-id-list.ts`, `packages/blue-data/src/sound-objects/line-object.ts`, `packages/blue-data/src/sound-objects/zak-line-object.ts`, and `packages/blue-data/src/instruments/blue-synth-builder/bsb-line-object.ts`; implement the documented `bdresolution` precedence and reject malformed competing forms.
- [X] T019 [P] [US2] Validate Mixer, ChannelList, Channel, and Effect members, historical wrappers, style defaults, and effect-chain bins in `packages/blue-data/src/mixer/mixer.ts`, `packages/blue-data/src/mixer/channel-list.ts`, `packages/blue-data/src/mixer/channel.ts`, and `packages/blue-data/src/mixer/effect.ts`; preserve current output and reject ambiguous old/current representations.
- [X] T020 [P] [US2] Validate UDO roots, style/signature fields, and nested opcode definitions in `packages/blue-data/src/opcodes/udo-style.ts`, `packages/blue-data/src/opcodes/udo-type-utils.ts`, `packages/blue-data/src/opcodes/opcode-list.ts`, and `packages/blue-data/src/opcodes/opcode-definition.ts`; reject unknown polymorphic types and invalid present values.
- [X] T021 [US2] Normalize common SoundObject aliases and the supported development-era time forms at the shared class boundary in `packages/blue-data/src/sound-objects/abstract-sound-object.ts` and `packages/blue-data/src/sound-objects/sound-object-utilities.ts`; apply the same implementation to standalone and embedded roots, emit current `startTime`/`subjectiveDuration` forms, and reject known unsupported MeasureBeatsTime/SMPTEValue forms with contextual diagnostics.
- [X] T022 [US2] Validate every concrete SoundObject, layer, audio clip, pattern, tracker, and PianoRoll owner enumerated in `specs/116-xml-compatibility-contracts/sound-library-evidence.md`, including `packages/blue-data/src/sound-objects/sound-object-registry.ts`, `packages/blue-data/src/sound-objects/sound-layer.ts`, `packages/blue-data/src/sound-objects/audio-file.ts`, `packages/blue-data/src/sound-objects/pattern-object.ts`, `packages/blue-data/src/sound-objects/tracker-object.ts`, and `packages/blue-data/src/sound-objects/piano-roll.ts`; cover dormant nested state, exact map shapes, historical aliases, and canonical writer output.
- [X] T023 [P] [US2] Validate note-processor chains/maps, JMask nested owners, exact signed-64 seeds, and complete tuning-scale or external-path dependencies in `packages/blue-data/src/note-processors/note-processor-chain.ts`, `packages/blue-data/src/note-processors/note-processor-chain-map.ts`, `packages/blue-data/src/note-processors/random-add-processor.ts`, `packages/blue-data/src/note-processors/random-multiply-processor.ts`, `packages/blue-data/src/sound-objects/j-mask.ts`, `packages/blue-data/src/sound-objects/jmask-support.ts`, and `packages/blue-data/src/sound-objects/piano-roll/scale.ts`; preserve exact seed digits and reject unresolved malformed/unknown content without default substitution.
- [X] T024 [US2] Run the focused resource verification commands from `specs/116-xml-compatibility-contracts/quickstart.md` for `@blue/data` instruments, mixer, automation, opcodes, SoundObjects, score, note processors, and libraries; record failures against their owner cases before proceeding to host publication.

**Checkpoint**: User Story 2 loads and writes supported independent resources under the same local contract as embedded resources.

---

## Phase 5: User Story 3 - Receive Clear Outcomes for Unexpected Data (Priority: P1)

**Goal**: Surface actionable errors and named warnings, keep rejected project/resource candidates inert, and preserve the existing diagnosed unsupported-library archive without allowing it into typed editing or insertion.

**Independent Test**: Reject a nested unknown member while a project is dirty and confirm active identity, history, runtime, source file, and library destination are unchanged; confirm report paths and recovery details reach the UI/CLI, and a valid unsupported library leaf exports byte-for-byte but cannot be edited or inserted.

### Verification for User Story 3

- [X] T025 [P] [US3] Add replacement-flow regressions in `packages/blue-app/src/main/project-replacement-flow.test.ts` and `packages/blue-app/src/main/project-replacement-entry-points.test.ts` proving rejection precedes save/replacement prompts and on-load scripts, while active project identity/path/revision/dirty/history/runtime state remains unchanged.
- [X] T026 [P] [US3] Add envelope, full nested classifier, archive, and transaction regressions in `packages/blue-data/src/libraries/legacy-library-codec.test.ts`, `packages/blue-data/src/libraries/raw-xml-document.test.ts`, `packages/blue-app/src/main/unified-library/library-transfer-service.test.ts`, and `packages/blue-app/src/main/unified-library/project-adapter.test.ts`; verify exact raw export, non-insertability, per-source rollback, and revalidation of stored supported rows.
- [X] T027 [P] [US3] Add CLI boundary regressions in `packages/blue-cli/src/cli.test.ts` for rejected XML diagnostics on stderr before runtime initialization/output writes and for accepted warning reports before canonical compilation.

### Implementation for User Story 3

- [X] T028 [US3] Wire project report preparation through `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/project-replacement-flow.ts` for open/recent/example/revert/package verification; show warnings before activation and pass only complete accepted candidates to the existing project lifecycle.
- [X] T029 [US3] Add plain serializable diagnostic report fields to the existing preload and library boundaries in `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/shared/unified-library.ts`; keep Error and Element instances inside the owning process and preserve source, path, member/value, severity, message, and recovery across IPC.
- [X] T030 [US3] Surface contextual project and library diagnostics through existing renderer flows in `packages/blue-app/src/renderer/stores/library-store.ts`, `packages/blue-app/src/renderer/stores/library-editor-store.ts`, and `packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts`; include a synthetic Windows source label test and pass native path text through unchanged.
- [X] T031 [US3] Replace sentinel-only library support classification with full recursive resource acceptance in `packages/blue-data/src/libraries/library-payload-adapters.ts`; validate envelope/category grammar and use `packages/blue-data/src/libraries/legacy-library-codec.ts` source spans for a separate diagnosed archive result that cannot hydrate typed editors or project resources.
- [X] T032 [US3] Preserve existing import/export transaction and revision fences while integrating reports in `packages/blue-app/src/main/unified-library/import-export-service.ts`, `packages/blue-app/src/main/unified-library/editor-adapters.ts`, and `packages/blue-app/src/main/unified-library/project-adapter.ts`; reject before destination publication, report partial multi-source outcomes, and require full reacceptance before archive promotion.
- [X] T033 [US3] Make `packages/blue-cli/src/cli.ts` use the shared project report API, write contextual warnings/errors to stderr, and stop rejected candidates before runtime setup, compilation output creation, or file writes.

**Checkpoint**: User Story 3 reports rejection and recovery clearly while protecting active projects, library transactions, source files, and execution side effects.

---

## Phase 6: User Story 4 - Preserve Accepted State Through Editing, Copies, and History (Priority: P1)

**Goal**: Keep accepted mutable data independently owned across loader input, serialization output, copies, durable edits, and ProjectHistory undo/redo.

**Independent Test**: Mutate source XML inputs, exported Elements, copied models, and history mementos; confirm canonical state is unchanged. Commit one supported project edit and one resource insertion, then verify undo/redo restores content, ordering, identities/references, dirty state, and required runtime reconciliation.

### Verification for User Story 4

- [X] T034 [P] [US4] Add input/output/copy mutation regressions in `packages/blue-data/src/serialization/xml-reader.test.ts`, `packages/blue-data/src/markers-list.test.ts`, `packages/blue-data/src/blue-data-deep-copy.test.ts`, and `packages/blue-data/src/instruments/blue-synth-builder/blue-synth-builder-clone-safety.test.ts` for markers and retained resource/plugin payloads.
- [X] T035 [P] [US4] Add durable mutation commit→undo→redo cases in `packages/blue-app/src/shared/project-history.test.ts` and `packages/blue-app/src/main/project-history-writer-audit.test.ts` for accepted project edits and resource insertion, including semantic labels, stable identities/references, dirty state, and runtime reconciliation.

### Implementation for User Story 4

- [X] T036 [US4] Remove mutable XML aliases from marker and retained plugin/resource payload owners in `packages/blue-data/src/markers-list.ts`, `packages/blue-data/src/blue-data.ts`, and `packages/blue-data/src/plugins/clojure-project-data.ts`; clone input/output trees independently and keep explicitly supported payloads under their named contracts.
- [X] T037 [US4] Make project and resource serialization pure and canonical in `packages/blue-data/src/blue-data/xml-policy.ts`, `packages/blue-data/src/sound-objects/pattern-object.ts`, `packages/blue-data/src/sound-objects/piano-roll.ts`, `packages/blue-data/src/instruments/blue-synth-builder.ts`, and `packages/blue-data/src/libraries/library-payload-adapters.ts`; avoid model mutation, duplicate placeholders, stale retained XML, and mutable output aliases.
- [X] T038 [US4] Route any durable acceptance/import mutation changed by this feature through the existing labeled ProjectHistory path in `packages/blue-app/src/shared/project-editor.ts`, `packages/blue-app/src/shared/project-history.ts`, and `packages/blue-app/src/main/unified-library/project-adapter.ts`; preserve baseline-on-load behavior, identity remapping rules, dirty-state transitions, and runtime reconciliation.
- [X] T039 [US4] Preserve history-copy identity/reference semantics and user-duplication rekeying in `packages/blue-data/src/blue-data-deep-copy.test.ts`, `packages/blue-data/src/instruments/instrument-portable-copy.test.ts`, `packages/blue-data/src/instruments/blue-synth-builder/bsb-identity.test.ts`, and `packages/blue-data/src/sound-objects/piano-roll.ts`; ensure copied PianoRoll fields relink to copied definitions.
- [X] T040 [US4] Run the focused copy, serialization, project-history, and application history commands in `specs/116-xml-compatibility-contracts/quickstart.md`; record canonical state, ownership, identity, dirty-state, and runtime-reconciliation results for the fixture cases.

**Checkpoint**: User Story 4 preserves independent ownership and restores accepted project state through canonical history.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Keep the executable verification guide aligned with implementation and complete repository validation.

- [X] T041 Update `specs/116-xml-compatibility-contracts/quickstart.md` with the final fixture-manifest IDs, changed owner suites, manual desktop observations, and any scoped automation limitation; preserve the original synthetic fixture and license provenance requirements.
- [X] T042 Run affected package tests/builds and repository checks from the repository root: `pnpm --filter @blue/data test`, `pnpm --filter @blue/data build`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/app build:preload`, `pnpm --filter @blue/app build:renderer`, `pnpm --filter blue-cli test`, `pnpm test`, `pnpm lint`, and `git diff --check`; record actual results and scoped pre-existing failures in `specs/116-xml-compatibility-contracts/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 freezes original fixture IDs and provenance.
- **Foundational (Phase 2)**: T002–T006 depend on the fixture scope in T001; all user stories depend on the shared parser evidence, scalar checks, and diagnostic context from T002–T006.
- **User Stories (Phases 3–6)**: US1 and US2 can proceed independently after Phase 2. US3 requires the project/resource report boundaries from US1 and US2. US4 requires accepted owner contracts from US1/US2; its host history integration uses the report and insertion paths completed in US3.
- **Polish (Phase 7)**: T041–T042 depend on all intended story work and update/execute the feature quickstart.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2; establishes complete project acceptance and migration.
- **User Story 2 (P1)**: Starts after Phase 2; independent resource roots do not depend on project migrations.
- **User Story 3 (P1)**: Follows US1 and US2 acceptance APIs; it wires report and rejection outcomes through app, library, and CLI publication boundaries.
- **User Story 4 (P1)**: Follows US1/US2 owner contracts. Its core ownership work may proceed alongside US3; ProjectHistory insertion integration needs the existing validated insertion boundary.

### Within Each User Story

- Add owner-level regression cases before changing the corresponding acceptance behavior.
- Project structural migration runs before model deserialization; local resource normalization runs without a project envelope/version.
- Every concrete owner in `serialization-inventory.md` must follow its family matrix; an outer recognized type never bypasses nested member validation.
- Library archive retention is separate from supported model acceptance and never authorizes editing or insertion.
- Rejected candidates must not publish, save, run scripts, mutate source files, or add history entries.
- Durable project mutations use semantic labels and focused commit→undo→redo verification; load-time migration establishes a baseline.
- Update the fixture manifest and quickstart when new evidence changes an accepted form or its canonical output.

### Parallel Opportunities

- T002 and T004 can be authored in parallel because they change separate test files; T003 and T006 can be implemented in parallel after the relevant regression cases exist.
- After T014, the instrument, BSB, automation, mixer/effect, UDO, and note-processor owner tasks T016–T020 and T023 touch separate family files and can be split by owner.
- US1 and US2 can be staffed independently after the shared foundation is complete.
- T034 and T035 cover separate data ownership and application history suites and can be authored in parallel.

## Parallel Examples by User Story

### User Story 1

After T008–T009 establish the candidate root and migration pipeline, run independent owner work in parallel:

```text
Task: T010 project properties and section owners in packages/blue-data/src/
Task: T011 timing owners in packages/blue-data/src/time/
Task: T012 marker, Live, MIDI, and plugin owners in packages/blue-data/src/
```

### User Story 2

After T015 establishes the standalone report boundary, split the independent resource families:

```text
Task: T016 instrument dispatch and basic instrument owners in packages/blue-data/src/instruments/
Task: T017 BlueSynthBuilder, BlueX7, BSB widget, and preset owners in packages/blue-data/src/instruments/
Task: T018 Line and Parameter owners in packages/blue-data/src/automation/ and packages/blue-data/src/sound-objects/
Task: T019 Mixer and Effect owners in packages/blue-data/src/mixer/
Task: T020 UDO and opcode owners in packages/blue-data/src/opcodes/
Task: T023 note-processor and JMask owners in packages/blue-data/src/note-processors/ and packages/blue-data/src/sound-objects/
```

Complete T021 before T022 because concrete SoundObject owners consume the shared time normalization.

### User Story 3

After US1/US2 acceptance APIs exist, author the independent app, library, and CLI verification suites together:

```text
Task: T025 project replacement lifecycle regressions in packages/blue-app/src/main/
Task: T026 library archive and transaction regressions in packages/blue-data/src/libraries/ and packages/blue-app/src/main/unified-library/
Task: T027 CLI publication regressions in packages/blue-cli/src/cli.test.ts
```

### User Story 4

After US1/US2 owners are stable, data ownership and application history cases use separate suites:

```text
Task: T034 XML, marker, and deep-copy ownership cases in packages/blue-data/src/
Task: T035 ProjectHistory commit-undo-redo cases in packages/blue-app/src/
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup and Phase 2: Foundational.
2. Complete Phase 3: project report acceptance, ordered migrations, and project/time owner contracts.
3. Independently validate current projects, the composed historical fixture, root/nested rejection, and save/reopen behavior using `quickstart.md`.

### Incremental Delivery

1. Complete Setup and Foundational so all owners share the same evidence and diagnostic rules.
2. Deliver US1 project loading and save/reopen as the MVP.
3. Deliver US2 standalone and embedded resource compatibility.
4. Deliver US3 app/library/CLI publication and visible diagnostic outcomes.
5. Deliver US4 independent ownership and ProjectHistory restoration.
6. Complete Phase 7 checks and record results in the quickstart.

## Notes

- Every task uses the required checkbox, sequential ID, optional `[P]`, story label where applicable, and concrete file path(s).
- `[P]` means the task has no dependency on an incomplete task that edits the same files.
- `serialization-inventory.md` and the three family evidence matrices define the finite owner set and accepted forms; do not add opaque retention to close an evidence gap.
- The task list schedules verification work; it does not claim tests or builds have already run.


## Phase 8: Convergence

- [X] T043 CRITICAL — Prevent silently discarded legacy root SoundObjects in `packages/blue-data/src/blue-data/xml-policy.ts` and `packages/blue-data/src/migration/upgrade-manager.ts`: after version-gated migrations, require every remaining historical root member to undergo its documented structural conversion or reject contextually before candidate acceptance. Reproduce projects tagged `2.3.0` and later containing a root PolyObject with nested GenericScore content, including unexpected nested input and a competing Score; verify supported content survives canonical save/reopen or rejection returns no candidate and leaves active state inert in `packages/blue-data/src/migration/project-xml-compatibility.test.ts` and the existing app replacement suites per Constitution II, FR-004, FR-007, FR-008, and US1/AC2 (contradicts).
- [X] T044 CRITICAL — Stop audio-layer migration from deleting transitional Track processor chains in `packages/blue-data/src/migration/migrate-audio-layers-to-tracks.ts`: validate every consumed chain before rewriting, preserve fully supported canonical `track` chains under the documented transitional-container contract, and reject unknown or disallowed legacy processor content before removing its evidence. Add original synthetic valid/nonempty, unknown-child, unknown-attribute, duplicate-chain, and merged-container cases to the existing audio migration/project compatibility suites; assert canonical second-pass stability and no accepted content loss per Constitution II, FR-008, FR-010, FR-015, and US3/AC4 (contradicts).
- [X] T045 CRITICAL — Use checked boolean conversion results when loading `seedUsed` in `packages/blue-data/src/note-processors/random-add-processor.ts` and `packages/blue-data/src/note-processors/random-multiply-processor.ts`, and `visible` in `packages/blue-data/src/sound-objects/jmask-support.ts`; remove the inconsistent untrimmed re-interpretation after validation. Extend `packages/blue-data/src/note-processors/xml-acceptance.test.ts` and the JMask acceptance suite with padded and mixed-case true/false tokens, standalone/embedded equivalence, exact-seed deterministic behavior, and canonical save/reopen state per Constitution II, FR-006, FR-015, and plan: checked scalar conversions (contradicts).
- [X] T046 CRITICAL — Interpret validated local widget versions numerically in `packages/blue-data/src/instruments/blue-synth-builder/bsb-xml.ts`, `packages/blue-data/src/instruments/blue-synth-builder/bsb-knob.ts`, and `packages/blue-data/src/instruments/blue-synth-builder/bsb-xy-controller.ts` instead of branching on the original attribute spelling. Cover accepted `1`, `01`, `+1`, and padded `1` forms, corresponding version-2 forms, finite historical range conversion, and canonical second-pass stability in `packages/blue-data/src/instruments/blue-synth-builder/xml-contract.test.ts`; verify direct, standalone, and embedded loaders apply identical conversions per Constitution II, FR-003, FR-005, and US2/AC3 (partial).
- [X] T047 CRITICAL — Propagate `CopyMode` through Sound, ObjectBuilder, FrozenSoundObject, and Live-owned nested copy paths in `packages/blue-data/src/sound-objects/sound.ts`, `packages/blue-data/src/sound-objects/object-builder.ts`, `packages/blue-data/src/sound-objects/frozen-sound-object.ts`, `packages/blue-data/src/live-data.ts`, `packages/blue-data/src/live/live-object.ts`, `packages/blue-data/src/live/live-object-bins.ts`, and `packages/blue-data/src/blue-data.ts`; preserve widget, preset, parameter, and nested layer identities for history while retaining the existing user-duplication rekeying contract. Add focused whole-project memento and commit→undo→redo regressions in `packages/blue-data/src/blue-data-deep-copy.test.ts` and the existing application history suites for these owners, checking canonical content, stable references/identities, dirty state, semantic labels, and required runtime reconciliation per Constitution III, FR-017, SC-006, and US4/AC3 (contradicts).
- [X] T048 CRITICAL — Complete copied-library Instance reference relinking in `packages/blue-data/src/blue-data.ts` across TrackLayerGroup/Track items and FrozenSoundObject source subtrees as well as the existing PolyObject/Live/library traversal. Reproduce history copies whose Track and frozen-source Instances currently reference the original library object, then assert each reference targets the corresponding copied library object and mutations cannot affect the canonical project or another memento; cover forward/shared references, save/reopen, and commit→undo→redo in `packages/blue-data/src/blue-data-deep-copy.test.ts` and the existing application history suites per Constitution II and III, FR-016, FR-017, SC-005, and US4/AC2 (contradicts).
- [X] T049 Make FrozenSoundObject omitted-field acceptance and canonical output consistent in `packages/blue-data/src/sound-objects/frozen-sound-object.ts`: apply the evidenced required/default rule for `numChannels` so an accepted omitted value cannot serialize as rejected `0`. Consult the recorded Java owner evidence without inventing a channel count; add minimal/omitted, explicit-invalid, populated-source, standalone/embedded, and accepted save/reopen regressions in `packages/blue-data/src/sound-objects/frozen-sound-object.test.ts` and `packages/blue-data/src/sound-objects/concrete-xml-contract.test.ts` per FR-006, FR-015, SC-001, and US4/AC4 (partial).
- [X] T050 Emit the documented historical PianoRoll ruler-interval warning when accepting `timeUnit` in `packages/blue-data/src/sound-objects/piano-roll.ts`, identifying source/path/value, current display limitation, retained metadata, and safe save behavior. Extend `packages/blue-data/src/sound-objects/concrete-xml-contract.test.ts` and `packages/blue-data/src/resource-xml-policy.test.ts` to verify direct loading requires a diagnostic sink, report APIs surface the warning standalone and embedded, and save/copy/history preserve the interval; verify its presentation through the existing app/library diagnostic flows per FR-009, FR-011, US3/AC2, and plan: named warning and retention rules (missing).


## Phase 9: Convergence

- [X] T051 CRITICAL — Enforce the declared root names at direct XML owner APIs using the existing diagnostics/check helpers in `packages/blue-data/src/serialization/xml-load.ts` and `packages/blue-data/src/utilities/xml.ts`, then apply them to the remaining in-scope owners in `packages/blue-data/src/score/`, `packages/blue-data/src/time/`, `packages/blue-data/src/sound-objects/`, `packages/blue-data/src/opcodes/opcode-list.ts`, `packages/blue-data/src/midi/midi-input-processor.ts`, and the project section files. Current probes show wrong-root acceptance by PolyObject, ClojureObject, FrozenSoundObject, Score, PatternLayer, PatternsLayerGroup, PatternData, timeline Track, TrackLayerGroup, TimeContext, TimeState, TempoMap, MeterMap, MarkersList, ProjectProperties, GlobalOrcSco, Tables, ScratchPadData, OpcodeList, MidiInputProcessor, and PianoRoll Scale. Reject unexpected root spellings before model acceptance with XmlLoadError carrying source, owning path, offending root, severity, and recovery; retain documented PolyObject aliases and legitimate caller-selected time/line element names. Extend the existing owner XML contract suites, including `packages/blue-data/src/sound-objects/concrete-xml-contract.test.ts` and `packages/blue-data/src/resource-xml-policy.test.ts`, with direct-loader wrong-root cases, valid aliases, and report/direct equivalence per Constitution II, FR-007, FR-011, FR-013, SC-002, and plan: strict direct compatibility methods (contradicts).
- [X] T052 CRITICAL — Propagate CopyMode through the copy constructors and deepCopy methods in `packages/blue-data/src/score/patterns/pattern-layer.ts` and `packages/blue-data/src/score/patterns/patterns-layer-group.ts` so the mode already supplied by Score reaches each embedded SoundObject. Reproduce the nested Sound widget identity change during BlueData.historyCopy, then cover Sound/ObjectBuilder editor identities and FrozenSoundObject/PolyObject nested identities, preserving them for history and retaining established user-duplication rekeying. Add focused whole-project copy checks in `packages/blue-data/src/blue-data-deep-copy.test.ts` and pattern-owned commit→undo→redo cases in `packages/blue-app/src/main/project-history-roundtrip.test.ts`, asserting canonical content, identities, references, dirty state, semantic labels, and applicable runtime reconciliation per Constitution III, FR-017, SC-006, US4/AC3, and plan: history copies preserve identities (contradicts).
- [X] T053 CRITICAL — Extend copied-library Instance reference relinking in `packages/blue-data/src/blue-data.ts` to traverse every PatternLayer SoundObject in PatternsLayerGroup, including its nested PolyObject and FrozenSoundObject paths, through the existing shared traversal. Reproduce an accepted project whose original pattern Instance saves/reopens correctly but whose history copy still targets the original library, allows memento mutation to change canonical content, and emits an unresolved reference on save/reopen. Add forward/shared-reference and independent-memento regressions for history and whole-project duplication in `packages/blue-data/src/blue-data-deep-copy.test.ts`, plus focused commit→undo→redo coverage in `packages/blue-app/src/main/project-history-roundtrip.test.ts`; assert references target the corresponding copied library object, copied mutations remain isolated, and canonical output reopens with coherent references per Constitution II and III, FR-016, FR-017, SC-005, US4/AC2, and plan: independent copy/history ownership (contradicts).


## Phase 10: Convergence

- [X] T054 CRITICAL — Finish expected-root rejection at the remaining inventoried direct owner APIs by reusing checkRoot in `packages/blue-data/src/utilities/xml.ts`: Arrangement in `packages/blue-data/src/arrangement.ts`; InstrumentAssignment, InstrumentLibrary, and InstrumentCategory in `packages/blue-data/src/instruments/`; LiveData in `packages/blue-data/src/live-data.ts` and LiveObject, LiveObjectBins, LiveObjectSet, and LiveObjectSetList in `packages/blue-data/src/live/`; TempoPoint, MeasureMeterPair, and Meter in `packages/blue-data/src/time/`; AudioClip in `packages/blue-data/src/score/audio/audio-clip.ts`; SoundObjectLibrary in `packages/blue-data/src/sound-objects/sound-object-library.ts`; MidiKeyMapping and MidiVelocityMapping in `packages/blue-data/src/midi/`; and ClojureLibraryEntry in `packages/blue-data/src/plugins/clojure-project-data.ts`. All 17 currently accept a renamed, otherwise valid serialized root. Reject before reading model content with contextual XmlLoadError root diagnostics. Extend the explicit loader table in `packages/blue-data/src/serialization/xml-owner-root-contract.test.ts` to cover these owners and reconcile the complete finite owner inventory, including APIs requiring instrument, reference-map, or field-definition arguments; rename valid populated input rather than relying only on empty wrong-root input. Assert direct/report diagnostic equivalence, correct source/path/member/value/severity/recovery, and continued current/historical acceptance and canonical save/reopen. Preserve documented caller-selected TimePosition/TimeDuration element names and explicit aliases; unsupported archive placeholders do not become accepted model owners. Keep the completed T051 checks and pattern copy/reference regressions passing per Constitution II, FR-007, FR-011, FR-013, SC-002, T051, and plan: strict direct compatibility methods (contradicts).


## Phase 11: Example corpus convergence

- [X] T055 [US1] Add a read-only regression in `packages/blue-data/tests/integration/example-projects-load.test.ts` for every `.blue` file in `examples/` and `packages/blue-app/assets/examples/`, using the current source report loader without executing project scripts or initializing runtimes. Require nonempty inventories, accepted candidates, canonical save/reopen stability, and unchanged source bytes. Record the initial audit result in `spec.md`, `plan.md`, and `quickstart.md`: at T055 creation, all 134 project cases failed and the two inventory checks passed. T056 restored all 134 cases.
- [X] T056 CRITICAL [US1] Restore loading of the example corpus without discarding meaningful data or weakening unexpected-input rejection. Research Java writer/loader revisions and record explicit historical contracts in `specs/116-xml-compatibility-contracts/research.md`, the family matrices, and `serialization-inventory.md` before changing the owning loaders/migrations. Initial errors identified `csladspaSettings`, `timeUnit`, `isRoot`, and development project suffixes; later reports exposed nested PolyObject, BSB, Tracker, and ObjectBuilder forms. Their bounded typed or warning recoveries are recorded in the evidence matrices. Original synthetic owner tests cover each rule. All 134 T055 project cases now pass loading, canonical reopening, stable serialization, and unchanged-source checks; the two inventories pass. `pnpm --filter @blue/data test` passed (3,080 tests, 1 skipped); after rebuilding stale `@blue/data` output, `pnpm test` and `pnpm lint` passed. `git diff --check` passed. Closure evidence is in [quickstart.md](quickstart.md#example-corpus-restoration-2026-10-04) per Constitution II, FR-004, FR-007, FR-008, FR-015, FR-019, and US1 (done).


## Phase 12: Convergence

- [X] T057 CRITICAL — Reject meaningful direct text and CDATA inside the retired `uniqueNameManager` helper in `packages/blue-data/src/instruments/blue-synth-builder/bsb-graphic-interface.ts`. The empty helper remains a named warning-and-omit case, and whitespace-only formatting remains valid. Direct, standalone resource, and embedded project tests cover contextual rejection, absent candidates, untouched input, and empty-helper behavior; the 134-project corpus still passes. Full validation is recorded in [quickstart.md](quickstart.md#xml-owner-and-history-copy-convergence-2026-10-04) (done).
- [X] T058 CRITICAL — Preserve authored Instance names and background colors when copied library references are rebound. `setSoundObject` now changes only the target; library-transfer creation still seeds presentation fields. Synthetic tests cover Library, Score/PolyObject, Track, Pattern, Frozen, and Live paths, copied-reference independence, and project-history commit→undo→redo. The corpus verifies history-copy canonical equality for all 134 example projects. Affected suites and builds pass; root workspace validation was attempted and its unrelated Maven lock limitation is documented in [quickstart.md](quickstart.md#xml-owner-and-history-copy-convergence-2026-10-04) (done).
