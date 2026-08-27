# Implementation Plan: Factory Example Content

**Branch**: `091-factory-examples` | **Date**: 2026-08-26 | **Spec**: [spec.md](spec.md)

**Status**: Implemented and accepted (2026-08-26)

**Input**: Feature specification from `/specs/091-factory-examples/spec.md`

## Summary

Make packaged examples immutable factory input and lazily create a complete user-owned working
library when `Open Example` is invoked. A main-process example-library module hashes the actual
installed tree into a deterministic SHA-256 manifest, stores accepted per-file baselines beside the
user copy, and classifies updates without overwriting modified, deleted, collided, or user-created
entries. Initial copy and updates are built as complete candidate generations; the example picker
and existing project replacement gates run against that candidate before a journaled same-filesystem
swap activates it. Future opens prefer the user library, suppress prompts for accepted/declined
content revisions, and recover recognized interrupted transactions only on the next Open Example.

No project XML, render protocol, engine, renderer, preload, or normal Open Project behavior changes.

## Technical Context

**Language/Version**: TypeScript 5.8 in strict mode, ES2022 target, Electron 35.7.5 main process
(Node 22 development/runtime APIs available through Electron).

**Primary Dependencies**: Existing Electron `app`, `dialog`, and `BrowserWindow`; Node built-ins
`fs`, `path`, and `crypto`; existing `showNativeConfirmation`, `runReplacementFlow`/
`runProjectFileReplacement`, `BlueData.loadFromString`, and project install lifecycle. No new
runtime dependency.

**Storage**: Packaged factory files under `resources/assets/examples`; durable user library under
`app.getPath('userData')/examples/current/{content,state.json}`; transient candidate, backup, and
operation journal under the same `examples/` parent. State is versioned JSON outside `.blue` XML and
outside `program-settings.json`.

**Testing**: Vitest 4 with dependency-injected filesystem/dialog seams, native temporary directories,
synthetic Windows path fixtures, injected `EACCES`/`EPERM`/copy/rename failures, and focused main-flow
ordering tests. Packaged/manual acceptance follows [quickstart.md](quickstart.md).

**Target Platform**: Packaged and development Electron desktop app on macOS, Windows, and Linux.

**Project Type**: Desktop app; main-process filesystem and menu lifecycle feature inside
`packages/blue-app`.

**Performance Goals**: Zero application-startup I/O for this feature. Factory hashing and user
copy/update work occur only after `Open Example`; the current 107-file/~18-MB factory tree is hashed
sequentially with bounded per-file memory and cached for the app session. Same-revision opens do not
rehash user content or rebuild a copy.

**Constraints**: Factory content receives zero writes. Updates never overwrite/delete user-modified,
user-deleted, user-created, collided, or factory-removed content. All decisions fail closed. Partial
copies are never exposed as current. Native host paths remain unchanged for filesystem APIs;
manifest/state paths use validated `/`-separated relative text. No POSIX `chmod` assumption in
cross-platform tests.

**Scale/Scope**: One example tree (currently 107 files/~18 MB) copied as a coherent unit; expected to
remain in the low hundreds of files and tens of megabytes. One current generation, at most one
candidate, and at most one rollback generation exist during an operation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

### Pre-Research Gate

- **Portable data core**: PASS — all production changes are in `@blue/app` main-process source.
  `@blue/data` remains host-neutral; no Node/Electron imports, dynamic imports, or project-model
  changes are introduced.
- **Java and project compatibility**: PASS — references are Java
  `OpenExampleProjectAction.java` and `TempFileManager.java`. The user-visible divergence is
  intentional and already specified: Open Example uses a user-owned copy instead of the installed
  path. `.blue` XML, unknown data, generated CSD content, relative asset spelling, and normal project
  parse/install behavior remain unchanged.
- **Canonical ownership and contracts**: PASS — Electron main owns factory discovery, user-library
  files, manifest/provenance state, operation journal, native decisions, and project replacement
  sequencing. The canonical project remains `BlueData` plus its selected user-copy path. Contracts
  define validation, merge, recovery, and failure outcomes; no state enters project XML/settings.
- **Runtime and engine isolation**: PASS — filesystem/crypto/dialog work stays in Electron main.
  Renderer, preload, Java runtime, Blue Engine client/protocol, ZeroMQ, and native engine code are
  untouched.
- **Host-path portability**: PASS — filesystem calls use native paths. Portable manifest paths are
  produced/consumed at one validated boundary, and candidate selection uses realpath containment.
  Windows case/separator collisions and injected ACL-style errors receive focused coverage.
- **Verification evidence**: PASS — planned pure manifest/merge/state tests, transaction/recovery
  filesystem tests, dependency-injected Open Example flow tests, existing project replacement/path
  regression tests, packaged acceptance, `build:main`, full `@blue/app` tests, lint, and whitespace
  validation are defined in [quickstart.md](quickstart.md).

## Project Structure

### Documentation (this feature)

```text
specs/091-factory-examples/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── example-library-lifecycle.md
│   ├── example-library-state.md
│   └── example-update-merge.md
├── checklists/
│   └── requirements.md
└── tasks.md                         # Phase 2 output; not created by /speckit-plan
```

### Source Code (repository root)

