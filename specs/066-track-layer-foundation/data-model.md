# Data Model: Track Layer Foundation

## Entity overview

```text
Score
└── TrackLayerGroup (0..n)
    └── Track (0..n)
        ├── TrackItem (0..n, ordered)
        │   ├── AudioClip
        │   └── SoundObject
        ├── Instrument (0..1, embedded/deep-owned)
        ├── NoteProcessorChain (1)
        └── ParameterIdList / automation selection (1)

TrackLayerGroup ── stable association ── Mixer ChannelList
Track           ── stable association ── Mixer source Channel
```

## TrackLayerGroup

The canonical layer group replacing `AudioLayerGroup` in TypeScript Blue.

### Fields

| Field | Type | Persistence | Rules |
|---|---|---|---|
| `name` | string | `<trackLayerGroup name>` | User editable; does not define identity |
| `uniqueId` | string | `<trackLayerGroup uniqueId>` | Stable and non-empty; migrated Audio Layer Group ID is retained |
| `defaultHeightIndex` | integer | `<defaultHeightIndex>` | Existing layer-height range |
| `tracks` | ordered `Track[]` | `<tracks>` | May be empty in historical/malformed data; normal UI creation starts with one Track |

### Relationships and invariants

- Its `uniqueId` is the association of exactly one mixer ChannelList when the mixer representation is reconciled.
- Renaming or reordering does not change the association.
- It has no additional persistent Note Processor Chain in this MVP; processing is at SoundObject, Track, and root Score scopes.
- `deepCopyLG()` deep-copies every Track and all Track-owned content while retaining the same copy semantics used by existing layer groups.

## Track

One generic arrangement row and mixer source.

### Fields

| Field | Type | Persistence | Rules |
|---|---|---|---|
| `name` | string | `<track name>` | User editable; duplicate names allowed |
| `uniqueId` | string | `<track uniqueId>` | Stable, non-empty, and unique within the loaded project after repair |
| `muted` | boolean | `<track muted>` | Mute excludes Track generation |
| `solo` | boolean | `<track solo>` | Existing score-wide solo arbitration applies |
| `heightIndex` | integer | `<track heightIndex>` | Existing 0-based layer-height index |
| `automationSelectedIndex` | integer | `<track automationSelectedIndex>` | Normalized against retained parameter IDs |
| `automationParameterIds` | ordered string[] | `<parameterId>` | Existing `ParameterIdList` semantics |
| `noteProcessorChain` | `NoteProcessorChain` | `<noteProcessorChain>` | Always present in the model; empty chain serializes normally |
| `instrument` | `Instrument | null` | optional `<instrument>` | Zero or one; Track-owned independent deep copy |
| `items` | ordered `TrackItem[]` | direct heterogeneous children | Only `AudioClip` or Track-compatible `SoundObject` |

### Relationships and invariants

- Its `uniqueId` is the mixer source-channel association and the Track instrument compilation source ID.
- All item mutations preserve one ordered list. Equal-time rendering and hit testing use array order as the deterministic tiebreaker.
- An assigned instrument is not an Arrangement reference. Assign, paste, drop, and copy-in all call `deepCopy()` before ownership changes.
- Track removal removes its canonical data and permits reconciliation to remove its source channel. A cut operation captures the instrument before clearing it.
- AudioClip file playback uses a render-only Track audio instrument; this is not the assigned Track instrument and is not persisted.
- SoundObject placement uses registry metadata, never only an `instanceof` check in the UI.

### State transitions

```text
Unassigned
  ├── Use New Instrument(type) ──> Assigned(independent new instance)
  ├── Paste(captured instrument) ─> Assigned(independent copy)
  └── Drop(library instrument) ──> Assigned(independent copy)

Assigned
  ├── Edit ──────────────────────> Assigned(updated embedded instance)
  ├── Use New Instrument(type) ──> Assigned(replacement)
  ├── Paste/Drop ────────────────> Assigned(replacement independent copy)
  ├── Copy ──────────────────────> Assigned + clipboard independent copy
  ├── Cut success ───────────────> Unassigned + clipboard independent copy
  └── Clear/Remove ──────────────> Unassigned
```

