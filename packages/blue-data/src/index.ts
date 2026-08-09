// ─── Core ───
export { BlueData } from './blue-data';
export type { BlueDataObject, BlueDataObjectStatic } from './blue-data-object';
export type { DeepCopyable } from './deep-copyable';
export { BLUE_VERSION } from './blue-constants';
export { CompileData } from './compile-data';
export type { CompiledMidiInstrumentTarget } from './compile-data';
export {
	getJavaRuntimeClient,
	setJavaRuntimeClient,
} from './java-runtime';
export type {
	ClojureEvalRequest,
	ClojureEvalResult,
	ClojureReinitializeResult,
	ClojureScoreObjectEvalRequest,
	ClojureScoreObjectEvalResult,
	JavaRuntimeClientContract,
	JavaRuntimeDependencyLoadResult,
	JavaRuntimeDependencySpec,
	JavaRuntimeError,
	JavaRuntimeHealthResult,
	JavaRuntimeSessionInitRequest,
	JavaRuntimeSessionInitResult,
	JythonEvalScriptRequest,
	JythonEvalScriptResult,
	JythonImportCheckRequest,
	JythonImportCheckResult,
	JythonInstrumentEvalRequest,
	JythonInstrumentEvalResult,
	JythonObjectBuilderEvalRequest,
	JythonObjectBuilderEvalResult,
	JythonProcessNoteListRequest,
	JythonProcessNoteListResult,
	JythonReinitializeResult,
	JythonScoreObjectEvalRequest,
	JythonScoreObjectEvalResult,
	JythonSerializedNote,
	JavaRuntimeResponse,
	JavaRuntimeStatus,
} from './java-runtime';
export {
	disposeJavaScriptCompileState,
	initializeJavaScriptRuntime,
	isJavaScriptRuntimeInitialized,
	JavaScriptSession,
	setJavaScriptSession,
	getJavaScriptSession,
} from './javascript-runtime';
export { setCopy as setCopyBuffer, getCopy as getCopyBuffer, hasContent as hasClipboardContent, clear as clearClipboard } from './copy-buffer';

// ─── Arrangement ───
export { Arrangement } from './arrangement';

// ─── Instruments ───
export { Instrument } from './instruments/instrument';
export { GenericInstrument } from './instruments/generic-instrument';
export { loadInstrumentFromXML, registerInstrumentType } from './instruments/instrument-registry';
export { JavaScriptInstrument } from './instruments/javascript-instrument';
export { PythonInstrument } from './instruments/python-instrument';
export { BlueX7 } from './instruments/blue-x7';
export { BlueSynthBuilder } from './instruments/blue-synth-builder';
export { BSBGroup } from './instruments/blue-synth-builder/bsb-group';
export { BSBWidget } from './instruments/blue-synth-builder/bsb-widget';
export { BSBHSlider } from './instruments/blue-synth-builder/bsb-hslider';
export { BSBVSlider } from './instruments/blue-synth-builder/bsb-vslider';
export { BSBKnob } from './instruments/blue-synth-builder/bsb-knob';
export { BSBCheckBox } from './instruments/blue-synth-builder/bsb-check-box';
export { BSBLabel } from './instruments/blue-synth-builder/bsb-label';
export { BSBDropdown } from './instruments/blue-synth-builder/bsb-dropdown';
export { BSBXYController } from './instruments/blue-synth-builder/bsb-xy-controller';
export { BSBValue } from './instruments/blue-synth-builder/bsb-value';
export { BSBTextField } from './instruments/blue-synth-builder/bsb-text-field';
export { BSBFileSelector } from './instruments/blue-synth-builder/bsb-file-selector';
export { BSBHSliderBank } from './instruments/blue-synth-builder/bsb-hslider-bank';
export { BSBVSliderBank } from './instruments/blue-synth-builder/bsb-vslider-bank';
export { PresetGroup } from './instruments/blue-synth-builder/preset-group';
export { Preset } from './instruments/blue-synth-builder/preset';
export { InstrumentAssignment } from './instruments/instrument-assignment';
export { InstrumentLibrary } from './instruments/instrument-library';

