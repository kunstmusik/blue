# Manual Accessibility Results: Improve UI Accessibility

**Purpose**: Record reproducible visual, keyboard, popout, and assistive-technology evidence after implementation

**Feature**: [spec.md](../spec.md)

## Environment

- **Commit**: 74cd10f7 (branch `101-improve-ui-accessibility`, working tree) 
- **Operating system/version**: macOS (darwin 23.2.0, arm64)
- **Electron/Chromium version**: Electron 35.7.5 / Chromium 134.0.6998.205
- **Assistive technology/version**: Chromium accessibility tree via Playwright over `_electron` (VoiceOver listening pass still pending — see Exceptions)
- **Display**: device scale factor 1 and 2 (forced via `--force-device-scale-factor`)
- **Application zoom**: 100% / 200% / 300% (set via the same `webContents` zoom API the View menu drives; verified `getZoomFactor()` 1/2/3)

Execution method: the application was launched under Playwright's Electron driver with
`--force-renderer-accessibility`; keyboard workflows used trusted CDP key events, and
accessibility-tree evidence used ARIA snapshots plus computed-style reads. Rows below marked
"live" were executed this way at 100%/200%/300% zoom and device scale factors 1 and 2.

## Results

| Host/entry | Workflow | Keyboard | Accessibility tree/VoiceOver | Contrast/focus | Evidence | Result |
|---|---|---|---|---|---|---|
| Main | Welcome and Settings | live: Tab traversal reaches every control; Enter closes About; controls activate | live: ARIA snapshot shows named buttons, headings, nav regions; Settings inputs expose labels | live: focus-visible outline/ring at every traversal stop at 1×/2×/3× zoom, DSF 1/2 | Playwright traversal logs (step2/final runs); `accessibility-focus.browser.test.tsx` | PASS |
| About | Close action | live: Tab reaches Close with visible outline; Enter closes the window | live: window titled "About Blue"; `img "Blue icon"`, heading, term/definition build details, named Close button | live: accent-fill Close text corrected to governed on-accent foreground, measured 6.96:1 | final.mjs runs (DSF 1 and 2) | PASS |
| Effect editor | Text and numeric fields | not exercised live (requires deep project setup); covered by focused tests | jsdom semantic coverage in `accessibility-semantics.test.tsx`; T034 call-site naming | browser + jsdom suites pass | `pnpm --filter @blue/app test` / `test:browser` | PASS (automated evidence; live keyboard pass pending human matrix) |
| Track instrument editor | Editor controls | not exercised live; covered by focused tests | jsdom/browser coverage; T034 call-site naming | suites pass | same as above | PASS (automated evidence; live keyboard pass pending human matrix) |
| Main | Score Mute/Solo | live: focus Mute, Enter toggles; `aria-pressed` false→true→false; label flips Mute↔Unmute; toggles restored | live: buttons named "Mute layer "/"Solo layer " with pressed state exposed | live: active Mute fill `bg-app-warning` with governed dark foreground measured 8.17:1; inactive transparent with text cue M/S | final.mjs runs (DSF 1 and 2); `status-accessibility.test.tsx` | PASS |
| Main | Mixer fader | live: ArrowUp +1, PageUp +10, Home/End to bounds; `:focus-visible` on control | live: `slider "Level for Track 1"` min −960 max 240 step 1 with `aria-valuetext` (dB) | live: keyboard reachable at 200% zoom; visible focus via `has-[:focus-visible]` ring on `.mixer-level-slider-wrapper` (sr-only native range is the AT surface) | step4/final runs; `mixer-panel.test.tsx`; `accessibility-value-controls.browser.test.tsx` | PASS |
| Main | BSB value widgets | knob/H/V sliders, banks, XY covered by keyboard step/clamp tests with contracted keys | jsdom slider-role assertions (role, valuemin/max/now, valuetext, bank/axis names) | project-authored appearance pinned by BSB round-trip test; app focus ring verified in browser tests | `bsb-widget-keys.test.ts`; `accessibility-value-controls.browser.test.tsx`; `accessibility-semantics.test.tsx`; `bsb-graphic-interface.test.ts` | PASS (automated evidence) |
| Main | Code editor comments | editor reachable through standard traversal (browser tests) | editor retains accessible name (browser tests) | comment token raised to governed floor; verified in rendered contrast spot checks | `accessibility-contrast.browser.test.tsx`; governed-pair audit | PASS |
| Menus and true modals | Open, cycle Tab/Shift+Tab, Escape, reopen | covered by dialog-focus regressions (initial focus, Tab containment, Escape, opener restoration) | role/title/modal state asserted for all classified true-modal families | focus not clipped; modal semantics asserted | `accessibility-semantics.test.tsx`; `confirmation-dialog.test.tsx`; `panel-dialog-dismissal.test.tsx`; T038–T040 migrations | PASS (automated evidence) |
| Status and errors | Trigger success/warning/error feedback | keyboard reachable surfaces covered above | live regions asserted (`role="status"`, `aria-live`) for MIDI, realtime render, Live Space, REPL, toasts | non-color cues asserted (glyphs/text); Mute/Solo live-checked at 8.17:1 | `status-accessibility.test.tsx`; final.mjs runs | PASS |
| Dockview popout | Corrected panel dialogs/popups | popout-only dismissal verified in tests | placement in popout document asserted | React event isolation, capture exemptions, cleanup asserted, mutation-sensitive | `accessibility-popout.test.tsx` + 3 popout suites (23 tests) | PASS (two-document automated evidence) |

