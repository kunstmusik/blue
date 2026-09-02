# BlueX7 Tabbed UI Validation Guide

## Prerequisites

- Run from `/Users/stevenyi/work/blue-electron`.
- Install workspace dependencies with the repository's normal `pnpm install` workflow.
- For browser layout coverage, a Chromium/Chrome executable supported by the Vitest Playwright
  configuration must be available.

## Focused renderer tests

Run the existing and feature-focused BlueX7 suites:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/renderer/tests/blue-x7-editor.test.tsx \
  src/renderer/tests/blue-x7-a11y-layout.test.tsx \
  src/renderer/tests/blue-x7-effective-values.test.tsx \
  src/renderer/tests/blue-x7-undo.test.tsx \
  src/renderer/tests/blue-x7-envelope.test.tsx \
  src/renderer/tests/blue-x7-csound-preview.test.tsx
```

Expected outcome: all existing patch, import, accessibility, effective-value, undo/redo, and
gesture tests pass, plus assertions for top-level and nested tab semantics, presentation-only
state, active-view request partitioning, activation refresh, and gesture completion.

Run browser geometry/focus coverage at the configured desktop and narrow viewports:

```bash
pnpm --filter @blue/app test:browser:x7
```

Expected outcome: the active tabpanel fits the host, the top-level bar does not wrap below
500px, Csound Post Code fills the available height, and keyboard/focus behavior works in an
actual Chromium layout engine.

## Compatibility regression checks

```bash
pnpm --filter @blue/data exec vitest run \
  src/instruments/blue-x7.test.ts \
  src/instruments/blue-x7/parameter-catalog.test.ts \
  src/instruments/blue-x7/voice-transport.test.ts \
  src/instruments/blue-x7/modern-render.integration.test.ts
pnpm --filter @blue/app build:renderer
git diff --check
```

Expected outcome on a functioning Csound host: the 151-entry catalog, Java-default/unknown XML
round trips, stable automation identities, modern Csound target, and transport tests remain
green. Renderer build and whitespace validation complete without new warnings.

Planning baseline note: on 2026-09-01 the four-file data run passed 59/60 tests. The existing
`modern-render.integration.test.ts` locked-hash assertion received
`0a385a4cbc4ff7da579f534429d25426738e0243859827e1ff91d767467e7854` instead of the accepted
`82012869f2451e4968a0646b5a9d4329cc0c89cbcac277f7c2fe8238453882c6`. This predates the planned
renderer-only change and must be rechecked/triaged separately; no implementation task should
silently update that reference hash.

The browser baseline could not run in this environment because the configured Chrome process
exited with `SIGABRT` before test execution. Re-run the browser command on a functioning
Chromium host before accepting the layout portion of the feature.

For the final repository handoff, run the affected package checks and then the broader gates
required by the repository:

```bash
pnpm --filter @blue/app test
pnpm lint
pnpm test
```

## Manual acceptance flow

1. Open a BlueX7 editor from the Orchestra panel and from the track-instrument editor/popout.
   Confirm that each fresh editor begins on Voice & Global with Op 1 selected.
2. Click each top-level tab. Confirm the header and Undo/Redo remain present, the active panel
   owns the available viewport, and the outer editor does not scroll through inactive sections.
3. In Operators, select Op 2 and a muted operator. Edit a numeric field and drag an envelope
   handle; confirm the patch is for the selected operator, the muted indicator is visible, and
   one completed drag creates one undo step.
4. Start a drag and activate another top-level tab before releasing. Confirm the staged value
   commits once (or is safely canceled with no partial patch) and focus is not left on a hidden
   control.
5. In Csound, edit Post Code and switch to another top-level tab and back. Confirm the editor uses
   the panel height, no nested Csound tabs are shown, and edits retain their existing
   mutation/history behavior.
6. During playback or BlueLive effective-value observation, switch between Global, Operators,
   Pitch, and Csound. Inspect the preload request mock/log: hidden-tab IDs must be absent, Csound
   must issue no empty request, and the newly active controls must receive values within one
   20 Hz interval.
7. Resize below 500px and use only the keyboard. Confirm one-row horizontal tab scrolling,
   selected/focused ARIA tab semantics, Enter/Space activation, and Tab traversal into the
   active panel.

## Closure record

- Manual acceptance: completed by the requester on 2026-09-01; the specified BlueX7 workflows
  were reviewed and reported as working as intended.
- Implementation: tasks T001–T039 are complete, including the convergence fixes for runtime
  readback validation, request-generation ownership, live Pitch display, gesture cleanup,
  per-mount ARIA identity, canonical SysEx synchronization, and docked/track host coverage.
- Automated checks: `@blue/app` passed 4,022 tests with 2 skipped; renderer/main/preload builds,
  lint, script checks, and `git diff --check` passed.
- Exceptions: the four-file `@blue/data` check still has the pre-existing modern-render hash
  mismatch, and the configured Chrome process still exits with `SIGABRT` before browser tests
  launch. These remain tracked validation limitations and were not silently rebaselined.

See [`data-model.md`](data-model.md), [`contracts/blue-x7-tabs.md`](contracts/blue-x7-tabs.md),
and [`contracts/visual-acceptance.md`](contracts/visual-acceptance.md) for the state, DOM, and
visual invariants being validated.
