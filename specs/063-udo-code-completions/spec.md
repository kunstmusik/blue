# Feature Specification: Context-Aware UDO Code Completions

**Feature Branch**: `063-udo-code-completions`

**Created**: 2026-07-26

**Status**: Complete

**Input**: User description: "Extend the code editor completion system so orchestra-code editors offer UDOs available within the current instrument together with the project-global UDOs shown in the Global UDO panel. Review the existing completion analysis and code editor usage, determine how each relevant editor can access those UDOs, and specify the work. Effects can also own UDOs, so their code and embedded UDO editors must receive the appropriate completions. UDOs can be polymorphic like native opcodes, so same-name UDOs with different input or output signatures need separate entries, while a local UDO can shadow the equivalent global UDO. Incorporate relevant findings from the codebase review, especially full-signature candidate data, editor-context wiring, document-local interactions, signature normalization, ownership-based effect scope, and explicit non-orchestra exclusions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use Available UDOs While Writing Orchestra Code (Priority: P1)

As a composer writing Csound orchestra code for an instrument, I can select the instrument's embedded UDOs and the project's global UDOs from code completion so I do not need to memorize or copy their names.

**Why this priority**: Instrument code is the primary place where embedded UDOs are called. Combining the two UDO scopes removes the largest authoring gap while preserving the reusable completion behavior composers already use for built-in opcodes.

**Independent Test**: Open an instrument that has one embedded UDO in a project that has one global UDO, request completion in each of the instrument's editable orchestra-code fields, and confirm both names are offered and can be inserted.

**Acceptance Scenarios**:

1. **Given** a Generic Instrument contains an embedded UDO and the project contains a global UDO, **When** the user requests completion in the Instrument or Global Orc field, **Then** both UDO names are offered.
2. **Given** a JavaScript Instrument contains an embedded UDO and the project contains a global UDO, **When** the user requests completion in its Global Orc field, **Then** both UDO names are offered without adding Csound completions to its JavaScript source field.
3. **Given** a BlueSynthBuilder instrument contains an embedded UDO and the project contains a global UDO, **When** the user requests completion in its Instrument, Always On, or Global Orc field, **Then** both UDO names are offered.
4. **Given** a project Sound score object contains a BlueSynthBuilder instrument with an embedded UDO, **When** the user requests completion in its Instrument, Always On, or Global Orc field, **Then** the embedded and project-global UDO names are offered.
5. **Given** the project contains a global UDO, **When** the user requests completion in Global Orchestra, **Then** the global UDO name is offered without UDOs owned only by individual instruments or effects.
6. **Given** an available UDO completion is selected, **When** the completion is applied, **Then** the UDO's authored name is inserted using the editor's existing completion interaction.

---

### User Story 2 - Use UDOs While Authoring UDOs and Effects (Priority: P1)

As a composer authoring a UDO body or mixer effect, I can complete calls to other UDOs available in that editing context, including project-global UDOs, so nested UDO workflows are discoverable and consistent with instrument editing.

**Why this priority**: UDOs frequently build on other UDOs, and effects have their own embedded UDO collection. Leaving these editors disconnected would make the completion behavior inconsistent across equivalent orchestra-code workflows.

**Independent Test**: Request completion in project-global and instrument-embedded UDO bodies, then edit a project effect in place and in the separate Effect Editor window, edit one of that effect's embedded UDO bodies, and edit a standalone library effect. Verify that every effect code surface offers its effect-owned UDOs and that only project-owned effect contexts also offer project-global UDOs.

**Acceptance Scenarios**:

1. **Given** the Global UDO panel contains multiple UDOs, **When** the user edits one UDO's code body and requests completion, **Then** the project-global UDO names are offered, including the current UDO name when recursive use is intentional.
2. **Given** an instrument's embedded UDO list contains multiple UDOs and the project contains global UDOs, **When** the user edits an embedded UDO body and requests completion, **Then** the containing instrument's UDO names and the project-global UDO names are offered.
3. **Given** a project mixer effect contains embedded UDOs and the project contains global UDOs, **When** the user requests completion in the effect's Code tab in the in-place mixer editor, **Then** the effect-owned and project-global UDO names are offered.
4. **Given** that same project mixer effect is opened in the separate Effect Editor window, **When** the user requests completion in its Code tab, **Then** the same effect-owned and project-global UDO names are offered.
5. **Given** a project mixer effect contains multiple embedded UDOs, **When** the user edits one of those UDO code bodies and requests completion, **Then** the effect's UDO names and the project-global UDO names are offered.
6. **Given** a standalone library effect contains embedded UDOs, **When** the user requests completion in its Code tab or an embedded UDO code body, **Then** the library effect's UDO names are offered and UDOs from an unrelated open project are absent.
7. **Given** a standalone library instrument or Sound object contains embedded UDOs, **When** the user edits one of those UDO code bodies and requests completion, **Then** the asset's embedded UDO names are offered and UDOs from an unrelated open project are absent.

---

### User Story 3 - Choose the Correct Polymorphic UDO (Priority: P1)

As a composer using polymorphic UDOs, I can distinguish and select every available overload by its input and output signature, even when several UDOs share the same authored name.

**Why this priority**: A name-only completion entry hides callable overloads and can direct the composer toward the wrong rate or argument combination. UDO completion is only reliable when it represents signatures as native opcode completion does.

**Independent Test**: Define same-name UDOs with different input signatures, different output signatures, one exact local/global signature overlap, and one overlapping declaration in the active document. Request completion from a local context and verify that every distinct callable signature appears, each entry exposes its input and output signature, and exact duplicates resolve according to the defined source precedence.

**Acceptance Scenarios**:

1. **Given** two available UDOs have the same name and different input type signatures, **When** completion is requested for that name, **Then** both overloads appear as separate entries.
2. **Given** two available UDOs have the same name and different output type signatures, **When** completion is requested for that name, **Then** both overloads appear as separate entries.
3. **Given** multiple same-name overloads are offered, **When** the user reviews the completion list, **Then** every entry shows enough input and output signature information to distinguish it from the other overloads.
4. **Given** a context-local UDO and a project-global UDO have the same name and equivalent input and output signatures, **When** completion is requested from the local context, **Then** only the context-local overload represents that callable signature.
5. **Given** a context-local UDO and a project-global UDO have the same name but different input or output signatures, **When** completion is requested from the local context, **Then** both overloads remain available and their scopes are distinguishable.
6. **Given** equivalent classic and modern declarations describe the same name and callable signature within one scope, **When** completion is requested, **Then** they produce one overload entry rather than two formatting-based duplicates.
7. **Given** equivalent type lists differ only by whitespace, comma placement, grouping parentheses, no-output spelling, declaration style, or argument variable names, **When** completion is requested, **Then** they are treated as the same callable signature.
8. **Given** a document-local declaration duplicates an available context-owned or project-global UDO name and callable signature, **When** completion is requested, **Then** one entry is shown from the highest-precedence UDO source while distinct overloads from every source remain visible.
9. **Given** a UDO and a native opcode share the same name, **When** completion is requested, **Then** the native opcode and each UDO overload remain separate and distinguishable.
10. **Given** the user selects any overload entry, **When** completion is applied, **Then** the authored UDO name is inserted and the selected overload's signature remains available as completion guidance.

---

### User Story 4 - Keep Completion Scope Current and Predictable (Priority: P2)

As a composer moving between projects, instruments, effects, and UDO editors, I see only the UDOs available to the active orchestra-code context, and completion updates immediately when those UDOs change.

**Why this priority**: Stale or cross-context suggestions are worse than missing suggestions because they lead users toward names that will not behave as expected in the active context.

**Independent Test**: Add, rename, remove, reorder, and convert UDOs; switch among instruments and projects; and verify that the next completion request reflects the active context without an application or project reload.

