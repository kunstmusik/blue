# Feature Specification: Focused MIDI Instrument Routing

**Feature Branch**: `067-midi-focus-routing`

**Created**: 2026-08-06

**Status**: Complete

**Completed**: 2026-08-06

**Input**: User description: "Handle MIDI routing to Track instruments or Orchestra instruments using focus. Review the seeded research, perform additional research, and use Spec Kit to develop the implementation plan and tasks."

## Clarifications

### Session 2026-08-06

- Q: When the focused target has no eligible instrument or is unavailable, what user feedback should accompany the rejected note? → A: Silent rejection (no visible feedback; note simply produces no sound).
- Q: When Blue Live stops and restarts, should the focused target persist or clear? → A: Persist across restart (focus survives if the target still exists in the new session).
- Q: What is the maximum acceptable latency for focused routing? → A: No specific target (retain qualitative "no perceptible interaction delay" only).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play the Focused Track Instrument (Priority: P1)

As a composer working in the Score, I want the Virtual Keyboard and my enabled MIDI controller to play the instrument owned by the Track I most recently focused, so I can audition and perform a Track without mapping it to one of sixteen channels.

**Why this priority**: Track instruments are the new default project workflow, but they currently have no realtime note-input path. Focus routing supplies the smallest useful bridge from the existing Track model to live performance.

**Independent Test**: Load a project with two Tracks that own audibly distinct instruments, start Blue Live, explicitly focus each Track in turn, and confirm equivalent Virtual Keyboard and hardware note-on/note-off input plays and releases only the focused Track instrument.

**Acceptance Scenarios**:

1. **Given** focused-target routing is active and a Track with an enabled instrument is focused, **When** the user plays and releases a Virtual Keyboard note, **Then** that Track instrument starts and stops using the project's current MIDI pitch and velocity mapping.
2. **Given** the same focused Track and project state, **When** an enabled hardware controller sends the equivalent note, channel, and velocity, **Then** it produces the same focused-instrument result as the Virtual Keyboard.
3. **Given** one Track instrument is sounding, **When** the user focuses another Track and plays a new note, **Then** the new note targets the newly focused Track while the earlier note remains bound to its original Track until released.
4. **Given** a Track has no enabled instrument or is unavailable in the running Blue Live session, **When** it is focused and a note arrives, **Then** no other instrument plays and the note is silently rejected.

---

### User Story 2 - Play the Focused Orchestra Instrument (Priority: P1)

As a composer working in the Orchestra, I want the Virtual Keyboard and my enabled MIDI controller to play the Orchestra assignment I most recently focused, so I can audition named or numbered instruments directly without relying on their sorted position.

**Why this priority**: Focus must describe one coherent performance workflow across both instrument-owning surfaces. Direct assignment identity also avoids the ambiguity of treating a MIDI channel as an array position.

**Independent Test**: Load a project with at least two audibly distinct Orchestra assignments, including a non-consecutive or named assignment when supported, start Blue Live, focus each assignment in turn, and verify both Virtual Keyboard and hardware notes play and release exactly that assignment.

**Acceptance Scenarios**:

1. **Given** focused-target routing is active and an enabled Orchestra assignment is focused, **When** the user plays and releases a note, **Then** the selected assignment starts and stops regardless of its displayed ordering.
2. **Given** a named or non-consecutively numbered Orchestra assignment is focused, **When** a note arrives, **Then** the focused assignment plays rather than the assignment occupying a corresponding list position.
3. **Given** a Track was previously focused, **When** the user explicitly focuses an Orchestra assignment and plays a new note, **Then** the Orchestra assignment becomes the shared target for hardware and Virtual Keyboard input.
4. **Given** the focused assignment is disabled, removed, or absent from the running Blue Live session, **When** a note arrives, **Then** no fallback instrument is triggered and the note is silently rejected.

---

### User Story 3 - Retain Direct MIDI Channel Routing (Priority: P2)

