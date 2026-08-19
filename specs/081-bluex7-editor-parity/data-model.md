# Data Model: BlueX7 Instrument Editor Parity

## Ownership Map

| State | Canonical owner | Persistence | Lifetime |
|---|---|---|---|
| Arrangement BlueX7 voice | Main-process active `BlueData` document | `.blue` XML | Project |
| Track BlueX7 voice | BlueX7 instance owned by the canonical Track in main `BlueData` | `.blue` XML through Track | Project |
| Library BlueX7 draft | Unified-library editor session | Library payload XML only after Save | Editor session, then library |
| Editor tab/operator/focus | Mounted renderer editor | None | Mounted editor context |
| Editor undo/redo history | Mounted `BlueX7Editor` instance | None | Cleared on leave/reopen/context replacement |
| SysEx bytes and decoded candidates | Renderer import flow after bounded main read | None | One import attempt |
| Csound preview/binding report | Renderer-derived disposable compilation | None | Recomputed from current snapshot |
| Java ORC and algorithm image resources | Application/package build artifacts | Shipped application | Application version |

## Canonical Entities

### BlueX7Instrument

Represents one complete Java-compatible instrument.

| Field | Type | Validation/meaning |
|---|---|---|
| `name` | string | Existing instrument metadata; import does not replace it |
| `enabled` | boolean | Existing instrument metadata |
| `comment` | string | Existing instrument metadata; import does not replace it |
| `common` | `BlueX7Common` | Required |
| `lfo` | `BlueX7Lfo` | Required |
| `operators` | tuple of 6 `BlueX7Operator` | Fixed order, logical operators 1–6 |
| `pitchEnvelope` | tuple of 4 `EnvelopePoint` | Fixed stage order |
| `csoundPostCode` | string | Exact text; empty allowed |
| `sourceXmlTemplate` | cloned XML element, internal only | Preserves unknown root and nested data; never crosses renderer contract |
| `compileAllocation` | transient compilation value | Per compilation/deep copy; never serialized |

New instruments use Java Blue's final `setDefaults()` state, including algorithm 19, key transpose 24, feedback 6, LFO speed 35, four PEG `(50,50)` points, exact six operator presets, and `blueMixerOut aout, aout` post code.

### BlueX7Common

| Field | Domain |
|---|---|
| `keyTranspose` | integer 0–48, displayed C1–C5 |
| `algorithm` | integer 1–32 |
| `feedback` | integer 0–7 |
| `operatorEnabled` | tuple of 6 booleans |

### BlueX7Lfo

| Field | Domain |
|---|---|
| `speed` | integer 0–99 |
| `delay` | integer 0–99 |
| `pitchModulationDepth` | integer 0–99 (`PMD` in XML) |
| `amplitudeModulationDepth` | integer 0–99 (`AMD` in XML) |
| `wave` | `0 Triangle`, `1 Saw Down`, `2 Saw Up`, `3 Square`, `4 Sine`, `5 S/Hold` |
| `sync` | `0 Off`, `1 On` |

### BlueX7Operator

| Field | Domain |
|---|---|
| `mode` | `0 Ratio`, `1 Fixed (Hz)` |
| `sync` | 0–1; stored per operator, edited as a shared six-operator value |
| `frequencyCoarse` | integer 0–31 |
| `frequencyFine` | integer 0–99 |
| `detune` | integer -7–7 for editor-authored values; valid Java-oracle imports retain exact mapped values pending explicit edit |
| `breakpoint` | integer 0–99, displayed A-1–C8 |
| `curveLeft`, `curveRight` | `0 -Lin`, `1 -Exp`, `2 +Exp`, `3 +Lin` |
| `depthLeft`, `depthRight` | integer 0–99 |
| `keyboardRateScaling` | integer 0–7 |
| `outputLevel` | integer 0–99 |
| `velocitySensitivity` | integer 0–7 for editor-authored values; valid Java-oracle imports retain exact mapped values pending explicit edit |
| `modulationAmplitude` | integer 0–3 |
| `modulationPitch` | integer 0–7; stored per operator, edited as a shared six-operator value |
| `envelope` | tuple of 4 `EnvelopePoint` |

Mixed stored `sync` or `modulationPitch` values from legacy XML remain distinct until the shared editor control is changed. The snapshot can report `mixed`; applying a shared operation writes the chosen value to all six.

