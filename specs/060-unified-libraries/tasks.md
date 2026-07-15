---

description: "Implementation tasks for Unified Libraries"
---

# Tasks: Unified Libraries

**Input**: Design documents from `/specs/060-unified-libraries/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and the contracts in [contracts/](./contracts/)

**Tests**: Required. The specification and constitution require test-first coverage for Java XML compatibility, reference identity, database transactions and recovery, project-copy semantics, editor-session conflicts, migration state, import/export rollback, exact Electron runtime support, accessibility, and the 10,000-item performance target.

**Organization**: Tasks are grouped by user story after the shared foundation. Each story includes an independent acceptance path and its failing tests before implementation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the exact runtime, module boundaries, fixtures, and deterministic test helpers required by the design.

- [X] T001 Pin Electron to exactly 35.7.5 and update the resolved lockfile entry in `packages/blue-app/package.json` and `pnpm-lock.yaml`.
- [X] T002 Add an exact-runtime smoke test for the required `node:sqlite` APIs and Electron/Node/SQLite versions in `packages/blue-app/src/main/unified-library/sqlite-runtime.test.ts` and wire it into `.github/workflows/ci.yml`.
- [X] T003 [P] Create the pure data-library module barrel and main-process unified-library module barrel in `packages/blue-data/src/libraries/index.ts` and `packages/blue-app/src/main/unified-library/index.ts`.
- [X] T004 [P] Add reusable Java-library XML corpus fixtures and isolated filesystem/database test helpers in `packages/blue-data/src/libraries/fixtures/legacy-library-corpus.ts` and `packages/blue-app/src/main/unified-library/test-helpers.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the raw-preserving codecs, stable identity rules, shared contracts, and worker-owned SQLite repository used by every user story.

**⚠️ CRITICAL**: No user-story implementation should begin until this phase is complete.

### Foundational Tests

> **Write these tests first and verify that they fail before implementing the corresponding behavior.**

- [X] T005 [P] Add failing tests for all four legacy library roots, recursive category order, item order, stable type IDs, and Java-compatible canonical output in `packages/blue-data/src/libraries/legacy-library-codec.test.ts`.
- [X] T006 [P] Add failing Unicode offset, byte/code-unit conversion, nested unsupported-fragment, known-field, external-entity, and code-execution safety tests in `packages/blue-data/src/libraries/raw-xml-document.test.ts`.
- [X] T007 [P] Add failing coverage proving legacy instrument imports can bypass runtime instrument-category registration without altering normal registry behavior in `packages/blue-data/src/instruments/instrument-category.test.ts`.
- [X] T008 [P] Add failing save/load/copy coverage for preserved or seeded Java-compatible shared SoundObject `objRefId` values and fingerprint fallback in `packages/blue-data/src/sound-objects/sound-object-library.test.ts` and `packages/blue-data/src/serialization/obj-ref-map.test.ts`.
- [X] T009 [P] Add failing DTO, discriminated-union, request-guard, cursor, phase/status, change-event, target-locator, and error-envelope contract tests in `packages/blue-app/src/shared/unified-library.test.ts`.
- [X] T010 [P] Add failing schema tests for the four roots, normalized nodes, payload revisions, store state, import batches/sources/changes, indexes, foreign keys, WAL, `synchronous=FULL`, busy timeout, and `user_version` in `packages/blue-app/src/main/unified-library/schema.test.ts`.
- [X] T011 [P] Add failing repository and worker-client lifecycle tests for atomic transactions, revision conflicts, stable UUIDs, lazy payload loading, worker isolation, serialized requests, error transfer, and deterministic shutdown in `packages/blue-app/src/main/unified-library/repository.test.ts` and `packages/blue-app/src/main/unified-library/repository-client.test.ts`.

### Foundational Implementation

