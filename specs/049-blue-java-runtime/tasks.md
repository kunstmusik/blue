# Tasks: Blue Java Runtime Bridge

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are required by the specification and constitution. Write or update the relevant Maven/JUnit and Vitest tests before implementation in each phase.

**Organization**: Tasks are grouped by user story so the Java helper artifact, Clojure runtime behavior, project CWD parity, diagnostics, and future Jython extensibility can be implemented and validated incrementally.

**Closeout Note (2026-05-27)**: Core Clojure bridge scope is implemented and validated. Remaining unchecked tasks are explicit hardening or future-Jython follow-ups that stayed outside the accepted closeout slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the package/documentation locations and build hooks needed by all stories.

- [x] T001 Create Maven package skeleton and Java source directories in `/Users/stevenyi/work/blue-electron/packages/blue-java/`
- [x] T002 [P] Add pnpm workspace wrapper scripts for the Java helper in `/Users/stevenyi/work/blue-electron/packages/blue-java/package.json`
- [x] T003 [P] Create Java asset destination and placeholder tracking file in `/Users/stevenyi/work/blue-electron/packages/blue-app/assets/java/`
- [x] T004 [P] Create Electron main Java runtime module directory in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/`
- [x] T005 [P] Review Java Blue Clojure source anchors and record any additional parity notes in `/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/research.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared protocol, pure data models, and build configuration required before user-story implementation.

**Critical**: No user story implementation should begin until this phase is complete.

### Tests

- [x] T006 [P] Add JUnit protocol envelope serialization tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/protocol/ProtocolEnvelopeTest.java`
- [x] T007 [P] Add JUnit runtime option parsing tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/cli/RuntimeOptionsTest.java`
- [x] T008 [P] Add Vitest Java runtime protocol tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-protocol.test.ts`
- [x] T009 [P] Add ClojureObject XML round-trip and deep-copy tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/clojure-object.test.ts`
- [x] T010 [P] Add ClojureProjectData plugin XML parse/preserve tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/plugins/clojure-project-data.test.ts`

### Implementation

- [x] T011 Configure Maven dependencies, shade plugin, non-minimized fat JAR output, and asset copy in `/Users/stevenyi/work/blue-electron/packages/blue-java/pom.xml`
- [x] T012 Implement Java command-line option parsing in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/cli/RuntimeOptions.java`
- [x] T013 Implement Java protocol envelopes and method constants in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/protocol/`
- [x] T014 Implement helper entrypoint with health and shutdown command routing in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/BlueJavaMain.java`
- [x] T015 Implement TS runtime protocol types and codecs in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-protocol.ts`
- [x] T016 Implement pure ClojureObject data/XML model in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/clojure-object.ts`
- [x] T017 Register and export ClojureObject in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/register-sound-object-types.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/index.ts`
- [x] T018 Implement pure ClojureProjectData plugin metadata parser in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/plugins/clojure-project-data.ts`
- [x] T019 Add an abstract Java runtime evaluation contract for async render/test paths in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/java-runtime.ts`

**Checkpoint**: Build configuration, protocol envelopes, and pure XML/data models are available for all stories.

---

## Phase 3: User Story 1 - Bundle an Optional Java Runtime (Priority: P1) MVP

**Goal**: Build, copy, locate, launch, health-check, and stop the optional Java helper without requiring Java Blue.

**Independent Test**: Build the helper, verify `blue-java.jar` is copied to app assets, launch with Java installed, receive a health response, and stop cleanly.

### Tests for User Story 1

- [x] T020 [P] [US1] Add Maven artifact existence/copy verification test or build assertion in `/Users/stevenyi/work/blue-electron/packages/blue-java/pom.xml`
- [x] T021 [P] [US1] Add Java runtime artifact path resolution tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-path.test.ts`
- [x] T022 [P] [US1] Add Java runtime process spawn/shutdown tests with mocked child process in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-process.test.ts`
- [x] T023 [P] [US1] Add Java runtime client health-check tests with mocked ZMQ transport in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-client.test.ts`

### Implementation for User Story 1

