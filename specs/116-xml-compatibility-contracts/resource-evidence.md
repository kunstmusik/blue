# Resource acceptance and historical evidence

**Date**: 2026-10-01  
**Scope**: Arrangement, instruments, mixer/effects, BSB interfaces/widgets, parameters,
presets, and UDOs. Read with [research.md](research.md) and the project/score evidence.

## Evidence and support decisions

Research used the local Java checkout at revision
`3ca3f40579c48a023299a68130d8ab6b9e950974` (2026-06-28). `J` below means the current
Java loader **and writer**, under `blue-core/src/main/java/blue/`, at that revision.
`T` means the existing TypeScript model/writer and an explicit decision to support that
format in this feature. Source behavior is evidence; these notes do not claim a stable
release for each observed revision. Historical source predating the 2010 SVN import is
unavailable locally. Existing Java class comments identify some older release boundaries;
those annotations are distinguished from independently inspected release artifacts.

Decisions:

- Accept the listed Java and existing TypeScript resource forms, including existing named
  extension fields. All other type/member names reject by default. An unsupported library
  leaf may instead become a diagnosed, non-insertable archive under the library contract.
- All class-local normalization runs without `BlueData` or project-version context. The
  same boundary is reached by project embedding, disk, library, and BlueShare-shaped XML.
- Listed scalar/container fields have cardinality zero-or-one unless marked repeated or
  required. Missing optional historical data uses the stated default or the existing
  owning model's declared field default; invalid present input does **not** use omission
  defaults. Each implementation schema must encode those defaults explicitly rather than
  assuming a permissive reader is validation. Numeric input must consume the whole lexical
  value, be finite, and respect the owner's domain; `parseInt`/`parseFloat` prefix acceptance
  is not contractual. Booleans are `true`/`false`; enum spellings are case sensitive.
- Reject duplicate singleton fields, unknown attributes even on scalar children, mixed
  semantic text/children, unsupported nested types, and competing aliases unless an explicit
  precedence below applies. Preserve scalar code/text whitespace and repeated-child order.
- Canonical output comes from typed state and known fields, not reflection over arbitrary
  instance properties. Loader input, writer output, history copies and duplication copies
  own mutable subtrees independently. History keeps identities; user duplication uses the
  existing identity-remapping rules.
- Missing historically absent identity fields can generate identities. Existing Spec 043
  repairs duplicate widget identities by preserving the first and rekeying later collisions;
  surface a normalization warning, then write canonical identities. Conflicting identity
  aliases reject instead of choosing an unrelated identity silently.

## Reachable owner inventory

Paths in this table are relative to `packages/blue-data/src/`. All nested owners inherit
the unexpected-member/value policy above. The fields are schema facts, not incorporated
Java implementation code.

