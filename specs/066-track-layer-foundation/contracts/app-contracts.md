# Contract: Track App, Library, and Editor Interfaces

## Canonical project mutation boundary

Electron main owns the active `BlueData`. Renderer actions send typed `ProjectDocumentPatch` intents and receive a new project snapshot/revision. Every Track target includes a project session plus stable Track identity; positional fields are advisory/recovery data, not authority.

Representative score patch variants:

```ts
type TrackRef = {
  readonly projectSessionId: number;
  readonly projectRevision: number;
  readonly rootGroupId: string;
  readonly trackId: string;
};

type TrackScorePatch =
  | { type: 'addTrackItem'; track: TrackRef; item: TrackItemTransfer; startBeats: number }
  | { type: 'moveTrackItems'; moves: readonly TrackItemMove[] }
  | { type: 'removeTrackItems'; targets: readonly TrackItemRef[] }
  | { type: 'replaceTrackNoteProcessorChain'; track: TrackRef; chain: NoteProcessorChainSnapshot }
  | { type: 'createTrackInstrument'; track: TrackRef; instrumentType: SupportedNewInstrumentType }
  | { type: 'replaceTrackInstrument'; track: TrackRef; instrument: InstrumentSnapshot }
  | { type: 'clearTrackInstrument'; track: TrackRef }
  | { type: 'updateTrackInstrument'; track: TrackRef; patch: InstrumentPatch };
```

Contract rules:

- The main boundary resolves Track by stable identity and rejects missing, stale-session, wrong-group, or ambiguous targets without mutation.
- Item add/move/paste/drop rechecks the registry placement descriptor before changing source or destination.
- `replaceTrackInstrument` reifies and deep-copies a supported instrument payload; it never installs a renderer/library object reference.
- Revision conflict behavior follows the existing project-document patch queue. A failed mutation returns/propagates a recoverable diagnostic and does not partially edit the Track.
- Existing ScoreObject Editor/Properties selection targets continue to identify Track-contained SoundObjects by stable object identity and canonical location.

## Snapshot contract

`ScoreLayerGroupSnapshot` replaces `groupType: 'audio'` with `groupType: 'track'` and a `TrackLayerGroupSnapshot`. Each Track row exposes:

- `layerKind: 'track'`;
- stable `layerId`/Track ID, name, height, mute, solo;
- ordered mixed `items` using existing AudioClip and SoundObject row snapshots;
- automation snapshot;
- Track Note Processor Chain snapshot;
- `instrument: TrackInstrumentSummary | null`.

The summary is display/target data only. The full editable instrument document is requested for the floating editor and is not stored as a mutable renderer model.

## Shared instrument clipboard contract

Track instrument Cut/Copy/Paste uses the application-wide typed instrument clipboard already shared with Arrangement/Unified Libraries.

- Copy captures a deep, serializable instrument payload and leaves Track unchanged.
- Cut captures first; only a successful capture triggers `clearTrackInstrument`.
- Paste is enabled only for a compatible captured instrument payload.
- Paste deep-copies/reifies the payload and replaces the current Track assignment atomically.
- Clipboard reads do not depend on which panel produced the payload.
- SoundObject, effect, UDO, and BSB widget payloads are rejected as wrong type without mutation.

## Unified Library drop target

Extend `LibraryExactTransferTarget`:

```ts
type TrackInstrumentTransferTarget = {
  readonly kind: 'trackInstrument';
  readonly projectSessionId: number;
  readonly projectRevision: number;
  readonly rootGroupId: string;
  readonly trackId: string;
};
```

Preview behavior:

- source type must be `instrument`;
- target session/revision and Track existence must validate;
- mode is independent copy/replacement only—no linked instance or move semantics;
- preview states distinguish valid assignment, valid replacement, wrong source type, stale target, unsupported instrument, and read-only/failure service state;
- apply consumes the preview token, deep-copies the source, atomically replaces assignment, and returns the new project revision/Track identity.

The Track header uses the existing library drag MIME/source reader and `useLibraryDropTarget` feedback patterns.

## Track instrument context menu

The Track instrument control right-click menu is ordered as:

```text
Use New Instrument >
  Generic Instrument
  Python Instrument
  JavaScript Instrument
  BlueX7
  BlueSynthBuilder
----------------------
Cut
Copy
Paste
```

- `Use New Instrument` is always enabled for a writable Track and atomically replaces any assignment with a fresh independent instrument.
- Cut and Copy are disabled when unassigned.
- Paste is disabled when no compatible instrument payload exists.
- Menu actions stop row rename/double-click handling and do not alter Score selection unless the existing selection contract requires selecting the Track control.

## Floating Track instrument editor

### Target

```ts
interface TrackInstrumentEditorRequest {
  readonly track: TrackRef;
}
```

### Lifecycle

