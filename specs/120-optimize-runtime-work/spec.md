# Feature Specification: Remove repeated runtime work

**Feature Branch**: `codex/120-optimize-runtime-work`
**Created**: 2026-11-10
**Status**: Complete for the implementation scope in [tasks.md](tasks.md). Conditional follow-ups are recorded below.
**Input**: Proceed with the audited optimization plan and update completion as work proceeds.

## User Scenarios & Testing

### US1 — Reliable controls when the engine is slow (P1)

A composer can stop or replace playback without accumulated health requests or stale
responses changing the replacement session. Test a delayed response across many polling
ticks, failure recovery, teardown and replacement with a second delayed request.

### US2 — Edit large projects without copying unrelated content twice (P1)

A composer edits a clip, point, or instrument and can undo/redo with unchanged identities,
dirty state and runtime reconciliation. Test isolated failed preparation, replacement
containers, cycles/shared references, grouped edits and oversize confirmations.

### US3 — Dense automation without repeated prefix searches (P1)

A composer plays dense curves and seeks without changing generated channel values.
Test ordered and unordered points, duplicate times, zero, extrapolation, completion,
rewind, definition replacement and Java exact-output fixtures.

### US4 — Evidence-led follow-up optimization (P2)

A composer benefits from improvements supported by representative workload evidence.
Keep the audit in this specification updated, distinguish completed work from experiments,
and advance its later workstreams only when their stated measurement gates are met.

### Edge Cases

Old success/failure after session replacement; repeated polling start/stop; cancelled
preparation; frozen/shared/cyclic graph nodes; maps/sets/typed buffers; new identities
on proposal retry; unordered/duplicate automation points; non-finite elapsed time;
exact endpoints bypassing quantization; instrument/runtime binding replacement.

## Requirements

- **FR-001**: At most one health poll per active polling generation may be outstanding.
- **FR-002**: A late response cannot publish into or release resources of a newer generation.
- **FR-003**: Structural preparation leaves canonical content unchanged until commit and
  captures isolated undo data without a second complete before-project copy.
- **FR-004**: Identity alignment preserves every encoded reference without a second
  after-project capture; unchanged identities/references and atomic replay survive.
- **FR-005**: Within-budget direct edits do not serialize XML to fingerprint an unused
  proposal; actual proposal retries retain their existing matching contract.
- **FR-006**: Ordered dense automation reuses its segment and bounds seek lookup,
  retaining output bits and accepted unordered-input behavior.
- **FR-007**: Preserve project format, CSD output, labels/limits, protocol and shared-memory
  interface. Introduce no new dependency or persistent store in the initial wave.
- **FR-009**: Native list publication shares unchanged immutable envelope definitions; public list/protocol output and off-audio reclamation remain unchanged.
- **FR-011**: Coalesce project-library refresh bursts, stop stale pagination and preserve relevant project invalidation.
- **FR-012**: Search preserves breadcrumbs/order/counts with a bounded three queries per nonempty page and fixed-shape statement reuse.
- **FR-013**: Render timeline bars only in the visible/overscan/pinned set while preserving full-model gestures, selection and history.
- **FR-014**: Batch visible piano-roll thumbnail rectangles without changing geometry, colors or host-window behavior.
- **FR-010**: Meter decoding returns the same arrays/values without temporary typed-array copies.
- **FR-008**: Record boundaries, raw evidence, completed checks and outstanding gates in
  the audit. Deterministic work reduction is not speed acceptance.

### Existing Behavior & Data Compatibility

Java Line.getValue at `3ca3f40579c48a023299a68130d8ab6b9e950974` and committed Java
fixtures are the numeric oracle. No loader/writer, XML or migration changes; standalone
resource acceptance is unchanged. Main owns BlueData/history; native control thread owns
prepared definitions; performer owns cursors. Poll/capture state is disposable. Preserve
semantic labels, commit→undo→redo, dirty-state restoration and runtime reconciliation.
No intentional divergence. Later protocol/rendering/readback changes require explicit
contracts before implementation.

## Success Criteria

- **SC-001**: Arbitrarily many ticks during one pending request issue one poll; all old
  responses after teardown/replacement are discarded.
- **SC-002**: Structural preparation uses one project copy; capture visits each input
  graph once. Replay, isolation and retained-size tests pass.
- **SC-003**: Evaluation within a segment takes constant lookup work; ordered seeks use
  logarithmic work while Java fixture values remain bit-exact.
- **SC-004**: Retain user-action budgets from the audit. Diagnostic stage timings alone
  do not establish product acceptance.

## Assumptions

Implement independent early workstreams first. Larger protocol/UI work is gated by
baseline results. Local readback is an experiment, not permission to weaken freshness
or external compatibility. Source line count alone does not justify a rewrite.

## Audit findings and delivery roadmap

What this repo does: Blue is a desktop composition environment that owns a canonical
project in Electron main, sends editor snapshots to renderers, and compiles projects
for a separate Csound engine. This audit assumes one composer, timeline and Blue Live
playback, several editor windows, and projects with thousands of clips/notes and dense
automation. It does not assume a multi-user server workload.

