# Quickstart: Validate Global Project Undo and Redo

This guide describes validation after implementation. No implementation test pass is claimed by the planning artifacts.

## Prerequisites and setup

Use the repository's supported Node/pnpm environment, Chrome for the current browser-test configuration, native Blue Engine build prerequisites, and Java where the selected project requires it. Run commands from the repository root. Use disposable copies of fixtures; do not overwrite authored examples or external libraries. Record OS, CPU, RAM, Node/pnpm, build revision and engine version with results.

```sh
pnpm install --frozen-lockfile
pnpm --filter @blue/data build
pnpm --filter @blue/engine-client build
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
```

The feature's source changes are not present at plan time. Proposed new tests below are implementation deliverables; existing package commands already exist.

## Automated gates

```sh
pnpm --filter @blue/data test
pnpm --filter @blue/app test
pnpm --filter @blue/app test:browser
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
pnpm test
pnpm lint
git diff --check
```

Run these in order after the affected suites pass. Native Windows coverage is required for relink/freeze/native-path restoration. Do not substitute POSIX chmod for Windows permissions. Browser tests require the configured Chrome channel; native shortcuts and audio smoke tests below remain separate gates.

### Focused suites to extend or add

| Evidence | Existing suite or proposed new suite | Expected outcome |
| --- | --- | --- |
| History identity and isolation | New data history-copy tests; XML/serialization tests | Source, candidate and retained states have no mutable cross-aliases; IDs and internal references preserved |
| Transactions/checkpoints | New main project-history tests; project-session/project-lifecycle tests | All-or-nothing failure, exact replay, save race, eviction and oversize cancellation |
| Queue/barrier | project-patch-queue tests; new history settlement tests | No delayed edit after undo; timeout/disconnection preserves work |
| UI consistency | project-store, use-ipc-listeners, effect-editor-window, track-instrument-editor-window tests | Actual edited content refreshes, no stale snapshot/dirty reset, bounded stale handling |
| Text/local stack migration | selected-code-editor-reconfigure, blue-x7-undo, score-color-history and PianoRoll tests | One global committed action; drafts remain local; no replay echo |
| Runtime | runtime-channel-sync, runtime-parameter-sync, bsb-instrument-runtime-sync, blue-x7-runtime-sync, score-automation-runtime-sync | Negative acknowledgement is failure; generations and previews cannot overwrite newer state |
| Real browser views | New global-history browser scenario; score-canvas-popout-menus harness | Two-document selection, menus, typing and restored values |

### Seams, Canonical Owners, and Evidence Locations

| Seam | Responsibility & Files | Canonical State Owner | Test Seams & Evidence |
| --- | --- | --- | --- |
| 1. Shared Contract | `packages/blue-app/src/shared/project-history.ts` | Serializable contracts, no state | `packages/blue-app/src/shared/project-history.test.ts` |
| 2. History-Copy & Parity | `packages/blue-data/src/test-support/java-parity-fixtures.ts`, `packages/blue-data/src/blue-data.ts` | `BlueData` | `packages/blue-data/src/blue-data-history-copy.test.ts`, `blue-data-deep-copy.test.ts` |
| 3. Test Doubles | `packages/blue-app/src/main/project-history-test-support.ts`, `packages/blue-app/src/renderer/tests/global-history-test-support.ts` | Test harnesses | `packages/blue-app/src/main/project-history-test-support.test.ts` |
| 4. Coordinator & Memento | `packages/blue-app/src/main/project-history.ts`, `packages/blue-app/src/main/project-history-memento.ts` | `ProjectSession` (active doc), `ProjectHistory` (retained history) | `packages/blue-app/src/main/project-history.test.ts`, `project-history-memento.test.ts` |
| 5. Barrier & Settlement | `packages/blue-app/src/main/project-history.ts`, renderer queues | Main barrier coordinator | `packages/blue-app/src/main/project-history-settlement.test.ts`, `project-patch-queue.test.ts` |
| 6. Runtime Reconciliation | `packages/blue-app/src/main/project-runtime-reconciliation.ts` | Per-performance runtime queue & registries | `packages/blue-app/src/main/project-runtime-reconciliation.test.ts` |
| 7. Multi-Window & UI | `packages/blue-app/src/renderer/hooks/use-project-history.ts`, stores | Zustand store / view state | `packages/blue-app/src/renderer/tests/global-project-history-views.test.tsx`, browser suite |

