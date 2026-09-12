# Feature Specification: Mixer Channel Strip Layout and Fader Taper

**Feature Branch**: `codex/107-channel-strip-layout`

**Created**: 2026-09-12

**Status**: Complete — implemented and validated

**Scope update (2026-09-12)**: The project owner prioritizes established mixing ergonomics over Java fader parity and approved one improved fixed taper. Saved gain, automation, and audio semantics remain unchanged; the finite -96 dB endpoint remains in this feature.

**Input**: User description: "Focus the next spec on the channel strip: meter labels per strip instead of the global ruler; meter space with labels taking more space than the fader; replace the Output label with a small right arrow beside the output dropdown. Research the relationship between fader y mapping and meter scale, review CHANNEL_STRIP_UI_RESEARCH.md, and create a branch and spec."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Read each channel's signal level locally (Priority: P1)

As a composer, I can read a channel's meter against labels inside that strip, even when it is far from the left edge of the mixer. Meter bars and their labels receive more horizontal space together than the fader control.

**Why this priority**: Local references remove the need to compare a distant ruler with a moving signal, and make the available strip space useful.

**Independent Test**: Show at least 20 strips, scroll to the last ones, and read known signal levels from each strip without consulting another strip or a panel-edge ruler. Repeat for all five existing profiles and mono, stereo, and multichannel signals.

**Acceptance Scenarios**:

1. **Given** meters are enabled, **When** ordinary, subchannel, and master strips are visible, **Then** each meter has its own adjacent numeric scale and there is no separate global ruler column.
2. **Given** any supported profile, **When** a signal matches a displayed reference mark, **Then** its corresponding meter indication aligns with that mark; labels use the selected profile's reference values.
3. **Given** an 88-pixel-wide strip at standard display scale, **When** its level area is shown, **Then** the combined meter-and-label region is wider than the fader region, labels are contained within the strip, and separate signal bars remain visible.
4. **Given** a short mixer view, **When** labels would overlap, **Then** fewer labels are shown while retaining the profile's zero-reference and floor labels, adding the ceiling and other major labels where they fit; marks never move to make labels fit.
5. **Given** meters are disabled, **When** the mixer is displayed, **Then** meter bars, meter labels, and held-peak readouts are absent and the fader remains usable without a vacant global ruler column.

---

### User Story 2 - Adjust gain with a clear and stable fader (Priority: P1)

As a composer, I can grasp a visible fader cap, identify unity gain, and make fine adjustments around normal mixing levels using a fixed mixing-oriented taper, while choosing whichever meter profile helps me assess the signal.

**Why this priority**: Reallocating strip space must retain reliable gain adjustment and distinguish the control's gain from the meter's measured level.

**Independent Test**: Set representative gains, verify that -20 to +6 dB occupies at least 45% of usable fader travel, switch through all meter profiles, resize the mixer, and repeat gain editing by drag, keyboard, and numeric entry. Verify preserved gain values across view changes and correct undo/redo outcomes.

**Acceptance Scenarios**:

1. **Given** a channel at 0 dB gain, **When** its fader is shown, **Then** the cap aligns with a dedicated unity-gain mark in the upper portion of travel, with usable boost travel above it and no abrupt sensitivity change across unity.
2. **Given** a fixed gain and unchanged mixer height, **When** the meter profile changes, **Then** the fader position and gain remain unchanged while the meter adopts the selected scale.
3. **Given** a K-reference profile, **When** the meter displays its zero reference, **Then** the interface identifies that reference as belonging to the meter; the fader's 0 dB continues to mean unity gain, and held sample peaks remain identified as dBFS.
4. **Given** the redesigned cap, **When** the user drags, uses keyboard controls, double-clicks to reset, or edits the numeric gain, **Then** the gain range and direct numeric precision are preserved, pointer movement uses the new taper, and keyboard adjustments use predictable dB increments independent of the curve.
5. **Given** a committed gain edit, **When** the user undoes and redoes it, **Then** gain, associated project state, dirty state, and running audio are restored consistently; cancelling an edit restores its prior state.
6. **Given** an existing project with fixed and automated channel gains, **When** it opens with the new taper, **Then** faders may appear at new positions but stored values, automation interpolation, and playback sound remain identical; simply opening the mixer creates no edit.

