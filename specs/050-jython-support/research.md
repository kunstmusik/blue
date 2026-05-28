# Research: Jython Runtime Support

## Java Blue Jython Source Inventory

### PythonProxy is the runtime center

**Source**: `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/scripting/PythonProxy.java`

Java Blue keeps a static persistent `InteractiveInterpreter` plus a separate expression interpreter. `reinitialize()` appends Python library path entries, sets the global PySystemState once, recreates interpreters, imports `site`, and notifies listeners.

Key runtime bindings:

- `processPythonScore(code, subjectiveDuration)`: sets `score` to an empty string, `blueDuration` to the object duration, and `blueProjectDir` to the current project directory string with a trailing separator or empty string.
- `processPythonInstrument(code)`: sets `instrument` to an empty string and returns the final `instrument` binding.
- `processPythonNoteProcessor(noteList, code)`: sets `noteList` to the Java `NoteList` instance and lets code mutate it in place.
- `processScript(code)`: sets `blueData` and `blueProjectDir` for generic scripts.
- `getPythonLibPath()`: exposes `<installed pythonLib>/blue` first, then user configuration `pythonLib`.

**Decision**: Implement a helper-side `JythonSession` with one persistent interpreter per project session, not one interpreter per request. Add a Jython-only reinitialize method that recreates the interpreter and reapplies packaged/user library paths.

**Alternatives considered**:

- New Java process per Jython request: rejected because Java Blue examples rely on persistent interpreter definitions.
- TypeScript/CPython execution: rejected because Java Blue uses Jython 2.7 semantics and Java object interop.

### PythonObject requires score generation plus on-load state

**Source**: `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/soundObject/PythonObject.java`

PythonObject stores `pythonCode`, `onLoadProcessable`, time behavior, repeat point, and note processors. Generation calls `PythonProxy.processPythonScore`, parses score text with `ScoreUtilities.getNotes`, applies the object's note-processor chain, applies time behavior/repeat point, then shifts notes by object start time. `processOnLoad()` calls generation only when `onLoadProcessable` is true.

**Decision**: Mirror the Clojure async pattern already added in SPEC 049: synchronous `generateForCSD()` stays non-executing in pure contexts, while `generateForCSDAsync()` uses the injected Java runtime client for Jython score-object evaluation.

**Test implication**: Unit tests must prove `score`, `blueDuration`, persistent setup definitions, time behavior, and note-processor chaining all work after the runtime returns score text.

### ObjectBuilder uses ScoreScriptEngine and BSB replacements

**Source**: `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/soundObject/ObjectBuilder.java` and `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/scripting/PythonScoreEngine.java`

ObjectBuilder stores `BSBGraphicInterface`, `PresetGroup`, `code`, `commandLine`, `LanguageType`, time behavior, repeat point, comment, and note processors. During generation it creates a `BSBCompilationUnit`, replaces BSB values in `code`, builds init values (`score`, `blueDuration`, `commandline`, `blueProjectDir`), then dispatches by language through `ScoreScriptEngineManager`. For `LanguageType.PYTHON`, `PythonScoreEngine` currently ignores most init values and calls `PythonProxy.processPythonScore(code, blueDuration)`.

**Decision**: Add a pure ObjectBuilder data model now because TypeScript currently only has renderer fallback labels for ObjectBuilder. Execute only `LanguageType.PYTHON` through Jython in this feature; preserve non-Python language settings and XML without claiming full ObjectBuilder language parity.

**Risk**: Java Blue's PythonScoreEngine does not pass `commandline` through to `PythonProxy`, but ObjectBuilder constructs it in init values. The TypeScript feature should include `commandline` in protocol params so future Java-compatible fixes can use it without a protocol break; acceptance should focus on Java-observable score behavior and BSB replacements.

### PythonInstrument returns the `instrument` binding

**Source**: `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/orchestra/PythonInstrument.java`

PythonInstrument stores `instrumentText`, `globalOrc`, `globalSco`, and an `OpcodeList`. `generateInstrument()` evaluates Jython and returns `instrument`, then applies UDO replacement values. TypeScript already has a PythonInstrument data model but `generateInstrument()` returns an empty string.

**Decision**: Extend the runtime contract with `jython.evalInstrument`, then update PythonInstrument generation to use the async CSD path. Keep XML/global text behavior in `@blue/data`.

**Design consequence**: Existing orchestra/CSD generation needs an async instrument generation path, not only async score-object generation.

### PythonProcessor mutates Java NoteList

**Source**: `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/noteProcessor/PythonProcessor.java`, `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/soundObject/NoteList.java`, `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/soundObject/Note.java`

