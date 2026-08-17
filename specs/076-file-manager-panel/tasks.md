# Tasks: Blue File Manager Panel

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/076-file-manager-panel/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/file-manager-ipc.md, contracts/audio-file-drop.md, quickstart.md

**Verification**: Constitution-driven verification is embedded per story: shared contract tests for the allowlist/URI/action matrix, main tests for roots/listings/import rejections, renderer tests for panel routing/lazy tree/drop mapping, SoundFont Viewer and layout regressions, plus the quickstart manual parity workflow and full package test/build runs.

**Organization**: Tasks are grouped by user story (US1–US4 from spec.md) so each story is independently implementable and testable. US1 is the MVP. Shared contracts, settings, preload, and the main filesystem service are foundational and block all stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Electron app**: `packages/blue-app/src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`
- **Tests**: co-located (`*.test.ts`) for shared/main, `packages/blue-app/src/renderer/tests/` for renderer
- **Feature docs**: `specs/076-file-manager-panel/`
- **`@blue/data` is unchanged by this feature** (no tasks touch it)

---

## Phase 1: Setup

**Purpose**: Confirm the branch and baseline before any change

- [x] T001 On branch `codex/076-file-manager-panel`, run `pnpm install` if needed, then record baseline results of `pnpm --filter @blue/app test` and `pnpm --filter @blue/app build` from `/Users/stevenyi/work/blue-electron` before making changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, settings field, main filesystem service, and typed IPC bridge that every user story needs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Add the pure shared File Manager contracts in `packages/blue-app/src/shared/file-manager.ts`: `FileManagerRootSnapshot`/`FileManagerNodeSnapshot`/`FileManagerDirectoryResult` types, `FileManagerActionState` derivation implementing the Java action matrix (files get no actions), `BLUE_FILE_MANAGER_DRAG_MIME` + versioned `FileManagerDragPayload`, capability-derived case-insensitive `isCsoundAudioSourcePath` allowlist from research.md, and external `file://` URI/source parsing helpers per `specs/076-file-manager-panel/contracts/audio-file-drop.md`
- [x] T003 Add shared verification in `packages/blue-app/src/shared/file-manager.test.ts`: allowlist case-insensitivity and exclusions (`.raw`, `.m4a`/`.mp4`/`.webm`/`.opus`, `.WAV.backup` final-suffix rejection), POSIX/Windows-drive/UNC single-decode URI parsing, multi-file and multi-URI rejection, non-file scheme rejection, and the full action-eligibility matrix (depends on T002)
- [x] T004 [P] Add the additive `appSpecific.fileManagerFavorites: string[]` field with `[]` default, `mergeWithDefaults` preservation of older settings files, and non-string/blank filtering in `packages/blue-app/src/shared/program-settings.ts`, extending the existing settings merge tests
- [x] T005 Implement the main filesystem service in `packages/blue-app/src/main/file-manager-service.ts`: platform roots + home derivation (Windows drive-letter discovery, normalized/case-insensitive/realpath de-duplication), live favorite filtering that never deletes stored entries, `listFileManagerDirectory` direct-children listing with dot-prefix filtering, deterministic name ordering, stat-based kinds with symlink-to-directory expandability, and typed recoverable error results per `specs/076-file-manager-panel/contracts/file-manager-ipc.md` (depends on T002)
- [x] T006 Add main verification in `packages/blue-app/src/main/file-manager-service.test.ts`: static/home/favorite root composition, missing/unreadable directory typed errors, hidden-entry filtering with stable ordering, favorite validation without disk mutation, and a temp-fixture helper producing dot-prefixed, nested, unicode/space, and 1,000-entry directories (depends on T005)
- [x] T007 [P] Extend the typed preload bridge in `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts` with `getFileManagerRoots`, `listFileManagerDirectory`, `validateFileManagerDirectory`, and the typed `commitAudioFileDrop` surface (handler wired in T020), plus verify or expose Electron `webUtils.getPathForFile` for external drops (depends on T002)
- [x] T008 Register the `file-manager:get-roots`, `file-manager:list-directory`, and `file-manager:validate-directory` `ipcMain.handle` channels in `packages/blue-app/src/main/main.ts`, wired to the main service (depends on T005, T007)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Browse project media and system files (Priority: P1) 🎯 MVP

