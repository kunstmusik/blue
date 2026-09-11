# Feature Specification: Global Project Undo and Redo

**Feature Branch**: `codex/103-global-undo-redo`

**Created**: 2026-09-08

**Status**: Complete — implementation converged and project-owner manual testing accepted (2026-09-11)

**Input**: Provide a global project undo/redo system that reliably restores project content, updates every affected view, and reconciles the audio engine. Prefer a coherent project-wide experience over Java Blue's separate tab histories.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reverse project edits as meaningful actions (Priority: P1)

A composer can undo and redo edits across score, instrument, mixer, and project editors in the order they were committed, without needing to find the editor where an edit originated.

**Why this priority**: Reliable reversal makes composition and experimentation safe.

**Independent Test**: Move a score object, delete a referenced instrument, and change a mixer level. Undo each action and redo all three, comparing content, identities, ordering, and references with the corresponding original states.

**Acceptance Scenarios**:

1. **Given** edits in several project editors, **When** the user invokes Undo repeatedly, **Then** each invocation reverses the latest remaining committed action regardless of the focused project editor; Redo restores those actions in forward order.
2. **Given** a drag affecting several selected objects, **When** the drag ends and the user undoes it, **Then** all affected objects return to their pre-drag state in one step.
3. **Given** a deleted object with references and project data not exposed by the current editor, **When** deletion is undone and redone, **Then** identity, ordering, references, and retained data are restored exactly and deletion behaves consistently.
4. **Given** a compound action whose application fails, **When** failure is reported, **Then** none of that action remains in the document or history and no effects of a partially applied action remain visible or audible.
5. **Given** an undone action, **When** the user commits a different edit, **Then** the old redo branch becomes unavailable; rejected and unchanged edits do not discard it.

---

### User Story 2 - See restored state in every window (Priority: P1)

A composer sees restored values, objects, text, and selection in all affected open views, including detached panels and dedicated editor windows.

**Why this priority**: An invisible or partially displayed reversal is indistinguishable from a failed undo.

**Independent Test**: Open two views of the same instrument, edit one, and undo from the other. Verify both views, the project dirty indicator, and the selected object.

**Acceptance Scenarios**:

1. **Given** two views of the same content, **When** an edit is undone or redone, **Then** both display the canonical result without requiring a manual refresh or reopening.
2. **Given** a structural undo that restores an object, **When** the origin view is still available, **Then** its selection identifies and reveals the restored object; invalid selections in other views are cleared or reconciled without stealing focus.
3. **Given** an edit awaiting completion in another window, **When** Undo is requested, **Then** that edit is settled or explicitly rejected before undo proceeds, and no delayed update silently reapplies it afterward.
4. **Given** a saved project followed by one edit, **When** the edit is undone, **Then** the project is clean; redoing it marks the project dirty. Receiving a view refresh alone never marks a modified project clean.
5. **Given** a temporary unapplied draft in an affected editor, **When** project content changes elsewhere, **Then** the draft is not silently overwritten and applying a conflicting stale draft requires explicit resolution.

---

### User Story 3 - Hear live reversals and understand pending runtime changes (Priority: P1)

A composer undoing or redoing while playing hears supported live changes. Compilation-dependent edits take effect on the next user-requested start without routine restart notifications.

**Why this priority**: Visible controls and audible state must not silently disagree.

**Independent Test**: During normal playback and separately during Blue Live, undo a supported live parameter edit, undo a change requiring compilation, and simulate an engine update failure.

**Acceptance Scenarios**:

1. **Given** a running performance and a supported live parameter edit, **When** it is undone or redone, **Then** the engine receives the restored value in action order and the UI reports completion only after the runtime update is acknowledged.
2. **Given** a reversal requiring a new compiled performance, **When** the project is restored, **Then** playback is not automatically interrupted, no restart-required toast or status strip appears, and the next user-requested restart uses the restored project.
3. **Given** an engine update failure, **When** the project undo succeeds, **Then** the project and history remain restored, a visible failure explains the runtime mismatch, and the user can retry where supported or restart.
4. **Given** stopped playback, **When** edits are undone or redone and playback subsequently starts, **Then** the performance is generated from the current restored project.
5. **Given** an older update still pending when playback or the project changes, **When** that update completes late, **Then** it cannot alter the new performance or incorrectly mark its runtime state synchronized.

