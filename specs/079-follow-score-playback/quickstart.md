# Quickstart: Follow Score Playback and Page Scrolling

## Prerequisites

- Work from the `079-follow-score-playback` branch.
- Install the repository dependencies with `pnpm install` if needed.
- Have a Blue project whose root score is wider than the visible score panel. A long project with
  several score objects and a visible time ruler is preferred.
- The renderer test environment provides the existing `window.blueAPI` test doubles; no audio
  device is required for the focused unit/component tests.

## Focused Automated Validation

Run from `/Users/stevenyi/work/blue-electron`:

```sh
pnpm --filter @blue/app test -- src/renderer/tests/playback-store.test.ts
pnpm --filter @blue/app test -- src/renderer/tests/score-follow-playback.test.tsx
pnpm --filter @blue/app test -- src/renderer/tests/use-ipc-listeners.test.tsx src/renderer/tests/workbench-store.test.ts
pnpm --filter @blue/app test -- src/main/application-menu.test.ts src/main/program-settings-store.test.ts
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
git diff --check
```

The focused tests should cover:

1. Page-boundary and catch-up calculations, including clamping and preserved vertical position.
2. Active-follow suspension from body/header scroll, scrollbar movement, and ruler navigation.
3. No suspension from vertical scroll, zoom, resize, or automatic follow synchronization.
4. Saved preference versus session state across explicit toggles, stop/error/reset, and loop or
   internal restart status events.
5. `F` keyboard scope, auto-repeat, no-project behavior, and explicit native-menu state commands.
6. Atomic preference updates and menu/renderer synchronization after settings changes.

## Manual Playback Validation

1. Start the app using the repository's normal development command and open the long score.
2. Enable Follow Score and start playback. Let the playhead move across one visible page; confirm
   the viewport remains still until the playhead reaches the right edge.
3. At the boundary, confirm the viewport jumps so the playhead is at the leading edge, the time
   header stays aligned, and the vertical layer position is unchanged.
4. While playback continues, use trackpad/wheel horizontal scrolling, drag the scrollbar, and
   interact with the time ruler. Confirm follow turns off, playback continues, and the viewport
   remains where the user placed it.
5. Zoom horizontally and resize the window during playback. Confirm follow does not turn off; if
   the playhead is pushed outside the viewport, it catches up without changing vertical position.
6. Press `F` while the score has focus. Confirm follow re-enables and the viewport catches up.
   Press `F` while focused in a text field, code editor, select, or context menu and confirm the
   interaction is not intercepted.
7. Suspend follow, allow a loop boundary or engine restart, and confirm the suspension remains.
   Stop playback and confirm the toolbar and native menu return to the saved preference. Start a
   new session with follow-on-start enabled and then disabled to verify both lifecycle branches.
8. Toggle follow from the toolbar and native Project menu, then inspect the next session and a
   fresh application launch to confirm the explicit preference was saved. Confirm automatic
   suspension alone does not change that saved preference.

## Expected Result

The score behaves like a page-following timeline: it is stable between page boundaries, manual
navigation is respected, explicit re-engagement catches up immediately, and toolbar/native-menu
state remains consistent without changing score content or `.blue` XML.

## Validation Evidence (2026-08-18)

### Automated

- Focused SPEC 079 suites: 264 passed / 2 skipped across
  `score-follow-playback.test.tsx` (30), `playback-store.test.ts` (27),
  `use-ipc-listeners.test.tsx` (11), `workbench-store.test.ts` (28),
  `application-menu.test.ts` (22), `program-settings-store.test.ts` (29),
  `program-settings-application.test.ts` (20), `shared/program-settings.test.ts` (50),
  plus the pre-existing `app.test.ts` and `score-panel-session-reset.test.tsx` regressions.
  Focused runs use `pnpm --filter @blue/app exec vitest run --config vitest.config.ts <files>`
  (`pnpm --filter @blue/app test -- <file>` does not forward the filter).
- Full `@blue/app` suite: 339 files, 3253 passed / 2 skipped.
- Builds: `build:main`, `build:preload`, `build:renderer` all succeed.
- `pnpm lint` passes across all workspace projects; `git diff --check` is clean.
- The unrelated untracked `MISSING_FEATURE_GPT.md` was not modified (still untracked, 7770 bytes).
- Java parity cross-check: `ScoreTopComponent.updateRenderTimePointer()` jumps the viewport to
  the playhead x-coordinate on right-edge crossing preserving the y position, and
  `scrollToRenderTime()` uses the same x for explicit catch-up — matching
  `getFollowScrollTarget` and the ScorePanel integration. One intentional, spec-recorded
  divergence: Java's `renderInitiated()` persists `followPlayback = true` when follow-on-start
  enables it, while this implementation keeps the on-start application session-only per FR-016
  and the data model's state-transition table.

### Manual playback scenarios

User-confirmed manual quickstart acceptance (2026-08-18): the requester ran the interactive
scenarios in *Manual Playback Validation* above and reported that the behavior looked good, with
no defects observed. This closes the final long-score, navigation, zoom/resize, keyboard-scope,
persistence, stop/error/reset, and loop/internal-restart acceptance step.