// ─── Project ───
export { ProjectProperties } from './project-properties';
export { GlobalOrcSco } from './global-orc-sco';
export { Tables } from './tables';
export { LiveData } from './live-data';
export { ScratchPadData } from './scratch-pad-data';
export { MarkersList } from './markers-list';

// ─── Time ───
export { TimeBase } from './time/time-base';
export { SmpteFrameRate } from './time/smpte-frame-rate';
export { TimePosition } from './time/time-position';
export { TimeDuration } from './time/time-duration';
export { TempoMap } from './time/tempo-map';
export { TempoPoint } from './time/tempo-point';
export { CurveType, parseCurveType } from './time/curve-type';
export { TimeContext } from './time/time-context';
export { TimeState } from './time/time-state';
export { MeterMap } from './time/meter-map';
export { MeasureMeterPair } from './time/measure-meter-pair';
export { Meter } from './time/meter';
export { beatsToTimePosition, timePositionToBeats, convertTimePosition, secondsToTimePosition, timePositionToSeconds, framesToTimePosition, timePositionToFrames } from './time/time-utilities';
export { beatsToDuration } from './time/time-unit-math';
export { ALL_SNAP_VALUES, getSnapValue, isValidSnapValueName, snapValueToBeats, closestSnapValueMatch } from './time/snap-value';
export type { SnapValueName, SnapCategory, SnapValueDefinition } from './time/snap-value';

// ─── Score ───
export { Score } from './score/score';
export { replaceTrackInstrumentP1, applyTrackInstrumentOverride } from './score/score-generation-options';
export type { ScoreGenerationOptions, InstrumentTargetCollector, InstrumentTargetBehavior, ScoreGenerationOptionsOrSolo } from './score/score-generation-options';
export type { ScoreObject } from './score/score-object';
export { ScoreObjectEvent, ScoreEventType } from './score/score-object-event';
export type { ScoreObjectListener } from './score/score-object-event';
export { ScoreGenerationException } from './score/score-generation-exception';

// ─── Score Layers ───
export type { Layer } from './score/layers/layer';
export { LAYER_HEIGHT } from './score/layers/layer';
export type { LayerGroup } from './score/layers/layer-group';
export type { ScoreObjectLayer } from './score/layers/score-object-layer';
export type { ScoreObjectLayerGroup } from './score/layers/score-object-layer-group';
export type { AutomatableLayer } from './score/layers/automatable-layer';
export type { AutomatableLayerGroup } from './score/layers/automatable-layer-group';
export type { LayerGroupProvider } from './score/layers/layer-group-provider';
export { LayerGroupProviderManager } from './score/layers/layer-group-provider-manager';
export { LayerGroupDataEvent, LayerGroupDataEventType } from './score/layers/layer-group-data-event';
export type { LayerGroupListener } from './score/layers/layer-group-listener';
export type { DeepCopyableLG } from './score/layers/deep-copyable-lg';

// ─── Audio Score Layers ───
export { AudioClip } from './score/audio/audio-clip';
// The tracker sound object already owns the public `Track` name. Keep that
// API stable while exposing the score-layer model under an unambiguous alias.
export { Track as TrackLayer } from './score/track/track';
export { Track as ScoreTrack } from './score/track/track';
export type { TrackItem } from './score/track/track';
export { TrackLayerGroup } from './score/track/track-layer-group';
export { TrackLayerGroupProvider } from './score/track/track-layer-group-provider';
export { generateTrackAudioPlaybackNotes, ensureTrackAudioPlaybackInstrument } from './score/track/track-audio-playback';
export { FadeType, fadeTypeFromString, fadeTypeToString, fadeTypeToCsound } from './score/audio/fade-type';
export { PLAYBACK_INSTRUMENT_ORC } from './score/audio/playback-instrument-orc';
export { BLUE_FADE_UDO } from './score/audio/blue-fade-udo';

