# Implementation Plan: Improve UI Accessibility

**Branch**: `101-improve-ui-accessibility` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/101-improve-ui-accessibility/spec.md`

## Summary

Bring the explicitly inventoried application-owned Electron renderer surfaces to a documented WCAG 2.2 AA baseline. Extend the existing semantic theme and audit infrastructure, correct failing foreground/background pairs, restore visible keyboard focus, standardize accessible dialog and field behavior, add keyboard semantics to mixer and Blue Synth Builder value controls, replace the bare printable shortcut, and validate the result without changing project-authored colors, `.blue` data, or engine behavior.

The implementation follows the smallest shared seams already present: theme tokens in `styles/index.css`, `useDialogFocus`, settings field wrappers, number-input primitives, current browser/jsdom tests, and `audit-renderer-theme.mjs`. No new runtime dependency or generalized accessibility framework is planned.

## Technical Context

**Language/Version**: TypeScript 5.8, React 19.2, CSS/Tailwind CSS 4.1, Node.js ESM validation scripts

**Primary Dependencies**: Electron 35, React DOM, Tailwind CSS 4.1 with `@tailwindcss/vite` 4.2, Radix UI primitives already used by menus/selects, CodeMirror 6, Lucide React

**Storage**: N/A for new state; renderer theme and semantic behavior only. Existing project-authored colors and fonts remain in `BlueData`/`.blue` XML unchanged.

**Testing**: Vitest 4 jsdom tests, Vitest Browser with Playwright, Node built-in test runner for audit scripts, deterministic manual accessibility matrix

**Target Platform**: Electron desktop renderers on macOS, Windows, and Linux, including secondary renderer windows and hosted popouts

**Project Type**: Monorepo desktop application; work is confined primarily to `packages/blue-app` renderer code plus root validation scripts and documentation

**Performance Goals**: No per-control global event listeners; existing interaction-performance tests remain passing; keyboard handlers perform bounded synchronous value updates

**Constraints**: WCAG 2.2 AA for application-owned UI; preserve seven typography roles and 11 px floor; preserve project-authored BSB/score colors and imported typography; use host-window-safe popup behavior; use `cn()` for composed classes; add no dependency unless existing browser/jsdom facilities prove insufficient

**Scale/Scope**: Five React renderer entry points plus the scriptless Dockview popout host, shared theme roles, 24 production files containing explicit `tabIndex`, 33 filename-identified dialog/modal candidates requiring semantic classification, 85 numeric component call sites requiring association review, the mixer fader, all six pointer-driven BSB value-widget families, and the named status surfaces in the spec

## Constitution Check

*GATE: Passed before Phase 0 research; re-checked after Phase 1 design.*

- **Portable data core**: PASS — no `@blue/data` production change is planned; accessibility logic remains renderer-owned.
- **Java and project compatibility**: PASS — `.blue` XML, CSD, runtime semantics, and project-authored visual data remain untouched. Java Blue is a familiarity reference, not the accessibility contract; intentional Electron semantic improvements are documented in the spec.
- **Canonical ownership and contracts**: PASS — application theme, DOM semantics, and keyboard behavior remain renderer-owned. User-authored colors and fonts remain owned by `BlueData`; no new persistence or IPC contract is introduced.
- **Runtime and engine isolation**: PASS — no Java, filesystem, process, ZeroMQ, preload, or engine change is planned.
- **Host-path portability**: N/A — no filesystem path handling changes.
- **Verification evidence**: PASS — the plan adds/extends token audit tests, focused jsdom/browser behavior tests, an accessibility contract, and a cross-window manual matrix; package and repository validation commands are listed in `quickstart.md`.

### Post-Design Re-check

All gates remain passed. The design introduces no new data owner, persistence, IPC, host runtime, external dependency, or Java-parity obligation. The UI contract explicitly protects canonical project-authored styling and uses existing renderer seams.

## Implementation Strategy

### Phase A - Establish the measurable baseline

1. Add `docs/color-accessibility.md` as the authority for semantic color roles, allowed foreground/background combinations, WCAG thresholds, focus treatment, non-color cues, and project-authored exceptions.
2. Synchronize `docs/typography.md` where its contrast section points to the new color authority.
3. Add one machine-readable governed-pair module consumed by `scripts/audit-renderer-theme.mjs`; keep CSS tokens as the color-value source and make prose documentation reference, rather than duplicate, the executable pair list.
4. Extend the existing audit with contrast-pair checks, prohibited-focus-suppression checks, and stale/malformed exception detection. Reuse its existing undefined-role detection and exception registry.
5. Resolve every current unapproved audit finding or classify it as an exact ownership exception so the existing lint gate reaches a deterministic passing baseline.
6. Wire the audit test into root `test:scripts` and add a general `test:browser` package script for `vitest.browser.config.ts`.

### Phase B - Repair shared contrast and focus foundations

1. Split semantic foreground roles from fill roles where one color cannot serve both; explicitly cover text-on-surface and foreground-on-accent/status-fill pairs.
2. Raise muted/subtle text and essential control-boundary contrast with headroom above the threshold; correct the undefined error alias and failing CodeMirror comment color.
3. Correct white-on-accent and white-on-warning/success active controls, including score Mute/Solo, without changing the meaning of their status colors.
4. Classify every current explicit `tabIndex` and outline-suppression occurrence. Remove generic suppression, use component Tailwind `focus-visible` utilities with `cn()` composition for operable controls, and retain suppression only on documented non-operable shells with an explicit alternative state. Do not add new component BEM/CSS rules.
5. Treat surface elevation cleanup as visual hierarchy, not a claimed WCAG requirement; change it only where the validation matrix shows ambiguous boundaries after border/focus fixes.

### Phase C - Repair shared semantic interaction seams

1. Associate `SettingsField` labels and descriptions with their inputs and apply the same relationship to shared select and number-field wrappers.
2. Inventory number-input call sites by context. Fix accessible naming at reusable labeled wrappers first, then add explicit names only to genuinely standalone inputs.
3. Classify every dialog/modal candidate as a true modal, non-modal surface, wrapper/helper, or native host dialog. Upgrade `useDialogFocus` to use the dialog's owner document/host document before migrating true modals; test role, label, modal state, initial focus, Escape policy, Tab containment, and foreign-document focus restoration.
4. Preserve the confirmation split: host/system decisions use `showNativeConfirmation`; contextual decisions use `ConfirmationDialog`; destructive decisions are fail-closed, visibly destructive, and initially focus Cancel.
5. Add both a visible pressed-state cue and `aria-pressed` or equivalent state to Mute/Solo and other in-scope toggles.
6. Inventory the named status surfaces and shared toast behavior; add missing live-region semantics only for important asynchronous updates and test visible non-color cues for each named status family.
7. Replace bare `F` with `Command+Shift+F` on macOS and `Control+Shift+F` on Windows/Linux; update discoverable shortcut text and tests without adding persistence.

### Phase D - Provide keyboard-equivalent DAW controls

1. Make the existing mixer range input the named keyboard/assistive-technology control, render a visible focus state on its SVG/wrapper, keep pointer dragging synchronized with the same value path, and bind drag listeners to the element's owning window.
2. Apply keyboard and slider semantics to BSB knob, horizontal/vertical slider, horizontal/vertical bank, and XY controller families while preserving project-authored appearance and ranges. Each bank handle is independently named; the XY controller exposes independently operable axes.
3. One-dimensional controls use ArrowRight/ArrowUp for one step up, ArrowLeft/ArrowDown for one step down, PageUp/PageDown for ten steps, and Home/End for min/max, clamped to the authored range. When no discrete resolution exists, one step is 1% of the range. Each XY axis follows the same rule independently.

### Phase E - Validate and contain scope

1. Run the automated commands in `quickstart.md`, including theme/contrast checks, focused app tests, full app tests, lint, and whitespace checks.
2. Execute the manual matrix at 100%, 200%, and 300% zoom and device scale factors 1 and 2 across all five React entry points; repeat corrected panel popups in the Dockview popout host.
3. Check representative status states in grayscale and common red/green color-vision simulations.
4. For every corrected panel popup, verify approved host portals/surfaces, host-window positioning and dismissal, realm-safe checks, event isolation, cleanup, and a mutation-sensitive two-document regression.
5. Do not fold user-authored color normalization, full WCAG AAA, or unrelated layout redesign into this feature.

## Project Structure

### Documentation (this feature)

```text
specs/101-improve-ui-accessibility/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── accessibility-contract.md
│   └── remediation-inventory.md
└── checklists/
    ├── requirements.md
    └── manual-accessibility-results.md