| Owner/root | Accepted attributes and children | Output/defaults and evidence |
| --- | --- | --- |
| `Arrangement`, `arrangement.ts` / `arrangement` | Repeated `instrumentAssignment`; no attributes | Preserve assignment order; each assignment must resolve one instrument. J `Arrangement.java`. |
| `InstrumentAssignment`, `instruments/instrument-assignment.ts` | `arrangementId`, `isEnabled`; one required `instrument` | Canonical attributes as named; enabled omission=true. T legacy `id` and `enabled` attribute aliases remain explicitly supported; reject alias coexistence. Java historical `instrumentId` is a project graph reference, described below. |
| Instrument dispatcher, `instruments/instrument-registry.ts` | `instrument` with required exact `type` | Accept `blue.orchestra.GenericInstrument`, `JavaScriptInstrument`, `PythonInstrument`, `BlueSynthBuilder`, `BlueX7`. Missing/other type rejects typed acceptance. Registered additional types need explicit contracts; registration alone is insufficient. |
| Generic, JavaScript, Python instrument | `type`, `enabled`; `name`, `comment`, `globalOrc`, `globalSco`, `instrumentText`, `opcodeList` | Canonical same fields; enabled omission=true; code/text empty omissions follow current class loading behavior. J corresponding `orchestra/*.java`, T `instruments/*-instrument.ts`. Python runtime availability is separate from acceptance. |
| BlueSynthBuilder | Above common attributes; T `editEnabled`; common children plus `alwaysOnInstrumentText`, `graphicInterface`, `parameterList`, `presetGroup`, `opcodeList` | `bsbParameterList` historical alias is accepted locally; canonical `parameterList`. Reject simultaneous list aliases. All nested widget/parameter/preset content validates before synchronization. J `orchestra/BlueSynthBuilder.java`; T `instruments/blue-synth-builder.ts`. |
| BlueX7 | `type`, `enabled`; `name`, `comment`, `algorithmCommonData`, `lfoData`, six repeated root `operator`, four repeated root `envelopePoint`, `csoundPostCode`; T `parameterList` | Require complete voice containers and fixed arrays for editable acceptance; partial voice arrays currently default-filled by TS have no historical writer evidence and reject. Post-code is scalar text. Spec 092 parameter extension is accepted, generated from voice when absent. J `orchestra/BlueX7.java`; T `instruments/blue-x7.ts`. |
| AlgorithmCommonData | `keyTranspose`, `algorithm`, `feedback`, six repeated boolean `operator` children; no attributes | Transpose 0..48, algorithm 1..32, feedback 0..7; exact six operator enable flags. J `orchestra/blueX7/AlgorithmCommonData.java`, T BlueX7 catalog. |
| LFOData | `speed`, `delay`, `PMD`, `AMD`, `wave`, `sync`; no attributes | Integer speed/delay/depths 0..99, wave 0..5, sync 0..1. J `orchestra/blueX7/LFOData.java`. |
| BlueX7 Operator | `mode`, `sync`, `freqCoarse`, `freqFine`, `detune`, `breakpoint`, `curveLeft`, `curveRight`, `depthLeft`, `depthRight`, `keyboardRateScaling`, `outputLevel`, `velocitySensitivity`, `modulationAmplitude`, `modulationPitch`; four `envelopePoint` | Integer domains from existing `blue-x7/parameter-catalog.ts`; mode/sync 0..1, coarse 0..31, fine 0..99, detune -7..7, breakpoint/depth/output 0..99, curves 0..3, rate/velocity/pitch sensitivity 0..7, amplitude sensitivity 0..3. J `orchestra/blueX7/Operator.java`. Preserve mixed per-operator sync until explicit user edit. |
| BlueX7 EnvelopePoint | Required integer attributes `x`, `y`; no child/text payload | Rate/level 0..99; preserve fixed array ordering. J `orchestra/blueX7/EnvelopePoint.java`. |
| Mixer, `mixer/mixer.ts` | T attrs `panningEnabled`, `panLawDb`, `panOffCenterBoost`; `enabled`, `channelListGroups`, repeated discriminated `channelList`, one master `channel`, `extraRenderTime`; T `enableMeters`, `meterProfile` | J `mixer/Mixer.java`; T Specs 104/105/112/113. Canonical `channelList list=channels/subChannels`; historical `channels`/`subChannels` wrappers accepted locally with conflicting representations rejected. Group list remains separate. Missing pan config preserves legacy disabled routing, -3dB unboosted; meters/profile use legacy Spec 105 defaults. |
| ChannelList, `mixer/channel-list.ts` | `association`, `listName`; contextual `list` for Mixer children; repeated `channel` | J `mixer/ChannelList.java`; no arbitrary role values. Accept `channels`, `subChannels`, documented Java historical `SubChannels`; validate role before normalizing. Group container has no attributes and only channel lists. |
| Channel, `mixer/channel.ts` | `association`; `name`, `outChannel`, `level`, `muted`, `solo`, repeated `effectsChain` distinguished by `bin`; repeated `parameter`; T `pan`, `stereoPanMode`, `panWidth`, `dualPanLeft`, `dualPanRight` | Canonical pre/post chains, Volume and named panning parameters. J `mixer/Channel.java`; T Specs 112/113. Master aliases `Master`/`master` normalize to canonical master identity. Unknown channel parameter name cannot be silently skipped. Legacy unbinned chains/direct sends need explicit ordering, below. |
| EffectsChain, `mixer/effects-chain.ts` | Contextual `bin=pre/post`; ordered repeated `effect` or `send` | J `mixer/EffectsChain.java`; preserve order, reject other members/types; standalone chain cannot invent a host channel. |
| Send, `mixer/send.ts` | `sendChannel`, `level`, `enabled`, `parameter`; no attrs | J `mixer/Send.java`; finite level, canonical nested parameter; validate target resolution at project mixer boundary before publication. |
| Effect, `mixer/effect.ts` / `effect` | No attrs; `style`, `name`, `enabled`, `numIns`, `numOuts`, `code`, `comments`, `opcodeList`, `graphicInterface`, `parameterList` | J `mixer/Effect.java`; style CLASSIC/MODERN, missing=CLASSIC, nonnegative integer I/O counts, enabled omission follows owning model default. Historical `bsbParameterList` accepted; reject both aliases. Canonical current list/style. |
| ParameterList, `automation/parameter-list.ts` | Repeated `parameter`, no attrs | Applies current/historical list names selected by the parent; unknown wrapper children reject. Retain identities, order and automation state before widget reconciliation. |
| Parameter, `automation/parameter.ts` | `uniqueId`, `name`, `label`, `min`, `max`, `bdresolution`, `automationEnabled`, `value`; T `curve`; historical `resolution`, T `enabled`; optional `line`; T legacy `points` | J `automation/Parameter.java`; Spec 073 exact decimals; T curve LINEAR/STEP/EXPONENTIAL. Canonical current attrs plus line. Historical resolution conversion and parameter-owned line resolution below. Duplicate semantic point containers reject. |
| Parameter legacy point container | `points` with repeated `point`, point attrs `time`, `value` | T explicitly accepted original TS form; finite numbers, no extra attributes/children. Canonical `line`/`linePoint`, no project migration. |
| Shared Line / LinePoint | `line` attrs `name`, `version`, `max`, `min`, `bdresolution`, `color`, `rightBound`, `endPointsLinked`; historical `resolution`; repeated `linePoint` attrs `x`,`y`; T BSB `varName` alias | J `components/lines/Line.java`, `LinePoint.java`; version absent/1 converts relative Y; canonical version2 absolute Y. Missing historical color=gray, flags=false; bounds and point coordinates required/finite. Zak-line owner requires `channel` in its own class contract, not arbitrary acceptance here. |
| OpcodeList, `opcodes/opcode-list.ts` | Repeated `udo`, no attrs | J `udo/OpcodeList.java`; current TS passes every child to UDO loader, which must become exact `udo` dispatch. Preserve order and complete supported definitions. |
| OpcodeDefinition / UDO, `opcodes/opcode-definition.ts` | `style`, `opcodeName`, `outTypes`, `inTypes` (CLASSIC), `inputArguments` (MODERN), `codeBody`, `comments`; no attrs | J `udo/UserDefinedOpcode.java`; missing style=CLASSIC; invalid present style rejects. Style-specific output normalization stays in existing UDO utilities. Nonempty opposing input form rejects rather than being silently erased; empty opposing form may normalize as redundant historical content with warning. `commentText` is transient, not serialized. |
| InstrumentLibrary / InstrumentCategory | `instrumentLibrary` contains one `instrumentCategory`; category attrs `categoryName`,`isRoot`, repeated categories/instruments | J `InstrumentLibrary.java`, `orchestra/InstrumentCategory.java`; T `instruments/instrument-library.ts`, `instrument-category.ts`. Validate every leaf; generic-only flat fallback in current TS is not polymorphic validation. Canonical categories retain ordering. Unsupported leaves only archive through existing unified library boundary. |

