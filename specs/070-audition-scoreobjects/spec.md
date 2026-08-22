# Feature Specification: Audition Selected ScoreObjects

**Feature Branch**: `[070-audition-scoreobjects]`

**Created**: 2026-08-10

**Status**: Implemented (automated validation passed; packaged desktop validation pending)

**Input**: User description: "Audition ScoreObjects from the Project menu, matching Java Blue behavior and supporting Track LayerGroups in TS Blue."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Audition the current score selection (Priority: P1)

As a composer, I want to audition the ScoreObjects currently selected in the score so that I can hear an edit without playing the rest of the project.

**Why this priority**: Hearing the active selection is the core value of the Project-menu action.

**Independent Test**: Select one or more objects in an otherwise audible project, invoke **Project > Audition ScoreObjects**, and verify that only the selection plays for its selected time span.

**Acceptance Scenarios**:

1. **Given** an open project with one or more current score-object selections, **when** the user chooses **Project > Audition ScoreObjects**, **then** the application starts realtime playback containing the selected objects and excludes all unselected score content.
2. **Given** no score objects are selected, **when** the user opens the Project menu, **then** **Audition ScoreObjects** is unavailable.
3. **Given** normal realtime playback is already active, **when** the user auditions a selection, **then** the prior playback is stopped and the requested audition becomes the active realtime playback.
4. **Given** the audition action is available, **when** the user presses Cmd+Shift+A on macOS or Ctrl+Shift+A on Windows or Linux, **then** the application performs the same audition action as the Project-menu item.
5. **Given** an audition is active, **when** the user presses the score timeline to select, move, resize, or marquee objects, **then** the audition stops before the timeline gesture proceeds while ordinary project playback is not stopped by that click.

---

### User Story 2 - Audition objects in Track LayerGroups (Priority: P1)

As a composer using Track LayerGroups, I want selected track items to audition with their assigned instruments and routing so that the Track workflow is as reliable as the established score-layer workflow.

**Why this priority**: Track LayerGroups are the canonical TypeScript Blue score model for new projects, so supporting only older score-layer structures would make the action incomplete.

**Independent Test**: Place selected and unselected sound objects and audio clips across muted, soloed, and ordinary tracks, audition a mixed selection, and verify that every selected item is heard while no unselected item is rendered.

**Acceptance Scenarios**:

1. **Given** selected objects in one or more Track LayerGroups, **when** the user auditions them, **then** their containing tracks remain capable of producing sound even if their normal mute or solo state would otherwise suppress them.
2. **Given** a selection contains both Track sound objects and audio clips, **when** the user auditions it, **then** both selected item kinds are included and unselected items in those tracks are excluded.
3. **Given** an otherwise empty Track LayerGroup after filtering, **when** an audition starts, **then** it contributes no score output or unrelated track content.

---

### User Story 3 - Preserve the project while auditioning (Priority: P2)

As a composer, I want auditioning to be temporary so that it cannot alter my project, selection, loop preference, or future full-project playback.

**Why this priority**: Auditioning is an exploratory action and must be safe to invoke repeatedly while editing.

**Independent Test**: Capture the project’s score, transport settings, and selection; audition a subset; stop; then verify the original project and its later full-project rendering are unchanged.

**Acceptance Scenarios**:

1. **Given** an audition begins, **when** it creates its isolated playback content, **then** the opened project document and the renderer’s selected objects remain unchanged.
2. **Given** looping is enabled for the project, **when** the user auditions selected objects, **then** the selection plays once rather than repeating.
3. **Given** a selection changes, an object is deleted, or the project closes before the action is handled, **when** audition is requested, **then** the application safely declines the stale request without starting unrelated playback or changing project data.

### Edge Cases

