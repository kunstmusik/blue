# Research: Consistent Multi-Layer Selection and Operations

**Feature**: `077-multi-layer-selection`
**Date**: 2026-08-17

## Research Scope

This research covers the current TypeScript score UI and patch path, the Blue data layer-group
operations, and the Java Blue selection implementation named in the feature specification. No
external web research is needed: the relevant behavior and contracts are local to this repository
and the Java Blue reference workspace.

## Current TypeScript Behavior

### Decision: Keep layer selection separate from object selection

- `packages/blue-app/src/renderer/stores/score-selection-store.ts` stores timeline object IDs,
  object editor targets, object clipboard data, and Pattern source targets. It has no layer range,
  anchor, or cross-group provider concept.
- `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`
  derives its selected style from the embedded source object’s object-selection ID. Its current
  Shift-click clears object selection because there is no multi-source editor target.
- `ScorePanel.tsx` renders `PatternLayerHeader` for Pattern groups and `SoundLayerHeader` for
  Track and SoundObject groups. `SoundLayerHeader` currently renders only Track MIDI-focus styling;
  it does not read a layer-selection state.
- `TrackLayerGroupCanvas.tsx` already supports multi-object selection and uses
  `collectTimelineLayerSelection` to convert “Select Layer” into object selection. That behavior
  must remain distinct from the new layer selection.

**Rationale**: Extending the object store would make a layer range look like a collection of
objects, break Pattern source-editor semantics, and conflate layer operations with object
audition/movement. A dedicated store preserves existing state ownership and makes a selected empty
layer representable.

**Alternative rejected**: Reusing `selectedObjectIds` for layer membership. It cannot represent an
empty layer, cannot distinguish Pattern source objects from timeline objects, and would make
multi-layer selection appear to be multi-object editing.

## Visible-Order Selection

### Decision: One ordered visible-layer coordinate space

`ScorePanel.tsx` and the left header list already consume the active score’s ordered
`ScoreLayerGroupSnapshot[]`. A shared pure helper will flatten that order into visible layer
references with group ID, group type, local index, and global index. Normal selection sets one
anchor/focus pair; Shift-click and Shift+Arrow select the inclusive slice between them. A range that
crosses groups selects the anchor-group suffix, complete intermediate groups, and target-group
prefix, matching the Java coordinator.

**Rationale**: A single coordinate space reproduces Java’s provider ordering without creating
separate selection models that must synchronize. It gives headers and aligned timeline rows the
same membership calculation while allowing score-area rows to retain their normal visual
treatment.

**Alternative rejected**: Maintaining one independent selection model per group and synchronizing
them through events. That duplicates the Java coordinator’s bookkeeping in React and makes keyboard
focus/reconciliation harder when the active score path changes.

## Layer Identity

### Decision: Add a transient snapshot-only layer selection identity

The existing `ScoreLayerSnapshot.layerId` is not uniformly stable: Track IDs come from the Track
unique ID, Pattern IDs come from a `WeakMap`, but PolyObject/SoundObject layer snapshots currently
use `${groupId}-layer-${index}`. Reordering a PolyObject range therefore changes its snapshot
`layerId` even though the layer object itself remains the same.

Add `layerSelectionId` to the renderer-facing score snapshot as a transient identity generated from
the in-memory layer object. Keep the existing `layerId` for location/automation contracts. The
selection store keys entries by active score scope, group ID, and `layerSelectionId`; if a fixture
does not provide the new field, helpers fall back to `layerId`. A new project session or reload
creates new in-memory objects and clears selection, so no persistent ID migration is required.

**Rationale**: This preserves selection through same-session reorder and remove reconciliation
without changing `.blue` XML or Java serialization. It also represents empty layers, unlike using
contained object IDs.

**Alternative rejected**: Persisting a new unique ID on `SoundLayer` in `.blue`. That expands the
file-format surface and would require Java compatibility/migration work for a state that is
explicitly transient.

## Layer-Operation Mutation Contract

### Decision: Atomic range patches over repeated single-layer patches

The shared `ScorePatch` union currently exposes single-layer `addLayer`, `removeLayer`, and
`moveLayer` operations. The data layer already exposes Java-compatible `pushUpLayers(start,end)`,
`pushDownLayers(start,end)`, and `removeLayers(start,end)` methods for Pattern, Track, and
SoundObject groups.

Add two typed patch variants:

- `moveLayerRange`: one group, inclusive start/end indices, and an insertion `targetIndex`. The
  main process validates the target and rejects invalid or boundary/no-op requests.
