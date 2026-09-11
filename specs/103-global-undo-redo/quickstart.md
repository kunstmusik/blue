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
| Text/local stack migration | selected-code-editor-reconfigure, blue-x7-undo, score-color-actions and PianoRoll tests | One global committed action; drafts remain local; no replay echo |
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
- Remove/replace an instrument/effect or alter code, then undo. Playback continues without a restart toast or persistent status strip. Restart using the existing controls and compare generated CSD/current values against the restored document. Restored IDs alone must not reauthorize obsolete bindings.
- Inject rejection, missing client and delayed acknowledgement. Document/history remain restored; status is failed, not applied. Retry uses latest canonical desired values. Stop/restart while an old channel or automation timer is pending; it cannot write into the new performance.
- Delay a gesture preview until after Undo. Closed-gesture preview is rejected or completed before reversal; audible/readback final value is restored, not the late preview value.
- Simulate a timeout with an operation that later reaches the engine. The affected queue remains failed/invalidated until drained or generation stopped; no false newer success. Verify one performance's success does not conceal another's failure.

See [runtime contract](contracts/runtime-reconciliation.md) for classification and acknowledgement rules. Engine success is never inferred merely from a knob redraw or resolved unacknowledged helper.

## Performance evidence

Reference machine: the current maintainer macOS development machine running a production build with native engine; record exact hardware/OS in the result so subsequent comparisons use the same machine. Other platforms run correctness smoke tests and report timing separately.

Workloads: `fixtures/smoke-test.blue`, `fixtures/blue-x7-pop-song.blue`, and a deterministic large project produced by extending the existing `packages/blue-data/tests/integration/performance-benchmark.test.ts` 100-clip generator to 1,000 clips with fixed IDs. Add 32 instrument assignments and 128 automation parameters in that generated workload. Keep the 100-action retention scenario below its byte limit. Use a separate oversized project for retention testing.

After five warmup actions, measure 100 ordinary score moves/mixer changes per workload. Timestamp physical command receipt through the next painted canonical view in all affected windows, excluding trials with pre-existing pending work; report p50/p95/max. SC-003 requires p95 ≤200 ms. Measure command receipt to positive live acknowledgement for 100 supported single-parameter reversals on a responsive engine; SC-004 requires p95 ≤250 ms. Also report error-render latency ≤1 second from failure determination, retained accounted bytes, and actual heap delta after repeat runs. Routine restart-required notifications are intentionally absent following manual-testing feedback.

Do not waive failed targets by reclassifying ordinary edits as structural. Investigate full-graph copying/refresh or queue overhead. Large structural operations report separate latency and visible pending behavior; exact restoration remains mandatory.

## Handoff evidence

### Manual checklist for T085

Manual-feedback revision (2026-09-09): removed the persistent history-usage and runtime-status strips and suppressed routine restart-required toasts. Internal retention/runtime tracking, oversize confirmation, and genuine error toasts remain. Validation after this change: app 457 test files / 4,544 passed / 2 skipped; renderer build, repository lint, and whitespace checks passed. Earlier evidence describing the removed strips is historical, not an instruction to restore them.

Use a disposable project copy and the built application, not only Vitest. Record OS, app revision, project, actions, expected/actual result, and any console error for each scenario. macOS results satisfy only the macOS portion; Windows/Linux need their own runs.

1. Open a workbench editor, a detached panel, and a dedicated effect or track-instrument editor. Alternate edits between them, undo/redo from each, and check canonical values, dirty state, valid selections, and no unexpected focus change. Deleting/restoring a target must update surviving views without reopening closed windows.
2. Type in one editor and immediately undo from another while its debounce is pending. Repeat during IME composition. The pending edit must settle before reversal or produce an explicit retained-draft failure; it must not reappear after a delay. Repeat with rapid undo/redo and a dedicated editor.
3. Test Cmd+Z/Cmd+Shift+Z on macOS and Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z on Windows/Linux. One press must reverse one action. A search field or unapplied draft must undo locally, without changing the project.
4. During timeline playback, change then undo/redo a live-supported mixer/BSB/effect value. Confirm the audible reversal, not just the control redraw. Repeat in Blue Live. With playback stopped, edit/undo, then start and confirm the restored value is used.
5. During playback, make a compilation-dependent code/instrument/effect change and undo/redo it. Playback must continue without the removed strips or restart toasts. Stop/start or recompile using the existing controls; generated CSD and playback must reflect the current canonical document.
6. Save, edit, undo to the saved state (clean), redo (dirty), close an editor, and restart playback; history must survive. Open a different project; old edits must not affect it. Repeat freeze/relink restoration with disposable files on each native platform; undo must not delete generated audio.

