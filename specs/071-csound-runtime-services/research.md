# Research: Csound Runtime Services

**Feature**: `071-csound-runtime-services`
**Date**: 2026-08-13
**Outcome**: All technical unknowns resolved; ready for implementation

## Executive Decision

Use Blue Engine as the only supported host for Blue-owned Csound operations. Add additive one-shot modes for selected-module I/O discovery, direct utility execution, and general argument-driven offline performance. Electron main resolves and spawns those modes through the existing `EngineRuntimeService`; the realtime and Blue Live ZeroMQ loop is not extended with blocking commands.

The implementation must include both utility and performance execution. `csoundRunUtility()` is the correct host API behind the user-visible `-U` concept, but current bypasses—disk rendering, score-object freezing, and SoundFont inspection—compile and perform CSDs rather than run Csound utilities. Only adding a utility call would leave every known bypass in place.

## Current-State Findings

### Direct Csound Bypasses

The main process currently constructs one injectable `createCsoundExecutionSeam()` that calls Node `spawn(executable, args)`. Its production callers are:

- disk rendering through `render-to-disk.ts`, using `diskRender.csoundExecutable` from `DiskCommandPlan`;
- score-object freezing through `freeze-score-objects.ts`, using `utility.csoundExecutable`; and
- SoundFont inspection through `soundfont-viewer.ts`, using `utility.csoundExecutable` to perform a generated CSD containing `sfload`, `sfilist`, and `sfplist`.

Realtime playback and Blue Live instead use separately spawned Blue Engine processes over ZeroMQ. The existing split means different workflows can resolve different Csound installations and contradict the bundled-engine ownership model.

`realtimeRender.csoundExecutable` is presented and recorded as used in the settings usage matrix, but `buildRealtimeEngineOptions()` never reads it. It is already a stale compatibility field. `renderMethod` is persisted for realtime and disk settings but has no active selector or routing behavior.

### Existing Blue Engine Boundary

Blue Engine already has a successful one-shot pattern:

```text
blue-engine --probe-csound --json [--csound-library <absolute-path>]
```

It resolves the runtime-loaded library, prints one strict compatibility document, exits before binding ZeroMQ/shared memory, and is invoked by Electron main with a deadline and bounded output. This is the correct pattern to extend for settings discovery and offline execution.

The native loader currently exposes lifecycle, option, orchestra compilation, performance, and channel symbols. It does not expose general command-line compilation, module/device discovery, utility execution, utility listing, or message-buffer symbols. Its local `csoundReset_t` incorrectly returns `int`; the installed Csound 7 header declares `void csoundReset(CSOUND*)`.

## Java-First Comparison

### Device Discovery

Java Blue's `blue-settings/src/main/java/blue/settings/DriverUtilities.java` does not have one uniform device API. For several modules it invokes Csound with deliberately invalid device identifiers such as `dac999`, `adc999`, or MIDI device `999`, captures messages through the selected disk render service, and parses the resulting text. ALSA, PulseAudio, and JACK include platform-specific alternatives such as `/proc/asound` and `jack_lsp`.

`RealtimeRenderSettingsPanel` asks the selected realtime render-service factory for a disk service, queries the chosen driver only when the user presses its button, and stores the exact returned identifier in an editable field. The important compatibility behavior is therefore:

- query only the selected backend;
- retain exact device identifiers;
- keep fields editable; and
- do not destroy saved values merely because discovery currently fails.

Direct Csound API enumeration provides the same observable behavior without parsing backend-specific errors, so it is an intentional implementation divergence rather than a behavior regression.

### Render Services

Java Blue has two genuine adapter families:

- `CS6RealtimeRenderServiceFactory` / `CS6DiskRenderServiceFactory`: Csound API;
- `CommandlineRealtimeRenderServiceFactory` / `CommandlineDiskRenderServiceFactory`: direct executable.

`CS6DiskRendererService` calls the equivalent of compile, start, perform, reset and captures Csound messages. The Java render-method selection exists because those are two independently implemented services.

Blue Electron's accepted direction is different: Blue Engine is already the supported runtime boundary. Recreating a selector after consolidating all work behind the engine would expose a choice with only one real adapter. The plan therefore records a deliberate divergence: no render-method selector and no supported direct-Csound fallback after migration.

## Csound 7 Host API Findings

### Utility Execution

