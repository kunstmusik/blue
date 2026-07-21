# Tasks: Unified Libraries Corrective UX

**Input**: Corrected design documents from `/Users/stevenyi/work/blue-electron/specs/060-unified-libraries/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Scope**: This checklist replaces the completed initial implementation checklist with the corrective UX slice approved on 2026-07-15. The original 93 completed tasks remain available in Git history and the initial verification record in `quickstart.md`. Persistence, Java interchange, migration safety, and recovery architecture are retained unless a corrective task explicitly touches their presentation contract.

**Tests**: The specification and plan require test-first execution. Each story's failing tests must be observed failing for the intended missing behavior before implementation begins.

**Organization**: Tasks are grouped by user story so each corrected workflow can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after the phase entry condition because it touches a separate file or test surface.
- **[USn]**: Maps directly to the numbered user story in `spec.md`.
- Every task names the exact file or files it changes.

---

## Phase 1: Corrective Test Setup

**Purpose**: Add reusable fixtures for the new editor and direct-manipulation tests without changing production behavior.

- [x] T001 Create reusable DataTransfer, pointer-geometry, keyboard-context-menu, and drop-marker test helpers in `packages/blue-app/src/renderer/tests/library-interaction-test-helpers.ts`
- [x] T002 [P] Create supported Instrument/UDO/Effect/SoundObject Library Item session and typed-editor fixtures in `packages/blue-app/src/renderer/tests/library-editor-fixtures.ts`

---

## Phase 2: Foundational Typed Interaction And Editor Contracts

**Purpose**: Replace XML-only and persistent-target contracts with typed editor documents, an opaque drag session, and a transient application clipboard. This phase blocks all corrected user stories.

- [x] T003 [P] Add failing shared contract/guard tests for typed Library Item documents and patches, drag descriptors, transfer sources, exact targets, and revision-bound clipboard entries in `packages/blue-app/src/shared/unified-library.test.ts` and `packages/blue-app/src/shared/library-editor-document.test.ts`
- [x] T004 Define the discriminated `LibraryEditorDocument`/`LibraryEditorDocumentPatch`, `LibraryDragDescriptor`, `LibraryTransferSource`, `LibraryInteractionClipboard`, and exact target DTOs with runtime guards in `packages/blue-app/src/shared/library-editor-document.ts` and `packages/blue-app/src/shared/unified-library.ts`
- [x] T005 [P] Add failing adapter tests proving supported payloads become native Instrument/UDO/Effect/SoundObject editor documents while unsupported payloads remain read-only and byte-preserved in `packages/blue-app/src/main/unified-library/editor-adapters.test.ts`
- [x] T006 Implement the main-owned payload-to-native-document and typed-patch adapter registry without exposing raw XML to supported renderer editors in `packages/blue-app/src/main/unified-library/editor-adapters.ts`
- [x] T007 Extend main-owned editor sessions to hydrate typed documents, apply guarded typed patches, preserve draft XML internally, and retain conflict/missing semantics in `packages/blue-app/src/main/unified-library/editor-session-service.ts`
- [x] T008 [P] Add failing renderer-store tests for revision-bound copy/cut/cancel clipboard state, stale-source retention, and project-destination Paste source resolution in `packages/blue-app/src/renderer/tests/library-store.test.ts`
- [x] T009 Implement transient typed clipboard primitives and selectors without persistent insertion-target state in `packages/blue-app/src/renderer/stores/library-store.ts`
- [x] T010 [P] Create the reusable accessible tree context-menu command/capability shell, including right-click and `Shift+F10`/Context Menu key invocation, in `packages/blue-app/src/renderer/components/libraries/LibraryContextMenu.tsx`
- [x] T011 Wire typed editor document snapshots and patch requests through validated main IPC, preload, and renderer declarations in `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`

**Checkpoint**: Supported items can be represented as native editor documents, drag/clipboard values are typed and opaque, and no renderer contract requires raw XML or a persistent insertion mode.

---

## Phase 3: User Story 1 - Compact Discovery And Main-Area Native Editors (Priority: P1) 🎯 MVP

**Goal**: Libraries is a compact navigator; selecting a supported item opens a reusable full native editor titled `Library Item` under the existing address header, with no embedded preview, persistent action/banner strip, row CRUD controls, or Insert button.

**Independent Test**: Open Libraries with and without a project, filter/search/select all four supported types, and verify one compact ellipsis control, a full-height tree, exactly one native-editor tab in the main area, retained dirty sessions, preserved tree focus, and standalone full-window Welcome behavior.

### Tests for User Story 1

- [x] T012 [P] [US1] Rewrite failing panel tests for compact search/filter layout, one ellipsis control, full-height hierarchy, and absence of migration/action/target banners, embedded preview, row CRUD, and Insert controls in `packages/blue-app/src/renderer/tests/libraries-panel.test.tsx`
- [x] T013 [P] [US1] Add failing Dockview tests for the generic `Library Item` title, existing address/breadcrumb header, reusable presentation behavior, first-edit auto-pin, explicit pinning, and protected dirty sessions in `packages/blue-app/src/renderer/tests/library-editor-workbench.test.tsx`
- [x] T014 [P] [US1] Replace XML-textarea expectations with failing native Instrument/UDO/Effect/SoundObject editor rendering tests and unsupported read-only tests in `packages/blue-app/src/renderer/tests/library-editing.test.tsx`
- [x] T015 [P] [US1] Add failing no-project regression tests proving Welcome remains a standalone full-window surface and Libraries appears only after explicit reveal in `packages/blue-app/src/renderer/tests/unified-library-workbench.test.tsx`

### Implementation for User Story 1

- [x] T016 [US1] Refactor the healthy panel action affordance into one icon-only vertical-ellipsis dropdown labeled `Library actions` in `packages/blue-app/src/renderer/components/libraries/LibraryActionsMenu.tsx`
- [x] T017 [US1] Remove the persistent migration/action row, target banner, embedded preview grid, and Insert/Confirm Insert controls and give the tree the remaining panel height in `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`
- [x] T018 [US1] Remove visible row Rename/Duplicate/Delete buttons, integrate the base context-menu shell, and keep selection/folder disclosure behavior separate in `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx`
- [x] T019 [US1] Make single selection open/focus the reusable Library Item editor while retaining tree keyboard focus and remove preview-cache fetching from `packages/blue-app/src/renderer/stores/library-store.ts`
- [x] T020 [P] [US1] Build the controlled Instrument Library Item adapter around the existing Instrument editor surface in `packages/blue-app/src/renderer/components/libraries/editors/InstrumentLibraryEditor.tsx`
- [x] T021 [P] [US1] Build the controlled UDO Library Item adapter around the existing UDO editor surface in `packages/blue-app/src/renderer/components/libraries/editors/UdoLibraryEditor.tsx`
- [x] T022 [P] [US1] Build the controlled Effect Library Item adapter around the existing Effect editor surface in `packages/blue-app/src/renderer/components/libraries/editors/EffectLibraryEditor.tsx`
- [x] T023 [P] [US1] Build the controlled SoundObject Library Item adapter around the existing score-object editor registry in `packages/blue-app/src/renderer/components/libraries/editors/SoundObjectLibraryEditor.tsx`
- [x] T024 [US1] Dispatch typed documents to the four native adapters, preserve unsupported/missing safe states, and remove the supported-item textarea in `packages/blue-app/src/renderer/components/libraries/editor-registry.tsx` and `packages/blue-app/src/renderer/components/libraries/LibraryItemEditorPanel.tsx`
- [x] T025 [US1] Use the generic `Library Item` Dockview title, preserve dirty indication, and enforce reusable presentation/protected-session rules in `packages/blue-app/src/renderer/stores/workbench-store.ts` and `packages/blue-app/src/renderer/stores/library-editor-store.ts`
- [x] T026 [US1] Preserve the standalone full-window Welcome surface outside Dockview while allowing explicit no-project Libraries reveal in `packages/blue-app/src/renderer/App.tsx` and `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx`

**Checkpoint**: US1 passes independently: Libraries is visually compact, selection opens full native editors in the main area, dirty work is protected, and Welcome is not a panel.

---

## Phase 4: User Story 2 - Direct Drag/Drop And Keyboard Paste Into Project Surfaces (Priority: P1)

**Goal**: Supported library items copy into exact Orchestra, UDO, mixer, and Score destinations through typed drag/drop or destination Paste, with visible insertion markers and no Browse/Insert mode.

**Independent Test**: Drag and keyboard-Paste every supported type into valid exact positions, verify shared SoundObject choice, save/reopen without the user database, and repeat against stale/incompatible destinations to prove zero mutation and no fallback.

### Tests for User Story 2

- [x] T027 [US2] Add failing main-service tests for opaque expiring drag sessions, no XML in renderer payloads, source revision revalidation, one-time consumption, cancellation, and stale/unsupported rejection in `packages/blue-app/src/main/unified-library/drag-session-service.test.ts`
- [x] T028 [P] [US2] Add failing Orchestra row/end marker, invalid-type, auto-scroll, Escape-cancel, drop, and keyboard-Paste tests in `packages/blue-app/src/renderer/tests/orchestra-library-drop.test.tsx`
- [x] T029 [P] [US2] Add failing project UDO row/end marker, same-name preservation, drop, and keyboard-Paste tests in `packages/blue-app/src/renderer/tests/udo-library-drop.test.tsx`
- [x] T030 [P] [US2] Add failing mixer pre/post chain-gap marker, stale-chain rejection, drop, and keyboard-Paste tests in `packages/blue-app/src/renderer/tests/mixer-library-drop.test.tsx`
- [x] T031 [P] [US2] Add failing Score path/layer/time marker, coordinate conversion, stale-time-context rejection, shared-copy choice, drop, and keyboard-Paste tests in `packages/blue-app/src/renderer/tests/score-library-drop.test.tsx`
- [x] T032 [P] [US2] Rewrite integration tests for four-type drop/Paste parity, dependency blocking, shared-instance versus independent choice, and zero-mutation failures in `packages/blue-app/src/renderer/tests/library-target-routing.test.tsx` and `packages/blue-app/src/main/unified-library/project-transfer.test.ts`

### Implementation for User Story 2

- [x] T033 [US2] Implement opaque drag-session creation, expiry, lookup, cancellation, and source-revision validation in `packages/blue-app/src/main/unified-library/drag-session-service.ts` and `packages/blue-app/src/main/unified-library/service.ts`
- [x] T034 [US2] Expose begin/cancel drag plus explicit-source preview/apply transfer methods through `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`
- [x] T035 [US2] Implement opaque DataTransfer encoding/decoding, drag cancellation, marker state, invalid-reason announcements, and supported-item drag sources in `packages/blue-app/src/renderer/components/libraries/library-drag-drop.ts` and `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx`
- [x] T036 [P] [US2] Add exact Instrument row/end drop targets and destination Paste while removing `Browse Instruments` in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/ArrangementPanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/OrchestraPanel.tsx`
- [x] T037 [P] [US2] Add exact UDO row/end drop targets and destination Paste while removing `Browse UDO Library` in `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoTable.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoWorkspacePanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/UserDefinedOpcodePanel.tsx`
- [x] T038 [P] [US2] Add exact pre/post effect-chain gap targets and destination Paste while removing `Add Effect from Library…` in `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/mixer/EffectsChainContextMenu.tsx`
- [x] T039 [P] [US2] Add explicit Score layer/time drop targets and destination Paste while removing `Browse SoundObjects` in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`
- [x] T040 [US2] Orchestrate drop/Paste preview, dependency disclosure, shared SoundObject choice, atomic apply, result announcement, and invalid-target feedback in `packages/blue-app/src/renderer/stores/library-store.ts` and `packages/blue-app/src/renderer/components/libraries/LibraryTransferDialog.tsx`
- [x] T041 [US2] Remove persistent target/context listeners and legacy target-opening routes while retaining Window/legacy reveal-only compatibility in `packages/blue-app/src/renderer/stores/library-routing.ts`, `packages/blue-app/src/renderer/stores/library-store.ts`, and `packages/blue-app/src/shared/unified-library.ts`

**Checkpoint**: US2 passes independently: all four destinations support exact direct placement and keyboard Paste, valid transfers are one gesture, and invalid/stale transfers cannot mutate a project.

---

## Phase 5: User Story 3 - Contextual Organization And Safe Native Editing (Priority: P1)

**Goal**: Library organization uses desktop tree conventions—inline rename and scoped context menus—while native editor patches remain revision-safe and dirty sessions cannot be lost.

**Independent Test**: Rename by double-click/F2, invoke every applicable context command by mouse and keyboard, copy/cut/paste folders and items, delete with affected-count confirmation, edit/save/revert each native type, and verify identity/revision/dirty-session behavior across restart and conflicts.

### Tests for User Story 3

- [x] T042 [US3] Add failing tree tests for name-only double-click rename, F2/Enter/Escape validation, right-click and `Shift+F10` parity, visible focus, capability-specific commands, and absence of row buttons in `packages/blue-app/src/renderer/tests/library-editing.test.tsx`
- [x] T043 [P] [US3] Extend failing repository tests for copy-to-folder new identities, cut/move identity preservation, cycle/cross-type rejection, stale source/destination revisions, ordering, and transactional rollback in `packages/blue-app/src/main/unified-library/repository-mutations.test.ts`
- [x] T044 [P] [US3] Extend failing editor-session tests for typed native patches, first-edit pinning, Save/Revert, conflict decisions, external rename/move/delete, and dirty close/project/quit guards in `packages/blue-app/src/main/unified-library/editor-session-service.test.ts`

### Implementation for User Story 3

- [x] T045 [US3] Populate scoped folder/item/root/project context menus with applicable Create Folder, Duplicate, Cut, Copy, Paste, Delete, and project-to-user-copy commands and destructive confirmations in `packages/blue-app/src/renderer/components/libraries/LibraryContextMenu.tsx`
- [x] T046 [US3] Make double-click target only the visible name label, preserve disclosure behavior, keep invalid rename active, and remove Delete-key bypasses that skip confirmation in `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx`
- [x] T047 [US3] Implement revision-bound copy-to-folder and cut/move Paste semantics with new-versus-preserved identity rules in `packages/blue-app/src/main/unified-library/repository.ts` and `packages/blue-app/src/main/unified-library/service.ts`
- [x] T048 [US3] Map typed native editor patches through the main adapter registry, refresh address/search metadata atomically on Save, and preserve draft/conflict state on failure in `packages/blue-app/src/main/unified-library/editor-session-service.ts` and `packages/blue-app/src/renderer/stores/library-editor-store.ts`
- [x] T049 [US3] Integrate affected-count delete confirmation, dirty-session Save/Discard/Cancel, shared-instance consequences, clipboard clearing, and focus restoration in `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx` and `packages/blue-app/src/renderer/stores/library-store.ts`

**Checkpoint**: US3 passes independently: the tree has no CRUD button clutter, every organization command is contextual and keyboard reachable, and native editing is identity-safe and lossless.

---

## Phase 6: User Story 4 - Silent First-Run Migration With Internal Audit (Priority: P1)

**Goal**: Automatic migration remains safe and fully auditable internally without adding routine migration UI to healthy Libraries.

**Independent Test**: Exercise complete, partial, skipped, and failed first-run migration outcomes and verify internal provenance, unchanged source files, no silent retry, silent usable startup, and recovery UI only for an actionable repository failure.

### Tests for User Story 4

- [x] T050 [US4] Cover complete, partial, skipped, failed, source-immutability, and no-repeat migration behavior without requiring a renderer report surface in `packages/blue-app/src/main/unified-library/automatic-migration.test.ts`

### Implementation for User Story 4

- [x] T051 [US4] Keep healthy migration silent while retaining migration state, source diagnostics, and batch provenance in `packages/blue-app/src/main/unified-library/import-export-service.ts`, `packages/blue-app/src/main/unified-library/migration-state-store.ts`, and `packages/blue-app/src/main/unified-library/service.ts`
- [x] T052 [P] [US4] Exclude migration notices/reports/history from the healthy Libraries menu and reserve panel replacement for recovery in `packages/blue-app/src/renderer/components/libraries/LibraryActionsMenu.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`

**Checkpoint**: US4 passes independently: migration outcomes remain trustworthy and recoverable without turning Libraries into a status page.

---

## Phase 7: User Story 5 - Previewed Import/Export Through The Ellipsis Menu (Priority: P2)

**Goal**: Existing safe interchange workflows remain fully available from the compact menu without a permanent action row.

**Independent Test**: Invoke XML-file import, Java-configuration-directory import, Export Current, and Export All from the ellipsis menu; resolve ambiguous folder identities; exercise overwrite/compatibility decisions; and verify accessible disabled states without history/report commands.

### Tests for User Story 5

- [x] T053 [US5] Cover the accessible ellipsis popup, both import entry points, Export Current disabled state for `All`, folder-conflict selection, overwrite decisions, and absence of history/report or a full-width action row in `packages/blue-app/src/renderer/tests/library-interchange.test.tsx` and `packages/blue-app/src/main/unified-library/manual-import-preview.test.ts`

### Implementation for User Story 5

- [x] T054 [US5] Wire Import XML, Import Java Configuration Directory, Export Current, and Export All into the Radix dropdown with correct disabled states and no migration/history commands in `packages/blue-app/src/renderer/components/libraries/LibraryActionsMenu.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`
- [x] T055 [P] [US5] Implement source-hash validation, explicit duplicate-folder identity selection, deterministic merge behavior, one interchange lease, compatibility preflight, overwrite confirmation, and atomic export rollback in `packages/blue-app/src/renderer/components/libraries/LibraryImportDialog.tsx`, `packages/blue-app/src/main/unified-library/import-export-service.ts`, `packages/blue-app/src/main/unified-library/repository.ts`, and `packages/blue-app/src/main/unified-library/ipc.ts`

**Checkpoint**: US5 passes independently: safe interchange is reachable from one compact action affordance, while audit history remains internal.

---

## Phase 8: User Story 6 - Recovery Remains Exceptional And Non-Destructive (Priority: P2)

**Goal**: Recovery may replace Libraries only while the repository is unusable; it never changes Welcome into a panel or blocks unrelated project work.

**Independent Test**: Inject each repository failure, verify Retry/Restore/Re-import/Create Fresh applicability and confirmation, preserve the failed database, continue normal project work, recover, and confirm the compact healthy panel returns.

### Tests for User Story 6

- [x] T056 [US6] Extend failing recovery/failure-isolation tests for recovery-only panel replacement, no destructive default, preserved originals, continued project work, standalone Welcome, and compact healthy-state restoration in `packages/blue-app/src/renderer/tests/library-recovery.test.tsx` and `packages/blue-app/src/main/unified-library/failure-isolation.test.ts`

### Implementation for User Story 6

- [x] T057 [US6] Keep recovery actions blocking only inside Libraries failure state, preserve explicit confirmations/diagnostics, and return to the compact navigator after success in `packages/blue-app/src/renderer/components/libraries/LibraryRecoveryPanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`
- [x] T058 [P] [US6] Preserve full-window Welcome until explicit workbench reveal and keep non-library work usable during library recovery in `packages/blue-app/src/renderer/App.tsx`, `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx`, and `packages/blue-app/src/main/unified-library/service.ts`

**Checkpoint**: US6 passes independently: failure handling is clear and recoverable, but healthy users never see recovery/status chrome.

---

## Phase 9: Polish And Cross-Cutting Validation

**Purpose**: Remove obsolete surfaces, prove accessibility/performance/regression behavior, and record the corrective acceptance evidence.

- [x] T059 Remove obsolete embedded preview/target/banner components and superseded context-target tests after replacement coverage is green in `packages/blue-app/src/renderer/components/libraries/LibraryPreview.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryTargetBanner.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryMigrationSummary.tsx`, and `packages/blue-app/src/renderer/tests/library-context-entry-points.test.tsx`
- [x] T060 [P] Add cross-cutting accessibility tests for ellipsis labeling, visible menu focus, `Shift+F10`, disabled-reason announcements, destructive confirmations, drag invalid feedback, and keyboard Paste in `packages/blue-app/src/renderer/tests/libraries-panel.test.tsx` and `packages/blue-app/src/renderer/tests/library-editing.test.tsx`
- [x] T061 [P] Update the 10,000-item regression to assert lazy browse/search never decodes payloads or opens editor sessions before selection in `packages/blue-app/src/main/unified-library/performance.test.ts`
- [x] T062 Run focused renderer/main transfer/editor/recovery suites plus `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, `pnpm test`, `pnpm build`, and `git diff --check`; record results in `specs/060-unified-libraries/quickstart.md`
- [X] T063 Execute the corrective manual matrix for compact/narrow/floating Libraries, mouse/keyboard context menus, four native editors, 100 selection changes, four drop/Paste destinations, invalid-target zero mutation, silent healthy migration, recovery, and full-window Welcome in `specs/060-unified-libraries/quickstart.md`
- [X] T064 Update corrective requirement-to-test coverage and replace the initial-only renderer verification note after all acceptance checks pass in `specs/060-unified-libraries/checklists/requirements.md` and `specs/060-unified-libraries/quickstart.md`

