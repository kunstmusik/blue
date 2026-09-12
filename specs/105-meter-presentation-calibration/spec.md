# Feature Specification: Meter Presentation and Calibration

**Feature Branch**: `105-meter-presentation-calibration`

**Created**: 2026-09-11

**Status**: Complete (2026-09-11)

**Input**: User description: "Add dB tick marks, a numeric peak readout with click-to-clear,
selectable meter profiles including useful K-System references, and project-owned meter
preferences. Add a gear at the far right of the mixer that opens Mixer Settings. Its initial
setting is Enable Meters; legacy projects default it off and new projects default it on."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read levels precisely at a glance (Priority: P1)

As a composer mixing a project, I want each active meter to have recognizable dB reference marks
and a numeric peak value so that I can judge headroom without estimating from color alone.

Meters retain their live RMS bar, sample-peak hold marker, and clip indication. A scale ruler uses
major labeled marks and minor marks appropriate to the selected profile. Each strip's numeric
readout shows the highest held sample peak across that strip's output channels. Values below the
display floor show `-inf`; finite values use one decimal place and `0.0` or higher uses the warning
or clip styling already associated with overload.

**Why this priority**: It turns the existing activity indicator into a meter that supports
repeatable level decisions.

**Independent Test**: Play known fixed-level signals through mono, stereo, and multichannel strips
and confirm that bar/peak positions align with labeled reference marks and that the readout reports
the highest held channel value within 0.1 dB.

**Acceptance Scenarios**:

1. **Given** meters are enabled and a known -18 dBFS signal is playing, **When** the selected
   profile includes a -18 reference, **Then** the live indication aligns with that reference and
   the held numeric peak reads `-18.0` within the measurement tolerance.
2. **Given** a stereo strip whose left and right held peaks differ, **When** the peak readout is
   observed, **Then** it displays the higher of the two values without hiding the separate bars.
3. **Given** a strip has registered peak and clip state, **When** the user clicks either its meter
   or numeric peak readout, **Then** that strip's numeric peak, peak-hold markers, and clip
   indicators clear together and resume measuring subsequent audio.
4. **Given** the mixer is resized or detached, **When** there is insufficient width to label every
   strip independently, **Then** aligned marks remain visible on the meters and at least one
   legible labeled scale ruler remains available in the mixer.
5. **Given** a meter has received no finite signal since being cleared, **When** its numeric peak is
   shown, **Then** it displays `-inf` and does not display NaN or an arbitrary floor value.

---

### User Story 2 - Choose a useful meter presentation (Priority: P1)

As a user working on different kinds of material, I want to switch the project between a familiar
linear meter, a more readable expanded mixing meter, and common K-System references so that the
display matches the level discipline I am using.

The initial profile labels are Peak/RMS Linear (+6 dBFS), Peak/RMS (+6 dBFS), K20 (RMS + Peak),
K14 (RMS + Peak), and K12 (RMS + Peak). Each profile has a stable, non-display key that is used for
project persistence and application contracts; the human-readable label is replaceable
presentation text and is never the profile's stored identity. Profile selection is available from
the meter area, applies to every mixer strip in the project, and persists with that project.
Changing it immediately repositions bars, peak markers, ticks, labels, and thresholds without
changing any measured dB value or audio behavior.

**Why this priority**: Scale selection and calibration references are the central presentation
improvement, and the common list must be useful without implying unsupported broadcast or
loudness measurement standards.

**Independent Test**: While a fixed set of signals plays, switch through all five profiles and
confirm their documented reference positions and labels while the audio output and numeric peak
values remain unchanged.

**Acceptance Scenarios**:

1. **Given** any open project with meters enabled, **When** the user chooses one of the five
   profiles, **Then** all source, subchannel, and master meters adopt it immediately and the project
   is marked modified.
2. **Given** a project saved with a selected profile, **When** it is closed and reopened, **Then**
   that profile is restored.
3. **Given** a user changes the profile, **When** they undo and redo the action, **Then** the prior
   and selected profiles respectively return, all open mixer views agree, and dirty state is
   accurate.
4. **Given** the K14 (RMS + Peak) profile and an RMS value of -14 dBFS, **When** the meter renders,
   **Then** the RMS bar aligns with the scale's 0 reference while the sample-peak hold/readout still
   reports its absolute dBFS value.
5. **Given** any profile change, **When** playback, CSD export, or disk rendering is compared before
   and after, **Then** fader gain, automation, generated audio program, and rendered audio are
   unchanged.
