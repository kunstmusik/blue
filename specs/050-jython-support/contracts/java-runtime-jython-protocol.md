# Contract: Java Runtime Jython Protocol

This contract extends the SPEC 049 Java runtime request/response protocol. Existing Clojure methods remain unchanged.

## Shared Envelope

### Request

```ts
interface JavaRuntimeRequestEnvelope<TParams extends Record<string, unknown>> {
  id: string;
  method: JavaRuntimeMethod;
  authToken: string;
  params: TParams;
}
```

### Response

```ts
type JavaRuntimeResponseEnvelope<TResult> =
  | {
      id: string;
      ok: true;
      result: TResult;
      stdout: string;
      stderr: string;
      elapsedMs: number;
    }
  | {
      id: string | null;
      ok: false;
      error: JavaRuntimeErrorEnvelope;
      stdout: string;
      stderr: string;
      elapsedMs: number;
    };

interface JavaRuntimeErrorEnvelope {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  line?: number;
  column?: number;
}
```

## Session Initialization Additions

`session.init` keeps existing Clojure fields and adds optional Jython library fields.

```ts
interface JavaRuntimeSessionInitParams {
  projectSessionId: number;
  projectDir: string | null;
  clojureDependencies?: JavaRuntimeDependencySpec[];
  jythonPythonLibRoot?: string | null;
  jythonUserPythonLibRoot?: string | null;
}

interface JavaRuntimeSessionInitResult {
  projectSessionId: number;
  clojureNamespace: string;
  dependenciesLoaded: JavaRuntimeDependencyLoadResult[];
  jythonReady?: boolean;
  jythonLibraryPaths?: string[];
}
```

## Methods

### `jython.importCheck`

Verifies interpreter readiness and module imports.

```ts
interface JythonImportCheckParams {
  modules: string[];
}

interface JythonImportCheckResult {
  importedModules: string[];
  libraryPaths: string[];
}
```

Required MVP modules: `orchestra`, `pmask`.

### `jython.evalScript`

Evaluates generic Jython code in the project session.

```ts
interface JythonEvalScriptParams {
  code: string;
  bindings?: Record<string, unknown>;
  returnVariableName?: string | null;
}

interface JythonEvalScriptResult {
  value: string;
}
```

Used for direct tests and future script-console work. This is not a substitute for the narrower score/instrument/processor methods.

### `jython.evalScoreObject`

Evaluates PythonObject-compatible score code.

```ts
interface JythonEvalScoreObjectParams {
  code: string;
  blueDuration: number;
  blueProjectDir?: string | null;
}

interface JythonEvalScoreObjectResult {
  scoreText: string;
}
```

Bindings:

- `score`: initialized to an empty string.
- `blueDuration`: object subjective duration as number.
- `blueProjectDir`: saved project directory string with Java Blue-compatible semantics.

### `jython.evalObjectBuilder`

Evaluates Python-language ObjectBuilder code after TypeScript-side BSB replacement.

```ts
interface JythonEvalObjectBuilderParams {
  code: string;
  blueDuration: number;
  commandline: string;
  blueProjectDir?: string | null;
}

interface JythonEvalObjectBuilderResult {
  scoreText: string;
}
```

Bindings:

- `score`: initialized to an empty string.
- `blueDuration`: object subjective duration as number.
- `commandline`: ObjectBuilder command line string.
- `blueProjectDir`: saved project directory string with Java Blue-compatible semantics.

### `jython.evalInstrument`

Evaluates PythonInstrument code.

```ts
interface JythonEvalInstrumentParams {
  code: string;
}

interface JythonEvalInstrumentResult {
  instrumentText: string;
}
```

Bindings:

- `instrument`: initialized to an empty string.

### `jython.processNoteList`

Runs PythonProcessor code against serialized notes and returns the mutated notes.

```ts
interface JythonSerializedNote {
  pfields: string[];
  subjectiveDuration: number;
  tied: boolean;
}

interface JythonProcessNoteListParams {
  code: string;
  notes: JythonSerializedNote[];
}

interface JythonProcessNoteListResult {
  notes: JythonSerializedNote[];
}
```

Adapter requirements:

- `noteList` supports iteration, indexing, and `len(noteList)`.
- Each note supports Java Blue-style `getPField(index)` and `setPField(value, index)` with 1-based p-field indexes.
- Returned note order must match adapter order after script execution.

### `jython.reinitialize`

Clears Jython interpreter state and reapplies packaged/user library paths.

```ts
interface JythonReinitializeParams {}

interface JythonReinitializeResult {
  libraryPaths: string[];
}
```

## Error Codes

The helper SHOULD use stable codes so Electron main and renderer can present actionable diagnostics:

- `JYTHON_UNAVAILABLE`: Jython session has not initialized.
- `JYTHON_LIBRARY_PATH_ERROR`: packaged/user library path is missing or invalid.
- `JYTHON_IMPORT_ERROR`: import check or user import failed.
- `JYTHON_SYNTAX_ERROR`: Jython parser reports invalid source.
- `JYTHON_EVALUATION_ERROR`: generic score/object/instrument evaluation failed.
- `JYTHON_PROCESSOR_ERROR`: PythonProcessor execution failed.
- `JYTHON_SERIALIZATION_ERROR`: note-list request/result conversion failed.
- `JYTHON_TIMEOUT`: client timed out waiting for helper response.
- `JYTHON_HELPER_EXITED`: helper process exited before request completion.
- `JYTHON_OUTPUT_PROTOCOL_VIOLATION`: user stdout/stderr escaped captured output fields or corrupted framing.
- Existing shared codes remain valid: `AUTH_FAILED`, `PROTOCOL_ERROR`, `TRANSPORT_ERROR`, `INVALID_RESPONSE_PAYLOAD`, `INTERNAL_SERVER_ERROR`.

## Compatibility Rules

- Existing Clojure methods and response fields must remain backward-compatible.
- Jython methods are serialized per project session through the same request queue as Clojure methods.
- Captured stdout/stderr must be returned in envelope fields, not written into the ZMQ payload stream outside JSON responses.
- Browser-only callers must not construct these requests directly; they interact through the existing host-injected runtime contract.
