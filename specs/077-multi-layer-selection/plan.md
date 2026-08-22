# Implementation Plan: Consistent Multi-Layer Selection and Operations

**Branch**: `077-multi-layer-selection` | **Date**: 2026-08-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/077-multi-layer-selection/spec.md`

## Summary

Introduce a transient, score-wide layer-selection model that is independent from the existing
score-object selection and Track MIDI-focus state. The model will flatten the currently visible
layer groups into one ordered range space, render the Pattern Layer selected treatment in every
layer header, and expose the same selection state accessibly to aligned timeline rows without
applying the header background there.

Layer operations will be derived from the selection as grouped ranges. Same-group Push Up/Down
will delegate to the existing range-aware Blue data operations; mixed-group pushes will remain
visible but disabled with a reason. Multi-group Remove will use one confirmation and one atomic
score patch, with the clarified empty-group option. Existing single-layer Add Above/Below behavior
will remain available only for one selected layer. A transient snapshot identity will be added for
layers whose current snapshot ID is index-derived, so selection follows a moved PolyObject layer
without changing `.blue` persistence.

## Technical Context

**Language/Version**: TypeScript 5.8+ in strict mode; React 19 renderer; Electron 35 main process.

**Primary Dependencies**: `@blue/data` score models, existing typed `ProjectDocumentPatch`/`ScorePatch`
contract, Zustand 5 renderer stores, Radix context menus, Vitest 4 with jsdom, and the existing
Playwright browser test harness.

**Storage**: No new persistent storage. Layer selection, focus, anchor, and operation availability
are renderer session state. Layer mutations continue through the canonical BlueData project model
and `.blue` XML path; selection-only changes never enter the project snapshot or XML.

**Testing**: Focused `@blue/app` Vitest unit/component tests, shared project-editor patch tests,
existing main-process guard tests, the score browser test harness where layout/keyboard behavior
requires it, `@blue/app` main build, and repository lint/test checks proportional to the final diff.

**Target Platform**: Blue Electron desktop on macOS, Windows, and Linux; renderer behavior must
remain browser-safe and cross-platform.

**Project Type**: Monorepo desktop application with a TypeScript data/model package, Electron main
process, preload contracts, and React renderer.

**Performance Goals**: Build visible layer references and operation availability in O(V) time for
V visible layers; keep selection updates synchronous and cheap enough for keyboard repeat; perform
canonical mutations in O(R + affected layers), where R is the number of selected group ranges.
Selection must not add per-frame work to timeline drawing.

**Constraints**: Preserve the `@blue/data` host boundary, keep renderer state serializable and
transient, preserve existing score-object compatibility guards, never move a layer between groups
for a push, use one canonical patch for a multi-group removal, and do not invalidate current
object-editor or MIDI-routing gestures.

**Scale/Scope**: The active score view and its visible Pattern, Track, and SoundObject layer
groups. The model is linear in visible layer count and supports the existing nested-score path
without introducing a new project-file format.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Portable data core**: PASS — the design keeps selection state and UI helpers in `@blue/app`.
  Existing `@blue/data` layer-group range operations are reused without adding Electron, DOM,
  Node.js, dynamic-import, or renderer dependencies to the data package.
- **Java and project compatibility**: PASS — the design is based on Java Blue’s
  `LayerSelectionCoordinator`, provider panels, and `pushUpLayers`/`pushDownLayers` semantics.
  No `.blue` or CSD format changes are planned. The spec documents the intentional visible-disabled
  push-menu and expanded keyboard behavior divergences.
- **Canonical ownership and contracts**: PASS — the new layer selection store owns only transient
  renderer state. `ScorePatch` remains the typed mutation contract; the main process applies atomic
  range patches to BlueData and broadcasts the canonical snapshot. The snapshot-only selection ID
  is disposable and never serialized to `.blue`.
- **Runtime and engine isolation**: N/A — this feature does not change Java-runtime, filesystem,
  process, ZeroMQ, engine, or preload behavior. Layer mutations use the existing document patch
  path, and engine sync remains unaffected by selection-only changes.
- **Host-path portability**: N/A — no filesystem or embedded-text path is introduced.
- **Verification evidence**: PASS — focused pure selection tests, renderer header/canvas tests,
  patch application tests for same- and cross-group operations, regression coverage for Pattern
  source selection and Track object guards, `@blue/app` main build, and the quickstart commands
  below provide deterministic validation.

## Project Structure

### Documentation (this feature)

```text
specs/077-multi-layer-selection/
├── plan.md              # This file
├── research.md          # Phase 0 decisions and evidence
├── data-model.md        # Layer-selection state and invariants
├── quickstart.md        # Focused and end-to-end validation guide
├── contracts/
│   └── layer-selection.md # Renderer and ScorePatch contracts
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)
```text
packages/blue-app/src/
├── shared/project-editor.ts                 # ScorePatch types and canonical patch application
├── main/main.ts                             # Main-process patch side effects and editor cleanup
├── renderer/stores/
│   ├── layer-selection-store.ts             # Transient selected keys, anchor, and keyboard focus
│   └── project-store.ts                     # Optimistic snapshot projection and patch dispatch
├── renderer/components/workbench/panels/score/
│   ├── layer-selection-utils.ts             # Visible-order/range/operation pure helpers
│   ├── PatternLayerHeader.tsx               # Pattern source + layer selection integration
│   ├── ScorePanel.tsx                       # Visible-order scope and session/path reconciliation
│   ├── ScoreManagerDialog.tsx               # Secondary layer operation surface
│   └── layer-groups/
│       ├── ScoreTimeCanvas.tsx              # SoundObject row accessible selection state
│       ├── PatternsLayerGroupCanvas.tsx     # Pattern row accessible selection state
│       ├── PatternGridRow.tsx               # Pattern row canvas styling/state
│       ├── TrackLayerGroupCanvas.tsx        # Track row accessible state and operation context
│       └── score-timeline-gesture-utils.ts  # Shared visible-layer geometry/selection helpers
└── renderer/tests/ and shared/*test.ts      # Focused selection, UI, and patch regression tests

packages/blue-data/src/score/{patterns,track,layers}/
└── existing range operations               # Reused; no new persistence model planned
```