These manual results are useful acceptance evidence, but do not alone finish T085: its production-listener/real-document automated coverage, versioned-client engine readback, and injected rejection/timeout/late-result cases remain engineering work. Do not induce failures by modifying important projects or terminating unrelated processes.

### Measuring T087

T087 is an instrumented performance gate, not a subjective responsiveness check. The coordinator benchmark reports history retention and heap evidence. The older browser and runtime measurements are retained as component benchmarks; they use test seams and are not sufficient end-to-end acceptance evidence by themselves. T116 adds the production boundary measurements below.

Use the reference workloads above, five warmups, then 100 measured actions. The historical component-only browser benchmark logs `[T087 component browser benchmark]`. For the production browser boundary, run `pnpm --filter @blue/app exec vitest --config vitest.browser.config.ts --run src/renderer/browser/global-project-history.browser.test.tsx --reporter=verbose`; it mounts the production IPC listener and Project Properties panel, routes native-menu Undo/Redo through the project patch queue and history barrier, checks two renderer views after two paints, and injects a runtime failure through the production outcome listener. For the running-engine boundary, run `BLUE_RUN_REAL_ENGINE=1 pnpm --filter @blue/app exec vitest run src/main/global-history-engine.integration.test.ts --reporter=verbose`; it uses real ProjectHistory commit/undo/redo calls with separate timeline and Blue Live sessions and positive set/get readback polling. For the packaged native-menu boundary, run `pnpm --filter @blue/app verify:global-history` (pass `--binary` or set `BLUE_ELECTRON_BINARY` when the packaged app is elsewhere). Correlate each command with its canonical revision and record command receipt, paint completion in every affected window, and positive engine acknowledgement. Report p50/p95/max: painted restoration p95 ≤200 ms; live acknowledgement p95 ≤250 ms. Measure genuine error determination-to-visible-error within one second, retained bytes, and heap delta. Do not time only the IPC Promise, knob change, or main coordinator; those omit required boundaries. A screen recording can help diagnose slow UI updates but cannot prove positive engine acknowledgement.

Attach package/build/lint results, the per-domain coverage matrix, native OS checks, identity/XML/CSD comparisons, engine outcome cases, and reference timing/heap measurements to implementation review. Record any unavailable runtime/environment with the exact unexecuted scenario; absence of environment is not a passed check.

## Implementation evidence (recorded 2026-09-09, branch `codex/103-global-undo-redo`)

Environment: macOS arm64 (Darwin), repository workspace pnpm. The Phase 9, Phase 10, and Phase 11 convergence work is implemented through shared IPC validation, dedicated-window history clients and settlement barriers, prepared/direct structural commits, focused history availability, oversize proposals, idempotent operations, stable editor grouping and IME settlement, realm-safe scope routing, immutable publication/runtime fences, performance-kind recovery, identity-aware selection replay, synchronous workbench queue pausing, fail-closed composition settlement, dedicated projection refresh, and per-performance runtime-state preservation.

### Package, build, and lint gates

| Gate | Result |
| --- | --- |
| `pnpm --filter @blue/data build` | passed |
| `pnpm --filter @blue/engine-client build` | passed |
| `pnpm --filter @blue/app build:main` / `build:preload` / `build:renderer` | passed |
| `pnpm --filter @blue/app test` | 457 files, 4539 passed, 2 skipped |
| `pnpm test` | passed: native engine/CTest, Java, data (183 files / 1809 passed / 1 skipped), engine-client (42), app (457 / 4539 / 2 skipped), CLI, and scripts |
| `pnpm lint` | passed; typography audit and Prettier clean |
| `git diff --check` | clean |

