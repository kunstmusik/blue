# Feature Specification: JMask Score Object Editor Parity

**Feature Branch**: `041-jmask-score-object-editor`  
**Created**: 2026-05-11  
**Status**: Complete
**Input**: User description: "Split the old grouped Tier 2 score-object follow-up so `JMask` gets its own deeper planning slice, with explicit Java Blue UI/UX analysis reflected in the task breakdown."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build JMask Parameters From A Real Editor Stack (Priority: P1)

As a composer using `JMask`, I need a real parameter-editor stack with the Java-style top bar, parameter row menus, rename flow, visibility controls, reorder workflow, and generator selection so I can build generative note behavior from the auxiliary editor instead of seeing seed controls only.

**Why this priority**: The current `JMask` surface is materially incomplete, and the Java editor is driven by a top bar plus deep parameter list workflow rather than a small form.

**Independent Test**: Select a `JMask`, use the top bar and parameter-row context menu to add, remove, rename, reorder, hide, and retarget supported parameters, then verify the canonical object updates while the scrollable editor shell stays synchronized.

**Acceptance Scenarios**:

1. **Given** a `JMask` object is selected, **When** the auxiliary editor opens, **Then** it shows the Java-style top bar plus a real parameter-stack workflow instead of seed controls only.
2. **Given** the user adds, removes, renames, hides, reorders, or edits supported parameters, **When** the change commits, **Then** the canonical `JMask` model updates and the editor refreshes coherently.

---

### User Story 2 - Configure Generators And Optional Sections (Priority: P1)

As a composer shaping `JMask` behavior, I need the generator editors, optional mask, quantizer, accumulator, probability, and table-driven controls that Java Blue exposes so I can configure how each parameter is generated.

**Why this priority**: `JMask` parity is not credible without the generator families and per-parameter sections that differentiate it from a basic generator form.

**Independent Test**: Change a parameter between supported generator types, enable the supported optional sections for that generator, edit their controls, and verify the canonical parameter data remains synchronized and survives save or reload.

**Acceptance Scenarios**:

1. **Given** a parameter uses one of Java Blue's generator families, **When** the user selects that generator, **Then** the editor shows the correct generator sub-editor or an explicit deferred state for unsupported pieces.
2. **Given** a parameter supports mask, quantizer, accumulator, probability, or table configuration, **When** the user enables or edits that section, **Then** the canonical `JMask` data updates while unsupported fields remain deliberately surfaced.

---

### User Story 3 - Inspect Table-Based And Test-Oriented JMask Workflows (Priority: P2)

As a composer validating generative results, I need the table-based visualizations and the Java-style test flow where practical so I can inspect what the `JMask` object is doing from the editor itself.

**Why this priority**: The table and test workflows are important parity touchpoints, but they should land only after the model port and core parameter stack are planned clearly.

**Independent Test**: Edit a supported table-based control or invoke the test flow claimed by this slice, then verify the editor surfaces the result or a deliberate deferred state without losing nested generator data.

**Acceptance Scenarios**:

1. **Given** a selected parameter uses a supported table-based or probability-driven editor, **When** the user opens that section, **Then** the editor shows a deliberate visualization or form rather than hiding the data.
2. **Given** the user invokes the `JMask` test flow or preview claimed by this slice, **When** the result is returned, **Then** the UI shows the generated note output or an explicit deferred or failure state for the selected target.

### Edge Cases

