# Data Model: App Zooming

## Entity: AppZoomPreference

**Purpose**: Durable application-profile preference representing Blue's one
shared content scale.

**Storage location**:

```text
ProgramSettingsSnapshot.appSpecific.appZoomPercent
```

**Fields**:

- `appZoomPercent`: integer percentage.

**Default**:

- `100`.

**Valid values**:

- Finite integer.
- Inclusive range `50` through `300`.
- Aligned to `10` percentage-point steps.
- Exactly 26 values: `50, 60, ... 290, 300`.

**Normalization**:

- Missing, `null`, non-number, `NaN`, infinite, fractional, out-of-range, or
  off-step input becomes `100` during settings merge/load.
- A generic save containing an unsupported value produces a validation error at
  `appSpecific.appZoomPercent`.

**Relationships**:

- Owned by the app-wide `ProgramSettingsSnapshot`; it is not part of any
  settings panel, project document, or workbench layout envelope.
- Seeds `AppZoomRuntimeState` once during application startup.
- Updated by successful Zoom In, Zoom Out, and Actual Size state changes.

## Entity: AppZoomRuntimeState

**Purpose**: Main-process source of truth for the current session, including
when durable persistence is temporarily unavailable.

**Fields**:

- `zoomPercent`: current valid integer percentage.
- `zoomFactor`: derived value `zoomPercent / 100` used for window content.
- `initialized`: whether the normalized preference has been loaded.

**Invariants**:

- `zoomPercent` is always a legal `AppZoomPreference` value.
- `zoomFactor` is derived, never accumulated from previous factors.
- Runtime state changes before persistence is attempted and is not rolled back
  by a persistence failure.
- Every new application-owned content window receives the current factor.

**Relationships**:

- Initialized from `AppZoomPreference`.
- Projects its factor onto zero or more `ApplicationOwnedContentWindow`
  instances.
- Produces an `AppZoomCommandResult` for each menu command.

## Entity: ApplicationOwnedContentWindow

**Purpose**: Runtime target whose rendered page adopts the one shared app zoom
factor.

**Initial window kinds**:

- Main workbench.
- Settings.
- Effect editor.
- Effect interface.
- Dockview floating workbench popout.

**Transient fields used by the controller**:

- Window destruction state.
- Web contents destruction state.
- Current page zoom factor.

**Rules**:

- A destroyed window or destroyed web contents is skipped without failing the
  rest of a broadcast.
- The current factor is applied at creation before Blue content is first shown.
- A failure in one window does not prevent other live windows from updating.
- Native chrome, the application menu bar, DevTools, and external content are
  not modeled as application-owned content windows.

## Entity: AppZoomCommand

**Purpose**: One application-local native menu/accelerator intent.

**Values**:

- `zoom-in`: add 10 percentage points, clamped to 300.
- `zoom-out`: subtract 10 percentage points, clamped to 50.
- `actual-size`: set to 100.

**Rules**:

- A command at its effective target is a no-op: it does not overshoot, error,
  or require a persistence write.
- Menu selection and accelerator activation invoke the same command function.

## Entity: AppZoomCommandResult

**Purpose**: Testable/diagnostic result of one controller command.

**Fields**:

- `previousPercent`: valid percentage before the command.
- `zoomPercent`: valid percentage after the command.
- `changed`: whether the percentage changed.
- `persistence`: `saved`, `failed`, or `not-needed`.

**Rules**:

- `not-needed` is used only for a boundary/already-at-target no-op.
- `failed` does not imply runtime rollback.
- Menu behavior does not require exposing this result to a renderer.

## Settings Snapshot Merge Rule

The Settings window edits a full program-settings draft but does not edit app
zoom. When main receives that draft, it MUST replace the draft's
`appSpecific.appZoomPercent` with `AppZoomRuntimeState.zoomPercent` before
validation/save. This prevents a stale Settings draft from reverting a later
View-menu change while preserving every renderer-editable settings section.

## State Transitions

### Startup

```text
uninitialized
  -> restored       when a valid saved preference exists
  -> defaulted      when the field is missing or invalid
restored/defaulted
  -> applied        before the first Blue content window is shown
```

Both `restored` and `defaulted` establish a valid runtime value; invalid input
never becomes runtime state.

### Zoom Command

```text
current
  -> unchanged      when the command resolves to the current value
  -> applied        when a different valid value is set on live windows
applied
  -> saved          when program settings persistence succeeds
  -> session-only   when validation or file persistence fails
session-only
  -> applied        when a later command changes or reapplies the runtime value
```

### New Window

```text
created
  -> zoom-applied
  -> content-loaded
  -> visible
```

The required ordering is zoom application before first visible Blue content.

### Actual Size

```text
50..90 or 110..300
  -> 100 applied
  -> saved or session-only
100
  -> unchanged / persistence not-needed
```

## Non-Relationships

- App zoom does not modify `.blue` XML, project dirty state, project selection,
  score timeline zoom, waveform magnification, window bounds, Dockview layout,
  display scale, or system accessibility magnification.
- Reset Windows does not reset app zoom because it updates only the window
  layout sibling under app-specific settings.
