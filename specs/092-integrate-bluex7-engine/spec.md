# Feature Specification: Modern BlueX7 Engine and Automation

**Feature Branch**: `092-integrate-bluex7-engine`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Review `~/work/csound/dx7-emulation/bluex7_integration_report.md`. Create a branch and a spec for integrating the work in dx7-emulation `bluex.orc` into this project's BlueX7. Integrate the Parameter system so widget values can be modified and automated with real-time updates. Account for the resulting UI-to-engine mapping and for multiple BlueX7 instruments in one project."

**Reference Review**: The supplied artifacts were found as `blue_integration_report.md` and `bluex7.orc`. Their implications, the existing BlueX7 and Parameter paths, and the multi-instance design constraints are summarized in [research.md](research.md).

## Clarifications

### Session 2026-08-27

*Answers recorded from the recommendations documented in [research.md](research.md) during an unattended clarification pass; amend any bullet here if the project owner decides differently.*

- Q: Is algorithm switching (with oscillator key sync and LFO key sync) next-note or active-note? → A: Next-note: algorithm, oscillator key sync, and LFO key sync apply from the next triggered note; all other sound controls update active notes.
- Q: What deterministic rule resolves mixed legacy per-operator values for the editor-shared oscillator key sync and pitch modulation sensitivity controls? → A: Logical operator 1's stored value is the effective value; editing the shared control writes the new value to all six per-operator values as one undoable project mutation.
- Q: Do SysEx import and whole-voice replacement retain existing automation curves? → A: Yes: Parameter identities, automation assignments, and existing curves are retained; only fixed values change, in the same atomic operation as the voice.
- Q: How many concurrent BlueX7 instances must be supported? → A: No hard cap; the four-instance project in SC-004 (two arrangement, two Track-owned) is the validated concurrency floor.
- Q: What is the numeric timing tolerance for automated playback matching in SC-003? → A: One engine control interval plus 50 milliseconds (one 20 Hz display sampling period, matching FR-014).
- Q: What is the source relationship to `dx7-emulation`? → A: Treat it as a transient precursor, not an upstream runtime or build dependency. Import only the reviewed, checksum-pinned `bluex7.orc` as the starting source maintained by this project; do not import its ROM bank, demos, renders, or unrelated tooling. Preserve attribution to the relevant MSFA, Dexed, legacy Blue/Pinkston, and precursor work where applicable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play Complete BlueX7 Voices Through the Modern Renderer (Priority: P1)

A composer uses an existing or newly created BlueX7 instrument and hears the complete stored voice—including oscillator frequency ratios, keyboard scaling, LFO, pitch envelope, modulation sensitivities, operator enables, and all 32 algorithms—through the modern DX7 renderer.

**Why this priority**: The current renderer ignores many values already exposed by the editor. Complete voice-to-sound mapping is the foundation for meaningful live editing and automation.

**Independent Test**: Load representative voices that exercise all parameter groups and materially different algorithms, play identical notes through each voice, and verify that every sound-affecting control reaches the renderer with its documented value and produces the expected modern-renderer result.

**Acceptance Scenarios**:

1. **Given** a BlueX7 voice with non-default frequency, keyboard-scaling, LFO, pitch-envelope, and modulation values, **When** the instrument plays, **Then** all of those values participate in the rendered sound rather than being stored-only editor data.
2. **Given** any algorithm from 1 through 32, **When** a note is played, **Then** the matching operator topology and enabled-operator state are used.
3. **Given** Blue's supported pitch convention and a velocity value, **When** a score or live note reaches BlueX7, **Then** pitch and velocity retain their established musical meaning at the renderer boundary.
4. **Given** a note with a finite gate duration, **When** it is released, **Then** the modern envelope release completes without truncation, a stuck note, or extending unrelated notes.
5. **Given** user-authored BlueX7 post-processing code, **When** the instrument is generated, **Then** the modern voice output reaches that code at the same user-visible stage as before.

---

### User Story 2 - Edit a Running BlueX7 in Real Time (Priority: P1)

