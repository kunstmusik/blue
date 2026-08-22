# Java Blue Automation Fixtures Generator

Maintainer-only Java oracle that produces the canonical parity corpus committed
at `fixtures/java-blue-automation-parity/v1/`. Normal tests read the committed
corpus; this tool is used only when a maintainer intentionally regenerates it
after a Java Blue reference change.

The generator calls actual Java Blue classes from the pinned checkout rather
than copied formulas:

- `blue.components.lines.Line#getValue(double)` - realtime expectations
- `blue.automation.Parameter#loadFromXML(Element)` / `#saveAsXML()` - XML
  resolution ownership and save text
- `blue.components.lines.LineUtils#snapToResolution(...)` - editor committed
  value snapping
- `blue.ui.core.render.CSDRender#appendParameterScore(...)` (reflection) -
  offline parameter-automation score fragments
- `blue.utility.NumberUtilities#formatDouble(double)` - offline number text

## Reference checkout variables

Generation reads these from the checkout rooted at `$JAVA_BLUE_ROOT`
(default recorded in `fixtures/java-blue-automation-parity/v1/manifest.json`):

| Variable | Value |
|---|---|
| Repository | `https://github.com/kunstmusik/blue.git` |
| Pinned commit | `3ca3f40579c48a023299a68130d8ab6b9e950974` |
| Java release | 25 (validated before execution) |
| Expected source files | recorded with SHA-256 in `manifest.json` under `javaBlue.sourceFiles` |
| Maven modules built | `blue-core`, `blue-ui-core` (with `-am`) |

The wrapper verifies the checkout commit and each recorded source-file SHA-256
before running, and fails on any mismatch.

## Regeneration commands

```bash
export JAVA_BLUE_ROOT=/absolute/path/to/pinned/java-blue
pnpm fixtures:java-automation -- --java-blue-root "$JAVA_BLUE_ROOT"
```

Check mode regenerates into a temporary directory and byte-compares it with the
committed corpus:

```bash
pnpm fixtures:java-automation:check -- --java-blue-root "$JAVA_BLUE_ROOT"
```

Both commands are also wired in the repository root `package.json`. The
canonical execution path is `scripts/generate-java-blue-automation-fixtures.mjs`
(drives Maven, `javac`, and `java` directly). The `pom.xml` in this module is a
convenience descriptor for IDE/Maven users: after installing the pinned
checkout into the local repository
(`mvn -f "$JAVA_BLUE_ROOT/pom.xml" -DskipTests install`), the same generator
runs through `mvn exec:java`.

## Determinism rules

- The seeded realtime section uses the generator-owned SplitMix64
  implementation with the fixed seed recorded in `manifest.json`.
- Output contains no timestamps, absolute checkout paths, JVM vendor builds,
  hostnames, or nondeterministic ordering.
- Fixed UUIDs are used for Parameter XML cases so generated identifiers cannot
  change bytes between runs.
- Files are emitted in stable ASCII sort order with LF endings and no BOM.
