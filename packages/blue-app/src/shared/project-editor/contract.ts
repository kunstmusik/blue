import {
  BlueData,
  Channel,
  ChannelList,
  BlueSynthBuilder,
  BlueX7,
  cloneBlueX7Voice,
  getBlueX7Descriptor,
  BSBGroup,
  BSBWidget,
  BSBXYController,
  BSBDropdown,
  Element,
  GenericInstrument,
  Instrument,
  JavaScriptInstrument,
  Effect,
  OpcodeDefinition,
  OpcodeList,
  Preset,
  PresetGroup,
  ProjectProperties,
  PythonInstrument,
  Mixer,
  Scale,
  TempoMap,
  TempoPoint,
  CurveType,
  UDOStyle,
  convertToModern,
  convertToClassic,
  LiveData,
  LiveObject,
  LiveObjectBins,
  LiveObjectSetList,
  Send,
  Score,
  PolyObject,
  SoundLayer,
  TrackLayer,
  TrackLayerGroup,
  PatternLayer,
  PatternsLayerGroup,
  TimeBase,
  isValidSnapValueName,
  SoundObject,
  SoundObjectLibrary,
  collectInstanceSoundObjects,
  Instance,
  AbstractSoundObject,
  TimeBehavior,
  NoteProcessorChain,
  AudioClip,
  ObjRefLoadMap,
  TimePosition,
  TimeDuration,
  TimeContext,
  GenericScore,
  PythonObject,
  ClojureLibraryEntry,
  ClojureProjectData,
  ClojureObject,
  JavaScriptObject,
  Comment,
  External,
  AudioFile,
  FrozenSoundObject,
  PatternObject,
  Pattern,
  LineObject,
  ZakLineObject,
  PianoRoll,
  PianoNote,
  FieldDef,
  TrackerObject,
  Track,
  TrackerNote,
  Column,
  JMask,
  loadFieldFromSnapshot,
  Sound,
  createSoundObject,
  loadSoundObjectFromXML,
  convertTimePosition,
  beatsToTimePosition,
  timePositionToBeats,
  beatsToDuration,
  MeterMap,
  MeasureMeterPair,
  Meter,
  ObjectBuilder,
  ScratchPadData,
  getTrackPlacementForSoundObject,
  getNotes as parseScoreNotes,
  createNoteProcessorChainSnapshot as createNoteProcessorChainSnapshotFromData,
  reifyChainFromSnapshot,
} from '@blue/data';
import type {
  NoteProcessorChainSnapshot as DataNoteProcessorChainSnapshot,
  Parameter as BlueDataParameter,
  ScoreObject as BlueDataScoreObject,
  AutomatableLayer as BlueDataAutomatableLayer,
  Arrangement as BlueDataArrangement,
  Mixer as BlueDataMixer,
} from '@blue/data';
import { AutomationCurve as BlueDataAutomationCurve, LineColors } from '@blue/data';
import { ParameterHelper } from '@blue/data';
import type {
  SnapValueName,
  BlueX7Voice,
  BlueX7Common,
  BlueX7Lfo,
  BlueX7Operator,
  BlueX7EnvelopePoint,
} from '@blue/data';
import type { MissingAudioAssetsSession } from '../missing-audio-assets';
import type { ScoreInsertionLocation } from '../unified-library';

export interface ScoreTimeStateSnapshot {
  snapEnabled: boolean;
  snapValue: string;
  primaryTimeDisplay: string;
  secondaryTimeDisplay: string;
  secondaryRulerEnabled: boolean;
  tempoRowVisible: boolean;
  meterRowVisible: boolean;
  markersRowVisible: boolean;
  smpteFrameRate: number;
  zoomIterations: number;
  scoreObjectUpdateMode?: 'UPDATE_ALL' | 'UPDATE_MATCHING' | null;
  markerUpdateMode?: 'UPDATE_ALL' | 'UPDATE_MATCHING' | null;
}

export interface MarkerSnapshot {
  name: string;
  time: number;
  timeBase: string;
  sourceIndex: number;
}

export type AudioFadeType = 'LINEAR' | 'CONSTANT_POWER' | 'SYMMETRIC' | 'FAST' | 'SLOW';

export type ScoreObjectBarRendererSnapshot =
  | GenericBarRendererSnapshot
  | CommentBarRendererSnapshot
  | LetterBarRendererSnapshot
  | PianoRollBarRendererSnapshot
  | AudioFileBarRendererSnapshot
  | FrozenSoundObjectBarRendererSnapshot
  | AudioClipBarRendererSnapshot
  | FallbackBarRendererSnapshot;

export interface GenericBarRendererSnapshot {
  kind: 'generic';
  labelLines: string[];
  timeBehavior: string;
  repeatPointBeats: number | null;
}

export interface CommentBarRendererSnapshot {
  kind: 'comment';
  labelLines: string[];
}

export interface LetterBarRendererSnapshot {
  kind: 'letter';
  letter: string;
  labelLines: string[];
  timeBehavior: string;
  repeatPointBeats: number | null;
  mappingStatus: 'supported' | 'fallback';
}

export interface PianoRollBarRendererSnapshot {
  kind: 'pianoRoll';
  labelLines: string[];
  timeBehavior: string;
  repeatPointBeats: number | null;
  scaleDegreeCount: number;
  notesDurationBeats: number;
  notes: Array<{
    octave: number;
    scaleDegree: number;
    startBeats: number;
    durationBeats: number;
  }>;
}

export interface AudioFileBarRendererSnapshot {
  kind: 'audioFile';
  labelLines: string[];
  audioFilePath: string;
  waveformKey: string | null;
}

export interface FrozenSoundObjectBarRendererSnapshot {
  kind: 'frozenSoundObject';
  labelLines: string[];
  frozenWaveFileName: string;
  waveformKey: string | null;
  originalDurationBeats: number | null;
  currentDurationBeats: number;
}

export interface AudioClipBarRendererSnapshot {
  kind: 'audioClip';
  labelLines: string[];
  audioFilePath: string;
  waveformKey: string | null;
  fileStartTimeBeats: number;
  audioDurationBeats: number;
  looping: boolean;
  fadeInBeats: number;
  fadeInType: AudioFadeType;
  fadeOutBeats: number;
  fadeOutType: AudioFadeType;
}

export interface FallbackBarRendererSnapshot {
  kind: 'fallback';
  labelLines: string[];
  reason: 'unknown-type' | 'java-only-type' | 'missing-data';
  javaRenderer?: string;
}

export interface ScoreRowObjectSnapshot {
  objectId: string;
  objectType: string;
  name: string;
  startBeats: number;
  durationBeats: number;
  startTimeBase: string;
  durationTimeBase: string;
  backgroundColor: number;
  isContainer: boolean;
  editorTarget: ScoreObjectEditorTargetSnapshot;
  serializedXml?: string;
  barRenderer: ScoreObjectBarRendererSnapshot;
}

export interface ScoreLayerSnapshot {
  layerId: string;
  layerSelectionId?: string;
  name: string;
  height: number;
  backgroundColor: number;
  muted?: boolean;
  solo?: boolean;
  items: ScoreRowObjectSnapshot[];
  noteProcessorChain?: NoteProcessorChainSnapshot;
  automation?: ScoreLayerAutomationSnapshot;
}

export type AutomationLayerKind = 'soundObject' | 'track';
export type AutomationTargetSourceKind =
  | 'instrument'
  | 'mixer'
  | 'audioChannel'
  | 'effect'
  | 'send'
  | 'unknown';

export interface AutomationPointSnapshot {
  time: number;
  value: number;
}

export interface AutomationParameterSnapshot {
  parameterId: string;
  name: string;
  label: string;
  displayName: string;
  minimum: number;
  maximum: number;
  /** Canonical Java BigDecimal text; this is the persistence/runtime authority. */
  resolutionDecimal: string;
  /** Derived binary64 projection for legacy display consumers only. */
  resolution: number;
  curve: string;
  fixedValue: number;
  automationEnabled: boolean;
  lineColor: number;
  sourceKind: AutomationTargetSourceKind;
  targetPath: string[];
  points: AutomationPointSnapshot[];
}

export type AutomationAssignmentState =
  | 'available'
  | 'assignedCurrentLayer'
  | 'assignedOtherLayer'
  | 'missing';

export interface AutomationTargetSnapshot {
  parameterId: string;
  label: string;
  sourceKind: AutomationTargetSourceKind;
  automationEnabled: boolean;
  assignmentState: AutomationAssignmentState;
  semanticKey?: string;
  ownerIdentity?: string;
  locationLabel?: string;
  updateClass?: 'active-note' | 'next-note';
  ownerLayerId?: string;
  ownerLayerName?: string;
}

export interface AutomationTargetGroupSnapshot {
  groupId: string;
  label: string;
  subGroups: AutomationTargetGroupSnapshot[];
  targets: AutomationTargetSnapshot[];
}

export interface ScoreLayerAutomationSnapshot {
  layerId: string;
  layerKind: AutomationLayerKind;
  parameterIds: string[];
  selectedParameterId?: string;
  parameters: AutomationParameterSnapshot[];
  targetGroups: AutomationTargetGroupSnapshot[];
  missingParameterIds: string[];
}

export type ScoreLayerGroupType = 'polyObject' | 'track' | 'patterns';

export interface PolyObjectLayerGroupSnapshot {
  groupId: string;
  groupType: 'polyObject';
  name: string;
  layerCount: number;
  isOpenableContainer: boolean;
  layers: ScoreLayerSnapshot[];
  noteProcessorChain?: NoteProcessorChainSnapshot;
}

export interface TrackInstrumentSummary {
  trackId: string;
  type: InstrumentSnapshot['type'];
  instrumentType: string;
  name: string;
  comment: string;
  enabled: boolean;
  supported: boolean;
  snapshot?: InstrumentSnapshot;
}

export interface TrackSnapshot extends ScoreLayerSnapshot {
  layerKind: 'track';
  instrument: TrackInstrumentSummary | null;
}

export interface TrackLayerGroupSnapshot {
  groupId: string;
  groupType: 'track';
  name: string;
  defaultHeightIndex: number;
  layerCount: number;
  isOpenableContainer: boolean;
  layers: TrackSnapshot[];
  noteProcessorChain?: NoteProcessorChainSnapshot;
}

export interface PatternSourceObjectSnapshot {
  objectId: string;
  objectType: string;
  name: string;
  backgroundColor: number;
  editorTarget: ScoreObjectEditorTargetSnapshot;
  serializedXml?: string;
  barRenderer: ScoreObjectBarRendererSnapshot;
}

export interface PatternLayerSnapshot extends ScoreLayerSnapshot {
  items: [];
  sourceObject: PatternSourceObjectSnapshot;
  activeCellIndices: number[];
}

export interface PatternsLayerGroupSnapshot {
  groupId: string;
  groupType: 'patterns';
  name: string;
  layerCount: number;
  isOpenableContainer: false;
  /** Raw canonical value; malformed legacy values are retained untouched. */
  patternBeatsLength: number;
  /** Positive display-only fallback used for geometry and gestures. */
  effectivePatternBeatsLength: number;
  layers: PatternLayerSnapshot[];
  noteProcessorChain?: NoteProcessorChainSnapshot;
}

