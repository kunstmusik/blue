# Feature Specification: Complete Stereo Mixer Panning

**Feature Branch**: `113-pan-laws-configuration`

**Created**: 2026-09-18

**Status**: Draft — ready for planning

**Input**: Implement score-wide pan laws and complete stereo mixer panning: retain Balance as the default, add selectable Stereo Pan with Position and Width and independent Dual Pan, and define law behavior for every mode. Review `.tmp-research/MIXER_PANNING.md` and Specs 111–112.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose a consistent pan law (Priority: P1)

A composer chooses the center attenuation for mono panning once per score, so every eligible mixer channel follows the same mixing convention. The choice appears beside Enable Panning in Score Settings.

**Why this priority**: A shared law makes levels predictable across channels and renders on different computers.

**Independent Test**: Pan two mono-only channels through center, intermediate positions, and both endpoints under every offered law.

**Acceptance Scenarios**:

1. **Given** a new score with panning enabled, **When** Score Settings opens, **Then** it shows a score-wide −3 dB law with off-center boost off.
2. **Given** enabled panning, **When** the composer selects 0, −3, −4.5, or −6 dB, **Then** all eligible mono panners use that per-side center level and remain symmetric left to right.
3. **Given** off-center boost off, **When** a mono source reaches either endpoint, **Then** the selected speaker receives unity gain and the opposite speaker is silent.
4. **Given** off-center boost on, **When** a mono source moves from center to an endpoint, **Then** center retains the selected law level while the endpoint receives matching make-up gain; the control explains that boosted peaks may clip.

---

### User Story 2 - Position a stereo image (Priority: P1)

A composer can keep the familiar Balance knob, or select Stereo Pan to move and narrow a stereo image, or Dual Pan to place its two source channels independently.

**Why this priority**: Balance only attenuates one existing side; it cannot move both source channels into a chosen speaker. The additional modes complete the stereo mixer workflow.

**Independent Test**: Send distinct left and right test signals through a stereo channel; exercise Balance, Stereo Pan, and Dual Pan at center, intermediate positions, and endpoints.

**Acceptance Scenarios**:

1. **Given** a stereo, mixed, or unknown-layout channel with no saved mode, **When** it opens, **Then** it remains in Balance with the same audible result as Spec 112.
2. **Given** Stereo Pan at centered position, full width, and boost off, **When** the channel plays, **Then** the original left and right signals retain their sides and levels; **When** width is reduced, **Then** the two source positions approach each other, and zero width places both at the chosen position.
3. **Given** Stereo Pan with nonzero width, **When** the position reaches a hard endpoint, **Then** effective width narrows as needed so both source channels reach that endpoint; returning toward center restores the saved width.
4. **Given** Dual Pan, **When** the composer moves one side's control, **Then** only that source channel's position changes; both can be placed on the same side or crossed, and each follows the selected score law.
5. **Given** a verified mono-only channel, **When** the mixer is shown, **Then** it uses Mono Pan rather than offering stereo-only mode controls. A change in effective source layout does not discard stored stereo settings.

---

### User Story 3 - Preserve and reverse mix decisions (Priority: P1)

A composer changes the score's pan law, hears it during playback, undoes or redoes it, and gets the same mix after saving and reopening.

**Why this priority**: Pan law changes the mix and belongs to the composition rather than a local workstation preference.

**Independent Test**: Change law, boost, stereo mode, Position, Width, and dual positions during playback; undo, redo, save, reopen, and compare playback with export.

**Acceptance Scenarios**:

1. **Given** a saved score, **When** a law, boost, mode, or position control changes, **Then** the score becomes dirty, one undo restores the previous choice and audible mix, and redo restores the new choice and mix.
2. **Given** a score saved with a nondefault law, **When** it opens on another installation, **Then** its selected law and mix return without any app preference.
3. **Given** running playback, **When** either choice changes, **Then** the next safe update applies the new mix without moving transport or restarting score events; a failed update is reported without pretending the saved selection is audible.
4. **Given** panning disabled, **When** the law changes, **Then** the choice is saved as future intent but legacy routing remains audible until panning is enabled.