Add an exhaustive preparation classification test for the patch contract and an audited canonical-writer inventory. For every FR-002 domain, test at least one create/update/remove or equivalent supported operation; structural domains also test referenced deletion/restoration. Include unknown XML, nested Instances, BSB dropdown presets, parameter/mixer/layer IDs, freeze state, native paths and unavailable metadata. Compare XML/CSD with the baseline and compare nonserialized identities separately. XML equality alone is insufficient.

### FR-002 Canonical-Writer Coverage Matrix

| Patch Domain | Union Member / Operation | Preparation Class | Verifying Test Scenario(s) |
| --- | --- | --- | --- |
| **Global Text** | `globalOrc` | `scalar` | `project-history-patch-classification.test.ts`, `csound-editor-history.test.tsx` |
| **Global Text** | `globalSco` | `scalar` | `project-history-patch-classification.test.ts`, `csound-editor-history.test.tsx` |
| **Global Text** | `tablesText` | `scalar` | `project-history-patch-classification.test.ts`, `csound-editor-history.test.tsx` |
| **Global Text** | `scratchPad` (`text`, `wordWrapEnabled`) | `scalar` | `project-history-patch-classification.test.ts` |
| **Properties** | `projectProperties` | `structural` | `project-history-patch-classification.test.ts`, `project-history-writer-audit.test.ts` |
| **Clojure** | `clojureProject` | `structural` | `project-history-patch-classification.test.ts` |
| **Transport** | `renderStartTime`, `renderEndTime`, `loopRendering` | `scalar` | `project-history-patch-classification.test.ts` |
| **Transport** | `tempoMap`, `tempoMapPatch`, `meterMapPatch` | `structural` | `project-history-patch-classification.test.ts`, `project-runtime-reconciliation.test.ts` |
| **Mixer** | `setMixerEnabled`, `updateExtraRenderTime` | `scalar` | `project-history-patch-classification.test.ts`, `project-runtime-reconciliation.test.ts` |
| **Mixer** | `updateChannel` (fields `level`, `volume`, `pan`, `muted`, `solo`) | `scalar` | `project-history-patch-classification.test.ts`, `project-history.test.ts`, `project-runtime-reconciliation.test.ts` |
| **Mixer** | `updateChannel` (fields `name`, `outChannel`) | `structural` | `project-history-patch-classification.test.ts` |
| **Mixer** | `renameChannelListGroup`, `addSubChannel`, `removeSubChannel` | `structural` | `project-history-patch-classification.test.ts`, `global-project-history.test.ts` |
| **Mixer** | `addEffectFromLibrary`, `addSend`, `updateSend`, `updateEffect` | `structural` | `project-history-patch-classification.test.ts`, `effect-editor-window.test.tsx` |
| **Mixer** | `removeChainEntry`, `reorderChainEntry`, `duplicateChainEntry`, `copyChainEntry`, `pasteChainEntries`, `moveChainEntryAcrossChains` | `structural` | `project-history-patch-classification.test.ts`, `global-project-history.test.ts` |
| **Orchestra** | `addInstrument`, `removeAssignment`, `duplicateAssignment`, `pasteInstrument`, `updateAssignment`, `replaceInstrument`, `convertGenericToBsb`, `updateInstrument`, `updateInstrumentComment` (all 9) | `structural` | `project-history-patch-classification.test.ts`, `project-history-writer-audit.test.ts`, `global-project-history.test.ts` |
| **Score Objects** | `addScoreObjects`, `removeScoreObjects`, `moveScoreObjects`, `setScoreObjectBackgroundColors`, `convertScoreObjectToObjectBuilder`, `convertToPolyObject`, `setSubjectiveDurationToObjective`, `updateSharedProperties`, `updateSoundObjectBehavior`, `updateTimeState`, `updateTypeSpecificEditor` | `structural` | `project-history-patch-classification.test.ts`, `global-project-history.test.ts`, `score-object-editor-contract.test.ts` |
| **Score Layers** | `addLayer`, `removeLayer`, `moveLayer`, `renameLayer`, `updateLayerState`, `moveLayerRange`, `removeLayerRanges`, `addLayerGroup`, `removeLayerGroup`, `moveLayerGroup`, `renameLayerGroup` | `structural` | `project-history-patch-classification.test.ts`, `global-project-history.test.ts` |
| **Score Markers** | `addMarker`, `removeMarker`, `updateMarker` | `structural` | `project-history-patch-classification.test.ts` |
| **Track Items** | `addTrackItem`, `removeTrackItems`, `moveTrackItems`, `resizeTrackItems` | `structural` | `project-history-patch-classification.test.ts`, `project-editor-track-items.test.ts` |
| **Track Instruments** | `createTrackInstrument`, `clearTrackInstrument`, `replaceTrackInstrument`, `updateTrackInstrument` | `structural` | `project-history-patch-classification.test.ts`, `track-instrument-editor-window.test.tsx` |
| **Audio Sources** | `replaceAudioFileSource`, `updateAudioFilePostCode` | `structural` | `project-history-patch-classification.test.ts`, `missing-audio-assets.test.ts` |
| **Note Processors** | `replaceNoteProcessorChain`, `replaceScopedNoteProcessorChain`, `replaceTrackNoteProcessorChain`, `saveNamedNoteProcessorChain`, `deleteNamedNoteProcessorChain` | `structural` | `project-history-patch-classification.test.ts`, `scoped-note-processor-chain-patch.test.ts` |
| **Patterns** | `updatePatternBeatsLength`, `updatePatternCells` | `structural` | `project-history-patch-classification.test.ts`, `patterns-layer-group-canvas.test.ts` |
| **Score Automation** | `assignAutomationToLayer`, `removeAutomationFromLayer`, `moveAutomationToLayer`, `clearLayerAutomations`, `cleanupLayerAutomation`, `selectLayerAutomation`, `setAutomationLineColor`, `setAutomationPoints`, `insertAutomationPoint`, `deleteAutomationPoint`, `moveAutomationPoint`, `setAutomationResolution`, `moveAutomationRange`, `scaleAutomationRange` (all 14) | `structural` | `project-history-patch-classification.test.ts`, `score-automation-runtime-sync.test.ts` |
| **Blue Live** | `updateOptions`, `updateTempoRepeat`, `updateLiveCodeText`, `setCellEnabled`, `setCell`, `insertRow`, `removeRow`, `insertColumn`, `removeColumn`, `captureEnabledSet`, `renameSet`, `removeSet`, `moveSet`, `applySet` (all 14) | `structural` | `project-history-patch-classification.test.ts`, `blue-live-contract.test.ts` |
| **MIDI Input** | `updateKeyMapping`, `updateVelocityMapping`, `updatePitchConstant`, `updateAmpConstant`, `updateScale` (all 5) | `structural` | `project-history-patch-classification.test.ts` |
| **Project UDO** | `add`, `remove`, `update`, `reorder`, `convertStyle` (all 5) | `structural` | `project-history-patch-classification.test.ts`, `tables-udo-contract.test.ts` |
| **Freeze Audio** | `handleFreezeScoreObjects` (freeze / unfreeze) | `structural` (direct) | `freeze-score-objects.test.ts`, `project-history-writer-audit.test.ts` |
| **Library Import** | `UnifiedLibraryProjectAdapter.commit` (insert / replace) | `structural` (direct) | `unified-library/project-adapter.test.ts`, `project-history-writer-audit.test.ts` |
| **Missing Audio** | `relinkProjectAudioPaths` | `structural` (direct / patch) | `missing-audio-assets.test.ts` |

