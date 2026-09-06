# Feature Specification: Improve UI Accessibility

**Feature Branch**: `101-improve-ui-accessibility`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Review the existing color contrast and WCAG reports, perform an independent audit, and plan work to improve contrast and accessibility."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read Application Content Reliably (Priority: P1)

A user with low vision or reduced contrast sensitivity can read enabled application-owned text and identify essential controls throughout Blue's dark interface without changing system contrast settings.

**Why this priority**: Several shared text, border, syntax, and active-state color pairings currently miss minimum contrast, so the problem affects common workflows across the application.

**Independent Test**: Inspect the default dark theme and representative settings, score, mixer, editor, menu, dialog, and empty-state surfaces; verify every in-scope text and essential non-text pairing against the stated contrast floors.

**Acceptance Scenarios**:

1. **Given** enabled application-owned text smaller than large text, **When** its rendered foreground and background are measured, **Then** the contrast ratio is at least 4.5:1 without rounding up.
2. **Given** an essential control boundary, icon, state indicator, or focus indicator, **When** it is measured against adjacent colors, **Then** it has at least 3:1 contrast where WCAG requires non-text contrast.
3. **Given** a raised, recessed, or overlaid surface, **When** it appears in the default dark theme, **Then** its visual relationship is consistent and controls do not rely on a barely perceptible surface difference for identification.

---

### User Story 2 - Navigate with a Keyboard and Track Focus (Priority: P1)

A keyboard-only user can reach and operate application controls while always seeing which operable element has focus.

**Why this priority**: Global and local outline suppression currently removes focus indication from multiple custom controls and workbench surfaces.

**Independent Test**: Starting from each renderer entry point, traverse representative toolbars, panels, menus, dialogs, score controls, mixer controls, and Blue Synth Builder controls using only the keyboard; verify focus remains visible and no required action is pointer-only.

**Acceptance Scenarios**:

1. **Given** a keyboard-focusable control, **When** it receives keyboard focus, **Then** a visible focus indicator identifies it and is not clipped or hidden by an overlay.
2. **Given** a pointer-driven value control that is not inherently gesture-essential, **When** a user operates it by keyboard, **Then** the value can be changed in predictable increments and its current value is exposed to assistive technology.
3. **Given** a global single-character shortcut, **When** the user is not editing text, **Then** the shortcut can be turned off, remapped, or requires a non-printing modifier key.

---

### User Story 3 - Understand Controls and Dialogs with Assistive Technology (Priority: P1)

A screen-reader user can identify form fields, toggle states, value controls, and modal dialogs and can enter and leave dialogs without losing their place.

**Why this priority**: Unassociated labels, missing toggle semantics, and inconsistent modal semantics block or confuse core workflows even when the UI is visually clear.

**Independent Test**: Use the accessibility tree and keyboard navigation on representative settings fields, number inputs, score mute/solo controls, mixer values, Blue Synth Builder values, and every application-owned modal family.

**Acceptance Scenarios**:

1. **Given** an application-owned form or value control, **When** assistive technology focuses it, **Then** it exposes a meaningful accessible name, role, current value, and state as applicable.
2. **Given** a toggle such as Mute or Solo, **When** its state changes, **Then** both the visible presentation and accessibility state identify whether it is active.
3. **Given** an open modal dialog, **When** the user tabs, presses Escape, or dismisses it, **Then** focus stays within the dialog while open, cancellation is safe, and focus returns to the prior context after close.

---

### User Story 4 - Distinguish Status Without Color Alone (Priority: P2)

A user with color-vision deficiency can distinguish success, warning, danger, connection, mute, solo, and error states without relying on hue alone.

**Why this priority**: Several states use colors with similar luminance or terse letter controls, and some status styles bypass the application theme.

**Independent Test**: Review representative states in grayscale and common color-vision simulations; verify that a visible alternative such as text, icon, shape, pattern, position, or lightness conveys the same meaning, with matching programmatic state where applicable.

**Acceptance Scenarios**:

1. **Given** two states that currently differ primarily by color, **When** hue differences are unavailable, **Then** each state remains identifiable from a non-color cue.
2. **Given** an error or asynchronous status message, **When** it appears, **Then** its visual token is defined, its text is readable, and assistive technology is notified when the update requires attention.

### Edge Cases

- Disabled and purely decorative content remains distinguishable as inactive without being mistaken for enabled content; contrast exemptions are not applied to content that remains operable.
- Focus remains visible in popout windows, portaled menus, nested dialogs, scroll containers, canvases, and compact controls.
- Empty dialogs and dialogs with one or no focusable descendants retain focus safely and still allow cancellation.
- User-authored Blue Synth Builder colors, score-object colors, syntax semantics, and imported project typography remain canonical project content; app-owned chrome around them remains accessible.
- High-contrast changes preserve state recognition at 100%, 200%, and 300% application zoom and on standard- and high-density displays.
- Hover, selected, pressed, error, and focus combinations retain sufficient contrast rather than only the resting state passing.

## Requirements *(mandatory)*

### Feature Scope

- All current unapproved findings from `audit:renderer-theme` must be resolved or recorded as exact, justified ownership exceptions, and all governed application foreground/background pairs must pass.
- Focus remediation covers every current production renderer occurrence of explicit `tabIndex` or outline suppression, classified as an operable control or a non-operable programmatic-focus shell.
- Naming remediation covers `SettingsField` and every current `CommitNumberInput`, `CommitNumberField`, `LiveNumberInput`, and `DraftNumberInput` call site.
- Modal remediation covers every current production renderer file named as a dialog or modal after classification as a true modal, non-modal surface, wrapper/helper, or native host dialog.
- Pointer-equivalent value control remediation covers the mixer fader and the BSB knob, horizontal slider, vertical slider, horizontal slider bank, vertical slider bank, and XY controller families.
- Status remediation covers shared toast behavior plus Midi Settings, Realtime Render Settings, Live Space, REPL Console, and score Mute/Solo states.
- The five React renderer entry points and the scriptless Dockview popout host are included in validation. Other accessibility improvements discovered during implementation require a new scoped follow-up unless they are fixed by an existing shared seam.

### Functional Requirements

- **FR-001**: All enabled, information-bearing, application-owned text MUST meet WCAG 2.2 AA contrast of at least 4.5:1 against every rendered background on which it is intentionally used, except qualifying large text, which MUST meet at least 3:1.
- **FR-002**: Essential visual information in application-owned controls, boundaries, graphical objects, selected states, and keyboard focus indicators MUST meet WCAG 2.2 AA non-text contrast requirements of at least 3:1 where applicable.
- **FR-003**: The default dark theme MUST use coherent semantic roles for base, surface, raised, recessed, input, border, focus, text, status, and text-accent colors, and each role MUST document its permitted uses and contrast floor.
- **FR-004**: Application-owned text and state styling MUST use semantic color roles rather than ungoverned palette colors when the styling communicates shared meaning; established project-authored and data-visualization colors MUST remain exempt at their explicit ownership boundary.
- **FR-005**: Every keyboard-focusable, operable application control MUST present a visible focus indicator when focus is keyboard-originated; generic focus suppression MUST NOT remove the only visible indicator.
- **FR-006**: Every in-scope pointer-adjustable value control MUST also be operable through a keyboard interface without requiring specific timing, except where the underlying function depends on the path of movement rather than its endpoints.
- **FR-007**: Every in-scope settings or numeric value control MUST expose an accessible name and the appropriate role, current value, range, and state.
- **FR-008**: Toggle controls MUST expose their pressed or selected state programmatically and MUST convey active state without relying on color alone.
- **FR-009**: Every application-owned modal MUST expose dialog semantics, an accessible title, modal state, contained tab order, safe Escape dismissal where dismissal is allowed, deterministic initial focus, and focus restoration on close.
- **FR-010**: Follow Playback MUST use `Command+Shift+F` on macOS and `Control+Shift+F` on Windows/Linux instead of the bare printable `F` shortcut.
- **FR-011**: In-scope dynamic error and status feedback MUST use defined semantic styling and MUST be announced to assistive technology when the update is important and not otherwise discoverable.
- **FR-012**: In-scope success, warning, danger, connection, mute, solo, and error meanings MUST remain visually understandable without color perception through text, icons, shape, pattern, position, or sufficient lightness contrast, and MUST expose programmatic state where applicable.
- **FR-013**: Automated checks MUST fail when governed theme roles regress below their documented contrast floors, an application color role is undefined, or a prohibited global focus suppression pattern is introduced.
- **FR-014**: Focused automated tests MUST cover shared dialog behavior, accessible field naming, toggle state, shortcut behavior, and keyboard adjustment of representative mixer and Blue Synth Builder controls.
- **FR-015**: A deterministic manual accessibility matrix MUST cover keyboard-only operation, accessibility-tree inspection, zoom, popout windows, dialogs, and representative default-theme contrast pairings.
- **FR-016**: Existing project data, `.blue` XML, CSD generation, audio behavior, persisted application settings, and project-authored visual values MUST remain unchanged.
- **FR-017**: The color and accessibility guidance MUST define ownership boundaries, contrast and focus rules, validation commands, and an exception process, and MUST remain synchronized with any governed tokens or checks changed by this feature.

