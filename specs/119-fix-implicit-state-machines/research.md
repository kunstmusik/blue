# Research: Lifecycle and Gesture Reliability

**Date**: 2026-11-08

**Inspected application revision**: `5a19acc3cd0d87581d93da5a6e7ba8f9562232f6` (the added architecture guidance follows `8c88872e`; application behavior is unchanged).

Research used the current tracked spec, application sources, installed package sources, existing tests, and Java behavioral references. All decisions below are resolved for planning. Baseline test results are distinguished from future acceptance.

## R1 — Modal and event containment

**Decision**: Guard the existing workspace bubble listener with `defaultPrevented`, host-document active-modal detection, and target popup ancestry. Keep active gesture Escape in capture phase.

**Evidence**: `packages/blue-app/src/renderer/hooks/use-keyboard-shortcuts.ts` currently checks text editing but not modal state or already-handled events. `components/dialogs/use-dialog-focus.ts` registers a later host-window bubble listener for Escape from child controls; checking only `defaultPrevented` cannot resolve that ordering. `utils/cross-realm-dom.ts` already provides structural target inspection and popup ancestry. `SelectedCodeEditor` has non-modal `role=dialog` help, so only `[aria-modal="true"], [role="alertdialog"]` is a document-wide modal test.

**Rationale**: The DOM owns modal/event containment; a global ActiveModal state would duplicate ownership and interfere with nested dialogs. Existing text exclusions, toolbar Space transport behavior, native accelerators, and main-window-only global transport routing stay as they are.

**Alternatives considered**: Blocking all buttons breaks toolbar-to-transport use. Blocking every visible dialog blocks unrelated non-modal help. Adding only another bubble listener runs too late.

## R2 — Gesture mutation inventory and chosen ownership

Paths in this table are relative to `packages/blue-app/src/renderer/components/workbench/panels/` unless stated otherwise. “Projection” means renderer presentation state, not canonical project content.

| Site                                                              | Verified current behavior                                                                                                                             | Chosen design                                                                                                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `score/layer-groups/ScoreTimeCanvas.tsx`                          | Marquee/move/left-right resize; move/resize also call shared renderer score helpers that set dirty; release resize loops mark each object end         | Transient selection/session projection for all visual move/resize, no shared score/dirty writes; group final multi-target patches once      |
| `score/layer-groups/TrackLayerGroupCanvas.tsx`                    | Marquee/move/resize/fades/file-start; move/resize dirty shared projection, fades/slides use local pending maps; release lacks coherent group metadata | Same transient timing/destination projection; retain audio previews; group release and clear every pending map on terminal                  |
| `score/layer-groups/PatternsLayerGroupCanvas.tsx`                 | Local paint map and one release patch/flush                                                                                                           | Keep local preview; active host listeners, cancel, and awaited settlement                                                                   |
| `ScorePanel.tsx` background                                       | Local marquee and selection; capture listeners use global window                                                                                      | Host capture listeners; transient selection baseline; no project history entry                                                              |
| `score-object/editors/pianoroll/PianoRollCanvas.tsx` and listener | Local note previews, release commits; MOVE and SELECTING both autoscroll; canvas movement plus global release                                         | One active host move stream, separate hover cursor, explicit commit/cancel/dispose; coordinates retained for both autoscroll modes          |
| `score-object/editors/pianoroll/FieldEditor.tsx`                  | Local field draft until release                                                                                                                       | Keep draft; active host listeners and one final commit/settlement                                                                           |
| `shared/line-editor/EditableLineCanvas.tsx`                       | Inserts and invokes onLinesChange on every movement                                                                                                   | Local draft including insertion; unchanged callback shape, one final publication                                                            |
| `score-object/editors/jmask/TableEditor.tsx`                      | Inserts and invokes onChange while dragging                                                                                                           | Local draft; one final publication through existing adapter chain                                                                           |
| `orchestra/bsb/widgets/WidgetWrapper.tsx`, including ResizeHandle | Live begin/update/end patches; permanent mount-time listeners; blur/closure settles                                                                   | Active-only host listeners/settlement; retain live patches; grouped Escape cancellation including optimistic baseline restoration           |
| `score/useScoreRulerSelection.ts`                                 | Canonical render-range patches during movement; transport click at release                                                                            | Live grouped gesture; click is single; cancel restores history baseline                                                                     |
| `score/MarkersBar.tsx`                                            | Marker/render-start live patches; shift-press inserts marker before drag                                                                              | Begin before press-time mutation; include insertion in one group; carry originating host through MarkerWidget callback                      |
| `score/TempoLineView.tsx`                                         | Point movement invokes canonical onTempoPatch; movement is SVG-local, release global; empty-space insertion is a standalone action                    | Host move/release for existing-point drag; metadata through ColumnHeader and ScorePanel; preserve standalone insertion behavior             |
| `score/automation/AutomationLayerOverlay.tsx`                     | Point move is live canonical; insertion begins point move; rangeMove/rangeScale/valueShift are local previews; rangeCreate is selection               | Live point grouping includes insertion; retain local range previews and single final commit; metadata through both score/audio canvases     |
| `orchestra/SplitPane.tsx`                                         | Drag changes local size and schedules persisted layout after 150ms; pointercancel currently settles                                                   | Drag-local size, persist once at successful release; cancel size/ratio/save timer and restore host body styles; retain keyboard persistence |
| `orchestra/ArrangementPanel.tsx`                                  | Column sizing is local, global document listeners, no unmount cleanup                                                                                 | Active host listeners/disposer, restore previous size entry and body styles; do not add persistence                                         |

