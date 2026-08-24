# Contract: Project Session

## Responsibility

Provide the sole main-process write boundary for active project document identity, native project path, canonical revision, and project-session fence.

## Interface

```ts
export interface ProjectSessionSnapshot {
  readonly data: BlueData | null;
  readonly filePath: string | null;
  readonly revision: number;
  readonly sessionId: number;
}

export interface RecordProjectMutation {
  readonly changed: boolean;
  readonly invalidateSession?: boolean;
}

export interface ProjectSession {
  read(): Readonly<ProjectSessionSnapshot>;
  replace(data: BlueData, filePath: string | null): Readonly<ProjectSessionSnapshot>;
  close(): Readonly<ProjectSessionSnapshot>;
  publishPath(filePath: string | null): Readonly<ProjectSessionSnapshot>;
  recordMutation(change: RecordProjectMutation): ProjectDocumentCommitReceipt;
  resetForShutdown(): void;
}
```

Use the existing receipt/session types where available. The interface intentionally has no general setter or public increment operation.

## Invariants

- `ProjectSession` is the only module that assigns document identity, file path, revision, or session ID.
- The file path is stored in native OS form.
- Replacing or closing a project advances `sessionId` and resets revision to zero.
- Saving under a new path publishes the path without changing project identity.
- Unchanged mutations do not increment revision.
- Each accepted changed mutation increments revision once.
- A changed mutation with `invalidateSession` also advances `sessionId` after the revision increment and does not reset that revision; this preserves the current Java/runtime-dependency fence.
- `read()` does not expose mutable identity fields. It may expose the canonical `BlueData` reference for existing domain operations; those operations must return through the session mutation boundary for acknowledgement.

## Explicit exclusions

`ProjectSession` does not own BrowserWindows, playback, Blue Live, engine connections, Java/JavaScript runtime managers, MIDI imports/input, missing-audio UI sessions, on-load caches, recent files, render jobs, or temporary files. `project-lifecycle.ts` coordinates these owners during replace/close.

## Replacement protocol

1. Lifecycle coordinator fences or cancels dependent operations in the existing order.
2. Load/migration validates the candidate `BlueData` without changing the active identity.
3. Coordinator calls `replace` exactly once after the candidate is accepted.
4. Dependent caches/editors are reset or rebound.
5. Existing snapshot/path/recent-file events are published to the same targets and in the same order.
6. On pre-replacement failure, the previous session remains active. On a failure after replacement, use the established recovery behavior; do not invent transactional rollback of `BlueData`.

## Error behavior

Invalid operations such as publishing a path without an active project must follow a single tested fail-closed policy chosen during implementation (throw internally or return unavailable) while preserving each existing IPC-facing error contract through the registrar adapter.

## Verification

- Transition table tests for empty, unsaved, saved, replaced, closed, and shutdown states.
- Monotonic session/revision tests.
- Native Windows drive/UNC and POSIX path preservation tests.
- Existing project open/new/save/revert/replacement and document-commit tests through the stable IPC façade.

## Rollback

Restore identity fields in `main.ts` and redirect lifecycle reads/writes in one ownership commit. Registrar extraction must not be coupled to this rollback.
