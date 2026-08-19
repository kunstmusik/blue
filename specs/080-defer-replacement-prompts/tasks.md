# Tasks: Deferred Project-Replacement Save Prompts

**Input**: Design documents from specs/080-defer-replacement-prompts/

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/,
quickstart.md

**Verification**: Tasks include focused flow, host-path, runtime/IPC, renderer, Java
parity, state-ownership, failure-recovery, and quickstart validation required by the
constitution and plan.

**Organization**: Tasks are grouped by the four user stories in spec.md. User Story 1
is the MVP; User Stories 1 and 2 are both P1.

## Phase 1: Setup (Shared Regression Harness)

**Purpose**: Establish focused tests for the two new seams before wiring application
entry points.

- [X] T001 [P] Add platform-specific canonical project path cases, including synthetic Windows paths and missing targets, in packages/blue-app/src/main/project-path.test.ts
- [X] T002 [P] Add dependency-injected replacement-flow schedule, cancellation, no-op, and commit-gating cases in packages/blue-app/src/main/project-replacement-flow.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide the shared path, flow, preparation, installation, and save-result
contracts required by every interactive replacement story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Implement the reusable platform-aware canonical project identity helper using native path implementations, resolve/normalize behavior, and Windows case rules in packages/blue-app/src/main/project-path.ts
- [X] T004 Implement the dependency-injected replacement coordinator with preflight, preparation cancellation, no-op, commit re-check, save/library confirmation, and single-commit guarantees in packages/blue-app/src/main/project-replacement-flow.ts
- [X] T005 Split project read/parse from project installation, add prepared-target and accepted-replacement adapters, and keep loadProjectFromDisk non-interactive for revert and packaged verification in packages/blue-app/src/main/main.ts
- [X] T006 Make the main-process save/write primitives return explicit success, keep Save As path assignment transactional, and expose cancellation/failure as a blocking result for replacement in packages/blue-app/src/main/main.ts

**Checkpoint**: The application has testable replacement sequencing, platform-safe
same-file identity, non-interactive internal loads, and reliable save outcomes.

---

## Phase 3: User Story 1 - Open a project after confirming the source (Priority: P1) 🎯 MVP

**Goal**: Open Project, keyboard/preload open, recent projects, and examples all defer
replacement decisions until a selected project is prepared, while same-file selection
is a no-op.

**Independent Test**: With a current project open, cancel each chooser and verify no
save/library prompt or mutation; select another valid project and verify decisions
occur once after preparation; select the current project through an equivalent path
and verify no reload or lifecycle event.

### Verification for User Story 1

- [X] T007 [US1] Add table-driven Open Project cases for native-menu, keyboard/preload, chooser cancellation, accepted selection, malformed target, same-file canonical identity, and render-blocked preflight/commit in packages/blue-app/src/main/project-replacement-flow.test.ts
- [X] T008 [P] [US1] Extend renderer entry-routing assertions for project-store keyboard open, settings-store recent open, and welcome-screen recent selection in packages/blue-app/src/renderer/tests/app.test.ts and packages/blue-app/src/renderer/tests/welcome-screen.test.tsx

### Implementation for User Story 1

- [X] T009 [US1] Move regular Open Project confirmation behind chooser selection and prepared .blue parsing, remove the native-menu early prompt, and install only through the accepted replacement coordinator in packages/blue-app/src/main/main.ts
- [X] T010 [US1] Route open-file-path, recent-project, and Open Example Project through the same accepted-target coordinator, canonical same-file no-op, and replacement lifecycle while removing duplicate prompts from IPC and menu wrappers in packages/blue-app/src/main/main.ts

**Checkpoint**: All regular project-entry paths are cancellation-safe and share one
accepted-target replacement policy; this is the MVP increment.

---

## Phase 4: User Story 2 - Import files without prompting before all choices are complete (Priority: P1)

**Goal**: Defer CSD and ORC/SCO replacement decisions until every source and import
mode choice is accepted and conversion succeeds.

