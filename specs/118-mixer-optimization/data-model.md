# Data Model: Mixer Generation Optimization

No canonical model, XML field, persistent setting, library record, history entry, IPC payload, or public parameter type is added. The entities below describe internal compilation bookkeeping and developer evidence, not an obligation to implement a new general-purpose IR.

## Existing owners and identities

| Entity                               | Existing owner                      | Contract                                                                                                                    |
| ------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Project/mixer/channels/sends/effects | Main-owned `BlueData`               | Existing public model and history bridge remain authoritative; this feature adds no mutation                                |
| Detached compilation mixer           | Current CSD generation pipeline     | Runtime identities are copied/reused by the current pipeline; do not allocate replacement channel/send/parameter identities |
| Gate graph, bank, ordinals, states   | Existing mixer gate context         | Preserve traversal, initial targets, 5 ms k-rate states, commit sampling and applied echo                                   |
| Panner bindings/parameters           | Existing compilation panner catalog | Preserve law/mode/control names, positions, defaults and ordinals                                                           |
| Generated statements and scratch     | One BlueMixer emission call         | Deterministic allocation, discarded after generation; no serialized or cross-render cache                                   |

## Local combined send gain

A local generated k-rate value has a deterministic scratch symbol, the send's amount expression, gate-state expression, and current tap location. These fields can remain ordinary local variables in `applyEffectsChain`; a separate class is unnecessary.

Lifecycle: read current amount/gate at the send tap → compute one scalar product → use it for each channel's immediate accumulation → expire before later authored execution or scratch overwrite. Preserve the old path when no redundant audio product exists. It does not become an automation parameter, gate ordinal, runtime channel export, or shared durable gain.

## Final clear set

An ordered compilation-local collection contains the same source/sub/master audio-variable references reset by the current emitter. Preserve existing traversal and reset occurrence; do not infer removal from silence or disk pruning. The collection is emitted after master output and gate-applied echo, then discarded. Any bounded grouping preserves order and covers all listed variables. An empty collection does not produce an invalid opcode call.

## Pending contribution (only if batching is accepted)

Implementation outcome: bus batching was deferred, so no pending-contribution
object or bookkeeping described in this conditional design was introduced.

| Attribute             | Meaning and validation                                                             |
| --------------------- | ---------------------------------------------------------------------------------- |
| Destination symbol    | Existing bus accumulator; may already hold direct instrument/effect content        |
| Source symbol         | Stable audio signal at the original tap; never a reused scratch reference          |
| Gain description      | Unity or a stable current k-rate value; an expression name is not a value snapshot |
| Contribution ordinal  | Original emission order, independent of runtime parameter/gate/panner ordinals     |
| Referenced-symbol set | Source/gain/destination aliases needed to detect overwrite or observation barriers |

A small ordered list is sufficient if a useful safe region exists. Do not add a persistent graph, extensible optimizer registry, configurable strategy framework, or snapshot payload. If aliases/lifetimes cannot be established from generator-owned operations, emit the original accumulation immediately.

Transitions:

1. **Immediate**: emit existing route arithmetic when the candidate is ineligible or has no proven benefit.
2. **Pending**: append only an eligible stable contribution within a proven safe region.
3. **Flush**: before a barrier, emit each destination's existing accumulator once plus pending contributions in original order; clear those pending entries.
4. **Finished**: no pending contribution survives receiver processing, meter/output observation, opaque UDO execution, or final clearing.

All pending destinations flush before an enabled effect call; known local mutations flush their affected references. Source/sub processing order never changes. No deferred object reaches returned render bindings or canonical `BlueData`.

## Developer fixture and evidence records

| Record                     | Required information                                                                                                                                               | Owner/lifetime                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Baseline fixture manifest  | Fixture identity, Blue baseline revision, project/generator mode, CSD hash, original input identity, sample rate, block size, channel count, binding manifest      | Developer capture under explicit evidence directory; immutable for a comparison     |
| Candidate fixture manifest | Same identity/settings plus candidate revision/working-diff hash and resulting CSD/bindings hash                                                                   | Developer capture                                                                   |
| Render comparison          | Both manifest identities, runtime build, sample format/count, finite-sample result, peak residual, structural/live checks                                          | Test evidence; no project persistence                                               |
| Performance comparison     | Matched environment, compiler/Release build, runtime identity, exact flags/threading, warmup/window, seeded execution order, raw trials, summary metrics and gates | Native benchmark/wrapper; contract version separate from production protocol        |
| Candidate decision         | Candidate name, eligible shape, barrier cases, correctness result, performance evidence per environment, accept/defer/reject and rationale                         | Feature evidence/implementation change description; not a runtime strategy database |

Validate required fields and matching fixture/environment identities before computing comparisons. Missing or incompatible data yields an explicit failed/incomplete comparison, never an accepted zero cost or skipped success. Benchmark directories and artifacts are caller-selected developer outputs, excluded from `.blue` files and app preferences.
