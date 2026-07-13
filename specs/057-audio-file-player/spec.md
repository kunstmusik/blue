# Feature Specification: Audio File Player

**Feature Branch**: `057-audio-file-player`
**Created**: 2026-07-12
**Status**: Complete
**Input**: User description: "Add a dockable Audio File Player with local file playback, waveform seeking, loop controls, metadata, and Render to Disk and Play integration."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preview a Local Audio File (Priority: P1)

A composer opens the Audio File Player, chooses a local audio file, and can
preview it without leaving Blue.

**Why this priority**: Immediate auditioning is the core value of the panel.

**Independent Test**: Open the panel, select a supported audio file, and use
the transport controls to start and pause it.

**Acceptance Scenarios**:

1. **Given** no file is loaded, **When** the composer opens the panel,
   **Then** one clear empty-state message is shown and playback controls are
   disabled.
2. **Given** the composer chooses a supported local audio file, **When** its
   metadata is available, **Then** the panel displays a waveform, duration,
   sample rate, channel count, and size.
3. **Given** a file is loaded, **When** the composer presses Play or Pause,
   **Then** playback starts or pauses and the control reflects that state.

---

### User Story 2 - Navigate an Audio Preview (Priority: P2)

A composer can inspect a file's timing and jump to a useful position while
previewing it.

**Why this priority**: A visual overview and direct seeking make an audition
useful for sound-design and arrangement work.

**Independent Test**: Load a file, click or drag within its waveform, and
confirm the playhead and audio position move together.

**Acceptance Scenarios**:

1. **Given** a loaded file, **When** the composer clicks or drags along the
   waveform, **Then** playback moves to the corresponding relative position.
2. **Given** a loaded file, **When** it plays, **Then** its playhead moves
   across a continuous waveform display.
3. **Given** a loaded file, **When** the composer enables loop playback,
   **Then** the file repeats until loop playback is disabled.

---

### User Story 3 - Audition a Disk Render in Blue (Priority: P3)

A composer choosing "Render to Disk and Play" hears the completed render in
the Audio File Player rather than in a separate operating-system player.

**Why this priority**: It keeps the render-and-review loop inside the project
workspace.

**Independent Test**: Render a project with the Play action and confirm the
panel opens, loads the output, and attempts playback (reporting any platform
autoplay denial).

**Acceptance Scenarios**:

1. **Given** a successful disk render requested with Play, **When** the render
   completes, **Then** the Audio File Player opens with the render loaded and
   attempts in-app playback, reporting a clear error if the platform denies
   autoplay.
2. **Given** a disk render requested with Open, **When** it completes, **Then**
   the existing operating-system open behavior remains unchanged.

### Edge Cases

- An unsupported, unreadable, or missing file reports a clear load failure and
  leaves the player usable for another file.
- A path with spaces or non-ASCII characters remains playable.
- A very short file shows a continuous waveform rather than detached visual
  fragments.
- An autoplay attempt denied by the platform presents a clear error.
- A render can finish before the player panel mounts; the completed output is
  retained until the panel can load it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST expose an Audio File Player in the
  workbench's auxiliary area.
- **FR-002**: Users MUST be able to select and preview common local audio
  files without launching another application.
- **FR-003**: The player MUST provide Play/Pause and loop controls with clear,
  keyboard-accessible labels and state.
- **FR-004**: The player MUST display current and total time in
  `MM:SS.SSS` format wherever it presents a playback duration.
- **FR-005**: The player MUST show one clear empty state when no file is
  selected and MUST NOT present a misleading waveform in that state.
- **FR-006**: The player MUST show a seekable, continuous waveform and a
  current-position indicator for a loaded file.
- **FR-007**: The player MUST provide file path, duration, sample rate,
  channels, and size when available.
- **FR-008**: "Render to Disk and Play" MUST load successful render output in
  the Audio File Player and attempt in-app playback, reporting a platform
  autoplay denial.
- **FR-009**: Existing "Render to Disk and Open" behavior MUST remain
  unchanged.
- **FR-010**: The player MUST communicate loading and playback failures to the
  user without crashing the workbench.

### Key Entities

- **Player session**: The currently loaded file and its transient playback,
  loop, position, duration, and metadata state.
- **Audio preview source**: A user-selected or newly rendered local audio file
  made available for playback.
- **Render completion**: A completed disk-render result and its requested
  post-render action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open a supported local audio file and begin playback
  using the panel in one selection and one transport action.
- **SC-002**: For a loaded file, selecting any point in the waveform moves the
  playback position to that relative point in a single interaction.
- **SC-003**: A loaded file presents one continuous waveform, while an empty
  player presents exactly one empty-state message and no waveform.
- **SC-004**: Every time value shown by the player is formatted as minutes,
  seconds, and three fractional digits.
- **SC-005**: A successful render requested with Play opens the player with
  its output loaded and attempts in-app playback without a separate player
  window; any autoplay denial is clearly reported.

## Assumptions

- The host platform can decode the audio format selected by the user.
- Preview state is transient and is not written into the project document.
- The media source only serves files explicitly authorized by the file picker
  or the application's Play-render workflow.
- Output-device selection and detailed codec metadata are deferred from this
  feature slice.
