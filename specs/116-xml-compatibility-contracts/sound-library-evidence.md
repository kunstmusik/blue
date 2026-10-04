# SoundObject, layer, processor, and library acceptance evidence

**Research completed**: 2026-10-02  
**Scope**: The production owners below, reachable from project XML and independent resource/library XML.  
**Method**: Read-only TypeScript source inspection and local Java source/Git history. No tests were executed, fixtures imported, or production code changed.

## Evidence and support policy

Java sources were inspected at `3ca3f40579c48a023299a68130d8ab6b9e950974` in the local
`/Users/stevenyi/work/nbprojects/blue` checkout. References use that revision unless a historical
revision is stated. Source behavior is not proof that an intermediate form shipped in a release.
Historical source paths before the Maven migration use `blue-core/src/blue/…`.

This inventory adopts these planning decisions:

- Accept the finite current members below and historical forms explicitly listed in the historical
  table. Validate nested owners as well as their outer type. A class name's last component does
  not make an arbitrary package-qualified name supported.
- Supported text, timing, UI settings, processors, generators, and references have typed owners.
  Known Python/Clojure code remains supported when its runtime is unavailable; acceptance does
  not execute it. No arbitrary SoundObject, processor, layer, or widget subtree is a project
  retention contract.
- All unknown members/attributes, malformed present values, unknown polymorphic types, significant
  mixed content, duplicate singletons, and contradictory old/current forms are errors unless a
  narrower row states a warning rule. Rejection leaves the candidate unpublished.
- Historical missing optional fields use their class defaults; required identity/references or
  format discriminators must not be invented. Validate complete numeric tokens and finite values,
  not successful numeric prefixes. Preserve significant scalar/code text without trimming.
- A canonical writer emits current forms; normalization operates once at the shared class boundary
  reached by both project and standalone loading. Project structural relocation is owned by the
  project migrators, including the legacy audio-layer conversion.
- Unsupported library leaves are diagnosed archives with exact original leaf XML; they remain
  exportable and raw-XML-editable. They are not editable typed models or insertable project objects.
  A malformed/unsupported envelope is rejected; its unknown branches cannot become invisible
  discarded library content.

### Shared validation notation

In the tables, ordinary fields are scalar singleton children unless `[]` denotes ordered repeated
children. `@` denotes an attribute. Ordinary scalar fields have no attributes/element children;
time fields delegate their attributes/subtree to the TimePosition/TimeDuration contracts. Optional
historical omissions are distinct from malformed present values. All unlisted names are errors.
`type` is required at polymorphic roots, with an explicit supported full-name/short-name alias
table rather than unrestricted suffix matching. The contextual `@objRefId` is allowed only on
project SoundObject-library leaves, where identity is owned by that library.

## Reachable SoundObject owners

Production registry: `packages/blue-data/src/sound-objects/register-sound-object-types.ts` and
`sound-object-registry.ts`. Shared common data: `sound-object-utilities.ts` and
`abstract-sound-object.ts`. Java reference:
[SoundObjectUtilities](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/SoundObjectUtilities.java).

Common current data is `@type`, `name`, `startTime`, `subjectiveDuration`, `backgroundColor`,
`timeBehavior`, `repeatPoint`, and `noteProcessorChain`. Timing roots delegate to their actual
time representations. Java time-behavior ordinals are `-1` unsupported, `0` scale, `1` classic
repeat, `2` none, `3` repeat; recognized TypeScript enum names are an explicit local compatibility
form. A plain `repeatPoint` of `-1` represents no repeat. Do not treat all negative values or
malformed numeric input as this sentinel. Duration must be finite/nonnegative; start positions
may be signed where the owning model permits them. A missing processor chain is empty.

