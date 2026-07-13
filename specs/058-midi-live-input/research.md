# Research And Architecture Proposal: MIDI Device Input And Blue Live Routing

## Recommendation

Use a hybrid Electron boundary:

- The primary application renderer owns physical MIDI discovery, port open/close operations, device state listeners, and normalization of hardware messages through the Web MIDI API.
- Electron main owns the trusted MIDI permission policy, durable app-wide preferences, settings-window coordination, Blue Live engine access, and final project-aware note submission.
- The Virtual Keyboard and physical devices feed the same application note-routing surface so channel, note, velocity, project mapping, error handling, and held-note cleanup do not diverge.

This is a renderer-owned transport with main-process authority around permissions, persistence, and the audio engine. It avoids a new native MIDI addon and aligns physical input with the already implemented Virtual Keyboard route.

## Java Blue Findings

### Device manager and settings

Java Blue’s `MidiInputManager` is an app singleton. Its effective behavior is:

- Enumerate every MIDI device with a transmitter and retain zero or more enabled input devices.
- Persist each device’s enabled preference app-wide using a composite of description, name, vendor, and version.
- Separate the durable per-device `enabled` flag from the transient global `running` flag.
- On `start()`, open all enabled devices and attach the manager as their receiver.
- On `stop()`, close every device.
- On `rescan()`, reuse matching device objects when possible, rediscover new inputs, reload enabled preferences, and open enabled devices immediately if the manager is already running.
- Broadcast incoming messages to registered receivers.

Java’s MIDI options page presents `Enabled`, `Device Name`, and `Description` columns plus `Rescan`. Toggling a row saves immediately and opens or closes that device if capture is running.

Sources:

- `/Users/stevenyi/work/nbprojects/blue/blue-midi/src/main/java/blue/midi/MidiInputManager.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-midi/src/main/java/blue/midi/BlueMidiDevice.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-midi/src/main/java/blue/midi/MidiInputTableModel.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-midi/src/main/java/blue/midi/MidiPanel.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-midi/src/main/java/blue/midi/MidiOptionsPanelController.java`

### Blue Live toolbar behavior

Java’s `MIDI Input` toolbar button is a capture toggle. Selecting it calls `MidiInputManager.start()`; clearing it calls `stop()`. It does not open the project MIDI processing panel.

Source:

- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/blueLive/BlueLiveToolBar.java`

### Live note routing

`MidiInputEngine` is registered as a receiver at application startup. For each note message it:

1. Reads the zero-based MIDI channel.
2. Selects the arrangement assignment at that channel index.
3. Applies the current project’s `MidiInputProcessor` mapping.
4. Formats the Java-compatible indefinite note-on or note-off score event.
5. Sends that score text to the running Blue Live engine.

Note-on with velocity zero is treated as note-off. Channels without an arrangement entry are ignored.

Sources:

- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/midi/MidiInputEngine.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/midi/MidiInputProcessor.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/Installer.java`

### Virtual Keyboard alignment

The Java Virtual Keyboard does not bypass the MIDI system. Mouse and computer-key actions construct MIDI note messages and send them into the same `MidiInputManager` broadcast path used by hardware. Its channel, octave, velocity, velocity override, and All Notes Off controls are UI state, while the project processor still performs pitch and amplitude mapping downstream.

Sources:

- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/midi/VirtualKeyboardTopComponent.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/midi/VirtualKeyboardPanel.java`

## TypeScript Blue Current State

Spec 033 already delivered more of the note path than the toolbar suggests:

| Area | Current state | Gap for this feature |
|---|---|---|
| Project MIDI processing | Implemented in `@blue/data`, project snapshots/patches, and `MidiInputPanelTopComponent` | Keep unchanged; clarify that it is project mapping, not device selection |
| Virtual Keyboard | Implemented with mouse/computer input, channel/octave/velocity controls, and Blue Live note IPC | Feed it through the same application route used by hardware and extend source identity as needed |
| Blue Live note mapping | Implemented in main using canonical project data and `mapMidiTrigger()` | Reuse for hardware events; do not duplicate mapping in a device layer |
| Physical input discovery | Not implemented | Add discovery, rescan, open/close, hot-plug state, and message listeners |
| App-wide MIDI settings | Current program Settings has no MIDI panel; an older `MidiSettings.tsx` is orphaned and edits legacy renderer placeholders | Add a real program-settings MIDI category and migrate legacy placeholder values |
| Toolbar `MIDI Input` | Opens `MidiInputPanelTopComponent` | Remove the button; enabled devices connect automatically |
| Electron permission | Current session handlers grant only `local-fonts`, which denies Web MIDI | Permit non-SysEx MIDI only for trusted app content |

Primary TypeScript sources:

- `/Users/stevenyi/work/blue-electron/specs/033-midi-input-virtual-keyboard-parity/`
- `/Users/stevenyi/work/blue-electron/packages/blue-data/src/midi/midi-input-processor.ts`
- `/Users/stevenyi/work/blue-electron/packages/blue-data/src/midi/midi-trigger-routing.ts`
- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/blue-live-engine.ts`
- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/program-settings.ts`
- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-store.ts`
- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/menu-bar/ToolbarBlueLive.tsx`
- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`
- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/MidiSettings.tsx`
- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/MidiInputPanel.tsx`
- `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/VirtualKeyboardPanel.tsx`

## Process Ownership Evaluation

### Main-only native MIDI

Advantages:

- One process naturally owns app-lifetime device connections.
- Hardware events are already next to the Blue Live engine session.

Costs:

- Electron main does not expose the Web MIDI API; this direction requires a native Node MIDI dependency or a separate helper.
- A native addon adds platform packaging, Electron ABI rebuild, signing, and CI burden.
- UI consumers would require main-to-renderer fan-out, while the Virtual Keyboard currently travels renderer-to-main.
- Hardware and Virtual Keyboard input would begin in different routing systems and could drift.

### Renderer-only Web MIDI

Advantages:

- Electron’s Chromium runtime exposes the standard MIDI permission and device model in renderer contexts.
- `MIDIAccess.inputs` provides input enumeration, `statechange` reports hot-plug/state updates, and each port exposes stable ID plus name/manufacturer/version and open/close state.
- No additional native dependency is needed.
- Hardware notes can enter the same normalized route as the Virtual Keyboard.

Costs:

- App-wide preferences and the Blue Live engine are already main-owned.
- The Settings window is a separate renderer and must not become the lifetime owner of device ports.
- Permission policy must be explicitly granted in Electron main and restricted to trusted app content.

### Chosen hybrid

Run one long-lived MIDI input service in the primary application renderer, independent of any workbench panel or the Settings child window. Main remains the coordinator and authority for everything outside raw browser device access.

```text
Physical MIDI device ----\
                          > renderer MIDI service -> normalized note route -> main Blue Live note handler -> engine
Virtual Keyboard --------/

Settings child window -> main settings/status IPC -> primary renderer MIDI service
Electron permission policy ------------------------^
```

Responsibilities:

| Concern | Owner |
|---|---|
| MIDI permission allow/deny policy | Electron main |
| Durable enabled-device preferences and migration | Electron main program settings |
| Device enumeration, port lifecycle, hot-plug listeners | Primary app renderer MIDI service |
| Runtime device status presented in multiple windows | Main-coordinated snapshots/events |
| Normalized note-source routing | Primary app renderer service |
| Project MIDI processor and arrangement lookup | Existing main-owned canonical project/Blue Live path |
| Virtual Keyboard visual interaction state | Virtual Keyboard renderer panel |
| Blue Live engine score submission | Electron main |

Official platform evidence:

- Electron documents `midi` as the permission for Web MIDI and requires both permission check and request handling for complete policy: <https://www.electronjs.org/docs/latest/api/session>
- The Web MIDI specification defines device enumeration, stable port IDs, input maps, `statechange`, port state/connection, and open/close operations: <https://www.w3.org/TR/webmidi/>

