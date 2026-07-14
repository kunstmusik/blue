# Phase 0 Research: OSC Control Parity

## Scope Audit

Java Blue's OSC implementation was reviewed in `blue-osc` and `blue-ui-core`, then compared with the current Electron settings, playback, score-navigation, Blue Live, preload, and shutdown paths.

The Java baseline has these behaviors that must be deliberately retained:

- an app-lifetime IPv4 UDP server bound on all interfaces, with default input port 8000;
- command registration in a fixed order and first-prefix address matching via `startsWith`;
- ignored OSC arguments;
- recursive bundle traversal in packet order, with bundle timetags treated as immediate;
- no OSC reply or outbound command channel;
- fresh regular playback for `/score/play`, regular-only stop, strict marker comparisons, score-end/zero fallbacks, and open-ended rewind;
- Blue Live toggle, stop-and-start recompile, and all-notes-off only while the live engine is active.

The current Java source also registers `/blueLive/toggleMidiInput`. The product has removed that application action, so this feature intentionally excludes the address. It is absent from the registry and must remain an unknown no-op with no effect on MIDI devices, held notes, or preferences.

## Decision 1: Main-Process UDP Ownership

**Decision**: Own one OSC listener in the Electron main process and start it independently of project and Settings windows.

**Rationale**: The main process already owns app lifecycle, program settings, engine bridges, and Node networking. It can keep the listener alive when Settings is closed, distribute status to multiple windows, and close the socket before engine/app teardown. Renderer ownership would tie network availability to a window and require elevated Node access in renderer code.

**Alternatives considered**:

- **Renderer/WebSocket or browser UDP**: rejected because Chromium renderers do not provide the required raw UDP server and a renderer can reload or disappear.
- **Separate helper process**: rejected because eight lightweight commands do not justify another process boundary or protocol.

## Decision 2: Node `dgram` Plus `node-osc` Codec

**Decision**: Use Node's built-in `dgram` socket for bind/restart/shutdown control and `node-osc` 11.6.x for OSC decoding and test encoding. Use static imports.

**Rationale**: `dgram` exposes the exact socket error code needed to distinguish `EADDRINUSE`, supports explicit `udp4`/`0.0.0.0` binding, and allows precise teardown and retry coordination. `node-osc` is a maintained, zero-runtime-dependency, TypeScript-declared OSC implementation supporting messages and bundles; using its codec avoids writing a binary OSC parser while retaining lifecycle control. Its current supported Node versions include the Node generation bundled by Electron 35.

**Alternatives considered**:

- **`node-osc` Server lifecycle directly**: viable, but its high-level event interface gives less control over candidate-port retry, malformed packet diagnostics, and socket injection for race tests.
- **`osc`/osc.js**: broader cross-environment transport support is unnecessary here and brings additional dependency and Electron-native transport considerations.
- **`osc-min` or a custom parser**: a smaller codec surface, but older typing/maintenance or custom binary parsing would increase test and maintenance cost without product benefit.