---

## Phase 10: User-Only Libraries And Dedicated Project Surfaces (2026-07-18 Correction)

**Goal**: Remove routine modal/migration/project-scope clutter from Libraries, restore the Java-style Project SoundObject Library panel, keep project UDOs in the reusable UDO workspace, and make SoundObject drag/drop reliable under Chromium protected drag data.

**Independent Test**: Open a project with user libraries and Project Shared SoundObjects; verify all user roots start collapsed, Libraries has no source/current-project/migration/history UI, Project SoundObjects appear only in their own panel, the UDO top component still renders the reusable list/editor, normal Instrument and user SoundObject transfers show only a toast, shared SoundObjects retain their real copy-choice dialog, and a protected-mode SoundObject drag inserts at the exact Score location.

### Tests

- [x] T065 [P] [US2] Add regressions proving one-mode transfers never publish modal state and Score accepts protected-mode SoundObject drag hover/drop while retaining the Project Shared copy-choice dialog in `packages/blue-app/src/renderer/tests/library-store.test.ts` and `packages/blue-app/src/renderer/tests/score-library-drop.test.tsx`
- [x] T066 [P] [US1] Update Libraries tests to require user-only search/browse, no source filter/Current Project/no-project message, collapsed top-level roots, and no migration/history commands or notice in `packages/blue-app/src/renderer/tests/libraries-panel.test.tsx` and `packages/blue-app/src/renderer/tests/library-interchange.test.tsx`
- [x] T067 [P] [US1] Add Project SoundObject Library panel and workbench-layout tests covering canonical project entries, editor selection, typed drag/copy, no-project empty state, coexistence with Libraries, and preservation of `SoundObjectLibraryTopComponent` in `packages/blue-app/src/renderer/tests/project-sound-object-library.test.tsx` and `packages/blue-app/src/renderer/tests/unified-library-workbench.test.tsx`
- [x] T068 [P] [US1] Add a User Defined Opcode top-component test proving it renders the reusable `UdoWorkspacePanel` with the project drop target rather than duplicating project UDOs in Libraries in `packages/blue-app/src/renderer/tests/user-defined-opcode-panel.test.tsx`