| Owner / production file under `packages/blue-data/src/` | Additional current members | Representation and planning rule |
| --- | --- | --- |
| GenericScore — `sound-objects/generic-score.ts` | `score` | Typed score text, including leading/trailing newlines. `scoreText` is a reader-only TypeScript alias; see historical decisions. |
| Comment — `sound-objects/comment.ts` | `commentText` | Typed text; missing historical text is empty. No execution capability. |
| AudioFile — `sound-objects/audio-file.ts` | `soundFileName`, `csoundPostCode` | Typed native path and Csound text. A missing file is a runtime/filesystem condition, not invalid XML. AudioFile is not valid inside a Track. |
| PythonObject — `sound-objects/python-object.ts` | `@onLoadProcessable`, `pythonCode` | Typed code/boolean; absent historical flag false. Defer execution until the whole candidate passes. |
| ClojureObject — `sound-objects/clojure-object.ts` | `@onLoadProcessable`, `clojureCode` | Typed code/boolean; recognize the explicit `blue.clojure.soundObject.ClojureObject` type as well as documented registry aliases. Runtime availability is separate. |
| JavaScriptObject — `sound-objects/javascript-object.ts` | `@onLoadProcessable`, `javaScriptCode` | Typed code/boolean, same acceptance-before-execution rule. |
| CSDSoundObject — `sound-objects/csd-sound-object.ts` | `csdText` | Typed whole CSD text. Its existing writer uses the short type `CSDSoundObject` and plain common timing, so support those explicitly; do not require a Java package prefix that the writer never emits. |
| External — `sound-objects/external.ts` | `text`, `commandLine`, `syntaxType` | Typed code, command text, and editor syntax string. Expected scalar `syntaxType` is data, not an element-name extension point. Loading must not run the command. |
| FrozenSoundObject — `sound-objects/frozen-sound-object.ts` | `numChannels`, `frozenWaveFileName`, optional nested `soundObject` | Positive integral channel count when supplied; typed file path and recursively accepted source object. Unknown nested type is error in a project or standalone accepted resource; archive only at the library outcome. |
| Instance — `sound-objects/instance.ts` | `soundObjectReference` with `@soundObjectLibraryID`; authored common `name` and `backgroundColor` | Typed reference; the historical `null` sentinel means no target. Resolve references only after all project library owners are accepted. Unresolved external dependency in a library has explicit dependency metadata and blocks insertion until resolved; it is not an unknown XML bag. The Java reference setter only rebinds the target, so an Instance's serialized name/color remain independent; initial construction from a definition may inherit them explicitly ([GPL-2.0-or-later Java source at `3ca3f40579c48a023299a68130d8ab6b9e950974`](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/Instance.java)). |
| Sound — `sound-objects/sound.ts` | `instrument`, `comment` | Typed BlueSynthBuilder plus text. Validate that the instrument is the appropriate kind and all its BSB owners; migrate old `instrumentText` locally. |
| ObjectBuilder — `sound-objects/object-builder.ts` | `@editEnabled`, `code`, `commandLine`, `graphicInterface`, `presetGroup`, `comment`, `languageType` | Typed BSB interface/presets and language `PYTHON`, `JAVASCRIPT`, `CLOJURE`, `EXTERNAL`. Missing old language defaults PYTHON; old `isExternal` conversion belongs here. BSB nested rules are shared with instrument/effect contracts. |
| LineObject — `sound-objects/line-object.ts` | `line[]` | Typed line records and points; explicit aliases/version migration below. |
| ZakLineObject — `sound-objects/zak-line-object.ts` | `zakSpace`, `zakline[]` | Typed Zak-space/channel integers and line records. Same point/value normalization as LineObject. |
| PatternObject — `sound-objects/pattern-object.ts` | `beats`, `subDivisions`, `patterns` containing `pattern[]` | Positive integer grid dimensions (historical omission defaults 4/4), ordered typed patterns; validate binary values instead of interpreting every non-`1` character as false. |
| PianoRoll — `sound-objects/piano-roll.ts` | `noteTemplate`, `instrumentId`, `scale`, `pchGenerationMethod`, `transposition`, `pixelSecond`, `noteHeight`, `snapEnabled`, `snapValueEnum`, `useGlobalRuler`, `primaryTimeDisplay`, `secondaryTimeDisplay`, `secondaryRulerEnabled`, `fieldDef[]`, `pianoNote[]` | Typed score template, scale/notes, grid and ruler settings. Pitch method is 0 frequency / 1 pch / 2 MIDI; integer transposition; positive editor dimensions. Explicit snap/time enums, no invalid-value fallback. See historical and writer defect rows. |
| TrackerObject — `sound-objects/tracker-object.ts` | `stepsPerBeat`, `trackList` and typed columns/notes; historical objective `duration` | Positive integer subdivision and ordered typed tracker tracks. The historical objective duration remains a separate optional typed value, is copied and written back with a named warning that current TypeScript generation uses `subjectiveDuration`. Tracker column records accept Java's `<track>` and TypeScript's `<column>` tags under `<columns>`; each uses the strict column field grammar and canonical TypeScript output uses `<column>`. `tracks` is reader-only TypeScript compatibility, not evidence of Java output. |
| JMask — `sound-objects/j-mask.ts` | `seedUsed`, `seed`, `field` | Typed seed/use flag and full generator model below. Missing seed fields from before 2015 mean seed disabled. Seed is authoritative signed64 canonical decimal string, including snapshots/patches; use BigInt for JavaRandom input before Number narrowing. |
| PolyObject — `sound-objects/poly-object.ts` | `defaultHeightIndex`, nested `timeState`, `soundLayer[]`; legacy `isRoot`, `heightIndex`, and inline TimeState children | Typed nested layers, per-PolyObject TimeState, common timing, and processor chain. The 2012 TimeState extraction introduced nested `<timeState>`; prior PolyObject writers stored `pixelSecond`, `snapEnabled`, `snapValue`, `timeDisplay`, and `timeUnit` inline. Accept either nested state or those exact inline members; reject both topologies together. Versionless old `heightIndex` maps `max(value - 1, 0)` to the group and all child layers; exact version `2` uses the current index directly. `isRoot=true` overrides time behavior to `NONE`; false has no effect. Existing attribute-based TypeScript form remains a named historical normalization, not permission for arbitrary attributes. Canonical output emits nested `timeState`, current `defaultHeightIndex`/layer indexes and `timeBehavior`, and omits legacy members. Root project TimeState extraction stays project-owned. PolyObject is not valid inside a Track. |

The table contains every built-in registered SoundObject. Primitive generated `Note`/`NoteList`,
runtime exceptions, generator runtime caches, renderer drag snapshots, and registry descriptors
are not additional XML owners. `Sound`/ObjectBuilder reach the separate BSB/instrument inventory;
all timing fields reach the time inventory rather than duplicating their contract here.

### Line and pattern subtrees

| Owner | Current shape | Historical/default/validation decision |
| --- | --- | --- |
| LineData in LineObject | `line @name @version @max @min @bdresolution @color @rightBound @endPointsLinked`, `linePoint[]` | Current version 2. Missing historical version means 1; rescale old normalized y to `min + y*(max-min)` once, then version 2. Version 1 requires bounded normalized values, version 2 finite values. Names are unique within their line owner. |
| ZakLineData | `zakline @channel` plus line attributes above except `name` | Integral channel and explicit Zak-space rules; distinct channels. No implicit fallback for malformed channels. |
| LinePoint | `linePoint @x @y`, no children/text | Finite coordinates, ordered x values; equal x values are allowed when representing a discontinuity. Historical line Y migration changes values, not point order. |
| Pattern | `patternName`, `patternScore`, `muted`, `solo`, `values` | Ordered typed pattern score/binary step vector; missing flags false. Preserve code whitespace; binary strings permit only `0`/`1`, with documented formatting trim only outside the vector. |
| PatternData | `patternData` scalar binary text | Typed boolean vector. Current `saveAsXML()` calls `resizePatterns()` on its own state: implementation must serialize a derived compact representation without mutating canonical content. |

Line support includes historical `resolution` but canonical output uses `bdresolution`. If both
are supplied and each is valid, `bdresolution` is authoritative, matching Java's documented
reader precedence; legacy resolution is validated before being superseded. Decimal
resolution data must not acquire binary-floating artifacts on save. Legacy missing color uses the
documented gray default. Current TS additionally reads `varName` and a text `points` field;
these forms are explicit TypeScript compatibility decisions below, not guessed Java history.

### PianoRoll owners and declared field map

Current Java reference:
[PianoRoll](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/PianoRoll.java).

