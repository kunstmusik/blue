# Feature Specification: Fix Implicit State Machine Failures

**Feature Branch**: `codex/fix-implicit-state-machines`

**Created**: 2026-11-08

**Status**: Complete

**Completed**: 2026-11-09

**Input**: User description: "Make shortcuts, editing gestures, Java helper sessions, and playback lifecycle behavior reliable. Fix the reviewed cancellation, host-window, resource ownership, concurrency, and state consistency defects while preserving existing editing and playback workflows. Establish explicit lifecycle contracts that developers and coding agents can verify."

## Completion and Acceptance

Implementation and convergence tasks T001–T060 are complete. On 2026-11-09 the project owner reported successful manual testing and explicitly accepted native acceptance for feature closeout. This decision accepts the remaining validation limitations: the recorded macOS scenarios do not enumerate every gesture-family combination, and Windows/Linux native scenarios were not run because no machines or runners were available. These are accepted coverage limitations, not claims of unobserved test results. Final automated evidence and the acceptance decision are recorded in [quickstart.md](quickstart.md#completion-and-owner-acceptance--2026-11-09).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Use dialogs and editor keys without triggering transport (Priority: P1)

A composer uses a dialog, menu, or editor control while a project is open. Keys handled by that surface perform its action once, without also starting or stopping playback or invoking another workspace command.

**Why this priority**: Unexpected playback changes interrupt composition and make dialogs and keyboard editing unreliable.

**Independent Test**: While playback is active and while stopped, exercise Space and Escape on modal controls, menus, an editor cell that handles Space, and the ordinary workspace. Verify the surface action and transport outcome separately.

**Acceptance Scenarios**:

1. **Given** a modal dialog is open with focus on a button, checkbox, or dialog container, **When** the user presses Space, **Then** the intended dialog control acts and workspace playback does not toggle.
2. **Given** playback is active and a dialog owns Escape, **When** the user presses Escape, **Then** the dialog follows its existing dismissal or Cancel behavior and playback continues.
3. **Given** an editor cell or library tree item handles Space, **When** the user presses Space, **Then** the editor or tree action occurs once and playback does not also toggle.
4. **Given** focus is inside a menu or popup, **When** its keyboard interaction is handled, **Then** no workspace shortcut also acts on that event. Merely showing a non-modal help surface does not disable workspace shortcuts outside it.
5. **Given** no dialog, popup, editor, or active gesture owns the key, **When** the user presses the existing workspace Space or Escape shortcut, **Then** the existing playback toggle or stop behavior remains available. A focused workspace toolbar button does not disable Space transport control.
6. **Given** a modal is open, **When** a workspace-handled Open, Save, or Follow shortcut is delivered, **Then** it does not run behind the modal; existing text-editing and key-repeat exclusions remain effective.

---

### User Story 2 - Complete or cancel an edit in its hosting window (Priority: P1)

A composer edits notes, score objects, automation, timing, instrument widgets, or panel layout. Dragging works in the window containing the editor, including after floating an already-open panel. Release completes the action; cancellation restores the applicable baseline without leaving a stuck drag or hidden project edit.

**Why this priority**: Missed release events and incomplete rollback can change authored content after the user believes an interaction has ended.

**Independent Test**: For every gesture family in the scope table, repeat its release, Escape, and focus-loss scenarios docked and floated. Include release outside the editing surface, undo/redo of a completed project edit, and pointer movement after the interaction has ended.

**Acceptance Scenarios**:

1. **Given** an editor was mounted while docked and then floated, **When** the user drags and releases outside its canvas but inside the hosting window, **Then** the gesture completes once and subsequent hovering does not continue moving or resizing content.
2. **Given** a changed project gesture completes normally, **When** the user invokes Undo and then Redo, **Then** one labeled action reverses and restores the complete edit with stable object identities, correct dirty state, and applicable active-playback reconciliation.
3. **Given** a gesture with the Cancel focus-loss policy has only a local preview, **When** the user presses Escape or the host window loses focus, **Then** the preview is discarded and no project edit or history entry is created.
4. **Given** a marker, render-range, tempo, or other cancellable project gesture has already changed project content while moving, **When** the user cancels it, **Then** its affected content, history, dirty state, and applicable playback state return to the pre-gesture baseline. Unrelated edits remain intact.
5. **Given** a new marker or editable point was inserted at the start of a cancellable gesture, **When** that gesture is cancelled, **Then** the insertion and movement are both cancelled without a phantom undo action.
6. **Given** playback is active during a non-text drag, **When** the user presses Escape, **Then** the gesture cancels once and playback continues. Later release events or pending visual updates do not commit the cancelled edit.
7. **Given** a Blue Synth Builder widget move or resize is active, **When** the host window loses focus, **Then** the latest edit settles as one completed project action; **When** Escape cancels an active move or resize instead, **Then** the baseline position or size is restored.
8. **Given** PianoRoll note movement or marquee selection reaches a viewport edge, **When** the pointer remains at that edge, **Then** the existing automatic scrolling continues for both interactions and ends when the gesture ends.
9. **Given** an edit is active, **When** a history or project command requires settlement, the edited target disappears, or its editor closes, **Then** the edit is settled or cancelled according to the requirements below, and cannot affect another target or project afterward.
10. **Given** a layout drag changes a split or arrangement-column size, **When** it is cancelled, **Then** the prior displayed and persisted layout value is restored without adding a project history entry.

---

### User Story 3 - Recover and close Java helper sessions safely (Priority: P1)

A composer runs a project that needs Java-backed scripting. Startup failures can be retried, compatible requests reuse a healthy helper, and closing or replacing a session cannot leave stale startup work running or ready for the wrong project.

**Why this priority**: Incorrect process ownership can leak helpers, misapply project dependencies, or block shutdown behind unfinished initialization.

**Independent Test**: Delay and fail each startup stage, request disposal before each delay resolves, and issue three competing readiness requests. Observe helper ownership, reported readiness, retry behavior, and cleanup separately from script output.

**Acceptance Scenarios**:

1. **Given** Java availability is still being checked, **When** the session is disposed and the check later succeeds, **Then** that cancelled request does not launch a helper.
2. **Given** helper creation is still pending, **When** the session is disposed and creation later returns a process, **Then** that process is terminated without being connected, initialized, or published as ready.
3. **Given** helper connection, health verification, or session initialization is pending, **When** the session is disposed, **Then** cleanup requests termination without waiting for initialization to finish; late results do not restore readiness or reset a later session.
4. **Given** client setup, connection, or health verification fails, **When** startup reports the failure, **Then** resources created by that attempt are cleaned up, the project remains intact, and a subsequent request can retry.
5. **Given** session initialization reports failure while the helper remains alive, **When** the user retries with different script dependencies, **Then** the retry uses a fresh helper and cannot inherit dependencies from the failed attempt. Retrying with unchanged dependencies remains possible without falsely reporting the failed session as ready.
6. **Given** a healthy session is ready, **When** another request has the same session, project directory, and dependencies, **Then** it reuses that readiness without resetting scripting state. A different project session with the same directory and dependencies may reuse the helper process while receiving its own successful session initialization.
7. **Given** callers B and C are waiting behind startup A and need different directories or dependencies, **When** A finishes, **Then** readiness requests are reconciled in one established order without competing initialization or lost process ownership; the final ready session matches the last successful request in that order.
8. **Given** several requests were made before disposal, **When** disposal invalidates them, **Then** none can revive the disposed work. A newly requested session afterward can start normally once the previous initializer releases ownership.
9. **Given** a former helper produces a delayed success, error, or failure notification, **When** another helper owns the current session, **Then** the notification cannot clear, disconnect, terminate, or mark the current session ready.

---

### User Story 4 - Read consistent playback and audition state (Priority: P2)

A composer starts normal playback or auditions selected objects, observes progress, and stops playback. The transport controls, audition indication, clock, and follow behavior agree throughout preparation, running, stopping, completion, and failure.

**Why this priority**: Consistent controls make lifecycle changes understandable and preserve established playback and Follow Score behavior.

**Independent Test**: Exercise normal playback and audition through successful start, early clock delivery, stop during preparation, stop after running, partial status updates, and failure. Observe the transport, clock, and saved follow preferences.

**Acceptance Scenarios**:

1. **Given** playback is preparing but has not been confirmed active, **When** the user requests Stop, **Then** the transport shows stopping without falsely claiming that preparation itself confirmed active playback.
2. **Given** playback was confirmed active, **When** stopping begins, **Then** the active indication remains consistent with that confirmation until playback ends. An authoritative status can establish that playback became active before a local start response arrived.
3. **Given** an audition is preparing or running, **When** a partial non-terminal status omits its mode or transport position, **Then** the existing mode and position are preserved unless an explicit action changes them.
4. **Given** a start is pending, **When** its first clock update arrives before the start response and is followed by a playing status, **Then** the displayed position retains that accepted clock rather than resetting to the start.
5. **Given** playback becomes idle, stopped, or failed, **When** the transport reflects that outcome, **Then** audition and live clock indications are cleared and Follow Score returns to its saved preference. Late clock data from the ended performance does not revive its display.
6. **Given** follow-on-start is enabled, **When** a new normal playback session is confirmed, **Then** its follow rule is applied once. Failed starts, internal loop restarts, and ordinary display updates do not reapply it or change the saved preference.

### Edge Cases

- Focus is on a modal button rather than a text field, and the modal's key listener is registered after the workspace listener.
- An editor consumes a key before the workspace sees it, or a non-modal help surface is visible while focus remains elsewhere.
- A panel is floated without being remounted; release occurs outside the canvas; the hosting window closes during the drag.
- Escape is followed by mouse release, another Escape, or an already-scheduled update. None commits or repeats the cancelled action.
- A saved project is clean before a live edit begins; cancelling restores clean state. A project already dirty before the gesture stays correctly dirty after cancellation.
- A compound edit affects several widgets or notes; cancellation and undo apply to the complete action.
- Another edit or history command intervenes during a live gesture; settlement preserves chronological ordering and prevents rollback over unrelated work.
- A layout size is persisted during dragging; cancellation restores the stored value as well as the visual size.
- Helper creation returns after disposal, client setup fails after a process exists, or health verification returns failure without throwing.
- Initialization fails after some dependencies were loaded; dependencies are then removed or changed.
- Three requests overlap, a queued request is invalidated, or an earlier failed request completes after a later session is current.
- A project has no saved directory, Java is unavailable, or a helper exits between readiness checks; existing fallback and error behavior remain available.
- A clock update arrives early, a partial transport update omits fields, or stopping begins before the start response is received.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Workspace keyboard actions MUST respect the active modal, popup, text editor, and control's handling of the same event. An already-handled event MUST NOT also trigger workspace transport or project commands.
- **FR-002**: Space and Escape delivered to a modal MUST follow that modal's existing control and dismissal behavior without changing transport. Non-modal surface visibility alone MUST NOT disable shortcuts elsewhere.
- **FR-003**: Existing unclaimed workspace shortcuts MUST remain available, including Space when focus remains on a workspace toolbar button and Escape when no active gesture or surface owns it. Existing shortcut mappings and text-editing/repeat exclusions MUST be preserved.
- **FR-004**: Every in-scope gesture MUST receive movement, release, cancellation, and focus-loss input from its hosting window after docking or floating, including when the panel was already mounted before moving windows.
- **FR-005**: Once a gesture terminates, subsequent pointer movement, repeated terminal events, pending visual updates, and delayed callbacks MUST produce no further edit or gesture-driven automatic scrolling. When no Blue Synth Builder widget move or resize is active, pointer movement and focus changes MUST perform no widget-drag processing.
- **FR-006**: Each completed, changed project gesture MUST create one semantically labeled project history action. Undo and Redo MUST restore its full content, identities, references, dirty state, and applicable active-playback effects. Unchanged and cancelled gestures MUST create no remaining history action.
- **FR-007**: Each gesture MUST have a defined pre-edit baseline captured before its first durable change, including insertion or transport changes made on press. Cancellation MUST restore the gesture's affected baseline without overwriting unrelated edits.
- **FR-008**: Local previews MUST remain outside project history until committed. Gestures that change project content while moving MUST support cancellation through the existing project history contract; removing transient drag state alone MUST NOT count as rollback.
- **FR-009**: Escape owned by an active gesture MUST cancel that gesture before any workspace stop action occurs, and MUST NOT stop playback. Events not owned by an active gesture MUST retain their existing routing.
- **FR-010**: Focus loss MUST cancel in-scope content and layout gestures except Blue Synth Builder widget moves and resizes, which MUST settle their latest value. Escape MUST cancel those widget gestures. Cancellation of persisted layout values MUST restore the saved layout without entering project history.
- **FR-011**: Commands requiring project-history settlement MUST settle the latest valid value of an active project gesture before proceeding, so a subsequent Undo reverses that action once. Editor closure MUST discard an uncommitted local preview or settle an already-applied live project gesture; removal of its target or project replacement MUST invalidate obsolete work so it cannot mutate a different target or project.
- **FR-012**: PianoRoll note movement and marquee selection MUST both preserve their existing viewport-edge automatic scrolling. Gesture termination MUST stop scrolling in both cases.
- **FR-013**: Java helper readiness MUST have one owner and one established initialization order. Compatible same-session requests MUST share readiness without duplicate initialization; requests for different sessions, directories, or dependencies MUST NOT initialize competing replacements.
- **FR-014**: A healthy Java helper MUST remain reusable across sessions with the same project directory and dependencies. A directory change or change to dependencies already requested from that helper MUST require a fresh process before reporting readiness.
- **FR-015**: Readiness MUST be reported only for successful initialization of the requested, still-current session. Failed initialization MUST invalidate session readiness and retain enough dependency knowledge to choose a safe retry.
- **FR-016**: Disposal MUST invalidate all earlier startup and queued readiness requests. A cancelled availability check MUST NOT lead to launch; a process returned after disposal MUST be terminated before connection or initialization and MUST NOT become current.
- **FR-017**: Disposal of an owned in-flight helper MUST request termination without waiting for unfinished session initialization or a graceful shutdown operation queued behind it. Reporting termination requested MUST remain distinguishable from confirmed process exit.
- **FR-018**: Every startup failure, including client setup and connection/health failure, MUST clean up the resources owned by that attempt. Delayed success, failure, or cleanup MUST NOT alter a newer owner's process, readiness, or scripting state.
- **FR-019**: Failed or cancelled readiness requests MUST release initialization ownership so later valid requests can retry. A newly requested session after disposal MUST be able to initialize once the prior initializer releases ownership.
- **FR-020**: Playback status, active indication, and audition indication MUST agree for preparation, running, stopping, and terminal outcomes. Stopping MUST preserve whether playback was confirmed active rather than treating every stop request as proof of playback.
- **FR-021**: Partial non-terminal playback updates MUST preserve omitted mode and transport-position information unless an explicit action changes it. Terminal states MUST clear audition and live clock state.
- **FR-022**: A valid early clock update for a pending performance MUST survive its transition to playing. Updates from an ended performance MUST NOT revive the terminal transport display.
- **FR-023**: Confirmed normal starts and terminal transitions MUST preserve the established Follow Score start and restoration rules. Temporary navigation suspension MUST remain separate from saved preferences, and display updates MUST NOT reset follow or lifecycle state.
- **FR-024**: The affected lifecycle contracts MUST identify their owner, valid transitions, event precedence, cleanup, and stale-result behavior so developers and coding agents can review them against the same acceptance scenarios. State representation changes MUST preserve independently owned preferences, queues, and telemetry.

### In-Scope Gesture Families

The following table defines the required coverage. Cancellation includes changes made on press as well as movement; per-family mutation and history details belong in implementation planning.

| Surface                                 | Interactions covered                                                             | Focus-loss outcome        |
| --------------------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| Score timeline and audio-track canvases | Existing object/clip drag modes and canvas selections                            | Cancel                    |
| Pattern layers                          | Cell painting                                                                    | Cancel                    |
| Score background                        | Marquee selection                                                                | Cancel                    |
| PianoRoll                               | Note creation, movement, left/right resize, field editing, and marquee selection | Cancel                    |
| PianoRoll field lane                    | Field-pin dragging                                                               | Cancel                    |
| Shared line editor and JMask tables     | Point insertion and dragging                                                     | Cancel                    |
| Score rulers and markers                | Render-range selection, render-start dragging, marker creation and movement      | Cancel                    |
| Tempo map                               | Point dragging                                                                   | Cancel                    |
| Score automation overlay                | Existing drag modes                                                              | Cancel                    |
| Blue Synth Builder                      | Widget movement and resizing                                                     | Settle latest edit        |
| Orchestra layout                        | Split-pane and arrangement-column resizing                                       | Cancel and restore layout |

### Existing Behavior & Data Compatibility _(mandatory when applicable)_

- **Reference Behavior**: Existing [PianoRoll editing](../040-pianoroll-score-object-editor/spec.md), [Java runtime](../049-blue-java-runtime/spec.md), [Follow Score](../079-follow-score-playback/spec.md), [popout correctness](../089-fix-popout-portals/spec.md), [floating surfaces](../090-host-floating-surfaces/spec.md), and [global history](../103-global-undo-redo/spec.md) remain the baseline contracts. Java Blue remains the behavioral reference for existing musical editing and scripting semantics; implementation planning must record the relevant Java source revisions and parity evidence before behavior changes. This specification does not claim that new parity research or runtime validation has already been performed.
- **Compatibility Requirements**: Existing supported projects, standalone resources, libraries, generated score/audio content, and script behavior MUST remain compatible. This work adds no project fields, settings schema, accepted historical input forms, or changes to serialization diagnostics. Java unavailability remains an execution limitation and MUST NOT discard supported project data. Existing host path and project-relative scripting behavior are preserved.
- **Migration Boundaries**: No project, resource, library, or settings migration is introduced. Gesture and runtime lifecycle state remains disposable and does not enter project files. Existing layout persistence remains owned by its current settings/session mechanism.
- **Intentional Divergences**: None proposed for musical content, scripting semantics, file formats, or saved preferences. Corrected keyboard containment and the specified Escape/focus-loss policies are the deliberate interaction changes in this feature; they do not assert that every Java UI focus-loss behavior is identical.
- **State Ownership**: The main application owns the canonical active `BlueData` project and its chronological project history. Editors own disposable previews and selections; committed project edits go through the existing document/history boundary. The host owns Java helper resources and session readiness. The renderer's transport view reflects authoritative playback and owns disposable display state; saved follow preferences and layout/settings retain their existing owners and persistence locations.
- **Undo/Redo Impact**: All changed project gestures retain one-action commit/undo/redo behavior. Cancellation restores affected content, stable identities, correct dirty state, and required active-playback state without a phantom action. Preview, selection, transport telemetry, helper cleanup, and layout-only changes create no project history entries.
- **Licensing and Provenance**: This specification is original repository documentation under the existing repository license scope and incorporates no external source or new dependency. Implementation planning must assess affected component licenses and any parity-source reuse under the existing licensing rules.

### Key Entities _(include if feature involves data)_

- **Gesture**: One editing interaction, its hosting window, affected targets, baseline, tentative or already-applied changes, and completed/cancelled outcome.
- **Project Action**: The single labeled undoable result of a committed project gesture, including its content and active-playback consequences.
- **Runtime Readiness Request**: A request associated with a project session, directory, dependencies, and lifetime that can succeed, fail, or be invalidated.
- **Helper Session**: An owned helper process and its successfully initialized project session, including the dependencies already requested from that process.
- **Playback Lifecycle**: The current performance's phase, normal/audition mode, confirmation of activity, position, and terminal outcome.
- **Saved Preferences and Layout**: Existing durable user choices whose lifetime is separate from an individual playback session or editing gesture.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every shortcut scenario in User Story 1 produces exactly the intended surface or workspace action, with zero unintended transport changes or duplicate actions.
- **SC-002**: Every in-scope gesture family passes its applicable release, Escape, and focus-loss scenarios in docked and floated windows, including floating an already-open editor and release outside its editing surface. No ended gesture resumes on later pointer movement.
- **SC-003**: Every changed, completed project gesture produces exactly one labeled undo action and survives one Undo/Redo cycle with the expected content, identity, dirty state, and playback consequences. Every isolated cancellation restores the baseline with zero remaining gesture actions.
- **SC-004**: Every Java helper failure/disposal scenario leaves zero abandoned helpers from the tested attempt and zero ready sessions published by invalidated requests. Three competing requests complete or fail in the established order without losing process ownership; a valid subsequent request succeeds after recoverable failure.
- **SC-005**: Normal playback and audition pass all preparation, running, stopping, early-clock, partial-update, and terminal scenarios with consistent transport indications and unchanged saved follow preferences except for explicit preference edits.
- **SC-006**: A reviewer can identify each affected lifecycle's owner, allowed transitions, cancellation/settlement outcome, and stale-result rules from tracked feature and architecture documentation without inferring those rules from scattered flags or callback timing.

## Assumptions

- This is a bounded reliability feature covering the four stories and listed gesture families. It does not require conversion of every store, transaction queue, or subsystem into a state machine.
- The existing branch and worktree are retained. The architecture guidance already added in [AGENTS.md](../../AGENTS.md) and [the lifecycle review guide](../../docs/modularization.md#lifecycle-and-gesture-review) supplies the shared review convention; this feature applies it to the affected behavior.
- Existing main-workspace shortcut handling is in scope. Adding global transport forwarding to floated windows and changing native menu accelerator routing are separate work. Gesture-local cancellation in floated windows remains required.
- Closing an editor follows FR-011; focus loss follows the table and FR-010. No new persisted preference for selecting these policies is introduced.
- Existing typed document/history contracts, runtime ownership boundaries, and product capabilities remain in place. Representation and optional behavior-preserving refactors are planning decisions and can be reviewed independently from fixes.
- Functional lifecycle evidence remains part of ordinary regression validation. No new speed budget is claimed; existing display cadence, automatic scrolling, and performance acceptance policies remain applicable.