- [x] T024 [US1] Set helper final artifact name and copy destination to `blue-java.jar` in `/Users/stevenyi/work/blue-electron/packages/blue-java/pom.xml`
- [x] T025 [US1] Add build dependency from app package to Java helper package in `/Users/stevenyi/work/blue-electron/packages/blue-app/package.json`
- [x] T026 [US1] Implement helper artifact resolution for dev and packaged layouts in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-path.ts`
- [x] T027 [US1] Implement Java executable detection and version probing in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-process.ts`
- [x] T028 [US1] Implement Java helper process spawn, endpoint allocation, auth token generation, and shutdown in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-process.ts`
- [x] T029 [US1] Implement JeroMQ control server health and shutdown handling in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/transport/JeroMqRuntimeServer.java`
- [x] T030 [US1] Implement TS ZMQ runtime client request queue, timeouts, connect, health, and disconnect in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-client.ts`
- [x] T031 [US1] Wire Java runtime session ownership into Electron main lifecycle in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`

**Checkpoint**: User Story 1 is independently testable as a packaged optional helper with health-check lifecycle.

---

## Phase 4: User Story 2 - Evaluate Clojure Objects with Project-Scoped State (Priority: P1)

**Goal**: Make ClojureObject first-class and evaluate Clojure code through a persistent project-scoped Java helper session.

**Independent Test**: Load a project where one Clojure object defines a function and a later Clojure object calls it, then generate/test score output successfully.

### Tests for User Story 2

- [x] T032 [P] [US2] Add JUnit Clojure session persistence tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/clojure/ClojureSessionTest.java`
- [x] T033 [P] [US2] Add JUnit Clojure reinitialize tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/clojure/ClojureReinitializeTest.java`
- [x] T034 [P] [US2] Add JUnit Clojure score-object binding tests for score, blueDuration, and blueProjectDir in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/clojure/ClojureScoreObjectEvaluationTest.java`
- [x] T035 [P] [US2] Add Vitest async ClojureObject generation tests using a mocked Java runtime in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/clojure-object-runtime.test.ts`
- [x] T036 [P] [US2] Add Electron main score-object test coverage for ClojureObject runtime delegation in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/score-object-test.test.ts`
- [x] T037 [P] [US2] Add ClojureObject editor document tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/score-object-editor-document.test.ts`

### Implementation for User Story 2

- [x] T038 [US2] Port the Java Blue Clojure engine core into `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/clojure/ClojureEngine.java`
- [x] T039 [US2] Implement helper-side ClojureSession and project session ownership in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/clojure/ClojureSession.java` and `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/session/ProjectSession.java`
- [x] T040 [US2] Implement `session.init`, `clojure.eval`, `clojure.evalScoreObject`, and `clojure.reinitialize` routing in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/transport/JeroMqRuntimeServer.java`
- [x] T041 [US2] Implement Clojure output and exception capture in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/errors/ClojureEvaluationException.java`
- [x] T042 [US2] Add TS Clojure runtime client methods in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-client.ts`
- [x] T043 [US2] Add async CSD render/test support for Java-backed sound objects in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [x] T044 [US2] Add async score/layer traversal for Java-backed objects in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/score.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/poly-object.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/sound-layer.ts`
- [x] T045 [US2] Implement ClojureObject async generation, parsing, time behavior, and note processor application in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/clojure-object.ts`
- [x] T046 [US2] Wire ClojureObject editor language, text patches, and test action support in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T047 [US2] Wire Electron main project open/new/revert flows to run Clojure on-load processing when Java runtime is available in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T048 [US2] Update playback, generated CSD, disk export, and score-object test paths to use async Java-aware rendering in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/csd-export.ts`

**Checkpoint**: User Story 2 supports first-class ClojureObject load/edit/test/render behavior with persistent project namespace state.

---

## Phase 5: User Story 3 - Preserve Project Directory Behavior (Priority: P1)

**Goal**: Ensure saved project folder CWD behavior matches Java Blue for relative file/script access.

**Independent Test**: Open a saved project whose Clojure code reads a relative file from the project folder and verify generated notes use that file.

### Tests for User Story 3

- [x] T049 [P] [US3] Add runtime process saved-project CWD tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-process.test.ts`
- [x] T050 [P] [US3] Add runtime lifecycle tests for open, close, revert, and save-as path changes in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-session.test.ts`
- [ ] T051 [P] [US3] Add JUnit relative file resolution test in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/clojure/ClojureProjectDirectoryTest.java`
- [ ] T052 [P] [US3] Add integration-style Clojure relative file fixture test in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/clojure-project-directory.test.ts`

### Implementation for User Story 3

- [x] T053 [US3] Implement project directory resolution and unsaved-project fallback in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-session.ts`
- [x] T054 [US3] Ensure helper process spawn uses the active project directory as `cwd` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-process.ts`
- [x] T055 [US3] Pass project directory metadata into `session.init` and Clojure bindings in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-client.ts`
- [x] T056 [US3] Restart or invalidate helper sessions on project close, project replace, revert, and save-as path changes in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T057 [US3] Preserve Java Blue `blueProjectDir` semantics for saved and unsaved projects in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/clojure-object.ts`

**Checkpoint**: User Story 3 proves project-relative Clojure file access uses the project folder rather than app or shell CWD.

---

## Phase 6: User Story 4 - Surface Runtime Status and Errors (Priority: P2)

**Goal**: Provide clear availability, startup, dependency, evaluation, timeout, output, and process-exit diagnostics.

**Independent Test**: Trigger representative Java-missing, helper-missing, dependency, evaluation, timeout, and crash failures and verify structured diagnostics reach users.

### Tests for User Story 4

- [ ] T058 [P] [US4] Add Java runtime structured error mapping tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-errors.test.ts`
- [ ] T059 [P] [US4] Add helper-side malformed request, auth failure, and evaluation failure tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/protocol/RuntimeErrorTest.java`
- [ ] T060 [P] [US4] Add Java runtime timeout and unexpected-exit tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-process.test.ts`
- [x] T061 [P] [US4] Add renderer/main status display tests for unavailable Java processing in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/clojure-object-editor.test.tsx`
- [ ] T062 [P] [US4] Add Clojure dependency metadata loading failure tests in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/clojure/ClojureLibraryLoaderTest.java`