Audited on **2026-11-10**, at develop / freshly fetched origin/develop
**56154fd3e120016a8c3481d79ea5d71f1d21eea5**. The supplied agent report describes this
same recent history implementation. Findings below are based on source inspection;
test results are recorded separately. No speedup, heap reduction, or audio dropout
rate has been measured in this audit. Priorities are engineering judgments, not
profiling results.

The original audit changed no production code; implementation progress below is current. The pre-existing untracked
`packages/blue-app/src/main/__perf-probe.test.ts` was left untouched and was not run.

### Implementation progress (2026-11-10)

The audit findings below describe baseline `56154fd3`; this table tracks the current
implementation on `codex/120-optimize-runtime-work`. Design and validation details are
in [plan.md](plan.md), [contracts](contracts/runtime-work.md), [tasks.md](tasks.md), and
[quickstart.md](quickstart.md). The standalone audit file has been removed from docs.

| Step | Status | Evidence / remaining gate |
| --- | --- | --- |
| 0 | Diagnostic comparison collected | 1,000 clips/32 instruments: preparation p95 93.75 → 71.02 ms; projection 6.57 → 6.10 ms. Uncontrolled desktop diagnostics, not acceptance. |
| 1a polling | Implemented | Delayed-request regression reproduced eight requests in two seconds; now one. Old results cannot release or publish into new generations. |
| 1b history/fingerprint | Implemented | One detached structural copy; ordinary direct edits serialize no XML fingerprint. Isolation, oversize retries and replay tests pass. |
| 1c graph remapping | Implemented | Captures after descriptors once; remaps cycles/aliases/map keys/sets consistently. Final app correctness: 6,287 passing tests; replay/identity contracts retained. |
| 2 automation | Implemented | Cached ordered lookup; seeks ≤20 comparisons on 10,000 points, repeated segment ≤3. Java exact-bit parity passes; unordered behavior retained. |
| 3 setup | Narrow implementation complete | 300 fixed values use two bounded commands, with legacy/rejection fallback and ordering preserved. Immutable definitions share unchanged point/segment buffers. New bulk-envelope protocol remains gated on residual startup-stage evidence. |
| 4 library/mixer | Refresh ownership implemented; further work gated | Bursts coalesce; invalidated pagination stops. Current contentRevision is for user SQLite data, not project library content: per-type epochs and mixer-only structural sharing remain follow-up work requiring separate contract/render-count evidence. |
| 5 publications | Measurement gate open; not implemented | Projection-only p95 ~6 ms does not measure multiwindow IPC/rebase/paint. Section publication awaits that boundary evidence and revision/resync contracts. |
| 6a timeline | Horizontal culling implemented | A 1,001-item fixture mounts three bars in its test interval; full model hit tests and active-drag cancellation preserved. Real-browser scrolling/selection passed. Vertical culling remains conditional on row-cost profiling. |
| 6b thumbnails | Implemented | One memoized SVG path per visible piano-roll thumbnail; four browser geometry cases cover NONE/SCALE/REPEAT/REPEAT_CLASSIC, resize and selection. |
| 7 meters | Decoder intermediates removed | Owned number arrays replace temporary typed arrays and Array.from copies; codec contracts pass. Binary IPC/fanout/scheduler changes await end-to-end allocation/visibility profiles. |
| 8 readback | Storage experiment complete; retain current production design | Same-layout mapped/local medians are near-identical. Local wins only 13–14/30 pairs at 256 entries. No production mapping/default change; lower-rate publication requires a freshness contract. |
| 9 library SQL | Search/read-statement work implemented | 20-result search executes three queries instead of 22, preserving nested paths and pagination; fixed read statements reused per connection. Separate worker browse breadcrumb fanout is a follow-up. |

An additional native ownership correction uses numeric automation IDs rather than old
map-key pointers after snapshot retirement. Its regression first reproduced same-name
replacement inheriting an old completed state; replacement now adopts fresh runtime state.

### Assessment of the supplied report

The report finds several useful hotspots. Its impact/effort matrix is too confident:
there are no before/after measurements, several changes alter compatibility contracts,
and the shared-memory conclusion misses an internal consumer.

