# Feature Specification: Glitch-Free Track Instrument Editor Opening

**Feature Branch**: `093-fix-editor-audio-glitch`

**Created**: 2026-08-30

**Status**: Implemented — Blue Electron scope complete; packaged/Csound acceptance deferred

**Input**: User description: "Investigate and fix audio glitching when opening an instrument from a Track layer during real-time audio rendering. Prior investigation suspects the transient work of creating and initializing the detached editor window, with live BlueX7 value sampling as a possible overlapping contributor."

**Closure note (2026-08-31)**: The Blue Electron implementation and its local
regression coverage are complete. The former perform-thread channel mutex/deque
handoff is now a bounded generation-fenced SPSC mailbox, and detached editor
startup is progressive, neutral-painted, and lifecycle-instrumented. Battery
trials with an exact pre-mailbox engine reproduced the symptom while recording
zero channel traffic and sub-k-period mutex waits; correlated stalls spent most
of their wall time outside the perform thread's CPU time. The remaining causal
boundary is Csound's macOS AuHAL output handoff, which is outside this repository
and is recorded as an external follow-up. Packaged 30-open and 60-second BlueX7
acceptance gates remain release validation, not evidence claimed by this
implementation close-out.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a Track Instrument Without Interrupting Playback (Priority: P1)

A musician can open an instrument from a Track layer while a project is playing and continue hearing uninterrupted audio. The editor becomes usable without a click, dropout, stutter, or other interruption caused by opening it.

**Why this priority**: Editing during playback is a core interactive workflow. An editor action that disrupts the performance makes the workflow unreliable even when the project otherwise renders cleanly.

**Independent Test**: Play a representative project that has no audio interruptions before the action, repeatedly cold-open and close Track instrument editors, and verify both the audible output and performance observations remain continuous through every open.

**Acceptance Scenarios**:

1. **Given** a representative project that plays continuously with adequate processing headroom, **When** the user opens a Track instrument editor for the first time in the session, **Then** playback remains continuous and the editor becomes usable.
2. **Given** an editor for the same Track is already open, **When** the user invokes the editor action again, **Then** the existing editor is focused without interrupting playback or creating a duplicate session.
3. **Given** the user closes an editor and later opens the same or another Track instrument editor during playback, **When** the editor is initialized again, **Then** each opening preserves continuous audio.
4. **Given** playback is stopped, **When** the user opens a Track instrument editor, **Then** editor behavior remains functionally equivalent to the existing workflow.

---

### User Story 2 - Diagnose the Glitch From Reproducible Evidence (Priority: P1)

A maintainer can reproduce the reported glitch, correlate it with the editor-opening timeline and audio continuity, isolate the material contributors, and use the same evidence to prove that a candidate fix resolves the problem.

**Why this priority**: The current explanation is a well-supported hypothesis, not yet a demonstrated root cause. A reliable fix requires measurements that distinguish window creation, editor initialization, live value observation, and engine behavior instead of relying only on when the glitch is heard.

**Independent Test**: Run a documented baseline and controlled comparison matrix on the same machine and project, varying one editor-opening contributor at a time and retaining enough evidence to identify which changes alter the observed interruption.

**Acceptance Scenarios**:

1. **Given** the reported workflow in development and packaged application modes, **When** the diagnostic procedure is run, **Then** it records whether an interruption occurred, when it occurred relative to the open action, and whether playback missed its real-time budget.
2. **Given** plausible contributors to editor startup, **When** each contributor is independently delayed, removed, or pre-initialized for a controlled run, **Then** the resulting evidence shows whether that contributor materially changes the frequency or severity of interruptions.
3. **Given** a candidate fix, **When** baseline and candidate runs use the same project, environment, and repetition count, **Then** the evidence supports an explicit accept, reject, or defer decision.
4. **Given** the effect-instrument editor uses a comparable detached-editor workflow, **When** the diagnosis is repeated there, **Then** the result establishes whether the cause and fix are shared or Track-specific.

