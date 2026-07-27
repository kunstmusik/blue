# Research: Context-Aware UDO Code Completions

## Decision 1: Carry full UDO definitions into the completion adapter

**Decision**: Replace the internal name-only project UDO option with two explicit collections of lightweight, signature-bearing definitions: context-owned UDOs and project-global UDOs. Each definition carries the authored name, declaration style, output types, classic input types, and modern input arguments.

**Rationale**:

- `JavaBlueCsoundCompletionOptions` currently carries `projectOpcodeNames?: string[]`, which cannot represent overloads or display signatures.
- No production editor currently supplies `projectOpcodeNames`; the field is exercised only by the completion test.
- Separate context and project collections make source precedence and library isolation explicit.
- The existing serializable `UdoDefinitionSnapshot` already contains all required source data. The editor-facing contract can use a narrower structural shape and must not carry UDO code or comments.

**Alternatives considered**:

- Continue passing names and parse definitions from generated orchestra text. Rejected because generated text is not the canonical live editor state and would lose owner/source identity.
- Pass `UdoDefinitionSnapshot` directly as the public editor adapter type. Rejected because code and comments are unnecessary completion data and would couple the reusable editor adapter to the full project document shape.
- Store a second renderer-wide UDO registry. Rejected because it would duplicate canonical project/library state and create stale-data risk.

## Decision 2: Put callable-signature normalization in the portable data package

**Decision**: Add a pure `@blue/data` helper that normalizes a classic or modern UDO declaration into ordered input/output type tokens plus a completeness flag. Export it through the existing static package entry point and cover it with focused unit tests.

**Rationale**:

- `packages/blue-data/src/opcodes/udo-type-utils.ts` already owns Java-compatible type parsing, no-output normalization, classic/modern conversion, array handling, optional-rate annotations, and input type derivation.
- Reimplementing those rules in the renderer would create a second interpretation of UDO signatures.
- The helper is browser-safe domain logic and does not depend on React, Electron, Node.js, or CodeMirror.
- A completeness flag prevents partially typed modern arguments from being guessed into a complete overload identity.

**Normalization contract**:

- Preserve authored name case; Csound identifiers remain case-sensitive.
- Normalize classic joined and comma-separated type forms to ordered tokens.
- Ignore insignificant whitespace, commas, and grouping parentheses.
- Normalize valid no-output spellings to an empty output-token list.
- For modern inputs, use an explicit type annotation when present; otherwise derive the established rate/type from the argument notation.
- Ignore argument variable names and default values after deriving the type.
- Preserve token order, array notation, optional-rate markers, and other semantic modifiers.
- Mark the signature incomplete if any required input/output type cannot be derived; incomplete and complete signatures never share an identity.

**Alternatives considered**:

- Use `OpcodeDefinition.isEquivalent()`. Rejected because generation equivalence also compares declaration style and code body, while completion overload identity intentionally compares name plus callable signature across classic/modern styles.
- Normalize only whitespace in the renderer. Rejected because classic/modern equivalence and optional/array modifiers require Csound-aware parsing.

## Decision 3: Aggregate and deduplicate UDOs before general completion rows

**Decision**: Build source-aware UDO candidates first, resolve exact UDO duplicates by identity and precedence, then convert them to CodeMirror completion rows. General completion deduplication must not collapse UDO overloads or a same-name native opcode.

**Rationale**:

- The current `dedupeCompletions()` uses `completion.label` alone, so it collapses every same-name overload and removes a same-name native opcode.
- UDO identity is `authored name + normalized ordered output tokens + normalized ordered input tokens + completeness state`.
- Precedence is context-owned, project-global, then document-local. It removes only an exact UDO identity duplicated across sources.
- Same-name definitions with different input or output tokens remain separate rows.
- Native opcode rows use a different category key and remain visible even when the label matches a UDO.

**Alternatives considered**:

- Encode signatures into the completion label and retain label-only deduplication. Rejected because it would change filtering and inserted text and would leak display formatting into identity.
- Allow every duplicate row and rely only on boost ordering. Rejected because exact duplicate UDOs would remain noisy and ambiguous.

## Decision 4: Show signatures while inserting only the authored name

**Decision**: Keep the CodeMirror filter label and `apply` value equal to the authored UDO name. Use the visible display label for `name (inputs) → outputs`, use detail text for `context UDO`, `project UDO`, or `document UDO`, and mark incomplete signatures visibly.

**Rationale**:

- The user must distinguish overloads before selection.
- Applying a UDO completion must not invent argument templates or alter project data.
- Keeping `label` as the name preserves prefix matching and the existing insertion interaction.
- Source detail resolves same-name overloads contributed by different collections.

**Ranking decision**:

- Context-owned UDO: boost 23.
- Project-global UDO: boost 22.
- Document-local UDO: boost 21.
- Existing native opcode: boost 5.
- Existing BSB replacement keys, variables, and Blue opcodes retain their current boosts and behavior.

**Alternatives considered**:

- Insert a full call template. Rejected as outside the feature scope and unreliable for polymorphic return syntax.
- Put signatures only in the secondary information panel. Rejected because overloads must be distinguishable in the list itself.

## Decision 5: Parse complete document UDOs and retain an incomplete fallback

**Decision**: Use the existing portable UDO parser for complete document-local definitions and retain a small declaration-name fallback for an in-progress declaration that cannot yet be parsed. Complete document definitions use normalized signatures; fallback definitions are marked incomplete.

**Rationale**:

- The current document scan records only names using `userOpcodePattern`.
- `parseUDOText()` already supports classic and modern definitions, including multiline declarations, and returns `OpcodeDefinition` values.
- Active editing commonly creates temporarily incomplete declarations; dropping their names entirely would regress current discoverability.
- The fallback must never merge with a complete overload.