**Goal**: The registered `BlueFileManagerTopComponent` opens on demand as a real, lazy, virtualized filesystem tree with Java-compatible roots, dot-entry filtering, ordering, and recoverable error states

**Independent Test**: Open File Manager from the Window menu, expand a filesystem root and several nested directories, and verify the visible tree is navigable, ordered, and free of dot-prefixed entries

### Verification for User Story 1

- [x] T012 [P] [US1] Add renderer verification in `packages/blue-app/src/renderer/tests/file-manager-panel.test.tsx`: lazy expansion issues one listing request per toggle, children render sorted and dot-filtered, unreadable/disappeared directories show recoverable inline diagnostics, and a 1,000-entry directory renders responsively (depends on T011)
- [x] T013 [P] [US1] Add routing verification in `packages/blue-app/src/renderer/tests/file-manager-routing.test.tsx`: choosing File Manager from the Window menu opens the panel on demand and `BlueFileManagerTopComponent` never renders `PlaceholderPanel` (depends on T009)

### Implementation for User Story 1

- [x] T009 [US1] Route `BlueFileManagerTopComponent` to the new panel component in `packages/blue-app/src/renderer/components/workbench/WorkbenchPanelContent.tsx`, removing the placeholder fallthrough for that identity (depends on T008)
- [x] T010 [P] [US1] Create the panel shell `packages/blue-app/src/renderer/components/workbench/panels/tools/FileManagerPanel.tsx`: load roots via `getFileManagerRoots`, render static roots before favorites, and show loading/empty/unavailable-root states with a roots refresh affordance (depends on T008)
- [x] T011 [US1] Create the lazy tree `packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/FileManagerTree.tsx` using `react-arborist`: `children: []` placeholders with `onToggle`-driven `listFileManagerDirectory` requests, disposable renderer cache, refresh invalidating only one node, ancestor-identity symlink-cycle guard, and virtualized rows (depends on T010)

**Checkpoint**: User Story 1 is fully functional and independently testable — this is the MVP

---

## Phase 4: User Story 2 - Manage favorite folders from context menus (Priority: P1)

**Goal**: Java Blue's Refresh Folder / Add to Favorites / Remove from Favorites actions with correct per-node eligibility and durable `appSpecific.fileManagerFavorites` persistence through the typed settings bridge

**Independent Test**: Right-click an ordinary folder, add it to Favorites, close and reopen the panel, refresh it, then remove the favorite and verify the filesystem itself was never changed

### Verification for User Story 2

- [x] T017 [P] [US2] Extend `packages/blue-app/src/renderer/tests/file-manager-panel.test.tsx` with action tests: the exact context-menu matrix per node kind, add/remove flowing through the mocked `getProgramSettings`/`saveProgramSettings` bridge, save-failure keeps the prior root list with a diagnostic, and Refresh Folder re-lists only the selected directory (depends on T016)
- [x] T018 [P] [US2] Extend `packages/blue-app/src/main/file-manager-service.test.ts` with favorite tests: `validateFileManagerDirectory` accept/reject paths, duplicate rejection with static-root precedence, and a missing favorite omitted from live roots but retained in stored settings across reload (depends on T005)

### Implementation for User Story 2

- [x] T014 [US2] Add Radix context menus to `FileManagerTree` node rows in `packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/FileManagerTree.tsx` implementing the Java matrix from research.md: static roots expose Refresh Folder only, ordinary directories expose Refresh Folder + Add to Favorites, favorite roots expose Refresh Folder + Remove from Favorites, regular files expose no File Manager actions (depends on T011)
- [x] T015 [US2] Implement the Add to Favorites flow in `packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/`: fresh `getProgramSettings` snapshot, `validateFileManagerDirectory`, de-duplication against returned root identities, `saveProgramSettings` writing only `appSpecific.fileManagerFavorites`, and root-list refresh only after a successful save (depends on T014)
- [x] T016 [US2] Implement Remove from Favorites (settings entry only, never disk mutation) and Refresh Folder (single-node re-list preserving tree state and selection) handlers in `packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/` (depends on T015)

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Drag files into audio layers (Priority: P1)

