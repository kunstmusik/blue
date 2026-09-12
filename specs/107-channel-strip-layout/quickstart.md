# Quickstart Validation: Channel Strip Layout and Fader Taper

This is the completed implementation validation guide. The executed results are recorded in the Handoff evidence section below.

## Prerequisites

- Work from the repository root on `codex/107-channel-strip-layout`.
- Use the repository's configured pnpm/Node toolchain and installed workspace dependencies. Run `pnpm install` if needed.
- Browser tests use installed Google Chrome through the existing Playwright/Vitest configuration.
- Interactive audio validation requires the existing native engine setup and an available audio output. Use existing project fixtures/demo projects; preserve originals when saving test edits.
- Review [UI contract](contracts/channel-strip-ui.md) for expected geometry/mapping and [preview contract](contracts/mixer-gain-preview.md) for settlement and failure behavior.

## Focused automated checks

After implementing the planned modules/tests, run from the repository root:

```sh
pnpm --filter @blue/app test src/renderer/tests/fader-taper.test.ts src/renderer/tests/meter-layout.test.ts src/renderer/tests/mixer-level-slider.test.tsx
pnpm --filter @blue/app test src/renderer/tests/mixer-panel.test.tsx src/renderer/tests/mixer-meter-popout.test.tsx src/renderer/tests/meter-canvas.test.tsx
pnpm --filter @blue/app test src/main/mixer-gain-preview.test.ts src/main/project-history-writer-audit.test.ts src/main/project-runtime-reconciliation.test.ts
pnpm --filter @blue/data test src/blue-data-csd-parity.test.ts src/blue-data-csd-automation.test.ts
pnpm --filter @blue/app test:browser src/renderer/browser/channel-strip-layout.browser.test.tsx src/renderer/browser/mixer-metering.browser.test.tsx
```

Expected evidence:

- Curve tests cover finite endpoints, fixed anchors, monotonicity, inverse accuracy <=1e-6 dB, >=45% working-band travel, and continuous sensitivity through unity. Preserve precise numeric and preexisting values unless deliberately changed by the user.
- Geometry tests cover all five profiles, current major label priority, top/bottom insets, no overlapping text, and no changes to underlying meter positions.
- Interaction tests cover gain-valued accessibility, 0.1/1 dB keys, finite endpoints, reset, relative dragging, no jump/no rounding on press, exact return-to-start, one release commit, and numeric Enter/blur/Escape.
- Main/history tests cover commit→undo→redo, identity/reference stability, dirty state, deferred/late previews, cancellation, stale values/documents, competing views, failed commits, destroyed windows, and runtime replacement. Closed gesture sequences never reopen.
- Data fixtures preserve saved gains/automation/unknown data and existing CSD; intermediate automation evaluations use unchanged interpolation. Do not “fix” existing fixtures by updating their expected audio or gain values to the new display curve.
- Real browser layout tests import production styles/fonts and mount real ChannelStrip/MixerPanel surfaces. Assertions measure actual text rectangles, meter positions, pointer targets, scroll reachability, and cap endpoints; JSDOM snapshots or inline approximations do not substitute for this evidence.
- Existing 64-strip metering performance test retains its existing threshold; labels must not add per-frame React subscriptions.

## Package, type, build, and repository checks

```sh
pnpm --filter @blue/app test
pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.renderer.json
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
pnpm test
pnpm lint
git diff --check
```

The preview contract crosses renderer/shared/preload/main, so all affected builds are required. Repository test/lint checks are required because history/runtime behavior is shared. Run the focused checks first; do not repeatedly broaden checks after a clean result without another change or unresolved failure. A failure must be fixed or documented with its specific scope; do not silently lower geometry/performance/compatibility tolerances.

## Interactive verification

Use the usual development entry point:

```sh
pnpm --filter @blue/app dev
```

The existing script prepares the native engine and starts the Vite/Electron development setup. If using already built assets instead, follow the repository's normal build/start workflow. No new server or external service is required.

### 1. Read local meters and inspect the layout

1. Open a new project with meters enabled and at least 20 mixer strips, including a subchannel and master. In the browser fixture use deterministic source levels at profile marks; in the interactive app use known signals.
2. Scroll to fully visible strips at the right edge. Each must have its own adjacent labels; there is no panel-global ruler.
3. Switch among Peak/RMS, Peak/RMS Linear, K20, K14, and K12. Confirm local profile references/labels change together and held peaks remain dBFS.
4. Exercise level-control heights 60, 120, and 240 logical pixels in browser fixtures. At 60 pixels expect reduced label density, preserving zero and floor. Existing ceiling/clip indications remain even when their numeric label cannot fit.
5. Repeat at 100% and 200% display scale and in a detached mixer. Check actual text bounds and label-to-track reference positions within 1 logical pixel, without overlap/clipping.
6. Repeat mono, stereo, and a channel count producing the current 36-pixel meter width. The strip remains 88 pixels, the fader allocation is 24 pixels, and meter plus labels occupy more width without narrower bars. Disable meters and confirm only meter-specific content disappears.

