# Feature Specification: Track Layer Foundation

**Feature Branch**: `066-track-layer-foundation`

**Created**: 2026-08-01

**Status**: Complete — automated validation and project-owner desktop acceptance recorded

**Input**: Replace Audio Layer Groups with a fully working Track Layer system that can contain AudioClips and compatible SoundObjects, assign one instrument to each Track, process Track notes, create and route Track mixer channels, migrate historical audio layers, and make Track Layer the configurable new-project default.

## Clarifications

### Session 2026-08-01

- Q: What is the authoritative ownership model for an assigned Track instrument? → A: The Track owns an independent embedded copy of the instrument.
- Q: How strict is SoundObject eligibility for Track placement? → A: Every registered SoundObject type is explicitly classified; unclassified types are denied, and AudioFile is incompatible.
- Q: In what order are object processing, Track instrument assignment, and outer Note Processor Chains applied? → A: Object generation and object processing run first, eligible p1 values are overridden next, then Track processors run, and root Score processors run last.
- Q: How does the Track instrument control assign and edit instruments? → A: Double-click opens the assigned instrument in an effects-style floating editor frame; right-click offers Use New Instrument plus Cut, Copy, and Paste; dragging from Unified Instruments assigns an independent copy.

### Session 2026-08-02

- Q: Is removing NotationObject a compatibility regression? → A: No. NotationObject was never released as a supported Java Blue SoundObject and the TypeScript port was incomplete, so this feature intentionally removes it from the registered and public SoundObject surface instead of carrying an unusable type forward.
- Q: Can a PolyObject be placed on a Track? → A: No. PolyObject remains the container for SoundObject Layer Groups, but Track creation, paste, drag, and move boundaries reject it. Instance remains compatible and propagates the placement and instrument-target behavior of its referenced object.
- Q: Should the Track instrument editor block the main window? → A: No. It is a non-modal child window that remains always on top of its parent while leaving the main window interactive.
- Q: Which instrument copy sources and destinations share one preservation contract? → A: Track assignments, project Arrangement instruments, and Unified Instrument Library items are all valid sources and targets; every one of the nine source/target combinations must preserve the complete portable instrument payload.
- Q: What counts as an acceptable 1,000-item performance result? → A: Automated tests prove linear item/property visits and one generation call per item; the manual comparison uses five warmed runs and requires the median interaction/compile time to remain within 2× an equivalent SoundObject-layer workload, with no measured interaction exceeding 100 ms on the validation machine.

### Session 2026-08-05

- Q: How must the detached Track instrument editor behave during rapid control gestures while playback is active? → A: Continuous controls must reach the active runtime immediately, while canonical project changes are ordered and coalesced independently. The editor must recover and retry from a newer project revision instead of reporting that its own rapid changes happened elsewhere.
- Q: How should color editing behave across Score surfaces? → A: One in-app picker remains open throughout repeated edits, closes on an outside click or Escape, and positions above or below its target within the visible window. Set Color anchors outside the affected object row so the live preview remains visible.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compose With Mixed-Content Tracks (Priority: P1)

As a composer, I can work in a Track Layer Group whose Tracks directly contain both AudioClips and compatible SoundObjects, so related audio and generated score material share one timeline row and one mixer path.

**Why this priority**: A generic mixed-content Track is the foundation for a future launcher whose columns map one-to-one to arrangement Tracks.

**Independent Test**: Create a Track Layer Group, add an AudioClip and a PianoRoll to the same Track, move and edit both objects, save and reopen the project, and verify that both remain on that Track with their authored timing and content.

**Acceptance Scenarios**:

1. **Given** an empty Track, **When** the user adds an AudioClip and a compatible SoundObject, **Then** both appear directly on the Track and retain their normal type-specific editors.
2. **Given** mixed objects on a Track, **When** the project is saved and reopened, **Then** the Track, object order, timing, content, and identities are preserved.
3. **Given** the Track context menu, **When** the user opens Add SoundObject, **Then** only SoundObject types explicitly classified as Track-compatible can be selected.
4. **Given** a legacy AudioFile SoundObject type and the dedicated AudioClip type, **When** the Track add menu is built, **Then** AudioFile is unavailable so file audio has one canonical Track representation.
5. **Given** a compatible object in the shared ScoreObject buffer, **When** the user Command-clicks or Control-clicks an empty Track position, **Then** an independent copy is pasted at the clicked, snapped time just as it is on a SoundObject Layer.
6. **Given** a selected PianoRoll whose editor has a useful scroll position, **When** the user double-clicks that same object, **Then** the editor opens without a redundant reselection, loading flash, or scroll reset.
7. **Given** a SoundObject in a Track or SoundObject Layer, **When** the user right-clicks it, chooses Set Color, and edits continuously through the picker, **Then** that object is selected if necessary, every preview color is applied to the selection captured when the picker opened, the picker stays open through repeated edits, and it remains entirely above or below the affected object row so the result stays visible.
8. **Given** a render range beginning after score time zero, **When** PianoRoll or other compatible SoundObject notes are generated from either a Track or SoundObject Layer, **Then** events inside the range are translated so the performance begins at time zero while Track AudioClip events are not translated twice.