| Owner / production file | Current shape | Defaults and validation |
| --- | --- | --- |
| Scale — `sound-objects/piano-roll/scale.ts` | `scaleName`, `baseFrequency`, `octave`, `ratios` containing `ratio[]` | Missing old scale is typed 12TET, base frequency 261.625565, octave multiplier 2; supplied frequency/octave/ratios finite positive, nonempty ratio list. Preserve ordered ratios. |
| FieldDef — `sound-objects/piano-roll/field-def.ts` | `fieldDef @name @fieldType @min @max @default` | Nonempty unique name; `CONTINUOUS`/`DISCRETE`; finite range/default and default within the defined range. Constructor defaults field/continuous/0/1/1 are historical defaults only when the appropriate optional field is omitted. Reversed range handling must match the supported model rather than unconditionally sorting endpoints. |
| PianoNote — `sound-objects/piano-roll/piano-note.ts` | `octave`, `scaleDegree`, `start`, `duration`, optional `noteTemplate`, `field[]` | Integer octave/degree, finite start/duration, nonnegative duration. Historical note defaults 8/0/0/1; explicit supplied values validate. A note template equal to the parent template becomes inherited/null. |
| Field — `sound-objects/piano-roll/field.ts` | `field @name @val` | Each name must resolve to exactly one accepted FieldDef. One value per definition/name; malformed, duplicate, undeclared fields error. Historical notes without fields remain accepted with their documented defaults/inherited definitions, not fabricated unknown definitions. |

The field-name space is a **declared map**: user-defined nonempty field names are permitted, but
entry names do not exempt each entry's fixed `name`/`val` shape and numeric domain. Read all
FieldDefs before resolving note fields so XML child order cannot silently create definitions.
Copies/history must relink note Fields to the copied owner’s FieldDefs; the existing PianoNote
copy shares definitions, while PianoRoll separately copies its definitions. Verify this owner
relationship rather than merely comparing XML strings.

PianoRoll defaults from the current TypeScript constructor are pixelSecond 64, noteHeight 15,
snap true/SIXTEENTH, local ruler, primary BBF, secondary TIME disabled. The load constructor clears
the default AMP definition; acceptance must deliberately distinguish older absent fields from
newly created object defaults. A writer currently emits an empty `scale` then the populated
`scale`: remove this duplicate. To read existing TypeScript output safely, recognize only exactly
that empty-first/populated-second shape as a local migration; otherwise duplicate scales error.

### Tracker owners

| Owner / production file | Current shape | Validation / historical behavior |
| --- | --- | --- |
| TrackList — `sound-objects/tracker/track-list.ts` | `steps`, `track[]` | Nonnegative integer grid steps and ordered tracks. Validate supplied note/grid consistency; avoid silent truncation. |
| Tracker Track — `sound-objects/tracker/track.ts` | `name`, `noteTemplate`, `instrumentId`, `columns` containing `column[]`, `trackerNotes` containing `trackerNote[]` | Typed template/id text, ordered definitions/notes. Distinct from timeline Track despite sharing `track` root spelling; owner context chooses the grammar. |
| Column — `sound-objects/tracker/column.ts` | `name`, `rangeMin`, `rangeMax`, `type`, `restrictedToInteger`, `usingRange`, `scale`, `outputFrequency` | Type ordinals 0 pch / 1 Blue pch / 2 MIDI / 3 string / 4 number. Defaults col/string/0/0, restrictions false, outputFrequency true, 12TET scale. Validate booleans and finite ranges; string column cells remain text. |
| TrackerNote — `sound-objects/tracker/tracker-note.ts` | `tied`, `off`, `field[] @val` | Typed ordered cell strings; flags false when omitted. Legacy pitch/amp text and otherField @val map to cells in source order. Column/cell consistency belongs to enclosing tracker, not arbitrary child fallback. |

Current Java reference:
[TrackerNote](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/tracker/TrackerNote.java).
Initial-import writer already emits `field`; its reader additionally understands `pitch`, `amp`,
`otherField`. Their earlier writer history predates the local Git import, so support them as a
deliberate bounded Java-reader compatibility decision, without claiming the import proves they
were emitted by that writer. Mixed modern/legacy repeated cells are accepted in order only if
the enclosing track validates the resulting column mapping; contradictory grid/cell shapes error.

## Timeline layer and AudioClip owners

| Owner / production file under `packages/blue-data/src/` | Current members | Support disposition |
| --- | --- | --- |
| SoundLayer — `sound-objects/sound-layer.ts`, serialized by PolyObject | `@name @muted @solo @heightIndex @customHeight @automationSelectedIndex`; `backgroundColor`, `noteProcessorChain`, `soundObject[]`, `parameterId[]` | Typed flags/dimensions/color/processors and automation id list. Missing old flags false, height default; customHeight optional within existing height policy. Replace generic attributes/children with typed fields or errors. |
| PatternsLayerGroup — `score/patterns/patterns-layer-group.ts` | `@name`; `patternBeatsLength`, `patternLayers` containing `patternLayer[]`, `noteProcessorChain` | Positive pattern beat length, typed group. Direct beta `patternLayer` normalization is project structural migration; a canonical group has the container once. |
| PatternLayer — `score/patterns/pattern-layer.ts` | `@name @muted @solo`; `backgroundColor`, optional `soundObject`, `patternData` | Typed object/vector and color; no arbitrary unresolved SoundObject subtree acceptance. Unknown type errors in accepted project; library may archive whole leaf instead. |
| TrackLayerGroup — `score/track/track-layer-group.ts` | `@name @uniqueId`; `defaultHeightIndex`, `tracks` containing `track[]` | Typed group/id/dimensions. Existing unknown group/tracks attributes/children are not named retention contracts. Reject unknowns. |
| Timeline Track — `score/track/track.ts` | `@name @muted @solo @heightIndex @customHeight @uniqueId @automationSelectedIndex`; `backgroundColor`, `noteProcessorChain`, optional `instrument`, `audioClip[]` / compatible `soundObject[]`, `parameterId[]` | Typed Track and registered placement rules. Unknown/incompatible objects currently enter a raw child bag; instead reject insertion/project acceptance. Track instrument validates its full resource contract. |
| AudioClip — `score/audio/audio-clip.ts` | `name`, `audioFile`, `numChannels`, `audioDuration`, `fileStart`, `startTime`, `subjectiveDuration`, `fadeIn`, `fadeInType`, `fadeOut`, `fadeOutType`, `looping`, `backgroundColor` | Typed file/timing/fades. Finite nonnegative durations/fades/channel count; known fade names. Missing file metadata is separately resolved host data. Do not perform filesystem reads in data acceptance. |
| Project SoundObjectLibrary — `sound-objects/sound-object-library.ts` | `soundObjectLibrary` containing `soundObject[] @objRefId` | Ordered project objects with unique accepted identity; build reference map before Instance resolution. Distinct grammar from the same-named categorized user library. |

