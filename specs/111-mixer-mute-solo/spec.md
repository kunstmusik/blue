# Feature Specification: Mixer Audio Mute and Solo

**Feature Branch**: `codex/mixer-mute-solo`

**Created**: 2026-09-15

**Status**: Implementation complete; hardware latency and native Windows acceptance pending

**Input**: Add mixer-wide audio mute/solo for instrument channels, track channels, and subchannels; master has Mute only. Default new projects to audio controls on track headers; preserve event controls for legacy projects through Score Settings. Event controls and mixer audio controls remain independent. Force event controls when the mixer is disabled. Research send behavior and support safe event pruning in disk CSD generation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Silence and audition mixer channels (Priority: P1)

A composer mutes any mixer strip or solos an instrument, track, or subchannel to audition its contribution through the existing mix routing, including effects and sends.

**Why this priority**: Audio auditioning is the primary feature and must work consistently across the whole mixer.

**Independent Test**: Mix two distinguishable sources through shared and separate subchannels, including pre- and post-fader sends, and exercise every channel type.

**Acceptance Scenarios**:

1. **Given** an instrument or track channel with direct output and pre/post-fader sends, **When** it is explicitly muted, **Then** all its outgoing contributions are silent and its saved fader/effect settings are unchanged.
2. **Given** two sources sharing a subchannel, **When** one source is soloed, **Then** that source and its effect routes remain audible, while new contributions from the other source are excluded.
3. **Given** sources feeding a subchannel by outputs and sends, **When** that subchannel alone is soloed, **Then** its feeds and downstream output remain audible, but feeder paths bypassing the soloed subchannel are silent.
4. **Given** multiple explicit solos, **When** another solo is added or removed, **Then** the audible paths are the union of the remaining selections; explicitly muted channels remain silent.
5. **Given** A is soloed and B is excluded, **When** master is muted, **Then** mixer output is silent; **When** master is unmuted, **Then** A resumes and B remains excluded. Master offers no Solo control, and a legacy stored master-solo flag has no effect.
6. **Given** playback is running, **When** audio M/S changes, **Then** playback continues at its current position, without restarting events, with the audible change taking effect within 100 ms under the supported reference setup.

### User Story 2 - Choose track header behavior without losing mixer controls (Priority: P1)

A composer uses audio controls for new projects and retains event filtering for older compositions or deliberate event-generation workflows. They choose that track-header behavior in a Score Settings modal opened from the gear button beside the Score panel's Ruler control, keeping project metadata separate from score behavior.

**Why this priority**: Existing compositions depend on event omission, and event filtering cannot be replaced by audio silence in all projects.

**Independent Test**: Open a legacy project and create a new project; exercise track headers and their associated mixer strips in both modes and with the mixer disabled.

**Acceptance Scenarios**:

1. **Given** a new project with an enabled mixer, **When** a track header M/S button is used, **Then** it edits and displays the same audio state as the associated mixer strip.
2. **Given** a project without the new behavior property, **When** it opens, **Then** track headers retain legacy event M/S semantics.
3. **Given** event mode, **When** a track is event-muted and its mixer channel is soloed, **Then** omitted events remain omitted; changing the channel does not clear event state.
4. **Given** audio mode with stored event flags, **When** events are generated, **Then** those inactive track flags do not affect event inclusion or trigger global event solo filtering.
5. **Given** either saved mode, **When** the mixer is disabled, **Then** headers operate on event state and clearly identify that behavior; **When** re-enabled, **Then** the saved mode and preserved audio state resume.
6. **Given** differing saved event and audio states, **When** the user changes header mode in Score Settings, **Then** the application explains that it switches which independent state the headers control and preserves both states without copying or clearing either.

### User Story 3 - Render an equivalent mix with less unnecessary event work (Priority: P2)

A composer exports a disk CSD that respects the same mute/solo routing and avoids generating events that can safely be omitted.

**Why this priority**: Muted audio-only tracks should not impose unnecessary render work, but export correctness takes precedence.

**Independent Test**: Compare optimized and unoptimized disk renders of deterministic audio-only, mixed-content, shared-send, soloed-return, and muted-master fixtures.

**Acceptance Scenarios**:

1. **Given** an audio-only track whose events cannot contribute to any audible route or other observable result, **When** disk CSD is generated, **Then** its playback events are omitted.
2. **Given** a track feeding a soloed subchannel, **When** its dry route is excluded, **Then** its events remain present because its send is still needed.
3. **Given** mixed content, unknown side effects, or routing whose equivalence cannot be established, **When** exporting, **Then** events remain and audio mute/solo enforces the result.
4. **Given** any export, **When** it completes or fails, **Then** project state, dirty status, and history remain unchanged.

### User Story 4 - Preserve edits and recover them (Priority: P2)

A composer saves, reloads, undoes, and redoes M/S edits and behavior changes without losing channel associations or the audible mix.

**Why this priority**: Mixing controls are durable project edits.

**Independent Test**: Commit, undo, redo, save, and reload each affected action while stopped and during playback.

