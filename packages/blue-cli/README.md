# blue-cli

A Node.js command-line interface for compiling Blue (`.blue`) project files into Csound (`.csd`) files.

`blue-cli` brings the headless compilation engine from `@blue/data` to the terminal and automated CI/CD pipelines, allowing you to generate Csound scores and orchestras without launching the Blue Electron graphical application.

---

## Installation

### Run with `npx` (No Install)

```bash
npx blue-cli compile -p project.blue -o project.csd
```

### Global Install

```bash
npm install -g blue-cli
```

### Local / Monorepo Workspace

From the `blue-electron` repository root:

```bash
pnpm --filter blue-cli build
```

The executable is compiled to `packages/blue-cli/dist/blue-cli.cjs`.

---

## Usage

### `compile`

Compile a `.blue` project into a Csound `.csd` file:

```bash
blue-cli compile -p <project-path> -o <output-path> [options]
```

#### Options

| Option | Flag | Description |
| :--- | :--- | :--- |
| `--project` | `-p <path>` | **Required**. Path to the source `.blue` XML project file. |
| `--output` | `-o <path>` | **Required**. Path where the generated `.csd` file will be written. |
| `--realtime` | | Generate the CSD configured for realtime audio output (`project.toCSD()`). Mutually exclusive with `--bluelive`. |
| `--bluelive` | | Generate the CSD configured for Blue Live performance mode (`project.toBlueLiveCSD()`). Mutually exclusive with `--realtime`. |
| `--help` | `-h` | Display help text and command usage. |

*When neither `--realtime` nor `--bluelive` is specified, `blue-cli` defaults to generating a **disk render** CSD (`project.toDiskCSD()`).*

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

## Architecture & Dependencies

`blue-cli` uses [`esbuild`](https://esbuild.github.io/) to bundle `@blue/data` and the CLI entry point into a single, self-contained CommonJS binary at `dist/blue-cli.cjs`.

### Runtime Note on `quickjs-emscripten`

Although `quickjs-emscripten` is not imported directly in `blue-cli`'s TypeScript source files, it is declared as a direct runtime dependency in [`package.json`](./package.json):

* **Bundling boundary**: `esbuild` externalizes `quickjs-emscripten` (`external: ['quickjs-emscripten']`) because QuickJS relies on WebAssembly and platform-specific assets that cannot be naively inlined into a single script.
* **Transitive runtime resolution**: When `@blue/data` compiles sound objects containing JavaScript code (such as `JavaScriptObject`), it initializes QuickJS via `initializeJavaScriptRuntime()`.
* **Standalone execution**: In standalone installs of `blue-cli` (such as via npm or npx), Node resolves `quickjs-emscripten` from `blue-cli`'s runtime `node_modules`. Keeping it declared in `package.json` ensures standalone CLI execution works without requiring a separate manual dependency installation.

---

## Development

```bash
# Build the CLI bundle
pnpm build

# Run unit and integration tests
pnpm test

# Remove build artifacts
pnpm clean
```
