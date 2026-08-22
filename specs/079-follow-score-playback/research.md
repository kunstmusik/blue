# Research: Follow Score Playback and Page Scrolling

**Feature**: `079-follow-score-playback`
**Date**: 2026-08-18

## Research Scope

This research cross-checks the clarified feature specification against the current
TypeScript/Electron implementation, Java Blue parity sources, the existing program-settings
boundary, and the score timeline's current navigation paths.

Primary references:

- `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`
- `packages/blue-app/src/renderer/stores/playback-store.ts`
- `packages/blue-app/src/renderer/hooks/use-keyboard-shortcuts.ts`
- `packages/blue-app/src/renderer/components/workbench/panels/score/useScoreWheelZoom.ts`
- `packages/blue-app/src/renderer/components/workbench/panels/score/useScoreRulerSelection.ts`
- `packages/blue-app/src/main/main.ts`
- `packages/blue-app/src/main/program-settings-store.ts`
- `packages/blue-app/src/shared/program-settings.ts`
- `packages/blue-app/src/shared/workbench-menu.ts`
- `packages/blue-app/src/preload/preload.ts`
- Java Blue `blue-ui-core/.../ScoreTopComponent.java`, `TransportControls.java`,
  `FollowScorePlaybackAction.java`, and `EnableFollowScorePlaybackOnStartAction.java`
- Java Blue `blue-settings/.../PlaybackSettings.java`

## Findings

### 1. Java Blue defines page advancement and catch-up semantics

Java Blue's `ScoreTopComponent.updateRenderTimePointer()` updates the playhead only while the
render manager is in the rendering state. When follow is enabled and the playhead crosses the
viewport's right edge, it sets the viewport's horizontal position to the playhead x-coordinate
and preserves the current y-coordinate. This produces an instant page-style jump rather than a
continuously moving lead window.

Java's `scrollToRenderTime()` uses the same playhead x-coordinate for explicit catch-up. During
`renderInitiated()`, the follow-on-start preference may enable follow and then immediately calls
that catch-up path. Preference changes while rendering also catch the view to the render time.

**Decision**: Use the playhead pixel position as the target horizontal scroll position for both
page advances and catch-up, clamp it to the available scroll range, and preserve vertical scroll.
Only active playback drives automatic movement. Stopped/paused playhead changes do not.

**Rationale**: This is the clarified Java parity requirement and matches the existing score
coordinate model (`timePointerBeats * pixelsPerBeat`) without introducing a second page-size
calculation.

**Alternatives considered**:

- A fixed one-viewport increment: rejected because it diverges from Java when the playhead
  crosses the boundary by less than a full viewport.
- A continuous lead-padding window: rejected because the current implementation already behaves
  that way and causes the reported rubber-band effect.

### 2. The current TypeScript follow effect is continuously repositioning the viewport

`ScorePanel.tsx` currently considers the playhead visible only inside a lead-padding window. As
soon as the playhead leaves that window, the display-clock effect calls
`synchronizeHorizontalScroll()` on roughly every display update. The body and time header are
kept aligned, but the scroll handler does not distinguish automatic movement from user movement.

**Decision**: Replace the lead-padding condition with a pure page/catch-up decision: do nothing
while the playhead is inside the viewport; when it crosses the right edge or is outside the left
edge, target the playhead x-coordinate. Keep the decision pure so boundary, clamping, and
stopped-state behavior can be unit tested without a DOM.

**Rationale**: A pure decision helper gives deterministic coverage for the highest-risk behavior
and keeps DOM event provenance in the score panel where the actual scroll sources are visible.

**Alternatives considered**:

- Testing only `ScorePanel` through a full browser harness: rejected as the sole test because
  layout dimensions and scroll-event timing make the boundary math brittle and slow.
- Keeping the existing effect and adding only a debounce: rejected because debouncing still
  fights manual navigation and does not implement page semantics.

### 3. Several independent code paths change horizontal scroll position

The score body and time header have native `scroll` handlers. `useScoreWheelZoom.ts` directly
changes `scrollLeft` for horizontal wheel scrolling and for cursor-anchored zoom. The ruler
selection hook auto-scrolls while dragging the render range. Marker navigation and rewind set a
project-store scroll target that `ScorePanel` applies later.

The clarified behavior distinguishes user navigation from view-scale changes. Therefore a raw
`scroll` event cannot be treated as a user action in every case:

- body/header wheel, trackpad, scrollbar, and ruler navigation are user navigation;
- follow page movement and body/header synchronization are automatic;
- zoom and resize/layout synchronization are view-scale/layout changes and must not suspend;
- an explicit marker/rewind navigation command is user initiated even if the resulting scroll is
  applied programmatically.