## Native application scenarios

Prepare/build the native engine using the existing app scripts, then launch:

```sh
pnpm --filter @blue/app engine:prepare
pnpm --filter @blue/app build
pnpm --filter @blue/app start
```

1. **Mixed history (SC-001/002):** Load a disposable copy of `fixtures/smoke-test.blue`. Create the necessary score, instrument and mixer content. Perform a labeled sequence of 100 edits spanning score, committed code, automation, mixer and instruments. Record intermediate state hashes/identity lists in the test harness. Undo all and redo all. Every state matches; no duplicate/lost step. Repeat with edits alternating between main and a dedicated editor.
2. **Structural identity (FR-004):** Delete and restore a referenced instrument, a nested score object, and BSB preset/dropdown content. Check references, IDs, colors and project-authored fonts. Save/reload the restored project and compare generated CSD/project semantics with the pre-edit baseline.
3. **Visual state (US2):** Show two views of one instrument including a detached panel/dedicated editor. Edit then undo from the other window. Both show restored values immediately. Repeat for an effect and deleted/restored object. Selection remains valid; no window unexpectedly opens or focuses.
4. **Pending work (FR-005):** Delay a commit acknowledgement using an injected test adapter, edit in the second context, request Undo, then release it. The prefix settles and latest committed action is undone once. Test conflict, disconnect and 5-second timeout; all abort safely without lost drafts. Repeat with rapid commands and duplicate requests.
5. **Save checkpoint (FR-011):** Save, edit, undo (clean), redo (dirty), save again (clean). Delay a save write while committing a newer edit: save completion leaves the newer edit dirty. Undo onto the exact saved state is clean. Evict the checkpoint and create a new branch after undo; no false clean state.
6. **Text (US4):** Type continuously, pause beyond 500 ms, type again, then move a score object. Undo reverses score and the two typing groups in order. Test IME composition, selection change, project code in a popout, draft Apply/Cancel, and a search field with empty local history. Inspect that canonical refresh produces no new entry.
7. **Retention (FR-013):** Use the deterministic size estimator harness to cross 200 actions and the 64 MiB limit. Only whole oldest actions are evicted. Prepare one oversize action; Escape/backdrop/Cancel preserve history and project. Confirm resets history only for that unchanged proposal. Modify the project before confirmation and verify stale approval rejection.
8. **External resources (FR-018):** Undo/redo freeze and a project-side library insertion in disposable data. Project references restore; generated audio and the external library are not deleted/modified by replay. Relink an unavailable path including synthetic Windows path fixtures and verify restoration preserves exact strings.