**Decision**: Add a small shared host-listener/disposer helper for these repeated event lifetimes; keep all semantic state and commit policy in each owner. Use current `useLayerHeightResize` and host-surface conventions as local patterns.

**Rationale**: Canonical and optimistic state must both be correct. `project-store.moveScoreObjects/resizeScoreObjects` currently modify the shared renderer snapshot and dirty flag during a preview; `refreshCanonicalSnapshot` is not a safe cancellation primitive because it preserves dirty state and does not fence the response against the original session. A transient projection composes safely with canonical updates and existing layer-height projection, including cross-group destinations.

**Alternatives considered**: A full captured-score restore overwrites unrelated pending edits; a universal gesture FSM duplicates domain geometry/history; merely changing window bindings leaves cancellation and grouping broken.

## R3 — Local editor drafts and actual callback consumers

**Decision**: Shared line/table components retain one-argument callbacks, publish one final draft, and receive a stable target identity (prop/key where the current owner lacks one). Invalidate drafts on actual target/source replacement, not every unrelated project revision.

`EditableLineCanvas` consumers are `LineObjectEditor.patchLines`, `ZakLineObjectEditor.patchLines`, `SoundEditor`'s automation panel, and `BSBLineObjectWidget.commitLines`. All are project-backed. Add final labels/phase single at the existing owning callbacks. Only Sound needs a narrow optional third metadata argument from its private automation-panel callback to `SoundEditor.handleAutomationPatch`.

JMask's chain is `TableEditor → generator/modifier/probability adapter → ParameterRow.updateParameter → JMaskEditor.handleFieldChange → ScoreObjectEditorPanel.handlePatch → applyProjectDocumentPatch`. A local table draft avoids live-phase plumbing through every adapter; label the final owning field change.

`PianoRollEditor.commitUndoablePatch` already reaches a metadata-capable patch wrapper but currently omits metadata and also pushes legacy local snapshots. Supply semantic labels through the canonical wrapper; do not treat that legacy local stack as undo/redo acceptance, or remove unrelated legacy state in this feature.

**Rationale**: One final canonical edit preserves existing callback compatibility and bounds history work. Local canvas redraw/hit-testing uses the draft so feedback remains continuous.

**Alternatives considered**: Threading live begin/update/cancel through every JMask/line adapter is unnecessary. Mounting by changing document revision would destroy a valid draft on unrelated updates.

## R4 — Project history terminals, grouping, and rollback

