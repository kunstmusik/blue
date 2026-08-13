# Quickstart: Csound Runtime Services

This guide defines deterministic validation for feature 071. Run commands from the repository root.

## Prerequisites

- Node.js 22 and pnpm 10
- CMake 3.21+ and the existing Blue Engine native toolchain
- Java 17 for the full application build
- Optional Csound 7 for ready/discovery/utility/performance integration scenarios
- No physical audio or MIDI device is required; an empty device result is valid

## 1. Build the Native Engine

```bash
pnpm --filter @blue/engine-native build
```

Expected:

- The current-platform artifact under `native/blue-engine/dist/<platform>-<arch>` advertises `csound-io-v1`, `csound-utility-v1`, and `csound-performance-v1`.
- The engine remains runtime-linked to Csound rather than load-time linked.

## 2. Run Native Unit and Integration Tests

```bash
pnpm --filter @blue/engine-native test
```

Expected:

- Fake-ABI tests pass without Csound installed.
- Probe, capability, JSON escaping, empty/error device results, utility lifecycle, performance lifecycle, and cleanup tests pass.
- Csound-backed tests skip with code 77 when unavailable.

With Csound 7 installed, run the integration-labelled tests through the package's existing integration command or its generated CTest build directory.

Expected:

- `sndinfo` reports information for `examples/techniques/hellorcb.aif`.
- A minimal null-audio CSD completes.
- I/O discovery returns a valid schema whether device arrays are populated or empty.

## 3. Inspect Runtime Capabilities

```bash
native/blue-engine/dist/<platform>-<arch>/blue-engine --probe-csound --json
```

Expected with Csound 7:

- Exit `0`, ready Csound report, protocol `1`, and all three new feature strings.

Expected without Csound:

- Exit `2`, one valid JSON report, structured Csound failure, and no ZeroMQ/shared-memory service.

## 4. Query Modules Without Activating Every Backend

```bash
native/blue-engine/dist/<platform>-<arch>/blue-engine --list-io --json
```

Expected:

- Exactly one JSON document on stdout.
- Audio and MIDI module arrays contain exact runtime identifiers.
- Device arrays are empty because no module was selected.
- Backend diagnostics, if any, are on stderr and do not corrupt JSON.

Choose one returned audio or MIDI module and repeat with only that selection:

```bash
native/blue-engine/dist/<platform>-<arch>/blue-engine --list-io --json --audio-module <audio-module>
native/blue-engine/dist/<platform>-<arch>/blue-engine --list-io --json --midi-module <midi-module>
```

Expected:

- Only the selected kind is queried.
- Known module IDs use friendly labels while retaining their exact IDs, for example `PortAudio - Blocking (pa_bl)` or `CoreMIDI (coremidi)`; an unrecognized ID is shown unchanged.
- Fresh settings seed Csound's platform default first: `auhal` on macOS, `alsa` on Linux, `PortAudio` on Windows; MIDI uses `portmidi` except Linux `alsa`.
- Zero devices is successful.
- An unavailable module produces a scoped recoverable failure.

Do not use a script that loops over every module; some backends intentionally contact external services during enumeration.

## 5. Run a Csound Utility Through Blue Engine

```bash
native/blue-engine/dist/<platform>-<arch>/blue-engine \
  --run-utility sndinfo -- examples/techniques/hellorcb.aif
```

Expected:

- Exit `0`.
- Sound-file information is emitted through Csound's message stream.
- No Csound executable or shell is launched by Blue Engine.

Repeat with an unavailable utility name.

Expected: nonzero status and a specific unavailable-utility diagnostic; the next valid invocation still succeeds.

## 6. Validate Shared and Main Contracts

```bash
pnpm --filter @blue/engine-client test
pnpm --filter @blue/app test -- --run \
  src/shared/csound-runtime.test.ts \
  src/shared/engine-runtime.test.ts \
  src/main/engine-runtime.test.ts \
  src/shared/program-settings.test.ts \
  src/main/program-settings-store.test.ts
```

Expected:

- Strict decoders reject malformed/inconsistent reports.
- Missing capabilities fail before dispatch.
- Query deadlines, retries, bounded output, abort races, and process-start failures map to typed results.
- Synthetic Windows paths remain single native arguments.
- Program settings migrate from version 2 to 3 without losing legacy executable, render-method, module, or device values.

## 7. Validate Settings Discovery

```bash
pnpm --filter @blue/app test -- --run src/renderer/tests/engine-runtime-settings.test.tsx
```

