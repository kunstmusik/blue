# Feature Specification: Realtime Mixer Metering

**Feature Branch**: `104-mixer-metering`

**Created**: 2026-09-10

**Status**: Complete — implementation converged and project-owner manual testing accepted (2026-09-11)

**Input**: User description: "Realtime mixer metering (RMS and peak) for all mixer channels (source channels, subchannels, master) during realtime playback, based on a reviewed research report with code-verified corrections."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch live levels while the mix plays (Priority: P1)

As a composer, while a project plays back in the workbench I want a live level meter beside
every mixer channel fader — source channels, subchannels, and the master — so that I can see
which tracks are loud, which are silent, and whether anything is clipping, without routing
audio to external tools.

Each meter shows one bar per project output channel (for stereo: Left and Right), scaled in
decibels, with a green nominal zone, yellow/amber high and warning zones, a red overload
(clipping) indication, and a floating peak-hold line that briefly marks the loudest recent
moment before falling away.

**Why this priority**: This is the entire user value of the feature. A mixer without meters
forces blind level decisions; every other story is supporting quality of the same moment.

**Independent Test**: Start playback of a multi-track project in the mixer panel and observe
that every visible channel strip (including subchannels and master) shows a meter that visibly
rises and falls with the music and falls to silence when playback stops.

**Acceptance Scenarios**:

1. **Given** a project whose mixer is enabled with several source channels, at least one
   subchannel, and a master channel, **When** playback starts and audio is sounding, **Then**
   every channel strip in the mixer panel shows a meter whose bars move with the audio on that
   channel, and the master meter reflects the summed program.
2. **Given** playback is running, **When** a channel's fader is pulled down during playback,
   **Then** that channel's meter level falls accordingly (the meter shows the post-fader,
   post-effects signal that the channel actually delivers to its output route).
3. **Given** playback is running with a loud signal, **When** the signal exceeds full scale on
   a channel, **Then** that channel's meter shows a red clip indication that remains lit for a
   short hold time (about 2 seconds) even after the overload passes.
4. **Given** playback is stopped or finished, **When** meters are observed, **Then** all meters
   fall to their silence floor promptly (within about one second) and stay there.

---

### User Story 2 - Meters stay correct across mixer shapes and channel identities (Priority: P2)

As a user who renames channels, reorders them, routes through subchannels, or disables the
mixer entirely, I want meters to attach to the correct channel every time playback starts, and
to behave predictably when there is nothing to measure.

Meter-to-strip binding is established fresh at each playback start from the compile-time
channel identities used to generate that playback session's audio program, so reordering or
renaming between sessions never swaps a meter onto the wrong strip. Within a running session,
silence, disabled mixer, or missing engine support simply shows inactive meters rather than
errors.

**Why this priority**: Correctness of what the user sees. Wrong-channel or stale meters are
worse than no meters, and several of these conditions (disabled mixer, silent channels) are
common in real projects.

**Independent Test**: Play a project, stop it, rename or reorder channels, play again, and
confirm each meter tracks its own channel's audio; separately, disable the mixer and confirm
playback still works with inactive meters.

**Acceptance Scenarios**:

1. **Given** a project with renamed and reordered channels, **When** playback starts, **Then**
   each meter reflects the channel currently displayed in the strip it sits in (per the
   compile-time channel identity for that playback session).
2. **Given** a project with the mixer disabled, **When** playback starts, **Then** audio plays
   as before and meters remain inactive (no motion, no errors).
3. **Given** playback with one silent channel, **When** other channels show signal, **Then**
   the silent channel's meter rests at its silence floor without flicker or error values.
4. **Given** audio on a channel contains non-finite values (for example from unstable user
   Csound code), **When** the meter receives that data, **Then** the meter clamps to a safe
   display state and the application does not crash or freeze.

---

### User Story 3 - Metering costs nothing perceptible (Priority: P2)

As a performer/composer using Blue in realtime, I want metering to be effectively free: audio
must not glitch because meters are on, the interface must stay fluid while dozens of meters
animate, and meters must not change what my project renders to disk.

Metering exists only during realtime playback. Offline (disk) renders and CSD exports must be
unaffected: files and exported text are byte-identical to what the same project produced before
this feature. If the audio engine in use does not support metering (older engine build), 
playback behaves exactly as before with inactive meters.