### Implementation for User Story 4

- [ ] T063 [US4] Implement stable runtime error codes and mapping in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-errors.ts`
- [x] T064 [US4] Implement helper auth validation, malformed-request responses, and structured error envelopes in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/transport/JeroMqRuntimeServer.java`
- [ ] T065 [US4] Implement process timeout handling, suspect-process invalidation, and restart path in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-process.ts`
- [x] T066 [US4] Implement ClojureProjectData dependency extraction in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/plugins/clojure-project-data.ts`
- [x] T067 [US4] Implement helper-side dependency loading with Pomegranate in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/clojure/ClojureLibraryLoader.java`
- [x] T068 [US4] Surface Java runtime status and errors through preload/main IPC in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/preload.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T069 [US4] Add renderer status affordance or unavailable-state messaging for Java-dependent Clojure actions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/ClojureObjectEditor.tsx`

**Checkpoint**: User Story 4 makes Java runtime failures explicit and recoverable without losing project data.

---

## Phase 7: User Story 5 - Prepare for Future Jython Support (Priority: P3)

**Goal**: Keep shared helper lifecycle, protocol, and app bridge reusable for future Jython execution.

**Independent Test**: Review package layout and add tests/docs proving runtime dispatch, resources, and TS interfaces are not Clojure-only.

### Tests for User Story 5

- [ ] T070 [P] [US5] Add helper runtime method dispatch tests with a non-Clojure placeholder method in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/test/java/com/kunstmusik/bluejava/protocol/RuntimeMethodDispatchTest.java`
- [ ] T071 [P] [US5] Add TS runtime protocol extensibility tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/java-runtime/java-runtime-protocol.test.ts`

### Implementation for User Story 5

