# Feature Specification: Java Blue Live Trigger Parity

**Feature Branch**: `065-blue-live-parity`
**Created**: 2026-07-30
**Completed**: 2026-07-31
**Status**: Complete
**Input**: Restore a narrow Java-compatible Blue Live baseline before building the future track-and-scene launcher: make project/session handling safe, generate trigger material without mutating the project, and support triggering the selected Live Space object or all enabled objects while preserving legacy project data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trigger Live Space Material (Priority: P1)

As a Blue Live performer, I can trigger the selected Live Space cell or all currently enabled cells into the running Blue Live performance so the existing bin system is musically usable rather than an authoring-only shell.

**Why this priority**: Manual triggering is the missing core behavior that prevents the current Electron Live Space from reaching the practical baseline of Java Blue.

**Independent Test**: Open a fixture containing disabled and enabled Live Space cells, start Blue Live, trigger a selected disabled cell, then trigger the enabled batch. Confirm that the first action submits only the selected cell and that the second submits every enabled cell as one batch at the project’s Blue Live tempo.

**Acceptance Scenarios**:

1. **Given** Blue Live is running and a populated cell is selected, **When** the user invokes the selected-cell trigger command, **Then** that cell is submitted even when its persistent enabled flag is off.
2. **Given** Blue Live is running and multiple cells are enabled anywhere in the grid, **When** the user presses Trigger or invokes the enabled-batch shortcut, **Then** all enabled cells are generated and submitted together as one score batch.
3. **Given** a generated note has an authored start time and duration, **When** it is triggered at a Blue Live tempo other than 60, **Then** its start and duration are scaled by `60 / Blue Live tempo` while its other note fields retain their generated values.
4. **Given** Blue Live is stopped, starting, stopping, or failed, **When** the user requests a trigger, **Then** no event is sent to another engine and the user receives a clear no-op or recoverable status.
5. **Given** no populated cell is selected or no cells are enabled for the requested trigger mode, **When** the user requests a trigger, **Then** the request completes safely without submitting an empty or malformed event.

---

### User Story 2 - Always Use the Current Project and Session (Priority: P1)

As a composer working quickly, I can edit Blue Live settings and immediately start, recompile, or trigger without hearing an older project revision, and I can close or replace a project without stale work reaching a later session.

**Why this priority**: Restoring Trigger on top of the current buffered edits and unfenced asynchronous lifecycle could compile stale state or send events from a closed project, which is more damaging than leaving Trigger disabled.

**Independent Test**: Change Blue Live tempo or enabled state and immediately start, recompile, or trigger; confirm the accepted edit is used. Then begin generation, stop or replace the project before it completes, and confirm the old result is never submitted to the new or stopped session.

**Acceptance Scenarios**:

1. **Given** an accepted project edit is still pending delivery to the canonical document, **When** the user starts, recompiles, or performs an enabled-batch trigger, **Then** the command waits for that edit or fails clearly instead of using older state.
2. **Given** generation is pending for a running session, **When** Blue Live is stopped or recompiled, **Then** the pending result cannot be submitted to the stopped or replacement session.
3. **Given** Blue Live is starting or running for one project, **When** that project is closed, a new project is created, or another project is opened, **Then** the old session is cancelled before the replacement project becomes eligible for live commands.
4. **Given** a project command changes no canonical project data, **When** it is applied, **Then** it does not advance the document revision or mark the project dirty.
5. **Given** realtime playback and Blue Live are both active, **When** Blue Live is triggered, stopped, or recompiled, **Then** the realtime session remains isolated and receives none of the Blue Live commands.

---

### User Story 3 - Trigger Generative Objects Without Corrupting the Project (Priority: P2)

As a composer with generative or host-runtime-backed SoundObjects in a legacy Blue Live project, I can trigger supported objects and get an actionable error for unavailable ones without the trigger operation modifying my authored project.