**Acceptance Scenarios**:

1. **Given** a UDO is added, renamed, or removed in the project-global or current embedded UDO list, **When** the user next requests completion in an affected editor, **Then** the suggestions reflect the updated names.
2. **Given** a UDO is reordered or its declaration style is converted without changing its callable signature, **When** the user requests completion, **Then** the same overload remains available without a formatting-based duplicate.
3. **Given** the user switches from one instrument or effect to another, **When** completion is requested, **Then** UDOs from the previous context are absent and UDOs from the new context are present.
4. **Given** a local UDO shadows a project-global UDO with the same name and callable signature, **When** the local UDO is removed or its signature changes, **Then** the formerly shadowed global overload becomes available on the next completion request.
5. **Given** a standalone library instrument, Sound object, effect, or UDO is being edited, **When** completion is requested, **Then** UDOs owned by that library asset are available but UDOs from an unrelated open project are absent.
6. **Given** a UDO name is empty, whitespace-only, or cannot be inserted as one UDO identifier, **When** completion is requested, **Then** that name is absent.
7. **Given** a valid UDO name has an incomplete signature while it is being edited, **When** completion is requested, **Then** it remains discoverable as an incomplete overload and updates when the signature becomes complete.
8. **Given** no project is loaded or no UDOs are available to the active context, **When** completion is requested, **Then** existing non-UDO completions continue to work and no stale UDO names appear.

---

### User Story 5 - Preserve Existing Editor and Project Behavior (Priority: P3)

As a composer using built-in opcode, Blue opcode, variable, replacement-key, or document-local completions, I retain the existing behavior while context-aware UDO names are added.

**Why this priority**: The new suggestions extend a shared editor surface. They must not regress established completion categories, editing behavior, project persistence, or CSD generation.

**Independent Test**: Run the existing completion scenarios before and after supplying local and global UDO context, save and reopen the project, and generate CSD to confirm that only the transient suggestion list has changed.

**Acceptance Scenarios**:

1. **Given** an orchestra-code editor has UDO context, **When** completion is requested, **Then** the existing built-in opcode, Blue opcode, variable, replacement-key, and document-local suggestions remain available under their existing conditions.
2. **Given** the user edits UDO definitions or orchestra text and saves the project, **When** the project is reopened, **Then** existing project data and generated CSD behavior are unchanged by the completion feature.
3. **Given** the user opens a score-only, plain-text, non-Csound, table, or read-only generated-code editor, **When** they use that editor, **Then** this feature does not add context-aware orchestra UDO suggestions there.
4. **Given** the user edits a Generic Instrument, JavaScript Instrument, or BlueSynthBuilder Global Sco field, **When** completion is requested, **Then** context-aware UDO suggestions are absent because the field contains score code.
5. **Given** the user edits a JavaScript Instrument source field, **When** completion is requested, **Then** Csound UDO suggestions are absent and the field retains its JavaScript-specific behavior.

### Edge Cases