| Report item                                    | Disposition after checking current source                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 Automation rescans from point 1            | Confirmed. High priority for dense envelopes. Preserve Java evaluation rules; a cursor/binary search is not automatically equivalent for all accepted inputs.                                                                                                                   |
| 1.2 Shared memory is unconsumed                | **Incorrect conclusion.** TypeScript does not map it, but native `CsoundEngine::getChannels()` reads its atomic entries to answer ZMQ requests. Existing disable flags already allow experiments. Replace the internal readback role before treating the mirror as unnecessary. |
| 1.3 Fresh process per playback                 | Confirmed lifecycle. The claimed 200–500 ms cost is unmeasured here. macOS/Linux default to IPC sockets, not TCP port allocation. Warm reuse is a separate lifecycle project, not an initial quick fix.                                                                         |
| 1.4 Meter allocation/IPC churn                 | Confirmed intermediates and broadcast path. C++ encoding allocation is on the publisher thread; steady-state audio capture already uses preallocated triple buffers. Exact allocation counts and benefit need measurement.                                                      |
| 2.1 Two structural preparation copies          | Confirmed for the general structural path, not every project edit. Short scalar and BSB edits have specialized paths. Tests currently require the detached before-memento, so remove that internal contract deliberately.                                                       |
| 2.2 Second after-graph snapshot                | Confirmed. The second walk currently incorporates reassigned identities. Reusing the old map unchanged would be incorrect; node IDs and all encoded references must be remapped consistently.                                                                                   |
| 2.3 XML fingerprint cost                       | Confirmed for direct structural mutations, not all commits. First avoid computing it for ordinary, within-budget direct edits. A raw JSON hash of the delta is not an equivalent retry fingerprint.                                                                             |
| 3.1 Timeline has no viewport culling           | Confirmed in `TrackLayerGroupCanvas`. Culling must retain model-based hit testing and gesture/history behavior.                                                                                                                                                                 |
| 3.2 Piano-roll thumbnail note DOM              | Confirmed when row height enables thumbnails. Repeated clips can amplify rectangle count further. Batch drawing after culling, with the existing geometry as oracle.                                                                                                            |
| 3.3 Mixer render cascades                      | Confirmed broad props. Also affected by revision props, library list refreshes, and canonical snapshot replacement; changing channel selectors alone does not solve the full path.                                                                                              |
| 3.4 Independent meter animation loops          | Qualified. Per-canvas callbacks exist, but invisible/silent meters park and the store guards repeated physics updates at the same timestamp. Consolidation may help; it is not 64 always-running full physics passes.                                                           |
| 4.1 Note map / expression parser / token regex | Mechanisms confirmed; claimed map byte sizes and score heap savings unmeasured. `\S*` creates empty matches at unmatched boundaries, not between every character consumed by another token. Array and parser replacements need semantic/parity research.                        |
| 4.2 Single-pass BSB regex                      | Repeated scans confirmed; proposed replacement is **not behavior-preserving**. Sequential substitutions can expand tokens introduced by earlier values. Callback replacement also differs from string replacement for dollar sequences.                                         |
| 4.3 Read-only XML adapter                      | Two trees confirmed; proposed read-only replacement conflicts with mutable `Element` operations and raw-XML migrations. This is a parser/model boundary redesign, not a small allocation fix.                                                                                   |
| 5 Prepared SQL caching                         | Confirmed repeated preparation. There is also one recursive breadcrumb query per search result, which statement caching alone cannot remove.                                                                                                                                    |

### Findings

#### Should fix

1. **Small edits still do work proportional to the whole project**
   - **What this is:** General structural preparation makes a candidate and a second before-copy, transfers identities twice, then captures a graph delta. Long scalar text edits and mixed history groups have additional full-copy paths.
   - **Problem:** Moving one point in a large project can copy unrelated instruments and clips; compact retained undo data does not bound transient allocation or main-thread pauses.
   - **Fix:** Remove the unnecessary before-copy in the general and direct detached paths after proving candidate isolation. Then optimize identity remapping/capture; profile long-text and mixed-group paths separately.
   - **If we skip it:** Undo records remain small while ordinary editing can still create project-sized allocation bursts.

   Evidence: `packages/blue-app/src/main/project-history-memento.ts:807`,
   `project-history-graph.ts:428`, `project-history.ts:2229`, `:2308`, `:2713`.
   Existing retained-memory improvements are documented in [the history audit](../../docs/project-history-audit.md).

2. **Dense automation repeats the same prefix search every audio cycle**
   - **What this is:** `AutomationManager::evaluate()` starts scanning at point 1 even though runtime state has a segment index.
   - **Problem:** Late in a 10,000-point envelope, most earlier points are rechecked every k-cycle until completion. With 256 envelopes near their ends, the theoretical work approaches 2.56 million point checks per cycle; this is a workload illustration, not a measured supported-load claim.
   - **Fix:** Prepare whether times are ordered on the control thread. For ordered definitions, cache a segment, advance across crossed points, and use binary search for seeks/large jumps; keep an equivalent fallback for other accepted inputs until their contract is resolved.
   - **If we skip it:** Dense curves consume audio-thread time that should be available to Csound.

   Evidence: `native/blue-engine/src/automation/AutomationManager.cpp:193`;
   definition preparation in `AutomationStore.cpp:27` currently checks finiteness,
   not sorted order. Preserve time-zero, duplicate times, extrapolation, exact
   quantization, and floating-point operation order. Java reference:
   `blue-core/src/main/java/blue/components/lines/Line.java:694` at
   `3ca3f40579c48a023299a68130d8ab6b9e950974`.

