# Quickstart: Verify OSC Control Parity

## Prerequisites

- Node/pnpm dependencies installed for the monorepo.
- A development build of `@blue/app` with OSC support.
- A test `.blue` project with at least two score markers and Blue Live content.
- A trusted local network or loopback-only test environment. The parity listener binds all IPv4 interfaces and has no authentication.

## 1. Automated Verification

Run the focused OSC suites first, followed by the application and repository checks:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/shared/osc-control.test.ts \
  src/shared/program-settings.test.ts \
  src/main/osc-control-service.test.ts \
  src/main/program-settings-store.test.ts \
  src/preload/osc-control-api.test.ts \
  src/renderer/tests/osc-command-router.test.ts \
  src/renderer/tests/osc-settings.test.tsx \
  src/renderer/tests/playback-store.test.ts
pnpm --filter @blue/app test
pnpm --filter @blue/app build
pnpm test
pnpm lint
```

Expected results:

- settings migration/order/validation tests pass;
- listener tests cover consecutive conflicts, 65535 exhaustion, non-`EADDRINUSE` failure, restart races, malformed packets, and close/rebind;
- registry tests contain exactly eight supported commands and reject `/blueLive/toggleMidiInput`;
- renderer command tests prove ordered execution and fresh `/score/play` semantics;
- preload and shared IPC shapes pass type/build checks.

## 2. Default Listener And Settings

1. Start Blue with no saved OSC preference and no process holding UDP 8000.
2. Open Application Settings.
3. Confirm `OSC` is immediately after `MIDI` in the left navigation.
4. Select OSC and confirm:
   - preferred port is 8000;
   - state is Listening;
   - active port is 8000;
   - there are no output host/port or enable controls.
5. Cancel Settings and confirm the listener remains active.

## 3. Preferred-Port Apply, Cancel, And Reset

1. Enter a free valid port and choose Apply.
2. Confirm status transitions through restarting and reports the new active port without restarting Blue.
3. Enter a different valid port, choose Cancel, reopen Settings, and confirm the saved/listening port did not change.
4. Choose Reset Panel and confirm the preferred port immediately becomes 8000 and the listener restarts from 8000 or an upward fallback.
5. Try blank, fractional, nonnumeric, 0, and 65536 values. Confirm Apply is blocked and the live listener does not change.

## 4. Port Conflict Fallback

1. Hold the preferred UDP port open with a separate local process or a second Blue instance.
2. Start/reconfigure Blue with that port as its preference.
3. Confirm it binds the first higher free port within two seconds.
4. Open OSC Settings and confirm the preferred and active ports are both shown with a conflict/fallback explanation.
5. Release the preferred port. Confirm Blue stays on the fallback until the next restart/reconfigure.
6. Restart the listener and confirm it retries from the saved preference.
7. Repeat with three consecutive occupied ports and confirm the fourth is selected.
8. Test preferred port 65535 while occupied and confirm Blue reports Not Listening/Error rather than wrapping to port 1.

## 5. Score Command Parity

With the project loaded, send these case-sensitive messages to the reported active UDP port:

| Address | Expected result |
|---------|-----------------|
| `/score/play` | Start a fresh regular render from the current range; when already running, stop/restart it. |
| `/score/stop` | Stop regular playback only. |
| `/score/rewind` | Set render start to 0 and render end to open-ended. |
| `/score/markerNext` | Move to the first strictly later marker, otherwise a later score end, and follow in the view. |
| `/score/markerPrevious` | Move to the last strictly earlier marker, otherwise 0, and follow in the view. |

Also verify:

- arguments do not change behavior;
- `/score/play/alternate` invokes play because of Java-compatible prefix matching;
- `/Score/play` and unrelated paths do nothing;
- stop still works without a project, while the other score actions safely no-op without one.

## 6. Blue Live Command Parity

| Address | Expected result |
|---------|-----------------|
| `/blueLive/onOff` | Start Blue Live from the project when stopped; stop only Blue Live when running. |
| `/blueLive/recompile` | Stop if needed and start a fresh Blue Live session, including from stopped. |
| `/blueLive/allNotesOff` | Submit one all-notes-off event when Blue Live is active; otherwise no-op. |

Send `/blueLive/toggleMidiInput` before and during MIDI input. Confirm it is treated as unknown: MIDI availability, enabled-device preferences, connections, and held-note behavior do not change.

## 7. Bundles, Ordering, And Robustness

1. Send a bundle containing rewind, marker next, and play. Confirm the range changes are committed before playback and the commands run in bundle order.
2. Repeat with nested bundles and future/past timetags. Confirm processing remains immediate and ordered.
3. Send rapid play/stop and Blue Live toggle/recompile sequences. Confirm final state matches arrival order and no duplicate engine sessions appear.
4. Send malformed datagrams and unknown addresses. Confirm the listener stays active, valid later commands work, and Settings exposes a non-disruptive packet diagnostic.
5. Change the preferred port while traffic is arriving. Confirm commands are accepted only by the current socket generation and no command is duplicated.

## 8. Migration And Persistence

Verify fixtures or manual settings files for these cases:

- valid nonzero legacy `appSpecific.oscInputPort` seeds the structured preferred port;
- zero, missing, fractional, or out-of-range legacy input becomes 8000;
- existing OSC output host/port placeholders survive save/load but do not appear in OSC Settings;
- a transient fallback does not overwrite the preferred port across restart;
- saving a project before and after OSC configuration produces no OSC-related `.blue` XML change.

## 9. Shutdown And Exposure

1. Note the active UDP port and quit Blue while sending traffic.
2. Immediately bind another UDP process to that port. It must succeed.
3. Confirm no new score or Blue Live work begins after shutdown cleanup starts.
4. On a second trusted-network host, verify the reported port is reachable when firewall policy allows it.
5. Confirm documentation does not promise authentication, allowlisting, replies, or delivery guarantees.

## Acceptance Summary

Closeout completed on 2026-07-14. All eight commands match the contract, the retired MIDI-toggle address remains a no-op, upward conflict fallback is observable and transient, settings lifecycle behavior is covered, malformed traffic is non-fatal, rapid commands remain serialized, and shutdown releases the socket. Focused verification passed 77 tests across 8 files; the full application suite passed 1,956 tests with 2 existing skips across 182 files. The workspace test suite, application build, repository lint, and hands-on OSC command acceptance also passed.