## Resolved Planning Decisions

### Decision 1: Remove the global MIDI capture control

**Decision**: Remove `MIDI Input` from the Blue Live toolbar. Treat the saved per-device `enabled` preference as the only user-controlled input lifecycle state. Newly discovered devices default to enabled; an explicit disabled preference remains authoritative. Enabled and available devices open automatically after discovery, Settings changes, and application startup.

**Rationale**: A second global switch creates an unclear “enabled but inactive” state, duplicates lifecycle logic, and incorrectly makes app-wide hardware access appear owned by Blue Live. Users can release a device explicitly by disabling that device in Settings. Blue Live start/stop continues to determine whether notes have an engine consumer, not whether ports are open.

**Alternatives considered**:

- Preserve Java’s global `running` toolbar toggle: rejected because the extra state has no required TypeScript consumer and was the source of the current misleading control.
- Keep the toolbar button as a Settings shortcut: rejected because Settings already has a normal app-wide entry and the project MIDI mapping panel remains available through the workbench/window flow.
- Open every discovered device without a per-device opt-out: rejected because users still need an explicit way to avoid device conflicts and release hardware to other applications.

### Decision 2: Use Web MIDI in the primary renderer

**Decision**: Implement the physical transport with one injected, testable Web MIDI service hosted for the lifetime of the primary application renderer.

**Rationale**: Electron 35’s Chromium DOM types and runtime provide the required input enumeration, stable port identity, port lifecycle, and hot-plug events. This avoids native addon ABI, packaging, signing, and CI costs. The primary renderer is long lived; the Settings child renderer is not and therefore must not own connections.

**Alternatives considered**:

- Native Node MIDI in Electron main: retained only as a fallback if the development/packaged proof-of-concept fails on a required platform.
- Device ownership in the Settings window: rejected because closing Settings would terminate the service and duplicate it on reopen.
- One Web MIDI service per renderer: rejected because it risks duplicate port listeners and duplicate events.

### Decision 3: Keep authority and coordination in main

**Decision**: Electron main owns permission policy, program-settings persistence, cached runtime snapshots, command/status relay, and final Blue Live submission. The primary renderer owns only browser MIDI access and normalization.

**Rationale**: This keeps the canonical settings and project/engine boundaries already used by Blue. Only plain serializable data crosses IPC. The Settings window can rescan and observe status without touching a raw `MIDIAccess` or `MIDIInput` object.

**Alternatives considered**:

- Persist settings in renderer local storage: rejected because program settings are already main-owned and must be shared across windows.
- Move project mapping into the renderer: rejected because canonical project data and the Blue Live engine already reside in main.

### Decision 4: Grant only trusted non-SysEx access

**Decision**: Extend both Electron permission check and request handlers to allow Electron's `midi` and `midiSysex` labels only for the trusted primary application `webContents` and its current application location. Continue existing `local-fonts` behavior. The renderer must request `navigator.requestMIDIAccess({ sysex: false })` and reject any returned access object whose `sysexEnabled` value is true.

**Rationale**: Web MIDI requires explicit Electron permission handling. Electron 35 reports an ordinary `{ sysex: false }` request to the request handler under the `midiSysex` permission label and does not expose the original option in the callback details. Binding both labels to the known primary renderer and its current app location follows Electron/WebMidi.js guidance while the renderer request and runtime assertion keep actual SysEx disabled.

**Alternatives considered**:

- Allow MIDI for every application window: rejected because only the designated service owner needs direct access.
- Request actual SysEx access (`sysex: true`): rejected as out of scope and unnecessary.

### Decision 5: Persist identity records, not runtime port state

**Decision**: Add a versioned `midiInput` program-settings section containing remembered device identity/display metadata and its enabled preference. Preserve missing enabled devices. Runtime availability, connection, error, and service phase remain transient.

