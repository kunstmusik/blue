# Data Model: Blue Java Runtime Bridge

## JavaRuntimeArtifact

Represents the built helper JAR that the Electron app can launch.

**Fields**
- `artifactPath`: Absolute path to the helper JAR resolved for development or packaged-app layout.
- `version`: Helper version returned by health check or embedded resource.
- `exists`: Whether the artifact was found.
- `isRunnable`: Whether the artifact passed the helper health check.

**Validation**
- `artifactPath` must point to `blue-java.jar`.
- The artifact must be resolved without hard-coding only the development tree.

## JavaRuntimeProcess

Represents one helper subprocess owned by Electron main for the active project lifecycle.

**Fields**
- `pid`: Operating system process id once spawned.
- `projectSessionId`: Current app project session id.
- `projectDir`: Saved project directory, or null for unsaved projects.
- `workingDirectory`: Actual process CWD used at spawn.
- `controlEndpoint`: TCP endpoint used for request/response commands.
- `eventEndpoint`: TCP endpoint used for runtime events if enabled.
- `authToken`: Per-process token used to reject unrelated local connections.
- `status`: `stopped`, `starting`, `ready`, `unavailable`, `error`, or `stopping`.
- `lastError`: Most recent startup or transport error, if any.

**State Transitions**
- `stopped -> starting`: App requests Java runtime for active project.
- `starting -> ready`: Process starts and health check succeeds.
- `starting -> unavailable`: Java executable or helper artifact is missing.
- `starting -> error`: Process exits or health check fails.
- `ready -> stopping -> stopped`: Project closes, switches, or app quits.
- `ready -> error`: Process exits unexpectedly or transport fails.

**Validation**
- `workingDirectory` must be the saved project folder when `projectDir` is available.
- Stale sessions must not be reused after project close, project switch, or save-as to a different folder.

## JavaRuntimeClient

Main-process client responsible for request serialization and response decoding.

**Fields**
- `controlSocket`: Node ZMQ request socket.
- `eventSocket`: Optional Node ZMQ subscriber socket.
- `requestQueue`: Promise chain or equivalent queue for deterministic request ordering.
- `timeoutMs`: Request timeout.
- `sessionId`: Active project session id.

**Validation**
- Only Electron main owns this client.
- Requests must be rejected if the project session id no longer matches the active project.

## RuntimeRequest

Structured command sent from Electron main to the helper.

**Fields**
- `id`: Unique request id.
- `method`: Runtime command name.
- `params`: JSON object specific to the method.
- `authToken`: Token generated when helper process was spawned.

**Validation**
- `id` and `method` are required.
- `authToken` must match the running helper.

## RuntimeResponse

Structured command result returned by the helper.

**Fields**
- `id`: Matching request id.
- `ok`: Boolean success flag.
- `result`: Method-specific result on success.
- `error`: Structured error on failure.
- `stdout`: Captured user/runtime stdout for this request.
- `stderr`: Captured user/runtime stderr for this request.
- `elapsedMs`: Helper-side elapsed request time.

**Validation**
- Failure responses must include `error.code` and `error.message`.
- Evaluation failures should include line/column where available.

## RuntimeError

Structured failure detail.

**Fields**
- `code`: Stable error category such as `JAVA_UNAVAILABLE`, `HELPER_START_FAILED`, `CLOJURE_EVALUATION_ERROR`, `DEPENDENCY_LOAD_ERROR`, `TIMEOUT`, or `PROTOCOL_ERROR`.
- `message`: User-facing summary.
- `details`: Optional diagnostic object.
- `stack`: Optional helper-side stack trace for logs/debug surfaces.
- `line`: Optional source line number.
- `column`: Optional source column number.

## ProjectRuntimeSession

Helper-side state for one active project process.

**Fields**
- `projectSessionId`: App session id.
- `projectDir`: Saved project directory, or null.
- `createdAt`: Session creation timestamp.
- `clojureSession`: Current Clojure runtime session.
- `loadedDependencies`: Dependency coordinates attempted or loaded for this session.

**Validation**
- A process owns at most one active project session in this feature.
- Reinitialize replaces `clojureSession` while preserving process CWD.

## ClojureRuntimeNamespace

Persistent Clojure namespace and classloader state for one project session.

**Fields**
- `namespace`: Generated namespace name.
- `classLoader`: Runtime classloader used for Clojure compilation/loading.
- `dependencyState`: Loaded dependency coordinates and failures.
- `lastReinitializedAt`: Timestamp of most recent initialization.

**Validation**
- Namespace state persists across Clojure object evaluations until reinitialize.
- Reinitialize must produce a fresh namespace distinct from the prior session state.

## ClojureObject

First-class score object containing Clojure code.

**Fields**
- Existing `AbstractSoundObject` fields: name, start time, subjective duration, background color, time behavior, repeat point, note processor chain.
- `clojureCode`: Code evaluated to produce or define score content.
- `onLoadProcessable`: Whether the object should execute during project load/runtime initialization.

**Validation**
- XML type must remain compatible with `blue.clojure.soundObject.ClojureObject`.
- `clojureCode` must round-trip exactly through XML text.
- Rendering must parse returned score text and then apply existing time behavior and note processor semantics.

## ClojureProjectData

Project-level dependency metadata preserved from Java Blue plugin data.

**Fields**
- `libraryEntries`: Ordered list of Clojure dependency coordinates and versions.

**Validation**
- XML must remain compatible with `blue.clojure.project.ClojureProjectData`.
- Empty entries are preserved but ignored for dependency loading.
- Dependency loading failures are surfaced clearly and do not delete metadata.