### Implementation

- [x] T069 [US2] Apply one-mode transfer previews directly without setting dialog state and treat unreadable protected drag descriptors as unknown until Score drop/main validation in `packages/blue-app/src/renderer/stores/library-store.ts` and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`
- [x] T070 [US1] Make Libraries browse/search only user sources, remove source/current-project/no-project chrome, and initialize every user root collapsed in `packages/blue-app/src/renderer/stores/library-store.ts`, `packages/blue-app/src/renderer/components/libraries/LibrarySearchBar.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`
- [x] T071 [US4] Remove migration notices, Migration Report, Import History, and their renderer/preload IPC presentation paths while retaining internal migration state/provenance and exceptional recovery in `packages/blue-app/src/renderer/components/libraries/LibraryActionsMenu.tsx`, `packages/blue-app/src/renderer/stores/library-store.ts`, `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`
- [x] T072 [US1] Implement and register `SoundObjectLibraryTopComponent` as a separate right-side project panel using canonical project browse/editor/clipboard/drag/delete services, preserve its layout identity, and keep `UserDefinedOpcodeTopComponent` on `UdoWorkspacePanel` in `packages/blue-app/src/renderer/components/workbench/panels/SoundObjectLibraryPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/DockviewPanel.tsx`, `packages/blue-app/src/shared/workbench-menu.ts`, and `packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts`
- [x] T073 Run focused transfer/panel/layout tests plus `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, `pnpm test`, `pnpm lint`, and `git diff --check`; record the corrective results in `specs/060-unified-libraries/quickstart.md` and `specs/060-unified-libraries/checklists/requirements.md`

