# @blue/java-runtime

Optional Java helper runtime for Blue Electron.

## What It Does

- Builds a shaded `blue-java.jar` with Clojure, Pomegranate, Jackson, and JeroMQ.
- Copies the built JAR into `packages/blue-app/assets/java/blue-java.jar` during the Maven `package` phase.
- Exposes the helper-side transport and project-scoped Clojure session used by Electron main.
- Reserves `src/main/resources/jython/` for future Jython resources without mixing Jython work into the first Clojure bridge.

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
- `clojure.reinitialize`
- `runtime.shutdown`

Electron main owns process lifecycle, Java probing, project-directory CWD setup, and ZeroMQ client serialization. `@blue/data` stays browser-safe and only consumes the abstract runtime contract.

## Future Jython Notes

This package is intentionally organized so later JVM-backed runtimes can reuse the same packaging, transport, lifecycle, and project-session ownership model. The `jython/` resource placeholder is reserved for that follow-up work.