- What happens when the selected `JMask` contains generator, probability, or modifier types that the renderer can preserve but not yet edit fully?
- What happens when the user reorders parameters while one parameter editor is expanded, hidden, or partially edited?
- What happens when the user tries to remove the protected first three parameter rows that Java Blue keeps in place?
- What happens when the user double-clicks a parameter label to rename it or hides a parameter through the top-bar visibility popup?
- What happens when a table-based editor contains more points than fit comfortably in the visible canvas or the user drags a point past its neighbor boundaries?
- What happens when the selected `JMask` target is removed while the user is editing a nested parameter form or preview is open?
- What happens when the `JMask` duration changes while duration-sensitive tables are open?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The implementation MUST review the Java Blue `JMask` UI/UX anchors before coding begins, including `JMaskEditor`, `EditorListPanel`, `JMaskEditorLayout`, `ParameterEditor`, `GeneratorRegistry`, `GeneratorEditorFactory`, `ProbabilityEditor`, `ProbabilityEditorFactory`, `MaskEditor`, `QuantizerEditor`, `AccumulatorEditor`, and `TableCanvas`.
- **FR-002**: `@blue/data` MUST grow the nested `JMask` field subsystem needed by the editor, including `Field`, `Parameter`, generator families, modifier sections, probability subtypes, table models, XML round-trip support, and any preview-generation seams this slice claims.
- **FR-003**: The score-object editor document contract MUST grow a dedicated `JMaskEditorSnapshot` that models the Java-style top bar, visibility popup, parameter-stack rows, generator unions, optional sections, and explicit unsupported-data markers instead of reusing the current seed-only structured payload.
- **FR-004**: The renderer MUST provide a scrollable parameter-editor stack with Java-style add before or after, remove, push up or down, change-type, double-click rename, visibility-toggle, and generator-selection workflows.
- **FR-005**: The implementation MUST define canonical patch boundaries for seed edits, parameter-list mutations, row visibility, row renaming, generator updates, optional-section toggles, probability selection, and supported nested table edits.
- **FR-006**: The editor MUST expose supported generator families in Java registry order: `Constant`, `Item List`, `Segment`, `Random`, `Probability`, and `Oscillator`, and it MUST document any deferred subset explicitly.
- **FR-007**: The editor MUST expose supported modifier and nested-section workflows such as mask, quantizer, accumulator, probability, and table-driven editors where the TypeScript model can support them honestly, including duration propagation for duration-sensitive editors.
- **FR-008**: The editor MUST preserve unsupported `JMask` data deliberately instead of silently flattening or dropping it from the model.
- **FR-009**: The implementation MUST add tests covering `@blue/data` round-trip and generation prerequisites, `JMask` document creation, parameter-stack rendering, menu and shortcut behavior, supported nested mutations, removed-target fallback behavior, and any preview or table workflows claimed by this slice.
- **FR-010**: Mode 2 MUST evaluate oscillator frequency tables across the full JMask generation duration and derive waveform phase from the authored curve. Mode 1 MUST retain Java's historical one-beat table behavior for existing projects. See the [oscillator compatibility rationale](research.md#oscillator-frequency-sweeps-in-mode-2).

### Key Entities *(include if feature involves data)*

- **JMaskEditorSnapshot**: The typed auxiliary-editor payload for `JMask`, including top-bar state, visibility controls, parameter-stack data, and declared editing capabilities.
- **JMaskParameterSnapshot**: The renderer-facing description of one parameter row, including visibility, protected-row status, generator type, nested optional sections, and unsupported-data markers.
- **JMaskGeneratorSnapshot**: A discriminated union for the six Java generator families plus their nested probability subtypes and table dependencies.
- **JMaskParameterMutation**: The canonical patch payload for one committed parameter-list, rename, visibility, generator, modifier, or table edit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can select a `JMask` object and use a real Java-style top bar plus parameter-stack editor instead of seed controls only.
- **SC-002**: A reviewer can use the parameter row menus and generator chooser to add, remove, rename, reorder, hide, and retarget supported parameters while observing coherent canonical updates.
- **SC-003**: A reviewer can edit the supported generator, modifier, probability, and table workflows without losing unsupported nested data.
- **SC-004**: A reviewer can use any preview workflow explicitly claimed by this slice and receive either generated note output or an explicit deferred state tied to the selected target.
- **SC-005**: Automated tests cover the `@blue/data` JMask subsystem, the `JMask` payload, parameter-stack routing, menu and shortcut behavior, supported nested mutations, removed-target fallback behavior, and any table or preview flows claimed by this slice.

## Closeout Notes

- Completed on 2026-05-16 on branch `041-jmask-score-object-editor`.
- Delivered a `@blue/data` `JMask` field subsystem with Java Blue-style `Field`, `Parameter`, generator, modifier, probability, table, XML round-trip, and note-generation support.
- Replaced the seed-only renderer with a Java-style `JMask` top bar, visibility popup, seed controls, scrollable parameter stack, row context menu, double-click rename, generator routing, optional mask/quantizer/accumulator sections, probability sub-editors, table editing, and generated-score preview modal.
- Final editor payload uses `JMaskEditorPayload` with `seedUsed`, `seed`, and a reload-safe `field` snapshot; renderer code derives the visibility menu, parameter rows, generator editors, modifier sections, and table editors from that canonical field snapshot.
- Added focused model and app tests for XML/save-load, generation prerequisites, snapshot restoration, app editor document creation, optimistic patching, canonical project patching, Java registry label handling, and modifier-default preservation.

## Assumptions

- Spec `040-pianoroll-score-object-editor` is already closed, so this slice can reuse its contract and test rigor while focusing on the heavyweight `JMask` editor gap.
- The `JMask` UI will require both dedicated model-port work in `@blue/data` and more dedicated form or canvas work than the existing generic structured editor shell can provide.
- The `Sound` and `PianoRoll` follow-up work will live in Specs `039-sound-score-object-editor` and `040-pianoroll-score-object-editor`, not in this slice.
