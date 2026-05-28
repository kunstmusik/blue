# Tasks: Jython Runtime Support

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/050-jython-support/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required. The feature cannot exit without helper-side JUnit and TypeScript Vitest coverage for actual Jython processing through PythonObject, ObjectBuilder, PythonInstrument, PythonProcessor, packaged library imports, reinitialize, and failure paths.

**Organization**: Tasks are grouped by user story so the Jython runtime bundle, Python score-object execution, PythonInstrument generation, PythonProcessor execution, and diagnostics/reinitialize behavior can be implemented and validated incrementally.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its phase prerequisites because it touches different files or independent tests
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the package locations and asset-copy targets used by all Jython work.

- [x] T001 Create Jython helper source and test directories in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/jython/` and `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/`
- [x] T002 [P] Create packaged Python library resource directory in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/resources/jython/pythonLib/`
- [x] T003 [P] Create Electron app Python library asset directory in `/Users/stevenyi/work/blue-electron/packages/blue-app/assets/java/pythonLib/`
- [x] T004 [P] Add a Jython runtime README section in `/Users/stevenyi/work/blue-electron/packages/blue-java/README.md`
- [x] T005 [P] Add any implementation-discovered Java Blue source anchors or fixture references to `/Users/stevenyi/work/blue-electron/specs/050-jython-support/research.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared protocol, dependency packaging, path resolution, and pure data models required before any user story can execute.

**Critical**: No user story implementation should begin until this phase is complete.

### Tests

- [x] T006 [P] Add JUnit Jython protocol method serialization tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/protocol/ProtocolEnvelopeTest.java`
- [x] T007 [P] Add Vitest Jython protocol method and response decoding tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-protocol.test.ts`
- [x] T008 [P] Add Java runtime contract tests for Jython methods in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/java-runtime.test.ts`
- [x] T009 [P] Add ObjectBuilder XML round-trip, deep-copy, and no-runtime preservation tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/object-builder.test.ts`
- [x] T010 [P] Add PythonProcessor XML round-trip and deep-copy tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/python-processor.test.ts`
- [x] T011 [P] Add Python library asset count tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonPackagedLibraryTest.java`

### Implementation

- [x] T012 Add `org.python:jython-standalone:2.7.4` and Python library copy steps to `/Users/stevenyi/work/blue-electron/packages/blue-java/pom.xml`
- [x] T013 Copy Java Blue `blue-ext-jython/src/main/release/pythonLib` into `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/resources/jython/pythonLib/` and `/Users/stevenyi/work/blue-electron/packages/blue-app/assets/java/pythonLib/`
- [x] T014 Extend helper runtime methods with Jython method constants in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/protocol/RuntimeMethod.java`
- [x] T015 Extend TypeScript runtime methods and Jython payload types in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-protocol.ts`
- [x] T016 Extend `JavaRuntimeClientContract` with Jython methods in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/java-runtime.ts`
- [x] T017 Extend Electron runtime client methods in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-client.ts`
- [x] T018 Add Python library path resolution for dev and packaged layouts in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-path.ts`
- [x] T019 Extend Java runtime session initialization params with Jython library roots in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-session.ts`
- [x] T020 Implement first-class ObjectBuilder data/XML model in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/object-builder.ts`
- [x] T021 Register and export ObjectBuilder in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/register-sound-object-types.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/index.ts`
- [x] T022 Implement executable PythonProcessor model in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/python-processor.ts`
- [x] T023 Register PythonProcessor without exposing unrelated unsupported processors as addable in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-chain.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-catalog.ts`

**Checkpoint**: Runtime protocol, packaging hooks, path resolution, and pure project models are ready for user-story execution.

---

## Phase 3: User Story 1 - Bundle Jython and Blue Python Libraries (Priority: P1) MVP

**Goal**: Ship Jython and Java Blue's Python library assets with the app and prove imports work in a helper session.

**Independent Test**: Build the helper/assets, start the helper, run `jython.importCheck` for `orchestra` and `pmask`, and confirm user library path ordering.

### Tests for User Story 1

- [x] T024 [P] [US1] Add JUnit Jython library path ordering tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonLibraryPathTest.java`
- [x] T025 [P] [US1] Add JUnit Jython import check tests for `orchestra` and `pmask` in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonImportCheckTest.java`
- [x] T026 [P] [US1] Add app-side Python library asset path tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-path.test.ts`
- [x] T027 [P] [US1] Add Java runtime session init tests for Jython library params in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-session.test.ts`

### Implementation for User Story 1

- [x] T028 [US1] Implement helper-side Jython library path resolver in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/jython/JythonLibraryPath.java`
- [x] T029 [US1] Implement persistent helper-side Jython session initialization and import check in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/jython/JythonSession.java`
- [x] T030 [US1] Add Jython fields to project session ownership in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/session/ProjectSession.java`
- [x] T031 [US1] Route `jython.importCheck` and advertise `jython` capability in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/transport/JeroMqRuntimeServer.java`
- [x] T032 [US1] Pass resolved packaged/user Python library roots from Electron main in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-session.ts`
- [x] T033 [US1] Add Jython import-check client method in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-client.ts`

**Checkpoint**: User Story 1 proves Jython and Java Blue Python libraries are available before score processing work begins.

---

## Phase 4: User Story 2 - Generate Scores from PythonObject and Python ObjectBuilder (Priority: P1)

**Goal**: Execute PythonObject and Python-language ObjectBuilder with persistent project Jython state, BSB replacements, note parsing, note processors, and time behavior.

**Independent Test**: A setup PythonObject defines a function, a later PythonObject calls it, and a Python ObjectBuilder uses BSB-replaced values; all paths generate expected notes.

### Tests for User Story 2

- [x] T034 [P] [US2] Add JUnit Jython score-object evaluation tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonScoreObjectEvaluationTest.java`
- [x] T035 [P] [US2] Add JUnit persistent setup and re-use tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonSessionPersistenceTest.java`
- [x] T036 [P] [US2] Add JUnit ObjectBuilder score evaluation tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonObjectBuilderEvaluationTest.java`
- [x] T037 [P] [US2] Add PythonObject async runtime and no-runtime preservation tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/python-object-runtime.test.ts`
- [x] T038 [P] [US2] Add ObjectBuilder BSB replacement and async runtime tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/object-builder-runtime.test.ts`
- [x] T039 [P] [US2] Add Electron score-object test coverage for PythonObject and ObjectBuilder runtime delegation in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/score-object-test.test.ts`
- [x] T040 [P] [US2] Add score-object editor document tests for ObjectBuilder code editing in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/score-object-editor-document.test.ts`

