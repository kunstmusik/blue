# Code Repository IPC Contract

This contract separates the main-process canonical repository from renderer drafts and editor
menu state. All values crossing preload are serializable and validated at the receiving boundary.

## Shared types

```ts
type CodeRepositoryNodeKind = 'root' | 'group' | 'snippet';

interface CodeRepositoryNode {
  id: string;
  kind: CodeRepositoryNodeKind;
  name: string;
  parentId: string | null;
  order: number;
  code?: string;
  children?: CodeRepositoryNode[];
}

interface CodeRepositorySnapshot {
  root: CodeRepositoryNode;
  contentRevision: number;
  initialized: boolean;
}

interface CodeRepositoryChangedEvent {
  contentRevision: number;
  reason: 'commit' | 'import' | 'recovery';
}
```

The public snapshot omits filesystem paths, SQLite identifiers beyond stable node IDs, raw SQL,
and migration internals.

## Main/preload methods

### Read

```text
codeRepository.getSnapshot() -> CodeRepositorySnapshot
codeRepository.getStatus() -> {
  available: boolean,
  migrationStatus: 'not-started' | 'succeeded' | 'failed' | 'skipped',
  diagnostic?: CodeRepositoryDiagnostic
}
```

`getSnapshot` returns the current canonical tree. A storage failure returns a typed error rather
than an empty tree, preventing an accidental overwrite.

### Atomic draft commit

```text
codeRepository.commitDraft({
  expectedRevision: number,
  root: CodeRepositoryNode
}) -> CodeRepositorySnapshot
```

The main process validates the complete tree and commits it atomically. If the expected revision
does not match, it returns `revision-conflict` with the current snapshot and makes no change.

### Atomic single-node operations

```text
codeRepository.createGroup({
  parentId: string,
  name: string,
  expectedRevision: number
}) -> CodeRepositorySnapshot

codeRepository.createSnippet({
  parentId: string,
  name: string,
  code: string,
  expectedRevision: number
}) -> CodeRepositorySnapshot

codeRepository.moveNode({
  nodeId: string,
  parentId: string,
  order: number,
  expectedRevision: number
}) -> CodeRepositorySnapshot

codeRepository.updateNode({
  nodeId: string,
  name?: string,
  code?: string,
  expectedRevision: number
}) -> CodeRepositorySnapshot

codeRepository.deleteNode({
  nodeId: string,
  expectedRevision: number
}) -> CodeRepositorySnapshot
```

These operations reject root mutation, invalid parents, descendant cycles, snippet children, and
stale revisions.

### Import/export

```text
codeRepository.importFile({
  expectedRevision: number
}) -> {
  snapshot: CodeRepositorySnapshot,
  importedNodeCount: number,
  sourceHash: string
}

codeRepository.exportXml() -> {
  basename: string
}

codeRepository.retry() -> CodeRepositoryStatus
```

The main process owns the native import chooser and reads the selected XML itself. The renderer
submits only the expected revision and receives `null` for a cancelled chooser; it never receives
arbitrary filesystem paths or raw XML input. File writing likewise remains main-process owned.
Successful export reports only the selected file's basename. Status and error diagnostics also use
path-independent source labels rather than exposing resolved filesystem locations.

## Events

```text
codeRepository.onChanged(listener: (event: CodeRepositoryChangedEvent) => void)
```

All renderer windows receive a change event after a successful commit, import, or recovery. A
renderer may then call `getSnapshot`; events do not carry the full tree and are not the canonical
state. Preload validates every IPC success/error envelope before exposing it to the renderer and
returns a typed `storage-unavailable` result for malformed responses.

## Error contract

Errors have stable codes and user-safe messages:

| Code | Meaning | Required behavior |
|---|---|---|
| `storage-unavailable` | Database cannot be opened/read/written | Keep current project and unified libraries usable; offer recovery |
| `invalid-tree` | Draft violates tree invariants | Do not commit; identify the invalid node when possible |
| `revision-conflict` | Another window committed newer data | Return current snapshot; let UI reload or preserve draft |
| `invalid-legacy-xml` | XML is malformed or unsupported | Do not partially import; preserve source; show diagnostics |
| `source-unreadable` | Selected or discovered source cannot be read | Preserve existing repository; show path-independent diagnostic |
| `export-failed` | XML could not be prepared or written | Leave database unchanged; report failure |
| `not-initialized` | Repository has not completed initialization | Run initialization or show recoverable status |

## Editor menu contract

The renderer builds the Csound context menu from the current `CodeRepositorySnapshot`:

- Every group becomes a submenu.
- Every snippet becomes an insertion item carrying its code text or a stable node ID resolved at
  selection time.
- Selecting a snippet invokes the existing editor insertion seam and replaces the current
  selection when one exists.
- Add-to-Repository is enabled only when the editor reports a non-empty selection and editability.
- A successful add operation triggers the normal repository change event; no project patch is sent.
