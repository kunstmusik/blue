# Controlled Revision Review: Improve UI Accessibility

**Baseline A**: `74cd10f7`  
**Candidate B**: `d2a1ea4`  
**Direction**: Minimum compliant contrast with restrained hierarchy

Use identical content, window dimensions, zoom, device scale factor, open panels, control values, and interaction states for A and B. Screenshots assess hierarchy and distraction; computed colors determine contrast compliance.

## Category Dispositions

| Category | Evidence | Representative sets | Disposition | Observed issue | Shared seam / follow-up | Validation |
|---|---|---|---|---|---|---|
| Theme hierarchy | Controlled A/B screenshots + computed contrast | Workbench and settings captured; remaining sets pending | Pending | Candidate improves text legibility but makes resting borders, tab fills, and toolbar controls compete with active state | Prefer semantic tokens in `styles/index.css` | Governed-pair audit + visual C candidate |
| Visible focus | Resting/focused A/B screenshots + keyboard traversal | Workbench tabs, score, mixer, settings, modal, BSB | Pending | Pending review | Shared focus token/rules first | Browser focus suite + keyboard review |
| Status cues | State A/B screenshots + grayscale/color-vision review | Toast, settings status, Live Space, REPL, Mute/Solo | Pending | Pending review | Shared status/toast styles first | Status tests + human simulation review |
| Accessible semantics | Accessibility tree + focused tests | Settings, numeric controls, toggles, BSB, dialogs | Pending | No visual judgment required | Preserve unless regression is evidenced | Semantic test suite |
| Keyboard value controls | Keyboard operation + focused tests | Mixer and BSB widgets | Pending | No visual judgment beyond focus | Preserve value behavior unless regression is evidenced | Value-control browser/jsdom tests |
| Modal behavior | Keyboard/focus restoration + two-document tests | Representative modal and popout | Pending | No screenshot-only judgment | Preserve shared dialog seam unless regression is evidenced | Dialog and popout tests |
| Validation infrastructure | Audit/test review | Scripts, docs, browser tests | Pending | Assess necessity and maintenance cost | Delete only redundant evidence | Script tests + command review |

Allowed dispositions are `keep`, `soften`, `revert`, and `redesign`. Every row requires one final disposition before T066 can complete.

## Screenshot Sets

| Set | Baseline A | Candidate B | Revised C | Decision notes |
|---|---|---|---|---|
| Main workbench and Dockview tabs | [baseline](../review-images/baseline-a/workbench.png) | [candidate](../review-images/candidate-b/workbench.png) | Pending | Candidate makes playhead/selection boundaries and resting toolbar controls substantially brighter. |
| Score layer controls | [baseline project](../review-images/baseline-a/score-mixer-project.png) | [candidate project](../review-images/candidate-b/score-mixer-project.png) | Pending | Capture currently shows Blue Live after project load; dedicated Score state still required. |
| Mixer channel | Pending | Pending | Pending | |
| Settings | [baseline](../review-images/baseline-a/settings.png) | [candidate](../review-images/candidate-b/settings.png) | Pending | Text is more legible; input and footer boundaries are much more prominent in the resting state. |
| Representative modal | Pending | Pending | Pending | |
| Status/toast | Pending | Pending | Pending | |
| Blue Synth Builder controls | Pending | Pending | Pending | |
