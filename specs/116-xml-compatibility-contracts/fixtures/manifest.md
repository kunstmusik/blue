# Synthetic XML fixture manifest

Created 2026-10-02 by Codex for this feature. All fixture XML is to be authored
originally from the behavioral contracts below. No Java source, Java test fixture,
example project, or third-party payload is copied or translated. This manifest
freezes case IDs and independent expected outcomes; it does not claim that the
fixtures or their verification have already been implemented.

## Origin and destination scope

The destination-scope review consulted `LICENSING.md`, `packages/blue-data/LICENSE`,
`packages/blue-data/package.json`, and `packages/blue-data/THIRD_PARTY_NOTICES.md`.
Original data-package code and inline synthetic XML belong to the existing MIT
scope; this feature documentation belongs to the repository GPL-3.0-or-later
scope. Existing Apache-2.0 tables are unaffected. App and CLI test fixtures must
follow their respective component scopes when authored. No dependency, asset,
table, external fixture, or GPL Java implementation is incorporated.

The original author/origin for every record is **Codex, original synthetic XML
for feature 116**. The source revision is evidence of behavior, not the origin
of fixture bytes. The TypeScript baseline is
`e744ac08b865f4ce9c7f5863d8be433f227cbd67`; the family matrices contain the
uncommitted explicit support decisions used here.

Java references in the matrices are GPL-2.0-or-later and remain read-only
behavioral references. Pin source URLs/revisions using the linked evidence row;
retain its release/development/source-only qualification. The current inspected
Java snapshot is `3ca3f40579c48a023299a68130d8ab6b9e950974` (**J-current**).
The imported 2010 source is `d1735b6fe22b6e0dee07d665108a50b6151e2cf9`
(**J-2010**). **TS-base** means the TypeScript revision above, with an explicit
feature compatibility decision rather than a claim of Java writer provenance.

## Case conventions

Each case family supplies an accepted example where support is declared,
malformed/unknown/duplicate/conflict variants, and independently specified
canonical state. Use suffixes `-ACCEPT`, `-INVALID`, `-UNKNOWN-ATTRIBUTE`,
`-UNKNOWN-CHILD`, `-DUPLICATE`, `-CONFLICT`, and `-CANONICAL` as applicable.
Historical normalization must be stable when reapplied to the canonical form.
Do not generate expected values using the conversion being tested.

`Project` applicability means a blueData envelope and embedded owner only.
`Both` means an independent root and the same owner embedded in a project/resource;
no project version is required for local compatibility. `Library` means a valid
family envelope and its source-span leaves. Source labels must survive unchanged,
including synthetic Windows paths. Rejections return no candidate and do not
publish or mutate source/destination state. Warnings must state safe save behavior.

## Project cases

Behavioral source URLs, member domains, defaults, and support decisions:
[project-evidence.md](../project-evidence.md).

