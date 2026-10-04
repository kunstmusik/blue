# Project, Score, Time, Live, MIDI, and Plugin Evidence

**Date**: 2026-10-01  
**Status**: Planning decisions from read-only source/history inspection; no implementation or
test execution. This is one portion of the feature evidence matrix.

## Evidence and provenance

Java source was inspected locally at revision
`3ca3f40579c48a023299a68130d8ab6b9e950974` (2026-06-28). Links below pin the corresponding
upstream source. Historical patches and local release tags were inspected without fetching.
The tag `2.10.0` resolves to `189f3c912d63e7e21e2f55a749752e7011935e68` (2026-04-28),
and `BLUE_RELEASE_2.3.0` resolves to `092ba88114ad0431273ebfc892ca38c5b433aba0`.
Release tags corroborate inclusion in tagged source, not binary execution or a complete corpus
of every historical user file. No universal minimum project version is promised.

| ID | Evidence | Provenance and established behavior |
| --- | --- | --- |
| J-PROJECT | [BlueData](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/BlueData.java), [Score](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/score/Score.java) | Current snapshot writers/owners and registered loads; unknown root tolerance is not support evidence. |
| J-UPGRADE | [XML-only upgrades, 2012-10-13](https://github.com/kunstmusik/blue/commit/9f97c9d187ace846a422515dfdea2ed8b1b103b8), [2.3.0 release upgrader](https://github.com/kunstmusik/blue/blob/092ba88114ad0431273ebfc892ca38c5b433aba0/blue-core/src/blue/upgrades/ProjectUpgrader_2_3_0.java) | Tagged release source extracts root PolyObject timing into Score TimeState; relocates root PolyObject/tempo; runs beta pattern nesting independently. The historical XML-only decision removed interpretation-dependent post-load migrations. |
| J-CONTEXT | [TimeContext move, 2025-12-03](https://github.com/kunstmusik/blue/commit/98103a219a54974dfe1a2bd780e89b34b2239668) | Ancestor of tagged 2.10.0; root TimeContext moved under Score, legacy tempo Line converted to linear TempoPoints, older BeatTempoPair writer used child `beat`/`tempo`, not attributes. |
| J-RATE | [Centralized sample rate, 2026-02-17](https://github.com/kunstmusik/blue/commit/dfa46c622a7fbc9e0bdcfe2366c119605b3568a3), [PPQ removal, 2026-02-11](https://github.com/kunstmusik/blue/commit/c46ea5fbee04a55157febbe696c38d1409848c52) | Ancestors of tagged 2.10.0; older TimeContext writer emitted `sampleRate` and `ppq`; later sample rate is derived from ProjectProperties, SMPTE rate synchronizes from TimeState. |
| J-SNAP | [Snap migration, 2026-02-08](https://github.com/kunstmusik/blue/commit/7c9268215c09c7f16ae5e6b88a79707f2edc0710), [current TimeState](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/score/TimeState.java) | Ancestor of tagged 2.10.0; historical writer used a numeric snap value; local loader maps it to nearest musical/triplet choice and maps `QUARTER` to `SIXTEENTH`. Integer display 0/1 maps to TIME/BEATS. |
| J-STATE | [Row controls, 2026-02-15](https://github.com/kunstmusik/blue/commit/4b726c241eaf8f40c55a449353e81239bd4c2318), [version consolidation](https://github.com/kunstmusik/blue/commit/58efc8cca281ed60f8a2c8fdea830f1110f29030) | Development writer briefly emitted version 4 using the current `*RowVisible` names, then consolidated to version 2 before tagged 2.10.0. A comment mentioning version 3 or older row names does not prove those names were written. |
| J-POSITION | [TimeBase/discriminant change, 2026-02-23](https://github.com/kunstmusik/blue/commit/0e3234428200885019ce9c089032d2a8c7e799e4), [current TimePosition](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/time/TimePosition.java) | Ancestor of tagged 2.10.0; old writer emitted inner class names; current writer emits TimeBase enum names. Frame XML field is `frameNumber`; seconds use `totalSeconds`. |
| J-MARKER | [Marker migration, 2026-02-24](https://github.com/kunstmusik/blue/commit/c7b0d28060c91d8eb446c781a26ad0968de27b0c), [current Marker](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/Marker.java) | Ancestor of tagged 2.10.0; historical `time` attribute became typed `time` child. Current reader also accepts child named `timePosition`. |
| J-PROPS | [ProjectProperties](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/ProjectProperties.java), [media option introduction](https://github.com/kunstmusik/blue/commit/296408537f426882ac0a775e6bbf1d134d3af293) | Current scalar contract; 2020 patch reader used `copyToMediaFolderOnImport`, while its writer emitted `copyToMediaFileOnImport`. Preserve the emitted form plus explicitly supported reader alias; alias evidence is not falsely called writer evidence. |
| J-LIVE | [LiveData](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/LiveData.java), [2010 writer](https://github.com/kunstmusik/blue/blob/d1735b6fe22b6e0dee07d665108a50b6151e2cf9/blue-core/src/blue/LiveData.java) | Older writer emitted direct `liveObject` children; current loader also supports older direct SoundObjects and converts the sequence into a single grid column. Missing both command flags enables legacy command override. |
| J-MIDI | [MidiInputProcessor](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/midi/MidiInputProcessor.java) | Writes enum names, strings, and Scale. Silent invalid-enum fallbacks are rejected by the new contract. |
| J-CLOJURE | [Project plugin introduction](https://github.com/kunstmusik/blue/commit/206de0828977ae0484ccdebe74736f9b339bcfd4), [ClojureProjectData](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-clojure/src/main/java/blue/clojure/project/ClojureProjectData.java) | Known `blueDataObject` subtype and repeated dependency entries; runtime availability is separate from serialized support. Arbitrary child names tolerated by the Java class are not additional accepted entries. |

The TypeScript source links below describe the observed implementation and the destination owners,
not a declaration that those loaders already enforce this matrix. Defaults not backed by a Java
writer are explicit existing TypeScript compatibility decisions.

## Common acceptance rules for these families

- Names are case-sensitive. Each listed scalar/container is a singleton unless marked repeated.
  Unknown attributes/children, duplicate singletons, unknown discriminants, non-whitespace mixed
  content, and conflicting current/historical forms are errors. Empty optional containers are
  allowed; comments, declarations, and indentation outside accepted scalar text are lexical.
- Accepted scalar string/code fields preserve their exact semantic text, including leading,
  trailing, and inter-segment whitespace. CDATA and normal text segments concatenate in order.
  Scalars have no child elements or attributes unless a row explicitly defines them.
- Boolean values accept `true`/`false` after trimming and case normalization, preserving existing
  Java/TypeScript boolean spellings. Invalid tokens error instead of becoming false. Numbers
  consume the entire token and are finite; integer fields are safe integers. No partial `12junk`,
  NaN, or Infinity acceptance. Missing fields use listed defaults; explicit malformed fields do
  not use missing-field defaults.
- Equal current/historical aliases normalize once and emit one current form. Unequal aliases
  error, except the named historically derived sample-rate warning below. A project version is
  a migration selection input, never a blanket acceptance key for otherwise unexpected members.
  Versionless projects select historical project upgrades; unfamiliar well-formed versions can
  be accepted only if their actual members satisfy the supported contract. Invalid version
  syntax errors. Numeric project versions and historical `_beta...` suffixes use the existing
  documented ProjectVersion domain; arbitrary underscore suffixes are not automatically beta.
- Every nested owner still validates its own subtree. A recognized project/Score/plugin does not
  approve nested arbitrary XML. Rejection has source/path/member diagnostics and leaves active
  state untouched; migration modifies an independent candidate only.

## Root and project section matrix

| Owner / source | Current expected content and defaults | Historical acceptance / canonical output | Decision and ownership |
| --- | --- | --- | --- |
| `blueData`, [xml-policy.ts](../../packages/blue-data/src/blue-data/xml-policy.ts) | Only root attribute `version`; singleton `projectProperties`, `arrangement`, `mixer`, `tables`, `soundObjectLibrary`, `globalOrcSco`, `opcodeList`, `liveData`, `score`, `scratchPadData`, `noteProcessorChainMap`, `renderStartTime`, `renderEndTime`, `markersList`, `loopRendering`, `midiInputProcessor`, `pluginData`. Missing optional sections use BlueData constructor defaults; missing mixer remains disabled with documented legacy meter defaults; render start 0/end -1; loop false. | Legacy singleton `instrumentLibrary` wires the arrangement references before canonical writing; legacy root `udo` text becomes `opcodeList`; root `soundObject`, `tempo`, `timeContext` undergo structural relocation. Emit only current sections in established writer ordering and current project version. | Typed section owners. Root relocations and wiring require project context. Never ignore an unknown root section. Legacy/current UDO containers with unequal content error. Instrument library reference resolution remains shared with arrangement; dangling required references error. |
| `projectProperties`, [project-properties.ts](../../packages/blue-data/src/project-properties.ts) | String children: `title`, `author`, `notes`, `sampleRate`, `ksmps`, `channels`, `zeroDbFS`, `diskSampleRate`, `diskKsmps`, `diskChannels`, `diskZeroDbFS`, `advancedSettings`, `fileName`, `diskAdvancedSettings`, `mediaFolder`. Boolean children: `useZeroDbFS`, `diskUseZeroDbFS`, `useAudioOut`, `useAudioIn`, `useMidiIn`, `useMidiOut`, `noteAmpsEnabled`, `outOfRangeEnabled`, `warningsEnabled`, `benchmarkEnabled`, `completeOverride`, `askOnRender`, `diskNoteAmpsEnabled`, `diskOutOfRangeEnabled`, `diskWarningsEnabled`, `diskBenchmarkEnabled`, `diskCompleteOverride`, `diskAlwaysRenderEntireProject`, `copyToMediaFileOnImport`. No attributes. | `copyToMediaFolderOnImport` accepted as explicit local alias. Existing TS string compatibility fields `commandLine`, `diskCommandLine`, `oFormat`, `audioOutput` remain modeled and serialize when nonempty. No `nchnls` XML alias is inferred from its TS accessor. Canonical output uses `channels` and `copyToMediaFileOnImport`. | Class-local normalization. String numeric Csound header fields retain their string domain, including expressions; do not impose numeric-only XML parsing. Runtime sample-rate derivation remains separately diagnosed if unusable. Defaults: strings empty except realtime/disk rate 44100, realtime ksmps64/disk1, channels2, zeroDbFS1; audioOut and message booleans true, copyMedia true, all other booleans false. |
| `globalOrcSco`, [global-orc-sco.ts](../../packages/blue-data/src/global-orc-sco.ts) | No attributes; `globalOrc`, `globalSco` singleton significant code strings, missing empty. | Pre-2.1.10 `0dbfs = value` relocation into both realtime and disk project properties. Preserve all unaffected code text. | Class owns ordinary fields; project upgrader owns cross-section relocation. Multiple unequal assignments or unequal existing destinations error; equal values coalesce. The migrator must not append duplicate properties. |
| `tables`, [tables.ts](../../packages/blue-data/src/tables.ts) | No attributes/child elements; significant scalar code text, missing/empty text allowed. | No additional historical XML form approved. | Typed string; compilation-variable map and ftable number cache are derived runtime state, excluded from XML. |
| `scratchPadData`, [scratch-pad-data.ts](../../packages/blue-data/src/scratch-pad-data.ts) | No attrs; `scratchText` significant string default empty; `isWordWrapEnabled` boolean default true. | Current output names retained. | Typed class. Extra wrapper/scalar attrs or children error. |
| Render fields | Finite numeric `renderStartTime`, `renderEndTime`; end -1 sentinel or nonnegative end, start nonnegative; loop boolean. | Current forms retained. | Root typed fields; invalid explicit values error. Range relationship must satisfy existing rendering range rules, not silently clamp on acceptance. |
| `pluginData` / [clojure-project-data.ts](../../packages/blue-data/src/plugins/clojure-project-data.ts) | No attrs; supported entry root `blueDataObject` with exactly `bdoType=blue.clojure.project.ClojureProjectData`, at most one such subtype per project. Entry contains repeated `clojureLibraryEntry`; each has singleton significant string `coordinates`, `version`; no other attrs/children. Missing dependency fields retain existing class defaults `org/library-name`, `1.0.0`. Empty configured strings are retained; the runtime filters unusable entries separately. | Emit known subtype and accepted entries canonically regardless of Clojure runtime availability. | Typed supported metadata, not generic retained plugin XML. Unknown subtype/member errors in projects. If an existing API retains a validated Clojure Element temporarily, it is the named Clojure contract with independent clones; no arbitrary extension bag. |

Root arrangement, mixer, libraries, opcodes, and processors delegate to their separately inventoried
families; their listed root names do not waive nested acceptance.

## Score and time matrix

| Owner / source | Current expected shape and values | Historical forms/defaults and output | Decision / scope |
| --- | --- | --- | --- |
| `score`, [score.ts](../../packages/blue-data/src/score/score.ts) | Singleton `timeContext`, `timeState`, `noteProcessorChain`; repeated supported `soundObject` PolyObject layer groups, `trackLayerGroup`, `patternsLayerGroup`. TS attribute `trackLayerMuteSoloMode` values `event`/`audio`, missing `event`. | Legacy `polyObject` wrapper explicitly supported as existing TS alias, validated as PolyObject. `audioLayerGroup` structural migration to tracks; legacy singleton `tempo` converted into TimeContext. Legacy score panning attrs `panningEnabled`, `panLawDb`, `panOffCenterBoost` move to Mixer. | Score owns groups/timing; root migrator owns cross-owner attributes/relocations. Known PolyObject type mandatory; presence of `soundLayer` alone cannot authorize an unknown `type`. `scoreObjectLayerGroup` is not implemented; reject rather than silently skip. Empty group sequence remains accepted TS behavior; no invented group inserted. |
| `timeState`, [time-state.ts](../../packages/blue-data/src/time/time-state.ts) | Attribute `version`; singleton `zoomIterations` safe integer, `snapEnabled`, `snapValue`, `timeDisplay`, `secondaryTimeDisplay`, `secondaryRulerEnabled`, `tempoRowVisible`, `meterRowVisible`, `markersRowVisible`, `smpteFrameRate`; TS `smpteDropFrame` boolean supported by Spec115. | Missing/version1 legacy defaults: zoom0, snap false/BEAT, display BEATS/secondary TIME, secondary disabled, row visibility true, fps24, drop false. Positive integer `pixelSecond` converts to zoom by Java truncation toward zero of logarithmic result; accept equal alias only. Numeric finite positive snap maps to nearest musical/triplet enum; `QUARTER` ->`SIXTEENTH`. Display 0/1 and documented developmental `CSOUND_BEATS` ->TIME/BEATS. Version4 current member shape explicitly supported based on J-STATE development writer; version3 accepted only same supported members as explicit compatibility, no invented aliases. | Local class owns conversions. Canonical writer version2; known TimeBase names `BEATS,BBT,BBST,BBF,TIME,SMPTE,SECONDS,FRAME`; SnapValue names from [snap-value.ts](../../packages/blue-data/src/time/snap-value.ts). Invalid enum/numeric/current rate errors rather than silent default. Legacy version1 with explicit secondary enabled true is rejected as conflicting historical semantics rather than silently disabling meaningful state. Generic `unknownAttributes`/`unknownChildren` classified unexpected, except no unnamed retention exception. |
| SMPTE state | Rates and drop eligibility exactly Spec115/[smpte-timecode.ts](../../packages/blue-data/src/time/smpte-timecode.ts) supported tuples. | Existing TS `29.97df`/`30df` tokens normalize using Spec115's accepted semantics; malformed rates and incompatible explicit drop flag error. Emit canonical numeric rate and drop flag only when true. | Do not infer broad Java numeric acceptance as support for arbitrary FPS. TimeState authoritative for score display rate; context derived synchronization cannot erase an explicitly conflicting persisted rate silently. |
| `timeContext`, [time-context.ts](../../packages/blue-data/src/time/time-context.ts) | No attrs; singleton `tempoMap`, `meterMap`, `smpteFrameRate`, maps default as below. | Historical `sampleRate`, `ppq`; existing TS scalar `tempo` and nested `meterMap/tempoMap` accepted only through explicit local normalizations. Writer emits direct maps and SMPTE numeric rate; no sampleRate/ppq/simple tempo. | Direct and nested tempo maps equal ->one; unequal error. Scalar tempo only accepted alone, never overrides an explicitly supplied map by comparing its first BPM to60. Root TimeContext relocation is project-owned, class subtree conversion local. |
| Historical TimeContext sample rate | Positive integer `sampleRate` accepted historical field. | If equal to authoritative numeric ProjectProperties sampleRate, safe redundant-field warning and omit. If ProjectProperties lacks its explicit field, project migration transfers legacy rate into it; if unequal explicit values, error. | Project context owns reconcile; direct TimeContext load cannot silently discard the persisted rate: retains a named legacy rate in its result until enclosing project reconcile, or errors if no safe enclosing reconciliation exists. Java silently ignoring all old rates is an intentional tightened divergence. |
| Historical PPQ | Missing or `ppq=960` accepted; positive integer domain inspected. |960 is safely redundant fixed resolution and warned/omitted. Non960 rejected with explanation that custom historical PPQ is not currently supported; no silent tick reinterpretation. | Explicit bounded support decision. Support expansion requires full project-wide tick conversion including every TimePosition/Duration owner; it is not safe class-local ignoring. |
| `tempoMap`, [tempo-map.ts](../../packages/blue-data/src/time/tempo-map.ts) | No attrs; singleton `enabled`,`visible`; repeated `tempoPoint`. Missing flags false, empty map defaults point0/60/CONSTANT. | Legacy repeated `beatTempoPair` with child `beat`,`tempo` (J-CONTEXT), finite nonnegative beat and positive tempo; ->BEATS TempoPoint with LINEAR curve. Existing TS attribute `beat`/`tempo` legacy encoding accepted explicitly; reject simultaneous unequal attribute/child fields. Legacy-only map without flags follows its historical enabled meaning, rather than silently disabling meaningful tempo data. | Local map conversion; if current and legacy point sequences coexist, reject as ambiguous rather than overwrite one based on values. Preserve source point order and reject duplicate positions or nonascending resolved beat positions; sorting cannot hide conflicts. |
| `tempoPoint`, [tempo-point.ts](../../packages/blue-data/src/time/tempo-point.ts) | Attrs `tempo` finite positive, `curve` CONSTANT/LINEAR; required `timePosition` child. | Legacy `beat` attribute without child ->BEATS; missing curve defaults LINEAR as documented loader behavior; explicit invalid curve errors. Existing missing tempo default60 retained only for historical attribute shape. | Local conversion; typed position and beat alias equal coalesce, unequal error. No arbitrary point children or attrs. |
| `meterMap`, [meter-map.ts](../../packages/blue-data/src/time/meter-map.ts) | No attrs; repeated `measureMeterPair`; empty defaults measure1/4:4. | No arbitrary nested map; historical nested tempoMap is extracted by TimeContext normalization before meter validation. | Typed ordered map; positive ascending distinct measures. First entry measure1 required for nonempty map. |
| `measureMeterPair`, [measure-meter-pair.ts](../../packages/blue-data/src/time/measure-meter-pair.ts) | No attrs; singleton `measureNumber` positive safe integer, `meter`. | Existing TS alias `measure` explicitly accepted; missing number1/meter4:4 maintained existing compatibility; output `measureNumber`. | Local; conflicting aliases error. |
| `meter`, [meter.ts](../../packages/blue-data/src/time/meter.ts) | No attrs; singleton `numBeats`, `beatLength`; positive safe integers; missing each4. | Current forms; no unverified numerical cap/power-of-two rule imposed on beatLength. | Typed class; zero/negative/malformed errors instead of default4. |
| `timePosition`, [time-position.ts](../../packages/blue-data/src/time/time-position.ts) | Attribute `type`; BEATS:`csoundBeats`; BBT:`bar,beat,ticks`; BBST:`bar,beat,sixteenth,ticks`; BBF:`bar,beat,fraction`; TIME:`hours,minutes,seconds,milliseconds`; SECONDS:`totalSeconds`; FRAME:`frameNumber`. Scalars mandatory for typed canonical shape. | J-POSITION inner class aliases `BeatTime,BBTTime,BBSTTime,BBFTime,TimeValue,SecondsValue,FrameValue` and `CSOUND_BEATS` normalize to current type names. TS `frameCount` ->`frameNumber`; TS untyped numeric text accepted only when an explicit legacy enclosing owner declares it (markers/old positions), not default for arbitrary unknown type. | Shared class normalization reached from markers/maps/objects; unknown type errors, not numeric fallback. Position domains: finite beats/seconds, integer frame, positive bar/beat/sixteenth, nonnegative ticks/fraction/time components; enforce existing constructor/unit bounds and contextual meter rules. Missing malformed typed components error rather than zero. Preserve supported negative standalone beat/seconds positions where current model permits; contextual score uses validate its own timing limits. |

The TimePosition canonical `frameNumber` correction deliberately repairs Java-incompatible
TypeScript output (`frameCount` today) while retaining read compatibility for already written TS
files. Exact-output assertions for supported canonical output must identify this explicit change.
TimeDuration is another shared time primitive reached through SoundObjects/audio repeat timing;
its subtype field inventory belongs to the object-family matrix rather than this project subset.

## Marker, Live, MIDI matrix

| Owner / source | Accepted fields and values | Historical normalization / defaults | Raw-data disposition |
| --- | --- | --- | --- |
| `markersList` / [markers-list.ts](../../packages/blue-data/src/markers-list.ts) | No attrs; repeated `marker` only. Marker attr `name` string; one typed `time` child delegated to TimePosition. Empty list accepted. | J-MARKER legacy `time` numeric attr ->BEATS; reader alias child `timePosition`; existing TS direct numeric marker text and untyped numeric `time` child explicitly accepted, finite values; output typed `time` plus name. Missing name empty; missing time0 only historical untyped shape. Equal aliases normalize; conflicting/time type unknown error. | Replace `_rawChildren` permissive store with authoritative typed markers, preserving order. Unknown marker fields are unexpected, not retained extensions. Input/output/getters must not expose mutable owned Elements. |
| `liveData` / [live-data.ts](../../packages/blue-data/src/live-data.ts) | No attrs; singleton `commandLine`, `commandLineEnabled`, `commandLineOverride`, `liveObjectBins`, `liveObjectSetList`, `repeat`, `tempo`, `repeatEnabled`, `liveCodeText`. Significant strings; positive integer tempo; positive integer repeat, booleans. | Repeated direct `liveObject` or `soundObject` historical ->single column bins; preserve sequence/identities. Missing both command flags ->both true; when either is present, missing other uses false. Defaults command `csound -Wdo devaudio -L stdin`, tempo60/repeat4, repeatEnabledfalse, codeempty, 1x8 empty bins/empty sets. | Class-local reusable subtree migration. Simultaneous historical direct objects and populated bins error rather than replacing bins. No execution occurs during acceptance. |
| [live-object-bins.ts](../../packages/blue-data/src/live/live-object-bins.ts) | Attrs `columns`,`rows` positive safe integers; exactly columns repeated `bin` elements; each exactly rows ordered `null`/`liveObject` slots; null has no attrs/text/children. | No truncation/padding of explicit malformed dimensioned grids; historical direct list converted before this owner. | Typed grid; unknown bin slot cannot silently become null; overflow errors. |
| [live-object.ts](../../packages/blue-data/src/live/live-object.ts) | Attr `uniqueId` nonempty string; `keyTrigger`,`midiTrigger` integer compatible with documented unset sentinel -1; keyTrigger supported key-code domain, MIDI0..127 or -1; `enabled` boolean; optional singleton supported `soundObject`. | Missing historical ID creates a unique candidate ID; key/midi -1, enabledfalse; absent object remains empty. Preserve authored ID; duplicate live IDs error before set reference resolution. | Typed model/nested resource; unknown child/type errors even for disabled slots. |
| [live-object-set-list.ts](../../packages/blue-data/src/live/live-object-set-list.ts), [live-object-set.ts](../../packages/blue-data/src/live/live-object-set.ts) | List no attrs; repeated `liveObjectSet`; each attr `name`, repeated scalar nonempty `liveObjectRef` IDs. | Retain ordered IDs including unresolved IDs as established TS compatibility from live set preservation; resolve only for applying set. | Typed string references; unresolved references warning with retained ID and explicit no-effect-on-missing-target behavior. Safe save retains IDs; never use generic XML bag. Empty ID is invalid, not silently skipped. |
| [midi-input-processor.ts](../../packages/blue-data/src/midi/midi-input-processor.ts) | No attrs; singleton `keyMapping` (`MIDI,PCH,OCT,CONSTANT,TUNING_BLUE_PCH,TUNING_CPS`), `velMapping` (`MIDI,CONSTANT,AMP_0DBFS,AMP`), `pitchConstant`,`ampConstant` strings, `scale`. | Missing PCH/MIDI/empty constants/default12TET as current TS. Emit enum names. | Typed fields; invalid enums errors rather than arbitrary strings or Java silent defaults. Runtime range/pitch execution remains separate. |
| [scale.ts](../../packages/blue-data/src/sound-objects/piano-roll/scale.ts) | No attrs; `scaleName` string, `baseFrequency` finite positive, `octave` finite positive, `ratios` singleton container of repeated positive finite `ratio` scalars; nonempty ratio sequence when supplied. | Missing defaults12TET/base261.625565/octave2/default12 ratios. | Typed shared primitive also reached from PianoRoll and tuning processor; additional owning families must use same contract. |

`midi-key-mapping.ts` and `midi-velocity-mapping.ts` also expose standalone public serializers
but are not children of project MidiInputProcessor and are not Java enum XML. Their own roots
are explicitly supported existing TS public class contracts: no attrs; `midiKeyMapping` singleton
`enabled` bool/defaulttrue, `pFieldIndex` integer>=1/default4, `baseNote` MIDI0..127/default60,
`range` positive integer/default12; `midiVelocityMapping` singleton `enabled`/true,
`pFieldIndex`>=1/default5, `minVelocity`/0 and `maxVelocity`/127 integers0..127 ordered,
`minValue`/0 and `maxValue`/1 finite ordered numbers. Neither root may be inserted as an arbitrary
new project section. MIDI file parsing/trigger routing emits no project XML and is excluded.

## Migration composition and conflict decisions

1. Parse without losing evidence, independently own candidate XML, and validate the original
   structural vocabulary/values required to safely select each migration. Unexpected content
   cannot disappear inside a migration before producing an error.
2. Run version-selected 2.1.10 cross-section 0dbfs normalization, then 2.3.0 envelope relocation,
   timing extraction and beta-pattern nesting; every applicable operation executes regardless of
   earlier success. Legacy root PolyObject timing fields are removed from their old owner after
   extraction, so final class validation does not falsely reject recognized historical data.
3. Run shape-selected root TimeContext relocation and score tempo conversion before score
   interpretation. Existing/current Score plus a legacy root PolyObject is ambiguous and errors;
   root legacy tempo may fill absent Score timing but cannot replace unequal current timing.
   Equal root/nested TimeContext coalesces; unequal errors. Reconciliation must not depend on
   sibling order. Beta direct pattern layers plus current container error unless one is empty;
   canonical normalization never creates a second patternLayers container.
4. Run legacy audio-layer-to-track normalization only within approved Score/PolyObject graph
   positions after Score creation. Today's pass runs first and recursively scans arbitrary
   descendants; that can miss a Score created later or rewrite a foreign payload. Preserve its
   documented deterministic ID allocation and explicit transitional-container merge contract;
   validate legacy nodes before removing recognized instrument/processor children. A populated
   legacy audio layer with unexpected instrument/processor data errors rather than discarding it.
5. Run project-owned panning relocation, sample-rate reconciliation, and arrangement/library
   wiring. Existing TS mixer attr precedence is a named existing feature decision (Spec109/111);
   validate both old/current values before applying the documented per-field precedence and
   report unequal legacy fields rather than erasing their evidence silently. Canonical writer
   stores panning at Mixer only.
6. Run class-local normalizations at their owner boundaries, including those reached by public
   standalone roots. Canonical subtree/member validation follows normalization, then cross-owner
   reference/context validation, then publication. Legacy-only TimeContext FPS transfers into
   absent TimeState FPS; explicit unequal rates error. Derived context rate then synchronizes
   from authoritative TimeState. Reapplying the pipeline to canonical XML is semantically stable.

These are original design decisions; they tighten Java's order-dependent/silent acceptance where
necessary to protect meaningful content. No rejected input creates an edit-history entry, changes
source files, runs on-load JavaScript/QuickJS, or mutates the current document/library. The CLI is
also a host boundary: it surfaces warning diagnostics and fails before runtime initialization on
rejection, using its existing error/reporting channel.

## Current TypeScript gaps requiring planned work

- `upgrade-2.3.0.ts` short-circuits beta migration; does not perform the promised TimeState
  extraction; adds Score/pattern containers without collision handling. `Score.loadFromXML`
  does not load legacy tempo at all. Old timing/tempo can be lost today.
- Root TimeContext assignment competes with Score replacement by source order. Panning migration
  and sample-rate wiring currently happen after load without full input validation. Root writer
  mutates `BlueData.version`; serialization must produce current version without model mutation.
- TimeState permissive unknown stores become unexpected-input diagnostics. Its `pixelSecond`
  conversion rounds while Java truncates; malformed display/snap/fps silently default. Development
  `CSOUND_BEATS` display token falls through and can change display semantics.
- TempoMap legacy pair reader expects attributes despite Java writer emitting child fields;
  current/legacy preference is inferred from resulting point values, incorrectly treating explicit
  current 0/60 data like absence. Enabled value accepts almost every nonfalse token.
- TimeContext simple tempo path tests first BPM rather than field presence; legacy PPQ/sample
  rate discarded, FPSdefault30 differs from authoritative TimeState24 and no equivalent Java
  synchronization is established. Class unknown-member checks missing throughout nested maps.
- TimePosition unknown types fall back to numeric text; missing typed fields default; FRAME output
  `frameCount` differs from Java `frameNumber`. Marker raw XML admits arbitrary children and aliases
  input/output/accessors. Marker scalar setTime can coexist with prior typed child.
- Plugin XML currently retains arbitrary subtypes and exposes backing array. Clojure is already
  modeled but root acceptance must validate its actual shape and keep runtime limitations separate.
- LiveData old/current grid collision replaces current bins; bins silently truncate overflow or
  ignore unknown slots. MIDI values are arbitrary strings and invalid numbers often survive.

## Planned original fixture records

These IDs describe synthetic fixtures to author during implementation, not files copied from Java.
Each must cite this matrix and record its author/origin in the fixture manifest.

| Fixture ID | Acceptance/rejection evidence to construct |
| --- | --- |
| P-CURRENT | Every listed root singleton/scalar, supported nested owner, significant multiline strings; canonical save/reopen and pure writer. |
| P-210-230-COMPOSE | Versionless/pre2.1.10 0dbfs plus old root PolyObject timing/tempo plus beta patterns; all conversions apply and second normalization stable. |
| P-ROOT-CONTEXT-ORDER | Old root context before/after Score yields identical result; equal duplicate coalesces, unequal rejects atomically. |
| P-TEMPO-LINE / P-PAIR-CHILD | Historical tempo Line flags/points ->LINEAR, legacy child beat/tempo pairs retain real values/enabled meaning; no accidental 0/60 defaults. |
| P-STATE-LEGACY / P-STATE-DEV4 | Numeric display/snap/zoom historical and development version4 current shape; truncated zoom, canonical2; malformed enums/full-token numeric errors. |
| P-CONTEXT-RATE / P-PPQ | Sample-rate transfer/equal redundancy warning/conflict error; ppq960 warning, non960 rejection without silent timing change. |
| P-POSITION-TYPES | Each current and writer-proven historical discriminator plus TS frameCount; unknown type rejects and Java canonical frameNumber emits. |
| P-MARKER-OWNERSHIP | Legacy attrs/TS numeric text/current typed times; nested unexpected member and conflicts; mutate input/output/copy without changing canonical/history. |
| P-LIVE-LEGACY / P-LIVE-GRID | Old direct objects command defaults, canonical grid, conflicting bins/direct list, overflow/unknown slots, stable identities and unresolved saved-set IDs retained warning. |
| P-MIDI / P-SCALE | All supported enums/shared scale, unknown enum/ratio/domain and scalar attrs reject; absent historical defaults differ from explicit invalid. |
| P-CLOJURE-KNOWN / P-PLUGIN-UNKNOWN | Known dependencies survive missing runtime, unknown subtype/nested member error, copy/export/history isolation, no runtime setup from rejected candidate. |
| P-NESTED-UNEXPECTED | For each owner above, one extra attribute and one extra child (including recognized scalar child) with exact source/path diagnostics; duplicate/conflict errors. |

## Coverage limits and licensing

Inventory above includes every production XML owner reachable within the assigned root metadata,
project properties, Score timing/maps/markers, Live grid/sets, MIDI processor/scale, and Clojure
plugin families. Arrangement/instruments/effects/mixer, layers/SoundObjects/audio, automation lines,
processor maps, UDO/library envelopes and TimeDuration require their companion family matrices.
Legacy tempo's Line/LinePoint is a shared automation owner, and must use its shared historical
value/version contract before converting points; this document specifies its project timing result,
not a duplicate Line parser. Host settings, UI sessions, caches, MIDI binary format and external
network client creation are excluded. No evidence-poor arbitrary subtype/unknown tag is accepted.

Some older formats are explicitly bounded/rejected (custom PPQ, unknown plugin types, unimplemented
scoreObjectLayerGroup), with actionable diagnostics rather than an unverified promise of historical
support. This research does not claim runtime verification or a complete binary release corpus.

All added prose and design are original in the repository documentation GPL-3.0-or-later scope.
Inspected Java files carry GPL-2.0-or-later headers; their behavioral descriptions inform original
MIT `@blue/data` implementation, but source translation/copy is not authorized. No Java source,
sample payload, tests, external asset or dependency is incorporated. Implementation fixtures are
original synthetic data; any later external fixture needs a separate provenance/license review.


### Composed migration scope

P-210-230-COMPOSE combines the old root PolyObject, 0dbfs and root tempo/context migrations.
The beta Score pattern nesting is verified separately: an existing Score together with an old root
PolyObject remains the explicitly specified conflict, so a synthetic combined fixture must not
silently merge the two independent scores. Legacy library conversion rejects unused named
categories even when other instruments were consumed, and present root flags must match position.
