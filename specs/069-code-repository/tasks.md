# Tasks: Java-Compatible Code Repository Library

**Input**: Design documents from /specs/069-code-repository/

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/code-repository-ipc.md, and quickstart.md

**Implementation strategy**: Build the portable model and host boundary first, then deliver the
repository editor as the MVP, followed by migration hardening, Csound insertion, capture, and
export/recovery. Keep Code Repository outside the unified-library type system and keep .blue
project state untouched throughout.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the feature's files, programmatic empty-root initialization, and public module entry points.

- [X] T001 [P] Define first-run initialization as a programmatic empty protected root; do not add a packaged Code Repository default XML resource.
- [X] T002 [P] Add the Code Repository public exports to packages/blue-data/src/index.ts and define the shared application module entry at packages/blue-app/src/shared/code-repository.ts.
- [X] T003 [P] Add the feature's focused test file locations and fixture naming conventions in packages/blue-data/src/libraries/code-repository-codec.test.ts and packages/blue-app/src/main/code-repository/.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement portable data, persistence invariants, migration state, and typed host
contracts required by every user story.

**CRITICAL**: Complete this phase before user-story implementation.

- [X] T004 [P] Define CodeRepositoryDocument, root/group/snippet node types, validation errors, and tree invariants in packages/blue-data/src/libraries/code-repository.ts.
- [X] T005 Implement the Java-compatible customAccelerators/customGroup/customAccelerator XML parser and serializer using the repository XML utilities in packages/blue-data/src/libraries/code-repository-codec.ts.
- [X] T006 Add codec regression fixtures and tests for Java-compatible XML, nested mixed children, duplicate names, Unicode, XML escaping, empty snippets, exact whitespace, malformed XML, and unsupported elements in packages/blue-data/src/libraries/code-repository-codec.test.ts.
- [X] T007 Define the dedicated SQLite schema, schema version, root invariants, indexes, and transactional ordering rules in packages/blue-app/src/main/code-repository/schema.ts.
- [X] T008 Implement the worker-backed SQLite repository/client boundary for snapshot reads, atomic tree replacement, node CRUD, move/reorder, revision increments, and rollback in packages/blue-app/src/main/code-repository/repository.ts, packages/blue-app/src/main/code-repository/repository-client.ts, and packages/blue-app/src/main/code-repository/repository-worker.ts.
- [X] T009 Implement migration-state, health-check, backup, and recovery records for blue-code-repository-state.json in packages/blue-app/src/main/code-repository/migration-state-store.ts and packages/blue-app/src/main/code-repository/recovery.ts.
- [X] T010 Define serializable snapshots, mutation requests, import/export results, change events, and stable error codes in packages/blue-app/src/shared/code-repository.ts and cover them with packages/blue-app/src/shared/code-repository.test.ts.
- [X] T011 Register validated Code Repository IPC handlers and preload methods for snapshot, mutations, status, import/export, and change events in packages/blue-app/src/main/code-repository/ipc.ts and packages/blue-app/src/preload/preload.ts.
- [X] T012 Initialize the service from Electron startup with app.getPath('userData')/blue_code_repository.sqlite, isolated migration state, and failure isolation from unified libraries in packages/blue-app/src/main/main.ts and packages/blue-app/src/main/code-repository/service.ts.

**Checkpoint**: Portable parsing, database persistence, typed IPC, and recoverable service startup
are independently testable before renderer work begins.

## Phase 3: User Story 1 - Manage Reusable Csound Code (Priority: P1) MVP

**Goal**: Deliver a split-pane Code Repository Editor with ordered tree CRUD, snippet editing,
atomic Save/Cancel, and durable persistence.

**Independent Test**: Open the Tools dialog, create nested groups and snippets, edit/reorder them,
save, restart, and verify the same tree and code; repeat with Cancel and verify no changes persist.

### Verification for User Story 1

- [X] T013 [P] [US1] Add repository service tests for snapshot loading, atomic draft commit, root protection, duplicate names, mixed ordering, move-cycle rejection, rollback, restart persistence, and stale revision conflicts in packages/blue-app/src/main/code-repository/service.test.ts.
- [X] T014 [P] [US1] Add renderer store tests for loading snapshots, tracking dirty drafts, handling Save/Cancel, applying change events, and surfacing revision conflicts in packages/blue-app/src/renderer/tests/code-repository-store.test.ts.
- [X] T015 [P] [US1] Add component tests for group/snippet selection, inline rename, add/remove actions, drag/drop ordering, snippet editing, dirty dismissal, and Save/Cancel in packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.test.tsx.

