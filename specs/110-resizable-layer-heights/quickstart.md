# Validation Guide: Resizable Layer Heights

This guide is for implementation validation. The feature is not implemented by `$speckit-plan`; commands targeting proposed test files become runnable once those files are added. The planning pass only inspects/probes reference behavior and validates documentation.

## Prerequisites

- Work from repository root on `codex/110-resizable-layer-heights` with the repository's supported Node/pnpm setup and dependencies (`pnpm install --frozen-lockfile` if needed).
- Existing native engine/Csound prerequisites are needed for the normal app and real playback exercise; Java is not a production dependency of resizing.
- For Java compatibility, use the local Java Blue checkout/build or an installed Java Blue release, recording exact version/build. Planning used checkout develop `3ca3f40579c48a023299a68130d8ab6b9e950974`, POM 2.10.3, and Java 25 against existing packaged jars (not rebuilt).
- Have supported macOS, Windows and Linux coverage for pointer/modifier behavior, and a browser environment available for Playwright tests. Use native temporary-file APIs in fixtures; no hard-coded POSIX paths or permission assumptions.

## Focused automated checks

Proposed cohesive regression files (add during implementation) and their responsibilities:

| File | Required assertions |
| --- | --- |
| `packages/blue-data/src/score/layer-height-serialization.test.ts` | SoundLayer/Track legacy and custom load/save/copy; tie-up fallback; 22/660 limits; malformed raw attr preservation and clearing on real edit; no-op representation retention; legacy SoundLayer 902 and Track clamp; unchanged unrelated XML/CSD. |
| `packages/blue-app/src/shared/project-editor/layer-height-patches.test.ts` | Aggregate set/reset, root/nested scope, defaults-only behavior, duplicate/missing/reordered/Pattern/invalid rejection before mutation, accepted no-op. |
| `packages/blue-app/src/main/project-history-layer-height.test.ts` | One commit→undo→redo; identities/references and dirty/save-state; raw attribute restoration; atomic mixed-batch rejection; cosmetic playback reconciliation; default creation/apply differences. |
| `packages/blue-app/src/renderer/tests/layer-height-resize.test.tsx` | Shared projection, original-delta clamping, zero-motion legacy no-op, scope preservation, host/capture/scroll/blur cancellation, settlement awaiting committed release versus cancelling active preview. |
| `packages/blue-app/src/renderer/browser/layer-height-resize.browser.test.tsx` | Header pointer handle, final-row and automation arbitration, keyboard/numeric menus, two hosting documents, header-to-score pixel alignment and zoom, measured preview latency. |

Extend existing `project-history-patch-classification.test.ts`, `project-history-roundtrip.test.ts`, `project-runtime-reconciliation.test.ts`, queue tests, `score-wheel-zoom.test.tsx`, `score-canvas-popout-menus.test.tsx`, and relevant nested snapshot/selection tests rather than duplicate their existing coverage.

Run from repository root after implementation:

```sh
pnpm --filter @blue/data test src/score/layer-height-serialization.test.ts
pnpm --filter @blue/app test src/shared/project-editor/layer-height-patches.test.ts src/main/project-history-layer-height.test.ts src/renderer/tests/layer-height-resize.test.tsx
pnpm --filter @blue/app test src/main/project-history-patch-classification.test.ts src/main/project-history-roundtrip.test.ts src/main/project-runtime-reconciliation.test.ts src/renderer/tests/score-wheel-zoom.test.tsx src/renderer/tests/score-canvas-popout-menus.test.tsx
pnpm --filter @blue/app test:browser src/renderer/browser/layer-height-resize.browser.test.tsx
```

Include failure injection: second target invalid, target reorder before release, expectedRevision mismatch, rejected receipt, transport rejection after possible commit, lost pointer capture, and window closure. Assert both canonical state and renderer refresh; a resolved Promise alone is not evidence of successful commit.

## App exercise

Build/start through existing scripts:

```sh
pnpm --filter @blue/data build
pnpm --filter @blue/app dev
```

The existing dev command prepares the native engine and starts the Vite/Electron workflow. Resize gestures originate only from eligible header handles; the score canvas mirrors their geometry and remains dedicated to score-object/timeline editing. Use a disposable copy of a project with two root groups, at least 20 Sound/Track rows, one nested PolyObject, and a Pattern group. Include sound objects, an audio clip, and an automation line; save a baseline.

