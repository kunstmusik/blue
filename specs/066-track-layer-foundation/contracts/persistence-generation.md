# Contract: Track Persistence and Generation

## Canonical XML shape

```xml
<trackLayerGroup name="Tracks" uniqueId="group-uuid">
  <defaultHeightIndex>1</defaultHeightIndex>
  <tracks>
    <track
      name="Piano and field recording"
      uniqueId="track-uuid"
      muted="false"
      solo="false"
      heightIndex="1"
      automationSelectedIndex="0">
      <noteProcessorChain>...</noteProcessorChain>
      <instrument type="blue.orchestra.GenericInstrument">...</instrument>
      <soundObject type="blue.soundObject.PianoRoll">...</soundObject>
      <audioClip>...</audioClip>
      <parameterId>parameter-uuid</parameterId>
    </track>
  </tracks>
</trackLayerGroup>
```

Contract rules:

1. `<instrument>` is absent when unassigned and appears at most once.
2. AudioClip and SoundObject children retain their relative order. Structural children (`noteProcessorChain`, `instrument`, `parameterId`) are not timeline items.
3. A Track loader rejects or preserves diagnostically a second instrument; it must not silently create a multiple-instrument state.
4. The canonical saver never emits `audioLayerGroup`, `audioLayers`, or `audioLayer`.
5. Unknown attributes and children on `trackLayerGroup`, its `tracks` container, and each `track` are retained as raw XML payload and survive canonical save/reopen; unknown non-Track siblings and other modeled unknown payload remain unchanged.
6. Newly saved Track XML is not contracted to Java Blue.
7. NotationObject is intentionally absent from registered/public persistence handling because it was never released as a supported Java Blue type and its TypeScript implementation was incomplete.

## Raw migration contract

Input detection is structural and recursive within the Score subtree:

```text
audioLayerGroup -> trackLayerGroup
audioLayers     -> tracks
audioLayer      -> track
```

For each migrated Track:

- retain all existing attributes and children;
- insert an empty `noteProcessorChain` only when absent;
- do not insert an instrument;
- preserve the legacy group and layer `uniqueId` exactly when valid;
- deterministically repair a missing/duplicate ID only through the existing identity-repair policy and update mixer association only when repair is unavoidable;
- do not touch `audioFile` SoundObjects elsewhere in the Score or SoundObject Library;
- do not run again on canonical Track elements.

The migration executes from `UpgradeManager.performUpgrades()` before `Score.loadFromXML()` regardless of the root version string.

## Placement capability contract

Every `registerSoundObjectType()`/factory definition has one canonical descriptor. The API exposes:

```ts
interface SoundObjectTypeDescriptor {
  readonly typeName: string;
  readonly trackPlacement: 'compatible' | 'incompatible';
  readonly trackPlacementReason?: string;
  readonly instrumentTargetBehavior:
    | 'assignable'
    | 'propagated'
    | 'preserve'
    | 'none';
}
```

- Registration fails fast in development/tests when the descriptor is absent.
- Runtime lookup of an unknown type returns a deny result, never implicit compatibility.
- Add menus include compatible registered factories only.
- Paste/drop/move validates the actual payload type again at the canonical mutation boundary.
- `AudioFile` returns incompatible with a reason directing the caller to AudioClip.
- `PolyObject` returns incompatible with a reason directing the caller to a SoundObject Layer Group; create, paste, drag, and move validation all enforce this result before mutation.
- `Instance` remains compatible and propagates the referenced object's instrument-target metadata through Instance processing.

## Generation method contract

Synchronous and asynchronous SoundObject and LayerGroup methods accept the same optional options shape:

```ts
interface ScoreGenerationOptions {
  readonly processWithSolo?: boolean;
  readonly trackId?: string;
  readonly instrumentOverrideId?: string;
  readonly instrumentTargetCollector?: InstrumentTargetCollector;
}
```

Implementation details may make the collector internal, but observable behavior must be:

1. A Track requests normal generation for one top-level SoundObject.
2. Leaf owners distinguish assignable musical notes from preserved support notes.
3. Instance/reference behavior, time behavior, and all Note Processor Chains owned by that top-level object complete.
4. The Track replaces p1 only on notes still marked assignable.
5. The Track applies its Note Processor Chain.
6. The Track Layer Group merges Track output.
7. The root Score applies its Note Processor Chain.

