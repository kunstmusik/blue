# Modularization Review Rule

Use this rule before splitting a large module. The purpose of a split is to make a
responsibility easier to locate, test, and review while preserving the existing contract;
line count alone is not a justification.

## Review questions

1. **Responsibility cohesion** — What single domain responsibility does the proposed module
   own? Keep state, persistence, pure transformation, and host/UI coordination separate only
   when their behavior and callers support a real boundary.
2. **Deliberately small interface** — Which symbols must cross the boundary? Do not add a
   general-purpose abstraction, configuration, or extension point without a demonstrated
   consumer or focused test seam.
3. **Dependency direction** — Can dependencies form a one-way graph? Leaf contracts and pure
   transformations should not import adapters or orchestration; redesign or defer any split
   that creates a cycle or reverses ownership.
4. **Canonical state owner** — Which process, store, or session owns the state? The extraction
   must not duplicate ownership or move durable data across persistence boundaries.
5. **Compatibility strategy** — How do existing importers and callers continue to work? Prefer
   a stable façade, barrel, re-export, or thin delegate; keep newly extracted modules internal
   until an external consumer demonstrates the need for a public API.
6. **Lowest practical test seam** — What focused test can verify the moved behavior without
   exercising unrelated responsibilities? Run the existing behavioral oracle before and after
   the move; add a direct test only when no adequate seam exists.
7. **Rollback boundary** — Can the change be reviewed and reverted independently? Keep
   mechanical movement separate from semantic changes, record sanctioned exceptions, and make
   one responsibility boundary the smallest useful review unit.

## Reject or defer criteria

Reject or defer the proposal when the split is justified only by line count, when no coherent
responsibility owner can be named, when the interface would be broader than the responsibility,
when it introduces a cycle or split-brain state ownership, or when it has no demonstrated
consumer or test seam. Record the rejected seam, risk, and a concrete condition for revisiting
it instead of creating speculative helper modules.

## Boundary review record

For every accepted or deferred proposal, record:

- responsibility and public façade;
- extracted modules and their dependency direction;
- canonical state owner and compatibility strategy;
- lowest practical test seam;
- rollback boundary and any sanctioned semantic edits;
- acceptance, retention, or deferral rationale.

## First-wave boundary maps

The maps below describe the delivered ownership boundaries. The façades remain the
compatibility surface; the extracted files are package-internal.

### Seam 4 — score-object document reducer

- **Façade:** `ScoreObjectEditorPanel.tsx` still re-exports `applyPatchToDocument`; the
  five reducer tests now import the canonical reducer module directly.
- **Responsibility/dependencies:** `score-object-document-reducer.ts` owns the optimistic
  document transformation, automation patch shaping, and BSB snapshot updates. It consumes
  project-editor contracts and the existing store-owned BSB snapshot helper; it does not own
  React effects or store wiring.
- **Canonical state owner:** the renderer document is transient editor state; committed project
  state remains owned by the existing document bridge and main-process `BlueData`.
- **Lowest test seam:** the score-object tracker/sound, JMask, audio-clip, and object-builder
  reducer tests (T021) cover the moved behavior. The BSB structured branch intentionally keeps
  its shallow-copy aliasing/mutation behavior; no `structuredClone` purification was introduced.
- **Rollback boundary:** restore the reducer block to `ScoreObjectEditorPanel.tsx`, revert the
  five test import repoints, and remove the one new file. The only sanctioned edits were the
  mechanical move, panel re-export, and test repoints.

### Seam 3 — BlueData XML/CSD/runtime policy

- **Façade:** `packages/blue-data/src/blue-data.ts` retains the aggregate, public methods, and
  one-line delegates.
- **Responsibility/dependencies:** `xml-policy.ts` owns load/save/XML preservation; `csd-policy.ts`
  owns synchronous and asynchronous CSD rendering; `runtime-policy.ts` owns on-load/runtime
  processing. Policy modules receive `import type { BlueData }` and import only non-back-importing
  policy/data helpers. They are not exported from `@blue/data`.
- **Canonical state owner:** `BlueData` remains the owner of project fields, unknown XML/plugin
  data, render settings, and runtime state. The extraction preserves raw render-time assignment,
  wholesale plugin XML replacement, `this.version` mutation, and migration-before-deserialization.
- **Lowest test seam:** the BlueData XML, frozen-roundtrip, migration, CSD determinism/copy-safety/
  scheduling/automation/disk/parity, and BlueLive suites (T022); local Java fixtures passed where
  available.
- **Rollback boundary:** revert the three policy files and the façade delegates. The sanctioned
  semantic deletion is the three grep-verified dead functions recorded in the seam-3 change.

### Seam 2 — auxiliary workbench layout

- **Façade:** `auxiliary-layout.ts` is a pure re-export barrel, so existing renderer and test
  imports remain unchanged.
- **Responsibility/dependencies:** `auxiliary-layout-model.ts` owns pure state/types/selectors and
  commands; `auxiliary-layout-migrations.ts` owns v2–v4 migration and shape guards;
  `workbench-layout-envelope.ts` owns the v7 codec; `auxiliary-layout-dockview.ts` owns Dockview,
  DOM, drag/drop, transition, reconcile, and rollback behavior. Pure modules do not import the
  adapter, Dockview runtime, or DnD implementation.
- **Canonical state owner:** the existing workbench store owns live layout state; existing main
  window-layout persistence owns stored layout. The adapter may replace canonical state only with
  an `applied` transition result.
- **Lowest test seam:** auxiliary layout, persistence, store, and slideout tests (T023), including
  migration versions, rollback/ownership invariants, and the 200px Java Blue parity case.