Csound's manual describes `-U` as the command-line utility selector. The host API exposes `csoundRunUtility(CSOUND*, name, argc, argv)` directly, requires reset afterward, and returns zero on success. See the [Csound utility manual](https://csound.com/manual/utility/top/) and [miscellaneous host API](https://csound.com/docs/api/group__MISCELLANEOUS.html).

The installed Csound 7 runtime was exercised directly with `sndinfo` and `examples/techniques/hellorcb.aif`. `csoundRunUtility()` returned success and its report was available through the Csound message buffer. Therefore the engine should invoke this API directly, construct `argv[0]` as the utility name, and never synthesize `-U` or invoke the Csound executable.

`csoundListUtilities()` and `csoundDeleteUtilityList()` allow the host to reject an unavailable utility before running it. `csoundGetUtilityDescription()` may be loaded for diagnostics but no utility-browser UI is required in this feature.

### General Offline Performance

The installed Csound 7 header defines this sequence for argument-driven input:

1. `csoundCompile(csound, argc, argv)`;
2. `csoundStart(csound)`;
3. call `csoundPerformKsmps(csound)` until it reports completion;
4. `csoundReset(csound)`.

The engine must internally prepend a conventional `argv[0]` value such as `csound`; caller arguments remain distinct. This is the native equivalent of Java's API-backed disk renderer and supports the existing disk/freeze/SoundFont CSD workflows without reinterpreting their option arrays.

### Module and Device Discovery

The Csound API provides:

- `csoundGetModule()` to enumerate exact module names and `audio`/`midi` types;
- `csoundSetRTAudioModule()` and `csoundSetMIDIModule()` to select one backend;
- `csoundGetAudioDevList()` for input/output audio devices; and
- `csoundGetMIDIDevList()` for input/output MIDI devices.