As a performer with an existing channel-based or multi-timbral setup, I want to switch from focus routing to direct-channel routing, so projects that intentionally use MIDI channels continue to work without being rebuilt around Track focus.

**Why this priority**: Focus is the new default interaction, but established Blue Live projects and multi-channel controllers still need the explicit routing behavior introduced by the existing Virtual Keyboard and hardware MIDI features.

**Independent Test**: Start Blue Live with distinct instruments reachable through two existing channel assignments, switch to direct-channel routing, send Virtual Keyboard and hardware notes on both channels, and confirm the same assignments and project mappings used before this feature still apply.

**Acceptance Scenarios**:

1. **Given** direct-channel routing is active, **When** the Virtual Keyboard sends a note, **Then** its visible channel selection determines the target using the existing channel-routing behavior.
2. **Given** direct-channel routing is active, **When** hardware MIDI arrives, **Then** the message's native MIDI channel determines the target using the existing channel-routing behavior.
3. **Given** a focused Track or Orchestra assignment exists, **When** direct-channel routing is active, **Then** that focus does not override the explicit channel target.
4. **Given** a direct channel has no usable assignment, **When** a note arrives, **Then** no different assignment plays and the note is silently rejected.

---

### User Story 4 - Keep Realtime Notes Safe Across Focus And Session Changes (Priority: P2)

As a live performer, I need target changes, device cleanup, project changes, and Blue Live restarts to release the correct notes, so focus routing never creates collisions or stuck sound.

**Why this priority**: A focus-aware router introduces target identity beyond channel identity. Safe note ownership and cleanup are required before the feature can be trusted during performance.

**Independent Test**: Hold the same pitch from multiple input sources across two different focused targets, change focus between note-on and note-off, disconnect one source, stop/restart Blue Live, and change projects; confirm each target receives the correct lifecycle and no note remains sounding or tracked.

**Acceptance Scenarios**:

1. **Given** a note was started on one focus target, **When** focus changes before its matching note-off, **Then** the note-off is delivered to the original target rather than the new focus target.
2. **Given** the same pitch is held on two different explicit targets, **When** one is released, **Then** the other target remains active and neither note collides merely because the MIDI channel and pitch match.
3. **Given** multiple sources hold the same pitch on the same target, **When** one source releases or disconnects, **Then** the aggregate note remains active until the final source releases it.
4. **Given** Blue Live stops, restarts, the project changes, or the input service shuts down, **When** cleanup runs, **Then** all held-note state is cleared without late events reaching a new session, while the focused target identity persists across Blue Live restarts if the target still exists in the new session.

### Edge Cases