- An embedded UDO and a project-global UDO use the same authored name and the same callable signature.
- Same-name UDOs differ only in input types, only in output types, or in both.
- Classic and modern declarations express equivalent signatures using different formatting or argument names.
- A UDO signature is incomplete or temporarily invalid while its definition is being edited.
- A UDO shares a name with a native opcode that has its own overloads.
- Multiple UDO entries contain the same name and signature, an empty name, whitespace, or a name that is not valid as a completion token.
- A UDO is renamed while an orchestra-code editor remains mounted and focused.
- The selected UDO is removed while its code body editor is open.
- An instrument or effect is replaced, deleted, disabled, or switched while completion is open.
- The same effect is open in both the in-place mixer editor and the separate Effect Editor window when one of its UDOs is changed.
- A project is closed or replaced while an editor from the previous project is still mounted.
- A document-local UDO declaration overlaps a supplied local or project-global UDO name.
- A document-local UDO declaration matches an available UDO exactly while another same-name overload has a different signature.
- Classic joined type strings, comma-separated type strings, modern argument declarations, no-output spellings, and array or optional-rate modifiers describe equivalent or distinct signatures.
- A modern input argument has an explicit type annotation, a type inferred from its variable name, a default value, or an argument whose type cannot yet be derived.
- A standalone library asset is edited while a project with similarly named global UDOs is open.
- The containing UDO list is large enough that suggestion construction could affect typing responsiveness.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST derive signature-bearing UDO completion candidates from the full definitions in the active project's current global UDO collection and, where applicable, the active instrument's or effect's current embedded UDO collection; name-only candidate data is insufficient.
- **FR-002**: Generic Instrument orchestra code and Global Orc editors MUST offer the instrument's embedded UDO names together with project-global UDO names.
- **FR-003**: JavaScript Instrument Global Orc editors MUST offer the instrument's embedded UDO names together with project-global UDO names, while JavaScript source editing MUST retain its language-specific behavior.
- **FR-004**: BlueSynthBuilder Instrument, Always On, and Global Orc editors MUST offer the instrument's embedded UDO names together with project-global UDO names while retaining existing replacement-key completion. This includes BlueSynthBuilder instruments embedded in project Sound score objects.
- **FR-005**: Every project mixer effect Code tab MUST offer the effect's embedded UDO names together with project-global UDO names while retaining existing replacement-key completion, whether the effect is edited in place or in the separate Effect Editor window.
- **FR-006**: Every project mixer effect embedded UDO code body MUST offer names from its containing effect UDO collection together with project-global UDO names.
- **FR-007**: Every standalone library effect Code tab and embedded UDO code body MUST offer names from that effect's embedded UDO collection and MUST NOT offer project-global UDOs merely because another project is open.
- **FR-008**: A project-global UDO body editor MUST offer names from the project-global UDO collection.
- **FR-009**: An instrument-embedded UDO body editor MUST offer names from its containing embedded UDO collection together with project-global UDO names.
- **FR-010**: The Global Orchestra editor MUST offer project-global UDO names and MUST NOT infer an instrument-local UDO scope.
- **FR-011**: Standalone library instrument and Sound object code editors, including their embedded UDO body editors, MUST offer UDOs embedded in the asset being edited and MUST NOT offer project-global UDOs merely because another project is open.
- **FR-012**: A standalone library UDO body editor MUST offer its own name for intentional recursion and MUST NOT offer UDOs from an unrelated open project.
- **FR-013**: UDO completion candidates MUST reflect the latest active project and editor context on the next completion request after a UDO is added, renamed, removed, reordered, or converted, or after the active instrument, effect, UDO, library asset, editor window, or project changes.
- **FR-014**: UDO completion identity MUST use the authored name together with normalized ordered input and output type-token sequences rather than the name alone.
- **FR-015**: Every same-name UDO with a distinct input signature, output signature, or both MUST appear as a separate completion entry.
- **FR-016**: Every UDO completion entry MUST display its input and output signature and identify its document-local, context-owned, or project-global source when multiple sources contribute same-name overloads.
- **FR-017**: A context-local UDO MUST shadow a project-global UDO only when their authored names and normalized callable input and output signatures are equivalent.
- **FR-018**: A context-local same-name overload MUST NOT hide project-global overloads with different input or output signatures.
- **FR-019**: Equivalent same-name signatures repeated within one completion source MUST appear once for that overload, regardless of declaration style, formatting, or argument variable names.
- **FR-020**: A validly named UDO with an incomplete signature MUST remain discoverable with its available signature information marked incomplete and MUST NOT be merged with a complete overload.
- **FR-021**: Empty, whitespace-only, and names that cannot be inserted as one UDO identifier MUST NOT be offered as completion candidates.
- **FR-022**: Applying a UDO completion MUST insert the UDO's authored name without changing the UDO definition or project data.
- **FR-023**: Existing built-in opcode, Blue opcode, variable, replacement-key, document-local, and externally supplied completion behavior MUST remain available under the same conditions.
- **FR-024**: UDO and native opcode entries with the same name MUST remain distinguishable by their source and signature rather than being collapsed by name.
- **FR-025**: Context-aware UDO completion MUST be limited to editable orchestra-code and UDO-definition contexts where the available UDO scope is known. Generic Instrument, JavaScript Instrument, and BlueSynthBuilder Global Sco fields; JavaScript source; score-only, plain-text, non-Csound, table, Blue Live, and read-only generated-code contexts are outside this feature.
- **FR-026**: The feature MUST handle an unloaded, closing, or newly switched project without errors or suggestions retained from the prior project.
- **FR-027**: Focused automated coverage MUST verify the editor-scope matrix, full-signature candidate propagation, local-plus-global aggregation, polymorphic overload preservation, normalization, signature and source display, cross-source precedence, exact-signature shadowing, native-name coexistence, effect editor parity across in-place and separate-window contexts, library isolation, live updates, context switching, invalid-name filtering, explicit score and JavaScript exclusions, and preservation of existing completion categories.
- **FR-028**: Document-local UDO declarations discovered in the active editor text, context-owned UDO definitions supplied by an instrument or effect, and project-global UDO definitions MUST remain distinct completion sources; scanning the active document MUST NOT substitute for supplying the containing UDO collections.
- **FR-029**: When the same authored UDO name and normalized callable signature occurs in multiple UDO sources, completion MUST show one entry from the highest-precedence source in this order: context-owned, project-global, then document-local.
- **FR-030**: Source precedence MUST suppress only exact UDO identity duplicates; same-name overloads with different normalized input or output signatures MUST remain visible regardless of source.
- **FR-031**: For equally matching text, context-owned UDO entries MUST rank ahead of project-global UDO entries, project-global UDO entries ahead of document-local UDO entries, and document-local UDO entries ahead of native opcode entries.
- **FR-032**: Signature normalization MUST compare ordered type tokens after trimming insignificant whitespace, separators, and grouping; treat equivalent no-output spellings as no output; derive modern input types from explicit annotations before established argument-rate notation; ignore argument names and default values; preserve semantically meaningful token order and modifiers; and classify a signature as incomplete rather than guessing when a type cannot be derived.
- **FR-033**: Whether project-global UDOs are included in an effect editor MUST be determined by whether the edited effect is project-owned or library-owned, not merely by whether a project happens to be open.

