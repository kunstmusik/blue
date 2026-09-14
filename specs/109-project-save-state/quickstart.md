# Quickstart Validation: Project Save State

## Prerequisites

Use installed pnpm workspace dependencies, a built runnable Blue app, a disposable .blue fixture and temporary writable save directory.

## Automated checks

From repository root:

```sh
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm test
pnpm lint
git diff --check
```

Extend project-history.test.ts, project-lifecycle.test.ts, project-replacement-flow.test.ts and project-replacement-entry-points.test.ts. Add shared/window-title.test.ts and behavioral confirmation-coordinator tests using injected dialogs, writes and shutdown. Update existing renderer/tests/app.test.ts title assertions.

Cover none/new/open/edit/save/undo/redo, save before redo tip, branching/pruning, failed write, cancelled Save As, title updates, clean quit, failed-save quit, buffered edits from secondary windows, settlement timeout and async document-identity fencing. Existing commit→undo→redo and serialization suites must pass. Use injected errors and synthetic Windows/POSIX title paths.

## Desktop scenarios

Launch the existing built app:

```sh
pnpm --filter @blue/app start
```

1. Create an untouched project: Blue - New Project - [UNSAVED PROJECT]. Close prompts; Cancel retains it.
2. Save as test.blue: Blue - test.blue. Close without another edit: no save prompt.
3. Reopen, edit durable content, undo and redo: [modified] appears, clears at save point, and returns.
4. Save at an earlier history position, then undo/redo: only the new saved state is clean.
5. Leave buffered text/number input focused, also in a floating editor, then close/quit: settle it before deciding whether saving is required.
6. Quit clean project via app menu and native close/quit gestures: no dialog; process exits.
7. Cancel modified-project quit, cancel new-project Save As, and inject a failing quit-save in tests: project remains open with its marker.
8. Don't Save completes close/quit. Playback and selection alone never mark modified.
9. Close the document without quitting: title becomes Blue. Check native title presentation on available supported platforms.

See [contracts/save-state.md](contracts/save-state.md) and [data-model.md](data-model.md). Multiple editor windows share one project; independent multi-project sessions are outside scope.

Native chrome and OS gestures require smoke validation because unit tests mock windows. Record platform/results during implementation. All state, error and shutdown decisions require automated coverage.

## Validation results (2026-09-14, macOS 14 arm64)

### Automated checks — all pass

- `pnpm --filter @blue/app test` — 475 files, 5012 passed, 2 skipped.
- `pnpm --filter @blue/app build:main` / `build:preload` — clean strict-TypeScript builds.
- `pnpm test` — blue-app 5012, blue-data 1860, blue-cli 5, blue-java 51, native engine 14: all pass.
- `pnpm lint` — passes except the pre-existing untracked `DESIGN.md` (not part of this feature; left untouched).
- `git diff --check` — clean.

Scenario coverage (all automated): none/new/open/edit/save/undo/redo
(`project-save-state.integration.test.ts`, `project-history.test.ts` save-state matrix), save before redo
tip and branch/prune (same matrices), failed write and cancelled Save As
(`project-replacement-flow.test.ts`, `project-replacement-entry-points.test.ts` protection workflow),
title updates and synthetic Windows/POSIX paths (`shared/window-title.test.ts`), clean quit and
failed-save quit (`runQuit` harness in the protection workflow), buffered edits from multiple contexts
(`project-history-settlement.test.ts`), settlement timeout (same), async document-identity fencing
(`project-lifecycle.test.ts`), and existing commit→undo→redo plus serialization suites
(`project-history-roundtrip.test.ts`, `global-project-history.integration.test.ts`) unchanged.

### Desktop smoke — passed (project-owner acceptance, 2026-09-14)

The project owner manually ran the desktop scenarios above after the T029 terminal-boundary fix
and accepted the feature for closure. This included native close/quit behavior, save-dialog
choices, buffered editor drafts, title presentation, clean shutdown, Don't Save, and the
non-modifying playback/selection cases on macOS 14 arm64.

### Smoke-found defect and fix (2026-09-14, macOS manual smoke)

Owner's manual smoke found: after Open Project → Close Project, every later transition (open,
new, quit) failed with "Settlement barrier timed out after 5000ms" and the app had to be force
quit. Root cause: renderers never unregister their history participant, and `ProjectHistory`
did not drop registrations whose document identity is gone, so after Close Project the stale
participant fenced every later settlement barrier waiting for an acknowledgement that could
never arrive; `requestQuit` also left `isQuitting` set when the barrier threw, wedging quit.
Fix: `ProjectHistory.runSettlementBarrier` now prunes participants whose `documentId` no longer
matches the active session document before collecting barrier contexts, and `requestQuit`
catches transition failures and resets `isQuitting`. Covered by
`project-history-settlement.test.ts` ("prunes participants of a closed document…", "waits only
on participants of the current document after a replacement"). The owner re-ran the affected
manual transitions after this fix; post-close replacement and quit remained usable, so the
manual validation is accepted for closure.
