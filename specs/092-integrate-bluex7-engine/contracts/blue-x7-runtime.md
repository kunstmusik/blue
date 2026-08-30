# Contract: BlueX7 Runtime Routing

## Purpose

Route live BlueX7 changes and readback to exactly one arrangement or Track owner while keeping `BlueData` canonical and automation authoritative.

## Owner target

```ts
type BlueX7RuntimeTarget =
  | { assignmentId: string; track?: never }
  | {
      assignmentId?: never;
      track: {
        projectSessionId: number;
        rootGroupId: string;
        trackId: string;
      };
    };
```

Exactly one branch must be present. Display name, list index, instrument number cached by the renderer, and Parameter name alone are invalid routing identities.

## Live control intent

```ts
interface BlueX7RealtimeControlUpdate {
  target: BlueX7RuntimeTarget;
  projectSessionId: number;
  parameterId: string;
  semanticKey: string;
  value: number;
  expectedProjectRevision?: number;
}
```

The durable project patch is authoritative. This intent is only a low-latency accelerator after/beside that patch. Main resolves the current canonical instrument, verifies that Parameter ID and semantic key refer to the same descriptor, quantizes the canonical fixed value, and resolves the current compilation channel.

### Authority matrix

| Playback | Automation enabled | Durable edit | Direct effective write |
|---|---:|---:|---:|
| stopped | no | yes | no engine |
| stopped | yes | fixed fallback only | no engine |
| running | no | voice + fixed value | yes |
| running | yes | voice + fixed fallback; curve unchanged | no; automation remains effective authority |

Next-note fields update their exported globals immediately but only new notes capture them.

## Generated direct-global Csound target

Every compiled BlueX7 instance receives target Csound specialized with that instance's resolved `gk_blue_autoN` names. `chnexport` globals are the live value interface. The generated live inline target must not copy them through a 155-slot live voice array or ftable. Next-note values are captured with `i(gk_...)` at note initialization. The current active fragment reads feedback, LFO depths, output levels, and enables directly only when the epoch is dirty; it retains eight k-indexable pitch-envelope indices/rates and six output-level baselines as note-local state. A compact operator projection is only a compatibility fallback for a future active descriptor that requires dynamic indexing, never a transport interface.

The TypeScript generator emits:

1. I-rate captures of every next-note field from its direct global.
2. Direct global references inside the small active-note fragment for feedback,
   LFO depths, output levels, and operator enables.
3. Domain-local change guards so an unchanged note performs no active-state
   recomputation.
4. Direct literals instead of globals for preview/static generation that has no compiled Parameters.

The implementation may generate `changed()` guards in each note or generate one always-on instance coordinator that converts direct-global changes into small domain epochs. The two forms must be measured on the dense fixture. If a coordinator wins, it publishes epochs only and never copies Parameter values. This is an internal seam of the target generator; callers and runtime routing see the same direct-global interface.

The generator may likewise call shared synthesis UDOs or inline their implementation into the instance instrument. UDO layout is not part of this contract. Both forms must use the same semantic generator inputs and produce equivalent output/state behavior. A UDO must not be retained merely for source reuse when its argument transfer or array marshalling causes the performance gate to fail.

## Atomic complete-voice update

SysEx import, whole-voice replacement, undo, and redo send one complete 151-value channel batch after the canonical project mutation succeeds:

1. Resolve the current owner and binding.
2. Validate every channel name, value, automation-authority rule, and live binding before enqueueing anything.
3. Enqueue one immutable batch in Blue Engine.
4. Apply the entire batch on the performance thread after one `csoundPerformKsmps` call and before the next automation/Csound control cycle.
5. Direct-global note initialization and active-note guards observe either the old or new complete set.

Failure before enqueue changes no live channel. Once accepted, the batch is applied as a unit at a control boundary; an application failure reports a recoverable runtime diagnostic and requires the next successful full snapshot or engine rebuild. Project data is never rolled back because a disposable engine write failed.

## Effective-value readback

```ts
interface BlueX7EffectiveValuesRequest {
  target: BlueX7RuntimeTarget;
  projectSessionId: number;
  parameterIds: string[];
}

type BlueX7EffectiveValuesResult =
  | {
      ok: true;
      projectSessionId: number;
      ownerIdentity: string;
      engineSequence: number;
      values: Array<{ parameterId: string; value: number }>;
    }
  | {
      ok: false;
      reason: 'not-playing' | 'stale-session' | 'owner-not-found' | 'binding-not-found' | 'channel-unavailable';
    };
```

- Request only visible controls for open editors; maximum count is 151.
- Renderer polls no faster than needed for the 20 Hz requirement and allows only one in-flight request per editor.
- Main batch-reads resolved compilation channels and preserves request order.
- Renderer accepts a result only if session and owner still match; late responses are discarded.
- Effective values are disposable display state. They do not dispatch patches, update fixed values, move automation points, or enter undo history.

## Project Parameter catalog

Automation discovery and live ID lookup must use the same owner-aware enumeration across:

- arrangement instruments;
- every Track-owned instrument in score order;
- mixer/effect/send Parameters.

Track entries remain associated with their Track layer. Same-named instruments are disambiguated by location label for display and by stable owner identity for routing.

## Failure rules

- Malformed target, non-finite value, ID/key mismatch, stale project session/revision, removed owner, missing binding, or missing channel is a no-write result.
- No resolver may fall back to a same-named instrument, ordinal position, or another owner.
- A stale read returns unavailable; the editor falls back to canonical fixed value plus automation indication.
- Engine/protocol failure is logged and surfaced through the existing recoverable runtime diagnostic path without corrupting or redirecting project state.

## Required contract tests

- Arrangement and Track owner resolution with duplicate names.
- Session/revision, removed/replaced owner, and ID/key mismatch failures.
- Automation authority matrix.
- Single update and complete-voice validation/enqueue/performance-thread-apply ordering.
- Generated live inline target contains direct `gk_blue_autoN` references and no 155-slot `kLiveVoice[]`, ftable publication, or Parameter `chnget` path. The maintained `bluex7_voice` UDO may retain its compact compatibility signature for static/shared-UDO comparison targets.
- Shared-UDO and generated-inline benchmark targets preserve equivalent renders and active/next-note behavior; the selected layout follows the documented 5% CPU rule.
- A stress sampler at every control boundary observes only the complete old or new 151-value set.
- Each generated change guard updates only its documented active-note domain; unchanged domains perform no expensive rebuild.
- Concurrent updates to four owners with no channel overlap.
- Visible-only batch readback, late-response rejection, stopped/unavailable behavior, and no project mutation.
- Track Parameters present in chooser and score automation runtime sync.
