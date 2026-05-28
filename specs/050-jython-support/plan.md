# Implementation Plan: Jython Runtime Support

**Branch**: `050-jython-support` | **Date**: 2026-05-28 | **Spec**: [/Users/stevenyi/work/blue-electron/specs/050-jython-support/spec.md](/Users/stevenyi/work/blue-electron/specs/050-jython-support/spec.md)  
**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/050-jython-support/spec.md`

## Summary

Extend the SPEC 049 Java helper from Clojure-only execution to shared JVM runtime execution with a project-scoped Jython session. The helper will add Jython 2.7, package Java Blue's `blue-ext-jython/src/main/release/pythonLib` assets, expose Jython protocol methods over the existing runtime client, and let Electron main inject the Java runtime into async `@blue/data` render/test paths. The slice makes PythonObject, Python-language ObjectBuilder, PythonInstrument, and PythonProcessor executable while keeping `@blue/data` browser-safe and preserving project XML when Java/Jython is unavailable.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x, Java 17+ helper runtime target, Maven 3.x, Jython 2.7.4  
**Primary Dependencies**: Existing `@blue/data`, `@blue/app`, `@blue/java-runtime`, Node `zeromq`, Java JeroMQ, Jackson, Clojure 1.12.x from SPEC 049, `org.python:jython-standalone:2.7.4`, Java Blue `blue-ext-jython/src/main/release/pythonLib`, Vitest 4.x, JUnit 5  
**Storage**: `.blue` XML remains canonical project persistence; helper runtime assets live under `packages/blue-app/assets/java/` as `blue-java.jar` plus packaged `pythonLib`; Jython interpreter state is transient project-session state; user Python library remains outside project XML  
**Testing**: JUnit for helper-side Jython session, imports, score/instrument/processor evaluation, reinitialize, and error paths; Vitest for `@blue/data` runtime contract, PythonObject/ObjectBuilder/PythonInstrument/PythonProcessor XML/runtime integration, Electron main session/path handling, and app renderer/editor status where touched  
**Target Platform**: Electron desktop app with user-installed Java on macOS, Linux, and Windows; local loopback Java helper protocol from Electron main  
**Project Type**: Monorepo desktop application with existing pure TypeScript data package, Electron main/renderer app, and Maven Java helper package  
**Performance Goals**: Reuse one project-scoped helper process and one persistent Jython interpreter per active project; Jython import health check within 2 seconds after helper readiness; avoid launching Java or Jython per object or processor request  
**Constraints**: Java Blue remains parity source; `@blue/data` must not import Node built-ins, use `require()`, use dynamic `import()`, or launch Java; Java/Jython processing is optional and must fail clearly; Jython user code is trusted project code, not sandboxed; existing Clojure runtime behavior must continue passing  
**Scale/Scope**: One active project session; four executable Jython surfaces in this slice: PythonObject, Python-language ObjectBuilder, PythonInstrument, and PythonProcessor; Python console UI remains out of MVP scope except reinitialize/status plumbing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Data-First, UI-Separated**: PASS. `@blue/data` owns PythonObject/ObjectBuilder/PythonInstrument/PythonProcessor models, XML, and async generation hooks; Electron main owns process/assets/session lifecycle.
- **Backwards-Compatible Serialization**: PASS. Python-backed XML must preserve Java Blue shapes and tests must cover round trips before runtime execution.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Jython remains in the Java helper process, matching the constitution's Java subprocess direction for JVM runtimes.
- **Engine as External Process**: PASS. Csound engine and blue-engine protocols remain untouched; this extends the separate Java helper from SPEC 049.
- **Test-First for Serialization**: PASS. Tasks require XML/deep-copy tests before runtime execution work and explicit Jython processing unit tests as exit criteria.
- **Research Integration**: PASS. Plan decisions are based on Java Blue `PythonProxy`, `PythonObject`, `ObjectBuilder`, `PythonInstrument`, `PythonProcessor`, and `blue-ext-jython` source review.

## Project Structure

### Documentation (this feature)

```text
/Users/stevenyi/work/blue-electron/specs/050-jython-support/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── java-runtime-jython-protocol.md
├── checklists/
│   └── requirements.md
├── status.md
└── tasks.md
```

### Source Code (repository root)

```text
/Users/stevenyi/work/blue-electron/packages/blue-java/
├── pom.xml
├── src/main/java/com/kunstmusik/bluejava/
│   ├── jython/
│   │   ├── JythonSession.java
│   │   ├── JythonLibraryPath.java
│   │   ├── JythonEvaluationException.java
│   │   ├── JythonNote.java
│   │   └── JythonNoteList.java
│   ├── protocol/RuntimeMethod.java
│   ├── session/ProjectSession.java
│   └── transport/JeroMqRuntimeServer.java
├── src/main/resources/jython/pythonLib/
└── src/test/java/com/kunstmusik/bluejava/jython/

