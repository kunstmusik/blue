# Feature Specification: Recover Blue Engine Lifecycle

**Feature Branch**: `078-recover-engine-lifecycle`

**Created**: 2026-08-18

**Status**: Feature implementation closed; local validation complete; cross-platform CI evidence pending

**Input**: User description: "Prevent rapid Blue Engine stop/start lifecycle races and ghost engines; isolate concurrent Blue app engine sessions; automatically recover managed stale or unresponsive engines before playback; provide Restart Audio Engine and diagnostics UX without terminating healthy engines owned by other app instances; add owner-liveness cleanup and deterministic regression coverage."

## Clarifications

### Session 2026-08-18

- Q: How should engine sessions detect loss of their owning application (FR-020/SC-005)? → A: Operating-system parent-death detection — kill-on-close job assignment on Windows, parent-process watch on macOS/Linux — with no extension of the versioned engine communication protocol required for liveness. *(adopted recommendation)*
- Q: Where do session bookkeeping records persist? → A: The existing per-user OS temporary-directory manifest store, one disposable record per session, owned by the Electron main process; no new persistent store and no migration. *(adopted recommendation)*
- Q: Which engine-backed activities are managed as recoverable sessions? → A: Long-lived interactive sessions only — realtime playback (including auditions) and Blue Live. One-shot render-to-disk, freeze, capability-probe, IO-listing, and utility engine subprocesses remain on their existing bounded one-shot execution paths and are out of scope for the session lifecycle and recovery model. *(adopted recommendation)*
- Q: Which platforms are in scope for FR-025, and where must coverage run? → A: macOS, Windows, and Linux are all in scope; automated regression coverage runs on the existing three-platform CI matrix, and OS-specific termination or identity behavior is additionally validated natively or via injected faults where CI cannot reproduce it. *(adopted recommendation; cross-platform evidence is tracked in Completion Evidence)*
- Q: What does FR-008's "shared runtime identities" mean? → A: All sessions of one application owner share that owner's resolved engine runtime identity — the same engine executable selection — recorded per session for compatibility and diagnostics, while communication addresses stay isolated per session. *(adopted recommendation)*

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play Reliably After Rapid Restarts (Priority: P1)

A musician or automated tester can repeatedly start, stop, and restart playback without an older engine session interfering with the newest session. Every Play request either starts a usable current session or reports a clear failure; it never leaves Blue believing that playback is unavailable while an abandoned engine remains active.

**Why this priority**: The lifecycle race can block all playback and currently requires terminal intervention, making this the core reliability failure.

**Independent Test**: Repeatedly alternate Play and Stop while deliberately delaying prior engine exits. Verify that every accepted Play request connects only to its own current session, late events from earlier sessions have no effect, and all stopped sessions exit.

**Acceptance Scenarios**:

1. **Given** a playback session is stopping but has not yet exited, **When** the user starts playback again, **Then** Blue completes or safely fences the old session before the replacement becomes authoritative.
2. **Given** an older session exits after a newer session has started, **When** its late exit notification arrives, **Then** the newer session remains connected, registered, and available for playback.
3. **Given** a session does not exit after the normal shutdown request, **When** the bounded shutdown period expires, **Then** Blue force-terminates that session, confirms its exit, and continues without leaving an active abandoned process.
4. **Given** 100 rapid Play/Stop cycles including delayed exits, **When** the sequence completes, **Then** no managed engine remains active and no cycle fails because a prior cycle cleared or captured the current session.

---

### User Story 2 - Run Multiple Blue Apps Safely (Priority: P2)

A musician can use two Blue application instances, including realtime playback and Blue Live, without one instance occupying the other instance's engine communication resources or terminating its healthy engines.

**Why this priority**: Multi-instance contention is a plausible source of the reported failure, and an unsafe recovery action could interrupt another project that is playing correctly.

**Independent Test**: Start realtime playback and Blue Live across two application owners, stop and restart sessions independently, and verify that all active sessions remain isolated and recoverable.

**Acceptance Scenarios**:

1. **Given** another live Blue application owns a healthy engine, **When** the current application starts playback or performs recovery, **Then** it does not connect to, alter, or terminate the other application's engine.
2. **Given** the preferred communication address is already occupied, **When** a new session starts, **Then** Blue selects an isolated available address and starts without asking the user to kill processes.
3. **Given** realtime playback and Blue Live run concurrently, **When** either session stops, crashes, or restarts, **Then** the other session remains usable.

---

### User Story 3 - Recover Without Terminal Commands (Priority: P3)

When an engine is stale or unresponsive, a musician receives a brief, understandable recovery status and Blue attempts one safe recovery automatically. If that attempt fails, the musician can restart Blue's audio engine or inspect useful diagnostics from the application instead of running `killall blue-engine`.

**Why this priority**: Automatic recovery removes the common interruption, while explicit controls and diagnostics provide a safe path for failures that cannot be repaired automatically.

**Independent Test**: Arrange an unresponsive managed engine before Play, verify the automatic recovery and retry behavior, then arrange an unrecoverable failure and verify the available actions and diagnostic detail.

**Acceptance Scenarios**:

1. **Given** the current application's engine is unresponsive or a provably orphaned managed engine blocks startup, **When** the user presses Play, **Then** Blue displays a recovering state, cleans up only eligible managed sessions, and retries playback once automatically.
2. **Given** automatic recovery succeeds, **When** the replacement engine becomes ready, **Then** playback starts from the original Play request without another click.
3. **Given** automatic recovery fails, **When** Blue reports the failure, **Then** the user can choose Restart Audio Engine, Show Diagnostics, or Cancel.
4. **Given** the user chooses Restart Audio Engine, **When** other healthy Blue applications own engines, **Then** only stale sessions or sessions owned by the current application are eligible for termination.
5. **Given** the user chooses Show Diagnostics, **When** the diagnostic view opens, **Then** it identifies the failed operation, session ownership, readiness or communication failure, recovery actions attempted, and the final outcome without exposing project content.

### Edge Cases

- The application exits normally while an engine is starting, stopping, or force-terminating.
- The application crashes or is forcibly terminated before its normal shutdown sequence runs.
- An engine exits between a health check and a cleanup action.
- An operating-system process identifier has been reused by an unrelated process.
- The engine process is alive but its communication channel is unavailable or nonresponsive.
- The engine exits successfully but its bookkeeping record or communication artifact cannot be removed.
- A bookkeeping record is missing, incomplete, corrupt, duplicated, or refers to a process whose identity no longer matches.
- Recovery is requested concurrently by playback, Blue Live, shutdown, or multiple user actions.
- No communication address is available within the bounded selection attempt.
- The application lacks permission to inspect or terminate an otherwise eligible engine.
- A late output, state, error, or exit event arrives from a superseded session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Blue MUST treat every engine launch as a distinct session with an immutable identity and ownership association.
- **FR-002**: Blue MUST maintain exactly one authoritative current session for each engine-backed activity and MUST ignore state-changing events from superseded sessions.
- **FR-003**: Each session's process, communication addresses, client connection, diagnostics, and bookkeeping record MUST remain associated with that session until its cleanup completes.
- **FR-004**: Blue MUST NOT allow an earlier session's late output, state, error, or exit event to clear, disconnect, unregister, or change the status of a later session.
- **FR-005**: A shutdown operation MUST wait for the targeted process to exit, subject to a bounded graceful period and a bounded force-termination period, before reporting cleanup complete.
- **FR-006**: Blue MUST retain a session's bookkeeping record until the targeted process is confirmed exited or the record is deliberately retained to enable later recovery.
- **FR-007**: Starting a replacement session MUST be serialized with cleanup of the prior session for the same activity.
- **FR-008**: Realtime, Blue Live, and separate Blue application owners MUST receive isolated communication addresses. All sessions of one application owner MUST share that owner's resolved engine runtime identity — the same engine executable selection — recorded per session for compatibility and diagnostics.
- **FR-009**: If a communication address is unavailable, Blue MUST make a bounded attempt to select another isolated address rather than requiring a fixed global address.
- **FR-010**: Blue MUST determine session eligibility for automatic termination using both recorded ownership and current process identity; process identifier equality alone MUST NOT establish identity.
- **FR-011**: Automatic and user-requested recovery MUST preserve healthy engines owned by other live Blue application processes.
- **FR-012**: Before an engine-backed operation fails for an unavailable or unresponsive session, Blue MUST perform one bounded automatic recovery attempt when it can do so without affecting another live owner.
- **FR-013**: During automatic recovery, Blue MUST expose a non-blocking user-visible recovering status.
- **FR-014**: If automatic recovery succeeds, Blue MUST continue the original requested operation without requiring the user to repeat it.
- **FR-015**: Blue MUST prevent unbounded recovery loops by limiting automatic recovery to one attempt per requested operation.
- **FR-016**: If recovery fails, Blue MUST offer Restart Audio Engine, Show Diagnostics, and Cancel actions.
- **FR-017**: Restart Audio Engine MUST clean up current-owner sessions and provably orphaned managed sessions, then make one fresh attempt to establish the requested engine activity.
- **FR-018**: Show Diagnostics MUST report the operation, session kind and owner, failure category, communication readiness, cleanup or recovery actions, and outcome in copyable form.
- **FR-019**: User-visible errors MUST distinguish at minimum engine executable or runtime unavailability, communication-address contention, readiness timeout, unresponsive session, and cleanup failure.
- **FR-020**: Engine sessions MUST detect loss of their owning application and exit within a bounded interval even when normal application shutdown does not run.
- **FR-021**: Application startup MUST inspect managed session records, remove obsolete records, and terminate only provably orphaned managed engines.
- **FR-022**: Cleanup and recovery operations MUST be idempotent when invoked repeatedly or concurrently.
- **FR-023**: Diagnostic and recovery bookkeeping MUST remain application runtime data and MUST NOT modify the open project or its `.blue` file.
- **FR-024**: Automated coverage MUST reproduce delayed old-session exit after replacement startup, unresponsive shutdown, rapid repeated restart, application-owner loss, address contention, identifier reuse, concurrent realtime and Blue Live, and multiple live application owners.
- **FR-025**: Supported platforms MUST provide equivalent ownership safety, bounded termination, address isolation, recovery, and diagnostic behavior.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue is not the lifecycle authority for this host-owned external process behavior. Existing Blue application playback, Blue Live, engine capability probing, and project-safe failure behavior are the observable baseline.
- **Compatibility Requirements**: Existing engine protocol compatibility, Csound selection, playback and Blue Live behavior, generated CSD, project XML, program settings, and simultaneous realtime/Blue Live support MUST remain unchanged except for improved lifecycle reliability and recovery messages.
- **Intentional Divergences**: None from existing successful playback behavior. Failures that formerly required a terminal command intentionally gain bounded automatic recovery and in-application controls.
- **State Ownership**: The Electron main process remains the canonical owner of engine sessions, process lifecycle, communication addresses, recovery state, and diagnostic bookkeeping. Blue Engine owns its internal performance state. Session records are disposable host runtime data and are not project or program-setting data. The canonical session-record store is the existing per-user OS temporary-directory manifest directory owned by the Electron main process, holding one disposable record per managed session; no diagnostic history beyond live sessions is persisted there.

