---
name: blue-projects
description: Inspect, edit, validate, and compile Blue (.blue) Csound projects in Node.js or from the command line using @kunstmusik/blue-data and @kunstmusik/blue-cli. Use when asked to read, inspect diagnostics, modify, save, or compile .blue composition files to .csd without launching the Blue desktop app.
license: GPL-3.0-or-later
---

# Blue Projects

Work with [Blue](https://github.com/kunstmusik/blue) (`.blue`) Csound composition files outside the desktop application using `@kunstmusik/blue-data@0.1.0` and `@kunstmusik/blue-cli@0.1.0`.

## Compatible Versions & Prerequisites

- **Compatible npm packages**: `@kunstmusik/blue-data@0.1.0` and `@kunstmusik/blue-cli@0.1.0`.
- **Node.js `>=22`**: Required for both packages. `@kunstmusik/blue-data` supports native ESM and CommonJS with shared `BlueData` identity and TypeScript `NodeNext` declarations (plus portable ESM for browser bundlers). `@kunstmusik/blue-cli` targets macOS `arm64`, Windows `x64`, and Linux `x64` (if `pnpm` prompts to approve native build scripts for `zeromq`, run `pnpm approve-builds`).
- **Java `>=17` (only for Java-backed projects)**: Needed only when compiling projects that use `ClojureObject`, `PythonObject`, Python or Clojure `ObjectBuilder`, `PythonInstrument`, or `PythonProcessor`. `@kunstmusik/blue-cli` bundles the Java helper (`blue-java.jar`) and Jython `pythonLib`, resolving `JAVA_HOME/bin/java` (`java.exe` on Windows) when `JAVA_HOME` is set or `java` from `PATH`. Plain `.blue` projects and JavaScript-only objects (`JavaScriptObject`, JavaScript `ObjectBuilder` executed via bundled QuickJS WASM) do **not** require Java.
- **Csound 7 (separate, optional)**: Needed only when rendering a generated `.csd` file to audio or playing it in realtime (`csound project.csd`). Inspecting, editing, and compiling `.blue` files to `.csd` text do not require Csound.

## Workflow Choice Guide

- **Use `@kunstmusik/blue-data@0.1.0`** when inspecting `.blue` XML, checking loader diagnostics (`readProjectXml`), reading metadata, arrangement instruments, score layers, or timing primitives, or making targeted edits safely **without executing project code**.
- **Use `@kunstmusik/blue-cli@0.1.0`** (`npx @kunstmusik/blue-cli@0.1.0 compile ...` or `blue-cli compile ...`) when compiling a `.blue` project to a disk (default), `--realtime`, or `--bluelive` `.csd` file with bundled QuickJS, bundled Java helper, external score command, and project-relative resource support.

## Security Warning: Compilation Executes Project Code

> **Warning:** Compiling a `.blue` project can execute project-embedded scripts and host shell commands. For untrusted or unfamiliar `.blue` files, inspect the XML safely with `@kunstmusik/blue-data` (`readProjectXml`) first before compiling.

During compilation, `@kunstmusik/blue-cli` can execute:

- **On-load scripts**: `JavaScriptObject`, `PythonObject`, or `ClojureObject` objects marked for on-load evaluation.
- **Score generators**: JavaScript (`JavaScriptObject`, JS `ObjectBuilder`), Python/Jython (`PythonObject`, Python `ObjectBuilder`), and Clojure (`ClojureObject`, Clojure `ObjectBuilder`).
- **Python instruments and note processors**: `PythonInstrument` and `PythonProcessor`.
- **External score commands**: `External` and external `ObjectBuilder` objects run in the host shell (`powershell.exe` on Windows, default shell on macOS/Linux) with the working directory set to the `.blue` project directory.
- **Clojure library dependencies**: Dependencies declared in project `pluginData` resolve on demand and may access the network if not already cached.

Loading, validating, and serializing `.blue` XML with `readProjectXml()` and `project.saveToString()` in `@kunstmusik/blue-data` never execute project scripts, Java, or external commands.

## Workflow 1: Inspect, Edit, Save, and Reload (`@kunstmusik/blue-data`)

Install the matching package version in a Node.js `>=22` consumer project:

```bash
npm install --save-exact @kunstmusik/blue-data@0.1.0
```

Follow these source-preservation and verification steps:

1. **Inspect and surface diagnostics**: Read the source `.blue` file and load it with `readProjectXml(xml, { kind: 'project', label, nativePath })`. Surface all entries in `report.diagnostics` (`severity`, `code`, `path`, `message`, `recovery`). If `!report.ok`, exit nonzero without writing any output file.
2. **Edit and save to a separate sibling file**: Update the `BlueData` instance (`report.value`) and write `project.saveToString()` to a separate sibling file (for example, `project-edited.blue`). Reject same-file or linked output paths so the source `.blue` remains untouched.
3. **Reload to verify**: Load `project-edited.blue` back through `readProjectXml()`, confirm `reloaded.ok === true` and check diagnostics (expect zero load errors or warnings on canonical output), and verify both the updated field and preserved project content.

See [Node and CLI walkthrough reference](references/node.md) for runnable ESM and CommonJS recipes, and [Minimal sample Blue project](assets/example.blue) for an asset-free fixture.

## Workflow 2: Compile `.blue` to `.csd` (`@kunstmusik/blue-cli`)

Invoke on demand with `npx` or via an installed `blue-cli` binary:

```bash
npx @kunstmusik/blue-cli@0.1.0 compile -p project.blue -o project.csd
```

Or when `@kunstmusik/blue-cli@0.1.0` is installed locally or globally:

```bash
blue-cli compile -p project.blue -o project.csd
```

### Compilation Modes

- **Default (disk render)**: Omit mode flags to emit a disk-render CSD (`toDiskCSDAsync`).
- **Realtime (`--realtime`)**: Emit a realtime-playback CSD (`toCSDAsync`).
- **Blue Live (`--bluelive`)**: Emit a Blue Live performance CSD (`toBlueLiveCSDAsync`).
- `--realtime` and `--bluelive` are mutually exclusive; combining them exits nonzero immediately.

### Host Resource Resolution

During compilation, `blue-cli` inspects `AudioClip` audio headers relative to the `.blue` project directory (when mixer panning is enabled), resolves `TuningProcessor` `.scl` scale files from absolute paths or `~/.blue/scl/<filename>`, and loads optional user Python modules from `~/.blue/pythonLib`.

### Output Protection & CSD Verification

- **Separate `-o` output path**: Always write the `.csd` to a separate `-o` / `--output` path (such as `project.csd`). `blue-cli` rejects any `-o` path that resolves to the source `.blue` file directly or via a hard link or symbolic link.
- **Failures preserve existing files**: Loading, resource resolution, script/Java evaluation, and CSD generation finish in memory before creating directories or writing `-o`. Any failure exits nonzero (`1`) with diagnostics on `stderr`, leaving both the source `.blue` and any existing `-o` file untouched.
- **Verify the emitted CSD**: Confirm `blue-cli` exits `0` (`Wrote <resolved-output> (<mode>, <bytes> bytes)`) and inspect the emitted `.csd` to verify it contains `<CsoundSynthesizer>`, `<CsInstruments>`, and `<CsScore>` (along with any expected instrument, score, or mode markers).
- **Render audio separately (optional)**: `blue-cli` emits `.csd` text only. Pass the verified `.csd` to Csound 7 (`csound project.csd`) when rendering audio.

## Local References & License

- [Node and CLI walkthrough reference](references/node.md)
- [Minimal sample Blue project](assets/example.blue)
- [License (GPL-3.0-or-later)](LICENSE)