6. **Given** a K-System profile is selected, **When** its description is viewed, **Then** the UI
   explains that the marking is a level reference and does not calibrate monitor SPL or hardware.

---

### User Story 3 - Control meter visibility per project (Priority: P1)

As a user, I want a clearly discoverable Mixer Settings window where I can disable meters for a
project when I want a simpler or lighter mixer, while new projects get the useful meter display by
default.

The preferred location for the gear control is the far right of the mixer toolbar after Add
Subchannel, where it remains visible independently of channel-strip scrolling. It opens a Mixer
Settings window containing **Enable Meters** and explanatory text. Meter-profile selection remains
available directly from each strip's meter interaction surface.
Turning Enable Meters off removes meter bars, scale markings, and peak readouts from all docked and detached
mixer views, without disabling the mixer or changing sound. Turning it on restores them.

**Why this priority**: The feature introduces more visual information and ongoing display work;
users need a project-specific opt-out, and legacy projects need the requested conservative default.

**Independent Test**: Verify the gear position and window, toggle Enable Meters in a new project
and a legacy project, save/reload, and exercise undo/redo while observing both docked and detached
mixer views.

**Acceptance Scenarios**:

1. **Given** a newly created project, **When** its mixer first appears, **Then** Enable Meters is on
   and meters, markings, and peak readouts are visible.
2. **Given** a project file created before this setting existed, **When** it is loaded, **Then**
   Enable Meters is off and no meter presentation is shown until the user enables it.
3. **Given** a project with Enable Meters explicitly saved on or off, **When** it is reopened,
   **Then** its explicit value is restored rather than applying the legacy default.
4. **Given** the mixer toolbar, **When** viewed horizontally, **Then** the settings gear is placed
   on the toolbar row aligned to the far right with flex space after Add Subchannel and remains
   reachable through keyboard navigation.
5. **Given** Mixer Settings is open, **When** Enable Meters is changed, **Then** all mixer views
   update immediately, the change is committed as one project-history action with a semantic
   label, and the project is marked modified.
6. **Given** Enable Meters was changed, **When** the user undoes or redoes the change, **Then** meter
   visibility, the checkbox, all open mixer views, and dirty state return to the corresponding
   canonical project state.
7. **Given** meters are disabled during playback, **When** audio continues, **Then** mixer routing,
   faders, effects, automation, and audible output continue unchanged and meter-only display work
   ceases.

---

### User Story 4 - Preserve compatible project data (Priority: P2)

As a Blue user moving projects between versions, I want new mixer presentation settings to survive
round trips without damaging older project content or changing the project's sound.

**Why this priority**: Presentation preferences are durable project data, so compatibility and
lossless XML handling are required even though the audio model does not change.

**Independent Test**: Round-trip representative legacy and new project fixtures, including unknown
mixer content, then compare canonical mixer/audio state, generated CSD, and undo/redo behavior.

**Acceptance Scenarios**:

1. **Given** a legacy project with no meter-presentation fields, **When** it is loaded and saved
   without the user changing these settings, **Then** existing known and unknown project data is
   preserved and the project's audio/CSD behavior is unchanged.
2. **Given** a project containing an unrecognized future profile identifier, **When** it is loaded,
   **Then** the mixer uses a safe known profile for display, preserves the unrecognized project
   data when possible, and remains usable.
3. **Given** a new setting is copied, duplicated, restored from history, or published to another
   mixer window, **When** the operation completes, **Then** the canonical value and all visible
   views agree without changing channel identities or references.

### Edge Cases

- Disabling meters while clip indicators or peak holds are active clears disposable visual state;
  re-enabling starts from silence rather than reviving stale peaks.
- Closing Mixer Settings without making a change creates no history entry and does not dirty the
  project.
- Repeated selection of the already active profile or meter-enabled value is a no-op and creates no
  history entry.
- If a project is opened in more than one workbench surface, a setting committed from one surface
  is reflected in all of them from canonical project state.
- The gear remains identifiable and operable with keyboard navigation, high zoom, and without
  relying on color alone.
- A profile maps non-finite, over-range, and under-range telemetry to safe display bounds while the
  numeric readout never exposes NaN or Infinity other than the intentional `-inf` silence label.
