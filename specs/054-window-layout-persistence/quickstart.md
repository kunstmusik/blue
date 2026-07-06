# Quickstart: Window Layout Persistence

## Automated TDD Flow

1. Write failing shared settings tests for layout defaults, validation, merge behavior, and Reset Windows preservation of unrelated settings.
2. Write failing main-process tests for BrowserWindow bounds capture/restore and offscreen rejection.
3. Write failing renderer tests for workbench layout load/save, 200px default auxiliary sizes, split pixel persistence, and clamp-without-overwrite behavior.
4. Write failing menu tests proving Window > Reset Windows is the only reset command.
5. Implement until the focused suites pass.

## Focused Test Commands

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/shared/window-layout-settings.test.ts \
  src/shared/program-settings.test.ts \
  src/main/window-layout-store.test.ts \
  src/main/window-state-manager.test.ts \
  src/main/program-settings-store.test.ts \
  src/main/application-menu.test.ts \
  src/main/settings-window.test.ts \
  src/main/effect-editor-window-manager.test.ts \
  src/renderer/tests/layout-settings-store.test.ts \
  src/renderer/tests/workbench-layout-persistence.test.ts \
  src/renderer/tests/workbench-auxiliary.test.ts \
  src/renderer/tests/orchestra-split-pane.test.tsx \
  src/renderer/tests/editor-split-persistence.test.tsx \
  src/renderer/tests/use-ipc-listeners.test.tsx \
  --browser.enabled=false
```

```bash
pnpm --filter @blue/app test
pnpm --filter @blue/app build
git diff --check
```

## Manual Smoke Scenario: Window Bounds

1. Start the app with a clean program settings file.
2. Move and resize the main window.
3. Open Settings, move and resize it, close it, then reopen it.
4. Open an effect editor/interface window where available, move and resize it, close it, then reopen it.
5. Restart the app.
6. Verify every in-scope window restores to its saved bounds or safely defaults if the saved display is unavailable.

## Manual Smoke Scenario: Split Defaults And Persistence

1. Start with no saved layout state.
2. Open workbench properties/output auxiliary groups and verify side/bottom controlled panes default to 200px.
3. Open representative split editors: Orchestra, UDO workspace, BSB interface, Piano Roll, LineObject, ZakLineObject, and PatternObject where fixture data allows.
4. Verify each user-adjustable split starts at 200px unless a documented parity/minimum-size exception applies; the BSB interface right property pane should default to 250px.
5. Move each splitter to a distinct pixel size.
6. Restart the app or reopen the editor.
7. Verify each splitter restores to the saved controlled-pane pixel size.

## Manual Smoke Scenario: Clamping

1. Save a large split size in a wide window.
2. Shrink the window until the saved size cannot fit.
3. Verify the visible divider clamps to a usable size.
4. Enlarge the window again.
5. Verify the original saved size can restore and was not overwritten by the clamp.

## Manual Smoke Scenario: Reset Windows

1. Save non-default main window bounds, secondary window bounds, workbench layout, and split locations.
2. Open a project and make it dirty.
3. Choose Window > Reset Windows.
4. Verify there is no project save/discard prompt.
5. Verify window/workbench/splits return to defaults immediately.
6. Restart the app.
7. Verify defaults remain and unrelated settings such as recent files, render settings, MIDI/OSC placeholders, and utility settings are preserved.

## Legacy Migration Smoke Scenario

1. Seed `blue-settings.windowBounds` and `blue-workbench-layout` in renderer storage while app-wide layout settings are absent.
2. Start the app.
3. Verify missing app-wide layout fields are filled from legacy values.
4. Change app-wide layout settings.
5. Restart again with stale legacy values still present.
6. Verify newer app-wide settings are not overwritten.

## Implementation Notes

- `SAVE_EVENTS` in `window-state-manager.ts` uses `'resize'` and `'move'` (not `'resized'`/`'moved'`) to match Electron's BrowserWindow event type overloads; the test mock triggers `'resize'`/`'move'`.
- Settings-window and effect-editor-window-manager test mocks both need a `removeListener` stub for `attachWindowStateHandlers` to call `.bind()` without error.
- `mergeWindowLayoutSettings` uses `isSplitId()` as a discriminator so unknown keys are silently dropped; `WINDOW_IDENTITIES` is the canonical list of valid `WindowId` values.
- SplitPane is backward-compatible: when no `splitId` is provided, it falls back to the legacy ratio-based behavior from before this spec.
- A `blue-workbench-layout` localStorage mirror is kept in sync on save as a first-launch fallback for new installs where no app-wide settings file exists yet.
