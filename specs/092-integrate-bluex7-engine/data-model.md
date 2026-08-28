# Data Model: Modern BlueX7 Engine and Automation

## Ownership and persistence map

| State | Canonical owner | Persisted | Lifetime |
|---|---|---:|---|
| BlueX7 voice, operator enables, Csound post code, unknown XML | One `BlueX7` instrument | `.blue` XML | Project |
| 151 Parameter identities, fixed values, automation metadata/points | Same `BlueX7` | Child `parameterList` in `.blue` XML | Project |
| Arrangement/Track location | `BlueData` arrangement or score Track | Existing `.blue` structures | Project |
| Compilation variable names and Csound table/channel IDs | `CompileData` | No | One generated performance |
| Hold/commit generation and live Csound voice state | Active engine session | No | Playback/Blue Live session |
| Effective-value samples shown by an editor | Renderer hook/store | No | Open editor/session |
| Imported renderer sources and provenance | Repository resources | Git, not `.blue` | Source distribution |

The Electron main process owns the active `BlueData`. Renderer snapshots and readback never become a second project owner.

## 1. BlueX7 parameter descriptor

An immutable catalog entry that describes one semantic control.

```ts
type BlueX7UpdateClass = 'active-note' | 'next-note';
type BlueX7ParameterKind = 'continuous-integer' | 'boolean' | 'categorical';

interface BlueX7ParameterDescriptor {
  key: string;                 // stable semantic name, independent of display name
  group: 'Common' | 'LFO' | 'Pitch Envelope' | `Operator ${1|2|3|4|5|6}`;
  label: string;
  minimum: number;
  maximum: number;
  resolution: '1';
  kind: BlueX7ParameterKind;
  updateClass: BlueX7UpdateClass;
  transport: { kind: 'voice'; slot: number } | { kind: 'operator-enable'; operator: 1|2|3|4|5|6 };
}
```

### Catalog invariants

- Exactly 151 unique `key` values.
- Exactly 145 voice-slot descriptors plus six operator-enable descriptors.
- Every value has integer resolution and a finite inclusive domain.
- Algorithm, shared oscillator key sync, and LFO key sync are `next-note`; all others are `active-note`.
- Group order is Common, LFO, Pitch Envelope, Operator 1 through Operator 6. Within each group, order is fixed by the catalog, not object iteration.
- Shared oscillator key sync and pitch modulation sensitivity map from logical operator 1 while legacy per-operator values are mixed.

The descriptor is not serialized per instrument. It is code-owned schema metadata.

## 2. BlueX7 ParameterList

Each `BlueX7` owns one `ParameterList` with one `Parameter` per descriptor.

### Persisted fields

Existing `Parameter` XML retains:

- `uniqueId`
- semantic `name` and user-facing label
- minimum, maximum, resolution
- fixed value
- automation enabled state, curve type, points, and line color

Compilation variable names are never persisted.

### Reconciliation

On creation or load:

1. Index loaded Parameters by descriptor `key`/name.
2. For each descriptor in catalog order, reuse the matching Parameter if valid; otherwise create one with a fresh ID.
3. Refresh catalog-owned name, label, bounds, resolution, and fixed value from the canonical voice.
4. Retain reused identity, automation state, curve, points, and line color.
5. Ignore no known descriptor and reject duplicate semantic keys deterministically; preserve unrelated unknown XML through the existing BlueX7 unknown-content mechanism rather than exposing it as a runtime Parameter.

Legacy XML without `parameterList` creates all 151 entries without changing the voice. The first TypeScript save stabilizes the generated IDs.

### Mutation invariants

- A widget edit changes the voice field and matching fixed value in one project patch.
- Shared sync/PMS edits write all six legacy voice fields and the one shared Parameter in one patch.
- Whole-voice import/replacement changes all voice fields and fixed values together while preserving Parameter IDs, automation curves, points, colors, enabled states, and layer assignments.
- Automation playback changes neither the fixed value nor the curve through readback.

### Copy transitions

| Operation | Voice/fixed values | Automation content | Parameter IDs |
|---|---|---|---|
| Save/reopen same owner | Preserve | Preserve | Preserve |
| Undo/redo same owner | Restore | Preserve/restore by patch | Preserve |
| SysEx/whole-voice replace | Replace | Preserve | Preserve |
| Deep copy/paste/library instantiation/new Track owner | Copy | Copy only where operation already supports it | Regenerate all 151 |

## 3. Owner-aware project parameter entry

```ts
type BlueX7OwnerRef =
  | { kind: 'arrangement'; assignmentId: string }
  | { kind: 'track'; projectSessionId: number; rootGroupId: string; trackId: string };

interface ProjectParameterEntry {
  ownerKind: 'arrangement-instrument' | 'track-instrument' | 'mixer';
  ownerIdentity: string;       // stable location identity, not a display name
  ownerLabel: string;          // display only; disambiguated by location
  parameter: Parameter;
  path: readonly string[];     // automation chooser groups
}
```