export type ScoreLayerGroupSnapshot =
  | PolyObjectLayerGroupSnapshot
  | TrackLayerGroupSnapshot
  | PatternsLayerGroupSnapshot;

export interface ScoreDocumentSnapshot {
  timeState: ScoreTimeStateSnapshot;
  markers: MarkerSnapshot[];
  layerGroups: ScoreLayerGroupSnapshot[];
  rootNoteProcessorChain?: NoteProcessorChainSnapshot;
}

// ─── Score Object Editor Target Types ───

export interface ScoreObjectLocationRef {
  rootGroupIndex: number;
  containerPath: Array<{ layerIndex: number; objectIndex: number }>;
  layerIndex: number;
  objectIndex: number;
  rootGroupId?: string;
  layerId?: string;
  trackId?: string;
  layerKind?: 'soundObject' | 'track';
}

export interface ScoreObjectLibraryEntryRef {
  libraryId: string;
  libraryIndex: number;
  objectType: string;
}

export interface BlueLiveScoreObjectRef {
  liveObjectId: string;
  column: number;
  row: number;
}

export interface PatternSourceObjectLocationRef {
  groupId: string;
  layerId: string;
  sourceObjectId: string;
}

export interface ScoreObjectEditorTargetSnapshot {
  selectionId: string;
  selectedObjectType: string;
  editorObjectType: string;
  ownerKind: 'timeline' | 'library' | 'blueLive';
  displayContext: 'timeline' | 'library' | 'instance' | 'blueLive';
  location?: ScoreObjectLocationRef;
  sourceInstanceLocation?: ScoreObjectLocationRef;
  library?: ScoreObjectLibraryEntryRef;
  blueLive?: BlueLiveScoreObjectRef;
  /** Present when the target is a pattern layer's embedded source object.
   *  Such targets are resolved through the pattern group/row/source chain and
   *  are invalid for ordinary timeline add/move/remove/conversion handlers. */
  patternSource?: PatternSourceObjectLocationRef;
  supportsTimeBehavior: boolean;
  supportsRepeatPoint: boolean;
  supportsNoteProcessorChain: boolean;
}

// ─── Score Object Editor Document Types ───

export interface TimeConversionMeterEntry {
  measure: number;
  numBeats: number;
  beatLength: number;
}

export interface TimeConversionContext {
  meterEntries: TimeConversionMeterEntry[];
  tempoEnabled: boolean;
  initialTempo: number;
  sampleRate: number;
}

export interface TimeValueSnapshot {
  value: number;
  timeBase: string;
  displayText: string;
}

export interface NoteProcessorEntrySnapshot {
  id: string;
  processorType: string;
  displayName: string;
  supported: boolean;
  deferred: boolean;
  summary: string;
  parameters: Record<string, string | number | boolean>;
  serializedXml: string;
}

export interface NoteProcessorChainSnapshot {
  processors: NoteProcessorEntrySnapshot[];
  hasUnsupportedProcessors: boolean;
  hasDeferredProcessors: boolean;
}

export interface NamedChainListSnapshot {
  names: string[];
}

export interface SharedScoreObjectPropertiesSnapshot {
  target: ScoreObjectEditorTargetSnapshot;
  name: string;
  startTime: TimeValueSnapshot;
  subjectiveDuration: TimeValueSnapshot;
  endTimeDisplay: string;
  backgroundColor: number;
  timeBehavior?: string;
  repeatPoint?: TimeValueSnapshot | null;
  noteProcessorChain?: NoteProcessorChainSnapshot | null;
}

export interface TrackerColumnSnapshot {
  name: string;
  type: number;
  restrictedToInteger: boolean;
  usingRange: boolean;
  rangeMin: number;
  rangeMax: number;
  outputFrequency: boolean;
  scale: MidiScaleSnapshot | null;
  sourceIndex?: number | null;
}

export type AudioFileMetadataStatus =
  | 'empty'
  | 'missing'
  | 'unreadable'
  | 'unsupported'
  | 'available';

export type AudioFileMetadataState =
  | { status: 'empty' }
  | { status: 'missing'; path: string; message: string }
  | { status: 'unreadable'; path: string; message: string }
  | { status: 'unsupported'; path: string; message: string }
  | {
      status: 'available';
      path: string;
      formatType: string;
      byteLength: number;
      encodingType: string;
      sampleRate: number;
      sampleSizeInBits: number;
      channels: number;
      isBigEndian: boolean;
      durationSeconds: number;
      frameCount: number;
      channelVariables: string;
      unavailableFields: string[];
    };

export interface AudioFileMetadataSnapshot {
  formatType: string;
  byteLength: number;
  encodingType: string;
  sampleRate: number;
  sampleSizeInBits: number;
  channels: number;
  isBigEndian: boolean;
  durationSeconds: number;
  frameCount: number;
  channelVariables: string;
  unavailableFields: string[];
}

export type AudioFileSelectionResult =
  | { status: 'cancelled' }
  | {
      status: 'selected';
      storedPath: string;
      objectName: string;
      metadata: AudioFileMetadataSnapshot;
      copiedToMedia: boolean;
    }
  | {
      status: 'error';
      code: 'no-project' | 'not-a-file' | 'missing' | 'unreadable' | 'unsupported' | 'copy-failed';
      message: string;
      path?: string;
    };

export type FrozenSoundObjectSaveCopyResult =
  | { status: 'cancelled' }
  | { status: 'copied'; destinationPath: string; byteLength: number }
  | {
      status: 'error';
      code:
        | 'no-project'
        | 'missing-artifact'
        | 'unreadable-artifact'
        | 'invalid-artifact'
        | 'directory-destination'
        | 'freeze-destination'
        | 'copy-failed';
      message: string;
    };

export type TypeSpecificScoreObjectEditorSnapshot =
  | {
      kind: 'code';
      target: ScoreObjectEditorTargetSnapshot;
      syntax: 'text' | 'csound-score' | 'python' | 'javascript' | 'clojure';
      text: string;
      auxiliaryFlags?: Record<string, string | number | boolean>;
      bsbInstrument?: BlueSynthBuilderInstrumentSnapshot;
    }
  | {
      kind: 'external';
      target: ScoreObjectEditorTargetSnapshot;
      scoreText: string;
      commandLine: string;
      syntaxType: string;
      canTest: boolean;
      testMessage?: string;
    }
  | {
      kind: 'audioClip';
      target: ScoreObjectEditorTargetSnapshot;
      audioFile: string;
      numChannels: number;
      audioDuration: number;
      fileStartTime: number;
      fadeIn: number;
      fadeInType: string;
      fadeOut: number;
      fadeOutType: string;
      looping: boolean;
    }
  | {
      kind: 'audioFile';
      target: ScoreObjectEditorTargetSnapshot;
      filePath: string;
      csoundPostCode: string;
      metadata: AudioFileMetadataState;
      canChooseFile: boolean;
    }
  | {
      kind: 'frozenSoundObject';
      target: ScoreObjectEditorTargetSnapshot;
      frozenWaveFileName: string;
      sourceName: string;
      sourceType: string;
      sourceDurationBeats: number | null;
      numChannels: number;
      artifactStatus: 'empty' | 'available' | 'missing' | 'unreadable';
      message?: string;
      canSaveCopy: boolean;
    }
  | {
      kind: 'file';
      target: ScoreObjectEditorTargetSnapshot;
      objectType: string;
      filePath: string;
      csoundPostCode?: string;
      numChannels?: number;
      originalObjectType?: string;
      auxiliaryFlags?: Record<string, string | number | boolean>;
    }
  | {
      kind: 'polyObject';
      target: ScoreObjectEditorTargetSnapshot;
      children: Array<{
        objectId: string;
        name: string;
        objectType: string;
        startBeats: number;
        durationBeats: number;
        layerLabel: string;
      }>;
      generatedScoreText: string;
      canOpenInScore: boolean;
      canTest: boolean;
    }
  | {
      kind: 'tracker';
      target: ScoreObjectEditorTargetSnapshot;
      stepsPerBeat: number;
      showNoteNames: boolean;
      octave: number;
      tracks: Array<{
        trackId: string;
        trackName: string;
        instrumentId: string;
        noteTemplate: string;
        columns: TrackerColumnSnapshot[];
      }>;
      rows: Array<Record<string, string | number | null>>;
      canTest: boolean;
      steps: number;
    }
  | {
      kind: 'structured';
      target: ScoreObjectEditorTargetSnapshot;
      editorFamily: string;
      payloadSummary: string;
      payload: Record<string, unknown>;
    }
  | {
      kind: 'fallback';
      target: ScoreObjectEditorTargetSnapshot;
      reason: 'no-selection' | 'multiple-selection' | 'unsupported' | 'removed-target';
      message: string;
    };

export interface JMaskEditorPayload extends Record<string, unknown> {
  seedUsed: boolean;
  seed: number;
  field: Record<string, unknown>;
}

export interface ScoreObjectEditorDocumentSnapshot {
  target: ScoreObjectEditorTargetSnapshot;
  shared: SharedScoreObjectPropertiesSnapshot;
  editor: TypeSpecificScoreObjectEditorSnapshot;
  timeContext: TimeConversionContext;
}

export interface ScoreObjectEditorRequest {
  target: ScoreObjectEditorTargetSnapshot;
}

export interface ScoreObjectTestResult {
  ok: boolean;
  output: string;
  error?: string;
}

// ─── End Score Object Editor Document Types ───

export interface TrackRef {
  readonly rootGroupId: string;
  readonly trackId: string;
  readonly projectSessionId: number;
  readonly projectRevision: number;
}

export interface TrackItemRef {
  readonly track: TrackRef;
  readonly objectId?: string;
  readonly objectIndex?: number;
}

export interface TrackItemMove {
  readonly source: TrackItemRef;
  readonly destination: TrackRef;
  readonly targetStartBeats: number;
}

export interface TrackItemResize {
  readonly target: TrackItemRef;
  readonly targetStartBeats: number;
  readonly targetDurationBeats: number;
}

export interface TrackItemTransfer {
  readonly objectType?: string;
  readonly type?: string;
  readonly serializedXml?: string;
  readonly name?: string;
  readonly startBeats?: number;
  readonly durationBeats?: number;
  readonly startTimeBase?: string;
  readonly durationTimeBase?: string;
  readonly backgroundColor?: number;
}

export type TrackScorePatch =
  | { type: 'addTrackItem'; track: TrackRef; item: TrackItemTransfer; startBeats: number }
  | { type: 'moveTrackItems'; moves: readonly TrackItemMove[] }
  | { type: 'resizeTrackItems'; resizes: readonly TrackItemResize[] }
  | { type: 'removeTrackItems'; targets: readonly TrackItemRef[] }
  | {
      type: 'replaceTrackNoteProcessorChain';
      track: TrackRef;
      chain: NoteProcessorChainSnapshot | null;
    }
  | { type: 'createTrackInstrument'; track: TrackRef; instrumentType: SupportedNewInstrumentType }
  | { type: 'replaceTrackInstrument'; track: TrackRef; instrument: InstrumentSnapshot }
  | { type: 'clearTrackInstrument'; track: TrackRef }
  | { type: 'updateTrackInstrument'; track: TrackRef; patch: InstrumentPatch };