### Completion Scope Matrix

| Editing surface | Context-owned UDOs | Project-global UDOs |
|---|---:|---:|
| Global Orchestra | No | Yes |
| Project Generic Instrument: Instrument and Global Orc | Yes | Yes |
| Project JavaScript Instrument: Global Orc | Yes | Yes |
| Project BlueSynthBuilder: Instrument, Always On, and Global Orc | Yes | Yes |
| Project Sound object's embedded BlueSynthBuilder: Instrument, Always On, and Global Orc | Yes | Yes |
| Project mixer effect Code tab, in-place editor | Yes | Yes |
| Project mixer effect Code tab, separate Effect Editor window | Yes | Yes |
| Project mixer effect embedded UDO code body | Yes | Yes |
| Project-global UDO body | No separate context-owned source | Yes; include the current UDO and show each distinct overload once |
| Project instrument or Sound object embedded UDO code body | Yes | Yes |
| Standalone library effect Code tab | Yes | No |
| Standalone library effect embedded UDO code body | Yes | No |
| Standalone library instrument or Sound object orchestra-code fields | Yes | No |
| Standalone library instrument or Sound object embedded UDO code body | Yes | No |
| Standalone library UDO body | Current UDO only | No |

### Overload and Shadowing Rules

| Available definitions | Completion result |
|---|---|
| Same name, different input signatures | One entry for each input overload |
| Same name, different output signatures | One entry for each output overload |
| Same name, equivalent signature in local and global scopes | One entry for the local overload |
| Same name, different signatures in local and global scopes | All distinct local and global overloads |
| Equivalent name and signature repeated within one scope | One entry for that overload |
| Equivalent classic and modern callable signatures within one scope | One entry for that overload |
| Exact UDO identity repeated across completion sources | One entry from the highest-precedence UDO source |
| Same name with different signatures across completion sources | All distinct overloads |
| UDO and native opcode share a name | Separate entries identified by source and signature |
| Valid UDO name with an incomplete signature | A distinct entry marked with the available incomplete signature |

