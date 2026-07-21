# Feature Specification: App Zooming

**Feature Branch**: `061-app-zooming`
**Created**: 2026-07-21
**Status**: Implemented — automated verification passed; supported-platform manual acceptance pending
**Input**: User description: "Add standard Electron-style App Zooming through View menu commands for Zoom In, Zoom Out, and Actual Size with Command or Control shortcuts, and persist the selected scaling across application restarts."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adjust the Application Scale (Priority: P1)

A user can make Blue's rendered interface larger or smaller from a conventional
View menu, or return it to its original size, without changing operating-system
display settings.

**Why this priority**: Direct, discoverable scaling is the core accessibility
and usability value of the feature.

**Independent Test**: Open the View menu in a running application, invoke each
zoom command by menu and keyboard, and verify that the complete rendered
interface changes in the expected direction or returns to 100%.

**Acceptance Scenarios**:

1. **Given** the application is at 100%, **When** the user chooses View > Zoom
   In or presses the displayed Command/Control-plus shortcut, **Then** the
   rendered application content increases to 110%.
2. **Given** the application is above 50%, **When** the user chooses View >
   Zoom Out or presses the displayed Command/Control-minus shortcut, **Then**
   the rendered application content decreases by 10 percentage points.
3. **Given** the application is at any supported scale other than 100%,
   **When** the user chooses View > Actual Size or presses the displayed
   Command/Control-zero shortcut, **Then** the rendered application content
   returns to 100%.
4. **Given** any supported scale, **When** a zoom command is invoked while a
   text editor or another interactive control has focus, **Then** the app zoom
   changes and the control does not insert or consume the shortcut character.

---

### User Story 2 - Retain the Chosen Scale (Priority: P2)

A user who chooses a comfortable application scale sees that same scale the
next time Blue starts.

**Why this priority**: Requiring users to restore an accessibility preference
on every launch defeats the purpose of app-level scaling.

**Independent Test**: Select a non-default scale, quit and relaunch Blue, and
verify that the first visible application content is already displayed at the
saved scale.

**Acceptance Scenarios**:

1. **Given** the user changes the application to 130%, **When** Blue is closed
   and started again, **Then** the first visible application content is shown
   at 130% without a visible 100%-to-130% transition.
2. **Given** the user invokes Actual Size, **When** Blue is restarted, **Then**
   the application opens at 100%.
3. **Given** no valid saved app zoom preference exists, **When** Blue starts,
   **Then** it opens at 100% and remains usable.

---

### User Story 3 - Use One Scale Across Blue Windows (Priority: P3)

A user experiences one predictable application scale across the main
workbench, floating workbench windows, Settings, and application-owned editor
windows.

**Why this priority**: A single app preference avoids jarring size changes and
separate configuration for secondary workflows.

**Independent Test**: Open representative primary and secondary Blue windows,
change app zoom from the focused window, and verify that every open window and
each subsequently opened window uses the same scale.

**Acceptance Scenarios**:

1. **Given** multiple Blue content windows are open, **When** the user changes
   app zoom, **Then** every open Blue content window adopts the new scale.
2. **Given** the app zoom is 120%, **When** the user opens Settings, an effect
   editor, or a floating workbench window, **Then** the new window first appears
   at 120%.
3. **Given** a secondary Blue window has focus, **When** the user invokes a zoom
   shortcut, **Then** the one application-wide scale changes for all Blue
   content windows.

### Edge Cases

- Repeated Zoom In commands stop at 300%; repeated Zoom Out commands stop at
  50%; commands at a boundary do not overshoot or produce an error.
- A missing, malformed, non-numeric, or out-of-range saved preference falls
  back to 100% instead of preventing startup.
- If a preference write fails, the selected scale remains effective for the
  current session and the application continues to operate.
- A window created while another window is still loading receives the current
  app scale before its content becomes visible.
- Closing a project, opening another project, resetting the window layout, or
  moving a window to a display with different system scaling does not change
  the app zoom preference.
- Scaling dense views, editors, dialogs, and menus within rendered content does
  not make their controls permanently unreachable; existing scrolling and
  overflow behavior remains available.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST provide a top-level View menu between the
  existing Edit and Project menus.
- **FR-002**: The View menu MUST provide, in order, Zoom In, Zoom Out, and
  Actual Size commands.