---

### User Story 2 - Assign and Compile a Track Instrument (Priority: P1)

As a composer, I can assign one Blue instrument to a Track and have that instrument play the Track's compatible note-producing SoundObjects through the Track's mixer channel.

**Why this priority**: The assigned instrument establishes the one-to-one Track identity needed for conventional arrangement and launcher workflows.

**Independent Test**: Assign an instrument to a Track, add a PianoRoll whose authored notes use a different p1, compile a CSD, and verify that the generated instrument is present once, the PianoRoll note p1 values use its assigned runtime ID, and the instrument output reaches the Track mixer channel.

**Acceptance Scenarios**:

1. **Given** a Track with no assigned instrument, **When** the user right-clicks its instrument control and chooses Use New Instrument or drops a Unified Instrument onto it, **Then** an independent instrument is assigned and the Track header displays its identity.
2. **Given** a Track with an assigned instrument and a PianoRoll, **When** the project compiles, **Then** the assigned instrument is compiled once and each eligible PianoRoll note targets the assigned runtime instrument ID instead of its authored p1.
3. **Given** an AudioClip on the same Track, **When** the project compiles, **Then** its dedicated file-playback event is not retargeted to the assigned instrument.
4. **Given** a SoundObject that owns or generates a special-purpose instrument, **When** it compiles on the Track, **Then** only the notes that the SoundObject declares eligible are retargeted and its special-purpose events remain valid.
5. **Given** a replaced or cleared Track instrument, **When** the project is compiled again, **Then** no obsolete Track instrument or stale assignment remains in the generated CSD.
6. **Given** a Track with an assigned instrument, **When** the user double-clicks its instrument control, **Then** that Track-owned instrument opens in one non-modal, always-on-top child editor while the main window remains interactive.
7. **Given** an assigned instrument or a compatible instrument clipboard payload, **When** the user invokes Cut, Copy, or Paste from the instrument control menu, **Then** the shared instrument clipboard and Track assignment are updated using independent copies.
8. **Given** a BlueSynthBuilder instrument with widgets, presets, automation parameters, and embedded UDOs, **When** it is copied or pasted onto another Track, **Then** the independent copy preserves the complete playable payload while receiving independent widget, parameter, and preset identities.
9. **Given** Track and Arrangement instruments with embedded UDOs, **When** the project compiles, **Then** Track instrument UDOs participate in the same deterministic dependency-registration order as Arrangement instruments and precede orchestra code that uses them.
10. **Given** active realtime playback or Blue Live and a Track-owned BlueSynthBuilder instrument, **When** the user applies a preset or changes an automatable widget, **Then** the corresponding compiled runtime channels update without restarting playback.
11. **Given** a Track, Arrangement, or Unified Library instrument, **When** it is copied to any Track, Arrangement, or Unified Library target, **Then** all portable instrument data is preserved and project-owned copies receive independent owned identities.
12. **Given** active playback and a continuous Track-instrument control, **When** the user produces changes faster than durable project acknowledgements complete, **Then** every runtime value is sent in gesture order, durable writes never overlap, superseded pending values collapse to the latest value, and no false changed-elsewhere state replaces the editor.

---

### User Story 3 - Process and Mix Each Track (Priority: P1)

As a composer, I can configure a Note Processor Chain and mixer channel per Track, so all compatible notes and audio on that Track share intentional transformations and routing.

**Why this priority**: Tracks must be musically functional, not just a renamed container, and their processing order must be deterministic.

**Independent Test**: Add a transposition processor and a p1-changing processor to a Track, add a PianoRoll and AudioClip, compile and audition the result, and verify the documented note-processing order and shared mixer routing.

**Acceptance Scenarios**:

1. **Given** a Track panel, **When** the user opens its Note Processor Chain control and edits the chain, **Then** the chain is stored on that Track and persists across save and reopen.
2. **Given** eligible SoundObject notes on a Track, **When** the score compiles, **Then** object generation and object processors run first, the eligible p1 override runs next, Track processors run afterward, and root Score processors run last.
3. **Given** a Track Layer Group with multiple Tracks, **When** mixer state is reconciled, **Then** each Track has exactly one associated source channel grouped under the Track Layer Group.
4. **Given** an assigned instrument, an AudioClip, and any self-generated instrument output on one Track, **When** the mixer is enabled, **Then** all mixer-aware output reaches that Track's associated source channel and follows its level, effects, sends, and output routing.
5. **Given** the mixer is disabled or an object intentionally emits raw output, **When** the project compiles, **Then** the existing non-mixer behavior remains valid and compilation does not fail.
6. **Given** a Track with channel-level and effect automation targets, **When** the user opens its automation chooser, **Then** available Pre-Effects, dB, and Post-Effects choices appear directly under Track Channel without a redundant Track-name submenu.
7. **Given** unnamed Tracks in a Track Layer Group, **When** their mixer strips are displayed, **Then** the strips show italic Track 1, Track 2, and so on by one-based group order without assigning those fallback labels as Track names.

---

### User Story 4 - Migrate Historical Audio Layers (Priority: P1)

As a long-time Blue user, I can open a historical project containing Audio Layer Groups and continue working with the same audio, automation, and mixer setup as Track Layer Groups.

**Why this priority**: Track Layer replaces the existing audio model; historical projects must remain usable without maintaining two parallel runtime models.

**Independent Test**: Open representative Java and TypeScript projects with multiple Audio Layer Groups, layers, clips, automation assignments, and mixer effects; verify their automatic in-memory conversion, playback, canonical Track save, and stable reopen behavior.

**Acceptance Scenarios**:

1. **Given** historical `audioLayerGroup` project data, **When** the project loads, **Then** each group becomes one Track Layer Group and each Audio Layer becomes one Track with no user intervention.
2. **Given** a migrated Audio Layer, **When** conversion completes, **Then** its name, identity, order, height, mute/solo state, AudioClips, automation assignments, and associated mixer channel state are preserved and its assigned instrument is empty.
3. **Given** a migrated project, **When** it is saved, **Then** only the canonical Track Layer representation is written; no duplicate Audio Layer compatibility model is retained.
4. **Given** a newly saved Track project, **When** it is reopened in TypeScript Blue, **Then** it loads without a second migration and produces the same Track and mixer state.
5. **Given** a migrated Track whose source mixer association is missing or malformed, **When** reconciliation runs, **Then** a valid associated Track channel is created without discarding the Track's project data.

---

### User Story 5 - Choose the Default Layer Group (Priority: P2)

As a user configuring Blue, I can choose whether new projects start with a Track Layer Group or a SoundObject Layer Group, with Track Layer selected by default.

**Why this priority**: New users should enter the intended Track-first workflow while experienced users can retain the experimental SoundObject-layer workflow.

**Independent Test**: Change Default Layer Group Type in Program Options, create a project for each setting, and verify the initial group type and the generic add-layer-group default.

**Acceptance Scenarios**:

1. **Given** fresh Program Options, **When** a new project is created, **Then** its initial score group is a Track Layer Group with one Track.
2. **Given** Default Layer Group Type is set to SoundObject Layer, **When** a new project is created, **Then** its initial score group is a SoundObject Layer Group with one layer.
3. **Given** either default, **When** the user explicitly opens the add-layer-group choices, **Then** Track Layer Group and SoundObject Layer Group remain individually available.
4. **Given** older Program Options with no saved default-layer value, **When** settings are loaded, **Then** Track Layer is used as the default without affecting existing open projects.

### Edge Cases

