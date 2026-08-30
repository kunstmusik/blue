# Contract: BlueX7 Parameter Catalog

## Purpose

Define the sole semantic mapping between BlueX7 project voice fields, Parameters, editor controls, automation targets, and the modern Csound transport.

## Public data-layer surface

```ts
export const BLUE_X7_PARAMETER_DESCRIPTORS: readonly BlueX7ParameterDescriptor[];

export function createBlueX7Parameters(voice: BlueX7Voice): ParameterList;
export function reconcileBlueX7Parameters(
  voice: BlueX7Voice,
  persisted?: ParameterList,
): ParameterList;
export function applyBlueX7FixedValue(
  voice: BlueX7Voice,
  parameters: ParameterList,
  key: string,
  value: number,
): boolean;
export function replaceBlueX7VoiceFixedValues(
  voice: BlueX7Voice,
  parameters: ParameterList,
  replacement: BlueX7Voice,
): void;
export function buildBlueX7VoiceTransport(
  voice: BlueX7Voice,
  operatorEnabled: readonly boolean[],
): BlueX7VoiceTransport;
```

Concrete names may follow repository conventions, but the module must expose equivalent one-owner operations and must not make callers reproduce mapping rules.

## Catalog cardinality

| Group | Count | Notes |
|---|---:|---|
| Common | 3 | algorithm, feedback, transpose |
| Operator enables | 6 | grouped with respective operators in UI |
| Shared sync/PMS | 2 | logical operator 1 is effective source until edited |
| LFO | 6 | speed, delay, PMD, AMD, sync, wave |
| Pitch Envelope | 8 | four rates, four levels |
| Operators 1–6 | 126 | 21 per operator, excluding the two editor-shared fields |
| **Total** | **151** | exactly |

## Voice transport

For logical operator `op` in 1..6, base slot is `(6 - op) * 21`.

| Offset | Value | Transform |
|---:|---|---|
| 0..3 | EG rates 1..4 | identity |
| 4..7 | EG levels 1..4 | identity |
| 8 | breakpoint | identity |
| 9..10 | left/right depth | identity |
| 11..12 | left/right curve | identity |
| 13 | rate scaling | identity |
| 14 | amplitude modulation sensitivity | identity |
| 15 | velocity sensitivity | identity |
| 16 | output level | identity |
| 17 | oscillator mode | identity |
| 18..19 | coarse/fine | identity |
| 20 | detune | `value + 7` |

| Slot | Value | Transform/policy |
|---:|---|---|
| 126..129 | PEG rates | identity |
| 130..133 | PEG levels | identity |
| 134 | algorithm | `value - 1` |
| 135 | feedback | identity |
| 136 | oscillator key sync | shared Parameter/logical operator 1 |
| 137..140 | LFO speed, delay, PMD, AMD | identity |
| 141 | LFO sync | identity |
| 142 | LFO wave | identity |
| 143 | pitch modulation sensitivity | shared Parameter/logical operator 1 |
| 144 | transpose | renderer subtracts 24 internally |
| 145..154 | voice-name bytes | deterministic, nonsynthesized |

Operator mask bit `op - 1` corresponds to logical operator `op`.

## Value validation

- Reject non-finite caller values.
- Clamp to descriptor bounds, then quantize with exact integer resolution.
- Boolean effective values are 0 or 1.
- Categorical automation is step/discrete at valid integer boundaries.
- Unknown semantic keys fail without mutation.
- Reconciliation never silently changes canonical voice values to fit a malformed persisted Parameter; the voice wins and the Parameter is repaired.

## Update semantics

The active-note set is intentionally small: `common.feedback`, LFO
`pitchModulationDepth` and `amplitudeModulationDepth`, six operator
`outputLevel` values, and six operator `enabled` values (15 descriptors).
The remaining 136 descriptors—including algorithm, transpose, LFO timing/wave/
sensitivity, pitch-envelope values, and the other operator fields—are
next-note snapshots. The editor and generated binding report consume this field
directly from the catalog.

## Persistence and identities

- `BlueX7.saveAsXML()` writes the owning `parameterList` after voice content at the chosen additive extension point.
- `BlueX7.loadFromXML()` preserves existing voice/unknown XML and reconciles a present or absent list.
- Same-owner load/save/import/undo/redo retains Parameter IDs.
- A new ownership boundary uses `Parameter.deepCopy()` semantics to regenerate IDs.
- Whole-voice replacement retains curves, points, enabled state, resolution, line color, and automation assignments; it replaces fixed values only.

## Required contract tests

- Cardinality, unique keys/IDs, domains, grouping, and update classes.
- Every descriptor reads/writes the correct voice field.
- Every transport slot and mask bit, including operator reversal, detune, and algorithm transforms.
- Mixed shared-field load without normalization and six-field write on edit.
- Legacy XML migration, additive XML round trip, unknown-node preservation, and stable first-save IDs.
- Copy/new-owner disjoint IDs and same-owner whole-voice retained IDs/curves.