// ─── Pattern Score Layers ───
export { PatternData } from './score/patterns/pattern-data';
export { PatternLayer } from './score/patterns/pattern-layer';
export { PatternsLayerGroup } from './score/patterns/patterns-layer-group';
export { PatternsLayerGroupProvider } from './score/patterns/patterns-layer-group-provider';

// ─── Sound Objects ───
// ─── Sound Objects ───
export type { SoundObject, SoundObjectStatic } from './sound-objects/sound-object';
export { AbstractSoundObject } from './sound-objects/abstract-sound-object';
export { TimeBehavior } from './sound-objects/time-behavior';
export { SoundObjectException } from './sound-objects/sound-object-exception';
export { Note } from './sound-objects/note';
export { NoteList } from './sound-objects/note-list';
export { GenericScore } from './sound-objects/generic-score';
export { PolyObject } from './sound-objects/poly-object';
export { SoundLayer } from './sound-objects/sound-layer';
export { PolyObjectLayerGroupProvider } from './sound-objects/poly-object-layer-group-provider';
export { SoundObjectLibrary, collectInstanceSoundObjects } from './sound-objects/sound-object-library';
export { PythonObject } from './sound-objects/python-object';
export { ObjectBuilder } from './sound-objects/object-builder';
export type { ObjectBuilderLanguageType } from './sound-objects/object-builder';
export { ClojureObject } from './sound-objects/clojure-object';
export { JavaScriptObject } from './sound-objects/javascript-object';
export { CSDSoundObject } from './sound-objects/csd-sound-object';
export { Comment } from './sound-objects/comment';
export { AudioFile } from './sound-objects/audio-file';
export { Sound } from './sound-objects/sound';
export { External, setExternalCommandExecutor, getExternalCommandExecutor } from './sound-objects/external';
export type { ExternalCommandExecutor } from './sound-objects/external';
export { Instance } from './sound-objects/instance';
export { LineObject } from './sound-objects/line-object';
export type { LineData, LinePoint } from './sound-objects/line-object';
export { ZakLineObject } from './sound-objects/zak-line-object';
export type { ZakLineData, ZakLinePoint } from './sound-objects/zak-line-object';
export { PatternObject } from './sound-objects/pattern-object';
export { Pattern } from './sound-objects/pattern/pattern';
export { PianoRoll } from './sound-objects/piano-roll';
export { PianoNote } from './sound-objects/piano-roll/piano-note';
export { Scale } from './sound-objects/piano-roll/scale';
export { FieldDef } from './sound-objects/piano-roll/field-def';
export { FieldType } from './sound-objects/piano-roll/field-type';
export { JMask } from './sound-objects/j-mask';
export { loadFieldFromSnapshot } from './sound-objects/jmask-support';
export { TrackerObject } from './sound-objects/tracker-object';
export { TrackList } from './sound-objects/tracker/track-list';
export { Track } from './sound-objects/tracker/track';
export { Column } from './sound-objects/tracker/column';
export { TrackerNote } from './sound-objects/tracker/tracker-note';
export { FrozenSoundObject } from './sound-objects/frozen-sound-object';
export {
  loadSoundObjectFromXML,
  registerSoundObjectType,
  registerSoundObjectFactory,
  createSoundObject,
  getSoundObjectTypeDescriptor,
  getAllSoundObjectTypeDescriptors,
  getTrackPlacementForSoundObject,
  getTrackPlacementForSoundObjectType,
} from './sound-objects/sound-object-registry';
export type {
  SoundObjectTypeDescriptor,
  TrackPlacement,
} from './sound-objects/sound-object-registry';