### Existing Behavior & Data Compatibility

- **Reference Behavior**: Java Blue is not the behavioral target for this platform-accessibility improvement because the Electron application must satisfy current semantic HTML, keyboard, and WCAG expectations. Java remains a visual reference only where changing familiar state meaning would affect users.
- **Compatibility Requirements**: Existing project operations, key commands other than a remediated bare printable shortcut, application typography roles, `.blue` serialization, CSD output, engine behavior, and project-authored colors and fonts must be preserved.
- **Intentional Divergences**: Electron focus presentation, accessible names, modal semantics, and keyboard alternatives may intentionally exceed or differ from Java Blue where required for accessible web-platform behavior.
- **State Ownership**: Theme and accessibility behavior is application-owned renderer presentation state. Project-authored colors and typography remain owned by `BlueData` and persisted in `.blue` XML without normalization. No new durable state is introduced unless shortcut configuration is later selected; the default scope uses a modified shortcut rather than new persistence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of enumerated default-theme, application-owned text pairings pass their applicable WCAG 2.2 AA contrast threshold without rounding.
- **SC-002**: 100% of enumerated essential control boundaries, graphical state indicators, and focus indicators pass the applicable 3:1 non-text contrast threshold.
- **SC-003**: In the manual keyboard matrix, users complete the tested settings, score-layer mute/solo, mixer level, Blue Synth Builder value, menu, and dialog workflows without a pointer and without losing visible focus.
- **SC-004**: Every in-scope modal family passes all modal checks: accessible name, modal semantics, initial focus, contained Tab/Shift+Tab, safe Escape behavior, and focus restoration.
- **SC-005**: Every in-scope form, toggle, mixer value, and Blue Synth Builder value in the accessibility-tree matrix exposes a meaningful name, role, value, and state.
- **SC-006**: Grayscale and common color-vision simulations leave all tested success, warning, danger, connection, mute, solo, and error states distinguishable by at least one non-color cue.
- **SC-007**: The accessibility regression checks and affected application test suite complete with zero newly introduced failures, and the validation guide records any pre-existing unrelated failures separately.
- **SC-008**: At 100%, 200%, and 300% application zoom, every tested workflow retains readable content, visible focus, and operable controls without focus being obscured.

## Assumptions

- WCAG 2.2 Level AA is the target for application-owned renderer UI; AAA is desirable but outside this feature's acceptance threshold.
- The feature covers the current default dark theme and all Electron renderer entry points, including hosted popout windows.
- Native operating-system dialogs and user-authored project content are outside direct visual normalization, but the app-owned controls that launch or surround them remain in scope.
- Existing shared components and validation scripts will be extended before introducing new abstractions or dependencies.
- The bare `F` follow-playback shortcut will become `Command+Shift+F` on macOS and `Control+Shift+F` on Windows/Linux without adding a new preference or migration.
- Wholesale replacement of every historical palette utility is not required; remediation targets failing, undefined, or shared-semantic uses and prevents new regressions.
