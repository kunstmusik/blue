# Window Layout Persistence Research

## Java Blue Parity Findings

- `blue-ui-core/src/main/resources/blue/ui/core/WindowManager.wswmgr` defines NetBeans window-system defaults. The main window is centered and uses relative width/height defaults; NetBeans persists user window-system changes outside project XML and can restore shipped defaults.
- `blue-ui-core/src/main/resources/blue/ui/core/layer.xml` registers the Window menu and the NetBeans window-system metadata. No custom Blue-specific Reset Windows action was found in `blue-ui-core`; the behavior appears to come from the NetBeans platform window system.
- Java Blue commonly initializes split panes at 200px:
  - `blue/ui/core/orchestra/OrchestraTopComponent.java`: outer and inner split panes call `setDividerLocation(200)`.
  - `blue/ui/core/udo/UserDefinedOpcodeTopComponent.java`: library/editor and table/editor split panes call `setDividerLocation(200)`.
  - `blue/soundObject/editor/LineEditor.java`: line table/canvas split calls `setDividerLocation(200)`.
  - `blue/soundObject/editor/PatternEditor.java`: top side split starts at 200px; the lower pattern score area is set to 200px from the bottom when height allows.
  - `blue/ui/core/mixer/EffectsLibraryDialog.java`, `blue/ui/core/udo/EmbeddedOpcodeListPanel.java`, and several Blue Share panes also use 200px split defaults.
- One known exception is `BSBInterfaceEditor.java`, which sets the edit/property split to `width - 250` when edit controls are visible. The Electron feature should default to 200px unless planning documents a specific parity or minimum-size exception.

## Pre-3.0 Split Identity Compatibility

The app-wide split settings schema is still pre-release and has not shipped in
Blue 3.0.0. The active `SplitId` set may therefore change before that release;
the removed pre-release identities are intentionally not retained only for
backward compatibility. No migration is required in this pre-release change.
Once 3.0.0 is released, add a versioned migration for settings written by
pre-3.0 builds and define handling for any removed or renamed split identity.
After 3.0.0, persisted split identities are stable and require migration before
removal or rename.

## Current Electron Findings

- App-wide program settings already exist in `packages/blue-app/src/shared/program-settings.ts` and are saved by `packages/blue-app/src/main/program-settings-store.ts` to `program-settings.json` under Electron user data.
- `ProgramSettingsSnapshot.appSpecific` already contains a legacy `windowBounds` field, plus recent files and app-specific device settings.
- Main window creation in `packages/blue-app/src/main/main.ts` currently uses fixed `width: 1200` and `height: 800`; saved bounds are not applied before showing the window.
- Existing app-owned secondary `BrowserWindow` surfaces include the Settings window and effect editor/interface windows. Planning should enumerate exact identity keys from the current window factory code and include all user-movable or user-resizable app-owned windows.
- Renderer `settings-store.ts` persists legacy `windowBounds` and recent/app-specific data in the `blue-settings` localStorage key, and `use-ipc-listeners.ts` syncs legacy data into program settings once.
- Workbench layout persistence currently uses `WorkbenchShell.tsx` with `LAYOUT_STORAGE_KEY = 'blue-workbench-layout'` in localStorage. `workbench-store.ts` serializes Dockview JSON plus auxiliary state.
- Current auxiliary defaults in `auxiliary-layout.ts` are `360` for the right/properties group and `228` for the bottom/output group.
- The reusable renderer `SplitPane` stores only local React state by ratio. The settings contract should be pixel-based controlled-pane sizes; implementation may convert between pixels and ratios internally.
- Reusable `SplitPane` call sites include Orchestra, Score, UDO workspace, Effects Library, Piano Roll, and BSB Interface surfaces.
- Some score-object editors have local ad hoc split state that must be brought under the same persistence/default contract:
  - `LineObjectEditor` currently defaults to `splitX = 280`.
  - `ZakLineObjectEditor` currently defaults to `splitX = 300`.
  - `PatternObjectEditor` currently defaults to `splitY = 200` and `splitX = 140`.
