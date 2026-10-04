import { BSBCheckBox } from '../instruments/blue-synth-builder/bsb-check-box';
import { BSBDropdown } from '../instruments/blue-synth-builder/bsb-dropdown';
import { BSBFileSelector } from '../instruments/blue-synth-builder/bsb-file-selector';
import { BSBGraphicInterface } from '../instruments/blue-synth-builder/bsb-graphic-interface';
import { BSBGroup } from '../instruments/blue-synth-builder/bsb-group';
import { BSBHSliderBank } from '../instruments/blue-synth-builder/bsb-hslider-bank';
import { BSBHSlider } from '../instruments/blue-synth-builder/bsb-hslider';
import { BSBKnob } from '../instruments/blue-synth-builder/bsb-knob';
import { BSBLabel } from '../instruments/blue-synth-builder/bsb-label';
import { BSBLineObject } from '../instruments/blue-synth-builder/bsb-line-object';
import { BSBSubChannelDropdown } from '../instruments/blue-synth-builder/bsb-subchannel-dropdown';
import { BSBTextField } from '../instruments/blue-synth-builder/bsb-text-field';
import { BSBValue } from '../instruments/blue-synth-builder/bsb-value';
import { BSBVSliderBank } from '../instruments/blue-synth-builder/bsb-vslider-bank';
import { BSBVSlider } from '../instruments/blue-synth-builder/bsb-vslider';
import { BSBXYController } from '../instruments/blue-synth-builder/bsb-xy-controller';
import {
  saveBsbWidgetAsXML,
  loadBsbWidgetFromXML,
} from '../instruments/blue-synth-builder/bsb-group';
import { BSBWidget } from '../instruments/blue-synth-builder/bsb-widget';
import {
  loadFontFromXML,
  saveFontToXML,
  type BSBFont,
} from '../instruments/blue-synth-builder/bsb-knob';
import { loadInstrumentFromXML } from '../instruments/instrument-registry';
import { loadSoundObjectFromXML } from '../sound-objects/sound-object-registry';
import {
  loadGeneratorFromXML,
  loadProbabilityGeneratorFromXML,
} from '../sound-objects/jmask-support';
import { ParameterIdList } from '../automation/parameter-id-list';
import { ParameterList } from '../automation/parameter-list';
import { Parameter } from '../automation/parameter';
import { PresetGroup } from '../instruments/blue-synth-builder/preset-group';
import { Preset } from '../instruments/blue-synth-builder/preset';
import { BlueSynthBuilder } from '../instruments/blue-synth-builder';
import { BlueX7 } from '../instruments/blue-x7';
import { GenericInstrument } from '../instruments/generic-instrument';
import { JavaScriptInstrument } from '../instruments/javascript-instrument';
import { PythonInstrument } from '../instruments/python-instrument';
import { ChannelList } from '../mixer/channel-list';
import { Channel } from '../mixer/channel';
import { Effect } from '../mixer/effect';
import { EffectsChain } from '../mixer/effects-chain';
import { Mixer } from '../mixer/mixer';
import { Send } from '../mixer/send';
import { AddProcessor } from '../note-processors/add-processor';
import { Code } from '../note-processors/code';
import { EqualsProcessor } from '../note-processors/equals-processor';
import { InversionProcessor } from '../note-processors/inversion-processor';
import { LineAddProcessor } from '../note-processors/line-add-processor';
import { LineMultiplyProcessor } from '../note-processors/line-multiply-processor';
import { MultiplyProcessor } from '../note-processors/multiply-processor';
import { NoteProcessorChainMap } from '../note-processors/note-processor-chain-map';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { PchAddProcessor } from '../note-processors/pch-add-processor';
import { PchInversionProcessor } from '../note-processors/pch-inversion-processor';
import { PythonProcessor } from '../note-processors/python-processor';
import { RandomAddProcessor } from '../note-processors/random-add-processor';
import { RandomMultiplyProcessor } from '../note-processors/random-multiply-processor';
import { RetrogradeProcessor } from '../note-processors/retrograde-processor';
import { RotateProcessor } from '../note-processors/rotate-processor';
import { SubListProcessor } from '../note-processors/sublist-processor';
import { SwitchProcessor } from '../note-processors/switch-processor';
import { TimeWarpProcessor } from '../note-processors/time-warp-processor';
import { TuningProcessor } from '../note-processors/tuning-processor';
import { OpcodeDefinition } from '../opcodes/opcode-definition';
import { ClojureProjectData } from '../plugins/clojure-project-data';
import { AudioFile } from '../sound-objects/audio-file';
import { Comment } from '../sound-objects/comment';
import { CSDSoundObject } from '../sound-objects/csd-sound-object';
import { External } from '../sound-objects/external';
import { GenericScore } from '../sound-objects/generic-score';
import { Instance } from '../sound-objects/instance';
import { JMask } from '../sound-objects/j-mask';
import { JavaScriptObject } from '../sound-objects/javascript-object';
import { TablePoint as JmaskTablePoint } from '../sound-objects/jmask-support';
import { Table as JmaskTable } from '../sound-objects/jmask-support';
import { Mask as JmaskMask } from '../sound-objects/jmask-support';
import { Quantizer as JmaskQuantizer } from '../sound-objects/jmask-support';
import { Accumulator as JmaskAccumulator } from '../sound-objects/jmask-support';
import { Constant as JmaskConstant } from '../sound-objects/jmask-support';
import { Random as JmaskRandom } from '../sound-objects/jmask-support';
import { Oscillator as JmaskOscillator } from '../sound-objects/jmask-support';
import { Segment as JmaskSegment } from '../sound-objects/jmask-support';
import { ItemList as JmaskItemList } from '../sound-objects/jmask-support';
import { Uniform as JmaskUniform } from '../sound-objects/jmask-support';
import { Triangle as JmaskTriangle } from '../sound-objects/jmask-support';
import { Linear as JmaskLinear } from '../sound-objects/jmask-support';
import { Exponential as JmaskExponential } from '../sound-objects/jmask-support';
import { Gaussian as JmaskGaussian } from '../sound-objects/jmask-support';
import { Cauchy as JmaskCauchy } from '../sound-objects/jmask-support';
import { Beta as JmaskBeta } from '../sound-objects/jmask-support';
import { Weibull as JmaskWeibull } from '../sound-objects/jmask-support';
import { Probability as JmaskProbability } from '../sound-objects/jmask-support';
import { Parameter as JmaskParameter } from '../sound-objects/jmask-support';
import { Field as JmaskField } from '../sound-objects/jmask-support';
import { LineObject } from '../sound-objects/line-object';
import { ObjectBuilder } from '../sound-objects/object-builder';
import { Pattern } from '../sound-objects/pattern/pattern';
import { PatternObject } from '../sound-objects/pattern-object';
import { PianoRoll } from '../sound-objects/piano-roll';
import { PythonObject } from '../sound-objects/python-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { Sound } from '../sound-objects/sound';
import { Column } from '../sound-objects/tracker/column';
import { TrackList } from '../sound-objects/tracker/track-list';
import { Track as TrackerTrack } from '../sound-objects/tracker/track';
import { TrackerNote } from '../sound-objects/tracker/tracker-note';
import { TrackerObject } from '../sound-objects/tracker-object';
import { ZakLineObject } from '../sound-objects/zak-line-object';
import { Arrangement } from '../arrangement';
import { InstrumentAssignment } from '../instruments/instrument-assignment';
import { InstrumentLibrary } from '../instruments/instrument-library';
import { InstrumentCategory } from '../instruments/instrument-category';
import { LiveData } from '../live-data';
import { LiveObject } from '../live/live-object';
import { LiveObjectBins } from '../live/live-object-bins';
import { LiveObjectSet } from '../live/live-object-set';
import { LiveObjectSetList } from '../live/live-object-set-list';
import { TempoPoint } from '../time/tempo-point';
import { MeasureMeterPair } from '../time/measure-meter-pair';
import { Meter } from '../time/meter';
import { AudioClip } from '../score/audio/audio-clip';
import { SoundObjectLibrary } from '../sound-objects/sound-object-library';
import { MidiKeyMapping } from '../midi/midi-key-mapping';
import { MidiVelocityMapping } from '../midi/midi-velocity-mapping';
import { ClojureLibraryEntry } from '../plugins/clojure-project-data';
import { FieldDef } from '../sound-objects/piano-roll/field-def';
import { Field } from '../sound-objects/piano-roll/field';
import { PianoNote } from '../sound-objects/piano-roll/piano-note';
import { ObjRefLoadMap } from './obj-ref-map';
import { describe, expect, it } from 'vitest';
import { GlobalOrcSco } from '../global-orc-sco';
import { MarkersList } from '../markers-list';
import { MidiInputProcessor } from '../midi/midi-input-processor';
import { OpcodeList } from '../opcodes/opcode-list';
import { ProjectProperties } from '../project-properties';
import { Score } from '../score/score';
import { PatternData } from '../score/patterns/pattern-data';
import { PatternLayer } from '../score/patterns/pattern-layer';
import { PatternsLayerGroup } from '../score/patterns/patterns-layer-group';
import { Track } from '../score/track/track';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import { XmlLoadContext, XmlLoadError, loadXml } from './xml-load';
import { Element } from './xml-reader';
import { ScratchPadData } from '../scratch-pad-data';
import { Tables } from '../tables';
import { ClojureObject } from '../sound-objects/clojure-object';
import { FrozenSoundObject } from '../sound-objects/frozen-sound-object';
import { PolyObject } from '../sound-objects/poly-object';
import { Scale } from '../sound-objects/piano-roll/scale';
import { MeterMap } from '../time/meter-map';
import { TempoMap } from '../time/tempo-map';
import { TimeContext } from '../time/time-context';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { TimeState } from '../time/time-state';

