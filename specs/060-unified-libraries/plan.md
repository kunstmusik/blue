# Implementation Plan: Unified Libraries

**Branch**: `060-unified-libraries` | **Date**: 2026-07-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification and design constraints from `/specs/060-unified-libraries/`

**Note**: This file is the `/speckit.plan` output. `/speckit.tasks` creates the dependency-ordered task breakdown later.

## Summary

Replace the four disconnected or deferred library experiences with one app-wide Libraries workbench panel and durable user-library repository. Electron main owns a `blue_libraries.sqlite` database through the SQLite runtime bundled with Electron, serializes repository work in a worker thread, performs all file dialogs/import/export/recovery, and composes user content with project-owned sources from canonical `BlueData`. Pure raw-first codecs in `@blue/data` preserve Java Blue XML exactly until a fully supported editor saves an item. Main-owned editor sessions protect drafts and detect revision conflicts, while Dockview supplies the right-side browser plus stable dynamic Library Item editor tabs. The existing `.blue` project format remains authoritative for Project Orchestra, project UDOs, Project Shared SoundObjects, and mixer/score insertions.

## Technical Context

**Language/Version**: TypeScript 5.8.x in strict mode; React 19.x; Electron pinned to 35.7.5 with embedded Node 22.16.0 and SQLite 3.49.1

**Primary Dependencies**: built-in `node:sqlite` (`DatabaseSync` and `backup`) and `node:worker_threads` in Electron main; existing `@rgrove/parse-xml` and `@blue/data` models/codecs; Electron `app`/`dialog`/IPC; Dockview 5.2.0; Zustand 5.x; `react-arborist` 3.5.x; Radix menus; existing type-specific Instrument/UDO/Effect/SoundObject editors

**Storage**: main-owned `${app.getPath('userData')}/blue_libraries.sqlite`; separate atomic `${app.getPath('userData')}/blue-libraries-state.json` for legacy-migration/recovery state; verified pre-upgrade SQLite backups beside the database; `.blue` XML remains the only project persistence

**Testing**: Vitest 4.x for `@blue/data`, shared contracts, repository/service, main IPC, stores, workbench, and renderer behavior; Java/Electron compatibility fixtures; temporary-file SQLite tests; exact Electron runtime smoke test; `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, and `git diff --check`

**Target Platform**: Electron desktop on macOS, Windows, and Linux; local application user-data storage only

**Project Type**: monorepo desktop application with a pure cross-runtime data package plus Electron main/preload/renderer layers

**Performance Goals**: meet SC-006 with 10,000 user items: initial hierarchy within 2 seconds and at least 95% of folder expansions/name searches within 1 second; lazy payload loading; IPC and repository work must not stall playback or visible UI

**Constraints**: no Node built-ins, UI dependencies, dynamic imports, or `require()` in `@blue/data`; Java XML import never executes code or resolves external entities; unsupported or nested-unsupported XML remains byte-preserved and authoritative; all compound writes and each source import are transactional; Export All must roll back earlier destination changes on failure; one user-library database owner; no continuous synchronization with `~/.blue`; no `.blue` schema changes
**Scale/Scope**: four user-library roots, project sources for Instruments/UDOs/Project Shared SoundObjects, contextual Effect and Score targets, 10,000+ user items, stable UUID nodes, import history and conditional undo, startup migration, compatibility reporting, recovery, one Libraries auxiliary panel, and multiple stable Library Item editor sessions

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- **I. Data-First, UI-Separated**: PASS. Raw Java-library codecs, support classification, validation, preview extraction, and copy/time conversion helpers live in pure `@blue/data`. SQLite, worker threads, paths, dialogs, and filesystem orchestration stay in `@blue/app` main. Renderer code presents typed snapshots only.
- **II. Backwards-Compatible Serialization**: PASS. Project-owned definitions still mutate canonical `BlueData` and save through the existing `.blue` lifecycle. Java user-library XML has explicit round-trip contracts, and imported raw payload remains authoritative until a safe supported save.
- **III. JVM Dependencies Preserved, Not Replaced**: PASS. JVM/plugin-backed and unknown objects are inert data during import, browse, and export. Unsupported content is retained rather than coerced or executed.
- **IV. Engine as External Process**: PASS. The library repository does not change the engine protocol or introduce audio-engine bindings. Existing Effect testing and project playback paths remain consumers.
- **V. Test-First for Serialization**: PASS. The implementation order begins with four-format compatibility fixtures, raw-preservation tests, supported load/save tests, nested-unsupported tests, and project-copy tests before repository/UI integration.
- **File I/O Abstraction**: PASS. `@blue/data` accepts and returns strings/typed values only. Electron main owns database and XML file I/O.
- **Research Integration**: PASS. Architecture, Java mappings, runtime selection, and alternatives are recorded in [research.md](research.md), which is the feature source of truth and cross-references the existing repository research.

## Project Structure

### Documentation (this feature)

```text
/Users/stevenyi/work/blue-electron/specs/060-unified-libraries/
├── spec.md
├── design-constraints.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── legacy-library-interchange.md
│   ├── library-service-ipc.md
│   └── project-transfer-editor-sessions.md
└── checklists/
    └── requirements.md