export interface PatternCellEdit {
  layerId: string;
  cellIndex: number;
  active: boolean;
}

export type PatternScorePatch =
  | {
      type: 'updatePatternCells';
      groupId: string;
      changes: readonly PatternCellEdit[];
    }
  | {
      type: 'updatePatternBeatsLength';
      groupId: string;
      patternBeatsLength: number;
    };

export type ScorePatch =
  | TrackScorePatch
  | PatternScorePatch
  | { type: 'updateTimeState'; patch: Partial<ScoreTimeStateSnapshot> }
  | {
      type: 'updateSharedProperties';
      target: ScoreObjectEditorTargetSnapshot;
      patch: {
        name?: string;
        backgroundColor?: number;
        startTime?: { value: number; timeBase: string };
        subjectiveDuration?: { value: number; timeBase: string };
      };
    }
  | {
      type: 'updateSoundObjectBehavior';
      target: ScoreObjectEditorTargetSnapshot;
      patch: {
        timeBehavior?: string;
        repeatPoint?: { value: number; timeBase: string } | null;
      };
    }
  | {
      type: 'replaceNoteProcessorChain';
      target: ScoreObjectEditorTargetSnapshot;
      chain: NoteProcessorChainSnapshot | null;
    }
  | {
      type: 'replaceAudioFileSource';
      target: ScoreObjectEditorTargetSnapshot;
      filePath: string;
      name: string;
    }
  | {
      type: 'updateAudioFilePostCode';
      target: ScoreObjectEditorTargetSnapshot;
      csoundPostCode: string;
    }
  | {
      type: 'updateTypeSpecificEditor';
      target: ScoreObjectEditorTargetSnapshot;
      patch: Record<string, unknown>;
    }
  | {
      type: 'addScoreObjects';
      groupId: string;
      objects: Array<{
        selectionId?: string;
        layerIndex: number;
        objectType: string;
        name: string;
        startBeats: number;
        durationBeats: number;
        startTimeBase?: string;
        durationTimeBase?: string;
        backgroundColor?: number;
        serializedXml?: string;
        sourceTarget?: ScoreObjectEditorTargetSnapshot;
      }>;
    }
  | {
      type: 'moveScoreObjects';
      moves: Array<{
        target: ScoreObjectEditorTargetSnapshot;
        targetStartBeats: number;
        targetLayerIndex: number;
        targetGroupId: string;
      }>;
    }
  | {
      type: 'removeScoreObjects';
      targets: ScoreObjectEditorTargetSnapshot[];
    }
  | {
      type: 'setScoreObjectBackgroundColors';
      updates: Array<{
        target: ScoreObjectEditorTargetSnapshot;
        backgroundColor: number;
      }>;
    }
  | {
      // Mirrors Java ConvertToObjectBuilderAction: removes a single
      // PythonObject or External and appends a new ObjectBuilder, copying
      // name, note-processor chain, time behavior, start time, subjective
      // duration, and background color. The source's code text becomes the
      // ObjectBuilder's code; an External additionally contributes its command
      // line and forces languageType to EXTERNAL.
      type: 'convertScoreObjectToObjectBuilder';
      target: ScoreObjectEditorTargetSnapshot;
    }
  | {
      type: 'convertToPolyObject';
      targets: ScoreObjectEditorTargetSnapshot[];
      targetGroupId: string;
      targetLayerIndex: number;
      selectionId?: string;
    }
  | {
      type: 'setSubjectiveDurationToObjective';
      targets: ScoreObjectEditorTargetSnapshot[];
    }
  | {
      type: 'addLayer';
      groupId: string;
      layerIndex: number;
    }
  | {
      type: 'removeLayer';
      groupId: string;
      layerIndex: number;
    }
  | {
      type: 'moveLayer';
      groupId: string;
      layerIndex: number;
      targetIndex: number;
    }
  | {
      type: 'moveLayerRange';
      groupId: string;
      startIndex: number;
      endIndex: number;
      targetIndex: number;
    }
  | {
      type: 'removeLayerRanges';
      ranges: ReadonlyArray<{
        groupId: string;
        startIndex: number;
        endIndex: number;
      }>;
      deleteEmptyLayerGroups: boolean;
    }
  | {
      type: 'updateLayerState';
      groupId: string;
      layerIndex: number;
      patch: {
        muted?: boolean;
        solo?: boolean;
        heightIndex?: number;
        backgroundColor?: number;
      };
    }
  | { type: 'renameLayer'; groupId: string; layerIndex: number; name: string }
  | { type: 'addMarker'; timeBeats: number; name?: string }
  | {
      type: 'updateMarker';
      sourceIndex: number;
      patch: { name?: string; timeBeats?: number; timeBase?: string };
    }
  | { type: 'removeMarker'; sourceIndex: number }
  | { type: 'moveLayerGroup'; groupId: string; targetIndex: number }
  | { type: 'renameLayerGroup'; groupId: string; name: string }
  | { type: 'addLayerGroup'; groupType?: ScoreLayerGroupType; insertAtIndex?: number }
  | { type: 'removeLayerGroup'; groupId: string }
  | {
      type: 'replaceScopedNoteProcessorChain';
      scope: 'soundLayer';
      groupId: string;
      layerIndex: number;
      chain: NoteProcessorChainSnapshot | null;
    }
  | {
      type: 'replaceScopedNoteProcessorChain';
      scope: 'layerGroup';
      groupId: string;
      chain: NoteProcessorChainSnapshot | null;
    }
  | {
      type: 'replaceScopedNoteProcessorChain';
      scope: 'rootScore';
      chain: NoteProcessorChainSnapshot | null;
    }
  | {
      type: 'saveNamedNoteProcessorChain';
      name: string;
      chain: NoteProcessorChainSnapshot;
    }
  | {
      type: 'deleteNamedNoteProcessorChain';
      name: string;
    }
  | ScoreAutomationPatch;

// ─── Score Automation Patch Types ───

export interface ScoreAutomationLayerRef {
  rootGroupIndex: number;
  groupId: string;
  layerId: string;
  layerIndex: number;
  layerKind: AutomationLayerKind;
}

export interface AutomationRangeRef {
  startBeat: number;
  endBeat: number;
  layerIds: string[];
  parameterIdsByLayer: Record<string, string[]>;
}

export interface AssignAutomationToLayerPatch {
  type: 'assignAutomationToLayer';
  layer: ScoreAutomationLayerRef;
  parameterId: string;
  enableAutomation?: boolean;
}

export interface RemoveAutomationFromLayerPatch {
  type: 'removeAutomationFromLayer';
  layer: ScoreAutomationLayerRef;
  parameterId: string;
}

export interface MoveAutomationToLayerPatch {
  type: 'moveAutomationToLayer';
  fromLayer: ScoreAutomationLayerRef;
  toLayer: ScoreAutomationLayerRef;
  parameterId: string;
}

export interface ClearLayerAutomationsPatch {
  type: 'clearLayerAutomations';
  layer: ScoreAutomationLayerRef;
}

export interface SelectLayerAutomationPatch {
  type: 'selectLayerAutomation';
  layer: ScoreAutomationLayerRef;
  parameterId?: string;
}

export interface SetAutomationLineColorPatch {
  type: 'setAutomationLineColor';
  parameterId: string;
  lineColor: number;
}

export interface SetAutomationPointsPatch {
  type: 'setAutomationPoints';
  parameterId: string;
  points: AutomationPointSnapshot[];
}

export interface InsertAutomationPointPatch {
  type: 'insertAutomationPoint';
  parameterId: string;
  point: AutomationPointSnapshot;
}

export interface DeleteAutomationPointPatch {
  type: 'deleteAutomationPoint';
  parameterId: string;
  pointIndex: number;
}

export interface MoveAutomationPointPatch {
  type: 'moveAutomationPoint';
  parameterId: string;
  pointIndex: number;
  point: AutomationPointSnapshot;
}

export interface SetAutomationResolutionPatch {
  type: 'setAutomationResolution';
  parameterId: string;
  /** Canonical Java BigDecimal text; never a numeric projection. */
  resolutionDecimal: string;
}

export interface MoveAutomationRangePatch {
  type: 'moveAutomationRange';
  range: AutomationRangeRef;
  beatDelta: number;
  /** @deprecated Use objectIds for Java-shift-gated parity. */
  includeScoreObjects?: boolean;
  /** @deprecated Use objectIds for Java-shift-gated parity. */
  includeAudioClips?: boolean;
  /** Explicit object/clip IDs to transform (Java shift-gated selection model). */
  objectIds?: string[];
}

export interface ScaleAutomationRangePatch {
  type: 'scaleAutomationRange';
  range: AutomationRangeRef;
  anchorBeat: number;
  scaleFactor: number;
  /** @deprecated Use objectIds for Java-shift-gated parity. */
  includeScoreObjects?: boolean;
  /** @deprecated Use objectIds for Java-shift-gated parity. */
  includeAudioClips?: boolean;
  /** Explicit object/clip IDs to transform (Java shift-gated selection model). */
  objectIds?: string[];
}

export interface CleanupLayerAutomationPatch {
  type: 'cleanupLayerAutomation';
  layer: ScoreAutomationLayerRef;
  parameterIds?: string[];
}

export type ScoreAutomationPatch =
  | AssignAutomationToLayerPatch
  | RemoveAutomationFromLayerPatch
  | MoveAutomationToLayerPatch
  | ClearLayerAutomationsPatch
  | SelectLayerAutomationPatch
  | SetAutomationLineColorPatch
  | SetAutomationPointsPatch
  | InsertAutomationPointPatch
  | DeleteAutomationPointPatch
  | MoveAutomationPointPatch
  | SetAutomationResolutionPatch
  | MoveAutomationRangePatch
  | ScaleAutomationRangePatch
  | CleanupLayerAutomationPatch;

// ─── End Score Snapshot Types ───

export type TempoCurveTypeSnapshot = 'constant' | 'linear';

export interface TempoPointSnapshot {
  beat: number;
  tempo: number;
  curveType: TempoCurveTypeSnapshot;
  timeBase?: string;
  positionValue?: number;
}

export interface TempoMapSnapshot {
  enabled: boolean;
  visible: boolean;
  points: TempoPointSnapshot[];
}

export type TempoMapPatch =
  | { type: 'setTempoEnabled'; enabled: boolean }
  | { type: 'setTempoVisible'; visible: boolean }
  | { type: 'addTempoPoint'; point: TempoPointSnapshot }
  | { type: 'updateTempoPoint'; index: number; patch: Partial<TempoPointSnapshot> }
  | { type: 'setTempoCurveType'; index: number; curveType: TempoCurveTypeSnapshot }
  | { type: 'removeTempoPoint'; index: number }
  | { type: 'replaceTempoMap'; map: TempoMapSnapshot };

export interface MeterEntryInput {
  measure: number;
  numBeats: number;
  beatLength: number;
}

