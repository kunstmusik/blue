# Implementation Plan: Java-Compatible Code Repository Library

**Branch**: `069-code-repository` | **Date**: 2026-08-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/069-code-repository/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Implement a Java-compatible Code Repository as a user-global, project-facing library. The
repository remains outside `BlueData`, `.blue` project XML, and the unified-library type system.
The main process owns a dedicated SQLite database under Electron user data, while `@blue/data`
owns the platform-neutral tree model and legacy XML codec. A typed preload contract connects the
main-process repository service to a split-pane CRUD dialog and dynamic Csound editor context-menu
integration. First-use migration imports `~/.blue/codeRepository.xml` when present, preserves the
source file, and otherwise creates the protected root programmatically with no packaged seed XML.

## Technical Context

**Language/Version**: TypeScript 5.8 in strict mode; React 19; Electron 35.7.5 with embedded Node 22

**Primary Dependencies**: `@blue/data`, `@rgrove/parse-xml`, Electron `node:sqlite` (`DatabaseSync`),
`node:worker_threads`, Zustand 5, `react-arborist`, CodeMirror 6, Radix Context Menu, Vitest 4

**Storage**: Main-owned `blue_code_repository.sqlite` under `app.getPath('userData')`; separate
`blue-code-repository-state.json` for migration/recovery state; immutable legacy XML sources under
`~/.blue` or explicitly selected paths; `.blue` remains unchanged

**Testing**: Vitest unit/integration tests, typed IPC contract tests, renderer component tests,
existing Electron/Playwright smoke patterns where practical, focused package tests, `pnpm test`,
`pnpm lint`, and affected package builds

**Target Platform**: Electron desktop on macOS, Windows, and Linux

**Project Type**: Desktop application with portable data package, Electron main/preload boundary,
and React renderer

**Performance Goals**: Load and render a repository of at least 500 nodes without a full project
reload; repository menu generation and snippet insertion remain interactive; migration is one
transaction rather than one write per node

**Constraints**: `@blue/data` must remain Node/Electron/DOM-free and use static imports; main owns
filesystem and SQLite; `.blue` is not mutated; legacy XML is not overwritten; storage failures
must not block project or unified-library use; existing worktree changes must remain untouched

**Scale/Scope**: One user-global repository per application installation; one protected root;
arbitrarily nested groups within normal UI limits; snippets are plain Csound text; no sync,
authentication, project-local scope, or `.binstr` support in this feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Portable data core**: PASS — Code Repository node types, validation, and XML parsing/serialization
  live in `@blue/data` without Electron, Node built-ins, DOM APIs, dynamic imports, or host details.
- **Java and project compatibility**: PASS — behavior is based on Java Blue's
  `CodeRepositoryManager`, `CodeRepositoryDialog`, `CodeRepositoryMenu`, and
  `AddToCodeRepositoryAction`. `.blue` and CSD generation are unaffected; legacy XML and exact
  snippet text receive round-trip coverage. Fresh TS Blue installs intentionally use an empty
  programmatic root instead of Java's packaged default seed.
- **Canonical ownership and contracts**: PASS — the main-process Code Repository service owns the
  dedicated database and migration state; renderer drafts and menu snapshots are transient; typed
  preload IPC defines snapshot, mutation, import/export, revision-conflict, and failure behavior.
- **Runtime and engine isolation**: PASS — filesystem, user-data paths, SQLite, worker threads, and
  legacy import are main-process responsibilities. The feature does not launch Java or connect to
  Blue Engine; neither renderer nor `@blue/data` accesses host APIs.
- **Verification evidence**: PASS — codec fixtures, repository transaction tests, migration tests,
  IPC contract tests, renderer/editor-menu tests, restart/quickstart scenarios, and affected
  `@blue/data`/`@blue/app` test, lint, and build commands are specified below.

## Project Structure

### Documentation (this feature)

```text
specs/069-code-repository/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── code-repository-ipc.md
└── tasks.md
```

### Source Code (repository root)
```text
packages/blue-data/src/libraries/
├── code-repository.ts
├── code-repository-codec.ts
└── code-repository-codec.test.ts

packages/blue-app/src/main/code-repository/
├── schema.ts
├── repository.ts
├── repository-client.ts
├── repository-worker.ts
├── service.ts
├── migration-state-store.ts
├── recovery.ts
└── ipc.ts

packages/blue-app/src/shared/
├── code-repository.ts
└── code-repository.test.ts

packages/blue-app/src/preload/preload.ts
packages/blue-app/src/main/application-menu.ts
packages/blue-app/src/main/main.ts

packages/blue-app/src/renderer/components/workbench/panels/code-repository/
├── CodeRepositoryDialog.tsx
├── CodeRepositoryTree.tsx
├── CodeRepositorySnippetEditor.tsx
└── AddToCodeRepositoryDialog.tsx

packages/blue-app/src/renderer/components/workbench/panels/editors/
├── csound-editor-menu.ts
├── CsoundEditorContextMenu.tsx
└── csound-editor-actions.ts
```

**Structure Decision**: Keep a deep Code Repository module behind a main-process service seam.
`@blue/data` owns only portable models and XML codecs. The main process owns the database,
filesystem, migration, revision, and recovery implementation. Preload exposes a serializable
contract. Renderer components own only drafts, tree presentation, editor focus, and context-menu
composition. The Code Repository is deliberately not added as a fifth `LibraryType`; its ordered
group/snippet model is materially different from unified-library payloads.

## Post-Design Constitution Re-check

- **Portable data core**: PASS — the data model and XML codec remain pure; the design places all
  SQLite, filesystem, user-data, and Electron behavior in `@blue/app` main.
- **Java and project compatibility**: PASS — the model maps the Java XML names and ordering, the
  migration source remains untouched, export omits internal IDs, and `.blue` ownership is unchanged.
  The intentional empty-first-run and global-database divergences are documented in the
  specification and research.
- **Canonical ownership and contracts**: PASS — `CodeRepositoryService` is the sole durable owner;
  the IPC contract defines snapshots, revisions, typed errors, import/export, and change events;
  renderer drafts cannot silently overwrite newer revisions.
- **Runtime and engine isolation**: PASS — no engine or Java runtime changes are needed; host APIs
  remain in main and the renderer only receives serializable repository values.
- **Verification evidence**: PASS — data-model invariants, XML round trips, SQLite transactions,
  migration failure recovery, IPC errors/events, UI flows, editor insertion, quickstart scenarios,
  and package validation commands are covered by the design documents.

## Complexity Tracking

No constitution violations. The separate repository module is required for the explicit state
ownership and failure-isolation boundary; adding Code Repository as a fifth unified-library type
was evaluated and rejected in `research.md` because its tree semantics and recovery boundary are
different.
