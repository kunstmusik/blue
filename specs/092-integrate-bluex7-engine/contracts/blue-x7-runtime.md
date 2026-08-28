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

Next-note fields update their instance transport immediately but only new notes capture them.

## Atomic complete-voice update

SysEx import, whole-voice replacement, undo, and redo send a complete 151-value runtime snapshot after the canonical project mutation succeeds:

1. Resolve the current owner and binding.
2. Set only that binding's hold control.
3. Batch-write the complete validated Parameter channel set.
4. Advance that binding's commit generation and clear hold.
5. The Csound wrapper publishes the staged transport at the next k-boundary.

Failure before release preserves the previously committed effective voice. Cleanup makes a best effort to clear hold; if state is uncertain, main reports a recoverable runtime diagnostic and requires the next successful full snapshot or engine rebuild. Project data is never rolled back because a disposable engine write failed.

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
- Single update and complete-voice hold/write/commit ordering.
- Concurrent updates to four owners with no channel overlap.
- Visible-only batch readback, late-response rejection, stopped/unavailable behavior, and no project mutation.
- Track Parameters present in chooser and score automation runtime sync.
