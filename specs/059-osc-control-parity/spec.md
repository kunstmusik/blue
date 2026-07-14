# Feature Specification: OSC Control Parity

**Feature Branch**: `059-osc-control-parity`\
**Created**: 2026-07-13\
**Status**: Complete\
**Completed**: 2026-07-14\
**Input**: User description: "Implement OSC support with parity for Java Blue, add an Application Settings OSC panel after MIDI, implement the Java Blue commands except the retired `/blueLive/toggleMidiInput` command, and increment to the next available port when the configured port is already in use. Check for any other Java Blue OSC behavior that requires consideration."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start And Configure OSC Control (Priority: P1)

As a composer or performer, I need Blue to listen for OSC control messages whenever the application is running and to show me the port that an external controller must target.

**Why this priority**: No remote command can work until the app-wide listener starts reliably and its active port is discoverable.

**Independent Test**: Start Blue with no project loaded, open Application Settings, select `OSC` immediately after `MIDI`, confirm the default preferred and active server port are 8000, send a recognized message, then occupy port 8000 before another launch and confirm Blue listens on and reports 8001 without changing the saved preference.

**Acceptance Scenarios**:

1. **Given** no OSC preference has been saved, **When** Blue starts, **Then** it listens for inbound OSC messages on UDP port 8000 on all available IPv4 interfaces.
2. **Given** port 8000 is already in use, **When** Blue starts with 8000 as the preferred port, **Then** it tries 8001 and continues upward until it binds the first available valid port.
3. **Given** Blue selected a fallback port, **When** the user opens `Application Settings > OSC`, **Then** the panel shows both the saved preferred port and the actual listening port and clearly explains why they differ.
4. **Given** the user enters a valid new preferred port and applies the change, **When** the listener restarts, **Then** Blue releases the old listener and begins listening on the preferred port or its first higher available fallback without an app restart.
5. **Given** the user cancels an unapplied edit, **When** Settings closes or returns to the saved value, **Then** neither the saved preferred port nor the active listener changes.

---

### User Story 2 - Control Score Transport And Navigation (Priority: P1)

As a performer using an OSC controller, I need the Java Blue score commands to control regular project playback and the score position without touching the application UI.

**Why this priority**: Remote score transport is a core live-performance workflow and represents five of the eight supported OSC commands.

**Independent Test**: Load a project with multiple markers and score objects, send each `/score/*` command from an OSC client, and verify playback, render boundaries, selected start position, and score scrolling match the equivalent Java Blue behavior.

**Acceptance Scenarios**:

1. **Given** a project is loaded, **When** `/score/play` arrives, **Then** regular project playback starts from the current render range; if regular playback is already active, it is stopped and restarted from the current range.
2. **Given** regular playback is active, **When** `/score/stop` arrives, **Then** regular playback stops without stopping an independent Blue Live session.
3. **Given** a project has a nonzero render start or a finite render end, **When** `/score/rewind` arrives, **Then** render start becomes zero and render end becomes open-ended.
4. **Given** one or more markers occur after the current render start, **When** `/score/markerNext` arrives, **Then** render start moves to the first strictly later marker and the score view follows it.
5. **Given** no marker occurs after the current render start, **When** `/score/markerNext` arrives, **Then** render start moves forward to the computed end of the score when that end is later than the current position.
6. **Given** one or more markers occur before the current render start, **When** `/score/markerPrevious` arrives, **Then** render start moves to the last strictly earlier marker and the score view follows it.
7. **Given** no marker occurs before the current render start, **When** `/score/markerPrevious` arrives, **Then** render start moves to zero and the score view follows it.
8. **Given** no project is loaded, **When** `/score/play`, `/score/rewind`, `/score/markerNext`, or `/score/markerPrevious` arrives, **Then** Blue safely leaves playback and project state unchanged while keeping the OSC listener available for a later project; `/score/stop` remains able to stop any active regular playback without requiring a project.

---

### User Story 3 - Control Blue Live (Priority: P1)

As a live performer, I need the supported Java Blue OSC commands for Blue Live on/off, recompilation, and all-notes-off so an external control surface can operate the live engine workflow.

**Why this priority**: These three commands cover emergency note cleanup and live engine lifecycle operations that must remain accessible during a performance.

**Independent Test**: Load a project, send all three supported `/blueLive/*` commands through complete start, stop, recompile, and all-notes-off cycles, and confirm the outcomes match Java Blue.

**Acceptance Scenarios**:

1. **Given** a project is loaded and Blue Live is stopped, **When** `/blueLive/onOff` arrives, **Then** Blue Live starts from the current project.
2. **Given** Blue Live is running, **When** `/blueLive/onOff` arrives, **Then** only Blue Live stops.
3. **Given** a project is loaded, **When** `/blueLive/recompile` arrives, **Then** Blue Live stops if necessary and starts a fresh session from the current project, including when it was previously stopped.
4. **Given** Blue Live is running, **When** `/blueLive/allNotesOff` arrives, **Then** the Blue Live all-notes-off event is submitted once; when Blue Live is not running, the command is a safe no-op.
5. **Given** no project is loaded, **When** `/blueLive/onOff` or `/blueLive/recompile` arrives, **Then** Blue safely leaves engine state unchanged; `/blueLive/allNotesOff` continues to depend only on whether a Blue Live session is active.

---

### User Story 4 - Operate Reliably Across Network And Lifecycle Errors (Priority: P2)

As a performer, I need malformed traffic, rapid commands, port conflicts, settings changes, and shutdown to fail predictably without crashing Blue, creating duplicate engines, or leaving network resources active.

**Why this priority**: OSC commonly runs over shared local networks and UDP does not guarantee clean, serialized input; failure handling is necessary for dependable live use.

**Independent Test**: Exercise malformed and unknown packets, nested bundles, rapid repeated lifecycle commands, an occupied preferred port, a port change during traffic, no-project state, and app shutdown, then verify service status, engine counts, and port release.

**Acceptance Scenarios**:

1. **Given** an OSC message includes any arguments, **When** its address matches a registered Java Blue command, **Then** Blue performs the command once and ignores the arguments.
2. **Given** recognized messages are nested in an OSC bundle, **When** the bundle arrives, **Then** Blue processes the messages in bundle order without delaying for bundle timetags.
3. **Given** an unknown, case-mismatched, or malformed message arrives, **When** Blue handles the packet, **Then** it performs no unrelated command, remains available, and exposes a non-disruptive diagnostic for malformed traffic.
4. **Given** rapid overlapping playback or Blue Live lifecycle commands arrive, **When** Blue processes them, **Then** lifecycle transitions remain deterministic and do not create duplicate engine sessions.
5. **Given** every port from the preferred port through 65535 is unavailable, or binding fails for a reason other than an address already being in use, **When** the listener starts, **Then** Blue reports that OSC is not listening and keeps the rest of the application usable.
6. **Given** Blue is shutting down, **When** OSC traffic arrives, **Then** no new command work begins after shutdown cleanup and the UDP port is released.

### Edge Cases

- The preferred port is 1 or 65535, is blank, is fractional, is outside 1-65535, or contains nonnumeric text.
- Port 65535 is the preferred port and is already in use; fallback does not wrap to port 1.
- Several consecutive ports are occupied, including by another Blue instance, before an available port is found.
- A preferred port becomes free after Blue has selected a fallback; Blue keeps the active fallback until the next listener restart rather than switching ports mid-session.
- The port becomes unavailable between candidate selection and the actual bind attempt.
- Applying a port change races with inbound packets or app shutdown.
- Multiple messages in one bundle include known and unknown addresses or nested bundles.
- Bundle timetags are in the past or future; Java Blue behavior is immediate processing rather than scheduled execution.
- A recognized command contains arguments of any supported OSC type; command behavior does not depend on the payload.
- An address extends a registered path, such as `/score/play/alternate`; Java Blue prefix matching causes the registered command to run.
- Marker lists are empty, contain markers exactly at the current render start, or end before the current render start.
- The score is empty when `/score/markerNext` arrives.
- Play, stop, toggle, or recompile messages are repeated while the corresponding engine is starting or stopping.
- The operating system firewall blocks remote traffic even though the local listener is active.

## Requirements *(mandatory)*

### Java Blue OSC Parity Baseline

The required inbound command set and externally observable behavior are:

| OSC address | Required behavior |
|-------------|-------------------|
| `/score/play` | Start a fresh regular project render; stop and restart regular playback first if it is already active. |
| `/score/stop` | Stop regular project playback when active; do not stop Blue Live. |
| `/score/rewind` | Set render start to 0 and render end to open-ended. |
| `/score/markerNext` | Move to the first marker strictly after render start, otherwise move forward to the score end; update the score view. |
| `/score/markerPrevious` | Move to the last marker strictly before render start, otherwise move to 0; update the score view. |
| `/blueLive/onOff` | Toggle Blue Live for the current project. |
| `/blueLive/recompile` | Stop if necessary and start Blue Live from the current project. |
| `/blueLive/allNotesOff` | Submit the Blue Live all-notes-off event when Blue Live is active. |

### Functional Requirements