---

### User Story 3 - Retain Complete Live Editing Behavior (Priority: P2)

A musician can use the opened Track instrument editor normally during playback. The editor shows the correct instrument, accepts edits through the established project workflow, and continues to show live engine-driven values where supported.

**Why this priority**: Audio continuity must not be achieved by removing the editor's live behavior, showing stale data, changing the selected Track, or bypassing project ownership rules.

**Independent Test**: During clean playback, open representative Track instrument types, confirm the correct document appears, perform edits, observe live values where supported, and verify save, undo, project update, and window lifecycle behavior remain correct.

**Acceptance Scenarios**:

1. **Given** a Track instrument editor opens during playback, **When** the user changes an editable value, **Then** the change follows the existing project mutation and runtime synchronization behavior without interrupting audio.
2. **Given** a Track-owned BlueX7 instrument is automated during playback, **When** its editor becomes ready, **Then** effective values resume at the established live display rate without changing canonical fixed values or automation data.
3. **Given** multiple Tracks have editor windows, **When** the project changes, a Track is removed, or the project closes, **Then** every window remains associated with the correct Track or closes/fails safely according to existing behavior.
4. **Given** editor initialization cannot complete, **When** the user opens the editor, **Then** playback continues and the user receives a recoverable editor error rather than a stalled or partially bound editing session.

### Edge Cases

