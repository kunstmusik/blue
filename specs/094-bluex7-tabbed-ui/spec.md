# Feature Specification: BlueX7 Tabbed User Interface

**Feature Branch**: `094-bluex7-tabbed-ui`

**Created**: 2026-09-01

**Status**: Accepted — 2026-09-01

**Input**: User description: "Use the /boost agent to investigate the state of BlueX7. I'd like a comparison to Dx7 and dexed for the audio synthesis side, as well as a report on the User Interface. I think the UI needs improvement for usability to reduce need to scroll by having tabs, but I'd like your review on that."

## Clarifications

### Session 2026-09-01

- Q: What is the lifetime of the selected top-level tab and operator sub-tab, and which tab is shown when the editor opens? → A: In-memory presentation state scoped to the open editor instance; the editor always opens on "Voice & Global" with Operator 1 selected; closing and reopening the editor resets the selection; selections are never persisted (see FR-009).
- Q: Which parameters does effective-value sampling subscribe to across tabs, and when do values appear after a tab switch? → A: Only the currently active tab's parameters are polled; hidden tabs are not subscribed; newly visible controls display live values within one poll interval (≤50 ms at the default 20 Hz rate) of activation (see FR-007).
- Q: Are dedicated tab-switch keyboard shortcuts provided beyond the ARIA tablist keys? → A: No; keyboard support is limited to the ARIA tablist pattern (arrow keys, Enter/Space, Tab) per FR-005; no additional editor-level shortcut keys are introduced.
- Q: When the host panel is narrower than 500px, does the top-level tab bar wrap or scroll horizontally? → A: The tab bar remains a single row and scrolls horizontally, keeping the active tab visible; it must not wrap to multiple rows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tabbed Navigation for Major Instrument Sections (Priority: P1)

A sound designer opens the BlueX7 editor in the Orchestra panel or a popout window and navigates between high-level instrument sections (Voice & Global, Operators, Pitch Envelope, and Csound & Code) using a persistent top-level tab bar. The active section fits comfortably within the viewport without requiring vertical scrolling through the other sections.

**Why this priority**: Eliminating excessive vertical scrolling (~1600px height stack) is the primary usability objective, making voice configuration, tuning, and sound design immediately accessible.

**Independent Test**: Can be tested by opening BlueX7 in a standard 600px–800px viewport, clicking through each top-level tab, and verifying that the corresponding section displays fully without scrolling the outer container.

**Acceptance Scenarios**:

1. **Given** an open BlueX7 editor, **When** the user clicks the "Voice & Global" tab, **Then** the Algorithm topology diagram, algorithm selector, transpose, feedback, operator enables, and LFO parameters are displayed in a clean, scroll-free layout.
2. **Given** an open BlueX7 editor, **When** the user clicks the "Operators" tab, **Then** the operator workstation displays with sub-tabs for Op 1 through Op 6, showing the selected operator's tuning, sensitivities, keyboard scaling, and graphical envelope editor.
3. **Given** an open BlueX7 editor, **When** the user switches between tabs, **Then** the top header (Instrument Name, Enabled, Comment, SysEx Import, Undo/Redo) remains pinned and persistently visible.

---

### User Story 2 - Focused Operator Workstation with Sub-Tabs (Priority: P2)

A musician sculpting FM tones switches between Operator 1 through Operator 6 using dedicated operator sub-tabs. Each operator view provides immediate access to frequency ratios, detune, output levels, modulation sensitivities, keyboard scaling curves, and the interactive SVG envelope editor with numeric rate/level controls.

**Why this priority**: FM synthesis requires frequent fine-tuning across multiple operators; providing a dedicated, spacious operator workstation prevents visual clutter and maximizes envelope canvas precision.

**Independent Test**: Can be tested by selecting different operators (Op 1..6), adjusting parameters, dragging envelope nodes, and verifying that patches are dispatched accurately to the instrument model.

**Acceptance Scenarios**:

1. **Given** the "Operators" tab is active, **When** the user clicks "Op 2", **Then** the parameters and graphical envelope for Operator 2 are displayed and the sub-tab indicates its active selection.
2. **Given** an operator is muted via the Global enable toggles, **When** viewing the Operator sub-tabs, **Then** the muted operator displays a visible muted indicator (e.g. "(Muted)" or dimmed badge).
3. **Given** an active envelope drag gesture on an operator envelope, **When** the gesture completes, **Then** exactly one atomic undoable patch is committed to history without switching tabs or losing focus.

