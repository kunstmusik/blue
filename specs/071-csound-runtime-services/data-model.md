# Data Model: Csound Runtime Services

**Feature**: `071-csound-runtime-services`
**Date**: 2026-08-13

This feature adds no project-owned data. All runtime reports and operations are transient. The only new durable value is an optional application-wide Csound library override in `program-settings.json`; existing realtime module/device fields continue to own saved selections.

## 1. Runtime Feature

An additive capability advertised by Blue Engine.

| Field | Type | Rules |
|---|---|---|
| `name` | string | One of `csound-io-v1`, `csound-utility-v1`, or `csound-performance-v1` for this feature; unknown feature names remain preserved |
| `protocolVersion` | integer | Existing protocol remains `1`; feature presence, not a version bump, gates one-shot calls |

**Owner/Lifetime**: Built into Blue Engine; decoded transiently by Electron main and shared contract code.

**Relationships**: Every I/O query and execution request requires its matching feature before dispatch.

## 2. Csound I/O Query Request

A validated request to enumerate modules and optionally query devices for one audio module and one MIDI module.

| Field | Type | Rules |
|---|---|---|
| `enginePathOverride` | string \| null | Optional; if non-empty, absolute path only; existing engine selection rules apply |
| `csoundLibraryPath` | string \| null | Optional; if non-empty, absolute path only; defaults to saved/automatic selection |
| `audioModule` | string \| null | Optional exact runtime name; trimmed, non-empty when present, no NUL, bounded to 128 bytes |
| `midiModule` | string \| null | Optional exact runtime name; trimmed, non-empty when present, no NUL, bounded to 128 bytes |

**Owner/Lifetime**: Created by the settings renderer, validated at the shared and main boundaries, consumed by one child process, then discarded.

**Rules**:

- Omitting both selected modules enumerates modules but does not query device lists.
- Supplying a module queries only that module's input and output directions.
- Renderer input cannot request arbitrary native flags.

## 3. Runtime Module

One Csound backend returned by module enumeration.

| Field | Type | Rules |
|---|---|---|
| `name` | string | Exact Csound module identifier; non-empty |
| `kind` | `audio` \| `midi` | Derived from Csound's module type |

**Owner/Lifetime**: Transient Blue Engine report, mirrored in renderer component state only.

**Identity**: Composite `(kind, name)`.

**Relationship**: A `RuntimeDevice` references exactly one module with the same kind.

## 4. Runtime Device

One input or output endpoint reported for a selected runtime module.

| Field | Type | Rules |
|---|---|---|
| `kind` | `audio` \| `midi` | Determines optional fields and settings destination |
| `direction` | `input` \| `output` | Must agree with both the query direction and native structure flag |
| `module` | string | Exact requested/reported module name |
| `deviceId` | string | Exact Csound identifier saved to settings; non-empty for selectable devices |
| `displayName` | string | Human-readable Csound device name; fallback to `deviceId` if empty |
| `interfaceName` | string \| null | MIDI interface name when reported; otherwise null |
| `maxChannels` | integer \| null | Non-negative audio channel capacity when reported; null for MIDI |

**Owner/Lifetime**: Transient report and renderer state. Selecting it copies only the exact identifier into existing program settings.

**Identity**: Composite `(kind, direction, module, deviceId)`.

**Validation**:

- Fixed native character arrays must be safely NUL-terminated before conversion.
- A returned module mismatch is retained in diagnostics and not silently rewritten.
- Duplicate identities are collapsed deterministically, retaining the first reported display metadata.

## 5. Csound I/O Report

The machine-readable native result before Electron wraps it with selection and timing metadata.

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | integer | Exactly `1` |
| `engine` | engine capability report | Must be protocol-compatible and contain `csound-io-v1` |
| `csound` | Csound compatibility report | Reuses probe status/path/version fields |
| `audioModules` | `RuntimeModule[]` | Audio entries only, stable native order |
| `midiModules` | `RuntimeModule[]` | MIDI entries only, stable native order |
| `selectedAudioModule` | string \| null | Echo of validated selection |
| `selectedMidiModule` | string \| null | Echo of validated selection |
| `audioInputs` | `RuntimeDevice[]` | Audio/input only |
| `audioOutputs` | `RuntimeDevice[]` | Audio/output only |
| `midiInputs` | `RuntimeDevice[]` | MIDI/input only |
| `midiOutputs` | `RuntimeDevice[]` | MIDI/output only |
| `diagnostics` | `RuntimeDiagnostic[]` | Warnings or scoped failures that do not corrupt JSON |

**Owner/Lifetime**: Created by one-shot Blue Engine and strictly decoded by Electron main/shared code. Never persisted.

**Empty/Error Semantics**:

- Count `0` produces an empty array with no error diagnostic.
- Negative count produces a scoped diagnostic and an unsuccessful query result.
- A Csound load/capability failure produces no fabricated module/device entries.