// ─── Note Processors ───
export { NoteProcessorChain } from './note-processors/note-processor-chain';
export { NoteProcessorChainMap } from './note-processors/note-processor-chain-map';
export { NoteProcessor } from './note-processors/note-processor';
export { NoteProcessorException } from './note-processors/note-processor-exception';
export { AddProcessor } from './note-processors/add-processor';
export { MultiplyProcessor } from './note-processors/multiply-processor';
export { Code } from './note-processors/code';
export { PythonProcessor } from './note-processors/python-processor';
export { RandomAddProcessor } from './note-processors/random-add-processor';
export { RandomMultiplyProcessor } from './note-processors/random-multiply-processor';
export { LineAddProcessor } from './note-processors/line-add-processor';
export { LineMultiplyProcessor } from './note-processors/line-multiply-processor';
export { PchAddProcessor } from './note-processors/pch-add-processor';
export { PchInversionProcessor } from './note-processors/pch-inversion-processor';
export { InversionProcessor } from './note-processors/inversion-processor';
export { RetrogradeProcessor } from './note-processors/retrograde-processor';
export { RotateProcessor } from './note-processors/rotate-processor';
export { TimeWarpProcessor } from './note-processors/time-warp-processor';
export { TuningProcessor } from './note-processors/tuning-processor';
export { SwitchProcessor } from './note-processors/switch-processor';
export { SubListProcessor } from './note-processors/sublist-processor';
export { EqualsProcessor } from './note-processors/equals-processor';
export { ValueTimeMapper } from './note-processors/value-time-mapper';
export { getNoteProcessorCatalog, getNoteProcessorDefinition, isAddableProcessor } from './note-processors/note-processor-catalog';
export type { NoteProcessorDefinition, NoteProcessorParameterDefinition, ParameterValueType } from './note-processors/note-processor-catalog';
export { createNoteProcessorEntrySnapshot, createNoteProcessorChainSnapshot, reifyProcessorFromSnapshot, reifyChainFromSnapshot, resetSnapshotIdCounter } from './note-processors/note-processor-snapshot';
export type { NoteProcessorEntrySnapshot, NoteProcessorChainSnapshot } from './note-processors/note-processor-snapshot';

// ─── Mixer ───
export { Mixer } from './mixer/mixer';
export { Channel } from './mixer/channel';
export { ChannelList } from './mixer/channel-list';
export { Effect } from './mixer/effect';
export { EffectManager } from './mixer/effect-manager';
export { EffectsChain } from './mixer/effects-chain';
export { Send } from './mixer/send';
export { MixerNode } from './mixer/mixer-node';

// ─── Automation ───
export { Parameter } from './automation/parameter';
export type { AutomationPoint } from './automation/parameter';
export { AutomationCurve } from './automation/parameter';
export { automationPointToEngineSeconds, getEngineAutomationPoints } from './automation/parameter-runtime';
export { ParameterList } from './automation/parameter-list';
export { ParameterIdList } from './automation/parameter-id-list';
export { ParameterNameManager } from './automation/parameter-name-manager';
export { ParameterTimeManager } from './automation/parameter-time-manager';
export { ParameterHelper } from './automation/parameter-helper';
export type { Automatable } from './automation/automatable';
export type { AutomatableCollectionListener } from './automation/automatable-collection-listener';
export { LineColors } from './automation/line-colors';

