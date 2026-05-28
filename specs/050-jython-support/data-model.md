# Data Model: Jython Runtime Support

## Runtime Entities

### JythonRuntimeSession

Project-scoped helper state for Jython execution.

**Fields**

- `projectSessionId`: active project session id from Electron main.
- `projectDir`: saved project directory, or `null` for unsaved projects.
- `packagedPythonLibRoot`: filesystem root containing the bundled `pythonLib` tree.
- `userPythonLibRoot`: optional filesystem root for user custom Python modules.
- `interpreterNamespace`: persistent interpreter/global state, recreated on reinitialize.
- `libraryPaths`: ordered search paths applied to Jython.
- `capabilities`: advertised runtime capabilities, including `jython`.

**Validation Rules**

- `packagedPythonLibRoot` must exist before import checks can pass.
- The effective search path must include `<packagedPythonLibRoot>/blue` before `userPythonLibRoot`.
- Reinitialize must clear interpreter globals and preserve configured library paths.

**State Transitions**

- `uninitialized` -> `ready`: session init creates Jython interpreter and applies paths.
- `ready` -> `ready`: evaluations mutate persistent globals.
- `ready` -> `ready`: reinitialize recreates interpreter and reapplies paths.
- `ready` -> `disposed`: project close/replace/helper shutdown.

### PackagedPythonLibrary

App-bundled copy of Java Blue's `blue-ext-jython/src/main/release/pythonLib`.

**Fields**

- `sourceRoot`: Java Blue source tree used during development/build copy.
- `assetRoot`: Electron app asset root copied into packaged app.
- `fileCount`: expected `.py` file count for validation.
- `modules`: package/module groups such as `orchestra`, `pmask`, `jythonconsole`, `ScriptingUtils`.

**Validation Rules**

- The copied tree must include all expected `.py` files.
- Top-level imports must resolve through `pythonLib/blue` on the Jython path.

### JavaRuntimeJythonRequest

Structured helper request for Jython work.

**Fields**

- `id`: request id.
- `method`: one of the Jython protocol methods.
- `authToken`: helper auth token from process launch.
- `params`: method-specific params.

**Validation Rules**

- Missing or invalid auth returns `AUTH_FAILED`.
- Unknown methods return protocol errors without crashing helper.
- Method params must be validated before interpreter execution.

### JavaRuntimeJythonResponse

Structured helper result.

**Fields**

- `id`: request id or `null` for malformed request.
- `ok`: boolean success marker.
- `result`: method-specific result for success.
- `error`: stable code/message/details for failure.
- `stdout`: captured output.
- `stderr`: captured error output.
- `elapsedMs`: request duration.

### JythonRuntimeErrorCode

Stable TypeScript-side classification for helper, transport, and user-code failures.

**Fields**

- `code`: one of the stable shared or Jython-specific string constants.
- `source`: `helper`, `transport`, `client`, or `user-code`.
- `message`: user-facing summary suitable for renderer surfaces.
- `details`: optional structured diagnostic fields.

**Required Jython Codes**

- `JYTHON_UNAVAILABLE`: Jython session is not initialized or cannot be used.
- `JYTHON_LIBRARY_PATH_ERROR`: packaged or user Python library path is missing, unreadable, or malformed.
- `JYTHON_IMPORT_ERROR`: import check or user import failed.
- `JYTHON_SYNTAX_ERROR`: Jython parser reports invalid source.
- `JYTHON_EVALUATION_ERROR`: runtime evaluation failed after parsing.
- `JYTHON_PROCESSOR_ERROR`: PythonProcessor note-list execution failed.
- `JYTHON_SERIALIZATION_ERROR`: note-list request/result conversion failed.
- `JYTHON_TIMEOUT`: client request timeout while waiting for helper response.
- `JYTHON_HELPER_EXITED`: helper process exited before completing the request.
- `JYTHON_OUTPUT_PROTOCOL_VIOLATION`: captured user stdout/stderr escaped the response envelope or corrupted framing.

**Shared Codes Reused**

- `AUTH_FAILED`
- `PROTOCOL_ERROR`
- `TRANSPORT_ERROR`
- `INVALID_RESPONSE_PAYLOAD`
- `INTERNAL_SERVER_ERROR`

**Validation Rules**