3. **Playback setup repeatedly copies automation already installed** — additional finding
   - **What this is:** `sendAutomationDefinitions()` awaits each create call. Native `updateList()` copies the current `AutomationList`, including existing point/segment vectors, on every mutation.
   - **Problem:** Installing A similarly sized envelopes with P points performs aggregate copying proportional to A²P, plus A serialized request/reply exchanges. Updating one live envelope also copies unrelated definitions.
   - **Fix:** First batch fixed-value channel initialization through the existing batch API. For envelopes, add a bounded, validated bulk installation command that prepares everything before one publication; subsequently share immutable definitions if live-update profiling justifies it.
   - **If we skip it:** Dense projects pay increasing startup costs before the engine begins audio, even after process-launch improvements.

   Evidence: `packages/blue-app/src/main/engine-bridge.ts:1092`,
   `packages/blue-engine-client/src/engine-client.ts:241`,
   `native/blue-engine/src/automation/AutomationStore.cpp` (`createAutomation`, `updateList`).

4. **Engine health polls can accumulate behind slow commands** — additional finding
   - **What this is:** A 250 ms interval submits `getEngineState()` without an in-flight guard; the client serializes all commands through one promise queue.
   - **Problem:** A long compile/request allows repeated health polls to queue behind it. Sustained responses slower than the polling interval grow outstanding work and can delay subsequent control commands.
   - **Fix:** Allow at most one outstanding poll per session, skip ticks while it is pending, and check captured session authority again after completion. Preserve terminal-state reconciliation and immediate stop behavior.
   - **If we skip it:** A slow engine causes extra queued work precisely when the control path needs to recover.

   Evidence: `packages/blue-app/src/main/engine-bridge.ts:369`, `:376`;
   `packages/blue-engine-client/src/engine-client.ts:241`. This is a source-level
   scheduling finding; a delayed-response regression case is still needed.

5. **Every accepted edit builds and distributes a full editor snapshot** — additional finding
   - **What this is:** History captures `getCurrentProjectDocument()`, which calls `createProjectEditorSnapshot()`, and broadcasts the result to workbench and dedicated editor windows.
   - **Problem:** An isolated slider/point change still projects unrelated project sections and sends them across IPC. More windows multiply serialization/renderer work; narrow React selectors cannot remove this upstream cost.
   - **Fix:** Measure projection, serialization, and renderer reconciliation separately. Preserve unchanged renderer section references first; then introduce explicitly typed section publications with revision fences and full resynchronization if measurements warrant the protocol change.
   - **If we skip it:** Faster history capture still leaves project-wide publication cost on the main thread.

   Evidence: `packages/blue-app/src/main/main.ts:580`, `:899`;
   `project-history.ts:2583`; canonical renderer section replacement in
   `packages/blue-app/src/renderer/stores/project-store.ts:1084`.

6. **Unrelated edits refresh entire project-library listings** — additional finding
   - **What this is:** Mixer, Arrangement, and UDO panels use a library hook keyed to project revision and library-change notifications. It reads all pages, 500 children at a time.
   - **Problem:** An unrelated project revision can re-fetch an unchanged effect/UDO/instrument list. Concurrent notifications can launch overlapping refreshes; the active flag prevents post-unmount publication but does not order requests within one effect lifetime.
   - **Fix:** Key invalidation to the relevant library content revision, coalesce refreshes, and reject stale completions. Preserve refreshes for relevant rename/add/delete/undo/redo operations.
   - **If we skip it:** Common edits trigger avoidable IPC, list allocations, and new props for every mixer strip.

   Evidence: `packages/blue-app/src/renderer/components/libraries/use-project-library-nodes.ts:12`,
   `:46`; `workbench/panels/MixerPanel.tsx:20` and its Arrangement/UDO callers.

7. **Timeline render cost follows the whole arrangement**
   - **What this is:** All layer items mount bars, and tall piano-roll bars create one DOM node per thumbnail rectangle.
   - **Problem:** Offscreen clips still mount React trees; piano-roll previews recompute geometry and may expand repeated notes even when outside the viewport.
   - **Fix:** Cull clip bars horizontally first, then rows if profiling supports it. Use overscan and pin active gesture targets; retain full-model selection/hit testing. Batch thumbnail drawing and reuse geometry for unchanged note/scale inputs.
   - **If we skip it:** Zooming, scrolling, and unrelated rerenders grow with project size instead of visible content.

   Evidence: `TrackLayerGroupCanvas.tsx:2004`,
   `bar-renderers/PianoRollScoreObjectBar.tsx:37`, `:80`, and
   `piano-roll-thumbnail-utils.ts:100`, under
   `packages/blue-app/src/renderer/components/workbench/panels/score/`.

8. **Mixer strips receive changes they do not use**
   - **What this is:** Memoized strips receive the whole mixer, a project revision, shared selection, and a freshly fetched effect list.
   - **Problem:** Editing channel 1 invalidates props on other strips; selecting only each channel is insufficient when every acknowledgement replaces canonical snapshot references.
   - **Fix:** Stabilize unchanged snapshots and library results; pass only required shared settings and channel-specific selection. Use stable channel IDs for subscriptions, not reorder-sensitive array indices.
   - **If we skip it:** Interaction rerenders unrelated strip controls while meter painting competes for the same renderer thread.

   Evidence: `workbench/panels/MixerPanel.tsx:14`, `:256` and
   `workbench/panels/mixer/ChannelStrip.tsx:763` under renderer components.

