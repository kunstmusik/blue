# Implementation Plan: Java Blue Live Trigger Parity

**Branch**: `065-blue-live-parity` | **Date**: 2026-07-30 | **Spec**: [/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/spec.md](/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/spec.md)

**Completed**: 2026-07-31 | **Result**: 68/68 tasks complete; all final validation gates pass

**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/spec.md`

## Summary

Restore the missing Java Blue Live manual-trigger and cell-authoring baseline without beginning the future track/scene launcher. In addition to the isolated trigger preparation and fenced engine submission already planned, replace the fixed bottom row/column controls with Java's cell-relative context menu, add compatible SoundObjects through typed canonical patches, make Blue Live use the Score timeline's application-wide ScoreObject clipboard, and route selected Live SoundObjects into the existing ScoreObject Editor and Properties surfaces through a stable identity-based target. Complete Java's second buffer bridge by allowing a copied BlueSynthBuilder instrument to be pasted onto the Score timeline as a Sound while keeping the BSB widget canvas clipboard separate. Audible Repeat, key/MIDI LiveObject triggers, and modern launcher semantics remain explicitly deferred.

## Technical Context

**Language/Version**: TypeScript 5.8.x in strict mode; React 19.x; Electron 35.7.5 with embedded Node.js 22

**Primary Dependencies**: `@blue/data` `BlueData`/`LiveData`/`LiveObject*`/`SoundObject`/`BlueSynthBuilder`/`Sound`/`CompileData`/`NoteList`/`TimeBehavior` and Java/JavaScript runtime contracts; `@blue/app` Electron main/preload/renderer layers; Radix Context Menu; existing `BlueLiveEngineSession`, `EngineBridge`, versioned `@blue/engine-client` `readScore`, unified-library transfer service, and Zustand project, Score selection, library, Blue Live, and typed BSB widget clipboard stores

**Storage**: Main-process in-memory `BlueData` remains canonical; `.blue` XML remains canonical persistence. Renderer selection, pending patches, ScoreObject clipboard entries, BSB widget clipboard entries, trigger jobs, prepared score batches, diagnostics, document-revision barriers, and Blue Live session generations are transient and are not persisted. Opaque copied/cut library Instrument payloads remain transient in the existing main-owned unified-library clipboard.

**Testing**: Vitest 4.x unit, contract, renderer, and main-process tests; existing Java Blue fixtures plus focused `.blue` XML round-trip tests; injected fake Java/JavaScript runtime clients and engine clients; `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, package builds, and `git diff --check`

**Target Platform**: Electron desktop on macOS, Windows, and Linux, preserving platform-appropriate Command/Ctrl shortcuts

**Project Type**: Desktop application plus portable data library, typed Electron boundary, external Java runtime, and external audio engine

**Performance Goals**: Native fixed-score trigger preparation completes within 100 ms for curated fixtures; at most one legacy preparation job is in flight per Blue Live session; empty, busy, invalid, or unavailable-runtime requests return a deterministic result without queuing unbounded work; stale work is rejected before engine submission

**Constraints**: Preserve Java-compatible `.blue` XML and stable LiveObject identities; keep `@blue/data` free of Electron, Node.js built-ins, DOM-only APIs, `require()`, and dynamic imports; keep Java runtime/process/ZeroMQ ownership in Electron main; do not mutate authored `TimeBehavior`; submit enabled batches atomically; do not add an engine protocol extension or a modern scheduler in this feature