- **FR-003**: Zoom In MUST increase app zoom by 10 percentage points and MUST
  NOT increase it beyond 300%.
- **FR-004**: Zoom Out MUST decrease app zoom by 10 percentage points and MUST
  NOT decrease it below 50%.
- **FR-005**: Actual Size MUST set app zoom to exactly 100%.
- **FR-006**: The three commands MUST display and respond to the platform's
  conventional application-local Command/Control shortcuts using `+`, `-`,
  and `0`, respectively.
- **FR-007**: Menu selection and keyboard activation MUST produce identical
  zoom results, including at the supported boundaries.
- **FR-008**: A zoom change MUST apply to all open application-owned content
  windows and to application-owned content windows opened afterward.
- **FR-009**: The current app zoom MUST be stored as an application preference
  immediately after each successful change, including a change to Actual Size.
- **FR-010**: The saved app zoom MUST be restored before application content
  is first shown after a restart.
- **FR-011**: When no valid saved preference is available, the application
  MUST use 100% as the default app zoom.
- **FR-012**: Invalid saved values MUST be ignored safely and MUST NOT prevent
  the application from starting or the user from selecting a valid zoom.
- **FR-013**: A persistence failure MUST NOT undo the current session's zoom
  change, crash an application window, or block further zoom commands.
- **FR-014**: App zoom MUST affect rendered application content, including text,
  icons, controls, editors, panels, and rendered dialogs, as one coherent
  scale change.
- **FR-015**: App zoom MUST remain independent of project files, project
  selection, workbench layout reset, window geometry, and operating-system
  display scaling.
- **FR-016**: Existing project-specific timeline zoom and other domain-specific
  magnification controls MUST retain their current meaning and saved state.
- **FR-017**: All supported scale levels MUST leave essential actions reachable
  through the application's existing resize, scroll, and overflow behavior.

### Scope Boundaries

- This feature provides one preference for all Blue-owned rendered windows;
  it does not provide per-window or per-project app zoom.
- Native operating-system chrome, the application menu bar, external windows,
  and developer tools are not scaled by this preference.
- Mouse-wheel zoom, trackpad pinch zoom, touchscreen magnification, and a
  user-editable custom percentage are outside this feature.
- This feature does not replace system accessibility magnification or display
  scaling.

### Key Entities

- **App zoom preference**: The last valid application-wide scale selected by
  the user, expressed as a percentage from 50% through 300%, with a 100%
  default and 10-percentage-point steps.
- **Application-owned content window**: A Blue-rendered primary or secondary
  window that adopts the shared app zoom preference; this includes the main
  workbench, floating workbench windows, Settings, and app-owned editors.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of supported-platform acceptance runs, each of the three
  View menu commands and its displayed keyboard shortcut produces the same
  expected zoom result.
- **SC-002**: A visible app zoom change completes within 250 milliseconds of a
  menu or shortcut activation in every open application-owned content window
  under normal desktop load.
- **SC-003**: In 100 consecutive restart tests across at least three distinct
  non-default scales, the first visible application content uses the last
  selected scale with no visible default-scale flash.
- **SC-004**: In multi-window acceptance tests covering the main workbench,
  one floating workbench window, Settings, and one app-owned editor, 100% of
  current and newly opened windows use the same selected scale.
- **SC-005**: Boundary testing confirms exactly 26 selectable scale values from
  50% through 300%, no command moves outside that range, and Actual Size always
  returns to 100% in one action.
- **SC-006**: At every supported scale, users can reach the application menu
  commands and complete one representative essential action in the main
  workbench, Settings, and an app-owned editor without resetting app zoom.

## Assumptions

- App zoom is an application accessibility and comfort preference shared by
  all users of the local application profile, not project-authored data.
- The conventional shortcuts are local to Blue while it is focused; they are
  not operating-system-wide global shortcuts.
- A 10-percentage-point step and 50%-to-300% range follow the standard desktop
  zoom behavior used as the baseline for this feature.
- Applying the preference to all Blue-owned rendered windows is more
  predictable than keeping independent scale values per window.
- Existing application settings persistence and safe-default behavior remain
  available for storing this preference.
- Existing timeline, waveform, and editor-specific zoom behaviors are separate
  domain controls and remain unchanged.