## 6. Runtime Diagnostic

| Field | Type | Rules |
|---|---|---|
| `scope` | `runtime` \| `audio` \| `midi` | Identifies affected subsystem |
| `code` | string | Stable machine-readable value such as `CSOUND_UNAVAILABLE`, `MODULE_UNAVAILABLE`, or `DEVICE_QUERY_FAILED` |
| `message` | string | NUL-free, bounded, user-actionable text |

**Owner/Lifetime**: Transient; displayed or logged by the caller.

## 7. Csound Execution Request

A discriminated main-owned request. It is not a renderer IPC contract.

### Common Fields

| Field | Type | Rules |
|---|---|---|
| `operationId` | string | Non-empty unique identity supplied by the owning workflow |
| `kind` | `utility` \| `performance` | Selects the native one-shot mode and required feature |
| `args` | string[] | Ordered, NUL-free, individually passed with no shell interpretation |
| `cwd` | string | Absolute existing working directory resolved by Electron main |
| `csoundLibraryPath` | string \| null | Optional absolute override; otherwise runtime auto-detection |

### Utility Variant

| Field | Type | Rules |
|---|---|---|
| `utilityName` | string | Exact available utility name; non-empty, no path separators, no NUL |
| `kind` | literal `utility` | Requires `csound-utility-v1` |

### Performance Variant

| Field | Type | Rules |
|---|---|---|
| `kind` | literal `performance` | Requires `csound-performance-v1` |

**Owner/Lifetime**: Created and owned by Electron main. The spawned child receives only native CLI arguments and environment. Request is discarded after terminal state.

## 8. Csound Execution Result

| Field | Type | Rules |
|---|---|---|
| `operationId` | string | Must equal request identity |
| `state` | `completed` \| `failed` \| `cancelled` | Exactly one terminal state |
| `exitCode` | integer \| null | `0` for completed; nonzero/null for failure or signal termination |
| `signal` | string \| null | Terminating signal when applicable |
| `stdout` | string | Bounded retained output; execution modes normally emit Csound messages on stderr |
| `stderr` | string | Bounded retained diagnostic/progress output |
| `errorCode` | string \| null | Stable engine/runtime/capability/process failure |
| `message` | string | User-facing terminal summary |

**Owner/Lifetime**: Electron main until the owning workflow maps it to its existing operation result. Not persisted.

### State Transitions

```text
created -> resolving-engine -> checking-capability -> spawning -> running
running -> completed
running -> failed
running -> cancelling -> cancelled
resolving-engine/checking-capability/spawning -> failed
```

Rules:

- Once cancellation is accepted for the matching operation ID, a later process exit cannot transition to `completed`.
- A completed performance is not sufficient for workflow success; disk/freeze callers still validate the expected artifact.
- Cancellation affects only the child bound to the matching execution handle.

## 9. Saved Runtime Selection

Durable program settings used by discovery and realtime options.

| Field | Existing/New | Rules |
|---|---|---|
| `realtimeRender.audioDriver` | existing | Exact selected audio module or preserved custom value |
| `realtimeRender.audioOutText` | existing | Exact output device identifier or custom value |
| `realtimeRender.audioInText` | existing | Exact input device identifier or custom value |
| `realtimeRender.midiDriver` | existing | Exact selected MIDI module or preserved custom value |
| `realtimeRender.midiOutText` | existing | Exact MIDI output identifier or custom value |
| `realtimeRender.midiInText` | existing | Exact MIDI input identifier or custom value |
| `appSpecific.enginePath` | existing | Bundled sentinel or absolute external-engine override |
| `appSpecific.csoundLibraryPath` | new | Empty for automatic discovery or absolute Csound shared-library override |

**Owner/Lifetime**: Main-owned `program-settings.json`, application-wide. No field enters `.blue` XML.

### Migration: Version 2 to Version 3

1. Merge version-2 data with version-3 defaults.
2. Set missing `appSpecific.csoundLibraryPath` to `""`.
3. Preserve every existing realtime device/module value exactly.
4. Preserve legacy `utility.csoundExecutable`, `realtimeRender.csoundExecutable`, `diskRender.csoundExecutable`, and `renderMethod` values for downgrade safety.
5. Stop using those legacy values for runtime selection after all covered callers migrate.
6. Save atomically through the existing settings store.

## 10. Renderer Discovery State

Transient state owned by `RealtimeRenderSettings`:

| Field | Type | Purpose |
|---|---|---|
| `phase` | `idle` \| `loading-modules` \| `loading-devices` \| `ready` \| `failed` | UI feedback |
| `report` | Csound I/O query result \| null | Latest validated result |
| `requestedAudioModule` | string \| null | Suppresses stale async results after selection changes |
| `requestedMidiModule` | string \| null | Suppresses stale async results after selection changes |

This state is discarded when the settings window closes. Apply/Cancel continues to govern durable settings edits.