- A Track is empty, has no instrument, has an instrument but no eligible notes, or contains only AudioClips.
- Two or more Tracks deep-copy the same library instrument; each Track must remain independently editable.
- A Track contains an Instance or another compatible runtime-backed SoundObject that generates notes asynchronously.
- A SoundObject returns an empty list, malformed notes, notes with named or fractional p1 values, or special negative p1 semantics.
- An AudioClip and SoundObject overlap on the same Track, or many objects share the same start time.
- A Track Note Processor Chain changes p1 after assignment, throws, or returns no notes.
- The assigned instrument is disabled, unsupported by the available host runtime, or fails during global orchestra, table, UDO, or instrument generation.
- A historical Audio Layer Group has no layers, duplicate or missing identities, missing mixer associations, unknown surrounding XML, or automation references to missing parameters.
- A Track or Track Layer Group is renamed, reordered, added, or removed while mixer channels already contain effects, sends, automation, or custom routing.
- A Track has an empty or whitespace-only name while its mixer channel and automation targets remain usable.
- A SoundObject is copied or moved between SoundObject and Track layers where its compatibility differs.
- A project is saved before an instrument selection or Track edit has reached the canonical project document.
- A Track instrument slider, knob, XY controller, or slider bank emits many values while a prior durable editor patch is still in flight or an unrelated project edit advances the document revision.
- A color picker opens for a target near a viewport edge, emits multiple edits while the score selection changes or project acknowledgements remain in flight, or receives another click on its own trigger.
- A nonzero render start intersects SoundObjects that begin before, at, or after the range boundary while AudioClips on the same Track already generate render-relative events.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Program Options MUST expose a Default Layer Group Type choice containing Track Layer and SoundObject Layer, and its factory default MUST be Track Layer.
- **FR-002**: The saved default MUST determine the initial score layer group of newly created projects and the default result of any generic add-layer-group action; explicit add choices MUST remain available.
- **FR-003**: The application MUST use Track Layer Group and Track as the canonical user-facing names and MUST remove Audio Layer Group and Audio Layer naming from current authoring surfaces.
- **FR-004**: A Track Layer Group MUST contain ordered Tracks, and each Track MUST directly contain an ordered mixture of AudioClips and Track-compatible SoundObjects without an InstrumentClip or other duplicate wrapper model.
- **FR-005**: Each Track MUST preserve its name, stable identity, height, mute/solo state, automation assignments, Note Processor Chain, optional assigned instrument, and ordered contents in project data.
- **FR-006**: Each Track MUST own zero or one independently editable embedded instrument; multiple assigned instruments and instrument effect chains are outside this MVP.
- **FR-007**: The Track header MUST display a compact instrument control that distinguishes unassigned and assigned states and identifies the current instrument.
- **FR-008**: Assigning an instrument from a reusable library or project Orchestra source MUST create an independent Track-owned deep copy; later edits, replacement, or removal MUST NOT mutate the source, another Track, or an earlier assignment.
- **FR-008a**: Double-clicking an assigned Track instrument control MUST open or focus one non-modal child editor window for that project session and Track. The editor MUST stay always on top of its parent without blocking input to the main window; double-clicking an unassigned control MUST leave the project unchanged.
- **FR-008b**: Right-clicking the Track instrument control MUST open a context menu containing Use New Instrument with the same instrument-type choices available from the Arrangement panel, followed by Cut, Copy, and Paste with state-appropriate enablement.
- **FR-008c**: Cut and Copy MUST place an independent instrument payload in the application-wide instrument clipboard; Cut MUST clear the Track assignment only after capture succeeds, and Paste MUST independently copy a compatible instrument payload into the Track, replacing any current assignment.
- **FR-008d**: Dragging an instrument from the Unified Instrument Library onto the Track instrument control MUST assign an independent Track-owned copy and MUST provide normal valid, invalid, and replacement drop feedback.
- **FR-008e**: Every Track, Arrangement, and Unified Instrument Library source MUST copy to every Track, Arrangement, and Unified Instrument Library target through the shared typed instrument transfer contract. All nine combinations MUST preserve the complete portable instrument payload, including enabled state, comments, BSB widget hierarchy and values, grid/edit settings, presets, automation metadata and curve shape, embedded UDOs, global code, always-on code, and instrument code, while regenerating copy-owned identities when entering independently owned project state.
- **FR-008f**: Embedded UDOs owned by a Track instrument MUST use the same application-wide typed UDO clipboard as project-global, Arrangement-instrument, and user-library UDOs. Copy, Cut, drag, and Paste MUST address the Track by stable Track Layer Group and Track identities, preserve the complete UDO payload, reject ambiguous owners, and remain usable between the main window and the always-on-top Track instrument editor.
- **FR-008g**: Rapid Track instrument edits MUST remain usable during regular playback and Blue Live. Continuous control values MUST reach active compiled channels without waiting for durable project acknowledgement; durable Track instrument changes MUST be applied in order with at most one request in flight, coalesce only safely superseded pending values, and rebase/retry a valid stable Track target when the project revision advances. A revision conflict caused by normal rapid editing MUST NOT replace the editor with a changed-elsewhere error.
- **FR-009**: The Track header MUST expose the existing Note Processor Chain workflow for the selected Track.
- **FR-009a**: The Track Note Processor Chain editor MUST use the same application-wide Note Processor buffer as every other chain editor; Paste MUST create a detached processor with a new destination identity.
- **FR-010**: The Track timeline context menu MUST offer the compatible Add SoundObject choices and MUST retain normal add, paste, move, edit, selection, and removal workflows for both AudioClips and compatible SoundObjects.
- **FR-010a**: Copying one Track SoundObject MUST populate both the shared ScoreObject buffer and the typed Library SoundObject buffer so every compatible Score, Blue Live, project-library, and user-library destination can use the copy. Cutting one Track SoundObject MUST remove it only after the portable Library capture succeeds; AudioClip and multi-selection Cut remain Score-buffer operations.
- **FR-010b**: Command-clicking on macOS or Control-clicking on other platforms at an empty compatible Track position MUST paste the shared ScoreObject buffer at the clicked, snapped time with the same destination validation used by context-menu paste and SoundObject Layers.
- **FR-010c**: Opening a selected ScoreObject editor MUST NOT issue a redundant reselection that resets type-specific editor state. While a replacement editor document loads, the current editor MUST remain mounted; selecting another object handled by the same editor type MUST update that mounted editor without a visible Loading replacement or avoidable viewport reset.
- **FR-010d**: Set Color MUST work for SoundObjects in both Track and SoundObject Layers. Right-clicking an unselected object MUST make it the selection target before the menu action, the picker MUST begin with the first selected object's color, cancellation MUST leave the project unchanged, and every color emitted during continuous editing MUST apply to every object in the selection captured when the picker opened. Handling one emitted color MUST NOT clear or replace that captured target set.
- **FR-010e**: Every renderer color-editing surface MUST use the same persistent in-app picker rather than a platform-native one-shot control. The picker MUST remain open during preset, slider, and hexadecimal edits and when its current trigger is clicked again; it MUST close on an outside click or Escape; and it MUST remain within the visible window above or below its target. A timeline Set Color picker MUST anchor outside the complete affected object row so the edited object remains visible.
- **FR-011**: Every registered SoundObject type MUST declare an explicit Track-compatible or Track-incompatible placement capability used by add, paste, drag, and move validation; unclassified or unknown types MUST be denied. AudioFile MUST be Track-incompatible in favor of AudioClip, and PolyObject MUST be Track-incompatible because Track Layers may not contain nested layer-group containers.
- **FR-012**: Rejecting an incompatible object placement MUST leave the project unchanged and provide an understandable disabled state or diagnostic.
- **FR-013**: Track compilation MUST compile each enabled assigned instrument once per render and allocate the runtime instrument identity used by eligible Track notes.
- **FR-013a**: Track instruments MUST participate in dependency collection in the same deterministic order as appended Arrangement instruments, including embedded UDO registration before generated orchestra code, tables, global code, string channels, and automation parameters.
- **FR-013b**: Realtime compilation MUST map generated automation channel names back to live Track-owned parameters in Arrangement-instrument, Track-instrument, then mixer order; Track preset and widget changes MUST propagate to both regular playback and Blue Live engines.
- **FR-013c**: A transient Track runtime-control target MUST be fenced by the current project session and stable Track Layer Group/Track identities, must never mutate project XML by itself, and must be rejected when the session or Track instrument no longer matches.
- **FR-014**: Eligible note-producing SoundObjects MUST accept an optional Track instrument assignment during generation and MUST retarget only the notes whose p1 semantics they own.
- **FR-015**: PianoRoll notes on an instrument-assigned Track MUST use the assigned runtime instrument identity regardless of their authored p1 values.
- **FR-016**: AudioClip playback events and SoundObject-specific support events MUST NOT be retargeted to the assigned Track instrument.
- **FR-017**: Named, numeric, fractional, and negative p1 forms MUST remain syntactically valid, and an override MUST preserve any meaningful suffix or sign behavior that the originating SoundObject declares compatible.
- **FR-018**: Synchronous and host-runtime-backed asynchronous generation MUST produce equivalent Track-assignment, processing, ordering, and routing semantics.
- **FR-018a**: Track and SoundObject Layer generation MUST apply the same render-window time origin: compatible SoundObject events inside a nonzero render range MUST be rebased by the render start, events before the range MUST be excluded, and already-relative Track AudioClip events MUST NOT be rebased a second time.
- **FR-019**: The observable generation order MUST be object generation, object Note Processor Chain processing, eligible Track instrument p1 override, Track Note Processor Chain processing, Track Layer Group aggregation, and root Score Note Processor Chain processing; Track and root processors MUST remain able to intentionally change an overridden p1.
- **FR-020**: Each Track MUST have exactly one associated mixer source channel; channels MUST be grouped by Track Layer Group and retain existing levels, effects, sends, automation, output routing, mute, and solo state across reconciliation. If duplicate associations exist, reconciliation MUST retain the first canonical group/channel and its state before removing duplicates.
- **FR-020a**: A Track automation chooser MUST omit the redundant associated-channel name submenu and expose the available Pre-Effects group, dB target, and Post-Effects group directly beneath Track Channel.
- **FR-020b**: An unnamed Track's mixer strip MUST display an italic, non-persisted `Track N` fallback derived from its one-based order within the Track Layer Group; an authored Track name MUST remain unchanged and use normal styling.
- **FR-021**: Assigned Track instruments that use mixer-aware output MUST route to the associated Track channel.
- **FR-022**: AudioClip playback instruments and mixer-aware instruments generated by SoundObjects on a Track MUST route to the same associated Track channel.
- **FR-023**: Mixer-disabled projects and intentional raw-output instruments MUST retain valid existing output behavior.
- **FR-024**: Historical Audio Layer Group project data MUST migrate automatically before normal model use into the one canonical Track Layer model.
- **FR-025**: Migration MUST convert every Audio Layer Group to a Track Layer Group and every Audio Layer to a Track while preserving modeled group, layer, AudioClip, automation, mixer state, and unknown attributes/children at the group, tracks-container, and Track levels; migrated Tracks MUST begin with no assigned instrument and an empty Note Processor Chain.
- **FR-026**: Saving a migrated or new project MUST write only the canonical Track Layer project representation; Java Blue compatibility for newly saved Track projects is explicitly not required.
- **FR-027**: The implementation MUST NOT retain parallel Audio Layer and Track Layer runtime data classes, shadow copies, dual-save modes, or legacy export adapters.
- **FR-028**: Existing SoundObject Layer Groups MUST remain supported and unchanged as the alternative historical and experimental workflow. PolyObject remains supported there but MUST NOT be accepted as a Track item.
- **FR-028a**: NotationObject MUST remain removed from registration, public exports, persistence loading, and authoring surfaces because it was never released as a supported Java Blue feature and its TypeScript implementation was incomplete.
- **FR-029**: Pattern Layer Groups and any future Pattern migration MUST remain unchanged and outside this feature.
- **FR-030**: The canonical Electron main-process project document MUST own Track data and project migration; renderers MUST receive serializable Track snapshots and submit explicit Track edit intents.
- **FR-031**: Program Options MUST remain app-wide settings and MUST NOT be written into project XML; Track data, instruments, processors, and associations MUST persist in project XML.
- **FR-032**: Focused automated coverage MUST include settings defaults, historical migration, canonical round-trip, mixed-content editing, placement eligibility, paired Track/SoundObject-layer nonzero render-start behavior, synchronous/asynchronous generation, p1 override, Note Processor ordering, instrument compilation, mixer reconciliation, and audio routing.
- **FR-033**: A deterministic end-to-end fixture MUST compile a Track-assigned instrument plus PianoRoll and AudioClip and verify the assigned p1, dedicated audio event p1, generated orchestra, and Track mixer routing in the resulting CSD.
- **FR-034**: Contextual removal or disabling of p1 controls inside individual SoundObject editors MUST remain deferred to a later feature; this MVP MUST preserve existing editors.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Historical Audio Layer Group storage, AudioClip generation, mixer association, and score editing are the migration baseline. SoundObject Layer behavior and note-processing scope remain the reference for direct SoundObject editing. Java Blue's cached per-type ScoreObject editors and Set Color chooser define the no-flash editor-update and color-selection behavior. Logic Pro's compact Track-header instrument control informs the assignment interaction. REAPER's generic mixed-media Track and Track FX behavior inform the mixed-content direction, without adopting REAPER's unlimited instrument/FX-chain model. Because Java Blue has no released Track Layer model, the Track-specific flattened automation chooser and transient unnamed-strip fallback are intentional TypeScript Track presentation rules rather than Java mixer-menu parity requirements.
- **Compatibility Requirements**: TypeScript Blue MUST load historical Java and TypeScript projects containing `audioLayerGroup` data and preserve their modeled audio, automation, mixer behavior, and unknown XML through conversion. SoundObject Layer Groups, project libraries, surrounding unknown XML, and existing non-Track score behavior MUST remain intact, except for the explicitly removed unreleased NotationObject.
- **Intentional Divergences**: Track Layer is a new TypeScript Blue canonical model and newly saved Track projects do not need to load in Java Blue. Historical Audio Layer data is upgraded rather than retained beside the new model. AudioFile and PolyObject SoundObjects are excluded from Tracks. The unreleased, incomplete NotationObject is removed from TypeScript Blue rather than treated as a compatibility obligation. New projects default to Track Layer. Tracks own at most one assigned instrument rather than REAPER-style instrument chains.
- **State Ownership**: Main-process `BlueData` owns canonical Track project state and `.blue` persistence. Program Options owns the app-wide default group choice. The Unified Library service owns the transient active typed Library clipboard and a separate type-isolated BSB widget buffer across application windows; Note Processor, Piano Roll, and ScoreObject buffers remain renderer-session transient and isolated from one another and from both main-owned slots. Renderer menu, selection, hover, chooser, and pending-edit state is transient. Compilation identities and mixer variable assignments are disposable render state.