1. Set one row to 44. Drag its header lower edge +13: verify 57 in the header and the aligned score row. Undo once restores 44 and saved state; redo once restores 57 and modified state. Repeat with keyboard numeric entry and confirm no score-canvas resize handle is present.
2. Select rows at 44 and 88 across groups. Drag a selected border +13: 57/101; unselected rows unchanged. Drag an unselected border: only that row changes, selection and MIDI focus remain intact. Try with one Pattern row selected: nothing changes and an explanation appears.
3. Drag through the limits and back. Verify independent clamping and no drift. A click without movement creates no entry, including on a legacy 902-pixel SoundLayer. Escape and host blur restore originals without dirty changes.
4. Apply preset 66 to the selection; both become 66. Set custom 57: menu reports Custom. Unequal selection reports Mixed. Track-only menu includes 220; mixed Sound/Track scope exposes common presets through 198. Numeric entry rejects 21, 661, fractions, and empty input without committing.
5. Set a group's future-layer default to 66. Existing rows do not move; a newly added row is 66. Apply Default to Group changes existing direct rows in one history step. Reset a cross-group selection uses each group's own default. A nested child score does not change during its parent's group operation.
6. Drag the final row and rows in automation mode. Verify no object move/trim, marquee, automation-value change, audition stop, or MIDI focus change from resize. Click outside the strip and confirm those existing tools still work.
7. During a preview invoke Save: saved data contains the prior committed heights, and preview cancels. After release, invoke Save immediately: it waits for the submitted edit and saves the resulting committed height. Test Undo with the same active-versus-submitted distinction.
8. Move/reorder/delete a target from another context or change the score path mid-drag: cancel/reject without updating the replacement row. Simulate an error receipt and confirm canonical refresh; a failed acknowledgement must not falsely report that a committed height was rolled back.
9. Float the score and repeat header drag with score alignment, menu, numeric entry, Escape and blur. Re-dock or move host documents during a preview: it cancels and subsequent header handles work in the new host. Repeat at 80%, 100% and 150% app zoom and on Windows/Linux with their existing modified-wheel bindings.

## XML and Java interoperability

Use disposable project copies only.

1. Save a Java-readable SoundLayer-only project at custom height 57. Inspect the layer: integer heightIndex=2 and customHeight=57; no changes to musical fields, opaque plugin data or object order. Reopen in Electron: 57 exactly. Compare generated CSD before/after resizing for equality using the existing deterministic fixture convention.
2. Open that file in Java Blue: fallback height is 66, musical content intact. Save from Java, inspect omission of customHeight, and reopen in Electron: fixed fallback 66. This is the documented limitation, not a failed exact-custom preservation promise.
3. Repeat with a nested PolyObject and a larger custom size, preserving unrelated metadata and a musical-content/CSD comparison. Record GUI open/save and source/build versions; the planning layer-level probe alone does not establish whole-project compatibility.
4. Electron Track project: custom 333 persists through Electron save/reopen/copy with integer fallback 9. Do not mark Java-open passed: the inspected Java provider does not recognize the existing trackLayerGroup format. Verify this feature does not alter that format or claim new compatibility.
5. Load absent, malformed (`customHeight="57px"`), fractional, out-of-range and invalid legacy input fixtures. Valid legacy fallback/default displays safely; opaque custom attr survives an unrelated save. A real height change removes it; undo restores it. Untouched valid legacy fixtures retain their previous appearance.

## Performance and usability evidence

- Create a fixture with 100 visible rows (at minimum size, use a sufficiently tall browser test viewport and record dimensions), including 20 selected rows across two groups. Timestamp pointer events and the corresponding presented preview; record p95 ≤50 ms, exact aligned boundaries, one release commit, and zero per-move IPC/history writes. Record machine, OS, viewport, zoom, row count and object count. A unit test measuring only arithmetic time does not satisfy SC-004.
- During 30 seconds of resizing while real timeline playback runs, record engine generation/restart counts and audio continuity. Expect zero resize-induced restart/interruption and unchanged object timing/automation/routing. Repeat an active audition to verify the capture-handler exemption. Automated cosmetic-classification tests complement this listening/runtime check.
- Give five users an unprompted task to resize a layer and reset it to default. At least four complete within 30 seconds without modifier-key instruction. Record anonymous timings and observed difficulty. If participants are unavailable, report SC-006 unverified; do not fabricate success.