| ID | Root / source revision | Migration or validation owner | Independent expected canonical state/output | Applicability |
| --- | --- | --- | --- | --- |
| P-CURRENT | blueData; J-current / TS-base | Project root and each nested owner | Listed current sections and significant code survive; writer is pure and uses current version. | Project |
| P-210-230-COMPOSE | blueData; `9f97c9d187ace846a422515dfdea2ed8b1b103b8`, release `092ba88114ad0431273ebfc892ca38c5b433aba0` | Ordered project upgrades, then local owners | 0dbfs reaches both properties; root PolyObject/tempo moves to Score; timing becomes TimeState; beta pattern containers normalize independently. No old root fields remain. | Project |
| P-ROOT-CONTEXT-ORDER | blueData; `98103a219a54974dfe1a2bd780e89b34b2239668` | Project context migrator | Root context before/after Score yields identical timing. Equal context coalesces; unequal contexts reject. | Project |
| P-TEMPO-LINE | tempo in blueData/score; same context revision | Project tempo migrator after shared Line normalization | Original flags and beat/BPM points become ordered LINEAR TempoPoints; no invented 0/60 data. | Project |
| P-PAIR-CHILD | tempoMap; same context revision / TS-base attribute alias | TempoMap | Child beat/tempo values and historical enabled meaning survive as LINEAR points; conflicting attributes reject. | Both |
| P-STATE-LEGACY | timeState; `7c9268215c09c7f16ae5e6b88a79707f2edc0710`, J-current | TimeState | Numeric display 0/1 becomes TIME/BEATS; positive numeric snap maps to documented enum; pixelSecond zoom truncates toward zero; output version 2. | Both |
| P-STATE-DEV4 | timeState; `4b726c241eaf8f40c55a449353e81239bd4c2318`, `58efc8cca281ed60f8a2c8fdea830f1110f29030` | TimeState | Development version 4 current row names retain visibility and emit version 2; no invented historical row aliases. | Both |
| P-CONTEXT-RATE | timeContext/blueData; `dfa46c622a7fbc9e0bdcfe2366c119605b3568a3` | Project rate reconciliation | Missing explicit property receives old sampleRate; equal redundant rate warns and omits; unequal explicit rates reject. Direct loading must not discard unreconciled rate. | Project; independent rejection |
| P-PPQ | timeContext; `c46ea5fbee04a55157febbe696c38d1409848c52` | TimeContext | Fixed 960 warns and omits safely; custom PPQ rejects without reinterpreting ticks. | Both |
| P-POSITION-TYPES | typed position roots; `0e3234428200885019ce9c089032d2a8c7e799e4`, J-current / TS-base | TimePosition | Supported enum/class aliases retain exact units/components; FRAME writes frameNumber; unknown/missing typed fields reject. | Both |
| P-MARKER-OWNERSHIP | markersList/marker; `c7b0d28060c91d8eb446c781a26ad0968de27b0c`, TS-base | Marker owners | Legacy time attributes/numeric text become typed time; input, export, and copy mutations cannot change original marker state. | Both |
| P-LIVE-LEGACY | liveData; J-2010 / J-current | LiveData | Ordered direct objects become a single grid column; historical missing command flags enable documented command override. Competing grid rejects. | Both |
| P-LIVE-GRID | liveData; J-current | Live grid and set owners | Cell order/identities survive; unresolved set IDs retain named warnings; overflow/unknown slots reject. | Both |
| P-MIDI | midiInputProcessor; J-current | MIDI owner | Declared enums/strings/scale retain state; missing defaults differ from invalid present values, which reject. | Both |
| P-SCALE | scale; J-current | Shared Scale | Name, octave, and complete ratios survive; invalid ratio/domain or scalar shape rejects. | Both |
| P-CLOJURE-KNOWN | pluginData/blueDataObject; `206de0828977ae0484ccdebe74736f9b339bcfd4`, J-current | ClojureProjectData | Known dependency coordinates/version remain independently owned and savable without a runtime. | Both |
| P-PLUGIN-UNKNOWN | pluginData; J-current / feature rejection decision | Project plugin boundary | Unknown subtype or nested member rejects; no generic payload acceptance or execution. | Project |
| P-NESTED-UNEXPECTED | Every project-family owner; family matrix / TS-base | Owning class and report context | Unexpected attribute/child, duplicate, conflicting alias, and invalid known token produce source/indexed path/member/value/recovery errors. | Both where owner is independent |

## Resource cases

Behavioral source URLs, fixed widget/type lists, defaults, and support decisions:
[resource-evidence.md](../resource-evidence.md).

| ID | Root / source revision | Migration or validation owner | Independent expected canonical state/output | Applicability |
| --- | --- | --- | --- | --- |
| R-H01 | instrument/effect; J-2010, `15b54945f5bbb91084d64efc3f9445e6b39adc3f` | BSB/Effect local ParameterList boundary | bsbParameterList becomes parameterList; coexistence rejects; uppercase reader-only typo rejects. | Both |
| R-H02 | parameter/line; `90b9750150b5ec7359fa9e9a3d12622491135320`, `098338597c8465ff845958a30b69f2c4d5399268` | Shared exact resolution owner | Legacy numeric resolution normalizes with five-place HALF_UP; valid bdresolution wins after both tokens validate; exact current scale retained. | Both |
| R-H03 | line; J-current documented historical behavior | Shared Line owner | Missing/1 version relative y becomes absolute min/max once; output version 2; invalid/future version rejects. | Both |
| R-H04 | bsbObject Knob/XY; J-current documented pre-0.110.0 behavior | Knob/XY local owners | Missing/1 version relative values become absolute and output version 2; no repeated scaling. | Both |
| R-H05 | dropdown/label widgets; `0e655d3d40f5945948b08f934a27fbf825a50f29`, J-current | Dropdown/Label local owners | Supported scalar Swing HTML/text/font conversion for old version; output 2; nested XML rejects. | Both |
| R-H06 | graphicInterface; J-current documented pre-2.7.0/pre-2.5.8 | GraphicInterface | Direct widgets wrap in one ordered group; absent grid becomes NONE/snap false; mixed group/direct form rejects. | Both |
| R-H07 | effect/udo; `46cc5f74a82bbd4306ede930494e75f34fd78187` development | Effect/UDO style owners | Missing style becomes explicit CLASSIC; MODERN retains signature; invalid/inapplicable nonempty signature rejects. | Both |
| R-H08 | blueData instrumentLibrary/arrangement; J-current documented pre-0.95.0 | Project reference migrator | Category-index paths resolve to independent embedded instruments in original order; invalid/inline-plus-reference/unaccounted library content rejects. | Project |
| R-H09 | mixer/channel; J-current / TS-base aliases | Mixer/Channel local owners | Old lists become current lists; unbinned chain becomes post then ordered direct sends; competing bins/lists reject. | Both |
| R-H10 | parameter/line; TS-base, Specs009/073 explicit support | Shared Parameter/Line owners | enabled becomes automationEnabled; points/curve aliases normalize; conflicting aliases and unsupported precision-selector behavior reject. | Both |