**Why this priority**: Trust. A DAW-like tool that glitches audio or slows the UI for eye
candy, or that changes render output, loses more than it gains.

**Independent Test**: Compare disk-render and CSD-to-screen output before/after the feature
(byte-identical); play a heavy project (~60+ channels) and confirm the UI stays smooth and
audio is uninterrupted; run against an engine without metering support and confirm playback is
unaffected.

**Acceptance Scenarios**:

1. **Given** any project, **When** the user renders to disk or views/exports CSD text for
   non-playback purposes, **Then** the output is byte-identical to the pre-feature output for
   that project (existing fixtures keep passing).
2. **Given** playback of a large project (dozens of sounding channels), **When** meters animate
   on all strips, **Then** the mixer panel remains responsive — faders, solo/mute, and effects
   interactions show no perceptible lag, and the audio stream is uninterrupted.
3. **Given** an audio engine build that does not advertise metering support, **When** playback
   starts, **Then** playback and all existing behavior work unchanged and meters stay inactive.
4. **Given** playback running, **When** the engine stops unexpectedly (crash or kill), **Then**
   meters fall to silence and the app continues to function without meter-related errors.

---

### User Story 4 - Meters follow the mixer into detached windows (Priority: P3)

As a user who pops the mixer panel out into its own floating window (possibly on another
display), I want meters to animate in that window just as they do docked.

**Why this priority**: The mixer commonly lives in a popout; meters that freeze there would be
an obvious defect, but this is a refinement of Story 1 rather than core value.

**Independent Test**: Pop out the mixer panel during playback and observe meters animating in
the detached window; re-dock and confirm they continue.

**Acceptance Scenarios**:

1. **Given** playback running with active meters, **When** the mixer panel is detached into a
   popout window, **Then** meters animate in the popout window.
2. **Given** meters animating in a popout, **When** the popout is closed or re-docked, **Then**
   metering continues in the remaining location with no duplicate or stuck meters.

---

### Edge Cases

- What happens when the mixer is disabled? No mixer program is generated; meters stay inactive;
  playback is otherwise unchanged. (Covered by Story 2.)
- What happens when a channel is silent or its value underflows the scale? The meter rests at
  the silence floor; no NaN/Infinity may reach rendering (clamped in transit).
- What happens when user Csound code produces NaN/Inf audio? Values are sanitized before
  display; the meter shows a safe state; no crash. (Covered by Story 2.)
- What happens with very small audio control-block sizes (e.g. single-sample control rates)?
  Meter update cadence is derived from audio time (sample counts), not control-cycle counts, so
  update pacing stays ~30–40 Hz regardless of control-rate configuration.
- What happens with very high channel counts (100+ strips, multi-channel projects)? Meter
  telemetry stays compact and bounded, and the UI keeps animating without runaway memory or
  message growth; strip count limits match existing mixer limits.
- What happens when channels are renamed/reordered while stopped, or added/removed mid-session?
  Meter identity is resolved per playback session at compile time; structural edits require a
  restart of playback to re-bind meters (consistent with how mixer edits take effect on next
  compile).
- What happens on engine stop, crash, or destroy? A final "silent" state is delivered where
  possible; the renderer always falls back to silence and clears clip holds on lifecycle stop
  signals, not only on meter packets.
- What happens when subchannel names collide after whitespace sanitization (e.g. "My Drums"
  vs. "My_Drums")? This is a pre-existing CSD identity constraint; metering must not create
  new ambiguity beyond it, and the plan must define the behavior (first-wins with a diagnostic
  is acceptable).
- What about auditioning instruments or other secondary engine uses? Out of scope for this
  feature: meters serve the project playback session only (see Assumptions).

## Clarifications

### Session 2026-09-10