export type MeterMapPatch =
  | { type: 'meter-map-set-entry'; measure: number; numBeats: number; beatLength: number }
  | {
      type: 'meter-map-update-entry';
      previousMeasure: number;
      measure: number;
      numBeats: number;
      beatLength: number;
    }
  | { type: 'meter-map-remove-entry'; measure: number }
  | { type: 'meter-map-replace'; entries: MeterEntryInput[] };

export interface MeterSnapshot {
  measure: number;
  numBeats: number;
  beatLength: number;
  startBeat: number;
}

export interface MeterMapSnapshot {
  entries: MeterSnapshot[];
}

interface MeterMapLike {
  getEntries(): ReadonlyArray<{
    measure: number;
    meter: {
      numBeats: number;
      beatLength: number;
    };
  }>;
}

export interface ToolbarProjectTransportSnapshot {
  renderStartTime: number;
  renderEndTime: number;
  loopRendering: boolean;
  tempoMap: TempoMapSnapshot;
  meterMap: MeterMapSnapshot;
  sampleRate: number;
  smpteFrameRate: number;
}

export interface PlaybackClockSnapshot {
  sessionId: number;
  sampleFrames: number;
  sequence: number;
  sampleRate?: number;
  ksmps?: number;
}

export interface ProjectPropertiesSnapshot {
  title: string;
  author: string;
  notes: string;
  sampleRate: string;
  ksmps: string;
  nchnls: string;
  useZeroDbFS: boolean;
  zeroDbFS: string;
  diskSampleRate: string;
  diskKsmps: string;
  diskChannels: string;
  diskUseZeroDbFS: boolean;
  diskZeroDbFS: string;
  useAudioOut: boolean;
  useAudioIn: boolean;
  useMidiIn: boolean;
  useMidiOut: boolean;
  noteAmpsEnabled: boolean;
  outOfRangeEnabled: boolean;
  warningsEnabled: boolean;
  benchmarkEnabled: boolean;
  advancedSettings: string;
  completeOverride: boolean;
  fileName: string;
  askOnRender: boolean;
  diskNoteAmpsEnabled: boolean;
  diskOutOfRangeEnabled: boolean;
  diskWarningsEnabled: boolean;
  diskBenchmarkEnabled: boolean;
  diskAdvancedSettings: string;
  diskCompleteOverride: boolean;
  diskAlwaysRenderEntireProject: boolean;
  mediaFolder: string;
  copyToMediaFileOnImport: boolean;
}

export interface ClojureLibraryEntrySnapshot {
  entryId: string;
  dependencyCoordinates: string;
  version: string;
}

export interface ClojureProjectSnapshot {
  libraryEntries: ClojureLibraryEntrySnapshot[];
}

export interface LiveObjectCellSnapshot {
  uniqueId: string;
  enabled: boolean;
  keyTrigger: number;
  midiTrigger: number;
  displayName: string;
  soundObjectType: string;
  hasSoundObject: boolean;
  serializedXml?: string;
  startBeats?: number;
  durationBeats?: number;
  startTimeBase?: string;
  durationTimeBase?: string;
  backgroundColor?: number;
}

export const BLUE_LIVE_SOUND_OBJECT_TYPES = [
  'External',
  'GenericScore',
  'JMask',
  'ObjectBuilder',
  'PatternObject',
  'PianoRoll',
  'PythonObject',
  'JavaScriptObject',
  'TrackerObject',
] as const;

export type BlueLiveSoundObjectType = (typeof BLUE_LIVE_SOUND_OBJECT_TYPES)[number];

export function isBlueLiveSoundObjectType(value: string): value is BlueLiveSoundObjectType {
  const shortName = value.split('.').pop() ?? value;
  return (BLUE_LIVE_SOUND_OBJECT_TYPES as readonly string[]).includes(shortName);
}

export interface LiveObjectBinsSnapshot {
  columns: number;
  rows: number;
  cells: Array<Array<LiveObjectCellSnapshot | null>>;
}

export interface LiveObjectSetSnapshot {
  name: string;
  liveObjectIds: string[];
}

export interface BlueLiveProjectSnapshot {
  commandLine: string;
  commandLineEnabled: boolean;
  commandLineOverride: boolean;
  tempo: number;
  repeat: number;
  repeatEnabled: boolean;
  liveCodeText: string;
  bins: LiveObjectBinsSnapshot;
  sets: LiveObjectSetSnapshot[];
}

export interface MidiScaleSnapshot {
  scaleName: string;
  baseFrequency: number;
  octave: number;
  ratios: number[];
}

export interface MidiInputProcessorSnapshot {
  keyMapping: string;
  velocityMapping: string;
  pitchConstant: string;
  ampConstant: string;
  scale: MidiScaleSnapshot | null;
}

export type MixerChannelKind = 'instrument' | 'subChannel' | 'master';
export type MixerChainKind = 'pre' | 'post';

export interface EffectSnapshot {
  effectXml: string;
  name: string;
  enabled: boolean;
  numIns: number;
  numOuts: number;
  style: 'CLASSIC' | 'MODERN';
  code: string;
  comments: string;
  editEnabled: boolean;
  gridSettings: GridSettingsSnapshot;
  objectNames: string[];
  widgets: BsbWidgetSnapshot[];
  widgetTree: BsbWidgetNodeSnapshot;
  udos: UdoDefinitionSnapshot[];
}

export interface EffectEditorSnapshot extends EffectSnapshot {
  effectId: string;
  ownerType: 'project' | 'library';
  projectRef?: ProjectEffectRef;
  libraryRef?: LibraryEffectRef;
  /**
   * Derived projection of the active project's global UDO definitions.
   * Project-owned effects receive the live project scope; library-owned effects
   * always receive `[]`. This transient field is never persisted to effect XML.
   */
  projectUdos: UdoDefinitionSnapshot[];
}

export interface EffectEditorRequest {
  effectId: string;
  ownerType: 'project' | 'library';
  projectRef?: ProjectEffectRef;
  libraryRef?: LibraryEffectRef;
}

export interface EffectEditorPatchRequest extends EffectEditorRequest {
  patch: EffectEditablePatch;
}

export interface ProjectEffectRef {
  channelId: string;
  chain: MixerChainKind;
  entryId: string;
}

export interface LibraryEffectRef {
  libraryEffectId: string;
}

export interface MixerEffectEntrySnapshot extends EffectSnapshot {
  entryId: string;
  kind: 'effect';
  projectRef?: ProjectEffectRef;
  libraryRef?: LibraryEffectRef;
}

export interface MixerSendEntrySnapshot {
  entryId: string;
  kind: 'send';
  sendChannel: string;
  level: number;
  enabled: boolean;
}

export type MixerChainEntrySnapshot = MixerEffectEntrySnapshot | MixerSendEntrySnapshot;

export interface MixerChannelSnapshot {
  id: string;
  name: string;
  channelKind: MixerChannelKind;
  association?: string;
  outChannel: string;
  muted: boolean;
  solo: boolean;
  level: number;
  volume: number;
  pan: number;
  preChain: MixerChainEntrySnapshot[];
  postChain: MixerChainEntrySnapshot[];
}

export interface MixerChannelListSnapshot {
  association?: string;
  listName: string;
  listNameEditSupported: boolean;
  channels: MixerChannelSnapshot[];
}

export interface MixerSnapshot {
  enabled: boolean;
  extraRenderTime: number;
  channelListGroups: MixerChannelListSnapshot[];
  channels: MixerChannelSnapshot[];
  subChannels: MixerChannelSnapshot[];
  master: MixerChannelSnapshot;
}

export interface MixerChannelEditableFields {
  name: string;
  outChannel: string;
  muted: boolean;
  solo: boolean;
  level: number;
  volume: number;
  pan: number;
}

export interface EffectEditablePatch {
  effectXml?: string;
  name?: string;
  enabled?: boolean;
  numIns?: number;
  numOuts?: number;
  style?: 'CLASSIC' | 'MODERN';
  code?: string;
  comments?: string;
  bsbInterface?: BsbInterfacePatch;
  opcodeList?: EmbeddedOpcodeListPatch;
}

export interface MixerEffectPatch {
  effectXml?: string;
  name?: string;
  enabled?: boolean;
  numIns?: number;
  numOuts?: number;
  style?: 'CLASSIC' | 'MODERN';
  code?: string;
  comments?: string;
  bsbInterface?: BsbInterfacePatch;
  opcodeList?: EmbeddedOpcodeListPatch;
}

export type MixerFollowUpPatch =
  | { type: 'duplicateChainEntry'; channelId: string; chain: MixerChainKind; entryId: string }
  | { type: 'copyChainEntry'; channelId: string; chain: MixerChainKind; entryId: string }
  | {
      type: 'pasteChainEntries';
      channelId: string;
      chain: MixerChainKind;
      index?: number;
      payload: MixerChainClipboardPayload;
    }
  | {
      type: 'moveChainEntryAcrossChains';
      fromChannelId: string;
      fromChain: MixerChainKind;
      toChannelId: string;
      toChain: MixerChainKind;
      entryId: string;
      index?: number;
    };

export interface MixerChainClipboardPayload {
  sourceKind: 'project';
  entries: MixerChainEntrySnapshot[];
}

export type MixerPatch =
  | { type: 'setMixerEnabled'; value: boolean }
  | { type: 'updateExtraRenderTime'; value: number }
  | { type: 'renameChannelListGroup'; association: string; name: string }
  | { type: 'updateChannel'; channelId: string; patch: Partial<MixerChannelEditableFields> }
  | { type: 'addSubChannel'; name?: string; insertIndex?: number; channelId?: string }
  | { type: 'removeSubChannel'; channelId: string }
  | {
      type: 'addEffectFromLibrary';
      channelId: string;
      chain: MixerChainKind;
      libraryEffectId: string;
      effectXml?: string;
      insertIndex?: number;
      entryId?: string;
    }
  | {
      type: 'addSend';
      channelId: string;
      chain: MixerChainKind;
      sendChannel?: string;
      level?: number;
      insertIndex?: number;
      entryId?: string;
    }
  | {
      type: 'updateSend';
      channelId: string;
      chain: MixerChainKind;
      entryId: string;
      patch: { sendChannel?: string; level?: number; enabled?: boolean };
    }
  | {
      type: 'updateEffect';
      channelId: string;
      chain: MixerChainKind;
      entryId: string;
      patch: EffectEditablePatch;
    }
  | { type: 'removeChainEntry'; channelId: string; chain: MixerChainKind; entryId: string }
  | {
      type: 'reorderChainEntry';
      channelId: string;
      chain: MixerChainKind;
      from: number;
      to: number;
    }
  | MixerFollowUpPatch;

export interface EffectsLibraryCategorySnapshot {
  categoryId: string;
  name: string;
  categories: EffectsLibraryCategorySnapshot[];
  effects: LibraryEffectSnapshot[];
}

export interface LibraryEffectSnapshot extends EffectSnapshot {
  libraryEffectId: string;
  categoryId?: string;
}

export interface EffectsLibrarySnapshot {
  loaded: boolean;
  sourcePath: string | null;
  loadError?: string;
  root: EffectsLibraryCategorySnapshot;
}