The common layer-color and height rules already have dedicated owners in
`score/layers/layer-color.ts`, `score/layer-height-policy.ts`, and automation parameter-list models.
Those supply concrete range/default rules; malformed present values must no longer be retained as
unknown attributes or silently changed to defaults. `parameterId[]` is a declared identifier list;
entry child shape remains fixed and duplicates/references validate against the owning project.

AudioClip historical `start` and `duration` scalar beat values normalize to canonical typed
`startTime`/`subjectiveDuration`. `Symmetric` fade normalizes to the explicit TypeScript `S-Curve`
replacement, already documented in `score/audio/fade-type.ts`; this intentional behavioral
divergence must retain its focused coverage. Do not translate any unfamiliar fade name to Linear.
Aliases present with current timing must be semantically equal, otherwise error. Existing
TypeScript AudioClip default looping is true, fades zero/Linear; missing old optional fields use
that documented contract. Numeric roots may carry only the time contract's declared attributes.

## Note processor owners

Entry points: `note-processors/note-processor-chain.ts` and `note-processor-chain-map.ts`.
Java reference:
[NoteProcessorChainMap](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/noteProcessor/NoteProcessorChainMap.java).

| Owner | Current fields beneath `noteProcessor @type` | Validation / output |
| --- | --- | --- |
| AddProcessor, MultiplyProcessor, EqualsProcessor, InversionProcessor, PchAddProcessor, PchInversionProcessor | `pfield`, `value` | Fixed typed processor data; pfield positive integer, valid value syntax for that processor. Prefix parsing is insufficient. Current type output is `blue.noteProcessor.<Class>`. |
| RandomAddProcessor, RandomMultiplyProcessor | `pfield`, `min`, `max`, `seedUsed`, `seed` | Finite bounds and authoritative signed64 canonical decimal-string seed; flags canonical booleans; missing historical seed flag false. Snapshots/patches carry the same exact seed. |
| LineAddProcessor | `pfield`, `lineAddString` | Typed processor and its documented line grammar; preserve input text and reject malformed grammar on acceptance. |
| LineMultiplyProcessor | `pfield`, `lineMultiplyString` | Same with its own line grammar. |
| RetrogradeProcessor | No fields | Any member/attribute other than the fixed type is unexpected. |
| RotateProcessor | `noteIndex` | Integral offset with processor semantics; no arbitrary numeric fallback. |
| TimeWarpProcessor | `timeWarpString` | Known mapping-string grammar; validate the whole value. |
| SwitchProcessor | `pfield1`, `pfield2` | Positive integral pfield indices. |
| SubListProcessor | `start`, `end` | Integral selection indices consistent with documented processor semantics; no unknown fields. |
| TuningProcessor | `pfield`, Java `scale` with `scaleName`, `baseFrequency`, `octave`, `ratios` containing `ratio[]` | Accept the complete shared typed Scale, preserving name/octave/ratios. Current TS simplified scale with multiline scalar ratios is an explicitly supported TS historical form; normalize it to full Scale. Positive frequency/ratios, pfield greater than 3. Historical top-level baseFrequency and external scale reference rules below. |
| PythonProcessor | `code` | Typed code, valid even if Jython is unavailable; disabled execution reports runtime availability. No execution during acceptance. |
| NoteProcessorChain | Ordered `noteProcessor[]`, no ordinary attributes | Every processor must validate; unknown types error rather than becoming project UnsupportedProcessor. |
| NoteProcessorChainMap | `npc[] @name`, each exactly one `noteProcessorChain` | Declared arbitrary nonempty map key names, unique keys, fully validated chain values. No unknown XML under an entry. |

The table lists all 17 registered processor classes. `Code` is a separately exported implementation
with writer type `blue.noteProcessor.Code`; its own standalone `noteProcessor @type` root with
one `code` scalar is accepted by its explicit loader contract. It is absent from the chain registry
and therefore is not accepted inside a NoteProcessorChain. `UnsupportedProcessor` currently stores
any type's XML and snapshots preserve it. This feature must remove that implicit project
acceptance route: an unknown processor rejects the candidate; the whole containing library leaf
can be archived under the library contract. PythonProcessor is known and needs no generic raw bag.

Some values intentionally remain strings in existing processor APIs. A typed representation here
means a validated authoritative field with its defined grammar, not coercing code or Csound text
to numbers. Existing constructor defaults remain missing-field compatibility; failures of present
values do not become defaults. Exact seeded random data must survive save/copy/history, including
the distinction between random seed disabled and seed value zero. Exact signed64 seed values are
canonical decimal strings throughout authoritative fields/snapshots/patches; BigInt supplies the
existing JavaRandom state initialization without Number narrowing. Existing numeric setter arguments
remain allowed only for safe integers in signed64 range; they normalize immediately to that single
representation rather than establish a parallel raw-value shadow.

