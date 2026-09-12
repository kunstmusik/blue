# Channel Strip Layout Research

**Date**: 2026-09-12

**Purpose**: Phase 0 evidence and decisions for spec 107. Updated after the project owner approved changing the fader taper on 2026-09-12.

## Findings and decisions

Use per-strip numeric meter scales, dedicate more horizontal width to meter plus labels than to the fader, and place a small right arrow beside the output selector. Replace the existing gain taper with one fixed cubic-in-dB taper, add a rectangular fader cap and separate unity mark, and keep gain and signal references visibly distinct. Preserve saved gain and automation semantics.

The supplied [channel-strip research](../../.tmp-research/CHANNEL_STRIP_UI_RESEARCH.md) correctly identifies wasted centering space and the distance to the global ruler. Its screenshot-derived DAW widths are estimates, not universal product specifications. This follow-up does not rely on those numerical comparisons as acceptance requirements.

## Verified local baseline

- `packages/blue-app/src/renderer/styles/index.css`: `.mixer-channel-strip` is 88 pixels wide. Pre and post chain lists are each 50 pixels high.
- `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`: the level row centers a 32-pixel fader, 6-pixel gap, and meter. The cap is a circle of radius 7; minimum slider height is 60 pixels. Output currently uses a separate heading and selector.
- `MeterCanvas.tsx` in the same directory: meter widths are 10 pixels for mono, 12 for stereo, and up to 36 for more channels. The actual track has 10-pixel top and bottom insets; the clip box is above the track. Label alignment must use the track rather than the complete element rectangle.
- `MeterScaleRuler.tsx`: one 32-pixel ruler uses fixed top/bottom spacers to approximate strip geometry. Repeating this complete structure inside every strip would preserve the alignment problem. Local scales should reference their actual meter geometry during planning.
- `meter-profiles.ts`: five existing profiles define their own dB-to-fraction mappings, major/minor marks, and zero references. Labels should derive from these definitions. A constant four-label set cannot accurately represent every profile.
- `packages/blue-data/src/mixer/channel.ts`: channel gain and its Volume automation parameter use dB, with limits -96 and +12. This feature needs no new persisted state.
- `specs/105-meter-presentation-calibration/spec.md`: meter preferences are project-wide, affect presentation only, and must not change fader mapping. Legacy/new-project defaults and preference history already have explicit contracts.

### Corrections to the supplied report

Unity is at **80%**, not approximately two-thirds, of usable fader travel. The current numeric held peak is one maximum across a strip's output channels, not a separate L/R pair. Preserve that behavior. The report's 38-pixel unused-space estimate is the nominal stereo case (88 minus 32 minus 6 minus 12), before borders; multichannel meters already consume more width.

## Java reference

Inspected `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/mixer/ChannelPanel.java`:

- `getSliderValFromChannel` (around line 183) maps positive gain to gain × 20 and nonpositive gain to gain × 10, converting to an integer for the Java slider.
- `updateLevelValue` (around line 241) reverses that mapping.
- Slider bounds (around lines 282–285) are -960 to +240, initially zero.

The TypeScript `getSliderValue` and `sliderToLevel` use the same piecewise mapping. Java's integer conversion is an existing implementation detail; this work must not introduce new rounding of stored or automated values. The project owner explicitly approved diverging from Java's taper to improve mixing ergonomics. Gain storage, automation interpolation, and audio conversion remain compatible.

## How fader y and meter y relate

Let `g` be gain in dB. The existing bottom-to-top normalized fader position is:

```text
f(g) = (10g + 960) / 1200    for -96 <= g <= 0
f(g) = (20g + 960) / 1200    for   0 <  g <= 12
```

The amplitude multiplier represented by gain is `10^(g/20)`. The fader stores/edits gain; it does not display the measured amplitude of the signal. For an otherwise linear path, applying -6 dB gain to a -12 dBFS signal produces approximately -18 dBFS at a post-gain measurement point. Effects, routing, and the actual meter tap can change that relationship.

The following percentages are computed from current code, measured upward from each control's own usable bottom. Equal displayed numbers do not establish equal units or equal positions:

| Numeric value | Fader gain position | Mixing meter at that dBFS | Linear meter at that dBFS |
| ------------- | ------------------: | ------------------------: | ------------------------: |
| -60           |              30.00% |                     2.17% |                     0.00% |
| -24           |              60.00% |                    36.52% |                    54.55% |
| -6            |              75.00% |                    73.91% |                    81.82% |
| 0             |              80.00% |                    86.96% |                    90.91% |
| +6            |              90.00% |                   100.00% |                   100.00% |

Pixel y also includes each control's endpoint insets: the current fader cap center uses 7 pixels at each end, whereas the meter track uses 10. Equal outer heights therefore do not guarantee matching usable endpoints.

K20/K14/K12 meter zero corresponds to -20/-14/-12 dBFS, respectively. In the current profiles those reference positions are 66.67%, 76.67%, and 80% of meter travel. K12's 80% happens to match fader unity numerically; that coincidence does not make the references equivalent.