Invalid/stale patch, incompatible clipboard payload, failed capture, or rejected library preview leaves the state unchanged.

## TrackItem

```ts
type TrackItem = AudioClip | SoundObject;
```

### Validation

- `AudioClip` is always accepted.
- A `SoundObject` is accepted only when its normalized registered type has `trackPlacement: 'compatible'`.
- `AudioFile` SoundObject is registered as incompatible; use `AudioClip` for file audio.
- `PolyObject` is registered as incompatible; it remains the SoundObject Layer Group container and cannot be created, pasted, dragged, or moved into a Track.
- Unknown and unclassified object types are rejected without mutation and with a UI/diagnostic reason.
- Cross-layer moves and paste/drop operations validate the destination before removing the source.
- `Instance` is compatible when registered and propagates instrument-target metadata from its referenced SoundObject through Instance processing.

`NotationObject` is not a Track-placement type or public model. It was never released as a supported Java Blue feature, its TypeScript implementation was incomplete, and this feature intentionally removes it from registration, loading, and exports.

## Track placement descriptor

Required metadata stored with each SoundObject registry entry.

| Field | Type | Meaning |
|---|---|---|
| `typeName` | string | Canonical registered type |
| `trackPlacement` | `'compatible' | 'incompatible'` | Required explicit placement result |
| `reason` | string | Required for incompatible types and exposed to UI diagnostics |
| `instrumentTargetBehavior` | `'assignable' | 'propagated' | 'preserve' | 'none'` | How generated notes participate in Track assignment |

Registration aliases normalize to the same descriptor. Registry tests compare all loader/factory keys with descriptor keys so a future type cannot silently default to compatible.

## ScoreGenerationOptions

Disposable options shared by LayerGroup and SoundObject generation.

| Field | Type | Meaning |
|---|---|---|
| `processWithSolo` | boolean | Existing score-wide solo decision |
| `trackId` | string \| undefined | Stable Track source/mixer association |
| `instrumentOverrideId` | string \| undefined | Render-time ID allocated for the assigned Track instrument |
| `instrumentTargetPhase` | internal enum/callback | Marks safe notes and applies the override at the Track boundary |

Rules:

- Options are never serialized or retained after compilation.
- The same semantics apply in sync and async generation.
- Note-level target disposition is transient and is copied only as needed through Note processing; serialization excludes it.
- The top-level Track item finishes its own Instance/reference generation, time behavior, and Note Processor Chains before eligible p1 replacement.
- Track processors run after replacement; root Score processors run after Track aggregation.
- Any processor may intentionally modify p1 after the Track assignment phase.

## Track instrument render registration

A render snapshot contains a deep-copied Arrangement and a `CompileData` instance. Registration produces this transient relation:

| Key | Value |
|---|---|
| Track `uniqueId` | assigned runtime instrument ID |

Rules:

- Traverse groups and Tracks in score order for deterministic IDs.
- Register enabled assigned instruments exactly once before Arrangement UDO/parameter/string/ftable/global/orchestra compilation.
- Use Track `uniqueId` as the instrument source ID and mixer association.
- Disabled/unassigned/removed instruments produce no registration entry.
- Track audio playback instruments are lazily registered separately only when a rendered AudioClip needs one.

## Track mixer association

### Canonical project state

- One ChannelList with `association === TrackLayerGroup.uniqueId`.
- One source Channel per Track with `association === Track.uniqueId`.
- Existing level, effects, sends, automation, and routing remain on the associated objects across migration, rename, reorder, and reconciliation.

### Recovery