### Implementation for User Story 2

- [x] T041 [US2] Implement helper-side score-object and ObjectBuilder evaluation methods in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/jython/JythonSession.java`
- [x] T042 [US2] Route `jython.evalScoreObject` and `jython.evalObjectBuilder` in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/transport/JeroMqRuntimeServer.java`
- [x] T043 [US2] Add TypeScript client methods for Jython score-object and ObjectBuilder evaluation in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-client.ts`
- [x] T044 [US2] Implement PythonObject `processOnLoadAsync` and `generateForCSDAsync` through Jython in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/python-object.ts`
- [x] T045 [US2] Implement ObjectBuilder BSB replacement, Python async generation, note parsing, processor chain, and time behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/object-builder.ts`
- [x] T046 [US2] Wire ObjectBuilder snapshots, labels, code patches, language metadata, and test support in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T047 [US2] Add ObjectBuilder editor routing or selected code editor support in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editor-registry.tsx`
- [x] T048 [US2] Run PythonObject on-load processing through the Java runtime during project open/new/revert flows in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T049 [US2] Thread the active `javaRuntimeClient` through generated CSD, playback, disk export, and score-object test calls so PythonObject/ObjectBuilder async generation receives it in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/csd-export.ts`

**Checkpoint**: User Story 2 supports PythonObject and Python ObjectBuilder score generation with persistent Jython state.

---

## Phase 5: User Story 3 - Generate PythonInstrument Orchestra Text (Priority: P1)

**Goal**: Execute PythonInstrument scripts and include their generated instrument body in CSD generation.

**Independent Test**: A PythonInstrument assigning `instrument` renders a non-empty orchestra body and preserves global orchestra/global score/UDO behavior.

### Tests for User Story 3

- [x] T050 [P] [US3] Add JUnit PythonInstrument evaluation tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonInstrumentEvaluationTest.java`
- [x] T051 [P] [US3] Add PythonInstrument async runtime and no-runtime XML preservation tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/instruments/python-instrument-runtime.test.ts`
- [x] T052 [P] [US3] Add async CSD orchestra generation tests for PythonInstrument in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-python-instrument-runtime.test.ts`
- [x] T053 [P] [US3] Add app CSD export test coverage for PythonInstrument runtime delegation in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/csd-export.test.ts`

### Implementation for User Story 3

- [x] T054 [US3] Implement helper-side `instrument` binding evaluation in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/jython/JythonSession.java`
- [x] T055 [US3] Route `jython.evalInstrument` in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/transport/JeroMqRuntimeServer.java`
- [x] T056 [US3] Add TypeScript client method for Jython instrument evaluation in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-client.ts`
- [x] T057 [US3] Implement async PythonInstrument generation through the runtime client in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/instruments/python-instrument.ts`
- [x] T058 [US3] Add async orchestra/instrument generation plumbing in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/instruments/instrument.ts`
- [x] T059 [US3] Ensure generated CSD/export paths use async PythonInstrument generation in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/csd-export.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`

**Checkpoint**: User Story 3 makes PythonInstrument contribute generated orchestra text.

---

## Phase 6: User Story 4 - Execute PythonProcessor in Note Chains (Priority: P2)

**Goal**: Make PythonProcessor executable through Jython note-list adapters while preserving XML compatibility.

**Independent Test**: A PythonProcessor mutates p-fields through `noteList` iteration/indexing and final rendered notes reflect the mutation.

### Tests for User Story 4

- [x] T060 [P] [US4] Add JUnit Jython note adapter tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonNoteAdapterTest.java`
- [x] T061 [P] [US4] Add JUnit PythonProcessor mutation tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonNoteProcessorEvaluationTest.java`
- [x] T062 [P] [US4] Add TypeScript note serialization tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/python-processor-runtime.test.ts`
- [x] T063 [P] [US4] Add async note-processor chain tests for PythonProcessor order in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-chain-runtime.test.ts`
- [x] T064 [P] [US4] Add renderer snapshot tests showing PythonProcessor is executable, not deferred, in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-snapshot.test.ts`

