# Serialization boundary inventory

**Date**: 2026-10-02  
**TypeScript baseline**: `e744ac08b865f4ce9c7f5863d8be433f227cbd67`  
**Method**: Production XML loader/writer/parse symbol scan plus reachable-owner/source reads.
Test/fixture/support files excluded; nested classes within a file use the same family matrix.

This inventory records owner/delegate locations, not an assertion that current loaders already
validate. Each family matrix supplies names, values, defaults, historical/output rules and
provenance; shared contracts supply the common grammar and explicit cross-family overrides.
Existing TS source/defaults at this baseline are explicit compatibility decisions, not invented
Java writer history. Fixtures are original synthetic cases to author from independent expectations.

## Root operations and host integration

| Root/path | Acceptance/publication contract |
| --- | --- |
| BlueData XML | Project envelope plus structural registry/shape migration, all nested owners and graph checks before returning complete candidate. |
| Instrument, Effect, SoundObject, UDO, Preset/PresetGroup | Shared class/subtree normalization at direct root, library, project and BlueShare-shaped boundary; no project-version prerequisite. |
| Public time/MIDI/parameter/line/processor primitives | Validate exact context/root/class fields using the same checks; no arbitrary new project root section. Standalone Code is distinct from registered chains. |
| User library and Code Repository envelopes | Strict wrapper/category grammar; resource support is full acceptance, source-span archive is a separate diagnosed outcome. Code Repository existing strict codec remains its owner. |
| App main/main.ts | Open/recent/example/revert/package verification all prepare complete accepted project before existing lifecycle/on-load. |
| App main/unified-library | Import/export-service, repository, editor-adapters/session-service, project-adapter revalidate full payloads and keep source/item transaction/revision fences. |
| App shared/score-object-file.ts, project-editor, renderer import/clipboard/store paths | Direct roots and payload reparsing use the same strict acceptance; preserve diagnostic reports instead of catch-all message loss. Durable commits retain history. |
| App preload/preload.ts, shared/unified-library.ts, renderer diagnostic surfaces | Plain typed contextual reports at existing channels. No model/Error/Element crosses IPC. |
| packages/blue-cli/src/cli.ts | Shared project acceptance; stderr reports; reject before runtime/output writes. |

## Data owner/delegate files

`P` = [project/time/live/MIDI/plugins](project-evidence.md).  
`R` = [resources/BSB/parameters/mixer/UDO](resource-evidence.md).  
`S` = [objects/layers/processors/JMask/libraries](sound-library-evidence.md).  
`C` = [shared loading grammar and supplements](contracts/xml-loading.md).

Listed interface/dispatch/caller files delegate to owners; they are not separate permissive
schemas. Owner-local base/subclass rules combine once. Dormant nested fields still validate.

