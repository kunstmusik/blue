# Data Model: Java Blue Live Trigger Parity

No new persisted project entity or XML element is introduced. The feature adds transient command, preparation, fence, and result models around existing `BlueData`, `LiveData`, `LiveObjectBins`, `LiveObject`, and `LiveObjectSetList`.

## Existing Persistent Entities

### LiveData

**Owner**: Main-process canonical `BlueData`

**Persistence**: Existing `.blue` XML

**Relevant fields**:

- `tempo`: finite positive integer used for Manual Trigger scaling
- `repeat`: preserved compatibility value; not scheduled in this feature
- `repeatEnabled`: preserved compatibility value; not scheduled in this feature
- `liveObjectBins`: sparse column-major grid
- `liveObjectSets`: arbitrary saved enabled masks by LiveObject identity
- command-line options and Live Code: preserved; existing start/evaluation behavior remains

**Validation**:

- Manual Trigger requires finite `tempo > 0`.
- Existing Repeat values are preserved without activating scheduling.

### LiveObject

**Owner**: `LiveData.liveObjectBins`

**Relevant fields**:

- `uniqueId`: stable identity retained across whole-project copy and XML round-trip
- `enabled`: persistent authoring selection included by enabled-batch Trigger
- `soundObject`: nullable generated content
- `keyTrigger`, `midiTrigger`: preserved but non-operative here

**Relationships**:

- A selected trigger resolves one LiveObject by `uniqueId`.
- An enabled trigger resolves all non-null LiveObjects whose `enabled` is true.
- A saved set references zero or more `uniqueId` values and changes only enabled flags.

### SoundObject Library and Instance

**Owner**: Canonical `BlueData.soundObjectLibrary`

**Relationship rule**: A copied `Instance` that referenced a canonical library object must reference the corresponding copied library object. It must never retain an object reference into the canonical graph.

## Transient Entities

### LegacyBlueLiveTriggerRequest

Represents renderer intent only.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `mode` | `'selected' \| 'enabled'` | yes | Discriminates target selection |
| `liveObjectId` | `string` | selected only | Non-empty stable LiveObject identity |

**Validation**:

- `selected` requires exactly one non-empty `liveObjectId`.
- `enabled` ignores/rejects a supplied object ID.
- Coordinates are never canonical identity.

### TriggerOrigin

Enriched by Electron main; never trusted from the renderer.

| Field | Type | Rules |
|---|---|---|
| `projectSessionId` | non-negative integer | Identifies the active canonical project installation |
| `documentRevision` | non-negative integer | Changes only with canonical data mutation |
| `blueLiveSessionId` | positive integer | Identifies one running Blue Live generation |
| `requestedAt` | monotonic/runtime timestamp | Diagnostic ordering only |

### TriggerPreparationSnapshot

An isolated, disposable whole-project graph plus immutable-for-the-operation metadata.

| Field | Type | Rules |
|---|---|---|
| `project` | deep-copied `BlueData` | No reference into canonical mutable domains |
| `origin` | `TriggerOrigin` | Captured before preparation |
| `tempo` | number | Finite and greater than zero |
| `targets` | `LiveObject[]` | Resolved once from the copied bins |
| `mode` | trigger mode | Retained for diagnostics |

**Identity rules**:

- Whole-project copy preserves project and LiveObject IDs.
- Library object references are remapped to copied objects.
- This model is never saved.

### PreparedScoreBatch

Disposable result of successful target preparation.

| Field | Type | Rules |
|---|---|---|
| `origin` | `TriggerOrigin` | Must still match at submission |
| `mode` | trigger mode | Selected or enabled |
| `targetIds` | `string[]` | Stable IDs in deterministic column-major target order |
| `targetCount` | integer | Equals `targetIds.length` |
| `noteCount` | integer | Non-negative |
| `scoreText` | string | Empty only when generated note count is zero |
| `tempoScale` | number | Exactly `60 / tempo` |

**Atomicity**:

- Any target generation failure produces no `PreparedScoreBatch`.
- Empty successful generation produces an `empty` result and no engine call.
- Prepared batches are never persisted or cached by this feature.