---

### User Story 4 - Use consistent text, menu, and keyboard undo (Priority: P2)

A composer can undo committed code and text alongside other project edits while retaining ordinary local undo in temporary drafts and search fields.

**Why this priority**: Separate histories for the same committed content make undo unpredictable.

**Independent Test**: Type into a project code field, change a score object, then invoke Undo twice from a project editor. Separately undo typing in an unapplied dialog draft with an empty project history.

**Acceptance Scenarios**:

1. **Given** committed typing followed by a score edit, **When** Undo is invoked twice, **Then** the score edit and then the typing group are reversed, each exactly once.
2. **Given** uninterrupted typing in the same field with gaps shorter than 500 ms, **When** the user finishes and invokes Undo, **Then** that typing group is reversed together; an input-method composition is never split midway.
3. **Given** a temporary draft or search field with local history, **When** Undo is invoked there, **Then** only that local content is reversed, even if project undo is unavailable; an empty local history does not fall through to an unrelated project edit.
4. **Given** a focused main window, detached panel, or dedicated editor window, **When** the user invokes a supported shortcut, menu action, or editor Undo/Redo action, **Then** exactly one action reaches the appropriate history and its availability and label reflect that history.
5. **Given** text restored by project undo, **When** the editor receives that text, **Then** no additional edit or undo entry is created and the text selection remains valid.

---

### User Story 5 - Keep history useful throughout a project session (Priority: P2)

A composer can save, close individual editors, and restart playback without losing the ability to undo recent work.

**Why this priority**: History belongs to the project rather than the lifetime of an editor or performance.

**Independent Test**: Edit, save, edit again, close an editor, restart playback, and undo through the save point. Then open a different project and verify isolation.

**Acceptance Scenarios**:

1. **Given** existing history, **When** the user saves, closes an editor, or restarts a runtime dependency, **Then** project history remains available.
2. **Given** history from an open project, **When** the project is closed or replaced, **Then** it cannot be applied to the next project.
3. **Given** retention limits are reached, **When** older entries are discarded, **Then** complete recent actions remain usable, the UI identifies the history limit, and an evicted save point never causes a false clean indication.

### Edge Cases

