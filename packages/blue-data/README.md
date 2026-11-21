# @kunstmusik/blue-data

Portable TypeScript/JavaScript data model, `.blue` XML loader/migrator/serializer, musical timing primitives, and Csound CSD compiler for [Blue](https://github.com/kunstmusik/blue), compatible with Java Blue project files.

> Published on npm as `@kunstmusik/blue-data`. Inside the Blue monorepo, the workspace package name is `@blue/data`.

## Requirements & Installation

- **Node.js**: `>= 22` (native ESM and CommonJS supported; ESM and CJS share `BlueData` model identity)
- **TypeScript**: Declarations included (`dist/esm/index.d.ts` and `dist/cjs/index.d.ts`, tested with strict `NodeNext` and bundler resolution)
  - If you check dependency declarations with an explicit `lib` list, include `DOM` and `ESNext.Disposable` for the WebAssembly and disposal types used by QuickJS.
- **Browsers**: Portable ESM output with zero `node:*` built-ins for Vite, esbuild, and other ESM bundlers

```bash
npm install @kunstmusik/blue-data@next
```

From a monorepo checkout, build the workspace package with:

```bash
pnpm --filter @blue/data build
```

## Runnable Inspect, Edit, Save, and Reload Example

A complete runnable example ships in the package at [examples/inspect-edit.mjs](examples/inspect-edit.mjs). Run it against any `.blue` project, writing the updated copy to a separate file so the original stays untouched:

```bash
node node_modules/@kunstmusik/blue-data/examples/inspect-edit.mjs <input.blue> <output.blue> [new-title]
```

### Node.js ESM Walkthrough

The example reads native file paths with `node:fs`, loads XML with `readProjectXml` (which surfaces diagnostics without throwing), edits the project title, writes to a separate output file, and reloads the output to verify the change:

```javascript
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readProjectXml } from '@kunstmusik/blue-data';

function isSameFile(a, b) {
  if (a === b) return true;
  try {
    const statA = statSync(a);
    const statB = statSync(b);
    return (
      (statA.dev === statB.dev && statA.ino === statB.ino) || realpathSync(a) === realpathSync(b)
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

const inputPath = path.resolve('input.blue');
const outputPath = path.resolve('output.blue');
if (isSameFile(inputPath, outputPath)) {
  throw new Error('Refusing to overwrite input project; pass a separate output path.');
}

// 1. Read and inspect without executing project scripts
const xml = readFileSync(inputPath, 'utf8');
const report = readProjectXml(xml, {
  kind: 'project',
  label: inputPath,
  nativePath: inputPath,
});

for (const d of report.diagnostics) {
  console.error(
    `[${d.severity} ${d.code}] ${d.source.label}: ${d.path}: ${d.message} ${d.recovery}`,
  );
}
if (!report.ok) {
  process.exit(1);
}

const project = report.value;
console.log('Title:', project.getProjectProperties().title || '(untitled)');
console.log('Version:', project.getVersion());
console.log('Score layer groups:', project.getScore().length);

// 2. Edit and save to a sibling file
project.getProjectProperties().title = 'Updated Blue Project';
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, project.saveToString(), 'utf8');

// 3. Reload the saved copy to verify
const reloaded = readProjectXml(readFileSync(outputPath, 'utf8'), {
  kind: 'project',
  label: outputPath,
  nativePath: outputPath,
});
if (!reloaded.ok) {
  throw new Error('Failed to reload saved project.');
}
console.log('Verified title:', reloaded.value.getProjectProperties().title);
```

### Node.js CommonJS Loading

CommonJS consumers can load the same package root with `require('@kunstmusik/blue-data')`. Both ESM and CommonJS share the exact same `BlueData` constructor and model identity:

```javascript
const { readFileSync, writeFileSync } = require('node:fs');
const { BlueData, readProjectXml } = require('@kunstmusik/blue-data');

const xml = readFileSync('input.blue', 'utf8');
const report = readProjectXml(xml, { kind: 'project', label: 'input.blue' });
if (!report.ok) {
  console.error(report.diagnostics);
  process.exit(1);
}

const project = report.value;
project.getProjectProperties().title = 'Updated from CommonJS';
writeFileSync('output.blue', project.saveToString(), 'utf8');

const reloaded = readProjectXml(readFileSync('output.blue', 'utf8'), {
  kind: 'project',
  label: 'output.blue',
});
if (reloaded.ok) {
  console.log('Shared BlueData identity:', reloaded.value instanceof BlueData); // true
  console.log('Verified title:', reloaded.value.getProjectProperties().title);
}
```

## XML Diagnostics, Warnings vs. Rejection, and Save Normalization

### `readProjectXml` vs. `BlueData.loadFromString`

Both project loaders parse XML, validate element/attribute shape and `@version` syntax, apply raw-XML project migrations (`UpgradeManager`), and validate the canonical post-migration graph without touching disk or executing any project scripts (`JavaScriptObject`, `ClojureObject`, `PythonObject`, `ObjectBuilder`, or `External`):

- **`readProjectXml(xml, source?)`** returns a non-throwing `XmlLoadResult<BlueData>`:
  - `{ ok: true, value, diagnostics }` when loading succeeds, including any non-fatal `'warning'` diagnostics (for example, redundant historical fields safely omitted on save or unresolved `LiveData` set references).
  - `{ ok: false, diagnostics }` on XML syntax, shape, version, conflict, or value errors (no `value` property is returned).
  - Each `XmlDiagnostic` includes `code`, `severity` (`'warning' | 'error'`), `source` (`XmlSource`), XPath-like `path`, optional `member`/`value`/`line`/`column`, `message`, and `recovery`.
- **`BlueData.loadFromString(xml, sink?)`** is a strict throwing convenience loader for `'in-memory project'` XML. It throws `XmlLoadError` on load failures **and** throws `XmlLoadError` when accepted XML produces `'warning'` diagnostics unless an `XmlDiagnosticSink` callback is passed as the second argument so warnings cannot be silently swallowed.

### Canonical Save Normalization

`project.saveAsXML()` and `project.saveToString()` serialize the in-memory `BlueData` graph without touching disk:

- Normalizes `<blueData version="...">` to the canonical `BLUE_VERSION` (`2.10.1`).
- Writes project root sections in Java-compatible order (`projectProperties`, `arrangement`, `mixer`, `tables`, `soundObjectLibrary`, `globalOrcSco`, `opcodeList`, `liveData`, `score`, `scratchPadData`, `noteProcessorChainMap`, `renderStartTime`, `renderEndTime`, `markersList`, `loopRendering`, `midiInputProcessor`, `pluginData`).
- Emits migrated project structures cleanly (for example, `score`-owned `timeContext` and `mixer`-owned panning attributes) and clones preserved `pluginData` children (`ClojureProjectData`) so external edits to the serialized XML do not mutate `BlueData`.

### Automation Resolution Parity

`Parameter` keeps its values, bounds, and line points as JavaScript `number` (binary64), while storing resolution as exact Java-compatible decimal text (`getResolutionText()` / `setResolutionText()`). Positive resolutions quantize interpolated values with Java Blue semantics; zero or negative resolutions leave interpolation unquantized. Project XML reads legacy `resolution` attributes and writes canonical `bdresolution` attributes.

## Timing Units

Blue separates timeline positions (`TimePosition`), durations (`TimeDuration`), and conversion context (`TimeContext`):

| Type           | Purpose            | Units & Rules                                                                                                                                                                                                                                                                                |
| :------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TimeBase`     | Unit discriminant  | `BEATS`, `BBT`, `BBST`, `BBF`, `TIME`, `SECONDS`, `FRAME`, `SMPTE` (display-only)                                                                                                                                                                                                            |
| `TimePosition` | Timeline position  | `beats(n)` (quarter note = 1 beat); `bbt(bar, beat, ticks)` and `bbst(bar, beat, sixteenth, ticks)` use **1-based** bar/beat (`sixteenth` 1–4) with 960 PPQ; `bbf(bar, beat, fraction)` uses **1-based** bar/beat with 0–99 hundredths; `timeValue(h, m, s, ms)` / `seconds(s)`; `frames(n)` |
| `TimeDuration` | Span / length      | Same unit families with **0-based** bars/beats (`sixteenth` 0–3) and converts bar/beat durations using `MeterMap.get(0)`                                                                                                                                                                     |
| `TimeContext`  | Conversion context | Holds `TempoMap` (defaults to 60 BPM when disabled), `MeterMap` (defaults to 4/4 at bar 1), `sampleRate` (default `44100`), and `smpteFrameRate` (default `30`)                                                                                                                              |

```typescript
import { TimeContext, TimeDuration, TimePosition } from '@kunstmusik/blue-data';

const context = new TimeContext();
context.getTempoMap().setTempo(120);
context.getTempoMap().setEnabled(true);
context.setSampleRate(48000);

const pos = TimePosition.bbt(2, 1, 480); // bar 2, beat 1, half-beat (480/960 PPQ)
const dur = TimeDuration.beats(4);

console.log('Position in beats:', pos.toBeats(context)); // 4.5
console.log('Position in seconds:', pos.toSeconds(context)); // 2.25
console.log('Position in frames:', pos.toFrames(context)); // 108000
console.log('Duration in seconds:', dur.toSeconds(context)); // 2
```

## Creating and Inspecting Projects Programmatically

```typescript
import {
  AudioClip,
  BlueData,
  FadeType,
  GenericInstrument,
  GenericScore,
  PatternsLayerGroup,
  PolyObject,
  Score,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
} from '@kunstmusik/blue-data';

const data = new BlueData();

// Project properties & instrument arrangement
const props = data.getProjectProperties();
props.title = 'Programmatic Study';
props.sampleRate = '48000';
props.ksmps = '64';
props.channels = '2';

const instr = new GenericInstrument();
instr.setName('Sine');
instr.setText('a1 oscili p5, p4\n  outs a1, a1');
data.getArrangement().addInstrument(instr, '1');

// Global orchestra / F-tables
data.getGlobalOrcSco().setGlobalOrc('0dbfs = 1\n');
data.getTableSet().setTables('f 1 0 1024 10 1');

// Score with a TrackLayerGroup (audio clips & sound objects) and root PolyObject
const score = new Score();
const rootPoly = score[0];
if (rootPoly instanceof PolyObject) {
  const gs = new GenericScore();
  gs.setScoreText('i1 0 2 440 0.2');
  gs.setStartTime(TimePosition.beats(0));
  gs.setSubjectiveDuration(TimeDuration.beats(2));
  rootPoly[0].push(gs);
}

const trackGroup = new TrackLayerGroup();
const track = trackGroup.newLayerAt(0);
track.setName('Audio Track 1');

const clip = new AudioClip();
clip.setName('Kick Drum');
clip.setAudioFile('samples/kick.wav');
clip.setAudioDuration(0.5);
clip.setStartTime(TimePosition.beats(0));
clip.setSubjectiveDuration(TimeDuration.beats(0.5));
clip.setFadeIn(0.01);
clip.setFadeInType(FadeType.LINEAR);
clip.setFadeOut(0.01);
track.push(clip);

score.push(trackGroup);
data.setScore(score);

// Inspect score layer groups
for (const group of data.getScore()) {
  if (group instanceof TrackLayerGroup) {
    console.log('Track group:', group.getName(), 'tracks:', group.length);
  } else if (group instanceof PatternsLayerGroup) {
    console.log('Pattern group beats:', group.getPatternBeatsLength());
  } else if (group instanceof PolyObject) {
    console.log('PolyObject:', group.getName(), 'layers:', group.length);
  }
}

const xml = data.saveToString();
```

## CSD Generation & Runtime Requirements

### Generate a CSD from a Project in Node.js

For a project with ordinary Csound instruments and score objects, load the XML, check diagnostics,
and write the generated disk-render CSD. CSD generation returns text. Run that text through Csound
separately to produce audio.

```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { readProjectXml } from '@kunstmusik/blue-data';

const input = 'input.blue';
const report = readProjectXml(readFileSync(input, 'utf8'), { kind: 'project', label: input });
for (const diagnostic of report.diagnostics) {
  console.error(`[${diagnostic.severity}] ${diagnostic.path}: ${diagnostic.message}`);
}
if (!report.ok) process.exit(1);

writeFileSync('output.csd', report.value.toDiskCSD(), { encoding: 'utf8', flag: 'wx' });
```

This example expects the project's Csound code to work as authored without host-provided assets or
script runtimes. For projects that need those services, see the runtime sections below or use the CLI.

### QuickJS Initialization for `JavaScriptObject`

If a project contains JavaScript generators, such as `JavaScriptObject`, `JavaScriptInstrument`, or JavaScript `ObjectBuilder` objects, await `initializeJavaScriptRuntime()` once before calling `toCSD()`, `toDiskCSD()`, `toRealtimePlaybackCSD()`, `toBlueLiveCSD()`, their `*Async` counterparts, or instantiating `JavaScriptSession`:

```typescript
import {
  CompileData,
  JavaScriptObject,
  TimeContext,
  disposeJavaScriptCompileState,
  initializeJavaScriptRuntime,
  readProjectXml,
} from '@kunstmusik/blue-data';

await initializeJavaScriptRuntime();

const report = readProjectXml(xml);
if (!report.ok) {
  throw new Error(report.diagnostics.map((d) => d.message).join('\n'));
}

const project = report.value;
const realtimeCsd = project.toCSD();
const diskCsd = project.toDiskCSD();

// Low-level direct JavaScriptObject calls should dispose their compile state:
const compileData = new CompileData();
try {
  const notes = new JavaScriptObject().generateForCSD(new TimeContext(), compileData, 0, -1);
  console.log('Generated notes:', notes.length);
} finally {
  disposeJavaScriptCompileState(compileData);
}
```

`toCSD()` / `toDiskCSD()` return the compiled `.csd` string, while `toRealtimePlaybackCSD()` and `toBlueLiveCSD()` return a `RenderCsdResult` containing `csdText` plus compiled runtime bindings (`parameters`, `stringChannels`, `blueX7Bindings`, `midiInstrumentTargets`, `mixerGateBindings`, `pannerBindings`, and optional `meterBindingMap`).

### Host-Injected Java Contract (`JavaRuntimeClientContract`)

`@kunstmusik/blue-data` stays browser-safe and does not launch Java or OS subprocesses itself. When `project.usesJavaRuntime()` returns `true` (projects containing `ClojureObject`, `PythonObject`, Python/Clojure `ObjectBuilder`, `PythonInstrument`, or `PythonProcessor`), pass a host-injected `JavaRuntimeClientContract` to the async methods:

```typescript
import {
  JavaScriptSession,
  initializeJavaScriptRuntime,
  type BlueData,
  type JavaRuntimeClientContract,
} from '@kunstmusik/blue-data';

async function compile(project: BlueData, runtimeClient: JavaRuntimeClientContract) {
  await initializeJavaScriptRuntime();
  const session = new JavaScriptSession();

  try {
    await project.processOnLoadAsync(session, runtimeClient);
    return await project.toDiskCSDAsync(session, runtimeClient);
  } finally {
    session.dispose();
  }
}
```

External score commands (`External` and external `ObjectBuilder` objects) similarly require a host-registered `ExternalCommandExecutor` via `setExternalCommandExecutor()`.

### Compiling Full User Projects with `@kunstmusik/blue-cli`

If you want to compile full `.blue` projects from disk—including projects that reference project-relative audio files or Scala scales, execute on-load scripts, run Java-backed Clojure/Jython generators, or invoke external score commands—use **`@kunstmusik/blue-cli`** (which bundles the host Java helper and asset resolution):

```bash
npx @kunstmusik/blue-cli@next compile -p project.blue -o project.csd
```

## Browser Usage (ESM Bundlers)

`@kunstmusik/blue-data` uses static ES imports and avoids Node built-ins so browser bundlers such as Vite and esbuild resolve its portable ESM entry (`dist/esm/index.js`) directly:

```javascript
// src/main.js (bundled with Vite or esbuild)
import {
  BlueData,
  TimePosition,
  initializeJavaScriptRuntime,
  readProjectXml,
} from '@kunstmusik/blue-data';

const xml =
  '<blueData version="2.10.1"><projectProperties><title>Browser Study</title></projectProperties></blueData>';

const report = readProjectXml(xml, { kind: 'project', label: 'browser-study.blue' });
if (!report.ok) {
  throw new Error(report.diagnostics.map((d) => d.message).join('\n'));
}

const project = report.value;
project.getProjectProperties().title = 'Updated in Browser';
console.log(project instanceof BlueData, TimePosition.beats(2.5).getCsoundBeats());

// Optional: initialize QuickJS WASM when compiling projects with JavaScriptObject scripts
await initializeJavaScriptRuntime();
const csd = project.toCSD();
console.log(csd);
```

For example, bundling with `esbuild`:

```bash
npx esbuild src/main.js --bundle --platform=browser --format=esm --outfile=dist/bundle.js
```

## API Reference

From a Blue source checkout, build the searchable reference with:

```sh
pnpm --filter @blue/data docs:api
```

Open `packages/blue-data/build/api/index.html`. The package module lists supported root exports.
The **Supporting types** module explains additional types that appear in those signatures. These
types are available to consumers through the signatures that use them. Repository-only test-support
subpaths are outside the reference. Generated HTML stays outside the npm package.

The build fails if a public declaration, member, or explicit constructor overload is missing a
TSDoc comment, a referenced type is missing, or a documentation link cannot be resolved. Document
contracts at the declaration so the same information is available in editors. Explain units,
defaults, diagnostics, ownership, mutation, exceptions, and runtime prerequisites where they apply.

## Supported Package-Root API Groups

Import all supported public symbols from the package root (`@kunstmusik/blue-data`). The workspace subpaths `./test-support` and `./test-support/audio-fixtures` are **workspace-internal** for repository tests and are not supported consumer APIs.

| API Group                           | Key Package-Root Exports                                                                                                                                                                                                                                                                                                                                                                                                    |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project & XML**                   | `BlueData`, `readProjectXml`, `readResourceXml`, `BLUE_VERSION`, `ProjectProperties`, `GlobalOrcSco`, `Tables`, `MarkersList`, `ScratchPadData`, `XmlLoadError`, `XmlLoadContext`, `XmlLoadResult`, `XmlDiagnostic`, `XmlDiagnosticSink`, `XmlSource`, `XmlResourceKind`, `XmlResource`, `RenderCsdResult`                                                                                                                  |
| **Score & Layers**                  | `Score`, `TrackLayerGroup`, `TrackLayer`, `ScoreTrack`, `TrackItem`, `AudioClip`, `FadeType`, `PatternsLayerGroup`, `PatternLayer`, `PatternData`, `PolyObject`, `SoundLayer`                                                                                                                                                                                                                                               |
| **Instruments & Arrangement**       | `Arrangement`, `Instrument`, `GenericInstrument`, `BlueSynthBuilder` (widgets & presets), `BlueX7`, `JavaScriptInstrument`, `PythonInstrument`, `InstrumentAssignment`, `InstrumentLibrary`, `OpcodeDefinition`, `OpcodeList`                                                                                                                                                                                               |
| **Sound Objects & Note Processors** | `GenericScore`, `JavaScriptObject`, `ClojureObject`, `PythonObject`, `ObjectBuilder`, `CSDSoundObject`, `Comment`, `AudioFile`, `Sound`, `External`, `Instance`, `LineObject`, `ZakLineObject`, `PatternObject`, `PianoRoll`, `JMask`, `TrackerObject`, `FrozenSoundObject`, `SoundObjectLibrary`, `Note`, `NoteList`, `TimeBehavior`, `NoteProcessorChain`, `AddProcessor`, `MultiplyProcessor`, `Code`, `PythonProcessor` |
| **Mixer, Automation & Live**        | `Mixer`, `Channel`, `ChannelList`, `Effect`, `EffectsChain`, `Send`, `Parameter`, `ParameterList`, `ParameterIdList`, `AutomationCurve`, `LiveData`, `LiveObject`, `LiveObjectSet`, `LiveObjectSetList`, `MidiInputProcessor`, `MidiKeyMapping`, `MidiVelocityMapping`                                                                                                                                                      |
| **Timing Primitives**               | `TimeBase`, `TimePosition`, `TimeDuration`, `TimeContext`, `TimeState`, `TempoMap`, `TempoPoint`, `CurveType`, `MeterMap`, `MeasureMeterPair`, `Meter`, `SmpteFrameRate`, `beatsToTimePosition`, `timePositionToBeats`, `convertTimePosition`, `secondsToTimePosition`, `timePositionToSeconds`, `framesToTimePosition`, `timePositionToFrames`, `beatsToDuration`                                                          |
| **Runtime & CSD Compilation**       | `initializeJavaScriptRuntime`, `isJavaScriptRuntimeInitialized`, `JavaScriptSession`, `setJavaScriptSession`, `getJavaScriptSession`, `disposeJavaScriptCompileState`, `JavaRuntimeClientContract`, `setJavaRuntimeClient`, `getJavaRuntimeClient`, `setExternalCommandExecutor`, `getExternalCommandExecutor`, `CompileData`, `buildStandardCSD`, `buildStandardCSDAsync`, `toBlueLiveCSD`, `toBlueLiveCSDAsync`           |
| **Score & XML Utilities**           | `setScoreStart`, `getNotes`, `applyNoteProcessorChain`, `getTotalDuration`, `NoteParseException`, `parseScalaScale`, `parseAudioFileMetadata`                                                                                                                                                                                                                                                                               |

## Licensing

See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for package license terms (`MIT AND Apache-2.0`) and third-party attributions.
