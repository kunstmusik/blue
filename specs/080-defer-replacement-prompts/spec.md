# Feature Specification: Deferred Project-Replacement Save Prompts

**Feature Branch**: `080-defer-replacement-prompts`

**Created**: 2026-08-18

**Status**: Closed — implemented and manually accepted (2026-08-19)

**Input**: User description: "Defer project save and related replacement confirmations until the user has committed to opening or importing a file; audit Open Project, example and recent projects, CSD, ORC/SCO, MIDI, and other project replacement paths."

## Clarifications

### Session 2026-08-18

- Q: How should FR-004's same-file no-op determine "the selected project is the current project"? → A: Canonical path equality through a shared platform-aware canonical path helper (resolve/normalize with platform case rules), not raw string comparison.
- Q: Where should the active-render/freeze safety check run once replacement prompts are deferred? → A: Before any chooser or import dialog is shown (fail fast), and re-checked at the replacement commit point, since a render may start while the user is choosing files.
- Q: What evidence must satisfy SC-001 through SC-007? → A: Automated main-process tests with injected/stubbed choosers and dialogs covering the full entry-path × decision-branch matrix, plus a short manual quickstart for native chooser behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a project after confirming the source (Priority: P1)

When the user opens a project, they want to choose a file before being interrupted by a decision about the project currently on screen. Cancelling the file chooser must leave the current project and its pending edits exactly as they were.

**Why this priority**: Opening a project is the most common affected workflow, and an early save prompt makes a cancelled or accidental open action disruptive.

**Independent Test**: With a project open, exercise the native Open Project command, the keyboard shortcut, the welcome/recent-file path, and Open Example Project. Cancel each file chooser and verify that no project-save or library-draft decision appears and the current project remains open.

**Acceptance Scenarios**:

1. **Given** a project is open, **when** the user invokes Open Project and cancels the file chooser, **then** no project-save decision is shown and the current project, file path, dirty state, and open editor state remain unchanged.
2. **Given** a project is open, **when** the user selects a different project file, **then** any required replacement decision appears only after the selection is accepted and before the current project is replaced.
3. **Given** a project is open, **when** the user selects the project that is already open, **then** the action is a no-op and does not show a project-save decision or reload the project.
4. **Given** the user selects a recent project or an example project, **when** that selection is accepted, **then** it follows the same replacement-decision behavior as Open Project.

### User Story 2 - Import files without prompting before all choices are complete (Priority: P1)

When the user imports a CSD file or an ORC/SCO pair, they want to finish choosing the source files and import mode before deciding what to do with the current project. Cancelling any part of the import must not trigger a save decision or replace the project.

**Why this priority**: CSD and ORC/SCO import currently ask about the current project before the first file chooser, which can cause unnecessary prompts and makes cancellation unsafe to reason about.

**Independent Test**: With a project open, cancel the CSD chooser, cancel the CSD import-mode choice, cancel the ORC chooser, cancel the SCO chooser, and cancel the ORC/SCO import-mode choice. Verify that each path leaves the current project unchanged and does not show a project-save or library-draft decision.

**Acceptance Scenarios**:

1. **Given** a project is open, **when** the user cancels the CSD file chooser, **then** no replacement decision appears and the current project remains unchanged.
2. **Given** a CSD file has been selected, **when** the user cancels the import-mode choice or the file cannot be imported, **then** no replacement decision appears and the current project remains unchanged.
3. **Given** a project is open, **when** the user cancels either the ORC or SCO file chooser, **then** no replacement decision appears and the current project remains unchanged.
4. **Given** both ORC and SCO files have been selected, **when** the user cancels the import-mode choice or the pair cannot be imported, **then** no replacement decision appears and the current project remains unchanged.
5. **Given** all required import choices have been accepted, **when** the user chooses to continue with replacement, **then** the current project is replaced only after the required save and library-draft decisions have completed successfully.

### User Story 3 - Keep MIDI import cancellation-safe (Priority: P2)

When the user imports a MIDI file, they want to inspect and configure the detected streams before the application asks to replace the current project. Cancelling the file chooser or mapping dialog must not prompt or mutate the current project.

**Why this priority**: MIDI already has a multi-step configuration flow; preserving its deferred confirmation behavior prevents a regression while the other import flows are aligned.

**Independent Test**: Cancel MIDI file selection, cancel the mapping dialog, and cancel the replacement decision after pressing Import. Verify that the current project remains unchanged and the mapping dialog remains available when replacement is cancelled.

**Acceptance Scenarios**:

1. **Given** a project is open, **when** the user cancels the MIDI file chooser, **then** no project-save or library-draft decision appears and the current project remains unchanged.
2. **Given** a MIDI file has been selected, **when** the user cancels its mapping dialog, **then** no replacement occurs and the current project remains unchanged.
3. **Given** the user presses Import after configuring a valid MIDI mapping, **when** the replacement decision is cancelled, **then** the current project remains open and the MIDI mapping dialog remains available for another decision.
4. **Given** the user confirms replacement after a valid MIDI import, **when** the import completes, **then** the resulting project follows the existing MIDI import behavior and starts as an unsaved project.