### Completion Source and Precedence Rules

| Precedence | UDO source | Meaning |
|---:|---|---|
| 1 | Context-owned | Definitions in the embedded UDO collection owned by the current instrument, Sound object's instrument, or effect |
| 2 | Project-global | Definitions in the active project's Global UDO collection |
| 3 | Document-local | UDO declarations found in the active editor text |

Precedence resolves only an exact duplicate of authored name plus normalized input/output signature. It does not collapse polymorphic overloads, and it does not collapse a UDO with a native opcode. Within equally matching completion text, UDO entries follow the source order above and remain ahead of native opcode entries.

### Signature Normalization Rules

| Declaration variation | Normalized behavior |
|---|---|
| Insignificant leading/trailing whitespace, spaces around separators, or grouping parentheses | Ignored when deriving the ordered type-token sequences |
| Classic joined or separated type lists | Compared as the same ordered type tokens when their Csound type meaning is equivalent |
| Modern input arguments | Compared by their ordered declared or inferable type tokens; explicit type annotations take precedence, while variable names and default values are ignored |
| Empty output, `0`, `void`, or `()` where valid for the declaration style | Treated as no output |
| Type order, array notation, optional-rate markers, or other semantically meaningful type modifiers | Preserved and allowed to distinguish overloads |
| Type information that cannot yet be derived from an in-progress declaration | Marked incomplete and kept distinct from complete signatures |

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue stores each UDO's declaration style, authored name, input declaration, and output types in project-global, instrument, and effect UDO collections. Native opcode completion presents callable signatures, and Csound permits callable overloads. During CSD generation, the global UDO collection is the initial set; instrument and effect UDOs are merged into that set, with equivalent definitions reused and colliding definitions renamed while affected generated code is rewritten. The existing completion system supports built-in, Blue-specific, document-local, replacement-key, and externally supplied project-name candidates. Its externally supplied UDO path currently carries names rather than full signatures, collapses entries by label, and is not yet populated with complete project and owner-specific UDO definition data by the eligible editors. UDO body editors likewise do not yet receive their containing UDO scope, and effect ownership is not yet used to condition completion scope.
- **Compatibility Requirements**: The feature MUST preserve Java-compatible `.blue` XML, every authored UDO definition and signature stored in the project, the canonical project mutation workflow, and existing CSD generation, collision-resolution, and code-rewrite behavior. Completion MUST use authored names and declaration signatures and MUST remain advisory rather than changing compile-time UDO resolution. Completion shadowing MUST NOT alter persisted UDO order, names, or generation-time renaming.
- **Intentional Divergences**: Blue will provide context-aware UDO completion even though an equivalent UDO completion workflow was not found in the inspected Java Blue editor UI. This is an intentional authoring improvement; the definition of which UDOs are available remains grounded in Java Blue's project, instrument, effect, and generation model.
- **State Ownership**: The active project document remains the canonical owner of project-global and project-embedded UDO definitions and persists them in `.blue` XML. Library assets remain independent owners of their embedded definitions. Completion candidates are derived, transient editor-session state and MUST NOT create a second persisted UDO collection.

### Key Entities *(include if feature involves data)*

