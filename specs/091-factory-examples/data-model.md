# Data Model: Factory Example Content

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

The Electron main process owns every entity below. Factory and user content remain native
filesystem files; durable provenance is stored in a versioned JSON sidecar under Blue's per-user
example-library root. None of this state enters `.blue` XML, program settings, renderer state, or
engine protocols.

## Durable Entities

### FactoryManifest

An immutable snapshot of the installed factory tree for one app session.

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | `1` | Required; unsupported versions are rejected |
| `revision` | `sha256:<64 lowercase hex>` | Hash of the canonical manifest payload |
| `files` | `FactoryFileManifestRecord[]` | Sorted by `relativePath`; unique paths; regular files only |

`generatedAt` and absolute factory paths are intentionally absent so the same content produces the
same revision across installations and platforms.

### FactoryFileManifestRecord

| Field | Type | Rules |
|---|---|---|
| `relativePath` | `PortableExamplePath` | Non-empty, `/` separated, relative, normalized, no `.` or `..` segment |
| `sha256` | `64 lowercase hex` | Hash of exact file bytes |
| `size` | non-negative integer | Exact byte count used for validation and diagnostics |

The factory traversal rejects symlinks, device entries, sockets, and platform-equivalent path
collisions. Empty directories are not semantically relevant because Open Example consumes files
and relative file structure.

### UserLibraryState

Persisted as `<userData>/examples/current/state.json` only after a complete generation is ready.

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | `1` | Required; unsupported/unreadable state blocks mutation and preserves content |
| `acceptedFactoryRevision` | `FactoryRevision` | Revision last copied or fully processed by Update and Open |
| `declinedFactoryRevision` | `FactoryRevision \| null` | Installed revision last declined; cleared after a successful update |
| `baselines` | `FactoryBaselineRecord[]` | Sorted, unique, includes current and previously removed factory paths |
| `lastCompletedAt` | ISO-8601 string | Diagnostic timestamp; excluded from revision identity |

A library is valid only when `current/content/` is a directory and `state.json` is valid. Missing
individual files do not invalidate it; they are classified as user deletions.

Validation invariants:

- Recomputing the manifest revision from records where `factoryPresent === true` MUST equal
  `acceptedFactoryRevision`.
- `declinedFactoryRevision` may equal neither, either, or (after a recovered old state) the accepted
  revision; equality is normalized to `null` on the next successful write.
- Absolute paths and host-specific separators MUST NOT be persisted.
- Invalid state MUST NOT be replaced with defaults over an existing `content/` tree.

### FactoryBaselineRecord

The accepted factory reference used to classify the corresponding user entry.

| Field | Type | Rules |
|---|---|---|
| `relativePath` | `PortableExamplePath` | Same serialized path contract as the manifest |
| `factorySha256` | `64 lowercase hex` | Most recently processed installed bytes for this path |
| `factorySize` | non-negative integer | Most recently processed installed byte count |
| `factoryPresent` | boolean | `false` is a tombstone for content removed from factory |

The record describes factory provenance, not the current user entry. User state is derived by
comparing the live entry with this record; no mutable `userModified` flag can become stale.

### ExampleLibraryOperationJournal

Persisted as `<userData>/examples/operation.json` only while activating a candidate generation.

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | `1` | Required |
| `operationId` | opaque identifier | Used only to match Blue-owned staging/backup directory names |
| `kind` | `'initialize' \| 'update'` | Transaction intent |
| `phase` | `'prepared' \| 'backup-created' \| 'activated'` | Last durably recorded commit phase |
| `stagingDirectoryName` | `staging-<operationId>` | Single safe path segment; never absolute |
| `backupDirectoryName` | `backup-<operationId> \| null` | Single safe path segment; null for initial activation before needed |
| `sourceUserRevision` | `sha256:<hex> \| null` | Full user-tree snapshot used for an update; null for initialization |
| `targetFactoryRevision` | `FactoryRevision` | Candidate state's accepted revision |
| `startedAt` | ISO-8601 string | Diagnostic timestamp |

The journal is written atomically and fsynced before the first rename. Recovery acts only on names
validated against the operation id and library parent; malformed journals block mutation rather
than broadening deletion scope.

## Derived Runtime Entities

### UserEntrySnapshot

One observed relative path in the current user content tree.

| Field | Type | Description |
|---|---|---|
| `relativePath` | `PortableExamplePath` | Portable identity used by merge planning |
| `kind` | `'regular' \| 'directory' \| 'symlink' \| 'other'` | `lstat` classification; symlinks are never followed for update classification |
| `sha256` | `string \| null` | Present only for regular files |
| `size` | `number \| null` | Present only for regular files |

The canonical hash of all sorted snapshots is `sourceUserRevision`. It detects external or
late project saves between candidate preparation and transaction activation.

### ExampleLibraryInspection

Discriminated result returned before prompts.