**Goal**: File Manager regular-file rows and single external OS audio files drop onto the Track audio-layer surface, mapping pointer coordinates to layer/start beat and creating exactly one AudioClip through the main-owned commit path with the shared Csound-source allowlist

**Independent Test**: Drag a regular file node to several coordinates in an audio-layer timeline and verify one audio clip is created in the layer under the pointer at the corresponding time; drag a directory and verify no project mutation occurs

### Verification for User Story 3

- [x] T023 [P] [US3] Add target verification in `packages/blue-app/src/renderer/tests/track-layer-audio-drop.test.tsx`: File Manager node drops and external single-file drops each produce one typed `commitAudioFileDrop` request, pointer-to-layer/start-beat mapping matches canvas geometry, and directory, multi-file, unsupported-suffix, non-file-URI, invalid-location, and stale-project sources are rejected without a request (depends on T022)
- [x] T024 [P] [US3] Extend `packages/blue-app/src/main/file-manager-service.test.ts` with commit tests: success with and without copy-on-import, `copy-failed`, `stale-project` cleanup removing only the newly created media copy, and `not-a-file`/`unsupported-extension`/`no-project` rejections (depends on T020)
- [x] T025 [P] [US3] Extend `packages/blue-app/src/renderer/tests/file-manager-panel.test.tsx` with drag-source tests: regular-file rows write the versioned custom MIME payload with copy semantics and directory rows start no audio drag (depends on T021)

### Implementation for User Story 3

- [x] T019 [US3] Refactor the reusable media-copy/path-normalization portion of `packages/blue-app/src/main/score-object-file-operations.ts` into a source-path import preparation step, keeping existing callers and tests green
- [x] T020 [US3] Implement the `commit-audio-file-drop` handler in `packages/blue-app/src/main/file-manager-service.ts` and register its channel in `packages/blue-app/src/main/main.ts`: project session/revision fence revalidation, regular-file + shared-suffix + readability recheck, optional collision-safe copy into the configured media folder, serialized AudioClip transfer through the existing canonical addTrackItem/revision/broadcast path, and best-effort cleanup of only the request's newly created copy on post-copy rejection per `specs/076-file-manager-panel/contracts/audio-file-drop.md` (depends on T019, T008)
- [x] T021 [US3] Create `packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/file-manager-drag-drop.ts` and wire regular-file rows in `FileManagerTree.tsx`: JSON `FileManagerDragPayload` under `BLUE_FILE_MANAGER_DRAG_MIME`, `effectAllowed = 'copy'` with optional `text/plain` feedback, directory rows emitting no audio payload (depends on T011, T002)
- [x] T022 [US3] Add the drop target to `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`: accept the File Manager custom MIME or one external OS file (`webUtils.getPathForFile`, then a single `file://` line from `text/uri-list`/`text/plain`), gate `dropEffect = 'copy'` on the shared suffix and valid layer/beat geometry, map pointer coordinates through the existing local-coordinate/snap helpers, and submit the typed `commitAudioFileDrop` request with the current TrackRef and revision fence; make no change to `ScoreTimeCanvas.tsx` (depends on T020, T021)

**Checkpoint**: All three P1 stories are independently functional

---

## Phase 6: User Story 4 - Preserve distinct embedded file browsing tools (Priority: P2)

**Goal**: SoundFont Viewer's embedded `.sf2` browser stays a separate surface, and saved layouts restore exactly one real File Manager panel

**Independent Test**: Open SoundFont Viewer, navigate to an `.sf2` file through its embedded browser, use Copy Path, and verify the new File Manager neither replaces nor alters that workflow

### Verification for User Story 4