### Key Entities *(include if feature involves data)*

- **Engine Session**: One engine launch and its immutable identity, activity kind, application owner, process identity, communication addresses, lifecycle state, diagnostics, and bookkeeping record.
- **Engine Owner**: One live Blue application main process that is authorized to operate its sessions.
- **Recovery Attempt**: A bounded response to a failed engine-backed operation, including eligibility decisions, cleanup actions, retry count, and outcome.
- **Engine Diagnostic Report**: A copyable summary of the failed operation and safe operational metadata used to explain recovery or failure.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A deterministic 100-cycle rapid Play/Stop test with delayed prior-session exits completes with 100 successful accepted starts, no cross-session state corruption, and zero remaining managed engine processes.
- **SC-002**: Two live Blue application owners can each run and independently restart realtime or Blue Live sessions for 30 minutes without address collision, cross-connection, or cross-owner termination.
- **SC-003**: Every targeted shutdown completes or reports a specific cleanup failure within 5 seconds; no shutdown remains pending indefinitely.
- **SC-004**: When a safely recoverable stale or unresponsive managed session is injected, at least 99 of 100 Play requests recover and start playback from the original request without terminal intervention.
- **SC-005**: Loss of an engine's owning application results in that engine exiting or becoming eligible for verified cleanup within 5 seconds.
- **SC-006**: All tested late events from superseded sessions leave the current session's connection, registration, and playback status unchanged.
- **SC-007**: In all multi-owner recovery tests, zero healthy sessions owned by another live application are terminated or modified.
- **SC-008**: Every unrecovered failure presents the three recovery actions and a diagnostic report containing all fields required by FR-018.
- **SC-009**: Existing playback, Blue Live, engine capability, generated CSD, and project round-trip regression suites pass without compatibility changes.

## Completion Evidence

Implementation and local validation were closed on 2026-08-18. The repository-wide
`pnpm test` passed, including 338 `@blue/app` test files with 3,182 passing tests
and 2 skipped, 1,626 `@blue/data` tests, 35 engine-client tests, 5 CLI tests,
native CTest coverage, Java tests, and repository script tests. `pnpm lint`, all
three Electron builds, and `git diff --check` also passed.

The final shutdown regression closes the ZeroMQ/N-API teardown race observed after
audition playback: `EngineSession` now awaits socket teardown before app exit,
while `EngineClient` drains in-flight request and subscriber work. Native owner,
endpoint, registry, recovery, Blue Live, multi-owner, and rapid-restart coverage
passed on the local macOS arm64 environment. Windows and Linux native execution
remain CI evidence gates for the existing cross-platform requirement.

## Assumptions

- A session may be automatically terminated only when Blue can verify that it belongs to the current owner or that its recorded owner is no longer live and the process identity still matches.
- One automatic recovery attempt provides useful self-healing without creating a retry loop; further attempts require an explicit user action.
- Five seconds is an acceptable upper bound for engine shutdown or owner-loss cleanup before Blue reports a failure.
- Owner-loss detection relies on operating-system parent-death mechanisms (kill-on-close job assignment on Windows, parent-process watch on macOS/Linux) rather than extending the versioned engine communication protocol.
- Runtime process records and diagnostics are disposable and require no migration or long-term retention.
- Project content, generated orchestra and score text, and user file paths are excluded from the default diagnostic report.
- This feature covers Blue-managed engine processes; arbitrary manually launched `blue-engine` processes are not automatically terminated unless ownership can be proven.
- Managed-session lifecycle and recovery apply to long-lived interactive engine sessions (realtime playback including auditions, and Blue Live). One-shot engine subprocesses — render-to-disk, freeze, capability probing, IO listing, and utility runs — keep their existing bounded one-shot execution behavior and are not managed as recoverable sessions.
- Supported platforms for this feature are macOS, Windows, and Linux. Automated regression coverage runs on the existing CI matrix for all three; OS-specific termination and process-identity behavior additionally receives native verification or injected-fault equivalents where CI cannot reproduce it.
