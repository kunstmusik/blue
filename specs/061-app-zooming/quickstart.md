# Quickstart: App Zooming

## Prerequisites

- Branch: `061-app-zooming`
- Feature pointer: `/Users/stevenyi/work/blue-electron/.specify/feature.json`
  targets `/Users/stevenyi/work/blue-electron/specs/061-app-zooming`
- Run commands from `/Users/stevenyi/work/blue-electron`
- Electron is pinned to `35.7.5`; do not substitute current-major zoom behavior
  for verification against the pinned runtime.

## Recommended Test-First Implementation Order

1. Add pure shared tests for legal values, invalid normalization, exact command
   steps, clamping, Actual Size, and percent-to-factor conversion.
2. Add program settings tests for the 100% default, valid round-trip, invalid
   load fallback, generic validation, sibling preservation, and unchanged
   settings version.
3. Add controller tests using injected window and persistence adapters: startup,
   all-window application, destroyed/failing window isolation, new-window seed,
   boundary no-op, Actual Size, write failure, later commands, and stale full
   Settings-snapshot preservation.
4. Add application menu tests for View placement, exact item order/labels,
   accelerators, custom callbacks, lack of zoom roles, and project-independent
   availability.
5. Implement the shared helpers and settings scalar until shared/store tests pass.
6. Implement the main-owned controller and guarded persistence path.
7. Initialize the controller and early `browser-window-created` listener before
   the first `createWindow()` call; keep existing popout registration but do not
   defer zoom application until `did-finish-load`.
8. Supply the current factor to explicit main, Settings, and effect BrowserWindow
   factories while preserving all security preferences and show behavior.
9. Insert the View menu and route each command to the controller.
10. Preserve the controller value when the Settings renderer submits a full
    snapshot, then run focused, package, workspace, and manual gates.

## Focused Test Commands

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/shared/app-zoom.test.ts \
  src/shared/program-settings.test.ts \
  src/main/app-zoom-controller.test.ts \
  src/main/program-settings-store.test.ts \
  src/main/application-menu.test.ts \
  src/main/settings-window.test.ts \
  src/main/effect-editor-window-manager.test.ts \
  --browser.enabled=false
