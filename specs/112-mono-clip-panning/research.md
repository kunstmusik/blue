# Research: Mono Clip Panning Compatibility

## Decision 1: Compatibility switch

- **Decision**: Store `panningEnabled` on `Score`; constructor default true, absent/invalid XML and missing score element false.
- **Rationale**: `Score` already owns score behavior flags. `score.ts` uses this pattern for `trackLayerMuteSoloMode`; `xml-policy.ts` handles missing score explicitly. Java Blue has no pan property, so omission must retain old audio.
- **Alternatives considered**: App-wide setting (wrong lifetime); inferred enablement from pan XML (unreliable); separate raw/presence shadow state (unnecessary for TS-only extension).

## Decision 2: Channel value and automation

- **Decision**: Preserve the existing `Channel.pan` convention of `0..1` with center `0.5`, serialize it, and add a separate pan `Parameter` with the same range. Register it in both project parameter catalogs.
- **Rationale**: `Channel` already stores and deep-copies pan but does not serialize it. Existing project-editor snapshots, mixer patches, history labels, and runtime sync have pan seams; `runtime-parameter-sync.ts` currently probes for a missing `getPanParameter()`. A separate Parameter follows existing automation and runtime machinery.
- **Alternatives considered**: New scalar-only runtime IPC (duplicates Parameter machinery); reuse volume Parameter (conflates unrelated controls); a signed range (would change existing default and snapshot convention).
- **Validation**: Reject nonfinite/out-of-range patch and automation inputs; XML fallback to center. Resolve XML Parameter identity by known name/identifier, retain volume-only Java documents, and preserve unrecognized data according to existing XML policy.

## Decision 3: Actual layout authority

- **Decision**: Main performs compile-time file layout preflight using real audio headers and passes a disposable typed layout manifest to the portable CSD generator. Csound playback still branches on `filenchnls` for execution-time truth. Cached `AudioClip.numChannels` is never the routing authority.
- **Rationale**: TS `AudioClip.setAudioFile` does not probe the file; the current playback template already uses `filenchnls`. The CSD mixer needs a known channel layout to choose mono pan versus balance before it generates one channel instrument. `@blue/data` cannot read files under the constitution.
- **Alternatives considered**: Trust clip metadata (stale/missing); infer layout from left/right bus at audio rate (cannot distinguish a right-silent stereo source); put filesystem reads in `@blue/data` (violates core boundary).
- **Integration pattern**: Reuse the host's audio-file metadata parser/service where possible. Deduplicate native file paths per compile; never serialize the manifest. Keep Java fixture path handling and Csound text escaping at their existing boundary.

## Decision 4: Mono, stereo, and mixed DSP

- **Decision**: Enabled stereo playback upmixes each mono clip with `1/sqrt(2)` to both buses before mixing; stereo files keep L/R. A channel verified as exclusively mono clips, with no stereo-generating effect before the pan stage, gets equal-power Mono Pan; any stereo, mixed, or unknown source gets Stereo Balance. See [audio-routing.md](contracts/audio-routing.md).
- **Rationale**: Current `playback-instrument-orc.ts` writes mono only to left and silently drops files above two channels. Existing mixer buses carry `nchnls` indexed signals, without a source-format marker. The mixed-track default must protect the stereo image. The pan stage explicitly normalizes the already-upmixed mono feed to avoid a center/endpoint gain jump.
- **Alternatives considered**: `pan2` on L+R after upmix (doubles mono); always balance (fails all-mono pan law); per-clip panner (outside scope).

## Decision 5: Processing and runtime

- **Decision**: Insert the channel pan/balance stage after post effects and their send taps, before output gate, meter, and parent route. Keep disabled code generation unchanged. Score toggle and topology/layout changes reconcile by CSD recompile; stable pan Parameter edits use runtime parameter sync.
- **Rationale**: `csd-policy.ts` currently orders source/sub channels as pre effects → level → post effects → gate → meter → route. Sends execute inside effects chains. This placement leaves sends' current feed points alone and makes output meters reflect pan/balance.
- **Alternatives considered**: Pan before effects/sends (alters send feeds); pan after meter (meter differs from audible channel output); unconditional engine restart on every knob move (breaks automation).
- **Runtime caveat**: Check the current reconciliation classifier when implementing; a score toggle must be classified as structural, and a pan edit must only be treated as live when a registered pan Parameter exists.

## Decision 6: Unsupported layouts

- **Decision**: With enabled panning, mono project output is a valid one-channel route without pan. Output above stereo, input above stereo, and unreadable input produce typed, recoverable diagnostics before audio starts. Preserve XML and source metadata.
- **Rationale**: The current playback template's `else` emits no sound for >2 channels. A silent success violates the feature contract.
- **Alternatives considered**: Truncate to stereo; infer speaker mapping; let Csound silently ignore channels.

## Java reference and evidence

- Java `blue-core` mixer `Channel.java` has no pan field. Java audio playback resource branches on mono/stereo like the TS template and sends mono only to the first output.
- Local survey `.tmp-research/MIXER_PANNING.md` supports equal-power mono pan and stereo balance. Its claim that pan is already registered as a runtime `gk` variable is premature: current runtime sync only probes for a `getPanParameter` method that `Channel` lacks.
- Primary TS seams: `packages/blue-data/src/score/score.ts`, `score/audio/playback-instrument-orc.ts`, `score/track/track-audio-playback.ts`, `mixer/channel.ts`, `blue-data/csd-policy.ts`, `automation/project-parameter-catalog.ts`; `packages/blue-app/src/main/project-runtime-reconciliation.ts`, `runtime-parameter-sync.ts`, and `shared/project-editor/`.