**Evidence**: `shared/project-history.ts` already has label/gestureId/phase/revision/origin contracts and typed `commitProjectHistory`. `project-store.applyProjectDocumentPatch` drops empty normalized patches. `main/project-history.ts` handles cancel before patch preparation, supports scalar/structural/mixed rollback, but returns unchanged transactions before end-phase group closure. New live grouping cannot rely on sending the final unchanged value twice. Begin also truncates redo before the gesture can be cancelled.

**Decision**: Keep existing FIFO queue and main coordinator. Correct matching unchanged/metadata-only end behavior and preserve pre-gesture redo history for cancellation. Provide a narrow renderer terminal operation that first flushes queued updates, revalidates document/session and current gesture authority, then submits the existing typed history commit envelope with no patches. Use monotonic context sequence, current revision, and existing receipt/reconciliation handling. Empty `{}` through the document-patch façade is not a terminal operation.

For BSB optimistic baseline restoration, synchronously enqueue captured baseline widget patches with the same gesture ID: earlier patches update, exactly one final patch cancel. Then await flush. Main cancels the whole matching group, not one widget at a time. Before the first queue flush, begin+cancel can merge and no canonical group exists; the renderer still requires its baseline reset. Never enqueue further update/end after cancellation.

Retain a single shared-reference cancellation checkpoint for an active group so cancelling can restore its prior redo branch and otherwise-evicted baseline entries as well as canonical content. Keep the chronological ledger at its existing action limit, and treat its one active rollback checkpoint as bounded transient rollback state rather than an additional published action. Count all unique retained bytes, including checkpoint references, against the byte budget before first mutation and each growth. A small gesture at the normal 200-action capacity must still work and restore that ledger on cancel. If the baseline plus new group cannot fit, reject before mutation or cancel the open group and surface existing oversize/failure handling. Near the full byte budget this can reject a live gesture that a one-shot edit could accommodate after eviction; references do not remove that tradeoff. Existing explicit history-reset agreement is a separate operation and does not revive an old drag. Close/discard the checkpoint on successful settlement or an intervening authoritative action. No per-update memento/redo accumulation or blanket undo-stack rewrite.

**Rationale**: Release is a protocol event even if its value is unchanged. History receipts and project-session fences, not void UI callbacks, establish settlement completion. Distinguish preview first publication (single, or begin/update/end) from release of an existing live group (updates plus end). Net-zero live groups must be removed at finalization and restore dirty/redo baseline; a repeated final value closing a genuinely changed group is a separate case. Cancellation only owns the matching active tail; settled/superseded gestures lose cancellation authority.

A further concrete runtime gap is in computeStructuralInversePatches: automation score patches currently fall back to orchestra.structuralChange. Forward point patches are classified as live by project-runtime-reconciliation, but that generic inverse requires restart and leaves the edited automation in the running engine. Add original-group baseline setAutomationPoints inverses, plus setAutomationResolution when needed, per affected parameter. Test actual inverse/forward engine payloads after cancel, Undo and Redo, not only status labels.

**Alternatives considered**: Repeated phase end per selected object creates several actions. Empty document patches are discarded. Direct baseline mutations bypass history; full snapshot rollback overwrites unrelated work. Replacing the transaction queue with an FSM is out of scope.

## R5 — JVM readiness, cancellation, and process cleanup

**Decision**: Keep `JavaRuntimeSessionManager` as sole owner, with process state separate from active-session readiness. Snapshot request inputs before waiting, serialize the full check/initialize/publication sequence, and recheck cache/epoch under that ownership. Same-key calls share successful readiness; different keys run in order. Record dependencies before requesting initialization; individual dependency failures returned in `dependenciesLoaded` are not automatically top-level init failures.

Fence after cleanup, Java probe, process creation, connect, health, init, and explicit Jython reinitialization. A current constructor failure owns a process even if no client was created. Failure cleanup may clear manager state only for its captured handle. Production process creation observes cancellation after asynchronous port reservations and before actual spawn; late returned handles still have immediate cleanup. Close the spawn/adoption gap by requiring the factory to synchronously register each produced handle through onSpawned before promise resolution; manager disposal then observes and awaits that handle's bounded cleanup even before the awaiting initializer resumes. Genuinely unspawned cancelled reservations need not delay disposal.