### Implementation for User Story 1

- [X] T016 [US1] Implement CodeRepositoryService snapshot, CRUD, draft-commit, validation, revision, and change-notification methods in packages/blue-app/src/main/code-repository/service.ts.
- [X] T017 [P] [US1] Implement the renderer codeRepositoryStore for canonical snapshots, local drafts, dirty state, revision-conflict handling, and change-event refresh in packages/blue-app/src/renderer/stores/code-repository-store.ts.
- [X] T018 [P] [US1] Implement the ordered group/snippet tree with root protection, inline rename, add/remove actions, and drag/drop cycle guards using existing tree patterns in packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryTree.tsx.
- [X] T019 [P] [US1] Implement the selected-snippet editor using the existing CodeMirror editor surface and preserve exact code text in packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositorySnippetEditor.tsx.
- [X] T020 [US1] Compose the split-pane manager dialog with Save, Cancel, dirty-close handling, revision-conflict recovery, and import/export controls in packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.tsx.
- [X] T021 [US1] Route the Tools menu Code Repository Editor item to the renderer dialog and remove the placeholder callback in packages/blue-app/src/main/application-menu.ts, packages/blue-app/src/main/main.ts, and packages/blue-app/src/renderer/App.tsx.

**Checkpoint**: User Story 1 is a shippable repository editor and the MVP demonstration can be
validated without a project-specific data change.

## Phase 4: User Story 2 - Migrate and Preserve an Existing Repository (Priority: P1)

**Goal**: Import current and historical Java repository XML safely, initialize new installations
empty, preserve source files, and expose recoverable migration status.

**Independent Test**: Run with disposable profiles containing valid, missing, malformed, and
historical XML; verify exact valid migration, empty first-run initialization, idempotency,
diagnostics, and source preservation.

### Verification for User Story 2

- [X] T022 [P] [US2] Add migration fixtures for ~/.blue/codeRepository.xml, historical custom.xml, missing source, malformed source, unsupported elements, duplicate source hashes, and empty first-run initialization in packages/blue-app/src/main/code-repository/service.test.ts and packages/blue-app/src/main/code-repository/ipc.test.ts.
- [X] T023 [P] [US2] Add service recovery and failure-isolation tests proving invalid migration or unavailable Code Repository storage does not block project or unified-library startup in packages/blue-app/src/main/code-repository/service.test.ts.

### Implementation for User Story 2

- [X] T024 [US2] Implement first-run discovery of ~/.blue/codeRepository.xml, whole-document validation, source hashing, one-transaction import, idempotency, and immutable-source handling in packages/blue-app/src/main/code-repository/service.ts.
- [X] T025 [US2] Implement programmatic empty-root initialization when no legacy source exists; retain historical seed-provenance fields only so databases created by earlier builds remain readable.
- [X] T026 [US2] Implement explicit XML file selection/import, diagnostics, and recovery actions without exposing filesystem access to the renderer in packages/blue-app/src/main/code-repository/ipc.ts and packages/blue-app/src/main/code-repository/service.ts.
- [X] T027 [US2] Add migration status, retry, import, and recovery controls to the repository dialog in packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.tsx.
- [X] T028 [US2] Complete migration, source-preservation, empty-initialization, explicit-import, and failure-isolation assertions in packages/blue-app/src/main/code-repository/service.test.ts, packages/blue-app/src/main/code-repository/ipc.test.ts, and packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.test.tsx.

**Checkpoint**: Existing Java Blue users can upgrade without source mutation, silent loss, or
duplicate imports, and a fresh installation receives an empty protected root.

## Phase 5: User Story 3 - Insert Repository Snippets from a Csound Editor (Priority: P2)

**Goal**: Replace the disabled Custom editor menu with a dynamic repository hierarchy that inserts
snippet code at the cursor or selection.

**Independent Test**: Open a Csound editor, select text, choose a nested Custom snippet, and verify
that exact code replaces the selection while ordinary editor commands remain functional.

### Verification for User Story 3