type OwnerLoader = (root: Element, context?: XmlLoadContext) => unknown;

// Finite inventory: static owners, instance BSB owners, and dispatch wrappers are explicit.
// Existing family helpers use root/type/value categories; the added checkRoot guards use #root.
const owners: Array<{
  name: string;
  load: OwnerLoader;
  xml: string | (() => string);
  legacyDiagnostic?: boolean;
  save?: (value: unknown) => Element;
}> = [
  {
    name: 'PolyObject',
    xml: () => new PolyObject().saveAsXML().toXml(),
    load: (root, context) => PolyObject.loadFromXML(root, undefined, context),
  },
  {
    name: 'ClojureObject',
    xml: () => new ClojureObject().saveAsXML().toXml(),
    load: (root, context) => ClojureObject.loadFromXML(root, undefined, context),
  },
  {
    name: 'FrozenSoundObject',
    xml: () => {
      const object = new FrozenSoundObject();
      object.setNumChannels(2);
      return object.saveAsXML().toXml();
    },
    load: (root, context) => FrozenSoundObject.loadFromXML(root, undefined, context),
  },
  {
    name: 'Score',
    xml: () => new Score().saveAsXML().toXml(),
    load: (root, context) => Score.loadFromXML(root, undefined, context),
  },
  {
    name: 'PatternLayer',
    xml: () => new PatternLayer().saveAsXML().toXml(),
    load: (root, context) => PatternLayer.loadFromXML(root, undefined, context),
  },
  {
    name: 'PatternsLayerGroup',
    xml: () => new PatternsLayerGroup().saveAsXML().toXml(),
    load: (root, context) => PatternsLayerGroup.loadFromXML(root, undefined, context),
  },
  {
    name: 'PatternData',
    xml: () => new PatternData().saveAsXML().toXml(),
    load: (root, context) => PatternData.loadFromXML(root, context),
  },
  {
    name: 'Track',
    xml: () => new Track().saveAsXML().toXml(),
    load: (root, context) => Track.loadFromXML(root, undefined, context),
  },
  {
    name: 'TrackLayerGroup',
    xml: () => new TrackLayerGroup().saveAsXML().toXml(),
    load: (root, context) => TrackLayerGroup.loadFromXML(root, undefined, context),
  },
  {
    name: 'TimeContext',
    xml: () => new TimeContext().saveAsXML().toXml(),
    load: (root, context) => TimeContext.loadFromXML(root, context),
  },
  {
    name: 'TimeState',
    xml: () => new TimeState().saveAsXML().toXml(),
    load: (root, context) => TimeState.loadFromXML(root, context),
  },
  {
    name: 'TempoMap',
    xml: () => new TempoMap().saveAsXML().toXml(),
    load: (root, context) => TempoMap.loadFromXML(root, context),
  },
  {
    name: 'MeterMap',
    xml: () => new MeterMap().saveAsXML().toXml(),
    load: (root, context) => MeterMap.loadFromXML(root, context),
  },
  {
    name: 'MarkersList',
    xml: () => new MarkersList().saveAsXML().toXml(),
    load: (root, context) => MarkersList.loadFromXML(root, context),
  },
  {
    name: 'ProjectProperties',
    xml: () => new ProjectProperties().saveAsXML().toXml(),
    load: (root, context) => ProjectProperties.loadFromXML(root, context),
  },
  {
    name: 'GlobalOrcSco',
    xml: () => new GlobalOrcSco().saveAsXML().toXml(),
    load: (root, context) => GlobalOrcSco.loadFromXML(root, context),
  },
  {
    name: 'Tables',
    xml: () => new Tables().saveAsXML().toXml(),
    load: (root, context) => Tables.loadFromXML(root, context),
  },
  {
    name: 'ScratchPadData',
    xml: () => new ScratchPadData().saveAsXML().toXml(),
    load: (root, context) => ScratchPadData.loadFromXML(root, context),
  },
  {
    name: 'OpcodeList',
    xml: () => new OpcodeList().saveAsXML().toXml(),
    load: (root, context) => OpcodeList.loadFromXML(root, context),
  },
  {
    name: 'MidiInputProcessor',
    xml: () => new MidiInputProcessor().saveAsXML().toXml(),
    load: (root, context) => MidiInputProcessor.loadFromXML(root, context),
  },
  {
    name: 'Scale',
    xml: () => new Scale().saveAsXML().toXml(),
    load: (root, context) => Scale.loadFromXML(root, context),
  },
  {
    name: 'Arrangement',
    load: (root, context) => Arrangement.loadFromXML(root, context),
    xml: '<arrangement><instrumentAssignment arrangementId="7"><instrument type="blue.orchestra.GenericInstrument"><name>Root contract</name><instrumentText>instr 7</instrumentText></instrument></instrumentAssignment></arrangement>',
  },
  {
    name: 'InstrumentAssignment',
    load: (root, context) => InstrumentAssignment.loadFromXML(root, context),
    xml: '<instrumentAssignment arrangementId="7" isEnabled="false"><instrument type="blue.orchestra.GenericInstrument"><name>Root contract</name><instrumentText>instr 7</instrumentText></instrument></instrumentAssignment>',
  },
  {
    name: 'InstrumentLibrary',
    load: (root, context) => InstrumentLibrary.loadFromXML(root, context),
    xml: '<instrumentLibrary><instrumentCategory categoryName="Root contracts" isRoot="true"><instrument type="blue.orchestra.GenericInstrument"><name>Root contract</name></instrument></instrumentCategory></instrumentLibrary>',
  },
  {
    name: 'InstrumentCategory',
    load: (root, context) => InstrumentCategory.loadFromXML(root, context),
    xml: '<instrumentCategory categoryName="Root contracts" isRoot="false"><instrument type="blue.orchestra.GenericInstrument"><name>Root contract</name></instrument></instrumentCategory>',
  },
  {
    name: 'LiveData',
    load: (root, context) => LiveData.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: '<liveData><tempo>91</tempo><repeat>3</repeat><liveCodeText>i 1 0 1</liveCodeText></liveData>',
  },
  {
    name: 'LiveObject',
    load: (root, context) => LiveObject.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: '<liveObject uniqueId="root-live"><keyTrigger>65</keyTrigger><enabled>true</enabled><soundObject type="blue.soundObject.GenericScore"><name>Live root</name><score>i 1 0 1</score></soundObject></liveObject>',
  },
  {
    name: 'LiveObjectBins',
    load: (root, context) => LiveObjectBins.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: '<liveObjectBins columns="1" rows="1"><bin><liveObject uniqueId="root-live"><keyTrigger>65</keyTrigger></liveObject></bin></liveObjectBins>',
  },
  {
    name: 'LiveObjectSet',
    load: (root, context) => LiveObjectSet.loadFromXML(root, liveBins(), context),
    xml: '<liveObjectSet name="Root set"><liveObjectRef>root-live</liveObjectRef></liveObjectSet>',
  },
  {
    name: 'LiveObjectSetList',
    load: (root, context) => LiveObjectSetList.loadFromXML(root, liveBins(), context),
    xml: '<liveObjectSetList><liveObjectSet name="Root set"><liveObjectRef>root-live</liveObjectRef></liveObjectSet></liveObjectSetList>',
  },
  {
    name: 'TempoPoint',
    load: (root, context) => TempoPoint.loadFromXML(root, context),
    xml: '<tempoPoint tempo="91" curve="CONSTANT"><timePosition type="BEATS"><csoundBeats>3</csoundBeats></timePosition></tempoPoint>',
  },
  {
    name: 'MeasureMeterPair',
    load: (root, context) => MeasureMeterPair.loadFromXML(root, context),
    xml: '<measureMeterPair><measureNumber>3</measureNumber><meter><numBeats>7</numBeats><beatLength>8</beatLength></meter></measureMeterPair>',
  },
  {
    name: 'Meter',
    load: (root, context) => Meter.loadFromXML(root, context),
    xml: '<meter><numBeats>7</numBeats><beatLength>8</beatLength></meter>',
  },
  {
    name: 'AudioClip',
    load: (root, context) => AudioClip.loadFromXML(root, context),
    xml: '<audioClip><name>Root audio</name><audioFile>root.wav</audioFile><numChannels>2</numChannels><startTime type="BEATS"><csoundBeats>3</csoundBeats></startTime><subjectiveDuration type="BEATS"><csoundBeats>4</csoundBeats></subjectiveDuration></audioClip>',
  },
  {
    name: 'SoundObjectLibrary',
    load: (root, context) => SoundObjectLibrary.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: '<soundObjectLibrary><soundObject type="blue.soundObject.GenericScore" objRefId="root-score"><name>Library root</name><score>i 1 0 1</score></soundObject></soundObjectLibrary>',
  },
  {
    name: 'MidiKeyMapping',
    load: (root, context) => MidiKeyMapping.loadFromXML(root, context),
    xml: '<midiKeyMapping><enabled>false</enabled><pFieldIndex>6</pFieldIndex><baseNote>48</baseNote><range>24</range></midiKeyMapping>',
  },
  {
    name: 'MidiVelocityMapping',
    load: (root, context) => MidiVelocityMapping.loadFromXML(root, context),
    xml: '<midiVelocityMapping><pFieldIndex>6</pFieldIndex><minVelocity>10</minVelocity><maxVelocity>100</maxVelocity><minValue>0.2</minValue><maxValue>0.8</maxValue></midiVelocityMapping>',
  },
  {
    name: 'ClojureLibraryEntry',
    load: (root, context) => ClojureLibraryEntry.loadFromXML(root, context),
    xml: '<clojureLibraryEntry><coordinates>org/root-contract</coordinates><version>2.0</version></clojureLibraryEntry>',
  },

  {
    name: 'Field',
    load: (root, context) => Field.loadFromXML(root, fieldDefinitions(), context),
    xml: '<field name="velocity" val="0.75"/>',
  },
  {
    name: 'FieldDef',
    load: (root, context) => FieldDef.loadFromXML(root, context),
    xml: '<fieldDef name="velocity" fieldType="CONTINUOUS" min="0" max="1" default="0.5"/>',
  },
  {
    name: 'PianoNote',
    load: (root, context) => PianoNote.loadFromXML(root, fieldDefinitions(), context),
    xml: '<pianoNote><octave>8</octave><scaleDegree>3</scaleDegree><start>2</start><duration>1</duration><field name="velocity" val="0.75"/></pianoNote>',
  },
  {
    name: 'ParameterIdList',
    load: (root, context) => ParameterIdList.loadFromXML(root, context),
    xml: () => new ParameterIdList().saveAsXML().toXml(),
  },
  {
    name: 'ParameterList',
    load: (root, context) => ParameterList.loadFromXML(root, context),
    xml: () => new ParameterList().saveAsXML().toXml(),
  },
  {
    name: 'Parameter',
    load: (root, context) => Parameter.loadFromXML(root, context),
    xml: () => new Parameter().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'PresetGroup',
    load: (root, context) => PresetGroup.loadFromXML(root, context),
    xml: () => new PresetGroup().saveAsXML().toXml(),
  },
  {
    name: 'Preset',
    load: (root, context) => Preset.loadFromXML(root, context),
    xml: () => new Preset().saveAsXML().toXml(),
  },
  {
    name: 'BlueSynthBuilder',
    load: (root, context) => BlueSynthBuilder.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new BlueSynthBuilder().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'BlueX7',
    load: (root, context) => BlueX7.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new BlueX7().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'GenericInstrument',
    load: (root, context) => GenericInstrument.loadFromXML(root, context),
    xml: () => new GenericInstrument().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JavaScriptInstrument',
    load: (root, context) => JavaScriptInstrument.loadFromXML(root, context),
    xml: () => new JavaScriptInstrument().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'PythonInstrument',
    load: (root, context) => PythonInstrument.loadFromXML(root, context),
    xml: () => new PythonInstrument().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'ChannelList',
    load: (root, context) => ChannelList.loadFromXML(root, context),
    xml: () => new ChannelList().saveAsXML().toXml(),
  },
  {
    name: 'Channel',
    load: (root, context) => Channel.loadFromXML(root, context),
    xml: () => new Channel().saveAsXML().toXml(),
  },
  {
    name: 'Effect',
    load: (root, context) => Effect.loadFromXML(root, context),
    xml: () => new Effect().saveAsXML().toXml(),
  },
  {
    name: 'EffectsChain',
    load: (root, context) => EffectsChain.loadFromXML(root, context),
    xml: () => new EffectsChain().saveAsXML().toXml(),
  },
  {
    name: 'Mixer',
    load: (root, context) => Mixer.loadFromXML(root, context),
    xml: () => new Mixer().saveAsXML().toXml(),
  },
  {
    name: 'Send',
    load: (root, context) => Send.loadFromXML(root, context),
    xml: () => new Send().saveAsXML().toXml(),
  },
  {
    name: 'AddProcessor',
    load: (root, context) => AddProcessor.loadFromXML(root, context),
    xml: () => new AddProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'Code',
    load: (root, context) => Code.loadFromXML(root, context),
    xml: () => new Code().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'EqualsProcessor',
    load: (root, context) => EqualsProcessor.loadFromXML(root, context),
    xml: () => new EqualsProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'InversionProcessor',
    load: (root, context) => InversionProcessor.loadFromXML(root, context),
    xml: () => new InversionProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'LineAddProcessor',
    load: (root, context) => LineAddProcessor.loadFromXML(root, context),
    xml: () => new LineAddProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'LineMultiplyProcessor',
    load: (root, context) => LineMultiplyProcessor.loadFromXML(root, context),
    xml: () => new LineMultiplyProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'MultiplyProcessor',
    load: (root, context) => MultiplyProcessor.loadFromXML(root, context),
    xml: () => new MultiplyProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'NoteProcessorChainMap',
    load: (root, context) => NoteProcessorChainMap.loadFromXML(root, context),
    xml: () => new NoteProcessorChainMap().saveAsXML().toXml(),
  },
  {
    name: 'NoteProcessorChain',
    load: (root, context) => NoteProcessorChain.loadFromXML(root, context),
    xml: () => new NoteProcessorChain().saveAsXML().toXml(),
  },
  {
    name: 'PchAddProcessor',
    load: (root, context) => PchAddProcessor.loadFromXML(root, context),
    xml: () => new PchAddProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'PchInversionProcessor',
    load: (root, context) => PchInversionProcessor.loadFromXML(root, context),
    xml: () => new PchInversionProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'PythonProcessor',
    load: (root, context) => PythonProcessor.loadFromXML(root, context),
    xml: () => new PythonProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'RandomAddProcessor',
    load: (root, context) => RandomAddProcessor.loadFromXML(root, context),
    xml: () => new RandomAddProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'RandomMultiplyProcessor',
    load: (root, context) => RandomMultiplyProcessor.loadFromXML(root, context),
    xml: () => new RandomMultiplyProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'RetrogradeProcessor',
    load: (root, context) => RetrogradeProcessor.loadFromXML(root, context),
    xml: () => new RetrogradeProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'RotateProcessor',
    load: (root, context) => RotateProcessor.loadFromXML(root, context),
    xml: () => new RotateProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'SubListProcessor',
    load: (root, context) => SubListProcessor.loadFromXML(root, context),
    xml: () => new SubListProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'SwitchProcessor',
    load: (root, context) => SwitchProcessor.loadFromXML(root, context),
    xml: () => new SwitchProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'TimeWarpProcessor',
    load: (root, context) => TimeWarpProcessor.loadFromXML(root, context),
    xml: () => new TimeWarpProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'TuningProcessor',
    load: (root, context) => TuningProcessor.loadFromXML(root, context),
    xml: () => new TuningProcessor().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'OpcodeDefinition',
    load: (root, context) => OpcodeDefinition.loadFromXML(root, context),
    xml: () => new OpcodeDefinition().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'ClojureProjectData',
    load: (root, context) => ClojureProjectData.loadFromXML(root, context),
    xml: () => new ClojureProjectData().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'AudioFile',
    load: (root, context) => AudioFile.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new AudioFile().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'Comment',
    load: (root, context) => Comment.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new Comment().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'CSDSoundObject',
    load: (root, context) => CSDSoundObject.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new CSDSoundObject().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'External',
    load: (root, context) => External.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new External().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'GenericScore',
    load: (root, context) => GenericScore.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new GenericScore().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'Instance',
    load: (root, context) => Instance.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new Instance().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JMask',
    load: (root, context) => JMask.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new JMask().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JavaScriptObject',
    load: (root, context) => JavaScriptObject.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new JavaScriptObject().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskTablePoint',
    load: (root, context) => JmaskTablePoint.loadFromXML(root, context),
    xml: () => new JmaskTablePoint().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskTable',
    load: (root, context) => JmaskTable.loadFromXML(root, context),
    xml: () => new JmaskTable().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskMask',
    load: (root, context) => JmaskMask.loadFromXML(root, context),
    xml: () => new JmaskMask().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskQuantizer',
    load: (root, context) => JmaskQuantizer.loadFromXML(root, context),
    xml: () => new JmaskQuantizer().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskAccumulator',
    load: (root, context) => JmaskAccumulator.loadFromXML(root, context),
    xml: () => new JmaskAccumulator().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskConstant',
    load: (root, context) => JmaskConstant.loadFromXML(root, context),
    xml: () => new JmaskConstant().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskRandom',
    load: (root, context) => JmaskRandom.loadFromXML(root, context),
    xml: () => new JmaskRandom().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskOscillator',
    load: (root, context) => JmaskOscillator.loadFromXML(root, context),
    xml: () => new JmaskOscillator().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskSegment',
    load: (root, context) => JmaskSegment.loadFromXML(root, context),
    xml: () => new JmaskSegment().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskItemList',
    load: (root, context) => JmaskItemList.loadFromXML(root, context),
    xml: () => new JmaskItemList().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskUniform',
    load: (root, context) => JmaskUniform.loadFromXML(root, context),
    xml: () => new JmaskUniform().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskTriangle',
    load: (root, context) => JmaskTriangle.loadFromXML(root, context),
    xml: () => new JmaskTriangle().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskLinear',
    load: (root, context) => JmaskLinear.loadFromXML(root, context),
    xml: () => new JmaskLinear().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskExponential',
    load: (root, context) => JmaskExponential.loadFromXML(root, context),
    xml: () => new JmaskExponential().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskGaussian',
    load: (root, context) => JmaskGaussian.loadFromXML(root, context),
    xml: () => new JmaskGaussian().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskCauchy',
    load: (root, context) => JmaskCauchy.loadFromXML(root, context),
    xml: () => new JmaskCauchy().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskBeta',
    load: (root, context) => JmaskBeta.loadFromXML(root, context),
    xml: () => new JmaskBeta().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskWeibull',
    load: (root, context) => JmaskWeibull.loadFromXML(root, context),
    xml: () => new JmaskWeibull().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskProbability',
    load: (root, context) => JmaskProbability.loadFromXML(root, context),
    xml: () => new JmaskProbability().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskParameter',
    load: (root, context) => JmaskParameter.loadFromXML(root, context),
    xml: () => JmaskParameter.create(new JmaskConstant()).saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskField',
    load: (root, context) => JmaskField.loadFromXML(root, context),
    xml: () => new JmaskField().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'LineObject',
    load: (root, context) => LineObject.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new LineObject().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'ObjectBuilder',
    load: (root, context) => ObjectBuilder.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new ObjectBuilder().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'Pattern',
    load: (root, context) => Pattern.loadFromXML(root, context),
    xml: () => new Pattern(4).saveAsXML().toXml(),
  },
  {
    name: 'PatternObject',
    load: (root, context) => PatternObject.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new PatternObject().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'PianoRoll',
    load: (root, context) => PianoRoll.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new PianoRoll().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'PythonObject',
    load: (root, context) => PythonObject.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new PythonObject().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'SoundLayer',
    load: (root, context) => SoundLayer.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: '<soundLayer name="Root layer"><noteProcessorChain/></soundLayer>',
    save: (value) => {
      const poly = new PolyObject();
      poly.push(value as SoundLayer);
      return poly.saveAsXML().getElement('soundLayer')!;
    },
  },
  {
    name: 'Sound',
    load: (root, context) => Sound.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new Sound().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'Column',
    load: (root, context) => Column.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new Column().saveAsXML().toXml(),
  },
  {
    name: 'TrackList',
    load: (root, context) => TrackList.loadFromXML(root, context),
    xml: () => new TrackList().saveAsXML().toXml(),
  },
  {
    name: 'TrackerTrack',
    load: (root, context) => TrackerTrack.loadFromXML(root, context),
    xml: () => new TrackerTrack().saveAsXML().toXml(),
  },
  {
    name: 'TrackerNote',
    load: (root, context) => TrackerNote.loadFromXML(root, context),
    xml: () => new TrackerNote().saveAsXML().toXml(),
  },
  {
    name: 'TrackerObject',
    load: (root, context) => TrackerObject.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new TrackerObject().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'ZakLineObject',
    load: (root, context) => ZakLineObject.loadFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new ZakLineObject().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'BSBCheckBox',
    load: (root, context) => {
      const widget = new BSBCheckBox();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBCheckBox()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBDropdown',
    load: (root, context) => {
      const widget = new BSBDropdown();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBDropdown()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBFileSelector',
    load: (root, context) => {
      const widget = new BSBFileSelector();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBFileSelector()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBGraphicInterface',
    load: (root, context) => {
      const widget = new BSBGraphicInterface();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => new BSBGraphicInterface().saveAsXML().toXml(),
  },
  {
    name: 'BSBGroup',
    load: (root, context) => {
      const widget = new BSBGroup();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBGroup()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBHSliderBank',
    load: (root, context) => {
      const widget = new BSBHSliderBank();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBHSliderBank()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBHSlider',
    load: (root, context) => {
      const widget = new BSBHSlider();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBHSlider()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBKnob',
    load: (root, context) => {
      const widget = new BSBKnob();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBKnob()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBLabel',
    load: (root, context) => {
      const widget = new BSBLabel();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBLabel()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBLineObject',
    load: (root, context) => {
      const widget = new BSBLineObject();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBLineObject()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBSubChannelDropdown',
    load: (root, context) => {
      const widget = new BSBSubChannelDropdown();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBSubChannelDropdown()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBTextField',
    load: (root, context) => {
      const widget = new BSBTextField();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBTextField()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBValue',
    load: (root, context) => {
      const widget = new BSBValue();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBValue()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBVSliderBank',
    load: (root, context) => {
      const widget = new BSBVSliderBank();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBVSliderBank()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBVSlider',
    load: (root, context) => {
      const widget = new BSBVSlider();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBVSlider()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BSBXYController',
    load: (root, context) => {
      const widget = new BSBXYController();
      widget.loadFromXML(root, context);
      return widget;
    },
    xml: () => saveBsbWidgetAsXML(new BSBXYController()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'InstrumentRegistry',
    load: (root, context) => loadInstrumentFromXML(root, context),
    xml: () => new GenericInstrument().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'SoundObjectRegistry',
    load: (root, context) => loadSoundObjectFromXML(root, new ObjRefLoadMap(), context),
    xml: () => new GenericScore().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'BsbWidgetRegistry',
    load: (root, context) => loadBsbWidgetFromXML(root, context),
    xml: () => saveBsbWidgetAsXML(new BSBKnob()).toXml(),
    legacyDiagnostic: true,
    save: (value) => saveBsbWidgetAsXML(value as BSBWidget),
  },
  {
    name: 'BsbFont',
    load: (root) => loadFontFromXML(root),
    xml: '<font><name>Dialog</name><size>13</size><style>1</style></font>',
    save: (value) => saveFontToXML(value as BSBFont),
  },
  {
    name: 'JmaskGeneratorRegistry',
    load: (root, context) => loadGeneratorFromXML(root, context),
    xml: () => new JmaskConstant().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'JmaskProbabilityRegistry',
    load: (root, context) => loadProbabilityGeneratorFromXML(root, context),
    xml: () => new JmaskUniform().saveAsXML().toXml(),
    legacyDiagnostic: true,
  },
  {
    name: 'ArrangementWithLibrary',
    load: (root) => Arrangement.loadFromXMLWithLibrary(root, new InstrumentLibrary()),
    xml: '<arrangement><instrumentAssignment arrangementId="7"><instrument type="blue.orchestra.GenericInstrument"><name>Assigned root</name></instrument></instrumentAssignment></arrangement>',
    legacyDiagnostic: true,
  },
];

function fieldDefinitions(): Map<string, FieldDef> {
  const definition = new FieldDef();
  definition.setFieldName('velocity');
  return new Map([['velocity', definition]]);
}

function liveBins(): LiveObjectBins {
  const object = new LiveObject();
  object.setUniqueId('root-live');
  return LiveObjectBins.fromGrid([[object]]);
}

describe('direct XML owner root contracts', () => {
  it.each(owners)(
    'rejects a wrong root for $name with equivalent direct and report diagnostics',
    ({ name, load, xml: validXml, legacyDiagnostic }) => {
      const input = typeof validXml === 'function' ? validXml() : validXml;
      const xml = input ? Element.parse(input).setName('wrong').toXml() : '<wrong/>';
      const directInput = Element.parse(xml);
      const before = directInput.toXml();
      let directError: unknown;
      try {
        load(directInput);
      } catch (error) {
        directError = error;
      }
      expect(directError).toBeInstanceOf(XmlLoadError);
      expect(directInput.toXml()).toBe(before);
      const directDiagnostic = (directError as XmlLoadError).diagnostics[0]!;

      const source = { kind: 'project' as const, label: 'wrong-owner-root.blue' };
      const report = loadXml(xml, source, (root, context) => load(root, context));
      expect(report.ok).toBe(false);
      if (report.ok) throw new Error('Wrong owner root unexpectedly loaded.');
      expect(report).not.toHaveProperty('value');
      expect(directDiagnostic.source).toEqual({ kind: 'primitive', label: 'in-memory XML' });
      const reportDiagnostic = report.diagnostics[0]!;
      expect(reportDiagnostic).toMatchObject({
        code: legacyDiagnostic
          ? name.startsWith('Jmask') ||
            (name.startsWith('BSB') && name !== 'BSBGraphicInterface') ||
            name === 'BsbWidgetRegistry'
            ? 'value'
            : expect.stringMatching(/^(root|type)$/)
          : 'root',
        severity: 'error',
        source,
        path: expect.stringMatching(/^\/wrong(?:\/@(?:type|bdoType))?$/),
        ...(!legacyDiagnostic ? { member: '#root' } : {}),
        ...(!legacyDiagnostic ? { value: 'wrong' } : {}),
        recovery: expect.any(String),
      });
      const { source: _directSource, ...directFields } = directDiagnostic;
      const { source: _reportSource, ...reportFields } = reportDiagnostic;
      expect(reportFields).toEqual(directFields);
    },
  );

  it.each(owners)(
    'accepts populated $name and reopens stable canonical output',
    ({ load, xml, save }) => {
      const source = { kind: 'primitive' as const, label: 'populated-owner.xml' };
      const input = typeof xml === 'function' ? xml() : xml!;
      const result = loadXml(input, source, load);
      expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) throw new Error('Expected a valid owner.');
      const write = save ?? ((value: unknown) => (value as { saveAsXML(): Element }).saveAsXML());
      const output = write(result.value).toXml();
      const reopened = loadXml(output, source, load);
      expect(reopened.ok, JSON.stringify(reopened.diagnostics)).toBe(true);
      if (!reopened.ok) throw new Error('Expected canonical owner output to reopen.');
      expect(write(reopened.value).toXml()).toBe(output);
    },
  );

  it.each(owners.filter((owner) => !owner.legacyDiagnostic))(
    'rejects $name before reading content and preserves nested source paths',
    ({ load, xml }) => {
      const input = typeof xml === 'function' ? xml() : xml!;
      const original = Element.parse(input);
      const rootName = original.getName();
      const wrong = original.clone().setName('wrong');
      wrong.setAttribute('future', 'invalid');
      const envelope = new Element('envelope');
      envelope.addElement('wrong');
      envelope.addElement(wrong);
      const before = envelope.toXml();
      const source = { kind: 'primitive' as const, label: 'C:\\Users\\composer\\owner.xml' };
      const result = loadXml(before, source, (root, context) =>
        load(root.getElements('wrong').toArray()[1]!, context),
      );
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty('value');
      expect(result.diagnostics).toEqual([
        {
          code: 'root',
          severity: 'error',
          source,
          path: '/envelope/wrong[2]',
          member: '#root',
          value: 'wrong',
          message: expect.stringContaining('Unexpected XML root wrong; expected '),
          recovery: expect.any(String),
        },
      ]);
      expect(result.diagnostics[0]!.recovery).toContain(rootName);
      expect(envelope.toXml()).toBe(before);
    },
  );

  it('keeps supported historical roots and local aliases loadable', () => {
    const assignment = InstrumentAssignment.loadFromXML(
      Element.parse(
        '<instrumentAssignment id="9" enabled="false"><instrument type="blue.orchestra.GenericInstrument"><name>Historical assignment</name></instrument></instrumentAssignment>',
      ),
    );
    expect(assignment.arrangementId).toBe('9');
    expect(assignment.enabled).toBe(false);
    expect(assignment.saveAsXML().getAttribute('arrangementId')).toBe('9');
    expect(assignment.saveAsXML().hasAttribute('id')).toBe(false);
    const tempo = TempoPoint.loadFromXML(Element.parse('<tempoPoint beat="3" tempo="91"/>'));
    expect(tempo.position.getValue()).toBe(3);
    expect(tempo.tempo).toBe(91);
    expect(tempo.saveAsXML().getElement('timePosition')).not.toBeNull();
    const pair = MeasureMeterPair.loadFromXML(
      Element.parse(
        '<measureMeterPair><measure>3</measure><meter><numBeats>7</numBeats><beatLength>8</beatLength></meter></measureMeterPair>',
      ),
    );
    expect(pair.measure).toBe(3);
    expect(pair.meter.numBeats).toBe(7);
    expect(pair.saveAsXML().getTextString('measureNumber')).toBe('3');
    const poly = PolyObject.loadFromXML(Element.parse('<polyObject name="Historical poly"/>'));
    expect(poly.getName()).toBe('Historical poly');
    expect(PolyObject.loadFromXML(poly.saveAsXML()).getName()).toBe('Historical poly');
  });

  it('keeps caller-selected typed time element names valid', () => {
    const position = TimePosition.loadFromXML(
      Element.parse('<startTime type="BEATS"><csoundBeats>2.5</csoundBeats></startTime>'),
    );
    const duration = TimeDuration.loadFromXML(
      Element.parse(
        '<subjectiveDuration type="BEATS"><csoundBeats>4</csoundBeats></subjectiveDuration>',
      ),
    );
    expect(position.getValue()).toBe(2.5);
    expect(duration.getValue()).toBe(4);
  });
});
