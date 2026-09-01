# Implementation Plan: BlueX7 Tabbed User Interface

**Branch**: `094-bluex7-tabbed-ui` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/094-bluex7-tabbed-ui/spec.md`

**Note**: This plan ends after Phase 1 design. Task decomposition belongs to `/speckit-tasks`.

## Summary

Recompose the BlueX7 renderer editor into four client-side top-level views—Voice & Global,
Operators, Pitch Envelope, and Csound & Code—while keeping the metadata/effective-value header
and undo/redo controls visible. The implementation will reuse the repository's keep-mounted
panel pattern, add one local ARIA tab-list primitive for the top-level and nested tab lists,
derive visible effective-value requests from the active view, and give the Csound editor the
full available panel height. Voice mutation, history, SysEx import, automation parameters,
serialization, and Csound generation remain on their existing paths; the only intentional
divergence from Java Blue is renderer presentation/layout.

## Technical Context

**Language/Version**: TypeScript 5.8 with React 19.2 and JSX in the Electron renderer

**Primary Dependencies**: React/React DOM, Tailwind CSS 4.1 semantic utilities, `@blue/data`
for the existing voice/catalog types, `codemirror` 6 through `SelectedCodeEditor`,
`lucide-react`, and the existing `AppSelect`/renderer components. No new runtime dependency.

**Storage**: No new storage. `BlueData` remains the canonical project owner through the existing
document bridge; tab, focus, sub-tab, effective readback, preview, and gesture state remain
renderer-local/disposable.

**Testing**: Vitest 4.1 jsdom renderer suites for DOM/patch/history/polling behavior, the
existing Vitest Playwright browser suite for real layout/focus/viewport checks, and existing
`@blue/data` XML/catalog/transport/modern-render regression suites.

**Target Platform**: Electron desktop Chromium renderer in the docked Orchestra panel and track
instrument editor/popout, with desktop heights of 600px+ and narrow hosts below 500px width.

**Project Type**: Desktop application UI feature.

**Performance Goals**: Top-level activation under 16ms without layout shift; active effective
values sampled at the existing 20 Hz default with the first active-view request issued on
activation and visible values refreshed within one 50ms interval; at most one readback request
in flight.

**Constraints**: No changes to the 151 automation descriptors/semantic keys, typed patch or
preload contracts, `.blue` XML, unknown-data preservation, CSD generation, modern module
compilation, or SysEx parsing. The outer editor must not page-scroll through inactive sections;
the top-level tab bar must remain one horizontal row below 500px; all application text must use
the seven approved typography roles; pending envelope gestures must finish safely before a panel
becomes hidden.

**Scale/Scope**: One BlueX7 editor instance at a time per panel/window, four top-level tabs, six
operator sub-tabs, three Csound sub-tabs, up to 151 catalog parameters, and both docked and
popout hosts. The feature is renderer-only; the original request's audio-synthesis comparison
does not expand this implementation beyond the specified presentation change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial gate (before Phase 0 research)

- **Portable data core**: **PASS** — production changes are confined to
  `packages/blue-app/src/renderer`; `@blue/data` remains untouched and therefore free of
  Electron, Node.js built-ins, DOM-only APIs, dynamic imports, and host implementation details.
- **Java and project compatibility**: **PASS** — the Java reference is
  `blue-ui-core/src/main/java/blue/ui/core/orchestra/editor/BlueX7Editor.java`, with
  `BlueX7.java` and existing TypeScript fixtures as data references. The plan changes no
  `.blue` XML, CSD, modern module, SysEx, or parameter behavior. The renderer's four-view
  organization is the intentional presentation-only divergence named in the spec.
- **Canonical ownership and contracts**: **PASS** — `BlueData`/main document bridge owns durable
  voice/project state; the renderer owns only mounted-editor presentation, focus, nested tabs,
  effective display, preview, and gesture state. Existing serializable `BlueX7Patch` and
  `BlueX7EffectiveValuesRequest` contracts remain the mutation/readback boundaries, with no new
  persistence or migration path.
- **Runtime and engine isolation**: **PASS** — the renderer continues to call the existing
  preload readback bridge and patch callback; main-process engine, Java, filesystem, process, and
  ZeroMQ ownership is unchanged. Csound preview remains the existing pure data function.
- **Host-path portability**: **PASS / N/A** — this change reads no native paths, performs no
  filesystem/process work, and introduces no external-text path form or normalization boundary.
- **Verification evidence**: **PASS** — focused BlueX7 renderer tests, a browser viewport/focus
  suite, existing catalog/XML/transport/modern-render regressions, renderer build, typography
  audit, `git diff --check`, and the repository package/full gates are defined in
  [quickstart.md](quickstart.md). The planning baseline found one pre-existing locked-hash
  mismatch in `modern-render.integration.test.ts` and a Chrome startup failure before browser
  tests ran; the plan does not change or rebaseline either item.

No gate violations or unresolved clarifications remain.

## Project Structure

### Documentation (this feature)

```text
specs/094-bluex7-tabbed-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── blue-x7-tabs.md
│   └── visual-acceptance.md
└── tasks.md             # Phase 2 output (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
packages/blue-app/src/renderer/components/instruments/
├── blue-x7-editor.tsx                 # shell, top-level state, scope derivation, header
└── blue-x7/
    ├── tab-list.tsx                    # new shared ARIA tab-list behavior/styling
    ├── common-panel.tsx                # existing Voice & Global content, minimally adjusted
    ├── lfo-panel.tsx                   # existing Voice & Global content
    ├── operator-panel.tsx              # nested operator tabs and gesture cancellation
    ├── pitch-envelope-panel.tsx        # PEG layout and gesture cancellation
    ├── csound-panel.tsx                # nested tabs and full-height code/preview panes
    └── use-blue-x7-effective-values.ts  # active-scope refresh/stale-response handling