Explicit `JavaRuntimeClient.disconnect` invalidates pending queued operations so they cannot recreate a socket via ensureRequestSocket. Normal transport-error reset stays recoverable; only explicit disconnect closes that connection lifetime. An old generation's catch/reset path must not close a newer reconnected socket. Shutdown uses the same request queue as init, so it cannot precede termination during disposal.

`java-runtime-process.ts` currently treats `child.killed` as evidence of exit. Installed Node declarations state that it means a signal was sent. A successful SIGTERM therefore suppresses the current fallback even if the child ignores it; the existing fake does not model that flag correctly. Termination must observe exit, send SIGTERM immediately, escalate after the existing two-second grace, and allow one second for force-exit confirmation. Awaited deadline timers remain referenced. Return an internal exited/not-started/failed result; manager disposal rejects cleanup failure rather than reporting success. Production cancellation prevents new helper spawn after disposal while reservation is pending.

**Rationale**: A union without ordering/authority checks cannot prevent races. Immediate signal delivery can coexist with bounded exit confirmation and never depends on resolving script initialization.

**Alternatives considered**: One-time pendingReady wait races with three callers; killing the global current process from stale failure cleanup kills the wrong helper; waiting for queued shutdown can stall; an unref'd force timer can disappear at application exit.

## R6 — Renderer playback transitions and stable projections

**Decision**: Put mutually exclusive lifecycle phase/mode/anchor/confirmation data in an internal union, with pure transition/projection functions and atomic compatibility fields. Keep clocks, display, saved/active follow preferences, cadence, and latency outside it. Preserve the store's existing methods, including setPlaying, by translating their meaning into coherent transitions.

The installed Zustand `vanilla.js` performs shallow merge via Object.assign; state getters become materialized values. Use explicit projections, not accessors. Reuse a frozen idle display object; no lifecycle work on tickDisplay. Accept early starting clocks, preserve them on playing confirmation, reject clocks while terminal and older/retired session IDs. EngineBridge already increments playbackSessionId and emits an initial clock before playing; retain that authority and avoid new IPC fields.

Track a local attempt token so old start replies/errors cannot settle a new start. Apply follow-on-start at the first current normal-start confirmation (status or reply), once per attempt; duplicate status/loop/display updates do not repeat it. Local stop preserves prior confirmation; host stopping remains authoritative evidence that playback ran. Partial mode/anchor updates retain omitted values; explicit stop still clears audition indication.

**Alternatives considered**: Putting clock/display in the union adds display-cadence churn; independent status/boolean writes recreate invalid combinations; only checking current phase permits an old reply to settle a newer starting attempt.

## Java Behavior and Provenance

Java Blue remote: `https://github.com/kunstmusik/blue`. Inspected checkout revision: `3ca3f40579c48a023299a68130d8ab6b9e950974`. Selected references were read as behavioral evidence; no source is incorporated or translated.

| Source at that revision                                                                                                          | Evidence retained                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `blue-ui-core/src/main/java/blue/soundObject/editor/pianoRoll/NoteCanvasMouseListener.java`                                      | Baseline/end-value edit on release; dragging invokes viewport scrolling outside field-edit mode |
| `blue-ui-core/src/main/java/blue/soundObject/editor/pianoRoll/FieldEditorMouseListener.java`                                     | Baseline-relative selected-note edits, clamps, one release-time field edit                      |
| `blue-ui-core/src/main/java/blue/components/LineCanvas.java`                                                                     | Neighbor/bound constraints and linked endpoints                                                 |
| `blue-ui-core/src/main/java/blue/soundObject/editor/jmask/TableCanvas.java`                                                      | Press-time insertion and min/max/neighbor drag constraints                                      |
| `blue-ui-core/src/main/java/blue/ui/core/score/ScoreTopComponent.java`                                                           | Root rendering-only playhead following and follow-on-start action                               |
| `blue-clojure/src/main/java/blue/clojure/BlueClojureEngine.java` (last file revision `fa647c6377c841e5055b91505b02b3ad1d0527b3`) | Persistent project engine and deliberate namespace replacement on reinitialize                  |
| `blue-core/src/main/java/blue/scripting/PythonProxy.java` (last file revision `c6c56130ebda169884cdbc756033c8276f32562d`)        | Lazy interpreter initialization and deliberate reinitialization                                 |