- When meters are disabled before playback starts, the application should avoid meter-only runtime
  collection and subscriptions where the existing engine contract permits it; absence of that
  optimization must never affect audio correctness.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide project-wide profiles with stable keys
  `peak-rms-linear-plus-6`, `peak-rms-mixing-plus-6`, `k20-rms-peak`, `k14-rms-peak`, and
  `k12-rms-peak`; their initial visual labels MUST respectively be Peak/RMS Linear (+6 dBFS),
  Peak/RMS (+6 dBFS), K20 (RMS + Peak), K14 (RMS + Peak), and K12 (RMS + Peak).
- **FR-002**: Each profile MUST define its display floor/ceiling, dB-to-position behavior, major and
  minor marks, labels, color/reference thresholds, and whether the live bar is peak- or RMS-led.
- **FR-003**: Peak/RMS Linear (+6 dBFS) MUST preserve the existing uniform -60 to +6 dBFS visual
  mapping; Peak/RMS (+6 dBFS) MUST provide increased display resolution from -20 to +6 dBFS over a
  -70 to +6 dBFS range.
- **FR-004**: K-20, K-14, and K-12 Reference MUST align displayed 0 to RMS values of -20, -14, and
  -12 dBFS respectively, retain absolute-dBFS sample-peak indication, and clearly disclaim monitor
  calibration.
- **FR-005**: The system MUST show aligned tick marks for active meters and ensure at least one
  legible set of numeric scale labels is visible in every mixer view with meters enabled.
- **FR-006**: Every visible strip meter MUST show one numeric held sample-peak value representing
  the maximum across its output channels, with one decimal place and `-inf` for no finite signal.
- **FR-007**: Clicking a strip meter or its numeric readout MUST atomically clear that strip's
  numeric peak, peak-hold markers, and clip indicators.
- **FR-008**: Users MUST be able to select the project-wide profile from the strip meter context
  menu; profile options MUST list Peak/RMS (+6 dBFS) first, followed by Peak/RMS Linear (+6 dBFS),
  then K-metering references. The context menu MUST provide Clear Meter, Disable Meters, and active
  profile selection with a visible checkmark indicator.
- **FR-009**: The system MUST place a keyboard-accessible, named Mixer Settings gear button in the mixer
  toolbar header row, aligned far right with flexible space separating it from the Add Subchannel
  button; this toolbar position is the preferred location.
- **FR-010**: Activating the gear MUST open a Mixer Settings dialog whose general-setting surface
  contains only the **Enable Meters** toggle and explanatory text.
- **FR-011**: Enable Meters MUST control meter bars, scale marks/labels, peak readouts, and
  meter-specific display updates across all mixer views without changing mixer enablement or audio.
- **FR-012**: New projects MUST initialize Enable Meters to true; loading a project that lacks the
  persisted field MUST resolve it to false; an explicitly persisted value MUST take precedence.
- **FR-013**: New projects MUST initialize profile key `peak-rms-mixing-plus-6`; legacy projects lacking a
  persisted profile MUST default to `peak-rms-linear-plus-6`.
- **FR-014**: Enable Meters and the selected profile MUST be durable project settings in canonical
  `.blue` project data and MUST round-trip without loss of unrelated or unknown content.
- **FR-015**: Each user change to Enable Meters or profile MUST be a single semantic project-history
  action and MUST support commit, undo, and redo with correct canonical state, published snapshots,
  stable identities/references, and dirty-state behavior.
- **FR-016**: Reapplying the current value MUST create no project mutation, history entry, or dirty
  state change.
- **FR-017**: Disabling meters MUST clear transient meter display state and stop meter-specific UI
  animation; when feasible within the existing playback contract it SHOULD also avoid requesting
  or subscribing to meter telemetry for subsequent playback sessions.
- **FR-018**: Profile and visibility changes MUST NOT alter channel levels, fader mapping,
  automation, routing, generated CSD, offline renders, or realtime audio output.
- **FR-019**: Meter presentation and settings MUST behave consistently in docked, detached, and
  concurrently open mixer views.
- **FR-020**: Unrecognized or invalid persisted presentation values MUST fall back to a safe known
  display behavior without preventing project load or discarding unrelated project data.
- **FR-021**: The controls, checkbox, profile selector, scale markings, and overload state MUST be
  usable without color alone and MUST expose meaningful names and state to assistive technology.
- **FR-022**: Persisted XML, typed patches, snapshots, history state, and runtime selection MUST use
  stable profile keys rather than human-readable labels; changing or localizing a visual label MUST
  require no project-data migration and MUST preserve existing selections.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue's `blue.mixer.Mixer` owns mixer project data and serializes it
  under `<mixer>`. It has no meter visibility/profile fields, so absence of those fields identifies
  a legacy project for this feature. The current TypeScript mixer and Spec 104 realtime telemetry
  are the behavioral baseline. `.tmp-research/METER_FADE_ROUND2.md` and this feature's
  `research.md` provide the profile survey.