```text
packages/blue-app/
├── assets/examples/                 # EXISTING immutable factory source; content unchanged
├── electron-builder.yml             # EXISTING extraResources packaging contract; verify unchanged
└── src/main/
    ├── example-project-path.ts       # EXISTING packaged/dev factory-root resolver
    ├── example-project-path.test.ts  # EXTEND missing/unreadable source cases as needed
    ├── example-library/              # NEW main-owned durable filesystem domain
    │   ├── path-boundary.ts          # native containment <-> portable relative path conversion
    │   ├── path-boundary.test.ts     # POSIX/Windows/collision/traversal fixtures
    │   ├── manifest.ts               # deterministic traversal, SHA-256 files + factory revision
    │   ├── manifest.test.ts          # ordering, binary content, symlink/type/collision rejection
    │   ├── merge-plan.ts             # pure baseline/user/factory classification
    │   ├── merge-plan.test.ts        # complete merge matrix and tombstone coverage
    │   ├── state-store.ts            # state/journal validation + durable atomic writes
    │   ├── state-store.test.ts       # malformed/future/interrupted/fsync/rename failures
    │   ├── service.ts                # inspect, stage, commit, abort, recovery deep-module API
    │   └── service.test.ts           # real temp-tree copy/update/recovery + injected failures
    ├── open-example-project-flow.ts  # NEW dependency-injected prompt/picker/replacement coordinator
    ├── open-example-project-flow.test.ts
    ├── project-replacement-flow.ts   # EXISTING sequencing primitive; behavior preserved
    ├── native-confirmation.ts        # EXISTING fail-closed native decision wrapper
    └── main.ts                       # REPLACE direct packaged picker wiring with coordinator deps
```

**Structure Decision**: The feature remains entirely in `@blue/app` main. The new
`example-library/` directory is one durable filesystem module: callers see only inspect,
prepare/commit/abort, decline, and recovery outcomes; hashing, path conversion, merge records,
staging names, and sidecars remain hidden. Deterministic pieces are split into small pure/testable
files, while `service.ts` owns filesystem effects and transaction invariants. The separate
`open-example-project-flow.ts` owns user-decision ordering and candidate cleanup without importing
Electron directly, keeping `main.ts` wiring small and preserving the existing replacement flow.

## Key Design Decisions

1. **Factory writeability is irrelevant.** Every packaged/dev factory tree is immutable policy
   input. The picker never returns a factory path as the active project.
2. **Use a runtime content manifest.** Sequential SHA-256 hashing of sorted portable paths, sizes,
   and bytes identifies the actual installed content, including repackages and downgrades. Cache it
   per app session; do not add a generated build artifact or app-version coupling.
3. **Keep provenance beside the copy, not in settings/project XML.** A versioned `state.json`
   stores accepted/declined revisions and per-path factory baselines, including tombstones. Live
   user modification status is always derived, never trusted from a stale boolean.
4. **Prepare before replacing.** Copy/update into a complete candidate, show/validate the picker in
   that candidate, and parse the selected project before existing library/save prompts. Commit the
   candidate and install the parsed project as one accepted replacement outcome. Any earlier cancel
   aborts the candidate.
5. **Stage the whole user tree for update.** Copy current user content without dereferencing
   symlinks, overlay only safe factory add/replace actions, verify candidate hashes/state, then
   recheck the source user-tree revision before activation. This preserves unrelated user files and
   detects concurrent saves/external edits.
6. **Never infer deletion permission.** Missing baseline files are user deletions; removed factory
   paths become tombstones; new/changed path collisions preserve user entries. No automatic update
   action removes a user path.
7. **Journal the generation swap.** Candidate/backup/current are siblings on the same filesystem.
   An fsynced phase journal lets the next explicit Open Example finish activation or restore the
   verified backup after interruption; ambiguous/unowned paths are preserved and block mutation.
8. **Revision equality controls prompting.** Installed content is offered when it matches neither
   accepted nor declined hash. Keep Current records the decline; Update advances accepted baselines
   even where conflicts are preserved. There is no newer/older hash ordering.
9. **Keep authority in main.** Native decisions use `showNativeConfirmation`; no preload/IPC/UI
   surface is added. Selection outside the candidate/current example root is rejected with guidance
   to use Open Project.
10. **Do not broaden rendering scope.** `writeTempCsdSnapshot` and normal Open Project behavior stay
    unchanged. This feature fixes packaged examples by ensuring their active project directory is
    user-owned and writable.

## Phase 1 Post-Design Constitution Recheck

- **Portable data core**: PASS — designed files import Node/Electron only under `src/main`; no data
  package or XML changes.
- **Java and project compatibility**: PASS — the lifecycle contract explicitly records the
  installed-tree divergence while routing parsed examples through unchanged `BlueData` and project
  install contracts. Full relative trees are copied byte-for-byte before user edits.
- **Canonical ownership and contracts**: PASS — [state](contracts/example-library-state.md),
  [merge](contracts/example-update-merge.md), and
  [lifecycle](contracts/example-library-lifecycle.md) contracts identify one owner, versioned stores,
  state transitions, typed outcomes, cancellation, and interrupted-operation recovery.
- **Runtime and engine isolation**: PASS — design introduces no renderer, preload, Java-runtime,
  engine, process-launch, or protocol dependency.
- **Host-path portability**: PASS — the design names native, canonical identity/containment, and
  portable serialized forms separately; it rejects traversal/symlink escapes and requires native
  Windows CI or synthetic Windows fixtures plus injected permission errors.
- **Verification evidence**: PASS — [quickstart.md](quickstart.md) traces initial copy, same-revision
  reopen, safe update, decline/downgrade, cancellation, path security, transaction interruption,
  relative-asset render, and zero factory writes to focused tests and package gates.

## Complexity Tracking

No constitution violations. The five-file example-library core plus one flow coordinator reflects
five independently testable concerns—path boundaries, portable manifest identity, pure merge
policy, durable state, and recoverable filesystem transactions—behind one small service interface.
Folding them into `main.ts` or one large file would not remove behavior; it would hide failure
boundaries and make Windows/interruption tests depend on Electron.
