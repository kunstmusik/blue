# Research: Blue Java Runtime Bridge

## Java Blue Clojure Behavior

**Decision**: Preserve Java Blue's project-scoped Clojure namespace semantics. Each active project receives a persistent Clojure session, and reinitialize replaces that session with a fresh namespace.

**Rationale**: Java Blue's `BlueClojureEngine` maps `BlueProject` instances to `ClojureEngine` instances. The engine creates generated namespaces such as `user0`, interns initial values, evaluates one or more forms, and reads the `score` variable after score-object evaluation. Existing examples rely on earlier Clojure objects defining functions that later objects call.

**Alternatives considered**:
- Evaluate every object in a fresh Java process: rejected because it loses project namespace state and is too slow.
- Evaluate every object in a fresh namespace inside one process: rejected because it breaks Java Blue project-level composition patterns.
- Port Clojure to TypeScript: rejected because the constitution requires preserving JVM-dependent behavior through Java processing.

## Helper Process Scope

**Decision**: Start one Java helper process for the active project lifecycle, with the process working directory set to the saved project folder when available.

**Rationale**: CWD is process-level in Java, and the app currently has one active project document at a time. A per-project process makes project-relative file behavior straightforward and avoids cross-project namespace/dependency leakage.

**Alternatives considered**:
- One global helper process with multiple sessions and per-request directory values: rejected because relative file operations in arbitrary user code use process CWD, not only an injected projectDir variable.
- Launch a helper for each evaluation: rejected for performance and persistent namespace reasons.
- Use the Electron process CWD: rejected because it would not match Java Blue project-relative behavior.

## Communication Transport

**Decision**: Use JeroMQ in the Java helper and Node `zeromq` in Electron main over TCP loopback endpoints. Use a JSON request/response protocol for control commands and an optional event stream for runtime status/output.

**Rationale**: The app already uses ZMQ-style subprocess communication for `blue-engine`, so operational patterns are familiar: spawn process, pass endpoints, connect client, set timeouts, and clean up on exit. TCP loopback is the safest cross-language transport because JeroMQ's IPC transport is not native libzmq-compatible in the same way as TCP.

**Alternatives considered**:
- HTTP local server: simpler to debug, but introduces a second local RPC stack despite existing ZMQ use.
- stdio JSON-RPC: rejected because Clojure/Jython user code can write to stdout/stderr and corrupt the protocol unless every runtime path is perfectly captured.
- Native libzmq Java bindings: rejected because they complicate packaging and platform support compared with pure-Java JeroMQ.
- Reuse blue-engine binary protocol: rejected because Java runtime commands are text/diagnostic-heavy and do not benefit from the engine command framing.

## Protocol Shape

**Decision**: Define a helper-specific JSON protocol with explicit request ids, method names, params, success responses, structured errors, captured stdout/stderr, and elapsed time.

**Rationale**: Clojure evaluation returns text and rich diagnostics. JSON keeps the first implementation understandable and allows future Jython commands to reuse the same envelope without changing the transport.

**Alternatives considered**:
- Raw strings for eval only: rejected because lifecycle, diagnostics, timeouts, and future runtime types need typed commands.
- Binary payloads from the start: rejected because score text and diagnostic metadata are the primary payloads.

## Packaging

**Decision**: Add `packages/blue-java` with Maven Shade producing a non-minimized fat JAR named `blue-java.jar`, and copy that artifact into `packages/blue-app/assets/java/blue-java.jar` during the Maven package phase. Wrap the Maven package with a minimal `package.json` so pnpm workspace builds can invoke it.

**Rationale**: Maven is the natural dependency/build tool for Clojure, JeroMQ, Pomegranate, and future Jython resources. A pnpm wrapper integrates the helper into existing monorepo build commands without introducing a root Maven aggregator.

**Alternatives considered**:
- Build Java from the app package with shell scripts: rejected because Maven dependency management and test lifecycle belong with Java code.
- Root Maven multi-module project: rejected because the repo is primarily a pnpm workspace and only one Java helper package is required.
- Minimized shaded JAR: rejected because Clojure and future Jython use dynamic loading/reflection patterns that minimization can break.

## Clojure Dependencies

**Decision**: Preserve and parse Java Blue `ClojureProjectData` from project `pluginData`, and load declared dependencies through the helper before project render/evaluation when Java processing is available.

**Rationale**: Existing Java Blue projects can declare Clojure libraries such as `kunstmusik/score`. Without dependency loading, those projects may load but fail at render time even when Java is installed.

**Alternatives considered**:
- Ignore ClojureProjectData in the first slice: rejected because examples and real projects can depend on it.
- Vendor all possible project libraries: rejected because user project dependencies are open-ended.
- Require users to configure classpaths manually: rejected for parity and ergonomics.

## `@blue/data` Boundary

**Decision**: Keep `@blue/data` free of process/socket code. Add pure ClojureObject and ClojureProjectData models plus an abstract runtime evaluation hook that Electron main can provide during render/test flows.

**Rationale**: The constitution forbids Node built-ins and JVM process dependencies in `@blue/data`. Browser and Java-missing environments must still load/save projects.

**Alternatives considered**:
- Directly import a Java runtime client in `@blue/data`: rejected by constitution.
- Leave ClojureObject as an unknown/fallback object: rejected because first-class XML/edit/render support is required for parity.

## Error and Output Capture

**Decision**: Capture runtime stdout/stderr around each evaluation and return output with the response while keeping helper process stdout/stderr reserved for helper diagnostics.

**Rationale**: User code commonly prints during scripting. Capturing language-level output prevents protocol corruption and gives the UI/action caller useful diagnostics.

**Alternatives considered**:
- Let user output go to process stdout: rejected because it can interfere with process supervision and makes per-request diagnostics ambiguous.
- Suppress user output: rejected because print debugging is useful in REPL/evaluation workflows.

## Deferred Jython Support

**Decision**: Create shared helper lifecycle, transport, protocol, and session abstractions now, but implement only Clojure engine commands in this feature.

**Rationale**: The same helper will later support Jython, but adding Jython runtime resources and PythonObject/PythonInstrument/PythonProcessor execution would expand scope substantially.

**Alternatives considered**:
- Implement Jython simultaneously: rejected to keep the first Java runtime bridge focused and reviewable.
- Make a Clojure-only helper with no shared abstractions: rejected because it would duplicate process/protocol work for Jython later.