```

### Source Code (repository root)

```text
docs/
├── typography.md
└── color-accessibility.md                 # planned authority

scripts/
├── audit-renderer-theme.mjs               # extend existing audit
├── renderer-accessibility-contract.mjs    # planned executable pair contract
└── audit-renderer-theme.test.mjs          # planned focused audit tests

packages/blue-app/src/renderer/
├── styles/index.css                       # semantic roles and shared focus rules
├── hooks/use-keyboard-shortcuts.ts        # printable shortcut remediation
├── components/
│   ├── CommitNumberInput.tsx              # existing numeric primitives
│   ├── settings/SettingsField.tsx         # shared label/description association
│   ├── dialogs/
│   │   ├── ConfirmationDialog.tsx
│   │   └── use-dialog-focus.ts
│   └── workbench/panels/
│       ├── ScorePanel.tsx                 # mute/solo contrast and state
│       ├── mixer/ChannelStrip.tsx         # accessible range behavior
│       ├── editors/SelectedCodeEditor.tsx # syntax contrast
│       ├── score/                         # true-modal adoption and state controls
│       └── orchestra/bsb/widgets/         # keyboard slider semantics
├── tests/                                 # jsdom semantic tests
└── browser/                               # rendered focus/keyboard tests
```

**Structure Decision**: Extend the existing renderer theme, field, dialog, keyboard, and test seams. Add one documentation authority and focused audit tests; do not add a new package, state store, runtime service, or accessibility component framework.

## Revision Review Strategy

The implementation checkpoint at `d2a1ea4` is a review candidate, not the final visual baseline. Reassess it without reopening semantic behavior that already satisfies the contract unless the review finds a regression.

1. Compare the pre-feature baseline (`74cd10f7`) with checkpoint `d2a1ea4` under identical content, window size, zoom, and interaction state.
2. Review seven behavior categories rather than files: theme hierarchy, focus, status cues, accessible semantics, keyboard value controls, modal behavior, and validation infrastructure.
3. Use screenshots only for theme hierarchy, visible focus, and status cues. Use accessibility-tree, keyboard, and automated evidence for non-visual categories.
4. Cover representative workbench, score, mixer, settings, modal, status/toast, and Blue Synth Builder surfaces. Do not create an exhaustive per-file screenshot suite.
5. Record one disposition per category: `keep`, `soften`, `revert`, or `redesign`, with the observed issue and intended shared seam.
6. Revise shared semantic tokens and shared component styles before touching individual call sites. Preserve semantic, keyboard, modal, and compatibility fixes unless evidence shows they are incorrect.
7. Re-run focused contrast checks after every visual batch, then complete the full automated and human validation matrix only after all category dispositions are resolved.

The preferred outcome is minimum compliant contrast with restrained hierarchy. Ordinary inactive surfaces and boundaries use the quietest passing role; stronger contrast is reserved for focus, selection, warnings, essential state, and primary actions.

## Complexity Tracking

No constitution violations or additional complexity exceptions are required.
