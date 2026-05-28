# Quickstart: Blue Java Runtime Bridge

## Prerequisites

- Node/pnpm environment already used by the repository.
- Maven 3.x available for `packages/blue-java`.
- Java 17+ available for building and running the helper.

## Build Helper Only

```bash
pnpm --filter @blue/java-runtime build
```

Expected result:

- `packages/blue-java/target/blue-java.jar` exists.
- `packages/blue-app/assets/java/blue-java.jar` exists.

Equivalent direct Maven command:

```bash
mvn -f packages/blue-java/pom.xml package
```

## Build App With Helper

```bash
pnpm --filter @blue/app build
```

Expected result:

- `@blue/java-runtime` has built first through the workspace dependency graph.
- `@blue/app` main process can resolve the helper JAR in development layout.

## Helper Smoke Check

After implementation, run:

```bash
java -jar packages/blue-app/assets/java/blue-java.jar --help
```

Expected result:

- The helper prints supported command-line options.
- No Clojure evaluation session starts unless endpoints are supplied.

## Test Helper Package

```bash
pnpm --filter @blue/java-runtime test
```

Expected coverage:

- Protocol request/response serialization.
- Helper health command.
- Auth-token option parsing and request validation.
- Clojure session persistence.
- Clojure reinitialize semantics.
- Dependency metadata input validation before helper-side evaluation.
- Clojure output/error capture.

## Test App Integration

```bash
pnpm --filter @blue/data test
pnpm --filter @blue/app test
```

Expected coverage:

- ClojureObject XML load/save/deep-copy behavior.
- ClojureProjectData plugin XML preservation/parsing.
- Java runtime path resolution.
- Java runtime process launch with project folder CWD.
- Java runtime client protocol, timeout handling, and REQ-socket recovery after transport failures.
- Clojure score-object test/render flow through Electron main.

Focused closeout checks used for the shipped editor and app-bridge slice:

```bash
pnpm --filter @blue/app exec vitest run src/renderer/tests/clojure-object-editor.test.tsx --browser.enabled=false
pnpm --filter @blue/app exec vitest run src/main/java-runtime/java-runtime-session.test.ts src/main/score-object-test.test.ts src/main/score-object-editor-document.test.ts src/main/csd-export.test.ts
```

Expected coverage:

- Dedicated Clojure editor reinitialize control and runtime error messaging.
- Java runtime session lifecycle and dependency init.
- Clojure score-object delegation through the main-process test path.
- Java-aware disk CSD export wiring.

## Manual Parity Scenario

1. Open a saved `.blue` project containing a Clojure object that defines a helper function during on-load processing.
2. Open the dedicated Clojure score-object editor and confirm the Process on Load checkbox plus Reinitialize control are present.
3. Test a later Clojure object that calls the helper function.
4. Confirm generated score text parses into expected notes.
5. Click Reinitialize in the Clojure editor.
6. Test the later object again and confirm it fails until the defining on-load object is reprocessed.

## Project Directory Scenario

1. Save a project in a folder containing `data/notes.txt`.
2. Add Clojure code that reads `data/notes.txt` using a relative path and assigns `score`.
3. Test or render the object.
4. Confirm the helper resolves the file relative to the project folder, not the app folder.

## Future Jython Extension Points

- `packages/blue-java/src/main/resources/jython/` is reserved for future runtime resources.
- The helper transport, process lifecycle, auth-token validation, and per-project session ownership are shared infrastructure that later JVM-backed runtimes should reuse.
- Add new helper methods to the existing JSON/ZMQ envelope instead of introducing a second process protocol.
