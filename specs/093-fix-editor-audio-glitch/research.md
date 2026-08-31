# Phase 0 Research: Glitch-Free Track Instrument Editor Opening

## 1. Root-cause standard and diagnostic architecture

**Decision**: Treat an editor-open operation as causal only when an audible or
captured interruption coincides with an app milestone and/or a budget-relative
engine scheduling gap. Collect opt-in main-process milestones with monotonic time,
bracket selected milestones with the existing `GET_ENGINE_STATE` request to obtain
sample-frame position, and extend compile-gated native performance tracking only
enough to report bounded scheduling-gap events relative to the current k-period
budget.

**Rationale**: Blue Engine calls `csoundPerformKsmps()` directly. Its existing
`PerformanceSampleWindow` is a timing-data ring and shared memory carries control
channels, so neither is evidence of an audio-device buffer underrun. Frame brackets
can associate app work with native progress without adding work to the audio thread
or changing the public protocol. Audible/OS-loopback evidence supplies the missing
user-visible outcome.

**Alternatives considered**:

- Treating a fixed one-millisecond native timing threshold as a dropout signal was
  rejected because the relevant budget varies with sample rate and `ksmps`.
- Adding a public engine command, capability bit, or SHM field was rejected because
  the existing engine-state request is sufficient and an ABI expansion is not
  justified for temporary diagnostics.
- Inferring success from timing alone was rejected because scheduler lateness does
  not prove an audible interruption at the output device.

## 2. Duplicate Track snapshot construction

**Decision**: On an open request, validate the request/session identity and ask the
window manager to focus an existing stable group/track editor before constructing a
snapshot. For a cold open, validate the target/fence in main and let the renderer
request and construct the full document snapshot exactly once.

**Rationale**: The current path creates a full Track snapshot in main before the
manager determines whether a window already exists, and the renderer subsequently
requests/builds the full snapshot again. Avoiding this duplicate work is small,
low-risk, and improves both reused and cold paths while preserving canonical
`BlueData` ownership.

**Alternatives considered**:

- Keeping the eager snapshot as a validation mechanism was rejected because target
  identity can be validated without serializing the complete document.
- Pushing project ownership into the detached renderer was rejected because the
  main document bridge remains the canonical mutation and snapshot boundary.

## 3. Progressive detached-editor startup

**Decision**: Make progressive startup the primary remediation candidate. The Track
window should mount a lightweight shell, accept the document, dynamically load only
the requested editor type, and declare the editor usable before starting optional
instrument-library initialization and live-value observation.

**Rationale**: The detached Track entry currently imports every editor statically
and initializes the complete library store unconditionally, including a snapshot,
subscriptions, and four root browse IPC requests. The production entry eagerly
preloads roughly 2.95 MB of uncompressed JavaScript chunks. Deferring unrelated work
reduces the main/renderer burst at the exact time the audio engine needs consistent
scheduling, without changing engine timing or editor semantics.

**Alternatives considered**:

- Increasing audio buffers first was rejected because it masks rather than removes
  avoidable UI startup contention and changes latency.
- Lazy-loading only the heaviest editor while retaining unconditional library work
  was rejected as an incomplete isolation of the startup burst.
- Loading every editor in advance was rejected because it moves rather than bounds
  resource cost and worsens idle memory.

## 4. Detached BlueX7 runtime status and readback

**Decision**: Add a narrow Track-window runtime-status query/subscription owned by
Electron main. Gate BlueX7 effective-value polling until the requested editor is
usable and playback or Blue Live is actually active; then preserve the established
20 Hz cadence. Measure the first readback batch as its own milestone.

**Rationale**: Contrary to the initial issue report, the current detached Track
window does not receive playback/Blue Live status. Its local stores remain false
because only the main workbench installs the broad IPC listeners and the playback
events are not sent to Track windows. Therefore BlueX7 polling is not part of the
current cold-open baseline. Once correct status propagation is added, the hook's
immediate first batch performs engine control-channel reads from the ZeroMQ thread,
so it must be deferred until editor readiness and evaluated separately.

**Alternatives considered**:

- Installing the workbench's full IPC listener set in each detached editor was
  rejected because it expands unrelated state and coupling.
- Starting polling immediately on renderer mount was rejected because it overlaps
  the most sensitive startup interval.
- Leaving status broken was rejected because detached BlueX7 runtime values would
  remain functionally stale during rendering.

## 5. Conditional prewarmed Track shell

**Decision**: Introduce a reusable shell only if controlled evidence shows a minimal
new `BrowserWindow` remains causal after duplicate work and progressive startup are
fixed. Bound the pool to one Track-only standby shell, replenish only while playback
and Blue Live are stopped, and enforce binding-generation validation and complete
teardown/reset behavior.

**Rationale**: Browser process/window construction can create an unavoidable cold
burst, but a pool adds state-machine and resource complexity. Evidence should decide
whether that complexity is necessary. One standby shell caps idle cost while still
covering the common first-open case.

**Alternatives considered**:

- Keeping every closed editor window was rejected because memory grows with edited
  instruments and stale session state becomes hard to bound.
- Replenishing during active rendering was rejected because it recreates the
  disputed workload at an unsafe time.
- Sharing a generic pool with Effect Interface windows was rejected because the
  entry points, identity, lifetime, and editor-specific reset requirements differ.

If selected, the shell must atomically rekey its group/track identity, increment a
binding generation, remount the editor root, clear queued messages/errors/live
values/library state, reject stale async completions, and destroy itself on binding
or navigation failure. Project, track, group, and application teardown destroy all
matching active and standby windows.

## 6. Effect Interface comparison

**Decision**: Use the non-modal Effect Interface as the primary control and the
modal full effect editor as a secondary reference. Share diagnostic milestone
vocabulary, not a common lifecycle or pooling manager.

**Rationale**: Effect and Track editors share Electron, preload, Vite, and
ready-to-show patterns, making them useful comparative conditions. Their ownership,
identity, modal behavior, and renderer workloads are sufficiently different that a
shared manager would obscure rather than simplify this feature.

**Alternatives considered**:

- Treating the modal effect editor as the only control was rejected because modal
  behavior adds a confound not present in the Track path.
- Refactoring all detached editors into one manager was rejected as an unrelated,
  high-scope architectural change.

## 7. Real-time channel handoff (revised after native audit)

**Decision**: Remove the pending-channel mutex/deque from the perform thread even
before the audible root cause is confirmed. Resolve channel pointers and validate
whole batches on the control thread, publish accepted batches through a fixed-size
generation-fenced SPSC mailbox, and consume at most one complete batch between
k-cycles. Serve runtime reads from the atomic shared-memory mirror. Retain the
lifecycle mutex only on non-real-time create/compile/start/stop/control operations.

**Rationale**: The audit found that `applyPendingChannelBatches()` acquired
`channelMutex_` on the perform thread. The ZeroMQ setter held the same mutex while
updating maps and allocating/enqueuing a `std::vector` batch. That is a real-time
correctness violation and a credible contention bridge, regardless of whether the
Effect Interface is ultimately shown to generate control traffic. Direct channel
pointer writes are already the automation manager's established real-time path.
The mailbox consumer performs no locking, allocation, string lookup, Csound API
call, retry, or unbounded queue drain.

This correction is not itself proof that mutex contention caused the audible
interruption. Each diagnostic attempt now records channel read/write command and
entry deltas so the controlled Effect Interface run can prove or falsify that
specific bridge.

The engine still legitimately contains mutexes, but the audit classifies them by
thread ownership rather than banning synchronization globally. Lifecycle, state,
callback, stopped-performance-summary, automation-writer, and ZeroMQ pending-state
mutexes serialize control-only work or terminal publication; none is acquired in
the active k-cycle loop. The remaining strict real-time caveat is not an explicit
mutex: automation and channel-binding generation changes use atomic operations on
`std::shared_ptr`, whose implementation is not guaranteed by the C++ standard to
be lock-free. Effect opening cannot exercise those generation-change paths unless
it also changes automation definitions or recompiles/rebinds channels, but a later
hardening pass should replace them with preallocated generation slots plus
off-perform-thread reclamation if the project adopts a formal wait-free perform-loop
policy.

Architecturally, the useful seam is a deep real-time control-plane module, not a
collection of mutex-free containers. Its small interface should accept prepared,
generation-tagged publications on the control side and expose one bounded
`consume-at-cycle-boundary` operation on the perform side. Validation, string
lookup, allocation, overflow policy, and reclamation remain hidden in its
implementation and run off the perform thread. `RealtimeChannelMailbox` establishes
that seam for live channel writes; automation/binding snapshot publication is the
remaining deepening opportunity.

**Alternatives considered**:

- Keeping the mutex and merely batching more aggressively was rejected because a
  low-frequency lock acquisition is still unbounded on the real-time thread.
- Sending names through a lock-free queue was rejected because it would retain
  string lookup and possible Csound API work at the k-period boundary.
- Draining the entire mailbox each cycle was rejected because producer traffic
  would make the perform-thread work unbounded.

## 8. Engine scheduling and buffering changes

**Decision**: Defer stronger macOS real-time scheduling and audio-buffer changes
unless a future Csound-side A/B establishes that they are necessary. Keep the
native scheduling policy and default audio buffers unchanged; the only native
production change in this feature is the channel handoff hardening documented in
Section 7.

**Rationale**: The engine already requests `QOS_CLASS_USER_INTERACTIVE`. Stronger
scheduling is platform-specific and potentially affects system behavior; larger
buffers trade responsiveness for tolerance. Both are broader and riskier than
removing a measured editor-startup burst.

**Alternatives considered**:

- Promoting the audio thread to a stronger policy immediately was rejected pending
  proof that scheduler priority, rather than avoidable main/renderer work, is causal.
- Increasing buffers by default was rejected because it alters latency for every
  user and can conceal regressions.

## 9. Effect Interface import timing and transient shell