- [X] T012 Implement library type descriptors, stable node/payload identities, raw document spans, Unicode-safe offset conversion, and unsupported-fragment metadata in `packages/blue-data/src/libraries/library-types.ts` and `packages/blue-data/src/libraries/raw-xml-document.ts`.
- [X] T013 Implement raw-first Java library parsing and canonical serialization for instruments, UDOs, SoundObjects, and effects in `packages/blue-data/src/libraries/legacy-library-codec.ts` and `packages/blue-data/src/libraries/library-payload-adapters.ts`.
- [X] T014 Preserve normal registry validation while adding the explicit legacy-import category path in `packages/blue-data/src/instruments/instrument-category.ts` and `packages/blue-data/src/instruments/instrument-registry.ts`.
- [X] T015 Preserve or seed stable shared SoundObject reference identities and implement deterministic fingerprint fallback in `packages/blue-data/src/serialization/obj-ref-map.ts` and `packages/blue-data/src/sound-objects/sound-object-library.ts`.
- [X] T016 Export the unified library types and codecs through `packages/blue-data/src/libraries/index.ts` and `packages/blue-data/src/index.ts` without Node built-ins, dynamic imports, or `require()`.
- [X] T017 Implement the validated renderer/preload/main contracts, phase/status snapshots, locators, cursors, mutation results, and change events in `packages/blue-app/src/shared/unified-library.ts`.
- [X] T018 Implement schema creation, version metadata, root seeding, pragmas, indexes, and transaction helpers in `packages/blue-app/src/main/unified-library/schema.ts`.
- [X] T019 Implement the normalized node/payload/store-state/import-history repository with UUID allocation, optimistic revisions, lazy payload reads, and atomic mutation primitives in `packages/blue-app/src/main/unified-library/repository.ts`.
- [X] T020 Implement the one-`DatabaseSync` worker protocol and Promise-based serialized client facade in `packages/blue-app/src/main/unified-library/repository-worker.ts` and `packages/blue-app/src/main/unified-library/repository-client.ts`.
- [X] T021 Implement the main-owned service shell, operation lease, read-only startup phases, validated IPC registration, preload facade, renderer typings, and app lifecycle composition in `packages/blue-app/src/main/unified-library/service.ts`, `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`.

**Checkpoint**: Pure codecs preserve supported and unsupported XML safely, shared contracts reject malformed traffic, and one main-process worker exclusively owns a transactional unified-library database.

---

## Phase 3: User Story 1 - Find And Preview Reusable Objects (Priority: P1) 🎯 MVP

**Goal**: Users can open one Libraries surface with or without a project, browse user and project sources across all four types, filter/search, and inspect lightweight previews and compatibility warnings.

**Independent Test**: Start with no project, browse and search all four user roots, then open a project and repeat across user/project scopes; confirm pagination, type focus, previews, unavailable fields, and nested unsupported-data warnings without opening an editor.

### Tests for User Story 1

- [X] T022 [P] [US1] Add failing repository/service tests for source and type filters, deterministic browse order, paginated search cursors, preview-only payload loading, and stale-cursor invalidation in `packages/blue-app/src/main/unified-library/browse-search.test.ts`.
- [X] T023 [P] [US1] Add failing project-adapter tests for read-only instrument, UDO, SoundObject, and effect composition, stable project locators, unsupported metadata, and no-project results in `packages/blue-app/src/main/unified-library/project-adapter.test.ts`.
- [X] T024 [P] [US1] Add failing store tests for source/type filters, debounced search, pagination, selection, lightweight preview caching, change-event refresh, and no-project state in `packages/blue-app/src/renderer/tests/library-store.test.ts`.
- [X] T025 [P] [US1] Add failing UI/workbench tests for the always-available Libraries component, standalone full-window Welcome surface, legacy layout-ID migration, keyboard tree navigation, accessible warnings, and no-project browsing in `packages/blue-app/src/renderer/tests/libraries-panel.test.tsx` and `packages/blue-app/src/renderer/tests/unified-library-workbench.test.tsx`.

### Implementation for User Story 1

- [X] T026 [US1] Implement deterministic folder browsing, indexed search, opaque cursors, preview summaries, scope/type filters, and cursor invalidation in `packages/blue-app/src/main/unified-library/repository.ts` and `packages/blue-app/src/main/unified-library/service.ts`.
- [X] T027 [US1] Implement read-only project-source composition and stable project locators for all four types in `packages/blue-app/src/main/unified-library/project-adapter.ts`.
- [X] T028 [US1] Expose browse, search, preview, status, and change subscriptions through `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`.
- [X] T029 [US1] Implement renderer query, pagination, selection, preview cache, event refresh, and no-project state in `packages/blue-app/src/renderer/stores/library-store.ts`.
- [X] T030 [P] [US1] Build the accessible recursive tree, search/filter controls, preview surface, unavailable-field states, and nested unsupported-data warnings in `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx`, `packages/blue-app/src/renderer/components/libraries/LibrarySearchBar.tsx`, and `packages/blue-app/src/renderer/components/libraries/LibraryPreview.tsx`.
- [X] T031 [US1] Register the right-side `LibrariesTopComponent`, connect the store-backed panel, migrate legacy `SoundObjectLibraryTopComponent` layout state, and route old Effects Library window actions in `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/DockviewPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts`, and `packages/blue-app/src/main/application-menu.ts`.
- [X] T032 [US1] Keep the workbench mounted without a project and render the standalone full-window Welcome surface over it while preserving current project panel behavior in `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx` and `packages/blue-app/src/renderer/App.tsx`.