**Scale/Scope**: One selected-object trigger mode, one enabled-batch trigger mode, existing sparse column-major bins and saved sets, nine Java live-eligible SoundObject families, one targeted-cell context menu, one stable Live SoundObject editor/property target, one shared ScoreObject buffer, one shared Instrument-buffer BSB conversion, one active Blue Live session, and one in-flight manual trigger job

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Portable data core**: PASS. Selection, copying, generation, validation, and note scaling remain platform-neutral in `@blue/data`. Host runtime implementations, engine submission, and Electron lifecycle remain in `@blue/app` main.
- **Java and project compatibility**: PASS. Java `BlueLiveTopComponent`, `BlueLiveBinding`, `RealtimeRenderManager`, and Blue Live model classes are the reference. Existing XML is preserved. Intentional divergences are limited to immutable preparation, all-or-nothing enabled batches, stale-work fencing, lossless retention of unresolved saved-set IDs, and deferred audible Repeat/key/MIDI behavior.
- **Canonical ownership and contracts**: PASS. Main-process `BlueData` owns project state and revision; renderer owns transient selection and queued edit intents until acknowledgement; main owns the Blue Live session generation, trigger controller, runtime clients, and engine submission. Typed request/result and commit-receipt contracts define every boundary and failure path.
- **Runtime and engine isolation**: PASS. Java/JavaScript runtime preparation is initiated by main through existing abstract data contracts, and score submission uses the existing isolated Blue Live engine session. No renderer or data code launches processes or accesses ZeroMQ.
- **Verification evidence**: PASS. The design requires Java fixture parity, aggregate deep-copy/reference tests, pure generation/scaling tests, async runtime success/failure tests, IPC validation, patch-barrier/no-op tests, lifecycle/session-fence tests, engine submission tests, renderer interaction tests, and deterministic quickstart scenarios.

## Project Structure

### Documentation (this feature)

```text
/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── blue-live-trigger-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
/Users/stevenyi/work/blue-electron/packages/blue-data/src/
├── blue-data.ts
├── index.ts
├── utilities/
│   └── score.ts
├── instruments/
│   ├── instrument-category.ts
│   └── instrument-library.ts
├── sound-objects/
│   ├── instance.ts
│   └── sound-object-library.ts
└── live/
    ├── blue-live-trigger.ts                 # new pure preparation service
    ├── blue-live-trigger.test.ts            # new Java-semantics/scaling/runtime tests
    ├── live-object.ts
    └── live-object-bins.ts

/Users/stevenyi/work/blue-electron/packages/blue-data/src/
├── blue-data-deep-copy.test.ts               # new aggregate isolation/reference tests
├── live-data.test.ts
└── live/
    └── live-object-bins.test.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/
└── project-editor.ts                         # trigger and commit acknowledgement contracts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/
├── blue-live-trigger-controller.ts           # new single-flight preparation/fence coordinator
├── blue-live-engine.ts                       # session-generation-aware prepared submission
├── main.ts                                   # canonical revision, runtime, IPC, project lifecycle
└── java-runtime/
    └── java-runtime-session.ts               # reused, changed only if trigger initialization exposes a gap

/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/
└── preload.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/
├── types/
│   └── global.d.ts
├── stores/
│   ├── project-store.ts
│   ├── score-selection-store.ts             # shared ScoreObject clipboard
│   ├── library-store.ts                     # shared Instrument clipboard metadata
│   ├── bsb-clipboard-store.ts                # remains widget-only
│   └── blue-live-store.ts
└── components/
    ├── menu-bar/
    │   └── ToolbarBlueLive.tsx
    └── workbench/panels/
        ├── blue-live/
        │   └── LiveSpaceTab.tsx
        └── score/layer-groups/
            └── ScoreTimeCanvas.tsx

/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/
├── blue-live-contract.test.ts
├── blue-live-trigger-controller.test.ts      # new main orchestration tests
├── blue-live-engine.test.ts
├── blue-live-panels.test.tsx
├── blue-live-toolbar.test.tsx
├── project-store.test.ts
├── score-clipboard.test.ts
├── score-library-drop.test.tsx
└── project-document-commit.test.ts           # new/expanded revision and no-op batch tests
```

**Structure Decision**: Keep trigger preparation in pure `@blue/data` and orchestration in the existing main-owned controller. Extend the existing Blue Live project patch with one typed nullable cell replacement so add/remove/cut/paste remain canonical project mutations and renderer optimistic state uses the same serializable cell snapshot. Reuse the Score selection store for ScoreObject exchange between Score and Blue Live. Reuse the unified-library clipboard for whole-instrument exchange and add one exact BSB-to-Score transfer target rather than introducing another Instrument clipboard. Keep the BSB canvas widget store separate. Render the menu with the already-installed Radix primitive and existing editor-menu theme classes.

## Complexity Tracking

No constitution exception is required. The one new main-process controller is justified by a demonstrated asynchronous state-fencing boundary and avoids embedding hard-to-test orchestration in `main.ts` or `BlueLiveEngineSession`.

