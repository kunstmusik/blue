# Contract: App Zoom

This is an internal application-shell contract between browser-safe shared
settings/helpers, Electron main, the native application menu, and Blue-owned
BrowserWindows. Type names are illustrative and must be implemented with
top-level static imports.

## Shared Value Contract

```ts
export const APP_ZOOM_DEFAULT_PERCENT = 100;
export const APP_ZOOM_MIN_PERCENT = 50;
export const APP_ZOOM_MAX_PERCENT = 300;
export const APP_ZOOM_STEP_PERCENT = 10;

export type AppZoomCommand = 'zoom-in' | 'zoom-out' | 'actual-size';

export function isSupportedAppZoomPercent(value: unknown): value is number;
export function normalizeAppZoomPercent(value: unknown): number;
export function resolveAppZoomCommand(current: number, command: AppZoomCommand): number;
export function toAppZoomFactor(percent: number): number;
```

Rules:

- `isSupportedAppZoomPercent` accepts only finite integer multiples of 10 in
  the inclusive 50-to-300 range.
- `normalizeAppZoomPercent` returns the value when supported and 100 otherwise.
- `resolveAppZoomCommand` always returns a supported value and clamps at the
  bounds.
- `toAppZoomFactor` returns `percent / 100` and does not read window state.
- The shared module contains no Electron, renderer, Node built-in, filesystem,
  or project-model imports.

## Program Settings Contract

`CurrentAppSettingsSnapshot` gains one required field:

```ts
interface CurrentAppSettingsSnapshot {
  appZoomPercent: number;
  // Existing fields remain unchanged.
}
```

Rules:

- Default program settings contain `appZoomPercent: 100`.
- Settings load/merge normalizes the saved value with the shared helper.
- Generic settings validation reports unsupported values at
  `appSpecific.appZoomPercent`.
- Existing settings without the field remain compatible through default fill;
  the overall program-settings version does not change for this additive field.
- `.blue` project XML and the window-layout envelope never contain app zoom.

## Main Controller Contract

```ts
interface AppZoomCommandResult {
  previousPercent: number;
  zoomPercent: number;
  changed: boolean;
  persistence: 'saved' | 'failed' | 'not-needed';
}

interface AppZoomController {
  initialize(): number;
  getCurrentPercent(): number;
  getCurrentFactor(): number;
  applyToWindow(window: BrowserWindow): boolean;
  applyToAllWindows(): void;
  execute(command: AppZoomCommand): AppZoomCommandResult;
  preserveCurrentZoom(snapshot: ProgramSettingsSnapshot): ProgramSettingsSnapshot;
}
```

Rules:

- `initialize` is idempotent and completes before the first BrowserWindow is
  created.
- The controller owns one valid current percentage for the process lifetime.
- `applyToWindow` skips a destroyed window or destroyed web contents, catches a
  per-window failure, and applies the current absolute factor otherwise.
- `applyToAllWindows` uses Blue's application BrowserWindow inventory and does
  not enumerate arbitrary `webContents` such as DevTools.
- `execute` updates runtime state and live windows before attempting persistence.
- A changed command saves a cloned program settings snapshot; failed validation
  or a thrown file error returns `persistence: 'failed'` without rollback.
- An unchanged command returns `not-needed` and performs no write.
- `preserveCurrentZoom` returns a new snapshot whose
  `appSpecific.appZoomPercent` is the controller's current value.

## Native Menu Contract

The application menu adds View between Edit and Project on every platform.

| Order | Label | Accelerator | Callback | Electron role |
|------:|-------|-------------|----------|---------------|
| 1 | Zoom In | `CommandOrControl+Plus` | `execute('zoom-in')` | none |
| 2 | Zoom Out | `CommandOrControl+-` | `execute('zoom-out')` | none |
| 3 | Actual Size | `CommandOrControl+0` | `execute('actual-size')` | none |

Rules:

- The items are available with or without a loaded project.
- Menu click and accelerator use the same callback.
- No item carries `zoomIn`, `zoomOut`, or `resetZoom` role metadata.
- Callbacks do not depend on `mainWindow` or the focused renderer, so a focused
  Settings, effect, or popout window changes the one shared value.

## Window Lifecycle Contract

Startup order:

1. Load/normalize program settings and initialize the controller.
2. Register the app-level `browser-window-created` handler.
3. Create the first main BrowserWindow.
4. Apply the current factor before Blue content becomes visible.

For explicit main, Settings, effect editor, effect interface, and Dockview
popout constructors/window-open overrides:

- Pass the current factor as `webPreferences.zoomFactor`.
- Retain existing secure preferences and `show: false` / `ready-to-show`
  behavior.

For every BrowserWindow, including future factories:

- The early creation handler calls `applyToWindow` immediately.
- The handler reapplies the current factor during navigation so committing a
  new application document cannot leave the window at Chromium's default.
- The handler must be installed before the existing popout
  `did-finish-load` registration logic; zoom must not wait for load completion.
- A main window recreated by application activation receives the same runtime
  value.

On a changed command:

- Every live application-owned content window is set to the same factor.
- Newly opened windows subsequently receive that factor from both declarative
  constructor state where available and the creation handler.

## Full Settings Save Contract

The existing Settings renderer submits full snapshots. Main must merge them as
follows before calling generic save:

```ts
const currentZoomPreserved = controller.preserveCurrentZoom(rendererSnapshot);
```

This rule prevents an older Settings draft from replacing a newer zoom command.
All renderer-editable panels, MIDI/OSC data, unrelated app-specific settings,
and window layout retain their existing save semantics.

## Failure Contract

- Invalid persisted input defaults to 100 and never blocks startup.
- A failed settings write does not undo runtime state, revert any window, crash
  the menu callback, or block a later command.
- A failed window update does not block other windows or durable preference
  save.
- A later newly created window uses the controller's current session value even
  if the last write failed.
- Bounds and repeated commands are no-ops rather than errors.

## Renderer And IPC Contract

No new preload, IPC channel, `window.blueAPI` method, renderer store, or React
subscription is introduced. Electron page zoom naturally scales each renderer's
content after main sets its WebContents factor. Existing score/editor-specific
zoom state remains independent.

## Verification Contract

- Compare factors with numeric tolerance in Electron integration tests.
- Unit tests enumerate all 26 values and malformed classes.
- Menu tests assert exact top-level order, item order, labels, accelerators,
  callbacks, and absence of zoom roles.
- Controller tests cover multiple live windows, destroyed/failing windows, new
  window application, boundary no-ops, Actual Size, save failure, later command
  recovery, and stale full-settings preservation.
- An Electron smoke test focuses a CodeMirror editor before invoking each
  shortcut and verifies that the native menu command wins without inserting a
  character.
