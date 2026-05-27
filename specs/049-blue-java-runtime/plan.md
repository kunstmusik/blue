# Implementation Plan: Blue Java Runtime Bridge

**Branch**: `049-blue-java-runtime` | **Date**: 2026-05-26 | **Spec**: [/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/spec.md](/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/spec.md)
**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/spec.md`

## Summary

Add an optional Java runtime helper for Java-dependent Blue parity, starting with Clojure sound objects and leaving an explicit extension path for Jython. The implementation creates a Maven-owned `packages/blue-java` package that builds a shaded `blue-java.jar` with Clojure and JeroMQ, copies it to `packages/blue-app/assets/java/blue-java.jar`, and lets Electron main launch one helper process for the active project using the project folder as process CWD. Electron main communicates with the helper over local ZeroMQ/JeroMQ TCP endpoints, owns lifecycle and diagnostics, and bridges Clojure evaluation into the existing project/render/test flows without adding Node.js or Java process dependencies to `@blue/data`.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x, Java 17+ helper runtime target, Maven 3.x build  
**Primary Dependencies**: `@blue/data`, `@blue/app` Electron main/preload/renderer IPC, Node `zeromq` in Electron main, Java JeroMQ, Clojure 1.12.x, Pomegranate for Java Blue Clojure dependency metadata, Jackson or equivalent JSON binding inside the helper, Vitest 4.x, JUnit 5  
**Storage**: `.blue` XML remains canonical project persistence; `BlueData` remains main-process canonical project document; Clojure project dependency metadata remains in `pluginData`; helper JAR is a build artifact copied into `packages/blue-app/assets/java/`  
**Testing**: Maven/JUnit for helper protocol and Clojure session behavior; Vitest for `@blue/data` ClojureObject XML and app main-process Java runtime client/lifecycle; renderer tests for Clojure editor/status surfaces where UI is touched  
**Target Platform**: Electron desktop app with user-installed Java; Java helper process on macOS, Linux, and Windows using local TCP loopback endpoints  
**Project Type**: Monorepo desktop application with one new Maven Java helper package plus Electron main-process bridge code  
**Performance Goals**: Helper health check within 2 seconds after Java process start; project-scoped Clojure session reused across object evaluations; avoid launching Java per Clojure object; Clojure evaluation requests serialized per active project session  
**Constraints**: Java Blue remains parity source; no Node.js built-ins, `require()`, dynamic `import()`, or Java process awareness in `@blue/data`; helper process CWD must be the saved project folder; Java processing is optional and must fail clearly when unavailable; user Clojure/Jython code is trusted project code rather than a security sandbox; Jython support is deferred but architecture must not be Clojure-only  
**Scale/Scope**: One active Electron project session; one helper process per active saved/unsaved project lifecycle; ClojureObject load/save/edit/generation support; Clojure project dependency loading; runtime health, reinitialize, shutdown, diagnostics, and packaging workflow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Data-First, UI-Separated**: PASS. `@blue/data` owns ClojureObject data/XML and pure score transformations; Electron main owns Java process lifecycle and I/O.
- **Backwards-Compatible Serialization**: PASS. ClojureObject and ClojureProjectData preserve Java Blue XML shape, with tests required before runtime integration.
- **JVM Dependencies Preserved, Not Replaced**: PASS. The feature implements the constitution's Java subprocess path for Clojure rather than attempting a native TS Clojure runtime.
- **Engine as External Process**: PASS. The blue-engine protocol remains unchanged; this feature adds a separate helper process and separate client.
- **Test-First for Serialization**: PASS. Tasks require ClojureObject and plugin dependency XML tests before runtime/render behavior.
- **Research Integration**: PASS. Java Blue Clojure sources and current Electron/ZMQ process patterns drive the plan.

## Project Structure

### Documentation (this feature)

```text
/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── java-runtime-zmq-protocol.md
├── checklists/
│   └── requirements.md
├── STATUS.md
└── tasks.md
```

### Source Code (repository root)

```text
/Users/stevenyi/work/blue-electron/packages/blue-java/
├── package.json
├── pom.xml
├── src/main/java/com/kunstmusik/bluejava/
│   ├── BlueJavaMain.java
│   ├── cli/RuntimeOptions.java
│   ├── protocol/
│   │   ├── RequestEnvelope.java
│   │   ├── ResponseEnvelope.java
│   │   ├── EventEnvelope.java
│   │   └── RuntimeMethod.java
│   ├── transport/JeroMqRuntimeServer.java
│   ├── session/ProjectSession.java
│   ├── session/ProjectSessionManager.java
│   ├── clojure/ClojureEngine.java
│   ├── clojure/ClojureSession.java
│   ├── clojure/ClojureLibraryLoader.java
│   └── errors/
│       ├── BlueJavaException.java
│       └── ClojureEvaluationException.java
├── src/main/resources/
│   ├── blue-java-version.properties
│   └── jython/.gitkeep
└── src/test/java/com/kunstmusik/bluejava/
    ├── protocol/
    ├── session/
    └── clojure/

/Users/stevenyi/work/blue-electron/packages/blue-app/
├── assets/java/blue-java.jar
└── src/main/java-runtime/
    ├── java-runtime-path.ts
    ├── java-runtime-process.ts
    ├── java-runtime-client.ts
    ├── java-runtime-protocol.ts
    ├── java-runtime-session.ts
    └── java-runtime-errors.ts

/Users/stevenyi/work/blue-electron/packages/blue-data/src/
├── plugins/clojure-project-data.ts
├── sound-objects/clojure-object.ts
├── sound-objects/register-sound-object-types.ts
└── [Clojure XML/runtime hook tests]
```

**Structure Decision**: Add `packages/blue-java` as a Maven package wrapped by a minimal `package.json` so existing `pnpm -r run build` can invoke Maven. Keep Java process and ZMQ/JeroMQ code in Electron main under `java-runtime/`. Keep `@blue/data` browser-safe by adding only Clojure data/XML models and an abstract runtime hook, never direct process or socket code.

## Complexity Tracking

No constitution exception is required.

## Phase 0 Research Output

See [/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/research.md](/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/research.md).

## Phase 1 Design Output

- [/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/data-model.md](/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/data-model.md)
- [/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/contracts/java-runtime-zmq-protocol.md](/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/contracts/java-runtime-zmq-protocol.md)
- [/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/quickstart.md](/Users/stevenyi/work/blue-electron/specs/049-blue-java-runtime/quickstart.md)

## Post-Design Constitution Check

- **Data-First, UI-Separated**: PASS. The data model keeps Clojure XML in `@blue/data`, while process/client lifecycle remains in Electron main.
- **Backwards-Compatible Serialization**: PASS. Contracts require Java Blue-compatible ClojureObject and ClojureProjectData round trips before execution work.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Java helper implements subprocess execution for JVM runtimes and leaves browser/Java-missing fallback explicit.
- **Engine as External Process**: PASS. Existing blue-engine ZMQ/shared-memory protocol is not changed or coupled to the Java helper.
- **Test-First for Serialization**: PASS. Tasks place XML tests before implementation and runtime tests before UI exposure.
- **Research Integration**: PASS. Research decisions cite Java Blue behavior and current Electron process/ZMQ patterns as implementation anchors.