- Q: How should meter bars handle non-stereo channel configurations (mono, surround)? → A: Show `nchnls` bars per strip — meter bar count matches the project's `nchnls` setting (mono=1, stereo=2, surround=6, etc.), consistent with Pro Tools/Cubase/Logic convention and Blue's uniform per-channel signal architecture where every mixer channel carries exactly `nchnls` signals.
- Q: Where should the meter tap point be in the signal chain? → A: After the channel's own effects chain and level/pan stage, before accumulation into the output route — the standard post-fader channel-strip meter position.
- Q: Should the engine send raw windowed RMS/peak values, with ballistics applied renderer-side? → A: Yes, the engine sends raw windowed RMS and peak values per update; the renderer owns all ballistics processing (decay smoothing, peak hold, clip latch), consistent with MeterDisplayState's role as disposable derived display state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: During realtime playback, the system MUST display a live level meter in every
  mixer channel strip — each source channel, each subchannel, and the master — showing one bar
  per project output channel (determined by the project's `nchnls` setting: e.g. 1 bar for
  mono, 2 for stereo, 6 for 5.1 surround).
- **FR-002**: Meter values MUST represent the post-fader, post-effects signal the channel
  delivers to its output route (the signal actually mixed onward): tapped after the channel's
  own effects chain and level/pan stage, before accumulation into the destination bus. Values
  MUST be computed from the audio engine's own synthesis, not from host-side approximation.
- **FR-003**: Each meter MUST provide both average (RMS) level and peak level indication: a bar
  tracking the recent average level and a distinct peak-hold marker that holds the recent
  maximum for about one second before decaying.
- **FR-004**: Meters MUST use a decibel scale spanning at least -60 dBFS to 0 dBFS with a
  short over-range region, visually zoned (nominal/high/warning/overload), and MUST show a
  persistent clip indication when a channel exceeds full scale, holding for about 2 seconds.
- **FR-005**: Meter motion MUST follow standard console ballistics: effectively instantaneous
  rise and smooth decay (on the order of 15–25 dB per second), so levels read naturally at
  music tempo. Ballistics (decay smoothing, peak hold, clip latch) are applied renderer-side
  from the raw windowed RMS and peak values delivered by the engine.
- **FR-006**: Meter updates MUST arrive during playback at a sustained rate of at least 30 Hz
  per channel while the engine is producing audio, paced by audio time rather than control-cycle
  counts.
- **FR-007**: Meter data flow MUST be one-directional and transient: values originate in the
  audio engine during a playback session, transit through the main process to renderers, and
  are never persisted to `.blue` project XML, program settings, or any durable store.
- **FR-008**: Metering MUST be scoped to the realtime playback program: the system MUST NOT
  emit metering statements into disk-render CSDs or CSD shown/exported to screen; those outputs
  MUST remain byte-identical to pre-feature output (existing fixtures MUST keep passing).
- **FR-009**: The engine/runtime integration MUST negotiate metering support (capability
  handshake); when the engine does not advertise metering, playback and all pre-existing
  behavior MUST be unchanged and meters remain inactive.
- **FR-010**: Meter-to-strip binding MUST be derived from the compile-time channel identity of
  the running playback session; the system MUST NOT bind meters by strip position, tab order,
  or any identity that can change between playback sessions.
- **FR-011**: The system MUST sanitize non-finite meter values (NaN/Infinity) to a safe
  representation before they reach any UI or persistence boundary.
- **FR-012**: On playback stop, end, or engine failure, meters MUST fall to silence and clear
  clip indications promptly (about one second), driven by playback lifecycle signals in
  addition to any final data packets.
- **FR-013**: Meter animation MUST NOT trigger per-update re-renders of mixer UI components
  around it; meter display MUST keep the mixer panel interactive (faders, solo/mute, effects)
  during playback with dozens of active meters.
- **FR-014**: Metering MUST NOT compromise realtime audio safety: sampling and transport of
  meter values off the audio path MUST be non-blocking from the audio thread's perspective, and
  audible dropouts attributable to metering are a defect.
- **FR-015**: Meters MUST animate correctly in detached (popout) mixer windows, honoring the
  hosting window's document/frame context, and clean up on window close.
- **FR-016**: Meter telemetry channels MUST NOT consume the engine's bounded shared-memory
  channel mirror capacity (reserved for user control channels), and MUST NOT displace or evict
  user channels from any bounded resource.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue has no mixer audio level metering (verified against
  `~/work/nbprojects/blue/blue-ui-core/.../mixer/ChannelPanel.java` and `blue-core` mixer
  sources: channel strips contain effects chains, level, routing, and no meters). This is a
  net-new Blue Electron capability, not a parity backport; there is no Java behavior to match.
  The metering tap point and channel-identity rules, however, MUST follow the existing CSD
  generation semantics shared with Java (`assignChannelIds()` numeric source-channel IDs;
  name-keyed subchannel and master variables).