**Decision**: Track the expected horizontal scroll target together with its origin (`follow`,
`view-scale`, `layout-sync`, or `user-navigation`). Scroll handlers consume matching automatic
  targets without suspending; an unmatched horizontal delta during active follow is treated as
  user navigation. Explicit ruler and project navigation paths call the user-navigation path
  directly so they do not depend on browser scroll-event timing.

**Rationale**: This separates semantic source from DOM mechanics and prevents zoom from
accidentally disabling follow while still handling scrollbar and trackpad events that arrive only
as native scroll events.

**Alternatives considered**:

- A single `isProgrammaticScroll` boolean cleared on the next microtask: rejected because browser
  scroll events may arrive after the microtask and because zoom and follow need different origins.
- Suspending on every horizontal `scroll` event: rejected because it violates the clarified
  zoom/resize behavior and causes automatic synchronization to self-disable.

### 4. Playback state currently conflates saved preference and session state

`playback-store.ts` currently owns `followPlayback` and `followPlaybackOnStart`, but its reset path
hard-codes both to `true`. Explicit follow toggles update only the renderer state and do not save
the program setting or synchronize the native menu. Playback start paths can force follow on, but
there is no separate saved follow value to restore after a follow-on-start override or automatic
suspension.

The clarified lifecycle requires two distinct values:

- the saved follow preference, hydrated from and persisted to application settings;
- the active follow state for the current playback session.

**Decision**: Keep a saved follow preference in the playback store alongside the active follow
state. Explicit toolbar/menu/`F` toggles update both and persist immediately. Automatic manual-scroll
suspension updates only the active session state. A confirmed new session applies the
follow-on-start rule; stopping, erroring, closing a project, or resetting runtime state restores
the active state from the saved preference. Internal loop/recovery starts do not reapply the
follow-on-start rule.

**Rationale**: This directly models the clarified state transitions and prevents a temporary
suspension or a follow-on-start override from overwriting user preferences.

**Alternatives considered**:

- Re-read settings only during `reset()`: rejected because the saved value is needed immediately
  after stop and because reset currently has no asynchronous settings dependency.
- Treat automatic suspension as a persisted preference: rejected because the clarified behavior
  requires it to be session-only.

### 5. Program settings are main-owned and already have a full-snapshot save API

`program-settings-store.ts` owns the JSON file under Electron's user-data directory and writes
through a temporary file before rename. The preload exposes `getProgramSettings()` and
`saveProgramSettings(snapshot)`, but a renderer-side full-snapshot read/modify/write for every
toolbar toggle could overwrite a concurrently edited settings draft with stale values.

The existing `sync-follow-playback-state` channel is a fire-and-forget renderer-to-main mirror
for the native menu. It does not persist settings and is also used for session-only suspension.

**Decision**: Add a narrow, typed main-owned update operation for the two follow preference fields
instead of making the renderer write a full settings snapshot. The operation merges only the
requested playback preference into the current main-owned snapshot, returns the updated settings
result, and lets main refresh its menu cache. Keep the existing state-sync channel (or its typed
equivalent) separate so automatic suspension never writes durable settings.

Native menu actions use the same main-owned preference update and send explicit state commands to
the workbench renderer. Explicit state payloads avoid double-toggle races when the main menu and
renderer are briefly out of phase.

**Rationale**: Main is the canonical owner of application settings, and a partial update preserves
unrelated settings while giving the renderer a clear success/failure boundary.

**Alternatives considered**:

- Renderer `getProgramSettings()` plus full `saveProgramSettings()`: rejected because stale full
  snapshots can clobber unrelated settings and because every toggle would need an extra read.
- Make `sync-follow-playback-state` persist: rejected because automatic session suspension uses
  the same state path and must remain non-persistent.

### 6. Native menu state is a derived mirror of the active follow state

`main.ts` keeps `currentFollowPlaybackEnabled` and
`currentFollowPlaybackOnStartEnabled` for menu construction, but both start as hard-coded `true`.
Native menu actions currently toggle the cache and send toggle commands; renderer toolbar changes
do not update the cache. The menu is therefore vulnerable to stale state both at startup and
after renderer-originated suspension/toggles.

**Decision**: Initialize the main menu preference cache from `loadProgramSettings()`. Treat the
active follow value as a renderer-owned session state mirrored to main through the existing typed
state-sync path. Rebuild the menu whenever that mirror changes. On session end, the renderer
restores the active value from the saved preference and sends the mirror update, so the native
checkmark reverts with the toolbar. Native menu and settings-window preference writes update the
main cache and send explicit state to all active workbench renderers where applicable.

