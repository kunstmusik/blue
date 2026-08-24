# Contract: Patch Queue Coordinator

## Responsibility

Own renderer-side batching, the 100 ms trailing scheduler, one in-flight canonical commit, revision acknowledgements, dirty-baseline restoration, refresh classification, and explicit/background failure behavior.

## Interface

```ts
export interface ProjectPatchQueueDependencies {
  commit(patches: readonly ProjectDocumentPatch[]): Promise<ProjectDocumentCommitReceipt>;
  fetchCanonicalSnapshot(): Promise<ProjectDocumentSnapshot | null>;
  applyCanonicalSnapshot(snapshot: ProjectDocumentSnapshot, preserveDirty: boolean): void;
  setDirty(dirty: boolean): void;
  reportBackgroundError(error: unknown): void;
  logRefreshError(error: unknown): void;
}

export interface ProjectPatchQueue {
  enqueue(patch: ProjectDocumentPatch, dirtyBaseline: boolean): void;
  flush(): Promise<void>;
  reset(sessionId?: number): void;
  acceptRevision(sessionId: number, revision: number): void;
  getRevision(): number;
}

export function createProjectPatchQueue(
  dependencies: ProjectPatchQueueDependencies,
): ProjectPatchQueue;
```

The implementation must use the repository's exact existing shared types. Naming may adjust to those types without changing the operation semantics.

## Scheduling and ordering

1. First enqueue captures the dirty baseline and arms one 100 ms trailing timer.
2. Later enqueues before the timer fires join the FIFO batch and reset only the existing trailing schedule behavior.
3. Only one commit promise may be active.
4. Explicit `flush()` cancels the timer, starts pending work, waits for active work, and drains patches queued while a prior batch was in flight.
5. Batch boundaries and patch order match the current implementation.

## Acknowledgement and dirty behavior

- A receipt advances revision only when `sessionId` matches the current renderer session; revision is monotonic via the existing maximum rule.
- A changed receipt keeps the session dirty.
- If the entire drain sequence reports unchanged, restore the first patch's captured dirty baseline.
- `changed: false` is an error only for the currently classified create/replace/clear Track-instrument patches.
- No new optimistic/canonical conflict-resolution policy is introduced.

## Canonical refresh

- Preserve the exact current classifiers for score, mixer, Clojure, and other structural patches.
- Required refresh happens after a successful commit and before the relevant flush resolves.
- Refresh failure after a successful commit is logged and does not change the successful receipt into a commit failure.
- Commit failure triggers the current best-effort refresh before error delivery.

## Failure behavior

- Background timer drains report failure through `reportBackgroundError`.
- Explicit `flush()` rejects to its caller.
- The failed batch is not automatically retried.
- Reset clears unsent work and timers but does not pretend to cancel an already sent IPC call.

## Test controls

The existing façade test exports remain delegates to the one production coordinator. Tests use fake timers and injected promises; production code must not grow a second test-only queue.

## Rollback

Inline the coordinator state and functions back into `project-store.ts` while keeping façade exports unchanged.
