# Node.js and CLI Reference (`@kunstmusik/blue-data@0.1.0-beta.1` / `@kunstmusik/blue-cli@0.1.0-beta.1`)

Use this reference when inspecting or editing `.blue` project XML programmatically in Node.js or compiling `.blue` projects to Csound `.csd` files from the terminal.

## Sample Fixture Setup

Start from the asset-free sample project at [../assets/example.blue](../assets/example.blue). Before running either walkthrough, copy it to `project.blue` in an empty working directory so the installed skill asset remains untouched:

```bash
mkdir -p blue-walkthrough && cd blue-walkthrough
cp /path/to/installed/blue-projects/assets/example.blue ./project.blue
```

`project.blue` contains a minimal `<blueData version="2.10.1">` composition (`Blue Projects Skill Example` by `Blue`, `44100` Hz, `ksmps` `64`, `diskKsmps` `1`, `2` channels, `useAudioOut` `true`) with one `GenericInstrument` (`arrangementId="1"`, `poscil` + `linseg`) and one `GenericScore` (`i1 0 2 440 0.2`) inside a root `PolyObject` `SoundLayer`, with no external audio files or scripts.

---

## 1. Standalone Node.js Workflow (`@kunstmusik/blue-data@0.1.0-beta.1`)

`@kunstmusik/blue-data` loads, validates, migrates, edits, and serializes `.blue` XML purely in memory without touching disk or executing embedded project scripts (`JavaScriptObject`, `ClojureObject`, `PythonObject`, `ObjectBuilder`, or `External`). Plain XML inspection and editing require **Node.js >= 22** and need neither Java nor Csound.

### Install

```bash
npm init -y
npm install --save-exact @kunstmusik/blue-data@0.1.0-beta.1
```

Import supported symbols only from the package root (`@kunstmusik/blue-data`); workspace `test-support` subpaths are repository-internal and unsupported for consumers.

### Inspect, Edit, Save to Sibling File, and Reload (ESM)

Save the following script as `edit-project.mjs` in the working directory containing `project.blue`:

```javascript
import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { readProjectXml } from '@kunstmusik/blue-data';

function formatDiagnostic(diagnostic) {
  const colSuffix = diagnostic.column !== undefined ? `:${diagnostic.column}` : '';
  const location = diagnostic.line !== undefined ? ` (line ${diagnostic.line}${colSuffix})` : '';
  const value =
    diagnostic.value === undefined ? '' : ` Value: ${JSON.stringify(diagnostic.value)}.`;
  const prefix = `[${diagnostic.severity} ${diagnostic.code}] ${diagnostic.source.label}${location}`;
  return `${prefix}: ${diagnostic.path}: ${diagnostic.message}${value} ${diagnostic.recovery}\n`;
}

function surfaceDiagnostics(diagnostics) {
  for (const diagnostic of diagnostics) {
    process.stderr.write(formatDiagnostic(diagnostic));
  }
}

function isSameFile(inputPath, outputPath) {
  if (inputPath === outputPath) {
    return true;
  }

  try {
    const inputStat = statSync(inputPath);
    const outputStat = statSync(outputPath);
    if (inputStat.dev === outputStat.dev && inputStat.ino === outputStat.ino) {
      return true;
    }
    return realpathSync(inputPath) === realpathSync(outputPath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

const inputPath = path.resolve('project.blue');
const outputPath = path.resolve('project-edited.blue');
const nextTitle = 'Updated Blue Project';

if (isSameFile(inputPath, outputPath)) {
  process.stderr.write(
    `Refusing to overwrite input project (${inputPath}); use a separate output path.\n`,
  );
  process.exit(1);
}

const originalBytes = readFileSync(inputPath);
const report = readProjectXml(originalBytes.toString('utf8'), {
  kind: 'project',
  label: inputPath,
  nativePath: inputPath,
});

surfaceDiagnostics(report.diagnostics);
if (!report.ok) {
  if (report.diagnostics.length === 0) {
    process.stderr.write(`Failed to load project: ${inputPath}\n`);
  }
  process.exit(1);
}

const project = report.value;
console.log('Title:', project.getProjectProperties().title || '(untitled)');
console.log('Version:', project.getVersion());
console.log('Score layer groups:', project.getScore().length);

project.getProjectProperties().title = nextTitle;
writeFileSync(outputPath, project.saveToString(), 'utf8');

const reloadedXml = readFileSync(outputPath, 'utf8');
const reloaded = readProjectXml(reloadedXml, {
  kind: 'project',
  label: outputPath,
  nativePath: outputPath,
});

surfaceDiagnostics(reloaded.diagnostics);
if (!reloaded.ok) {
  if (reloaded.diagnostics.length === 0) {
    process.stderr.write(`Failed to reload saved project: ${outputPath}\n`);
  }
  process.exit(1);
}

const reloadedTitle = reloaded.value.getProjectProperties().title;
if (reloadedTitle !== nextTitle) {
  process.stderr.write(
    `Expected reloaded title ${JSON.stringify(nextTitle)}, got ${JSON.stringify(reloadedTitle)}.\n`,
  );
  process.exit(1);
}

if (Buffer.compare(readFileSync(inputPath), originalBytes) !== 0) {
  process.stderr.write(`Source project changed unexpectedly: ${inputPath}\n`);
  process.exit(1);
}

console.log('Verified reloaded title:', reloadedTitle);
console.log('Confirmed source unchanged:', inputPath);
```

