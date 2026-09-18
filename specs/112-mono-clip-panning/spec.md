# Feature Specification: Mono Clip Panning Compatibility

**Feature Branch**: `112-mono-clip-panning`

**Created**: 2026-09-17

**Status**: Closed — implementation converged; manual acceptance and cross-platform CI validation passed (2026-09-18)

**Input**: User description: "Review .tmp-research/MIXER_PANNING.md and independently review the codebase. Support mixed mono and stereo audio clips on a track, automatically route mono clips to both stereo channels, and add a score-level panning setting to preserve backwards compatibility with legacy projects while supporting industry-aligned Blue/Csound panning."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mix Mono and Stereo Clips on One Track (Priority: P1)

A composer can place mono and stereo audio clips on the same track and hear both types correctly in a stereo score. A mono clip is centered across the stereo field by default, while a stereo clip keeps its left/right image.

**Why this priority**: Mixed clip channel layouts are already valid in Blue. A mono clip becoming left-only is an audible correctness problem that makes otherwise ordinary tracks unusable without manual workarounds.

**Independent Test**: Render a track containing a mono clip, a stereo clip, and overlapping instances of both in a two-channel score with panning enabled. Verify that the mono material is present in both output channels at center, the stereo material retains separate channels, and no clip is silently omitted.

**Acceptance Scenarios**:

1. **Given** a two-channel score with panning enabled and a mono clip on a track, **When** the clip plays at the default center position, **Then** the source is heard in both output channels with equal-power center compensation rather than only in the left channel.
2. **Given** a track containing both mono and stereo clips, **When** the track is rendered, **Then** the mono clips are centered stereo content and the stereo clips retain their independent left/right signals.
3. **Given** a track with only mono clips, **When** the channel position moves from center to either extreme, **Then** the mono signal moves predictably to the selected side and does not change the other side unexpectedly.

---

### User Story 2 - Open Legacy Scores Without an Unrequested Audio Change (Priority: P1)

A composer can open an older score and get its previous audio behavior, then explicitly enable the new panning behavior when they are ready to adopt it.

**Why this priority**: Existing Blue projects may depend on the current channel-index routing. Panning and mono center-upmixing must be adoptable without changing the meaning of a legacy score merely because it was opened or saved.

**Independent Test**: Open a representative pre-feature score with no panning setting, render it before and after a save/reopen cycle, confirm that panning is disabled and its prior routing is preserved, then enable panning in Score Settings and confirm that the new behavior is applied only after the explicit change.

**Acceptance Scenarios**:

1. **Given** a score created before this feature and containing no panning setting, **When** it is opened, **Then** panning is disabled and the score retains legacy audio routing.
2. **Given** a newly created score, **When** its score settings are opened, **Then** panning is enabled by default and the setting is visible as an editable score option.
3. **Given** a legacy score with panning disabled, **When** the composer enables panning and confirms the change, **Then** the score becomes dirty, the setting is stored with the score, and subsequent rendering uses the new mono/stereo behavior.

---

### User Story 3 - Use Predictable Pan and Balance Behavior (Priority: P1)

A composer can understand and automate the channel position control: mono material uses an equal-power pan, while stereo or mixed material uses a balance-style control that preserves the stereo image rather than collapsing it into a mono pan.

**Why this priority**: “Pan” and “balance” are not interchangeable for stereo material. A clear default strategy gives Blue behavior that matches common DAW conventions while leaving room for later true-stereo and surround strategies.

**Independent Test**: Compare an all-mono track, an all-stereo track, and a mixed track at center and at both extremes. Change the controls through the normal editing and automation workflows, then verify that the resulting channel levels and stereo image match the defined behavior.

**Acceptance Scenarios**:

1. **Given** an all-mono track with panning enabled, **When** the channel position is changed, **Then** the control behaves as Mono Pan with equal-power center compensation and unity at the selected hard endpoint.
2. **Given** a stereo or mixed track with panning enabled, **When** the channel position is changed, **Then** the control behaves as Stereo Balance: the centered signal keeps both sides at their original relative level and moving toward one side attenuates the opposite side without independently relocating the two source channels.
3. **Given** an enabled pan or balance control, **When** its value is automated or edited during playback, **Then** the audible position follows the automation and the value remains within the documented left-to-right range.

---

### User Story 4 - Handle Unsupported Channel Layouts Clearly (Priority: P2)

A composer receives a clear, recoverable result when a project or audio file uses a channel layout outside the first release's stereo scope, rather than hearing missing or silently discarded channels.

**Why this priority**: Blue and Csound can represent more than two channels, but a stereo pan control does not define speaker placement for arbitrary multichannel material. Explicit boundaries prevent accidental data loss while keeping the first release focused.

**Independent Test**: Exercise mono, stereo, and greater-than-stereo audio files in mono, stereo, and multichannel project output configurations. Confirm that supported cases render as specified and unsupported cases are reported deterministically without corrupting project data.

**Acceptance Scenarios**:

1. **Given** a project with one output channel, **When** panning is enabled, **Then** the output remains a valid mono signal and no stereo-only control changes its audible result.
2. **Given** a project with more than two output channels or a clip with more than two source channels, **When** the feature encounters it, **Then** the user receives a clear unsupported-layout diagnostic and the project metadata remains intact.
3. **Given** a clip whose cached channel metadata is missing or stale, **When** it is rendered, **Then** the actual audio file channel layout determines the supported routing decision and missing metadata does not cause a mono clip to be treated as stereo or discarded.

### Edge Cases

- A score with no score element, a score element without the panning setting, or an invalid panning value loads with panning disabled and keeps legacy behavior.
- Toggling panning while the engine is running applies the new setting at the next safe runtime reconciliation point and does not leave a stale panner active.
- A mixed track remains stereo for channel-level control purposes even when its current clips change; this feature does not introduce per-clip pan automation.
- A mono clip routed to a subchannel or master channel follows the same center-upmix rule when that destination is a two-channel route.
- A channel position outside the supported range is rejected or clamped consistently; it must never generate an invalid project value.
- Panning does not silently change existing send feed semantics; send routing remains governed by the score's existing send behavior.
- Stereo center compensation must not create an unintended level or power jump when a mono clip is duplicated into two output channels.
- Audio files with more than two channels are not silently truncated, treated as stereo, or treated as mono by the new feature.

## Requirements *(mandatory)*

### Feature Scope

- The first release covers stereo panning behavior for two-channel project output and safe no-op behavior for mono output.
- The first release covers mono and stereo audio clips coexisting on one track, a score-level compatibility setting, channel-level Pan/Balance controls, persistence, automation, and runtime reconciliation.
- The first release does not implement true stereo Position/Width, independent Dual Pan, Mid/Side processing, surround speaker-layout panning, or VBAP. These remain explicitly named follow-up strategies rather than implicit behavior.
- Panning remains a channel/track-level operation. This feature does not add an independent pan control to each audio clip.

### Functional Requirements

- **FR-001**: The score MUST expose an `Enable Panning` setting owned by the score and persist it as a score-level boolean property named `panningEnabled`.
- **FR-002**: A newly created score MUST default `panningEnabled` to true. A score loaded without the property, including a Java-authored or pre-feature score, MUST default it to false.
- **FR-003**: When `panningEnabled` is false, rendered audio MUST retain the score's prior channel-index routing and MUST NOT apply channel Pan/Balance processing or mono center-upmixing introduced by this feature.
- **FR-004**: When `panningEnabled` is true and project output is stereo, every mono audio clip MUST be center-upmixed to both output channels with equal-power compensation before it is mixed with other clips on the track.
- **FR-005**: When `panningEnabled` is true, every stereo audio clip MUST retain its distinct left and right source channels, and a track containing both mono and stereo clips MUST resolve to stereo channel behavior after mono clips are center-upmixed.
- **FR-006**: Where the source layout is known to be mono, the channel position control MUST use Mono Pan semantics with a default center value, equal-power center attenuation equivalent to Csound's standard two-channel pan behavior, and unity gain at hard left and hard right.
- **FR-007**: Where the source layout is stereo, mixed, or unknown, the channel position control MUST use Stereo Balance semantics: the centered position MUST preserve both source channels at their relative level, and movement toward one side MUST attenuate the opposite side without independently placing the two source channels.
- **FR-008**: The channel position value MUST have one documented left-to-right range, a center default, and consistent validation at every editing, loading, automation, and rendering boundary.
- **FR-009**: The mixer UI MUST label or otherwise distinguish Mono Pan from Stereo Balance, MUST make the control unavailable or clearly inactive when score panning is disabled, and MUST expose the score-level setting in Score Settings.
- **FR-010**: Channel position values MUST be durable project content, MUST survive save/load and deep-copy operations, and MUST participate in the existing mixer parameter and automation workflows when panning is enabled.
- **FR-011**: Changing the score panning setting or a channel position MUST use the canonical project history path with a semantic history label, and commit, undo, redo, dirty-state publication, and running-engine reconciliation MUST restore the corresponding canonical and audible state.
- **FR-012**: Existing send routing MUST remain unchanged when panning is enabled unless a future, separately specified send-panner option is selected; the feature MUST NOT silently change a send from its current feed point.
- **FR-013**: For mono project output, enabling panning MUST leave the generated result valid and MUST not invent a second output channel. For project output wider than stereo or source files wider than stereo, the feature MUST produce a clear unsupported-layout diagnostic and MUST preserve the source/project channel metadata.
- **FR-014**: The actual channel count of an audio file MUST be authoritative for rendering decisions. Cached or absent clip metadata MUST not silently cause the wrong mono/stereo routing choice.
- **FR-015**: Loading a supported Java Blue project without `panningEnabled` MUST remain successful and must preserve its prior audio behavior. The TypeScript-only panning property MUST be additive and MUST NOT corrupt unrelated project data.
- **FR-016**: Deterministic verification MUST cover mono center/endpoint behavior, stereo preservation, mixed-track behavior, legacy disabled behavior, score-setting persistence, automation, undo/redo, save/load, runtime reconciliation, missing metadata, mono output, and unsupported multichannel inputs.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue's score and mixer data do not define a channel panner. Existing audio playback distinguishes mono and stereo files but the current stereo path does not center a mono file across both outputs. The industry-aligned baseline for this feature is equal-power mono panning and balance-style handling for stereo material, with Csound's two-channel pan behavior as the rendering reference.
- **Compatibility Requirements**: A score without `panningEnabled` MUST load with panning disabled and retain its legacy channel routing through save/reopen. Existing Java-compatible score and mixer data, unknown project data, send routing, and non-panning renders MUST remain readable and intact. New scores may persist the explicit enabled default.
- **Intentional Divergences**: New scores opt into panning by default, while legacy scores remain opted out. When enabled, mono clips are center-upmixed and eligible channel controls become audible; this is an intentional TypeScript/Blue Electron extension behind an explicit score setting. True-stereo, M/S, and multichannel speaker-layout strategies are deferred rather than inferred.
- **State Ownership**: The canonical owner of `panningEnabled` is the active score in `BlueData`, persisted in the score's `.blue` XML. Canonical channel Pan/Balance values are owned by the mixer channel model and persisted with mixer project data. Renderer snapshots and generated Csound text are derived representations. The Electron main process owns canonical publication and runtime reconciliation; renderer settings and controls submit typed project-history edits.
- **Undo/Redo Impact**: Toggling `panningEnabled` and editing a channel position are durable project mutations. Each MUST have a semantic history entry, restore the prior canonical value and audio behavior on undo, reapply it on redo, preserve stable project identities, update dirty state correctly, and reconcile the running engine when applicable.