**Why this priority**: Java Blue Live accepted generative SoundObjects, but its trigger path temporarily mutated authored timing state. Electron must retain that creative capability without preserving the mutation defect or hiding host-runtime failures.

**Independent Test**: Record the canonical project before triggering representative native, Jython-backed, and Clojure-backed LiveObjects. Trigger each object, compare the project afterward, and verify either correct event output or a specific recoverable runtime diagnostic.

**Acceptance Scenarios**:

1. **Given** a supported LiveObject, **When** it is triggered repeatedly, **Then** the canonical SoundObject and saved project remain unchanged unless the user separately edits them.
2. **Given** a LiveObject whose content requires a host runtime, **When** that runtime is available, **Then** event preparation may complete asynchronously and the resulting batch is submitted only to the originating active session.
3. **Given** a required host runtime is unavailable or generation fails, **When** the object is triggered, **Then** the user receives an object-specific recoverable diagnostic and the project and engine session remain usable.
4. **Given** a supposedly isolated project copy is used for preparation, **When** the copy is modified during a test, **Then** the original Live Data, embedded SoundObjects, libraries, and opcode definitions are unaffected while internal references in the copy remain coherent.

---

### User Story 4 - Preserve Legacy Blue Live Projects (Priority: P2)

As a long-time Blue user, I can open, trigger, save, and reopen an existing Java Blue Live project without losing its bin layout, enabled masks, saved sets, trigger metadata, tempo, Repeat settings, Live Code, or unknown project data.

**Why this priority**: The parity pass is a compatibility bridge. It must not force migration to the future launcher or reinterpret legacy authoring state as modern runtime state.

**Independent Test**: Round-trip representative Java-authored `.blue` fixtures, apply saved enabled sets, perform manual triggers, save, and compare the modeled and preserved XML before and after.

**Acceptance Scenarios**:

1. **Given** a Java-authored project containing sparse bins and saved enabled sets, **When** it is loaded and saved without edits, **Then** its modeled Blue Live values and preserved unknown project data remain compatible.
2. **Given** a saved set references existing and missing LiveObject identifiers, **When** it is applied, **Then** existing matches receive the saved enabled mask, missing references are ignored safely, and the set is not reinterpreted as a scene.
3. **Given** a project stores Repeat, key-trigger, or MIDI-trigger values, **When** it is loaded, manually triggered, and saved, **Then** those values are preserved even though this parity pass does not activate their deferred runtime behaviors.
4. **Given** the future launcher model is not present, **When** a legacy project is used, **Then** no track, scene, clip-slot, launch-quantization, or playing-state data is silently inferred from legacy rows, columns, enabled flags, or saved sets.

---

### User Story 5 - Edit Live Space Cells From the Java-Compatible Menu (Priority: P1)

As a Blue Live author, I can right-click the exact Live Space cell I want to edit and find the same object, clipboard, row, and column commands as Java Blue, without a separate strip of structural buttons consuming grid space.

**Why this priority**: The current bottom controls act on fixed outer edges rather than the cell the user is working with. Java Blue's cell-relative menu is both the established interaction and the only complete route to before/after row and column operations.

**Independent Test**: Right-click populated and empty cells in a multi-row, multi-column Live Space. Verify the Java menu order and enablement, add/cut/copy/paste/remove objects, insert on either side of the clicked cell, and remove the clicked row or column while retaining a minimum one-by-one grid.

**Acceptance Scenarios**:

1. **Given** any Live Space cell, **When** the user right-clicks it, **Then** that cell becomes the operation target and the menu appears in this order: Add SoundObject submenu, Remove, separator, Cut, Copy, Paste, separator, Insert Row Before, Insert Row After, Remove Row, separator, Insert Column Before, Insert Column After, Remove Column.
2. **Given** a populated target cell, **When** the menu opens, **Then** Remove, Cut, and Copy are enabled; **given** an empty target cell, **Then** those three actions are disabled.
3. **Given** a compatible single SoundObject is in the shared score-object copy buffer, **When** Paste is chosen, **Then** an independent deep copy replaces the target cell, receives a fresh LiveObject identity, and starts at beat zero; incompatible, missing, or multi-object buffers leave Paste disabled.
4. **Given** the target cell is in row or column `n`, **When** an insert-before/after command is chosen, **Then** the new row or column is inserted immediately before/after `n`; **when** remove is chosen, **Then** row or column `n` is removed.
5. **Given** the grid has one remaining row or column, **When** the menu opens, **Then** the corresponding Remove Row or Remove Column command is disabled.
6. **Given** the Live Space is displayed, **Then** the former `+Row Top`, `+Row Bottom`, `-Row`, `+Col Left`, `+Col Right`, and `-Col` button strip is absent.

---

### User Story 6 - Share Copy Buffers With the Score Timeline (Priority: P2)

As a composer moving material among Blue editors, I can copy a SoundObject between the Score timeline and Blue Live, and I can copy a BlueSynthBuilder instrument and paste it into the Score as a Sound, using the same application-wide buffers as Java Blue.

**Why this priority**: Separate editor-local clipboards make Java workflows appear to succeed while Paste remains unavailable in the destination. The Java reference deliberately shares `ScoreObjectCopy` between the timeline and Blue Live and shares the instrument `CopyBuffer` with Paste BSB As Sound.

**Independent Test**: Copy a supported timeline SoundObject and paste it into Blue Live, copy it back from Blue Live and paste it onto the timeline, then copy a BlueSynthBuilder from Orchestra and invoke Paste BSB As Sound on a compatible Score layer.

**Acceptance Scenarios**:

1. **Given** one compatible timeline SoundObject was copied, **When** the user opens a Blue Live cell menu, **Then** Paste is enabled and creates an independent LiveObject containing that SoundObject.
2. **Given** a populated Blue Live cell was copied or cut, **When** the user pastes on a compatible Score timeline layer, **Then** the Score receives an independent SoundObject with preserved content and no shared mutable identity.
3. **Given** a copied BlueSynthBuilder instrument, **When** the user chooses Paste BSB As Sound on a compatible Score layer, **Then** a new Sound containing a deep BSB copy is inserted at the snapped target time and its inherited automation is flattened to the current values.
4. **Given** the instrument buffer does not contain a BlueSynthBuilder or the target layer is incompatible, **When** the Score menu opens or Paste BSB As Sound is invoked, **Then** the action is disabled or rejected without changing the project.
5. **Given** BSB widgets are copied within the BSB canvas, **Then** that widget payload remains type-safe and does not overwrite either the ScoreObject or Instrument buffer.

---

### User Story 7 - Edit a Selected Live SoundObject (Priority: P1)

As a Blue Live author, I can select a populated Live Space cell and immediately use the same type-specific ScoreObject editor and ScoreObject Properties controls that Java Blue exposes for its underlying SoundObject.

**Why this priority**: Live Space objects are authored SoundObjects, not opaque launch labels. Without the shared editor/property selection, users cannot complete the established Java Blue authoring workflow from the Live bin.

**Independent Test**: Select populated and empty Live Space cells, move the selected LiveObject by inserting rows or columns, edit type-specific content and shared properties, and verify that editor/property routing follows the stable LiveObject identity and persists through project save/reopen.

**Acceptance Scenarios**:

1. **Given** a populated Live Space cell, **When** the user selects it, **Then** the shared selection contains exactly its underlying SoundObject and the ScoreObject Editor is opened or activated with the matching type-specific editor.
2. **Given** that populated cell is selected, **When** ScoreObject Properties is visible, **Then** it displays the selected SoundObject's name, start, duration, color, supported time behavior, repeat point, and note processor chain.
3. **Given** a selected Live SoundObject, **When** the user edits supported type-specific content or shared properties, **Then** the canonical LiveObject-owned SoundObject is updated and the change persists in `.blue` XML.
4. **Given** a selected LiveObject moves because a row or column is inserted, **When** the editor next reads or writes it, **Then** the target is resolved by stable LiveObject identity rather than stale grid coordinates.
5. **Given** an empty cell is selected or the selected LiveObject is removed or replaced, **When** editor/property selection is evaluated, **Then** the prior Live SoundObject is cleared and stale edits are rejected without mutating another cell.