Focused Phase 9/10/11 regressions also passed, including shared IPC availability, synchronous queue and dedicated settlement barriers, fail-closed composition/router settlement, dedicated projection refresh, direct-writer ordering, freeze/relink, editor grouping/IME, menu scope, runtime fences and per-performance cosmetic preservation, mixed scalar/structural XML replay, selection reconciliation, and retention status suites (104 tests in the Phase 11-focused command; the prior Phase 9/10 focused set also passed with 108 tests).

### Browser and native-platform status

The browser suite was attempted with `pnpm --filter @blue/app test:browser`, but the configured Chrome binary aborted with `SIGABRT` before test execution; Vitest reported 13 files with no tests run and a follow-on `kill EPERM`. This is an environment failure, not a product pass. The main history-engine integration suite uses a recording client/test adapter rather than a running engine.

macOS package/native tests ran. Windows and Linux native menu, real drive/UNC permission, and audio smoke scenarios were not available on this host. Real-engine timeline/Blue Live replay, painted-view receipt timing, and acoustic readback therefore remain open manual gates; synthetic Windows path fixtures and coordinator/runtime test doubles remain covered.

### Coordinator performance evidence

The deterministic 1,000-clip / 32-instrument / 128-parameter workload ran 100 actions after five warmups through `global-project-history.performance.test.ts`:

- Commit: p50 0.01 ms, p95 0.06 ms, max 0.61 ms
- Undo: p50 0.01 ms, p95 0.03 ms, max 0.29 ms
- Redo: p50 0.01 ms, p95 0.03 ms, max 0.18 ms
- Retained history: 35,500 bytes (0.03 MiB)
- Heap-used delta: 30.27 MB

The SC-003/SC-004 thresholds are met at the coordinator level. End-to-end painted-view latency, status-render latency, and positive live-engine acknowledgement were not measurable without the browser/native runtime gates above.

### Phase 12 follow-up (T103, 2026-09-09)

Fixed the ordinary-submission/undo queue dependency cycle in the main coordinator. Before prepare, queued participant submissions are captured as prefix work; ordinary arrivals remain eligible until their participant acknowledges. Their original queue slots reuse the completed execution, preventing duplicate or delayed application. Unrelated and already-acknowledged participants' ordinary writes still wait. Existing document, revision, sequence, and operation-id validation remains in force; no renderer queue rewrite or new dependency was required.

The regression reproduced timeout before the fix. Coverage now checks arrivals before and after main broadcasts prepare, duplicate submissions, stale document/revision/sequence fences, post-acknowledgement input, the production workbench patch queue, and the production dedicated-window history hook against a real `ProjectHistory` instance. These are automated in-process integration checks, not native multi-window evidence.

- `pnpm test`: passed, including app 457 files / 4,547 passed / 2 skipped, data 1,809 passed / 1 skipped, native engine 14 CTest checks, Java, engine-client, CLI, and 49 script checks.
- `pnpm lint`: passed, including typography and Prettier checks.
- Main, preload, and renderer builds: passed. `git diff --check`: clean.
- `pnpm --filter @blue/app test:browser`: Chrome again exited before execution inside the sandbox; the same command **passed outside the sandbox**, 13 files / 60 tests. This supersedes the earlier browser-launch blocker.

T085 is considered complete by the explicit 2026-09-09 acceptance disposition recorded in tasks.md; this does not add running-engine or native Windows/Linux evidence. T087 remains open. The history-engine suite still uses a recording adapter; running-engine timeline/Blue Live replay and physical-command-to-paint/live-acknowledgement measurement harnesses/results remain outstanding. Native engine CTest success is not equivalent to those application-level engine scenarios.

### Phase 13 follow-up (T104–T109, 2026-09-09)

The remaining convergence implementation is now covered by concrete BSB/effect inverse patches and generation-scoped runtime aliases, project-property scope and metadata wiring, transaction-aware CodeMirror grouping, native InputEvent inserted-text propagation, fail-closed composition settlement, and project-editor teardown settlement/draft retention. Focused coverage includes BSB edit/undo/redo readback on timeline and Blue Live test performances, effect and preset inverse capture, project-property and instrument-comment InputEvent flows, CodeMirror insert/delete/mutation/selection boundaries, composition timeout/late completion, and close-without-blur lifecycle behavior.