**Checkpoint**: The unified Libraries surface is a usable no-project MVP and remains independently verifiable without insertion, editing, migration, or export features.

---

## Phase 4: User Story 2 - Insert The Right Kind Of Project Copy (Priority: P1)

**Goal**: Contextual project destinations open Libraries in the correct type/target mode and insert Java-compatible independent or shared project copies that remain valid after save/reopen without the user database.

**Independent Test**: For each type, open Libraries from a valid destination, insert an item, and verify the intended independent/shared semantics, time conversion, dependency handling, stale-target blocking, canonical project broadcast, save/reopen behavior, and operation with the user database unavailable.

### Tests for User Story 2

- [X] T033 [P] [US2] Add failing pure transfer tests for Instrument, UDO, Effect, independent SoundObject, shared SoundObject, deep-copy identity, dependency metadata, and score time conversion in `packages/blue-data/src/libraries/library-transfer.test.ts`.
- [X] T034 [P] [US2] Add failing main-process insertion-matrix tests for valid and stale targets, independent/shared copies, dependency rejection, canonical patch/broadcast, and save/reopen with the user database unavailable in `packages/blue-app/src/main/unified-library/project-transfer.test.ts`.
- [X] T035 [P] [US2] Add failing renderer tests for contextual target banners, type focus, destination changes, stale-target clearing, dependency errors, and insertion results in `packages/blue-app/src/renderer/tests/library-target-routing.test.tsx`.
- [X] T036 [P] [US2] Add failing route tests for Orchestra, UDO, Mixer, and Score entry points and replacement of embedded library pickers in `packages/blue-app/src/renderer/tests/library-context-entry-points.test.tsx`.

### Implementation for User Story 2