**Structure Decision**: Keep the feature in `@blue/app` because selection is renderer session
state and the existing document bridge already owns score mutations. Add small pure helpers beside
the score panel, a dedicated Zustand store beside object selection, and typed score patch variants
in the shared project-editor contract. Reuse the existing `LayerGroup` range methods in
`@blue/data` rather than adding a second layer-order implementation.

### Implementation Sequence

1. Add the transient layer-selection identity to score snapshots and create pure helpers for
   flattening visible rows, selecting ranges, keyboard focus movement, operation availability,
   grouped ranges, and selection reconciliation.
2. Add the dedicated selection store and wire ScorePanel’s active score path/session lifecycle to
   clear or prune it. Make Pattern, Track, and SoundObject headers expose the same selected class,
   `aria-selected`, focus state, and keyboard behavior while preserving Pattern source-editor and
   Track MIDI-focus behavior. Keep the Pattern header label Java-compatible by rendering only its
   layer name, including an empty label for unnamed layers.
3. Add shared layer-operation helpers and the typed `moveLayerRange` and `removeLayerRanges` score
   patches. Project-store optimistic application and main-process application must use the same
   range semantics; remove ranges in descending local-index order and optionally remove empty
   groups recursively without reparenting layers. Update canonical-refresh classification,
   Track-instrument editor cleanup, mixer reconciliation, and automation side-effect handling for
   the new range-removal patch where the existing single-layer path requires it.
4. Update header context menus and keyboard commands: Add Above/Below only for one layer; Push
   commands always visible with disabled reasons for mixed-group/boundary cases; Remove uses one
   count-aware confirmation and the default-checked empty-group option. Remove/Backspace shortcuts
   must not consume text-editing keys from layer-name inputs. Route secondary Score Manager layer
   actions through the same operation helpers so its single-group view cannot diverge.
5. Preserve normal aligned timeline-row styling while exposing selected state accessibly, without
   replacing existing score-object hit-testing, marquee selection, clipboard behavior, or
   cross-group object-movement guards.
6. Add focused unit/component/patch tests, update the existing Pattern shift-click expectation,
   and run the quickstart validation sequence.

## Post-Design Constitution Re-evaluation

- **Portable data core**: PASS — no renderer/session dependency is introduced into `@blue/data`;
  existing data-layer range methods remain the only data-core operation used.
- **Java and project compatibility**: PASS — range movement/removal follows the Java layer-group
  semantics, the new selection identity is snapshot-only, and the two specified UI/keyboard
  divergences are explicit and testable.
- **Canonical ownership and contracts**: PASS — transient layer selection stays in the renderer;
  `moveLayerRange` and `removeLayerRanges` are validated typed score patches applied by the main
  BlueData owner and reflected through the existing canonical snapshot flow.
- **Runtime and engine isolation**: PASS — no engine, Java-runtime, filesystem, or process contract
  changes are required; layer mutation remains within the existing project patch path.
- **Host-path portability**: N/A — the feature introduces no host paths, external text paths,
  or platform-specific normalization.
- **Verification evidence**: PASS — pure selection invariants, snapshot projection, main patch
  application, UI/keyboard behavior, confirmation semantics, and existing object/MIDI regressions
  are all assigned focused checks in `quickstart.md` and ready for task breakdown.

## Complexity Tracking

No constitution violations are identified. The atomic range patches and transient snapshot
selection identity are the smallest additions that preserve canonical ownership, Java-compatible
range behavior, selection identity after reordering, and one-confirmation multi-group removal.