A sound designer changes BlueX7 controls while playback or Blue Live is running and hears the selected instrument respond without stopping or rebuilding the session. The open editor shows the current effective value, including values driven by automation.

**Why this priority**: The requested Parameter integration is valuable only if editor gestures and automated values reach the active engine predictably and promptly.

**Independent Test**: Sustain a note, edit representative continuous, discrete, envelope, modulation, and operator-enable controls, and confirm the intended active-note or next-note response, visible value feedback, and absence of runtime failure.

**Acceptance Scenarios**:

1. **Given** automation is disabled for a parameter, **When** the user changes its widget during active playback, **Then** the canonical project value and the selected BlueX7's engine value update within the real-time response target without affecting another instrument.
2. **Given** an active note and a parameter defined as active-note capable, **When** its widget changes, **Then** the sounding note reflects the new value without retriggering or recompiling the project.
3. **Given** a parameter whose musical meaning begins at note initialization, **When** it changes during playback, **Then** the next note uses the new value without recompilation and the editor clearly identifies that next-note behavior.
4. **Given** an operator or pitch-envelope stage is already progressing, **When** its current or future rate/level changes, **Then** the remaining envelope follows the new setting without replaying completed stages.
5. **Given** automation is actively controlling a parameter, **When** the editor is open, **Then** its widget displays the effective automated value without rewriting the stored automation curve or fixed value.
6. **Given** automation is active and the user edits the corresponding widget, **When** playback continues, **Then** automation remains authoritative; the UI does not present a transient manual value as though it had replaced the curve.

---

### User Story 3 - Automate BlueX7 Parameters on the Score Timeline (Priority: P1)

A composer finds BlueX7 controls in the existing automation chooser, draws or edits automation, and receives the same result in real-time playback, Blue Live, disk render, export, save, and reopen.

**Why this priority**: Automation is an explicit requirement and must be one coherent feature rather than a live-control-only shortcut.

**Independent Test**: Assign representative common, LFO, pitch-envelope, operator, and operator-enable parameters to automation lines; edit their curves; then compare live playback, a disk render, and a reopened project.

**Acceptance Scenarios**:

1. **Given** an arrangement-owned BlueX7, **When** the automation chooser opens, **Then** all 151 numeric and boolean BlueX7 controls are available in understandable Common, LFO, Pitch Envelope, and Operator 1–6 groups.
2. **Given** a Track-owned BlueX7, **When** automation is chosen for that Track, **Then** the Track's own parameters are available and are not presented as targets belonging to another Track.
3. **Given** automation on an integer or categorical control, **When** the curve is evaluated, **Then** values remain within the control's domain and categorical values change only at valid discrete boundaries.
4. **Given** an enabled automation curve, **When** playback crosses its points, **Then** the effective value reaches the intended BlueX7 with the same timing and quantization semantics used by the existing Parameter system.
5. **Given** the same automated project, **When** it is rendered to disk or exported, **Then** the parameter sequence is musically equivalent to real-time playback within the documented timing tolerance.
6. **Given** automation is disabled or removed, **When** playback continues, **Then** the parameter returns to its current fixed value and no stale engine automation remains.
7. **Given** a project with BlueX7 automation, **When** it is saved and reopened, **Then** parameter identities, fixed values, enabled states, resolutions, line colors, curves, points, and layer assignments remain intact.

---

### User Story 4 - Use Multiple Independent BlueX7 Instruments (Priority: P1)

A composer can use several BlueX7 instruments—including arrangement instruments and Track-owned instruments—with different voices, live edits, and automation, without values or sound leaking between instances.

**Why this priority**: Repeated parameter names and shared synthesis resources make cross-instance collisions a central correctness risk, not an optional scaling concern.

**Independent Test**: Create at least two arrangement BlueX7 instruments and two Track-owned BlueX7 instruments, give them different voices and automation, play them concurrently, and repeatedly edit each one while monitoring all four outputs and editors.

**Acceptance Scenarios**:

1. **Given** multiple BlueX7 instruments with identical display names, **When** one widget or automation line changes, **Then** only the instance identified by its project assignment or Track ownership changes.
2. **Given** a copied, pasted, or library-instantiated BlueX7, **When** it enters a project, **Then** it has independent Parameter identities while preserving the copied voice and automation content appropriate to the copy operation.
3. **Given** several BlueX7 instruments rendering concurrently, **When** they use different algorithms, voices, operator masks, and automation, **Then** shared synthesis resources are reused safely while all mutable voice state remains instance-scoped.
4. **Given** an instrument is deleted, disabled, reordered, or replaced before a later playback session, **When** the engine is prepared again, **Then** surviving instruments retain correct Parameter-to-engine routing and no removed instance receives updates.
5. **Given** two BlueX7 editors are open against different canonical owners, **When** both are edited rapidly, **Then** patch ordering, visible values, local undo history, and runtime updates remain isolated by owner.

---

### User Story 5 - Migrate Existing Projects Deliberately and Safely (Priority: P2)

A composer opens a Java-created or earlier TypeScript Blue project, keeps all BlueX7 voice data, and receives the modern sound behavior and automation support without hidden data loss. The user can distinguish this intentional sound-engine change from a compatibility defect.

**Why this priority**: The modern renderer is not sample-compatible with the legacy Pinkston-derived path; that difference must be an explicit, tested product decision.

**Independent Test**: Load representative legacy projects and SysEx voices, save/reopen them, compare voice data structurally, and compare both the documented modern output and known intentional differences from the legacy renderer.

**Acceptance Scenarios**:

1. **Given** a BlueX7 instrument without Parameter metadata, **When** it is loaded, **Then** the system creates a complete Parameter set from the voice without changing known or unknown voice data.
2. **Given** a migrated instrument is saved and reopened in the TypeScript application, **When** no edits were made, **Then** all prior voice fields and unknown XML remain intact and the generated Parameter identities are stable after their first save.
3. **Given** an imported Yamaha DX7 voice, **When** import completes, **Then** the whole voice and its fixed Parameter values change as one operation; cancellation or failure changes neither project nor engine state.
4. **Given** a multi-field voice replacement, undo, or redo during playback, **When** it reaches the engine, **Then** listeners observe either the old complete voice or the new complete voice, never a partially applied hybrid.
5. **Given** a user compares old and new output, **When** differences arise from the documented renderer migration—including frequency, gain, feedback, envelope, LFO/PEG, or corrected algorithm behavior—**Then** those differences are treated as intentional and are visible in release/migration documentation.

### Edge Cases