**Independent Test**: Cancel the CSD chooser, CSD mode, ORC chooser, SCO chooser, and
ORC/SCO mode independently; verify no replacement prompt or project mutation. Accept
valid imports and verify save/library decisions occur once immediately before commit.

### Verification for User Story 2

- [X] T011 [US2] Add CSD and ORC/SCO cancellation, conversion failure, accepted-target, library-draft, and single-commit matrix cases in packages/blue-app/src/main/project-replacement-flow.test.ts

### Implementation for User Story 2

- [X] T012 [US2] Reorder CSD import to chooser, mode selection, read/convert preparation, accepted replacement confirmation, and existing project installation lifecycle in packages/blue-app/src/main/main.ts
- [X] T013 [US2] Reorder ORC/SCO import to ORC chooser, SCO chooser, mode selection, pair read/convert preparation, accepted replacement confirmation, and existing project installation lifecycle in packages/blue-app/src/main/main.ts

**Checkpoint**: CSD and ORC/SCO imports cannot prompt before a cancellable source or
mode choice is complete, and successful imports retain their existing unsaved-project
semantics.

---

## Phase 5: User Story 3 - Keep MIDI import cancellation-safe (Priority: P2)

**Goal**: Preserve MIDI's deferred mapping workflow while applying the shared
replacement boundary only after valid mapping settings produce a prepared project.

**Independent Test**: Cancel MIDI file selection, cancel mapping, and cancel the
replacement decision after Import; verify the current project remains unchanged and
the mapping dialog remains available after replacement cancellation.

### Verification for User Story 3

- [X] T014 [P] [US3] Extend MIDI service regression cases for chooser cancellation, pending-session retention, stale-session rejection, and no read/parse before selection in packages/blue-app/src/main/midi-import-service.test.ts
- [X] T015 [P] [US3] Extend renderer MIDI dialog cases for mapping cancellation and replacement-decision cancellation preserving the mapping session in packages/blue-app/src/renderer/tests/midi-import-dialog.test.tsx
- [X] T016 [US3] Add the MIDI accepted-target, save/library cancellation, revalidation, and exactly-once commit matrix to packages/blue-app/src/main/project-replacement-flow.test.ts

### Implementation for User Story 3

- [X] T017 [US3] Keep MIDI start render-gated before the chooser and route commit-midi-import through prepared project construction, the shared accepted replacement coordinator, post-prompt token revalidation, and existing installation lifecycle in packages/blue-app/src/main/main.ts and packages/blue-app/src/main/midi-import-service.ts

**Checkpoint**: MIDI remains preview-first and cancellation-safe while sharing the
same main-process replacement timing as the other import paths.

---

## Phase 6: User Story 4 - Preserve projects when replacement cannot complete (Priority: P2)

**Goal**: Make Save, Don't Save, Cancel, Save As cancellation, overwrite decline, save
failure, library-draft cancellation, and render-blocked replacement transactional.

**Independent Test**: Exercise each decision across Open, CSD, ORC/SCO, and MIDI;
simulate Save As cancellation and write failure; verify current document, path, dirty
state, session, editors, and pending MIDI configuration remain recoverable.

### Verification for User Story 4

- [X] T018 [US4] Add save/discard/cancel, Save As cancellation, overwrite decline, write failure, current-path stability, and no-project cases to packages/blue-app/src/main/project-replacement-flow.test.ts
- [X] T019 [US4] Add assertions for library-draft timing, render preflight and commit re-check, no duplicate replacement decisions, unchanged project snapshots, and no prompt state entering .blue data in packages/blue-app/src/main/project-replacement-flow.test.ts

### Implementation for User Story 4

- [X] T020 [US4] Route the new-file IPC handler through the existing immediate New Project confirmation wrapper and preserve immediate Close, Revert, and Quit confirmation behavior while keeping internal verification non-interactive in packages/blue-app/src/main/main.ts
- [X] T021 [US4] Integrate the explicit save result into confirmSaveBeforeReplace so replacement proceeds only after durable Save or Save As success and preserves the recovery session after cancellation or failure in packages/blue-app/src/main/main.ts