## Phase 0 Research Output

See [/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/research.md](/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/research.md).

## Phase 1 Design Output

- [/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/data-model.md](/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/data-model.md)
- [/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/contracts/blue-live-trigger-contract.md](/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/contracts/blue-live-trigger-contract.md)
- [/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/quickstart.md](/Users/stevenyi/work/blue-electron/specs/065-blue-live-parity/quickstart.md)

## Post-Design Constitution Check

- **Portable data core**: PASS. `blue-live-trigger.ts` accepts abstract runtime/session contracts through `CompileData`; it imports no host implementation and performs no I/O.
- **Java and project compatibility**: PASS. The contract retains stable IDs, sparse bins, arbitrary enabled masks, saved-set semantics, unresolved reference text, p2/p3 scaling, and all XML fields. Research records every intentional divergence, including atomic batch failure and deferred audible Repeat.
- **Canonical ownership and contracts**: PASS. Renderer requests contain only intent and stable identity. Main enriches requests with canonical revision/session origin, controls single-flight preparation, and returns a discriminated result. Commit receipts expose whether a canonical change occurred.
- **Runtime and engine isolation**: PASS. Main acquires existing Java/JavaScript sessions and submits through the already isolated Blue Live engine client. The engine protocol remains unchanged.
- **Verification evidence**: PASS. The data model, boundary contract, and quickstart provide deterministic tests for generation, copy/reference integrity, commit barriers, lifecycle cancellation, runtime diagnostics, XML preservation, session isolation, and affected builds.

## Authoring-Parity Extension

1. Extend the Blue Live snapshot with the embedded SoundObject XML and the timing/color metadata needed to create a Score clipboard entry.
2. Add a canonical `setCell` patch accepting either a validated live-compatible SoundObject snapshot or `null`; use it for Add, Remove, Cut, and Paste.
3. Wrap each grid cell in a Radix context-menu trigger, capture its coordinates before opening, render the Java item order and enablement, and remove the fixed row/column button strip.
4. Route Blue Live Cut/Copy through `useScoreSelectionStore` and route Paste from that same store, requiring exactly one supported serialized SoundObject and assigning a fresh LiveObject identity.
5. Add optional object-type metadata to the existing unified-library clipboard, add an exact `scoreBsbSound` transfer target, convert only `BlueSynthBuilder` instruments into `Sound`, flatten copied automation, and expose the operation from the Score empty-area menu.
6. Prove the extension with focused shared-contract, renderer, clipboard, and unified-library transfer tests before rerunning the feature validation gates.

## Live SoundObject Selection Extension

1. Extend the existing ScoreObject editor target with a `blueLive` owner and a stable LiveObject identity plus row/column hints; resolve identity first so structural grid edits do not retarget the editor.
2. On populated-cell selection, publish one entry through the existing Score selection store and activate `ScoreObjectEditorTopComponent`; on empty-cell selection, clear the shared selection.
3. Reuse the existing editor-document and Score patch contracts so type-specific editor and ScoreObject Properties mutations reach the canonical SoundObject owned by the LiveObject.
4. Keep `SoundObjectPropertiesTopComponent` passive, matching Java: it consumes and edits the shared selection when visible but selection does not force-open the Properties panel.
5. Cover selection, editor activation, property population/mutation, structural movement, removal, and stale-target rejection with focused renderer and shared-contract tests.

## Completion Summary

Spec 065 is complete. The final Spec Kit analysis and convergence pass mapped all 39 functional requirements and 11 success criteria to implementation tasks and automated evidence. The review found one residual command-barrier defect: Stop incorrectly waited for pending project edits and could be blocked by a failed commit. Final convergence restricted the barrier to Start/Recompile/Trigger and added deterministic wait, rejection, and stop-bypass regressions.

Final evidence on 2026-07-31:

- 68/68 tasks and 20/20 specification checklist items complete.
- `pnpm test` passes across all workspace projects.
- `@blue/data`: 140 files and 1,349 tests pass.
- `@blue/app`: 240 files and 2,345 tests pass, with 2 intentional skips.
- `pnpm --filter @blue/data build`, `pnpm --filter @blue/app build`, and `pnpm lint` pass.
- `git diff --check` passes after completion-document updates.