- A project contains duplicate BlueX7 names, duplicate arrangement labels, copied Track instruments, or a mix of arrangement and Track ownership.
- A legacy voice contains mixed per-operator oscillator-sync or pitch-modulation-sensitivity values even though the current editor presents those controls as shared.
- Automation supplies a fractional, out-of-range, non-finite, or temporarily stale value to an integer/categorical control.
- An algorithm or other next-note parameter changes while notes from the old value remain active.
- Envelope rates or levels change during attack, decay, sustain, or release, including a release whose new duration exceeds the original estimate.
- A SysEx import, whole-voice undo/redo, or preset replacement changes many parameters while audio is running.
- Playback begins from the middle of an automation curve, loops, seeks, pauses, or restarts after an engine rebuild.
- A parameter is assigned to an automation layer and its owning instrument is later disabled, removed, copied, or replaced.
- Multiple editor windows issue rapid changes while an automation curve controls some of the same parameters.
- The modern renderer reports invalid table data, an unavailable parameter channel, a generation failure, non-finite audio, or an over-range output.
- The project has no mixer, a non-stereo output configuration, or custom BlueX7 post-processing code.
- A legacy Java Blue version opens and saves a TypeScript project containing BlueX7 Parameter metadata that Java does not understand.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST replace the legacy BlueX7 synthesis result with the reviewed modern BlueX7 renderer for project playback, Blue Live, audition paths that use the project instrument, disk render, freeze, and export.
- **FR-002**: The modern renderer MUST consume every sound-relevant value already modeled by BlueX7, including complete operator frequency, keyboard scaling, operator envelopes, LFO, pitch envelope, feedback, transpose, modulation sensitivities, algorithm, and operator-enable state.
- **FR-003**: The system MUST preserve Blue's established score pitch convention, velocity domain, note gate meaning, release behavior, post-processing stage, and mixer/direct-output routing at the new renderer boundary.
- **FR-004**: The shared modern synthesis definition MUST appear only once in a generated performance regardless of the number of BlueX7 instruments, while every mutable voice value and note state MUST remain scoped to the owning instance or note.
- **FR-005**: Each BlueX7 instrument MUST own exactly 151 stable Parameters representing all numeric and boolean editor controls; Csound post-processing text and nonnumeric metadata MUST NOT be treated as Parameters.
- **FR-006**: Parameter names and labels MUST be deterministic, human-readable, and grouped by Common, LFO, Pitch Envelope, and Operator 1–6, while unique identity MUST NOT depend on the instrument's editable display name.
- **FR-007**: Every BlueX7 Parameter MUST define an explicit minimum, maximum, fixed value, integer resolution, default curve behavior, and whether changes apply to active notes or subsequent notes.
- **FR-008**: Boolean and categorical Parameters MUST use discrete transitions; continuous-range integer Parameters MUST never deliver fractional, non-finite, or out-of-domain values to the instrument.
- **FR-009**: A widget edit MUST update the canonical BlueX7 voice and its corresponding fixed Parameter value as one project mutation, except that the active automation curve remains authoritative during automated playback.
- **FR-010**: While real-time playback or Blue Live is active, fixed-value widget edits MUST reach the intended compiled Parameter without stopping or recompiling the session.
- **FR-011**: Active-note-capable changes MUST affect sounding notes within 100 milliseconds of the final input event at the 95th percentile on a supported development machine.
- **FR-012**: Note-initialization changes MUST affect the next triggered note without a project recompile and MUST be identified as next-note behavior wherever the user edits or automates them.
- **FR-013**: Mid-envelope edits MUST update the current or remaining stage behavior without restarting already completed stages; release updates MUST not create stuck notes.
- **FR-014**: When automation is active, an open BlueX7 editor MUST display effective engine-driven values at least 20 times per second while keeping canonical fixed values and automation points unchanged.
- **FR-015**: The automation chooser MUST expose all BlueX7 Parameters in nested, comprehensible groups and MUST disambiguate instruments that share the same display name.
- **FR-016**: Arrangement-owned BlueX7 Parameters MUST be available through the existing instrument automation workflow, and Track-owned BlueX7 Parameters MUST be available to their owning Track's automation workflow.
- **FR-017**: Parameter automation MUST behave consistently across real-time playback, Blue Live, disk rendering, freeze, export, seeking, looping, pause/resume, and nonzero render start times.
- **FR-018**: Enabling, editing, disabling, removing, or clearing BlueX7 automation during real-time playback MUST synchronize the engine and MUST remove stale automation ownership from the affected channel.
- **FR-019**: Each BlueX7 instance MUST receive independent persistent Parameter identities and independent compiled runtime targets, even when instances originated from the same source or have identical names and values.
- **FR-020**: Copy, paste, duplication, Track assignment, and library instantiation MUST regenerate Parameter identities at the new ownership boundary while preserving voice values and eligible automation content without retaining references to the source instance.
- **FR-021**: Compilation and runtime synchronization MUST resolve a Parameter through stable owner identity and Parameter identity or a provably deterministic equivalent; routing MUST NOT rely on display-name uniqueness.
- **FR-022**: Multi-Parameter mutations—including SysEx import, whole-voice replacement, undo, and redo—MUST become visible to the running engine atomically at a control boundary.
- **FR-023**: If a real-time value cannot be applied because its instrument or runtime target is absent or stale, the system MUST fail safely, retain canonical project data, and surface a recoverable diagnostic without writing to another target.
- **FR-024**: Existing BlueX7 project voice data MUST retain its current Java-compatible XML meanings, ordering, defaults, ranges, and preservation of unknown content.
- **FR-025**: Existing BlueX7 instruments without Parameter metadata MUST receive a complete Parameter set without altering voice values; generated identities MUST remain stable after the project is first saved.
- **FR-026**: BlueX7 Parameter metadata MUST persist with the owning instrument and round-trip fixed values, identities, automation state, resolution, curve, points, and line color in the TypeScript application.
- **FR-027**: Mixed legacy per-operator values for editor-shared oscillator sync or pitch-modulation sensitivity MUST remain preserved in voice XML until the user changes the shared control; while mixed values persist, the effective renderer and Parameter value MUST use logical operator 1's stored value, and editing the shared control MUST write the new value to all six per-operator values as one undoable project mutation.
- **FR-028**: The modern renderer integration MUST preserve source attribution, record the exact imported precursor revision and `bluex7.orc` digest, identify subsequent Blue-owned modifications, and include all applicable third-party license notices in distributed source and artifacts.
- **FR-029**: The generated Csound preview and binding report MUST reflect the modern renderer, identify active-note versus next-note controls, and no longer describe modern sound-relevant fields as legacy stored-only values.
- **FR-030**: Output calibration MUST be consistent across all voices, avoid non-finite output, and prevent clipping for the accepted representative test corpus without adding voice-specific hidden gain values.
- **FR-031**: The implementation MUST retain deterministic checks for all 32 algorithms, operator masking, canonical voice mapping, release behavior, and the modern renderer's accepted reference output.
- **FR-032**: The feature MUST include focused multi-instance checks spanning at least two arrangement BlueX7 instruments and two Track-owned BlueX7 instruments under concurrent notes, live edits, automation, copy, save, reopen, and engine rebuild.
- **FR-033**: Known modern-renderer limitations—such as note-start-only sync behavior, per-note rather than globally shared LFO behavior, approximate amplitude modulation, and modern rather than legacy PCM behavior—MUST be documented and MUST NOT be represented as legacy parity.
- **FR-034**: SysEx import and whole-voice replacement MUST retain Parameter identities, automation assignments, and existing automation curves; only fixed values change, applied in the same atomic operation as the voice.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: The reviewed `dx7-emulation/bluex7.orc` modern voice renderer and the findings established by its validation corpus are the starting synthesis reference; the corpus itself is not imported and Blue supplies its own focused tests. Java Blue's `BlueX7` model, XML, editor ranges, SysEx mapping, pitch convention, post-code stage, and legacy orchestra remain the data/workflow reference and comparison baseline.
- **Compatibility Requirements**: Existing `.blue` XML remains canonical for voice and Parameter data. Known and unknown BlueX7 voice content must survive load/save. Existing score notes keep their pitch, velocity, gate, assignment, and routing meaning. Parameter curves retain the application's current timing and quantization semantics.
- **Intentional Divergences**: Sound output intentionally changes from the Pinkston-derived renderer to the modern msfa/Dexed-oriented model. Algorithms 6 and 20 use the corrected modern routing. Frequency, detune, gain, velocity, envelope, feedback, oscillator, LFO/PEG, note-tail, and normalization behavior are not expected to be legacy PCM-compatible. BlueX7 Parameter metadata is a TypeScript Blue extension that older Java Blue versions may discard if they save the project; the compatible voice data must remain readable.
- **State Ownership**: The main-process active project document owns each arrangement or Track BlueX7 voice and its Parameters, persisted in `.blue` XML. Score layers own only Parameter identity references. The engine owns disposable compiled channel names, transport tables, live automation execution, and effective-value mirrors for one performance generation. Renderer controls, polling snapshots, preview text, and editor undo history are disposable session state. Library editors own drafts until Save; copied library content receives new project identities when instantiated.

