# Research: Complete Stereo Mixer Panning

**Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

## 1. Scope, defaults, and compatibility

**Decision**: Keep Spec 112 Balance as the default for stereo, mixed, and unknown sources. A verified mono-only source remains Mono Pan regardless of its stored stereo mode. Add Mixer-owned 0/−3/−4.5/−6 dB law and Off-center boost, default −3/off. The law applies to Mono Pan and each source-side panner in Stereo Pan or Dual Pan; Balance does not read it.

**Rationale**: No new values appear in existing Blue/Java scores. An enabled Spec 112 project therefore keeps its existing sound. Project ownership makes renders reproducible across installations. Logic Pro offers a project law; REAPER has a project default with per-track override. The local survey is [MIXER_PANNING.md](../../.tmp-research/MIXER_PANNING.md); implementation precedence is Spec 112's [audio-routing contract](../112-mono-clip-panning/contracts/audio-routing.md).

**Alternatives considered**: Change all stereo channels to true stereo (audible legacy regression); add per-channel law overrides (more controls and persistence with no demonstrated need); machine preference (mix changes by installation); apply law to Balance (changes its neutral center).

## 2. Continuous gain curves

**Decision**: For a source-side pan position `p∈[0,1]`, use left gain `f(1−p)` and right gain `f(p)`. Let `E(q)=sin(πq/2)`, `G(q)=q`, and `B(q)=min(1,2q)`. Select:

| Center depth | `f(q)` | Center gain per side |
| --- | --- | --- |
| 0 dB | `B(q)` | 1 |
| −3 dB | `E(q)` | `1/√2` (−3.0103 dB) |
| −4.5 dB | `(1−t)E(q)+tG(q)`, with `t=(1/√2−10^(−4.5/20))/(1/√2−1/2)` | `10^(−4.5/20)` |
| −6 dB | `G(q)` | 0.5 (−6.0206 dB) |

All are continuous, symmetric, nonnegative, and have 0/1 endpoint gains. The named −3 and −6 values are the established rounded labels for exact equal-power/equal-gain centers. Off-center boost multiplies each leg's two gains by `1+(10^(|depth|/20)−1)·2|p−0.5|`: center unchanged, selected endpoint boosted, 0 dB unchanged. It is called **Off-center boost**, not Logic's **Compensated** (which raises center too). Use the exact Spec 112 cosine/sine expressions for default mono pan; compare numeric and generated-audio output across the entire range.

**Rationale**: Reusing Spec 112's sinusoidal branch prevents a default-sound regression. A continuous 0 dB branch avoids a discontinuous endpoint; −4.5 dB is calibrated at center without another taper setting. The math is small enough to evaluate in both static and automated CSD generation. Floating output tests must compare both paths.

**Alternatives considered**: One variable exponent curve (0 dB endpoint singularity); Ardour's generalized quadratic (can exceed unity in the unboosted 0 dB case); independent taper selection (unrequested complexity). See [audio-panning contract](contracts/audio-panning.md).

## 3. Stereo modes and mixed-content levels

**Decision**: Stereo Pan stores shared position `c` (the existing `Channel.pan`) and width `w∈[0,1]`. Effective spread is `d=w·min(c,1−c)`; pan the original left input at `c−d` and right input at `c+d` using the selected law. Dual Pan stores independent left/right source positions, default `(0,1)`, and applies the same law per source. Sum the two panned contributions into the stereo outputs. Balance keeps Spec 112's separate-side attenuation unchanged.

**Rationale**: `(c,w)=(0.5,1)` passes the stereo pair through at boost off, `w=0` co-locates the two sides, and `c=0/1` reaches a hard endpoint while retaining the saved Width for later. A 2×2 gain matrix handles stereo and mixed buses without special routing. Dual Pan also permits crossed and coincident positions. The UI should show Width narrowing effectively near endpoints while retaining the saved slider value.

**Alternatives considered**: Fixed spread around center with clamping (hard pan may leave one side in the opposite speaker); Mid/Side rotation (different effect semantics); independent per-clip panners (changes upstream clip model).