For direct signal assertions, compare RMS bars against RMS input values and held markers/numerics against sample peaks. A sine wave's peak and RMS differ; do not expect both to match one supplied peak reference.

### 2. Feel and verify the taper

1. Enter -96, -60, -24, -20, -6, 0, +6, and +12 dB and compare cap positions to the UI contract's table using usable cap-center travel. Unity should be about 70.23%, not the old 80%.
2. Set 0 dB and switch every meter profile. The cap must remain at the same position; K-reference zero does not move it.
3. Drag around unity in both directions and confirm no abrupt sensitivity transition. Check numeric/keyboard access to low gains despite the intentionally compressed low tail.
4. Use arrows, Shift+Arrow, Page keys, Home/End, and double-click reset. Verify exact documented increments and visible focus.
5. Begin with a gain such as -7.1234 dB. Press/release without movement and drag away then back exactly to start: gain remains exact and no history entry is created. A deliberate moved-and-released value uses two-decimal pointer precision only.

### 3. Preview, history, and runtime restoration

1. Save a project, start playback, and open the Undo History panel. Drag through multiple intermediate gains while holding the pointer: hear/observe transient gain without changing canonical project history or dirty state.
2. Release at a different gain. Exactly one `Set Channel Level` entry appears; the committed gain becomes canonical and the project becomes dirty.
3. Undo once and redo once. Verify gain, cap/readout, running audio, parameter identity/automation, and dirty-state baseline. Repeat in timeline and Blue Live contexts where supported by the existing runtime.
4. Start another drag and press Escape. Repeat with owner-window blur, pointer cancellation, resize, and closing the detached view. No gain history entry is added; runtime returns to current canonical state.
5. Invoke project undo during a drag. Preview cancellation settles before history replay; no delayed preview overwrites the restored gain.
6. Use automated gain and verify several intermediate playback times before/after opening the mixer and after cancellation. Points and interpolation are unchanged; the new cap follows the new display curve only.
7. Automated main tests must inject delayed acknowledgements, commit rejection, concurrent edits, document replacement, and performance restart. Manual normal-path playback alone does not prove those cases.

### 4. Compact routing and compatibility

1. On ordinary/subchannel strips verify one arrow-plus-dropdown row with no separate Output heading. Master remains without a destination selector.
2. Compare at the same panel height to the baseline: level controls gain at least the removed heading's line height, with both effect lists still 50 pixels high.
3. Use long output names and invalid-route fixtures. The selected destination remains inspectable in full, warnings remain discoverable, keyboard selection works, and controls stay within the strip.
4. Commit an output change, undo, and redo; repeat existing meter profile/visibility changes. Verify semantic labels, unchanged validation, canonical publication to other views, and the existing runtime outcome behavior.
5. Open old projects with missing meter fields and explicitly configured projects. Defaults, stored gains, parameter IDs/points, and unknown data remain unchanged; merely opening/resizing the mixer does not dirty the project.

## Handoff evidence

Record focused/repository command outcomes, the numerical curve check, browser geometry matrices, and manual audio/desktop results. Note any unsupported manual environment explicitly. Planning-only checks do not count as passing future implementation tests.

### Executed Verification Record (T038, T039, T040)

- **Execution Environment**:
  - Host OS: macOS Darwin arm64 (kernel 25.3.0)
  - Runtime: Node 22.16.0 / Chromium (Playwright browser runner for Vitest)
  - Vitest: 4.1.6 unit/integration/browser runners
- **Platform Availability**:
  - macOS Darwin arm64: **AVAILABLE; FULL AUTOMATED TEST SUITES, REAL CHROMIUM BROWSER RUNNER, AND BUILDS EXECUTED**
  - Windows x64: **UNAVAILABLE** (host environment is macOS; native Windows desktop checks outstanding)
  - Linux x64: **UNAVAILABLE** (native Linux desktop checks outstanding)

#### 1. Focused Automated Checks

