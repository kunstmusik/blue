# Feature Specification: Mixer Follow-Up

**Feature Branch**: `035-mixer-follow-up`  
**Created**: 2026-05-01  
**Status**: Closed — routing and library workflow retained; playback-aware/windowing scope withdrawn and superseded by later specifications (2026-09-13)
**Input**: User description: "Plan the next mixer follow-up slice after the core mixer editor. Keep SQLite and durable user-library storage out of scope for now because that work should happen later across all user libraries together."

## Scope Disposition

Spec 035 retains User Stories 1 and 2: routing and chain editing, plus the
session-local effects-library workflow. The former playback-aware and
windowing-polish story is withdrawn. Its test-only `MixerPlaybackUiState`
selector was never consumed by production code and has been removed.

Related later specifications now own those concerns: [Spec 104](../104-mixer-metering/spec.md),
[Spec 105](../105-meter-presentation-calibration/spec.md), and [Spec 107](../107-channel-strip-layout/spec.md)
cover realtime mixer playback and meter presentation; [Spec 089](../089-fix-popout-portals/spec.md)
and [Spec 103](../103-global-undo-redo/spec.md) cover later window and editor behavior.
Do not revive the withdrawn scope from Spec 035. Any future work not covered by
those specifications must begin in a new, explicit specification with its own
scope and acceptance criteria.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Refine Routing And Chain Editing (Priority: P1)

As a composer working on larger mixer setups, I need safer routing and richer chain editing so I can reorganize channels, subchannels, sends, and effect entries without creating invalid or confusing states.

**Why this priority**: Once the core Mixer panel exists, routing and chain ergonomics become the main daily friction point. Invalid self-routing or awkward reordering would undermine the usefulness of the core editor.

**Independent Test**: Open the Mixer panel, attempt invalid send or output routings, drag or move chain entries across compatible positions, duplicate or paste entries, and confirm the UI preserves valid routings while surfacing clear guidance for rejected actions.

**Acceptance Scenarios**:

1. **Given** a channel or subchannel has routing options, **When** the user selects an invalid self-referential or feedback-prone target, **Then** the UI blocks or warns on that routing using Java Blue-compatible constraints.
2. **Given** a chain contains multiple effects and sends, **When** the user reorders, duplicates, copies, pastes, or moves entries between compatible positions, **Then** the resulting chain remains valid and updates the canonical project mixer.
3. **Given** the project contains subchannels and multiple strips, **When** the user changes routing-related fields, **Then** the app keeps available destinations synchronized with the current mixer topology.

---

### User Story 2 - Polish Effects Library Workflow Without Persistence Redesign (Priority: P1)

As a composer building a session from my effects library, I need richer session-local library tools such as reload, import/export, copy/paste, and drag/drop organization so I can curate the library during development without changing how user libraries are durably stored.

**Why this priority**: The core spec intentionally stops at safe session-local mutation. The next practical step is to make that session workspace more usable without committing to a long-term storage backend.

**Independent Test**: Open the effects library modal, reorganize categories with drag/drop, copy or duplicate effects, import or export an effect file, reload the source XML from disk, and confirm the session updates while the durable library path remains unmanaged by the app.

**Acceptance Scenarios**:

1. **Given** the effects library session is loaded, **When** the user reorganizes categories or effects with drag/drop or copy/paste commands, **Then** the library workspace updates immediately and remains session-local.
2. **Given** the user imports or exports an effect definition through explicit file actions, **When** the command completes, **Then** the imported or exported file reflects the selected effect content without implying a save back to the user's library source path.
3. **Given** the library session contains unsaved mutations, **When** the user triggers reload, **Then** the app makes it clear that the in-memory session will be discarded and the source XML will be reparsed.

### Edge Cases

- What happens when routing validation depends on channels or subchannels that are removed while a menu or dropdown is still open?
- What happens when the user pastes chain entries into a strip that cannot accept the referenced send target or effect shape?
- What happens when an effect import file is malformed or incompatible with the current TypeScript effect model?
- What happens when the user reloads the effects library while effect editors for library-owned items are still open?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The implementation MUST review the Java Blue follow-up parity anchors for mixer routing, popup menus, effects-library drag/drop, and import/export before coding begins.
- **FR-002**: The mixer workflow MUST validate and clearly message invalid routing targets such as self-routing or feedback-prone send configurations within the scope supported by the current mixer model.
- **FR-003**: The mixer UI MUST support richer chain editing flows such as duplicate, copy, paste, and drag-based reordering or compatible movement.
- **FR-004**: Available routing destinations in the UI MUST stay synchronized with current channels and subchannels so outdated targets are not offered after topology changes.
- **FR-005**: The effects-library workflow MUST support session-local reorganization, copy/paste, drag/drop movement, reload, and explicit import/export commands.
- **FR-006**: Import and export flows MAY read from or write to user-chosen files, but the app MUST NOT introduce durable effects-library persistence or write session mutations back to the canonical `~/.blue` source path in this spec.
- **FR-007**: SQLite or any other new persistent storage backend for user libraries MUST remain out of scope for this spec.
- **FR-009**: Routing and session-library changes MUST preserve the one-window-per-owner behavior established in Spec 034; this spec adds no new effect-window focus or lifecycle behavior.
- **FR-010**: The implementation MUST add tests covering routing validation, advanced chain editing, and library import/export and reload behavior.

### Key Entities *(include if feature involves data)*

- **Routing Validation State**: Computed warnings or hard failures for channel/subchannel/send targets based on the current mixer topology.
- **Chain Clipboard Payload**: Serializable representation of one or more effect/send entries that can be duplicated, copied, pasted, or moved.
- **Effects Library Workspace State**: Session-local selection, drag context, and import/export operations on top of the no-save library session introduced in Spec 034.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can attempt invalid routing changes and receive clear guidance while valid routing changes continue to work.
- **SC-002**: A reviewer can duplicate, copy, paste, reorder, and move compatible chain entries without corrupting the visible chain or canonical project mixer.
- **SC-003**: A reviewer can reorganize the effects library session, import or export explicit effect files, reload the session from disk, and confirm no automatic save-to-library behavior exists.
- **SC-005**: Automated tests cover routing validation, advanced chain editing, and library workflow polish.

## Assumptions

- Spec 034 has already delivered the core Mixer panel, session-owned effects library, and non-modal effect editor windows.
- Durable user-library persistence remains a future cross-library initiative and is intentionally not part of this spec.
- Import/export can use explicit user-selected files without implying ownership of the user's canonical library storage.