### LegacyBlueLiveTriggerResult

Typed result returned through preload.

| Field | Type | Meaning |
|---|---|---|
| `ok` | boolean | Request completed as submitted or benignly empty |
| `status` | result status | Discriminated outcome |
| `code` | optional error code | Stable programmatic failure category |
| `message` | optional string | User-facing diagnostic |
| `targetCount` | number | Resolved target count |
| `noteCount` | number | Prepared note count |
| `documentRevision` | number | Canonical revision used or checked |
| `blueLiveSessionId` | number | Runtime generation used or checked |

**Statuses**:

- `submitted`
- `empty`
- `busy`
- `rejected`
- `failed`
- `stale`

**Error codes**:

- `no-project`
- `not-running`
- `invalid-request`
- `target-not-found`
- `invalid-tempo`
- `runtime-unavailable`
- `generation-failed`
- `stale-document`
- `stale-session`
- `engine-rejected`

### ProjectDocumentCommitReceipt

Existing acknowledgement extended for meaningful barriers.

| Field | Type | Rules |
|---|---|---|
| `revision` | non-negative integer | Advances only if canonical project data changed |
| `sessionId` | non-negative integer | Existing canonical project/runtime dependency session |
| `changed` | boolean | True if at least one patch mutated canonical data |

## Canonical State Ownership

| State domain | Canonical owner | Persistence/lifetime |
|---|---|---|
| Project and legacy Blue Live data | Electron main `BlueData` | `.blue` XML |
| Document revision | Electron main | Active project lifetime |
| Buffered edit intents | Renderer project store | Until commit acknowledgement or recovery |
| Live Space selected cell | Renderer `LiveSpaceTab` | Component/session lifetime |
| Blue Live lifecycle/session generation | Main `BlueLiveEngineSession` | Runtime only |
| Trigger in-flight/busy state | Main trigger controller; mirrored locally for UI | Runtime only |
| Prepared score batch | Main trigger controller | One request only |
| Java/JavaScript runtime session | Electron main | Project/runtime session |
| Engine client/process | Electron main | Blue Live session |
| Trigger diagnostics | Main result, renderer toast/status | Runtime only |

## State Transitions

### Trigger Job

```text
requested
  ├─> rejected        (invalid request, no project, not running)
  ├─> busy            (another job owns the session's single-flight slot)
  └─> preparing
        ├─> failed    (runtime unavailable or generation failure)
        ├─> empty     (no targets or no generated notes)
        ├─> stale     (document or session origin changed)
        └─> prepared
              ├─> stale     (origin changed before submission)
              └─> submitting
                    ├─> submitted
                    └─> failed (engine rejected/transport error)
```

### Blue Live Session Fence

```text
idle/stopped/error
  └─ start -> starting(session N)
                 ├─ failure -> error
                 └─ success -> running(session N)
                                  ├─ stop -> stopping -> stopped
                                  └─ recompile -> stopping -> starting(session N+1)
```

Any job captured under session N is invalid once the lifecycle leaves `running(session N)` or a later session ID is installed.

### Document Revision Barrier

```text
renderer edit -> pending patch queue -> commit
  ├─ commit failed -> canonical refresh -> barrier rejects -> live command blocked
  ├─ all no-op -> receipt(changed=false, same revision) -> command may continue
  └─ changed -> receipt(changed=true, revision+1) -> command uses new revision
```

## Invariants

1. Trigger-only workflows do not change canonical serialization.
2. A prepared result may be submitted only when project session, document revision, and Blue Live session generation all match its origin.
3. At most one preparation job is in flight for a Blue Live session.
4. Enabled-batch target membership is captured once from one isolated snapshot.
5. One target failure prevents partial batch submission.
6. `enabled` remains persistent authoring state, not runtime playing state.
7. Repeat/key/MIDI values round-trip but create no trigger job in this feature.

## Authoring and Clipboard Extension

### LiveObjectCellSnapshot

The existing renderer cell view gains enough immutable content to participate in ScoreObject copy/paste:

| Field | Rules |
|---|---|
| `serializedXml` | Full embedded SoundObject XML; required for a populated cell |
| `startBeats` | Derived in the project Score `TimeContext`; paste into Blue Live normalizes it to `0` |
| `durationBeats` | Derived in the project Score `TimeContext` |
| `startTimeBase` / `durationTimeBase` | Preserve authored time-base metadata for Score paste |
| `backgroundColor` | Preserved when copied to the Score timeline |

Existing `uniqueId`, enabled/trigger fields, display name, object type, and presence state remain unchanged.

### BlueLive `setCell` Patch

```text
setCell(column, row, cell | null)
```

- Coordinates must address the canonical grid.
- `null` removes the targeted LiveObject.
- A populated payload must contain a fresh or retained LiveObject identity and loadable SoundObject XML.
- The loaded SoundObject class must be in the Java-live-compatible allowlist.
- The canonical model derives display/timing/color fields from the loaded object rather than trusting renderer display metadata.
- Replacing a cell is one project mutation; invalid coordinates or payloads are semantic no-ops.

### Shared ScoreObject Buffer

The existing `ScoreObjectClipboardEntry[]` is the single Score/Blue Live buffer.

- Score selection may contain multiple entries, but Blue Live Paste accepts exactly one.
- Blue Live Copy/Cut writes one entry with serialized XML, source timing/color, and a neutral source layer coordinate.
- Every paste deserializes or deep-copies the payload and creates destination-owned identity.
- The buffer is transient and survives panel unmounts but not application restart.

### Shared Instrument Buffer

The existing `LibraryInteractionClipboard` gains optional `objectType` metadata.

- Orchestra Copy/Cut stores an Instrument transfer source plus its concrete type.
- Paste BSB As Sound is enabled only for normalized type `BlueSynthBuilder`.
- The main-owned opaque clipboard payload remains authoritative; renderer metadata controls presentation only and is revalidated during transfer.

### BSB-to-Sound Exact Transfer Target

```text
scoreBsbSound {
  projectSessionId
  projectRevision
  location
  timeContextRevision
}
```

Validation requires a current project/revision, a resolvable compatible sound layer, and a `BlueSynthBuilder` source. Conversion creates a new `Sound`, embeds a deep BSB copy, copies the BSB comment, disables automation, and converts every parameter automation line to constant endpoints at the parameter's resulting fixed current value.

### Clipboard Ownership

| Payload | Owner | Consumers |
|---|---|---|
| ScoreObject entries | Renderer Score selection store | Score timeline, Blue Live |
| Instrument opaque transfer | Main unified-library service; renderer holds descriptor | Orchestra, Score Paste BSB As Sound |
| BSB widget selection | Renderer BSB clipboard store | BSB interface canvas only |

### Blue Live Editor Target

```text
ScoreObjectEditorTargetSnapshot {
  ownerKind: "blueLive"
  displayContext: "blueLive"
  selectionId: LiveObject.uniqueId
  selectedObjectType
  editorObjectType
  blueLive {
    liveObjectId
    column
    row
  }
}
```

The renderer publishes this target only for a populated cell. Main-process
resolution first validates that the hinted cell still owns `liveObjectId`,
then falls back to `LiveObjectBins.getLiveObjectByUniqueId()` so retained
objects remain editable after row/column insertion. A missing or replaced
identity resolves to no target. Editor and Properties reads use the existing
ScoreObject editor document; edits use existing Score patches, which mutate
the SoundObject owned by the resolved canonical LiveObject.

### Additional Invariants

8. A menu command always applies to the cell that opened the menu, not a previously selected cell.
9. A retained cell keeps its LiveObject identity across row/column insertion; a pasted or newly added cell receives a fresh identity.
10. The grid always retains at least one row and one column.
11. ScoreObject, Instrument, and BSB widget clipboard payloads are not implicitly coerced into one another.
12. A BSB-to-Sound transfer is revalidated against the main-owned payload and canonical target immediately before mutation.
13. A Blue Live editor/property target can never resolve solely by row and column; stable LiveObject identity is authoritative.
14. Selecting an empty cell clears the shared ScoreObject selection and does not open an empty editor target.