9. **Meter telemetry materializes the same data repeatedly**
   - **What this is:** Native publication encodes a new byte vector; Node decodes names and typed arrays, converts those arrays again, and broadcasts object frames to all workbench windows.
   - **Problem:** At approximately 36 Hz, all windows receive a cloned object graph even when they have no visible meter consumer.
   - **Fix:** Begin by removing temporary typed arrays in the existing decoder and measuring subscriber/window fanout. Adopt a validated binary IPC payload only if the end-to-end result justifies changing the contract.
   - **If we skip it:** Steady playback keeps producing avoidable allocations in Electron main and renderers.

   Evidence: `native/blue-engine/src/ipc/ZmqHandler.cpp:934`,
   `packages/blue-engine-client/src/meter-codec.ts:80`,
   `packages/blue-app/src/main/engine-bridge.ts:1062`.
   Preserve clipping, reset, peak hold, multichannel behavior, and silence/offscreen parking.

#### Nice to have / profile before promoting

10. **Direct edit fingerprints serialize XML even when no proposal is needed**
    - **What this is:** The direct structural adapter computes two full XML strings before determining whether its history entry exceeds the limit.
    - **Problem:** Freeze/relink/library transfers pay for a fingerprint used by the oversize-confirmation path even for ordinary within-budget edits.
    - **Fix:** Compute the delta and size first; calculate the existing fingerprint only when creating or validating a proposal. Defer replacing its representation until retry identity is specified.
    - **If we skip it:** These less frequent operations retain avoidable temporary XML allocation.

    Evidence: `packages/blue-app/src/main/project-history.ts:1408`, `:2732`.
    Promote if representative direct operations show material pauses.

11. **Library search performs a breadcrumb query for each row** — additional finding
    - **What this is:** Search fetches a page, counts results, then executes a recursive ancestor query for every returned item.
    - **Problem:** A 500-result page issues 502 statements before other service work. Reusing prepared statements saves parsing but retains all those executions and repeated ancestor work.
    - **Fix:** Cache fixed-shape statements per repository lifetime; fetch page breadcrumbs together or memoize shared ancestor reads within a request. Inspect query plans before proposing a new search index.
    - **If we skip it:** Large library results keep doing repeated synchronous SQLite work in main.

    Evidence: `packages/blue-app/src/main/unified-library/repository.ts:352`, `:397`, `:412`.

### Shared memory: local memory experiment

The user asked whether a local mirror would be faster when no external process reads
the mapping. **It is a sensible design experiment, but changing the allocation alone
does not remove the main recurring work.** The current `syncSharedMemoryFromBindings()`
scans bound mirrored channels every k-cycle. A local buffer with the same scan and
atomics would retain that algorithmic cost. The engine's ZMQ thread still needs a
safe readback representation; simply disabling mirroring switches `getChannels()`
to `csoundGetControlChannel()` and does not establish equivalent concurrent access.

Compare three variants on identical workloads:

1. Current OS-backed mirror and current publication cadence.
2. Engine-owned, preallocated atomic readback slots with the same cadence and semantics.
3. Local readback with a bounded lower-rate snapshot, **only after defining acceptable
   freshness** for automated channels, engine-generated values, and applied-value echoes.

Variant 2 isolates mapping/lifecycle overhead from scan cost. Variant 3 tests whether
less publication work is worthwhile; it cannot silently weaken readback/echo contracts.
Reading only on ZMQ demand needs an audio-thread request/snapshot handoff, not arbitrary
control-thread dereferencing of live Csound pointers. No mutexes, allocation, or
destruction may be introduced into the perform loop.

Keep the engine's documented external `GET_SHM_NAME` interface available as an opt-in
capability if app-owned sessions use a local buffer. Determine supported external users
before changing defaults; no repository TypeScript mapper does not prove no external
consumer exists. Keep native channel identities and prepared bindings as the source of
truth. Size/rebuild the local slots on the lifecycle/control thread and retire old
generations safely. Shared-memory's 256-entry bound and automation's separate 256-active
slot bound must not be conflated or accidentally changed by this optimization.

Evidence: `CsoundEngine.cpp:519` reads mirror values; `:1491` updates them;
`engine-bridge.ts:668` already exposes disable flags; native README documents external reads.

### Delivery plan

Use small, independently revertible changes. Each material workstream should receive
its own Spec Kit artifacts before implementation; this document is the cross-feature
audit and ordering proposal, not a claim that those feature contracts already exist.
Effort below is relative: S = narrow change; M = several modules/tests; L = protocol,
gesture, or lifecycle work. The measurements in step 0 can change ordering.