### Key Entities *(include if feature involves data)*

- **Score Panning Configuration**: A score-owned compatibility setting that determines whether the new panning and mono center-upmix behavior is active; it has an explicit enabled/disabled state and a legacy default for absent data.
- **Audio Clip Channel Layout**: The effective mono or stereo layout of an audio file, determined from the actual file at render time when cached metadata is unavailable or stale.
- **Mixer Channel Position**: A durable, automatable left-to-right value whose effective presentation is Mono Pan for mono material or Stereo Balance for stereo, mixed, or unknown material.
- **Track Effective Layout**: The layout used for channel-level control; all-mono tracks are mono, while tracks containing any stereo material are stereo for this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of stereo render cases containing mono clips place the mono signal in both channels at center, with no left-only regression and no unintended center power increase.
- **SC-002**: 100% of mixed mono/stereo track cases preserve the stereo clip's separate channels while keeping mono clips audible and centered when the channel control is centered.
- **SC-003**: 100% of tested pre-feature scores with no `panningEnabled` property produce the same legacy routing before and after save/reopen, and none enable panning without an explicit user change.
- **SC-004**: 100% of new-score creation and score-settings tests show panning enabled by default and persist the explicit setting through save/load.
- **SC-005**: 100% of tested Mono Pan and Stereo Balance center/endpoint cases match the documented level and placement semantics, including automated changes during playback.
- **SC-006**: 100% of tested panning-setting and channel-position edits pass commit, undo, redo, dirty-state, save/load, and running-engine reconciliation checks without losing stable identities or references.
- **SC-007**: 100% of unsupported mono-output, multichannel-output, greater-than-stereo-input, and missing/stale-metadata cases return a valid, deterministic result or clear diagnostic without silently discarding channel metadata.
- **SC-008**: The affected data and application test suites complete with zero newly introduced failures, and focused render fixtures cover every acceptance scenario in this specification.
- **SC-009**: A composer can identify whether the active control is Pan or Balance and enable or disable score panning from Score Settings without consulting external documentation.

## Assumptions

- Stereo output (`nchnls=2`) is the only output layout receiving new audible panning behavior in the first release; one-channel output remains valid but has no audible pan dimension.
- Newly created scores should use the industry-aligned behavior by default, while absence of the new property is treated as an explicit legacy opt-out for backwards compatibility.
- Equal-power mono panning with approximately -3 dB per side at center is the default law; configurable pan-law choices are a later feature.
- A mixed track uses stereo balance at the channel level because a single channel strip cannot independently pan only the mono clips after they have been mixed with stereo material.
- The actual audio file channel count is authoritative; `AudioClip` metadata is a cache and may be unavailable during project editing.
- Existing sends retain their current feed semantics. Meter placement and any post-pan meter redesign are documented as part of implementation planning if the current meter tap does not match the intended user-facing channel output.
- True stereo Position/Width, Dual Pan, M/S utility processing, surround panning, and VBAP require explicit future specifications with speaker-layout and input/output format contracts.
- Java Blue is required to remain a readable behavioral and project-data reference for legacy scores, but it is not required to load or preserve the new TypeScript-only panning property.