Then start the application:

```bash
pnpm --filter @blue/app run dev
```

In Realtime Render settings:

1. Check Blue Engine and Csound.
2. Confirm module choices use exact runtime names.
3. Confirm the selected audio module loads its devices automatically.
4. Confirm the selected MIDI module loads its devices automatically.
5. Attach or detach an audio device and press Rescan Audio Devices.
6. Attach or detach a MIDI device and press Rescan MIDI Devices.
7. Choose a discovered identifier, then edit it to a custom value.
8. Edit a setting, use the native window close control, choose Cancel, and confirm the window remains open.
9. Repeat the close flow with No and confirm the draft is discarded, then repeat with Yes and confirm the draft is applied before closing.
10. Reopen settings and temporarily choose or enter an unavailable value, then change the corresponding module and confirm the saved value remains editable.

Expected:

- Only selected modules are queried, on initial load, when their module selection changes, or when the corresponding rescan button is pressed.
- Empty results, query failures, saved-unavailable values, and custom values have distinct statuses.
- Saved values remain editable and are not silently replaced.
- A close with unapplied edits presents Yes/No/Cancel; Cancel keeps the window open, No discards the draft, and Yes applies it before closing.
- The former Utility, Realtime, and Disk Csound executable controls and render-method choice are absent.
- The optional Csound library path is application-wide and empty means automatic discovery.

## 8. Validate Migrated Offline Workflows

Run focused regressions:

```bash
pnpm --filter @blue/app test -- --run \
  src/main/soundfont-viewer.test.ts \
  src/main/freeze-score-objects.test.ts \
  src/main/disk-render-command.test.ts \
  src/main/render-to-disk.test.ts
```

With a project and Csound 7 available, remove/clear any active direct Csound executable configuration and validate in this order:

1. Inspect a `.sf2` SoundFont.
2. Freeze and unfreeze one supported score object.
3. Render to disk and verify the audio output.
4. Cancel one longer freeze or disk render.
5. Retry the same operation after cancellation.

Expected:

- Every workflow uses the selected Blue Engine/Csound library and requires no Csound executable.
- SoundFont parsing, freeze metadata/format checks, render progress, output validation, cleanup, and retry behavior remain intact.
- Cancellation never reports an incomplete output as successful.

## 9. Validate Isolation

Start realtime playback or Blue Live, then exercise a separate engine-owned offline operation in a test fixture or supported UI flow.

Expected:

- Processes have distinct identities and lifecycle owners.
- Offline messages do not appear as realtime protocol responses.
- Cancelling the offline operation does not stop realtime/Blue Live.
- Stopping realtime/Blue Live does not cancel the offline operation.

## 10. Verify the Direct-Launch Boundary

```bash
rg -n "spawn\([^\n]*csound|csoundExecutable.*spawn|runCsound\(.*executable" \
  packages/blue-app/src native/blue-engine/src
```

Expected: no production direct Csound executable launch for disk render, freeze, SoundFont inspection, or utilities. External post-render play/open commands are unrelated and may still use the existing external-command path.

## 11. Final Repository Gates

```bash
pnpm test
pnpm lint
pnpm build
pnpm verify
git diff --check
```

Expected: all affected native, engine-client, main, preload, renderer, settings, and existing playback/render regressions pass. If a supported platform cannot provide Csound or hardware in CI, only the explicitly labelled installed-runtime check may skip; fake-ABI, schema, failure, and empty-list tests remain mandatory.

## Validation Record (2026-08-13, macOS arm64)

- Csound 7.0 was available at `/Library/Frameworks/CsoundLib64.framework/CsoundLib64`; the installed-runtime performance, I/O schema, and `sndinfo` path-with-spaces checks completed successfully.
- `pnpm --filter @blue/engine-native test` passed the 13 script checks and 9 non-Csound CTest/unit cases. The separately labelled native CTest integration suite passed 2/2 tests (`ChannelBridgeTests` and `CsoundIntegrationTests`); no Csound-unavailable skip was needed on this host.
- `pnpm test`, `pnpm --filter @blue/engine-client test`, `pnpm --filter @blue/app test`, `pnpm lint`, `pnpm build`, `pnpm verify`, and `git diff --check` passed. The full app suite reported 308 files passing, 2 skipped tests, and 2,815 passing tests (2,817 total).
- Settings UI and packaged/dev verification were exercised through the renderer suite; manual UI hardware selection remains dependent on the host's available Csound backends and devices. Empty device arrays were accepted as a valid result.