**Decision**: Begin both Effect Interface dependency candidates immediately and
in parallel with document snapshot loading. Keep their only intentional difference
the imported dependency graph: the legacy candidate imports the full effect editor,
while the isolated candidate imports the interface surface. Render a neutral
application-background shell, with no transient loading label, until the snapshot
and selected component are both ready.

**Rationale**: The first isolated implementation waited for snapshot acceptance
before starting its dynamic import, while legacy started immediately. That timing
difference could reduce overlap with window construction and snapshot IPC, masking
the very startup burst the A/B run is intended to measure. Immediate parallel
imports restore a fair causal comparison without returning the full editor's code,
UDO, and Monaco dependencies to the isolated path. The Track editor already imports
its shared panel eagerly; only its visible loading label required removal.

An informal operator pass heard no glitch in either earlier mode, but the configured
diagnostic file contained no effect run because required environment metadata was
not supplied. That pass is therefore encouraging operational evidence, not causal
evidence for either dependency isolation or the native mailbox.

**Alternatives considered**:

- Keeping the snapshot-gated isolated import was rejected because it changes two
  variables at once: dependency size and burst timing.
- Holding the native window hidden until editor usability was rejected because it
  would mask startup latency and introduce a new window-lifecycle handshake.
- Restoring a visible spinner was rejected because the short-lived label itself was
  the reported UI defect and provides no recovery action or useful progress detail.

## 10. Automated and manual validation strategy

**Decision**: Combine deterministic unit/contract tests with controlled live-audio
trials and packaged-build acceptance. Qualify the workload with a no-open interval,
run at least 10 attempts per diagnostic condition, and accept a candidate only after
30 packaged cold opens—10 per supported editor kind—produce zero interruptions and
meet the 10% latency/CPU/memory gates. Exercise BlueX7 readback for 60 seconds at
20 Hz after readiness. Retain the Spec 072 null-audio benchmark as a regression
guard, not as proof of audible success.

**Rationale**: Lifecycle, sequence, cancellation, and stale-generation properties
are reliable in automated tests. Audio-device behavior and Electron/OS scheduling
must be validated under a real packaged workload. Separating diagnostic controls
from final acceptance makes the causal conclusion reproducible.

**Alternatives considered**:

- Relying only on unit tests was rejected because they cannot reproduce device-level
  audio interruption.
- Relying only on subjective listening was rejected because it is difficult to
  correlate, repeat, or audit.
- Using the null-audio benchmark as the acceptance test was rejected because it
  bypasses the output-device path under investigation.

## 11. AuHAL output handoff, not Blue Engine channel contention

**Decision**: Close the Blue Electron investigation with the former
`channelMutex_` handoff retained as real-time hardening, not as the demonstrated
cause of the Effect Interface interruption. Record Csound's AuHAL output circular
buffer as the external follow-up boundary.

**Rationale**: Three battery runs with the pre-mailbox engine reproduced audible
events while every Effect Interface attempt recorded zero channel commands. Direct
instrumentation then bounded every perform-thread `channelMutex_` acquisition below
one k-period and placed the worst wait outside the confirmed audible attempt. The
confirmed open instead overlapped a 25.466 ms `csoundPerformKsmps` wall-time stall.
A subsequent wall/thread-CPU run correlated suspected opens 17 and 18 with calls
whose non-CPU portions were 16.642 ms, 45.678 ms, and 16.481 ms; the largest call
used only 0.225 ms of thread CPU during 45.902 ms of wall time. Expensive orchestra
computation is therefore not the explanation. The evidence is sufficient to rule
out Blue Engine channel contention for the confirmed event, but not to name one
final Csound lock or callback failure without changing the Csound dependency.

The matching Csound source (`fee3593e4c5f`) shows that AuHAL's producer repeatedly
calls `WriteCircularBuffer` and sleeps for 100 us while the output ring is full;
the CoreAudio render callback is its sole consumer and zero-fills unread output.
The circular buffer's index-space check acquires Csound's `spin_lock_t`, which is
implemented as `os_unfair_lock` on current macOS, from both producer and the
real-time CoreAudio callback. Preemption of the producer while it holds that lock,
or delayed callback consumption more generally, fits the rare battery-sensitive
non-CPU stalls and audible silence. Direct callback underrun/ring-wait evidence and
a stock-versus-SPSC AuHAL comparison remain required before calling that lock the
final root cause.

**Alternatives considered**:

- Reverting the Blue Engine mailbox was rejected as a causal fix because the
  measured effect opens sent no channel traffic and mutex waits did not overlap the
  audible events.
- Calling the long `csoundPerformKsmps` intervals CPU starvation was rejected after
  thread CPU measurements showed that nearly all correlated wall time was non-CPU.
- Increasing `-B` was deferred as a latency-increasing mitigation that could mask
  the callback problem without fixing it.

The Csound A/B is intentionally outside this feature's source scope. It should
be implemented and validated where the pinned Csound source and AuHAL device
module are owned, then referenced from this report if it confirms the lock or
callback mechanism. No Csound source, framework binary, or temporary diagnostic
instrumentation is committed here.
