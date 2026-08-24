# Quickstart: Validate the Large-File Refactor

This guide is the implementation-time validation sequence. Run commands from the repository root on branch `088-large-file-refactor`. It proves structural compatibility; it does not add a manual product feature.

## Prerequisites

- Node.js 22 and pnpm 10.
- Workspace dependencies already installed.
- Native Blue Engine artifacts required by the existing affected tests/builds.
- For path-sensitive implementation changes, native Windows CI or an equivalent Windows run in addition to synthetic drive/UNC cases.

Confirm the baseline environment:

```bash
node --version
pnpm --version
pnpm exec tsc --version
git status --short
```

Expected: Node 22, pnpm 10, TypeScript compatible with the workspace declaration, and any pre-existing worktree changes understood before implementation.

## 1. Freeze the baseline and inventory

Before moving behavior, run the affected app suite and save any pre-existing failure output in the implementation notes:

```bash
pnpm --filter @blue/app test
```

Verify the inventory against [main-process-ipc-inventory.md](contracts/main-process-ipc-inventory.md):

- 112 inbound registrations from `main.ts`, counting all three loop-generated handlers.
- 44 unified-library handlers.
- 11 code-repository handlers.
- 5 workbench-window registrations.
- 5 MIDI-input registrations.
- 177 total, with every exact channel appearing once in invoke/listen mode.

Expected: the fake `IpcMain` capture and the documented checklist agree before the first handler moves.

## 2. Validate the BSB snapshot seam

After extracting the BSB module, run the lowest practical regression set:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/renderer/tests/bsb-interface-editor.test.tsx \
  src/renderer/tests/presets-manager-dialog.test.tsx \
  src/renderer/tests/bsb-performance-store.test.ts \
  src/renderer/tests/score-object-editor-panel-sound-patch.test.ts
pnpm --filter @blue/app build:renderer
```

Expected:

- Result snapshots match the baseline.
- Affected nested paths and unaffected sibling aliases match [bsb-snapshot-reducer.md](contracts/bsb-snapshot-reducer.md).
- Metadata-preserving patches retain established `objectNames`/`widgets` identity.
- Existing imports from `project-store.ts` still compile.

Rollback checkpoint: the BSB implementation can be restored behind the unchanged façade without reverting later domains.

## 3. Validate the patch queue seam

After introducing the injected queue coordinator, run its focused fake-timer suite and the stable store tests:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/renderer/tests/project-patch-queue.test.ts \
  src/renderer/tests/project-store.test.ts \
  src/renderer/tests/track-instrument-patch-queue.test.ts
pnpm --filter @blue/app build:renderer
```

Expected:

- One 100 ms trailing timer and one in-flight commit at most.
- FIFO batching and explicit flush drain edits queued during an active commit.
- Session-mismatched receipts are ignored and revisions remain monotonic.
- Unchanged drains restore the captured dirty baseline.
- Background failure notifies, explicit flush rejects, and no retry is introduced.
- Required refresh ordering and refresh-error logging match [patch-queue-coordinator.md](contracts/patch-queue-coordinator.md).

Rollback checkpoint: queue fields/functions can be inlined into the façade without changing callers or the BSB seam.

## 4. Validate ProjectSession and project transitions

Run the new transition suite with the existing replacement oracles:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/main/project-session.test.ts \
  src/main/project-lifecycle.test.ts \
  src/main/project-replacement-entry-points.test.ts \
  src/main/project-replacement-flow.test.ts
pnpm --filter @blue/app build:main
```

Expected:

- `ProjectSession` is the only writer of document/path/revision/session identity.
- Replace and close advance the session fence and reset revision; save-as changes path without replacing identity.
- Candidate-load failure leaves the prior session active according to the established flow.
- Native POSIX, Windows drive, and UNC strings are not globally slash-normalized.
- Runtime/editor cleanup and broadcasts retain their current transition order.

Rollback checkpoint: identity ownership is one commit and can return to `main.ts` independently of registrar movement.

## 5. Validate registration and lifecycle safety

Run the registration primitive and startup lifecycle suites before moving the large handler block:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/main/ipc/ipc-registration.test.ts \
  src/main/startup-lifecycle.test.ts \
  src/main/midi-input-coordinator.test.ts
pnpm --filter @blue/app build:main
```

