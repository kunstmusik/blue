# Implementation Plan: Resizable Layer Heights

**Branch**: `codex/110-resizable-layer-heights` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/110-resizable-layer-heights/spec.md`

## Summary

Allow Sound Layers and Track layers to resize freely from their header panel lower edge, with a synchronized local preview and one undoable commit. Reuse existing layer selection for relative multi-row drags; add absolute presets/numeric entry, reset, and project-owned group-default controls. Persist an optional integer `customHeight` alongside Java-compatible integer `heightIndex`, keeping legacy load behavior unchanged. Java save-back loses the extension; Java compatibility applies only to otherwise supported projects, because Electron TrackLayerGroup is already unsupported by the inspected Java version.

The implementation uses existing data models, typed ScorePatch contracts, structural ProjectHistory preparation, and ScorePanel composition. Two new patch variants and one shared gesture hook are sufficient. No new dependencies, engine operations, external stores, or broad canvas refactor are needed.

## Technical Context

**Language/Version**: Strict TypeScript (workspace range ^5.8); TSX for renderer; Java 25 used only for the reference probe against Java Blue 2.10.3 packaged jars.

**Primary Dependencies**: Existing React ^19.2.4, Electron 35.7.5, Zustand ^5.0.10, Radix menus, Vite ^7.3.2; `@blue/data` uses existing `@rgrove/parse-xml` ^4.2 through Element utilities. Versions are manifest declarations, not claims about latest releases. No additions.

**Storage**: Canonical BlueData in Electron main; `.blue` XML stores heightIndex, optional customHeight, and existing group defaultHeightIndex. Preview, pointer state, and selection remain disposable renderer state. Existing application creation defaults are unchanged; no new preference/sidecar/library store.

**Testing**: Existing Vitest 4.x, jsdom, browser Playwright provider; Java layer-level probe plus implementation-time whole-project compatibility exercise. Focused model/patch/history/queue/UI tests and supported-platform checks in [quickstart.md](quickstart.md).

**Target Platform**: Electron desktop on macOS, Windows, and Linux; docked and floating score panels. Data code remains browser-safe.

**Project Type**: Desktop application and portable data package in a pnpm workspace.

**Performance Goals**: 95% of preview updates visible within 50 ms with 100 visible rows; 20-target cross-group resize with one action; 30 seconds of resizing during playback without resize-induced interruption/restart.

**Constraints**: Numeric/drag edits 22–660 logical pixels, 1-pixel resolution; legacy values retain existing effective appearance; atomic target validation, exact undo/redo, no preview serialization, host-window event ownership, no silent Java compatibility claims for Track format.

**Scale/Scope**: Sound Layers and Tracks in root/nested score paths; selected and direct-group operations. Pattern sizing, fit/focus layouts, locks, custom preset libraries, multiple default profiles, and Java Track format migration remain excluded.

## Constitution Check

Initial gate assessment: the proposed feature can remain within all five principles. The initial technical questions were exact-height encoding/Java save-back, atomic bulk edits/identity, and shared preview geometry; Phase 0 resolves them in research.md. No constitutional exception was requested or used.

| Gate | Before Phase 0 | After Phase 1 design |
| --- | --- | --- |
| Portable data core | PASS — height arithmetic and XML remain in data; UI/host handling outside it. | PASS — optional numeric model state and static imports only; no Node, DOM, Electron, dynamic import, or host I/O in data production code. |
| Java and project compatibility | PASS with explicit investigation — preserve old index and unrelated data; qualify new behavior using Java evidence. | PASS — R1/R2 define fallback, untouched legacy behavior, unknown preservation, and proven Java extension loss. Spec qualified for baseline Track incompatibility. Full project/CSD verification remains required at implementation. |
| Canonical ownership and contracts | PASS — project document remains owner; preview disposable. | PASS — typed aggregate/default patches over existing preload route, expected revision plus stable identities, strict validation and rollback; no new storage location or IPC channel. |
| Project history and undo/redo | PASS — all durable writers must use canonical history. | PASS — drag/preset/numeric/reset/apply-default/default-edit and legacy wheel/setLayerHeight routes all covered. Structural preparation preserves full representations/identities. One semantic entry, no preview/no-op entry, engine unchanged. |
| Runtime and engine isolation | PASS — sizing has no musical/runtime effect. | PASS — classify new commands as cosmetic; no protocol, Java runtime, filesystem, process, or ZeroMQ feature work. |
| Host-path portability | PASS — no production path transformations needed. | PASS — XML field stores a size, not a path; validation uses native temporary paths and Windows interaction coverage. Java-only local probe is not a shipped path dependency. |
| Verification evidence | PASS — current seams support focused tests. | PASS — model/XML/copy, aggregate rejection/history, queue fences, geometry/cancellation/popup tests plus measured/manual scenarios are specified. Current planning checks do not substitute for implementation test results. |

## Project Structure

### Documentation (this feature)

```text
specs/110-resizable-layer-heights/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── layer-height-patches.md
│   └── layer-height-interactions.md
└── checklists/requirements.md
```

`tasks.md` is intentionally left to `$speckit-tasks`.

### Source Code (repository root)

Existing integration points (not all require independent changes):

```text
packages/blue-data/src/
├── score/layers/layer.ts
├── score/track/track.ts
├── score/track/track-layer-group.ts
├── sound-objects/sound-layer.ts
└── sound-objects/poly-object.ts
packages/blue-app/src/
├── shared/project-editor/
│   ├── contract.ts
│   ├── identity.ts
│   ├── snapshot-score.ts
│   └── patch-score.ts
├── main/
│   ├── project-history.ts
│   ├── project-history-memento.ts
│   └── project-runtime-reconciliation.ts
└── renderer/
    ├── components/workbench/panels/ScorePanel.tsx
    ├── components/workbench/panels/score/
    │   ├── LayerPanel.tsx
    │   ├── layer-selection-utils.ts
    │   ├── useScoreWheelZoom.ts
    │   └── layer-groups/{ScoreTimeCanvas,TrackLayerGroupCanvas}.tsx
    ├── lib/history-scope-router.ts
    └── stores/
        ├── project-store.ts
        ├── layer-selection-store.ts
        └── project-store/project-patch-queue.ts