| Production file under packages/blue-data/src | Evidence / role |
| --- | --- |
| [arrangement.ts](../../packages/blue-data/src/arrangement.ts) | R; concrete/shared resource owner or dispatch |
| [automation/parameter-id-list.ts](../../packages/blue-data/src/automation/parameter-id-list.ts) | R; concrete/shared resource owner or dispatch |
| [automation/parameter-list.ts](../../packages/blue-data/src/automation/parameter-list.ts) | R; concrete/shared resource owner or dispatch |
| [automation/parameter.ts](../../packages/blue-data/src/automation/parameter.ts) | R; concrete/shared resource owner or dispatch |
| [blue-data-object.ts](../../packages/blue-data/src/blue-data-object.ts) | C; interface/export or dispatch contract, delegates to concrete owner |
| [blue-data.ts](../../packages/blue-data/src/blue-data.ts) | P; project section or delegation boundary |
| [blue-data/xml-policy.ts](../../packages/blue-data/src/blue-data/xml-policy.ts) | P; project section or delegation boundary |
| [global-orc-sco.ts](../../packages/blue-data/src/global-orc-sco.ts) | P; project section or delegation boundary |
| [index.ts](../../packages/blue-data/src/index.ts) | C; interface/export or dispatch contract, delegates to concrete owner |
| [instruments/blue-synth-builder.ts](../../packages/blue-data/src/instruments/blue-synth-builder.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-check-box.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-check-box.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-dropdown.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-dropdown.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-file-selector.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-file-selector.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-graphic-interface.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-graphic-interface.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-group.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-group.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-hslider-bank.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-hslider-bank.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-hslider.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-hslider.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-knob.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-knob.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-label.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-label.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-line-object.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-line-object.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-subchannel-dropdown.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-subchannel-dropdown.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-text-field.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-text-field.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-value.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-value.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-vslider-bank.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-vslider-bank.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-vslider.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-vslider.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-widget.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-widget.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/bsb-xy-controller.ts](../../packages/blue-data/src/instruments/blue-synth-builder/bsb-xy-controller.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/preset-group.ts](../../packages/blue-data/src/instruments/blue-synth-builder/preset-group.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-synth-builder/preset.ts](../../packages/blue-data/src/instruments/blue-synth-builder/preset.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/blue-x7.ts](../../packages/blue-data/src/instruments/blue-x7.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/generic-instrument.ts](../../packages/blue-data/src/instruments/generic-instrument.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/instrument-assignment.ts](../../packages/blue-data/src/instruments/instrument-assignment.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/instrument-category.ts](../../packages/blue-data/src/instruments/instrument-category.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/instrument-library.ts](../../packages/blue-data/src/instruments/instrument-library.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/instrument-registry.ts](../../packages/blue-data/src/instruments/instrument-registry.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/instrument.ts](../../packages/blue-data/src/instruments/instrument.ts) | C; interface/export or dispatch contract, delegates to concrete owner |
| [instruments/javascript-instrument.ts](../../packages/blue-data/src/instruments/javascript-instrument.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/python-instrument.ts](../../packages/blue-data/src/instruments/python-instrument.ts) | R; concrete/shared resource owner or dispatch |
| [instruments/unknown-instrument.ts](../../packages/blue-data/src/instruments/unknown-instrument.ts) | R; concrete/shared resource owner or dispatch; raw fallback rejected in typed acceptance |
| [libraries/code-repository-codec.ts](../../packages/blue-data/src/libraries/code-repository-codec.ts) | S; concrete/nested owner or dispatch |
| [libraries/legacy-library-codec.ts](../../packages/blue-data/src/libraries/legacy-library-codec.ts) | S; concrete/nested owner or dispatch |
| [libraries/library-transfer.ts](../../packages/blue-data/src/libraries/library-transfer.ts) | S; concrete/nested owner or dispatch |
| [libraries/library-types.ts](../../packages/blue-data/src/libraries/library-types.ts) | S; concrete/nested owner or dispatch |
| [libraries/raw-xml-document.ts](../../packages/blue-data/src/libraries/raw-xml-document.ts) | S; concrete/nested owner or dispatch |
| [live-data.ts](../../packages/blue-data/src/live-data.ts) | P; project section or delegation boundary |
| [live/live-object-bins.ts](../../packages/blue-data/src/live/live-object-bins.ts) | P; project section or delegation boundary |
| [live/live-object-set-list.ts](../../packages/blue-data/src/live/live-object-set-list.ts) | P; project section or delegation boundary |
| [live/live-object-set.ts](../../packages/blue-data/src/live/live-object-set.ts) | P; project section or delegation boundary |
| [live/live-object.ts](../../packages/blue-data/src/live/live-object.ts) | P; project section or delegation boundary |
| [markers-list.ts](../../packages/blue-data/src/markers-list.ts) | P; project section or delegation boundary |
| [midi/midi-input-processor.ts](../../packages/blue-data/src/midi/midi-input-processor.ts) | P; project section or delegation boundary |
| [midi/midi-key-mapping.ts](../../packages/blue-data/src/midi/midi-key-mapping.ts) | P; project section or delegation boundary |
| [midi/midi-velocity-mapping.ts](../../packages/blue-data/src/midi/midi-velocity-mapping.ts) | P; project section or delegation boundary |
| [mixer/channel-list.ts](../../packages/blue-data/src/mixer/channel-list.ts) | R; concrete/shared resource owner or dispatch |
| [mixer/channel.ts](../../packages/blue-data/src/mixer/channel.ts) | R; concrete/shared resource owner or dispatch |
| [mixer/effect.ts](../../packages/blue-data/src/mixer/effect.ts) | R; concrete/shared resource owner or dispatch |
| [mixer/effects-chain.ts](../../packages/blue-data/src/mixer/effects-chain.ts) | R; concrete/shared resource owner or dispatch |
| [mixer/mixer.ts](../../packages/blue-data/src/mixer/mixer.ts) | R; concrete/shared resource owner or dispatch |
| [mixer/send.ts](../../packages/blue-data/src/mixer/send.ts) | R; concrete/shared resource owner or dispatch |
| [note-processors/add-processor.ts](../../packages/blue-data/src/note-processors/add-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/code.ts](../../packages/blue-data/src/note-processors/code.ts) | S; concrete/nested owner or dispatch |
| [note-processors/equals-processor.ts](../../packages/blue-data/src/note-processors/equals-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/inversion-processor.ts](../../packages/blue-data/src/note-processors/inversion-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/line-add-processor.ts](../../packages/blue-data/src/note-processors/line-add-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/line-multiply-processor.ts](../../packages/blue-data/src/note-processors/line-multiply-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/multiply-processor.ts](../../packages/blue-data/src/note-processors/multiply-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/note-processor-chain-map.ts](../../packages/blue-data/src/note-processors/note-processor-chain-map.ts) | S; concrete/nested owner or dispatch |
| [note-processors/note-processor-chain.ts](../../packages/blue-data/src/note-processors/note-processor-chain.ts) | S; concrete/nested owner or dispatch |
| [note-processors/note-processor-snapshot.ts](../../packages/blue-data/src/note-processors/note-processor-snapshot.ts) | S; concrete/nested owner or dispatch |
| [note-processors/note-processor.ts](../../packages/blue-data/src/note-processors/note-processor.ts) | C; interface/export or dispatch contract, delegates to concrete owner |
| [note-processors/pch-add-processor.ts](../../packages/blue-data/src/note-processors/pch-add-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/pch-inversion-processor.ts](../../packages/blue-data/src/note-processors/pch-inversion-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/python-processor.ts](../../packages/blue-data/src/note-processors/python-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/random-add-processor.ts](../../packages/blue-data/src/note-processors/random-add-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/random-multiply-processor.ts](../../packages/blue-data/src/note-processors/random-multiply-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/retrograde-processor.ts](../../packages/blue-data/src/note-processors/retrograde-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/rotate-processor.ts](../../packages/blue-data/src/note-processors/rotate-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/sublist-processor.ts](../../packages/blue-data/src/note-processors/sublist-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/switch-processor.ts](../../packages/blue-data/src/note-processors/switch-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/time-warp-processor.ts](../../packages/blue-data/src/note-processors/time-warp-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/tuning-processor.ts](../../packages/blue-data/src/note-processors/tuning-processor.ts) | S; concrete/nested owner or dispatch |
| [note-processors/unsupported-processor.ts](../../packages/blue-data/src/note-processors/unsupported-processor.ts) | S; concrete/nested owner or dispatch; raw fallback rejected in typed acceptance |
| [opcodes/opcode-definition.ts](../../packages/blue-data/src/opcodes/opcode-definition.ts) | R; concrete/shared resource owner or dispatch |
| [opcodes/opcode-list.ts](../../packages/blue-data/src/opcodes/opcode-list.ts) | R; concrete/shared resource owner or dispatch |
| [plugins/clojure-project-data.ts](../../packages/blue-data/src/plugins/clojure-project-data.ts) | P; project section or delegation boundary |
| [project-properties.ts](../../packages/blue-data/src/project-properties.ts) | P; project section or delegation boundary |
| [score/audio/audio-clip.ts](../../packages/blue-data/src/score/audio/audio-clip.ts) | S; concrete/nested owner or dispatch |
| [score/layers/layer-group.ts](../../packages/blue-data/src/score/layers/layer-group.ts) | C; interface/export or dispatch contract, delegates to concrete owner |
| [score/patterns/pattern-data.ts](../../packages/blue-data/src/score/patterns/pattern-data.ts) | S; concrete/nested owner or dispatch |
| [score/patterns/pattern-layer.ts](../../packages/blue-data/src/score/patterns/pattern-layer.ts) | S; concrete/nested owner or dispatch |
| [score/patterns/patterns-layer-group.ts](../../packages/blue-data/src/score/patterns/patterns-layer-group.ts) | S; concrete/nested owner or dispatch |
| [score/score.ts](../../packages/blue-data/src/score/score.ts) | P; project section or delegation boundary |
| [score/track/track-layer-group.ts](../../packages/blue-data/src/score/track/track-layer-group.ts) | S; concrete/nested owner or dispatch |
| [score/track/track.ts](../../packages/blue-data/src/score/track/track.ts) | S; concrete/nested owner or dispatch |
| [scratch-pad-data.ts](../../packages/blue-data/src/scratch-pad-data.ts) | P; project section or delegation boundary |
| [serialization/xml-reader.ts](../../packages/blue-data/src/serialization/xml-reader.ts) | C; shared parser/check or existing caller |
| [sound-objects/abstract-sound-object.ts](../../packages/blue-data/src/sound-objects/abstract-sound-object.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/audio-file.ts](../../packages/blue-data/src/sound-objects/audio-file.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/clojure-object.ts](../../packages/blue-data/src/sound-objects/clojure-object.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/comment.ts](../../packages/blue-data/src/sound-objects/comment.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/csd-sound-object.ts](../../packages/blue-data/src/sound-objects/csd-sound-object.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/external.ts](../../packages/blue-data/src/sound-objects/external.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/frozen-sound-object.ts](../../packages/blue-data/src/sound-objects/frozen-sound-object.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/generic-score.ts](../../packages/blue-data/src/sound-objects/generic-score.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/instance.ts](../../packages/blue-data/src/sound-objects/instance.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/j-mask.ts](../../packages/blue-data/src/sound-objects/j-mask.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/javascript-object.ts](../../packages/blue-data/src/sound-objects/javascript-object.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/jmask-support.ts](../../packages/blue-data/src/sound-objects/jmask-support.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/line-object.ts](../../packages/blue-data/src/sound-objects/line-object.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/object-builder.ts](../../packages/blue-data/src/sound-objects/object-builder.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/pattern-object.ts](../../packages/blue-data/src/sound-objects/pattern-object.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/pattern/pattern.ts](../../packages/blue-data/src/sound-objects/pattern/pattern.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/piano-roll.ts](../../packages/blue-data/src/sound-objects/piano-roll.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/piano-roll/field-def.ts](../../packages/blue-data/src/sound-objects/piano-roll/field-def.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/piano-roll/field.ts](../../packages/blue-data/src/sound-objects/piano-roll/field.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/piano-roll/piano-note.ts](../../packages/blue-data/src/sound-objects/piano-roll/piano-note.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/piano-roll/scale.ts](../../packages/blue-data/src/sound-objects/piano-roll/scale.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/poly-object.ts](../../packages/blue-data/src/sound-objects/poly-object.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/python-object.ts](../../packages/blue-data/src/sound-objects/python-object.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/register-sound-object-types.ts](../../packages/blue-data/src/sound-objects/register-sound-object-types.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/sound-layer.ts](../../packages/blue-data/src/sound-objects/sound-layer.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/sound-object-library.ts](../../packages/blue-data/src/sound-objects/sound-object-library.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/sound-object-registry.ts](../../packages/blue-data/src/sound-objects/sound-object-registry.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/sound-object-utilities.ts](../../packages/blue-data/src/sound-objects/sound-object-utilities.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/sound-object.ts](../../packages/blue-data/src/sound-objects/sound-object.ts) | C; interface/export or dispatch contract, delegates to concrete owner |
| [sound-objects/sound.ts](../../packages/blue-data/src/sound-objects/sound.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/tracker-object.ts](../../packages/blue-data/src/sound-objects/tracker-object.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/tracker/column.ts](../../packages/blue-data/src/sound-objects/tracker/column.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/tracker/track-list.ts](../../packages/blue-data/src/sound-objects/tracker/track-list.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/tracker/track.ts](../../packages/blue-data/src/sound-objects/tracker/track.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/tracker/tracker-note.ts](../../packages/blue-data/src/sound-objects/tracker/tracker-note.ts) | S; concrete/nested owner or dispatch |
| [sound-objects/zak-line-object.ts](../../packages/blue-data/src/sound-objects/zak-line-object.ts) | S; concrete/nested owner or dispatch |
| [tables.ts](../../packages/blue-data/src/tables.ts) | P; project section or delegation boundary |
| [time/measure-meter-pair.ts](../../packages/blue-data/src/time/measure-meter-pair.ts) | P; shared time owner |
| [time/meter-map.ts](../../packages/blue-data/src/time/meter-map.ts) | P; shared time owner |
| [time/meter.ts](../../packages/blue-data/src/time/meter.ts) | P; shared time owner |
| [time/tempo-map.ts](../../packages/blue-data/src/time/tempo-map.ts) | P; shared time owner |
| [time/tempo-point.ts](../../packages/blue-data/src/time/tempo-point.ts) | P; shared time owner |
| [time/time-context.ts](../../packages/blue-data/src/time/time-context.ts) | P; shared time owner |
| [time/time-duration.ts](../../packages/blue-data/src/time/time-duration.ts) | C; TimeDuration supplement |
| [time/time-position.ts](../../packages/blue-data/src/time/time-position.ts) | P; shared time owner |
| [time/time-state.ts](../../packages/blue-data/src/time/time-state.ts) | P; shared time owner |
| [utilities/freeze-render-data.ts](../../packages/blue-data/src/utilities/freeze-render-data.ts) | C; shared parser/check or existing caller |