- Missing channel: create one using the Track name and association.
- Duplicate association: deterministically retain the first canonical channel and repair/remove only the duplicate representation without discarding retained channel state.
- Legacy name-only channel: association repair may use unique unambiguous name fallback, then persist the Track association.
- Removed Track: remove only the now-unowned associated channel after canonical document mutation succeeds.

## Program setting

`ProjectDefaultsSettingsSnapshot.defaultLayerGroupType`

| Value | New-project result |
|---|---|
| `'TRACK'` | Track Layer Group with one Track |
| `'SOUND_OBJECT'` | PolyObject/SoundObject Layer Group with one layer |

Missing, malformed, or unknown values normalize to `'TRACK'`. The setting affects future new projects and generic add defaults only; it is not stored in `.blue` XML and does not mutate an open project.

## Historical Audio migration mapping

| Legacy XML/model | Canonical Track XML/model | Preservation rule |
|---|---|---|
| `audioLayerGroup` | `trackLayerGroup` | Preserve `name`, `uniqueId`, order, and `defaultHeightIndex` |
| `audioLayers` | `tracks` | Preserve container position |
| `audioLayer` | `track` | Preserve `name`, `uniqueId`, `muted`, `solo`, `heightIndex`, `automationSelectedIndex` |
| child `audioClip` | direct Track `audioClip` | Preserve complete element and order |
| child `parameterId` | Track `parameterId` | Preserve text and order |
| absent legacy NPC | empty Track `noteProcessorChain` | Initialize canonical empty chain |
| absent legacy instrument | no Track `<instrument>` | Track starts unassigned |
| unknown group/container/Track attributes and children | same raw attributes/children on canonical owner | Preserve through migration, load, save, and reopen |
| mixer group/layer associations | same IDs | No association rewrite required |

The migration runs before deserialization, is idempotent, and leaves nonmatching siblings and unknown data untouched. Saving writes only canonical Track elements.

## Renderer projection

### TrackLayerGroupSnapshot

- `groupId`, `groupType: 'track'`, `name`, `defaultHeightIndex`
- ordered `layers: TrackSnapshot[]`

### TrackSnapshot

- existing row identity, name, height, mute, solo, automation, items
- `layerKind: 'track'`
- `noteProcessorChain`
- `instrument: TrackInstrumentSummary | null`

### TrackInstrumentSummary

- stable Track target (`trackId`, group/root location)
- instrument `type`, `instrumentType`, `name`, `comment`, enabled/support status needed by the control
- no renderer-owned mutable Instrument object

## Track instrument editor mutation state

The detached editor has two transient flows; neither adds persisted fields to `Track` or `.blue` XML.

### Runtime control target

| Field | Rule |
|---|---|
| `projectSessionId` | Must equal the active project session |
| `rootGroupId` | Resolves one current Track Layer Group |
| `trackId` | Resolves one current Track with a BlueSynthBuilder instrument |
| `widgetId` | Resolves one current BSB widget whose parameter has a compiled channel name |
| `kind` / `payload` | Validated value, selected, selectedIndex, XY, or slider-bank value |

Runtime controls have no document revision and no canonical mutation authority. They only write the addressed compiled channel in regular playback and/or Blue Live. Engine transport preserves gesture order.

### Durable editor queue

- At most one `InstrumentPatch` request is in flight from a detached editor.
- Consecutive pending scalar replacement fields use the newest value.
- Consecutive BSB widget-property patches for the same widget merge property keys with newest values winning; slider-bank values coalesce only for the same widget and slider index.
- Different widgets, command-like BSB patches, preset operations, embedded UDO operations, and otherwise non-equivalent patches retain FIFO order.
- `applied` and `unchanged` responses include the canonical snapshot; `stale` includes the latest snapshot and causes the same patch to retry; `unavailable` is reserved for a missing/wrong session, Track, or instrument.
- Project broadcasts and patch responses only advance the editor snapshot revision; an older response cannot replace a newer canonical snapshot.

Detailed mutation and window contracts are in [contracts/app-contracts.md](./contracts/app-contracts.md).