**Acceptance Scenarios**:

1. **Given** a channel/header M/S or mode edit, **When** undone and redone, **Then** the explicit flags, mode, stable associations, dirty status, and required playback behavior are restored.
2. **Given** saved event and audio flags, **When** reloaded, **Then** both sets survive independently and the headers display the effective mode.
3. **Given** a runtime update failure, **When** it occurs, **Then** the application reports the failure and accurately distinguishes saved intent from unapplied playback state.

### Edge Cases

- A channel is both muted and soloed: mute wins, but its explicit solo remains selected and participates in solo filtering.
- A soloed channel is disconnected: it does not cause unrelated channels to become audible.
- Shared effect returns may contain existing tails from earlier input; solo does not promise to separate already-mixed history.
- Sources already summed into a shared bus cannot be separated on that bus's outgoing routes. Solo excludes unrelated incoming routes where separable; it does not duplicate effects or reconstruct individual contributions after summing.
- Muting a return cuts its own output and sends, including its local tail; downstream returns already excited by it may decay normally.
- Master offers Mute only. Legacy master-solo data survives save/load but never participates in solo discovery, audio routing, or event pruning.
- Renaming/reordering a track must not break its mixer association; a missing association must be repaired or reported before an audio header edit is accepted.
- Ordinary score-layer event solo continues its existing scope. Inactive track event flags in audio mode cannot silence unrelated score layers.
- Mixer bypass preserves channel flags but makes strip audio controls inactive; it does not translate instrument, subchannel, or master flags into event filters.
- User-authored audio that bypasses mixer routing is outside channel M/S control and must not be described as muted by a mixer strip.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Provide explicit Mute and Solo controls on instrument, track, and subchannel strips, sharing one additive solo scope. Master MUST provide Mute only.
- **FR-002**: Explicit mute MUST silence every outgoing mixer route of that channel, including pre/post-fader sends and final output. Pre/post placement continues to determine fader/effect processing; it does not exempt a send from explicit mute.
- **FR-003**: Audio mute MUST preserve event execution and effect state. It suppresses outgoing audio at each send tap and the channel output after local processing, including locally generated effect tails. Downstream effects may decay from audio received earlier.
- **FR-004**: Solo on a non-master channel MUST preserve the paths feeding that explicitly soloed channel and the paths carrying its output onward, including sends. Feeder bypass paths and unrelated feeds into shared downstream channels MUST be suppressed. Multiple non-master solos select the union of these paths. Implicitly retaining master or a shared bus MUST NOT admit all its other inputs.
- **FR-005**: Explicit mute MUST override all explicit/implicit solo inclusion. Master mute MUST silence mixer output regardless of solos. Unmuting master MUST restore only the mix permitted by existing upstream controls. Stored master-solo values MUST be preserved but ignored; new master-solo edits MUST be rejected. Control of user-authored audio bypassing the mixer remains outside scope.
- **FR-006**: Display explicit mute/solo separately from exclusion caused by solo elsewhere. Post-output meters MUST reflect audio after the output gate; a silent dry-output meter does not imply that an allowed send is silent. Controls MUST be keyboard operable and have accessible names and state.
- **FR-007**: Score Settings MUST offer Audio and Event behavior for track headers. The setting MUST be opened by a gear button at the far right of the Score panel toolbar, immediately beside the Ruler button, and presented in a Score Settings modal. New projects default to Audio; projects lacking the property load as Event. Score MUST own the preference and persist it only as the `trackLayerMuteSoloMode` attribute on `<score>`, not as a child element or ProjectProperties field. Project Information MUST remain focused on project metadata and MUST NOT present this control.
- **FR-008**: With an enabled mixer, Audio headers MUST edit associated channel state; Event headers MUST edit independent track event state. Mixer strips MUST always edit audio state. Mode changes MUST preserve both sets and explain the switch in authority.
- **FR-009**: With a disabled mixer, track headers MUST use event behavior regardless of the saved preference, indicate the override, and preserve the preference and channel flags for later use. Mixer strip audio controls MUST indicate that they are inactive.
- **FR-010**: Only effective event controls MUST participate in event inclusion and existing score-wide event solo behavior. Audio solo MUST NOT resurrect event-filtered content.
- **FR-011**: Audio controls MUST affect running playback without transport restart or event recompilation. Mode changes, mixer enable changes, and event controls may use the existing restart-required workflow, with accurate feedback.
- **FR-012**: Disk CSD generation MUST apply the same effective modes and audio routing decisions. It MUST omit safe, inaudible audio-only track events and retain events whenever routing, effect behavior, shared state, or unknown side effects prevent establishing equivalence. It MUST retain the audio gates and MUST NOT mutate the project to obtain pruning.
- **FR-013**: Each M/S, mode, and affected mixer-enable edit MUST be one semantically named undoable project action. Undo/redo MUST restore canonical values, identities, associations, dirty state, published views, and required runtime reconciliation.
- **FR-014**: Save/load MUST preserve both state sets, the behavior preference, existing channel data, and unrelated unknown project data. A missing or unsupported score mode loads as Event; the next save writes that resolved value.
- **FR-015**: Persisted channel mute and non-master solo flags MUST become effective when the mixer is enabled, including flags in legacy files. A legacy project containing these active flags MUST receive a visible compatibility notice; flags MUST NOT be silently cleared. Master solo is preserved but inactive and does not trigger that notice by itself. Legacy track event behavior remains preserved independently.
- **FR-016**: Runtime failure MUST be reported without falsely showing saved state as successfully applied. Recovery MUST reconcile playback to the canonical project rather than silently overwrite the edit.