- [X] T037 [US2] Implement type-specific deep-copy, shared-reference identity, dependency descriptors, and score-time conversion helpers in `packages/blue-data/src/libraries/library-transfer.ts`.
- [X] T038 [US2] Extend project editor contracts with stable insertion targets, project-source locators, dependency choices, and atomic insertion patch results in `packages/blue-app/src/shared/project-editor.ts` and `packages/blue-app/src/shared/unified-library.ts`.
- [X] T039 [US2] Implement target validation, transfer previews, independent/shared insertion, dependency resolution, canonical project mutation, and snapshot broadcast in `packages/blue-app/src/main/unified-library/project-adapter.ts`.
- [X] T040 [US2] Expose set/clear target, preview transfer, and apply insertion operations with stale-target rejection in `packages/blue-app/src/main/unified-library/service.ts`, `packages/blue-app/src/main/unified-library/ipc.ts`, and `packages/blue-app/src/preload/preload.ts`.
- [X] T041 [US2] Add target lifecycle state, type locking, destination banners, dependency choices, insertion actions, and result reporting in `packages/blue-app/src/renderer/stores/library-store.ts` and `packages/blue-app/src/renderer/components/libraries/LibraryTargetBanner.tsx`.
- [X] T042 [US2] Route contextual browse actions from instrument arrangement, UDO, mixer effect chain, and score editors into the unified Libraries target mode in `packages/blue-app/src/renderer/components/workbench/panels/OrchestraPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/UserDefinedOpcodePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`.
- [X] T043 [US2] Replace temporary instrument and embedded effect-library selection behavior with target-aware unified routes while retaining non-library editor actions in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/TemporaryInstrumentLibraryPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/mixer/EffectsChainContextMenu.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`.

**Checkpoint**: Each library type can be inserted into its valid project destination and the saved project is self-contained from the user-library database.

---

## Phase 5: User Story 3 - Edit And Organize Library Items Safely (Priority: P1)

**Goal**: Users can organize user-library folders/items and edit user or project items in main-owned sessions with stable identity, dirty-state protection, conflict handling, and shared SoundObject usage safety.

**Independent Test**: Create, rename, move, duplicate, reorder, and delete user content; edit user and project items in reusable dynamic tabs; exercise Save/Revert, conflict, missing-item, delete, quit, project-close/switch, clean-preview reuse, dirty auto-pin, and shared SoundObject usage prompts.

### Tests for User Story 3

- [X] T044 [P] [US3] Add failing repository tests for validated names, stable UUIDs, create/rename/move/reorder/duplicate/delete, descendant prevention, root protection, atomicity, and revision conflicts in `packages/blue-app/src/main/unified-library/repository-mutations.test.ts`.
- [X] T045 [P] [US3] Add failing main-owned editor-session tests for clean-preview reuse, dirty auto-pin, separate identities, Save/Revert, external conflict, missing item, deletion, close, quit, project-close, and project-switch decisions in `packages/blue-app/src/main/unified-library/editor-session-service.test.ts`.
- [X] T046 [P] [US3] Add failing project-adapter tests for user/project item saves, project-to-user copies, shared SoundObject usage counts, guarded deletion, stable references, and canonical broadcasts in `packages/blue-app/src/main/unified-library/project-item-editing.test.ts`.
- [X] T047 [P] [US3] Add failing Dockview tests for dynamic Library Item tab IDs, preview-to-pinned transitions, layout serialization, missing-item restoration, and active-editor routing in `packages/blue-app/src/renderer/tests/library-editor-workbench.test.tsx`.
- [X] T048 [P] [US3] Add failing renderer tests for tree commands, inline name validation, confirmations, breadcrumbs, controlled editor adapters, dirty/conflict states, and Save/Revert flows in `packages/blue-app/src/renderer/tests/library-editing.test.tsx`.
- [X] T049 [P] [US3] Add failing app lifecycle tests proving unresolved library sessions safely gate quit and project close/switch without blocking unrelated clean sessions in `packages/blue-app/src/main/unified-library/editor-lifecycle.test.ts`.

### Implementation for User Story 3

- [X] T050 [US3] Implement atomic folder/item create, rename, move, reorder, duplicate, delete, root guards, descendant guards, name validation, and revision checks in `packages/blue-app/src/main/unified-library/repository.ts`.
- [X] T051 [US3] Implement main-owned editor sessions, preview reuse, dirty auto-pin, snapshots, Save/Revert, conflict/missing transitions, close decisions, and lifecycle guards in `packages/blue-app/src/main/unified-library/editor-session-service.ts`.
- [X] T052 [US3] Implement project-item editing, project-to-user copying, shared SoundObject usage analysis, guarded deletion, and stable reference preservation in `packages/blue-app/src/main/unified-library/project-adapter.ts`.
- [X] T053 [US3] Expose mutation, editor-session, conflict-resolution, usage, delete, and lifecycle-decision methods and events in `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`.
- [X] T054 [US3] Implement session snapshots, draft state, conflict/missing handling, editor actions, and dynamic Dockview tab routing in `packages/blue-app/src/renderer/stores/library-editor-store.ts`, `packages/blue-app/src/renderer/stores/workbench-store.ts`, and `packages/blue-app/src/renderer/components/workbench/DockviewPanel.tsx`.
- [X] T055 [P] [US3] Add accessible tree organization commands, inline validation, confirmations, breadcrumbs, and change-event reconciliation in `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx` and `packages/blue-app/src/renderer/components/libraries/LibraryBreadcrumbs.tsx`.
- [X] T056 [US3] Build the dynamic Library Item editor shell and controlled Instrument, UDO, Effect, and SoundObject adapters using the existing editors in `packages/blue-app/src/renderer/components/libraries/LibraryItemEditorPanel.tsx` and `packages/blue-app/src/renderer/components/libraries/editor-registry.tsx`.
- [X] T057 [US3] Implement dirty, conflict, missing-item, deletion, shared-usage, close, quit, and project-transition decision UI in `packages/blue-app/src/renderer/components/libraries/LibraryEditorToolbar.tsx` and `packages/blue-app/src/renderer/components/libraries/LibrarySessionDialog.tsx`.
- [X] T058 [US3] Integrate editor-session lifecycle decisions with app quit and project close/switch ordering in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/renderer/stores/project-store.ts`.

**Checkpoint**: User and project library editing is safe under concurrent changes and lifecycle transitions, with no index-based shared SoundObject identity.

---

## Phase 6: User Story 4 - Preserve Existing Java Blue Libraries On First Run (Priority: P1)

**Goal**: On the first eligible run, Blue discovers the four standard Java library files, imports each source independently without modifying it, records durable outcomes, and reports partial success or skipped state once.