```

```bash
pnpm --filter @blue/app test
pnpm --filter @blue/app build
pnpm lint
git diff --check
```

## Scripted Acceptance Metrics

Implementation adds
`/Users/stevenyi/work/blue-electron/packages/blue-app/scripts/verify-app-zoom.mjs`
as a Playwright/Electron driver using a temporary user-data profile. Run it
after the application build:

```bash
pnpm --filter @blue/app build
pnpm --filter @blue/app exec node scripts/verify-app-zoom.mjs
```

The driver must:

- exercise all 26 legal values and confirm the controller/window factors are
  exact within numeric tolerance;
- measure changed commands across representative open windows and fail if any
  exceeds 250 milliseconds under the acceptance fixture;
- run 100 consecutive launch/close cycles rotating through at least three
  non-default saved values and confirm the restored factor is in place before
  first content visibility;
- cover the main workbench, Settings, a floating workbench window, and an
  app-owned editor where fixture setup permits, while the manual smoke retains
  visual reachability and no-flash judgment.

The driver verifies exact native-menu accelerator declarations and common
callbacks while an interactive control is focused. Real operating-system
accelerator dispatch and visual reachability remain part of the manual platform
matrix because Playwright/Electron programmatic key events do not traverse the
native application-menu accelerator path consistently on macOS.

## Manual Smoke: Menu And Shortcuts

1. Start Blue at 100% and confirm View appears between Edit and Project.
2. Confirm View lists Zoom In, Zoom Out, and Actual Size in that order and shows
   the platform-native Command/Control `+`, `-`, and `0` shortcuts.
3. Choose Zoom In once and verify content becomes 110%; choose Zoom Out once and
   verify it returns to 100%.
4. Focus a CodeMirror editor, type a recognizable line, and invoke each shortcut.
5. Verify the app scale changes, no shortcut character is inserted, editor
   selection remains usable, and Actual Size returns to 100%.
6. Repeat the shortcut check on macOS, Windows, and Linux acceptance targets.

## Manual Smoke: Persistence And First Visible Frame

1. Choose 130% and quit normally.
2. Relaunch Blue and verify the first visible main-window content is already at
   130%, with no visible 100%-to-130% jump.
3. Invoke Actual Size, restart, and verify the first visible content is 100%.
4. Repeat with at least two additional non-default values, including one below
   100% and one near the upper range.

## Manual Smoke: Multi-Window Application

1. Open the main workbench, Settings, one effect editor, one effect interface,
   and at least one floating Dockview workbench window.
2. Change zoom from the main window and verify all open rendered windows update
   to the same factor within 250 milliseconds.
3. Focus Settings and invoke Zoom In; confirm every open window advances once.
4. Focus an effect or floating window and invoke Zoom Out and Actual Size;
   confirm the same app-wide behavior.
5. Set 120%, close all secondary windows, reopen each kind, and verify its first
   visible content is already at 120%.
6. On macOS, close the main window and reactivate Blue from the Dock; verify the
   recreated main window retains 120%.

## Manual Smoke: Bounds And Layout Reachability

1. Step repeatedly to 50%; one more Zoom Out must be a harmless no-op.
2. At 50%, complete one representative action in the workbench, Settings, and
   an app-owned editor.
3. Step repeatedly to 300%; one more Zoom In must be a harmless no-op.
4. At 300%, resize and scroll each representative window and verify essential
   actions remain reachable.
5. At several intermediate values, verify text, icons, controls, Dockview tabs,
   CodeMirror, rendered dialogs, and editor canvases scale coherently.
6. Verify timeline/domain zoom controls retain their existing independent
   behavior.

## Manual Smoke: Invalid Settings And Write Failure

1. With Blue stopped, seed `appSpecific.appZoomPercent` separately with a
   missing value, string, non-finite representation if the fixture supports it,
   49, 301, 105, and a fractional value.
2. Start Blue for each fixture and verify it opens usable at 100%.
3. In a controlled test profile, make the settings destination unwritable after
   startup, then invoke Zoom In.
4. Verify every open window still changes for the session, Blue remains usable,
   and another zoom command still works.
5. Restore write access, issue a later changed command, restart, and verify the
   successfully saved value restores.

## Manual Smoke: Stale Settings Draft

1. Open Settings and modify a visible panel without applying it.
2. While Settings remains open, invoke Zoom In from 100% to 110%.
3. Apply the Settings draft.
4. Verify app zoom remains 110% immediately and after restart while the visible
   Settings edit also persists.

## Implementation Notes

- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/application-menu.test.ts`
  currently relies on positional top-level menu indices. Inserting View shifts
  Project, Tools, and Window; prefer resolving menus by label while updating the
  exact-order assertions and add the three handlers to the common test factory.
- Use `setZoomFactor(percent / 100)`, not `setZoomLevel`; compare returned factors
  with tolerance in runtime tests.
- The early creation handler must be registered before `createWindow()` and
  must not wait for the existing popout `did-finish-load` callback.
- Do not wire the unused renderer `ui-store.zoom` field or modify score
  `zoomIterations`; they are different state domains.
- Preserve `appZoomPercent` from the main controller when processing full
  Settings-window snapshots to prevent a lost update.
- Keep all new shared code browser-safe and all production imports static.

## Acceptance Results

| Date | Platform | Result | Notes |
|------|----------|--------|-------|
| 2026-07-21 | macOS (darwin), automated | Pass | 26 exact factors and bounds; menu contract/focused control; main + Settings + effect + Dockview popout within 250 ms; stale-draft preservation; 100 same-profile restarts across 90%, 130%, and 250%; invalid settings; write-failure recovery. |
| 2026-07-21 | macOS (darwin), manual | Pending manual run | Run real Command shortcuts, first-frame visual check, and 50%/300% reachability/domain-zoom matrix. |
| 2026-07-21 | Windows (win32) | Pending manual run | Run manual menu + first-frame + multi-window smoke from the matrix above. |
| 2026-07-21 | Linux | Pending manual run | Run manual menu + first-frame + multi-window smoke from the matrix above. |
