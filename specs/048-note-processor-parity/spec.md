# Feature Specification: Note Processor Parity

**Feature Branch**: `048-note-processor-parity`  
**Created**: 2026-05-23  
**Status**: Closed
**Input**: User description: "Research status of NoteProcessors and NoteProcessorChains and support for them within the application in regards to parity for Java Blue. We need all Note Processor types implemented, a Note Processor panel within ScoreObject Properties, a Note Processor chain edit dialog, support for noteprocessors on SoundObject layers, Layer Groups, and Root, unit tests for processing and serialization including each processor's processing on objects/layers/layer groups/root, and all UI changes. Need a full audit of what's missing, then produce a new spec using spec-kit for implementing full parity."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preserve and Execute In-Scope Java Processor Types (Priority: P1)

As a composer opening an existing Java Blue project, I need every non-Python Java Blue note processor type to load, display, edit, save, copy, and process notes with Java-compatible behavior so existing musical transformations continue to work after moving to the Electron application.

**Why this priority**: Processor catalog parity is the foundation for all UI and render behavior. Missing or silently skipped processors alter generated music and can corrupt project intent.

**Independent Test**: Load or create a chain containing each in-scope Java Blue processor type, edit its exposed values, process a representative note list, save and reload the project, and verify the processor identity, parameters, and output remain correct. Load a PythonProcessor chain and verify it is preserved and clearly marked deferred.

**Acceptance Scenarios**:

1. **Given** a project contains any in-scope Java Blue note processor type, **When** the project is loaded, **Then** the processor appears as a first-class editable processor rather than an unsupported or unrelated placeholder.
2. **Given** each in-scope processor type is applied to a representative note list, **When** processing completes, **Then** the resulting notes match Java Blue-compatible pitch, time, duration, selection, randomization, and error behavior.
3. **Given** a chain contains PythonProcessor data, **When** the project is loaded or saved, **Then** the processor data is preserved and clearly marked as deferred without implementing Jython/Python execution or full editing in this slice.

---

### User Story 2 - Edit ScoreObject Processor Chains (Priority: P1)

As a composer selecting a score object, I need the ScoreObject Properties surface to expose a Java Blue-style note processor panel so I can add, remove, reorder, copy, paste, and edit processors without leaving the score editing workflow.

**Why this priority**: Java Blue exposes score-object note processors directly in the properties panel. A read-only summary does not let users repair or create processor chains.

**Independent Test**: Select a score object that supports note processors, edit its chain through ScoreObject Properties, save and reload, and verify generated notes reflect the changed chain.

**Acceptance Scenarios**:

1. **Given** a supported score object is selected, **When** the properties panel is shown, **Then** it provides an editable note-processor-chain panel or an obvious action that opens the chain editor for that object.
2. **Given** the user adds, removes, reorders, or edits a processor in the selected object's chain, **When** the change is committed, **Then** the canonical project data and visible chain summary update without requiring a project reload.
3. **Given** the selected object's chain includes a legacy or unsupported processor, **When** the properties panel displays it, **Then** the user can see that it is preserved and cannot accidentally overwrite it through unrelated edits.

---

### User Story 3 - Edit Layer, Layer-Group, and Root Chains (Priority: P1)

As a composer applying note transformations at broader score scopes, I need to edit note processor chains on sound-object layers, layer groups, and the root score so Java Blue projects with scoped processors can be maintained and new scoped processors can be created.

**Why this priority**: Java Blue supports scoped chains beyond individual objects, and missing root or layer-level editing prevents full project parity.

**Independent Test**: Add a processor to a score object, its containing layer, its layer group, and the root score; render the result; verify processors are applied in Java-compatible scope order and all chains persist through save and reload.

**Acceptance Scenarios**:

1. **Given** a layer supports note processors, **When** the user activates its note-processor affordance, **Then** the chain editor opens for that layer and commits changes to the project.
2. **Given** a layer group supports note processors, **When** the user opens the group-level processor action, **Then** the chain editor opens for that layer group and shows whether the chain is empty or populated.
3. **Given** the root score has a processor chain, **When** the user opens the root-level processor action, **Then** the chain editor opens for the root and changes affect the final merged score output.

---

### User Story 4 - Verify Full Processing and Serialization Coverage (Priority: P2)

As a maintainer, I need automated tests that prove every processor works through all supported scopes and round-trips safely so future score, render, or UI work cannot regress Java Blue compatibility silently.

**Why this priority**: Prior work added partial processor models and summaries, but the current coverage does not prove catalog-wide behavior, scoped processing, or UI editing parity.

**Independent Test**: Run the note-processor parity test suite and verify it covers every processor type, XML round-trip shape, named-chain behavior, object-chain application, layer-chain application, layer-group-chain application, root-chain application, and UI edit workflow.

**Acceptance Scenarios**:

1. **Given** the test suite is run, **When** per-processor processing tests execute, **Then** every in-scope Java Blue processor type has at least one passing processing test and one serialization test, while PythonProcessor has preservation coverage only.
2. **Given** a processor is applied at object, layer, layer-group, and root scopes, **When** notes are generated, **Then** tests verify each scope contributes its processor effect in the expected order.
3. **Given** a user edits a chain through the UI, **When** the edit is committed, **Then** tests verify the patch reaches canonical project data and persists after reload.

### Edge Cases