- [X] T029 [P] [US3] Add menu-model tests for recursive group mapping, snippet ordering, empty repositories, and repository refresh in packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-menu.test.ts.
- [X] T030 [P] [US3] Add context-menu tests for cursor insertion, selection replacement, focus preservation, empty repository state, and storage-error fallback in packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-menu.test.ts and packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts.

### Implementation for User Story 3

- [X] T031 [US3] Replace the disabled Custom item with a recursively generated repository submenu and stable snippet insertion items in packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-menu.ts.
- [X] T032 [US3] Extend the editor menu item/command contract and render repository insertion actions through the existing CodeMirror insertion seam in packages/blue-app/src/renderer/components/workbench/panels/editors/editor-adapter-types.ts and packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.tsx.
- [X] T033 [US3] Refresh repository-backed editor menu state after change events without replacing the active editor document in packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-actions.ts, and packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-menu.ts.

**Checkpoint**: Repository snippets are available from every Csound editor without entering
project patch or .blue persistence flows.

## Phase 6: User Story 4 - Add Selected Editor Code to the Repository (Priority: P2)

**Goal**: Enable selected Csound text to be named and saved into any nested repository group.

**Independent Test**: Select non-empty editor text, choose Add to Code Repository, select a nested
group, save, and verify exact text from the Custom menu; verify the action is unavailable with no
selection.

### Verification for User Story 4

- [X] T034 [P] [US4] Add selection-state and add-flow tests for non-empty/empty selections, nested group destinations, duplicate names, exact whitespace, cancellation, and successful insertion in packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts and packages/blue-app/src/renderer/components/workbench/panels/code-repository/AddToCodeRepositoryDialog.test.tsx.
- [X] T035 [P] [US4] Add IPC/service tests for atomic snippet creation, expected-revision conflicts, invalid parent rejection, and exact code preservation in packages/blue-app/src/main/code-repository/service.test.ts.

### Implementation for User Story 4

- [X] T036 [US4] Implement the Add to Code Repository dialog with arbitrary nested-group selection, name validation, cancel behavior, and new-snippet initial text in packages/blue-app/src/renderer/components/workbench/panels/code-repository/AddToCodeRepositoryDialog.tsx.
- [X] T037 [US4] Enable Add to Code Repository only for non-empty editable selections, preserve the right-click selection, and dispatch atomic snippet creation through the typed bridge in packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-actions.ts and packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.tsx.
- [X] T038 [US4] Wire newUserDefaultsEnabled to the Java-compatible new-snippet placeholder behavior and update its usage coverage in packages/blue-app/src/main/program-settings-usage.ts, packages/blue-app/src/shared/program-settings.ts, and the Code Repository dialog tests.

**Checkpoint**: Users can collect exact editor selections into nested repository groups and use
them immediately from the Csound Custom menu.

## Phase 7: User Story 5 - Export and Recover Repository Content (Priority: P3)

**Goal**: Provide explicit Java-compatible XML export and actionable recovery when repository
storage is unavailable.

**Independent Test**: Export a populated repository, import the result into an empty profile,
compare tree/code content, then simulate storage failure and recover without affecting projects.

### Verification for User Story 5

- [X] T039 [P] [US5] Add export round-trip tests for nested mixed ordering, duplicate names, Unicode, XML escaping, empty snippets, and exact code text in packages/blue-data/src/libraries/code-repository-codec.test.ts, packages/blue-app/src/main/code-repository/service.test.ts, and packages/blue-app/src/main/code-repository/ipc.test.ts.
- [X] T040 [P] [US5] Add repository recovery UI/contract tests for unavailable database, preserved diagnostics, retry, and explicit valid-source recovery in packages/blue-app/src/main/code-repository/service.test.ts, packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.test.tsx, and packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryEditorModal.test.tsx.

### Implementation for User Story 5

- [X] T041 [US5] Implement Java-compatible XML export without UUIDs, revisions, or database provenance in packages/blue-app/src/main/code-repository/service.ts and packages/blue-data/src/libraries/code-repository-codec.ts.
- [X] T042 [US5] Add native export file selection and write failure handling in packages/blue-app/src/main/code-repository/ipc.ts.
- [X] T043 [US5] Add export and recovery actions, diagnostics, and retry states to packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.tsx.

**Checkpoint**: Users can move repository content through Java-compatible XML and recover from
repository-specific failures without losing project or unified-library availability.

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Complete parity documentation, remove deferred placeholders, and execute the
constitution-required validation.