Expected:

- Duplicate registration fails before the first side effect.
- Partial registrar work rolls back in reverse order.
- Disposers are idempotent and remove exact listeners only.
- An old disposer cannot remove a later registration.
- Failed startup retains the initiating error while continuing rollback.
- Normal shutdown remains the separately asserted order in [ipc-domain-registrar.md](contracts/ipc-domain-registrar.md).

## 6. Validate each main-process registrar

For each registrar move, run its exact channel-set test and representative behavior tests before moving the next source region. At minimum, cover:

- project lifecycle: open/new/save/replacement, MIDI import, missing audio, recent files;
- artifacts: dialog cancellation, import/export, SoundFont, CsoundRC and native paths;
- playback/runtime: playback/CSD, Blue Live, REPL/runtimes, realtime controls, render/freeze/cancel;
- project document: patch receipts/fences/broadcasts, editor windows, audio authorization, score-object tools;
- application: confirmation, settings/about, program settings/OSC, file manager, layout;
- existing registrars: unified library, code repository, workbench windows, MIDI input.

Then run the source-boundary audits against the extracted owners:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/main/ipc/main-process-ipc-inventory.test.ts \
  src/main/ipc/project-lifecycle-ipc.test.ts \
  src/main/ipc/project-artifacts-ipc.test.ts \
  src/main/ipc/playback-runtime-ipc.test.ts \
  src/main/ipc/project-document-ipc.test.ts \
  src/main/ipc/application-ipc.test.ts \
  src/main/engine-runtime-ipc.test.ts \
  src/main/csound-runtime-boundary.test.ts \
  src/main/render-to-disk.test.ts \
  src/main/freeze-score-objects.test.ts \
  src/main/repl-console-runtime.test.ts
```

Expected: all 177 registrations remain unique, channel strings/modes and representative payload/result/error/event behavior are unchanged, and source audits inspect the new registrar/host-operation files rather than only `main.ts`.

Rollback checkpoint: move and verify one registrar owner at a time; keep `main.ts` composition and the registration lease stable while reverting only that registrar.

## 7. Build every application boundary

After composition is complete:

```bash
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
```

Expected: main/preload IPC types and stable renderer façade compile without contract drift, circular imports, or host imports in pure renderer modules.

## 8. Final repository gates

```bash
pnpm --filter @blue/app test
pnpm test
pnpm lint
git diff --check
git status --short
```

Expected:

- All affected and repository-wide tests pass, or a pre-existing failure is explicitly recorded with owner and residual risk.
- Lint and whitespace checks pass.
- `docs/modularization.md` contains accepted/retained/deferred boundary maps, test seams, compatibility strategy, and rollback units.
- No semantic cleanup is hidden in mechanical movement; any such change is separately approved under FR-017.
- The final diff contains no new IPC channel, payload, persistence shape, dependency, deep clone, global path normalization, or duplicate state/lifecycle owner.

## Manual smoke checkpoint

When a packaged/manual run is available, use one representative project containing known and unknown XML data:

1. Open it and exercise BSB, score, mixer, and orchestra edits.
2. Queue edits, save, save-as, revert/replace, and reopen.
3. Generate CSD, play/stop, run Blue Live or a runtime-backed action, render, freeze, and cancel an active operation.
4. Open/focus an auxiliary editor and a floating workbench window.
5. Quit with services initialized.

Expected: user-visible results, data preservation, events, cancellation, and shutdown match the baseline. Any XML/CSD/render difference requires Java reference comparison and cannot be accepted as part of this structural refactor.
