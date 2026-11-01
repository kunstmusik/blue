# Research: Sound Score Object Editor Parity

## Decision: Mirror Java Blue's top-level Interface, Automation, and Comments tabs

**Rationale**: Java Blue `SoundEditor` is organized around a tabbed editor shell. Treating `Sound` as a plain text editor or collapsing those surfaces into one panel would flatten the core workflow that composers expect.

**Sources Reviewed**:

- Java Blue `blue-ui-core/src/main/java/blue/soundObject/editor/SoundEditor.java`
- Current TypeScript `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/SoundEditor.tsx`

## Decision: Reuse the existing BSB interface editor work instead of building a second widget stack

**Rationale**: The highest-value `Sound` UI reuse is the BSB interface infrastructure already delivered for orchestra and BSB editing. Reusing that work reduces risk and keeps widget behavior consistent across the app.

**Sources Reviewed**:

- `packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueSynthBuilderEditor.tsx`
- `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/`
- Java Blue BSB integration inside `SoundEditor`

## Decision: Keep automation editing inside the `Sound` spec rather than pushing it to the shell-management slice

**Rationale**: Java Blue treats automation as a child workflow of `SoundEditor`, not as a shell-level navigation surface. The grouped Tier 2 draft was too shallow here; the replacement spec needs explicit automation analysis and tasking.

**Sources Reviewed**:

- Java Blue `blue-ui-core/src/main/java/blue/soundObject/editor/pianoRoll/AutomationPanel.java`
- Java Blue `blue-ui-core/src/main/java/blue/soundObject/editor/TimeBar.java`
- Java Blue line-selector and line-canvas helpers used by `SoundEditor`
- Current TypeScript automation models in `@blue/data` and engine-side automation support

## Decision: Use a scoped renderer modal for the test-preview workflow

**Rationale**: Java Blue exposes a test action from the editor. blue-electron already has a safe pattern for this in the dedicated `External` editor test flow, so `Sound` should follow the same preview model rather than inventing a transport-heavy workflow.

**Sources Reviewed**:

- Java Blue `SoundEditor` test button behavior
- `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/ExternalScoreObjectEditor.tsx`
- Existing main/preload test-preview IPC seams

## Decision: Keep tab selection local, but keep BSB, automation, and comment edits canonical

**Rationale**: The selected tab is purely editor-shell state. Interface, automation, and comment content must still mutate the canonical `Sound` model through shared score patch plumbing so save or reload behavior stays correct.

**Sources Reviewed**:

- `packages/blue-app/src/shared/project-editor.ts`
- `packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx`
- Existing score-object patch flows from Specs 037 and 038

## Legacy Instance automation timing characterization (2026-10-31)

Java Blue places the instrument notes and automation on different timelines for
a Sound inside an Instance. The project owner approved correcting this long-standing
bug for all projects on 2026-11-01. Each audible occurrence receives a private
generated instrument and an envelope positioned after Instance and parent timing
transforms. A truncated repetition plays just the corresponding part of the curve.
There is no compatibility setting or XML migration.

Verified both source and executable behavior at Java revision
`3ca3f40579c48a023299a68130d8ab6b9e950974` (built Blue 2.10.3) in
`~/work/nbprojects/blue`:

- [`Sound.adjustLineType` and `generateForCSD`](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/Sound.java)
  attach `SoundObjectParameterLine` to the source Sound and register its instrument.
- [`SoundObjectParameterLine`](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/components/lines/SoundObjectParameterLine.java)
  reports source start/duration and evaluates normalized points against those values.
- [`Instance.generateForCSD` / `processNotes`](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/Instance.java)
  normalize and apply time behavior to notes only.
- [`CSDRender.appendParameterScore`](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-ui-core/src/main/java/blue/ui/core/render/CSDRender.java)
  uses the source start/duration for parameter score placement.

A temporary original Java probe called the built `Instance.generateForCSD` and,
through reflection, the actual private `CSDRender.appendParameterScore`. The Sound
started at beat 2, lasted 4 beats, and had normalized points `(0,100)`, `(0.5,300)`,
`(1,500)`. Its Instance started at beat 10 and lasted 10 beats:

| Instance behavior | Generated sound notes (start/duration) |
| --- | --- |
| NONE | 10/4 |
| SCALE | 10/10 |
| REPEAT | 10/4, 14/4, 18/2 |
| REPEAT_CLASSIC | 10/4, 14/4 |

Every mode generated the same parameter helper notes: `2/2 100→300`,
`4/2 300→500`, and `6/0.0001 500→500`. At beat 10 the evaluator returned 500.
Nesting the Instance in a NONE PolyObject starting at beat 5 moved the sound notes
five beats later and left parameter timing unchanged. Selecting render beats 3–5
generated relative helper notes `0/1 200→300`, `1/1 300→400`, and
`2/0.0001 400→400` in every mode.

The TypeScript regression tests cover occurrence placement, overlapping repetitions,
scaling, selected ranges, and source immutability.

License/provenance: the destination tests are original MIT-scope code; Java
GPL-2.0-or-later source was consulted as a behavioral reference, not copied or
translated. No dependencies, assets, or third-party source were incorporated.
