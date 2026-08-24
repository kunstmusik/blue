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

- **Façade:** `packages/blue-app/src/shared/project-editor.ts` is the one-line compatibility
  façade over the internal `project-editor/index.ts` barrel. Existing source specifiers and the
  emitted CommonJS path remain stable, preventing a stale pre-refactor file from shadowing the
  internal directory after an incremental build.
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
  the corrected focused checkpoint passed 22 files and 178 tests.
- **Rollback boundary:** restore the original `project-editor.ts` implementation, remove the eight
  internal modules, and leave the 284 consumer import specifiers untouched. The file façade plus
  explicit internal index surface is the compatibility proof; no consumer edits were needed for
  this seam.

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

## Second-wave boundary inventory — 088-large-file-refactor

The following inventory freezes the responsibilities that remain in the two target façades
before the second-wave ownership moves. It is an ownership record, not a line-count target.

### `packages/blue-app/src/renderer/stores/project-store.ts`

| Responsibility | Callers | State read/write | Side effects | Failure/lifecycle | Test seam | Rollback unit |
|---|---|---|---|---|---|---|
| Zustand façade and project-loaded projection | Renderer stores, hooks, editors, tests | Transient renderer snapshot; no `BlueData` write | Zustand updates, MIDI/layer selection reconciliation | Reset on project/session replacement; preserves dirty flag for refresh | `project-store.test.ts`, IPC listener tests | Restore delegate wiring |
| BSB optimistic snapshot patching | Instrument editors, score-object reducer, presets/performance tests | Caller-owned instrument snapshot; nested tree identity and metadata aliases | None; pure renderer transformation | Tolerated malformed/missing targets remain no-ops | BSB editor, presets, performance, sound-patch tests; direct BSB seam | Restore BSB implementation inline |
| Patch batching and canonical acknowledgement | All optimistic project-document actions | One pending FIFO, trailing timer, in-flight commit, local revision/session fence, dirty baseline | Typed preload commit/refresh calls, toast/log delivery | One in-flight batch; no retry; refresh is best effort | Direct queue fake-timer/adapters plus façade tests | Restore queue protocol inline |
| Cross-domain optimistic reducers | Score, mixer, orchestra, MIDI, project properties, transport, UDO, Blue Live, scratch pad | Transient renderer snapshots | Realtime-control preload calls | Existing reducer-specific no-op and immediate-update behavior | Existing project-store/domain suites | Retain in façade until narrow seam exists |
| Renderer-only session/UI state | Toolbar, score navigation, missing-audio and editor panels | Dirty/loading/title/selection/session projection | Zustand-only state changes | Reset with project lifecycle | Store and panel tests | Retain in façade |

Canonical ownership remains the main-process `BlueData` document bridge. The BSB seam and queue
depend on shared contracts and injected callbacks; neither imports the façade, host APIs, React,
Zustand, or Electron.

### `packages/blue-app/src/main/main.ts`

| Responsibility | Callers | State read/write | Side effects | Failure/lifecycle | Test seam | Rollback unit |
|---|---|---|---|---|---|---|
| Application composition and pre-ready registration | Electron app lifecycle | Window/service references | Protocol registration, IPC registration, verification branches | Pre-ready once; startup failure unwinds completed reversible stages | IPC inventory and startup lifecycle oracle | Restore composition call |
| Project identity and replacement coordination | File actions, document IPC, editor/runtime handlers | Active `BlueData`, native path, revision, session identity | Filesystem, runtime/editor cleanup, broadcasts, recent files | Open/new/save-as/revert/close preserve current order and stale fences | Project session/lifecycle and replacement suites | Restore identity writes in main |
| Window/menu/activation lifecycle | Main renderer, settings/about/popouts | BrowserWindow refs and layout/follow state | Window creation/focus/menu/event listeners | Explicit normal shutdown order | Window/layout/workbench tests | Restore composition wiring |
| Direct project/file-session IPC (17) | Renderer/preload bridge | Project session plus recent/MIDI/missing-audio owners | Dialogs, filesystem, replacement and broadcasts | Preserve null/status/error envelopes | Project-lifecycle registrar tests | Restore one registrar block |
| Direct artifact IPC (15) | Renderer/preload bridge | Project read and host artifact state | Dialogs, import/export, SoundFont/CsoundRC, native paths | Preserve cancellation/validation/owner targeting | Project-artifacts registrar tests | Restore one registrar block |
| Playback/runtime/render IPC (30) | Renderer/preload bridge | Engine/runtime/project session owners | Playback, CSD, Blue Live, REPL, realtime, render/freeze | Preserve mutual exclusion, cancellation, events | Playback-runtime/source-audit tests | Restore one registrar block |
| Project document/editor/audio IPC (27) | Renderer/preload bridge | Project session/document and editor owners | Patch commit, editor windows, audio/score-object tools | Preserve receipt/fence/broadcast and unavailable/error forms | Project-document registrar tests | Restore one registrar block |
| Application/settings/layout IPC (23) | Renderer/preload bridge | Settings, OSC, file manager, window-layout owners | Confirmation, persistence, native paths, targeting | Fail-closed confirmation and ordered shutdown | Application registrar tests | Restore one registrar block |
| Existing registrar/service composition (65) | Main startup/shutdown | Unified library, code repository, workbench, MIDI owners | SQLite/services/windows/listeners | Duplicate-safe lease and exact disposer | Existing registrar tests plus inventory | Restore lease adoption independently |