---

### User Story 3 - Full-Height Csound Post-Processing Workspace (Priority: P3)

An electroacoustic composer or advanced sound designer switches to the "Csound & Code" tab to write custom Csound post-processing code (e.g. filters, stereo spatialization, delay/reverb effects) or inspect the generated CSD body, F-tables, and parameter bindings.

**Why this priority**: Csound post-code authoring currently suffers from being constrained to a small fixed-height box at the bottom of the long scrolling page. A dedicated tab allows the code editor and preview panes to expand to the full vertical height of the window.

**Independent Test**: Can be tested by opening the Csound & Code tab, typing Csound code into the Monaco editor, switching to the Preview sub-tab, and verifying syntax highlighting, live preview generation, and diagnostics display.

**Acceptance Scenarios**:

1. **Given** the user selects the "Csound & Code" tab, **When** editing Csound post-code, **Then** the code editor expands to use the full available panel height.
2. **Given** the "Generated Preview" sub-tab is selected, **When** voice parameters are modified, **Then** the generated F-tables and Csound instrument body update smoothly in a split or scrollable preview pane.

---

### User Story 4 - Seamless Realtime & Effective-Value Synchronization across Tabs (Priority: P4)

During live playback or BlueLive auditioning, the user switches tabs while automation or live engine values modulate parameters. Effective values update live on the currently visible controls without dropping frames or resetting user input focus.

**Why this priority**: Preserves Blue Electron's Spec 092 live runtime parameter inspection and prevents unnecessary IPC overhead for hidden tabs.

**Independent Test**: Can be tested by enabling live effective value observation and verifying that visible controls update their effective badges when switching tabs during playback.

**Acceptance Scenarios**:

1. **Given** live playback with active automation, **When** the user switches between tabs, **Then** the visible controls on the active tab display live engine values within one poll interval of tab activation (≤50 ms at the default 20 Hz rate).
2. **Given** an open editor with undo/redo history, **When** the user switches tabs, **Then** the undo/redo stack and descriptions remain fully intact and functional.

---

### Edge Cases

- **SysEx Voice/Bank Import**: When a new SysEx voice or bank is imported via the header dialog, all parameters across all tabs (Voice & Global, Operators 1–6, Pitch Envelope) refresh immediately to the newly loaded voice data.
- **Narrow Viewports / Panel Resizing**: When the host panel is resized below 500px width, the top-level tab bar remains a single row and scrolls horizontally gracefully, keeping the active tab visible without clipping tab labels or breaking layout flow; it must not wrap to multiple rows.
- **Keyboard & Accessibility Traversal**: Users can navigate top-level tabs using Left/Right Arrow keys, activate tabs with Enter/Space, and move into panel content with Tab, satisfying WCAG 2.1 keyboard navigation standards.
- **Active Gesture during Tab Switch**: If a user initiates a drag gesture on an envelope or slider and then switches tabs (mouse click or arrow-key navigation), the gesture commits or cancels safely before the view unmounts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The BlueX7 editor MUST provide a top-level tab navigation bar with four distinct views:
  1. **Voice & Global**: Algorithm topology diagram, algorithm selector ($1..32$), Key Transpose semitones ($-24..+24$), Feedback ($0..7$), Shared Sync, Shared PMS, Operator Output Enables ($1..6$), and LFO parameters.
  2. **Operators**: Dedicated operator workstation with sub-tabs for Op 1 through Op 6, mode, tuning, sensitivities, keyboard level/rate scaling, and graphical SVG envelope editor.
  3. **Pitch Envelope**: Dedicated Pitch Envelope Generator (PEG) graphical SVG editor and 4-stage numeric rates/levels.
  4. **Csound & Code**: Full-height Csound post-code Monaco editor, Generated Preview (F-tables & instrument body), and Parameter Bindings & Diagnostics.
