# Contract: Java Runtime ZMQ Protocol

## Transport

Electron main launches `blue-java.jar` with local TCP endpoints:

```text
java -jar blue-java.jar \
  --control-endpoint tcp://127.0.0.1:<port> \
  --event-endpoint tcp://127.0.0.1:<port> \
  --auth-token <token>
```

- Control socket: request/response command channel.
- Event socket: optional publish/subscribe status and output channel.
- Request payloads are UTF-8 JSON.
- Response payloads are UTF-8 JSON.
- Helper process stdout/stderr are reserved for process diagnostics; language-level output is captured in responses and may also be published as events.

## Common Request Envelope

```json
{
  "id": "req-001",
  "method": "runtime.health",
  "authToken": "opaque-token",
  "params": {}
}
```

## Common Success Response

```json
{
  "id": "req-001",
  "ok": true,
  "result": {},
  "stdout": "",
  "stderr": "",
  "elapsedMs": 3
}
```

## Common Error Response

```json
{
  "id": "req-001",
  "ok": false,
  "error": {
    "code": "CLOJURE_EVALUATION_ERROR",
    "message": "Unable to evaluate Clojure code",
    "details": {
      "exceptionClass": "clojure.lang.Compiler$CompilerException"
    },
    "line": 4,
    "column": 12
  },
  "stdout": "",
  "stderr": "",
  "elapsedMs": 12
}
```

## Methods

### `runtime.health`

Verifies the helper is reachable and reports version/capability data.

**Params**

```json
{}
```

**Result**

```json
{
  "version": "0.0.1",
  "capabilities": ["clojure"],
  "cwd": "/path/to/project"
}
```

### `session.init`

Initializes the active project session inside the helper.

**Params**

```json
{
  "projectSessionId": 49,
  "projectDir": "/Users/user/project",
  "clojureDependencies": [
    { "coordinates": "kunstmusik/score", "version": "0.4.0" }
  ]
}
```

**Result**

```json
{
  "projectSessionId": 49,
  "clojureNamespace": "user0",
  "dependenciesLoaded": [
    { "coordinates": "kunstmusik/score", "version": "0.4.0", "status": "loaded" }
  ]
}
```

### `clojure.eval`

Evaluates arbitrary Clojure code in the active project namespace.

**Params**

```json
{
  "code": "(defn f [] 1)",
  "bindings": {
    "score": "",
    "blueDuration": 8.0,
    "blueProjectDir": "/Users/user/project"
  },
  "returnVariableName": null
}
```

**Result**

```json
{
  "value": "user/f",
  "namespace": "user0"
}
```

### `clojure.evalScoreObject`

Evaluates Clojure score-object code and returns score text from the `score` binding.

**Params**

```json
{
  "code": "(def score \"i1 0 2 3 4 5\")",
  "blueDuration": 8.0,
  "blueProjectDir": "/Users/user/project"
}
```

**Result**

```json
{
  "scoreText": "i1 0 2 3 4 5",
  "namespace": "user0"
}
```

### `clojure.reinitialize`

Replaces the current Clojure namespace/session for the active project.

**Params**

```json
{}
```

**Result**

```json
{
  "clojureNamespace": "user1"
}
```

### `runtime.shutdown`

Requests graceful helper shutdown.

**Params**

```json
{}
```

**Result**

```json
{
  "accepted": true
}
```

## Event Envelope

```json
{
  "type": "runtime.status",
  "projectSessionId": 49,
  "timestamp": 1790000000000,
  "payload": {
    "status": "ready"
  }
}
```

## Event Types

- `runtime.status`: Helper startup, ready, stopping, stopped, or error state.
- `runtime.output`: Captured stdout/stderr chunks for long-running commands.
- `runtime.dependency`: Dependency load progress or failure.

## Ordering and Timeout Rules

- Electron main serializes control requests per project session.
- A response id must match the request id.
- If a request times out, Electron main marks the process suspect and may terminate/restart it.
- Cancellation of active Clojure code is process-level: terminate and restart the helper rather than attempting unsafe thread interruption.
