# Project and Runtime Contract

## XML compatibility

- New `Score`: `panningEnabled=true`; save explicit boolean on the score element.
- Loaded score with absent or invalid `panningEnabled`, including a Java project: false. Missing score element: false. Save/reopen retains false and legacy routing.
- New `Channel`: `pan=0.5`; save a bounded pan scalar and a separately identifiable Pan `Parameter`. Loaded older channel without these fields: center and fixed, nonautomated Pan Parameter. Existing Volume Parameter retains its identity/behavior. Unknown unrelated project XML remains preserved by the normal document codec.

## Typed editor operations

- Score snapshot exposes `panningEnabled`; the typed score patch toggles it and validates a boolean.
- Mixer channel snapshot retains `pan`; mixer patch validates finite `[0,1]` and updates the Pan Parameter fixed value when automation is off. Automation-point validation uses the same range.
- Every durable user edit goes through `ProjectHistory`: `Set Score Panning`, `Set Channel Pan`, or the existing semantic automation label. Commit, undo, redo, dirty state, published snapshots, and stable channel/parameter identities must be tested.
- Score setting change is structural for runtime reconciliation. Pan/automation values can use registered runtime parameters only while the compiled graph matches canonical project state. Failed reconciliation reports a recoverable error and retains canonical data.

## UI

- Score Settings shows `Enable Panning` and its current value.
- Mixer control uses accessible `Pan` or `Balance` label from effective layout, range `0..1`, and a visible center. It is inactive when score panning is disabled. Unknown layout presents Balance.
- Unsupported-layout diagnostics include a stable code and relevant file or output channel count; project metadata is unchanged.

