# @blue/data — Quick Start Guide

## Installation

```bash
pnpm install @blue/data
```

Or from the monorepo root:

```bash
pnpm install
pnpm build
```

## Basic Usage

### Loading a .blue File

```typescript
import { BlueData } from '@blue/data';
import { readFileSync } from 'fs';

// Read XML from file (in Node.js; browser uses fetch/FileReader)
const xml = readFileSync('project.blue', 'utf-8');
const data = BlueData.loadFromString(xml);

console.log('Project:', data.getProjectProperties().title);
console.log('Version:', data.getVersion());
```

### Saving a .blue File

```typescript
const xml = data.saveToString();
writeFileSync('project.blue', xml);
```

### Inspecting the Score

```typescript
const score = data.getScore();

// Check layer groups
for (const lg of score) {
  console.log('Layer group:', lg.getName());
}

// Access audio layers
import { AudioLayerGroup } from '@blue/data';
const audioGroup = score[0] as AudioLayerGroup;
for (const layer of audioGroup) {
  console.log('  Layer:', layer.getName());
  for (const clip of layer) {
    console.log('    Clip:', clip.getName(), clip.getAudioFile());
  }
}

// Access pattern layers
import { PatternsLayerGroup } from '@blue/data';
const patternGroup = score[1] as PatternsLayerGroup;
console.log('Pattern beats:', patternGroup.getPatternBeatsLength());
for (const layer of patternGroup) {
  const pd = layer.getPatternData();
  console.log('  Pattern max:', pd.getMaxSelected());
}
```

### Generating a CSD

```typescript
import { initializeJavaScriptRuntime } from '@blue/data';

// Required if the project contains JavaScriptObject sound objects.
await initializeJavaScriptRuntime();

const csd = data.toCSD();
console.log(csd);
// Outputs:
// <CsoundSynthesizer>
// <CsOptions>
// -r 44100
// -k 64
// ...
// </CsOptions>
// <CsInstruments>
// ... orchestra code ...
// </CsInstruments>
// <CsScore>
// i1 0 2
// ...
// </CsScore>
// </CsoundSynthesizer>
```

### Generating a CSD with Java-backed Clojure or Jython

```typescript
import type { JavaRuntimeClientContract } from '@blue/data';

const runtimeClient: JavaRuntimeClientContract = /* provided by the host app */;

await data.processOnLoadAsync(undefined, runtimeClient);
const csd = await data.toCSDAsync(undefined, runtimeClient);
```

`@blue/data` stays browser-safe and does not launch Java itself. Hosts such as Electron main inject a `JavaRuntimeClientContract` when they want `ClojureObject`, `PythonObject`, Python `ObjectBuilder`, `PythonInstrument`, or `PythonProcessor` execution to participate in on-load processing, note processing, orchestra generation, and score generation.

### Automation resolution parity

`Parameter` keeps its values, bounds, and line points as JavaScript `number`
(binary64). Its resolution is stored as an exact Java-compatible decimal text;
use `getResolutionText()` and `setResolutionText()` when the scale matters.
Positive resolutions quantize interpolated values with Java Blue semantics. A
zero or negative resolution leaves interpolation unquantized. Project XML
writes the canonical `bdresolution` text and reads legacy numeric `resolution`
attributes for compatibility.

### Creating a Project Programmatically

```typescript
import {
  BlueData,
  ProjectProperties,
  AudioLayerGroup,
  AudioLayer,
  AudioClip,
  FadeType,
  TimePosition,
  TimeDuration,
  Score,
  GlobalOrcSco,
  Tables,
} from '@blue/data';

const data = new BlueData();

// Set project properties
data.getProjectProperties().sampleRate = '44100';
data.getProjectProperties().ksmps = '64';
data.getProjectProperties().nchnls = '2';

// Global orchestra
data.getGlobalOrcSco().setGlobalOrc('sr = 44100\nkr = 4410\nnchnls = 2\n0dbfs = 1\n');

// F-tables
data.getTableSet().addTable('f1', 'f 1 0 1024 10 1');

// Score with audio layer
const score = new Score();
const audioGroup = new AudioLayerGroup();
const layer = audioGroup.newLayerAt(0);
layer.setName('Audio Track 1');

const clip = new AudioClip();
clip.setName('Kick Drum');
clip.setAudioFile('/samples/kick.wav');
clip.setAudioDuration(0.5);
clip.setStartTime(TimePosition.beats(0));
clip.setSubjectiveDuration(TimeDuration.beats(0.5));
clip.setFadeIn(0.01);
clip.setFadeOut(0.01);
layer.push(clip);

score.push(audioGroup);
data.setScore(score);

// Save
const xml = data.saveToString();
```

## API Reference