**Decision**: Retain separate meter and fader mappings, but replace the fader mapping with the fixed curve below. Place meter labels close to the meter, retain gain numerics, and add a dedicated fader unity reference. A shared ruler would falsely imply one scale controls both. Fader ergonomics must not inherit whichever metering profile is selected.

## Independent external research

1. [Ableton Live 12 manual — Mixing](https://www.ableton.com/en/manual/mixing/), sections 18.1 and 18.1.1, accessed 2026-09-12. The manual distinguishes the meter's peak/RMS signal readings from the volume control and describes adding meter ticks and a neighboring decibel scale as the mixer grows. This supports local readable references and height-aware density; it does not prescribe a particular fader taper or exact strip width.
2. [Ardour manual — Metering](https://manual.ardour.org/meters/), accessed 2026-09-12. Describes digital peak readings in dBFS, RMS/K references at -20/-14/-12 dBFS, and selectable meter types and tap points. This supports separating reference levels, measured signal, and gain. Blue's K references remain visual aids, not a claim of acoustic calibration or full standards-compliant meter behavior.
3. [Lucide — Arrow Right](https://lucide.dev/icons/arrow-right), accessed 2026-09-12. The simple horizontal arrow is a suitable candidate for the requested leading routing indicator. Keep the selector accessibly named; a decorative arrow supplies direction without adding an extra button. Exact size and spacing belong in the design plan.

4. [Ardour control_math.h](https://github.com/Ardour/ardour/blob/master/libs/pbd/pbd/control_math.h), reviewed 2026-09-12 during the planning skill's delegated curve research. Ardour uses a power-shaped function of logarithmic gain and the inverse conversion. Its constants, curve, and silence endpoint differ. This is evidence for the function family, not a requirement to reproduce Ardour's curve or automation scaling.
5. [REAPER release history](https://www.reaper.fm/download-old.php?ver=4x), reviewed 2026-09-12: documents introduction of a hardware-emulation volume-fader taper. [API Final Touch Automation manual](https://www.apiaudio.com/docs/manuals/Final-Touch-Automation_user_2023-11-01.pdf) documents DAW-specific fader curve options. Together these support treating taper as a deliberate interaction design with product-specific choices.

No universal exact DAW taper or requirement that meter and fader y mappings match was established. The selected cubic is an independent mathematical design for Blue's finite gain range; it is not advertised as a certified standard or a commercial DAW clone. No external source implementation needs to be copied.

## Phase 0 decisions

### Fixed mixing-oriented taper

**Decision**: Use `p = ((g + 96) / 108)^3`, inverse `g = 108 * cbrt(p) - 96`, where gain `g` is finite dB in [-96,12] and `p` is normalized upward travel in [0,1]. Use the same pure conversion for rendering and pointer input. Keep meter profile selection out of this API.

**Rationale**: The function is continuous, strictly increasing, invertible, and has continuous gain sensitivity around unity. It devotes 49.3948% of travel to -20..+6 dB, versus 26.6667% previously. Unity is 70.2332%. It requires no lookup table, interpolation package, configuration, or project migration.

| Gain dB | New travel from bottom |
| ------- | ---------------------: |
| -96     |                0.0000% |
| -60     |                3.7037% |
| -48     |                8.7791% |
| -36     |               17.1468% |
| -24     |               29.6296% |
| -20     |               34.8473% |
| -12     |               47.0508% |
| -6      |               57.8704% |
| 0       |               70.2332% |
| +6      |               84.2421% |
| +12     |              100.0000% |

The inverse derivative at unity is 45.5625 dB per full travel; the old mapping jumps from 120 to 60 across unity. At 100 pixels of usable travel, the new local sensitivity is approximately 0.456 dB/pixel. The very low tail is compressed deliberately: inverse sensitivity grows at the bottom endpoint, although gain and position remain finite and continuous. Exact low values remain available through numeric and keyboard editing. Smooth sensitivity is required around unity, not a bounded derivative at the extreme bottom.

**Alternatives considered**: Retaining Java's curve leaves the demonstrated allocation problem. Reusing a meter profile couples unrelated units and changes the fader with each profile. Piecewise hand-tuned points add knots and inverse interpolation without a demonstrated advantage. Squaring the normalized dB range gives only about 39.68% travel to the working band, below the chosen 45% target. A selectable taper or silent endpoint introduces storage/semantics beyond this feature.

**Numerical evidence**: Planning evaluated 10,801 evenly spaced gains (0.01 dB interval) across the full range. All positions strictly increased; maximum unrounded inverse error was approximately 7.11e-15 dB. Implementation must independently encode this as a focused regression test, including endpoints, anchors, finite-input handling, and unity slope.

### Interaction values and project history

**Decision**: A small mixer-specific slider component consumes/emits dB, owns disposable pointer preview, and commits once on release through the existing project document bridge. Keyboard operates directly in dB: 0.1 increments, 1 dB for Shift/Page, finite endpoints for Home/End. Pointer candidates round to 0.01 dB after inverse conversion; no movement causes no conversion back into canonical data. Numeric entry retains current precision.

**Rationale**: `ChannelStrip.tsx` currently fabricates input events, uses raw slider units for keyboard increments, and calls `onPatch` on every mouse move. `MixerPanel.tsx` forwards each patch to canonical history. A changed taper should not accidentally multiply history entries or change keyboard resolution as a side effect of curve position.

**Alternatives considered**: Grouped durable patches on every move still mutate/dirty the document during a preview. Relying on a final untracked runtime write cannot reliably reject a late preview after cancellation. A general-purpose gesture framework is unnecessary; reuse existing history settlement and runtime reconciliation with a narrow mixer-specific lifecycle adapter.

### Runtime preview completion and cancellation

**Decision**: Extend the existing typed mixer-preview IPC to carry document, gesture, revision, and phase metadata with an explicit acknowledgement. Preview writes remain main-owned and flow through `ProjectRuntimeReconciliation.previewChannelValue`; finish closes/drains the gesture before the final canonical commit; cancel closes/drains it and restores current canonical runtime gain. Register the slider with `registerHistoryEditorSettlement` to cancel active previews before history commands. See contracts for exact ordering and failure behavior.

**Rationale**: The current main handler is already preview-only, but `MixerRealtimeLevelUpdate` contains only channelId/level and the handler reads an undeclared gestureId via a cast. Reconciliation already exposes `drainPreviews` and rejects closed-gesture writes. History's cancellation path restores a committed active history group; a preview-only drag has no such group, so an empty history cancel is insufficient.

**Alternatives considered**: No new preview subsystem or engine protocol is needed. The existing endpoint and reconciliation queue are sufficient with typed lifecycle and document fencing. Do not use renderer-held starting gain as authority when another view may have committed a newer value.

### Meter geometry and labels

**Decision**: Reuse `MeterScaleRuler.tsx` as a local meter-only ruler; remove its global-panel mount and spacer structure. Share pure track geometry between it and `MeterCanvas.tsx`. Filter numeric labels only on profile/height/font-metric changes; telemetry updates continue through the existing canvas path.

**Rationale**: Static local labels solve distance and alignment without multiplying React updates at audio telemetry rate. Sharing the actual 10-pixel meter insets avoids duplicated geometric assumptions.

**Alternatives considered**: Repeating the current ruler's full-strip spacers keeps fragile alignment. Painting all text every meter frame adds unnecessary work and loses easy semantic labeling. A new rendering or measurement dependency is unnecessary.

### State, data, and platform decisions

**Decision**: No new persisted fields, migrations, or taper selector. All projects adopt the fixed curve. Canonical dB, automation interpolation, meter preferences, and generated CSD stay unchanged. Update typed app IPC only for preview lifecycle; no change to the engine protocol or Java helper.

**Rationale**: The gain value already contains the durable meaning. Position is disposable view state. Existing host-window portals and owner-document settlement support detached mixer surfaces.

**Alternatives considered**: A per-project legacy taper introduces behavior branches with no audio-compatibility benefit. Rewriting automation into position coordinates would alter intermediate values and is explicitly rejected.

**Resolution status**: All Phase 0 questions are resolved. Phase 1 contracts define the selected formulas, interaction lifecycle, geometry, and validation obligations.

## Layout feasibility and planning checks

At the nominal 88-pixel border-box width, reserve a 1-pixel right border and 1-pixel inner padding on each side: 85 pixels remain. Use a 24-pixel fader region, 2-pixel gap, and 59-pixel meter/label region (22-pixel labels, 1-pixel gap, 36-pixel meter allocation). Keep actual meter widths at 10/12/up-to-36 pixels, aligned beside the labels. The visible label/bar content is already wider than the fader even for mono; extra meter allocation keeps columns stable between channel counts. Validate actual font metrics and focus rings in the browser.

At minimum height, show the profile zero reference and floor first, then the ceiling if it fits, then other major labels from higher to lower signal values where their text bounds fit. Do not move their reference marks. In a 60-pixel meter with a 40-pixel usable track, mixing-profile +6 and 0 are only about 5.2 pixels apart: requiring both numeric labels would be unreadable. Retain ceiling/clip indication even when the ceiling number is omitted. Check 60/120/240-pixel level regions at 100% and 200% scaling.

Reclaim the Output heading's height into the flexible level area. Retain the existing chain-list heights and separate gain/peak numeric roles; chain resizing and merging readouts would expand the task beyond the requested layout.

Verification should include local meter alignment, cap/unity geometry, all existing profiles, ordinary/sub/master strips, long output names and warnings, disabled meters, missing telemetry, docked/detached views, accessibility, and focused project-history regressions for any touched edit handlers. No runtime implementation or audio behavior was changed during this research.
