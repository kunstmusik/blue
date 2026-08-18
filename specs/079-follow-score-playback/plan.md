# Implementation Plan: Follow Score Playback and Page Scrolling

**Branch**: `079-follow-score-playback` | **Date**: 2026-08-18 | **Spec**: [spec.md](/Users/stevenyi/work/blue-electron/specs/079-follow-score-playback/spec.md)

**Input**: Feature specification from `/specs/079-follow-score-playback/spec.md`

## Summary

Replace the current continuously repositioning Follow Score effect with Java Blue-compatible
page-style following. During active playback, the root score remains stationary while the
playhead is inside the viewport; at the right boundary, the viewport jumps so the playhead's
pixel position becomes the new left edge, with the vertical position preserved. Explicit
re-engagement catches up immediately, while stopped/paused playhead changes do not scroll.

The implementation will separate the durable app-wide follow preferences from the renderer's
per-session active/suspended state. Explicit toolbar, native-menu, and unmodified `F` actions
update and persist the saved preference immediately. Manual horizontal navigation suspends only
the active session; zoom, resize, vertical scrolling, and automatic synchronization do not.
Source-aware scroll provenance will protect automatic movement from self-suspending, and typed
main/preload contracts will keep program-settings persistence and native-menu state synchronized
without putting transient state in `.blue`.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, strict mode; Electron 35.7.5

**Primary Dependencies**: Zustand 5.x renderer stores, React DOM scroll events and
`ResizeObserver`, existing Electron IPC/preload bridge, `@blue/data` transport/time mapping,
Vitest 4.1.6 with jsdom, Vite 7.3.x

**Storage**: Main-owned versioned `program-settings.json` under Electron user data stores
`playback.followPlayback` and `playback.followPlaybackOnStart`. Renderer follow-session state,
scroll provenance, playhead pixels, and viewport coordinates are runtime-only. The `.blue`
project document, generated CSD, and engine state are unchanged.

**Testing**: Focused `@blue/app` Vitest tests for the pure viewport helper, playback store,
keyboard scope, renderer IPC/menu handling, main settings/menu synchronization, and score-panel
DOM behavior. Validate with affected package tests, main/preload/renderer builds, `git diff
--check`, and the manual playback scenarios in [quickstart.md](quickstart.md).

**Target Platform**: Electron desktop application on macOS, Windows, and Linux

**Project Type**: Existing pnpm monorepo desktop application with Electron main, preload, and
React renderer packages

**Performance Goals**: Preserve the existing display-clock cadence (approximately 30--33 ms
updates) without a scroll write on every update while the playhead remains visible. Perform at
most one horizontal target calculation/write per page boundary or catch-up event, keep body and
time-header alignment synchronous, and make toolbar/native-menu state changes observable within
the existing interaction budget of 100 ms without per-clock IPC traffic.

**Constraints**: Follow applies only to the root score timeline and only during active playback;
the page target is the playhead x-coordinate clamped to the actual scroll range; automatic
horizontal movement preserves `scrollTop`. Horizontal body/header/scrollbar/ruler navigation
suspends active follow, while vertical-only movement, zoom, resize, layout synchronization, and
automatic follow movement do not. `F` must be unmodified, non-repeating, project-scoped, and
guarded by the existing editing/context-menu predicate. Main owns durable settings; renderer owns
session/viewport state; all IPC payloads are typed, serializable, and validated. Avoid changes to
`@blue/data`, engine protocol, project XML, and unrelated working-tree files.

**Scale/Scope**: One feature spanning the existing `@blue/app` main, preload, shared, renderer
store/hooks, score panel, and focused test suites; one new pure score-follow decision helper and
one dedicated score-follow component test are expected. No new package or persistence migration
is required because the existing preference fields already exist.

## Constitution Check

*Gate: completed before Phase 0 research; re-checked after Phase 1 design below.*

- **Portable data core — PASS**: No production change is planned in `@blue/data`. Time-to-pixel
  conversion remains consumed from existing renderer-facing data APIs; DOM, Electron, settings,
  and scroll provenance stay in `@blue/app`.
