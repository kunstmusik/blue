# Contract: Context-Aware UDO Completion

## Editor Adapter Input

The reusable Csound completion adapter accepts lightweight UDO definitions separated by scope.

```ts
interface JavaBlueUdoCompletionDefinition {
  name: string;
  style: 'CLASSIC' | 'MODERN';
  outTypes: string;
  inTypes: string;
  inputArguments: string;
}

interface JavaBlueCsoundCompletionOptions {
  bsbReplacementKeys?: readonly JavaBlueBsbReplacementKey[];
  contextUdos?: readonly JavaBlueUdoCompletionDefinition[];
  projectUdos?: readonly JavaBlueUdoCompletionDefinition[];
}
```

Equivalent names may be chosen during implementation, but the contract must preserve two explicit UDO sources and full signature data. A name-only `string[]` is not sufficient.

## Normalized Signature Contract

The portable data layer exposes a pure, static-import-safe normalization result:

```ts
interface NormalizedUdoCallableSignature {
  inputTypes: readonly string[];
  outputTypes: readonly string[];
  complete: boolean;
  key: string;
}
```

Normalization must:

- compare ordered Csound type tokens;
- ignore insignificant whitespace, separators, grouping, argument names, and default values;
- use modern explicit type annotations before rate/type inference;
- normalize valid no-output spellings;
- preserve semantic modifiers and type order;
- represent unknown/in-progress type information as incomplete rather than guessing.

The helper belongs in `@blue/data`, has no renderer or host dependency, and is exported with a top-level static export.

## Candidate Identity and Precedence

```text
identity = authoredName + normalizedOutputTypes + normalizedInputTypes + completeness
```

UDO source precedence is:

1. context-owned;
2. project-global;
3. document-local.

Rules:

- An exact UDO identity repeated across sources produces one row from the highest-precedence source.
- An exact identity repeated within one source produces one row.
- Same-name definitions with different input types, output types, or completeness produce separate rows.
- Native opcodes use a separate completion category and are never removed by UDO deduplication.
- Authored name comparison remains case-sensitive.

## Completion Row Contract

Each UDO overload becomes a CodeMirror completion with:

```ts
{
  label: authoredName,
  displayLabel: `${authoredName} (${inputDisplay}) → ${outputDisplay}`,
  detail: `${sourceLabel} UDO`,
  apply: authoredName,
  info: sourceAndSignatureHelp,
  boost: sourceBoost,
  type: 'function'
}
```

Use `void` for an empty input or output list and visibly mark an incomplete signature.

Required relative ranks:

```text
context UDO > project UDO > document UDO > native opcode
```

Planned boost values are 23, 22, and 21 for those UDO sources; native opcodes retain 5. BSB replacement keys, variables, and Blue opcodes retain their existing category behavior.

## Document-Local Contract

- Complete classic and modern declarations are parsed with the existing portable UDO parser and normalized like supplied definitions.
- A valid name from an in-progress declaration remains available as an incomplete document UDO.
- Document parsing does not provide access to UDO collections stored outside the active editor.

## Editor Scope Contract

| Editor surface | Context UDOs | Project UDOs |
|---|---:|---:|
| Global Orchestra | No | Yes |
| Project Generic Instrument Instrument/Global Orc | Instrument | Yes |
| Project JavaScript Instrument Global Orc | Instrument | Yes |
| Project BSB Instrument/Always On/Global Orc | Instrument | Yes |
| Project Sound BSB Instrument/Always On/Global Orc | Sound instrument | Yes |
| Project effect Code | Effect | Yes |
| Project embedded instrument/effect UDO body | Owner | Yes |
| Project-global UDO body | No separate context source | Yes |
| Library instrument/Sound/effect code or embedded UDO body | Asset owner | No |
| Standalone library UDO body | Self | No |
| Global Sco, JavaScript source, and excluded non-orchestra editors | No | No |

BSB Global Sco may continue receiving BSB replacement-key options, but it receives neither UDO collection.

## Effect Window Contract

`EffectEditorSnapshot` gains:

```ts
projectUdos: UdoDefinitionSnapshot[];
```

- Project effect snapshots populate the field from the canonical current project.
- Library effect snapshots force the field to `[]`.
- Existing effect patches cannot mutate the field.
- The existing project-document update event also reaches open project effect windows.
- `EffectEditorPage` refreshes the derived field from the event while retaining its current editable effect snapshot.

This extends an existing serializable main/preload/renderer contract; it does not add persistence or a new IPC mutation.

## Freshness Contract

- Completion scope is derived from current immutable snapshot arrays.
- Add, rename, remove, reorder, style conversion, owner switch, and project switch become visible on the next completion request.
- No global UDO completion cache or persisted completion state is permitted.
- Unloaded/closing projects supply empty project UDO collections.

## Compatibility Contract

- UDO definitions, XML, order, names, and code are unchanged.
- CSD generation equivalence and collision renaming are unchanged.
- Applying a completion inserts only the authored name.
- Existing built-in opcode, Blue opcode, variable, replacement-key, and dynamic completion categories remain available.
- JavaScript, score, text, table, Blue Live, and generated read-only surfaces receive no new context-aware UDO source.

## Verification Contract

Automated coverage must prove:

- classic/modern normalization and incomplete handling;
- same-name input and output overload preservation;
- exact source shadowing and source ordering;
- native same-name coexistence;
- project instrument, BSB, Sound, Global Orchestra, effect, and UDO-body wiring;
- library isolation for instrument, Sound, effect, and standalone UDO editors;
- live project and owner changes, including an open separate effect window;
- Global Sco and JavaScript source exclusions;
- p95 completion construction below 100 ms with 500 project and 100 context definitions in the documented local benchmark;
- no project/XML/CSD mutation caused by completion.