packages/blue-app/src/renderer/tests/
├── blue-x7-editor.test.tsx             # top-level navigation and patch isolation
├── blue-x7-a11y-layout.test.tsx        # ARIA, keyboard, narrow layout
├── blue-x7-effective-values.test.tsx   # scope changes and activation refresh
├── blue-x7-undo.test.tsx               # history survives view switches
├── blue-x7-envelope.test.tsx            # gesture commit/cancel on deactivation
└── blue-x7-csound-preview.test.tsx      # nested Csound tabs and preview preservation

packages/blue-app/src/renderer/browser/
└── blue-x7-editor.browser.test.tsx     # desktop/narrow browser geometry and focus

packages/blue-data/src/instruments/blue-x7/
└── *.test.ts                            # read-only compatibility regression coverage
```

**Structure Decision**: Keep the existing BlueX7 panel decomposition and add one small
renderer-local tab-list primitive under the existing `blue-x7` feature directory. The editor
shell remains the owner of top-level tab state and active effective-value scope; each nested
panel retains its own presentation state and mutation handlers. No shared contract or data-core
module is introduced because the existing snapshot/patch/preload boundaries already cover the
feature.

## Implementation design

1. Define the fixed top-level tab metadata and a reusable `BlueX7TabList` with generated
   instance-local IDs, roving `tabIndex`, `aria-controls`, selected-state styling, horizontal
   overflow support, and manual activation for click/Enter/Space. Use it for the top-level,
   operator, and Csound tab lists so nested accessibility behavior is consistent.
2. Change `BlueX7Editor` to a `h-full min-h-0 flex-col overflow-hidden` shell. Keep the error
   banner, metadata header, effective-value status, and top-level tab list outside a
   `relative min-h-0 flex-1` tabpanel stack. Keep panel instances mounted but hide inactive
   panels with the existing visibility/pointer/accessibility pattern. This preserves nested
   Csound/operator state and keeps header actions and history in one owner.
3. Render Common + LFO only in Voice & Global, the existing OperatorPanel only in Operators,
   the PEG only in Pitch Envelope, and the existing CsoundPanel only in Csound & Code. Give each
   tabpanel an explicit role/id/label relationship. Use `active` props so CodeMirror requests a
   fresh measure when Csound becomes visible and envelope panels finish pending staged gestures
   when deactivated.
4. Replace the current all-non-operator parameter filter with an active-scope derivation from
   `BLUE_X7_PARAMETER_DESCRIPTORS`: 17 Global IDs (11 Common/LFO IDs plus the six visible
   operator-enable controls), 24 Operators IDs (the selected operator's 22 catalog entries plus
   the two shared workstation keys), 8 PEG IDs for Pitch, and no request for Csound. Intersect
   any legacy host allowlist after the active partition. Update the effective-value hook to key
   its effect/invalidation by the parameter set as well as target/session, so same-length Op 1→Op
   2 changes cannot accept stale values.
5. Preserve the current patch/history implementation. Top-level and nested tab transitions do
   not call `onInstrumentPatch`; numeric edits, SysEx imports, Csound post-code edits, and
   active envelope commits continue to use their current typed patch variants. A gesture commits
   only on an active pointer-up/explicit commit; deactivation, pointer-cancel, unmount, and
   operator changes cancel staged state and release capture without a partial patch.
6. Update focused unit/browser tests to prove tab DOM semantics, keyboard activation, panel
   visibility, no model patches on tab changes, state reset on fresh mount, header persistence,
   gesture atomicity, effective-value request subsets/refresh timing, CodeMirror height, and
   narrow one-row tab scrolling. Leave existing data tests as the guard for XML/CSD/automation
   compatibility and run the validation matrix in `quickstart.md`.

## Risks and mitigations

- **ARIA focus drift:** centralize tab behavior in `BlueX7TabList`; assert selected/controlled
  relationships and inactive-panel exclusion in jsdom and browser tests.
- **CodeMirror hidden layout:** keep its instance mounted, pass `active`, and assert the active
  panel/editor rect in the browser suite.
- **Stale live values on same-sized operator scopes:** derive a stable ordered ID signature and
  reject responses from prior scope generations; test an unresolved old request before switching
  operators.
- **Gesture loss during view changes:** expose panel activation state and fail closed on
  active→inactive, pointer-cancel, unmount, or operator change; test pointer-down, tab
  activation, capture release, and absence of a partial patch.
- **Duplicate editor instances:** generate tab/panel IDs per React editor instance rather than
  relying on fixed IDs for the new ARIA relationships.
- **Narrow hosts:** keep tab labels in a non-wrapping horizontal scroller, preserve the selected
  tab's visibility on activation, and verify 360px Chromium layout.

## Post-design constitution re-check

- **Portable data core**: **PASS** — all new logic is renderer-local; no `@blue/data` boundary
  change or prohibited import is introduced.
- **Java and project compatibility**: **PASS** — Java/data references are documented in
  `research.md`; no persistence, transport, CSD, or SysEx implementation changes are planned.
- **Canonical ownership and contracts**: **PASS** — durable voice state remains in `BlueData`,
  renderer session state remains ephemeral, and existing typed patch/readback contracts are
  reused without adding persisted fields.
- **Runtime and engine isolation**: **PASS** — only the renderer's selection of existing
  effective-value IDs changes; main/preload engine ownership and failure envelopes remain intact.
- **Host-path portability**: **PASS / N/A** — no path or external text boundary is touched.
- **Verification evidence**: **PASS** — the data model, UI/runtime contract, visual matrix,
  focused suites, browser checks, renderer build, typography audit, and full gates are all named
  in the generated artifacts. The existing modern-render hash mismatch is explicitly recorded
  as a separate pre-existing item and remains a release gate to triage.

## Complexity Tracking

No constitution violations. The only new abstraction is the shared local tab-list primitive,
justified by three tab lists needing the same ARIA/focus contract; no new persistence, IPC layer,
or data-model abstraction is introduced.
