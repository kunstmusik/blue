# Feature Specification: MIDI Device Input And Blue Live Routing

**Feature Branch**: `058-midi-live-input`
**Created**: 2026-07-13
**Status**: Complete (implementation; release-platform matrix documented below)
**Input**: User description: "Add app-wide MIDI input settings with device discovery, rescan, enablement, and connection state; remove the Blue Live MIDI Input toolbar button and keep enabled devices connected automatically; route physical MIDI throughout the app; and play Blue Live instruments in real time through the same behavior used by the Virtual Keyboard."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure MIDI Input Devices (Priority: P1)

As a composer, I need an app-wide MIDI settings page that shows the input devices available to Blue, lets me enable the devices I want, and tells me whether each device is available and connected.

**Why this priority**: Hardware performance cannot work until users can discover and select real input devices and understand their current state.

**Independent Test**: Open Settings with at least one previously unknown MIDI controller attached, confirm it is enabled and connected automatically, disable and apply it, close and reopen the app, and confirm that the explicit disabled preference and current availability/connection state are shown accurately.

**Acceptance Scenarios**:

1. **Given** one or more MIDI input devices are attached, **When** the user opens the MIDI settings page or presses `Rescan`, **Then** every available input is listed once with its name, identifying details, enabled preference, availability, connection state, and any device-specific error.
2. **Given** an attached input has no saved preference, **When** Blue discovers it, **Then** Blue treats it as enabled, opens it automatically, and accepts note events without requiring `Apply`.
3. **Given** a listed input has an explicit saved disabled preference, **When** the user enables it and applies the Settings change, **Then** the preference is saved app-wide and Blue attempts to connect the device without changing the current project.
4. **Given** an enabled input is absent when Blue starts, **When** the user opens MIDI settings, **Then** the saved device remains represented as unavailable rather than silently disappearing from the configuration.
5. **Given** multiple MIDI inputs are available, **When** the user enables more than one, **Then** Blue can receive notes from all enabled inputs while keeping their individual states visible.

---

### User Story 2 - Use MIDI Without An Extra Toolbar Toggle (Priority: P1)

As a live performer, I need devices enabled in Settings to connect automatically and remain available to the application, without a second `MIDI Input` toolbar switch that can disagree with my device preferences.

**Why this priority**: A second global switch creates an ambiguous “enabled but inactive” state during live setup. Per-device enablement is sufficient and makes connection behavior predictable.

**Independent Test**: Attach a previously unknown device and confirm it connects automatically; restart Blue and confirm it reconnects; disable and apply it and confirm the connection closes and remains disabled; verify the Blue Live toolbar no longer contains `MIDI Input`.

**Acceptance Scenarios**:

1. **Given** a newly discovered available device has no saved preference, **When** discovery completes, **Then** Blue opens it automatically and Settings reports the resulting connection state.
2. **Given** an enabled device preference exists, **When** Blue starts, **Then** Blue attempts to reconnect that device without requiring a toolbar action.
3. **Given** a connected device is disabled in Settings, **When** the Settings change is applied, **Then** Blue stops accepting events from it, closes its connection, and clears notes held by that source.
4. **Given** no enabled input can be opened, **When** the user views MIDI settings, **Then** Blue explains whether the cause is no enabled device, no available device, denied access, or a device-open failure.
5. **Given** the Blue Live toolbar is visible, **When** the user views its controls, **Then** no `MIDI Input` button is present.
6. **Given** the user opens the project MIDI Input panel through the Window/workbench flow, **When** it appears, **Then** the existing project pitch and velocity mapping editor remains available independently of app-wide device settings.

---

### User Story 3 - Play Blue Live Instruments From Hardware (Priority: P1)

As a composer with Blue Live running, I need notes played on an enabled MIDI controller to trigger the instrument assigned to each incoming MIDI channel in real time, using the project’s MIDI pitch and velocity mapping.

**Why this priority**: Real-time instrument performance is the primary outcome of connecting a MIDI device.

**Independent Test**: Enable a controller, load a project with instruments assigned to two channels, start Blue Live, play note-on and note-off messages on both channels, and confirm that the corresponding instruments start and stop with the project’s configured pitch and velocity mapping.

**Acceptance Scenarios**:

1. **Given** Blue Live is running and an enabled device is connected, **When** that device sends a note-on message with positive velocity, **Then** Blue triggers the instrument mapped to that MIDI channel using the current project MIDI processing settings.
2. **Given** a hardware-triggered note is active, **When** its matching note-off arrives, **Then** the same Blue Live note is released without leaving a stuck note.
3. **Given** a device sends note-on with velocity zero, **When** Blue handles the message, **Then** it is treated as note-off.
4. **Given** the same channel, note, and velocity are produced once by hardware and once by the Virtual Keyboard, **When** each is played under the same project state, **Then** both follow the same mapping and produce equivalent Blue Live note behavior.
5. **Given** a MIDI channel has no corresponding instrument assignment, **When** a note arrives on that channel, **Then** Blue ignores it safely and exposes a non-disruptive diagnostic rather than triggering the wrong instrument.