- `removeLayerRanges`: one or more group-local inclusive ranges plus `deleteEmptyLayerGroups`.
  Ranges are applied in descending local-index order per group. Empty groups are removed only when
  the confirmed option is true; group membership is never changed by the operation.

The renderer applies the same transformations optimistically, then reconciles with the canonical
snapshot. Main-process editor cleanup and mixer/automation side-effect checks must recognize the
new removal patch where the existing single-layer path does.

**Rationale**: Repeating single-layer patches would shift later indices, could partially apply a
cross-group removal, and would not represent the user’s one confirmation as one canonical action.
The existing range methods already encode the correct Java block semantics.

**Alternative rejected**: Sending a list of `moveLayer` patches. It cannot safely move a selected
block without carefully rewriting indices after every splice and makes selection-following/error
handling less reliable.

## Operation Availability and Keyboard Model

### Decision: Centralize availability and use explicit reason codes

The operation helper will derive one state from the current layer selection:

- Add Above/Below: visible and enabled only for exactly one selected layer.
- Push Up/Down: always visible; enabled only for a same-group selection that is not at the
  corresponding boundary; disabled reasons distinguish mixed groups from top/bottom boundaries.
- Remove: enabled for any non-empty selection and opens one confirmation.

Pointer context menus and keyboard commands use the same derived state. The first keyboard model
uses Arrow Up/Down for focus/selection, Shift+Arrow for range extension, Alt+Arrow Up/Down for
Push Up/Down, and Delete/Backspace for Remove. Header rows expose the selected state to assistive
technology and keep row controls out of the selection gesture.

**Rationale**: One availability calculation prevents Pattern, Track, SoundObject, and Score
Manager surfaces from drifting. The clarified always-visible disabled push commands make boundary
and mixed-group protections discoverable.

**Alternative rejected**: Hiding unsupported commands. That would match Java’s multi-group menu
visibility but contradicts the clarified user requirement for an explanatory disabled state.

## Secondary Score Manager Surface

### Decision: Reuse operation semantics while keeping the manager’s group navigator

`packages/blue-app/src/renderer/components/workbench/panels/score/ScoreManagerDialog.tsx` owns a
separate `selectedGroupIndex`/`selectedLayerIndex` state and currently sends single-layer
`moveLayer`/`removeLayer` patches. It is not the main cross-group visible layer list, but leaving its
operation rules separate would reintroduce inconsistent Push/Remove behavior.

The implementation will route its layer-row operations through the shared operation/range helpers
and canonical range patches. Its group navigator remains local to the dialog; cross-group visible
range selection is exercised in the main ScorePanel where all layer groups are presented together.
The manager must still reflect the shared selected styling for rows whose layer identity is active.

**Rationale**: This avoids a second operation implementation without forcing the manager’s two-pane
group navigation into the main timeline’s visible-order focus model.

**Alternative rejected**: Leave the manager’s local single-index actions untouched. That would make
the same layer operation behave differently depending on which score surface opened it.

## Removal Confirmation

### Decision: Use a renderer confirmation dialog with one optional empty-group checkbox

The existing browser `window.confirm` calls cannot expose the Java-parity “Delete empty Layer
Groups” checkbox. Add a small renderer confirmation component/state for layer removal. It displays
the total selected layer count, lists the affected group count when useful, and shows the checkbox
defaulted on whenever one or more selected ranges would empty a group. Cancel produces no patch;
confirm sends exactly one `removeLayerRanges` patch.

**Rationale**: The requirement needs both a count-aware single confirmation and an explicit choice
about empty groups. A dedicated component is deterministic and testable in jsdom.

## Java Blue Parity Evidence

- `blue-ui-utilities/.../LayerSelectionCoordinator.java` coordinates provider anchors and computes
  cross-provider Shift ranges, clearing providers outside the anchor-to-target span.
- `blue-score-layers-audio-ui/.../AudioHeaderListPanel.java` and
  `blue-score-layers-patterns-ui/.../PatternsHeaderListPanel.java` select row ranges, clear
  object/editor selections for multi-row gestures, make Add single-selection-only, and move
  selected blocks with `pushUpLayers`/`pushDownLayers` while updating selection indices.
- The Java header menus hide Push for multi-group selections; this plan preserves the group-safe
  rule but intentionally keeps the commands visible and disabled as required by the spec.
- Java removal confirms deletion and offers deletion of an empty group, including a single
  cross-group confirmation path. The planned renderer dialog follows that behavior.

## Research Conclusion

All technical-context unknowns are resolved. The implementation can proceed without changing the
project file format, adding host dependencies to `@blue/data`, or introducing a new IPC surface.