Run the script:

```bash
node edit-project.mjs
```

Expected output for `project.blue`:

```text
Title: Blue Projects Skill Example
Version: 2.10.1
Score layer groups: 1
Verified reloaded title: Updated Blue Project
Confirmed source unchanged: /path/to/blue-walkthrough/project.blue
```

### CommonJS Compatibility

CommonJS works identically using `require('@kunstmusik/blue-data')`, and both module systems share the exact same `BlueData` constructor and model identity:

```javascript
const { readProjectXml, BlueData } = require('@kunstmusik/blue-data');
// Same API and behavior; reloaded.value instanceof BlueData === true across ESM and CJS.
```

---

## 2. CLI Compilation Workflow (`@kunstmusik/blue-cli@0.1.0-beta.1`)

`@kunstmusik/blue-cli` compiles `.blue` projects into Csound `.csd` files from the terminal.

- **Node.js**: `>= 22`
- **Supported platforms**: macOS `arm64`, Windows `x64`, and Linux `x64`
- **Plain projects** (including `project.blue` and projects with `JavaScriptObject` or JS `ObjectBuilder` scripts, which execute in bundled `quickjs-emscripten` WASM): require **neither Java nor Csound**.
- **Java-backed projects** (`ClojureObject`, `PythonObject`, Python or Clojure `ObjectBuilder`, `PythonInstrument`, or `PythonProcessor`): require **Java 17 or newer**, resolved from `JAVA_HOME/bin/java` (`java.exe` on Windows) when `JAVA_HOME` is set, or `java` from `PATH`. The Java helper JAR and Jython standard library ship inside `@kunstmusik/blue-cli` (no desktop Blue or Maven required; project-declared Clojure dependencies resolve on demand and may require network access on first use).

> **Security notice:** Compiling a `.blue` project can execute embedded on-load scripts, score generators (JavaScript, Python/Jython, Clojure), Python instruments/note processors, and **external score commands** (`External` and external `ObjectBuilder` objects run in the host shell with the working directory set to the `.blue` project directory). Only compile `.blue` files from trusted sources. Use `readProjectXml()` from `@kunstmusik/blue-data` for safe script-free XML inspection and editing.

### Compilation Modes

Run from the directory containing `project.blue`:

#### Default Disk Render

```bash
npx @kunstmusik/blue-cli@0.1.0-beta.1 compile -p project.blue -o project.csd
```

Uses `project.toDiskCSDAsync()` (disk project properties such as `diskSampleRate`, `diskKsmps=1`, `diskChannels`) and prints `Wrote <resolved-path>/project.csd (disk, <bytes> bytes)`. If `@kunstmusik/blue-cli` is installed locally or globally, invoke `blue-cli compile -p project.blue -o project.csd`.

#### Realtime Playback (`--realtime`)

```bash
npx @kunstmusik/blue-cli@0.1.0-beta.1 compile -p project.blue -o project-realtime.csd --realtime
```

Uses `project.toCSDAsync()` (realtime project properties such as `sampleRate`, `ksmps=64`, `channels`).

#### Blue Live (`--bluelive`)

```bash
npx @kunstmusik/blue-cli@0.1.0-beta.1 compile -p project.blue -o project-bluelive.csd --bluelive
```

Uses `project.toBlueLiveCSDAsync()` (Blue Live performance CSD containing `instr blueAllNotesOff` and `e 36000`).

### Flags, Error Handling, and Output Protection

- **Mutually exclusive flags**: `--realtime` and `--bluelive` cannot be passed together; combining them fails immediately with a nonzero exit code.
- **Same-file rejection**: If `-o` / `--output` resolves to the same file as `-p` / `--project` (directly or via hard link or symbolic link), `blue-cli` rejects the command on `stderr` and exits nonzero before reading or writing.
- **Nonzero exit preserves existing output**: XML loading, Scala scale resolution (`TuningProcessor`, absolute path or `~/.blue/scl/<filename>`), relative `AudioClip` header inspection (when mixer panning is enabled), script/Java evaluation, and CSD generation all complete in memory before creating output directories or writing `-o`. If any step fails (malformed XML, missing scale/audio file, missing Java 17+, script/external command failure, or invalid flags), `blue-cli` writes diagnostics to `stderr`, exits nonzero (`1`), leaves `project.blue` untouched, and preserves any existing file at `-o`. Non-fatal XML warnings are printed to `stderr` while compilation proceeds.

### Inspecting the Generated `.csd` and Rendering Audio

Verify that compilation succeeded without modifying `project.blue` and inspect the emitted Csound sections:

```bash
cat project.csd
```

For `project.blue`, `project.csd` contains `<CsoundSynthesizer>`, `<CsInstruments>` (`sr=44100`, `ksmps=1`, `nchnls=2`, `0dbfs=1`, `instr 1`), and `<CsScore>` (`i1 0.0 2 440 0.2` and `e`).

`blue-cli` outputs `.csd` text only and does **not** invoke Csound or render audio. Install **[Csound 7](https://csound.com/)** separately to render a generated `.csd` file to audio or play it in realtime:

```bash
csound project.csd
```