---

### User Story 4 - Recover From Device And Session Changes (Priority: P2)

As a performer, I need MIDI input to recover predictably when devices are attached, removed, rescanned, enabled, or disabled so that live use does not require restarting Blue and does not leave notes sounding.

**Why this priority**: Hot-plugging and transient device failures are common during setup and performance, and bad recovery can cause silence or stuck notes.

**Independent Test**: Connect an enabled device, play and hold a note, disconnect the device, reconnect it, rescan if necessary, and verify state changes, note cleanup, and reconnection without restarting the app.

**Acceptance Scenarios**:

1. **Given** an enabled device is connected, **When** the device is removed, **Then** Blue marks it unavailable or disconnected and releases notes held by that source.
2. **Given** an enabled device becomes available again, **When** Blue detects it or the user rescans, **Then** Blue reconnects it automatically or reports a clear failure.
3. **Given** a device is available, **When** the user enables or disables it and applies the Settings change, **Then** that change takes effect without requiring an app restart or changing unrelated devices.
4. **Given** Blue Live stops, the project changes, or the app exits while hardware notes are held, **When** cleanup runs, **Then** active notes and device listeners are released without duplicate events or stuck-note state.

### Edge Cases

- MIDI access is unsupported, denied, or revoked by the host environment.
- A rescan returns no devices, returns a device already known under the same identity, or returns two devices with the same display name.
- A saved enabled device is absent at launch and later reconnects.
- A device disappears between discovery and the attempt to open it.
- One enabled device opens while another enabled device fails.
- The same note is held by more than one input source when one source disconnects.
- Note messages arrive while no project is loaded, Blue Live is stopped, or their source device is disabled.
- Blue Live starts or recompiles while enabled MIDI devices are already connected.
- Rapid enable/disable changes or repeated rescans occur while connection work is still in progress.
- A settings window closes while discovery or connection state is changing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST provide an app-wide `MIDI` settings category dedicated to controller input devices.
- **FR-002**: App-wide controller input settings MUST remain distinct from project MIDI pitch/velocity mapping and from realtime-render MIDI driver/device options.
- **FR-003**: Users MUST be able to discover and manually rescan all available MIDI input devices without loading a project.
- **FR-004**: Each device entry MUST show a stable identity, human-readable name, available identifying details, enabled preference, availability, connection state, and last connection error when applicable.
- **FR-005**: Users MUST be able to enable zero, one, or multiple MIDI input devices.
- **FR-005a**: A newly discovered MIDI input with no saved preference MUST be enabled and opened by default; an explicit saved disabled preference MUST continue to keep that device closed.
- **FR-006**: Enabled-device preferences MUST persist across app restarts, and Blue MUST attempt to reconnect enabled devices automatically when the application starts.
- **FR-007**: A saved device preference MUST remain represented when the device is unavailable and MUST be reconciled when that device returns.
- **FR-008**: Rescan MUST refresh the device list without creating duplicate entries, duplicate listeners, or duplicate note events.
- **FR-009**: The system MUST update device availability and connection state when a device is attached, removed, opened, closed, or fails.
- **FR-010**: The Blue Live toolbar MUST remove the `MIDI Input` control and MUST NOT use Blue Live state to start or stop device connections.
- **FR-011**: MIDI Settings MUST expose discovery, connecting, connected, disconnecting, unavailable, partial-failure, and error outcomes for the overall device service and each relevant device.
- **FR-012**: Blue MUST attempt to open every enabled and available input automatically; a failure for one device MUST NOT prevent other enabled devices from working.
- **FR-013**: Disabling a device or exiting the app MUST close the affected input, detach its listeners, clear its runtime note state, and prevent later messages from that connection from reaching app consumers.
- **FR-014**: Applying a saved enabled or disabled preference MUST reconcile that device immediately without waiting for an app restart or disturbing unrelated device connections.
- **FR-015**: An enabled device that returns after becoming unavailable MUST be reopened automatically when possible.
- **FR-016**: Access denial, unavailable platform support, and device-open failures MUST be reported in user-facing state without crashing Settings, the workbench, or Blue Live.
- **FR-017**: Incoming note events MUST carry source identity, channel, note number, velocity, event kind, and timing information sufficient for app consumers and held-note cleanup.
- **FR-018**: Hardware note-on and note-off events MUST use the same live-note routing and project MIDI processing behavior as equivalent Virtual Keyboard events.
- **FR-019**: Hardware note-on with velocity zero MUST be normalized as note-off.
- **FR-020**: When Blue Live is running, each routed note MUST target the instrument assigned to its incoming channel and use the current project’s pitch, scale, and velocity mapping.
- **FR-021**: When no project is loaded, Blue Live is stopped, the source device is disabled or disconnected, or the channel is unmapped, incoming notes MUST be ignored safely without being rerouted to another instrument.
- **FR-022**: The system MUST track held notes by input source so disabling or disconnecting one source releases that source’s notes without corrupting unrelated source state.
- **FR-023**: Disabling or disconnecting a device, stopping Blue Live, changing projects, and exiting the app MUST provide a deterministic held-note cleanup path.
- **FR-024**: The existing project MIDI Input panel MUST remain available through its workbench/window entry for project-owned pitch, scale, and velocity mapping.
- **FR-025**: Existing legacy MIDI input placeholder preferences MUST be preserved or migrated without overwriting project MIDI mappings or realtime-render MIDI options.
- **FR-026**: System-exclusive messages, MIDI output, controller-change mapping, pitch bend, aftertouch, program changes, MIDI clock, and recording are outside this feature’s required routing scope.
- **FR-027**: Automated coverage MUST verify settings persistence and migration, device discovery and reconciliation, note normalization and routing parity, held-note cleanup, permission boundaries, and removal of the obsolete toolbar control.
- **FR-028**: Existing Blue Synth Builder real-time widget edits MUST continue to update both an active timeline-render engine and a concurrently active Blue Live engine, using the compiled runtime parameter names for each session.

