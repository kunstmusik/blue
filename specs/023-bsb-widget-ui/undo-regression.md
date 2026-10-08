# BSB undo regression correction

This correction addresses `BSB_UNDO_AUDIT.md` (October 8, 2026) from the
rhythmic project directory. It fixes the Electron implementation in `blue3`.

## Requirements and implementation

- Each discrete canvas, property, grid, or preset action has an explicit history
  boundary and semantic label. Multi-widget commands synchronously submit one
  begin/update/end sequence, which the existing queue combines into a single
  batch. A fresh gesture ID identifies each drag and resize, including pauses
  across queue flushes; explicitly identified gestures do not expire by time.
  Implicit field-edit grouping retains its existing timeout. Performance controls
  share a gesture boundary captured by the interface editor.
- Creation commands allocate add/group/paste identities before projection and
  submission. Paste recursively assigns IDs to descendants; canonical loading
  preserves and validates those identities. Legacy snapshot reconstruction keeps
  its existing identity behavior unless the creation command requests preservation.
- Canonical edits reject missing widget/panel/instrument targets and duplicate
  creation IDs. Structural preparation on a detached candidate rejects a mixed
  batch atomically, preserving the active document, dirty state, and history.
- Mouse release applies its final coordinates before closing the gesture.
  Registered editor settlement closes pending gestures before history commands,
  discrete BSB commands, navigation, blur, and unmount. Events and animation frames
  use the widget's hosting window. Left/top resize is clamped to valid bounds so
  release outside those bounds still closes the gesture.
- Optimistic grouping/ungrouping follows canonical coordinates and child ordering.
  Navigation resolves its longest valid group path after each tree replacement;
  breadcrumbs, visible children, and command parents use that same path. Deleted
  widget IDs are removed from editor selection.
- Instrument, effect, Sound, and ObjectBuilder hosts forward history metadata.
  These changes do not alter project XML or introduce a separate undo stack.

## Java reference and licensing

Behavior was checked against local Java Blue revision
`3ca3f40579c48a023299a68130d8ab6b9e950974`, particularly
`blue-ui-core/src/main/java/blue/orchestra/editor/blueSynthBuilder/swing/BSBObjectViewHolder.java`.
Java directly moves/resizes selected objects and enters groups; layout changes
are not registered with its text undo manager. Electron's canonical project undo
is an intentional addition, preserving existing layout behavior.

All changes are original code within the application's existing GPL-3.0-or-later
scope. Java source was consulted for behavior only; no code was copied, translated,
or moved between license scopes. No dependencies or third-party assets were added.

## Regression evidence

`packages/blue-app/src/renderer/tests/bsb-undo-regression.test.tsx` connects the
production React editor, optimistic projection, patch queue, ProjectSession,
and ProjectHistory. It verifies:

- Nested cut → paste → immediate move → multi-panel drag → delete, with exact
  tree/identity restoration after every undo and redo and correct dirty checkpoints.
- Rapid multi-selection nudge and deletion as separate, atomic actions.
- A ten-second drag pause across flushes, release before an animation frame, and
  final pointer coordinates for moves and resizing. Keyboard nudges compute from
  the settled position, and performance slider drags remain one action.
- Editor settlement and undo removing the active panel, followed by a successful
  paste into the resolved root.
- Shared add/group IDs, child coordinates, and history round trips.
- Atomic rejection of stale targets and colliding IDs, including nested paste IDs.

Existing canonical BSB runtime reconciliation and history round-trip suites remain
part of validation; runtime ownership and synchronization paths are unchanged.

## Validation outcome

- Eight new integrated regressions pass. `pnpm lint`, the main-process build,
  script tests (59 checks), and `git diff --check` pass.
- The full workspace run passed Java, native engine, data (3,089 tests), engine
  client (47), and CLI (7). App tests passed 5,391 checks; one unchanged meter
  stress timing assertion failed under the parallel run. That entire stress file
  and the new regression file then passed with one worker (11 checks).
- Standalone renderer typechecking still reports existing errors, including its
  `rootDir` configuration, unrelated component contracts, and existing snapshot
  casts. A production-only check reports no errors in the new BSB gesture,
  command, or navigation code; unrelated renderer errors remain outside this fix.