- Focused main and renderer suites: 6 files / 100 passed.
- `pnpm --filter @blue/app test`: 458 files / 4,581 passed / 2 skipped.
- `pnpm --filter @blue/app build:main` and `build:renderer`: passed.
- `pnpm lint`: passed; `git diff --check`: clean.

The Phase 13 in-process tests did not claim physical command-to-paint or positive acknowledgement timing; those measurements are recorded below.

### Phase 14 follow-up (historical T087 component evidence, 2026-09-09)

These figures are retained for comparison only. The browser test used a mocked commit function with empty patches and fabricated publications, and the runtime test called reconciliation directly while timing its channel operation. They do not establish the production command-to-restoration or ProjectHistory-to-engine acceptance boundaries; those are recorded in Phase 16. The coordinator benchmark remains the deterministic retention/heap component measurement.

- Historical browser component benchmark: 100 samples; canonical paint p50 32.8 ms / p95 34.8 ms / max 36.0 ms; status render p50 32.8 ms / p95 34.8 ms / max 36.2 ms; heap delta -484,293 bytes.
- Historical direct runtime component benchmark: timeline p50 0.22 ms / p95 0.26 ms / max 0.36 ms; Blue Live p50 0.24 ms / p95 0.28 ms / max 0.36 ms; 100 direct positive readbacks per performance kind.
- Coordinator retention/heap evidence: commit p50 0.01 ms / p95 0.10 ms / max 0.69 ms; undo p50 0.01 ms / p95 0.03 ms / max 0.37 ms; redo p50 0.01 ms / p95 0.03 ms / max 0.22 ms; retained bytes 35,500; heap delta 27,642,784 bytes.
- The historical focused browser and opt-in runtime commands passed on the macOS arm64 host, but their component-only boundary is not a substitute for Phase 16.

The existing T087 completion marker is preserved; its end-to-end acceptance interpretation is supplied by T116 below. Native Windows/Linux shortcut and path gates remain outside this host’s evidence, as documented under T085.

### Phase 15 follow-up (T110–T114, 2026-09-09)

Completed the final convergence fixes for rejected settlement receipts, serialized runtime preview draining, mixer insertion identity allocation, project-scoped Scratch Pad history, and semantic action labels.

- Focused convergence suites: 9 files / 206 passed / 2 skipped.
- `pnpm --filter @blue/app test`: 458 files / 4,598 passed / 2 skipped.
- `pnpm test`: passed, including native engine 14 CTest checks, engine-client, data 183 files / 1,809 passed / 1 skipped, Java, CLI, app, and 49 script checks.
- `pnpm --filter @blue/app build:main` and `build:renderer`: passed.
- Targeted Prettier checks and `git diff --check`: clean.
- `pnpm lint`: the code, lint, typography, and package validation stages passed; the final repository format check remains blocked only by the pre-existing `HANDOFF-103-undo-redo.md` formatting warning.

Native Windows/Linux and manual real-platform gates remain as previously documented.

### Phase 16 follow-up (T115–T116, 2026-09-10)

Completed the delayed-preview generation fence and replaced the remaining T087 component-only acceptance paths with production-boundary measurements. T115 now snapshots the performance instances and generations at preview submission, fences delayed acknowledgements against the current instance/generation, and covers both replacement and project-disposal timelines. T116 measures five warmups followed by 100 Undo/Redo pairs, records p50/p95/max, retained bytes, heap delta, and injected runtime-error visibility, and does not reopen T085's accepted native-platform disposition.