### Implementation for User Story 4

- [x] T065 [US4] Implement helper-side Jython note adapters in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/jython/JythonNote.java` and `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/jython/JythonNoteList.java`
- [x] T066 [US4] Implement helper-side PythonProcessor evaluation and note serialization in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/jython/JythonSession.java`
- [x] T067 [US4] Route `jython.processNoteList` in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/transport/JeroMqRuntimeServer.java`
- [x] T068 [US4] Add TypeScript client method for PythonProcessor note-list processing in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-client.ts`
- [x] T069 [US4] Implement PythonProcessor runtime serialization and mutation application in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/python-processor.ts`
- [x] T070 [US4] Add async note-processor chain processing support in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-chain.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/utilities/score.ts`
- [x] T071 [US4] Update PythonObject, ObjectBuilder, and ClojureObject async generation to use async note-processor chains in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/`
- [x] T072 [US4] Update note-processor snapshots/catalog to mark PythonProcessor executable where Java runtime is available in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-snapshot.ts`

**Checkpoint**: User Story 4 makes PythonProcessor participate in rendered note generation.

---

## Phase 7: User Story 5 - Surface Jython Runtime Status and Reinitialize Behavior (Priority: P2)

**Goal**: Provide clear Jython diagnostics, output capture, unavailable states, timeout behavior, and a project-scoped reinitialize path.

**Independent Test**: Trigger missing library, import failure, syntax error, timeout, helper exit, and reinitialize scenarios and verify structured results without data loss.

### Tests for User Story 5

- [x] T073 [P] [US5] Add JUnit Jython reinitialize tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonReinitializeTest.java`
- [x] T074 [P] [US5] Add JUnit Jython error, output capture, and protocol-integrity tests proving user stdout/stderr cannot corrupt response frames in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonErrorHandlingTest.java`
- [x] T075 [P] [US5] Create app runtime error mapping tests for the stable Jython error-code set in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-errors.test.ts`
- [x] T076 [P] [US5] Add Java runtime client timeout/unexpected-exit Jython tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-client.test.ts`
- [x] T077 [P] [US5] Add renderer/main unavailable-state tests for Jython-backed actions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/python-runtime-status.test.tsx`
- [x] T078 [P] [US5] Re-run or extend Clojure regression tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/clojure/ClojureSessionTest.java`

### Implementation for User Story 5

- [x] T079 [US5] Implement Jython-specific exception type and stable error mapping in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/jython/JythonEvaluationException.java`
- [x] T080 [US5] Route `jython.reinitialize` and output/error envelopes in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/transport/JeroMqRuntimeServer.java`
- [x] T081 [US5] Create TypeScript runtime error code mapping for the stable Jython error-code set in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-errors.ts`
- [x] T082 [US5] Add Electron main/preload IPC for Jython reinitialize and runtime status in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/preload.ts`
- [x] T083 [US5] Add renderer affordance for Jython unavailable/error status in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/JythonRuntimeStatusIndicator.tsx`
- [x] T084 [US5] Ensure Jython runtime failures preserve Python-backed XML and return structured user-facing errors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/score-object-test.ts`

**Checkpoint**: User Story 5 gives users a reliable recovery and diagnostics path for stateful Jython execution.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, compatibility checks, and full validation after selected stories are complete.