- The first editor open after application startup versus reopening an existing window or opening after a previous editor was closed.
- Development mode with on-demand assets versus a packaged application with prebuilt assets.
- A lightweight project, a qualifying high-load project that otherwise plays cleanly, and a project already exceeding real-time capacity before the editor opens.
- Generic/text-based, Blue Synth Builder, and BlueX7 Track instruments, including a BlueX7 editor that observes the full visible live-value set.
- Rapid repeated clicks on one Track, sequential opens across different Tracks, and multiple editor windows remaining open together.
- The user opens an editor while playback starts, stops, seeks, loops, or the engine is rebuilding.
- The Track, its parent group, or the active project disappears while an editor is being prepared or while delayed initialization work remains pending.
- Window creation, editor document loading, library initialization, live value observation, or other optional startup work fails or completes late.
- The application is minimized, the editor is restored to a popout display, or the hosting display configuration changes.
- A mitigation improves audio continuity but shifts comparable cost into application startup, idle time, project opening, or the first edit.
- The effect-instrument editor reproduces the same symptom, does not reproduce it, or uses only part of the same opening path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST define a deterministic reproduction procedure for opening a Track instrument editor during otherwise clean real-time playback.
- **FR-002**: The reproduction procedure MUST cover at least one lightweight project and one qualifying high-load project, and MUST distinguish a project that is already overloaded before the editor action from an interruption caused by the editor action.
- **FR-003**: Baseline evidence MUST cover the first open, focus of an existing editor, reopen after close, and sequential opens of different Track instruments in both development and packaged application modes.
- **FR-004**: Baseline and candidate runs MUST observe the editor-opening timeline, audible output continuity, real-time budget misses or equivalent interruption evidence, editor-ready latency, and enough environment metadata to compare runs made under the same conditions.
- **FR-005**: The investigation MUST test plausible contributors independently, including detached-window creation, editor interface initialization, editor data/library initialization, and live engine-value observation, without assuming any one contributor is the root cause before measurements are collected.
- **FR-006**: The final investigation record MUST identify the demonstrated root cause or contributing combination, distinguish confirmed findings from remaining hypotheses, and link the selected fix to controlled evidence.
- **FR-007**: Opening, focusing, closing, and reopening a Track instrument editor MUST NOT introduce an audible discontinuity or a new playback interruption when the same project and environment play cleanly without the editor action.
- **FR-008**: The editor MUST continue to show the instrument belonging to the requested project session and Track, and repeated requests for the same Track MUST retain the existing single-editor behavior.
- **FR-009**: Track instrument edits MUST continue to flow through the canonical project mutation workflow and preserve existing runtime synchronization, undo, save, and project-update behavior.
- **FR-010**: Live effective-value display for supported instruments MUST resume after the editor becomes ready and MUST preserve its established update rate, instance isolation, and read-only relationship to canonical project and automation data.
- **FR-011**: Work not required to make the editor initially usable MAY be deferred or pre-initialized, but it MUST reach a defined ready state, remain cancellable when its Track or project disappears, and fail without affecting playback.
- **FR-012**: Any retained reusable editor resources MUST be rebound to the requested Track before user interaction and MUST NOT expose content, pending edits, runtime values, or errors from a previously edited Track or project.
- **FR-013**: A mitigation MUST NOT materially regress application-ready time, project-open time, steady idle resource use, editor-ready time, or the responsiveness of the first user edit compared with the accepted baseline.
- **FR-014**: The feature MUST preserve current editor window lifecycle behavior, including focus, independent Track identity, saved placement, project-update handling, and safe cleanup when a Track, group, project, or application closes.
- **FR-015**: Editor startup or diagnostic failure MUST remain isolated from the audio performance and MUST produce a recoverable editor outcome without stopping, recompiling, or corrupting the active project.
- **FR-016**: The comparable effect-instrument editor workflow MUST be evaluated with the same reproduction method; shared behavior MAY use the same fix only when evidence demonstrates the shared cause, and otherwise MUST remain unchanged.
- **FR-017**: Focused regression coverage MUST reproduce the failure at the lowest practical boundary, validate the fix under repeated cold-open and reopen scenarios, and preserve existing window-manager, editor-document, live-value, and runtime contracts.
- **FR-018**: If end-to-end audio continuity cannot be asserted reliably in an automated environment, the feature MUST provide a deterministic manual validation procedure plus automated coverage for every isolatable contributor and lifecycle contract.
- **FR-019**: The final validation record MUST report the baseline, each tested candidate, any rejected or deferred alternative, all observed tradeoffs, and the evidence supporting completion.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: The current desktop application's Track instrument editor workflow, window identity rules, project document bridge, runtime synchronization, and live effective-value display define the functional baseline. Java Blue is not a direct behavioral reference because this issue concerns the detached-window and external-engine architecture rather than project semantics.
- **Compatibility Requirements**: Existing Track instrument content, `.blue` XML, generated CSD, automation data, editor mutations, undo/save behavior, engine-client messages, and instrument/effect editor ownership must remain compatible. Opening an editor must not itself cause a project mutation, engine restart, or performance recompile.
- **Intentional Divergences**: The timing and scheduling of disposable editor startup work may change to preserve audio continuity. No user-visible editing capability, project behavior, or sound is intentionally removed or changed.
- **State Ownership**: The main-process active project document remains the canonical owner of Track instrument state. The audio engine owns disposable performance state and effective runtime values. Editor windows own only disposable presentation, initialization, pending-interaction, and live-display state. Diagnostic traces and comparison results are development artifacts and are not project data.

### Key Entities

