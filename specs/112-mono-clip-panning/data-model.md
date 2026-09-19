# Data Model: Mono Clip Panning Compatibility

## Mixer Panning Configuration

- **Owner**: Active `BlueData.Mixer`.
- **Field**: `panningEnabled: boolean`; new instance true, absent/invalid mixer XML false. A legacy score-level value is migrated when no mixer-level value is present; missing values in both locations resolve false.
- **Persistence**: `<mixer panningEnabled="true|false">` in `.blue` XML. The loader accepts legacy `<score panningEnabled="true|false">` only as a migration input and saves the canonical mixer form.
- **Transitions**: User toggle commits an `Enable Panning` or `Disable Panning` mixer edit; undo/redo restores prior value and recompiles or reconciles active audio. Merely loading a legacy project does not make it dirty.
- **Relationship**: Gates clip upmix and channel Pan/Balance. Does not alter sends.

## Audio Clip Channel Layout

- **Owner**: Actual audio file; the clip's `numChannels` is cached descriptive metadata.
- **Derived fields**: Native file path, actual channel count `1|2|unsupported`, observation status. The compile-time manifest is disposable and not persisted.
- **Validation**: Under enabled panning, unreadable or >2-channel inputs produce a diagnostic. Stale/missing clip metadata does not change the decision.
- **Relationship**: Every clip contributes to its track's effective layout. Runtime `filenchnls` guards execution against a changed file.

## Track / Channel Effective Layout

- **Owner**: Derived compile state, never XML.
- **Values**: `mono` only for a channel with verified mono clip sources, no unclassified instrument source, and no effect that may produce differing left/right buses before the pan stage; `stereo-or-unknown` for any stereo clip, mixed clip set, unknown instrument/effect, subchannel, or Master.
- **Transition**: Recompute on file/layout, track routing, or score-setting changes; invalidate and recompile the running graph at a safe point.
- **Relationship**: Selects Mono Pan or Stereo Balance presentation and Csound gain law.

## Mixer Channel Position

- **Owner**: `Mixer.Channel` in the active project.
- **Fields**: `pan: number` in `[0,1]`, default `0.5`; distinct Pan `Parameter` with fixed value or automation points in the same range.
- **Persistence**: Channel XML pan value and pan Parameter; older channel XML defaults to center. Deep copy preserves values; history copy preserves stable runtime identity.
- **Validation**: Reject nonfinite/out-of-range user and automation values; invalid XML falls back to center. Compile uses a validated value.
- **Transitions**: Edit commits `Set Channel Pan`; automation edits follow existing parameter history; undo/redo restores canonical value and audible behavior.
- **Relationship**: Label is `Pan` for verified mono-only channels, `Balance` otherwise; control is inactive when mixer panning is disabled.

## Render Layout Diagnostic

- **Owner**: Electron main render request result; transient.
- **Fields**: Stable diagnostic code, affected native path or output profile, observed channel count when known, user-facing explanation.
- **Validation**: Unsupported output/input and unreadable source prevent enabled render launch. They never mutate `BlueData`.
