# Data Model: 089-fix-popout-portals

Date: 2026-08-24.

This feature introduces no persisted schema. Popup interaction state remains
ephemeral, while the already-persisted workbench layout gains corrected
save/restore semantics for popout groups. The entities below describe both
runtime correctness and the existing serialized restore intent.

## Entity 1: Host Document

The browser `Document` of the window that visually hosts a panel's content.

- **Identity**: Resolved once per panel from the panel shell's rendered node
  (`node.ownerDocument`).
- **Values**: Main window document (docked panels) or popout document (floated
  panels). Never null in real DOM environments; test/SSR environments may yield
  none, in which case popup surfaces render nothing rather than crash.
- **Lifecycle**: Resolved when the panel mounts and re-resolved when Dockview
  adopts/moves its live DOM node into another document; correctness does not
  depend on a React unmount/remount occurring during float transitions.
- **Relationships**: Provided to all descendant UI through one React context;
  consumed by every popup surface, positioning calculation, and dismissal
  listener owned by that panel.
- **Validation rules**: Consumers MUST treat "no document" as render-nothing;
  consumers MUST NOT fall back to the global main-window document when the
  context is absent *inside panel content* (that fallback is exactly the bug).

## Entity 2: Popup Surface

Any transient overlay invoked from panel content: Radix context menus and
submenus, dropdown menus, tooltips, hover cards, hand-rolled inline menus,
color picker popover, line-editor overlays (context menu, hover tooltip, point
editor modal), and panel-opened dialogs with Escape handling.

- **Attributes**:
  - `hostDocument`: which document renders and listens for it (Entity 1).
  - `anchor`: the element or rect the popup attaches to (same document as the
    popup, after this feature).
  - `position`: viewport coordinates computed against the host window's
    viewport metrics (innerWidth/innerHeight, scrollable ancestors).
  - `dismissalBinding`: the document/window whose outside-pointer and Escape
    events close it.
- **State transitions**: `closed → open → closed`; terminal transition
  `open → force-closed` when the host panel unmounts, re-docks, or its floating
  window closes (no artifacts left in either window; no errors thrown).
- **Validation rules**: open state MUST place the popup subtree inside
  `hostDocument.body` (or an element within it); containment checks MUST accept
  nodes from `hostDocument`'s realm; dismissal MUST observe events dispatched
  within `hostDocument` only.

## Entity 3: Realm-Safe Containment Rule

The invariant governing "did this pointer event land inside the popup or its
anchor?"

- **Rule**: Membership is determined structurally (target exposes a numeric
  `nodeType` and a callable `contains`; membership via `popupNode.contains(target)
  || anchor.contains(target)`), never via `instanceof` against any single
  window's constructors.
- **Rationale encoded**: Popup subtrees may belong to a different JS realm than
  the module performing the check; cross-realm `instanceof` returns false for
  exactly the nodes that must count as "inside."
- **Validation rules**: For every corrected surface, a mousedown on a node
  inside the portaled popup MUST be classified internal; mousedown elsewhere in
  the host document MUST classify as external; events from other documents MUST
  not reach the binding at all (listener attached to host document only).

## Entity 4: Panel Float Lifecycle (interaction + persistence surface)

Docked ↔ floated states a panel moves through (existing SPEC 055 behavior;
this feature only adds obligations at the edges).

- **States**: `docked`, `floated`, `serialized-floated`, `restoring-floated`,
  `restore-fallback-docked`.
- **Obligations added by this feature**:
  - In `floated`, every Popup Surface resolves Host Document = popout document.
  - Transition `floated → docked` or window-close while a popup is `open`
    forces `force-closed` cleanly (Entity 2 terminal transition).
  - Transition `floated → serialized-floated` captures exact membership and
    origin before shutdown tears down native windows.
  - Transition `serialized-floated → restoring-floated` reconstructs each
    group explicitly and publishes state only for the current Dockview API.
  - A failed reconstruction transitions to `restore-fallback-docked`, leaving
    panels usable and Reset Windows functional.
  - `docked` behavior is byte-for-byte unchanged (regression guard: existing
    suite passes with additions only).
- **Validation rules**: No orphaned overlay DOM remains in either document
  after transitions; no unhandled errors from mid-interaction transitions;
  shutdown-only redocking never replaces `serialized-floated`; restored panel
  membership exactly matches Entity 5.

## Entity 5: Persisted Popout Restore Intent

The popout portion of the existing canonical workbench layout snapshot. No new
fields or storage location are introduced.

- **Attributes already serialized**:
  - `serializedGroupId`: saved identity used to find docking-origin metadata.
  - `panelIds`: exact ordered views in the popout group.
  - `activePanelId`: active view within that group.
  - `gridReferenceGroupId`: main-grid group used as the dock-back reference.
  - `position`: native window bounds.
  - `url`: popout host page.
  - `floatingOrigin`: prior group, index, active panel, and presentation used
    when docking back.
- **Restore transformation**:
  1. Remove popout groups from the snapshot passed to generic grid hydration.
  2. Temporarily insert their panels into the correct main-grid source group.
  3. Hydrate the fully docked grid.
  4. Recreate each popout explicitly from `panelIds` and saved bounds.
  5. Remap `floatingOrigin` from the serialized group id to the runtime group
     id returned by restoration.
- **Validation rules**: A single-panel intent restores one panel, never its
  whole source group. A multi-panel intent restores the exact group and rejects
  unrelated panels. Missing panels or a failed window open trigger the usable
  docked fallback rather than an empty application.

## Entity 6: Shutdown Layout Persistence Gate

The existing main-process boundary that accepts canonical workbench-layout
updates.

- **State**: `running` accepts layout updates; `quitting` returns the last
  persisted snapshot and drops renderer updates caused by native-window
  teardown.
- **Rationale**: Closing a Dockview popout naturally moves its panels back into
  the main grid. During application quit that is teardown implementation state,
  not a user-authored layout change.
- **Validation rules**: User-authored float/dock actions persist while running;
  no update after quit begins may overwrite the last visible floated intent.

## Entity 7: Main-Grid Anchor

The panel used to position/rebuild auxiliary edge groups after primary layout
hydration.

- **Identity**: First available default editor whose live Dockview location is
  `grid`; fallback is any grid-resident panel.
- **Excluded values**: Panels in `popout` or `floating` locations.
- **Validation rules**: Auxiliary group creation must never traverse or anchor
  against a panel element owned by another window/document.