- **Compatibility Requirements**:
  - Disk-render CSD, CSD-to-screen/export, and all existing CSD fixtures MUST remain
    byte-identical (metering only enters the realtime playback program).
  - Playback audio behavior (routing, levels, effects) MUST be unchanged by the presence of
    metering statements.
  - Existing engine protocol commands, topics, and the `engine.state` event stream MUST remain
    compatible; metering is additive.
  - `.blue` project XML MUST be unaffected (no meter settings persisted in v1; see
    Assumptions).
- **Intentional Divergences**: The realtime playback CSD gains metering statements that Java
  Blue never generated. This divergence is the feature itself; it MUST be limited to the
  playback path and MUST NOT appear in exported or offline-rendered artifacts.
- **State Ownership**: Meter telemetry is transient runtime state owned by the main-process
  playback session; the renderer holds disposable derived display state (ballistics, holds) for
  the session. No durable store is introduced.

### Key Entities *(include if feature involves data)*

- **ChannelMeterReading**: Per-channel meter observation for one playback session instant:
  the channel's compile-time identity, one average (RMS) and one peak value per project output
  channel (`nchnls` pairs total), plus a session sequence/sample position.
- **MeterFrame**: A time-sampled snapshot of ChannelMeterReadings for all metered channels at
  one instant, with a monotonically increasing sequence so consumers can drop stale frames.
- **MeterBindingMap**: The playback-session mapping from compile-time channel identity to the
  mixer strip identity shown in the UI, rebuilt each time playback compiles.
- **MeterDisplayState**: Renderer-side disposable state per strip derived from raw
  MeterFrame values: applies all ballistics processing (decay smoothing from raw windowed
  RMS, peak-hold timing, clip-latch duration) to produce the visual bar level, peak marker
  position, and clip indicator state. Reset on playback stop.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a multi-track project playing, 100% of enabled mixer strips (source,
  subchannel, master) show meters that visibly track their channel's audio and fall to silence
  on stop.
- **SC-002**: Meter updates sustain ≥ 30 Hz per channel during playback on a development
  machine, measured at the renderer boundary, with no stall longer than 200 ms while the engine
  streams audio.
- **SC-003**: With 64 metered strips animating during playback, the mixer panel remains
  interactive: fader drag and solo/mute interactions respond without perceptible lag, and the
  application's UI frame rate during playback stays within 20% of its pre-feature baseline on
  the same machine.
- **SC-004**: Audio realtime safety holds: a playback soak test with metering enabled shows no
  increase in audio buffer underruns/dropouts relative to the pre-feature baseline under
  identical load, and the engine's existing performance benchmarks show no regression beyond
  noise.
- **SC-005**: Disk-render output, CSD-to-screen text, and existing CSD/XML fixtures are
  byte-identical before/after the feature for unchanged projects.
- **SC-006**: Playback against a metering-incapable engine build behaves identically to today
  (audio, lifecycle, and state events), with meters inactive.
- **SC-007**: No meter-related data appears in `.blue` files, program settings, or any file
  store after a play/stop cycle (transient-only guarantee).

## Assumptions

- Scope is the project playback session (the BlueLive realtime path); metering audition
  instruments, note-preview engines, or non-playback render sessions is out of scope for v1.
- v1 ships meters with sensible fixed styling (scale -60..0 dBFS with over-range, green/amber/
  red zoning, stereo bars, peak-hold, ~2 s clip hold) and no user preference surface; user
  preferences may arrive later without contract changes.
- Meters are display-only in v1: clicking a meter does not set gain; gain reduction/true-peak
  loudness metering (LUFS) is out of scope.
- The audio engine remains the single source of meter truth; the host does not synthesize
  levels from score data.
- Metering statements are emitted for the realtime playback program only, even though the
  "CSD to screen (realtime)" action technically uses a realtime profile; keeping screen/export
  output meter-free is an explicit scope decision (see FR-008).
- Existing user control channels and their automation/batch behavior are unaffected; metering
  uses a reserved, namespaced channel prefix and its own transport, not the user channel
  command set.
- Multi-display popout support follows the existing popout window architecture; no new window
  management is introduced by this feature.