`ProjectSession` is the sole writer for active document identity, native path, revision, and
numeric session fence. It does not absorb runtime, window, engine, library, MIDI, or temporary-file
ownership. `main.ts` remains the application composition root and retains the explicit normal
shutdown order; failed startup uses a separate reverse-order rollback stack.

## Second-wave review decisions

- Accepted: BSB snapshot reducer, patch queue coordinator, `ProjectSession`, project lifecycle
  coordinator, transactional IPC registration lease, startup-failure rollback, and five cohesive
  IPC registrars.
- Retained: cross-domain renderer reducers, runtime/window/service implementations, and main
  composition/menu/normal-shutdown code whose callers still cross multiple domains.
- Deferred: additional score/mixer/orchestra reducer splits, one-module-per-channel IPC splits,
  generic event buses, and a replacement god object. Revisit only after a smaller owner, explicit
  dependency direction, and a focused oracle exist.

### Final boundary audit — 2026-08-23

- A source search found no direct assignments to the retired `currentData`, `currentFilePath`,
  `currentProjectRevision`, or `currentProjectSessionId` variables in `main.ts`; `ProjectSession`
  is the only active identity writer.
- A source search found one renderer patch queue owner (`createProjectPatchQueue`) and no second
  pending-patch or in-flight-commit protocol in the façade. The façade delegates revision, flush,
  await, and reset operations to that queue.
- The five domain registrar modules own the real `electronIpcMain` registrations; `main.ts`
  retains only the compatibility collector and composes them through one ordered 112-endpoint
  transaction. Existing registrar owners remain separate, expose frozen channel-order arrays for
  the executable 177-endpoint oracle, and use the shared lease.
- Pure renderer modules have no back-imports from the store façade or main process. Main-process
  registrars remain host-side and do not import renderer modules. No new dependency cycle was
  identified.
- Accepted-seam rollback remains independently scoped: remove the BSB module, queue module,
  session/lifecycle modules, lease adoption, or domain registrar composition without changing
  unrelated reducer families or host services.

## Deferred inventory

Each item has a candidate seam and a concrete reason to defer it. Revisit only when the stated
test/contract prerequisite exists; do not split it solely because the file remains large.

### `packages/blue-app/src/main/main.ts` (5,017 lines)

- **Accepted seams:** `ProjectSession`, `project-lifecycle.ts`, the transactional registration
  lease, and five channel-set registrar adapters now provide the narrow ownership boundaries.
- **Retained responsibility:** handler implementations, runtime/window/service wiring, composition,
  and explicit normal shutdown remain in `main.ts`. The completed composition checkpoint proves
  source order and startup-failure compatibility; retaining the handler bodies avoids inventing
  shallow host-operation wrappers without narrower state ownership.
- **Risk:** high; initialization ordering and host-side side effects cross nearly every feature.
- **Revisit condition:** identify a narrower host-state owner and focused behavior oracle before
  relocating any handler body out of the composition root; the 177-endpoint compatibility oracle
  must continue to pass unchanged.

### `packages/blue-app/src/renderer/stores/project-store.ts` (4,926 lines)

- **Accepted seams:** BSB snapshot mutation and the patch queue now live in store-independent
  modules behind the unchanged façade and are covered by direct identity/timing tests.
- **Retained responsibility:** cross-domain score, mixer, orchestra, MIDI, transport, and UI
  reducers remain in the façade because their narrow ownership boundary is not yet isolated.
- **Risk:** high; shared-reference aliasing, optimistic updates, and store subscriptions remain
  behaviorally coupled in the retained reducer families.
- **Revisit condition:** identify a smaller injected reducer owner and add a cross-domain oracle
  before any further split.

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