### Key Entities

- **MIDI Input Device**: One discoverable input port, identified independently from its display name and described by manufacturer/name/version details, availability, connection state, enabled preference, and last error.
- **MIDI Input Preferences**: App-wide durable selection of enabled device identities, including remembered devices that are currently unavailable.
- **MIDI Device Service State**: Transient app runtime state describing discovery and per-device connection outcomes, including whether all, some, or none of the enabled devices are connected.
- **MIDI Note Event**: A normalized note-on or note-off action with source identity, channel, note, velocity, and timing information.
- **Held Note**: Runtime record tying an active note to its input source so targeted cleanup can occur on note-off, disable, disconnect, stop, project change, or exit.
- **Project MIDI Processing**: Existing project-owned pitch, tuning, scale, and velocity rules applied to routed live notes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can attach an input and play a Blue Live instrument without first enabling it, restarting Blue, or using an additional toolbar control.
- **SC-002**: A manual rescan reflects attached and removed MIDI inputs in the device list within two seconds under normal operating conditions.
- **SC-003**: Enabled-device preferences are restored correctly in 100% of restart tests, including tests where a remembered device is absent at launch.
- **SC-004**: Every listed device’s connection state reflects an app start, attach, remove, enable, disable, or open-failure outcome within one second.
- **SC-005**: For identical channel, note, velocity, and project settings, hardware and Virtual Keyboard inputs produce equivalent live-note results in 100% of mapping tests.
- **SC-006**: In normal local use, 95% of hardware note events add no more than 5 milliseconds of application routing delay compared with equivalent Virtual Keyboard events, excluding hardware and audio-driver latency.
- **SC-007**: Across 100 cycles of held-note release, device disable, device removal, Blue Live stop, and project change, no test leaves a sounding or internally tracked stuck note.
- **SC-008**: With two enabled devices where one fails to open, the working device remains playable in 100% of partial-failure tests and the failed device remains clearly identified.
- **SC-009**: BSB real-time control fan-out tests deliver each widget channel update once to every active timeline and Blue Live engine and skip inactive sessions.

## Assumptions

- The first delivery supports MIDI input only; MIDI output and non-note message mapping remain separate follow-up work.
- Multiple input devices may be enabled concurrently, matching Java Blue’s effective behavior.
- Newly discovered devices default to enabled; saved enabled/disabled preferences persist, and disabling a device in Settings is the explicit way to stop using it.
- Hardware messages use their native MIDI channel; the Virtual Keyboard retains its existing user-selected channel.
- Blue Live must be running for notes to sound, but device discovery and connection state are app-wide and do not belong to a project.
- The existing project MIDI Input panel continues to edit `.blue`-owned mapping data and is not replaced by app-wide device settings.
- The host operating system and user must grant access to connected MIDI devices; denial is a supported error state.
- Device identities are persisted using the strongest stable identity supplied by the host, with descriptive fields retained for reconciliation and display.

## Completion Evidence

- Automated coverage exercises permission boundaries, settings persistence, discovery/default enablement, duplicate identities, rescan/listener idempotency, hot-plug/replacement generations, hardware/Virtual Keyboard routing parity, graceful app shutdown, partial failure, and 100 repeated held-note cleanup cycles.
- Main, preload, and renderer production builds compile without a native MIDI dependency; raw Web MIDI objects remain renderer-local and all IPC payloads are serializable.
- A macOS Electron 35.7.5 smoke probe enumerated the attached `MidiKeys` device with `sysexEnabled: false`, and user-reported development-app manual testing confirmed the core Settings, connection, and Blue Live note flow on 2026-07-13.
- Production-runtime, packaged-artifact, Windows, Linux, and quantitative hardware-latency checks remain release-platform validation rather than unrecorded pass claims; the exact matrix and limitations are retained in [quickstart.md](./quickstart.md).