**Checkpoint**: Every replacement decision branch either commits exactly once or leaves
the current project and transient configuration available for recovery.

---

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Complete parity, boundary, documentation, and package validation.

- [X] T022 [P] Verify native menu labels, accelerators, loaded-project gating, and handler routing remain unchanged while the handlers delegate to the new main-process policy in packages/blue-app/src/main/application-menu.test.ts
- [X] T023 [P] Update the manual scenario matrix and implementation references after the final entry-point wiring in specs/080-defer-replacement-prompts/quickstart.md and specs/080-defer-replacement-prompts/contracts/replacement-flow.md
- [X] T024 Run the focused @blue/app tests, main build, quickstart scenarios, and git diff validation recorded in specs/080-defer-replacement-prompts/quickstart.md
- [X] T025 [P] Compare completed project/import ordering and lifecycle behavior with the Java references in specs/080-defer-replacement-prompts/research.md and preserve existing @blue/data compatibility fixtures in packages/blue-data/src/blue-data-csd-parity.test.ts and packages/blue-data/src/blue-data-root-compatibility.test.ts
- [X] T026 Run the full repository test and lint commands and record any scoped exception in specs/080-defer-replacement-prompts/quickstart.md

---

## Dependencies and Execution Order

### Phase Dependencies

- Setup (Phase 1): T001 and T002 can run in parallel; they establish independent test
  files and have no implementation dependency.
- Foundational (Phase 2): T003 depends on T001, T004 depends on T002, and T005 depends
  on T003 and T004. T006 follows T005 because both define main.ts replacement seams.
- User Stories: US1, US2, US3, and US4 depend on the complete foundational phase.
  They are behaviorally separable, but main.ts edits should be serialized when handled
  by one developer.
- Polish (Phase 7): Depends on all desired user stories and their focused tests.

### User Story Dependencies

- User Story 1 (P1): Starts after Phase 2; no dependency on another story. MVP.
- User Story 2 (P1): Starts after Phase 2; uses the shared coordinator but is independently
  testable from Open Project.
- User Story 3 (P2): Starts after Phase 2; preserves the existing MidiImportService
  token contract and does not require CSD/ORC/SCO changes.
- User Story 4 (P2): Starts after Phase 2; verifies shared save/library/render semantics
  across the other stories.

### Parallel Opportunities

- T001 and T002 can run in parallel.
- After Phase 2, T008 can run in parallel with the main-process Open implementation.
- T014 and T015 can run in parallel because they touch separate MIDI test surfaces.
- T022 and T023 can run in parallel after implementation stabilizes.
- Different story test design can proceed in parallel, but concurrent edits to
  packages/blue-app/src/main/main.ts should be avoided.

## Parallel Example: User Story 1

~~~
Task: "Add the Open Project entry-path matrix in packages/blue-app/src/main/project-replacement-flow.test.ts"
Task: "Extend renderer entry-routing assertions in packages/blue-app/src/renderer/tests/app.test.ts and packages/blue-app/src/renderer/tests/welcome-screen.test.tsx"
~~~

## Parallel Example: User Story 3

~~~
Task: "Extend MIDI service cancellation cases in packages/blue-app/src/main/midi-import-service.test.ts"
Task: "Extend MIDI dialog cancellation cases in packages/blue-app/src/renderer/tests/midi-import-dialog.test.tsx"
~~~

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1.
3. Run the independent Open Project matrix and @blue/app main build.
4. Stop for review/demo before adding CSD, ORC/SCO, MIDI, and cross-cutting branches.

### Incremental Delivery

1. Add User Story 2 and validate CSD/ORC/SCO cancellation and successful import.
2. Add User Story 3 and validate MIDI mapping/session preservation.
3. Add User Story 4 and validate save failure, library drafts, render gates, and
   no-picker routes.
4. Complete Phase 7 and run the full quickstart.

### Completion Criteria

All tasks are complete when the full entry-path x decision-branch matrix passes, the
affected package tests/build/lint checks pass, Java ordering remains documented, and
the quickstart confirms native chooser behavior without changes to .blue persistence.