TuningProcessor currently ignores Java's nested ratio elements and scale name/octave, preserving
only its simplified TypeScript representation. The Java loader also accepts an older scalar
`scale` filename and optional top-level `baseFrequency`, resolving the file under the user's SCL
directory. This behavior is present in both the current snapshot and
[initial TuningProcessor source](https://github.com/kunstmusik/blue/blob/d1735b6fe22b6e0dee07d665108a50b6151e2cf9/blue-core/src/blue/noteProcessor/TuningProcessor.java).
Support the current Java full Scale and bounded old reference form explicitly. Main may resolve
the reference into an accepted Scale before execution/insertion requiring resolved dependencies;
resolution must be side-effect-free. Host-neutral model loading must not read files. A missing
external scale remains a named typed `TuningScaleReference` dependency with
filename and optional positive frequency override, retaining its recognized serialized shape
on save/copy/history and blocking generation and insertion needing the dependency until resolved.
Unknown scale members remain errors;
do not substitute 12TET for a supplied unreadable reference. Conflicting top-level/nested frequency
values error rather than depend on child order. No release-shipment or original filename-writer
claim is inferred from the permissive 2010 reader.

## JMask nested owners

Production owner file: `sound-objects/jmask-support.ts`. Current Java references:
[Field](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/jmask/Field.java),
[Parameter](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/jmask/Parameter.java),
[Table](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/jmask/Table.java),
[Probability](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/jmask/Probability.java).

| Owner | Current members | Defaults/domain |
| --- | --- | --- |
| Field | `parameter[]` | Ordered typed pfield definitions, no attributes. An accepted executable JMask requires the p1/p2/p3 positions. |
| Parameter | `@visible @name`; `generator`, optional `mask`, `quantizer`, `accumulator` | Visible defaults true; arbitrary name is scalar text. Exactly one known generator. Optional processors are valid only for the generator's declared capabilities; unknown generator cannot silently become Constant. |
| Table | `min`, `max`, `interpolationType`, `interpolation`, `points` containing `point[]`; contextual optional `@tableId` | Defaults 0/1, interpolationType ON=1, interpolation exponent 0. Types OFF=0/ON=1/COS=2 only. Ordered finite points; validate supplied range and shape without replacing values. |
| TablePoint | `point @time @value` | Finite coordinates; current constructor defaults 0/0.5 are not substitutes for malformed required coordinates. |
| Mask | `highTableEnabled`, `lowTableEnabled`, `low`, `high`, `mapValue`, `enabled`, `table[] @tableId` | Defaults low0/high1/map0/flags false. Declared table ids highTable/lowTable only, at most one each. |
| Quantizer | `gridSize`, `strength`, `offset`, `gridSizeTableEnabled`, `strengthTableEnabled`, `offsetTableEnabled`, `enabled`, `table[] @tableId` | Defaults grid1/strength1/offset0/flags false. Table ids gridSizeTable/strengthTable/offsetTable only; grid must satisfy nonzero/positive quantizer contract when enabled. |
| Accumulator | `highTableEnabled`, `lowTableEnabled`, `mode`, `low`, `high`, `initialValue`, `enabled`, `table[] @tableId` | Defaults ON=0, low0/high1/initial0/flags false; modes ON0/LIMIT1/MIRROR2/WRAP3. Table ids highTable/lowTable only. Runtime runningValue/firstTime/duration are not XML fields. |
| Constant generator | `value` | Finite value; constructor default 1. |
| Random generator | `min`, `max` | Finite bounds; defaults 0/1. |
| Oscillator generator | `oscillatorType`, `phaseInit`, `frequency`, `freqTableEnabled`, `table`, `exponent` | Types 0–7; defaults sine0/phase0/frequency1/flag false/exponent1. One frequency table, not arbitrary ids. |
| Segment generator | `table` | Exactly its typed segment table. |
| ItemList generator | `listType`, `index`, `direction`, `listItems` containing `item[]` | Types CYCLE0/SWING1/RANDOM2/HEAP3; finite ordered item values, index in supported bounds, supported direction. Defaults mode0/index0/direction0. Runtime cache state is not arbitrary XML. |
| Probability generator | `selectedIndex`, `probabilityGenerator[]` | Exactly the defined eight slots in the declared order: Uniform, Linear, Triangle, Exponential, Gaussian, Cauchy, Beta, Weibull. Index 0–7; reject missing/extra/mismatched slots and unknown types rather than skip/replace them. No shorter-list writer evidence was established, so partial lists are not accepted. |
| Uniform, Triangle probability generators | No fields | Fixed known type only; nested children are errors. |
| Linear probability generator | `direction` | DECREASING0/INCREASING1; default0. |
| Exponential probability generator | `direction`, `lambda`, `lambdaTableEnabled`, `table` | Direction0/1/2 bilateral, lambda positive; default direction0/lambda0.5/flag false. |
| Gaussian probability generator | `sigma`, `mu`, `sigmaTableEnabled`, `muTableEnabled`, `table[] @tableId` | Positive sigma; defaults sigma0.1/mu0.5/flags false; sigmaTable/muTable ids only. |
| Cauchy probability generator | `alpha`, `mu`, `alphaTableEnabled`, `muTableEnabled`, `table[] @tableId` | Positive alpha; defaults alpha0.1/mu0.5/flags false; alphaTable/muTable ids only. |
| Beta probability generator | `a`, `b`, `aTableEnabled`, `bTableEnabled`, `table[] @tableId` | Positive a/b; defaults0.1/0.1/flags false; aTable/bTable ids only. |
| Weibull probability generator | `s`, `t`, `sTableEnabled`, `tTableEnabled`, `table[] @tableId` | Positive s/t; defaults0.5/2/flags false; sTable/tTable ids only. |

Generators use fixed full names `blue.soundObject.jmask.<Class>`; probability-generator full names
use `blue.soundObject.jmask.probability.<Class>`. Existing registered short aliases are explicitly
supported as TypeScript input forms, but arbitrary package prefixes are unexpected. `DoubleOrTable`,
JavaRandom, GeneratorEntry/Registry, and snapshot repair helpers are runtime/model helpers without
their own reachable XML root. They do not enlarge the serialized type registry.

Table selectors are a **declared finite map**. The outer mask/probability class decides the allowed
`tableId` names; each value still passes the complete Table/Point grammar. Duplicate ids and
unrecognized ids error. A broad `tableId` map or ignored tables would lose meaningful generator
data. Present fields that are disabled remain accepted, copied, and saved because enabling them
later is a user-visible action; unavailable execution does not authorize dropping dormant data.

## Historical normalization matrix

| ID | Evidence / provenance | Accepted form and normalization | Owner / conflict / canonical result |
| --- | --- | --- | --- |
| SL-H01 | [Initial Sound writer](https://github.com/kunstmusik/blue/blob/d1735b6fe22b6e0dee07d665108a50b6151e2cf9/blue-core/src/blue/soundObject/Sound.java), 2010 imported source; earlier release date unproven | Sound `instrumentText` becomes a typed BlueSynthBuilder instrument's instrument text. | Sound local loader, applies standalone and embedded. If current instrument and old text both appear, reject unless instrument's normalized content exactly represents the old form. Write current instrument. |
| SL-H02 | [ObjectBuilder language transition](https://github.com/kunstmusik/blue/commit/e5f762edafca0173a1504a87f3b3b57cecf65596), 2017-10-12; source identifies pre-2.7.2 use | `isExternal=false/true` maps PYTHON/EXTERNAL; current language supports four enums. Historical writer also emitted `syntaxType`, which the new reader stopped reading. | ObjectBuilder local. Contradictory languageType/isExternal error. Canonical languageType; no project version required. See narrowly bounded syntaxType disposition below. |
| SL-H03 | [Line precision writer transition](https://github.com/kunstmusik/blue/commit/90b9750150b5ec7359fa9e9a3d12622491135320) and [reader fix](https://github.com/kunstmusik/blue/commit/098338597c8465ff845958a30b69f2c4d5399268), 2016-12-07 | Historical `resolution` numeric attr → canonical `bdresolution` decimal attr; preserve intended decimal precision and the Java legacy five-decimal half-up normalization rule. | Shared LineData normalization reached by line/zak owners. Valid bdresolution takes documented precedence over valid legacy resolution; malformed either errors. |
| SL-H04 | [Initial Line source](https://github.com/kunstmusik/blue/blob/d1735b6fe22b6e0dee07d665108a50b6151e2cf9/blue-core/src/blue/components/lines/Line.java), source describes pre-0.110.0 range | Missing/version1 point y normalized 0–1 → absolute min/max. Historical missing color defaults gray. | Local line owner. Version2 is stable on repeated normalization. Require valid version1 domain; no partial parse/clamping. |
| SL-H05 | [First TimeUnit writer](https://github.com/kunstmusik/blue/commit/3b237ef572853ffc31f45a8c9af3f9c8808c979e), [writer/reader correction](https://github.com/kunstmusik/blue/commit/08ac9375357a481d5799c50e259f8febbcf7d68d), 2025-10-23 development; [continued writer](https://github.com/kunstmusik/blue/commit/917b3aa105044eadde4c8c748a757d671055f8a0), 2025-11-01; [duration refactor](https://github.com/kunstmusik/blue/commit/7da35d375be5f17d8a7c42383ad100fb9ce55193), 2026-02-08; [repeatPoint refactor](https://github.com/kunstmusik/blue/commit/c7b0d28060c91d8eb446c781a26ad0968de27b0c), 2026-02-24 | Scalar beat times and supported intermediate `startTimeUnit`, `durationUnit`, `subjectiveDurationUnit`, `startTimePosition`, `subjectiveDurationTD` forms normalize to typed current common time fields. The first writer emitted a direct typed durationUnit; its reader-only nested wrapper is not writer evidence. | Shared SoundObject common/time normalization. The [time supplement](contracts/xml-loading.md#development-era-common-soundobject-time-forms) fixes the exact supported fields and known unsupported development forms. No stable-release provenance claim or four-beat fallback. Contradictory aliases error; equal canonical aliases coalesce. Current time roots only. |
| SL-H06 | [PianoRoll ruler change](https://github.com/kunstmusik/blue/commit/f26e9726c5b875ac4750507fed0e36a1946e3f17), 2026-03-02; [initial writer](https://github.com/kunstmusik/blue/blob/d1735b6fe22b6e0dee07d665108a50b6151e2cf9/blue-core/src/blue/soundObject/PianoRoll.java) | Numeric snapValue → nearest supported snap; old snap enum QUARTER → SIXTEENTH; timeDisplay0→TIME/1→BEATS; missing new ruler fields use documented defaults. Old writer emitted timeUnit default4, controlling ruler tick/label interval. | PianoRoll local. Conflicting old/current snap or primary-ruler values error. Preserve timeUnit as named typed historical editor interval below; current snapValueEnum/ruler output plus retained historical interval where present. |
| SL-H07 | [JMask seed introduction](https://github.com/kunstmusik/blue/commit/dd17bbfc821bb55c0a8eeebe56b7e356caaedbd5), 2015-04-13 | Absent seedUsed/seed means seed disabled; supplied Java long seed retained exactly. | JMask local. Current boolean+seed output; invalid/rounded seed errors. |
| SL-H08 | [Initial TrackerNote reader/writer](https://github.com/kunstmusik/blue/blob/d1735b6fe22b6e0dee07d665108a50b6151e2cf9/blue-core/src/blue/soundObject/tracker/TrackerNote.java) | Reader-only older pitch/amp/otherField supported by deliberate bounded decision; transform to ordered field cells. | TrackerNote local, enclosing columns verify result; writer field @val. Earlier emitter predates accessible local history, no invented revision. |
| SL-H09 | TypeScript current loader-only aliases: GenericScore scoreText, TrackerObject tracks, Add/Multiply pFieldIndex, NoteProcessorChainMap direct named noteProcessorChain, Line varName/text points, PolyObject attribute timing | Explicit TypeScript compatibility decision: preserve each precisely defined existing reader form where values map without ambiguity; do not call them verified Java writer forms. | Owning class/shared normalization. Equal old/current values only, no overwrite by order; canonical writer form. Invalid alias grammar errors. Synthetic fixture origin records this support decision. |
| SL-H10 | TypeScript current PianoRoll writer inspected 2026-10-02 | Exact empty scale followed by populated scale is an emitted TypeScript defect, safely normalize by discarding only the empty structural placeholder. | PianoRoll local warning with recovery “empty serializer placeholder removed”; preserve complete populated scale and output it once. Any other duplicate scale error. |
| SL-H11 | TypeScript AudioClip current compatibility and `score/audio/fade-type.ts` | Legacy scalar start/duration aliases → typed times; recognized historical Symmetric fade → S-Curve intentional TS replacement. | AudioClip local; conflicts error; existing feature parity evidence referenced by implementation task. Unknown fade names error. |
| SL-H12 | [Initial TrackerObject writer](https://github.com/kunstmusik/blue/blob/d1735b6fe22b6e0dee07d665108a50b6151e2cf9/blue-core/src/blue/soundObject/TrackerObject.java); [separate duration removal](https://github.com/kunstmusik/blue/commit/35adb7bb904d5c1794c5ba93d44451b4d707add3) | Retired `duration` represented a distinct objective-duration value. Corpus copies pair value `4.0` with current subjective durations `2.0`, `16.0`, and `4.0`. | TrackerObject owns typed optional historical objective duration, copies and writes it, and warns that current generation uses subjective duration. Unequal values are preserved, not treated as alias conflicts. |
| SL-H13 | [Java tracker Column writer and reader](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/soundObject/tracker/Column.java), Java tree revision `3ca3f40579c48a023299a68130d8ab6b9e950974` | Java writes Column records as `<track>` children under `<columns>`; loader reads the record members independent of the root name. | Track's columns container accepts only the existing TypeScript `<column>` and Java `<track>` record roots. Column member validation remains unchanged; TypeScript canonical output uses `<column>`. |

For SL-H02, the historical Java constructor writes `syntaxType=Python`; the pre-transition editor
callbacks using it were commented out, while `isExternal` determined execution mode. The corpus
contains five exact Python hints, including two alongside `isExternal=true`. Accept that exact
default as redundant dormant editor metadata for either normalized `PYTHON` or `EXTERNAL` mode,
warn, and omit it while preserving the language mode and code. Any other syntax string, duplicate
field, or conflicting `languageType`/`isExternal` representations reject. The source permits
arbitrary syntax strings; do not infer a historical vocabulary from those setters.

For SL-H06, inspection of
[historical TimeBar](https://github.com/kunstmusik/blue/blob/aa15d3c8fd8cf68dfc57a3db672af9bc35413f64/blue-ui-core/src/main/java/blue/soundObject/editor/pianoRoll/TimeBar.java)
confirms timeUnit controlled the major-tick/label interval independently of snap. Its omission is
not justified by matching a snap default. Adopt a named typed `PianoRollHistoricalRulerInterval`
compatibility field: finite positive integral beat interval, owning PianoRoll, preserved independently
through copy/history, serialized as the recognized `timeUnit` field when present. It is a documented
output exception for historical editor metadata; it cannot accept extra attributes/children or
arbitrary XML. Current editor support may be unavailable and must be diagnosed separately while
data remains savable. Reject malformed or contradictory interval input; do not discard even the
default4. A future editor mapping may replace this field only with equivalent behavior and coverage.

Each historical row requires an original synthetic acceptance fixture, an invalid/conflict
fixture, a canonical reapplication fixture, and the applicable standalone/embedded comparison.
No fixture bytes in this research are copied from the GPL Java tree. Development transition
forms require shape-specific fixtures; absence of proof of release shipment is explicitly retained
in provenance and does not block an intentional bounded compatibility choice.

### Example-corpus follow-up (T056)

The 134 read-only project cases contain 1,506 `isRoot` values: 140 true and 1,366 false. The
historical Java writer emitted a boolean child; before its removal in commit
[cbc9487](https://github.com/kunstmusik/blue/commit/cbc9487e33e87337f507959ae52dd54a445fa86b),
`isRoot=true` forced effective time behavior to `NONE` during note generation. That commit also
removed the old root-only render-range adjustment. The current typed `timeBehavior` field therefore
represents the retained generation rule; normalize true to `NONE`, preserve false/current behavior,
and reject malformed booleans. This is a class-local SoundObject rule reached by project,
standalone, and library resource loaders, not a project migration.

## User-library envelopes and archive boundary

Production owners: `libraries/library-types.ts`, `legacy-library-codec.ts`,
`library-payload-adapters.ts`, `raw-xml-document.ts`, `library-transfer.ts`, and the separate
`code-repository-codec.ts`. Host lifecycle: main `unified-library/import-export-service.ts`,
`repository.ts`, `editor-adapters.ts`, `editor-session-service.ts`, `project-adapter.ts`.

| Envelope | Category grammar | Leaf grammar / canonical organization |
| --- | --- | --- |
| `instrumentLibrary` | Exactly one root `instrumentCategory`, recursively categoryName/isRoot attrs only | `instrument` leaves; category-first ordering, then instruments. |
| `udoLibrary` | Exactly one root `udoCategory`, same category attrs | `udo` leaves; category-first ordering. |
| `effectsLibrary` | Exactly one root `effectCategory`, same category attrs | `effect` leaves; category-first ordering. |
| User `soundObjectLibrary` | Exactly one root `category @categoryName`; recursive categories | `soundObject` leaves in mixed source order. Context distinguishes it from project SoundObjectLibrary. |
| Code Repository `customAccelerators` | `customGroup @name` recursively, groups/snippets in order; root has no attrs | `customAccelerator` with exactly name/signature scalar children and no attrs; typed code text preserves whitespace. Existing depth/tree invariants apply. |

Java category references:
[InstrumentCategory](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/orchestra/InstrumentCategory.java),
[UDOCategory](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/udo/UDOCategory.java),
[EffectCategory](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-ui-core/src/main/java/blue/ui/core/mixer/EffectCategory.java),
[generic user library](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/library/Library.java).
The generic SoundObject library was introduced by
[333ddb49a855aa73f1aefd1c00d8b4fe4476141e](https://github.com/kunstmusik/blue/commit/333ddb49a855aa73f1aefd1c00d8b4fe4476141e),
2017-04-04. Generic Java library reader accepts several folder spellings; the writer emits category.
Support cross-family folder spellings only under an explicit envelope alias decision, never by
assuming every recognized category name is legal in every envelope. This plan defaults to the
actual family spelling; unexpected wrapper content rejects the source.

Root wrapper attrs are empty. There is exactly one root category. Category names are required
scalar strings, including names valid under the existing library naming policy. Old omitted
isRoot is inferred from structural position; present isRoot must agree with the position. Unknown
category branches/attrs, extra root categories, wrong-kind leaves, or meaningful container text
are errors before publication. Comments/declarations/indentation are lexical; significant leaf
payload text belongs to its resource contract or intact archive. Library export need not preserve
wrapper indentation, but exact leaf XML preservation is already contractual.

### Supported classification and raw archive

`library-payload-adapters.ts` currently recognizes known type names and scans only `plugin`,
`futureField`, `unknownWidget`, `unknownSoundObject`. Thus it can classify many malformed or
unexpected subtrees as supported. Replace this sentinel scan with the same whole resource
acceptance used for standalone/project loading. Safely reading an embedded display name or
duration for preview does not imply support. Preview fields can remain unavailable when unsafe.

Named archive contract:

1. A structurally valid recognized envelope supplies a leaf of its expected kind.
2. The full leaf fails editable resource acceptance with contextual diagnostics.
3. Store the original leaf source span and unsupported status/reason; emit a warning explaining
   archive retention and disabled typed editing/insertion. Source bytes/text are unchanged.
4. Export the stored raw leaf intact. Raw XML editor changes operate on the archive record and
   preserve that distinction; typed promotion occurs only when whole acceptance succeeds.
5. Do not execute code, resolve host files with side effects, or hydrate editable models during
   classification. Revalidate before project insertion even if cached support status is supported.

Existing `raw-xml-document.ts` already retains source spans and concatenates text+CDATA; reuse
that fidelity substrate for archives. Its converted element does not retain text/child interleaving
as a structured field, so shape validation requiring that distinction must examine the parser's
node stream or raw source before collapsing evidence. Do not funnel archive bytes through
Element's serialize/reparse clone. The canonical-content hash currently normalizes inter-element
whitespace with a regex; it must not imply semantic equivalence or supported promotion for
significant mixed/scalar text. Exact duplicate detection and semantic duplicate comparison remain
distinct operations.

The separate Code Repository codec already rejects unknown attrs/elements, unexpected container
text, duplicate scalar children, and nested elements in scalar text; it returns a complete tree or
throws. Reuse the validation approach and adapt diagnostic context without replacing it with a
general-purpose schema engine. Confirm CDATA contributes to signature text: its current readText
handles TYPE_TEXT only, so a distinct CDATA parser node must not silently become empty code.

### Import/publication transaction boundaries

Manual library import checks every preview source hash and selected folder resolution before
starting a batch. It then imports each source separately through repository `importLegacyDocument`,
which runs in `withTransaction` (`BEGIN IMMEDIATE`, commit or rollback). A failed source is recorded
and other sources may succeed; the batch result is completed/partial/failed with source counts.
Automatic migration likewise reports failures and proceeds per source. Preserve this deliberate
source-level transaction boundary. Do not claim all selected files roll back together.

A source with an invalid envelope creates no source folders/items. A valid envelope containing
archivable unsupported leaves may succeed with diagnosed archive counts; none of those leaves
becomes a project object. Resource insertion into active BlueData requires an accepted complete
candidate, then one existing semantic ProjectHistory commit. Rejected candidate insertion creates
no history entry or runtime reconciliation. Library-only archive editing/migration retains existing
library revision/undo semantics and does not enter project history.

Exports already stage outputs and recover through the existing atomic export journal. Serialization
validation must finish before replacing source/destination files. Do not widen host-path changes;
Windows paths remain native except at the explicit Csound text boundary.

## Required implementation evidence and remaining bounds

The assigned families have an owner row and an acceptance disposition. Member/value fixtures
are to be authored during implementation from this matrix, not imported from the Java checkout.
The matrix records bounded decisions for evidence-poor reader aliases and developer writer forms;
it makes no universal “all Blue versions” guarantee.

Verify these concentrated defects/risks through the actual public boundary:

- All 19 SoundObject type names and all 17 processors require full member validation, plus the
  complete nested JMask, PianoRoll, tracker, layer, audio, and library grammars listed above.
- Unknown SoundObject/processor/layer members currently retained in generic raw bags must reject
  projects; known unavailable Python/Clojure data remains typed supported content.
- Accepted exports must not mutate PatternData; PianoRoll output must contain one populated scale.
- Copy/history must retain JMask generator prototypes and all dormant table parameters, and relink
  copied PianoRoll field identities. Independent output/input ownership must hold for any named
  retained payload in other model families.
- Deferred Instance resolution must not publish incomplete project references. An independent
  library dependency is distinct from a malformed reference and must retain visible dependency status.
- Exact Java long seeds use authoritative signed64 canonical decimal strings at existing
  serializable snapshot/IPC boundaries and BigInt before JavaRandom state initialization.
  Safe numeric setter arguments normalize to strings; rounded or out-of-range input is rejected.
- Time aliases in SL-H05 delegate primitive unit/type domains and preserved base names to the
  common time acceptance matrix. Project version is unnecessary for these class conversions.
- The narrow ObjectBuilder obsolete-editor warning rule cannot be broadened before confirming
  historical behavior and declaring safe canonical output. PianoRoll's historical ruler interval
  and unresolved tuning filename are named typed metadata/dependency contracts, not unknown bags.
- For existing TS aliases that lack writer evidence, support is an explicit compatibility decision
  constrained to the table's grammar; incidental suffix matching or numeric prefixes remain errors.

## Licensing and provenance

This file is original research prose in the repository documentation's GPL-3.0-or-later scope.
Read `LICENSING.md`, `packages/blue-data/LICENSE`, package metadata, and third-party notices before
implementation. Java reference source inspected here is GPL-2.0-or-later; `@blue/data` Blue-authored
production code is MIT. No Java source/translated implementations/fixtures are incorporated here.
Implement the documented behavior originally in the destination scope, preserve existing notices,
and record each synthetic fixture's authorship and source-behavior reference. No new dependency,
bundled table, external example, or asset is proposed by this research.


### Existing TypeScript output corrections (2026-10-02)

SoundObject backgroundColor accepts the exact signed-32 Java domain and the exact unsigned-32
ARGB bit patterns emitted by existing TypeScript setters/writers (SL-H09). It normalizes the latter
to the equivalent signed bit pattern and writes signed decimal; values outside both domains reject.
AudioClip accepts the existing TypeScript FadeType enum spellings as explicit SL-H11 aliases,
alongside the documented display names. PianoRoll removes only the exact empty-first/populated-second
Scale writer defect with SL-H10; current writers emit one populated Scale. Frozen/history fixtures
now use supported typed Clojure entries rather than arbitrary plugin XML.