The catalog enumerates enabled arrangement instruments in arrangement order, Track instruments in score/group/Track order, then mixer entries in existing order. Consumers route by `ownerIdentity + parameter.uniqueId`; ordering is used only for deterministic compilation naming and presentation.

Deleting/replacing an owner removes its entries on the next catalog build. A stale identity never resolves by label or position.

## 4. Voice transport snapshot

```ts
interface BlueX7VoiceTransport {
  voice: readonly number[];    // length 155; synthesized values in 0..144
  operatorMask: number;        // six bits, bit 0 = logical operator 1
}
```

### Mapping invariants

- Operator `op` uses block `(6 - op) * 21`.
- Operator offsets 0..20 follow envelope, scaling, sensitivity, output, mode, frequency, and detune order.
- Detune adds 7 at the transport boundary.
- Common slots are 126..144; algorithm subtracts 1.
- Voice-name slots 145..154 are deterministic, nonsynthesized bytes.
- All values are clamped/quantized by descriptor before transport.
- p4 is converted using Blue pitch -> Hz -> fractional MIDI; p5 retains velocity meaning; `abs(p3)` is the gate interval.

The pure transport builder has no engine or UI dependency and is the test oracle for static CSD and live transport.

## 5. Compiled BlueX7 binding

Disposable mapping created during CSD compilation:

```ts
interface CompiledBlueX7Binding {
  ownerIdentity: string;
  runtimeInstrumentId: string | number;
  parameterChannels: ReadonlyMap<string, string>; // Parameter ID -> gk_blue_autoN
  holdChannel: string;
  commitChannel: string;
  transportTableIds: readonly [number, number];
}
```

### Invariants

- All names/IDs derive from compilation allocation, never instrument display names.
- Each owner has distinct mutable tables and controls.
- Immutable renderer UDOs/arrays are registered once per `CompileData`.
- The binding is invalid after stop, engine rebuild, project session change, or removal/replacement of the owner.

## 6. Runtime update batch

```ts
interface BlueX7RuntimeUpdateBatch {
  projectSessionId: number;
  owner: BlueX7OwnerRef;
  expectedProjectRevision?: number;
  mode: 'fixed-delta' | 'complete-voice';
  values: readonly { parameterId: string; value: number }[];
}
```

### State transition

```text
resolved -> validate/quantize -> hold -> batch write -> commit/release -> visible
    |              |             |           |
    +-- stale -----+-- invalid --+-- error --+--> safe diagnostic; canonical project unchanged
```

For a fixed delta, hold may be omitted when the value is not automation-owned. For a complete voice, hold is mandatory and values contain the complete catalog snapshot. The wrapper retains the previously committed transport while held. Releasing advances an instance-scoped generation observed at one control boundary.

When a Parameter has enabled automation during playback, the automation channel is authoritative; a manual edit may update the fallback fixed value durably but does not issue a competing effective-value write.

## 7. Effective-value request and snapshot

```ts
interface BlueX7EffectiveValuesRequest {
  projectSessionId: number;
  owner: BlueX7OwnerRef;
  parameterIds: readonly string[]; // visible controls only
}

interface BlueX7EffectiveValuesSnapshot {
  projectSessionId: number;
  owner: BlueX7OwnerRef;
  engineSequence: number;
  sampledAt: number;
  values: readonly { parameterId: string; value: number }[];
}
```

Responses are accepted only when session and owner still match the open editor. Missing channels, stopped playback, or stale owners return an explicit unavailable result; they never substitute values from another instance. Samples are clamped for display but do not mutate the project.

## 8. Engine batch channel message

The engine protocol transports validated channel/value arrays. Batch set is all-or-error at the protocol boundary; musical atomicity is supplied by the BlueX7 hold/commit controls. Batch get returns values in request order with no partial success. Limits bound count, name length, and total payload before allocation.

## 9. Renderer provenance record

`packages/blue-data/resources/blue-x7-modern/provenance.json` records:

- transient precursor path and commit
- SHA-256 of the reviewed report and exact imported `bluex7.orc` baseline
- current maintained `.orc` and generated TypeScript hashes
- Blue-owned modifications since import
- relevant-project attribution and whether each source is incorporated or reference-only
- applicable third-party copyright/license/SPDX notices
- Blue bundler version

`ATTRIBUTION.md` presents the human-readable credits and `LICENSES/` contains applicable third-party license texts. Generation fails if the maintained `.orc`, generated TypeScript, or catalog/transport constants disagree. The transient checkout and its ROM, demos, renders, and tools are not required after the baseline import is recorded.
