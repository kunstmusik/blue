# Research: JMask Score Object Editor Parity

## Decision: Treat Spec 041 as both a model-port and editor-parity slice

**Rationale**: The current TypeScript `JMask` only preserves `seedUsed` and `seed`; `generateForCSD()` is a stub and the nested `Field` or `Parameter` subsystem has not been ported yet. Honest editor parity requires the model layer before the renderer can represent or mutate the Java structure safely.

**Sources Reviewed**:

- Current TypeScript `packages/blue-data/src/sound-objects/j-mask.ts`
- Current TypeScript `packages/blue-app/src/shared/project-editor.ts`
- Java Blue `blue-core/src/main/java/blue/soundObject/jmask/Field.java`
- Java Blue `blue-core/src/main/java/blue/soundObject/jmask/Parameter.java`
- Java Blue generator, modifier, table, and probability model classes under `blue-core/src/main/java/blue/soundObject/jmask/`

## Decision: Mirror Java Blue's top bar plus scrollable parameter-editor stack instead of extending the current seed form

**Rationale**: Java Blue `JMaskEditor` is fundamentally a two-part surface: a top bar with title, visibility popup, seed controls, and test entry point, plus a scrollable `EditorListPanel` of full-width `ParameterEditor` rows. The current TypeScript seed controls do not meaningfully represent that UX.

**Sources Reviewed**:

- Java Blue `blue-ui-core/src/main/java/blue/soundObject/editor/JMaskEditor.java`
- Java Blue `EditorListPanel.java`
- Java Blue `JMaskEditorLayout.java`
- Java Blue `ParameterEditor.java`
- Current TypeScript `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/JMaskEditor.tsx`

## Decision: Preserve Java row interactions explicitly, including menu actions and protected-row behavior

**Rationale**: Java Blue relies on parameter-row interactions that are easy to miss in a shallow task list: right-click row menus for add before or after, remove, change type, push up or down, and section toggles; double-click label rename; top-bar visibility toggles; protected removal rules for the first three parameters; and `Ctrl/Cmd+T` test preview.

**Sources Reviewed**:

- Java Blue `JMaskEditor.java`
- Java Blue `ParameterEditor.java`
- Java Blue `EditorListPanel.java`

## Decision: Break generator work down by the real Java registry order and nested probability families

**Rationale**: The grouped Tier 2 draft was too shallow because it hid the Java generator hierarchy behind one implementation task. The split spec needs explicit tasks for the six generator families from `GeneratorRegistry` plus the probability subtype handling in `ProbabilityEditor` and `ProbabilityEditorFactory`.

**Sources Reviewed**:

- Java Blue `GeneratorRegistry.java`
- Java Blue `ParameterEditor.java`
- Java Blue `GeneratorEditorFactory.java`
- Java Blue `ProbabilityEditor.java`
- Java Blue `ProbabilityEditorFactory.java`
- Java probability model classes under `blue-core/src/main/java/blue/soundObject/jmask/probability/`

## Decision: Treat mask, quantizer, accumulator, and table-driven editing as first-class parity surfaces

**Rationale**: Java Blue does not treat optional sections as incidental extras. `MaskEditor`, `QuantizerEditor`, and `AccumulatorEditor` are stacked inline under the generator editor, and `TableCanvas` has concrete interaction rules for hover selection, insert, drag, alt-insert-on-line, and right-click removal of non-endpoints. These behaviors need either direct parity work or explicit deferral.

**Sources Reviewed**:

- Java Blue `MaskEditor.java`
- Java Blue `QuantizerEditor.java`
- Java Blue `AccumulatorEditor.java`
- Java Blue `TableCanvas.java`
- Java Blue `OscillatorEditor.java`
- Java Blue `SegmentEditor.java`
- Java Blue probability distribution editors and related classes

## Decision: Propagate duration into all duration-sensitive sub-editors

**Rationale**: `EditorListPanel` listens for `JMask` duration changes and pushes the current subjective duration into every open `ParameterEditor`, which then forwards it to the generator and enabled modifier editors through `DurationSettable`. This is part of the Java behavior for tables and probability sub-editors and cannot be omitted silently.

**Sources Reviewed**:

- Java Blue `EditorListPanel.java`
- Java Blue `ParameterEditor.java`
- Java Blue generator, probability, and modifier editors implementing `DurationSettable`

## Decision: Preserve unsupported nested data explicitly and keep preview claims honest

**Rationale**: `JMask` is structurally rich. If the TypeScript surface cannot edit a nested generator, probability form, or table interaction yet, the editor must still preserve the data and tell the user what is deferred. The preview or test flow should only be claimed once the `@blue/data` field subsystem can actually generate notes; otherwise the top bar should surface a deliberate deferred state.

**Sources Reviewed**:

- `packages/blue-app/src/shared/project-editor.ts`
- `packages/blue-data/src/sound-objects/j-mask.ts`
- Existing unsupported-editor messaging patterns from Spec 037
- Java XML-backed `JMask` model behavior in blue-core

## Closeout Confirmation