- Runtime generation fence: `pnpm --filter @blue/app exec vitest run src/main/project-runtime-reconciliation.test.ts --reporter=dot` passed, 38 tests.
- Production browser boundary: `pnpm --filter @blue/app exec vitest run --config vitest.browser.config.ts src/renderer/browser/global-project-history.browser.test.tsx --reporter=verbose` passed, 1 file / 6 tests. It mounted the production `useIPCListeners` and `ProjectPropertiesPanel` in two renderer roots, used the production project patch queue and native-menu command route, awaited history-boundary acknowledgements and canonical publications, and verified both views after two paints. Browser metrics: Undo p50 32.8 ms / p95 34.7 ms / max 35.8 ms; Redo p50 33.2 ms / p95 34.9 ms / max 35.3 ms; retained bytes 446,634; heap delta 1,268,729 bytes; injected failure determination-to-visible-error 0.2 ms. The two roots share one browser realm; the packaged Electron run below covers the actual host window and native application-menu dispatch.
- Running-engine boundary: `BLUE_RUN_REAL_ENGINE=1 pnpm --filter @blue/app exec vitest run src/main/global-history-engine.integration.test.ts --reporter=dot` passed, 8 tests. The measured path uses `ProjectHistory.commit`, `ProjectHistory.undo`, and `ProjectHistory.redo` against independent timeline and Blue Live sessions; each timer ends only after the operation response and both positive engine readbacks. Engine metrics: Undo p50 0.265 ms / p95 0.402 ms / max 6.547 ms; Redo p50 0.266 ms / p95 0.414 ms / max 8.750 ms; 210 positive readbacks per performance kind; retained bytes 36,252; heap delta 4,778,496 bytes.
- Native Electron boundary: `pnpm --filter @blue/app verify:global-history` passed against a freshly rebuilt `release/mac-arm64` directory package. The driver opens the fixture through `window.blueAPI.openFilePath`, edits through the production Project Properties input, and invokes the actual native application-menu Undo/Redo items in the packaged main process before checking the painted host window. Metrics: Undo p50 48.826 ms / p95 50.788 ms / max 56.609 ms; Redo p50 40.662 ms / p95 42.553 ms / max 51.323 ms; retained bytes 44,828; heap delta 0 bytes. OS-level physical accelerator delivery remains a manual-platform check from the checklist above, not an automated Playwright claim.
- `pnpm --filter @blue/app test` passed: 458 files / 4,602 tests passed / 2 skipped. `pnpm test` also passed, including 14 native CTest checks, 183 data files / 1,809 tests, engine-client, Java, CLI, and 49 script checks.
- `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/app build:renderer`, `node --check packages/blue-app/scripts/verify-global-project-history.mjs`, targeted Prettier, and `git diff --check` passed. `pnpm lint` passed its audit, ESLint, package-lint, and typography stages; its final repository format check remains affected only by the pre-existing `HANDOFF-103-undo-redo.md` warning documented above.

### Phase 17 planned follow-up (T117–T125, 2026-09-10)

The handoff review added the remaining coverage and UX follow-ups to `tasks.md`. T121 is complete: score/layer/item color actions now submit canonical patches to the main-owned project history, and the obsolete renderer-local score-color store and its tests were removed. T117–T120 and T122–T125 remain planned; the native Windows/Linux and physical accelerator gates remain covered by T085's existing acceptance disposition.

### Phase 19 follow-up (T129–T130, 2026-09-10)

Completed the remaining Clojure project-properties history gaps. Session-only library row IDs now live on the persistent `BlueData` owner and transfer across history copies without adding metadata to `.blue` XML; canonical replacements adopt incoming IDs, including distinct rows with identical coordinates and versions. The production tab now uses stable row keys and entry-targeted updates, forwards semantic field metadata through the project text queue, and keeps add/remove/reorder as separate structural actions. Focused coverage verifies repeated canonical reads, history-copy/replay identity, focused selection preservation, project scope/field metadata, and removal cleanup.

- Focused main and renderer suites: 2 files / 130 passed.
- `pnpm --filter @blue/app test`: 460 files / 4,746 passed / 2 skipped.
- `pnpm --filter @blue/app build:main` and `build:renderer`: passed after the final test typing guard.
- `git diff --check`: clean. The repository lint result remains as previously recorded: all audit, ESLint, package, and typography stages passed; the final format stage reports only the pre-existing `HANDOFF-103-undo-redo.md` warning.

### Phase 20 follow-up (T131–T133, 2026-09-10)

Completed the remaining Clojure acknowledgement, identity, and reorder convergence work.
The renderer patch queue now retains in-flight and queued Clojure patches while canonical
snapshots refresh; the store overlays field intents by stable row identity and replays
structural intents by identity/order. Renderer insertions use UUID identities, and the shared
patch boundary rejects duplicate replacement-list IDs before candidate preparation. Clojure
no-op comparison now includes identity and order, so equal-valued row reorders are durable
history actions while IDs remain absent from `.blue` XML.

