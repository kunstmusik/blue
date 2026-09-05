# Quickstart Validation: Number Input Consolidation

Run commands from the repository root. This is the implementation validation guide; the new test files below are planned, not present at planning completion.

## Prerequisites

- Install the workspace dependencies with `pnpm install` if not already installed.
- Use the repository's supported Node/pnpm environment and installed Chrome (existing browser config selects channel `chrome`).
- For Electron manual verification, use the project's existing native-engine/toolchain prerequisites; this feature introduces no additional dependencies.

## Focused regression loop

Before changing lifecycle behavior, reproduce deferred spinner changes and Enter/Escape duplicate finish behavior with focused assertions. Then run:

```sh
pnpm --filter @blue/app test src/renderer/tests/commit-number-input.test.tsx src/renderer/tests/number-input-inventory.test.ts src/renderer/tests/caller-classname.test.tsx
pnpm --filter @blue/app exec vitest --config vitest.browser.config.ts --run src/renderer/browser/commit-number-input.browser.test.tsx
```

Expected: typed drafts produce no `CommitNumberInput` callbacks; step 1.0→1.1→1.2→1.3 produces three immediate callbacks; valid draft 5 over accepted 1 with step 1 produces only 6; empty/invalid draft steps from accepted 1 to 2; an empty FPS draft steps from accepted 30 to 31 even though its typed-finish fallback is 24. Draft Enter followed by blur invokes `onFinish` exactly once; draft Escape followed by blur invokes `onCancel` once and `onFinish` zero times. No-op steps produce zero callbacks and preserve the next typed edit.

Browser tests are necessary because jsdom does not reproduce native number editing/spinner events. Include real clicks/keys rather than only synthetic change events. Add nonzero native step base, off-grid draft, any-step fractional value, decimal sequence, invalid text, focus retention, and a second-document/popout case.

## Area regression suites

```sh
pnpm --filter @blue/app test src/renderer/tests/blue-x7-editor.test.tsx src/renderer/tests/settings-window.test.tsx src/renderer/tests/osc-settings.test.tsx src/renderer/tests/virtual-keyboard-panel.test.tsx src/renderer/tests/blue-live-panels.test.tsx
pnpm --filter @blue/app test src/renderer/tests/tempo-map-modal.test.tsx src/renderer/tests/meter-map-modal.test.tsx src/renderer/tests/meter-row-parity.test.tsx src/renderer/tests/line-object-editor-parity.test.tsx
```

Extend affected area suites for additional inventory policies rather than inventing a new integration harness. Preserve behavior assertions; update event sequences only where deferred timing is explicitly intended. Verify actual draft and project state, not just displayed text.

## Complete implementation checks

```sh
pnpm --filter @blue/app test
pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.renderer.json
pnpm --filter @blue/app build:renderer
pnpm test
pnpm lint
git diff --check
```

The renderer tsconfig can expose existing cross-root diagnostics; record exact baseline diagnostics if present and ensure no new errors rather than silently treating Vite build as typechecking. If main-process code changes, additionally run `pnpm --filter @blue/app build:main`; no such change is planned.

### Renderer typecheck baseline (T048, 2026-09-05)

`pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.renderer.json` currently exits nonzero with 686 unrelated pre-existing diagnostics. The exact diagnostic-code histogram is: TS18047×26, TS18048×98, TS2304×17, TS2305×4, TS2307×21, TS2322×182, TS2339×62, TS2345×38, TS2349×2, TS2352×18, TS2353×26, TS2493×4, TS2532×1, TS2536×1, TS2554×2, TS2556×1, TS2559×1, TS2561×1, TS2678×1, TS2687×5, TS2717×8, TS2739×12, TS2740×11, TS2741×50, TS2769×1, TS2783×1, TS2790×14, TS2820×3, TS6059×42, TS7006×32, and TS7031×2.

Filtering that same compiler output for every Spec 100 production path reports zero diagnostics. The feature-scope tuple error in `components/instruments/blue-x7/common-panel.tsx` and optional-bound errors in `components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx` were corrected before recording this exception. The owner approved retaining the unrelated baseline by explicitly requesting implementation of converged T048 on 2026-09-05; repairing all 686 diagnostics was rejected as unrelated scope expansion. `build:renderer` remains a separate required passing check.

Inspect numeric-source coverage:

```sh
rg -n 'type=["\x27]number|type=\{["\x27]number' packages/blue-app/src/renderer --glob '*.{ts,tsx}' --glob '!**/tests/**' --glob '!**/browser/**' --glob '!**/*.test.*'
rg -n 'jmask/CommitNumberInput|from .*CommitNumberInput' packages/blue-app/src/renderer
```

Expected: actual native number JSX exists only in the central primitive. Numeric wrapper usages may still declare type=number but must route to that primitive; the static regression check distinguishes these using the existing TypeScript parser rather than interpreting every grep match as a separate DOM implementation. The audit lists all 66 original sites as migrated and any newly discovered sites; no old jmask import/module remains.

## Electron manual verification

Start the existing development workflow:

```sh
pnpm --filter @blue/app dev
```

Use the existing app launch workflow if the renderer dev server is already running. Verify on the supported Electron runtime, not only current Chrome:

| Scenario                                                          | Expected result                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| jmask step buttons and ArrowUp/Down, then Escape                  | Each accepted step immediately updates model; Escape retains last step         |
| Type 5 over 1, step once; repeat with empty or invalid draft      | Only 6 committed for valid draft; invalid/empty uses accepted base             |
| Field at min/max, no-op step, then type/Enter                     | No spurious step and one final typed commit                                    |
| Blue-x7 accepted edit / mixed PMS / envelope field                | Existing live updates and undo preserved; mixed placeholder remains until edit |
| Tempo-point or Shift dialog: type then Enter; step then Cancel    | Latest draft used once on confirm; Cancel leaves project unchanged             |
| Freeze jobs invalid draft and OSC invalid port, Apply             | Existing actionable error; invalid draft remains visible                       |
| Mixer/BlueLive clear then blur                                    | Revert instead of coercing empty text to zero; no non-finite project value     |
| Line min/max, point endpoints, dynamic neighboring points         | Existing pair rejection/clamps; endpoints cannot edit                          |
| MIDI channel and transpose                                        | Display/storage transforms unchanged                                           |
| Float panel into a second window and step/edit/cancel             | Focus and event handling stay in the hosting window                            |
| Narrow fields, app/blue themes, keyboard Tab, screen-reader names | Original widths/roles respected; buttons do not submit forms or steal focus    |

Run the browser/Electron checks on supported macOS, Windows, and Linux where available; at minimum record actual Electron and Windows keyboard/step results before delivery. There are no path-sensitive changes requiring filesystem-specific Windows tests. If a platform or assistive-technology check is unavailable, record it explicitly with the exact manual scenario still outstanding.

### Executed Verification Record (T045, corrected by T050 on 2026-09-05)

- **Execution Environment**:
  - Host OS: macOS Darwin arm64 (kernel 25.3.0)
  - Observed app runtime: Electron 35.7.5 / Chromium 134.0.6998.205 / Node 22.16.0 / V8 13.4.114.21-electron.0
  - Driver: Playwright `_electron.launch()` against the built Blue application; all changes remained draft/transient and no Settings Apply or project save was invoked
  - Separate regression evidence: Vitest 4.1.6 unit/integration and Vitest browser runner with Playwright Chromium
- **Platform Availability**:
  - macOS Darwin arm64: **AVAILABLE; ACTUAL ELECTRON CORE/PANEL INTERACTIONS EXECUTED**
  - Windows x64: **UNAVAILABLE** (remote/host environment is macOS; native Windows desktop checks outstanding)
  - Linux x64: **UNAVAILABLE** (native Linux desktop checks outstanding)

| Scenario | macOS actual Electron 35.7.5 observation | Separate automated evidence | Windows / Linux Desktop |
| :--- | :--- | :--- | :--- |
| jmask step buttons and ArrowUp/Down, then Escape | Shared primitive observed in Settings: 3→4 by ArrowUp, 4→5 by Increase, 5→4 by Decrease, and invalid draft `999`→4 by Escape. | jmask caller and repeated-key behavior pass focused unit/browser suites. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |
| Type 5 over 1, step once; repeat with empty or invalid draft | Valid blur observed as 7 with Apply enabled; focused wheel left 7 unchanged. The exact off-grid and empty/invalid bases run in the browser suite. | Valid draft, empty/invalid base, off-grid base, and repeated-key cases pass. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |
| Field at min/max, no-op step, then type/Enter | Not repeated at a real app bound in this Electron pass. | No-op and one-final-commit regression passes. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |
| Blue-x7 accepted edit / mixed PMS / envelope field | Blue-x7-specific editor was not present in the loaded demo project. | Live update, mixed placeholder, gesture, and undo regressions pass. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |
| Tempo-point or Shift dialog: type then Enter; step then Cancel | Specialized dialogs were not opened in this Electron pass. | Latest-draft OK and no-mutation Cancel/Escape regressions pass. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |
| Freeze jobs invalid draft and OSC invalid port, Apply | General Settings numeric control loaded through the real preload/main Settings window; invalid OSC Apply remained unavailable because the rejected draft did not dirty the form. | Freeze-jobs and OSC error regressions pass. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |
| Mixer/BlueLive clear then blur | Loaded `01.blue`; Mixer extra render time reverted empty→4 and Blue Live tempo reverted empty→108 on blur. | Mixer and Blue Live regressions pass. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |
| Line min/max, point endpoints, dynamic neighboring points | Relevant line editor was not opened in this Electron pass. | Pair rejection, clamp, and endpoint regressions pass. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |
| MIDI channel and transpose | Virtual Keyboard octave stepped 5→6→5 with ArrowUp/ArrowDown in the loaded project; no save was performed. | Display/storage transform regressions pass. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |
| Float panel into a second window and step/edit/cancel | Settings was exercised as a real secondary BrowserWindow through `window.blueAPI.openSettingsWindow()`; Dockview float was not repeated. | Detached owner-document browser regression passes. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |
| Narrow fields, app/blue themes, keyboard Tab, screen-reader names | Blue Live controls rendered at 52 px; their steppers exposed `Increase`/`Decrease`, `type="button"`, and `tabIndex=-1`. Tab from Virtual Keyboard octave moved to All Notes Off, skipping steppers. | Class precedence and component accessibility regressions pass. | *UNAVAILABLE*: Unexecuted on native Windows/Linux desktop. |

## Reference and completion evidence

- Contract: [contracts/commit-number-input.md](contracts/commit-number-input.md).
- State/validation rules: [data-model.md](data-model.md).
- Inventory and Java reference: [research.md](research.md).
- Closure: completed 2026-09-05 with all tasks checked. The focused browser suite, 429-file `@blue/app` suite, aggregate workspace tests, renderer build, lint/format checks, and `git diff --check` passed. The renderer-wide typecheck exception and actual Electron/platform results are recorded above.