### Key Entities *(include if feature involves data)*

- **Track Layer Group**: An ordered project-owned group of Tracks with a stable identity, name, default Track height, and mixer channel-list association.
- **Track**: One timeline row with stable identity, display and mute/solo state, automation assignments, a Note Processor Chain, zero or one assigned instrument, and direct mixed AudioClip/SoundObject contents.
- **Assigned Track Instrument**: An independently serialized, Track-owned Blue instrument created from an Arrangement-style type choice, instrument clipboard payload, or Unified Instrument Library drop, compiled for eligible note events, and routed through the Track's mixer channel.
- **Track Content Item**: Either an AudioClip or a Track-compatible SoundObject stored directly on a Track with its native identity, timing, serialization, and editor behavior.
- **Track Placement Capability**: Required SoundObject registration metadata that explicitly permits or denies creating, pasting, dragging, or moving the type onto a Track; absence of a classification denies placement.
- **Track Generation Context**: Disposable render-time information containing the optional assigned instrument identity and Track mixer association that eligible objects consume without modifying authored p1 data.
- **Track Mixer Association**: The stable relationship between one Track identity and exactly one source mixer channel, grouped under its Track Layer Group.
- **Default Layer Group Type**: An app-wide Program Options preference that chooses the initial group for future new projects.
- **Historical Audio Migration**: A one-way load transformation from `audioLayerGroup`/`audioLayer` data into the canonical Track Layer Group/Track representation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a Track, assign an instrument, add a PianoRoll and AudioClip, and produce a routed CSD in one workflow with no manual Orchestra or mixer-channel setup.
- **SC-002**: The curated instrument-plus-PianoRoll fixture produces 100% of eligible notes with the assigned runtime p1, while 100% of AudioClip and declared special-purpose events retain their required p1 values.
- **SC-003**: All curated Track generation fixtures produce identical assignment, processing-order, and routing results in synchronous and asynchronous compilation paths.
- **SC-004**: All representative historical Audio Layer fixtures retain 100% of covered group, layer, AudioClip, automation, and mixer properties after migration and canonical save/reopen.
- **SC-005**: Across 100 add, remove, rename, and reorder reconciliation cycles, each Track has exactly one associated mixer source channel and no preserved effects, sends, automation, or routing are lost.
- **SC-006**: New-project tests create the configured initial layer group in 100% of Track and SoundObject setting cases, including fallback from settings files that lack the new preference.
- **SC-007**: Every built-in SoundObject type has an explicit, tested Track-placement result, and incompatible add, paste, drag, and move attempts cause zero project mutations.
- **SC-008**: For a mixed Track containing at least 1,000 timeline objects, automated tests demonstrate linear work by bounding item/property visits and asserting exactly one generation call per item. In the manual validation environment, the median of five warmed selection, move, and compile runs MUST be no more than 2× the median for an equivalent SoundObject-layer workload, and no measured interaction may exceed 100 ms.
- **SC-009**: Focused data, migration, shared-contract, renderer, settings, mixer, and CSD suites plus affected type checks and builds pass before the feature is considered complete.
- **SC-010**: The automated 3×3 Track/Arrangement/Unified-Library source-to-target matrix preserves 100% of the curated BlueSynthBuilder payload, and portable XML round trips preserve every common field for all five supported instrument types; project insertions share no copy-owned widget, parameter, or preset identities.
- **SC-011**: During regular playback and Blue Live, applying every preset in the curated Track instrument fixture updates 100% of compiled parameter channels addressed by that preset without duplicate channel declarations or a playback restart.
- **SC-012**: Automated clipboard tests prove that Track SoundObjects reach both compatible buffer domains, Track-owned UDOs copy and paste through all exact UDO owner types across application windows, BSB widgets synchronize between main and detached Track instrument editors while remaining type-isolated, Note Processors paste between distinct chain editors with new identities, and Piano Roll notes remain detached in their shared type-specific buffer.
- **SC-013**: Automated Track automation and mixer fixtures expose 100% of available channel targets without an empty or redundant Track-name submenu and render every unnamed Track strip with the correct italic one-based fallback while preserving empty canonical names.
- **SC-014**: Focused renderer tests prove Command/Control-click paste parity on empty Track positions, one selection transition for Track PianoRoll double-click, stable same-type editor mounting without a Loading replacement, and working multi-selection Set Color behavior across successive picker edits in both Track and SoundObject Layers without obscuring the affected row.
- **SC-015**: Paired Score-generation tests prove that Track and SoundObject Layer PianoRoll notes at render start 16 produce identical times beginning at 0 in both synchronous and asynchronous paths, while a Track AudioClip at the same boundary remains at 0.
- **SC-016**: A focused burst-control regression emits at least three Track BSB values before the first durable acknowledgement, observes all three immediate runtime messages, observes no overlapping durable requests, persists the final coalesced value after no more than two durable requests, and completes without a changed-elsewhere state. A separate stale-revision regression proves the same patch is retried against the returned canonical revision.
- **SC-017**: Focused renderer tests prove the shared color picker persists through preset, slider, hexadecimal, inside-pointer, and repeated-trigger edits; closes on outside click or Escape; chooses an on-screen above/below placement; and replaces platform-native color inputs in ScoreObject Properties, automation, line editing, BSB properties, and timeline Set Color.

