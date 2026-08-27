# Quickstart: Factory Example Content

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Validation proceeds from pure policy tests to real temporary-directory transactions, main-flow
ordering, the full app package, and a packaged manual render. Contracts:
[lifecycle](contracts/example-library-lifecycle.md),
[state/path](contracts/example-library-state.md), and
[merge](contracts/example-update-merge.md).

## Prerequisites

- Dependencies installed from the repository root with `pnpm install`.
- Node/Electron toolchain supported by the repository.
- For packaged manual acceptance, use a fresh OS test account/profile or a disposable VM so an
  existing personal example library is not disturbed.
- Java Blue source available at `~/work/nbprojects/blue` for parity reference; no Java artifact
  generation is required because `.blue`/CSD output does not change.

## 1. Focused Automated Tests

Run from the repository root after implementation:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/main/example-library/path-boundary.test.ts \
  src/main/example-library/manifest.test.ts \
  src/main/example-library/merge-plan.test.ts \
  src/main/example-library/state-store.test.ts \
  src/main/example-library/service.test.ts \
  src/main/open-example-project-flow.test.ts \
  src/main/example-project-path.test.ts \
  src/main/project-replacement-flow.test.ts
```

Expected focused evidence:

1. Deterministic factory revision for identical bytes regardless of traversal order, timestamps,
   installation root, or native separator form.
2. Binary and text files copy byte-for-byte; factory symlinks, non-regular entries, traversal, and
   platform-equivalent path collisions are rejected.
3. Every row in the merge matrix passes, including user modification, user deletion, user-created
   collision, path-type/ancestor collision, factory removal tombstone, and reintroduction.
4. Accepted/declined revision suppression behaves identically for upgrades, downgrades, and
   repackages because equality—not ordering—drives the offer.
5. Invalid/future state beside user content is preserved and blocks mutation; state and journal
   writes retain the previous valid document on injected failures.
6. Initial copy/update candidates remain uncommitted until all picker/save/library gates pass;
   cancellation aborts the candidate and leaves current content/project unchanged.
7. Injected `EACCES`, `EPERM`, disk/copy failure, source-snapshot change, and each rename/journal
   interruption either restore/keep the last valid generation or complete the verified candidate.
8. Open Example rejects selected files outside the offered real content root, including symlink
   escapes; normal Open Project tests remain unchanged.

Do not use POSIX `chmod` as the automated Windows-permission model. Inject native-style errors in
unit tests and run the path/transaction suite on Windows CI.

## 2. Package and Repository Gates

```bash
pnpm --filter @blue/app build:main
pnpm --filter @blue/app test
pnpm --filter @blue/app package:dir
pnpm lint
git diff --check
```

Expected:

- Main TypeScript compiles with no renderer/preload contract additions.
- All app tests pass.
- The unpacked app still contains the complete factory tree under
  `resources/assets/examples` (platform wrapper directories vary).
- Lint and whitespace checks pass.

When the implementation spans only `@blue/app`, repository-wide `pnpm test` is the final expanded
gate if time/CI budget permits; any scoped exception must be recorded at handoff.

## 3. Automated End-to-End Fixture Scenarios

The service/flow tests use fresh temporary roots and a small fixture containing a `.blue` project
plus a relative media/resource file.

### A. First use from protected factory input

1. Factory exists; user library does not.
2. Choose Copy and Open, select the staged `.blue`, accept replacement.
3. Expected: `current/content` contains the full fixture, `state.json` validates, selected final path
   is below `current/content`, and factory hash/tree is unchanged.

### B. Picker or save cancellation

Repeat first use and update cases while canceling each decision boundary.

Expected: no current generation change, no active project replacement, candidate cleanup is
idempotent, and factory remains unchanged.

### C. Safe update

Start from factory A and user copy A, then create factory B with:

- one new file;
- one changed untouched file;
- one changed user-edited file;
- one user-deleted baseline file;
- one removed factory file;
- one new factory path colliding with a user-created entry.

Choose Update and Open. Expected: only new + untouched paths take factory bytes; every user case is
preserved; tombstones/baselines advance to B; conflicts are path-sorted and reported; B is not
offered again.

### D. Keep, downgrade, and repackage

Decline B, reopen with B, return to accepted A, then present unrelated C.

Expected: B and accepted A do not reprompt; C does. Accepting A after B or B after A uses the same
merge policy and never infers chronological ordering.

### E. Interrupted activation

Inject termination/failure after journal creation, after current-to-backup rename, and after
staging-to-current rename. Invoke recovery through Open Example.

Expected: each recognized case reaches exactly one valid current generation and removes only the
matching Blue-owned stage/backup; malformed or unowned paths are preserved and block mutation.

## 4. Packaged Manual Acceptance

Use a fresh test profile and a packaged build installed in its normal application location. The
feature must not depend on making the application directory writable.

### A. First Open Example and relative render

1. Capture a recursive content digest or file listing+hashes of packaged `assets/examples`.
2. Launch Blue and choose **File → Open Example**.
3. Confirm the Copy and Open explanation, then choose an example with bundled relative assets such
   as `techniques/pvoc2.blue`.
4. Render it to disk.
5. Edit and save the opened user-copy project, close it, and open it again through Open Example.

Expected:

- The picker uses the per-user example content, not the application package.
- Rendering resolves the bundled relative assets without a temporary-CSD path error.
- The saved edit persists in the user copy.
- Recomputed packaged factory hashes exactly match step 1; no `tempCsd*.csd`, project edit, or state
  sidecar appears beneath packaged examples.
- A second same-revision Open Example shows neither first-use nor update prompt.

### B. Update and conflict preservation

Using the same test profile, install/run a test build whose factory fixture has a different content
revision. Before opening it, edit one user example and delete another from the user content root.

1. Choose Open Example and Update and Open.
2. Confirm the conflict summary, select an example, and complete replacement.
3. Inspect the user content and reopen Open Example.

Expected: new/untouched factory files update, the edit and deletion remain, removed factory content
is not auto-deleted, and the same installed revision does not prompt again.

### C. Keep Current

With another different factory fixture, choose Keep Current and Open, select an existing user
example, then invoke Open Example again.

Expected: existing user content opens, the declined revision does not prompt again, and a third
different fixture does prompt.

## Pass Criteria

All SC-001 through SC-007 are demonstrated, with particular closeout evidence for:

- zero writes under packaged factory examples;
- successful relative-asset rendering from the user copy;
- zero overwritten/deleted user modifications across the update matrix;
- cancellation/failure preserving the active project and last valid user generation;
- Windows path/error coverage and packaged macOS/Linux acceptance as available.

## Closure Evidence

Packaged manual acceptance was reported passing by the user on 2026-08-26. The results for
SC-001 through SC-007, including the before/after factory digest check, are recorded in
[handoff-open-example-issue.md](handoff-open-example-issue.md). Automated gate evidence is recorded
there as well.