- **FR-002**: The top header area (Instrument Name, Enabled checkbox, Comment input, Import SysEx button, Undo/Redo buttons) MUST remain persistently visible above the tab bar across all tab views.
- **FR-003**: Tab switching MUST be purely client-side presentation state; it MUST NOT mutate the underlying `BlueX7Voice` model or emit false project change events.
- **FR-004**: Tab switching MUST preserve all in-flight undo/redo history and must not discard undo stack depth.
- **FR-005**: All tab controls MUST use standard ARIA accessibility attributes (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `tabIndex`) and support keyboard arrow navigation. Keyboard support is limited to this ARIA tablist pattern (arrow keys, Enter/Space, Tab); no additional editor-level tab-switch shortcut keys are introduced.
- **FR-006**: The UI MUST adhere to the approved seven semantic typography roles (`text-role-*` / `--text-role-*`) per `docs/typography.md`.
- **FR-007**: Effective-value sampling MUST subscribe only to the parameters of controls on the currently active tab; parameters on hidden tabs MUST NOT be polled. When a tab becomes active, its visible controls MUST display live effective values within one poll interval (≤50 ms at the default 20 Hz rate) of activation.
- **FR-008**: The layout inside each tab MUST fit comfortably within standard desktop workbench heights (600px+) without requiring page-level vertical scrolling under normal conditions.
- **FR-009**: The active top-level tab and the selected operator sub-tab are in-memory presentation state scoped to the open editor instance. The editor MUST open on "Voice & Global" with Operator 1 selected each time it mounts (panel or popout window); closing and reopening the editor resets the selection. Tab selections MUST NOT be persisted to project XML, `.blue` project data, or app settings.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue `BlueX7` sound object and existing Blue Electron `BlueX7Editor` component.
- **Compatibility Requirements**:
  - All 151 automation parameters and semantic keys (`BLUE_X7_PARAMETER_DESCRIPTORS`) MUST remain 100% compatible.
  - Project XML serialization (`<blue.soundObject.editor.bluex7.BlueX7>`) MUST remain unchanged and lossless.
  - Csound CSD generation and modern module compilation MUST remain byte-for-byte identical.
  - SysEx file import and bank extraction MUST remain fully compatible.
- **Intentional Divergences**: Layout changes from a vertically stacked ~1600px scrolling column to an organized 4-tab interface to improve workflow and usability.
- **State Ownership**: Active tab selection is renderer-local UI session state; project voice data remains canonically owned by `BlueData` via the document bridge.

### Key Entities

- **BlueX7Tab**: Presentation state representing the active top-level view (`'global' | 'operators' | 'pitch' | 'csound'`); scoped to the open editor instance and never persisted (see FR-009).
- **BlueX7Voice**: Canonical project data model containing `common`, `lfo`, `operators` (1–6), `pitchEnvelope`, and `csoundPostCode`.
- **InstrumentPatch**: Typed mutation intent dispatched when modifying voice parameters or importing SysEx data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sound design workflows (algorithm selection, operator tuning, envelope editing, LFO modulation) can be completed without vertical page scrolling in viewports of 600px height or greater.
- **SC-002**: Tab switching transition occurs in under 16ms (<1 frame) without layout shift or UI freezing.
- **SC-003**: 100% of automated tests in `@blue/app` for BlueX7 (editor, accessibility, patch dispatch, undo/redo, effective values) pass.
- **SC-004**: Full keyboard navigation compliance: users can cycle through tabs and activate controls without requiring a mouse.
- **SC-005**: Zero regression in `.blue` XML serialization, automation parameters, or CSD audio generation.

## Assumptions

- Standard screen resolutions and workbench panels provide at least 600px of vertical height and 500px of horizontal width for the instrument editor.
- The 4-tab organization (Voice & Global, Operators, Pitch Envelope, Csound & Code) provides the optimal balance between logical separation and minimal click depth.
- Users who need to write extensive Csound post-processing scripts benefit significantly from an expanded code editor pane.

## Closure

Implementation is complete and the requester manually reviewed the BlueX7 workflows described by
this specification with no issues reported. Tasks T001–T039 are checked off in `tasks.md`.

Automated closure evidence includes the full `@blue/app` suite (4,026 passed, 2 skipped), the
renderer/main/preload builds, lint, script checks, and clean whitespace validation. The existing
modern-render locked-hash mismatch and the Chromium `SIGABRT` startup failure remain documented
in `quickstart.md`; neither was rebaselined or caused by the renderer-only tabbed UI change.