- Selections may span multiple layer groups, layers, tracks, time bases, and object kinds supported by score generation.
- A selected object may start before another selected object and may have zero or very short duration; the audition range must still be derived from the selection’s actual score times.
- Normal mute or solo state may suppress all selected objects in the full project; this must not suppress the temporary audition.
- A selection may become stale because of a concurrent edit, project replacement, or project close between menu enablement and invocation.
- An audition request may arrive while normal realtime playback is running, while an exclusive disk-render/freeze operation is active, or after realtime startup fails.
- The mixer may require an extra audible tail after the latest selected object ends.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Project menu MUST expose **Audition ScoreObjects** only when an open project has at least one currently selected, auditionable score object and realtime playback is not blocked by an exclusive render operation.
- **FR-002**: The action MUST use the current score selection at invocation time, identify selected objects unambiguously against the canonical open project, and reject a stale or empty selection safely.
- **FR-003**: Starting an audition MUST replace any active normal realtime playback and MUST report its lifecycle through the same user-visible playback state used by normal realtime playback.
- **FR-004**: The audition MUST render only the selected score objects; it MUST exclude unselected objects, empty containers, and score sections that do not contain a selected object.
- **FR-005**: The audition MUST retain all project context required for selected objects to render as they do in the project, including applicable instruments, global score/orchestra content, automation, mixer routing, and dependencies.
- **FR-006**: For a retained conventional score layer or Track, the temporary audition MUST not be suppressed by that layer’s or Track’s normal mute or solo state.
- **FR-007**: The filtering rules MUST support Track LayerGroups as first-class score content. They MUST retain only tracks containing selected items and only the selected sound objects or audio clips within each retained track.
- **FR-008**: The temporary playback range MUST start at the earliest selected-object start time and end at the latest selected-object end time, plus the configured mixer tail when the mixer is enabled.
- **FR-009**: The temporary audition MUST disable loop playback regardless of the project’s loop setting.
- **FR-010**: The action MUST use an isolated copy of the project for audition and MUST NOT persist or otherwise mutate the canonical project document, the current selection, project transport settings, or `.blue` XML.
- **FR-011**: If realtime startup or score generation fails, the application MUST return to a non-playing state, surface the existing actionable playback error, and leave canonical project data unchanged.
- **FR-012**: The menu’s availability MUST update when the project, active selection, or exclusive render state changes, so a disabled action cannot be invoked with an invalid selection.
- **FR-013**: The action MUST provide Java Blue’s platform-primary-plus-Shift+A shortcut: Cmd+Shift+A on macOS and Ctrl+Shift+A on Windows and Linux. The shortcut MUST invoke the same availability checks and audition behavior as **Project > Audition ScoreObjects**.
- **FR-014**: A score-timeline mouse press MUST stop an active audition before selection, marquee, move, resize, or other timeline gesture handling. The same press MUST NOT stop ordinary full-project realtime playback solely because the timeline received focus.
- **FR-015**: Starting a normal realtime render, starting a new audition, or starting Render to Disk MUST arbitrate with an active audition as Java Blue does: realtime starts replace the current realtime session, a new audition replaces the current realtime session, and Render to Disk stops realtime playback before disk-render setup. A generic editor focus change MUST NOT stop audition unless it is also a score-timeline press.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue’s `AuditionSelectedSoundObjectsAction` and `RealtimeRenderManager.auditionSoundObjects`/`filterScore`: copy the project, remove unselected score objects by clone-source identity, discard unrelated score groups, clear retained layers’ mute/solo state, disable looping, calculate selection bounds, include the mixer’s extra render time, and render in realtime. `ScoreMouseListener.mousePressed()` stops an active audition before score gestures; normal realtime render startup replaces an existing realtime render; and `RenderToDiskUtility` stops realtime before disk setup. The action is registered as `DS-A`, the platform-default primary modifier plus Shift+A.
- **Compatibility Requirements**: The observable Java audition behavior—selected-only content, selection-derived window, one-shot playback, mixer tail, isolated project data, replacement of an active realtime render, timeline-press cancellation, Render-to-Disk arbitration, and the Cmd/Ctrl+Shift+A shortcut—MUST be preserved. TypeScript Blue’s durable project XML and ordinary full-project render output MUST remain unchanged.
- **Intentional Divergences**: Track LayerGroups and their mixed sound-object/audio-clip contents are TypeScript Blue canonical score content with no Java equivalent in this workflow. The same selected-only and unsuppressed-layer semantics extend to those tracks, preserving the track’s instrument, routing, automation, and selected audio clips.
- **State Ownership**: The Electron main process retains the canonical project document and owns the disposable audition copy and realtime session. The renderer owns the transient current selection and publishes only the current selection identity/availability needed by the native menu. Playback state remains transient. No audition state is persisted to `.blue` XML or program settings.

### Key Entities

- **Audition Selection**: The current, transient set of selected score-object identities that can be resolved against the open project.
- **Audition Project Copy**: The disposable project snapshot used solely to generate selected-only realtime playback.
- **Selected Item Source Identity**: The relationship between an original selected object and its counterpart in the audition copy, used to retain the correct copied content.
- **Track LayerGroup**: A score container of tracks, each of which can hold sound objects and audio clips with its own instrument, routing, mute/solo state, and automation.
- **Audition Window**: The temporary start and end bounds calculated from all selected objects, including any configured mixer tail.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated selected-only fixtures spanning at least two score containers, 100% of selected objects produce audition output and 0 unselected objects produce audition output.
- **SC-002**: In fixtures containing muted or soloed conventional layers and Tracks, 100% of selected playable items are included in the audition regardless of their normal layer/Track mute or solo state.
- **SC-003**: In mixed Track fixtures containing selected sound objects and audio clips, 100% of selected items retain their expected track-owned sound source and 0 unselected track items are rendered.
- **SC-004**: For every tested multi-object selection, the audition begins at the earliest selected start and ends at the latest selected end plus the configured mixer tail, with no repeated loop cycle.
- **SC-005**: After 20 repeated audition start/stop cycles, the canonical project score, transport settings, selection, and saved project serialization remain byte-for-byte or structurally unchanged from their pre-audition state.
- **SC-006**: A stale, empty, deleted, or closed-project selection starts 0 unintended realtime sessions and produces no canonical-project mutation in every tested case.
- **SC-007**: On macOS, Windows, and Linux menu-contract coverage, the enabled action advertises and dispatches Cmd+Shift+A or Ctrl+Shift+A respectively, with the same result as choosing the menu item.

## Assumptions

- The existing realtime playback path remains the single user-visible transport for full-project playback and auditions; this feature does not add offline rendering or a separate player.
- Score objects that the current score model can render, including Track audio clips, are auditionable when selected.
- The renderer’s stable score-object IDs are sufficient to validate current selections against the canonical project at action time; the feature does not introduce durable selection IDs into project XML.
- Audition follows Java behavior by replacing an active realtime render, while disk-render/freeze operations remain exclusive and prevent action availability.
- The mixer’s existing extra-render-time setting is the only additional tail applied to the selection range.
- Nested score-object behavior, object-specific editor features, and new keyboard shortcuts are out of scope unless they already participate in the shared score selection.