- Double-click on an assigned control asks main to open/focus one non-modal child BrowserWindow keyed by `{projectSessionId, rootGroupId, trackId}`.
- Double-click when unassigned is a no-op.
- The window uses the existing effect editor's sizing/state/zoom/security pattern with `parent`, `modal: false`, `alwaysOnTop: true`, hidden until ready, context isolation, preload bridge, and no Node integration. The main window remains interactive.
- The renderer requests a full instrument snapshot by stable Track ID and reuses `InstrumentEditorPanel` via a Track-specific mutation adapter.
- Project document updates are broadcast to the window. Its view refreshes from canonical state; it does not become another owner.
- Track removal, instrument clearing/replacement, project switch/close, stale session, or unresolved target closes the stale window or displays a recoverable missing target state according to the existing editor-window convention. Replacement closes the prior editor before installing the new instrument, so queued patches cannot cross instrument ownership.
- Open, focus, read, and instrument-patch requests require nonnegative session/revision fences plus stable group/Track IDs. Main validates exact current session/revision before opening or mutating; stale and malformed requests are rejected without touching `BlueData`.

### Rapid mutation and runtime feedback

Continuous BSB controls and durable instrument edits use distinct typed messages:

```ts
type BsbRealtimeControlTarget =
  | { assignmentId: string }
  | {
      track: {
        projectSessionId: number;
        rootGroupId: string;
        trackId: string;
      };
    };

type TrackInstrumentEditorPatchResult = {
  status: 'applied' | 'unchanged' | 'stale' | 'unavailable';
  snapshot: TrackInstrumentEditorSnapshot | null;
};
```

- The realtime target is validated before touching the engine. A Track target must match the current project session and resolve one current Track-owned BlueSynthBuilder; it has no project revision because it cannot mutate `BlueData`.
- Slider, knob, toggle, dropdown, XY, and slider-bank values are sent to regular playback/Blue Live immediately and in gesture order, without awaiting a durable editor response.
- The editor permits one durable patch request in flight. Consecutive pending last-value patches coalesce only when applying the later patch is observably equivalent to applying both; all command-like/non-equivalent patches retain order.
- Main still enforces the exact session/revision fence for every durable request. On a revision mismatch in the same session, it returns `stale` plus the latest canonical snapshot without mutation; the editor advances its fence and retries the same patch.
- `unchanged` is a successful no-op and never produces an unavailable-editor message. Only `unavailable` replaces the editor with its missing-target state.
- A realtime-capable control patch is not written to the engine a second time from its later canonical acknowledgement. Presets and other non-direct patches still synchronize the canonical applied result to active engines.

### Preload/IPC surface

The bridge exposes narrowly typed methods/events for:

- open/focus editor request from the main renderer;
- get Track instrument editor document;
- apply Track instrument patch;
- send validated Arrangement- or Track-targeted BSB realtime control updates;
- receive project document updates;
- close/failure notification where the existing generic workbench event is insufficient.

Runtime validators reject malformed input before touching `BlueData`.

## Program settings contract

```ts
type DefaultLayerGroupType = 'TRACK' | 'SOUND_OBJECT';

interface ProjectDefaultsSettingsSnapshot {
  // existing fields...
  defaultLayerGroupType: DefaultLayerGroupType;
}
```

- Factory default: `TRACK`.
- Merge of a missing or invalid saved value: `TRACK`.
- Settings UI label: `Default Layer Group Type` with `Track Layer` and `SoundObject Layer` choices.
- New-project application creates exactly one configured initial group with one row and applies `layerHeightDefault` to that group/row.
- A generic `addLayerGroup` intent that omits `groupType` is normalized by the main-owned project mutation flow to the saved default; explicit Track, SoundObject, or Pattern choices are never replaced.
- The usage matrix records `program-settings-application.ts` as the consumer.
- Saving changes only app-wide program settings; existing project XML is untouched.

## Score timeline UI contract

- Current authoring labels say Track Layer Group/Track, not Audio Layer Group/Audio Layer.
- The Track canvas accepts AudioClip and registry-compatible SoundObject bars on one row and retains type-specific double-click editors.
- One gesture coordinator owns hit testing, marquee, moving, resizing, AudioClip fades/slip, snapping, cross-group transfer, clipboard, and library drops.
- Equal-time overlap uses reverse item order for topmost hit testing, matching existing canvas behavior.
- The Track timeline context menu exposes compatible Add SoundObject factories and AudioClip addition/import behavior; incompatible options are omitted or disabled with a reason.
- Command-click on macOS and Control-click on other platforms at an empty Track position invokes the same snapped, compatibility-checked ScoreObject-buffer paste used by the context menu.
- Track double-click relies on the preceding pointer selection and does not issue a second selection update; a mounted ScoreObject editor remains visible while the next document loads and same-type editors retain transient viewport state.
- Track and SoundObject timelines share one persistent in-app Set Color action. Right-click selects the object under the pointer when necessary. The picker captures that selection once, retains it across every successive preset, HSL, or hexadecimal edit, and patches every captured target for each emitted color; opening it again replaces the captured targets. Its anchor spans the complete affected row so viewport-clamped above/below placement never covers the edited object.
- ScoreObject Properties, automation, line-definition, and BSB-property color controls use the same picker. It remains open during internal edits and repeated trigger clicks, closes only for an outside click or Escape, and owns no persisted project state beyond the color patches emitted by its host.
- A Track row header exposes Mute, Solo, Note Processor, Automation, and the compact instrument control without preventing rename or height operations.
- Selecting a Track-contained SoundObject continues to populate ScoreObject Editor/Properties and clears incompatible timeline/Blue Live selections through the established selection coordinator.