**Independent Test**: Exercise the full first-run state matrix with all, some, none, corrupt, and primary-corrupt/backup-valid files; verify per-source transactions, raw unsupported preservation, unchanged sources, no silent backup substitution, summary/history, nonempty-store suppression, and no automatic retry.

### Tests for User Story 4

- [X] T059 [P] [US4] Add failing atomic state-file tests for never-attempted, in-progress, completed, partial, skipped, failed, interrupted, and nonempty-store suppression states in `packages/blue-app/src/main/unified-library/migration-state-store.test.ts`.
- [X] T060 [P] [US4] Add failing discovery/import tests for the four standard Java filenames, missing sources, per-source transactions, raw unsupported preservation, aliases, source hashes, unchanged source files, and history records in `packages/blue-app/src/main/unified-library/automatic-migration.test.ts`.
- [X] T061 [P] [US4] Add failing recovery-policy tests for corrupt primary files, adjacent backups, no silent backup substitution, partial success, interrupted attempts, and no automatic retry in `packages/blue-app/src/main/unified-library/automatic-migration-recovery.test.ts`.
- [X] T062 [P] [US4] Add failing UI tests for post-startup success/partial/skipped summaries, per-source counts/errors, and the history link in `packages/blue-app/src/renderer/tests/library-migration-summary.test.tsx`.

### Implementation for User Story 4

- [X] T063 [US4] Implement atomic `blue-libraries-state.json` persistence and the documented first-run state machine in `packages/blue-app/src/main/unified-library/migration-state-store.ts`.
- [X] T064 [US4] Implement four-source discovery, read-only source hashing, per-source parse/import transactions, alias capture, unsupported preservation, and durable automatic-import history in `packages/blue-app/src/main/unified-library/import-export-service.ts`.
- [X] T065 [US4] Orchestrate database readiness, migration eligibility, read-only phases, one-shot attempt semantics, interruption detection, and post-window summary delivery in `packages/blue-app/src/main/unified-library/service.ts` and `packages/blue-app/src/main/main.ts`.
- [X] T066 [US4] Expose migration status/history events and render the accessible per-source startup summary with a history action in `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/renderer/stores/library-store.ts`, and `packages/blue-app/src/renderer/components/libraries/LibraryMigrationSummary.tsx`.

**Checkpoint**: Existing Java libraries are preserved and imported at most once automatically, with partial outcomes visible and all original files untouched.

---

## Phase 7: User Story 5 - Import, Export, And Review Compatibility (Priority: P2)

**Goal**: Users can manually preview/import Java library files, resolve conflicts deliberately, reimport or undo eligible batches, export current/all compatible content atomically, and inspect durable history.

**Independent Test**: Preview a mixed import, resolve exact duplicates, aliases, ambiguous folders, and replacements; reimport and conditionally undo it; export current/all for each type; validate Java compatibility, unsupported-fragment preservation, and rollback after injected write/rename failures.

### Tests for User Story 5

- [X] T067 [P] [US5] Add failing manual preview tests for source hashes, type detection, exact duplicates, aliases, ambiguous folders, destination mapping, unsupported warnings, explicit replacement, and stale preview tokens in `packages/blue-app/src/main/unified-library/manual-import-preview.test.ts`.
- [X] T068 [P] [US5] Add failing import execution tests for conflict decisions, per-source atomicity, reimport lineage, replacement snapshots, conditional batch undo, intervening edits, and durable history in `packages/blue-app/src/main/unified-library/manual-import-execution.test.ts`.
- [X] T069 [P] [US5] Add failing export tests for current/all scope, folder ordering, canonical supported XML, exact raw unsupported fragments, ambiguous conversion failures, and Java reparse compatibility in `packages/blue-app/src/main/unified-library/export-compatibility.test.ts`.
- [X] T070 [P] [US5] Add failing staging/journal tests for preflight validation, temporary files, fsync/close, atomic rename, multi-file rollback, retained recovery evidence, and cleanup in `packages/blue-app/src/main/unified-library/export-transaction.test.ts`.
- [X] T071 [P] [US5] Add failing UI tests for import preview resolutions, operation progress, report/history views, undo eligibility, Export Current/All, and accessible source naming in `packages/blue-app/src/renderer/tests/library-interchange.test.tsx`.

### Implementation for User Story 5