- [x] T026 [P] [US4] Extend `packages/blue-app/src/renderer/tests/soundfont-viewer-panel.test.tsx` with regression coverage: `.sf2` filtering, directory navigation and metadata selection, the scoped Copy Path action, preserved OS-drop behavior, and no File Manager favorite actions or implied drop operations on File Manager payloads
- [x] T027 [P] [US4] Add layout-restore verification to `packages/blue-app/src/renderer/tests/file-manager-routing.test.tsx` and `packages/blue-app/src/renderer/tests/workbench-auxiliary.test.tsx`: a saved layout containing `BlueFileManagerTopComponent` restores one real File Manager panel with zero placeholder renders and zero duplicate instances (depends on T009)
- [x] T028 [P] [US4] Add negative target-matrix verification to `packages/blue-app/src/renderer/tests/track-layer-audio-drop.test.tsx` and `packages/blue-app/src/renderer/tests/file-manager-panel.test.tsx`: the File Manager tree is not a drop target, and the main score canvas and SoundFont Viewer retain their existing behavior for File Manager node payloads (depends on T022)

### Implementation for User Story 4

No new implementation — this story is verified compatibility with the US1 panel identity; all work is regression coverage.

**Checkpoint**: All user stories complete and independently verifiable

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Repository-wide validation, quickstart evidence, and documentation

- [x] T029 Run full validation from `/Users/stevenyi/work/blue-electron`: `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, the repository lint/type-check commands, and `git diff --check`; fix any fallout
- [x] T030 Execute the manual parity workflow and cross-platform path checks in `specs/076-file-manager-panel/quickstart.md`; the user-confirmed manual workflow passed, while POSIX/Windows/UNC forms and capability evidence are recorded through the shared automated checks and research evidence
- [x] T031 [P] Update the AGENTS.md active-technologies entry for 076-file-manager-panel to record the new `appSpecific.fileManagerFavorites` ownership and panel surface

### Post-review follow-ups (2026-08-17)

- [x] T032 [US1] Bump File Manager text one theme-token step (tiny→ui, body→content) in `packages/blue-app/src/renderer/components/workbench/panels/tools/FileManagerPanel.tsx` and `file-manager/FileManagerTree.tsx`
- [x] T033 [US1] Make tree node ids branch-unique (`root-id#name` chains with a separate `path` field) so the same directory under overlapping roots keeps independent open state; in-flight guards, diagnostics, and the cycle filter keyed accordingly, in `packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/FileManagerTree.tsx`
- [x] T034 [US1] Preserve loaded listings, diagnostics, and open-node ids across docked/slideout remounts via a session-lifetime renderer cache seeded into react-arborist `initialOpenState`; never persisted, in `FileManagerTree.tsx`
- [x] T035 [US1] Double-click a player-supported audio file to authorize it in main (`authorize-audio-file` IPC in `packages/blue-app/src/main/main.ts`, preload/global.d.ts), open `AudioFilePlayerTopComponent`, and route it through the audio-player pending-file bus with recoverable refusal handling, in `packages/blue-app/src/renderer/components/workbench/panels/tools/FileManagerPanel.tsx` and `panels/audio-player/audio-player-formats.ts`
- [x] T036 [US1] Double-click an `.sf2` file to open `SoundFontViewerTopComponent` and route it through a SoundFont pending-file bus (`panels/tools/soundfont-viewer-bus.ts`) that reuses the viewer's existing inspection flow, in `SoundFontViewerPanel.tsx` and `FileManagerPanel.tsx`

### Completed follow-ups (2026-08-17)