### EnvelopePoint

| Field | Domain |
|---|---|
| `rate` | integer 0–99; XML attribute `x` |
| `level` | integer 0–99; XML attribute `y`; interpreted as pitch for PEG |

Four ordered points form one operator envelope or the pitch envelope. Canvas coordinates are derived only; resize never mutates the values.

## Derived Entities

### BlueX7VoiceSnapshot

A serializable copy of `common`, `lfo`, six operators, pitch envelope, and post code. It excludes identity metadata and internal XML/compile state. It is used for renderer display, local undo before/after values, atomic SysEx replacement, and disposable preview generation.

### BlueX7Preview

| Field | Meaning |
|---|---|
| `status` | `ready` or `error` |
| `tables` | Generated static and per-operator table text |
| `instrumentBody` | Java-compatible selected-algorithm instrument body plus post code |
| `bindings` | Current value and emitted/not-emitted status for every editor parameter |
| `message` | Recoverable generation diagnostic when `status=error` |

Preview creation deep-copies the voice and uses fresh tables. It cannot mutate the source instrument, project tables, render engine, library draft, or undo history.

### BlueX7Patch

A nested discriminated semantic operation:

- `setCommonField(field, value)`
- `setOperatorEnabled(operatorIndex, enabled)`
- `setLfoField(field, value)`
- `setOperatorField(operatorIndex, field, value)`
- `setSharedOscillatorSync(value)`
- `setSharedPitchModulationSensitivity(value)`
- `setOperatorEnvelopePoint(operatorIndex, stageIndex, point)`
- `setPitchEnvelopePoint(stageIndex, point)`
- `setCsoundPostCode(text)`
- `replaceVoice(voice)`

Indexes are zero-based in contracts and must be in bounds. Invalid operations return unchanged/invalid at the relevant boundary and never partially mutate the instrument. `replaceVoice` replaces modeled voice data while preserving assignment identity, name, comment, enabled state, and source XML template/unknown data.

## SysEx Entities

### BlueX7SysexReadResult

- `canceled`
- `selected { fileName, bytes }`
- `error { code, message }`, where code is `read-failed`, `unsupported-size`, or `invalid-request`

No native path crosses the preload boundary.

### DecodedBlueX7Sysex

- `single { voice, displayName }`
- `bank { slots[32] }`

Each `BankSlot` has a stable zero-based index, a safe display label, the raw ten-byte name representation needed for diagnostics, and a detached decoded voice. Decoding never accepts a target object and never mutates project state.

## XML Mapping and Preservation

Known children retain Java order: basic metadata, `algorithmCommonData`, `lfoData`, six `operator` elements, four root `envelopePoint` elements, and `csoundPostCode`. Operator scalars retain Java order followed by four nested `envelopePoint` elements.

On load:

1. Clone the complete source element.
2. Parse up to the expected known cardinalities and validate values for editor use.
3. Preserve missing, malformed, extra, and unknown content in the template and expose a recoverable diagnostic where necessary.

On save:

1. Clone the template or create the Java default structure for a new voice.
2. Update known metadata, attributes, scalar text, and expected repeated elements.
3. Retain unknown attributes/children and extra repeated nodes without treating them as modeled array members.
4. Emit the canonical Java element/type and exact post-code text.

## State Transitions

### Parameter edit

`snapshot` → gesture starts with before-value → optimistic semantic patches → gesture commit records one before/after undo entry → canonical host receipt/snapshot reconciles → preview recomputes.

Invalid values or indexes produce no canonical change. If an external snapshot replaces the editor context, pending gesture state and local history clear.

### Undo/redo

`current voice` → dispatch inverse or forward semantic/full replacement → host canonical update → move history cursor. History is bounded and editor-instance-local. A stale/unavailable host result clears or reconciles history rather than replaying against a different voice.

### SysEx import

`idle` → `choosing` → `selected bytes` → `validated single` or `validated bank awaiting selection` → `confirmed candidate` → one `replaceVoice` patch/undo entry → `idle`.

Cancel, read error, validation error, bank cancel, stale editor identity, or host rejection returns to `idle/error` with zero mutation.

### Library host

`saved payload` → editor patch updates session draft/dirty state → optional more edits/import/undo → Save serializes draft to library payload, or Cancel/Revert discards draft. No library edit mutates the active project.