// ─── Live ───
export { LiveObject } from './live/live-object';
export { LiveObjectSet } from './live/live-object-set';
export { LiveObjectBins } from './live/live-object-bins';
export { LiveObjectSetList } from './live/live-object-set-list';
export {
	prepareTriggerBatch,
	resolveTriggerTargets,
	scaleNotesByTempo,
	computeTempoScale,
} from './live/blue-live-trigger';
export type {
	TriggerPreparationResult,
	PreparedScoreBatch,
	TriggerEmptyResult,
	TriggerPreparationFailure,
	TriggerPreparationFailureCode,
	TriggerRuntimeContext,
	TriggerMode,
} from './live/blue-live-trigger';
// Shared Java-parity trigger fixtures (test oracles; safe for production import).
export {
	createModernLiveData,
	createModernProject,
	createOldFormatLiveData,
	createSparseGridLiveData,
	createMissingSavedSetIdLiveData,
	createMultiEnabledLiveData,
	createLibraryInstanceLiveData,
	createRuntimeBackedLiveData,
	createGenericScoreSoundObject,
	attachSavedSet,
	MODERN_ENABLED_TARGET_ORDER,
	MODERN_ALL_POPULATED_TARGET_ORDER,
	OLD_FORMAT_ENABLED_TARGET_ORDER,
	SPARSE_GRID_ENABLED_TARGET_ORDER,
	MULTI_ENABLED_TARGET_ORDER,
	TEMPO_SCALING_CASES,
	INVALID_TEMPO_VALUES,
} from './live/blue-live-trigger-fixtures';
export type {
	ExpectedLiveObjectTarget,
	ExpectedScalingCase,
	LibraryInstanceFixture,
	RuntimeBackedFixture,
} from './live/blue-live-trigger-fixtures';

// ─── MIDI ───
export { MidiInputProcessor } from './midi/midi-input-processor';
export { MidiKeyMapping } from './midi/midi-key-mapping';
export { MidiVelocityMapping } from './midi/midi-velocity-mapping';
export { mapMidiTrigger } from './midi/midi-trigger-routing';
export type { MidiTriggerMappingInput, MidiTriggerMappingResult } from './midi/midi-trigger-routing';

// ─── Opcodes ───
export { OpcodeDefinition } from './opcodes/opcode-definition';
export { OpcodeList } from './opcodes/opcode-list';
export { UDOStyle } from './opcodes/udo-style';
export { convertToModern, convertToClassic, parseUDOText } from './opcodes/udo-utilities';
export { normalizeUdoCallableSignature } from './opcodes/udo-type-utils';
export type {
  UdoCallableSignatureInput,
  NormalizedUdoCallableSignature,
} from './opcodes/udo-type-utils';

// ─── Serialization ───
export { Element, Elements } from './serialization/xml-reader';
export { ObjRefSaveMap, ObjRefLoadMap } from './serialization/obj-ref-map';
export * from './libraries';
export {
	CLOJURE_PROJECT_DATA_BDO_TYPE,
	ClojureLibraryEntry,
	ClojureProjectData,
	findClojureProjectDataElement,
	loadClojureProjectDataFromPluginData,
	replaceClojureProjectDataInPluginData,
} from './plugins/clojure-project-data';

// ─── Migration ───
export { ProjectVersion } from './migration/project-version';
export { ProjectUpgrader } from './migration/upgrader';
export { UpgradeManager } from './migration/upgrade-manager';
export { ProjectUpgrader_2_1_10 } from './migration/upgrades/upgrade-2.1.10';
export { ProjectUpgrader_2_3_0 } from './migration/upgrades/upgrade-2.3.0';

// ─── Utilities ───
export { replaceAll, stripSingleLineComments, stripBlockComments } from './utilities/text';
export { writeInt, readInt, writeDouble, readDouble, writeBoolean, readBoolean } from './utilities/xml';
export { applyNoteProcessorChain, setScoreStart, getNotes, getTotalDuration } from './utilities/score';
export {
  CSDImportMode,
  convertCSDtoBlue,
  convertOrcScoToBlue,
  getTextBetweenTags,
  parseCsOrc,
  parseCsScore,
} from './utilities/csd-utility';
export { buildFreezeRenderData } from './utilities/freeze-render-data';
export type { FreezeRenderDataResult } from './utilities/freeze-render-data';

// ─── Audio ───
export { parseAudioFileMetadata, AudioFileMetadataError } from './audio/audio-file-metadata';
export type { AudioFileMetadata } from './audio/audio-file-metadata';
export { buildWavBytes, buildAiffBytes } from './audio/audio-file-metadata';