- Focus mode is active before any eligible Track or Orchestra assignment has been explicitly focused.
- The focused Track exists but owns no instrument, owns a disabled instrument, or was changed after the active Blue Live session was compiled.
- The focused Orchestra assignment is disabled, removed, renamed, or not present in the active compiled session.
- Focus moves while one or more notes are held, including the same pitch from more than one hardware or virtual source.
- A target disappears after note-on but before note-off.
- A project contains more than sixteen Tracks or non-consecutive and named Orchestra assignment identifiers.
- The same note and channel are active on different target identities.
- Direct-channel mode is selected while no assignment is available for an incoming channel.
- The project changes while the previous project's focus target or held notes still exist.
- Blue Live is stopped or starting when the user focuses a target or sends notes (focus persists across restart; held notes are cleared).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST provide one shared realtime MIDI routing mode with `Focused Target` as the default and `Direct Channel` as an explicit alternative.
- **FR-002**: The active routing mode MUST apply consistently to enabled hardware MIDI inputs and the Virtual Keyboard.
- **FR-003**: In focused-target mode, the last explicitly focused eligible Track or Orchestra assignment MUST be the sole destination for new note-on events.
- **FR-004**: Explicitly selecting a Track row, a Track timeline location or object, or its instrument control MUST make that Track the focused MIDI target without requiring a persisted routing assignment.
- **FR-005**: Explicitly selecting an Orchestra assignment MUST make that exact assignment the focused MIDI target.
- **FR-006**: The application MUST visibly distinguish the focused MIDI target and display its kind and human-readable name wherever the routing mode is controlled.
- **FR-007**: A focused Track MUST be addressed by its stable Track identity rather than row position, name, or MIDI channel.
- **FR-008**: A focused Orchestra instrument MUST be addressed by its stable assignment identity rather than sorted list position or MIDI channel.
- **FR-009**: A focused Track note MUST resolve to the runtime instrument compiled for that Track in the active Blue Live session.
- **FR-010**: A focused Orchestra note MUST resolve to the matching enabled assignment compiled in the active Blue Live session.
- **FR-011**: Track-to-runtime-instrument resolution MUST be captured from the same disposable compilation used to start Blue Live and MUST NOT be written into the project document.
- **FR-012**: When focused-target mode has no eligible focus, the focused target has no enabled instrument, or the target is unavailable in the active session, incoming notes MUST be silently rejected without falling back to a channel or another focused target.
- **FR-013**: The target chosen for a successful note-on MUST remain attached to that held note until its matching note-off or cleanup, even if focus or routing mode changes.
- **FR-014**: Held-note aggregation MUST distinguish target identity and pitch so equal channel-and-pitch input routed to different targets cannot collide.
- **FR-015**: Source-scoped held-note behavior MUST remain idempotent and MUST continue to prevent duplicate note-on submissions for the same source note.
- **FR-016**: Multiple sources holding the same target and pitch MUST continue to produce one aggregate sounding note until the final source releases it.
- **FR-017**: Source release, device disable/disconnect, all-notes-off, project replacement, renderer shutdown, and app exit MUST clear focused and direct-channel held notes deterministically. Blue Live stop/restart MUST clear held notes but MUST preserve the focused target identity.
- **FR-018**: Direct-channel mode MUST retain the existing Virtual Keyboard channel selector and its current zero-based internal / one-based displayed range.
- **FR-019**: In direct-channel mode, hardware messages MUST use their native MIDI channel and Virtual Keyboard messages MUST use the user's selected channel.
- **FR-020**: Direct-channel mode MUST preserve the existing project assignment behavior and MUST reject unmapped channels without choosing a different instrument.
- **FR-021**: Project MIDI pitch, scale, and velocity processing MUST be applied identically after a Track, Orchestra, or direct-channel target has been selected.
- **FR-022**: The focused-target mode, focused target, and target display state MUST be transient application-session state and MUST NOT alter `.blue` XML, app-wide settings, or instrument/Track data.
- **FR-023**: Switching projects MUST clear the previous project's focused target and held-note state before notes can enter the new project session.
- **FR-024**: Starting or recompiling Blue Live MUST replace the prior runtime target map atomically; failed starts MUST leave no partially usable target map. The focused target identity MUST persist across restarts if the target remains eligible in the new session.
- **FR-025**: A failed, stale, malformed, disabled, or unresolved target request MUST be silently rejected and MUST NOT submit a score event to a different instrument.
- **FR-026**: Existing non-note message deferrals, MIDI device preferences, Virtual Keyboard octave/velocity behavior, project MIDI mapping, and Blue Live start/stop behavior MUST remain unchanged except where target selection is explicitly defined above.
- **FR-027**: Per-Track input-device filters, record arming, channel demultiplexing across multiple Tracks, MIDI recording, MIDI output, controller changes, pitch bend, aftertouch, program changes, MPE, and dormant Blue Live object trigger metadata are outside this feature.
- **FR-028**: Automated verification MUST cover Track and Orchestra focus selection, direct-channel compatibility, target-specific note aggregation, note-off stability across focus changes, runtime-target-map lifecycle, invalid-target failures, and project/session cleanup.
- **FR-029**: Deterministic manual validation MUST demonstrate equivalent Virtual Keyboard and hardware behavior for focused Track, focused Orchestra, and direct-channel targets.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue's Virtual Keyboard and MIDI input use explicit channels and provide the compatibility reference for key, velocity, channel range, and all-notes-off behavior. Current TypeScript Specs 033 and 058 are the reference for shared Virtual Keyboard/hardware routing and source-scoped cleanup. Spec 066 is the reference for stable Track identity and Track-owned instruments. Focus-based targeting is a new TypeScript workflow informed by current Logic Pro, Ableton Live, Cubase, and REAPER track-routing conventions.
- **Compatibility Requirements**: Existing channel-based Blue Live projects, project MIDI pitch/velocity mappings, Java-compatible Orchestra assignment data, `.blue` XML, device settings, and non-note deferrals MUST remain intact. Runtime Track identifiers and focus state MUST remain derived and disposable.
- **Intentional Divergences**: Focused target routing becomes the new app-session default even though Java Blue exposes channel routing only. Direct-channel mode remains available for Java-style and multi-timbral workflows. Track targeting has no Java equivalent because canonical Track instruments are a post-Java TypeScript feature.
- **State Ownership**: Electron main remains the canonical owner of active `BlueData` and the compiled Blue Live session. The primary renderer owns the transient routing mode and focused target; the shared renderer note router owns held-note/source aggregation; the live session owns the disposable compiled target map. No new state is persisted.