**Alternatives considered**:

- Keep name-only document UDOs. Rejected because exact cross-source deduplication and overload display would remain ambiguous.
- Build a new renderer-only UDO grammar. Rejected because the portable parser is already the project’s declaration authority.

## Decision 6: Make each editor host pass its UDO scope explicitly

**Decision**: Thread project-global definitions and owner definitions through existing editor component props. Project hosts pass current project UDOs; standalone library hosts pass an empty project collection. UDO workspace/editor components receive the same explicit scope.

**Rationale**:

- Generic, JavaScript, BlueSynthBuilder, Global Orchestra, effect, and UDO body editors currently do not receive project UDO definition data.
- `UdoEditor` and `UdoWorkspacePanel` currently have no completion-context prop.
- Library instrument, effect, UDO, and Sound editors reuse project-capable components while a project may also be open. Reading the project store unconditionally would leak unrelated globals.
- Explicit host input handles project Sound objects and library Sound objects without guessing from the nested object’s target metadata.

**Host rules**:

- `GlobalOrchestraPanel`: project-global only.
- Project instrument and project Sound object orchestra fields: owner definitions plus project-global definitions.
- Project global UDO body: project-global definitions, including self.
- Project instrument/effect embedded UDO body: owner definitions plus project-global definitions.
- Standalone library instrument/Sound/effect: owner definitions only.
- Standalone library UDO body: self only.
- Global Sco and JavaScript source fields: no context-aware UDO collections.

**Alternatives considered**:

- Have every reusable editor read `useProjectStore()` directly. Rejected because library editors share those components and must remain isolated.
- Infer project ownership from whether a project is loaded. Rejected because a library asset can be edited while an unrelated project is open.

## Decision 7: Extend the effect editor snapshot for separate-window scope

**Decision**: Add a derived `projectUdos` collection to `EffectEditorSnapshot`. Project effect snapshots receive the current project collection; library effect snapshots always receive an empty collection. The separate project effect window reuses the existing project-document update event to refresh that derived collection.

**Rationale**:

- `EffectEditorSnapshot.ownerType` already distinguishes project and library effects.
- The separate `EffectEditorPage` runs in its own renderer and does not hydrate the main workbench project store.
- Initial project globals can travel through the existing `getEffectEditorDocument` response.
- Project-global UDO changes must reach an already-open effect window. The existing typed `project-document-updated` event already carries the latest `ProjectEditorSnapshot`; the main process can also broadcast it to project effect windows, and `EffectEditorPage` can update only its transient `projectUdos`.
- No new persistence or mutation channel is required.

**Alternatives considered**:

- Fetch the effect document on every completion request. Rejected because completion must remain synchronous and responsive.
- Add a new effect-specific UDO IPC channel. Rejected because the existing project snapshot event provides the required typed update.
- Read the main renderer’s Zustand store from the effect window. Rejected because renderer contexts are separate.

## Decision 8: Reuse the current editor reconfiguration path for freshness

**Decision**: Construct memoized completion option objects from current snapshot arrays. When a UDO collection changes, the changed option identity follows the existing `SelectedCodeEditor` extension lifecycle; completion remains synchronous and no long-lived UDO cache is introduced.

**Rationale**:

- The existing editor already rebuilds extensions when `javaBlueCompletionOptions` changes.
- Project and library snapshots are immutable renderer projections, so an add, rename, remove, reorder, conversion, or owner switch produces new data.
- Avoiding a separate cache ensures the next completion request reflects the current owner/project.

**Alternatives considered**:

- Introduce a global completion registry with subscriptions. Rejected as unnecessary state duplication.
- Recompute and normalize all collections for every keystroke. Rejected because options can be normalized when their source arrays change and reused by synchronous requests.

## Decision 9: Preserve score and non-Csound exclusions at the call site

**Decision**: Supply UDO collections only to orchestra-code and UDO-body fields. BSB replacement-key options may remain in Global Sco, but context/project UDO collections must be absent. JavaScript source remains a plain JavaScript editor/textarea without Csound UDO completions.

**Rationale**:

- `BSBCodeEditor` currently shares one completion option object across Instrument, Always On, Global Orc, and Global Sco. The implementation must split orchestra and score options.
- Generic and JavaScript Global Sco fields likewise must not receive UDO collections.
- This preserves existing completion categories without expanding the feature into score-language completion design.

## Decision 10: Treat Java Blue as the data/generation reference and completion as an intentional divergence

**Decision**: Preserve Java-compatible UDO fields and generation behavior exactly; add context-aware completion only as renderer-derived advisory behavior.

**Java references inspected**:

- `blue-core/src/main/java/blue/udo/UserDefinedOpcode.java`
- `blue-core/src/main/java/blue/utility/UDOUtilities.java`
- `blue-core/src/main/java/blue/udo/OpcodeList.java`
- `blue-ui-core/src/main/java/blue/ui/core/udo/UDOEditor.java`
- `blue-ui-core/src/main/java/blue/ui/core/mixer/EffectEditor.java`
- `blue-ui-core/src/main/java/blue/orchestra/editor/blueSynthBuilder/BSBCompletionProvider.java`

**Findings**:

- Java stores style, name, output types, classic input types or modern input arguments, code, and comments.
- Java generation merges embedded lists into the global list, reuses code-equivalent definitions, and renames collisions. That behavior is broader than completion shadowing and remains unchanged.
- Java UDO and effect editors use Csound/BSB editor surfaces but do not provide the context-aware UDO completion workflow specified here.
- The TypeScript completion enhancement is therefore an intentional authoring divergence built from Java-compatible source data, not a change to CSD resolution.

## Resolved Unknowns

All planning questions are resolved. The feature requires no new persistence, migration, dependency, external API, engine behavior, or user clarification.
