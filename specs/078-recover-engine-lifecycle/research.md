# Research: Recover Blue Engine Lifecycle

## Immutable Session Module

**Decision**: Replace bridge-wide mutable process/client/manifest fields with one captured `EngineSession` and an `activeSession` identity check. Put spawn, readiness, listener ownership, exit observation, and idempotent shutdown behind a narrow main-process module.

**Rationale**: The existing old-child exit callback reads and clears whichever bridge fields are current, allowing a delayed exit to disconnect a replacement and remove its record. Session-local capture fixes the complete asynchronous ownership problem and creates a deterministic test seam.

**Alternatives considered**: An identity check only in the exit callback leaves registration, stderr, error, client, and fallback races. Global Node-module mocking leaves hard delays and private state ordering brittle.

## Shutdown Semantics

**Decision**: Use one idempotent `shutdownSession()` operation that disconnects, requests graceful termination, awaits exit, escalates after a timeout, awaits again, and removes only the captured manifest after confirmed exit.

**Rationale**: Sending a signal is not evidence of process exit. Replacement startup, Blue Live cleanup, and app shutdown require a real terminal outcome.

**Alternatives considered**: Immediate force-kill plus a fixed delay is scheduler-dependent. Immediate record removal destroys evidence needed to recover an engine that survives signaling.

## Manifest and Process Identity

**Decision**: Add a random session identifier to a versioned manifest and require recorded ownership plus matching current process identity before signaling a recovered PID. Keep live other-owner sessions and treat unverifiable identity conservatively.

**Rationale**: PIDs can be reused, command inspection can fail, and late callbacks can act on the wrong record. A token carried in arguments and manifest strengthens identity without broad discovery.

**Alternatives considered**: PID/dead-owner status alone can target a reused PID. Executable-name killing is unsafe with legitimate concurrent Blue apps.

## TCP Endpoint Allocation

**Decision**: Keep unique IPC paths and allocate two independent loopback TCP candidates per launch, with bounded fresh-pair retries after classified bind failure.

**Rationale**: Fixed ports collide across Windows app instances, forced TCP, compatibility fallback, and ghosts. Independent candidates avoid assuming adjacent ports are free; engine bind remains authoritative.

**Alternatives considered**: Killing the fixed-port occupant can stop another app. Temporary Node reservation still has a bind race. Native random-port discovery would require another bootstrap channel and is deferred.

## Recovery Policy and UX

**Decision**: Keep policy in Electron main. One playback request gets one automatic retry and a typed display-only status. A second failure offers Restart Audio Engine, Show Diagnostics, and Cancel. Diagnostics use the existing Csound output panel.

**Rationale**: Main owns playback serialization, processes, dialogs, and output. A keyed renderer status gives timely feedback without exposing process controls.

**Alternatives considered**: Requiring another Play click undermines recovery. Renderer-owned policy leaks host control across the seam. A separate diagnostic window duplicates existing output infrastructure.

## Owner-Loss Detection

**Decision**: Add a capability-gated native `--owner-pid` monitor. Linux uses parent-death notification plus immediate validation, macOS uses exact process-exit observation, and Windows waits on an exact process handle. Owner loss requests normal engine shutdown.

**Rationale**: Native observation responds after abrupt Electron termination without waiting for a later app launch and minimizes PID-reuse risk while preserving normal cleanup.

**Alternatives considered**: Startup sweep alone reacts too late. Polling adds latency and identity machinery. An inherited lifetime pipe has watcher/Windows descriptor complexity. Windows Job Objects require an Electron addon or launcher.

## Compatibility and Verification

**Decision**: Advertise owner monitoring in the existing feature list and pass its argument only when supported. Test the session module with injected children/timers, test native monitoring on supported platforms, and retain startup sweep coverage for legacy engines.

**Rationale**: Older external engines reject unknown options. Deterministic fake-process tests reproduce race ordering cheaply; native CI proves OS behavior.

**Alternatives considered**: Making owner PID mandatory breaks legacy engines. A wire-protocol bump is unnecessary because this is a launch capability covered by existing negotiation.