## BSB nested inventory

`bsbObject` requires exact `type=blue.orchestra.blueSynthBuilder.<class>`. Common fields
are `objectName`, `x`, `y`, `comment`; attributes `type`, and T `uniqueId` (Spec 043).
T historical `id` attribute/child normalize to `uniqueId`. `automationAllowed` applies
only to Java automatable owners (knob, sliders/banks, checkbox, dropdown, XY, Value);
omission=false is historical loader behavior. `parameterName` is the named existing TS
extension from Spec 004/006, never permission for arbitrary widget fields. The common
model happens to expose numeric fields to every subclass, but only listed type fields
are accepted. Integer positions/dimensions and finite range/value fields validate before
loading. Colors accept the established Java color encoding and existing TS CSS encoding
through the existing color utility, with canonical writer encoding; invalid color rejects.

| Nested owner | Type-specific expected members | Historical forms/defaults and canonical output |
| --- | --- | --- |
| GraphicInterface | attr `editEnabled`; `gridSettings`; one root BSBGroup or historical repeated direct non-group `bsbObject` | J `orchestra/blueSynthBuilder/BSBGraphicInterface.java`: pre2.7 direct children become one root group; no simultaneous root plus direct children, no multiple roots. Missing grid (pre2.5.8) means NONE/snap=false, dimensions10. TS currently defaults DOT/snap=true on omission; correct to historical loader default. |
| GridSettings | `width`, `height`, `gridStyle`, `snapGridEnabled`; no attrs | Positive integer dimensions; NONE/DOT/LINE; typed output only. Present incomplete optional grid uses declared GridSettings defaults; invalid members reject. |
| BSBGroup | `groupName`, `backgroundColor`, `borderColor`, `labelTextColor`, `titleEnabled`, `width`,`height`,`font`, repeated `bsbObject`; Java historical attr `groupName`, accepted contextual `editEnabled` | Canonical groupName child; conflicting attr/child rejects. Child insertion order survives. Java LinkedHashSet change 2026-02-23 confirms deliberate order. |
| BSBKnob | `minimum`,`maximum`,`value`,`knobWidth`,`randomizable`,`valueDisplayEnabled`,`label`,`labelEnabled`,`font`; attr `version` | Missing/1 version uses relative value->absolute bounds; version2 current. Missing labelEnabled=false for pre2.7.2. Current TS misses absent-version conversion; canonical version2. |
| BSBHSlider / BSBVSlider | `minimum`,`maximum`,`value`,`bdresolution`,`randomizable`,`valueDisplayEnabled`, `sliderWidth` or `sliderHeight`; attr `version` | Historical `resolution` double conversion accepted; canonical bdresolution/version2. Current Java version branches both parse double; do not add unsupported float emulation. |
| BSBHSliderBank / BSBVSliderBank | `minimum`,`maximum`,`bdresolution`,`gap`,`randomizable`,`valueDisplayEnabled`,`sliderWidth`/`sliderHeight`, repeated correctly oriented slider `bsbObject` | Historical `resolution` accepted; synchronize parent-owned bounds/resolution to child sliders without deleting valid automation. Reject nested non-slider types, rather than silently skipping. |
| BSBValue | `minimum`,`maximum`,`defaultValue` | Canonical defaultValue; common `value` is not automatic substitute. T existing writer/defaults remain supported, no project envelope needed. |
| BSBCheckBox | `label`,`selected`,`randomizable` | Boolean selection authoritative; no automatic arbitrary scalar member inheritance. |
| BSBDropdown | `selectedIndex`,`fontSize`,`randomizable`,`bsbDropdownItemList`; attr `version` | Absent/1 version converts historical Swing HTML item names/font, version2 plain names/fontSize. Empty list accepted; nonempty index must resolve, font8..36. |
| DropdownItemList / DropdownItem | Repeated `bsbDropdownItem`; item attr `uniqueId`, children `name`,`value` | Names and replacement values are scalar strings; missing legacy item identities generated under existing identity rules; no arbitrary XML in labels. |
| BSBXYController | `xValue`,`yValue`,`xMin`,`xMax`,`yMin`,`yMax`,`width`,`height`,`valueDisplayEnabled`,`randomizable`; attr `version` | Missing/1 version relative X/Y->absolute bounds, canonical2. TS currently only converts explicit version1. Preserve axes/range data before normalizing. |
| BSBLabel | `label`,`font`; attr `version` | Absent/1 legacy Swing HTML converted to plain label + font; canonical2. Label remains scalar escaped text; literal '<' is not nested XML. |
| BSBTextField | `value`,`textFieldWidth` | String value retains significant whitespace; no nested semantic children. |
| BSBFileSelector | `fileName`,`textFieldWidth`,`stringChannelEnabled` | fileName remains scalar persisted user text; serialization does not normalize host paths globally. Runtime StringChannel fields are not XML. |
| BSBSubChannelDropdown | `channelOutput` | Scalar named mixer target; deferred project target resolution after acceptance, no executing on-load data. |
| BSBLineObject | `canvasWidth`,`canvasHeight`,`xMax`,`relativeXValues`,`separatorType`,`leadingZero`,`locked`,`lines` | Historical `commaSeparated=true` ->COMMA, false->NONE; canonical NONE/COMMA/SINGLE_QUOTE; reject competing separator forms. `lines` contains repeated validated shared Line/LinePoint. T legacy `points` scalar coordinate list accepted only at its documented fallback, reject simultaneous current+legacy points. |
| Font | `name`,`size`,`style`, no attrs | J `BSBFontUtil.java`; positive font size, style integer0..3; default declared Roboto/12/plain if optional omitted. Canonical nested font; name is scalar, not a platform font availability error. |
| PresetGroup | attrs `name`,`currentPresetUniqueId`,`currentPresetModified`; repeated `presetGroup`/`preset` | J `PresetGroup.java`; recursive typed group, default current reference empty/modified=false; preserve ordering, validate selected preset reference after whole tree. |
| Preset / Setting | preset attrs `name`,`uniqueId`; repeated `setting`, required setting attr `name` with scalar text | J `Preset.java`; declared dynamic map of widget-name->preset string, not arbitrary XML. Reject duplicate setting keys; dangling names may be retained until existing explicit synchronize operation, not silently removed on acceptance. Sort setting keys for current canonical writer. Value decoding belongs to known widget type when applying a preset. |