- **FR-001**: Application Settings MUST include an `OSC` category immediately after `MIDI` in the left navigation.
- **FR-002**: The OSC settings panel MUST provide one editable preferred server port, defaulting to 8000, and MUST show the current listener state and actual active port.
- **FR-003**: The preferred port MUST be an integer from 1 through 65535; invalid input MUST block Apply and preserve the last valid saved value and active listener.
- **FR-004**: The preferred port MUST persist app-wide across restarts and MUST NOT be stored in or modify project data.
- **FR-005**: Applying a valid changed preferred port MUST restart the listener immediately; Cancel MUST not restart it; Reset Panel MUST restore preferred port 8000 and restart the listener through the existing immediate reset behavior used by Application Settings.
- **FR-006**: Blue MUST start one inbound OSC listener during application startup, independent of whether a project or Settings window is open, and MUST stop and release it during application shutdown.
- **FR-007**: The listener MUST accept OSC over IPv4 UDP on all available network interfaces, matching Java Blue's externally reachable server behavior.
- **FR-008**: Blue MUST first attempt the saved preferred port. When a bind attempt fails because that port is already in use, it MUST increment by one and retry until the first available port is bound or port 65535 has been attempted.
- **FR-009**: Port fallback MUST proceed only upward and MUST NOT wrap from 65535 to 1.
- **FR-010**: A fallback active port MUST remain transient: Blue MUST retain the user's preferred port, retry from that preference on the next listener restart, and MUST NOT silently overwrite it with the fallback.
- **FR-011**: When the active and preferred ports differ, OSC Settings MUST show both values and identify that a conflict caused the fallback.
- **FR-012**: A non-conflict bind failure or exhaustion of the valid port range MUST leave the app usable, leave OSC visibly not listening, and expose an actionable error.
- **FR-013**: Blue MUST recognize all eight case-sensitive addresses in the Java Blue OSC Parity Baseline and MUST NOT omit or rename any supported command.
- **FR-014**: Address routing MUST preserve Java Blue's prefix behavior: the first registered command whose address is a prefix of the received address runs once; unmatched addresses perform no command.
- **FR-015**: Command payload arguments MUST be accepted but ignored; the address alone determines behavior.
- **FR-016**: Blue MUST accept individual OSC messages and messages recursively contained in OSC bundles, process bundled messages in packet order, and preserve Java Blue's immediate handling rather than scheduling by bundle timetag.
- **FR-017**: The score command outcomes MUST match the five entries in the Java Blue OSC Parity Baseline, including strict marker comparisons, score-end fallback, open-ended rewind, view-follow behavior, regular-playback restart on play, and independence from Blue Live.
- **FR-018**: The Blue Live command outcomes MUST match the three entries in the Java Blue OSC Parity Baseline, including start-from-stopped recompile and safe no-op behavior when required project or running-session state is absent.
- **FR-019**: OSC-triggered score position changes MUST update the same canonical project and visible transport state used by the application's corresponding controls.
- **FR-020**: OSC-triggered playback and Blue Live actions MUST expose the same visible lifecycle and error state as equivalent in-app actions.
- **FR-021**: Rapid or overlapping OSC lifecycle commands MUST be coordinated so the final state is deterministic and no duplicate regular-playback or Blue Live engine sessions are created.
- **FR-022**: Malformed packets, unknown addresses, command failures, unavailable projects, and unavailable engines MUST NOT stop the OSC listener or crash the application.
- **FR-023**: Blue MUST NOT send OSC acknowledgments or command replies; outbound OSC destinations and messages are outside Java parity and outside this feature.
- **FR-024**: Existing saved `oscInputPort` placeholder data MUST be used as a one-time migration source when it contains a valid nonzero port; zero, missing, or invalid placeholder values MUST resolve to the Java default of 8000.
- **FR-025**: Existing unused OSC output host and output port placeholders MUST remain preserved in app-specific storage for downgrade safety, MUST NOT affect the inbound server, and MUST NOT be presented as active Java-parity settings.
- **FR-026**: The OSC listener MUST NOT require or add an enable toggle, authentication, address allowlist, or project-level setting in this parity slice; the all-interface listener and trusted-network model MUST be documented for users.
- **FR-027**: The retired Java address `/blueLive/toggleMidiInput` MUST NOT be registered, recognized as a command, or alter MIDI runtime or device preferences when received.
- **FR-028**: Automated coverage MUST verify the settings order and Apply/Cancel/Reset behavior, preferred-versus-active port handling, consecutive port conflicts and range exhaustion, all eight supported command outcomes, explicit rejection of `/blueLive/toggleMidiInput`, prefix and case behavior, bundle ordering and timetag behavior, no-project no-ops, rapid lifecycle commands, malformed traffic, migration, and shutdown port release.