**Rationale**: The menu needs a fast synchronous value for native rendering, while the renderer
owns the score-session behavior and can distinguish automatic suspension from saved preference.

**Alternatives considered**:

- Have the native menu query the renderer each time it is opened: rejected because native menu
  construction is main-owned and should not depend on renderer availability.
- Make the main cache the only follow state: rejected because page scrolling and DOM event
  provenance belong to the renderer session and must remain responsive without IPC round trips.

### 7. Keyboard scope can reuse the existing editing-target guard

`use-keyboard-shortcuts.ts` already has `isTextEditingTarget()` and the application mounts the
hook globally. Existing tests cover the helper, but no follow-specific `F` behavior exists.

**Decision**: Add an unmodified, non-repeating `F` branch guarded by project presence and the
existing text/code/context-menu target predicate. Explicitly treat modifier keys as ineligible.
Keep the shortcut in the renderer rather than adding a native accelerator so text-entry focus and
the existing target guard remain authoritative.

**Rationale**: This reuses established keyboard-scope behavior and avoids a native accelerator
that cannot reliably inspect renderer focus.

**Alternatives considered**:

- Add `F` as an Electron menu accelerator: rejected because it would bypass the existing text
  editing guard and could toggle while a code editor owns focus.
- Add a separate score-specific key listener: rejected because it would duplicate the global
  keyboard scope and lifecycle handling.

### 8. Verification should combine pure state tests with a browser-level scroll harness

The repository has focused playback-store, application-menu, workbench-store, IPC-listener, and
keyboard-target tests, but no dedicated `ScorePanel` follow test. The highest-risk failures are
the page-boundary calculation, source-aware scroll handling, and state transitions across stop,
loop, and re-enable actions.

**Decision**: Add pure tests for the viewport decision and playback-session transitions, focused
renderer tests for keyboard/store/menu command behavior, and a browser/component test for body and
header scrolling, zoom exclusion, ruler suspension, page jumps, and vertical-scroll preservation.
Use the existing `@blue/app` Vitest configuration and include main/preload contract coverage for
the narrow preference update.

**Rationale**: This keeps deterministic logic fast while reserving browser/layout testing for the
DOM behavior that cannot be proven by pure functions.

**Alternatives considered**:

- Manual testing only: rejected because the regression is timing-sensitive and the project
  constitution requires focused automated coverage where practical.
- Full end-to-end audio playback for every case: rejected because it is slow and unnecessary for
  viewport/state logic; retain a small manual playback quickstart for final confirmation.

## Resolved Unknowns

The clarified specification and this research resolve the planning unknowns:

- page target and vertical preservation: Java pointer-x jump;
- stopped/paused behavior: no automatic scrolling;
- zoom/resize behavior: preserve follow, then catch up if needed;
- persistence: explicit toggles persist, automatic suspension does not;
- loop/recovery behavior: preserve the active session state;
- root-only scope: nested score views remain outside this follow session;
- state ownership and IPC: main-owned durable settings, renderer-owned session state, explicit
  serializable synchronization.

## Regression Baseline (T001, 2026-08-18)

Captured before replacing the follow effect, on branch `079-follow-score-playback` with the
Phase 2 settings-boundary changes in the working tree:

- Commands: `pnpm --filter @blue/app exec vitest run --config vitest.config.ts` (full suite,
  338 files / 3190 passed / 2 skipped) and the focused
  `src/renderer/tests/playback-store.test.ts` (11 passed) and
  `src/main/program-settings-store.test.ts` runs. Focused files are run with
  `pnpm --filter @blue/app exec vitest run --config vitest.config.ts <file>`; `pnpm --filter
  @blue/app test -- <file>` does not forward the file filter and runs the whole suite.
- Existing lead-window behavior (`ScorePanel.tsx` follow effect): the playhead counts as visible
  only inside `scrollLeft + 48 .. scrollLeft + clientWidth - max(96, 35% clientWidth)`. Outside
  that window the display-clock effect writes `max(0, pointerPixel - leadPadding)` on roughly
  every 33 ms tick, producing the continuous rubber-band repositioning this feature replaces.
- Existing hard-coded follow resets (`playback-store.ts`): `reset()` restores
  `followPlayback: true` and `followPlaybackOnStart: true` regardless of hydrated settings; both
  start paths force `followPlayback: true` when `followPlaybackOnStart` is set;
  `toggleFollowPlayback`/`toggleFollowPlaybackOnStart` update renderer state only without
  persisting or mirroring to the native menu.
- The previous hard-coded `true` menu cache in `main.ts` (`currentFollowPlaybackEnabled`) is
  replaced by settings hydration in the Phase 2 work already present in the tree.
