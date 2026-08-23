# Feature Specification: Score Object Editor Tier 1 Parity

**Feature Branch**: `038-score-object-editor-tier1-parity`  
**Created**: 2026-05-07  
**Status**: Complete
**Input**: User description: "Rework the score follow-up plan so the next slice covers the remaining moderate score-object editors before the broader score management/navigation work."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit External Score Objects Completely (Priority: P1)

As a composer using `External` score objects, I need the score-object editor to expose the command-line, syntax-type, code, and test affordances that Java Blue provides so I can configure and validate external score generation without leaving the editor panel.

**Why this priority**: `External` is already routed through a code-backed shell, so it is the smallest remaining parity gap and a good first follow-up after Spec 037.

**Independent Test**: Select an `External` score object, edit its code and command-line settings, change the syntax type, invoke the supported test affordance, and verify the canonical object updates without breaking selection or panel refresh.

**Acceptance Scenarios**:

1. **Given** an `External` score object is selected, **When** `ScoreObjectEditorTopComponent` loads, **Then** it shows the score text, command-line field, syntax-type selector, and any supported test action instead of the generic code-backed editor only.
2. **Given** the user changes the code, command line, or syntax type, **When** the edit is committed, **Then** the canonical score object updates and the auxiliary panels refresh against the updated data.

---

### User Story 2 - Inspect PolyObject Contents From The Auxiliary Editor (Priority: P1)

As a composer working with nested `PolyObject` containers, I need the auxiliary editor to show the child score-object list and generated-score preview that Java Blue provides so I can understand and validate the container contents without switching away from the score workflow.

**Why this priority**: `PolyObject` is central to score structure, and the current placeholder leaves one of the most important supported object types effectively uneditable from the auxiliary editor.

**Independent Test**: Select a `PolyObject`, inspect its child-object list and generated-score preview, trigger the supported test or open affordance, and verify the view stays synchronized with canonical score data.

**Acceptance Scenarios**:

1. **Given** a `PolyObject` is selected, **When** the editor panel opens, **Then** it shows a split auxiliary layout with a child-object browser and generated-score preview instead of a structured deferral message.
2. **Given** the `PolyObject` contents change through the score shell or auxiliary workflows, **When** the editor document refreshes, **Then** the child list and generated-score preview update without stale content.

---

### User Story 3 - Use A Real TrackerObject Editing Surface (Priority: P2)

As a composer using `TrackerObject`, I need the auxiliary editor to expose the missing toolbar and styled per-track editing surface from Java Blue so the tracker is usable for day-to-day note entry instead of acting like a bare table.

**Why this priority**: The current `TrackerObject` editor is present but significantly below parity; closing that gap makes the existing TypeScript model practically usable.

**Independent Test**: Select a `TrackerObject`, toggle the toolbar controls, edit track cells, adjust octave or note-label display, and verify the canonical object updates while preserving the current selection context.

**Acceptance Scenarios**:

1. **Given** a `TrackerObject` is selected, **When** the editor loads, **Then** it shows the Java-style tracker toolbar and per-track headers in addition to the editable cell grid.
2. **Given** the user changes tracker toolbar options or cell content, **When** the edit is applied, **Then** the canonical tracker data updates and the renderer refreshes coherently.

### Edge Cases

- What happens when the selected `PolyObject` is empty or contains child types that still have unsupported auxiliary editors?
- What happens when the `External` editor exposes a test affordance but the underlying runtime cannot execute the test in the current environment?
- What happens when a `TrackerObject` has more tracks or rows than comfortably fit in the auxiliary panel viewport?
- What happens when the selected object is removed while one of these Tier 1 editors is open?

### Intentional Divergences

- Java keeps the keyboard-note toggle and keyboard octave in `TrackerEditor`. Electron retains them as transient canonical `TrackerObject` session state so asynchronous editor-document refreshes do not reset the toolbar, but does not serialize them into Java-compatible `.blue` XML.
- Java uses Ctrl/Cmd+T to toggle a tracker tie. Electron preserves that shortcut and additionally accepts plain Space when focus is on the dedicated tie/status cell or tracker-grid background; data cells retain normal Space text entry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The implementation MUST review the Java Blue editors for `External`, `PolyObject`, and `TrackerObject` before coding begins, including their toolbar, preview, and test affordances.
- **FR-002**: The score-object editor document contract MUST grow dedicated payloads for `External`, `PolyObject`, and `TrackerObject` instead of routing them through the generic structured fallback payload only.
- **FR-003**: The `External` editor MUST expose the command-line field, syntax-type selector, code body, and supported test affordance needed for practical parity with Java Blue.
- **FR-004**: The `PolyObject` editor MUST expose a child score-object browser and generated-score preview, and it MUST integrate cleanly with the nested score-path capabilities already implemented in Spec 036.
- **FR-005**: The `TrackerObject` editor MUST expose the missing toolbar controls and styled per-track layout while preserving canonical mutation through existing score patch flows.
- **FR-006**: These Tier 1 editors MUST continue to use the existing auxiliary selection, on-demand document loading, and canonical `ScorePatch.updateTypeSpecificEditor` plumbing from Spec 037 rather than inventing separate mutation channels.
- **FR-007**: Unsupported or unavailable preview/test paths MUST degrade deliberately with clear messaging instead of silently dropping controls.
- **FR-008**: The implementation MUST add tests covering editor document creation, renderer routing, canonical mutation, and stale-selection fallback behavior for `External`, `PolyObject`, and `TrackerObject`.

### Key Entities *(include if feature involves data)*

- **ExternalEditorSnapshot**: The typed auxiliary-editor payload for `External`, including code text, command-line state, syntax type, and test capability metadata.
- **PolyObjectEditorSnapshot**: The typed auxiliary-editor payload for `PolyObject`, including child-object rows, generated-score preview text, and supported action metadata.
- **TrackerEditorSnapshot**: The typed auxiliary-editor payload for `TrackerObject`, including toolbar state, track headers, and cell-grid data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can select an `External` score object and edit more than just the score text, including command-line and syntax-related fields.
- **SC-002**: A reviewer can select a `PolyObject` and inspect its child objects and generated-score preview from the auxiliary editor without seeing a placeholder message.
- **SC-003**: A reviewer can use the `TrackerObject` toolbar and styled grid to make practical tracker edits that update canonical data.
- **SC-004**: Automated tests cover the Tier 1 editor-document payloads, renderer routing, mutation flows, and removed-target fallback behavior claimed by this slice.

## Assumptions

- Spec `037-score-object-editor-parity` has already delivered the common auxiliary panel shell, editor registry, and on-demand document loading that this slice extends.
- The Tier 1 editors can be completed with existing `@blue/data` models and do not require major new model-port work.
- Broader score-structure management, navigator workflows, and playback-follow polish are intentionally deferred to the later score-management/navigation spec.