| Status | Required data | Meaning |
|---|---|---|
| `needs-initialization` | valid factory manifest | No valid current user generation exists |
| `ready` | current root/state, factory manifest | Installed revision equals accepted revision |
| `declined-current` | current root/state, factory manifest | Installed revision equals the remembered declined revision |
| `update-available` | current root/state, factory manifest | Installed revision matches neither accepted nor declined |
| `factory-unavailable` | current root/state | Current user library is usable; factory update is unavailable |
| `invalid-user-library` | path + diagnostic | User content/state is ambiguous; preserve it and block mutation |
| `unavailable` | diagnostic | Neither a valid factory source nor valid user library can open |

Interrupted recognized transactions are recovered before an inspection is returned.

### ExampleUpdatePlan

Pure merge output for one accepted update.

| Field | Type | Description |
|---|---|---|
| `sourceUserRevision` | `sha256:<hex>` | Snapshot that candidate content was based on |
| `installedFactoryRevision` | `FactoryRevision` | Revision being accepted |
| `actions` | `ExampleMergeAction[]` | Deterministic path-sorted action list |
| `nextState` | `UserLibraryState` | Baselines after processing installed factory content |
| `summary` | `ExampleUpdateSummary` | Counts and conflict paths used by native UI and tests |

### ExampleMergeAction

| Kind | Candidate behavior | Conflict? |
|---|---|---|
| `add-factory` | Copy new factory file because no user entry/baseline exists | No |
| `replace-untouched` | Copy changed factory file because user bytes equal old baseline | No |
| `keep-unchanged` | Keep bytes; factory and baseline are unchanged | No |
| `preserve-user-modified` | Keep changed user file | Yes when factory also changed |
| `preserve-user-deleted` | Keep path absent | Yes when factory currently contains the path |
| `preserve-collision` | Keep user entry/type that occupies a new factory path | Yes |
| `preserve-factory-removed` | Keep user entry or deletion and retain tombstone | No automatic deletion |
| `preserve-user-only` | Copy user-only entry/tree to candidate | No |

Path-type collisions at an ancestor block all affected factory descendants and are reported; no
file, directory, or symlink is replaced to force a factory shape.

### CandidateGeneration

Blue-owned complete library prepared below `<userData>/examples/staging-<id>/`.

| Field | Type | Description |
|---|---|---|
| `operationId` | string | Matches owned staging names and optional journal |
| `kind` | `'initialize' \| 'update'` | Candidate origin |
| `rootPath` | native absolute path | Filesystem-only path, never serialized into state |
| `contentPath` | native absolute path | Picker root while candidate is prepared |
| `state` | `UserLibraryState` | Validated next state written inside candidate root |
| `sourceUserRevision` | string \| null | Rechecked immediately before update activation |
| `summary` | `ExampleUpdateSummary \| null` | Null for initial copy |
| `lifecycle` | `'preparing' \| 'prepared' \| 'committing' \| 'committed' \| 'aborted'` | In-memory operation state |

## Relationships

```text
FactoryManifest 1 ── * FactoryFileManifestRecord
UserLibraryState 1 ── * FactoryBaselineRecord
UserLibraryState.acceptedFactoryRevision == revision(baselines where factoryPresent)

FactoryManifest + UserLibraryState + current UserEntrySnapshot
    └──> ExampleUpdatePlan ──> CandidateGeneration

CandidateGeneration 0..1 ── 1 ExampleLibraryOperationJournal (during activation only)
CandidateGeneration.commit() ──> examples/current/{content,state.json}
```

## State Transitions

```text
no current library
  -- Open Example / Copy and Open --> preparing candidate
  -- picker + replacement gates accepted --> commit --> ready(accepted = installed)
  -- any cancel/failure --> no current library; staging aborted

ready(accepted = installed) -- Open Example --> picker(current/content)

ready(installed != accepted and installed != declined)
  -- Keep Current and Open --> declined-current(declined = installed) --> picker(current/content)
  -- Update and Open --> prepare candidate --> picker(candidate/content)
       -- replacement gates accepted --> commit --> ready(accepted = installed, declined = null)
       -- cancel/failure/source changed --> previous ready state; candidate aborted

interrupted operation
  -- valid journal + valid candidate --> finish activation --> ready
  -- invalid/missing candidate + valid backup --> restore backup --> previous ready state
  -- ambiguous/unrecognized paths --> invalid-user-library; preserve and block
```

## Persistence and Recovery Boundaries

- `state.json` and `operation.json` use temp-file write, file fsync, rename, and best-effort parent
  directory fsync, matching the repository's durable migration-state pattern.
- Candidate and backup trees are derived transaction generations. Only directories tied to a valid
  journal/operation id are eligible for automatic cleanup.
- User `content/` is canonical user work. It is never treated as disposable and is never
  recursively removed outside a validated generation swap/recovery step.
- Factory content is read-only input. No operation creates a temporary file or sidecar beneath the
  packaged factory root.