Scan coverage: **143 production files**, including interfaces/dispatch/callers and explicit
reachable additions. This is a finite baseline inventory, not a new runtime discovery mechanism.
Shared JMask nested owners are enumerated within jmask-support.ts in S; grid/font/dropdown/BlueX7
nested owners reside in resource files and are enumerated in R. TimeDuration details are in C.
Migration source files/ordering are in [migration contract](contracts/migration-and-publication.md)
and P/R/S historical tables; library-transfer/types add transaction/source context, not extra schemas.

## Fixture and evidence gate

Every concrete matrix row uses these original synthetic observations before implementation closes:
current canonical state/output; each listed historical form/default; root/nested unexpected attrs/
children; invalid known value; duplicate/conflict; composition/reapplication; copy/export ownership;
applicable standalone/embedded equivalence and history. The matrix IDs P-*, R-H*, SL-H* identify
focused historical cases and verified-source/support decisions. Fixture manifests record actual
new author/file/revision at implementation; no external fixture or source incorporation is assumed.

The evidence gate is complete as a design inventory with bounded support decisions. Creation of
fixtures and executable proof remains subsequent implementation work. A newly discovered emitted
form must update its owner record and support/output decision before coding; it does not become
accepted through a catch-all. Unknown names/values without a listed decision reject by default.


