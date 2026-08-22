# Contract: Java Blue Live Manual Trigger

## Purpose

Define the typed renderer → preload → Electron main request/result contract, canonical patch acknowledgement rules, and main → engine submission gate for selected-cell and enabled-batch Manual Trigger.

## Renderer/Preload API

```ts
type LegacyBlueLiveTriggerRequest =
  | {
      mode: 'selected';
      liveObjectId: string;
    }
  | {
      mode: 'enabled';
    };

type LegacyBlueLiveTriggerStatus =
  | 'submitted'
  | 'empty'
  | 'busy'
  | 'rejected'
  | 'failed'
  | 'stale';

type LegacyBlueLiveTriggerErrorCode =
  | 'no-project'
  | 'not-running'
  | 'invalid-request'
  | 'target-not-found'
  | 'invalid-tempo'
  | 'runtime-unavailable'
  | 'generation-failed'
  | 'stale-document'
  | 'stale-session'
  | 'engine-rejected';

interface LegacyBlueLiveTriggerResult {
  ok: boolean;
  status: LegacyBlueLiveTriggerStatus;
  code?: LegacyBlueLiveTriggerErrorCode;
  message?: string;
  targetCount: number;
  noteCount: number;
  documentRevision: number;
  blueLiveSessionId: number;
}

interface BlueAPI {
  triggerBlueLiveObjects(
    request: LegacyBlueLiveTriggerRequest,
  ): Promise<LegacyBlueLiveTriggerResult>;
}
```

## Request Validation

1. The preload bridge exposes only the discriminated request object.
2. `mode: 'selected'` requires a trimmed, non-empty `liveObjectId`.
3. `mode: 'enabled'` has no object identifier.
4. Row and column indices are not accepted as canonical identity.
5. Main validates the request again before accessing project or engine state.
6. Renderer-supplied document/session revisions, score text, tempo, enabled lists, or runtime state are rejected or ignored; main derives them canonically.

## Command Ordering

Before invoking `triggerBlueLiveObjects`, the renderer MUST await `flushPendingPatches()`.

```text
edit intent
  -> optimistic renderer update
  -> commitProjectDocumentPatches
  -> ProjectDocumentCommitReceipt
  -> triggerBlueLiveObjects
```

If the commit fails, `flushPendingPatches()` rejects after attempting canonical snapshot recovery, and the trigger call is not made.

The same barrier applies before Blue Live start and recompile.

## Canonical Patch Acknowledgement

```ts
interface ProjectDocumentCommitReceipt {
  revision: number;
  sessionId: number;
  changed: boolean;
}
```

Rules:

- Main applies each patch and aggregates whether any canonical mutation occurred.
- `revision` advances once for a batch only when `changed` is true.
- All-no-op/rejected batches return `changed: false` and the unchanged revision.
- Engine synchronization, project-changed publication, and document-update broadcast run only for actual changes.
- A commit transport/application failure rejects rather than masquerading as an acknowledgement.

## Target Semantics

### Selected

- Resolve `liveObjectId` against the copied canonical bins.
- Enabled state is ignored.
- Missing/null/non-SoundObject target returns:

```ts
{
  ok: false,
  status: 'rejected',
  code: 'target-not-found',
  ...
}
```

### Enabled

- Traverse the copied bins in their existing column-major order.
- Include every non-null LiveObject with `enabled === true`.
- Do not impose row or column exclusivity.
- No targets returns:

```ts
{
  ok: true,
  status: 'empty',
  targetCount: 0,
  noteCount: 0,
  ...
}
```

## Preparation Contract

For every captured target:

1. Operate only on the isolated copy.
2. If copied `TimeBehavior` is supported, set the copy to `NONE`.
3. Generate from time zero with no end bound.
4. Use the copied project TimeContext and one request-local CompileData.
5. Inject existing JavaScript and Java runtime contracts when applicable.
6. Await asynchronous generation when available.
7. If any target fails, return one failure and submit none of the batch.
8. Merge successful NoteLists in deterministic target order.
9. Multiply every note start and duration by `60 / copied LiveData tempo`.
10. Convert to one score-text batch.

Preparation MUST NOT compile orchestra text, start processes, or contact the engine.

## Single-Flight and Fence Contract

Main records:

- canonical project session ID;
- canonical document revision;
- Blue Live session ID/generation.

At most one preparation job may hold the active session’s trigger slot. A competing request returns `busy`.

Main checks all three origin values:

- before copying/preparation;
- after preparation;
- immediately before score submission.

A mismatch produces `stale-document` or `stale-session` and no engine call.

## Engine Submission Contract

`BlueLiveEngineSession` accepts prepared score text only when:

- status is `running`;
- the expected session ID equals the active session ID;
- a Blue Live engine client exists;
- score text is non-empty.

