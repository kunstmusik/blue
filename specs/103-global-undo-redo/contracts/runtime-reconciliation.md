# Runtime Reconciliation Contract

Document publication is authoritative. Runtime work is an independently acknowledged projection of the committed before/after transition, including structural undo. Failed engine work never changes the history cursor or rolls canonical data back.

Presentation revision (manual-testing feedback, 2026-09-09): retain the outcome tracking below, but do not display a persistent runtime-status strip or routine restart-required toasts. Genuine errors remain visible; recovery uses existing playback/Blue Live controls. This overrides earlier status-strip/restart-notification presentation requirements without changing reconciliation semantics.

## Capability matrix

| Changed content | Timeline | Blue Live | Preconditions/fallback |
| --- | --- | --- | --- |
| Color, name, presentation-only values | No work | No work | Classification depends on semantic field, not broad patch name |
| Mixer level | Live | Live | Valid per-performance level binding; fix current timeline-only gate |
| BlueX7 fixed values/complete voice (arrangement & track) | Live | Live | Preserve automation authority and complete-voice rules; structural undo uses inverted replaceVoice patch |
| BSB numeric/selection/XY/slider-bank/preset values (arrangement & track) | Live | Live | All changed channels have valid bindings; structural undo re-applies previous preset channel values |
| Score track instrument parameter / voice updates (`updateTrackInstrument`) | Live for BSB/BlueX7 | Live for BSB/BlueX7 | Dispatches via instrument patch classification; ownerKey `track:rootGroupId:trackId` |
| Automation points, resolution, assignment | Live where compiled target supports create/update/delete | Same | Immutable acknowledged automation operations; absent/obsolete targets require restart |
| Effect numeric parameters | Live | Live | Add shared acknowledged route replacing timeline-only preview; missing binding requires restart |
| Code, UDOs, tables, instrument/effect replacement, routing, score/timing compiled structure | Restart required | Restart required | No automatic interruption; next compile uses restored document |
| Unclassified runtime-relevant field | Restart required | Restart required | Never assume no engine work |
| Stopped performance | Next compile | Next compile | No writes and no fake live acknowledgement |

A structurally invalidated owner is not live-authorized merely because undo restores its ID. Restart and a fresh compiled binding are required. While restart-required remains for an owner, later scalar changes to it also await restart. Cosmetic changes to unrelated owners do not clear that status. Structural history entries that represent live-capable instrument modifications (such as DX7 voice replacement or BSB control updates) MUST record concrete structural inverse patches so global undo restores the prior voice/parameter values to the engine live with an `applied` outcome rather than falling back to `restart-required`.

## Work and outcomes

Work carries documentId, committed revision, performance kind/generation, immutable channel values or serialized automation payloads, and affected owner/parameter IDs. Resolve bindings against that generation when planning and recheck before sending. Never capture mutable `BlueData`/`Parameter` objects in delayed timers.

Use existing versioned engine-client operations with structured positive/negative acknowledgement. Repair helper contracts that swallow failures or return before scheduled work. Missing client, rejected response, transport exception and timeout are distinguishable outcomes. Proposed live-operation timeout: one second; mark failed and recoverable, and fence/invalidate the affected performance queue if a timed-out request may still execute. Recovery must drain/stop that generation before claiming newer writes are authoritative; ignoring a late Promise alone cannot prevent its engine-side effect.

Maintain one queue and binding registry per active performance. Sequence live operations for that performance; complete batches preserve internal ordering. Only superseded scalar previews for the same target may coalesce. Durable structural and automation operations are never skipped blindly. Document revisions can advance while runtime work is pending; displayed applied revision must not imply a newer desired revision succeeded.

Statuses: pending, applied, restart-required, failed, each tied to performance and desired revision. Display partial success explicitly. A stopped performance has no live synchronization obligation; next start compiles latest data. Aggregate precedence is failed, restart-required, pending, applied, while retaining detail for each performance.

## Preview and binding migration

Move BSB, mixer and effect preview handlers into this same generation-fenced route. Gesture end/cancel/undo drains or supersedes that gesture's pending previews before restored values. Late preview submissions for closed gestures are rejected. A pending already-sent preview must finish or its performance must be stopped before a restored value is reported applied.

Replace canonical positional compilation-name copying with stable owner/parameter binding capture at each compilation. Replace singleton BlueX7 bindings with performance-scoped mappings. Existing canonical compilation metadata may remain temporarily for generation compatibility, but replay must not treat it as authoritative; all live adapters migrate to the new registry before completion.

Retry reconciles the latest desired canonical state for current performance generation, not historical failed values. Restart rebuilds bindings and acknowledges the revision actually compiled; if edits arrive during compilation, classify remaining differences before marking synchronized.

## Fenced-performance recovery decision (T125, 2026-09-10)

**Decision: keep `restart-required` as the fenced-performance recovery model. No automatic resynchronization.**

Rationale:

1. The fenced class is compilation-dependent change (code, UDOs, tables, instrument/effect
   replacement, compiled structure). No live channel exists for those values; the only
   synchronization is a fresh compile, which means restarting playback or recompiling Blue Live.
   Automating that would interrupt playback, which the plan forbids ("no automatic playback
   interruption") and which remains a user-owned action.
2. Auto-resynchronization would widen the exact stale-write hazard the generation fences were
   built to close (T111/T115): an automated retry loop iterating the live performances map across
   awaited writes is how obsolete values reached replacement performances. Keeping recovery
   manual keeps that invariant trivially enforced by a human-paced action.
3. Recovery already exists through existing controls (T094): the status surface routes restart
   (timeline) or recompile (Blue Live) to the affected performance kind, and the 2026-09-09
   presentation revision keeps these states quiet but actionable. Live-capable edits (mixer
   values, BSB presets, BlueX7 voices, effect parameters, automation) are not fenced at all —
   they replay live with concrete inverse patches (T104).

Escalation path: if fenced states prove common in practice, the follow-up is generation-scoped
automatic resynchronization limited to live-capable classifications, which must re-prove the
T115 fencing invariants (submitted target/generation snapshots; obsolete acknowledgements never
counted as synchronization of a replacement performance) before replacing the manual restart
prompt.

## Required evidence

Tests must inject negative channel acknowledgement, missing client, delayed automation timer, timeout with late completion, preview after undo, topology invalidation, differing timeline/Blue Live channel layouts and partial success. Real-engine smoke tests verify control readback/audible reversal and regenerated CSD after restart; a resolved Promise or updated renderer knob alone is insufficient.