| Step | Work / primary files                                                                                                                                                 | Effort | Completion evidence / dependencies                                                                                                                                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | Establish baseline for findings 1–9; extend existing fixtures and measurement suites rather than build a new profiler framework.                                     | M      | Retain stage timings, allocation profiles, retained heap, work counts, engine cycle diagnostics, and environment/revision metadata. Choose budgets before candidate runs.                                                                                                                              |
| 1a   | Bound state polling in `main/engine-bridge.ts`.                                                                                                                      | S      | Fake-clock/deferred-response test: at most one pending poll per session; stop/restart/dispose and late responses cannot affect the next session. Preserve terminal reconciliation. Independent of other steps.                                                                                         |
| 1b   | Remove structural before-copy from `project-history-memento.ts` and direct adapter; make direct fingerprint lazy.                                                    | M      | Copy-count guards; isolated candidate failure; commit→undo→redo, grouped cancellation, dirty state, object identities, runtime echoes and oversize proposal retries. No new retained roots.                                                                                                            |
| 1c   | Remap graph snapshots instead of walking after-graph twice in `project-history-graph.ts`.                                                                            | M      | One after-graph traversal; remapped map keys, node IDs, fields, content refs, cycles and shared refs all match existing delta/replay oracle. Do not merely reuse `afterSnapshot.nodes`. Re-measure after 1b.                                                                                           |
| 2    | Cursor/seek lookup in `AutomationManager.cpp`, prepared ordered-time metadata in `AutomationStore.*`.                                                                | M      | Java fixture bit equality; time zero, duplicates, negative/before-first, endpoints, seeks, definition replacement, binding changes, completion/rewind; deterministic point-inspection counts. Existing exact-decimal and allocation-free guards remain.                                                |
| 3    | Batch fixed channel setup; bulk envelope installation across bridge, versioned protocol/client, native handler/store.                                                | L      | One bounded publication per bulk install; all-or-nothing validation; invalid/oversized payload and allocation failure leave old list active. Capability fallback for older engines; timeline/Blue Live failure cleanup and applied readback. Step 0 must show setup materiality.                       |
| 4    | Content-specific library invalidation and mixer prop/reference stability in hook, store, MixerPanel and ChannelStrip.                                                | M      | Unrelated edit causes zero library browse requests; relevant edits and undo/redo refresh once; delayed old result cannot win; changing one channel leaves unrelated strip render counts stable after acknowledgement.                                                                                  |
| 5    | Reduce canonical snapshot projection/publication, starting with measured expensive sections in `main.ts`, history, shared editor contracts and renderer queue/store. | L      | Section-aware publication retains document/revision/state IDs, accepted operations, checkpoints, history barriers, optimistic rebase and full resync on gaps. Test multiple workbench and dedicated editor windows. Depends on baseline; preserve full snapshots for load/resync.                      |
| 6a   | Horizontal bar culling in `TrackLayerGroupCanvas.tsx`; add vertical culling only if needed.                                                                          | L      | Mounted bars follow visible+overscan+pinned set, not total clips. Full-model marquee/hit tests, keyboard navigation, drag outside viewport, auto-scroll, zoom, fade gestures, Escape/blur and undo/redo remain correct.                                                                                |
| 6b   | Batch piano-roll thumbnail rendering; memoize reusable geometry.                                                                                                     | M      | Existing note rectangle output retained across scale/repeat/crop, selection colors, row height and DPI; browser screenshot comparison; node count bounded per visible clip. Depends on 6a for representative gains. Avoid enormous offscreen backing canvases.                                         |
| 7    | Remove decoder intermediates; then evaluate meter binary transport, visibility subscriptions and per-host-window shared drawing.                                     | M–L    | Preserve validated payload bounds, non-finite sanitization, frame ordering/reset and binding generations. A browser-safe codec cannot pull Buffer/ZeroMQ into renderer bundles. Fake-frame tests preserve parking and popout cleanup. Binary IPC still involves copying unless demonstrated otherwise. |
| 8    | Compare native local readback variants described above.                                                                                                              | M–L    | Same-cadence comparison first; audio output and readback/echo equivalence, zero perform-thread allocations/locks, lifecycle rebuild and stale generation tests. Separate external shared-memory compatibility from app session policy. Promote only after measurements.                                |
| 9    | Cache SQL statements and batch breadcrumb work in repository.                                                                                                        | S–M    | Identical search/pagination/order/counts, bounded query count per page, statement disposal on close/reopen. Use existing 10,000-item library workload.                                                                                                                                                 |

Do not bundle graph surgery, engine protocol changes, and renderer publication changes
into one PR. Each changes a different correctness boundary. Steps 1–2 are the first
implementation candidates; steps 3–9 are gated by the baseline and can be reordered.

#### Defer these proposed rewrites

- **Warm engine reuse:** first split startup into runtime probe, process launch,
  connection, create/options, orchestra compile, channel/automation setup, score load,
  start acknowledgement, and first audible output. Revisit if process/setup dominates.
  `STOP`/`csoundReset()` alone does not prove clean reuse of options, working directory,
  instruments, callbacks, automation, subscriptions, meter sequence or device resources.
- **Note map→array:** retain sparse-index behavior, `getPCount()` semantics, defensive
  map export, carry fields, ties, formatting and file-seek/Sound metadata. Profile dense
  generated scores first; do not claim a fixed V8 map size or savings without heap evidence.