- What happens when a chain contains legacy XML, unknown processors, or processors not yet executable in the Electron runtime?
- What happens when a user edits a chain while the selected object, layer, or layer group is removed or replaced?
- What happens when a named chain is imported into an existing chain with unsupported processors?
- What happens when invalid processor parameters would cause Java Blue to reject processing?
- How does rendering behave when empty chains exist at object, layer, group, and root scopes?
- How does random processor output remain reproducible when seeds are used across object, layer, group, and root tests?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The implementation MUST use Java Blue as the parity source for the note-processor catalog, processor field names, chain editor behavior, scoped chain application, and serialization shape.
- **FR-002**: The application MUST provide first-class support for every in-scope Java Blue note processor type: Add, PchAdd, Multiply, RandomAdd, RandomMultiply, SubList, Rotate, Retrograde, Inversion, PchInversion, Equals, Switch, TimeWarp, LineAdd, LineMultiply, and Tuning.
- **FR-002a**: PythonProcessor and related Jython/Python runtime behavior MUST be deferred to a later feature; this feature MUST preserve PythonProcessor XML and clearly label it as deferred, but MUST NOT implement PythonProcessor execution or full editing.
- **FR-003**: The application MUST NOT expose Java helper value objects as standalone note processors when Java Blue does not expose them as note processors.
- **FR-004**: Each processor type MUST load Java Blue XML, expose editable user-facing fields, deep-copy safely, save Java-compatible XML, and preserve data through project save/reload.
- **FR-005**: Each in-scope processor type MUST process representative note lists with Java-compatible results, including invalid-parameter failures and seeded random behavior.
- **FR-006**: Deferred or unsupported processor types MUST preserve data and be clearly labeled as unavailable for execution in this slice rather than being presented as fully supported.
- **FR-007**: Named note processor chains MUST remain loadable, savable, importable into an active chain, and savable back as named chains.
- **FR-008**: ScoreObject Properties MUST provide an editable note-processor-chain surface for score objects that support note processors.
- **FR-009**: The chain editor MUST support adding processors, removing processors, reordering processors, editing processor fields, cut/copy/paste, clearing chains, importing named chains, and saving non-empty chains as named chains.
- **FR-009a**: Cut and Copy from any Note Processor Chain editor MUST populate one application-wide typed Note Processor buffer shared by every object, layer, layer-group, root, and Track chain editor. Paste MUST create a detached processor copy with a new destination identity and MUST preserve all processor fields without sharing mutable parameter state with the source.
- **FR-010**: The score UI MUST provide note-processor edit affordances for supported sound-object layers, supported layer groups, and the root score.
- **FR-011**: Non-empty chains at object, layer, layer-group, and root scopes MUST be visible to users through clear indicators or summaries.
- **FR-012**: Chain edits from any supported scope MUST mutate canonical project data and survive project save/reload.
- **FR-013**: Generated notes MUST apply note processor chains in Java-compatible scope order across object, layer, layer-group, and root score scopes.
- **FR-014**: The root score note processor chain MUST affect final generated score output after layer groups are merged.
- **FR-015**: Unsupported or legacy processors MUST remain visible and preserved unless the user deliberately removes them.
- **FR-016**: Automated tests MUST cover each in-scope processor type's processing behavior and serialization behavior, plus preservation-only behavior for deferred PythonProcessor XML.
- **FR-017**: Automated tests MUST cover in-scope processor application at score object, sound-object layer, layer-group, and root score scopes.
- **FR-018**: Automated tests MUST cover UI workflows for ScoreObject Properties editing, layer editing, layer-group editing, root editing, named-chain import/save, and unsupported processor preservation.

### Key Entities *(include if feature involves data)*

- **Note Processor Type**: One Java Blue-compatible processor kind with identity, editable fields, processing behavior, copy behavior, and XML representation.
- **Note Processor Chain**: Ordered list of note processors applied to a note list at a specific score scope.
- **Named Note Processor Chain**: Reusable chain stored by name and importable into other chains.
- **Processor Scope Target**: The object, sound-object layer, layer group, or root score that owns a chain.
- **Chain Editor Session**: User interaction state for editing one target chain and committing changes back to canonical project data.
- **Processing Verification Fixture**: A representative set of input notes and expected output notes for one processor at one scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can create or load all 16 in-scope Java Blue note processor types and see each one as a first-class editable processor, and can load PythonProcessor data as a preserved deferred processor.
- **SC-002**: For every in-scope processor type, at least one automated processing test and one automated serialization test passes; PythonProcessor has preservation-only coverage.
- **SC-003**: For every in-scope processor type, automated tests prove processing works when the chain is owned by a score object, a sound-object layer, a layer group, and the root score.
- **SC-004**: A reviewer can edit note processor chains from ScoreObject Properties, a layer affordance, a layer-group affordance, and a root-score affordance.
- **SC-005**: A project containing object, layer, layer-group, root, and named note processor chains saves and reloads without losing processor identities, field values, order, or unsupported legacy payloads.
- **SC-006**: Generated notes or generated CSD visibly change when a root score chain is added to a project with generated notes.
- **SC-007**: Deferred PythonProcessor data and unsupported legacy processors remain preserved and visibly labeled so users do not mistake them for fully supported transformations in this slice.
- **SC-008**: A focused two-editor test copies from one Note Processor Chain scope, pastes into another, and verifies 100% field preservation, a new destination identity, and no shared mutable parameter state.

## Assumptions

- Java Blue behavior remains the source of truth when current TypeScript behavior differs.
- The processor catalog is the Java plugin catalog, not every helper class in the Java note-processor package.
- PythonProcessor, Jython runtime integration, and broader Python/Jython parity are deferred to a later feature; this slice only preserves and labels existing PythonProcessor XML.
- Audio-only layer groups remain out of scope for editable note-processor chains unless Java parity research proves they should own a chain.
- The chain editor may be implemented as an embedded panel, modal dialog, or shared reusable component, provided all required workflows are available from the expected score surfaces.
- The feature includes application, data-model, and UI work; later visual polish may be separate only if all parity workflows are functionally present.