- Empty history, rejected edits, unchanged values, cancelled gestures, and failed asynchronous operations create no phantom undo steps.
- Rapid repeated commands and duplicate delivery reverse each intended action once, in order.
- An edit from another window ends the current grouping; non-adjacent actions are never merged across intervening work.
- A project switch during an outstanding edit or engine update cannot mutate the newly opened project.
- Deleting an object whose editor is open invalidates that editor safely; restoring the object does not require forcibly reopening a closed window.
- Undo of freeze/unfreeze or a project library insertion restores project content without deleting generated audio or modifying the external library.
- Missing external files remain explicitly unavailable after restoration; undo does not fabricate or silently discard them.
- Engine-affecting structural restoration invalidates obsolete runtime associations, including when the old and restored objects occupy the same visible position.
- A saved state on a discarded redo branch or outside retention is never mistaken for the current clean state.
- Platform key handling and input-method composition must not cause double execution or partial-character restoration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide one chronological history of committed project actions per open project, shared by all project editors and windows.
- **FR-002**: Coverage MUST include score objects and layers, automation and timing maps, instruments including BSB and BlueX7, PianoRoll content, mixer channels and effects, project code/text and UDOs, project properties and persisted transport settings, Blue Live and MIDI project configuration, project-side library insertion/replacement, and freeze/unfreeze project changes. No project-editing entry point may silently bypass history.
- **FR-003**: Each completed user action MUST produce at most one labeled history entry. Compound actions MUST restore all participating changes atomically; failed or unchanged actions MUST leave no entry or partial document change.
- **FR-004**: Undo/redo MUST preserve exact project values, stable object identities, ordering, references, and modeled and unmodeled project data. Redo MUST restore the previously committed result rather than create a different object.
- **FR-005**: Edits, undo, and redo MUST have a single authoritative ordering. Outstanding edits across participating windows MUST be resolved before undo; stale or duplicate requests MUST not overwrite newer state or apply an action twice.
- **FR-006**: Undo/redo MUST update all affected open views from the restored project without manual refresh. Older notifications MUST not overwrite newer displayed state, and restored state MUST not echo as a new edit.
- **FR-007**: Undo/redo MUST restore valid origin-view selection and reveal affected content when that view remains open. Other views MUST reconcile invalid selections without being opened or focused automatically. Unapplied drafts MUST be preserved or explicitly resolved on conflict.
- **FR-008**: A completed drag or compound command MUST be one undo step. Text editing MUST batch consecutive insertions as single undo steps, batch consecutive deletions as single undo steps, and treat mutations (replacements/pastes) as atomic units. Switching between insertion and deletion MUST close the current batch and begin a new batch. Word and line boundaries (whitespace/newlines) and typing pauses exceeding 500 ms MUST close the active batch. Selection movement, a different editor/action, field blur, save, undo, redo, or settlement boundary MUST end grouping; interleaved actions MUST remain separately ordered.
- **FR-009**: Committed project text MUST participate in project history exactly once. Temporary drafts and search fields MUST retain isolated local history; applying a draft MUST create one project action and cancelling it none.
- **FR-010**: Undo and Redo MUST be accessible through application menus, applicable editor context menus, and platform shortcuts in every hosting window. Labels MUST describe the next action, and enablement MUST follow the selected project or local draft history. Support Cmd+Z/Cmd+Shift+Z on macOS and Ctrl+Z, Ctrl+Y, and Ctrl+Shift+Z on Windows/Linux, without double execution.
- **FR-011**: A successful new edit after undo MUST discard the redo branch. Saving MUST preserve history and establish a saved-state checkpoint. Dirty state MUST reflect whether the current history state matches that checkpoint, not whether a view was refreshed.
- **FR-012**: History MUST survive editor closure and runtime restarts or dependency invalidation within the same project. Closing or replacing the project MUST isolate or clear its history. History MUST not be persisted into project files.
- **FR-013**: History retention MUST be bounded by both action count and retained data size. Eviction MUST remove complete oldest actions only and never misidentify an evicted checkpoint as clean. Limits remain documented and available in history metadata, without a persistent usage strip. An action too large to retain MUST be identified before commitment and require explicit user agreement to a history reset or allow cancellation.
- **FR-014**: Every edit, undo, and redo MUST classify its runtime consequence as no engine change, supported live update, or restart required. This MUST include consequences of structural restoration and removed runtime targets.
- **FR-015**: Supported live reversals MUST update every applicable active performance, including normal playback and Blue Live, in action order. Runtime tracking MUST distinguish pending, applied, restart-required, and failed outcomes and MUST not report pending work as applied. No persistent runtime status strip is required.
- **FR-016**: A change requiring compilation MUST track the active performance as requiring restart without automatically interrupting playback or showing restart-required toasts. The next user-requested start/restart MUST use the current canonical project, including restored code, score, effects, and instruments.
- **FR-017**: Runtime failure MUST NOT reverse a successfully committed document action or corrupt history. Genuine failures remain visible through existing error reporting, with recovery through the existing playback and Blue Live controls rather than a new status-strip action; obsolete results MUST not affect a different project or performance.
- **FR-018**: Undo of project-side operations involving external resources MUST restore project references and content without implicitly deleting generated files, reversing external library writes, or recreating missing files. Unavailable resources MUST remain explicitly identified.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue's `BlueUndoManager` supplies named tab histories and action labels; `ScoreController` groups related score edits. These behaviors establish the value of descriptive, gesture-level undo.
- **Compatibility Requirements**: `.blue` remains the canonical project format. Edit/undo/redo round trips MUST preserve unknown XML, project-authored typography, object references, and executable project semantics. Generated CSD and the next performance MUST reflect the restored project. Existing external resource paths and unavailable-runtime metadata MUST remain intact.
- **Intentional Divergences**: One project-wide chronological history replaces separate tab/editor histories for committed project content, including text. Runtime synchronization outcomes become explicit. Temporary drafts remain local. These departures provide predictable cross-editor undo and prevent silent visual/audio mismatch.
- **State Ownership**: The main process remains the canonical owner of `BlueData` and owns the project history and saved-state checkpoint. Renderers own temporary drafts, focus, selection, and presentation. Committed score, layer, and item color actions use that same canonical project history; no renderer-local score-color undo stack is retained. The host owns runtime lifecycle and synchronization outcomes; engine state and compiled performances are derived from the project. History and presentation metadata are session state and do not enter `.blue` XML. External libraries and generated files retain their existing independent ownership.

