# Project and Runtime Contract

## XML compatibility

- New `Mixer`: `panningEnabled=true`; save explicit boolean on the mixer element.
- Loaded mixer with absent or invalid `panningEnabled`, including a Java project: false. A legacy score-level value migrates when no mixer value is present; missing values in both locations resolve false. Save/reopen retains the resolved value and legacy routing when disabled.
- New `Channel`: `pan=0.5`; save a bounded pan scalar and a separately identifiable Pan `Parameter`. Loaded older channel without these fields: center and fixed, nonautomated Pan Parameter. Existing Volume Parameter retains its identity/behavior. Unknown unrelated project XML remains preserved by the normal document codec.

## Typed editor operations

- Mixer snapshot exposes `panningEnabled`; the typed mixer patch toggles it and validates a boolean.
- Mixer channel snapshot retains `pan`; mixer patch validates finite `[0,1]` and updates the Pan Parameter fixed value when automation is off. Automation-point validation uses the same range.
- Every durable user edit goes through `ProjectHistory`: `Enable Panning`/`Disable Panning`, `Set Channel Pan`, or the existing semantic automation label. Commit, undo, redo, dirty state, published snapshots, and stable channel/parameter identities must be tested.
- Mixer setting change is structural for runtime reconciliation. Pan/automation values can use registered runtime parameters only while the compiled graph matches canonical project state. Failed reconciliation reports a recoverable error and retains canonical data.

## UI

- Mixer Settings shows `Enable Panning` and its current value.
- Mixer control uses accessible `Pan` or `Balance` label from effective layout, range `0..1`, and a visible center. It is inactive when mixer panning is disabled. Unknown layout presents Balance.
- Unsupported-layout diagnostics include a stable code and relevant file or output channel count; project metadata is unchanged.