- [x] T085 [P] Update `@blue/java-runtime` documentation with Jython packaging and protocol notes in `/Users/stevenyi/work/blue-electron/packages/blue-java/README.md`
- [x] T086 [P] Update `@blue/data` README runtime support table in `/Users/stevenyi/work/blue-electron/packages/blue-data/README.md`
- [x] T087 [P] Update feature quickstart discoveries and manual fixture notes in `/Users/stevenyi/work/blue-electron/specs/050-jython-support/quickstart.md`
- [x] T088 Run `pnpm --filter @blue/java-runtime test` from `/Users/stevenyi/work/blue-electron`
- [x] T089 Run `pnpm --filter @blue/java-runtime build` from `/Users/stevenyi/work/blue-electron`
- [x] T090 Run `pnpm --filter @blue/data test` from `/Users/stevenyi/work/blue-electron`
- [x] T091 Run `pnpm --filter @blue/app test` from `/Users/stevenyi/work/blue-electron`
- [x] T092 Run `pnpm --filter @blue/app build` from `/Users/stevenyi/work/blue-electron`
- [x] T093 Run `.specify/scripts/bash/check-prerequisites.sh --json --include-tasks --require-tasks` from `/Users/stevenyi/work/blue-electron`
- [x] T094 Run `git diff --check` from `/Users/stevenyi/work/blue-electron`
- [x] T095 Update handoff status in `/Users/stevenyi/work/blue-electron/specs/050-jython-support/status.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational. This is the MVP because no Jython execution can work until dependencies and library paths import correctly.
- **US2 (Phase 4)**: Depends on US1 for a working Jython session and on Foundational ObjectBuilder/PythonObject models.
- **US3 (Phase 5)**: Depends on US1 and async runtime contract; can run in parallel with US2 after protocol methods stabilize.
- **US4 (Phase 6)**: Depends on US1 and should start after US2 proves score-object runtime injection because processor execution plugs into the same generation path.
- **US5 (Phase 7)**: Depends on US1 and can run alongside US2-US4 after runtime errors and client methods exist.
- **Polish (Phase 8)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational.
- **US2 (P1)**: Requires US1.
- **US3 (P1)**: Requires US1; independent from PythonObject/ObjectBuilder once async CSD plumbing is planned.
- **US4 (P2)**: Requires US1 and async note-generation integration from US2.
- **US5 (P2)**: Requires US1 and touches all runtime call sites.

### Parallel Opportunities

- Setup tasks T002-T005 can run in parallel after T001.
- Foundational tests T006-T011 can run in parallel.
- US1 tests T024-T027 can run in parallel.
- US2 JUnit tests T034-T036 can run in parallel with Vitest/app tests T037-T040.
- US3 tests T050-T053 can run in parallel.
- US4 adapter/helper tests T060-T061 can run in parallel with TypeScript tests T062-T064.
- US5 tests T073-T078 can run in parallel.
- Documentation tasks T085-T087 can run in parallel after implementation discoveries settle.

## Parallel Example: User Story 2

```text
Task: "Add JUnit Jython score-object evaluation tests in packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonScoreObjectEvaluationTest.java"
Task: "Add PythonObject async runtime tests in packages/blue-data/src/sound-objects/python-object-runtime.test.ts"
Task: "Add Electron score-object test coverage for PythonObject and ObjectBuilder runtime delegation in packages/blue-app/src/main/score-object-test.test.ts"
```

## Parallel Example: User Story 4

```text
Task: "Add JUnit Jython note adapter tests in packages/blue-java/src/test/java/com/kunstmusik/bluejava/jython/JythonNoteAdapterTest.java"
Task: "Add TypeScript note serialization tests in packages/blue-data/src/note-processors/python-processor-runtime.test.ts"
Task: "Add renderer snapshot tests showing PythonProcessor is executable in packages/blue-data/src/note-processors/note-processor-snapshot.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Add Jython dependency and package/copy Python libraries.
3. Implement Jython session initialization and import check.
4. Stop and validate helper build plus `orchestra`/`pmask` imports.

### Incremental Delivery

1. US1: Jython runtime and packaged libraries import correctly.
2. US2: PythonObject and Python ObjectBuilder generate score text and notes.
3. US3: PythonInstrument contributes generated orchestra text.
4. US4: PythonProcessor mutates note lists in processor chains.
5. US5: Diagnostics, output capture, and reinitialize are complete.

### Risk Focus

- Keep `@blue/data` pure; no Node, process, filesystem, `require()`, or dynamic import usage.
- Avoid breaking SPEC 049 Clojure runtime methods while extending shared protocol/session code.
- Treat `pythonLib/blue` path semantics as compatibility-critical because Java Blue imports `orchestra` and `pmask` as top-level modules.
- Build Jython note adapters against observed Java Blue examples first: iteration, indexing, `len()`, `getPField`, and `setPField`.
- Do not claim Python console UI parity in this slice; keep scope on execution, status, and reinitialize.
