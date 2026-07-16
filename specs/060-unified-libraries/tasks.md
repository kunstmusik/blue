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

**Independent Test**: Open Libraries with and without a project, filter/search/select all four supported types, and verify one compact ellipsis control, a full-height tree, native editors in the main area, clean-preview reuse, first-edit pinning, preserved tree focus, and standalone full-window Welcome behavior.

### Tests for User Story 1

- [x] T012 [P] [US1] Rewrite failing panel tests for compact search/filter layout, one ellipsis control, full-height hierarchy, and absence of migration/action/target banners, embedded preview, row CRUD, and Insert controls in `packages/blue-app/src/renderer/tests/libraries-panel.test.tsx`
- [x] T013 [P] [US1] Add failing Dockview tests for the generic `Library Item` title, existing address/breadcrumb header, clean-preview reuse, first-edit auto-pin, explicit pinning, and protected dirty sessions in `packages/blue-app/src/renderer/tests/library-editor-workbench.test.tsx`
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
- [x] T025 [US1] Use the generic `Library Item` Dockview title, preserve dirty indication, and enforce clean-preview/dirty-pin focus rules in `packages/blue-app/src/renderer/stores/workbench-store.ts` and `packages/blue-app/src/renderer/stores/library-editor-store.ts`
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

## Phase 6: User Story 4 - Non-Blocking First-Run Migration Reporting (Priority: P1)

**Goal**: Automatic migration remains safe and visible without permanently consuming the top of Libraries.

**Independent Test**: Exercise complete, partial, skipped, and failed first-run migration outcomes and verify a transient/non-blocking summary, persistent report access from the ellipsis menu, unchanged source files, and no silent retry.

### Tests for User Story 4

- [x] T050 [US4] Rewrite failing migration UI tests to reject a persistent header and require transient complete/partial summaries plus durable report/history access from the ellipsis menu in `packages/blue-app/src/renderer/tests/library-migration-summary.test.tsx`

### Implementation for User Story 4

- [x] T051 [US4] Replace the full-width migration banner with a dismissible non-blocking notice that never reduces tree layout height in `packages/blue-app/src/renderer/components/libraries/LibraryMigrationNotice.tsx` and `packages/blue-app/src/renderer/stores/library-store.ts`
- [x] T052 [P] [US4] Add migration status/report access to the ellipsis menu and retire the persistent `LibraryMigrationSummary` rendering path in `packages/blue-app/src/renderer/components/libraries/LibraryActionsMenu.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`

**Checkpoint**: US4 passes independently: migration outcomes remain trustworthy and reviewable without turning Libraries into a status page.

---

## Phase 7: User Story 5 - Import/Export/History Through The Ellipsis Menu (Priority: P2)

**Goal**: Existing safe interchange workflows remain fully available from the compact menu without a permanent action row.

**Independent Test**: Invoke Import XML, Export Current, Export All, Import History, preview/execute/undo, and overwrite/compatibility decisions from the ellipsis menu and verify identical backend results and accessible disabled states.

### Tests for User Story 5

- [x] T053 [US5] Rewrite failing interchange UI tests for the accessible ellipsis popup, command ordering, Export Current disabled state for `All`/project scope, dialog focus return, history/undo, and absence of a full-width action row in `packages/blue-app/src/renderer/tests/library-interchange.test.tsx`

### Implementation for User Story 5

- [x] T054 [US5] Wire Import XML, Export Current, Export All, and Import History into the Radix dropdown with correct scope/operation disabled states and focus restoration in `packages/blue-app/src/renderer/components/libraries/LibraryActionsMenu.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`
- [x] T055 [P] [US5] Preserve import preview, compatibility decisions, progress/results, history, and undo as focused dialogs/panels without reintroducing a persistent header in `packages/blue-app/src/renderer/components/libraries/LibraryImportDialog.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryHistoryPanel.tsx`, and `packages/blue-app/src/renderer/stores/library-store.ts`

**Checkpoint**: US5 passes independently: all interchange/history behavior is reachable and unchanged, while healthy Libraries retains one compact action affordance.

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
- [ ] T063 Execute the corrective manual matrix for compact/narrow/floating Libraries, mouse/keyboard context menus, four native editors, 100 selection changes, four drop/Paste destinations, invalid-target zero mutation, migration notice, recovery, and full-window Welcome in `specs/060-unified-libraries/quickstart.md`
- [ ] T064 Update corrective requirement-to-test coverage and replace the initial-only renderer verification note after all acceptance checks pass in `specs/060-unified-libraries/checklists/requirements.md` and `specs/060-unified-libraries/quickstart.md`

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
- **US4**: T052 can proceed on the menu/panel after T050 while T051 implements notice/store behavior.
- **US5**: T055 can preserve dialog/history flows while T054 wires the dropdown.
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
T051: non-blocking migration notice/store
T052: migration report access in ellipsis menu
```

### User Story 5

```text
After T053 fails:
T054: dropdown command wiring
T055: import/history dialog and store preservation
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
4. **Add US4**: Make migration reporting transient but reviewable.
5. **Add US5**: Preserve interchange/history through the ellipsis menu.
6. **Add US6**: Confirm recovery remains exceptional and non-destructive.
7. **Polish**: Delete obsolete surfaces only after all replacement coverage passes.

## Notes

- All tasks are intentionally unchecked; the previous completed implementation checklist is preserved in Git history rather than mixed with corrective work.
- `[P]` marks tasks that touch separate files after their phase entry condition.
- Drag payloads contain only opaque tokens and non-authoritative type/scope hints—never XML.
- Supported Library Items use native controlled editors under the existing address header; unsupported/missing items remain deliberately read-only.
- User-library-to-project drag always copies. Cut/move is limited to permitted organization inside one user-library type/scope.
- Context menus and destination Paste are required keyboard equivalents; drag-and-drop is never the sole path.
- Commit after each task or coherent task group while preserving test-first ordering.