PythonProcessor wraps a `Code` object and calls `PythonProxy.processPythonNoteProcessor(in, code)`. Java `NoteList` extends `ArrayList<Note>`, and Java `Note` exposes `getPField(index)`, `setPField(value, index)`, `getPCount()`, `getStartTime()`, `setStartTime()`, `getSubjectiveDuration()`, and `setSubjectiveDuration()`. Java examples use both Python iteration (`for i in noteList`) and indexing (`noteList[i].getPField(1)`), and mutate p-fields.

**Decision**: Add helper-side Jython adapter classes `JythonNote` and `JythonNoteList` that expose the Java Blue methods used by existing examples and serialize back into TypeScript note DTOs. Do not require full Java Blue core as a helper dependency for this slice.

**Tests required**: At minimum, cover iteration, indexing/`len(noteList)`, `getPField`, `setPField`, duration mutation, and error propagation.

## Python Library Packaging Research

### Java Blue packaging

**Source**: `/Users/stevenyi/work/nbprojects/blue/blue-ext-jython/pom.xml`

Java Blue's `blue-ext-jython` module depends on `org.python:jython-standalone:2.7.4` and packages `src/main/release/pythonLib` into the NetBeans module at target path `pythonLib`.

**Source**: `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/Installer.java`

On startup Java Blue calls `PythonProxy.setLibDir(InstalledFileLocator.getDefault().locate("pythonLib", "jython", false))`.

**Decision**: Add Jython standalone 2.7.4 to `packages/blue-java/pom.xml`. Copy the Java Blue `pythonLib` tree into `packages/blue-app/assets/java/pythonLib` for filesystem import behavior and into Java resources for artifact validation. The helper receives the filesystem path from Electron main during process/session setup.

### Library contents and import names

**Source**: `/Users/stevenyi/work/nbprojects/blue/blue-ext-jython/src/main/release/pythonLib`

The tree currently contains 45 `.py` files, about 232 KB:

- `blue/orchestra/*`: note, performer, score utility, tuning, instruments, and ornamentation helpers.
- `blue/pmask/*`: PMask/CMask-style generators, ranges, masks, quantizers, score events, and random/chaos helpers.
- `blue/jythonconsole/*`: introspection helpers.
- `blue/ScriptingUtils.py`: Swing/Blue UI helper functions.

Java Blue appends `pythonLib/blue` to `sys.path`, so existing project code imports top-level `orchestra`, `pmask`, and `ScriptingUtils`, not `blue.orchestra`.

**Decision**: Runtime health/import tests must import `orchestra` and `pmask` by those top-level names. The package-copy task must preserve the nested `blue/` directory and pass its parent `pythonLib` root to the helper.

**Risk**: Some library files import Java Blue classes such as `blue.time.TempoMap`, `blue.soundObject.pianoRoll.Scale`, `blue.gui.InfoDialog`, and Swing classes. Pure score-generation tests should start with common `orchestra`/`pmask` paths that do not require unavailable Java Blue UI classes. Later parity may need small compatibility classes if real projects exercise those imports.

## Existing TypeScript Gap Inventory

- `packages/blue-data/src/sound-objects/python-object.ts` preserves XML but skips on-load and generation with warnings.
- `packages/blue-data/src/instruments/python-instrument.ts` preserves XML and global text but returns empty generated instrument text.
- `PythonProcessor` is currently preserved as `UnsupportedProcessor`/deferred snapshot and excluded from the addable catalog.
- ObjectBuilder has renderer fallback labels and conversion references, but no first-class `@blue/data` ObjectBuilder model.
- SPEC 049 already created `packages/blue-java`, `packages/blue-app/src/main/java-runtime`, and a `JavaRuntimeClientContract` for Clojure evaluation. This feature should extend that contract rather than create a second helper system.

## Runtime Protocol Decisions

**Decision**: Add these methods to the existing helper protocol:

- `jython.importCheck`
- `jython.evalScript`
- `jython.evalScoreObject`
- `jython.evalObjectBuilder`
- `jython.evalInstrument`
- `jython.processNoteList`
- `jython.reinitialize`

**Rationale**: Distinct methods keep result contracts narrow, let tests target each Java Blue surface, and avoid overloading the current Clojure methods.

**Alternatives considered**:

- Generic `runtime.eval(language, mode, params)`: rejected because it weakens type safety and would require every caller to inspect dynamic payloads.
- Reusing `clojure.eval` envelope names: rejected because errors/status and bindings differ materially.

## Error and Output Decisions

**Decision**: Reuse SPEC 049 response envelopes with Jython-specific stable error codes such as `JYTHON_IMPORT_ERROR`, `JYTHON_EVALUATION_ERROR`, `JYTHON_PROCESSOR_ERROR`, and `JYTHON_LIBRARY_PATH_ERROR`.

**Rationale**: Electron main and renderer already understand structured Java runtime responses, captured stdout/stderr, timeouts, and transport failures.

**Test implication**: Helper-side unit tests must assert malformed code, import failure, missing library path, and processor mutation failure return structured errors without corrupting protocol output.