- **Qualifying Playback Workload**: A reproducible project and environment combination that plays without interruption before an editor action and retains measurable processing headroom, allowing editor-induced interruptions to be distinguished from pre-existing overload.
- **Editor Open Attempt**: One request identified by project session, Track, cold/warm state, application mode, action time, ready time, outcome, and whether an existing editor was reused.
- **Audio Continuity Observation**: The audible and measured result for the interval surrounding an editor open attempt, including any discontinuity, real-time budget miss, or equivalent interruption signal.
- **Editor Session**: Disposable UI state bound to exactly one project session and Track, with a lifecycle covering preparation, readiness, interaction, rebinding if explicitly supported, and cleanup.
- **Diagnostic Run**: A comparable collection of open attempts for one baseline or candidate, including workload, environment, repetitions, observations, and disposition.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the accepted packaged-application qualifying workload, 30 consecutive cold editor opens complete with zero audible discontinuities, zero newly observed playback interruptions, and zero incorrect Track bindings; the same workload records zero interruptions during its no-open control interval.
- **SC-002**: The cold-open validation covers at minimum one text-based instrument, one Blue Synth Builder instrument, and one BlueX7 instrument with live effective values, with zero editor-open-induced interruptions in every category.
- **SC-003**: The investigation produces a repeatable baseline with at least 10 open attempts per tested condition and controlled evidence that identifies which isolated contributor or contributor combination changes the interruption rate or severity.
- **SC-004**: At least 95% of packaged-application editor opens reach a usable state within 2 seconds, and the candidate's 95th-percentile ready time and first-edit response time are no more than 10% slower than the accepted baseline.
- **SC-005**: Application-ready time and project-open time are no more than 10% slower, and steady idle processing and memory use are no more than 10% higher, than the accepted baseline on the same machine across five comparable trials.
- **SC-006**: Once a Track-owned BlueX7 editor is ready during playback, its visible effective values are observed at least 20 times per second for a 60-second run with zero cross-instrument values, project mutations, stale-session acceptance, or audio interruptions.
- **SC-007**: Existing focused tests for Track editor window identity/lifecycle, editor document updates, Track control opening, BlueX7 live-value display, and audio-engine lifecycle pass with no regressions, and new repeated-open coverage passes 100% of its runs.
- **SC-008**: The final validation report accounts for 100% of investigated candidate fixes as adopted, rejected, or deferred and records the measured audio, readiness, startup, and idle-resource tradeoffs for each adopted change.

## Assumptions

- The reported symptom occurs while real-time playback or Blue Live is rendering audio; offline disk rendering is outside the primary user workflow unless investigation shows it shares the same externally triggered contention.
- A qualifying workload must play cleanly before the editor action. A project that already misses its real-time budget is an overload case and is not evidence that editor opening regressed, though any measured improvement may still be documented.
- The prior report's window-creation and transient system-load explanation is a hypothesis to validate. The specification does not preselect a warm window pool, progressive mounting, delayed polling, engine priority change, or any other implementation.
- Development-mode behavior is important diagnostic evidence, but packaged-application behavior is the release acceptance target because development asset serving can add non-representative work.
- The Track instrument editor remains a detached, non-modal editing experience from the user's perspective; changing its internal lifecycle is permitted only if the visible identity, focus, readiness, and cleanup contracts remain intact.
- Existing BlueX7 effective-value behavior requires at least 20 updates per second while playback or Blue Live is active. Briefly postponing its start until the editor is usable is acceptable; reducing its steady-state rate or persisting sampled values is not.
- Effect-instrument opening is a comparison case because it may share the same detached-editor costs, but expanding the shipped fix beyond shared proven behavior requires evidence and must not alter unrelated effect editing.
- No project XML, generated audio semantics, or persistent user setting is expected to change for this feature.

## Implementation Disposition

- **Adopted**: focus existing Track windows before snapshot construction; one
  renderer snapshot for cold opens; progressive editor/library/live startup;
  main-owned runtime status; neutral application-background shells; eager,
  dependency-isolated Effect Interface comparison; and shutdown-safe settings
  IPC.
- **Adopted hardening**: replace the active `channelMutex_`/deque handoff with
  the fixed-capacity `RealtimeChannelMailbox`. This removes blocking and
  allocation from the perform-thread channel boundary without changing the
  public engine protocol.
- **Deferred**: a standby Track-window pool, stronger scheduling policy, and
  larger default audio buffers. None is justified by the evidence collected.
- **External follow-up**: instrument and compare Csound's macOS AuHAL circular
  buffer with an SPSC atomic-index handoff. This is required to establish the
  final audio-device root cause and does not belong in the Blue Electron change.
