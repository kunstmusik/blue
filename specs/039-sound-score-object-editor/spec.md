# Feature Specification: Sound Score Object Editor Parity

**Feature Branch**: `039-sound-score-object-editor`  
**Created**: 2026-05-11  
**Status**: Complete
**Input**: User description: "Split the old grouped Tier 2 score-object follow-up so `Sound` gets its own deeper planning slice, with explicit Java Blue UI/UX analysis reflected in the task breakdown."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Work Inside Sound's Real Tabbed Editor (Priority: P1)

As a composer using `Sound` score objects, I need the auxiliary editor to expose the real Java Blue tabbed workflow so I can move between interface editing and comments without being limited to a plain textarea.

**Why this priority**: The current renderer only exposes `comment`, which means one of blue's most important score-object types is still effectively not editable.

**Independent Test**: Select a `Sound` object, switch between the Interface and Comments tabs, edit supported content in both tabs, and verify the canonical object updates while the score selection and editor shell remain stable.

**Acceptance Scenarios**:

1. **Given** a `Sound` object is selected, **When** the score-object editor opens, **Then** it shows a deliberate tabbed editor shell modeled on Java Blue rather than a comment textarea only.
2. **Given** the user edits supported interface or comment content, **When** the edit commits, **Then** the canonical `Sound` object updates through shared score patch plumbing and the editor document refreshes coherently.

---

### User Story 2 - Edit Automation Curves From The Same Surface (Priority: P1)

As a composer automating a `Sound` score object, I need the automation panel and line-editing workflow in the same auxiliary editor so I can manage parameter curves without leaving the score workflow.

**Why this priority**: Java Blue treats automation as a first-class tab in the `Sound` editor, and leaving it out would still leave the score-object editor materially incomplete.

**Independent Test**: Open the Automation tab for a `Sound` object with parameters, select a parameter, edit supported line data, and verify the score object and editor preview remain synchronized.

**Acceptance Scenarios**:

1. **Given** a `Sound` object exposes automatable parameters, **When** the Automation tab opens, **Then** the editor shows a deliberate parameter-selection and curve-editing workflow instead of a placeholder message.
2. **Given** the user edits a supported automation curve or enablement state, **When** the change is committed, **Then** the canonical automation data updates and the active document redraws against the new state.

---

### User Story 3 - Test Generated Sound Output Without Leaving The Editor (Priority: P2)

As a composer validating a `Sound` object, I need the Java-style test action so I can audition or inspect generated score output directly from the auxiliary editor.

**Why this priority**: The test action is a meaningful part of the Java workflow and helps keep the parity claim honest when interface and automation edits are added.

**Independent Test**: Trigger the Sound test action from the editor, review the generated score output or failure message, and confirm the action stays scoped to the selected target.

**Acceptance Scenarios**:

1. **Given** a supported `Sound` object is selected, **When** the user invokes the test action, **Then** the app shows generated score output or a deliberate error state from the selected target.
2. **Given** unsupported subfeatures remain, **When** the user encounters them in the editor or test flow, **Then** the UI shows explicit deferred messaging rather than silently dropping data.

### Edge Cases

- What happens when a `Sound` object has no BSB widgets or no automatable parameters?
- What happens when Java Blue exposes automation curve data that the TypeScript surface can preserve but not yet edit fully?
- What happens when the selected `Sound` object is removed while the test dialog or tabbed editor is open?
- What happens when the test action fails because the selected object cannot generate valid score text?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The implementation MUST review the Java Blue `SoundEditor` UI/UX anchors before coding begins, including `SoundEditor`, `AutomationPanel`, `TimeBar`, `LineCanvas`, and `LineListComboBoxModel`.
- **FR-002**: The score-object editor document contract MUST grow a dedicated `SoundEditorSnapshot` instead of reusing the current comment-only structured payload.
- **FR-003**: The renderer MUST provide a tabbed `Sound` editor workflow that covers Interface, Automation, and Comments as distinct surfaces.
- **FR-004**: The Interface tab MUST reuse the existing BSB interface infrastructure from earlier orchestra and BSB specs where practical instead of creating a second widget system.
- **FR-005**: The Automation tab MUST expose supported parameter selection, line editing, and enablement behavior that maps back to canonical `Sound` automation data.
- **FR-006**: The editor MUST expose a test action that previews generated score output or a deliberate error state for the selected `Sound` target.
- **FR-007**: Canonical writes MUST continue to flow through shared score patch plumbing; renderer-only state such as the selected tab MAY remain local to the editor shell.
- **FR-008**: Unsupported or deferred `Sound` subfeatures MUST be surfaced explicitly so the parity claim remains honest.
- **FR-009**: The implementation MUST add tests covering `Sound` document creation, tab routing, supported mutations, removed-target fallback behavior, and the test-action flow it claims.

### Key Entities *(include if feature involves data)*

- **SoundEditorSnapshot**: The typed auxiliary-editor payload for `Sound`, including tab metadata plus interface, automation, and comment sub-surfaces.
- **SoundAutomationSnapshot**: The renderer-facing view of available automation parameters, selected line state, supported curve data, and any deferred capabilities.
- **SoundTestPreview**: The scoped result of invoking the editor-side test action, including generated score text or a deliberate failure message.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can select a `Sound` object and use a tabbed editor shell instead of a comment textarea only.
- **SC-002**: A reviewer can edit supported `Sound` automation data from the auxiliary editor and observe coherent canonical updates.
- **SC-003**: A reviewer can invoke the `Sound` test action and receive either generated score text or an explicit failure state tied to the selected target.
- **SC-004**: Automated tests cover the `Sound` document payload, tab routing, mutation flows, removed-target fallback behavior, and the test-action behavior claimed by this slice.

## Assumptions

- Spec `038-score-object-editor-tier1-parity` is already closed, so this slice can focus on the heavyweight `Sound` editor gap only.
- The existing BSB interface work from Specs 022 and 023 is the primary reuse path for the `Sound` Interface tab.
- The `PianoRoll` and `JMask` follow-up work will live in Specs `040-pianoroll-score-object-editor` and `041-jmask-score-object-editor`, not in this slice.

### Sound automation in Instances

A placed Sound's local automation follows the note through Instance and parent timing changes. Scaling stretches the curve, repetition restarts it, and a clipped repetition or selected render window plays only the corresponding part. Overlapping occurrences have independent instrument and automation state. This corrects the historical Java behavior for existing projects as well as new ones. See [the Java comparison](research.md#legacy-instance-automation-timing-characterization-2026-10-31).
