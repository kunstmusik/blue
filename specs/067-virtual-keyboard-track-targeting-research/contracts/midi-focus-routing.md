# Contract: Focused MIDI Instrument Routing

This contract extends the existing Spec 058 shared hardware/Virtual Keyboard ingress and Blue Live note-trigger bridge. It does not create another MIDI transport.

## 1. Renderer focus authority

`packages/blue-app/src/renderer/stores/midi-routing-store.ts` is the sole authority for the transient routing mode and focused performance target.

Required operations:

```ts
setMode(mode: MidiRoutingMode): void;
focusTrack(target: TrackFocusTarget): void;
focusOrchestra(target: OrchestraFocusTarget): void;
clearFocusForProjectSession(projectSessionId?: number): void;
reconcileFocus(currentProjectSnapshot): void;
resolveTargetForNote(channel: number): BlueLiveNoteTarget | null;
```

Rules:

- The default mode is `focus`.
- An explicit eligible target selection replaces the previous focus atomically.
- Changing workbench/DOM focus alone does not change the performance target.
- Channel mode resolves every event to its own input channel and ignores focused target for routing.
- Focus mode with no current-session target resolves to `null` and fails closed.
- Project switch clears focus before the new session can route notes.
- Blue Live stop/restart does not clear current-project focus; it only triggers held-note cleanup and catalog replacement.
- The store is renderer-session state; it does not write project patches or settings.
- Router resolution/submission failures do not mutate the focus store or publish a user-visible diagnostic.

## 2. Selection-surface integration

### Track surfaces

The following explicit interactions focus the Track identified by `{projectSessionId, rootGroupId, trackId}`:

- pointer selection of the Track row header;
- pointer selection of an empty Track timeline location;
- pointer selection of a Track-contained ScoreObject or AudioClip;
- pointer interaction with the Track instrument control.

Buttons that stop row propagation (Mute, Solo, automation, note processors, menu actions) do not steal focus unless the user first explicitly selects the Track's row/control. Focus styling must coexist with ScoreObject multi-selection and automation selection.

### Orchestra surface

`ArrangementPanel` reports explicit user selection separately from `OrchestraPanel`'s initial/editor fallback selection. An explicit row selection focuses `{projectSessionId, assignmentId}`. Opening the panel or automatically choosing its first editor row must not silently change performance focus.

### Reconciliation

Each project snapshot update reconciles the current focus:

- matching stable identity remains focused and display metadata refreshes;
- missing Track/assignment clears focus;
- disabled/no-instrument state may remain visibly focused but resolves as unavailable when Blue Live validates it;
- session mismatch always clears focus.

## 3. Virtual Keyboard control contract

The Virtual Keyboard header exposes one routing-mode control and one target status:

- `Focused Target` selected by default;
- `Direct Channel` as the compatibility choice;
- focus mode shows `Track: <name>`, `Orchestra: <id> — <name>`, or `No focused instrument`;
- channel mode shows the existing one-based Channel input;
- octave, velocity override, piano interaction, keyboard shortcuts, focus ring, and All Notes Off remain unchanged;
- target/mode status is available to assistive technology and is not conveyed by color alone;
- rejected notes add no routing error text; normal keyboard interaction visuals remain unchanged.

The mode controls both hardware and virtual input and must say so in its label/title. Switching mode does not rewrite currently held notes.

## 4. Shared note request

```ts
export type BlueLiveNoteTarget =
  | { kind: 'track'; trackId: string }
  | { kind: 'orchestra'; assignmentId: string }
  | { kind: 'channel'; channel: number };

export interface BlueLiveNoteTriggerRequest {
  type: 'noteOn' | 'noteOff';
  midiNote: number;
  velocity: number;
  channel: number;
  target?: BlueLiveNoteTarget;
  liveSessionId?: number;
  source: 'mouse' | 'computer' | 'hardware';
  sourceId?: string;
  deviceId?: string;
  timestamp?: number;
}
```

Validation:

- MIDI note/velocity/channel validation remains unchanged.
- Track and assignment identities must be non-empty and bounded serializable strings.
- Channel targets must be integer 0–15.
- An omitted target normalizes to `{kind: 'channel', channel: request.channel}` for compatibility.
- A channel target that disagrees with `request.channel` is malformed and rejected.
- A supplied `liveSessionId` must be a nonnegative integer matching the active Blue Live session; mismatch is rejected before target lookup or score submission.
- The shared renderer router supplies the current `liveSessionId`; omission remains accepted for legacy direct-channel callers during migration.
- Preload forwards the serializable request only; it does not resolve project state.