### Key Entities

- **MIDI Routing Mode**: Transient choice between following the current focused instrument target and using explicit MIDI channels.
- **Focused MIDI Target**: Stable identity and display metadata for the last explicitly focused Track or Orchestra assignment in the current project session.
- **Compiled Instrument Target**: Runtime association between a focused target identity and the instrument identifier available in the active Blue Live session.
- **Routed MIDI Note**: A normalized hardware or Virtual Keyboard note paired with the target selected when note-on succeeds.
- **Held Note**: Source-owned active note record retaining target identity so later focus changes cannot misroute release or cleanup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of acceptance trials, focusing a Track with an enabled instrument and playing one Virtual Keyboard or hardware note starts and releases only that Track instrument without configuring a MIDI channel assignment.
- **SC-002**: In 100% of acceptance trials, focusing an enabled Orchestra assignment plays that exact assignment, including non-consecutive or named assignments, without dependence on displayed row position.
- **SC-003**: Users can identify the active routing mode and focused target from the routing control area in under five seconds without opening project settings.
- **SC-004**: Existing direct-channel acceptance scenarios from Specs 033 and 058 continue to pass with equivalent target, pitch, velocity, and release results.
- **SC-005**: Across 100 automated target switches and held-note release cycles, no note-off is delivered to a different target from its successful note-on and no sounding or internally tracked note remains after cleanup.
- **SC-006**: Equal pitches routed concurrently to two different targets remain independent in 100% of collision tests, while equal pitches from multiple sources to one target remain correctly reference-counted.
- **SC-007**: Invalid, removed, disabled, stale-session, and unmapped targets produce zero wrong-instrument score submissions in all automated failure-contract tests.
- **SC-008**: Focused routing adds no perceptible interaction delay compared to direct-channel routing under normal use.
- **SC-009**: Focus, router, shared-contract, data-generation, main-session, renderer UI, cleanup, type-check, lint, and build verification all pass before implementation is considered complete.

## Assumptions

- Both enabled hardware MIDI inputs and the Virtual Keyboard follow the same routing mode because they already share one note-routing path.
- The most recently explicitly selected eligible Track or Orchestra assignment is the focused target; merely opening a panel or auto-selecting an editor row does not silently steal performance focus.
- Focus changes affect new notes only. Successfully started notes retain their original target until note-off or deterministic cleanup.
- Routing mode may remain selected for the primary renderer's lifetime, but target identity is cleared on project replacement and no routing state survives an app restart. Focus persists across Blue Live stop/restart cycles.
- A Track instrument changed after Blue Live compilation requires the existing restart/recompile workflow before it becomes an available runtime target.
- Direct-channel compatibility retains current routing semantics in this slice; replacing it with per-Track input filters or a new persisted routing matrix is deferred.
- Existing MIDI pitch and velocity processing is target-independent and remains project-owned.