- [X] T044 [P] Validate that Code Repository Editor, Custom browsing, and Add to Code Repository are reachable and tested; leave the external NOT_IMPLEMENTED_ACTIONS.md file untouched and out of this commit.
- [X] T045 [P] Add Java parity notes and user-facing repository migration/export documentation to specs/069-code-repository/quickstart.md and the relevant application documentation.
- [X] T046 [P] Review the Code Repository implementation against specs/069-code-repository/spec.md, specs/069-code-repository/plan.md, specs/069-code-repository/data-model.md, specs/069-code-repository/contracts/code-repository-ipc.md, and the Java reference files under ~/work/nbprojects/blue/.
- [X] T047 Run every scenario in specs/069-code-repository/quickstart.md with a disposable Electron user-data directory and record any scoped exception in specs/069-code-repository/quickstart.md.
- [X] T048 Run pnpm --filter @blue/data test, pnpm --filter @blue/app test, pnpm test, pnpm lint, pnpm --filter @blue/data build, and pnpm --filter @blue/app build; resolve or document all failures.

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No implementation dependencies; T001-T003 can run in parallel.
- Foundational (Phase 2): Depends on Setup; T004-T012 block all user stories.
- User Story 1 (Phase 3): Depends on Foundation; provides the MVP editor and service flows.
- User Story 2 (Phase 4): Core migration tasks depend on Foundation; dialog recovery controls depend on US1 dialog composition.
- User Story 3 (Phase 5): Depends on Foundation and US1 snapshot/store wiring.
- User Story 4 (Phase 6): Depends on US1 service/dialog and US3 editor selection/menu seams.
- User Story 5 (Phase 7): Export codec work depends on Foundation; recovery UI depends on US1 dialog and US2 migration state.
- Polish (Phase 8): Depends on all desired stories and their verification tasks.

### User Story Dependencies

- User Story 1 (P1): Can start after Phase 2; no other story dependency.
- User Story 2 (P1): Core migration can start after Phase 2; T027 depends on US1's dialog.
- User Story 3 (P2): Depends on US1's snapshot/store and typed bridge; no project document dependency.
- User Story 4 (P2): Depends on US1's repository mutation API and US3's editor selection/menu seam.
- User Story 5 (P3): Depends on Foundation; recovery UI integrates with US1/US2 surfaces.

### Within Each User Story

- Verification tasks may be written first and should fail or expose missing behavior before the
  implementation is considered complete.
- Portable models and codecs precede host services; host services precede preload; preload precedes
  renderer integration.
- Atomic persistence and revision checks precede UI Save/Cancel and editor capture.
- Each story must pass its independent test criteria before the next story is accepted.

### Parallel Opportunities

- T001-T003 can run in parallel.
- T004, T007, T009, and T010 can be split by boundary after the initial module paths are agreed.
- T013-T015 can run in parallel once the service and renderer contracts are stable.
- T017-T019 can run in parallel after T010/T011; T020/T021 compose them afterward.
- T022/T023 can run in parallel with US1 service tests after Foundation, while T024-T025 implement
  migration.
- T029/T030 can run in parallel before T031-T033.
- T034/T035 can run in parallel before T036-T038.
- T039/T040 can run in parallel before T041-T043.
- T044-T046 can run in parallel; T047-T048 are final validation.

## Parallel Example: User Story 1

~~~text
Task: Add repository service tests in packages/blue-app/src/main/code-repository/service.test.ts
Task: Add renderer store tests in packages/blue-app/src/renderer/tests/code-repository-store.test.ts
Task: Add dialog component tests in packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.test.tsx
~~~

## Parallel Example: User Story 2

~~~text
Task: Add migration fixtures in packages/blue-app/src/main/code-repository/service.test.ts
Task: Add IPC and failure-isolation tests in packages/blue-app/src/main/code-repository/ipc.test.ts
~~~

## Parallel Example: User Story 3

~~~text
Task: Add Csound menu-model tests in packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-menu.test.ts
Task: Add context-menu tests in packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts
~~~

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 and validate the split-pane editor independently.
3. Complete the automatic migration/empty-initialization core from US2 before calling the persistence MVP
   release-ready, because existing user data must not be put at risk.
4. Stop for a manual demo and run the focused tests before adding editor-menu integration.

### Incremental Delivery