**Primary source**: [node-osc repository and documentation](https://github.com/MylesBorins/node-osc)

## Decision 3: Structured Preference With Legacy Migration

**Decision**: Add a top-level `osc` settings section containing `preferredPort`, default 8000, and bump the program-settings schema version. On first normalization of older data, use `appSpecific.oscInputPort` only when it is an integer from 1 through 65535; otherwise use 8000. Preserve the legacy input and output placeholder fields under `appSpecific` for downgrade safety, but do not expose output settings in the new panel.

**Rationale**: MIDI already establishes a structured settings pattern. Separating the durable preference from runtime status prevents an automatically selected fallback from overwriting user intent. Keeping legacy fields avoids destructive migration and satisfies the existing compatibility model.

**Alternatives considered**:

- **Continue editing `appSpecific.oscInputPort` directly**: rejected because it conflates an unused placeholder with a supported settings contract and makes future versioning unclear.
- **Persist the fallback port**: rejected because the user requested next-available behavior, not an implicit preference change.

## Decision 4: Explicit Listener State Machine

**Decision**: Model listener phases as `stopped`, `starting`, `listening`, `restarting`, and `error`, with preferred port, nullable active port, nullable fallback origin, last bind error, last packet diagnostic, a monotonically increasing revision, and update time.

Bind candidates begin at the preferred port. Only `EADDRINUSE` advances the candidate by one; 65535 is attempted once and never wraps. Any other bind error ends the attempt in `error`. A chosen fallback remains active until an explicit restart. Restarts and shutdowns are serialized and guarded by a generation token so obsolete socket callbacks cannot publish status or commands.

**Rationale**: A visible state machine makes Settings accurate during rapid Apply/Reset/shutdown races and gives tests observable invariants. The generation guard prevents an old socket's delayed events from corrupting the active listener.

**Alternatives considered**:

- **Probe ports before binding**: rejected because availability can change between probe and bind; the bind operation itself is authoritative.
- **Retry every bind failure**: rejected because permission and network-stack errors are actionable failures, not evidence that the next port is appropriate.

## Decision 5: Decode, Flatten, Then Dispatch Ordered Events

**Decision**: Decode each datagram once, recursively visit bundle elements in array order, ignore timetags and arguments, and emit one command event per recognized address. Match commands case-sensitively against the fixed registry in registration order and invoke only the first address prefix. Malformed datagrams update a non-fatal diagnostic and do not close the listener.

**Rationale**: This directly captures Java Blue behavior, including suffix matches such as `/score/play/alternate`, nested bundles, and immediate timetag handling. A registry of exactly eight commands also makes the retired MIDI-toggle exclusion auditable.

**Alternatives considered**:

- **Exact address matching**: rejected because it would break Java prefix parity.
- **Schedule future bundle timetags**: rejected because Java dispatches immediately.
- **Send acknowledgments**: rejected because Java has no reply contract and UDP clients must not depend on one.

## Decision 6: Main-to-Primary-Renderer Command Events

**Decision**: The main service publishes serializable command events to the primary renderer. A single renderer hook owns the subscription and passes events through a promise chain before invoking existing project, playback, and Blue Live actions.

**Rationale**: Score marker/rewind behavior and visible playback state already live in renderer stores, while Blue Live calls are exposed through preload. Reusing those paths preserves canonical project patches, score scrolling, and visible lifecycle/error behavior. A single consumer avoids duplicate execution if Settings or auxiliary windows subscribe only to status.

**Alternatives considered**:

- **Execute every command directly in main**: rejected because it would duplicate renderer-owned marker navigation, scroll coordination, pending patch flushing, and playback UI state.
- **Allow every renderer window to subscribe**: rejected because one UDP packet could execute more than once.

## Decision 7: Explicit Fresh-Play Operation

**Decision**: Add an explicit regular-playback action for OSC `/score/play` that flushes pending project patches and starts a fresh render, stopping/restarting regular playback if necessary. Do not simulate the Java behavior by calling the existing UI toggle multiple times.

**Rationale**: The current toggle is state-dependent and overlapping calls can race. A named fresh-play operation can coordinate the main-process start promise, regular-engine stop, renderer anchor/state updates, and errors as one deterministic transition. `/score/stop` continues to target only regular playback.

**Alternatives considered**:

- **Reuse toggle verbatim**: rejected because `/score/play` means start/restart, never toggle-to-stopped.
- **Send stop then toggle as independent IPC calls**: rejected because another command could interleave and produce the wrong final state.

## Decision 8: Settings Status Is Read-Only Runtime Data

**Decision**: The OSC panel edits only the preferred port. It obtains an initial listener snapshot through preload and subscribes to subsequent snapshots. Apply and the existing immediate Reset Panel behavior trigger main-process reconfiguration after persistence; Cancel changes neither the file nor listener.

**Rationale**: Preferred and active ports have different lifetimes. Keeping status out of the settings draft prevents Cancel from rolling back live telemetry and makes fallback/error state visible without storing it.

**Alternatives considered**:

- **Store active port in settings**: rejected because fallback is transient.
- **Add enable, host, output, or authentication controls**: rejected because they are outside Java parity and the approved scope.

## Decision 9: Trusted-Network Security Boundary

**Decision**: Match Java by binding all IPv4 interfaces without authentication or an allowlist, and document that users should operate on trusted networks and use host firewalls for exposure control.

**Rationale**: Localhost-only binding would not support external controllers, while designing authentication would create a new, incompatible protocol. Commands remain limited to transport/navigation and Blue Live lifecycle; malformed and unknown input is isolated.

## Decision 10: Test With Injected And Real UDP Paths

**Decision**: Unit-test bind and lifecycle logic through injected socket/decoder factories, contract-test shared IPC/settings normalization, renderer-test ordered command execution, and add a small real-loopback UDP integration suite for message/bundle decoding and port release.

**Rationale**: Injection makes rare errors and stale-event races deterministic; real UDP catches integration gaps in the codec and OS socket lifecycle. The suite explicitly verifies eight commands and proves `/blueLive/toggleMidiInput` is unrecognized.

## Resolved Questions

All technical unknowns needed for planning are resolved. No `NEEDS CLARIFICATION` markers remain.