## Historical conversion matrix

| ID | Evidence/form | Owner, conflict/order rule, canonical result |
| --- | --- | --- |
| R-H01 | `bsbParameterList` was emitted by [2010 writer](https://github.com/kunstmusik/blue/blob/d1735b6fe22b6e0dee07d665108a50b6151e2cf9/blue-core/src/blue/orchestra/blueSynthBuilder/BSBParameterList.java); [2017 reader correction](https://github.com/kunstmusik/blue/commit/15b54945f5bbb91084d64efc3f9445e6b39adc3f) | Resource-local BSB/Effect loader shares ParameterList contract; both aliases together reject; output `parameterList`. Uppercase `ParameterList` was a reader typo with no inspected writer, reject. Source historical, no independently inspected release artifact. |
| R-H02 | [2016 exact decimal change](https://github.com/kunstmusik/blue/commit/90b9750150b5ec7359fa9e9a3d12622491135320), [legacy conversion fix](https://github.com/kunstmusik/blue/commit/098338597c8465ff845958a30b69f2c4d5399268); current Parameter identifies Blue2.7.0 | Shared class-local resolution parsing: legacy double -> exact decimal constructed from double ->five-place HALF_UP ->trailing-zero removal; bdresolution overrides legacy resolution independently of child order. Both must lexically validate; canonical exact resolution keeps scale per Spec073. Parameter-owned resolution synchronizes nested line after Line historical Y conversion. |
| R-H03 | Current [Line loader](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/components/lines/Line.java) accepts missing/1 version and writes2 | Shared Line boundary maps relative y into min/max before parameter quantization, then writes absolute version2; preserve point order/equal times. Reject invalid/future local version values. Current TS Parameter/BSB line helpers omit this conversion. |
| R-H04 | Current [Knob](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/orchestra/blueSynthBuilder/BSBKnob.java) and [XY](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/orchestra/blueSynthBuilder/BSBXYController.java); knob comment identifies0.110.0 | Class boundary; missing/1 local version relative->absolute, once; output2 prevents repetition. Missing version must not be interpreted as current. Old 2010 writer already emits2, so earlier raw artifacts remain an evidence gap; explicitly support current Java-documented historical behavior. |
| R-H05 | [Dropdown HTML migration 2017-01-24](https://github.com/kunstmusik/blue/commit/0e655d3d40f5945948b08f934a27fbf825a50f29); current Label loader/writer | Class-local legacy text/font conversion only for absent/1 local version; canonical2. Scalar HTML is legacy text data; unsupported XML children reject. Existing `legacy-swing-html.ts` implements declared conversion; no HTML runtime parser/dependency needed. |
| R-H06 | Current GraphicInterface explicitly documents pre2.7.0 direct widgets and pre2.5.8 absent grid | Class-local wraps direct non-group children preserving order; reject mixed root group/direct children rather than Java last-root behavior. Missing grid->NONE/snap=false; canonical grouped interface plus typed grid. |
| R-H07 | [2026-04-08 Effect/UDO style addition](https://github.com/kunstmusik/blue/commit/46cc5f74a82bbd4306ede930494e75f34fd78187) | Class-local missing style->CLASSIC, output explicit style; current CLASSIC/MODERN supported at inspected development snapshot. Invalid style rejects (Java fallback not contract). Do not silently erase nonempty style-inapplicable signature content. |
| R-H08 | Current [InstrumentAssignment](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/InstrumentAssignment.java), [InstrumentLibrary](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/InstrumentLibrary.java), BlueData old-library path identify pre0.95.0 | **Project migrator**, before class loading: `instrumentId` is colon-separated category-index traversal ending in instrument index. Preserve category and instrument array orders, resolve then embed cloned instrument into assignment; reject missing/out-of-range/ambiguous reference and simultaneous inline+reference instrument. Remove project library only when all supported content is accounted for; unreferenced meaningful library entries cannot simply disappear. Their disposition must be explicit project support/retention or rejection. |
| R-H09 | J Mixer supports old `channels`/`subChannels`, current discriminated lists; T Channel accepts unbinned chain, direct sends, child association | Local Mixer/Channel normalization; reject simultaneous competing representations. An unbinned chain becomes post, followed by legacy direct sends in input send order; reject ambiguous coexistence with explicit post chain. Canonical pre/post bins, association attribute, current lists. T-only aliases are explicit existing compatibility decisions, not inferred Java historical writers. |
| R-H10 | T legacy `enabled`, `points`, line `curveType`, `resolutionScale`, `highPrecision`; Specs009/073; prior writers not fully inspected | Explicit TS historical compatibility: enabled alias->automationEnabled, old points->line points, curveType CONSTANT->STEP/LINEAR->LINEAR/EXPONENTIAL->EXPONENTIAL. Conflicting forms reject except documented exact-resolution override. highPrecision/resolutionScale have no current behavior; do not invent harmless warning until historical semantics establish no meaningful loss. If they select unsupported behavior, reject typed acceptance or archive resource; these are not generic ignored children. |

## Existing raw stores and independent entry points

| Existing storage/path | Planning disposition |
| --- | --- |
| `UnknownInstrument.xml` and unknown instrument registry fallback | Remove fallback from accepted typed projects/resources; diagnose unsupported type. Existing unified library archive owns original unsupported payload separately. No editable placeholder instrument with arbitrary XML. |
| BSB `_graphicInterfaceXML` and GraphicInterface `gridSettingsRaw` | These currently preserve arbitrary source fields while typed state can lose them after edits. Every expected widget/grid field becomes authoritative typed state. Any temporary formatting cache must be fully validated, independent, invalidated on edits, and cannot authorize an otherwise unsupported subtree. No new named arbitrary BSB retention contract. |
| BlueX7 `_sourceXmlTemplate` | Whitelist/validate expected voice+parameter fields before retention; typed state is authoritative. Unknown root/nested data rejects typed acceptance. Existing source template is not an extension contract and must not restore unexpected members on save. |
| Resource library exact raw leaf source | Retain under existing diagnosed archive contract, with supported classifier using complete recursive acceptance. Raw XML archive editor may retain unsupported bytes; model editing/insertion remain blocked until acceptance passes. |
| Standalone class XML | Java disk instruments (`ArrangementEditPanel`, `UserInstrumentLibrary`) and effects (`EffectsUtil`) directly load/save individual roots. [BlueShareRemoteCaller](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-ui-core/src/main/java/blue/tools/blueShare/BlueShareRemoteCaller.java) uses object dispatch for instrument and Effect loader for effect. They carry no project envelope. |
| TS library adapters | `packages/blue-app/src/main/unified-library/editor-adapters.ts` and `project-adapter.ts` call these direct class roots; acceptance completes before draft publication or history-backed insertion. Library payload outer-type/sentinel scanning is not full validation. |

All inventory rows need original synthetic fixture cases for current canonical input,
each accepted historical encoding/default, nested unknown attribute/child/value,
duplicate/alias conflicts, and save/reload. R-H01..07 run both standalone and embedded;
R-H08 additionally tests project reference expansion alongside other project migrations;
R-H09 tests order; R-H10 verifies declared recoveries and rejects unsupported old behavior.
Code whitespace, exported tree mutation, history identity restoration, widget/preset
duplication, and archive exact export are separate observations, not implied by round-trip.

## Evidence limits and licensing

This inventory makes bounded support decisions where complete release artifacts are
unavailable. It does not infer support for unknown polymorphic Java plugins, arbitrary
historical class renames, uppercase parameter-list typo, malformed numeric prefixes,
or partial BlueX7 arrays. Such forms reject/retain as diagnosed library archives until a
later explicit contract adds them. Historical unused embedded instrument-library content
is meaningful: rejecting its project is safer than claiming a successful migration that
discarded it. Implementation must make that outcome explicit in its reference-expansion
acceptance cases.

Only original research prose is added here. Inspected Java headers are GPL-2.0-or-later;
repository documentation is GPL-3.0-or-later and `@blue/data` implementation is MIT with
the package's separate Apache table notices. No Java source, translated implementation,
sample payload, lookup table, dependency, or external asset was incorporated. Implement
behavior originally within the existing package scope and use original synthetic XML;
any later copied historical artifact requires its own license/provenance review under
[LICENSING.md](../../LICENSING.md).


### Implementation evidence corrections (2026-10-02)

BlueX7 detune uses the signed -7..7 model domain confirmed by the existing parameter catalog,
Java operator editor and SysEx conversion; the earlier 0..14 table entry described its encoded
wire offset, not the canonical value. BSB current values/defaultValue remain finite typed numbers
and may lie outside editing min/max, as existing authored projects and history operations do.
Bounds remain ordered, and historical relative values are validated before conversion.
