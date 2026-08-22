# Feature Specification: BlueX7 Instrument Editor Parity

**Feature Branch**: `081-bluex7-editor-parity`

**Created**: 2026-08-19

**Status**: Complete (2026-08-19)

**Completion note**: The implementation and parity goals defined by this specification are complete. Further BlueX7 enhancements should be specified separately rather than added to this scope.

**Input**: User description: "Deliver full feature parity with the Java Blue BlueX7 instrument editor, while using the visual and interaction standards of the TypeScript Blue application. Include all six FM operators, global algorithm/LFO/PEG controls, Yamaha DX7 SysEx import, and live Csound code integration with parameter binding."

## Clarifications

### Session 2026-08-19

- Q: What undo/redo scope should BlueX7 editing deliver, given the application has no project-level undo infrastructure today? → A: Editor-local undo scoped to the BlueX7 editor session (following the piano roll's local undo precedent); history clears when the editor context is left or reopened, and a SysEx import counts as a single undo step.
- Q: What numeric minimum should "minimum supported orchestra-editor dimensions" be for validation, given no window enforces a minimum today? → A: 1000×760 — the track-instrument-editor window's default size and the smallest standalone surface hosting the instrument editor.
- Q: Which surfaces must receive the full BlueX7 editor, given instrument editing is hosted in three places? → A: All three hosts — the orchestra panel, the track-instrument-editor window, and the library instrument editor — with identical capabilities in each.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Design and Persist a Complete BlueX7 Voice (Priority: P1)

A composer opens a BlueX7 instrument and can inspect and edit every sound-defining parameter exposed by Java Blue: common algorithm settings, all six operators, the pitch envelope, and LFO modulation. Changes become part of the active project and remain intact after save, close, and reopen.

**Why this priority**: Complete sound editing is the central missing capability; without it, BlueX7 data can be preserved but the instrument cannot be designed in the TypeScript application.

**Independent Test**: Open a representative Java-created BlueX7 instrument, change at least one value in every common and operator parameter group plus all four points of an operator envelope and the pitch envelope, save and reopen the project, and verify every value and the resulting sound-definition data are unchanged.

**Acceptance Scenarios**:

1. **Given** a BlueX7 instrument, **When** the user switches among operators 1 through 6, **Then** each operator shows and edits its own oscillator, output, sensitivity, keyboard-scaling, and four-stage envelope values without leaking operator-specific values into another operator.
2. **Given** any operator, **When** the user changes mode, oscillator sync, coarse frequency, fine frequency, detune, output level, velocity sensitivity, amplitude modulation sensitivity, pitch modulation sensitivity, breakpoint, left/right curves, left/right depths, keyboard rate scaling, or an envelope rate/level, **Then** the visible value, underlying project value, and derived Csound representation agree.
3. **Given** a BlueX7 instrument, **When** the user changes key transpose, algorithm, feedback, an operator enable state, LFO controls, or any pitch-envelope point, **Then** the project records the change and the editor immediately reflects it.
4. **Given** Java Blue's shared pitch-modulation-sensitivity and oscillator-sync semantics, **When** the user changes either starred/shared control on one operator, **Then** all six operator views and the saved instrument reflect the shared value.
5. **Given** a valid Java Blue BlueX7 project, **When** it is loaded and saved without edits, **Then** all known BlueX7 values and all unmodeled XML content are preserved without silent loss.

---

### User Story 2 - Understand Algorithms and Envelopes Visually (Priority: P1)

A sound designer can choose among all 32 DX7 algorithms while seeing the corresponding operator-routing topology, and can shape operator and pitch envelopes through a clear graphical editor with precise numeric feedback.

**Why this priority**: FM routing and envelopes are essential to predicting and controlling a six-operator voice; numeric fields alone do not provide Java Blue's usable editing parity.

**Independent Test**: Select each of the 32 algorithms and verify the matching routing topology is displayed, then manipulate every point of an operator envelope and the pitch envelope and verify all rate/level values remain within their documented domains.

**Acceptance Scenarios**:

1. **Given** the common controls, **When** the algorithm changes from 1 through 32, **Then** the corresponding six-operator routing topology changes with it and the chosen number is unambiguous.
2. **Given** an operator or pitch envelope, **When** the user drags a stage point, **Then** the graph, stage rate, and stage level/pitch value update together and remain in the 0–99 range.
3. **Given** a user who prefers precise entry or keyboard operation, **When** the user focuses an envelope stage, **Then** the same values can be changed without requiring pointer dragging.
4. **Given** an enabled or disabled operator, **When** its state changes, **Then** the common panel and algorithm presentation communicate the active routing state without hiding the operator's stored settings.

---

### User Story 3 - Import a Yamaha DX7 Voice (Priority: P2)

A composer imports either a Yamaha DX7 single-voice SysEx file or one voice from a 32-voice bank into the selected BlueX7 instrument, previews the choice before committing, and receives a useful error when the file is not supported.

**Why this priority**: Existing DX7 patch libraries are a primary source of usable voices and Java Blue already supports both canonical file forms.

**Independent Test**: Import a known 163-byte single voice and a selected entry from a known 4,104-byte, 32-voice bank, compare all mapped parameters with Java Blue, and verify cancellation and invalid-file paths do not alter the instrument.

**Acceptance Scenarios**:

1. **Given** a valid 163-byte single-voice SysEx file, **When** the user imports it, **Then** all six operators, pitch envelope, algorithm, feedback, shared oscillator sync, LFO, modulation sensitivity, and key transpose are mapped to the selected BlueX7 instrument exactly as in Java Blue.
2. **Given** a valid 4,104-byte bank, **When** the user opens it, **Then** all 32 ten-character patch names are listed in bank order and the chosen patch is imported.
3. **Given** a bank selection dialog, **When** the user cancels, **Then** no BlueX7 values change.
4. **Given** a missing, unreadable, truncated, unsupported-size, or malformed file, **When** import is attempted, **Then** the user receives a clear recoverable error and the current instrument remains unchanged.
5. **Given** a successful import, **When** the project is saved and reopened, **Then** the imported voice round-trips as Java-compatible BlueX7 project data.

---

### User Story 4 - Inspect and Extend the Generated Csound Instrument (Priority: P2)

A composer can inspect the Csound instrument text produced from the current BlueX7 voice and edit the post-processing code that Java Blue stores with the instrument. Parameter edits are bound to the preview so the displayed generated text never represents a stale voice.

**Why this priority**: BlueX7 is useful in a composition only when its parameters produce compatible Csound output, and advanced users depend on the editable post-code stage.

**Independent Test**: Open the Csound view, change each category that affects generation, verify the preview updates within the target time, edit post code, then save/reopen and compare generated artifacts with Java Blue fixtures for representative algorithms.

**Acceptance Scenarios**:

1. **Given** the Csound view, **When** any sound-defining BlueX7 parameter changes, **Then** the generated instrument preview refreshes automatically without a manual reload.
2. **Given** a change to the selected algorithm, operator enables, operator parameters, LFO, PEG, feedback, or transpose, **When** the preview refreshes, **Then** it incorporates the changed parameter and uses the matching algorithm routing.
3. **Given** editable Csound post code, **When** the user changes it, **Then** the project stores the exact text, the generated output includes it at the same semantic stage as Java Blue, and undo/redo behavior matches other code editors in the application.
4. **Given** a representative Java Blue project and equivalent rendering context, **When** its BlueX7 instrument tables and instrument body are generated, **Then** the TypeScript result is semantically equivalent to Java Blue aside from documented non-semantic formatting differences.
5. **Given** generation cannot complete, **When** the user opens or updates the preview, **Then** the editor shows a useful diagnostic while preserving the current voice and post code.

---

### User Story 5 - Work Efficiently in the TypeScript Blue UI (Priority: P3)

A user can navigate the complete editor at typical desktop sizes using the established Blue visual language, with discoverable sections, readable values, consistent controls, and keyboard-accessible interactions.

**Why this priority**: Java feature coverage should feel native to the current application rather than reproduce Swing styling or layout limitations.

**Independent Test**: Complete the core flows at a 1000×760 editor surface using pointer input and keyboard-only input, verifying that controls remain reachable, labels remain associated with values, and focus is visible.

**Acceptance Scenarios**:

1. **Given** the BlueX7 editor, **When** the user moves among Instrument, six operator, PEG, and Csound surfaces, **Then** the active context and unsaved edits remain stable.
2. **Given** limited panel space, **When** the editor is resized, **Then** every control remains reachable through adaptive layout or scrolling without overlapping or clipping critical content.
3. **Given** keyboard-only navigation, **When** the user traverses controls and dialogs, **Then** focus order is logical, focus is visible, controls have accessible names, and all editing/import actions are operable.
4. **Given** the current TypeScript Blue theme, **When** the editor is displayed, **Then** typography, spacing, colors, tabs, buttons, code editing, and focus/hover/disabled states match established application conventions.

### Edge Cases

- Existing project values at every valid minimum and maximum remain editable and round-trip without coercion; values outside valid domains are reported or safely normalized without corrupting neighboring data.
- Switching instruments, operator tabs, or main editor tabs during an in-progress control edit does not apply the value to the wrong instrument or operator.
- Rapid slider, numeric, or envelope dragging updates coalesce cleanly: the final persisted value and preview equal the final displayed value.
- Resizing an envelope editor does not change its stored four-stage values.
- An imported bank may contain padded, blank, or non-printable patch-name bytes; the chooser presents a stable, distinguishable entry for every bank slot.
- Import is atomic: failure during validation or mapping leaves the current instrument untouched.
- Saving after editing modeled fields preserves unrelated and future-version BlueX7 XML children.
- Csound post code containing Unicode, line-ending variations, or an empty string round-trips without unintended alteration.
- A generation failure or temporarily unavailable rendering context does not prevent continued parameter editing or project saving.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor MUST expose separate, clearly identified editing contexts for all six FM operators and a pitch envelope, while retaining edits when contexts change.
- **FR-002**: Each operator MUST support oscillator mode (`Ratio` or `Fixed (Hz)`), oscillator sync (`Off` or `On`), coarse frequency (0–31), fine frequency (0–99), and detune (-7–7).
- **FR-003**: Each operator MUST support output level (0–99), velocity sensitivity (0–7), amplitude modulation sensitivity (0–3), and pitch modulation sensitivity (0–7).
- **FR-004**: Each operator MUST support keyboard breakpoint (the 100 note positions from A-1 through C8), left and right scaling curves (`-Lin`, `-Exp`, `+Exp`, `+Lin`), left and right scaling depths (0–99), and keyboard rate scaling (0–7).
- **FR-005**: Each operator MUST expose a four-stage envelope in which every stage has a rate and level from 0–99, with synchronized graphical and precise-value editing.
- **FR-006**: The pitch envelope generator MUST expose four stages with rate and pitch values from 0–99, with synchronized graphical and precise-value editing.
- **FR-007**: Common controls MUST include key transpose across C1–C5, algorithm selection from 1–32, feedback from 0–7, and independent enabled/disabled state for each of the six operators.
- **FR-008**: Every algorithm selection MUST display the corresponding operator-routing topology and distinguish active from disabled operators without modifying disabled operators' stored settings.
- **FR-009**: LFO controls MUST include speed, delay, pitch modulation depth, and amplitude modulation depth from 0–99; wave selection (`Triangle`, `Saw Down`, `Saw Up`, `Square`, `Sine`, `S/Hold`); and sync (`Off` or `On`).
- **FR-010**: Pitch modulation sensitivity and oscillator sync MUST retain Java Blue's instrument-wide shared semantics across all six operator editing contexts.
- **FR-011**: All parameter changes MUST mutate the canonical active project through the existing document editing workflow and MUST participate in the application's normal project dirty-state, save, and reopen behavior. Undo/redo MUST be scoped to the BlueX7 editor session (history clears when the editor context is left or reopened), and a SysEx import MUST be a single undo step.
- **FR-012**: The system MUST load, model, deep-copy, edit, and save the complete Java Blue BlueX7 data set: common settings, LFO, six operators, four envelope points per operator, four pitch-envelope points, and Csound post code.
- **FR-013**: Loading and saving MUST retain any unmodeled or future-version BlueX7 XML data that the editor does not understand.
- **FR-014**: The import flow MUST accept Yamaha DX7 single-voice SysEx files of 163 bytes and 32-voice bank files of 4,104 bytes, matching the formats recognized by Java Blue.
- **FR-015**: A bank import MUST display all 32 patch names in source order, allow exactly one patch to be chosen, and allow cancellation without mutation.
- **FR-016**: SysEx mapping MUST reproduce Java Blue's operator ordering, packed-bit decoding, value transforms, global/shared parameter propagation, and key-transpose behavior for both supported file forms.
- **FR-017**: SysEx validation and mapping MUST complete before any project mutation; any read, validation, or mapping error MUST leave the selected BlueX7 instrument unchanged and explain how the user can recover.
- **FR-018**: A read-only Csound preview MUST show the generated instrument representation for the current BlueX7 state and refresh within 500 milliseconds after the final event in a user edit sequence.
- **FR-019**: The generated instrument, required tables, algorithm routing, parameter substitutions, and post-code placement MUST be semantically compatible with Java Blue for equivalent BlueX7 data and generation context.
- **FR-020**: Users MUST be able to edit Csound post code with the same code-editing, accessibility, and undo/redo expectations as other Csound editors in the application, and the exact text MUST persist with the instrument.
- **FR-021**: Preview or generation errors MUST be visible and actionable without discarding parameter changes or preventing project persistence.
- **FR-022**: The editor MUST use current TypeScript Blue visual tokens and interaction conventions rather than Java Swing styling, while preserving Java Blue's feature set and recognizable parameter terminology.
- **FR-023**: All controls, graphs, tabs, and dialogs MUST be operable by keyboard, expose accessible names and current values, show visible focus, and avoid relying on color alone to communicate state.
- **FR-024**: At a 1000×760 editor surface (the smallest supported instrument-editing surface), all parameter groups and actions MUST remain reachable without content overlap or irreversible layout clipping.
- **FR-025**: The feature MUST include deterministic parity coverage using representative Java Blue project and generated-Csound fixtures plus supported single-voice and bank SysEx fixtures.
- **FR-026**: The complete BlueX7 editor MUST be available in every surface that hosts instrument editing today — the orchestra panel, the track-instrument-editor window, and the library instrument editor — with identical capabilities in each.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue's `BlueX7`, `AlgorithmCommonData`, `LFOData`, `Operator`, and `EnvelopePoint` models; `BlueX7Editor` and its BlueX7 subpanels; `BlueX7SysexReader`; `BlueX7ImportDialog`; bundled 32 algorithm diagrams and algorithm orchestra resources; and representative Java-created BlueX7 projects and generated Csound artifacts.
- **Compatibility Requirements**: Existing `.blue` XML is canonical. Known values MUST retain Java meanings, ordering, defaults, ranges, shared-control behavior, and generated-sound semantics. Unknown BlueX7 project content MUST survive round trips. Supported DX7 SysEx files MUST decode to the same voice state as Java Blue.
- **Intentional Divergences**: Visual styling, layout, responsive behavior, precise numeric envelope editing, accessible keyboard interaction, atomic import validation, and a live read-only generated-Csound preview intentionally follow modern TypeScript Blue conventions. These additions do not change stored project meaning or generated sound. Non-semantic Csound whitespace may differ only when parity tests establish semantic equivalence.
- **State Ownership**: The active main-process project document remains the canonical owner of BlueX7 parameters and Csound post code, persisted only in `.blue` XML. Open tabs, focused operator, dialog state, preview text, validation messages, and derived algorithm/envelope visuals are disposable renderer session state. Selected SysEx file bytes are transient host-owned import input and are not persisted.

### Key Entities *(include if feature involves data)*

- **BlueX7 Instrument**: One project instrument containing identity/comment metadata, common routing settings, LFO settings, six ordered operators, a four-stage pitch envelope, and Csound post code.
- **Operator**: One of six ordered FM units, with oscillator, level, sensitivity, keyboard scaling, enable-routing relationship, and a four-stage amplitude/index envelope.
- **Envelope Stage**: An ordered pair of rate and target level/pitch values, each in the 0–99 domain; four stages form an operator envelope or pitch envelope.
- **Algorithm**: One of 32 defined six-operator routing topologies, paired with feedback and six operator enable states.
- **LFO**: Global modulation state comprising speed, delay, pitch/amplitude depths, waveform, and sync.
- **DX7 SysEx Voice**: A single imported voice, either directly encoded or selected from a 32-voice bank, that maps atomically onto the selected BlueX7 instrument.
- **Csound Representation**: Derived instrument body and tables based on the current voice plus the user-authored post-code segment; only the post-code segment is canonical project input.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A parity matrix covering 100% of Java Blue's editable BlueX7 controls passes, including all six operators, all 28 envelope stage pairs across the six operator envelopes and PEG, all 32 algorithms, common settings, and LFO settings.
- **SC-002**: At least three representative Java-created BlueX7 project fixtures—including boundary values and unknown XML—load, edit, save, reopen, and retain 100% of known and unknown BlueX7 data under structural comparison.
- **SC-003**: Supported single-voice and 32-voice-bank fixtures produce parameter values identical to Java Blue for 100% of mapped fields; invalid or canceled imports cause zero project-field changes.
- **SC-004**: For representative voices covering at least three materially different algorithms, generated Csound is semantically equivalent to Java Blue and includes the exact saved post code in the expected stage.
- **SC-005**: The Csound preview displays the final parameter state within 500 milliseconds of the user's final edit event in at least 95% of measured interactions on a supported development machine.
- **SC-006**: A user can locate and modify any BlueX7 parameter in no more than three context switches from opening the editor, and can complete the core editing and import flows using keyboard-only input.
- **SC-007**: At a 1000×760 editor surface, 100% of controls, envelope stages, tabs, import actions, and Csound content remain reachable with no overlapping critical content.
- **SC-008**: All focused BlueX7 regression, accessibility, serialization, import, and Csound-generation checks pass, and no existing orchestra editor or project round-trip regression is introduced.

## Assumptions

- "Full parity" means every user-visible capability and sound/data behavior of the current Java Blue BlueX7 editor, enhanced where necessary to meet established TypeScript Blue accessibility and interaction standards; it does not require a pixel-for-pixel Swing reproduction.
- The reviewed Java Blue source and bundled algorithm/orchestra resources are the authoritative parity baseline.
- SysEx scope is limited to Java Blue's canonical 163-byte single-voice and 4,104-byte 32-voice bank forms; hardware MIDI capture, generic MIDI librarian features, SysEx export, and arbitrary wrapper/container variants are outside this feature.
- Live Csound integration means an automatically refreshed generated-text preview and immediate parameter-to-project binding. New live audio audition controls are outside this feature and may use existing application audition/rendering features where already available.
- Algorithm diagrams may be redrawn or adapted to fit the current Blue theme provided all 32 routing topologies remain accurate and recognizable.
- Import replaces the selected instrument's voice parameters atomically but does not replace its arrangement identity, comment, assignment ID, or unrelated preserved XML unless Java Blue explicitly maps that field.
- Existing project save, dirty-state, file chooser, code editor, and host/renderer boundary conventions will be reused rather than creating BlueX7-specific alternatives. Undo/redo follows the application's editor-local precedent (as in the piano roll), scoped to the BlueX7 editor session.
