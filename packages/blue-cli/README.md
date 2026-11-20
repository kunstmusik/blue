# @kunstmusik/blue-cli

A Node.js command-line interface for compiling [Blue](https://github.com/kunstmusik/blue) (`.blue`) project files into Csound (`.csd`) documents.

> Published on npm as `@kunstmusik/blue-cli`. The installed binary command and monorepo workspace package name remain `blue-cli`.

`@kunstmusik/blue-cli` brings the headless compilation engine from `@kunstmusik/blue-data` (`@blue/data`) together with Blue's bundled Java helper and project resource resolution, allowing you to generate `.csd` scores and orchestras from the terminal or CI/CD pipelines without launching the Blue desktop application.

---

## Supported Platforms & Prerequisites

- **Node.js**: `>=22`
- **Supported platforms**: macOS `arm64`, Windows `x64`, and Linux `x64`
- **Plain `.blue` projects**: Require **neither Java nor Csound**. JavaScript sound objects (`JavaScriptObject` and JavaScript `ObjectBuilder`) execute in the bundled `quickjs-emscripten` WebAssembly runtime.
- **Java-backed projects**: Projects containing `ClojureObject`, `PythonObject`, Python or Clojure `ObjectBuilder`, `PythonInstrument`, or `PythonProcessor` require **Java 17 or newer**.
  - `blue-cli` uses `JAVA_HOME/bin/java` (`java.exe` on Windows) when `JAVA_HOME` is set, or `java` from `PATH`.
  - The bundled Java helper (`dist/java/blue-java.jar`), standard Jython `pythonLib` (`dist/java/pythonLib`), Java helper sources (`dist/java/source`), and license texts/notices (`dist/java/THIRD_PARTY_NOTICES.md` and `dist/java/licenses`) ship inside the npm package. No desktop Blue installation or Maven is needed at runtime.
  - Optional user Python libraries can be placed in `~/.blue/pythonLib`.
  - Project Clojure dependencies declared in the project are resolved on demand and may require network access on first use.
- **Csound 7 (separate, optional)**: `blue-cli` outputs `.csd` text only and does not require Csound. Install **Csound 7** separately if you want to render a generated `.csd` file to audio or play it in realtime.
- **pnpm native build scripts**: The package installs `quickjs-emscripten` and native `zeromq` for your platform. If `pnpm` asks for install-script approval for `zeromq`, allow it with:

  ```bash
  pnpm approve-builds
  ```

---

## Installation

### Run On Demand with `npx` (No Install)

```bash
npx @kunstmusik/blue-cli@next compile -p project.blue -o project.csd
```

### Local Install (Project Dev Dependency)

```bash
npm install --save-dev @kunstmusik/blue-cli@next
```

Invoke the installed `blue-cli` binary via `npx` or a `package.json` script:

```bash
npx blue-cli compile -p project.blue -o project.csd
```

### Global Install

```bash
npm install -g @kunstmusik/blue-cli@next
```

The installed executable command remains `blue-cli`:

```bash
blue-cli compile -p project.blue -o project.csd
```

### Monorepo Workspace Build

From the Blue repository root:

```bash
pnpm --filter blue-cli build
```

The CLI executable is compiled to `packages/blue-cli/dist/blue-cli.cjs`, alongside `packages/blue-cli/dist/java/` and `packages/blue-cli/dist/attribution/`. Building from source in the monorepo requires Maven and a JDK to package the Java helper.

---

## Usage & Compilation Modes

### `compile`

Compile a `.blue` project into a Csound `.csd` file:

```bash
blue-cli compile -p <project-path> -o <output-path> [options]
```

#### Options

| Option       | Flag        | Description                                                                                                                        |
| :----------- | :---------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| `--project`  | `-p <path>` | **Required**. Path to the input `.blue` XML project file.                                                                          |
| `--output`   | `-o <path>` | **Required**. Path where the generated `.csd` file will be written.                                                                |
| `--realtime` |             | Generate the CSD configured for realtime playback (`project.toCSDAsync()`). Mutually exclusive with `--bluelive`.                  |
| `--bluelive` |             | Generate the CSD configured for Blue Live performance mode (`project.toBlueLiveCSDAsync()`). Mutually exclusive with `--realtime`. |
| `--help`     | `-h`        | Display help text and command usage.                                                                                               |

#### Compilation Modes

- **Default (disk render)**: When neither `--realtime` nor `--bluelive` is specified, `blue-cli` generates a disk-render CSD using `project.toDiskCSDAsync()`, running score generators asynchronously.
- **Realtime (`--realtime`)**: Generates a realtime-playback CSD using `project.toCSDAsync()`, running score generators asynchronously.
- **Blue Live (`--bluelive`)**: Generates a Blue Live performance CSD using `project.toBlueLiveCSDAsync()`, running orchestra generation asynchronously.
- **Mutually exclusive flags**: `--realtime` and `--bluelive` cannot be combined; specifying both fails immediately with a nonzero exit code.

#### Host Resolution During Compilation

- **On-load scripts & sessions**: Runs `project.processOnLoadAsync()` in a shared QuickJS JavaScript session (and one per-compilation Java helper session when the project uses Java), disposing both sessions when compilation completes.
- **Scala tuning scales**: Resolves `TuningProcessor` scale references from absolute paths or `~/.blue/scl/<filename>`.
- **Track audio headers**: When mixer panning is enabled, inspects `AudioClip` audio headers relative to the project directory (falling back to the authored path) to verify 1- or 2-channel audio files without altering authored paths or cached channel counts.

---

## Exit & Output Protection Semantics

- **Source project is never modified**: `blue-cli` only reads the input `.blue` file.
- **Output protection (same-file rejection)**: If `-o` / `--output` resolves to the same file as `-p` / `--project`—directly or through a hard link or symbolic link—`blue-cli` rejects the command with a diagnostic on `stderr` and exits nonzero before reading or writing files.
- **Existing output preserved on failure**: XML loading, resource resolution, script/Java evaluation, and CSD generation all complete in memory before creating output directories or writing `-o`. If compilation fails at any stage, any existing file at the output path is left unchanged.
- **Nonzero exit with diagnostics**: `blue-cli` prints diagnostics to `stderr` and exits with code `1` on:
  - XML parsing, schema, or version validation failures (non-fatal XML warnings are also printed to `stderr` while compilation continues)
  - Missing or unreadable Scala tuning files, unreadable audio clips, or unsupported audio channel counts
  - Missing Java 17+, missing bundled Java helper JAR, or failed Java / Clojure dependency initialization
  - Script, instrument, note processor, or external command evaluation failures
  - Conflicting `--realtime` and `--bluelive` flags or invalid command arguments

---

## Security: Project Code Execution

> **Security notice:** Compiling a `.blue` project executes project-embedded scripts and host shell commands. Only compile `.blue` files from trusted sources.

During compilation, `blue-cli` can run:

- **On-load scripts** (`JavaScriptObject`, `PythonObject`, or `ClojureObject` marked for on-load evaluation)
- **Score generators** written in JavaScript (`JavaScriptObject`, JavaScript `ObjectBuilder`), Python/Jython (`PythonObject`, Python `ObjectBuilder`), or Clojure (`ClojureObject`, Clojure `ObjectBuilder`)
- **Python instruments and note processors** (`PythonInstrument`, `PythonProcessor`)
- **External score commands** (`External` and external `ObjectBuilder` objects), executed in the host shell (`powershell.exe` on Windows, default shell on macOS/Linux) with the working directory set to the `.blue` project directory

If you only want to inspect or edit `.blue` XML safely without executing project code, use `readProjectXml()` from `@kunstmusik/blue-data` instead.

---

## CSD Output vs. Audio Rendering

`blue-cli` compiles `.blue` projects into **`.csd` text files** (Csound options, orchestra, and score). It does **not** render audio or invoke Csound directly.

To render a generated `.csd` file to audio or play it in realtime, install **[Csound 7](https://csound.com/)** separately and pass the generated `.csd` to `csound`:

```bash
# Compile a .blue project to .csd text (no Csound required)
npx @kunstmusik/blue-cli@next compile -p my-song.blue -o my-song.csd

# Render or play the generated .csd separately with Csound 7
csound my-song.csd
```

---

## Examples

### 1. Default Disk Render CSD

```bash
blue-cli compile -p my-song.blue -o my-song.csd
```

Output:

```text
Wrote /path/to/my-song.csd (disk, 45210 bytes)
```

### 2. Realtime Playback CSD

```bash
blue-cli compile -p my-song.blue -o realtime.csd --realtime
```

Output:

```text
Wrote /path/to/realtime.csd (realtime, 43105 bytes)
```

### 3. Blue Live CSD

```bash
blue-cli compile -p live-set.blue -o bluelive.csd --bluelive
```

Output:

```text
Wrote /path/to/bluelive.csd (bluelive, 28940 bytes)
```

---

## Architecture, Runtime Dependencies & Licensing

`blue-cli` uses [`esbuild`](https://esbuild.github.io/) to bundle `@blue/data` and the CLI entry point into a CommonJS executable at `dist/blue-cli.cjs`. The separate Java helper, Jython `pythonLib`, Java sources, and notices ship under `dist/java/`, and JavaScript/data attributions ship under `dist/attribution/`.

### Runtime Dependencies (`quickjs-emscripten` and `zeromq`)

Both `quickjs-emscripten` and `zeromq` are externalized from `dist/blue-cli.cjs` and declared as runtime `dependencies` in [`package.json`](./package.json):

- **`quickjs-emscripten`**: Uses WebAssembly and platform assets for QuickJS execution when compiling JavaScript sound objects (`JavaScriptObject`, JavaScript `ObjectBuilder`). Keeping it external lets Node resolve the runtime assets from `node_modules` in standalone installs.
- **`zeromq`**: Uses native prebuilt or compiled bindings to communicate over loopback TCP with the separate Java helper process when compiling Java-backed projects.

### Licensing

See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) (along with `LICENSES/` and `dist/java/THIRD_PARTY_NOTICES.md` in the built package) for the distinct JavaScript bundle (`MIT AND Apache-2.0 AND ISC`), Java helper (`EPL-2.0` Blue Java source plus shaded dependency licenses), Jython `pythonLib`, and runtime dependency (`quickjs-emscripten` and `zeromq`) license terms.

---

## Development

From `packages/blue-cli`:

```bash
# Build the CLI bundle and Java helper
pnpm build

# Run unit and integration tests
pnpm test

# Remove build artifacts
pnpm clean
```