# tasks.md is intentionally not created by /speckit.plan.
```

### Source Code (repository root)

```text
/Users/stevenyi/work/blue-electron/packages/blue-data/src/libraries/
├── library-types.ts                         # pure shared domain vocabulary
├── legacy-library-codec.ts                  # raw-first four-format envelope codec
├── library-payload-adapters.ts              # safe decode/validate/preview/serialize
├── library-transfer.ts                      # independent-copy and time conversion helpers
└── *.test.ts                                # Java compatibility and preservation fixtures

/Users/stevenyi/work/blue-electron/packages/blue-data/src/
├── index.ts                                 # exports pure library contracts
├── instruments/instrument-category.ts       # registry-safe loading fix if required
├── instruments/instrument-registry.ts
├── serialization/obj-ref-map.ts             # seed/preserve existing project ref IDs
└── sound-objects/
    └── sound-object-library.ts               # stable Java-compatible shared IDs

/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/
├── unified-library.ts                       # browser-safe DTOs, guards, errors, channels
├── project-editor.ts                        # stable project locators/transfer patches
├── workbench-menu.ts                        # Libraries panel and legacy command alias
├── window-layout-settings.ts                # Libraries split key; legacy keys retained
└── unified-library.test.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/unified-library/
├── repository.ts                            # isolated node:sqlite adapter
├── repository-worker.ts                     # one serialized DatabaseSync connection
├── repository-client.ts                     # Promise façade for main services
├── schema.ts                                # user_version migrations and invariants
├── migration-state-store.ts                 # atomic outside-DB state JSON
├── import-export-service.ts                  # discovery, preview, reports, staged export
├── project-adapter.ts                       # project sources, targets, transfers, usage
├── editor-session-service.ts                # drafts, conflicts, close/quit guards
├── service.ts                               # orchestration, operation lease, startup/recovery
├── ipc.ts                                   # request validation and event publication
└── *.test.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/
├── main.ts                                  # composition root and lifecycle hooks
├── application-menu.ts                      # legacy Effects action routes to Libraries
├── mixer-effects-library.ts                 # retired after callers migrate
└── effect-editor-window-manager.ts           # project effect windows retained as applicable

/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/
└── preload.ts                               # named typed library methods/events

/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/
├── App.tsx                                  # always-mounted workbench and Welcome editor
├── types/global.d.ts
├── stores/
│   ├── library-store.ts                     # browse/search/selection/target view state
│   ├── library-editor-store.ts              # tab preview/pin presentation only
│   ├── project-store.ts                     # canonical project mutation integration
│   ├── ui-store.ts                          # old Effects modal state removed
│   └── workbench-store.ts                   # dynamic editor focus/restore
└── components/workbench/
    ├── WorkbenchShell.tsx
    ├── DockviewPanel.tsx
    ├── auxiliary-layout.ts                  # envelope migration and legacy panel remap
    └── panels/
        ├── LibrariesPanel.tsx
        ├── WelcomePanel.tsx
        ├── EffectLibraryModal.tsx            # removed after route migration
        ├── orchestra/                        # controlled Instrument editor reuse
        ├── udo/                              # controlled UDO editor reuse
        ├── mixer/                            # Effect target/Browse routing
        ├── score-object/                     # controlled SoundObject editor reuse
        └── libraries/
            ├── LibraryTree.tsx
            ├── LibraryPreview.tsx
            ├── LibraryTargetBanner.tsx
            ├── LibraryActionsMenu.tsx
            ├── LibraryItemEditorPanel.tsx
            └── editor-registry.tsx