**Level caveat**: Spec 112 upmixes mono clips to `(x/√2,x/√2)`. Folding both buses to one side can yield `√2 x` (+3.01 dB) for that mono component. Two correlated original stereo sides can also sum. Automatic normalization would change the level of unrelated stereo material, so leave fader/peak management to the composer. The behavior remains documented in the audio contract; a dedicated MixerPanSlider disclosure was explicitly rejected as unnecessary UI.

## 4. Persistence and edit ownership

**Decision**: Add Mixer attributes `panningEnabled`, `panLawDb`, and `panOffCenterBoost`; use exact allowed law values and boolean validation. Add channel mode `balance|stereoPan|dualPan`, Width, and dual Left/Right positions, with defaults Balance, 1, 0, 1. Reuse `Channel.pan` for Balance and Stereo Pan Position. Register Width and dual positions as three new channel Parameters for automation; mode and Mixer law/boost remain nonautomatable settings. Give each Parameter a distinct stable name and identity. XML loading must dispatch known names explicitly so unknown parameters are not mistaken for Volume. Preserve mode-specific values on switches and use no duplicate presence fields.

**Rationale**: This extends the existing Mixer attributes, Channel XML and Parameter model, and typed project patch path. It avoids parallel renderer-owned state. Existing Pan automation keeps meaning in Balance and becomes shared Position in Stereo Pan. Independently automated dual sides are possible without a new automation framework.

**Alternatives considered**: One parameter with mode-dependent meaning for all controls (automation ambiguity); separate Balance and Stereo Position values (duplicate position state and switch surprises); automating the mode or Mixer law (discrete crossfade/automation contract beyond user request); storing raw XML values for unreleased TypeScript fields (constitution discourages this).

## 5. Runtime and CSD integration

**Decision**: Extend the existing `csd-policy.ts` pan stage after post-effects/sends and before gate/meter/output. Use one shared coefficient model for static and automated output. The enabled stereo stage calculates Balance or a 2×2 true-stereo matrix. Runtime channel bindings for the Mixer law/boost and channel mode are generation-scoped; the main process sends validated updates through the existing engine client. Width and Dual positions use the existing Parameter catalog/binding/sync/automation path. Mixer drag previews extend the existing revision- and generation-fenced preview adapter and restore canonical values on cancellation. Law/boost/mode commits are canonical history edits and reconcile all active performances without restarting score events when the compiled panner is compatible. A changed panning-enabled flag or layout may still use Spec 112's safe recompile path.

**Rationale**: The mode selects gains within the same two-bus graph, so a mode change need not rebuild routing. The engine already supports channel updates and Mixer/channel reconciliation. Disk renders use canonical fixed/automated values with the same equations; no ephemeral preview reaches XML or export.

**Alternatives considered**: Recompile on every law or mode edit (transport disruption); renderer-side audio state (split ownership); speculative panner plugin architecture (one in-repo implementation is sufficient). See [project-runtime contract](contracts/project-runtime.md).

## 6. Verification boundary

**Decision**: Test the numerical 2×2 coefficient matrix with left-only, right-only, correlated, and mixed-mono/stereo fixtures at center, intermediate values, endpoints, all laws, and boost states. Compare static CSD and automated/live output, including timeline and BlueLive when available. Cover Java/Spec 112 XML defaults, invalid values, unknown data, snapshot/patch rejection, one commit→undo→redo per writer, preview cancel, runtime failures, and accessible UI. Use the [quickstart](quickstart.md) for actual engine and manual checks.

**Rationale**: Text-only CSD assertions cannot prove channel isolation, fold-down gain, or parity between static and automated branches. The existing Spec 111 physical latency and Windows acceptance gaps are not resolved by this plan; new validation should reuse those setups where available and record prerequisites honestly.

**Alternatives considered**: Unit math checks alone (miss integration); broad snapshot tests alone (miss audible behavior); treating protocol acknowledgment as physical latency proof (insufficient).
