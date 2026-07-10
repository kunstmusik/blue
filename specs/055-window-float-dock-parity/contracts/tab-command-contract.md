# Contract: Tab Command State

This contract describes the pure renderer command-state model used by the tab context menu. The UI may render it through Radix Context Menu, but command calculation should be testable without rendering.

## Input

```ts
interface TabCommandContext {
  panelId: string;
  groupId: string;
  groupPanelIds: string[];
  activePanelId: string;
  location: 'docked' | 'floating' | 'minimized' | 'slideout' | 'maximized';
  mode: 'editor' | 'properties' | 'output' | 'repl';
  isAuxiliary: boolean;
  isClosable: boolean;
  isFloatable: boolean;
  isCloneable?: boolean;
  isMaximized: boolean;
  dockedEditorGroupCount?: number;
  siblingClosable?: (panelId: string) => boolean;
  siblingFloatable?: (panelId: string) => boolean;
}
```

## Output

```ts
type TabCommandKind =
  | 'close'
  | 'close-all'
  | 'close-other'
  | 'close-group'
  | 'maximize'
  | 'restore'
  | 'float'
  | 'float-group'
  | 'dock'
  | 'dock-group'
  | 'minimize'
  | 'minimize-group'
  | 'shift-left'
  | 'shift-right'
  | 'move'
  | 'move-group'
  | 'size-group'
  | 'clone'
  | 'new-document-tab-group'
  | 'collapse-document-tab-group';

interface TabCommandDescriptor {
  kind: TabCommandKind;
  label: string;
  enabled: boolean;
  reasonDisabled?: string;
}

interface TabCommandState {
  contextPanelId: string;
  contextGroupId: string;
  commands: TabCommandDescriptor[];
}
```

## Required Command Rules

- `Close` is enabled only when the context panel is closable.
- `Close All` is enabled when at least one panel in the context group is closable.
- `Close Other` is enabled when at least one sibling panel in the context group is closable.
- `Close Group` is shown for view/auxiliary contexts and closes only closable panels in that context group.
- `Maximize` is shown when the context group is not maximized and can be maximized.
- `Restore` is shown when the context group is maximized.
- `Float` is always visible and enabled only when the context panel can detach.
- `Float Group` is always visible and enabled only when every panel in the context group can detach.
- `Dock` is always visible and enabled only when the context panel is floating or otherwise detached.
- `Dock Group` is always visible and enabled only when the context group is floating or otherwise detached.
- `Minimize` and `Minimize Group` are shown for view/auxiliary contexts and enabled when the current presentation can minimize.
- `Shift Left` is disabled for the first tab in `groupPanelIds`.
- `Shift Right` is disabled for the last tab in `groupPanelIds`.
- `Clone` is visible for editor contexts and enabled only when the panel is cloneable.
- `New Document Tab Group` is visible for editor contexts and enabled when the selected docked editor group has at least one sibling tab.
- `Collapse Document Tab Group` is visible for editor contexts and enabled when another docked editor group exists.
- `Move`, `Move Group`, and `Size Group` are visible for view/auxiliary contexts but disabled until equivalent submenu/dialog flows are implemented.
- Command state must use the tab that opened the menu, even if another group is focused.

## Deferred Java/NetBeans Commands Classification

Before acceptance, parity review must classify these Java/NetBeans-adjacent commands:

| Command family | First-slice status |
|----------------|--------------------|
| Float / Dock | Implemented as selected-panel commands |
| Float Group / Dock Group | Implemented as group commands |
| Clone | Visible; disabled because no Blue workbench panel is currently cloneable |
| New Document Tab Group | Implemented for docked editor groups with more than one tab |
| Collapse Document Tab Group | Implemented for docked editor groups when another editor group exists |
| Close Group | Implemented for view/auxiliary groups |
| Minimize / Minimize Group | Implemented for auxiliary groups where the current presentation supports it |
| Move / Move Group / Size Group | Visible but disabled; existing drag/resize behavior covers the core workflow, submenu parity remains deferred |
| New Window / duplicate | Omitted; distinct from Float and not part of the NetBeans popup evidence for this slice |
