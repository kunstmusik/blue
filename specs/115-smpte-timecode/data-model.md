# Data Model: Standards-Based SMPTE Timecode

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Project format

Canonical owner: `BlueData.getScore().getTimeState()`.

| Field | Representation | Default | Validation/persistence |
| --- | --- | --- | --- |
| smpteFrameRate | Existing numeric display alias | 24 | One of 23.976, 24, 25, 29.97, 30, 50, 59.94, 60; retain existing numeric XML child. |
| smpteDropFrame | Boolean | false | True only at 29.97/59.94; optional XML child emitted only when true. |

The new Boolean has no separate raw-value/presence state. `TimeState` copy construction and `BlueData.historyCopy()` include it. Retain unknown XML children and attributes as opaque clones, excluding modeled names/version, so model values remain authoritative. History/duplication copy that unknown data without aliasing mutable XML nodes.

TimeContext retains its existing numeric carrier/default 30 unchanged. It is not the presentation owner. Effective project snapshots must not read it for display rate/mode.

## Derived format/rate descriptors

A serializable format consists of `{ smpteFrameRate: number, smpteDropFrame: boolean }`. The portable converter accepts a corresponding `{ frameRate: number, dropFrame: boolean }` value. A static rate resolver derives numerator, denominator, and nominal frame-label count; these derived properties are not separately persisted.

| Alias | Physical ratio | Nominal labels | Modes |
| --- | --- | --- | --- |
| 23.976 | 24000/1001 | 24 | NDF |
| 24 | 24/1 | 24 | NDF |
| 25 | 25/1 | 25 | NDF |
| 29.97 | 30000/1001 | 30 | NDF, DF |
| 30 | 30/1 | 30 | NDF |
| 50 | 50/1 | 50 | NDF |
| 59.94 | 60000/1001 | 60 | NDF, DF |
| 60 | 60/1 | 60 | NDF |

High-rate labels count individual software frames; no wire format is added. Existing SmpteFrameRate enum exports remain available, but their strings do not replace persisted numeric aliases.

## Snapshots and preferences

Add mode to `ScoreTimeStateSnapshot`, `TimeConversionContext`, and `ToolbarProjectTransportSnapshot`. Builders and empty snapshots read the TimeState format or its 24/NDF default. Update playback-store transport copying, toolbar adapters, marker context construction, and editor/ruler props so no construction site loses the mode.

Existing `ProjectDefaultsSettingsSnapshot` gains `defaultSmpteDropFrame=false`. Old preference snapshots merge to false. UI rate changes normalize to a supported pair; persisted preference corruption recovers to a valid pair, while invalid submitted preferences are rejected. New-project application seeds TimeState only. Library databases, generated CSD, playback telemetry, and TimeContext XML do not gain a mode field.

## Load/recovery behavior

- Missing mode: NDF, regardless of 29.97 numeric rate or old drop label.
- Exact historical rate tokens `29.97df` and `30df`: retain recovered numeric 29.97 or 30; absent new mode remains NDF. Do not infer 29.97 from 30df.
- Malformed/unsupported TimeState rate: recover to 24, not an arbitrary positive parsed prefix.
- Invalid Boolean or mode incompatible with recovered rate: recover to NDF, preserving unrelated XML.
- New false mode is omitted on save; true is written in TimeState. Java need not understand/preserve this extension.
- No eager retiming, quantization, or dirty marking merely because an old project is opened.

## State transitions

1. Dialog edits are disposable local values; cancel discards them.
2. Apply produces one supported rate/mode pair and one typed patch.
3. Main validates the complete pair before mutating any TimeState field.
4. ProjectHistory commits with `Change SMPTE Format`; canonical publication updates score, conversion contexts, and transport together.
5. Undo/redo restores format, dirty state, and canonical snapshots without replacing stable score identities or moving content. No-op adds no history.
6. Switching to an NDF-only rate includes `smpteDropFrame:false` in the same change. Program preferences use their existing settings route independently.

SMPTE position/duration edits still convert to existing canonical beat/seconds values and use existing semantic history routes. Rate/mode is presentation state; it never becomes a playback-speed command.