**Rationale**: The host port ID is the strongest supplied identity; retained manufacturer/name/version fields support display and conservative fallback matching. Persisting runtime connection state would become stale and conflate intent with observation.

**Alternatives considered**:

- Reuse the single legacy `appSpecific.midiInputDevice` string: rejected because it cannot represent multiple devices or stable identity.
- Persist only an array of host IDs: rejected because unavailable devices would have no useful label and identity recovery would be harder.
- Persist connection states: rejected because they are session-specific observations.

### Decision 6: Apply device changes through the existing Settings transaction

**Decision**: MIDI enablement edits participate in the existing Settings draft and `Apply`/`OK` lifecycle. Once saved, main broadcasts the new preferences and the primary renderer reconciles only affected ports immediately. `Rescan` remains a live command and does not require Apply.

**Rationale**: This preserves the established Settings interaction model and prevents MIDI-specific writes from racing with a stale full program-settings draft. “Always enabled” means an applied enabled preference stays active across Blue Live state and app restarts, not that unsaved checkbox edits mutate hardware.

**Alternatives considered**:

- Persist each checkbox immediately like Java: rejected for this slice because the current Settings window saves whole snapshots and a separate live write could be overwritten by later Apply.
- Defer reconciliation until restart: rejected because live setup and hot-plug recovery require immediate post-save behavior.

### Decision 7: Normalize hardware and virtual events before main submission

**Decision**: Add a single renderer note router used by the Web MIDI service and Virtual Keyboard. It normalizes note-on velocity zero, supplies source metadata, maintains a source-scoped held-note ledger, and forwards the existing Blue Live trigger request.

**Rationale**: One ingress path makes hardware and Virtual Keyboard mapping parity testable while preserving main-owned arrangement and `MidiInputProcessor` logic. Source-scoped bookkeeping allows disconnecting one device without clearing another source’s notes.

**Alternatives considered**:

- Send hardware events directly to a new main handler: rejected because it duplicates the Virtual Keyboard path and normalization.
- Apply project mapping in the renderer: rejected because it would duplicate canonical main state and introduce synchronization risk.

### Decision 8: Prove runtime support before adding a fallback

**Decision**: Start implementation with a thin development and packaged Web MIDI proof-of-concept covering permission, enumeration, open, input, close, unplug, and reconnect. Keep shared settings/routing contracts transport-neutral.

**Rationale**: Web MIDI is the lowest-complexity architecture, but Electron permission and packaged behavior must be measured on release targets. Transport-neutral contracts make a later native adapter surgical if evidence requires it.

**Alternatives considered**:

- Add Web MIDI and native transports together: rejected because it doubles lifecycle and packaging work before a fallback is shown necessary.

## Proposed Runtime Model

### Device identity and persistence

Persist a structured enabled-device preference rather than a single display-name string. Prefer the host-provided stable port ID and retain manufacturer, name, and version as display and fallback reconciliation data. This is stronger than Java’s concatenated descriptor key while preserving the same intent.

Remember enabled devices that are absent. A rescan merges current ports with remembered preferences instead of replacing the preference list. Two devices with the same name remain distinguishable by identity.

### Connection lifecycle

Deliberately simplify Java’s two-level model. Keep one user-controlled concept:

- `enabled`: durable user intent per device.

There is no global capture toggle. When preferences load, Blue automatically opens every enabled and available input; a newly discovered device with no saved preference is also treated as enabled. Enabling a device opens it; disabling and applying the explicit preference closes it and detaches its message handler. State changes and manual rescan both reconcile the runtime. Blue Live start and stop do not own device connections; they only determine whether normalized notes have a live engine consumer.

Service outcomes are `idle`, `requestingAccess`, `discovering`, `ready`, `partial`, `unsupported`, `denied`, and `error`. Device states distinguish `unavailable`, `available`, `connecting`, `connected`, `disconnecting`, `closed`, and `error`.

