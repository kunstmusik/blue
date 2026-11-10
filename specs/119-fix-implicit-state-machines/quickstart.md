# Validation Guide: Lifecycle and Gesture Reliability

**Status**: Complete — owner acceptance recorded 2026-11-09. The evidence entries below are chronological snapshots; their historical uncommitted/pending statements are superseded by [Completion and Owner Acceptance](#completion-and-owner-acceptance--2026-11-09).

Run commands from the repository root of the `codex/fix-implicit-state-machines` worktree. This guide describes acceptance after implementation; successful baseline tests are recorded separately below.

## Prerequisites

- Use the repository-pinned pnpm and a supported Node version. The planning baseline used Node 22.23.1.
- Install dependencies and build workspace entry points in a clean worktree before app tests:

```sh
pnpm install --frozen-lockfile
pnpm --filter @blue/data build
pnpm --filter @blue/engine-client build
```

- Unit scheduling/process tests use fakes and do not require a running Java helper. Real scripting acceptance requires the existing packaged/development helper and supported Java installation.
- Ordinary browser tests require the browser configured in `packages/blue-app/vitest.browser.config.ts`; Chrome is the default channel. Use the existing browser setup rather than inventing a separate test configuration.

## Focused Correctness Commands

### Shortcuts, transport, and follow

```sh
pnpm --filter @blue/app test src/renderer/tests/app.test.ts src/renderer/tests/playback-store.test.ts src/renderer/tests/score-follow-playback.test.tsx
```

Expected: modal/handled keys do not double-fire, idle workspace keys still work, both start-confirmation orders and early clocks retain coherent state, terminal/retired clocks cannot revive display, and saved follow/cadence remain intact. See [shortcut/transport contract](contracts/playback-and-shortcuts.md).

### Canonical history and settlement

```sh
pnpm --filter @blue/app test src/main/project-history.test.ts src/main/project-history-settlement.test.ts src/main/project-history-roundtrip.test.ts src/renderer/tests/project-patch-queue.test.ts src/renderer/tests/history-scope-router.test.tsx src/renderer/tests/gesture-history-integration.test.tsx src/main/score-automation-runtime-sync.test.ts
```

Expected: one action per changed gesture, matching unchanged/metadata-only end closes its group, cancel restores content/dirty/redo baseline, stale terminal cannot affect another group, net-zero live release removes its action, small drags still work at the 200-action limit, and bounded checkpoint admission rejects safely at the byte limit. Automation cancel/Undo/Redo checks actual baseline/final engine payloads, not merely a runtime status. Undo during an active preview/live edit waits for settlement receipts and reverses the completed action once.

### Editors, timing, automation, and layout

```sh
pnpm --filter @blue/app test src/renderer/tests/pianoroll-parity.test.ts src/renderer/tests/patterns-layer-group-canvas.test.tsx src/renderer/tests/track-layer-group-canvas.test.tsx src/renderer/tests/bsb-undo-regression.test.tsx src/renderer/tests/line-object-editor-parity.test.tsx src/renderer/tests/jmask-editor-contract.test.tsx src/renderer/tests/editable-line-canvas-popover.test.tsx src/renderer/tests/markers-bar.test.tsx src/renderer/tests/tempo-line-view.test.tsx src/renderer/tests/score-timeline-automation-popout.test.tsx src/renderer/tests/orchestra-split-pane.test.tsx src/renderer/tests/arrangement-panel-popout.test.tsx
```

Expected: initially clean/dirty state is preserved on cancel, insertion belongs to its gesture, both PianoRoll autoscroll modes stop on all exits, BSB multi-widget cancellation works before/after a queue flush, score cross-group previews leave the shared score/dirty state untouched, and cancelled layout does not persist later. Include the new host-listener/projection regressions added during implementation in the ordinary suite.

### Java helper lifecycle

```sh
pnpm --filter @blue/app test src/main/java-runtime/java-runtime-session.test.ts src/main/java-runtime/java-runtime-client.test.ts src/main/java-runtime/java-runtime-process.test.ts
```

Expected: disposed probes/reservations cannot spawn, the spawn/adoption handoff registers ownership before disposal can miss it, late handles are cleaned before client work, three requests serialize, same-key readiness is reused, failed init retains safe dependency knowledge, queued disconnect cannot reopen sockets, and realistic signal delivery still escalates when exit is unconfirmed. Advance fake clocks through the two-second grace and one-second force-confirmation deadlines; do not wait real seconds in unit tests. See [runtime contract](contracts/java-runtime-lifecycle.md).

## Browser and Real Desktop Acceptance

Use ordinary functional browser tests, including existing history and BSB geometry coverage:

```sh
pnpm --filter @blue/app test:browser src/renderer/browser/global-project-history.browser.test.tsx src/renderer/browser/bsb-geometry.browser.test.tsx src/renderer/browser/host-gesture-adoption.browser.test.tsx
```

Add the feature's actual host-adoption/gesture-order browser regressions during implementation and run them under this ordinary browser configuration. Two-document unit tests and headless browser tests do not replace actual Dockview/Electron OS-window acceptance.

Start the normal development application using the existing engine/helper prerequisites:

```sh
pnpm --filter @blue/app dev
```

For each gesture family in [the spec scope table](spec.md#in-scope-gesture-families):

1. Open the editor docked, float it without remounting, then drag and release outside the canvas inside its hosting window. Later hovering must not continue the gesture.
2. Start from a saved clean project and from an already-dirty project. Change content and Escape; verify canonical values, dirty state, history and audible/visible runtime consequences return to the appropriate baseline. Repeat with an existing redo branch.
3. Complete a compound edit and invoke Undo/Redo once. All affected targets restore together, including cross-group placement and stable identities.
4. Cancel marker/automation/line/table insertion after press; no inserted content or phantom history action remains. Standalone tempo insertion keeps its existing click behavior.
5. During playback, Escape a drag; playback continues. Then press idle/unclaimed Escape; playback stops. Exercise modal buttons/checkboxes and handled editor Space without background transport action.
6. Lose host focus: BSB move/resize settles; other listed gestures cancel. Close an editor, remove its target, or replace the project during pending work; verify the distinct closure/invalidation policy and no stale-target write.
7. Move notes and marquee-select at the PianoRoll viewport edge, then cancel/release. Verify automatic scrolling in both modes and no scrolling afterward.
8. Cancel split-pane/column resize and wait beyond the old layout-save debounce. Verify displayed and persisted layout remains at the baseline; columns must not gain invented persistence.
9. For Java-backed projects, delay startup/dependency initialization, dispose or quit, and inspect the recorded helper PID in the OS process list. Verify no late spawn and confirmed cleanup within the bounded termination procedure; force-exit failure must remain explicit. Verify compatible helper reuse and safe changed/removed-dependency retry.

Record macOS, Windows and Linux results with revision and scenario outcome. Fake POSIX signals alone do not prove native Windows process behavior. Do not substitute chmod-based permission tests or normalize native paths for these checks.

## Requirement-to-Evidence Matrix

| Requirements                 | Contract/oracle                                                                                                                       | Success criteria |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| FR-001–FR-003                | Shortcut guard with late modal listener, handled keys, toolbar Space and non-modal help                                               | SC-001           |
| FR-004–FR-005, FR-009–FR-012 | Host adoption, terminal idempotence, selection/draft closure, focus policies and two autoscroll modes                                 | SC-002           |
| FR-006–FR-008, FR-011        | Canonical commit/Undo/Redo, mixed live/local edits, insertion cancellation, redo/retention and receipt ordering                       | SC-003           |
| FR-013–FR-019                | Deferred startup stages, three requests, reuse/dependency failure, client close, atomic spawn handoff and realistic exit confirmation | SC-004           |
| FR-020–FR-023                | Playback reducer/store actions, early/retired clocks, both confirmation orders, saved follow and stable identities                    | SC-005           |
| FR-024                       | Tracked owner/transition/cleanup contracts, data model, and architecture review against implementation                                | SC-006           |

## Package and Workspace Handoff

After focused tests, run the affected package checks; the connected main/history and renderer behavior also requires the workspace checks before implementation handoff:

```sh
pnpm --filter @blue/app test
pnpm --filter @blue/app typecheck:renderer
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm test
pnpm lint
git diff --check
```

Performance measurements remain separate under the existing opt-in commands and reference-machine policy. Do not report a green correctness run or hosted collection as speed acceptance.

## Planning Baseline — Not Feature Acceptance

- Java runtime session/client/process suites: **3 files / 18 existing tests passed**.
- Playback store, BSB undo regression and main history suites: **3 files / 76 existing tests passed**.
- The latter command initially could not resolve the clean worktree's unbuilt `@blue/data` entry point. Building `@blue/data` succeeded; rerunning the same focused command passed. This was an environment prerequisite failure, not a reproduced product defect.
- No implementation source changed. The new lifecycle scenarios, new regression tests, real floated-window behavior, native platform process cleanup, and full-package/workspace checks have not been accepted by this baseline.

## Implementation Evidence — 2026-11-09

- Worktree: `codex/fix-implicit-state-machines`, base revision `5a19acc3cd0d87581d93da5a6e7ba8f9562232f6`, with the feature changes still uncommitted. Host: macOS arm64, Node 22.23.1, pnpm 12.8.1. The existing `blue-engine` build from the main checkout was supplied with `BLUE_ENGINE_PATH` for tests requiring a native engine.
- The canonical integration suite covers marker insertion/movement, ruler ranges, tempo, PianoRoll, line and JMask through the renderer queue and `ProjectHistory`; it checks clean and dirty cancellation, redo preservation, one-action Undo/Redo, and score-object identity. The focused gesture and automation run passed 87 tests; the expanded canonical integration suite passed 29 tests.
- Ordinary browser acceptance passed: 3 files, 19 tests passed and 2 skipped, including already-mounted host adoption and gesture ordering. This is not a substitute for native windows.
- Renderer type checking, main/preload builds, and workspace lint passed. The final `pnpm test` rerun passed: app 541 files / 6,039 tests (15 skipped), data 225 files / 3,151 tests (5 skipped), engine client 47 tests, CLI 22 tests, and all Java, native engine, and workspace script stages. The script stage passed 72 tests. The run used the native engine path described above.
- Marker/tempo fences use transient app-side identities and reject removed, reordered, or identically valued replacement targets. Focused history tests verify that Undo/Redo restores those identities and that they are absent from XML. Line and JMask tests also cover same-editor target replacement and changed source data.

| Native acceptance | Docked/floated gestures | Java helper termination | Status |
| --- | --- | --- | --- |
| macOS arm64 | Recorded Score, Tempo, Ruler, BSB move and layout scenarios passed (see T059). Owner manual testing accepted; every gesture-family combination was not separately recorded | Real helper startup, compatible reuse, normal disposal and disposal during startup passed (see convergence evidence below) | Accepted by owner |
| Windows | Not run: no machine or runner available | Not run: no machine or runner available | Coverage limitation accepted by owner |
| Linux | Not run: no machine or runner available | Not run: no machine or runner available | Coverage limitation accepted by owner |

The owner accepted this matrix and its coverage limitations for feature closeout on 2026-11-09. This acceptance does not assert complete observed native coverage. No performance acceptance is claimed.


## Convergence Evidence — 2026-11-09 (T046–T053)

- Same branch and base revision as above; the implementation and convergence fixes remain uncommitted. Host: macOS arm64, OpenJDK Temurin 25+36, Node 22.23.1 and pnpm 12.8.1. T046–T052 are complete. T031/T044/T053 remain open for the native platform acceptance described below.
- Completed single actions no longer retain rollback checkpoints. Tests cover single A → begin B → cancel B, Undo/Redo, consecutive singles, stable model identity, and admission with a baseline larger than the byte budget.
- Oversize live growth uses the canonical cancellation path, publishes restored state and revision, reconciles concrete inverse automation points, and rejects delayed input from the rejected gesture. Main, runtime and real renderer-queue regressions pass.
- Mounted field and note canvases discard drafts on target/project replacement and source removal, for both local and outside release. Rendered automation-circle presses now own host listeners, history metadata, cancellation and settlement. Canonical circle tests cover one-action Undo/Redo, Escape and blur. Deferred settlement tests verify synchronous input revocation and preserve a newer gesture across an older receipt.
- Running-child signal errors remain cleanup failures with retained manager ownership. Partial playback restart statuses retain audition anchors and suspended Follow without changing saved preferences.
- Workspace `pnpm test` passed: app **542 files / 6,068 passed, 15 skipped**; data **225 files / 3,151 passed, 5 skipped**; engine client **47 passed**; CLI **22 passed**; Java and all **14 native engine tests** passed; workspace scripts **72 passed**. Log: `/private/tmp/blue3-convergence-workspace-test.log`. After two test-fixture typing fixes, the affected main suites passed another **75 tests**; production behavior was unchanged.
- Renderer type checking, main/preload builds, workspace lint and `git diff --check` passed. The focused convergence run passed **210 tests**, followed by the expanded field/canvas and automation run (**28 passed**). Final lint log: `/private/tmp/blue3-convergence-final-lint.log`.
- Chrome browser rerun passed: **3 files / 19 passed, 2 skipped**, including mounted host adoption and event ordering. Log: `/private/tmp/blue3-convergence-browser.log`.
- Native macOS Java acceptance used the built `packages/blue-java/target/blue-java.jar`, production `JavaRuntimeSessionManager`/client/process modules and real sockets/processes. Helper PID **77076** reached readiness, reused the same helper for a compatible project session, and exited on disposal in **314 ms**; both the exit event and OS PID disappearance were checked. Helper PID **77154** was disposed during a deliberately held startup handoff: exit was confirmed before handoff resumed, and late readiness was rejected. No fake process or protocol transport was used. Evidence: `/private/tmp/blue3-native-java-acceptance.log`; temporary harness: `/private/tmp/blue3-native-java-acceptance.cjs`.
- Native docked/floated desktop gestures remain unobserved because the macOS desktop was locked. Windows and Linux native gesture/helper acceptance remain unavailable, per the user's confirmation that no additional machines or runners exist. Browser success and the macOS process checks do not close those platform requirements. No performance acceptance is claimed.

## Convergence Evidence — 2026-11-09 (T054–T056)

- Same worktree, branch, base revision and host as the preceding evidence; changes remain uncommitted. T054 and T055 are complete. T031/T044/T053/T056 remain pending solely for the native scenarios below.
- BSB move/resize captures project document/session, instrument root and all affected widget incarnation identities. Tests cover mounted project replacement, instrument replacement, widget replacement with a reused ID and widget removal, before a pending frame and after a live edit has flushed. Release, Escape, blur and unmount cannot replay obsolete patches. Existing canonical BSB Undo/Redo scenarios still pass; incarnation IDs survive history and are absent from XML. Copy-matrix tests compare durable payload while requiring copied instruments to have distinct incarnation IDs.
- Competing groups have separate rollback checkpoints. Begin A → begin B → stale cancel A → cancel B restores the exact pre-B ledger at both 3-entry and 200-entry limits, including stable identities, dirty state, Undo/Redo and concrete inverse runtime patches. A byte-admission regression confirms that B is budgeted against its own baseline rather than A's retired checkpoint.
- Focused validation passed **3 files / 142 tests** (main history, instrument-copy matrix and canonical BSB regressions); BSB alone passed **77 tests**, including **64 new replacement/terminal scenarios**. The first workspace run exposed three copy-matrix expectations that included transient identity; those expectations were updated to the explicit copy contract, and the complete workspace rerun below passed.
- Final `pnpm test` passed: app **542 files / 6,135 passed, 15 skipped**; data **225 files / 3,151 passed, 5 skipped**; engine client **47 passed**; CLI **22 passed**; Java and all **14 native engine tests** passed; scripts **72 passed**. Log: `/private/tmp/blue3-t054-t055-final-workspace.log`.
- Renderer type checking, main/preload builds, workspace lint and `git diff --check` passed. Logs: `/private/tmp/blue3-t054-t055-types.log`, `/private/tmp/blue3-t054-t055-final-main.log`, `/private/tmp/blue3-t054-t055-preload.log`, `/private/tmp/blue3-t054-t055-final-lint.log`.
- Browser acceptance rerun passed **3 files / 19 passed, 2 skipped**, including BSB geometry, host adoption and history routing. Log: `/private/tmp/blue3-t054-t055-browser.log`.
- Rechecking native desktop access returned: **the Mac is locked and automatic unlock could not unlock it**. Native docked/floated acceptance remains pending; no UI scenario was claimed from this failed access attempt. Windows/Linux acceptance remains unavailable because the user has no additional machines/runners. Preserve the preceding real macOS Java startup/reuse/disposal evidence; those completed process scenarios were not repeated. No performance acceptance is claimed.


## Convergence Evidence — 2026-11-09 (T057–T058)

- T057 is complete. Net-zero live finalization now retains the removed entry's concrete inverse patches and reconciles the restored runtime baseline before returning its terminal receipt. Canonical publication, identity, dirty state and ledger restoration continue through the existing history path; public IPC contracts are unchanged.
- The changed-end and empty-end regressions failed before the fix with `Net-zero receipt completed without runtime reconciliation`. They now pass, including a deferred runtime acknowledgement proving that the terminal receipt waits. Real EngineBridge automation-sync tests also cover both net-zero terminal paths and inspect the restored engine point payloads. Focused history/runtime/renderer integration validation passed **5 files / 198 tests**.
- Full workspace `pnpm test` passed: app **542 files / 6,139 passed, 15 skipped**; data **225 files / 3,151 passed, 5 skipped**; engine client **47 passed**; CLI **22 passed**; Java and all **14 native engine tests** passed; scripts **72 passed**. The first sandboxed attempt could not acquire Maven's cache lock and terminated other workspace stages; rerunning with cache access passed. Evidence: `/private/tmp/blue3-t057-workspace-full.log` (initial environment failure: `/private/tmp/blue3-t057-workspace.log`). The existing native engine at `/Users/stevenyi/work/blue3/native/blue-engine/dist/darwin-arm64/blue-engine` supplied `BLUE_ENGINE_PATH`.
- Main/preload builds, renderer type checking, workspace lint and whitespace validation passed. Logs: `/private/tmp/blue3-t057-main.log`, `/private/tmp/blue3-t057-preload.log`, `/private/tmp/blue3-t057-renderer-types.log`, `/private/tmp/blue3-t057-lint.log`.
- Parity/provenance: consulted Java `LineChangeEdit.java` and `ParameterLinePanel.java` at the already-recorded revision `3ca3f40579c48a023299a68130d8ab6b9e950974`. Java restores copied line points into their source model; this fix supplies the corresponding baseline through Blue TypeScript's existing external-engine boundary. Original GPL-3.0-or-later app code only; no copied/translated source, dependency or serialization change.
- T058 remains pending. Native desktop access was initially available, and an isolated development instance reached the Blue workbench using temporary profile `/private/tmp/blue3-t057-native-DaHvhg`. A disposable copy of `fixtures/smoke-test.blue` was created for testing. The Mac locked during the native file-selection step, before that copy could be opened, and automatic unlock failed, so no native gesture scenario was accepted. Windows/Linux desktops or runners remain unavailable; previously recorded browser and real macOS Java evidence is retained.

- Final ordinary browser regression rerun passed **3 files / 19 tests, 2 skipped**, covering global project history, BSB geometry and mounted host adoption. Evidence: `/private/tmp/blue3-t057-browser.log`. T058 remains open; the native access question is pending user unlock.

## Convergence Evidence — 2026-11-09 (T059)

- T059 is complete. Diagnosed and resolved the blank native Orchestra popout on macOS arm64:
  1. `SelectedCodeEditor` mounts inside Orchestra (`InstrumentEditor` Code/UDO/Comments tabs) and reconfigures CodeMirror `tooltips({ parent: targetParent })` to the popout `document.body` on float. CodeMirror attaches `view.themeClasses` (`ͼ1 ͼ3 ͼ4 ͼo`) to that tooltip container `div` and appends it to `popout.document.body` after `#dv-popout-window` (`position: absolute; inset: 0`). Because `blueCodeMirrorTheme` used a bare `'&'` selector (`height: '100%'`, `backgroundColor: 'var(--color-app-overlay)'`), and `tooltips()` gives the container `position: relative`, that empty tooltip container filled the entire popout viewport (`760×488`) with opaque `rgb(13, 21, 36)` and painted on top of `#dv-popout-window`.
  2. Scoped the root theme rule in `packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx` from `'&'` to `'&.cm-editor'`, and removed the redundant `openedWindow.location.reload()` in `createPopoutOpenGuard` (`packages/blue-app/src/renderer/stores/workbench-store.ts`) so Dockview's adopted popout DOM is not erased by a second navigation while retaining the 10s un-adopted window cleanup.
- Added browser regression `packages/blue-app/src/renderer/browser/code-editor-popout-tooltip.browser.test.tsx` (verified failing before the `'&.cm-editor'` fix with tooltip container height `600` covering `#dv-popout-window`, and passing with height `0` and hit-test reaching `#dv-popout-window` after the fix) and unit regressions in `packages/blue-app/src/renderer/tests/clear-dockview-safely.test.ts`.
- Browser regression suite (`global-project-history`, `bsb-geometry`, `host-gesture-adoption`, `code-editor-popout-tooltip`) passed **4 files / 20 passed, 2 skipped**. Log: `/tmp/blue3-t059-browser-all.log`.
- Native macOS Electron acceptance passed for docked and mounted-then-floated gestures:
  - Modal Space containment, Score object move & cross-layer outside release with 1-action Undo/Redo, Tempo point drag docked & floated with outside release and Undo/Redo, and floated Ruler selection all passed.
  - Mounted Orchestra floated into a native OS popout window (`760×488`) rendered visibly (`capturePage()` verified). Dragging a BSB widget (`BSBHSlider`) and releasing outside the canvas over the popout header committed 1 history action (`Move Blue Synth Builder Widgets`, `left: 10px, top: 10px` → `left: 50px, top: 0px`), did not resume on subsequent hover, reversed on 1 Undo (`10px, 10px`), and restored on 1 Redo (`50px, 0px`).
  - Dragging a BSB widget in the floated window and pressing `Escape` cancelled the in-flight move (`80px, 30px` → `50px, 0px`) without adding a history entry (`cursor: 1, length: 1`).
  - Dragging a BSB widget in the floated window and losing native window focus settled the latest edit as 1 history action (`cursor: 2, length: 2`, `left: 80px, top: 20px`).
  - Dragging the Orchestra `SplitPane` separator (`x: 300` → `366`) and pressing `Escape` restored `x: 300`; dragging an `ArrangementPanel` column resize handle (`width: 73.84` → `67.59`) and pressing `Escape` restored `73.84`. Evidence: `/tmp/t059-probe.log`.
- At this stage, native coverage remained incomplete: Windows/Linux were unavailable and the recorded macOS scenarios did not cover every gesture-family combination. The owner subsequently accepted those limitations as documented below.

## Completion and Owner Acceptance — 2026-11-09

The project owner reported: “I did some manual testing and things looked good to me,” and explicitly instructed that native acceptance be accepted. T031, T044, T053, T056, T058 and T060 are therefore closed by owner acceptance together with the existing automated and observed macOS evidence. All T001–T060 tasks are complete.

This decision accepts the remaining coverage limitations. The owner's manual testing was not reported as an exhaustive per-family matrix; the recorded macOS observations above remain the extent of individually documented native scenarios. Windows/Linux native gesture and helper scenarios were not run because no desktops/runners were available. No additional native execution or performance acceptance is claimed. Historical pending statements above describe earlier stages and no longer block this feature's closeout.

Final automated validation of the code committed through `4376a0ae`, on the macOS arm64 environment recorded above:

- `BLUE_ENGINE_PATH=/Users/stevenyi/work/blue3/native/blue-engine/dist/darwin-arm64/blue-engine pnpm test` passed: app **542 files / 6,141 tests passed, 15 skipped**; data **225 files / 3,151 tests passed, 5 skipped** (one file skipped); engine client **47 tests**; CLI **22 tests**; Java and native engine stages passed, including **14 native CTest cases** and **30 native workspace tests**; workspace scripts **72 tests**. Log: `/private/tmp/blue3-119-final-workspace.log`.
- Focused current-code regressions passed **13 files / 412 tests, 2 skipped**. Log: `/private/tmp/blue3-converge-current-focused.log`.
- Ordinary browser regressions passed **4 files / 20 tests, 2 skipped**, covering global history, BSB geometry, already-mounted host adoption and the CodeMirror popout tooltip regression. Log: `/private/tmp/blue3-converge-current-browser.log`.
- `pnpm lint`, `pnpm --filter @blue/app typecheck:renderer`, `pnpm --filter @blue/app build:main` and `pnpm --filter @blue/app build:preload` passed. Logs: `/private/tmp/blue3-119-final-{lint,types,main,preload}.log`.
- `git diff --check` passed before the code commits; completion documentation is checked separately before its final commit.

Implementation commits:

| Commit | Change |
| --- | --- |
| `388500da` | `fix(java): fence helper startup and cleanup` |
| `55adae53` | `fix(history): preserve gesture rollback and runtime state` |
| `2db12005` | `fix(app): bind score gestures to their hosting window` |
| `d45d2efd` | `fix(app): cancel editor gestures through project history` |
| `9c7c6aae` | `fix(app): contain shortcuts and playback transitions` |
| `4376a0ae` | `fix(app): prevent blank editor popouts` |
