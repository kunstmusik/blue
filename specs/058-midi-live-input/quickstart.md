# Quickstart And Validation: MIDI Device Input And Blue Live Routing

## Purpose

Use this guide while implementing and accepting the feature. It validates the risky Web MIDI/Electron boundary first, then the Settings lifecycle, automatic connection behavior, Blue Live mapping parity, and cleanup requirements.

## Prerequisites

- A development machine able to run the Electron app.
- One class-compliant MIDI keyboard/controller that can send note-on/note-off on a chosen channel.
- For multi-device/partial-failure checks, a second physical or virtual MIDI input.
- A `.blue` project with at least one arrangement instrument and Blue Live configured to run.
- A project MIDI mapping whose pitch or velocity result is easy to identify.

Do not request SysEx permission. The feature must use `navigator.requestMIDIAccess({ sysex: false })`.

Electron 35 reports that ordinary request to its permission request handler under the `midiSysex` label. Both Electron MIDI labels are therefore accepted only for the trusted primary renderer; the returned `MIDIAccess.sysexEnabled` value must remain `false`.

## 1. Establish The Automated Baseline

From the repository root:

```bash
pnpm --filter @blue/app test
pnpm --filter @blue/app build
```

During implementation, focused tests may be run with:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/program-settings-store.test.ts
pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/midi-input-coordinator.test.ts
pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/renderer/tests/midi-input-service.test.ts src/renderer/tests/midi-note-router.test.ts
```

Expected result: existing tests remain green, the new settings/runtime contracts compile in main, preload, and renderer targets, and no native MIDI dependency is added. The completion run recorded below satisfies this gate.

## 2. Prove The Electron Web MIDI Boundary First

Before building the full Settings UI, use the thin transport service to verify:

1. Start the development app with `pnpm --filter @blue/app dev`.
2. Confirm the primary renderer receives non-SysEx MIDI permission.
3. Confirm Settings and any secondary/pop-out renderer cannot directly obtain MIDI permission.
4. Enumerate the attached input and record its ID, name, manufacturer, version, state, and connection.
5. Open the port, receive note-on and note-off, then close it.
6. Unplug and reconnect the device; confirm the access `statechange` path reports both transitions.
7. Build and run the production-mode Electron output:

```bash
pnpm --filter @blue/app build
pnpm --filter @blue/app start
```

8. Repeat permission, enumeration, note receive, close, unplug, and reconnect checks in the production build. Repeat against a packaged release artifact when the project’s distribution pipeline is available.

Pass gate: Web MIDI works in development and production-mode output on the target platform. If a required platform fails, stop broad UI work, record the evidence in `research.md`, and implement a transport adapter behind the same shared contract rather than changing Settings or note routing.

Recorded proof: a separate Electron 35.7.5 macOS smoke probe exercised the permission handlers, enumerated the attached `MidiKeys` input, and returned `sysexEnabled: false`. The production bundles compile; production-runtime, packaged-artifact, Windows, and Linux hardware execution remain release-environment checks in the matrix below.

## 3. Validate App-Wide Settings And Automatic Connection

1. Open application Settings and select `MIDI`.
2. Confirm each attached input appears once with distinguishing details.
3. Press `Rescan`; confirm the list/status updates within two seconds without duplicate rows or listeners.
4. Confirm newly discovered devices are enabled automatically and transition through connecting to connected without a Blue Live toolbar action.
5. Confirm an enabled device can be used immediately without pressing `Apply`.
6. Disable it and press `Apply`; confirm the port closes and only that device changes.
7. Enable it again, apply, exit Blue, and restart.
8. Confirm the enabled preference is retained and the available device reconnects automatically.
9. Exit, detach the enabled device, restart, and confirm the remembered row remains visible as unavailable.
10. Reattach it and confirm automatic reconnect through host detection or `Rescan`.

Pass gate: the applied per-device preference is the only user capture control. The Blue Live toolbar contains no `MIDI Input` button. The existing project MIDI Input workbench panel remains independently accessible.

## 4. Validate Hardware And Virtual Keyboard Parity

1. In the project MIDI Input panel, configure a non-default pitch mapping and a velocity mapping.
2. Assign instruments to at least two arrangement channels.
3. Start Blue Live.
4. From hardware, send a note-on and matching note-off on channel 1.
5. Confirm the generated Blue Live score event uses the channel-1 instrument and the project pitch/velocity mapping.
6. Repeat on channel 2 and confirm the channel-2 assignment is used.
7. Send note-on with velocity zero and confirm it follows the note-off path.
8. Configure the Virtual Keyboard to the same channel/note/velocity and play the equivalent note.
9. Compare submitted score text or test-observed mapped values.
10. Send on an unmapped channel and confirm a non-disruptive diagnostic with no wrong-instrument trigger.

Pass gate: identical channel, note, velocity, and project state produce equivalent mapping and note lifecycle for hardware and Virtual Keyboard input.

## 5. Validate Cleanup And Idempotency

For each scenario, hold a note before performing the action and confirm no sounding or internally tracked note remains afterward:

- Disable and apply the source device.
- Physically disconnect the source device.
- Stop Blue Live.
- Change projects.
- Exit the app.
- Rescan repeatedly while connected.
- Disconnect and reconnect repeatedly.
- Exercise a development React Strict Mode mount/unmount/mount cycle.

Then hold the same channel/note from two sources. Disconnect one source and confirm the aggregate note remains active until the other source releases it.

Pass gate: listeners never multiply, late messages from stale port generations are ignored, and 100 cleanup cycles leave zero stuck notes.

Recorded proof: the automated lifecycle suite completes 100 repeated note-on/global-cleanup cycles with both held-note ledgers empty after every cycle. Separate service tests cover repeated rescans, source release on port-generation replacement, and stale callback rejection.

## 6. Validate Multiple Devices And Partial Failure

1. Enable and apply two inputs.
2. Confirm both can route notes concurrently and remain separately identifiable.
3. Force one input to fail or disappear while the other remains connected.
4. Confirm the overall phase becomes partial, the failed row explains its error/unavailability, and the working device remains playable.
5. Return the failed device and rescan if needed; confirm it reconnects without disturbing the working device.

Pass gate: one failing device never cancels discovery, connection, or note routing for another.

## 7. Final Verification

Run the repository-wide commands required by project guidance:

```bash
pnpm test
pnpm lint
pnpm build
```

Recorded results and explicit limitations:

| Target | Development | Production build | Packaged artifact | Permission | Hot-plug | Notes | Cleanup |
|---|---|---|---|---|---|---|---|
| macOS | PASS — user-reported core app smoke | PASS — bundles compile; runtime not executed | Not available | PASS — Electron 35.7.5 smoke, `MidiKeys`, non-SysEx | PASS automated; manual cycle not itemized | PASS — user-reported Blue Live flow | PASS automated, including 100 cycles |
| Windows | Not executed | Cross-build not executed | Not available | Not executed | PASS automated only | Not executed | PASS automated only |
| Linux | Not executed | Cross-build not executed | Not available | Not executed | PASS automated only | Not executed | PASS automated only |

Any required target without a packaged-artifact pipeline should be recorded as an infrastructure limitation, not silently marked as passed.

### Timing evidence

- Fake-port rescan and lifecycle updates complete in the same reconciliation turn in automated tests; the macOS development smoke presented updates interactively with no reported delay. A hardware-instrumented two-second/one-second sample was not captured in this workspace run.
- Hardware and Virtual Keyboard notes enter the same `MidiNoteRouter` and use the same renderer-to-main Blue Live IPC, so hardware adds only byte decoding before the shared route. The user reported no perceptible latency in development testing, but a quantitative 95th-percentile hardware trace for SC-006 remains a release-performance measurement rather than a claimed result.

### Completion run

- Focused MIDI, permission, Settings, toolbar, Virtual Keyboard, Blue Live parity, lifecycle, coordinator, BSB runtime-channel, and ScorePanel regression tests: **18 files passed; 173 tests passed; 2 skipped**.
- `pnpm test`: **PASS** across all workspace test packages. The app suite reports **177 files passed; 1,922 tests passed; 2 skipped**.
- `pnpm lint`: **PASS**.
- `pnpm build`: **PASS** for workspace packages plus app main, preload, and renderer production targets. Vite retains the existing large-chunk advisory; no native MIDI dependency was added.