---

### User Story 3 - Route outputs in one compact row (Priority: P2)

As a composer, I can recognize and change a strip's output destination in a single row, leaving more height for level controls.

**Why this priority**: A separate Output heading consumes scarce vertical space without providing another action.

**Independent Test**: Open ordinary and subchannel strips with short and long destination names, operate their output selectors by pointer and keyboard, and compare level-area height with the current two-row output section at the same mixer height.

**Acceptance Scenarios**:

1. **Given** a routable strip, **When** it is displayed, **Then** a small right-pointing arrow precedes the output dropdown on one row, replacing the separate visible Output label.
2. **Given** keyboard or assistive-technology navigation, **When** the selector receives focus, **Then** its accessible name identifies the channel and output destination; the arrow does not create another focus stop or action.
3. **Given** a long destination name or an invalid existing route, **When** the row is displayed, **Then** the selector stays within the strip, the full destination can be inspected, and existing routing warnings remain discoverable.
4. **Given** a destination change, **When** it is committed, undone, and redone, **Then** the same routing validation, history, and runtime reconciliation behavior as before the layout change is preserved.
5. **Given** the master strip, **When** it is displayed, **Then** it does not gain an output selector; its meter scale remains aligned with its own meter.

### Edge Cases

- At 60 pixels of level-control height, labels use a reduced set without collisions. Below the supported minimum, content remains reachable through the existing view's overflow behavior rather than being compressed into overlapping controls.
- Resizing, display scaling, horizontal scrolling, and moving between docked and detached mixer views preserve local label-to-meter alignment.
- Mono, stereo, and supported multichannel meters retain separate bars and clip indicators. A dense channel count must not cover the scale or fader.
- Silence, below-floor levels, over-range levels, held peaks, clipping, and absent telemetry retain the established display behavior. A label is never shifted to imply a different signal value.
- Profile changes during playback update all local scales together without changing gain or automation. Selecting the active profile remains a no-op.
- Old projects with absent meter settings retain their existing defaults; explicit saved settings take precedence.
- The finite minimum gain of -96 dB must not be relabeled as silence or negative infinity.
- A pointer press and release without movement must not round the current gain, create a history entry, or send a changed runtime gain. Interrupted drags and numeric-edit cancellation restore canonical and runtime state.
- The new taper applies consistently to every channel and every project. There is no legacy-mode switch, per-project taper migration, or per-fader choice.
- Routing warnings, long names, focus indicators, and open menus must not obscure the gain control or meter reference labels.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every visible enabled meter MUST have numeric scale labels inside its own strip, immediately adjacent to its meter bars. The panel-wide ruler column MUST be removed.
- **FR-002**: Local labels and ticks MUST follow the selected existing project's meter profile, including its scale mapping, range, and K-reference offsets. This feature MUST NOT introduce or alter meter profiles, measurements, ballistics, or clip thresholds.
- **FR-003**: Label reference positions MUST align with the actual meter track, including its endpoint insets, across resizing and all mixer surfaces. Alignment MUST NOT depend on equal header, effect-chain, or output-section heights between different strips.
- **FR-004**: Labels MUST adapt to available height without overlap or clipping. Preserve the profile-zero and floor labels first, then the ceiling if it fits, then additional existing major labels from higher to lower signal values wherever their text bounds fit. Omitted numeric labels MUST NOT remove the profile's ceiling or clipping indication. Preserve the underlying values and positions of all retained labels.
- **FR-005**: At the existing 88-pixel strip width, the combined meter-bar and numeric-label region MUST be wider than the fader region for mono, stereo, and supported multichannel layouts. Width MUST be reclaimed from unused spacing without increasing the default strip width or reducing existing meter-bar widths.
- **FR-006**: The fader MUST have a horizontal rectangular cap spanning most of its allocated control width, a visible center reference, and a pointer target at least 24 by 24 logical pixels. Its target and focus indication MUST remain separate from meter interactions.
- **FR-007**: The fader MUST show a dedicated unity-gain mark. Gain readouts and accessible descriptions MUST identify gain in dB; meter context MUST identify dBFS or the active K reference. The meter ruler MUST NOT be presented as the fader's gain scale.
- **FR-008**: All channel faders MUST use one fixed, continuous, strictly increasing, invertible mixing-oriented taper over the existing -96 to +12 dB range. At least 45% of usable travel MUST cover -20 to +6 dB, low-level attenuation MUST occupy progressively less travel per dB, and movement sensitivity MUST remain continuous through unity. Unity MUST lie between 65% and 85% of usable upward travel. Meter-profile changes MUST NOT change the taper; no selectable taper or new preference is introduced.
- **FR-009**: Drag, keyboard, numeric gain edit, double-click unity reset, focus, and cancellation MUST remain available with the redesigned cap. Arrow keys MUST adjust by 0.1 dB; Shift+Arrow and Page keys MUST adjust by 1 dB; Home/End MUST select -96/+12 dB. Pointer and keyboard operations MUST clamp to that finite range. Direct numeric editing MUST retain existing precision, and no view-only action may quantize stored gains or rewrite automation.
- **FR-010**: Routable strips MUST display one horizontal output row containing a small right-pointing arrow followed by the destination selector. The separate visible Output heading MUST be removed. The selector MUST retain a meaningful accessible name; the arrow MUST be non-interactive.
- **FR-011**: Output targets, validation, warning behavior, and the master's lack of an output selector MUST remain unchanged. Truncated destination names MUST be available in full through the selector or an accessible description.
- **FR-012**: At equal panel height and display scale, removing the output heading MUST release at least one former heading line of height to the level-control area of routable strips, without shrinking the existing effect-chain lists or hiding other controls.
- **FR-013**: Disabling meters MUST hide all meter-specific labels and readouts along with the bars. The fader's own unity mark and gain readout MUST remain visible.
- **FR-014**: Rendering, resizing, scrolling, and opening the redesigned mixer MUST NOT create project history entries, dirty the project, change stored values, or affect generated audio.
- **FR-015**: Any existing project edit touched by this work—gain, routing, meter visibility, or profile selection—MUST continue through canonical project history with a semantic action label. Verification MUST cover commit, undo, redo, canonical values, stable identities and references, dirty state, and reconciliation with running audio or meter presentation as applicable.
- **FR-016**: The layout MUST work in docked and detached views, at standard and enlarged display scales, with keyboard focus visible and reference information understandable without color alone.
- **FR-017**: A completed pointer gain gesture MUST commit at most one semantic history action; movement previews MUST remain transient, and cancellation or interruption MUST restore canonical/runtime gain without adding a history entry. A gesture with no net value change MUST be a no-op. Automation playback and interpolation MUST remain based on the existing gain values, independent of display position.