export type EffectsLibraryPatch =
  | {
      type: 'addCategory';
      parentCategoryId?: string;
      name?: string;
      insertIndex?: number;
      categoryId?: string;
    }
  | {
      type: 'addEffect';
      parentCategoryId?: string;
      name?: string;
      insertIndex?: number;
      effectId?: string;
      style?: 'CLASSIC' | 'MODERN';
    }
  | { type: 'renameCategory'; categoryId: string; name: string }
  | { type: 'reorderCategory'; parentCategoryId?: string; from: number; to: number }
  | { type: 'removeCategory'; categoryId: string }
  | { type: 'renameEffect'; effectId: string; name: string }
  | { type: 'duplicateEffect'; effectId: string; insertIndex?: number; libraryEffectId?: string }
  | { type: 'removeEffect'; effectId: string }
  | { type: 'updateEffect'; effectId: string; patch: EffectEditablePatch }
  | {
      type: 'pasteCategory';
      parentCategoryId?: string;
      sourceSnapshot: EffectsLibraryCategorySnapshot;
    }
  | { type: 'pasteEffect'; parentCategoryId?: string; sourceEffect: LibraryEffectSnapshot }
  | { type: 'moveNode'; nodeId: string; targetParentCategoryId?: string; targetIndex: number };

export type MidiInputPatch =
  | { type: 'updateKeyMapping'; value: string }
  | { type: 'updateVelocityMapping'; value: string }
  | { type: 'updatePitchConstant'; value: string }
  | { type: 'updateAmpConstant'; value: string }
  | { type: 'updateScale'; scale: MidiScaleSnapshot | null };

/**
 * Serializable instrument target for a Blue Live note request.
 *
 * - `track`: a Track-owned instrument, addressed by its stable project Track id.
 * - `orchestra`: an Orchestra assignment, addressed by its stable assignment id.
 * - `channel`: the pre-Spec-067 compatibility path; the runtime instrument is the
 *   one the existing channel-indexed behavior resolves.
 *
 * The optional `target`/`liveSessionId` request fields are the Spec 067 focus-routing
 * bridge. Omitting `target` keeps the legacy direct-channel meaning so existing callers
 * migrate safely.
 */
export type BlueLiveNoteTarget =
  | { kind: 'track'; trackId: string }
  | { kind: 'orchestra'; assignmentId: string }
  | { kind: 'channel'; channel: number };

export interface BlueLiveNoteTriggerRequest {
  type: 'noteOn' | 'noteOff';
  midiNote: number;
  velocity: number;
  channel: number;
  source: 'mouse' | 'computer' | 'hardware';
  /** Stable runtime source identity for hardware events (e.g. `midi:<port-id>`). */
  sourceId?: string;
  /** Hardware device ID, when sourced from a physical MIDI input. */
  deviceId?: string;
  /** Source high-resolution timestamp when available. */
  timestamp?: number;
  /**
   * Optional Spec 067 focus-routing target. Omission normalizes to
   * `{ kind: 'channel', channel: request.channel }` for compatibility.
   */
  target?: BlueLiveNoteTarget;
  /**
   * Optional Blue Live session fence. The shared focus-aware router always supplies
   * the current main-owned session id; main rejects a supplied id that does not match
   * the active Blue Live session. Omission remains accepted for legacy callers.
   */
  liveSessionId?: number;
}

export interface BlueLiveNoteTriggerResult {
  ok: boolean;
  message?: string;
  submittedScoreText?: string;
}

export interface LayerIndexRange {
  groupId: string;
  startIndex: number;
  endIndex: number;
}

export function isValidLayerRange(
  startIndex: number,
  endIndex: number,
  groupLength: number,
): boolean {
  return (
    Number.isInteger(startIndex) &&
    Number.isInteger(endIndex) &&
    Number.isInteger(groupLength) &&
    groupLength >= 0 &&
    startIndex >= 0 &&
    endIndex >= startIndex &&
    endIndex < groupLength
  );
}

export function isValidLayerRangeTarget(
  startIndex: number,
  endIndex: number,
  targetIndex: number,
  groupLength: number,
): boolean {
  if (!isValidLayerRange(startIndex, endIndex, groupLength) || !Number.isInteger(targetIndex)) {
    return false;
  }
  const count = endIndex - startIndex + 1;
  return targetIndex >= 0 && targetIndex <= groupLength - count;
}

export function areLayerRangesValid(
  ranges: readonly LayerIndexRange[],
  getGroupLength: (groupId: string) => number | undefined,
): boolean {
  if (!Array.isArray(ranges) || ranges.length === 0) return false;

  const rangesByGroup = new Map<string, LayerIndexRange[]>();
  for (const range of ranges) {
    if (!range || typeof range.groupId !== 'string' || range.groupId.trim().length === 0) {
      return false;
    }
    const groupLength = getGroupLength(range.groupId);
    if (
      groupLength === undefined ||
      !isValidLayerRange(range.startIndex, range.endIndex, groupLength)
    ) {
      return false;
    }
    const groupRanges = rangesByGroup.get(range.groupId) ?? [];
    groupRanges.push(range);
    rangesByGroup.set(range.groupId, groupRanges);
  }

  for (const groupRanges of rangesByGroup.values()) {
    groupRanges.sort((left, right) => left.startIndex - right.startIndex);
    for (let i = 1; i < groupRanges.length; i++) {
      if (groupRanges[i - 1]!.endIndex >= groupRanges[i]!.startIndex) {
        return false;
      }
    }
  }

  return true;
}

export type BlueLivePatch =
  | {
      type: 'updateOptions';
      patch: Partial<
        Pick<BlueLiveProjectSnapshot, 'commandLine' | 'commandLineEnabled' | 'commandLineOverride'>
      >;
    }
  | {
      type: 'updateTempoRepeat';
      patch: Partial<Pick<BlueLiveProjectSnapshot, 'tempo' | 'repeat' | 'repeatEnabled'>>;
    }
  | { type: 'updateLiveCodeText'; text: string }
  | { type: 'setCellEnabled'; column: number; row: number; enabled: boolean }
  | { type: 'setCell'; column: number; row: number; cell: LiveObjectCellSnapshot | null }
  | { type: 'insertRow'; index: number }
  | { type: 'removeRow'; index: number }
  | { type: 'insertColumn'; index: number }
  | { type: 'removeColumn'; index: number }
  | { type: 'captureEnabledSet' }
  | { type: 'renameSet'; index: number; name: string }
  | { type: 'removeSet'; index: number }
  | { type: 'moveSet'; from: number; to: number }
  | { type: 'applySet'; index: number };

export interface ProjectEditorSnapshot {
  filePath: string | null;
  version: string;
  sessionId: number;
  globalOrc: string;
  globalSco: string;
  orchestra: OrchestraSnapshot;
  mixer?: MixerSnapshot;
  projectProperties: ProjectPropertiesSnapshot;
  clojureProject: ClojureProjectSnapshot;
  transport: ToolbarProjectTransportSnapshot;
  tablesText: string;
  scratchPad: ScratchPadSnapshot;
  projectUdos: UdoDefinitionSnapshot[];
  loaded: boolean;
  blueLive?: BlueLiveProjectSnapshot;
  midiInput?: MidiInputProcessorSnapshot;
  score?: ScoreDocumentSnapshot;
  namedChains?: NamedChainListSnapshot;
}

export interface ProjectSummarySnapshot {
  title?: string;
  author?: string;
  sampleRate?: string;
  version?: string;
  filePath?: string | null;
}

export interface ProjectDocumentPatch {
  globalOrc?: string;
  globalSco?: string;
  orchestra?: OrchestraPatch;
  mixer?: MixerPatch;
  projectProperties?: Partial<ProjectPropertiesSnapshot>;
  clojureProject?: ClojureProjectSnapshot;
  transport?: Partial<
    Pick<ToolbarProjectTransportSnapshot, 'renderStartTime' | 'renderEndTime' | 'loopRendering'>
  > & {
    tempoMap?: Partial<TempoMapSnapshot>;
    tempoMapPatch?: TempoMapPatch;
    meterMapPatch?: MeterMapPatch;
  };
  tablesText?: string;
  scratchPad?: ScratchPadPatch;
  projectUdo?: ProjectUdoPatch;
  blueLive?: BlueLivePatch;
  midiInput?: MidiInputPatch;
  score?: ScorePatch;
}

export interface ScratchPadSnapshot {
  text: string;
  wordWrapEnabled: boolean;
}

export type ScratchPadPatch = Partial<ScratchPadSnapshot>;

export interface ProjectDocumentCommitReceipt {
  revision: number;
  sessionId: number;
  /**
   * True if at least one patch in the committed batch mutated canonical project
   * data. Advances in `revision` happen only when `changed` is true. An
   * all-no-op or rejected batch returns `changed: false` with the unchanged
   * revision so live commands do not falsely treat a clean no-op as a fence
   * break.
   */
  changed: boolean;
  /**
   * True when the corresponding patch mutated canonical project data. A
   * valid no-op is false here even when the patch was accepted.
   */
  patchChanged?: boolean[];
  /**
   * True when the corresponding patch was accepted by canonical validation,
   * in the same order as the request. A valid no-op is true here. Older
   * non-document mutation receipts may omit this field; document patch
   * commits provide it so mixed batches cannot hide a rejected score-color
   * operation behind an unrelated successful edit.
   */
  patchAccepted?: boolean[];
}

export interface ProjectDocumentPatchContext {
  readonly projectSessionId: number;
  readonly projectRevision: number;
  readonly defaultLayerGroupType?: 'TRACK' | 'SOUND_OBJECT';
}

// ─── Legacy Blue Live Manual Trigger contract ───

/**
 * Renderer intent for a Manual Trigger. The `selected` mode targets exactly
 * one stable LiveObject identity regardless of its persistent enabled flag;
 * the `enabled` mode targets every non-null enabled LiveObject in
 * column-major order. Row/column indices are never canonical identity.
 */
export type LegacyBlueLiveTriggerRequest =
  | { mode: 'selected'; liveObjectId: string }
  | { mode: 'enabled' };

export type LegacyBlueLiveTriggerStatus =
  | 'submitted'
  | 'empty'
  | 'busy'
  | 'rejected'
  | 'failed'
  | 'stale';

export type LegacyBlueLiveTriggerErrorCode =
  | 'no-project'
  | 'not-running'
  | 'invalid-request'
  | 'target-not-found'
  | 'invalid-tempo'
  | 'runtime-unavailable'
  | 'generation-failed'
  | 'stale-document'
  | 'stale-session'
  | 'engine-rejected';

/**
 * Typed result of a Manual Trigger crossing the renderer→preload→main
 * boundary. `ok` is true only for `submitted` and benign `empty` outcomes.
 * Runtime feedback never alters cell color, enabled flags, saved sets, or
 * `.blue` XML.
 */
export interface LegacyBlueLiveTriggerResult {
  ok: boolean;
  status: LegacyBlueLiveTriggerStatus;
  code?: LegacyBlueLiveTriggerErrorCode;
  message?: string;
  targetCount: number;
  noteCount: number;
  documentRevision: number;
  blueLiveSessionId: number;
}