## Assumptions

- The MVP uses zero or one assigned instrument per Track. REAPER-style multiple instruments, serial/parallel instrument chains, and Track-level plug-in containers are future work.
- The Logic-inspired instrument control is compact in the Track header, but its interactions follow established Blue patterns: a non-modal, always-on-top child editor, Arrangement-style new-instrument choices, the shared instrument clipboard, and Unified Library drag-and-drop.
- Instruments created, pasted, or dropped onto a Track are independently owned and can be edited, replaced, or cleared without mutating their source or another Track.
- SoundObject compatibility is capability-based, every registered type is classified deliberately, and unclassified or unknown types are denied. AudioFile is explicitly incompatible because AudioClip is the canonical file-audio item; PolyObject is explicitly incompatible because Track Layers do not accept nested layer-group containers.
- The assigned instrument override is authored-data neutral: generated notes change for a render, while the SoundObject's stored p1 values do not.
- Track Note Processor Chains remain able to intentionally transform generated p1 after the assignment has been applied; root Score processing remains later still.
- Stable Audio Layer identities become stable Track identities during migration, allowing mixer associations and automation references to survive without parallel compatibility objects.
- Existing project save acknowledgement and canonical document workflows are reused for Track edits and instrument selection.

## Out of Scope

- Pattern Layer deprecation, migration, or redesign.
- A Blue Live track/scene launcher, clip slots, launch quantization, capture, or arrangement conversion.
- More than one assigned instrument per Track, REAPER-style FX containers, or instrument-chain routing.
- Context-sensitive removal, disabling, or relabeling of p1 controls inside SoundObject editors.
- A separate InstrumentClip, MIDI clip, region wrapper, or compatibility-only Track/Audio shadow model.
- Loading newly saved Track Layer projects in Java Blue or exporting Track projects back to Audio Layer XML.
- Restoring or completing NotationObject; it is intentionally removed because it was never released as a supported Java Blue feature.
- Redesigning SoundObject Layer Groups, project Orchestra, or unified libraries beyond the integration needed to select and edit a Track instrument.