The current repository helper's `JeroMqRuntimeServer` installs a project session before loading dependencies and initializing Jython; `ClojureLibraryLoader` may partially load dependencies and returns per-dependency failures. Preserve that distinction and independent Clojure/Jython reinitialization.

Java UI/Clojure reference headers are GPL-2.0-or-later; the app destination is GPL-3.0-or-later. The separate repository Java helper is EPL-2.0 with bundled dependency notices. This feature uses original TypeScript and documentation within the app/repository scope. No Java helper modifications, copied/translated source, third-party material, assets, dependency changes, or notice/inventory changes are planned. Escape/focus-loss policies and local-draft publication are explicit application interaction decisions, not claims of identical Swing handling. No serialization changes mean loader/writer history research and fixtures are not applicable to this scope.

### Post-Implementation Reconciliation & Provenance Assessment

- **Original Code & Provenance**: All implemented code (in `host-gesture.ts`, `use-keyboard-shortcuts.ts`, `playback-store.ts`, `project-history.ts`, `java-runtime/*`, and panel/canvas adapters) is original TypeScript written for `@blue/app` under its GPL-3.0-or-later scope. No source code was copied or translated from Java Blue or external projects.
- **Java Parity**: Preserved musical and editing semantics for PianoRoll note and field editing, line constraints, JMask table editing, score follow-on-start, and Java runtime session/Clojure/Jython lifecycle behavior.
- **Marker/tempo target invalidation**: At Java revision `3ca3f40579c48a023299a68130d8ab6b9e950974`, `blue-ui-core/src/main/java/blue/ui/core/score/MarkersBar.java` drags a captured marker object, while `blue-ui-core/src/main/java/blue/ui/core/score/tempo/TempoEditor.java` addresses a selected point by index. The TypeScript multi-view path carries transient app-side snapshot identities through existing history copies and creation patches, rejecting even an identically valued replacement while preserving unrelated edits. The identities do not enter XML or `@blue/data`. This is original TypeScript behavior, with no Java source incorporated.
- **Serialization & Dependencies**: Confirmed that zero changes were made to `.blue` project XML serialization, standalone resource formats, app settings schema, or `package.json` dependencies. No migrations are needed or introduced.

## Baseline Evidence and Remaining Acceptance

Executed against the inspected worktree:

```sh
pnpm --filter @blue/app test src/main/java-runtime/java-runtime-session.test.ts src/main/java-runtime/java-runtime-client.test.ts src/main/java-runtime/java-runtime-process.test.ts
```

Result: **3 files, 18 tests passed**. A complementary playback-store/BSB-undo/main-history run passed **3 files, 76 tests** after building the clean worktree `@blue/data` entry point; its first run had an unresolved-package setup error. These existing tests do not prove the proposed lifecycle fixes. Relevant new regression cases and manual/platform evidence are prescribed in [quickstart.md](quickstart.md). No implementation, speed acceptance, or all-platform acceptance is claimed by planning.

## Convergence refinements (T054/T055)

BSB root/widget incarnation identifiers extend the existing app-side identity maps and snapshot contract. They distinguish replacements with reused serialized IDs and survive history copies without entering XML or changing `@blue/data`. The owning editor supplies one context-based capture/check seam to existing wrappers, avoiding a prop change across every widget family. Both move and resize check the captured owner before input, frames and terminal work; invalidated work is discarded. The implementation is original GPL-3.0-or-later app code; no copied third-party code, dependency, asset or license-scope change is involved.

Competing live groups retain separate baselines: prospective admission captures the current ledger/document, budgets against the successor checkpoint, and retires the former checkpoint only on admission. Tests reproduce lost retained entries at limits 3 and 200, including stale terminals, Undo/Redo, stable identities, dirty state, concrete inverse payloads and successor byte admission.
