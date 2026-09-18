# Data Model: Complete Stereo Mixer Panning

**Canonical store**: active `BlueData` in the project document; persisted in `.blue` XML. [Spec](spec.md) · [research](research.md)

## Score panning configuration

| Field | Type / allowed values | Default | Persistence | Validation |
| --- | --- | --- | --- | --- |
| `panningEnabled` | Boolean | New score true; absent/invalid loaded score false | Existing `<score>` attribute | Existing Spec 112 rule |
| `panLawDb` | One of `0, -3, -4.5, -6` | `-3` | New `<score>` attribute | Reject unsupported edits; missing/invalid XML resolves to `-3` |
| `panOffCenterBoost` | Boolean | `false` | New `<score>` attribute | Reject nonboolean edits; missing/invalid XML resolves to false |

The score setting applies uniformly to Mono Pan and both source legs of each true-stereo mode. Balance ignores it. Toggling `panningEnabled` does not delete the law/boost choices. A missing score element follows the existing legacy-disabled path with law/boost defaults. No machine preference or shadow presence flag exists.

## Mixer channel panner

| Field | Type / range | Default | Meaning |
| --- | --- | --- | --- |
| Existing `pan` | Finite `[0,1]` | `0.5` | Mono Pan position; Balance amount; Stereo Pan shared Position |
| New `stereoPanMode` | `balance\|stereoPan\|dualPan` | `balance` | Stored choice for any two-bus channel |
| New `panWidth` | Finite `[0,1]` | `1` | Saved Stereo Pan width; effective width narrows near Position endpoints |
| New `dualPanLeft` | Finite `[0,1]` | `0` | Position of the left source leg |
| New `dualPanRight` | Finite `[0,1]` | `1` | Position of the right source leg |

Each scalar is owned by `Channel` and persisted in its `<channel>` element. `pan`, `panWidth`, `dualPanLeft`, and `dualPanRight` have independent `Parameter` objects with stable names/IDs, fixed values, and optional automation; mode is a nonautomatable channel setting. New channels initialize all values. Loaded Java/Spec 112 channels without new elements resolve to the defaults and remain Balance. Invalid saved values resolve individually to defaults; typed patches and automation-point edits reject invalid/nonfinite values.

The stored mode is distinct from Spec 112's **derived effective layout** (`pan` for verified mono-only, `balance` otherwise). Verified mono-only material uses Mono Pan even if a stereo mode is stored; its stereo fields remain intact for later source-layout changes. Unknown layout stays two-bus and uses the stored stereo mode. Channel deep copy and history copy include all fields and preserve stable parameter identities according to the existing copy mode.

## Relationships and effective state

```text
Score.panningEnabled ── disabled ──> legacy route, all panner choices dormant
                     └─ enabled, stereo output
                        ├─ verified mono-only ──> Mono Pan(Channel.pan, Score law/boost)
                        └─ stereo/mixed/unknown
                           ├─ Balance(Channel.pan), ignores score law
                           ├─ Stereo Pan(Channel.pan, panWidth, Score law/boost)
                           └─ Dual Pan(dualPanLeft, dualPanRight, Score law/boost)
```

Mono output has no stereo gain stage. Wider-than-stereo output or source files retain the Spec 112 diagnostic. Existing clip upmix, effects/sends, mute/solo gate, meter, and parent routing remain in their current order.

## State transitions and history

- **Edit score law/boost**: validate → one typed score patch with semantic label → canonical commit → dirty/snapshot publication → reconcile active performances. Undo/redo repeats publication/reconciliation. No audio update writes back to the score.
- **Edit channel mode**: validate enum → one channel patch → commit/history → update effective UI and runtime mode. Stored positions are not rewritten. If verified mono-only, the mode remains saved but dormant.
- **Edit channel scalar**: validate range → preview through disposable runtime state if dragging → commit one channel patch on completion, or restore canonical value on cancellation. When not automated, the associated Parameter fixed value follows the canonical scalar. Existing automation retains its own curve.
- **Change effective source layout**: recompute the derived Mono Pan/two-bus classification at compile/snapshot boundaries. Do not mutate saved mode or parameter values merely because classification changed.
- **Runtime failure**: saved project state and history remain canonical; publish an applied/failed distinction, restore by canonical reconciliation, and never claim a failed update is audible.

## XML and migration behavior

Use Score attributes for the two new project settings and Channel child values plus distinct Parameter elements for three new automatable controls. Loading old files needs no destructive migration. Java Blue's known channel and score data remains readable in Blue TypeScript; Java is not required to retain these new TypeScript-only values on its own save. Unknown unrelated project XML follows existing preservation policy. The Channel loader must match known Parameter names explicitly rather than assigning an unrecognized Parameter to Volume.