## Direct-root convergence verification (T054)

`serialization/xml-owner-root-contract.test.ts` explicitly lists 145 acceptance entry points:
all inventoried public static model loaders, concrete BSB instance loaders, BSB font/interface
loaders, and instrument/SoundObject/BSB/JMask dispatch wrappers. The list includes explicit
reference-map, Live bins, PianoRoll field-definition, and arrangement-library arguments. Valid
current inputs are renamed before rejection checks; the newly guarded owners use populated,
original synthetic XML. Each owner reopens canonical output, with SoundLayer output owned by
PolyObject. Existing family diagnostic categories are retained and compared between direct and
report calls; the new checkRoot guards require contextual root/#root diagnostics before content
validation, including indexed nested paths and unchanged Windows source labels.

TimePosition and TimeDuration are intentionally caller-named primitives, covered separately with
startTime/subjectiveDuration roots. BlueData is the project report boundary, covered by xml-policy
and project migration suites. The remaining inventory rows are interfaces, base/common helpers,
nested grammar delegated by these owners (including BSB grid/font/bank items and BlueX7 arrays),
XML utilities, migration/codec/publication boundaries, or archive-only placeholders. Their owner
family suites remain required; they are not additional permissive model roots. UnsupportedProcessor
and removed unknown-instrument fallbacks are excluded from accepted model dispatch; existing
resource/chain/library suites verify rejection or separate diagnosed archiving.

The reconciliation exposed SoundLayer in addition to the 17 owners enumerated in T054. Its direct
loader now checks the Java-written soundLayer root before reading content. The Java writer was
consulted read-only at the research snapshot revision in SoundLayer.java, alongside the recorded
Arrangement/instrument/Live/time/audio/library/Clojure writers. MIDI mappings retain the explicit
TypeScript public-root decisions in project-evidence.md. This adds only original MIT-scope code
and synthetic test inputs, using the existing checkRoot helper; no Java source, external fixtures,
assets, or dependencies were incorporated.
