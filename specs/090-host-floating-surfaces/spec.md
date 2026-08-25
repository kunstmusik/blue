# Feature Specification: Host-Aware Floating Surfaces

**Feature Branch**: `090-host-floating-surfaces`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Make context menus and tooltips visibly render across docked and floated Blue panels through a generalized in-window solution. Record the popup-clipping research, avoid native context menus, and avoid transparent overlay windows."

## Clarifications

### Session 2026-08-25

- Q: How should the in-scope surface set be defined so SC-001's "100% of in-scope" edge-position matrix is testable? → A: Name a concrete acceptance set in the spec (score-canvas context menus, line-editor tooltip and context menu, automation point readout); the category rule still governs all other workbench surfaces and the full inventory is enumerated during planning.
- Q: When the host viewport scrolls while a popup is open, what should each surface type do? → A: Context menus close on host scroll (scrolling inside the menu's own content does not dismiss it); tooltips and readouts follow their anchor per Story 2.
- Q: Should the spec add a measurable performance criterion for anchor-following placement updates? → A: Yes — during continuous anchor motion (point drags, active scrolling), an open tooltip/readout performs at most one placement update per rendered frame, and stops updating when closed or unmounted.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Context menus remain visible near panel edges (Priority: P1)

When a user opens a context menu in a docked panel or a floated workbench panel, the menu remains fully usable even when the pointer is close to a panel, viewport, scroll-container, or window edge.

**Why this priority**: Context menus are primary action surfaces. A clipped menu prevents users from reaching commands and is especially disruptive in small floated panels.

**Independent Test**: Open each in-scope context menu near the top, bottom, left, and right edges in both a docked panel and a floated panel. Confirm that the menu is visible, interactive, and dismisses correctly.

**Acceptance Scenarios**:

1. **Given** a context menu trigger near an edge of a docked panel, **When** the user opens the menu, **Then** the menu changes placement or shifts inward so every menu item remains visible.
2. **Given** a context menu trigger near an edge of a floated panel, **When** the user opens the menu, **Then** the menu is rendered in the floated panel's visible window and does not appear in the main window.
3. **Given** an open context menu, **When** the user clicks inside the menu, **Then** the menu remains open until the selected command completes and no canvas or row handler behind the menu is triggered.
4. **Given** an open context menu in a floated panel, **When** the user presses Escape or clicks elsewhere in that same floated window, **Then** the menu closes; input in the main window does not close or operate the floated menu.

### User Story 2 - Tooltips and automation readouts remain visible (Priority: P1)

When a user hovers or drags a point that displays a tooltip or automation readout, the information remains visible and attached to the point without being clipped by a timeline row, SVG, scroll container, or host-window edge.

**Why this priority**: Tooltips and readouts provide essential value and parameter feedback during editing. Clipping is most likely during the high-value interactions that occur near row and window edges.

**Independent Test**: Hover and drag line-editor points and automation points near every edge in docked and floated panels. Scroll and resize the host panel while the surface is open, then verify placement and content.

**Acceptance Scenarios**:

1. **Given** an automation point near the top or bottom of a timeline row, **When** its readout is shown, **Then** the complete readout is visible outside the row's clipping region while retaining the existing x/y values and label formatting.
2. **Given** a line-editor point near a host-window edge, **When** its tooltip is shown, **Then** the tooltip shifts or flips within the host viewport and remains readable.
3. **Given** an open tooltip or readout, **When** the user scrolls or resizes the host panel, **Then** the surface follows its anchor or closes when the anchor is no longer visible.
4. **Given** a tooltip or readout that is informational only, **When** the user moves the pointer across it, **Then** it does not steal pointer input or interfere with editing gestures.

### User Story 3 - Popup behavior stays consistent through panel lifecycle changes (Priority: P2)

When a panel is floated, re-docked, closed, or unmounted while a popup is open, the popup follows the panel's hosting context or is safely removed without leaving stale visuals or listeners behind.

**Why this priority**: Dockview can move panel content between OS windows without remounting the React tree. Lifecycle correctness prevents invisible menus, stale dismissal handlers, and cross-window input bugs.

**Independent Test**: Open each representative popup, float and re-dock its panel, close the panel, and repeat the same interactions after each transition.

**Acceptance Scenarios**:

1. **Given** an open popup in docked content, **When** the content is floated, **Then** the popup is either moved to the new host document or closed safely, with no copy left in the old document.
2. **Given** an open popup in a floated panel, **When** the panel is re-docked or unmounted, **Then** no orphaned popup remains in either document and no dismissal listener remains attached to the old host.
3. **Given** a popup rendered from a panel, **When** a second document represents its floated host, **Then** inside/outside target classification works across the two JavaScript realms.

### Edge Cases

- The anchor is close to all viewport edges and the popup is larger than the available space on either side.
- The popup is opened while a scroll container is moving or while a point is being dragged.
- A floated panel is resized below the popup's preferred size.
- The host document changes during the same interaction that opens a popup.
- A popup is opened in a no-DOM test or server-rendering environment.
- A portaled popup receives input while an ancestor has capture-phase pointer or mouse handlers.
- A menu has nested submenus or a tooltip/readout has text wider than its initial estimate.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST keep all in-scope workbench context menus, tooltips, and readouts inside the visible window that hosts the panel content, regardless of whether the panel is docked or floated.
- **FR-002**: The system MUST allow in-scope surfaces to escape clipping caused by rows, SVGs, scroll containers, and other internal layout containers.
- **FR-003**: The system MUST choose a visible placement by flipping or shifting the surface relative to the anchor and MUST constrain oversized content so it remains usable within the host viewport.
- **FR-004**: The system MUST calculate placement and viewport limits from the popup's host document and host window, never from an unrelated main-window document.
- **FR-005**: The system MUST update an open tooltip, readout, or popover when its anchor moves because of scrolling, resizing, layout changes, or panel floating transitions, and MUST stop updates when the surface closes or its host unmounts. Context menus MUST close when their host viewport scrolls, while scrolling within a menu's own content MUST NOT dismiss it.
- **FR-006**: The system MUST bind Escape and outside-pointer dismissal to the document that hosts the popup, preserve inside-popup interactions, and ignore equivalent input from unrelated documents.
- **FR-007**: The system MUST prevent interactive portaled popup events from activating selection, focus, drag, audition, or other handlers belonging to the React ancestor behind the popup.
- **FR-008**: The system MUST provide one consistent placement, sizing, dismissal, and lifecycle policy for all in-scope custom surfaces so individual callers do not implement conflicting edge behavior.
- **FR-009**: The automation point readout MUST preserve its established x/y value and parameter-label content and MUST retain its Java Blue edge-placement behavior while becoming visible outside the clipping row.
- **FR-010**: Existing themed context menus and tooltips MUST retain their current visual styling, keyboard behavior, submenu behavior, and command semantics while adopting the host-aware visibility policy.
- **FR-011**: The system MUST render no popup content and MUST attach no popup listeners when there is no usable host DOM.
- **FR-012**: The feature MUST NOT introduce native operating-system context menus or transparent overlay windows as part of the generalized solution.
- **FR-013**: The feature MUST NOT modify `.blue` project XML, generated CSD data, or persistent project state; popup state remains disposable interaction state and project edits continue through existing document-bridge contracts.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue's `ParameterLinePanel.drawPointInformation` displays the selected automation point's x/y values and optional label, placing the readout beside the point and moving it to the opposite side when it would overflow the panel.
- **Compatibility Requirements**: Preserve the readout's displayed values, formatting, label inclusion, point-selection behavior, and command semantics of existing context menus in docked mode. Preserve unknown project data and all existing project mutation pathways because this feature does not change project persistence.
- **Intentional Divergences**: The TypeScript implementation will use a styled in-window surface hosted by the active Electron document rather than a native Swing/OS popup. Native context menus and transparent overlay windows are explicitly excluded by product direction.
- **State Ownership**: Popup open state, anchor state, placement, and dismissal state are renderer-owned disposable interaction state. Project mutations remain owned by the existing canonical project document bridge; no new persistence location is introduced.

### Key Entities *(include if feature involves data)*

- **Host Surface**: A transient menu, tooltip, popover, or readout associated with panel content and rendered in the document that visually hosts that content.
- **Anchor**: The visible element or point location that determines where a host surface should appear.
- **Host Viewport**: The visible coordinate space and relevant clipping region of the active panel window against which a surface is placed and constrained.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the focused edge-position test matrix, 100% of the named acceptance set of in-scope menus, tooltips, and readouts remain fully visible or internally scrollable in docked and floated host windows at the top, bottom, left, and right edges.
- **SC-002**: In 100% of floated-panel interaction cases, popup content appears in the floated panel's window, remains interactive there, and is unaffected by equivalent input in the main window.
- **SC-003**: In 100% of representative float, re-dock, resize, close, and unmount cases, no orphaned popup, stale listener, or cross-window dismissal behavior remains.
- **SC-004**: Existing docked context-menu, tooltip, submenu, keyboard-dismissal, and command-activation workflows remain behaviorally unchanged in the focused regression suite.
- **SC-005**: The automation point readout remains readable at the smallest supported host-panel sizes without reducing application-owned text below the approved typography floor.
- **SC-006**: No native context-menu surface or transparent overlay window is created by the feature, and no project XML or persistent project state changes as a result of popup placement.
- **SC-007**: During continuous anchor motion such as point drags or active scrolling, an open tooltip or readout performs at most one placement update per rendered frame, and no placement updates occur after the surface closes or its host unmounts.

## Assumptions

- The primary product goal is reliable visibility within the active Electron window, including visibility outside internal scroll and row clipping regions.
- Crossing the outer OS window boundary is not required for this feature; if that becomes a requirement later, it will be specified separately.
- Existing Radix surfaces remain the source of menu and tooltip semantics where they already provide the required behavior; the generalized policy governs their host document and event handling.
- In-scope surfaces are workbench-panel context menus, tooltips, popovers, and automation/line-editor readouts rendered from docked or floated panel content; unrelated system-owned Settings-window surfaces are excluded. The named acceptance set for edge-position validation is: score-canvas context menus, the line-editor tooltip and context menu, and the automation point readout. All other workbench surfaces follow the same category rule; the full surface inventory is enumerated during planning.
- The separate Settings window is not treated as a Dockview popout and remains governed by its own window-local behavior.
- Application-owned popup text follows the existing semantic typography roles and readability floor; project-authored typography remains canonical project data.
- Validation will use the existing two-document popup test pattern plus focused Electron/manual acceptance for actual docked and floated windows.
