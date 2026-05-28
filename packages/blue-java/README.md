# @blue/java-runtime

Optional Java helper runtime for Blue Electron.

## What It Does

- Builds a shaded `blue-java.jar` with Clojure, Jython 2.7.4, Pomegranate, Jackson, and JeroMQ.
- Copies the built JAR into `packages/blue-app/assets/java/blue-java.jar` during the Maven `package` phase.
- Exposes the helper-side transport and project-scoped Clojure and Jython sessions used by Electron main.
- Works with packaged Python libraries under `packages/blue-app/assets/java/pythonLib/` plus the user `pythonLib` directory so Java Blue modules like `orchestra` and `pmask` import without extra setup.

## Commands

From the repository root:

```bash
pnpm --filter @blue/java-runtime build
pnpm --filter @blue/java-runtime test
```

Direct Maven equivalents:

```bash
mvn -f packages/blue-java/pom.xml package
mvn -f packages/blue-java/pom.xml test
```

## Runtime Surface

The helper currently supports these request methods:

- `runtime.health`
- `session.init`
- `clojure.eval`
- `clojure.evalScoreObject`
- `jython.importCheck`
- `jython.evalScript`
- `jython.evalScoreObject`
- `jython.evalObjectBuilder`
- `jython.evalInstrument`
- `jython.processNoteList`
- `clojure.reinitialize`
- `jython.reinitialize`
- `runtime.shutdown`

Electron main owns process lifecycle, Java probing, project-directory CWD setup, and ZeroMQ client serialization. `@blue/data` stays browser-safe and only consumes the abstract runtime contract.

## Jython Runtime Notes

- `session.init` initializes both Clojure and Jython state for the active project session and reports `jythonReady` without tearing down the Clojure side when packaged Python assets are unavailable.
- Jython evaluation supports generic scripts, score objects, Python ObjectBuilder, PythonInstrument, and PythonProcessor note-list mutation using one persistent interpreter per project session.
- Electron main passes both the packaged `pythonLib` root and the user `pythonLib` root so Java Blue import ordering is preserved.
- Stable helper error codes for Jython are `JYTHON_LIBRARY_PATH_ERROR`, `JYTHON_IMPORT_ERROR`, `JYTHON_SYNTAX_ERROR`, and `JYTHON_EVALUATION_ERROR`.