/Users/stevenyi/work/blue-electron/packages/blue-app/
├── assets/java/
│   ├── blue-java.jar
│   └── pythonLib/
└── src/main/java-runtime/
    ├── java-runtime-client.ts
    ├── java-runtime-path.ts
    ├── java-runtime-protocol.ts
    └── java-runtime-session.ts

/Users/stevenyi/work/blue-electron/packages/blue-data/src/
├── java-runtime.ts
├── sound-objects/
│   ├── python-object.ts
│   └── object-builder.ts
├── instruments/python-instrument.ts
└── note-processors/
    ├── python-processor.ts
    ├── note-processor-chain.ts
    └── note-processor-snapshot.ts
```

**Structure Decision**: Reuse `packages/blue-java` and Electron main runtime modules from SPEC 049. Add a `jython/` helper package beside `clojure/`, extend `ProjectSession` to own both runtime sessions, and extend the shared protocol with Jython methods. Copy Java Blue `pythonLib` into both Java resources and Electron app assets so tests can verify packaged content and the helper can receive a filesystem library root. Keep all Node/process logic out of `@blue/data`.

**Runtime Error Mapping Decision**: Add a new Electron main `java-runtime-errors.ts` module to classify helper and transport failures into stable shared/Jython codes before they reach renderer or score-object test surfaces. The minimum Jython code set is `JYTHON_UNAVAILABLE`, `JYTHON_LIBRARY_PATH_ERROR`, `JYTHON_IMPORT_ERROR`, `JYTHON_SYNTAX_ERROR`, `JYTHON_EVALUATION_ERROR`, `JYTHON_PROCESSOR_ERROR`, `JYTHON_SERIALIZATION_ERROR`, `JYTHON_TIMEOUT`, `JYTHON_HELPER_EXITED`, and `JYTHON_OUTPUT_PROTOCOL_VIOLATION`, while retaining SPEC 049 shared codes such as `AUTH_FAILED`, `PROTOCOL_ERROR`, `TRANSPORT_ERROR`, `INVALID_RESPONSE_PAYLOAD`, and `INTERNAL_SERVER_ERROR`. Tests must assert that user stdout/stderr is captured inside response fields and never creates extra protocol frames or invalid JSON payloads.

## Complexity Tracking

No constitution exception is required.

## Phase 0 Research Output

See [/Users/stevenyi/work/blue-electron/specs/050-jython-support/research.md](/Users/stevenyi/work/blue-electron/specs/050-jython-support/research.md).

## Phase 1 Design Output

- [/Users/stevenyi/work/blue-electron/specs/050-jython-support/data-model.md](/Users/stevenyi/work/blue-electron/specs/050-jython-support/data-model.md)
- [/Users/stevenyi/work/blue-electron/specs/050-jython-support/contracts/java-runtime-jython-protocol.md](/Users/stevenyi/work/blue-electron/specs/050-jython-support/contracts/java-runtime-jython-protocol.md)
- [/Users/stevenyi/work/blue-electron/specs/050-jython-support/quickstart.md](/Users/stevenyi/work/blue-electron/specs/050-jython-support/quickstart.md)

## Post-Design Constitution Check

- **Data-First, UI-Separated**: PASS. The data model defines pure project entities and runtime contracts; helper/session details stay in Java/Electron main.
- **Backwards-Compatible Serialization**: PASS. Design keeps XML preservation and deferred behavior available when runtime execution is missing.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Jython 2.7 is executed in the Java helper, not reimplemented in TypeScript.
- **Engine as External Process**: PASS. No change to blue-engine or Csound engine execution.
- **Test-First for Serialization**: PASS. Tasks require XML/model tests before Jython runtime implementation and JUnit/Vitest processing tests before closeout.
- **Research Integration**: PASS. Research decisions cite Java Blue source anchors and existing TypeScript package gaps.