**Checkpoint**: Libraries is a collapsed user-only navigator with silent healthy migration, project UDO/SoundObject ownership is represented by dedicated panels, and valid transfers never flash a modal or lose SoundObject drops.

---

## Phase 11: Hierarchy, Organization, Interchange, And Project-Copy Audit Fixes (2026-07-18)

**Goal**: Close the post-implementation review findings, with special emphasis on never truncating a folder or project collection at a backend page boundary.

**Independent Test**: Expand folders and Project SoundObjects/UDOs containing more than 500 children; verify every child appears once in stable order; exercise folder/item clipboard, Paste-on-item, reorder/delete, stale response suppression, project-to-user transfer for Instruments/UDOs/SoundObjects, both import entry points, ambiguous-folder selection, and overwrite-safe exports.

- [x] T074 [P] [US1] Add regressions for multi-page user and project hierarchies, stale search responses, and complete 10,000-item cursor draining in `packages/blue-app/src/renderer/tests/library-store.test.ts`, `packages/blue-app/src/renderer/tests/project-sound-object-library.test.tsx`, and `packages/blue-app/src/main/unified-library/performance.test.ts`
- [x] T075 [US1] Drain every browse cursor page with stable ordering, ID deduplication, repeated-cursor protection, preserved loaded folders, surfaced failures, and stale-response guards in `packages/blue-app/src/renderer/stores/library-store.ts` and `packages/blue-app/src/renderer/components/workbench/panels/SoundObjectLibraryPanel.tsx`
- [x] T076 [P] [US3] Cover and implement folder/item Cut, Copy, Paste-on-item-parent, reorder, root rename prohibition, and non-empty folder delete confirmation in `packages/blue-app/src/renderer/tests/library-editing.test.tsx`, `packages/blue-app/src/renderer/tests/library-store.test.ts`, `packages/blue-app/src/renderer/components/libraries/LibraryContextMenu.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`
- [x] T077 [P] [US1] Keep persistent item/search rows name-only, expose the complete breadcrumb through the item tooltip and Library Item header, and avoid whole-store React subscriptions in `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`
- [x] T078 [US3] Centralize independent project-to-user transfer for project Instruments, UDOs, and Project Shared SoundObjects in `packages/blue-app/src/renderer/stores/library-store.ts`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/ArrangementContextMenu.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoTable.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/SoundObjectLibraryPanel.tsx` (the temporary dedicated command was retired by T087)
- [x] T079 [P] [US5] Support Java configuration-directory import and explicit stable destination selection for ambiguous duplicate folders in `packages/blue-app/src/main/unified-library/import-export-service.ts`, `packages/blue-app/src/main/unified-library/repository.ts`, `packages/blue-app/src/main/unified-library/ipc.ts`, and `packages/blue-app/src/renderer/components/libraries/LibraryImportDialog.tsx`
- [x] T080 [P] [US5] Serialize Export Current and Export All through one lease, preflight all serialized output, confirm every overwrite, and preserve atomic rollback in `packages/blue-app/src/main/unified-library/import-export-service.ts` and `packages/blue-app/src/main/unified-library/ipc.ts`
- [x] T081 [P] Update interaction, interchange, export, and project-copy coverage in `packages/blue-app/src/renderer/tests/library-interchange.test.tsx`, `packages/blue-app/src/renderer/tests/orchestra-library-drop.test.tsx`, `packages/blue-app/src/renderer/tests/udo-library-drop.test.tsx`, `packages/blue-app/src/renderer/tests/project-sound-object-library.test.tsx`, and `packages/blue-app/src/main/unified-library/export-compatibility.test.ts`
- [x] T082 Reconcile `spec.md`, `tasks.md`, `quickstart.md`, and `checklists/requirements.md` with the implemented user-only, silent-migration, complete-hierarchy behavior in `specs/060-unified-libraries/`
- [x] T083 Run the full application and workspace verification gates and record the final current counts in `specs/060-unified-libraries/quickstart.md` and `specs/060-unified-libraries/checklists/requirements.md`

**Checkpoint**: No hierarchy or project collection is truncated at a service page boundary, organization commands match desktop tree semantics, project copying covers every supported project definition type, and interchange decisions are explicit and atomic.

---

## Phase 12: Shared Project/User Clipboard And Bidirectional Drag (2026-07-18 Correction)

**Goal**: Use one typed Copy/Cut/Paste buffer across user and project panels for every supported library type, remove special project-to-user commands, keep the empty UDO workspace immediately usable, and make mixer Effect selection and moves follow desktop expectations.

**Independent Test (historical; Cut lifecycle superseded by Phase 17)**: With a project and matching user roots open, Copy and Cut an Instrument, UDO, Effect, and SoundObject in either ownership direction and Paste into the compatible destination; verify no second buffer or `Copy to User Library` command appears, project items drag back to user folders, the empty UDO table accepts an initial drop, and one selected mixer Effect moves across channels/chains without duplication.

- [x] T084 [P] Add shared-contract, store, service, and panel regressions for typed project Effect keys, project-to-user opaque drag, bidirectional Copy/Cut/Paste, the original guarded Cut lifecycle later replaced by T109–T113, and linked-SoundObject cancellation in `packages/blue-app/src/shared/unified-library.test.ts`, `packages/blue-app/src/main/unified-library/library-transfer-service.test.ts`, `packages/blue-app/src/renderer/tests/library-store.test.ts`, and the four destination panel suites
- [x] T085 Implement the single user/project typed clipboard and project-to-user transfer bridge, retaining a Cut source/buffer until destination success and guarded source cleanup in `packages/blue-app/src/shared/unified-library.ts`, `packages/blue-app/src/main/unified-library/service.ts`, `packages/blue-app/src/main/unified-library/project-adapter.ts`, `packages/blue-app/src/main/unified-library/ipc.ts`, `packages/blue-app/src/preload/preload.ts`, `packages/blue-app/src/renderer/types/global.d.ts`, and `packages/blue-app/src/renderer/stores/library-store.ts`
- [x] T086 [P] Keep the UDO table/splitter mounted when empty and add project UDO drag/Copy/Cut/Paste back to the user library without a special command in `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoTable.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoWorkspacePanel.tsx`
- [x] T087 [P] Remove type-specific project-to-user commands and add canonical project drag/shared clipboard sources for Orchestra Instruments and Project SoundObjects in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/ArrangementPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/SoundObjectLibraryPanel.tsx`, `packages/blue-app/src/renderer/components/libraries/ProjectLibraryDragSource.tsx`, and `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx`
- [x] T088 [P] Enforce one selected mixer Effect across all channels, share Copy/Cut/Paste with Libraries, support drag back to user Effects, and move Effects across exact same/cross-channel pre/post boundaries in `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`
- [x] T089 Run focused shared-buffer/bidirectional-transfer suites plus the full application test, build, lint, and diff gates; record current evidence in `specs/060-unified-libraries/quickstart.md` and `specs/060-unified-libraries/checklists/requirements.md`