Repeat menu and shortcut scenarios on macOS, Windows and Linux: Cmd+Z/Cmd+Shift+Z or Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z. Verify exactly one action in each real hosting window and ordinary draft/native-input undo. Browser emulation is not native-platform evidence.

### Cross-Platform Validation Evidence (macOS, Windows, Linux)

| Platform | Accelerator Scheme | Ownership & Routing | Test Suite / Verification Evidence |
| --- | --- | --- | --- |
| **macOS** | `Cmd+Z`, `Cmd+Shift+Z` | Application menu `accelerator` dispatches to focused `webContents`. Scope router selects `project`, `draft`, or `native-input`. | `application-menu.test.ts`, `native-menu-undo-redo.test.tsx` |
| **Windows** | `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z` | Menu commands register `Ctrl+Z` and alternate redo `Ctrl+Y`. Single physical gesture dispatched. | `application-menu.test.ts`, `native-menu-undo-redo.test.tsx` |
| **Linux** | `Ctrl+Z`, `Ctrl+Shift+Z` | Menu commands register platform-native accelerators with no competing web keymaps. | `application-menu.test.ts`, `native-menu-undo-redo.test.tsx` |
| **IME Composition** | System IME (CJK, Dead Keys) | In-flight composition pauses boundary settlement. Edits commit only on `compositionend`. | `csound-editor-history.test.tsx`, `project-history-settlement.test.ts` |
| **Detached Windows** | Dockview Popouts & Dedicated Windows | `registerHostDocument` and dedicated window context registration resolve realm-safe active element. | `native-menu-undo-redo.test.tsx`, `effect-editor-window.test.tsx`, `track-instrument-editor-window.test.tsx` |
| **Normal Playback & Blue Live** | Csound runtime IPC | Parameter synchronization uses acknowledged generation-fenced queues. Reversal invalidates obsolete bindings. | `project-runtime-reconciliation.test.ts`, `engine-bridge.test.ts`, `global-history-engine.integration.test.ts` |
| **Paths & External Resources** | Windows drive (`C:\`), UNC (`\\server\`), POSIX | Exact path strings preserved without normalization; generated wave files and external SQLite databases not deleted on replay. | `missing-audio-assets.test.ts`, `freeze-score-objects.test.ts`, `example-library/path-boundary.test.ts` |
| **Failure Recovery** | Barrier timeout (5s), transport drop | Unresponsive participant aborts barrier cleanly; unacknowledged edits convert to retained drafts with zero data loss. | `project-history-settlement.test.ts`, `project-patch-queue.test.ts`, `global-project-history-drafts.test.tsx` |

## Engine scenarios

Use `fixtures/blue-x7-pop-song.blue` for BlueX7 and a disposable smoke project with a sustained instrument, mixer channel, effect numeric parameter and automation line. Run each case in normal playback and separately in Blue Live; where simultaneous operation is supported, test different compiled binding layouts together. Otherwise inject two independent performance adapters to verify isolation.

- Change and undo mixer level, BSB values/preset, BlueX7 fixed/complete voice, numeric effect parameter and automation points. Verify engine readback where supported plus audible change, positive acknowledgement and current revision status.
- Remove/replace an instrument/effect or alter code, then undo. UI says restart required; playback continues. Restart and compare generated CSD/current values against the restored document. Restored IDs alone must not reauthorize obsolete bindings.
- Inject rejection, missing client and delayed acknowledgement. Document/history remain restored; status is failed, not applied. Retry uses latest canonical desired values. Stop/restart while an old channel or automation timer is pending; it cannot write into the new performance.
- Delay a gesture preview until after Undo. Closed-gesture preview is rejected or completed before reversal; audible/readback final value is restored, not the late preview value.
- Simulate a timeout with an operation that later reaches the engine. The affected queue remains failed/invalidated until drained or generation stopped; no false newer success. Verify one performance's success does not conceal another's failure.

See [runtime contract](contracts/runtime-reconciliation.md) for classification and acknowledgement rules. Engine success is never inferred merely from a knob redraw or resolved unacknowledged helper.

## Performance evidence

Reference machine: the current maintainer macOS development machine running a production build with native engine; record exact hardware/OS in the result so subsequent comparisons use the same machine. Other platforms run correctness smoke tests and report timing separately.

Workloads: `fixtures/smoke-test.blue`, `fixtures/blue-x7-pop-song.blue`, and a deterministic large project produced by extending the existing `packages/blue-data/tests/integration/performance-benchmark.test.ts` 100-clip generator to 1,000 clips with fixed IDs. Add 32 instrument assignments and 128 automation parameters in that generated workload. Keep the 100-action retention scenario below its byte limit. Use a separate oversized project for retention testing.

After five warmup actions, measure 100 ordinary score moves/mixer changes per workload. Timestamp physical command receipt through the next painted canonical view in all affected windows, excluding trials with pre-existing pending work; report p50/p95/max. SC-003 requires p95 ≤200 ms. Measure command receipt to positive live acknowledgement for 100 supported single-parameter reversals on a responsive engine; SC-004 requires p95 ≤250 ms. Also report status-render latency ≤1 second from failure/restart determination, retained accounted bytes, and actual heap delta after repeat runs.

Do not waive failed targets by reclassifying ordinary edits as structural. Investigate full-graph copying/refresh or queue overhead. Large structural operations report separate latency and visible pending behavior; exact restoration remains mandatory.

## Handoff evidence

Attach package/build/lint results, the per-domain coverage matrix, native OS checks, identity/XML/CSD comparisons, engine outcome cases, and reference timing/heap measurements to implementation review. Record any unavailable runtime/environment with the exact unexecuted scenario; absence of environment is not a passed check.

## Implementation evidence (recorded 2026-09-08, branch `codex/103-global-undo-redo`)

Environment: macOS (arm64, Darwin 23.2.0), repository workspace pnpm; native engine protocol client; browser tests on the configured Chromium channel.

### Package, build, and lint gates — all passing

| Gate | Result |
| --- | --- |
| `pnpm --filter @blue/data test` | 183 files, 1809 passed, 1 skipped |
| `pnpm --filter @blue/app test` | 456 files, 4508 passed, 2 skipped |
| Browser suite (`vitest.browser.config.ts`) | 13 files passed |
| `pnpm --filter @blue/data build` (ESM + CJS) | success |
| `pnpm --filter @blue/engine-client build` | success |
| `pnpm --filter @blue/app build:main` / `build:preload` | 0 type errors |
| `pnpm --filter @blue/app build:renderer` | success |
| Repository-wide `pnpm test` | exit 0 (all packages) |
| `pnpm lint` | clean (Prettier gate passing) |
| `git diff --check` | clean |

One transient unhandled-rejection failure was observed in a single parallel `pnpm test` run of `@blue/app` (all 456 files passed in that run; the error did not identify a failing test) and did not reproduce across two subsequent full runs, including the repository-wide gate above.

### Per-domain coverage

- Canonical-writer coverage matrix: implemented as compile-time-exhaustive preparation tables in `packages/blue-app/src/shared/project-editor/contract.ts` (`*_PATCH_PREPARATION_CLASS`), enumerated end-to-end by `project-history-patch-classification.test.ts` (18 tests) and the writer audit in `project-history-writer-audit.test.ts`. Every `ProjectDocumentPatch` member maps to scalar/structural preparation; unexpected keys reject at the preparation boundary.
- History identity/XML/CSD: `blue-data-history-copy.test.ts`, `blue-data-deep-copy.test.ts`, `blue-data-csd-parity.test.ts`, `tests/integration/global-history-roundtrip.test.ts`, `tests/integration/global-history-runtime-artifacts.test.ts` — no mutable cross-aliases, IDs preserved, undo regenerates the pre-edit CSD byte-for-byte.
- Transactions/checkpoints/barrier: `project-history.test.ts` (26+ tests incl. retention 200/64 MiB, oversize tokens, dedup conflict detection), `project-history-settlement.test.ts` (12), `project-history-memento.test.ts`, lifecycle/session/replacement suites.
- Views/drafts/selection: `project-store.test.ts`, `use-ipc-listeners.test.tsx`, `global-project-history-drafts.test.tsx`, `global-project-history-views.test.tsx`, `global-project-history.browser.test.tsx`, effect/track editor window tests.
- Text/menu scope: `csound-editor-history.test.tsx` (typing grouping, IME boundaries, scope isolation, selection clamping), `native-menu-undo-redo.test.tsx`, `application-menu.test.ts`, `history-scope-router.ts`.
- Runtime outcomes: `project-runtime-reconciliation.test.ts` (26 tests — capability matrix, negative ack, transport error, timeout with late completion, fenced queue recovery, partial success, topology invalidation memory, generation isolation), `runtime-channel-sync.test.ts` (distinguishable skipped/failed/applied outcomes), `global-history-engine.integration.test.ts` (engine-client protocol readback).

### Runtime-outcome status

Outcomes (pending/applied/restart-required/failed) are produced per performance by the coordinator with precedence failed > restart-required > pending > applied, and published through `PROJECT_RUNTIME_OUTCOME_CHANNEL`; live preview/replay handlers route through the acknowledged generation-fenced coordinator. Stop-playback scenarios and readback use the engine-client protocol channel store; audible-acoustic verification on real hardware was not executed in this environment and remains a manual native-platform step.

### Native-platform status

macOS executed. Windows and Linux native menu, path (real `C:\`/UNC permissions), and audio smoke scenarios were NOT executed in this environment and remain open manual gates per the checklist above; synthetic Windows path coverage exists in `example-library/path-boundary.test.ts`, `missing-audio-assets.test.ts`, and `freeze-score-objects.test.ts`.

### Performance measurements (coordinator-level, this machine)

100 mixed actions on the deterministic 1,000-clip / 32-assignment / 128-parameter workload, 5 warmups, via `global-project-history.performance.test.ts`:

- Commit: p50 0.02 ms, p95 0.15 ms, max 0.81 ms
- Undo: p50 0.01 ms, p95 0.04 ms, max 0.35 ms
- Redo: p50 0.01 ms, p95 0.04 ms, max 0.26 ms

SC-003 (p95 ≤ 200 ms) and SC-004 (p95 ≤ 250 ms) headroom is large at the history-coordinator level; end-to-end painted-view latency and acoustic readback on production builds remain the manual native gate described above.