- **Arithmetic evaluator:** inventory the accepted expression grammar and Java behavior
  before replacing `new Function`. Establish output/error semantics, precedence, unary
  operators, exponents and scientific notation; keep this separate from storage changes.
- **Single-pass BSB replacement:** counterexample: insert `a → <b>` then `b → 7`;
  current `<a>` expands to `7`, one-pass callback returns `<b>`. Research Java behavior
  and existing projects before changing cascading rules or dollar handling. A simple
  token regex is not approved by this plan.
- **XML adapter:** raw-XML migrators mutate `Element` trees; parent paths, whitespace,
  diagnostics and independent standalone resource roots need full compatibility. Measure
  parser/conversion/migration/model phases and peak heap before designing a replacement.
- **Central meter scheduler/observers:** only promote if callback/observer overhead is
  material after existing silence/visibility parking. If used, own one scheduler per host
  window/display clock and cancel it when the last canvas unregisters.
- **Generic module splitting:** no performance benefit follows from shorter files alone.
  Retain current façades and [modularization review boundaries](../../docs/modularization.md).

### Measurement and acceptance

Follow [the performance testing guide](../../docs/performance-testing.md). Use the same controlled
desktop, power/display settings, runtime versions, audio device/backend and sample
rate/ksmps for both revisions. Record hardware, OS, Electron/Node/browser, Csound and
native build flags. Run measurements serially without competing builds/tests.

Suggested workload matrix, to be fixed in feature quickstarts before implementation:

| Boundary                                     | Representative workload                                                                                                                     | Evidence                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Edit intent → canonical commit → IPC → paint | Existing 1,000-clip history fixture; separately a 10,000-point envelope and long orchestra text; repeat with one and several editor windows | Stage p50/p95/max, main-thread long tasks, copied/walked nodes, publication bytes/window, transient allocation and settled retained heap |
| Audio automation lookup                      | 1/64/256 envelopes, 2/1,000/10,000 ordered points; sample near beginning/middle/end, seeks and duplicates                                   | Point-inspection counts, automation/cycle p95/max, allocation guards, exact output bits; independently exercise unordered accepted input |
| Playback initialization                      | Same small project and dense-automation project for fresh process and any experimental reuse                                                | Stage timings, time to first audio, serialized command count, copied definitions/points, startup and post-stop memory                    |
| Readback mirror                              | Same 0/64/256 mirrored-channel workloads at 44.1/48 kHz, ksmps 32/64; automation and engine-written channels                                | Host-cycle and mirror CPU, read freshness/echo latency, output equality, RSS and resource cleanup for OS/local/lower-rate variants       |
| Timeline                                     | 100/1,000/10,000 clips with fixed viewport; tall piano-roll clips containing hundreds of notes and repeat behavior                          | Mounted nodes, geometry work, zoom/scroll/drag p95, paint time, GPU/canvas memory                                                        |
| Mixer/meters                                 | Existing 64-strip comparison, silence/activity, hidden mixer and popouts; higher channel counts only within supported contracts             | Existing FPS/interaction regression budget, decoder allocation/GC, IPC bytes/fanout, active callbacks, delivery and reset budgets        |
| Library                                      | Existing 10,000-item browse/search workload, including wide result pages                                                                    | Query/prepare counts, refresh count, main-thread time and latency                                                                        |

For new experiments use five fixed warmup iterations and at least 30 measured user
actions per workload/revision, retaining every observation. Long-running engine cycle
measurements should use the existing native harness and its declared sample procedure.
Run existing performance commands with their prescribed three fresh processes. Preserve
failed/inconclusive observations; never retry until a candidate passes.

Retain existing product budgets, including history coordinator and publication-to-paint
p95 ≤200 ms, real-engine undo/redo readback p95 ≤250 ms, meter delivery ≥30 Hz with no
gap ≥200 ms, stop-to-meter-reset <1 s, and the existing mixer comparison's ≤20% regression
limit. These are different boundaries; do not combine them into one end-to-end claim.
New stage budgets and required improvement thresholds must be declared before candidate
results; step 0 should supply the missing baseline rather than invent a speedup target.

Keep deterministic work-count, lifetime, equality and history assertions in ordinary CI.
Elapsed-time/FPS/throughput acceptance belongs only in opt-in suites. After implementation,
run affected package tests first, app main build for main changes, and workspace `pnpm test`,
`pnpm lint`, and `git diff --check` for changes spanning packages/shared behavior. Add native
correctness and real-engine tests for native/protocol work; run relevant browser suites for
rendering/gestures. Cross-platform readback/process changes require supported Windows/Linux
coverage as well as macOS, especially where IPC transport differs.

### Constitution, ownership and provenance check

Pre-research constraints and post-audit design assessment:

| Principle                         | Assessment / implementation requirement                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portable data / strict boundaries | Pass for this document. Future data changes stay host-neutral with static imports; native processes, files and ZeroMQ remain in main/client. Renderer binary codecs must be separately browser-safe.                                                                                                                                                                                                                   |
| Java behavior and serialization   | No serialized format changes proposed in the initial work. Automation output is constrained by Java fixtures. Note/BSB/XML changes are deferred pending explicit compatibility research.                                                                                                                                                                                                                               |
| Canonical ownership / history     | Main retains BlueData; graph deltas remain isolated undo data. Section publications are disposable projections, not a second model owner. All durable edits keep canonical history, identity and dirty-state behavior.                                                                                                                                                                                                 |
| Runtime isolation                 | Preserve versioned typed protocol, capability fallback and per-session authority. Bulk installation is atomic; local readback ownership stays entirely native.                                                                                                                                                                                                                                                         |
| Regression evidence               | Focused current tests passed below. Future timing acceptance follows the separate policy; no benchmark acceptance is claimed here.                                                                                                                                                                                                                                                                                     |
| License/provenance                | Reviewed LICENSING.md, component license files/package metadata and notices. App/docs are GPL-3.0-or-later; engine/client and Blue-authored data are MIT, with existing third-party terms unchanged. Plan original implementations within each scope; no added dependencies/assets or copied third-party code. Java GPL headers were inspected as behavioral references, not copied or translated into MIT components. |

For each lifecycle-affecting workstream, record the owner, transitions, failure/stale
event rules, cancellation and idempotent cleanup under the modularization guide:

- Polling: EngineBridge owns timer/in-flight poll for one session; completion only
  publishes while that session remains authoritative; teardown prevents rescheduling.
- Library refresh: the hook owns one active request generation and coalesced follow-up;
  content/session changes invalidate old results; unmount removes subscriptions.
- Culling: the gesture owner survives view changes; active items remain represented;
  cancel restores preview/canonical/runtime state through existing history contracts.
- Bulk definitions/local readback: control/lifecycle thread prepares and publishes;
  performer adopts immutable generations at safe boundaries; reclamation stays off audio.
- Meter consumers: subscription and scheduler owners are per host context with explicit
  visibility, unmount, reset, session replacement and late-frame handling.

No constitutional exceptions are proposed. No external source material is incorporated.
The Java source revision consulted was `3ca3f40579c48a023299a68130d8ab6b9e950974`.

### Original audit validation (before implementation)

- `pnpm --filter @blue/app test src/main/project-history-graph.test.ts src/main/project-history-memento.test.ts src/main/engine-bridge.test.ts src/renderer/tests/meter-store.test.ts src/renderer/tests/meter-canvas.test.tsx src/renderer/tests/meter-stress.test.tsx`: **6 files, 88 tests passed**.
- `pnpm --filter @blue/engine-client test`: **4 files, 47 tests passed**.
- `pnpm --filter @blue/data test src/instruments/blue-synth-builder/bsb-compilation-replacements.test.ts src/sound-objects/note.test.ts`: **2 files, 11 tests passed**.
- These runs were concurrent functional checks, not controlled performance measurements.
  No production changes were made, so full workspace tests/builds were not rerun.

Verdict: start with bounded polling, structural history preparation and dense automation
lookup; measure publication/setup costs before larger protocol or renderer changes.

Lean: one full project copy per general structural preparation and one after-graph walk
can potentially be removed, plus decoder intermediates and unnecessary refresh/poll work.
No reliable line-count reduction is established; no new dependency is needed for initial work.

Not checked: exhaustive codebase/security audit, native execution or Csound/audio output on
this machine, browser/Electron interaction, actual heap/CPU profiles, native Windows/Linux
behavior, external shared-memory clients, all Java loader/writer history, or the full
workspace suite. Native source, existing benchmark/test seams, renderer paths, history,
library queries and relevant Java behavioral references were inspected. There was no
`native/blue-engine/build` directory; no native build was attempted for this planning audit.

### Final implementation verification

The implementation and formatting fix are committed on `codex/120-optimize-runtime-work`.

| Commit | Change |
| --- | --- |
| `df60a270` | Reuse engine automation definitions and bound point lookup |
| `aa694ea5` | Bound engine polling and batch startup channel writes |
| `a0f5138c` | Avoid redundant project copies and graph walks |
| `80a436ed` | Batch library breadcrumb queries and coalesce refreshes |
| `6947c7bf` | Cull offscreen score bars and batch Piano Roll thumbnails |
| `c9813aec` | Decode meter samples directly into arrays |
| `827d09ea` | Format the Piano Roll parity test |

The project owner reported that a quick manual smoke test looked good. Before committing,
114 focused app tests, all 48 engine-client tests, and four native automation and decimal
test targets passed.

See [quickstart results](quickstart.md#results) for commands, counts, retained diagnostic
samples and failures. App 6,287; data 3,152; client 48; CLI 22; scripts 72; native 14
CTest targets plus 38 script tests; Java and 17 focused browser checks passed. Main,
renderer type checks and client builds passed. Root lint passed after the Piano Roll parity
test formatting fix. Optional native and app audio acceptance runs have the documented
utility/fixture prerequisites. Controlled speed acceptance and Windows/Linux execution
are not claimed. The pre-existing untracked timing probe was preserved and excluded.