Submission uses the existing score normalization and `readScore` operation. It MUST NOT route through realtime playback or start a new engine.

Engine rejection or transport failure returns `engine-rejected`; it does not change project state or enabled flags.

## Result/UI Contract

| Outcome | `ok` | Status | UI behavior |
|---|---:|---|---|
| Batch accepted by engine | true | `submitted` | Short non-persistent success/count feedback |
| No targets or zero generated notes | true | `empty` | Clear benign no-op feedback |
| Preparation already in flight | false | `busy` | Keep existing job; do not queue |
| Invalid target/request/not running | false | `rejected` | Recoverable message |
| Runtime/generation/engine error | false | `failed` | Object/action-specific error |
| Document/session changed | false | `stale` | Explain that project/session changed; allow retry |

Runtime feedback does not alter cell color, enabled flags, saved sets, or `.blue` XML.

## Keyboard/UI Behavior

- Platform Command/Ctrl+T triggers the selected populated cell while Live Space owns the shortcut context.
- Platform Command/Ctrl+Shift+T triggers all enabled cells.
- The existing Trigger button invokes enabled mode.
- Actions are disabled or safely rejected when Blue Live is not running or a legacy trigger job is busy.
- Repeat settings remain editable but the UI identifies audible Repeat as deferred.

## Project Replacement Contract

Before clearing or installing canonical project data, close/new/open/revert/replacement flows:

1. close the trigger submission gate;
2. await stop/cancellation for every `starting`, `running`, or `stopping` Blue Live session;
3. dispose/reinitialize project runtime state as already required;
4. install the replacement project and its new project session identity.

Pending runtime work may complete internally but cannot pass the old fence.

## Compatibility Contract

This API:

- does not change `.blue` XML;
- preserves stable LiveObject IDs and saved-set semantics;
- does not launch a saved set when it is applied;
- does not interpret enabled as playing;
- does not implement audible Repeat or key/MIDI LiveObject triggers;
- does not create tracks, scenes, clip slots, launch quantization, loops, or performance capture.

## Live Cell Authoring Contract

The existing project-document patch union gains:

```ts
type BlueLivePatch =
  | {
      type: 'setCell';
      column: number;
      row: number;
      cell: LiveObjectCellSnapshot | null;
    }
  | ExistingBlueLivePatch;
```

For a populated `cell`, `serializedXml` is required. Main parses the XML,
accepts only the Java-live-compatible SoundObject allowlist, normalizes the
SoundObject to beat-zero start, and stores a new `LiveObject` with the supplied
fresh identity. Display, timing, color, and type metadata are re-derived in the
next canonical snapshot. Invalid coordinates, malformed XML, unsupported
types, and removing an already empty cell do not mutate the document.

Blue Live context-menu Copy/Cut writes `ScoreObjectClipboardEntry[]` in the
renderer Score selection store. Blue Live Paste accepts exactly one entry with
loadable XML and a supported type, deserializes it, resets SoundObject start to
beat zero, and submits `setCell` with a fresh LiveObject identity. The project
patch contains no renderer object references.

## BSB-to-Score Transfer Contract

The unified-library exact transfer union gains:

```ts
{
  kind: 'scoreBsbSound';
  projectSessionId: number;
  projectRevision: number;
  location: ScoreInsertionLocation;
  timeContextRevision: string;
}
```

This target expects an Instrument clipboard source. Preview and apply both
revalidate the source as `BlueSynthBuilder`, the target project/revision, and
the compatible Score sound layer. Apply creates a destination-owned
BlueSynthBuilder, flattens each automation parameter to its value at time
of conversion after automation is disabled, embeds it in a new `Sound`, and
inserts it at `location.startTime`.
Renderer `LibraryInteractionClipboard.objectType` controls menu enablement but
is advisory; main-owned payload validation is authoritative.

## Live SoundObject Editor Contract

The existing `ScoreObjectEditorTargetSnapshot` adds a Blue Live ownership
variant:

```ts
{
  ownerKind: 'blueLive';
  displayContext: 'blueLive';
  selectionId: string;
  selectedObjectType: string;
  editorObjectType: string;
  blueLive: {
    liveObjectId: string;
    column: number;
    row: number;
  };
}
```

Selecting a populated cell publishes exactly one such target through the
shared ScoreObject selection store and activates the ScoreObject Editor.
Selecting an empty cell clears that store. ScoreObject Properties consumes the
same target when visible; selection does not force-open it.

Editor-document reads and Score patch writes resolve the target against
canonical `LiveObjectBins`. The coordinate hint is accepted only when the
LiveObject identity matches. Otherwise resolution searches by stable identity.
If the identity is absent because the cell was removed or replaced, the read
returns the existing removed-target fallback and writes are rejected.