The implementation completed the planned model-port path rather than deferring preview. The shipped subset includes the six Java registry generator families (`Constant`, `Item List`, `Segment`, `Random`, `Probability`, `Oscillator`), probability subtypes (`Uniform`, `Linear`, `Triangle`, `Exponential`, `Gaussian`, `Cauchy`, `Beta`, `Weibull`), mask/quantizer/accumulator sections where Java exposes them, table editing for generator and modifier tables, and a read-only generated-score preview.

The final renderer contract snapshots the canonical `Field` tree instead of maintaining separate normalized `visibilityMenu` and `parameters` arrays. That keeps unsupported nested data reload-safe because the same snapshot path is used for XML save/load, optimistic renderer updates, and canonical project patches.

## JMask note generation corrections

Java Blue's `Field.generateNotes()` at revision `3ca3f40579c48a023299a68130d8ab6b9e950974`
rounds instrument IDs to integers and checks only the unformatted accumulated start
against the object duration. TypeScript Mode 2 preserves fractional instrument IDs
while retaining the minimum ID of 1. It compensates for accumulated step error and
checks the formatted start against the exclusive end of the generation window
before note processing and time behavior. For a two-beat JMask with a constant step
of 0.2 beats, this produces ten starts from 0 through 1.8 beats before the score offset
is applied. Focused tests in `j-mask.test.ts` cover both changes.

- [Fractional instrument IDs, issue #779](https://github.com/kunstmusik/blue/issues/779)
- [Extra event at the end of JMask, issue #525](https://github.com/kunstmusik/blue/issues/525)

### Compatibility assessment

Both corrections can change playback for the same saved object and seed. A continuous
instrument generator that produced 1.9 previously selected instrument 2. Preserving
1.9 selects an instance of instrument 1 and can also change tied-note matching.
Dropping an end-boundary event changes the note list passed to processors. With Scale
or a repeat interval derived from the note list, it can also change the timing of
earlier events when the dropped event previously determined the generated duration.
See the [Csound score event reference](https://csound.com/docs/manual/i.html).

Each JMask owns its generation mode. The normal creation path starts in Mode 2.
The JMask loader accepts modes `1` and `2`, and an omitted value loads as Mode 1
for existing project, library, and standalone objects. Saves write
`<generationMode>2</generationMode>` for Mode 2 and omit the field for Mode 1,
preserving the historical XML form. Copies preserve the mode. Older Java Blue
ignores this extension and generates notes using its historical rules.

The toolbar shows the active mode and opens a host-window dialog. The dialog
owns the draft. Apply closes the dialog and commits a changed choice through the
existing project history patch. Cancel and Escape discard the draft. Changing
the selected object or closing its editor unmounts the dialog and discards the
draft. When the canonical mode changes while the dialog is open, the draft
displays the new mode before the user can apply another choice. The browser
manages modal focus and dismissal in the window hosting the panel.

Regression coverage checks both generation algorithms, legacy project loading,
standalone XML validation, copy and save/reload, and a mode change through
commit, undo, redo, and playback reconciliation. The implementation uses
original code within the existing MIT data and GPL application scopes.

The JMask visibility menu uses the shared checkbox menu in the panel's host
window. The menu owns its open state and closes on dismissal or editor target
replacement. In floated editors, the menu resolves its starting and directional
focus against the host document. Each toggle uses the existing field patch, and hidden rows still
participate in generation.

The editor refreshes the selected JMask on project history revisions. A selection
change cancels its pending read, and a later local patch supersedes a response
that was already in flight. If a canonical update changes the mode while the
configuration dialog is open, the dialog starts a fresh draft from that mode.

### Oscillator frequency sweeps in Mode 2

The attached projects from #765 and #739 reproduce the Java behavior in Mode 1.
Java Blue's `Oscillator.initialize()` at revision
`3ca3f40579c48a023299a68130d8ab6b9e950974` leaves the table normalized, and
`getPhase()` passes elapsed beats directly to the table. A table ending at 1
therefore reaches its final frequency after one beat. In #765 the final rate
of 20 cycles per beat and the 0.2-beat interval land every subsequent note
four cycles apart, so those notes all sample the same phase.

Mode 2 integrates the authored frequency curve over the normalized fraction
of the object duration and multiplies the area by that duration to obtain
phase in cycles. It follows step, cosine, and power interpolation and preserves
phase through knots. Oscillators with a fixed rate or a flat table use elapsed beats times frequency.
For a curved table, phase within floating-point roundoff of a waveform transition
uses the transition value, so a tiny error cannot select the opposite side.
The frequency table remains authored in normalized coordinates. The mode's
duration is stored only for the oscillator instance preparing notes.
The corrected phase calculation is original TypeScript based on the integral
of each interpolation curve.

- [Oscillator output stops varying, issue #765](https://github.com/kunstmusik/blue/issues/765)
- [Frequency sweep ends early, issue #739](https://github.com/kunstmusik/blue/issues/739)

The #737 Freeze attachment uses a separate, shared offline automation path.
For the JMask at beats 19 through 23, the switch starts at 0 and has a same-time
jump from 0 to 1 at beat 21. The Freeze CSD omits a switch event at relative
beat 2. The Java-compatible automation exporter skips intermediate point pairs
with equal times, regardless of source object type or JMask mode.