### Edge Cases

- A trigger is requested while Blue Live transitions between stopped, starting, running, recompiling, stopping, or failed.
- The selected cell was removed, replaced, or no longer matches its stable identity before the canonical command is handled.
- The grid is empty, sparse, one row or column wide, contains no enabled cells, or has several enabled cells in the same row or column.
- Blue Live tempo is invalid, non-finite, zero, negative, or changes while generation is pending.
- A generated object returns no notes, malformed notes, non-finite timing values, or throws after partial preparation.
- The user triggers repeatedly faster than an expensive object can be prepared.
- A project is closed, created, opened, or replaced while preparation or engine submission is in flight.
- Recompile or stop begins between preparation completion and engine submission.
- A host runtime starts successfully but becomes unavailable during preparation.
- Applying a saved set references missing identifiers or an invalid structural patch produces no actual change.
- Engine submission fails after successful preparation.
- Blue Live and realtime playback are active concurrently.
- A context menu is opened on an empty cell, an occupied cell, or a cell that moves after a structural edit.
- The shared score-object buffer contains zero objects, multiple objects, an AudioClip, an unsupported SoundObject family, or XML that can no longer be loaded.
- Copy is followed by source removal, project replacement, or repeated paste; every paste must remain independent of the source and prior pastes.
- A non-BSB instrument is in the shared instrument buffer when Paste BSB As Sound is displayed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The implementation MUST use the Java Blue selected trigger, enabled-batch trigger, note scaling, project lifecycle, and runtime-backed SoundObject behavior as the parity reference before changing Electron behavior.
- **FR-002**: Users MUST be able to trigger the selected populated Live Space cell regardless of that cell’s persistent enabled state.
- **FR-003**: Users MUST be able to trigger all enabled Live Space cells as one batch through the existing Trigger control and a platform-appropriate equivalent of Java Blue’s enabled-batch shortcut.
- **FR-004**: The selected-cell command MUST retain a platform-appropriate equivalent of Java Blue’s selected trigger shortcut.
- **FR-005**: Manual trigger generation MUST use the current project’s Blue Live generation context and MUST scale generated note start times and durations by `60 / Blue Live tempo`.
- **FR-006**: Manual trigger events MUST be submitted only to a running, dedicated Blue Live session and MUST remain isolated from realtime playback and disk rendering.
- **FR-007**: Trigger preparation MUST NOT mutate canonical LiveObjects, embedded SoundObjects, their timing behavior, libraries, opcode definitions, or any other authored project state.
- **FR-008**: Trigger preparation MUST operate from an isolated, immutable-for-the-operation project/object view whose internal references remain coherent.
- **FR-009**: Supported host-runtime-backed SoundObjects MUST be preparable asynchronously through the existing host-owned runtime boundary; unavailable or failed runtime execution MUST return a clear, recoverable diagnostic without corrupting the project or session.
- **FR-010**: The Electron main process MUST remain the canonical owner of the active project document, Blue Live session lifecycle, external runtime lifecycle, and engine submission; renderer state MUST remain a serializable view plus explicit user intent.
- **FR-011**: Start, recompile, and any trigger action that depends on current renderer edits MUST establish an acknowledgement barrier for pending accepted project patches before reading the canonical project state.
- **FR-012**: Document revision and Blue Live session generation MUST be distinct concepts so starting or recompiling does not masquerade as a project edit.
- **FR-013**: Prepared trigger work and engine submission MUST be fenced by both originating document revision and session generation; stale work MUST be cancelled when possible and ignored otherwise.
- **FR-014**: Closing, creating, opening, or replacing the active project MUST stop or cancel any non-idle Blue Live session before the replacement project becomes eligible for live commands.
- **FR-015**: Rejected and semantic no-op project patches MUST NOT mark the project dirty or advance its document revision.
- **FR-016**: Trigger requests and results crossing renderer, preload, main-process, host-runtime, or engine boundaries MUST be typed, serializable, validated, and include explicit failure behavior.
- **FR-017**: Existing Java-compatible Blue Live XML MUST continue to preserve bin dimensions and sparsity, LiveObject identities and embedded content, enabled flags, saved sets, tempo, Repeat values, key/MIDI trigger metadata, command-line options, and Live Code.
- **FR-018**: Applying a legacy saved set MUST continue to replace the persistent enabled mask by LiveObject identity and MUST NOT launch material automatically.
- **FR-019**: The UI MUST distinguish the persistent enabled flag from runtime trigger success or playing state and MUST surface preparation or submission failures without changing the enabled mask.
- **FR-020**: Audible global Repeat scheduling MUST NOT be introduced in this feature. Stored Repeat values MUST remain editable and losslessly preserved, and the UI MUST make its deferred audible behavior clear.
- **FR-021**: Stored key-trigger and MIDI-trigger metadata MUST remain preserved but MUST NOT acquire new runtime behavior in this feature.
- **FR-022**: This feature MUST NOT add or infer tracks, scenes, clip slots, per-track exclusivity, launch quantization, looping, queued launch state, performance capture, or arrangement conversion.
- **FR-023**: Focused automated regression coverage MUST include Java-compatible manual trigger semantics, note scaling, immutable preparation, asynchronous success/failure, edit acknowledgement, revision/session fencing, project replacement, session isolation, no-op patch handling, and XML preservation.
- **FR-024**: Right-clicking a Live Space cell MUST target that exact cell and expose the Java-compatible menu grouping and order defined in User Story 5.
- **FR-025**: The existing bottom-row Live Space row/column control buttons MUST be removed.
- **FR-026**: Row and column insertion/removal MUST be relative to the right-clicked cell, MUST preserve column-major bin data and stable identities of retained cells, and MUST prevent removal of the final row or column.
- **FR-027**: Add SoundObject MUST offer the Java Blue live-eligible SoundObject families supported by the TypeScript data model and MUST create a fresh LiveObject at the targeted cell.
- **FR-028**: Remove, Cut, Copy, and Paste enablement MUST match the target cell and shared-buffer compatibility rules defined in User Story 5.
- **FR-029**: Blue Live and the Score timeline MUST use one application-wide ScoreObject copy buffer for compatible SoundObject copy/cut/paste operations.
- **FR-030**: Blue Live copy, cut, and paste MUST use serialized deep-copy payloads; a paste MUST create a fresh LiveObject identity, reset the pasted SoundObject start to beat zero, and MUST NOT alias the source or an earlier paste.
- **FR-031**: The Orchestra/BlueSynthBuilder and Score timeline workflow MUST share the application-wide Instrument buffer, and Paste BSB As Sound MUST accept only a BlueSynthBuilder payload on a compatible sound layer.
- **FR-032**: Paste BSB As Sound MUST deep-copy the BlueSynthBuilder, disable its inherited automation, replace automation lines with constant current-value endpoints, preserve the instrument comment, and insert a new Sound at the snapped target time.
- **FR-033**: The BSB widget canvas clipboard MUST remain a separate typed payload so widget copy/paste cannot corrupt the ScoreObject or Instrument buffers.
- **FR-034**: Focused regression coverage MUST include exact menu order/enablement, removal of the structural button strip, cell-relative row/column mutations, bidirectional Blue Live/Score copy-paste, copy independence, and BlueSynthBuilder-to-Sound paste eligibility and conversion.
- **FR-035**: Selecting a populated Live Space cell MUST publish exactly its underlying SoundObject through the application-wide ScoreObject selection and MUST open or activate the ScoreObject Editor.
- **FR-036**: The ScoreObject Editor and ScoreObject Properties surfaces MUST resolve a selected Live SoundObject through a typed target containing its stable LiveObject identity and coordinate hints; identity MUST remain authoritative after structural grid changes.
- **FR-037**: Type-specific editor changes and supported shared-property changes for a selected Live SoundObject MUST mutate the canonical LiveObject-owned SoundObject through the existing project-document boundary and persist through `.blue` save/reopen.
- **FR-038**: Selecting an empty cell, removing the selected LiveObject, or replacing it with a different identity MUST clear or invalidate the prior editor/property target and MUST NOT redirect stale edits to another object.
- **FR-039**: Focused regression coverage MUST verify populated/empty selection routing, editor activation, properties population, type-specific and shared-property mutation, identity-based resolution after row/column changes, and stale-target rejection.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue `BlueLiveTopComponent` selected and enabled-batch Trigger workflows, `BlueLiveBinding` generation/scaling behavior, `RealtimeRenderManager` Blue Live lifecycle, `LiveData`, `LiveObject`, `LiveObjectBins`, and saved-set models. Java’s temporary mutation of authored `TimeBehavior`, stale queued Repeat work, and backend-specific Repeat behavior are defects or unstable behavior, not parity targets.
- **Reference Authoring Behavior**: Java Blue `BlueLiveTopComponent` selection lookup, `ScoreObjectEditorTopComponent`, and `SoundObjectPropertiesTopComponent` define Live SoundObject editor/property routing. `BlueLiveTopComponent.BufferMenu` and `AddMenu`, `ScoreController` plus `BlueClipboardUtils`/`ScoreObjectCopy`, and `PasteBSBAsSoundAction` plus `CopyBuffer.INSTRUMENT` define the cell menu and shared-buffer behavior.
- **Compatibility Requirements**: A selected populated cell triggers regardless of enabled state; Trigger submits every enabled cell as one batch; generated p2/p3 timing is scaled by `60 / tempo`; saved sets remain arbitrary enabled-mask snapshots by stable LiveObject identity; existing `.blue` XML and unmodeled data remain lossless.
- **Intentional Divergences**: Trigger preparation never mutates authored SoundObjects; enabled batches are not partially submitted after a member fails; asynchronous work is revision/session fenced; unresolved saved-set identifiers are retained losslessly instead of being discarded on load; audible global Repeat is deferred; dormant key/MIDI trigger metadata remains non-operative; no modern track/scene launcher semantics are inferred.
- **State Ownership**: Main-process `BlueData` owns the canonical project and `.blue` persistence. The renderer owns transient selection and buffered edit intents until acknowledged. The main process owns Blue Live and host-runtime lifecycles. Prepared event batches, revision/session fences, diagnostics, and runtime trigger status are disposable main-owned derived state and are never written to `.blue` XML.

