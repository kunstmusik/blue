# Data Model: Context-Aware UDO Code Completions

## Overview

The feature adds no persisted model. It derives transient completion data from existing project and library UDO snapshots and the active editor document. Project `BlueData` and library documents remain the canonical owners of authored UDO definitions.

## Entity: UDO Completion Definition

**Purpose**: Lightweight source data accepted by the reusable Csound editor completion adapter.

**Fields**:

- `name: string` — authored, case-sensitive UDO identifier.
- `style: 'CLASSIC' | 'MODERN'` — declaration form used to interpret input/output fields.
- `outTypes: string` — authored output declaration.
- `inTypes: string` — classic-style input declaration; empty for modern style.
- `inputArguments: string` — modern-style input declaration; empty for classic style.

**Derived from**:

- `ProjectEditorSnapshot.projectUdos`
- `InstrumentSnapshot.udolist`
- `BlueSynthBuilderInstrumentSnapshot.udolist`
- `EffectEditorSnapshot.udos`
- a standalone `UdoDefinitionSnapshot`
- complete UDO declarations parsed from active document text

**Validation**:

- Name must be one insertable UDO identifier.
- Empty/whitespace/invalid names do not become candidates.
- Code and comments are deliberately excluded.

## Entity: Normalized Callable Signature

**Purpose**: Stable overload identity independent of declaration formatting.

**Fields**:

- `inputTypes: readonly string[]` — ordered normalized input type tokens.
- `outputTypes: readonly string[]` — ordered normalized output type tokens.
- `complete: boolean` — false when any required type cannot be derived.
- `inputDisplay: string` — comma-separated input display or `void`.
- `outputDisplay: string` — comma-separated output display or `void`.
- `key: string` — deterministic comparison key made from completeness plus ordered output and input tokens.

**Validation rules**:

- Insignificant whitespace, separators, grouping parentheses, argument names, and default values do not alter identity.
- Explicit modern type annotations take precedence over rate/type inference.
- No-output spellings normalize to an empty output list.
- Type order and semantic modifiers remain significant.
- Incomplete signatures never compare equal to complete signatures.

## Entity: UDO Completion Candidate

**Purpose**: One normalized UDO overload before conversion into editor UI metadata.

**Fields**:

- `definition: UdoCompletionDefinition`
- `source: 'context' | 'project' | 'document'`
- `signature: NormalizedCallableSignature`
- `identityKey: string` — authored name plus signature key.

**Source precedence**:

1. `context`
2. `project`
3. `document`

**Relationships**:

- Many source definitions may normalize to one exact candidate identity.
- Same-name definitions with distinct signatures produce separate candidates.
- A native opcode is not a UDO candidate and therefore cannot be removed by UDO identity deduplication.

## Entity: UDO Completion Scope

**Purpose**: Explicit editor-host contract describing which authored collections are available.

**Fields**:

- `contextUdos: readonly UdoCompletionDefinition[]`
- `projectUdos: readonly UdoCompletionDefinition[]`
- `documentText: string` — supplied at completion time by the active CodeMirror state.

**Scope rules**:

- Project instrument/effect/Sound contexts supply both collections.
- Global Orchestra and global UDO bodies supply only project UDOs.
- Standalone library assets supply only their owner/self collection.
- Score and non-Csound fields supply neither collection.

## Entity: UDO Completion Row

**Purpose**: User-visible completion representation.

**Fields**:

- `label` — authored name used for filtering.
- `displayLabel` — `name (inputDisplay) → outputDisplay`, with an incomplete marker when needed.
- `detail` — source label such as `context UDO`, `project UDO`, or `document UDO`.
- `apply` — authored name only.
- `info` — expanded source and signature information.
- `boost` — source ranking while retaining existing non-UDO category ranks.

**Validation**:

- Every distinct overload produces one row.
- Exact duplicate UDO identities produce one row from the highest-precedence source.
- A same-name native opcode remains a separate row.

## Entity: Effect Editor Snapshot UDO Projection

**Purpose**: Make project-global UDO definitions available to a project effect editor running in a separate renderer.

**Fields added to existing effect snapshot**:

- `projectUdos: UdoDefinitionSnapshot[]`

**Rules**:

- Project-owned effect snapshots contain the current project-global UDO projection.
- Library-owned effect snapshots always contain an empty array.
- The field is derived, transient, serializable state.
- It is never written back through an effect patch or persisted into effect XML.

## State Transitions

### Collection edit

1. Canonical project or library UDO definition changes through the existing patch flow.
2. The owning snapshot/store produces updated UDO arrays.
3. The editor host produces a new completion scope.
4. The next completion request normalizes and displays current candidates.

### Editor/owner switch

1. The active instrument, effect, UDO, Sound object, library document, or project changes.
2. The previous completion scope is discarded with the editor props/snapshot.
3. The new host supplies only its allowed owner/project collections.
4. No candidate from the previous owner remains.

### Separate project effect window update

1. Main-process project UDO state changes.
2. The existing project-document update event reaches open project effect windows.
3. The effect page replaces only its derived `projectUdos` projection.
4. The effect code and embedded UDO editors receive refreshed completion options.

### Incomplete declaration becomes complete

1. A document or authored UDO signature cannot yet be fully normalized.
2. Completion exposes a distinct incomplete candidate.
3. The user finishes the signature.
4. The next request replaces the incomplete identity with the normalized complete overload.

## Persistence and Ownership

- Project UDO definitions: canonical main-process `BlueData`, persisted in `.blue` XML.
- Library UDO definitions: canonical library document/database payload.
- Completion definitions, candidates, signatures, and rows: transient renderer-derived state.
- Effect `projectUdos`: transient projection in an existing typed snapshot contract.
- No migration, new persistence key, or CSD generation change is introduced.