Empty or unsupported objects return an empty NoteList without corrupting the collector. Exceptions retain current ScoreGenerationException/runtime diagnostics and identify Track/object context where possible.

### Render-window origin contract

- Per-item generation receives a local crop window derived from the absolute render range and the item's score start.
- After compatible SoundObject generation, both Track and root SoundObject Layer containers rebase generated score events by the absolute render start and exclude events that remain before time zero.
- Track performs that shared rebase before merging AudioClip playback events, because the AudioClip generator already returns render-relative start times and trim offsets.
- The same boundary and results apply to synchronous and asynchronous generation. A PianoRoll event at absolute beat 16 rendered from beat 16 therefore begins at performance time 0 through either layer path.

## p1 transformation contract

Given an assigned runtime instrument ID `R`:

- positive integer `N` becomes `R`;
- positive decimal `N.suffix` becomes `R.suffix`;
- negative integer `-N` becomes `-R`;
- negative decimal `-N.suffix` becomes `-R.suffix`;
- a valid named p1 becomes `R`;
- malformed or missing p1 is preserved and produces a deterministic diagnostic;
- a note marked `preserve` is unchanged in every case.

The transformation is render-only. Saving immediately after compilation produces byte-equivalent authored p1 fields, excluding unrelated serializer normalization.

## Compilation pre-registration contract

For standard sync, standard async, and disk compilation:

```text
clone Arrangement/Tables/Mixer
  -> assign mixer channel IDs
  -> register enabled Track instruments in score order
  -> collect Arrangement + Track UDOs
  -> collect parameters and string channels once
  -> generate ftables
  -> generate score/Track events
  -> generate global score/orchestra and instruments
  -> generate mixer
```

Each Track instrument:

- is deep-copied from canonical Track state into the render Arrangement;
- is registered once and receives one deterministic runtime identity;
- uses Track ID as source ID for `<INSTR_ID>` and mixer association behavior;
- contributes its UDOs, ftables, global score/orchestra, parameters, string channels, and always-on support exactly once;
- appears in neither the project Arrangement nor saved Track state as a generated runtime assignment.

The sync and async paths must produce the same IDs, p1 results, and ordering for non-runtime-dependent fixtures. Runtime-backed instruments use the existing async runtime contract and fail clearly when unavailable.

### Live parameter mapping and controls

- After realtime or Blue Live compilation, compiled parameter channel names map back to live models in Arrangement-instrument, Track-instrument, then mixer order.
- A validated Track runtime-control message resolves the current Track-owned BlueSynthBuilder by project session and stable group/Track IDs, then resolves the widget's mapped parameter channel.
- Runtime control messages do not run compilation, change registration order, increment the project revision, or alter `.blue` XML.
- The engine-client request queue preserves control-write order. Durable editor persistence is separately serialized and coalesced, so its acknowledgement latency cannot create stale audible control feedback.
- Presets and non-direct instrument patches synchronize their canonical post-patch parameter values through the normal project-patch runtime path.

## Audio playback contract

- At most one render-only AudioClip playback instrument is allocated per Track per compilation.
- Its event p1 values are never replaced by the assigned Track instrument.
- All rendered AudioClips on the Track use that playback runtime ID and existing trim/fade/loop semantics.
- With mixer enabled, its output variables point at the channel associated with Track ID.
- With mixer disabled or association recovery falling back to Master/raw output, compilation remains valid under existing behavior.

## Mixer reconciliation contract

After reconciliation:

- each Track Layer Group has exactly one ChannelList with matching association;
- each Track has exactly one source Channel with matching association;
- duplicate associations retain the first canonical ChannelList/Channel and all of its state; later duplicates are removed;
- Track order defines channel order within the group unless preserving an existing unambiguous order is required during migration;
- Track rename updates the channel display name without replacing the channel object;
- effects, sends, level, automation, output route, and other channel state survive rename/reorder and legacy migration;
- adding creates one channel; removal deletes only the unowned associated channel; repeated reconciliation is idempotent.