**Checkpoint**: Project and user panels use one familiar transfer vocabulary, Cut is loss-safe across ownership, empty project collections accept their first item, and mixer Effect selection/movement is unambiguous.

---

## Phase 13: Folder, Dialog, Drop-State, And Empty-UDO Regressions (2026-07-18 Correction)

**Goal**: Make user-folder creation work in Electron, keep every Library dialog surface opaque, clear consumed Mixer drop feedback, and preserve a useful empty UDO table at normal docked heights.

**Independent Test**: Create a named folder from a user-root context menu without browser prompt support, inspect an opaque delete confirmation, move an Effect between Mixer chains without residual insertion highlights, and open an empty UDO workspace with a visible table, end-drop target, and draggable separator.

- [x] T090 [P] Add focused regressions for in-app user-folder creation and opaque destructive confirmation in `packages/blue-app/src/renderer/tests/libraries-panel.test.tsx`
- [x] T091 Replace unsupported `window.prompt` folder creation with a validated in-app dialog and use defined opaque theme surfaces for Library dialogs and panels in `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx` and `packages/blue-app/src/renderer/components/libraries/`
- [x] T092 [P] Clear Library insertion-marker state on every completed or cancelled native drag, including Mixer internal moves that consume drop propagation, in `packages/blue-app/src/renderer/components/libraries/use-library-drop-target.ts` and `packages/blue-app/src/renderer/tests/mixer-library-drop.test.tsx`
- [x] T093 [P] Rebalance the reusable UDO split so a normal docked workspace retains its 200-pixel empty table, exact end-drop target, and separator in `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoWorkspacePanel.tsx` and `packages/blue-app/src/renderer/tests/udo-workspace-empty.test.tsx`
- [x] T094 Run focused regressions, the full application and workspace suites, isolated 10,000-item performance gate, application production build, workspace lint, and diff validation; record the current evidence in `specs/060-unified-libraries/quickstart.md` and `specs/060-unified-libraries/checklists/requirements.md`