---

### User Story 4 - Keep existing scores predictable (Priority: P2)

A composer opens a score made before this setting and keeps its established sound until explicitly choosing another law.

**Why this priority**: Spec 112 already established an equal-power default and a legacy panning opt-out.

**Independent Test**: Open enabled Spec 112 scores without a law or stereo mode, disabled legacy scores, and Java-authored scores; compare playback/export before and after save/reopen.

**Acceptance Scenarios**:

1. **Given** an enabled Spec 112 score without a law setting, **When** it opens, **Then** mono channel panning remains −3 dB and unboosted throughout the position range.
2. **Given** a legacy score with panning disabled, **When** it opens and is saved unchanged, **Then** its prior channel routing and audible output remain unchanged.
3. **Given** an unsupported stored law or boost value, **When** the score opens, **Then** it uses the documented −3 dB/unboosted fallback, preserves unrelated data, and cannot produce an invalid gain.
4. **Given** a channel with missing or unsupported stereo mode or mode values, **When** it opens, **Then** it uses Balance and safe centered/full-width/default-side values without changing unrelated channel data.

### Edge Cases

- At 0 dB, both speakers receive unity mono signal at center; combined power exceeds one hard-panned speaker. The UI describes this accurately.
- Off-center boost can raise peaks above source level and must not silently limit or normalize them.
- Disabled score panning or mixer bypass makes the saved law inaudible without deleting it.
- Mono project output has no left/right placement and receives no stereo-law gain change.
- Wider source or output layouts retain Spec 112's unsupported-layout diagnostics and metadata preservation.
- Existing pre/post-fader sends retain their feed and routing semantics.
- Channel position automation uses the current score law without rewriting position values or points.
- Two correlated stereo sides can sum and exceed unity when Stereo Pan or Dual Pan brings them together; the app must not silently normalize or limit them.
- On a mixed track, folding the two stereo buses to one side can raise the mono clip component by about 3 dB because Spec 112 already center-upmixed it. This is part of true stereo folding, and the UI must not imply level preservation.
- A mode switch may change sound; the control must identify the selected mode and preserve the prior mode's stored controls so returning to it is predictable.
- Balance on a mixed track acts on the already-mixed stereo pair. It does not independently pan mono clips inside that track.

## Requirements *(mandatory)*

### Feature Scope

- Offer one score-wide center-depth choice (0, −3, −4.5, or −6 dB) and independent off-center boost on/off choice; default to −3 dB, off.
- Apply the choice to eligible Mono Pan channels and to each source-side panner in Stereo Pan and Dual Pan when score panning and stereo output are enabled. Balance retains Spec 112's law-independent behavior.
- Offer Balance, Stereo Pan (Position and Width), and Dual Pan (independent Left and Right positions) on stereo, mixed, and unknown-layout channels. Balance is the default for existing and new channels.
- Keep Spec 112's fixed equal-power mono-clip center-upmix, which adapts mono media before mixing with stereo content. The new law governs the subsequent eligible mono channel panner.
- Per-channel law overrides, extra taper families, per-clip pan, Mid/Side processing, independent send panners or send-specific laws, and surround panning remain outside this feature.

### Functional Requirements

