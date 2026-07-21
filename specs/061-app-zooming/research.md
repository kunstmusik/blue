# Research: App Zooming

## Decision: Use Conventional Menu Items With Custom Main Callbacks

**Decision**: Add a top-level View menu containing custom `Zoom In`, `Zoom Out`,
and `Actual Size` items with `CommandOrControl+Plus`, `CommandOrControl+-`, and
`CommandOrControl+0` accelerators. Do not assign Electron zoom roles to these
items.

**Rationale**: Electron recommends roles when their predefined behavior is the
whole requirement, but a role executes before and instead of a custom click
handler. The pinned Electron 35.7.5 role implementation targets the focused
`WebContents` and therefore cannot also run Blue's exact percentage,
all-window, and persistence workflow. Native application-menu accelerators are
local to Blue while it is focused and continue to work when a Settings, effect,
or popout window owns focus.

**Alternatives considered**:

- Built-in `zoomIn`, `zoomOut`, and `resetZoom` roles: rejected because they
  own the action, target the focused page, and provide no durable app-wide
  update hook.
- Renderer keyboard listeners: rejected because every renderer context would
  need duplicate logic and focused editors can consume DOM events.
- `globalShortcut`: rejected because it remains active when Blue is not
  focused.

**Sources**: [Electron menu guidance](https://www.electronjs.org/docs/latest/tutorial/menus),
[Electron 35.7.5 menu roles](https://github.com/electron/electron/blob/v35.7.5/lib/browser/api/menu-item-roles.ts),
[Electron 35.7.5 MenuItem execution](https://github.com/electron/electron/blob/v35.7.5/lib/browser/api/menu-item.ts),
[local keyboard shortcuts](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts/),
and [accelerators](https://www.electronjs.org/docs/latest/api/accelerator).

## Decision: Use Exact Integer Percentages And `setZoomFactor`

**Decision**: Model zoom as an integer from 50 through 300 inclusive, aligned
to a 10-point step, and apply the absolute value as `percent / 100` with
`webContents.setZoomFactor()`.

**Rationale**: This produces the specification's exact 26 legal values without
floating-point accumulation. Electron's `zoomLevel` is exponential
(`factor = 1.2 ^ level`); Electron 35.7.5's built-in zoom roles adjust the
level by 0.5, which is approximately a 9.54% multiplicative change rather than
an exact 10-percentage-point step. Absolute factors are idempotent when the same
origin already propagated a value.

**Alternatives considered**:

- `setZoomLevel`: rejected because its exponential ladder does not match the
  required values.
- CSS transforms or root font-size changes: rejected because they are not
  equivalent to whole-page zoom and risk inconsistent editor, canvas, and
  layout behavior.
- Read the current factor from whichever window is focused: rejected because
  one main-owned integer is a simpler deterministic source for all windows.

**Sources**: [Electron WebContents zoom API](https://www.electronjs.org/docs/latest/api/web-contents/)
and [Electron 35.7.5 WebContents tests](https://github.com/electron/electron/blob/v35.7.5/spec/api-web-contents-spec.ts).

## Decision: Keep One Main-Process App Zoom Controller

**Decision**: Add a small main-process controller that loads the normalized
preference, owns the current session percentage, computes commands, applies an
absolute factor to every live Blue BrowserWindow, and attempts persistence.

**Rationale**: The main process already owns the native menu, every
BrowserWindow, and program settings. One controller avoids renderer-to-renderer
coordination across the main workbench, Settings, effects, and Dockview
popouts. It also gives unit tests injectable window and persistence adapters.

**Alternatives considered**:

- Renderer Zustand/localStorage: rejected because
  `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/ui-store.ts`
  has an unused per-renderer `zoom` field that does not change Chromium page
  zoom and cannot synchronize separate renderer contexts.
- Add preload/IPC zoom commands: rejected because native menu commands already
  originate in main and no renderer needs to own the value.
- Independent per-window values: rejected by the application-wide feature
  scope.

## Decision: Apply Zoom Before First Visible Content

**Decision**: Initialize the controller and register a
`browser-window-created` listener before `createWindow()` is first called.
Pass the current factor through `webPreferences.zoomFactor` in Blue's explicit
main, Settings, and effect BrowserWindow factories and through the Dockview
popout `overrideBrowserWindowOptions`. Immediately apply the factor from the
creation listener and reapply it on navigation as a uniform safety net for
recreated and future app-owned BrowserWindows.

**Rationale**: Main, Settings, and effect windows already use `show: false` and
`ready-to-show`. Dockview popouts are created indirectly through `window.open`,
but Blue controls their constructor override. Electron acceptance testing
showed that applying only at `browser-window-created` can be reset when the
popout navigation commits, so the override must also carry `zoomFactor` and the
lifecycle listener must reapply during navigation. This remains earlier than
`did-finish-load`, which can occur after visible content.

**Alternatives considered**:

- Apply after `did-finish-load`: rejected because it can visibly flash at 100%
  before restoration.
- Modify only known factories: rejected as the sole mechanism because future
  windows would be easy to miss; all current known factories, including the
  Dockview window-open override, still receive the factor declaratively.
- Rely only on a child-window constructor override: rejected as the sole
  mechanism because an explicit creation event plus `setZoomFactor()` is more
  robust for the pinned Electron line and verifiable at runtime.

**Sources**: [BrowserWindow startup and zoomFactor guidance](https://www.electronjs.org/docs/latest/api/browser-window),
[app `browser-window-created`](https://www.electronjs.org/docs/latest/api/app),
and [renderer-created window customization](https://www.electronjs.org/docs/latest/api/window-open).

## Decision: Apply Explicitly To Every Blue BrowserWindow

**Decision**: On each changed command, iterate Blue's live BrowserWindows,
skip destroyed windows or destroyed web contents, and set the same absolute
factor on each. Treat one window's failure independently so it cannot block
the others.

**Rationale**: Electron documents same-origin zoom propagation, but Blue uses
multiple development/production URLs and may use different sessions or future
partitions. Explicit application makes the scope deterministic. The repository
already uses `BrowserWindow.getAllWindows()` as its application-window
inventory, denies non-popout `window.open` requests, and keeps DevTools outside
the app-content window set.

**Alternatives considered**:

- Rely on Chromium origin propagation: rejected because propagation is implicit
  and origin/session dependent.
- Iterate all Electron `webContents`: rejected because that collection can
  include DevTools and other non-window content outside the specification.

## Decision: Store One Default-Filled App-Specific Scalar

**Decision**: Add `appZoomPercent` to `CurrentAppSettingsSnapshot`, default it
to 100, normalize missing/non-finite/out-of-range/off-step saved values to 100,
and reject unsupported values during generic settings validation. Keep
`PROGRAM_SETTINGS_VERSION` at 2.

**Rationale**: `appSpecific` is the established home for Blue-only profile
preferences and already persists to `program-settings.json` under Electron user
data. The additive field can be filled safely when older files are merged; no
destructive migration is needed. Avoiding a version bump also avoids an eager
startup rewrite through an existing path whose filesystem exceptions are not
caught.

**Alternatives considered**:

- Nested versioned zoom envelope: rejected because one validated scalar has no
  independent migration or child state.
- Top-level setting or separate `app-zoom.json`: rejected because it creates a
  second source of app-profile truth.
- Store in project XML or the window-layout envelope: rejected because app
  zoom is neither authored project data nor window placement/layout state.
- Bump program settings to version 3: rejected because default filling is
  sufficient and a forced migration write creates unnecessary startup risk.

## Decision: Protect Main-Owned Zoom From Stale Settings Drafts

**Decision**: Before the existing `program-settings:save` handler accepts a
full renderer-supplied snapshot, replace its `appZoomPercent` with the
controller's current value. Factor this merge into a pure testable helper.

**Rationale**: The Settings renderer loads and later saves a complete
`ProgramSettingsSnapshot`. If app zoom changes while Settings remains open,
its draft contains the older value and could otherwise overwrite the newer
main-owned preference. Settings does not expose an app zoom field, so preserving
the controller's current value is the only intended behavior.

**Alternatives considered**:

- Add live settings synchronization IPC to the Settings renderer: rejected as
  unnecessary coordination for a field it does not edit.
- Let last full snapshot win: rejected because it silently loses the most
  recent user zoom command.

## Decision: Persistence Failure Does Not Roll Back Runtime Zoom

**Decision**: Compute and apply the new percentage first, then save a cloned
program-settings snapshot in a guarded call. If validation or filesystem write
fails, retain the new controller value, leave every window scaled, report a
failed persistence result for logging/tests, and allow later commands.

**Rationale**: The feature explicitly requires continued current-session use
when persistence fails. Cloning avoids mutating the settings cache before a
successful save, while the controller remains authoritative for newly created
windows during that session.

**Alternatives considered**:

- Persist before applying: rejected because a disk error would block an
  accessibility action.
- Roll back windows after a write error: rejected by the specification.
- Ignore the error without a result or log: rejected because tests and
  diagnostics need to distinguish durable and session-only changes.

## Decision: Use Layered Unit And Electron Smoke Coverage

**Decision**: Test arithmetic/normalization in shared unit tests, controller
window/persistence behavior with injected adapters, menu contracts in template
tests, persistence round-trip in the program settings store, and real
first-paint/accelerator behavior in a scripted Playwright/Electron acceptance
pass. The driver covers the specification's 100-restart and 250-millisecond
metrics; manual smoke retains visual layout and reachability judgment.

**Rationale**: Pure tests can prove all 26 values and failure semantics but
cannot prove Chromium layout scaling, native accelerator precedence with a
focused CodeMirror editor, or the absence of a visible first-frame flash.

**Alternatives considered**:

- Unit tests only: rejected because native menu and rendering behavior remain
  unverified.
- End-to-end tests only: rejected because malformed settings, write failures,
  and every boundary transition are faster and more deterministic in focused
  unit tests.

## Resolved Questions

No `NEEDS CLARIFICATION` items remain. Electron 35.7.5 is outside Electron's
current supported-major window, but every planned API is present in the pinned
version and verified against that version's source/tests. Future Electron
upgrades should rerun the menu accelerator and child-window first-paint smoke
checks. See [Electron's support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines).