Each recognized instrument, Effect, UDO, BSB widget, preset/group, parameter, and
mixer nested owner also receives current/unknown/member/value cases. Parameter
and Line normalization composition must assert absolute values before quantization.
Preset setting keys are unique and canonical output sorts them; dangling names
are retained until the existing explicit synchronization operation.

## SoundObject and library cases

Behavioral source URLs, nested owner grammar, and support decisions:
[sound-library-evidence.md](../sound-library-evidence.md) and the
[time supplement](../contracts/xml-loading.md#development-era-common-soundobject-time-forms).

| ID | Root / source revision | Migration or validation owner | Independent expected canonical state/output | Applicability |
| --- | --- | --- | --- | --- |
| SL-H01 | Sound; J-2010 | Sound local instrument owner | instrumentText becomes BlueSynthBuilder instrument text; unequal current/old instrument rejects; current instrument output. | Both |
| SL-H02 | ObjectBuilder; `e5f762edafca0173a1504a87f3b3b57cecf65596` | ObjectBuilder | isExternal maps PYTHON/EXTERNAL; only syntaxType Python with Python mode warns/omits safely; other editor metadata rejects. | Both |
| SL-H03 | Line/zak line; resolution revisions in R-H02 | Shared Line | Exact bdresolution output, validated precedence and legacy rounding; malformed competing form rejects. | Both |
| SL-H04 | Line; J-2010 documented pre-0.110.0 | Shared Line | Relative y becomes absolute once, missing old color gray, output version 2; no clamping invalid data. | Both |
| SL-H05 | SoundObject common time; `3b237ef572853ffc31f45a8c9af3f9c8808c979e`, `08ac9375357a481d5799c50e259f8febbcf7d68d`, `917b3aa105044eadde4c8c748a757d671055f8a0`, `7da35d375be5f17d8a7c42383ad100fb9ce55193`, `c7b0d28060c91d8eb446c781a26ad0968de27b0c` development | Common SoundObject local time normalization | Direct BeatTime/TimeValue/FrameValue maps preserve units/components; emit startTime/subjectiveDuration. MeasureBeatsTime/SMPTEValue and reader-only wrapper reject; no four-beat fallback. | Both |
| SL-H06 | PianoRoll; `f26e9726c5b875ac4750507fed0e36a1946e3f17`, J-2010 | PianoRoll | Numeric snap/display normalizes; typed historical timeUnit interval warns, survives copies/history, and remains output when present. | Both |
| SL-H07 | JMask; `dd17bbfc821bb55c0a8eeebe56b7e356caaedbd5` | JMask/seed owners | Missing seed disables; signed64 endpoints and values above 2^53 retain exact decimal digits in XML/copies/history. | Both |
| SL-H08 | TrackerNote; J-2010 reader-only bounded support | TrackerNote and enclosing column validator | pitch/amp/otherField becomes ordered field cells; canonical field val attributes; mismatched columns reject. | Both |
| SL-H09 | GenericScore/TrackerObject/processors/maps/Line/PolyObject; TS-base | Respective local owner | Listed TS aliases map to one current form; equal values coalesce, conflicts/invalid grammar reject. No suffix-based type acceptance. | Both |
| SL-H10 | PianoRoll; TS-base emitted defect | PianoRoll Scale owner | Exact empty then populated scale warns and retains complete scale; output one populated scale. All other duplicates reject. | Both |
| SL-H11 | audioClip; TS-base AudioClip/fade contract | AudioClip | Scalar beat aliases become typed time; Symmetric becomes S-Curve; unknown fades/conflicts reject. | Both |

Library cases extend the evidence matrix's unnumbered envelope/archive/transaction
contracts with stable IDs:

| ID | Root / source revision | Owner | Independent expected outcome | Applicability |
| --- | --- | --- | --- | --- |
| SL-LIB-ENVELOPE | instrumentLibrary/udoLibrary/effectsLibrary/soundObjectLibrary; J-current, `333ddb49a855aa73f1aefd1c00d8b4fe4476141e` | Legacy library codec | Exactly one correctly spelled family category; category/leaf grammar and isRoot position validate before publication; wrong-kind/unknown wrapper rejects whole source. | Library |
| SL-LIB-ARCHIVE | Valid family envelope and unsupported leaf; Spec060 / TS-base | Full resource classifier and raw source-span owner | Known outer type cannot hide nested unknown data; unsupported leaf retains exact Unicode/CDATA/whitespace XML, warning, and disabled typed editing/insertion. | Library |
| SL-LIB-TRANSACTION | Valid/invalid source batch; Spec060 / TS-base | Host repository/import service | Rejected source publishes zero folders/items; other sources may succeed with explicit partial outcome; revisions/hash fences remain enforced. | Library |
| SL-LIB-REACCEPT | Persisted supported or edited archive record; Spec060 / TS-base | Editor/project insertion boundary | Full acceptance is rerun before typed promotion/insertion; failure creates no project history or runtime reconciliation. | Library and Project |
| SL-CODE-CDATA | customAccelerators; J-current / TS-base | Code Repository codec | Signature text includes ordered text and CDATA; unknown wrapper/scalar members reject; group/snippet order retained. | Library |

All 19 SoundObject types, 17 processor types, and reachable layer/audio/JMask,
tracker/PianoRoll owners use current, unknown, invalid, conflict, dormant-state,
and canonical variants at their primary suites. Tuning data preserves complete
scale or named external-path dependency; missing host resolution never substitutes
a scale. Instance references must resolve before project candidate publication.

## Implementation evidence

No fixture suite has been executed at manifest creation. Record concrete test
locations and actual commands/results in `quickstart.md` as tasks are completed.
Task markers describe execution status; this manifest describes the independent
contract and provenance only. Checklist markers remain reviewer-owned.


## Executed owner suites and fixture corrections

The original synthetic cases now live in serialization/xml-load, project-section-acceptance,
migration/project-xml-compatibility, resource-xml-policy, instruments/blue-synth-builder/xml-contract,
mixer/xml-contract, automation/xml-acceptance, note-processors/xml-acceptance, jmask-xml-acceptance,
common/concrete-xml-contract, score/timeline-xml-acceptance, MIDI mappings and existing owning suites.
Host tests cover project replacement, recursive library admission, IPC diagnostics, CLI rejection,
exact-seed/insertion history and external tuning dependencies. These tests assert independent typed
values, rejection diagnostics and pure canonical output; this list does not replace the owner matrices.

Existing original synthetic Track migration fixtures now contain only supported members; separate
negative cases cover their former unknown sibling/attribute payloads. Smoke and BlueX7 fixture
TimeContext rates now agree with their TimeState rates. The BlueX7 generator regenerated its existing
fixture after removal of the duplicate empty PianoRoll Scale; CSD behavior remains covered. Existing
history fixtures use typed Clojure metadata in place of arbitrary retained plugin XML. No Java
example/source was copied into a new fixture. Native Windows and manual desktop observations remain
explicit validation limits in quickstart.md.


### T054 direct owner roots

`serialization/xml-owner-root-contract.test.ts` contains original synthetic populated inputs for
Arrangement/assignment/instrument categories and library, Live/grid/set owners, time primitives,
AudioClip, project SoundObjectLibrary, MIDI mappings, and ClojureLibraryEntry. Cases rename only
the root to test rejection, compare complete direct/report diagnostics, preserve input ownership,
and reopen canonical output. The finite table also exercises existing Blue-authored model writer
inputs for all other public owners; no external payload is copied. Stable case family:
`OWNER-ROOT-<table owner name>`, owned by each class loader, with current-root acceptance,
wrong-root rejection, canonical reopening, and explicit field/reference dependencies. Historical
assignment/tempo/measure/PolyObject and caller-selected time-root cases retain the established
support decisions. The inventory reconciliation adds the independently verified SoundLayer guard.
Destination: MIT Blue-authored blue-data tests/production; scope and existing notices checked,
with no third-party incorporation or changed distribution obligations.