### Existing Behavior & Data Compatibility _(mandatory when applicable)_

- **Reference Behavior**: Java Blue's mixer ChannelPanel establishes the existing gain semantics and -96 to +12 dB range. Its piecewise taper is the comparison baseline, intentionally replaced here. Existing metering and its five profiles are defined by completed features 104 and 105. The companion research records source locations and mapping calculations.
- **Compatibility Requirements**: Preserve existing and legacy project gain, automation points and interpolation, routing, effect chains, unknown project content, meter preference defaults, generated CSD, and audio behavior. The new layout applies to both old and new projects without a project migration.
- **Intentional Divergences**: With project-owner authorization on 2026-09-12, the fixed mixing-oriented taper and uniform dB keyboard increments intentionally replace Java/current fader behavior to improve adjustment precision around ordinary mixing levels. Existing projects adopt the new display mapping without altering their sound. Local labeled meters, rectangular cap with unity mark, width allocation, and compact output row also intentionally improve presentation. Deterministic mapping, project round-trip, automation, and history verification must cover the divergence.
- **State Ownership**: Active BlueData remains the canonical project owner of channel gain, routing, automation, and existing meter preferences, persisted in .blue project files. Label density, geometry, focus, and hover are disposable view state; telemetry, held peaks, and clip state retain their existing runtime ownership. No new project fields or application preferences are introduced.
- **Undo/Redo Impact**: Presentation alone creates no history entry. Existing gain, output destination, meter-enable, and profile edits retain canonical history behavior, including cancellation and no-op handling. Touched mutation paths require the focused restoration coverage in FR-015.