```

**Structure Decision**: Put portable Java XML and domain transfer behavior in `@blue/data`; put the single durable repository, filesystem, migration, recovery, and editor-session authority in Electron main; expose only guarded serializable contracts through preload; and keep Dockview/Zustand focused on presentation. The repository is a worker-backed service rather than renderer state or a second project store.

## Phase 0: Research

Research is captured in [research.md](research.md). Resolved decisions include:

- Use Electron 35.7.5's built-in `node:sqlite`, pin that runtime exactly, isolate it behind a repository interface, and serialize production access in a worker thread; keep `better-sqlite3` only as a documented fallback.
- Normalize folders/items/import provenance in SQLite while retaining complete raw XML and derived browse metadata together. Use stable UUIDs, `PRAGMA user_version`, foreign keys, WAL, `synchronous=FULL`, and verified online backups before destructive migrations.
- Parse Java XML with `@rgrove/parse-xml` offsets so every leaf retains its exact source slice. Decode only after recursive support checks; unknown top-level or nested plugin content remains read-only raw XML.
- Keep legacy migration state in an atomic outside-database app-settings file, preventing database loss or Settings snapshot writes from silently resetting migration behavior.
- Use one transaction per compound repository change and per source file, a serialized operation lease for import/export, staged export plus rollback, and explicit per-source partial results.
- Compose user and project sources in main without changing ownership. Preserve Project Shared SoundObject IDs through the existing Java-compatible `objRefId` field, add fingerprint/ambiguity fallback for safe restore, reuse native deep-copy/time conversion rules, and reject stale or unresolved project targets before mutation.
- Keep one main-owned editor session per stable item identity and use dynamic Dockview panels for preview/pin behavior, conflict review, missing-item restore, and no-project editing.
- Always mount the workbench, represent Welcome as a central editor when no project is open, migrate the legacy SoundObject panel and Effects action to `LibrariesTopComponent`, and preserve valid saved layout state.

## Phase 1: Design And Contracts

Generated design artifacts:

- [data-model.md](data-model.md) defines durable SQLite entities, outside-DB migration/recovery state, project locators/targets, editor sessions, revisions, ordering, and transactional invariants.
- [contracts/library-service-ipc.md](contracts/library-service-ipc.md) defines the guarded preload/main request, result, event, pagination, error, and lifecycle boundary.
- [contracts/legacy-library-interchange.md](contracts/legacy-library-interchange.md) defines the four Java envelopes, lossless raw payload handling, support classification, conflict policy, migration/import, and atomic export behavior.
- [contracts/project-transfer-editor-sessions.md](contracts/project-transfer-editor-sessions.md) defines scope composition, stable project locators, insertion semantics, editor session/save conflict behavior, dirty-close guards, and Dockview/layout rules.
- [quickstart.md](quickstart.md) defines test-first implementation order and acceptance/failure verification.

## Implementation Sequence

1. Add compatibility fixtures and pure `@blue/data` envelope/payload/transfer tests, then implement raw-first codecs and close the current Instrument registry bypass.
2. Add guarded shared DTOs, SQLite schema/repository tests, the worker-backed repository, and atomic outside-DB migration-state storage.
3. Implement import preview/apply/history/conditional undo, startup migration, recovery, backup, and staged all-or-old export behind the main service.
4. Add the project adapter, stable session-aware project locators, four insertion modes, shared-SoundObject usage/delete rules, and canonical project revision/broadcast integration.
5. Add main-owned editor sessions, validation/conflict/dirty-close behavior, and controlled type-editor adapters.
6. Make the workbench available without a project, add the right-side Libraries panel and dynamic editor panels, and migrate legacy layout/menu/panel identifiers.
7. Build lazy browse/search/preview and unsupported-item organization, then add contextual Orchestra/UDO/Mixer/Score routes and target validation.
8. Retire the session-only Effects library modal/source, complete import/export/history/recovery UI, and run the full compatibility/performance/failure matrix.

## Post-Design Constitution Check

- **Data-First/UI-Separated**: PASS. The contracts keep Java-compatible object behavior in `@blue/data`, SQLite and filesystem behavior in main, and renderer drafts subordinate to main-owned editor sessions.
- **Backward-Compatible Serialization**: PASS. No project XML schema is introduced. Java library wrappers and item payloads have explicit canonical-versus-byte-preserved rules.
- **JVM Preservation**: PASS. Unknown/JVM/plugin content stays inert and exportable; insertion is disabled unless the entire object graph is supported.
- **External Engine**: PASS. No engine ownership or protocol changes.
- **Test-First Serialization**: PASS. Compatibility corpus tests precede repository/UI work and compare supported output against Java canonical behavior while requiring exact raw equality for unsupported payloads.
- **File I/O Abstraction**: PASS. All paths, SQLite, backup, dialog, and export operations remain under `@blue/app/src/main`.
- **Static Imports**: PASS. `@blue/data` and shared code use static imports only; the built-in SQLite API is statically imported only by main-owned repository code.

## Complexity Tracking

No constitution violations require an exception. The worker-backed repository and main-owned editor sessions are justified application-layer coordination mechanisms, not new data/UI packages: they keep synchronous SQLite and unsaved drafts off the renderer and Electron event loop while preserving one authority for persistence and shutdown guards.