- The Window menu currently exposes `Reset Default Layout`, which sends `reset-layout` to the renderer. This should become the single user-facing `Reset Windows` command with the broader layout scope rather than a second reset item.

## Decision: Store Layout Under App-Wide Program Settings

**Decision**: Extend app-specific program settings with a versioned `windowLayout` snapshot for window bounds, workbench serialized layout, split locations, and migration markers.

**Rationale**: The user explicitly asked to use the existing application-wide config location. Main-process program settings are already durable, app-wide, test-covered, and independent of `.blue` project XML.

**Alternatives considered**:
- Keep `blue-workbench-layout` localStorage persistence: rejected because it leaves a second durable source of truth and cannot persist BrowserWindow bounds.
- Store layout in `.blue` files: rejected because window/split preferences are app-level, not project data.
- Add a separate layout JSON file: rejected as unnecessary while `program-settings.json` already exists for app-wide settings.

## Decision: Persist Controlled-Pane Pixel Sizes

**Decision**: Persist every split location as the pixel size of the controlled pane. Side splits persist controlled pane width; bottom splits persist controlled pane height.

**Rationale**: Java Blue split defaults are pixel-based, and the user asked for 200px from a side or bottom. Pixel persistence lets defaults and restored values match user-visible divider positions across sessions.

**Alternatives considered**:
- Persist ratios: rejected because a 200px default would become window-size dependent and would not preserve the exact user-visible size.
- Persist raw divider coordinate without controlled-pane semantics: rejected because right/bottom owned panes need stable meaning independent of left/top coordinate systems.

## Decision: Clamp For Display Without Overwriting Saved Values

**Decision**: Invalid or too-large split values are clamped only for current display. The saved value is not rewritten solely because a smaller window forced a clamp.

**Rationale**: A user may reopen the app on a smaller screen temporarily. Preserving the original saved value lets the layout recover when space is available again.

**Alternatives considered**:
- Rewrite clamped values immediately: rejected because temporary monitor/window-size changes would permanently destroy layout preferences.
- Refuse to render invalid splits: rejected because the app must remain usable even with stale settings.

## Decision: Replace Reset Default Layout With Reset Windows

**Decision**: Rename and expand the current Window > Reset Default Layout command into Window > Reset Windows. Do not keep both menu items.

**Rationale**: Java Blue exposes Reset Windows as the user-facing recovery action, and two reset commands with overlapping scopes would be ambiguous.

**Alternatives considered**:
- Add Reset Windows beside Reset Default Layout: rejected because users would have to learn an implementation distinction between workbench-only and whole-window reset.
- Keep Reset Default Layout text: rejected because it misses the Java Blue parity request and understates the command's scope.

## Decision: Migrate Known Legacy Renderer Layout Keys Once

**Decision**: Migrate `blue-settings.windowBounds` and `blue-workbench-layout` into app-wide settings once, using a migration marker/version so startup can retry safely without overwriting newer app-wide values.

**Rationale**: Existing users may already have useful renderer-only layout state. Idempotence prevents stale localStorage from repeatedly replacing newer settings.

**Alternatives considered**:
- Ignore legacy data: rejected because it would discard existing layout preferences.
- Delete localStorage immediately after first attempt: rejected because failed or partial migration would become unrecoverable.
- Always prefer localStorage over program settings: rejected because app-wide settings become the canonical source after this feature.

## Decision: Window Scope Uses Current App-Owned BrowserWindows

**Decision**: The planning/implementation scope includes the main window plus all currently implemented app-owned movable/resizable secondary BrowserWindows: Settings, effect editor, and effect interface windows. Future window types must register their own stable identity before they gain persistence.

**Rationale**: The spec needs concrete scope without guessing future windows. The current code already has more than one BrowserWindow surface.

**Alternatives considered**:
- Main window only: rejected because the user asked for all window locations and sizes.
- Hypothetical future window identities for panels: rejected because current panels are Dockview tabs, not BrowserWindows.