- **Java and project compatibility — PASS**: The plan is grounded in Java Blue's
  `ScoreTopComponent.updateRenderTimePointer`, `scrollToRenderTime`, and `renderInitiated`, plus
  the Java toolbar/menu actions and `PlaybackSettings`. The page jump, pointer-x target, vertical
  preservation, and on-start lifecycle follow Java behavior. Automatic manual-navigation
  suspension and the `F` shortcut are intentional product divergences recorded in the feature
  spec. No `.blue` or CSD changes are planned.
- **Canonical ownership and contracts — PASS**: Main's program-settings store owns durable
  preferences; the renderer playback store owns active session state; the score panel owns DOM
  viewport/provenance; main owns the native-menu mirror. A narrow validated preference patch is
  added alongside the existing boolean active-state mirror, with explicit resolved-value commands
  for main/settings-to-renderer synchronization. Failed writes leave the prior saved value
  authoritative.
- **Runtime and engine isolation — PASS**: No engine-client, Java-runtime, process, filesystem,
  or ZeroMQ behavior changes are required. Loop/recovery behavior is observed through existing
  playback status/events; the renderer does not access engine-native state.
- **Host-path portability — N/A/PASS**: The feature adds no path, identity, or external-text
  transformation. Existing main settings paths remain inside the established native filesystem
  boundary.
- **Verification evidence — PASS**: The design includes pure boundary tests, renderer/jsdom scroll
  provenance tests, store lifecycle tests, keyboard-scope tests, IPC failure/success coverage,
  native-menu synchronization tests, builds, and deterministic manual playback validation.

## Project Structure

### Documentation

```text
specs/079-follow-score-playback/
├── spec.md                         # Clarified requirements and acceptance scenarios
├── plan.md                         # This implementation plan
├── research.md                     # Java/current-code findings and decisions
├── data-model.md                   # Durable/session/viewport ownership model
├── quickstart.md                   # Focused commands and manual validation
└── contracts/
    ├── follow-playback-surface.md  # Toolbar/menu/keyboard/viewport behavior
    └── follow-playback-ipc.md      # Main/preload/renderer contracts
```

### Source Code

```text
packages/blue-app/src/
├── main/
│   ├── main.ts                         # Settings hydration, menu mirror, native actions
│   ├── program-settings-store.ts       # Narrow validated playback-preference update
│   └── application-menu.test.ts        # Native menu state and command coverage
├── preload/
│   └── preload.ts                      # Typed bridge for preference patch and state mirror
├── shared/
│   ├── program-settings.ts              # Shared preference patch/result types and validation
│   └── workbench-menu.ts                # Explicit resolved-value command variants
└── renderer/
    ├── components/workbench/panels/
    │   ├── ScorePanel.tsx               # Follow lifecycle, scroll provenance, viewport writes
    │   └── score/
    │       ├── useScoreRulerSelection.ts # Mark explicit ruler navigation as user-originated
    │       ├── useScoreWheelZoom.ts      # Separate horizontal navigation from view-scale scroll
    │       └── follow-playback.ts        # New pure page/catch-up decision helper
    ├── hooks/
    │   ├── use-keyboard-shortcuts.ts    # Guarded, unmodified, non-repeating F shortcut
    │   └── use-ipc-listeners.ts         # Hydration, explicit menu/settings state delivery
    ├── stores/
    │   ├── playback-store.ts            # Saved preference/session state transitions
    │   └── workbench-store.ts            # Explicit native command routing
    └── tests/
        ├── playback-store.test.ts       # Preference/session lifecycle regressions
        ├── score-follow-playback.test.tsx # New DOM/provenance/page-follow coverage
        ├── use-ipc-listeners.test.tsx   # Hydration and explicit command synchronization
        ├── workbench-store.test.ts      # Native command routing
        └── app.test.ts                  # F shortcut scope and editing-target behavior
```

**Structure Decision**: Keep the feature inside the existing `@blue-app` boundaries. The pure
follow decision belongs next to renderer score logic because it consumes viewport/playhead
geometry but has no DOM dependency. Main remains the only durable-settings writer and native-menu
owner. `ScorePanel` remains the seam for body/header alignment and scroll-source provenance;
existing wheel and ruler hooks receive the smallest callbacks needed to identify their origin.
No new package, engine protocol, project-model field, or cross-package abstraction is justified.