- Syntax errors should map to `JYTHON_SYNTAX_ERROR` when Jython exposes parse-specific diagnostics; otherwise they may fall back to `JYTHON_EVALUATION_ERROR` with line/column details.
- User stdout/stderr must be returned only in response envelope fields. Tests should fail if output bytes create extra protocol frames or break JSON decoding.
- Transport timeouts and helper exits are client-side classifications and must not be reported as successful helper responses.

## Project Data Entities

### PythonObject

Existing score object containing Jython score-generation code.

**Fields**

- `pythonCode`: script text.
- `onLoadProcessable`: whether project open/on-load processing runs the script.
- `subjectiveDuration`, `startTime`, `timeBehavior`, `repeatPoint`: inherited score-object timing.
- `noteProcessorChain`: object-level processors applied after score text is parsed.

**Runtime Behavior**

- On-load evaluation runs only when `onLoadProcessable` is true.
- Score evaluation returns score text from the Jython `score` binding.
- Generated notes are parsed, processor-chain processed, time-behavior adjusted, and shifted by `startTime`.

### ObjectBuilder

First-class score object model for Java Blue ObjectBuilder XML, with Python-language execution in this slice.

**Fields**

- `code`: source text.
- `commandLine`: external command text preserved for non-Python/external modes.
- `languageType`: `PYTHON`, `JAVASCRIPT`, `CLOJURE`, or `EXTERNAL`.
- `editEnabled`: Java Blue edit flag.
- `graphicInterface`: BSB widget interface used for replacement values.
- `presetGroup`: BSB presets.
- `comment`: ObjectBuilder comment.
- `noteProcessorChain`, timing fields, repeat point.

**Runtime Behavior**

- `languageType = PYTHON` evaluates through Jython after BSB replacements.
- Other language types are preserved and explicitly not made executable by this feature unless already supported elsewhere.
- Generated score text follows PythonObject parsing, processor, time behavior, and start-time handling.

### PythonInstrument

Existing instrument model with Jython-generated instrument body.

**Fields**

- `instrumentText`: Jython script text.
- `globalOrc`: global orchestra text.
- `globalSco`: global score text.
- `opcodeList`: user-defined opcode definitions owned by the instrument.
- inherited instrument metadata: name, enabled, comment.

**Runtime Behavior**

- Jython evaluation returns the `instrument` binding.
- Global orchestra/global score remain generated by the existing instrument methods.
- UDO replacement applies to the returned instrument body.

### PythonProcessor

Executable note processor model for Java Blue PythonProcessor XML.

**Fields**

- `code`: Jython processor code from the XML `<code>` element.
- `originalType`: Java Blue processor type, retained for serialization.

**Runtime Behavior**

- Receives a mutable Jython note-list adapter as `noteList`.
- Mutations serialize back into TypeScript note DTOs and replace the input note list.
- Processor errors are surfaced as note-processor errors with Jython diagnostics.

### JythonNote

Helper-side adapter representing a generated note during PythonProcessor execution.

**Fields**

- `pfields`: ordered string p-fields matching Java Blue's 1-based p-field access.
- `subjectiveDuration`: p3 duration value as Java Blue stores it.
- `isTied`: tied-state derived from negative duration.

**Methods Exposed to Jython**

- `getPField(index)`
- `setPField(value, index)`
- `getPCount()`
- `getStartTime()`
- `setStartTime(value)`
- `getSubjectiveDuration()`
- `setSubjectiveDuration(value)`
- `toString()`

### JythonNoteList

Helper-side adapter that supports Java Blue common note-list usage.

**Fields**

- `notes`: ordered list of `JythonNote`.

**Methods/Behavior Exposed to Jython**

- Python iteration: `for note in noteList`.
- Python indexing and `len(noteList)`.
- Java-style list methods needed by examples: `get(index)`, `set(index, note)`, `add(note)`, `size()`.
- Serialization back to note DTOs for TypeScript.

## Contract Relationships

- `JavaRuntimeClientContract` gains Jython methods while preserving existing Clojure methods.
- `CompileData` continues to carry the runtime client into `@blue/data` async generation without Node imports.
- Electron main resolves `pythonLib` paths and initializes helper sessions; renderer sees only project/editor/status results.
- Clojure and Jython sessions share helper process/session lifecycle but have independent reinitialize operations.