- [ ] T072 [US5] Add shared runtime engine/session interfaces that Clojure implements in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/java/com/kunstmusik/bluejava/session/`
- [x] T073 [US5] Keep future Jython resource placeholder and README guidance in `/Users/stevenyi/work/blue-electron/packages/blue-java/src/main/resources/jython/.gitkeep` and `/Users/stevenyi/work/blue-electron/packages/blue-java/README.md`
- [x] T074 [US5] Document future Jython extension points in `/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/quickstart.md`

**Checkpoint**: User Story 5 leaves concrete extension points for PythonObject, PythonInstrument, and PythonProcessor work.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup after selected user stories are complete.

- [x] T075 [P] Update feature documentation with implementation discoveries in `/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/`
- [x] T076 [P] Update package documentation for Java runtime behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/README.md`
- [x] T077 Run `pnpm --filter @blue/java-runtime test` from `/Users/stevenyi/work/blue-electron`
- [x] T078 Run `pnpm --filter @blue/java-runtime build` from `/Users/stevenyi/work/blue-electron`
- [x] T079 Run `pnpm --filter @blue/data test` from `/Users/stevenyi/work/blue-electron`
- [x] T080 Run `pnpm --filter @blue/app test` from `/Users/stevenyi/work/blue-electron`
- [x] T081 Run `pnpm --filter @blue/app build` from `/Users/stevenyi/work/blue-electron`
- [x] T082 Run `git diff --check` from `/Users/stevenyi/work/blue-electron`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational. This is the MVP because it proves build, packaging, launch, and health lifecycle.
- **US2 (Phase 4)**: Depends on US1 for helper process/client lifecycle and on Foundational ClojureObject data models.
- **US3 (Phase 5)**: Depends on US1 and should complete before relying on project-relative Clojure behavior in real projects.
- **US4 (Phase 6)**: Depends on US1 and US2 because diagnostics span startup, transport, dependency loading, and evaluation.
- **US5 (Phase 7)**: Depends on Foundational and can run after US1 protocol shapes stabilize.
- **Polish (Phase 8)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational; produces helper artifact and runtime lifecycle.
- **US2 (P1)**: Requires US1 helper/client lifecycle and foundational ClojureObject models.
- **US3 (P1)**: Requires US1 process lifecycle and informs US2 real-project behavior.
- **US4 (P2)**: Requires US1 and US2 for meaningful diagnostics.
- **US5 (P3)**: Can start after Foundational but should finalize after US1/US2 reveal protocol needs.

### Parallel Opportunities

- Setup tasks T002-T005 can run in parallel after T001 creates the package directory.
- Foundational tests T006-T010 can run in parallel.
- US1 tests T020-T023 can run in parallel before US1 implementation.
- US2 JUnit tests T032-T034 can run in parallel with Vitest tests T035-T037.
- US3 tests T049-T052 can run in parallel.
- US4 tests T058-T062 can run in parallel.
- US5 tests T070-T071 can run in parallel.
- Documentation tasks T075-T076 can run in parallel with final validation command preparation.

## Parallel Example: User Story 1

```text
Task: "Add Java runtime artifact path resolution tests in packages/blue-app/src/main/java-runtime/java-runtime-path.test.ts"
Task: "Add Java runtime process spawn/shutdown tests with mocked child process in packages/blue-app/src/main/java-runtime/java-runtime-process.test.ts"
Task: "Add Java runtime client health-check tests with mocked ZMQ transport in packages/blue-app/src/main/java-runtime/java-runtime-client.test.ts"
```

## Parallel Example: User Story 2

```text
Task: "Add JUnit Clojure session persistence tests in packages/blue-java/src/test/java/com/kunstmusik/bluejava/clojure/ClojureSessionTest.java"
Task: "Add Vitest async ClojureObject generation tests using a mocked Java runtime in packages/blue-data/src/sound-objects/clojure-object-runtime.test.ts"
Task: "Add Electron main score-object test coverage for ClojureObject runtime delegation in packages/blue-app/src/main/clojure-score-object-test.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundational protocol and Clojure data models.
3. Complete Phase 3 User Story 1.
4. Stop and validate helper build, copy, launch, health, and shutdown.

### Incremental Delivery

1. Setup + Foundational: package skeleton, protocol, Clojure XML models.
2. US1: optional helper artifact and lifecycle.
3. US2: project-scoped Clojure evaluation and async render/test integration.
4. US3: project-folder CWD parity and lifecycle invalidation.
5. US4: diagnostics and dependency loading.
6. US5: Jython extension readiness.

### Risk Focus

- Resolve async CSD rendering shape before broad runtime integration.
- Keep `@blue/data` pure and avoid accidental Node/process imports.
- Verify JeroMQ TCP loopback behavior before committing to event socket complexity.
- Do not minimize the shaded JAR.
- Treat user Clojure code as trusted project code and avoid promising sandbox behavior.