- [x] T037 [US5] Preserve the tree scroll offset in the session-lifetime renderer cache and restore it on remount alongside open state, in `packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/FileManagerTree.tsx`
- [x] T038 [US5] Add `appSpecific.fileManagerRootLabels: Record<string, string>` with `mergeWithDefaults` normalization (old/missing → `{}`; non-string/blank entries discarded) in `packages/blue-app/src/shared/program-settings.ts`, extend shared tests, and serve default labels (`Root`, `Home`, plain favorite path) through `FileManagerRootSnapshot.label` in `packages/blue-app/src/main/file-manager-service.ts`
- [x] T039 [US5] Render root rows as `Label - /path` with a muted separator/path and an `Unnamed Root` fallback, and add context-menu `Rename Root` modal editing (empty submit reverts to default; fresh settings snapshot → `saveProgramSettings` → roots refresh; failed save keeps prior label) in `FileManagerTree.tsx`/`FileManagerPanel.tsx`, with renderer tests
- [x] T040 [US5] Implement focus navigation: double-click any directory, including a root, to focus it as the top-level node, breadcrumb bar (`Roots` + chain, hidden when unfocused, root labels where defined), and per-level open/closed + scroll state stacks (push on focus, pop-and-restore on navigate back) held in the session cache in `FileManagerTree.tsx`/`FileManagerPanel.tsx`, keeping delayed single-click expansion, context actions, drag sources, and tool double-click unchanged, with renderer tests
- [x] T041 [US5] Update the quickstart evidence table after executing manual steps 14–16 and re-run the affected suites (`pnpm --filter @blue/app test`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–6)**: Depend on Foundational; recommended order US1 → US2 → US3 → US4
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2; no story dependencies (MVP)
- **US2 (P1)**: After Phase 2; hosts its menus inside US1's `FileManagerTree`, so implement after T011
- **US3 (P1)**: After Phase 2; its drag source (T021) extends US1's tree and its target is independent of US2 — T019/T020 can proceed in parallel with US2
- **US4 (P2)**: Verification-only; depends on T009 (routing) and T022 (target) existing, otherwise parallelizable

### Within Each User Story

- Constitution-required verification tasks accompany every behavior/boundary change (shared → main → renderer order)
- Tests target the lowest practical boundary: pure shared helpers, main service, then renderer components
- Models/contracts before services; services before renderer integration
- Story complete and independently tested before moving to the next priority

### Parallel Opportunities

- Phase 2: T002 ∥ T004 (different shared files); then T003/T005/T006 sequence while T007 runs in parallel
- US1: T010 ∥ T013-prep; T12 ∥ T13 verification files after implementation
- US3: T019/T020 (main) ∥ T021 (renderer drag source) while US2 proceeds
- US4: T026 ∥ T027 ∥ T028 are three independent test files
- All verification tasks marked [P] can run alongside each other once their implementation dependency exists

---

## Parallel Example: User Story 3

```bash
# Launch independent implementation tracks together:
Task: T019 "Refactor media-copy preparation in packages/blue-app/src/main/score-object-file-operations.ts"
Task: T021 "[US3] Drag source helpers in packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/file-manager-drag-drop.ts"

# After T020 and T021 complete, launch independent verification together:
Task: T023 "[US3] track-layer-audio-drop.test.tsx"
Task: T024 "[US3] file-manager-service.test.ts commit tests"
Task: T025 "[US3] file-manager-panel.test.tsx drag-source tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline)
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run the US1 independent test (Window menu → expand roots → ordered, dot-free tree)
5. The panel is demoable at this point

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → test independently (MVP)
3. Add US2 → favorites persist across restart, zero disk mutations
4. Add US3 → both drop paths create exactly one clip; all rejections safe
5. Add US4 → SoundFont Viewer and layout-restore regressions green
6. Polish → full validation, quickstart evidence, documentation

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 → US2 (tree-hosted work)
   - Developer B: US3 main track (T019/T020) → joins renderer target after T011
   - Developer C: US4 regression suites after their dependencies land
3. Polish is shared

---

## Notes

- [P] tasks touch different files with no dependencies on incomplete tasks
- [Story] labels map tasks to spec.md user stories for traceability
- Every story checkpoint is independently verifiable using the Independent Test in its phase header
- Renderer paths are untrusted hints: main revalidates every root, listing, and drop request (constitution III/IV)
- Favorites are app-specific settings; audio clips are canonical project state; tree expansion state is disposable renderer state — never serialize one into another (constitution III)
- Verify bug regressions fail before implementing when the harness supports it (e.g. run the placeholder-routing test before T009)