- **Rollback boundary:** restore the original `auxiliary-layout.ts` and remove the four sibling
  modules; no consumer or persistence wiring changed.

### Seam 1 — shared project-editor

- **Façade:** `packages/blue-app/src/shared/project-editor/index.ts` is the explicit compatibility
  barrel; the old `project-editor.ts` file is deleted, so all existing `shared/project-editor`
  specifiers resolve to the directory index.
- **Responsibility/dependencies:** `contract.ts` owns snapshot/patch/realtime types and validators;
  `identity.ts` owns all six WeakMap registries; `bsb-widgets.ts` owns BSB serialization and patch
  helpers; `snapshot-score.ts` owns score/document/automation builders; `snapshot-mixer-orchestra.ts`
  owns mixer/orchestra/instrument/transport/BlueLive builders and JMask payload snapshots;
  `patch-score.ts` owns score/tempo/meter appliers; `patch-mixer-bluelive.ts` owns mixer/BlueLive/
  MIDI appliers and nested-poly snapshots; `patch-document.ts` owns document orchestration. The
  dependency direction is contracts/identity/BSB → snapshot builders → patch appliers → document
  orchestration; builders do not import patch modules.
- **Canonical state owner:** `BlueData` and its existing main/renderer document bridge remain the
  canonical project owners. Snapshots are projections; patches mutate the existing model through
  the existing contracts. The identity registries exist exactly once in `identity.ts`.
- **Lowest test seam:** the project-editor, score-timeline-automation, and project-store checkpoint
  (T024), plus the main/preload builds. The first run had one unrelated performance timing miss;
  the exact checkpoint rerun passed 361 files, 3,575 tests, and 2 skips.
- **Rollback boundary:** restore `project-editor.ts`, remove the eight internal modules, and leave
  the 284 consumer import specifiers untouched. The explicit index surface is the compatibility
  proof; no consumer edits were needed for this seam.

### Seam-3 deletion record

`registerNestedEffectOpcodes`, `applyOpcodeNameReplacements`, and
`getBlueLiveAlwaysOnInstrumentId` were grep-verified dead code and were deleted while moving the
CSD policy. No live caller or fixture depends on them.

### Commit mapping

The four seam commits were created in the required risk order. Each commit is independently
revertible; the only sanctioned semantic edits are the three dead-code deletions in seam 3 and
the five reducer-test import repoints in seam 4.

| Order | Commit | Boundary | Rollback unit |
|---|---|---|---|
| 1 | `02817ce` | Score-object reducer (seam 4) | Reducer file, panel façade, and five test repoints |
| 2 | `493c1cf` | BlueData XML/CSD/runtime policies (seam 3) | Three policy files and thin `BlueData` delegates |
| 3 | `e2069bd` | Auxiliary layout model/migrations/envelope/adapter (seam 2) | Four extracted layout modules and barrel |
| 4 | `e4ce585` | Shared project-editor contract/identity/snapshots/patches (seam 1) | Directory barrel, internal modules, and stale map cleanup |

## Deferred inventory

Each item has a candidate seam and a concrete reason to defer it. Revisit only when the stated
test/contract prerequisite exists; do not split it solely because the file remains large.

### `packages/blue-app/src/main/main.ts` (5,017 lines)

- **Candidate seam:** window lifecycle, IPC registration, and service/runtime wiring.
- **Risk:** high; initialization ordering and host-side side effects cross nearly every feature.
- **Review outcome:** defer until an IPC contract inventory and startup/shutdown integration seam
  exist. Preserve the file as a cohesive host orchestrator in the meantime.

### `packages/blue-app/src/renderer/stores/project-store.ts` (4,926 lines)

- **Candidate seam:** move `applyBsbInterfacePatchToSnapshot` and
  `shouldPreserveWidgetMetadataForBsbPatch` together as a store-independent patch module.
- **Risk:** high; shared-reference aliasing, optimistic updates, and store subscriptions are
  behaviorally coupled.
- **Review outcome:** defer until the project-editor reducer and snapshot contracts have settled,
  then add direct aliasing/metadata tests before moving the seam.

### Score timeline canvases

`ScoreTimeCanvas.tsx` (2,119 lines) and `TrackLayerGroupCanvas.tsx` (1,586 lines) share the
following candidate boundary:

- **Candidate seam:** pure geometry/painting and hit-testing versus render-cycle state,
  pointer/selection state, and canvas lifecycle.
- **Risk:** high performance sensitivity; small ownership changes can alter invalidation and
  pointer timing.
- **Review outcome:** defer until profiling identifies a stable pure boundary and canvas-level
  geometry/hit-test tests exist. Retain render orchestration with the component until then.

### `packages/blue-app/src/main/unified-library/service.ts` (1,870 lines)

- **Candidate seam:** repository/index/search operations versus project adapter and service
  orchestration.
- **Risk:** medium-high; SQLite lifecycle, preview lookup, and editor callbacks share failure and
  performance behavior.
- **Review outcome:** defer until repository and adapter interfaces are documented and performance
  thresholds have isolated tests; the service remains the canonical orchestration owner.

### `packages/blue-app/src/renderer/stores/workbench-store.ts` (1,715 lines)

- **Candidate seam:** auxiliary-layout state transitions versus persistence/session orchestration.
- **Risk:** medium; it is already a thin coordinator over the seam-2 layout modules.
- **Review outcome:** retain/defer pending post-seam-2 size and consumer review. Split only if a
  store-independent command/test seam remains after the new layout ownership is exercised.