### User Story 4 - Preserve projects when replacement cannot complete (Priority: P2)

When the user chooses Save, Don't Save, or Cancel before a project replacement, they expect the result to be predictable. A cancelled save-as dialog or failed save must never be treated as permission to discard the current project.

**Why this priority**: The timing fix is only safe if confirmation decisions remain transactional and failed saves cannot be followed by project replacement.

**Independent Test**: Exercise Save, Don't Save, and Cancel for an open project across Open Project, CSD import, ORC/SCO import, and MIDI import; separately cancel Save As and simulate a save failure. Verify the resulting project state for each choice.

**Acceptance Scenarios**:

1. **Given** a replacement target has been accepted, **when** the user chooses Don't Save, **then** the target may replace the current project without writing the current project.
2. **Given** a replacement target has been accepted, **when** the user chooses Cancel, **then** the current project remains open and no replacement lifecycle begins.
3. **Given** the current project has no file path, **when** the user chooses Save and cancels Save As, **then** the current project remains open and no replacement occurs.
4. **Given** saving the current project fails, **when** the user is attempting to replace it, **then** the replacement is blocked and the current project remains available for recovery.
5. **Given** the user invokes New Project, Close Project, Revert, or Quit, **when** no file chooser is part of the action, **then** the existing immediate confirmation behavior remains intact.

### Edge Cases

- No project is open: file selection and import flows do not show a project-save decision.
- The selected Open Project target is the current project: the action is a no-op without a save or library-draft decision.
- A recent-project path no longer exists or cannot be parsed: the current project remains unchanged, and replacement decisions are not shown before the failure is known.
- The user cancels the first or second chooser in the ORC/SCO flow: no prompt from the replacement workflow is shown.
- A CSD or ORC/SCO file is selected but the import-mode dialog is cancelled: the current project remains unchanged.
- A library editor has unsaved changes: its replacement decision is deferred with the project-save decision until the replacement target has been accepted.
- An active render or freeze operation blocks project replacement: the existing render-safety behavior remains in force and no project is discarded. The guard runs before any chooser or import dialog is shown and is re-checked at the replacement commit point; a blocked attempt leaves the current project unchanged.
- A save-as chooser is cancelled, an overwrite is declined, or a save operation fails: the replacement does not proceed.
- Multiple project-entry paths invoke the same action: the user receives at most one replacement decision for a single accepted replacement request.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every user action that can replace the current project MUST collect all cancelable source choices before showing a project-save or library-draft replacement decision.
- **FR-002**: Cancelling a project file chooser MUST NOT show a project-save or library-draft replacement decision, replace the current project, change its file path, change its dirty state, or close its project-owned editors.
- **FR-003**: The regular Open Project flow MUST show any required replacement decision only after a file has been selected and accepted, and MUST apply the same behavior for native-menu, keyboard, welcome-screen, and preload entry paths.
- **FR-004**: Selecting the project that is already current MUST be a no-op without a project-save decision, library-draft decision, reload, dependency scan, or project-loaded lifecycle event. Sameness MUST be determined by canonical path equality through the repository's platform-aware canonical path helper (resolve/normalize with platform case rules), not raw string comparison, so that recent-project and chooser paths stored in a different form still match the current project file.
- **FR-005**: Open Example Project and recent-project selection MUST use the same accepted-target replacement behavior as regular Open Project.
- **FR-006**: CSD import MUST defer replacement decisions until the CSD source has been selected, the import mode has been accepted, and the source has been validated for import.
- **FR-007**: ORC/SCO import MUST defer replacement decisions until both source files have been selected, the import mode has been accepted, and the pair has been validated for import.
- **FR-008**: MIDI import MUST continue to defer replacement decisions until the user accepts the configured mapping through the Import action; cancelling file selection or mapping MUST leave the current project unchanged.
- **FR-009**: A replacement decision MUST occur immediately before the replacement begins, after all source validation that can fail without changing the current project has completed.
- **FR-010**: Choosing Cancel MUST prevent replacement. Choosing Don't Save MUST permit replacement without writing the current project. Choosing Save MUST permit replacement only after a successful save, including a successful Save As when the current project has no file path.
- **FR-011**: Cancelling Save As, declining an overwrite, or encountering a save failure MUST block replacement and preserve the current project for recovery.
- **FR-012**: Related library-draft replacement decisions MUST follow the same accepted-target timing as the project-save decision and MUST not appear when the source chooser or import configuration is cancelled.
- **FR-013**: New Project, Close Project, Revert, and Quit MUST retain their existing immediate confirmation behavior because they do not require a source file chooser; any alternate entry path that can replace a project MUST not bypass the applicable confirmation policy.
- **FR-014**: Internal or verification loads that are not initiated by a user replacement action MUST remain non-interactive and MUST not display project-save or library-draft decisions.
- **FR-015**: Cancelled, invalid, or failed replacement attempts MUST preserve the current project document, file path, dirty state, current project session, project-owned editor state, and pending import configuration.
- **FR-016**: Successful project loading and import MUST preserve the existing project-loaded lifecycle, recent-project behavior, dependency handling, and imported-project save/reopen semantics.
- **FR-017**: The feature MUST NOT add replacement-confirmation state, transient import state, or prompt state to `.blue` project XML or other project-owned data.
- **FR-018**: The existing policy governing whether a loaded project receives a save decision MUST remain unchanged by this feature; changing from the current coarse policy to dirty-only prompting is outside this specification.
- **FR-019**: While a render or freeze operation is active, every replacement entry path MUST be blocked before any file chooser or import dialog is shown, and the render-active guard MUST be re-checked at the replacement commit point immediately before the replacement decision; a blocked attempt MUST leave the current project unchanged.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue’s Open Project and Open Example Project actions complete file selection before installing the selected project. Its CSD and ORC/SCO import actions complete their source and import-mode choices before installing the imported project. The relevant references are [`OpenProjectAction.java`](/Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/OpenProjectAction.java:37), [`OpenExampleProjectAction.java`](/Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/OpenExampleProjectAction.java:36), [`ImportCsdAction.java`](/Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/ImportCsdAction.java:39), [`ImportOrcScoAction.java`](/Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/ImportOrcScoAction.java:41), and [`ImportMidiAction.java`](/Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/ImportMidiAction.java:30).
- **Compatibility Requirements**: Existing `.blue` XML, project data, project snapshots, editor lifecycle, recent-project tracking, dependency handling, CSD/ORC/SCO conversion semantics, MIDI mapping semantics, and imported-project unsaved status MUST remain compatible. A cancelled or failed replacement MUST not emit a successful project-loaded transition.
- **Intentional Divergences**: The feature intentionally changes only the timing and transactional safety of replacement decisions. It does not change the current coarse policy for deciding whether a loaded project prompts, the project file format, or the supported import formats.
- **State Ownership**: The Electron main process remains the canonical owner of the current project document and replacement lifecycle. Renderer mapping dialogs and prompt-related UI remain transient session state. Library drafts remain owned by the library service. No replacement-decision state is persisted in project XML, and no renderer-only state may cause a replacement to bypass the main-process confirmation policy.