**Checkpoint**: Library creation and confirmations are native-renderer reliable and legible, drag feedback cannot become stale, and the empty UDO workspace is immediately usable without first creating an item.

---

## Phase 14: Instrument-Local UDO Transfer And Folder Disclosure (2026-07-19 Correction)

**Goal**: Make every Instrument-local UDO list a fully addressed project source/destination and keep empty Library folders visually unambiguous.

**Independent Test**: Drag, copy, and cut a selected Instrument-local UDO into the user UDO Library; drag or paste a user-library UDO back into that exact Instrument UDO table; verify another Instrument and the top-level project list remain unchanged; then create an empty folder and verify it renders the same large white disclosure arrow as populated folders.

- [x] T095 [P] Add failing shared/main/service/renderer regressions for Instrument-local UDO identity, exact insertion, enabled Copy/Cut, shared-buffer drag/Paste, and empty-folder disclosure in the Unified Libraries, project transfer, UDO workspace, and tree test suites
- [x] T096 Extend the project UDO locator and exact insertion target with an optional Instrument assignment identity, then resolve list/browse/preview/edit/delete/copy/insert operations against that exact canonical `OpcodeList` in shared contracts and the main project adapter/service
- [x] T097 Wire supported Instrument UDO editors, including Generic, JavaScript, and BlueSynthBuilder, through the reusable transfer context so selected local rows use the shared typed Copy/Cut/Paste buffer and opaque bidirectional drag contract; keep non-Orchestra reuse of the UDO component free of invalid project-Instrument targets
- [x] T098 Render disclosure affordances by folder/root node kind instead of child count and use a larger high-contrast chevron for both empty and populated folders
- [x] T099 Run focused regressions, the full application suite, isolated performance gate when concurrent timing requires it, application production build, workspace lint, and diff validation; record evidence in `specs/060-unified-libraries/quickstart.md` and `specs/060-unified-libraries/checklists/requirements.md`

**Checkpoint**: Instrument-local UDOs transfer bidirectionally without aliasing another list, and every folder remains visibly a folder regardless of child count.

---

## Phase 15: List Remainder Drop Geometry And Mixer Minimum Sizing (2026-07-19 Correction)

**Goal**: Make blank list space useful as an exact end-drop target, refine folder disclosure scale, and prevent short Mixer panels from overlapping controls.

**Independent Test**: Drag a compatible UDO or Effect over the unused area below the final entry and verify the whole remainder highlights and inserts at the list end; inspect empty lists and populated lists; reduce Mixer height below its readable strip minimum and verify vertical scrolling appears while labels, level values, Effect bins, and routing controls remain separate.

- [x] T100 [P] Add failing renderer regressions for the reduced folder chevron, UDO blank-remainder end drop, Effect-bin blank-remainder end drop, full-area active feedback, and Mixer CSS minimum-size contract
- [x] T101 Reduce the high-contrast folder disclosure icon by one size while preserving empty-folder semantics in `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx`
- [x] T102 Extend the shared block drop marker with a flexible remainder mode and use it after the UDO table and at the end of every Mixer Effect bin without changing exact insertion identity in `packages/blue-app/src/renderer/components/libraries/LibraryDropMarker.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoTable.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`
- [x] T103 Establish a readable Mixer strip/level minimum and vertical overflow behavior in `packages/blue-app/src/renderer/styles/index.css`
- [x] T104 Run focused renderer regressions, the full application suite, renderer production build, workspace lint, and diff validation; record evidence in `specs/060-unified-libraries/quickstart.md` and `specs/060-unified-libraries/checklists/requirements.md`