```

**Structure Decision**: Extend existing ownership boundaries. A small data-side height-policy helper may hold bounds, presets, strict value parsing and fallback calculation used by both models; export only the policy functions actually consumed. Add `score/useLayerHeightResize.ts` for one shared preview lifecycle and `score/LayerHeightResizeHandle.tsx` for the repeated boundary affordance. Keep menu/default controls close to the existing header; extract a small contextual numeric-height dialog only if existing primitives do not already compose cleanly. Do not build a generic resize framework or move canvas internals.

Boundary review under `docs/modularization.md`: the hook owns transient gesture state and display projection; the handle owns only pointer/keyboard affordance. Both depend on leaf contracts/policy and the existing commit callback. Canonical data stays in main, selection stays in its existing store. The lowest seams are pure target/delta checks and the two-surface gesture fixture. The feature can be reverted with these additions and narrow callers; no unrelated mechanical module split is included.

## Phase 0 — Research Outcome

Resolved decisions R1–R6 in [research.md](research.md):

1. Optional customHeight with deterministic integer fallback, strict parsing, malformed-value preservation, and unchanged legacy defaults/load semantics.
2. Java layer-level fallback verified; Java strips customHeight on save. Track format compatibility is a baseline limitation, not an unresolved implementation requirement.
3. Aggregate validated ScorePatch plus default patch through existing structural history, with stable layerSelectionId and expected revision.
4. One display projection drives all row geometry; explicit pointer/capture exemptions preserve selection, routing focus, and auditioning.
5. Reuse fixed sizes, selection, and existing model defaults; add missing Electron controls. Wheel steps by numeric preset rather than index rounding.
6. Cosmetic runtime classification, hosting-document popup/pointer lifecycle, and focused existing test infrastructure.

No unresolved technical clarification remains. See research evidence limits: successful layer probes are not claims that unimplemented end-to-end behavior passes.

## Phase 1 — Implementation Design

### A. Model and XML

Implement [data-model.md](data-model.md). Add optional customHeight state and make `getLayerHeight()` prefer it. Preserve original legacy index/default behavior on load. Explicit height editing updates fallback and custom state together, removing stale opaque customHeight data; selecting the same effective size is a no-op and must not incidentally normalize stored representation. Copy and historyCopy paths retain validated and opaque height state. The SoundLayer XML boundary is in PolyObject, whereas Track serializes itself; both must be updated.

No automatic migration writes or source-version bump is necessary. Legacy absence stays absent. Invalid extension strings round-trip unmodified until an actual height change; undo restores the previous exact representation. Existing byte-sensitive fixtures remain unchanged when no custom height exists.

### B. Snapshot and document contracts

Add two variants specified in [layer-height-patches.md](contracts/layer-height-patches.md). Resolve all targets and values before mutation on the detached candidate. Throw a validation failure for invalid input rather than treating rejection as unchanged, allowing existing preparation to reject the whole batch. Mark both variants structural in SCORE_PATCH_PREPARATION_CLASS and add exhaustive classification/roundtrip fixtures. Add affected-target reporting and classify both as cosmetic in runtime reconciliation.

Expose PolyObject defaultHeightIndex alongside the existing Track field. Keep snapshot height as the authoritative effective numeric height; do not serialize preview values or replace positional layerId usages elsewhere. Require existing stable layerSelectionId for the new mutations and carry origin selection hints without substituting height targets for the user's object/layer selection.

Retain legacy updateLayerState.heightIndex compatibility, validate it before mutation, and ensure its setter clears a previous custom override when it truly changes the effective height. Route current height UI writers through the new path; do not silently create a mixed mute/solo/height patch that weakens validation. Preserve existing Track 220 support.

### C. Commit and settlement

A drag captures document identity, revision, active scope, target identities/order, and original heights. Pointermove changes only the display projection; save/history settlement cancels this active preview. On release, flush earlier queued edits, verify the captured revision/identity still matches, enqueue one isolated labeled aggregate patch with `phase: single` and a unique operationId, then flush/observe canonical completion. A changed revision cancels rather than rebasing. The queue must preserve explicit expectedRevision metadata, including when preparing submissions; do not overwrite it with a newly read revision.

Keep final display values until acknowledgement/publication. Rejected/error receipts must clear the local projection and reload canonical state using the existing queue error path. A valid unchanged response clears it without a history entry. If transport acknowledgement is uncertain, refresh canonical state before claiming rollback; a committed operation cannot be undone by just clearing a preview. Reuse operationId on an uncertain retry; no blind duplicate commit. After release, save/undo settlement awaits the already-submitted commit, whereas a still-active drag is cancelled. This distinction prevents a settlement race from hiding an accepted edit.

### D. Header interaction and score synchronization

Use the shared hook in ScorePanel before groups feed LeftPanel, LayerPanel, visible-layer geometry, and wheel handling. Shallow-copy only changed group/layer objects; retain unrelated arrays and authored content. Coalesce pointer updates with the host window's animation frame and compute every result from original heights. The small overlay in LayerPanel uses projected cumulative row bottoms and the same group offsets as the canvas, including the last row and automation modes.

The 4-pixel strip owns resize gestures; exempt marked resize targets in header selection, MIDI-focus pointerdown, and score audition-stop capture handlers. Pointer capture continues dragging outside the original strip. Use CSS client coordinates, not physical pixels/DPR. Do not automatically scroll during resizing; ignore wheel scroll/zoom during an active gesture, and cancel on external scrolling or application zoom changes. Group-size changes must not cause browser scroll anchoring to move the gesture; temporarily disable anchoring in the scroll viewport, preserve scrollTop subject to normal extent clamping, and restore anchoring afterward.

### E. Commands and defaults

Provide explicit scope menus, exact preset matching, Custom/Mixed readout, keyboard numeric entry, reset, Change Default for New Layers, and Apply Default to Group. Default change updates only the existing group default field. Apply/reset resolves defaults in main and commits all rows together. Shared selection containing a Pattern disables the full selected action, but This Layer remains available on an eligible row. Existing new-project application defaults remain untouched.

Use host-surface portals and approved typography/number controls. Bind settlement, Escape, blur, pointer capture, and popup dismissal to ownerDocument/defaultView; rebind if a floating panel changes host without remount. Expose one keyboard-reachable resize control per eligible header; context-menu invocation must not alter selection. Numeric editing is a disposable form until Apply; Enter applies and Escape/Cancel discards.

### F. Delivery validation

Use the targeted cases/commands in [quickstart.md](quickstart.md). New/updated tests must cover valid and rejected aggregate patches, no-op versus rejected receipts, stale revisions and identity changes, malformed XML preservation, exact history restoration including raw values, root/nested groups, cancellation/settlement races, final-row/automation hit testing, host-window switching, zoom, and cosmetic runtime replay.

Run affected package tests before full `pnpm test`, `pnpm lint`, and main/preload/renderer builds. Browser two-document and supported Windows interaction checks are required for the pointer/popup changes. No new production path conversion is involved. Real-engine audio continuity, whole-project Java GUI interoperability, and five-person discoverability cannot be established by unit tests alone; the quickstart defines the manual evidence to record, and implementation must report any unperformed check rather than mark it passed.

## Complexity Tracking

No constitution violations or exceptions. The intentional UI/serialization divergences and the pre-existing Java Track-format limitation are documented in spec.md and research.md. They do not authorize introducing another project owner or silently losing unrelated data.