- **Compatibility Requirements**: Existing mixer enablement, channels, levels, routing, effects,
  automation, unknown XML, CSD generation, realtime playback, and disk rendering MUST remain
  compatible. A meter profile is presentation only. Legacy files load with meters hidden as
  requested; saving or changing presentation settings must not silently rewrite unrelated state.
- **Intentional Divergences**: Java Blue has no equivalent meter-presentation settings. Blue
  Electron intentionally adds project-owned fields, defaults missing legacy values to meters off,
  and defaults newly constructed projects to meters on with Expanded presentation.
- **State Ownership**: The active `BlueData` mixer is the canonical owner of Enable Meters and the
  selected meter profile; both persist in `.blue` XML. Live meter values, holds, clip flags, open
  window state, hover/focus, and animation state remain disposable runtime/renderer state.
- **Undo/Redo Impact**: Both durable settings are user-visible project mutations. Each must use the
  canonical ProjectHistory/document-patch path with semantic labels and focused commit→undo→redo
  tests covering canonical values, snapshots in every view, stable project identities/references,
  dirty state, and playback/display reconciliation.

### Key Entities *(include if feature involves data)*

- **Mixer Presentation Settings**: Project-owned values controlling whether meters are shown and
  which profile all mixer meters use.
- **Meter Profile**: A stable non-display key plus replaceable presentation metadata and its
  behavior contract: range, deflection, ticks, labels, thresholds, and primary/secondary indication
  roles.
- **Held Peak State**: Disposable per-strip, per-output sample-peak and clip state summarized by one
  numeric maximum; cleared by user action or when meters are disabled.
- **Mixer Settings Window**: A view over canonical project settings; opening/closing it is session
  state, while changing its checkbox commits project data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For fixed test signals at every major mark in all five profiles, rendered meter and
  peak-marker positions align within 1 display pixel at standard scale, and numeric peak values are
  within 0.1 dB of the supplied sample-peak value.
- **SC-002**: In usability verification, a user can identify the selected profile, switch to K-14
  Reference, clear a held peak, and disable meters in no more than 30 seconds without documentation.
- **SC-003**: New, legacy-missing-field, and explicitly configured project fixtures produce the
  requested enabled, disabled, and persisted outcomes in 100% of load/save/round-trip cases.
- **SC-004**: Commit→undo→redo tests for both project settings restore canonical values, all visible
  mixer surfaces, stable identities/references, and dirty state with no divergent view.
- **SC-005**: Existing canonical CSD and disk-render fixtures remain byte-identical across every
  meter profile and both meter-visibility values.
- **SC-006**: With meters disabled, no meter canvases/readouts animate or repaint during playback;
  mixer controls remain responsive and audio behavior is indistinguishable from the enabled case.
- **SC-007**: All new controls can be reached and operated by keyboard and expose an accessible
  name, current value/state, and non-color overload indication.

## Assumptions

- The Spec 104 telemetry already supplies the RMS and sample-peak data needed for these profiles;
  this feature does not add true-peak, LUFS, VU, or standards-compliant broadcast PPM measurement.
- Mixer Settings contains only Enable Meters and explanatory text. The project-wide profile selector
  lives in the strip meter context menu.
- Peak/RMS (+6 dBFS), identified by `peak-rms-mixing-plus-6`, is the recommended new-project
  default. Peak/RMS Linear (+6 dBFS), identified by `peak-rms-linear-plus-6`, provides familiarity
  for legacy/current behavior; the K profiles cover the common K-System set found across Pro Tools,
  Cubase, and Studio One.
- Profile selection is global within a project. Separate master/track or per-strip profiles and
  user-authored curves/colors are deferred.
- “K Reference” means scale alignment and use of the existing RMS/peak values; it does not imply
  acoustic monitor calibration, certified ballistics, or hardware control.
- Mixer fader taper, gain-to-position mapping, and automation behavior are explicitly outside this
  feature and belong to a separate specification.

## Closure

- **Completed**: 2026-09-11
- **Automated verification**: Focused renderer and accessibility tests, renderer production build,
  lint/format checks, and whitespace validation passed.
- **Manual acceptance**: Project-owner manual testing completed successfully; meter presentation,
  profile interaction, Mixer Settings, and preferred toolbar gear placement looked correct.
- **Remaining specified work**: None.