**Checkpoint**: Compatible drags can use all visible list remainder space, and a short Mixer scrolls instead of drawing controls on top of one another.

---

## Phase 16: Single Library Item Tab (2026-07-19 Correction)

**Purpose**: Enforce one visible Library Item presentation slot without discarding protected editor sessions.

- [x] T105 Add a failing workbench regression that identifies duplicate session-bound Library Item panels and proves opening a second session must replace the first visible tab in `packages/blue-app/src/renderer/tests/library-editor-workbench.test.tsx` and `packages/blue-app/src/renderer/tests/workbench-store.test.ts`
- [x] T106 Enforce the single-tab invariant at the Dockview action boundary and remove the pre-await replacement snapshot that allowed rapid selections to race in `packages/blue-app/src/renderer/stores/workbench-store.ts` and `packages/blue-app/src/renderer/stores/library-store.ts`
- [x] T107 Remove transient session-bound Library Item panels during saved-layout restoration while retaining dirty/pinned sessions by stable item identity in `packages/blue-app/src/renderer/stores/workbench-store.ts`
- [x] T108 Run focused renderer regressions, the full application suite, renderer production build, workspace lint, and diff validation; record evidence in `specs/060-unified-libraries/quickstart.md` and `specs/060-unified-libraries/checklists/requirements.md`

**Checkpoint**: Rapid selection and legacy saved layouts can never produce more than one visible Library Item tab, while reselecting an item restores its retained draft session.

---

## Phase 17: Immediate Detached Cut And Folder Drag (2026-07-19 Correction)

**Purpose**: Make every Cut visibly remove its source at command time while preserving reusable typed Paste content, and add direct folder organization by drag-and-drop.

**Independent Test**: Cut a populated user folder and each supported user/project item type; verify the source disappears before choosing a destination, Paste can be repeated into compatible user or project targets, every result has an independent identity, dirty/declined/failed cuts preserve the source and prior clipboard, and dragging a folder into a compatible sibling folder moves the original hierarchy while rejecting cycles and cross-type targets.

- [x] T109 [P] Add shared, service, store, panel, and tree regressions for detached typed Cut buffers, immediate source removal, repeated deep Paste, project editor closure, declined shared-SoundObject consequences, and folder-to-folder drag
- [x] T110 Add atomic repository subtree capture/recreation through the repository client and worker so folder Cut retains every descendant payload and ordering without renderer-visible XML
- [x] T111 Add validated main/preload IPC for capture-before-delete Cut, main-owned expiring typed buffers, guarded project/user deletion, clean editor closure, and reusable Paste resolution
- [x] T112 Replace deferred renderer Cut cleanup with asynchronous capture-and-remove at command time across Libraries, Orchestra, UDO, Mixer, and Project SoundObject panels while keeping Copy revision-bound
- [x] T113 Add guarded user folder/item drag moves into compatible user folders with protected-mode hover feedback, cycle/type/root checks, and revision-bound repository authority
- [x] T114 Run focused regressions, the full application suite, production build, workspace lint, and diff validation; record evidence in `specs/060-unified-libraries/quickstart.md` and `specs/060-unified-libraries/checklists/requirements.md`

**Checkpoint**: Cut behaves as copy-then-remove everywhere, Paste is a repeatable independent copy, and direct user-folder drag organization is immediate and unambiguous.

---

## Phase 18: Shared SoundObject Instance Editing Parity (2026-07-20 Correction)

**Purpose**: Restore Java Blue's split between shared-definition editing and per-Instance properties while keeping every reference and editor session synchronized.

**Independent Test**: Open multiple timeline and nested Instances of one Project Shared SoundObject, edit and save the definition in Library Item, and generate the project score; verify every Instance uses the updated definition, the Instance Properties panel retains wrapper-local values, clean parallel editors refresh without flashing, and dirty drafts become conflicts without being discarded.

- [x] T115 Add failing regressions for stable library-ID Instance routing, per-Instance property routing, clean/dirty project editor reconciliation, stable-session reuse after a definition fingerprint changes, and generated-score use of the edited definition
- [x] T116 Route Instance type editors through the stable Project Shared SoundObject ID while deriving a timeline-owned target for the selected Instance's Properties panel
- [x] T117 Relink every timeline, nested, and project-library-nested Instance after canonical definition replacement, and reconcile open project Library Item sessions by stable identity
- [x] T118 Prevent editor reloads caused only by rehydrated target object identity and refresh the selected Instance type editor after a Library Item Save or Revert transition
- [x] T119 Run focused regressions, the full application suite, main and renderer production builds, workspace lint, and diff validation; record evidence in `specs/060-unified-libraries/quickstart.md` and `specs/060-unified-libraries/checklists/requirements.md`

**Checkpoint**: A Project Shared SoundObject has one canonical definition for editing and score generation, while each Instance retains independent wrapper properties and no clean or dirty editor drifts silently.

---

## Phase 19: Completion Review And Traceability (2026-07-21 Closeout)

**Purpose**: Review the complete feature branch against the current specification, close measurable coverage and repository-policy gaps, and record a durable completion decision.

- [x] T120 Audit all 78 functional requirements, 13 success criteria, 119 implementation tasks, constitution rules, changed production surfaces, and failure-path coverage; add the missing 50-cycle identity regression and replace prohibited inline import-type annotations
- [x] T121 Reconcile superseded task wording, add the completion/traceability record, and update the final verification evidence in `specs/060-unified-libraries/status.md`, `specs/060-unified-libraries/tasks.md`, `specs/060-unified-libraries/quickstart.md`, and `specs/060-unified-libraries/checklists/requirements.md`
- [x] T122 Run the focused repository and performance regressions, browser regressions, full application/workspace tests, production build, lint, and branch-wide diff validation; record the results in the Spec 060 closeout artifacts

**Checkpoint**: Spec 060 has no blocking requirement, constitution, coverage, or code-quality findings; every build-verifiable success criterion has direct evidence and the remaining usability outcome is identified as external validation.

---