- [X] T072 [US5] Implement manual source parsing, preview tokens, exact-duplicate/alias/ambiguous-folder classification, destination resolutions, explicit replacement requirements, and operation leasing in `packages/blue-app/src/main/unified-library/import-export-service.ts`.
- [X] T073 [US5] Implement atomic manual import execution, source lineage, before/after change records, reimport, replacement snapshots, conditional batch undo in `packages/blue-app/src/main/unified-library/import-export-service.ts` and `packages/blue-app/src/main/unified-library/repository.ts`.
- [X] T074 [US5] Implement Export Current/All preflight, ordered legacy XML generation, raw-fragment preservation, staging, fsync, atomic commit, rollback, journal evidence, and history in `packages/blue-app/src/main/unified-library/import-export-service.ts`.
- [X] T075 [US5] Expose native file selection, import preview/execute/reimport/undo, export, progress, report, and history operations in `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`.
- [X] T076 [US5] Implement the library actions menu, import preview resolution flow, progress/report surfaces, history view, undo state, and Export Current/All actions in `packages/blue-app/src/renderer/components/libraries/LibraryActionsMenu.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryImportDialog.tsx`, and `packages/blue-app/src/renderer/components/libraries/LibraryHistoryPanel.tsx`.
- [X] T077 [US5] Integrate interchange operations and status-event reconciliation into `packages/blue-app/src/renderer/stores/library-store.ts` and `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx` without background file synchronization.

**Checkpoint**: Manual interoperability is explicit, reviewable, durable, and atomic; it never becomes continuous synchronization with Java files.

---

## Phase 8: User Story 6 - Recover From Storage And Operation Failures (Priority: P2)

**Goal**: Corrupt, locked, newer-version, or failed-upgrade databases enter a safe read-only failure state with explicit retry/restore/fresh/reimport choices while unrelated project work remains usable and original data is preserved.

**Independent Test**: Inject each database/open/upgrade/import/export/editor validation failure; verify no destructive default, verified backup before migration, clear recovery options, preserved originals/state/drafts, usable non-library project work, and deterministic cleanup after retry or shutdown.

### Tests for User Story 6

- [X] T078 [P] [US6] Add failing repository-open tests for integrity failure, lock exhaustion, newer `user_version`, unsupported schema, worker crash, and read-only failure classification in `packages/blue-app/src/main/unified-library/repository-recovery.test.ts`.
- [X] T079 [P] [US6] Add failing schema-upgrade tests for online backup creation, backup integrity verification, failed upgrade rollback, original preservation, restore, and successful retry in `packages/blue-app/src/main/unified-library/schema-upgrade.test.ts`.
- [X] T080 [P] [US6] Add failing service recovery tests for retry, restore verified backup, create fresh database without overwriting the original, manual reimport, migration-state preservation, and serialized recovery operations in `packages/blue-app/src/main/unified-library/service-recovery.test.ts`.
- [X] T081 [P] [US6] Add failing renderer/app tests proving recovery choices are accessible and non-library project open/edit/save/playback remains usable in read-only library failure mode in `packages/blue-app/src/renderer/tests/library-recovery.test.tsx` and `packages/blue-app/src/main/unified-library/failure-isolation.test.ts`.
- [X] T082 [P] [US6] Add failing validation/failure-injection tests proving invalid editor saves and failed database writes preserve the last valid saved payload and current draft in `packages/blue-app/src/main/unified-library/editor-session-failure.test.ts`.

### Implementation for User Story 6

- [X] T083 [US6] Implement integrity classification, schema-version gates, verified online backups, transactional upgrades, failed-upgrade rollback, and backup restore in `packages/blue-app/src/main/unified-library/schema.ts` and `packages/blue-app/src/main/unified-library/repository-client.ts`.
- [X] T084 [US6] Implement read-only failure snapshots and explicit retry, restore, fresh-database, and reimport recovery operations while preserving original database/state files in `packages/blue-app/src/main/unified-library/service.ts` and `packages/blue-app/src/main/unified-library/migration-state-store.ts`.
- [X] T085 [US6] Expose recovery operations and render the blocking-library/nonblocking-app recovery surface with diagnostics and confirmations in `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/renderer/stores/library-store.ts`, and `packages/blue-app/src/renderer/components/libraries/LibraryRecoveryPanel.tsx`.
- [X] T086 [US6] Preserve editor drafts and last valid saved payloads across validation, worker, transaction, and recovery failures in `packages/blue-app/src/main/unified-library/editor-session-service.ts` and `packages/blue-app/src/renderer/stores/library-editor-store.ts`.
- [X] T087 [US6] Complete worker, WAL, temporary-file, journal, and operation-lease cleanup for recovery and app shutdown in `packages/blue-app/src/main/unified-library/repository-worker.ts`, `packages/blue-app/src/main/unified-library/import-export-service.ts`, and `packages/blue-app/src/main/main.ts`.