### Key Entities

- **OSC Server Preference**: The app-wide saved preferred inbound port, with Java-compatible default 8000 and valid range 1-65535.
- **OSC Listener Runtime**: The transient listener state, including starting, listening, restarting, stopped, and error status; preferred port; actual active port; and last bind or packet error.
- **OSC Command**: One of the eight supported case-sensitive Java Blue address prefixes and its score or Blue Live action.
- **OSC Packet**: An inbound message or bundle containing an address, ignored arguments, optional nested packets, and an ignored scheduling timetag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can find the OSC panel immediately after MIDI, identify the preferred and active ports, change the preferred port, and apply it in under one minute without restarting Blue.
- **SC-002**: With the preferred port occupied and the next port free, Blue begins listening on the next port and reports the fallback within two seconds in 100% of 20 repeated startup and settings-restart tests.
- **SC-003**: With three consecutive ports occupied, Blue selects the fourth port without overwriting the preference in 100% of 20 repeated tests.
- **SC-004**: Each of the eight supported Java Blue OSC addresses produces the specified state transition in 100% of command parity tests, including tests with ignored arguments and recognized address suffixes; `/blueLive/toggleMidiInput` produces no action in 100% of exclusion tests.
- **SC-005**: Under normal local-network conditions, 95% of valid commands begin their visible state transition within 250 milliseconds of packet receipt, excluding engine compilation or startup time.
- **SC-006**: Across 100 rapid play, stop, Blue Live on/off, and recompile sequences, no test creates duplicate playback or Blue Live sessions and the final state matches the processed command order.
- **SC-007**: Across malformed packets, unknown addresses, absent projects, bind failures, and range exhaustion, 100% of error-path tests leave the rest of Blue usable and report OSC listener state accurately.
- **SC-008**: App shutdown releases the active UDP port in 100% of 50 repeated shutdown tests, allowing a new listener to bind it immediately afterward.
- **SC-009**: Existing valid legacy input-port preferences migrate correctly, while unset/zero values become 8000 and unused output placeholders are not exposed as active functionality, in 100% of migration fixtures.

## Assumptions

- Java Blue's current `blue-osc` and `OSCActions` sources are the behavioral baseline for transport, routing, and the eight supported commands: one always-on IPv4 UDP server, default port 8000, all-interface binding, prefix address matching, immediate bundle dispatch, ignored arguments, and no replies.
- Java Blue currently registers a ninth address, `/blueLive/toggleMidiInput`, but the application has removed that MIDI runtime toggle. Excluding the address is an explicit product decision and the server treats it as unknown input.
- The upward port-conflict scan and omission of `/blueLive/toggleMidiInput` are the intentional Java Blue divergences in this slice; operational status display makes port fallback observable without expanding the command vocabulary.
- The saved port is a preferred starting port, while an automatically selected fallback is transient. Blue retries the preference only when the listener next starts or restarts, not immediately when a lower port becomes free.
- Java Blue exposes no OSC output workflow in this feature baseline. The current app's output host and output port fields are unused placeholders and do not expand this feature into outbound OSC.
- OSC commands do not authenticate senders. Because parity binds to all interfaces, users are expected to run Blue on a trusted network and manage host firewall access; authentication and allowlists require separate product direction.
- Command execution does not depend on OSC arguments, sender identity, or bundle timetags, and clients receive no OSC acknowledgment.
- Port fallback occurs only for address-in-use conflicts. Permission, network-stack, or other bind errors are reported rather than treated as evidence that the next port should be used.
- TCP OSC, IPv6-only listening, outbound messages, replies, user-defined OSC mappings, scheduled bundle execution, authentication, rate limiting, and remote project/file operations are outside this feature.

## Closeout Evidence

- Cross-artifact review found all 28 functional requirements covered by the 34 completed implementation tasks, with no constitution conflict or unresolved clarification.
- Java-source review reconfirmed the eight retained command paths, registration-order prefix matching, ignored arguments, score marker behavior, and Blue Live behavior. Upward port fallback and omission of `/blueLive/toggleMidiInput` remain the two intentional, documented product decisions.
- Focused OSC/settings/playback verification passed 77 tests across 8 files. The complete `@blue/app` suite passed 1,956 tests with 2 existing skips across 182 files.
- `pnpm test`, `pnpm --filter @blue/app build`, and `pnpm lint` passed on 2026-07-14.
- Hands-on acceptance confirmed that OSC commands are working well in the application. The exact latency target in SC-005 remains a regression target rather than a dedicated automated benchmark; no responsiveness issue was observed during acceptance.