This intentionally diverges from Java’s toolbar `running` flag. The benefit is one source of truth: the Settings `Enabled` preference. Users who need to release a device for another application can disable that device directly.

### Shared note route

Introduce one app-level normalized note action containing:

- event kind (`noteOn` or `noteOff`)
- source kind (`hardware`, `mouse`, or `computer`)
- optional device identity
- MIDI channel
- MIDI note
- velocity
- source timestamp

Hardware note-on with velocity zero is normalized to note-off before routing. Hardware and Virtual Keyboard actions then use the existing main-process Blue Live trigger path, where canonical arrangement and `MidiInputProcessor` state are available.

The first required consumer is Blue Live. The normalized route should permit additional consumers later, but this spec does not implement controller mapping, recording, SCO Pad, or a general MIDI-learn system.

### Held-note safety

Track held notes by source identity, channel, and note. Source-specific disable or disconnect releases that source’s notes. Blue Live stop, project switch, and app exit invoke deterministic global cleanup. Listener setup must be idempotent so rescan and reconnect cannot double-submit notes.

### Settings placement and migration

Add `MIDI` to the current program Settings panel order. This category owns controller input device selection and live connection state.

Do not merge it with:

- `Realtime Render` MIDI driver, `-M`, or `-Q` settings, which configure Csound runtime I/O.
- `MidiInputPanelTopComponent`, which edits the current project’s pitch, tuning, scale, and velocity conversion.

Migrate or preserve the legacy `appSpecific.midiInputDevice` placeholder. Keep unrelated legacy `midiOutputDevice` data intact even though MIDI output is outside this feature.

## Scope Boundaries

Included:

- Input device discovery, rescan, selection, durable enablement, automatic connection, connection status, hot-plug handling, permission/error reporting, and multi-device input.
- Removal of the Blue Live `MIDI Input` toolbar button.
- Note-on/note-off routing to Blue Live through the same mapping path as the Virtual Keyboard.
- Held-note cleanup and safe partial failure.

Deferred:

- MIDI output.
- System Exclusive.
- Control Change, pitch bend, aftertouch, program change, MIDI clock/transport, and controller mapping.
- MIDI learn, recording, SCO Pad capture, and project automation mapping.
- Replacing the existing Csound realtime-render MIDI device options.
- A native main-process MIDI addon unless Web MIDI fails a targeted platform proof-of-concept.

## Planning Risk To Validate First

Before broad implementation, run a packaged and development-mode proof-of-concept on the supported target platforms that verifies:

1. trusted app origins can receive non-SysEx MIDI permission under the current Electron session policy;
2. the primary renderer can enumerate, open, receive from, close, unplug, and reconnect an input;
3. the same behavior works in packaged output, not only the development server; and
4. app-added event latency remains comparable to the Virtual Keyboard route.

If that proof fails on a required platform, retain the same public settings and routing contracts but move only the device transport behind a main-process native adapter.

## Implementation Validation Evidence

Evidence recorded on 2026-07-13:

- A separate Electron 35.7.5 macOS smoke probe exercised the installed permission handlers and `navigator.requestMIDIAccess({ sysex: false })`, enumerated the attached `MidiKeys` input, and confirmed `MIDIAccess.sysexEnabled === false`.
- User-reported manual testing in the development app confirmed the core MIDI Settings/device connection and Blue Live performance path after the permission and default-enable fixes.
- Injected Web MIDI tests cover enumeration, default-enabled first-use note delivery, explicit disable, duplicate display names with stable IDs, repeated rescans without multiplied delivery, hot-plug/replacement generation safety, per-device failure isolation, and source cleanup.
- Main/preload/renderer production bundles compile successfully with no native MIDI package. A production-runtime launch, packaged artifact, Windows, and Linux hardware pass were not available in this workspace session and remain explicitly identified in the validation matrix rather than treated as passed.

The recorded evidence supports retaining the Web MIDI architecture. No native transport fallback is warranted by the observed macOS/Electron behavior.