### Key Entities *(include if feature involves data)*

- **BlueX7 Instrument Instance**: One arrangement-owned, Track-owned, or library-draft instrument with a voice, Parameter collection, post-processing code, and stable owner identity appropriate to its store.
- **BlueX7 Voice**: The canonical common, LFO, six-operator, pitch-envelope, and operator-enable values preserved in project XML.
- **BlueX7 Parameter**: One automatable numeric or boolean projection of a voice control, with stable identity, range, resolution, fixed value, curve, points, line color, and active-note/next-note behavior.
- **Compiled BlueX7 Target**: Disposable performance-specific routing that binds one project Parameter to one engine value for exactly one instrument instance and engine generation.
- **Voice Transport Snapshot**: Disposable, complete engine-facing representation of one BlueX7 voice. It is derived from canonical voice and Parameter values and is never a second persistent preset.
- **Automation Assignment**: A score-layer reference to a Parameter identity. Arrangement parameters follow existing instrument automation ownership; Track-instrument parameters belong to their owning Track.
- **Effective Runtime Value**: The value currently used by the engine after fixed-value or automation authority is resolved; it may be displayed in an open editor but is not persisted as a second project value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every BlueX7 instance, a catalog check finds exactly 151 distinct Parameters with correct labels, domains, integer resolution, fixed values, and mappings to all 145 voice transport values plus six operator-enable values.
- **SC-002**: In real-time tests, at least 95% of active-note widget changes become effective and visible within 100 milliseconds of the final input event, with no project recompile or transport restart.
- **SC-003**: Automated playback matches the authored value at 100% of sampled points and transitions within one engine control interval plus 50 milliseconds (one 20 Hz display sampling period, matching FR-014); equivalent disk renders pass the same value-sequence assertions.
- **SC-004**: A four-instance validation project—two arrangement instruments and two Track instruments—runs at least 32 concurrent notes for 60 seconds while 600 instance-targeted edits/automation updates produce zero cross-instance value changes, stuck notes, non-finite samples, or engine errors.
- **SC-005**: Save/reopen and copy/paste tests retain 100% of voice and automation content while preserving identities for the same owner and producing disjoint Parameter identity sets for new owners.
- **SC-006**: Whole-voice import, replacement, undo, and redo tests observe zero partially applied runtime snapshots across at least 100 repeated operations during playback.
- **SC-007**: All 32 algorithms render successfully; documented carrier routing, corrected algorithms 6 and 20, zero-mask silence, release completion, and accepted modern reference-output checks pass.
- **SC-008**: Representative legacy Java/TypeScript projects and supported SysEx fixtures retain 100% of known voice values and preserved unknown XML after migration and reopen; intentional sonic differences are documented rather than counted as data loss.
- **SC-009**: A user can find any BlueX7 automation target in no more than three chooser interactions, including when at least four same-named BlueX7 instances exist.

