# Quickstart: Validate UI Accessibility Improvements

## Prerequisites

- Install workspace dependencies with `pnpm install` if needed.
- Run commands from the repository root.
- Use the default Blue dark theme at 100% application zoom unless a matrix step specifies another zoom.

## Controlled Visual Review

Use pre-feature commit `74cd10f7` as baseline A and accessibility checkpoint `d2a1ea4` as candidate B. Capture both with identical project content, window dimensions, zoom, device scale factor, open panels, control values, and focus/selection/status state.

Review these representative surfaces rather than every changed file:

| Set | Surface | Required states |
|---|---|---|
| 1 | Main workbench and Dockview tabs | resting, selected, keyboard focus |
| 2 | Score layer controls | resting, selected layer, Mute, Solo, keyboard focus |
| 3 | Mixer channel | resting, active value, keyboard focus |
| 4 | Settings | labels, inputs, disabled control, keyboard focus |
| 5 | Representative modal | resting, destructive action, keyboard focus |
| 6 | Status/toast | success, warning, error |
| 7 | Blue Synth Builder controls | resting, selected control, keyboard focus |

Record `keep`, `soften`, `revert`, or `redesign` for theme hierarchy, visible focus, and status cues. Judge text and essential-control contrast from computed colors; screenshots judge hierarchy and distraction, not numeric WCAG conformance. Use keyboard/accessibility-tree tests for semantics, keyboard value controls, and modal behavior.

## Automated Validation

Run the focused static audits first:

```bash
pnpm audit:renderer-theme
node --test scripts/audit-renderer-theme.test.mjs
pnpm audit:renderer-typography
```

Expected outcome:

- Every governed contrast pair passes its declared threshold without rounding.
- No undefined application color role or prohibited global focus-suppression rule is reported.
- Existing explicit exceptions remain exact and no application-owned information-bearing text is newly exempted.
- Typography remains within the seven-role catalog and 11 px floor.

Run focused renderer tests added or updated for this feature, followed by the full affected package:

```bash
pnpm --filter @blue/app test src/renderer/tests/status-accessibility.test.tsx src/renderer/tests/accessibility-semantics.test.tsx
pnpm --filter @blue/app test:browser src/renderer/browser/accessibility-contrast.browser.test.tsx
pnpm --filter @blue/app test
pnpm --filter @blue/app test:browser
pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.renderer.json
pnpm --filter @blue/app build:renderer
```

Before handoff, run repository checks:

```bash
pnpm test
pnpm lint
git diff --check
```

Record pre-existing unrelated failures separately; do not silently waive a new accessibility regression.

## Manual Keyboard and Assistive-Technology Matrix

Repeat the representative workflows at 100%, 200%, and 300% zoom and device scale factors 1 and 2. Cover all five React entry points and repeat corrected panel dialog/menu/focus checks in the scriptless Dockview popout host. Use Chromium accessibility snapshots for automated semantic evidence and VoiceOver on macOS for the manual screen-reader pass. Record results in `checklists/manual-accessibility-results.md`.

| Surface | Keyboard-only proof | Accessibility-tree proof | Visual proof |
|---|---|---|---|
| Welcome and Settings | Reach primary actions and edit text/number/select fields | Each field/action has a meaningful name and role | Text, boundaries, and focus remain visible |
| About | Reach and activate the close action | Window title and close action are named | Accent-fill text and focus pass |
| Effect editor | Reach and edit effect name and numeric fields | Fields expose names and values | Inputs, boundaries, and focus pass |
| Track instrument editor | Reach its application-owned editor controls | Controls expose names, roles, and states | Text and focus pass |
| Score layer headers | Toggle Mute and Solo and return to the prior item | Toggle state changes programmatically | Active M/S text passes contrast and remains distinguishable without hue |
| Mixer channel | Adjust level, reach related controls, and leave the strip | Slider exposes name, range, and current value | Track/thumb/focus remain identifiable |
| BSB value widgets | Adjust knob, H/V sliders, bank handles, and XY axes by the contracted keys | Slider semantics expose authored names, ranges, axes, and values | Project-authored appearance is preserved; app focus is visible |
| Code editor | Navigate into/out of editor and read comments | Editor retains its accessible name | Comment text passes 4.5:1 |
| Menus and true modals | Open, cycle Tab/Shift+Tab, cancel with Escape, reopen | Role, modal state, and title are present | Focus is not clipped or obscured |
| Status and errors | Trigger representative success/warning/error feedback | Important asynchronous feedback is announced | Status remains distinct in grayscale and red/green simulation |

## Contrast Spot Checks

Measure rendered computed colors rather than screenshots affected by antialiasing. At minimum verify:

- muted and subtle text on surface, background, input, menu, hover, and raised surfaces;
- primary text on accent fill in resting and hover states;
- Mute/Solo foregrounds on warning/success fills;
- CodeMirror comment text on the editor background;
- essential input/control boundaries against adjacent surfaces; and
- focus indicators against both the control and adjacent background.

## Completion Criteria

Validation is complete when the automated commands pass, every matrix row passes at all three zoom levels and both scale factors, corrected popouts pass their two-document tests, no tested focused component is entirely hidden, and `.blue` round-trip/project behavior is unchanged.