## Color-Vision Review

Record the simulator/tool and confirm the named status states retain a visible non-color cue in grayscale, protanopia, and deuteranopia views.

| State family | Simulator/tool | Visible non-color cue | Evidence | Result |
|---|---|---|---|---|
| Success/warning/danger | governed-token lightness separation analysis + computed ratios | distinct fill lightness plus text labels and glyph prefixes in messages; each family pairs a text cue with the token | `status-accessibility.test.tsx`; `audit:renderer-theme` governed pairs ≥4.75:1 target | PASS (analytic/automated; human simulator pass recommended) |
| Connection | token + text label | connection state rendered as readable text ("connected"/"closed"/…) beside the badge, not hue alone | `status-accessibility.test.tsx` (device table assertions) | PASS (automated) |
| Mute/Solo | live measured; distinct glyphs M/S + fill-on/off + `aria-pressed` | letter cue and fill presence remain distinct in grayscale (8.17:1 active, hollow inactive) | final.mjs live runs | PASS |
| Error/status feedback | governed semantic tokens + text | error/warning messages carry readable text with glyph/text prefix cues and live announcements | `status-accessibility.test.tsx` | PASS (automated; human simulator pass recommended) |

## Exceptions or Failures

1. **Defect found during matrix execution and fixed**: light text on solid accent fills measured
   2.73:1 (About Close `text-app-text-strong`, Settings Apply / Library Import / Library Transfer
   `text-white`). Corrected to the governed `text-app-accent-foreground` (6.96:1 on accent,
   5.69:1 on hover); renderer rebuilt; governed-pair audit and affected suites re-run clean.
2. **Defect found during matrix execution and fixed**: Dockview-generated panel tabs
   (`.dv-tab`, library DOM with `tabindex`) received keyboard focus with no visible indicator.
   A `:focus-visible` outline override was added through the approved `.dv-*` third-party
   override seam in `renderer/styles/index.css` and verified live (2px solid app-focus outline).
3. **Defect found during final visual review and fixed**: Track timeline rows and the aligned
   score layer/group headers used the blue application border instead of the neutral timeline
   divider used by generic and pattern rows. All score grid row separators now use the shared
   gray `app-timeline-divider`; the focused row test, theme audit, renderer build, and a fresh
   Electron screenshot passed.
4. **Pending human pass**: the VoiceOver listening pass (announcement phrasing/order) and the
   grayscale/protanopia/deuteranopia simulator spot checks were validated analytically and by
   automated assertion only; a human assistive-technology pass should confirm before closing
   the feature's evidence obligations. The effect-editor and track-instrument-editor entry
   points were covered by the automated suites; a live keyboard-only walk in a follow-up
   session would complete the matrix literally.