## Final implementation gate

After targeted checks pass, run the broader checks required by the cross-package change:

```sh
pnpm --filter @blue/data build
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
pnpm test
pnpm lint
git diff --check
```

Record exact results and any environment-limited/manual checks. Verify no imports violate the browser-safe data boundary, no new storage location was introduced, and every durable height writer uses canonical history.

## Planning validation record

- Spec, implementation design, data model and contracts reviewed against FR-001–FR-014 and SC-001–SC-006.
- Reference source inspection and Java layer probe completed as recorded in research.md; whole-project compatibility and implementation tests are not yet run.
- Final document formatting/whitespace checks are performed by the planning task; no production source changes are part of this phase.

## Implementation validation record

- Focused feature checks passed: `@blue/data` serialization `1/1` file and `22/22` tests; the patch/history/renderer trio `3/3` files and `54/54` tests; and the history/runtime/wheel/popout regression set `5/5` files and `217/217` tests.
- Full `pnpm test` passed: native engine `13` script tests plus `14` CTest cases; Java Maven tests; `@blue/data` `186` files and `1,882` tests passed with `1` skipped; `@blue/app` `478` files and `5,091` tests passed with `2` skipped; CLI `2` files and `5` tests passed; and workspace scripts `51` tests passed.
- The isolated performance-sensitive `meter-stress.test.tsx` rerun passed `3/3` after one transient failure during the first full run.
- Browser execution was attempted and re-run on 2026-09-15 with `pnpm --filter @blue/app test:browser src/renderer/browser/layer-height-resize.browser.test.tsx`, but the installed Chrome/Chromium process exited with `SIGABRT` and the target page/context closed before any test ran. No browser pass count is claimed; SC-001–SC-003 therefore remain unverified.
- Latest convergence-focused renderer checks passed: `@blue/app` `4/4` files and `65/65` tests for legacy no-motion/reversal, awaiting-commit projection retention, owner-document fencing, layer-height resize, modified-wheel routing, context-menu scope actions, and popout-menu regressions. The shared command-fence path is covered for drag, keyboard, numeric, preset, reset, group-default, and wheel commands, including stale-fence refresh and isolated history metadata. Group-menu coverage verifies that Reset Height to Default and Apply Default to Group are separate actions.
- Builds passed: `@blue/data` build and `@blue/app` `build:main`, `build:preload`, and `build:renderer` completed without compilation errors.
- `pnpm lint` passed, including the renderer typography audit, ESLint, workspace lint, and `prettier --check .`; `git diff --check` passed.
- Automated coverage verifies serialization, atomic patch validation, history round trips, queue revision metadata, preview cancellation/arbitration, group-default fallback, selection preservation, and cosmetic runtime classification. No new IPC channel, sidecar/default store, or data-boundary import was introduced.

### Manual and environment-limited evidence

- SC-004 is unverified: no 100-visible-row presented-frame p95 measurement or 30-second real-playback/restart-count exercise was run. The automated tests cover preview arithmetic and the zero-per-move durable-write design, but do not substitute for those measurements.
- SC-005 is partially evidenced: the automated Electron serialization/copy/unknown-attribute/default fixtures pass, and the planning-stage Java 25 layer probe used Java Blue `develop` commit `3ca3f40579c48a023299a68130d8ab6b9e950974` with POM `2.10.3` against the existing packaged jars. That probe showed Java falls back to the integer `heightIndex` and omits `customHeight` on save. A whole-project Java GUI open/save and deterministic CSD comparison was not run; the existing Java `TrackLayerGroup` format limitation remains unverified at whole-project scope.
- SC-001–SC-003 are unverified because the browser suite could not start: the Chrome process aborted with `SIGABRT` before any test executed. The focused jsdom suite does not substitute for the required browser-level drag, keyboard, zoom, alignment, final-row, automation, and two-host evidence.
- SC-006 is unverified because no five-person usability study was run.
- Two-host browser interaction, native Windows/Linux modifier behavior, and cross-platform manual validation remain unverified because browser execution aborted in this environment and only the macOS development host is available. The jsdom suites still cover host-document/capture/scroll/blur lifecycle paths and synthetic Windows-path fixtures.