/**
 * Validate a legacy Blue Live trigger request at the boundary. Returns an
 * error code string when the request is malformed, or `null` when valid.
 */
export function validateLegacyBlueLiveTriggerRequest(
  request: unknown,
): LegacyBlueLiveTriggerErrorCode | null {
  if (!request || typeof request !== 'object') return 'invalid-request';
  const req = request as Record<string, unknown>;
  if (req.mode === 'selected') {
    if (typeof req.liveObjectId !== 'string' || req.liveObjectId.trim() === '') {
      return 'invalid-request';
    }
    return null;
  }
  if (req.mode === 'enabled') {
    return null;
  }
  return 'invalid-request';
}

export type BsbRealtimeControlKind = 'value' | 'selected' | 'selectedIndex' | 'xy' | 'sliderBank';

export type BsbRealtimeControlTarget =
  | {
      assignmentId: string;
      track?: never;
    }
  | {
      assignmentId?: never;
      track: Pick<TrackRef, 'projectSessionId' | 'rootGroupId' | 'trackId'>;
    };

interface BsbRealtimeControlBase {
  widgetId: string;
}

type BsbRealtimeControlValue =
  | { kind: 'value'; payload: { value: number } }
  | { kind: 'selected'; payload: { selected: boolean } }
  | { kind: 'selectedIndex'; payload: { selectedIndex: number } }
  | { kind: 'xy'; payload: { xValue: number; yValue: number } }
  | { kind: 'sliderBank'; payload: { sliderIndex: number; value: number } };

export type BsbRealtimeControlUpdate = BsbRealtimeControlTarget &
  BsbRealtimeControlBase &
  BsbRealtimeControlValue;

export function createBsbRealtimeControlUpdate(
  target: BsbRealtimeControlTarget,
  patch: BsbInterfacePatch,
): BsbRealtimeControlUpdate | undefined {
  switch (patch.type) {
    case 'updateWidgetProperties': {
      const properties = patch.properties;
      if (typeof properties.value === 'number') {
        return {
          ...target,
          widgetId: patch.widgetId,
          kind: 'value',
          payload: { value: properties.value },
        };
      }

      if (typeof properties.selectedIndex === 'number') {
        return {
          ...target,
          widgetId: patch.widgetId,
          kind: 'selectedIndex',
          payload: { selectedIndex: properties.selectedIndex },
        };
      }

      if (typeof properties.selected === 'boolean') {
        return {
          ...target,
          widgetId: patch.widgetId,
          kind: 'selected',
          payload: { selected: properties.selected },
        };
      }

      if (typeof properties.xValue === 'number' && typeof properties.yValue === 'number') {
        return {
          ...target,
          widgetId: patch.widgetId,
          kind: 'xy',
          payload: { xValue: properties.xValue, yValue: properties.yValue },
        };
      }

      return undefined;
    }
    case 'updateSliderBankValue':
      return {
        ...target,
        widgetId: patch.widgetId,
        kind: 'sliderBank',
        payload: {
          value: patch.value,
          sliderIndex: patch.sliderIndex,
        },
      };
    default:
      return undefined;
  }
}

export function isBsbRealtimeControlUpdate(value: unknown): value is BsbRealtimeControlUpdate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.widgetId !== 'string' || candidate.widgetId.trim() === '') return false;
  if (!candidate.payload || typeof candidate.payload !== 'object') return false;

  const hasAssignmentTarget = Object.prototype.hasOwnProperty.call(candidate, 'assignmentId');
  const hasTrackTarget = Object.prototype.hasOwnProperty.call(candidate, 'track');
  if (hasAssignmentTarget === hasTrackTarget) return false;

  const hasValidAssignment =
    typeof candidate.assignmentId === 'string' && candidate.assignmentId.trim() !== '';
  const track =
    candidate.track && typeof candidate.track === 'object'
      ? (candidate.track as Record<string, unknown>)
      : null;
  const hasValidTrack =
    track !== null &&
    typeof track.rootGroupId === 'string' &&
    track.rootGroupId.trim() !== '' &&
    typeof track.trackId === 'string' &&
    track.trackId.trim() !== '' &&
    typeof track.projectSessionId === 'number' &&
    Number.isInteger(track.projectSessionId) &&
    track.projectSessionId >= 0;
  if (hasAssignmentTarget ? !hasValidAssignment : !hasValidTrack) return false;

  const payload = candidate.payload as Record<string, unknown>;
  switch (candidate.kind) {
    case 'value':
      return typeof payload.value === 'number' && Number.isFinite(payload.value);
    case 'selected':
      return typeof payload.selected === 'boolean';
    case 'selectedIndex':
      return typeof payload.selectedIndex === 'number' && Number.isFinite(payload.selectedIndex);
    case 'xy':
      return (
        typeof payload.xValue === 'number' &&
        Number.isFinite(payload.xValue) &&
        typeof payload.yValue === 'number' &&
        Number.isFinite(payload.yValue)
      );
    case 'sliderBank':
      return (
        typeof payload.sliderIndex === 'number' &&
        Number.isInteger(payload.sliderIndex) &&
        payload.sliderIndex >= 0 &&
        typeof payload.value === 'number' &&
        Number.isFinite(payload.value)
      );
    default:
      return false;
  }
}

export interface MixerRealtimeLevelUpdate {
  channelId: string;
  level: number;
}

export interface EffectRealtimeUpdate {
  channelId: string;
  chain: 'pre' | 'post';
  entryId: string;
  bsbWidgetValues?: Record<string, number>;
}

export type SupportedNewInstrumentType =
  | 'generic'
  | 'python'
  | 'javascript'
  | 'blueX7'
  | 'blueSynthBuilder';

export type InstrumentSnapshot =
  | GenericInstrumentSnapshot
  | JavaScriptInstrumentSnapshot
  | PythonInstrumentSnapshot
  | BlueX7InstrumentSnapshot
  | BlueSynthBuilderInstrumentSnapshot
  | UnknownInstrumentSnapshot;

export interface InstrumentSnapshotBase {
  assignmentId: string;
  type: string;
  name: string;
  enabled: boolean;
  comment: string;
}

export interface GenericInstrumentSnapshot extends InstrumentSnapshotBase {
  type: 'generic';
  text: string;
  globalOrc: string;
  globalSco: string;
  udolist: UdoDefinitionSnapshot[];
}

export interface JavaScriptInstrumentSnapshot extends InstrumentSnapshotBase {
  type: 'javascript';
  text: string;
  globalOrc: string;
  globalSco: string;
  udolist: UdoDefinitionSnapshot[];
}

export interface PythonInstrumentSnapshot extends InstrumentSnapshotBase {
  type: 'python';
  text: string;
  globalOrc: string;
  globalSco: string;
  udolist: UdoDefinitionSnapshot[];
}

export type BlueX7Patch =
  | { type: 'setCommonField'; field: keyof BlueX7Common; value: unknown }
  | { type: 'setOperatorEnabled'; operatorIndex: number; enabled: boolean }
  | { type: 'setLfoField'; field: keyof BlueX7Lfo; value: unknown }
  | { type: 'setOperatorField'; operatorIndex: number; field: keyof BlueX7Operator; value: unknown }
  | { type: 'setSharedOscillatorSync'; value: number }
  | { type: 'setSharedPitchModulationSensitivity'; value: number }
  | {
      type: 'setOperatorEnvelopePoint';
      operatorIndex: number;
      stageIndex: number;
      point: BlueX7EnvelopePoint;
    }
  | { type: 'setPitchEnvelopePoint'; stageIndex: number; point: BlueX7EnvelopePoint }
  | { type: 'setCsoundPostCode'; text: string }
  | { type: 'replaceVoice'; voice: BlueX7Voice };

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/**
 * BlueX7 patch-field domains are derived from the authoritative parameter
 * catalog (Spec 092) so editor widgets, patch validation, the automation
 * chooser, and engine quantization share one source of truth. The
 * field→semantic-key maps below are the only hand-maintained link between
 * voice field names and catalog descriptors; an unmapped or renamed catalog
 * key fails loudly at module load rather than silently validating nothing.
 */
function catalogFieldRange(key: string): readonly [number, number] {
  const descriptor = getBlueX7Descriptor(key);
  if (!descriptor) {
    throw new Error(`BlueX7 parameter catalog is missing descriptor '${key}'`);
  }
  return [descriptor.minimum, descriptor.maximum];
}

function deriveFieldRanges<TField extends string>(
  catalogKeys: Readonly<Partial<Record<TField, string>>>,
): Partial<Record<TField, readonly [number, number]>> {
  const ranges: Partial<Record<TField, readonly [number, number]>> = {};
  for (const field of Object.keys(catalogKeys) as TField[]) {
    ranges[field] = catalogFieldRange(catalogKeys[field] as string);
  }
  return ranges;
}

const BLUE_X7_OPERATOR_FIELD_RANGES = deriveFieldRanges<keyof BlueX7Operator>({
  mode: 'operator.1.oscillatorMode',
  // The per-operator sync and pitch-modulation fields back the editor-shared
  // controls, whose domains live on the shared catalog descriptors.
  sync: 'common.oscillatorKeySync',
  freqCoarse: 'operator.1.frequencyCoarse',
  freqFine: 'operator.1.frequencyFine',
  detune: 'operator.1.detune',
  breakpoint: 'operator.1.breakpoint',
  curveLeft: 'operator.1.curveLeft',
  curveRight: 'operator.1.curveRight',
  depthLeft: 'operator.1.depthLeft',
  depthRight: 'operator.1.depthRight',
  keyboardRateScaling: 'operator.1.keyboardRateScaling',
  outputLevel: 'operator.1.outputLevel',
  velocitySensitivity: 'operator.1.velocitySensitivity',
  modulationAmplitude: 'operator.1.amplitudeModulationSensitivity',
  modulationPitch: 'lfo.pitchModulationSensitivity',
});

const BLUE_X7_LFO_FIELD_RANGES = deriveFieldRanges<keyof BlueX7Lfo>({
  speed: 'lfo.speed',
  delay: 'lfo.delay',
  pitchModulationDepth: 'lfo.pitchModulationDepth',
  amplitudeModulationDepth: 'lfo.amplitudeModulationDepth',
  wave: 'lfo.wave',
  sync: 'lfo.sync',
});

const BLUE_X7_COMMON_FIELD_RANGES = deriveFieldRanges<keyof BlueX7Common>({
  keyTranspose: 'common.transpose',
  algorithm: 'common.algorithm',
  feedback: 'common.feedback',
});