## Dependencies And Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** has no dependencies; T001 and T002 can run in parallel.
- **Phase 2 (Foundation)** depends on Phase 1 and blocks every corrected story. Observe T003/T005/T008 failing before T004/T006/T007/T009/T010/T011.
- **US1 (Phase 3)** depends on Phase 2 and is the corrective MVP.
- **US2 (Phase 4)** depends on Phase 2 plus the US1 tree/editor selection surface. Its four destination implementations can proceed in parallel once drag IPC is stable.
- **US3 (Phase 5)** depends on Phase 2 plus the US1 tree/editor shell. It can run in parallel with US2 because the shared clipboard/context shell is foundational.
- **US4 (Phase 6)** depends on US1's compact panel shell but not on US2 or US3.
- **US5 (Phase 7)** depends on US1's ellipsis shell and should follow US4 to avoid concurrent edits to the same menu.
- **US6 (Phase 8)** depends on US1's healthy/failure panel split and can run independently of US2–US5.
- **Polish (Phase 9)** depends on every selected story; obsolete files are removed only after replacement tests are green.
- **Phase 10** depends on the completed corrective slice. T065–T068 are independent failing-test surfaces; T069–T072 implement those contracts; T073 is its gate.
- **Phase 11** depends on Phase 10. T074/T076/T077/T079/T080 cover separate review surfaces; T075/T078 implement shared renderer behavior; T081/T082 reconcile coverage and artifacts; T083 is the final gate.
- **Phase 12** depends on Phase 11 and unifies project/user ownership interactions before the final regression pass.
- **Phase 13** depends on Phase 12 and closes the rendered Electron and dock-sizing failures found during manual acceptance.
- **Phase 14** depends on Phase 13 and extends the already shared UDO transfer contract to Instrument-owned lists while correcting the remaining empty-folder affordance.
- **Phase 15** depends on Phase 14 and expands only the hit/highlight geometry of existing exact end targets while protecting Mixer readability at short dock heights.
- **Phase 16** depends on Phase 15 and changes only Library Item panel visibility; main-owned dirty/pinned session retention remains intact.
- **Phase 17** depends on Phase 16 and replaces the prior destination-first Cut lifecycle without changing ordinary Copy or cross-owner drag-copy semantics.
- **Phase 18** depends on Phase 17 and reconciles stable shared-SoundObject definition identity across editor and score-generation paths.
- **Phase 19** depends on every implementation phase and is the final cross-artifact, code-quality, coverage, and verification gate.

### User Story Dependency Graph

```text
Setup → Foundation → US1
                     ├──→ US2 ──┐
                     ├──→ US3 ──┤
                     ├──→ US4 → US5
                     └──→ US6   │
                                └──→ Polish
```

### Within Each User Story

1. Write/adjust the story tests and confirm the intended corrective assertions fail.
2. Implement shared/main behavior before renderer orchestration where applicable.
3. Implement individual renderer surfaces before integration cleanup.
4. Run the independent story checkpoint before beginning a dependent phase.
5. Do not delete legacy components until their replacement tests are green.

### Parallel Opportunities

- **Setup/Foundation**: T001/T002, T003/T005/T008, and renderer-only T010 can proceed on separate files.
- **US1**: T012–T015 are separate test surfaces; T020–T023 are separate native editor adapters.
- **US2**: T028–T031 cover separate destinations; T036–T039 implement those destinations in separate component trees.
- **US3**: T043 and T044 cover repository and editor-session services independently.
- **US4**: T052 can proceed on the menu/panel after T050 while T051 implements silent migration and internal provenance.
- **US5**: T055 can implement import/export decision flows while T054 wires the dropdown.
- **US6**: T058 can protect app/workbench behavior while T057 updates recovery presentation.
- **Polish**: T060 and T061 validate independent accessibility and performance surfaces.

---

## Parallel Examples

### User Story 1

```text
T012: compact Libraries panel tests
T013: Library Item Dockview preview/pin tests
T014: native editor registry tests
T015: standalone Welcome tests

Then in parallel:
T020: Instrument adapter
T021: UDO adapter
T022: Effect adapter
T023: SoundObject adapter
```

### User Story 2

```text
T028: Orchestra drop/Paste tests
T029: UDO drop/Paste tests
T030: mixer drop/Paste tests
T031: Score drop/Paste tests

After T033–T035:
T036: Orchestra target implementation
T037: UDO target implementation
T038: mixer target implementation
T039: Score target implementation
```

### User Story 3

```text
T043: repository copy/cut/paste identity tests
T044: native editor patch/session tests
```

### User Story 4

```text
After T050 fails:
T051: silent migration and internal provenance
T052: healthy-menu exclusion and recovery-only presentation
```

### User Story 5

```text
After T053 fails:
T054: file/directory import and export command wiring
T055: explicit import/export decisions and atomic service behavior
```

### User Story 6

```text
After T056 fails:
T057: recovery-only Libraries presentation
T058: Welcome/project-work failure isolation
```

---

## Implementation Strategy

### Corrective MVP First

1. Complete Setup and Foundation.
2. Complete US1: compact navigator, main-area native editors, and standalone Welcome.
3. Stop and run the US1 independent test before introducing drag/drop or organization mutations.
4. Demonstrate the corrected interaction hierarchy at narrow and default panel widths.

### Incremental Delivery

1. **Foundation + US1**: Remove the unacceptable button/header/XML-editor experience.
2. **Add US2**: Replace Browse/Insert modes with exact drag/drop and keyboard Paste.
3. **Add US3**: Complete desktop context-menu organization and safe typed editing.
4. **Add US4**: Keep healthy migration silent while retaining internal provenance and exceptional recovery.
5. **Add US5**: Provide previewed file/directory import and atomic export through the ellipsis menu.
6. **Add US6**: Confirm recovery remains exceptional and non-destructive.
7. **Polish**: Delete obsolete surfaces only after all replacement coverage passes.

## Notes

- Checked tasks describe completed implementation and verified coverage; T122 records the final full verification gate.
- `[P]` marks tasks that touch separate files after their phase entry condition.
- Drag payloads contain only opaque tokens and non-authoritative type/scope hints—never XML.
- Supported Library Items use native controlled editors under the existing address header; unsupported/missing items remain deliberately read-only.
- Cross-owner drag copies, while native internal project drag may move where supported. One shared typed Cut buffer captures detached content and removes the source immediately; every later Paste is an independent copy and leaves the buffer reusable.
- Context menus and destination Paste are required keyboard equivalents; drag-and-drop is never the sole path.
- Commit after each task or coherent task group while preserving test-first ordering.
