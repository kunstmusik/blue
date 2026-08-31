# Data Model: Glitch-Free Track Instrument Editor Opening

This feature introduces no persisted project entity. The following runtime and
diagnostic entities clarify ownership, lifecycle, and validation boundaries.

## Ownership Map

| State | Canonical owner | Lifetime | Persistence |
|---|---|---|---|
| Project document (`BlueData`) | Electron main document bridge | Project session | Canonical `.blue` file through existing bridge |
| Engine/audio runtime | Blue Engine | Engine session | None |
| Playback and Blue Live activity | Electron main | Application session | None |
| Track editor window identity | Electron main window manager | Window binding | None |
| Track editor UI/session state | Bound renderer | Window binding | None; reset on rebind/close |
| Instrument library view/cache | Bound renderer store | Window binding | None; derived from main APIs |
| Diagnostic run and attempts | Electron main diagnostic coordinator | Opt-in diagnostic run | Optional JSONL derived artifact |
| Native scheduling-gap observations | Compile-gated Blue Engine diagnostics | Engine performance | Bounded memory, emitted at stop |
| Audio observation/capture | Test operator or capture harness | Validation trial | Disposable evidence artifact |

## QualifyingPlaybackWorkload

Describes the repeatable workload used before any editor-open condition is accepted.

| Field | Type | Rules |
|---|---|---|
| `fixtureId` | string | Stable human-readable project/workload identity |
| `sampleRate` | positive number | Captured from active engine state |
| `ksmps` | positive integer | Captured from active engine state |
| `controlDurationSeconds` | number | At least 60 seconds with no editor open |
| `baselineInterruptionCount` | non-negative integer | Must be zero for an accepted run |
| `headroomEvidence` | object | Records CPU/device/load observation used to show the workload is not already overloaded |
| `outputMode` | enum | `audible`, `loopback`, or `both` |

## DiagnosticEnvironment

Captures factors needed to compare runs without embedding project content.

| Field | Type | Description |
|---|---|---|
| `platform` | string | OS and architecture |
| `appBuild` | string | Commit/build identifier and dev or packaged mode |
| `engineBuild` | string | Engine build identifier and whether performance tracking is enabled |
| `device` | string | Selected audio device label or anonymized stable identifier |
| `sampleRate` | number | Active engine sample rate |
| `ksmps` | integer | Active control block size |
| `diagnosticsEnabled` | boolean | Must be true for trace emission |

## DiagnosticRun

Groups one controlled condition and its attempts.

| Field | Type | Description |
|---|---|---|
| `schemaVersion` | literal `1` | Trace schema version |
| `runId` | UUID/string | Unique run identity |
| `candidateId` | string | Baseline or implementation candidate name |
| `condition` | enum | `no-open`, `focus-existing`, `minimal-shell`, `shell-with-snapshot`, `editor-mount`, `library-init`, `bluex7-readback`, or `effect-interface` |
| `environment` | `DiagnosticEnvironment` | Fixed run environment |
| `workload` | `QualifyingPlaybackWorkload` | Qualified workload |
| `attempts` | `EditorOpenAttempt[]` | At least 10 for comparative conditions |
| `nativePerformance` | optional object | Budget threshold, aggregate gap count, and bounded largest-gap observations |
| `disposition` | enum | `incomplete`, `rejected`, or `accepted` |
| `notes` | string[] | Operator annotations; never authoritative state |

## EditorTargetIdentity

Identity is stable within a project session and is validated before expensive work.

### Track target

- `kind`: `track-instrument`
- `projectSessionId`: string
- `layerGroupId`: string
- `trackId`: string
- `instrumentKind`: `generic`, `blue-synth-builder`, or `blue-x7`

### Effect target

- `kind`: `effect-interface` or `effect-editor`
- `projectSessionId`: string
- `effectOwnerId`: string
- `effectId`: string

## EditorOpenAttempt

| Field | Type | Description |
|---|---|---|
| `attemptId` | UUID/string | Unique within the run |
| `target` | `EditorTargetIdentity` | Validated target |
| `classification` | enum | `cold`, `reused`, or `reopened` |
| `appMode` | enum | `development` or `packaged` |
| `startedMonotonicNs` | integer/string | Main-process monotonic start |
| `milestones` | `EditorMilestone[]` | Ordered bounded lifecycle observations |
| `frameObservations` | `EngineFrameBracket[]` | Selected milestone-to-engine correlations |
| `audioObservation` | `AudioObservation` | User-visible outcome/evidence |
| `outcome` | enum | `usable`, `failed`, `cancelled`, or `closed-before-usable` |
| `errorCode` | optional string | Stable, non-sensitive failure category |

### EditorMilestone

Each milestone contains `name`, `monotonicNs`, and optional duration/count metadata.
Allowed names are:

- `request-received`
- `existing-focused`
- `target-validated`
- `snapshot-start`, `snapshot-end`
- `window-constructed`
- `navigation-started`
- `renderer-mounted`
- `document-accepted`
- `editor-import-start`, `editor-import-end`
- `editor-usable`
- `library-init-start`, `library-init-end`
- `live-observation-start`, `live-observation-first-result`
- `ready-to-show`, `shown`
- `failed`, `cancelled`, `closed`

Milestones are append-only, bounded to one occurrence per name except explicitly
repeatable observations, and ignored after a terminal outcome.

### EngineFrameBracket

Correlates an app milestone with engine progress without claiming exact audio-thread
synchronization.

| Field | Type | Description |
|---|---|---|
| `milestone` | milestone name | Event being bracketed |
| `requestBeforeMonotonicNs` | integer/string | Time immediately before existing engine-state request |
| `sampleFrame` | non-negative integer/string | Frame returned by the engine |
| `sampleRate` | positive number | Returned/known rate |
| `ksmps` | positive integer | Returned/known block size |
| `responseAfterMonotonicNs` | integer/string | Time immediately after response |

The frame's time interval is bounded by the two monotonic timestamps; consumers must
not treat it as an exact timestamp.

### AudioObservation

| Field | Type | Description |
|---|---|---|
| `method` | enum | `audible`, `loopback`, `both`, or `unavailable` |
| `interruptionCount` | non-negative integer | Observed interruptions during attempt window |
| `evidenceRef` | optional string | Relative or operator-managed reference to derived capture |
| `notes` | optional string | Brief observation, not project data |

## CandidateResult

Summarizes whether a candidate may ship.

| Field | Type | Acceptance rule |
|---|---|---|
| `packagedAttemptsByEditorKind` | map | At least 10 for each of the three Track editor kinds |
| `totalInterruptionCount` | integer | Exactly zero |
| `usableWithinTwoSecondsPercent` | number | At least 95% |
| `firstUsableLatencyDeltaPercent` | number | No more than +10% |
| `firstEditLatencyDeltaPercent` | number | No more than +10% |
| `applicationReadyDeltaPercent` | number | No more than +10% |
| `projectOpenDeltaPercent` | number | No more than +10% |
| `idleCpuDeltaPercent` | number | No more than +10% |
| `retainedMemoryDeltaPercent` | number | No more than +10% |
| `blueX7ObservationDurationSeconds` | number | At least 60 |
| `blueX7ObservationCadenceHz` | number | 20 |
| `accepted` | boolean | True only when every gate passes |

## EditorSession State Machine

Normal cold/reused lifecycle:

```text
absent -> preparing -> loading -> usable -> closing -> disposed
              |           |          |
              +-------- failure/cancellation --------> disposed
```

- `preparing` validates identity and creates the window; it does not build the full
  document snapshot.
- `loading` covers navigation, renderer mount, one snapshot pull, document acceptance,
  and requested-editor import.
- `usable` begins when the requested editor can be interacted with. Optional library
  and live-observation work may continue after this transition.
- A focus-existing request leaves the existing session in `usable` and records
  `existing-focused`; it creates no window, navigation, or snapshot.

Conditional pooled lifecycle, only if evidence requires it:

```text
available -> binding -> loading -> usable -> closing -> disposed
    ^          |           |
    |          +-- failure +--------------------------> disposed
    +-- eligible reset after close, only while runtime inactive
```

A pooled binding increments `bindingGeneration`. Every queued or asynchronous result
must match both target identity and generation. Rebinding atomically updates manager
maps and clears renderer state. A failed bind/load is destroyed, never returned to
the pool. The manager holds at most one `available` shell.

## RuntimeActivityStatus

| Field | Type | Rules |
|---|---|---|
| `sequence` | non-negative integer | Monotonically increasing per app session |
| `playbackRunning` | boolean | Canonical main-process playback state |
| `blueLiveRunning` | boolean | Canonical main-process Blue Live state |

The renderer first queries a snapshot, then subscribes. It accepts only messages with
a newer sequence for the current window binding. Failure or teardown resolves to both
flags false. BlueX7 observation begins only after `editor-usable` and either flag is
true; it stops and clears runtime-only values when both become false.

## Validation and Staleness Rules

- A target is rejected if its project session, layer group, track, or instrument no
  longer exists at validation or snapshot time.
- A closed/cancelled attempt cannot later become usable through a delayed callback.
- Renderer messages must match the current target identity; pooled implementations
  additionally require the current binding generation.
- At most one active Track editor exists for a stable project/group/track identity.
- Diagnostic enablement never changes editor lifecycle behavior other than bounded
  observation and artifact output.
- Diagnostic artifacts contain no canonical project content and are safe to delete.
