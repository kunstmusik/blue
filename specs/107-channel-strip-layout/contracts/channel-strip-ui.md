# Channel Strip UI Contract

## Fixed fader taper

The renderer's pure conversion pair is:

```text
gainDbToFraction(g) = ((g + 96) / 108)^3
fractionToGainDb(p) = 108 * cbrt(p) - 96
```

Domains are finite `g ∈ [-96,12]`, `p ∈ [0,1]`. Clamp finite display/pointer inputs at this boundary. Conversion functions do not mutate data. Invalid/non-finite display values fall back to bottom position; invalid user or IPC values must not commit. Endpoint results are exactly -96/12 and 0/1. Unrounded inverse error must be <=1e-6 dB across the range.

The mapping is strictly increasing, with continuous sensitivity at unity. The cubic compresses the extreme low tail; exact low gains remain available through keyboard and text entry. No UI path relabels -96 as `-inf`. Meter reference functions never enter these conversions.

Expected upward fractions (tolerance 1e-6):

| Gain dB |     Fraction |
| ------- | -----------: |
| -96     |            0 |
| -60     | 0.0370370370 |
| -24     | 0.2962962963 |
| -20     | 0.3484733018 |
| -6      | 0.5787037037 |
| 0       | 0.7023319616 |
| +6      | 0.8424211248 |
| +12     |            1 |

## Slider component boundary

The extracted `MixerLevelSlider` takes channel name, canonical `levelDb`, control height, and numeric lifecycle callbacks (`onPreview`, `onCommit`, `onCancel`). It owns local gain draft and pointer geometry only. ChannelStrip/MixerPanel adapt these callbacks to the typed preview and project patch paths. The exact callback names are local implementation details; dB payloads, lifecycle order, and absence of fabricated DOM events are the contract.

- Accessible role: vertical slider; name `Gain for <channel name>`; value min/max/current in dB, plus formatted `aria-valuetext`.
- ArrowUp/Right: +0.1 dB; ArrowDown/Left: -0.1 dB.
- Shift+Arrow or PageUp/Down: +/-1 dB. Home/End: -96/+12 dB.
- Keyboard increments add to the current value; normalize floating-point arithmetic noise without rounding an existing fractional starting value to a coarser grid.
- Double-click: exactly 0 dB with the existing semantic project action. A preceding click does not commit another gain.
- Numeric edit: finite input clamped to the existing range on commit, existing precision preserved; Enter and subsequent blur produce at most one edit, Escape produces none.
- Pointer: relative drag from the captured starting fraction (no jump on press). `candidateFraction = clamp(startFraction + (startY-currentY)/usableTravel, 0, 1)`; apply the inverse and round only the deliberate pointer candidate to 0.01 dB. Returning exactly to the starting pointer position restores the exact captured gain, including extra precision.
- Release commits only if the final gain differs from the start/current canonical gain after validation. No-movement/no-net-change/cancel paths produce no history entry.
- Owner-document pointer capture and cleanup work in detached windows. Ignore non-primary buttons and a second active pointer. Escape, pointercancel, lost capture before successful release, window blur, and unmount cancel safely.
- Resizing during an active drag cancels it, preventing the captured travel geometry from changing interpretation mid-gesture.
- Input is temporarily unavailable during async final settlement; focus remains visible. History settlement cancels an active draft and awaits restoration.

### Fader geometry

Outer level-control height `H >= 60` logical pixels. Fader column is 24 pixels wide, with a visible 22-by-10-pixel rectangular cap and center line. Cap-center endpoints are `y=12` and `y=H-12`, yielding `usableTravel=H-24`; the 24-by-24 pointer target remains within the control even at either endpoint. The full dedicated fader column can accept relative drags.

`capCenterY = 12 + (1-fraction)*(H-24)`. Draw the dedicated unity tick at the result for gain 0, with a visible segment beside the cap. Identify its meaning through the gain readout/name and an accessible description or tooltip. Do not place meter-scale labels as fader labels. No added numeric header row is required.

## Meter and label geometry

Meter bars retain existing measurement, width, colors, hold/clip behavior, and animation. `trackTop=10`, `trackBottom=H-10`, `trackHeight=H-20`. For a profile reference at signal dB `d`, `labelCenterY=10+(1-profile.dbToFraction(d))*(H-20)`.

The fader's center endpoints and meter track endpoints differ intentionally because the cap hit target needs room. Each scale aligns to its own meaning and actual track. Do not artificially align the two zero references.

Use one local numeric ruler per strip. Candidate labels are existing major labels, deduplicated by reference value. Selection order is profile zero, floor, ceiling, then the remaining major labels from highest to lowest signal value. Accept a candidate only when its text box stays within the outer meter and has at least 2 logical pixels separation from every accepted text box. The existing 14-pixel subheadline line height fits the required zero/floor anchors at H=60; derive the actual line height if typography changes. Return accepted labels sorted by y for rendering. Leave existing ticks/ceiling/clip indication intact when a numeric label is omitted.

Use the existing 11-pixel subheadline font token and 14-pixel line-height token with monospaced numerals. A 22-pixel numeric column fits the current longest three-character labels. If browser font metrics fail this, adjust internal spacing within the existing strip budget; do not shrink the typography or change profile label values.

Expose profile/reference context in the local meter's accessible description and hover text (dBFS for peak/RMS profiles, named K reference and its dBFS offset for K profiles). Held peak remains absolute dBFS. Labels are static semantic content, not live regions; they do not subscribe to meter frames.

### Horizontal allocation

At 88-pixel border-box width:

| Allocation                            | Width |
| ------------------------------------- | ----: |
| Right border                          |  1 px |
| Left and right inner padding combined |  2 px |
| Fader column                          | 24 px |
| Fader-to-meter-region gap             |  2 px |
| Meter/label region                    | 59 px |

Inside the 59-pixel region: 22-pixel labels, 1-pixel gap, and 36-pixel available bar area. Preserve actual `getMeterWidth` outputs of 10/12/up-to-36 and place bars directly beside the labels. Do not reduce existing bar widths or increase the strip's default width. With meters disabled, hide this region and peak readout; center the unchanged usable fader column in the strip. Keep its gain readout and unity mark.

Remove the global MeterScaleRuler mount in MixerPanel. Every strip, including the master and detached/grouped strips, owns local geometry. No ruler header or chain/output spacers remain.

## Compact output row

Keep the existing selector component and routing validation. One horizontal row contains a small Lucide `ArrowRight` (12 logical pixels, non-interactive, `aria-hidden`) followed by a `min-width:0` flexible output selector. Remove the fixed 80-pixel selector width and Output heading. The arrow is not a navigation command or additional tab stop.

Provide selector name `Output for <channel name>` and full selected destination through title/menu/accessibility. Long visible text truncates within the row; invalid-route warnings retain their message and fit beside the selector without creating a permanent second heading row. Master has no output selector. The existing 50-pixel pre/post lists remain unchanged; released heading height goes to level controls.

## Observable edit contract

All project edits use existing typed patches: gain/output via `updateChannel`, visibility via `setMeterEnabled`, profile via `setMeterProfile`. Preserve validation and semantic history labels. Any field not deliberately edited remains unchanged. Rendering and switching the visual taper by adopting this application version never create edits.

Validation matrix: five profiles × 60/120/240-pixel level-control height × 100%/200% scale × docked/detached views, with mono/stereo/multichannel, 20-strip scrolling, enabled/disabled meters, long routing names, and master. Automation fixtures additionally prove unchanged values and intermediate-time playback despite different cap positions.