- **FR-001**: Score Settings MUST present the four named center-depth choices and separate Off-center boost control beside Enable Panning. It MUST explain the affected channels, default, and possible boosted peaks.
- **FR-002**: The score MUST own exactly one law and one off-center boost choice. New scores and scores missing either value MUST resolve to −3 dB and boost off; an enabled Spec 112 score without these values MUST retain its previous sound.
- **FR-003**: For eligible mono panners, each law MUST produce symmetric, continuous gains across the existing position range, its named per-side center gain, silence on the opposite side at an endpoint, and unity on the selected side at an endpoint when boost is off. The −3 dB unboosted curve MUST preserve Spec 112 behavior across the full range.
- **FR-004**: Off-center boost MUST leave center gain unchanged and boost the selected endpoint by the magnitude of the center depth. It MUST have no effect under the 0 dB choice. This is the REAPER-style “boost pans” convention; it MUST NOT be labeled as Logic-style “Compensated,” which also raises the center level.
- **FR-005**: Law selection MUST govern Mono Pan and the two source-side panners in Stereo Pan and Dual Pan. It MUST NOT alter Balance, mono-clip center-upmix, send feed points, mixer mute/solo decisions, position values, or automation points from Specs 111 and 112.
- **FR-006**: The same effective law MUST govern eligible live playback and disk export, including position automation. A law-only change MUST not restart events or move transport when a safe runtime update exists.
- **FR-007**: Disabled panning or mixer bypass MUST preserve saved choices without audible effect. Mono output MUST remain valid without stereo-law gain changes; wider layouts MUST retain Spec 112 diagnostics.
- **FR-008**: Law, off-center boost, stereo mode, Position, Width, and Dual Pan changes MUST be individually named project-history actions. Commit, undo, and redo MUST restore canonical values, dirty state, stable identities/references, published views, and required runtime reconciliation.
- **FR-009**: Save, load, and copy MUST preserve valid choices with the score and unrelated project data. Missing or unsupported choices MUST resolve to documented defaults and never cause invalid gain.
- **FR-010**: If a live update fails, the app MUST report failure, preserve the saved choice, distinguish it from applied audio state, and recover from canonical project state.
- **FR-011**: Verification MUST cover every law and boost choice in Mono Pan, Stereo Pan, and Dual Pan at center, intermediate positions, and endpoints; Balance invariance; unchanged clip adaptation/sends; disabled/mono-output cases; automation; live/export parity; save/load; and commit→undo→redo with runtime recovery.
- **FR-012**: Stereo, mixed, and unknown-layout channels MUST expose Balance, Stereo Pan, and Dual Pan modes with accessible labels and keyboard-operable controls. Verified mono-only channels MUST expose Mono Pan. The selected mode and controls MUST be visibly identifiable.
- **FR-013**: Balance MUST preserve Spec 112's center and side attenuation. Stereo Pan MUST provide a shared Position and Width: centered/full-width with boost off MUST pass the original stereo pair unchanged; zero width MUST place both source sides at Position; effective width MUST narrow at the extremes so both sides can reach either endpoint; the saved Width MUST return when Position permits.
- **FR-014**: Dual Pan MUST provide independent Left and Right source positions, defaulting to hard left and hard right. Each source side MUST use the selected law and boost. Moving one position MUST NOT alter the other's stored position. Crossing or coincident positions MUST be allowed without silent gain normalization.
- **FR-015**: Balance and Stereo Pan MUST share the existing channel position value; Stereo Pan adds Width, and Dual Pan adds two independent positions. Switching modes MUST preserve all stored values, without rewriting automation or unrelated mode values. A mode switch MAY change the audible mix and MUST be shown as a distinct edit.
- **FR-016**: Stereo-mode values MUST be durable channel content and participate in the existing parameter and automation workflow. Live changes to Position, Width, and dual positions MUST follow automation without restarting events when a safe runtime update exists; mode changes MUST reconcile at the next safe point with clear feedback if a graph update is required.
- **FR-017**: New and existing channels missing stereo-mode data MUST use Balance, full Width, hard-left Left position, and hard-right Right position. Missing or unsupported saved values MUST resolve safely and preserve unrelated channel data.
- **FR-018**: The UI MUST explain that Stereo Pan and Dual Pan can sum two source signals into one speaker and raise peaks, including the mono component of a mixed track. It MUST not silently limit, normalize, or alter fader values to hide this behavior.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue has no channel pan or pan-law setting. Spec 112 introduced enabled score panning with equal-power mono pan and stereo balance; absent `panningEnabled` preserves Java/legacy routing. The new choice is a TypeScript-only extension. [Apple's Logic Pro project settings](https://support.apple.com/guide/logicpro/general-project-settings-lgcp4f230784/mac) and the [REAPER user guide](https://www.reaper.fm/userguide.php) show that project-level law is familiar; REAPER also has per-track overrides, which Blue does not need for this first configurable release.
- **Compatibility Requirements**: Missing settings resolve to Spec 112's −3 dB unboosted law and Balance mode. Scores without enabled panning retain legacy routing. Existing channel positions and automation retain their meaning in Balance; clip adaptation, sends, mute/solo, and unknown project data remain intact.
- **Intentional Divergences**: Composers may choose center gains other than Spec 112's fixed default and select true stereo modes absent from Java Blue. Off-center boost and coincident stereo positions may raise peaks and clip. Java Blue need only continue loading supported project data; it need not interpret or retain these TypeScript-only settings.
- **State Ownership**: The active score in canonical `BlueData` owns law and boost choices in `.blue` project data. Mixer channels own mode, shared position, width, independent side positions, and automation. Missing/unsupported values use the stated defaults without a separate app preference or raw-value shadow state. UI snapshots, applied runtime state, and renders are derived/disposable. Failed runtime updates do not overwrite canonical data.
- **Undo/Redo Impact**: Each changed score or channel control is a semantic history entry. Undo/redo restores prior values and effective audio, project identities, dirty state, and runtime reconciliation. Transient drag previews create no history entry; a completed drag commits one edit, and cancellation restores the canonical value. Opening or saving without an edit creates no history entry.

### Key Entities *(include if feature involves data)*

- **Score pan-law configuration**: One center-depth and one off-center boost choice shared by eligible mono and true stereo source-side panners.
- **Mixer channel panner**: An effective Mono Pan or one of three stereo modes: Balance, Stereo Pan with shared Position/Width, or Dual Pan with independent source-side positions.
- **Applied playback state**: Disposable indication of which canonical configuration running audio has accepted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four choices produce their stated per-side center levels and endpoint gains within 0.1 dB for mono and each true stereo source-side panner; left/right mirror cases agree within 0.1 dB.
- **SC-002**: At least three intermediate positions per law and off-center boost state move continuously without unintended jumps; the −3 dB unboosted curve matches pre-feature Spec 112 output within 0.1 dB.
- **SC-003**: 100% of tested default stereo/mixed Balance, clip adaptation, send, disabled-panning, and mono-output cases retain pre-feature behavior; wider layouts still give a clear diagnostic.
- **SC-004**: 100% of law, boost, mode, Position, Width, and Dual Pan edits in the acceptance matrix restore both old and new mix through one undo and redo, then survive save/reopen with identical settings and rendered results.
- **SC-005**: 100% of tested playback and export cases use the same law; accepted playback changes do not restart score events or move transport.
- **SC-006**: In a moderated first-use check, at least 4 of 5 composers can find the score law, distinguish Balance from Stereo Pan, and place both sides of a stereo source on one chosen side within 3 minutes without external documentation.
- **SC-007**: For 100% of deterministic left-only/right-only stereo fixtures with boost off, Stereo Pan at center/full width passes each source to its original side, zero width places both at the shared Position, and either hard endpoint places both source sides at that endpoint. Dual Pan moves either source side without changing the other, including crossed positions.

## Assumptions

- Project/score scope keeps a mix reproducible for collaborators and renders. Machine-wide settings would make sound installation-dependent; per-channel overrides add complexity without a demonstrated need.
- The first law family preserves Spec 112's exact −3 dB equal-power curve. Planning will define and verify continuous curves for other depths without changing this specification's center/endpoint contract.
- Off-center boost follows REAPER’s “boost pans” description: center unchanged, endpoints raised. Logic’s “Compensated” choice instead raises center to unity along with the endpoints, so that label is not used here. Boost defaults off to preserve Spec 112 output.
- Score Settings exists from Spec 111 and hosts Enable Panning from Spec 112.
- Balance remains the safe default for stereo/mixed material. True stereo modes operate on each source side after existing effects/sends; moving both sides together can change peak level and stereo correlation.
- Spec 111's physical UI-to-audio latency measurement and native Windows validation remain open in its own tasks/quickstart. This feature does not claim they passed; planning should reuse that acceptance setup where applicable and record this feature's results.
