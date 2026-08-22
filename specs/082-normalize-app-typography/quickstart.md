# Quickstart: Normalize Application Typography

Run commands from `/Users/stevenyi/work/blue-electron` unless a section says
otherwise. Commands that reference new audit/token files become runnable after
their implementation task is complete.

## 1. Confirm the Design Surface

Before editing renderer UI:

```bash
git branch --show-current
test -f specs/082-normalize-app-typography/spec.md
test -f specs/082-normalize-app-typography/plan.md
test -f docs/typography.md
rg -n "docs/typography\.md" AGENTS.md
```

Expected branch: `082-normalize-app-typography`. The final two commands must pass
after the documentation task is implemented.

## 2. Run the Static Contract First

```bash
node --test scripts/audit-renderer-typography.test.mjs
pnpm audit:renderer-typography
```

Expected:

- every scanner fixture passes;
- audit JSON contains the exact seven `text-role-*` catalog entries;
- every unapproved and stale-exception count is zero; and
- `passed` is `true` with exit code 0.

Treat the complete inventory as review evidence. Do not hide a finding through a
directory exclusion or inline suppression. Add an exception only when it meets
the exact registry contract in `docs/typography.md`.

## 3. Run Focused Token, Geometry, and Compatibility Tests

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/renderer/tests/typography-tokens.test.ts \
  src/renderer/tests/mixer-layout-css.test.ts \
  src/renderer/tests/pianoroll-parity.test.ts \
  src/renderer/tests/line-object-editor-parity.test.tsx \
  src/renderer/tests/soundfont-viewer-panel.test.tsx \
  src/renderer/tests/blue-live-panels.test.tsx \
  src/renderer/tests/blue-x7-a11y-layout.test.tsx \
  src/renderer/tests/bsb-property-validation.test.ts \
  src/renderer/tests/bsb-swing-html.test.tsx \
  src/main/app-zoom-controller.test.ts \
  src/main/settings-window.test.ts \
  src/main/about-window.test.ts \
  src/main/effect-editor-window-manager.test.ts \
  src/main/track-instrument-editor-window-manager.test.ts

pnpm --filter @blue/data exec vitest run \
  src/instruments/blue-synth-builder.test.ts \
  src/instruments/blue-synth-builder/bsb-graphic-interface.test.ts
```

Also update and run existing literal-class assertions when their semantic roles
change:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/renderer/components/workbench/panels/repl-console/ReplConsolePanel.test.tsx \
  src/renderer/tests/midi-input-panel.test.tsx \
  src/renderer/tests/project-editor-panels.test.ts \
  src/renderer/tests/score-object-properties-note-processor-editor.test.tsx \
  src/renderer/tests/welcome-screen.test.tsx
```

Expected: exact catalog/body-baseline assertions, geometry regressions, window
behavior, app zoom, class assignments, and authored BSB values all pass.

## 4. Run Browser Geometry Checks

```bash
pnpm --filter @blue/app exec vitest run \
  --config vitest.browser.config.ts \
  src/renderer/browser/bsb-geometry.browser.test.tsx

pnpm --filter @blue/app exec vitest run \
  --config vitest.browser.x7.config.ts \
  src/renderer/browser/blue-x7-editor.browser.test.tsx
```

Expected: BSB authored geometry remains stable and BlueX7 passes at both the
1280×960 and 360×600 configured viewports.

## 5. Build and Run Repository Gates

```bash
pnpm --filter @blue/app build:renderer
pnpm --filter @blue/app test
pnpm --filter @blue/data test
pnpm test
pnpm lint
git diff --check
```

Root `lint` must include the production typography audit and root `test:scripts`
must include its fixture tests before handoff. Existing CI then exercises the
same gates on macOS, Windows, and Linux.

### Convergence implementation evidence (2026-08-20; updated 2026-08-21)

| Check | Result | Evidence |
|---|---|---|
| Typography audit fixtures | Pass | `node --test scripts/audit-renderer-typography.test.mjs` — 21/21 tests passed |
| Production typography audit | Pass | `node scripts/audit-renderer-typography.mjs` — `passed: true`, all unapproved/stale counts zero |
| Whitespace validation | Pass | `git diff --check` |
| Root/package validation | Pass | `@blue/app`: 357 files / 3,488 tests passed with 2 skipped; `@blue/data`: 168 files / 1,647 tests passed; elevated `pnpm test` and `pnpm lint` passed |
| Browser geometry checks | Pass | BSB: 4/4 tests passed; BlueX7: 2 files / 6 tests passed |
| Visual, zoom, and authored-boundary matrices | Pass | Requester completed the manual walkthrough on 2026-08-21 and reported no defects; detailed per-case screenshots and numeric metric ledger were not archived |

## 6. Inspect a Rendered Typography Sample

At 100% Actual Size, select a visible element in Electron DevTools and run:

```js
const style = getComputedStyle($0);
({
  fontSize: style.fontSize,
  lineHeight: style.lineHeight,
  fontFamily: style.fontFamily,
  fontWeight: style.fontWeight,
  color: style.color,
  backgroundColor: style.backgroundColor,
});
```

Record the expected semantic role and exact computed metric. For inherited text,
also record the ancestor establishing Body. For Canvas/SVG, record the role
variable resolved by the drawing path and inspect the resulting label geometry.

## 7. Execute the Two-Density Visual Matrix

Follow [contracts/visual-acceptance.md](contracts/visual-acceptance.md). Build once
and execute every V01–V10 case under:

- D1 Retina, with recorded `window.devicePixelRatio >= 2`; and
- D2 physical standard-density or verified emulation, with recorded
  `window.devicePixelRatio === 1`.

If DPR-1 emulation does not actually report 1, the run is invalid; use a physical
standard-density display. Record role metrics, contrast, geometry, interaction,
and screenshot evidence for every case.

### 100% execution record

Manual acceptance attestation (2026-08-21): the requester completed every row at the
required D1/D2 display profiles and reported no defects. The records below preserve
the required coverage without inventing per-case screenshot or metric artifacts.

| Profile | Case | DPR | Result | Evidence / defects / rerun |
|---|---|---:|---|---|
| D1 | V01 | user-verified | Pass | User-attested; no defect reported |
| D1 | V02 | user-verified | Pass | User-attested; no defect reported |
| D1 | V03 | user-verified | Pass | User-attested; no defect reported |
| D1 | V04 | user-verified | Pass | User-attested; no defect reported |
| D1 | V05 | user-verified | Pass | User-attested; no defect reported |
| D1 | V06 | user-verified | Pass | User-attested; no defect reported |
| D1 | V07 | user-verified | Pass | User-attested; no defect reported |
| D1 | V08 | user-verified | Pass | User-attested; no defect reported |
| D1 | V09 | user-verified | Pass | User-attested; no defect reported |
| D1 | V10 | user-verified | Pass | User-attested; no defect reported |
| D2 | V01 | user-verified | Pass | User-attested; no defect reported |
| D2 | V02 | user-verified | Pass | User-attested; no defect reported |
| D2 | V03 | user-verified | Pass | User-attested; no defect reported |
| D2 | V04 | user-verified | Pass | User-attested; no defect reported |
| D2 | V05 | user-verified | Pass | User-attested; no defect reported |
| D2 | V06 | user-verified | Pass | User-attested; no defect reported |
| D2 | V07 | user-verified | Pass | User-attested; no defect reported |
| D2 | V08 | user-verified | Pass | User-attested; no defect reported |
| D2 | V09 | user-verified | Pass | User-attested; no defect reported |
| D2 | V10 | user-verified | Pass | User-attested; no defect reported |

## 8. Execute the Zoom Matrix

At 50%, 100%, 200%, and 300%, complete the named essential action in the main
workbench, Settings, and one application-owned editor. At 300%, scrolling is
acceptable; at 50%, whole-interface scaling is intentional. In neither case may
the source typography role change to force content into the viewport.

| Zoom | Workbench | Settings | Editor | Evidence / defects / rerun |
|---:|---|---|---|---|
| 50% | Pass | Pass | Pass | User-attested; no defect reported |
| 100% | Pass | Pass | Pass | User-attested; no defect reported |
| 200% | Pass | Pass | Pass | User-attested; no defect reported |
| 300% | Pass | Pass | Pass | User-attested; no defect reported |

## 9. Confirm Authored Project Preservation

Round-trip fixtures must cover dropdown sizes 8/12/36, font-object sizes
1/12/200, imported Swing HTML sizing, and unrelated/unknown XML. V06 must also
show that nearby BSB application chrome uses semantic roles.

| Fixture group | Automated round trip | V06 rendered boundary | Evidence |
|---|---|---|---|
| Dropdown 8/12/36 | Pass | Pass | Package round-trip suites pass; user-attested V06 pass |
| Font object 1/12/200 | Pass | Pass | Package round-trip suites pass; user-attested V06 pass |
| Imported Swing HTML | Pass | Pass | Focused BSB suite passes; user-attested V06 pass |
| Unknown/unrelated XML | Pass | N/A | Package round-trip suites pass |

## Closure Note (2026-08-21)

The requester completed the manual typography walkthrough covering the two-density
V01–V10 matrix, the 50/100/200/300% zoom matrix, and authored-font preservation
boundaries, and reported no defects. This is recorded as user-attested acceptance;
the repository does not contain separate screenshot files or a per-case numeric
measurement ledger.

## Handoff Criteria

The feature is ready for implementation handoff only when planning artifacts have
no unresolved clarification markers. The implementation is ready for review only
when:

- the static audit passes with zero unapproved/stale findings;
- focused, browser, package, and repository gates pass;
- all 20 density/case rows and every zoom action pass;
- authored project values round-trip exactly;
- `docs/typography.md` matches delivered code and its exception registry; and
- `AGENTS.md` contains the valid UI-work reference to the guide.
