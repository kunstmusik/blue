# Plan: Deduplicate Generated Mixer Panning Code

## Recommendation

Use one generated Csound orchestra macro for the repeated **dynamic source-leg gain calculation** and invoke it from Mono Pan, Stereo Pan, and Dual Pan generation. Do not introduce a user-defined opcode for this change.

Csound macros are textual replacements performed before orchestra compilation. They shorten and centralize the emitted CSD while preserving the current inline runtime operations. A UDO is a separately invoked opcode block, so it adds a runtime call/interface without reducing the required gain math. The macro therefore addresses generated-source duplication, not CPU usage; any performance claim must be verified rather than inferred from CSD size.

Keep the macro deliberately narrow. The surrounding Balance branch, Stereo Pan effective-position calculation, 2x2 matrix, signal routing, send taps, gates, and meters remain visible in `instr BlueMixer`.

## Current code-generation findings

- `packages/blue-data/src/blue-data/csd-policy.ts` owns all mixer panner CSD generation.
- `emitDynamicSourceLegGainLines()` emits the repeated law selector, optional off-center boost, and left/right gains.
- `emitDynamicPanGains()` calls that block twice for true-stereo modes; `emitDynamicStereoModePanLines()` repeats it in each generated channel's live mode branch; live Mono Pan emits it once per eligible channel.
- `applyChannelPan()` is shared by source channels, subchannels, and Master, so the same block can appear many times in one `BlueMixer` instrument.
- Static, non-automated values already use TypeScript-side coefficient calculation and omit identity operations. That specialization should remain; replacing it with a generic runtime macro would add work.
- Java Blue has no equivalent pan-law or true-stereo panner. Its mixer generator is relevant for routing order only; this optimization remains an intentional TypeScript-only extension.

## Design

### Generated interface

Add a private generator constant/helper that emits one collision-resistant macro definition before `instr BlueMixer`, conceptually:

```csound
#define BLUE_MIXER_CALC_PAN_GAINS(POS' LEFT' RIGHT' LAW' BOOST) #
  ...assign $LEFT and $RIGHT from $POS and $LAW...
  ...apply optional boost from $BOOST...
#
```

The final name and argument spelling should follow Csound's alphanumeric macro-name rules and apostrophe-separated argument syntax. Prefer predefined `$M_PI_2` only if the supported Csound versions compile it identically; otherwise retain the existing numeric literal to avoid compatibility and fixture churn.

The macro's interface is five expressions/variables:

1. source position,
2. left output variable,
3. right output variable,
4. pan-law expression,
5. boost expression.

It must not own signal routing, mode selection, width calculation, the 2x2 matrix, or global state. This keeps the module deep enough to remove the duplicated coefficient implementation while leaving mixer topology local and inspectable.

### Emission policy

- Emit the definition exactly once, immediately before `instr BlueMixer`, only when Mixer panning is enabled, output is stereo, and at least one generated path uses dynamic source-leg gains.
- Replace `emitDynamicSourceLegGainLines()` output with one macro invocation at each existing call site.
- Preserve current variable names and sequential reuse of scratch variables so downstream matrix lines and diagnostics remain recognizable.
- Keep static fixed-value coefficient generation in TypeScript through `getMonoPanGains()`, `getStereoPanGains()`, and `getDualPanGains()`.
- Keep Balance inline because it is short, law-independent, and semantically distinct.
- Do not add a generic macro registry, macro AST, new file, dependency, persisted field, runtime binding, or public interface.

## Implementation phases

### 1. Characterize the baseline

- Add a focused fixture with multiple mono, Stereo Pan, and Dual Pan channels plus a subchannel and Master.
- Record counts of the repeated law selector, boost block, macro definition, and macro calls in the generated `BlueMixer` text.
- Retain the existing coefficient and routing-order assertions as the behavioral baseline.

### 2. Introduce the narrow macro seam