### Core

| Class | Description |
|-------|-------------|
| `BlueData` | Root project class. `loadFromString()`, `saveToString()`, `toCSD()` |
| `ProjectProperties` | Sample rate, ksmps, nchnls, 0dbfs, Csound options |
| `CompileData` | CSD compilation accumulator |

### Score Layers

| Type | Description |
|------|-------------|
| `AudioClip` | File-based audio clip with timing and fades |
| `AudioLayer` | Layer of AudioClip objects |
| `AudioLayerGroup` | Group of AudioLayers |
| `PatternData` | Boolean array pattern |
| `PatternLayer` | Layer with SoundObject + pattern grid |
| `PatternsLayerGroup` | Group of PatternLayers |
| `PolyObject` | Nested layer group (legacy score type) |

### Sound Objects

| Type | Description |
|------|-------------|
| `GenericScore` | Raw Csound score text |
| `ClojureObject` | Clojure code -> score (requires injected Java runtime for execution) |
| `JavaScriptObject` | JS code → score (uses QuickJS after runtime initialization) |
| `PythonObject` | Python code → score (requires injected Java runtime for execution) |
| `ObjectBuilder` | Builder-based score object; Python execution requires injected Java runtime |
| `CSDSoundObject` | Embedded CSD |
| `Comment` | Score annotation |

### Supporting Types

| Category | Types |
|----------|-------|
| Mixer | `Mixer`, `Channel`, `Effect`, `EffectsChain`, `Send` |
| Automation | `Parameter`, `ParameterList` |
| Note Processors | `AddProcessor`, `MultiplyProcessor`, `Code`, `PythonProcessor` |
| Live | `LiveObject`, `LiveObjectSet`, `LiveObjectSetList` |
| MIDI | `MidiKeyMapping`, `MidiVelocityMapping` |
| Opcodes | `OpcodeDefinition`, `OpcodeList` |

### Utilities

| Function | Description |
|----------|-------------|
| `setScoreStart(notes, offset)` | Shift all notes by offset |
| `getNotes(scoreText)` | Parse Csound score text into NoteList |
| `applyNoteProcessorChain(notes, chain)` | Apply processor chain |

## Environment Compatibility

`@blue/data` works in **both Node.js and browsers**:

- ✅ No Node.js built-in dependency for `JavaScriptObject` execution
- ✅ `ClojureObject`, `PythonObject`, `ObjectBuilder`, `PythonInstrument`, and `PythonProcessor` XML/project metadata remain available without Java
- ✅ QuickJS-backed JavaScript evaluation works in both Node.js and browser bundles
- ✅ Loading/saving `.blue` XML files remains synchronous
- ⚠️ `JavaScriptObject` execution requires a one-time async runtime preload
- ⚠️ Clojure and Python-backed execution uses the async Java runtime contract and host-provided `toCSDAsync()` / `processOnLoadAsync()` flows

### Initializing the JavaScript runtime

If you call `data.toCSD()` on a project that contains `JavaScriptObject` sound
objects, or call `JavaScriptObject.generateForCSD()` directly, preload QuickJS
once before generating score:

```typescript
import {
  BlueData,
  CompileData,
  JavaScriptObject,
  TimeContext,
  disposeJavaScriptCompileState,
  initializeJavaScriptRuntime,
} from '@blue/data';

await initializeJavaScriptRuntime();

const data = BlueData.loadFromString(xml);
const csd = data.toCSD();

// Low-level direct JavaScriptObject use should dispose its compile state.
const compileData = new CompileData();
try {
  const notes = new JavaScriptObject().generateForCSD(
    new TimeContext(),
    compileData,
    0,
    -1,
  );
  console.log(notes.length);
} finally {
  disposeJavaScriptCompileState(compileData);
}
```

### What works everywhere

- Loading/saving `.blue` XML files
- All data class manipulation
- `JavaScriptObject` score generation after `await initializeJavaScriptRuntime()`
- CSD generation for projects that do not require host-injected Java evaluation

### What requires a host-injected Java runtime

- `ClojureObject` score generation and on-load execution
- `PythonObject` and Python `ObjectBuilder` score generation
- `PythonInstrument` orchestra generation and `PythonProcessor` note-chain execution
- `Mixer` CSD variable generation — needs channel routing info

## Browser Usage

```html
<script type="module">
  import {
    BlueData,
    initializeJavaScriptRuntime,
  } from '/path/to/@blue/data/dist/index.js';

  await initializeJavaScriptRuntime();

  const xml = '<blueData version="2.10.0"><projectProperties><title>Test</title></projectProperties></blueData>';
  const data = BlueData.loadFromString(xml);
  console.log(data.getProjectProperties().title); // "Test"
</script>
```