1. Foundation: portable model, database, typed IPC, and recovery seam.
2. US1: repository manager MVP.
3. US2: Java-user migration and empty first-run initialization.
4. US3: browse/insert snippets from Csound editors.
5. US4: capture selected editor code.
6. US5: explicit XML export and recovery actions.
7. Polish: parity review, placeholder cleanup, quickstart, full validation.

### Parallel Team Strategy

After Phase 2, one developer can own US1 dialog/service work, another can own US2 migration, and a
third can own US3 editor integration. US4 should begin after the editor selection seam stabilizes;
US5 can proceed in parallel with US4 once the codec and recovery contracts are fixed.

## Notes

- Every task uses the required checkbox, sequential ID, optional [P] marker, story label where
  applicable, and an exact file path.
- Do not add Code Repository as a fifth unified-library LibraryType.
- Do not write repository snippets into .blue project XML.
- Keep .binstr Arrangement import/export out of this task set.

## Phase 9: Convergence

- [X] T049 CRITICAL add the dialog, migration, failure-isolation, context-menu, add-flow, import/export, recovery, and recorded quickstart/package validation evidence per Constitution V and T013-T048
- [X] T050 CRITICAL move explicit XML file selection and reading from the renderer into validated main/preload IPC while preserving cancel and source diagnostics per Constitution I/III and plan: filesystem ownership
- [X] T051 CRITICAL validate Code Repository success and failure payloads at the preload/renderer boundary instead of relying on unchecked casts per Constitution III and plan: typed IPC boundary
- [X] T052 implement reachable inline group/snippet rename editing with non-empty validation and focused component coverage per FR-003 and US1/AC2
- [X] T053 enforce protected-root identity, non-empty mutation names, and contiguous sibling order after delete/move across repository and draft commits per FR-003 and FR-007
- [X] T054 make automatic migration and explicit import atomically commit the tree with provenance, consult successful source hashes, and distinguish unreadable sources from invalid XML per FR-008, FR-009, FR-010, and plan: migration transaction
- [X] T055 derive Add to Code Repository enablement from the live non-empty editable selection and cover the rendered context-menu behavior per FR-015 and US4/AC3
- [X] T056 initialize repository snapshots/change listeners and mount the add flow in every standalone renderer containing a Csound editor per FR-013, FR-016, and US3/AC3
- [X] T057 apply general.newUserDefaultsEnabled so newly created editor snippets use Java's "Insert your code here" placeholder only when enabled per FR-017
- [X] T058 wire migration diagnostics, service retry/reopen or valid-source recovery, and revision-conflict reload/preserve actions through service, IPC, store, and dialog per FR-018, US2/AC4, and US5/AC2
- [X] T059 reconcile or reset the active editor draft after a successful import so a later Save cannot silently overwrite the imported tree per FR-006 and FR-009
- [X] T060 reject unsupported or duplicate child elements inside customAccelerator and otherwise validate the complete supported Java XML structure per FR-009 and FR-010
- [X] T061 verify that first-run initialization has no packaged-resource dependency and that legacy migration failures remain isolated from application and unified-library startup per FR-018 and SC-006
- [X] T062 add deterministic 500-node editor and Custom-menu responsiveness validation with recorded thresholds/results per SC-007

### Phase 9 validation evidence (2026-08-10)

- `pnpm --filter @blue/data test` — 159 files / 1,491 tests passed.
- `pnpm --filter @blue/data build` — passed.
- `pnpm --filter @blue/app test` — 295 files / 2,722 tests passed, 2 skipped.
- `pnpm test` — passed for the full workspace (including the same data/app suites, native
  engine, Java runtime, engine client, CLI, and root script tests).
- `pnpm --filter @blue/app build` — passed (main, preload, and renderer bundles).
- `pnpm lint` — passed for all workspace lint scripts.
- `pnpm verify:package-inputs` — passed; Code Repository initialization has no packaged input
  requirement.
- `pnpm --filter @blue/app package:dir` — passed; the packaged app contains no Code Repository
  seed XML.
- `pnpm --filter @blue/app exec node scripts/verify-packaged-app.mjs --no-playwright` — the
  packaged binary exited with code 134 before emitting its success marker in this macOS session;
  the directory package and its resource contents were validated separately.
- `git -c core.fsmonitor=false diff --check` — passed.
- The deterministic 500-node editor and Custom-menu fixtures each passed their `< 1,000 ms` threshold.