## Assumptions

- The files intended by the request are the local `blue_integration_report.md` and `bluex7.orc`; the names in the request differ from the files present in the referenced checkout.
- The reviewed modern renderer, rather than the Pinkston-derived Java Blue orchestra, is the accepted future sound behavior. Legacy PCM preservation or a user-selectable legacy engine is outside this feature.
- All existing numeric and boolean BlueX7 controls are automatable, yielding 151 Parameters per instance. Nonnumeric name, comment, post-processing code, editor navigation, and import state are outside the Parameter set.
- Algorithm, oscillator key sync, and LFO key sync are classified as next-note; all other sound controls are expected to update active notes. The classification catalog is documented and tested rather than inferred by individual callers.
- When automation is enabled, the automation curve owns the effective playback value. Direct widget edits change the canonical fixed/base value but do not silently disable or overwrite the curve; authoring automation remains a timeline operation.
- The editor may sample effective engine values for display; those samples are disposable and must never become project mutations.
- Adding, removing, or replacing an entire instrument while a performance is already running may still require the application's existing engine rebuild workflow. Value changes for an instrument compiled into the current performance do not.
- Library drafts persist BlueX7 Parameter content only when explicitly saved. Instantiating or copying into a new project owner regenerates identities to prevent collisions.
- The system supports any number of BlueX7 instances within available resources; the four-instance project defined in SC-004 is the validated concurrency floor, not a hard cap.
- Older Java Blue versions are expected to preserve or read the established BlueX7 voice fields but do not support the new Parameter metadata; saving through an older Java version may remove BlueX7 automation metadata and must be documented.
- The project owner authorizes importing the original `dx7-emulation` precursor work into Blue. Applicable third-party notices and attribution still accompany the imported/adapted source. No ROM voice bank or other precursor-repository asset is required or imported.