- In `packages/blue-data/src/blue-data/csd-policy.ts`, add the macro-definition emitter beside the existing panner emitters.
- Have `generateMixerOrchestra()`/`generateBlueMixer()` include the definition in orchestra order before its first use.
- Change only `emitDynamicSourceLegGainLines()` to emit a macro call; leave its TypeScript interface in place so callers and tests do not learn Csound macro syntax.
- Add a predicate or returned usage flag only if necessary to avoid unused definitions. Prefer deriving this from the same channel/layout data already available over introducing a second panner classification path.

### 3. Update focused tests

- Update `packages/blue-data/src/blue-data/mono-clip-panning.test.ts` to assert one definition, expected call counts, and no repeated inline law/boost bodies inside `instr BlueMixer`.
- Continue asserting Mono Pan scaling, Balance no-crossfeed, Stereo/Dual matrix assignments, endpoint narrowing, sends-before-pan, pan-before-gate/meter/routing, disabled panning, mono output, and bypass behavior.
- Add/adjust determinism coverage in `packages/blue-data/src/blue-data-csd-determinism.test.ts` so macro placement and invocation order are stable.
- Avoid brittle full-text snapshots; assert the macro interface and semantic ordering.

### 4. Compile and audio-verify

- Run the generated CSD through the repository's available Csound CLI integration path to catch preprocessor syntax, argument substitution, and definition-order failures. Skip with the existing explicit `hasCsound` convention only when Csound is unavailable.
- Compare rendered samples before and after for representative Mono Pan, Stereo Pan, and Dual Pan cases across all laws and boost states. Require the existing numeric tolerance; for the default -3 dB/off path, preserve established parity expectations.
- Generate realtime, asynchronous realtime, BlueLive, and disk CSDs and confirm each compiles and contains one definition when needed.

### 5. Measure the actual outcome

- Compare generated CSD byte/line counts for the multi-channel fixture and report the reduction.
- Measure Csound orchestra compile time and render CPU only as non-regression checks. Expect runtime performance to be effectively unchanged because macros expand before compilation.
- If profiling unexpectedly shows macro-expanded compilation is still the dominant problem, stop and reassess; a UDO should be considered only with a measured benefit and an audio-parity benchmark that includes its call overhead.

## Acceptance criteria

- The generated orchestra contains at most one mixer source-leg macro definition and uses it for every dynamic source-leg coefficient calculation.
- The repeated law-selection and boost implementation has one TypeScript source and one generated macro body, with no parallel Csound formula copies.
- Fixed/static channels retain compile-time specialization and identity-operation elision.
- Balance, panning-disabled, mixer-bypassed, mono-output, sends, gates, meters, subchannels, Master, automation, and live mode switching retain current behavior.
- Generated CSD is deterministic and compiles on the project's supported Csound runtime.
- Rendered output matches the pre-change fixture within existing tolerances; no CPU regression is observed in the representative mixer benchmark.
- No project model, XML, history, IPC, UI, engine protocol, or Java compatibility surface changes.

## Validation commands

```text
pnpm --filter @blue/data test -- mono-clip-panning
pnpm --filter @blue/data test -- blue-data-csd-determinism
pnpm --filter @blue/data test
pnpm lint
git diff --check
```

Run the focused Csound compile/render check on a host with the supported `csound` executable and record its version and result.

## Risks and guardrails

- **Macro substitution is purely textual.** Parenthesize substituted expressions and test nontrivial position/law arguments.
- **Generated names share a global preprocessor namespace.** Use a Blue-specific name and emit it once.
- **A macro can hide topology.** Keep it limited to coefficient calculation; never absorb sends, gates, meters, routing, or mode branches.
- **Tests currently inspect inline formulas.** Replace those assertions with one macro-body contract plus call-site and rendered-audio assertions, so formula defects still fail without coupling every channel test to expansion text.
- **Source reduction is not runtime optimization.** Report generated-size and compile/runtime measurements separately.

## Explicitly deferred

- UDO implementation or UDO-versus-macro benchmark beyond a small compile/render comparison.
- A reusable generated-Csound macro framework.
- Refactoring the TypeScript numeric panner helpers; they remain the static/reference implementation.
- Changes to panner behavior, smoothing, automation, UI, persistence, or Java Blue.