### Score settings access

- The Score Settings modal MUST provide the Audio/Event track-header mute/solo behavior control and its saved-versus-effective explanation, including the mixer-disabled override and any applicable legacy compatibility notice.
- The modal MUST have a stable section-based layout that can accommodate additional score settings later without returning this behavior to Project Information.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue AudioLayer contains audio clips and filters muted/non-solo layers during event generation. Java and current TypeScript mixer channels persist mute/solo fields but do not apply them in mixer audio generation. Current TypeScript Tracks can also contain sound objects. See [precedent research](precedents.md) for source references.
- **Compatibility Requirements**: Absent mode properties retain event semantics. Both sets of flags and unknown project data survive round trips. Event controls retain their established score-wide scope. Existing effect order, routing, fader values, and render duration remain unchanged.
- **Intentional Divergences**: New-project track headers default to audio behavior; mixer channel flags become audible; audio controls work during playback. Legacy nonzero channel flags may change the mix and require the FR-015 notice. Java applications are not expected to reproduce these new audio semantics. Java `Score.loadFromXML` ignores the new attribute, preserving file loading, but Java save does not retain it; unknown score children would instead be treated as layer groups. This unreleased feature has no migration or fallback from the prerelease ProjectProperties location or score child.
- **State Ownership**: The active BlueData project owns track event flags, channel audio flags, mixer enable state, and the Score-owned header preference, persisted as the `score` attribute `trackLayerMuteSoloMode` in .blue XML. Derived solo routing, UI indicators, and playback-applied status are disposable. CSD/audio exports are derived artifacts, not project stores. No new app-wide preference is introduced.
- **Undo/Redo Impact**: Every affected durable edit uses canonical ProjectHistory with a semantic label. Commit→undo→redo verification covers state, stable references, dirty status, and runtime recovery. Export and derived solo calculations create no history entries.

### Key Entities

- **Track header behavior**: Persisted Audio/Event preference plus effective Event override when the mixer is disabled.
- **Track event state**: Independent flags controlling whether the track generates events.
- **Mixer channel audio state**: Explicit mute/solo flags belonging to an instrument, track, or subchannel; master has active mute state only, with any legacy solo value retained as inactive compatibility data.
- **Audible route**: An existing output/send path included by solo selection and not blocked by explicit mute.
- **Track-channel association**: Stable relationship making an audio header and strip two views of the same controls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Instrument, track, and subchannels pass the direct-output, applicable pre/post-send, multiple-solo, and mute-wins acceptance cases without unrelated new audio leaking into the selected mix. Master passes mute/unmute restoration and inactive legacy-solo cases and exposes no Solo control.
- **SC-002**: Audio M/S responds within 100 ms in the documented supported playback setup, without changing transport position or restarting events.
- **SC-003**: All legacy/new-project, mode-switch, and mixer-disabled acceptance cases preserve the two independent state sets across save/reload and undo/redo.
- **SC-004**: Optimized deterministic disk renders differ from their unoptimized equivalents by no more than −120 dBFS peak residual, retain identical duration, and omit every eligible inaudible audio-only track's playback events. Unknown or ineligible cases remain unpruned.
- **SC-005**: Export success/failure creates zero project edits and zero history entries. Every durable control action restores correctly through one undo and one redo, including playback reconciliation.

## Assumptions

- Research supports several valid mute/send conventions; Blue adopts all-outgoing-route mute and routing-aware solo as the fixed initial behavior. Per-send mute-follow preferences, solo-safe switches, exclusive solo, cue/PFL/AFL monitoring, and M/S automation are outside this feature.
- Mode switches preserve independent state rather than automatically converting it. This makes event and audio controls coexist without destructive synchronization.
- Master is mute-only: master solo provides no additional useful behavior for the current mixer routing. REAPER's master solo addresses separate hardware outputs; Logic's Master D is Dim, and the cited Pro Tools Master Fader has no M/S. See [precedent research](precedents.md) for versioned sources and limits.
- Monitor dimming, VCA master controls, new hardware-output routing, and isolation of audio that bypasses Blue's mixer are outside this feature.
- Live audio response is included as a product requirement. The plan must determine the runtime control work needed; the earlier investigation's restart-only shortcut is not the target behavior.
- Pruning is deliberately conservative. Even audio-only content is insufficient proof when effects or shared state can affect other audible routes.
- Existing routing validation remains authoritative; this feature does not add new feedback routing capabilities.