## 5. Router contract

The router receives a target resolver dependency backed by the renderer focus authority.

### Note-on

1. Validate/normalize the MIDI event.
2. Reject if Blue Live is inactive.
3. Preserve repeated-note idempotence by checking the existing source key.
4. Capture the current Blue Live session ID and resolve one target from current mode/focus and the event channel.
5. Build aggregate key `(target identity, midiNote)`.
6. Submit note-on only for the first aggregate reference.
7. Store the resolved target and submitted session ID only after main accepts the note-on.

Target-resolution and trigger failures return `accepted: false` to the caller so the
router creates no held state. The caller does not surface the failure as a routing
diagnostic and must never retry against another target.

### Note-off

1. Look up the existing held note by source key.
2. Ignore unknown source releases idempotently.
3. Use the stored target, submitted session ID, and target aggregate; do not consult current focus/mode or current engine generation.
4. Submit note-off only when the final aggregate reference is removed.

### Cleanup

- `releaseSource` emits target-specific final releases for that source where other references do not remain.
- `releaseAll` clears ledgers before requesting engine all-notes-off.
- Blue Live lifecycle subscriptions invoke `releaseAll` before a new engine generation accepts input but leave renderer focus intact.
- Project lifecycle subscriptions invoke `releaseAll` and clear focus before a new project session accepts input.
- Failed note-on creates no cleanup debt; failed cleanup remains best effort and cannot block later ledger clearing.

## 6. Portable CSD result contract

`BlueData.toBlueLiveCSD()` returns its existing CSD/parameter/string-channel outputs plus a deterministic compiled target catalog:

```ts
type CompiledMidiInstrumentTarget =
  | { kind: 'track'; trackId: string; runtimeInstrumentId: number | string }
  | { kind: 'orchestra'; assignmentId: string; runtimeInstrumentId: number | string };

interface RenderCsdResult {
  csdText: string;
  parameters?: Parameter[];
  stringChannels?: StringChannelEntry[];
  midiInstrumentTargets: readonly CompiledMidiInstrumentTarget[];
}
```

Rules:

- Targets describe exactly the enabled base instruments generated into that CSD.
- Track entries come from `CompileData` Track registration; Orchestra entries come from the enabled project arrangement clone before Track additions are conflated with project assignments.
- Ordering is deterministic, but consumers resolve by identity rather than position.
- Duplicate stable identities are reported or omitted as invalid; they are never first-match routed.
- The catalog is derived output and never saved to XML.

## 7. Main-owned live session contract

On start/recompile:

1. Generate CSD and target catalog together.
2. Complete CSD parsing and engine start setup.
3. Install the validated catalog for the new lifecycle generation atomically.
4. Clear any earlier catalog on cancellation, failure, stop, and cleanup.

On trigger:

- Normalize omitted target to the compatibility channel target.
- Reject a supplied `liveSessionId` that does not match the running session before resolving any target.
- Resolve Track/Orchestra targets only from the installed compiled catalog.
- Resolve channel targets through the preserved channel compatibility rule.
- Apply the current canonical project MIDI pitch/velocity processor to the request values.
- Generate note-on/note-off score identity from the resolved runtime instrument ID and padded MIDI note.
- Submit only after all validation succeeds.

Required failure results include:

- Blue Live not running;
- stale or malformed Blue Live session ID;
- no focused target supplied;
- malformed or mismatched channel target;
- Track has no compiled instrument in this session;
- Orchestra assignment has no compiled instrument in this session;
- unmapped direct channel;
- duplicate/ambiguous compiled identity;
- engine score submission failure.

Every failure is recoverable, includes no wrong-instrument fallback, and returns no successful submitted score text. The typed result remains available for router bookkeeping, logging, and automated verification; the renderer intentionally presents no routing error to the user.

## 8. Compatibility and out-of-scope boundaries

- Existing requests without `target` remain direct-channel requests.
- Java/Spec 033 Virtual Keyboard note, channel, velocity, octave, and All Notes Off behavior remains intact.
- Spec 058 Web MIDI device preferences, discovery, permission, byte decoding, timing, and non-note deferrals remain intact.
- Project MIDI mapping remains canonical `BlueData` state and applies after target resolution.
- No XML, program settings, library database, routing matrix, arm state, record path, CC, bend, aftertouch, MPE, or Blue Live object-trigger semantics are added.