**Checkpoint**: Library failures are recoverable and isolated, no recovery choice destroys the only copy, and unrelated project work remains available.

---

## Phase 9: Polish & Cross-Cutting Validation

**Purpose**: Prove the complete feature meets compatibility, scale, accessibility, runtime, and regression constraints and retire superseded library surfaces.

- [X] T088 [P] Add and run a deterministic 10,000-item browse/search/preview benchmark covering startup, query latency, pagination, and memory bounds in `packages/blue-app/src/main/unified-library/performance.test.ts`.
- [X] T089 [P] Expand the compatibility corpus with representative Java Blue library files and compare canonical output against Java-generated or Java-reparsed fixtures in `packages/blue-data/src/libraries/fixtures/legacy-library-corpus.ts` and `packages/blue-data/src/libraries/legacy-library-codec.test.ts`.
- [X] T090 Remove the superseded Effects Library modal/window state and embedded picker routes after unified-route regression tests pass in `packages/blue-app/src/renderer/components/workbench/panels/EffectLibraryModal.tsx`, `packages/blue-app/src/main/mixer-effects-library.ts`, and `packages/blue-app/src/main/effect-editor-window-manager.ts`.
- [X] T091 [P] Add packaged Electron smoke coverage for exact `node:sqlite` availability, worker startup, database creation, clean shutdown, and supported CI platforms in `.github/workflows/ci.yml` and `packages/blue-app/src/main/unified-library/sqlite-runtime.test.ts`.
- [X] T092 Run the focused `@blue/data`, main, preload, shared, renderer, compatibility, recovery, and performance suites; then run repository test, build, and lint commands and record only changed acceptance expectations in `specs/060-unified-libraries/quickstart.md`.
- [X] T093 Execute the full manual quickstart matrix for no-project browsing, all four insertions, editor conflicts, first-run partial migration, manual import/export/undo, atomic rollback, recovery choices, accessibility, and layout restoration in `specs/060-unified-libraries/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** has no dependency. T002 is verified after T001 pins the runtime; T003 and T004 can proceed in parallel.
- **Phase 2 (Foundational)** depends on Phase 1 and blocks every user story. Foundational tests T005-T011 must fail before implementations T012-T021.
- **US1 (Phase 3)** depends on Phase 2 and is the MVP.
- **US2 and US3 (Phases 4-5)** depend on the foundation and the US1 Libraries surface. Their pure tests can begin in parallel, but both integrate with shared target/editor state after US1.
- **US4 (Phase 6)** depends on the repository, codecs, service phases, and basic US1 reporting surface; it does not depend on US2 or US3 behavior.
- **US5 (Phase 7)** depends on US4 import history/state primitives and US3 mutation/conflict primitives.
- **US6 (Phase 8)** depends on the completed repository, migration, interchange, and editor-session paths it hardens.
- **Polish (Phase 9)** depends on all stories selected for delivery; T090 must wait until unified-route regression coverage is green.

### User Story Dependencies

- **US1 (P1)**: Foundation only. Delivers independently useful no-project browse/search/preview.
- **US2 (P1)**: Reuses US1 selection and adds target-aware transfer; saved projects do not require the user database.
- **US3 (P1)**: Reuses US1 nodes/tabs and the foundational repository; editor sessions are main-owned and independently testable.
- **US4 (P1)**: Reuses foundational codecs/repository and US1 summary presentation; its import attempt is independently testable from editing/insertion.
- **US5 (P2)**: Extends US4 history and US3 mutation primitives with explicit manual interoperability.
- **US6 (P2)**: Hardens every persistent path and validates that failure isolation preserves normal project workflows.

### Within Each User Story

1. Write the story's tests and confirm they fail for the intended missing behavior.
2. Implement pure data and repository behavior before service/IPC behavior.
3. Implement service/IPC behavior before renderer store and UI integration.
4. Run the independent test at the story checkpoint before starting dependent work.

### Parallel Opportunities

- **Setup/Foundation**: T003 and T004 are independent; T005-T011 target separate modules and can be authored in parallel; T012, T014, T015, and T017 can proceed in parallel once their tests exist.
- **US1**: T022-T025 can be authored in parallel; T027 and T030 touch separate main/UI paths after contracts are stable.
- **US2**: T033-T036 can be authored in parallel; T037 and T038 can proceed concurrently before project-adapter integration.
- **US3**: T044-T049 can be authored in parallel; T050, T051, T052, and T055 are separate implementation surfaces after contracts are fixed.
- **US4**: T059-T062 can be authored in parallel; T063 and the UI portion of T066 can proceed while import orchestration is implemented.
- **US5**: T067-T071 can be authored in parallel; export generation T074 and renderer flow T076 can proceed against stable contracts while import execution is completed.
- **US6**: T078-T082 can be authored in parallel; backup/upgrade T083 and renderer recovery presentation in T085 can proceed against the recovery contract independently.
- **Polish**: T088, T089, and T091 operate on separate validation surfaces and can run in parallel.

## Parallel Examples

### User Story 1

```text
Task T022: "Add failing repository/service browse-search tests in packages/blue-app/src/main/unified-library/browse-search.test.ts"
Task T024: "Add failing renderer store tests in packages/blue-app/src/renderer/tests/library-store.test.ts"
Task T025: "Add failing Libraries/workbench UI tests in packages/blue-app/src/renderer/tests/libraries-panel.test.tsx"
```

### User Story 2

```text
Task T033: "Add failing pure transfer tests in packages/blue-data/src/libraries/library-transfer.test.ts"
Task T034: "Add failing project transfer tests in packages/blue-app/src/main/unified-library/project-transfer.test.ts"
Task T036: "Add failing contextual route tests in packages/blue-app/src/renderer/tests/library-context-entry-points.test.tsx"
```

### User Story 3

```text
Task T044: "Add failing repository mutation tests in packages/blue-app/src/main/unified-library/repository-mutations.test.ts"
Task T045: "Add failing editor-session tests in packages/blue-app/src/main/unified-library/editor-session-service.test.ts"
Task T047: "Add failing dynamic editor tab tests in packages/blue-app/src/renderer/tests/library-editor-workbench.test.tsx"
```

### User Story 4

```text
Task T059: "Add failing migration state tests in packages/blue-app/src/main/unified-library/migration-state-store.test.ts"
Task T060: "Add failing automatic import tests in packages/blue-app/src/main/unified-library/automatic-migration.test.ts"
Task T062: "Add failing summary UI tests in packages/blue-app/src/renderer/tests/library-migration-summary.test.tsx"
```

### User Story 5

```text
Task T067: "Add failing manual preview tests in packages/blue-app/src/main/unified-library/manual-import-preview.test.ts"
Task T069: "Add failing export compatibility tests in packages/blue-app/src/main/unified-library/export-compatibility.test.ts"
Task T071: "Add failing interchange UI tests in packages/blue-app/src/renderer/tests/library-interchange.test.tsx"
```

### User Story 6

```text
Task T078: "Add failing repository recovery tests in packages/blue-app/src/main/unified-library/repository-recovery.test.ts"
Task T079: "Add failing schema upgrade tests in packages/blue-app/src/main/unified-library/schema-upgrade.test.ts"
Task T081: "Add failing recovery isolation/UI tests in packages/blue-app/src/renderer/tests/library-recovery.test.tsx"
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1 browse/search/preview with the no-project workbench.
3. Stop and validate the US1 independent test, exact Electron runtime, codec safety, and repository lifecycle.
4. Demonstrate the unified surface before adding transfer, editing, or migration behavior.

### Incremental Delivery

1. **Foundation + US1**: One project-independent discovery surface.
2. **Add US2**: Contextual, self-contained project insertion for all four types.
3. **Add US3**: Safe organization and main-owned editor sessions.
4. **Add US4**: One-time preservation of existing Java libraries.
5. **Add US5**: Explicit manual interoperability and audit history.
6. **Add US6**: Complete failure isolation, backup, and recovery choices.

## Notes

- `[P]` marks tasks that affect separate files or validation surfaces and have no incomplete prerequisite beyond the phase entry condition.
- `[USn]` labels provide direct traceability to the six specification stories; setup, foundation, and cross-cutting validation intentionally have no story label.
- Tests are listed before implementation in every story and must be observed failing for the intended reason before the implementation task begins.
- The plan does not add continuous synchronization, a generic blank-item command, index-based shared SoundObject references, or `.blue` schema changes.
- Commit after each task or coherent task group, preserving the test-first ordering and story checkpoints.