### Key Entities _(include if feature involves data)_

- **Channel Strip**: One channel's name, pre/post effect chains, gain control, output destination where applicable, and optional meter display.
- **Gain Control**: The existing channel gain in dB, its new fixed display mapping, editable numeric value, unity reference, and disposable interaction preview.
- **Local Meter Scale**: A per-strip presentation of the existing project-wide meter profile, with a height-dependent subset of numeric labels.
- **Output Destination**: An existing validated routing choice, displayed in the compact output row.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every fully visible enabled strip in a 20-strip mixer can be read using only its own labels; no global ruler remains. This passes for ordinary, subchannel, and master strips in all five profiles.
- **SC-002**: At level-control heights of 60, 120, and 240 logical pixels, every displayed reference aligns with its meter position within 1 logical pixel, with zero overlapping or clipped labels. Repeat at 100% and 200% display scale in docked and detached views.
- **SC-003**: At the standard 88-pixel strip width, meter plus labels occupy more width than the fader for mono, stereo, and the existing maximum-width multichannel meter. The fader target meets 24 by 24 logical pixels and no meter bar is narrower than before.
- **SC-004**: Each routable strip uses one output row and gains at least one former Output-heading line of level-control height at an unchanged panel size; its pre/post chain heights remain unchanged.
- **SC-005**: For gains -96, -60, -24, -6, 0, +6, and +12 dB, changing any meter profile produces zero change in stored gain or normalized fader position. Existing project fixtures retain identical automation and generated audio/CSD behavior.
- **SC-006**: Pointer and keyboard verification completes gain editing, unity reset, output selection, meter-profile selection, and peak clearing without inaccessible controls. Commit→undo→redo verification passes for every touched durable edit, and view-only actions cause zero dirty-state or history changes.
- **SC-007**: -20 to +6 dB occupies at least 45% of usable travel (versus approximately 26.67% before); unity falls between 65% and 85%. Increasing gain always moves upward, and sensitivity has no discontinuity at unity. Mapping gain to position and back differs by no more than 0.000001 dB across the supported range before user-input rounding.
- **SC-008**: A multi-movement drag creates exactly one history action when its final gain changes, while cancelled and no-change gestures create zero. Legacy and new-project fixtures retain identical saved gains, automation values/interpolation, and generated CSD/audio before any deliberate gain edit.

## Assumptions

- "Meter space with labels taking more space than fader" means their combined horizontal allocation, not wider bars individually or a taller meter than fader. Both retain the same available level-area height.
- The current 88-pixel strip width remains the default. A rectangular fader cap and a unity mark are included as supporting improvements identified in the supplied research.
- The meter scale is visually associated with the meter; a full numbered fader ruler is unnecessary for this scope because the gain readout and unity mark supply its essential references.
- The new taper is an application-wide fixed interaction rule, shared by old and new projects. It takes priority over Java position parity; saved gain and automation compatibility remain required. There is no claim that one exact curve is mandated by an industry standard.
- A true negative-infinity/silent bottom endpoint is deferred. The existing -96 dB endpoint remains finite and labeled as such; existing project values are never reinterpreted as mute.
- Collapsible or resizable effect chains, narrow-strip modes, merged numeric readouts, new metering algorithms, and per-strip meter profiles are outside this feature.
- Existing meter telemetry, routing validation, and project history from completed features are dependencies. Planning must verify label prioritization at minimum height and precise horizontal allocation against the acceptance criteria.
- Research evidence and source corrections are maintained in [research.md](research.md); implementation choices belong to the subsequent plan.
