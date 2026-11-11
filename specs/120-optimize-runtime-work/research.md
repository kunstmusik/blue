# Research decisions

- Decision: use one opaque in-flight poll token, invalidate it when polling clears,
  and recheck token/session/client authority after await. Rationale: a boolean alone
  lets an old completion clear a replacement request. Keep the existing 250 ms cadence.
- Decision: remove the beforeMemento field from the internal structural transaction;
  snapshot the untouched canonical graph against the detached candidate. Existing tests
  prove candidate isolation; detached encoded deltas own their undo data.
- Decision: alignment returns an ID mapping; remap all snapshot keys/node IDs/encoded
  references once without revisiting live model descriptors. Preserve alias rejection.
- Decision: calculate direct fingerprints only for oversize creation/retry, retaining
  the existing XML representation. Delta IDs are not stable retry fingerprints.
- Decision: prepare nondecreasing-time metadata on the native control thread. Use a
  cached upper-bound endpoint over points [1,size); binary search on a miss. Leave the
  original scan for unordered/non-finite elapsed input. Point 0, time zero, duplicates,
  extrapolation and unquantized exact endpoints follow Java Line.getValue.
- Java reference: blue-core Line.java at 3ca3f40579c48a023299a68130d8ab6b9e950974;
  inspect behavior only, no GPL implementation copied into MIT engine.
- Existing target-specific native debug/release builds exist; the audit's generic build
  directory check did not establish that native builds were unavailable.
- Alternatives rejected: global poll queue rewrite, hashing raw JSON deltas, sorting
  accepted unordered automation, removing internal readback shared memory without tests.

- Follow-up decision: share immutable AutomationDef instances in native map snapshots;
  this removes copying unrelated point/segment vectors with no wire command change.
  Preserve listAutomations value output and existing control-thread retirement.
- Follow-up decision: decode directly into owned number arrays, avoiding typed-array
  intermediates with no numeric precision change (both use binary64).
- Library finding: current contentRevision refers to user SQLite data even for project
  browse; it is not a safe invalidation key for project effects/UDOs. Do not drop the
  project-revision dependency without a new correct content key.

- Native retirement correction: copying previous numeric IDs and inline state avoids
  reading old map-key strings after retirement makes them reclaimable. Same-name create
  gets a new ID, fixing inherited completed state; regression reproduced before fix.
- Renderer choice: keep full model hit testing and only cull Track bars with a measured
  horizontal interval/128 px overscan. Unknown width preserves prior rendering until
  measurement. Memoized SVG paths preserve the existing rectangle oracle and avoid a
  large bitmap backing store. Java PianoRollView at the same reference revision was
  inspected; no Java code or new numerical geometry was incorporated.
- Modern Web Guidance: consulted performance, defer-rendering-heavy-content and
  efficient-background-processing. Apply bounded/coalesced event work and view-based
  work reduction; no new CSS content-visibility or meter scheduler was necessary.
- SQL: cache only fixed browse/search shapes per connection; one recursive JSON-bound
  query supplies all page breadcrumbs. No schema/index/dependency change.
- Same-layout storage-only paired diagnostic gives no consistent local-memory benefit;
  keep current exported mirror and per-cycle readback. Lower-rate snapshots need an
  explicit freshness contract, not an allocation-only assumption.
- Broader work remains conditional: per-type project-library epochs, typed mixer
  structural sharing/render counts, section-publication revision/resync protocol,
  residual startup batching, binary telemetry and shared meter scheduling. These are
  recorded as outstanding in the spec, not represented as completed implementations.