### Key Entities

- **Project History**: Ordered retained actions and current undo/redo position for one document lifetime.
- **User Action**: A labeled committed edit or gesture, its exact before/after project states, affected objects, and origin view context.
- **Saved-State Checkpoint**: The history state corresponding to the last successful load/save, used to determine dirty state.
- **View Context**: Temporary selection, focus, and draft state associated with an editor and its hosting window.
- **Runtime Synchronization Outcome**: The pending, applied, restart-required, or failed consequence of an action for a particular active performance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every editing domain listed in FR-002 has at least one passing edit→undo→redo acceptance scenario; structural scenarios preserve all original identities, references, and retained project data.
- **SC-002**: A sequence of 100 mixed edits can be completely undone and redone with zero lost, duplicated, or reordered actions, including edits originating in two windows and committed text.
- **SC-003**: In the agreed representative-project acceptance suite, 95% of ordinary single-object undo/redo actions visibly settle in all affected open views within 200 ms of the command when no earlier action is pending.
- **SC-004**: In that suite with a responsive engine, 95% of supported single-parameter live reversals are acknowledged within 250 ms; all injected failures produce a visible accurate error within one second of their determination. Restart-required changes remain tracked without routine notifications.
- **SC-005**: All save→edit→undo→redo, save-point eviction, and branch-after-undo scenarios display the correct dirty state without manual refresh.
- **SC-006**: Each supported shortcut triggers exactly one intended action in main, detached, and dedicated editor windows on macOS, Windows, and Linux, including local drafts and input-method typing.
- **SC-007**: All pending-edit, duplicate-command, partial-failure, project-switch, and late-runtime-result scenarios finish with mutually consistent document, history, and displayed state and no changes applied to an unrelated project or performance.
- **SC-008**: Normal playback and Blue Live both pass live-parameter reversal, stopped-engine restoration, restart-required structural restoration, and failure-recovery scenarios; next-playback artifacts represent the restored project in every case.

## Assumptions

- This feature covers committed project content, not application preferences, window layout, search history, playback start/stop commands, external library database changes, or filesystem deletion. Persisted project transport settings remain in scope.
- History is session-only; recovery of undo history after application exit or crash and collaborative multi-user selective undo are out of scope.
- Compilation-dependent changes require an explicit user restart. Seamless automatic replacement of a running performance is not required.
- Existing runtime capabilities determine which values can update live. Planning must enumerate that capability matrix for normal playback and Blue Live; unsupported changes receive restart-required behavior rather than a silent no-op.
- The initial retention target is 200 actions with a 64 MiB retained-data ceiling. Both are defaults for acceptance and may be revised with measured project evidence during planning; the 100-action acceptance sequence uses documents below that ceiling.
- Performance validation uses a documented representative project set and reference machine selected during planning, including a large project. Resource-heavy structural actions may exceed ordinary-action latency but must remain visibly pending and preserve ordering.
- Existing project loading/saving and engine error reporting are dependencies. Their behavior must support the checkpoint, restored-artifact, and runtime-outcome requirements above.