- Focused Clojure/queue/store/history suites: 4 files / 189 passed.
- `pnpm --filter @blue/app test`: 460 files / 4,751 passed / 2 skipped.
- `pnpm test`: passed, including 183 data files / 1,812 passed / 1 skipped, 460 app files / 4,751 passed / 2 skipped, native engine checks, Java, engine-client, CLI, and script checks.
- `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/app build:renderer`, `pnpm lint`, and `git diff --check`: passed.

The focused integration test uses a real `ProjectHistory` with controlled delayed acknowledgements
to verify interleaved `aaax`/`bbby`/`aaaxx` edits converge to `aaaxx`/`bbby`; real history tests
cover duplicate-ID rejection, unique insertion undo/redo, and identity-aware equal-row reorder
undo/redo. Existing project text grouping and composition-settlement suites remain green. Native
Windows/Linux and physical accelerator checks remain outside this macOS host's automated evidence.

### Phase 21–22 follow-up (T134–T135, 2026-09-10)

Completed the final Clojure submission-intent and BSB slider-history-copy convergence fixes.

- T134: the project queue carries stable Clojure entry/field intents through normal and settlement drains, prepares field submissions against the latest canonical snapshot, fences structural replacements, retains conflict/removal drafts, and overlays them on canonical refreshes. Real renderer coverage uses two `ProjectHistory` contexts to publish B=`bbby` while local A=`aaax` is queued and verifies displayed and canonical convergence.
- T135: slider and slider-bank history copies forward `CopyMode`, preserving widget/child IDs and exact resolution while retaining fresh IDs for duplication. Model, real ProjectHistory/XML round-trip, and runtime-binding tests cover slider → dropdown → slider, bank values, preview-vs-durable behavior, undo/redo, timeline/Blue Live outcomes, and no restart/fence.
- Focused T134/T135 suites: app 5 files / 182 tests; data 3 files / 17 tests.
- `pnpm --filter @blue/data build`, `pnpm --filter @blue/app build:main`, and `pnpm --filter @blue/app build:renderer`: passed.
- `pnpm test`: passed, including app 460 files / 4,759 passed / 2 skipped, data 184 files / 1,822 passed / 1 skipped, native 14 CTest checks, Java, engine-client, CLI, and script checks.
- `pnpm lint` and `git diff --check`: passed.

Native Windows/Linux, manual native audio, and physical accelerator checks remain outstanding as documented; the reported user fixture was not modified.

### BSB parameter-control coverage follow-up (2026-09-10)

Added focused regression coverage for the T135 copy-mode defect and the parameter-modifying BSB control path.

- `bsb-slider-history-copy.test.ts` now covers all nine parameter-backed model types: horizontal/vertical sliders, horizontal/vertical slider banks, knob, checkbox, dropdown, BSB value, and XY controller. History copies must retain identity and state; duplication copies must allocate fresh widget and child IDs.
- `bsb-instrument-runtime-sync.test.ts` covers durable routing for all nine types and the five realtime update shapes, including checkbox, dropdown, XY, and slider-bank payloads.
- `bsb-parameter-controls.test.tsx` drives the production renderer widgets with keyboard/pointer input and verifies their exact patches, including the production `BSBInterfaceEditor` instrument-patch envelope.
- `track-instrument-editor-contract.test.ts` verifies the typed patch-to-realtime mapping for scalar, checkbox, dropdown, XY, and slider-bank updates.

BSB text/file/line controls remain outside this numeric parameter matrix because they use separate text, file, or replacement contracts; BSB value is included for model/runtime identity even though its runtime widget is display-only.

### Phase 23 follow-up (T136–T137, 2026-09-11)

Clojure field preparation now captures its revision fence before reading canonical data and checks queue generation and boundary ownership immediately before submission. A stale read is rejected by main rather than labelled with a newer revision. Reset/replacement and clear invalidate unsent work; releasing a boundary returns its unsent prefix without allowing the obsolete continuation to submit or clear the new queue.

Retained field conflicts appear under Project Properties → Clojure with **Review draft**. Review reads the current canonical value. **Use project value** discards only the selected field draft; **Apply draft** explicitly approves the edited draft after identity/value/revision revalidation. Both decisions default to Cancel. A removed library can only have its draft discarded, never silently recreated. Other conflicts and unrelated pending work survive; resolved fields no longer leave stale overlays or permanently block Save/Undo. Dirty-state restoration uses the matching authoritative history projection when available.

