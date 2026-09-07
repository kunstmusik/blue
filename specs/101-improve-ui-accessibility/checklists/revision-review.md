# Controlled Revision Review: Improve UI Accessibility

**Baseline A**: `74cd10f7`  
**Candidate B**: `d2a1ea4`  
**Direction**: Minimum compliant contrast with restrained hierarchy

Use identical content, window dimensions, zoom, device scale factor, open panels, control values, and interaction states for A and B. Screenshots assess hierarchy and distraction; computed colors determine contrast compliance.

## Category Dispositions

| Category | Evidence | Representative sets | Disposition | Observed issue | Shared seam / follow-up | Validation |
|---|---|---|---|---|---|---|
| Theme hierarchy | Controlled A/B screenshots + computed contrast | Workbench, settings, Score, Mixer, representative modal, and BSB approved | Soften | Keep improved application text; bias ordinary chrome toward A because resting borders, tab fills, and toolbar controls in B compete with active state; preserve project-authored BSB appearance | Restore quiet `app-border`; reserve `app-border-strong` for essential boundaries | Governed-pair audit and full app suite passed |
| Visible focus | Resting/focused A/B screenshots + keyboard traversal | Cool-blue E direction approved; automated traversal covers form controls, separators, and value controls | Soften (approved) | The OS amber outline is visually jarring; use the existing cool-blue focus token with dark separation where the control background is also blue | Apply the shared `app-focus` treatment consistently; do not introduce a second focus hue | Renderer build passed; browser suite passed (12 files, 56 tests) |
| Status cues | State A/B screenshots + grayscale/color-vision review | Toast approved as D; MIDI, active Mute/Solo, REPL, and shared inline Live Space treatment approved as E | Soften (approved) | Keep semantic glyph/color, but avoid turning large status containers into accent blocks; compact badges and consequential active states may retain restrained semantic color | Use a moderately strong neutral toast border and semantic icon color; retain compact MIDI badge, active Mute/Solo, and glyph-plus-text inline treatments | Full app suite passed (4,160 tests, 2 skipped); status accessibility tests included |
| Accessible semantics | Accessibility tree + focused tests | Settings, numeric controls, toggles, BSB, dialogs | Pending | No visual judgment required | Preserve unless regression is evidenced | Semantic test suite |
| Keyboard value controls | Keyboard operation + focused tests | Mixer and BSB widgets | Pending | No visual judgment beyond focus | Preserve value behavior unless regression is evidenced | Value-control browser/jsdom tests |
| Modal behavior | Keyboard/focus restoration + two-document tests | Representative modal and popout | Pending | No screenshot-only judgment | Preserve shared dialog seam unless regression is evidenced | Dialog and popout tests |
| Validation infrastructure | Audit/test review | Scripts, docs, browser tests | Pending | Assess necessity and maintenance cost | Delete only redundant evidence | Script tests + command review |

Allowed dispositions are `keep`, `soften`, `revert`, and `redesign`. Every row requires one final disposition before T066 can complete.

## Screenshot Sets

| Set | Baseline A | Candidate B | Revised C | Decision notes |
|---|---|---|---|---|
| Main workbench and Dockview tabs | [baseline](../review-images/baseline-a/workbench.png) | [candidate](../review-images/candidate-b/workbench.png) | [revised](../review-images/revised-c/workbench.png) | Approved: C restores A's quiet structural chrome while retaining B's readable text and dedicated strong-boundary role. |
| Score layer controls | [baseline](../review-images/baseline-a/score.png) | [candidate](../review-images/candidate-b/score.png) | [revised](../review-images/revised-c/score.png) | Approved: C retains readable labels and state letters while restoring quieter grid, panel, and inactive-control boundaries. |
| Mixer channel | [baseline](../review-images/baseline-a/mixer.png) | [candidate](../review-images/candidate-b/mixer.png) | [revised](../review-images/revised-c/mixer.png) | Approved: C retains readable mixer labels while restoring quieter channel dividers, tab fills, and resting controls. |
| Settings | [baseline](../review-images/baseline-a/settings.png) | [candidate](../review-images/candidate-b/settings.png) | [revised](../review-images/revised-c/settings.png) | Approved: C restores A's quiet input/footer boundaries and keeps B's improved labels, descriptions, navigation, and values. |
| Representative modal | [baseline](../review-images/baseline-a/modal.png) | [candidate](../review-images/candidate-b/modal.png) | [revised](../review-images/revised-c/modal.png) | Approved: C keeps B's more readable dialog text while restoring A's restrained frame, controls, table boundaries, and surrounding hierarchy. |
| Status/toast | [baseline](../review-images/baseline-a/status-toast.png) | [candidate](../review-images/candidate-b/status-toast.png) | [revised C](../review-images/revised-c/status-toast.png) | Approved as [D](../review-images/revised-d/status-toast.png): stronger neutral boundary than A, improved text, and semantic color confined to the non-color status glyph. |
| Blue Synth Builder controls | [baseline](../review-images/baseline-a/bsb.png) | [candidate](../review-images/candidate-b/bsb.png) | [revised D](../review-images/revised-d/bsb.png) | Approved: D is intentionally close to A, improving application-owned labels around the editor while retaining quiet chrome and preserving project-authored widget styling. |
| Keyboard focus ring | [baseline](../review-images/baseline-a/focus-toolbar.png) | [candidate](../review-images/candidate-b/focus-toolbar.png) | [revised E](../review-images/revised-e/focus-toolbar.png) | Approved direction: E replaces the jarring OS amber outline with the existing cool-blue focus token and a dark offset gap, retaining strong visibility on blue controls. |
| MIDI readiness status | [baseline](../review-images/baseline-a/status-midi.png) | [candidate](../review-images/candidate-b/status-midi.png) | [revised E](../review-images/revised-e/status-midi.png) | Approved: E's compact dark-green tint is less dominant than A's solid mint pill; improved text plus a checkmark preserves readable, non-color status recognition. |
| Active Mute state | [baseline](../review-images/baseline-a/status-muted-layer.png) | [candidate](../review-images/candidate-b/status-muted-layer.png) | [revised E](../review-images/revised-e/status-muted-layer.png) | Approved: E keeps the consequential active state prominent and uses a higher-contrast dark foreground on orange while restoring quiet surrounding chrome. |
| REPL runtime status | [baseline](../review-images/baseline-a/status-repl.png) | [candidate](../review-images/candidate-b/status-repl.png) | [revised E](../review-images/revised-e/status-repl.png) | Approved: E adds a subordinate glyph-plus-text runtime indicator without a colored badge or container; Live Space uses the same restrained inline pattern. |