const BLUE_X7_SHARED_SYNC_RANGE = catalogFieldRange('common.oscillatorKeySync');
const BLUE_X7_SHARED_PMS_RANGE = catalogFieldRange('lfo.pitchModulationSensitivity');
const BLUE_X7_OPERATOR_ENVELOPE_POINT_RANGES = {
  rate: catalogFieldRange('operator.1.envelope.1.rate'),
  level: catalogFieldRange('operator.1.envelope.1.level'),
} as const;
const BLUE_X7_PITCH_ENVELOPE_POINT_RANGES = {
  rate: catalogFieldRange('pitchEnvelope.1.rate'),
  level: catalogFieldRange('pitchEnvelope.1.level'),
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isEnvelopePoint = (value: unknown): boolean =>
  isRecord(value) && inRange(value.rate, 0, 99) && inRange(value.level, 0, 99);

/** Validate every scalar and nested collection before cloneBlueX7Voice runs. */
export function isValidBlueX7Voice(value: unknown): value is BlueX7Voice {
  if (!isRecord(value) || !isRecord(value.common) || !isRecord(value.lfo)) {
    return false;
  }

  const common = value.common;
  const operatorEnabled = common.operatorEnabled;
  if (
    !Array.isArray(operatorEnabled) ||
    operatorEnabled.length !== 6 ||
    !operatorEnabled.every((enabled) => typeof enabled === 'boolean') ||
    !inRange(common.algorithm, 1, 32) ||
    !inRange(common.feedback, 0, 7) ||
    !inRange(common.keyTranspose, 0, 48)
  ) {
    return false;
  }

  const lfo = value.lfo;
  if (
    !inRange(lfo.speed, 0, 99) ||
    !inRange(lfo.delay, 0, 99) ||
    !inRange(lfo.pitchModulationDepth, 0, 99) ||
    !inRange(lfo.amplitudeModulationDepth, 0, 99) ||
    !inRange(lfo.wave, 0, 5) ||
    !inRange(lfo.sync, 0, 1)
  ) {
    return false;
  }

  if (!Array.isArray(value.operators) || value.operators.length !== 6) {
    return false;
  }
  for (const operatorValue of value.operators) {
    if (
      !isRecord(operatorValue) ||
      !Array.isArray(operatorValue.envelope) ||
      operatorValue.envelope.length !== 4
    ) {
      return false;
    }
    if (
      !inRange(operatorValue.mode, 0, 1) ||
      !inRange(operatorValue.sync, 0, 1) ||
      !inRange(operatorValue.freqCoarse, 0, 31) ||
      !inRange(operatorValue.freqFine, 0, 99) ||
      !inRange(operatorValue.detune, -7, 7) ||
      !inRange(operatorValue.breakpoint, 0, 99) ||
      !inRange(operatorValue.curveLeft, 0, 3) ||
      !inRange(operatorValue.curveRight, 0, 3) ||
      !inRange(operatorValue.depthLeft, 0, 99) ||
      !inRange(operatorValue.depthRight, 0, 99) ||
      !inRange(operatorValue.keyboardRateScaling, 0, 7) ||
      !inRange(operatorValue.outputLevel, 0, 99) ||
      !inRange(operatorValue.velocitySensitivity, 0, 14) ||
      !inRange(operatorValue.modulationAmplitude, 0, 3) ||
      !inRange(operatorValue.modulationPitch, 0, 7) ||
      !operatorValue.envelope.every(isEnvelopePoint)
    ) {
      return false;
    }
  }

  return (
    Array.isArray(value.pitchEnvelope) &&
    value.pitchEnvelope.length === 4 &&
    value.pitchEnvelope.every(isEnvelopePoint) &&
    typeof value.csoundPostCode === 'string'
  );
}

/**
 * Validate a semantic BlueX7 patch against the documented parameter domains.
 * Invalid patches are rejected whole (no partial mutation), satisfying the
 * spec's "values outside valid domains are reported or safely normalized
 * without corrupting neighboring data" edge case. Whole-voice replacement
 * (SysEx import) is checked recursively, while retaining the Java-blue bank
 * velocity-sensitivity packed-bit range (0..14) for parity.
 */
export function isValidBlueX7Patch(patch: BlueX7Patch): boolean {
  if (!patch || typeof patch !== 'object') {
    return false;
  }
  switch (patch.type) {
    case 'setCommonField': {
      if (patch.field === 'operatorEnabled') {
        return (
          Array.isArray(patch.value) &&
          patch.value.length === 6 &&
          patch.value.every((v: unknown) => typeof v === 'boolean')
        );
      }
      const range = BLUE_X7_COMMON_FIELD_RANGES[patch.field];
      return range ? inRange(patch.value, range[0], range[1]) : false;
    }
    case 'setOperatorEnabled':
      return inRange(patch.operatorIndex, 0, 5) && typeof patch.enabled === 'boolean';
    case 'setLfoField': {
      const range = BLUE_X7_LFO_FIELD_RANGES[patch.field];
      return range ? inRange(patch.value, range[0], range[1]) : false;
    }
    case 'setOperatorField': {
      if (!inRange(patch.operatorIndex, 0, 5)) {
        return false;
      }
      const range = BLUE_X7_OPERATOR_FIELD_RANGES[patch.field];
      return range ? inRange(patch.value, range[0], range[1]) : false;
    }
    case 'setSharedOscillatorSync':
      return inRange(patch.value, BLUE_X7_SHARED_SYNC_RANGE[0], BLUE_X7_SHARED_SYNC_RANGE[1]);
    case 'setSharedPitchModulationSensitivity':
      return inRange(patch.value, BLUE_X7_SHARED_PMS_RANGE[0], BLUE_X7_SHARED_PMS_RANGE[1]);
    case 'setOperatorEnvelopePoint':
      return (
        inRange(patch.operatorIndex, 0, 5) &&
        inRange(patch.stageIndex, 0, 3) &&
        isRecord(patch.point) &&
        inRange(
          patch.point.rate,
          BLUE_X7_OPERATOR_ENVELOPE_POINT_RANGES.rate[0],
          BLUE_X7_OPERATOR_ENVELOPE_POINT_RANGES.rate[1],
        ) &&
        inRange(
          patch.point.level,
          BLUE_X7_OPERATOR_ENVELOPE_POINT_RANGES.level[0],
          BLUE_X7_OPERATOR_ENVELOPE_POINT_RANGES.level[1],
        )
      );
    case 'setPitchEnvelopePoint':
      return (
        inRange(patch.stageIndex, 0, 3) &&
        isRecord(patch.point) &&
        inRange(
          patch.point.rate,
          BLUE_X7_PITCH_ENVELOPE_POINT_RANGES.rate[0],
          BLUE_X7_PITCH_ENVELOPE_POINT_RANGES.rate[1],
        ) &&
        inRange(
          patch.point.level,
          BLUE_X7_PITCH_ENVELOPE_POINT_RANGES.level[0],
          BLUE_X7_PITCH_ENVELOPE_POINT_RANGES.level[1],
        )
      );
    case 'setCsoundPostCode':
      return typeof patch.text === 'string';
    case 'replaceVoice':
      return isValidBlueX7Voice(patch.voice);
    default:
      return false;
  }
}

export interface BlueX7InstrumentSnapshot extends InstrumentSnapshotBase {
  type: 'blueX7';
  /** Stable runtime owner identity; never derived from the display name. */
  ownerIdentity?: string;
  voice: BlueX7Voice;
  sharedOscillatorSync?: number | 'mixed';
  sharedPitchModulationSensitivity?: number | 'mixed';
  /** Durable Parameter identity plus display authority for live readback. */
  parameters?: BlueX7ParameterSnapshot[];
}

export interface BlueX7ParameterSnapshot {
  parameterId: string;
  semanticKey: string;
  fixedValue: number;
  automationEnabled: boolean;
  label?: string;
  curve?: string;
  lineColor?: number;
  points?: AutomationPointSnapshot[];
}

export interface BlueSynthBuilderInstrumentSnapshot extends InstrumentSnapshotBase {
  type: 'blueSynthBuilder';
  instrumentText: string;
  alwaysOnInstrumentText: string;
  globalOrc: string;
  globalSco: string;
  objectNames: string[];
  widgets: BsbWidgetSnapshot[];
  editEnabled: boolean;
  gridSettings: GridSettingsSnapshot;
  widgetTree: BsbWidgetNodeSnapshot;
  presetGroup?: PresetGroupSnapshot;
  opcodeListText?: string;
  udolist?: UdoDefinitionSnapshot[];
  automationParameters?: SoundAutomationParameterSnapshot[];
}

export interface UdoDefinitionSnapshot {
  name: string;
  style: 'CLASSIC' | 'MODERN';
  outTypes: string;
  inTypes: string;
  inputArguments: string;
  code: string;
  comments: string;
}

export type EmbeddedOpcodeListPatch =
  | { type: 'addUdo'; index?: number; definition?: UdoDefinitionSnapshot }
  | { type: 'removeUdo'; index: number }
  | { type: 'updateUdo'; index: number; patch: Partial<UdoDefinitionSnapshot> }
  | { type: 'convertUdoStyle'; index: number; style: 'CLASSIC' | 'MODERN' }
  | { type: 'reorderUdo'; from: number; to: number };

export type ProjectUdoPatch =
  | { type: 'add'; index?: number; definition?: UdoDefinitionSnapshot }
  | { type: 'remove'; index: number }
  | { type: 'update'; index: number; patch: Partial<UdoDefinitionSnapshot> }
  | { type: 'reorder'; from: number; to: number }
  | { type: 'convertStyle'; index: number; style: 'CLASSIC' | 'MODERN' };

export interface BsbWidgetSnapshot {
  objectName: string;
  widgetType: string;
  value: number;
  minimum: number;
  maximum: number;
}

export interface GridSettingsSnapshot {
  enabled: boolean;
  snapEnabled: boolean;
  width: number;
  height: number;
  gridStyle: 'NONE' | 'DOT' | 'LINE';
}

export interface BsbWidgetNodeSnapshot {
  id: string;
  type: string;
  objectName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  minimum: number;
  maximum: number;
  editable: boolean;
  preservedOnly?: boolean;
  properties: Record<string, unknown>;
  children?: BsbWidgetNodeSnapshot[];
}

export interface PresetGroupSnapshot {
  name: string;
  currentPresetUniqueId?: string;
  currentPresetModified: boolean;
  subGroups: PresetGroupSnapshot[];
  presets: PresetSnapshot[];
}

export interface PresetSnapshot {
  uniqueId: string;
  name: string;
  values?: Record<string, string>;
}

export type BsbInterfacePatch =
  | { type: 'setEditEnabled'; value: boolean }
  | { type: 'selectWidget'; widgetId?: string }
  | { type: 'updateWidgetProperties'; widgetId: string; properties: Record<string, unknown> }
  | { type: 'updateSliderBankValue'; widgetId: string; sliderIndex: number; value: number }
  | { type: 'moveWidget'; widgetId: string; x: number; y: number }
  | { type: 'resizeWidget'; widgetId: string; width: number; height: number }
  | { type: 'addWidget'; widgetType: string; x: number; y: number; parentGroupId?: string }
  | { type: 'removeWidget'; widgetId: string }
  | { type: 'updateGridSettings'; patch: Partial<GridSettingsSnapshot> }
  | { type: 'applyPreset'; presetUniqueId: string }
  | { type: 'updatePreset'; presetUniqueId: string }
  | { type: 'addPreset'; presetName: string; presetGroupPath?: number[] }
  | { type: 'addPresetGroup'; groupName: string; parentGroupPath?: number[] }
  | { type: 'addPresetFromSnapshot'; parentGroupPath: number[]; preset: PresetSnapshot }
  | { type: 'addPresetGroupFromSnapshot'; parentGroupPath: number[]; group: PresetGroupSnapshot }
  | { type: 'renamePreset'; presetUniqueId: string; name: string }
  | { type: 'renamePresetGroup'; groupPath: number[]; name: string }
  | { type: 'removePreset'; presetUniqueId: string }
  | { type: 'removePresetGroup'; groupPath: number[] }
  | { type: 'movePreset'; presetUniqueId: string; parentGroupPath: number[]; targetIndex: number }
  | { type: 'movePresetGroup'; groupPath: number[]; parentGroupPath: number[]; targetIndex: number }
  | { type: 'synchronizePresets' }
  | { type: 'updateEmbeddedOpcodeList'; opcodeList: string }
  | { type: 'addUdo'; index?: number; definition?: UdoDefinitionSnapshot }
  | { type: 'removeUdo'; index: number }
  | { type: 'updateUdo'; index: number; patch: Partial<UdoDefinitionSnapshot> }
  | { type: 'convertUdoStyle'; index: number; style: 'CLASSIC' | 'MODERN' }
  | { type: 'reorderUdo'; from: number; to: number }
  | { type: 'randomize' }
  | { type: 'makeGroup'; widgetIds: string[]; parentGroupId?: string }
  | { type: 'breakGroup'; widgetId: string }
  | { type: 'pasteWidgets'; widgetData: string; parentGroupId?: string };

// ─── Sound Score Object Editor Types ───

export type SoundEditorTab = 'interface' | 'automation' | 'code' | 'udo' | 'comments';

export interface SoundAutomationParameterSnapshot {
  parameterId: string;
  name: string;
  label: string;
  automationEnabled: boolean;
  value: number;
  minimum: number;
  maximum: number;
  resolutionDecimal?: string;
  resolution?: number;
  curve: string;
  points: Array<{ x: number; y: number }>;
}

export interface SoundEditorPayload {
  comment: string;
  bsbInstrument: BlueSynthBuilderInstrumentSnapshot | null;
  automationParameters: SoundAutomationParameterSnapshot[];
  availableTabs: SoundEditorTab[];
  testAvailable: boolean;
  deferredCapabilities: string[];
}

// ─── End Sound Score Object Editor Types ───

export interface UnknownInstrumentSnapshot extends InstrumentSnapshotBase {
  type: 'unknown';
  instrumentType: string;
}

export interface ArrangementRowSnapshot {
  assignmentId: string;
  enabled: boolean;
  instrumentName: string;
  instrumentType: InstrumentSnapshot['type'];
  instrumentSummary?: string;
  editable: boolean;
}

export interface ArrangementSnapshot {
  rows: ArrangementRowSnapshot[];
}

export interface TemporaryInstrumentLibrarySnapshot {
  status: 'deferred';
  message: string;
}

export interface OrchestraSnapshot {
  loaded: boolean;
  arrangement: ArrangementSnapshot;
  instruments: InstrumentSnapshot[];
  temporaryLibrary: TemporaryInstrumentLibrarySnapshot;
}

export type InstrumentPatch = Partial<{
  name: string;
  enabled: boolean;
  comment: string;
  text: string;
  instrumentText: string;
  alwaysOnInstrumentText: string;
  globalOrc: string;
  globalSco: string;
  bsbWidgetValues: Record<string, number>;
  bsbOpcodeListText: string;
  bsbInterface: BsbInterfacePatch;
  embeddedOpcodeList: EmbeddedOpcodeListPatch;
  blueX7: BlueX7Patch;
}>;

/**
 * Stable request/response contract for the dedicated Track instrument editor
 * window. Track identity is kept separate from arrangement assignment IDs so
 * the editor remains attached to the owning Track across project snapshots.
 */
export interface TrackInstrumentEditorRequest {
  readonly track: TrackRef;
}

export interface TrackInstrumentEditorSnapshot {
  readonly track: TrackRef;
  readonly instrument: InstrumentSnapshot;
  readonly projectUdos: UdoDefinitionSnapshot[];
}

export interface TrackInstrumentEditorPatchRequest extends TrackInstrumentEditorRequest {
  readonly patch: InstrumentPatch;
}

export type TrackInstrumentEditorPatchStatus = 'applied' | 'unchanged' | 'stale' | 'unavailable';

export interface TrackInstrumentEditorPatchResult {
  readonly status: TrackInstrumentEditorPatchStatus;
  readonly snapshot: TrackInstrumentEditorSnapshot | null;
}

export type OrchestraPatch =
  | {
      type: 'addInstrument';
      instrumentType: SupportedNewInstrumentType;
      insertAfterAssignmentId?: string;
    }
  | { type: 'removeAssignment'; assignmentId: string }
  | {
      type: 'duplicateAssignment';
      sourceAssignmentId: string;
    }
  | {
      type: 'pasteInstrument';
      instrument: InstrumentSnapshot;
      insertAfterAssignmentId?: string;
    }
  | {
      type: 'updateAssignment';
      assignmentId: string;
      enabled?: boolean;
      nextAssignmentId?: string;
    }
  | {
      type: 'replaceInstrument';
      assignmentId: string;
      instrumentType: SupportedNewInstrumentType;
    }
  | { type: 'convertGenericToBsb'; assignmentId: string }
  | {
      type: 'updateInstrument';
      assignmentId: string;
      patch: InstrumentPatch;
    }
  | {
      type: 'updateInstrumentComment';
      assignmentId: string;
      comment: string;
    };

export type ProjectLoadedPayload = ProjectSummarySnapshot &
  Partial<
    Pick<
      ProjectEditorSnapshot,
      | 'sessionId'
      | 'globalOrc'
      | 'globalSco'
      | 'orchestra'
      | 'mixer'
      | 'projectProperties'
      | 'clojureProject'
      | 'transport'
      | 'tablesText'
      | 'scratchPad'
      | 'projectUdos'
      | 'loaded'
      | 'blueLive'
      | 'midiInput'
      | 'score'
    >
  > & {
    missingAudioAssets?: MissingAudioAssetsSession;
  };

// ─── BlueX7 runtime targets and results (Spec 092) ──────────────────────────
// Serializable contracts for live BlueX7 control, atomic complete-voice
// updates, and effective-value readback. Durable project patches remain the
// canonical owner; these messages are validated low-latency accelerators and
// disposable readback. Routing identity is always owner identity plus
// Parameter id — never display name, list position, or cached instrument
// number.

/** Track-owned instrument location. `projectSessionId` is the owning open
 * project's session; `rootGroupId`/`trackId` are stable score identities. */
export interface BlueX7TrackOwnerTarget {
  projectSessionId: number;
  rootGroupId: string;
  trackId: string;
}

/**
 * Exactly one branch must be present. Display name, list index, instrument
 * number cached by the renderer, and Parameter name alone are invalid
 * routing identities.
 */
export type BlueX7RuntimeTarget =
  | { assignmentId: string; track?: never }
  | { assignmentId?: never; track: BlueX7TrackOwnerTarget };

export interface BlueX7ParameterValuePair {
  parameterId: string;
  value: number;
}

/** Live single-control gesture accelerator (see the authority matrix in the
 * runtime contract; automation remains authoritative when enabled). */
export interface BlueX7RealtimeControlUpdate {
  target: BlueX7RuntimeTarget;
  projectSessionId: number;
  parameterId: string;
  semanticKey: string;
  value: number;
  expectedProjectRevision?: number;
}

/**
 * Multi-Parameter runtime update. `fixed-delta` holds nothing; for
 * `complete-voice`, main writes hold -> complete batch -> commit at one
 * control boundary so listeners observe old-or-new whole voices only.
 */
export interface BlueX7RuntimeUpdateBatch {
  projectSessionId: number;
  owner: BlueX7RuntimeTarget;
  expectedProjectRevision?: number;
  mode: 'fixed-delta' | 'complete-voice';
  values: BlueX7ParameterValuePair[];
}

/** Effective-value readback request; only visible controls for open editors. */
export interface BlueX7EffectiveValuesRequest {
  target: BlueX7RuntimeTarget;
  projectSessionId: number;
  parameterIds: string[];
}

export type BlueX7EffectiveValuesResult =
  | {
      ok: true;
      projectSessionId: number;
      ownerIdentity: string;
      engineSequence: number;
      values: BlueX7ParameterValuePair[];
    }
  | {
      ok: false;
      reason:
        | 'not-playing'
        | 'stale-session'
        | 'owner-not-found'
        | 'binding-not-found'
        | 'channel-unavailable';
    };

const BLUE_X7_IS_RECORD = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const BLUE_X7_NON_EMPTY = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const BLUE_X7_SESSION_ID = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Validate a runtime target: exactly one owner branch, well-formed ids. */
export function isBlueX7RuntimeTarget(value: unknown): value is BlueX7RuntimeTarget {
  if (!BLUE_X7_IS_RECORD(value)) {
    return false;
  }
  const hasAssignment = 'assignmentId' in value;
  const hasTrack = 'track' in value;
  if (hasAssignment === hasTrack) {
    return false; // exactly one branch must be present
  }
  if (hasAssignment) {
    return BLUE_X7_NON_EMPTY(value.assignmentId);
  }
  const track = value.track;
  return (
    BLUE_X7_IS_RECORD(track) &&
    BLUE_X7_SESSION_ID(track.projectSessionId) &&
    BLUE_X7_NON_EMPTY(track.rootGroupId) &&
    BLUE_X7_NON_EMPTY(track.trackId)
  );
}

/** Validate a live single-control intent: valid target, ids, finite value. */
export function isBlueX7RealtimeControlUpdate(
  value: unknown,
): value is BlueX7RealtimeControlUpdate {
  if (!BLUE_X7_IS_RECORD(value)) {
    return false;
  }
  if (
    !isBlueX7RuntimeTarget(value.target) ||
    !BLUE_X7_SESSION_ID(value.projectSessionId) ||
    !BLUE_X7_NON_EMPTY(value.parameterId) ||
    !BLUE_X7_NON_EMPTY(value.semanticKey) ||
    typeof value.value !== 'number' ||
    !Number.isFinite(value.value)
  ) {
    return false;
  }
  return (
    value.expectedProjectRevision === undefined ||
    (typeof value.expectedProjectRevision === 'number' &&
      Number.isInteger(value.expectedProjectRevision) &&
      value.expectedProjectRevision >= 0)
  );
}

/** Validate a readback request: valid target, bounded visible-controls list. */
export function isBlueX7EffectiveValuesRequest(
  value: unknown,
): value is BlueX7EffectiveValuesRequest {
  if (!BLUE_X7_IS_RECORD(value)) {
    return false;
  }
  return (
    isBlueX7RuntimeTarget(value.target) &&
    BLUE_X7_SESSION_ID(value.projectSessionId) &&
    Array.isArray(value.parameterIds) &&
    value.parameterIds.length > 0 &&
    value.parameterIds.length <= 151 &&
    value.parameterIds.every((id) => BLUE_X7_NON_EMPTY(id))
  );
}