- **Project-global UDO collection**: The UDO definitions shown in the Global UDO panel and available at project scope.
- **Embedded UDO collection**: The UDO definitions owned by the current instrument, Sound object's instrument, effect, or standalone library asset and available while authoring that owner.
- **Orchestra-code context**: An editable code field whose UDO scope is known, such as Global Orchestra, an instrument orchestra field, an effect body, or a UDO body.
- **UDO completion candidate**: A transient suggestion derived from an authored UDO name, callable signature, and source and made available in an eligible orchestra-code context.
- **UDO callable signature**: The normalized input and output type combination used to distinguish callable overloads; argument variable names and declaration formatting do not create a new overload.
- **UDO overload**: One callable UDO entry identified by its authored name and callable signature.
- **Shadowed global overload**: A project-global overload omitted from a local completion list because a context-local UDO has the same authored name and equivalent callable signature.
- **Completion scope**: The ordered combination of document-local, context-local, and project-global overloads that applies to one editor instance.
- **Completion source**: The origin of a candidate—document-local text, the current owner, or the active project's global collection—used for display, precedence, and isolation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of the defined editor-scope acceptance cases, completion offers every valid UDO overload available to that context and offers no UDO overload owned only by a different instrument or effect.
- **SC-002**: After a UDO add, rename, removal, reorder, style conversion, context switch, or project switch, the next completion request reflects the current state without requiring an application or project reload.
- **SC-003**: In 100% of tested polymorphic and cross-source cases, every distinct same-name input/output signature appears once, equivalent declaration forms normalize to one identity, an exact duplicate resolves to the highest-precedence UDO source, and other overloads remain available.
- **SC-004**: All existing completion-category regression scenarios continue to pass after context-aware UDO candidates are supplied, and 100% of the named score, JavaScript, plain-text, table, Blue Live, and read-only exclusions remain free of context-aware UDO suggestions.
- **SC-005**: With 500 project-global UDOs and 100 context-local UDOs, completion suggestions appear within 100 milliseconds of a request in at least 95% of measured local runs on a supported development machine.
- **SC-006**: Saving, reopening, and generating CSD for representative projects with global and embedded UDOs produces the same persisted definitions and generated behavior as before the completion feature.

## Assumptions

- "Global UDOs" means the project-owned UDO definitions displayed by the Global UDO panel.
- "Current instrument UDOs" means only the embedded UDO collection owned by the instrument whose orchestra code is being edited; UDOs embedded in other instruments are not suggested.
- Effects follow the same contextual rule as instruments because they own embedded UDOs and compile those UDOs into their generated effect definitions. This applies to both the effect's main Code tab and the code editor for each embedded UDO.
- A project effect has the same completion scope in the in-place mixer editor and the separate Effect Editor window.
- UDO body completion includes the current UDO name because recursive UDO calls can be intentional.
- Completion displays normalized input and output type signatures for overload selection, but applying a completion inserts the authored UDO name only. Argument templates, automatic imports, code-repository search, and navigation to a UDO definition are outside scope.
- Classic and modern declarations with the same authored name and semantically equivalent input/output types represent the same callable overload even when their formatting or argument variable names differ.
- "Local shadowing" in this feature means suppressing only the equivalent global completion entry. It does not change CSD generation or persisted UDO definitions.
- Document-local scanning remains a separate convenience for UDO declarations written in the active text. It does not provide access to UDO definitions stored in the containing instrument, effect, or project collections.
- When exact UDO identities overlap across sources, the owner-provided definition is assumed to be more authoritative than the project-global definition, and the project-global definition more authoritative than a declaration inferred from active editor text. Different signatures remain separate overloads.
- A library asset is edited independently from the currently open project, so project-global UDOs are not assumed to travel with or be available to that asset.
- Blue Live code, table text, score code, generated previews, and non-Csound source fields are outside scope until their runtime UDO availability and language semantics are specified independently.
- Completion candidates are refreshed from the current editing context; the feature introduces no new persistence, migration, or project-data format.