### Key Entities *(include if feature involves data)*

- **Legacy Trigger Intent**: A validated request to trigger one stable LiveObject identity or the canonical set of currently enabled LiveObjects.
- **Trigger Preparation Snapshot**: An isolated view of the originating document revision, Blue Live tempo, generation context, and target SoundObjects used without mutating canonical state.
- **Prepared Score Batch**: A disposable collection of generated and tempo-scaled score events plus origin metadata and any preparation diagnostic.
- **Blue Live Session Generation**: A transient identity for one start/recompile lifecycle, independent of document revision, used to reject stale work.
- **Document Revision Barrier**: An acknowledgement that accepted project edits required by a live command have reached the canonical project owner.
- **Legacy Enabled Set**: A persisted arbitrary set of LiveObject identities that updates enabled flags but is not a scene or runtime launch command.
- **Live Cell Menu Target**: The renderer-local row and column captured from the cell that opened the context menu; every cell/object/structural command applies to this target.
- **Shared ScoreObject Buffer**: A transient application-wide list of serialized ScoreObjects and placement metadata used by both the Score timeline and Blue Live.
- **Shared Instrument Buffer**: A transient application-wide copied/cut Instrument payload used by Orchestra and, when the payload is a BlueSynthBuilder, by Paste BSB As Sound.
- **BSB Widget Buffer**: A separate transient payload containing selected interface widgets and their canvas origin; it is intentionally not interchangeable with the Instrument buffer.
- **Blue Live Editor Target**: A transient typed selection reference containing the stable LiveObject identity plus grid-coordinate hints; editor and property reads/writes revalidate the identity against canonical LiveData.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Automated and manual fixture tests pass 100% of selected-disabled, selected-enabled, empty-selection, and multi-enabled trigger scenarios with the Java-compatible target set.
- **SC-002**: Generated note start times and durations match the Java `60 / tempo` scaling result for all curated tempo and multi-note fixtures.
- **SC-003**: Across 100 automated rapid edit/start/recompile/trigger sequences, every command uses the latest acknowledged project state and no stale document revision is submitted.
- **SC-004**: Across 100 automated start/recompile/stop/project-replacement cycles with preparation in flight, zero events from an obsolete session reach the stopped or replacement session.
- **SC-005**: Triggering every curated native and host-runtime-backed fixture produces either the expected score batch or a specific recoverable diagnostic, with no unhandled failure and no change to the canonical project serialization.
- **SC-006**: Existing Java-authored Blue Live fixtures retain 100% of covered modeled values and preserved unknown data through load/save and trigger-only workflows.
- **SC-007**: Concurrent realtime and Blue Live verification shows zero cross-session trigger, stop, recompile, or output-routing commands.
- **SC-008**: The focused data, shared-contract, renderer, main-process, Java-runtime, and engine-boundary test suites plus affected builds and type checks pass before the parity pass is considered complete.
- **SC-009**: Automated renderer tests verify 100% of the 11 Java menu commands appear in the required order/grouping, the six legacy structural buttons are absent, and every enabled/disabled state matches the target cell, buffer contents, and minimum grid dimensions.
- **SC-010**: Automated round-trip tests complete Score-to-Live, Live-to-Score, repeated independent paste, and BSB-to-Sound workflows with preserved content, fresh identities, no shared mutable references, and no mutation on incompatible payloads.
- **SC-011**: Automated tests complete 100% of populated-cell, empty-cell, moved-cell, removed-cell, type-specific edit, and shared-property edit scenarios with the correct editor/property target and zero mutation through stale targets.