### Key Entities *(include if feature involves data)*

- **Replacement Request**: A user-initiated action that may replace the current project, including its source-selection status, validation status, and whether the action has reached its commit point.
- **Replacement Decision**: The user’s Save, Don’t Save, or Cancel choice for the current project, together with the outcome of any required Save As or save operation.
- **Import Configuration Session**: The transient CSD, ORC/SCO, or MIDI choices required before an imported project can be committed.
- **Current Project Session**: The canonical project document and its associated file path, dirty state, open editors, and lifecycle identity before replacement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of file-chooser cancellation scenarios for Open Project, Open Example Project, CSD, ORC/SCO, and MIDI, no project-save or library-draft replacement decision is shown and the current project remains unchanged.
- **SC-002**: In 100% of accepted-source scenarios, the replacement decision occurs after the final cancelable source/configuration choice and before the current project is replaced.
- **SC-003**: In 100% of same-file Open Project scenarios, the action performs no reload and shows no replacement decision.
- **SC-004**: In 100% of Save As cancellations, overwrite declines, and simulated save failures, the current project remains open and no replacement lifecycle begins.
- **SC-005**: In 100% of MIDI mapping-cancellation and replacement-decision-cancellation scenarios, the current project remains unchanged; the mapping dialog remains available after a cancelled replacement decision.
- **SC-006**: All supported native-menu, keyboard, welcome-screen, recent-project, example-project, CSD, ORC/SCO, and MIDI entry paths produce one consistent replacement outcome for equivalent user choices.
- **SC-007**: Existing project load, import, save/reopen, recent-project, dependency, and editor-lifecycle regression coverage remains green with no changes to `.blue` project XML structure.
- **SC-008**: SC-001 through SC-007 are evidenced by automated main-process tests using injected or stubbed file choosers and decision dialogs that cover the full entry-path (native-menu, keyboard, welcome-screen, recent-project, example-project, CSD, ORC/SCO, MIDI) × decision-branch (chooser cancel, import-mode cancel, Save, Don't Save, Cancel, Save As cancel, overwrite decline, save failure) matrix, plus a short manual quickstart validating native chooser behavior.

## Assumptions

- “Committed to opening” means a regular project or example file has been selected, a recent-project item has been clicked, both ORC/SCO files and the import mode have been accepted, a CSD file and import mode have been accepted, or the MIDI user has pressed Import after configuring valid mappings.
- The project-save and library-draft decisions are considered part of the same replacement boundary; neither is shown for a source or configuration choice that the user has cancelled.
- Within that accepted-target boundary, the library-draft decision is resolved before the project-save decision. This prevents a later library cancellation from clearing the current project's dirty state through Save or Save As.
- The existing coarse policy for deciding when a loaded project receives a save prompt remains in scope only as preserved behavior. Dirty-only prompt eligibility may be specified separately.
- No new persistence format or project metadata is required.
- Existing active-render safety checks remain authoritative: the guard blocks a replacement entry path before any chooser or import dialog is shown and is re-checked at the replacement commit point.
- A successful Save means the current project is durably written before replacement is allowed; a cancelled or failed save is not treated as consent to discard.
