# Runtime Reconciliation Contract

Document publication is authoritative. Runtime work is an independently acknowledged projection of the committed before/after transition, including structural undo. Failed engine work never changes the history cursor or rolls canonical data back.

## Capability matrix

| Changed content | Timeline | Blue Live | Preconditions/fallback |
| --- | --- | --- | --- |
| Color, name, presentation-only values | No work | No work | Classification depends on semantic field, not broad patch name |
| Mixer level | Live | Live | Valid per-performance level binding; fix current timeline-only gate |
| BSB numeric/selection/XY/slider-bank/preset values | Live | Live | All changed channels have valid bindings; preset may require complete batch |
| BlueX7 fixed values/complete voice | Live | Live | Preserve automation authority and complete-voice rules; acknowledged batch |
| Automation points, resolution, assignment | Live where compiled target supports create/update/delete | Same | Immutable acknowledged automation operations; absent/obsolete targets require restart |
| Effect numeric parameters | Live | Live | Add shared acknowledged route replacing timeline-only preview; missing binding requires restart |
| Code, UDOs, tables, instrument/effect replacement, routing, score/timing compiled structure | Restart required | Restart required | No automatic interruption; next compile uses restored document |
| Unclassified runtime-relevant field | Restart required | Restart required | Never assume no engine work |
| Stopped performance | Next compile | Next compile | No writes and no fake live acknowledgement |

A structurally invalidated owner is not live-authorized merely because undo restores its ID. Restart and a fresh compiled binding are required. While restart-required remains for an owner, later scalar changes to it also await restart. Cosmetic changes to unrelated owners do not clear that status.

## Work and outcomes

Work carries documentId, committed revision, performance kind/generation, immutable channel values or serialized automation payloads, and affected owner/parameter IDs. Resolve bindings against that generation when planning and recheck before sending. Never capture mutable `BlueData`/`Parameter` objects in delayed timers.

Use existing versioned engine-client operations with structured positive/negative acknowledgement. Repair helper contracts that swallow failures or return before scheduled work. Missing client, rejected response, transport exception and timeout are distinguishable outcomes. Proposed live-operation timeout: one second; mark failed and recoverable, and fence/invalidate the affected performance queue if a timed-out request may still execute. Recovery must drain/stop that generation before claiming newer writes are authoritative; ignoring a late Promise alone cannot prevent its engine-side effect.

Maintain one queue and binding registry per active performance. Sequence live operations for that performance; complete batches preserve internal ordering. Only superseded scalar previews for the same target may coalesce. Durable structural and automation operations are never skipped blindly. Document revisions can advance while runtime work is pending; displayed applied revision must not imply a newer desired revision succeeded.

Statuses: pending, applied, restart-required, failed, each tied to performance and desired revision. Display partial success explicitly. A stopped performance has no live synchronization obligation; next start compiles latest data. Aggregate precedence is failed, restart-required, pending, applied, while retaining detail for each performance.

## Preview and binding migration

Move BSB, mixer and effect preview handlers into this same generation-fenced route. Gesture end/cancel/undo drains or supersedes that gesture's pending previews before restored values. Late preview submissions for closed gestures are rejected. A pending already-sent preview must finish or its performance must be stopped before a restored value is reported applied.

Replace canonical positional compilation-name copying with stable owner/parameter binding capture at each compilation. Replace singleton BlueX7 bindings with performance-scoped mappings. Existing canonical compilation metadata may remain temporarily for generation compatibility, but replay must not treat it as authoritative; all live adapters migrate to the new registry before completion.

Retry reconciles the latest desired canonical state for current performance generation, not historical failed values. Restart rebuilds bindings and acknowledges the revision actually compiled; if edits arrive during compilation, classify remaining differences before marking synchronized.

## Required evidence

Tests must inject negative channel acknowledgement, missing client, delayed automation timer, timeout with late completion, preview after undo, topology invalidation, differing timeline/Blue Live channel layouts and partial success. Real-engine smoke tests verify control readback/audible reversal and regenerated CSD after restart; a resolved Promise or updated renderer knob alone is insufficient.