## Design Details and Implementation Sequence

### 1. Establish the durable preference and menu synchronization boundary

- Extend shared program-settings/preload/global API types with a narrow update request for
  `followPlayback` and `followPlaybackOnStart`, while retaining the existing full-snapshot API
  for the Settings window.
- Implement the main-owned merge/write operation using the existing `program-settings-store.ts`
  validation and atomic-write path. It must preserve unrelated settings and return the existing
  `ProgramSettingsSaveResult` shape; invalid payloads and write failures must not update the
  authoritative cache.
- Hydrate `currentFollowPlaybackEnabled` and the on-start mirror from loaded settings before
  building the application menu instead of relying on hard-coded `true` values.
- Change native follow actions to resolve the next boolean, persist through the narrow operation,
  update the menu cache only after success, and send explicit resolved-value commands rather than
  toggle commands. Broadcast settings-originated changes to active workbench renderers where the
  existing window-host path supports it.
- Keep `sync-follow-playback-state` fire-and-forget and non-persistent; it mirrors active session
  state, including temporary suspension, to the native menu.

### 2. Separate saved preference from active playback-session state

- Extend `playback-store.ts` with a saved follow value and explicit operations for persistent
  user actions versus session-only suspension/restoration. Keep the existing public follow fields
  compatible for toolbar/menu consumers where possible, but make the ownership distinction
  explicit in state and tests.
- Hydrate saved values from program settings and preserve them through reset/project close rather
  than hard-coding defaults. Ensure failed starts and startup interruptions do not accidentally
  overwrite hydrated preferences.
- On a confirmed new session from stopped/idle, apply the on-start preference: enabled starts
  active; disabled starts from the saved follow value. An active session that loops, seeks,
  restarts position, or recovers the engine retains its current active/suspended state.
- On stop, error, project close, or runtime reset, end the session, restore active follow from
  the saved preference, and mirror the restored value. Explicit toolbar/native/`F` actions update
  both active and saved values and invoke the durable preference operation immediately; automatic
  manual-scroll suspension changes only active state.
- If a durable write fails, retain the last confirmed saved preference and reconcile the active
  state on the next authoritative settings result rather than claiming persistence succeeded.

### 3. Implement and test the pure page/catch-up decision

- Add a small pure helper (for example, `getFollowScrollTarget`) accepting playback-active state,
  follow-enabled state, pointer x, `scrollLeft`, `clientWidth`, and `scrollWidth`.
- Return no target while stopped/paused, outside the root-follow scope, invalid, or while the
  pointer is inside the visible interval. At or beyond the right edge, or behind the left edge,
  return the pointer x-coordinate clamped to `0..max(0, scrollWidth - clientWidth)`.
- Make the caller preserve the current vertical scroll position and synchronize body/header to
  one resolved horizontal target. Avoid a per-clock scroll write when no target is returned.
- Cover right-boundary crossing, backward seek/wrap catch-up, short scores, end-of-score clamp,
  invalid geometry, stopped/paused no-op, and the one-target-per-boundary expectation with pure
  tests.

### 4. Make score scrolling source-aware

- Replace the current lead-padding effect in `ScorePanel.tsx` with the pure helper and active
  playback/session state. Run the helper on display-clock updates and relevant layout/scale
  changes, but never for stopped/paused manual playhead changes.
- Add a runtime expected-target/provenance record around programmatic horizontal writes. Mark
  follow movement as `follow`, body/header alignment as `layout-sync`, and zoom/cursor-anchor
  movement as `view-scale`; consume matching scroll events without suspending follow.
- Classify unmatched horizontal body/header/scrollbar/trackpad movement as `user-navigation` while
  playback is active and follow is active. Suspend only once per interaction, leave audio and the
  user's chosen position untouched, and keep body/header aligned afterward. Vertical-only scroll
  must not enter this path.
- Pass the smallest explicit user-navigation callback into `useScoreRulerSelection.ts` for ruler
  click/drag and render-range auto-scroll. Keep marker/rewind/project navigation on the explicit
  user-origin path. Update `useScoreWheelZoom.ts` so Shift/wheel horizontal navigation suspends,
  while pinch/gesture/cursor-anchored zoom is marked as view-scale and never suspends.
