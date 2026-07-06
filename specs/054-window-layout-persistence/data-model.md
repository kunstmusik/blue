# Data Model: Window Layout Persistence

## Entity: WindowLayoutSettingsSnapshot

**Purpose**: Versioned app-wide layout state stored under program settings.

**Fields**:
- `version`: layout schema version.
- `windows`: map of `WindowId` to `WindowStateSnapshot`.
- `workbench`: optional `WorkbenchLayoutSettings`.
- `splits`: map of `SplitId` to `SplitLocationSnapshot`.
- `legacyMigration`: `LegacyLayoutMigrationState`.
- `lastResetAt`: optional timestamp for diagnostics.

**Relationships**:
- Owned by `ProgramSettingsSnapshot.appSpecific`.
- Referenced by main window lifecycle code, workbench renderer initialization, split controls, and Reset Windows.

**Validation**:
- Unknown top-level fields are ignored.
- Missing sections are filled from layout defaults.
- Invalid window or split values are ignored per entry while preserving valid sibling entries.

## Entity: WindowId

**Purpose**: Stable identifier for one app-owned BrowserWindow layout slot.

**Initial identities**:
- `main`
- `settings`
- `effect-editor`
- `effect-interface`

**Rules**:
- A new app-owned BrowserWindow type must register a stable identity before persistence is added.
- Multiple instances of the same window type may share the type-level identity unless the implementation has a stable per-instance owner key.

## Entity: WindowStateSnapshot

**Purpose**: Persisted normal bounds and display state for one window identity.

**Fields**:
- `normalBounds`: `WindowBoundsSnapshot` captured while not minimized/fullscreen.
- `displayState`: `normal`, `maximized`, or `fullscreen`.
- `updatedAt`: optional ISO timestamp.

**Validation**:
- Width and height must be finite positive numbers and meet the implementation's minimum visible size.
- Bounds must intersect an available display's work area before restore; otherwise defaults are used.
- Fullscreen/maximized state restores only after valid normal bounds are applied.

## Entity: WindowBoundsSnapshot

**Purpose**: Basic rectangle for app-owned window placement.

**Fields**:
- `x`: screen x coordinate.
- `y`: screen y coordinate.
- `width`: window width.
- `height`: window height.

## Entity: WorkbenchLayoutSettings

**Purpose**: App-wide durable workbench layout envelope.

**Fields**:
- `serializedLayout`: current workbench layout JSON string or structured object.
- `updatedAt`: optional ISO timestamp.

**Contains**:
- Dockview JSON.
- Auxiliary group state.
- Left/right/bottom edge assignments.
- Open, active, docked, minimized, slideout, and maximized panel state.
- Docked side/bottom controlled-pane pixel sizes.

## Entity: SplitId

**Purpose**: Stable identity for one user-adjustable split control.

**Initial identity examples**:
- `workbench.aux.left`
- `workbench.aux.right`
- `workbench.aux.bottom`
- `orchestra.outer`
- `orchestra.library`
- `score.main`
- `udo.workspace.outer`
- `udo.workspace.editor`
- `bsb.interface.properties`
- `effects-library.main`
- `piano-roll.field-editor`
- `line-object.lines`
- `zak-line-object.lines`
- `pattern-object.layers`
- `pattern-object.score`

**Rules**:
- Identity names must remain stable across app launches.
- Split identities must describe the persistent UI role, not the current component instance id.
- `workbench.aux.left`, `workbench.aux.right`, and `workbench.aux.bottom` describe auxiliary edge sizes whose current persistence is embedded in `workbench.serializedLayout`; the names remain reserved if those edge sizes are later extracted into the top-level `splits` map.
- `udo.workspace.editor` is reserved for a future nested adjustable UDO editor split. The current UDO workspace persists only `udo.workspace.outer`.
- `bsb.interface.properties` controls the second/right property pane and defaults to 250px as the documented Java Blue parity exception.

## Entity: SplitLocationSnapshot

**Purpose**: Persisted divider state for one split.

**Fields**:
- `orientation`: `horizontal` or `vertical`.
- `controlledPane`: `first` or `second`.
- `sizePx`: pixel width or height of the controlled pane.
- `updatedAt`: optional ISO timestamp.

**Validation**:
- `sizePx` must be finite and positive.
- During render, `sizePx` is clamped to pane minimums and available size.
- Clamping for display does not overwrite `sizePx` unless the user performs a new resize.

## Entity: LegacyLayoutMigrationState

**Purpose**: Tracks one-time migration from renderer-only layout storage into app-wide settings.

**Fields**:
- `blueSettingsWindowBoundsMigrated`: boolean.
- `workbenchLocalStorageMigrated`: boolean.
- `migratedAt`: optional ISO timestamp for the last successful migration.

**Migration Inputs**:
- `blue-settings.windowBounds`
- `blue-workbench-layout`

**Rules**:
- Migration runs automatically after app-wide settings are available.
- Existing app-wide layout values take precedence over legacy values.
- Migration is safe to retry and does not repeatedly import stale renderer values.

## Entity: ResetWindowsRequest

**Purpose**: User-triggered request to restore Java Blue-style default layout.

**Effects**:
- Clears saved window bounds.
- Clears saved workbench layout.
- Clears saved split locations.
- Marks known legacy renderer layout inputs as migrated so stale localStorage values cannot re-import pre-reset state.
- Sets layout state to defaults in the running renderer/workbench.
- Preserves unrelated program settings and project state.

## State Transitions

### Window State

- `defaulted` -> `saved` when a window is moved/resized and persisted.
- `saved` -> `restored` when a future window instance applies valid saved bounds.
- `saved` -> `defaulted` when bounds are invalid/offscreen or Reset Windows runs.
- `restored` -> `saved` when the user moves/resizes/maximizes/fullscreens/closes the window.

### Split State

- `defaulted` -> `saved` when the user moves a divider.
- `saved` -> `clamped-for-display` when the saved size does not fit current space.
- `clamped-for-display` -> `saved` when the current space can display the saved value again.
- `saved` -> `defaulted` when Reset Windows runs.

### Legacy Migration

- `not-migrated` -> `migrated` after known legacy keys are copied where app-wide values are absent.
- `migrated` -> `migrated` on later launches with no data changes.
- `not-migrated` -> `partial` only transiently during a failed write; the next launch retries safely.
