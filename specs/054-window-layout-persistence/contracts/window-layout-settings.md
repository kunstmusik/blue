# Contract: Window Layout Settings

## App-Wide Settings Shape

`ProgramSettingsSnapshot.appSpecific` gains a versioned layout section:

```ts
interface AppSpecificSettingsSnapshot {
  windowLayout: WindowLayoutSettingsSnapshot;
}
```

`WindowLayoutSettingsSnapshot` is the canonical durable source for:
- app-owned BrowserWindow bounds;
- workbench layout JSON;
- user-adjusted split locations;
- legacy layout migration state.

## Stable Window Identities

Initial in-scope identities:

| Identity | Window |
|----------|--------|
| `main` | Main application BrowserWindow |
| `settings` | Settings BrowserWindow |
| `effect-editor` | Effect editor BrowserWindow |
| `effect-interface` | Effect interface BrowserWindow |

Future windows must add an identity before persistence is enabled.

## Split Location Contract

Each user-adjustable split saves:

```ts
interface SplitLocationSnapshot {
  orientation: 'horizontal' | 'vertical';
  controlledPane: 'first' | 'second';
  sizePx: number;
  updatedAt?: string;
}
```

Rules:
- Side splits default the controlled side pane to `200` px.
- Bottom splits default the controlled bottom pane to `200` px.
- Saved values are clamped for display only.
- A clamped value is not written back unless the user moves the divider.

## Preload/API Contract

The renderer requires typed APIs for layout reads/writes:

```ts
interface BlueAPI {
  getProgramSettings(): Promise<ProgramSettingsSnapshot>;
  updateWindowLayout(update: WindowLayoutUpdateRequest): Promise<WindowLayoutSettingsSnapshot>;
  resetWindows(): Promise<WindowLayoutSettingsSnapshot>;
  onWindowLayoutReset(callback: () => void): () => void;
}
```

### WindowLayoutUpdateRequest

```ts
type WindowLayoutUpdateRequest =
  | { type: 'window-state'; windowId: WindowId; state: WindowStateSnapshot }
  | { type: 'workbench-layout'; serializedLayout: string }
  | { type: 'split-location'; splitId: SplitId; location: SplitLocationSnapshot }
  | { type: 'legacy-migration'; legacy: LegacyLayoutMigrationPayload };
```

### Split Defaults

Most side and bottom controlled panes default to 200px. `bsb.interface.properties` is a documented Java Blue parity exception: it controls the second/right property pane and defaults to 250px.

`workbench.aux.left`, `workbench.aux.right`, and `workbench.aux.bottom` are reserved split identities for auxiliary edge sizes, but their current runtime persistence is embedded in `workbench.serializedLayout`. `udo.workspace.editor` is reserved for a future nested adjustable UDO editor split; the current UDO workspace persists `udo.workspace.outer`.

### Reset Windows Semantics

`resetWindows()`:
- clears layout-only settings;
- persists the cleared/default layout settings;
- marks known legacy renderer layout inputs as migrated so stale localStorage values cannot re-import pre-reset state;
- emits `onWindowLayoutReset` to active renderer windows;
- sends the same runtime reset command currently needed by the workbench;
- does not touch project dirty state and does not show a save/discard prompt.

## Native Menu Contract

The Window menu exposes one reset command:

```ts
type NativeMenuCommand =
  | { type: 'reset-windows' }
  | ...existingCommands;
```

The previous user-facing `Reset Default Layout` label is removed or renamed. No second reset command remains.

## Legacy Migration Contract

Inputs:
- `blue-settings.windowBounds`
- `blue-workbench-layout`

Precedence:
1. Existing app-wide layout values win.
2. Legacy values fill missing app-wide values.
3. Migration markers prevent repeated stale imports.

Failure handling:
- If parsing fails, ignore the invalid legacy value and keep defaults.
- If save fails, leave migration marker unset so a later launch can retry.

## Validation Contract

Window restore rejects or defaults when:
- bounds are missing or malformed;
- width or height is below minimum visible size;
- bounds do not intersect any available display work area.

Split restore clamps when:
- `sizePx` is less than the controlled pane minimum;
- `sizePx` is greater than available size after the opposite pane minimum is reserved.

Validation must preserve valid sibling values in the same settings snapshot.