- Preserve root-score-only scope and existing body/header synchronization, resize behavior, and
  project scroll-target handling. If a scale change leaves the playhead outside the viewport
  during active enabled follow, let the normal catch-up helper run.

### 5. Unify toolbar, native menu, and keyboard controls

- Route toolbar and native-menu follow actions through explicit store operations so every control
  has the same persist/sync/catch-up semantics.
- Add the unmodified, non-repeating `F` branch to `use-keyboard-shortcuts.ts`, reusing
  `isTextEditingTarget` and the existing project-presence guard. Ignore Command/Control/Alt/Shift,
  `event.repeat`, no-project state, code/content-editing targets, and context menus.
- Handle explicit resolved-value native/settings commands without double toggles or duplicate
  writes. Verify the toolbar indicator and main menu checkmark reflect active session state during
  playback and saved preference after session end.

### 6. Add focused regression coverage and run the handoff checks

- Extend playback-store tests for hydration, explicit persistence, manual suspension, on-start
  enabled/disabled branches, stop/error/reset restoration, failed starts, and loop/internal
  restart preservation.
- Add `score-follow-playback.test.tsx` for page boundaries, header/body alignment, vertical
  preservation, body/header/scrollbar/ruler suspension, zoom/resize exclusion, and user-position
  wins during a concurrent automatic update.
- Extend keyboard, IPC-listener, workbench-store, application-menu, and program-settings-store
  tests for guarded `F`, explicit commands, state mirrors, atomic partial writes, validation, and
  failure behavior.
- Run the focused commands and builds in [quickstart.md](quickstart.md), then expand to the
  repository's required package/repository checks in proportion to any implementation spread.

## Design Artifacts

- [Research](research.md) records the current implementation, Java references, external UX
  evidence, alternatives, and resolved unknowns.
- [Data model](data-model.md) defines durable preferences, renderer session state, viewport
  geometry, navigation provenance, ownership, lifetimes, and transitions.
- [Surface contract](contracts/follow-playback-surface.md) defines observable toolbar, native
  menu, keyboard, viewport, and lifecycle behavior.
- [IPC contract](contracts/follow-playback-ipc.md) defines the non-persistent active-state mirror,
  durable preference patch, explicit resolved-value commands, failure behavior, and non-contractual
  runtime data.
- [Quickstart](quickstart.md) provides deterministic focused tests, build checks, and manual
  playback validation for the acceptance scenarios.

## Post-Design Constitution Check

*Gate: evaluated after the research and design artifacts above.*

- **Portable data core — PASS**: The pure helper is renderer score logic with no `@blue/data`
  production-boundary change; no DOM or Electron dependency enters the data package.
- **Java and project compatibility — PASS**: Java pointer-x page advancement, catch-up, vertical
  preservation, explicit preference save, and new-session on-start behavior are represented in
  the model and tests. The intentional manual-navigation suspension and `F` shortcut divergence
  remain explicit. `.blue`, CSD, score objects, and transport data are untouched.
- **Canonical ownership and contracts — PASS**: Durable preferences, session active state,
  viewport/provenance, and native-menu mirror each have one owner. The plan's narrow patch,
  explicit resolved-value commands, boolean mirror, validation, and failure handling prevent
  split-brain state and settings clobbering.
- **Runtime and engine isolation — PASS**: Internal loop/recovery behavior is handled through
  existing status/lifecycle events; no renderer-to-engine or renderer-to-filesystem coupling is
  introduced.
- **Host-path portability — N/A/PASS**: No new path or external-text boundary is introduced.
- **Verification evidence — PASS**: Every high-risk boundary has a planned focused test, with
  main/preload/renderer builds and deterministic manual playback checks documented. No complexity
  exception is required.

## Complexity Tracking

No constitution violations or exception architecture are proposed. The only new seam is the
small pure viewport decision helper, which is justified by the Java-parity boundary math and the
need to test it independently of DOM timing. Existing stores, IPC channels, menu infrastructure,
and score hooks are extended surgically rather than replaced.