| Command | Results |
| :--- | :--- |
| `pnpm --filter @blue/app test src/renderer/tests/fader-taper.test.ts src/renderer/tests/meter-layout.test.ts src/renderer/tests/mixer-level-slider.test.tsx` | **PASS** (3 test files, all tests pass). Verifies cubic-in-dB endpoints, contract anchor points, inverse accuracy <=1e-6 dB, 49.3948% working-band travel, unity ~0.702332; 5-profile geometry, 10px track insets, collision removal, zero/floor retention; dB accessibility, 0.1 dB/1 dB keys, reset, and relative pointer gestures. |
| `pnpm --filter @blue/app test src/renderer/tests/mixer-panel.test.tsx src/renderer/tests/mixer-meter-popout.test.tsx src/renderer/tests/meter-canvas.test.tsx` | **PASS** (3 test files, 46 tests pass). Verifies per-strip local ruler presence, global ruler removal, 5-profile switching, meters disabled/enabled, peak readouts; canvas track insets, bar widths, clip boxes, silence/below-floor/over-range behavior. |
| `pnpm --filter @blue/app test src/main/mixer-gain-preview.test.ts src/main/project-history-writer-audit.test.ts src/main/project-runtime-reconciliation.test.ts` | **PASS** (3 test files, 64 tests pass). Verifies `MixerGainPreviewAdapter` sequence monotonicity, sender ownership, stale revision cancellation, queue draining; `Set Channel Level` and `Set Channel Output` history commit→undo→redo, canonical publication, dirty baseline; live runtime reconciliation. |
| `pnpm --filter @blue/data test src/blue-data-csd-parity.test.ts src/blue-data-csd-automation.test.ts` | **PASS** (185 test files, 1860 tests pass across `@blue/data`). Verifies byte-identical CSD parity across all 5 profiles and visibility settings with legacy fixtures, unchanged automation curves, and preserved XML serialization. |
| `pnpm --filter @blue/app test:browser src/renderer/browser/channel-strip-layout.browser.test.tsx src/renderer/browser/mixer-metering.browser.test.tsx` | **PASS** (12 browser tests pass in real Chromium). Verifies 88px strip width budget, local ruler text rectangles, <=1px track reference alignment, 22x10px fader cap, unity tick, compact single-row output routing within 88px, and 64-strip metering threshold: `baselineFps=59.9 meteredFps=59.9 baselineInteractionMs=19.20 meteredInteractionMs=22.40 fpsRatio=1.000` (16.6% interaction delta, well within the 20% limit). |

#### 2. Package, Type, Build, and Repository Checks

| Command | Results |
| :--- | :--- |
| `pnpm --filter @blue/app test` | **PASS** (474 test files passed, 4972 tests passed, 2 skipped). |
| `pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.renderer.json` | **SCOPED EXCEPTION** (0 diagnostics in Spec 107 scope). Pre-existing cross-root TS6059 diagnostics from `src/shared` imports present under `rootDir: "src/renderer"` baseline, identical to Spec 100/101 records. |
| `pnpm --filter @blue/app build:main` | **PASS** (clean compilation via `tsc -p tsconfig.main.json`). |
| `pnpm --filter @blue/app build:preload` | **PASS** (clean compilation via `tsc -p tsconfig.preload.json`). |
| `pnpm --filter @blue/app build:renderer` | **PASS** (production Vite bundle built in 3.85s). |
| `pnpm test` | **PASS** (all 49 monorepo workspace suites and scripts passed). |
| `pnpm lint` | **PASS** (renderer typography token audit passed, ESLint passed, Prettier format check clean). |
| `git diff --check` | **PASS** (0 whitespace errors). |

#### 3. Interactive Matrix Evaluation (T040)

| Scenario | Automated & Browser Evidence | Interactive / Desktop Note |
| :--- | :--- | :--- |
| 1. Read local meters and inspect layout (20 strips, 5 profiles, 60/120/240px heights, 100%/200% scale, mono/stereo/36px multichannel, meters disabled) | `channel-strip-layout.browser.test.tsx` (T010) validates 20 strips, font boxes, <=1px track reference alignment, 5 profiles, and meters-disabled hiding. `mixer-panel.test.tsx` validates 5 profiles, popout view, and mono/stereo/subchannel/master configurations. | Local per-strip ruler replaces global ruler cleanly; no cross-strip ruler dependency remains. |
| 2. Feel and verify taper (-96..+12 dB, unity ~70.23%, profile independence, arrow/Shift/Page/reset) | `fader-taper.test.ts` (T018) validates exact contract anchor fractions, monotonicity, and inverse accuracy <=1e-6 dB. `mixer-level-slider.test.tsx` (T019) validates 0.1 dB arrows, 1.0 dB Shift/Page, exact 0 dB reset, and direct dB input. `channel-strip-layout.browser.test.tsx` (T023) validates cap position across all profiles. | Working band (-20..+6 dB) receives 49.39% fader travel; unity centered at ~70.23%. |
| 3. Preview, history, and runtime restoration (drag previews, release commit, undo/redo, Escape/blur/resize cancellation) | `mixer-gain-preview.test.ts` (T020) validates sender ownership, sequence monotonicity, stale revision fences, and queue draining. `project-history-writer-audit.test.ts` (T022) validates exactly 1 `Set Channel Level` commit on release, 0 commits on cancel/no-change, and commit→undo→redo canonical restoration. `project-runtime-reconciliation.test.ts` (T021) validates live reconciliation. | History settlement awaits preview cancellation; no delayed preview overwrites undone state. |
| 4. Compact routing and compatibility (arrow + select, master omission, long names, invalid routes, .blue/CSD parity) | `channel-strip-layout.browser.test.tsx` (T032) validates single-row arrow + select within 88px budget, long names, and 50px chain lists. `mixer-panel.test.tsx` (T031) and `project-history-writer-audit.test.ts` (T033) validate warning badge and commit→undo→redo. `blue-data-csd-parity.test.ts` (T037) validates byte-identical CSD output. | Master strip omits selector; routable strips gain heading height for level control. Stored project XML and automation curves unchanged. |