## Assumptions

- The current dedicated Blue Live engine and existing Live Space authoring shell remain the foundation for this pass.
- Main-process `BlueData` remains canonical, `.blue` XML remains the only project persistence, and no migration is required.
- Existing eligible LiveObject SoundObject types are retained; this feature restores execution where the current TypeScript/host runtime can support them and reports explicit errors otherwise.
- Manual Trigger is the migration baseline needed before designing the new launcher. Legacy audible Repeat is intentionally deferred to a later compatibility adapter or scheduler decision.
- UI changes remain limited to Java-parity Trigger behavior, the Java-compatible Live Space cell menu, Live SoundObject editor/property selection, shared-buffer interoperability, and communicating transient success/failure/deferred Repeat state.
- The detailed future launcher direction remains documented in `BLUE_LIVE_FEATURE_PLAN.md` and is not implemented by this feature.

## Out of Scope

- Audible global Repeat playback or bug-for-bug emulation of Java Repeat timing.
- Key-trigger or per-LiveObject MIDI-trigger execution.
- SCO Pad, nested SoundObject editing, drag-and-drop, cell reordering, multi-cell selection, and duplicate commands beyond the specified context-menu and shared-buffer workflows.
- A versioned launcher data model, track/scene semantics, per-track exclusivity, stop slots, launch quantization, clip loops, follow actions, performance capture, or arrangement conversion.
- Reinterpreting legacy rows as tracks, columns as scenes, enabled flags as playing state, or saved sets as scenes.