The list calls use a count-then-fill contract. Zero is a valid empty list; negative is failure. The audio structure contains `device_name`, `device_id`, `rt_module`, `max_nchnls`, and direction. The MIDI structure contains `device_name`, `interface_name`, `device_id`, `midi_module`, and direction. See the official [realtime audio API](https://csound.com/docs/api/group__RTAUDIOIO.html), [realtime MIDI API](https://csound.com/docs/api/group__RTMIDI.html), and [Csound development header](https://github.com/csound/csound/blob/develop/include/csound.h).

The locally installed runtime reported audio modules including `jack`, `pa_bl`, `pa_cb`, and `auhal`, plus MIDI modules including `portmidi` and `coremidi`. Csound's `Top/csound.c` initializes audio to `auhal` on macOS, `alsa` on Linux, and `PortAudio` on Windows/other desktop platforms; MIDI defaults to `portmidi` except on Linux, where it uses `alsa`. Its source also identifies `pulse`, `rtpw`, and `wasapi` audio backends, `alsaraw`/`alsaseq`/`devfile` MIDI backends, and Windows Multimedia (`mme`/`winmm`) aliases where those builds expose them. These names do not always match Java-style display choices such as `CoreAudio` or `PortMidi`; the settings UI therefore uses a small source-derived friendly-label map (for example `CoreAudio (auhal)` and `PulseAudio (pulse)`) while exact runtime names remain canonical and unknown/custom values remain editable. The map labels discovered values only; it never invents a module that the active runtime did not report.

Querying all modules is unsafe as a default. Selecting JACK caused connection warnings in the local shell, while both API enumeration and `csound --devices` legitimately returned no devices in that environment. The settings workflow must enumerate module names, then query only the selected module on initial load, when that module selection changes, or when its manual rescan is requested. Integration tests must validate schema and error semantics without assuming physical hardware.

### Message Capture

Csound's message buffer API avoids a cross-platform variadic callback ABI:

- create the buffer after `csoundCreate()` with direct output disabled;
- drain pending strings during/after the operation;
- destroy the buffer before destroying the instance.

Discovery must reserve stdout for one JSON document and route drained diagnostics to stderr. Execution modes route drained Csound messages to stderr, which preserves current disk-render progress parsing and SoundFont output parsing. Electron streams every chunk to the existing output surface but retains only a bounded diagnostic for the terminal result.

## Decisions

### 1. One-Shot Modes Instead of ZMQ Commands

**Decision**: Add one-shot CLI modes and keep the realtime ZMQ protocol unchanged.

**Rationale**: The current ZeroMQ request loop processes one request at a time. A synchronous utility or offline render would block STOP, shutdown, and other control requests. Making long jobs safe over ZMQ would require job IDs, a worker/process pool, an event stream, and cancellation protocol. A one-shot child already supplies process isolation, stdout/stderr streaming, exit status, timeout, and operating-system cancellation.

**Alternatives considered**:

- **Generic ZMQ `EXECUTE` command**: rejected because it blocks the request loop or requires a much larger asynchronous job protocol.
- **Device discovery over ZMQ only**: rejected because settings has no long-lived engine daemon to query; it would still need to spawn and connect an engine process.
- **Direct Csound subprocesses in Electron**: rejected because it preserves the split runtime selection and bypasses Blue Engine.

### 2. Additive Features Without Protocol Bump

**Decision**: Advertise `csound-io-v1`, `csound-utility-v1`, and `csound-performance-v1` while retaining engine protocol version 1.

**Rationale**: The running ZMQ command set and framing do not change. One-shot operations can probe the established capability document and fail when a required feature is absent. This lets an older external engine remain usable for compatible realtime behavior while producing a precise failure for new services.

**Alternative considered**: Bump the whole engine protocol. Rejected because it would unnecessarily make unchanged realtime clients and engines incompatible.

### 3. One Deep Main Runtime Seam

**Decision**: Deepen `EngineRuntimeService` rather than add separate probe, discovery, utility, and performance resolvers.

**Rationale**: All services require the same engine selection precedence, artifact validation, Csound library override, feature negotiation, path rules, timeout/diagnostic mapping, and retry behavior. Keeping those policies behind one module produces a smaller caller interface and prevents selection drift.

**Alternative considered**: Separate `DeviceService`, `UtilityService`, and `RenderService` classes. Rejected because each would be a shallow wrapper that duplicated or leaked engine resolution.

### 4. Narrow Renderer Boundary

**Decision**: Expose typed I/O discovery through preload; keep utility/performance execution internal to Electron main.

**Rationale**: Settings needs device data. Existing trusted main workflows need execution. A renderer-accessible arbitrary utility/argument API would unnecessarily widen the security boundary and make browser code responsible for process semantics.

### 5. Preserve Legacy Settings but Stop Consuming Them

**Decision**: Add `appSpecific.csoundLibraryPath`, retain old executable/render-method properties for migration/downgrade safety, hide them in active settings UI, and mark them retained/inactive in the usage matrix.

**Rationale**: The engine path plus optional Csound shared-library path are the only runtime selectors after consolidation. Removing legacy keys immediately risks lossy rewrites and poor downgrade behavior. Continuing to consume them would preserve the bypass.

### 6. Migration Order

**Decision**: Migrate SoundFont inspection, then freeze, then disk render.

**Rationale**: SoundFont inspection is short and has no persistent output; it validates message capture and general CSD execution. Freeze adds output cleanup and metadata validation. Disk render is the highest-risk path because it carries progress, dialogs, cancellation, output validation, and post-render actions.

### 7. No New Dependency

**Decision**: Continue local ABI declarations and the existing manual JSON style.

**Rationale**: Blue Engine deliberately builds without Csound headers and runtime-links the library. The new structures and function signatures are small and can be checked against Csound 7 with compile-time layout assertions where possible and integration tests. Adding a JSON or Csound development dependency would complicate the established native build and packaging boundary without meaningful value.

## Resolved Risks

- **ABI drift**: Correct `csoundReset`; copy exact fixed-size device structures and integer widths from Csound 7; cover fake ABI behavior and installed-runtime integration.
- **JSON corruption**: Disable direct message output for JSON modes; stdout contains exactly one document; diagnostics use stderr.
- **Hardware-dependent tests**: Assert module/report shape and zero/error semantics, never a particular device count.
- **Backend side effects**: Query selected modules only on page load, module changes, or explicit rescans; do not probe every backend.
- **Argument injection/path loss**: Use `execFile`/`spawn` with `shell: false`; keep each option/path as its own argument; test Windows separators, spaces, quotes, and Unicode.
- **Cancellation races**: Use operation identity plus an operation-owned abort signal; successful callers still validate the expected artifact after process completion.
- **Unbounded messages**: Stream output immediately and cap retained terminal diagnostics while preserving SoundFont's bounded parse input.
- **Old external engine**: Require feature strings before dispatch and return a structured missing-capability result.
- **Project corruption**: No project mutation occurs in discovery. Existing freeze/disk staging and artifact checks remain authoritative; runtime failures do not enter `.blue` XML.

## No Remaining Clarifications

The accepted investigation fixes the main product choice: Blue Engine/Csound API is the only supported method, while old direct-executable values are compatibility data rather than an active fallback. No unresolved design marker remains.