Focused regression commands:

```sh
pnpm --filter @blue/app test src/renderer/tests/project-patch-queue.test.ts src/renderer/tests/clojure-project-tab-history.test.tsx src/renderer/tests/project-store.test.ts src/renderer/tests/project-store-score-color-application.test.ts src/renderer/tests/project-editor-panels.test.ts src/main/project-history-roundtrip.test.ts src/main/bsb-instrument-runtime-sync.test.ts src/main/runtime-parameter-sync.test.ts
```

The tests hold snapshot responses while another context updates/removes rows using one real `ProjectHistory`; cover ordinary and settlement drains, replacement/reset, clear, and ready/aborted releases; retain a second conflict and mixed-transaction work; and drive the production editor/store through Cancel, discard, revised apply, zero-outstanding Save/Undo settlement, and canonical undo. A second document verifies dialog placement and host-only Escape handling. Existing grouped replay and the original T134 sequence remain regression controls.

Final validation: `pnpm test` passed (app: 461 files / 4,804 passed / 2 skipped; data: 1,830 passed / 1 skipped; engine-client: 42; native: 14 CTest checks; Java, CLI, and 49 script checks). `pnpm lint`, main/preload/renderer builds, and `git diff --check` passed.

The optional whole-app check `pnpm exec tsc -p packages/blue-app/tsconfig.json --noEmit` is not a clean gate: existing missing snapshot fields, invalid imports, and test-fixture typing errors remain throughout the renderer/tests. No diagnostics were reported in the new conflict controls, queue implementation, or Clojure integration tests. Main/preload TypeScript builds are the scoped compile gates; this change does not claim to repair the unrelated whole-renderer typing debt.

No user project files were changed. T085 remains accepted and the existing T087/T116 evidence is unchanged. Native Windows/Linux, physical accelerator, manual audio, and performance measurements were not rerun for this renderer-queue fix.

### Phase 24 completion (T138–T139, 2026-09-11)

T138 is implemented: Clojure conflict discard now reads a revision-matched canonical history projection from the authoritative project owner before completing. Missing or stale projections fail closed without inferring cleanliness from the rejected draft's baseline. Production store wiring uses `readProjectHistory({ documentId })`, with queue and editor/store coverage for absent, stale, current-clean, and current-dirty projections plus subsequent Save/Undo settlement.

T139 is implemented: retained Clojure field conflicts carry transaction identity, so separately blocked same-field drafts remain independently reviewable. A resolution removes only the represented transaction/field and preserves sibling and unrelated work. Queue and production editor coverage exercises Cancel, stale review revalidation, keep-canonical, revised Apply, ordinary and settlement recovery, zero-outstanding boundary settlement, and undo/redo history labels/content.

Validation: `pnpm --filter @blue/app test` passed (461 files / 4,812 passed / 2 skipped); `pnpm test` passed; `pnpm --filter @blue/data build`, app main/renderer builds, `pnpm lint`, and `git diff --check` passed. No user project files were changed. Native Windows/Linux, physical accelerator, manual audio, and whole-renderer TypeScript debt remain as previously documented.

### Phase 25 completion (T140, 2026-09-11)

T140 is implemented: Clojure conflict discard now fails before mutating the retained draft when the authoritative history projection is unavailable, rejected, or stale. The visible conflict and dirty baseline remain retryable, and history boundaries continue to report an unresolved prefix until a revision-matched clean or dirty projection allows discard to finish.

Queue and production Clojure editor regressions cover absent, rejected, stale-then-current-clean, and stale-then-current-dirty reads, including retained conflict visibility, blocked boundary settlement, retry, canonical/display agreement, and final dirty-state parity with main.

Validation: focused coverage passed (2 files / 70 tests); `pnpm test`, `pnpm lint`, `pnpm --filter @blue/data build`, all app builds, and `git diff --check` passed. No user project files were changed.

### Final owner acceptance (2026-09-11)

After the final implementation and clean convergence pass, the project owner reported that further manual testing looked good and accepted the feature for its specified scope. This closes the feature without claiming additional native Windows/Linux, physical-accelerator, or manual native-audio evidence beyond the limitations documented above.
