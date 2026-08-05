import {
  BlueData,
  Channel,
  ChannelList,
  BlueSynthBuilder,
  BlueX7,
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
  TrackLayer,
  TrackLayerGroup,
  PatternsLayerGroup,
  TimeBase,
  isValidSnapValueName,
  SoundObject,
  SoundObjectLibrary,
  Instance,
  AbstractSoundObject,
  TimeBehavior,
  NoteProcessorChain,
  AudioClip,
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
  FadeType,
  ObjectBuilder,
  getTrackPlacementForSoundObject,
  getNotes as parseScoreNotes,
  createNoteProcessorChainSnapshot as createNoteProcessorChainSnapshotFromData,
  reifyChainFromSnapshot,
} from '@blue/data';
import type { NoteProcessorChainSnapshot as DataNoteProcessorChainSnapshot, Parameter as BlueDataParameter, ScoreObject as BlueDataScoreObject, AutomatableLayer as BlueDataAutomatableLayer, Arrangement as BlueDataArrangement, Mixer as BlueDataMixer } from '@blue/data';
import { AutomationCurve as BlueDataAutomationCurve, LineColors } from '@blue/data';
import { ParameterHelper } from '@blue/data';
import type { SnapValueName } from '@blue/data';
import type { MissingAudioAssetsSession } from './missing-audio-assets';
import type { ScoreInsertionLocation } from './unified-library';
import { moveRangeWithAnchors, scaleRangeWithAnchors } from './automation-range-math';
import {
  BSB_LINE_SELECTOR_HEIGHT,
  getBsbWidgetDisplaySize,
} from './bsb-widget-layout';
import {
  collectBsbReplacementKeysFromSnapshotTree,
  collectBsbReplacementKeysFromWidgetTree,
  getBsbReplacementKeysFromSnapshot,
  getBsbReplacementKeysFromWidget,
  getDerivedKeysFromSnapshot,
  getDerivedKeysFromWidget,
} from './bsb-widget-keys';
export {
  collectBsbReplacementKeysFromSnapshotTree,
  collectBsbReplacementKeysFromWidgetTree,
  getBsbReplacementKeysFromSnapshot,
  getBsbReplacementKeysFromWidget,
} from './bsb-widget-keys';

// ─── Score Snapshot Types ───

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

function normalizeAudioFadeType(value: string | null | undefined): AudioFadeType {
  switch ((value ?? '').trim().toUpperCase().replace(/\s+/g, '_')) {
    case 'CONSTANT_POWER':
      return 'CONSTANT_POWER';
    case 'SYMMETRIC':
      return 'SYMMETRIC';
    case 'FAST':
      return 'FAST';
    case 'SLOW':
      return 'SLOW';
    case 'LINEAR':
    default:
      return 'LINEAR';
  }
}

function toBlueDataFadeType(value: string | null | undefined): FadeType {
  switch (normalizeAudioFadeType(value)) {
    case 'CONSTANT_POWER':
      return FadeType.CONSTANT_POWER;
    case 'SYMMETRIC':
      return FadeType.SYMMETRIC;
    case 'FAST':
      return FadeType.FAST;
    case 'SLOW':
      return FadeType.SLOW;
    case 'LINEAR':
    default:
      return FadeType.LINEAR;
  }
}

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
  name: string;
  height: number;
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

export interface PatternsLayerGroupSnapshot {
  groupId: string;
  groupType: 'patterns';
  name: string;
  layerCount: number;
  isOpenableContainer: boolean;
  layers: ScoreLayerSnapshot[];
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

export type TypeSpecificScoreObjectEditorSnapshot =
  | {
      kind: 'code';
      target: ScoreObjectEditorTargetSnapshot;
      syntax: 'text' | 'csound-score' | 'python' | 'javascript';
      text: string;
      auxiliaryFlags?: Record<string, string | number | boolean>;
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
  | { type: 'replaceTrackNoteProcessorChain'; track: TrackRef; chain: NoteProcessorChainSnapshot | null }
  | { type: 'createTrackInstrument'; track: TrackRef; instrumentType: SupportedNewInstrumentType }
  | { type: 'replaceTrackInstrument'; track: TrackRef; instrument: InstrumentSnapshot }
  | { type: 'clearTrackInstrument'; track: TrackRef }
  | { type: 'updateTrackInstrument'; track: TrackRef; patch: InstrumentPatch };

export type ScorePatch =
  | TrackScorePatch
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
        backgroundColor: number;
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
      type: 'updateLayerState';
      groupId: string;
      layerIndex: number;
      patch: {
        muted?: boolean;
        solo?: boolean;
        heightIndex?: number;
      };
    }
  | { type: 'renameLayer'; groupId: string; layerIndex: number; name: string }
  | { type: 'addMarker'; timeBeats: number; name?: string }
  | { type: 'updateMarker'; sourceIndex: number; patch: { name?: string; timeBeats?: number; timeBase?: string } }
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
  | { type: 'meter-map-update-entry'; previousMeasure: number; measure: number; numBeats: number; beatLength: number }
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
  | { type: 'pasteChainEntries'; channelId: string; chain: MixerChainKind; index?: number; payload: MixerChainClipboardPayload }
  | { type: 'moveChainEntryAcrossChains'; fromChannelId: string; fromChain: MixerChainKind; toChannelId: string; toChain: MixerChainKind; entryId: string; index?: number };

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
  | { type: 'addEffectFromLibrary'; channelId: string; chain: MixerChainKind; libraryEffectId: string; effectXml?: string; insertIndex?: number; entryId?: string }
  | { type: 'addSend'; channelId: string; chain: MixerChainKind; sendChannel?: string; level?: number; insertIndex?: number; entryId?: string }
  | { type: 'updateSend'; channelId: string; chain: MixerChainKind; entryId: string; patch: { sendChannel?: string; level?: number; enabled?: boolean } }
  | { type: 'updateEffect'; channelId: string; chain: MixerChainKind; entryId: string; patch: EffectEditablePatch }
  | { type: 'removeChainEntry'; channelId: string; chain: MixerChainKind; entryId: string }
  | { type: 'reorderChainEntry'; channelId: string; chain: MixerChainKind; from: number; to: number }
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
  | { type: 'addCategory'; parentCategoryId?: string; name?: string; insertIndex?: number; categoryId?: string }
  | { type: 'addEffect'; parentCategoryId?: string; name?: string; insertIndex?: number; effectId?: string; style?: 'CLASSIC' | 'MODERN' }
  | { type: 'renameCategory'; categoryId: string; name: string }
  | { type: 'reorderCategory'; parentCategoryId?: string; from: number; to: number }
  | { type: 'removeCategory'; categoryId: string }
  | { type: 'renameEffect'; effectId: string; name: string }
  | { type: 'duplicateEffect'; effectId: string; insertIndex?: number; libraryEffectId?: string }
  | { type: 'removeEffect'; effectId: string }
  | { type: 'updateEffect'; effectId: string; patch: EffectEditablePatch }
  | { type: 'pasteCategory'; parentCategoryId?: string; sourceSnapshot: EffectsLibraryCategorySnapshot }
  | { type: 'pasteEffect'; parentCategoryId?: string; sourceEffect: LibraryEffectSnapshot }
  | { type: 'moveNode'; nodeId: string; targetParentCategoryId?: string; targetIndex: number };

export type MidiInputPatch =
  | { type: 'updateKeyMapping'; value: string }
  | { type: 'updateVelocityMapping'; value: string }
  | { type: 'updatePitchConstant'; value: string }
  | { type: 'updateAmpConstant'; value: string }
  | { type: 'updateScale'; scale: MidiScaleSnapshot | null };

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
}

export interface BlueLiveNoteTriggerResult {
  ok: boolean;
  message?: string;
  submittedScoreText?: string;
}

export type BlueLivePatch =
  | { type: 'updateOptions'; patch: Partial<Pick<BlueLiveProjectSnapshot, 'commandLine' | 'commandLineEnabled' | 'commandLineOverride'>> }
  | { type: 'updateTempoRepeat'; patch: Partial<Pick<BlueLiveProjectSnapshot, 'tempo' | 'repeat' | 'repeatEnabled'>> }
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
  transport?: Partial<Pick<ToolbarProjectTransportSnapshot, 'renderStartTime' | 'renderEndTime' | 'loopRendering'>> & {
    tempoMap?: Partial<TempoMapSnapshot>;
    tempoMapPatch?: TempoMapPatch;
    meterMapPatch?: MeterMapPatch;
  };
  tablesText?: string;
  projectUdo?: ProjectUdoPatch;
  blueLive?: BlueLivePatch;
  midiInput?: MidiInputPatch;
  score?: ScorePatch;
}

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

export type BsbRealtimeControlUpdate = BsbRealtimeControlTarget
  & BsbRealtimeControlBase
  & BsbRealtimeControlValue;

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

  const hasValidAssignment = typeof candidate.assignmentId === 'string'
    && candidate.assignmentId.trim() !== '';
  const track = candidate.track && typeof candidate.track === 'object'
    ? candidate.track as Record<string, unknown>
    : null;
  const hasValidTrack = track !== null
    && typeof track.rootGroupId === 'string'
    && track.rootGroupId.trim() !== ''
    && typeof track.trackId === 'string'
    && track.trackId.trim() !== ''
    && typeof track.projectSessionId === 'number'
    && Number.isInteger(track.projectSessionId)
    && track.projectSessionId >= 0;
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
      return typeof payload.xValue === 'number' && Number.isFinite(payload.xValue)
        && typeof payload.yValue === 'number' && Number.isFinite(payload.yValue);
    case 'sliderBank':
      return typeof payload.sliderIndex === 'number'
        && Number.isInteger(payload.sliderIndex)
        && payload.sliderIndex >= 0
        && typeof payload.value === 'number'
        && Number.isFinite(payload.value);
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
}

export interface BlueX7InstrumentSnapshot extends InstrumentSnapshotBase {
  type: 'blueX7';
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
  | { type: 'addPreset'; presetName: string; presetGroupPath?: string }
  | { type: 'addPresetGroup'; groupName: string; parentGroupPath?: string }
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

export type TrackInstrumentEditorPatchStatus =
  | 'applied'
  | 'unchanged'
  | 'stale'
  | 'unavailable';

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
      | 'projectUdos'
      | 'loaded'
      | 'blueLive'
      | 'midiInput'
      | 'score'
    >
  > & {
    missingAudioAssets?: MissingAudioAssetsSession;
  };

function createDefaultProjectPropertiesSnapshot(): ProjectPropertiesSnapshot {
  return {
    title: '',
    author: '',
    notes: '',
    sampleRate: '44100',
    ksmps: '64',
    nchnls: '2',
    useZeroDbFS: false,
    zeroDbFS: '32768',
    diskSampleRate: '44100',
    diskKsmps: '64',
    diskChannels: '2',
    diskUseZeroDbFS: false,
    diskZeroDbFS: '32768',
    useAudioOut: true,
    useAudioIn: false,
    useMidiIn: false,
    useMidiOut: false,
    noteAmpsEnabled: true,
    outOfRangeEnabled: true,
    warningsEnabled: true,
    benchmarkEnabled: true,
    advancedSettings: '',
    completeOverride: false,
    fileName: '',
    askOnRender: false,
    diskNoteAmpsEnabled: true,
    diskOutOfRangeEnabled: true,
    diskWarningsEnabled: true,
    diskBenchmarkEnabled: true,
    diskAdvancedSettings: '',
    diskCompleteOverride: false,
    diskAlwaysRenderEntireProject: false,
    mediaFolder: '',
    copyToMediaFileOnImport: true,
  };
}

function createDefaultClojureProjectSnapshot(): ClojureProjectSnapshot {
  return {
    libraryEntries: [],
  };
}

export function createEmptyProjectPropertiesSnapshot(): ProjectPropertiesSnapshot {
  return createDefaultProjectPropertiesSnapshot();
}

export function createEmptyClojureProjectSnapshot(): ClojureProjectSnapshot {
  return createDefaultClojureProjectSnapshot();
}

export function createEmptyProjectEditorSnapshot(): ProjectEditorSnapshot {
  return {
    filePath: null,
    version: '',
    sessionId: 0,
    globalOrc: '',
    globalSco: '',
    orchestra: createEmptyOrchestraSnapshot(false),
    mixer: createEmptyMixerSnapshot(),
    projectProperties: createDefaultProjectPropertiesSnapshot(),
    clojureProject: createDefaultClojureProjectSnapshot(),
    transport: createEmptyToolbarProjectTransportSnapshot(),
    tablesText: '',
    projectUdos: [],
    loaded: false,
    score: createEmptyScoreDocumentSnapshot(),
    namedChains: { names: [] },
  };
}

const MIXER_CHANNEL_IDS = new WeakMap<object, string>();
const MIXER_ENTRY_IDS = new WeakMap<object, string>();
let nextMixerSnapshotId = 1;
let nextClojureLibraryEntrySnapshotId = 1;

function assignMixerSnapshotId(
  map: WeakMap<object, string>,
  value: object,
  prefix: string,
  preferredId?: string,
): string {
  const existing = map.get(value);
  if (existing) {
    return existing;
  }

  const id = preferredId && preferredId.trim().length > 0
    ? preferredId.trim()
    : `${prefix}-${nextMixerSnapshotId++}`;
  map.set(value, id);
  return id;
}

export function getMixerChannelSnapshotId(channel: Channel, preferredId?: string): string {
  const association = channel.getAssociation().trim();
  if (association.length > 0) {
    return association;
  }

  if (channel.getName() === Mixer.MASTER_CHANNEL) {
    return 'master';
  }

  return assignMixerSnapshotId(MIXER_CHANNEL_IDS, channel, 'mixer-channel', preferredId);
}

export function getMixerEntrySnapshotId(entry: Effect | Send, preferredId?: string): string {
  return assignMixerSnapshotId(
    MIXER_ENTRY_IDS,
    entry,
    entry instanceof Effect ? 'mixer-effect' : 'mixer-send',
    preferredId,
  );
}

function toGridSettingsSnapshot(settings: {
  enabled: boolean;
  snapEnabled: boolean;
  width: number;
  height: number;
  gridStyle: string;
}): GridSettingsSnapshot {
  return {
    enabled: settings.enabled,
    snapEnabled: settings.snapEnabled,
    width: settings.width,
    height: settings.height,
    gridStyle: settings.gridStyle as GridSettingsSnapshot['gridStyle'],
  };
}

function collectGraphicInterfaceWidgets(graphicInterface: {
  getRootGroup(): {
    id?: string;
    getChildren(): unknown[];
  };
  getGridSettings(): {
    enabled: boolean;
    snapEnabled: boolean;
    width: number;
    height: number;
    gridStyle: string;
  };
  isEditEnabled(): boolean;
}): BsbWidgetSnapshot[] {
  const widgets: BsbWidgetSnapshot[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const objectName =
      typeof record.getObjectName === 'function'
        ? (record.getObjectName as () => unknown)()
        : record.objectName ?? record._objectName;
    if (typeof objectName === 'string' && objectName.trim()) {
      widgets.push({
        objectName: objectName.trim(),
        widgetType:
          typeof record.constructor === 'function' && 'name' in record.constructor
            ? String(record.constructor.name)
            : 'BSBObject',
        value: typeof record.value === 'number' ? record.value : 0,
        minimum: typeof record.minimum === 'number' ? record.minimum : 0,
        maximum: typeof record.maximum === 'number' ? record.maximum : 1,
      });
    }

    const children =
      typeof record.getChildren === 'function'
        ? (record.getChildren as () => unknown[]).call(node)
        : record.children ?? record._children;
    if (Array.isArray(children)) {
      children.forEach(visit);
    }
  };

  visit(graphicInterface.getRootGroup());
  return widgets.sort((a, b) => a.objectName.localeCompare(b.objectName));
}

function collectGraphicInterfaceObjectNames(graphicInterface: {
  getRootGroup(): {
    id?: string;
    getChildren(): unknown[];
  };
  getGridSettings(): {
    enabled: boolean;
    snapEnabled: boolean;
    width: number;
    height: number;
    gridStyle: string;
  };
  isEditEnabled(): boolean;
}): string[] {
  return collectBsbReplacementKeysFromWidgetTree(graphicInterface.getRootGroup() as unknown as BSBWidget);
}

function cloneBsbSnapshotValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneBsbSnapshotValue(item)) as T;
  }

  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    next[key] = cloneBsbSnapshotValue(item);
  }
  return next as T;
}

function getWidgetSnapshotFallbackSize(record: Record<string, unknown>): { width: number; height: number } {
  return {
    width:
      typeof record.width === 'number'
        ? record.width
        : typeof record.sliderWidth === 'number'
          ? record.sliderWidth
          : typeof record.textFieldWidth === 'number'
            ? record.textFieldWidth
            : typeof record.canvasWidth === 'number'
              ? record.canvasWidth
              : 60,
    height:
      typeof record.height === 'number'
        ? record.height
        : typeof record.sliderHeight === 'number'
          ? record.sliderHeight
          : typeof record.canvasHeight === 'number'
            ? record.canvasHeight + BSB_LINE_SELECTOR_HEIGHT
            : 24,
  };
}

function serializeBsbWidgetSnapshot(widget: unknown): BsbWidgetNodeSnapshot | null {
  if (!widget || typeof widget !== 'object') return null;
  const record = widget as Record<string, unknown>;

  const id = typeof record.id === 'string' ? record.id : '';
  if (!id) return null;

  const ctorName = typeof record.constructor === 'function' && 'name' in record.constructor
    ? String(record.constructor.name)
    : 'Unknown';

  const preservedOnly = !KNOWN_WIDGET_TYPES.has(ctorName);

  const properties: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    if (['id', 'objectName', 'x', 'y', 'width', 'height', 'parameterName', '_children', 'children', 'stringChannel', 'labelFont', 'font'].includes(key)) continue;
    if (key === 'dropdownItems' && Array.isArray(val)) {
      properties.dropdownItems = cloneBsbSnapshotValue(val);
      continue;
    }
    if (key === 'lines' && Array.isArray(val)) {
      properties.lines = val.map((line) => {
        if (!line || typeof line !== 'object') {
          return {
            varName: '',
            min: 0,
            max: 1,
            color: '#000000',
            points: [],
          };
        }

        const lineRecord = line as Record<string, unknown>;
        const points = Array.isArray(lineRecord.points)
          ? lineRecord.points.map((point) => {
              if (!point || typeof point !== 'object') {
                return { x: 0, y: 0 };
              }
              const pointRecord = point as Record<string, unknown>;
              return {
                x: typeof pointRecord.x === 'number' ? pointRecord.x : 0,
                y: typeof pointRecord.y === 'number' ? pointRecord.y : 0,
              };
            })
          : [];

        return {
          varName: typeof lineRecord.name === 'string' && lineRecord.name.trim().length > 0
            ? lineRecord.name
            : typeof lineRecord.varName === 'string'
              ? lineRecord.varName
              : '',
          min: typeof lineRecord.min === 'number' ? lineRecord.min : 0,
          max: typeof lineRecord.max === 'number' ? lineRecord.max : 1,
          color: normalizeBsbLineColor(lineRecord.color),
          resolution: typeof lineRecord.resolution === 'string' ? lineRecord.resolution : undefined,
          rightBound: typeof lineRecord.rightBound === 'boolean' ? lineRecord.rightBound : undefined,
          endPointsLinked: typeof lineRecord.endPointsLinked === 'boolean' ? lineRecord.endPointsLinked : undefined,
          points,
        };
      });
      continue;
    }
    if (key === 'sliders' && Array.isArray(val)) {
      properties.sliders = val.map((slider) => {
        if (!slider || typeof slider !== 'object') {
          return { value: 0 };
        }
        const sliderRecord = slider as Record<string, unknown>;
        return {
          value: typeof sliderRecord.value === 'number' ? sliderRecord.value : 0,
        };
      });
      continue;
    }
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) {
      properties[key] = val as string | number | boolean | null;
    }
  }

  const fontKeys = ['labelFont', 'font'] as const;
  for (const fk of fontKeys) {
    const fv = record[fk];
    if (fv && typeof fv === 'object') {
      const f = fv as Record<string, unknown>;
      if (typeof f.name === 'string') properties[`${fk}.name`] = f.name;
      if (typeof f.size === 'number') properties[`${fk}.size`] = f.size;
      if (typeof f.style === 'number') properties[`${fk}.style`] = f.style;
    }
  }

  if (ctorName === 'BSBHSliderBank' || ctorName === 'BSBVSliderBank') {
    const sliderCount = Array.isArray(properties.sliders)
      ? properties.sliders.length
      : typeof record.numberOfSliders === 'number'
        ? record.numberOfSliders
        : 1;
    properties.numberOfSliders = Math.max(1, sliderCount);
  }

  const children = typeof record.getChildren === 'function'
    ? (record.getChildren as () => unknown[]).call(widget)
    : record.children ?? record._children;

  const childSnapshots = Array.isArray(children)
    ? children
        .map((child) => serializeBsbWidgetSnapshot(child))
        .filter((node): node is BsbWidgetNodeSnapshot => Boolean(node))
    : [];

  const baseSize = getWidgetSnapshotFallbackSize(record);
  const snapshot: BsbWidgetNodeSnapshot = {
    id,
    type: ctorName,
    objectName: typeof record.objectName === 'string' ? record.objectName : '',
    x: typeof record.x === 'number' ? record.x : 0,
    y: typeof record.y === 'number' ? record.y : 0,
    width: baseSize.width,
    height: baseSize.height,
    value: typeof record.value === 'number' ? record.value : 0,
    minimum: typeof record.minimum === 'number' ? record.minimum : 0,
    maximum: typeof record.maximum === 'number' ? record.maximum : 1,
    editable: !preservedOnly,
    preservedOnly,
    properties,
    children: childSnapshots.length > 0 ? childSnapshots : undefined,
  };

  if (ctorName !== 'BSBGroup') {
    const displaySize = getBsbWidgetDisplaySize(snapshot);
    snapshot.width = displaySize.width;
    snapshot.height = displaySize.height;
  }

  return snapshot;
}

export function createBsbWidgetSnapshotFromWidget(widget: unknown): BsbWidgetNodeSnapshot | null {
  return serializeBsbWidgetSnapshot(widget);
}

export function createDefaultBsbWidgetSnapshot(widgetType: string): BsbWidgetNodeSnapshot | null {
  const factory = new BlueSynthBuilder().getGraphicInterface().createWidgetByType(widgetType);
  return factory ? serializeBsbWidgetSnapshot(factory) : null;
}

function buildWidgetTreeNodeFromGraphicNode(widget: unknown): BsbWidgetNodeSnapshot | null {
  return serializeBsbWidgetSnapshot(widget);
}

function buildWidgetTreeSnapshotFromGraphicInterface(graphicInterface: {
  getRootGroup(): {
    id?: string;
    getChildren(): unknown[];
  };
}): BsbWidgetNodeSnapshot {
  const rootGroup = graphicInterface.getRootGroup();
  const children: BsbWidgetNodeSnapshot[] = [];

  for (const child of rootGroup.getChildren()) {
    const node = buildWidgetTreeNodeFromGraphicNode(child);
    if (node) {
      children.push(node);
    }
  }

  return {
    id: rootGroup.id || 'root',
    type: 'BSBRootGroup',
    objectName: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    value: 0,
    minimum: 0,
    maximum: 1,
    editable: true,
    properties: {},
    children,
  };
}

function createEffectSnapshotBase(effect: Effect): EffectSnapshot {
  const graphicInterface = effect.getGraphicInterface();
  return {
    effectXml: effect.saveAsXML().toXml(),
    name: effect.getName(),
    enabled: effect.isEnabled(),
    numIns: effect.getNumIns(),
    numOuts: effect.getNumOuts(),
    style: effect.getStyle(),
    code: effect.getCode(),
    comments: effect.getComments(),
    editEnabled: graphicInterface.isEditEnabled(),
    gridSettings: toGridSettingsSnapshot(graphicInterface.getGridSettings()),
    objectNames: collectGraphicInterfaceObjectNames(graphicInterface),
    widgets: collectGraphicInterfaceWidgets(graphicInterface),
    widgetTree: buildWidgetTreeSnapshotFromGraphicInterface(graphicInterface),
    udos: effect.getOpcodeList().getOpcodes().map(udoToSnapshot),
  };
}

export function createEffectEditorSnapshot(
  effect: Effect,
  effectId: string,
  ownerType: 'project' | 'library',
  refs?: {
    projectRef?: ProjectEffectRef;
    libraryRef?: LibraryEffectRef;
    /**
     * Project-global UDO projection. Required for project-owned effects so the
     * separate effect window receives completion scope; omitted/empty for
     * library-owned effects.
     */
    projectUdos?: UdoDefinitionSnapshot[];
  },
): EffectEditorSnapshot {
  return {
    ...createEffectSnapshotBase(effect),
    effectId,
    ownerType,
    projectRef: refs?.projectRef,
    libraryRef: refs?.libraryRef,
    // Library-owned effects never receive project UDOs, even if a project is open.
    projectUdos: ownerType === 'project' ? (refs?.projectUdos ?? []) : [],
  };
}

export function createMixerEffectEntrySnapshot(
  effect: Effect,
  entryId: string,
  refs?: {
    projectRef?: ProjectEffectRef;
    libraryRef?: LibraryEffectRef;
  },
): MixerEffectEntrySnapshot {
  return {
    ...createEffectSnapshotBase(effect),
    entryId,
    kind: 'effect',
    projectRef: refs?.projectRef,
    libraryRef: refs?.libraryRef,
  };
}

export function createLibraryEffectSnapshot(
  effect: Effect,
  libraryEffectId: string,
  categoryId?: string,
): LibraryEffectSnapshot {
  return {
    ...createEffectSnapshotBase(effect),
    libraryEffectId,
    categoryId,
  };
}

function createMixerSendEntrySnapshot(send: Send, entryId: string): MixerSendEntrySnapshot {
  return {
    entryId,
    kind: 'send',
    sendChannel: send.getSendChannel(),
    level: send.getLevel(),
    enabled: send.isEnabled(),
  };
}

function createMixerChainSnapshot(
  chain: Array<Effect | Send>,
  refs: {
    channelId: string;
    chain: MixerChainKind;
    libraryRef?: LibraryEffectRef;
  },
): MixerChainEntrySnapshot[] {
  return chain.map((entry) => {
    if (entry instanceof Effect) {
      const entryId = getMixerEntrySnapshotId(entry);
      return {
        ...createEffectSnapshotBase(entry),
        entryId,
        kind: 'effect',
        projectRef: {
          channelId: refs.channelId,
          chain: refs.chain,
          entryId,
        },
        libraryRef: refs.libraryRef,
      };
    }

    return createMixerSendEntrySnapshot(entry, getMixerEntrySnapshotId(entry));
  });
}

function createMixerChannelSnapshot(
  channel: Channel,
  channelKind: MixerChannelKind,
  refs?: {
    libraryRef?: LibraryEffectRef;
  },
): MixerChannelSnapshot {
  const id = getMixerChannelSnapshotId(channel);
  return {
    id,
    name: channel.getName(),
    channelKind,
    association: channel.getAssociation() || undefined,
    outChannel: channel.getOutChannel(),
    muted: channel.isMuted(),
    solo: channel.isSolo(),
    level: channel.getLevel(),
    volume: channel.getVolume(),
    pan: channel.getPan(),
    preChain: createMixerChainSnapshot(channel.getPreEffects(), {
      channelId: id,
      chain: 'pre',
      libraryRef: refs?.libraryRef,
    }),
    postChain: createMixerChainSnapshot(channel.getPostEffects(), {
      channelId: id,
      chain: 'post',
      libraryRef: refs?.libraryRef,
    }),
  };
}

export function createEmptyMixerSnapshot(): MixerSnapshot {
  const master = new Channel();
  master.setName(Mixer.MASTER_CHANNEL);
  return {
    enabled: true,
    extraRenderTime: 0,
    channelListGroups: [],
    channels: [],
    subChannels: [],
    master: createMixerChannelSnapshot(master, 'master'),
  };
}

function createMixerChannelListSnapshot(channelList: ChannelList): MixerChannelListSnapshot {
  return {
    association: channelList.getAssociation() ?? undefined,
    listName: channelList.getListName(),
    listNameEditSupported: channelList.isListNameEditSupported(),
    channels: Array.from(channelList, (channel) =>
      createMixerChannelSnapshot(channel, 'instrument'),
    ),
  };
}

export function createMixerSnapshot(mixer: Mixer): MixerSnapshot {
  return {
    enabled: mixer.isEnabled(),
    extraRenderTime: mixer.getExtraRenderTime(),
    channelListGroups: mixer.getChannelListGroups().map((channelList) =>
      createMixerChannelListSnapshot(channelList),
    ),
    channels: Array.from(mixer.getChannels(), (channel) =>
      createMixerChannelSnapshot(channel, 'instrument'),
    ),
    subChannels: Array.from(mixer.getSubChannels(), (channel) =>
      createMixerChannelSnapshot(channel, 'subChannel'),
    ),
    master: createMixerChannelSnapshot(mixer.getMaster(), 'master'),
  };
}

export function createEmptyOrchestraSnapshot(loaded = false): OrchestraSnapshot {
  return {
    loaded,
    arrangement: { rows: [] },
    instruments: [],
    temporaryLibrary: {
      status: 'deferred',
      message: 'Program-wide orchestra library is deferred for this slice.',
    },
  };
}

export function createEmptyTempoMapSnapshot(): TempoMapSnapshot {
  return {
    enabled: false,
    visible: false,
    points: [
      {
        beat: 0,
        tempo: 60,
        curveType: 'constant',
        timeBase: TimeBase.BEATS,
      },
    ],
  };
}

export function createEmptyMeterMapSnapshot(): MeterMapSnapshot {
  return {
    entries: [
      {
        measure: 1,
        numBeats: 4,
        beatLength: 4,
        startBeat: 0,
      },
    ],
  };
}

export function createTempoMapSnapshot(tempoMap: TempoMap): TempoMapSnapshot {
  return {
    enabled: tempoMap.isEnabled(),
    visible: tempoMap.isVisible(),
    points: tempoMap.getTempoPoints().map((point) => ({
      beat: point.beat,
      tempo: point.tempo,
      curveType: point.curveType === 'CONSTANT' ? 'constant' : 'linear',
      timeBase: point.position.getTimeBase(),
    })),
  };
}

export function createMeterMapSnapshot(meterMap: MeterMapLike): MeterMapSnapshot {
  const entries = meterMap.getEntries();
  const result: MeterSnapshot[] = [];
  let accumulatedBeat = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    result.push({
      measure: entry.measure,
      numBeats: entry.meter.numBeats,
      beatLength: entry.meter.beatLength,
      startBeat: accumulatedBeat,
    });
    if (i < entries.length - 1) {
      const nextEntry = entries[i + 1];
      const measuresBetween = nextEntry.measure - entry.measure;
      const beatsPerMeasure = entry.meter.numBeats * (4.0 / entry.meter.beatLength);
      accumulatedBeat += measuresBetween * beatsPerMeasure;
    }
  }
  return { entries: result };
}

export function createEmptyToolbarProjectTransportSnapshot(): ToolbarProjectTransportSnapshot {
  return {
    renderStartTime: 0,
    renderEndTime: -1,
    loopRendering: false,
    tempoMap: createEmptyTempoMapSnapshot(),
    meterMap: createEmptyMeterMapSnapshot(),
    sampleRate: 44100,
    smpteFrameRate: 30,
  };
}

export function createToolbarProjectTransportSnapshot(
  data: BlueData,
): ToolbarProjectTransportSnapshot {
  const timeContext = data.getScore().getTimeContext();
  return {
    renderStartTime: data.getRenderStartTime(),
    renderEndTime: data.getRenderEndTime(),
    loopRendering: data.isLoopRendering(),
    tempoMap: createTempoMapSnapshot(
      data.getScore().getTimeContext().getTempoMap(),
    ),
    meterMap: createMeterMapSnapshot(timeContext.getMeterMap()),
    sampleRate: Number(data.getProjectProperties().sampleRate) || 44100,
    smpteFrameRate: timeContext.getSmpteFramesPerSecond(),
  };
}

export function createProjectPropertiesSnapshot(
  properties: ProjectProperties,
): ProjectPropertiesSnapshot {
  return {
    title: properties.title,
    author: properties.author,
    notes: properties.notes,
    sampleRate: properties.sampleRate,
    ksmps: properties.ksmps,
    nchnls: properties.nchnls,
    useZeroDbFS: properties.useZeroDbFS,
    zeroDbFS: properties.zeroDbFS,
    diskSampleRate: properties.diskSampleRate,
    diskKsmps: properties.diskKsmps,
    diskChannels: properties.diskChannels,
    diskUseZeroDbFS: properties.diskUseZeroDbFS,
    diskZeroDbFS: properties.diskZeroDbFS,
    useAudioOut: properties.useAudioOut,
    useAudioIn: properties.useAudioIn,
    useMidiIn: properties.useMidiIn,
    useMidiOut: properties.useMidiOut,
    noteAmpsEnabled: properties.noteAmpsEnabled,
    outOfRangeEnabled: properties.outOfRangeEnabled,
    warningsEnabled: properties.warningsEnabled,
    benchmarkEnabled: properties.benchmarkEnabled,
    advancedSettings: properties.advancedSettings,
    completeOverride: properties.completeOverride,
    fileName: properties.fileName,
    askOnRender: properties.askOnRender,
    diskNoteAmpsEnabled: properties.diskNoteAmpsEnabled,
    diskOutOfRangeEnabled: properties.diskOutOfRangeEnabled,
    diskWarningsEnabled: properties.diskWarningsEnabled,
    diskBenchmarkEnabled: properties.diskBenchmarkEnabled,
    diskAdvancedSettings: properties.diskAdvancedSettings,
    diskCompleteOverride: properties.diskCompleteOverride,
    diskAlwaysRenderEntireProject: properties.diskAlwaysRenderEntireProject,
    mediaFolder: properties.mediaFolder,
    copyToMediaFileOnImport: properties.copyToMediaFileOnImport,
  };
}

function createClojureLibraryEntrySnapshot(
  entry: ClojureLibraryEntry,
): ClojureLibraryEntrySnapshot {
  return {
    entryId: `clj-lib-${nextClojureLibraryEntrySnapshotId++}`,
    dependencyCoordinates: entry.getDependencyCoordinates(),
    version: entry.getVersion(),
  };
}

export function createClojureProjectSnapshot(
  projectData: ClojureProjectData | null | undefined,
): ClojureProjectSnapshot {
  if (!projectData) {
    return createDefaultClojureProjectSnapshot();
  }

  return {
    libraryEntries: projectData
      .getLibraryEntries()
      .map((entry) => createClojureLibraryEntrySnapshot(entry)),
  };
}

// ─── Bar Renderer Snapshot Helpers ───

const JAVA_NEWLINE_RE = /\\n/g;

function splitLabelLines(name: string): string[] {
  return name.split(JAVA_NEWLINE_RE);
}

function getRepeatPointBeats(sObj: AbstractSoundObject, context: TimeContext): number | null {
  const rp = sObj.getRepeatPoint();
  if (!rp) return null;
  const beats = rp.toBeats(context);
  if (!Number.isFinite(beats) || beats <= 0) return null;
  return beats;
}

function getTimeBehaviorStr(sObj: AbstractSoundObject): string {
  return sObj.getTimeBehavior() ?? 'NONE';
}

function createBarRendererForSoundObject(
  sObj: SoundObject,
  context: TimeContext,
): ScoreObjectBarRendererSnapshot {
  const labelLines = splitLabelLines(sObj.getName());

  if (sObj instanceof Comment) {
    return { kind: 'comment', labelLines };
  }

  if (sObj instanceof GenericScore || sObj instanceof PatternObject) {
    const so = sObj as AbstractSoundObject;
    return {
      kind: 'generic',
      labelLines,
      timeBehavior: getTimeBehaviorStr(so),
      repeatPointBeats: getRepeatPointBeats(so, context),
    };
  }

  if (sObj instanceof PianoRoll) {
    const pr = sObj as PianoRoll;
    const so = sObj as AbstractSoundObject;
    const scale = pr.getScale();
    const scaleDegreeCount = scale.ratios.length;
    const notes = pr.getNotes();
    let notesDurationBeats = 0;
    const noteSnapshots: PianoRollBarRendererSnapshot['notes'] = [];
    for (const n of notes) {
      const start = n.getStart();
      const dur = n.getDuration();
      const end = start + dur;
      if (end > notesDurationBeats) notesDurationBeats = end;
      noteSnapshots.push({
        octave: n.getOctave(),
        scaleDegree: n.getScaleDegree(),
        startBeats: start,
        durationBeats: dur,
      });
    }
    return {
      kind: 'pianoRoll',
      labelLines,
      timeBehavior: getTimeBehaviorStr(so),
      repeatPointBeats: getRepeatPointBeats(so, context),
      scaleDegreeCount,
      notesDurationBeats,
      notes: noteSnapshots,
    };
  }

  if (sObj instanceof AudioFile) {
    const af = sObj as AudioFile;
    return {
      kind: 'audioFile',
      labelLines,
      audioFilePath: af.getSoundFileName() ?? '',
      waveformKey: af.getSoundFileName() ? `af:${af.getSoundFileName()}` : null,
    };
  }

  if (sObj instanceof FrozenSoundObject) {
    const fso = sObj as FrozenSoundObject;
    const so = sObj as AbstractSoundObject;
    const frozenFile = fso.getFrozenWaveFileName() ?? '';
    const currentDur = so.getSubjectiveDuration().toBeats(context);
    const inner = fso.getFrozenSoundObject();
    const originalDur = inner
      ? inner.getSubjectiveDuration().toBeats(context)
      : null;
    return {
      kind: 'frozenSoundObject',
      labelLines,
      frozenWaveFileName: frozenFile,
      waveformKey: frozenFile ? `fso:${frozenFile}` : null,
      originalDurationBeats: originalDur != null && Number.isFinite(originalDur) && originalDur > 0
        ? originalDur : null,
      currentDurationBeats: currentDur,
    };
  }

  const letterMap: Record<string, string> = {
    LineObject: 'L',
    ZakLineObject: 'L',
    External: 'E',
    Instance: 'I',
    PythonObject: 'P',
    JavaScriptObject: 'J',
    JMask: 'J',
    Sound: 'S',
    TrackerObject: 'T',
  };

  const typeName = sObj.constructor.name;
  if (letterMap[typeName]) {
    const so = sObj as AbstractSoundObject;
    return {
      kind: 'letter',
      letter: letterMap[typeName],
      labelLines,
      timeBehavior: getTimeBehaviorStr(so),
      repeatPointBeats: getRepeatPointBeats(so, context),
      mappingStatus: 'supported',
    };
  }

  if (typeName === 'ObjectBuilder') {
    const so = sObj as AbstractSoundObject;
    return {
      kind: 'letter',
      letter: 'O',
      labelLines,
      timeBehavior: getTimeBehaviorStr(so),
      repeatPointBeats: getRepeatPointBeats(so, context),
      mappingStatus: 'fallback',
    };
  }

  if (typeName === 'ClojureObject') {
    return {
      kind: 'letter',
      letter: 'C',
      labelLines,
      timeBehavior: 'NONE',
      repeatPointBeats: null,
      mappingStatus: 'fallback',
    };
  }

  return {
    kind: 'fallback',
    labelLines,
    reason: 'unknown-type',
    javaRenderer: typeName,
  };
}

function createBarRendererForAudioClip(
  clip: AudioClip,
  context: TimeContext,
): AudioClipBarRendererSnapshot {
  const labelLines = splitLabelLines(clip.getName());
  const audioFile = clip.getAudioFile ? clip.getAudioFile() : '';
  const tempoMap = context.getTempoMap();
  const secondsToBeats = (seconds: number): number => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return 0;
    }
    return tempoMap.secondsToBeats(seconds);
  };
  return {
    kind: 'audioClip',
    labelLines,
    audioFilePath: audioFile,
    waveformKey: audioFile ? `aclp:${audioFile}` : null,
    fileStartTimeBeats: secondsToBeats(clip.getFileStartTime ? clip.getFileStartTime() : 0),
    audioDurationBeats: secondsToBeats(clip.getAudioDuration ? clip.getAudioDuration() : 0),
    looping: clip.isLooping ? clip.isLooping() : false,
    fadeInBeats: secondsToBeats(clip.getFadeIn ? clip.getFadeIn() : 0),
    fadeInType: normalizeAudioFadeType(clip.getFadeInType ? String(clip.getFadeInType()) : 'LINEAR'),
    fadeOutBeats: secondsToBeats(clip.getFadeOut ? clip.getFadeOut() : 0),
    fadeOutType: normalizeAudioFadeType(clip.getFadeOutType ? String(clip.getFadeOutType()) : 'LINEAR'),
  };
}

// ─── Score Snapshot Helpers ───

const LAYER_GROUP_ID_MAP = new WeakMap<object, string>();
let nextLayerGroupId = 1;

const SCORE_OBJECT_ID_MAP = new WeakMap<object, string>();
let nextScoreObjectId = 1;

function assignLayerGroupId(obj: object): string {
  const existing = LAYER_GROUP_ID_MAP.get(obj);
  if (existing) return existing;
  const id = `lg-${nextLayerGroupId++}`;
  LAYER_GROUP_ID_MAP.set(obj, id);
  return id;
}

function assignScoreObjectId(obj: object, prefix: 'sobj' | 'aclp' = 'sobj'): string {
  const existing = SCORE_OBJECT_ID_MAP.get(obj);
  if (existing) return existing;
  const id = `${prefix}-${nextScoreObjectId++}`;
  SCORE_OBJECT_ID_MAP.set(obj, id);
  return id;
}

function assignExplicitScoreObjectId(obj: object, id: string): void {
  SCORE_OBJECT_ID_MAP.set(obj, id);
}

/** Returns the stable snapshot ID assigned to an object, or undefined. */
function getScoreObjectId(obj: object): string | undefined {
  return SCORE_OBJECT_ID_MAP.get(obj);
}

function createScoreTimeStateSnapshot(data: BlueData): ScoreTimeStateSnapshot {
  const ts = data.getScore().getTimeState();
  return {
    snapEnabled: ts.isSnapEnabled(),
    snapValue: ts.getSnapValue(),
    primaryTimeDisplay: ts.getTimeDisplay(),
    secondaryTimeDisplay: ts.getSecondaryTimeDisplay(),
    secondaryRulerEnabled: ts.isSecondaryRulerEnabled(),
    tempoRowVisible: ts.isTempoRowVisible(),
    meterRowVisible: ts.isMeterRowVisible(),
    markersRowVisible: ts.isMarkersRowVisible(),
    smpteFrameRate: ts.getSmpteFrameRate(),
    zoomIterations: ts.getZoomIterations(),
  };
}

function createMarkerSnapshots(data: BlueData): MarkerSnapshot[] {
  const markers: MarkerSnapshot[] = [];
  const markersList = data.getMarkersList();
  if (!markersList) return markers;
  const context = data.getScore().getTimeContext();
  const elements = markersList.getMarkers();
  for (let i = 0; i < elements.length; i++) {
    const elem = elements[i];
    if (!elem) continue;
    const name = elem.getAttribute('name') ?? elem.getName() ?? '';
    const position = markersList.getMarkerTimePosition(i);
    const time = position.toBeats(context);
    markers.push({ name, time, timeBase: position.getTimeBase(), sourceIndex: i });
  }
  return markers;
}

function createScoreLayerGroupSnapshots(data: BlueData): ScoreLayerGroupSnapshot[] {
  const score = data.getScore();
  const context = score.getTimeContext();
  const result: ScoreLayerGroupSnapshot[] = [];

  const arrangement = data.getArrangement();
  const mixer = data.getMixer();

  const allParameters = ParameterHelper.getAllParameters(
    arrangement,
    mixer,
  );
  const assignedLayerMap = buildAssignedAutomationLayerMap(score);

  for (let i = 0; i < score.length; i++) {
    const lg = score[i];
    if (!lg) continue;

    if (lg instanceof PolyObject) {
      result.push(createPolyObjectGroupSnapshot(lg, context, i, allParameters, arrangement, mixer, assignedLayerMap));
    } else if (lg instanceof TrackLayerGroup) {
      result.push(createTrackLayerGroupSnapshot(lg, context, i, allParameters, arrangement, mixer, assignedLayerMap));
    } else if (lg instanceof PatternsLayerGroup) {
      result.push(createPatternsLayerGroupSnapshot(lg));
    }
  }

  return result;
}

function createPolyObjectGroupSnapshot(lg: PolyObject, context: TimeContext, rootGroupIndex: number, allParameters: BlueDataParameter[], arrangement: BlueDataArrangement, mixer: BlueDataMixer, assignedLayerMap: Map<string, { layerId: string; layerName: string }>): PolyObjectLayerGroupSnapshot {
  const groupId = assignLayerGroupId(lg);
  const layers: ScoreLayerSnapshot[] = [];

  for (let i = 0; i < lg.length; i++) {
    const layer = lg[i];
    const layerId = `${groupId}-layer-${i}`;
    const items: ScoreRowObjectSnapshot[] = [];
    for (let j = 0; j < layer.length; j++) {
      const sObj = layer[j];
      const location: ScoreObjectLocationRef = { rootGroupIndex, containerPath: [], layerIndex: i, objectIndex: j };
      const objectId = assignScoreObjectId(sObj, 'sobj');
      items.push({
        objectId,
        objectType: sObj.constructor.name,
        name: sObj.getName(),
        startBeats: sObj.getStartTime().toBeats(context),
        durationBeats: sObj.getSubjectiveDuration().toBeats(context),
        startTimeBase: String(sObj.getStartTime().getTimeBase()),
        durationTimeBase: String(sObj.getSubjectiveDuration().getTimeBase()),
        backgroundColor: sObj.getBackgroundColor(),
        isContainer: sObj instanceof PolyObject,
        editorTarget: buildEditorTargetSnapshot(sObj, objectId, location),
        serializedXml: sObj.saveAsXML().toXml(),
        barRenderer: sObj instanceof AbstractSoundObject
          ? createBarRendererForSoundObject(sObj, context)
          : { kind: 'fallback' as const, labelLines: splitLabelLines(sObj.getName()), reason: 'unknown-type' as const },
      });
    }
    const layerChain = layer.getNoteProcessorChain();
    const elsewhereMap = buildAssignedElsewhereMapForLayer(layerId, assignedLayerMap);
    const automation = collectLayerAutomationSnapshot(
      layerId,
      'soundObject',
      layer,
      allParameters,
      elsewhereMap,
      groupId,
      arrangement,
      mixer,
    );
    layers.push({
      layerId,
      name: layer.getName(),
      height: layer.getLayerHeight(),
      muted: layer.isMuted(),
      solo: layer.isSolo(),
      items,
      noteProcessorChain: layerChain.getProcessors().length > 0 ? createNoteProcessorChainSnapshot(layerChain) : undefined,
      automation,
    });
  }

  const groupChain = lg.getNoteProcessorChain();
  return {
    groupId,
    groupType: 'polyObject',
    name: lg.getName(),
    layerCount: lg.length,
    isOpenableContainer: true,
    layers,
    noteProcessorChain: groupChain.getProcessors().length > 0 ? createNoteProcessorChainSnapshot(groupChain) : undefined,
  };
}

function createTrackLayerGroupSnapshot(
  lg: TrackLayerGroup,
  context: TimeContext,
  rootGroupIndex: number,
  allParameters: BlueDataParameter[],
  arrangement: BlueDataArrangement,
  mixer: BlueDataMixer,
  assignedLayerMap: Map<string, { layerId: string; layerName: string }>,
): TrackLayerGroupSnapshot {
  const groupId = lg.getUniqueId();
  const layers: TrackSnapshot[] = [];

  for (let i = 0; i < lg.length; i++) {
    const layer = lg[i];
    const layerId = layer.getUniqueId();
    const items: ScoreRowObjectSnapshot[] = [];
    for (let j = 0; j < layer.length; j++) {
      const item = layer[j];
      const location: ScoreObjectLocationRef = {
        rootGroupIndex,
        containerPath: [],
        layerIndex: i,
        objectIndex: j,
        rootGroupId: groupId,
        layerId,
        trackId: layerId,
        layerKind: 'track',
      };
      const objectId = assignScoreObjectId(item, item instanceof AudioClip ? 'aclp' : 'sobj');
      if (item instanceof AudioClip) {
        items.push({
          objectId,
          objectType: 'AudioClip',
          name: item.getName(),
          startBeats: item.getStartTime().toBeats(context),
          durationBeats: item.getSubjectiveDuration().toBeats(context),
          startTimeBase: String(item.getStartTime().getTimeBase()),
          durationTimeBase: String(item.getSubjectiveDuration().getTimeBase()),
          backgroundColor: item.getBackgroundColor(),
          isContainer: false,
          editorTarget: {
            selectionId: objectId,
            selectedObjectType: 'AudioClip',
            editorObjectType: 'AudioClip',
            ownerKind: 'timeline',
            displayContext: 'timeline',
            location,
            supportsTimeBehavior: false,
            supportsRepeatPoint: false,
            supportsNoteProcessorChain: false,
          },
          serializedXml: item.saveAsXML().toXml(),
          barRenderer: createBarRendererForAudioClip(item, context),
        });
        continue;
      }

      items.push({
        objectId,
        objectType: item.constructor.name,
        name: item.getName(),
        startBeats: item.getStartTime().toBeats(context),
        durationBeats: item.getSubjectiveDuration().toBeats(context),
        startTimeBase: String(item.getStartTime().getTimeBase()),
        durationTimeBase: String(item.getSubjectiveDuration().getTimeBase()),
        backgroundColor: item.getBackgroundColor(),
        isContainer: item instanceof PolyObject,
        editorTarget: buildEditorTargetSnapshot(item, objectId, location),
        serializedXml: item.saveAsXML().toXml(),
        barRenderer: item instanceof AbstractSoundObject
          ? createBarRendererForSoundObject(item, context)
          : { kind: 'fallback' as const, labelLines: splitLabelLines(item.getName()), reason: 'unknown-type' as const },
      });
    }

    const elsewhereMap = buildAssignedElsewhereMapForLayer(layerId, assignedLayerMap);
    const automation = collectLayerAutomationSnapshot(
      layerId,
      'track',
      layer,
      allParameters,
      elsewhereMap,
      groupId,
      arrangement,
      mixer,
    );
    const instrument = layer.getInstrument();
    const instrumentType = instrument ? getInstrumentSnapshotType(instrument) : 'unknown';
    layers.push({
      layerKind: 'track',
      layerId,
      name: layer.getName(),
      height: layer.getLayerHeight(),
      muted: layer.isMuted(),
      solo: layer.isSolo(),
      items,
      noteProcessorChain: layer.getNoteProcessorChain().getProcessors().length > 0
        ? createNoteProcessorChainSnapshot(layer.getNoteProcessorChain())
        : undefined,
      automation,
      instrument: instrument
        ? {
          trackId: layerId,
          type: instrumentType,
          instrumentType: instrument.constructor.name,
          name: instrument.getName(),
          comment: instrument.getComment(),
          enabled: instrument.isEnabled(),
          supported: instrumentType !== 'unknown',
          snapshot: instrumentType === 'unknown'
            ? undefined
            : createInstrumentSnapshot(layerId, instrument, instrument.isEnabled()),
        }
        : null,
    });
  }

  return {
    groupId,
    groupType: 'track',
    name: lg.getName(),
    defaultHeightIndex: lg.getDefaultHeightIndex(),
    layerCount: lg.length,
    isOpenableContainer: false,
    layers,
  };
}

function createPatternsLayerGroupSnapshot(lg: PatternsLayerGroup): PatternsLayerGroupSnapshot {
  const groupId = assignLayerGroupId(lg);
  const layers: ScoreLayerSnapshot[] = [];

  for (let i = 0; i < lg.length; i++) {
    const layer = lg[i];
    layers.push({
      layerId: `${groupId}-layer-${i}`,
      name: layer.getName(),
      height: layer.getLayerHeight(),
      muted: layer.isMuted(),
      solo: layer.isSolo(),
      items: [],
    });
  }

  const groupChain = lg.getNoteProcessorChain();
  return {
    groupId,
    groupType: 'patterns',
    name: lg.getName(),
    layerCount: lg.length,
    isOpenableContainer: false,
    layers,
    noteProcessorChain: groupChain.getProcessors().length > 0 ? createNoteProcessorChainSnapshot(groupChain) : undefined,
  };
}

export function createScoreDocumentSnapshot(data: BlueData): ScoreDocumentSnapshot {
  const score = data.getScore();
  const rootChain = score.getNoteProcessorChain();
  return {
    timeState: createScoreTimeStateSnapshot(data),
    markers: createMarkerSnapshots(data),
    layerGroups: createScoreLayerGroupSnapshots(data),
    rootNoteProcessorChain: rootChain.getProcessors().length > 0 ? createNoteProcessorChainSnapshot(rootChain) : undefined,
  };
}

export function resolveScoreInsertionLocation(
  data: BlueData,
  location: ScoreInsertionLocation,
): { groupId: string; layerIndex: number } | null {
  const score = data.getScore();
  const root = Array.from(score).find((group) => (
    group instanceof PolyObject && assignLayerGroupId(group) === location.rootGroupId
  ));
  if (!(root instanceof PolyObject)) return null;

  let container = root;
  for (const segment of location.containerPath) {
    const containerId = assignLayerGroupId(container);
    const layerIndex = container.findIndex((_, index) => `${containerId}-layer-${index}` === segment.layerId);
    if (layerIndex < 0) return null;
    const layer = container[layerIndex];
    const nested = layer?.find((object) => assignScoreObjectId(object, 'sobj') === segment.objectIdentity);
    if (!(nested instanceof PolyObject)) return null;
    container = nested;
  }

  const groupId = assignLayerGroupId(container);
  const layerIndex = container.findIndex((_, index) => `${groupId}-layer-${index}` === location.layerId);
  return layerIndex < 0 ? null : { groupId, layerIndex };
}

export function createEmptyScoreDocumentSnapshot(): ScoreDocumentSnapshot {
  return {
    timeState: {
      snapEnabled: false,
      snapValue: 'BEAT',
      primaryTimeDisplay: 'BEATS',
      secondaryTimeDisplay: 'TIME',
      secondaryRulerEnabled: false,
      tempoRowVisible: true,
      meterRowVisible: true,
      markersRowVisible: true,
      smpteFrameRate: 24,
      zoomIterations: 0,
    },
    markers: [],
    layerGroups: [],
    rootNoteProcessorChain: undefined,
  };
}

function buildEditorTargetSnapshot(
  sObj: SoundObject,
  selectionId: string,
  location: ScoreObjectLocationRef,
): ScoreObjectEditorTargetSnapshot {
  const isInstance = sObj instanceof Instance;
  const lib = isInstance ? (sObj as Instance).getSoundObject() : null;
  const libraryId = isInstance ? (sObj as Instance).getLibraryId() : null;

  if (isInstance && lib) {
    return {
      selectionId,
      selectedObjectType: 'Instance',
      editorObjectType: lib.constructor.name,
      ownerKind: 'library',
      displayContext: 'instance',
      sourceInstanceLocation: location,
      ...(libraryId
        ? {
            library: {
              libraryId,
              libraryIndex: -1,
              objectType: lib.constructor.name,
            },
          }
        : {}),
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };
  }

  const isSoundObject = sObj instanceof AbstractSoundObject;
  return {
    selectionId,
    selectedObjectType: sObj.constructor.name,
    editorObjectType: sObj.constructor.name,
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location,
    supportsTimeBehavior: isSoundObject,
    supportsRepeatPoint: isSoundObject,
    supportsNoteProcessorChain: isSoundObject,
  };
}

export function createBlueLiveEditorTargetSnapshot(
  cell: LiveObjectCellSnapshot,
  column: number,
  row: number,
): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: cell.uniqueId,
    selectedObjectType: cell.soundObjectType,
    editorObjectType: cell.soundObjectType,
    ownerKind: 'blueLive',
    displayContext: 'blueLive',
    blueLive: {
      liveObjectId: cell.uniqueId,
      column,
      row,
    },
    supportsTimeBehavior: cell.hasSoundObject,
    supportsRepeatPoint: cell.hasSoundObject,
    supportsNoteProcessorChain: cell.hasSoundObject,
  };
}

export function createScoreObjectPropertiesTarget(
  target: ScoreObjectEditorTargetSnapshot,
): ScoreObjectEditorTargetSnapshot {
  if (
    target.selectedObjectType !== 'Instance'
    || target.displayContext !== 'instance'
    || !target.sourceInstanceLocation
  ) {
    return target;
  }
  const { library: _library, sourceInstanceLocation, ...instanceTarget } = target;
  return {
    ...instanceTarget,
    editorObjectType: 'Instance',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: sourceInstanceLocation,
  };
}

function getCodeText(sObj: SoundObject): string {
  if (sObj instanceof GenericScore) return sObj.getScoreText();
  if (sObj instanceof PythonObject) return sObj.getPythonCode();
  if (sObj instanceof ObjectBuilder) return sObj.getCode();
  if (sObj instanceof ClojureObject) return sObj.getClojureCode();
  if (sObj instanceof JavaScriptObject) return sObj.getJavaScriptCode();
  if (sObj instanceof Comment) return sObj.getText();
  if (sObj instanceof External) return sObj.getText();
  return '';
}

export function setCodeText(sObj: SoundObject, text: string): boolean {
  if (sObj instanceof GenericScore) { sObj.setScoreText(text); return true; }
  if (sObj instanceof PythonObject) { sObj.setPythonCode(text); return true; }
  if (sObj instanceof ObjectBuilder) { sObj.setCode(text); return true; }
  if (sObj instanceof ClojureObject) { sObj.setClojureCode(text); return true; }
  if (sObj instanceof JavaScriptObject) { sObj.setJavaScriptCode(text); return true; }
  if (sObj instanceof Comment) { sObj.setText(text); return true; }
  if (sObj instanceof External) { sObj.setText(text); return true; }
  return false;
}

function getEditorFamily(objectType: string): TypeSpecificScoreObjectEditorSnapshot['kind'] {
  switch (objectType) {
    case 'AudioClip':
      return 'audioClip';
    case 'External':
      return 'external';
    case 'PolyObject':
      return 'polyObject';
    case 'TrackerObject':
      return 'tracker';
    case 'GenericScore':
    case 'PythonObject':
    case 'ObjectBuilder':
    case 'ClojureObject':
    case 'JavaScriptObject':
    case 'Comment':
      return 'code';
    case 'AudioFile':
    case 'FrozenSoundObject':
      return 'file';
    case 'PatternObject':
    case 'PianoRoll':
    case 'LineObject':
    case 'ZakLineObject':
    case 'JMask':
    case 'Sound':
      return 'structured';
    default:
      return 'fallback';
  }
}

function getSyntaxForType(
  objectType: string,
  sObj?: SoundObject | AudioClip,
): 'text' | 'csound-score' | 'python' | 'javascript' {
  switch (objectType) {
    case 'PythonObject': return 'python';
    case 'JavaScriptObject': return 'javascript';
    case 'ObjectBuilder':
      if (sObj instanceof ObjectBuilder) {
        switch (sObj.getLanguageType()) {
          case 'PYTHON':
            return 'python';
          case 'JAVASCRIPT':
            return 'javascript';
          default:
            return 'text';
        }
      }
      return 'text';
    case 'GenericScore': return 'csound-score';
    default: return 'text';
  }
}

export function resolveTimelineTarget(
  score: Score,
  location: ScoreObjectLocationRef,
): { sObj: SoundObject | AudioClip; layer: Array<SoundObject | AudioClip>; objectIndex: number } | null {
  const rootGroup = score[location.rootGroupIndex];
  if (!rootGroup) return null;

  if (rootGroup instanceof PolyObject) {
    let container: PolyObject = rootGroup;

    for (const segment of location.containerPath) {
      const containerLayer = container[segment.layerIndex];
      if (!containerLayer) return null;
      const nested = containerLayer[segment.objectIndex];
      if (!(nested instanceof PolyObject)) return null;
      container = nested;
    }

    const layer = container[location.layerIndex] as Array<SoundObject | AudioClip> | undefined;
    if (!layer) return null;
    const sObj = layer[location.objectIndex] ?? null;
    if (!sObj) return null;
    return { sObj, layer, objectIndex: location.objectIndex };
  }

  if (rootGroup instanceof TrackLayerGroup) {
    if (location.containerPath.length > 0) return null;
    const layer = rootGroup[location.layerIndex] as Array<SoundObject | AudioClip> | undefined;
    if (!layer) return null;
    const sObj = layer[location.objectIndex] ?? null;
    if (!sObj) return null;
    return { sObj, layer, objectIndex: location.objectIndex };
  }

  return null;
}

export function resolveEditorTarget(data: BlueData, target: ScoreObjectEditorTargetSnapshot): { sObj: SoundObject | AudioClip; isLibraryOwned: boolean } | null {
  const score = data.getScore();

  let sObj: SoundObject | AudioClip | null = null;
  let isLibraryOwned = false;

  if (target.ownerKind === 'blueLive' && target.displayContext === 'blueLive') {
    const ref = target.blueLive;
    if (!ref) return null;
    const bins = data.getLiveData().getLiveObjectBins();
    let liveObject = bins.getLiveObject(ref.column, ref.row);
    if (liveObject?.getUniqueId() !== ref.liveObjectId) {
      liveObject = bins.getLiveObjectByUniqueId(ref.liveObjectId);
    }
    sObj = liveObject?.getSoundObject() ?? null;
  } else if (target.ownerKind === 'library' && target.displayContext === 'instance') {
    isLibraryOwned = true;
    const lib = data.getSoundObjectLibrary();
    if (target.library) {
      sObj = lib.getObjectById(target.library.libraryId) ?? null;
    } else {
      const instLoc = target.sourceInstanceLocation;
      if (instLoc) {
        const timelineResolved = resolveTimelineTarget(score, instLoc);
        if (timelineResolved?.sObj instanceof Instance) {
          sObj = timelineResolved.sObj.getSoundObject();
        }
      }
    }
  } else {
    const loc = target.location;
    if (!loc) return null;
    sObj = resolveTimelineTarget(score, loc)?.sObj ?? null;
  }

  return sObj ? { sObj, isLibraryOwned } : null;
}

function formatTimeDisplay(startTime: number, duration: number): string {
  const end = startTime + duration;
  return `${end.toFixed(4)}`;
}

function createTimeValueSnapshot(value: number, timeBase: string): TimeValueSnapshot {
  return {
    value,
    timeBase,
    displayText: `${value.toFixed(4)}`,
  };
}

function createTimeConversionContext(context: TimeContext): TimeConversionContext {
  const meterMap = context.getMeterMap();
  const meterEntries: TimeConversionMeterEntry[] = [];
  for (let i = 0; i < meterMap.size(); i++) {
    const entry = meterMap.get(i);
    meterEntries.push({
      measure: entry.measure,
      numBeats: entry.meter.numBeats,
      beatLength: entry.meter.beatLength,
    });
  }
  const tempoMap = context.getTempoMap();
  const tempoPoints = tempoMap.getTempoPoints();
  return {
    meterEntries,
    tempoEnabled: tempoMap.isEnabled(),
    initialTempo: tempoPoints.length > 0 ? tempoPoints[0].tempo : 60,
    sampleRate: context.getSampleRate(),
  };
}

export function createNoteProcessorChainSnapshot(chain: NoteProcessorChain): NoteProcessorChainSnapshot {
  return createNoteProcessorChainSnapshotFromData(chain) as NoteProcessorChainSnapshot;
}

export function createScoreObjectEditorDocument(
  data: BlueData,
  request: ScoreObjectEditorRequest,
): ScoreObjectEditorDocumentSnapshot | null {
  const target = request.target;
  const resolved = resolveEditorTarget(data, target);
  if (!resolved) {
    const fallbackDisplay = data.getScore().getTimeState().getTimeDisplay() as string;
    return {
      target,
      shared: {
        target,
        name: '',
        startTime: createTimeValueSnapshot(0, fallbackDisplay),
        subjectiveDuration: createTimeValueSnapshot(0, fallbackDisplay),
        endTimeDisplay: '0.0000',
        backgroundColor: 0,
      },
      editor: { kind: 'fallback', target, reason: 'removed-target', message: 'Score object no longer exists.' },
      timeContext: createTimeConversionContext(data.getScore().getTimeContext()),
    };
  }

  const { sObj, isLibraryOwned } = resolved;
  const score = data.getScore();
  const context = score.getTimeContext();
  const primaryDisplay = score.getTimeState().getTimeDisplay() as string;
  const isSoundObject = sObj instanceof AbstractSoundObject;

  const startTime = sObj instanceof AudioClip
    ? sObj.getStartTime().toBeats(context)
    : (sObj as SoundObject).getStartTime().toBeats(context);
  const startTimeBase = String(sObj instanceof AudioClip
    ? sObj.getStartTime().getTimeBase()
    : (sObj as SoundObject).getStartTime().getTimeBase());
  const duration = sObj instanceof AudioClip
    ? sObj.getSubjectiveDuration().toBeats(context)
    : (sObj as SoundObject).getSubjectiveDuration().toBeats(context);
  const durationBase = String(sObj instanceof AudioClip
    ? sObj.getSubjectiveDuration().getTimeBase()
    : (sObj as SoundObject).getSubjectiveDuration().getTimeBase());

  const shared: SharedScoreObjectPropertiesSnapshot = {
    target,
    name: sObj.getName(),
    startTime: createTimeValueSnapshot(startTime, startTimeBase),
    subjectiveDuration: createTimeValueSnapshot(duration, durationBase),
    endTimeDisplay: formatTimeDisplay(startTime, duration),
    backgroundColor: sObj.getBackgroundColor(),
  };

  if (isSoundObject && !(sObj instanceof AudioClip)) {
    const so = sObj as AbstractSoundObject;
    shared.timeBehavior = so.getTimeBehavior();
    const rp = so.getRepeatPoint();
    const rpBase = rp ? String(rp.getTimeBase()) : primaryDisplay;
    shared.repeatPoint = rp ? createTimeValueSnapshot(rp.toBeats(context), rpBase) : null;
    shared.noteProcessorChain = createNoteProcessorChainSnapshot(so.getNoteProcessorChain());
  }

  const objectType = target.editorObjectType;
  const family = getEditorFamily(objectType);

  let editor: TypeSpecificScoreObjectEditorSnapshot;

  switch (family) {
    case 'code': {
      const auxiliaryFlags: Record<string, string | number | boolean> | undefined =
        sObj instanceof JavaScriptObject
          ? { onLoadProcessable: sObj.isOnLoadProcessable() }
          : sObj instanceof ClojureObject
            ? { onLoadProcessable: sObj.isOnLoadProcessable() }
          : sObj instanceof PythonObject
            ? { onLoadProcessable: sObj.isOnLoadProcessable() }
            : sObj instanceof ObjectBuilder
              ? {
                commandLine: sObj.getCommandLine(),
                languageType: sObj.getLanguageType(),
                editEnabled: sObj.isEditEnabled(),
              }
            : undefined;
      editor = {
        kind: 'code',
        target,
        syntax: getSyntaxForType(objectType, sObj as SoundObject),
        text: getCodeText(sObj as SoundObject),
        ...(auxiliaryFlags ? { auxiliaryFlags } : {}),
      };
      break;
    }
    case 'external': {
      const ext = sObj as External;
      editor = {
        kind: 'external',
        target,
        scoreText: ext.getText(),
        commandLine: ext.getCommandLine(),
        syntaxType: ext.getSyntaxType(),
        canTest: true,
      };
      break;
    }
    case 'audioClip': {
      const clip = sObj as AudioClip;
      editor = {
        kind: 'audioClip',
        target,
        audioFile: clip.getAudioFile ? clip.getAudioFile() : '',
        numChannels: clip.getNumChannels ? clip.getNumChannels() : 0,
        audioDuration: clip.getAudioDuration ? clip.getAudioDuration() : 0,
        fileStartTime: clip.getFileStartTime ? clip.getFileStartTime() : 0,
        fadeIn: clip.getFadeIn ? clip.getFadeIn() : 0,
        fadeInType: normalizeAudioFadeType(clip.getFadeInType ? String(clip.getFadeInType()) : 'LINEAR'),
        fadeOut: clip.getFadeOut ? clip.getFadeOut() : 0,
        fadeOutType: normalizeAudioFadeType(clip.getFadeOutType ? String(clip.getFadeOutType()) : 'LINEAR'),
        looping: clip.isLooping ? clip.isLooping() : false,
      };
      break;
    }
    case 'file': {
      if (sObj instanceof AudioFile) {
        const af = sObj as AudioFile;
        editor = {
          kind: 'file',
          target,
          objectType,
          filePath: af.getSoundFileName(),
          csoundPostCode: af.getCsoundPostCode(),
        };
      } else if (sObj instanceof FrozenSoundObject) {
        const fso = sObj as FrozenSoundObject;
        const inner = fso.getFrozenSoundObject();
        editor = {
          kind: 'file',
          target,
          objectType,
          filePath: fso.getFrozenWaveFileName(),
          numChannels: fso.getNumChannels(),
          originalObjectType: inner?.constructor.name ?? '',
        };
      } else {
        editor = {
          kind: 'file',
          target,
          objectType,
          filePath: '',
        };
      }
      break;
    }
    case 'polyObject': {
      const pObj = sObj as PolyObject;
      const children: Array<{
        objectId: string;
        name: string;
        objectType: string;
        startBeats: number;
        durationBeats: number;
        layerLabel: string;
      }> = [];
      for (let li = 0; li < pObj.length; li++) {
        const layer = pObj[li];
        for (let oi = 0; oi < layer.length; oi++) {
          const child = layer[oi];
          children.push({
            objectId: assignScoreObjectId(child, 'sobj'),
            name: child.getName(),
            objectType: child.constructor.name,
            startBeats: child.getStartTime().toBeats(context),
            durationBeats: child.getSubjectiveDuration().toBeats(context),
            layerLabel: layer.getName(),
          });
        }
      }
      editor = {
        kind: 'polyObject',
        target,
        children,
        generatedScoreText: '',
        canOpenInScore: true,
        canTest: true,
      };
      break;
    }
    case 'tracker': {
      const to = sObj as TrackerObject;
      const trackList = to.getTracks();
      const stepsPerBeat = to.getStepsPerBeat();
      const numSteps = trackList.getSteps();

      const tracks: Array<{
        trackId: string;
        trackName: string;
        instrumentId: string;
        noteTemplate: string;
        columns: TrackerColumnSnapshot[];
      }> = [];

      for (let ti = 0; ti < trackList.size(); ti++) {
        const track = trackList.getTrack(ti)!;
        const columns: TrackerColumnSnapshot[] = [];
        // skip col 0 (tied state handled specially in UI)
        for (let ci = 1; ci < track.getNumColumns(); ci++) {
          const col = track.getColumn(ci);
          if (col) {
            columns.push(createTrackerColumnSnapshot(col, ci - 1));
          }
        }
        tracks.push({
          trackId: `tracker-track-${ti}`,
          trackName: track.getName() || `Track ${ti + 1}`,
          instrumentId: track.getInstrumentId(),
          noteTemplate: track.getNoteTemplate(),
          columns,
        });
      }

      const rows: Array<Record<string, string | number | null>> = [];
      if (trackList.size() > 0) {
        for (let si = 0; si < numSteps; si++) {
          const row: Record<string, string | number | null> = { step: si };
          for (let ti = 0; ti < trackList.size(); ti++) {
            const track = trackList.getTrack(ti)!;
            const trNote = track.getTrackerNote(si);

            // tied/off state
            let status = '';
            if (trNote.isOff()) {
              status = 'OFF';
            } else if (trNote.isTied()) {
              status = '-';
            }
            row[`track-${ti}-status`] = status;

            for (let ci = 1; ci < track.getNumColumns(); ci++) {
              row[`track-${ti}-col-${ci - 1}`] = trNote.getValue(ci);
            }
          }
          rows.push(row);
        }
      }
      editor = {
        kind: 'tracker',
        target,
        steps: numSteps,
        stepsPerBeat,
        showNoteNames: false,
        octave: 0,
        tracks,
        rows,
        canTest: true,
      };
      break;
    }
    case 'structured': {
      if (sObj instanceof PatternObject) {
        const po = sObj as PatternObject;
        const numSteps = po.getBeats() * po.getSubDivisions();
        const patterns: Array<{
          patternName: string;
          patternScore: string;
          muted: boolean;
          solo: boolean;
          values: boolean[];
        }> = [];
        for (let i = 0; i < po.size(); i++) {
          const p = po.getPattern(i);
          patterns.push({
            patternName: p.patternName,
            patternScore: p.patternScore,
            muted: p.muted,
            solo: p.solo,
            values: [...p.values],
          });
        }
        editor = {
          kind: 'structured',
          target,
          editorFamily: objectType,
          payloadSummary: `${po.size()} pattern(s), ${po.getBeats()} beats, ${po.getSubDivisions()} sub`,
          payload: {
            beats: po.getBeats(),
            subDivisions: po.getSubDivisions(),
            numSteps,
            patterns,
          },
        };
      } else if (sObj instanceof LineObject) {
        const lo = sObj as LineObject;
        editor = {
          kind: 'structured',
          target,
          editorFamily: objectType,
          payloadSummary: `${lo.getLines().length} line(s)`,
          payload: {
            lines: lo.getLines().map(l => ({
              varName: l.varName,
              min: l.min,
              max: l.max,
              resolution: l.resolution,
              color: l.color,
              rightBound: l.rightBound,
              endPointsLinked: l.endPointsLinked,
              points: l.points.map(pt => ({ x: pt.x, y: pt.y })),
            })),
          },
        };
      } else if (sObj instanceof ZakLineObject) {
        const zlo = sObj as ZakLineObject;
        editor = {
          kind: 'structured',
          target,
          editorFamily: objectType,
          payloadSummary: `${zlo.getLines().length} zak line(s), zak space: ${zlo.getZakSpace()}`,
          payload: {
            zakSpace: zlo.getZakSpace(),
            lines: zlo.getLines().map(l => ({
              channel: l.channel,
              min: l.min,
              max: l.max,
              resolution: l.resolution,
              color: l.color,
              rightBound: l.rightBound,
              endPointsLinked: l.endPointsLinked,
              points: l.points.map(pt => ({ x: pt.x, y: pt.y })),
            })),
          },
        };
      } else if (sObj instanceof PianoRoll) {
        const pr = sObj as PianoRoll;
        const scale = pr.getScale();
        const fieldDefs = pr.getFieldDefinitions();
        editor = {
          kind: 'structured',
          target,
          editorFamily: objectType,
          payloadSummary: `${pr.getNotes().length} notes`,
          payload: {
            instrumentId: pr.getInstrumentId(),
            noteTemplate: pr.getNoteTemplate(),
            pchGenerationMethod: pr.getPchGenerationMethod(),
            transposition: pr.getTransposition(),
            pixelSecond: pr.getPixelSecond(),
            noteHeight: pr.getNoteHeight(),
            snapEnabled: pr.isSnapEnabled(),
            snapValue: pr.getSnapValueEnum(),
            useGlobalRuler: pr.isUseGlobalRuler(),
            primaryTimeDisplay: pr.getPrimaryTimeDisplay(),
            secondaryTimeDisplay: pr.getSecondaryTimeDisplay(),
            secondaryRulerEnabled: pr.isSecondaryRulerEnabled(),
            scale: {
              scaleName: scale.scaleName,
              baseFrequency: scale.baseFrequency,
              octave: scale.octave,
              ratios: [...scale.ratios],
            },
            fieldDefinitions: fieldDefs.map((fd) => ({
              fieldName: fd.getFieldName(),
              fieldType: fd.getFieldType(),
              minValue: fd.getMinValue(),
              maxValue: fd.getMaxValue(),
              defaultValue: fd.getDefaultValue(),
            })),
            notes: pr.getNotes().map((n) => ({
              octave: n.getOctave(),
              scaleDegree: n.getScaleDegree(),
              start: n.getStart(),
              duration: n.getDuration(),
              fieldValues: n.getFields().map((f) => f.getValue()),
              noteTemplate: n.getNoteTemplate(),
            })),
            capabilities: {
              fieldEditor: true,
              clipboard: true,
              undo: true,
              noteTemplateOverride: true,
            },
            deferredCapabilities: [],
          },
        };
      } else if (sObj instanceof JMask) {
        const jm = sObj as JMask;
        const payload = createJMaskEditorPayload(jm);
        editor = {
          kind: 'structured',
          target,
          editorFamily: objectType,
          payloadSummary: createJMaskPayloadSummary(payload),
          payload,
        };
      } else if (sObj instanceof Sound) {
        const snd = sObj as Sound;
        const bsbText = snd.getBSBInstrumentText();
        const bsb = parseSoundBSB(bsbText);

        let bsbInstrument: BlueSynthBuilderInstrumentSnapshot | null = null;
        let automationParameters: SoundAutomationParameterSnapshot[] = [];

        if (bsb) {
          bsbInstrument = buildSoundBSBInstrumentSnapshot(bsb);
          automationParameters = buildSoundAutomationParameters(bsb);
        }

        const availableTabs: SoundEditorTab[] = [];
        if (bsb) {
          availableTabs.push('interface', 'automation', 'code', 'udo');
        }
        availableTabs.push('comments');

        editor = {
          kind: 'structured',
          target,
          editorFamily: objectType,
          payloadSummary: bsb ? 'BSB instrument' : 'BSB instrument (empty)',
          payload: {
            comment: snd.getComment(),
            bsbInstrument,
            automationParameters,
            availableTabs,
            testAvailable: false,
            deferredCapabilities: [],
          } satisfies SoundEditorPayload,
        };
      } else {
        editor = {
          kind: 'structured',
          target,
          editorFamily: objectType,
          payloadSummary: `${objectType} editor`,
          payload: {},
        };
      }
      break;
    }
    default: {
      editor = {
        kind: 'fallback',
        target,
        reason: 'unsupported',
        message: `Editor for ${objectType} is not yet supported.`,
      };
      break;
    }
  }

  return { target, shared, editor, timeContext: createTimeConversionContext(context) };
}

export function createFallbackEditorDocument(
  reason: TypeSpecificScoreObjectEditorSnapshot extends { kind: 'fallback'; reason: infer R } ? R : never,
  message: string,
): ScoreObjectEditorDocumentSnapshot {
  const target: ScoreObjectEditorTargetSnapshot = {
    selectionId: '',
    selectedObjectType: '',
    editorObjectType: '',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    supportsTimeBehavior: false,
    supportsRepeatPoint: false,
    supportsNoteProcessorChain: false,
  };
  return {
    target,
    shared: {
      target,
      name: '',
      startTime: createTimeValueSnapshot(0, 'beats'),
      subjectiveDuration: createTimeValueSnapshot(0, 'beats'),
      endTimeDisplay: '0.0000',
      backgroundColor: 0,
    },
    editor: { kind: 'fallback', target, reason, message },
    timeContext: { meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }], tempoEnabled: false, initialTempo: 60, sampleRate: 44100 },
  };
}

function applyTimebaseUpdate(
  data: BlueData,
  oldTimeBase: TimeBase,
  newTimeBase: TimeBase,
  scoreObjectMode: 'UPDATE_ALL' | 'UPDATE_MATCHING',
  markerMode: 'UPDATE_ALL' | 'UPDATE_MATCHING' | null,
): void {
  const score = data.getScore();
  const context = score.getTimeContext();

  if (scoreObjectMode != null) {
    for (const layerGroup of score) {
      for (const layer of layerGroup) {
        if (!Array.isArray(layer)) continue;
        for (const sObj of layer as unknown as BlueDataScoreObject[]) {
          if (!('getStartTime' in sObj)) continue;
          const updateStart = scoreObjectMode === 'UPDATE_ALL'
            || sObj.getStartTime().getTimeBase() === oldTimeBase;
          if (updateStart) {
            sObj.setStartTime(convertTimePosition(sObj.getStartTime(), newTimeBase, context));
          }
          const updateDuration = scoreObjectMode === 'UPDATE_ALL'
            || sObj.getSubjectiveDuration().getTimeBase() === oldTimeBase;
          if (updateDuration) {
            const durBeats = sObj.getSubjectiveDuration().toBeats(context);
            sObj.setSubjectiveDuration(beatsToDuration(durBeats, newTimeBase, context));
          }
          if ('getRepeatPoint' in sObj && 'setRepeatPoint' in sObj) {
            const so = sObj as AbstractSoundObject;
            const rp = so.getRepeatPoint();
            if (rp) {
              const shouldUpdate = scoreObjectMode === 'UPDATE_ALL'
                || rp.getTimeBase() === oldTimeBase;
              if (shouldUpdate) {
                const rpBeats = rp.toBeats(context);
                so.setRepeatPoint(beatsToDuration(rpBeats, newTimeBase, context));
              }
            }
          }
        }
      }
    }
  }

  if (markerMode != null) {
    // TODO: Implement marker timebase update when MarkersList is ported to @blue/data
  }
}

export function applyScoreTimeStatePatch(
  data: BlueData,
  patch: Partial<ScoreTimeStateSnapshot>,
): boolean {
  const ts = data.getScore().getTimeState();
  let changed = false;

  if (patch.snapEnabled !== undefined && ts.isSnapEnabled() !== patch.snapEnabled) {
    ts.setSnapEnabled(patch.snapEnabled);
    changed = true;
  }
  if (patch.snapValue !== undefined && isValidSnapValueName(patch.snapValue) && ts.getSnapValue() !== patch.snapValue) {
    ts.setSnapValue(patch.snapValue as SnapValueName);
    changed = true;
  }
  let oldTimeDisplay: TimeBase | undefined;
  if (patch.primaryTimeDisplay !== undefined) {
    const td = patch.primaryTimeDisplay as TimeBase;
    if (Object.values(TimeBase).includes(td) && ts.getTimeDisplay() !== td) {
      oldTimeDisplay = ts.getTimeDisplay();
      ts.setTimeDisplay(td);
      changed = true;
    }
  }
  if (patch.secondaryTimeDisplay !== undefined) {
    const std = patch.secondaryTimeDisplay as TimeBase;
    if (Object.values(TimeBase).includes(std) && ts.getSecondaryTimeDisplay() !== std) {
      ts.setSecondaryTimeDisplay(std);
      changed = true;
    }
  }
  if (patch.secondaryRulerEnabled !== undefined && ts.isSecondaryRulerEnabled() !== patch.secondaryRulerEnabled) {
    ts.setSecondaryRulerEnabled(patch.secondaryRulerEnabled);
    changed = true;
  }
  if (patch.tempoRowVisible !== undefined && ts.isTempoRowVisible() !== patch.tempoRowVisible) {
    ts.setTempoRowVisible(patch.tempoRowVisible);
    changed = true;
  }
  if (patch.meterRowVisible !== undefined && ts.isMeterRowVisible() !== patch.meterRowVisible) {
    ts.setMeterRowVisible(patch.meterRowVisible);
    changed = true;
  }
  if (patch.markersRowVisible !== undefined && ts.isMarkersRowVisible() !== patch.markersRowVisible) {
    ts.setMarkersRowVisible(patch.markersRowVisible);
    changed = true;
  }
  if (patch.smpteFrameRate !== undefined && patch.smpteFrameRate > 0 && ts.getSmpteFrameRate() !== patch.smpteFrameRate) {
    ts.setSmpteFrameRate(patch.smpteFrameRate);
    changed = true;
  }
  if (patch.zoomIterations !== undefined && ts.getZoomIterations() !== patch.zoomIterations) {
    ts.setZoomIterations(patch.zoomIterations);
    changed = true;
  }

  if (oldTimeDisplay !== undefined && patch.scoreObjectUpdateMode != null) {
    const newBase = patch.primaryTimeDisplay as TimeBase;
    applyTimebaseUpdate(data, oldTimeDisplay, newBase, patch.scoreObjectUpdateMode, patch.markerUpdateMode ?? null);
  }

  return changed;
}

function isValidTimeBase(value: unknown): value is TimeBase {
  return typeof value === 'string' && Object.values(TimeBase).includes(value as TimeBase);
}

function isNonEmptyScorePatch(patch: ScorePatch): boolean {
  if (patch.type === 'updateTimeState') {
    return Object.keys(patch.patch).length > 0;
  }
  if (patch.type === 'updateLayerState') {
    return Object.keys(patch.patch).length > 0;
  }
  if (patch.type === 'updateSharedProperties' || patch.type === 'updateSoundObjectBehavior' || patch.type === 'replaceNoteProcessorChain' || patch.type === 'updateTypeSpecificEditor' || patch.type === 'replaceScopedNoteProcessorChain' || patch.type === 'saveNamedNoteProcessorChain' || patch.type === 'deleteNamedNoteProcessorChain') {
    return true;
  }
  if (patch.type === 'addScoreObjects' || patch.type === 'moveScoreObjects' || patch.type === 'addLayer' || patch.type === 'removeLayer') {
    return true;
  }
  if (patch.type === 'removeScoreObjects') {
    return patch.targets.length > 0;
  }
  return true;
}

function scorePatchTouchesMixerAudioChannels(patch: ScorePatch): boolean {
  switch (patch.type) {
    case 'addLayer':
    case 'removeLayer':
    case 'renameLayer':
    case 'renameLayerGroup':
    case 'moveLayerGroup':
    case 'removeLayerGroup':
      return true;
    case 'addLayerGroup':
      return patch.groupType === 'track' || patch.groupType === undefined;
    default:
      return false;
  }
}

// ─── End Score Snapshot Helpers ───

export function createProjectEditorSnapshot(
  data: BlueData,
  filePath: string | null,
  sessionId = 0,
): ProjectEditorSnapshot {
  reconcileMixerWithArrangement(data);
  return {
    filePath,
    version: data.getVersion(),
    sessionId,
    globalOrc: data.getGlobalOrcSco().getGlobalOrc(),
    globalSco: data.getGlobalOrcSco().getGlobalSco(),
    orchestra: createOrchestraSnapshot(data),
    mixer: createMixerSnapshot(data.getMixer()),
    projectProperties: createProjectPropertiesSnapshot(
      data.getProjectProperties(),
    ),
    clojureProject: createClojureProjectSnapshot(data.getClojureProjectData()),
    transport: createToolbarProjectTransportSnapshot(data),
    tablesText: data.getTableSet().getTables(),
    projectUdos: createProjectUdoListSnapshot(data),
    loaded: true,
    blueLive: createBlueLiveProjectSnapshot(
      data.getLiveData(),
      data.getScore().getTimeContext(),
    ),
    midiInput: createMidiInputProcessorSnapshot(data.getMidiInputProcessor()),
    score: createScoreDocumentSnapshot(data),
    namedChains: { names: data.getNoteProcessorChainMap().getChainNames() },
  };
}

function getInstrumentSnapshotType(instrument: Instrument | undefined): InstrumentSnapshot['type'] {
  if (instrument instanceof GenericInstrument) return 'generic';
  if (instrument instanceof JavaScriptInstrument) return 'javascript';
  if (instrument instanceof PythonInstrument) return 'python';
  if (instrument instanceof BlueX7) return 'blueX7';
  if (instrument instanceof BlueSynthBuilder) return 'blueSynthBuilder';
  return 'unknown';
}

function getInstrumentSummary(instrument: Instrument | undefined): string {
  if (!instrument) return 'Unresolved instrument';
  return instrument.constructor.name;
}

function collectBsbWidgets(bsb: BlueSynthBuilder): BsbWidgetSnapshot[] {
  const widgets: BsbWidgetSnapshot[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const objectName =
      typeof record.getObjectName === 'function'
        ? (record.getObjectName as () => unknown)()
        : record.objectName ?? record._objectName;
    if (typeof objectName === 'string' && objectName.trim()) {
      widgets.push({
        objectName: objectName.trim(),
        widgetType:
          typeof record.constructor === 'function' && 'name' in record.constructor
            ? String(record.constructor.name)
            : 'BSBObject',
        value: typeof record.value === 'number' ? record.value : 0,
        minimum: typeof record.minimum === 'number' ? record.minimum : 0,
        maximum: typeof record.maximum === 'number' ? record.maximum : 1,
      });
    }
    const children =
      typeof record.getChildren === 'function'
        ? (record.getChildren as () => unknown[]).call(node)
        : record.children ?? record._children;
    if (Array.isArray(children)) {
      children.forEach(visit);
    }
  };

  visit(bsb.getGraphicInterface().getRootGroup());
  return widgets.sort((a, b) => a.objectName.localeCompare(b.objectName));
}

function collectBsbObjectNames(bsb: BlueSynthBuilder): string[] {
  return collectBsbReplacementKeysFromWidgetTree(bsb.getGraphicInterface().getRootGroup());
}

function parseSoundBSB(text: string): BlueSynthBuilder {
  const trimmed = text.trim();
  if (!trimmed) {
    return new BlueSynthBuilder();
  }

  try {
    const elem = Element.parse(trimmed);
    if (elem.getName() === 'instrument') {
      return BlueSynthBuilder.loadFromXML(elem);
    }
    const nestedInstrument = elem.getElement('instrument');
    if (nestedInstrument) {
      return BlueSynthBuilder.loadFromXML(nestedInstrument);
    }
  } catch {
    // Fall through to legacy plain-text migration
  }

  const legacy = new BlueSynthBuilder();
  legacy.setInstrumentText(trimmed);
  return legacy;
}

function buildSoundAutomationParameters(bsb: BlueSynthBuilder): SoundAutomationParameterSnapshot[] {
  const params = bsb.getParameters();
  return params.map((param) => ({
    parameterId: param.getUniqueId(),
    name: param.getName(),
    label: param.getLabel(),
    automationEnabled: param.isEnabled(),
    value: param.getFixedValue(),
    minimum: param.getMinimum(),
    maximum: param.getMaximum(),
    resolution: param.getResolution(),
    curve: param.getCurve(),
    points: param.getPoints().map((p) => ({ x: p.time, y: p.value })),
  }));
}

function buildAutomationParameterSnapshot(param: BlueDataParameter): AutomationParameterSnapshot {
  const name = param.getName();
  const label = param.getLabel();
  return {
    parameterId: param.getUniqueId(),
    name,
    label,
    displayName: label || name || param.getUniqueId(),
    minimum: param.getMinimum(),
    maximum: param.getMaximum(),
    resolution: param.getResolution(),
    curve: param.getCurve(),
    fixedValue: param.getFixedValue(),
    automationEnabled: param.isAutomationEnabled(),
    lineColor: param.getLineColor(),
    sourceKind: 'unknown' as AutomationTargetSourceKind,
    targetPath: [],
    points: param.getPoints().map((p) => ({ time: p.time, value: p.value })),
  };
}

function collectLayerAutomationSnapshot(
  layerId: string,
  layerKind: AutomationLayerKind,
  automatableLayer: BlueDataAutomatableLayer,
  allParameters: BlueDataParameter[],
  assignedElsewhere: Map<string, { layerId: string; layerName: string }>,
  layerGroupId: string,
  arrangement: BlueDataArrangement,
  mixer: BlueDataMixer,
): ScoreLayerAutomationSnapshot | undefined {
  const paramIdList = automatableLayer.getAutomationParameters();
  const assignedIds = paramIdList.getIds();

  const paramMap = new Map<string, BlueDataParameter>();
  for (const p of allParameters) {
    paramMap.set(p.getUniqueId(), p);
  }

  const resolvedParameters: AutomationParameterSnapshot[] = [];
  const missingParameterIds: string[] = [];

  for (const id of assignedIds) {
    const param = paramMap.get(id);
    if (param) {
      resolvedParameters.push(buildAutomationParameterSnapshot(param));
    } else {
      missingParameterIds.push(id);
    }
  }

  const selectedIdx = paramIdList.getSelectedIndex();
  const selectedParameterId = selectedIdx >= 0 && selectedIdx < assignedIds.length
    ? assignedIds[selectedIdx]
    : undefined;

  const targetGroups = layerKind === 'track'
    ? buildTrackAutomationTargetGroups(automatableLayer, assignedIds, assignedElsewhere, mixer)
    : buildAutomationTargetGroups(
      assignedIds,
      allParameters,
      assignedElsewhere,
      arrangement,
      mixer,
    );

  return {
    layerId,
    layerKind,
    parameterIds: assignedIds,
    selectedParameterId,
    parameters: resolvedParameters,
    targetGroups,
    missingParameterIds,
  };
}

function buildAutomationTargetGroups(
  currentLayerAssignedIds: string[],
  allParameters: BlueDataParameter[],
  assignedElsewhere: Map<string, { layerId: string; layerName: string }>,
  arrangement: BlueDataArrangement,
  mixer: BlueDataMixer,
): AutomationTargetGroupSnapshot[] {
  const rootGroups: AutomationTargetGroupSnapshot[] = [];

  const paramMap = new Map<string, BlueDataParameter>();
  for (const p of allParameters) {
    paramMap.set(p.getUniqueId(), p);
  }

  function getAssignmentState(id: string): {
    assignmentState: AutomationAssignmentState;
    ownerLayerId?: string;
    ownerLayerName?: string;
  } {
    if (currentLayerAssignedIds.includes(id)) {
      return { assignmentState: 'assignedCurrentLayer' };
    }
    const elsewhere = assignedElsewhere.get(id);
    if (elsewhere) {
      return { assignmentState: 'assignedOtherLayer', ownerLayerId: elsewhere.layerId, ownerLayerName: elsewhere.layerName };
    }
    return { assignmentState: 'available' };
  }

  function makeTarget(param: BlueDataParameter): AutomationTargetSnapshot {
    const id = param.getUniqueId();
    const { assignmentState, ownerLayerId, ownerLayerName } = getAssignmentState(id);
    return {
      parameterId: id,
      label: param.getLabel() || param.getName() || id,
      sourceKind: resolveParameterSourceKind(param),
      automationEnabled: param.isAutomationEnabled(),
      assignmentState,
      ownerLayerId,
      ownerLayerName,
    };
  }

  // ─── Instrument group ───
  const instrGroup: AutomationTargetGroupSnapshot = { groupId: 'instrument', label: 'Instrument', subGroups: [], targets: [] };

  for (const ia of arrangement.getArrangement()) {
    if (!ia.enabled || !ia.instr) continue;
    const instr = ia.instr as any;
    if (typeof instr.getParameters !== 'function') continue;
    const instrParams = instr.getParameters();
    if (!instrParams || !Array.isArray(instrParams) || instrParams.length === 0) continue;

    const instrSubGroup: AutomationTargetGroupSnapshot = {
      groupId: `instr-${ia.arrangementId}`,
      label: `${ia.arrangementId}) ${(ia.instr as any).getName?.() ?? 'Instrument'}`,
      subGroups: [],
      targets: instrParams
        .slice()
        .sort((a: BlueDataParameter, b: BlueDataParameter) => a.getName().localeCompare(b.getName()))
        .map((p: BlueDataParameter) => makeTarget(p)),
    };
    instrGroup.subGroups.push(instrSubGroup);
  }
  rootGroups.push(instrGroup);

  // ─── Mixer group ───
  if (mixer.isEnabled()) {
    const mixerGroup: AutomationTargetGroupSnapshot = { groupId: 'mixer', label: 'Mixer', subGroups: [], targets: [] };

    // Channels (source channels from channelListGroups + main channels)
    const sourceChannels = mixer.getAllSourceChannels();
    if (sourceChannels.length > 0) {
      const channelsSubGroup: AutomationTargetGroupSnapshot = { groupId: 'mixer-channels', label: 'Channels', subGroups: [], targets: [] };
      for (const channel of sourceChannels) {
        channelsSubGroup.subGroups.push(buildChannelSubGroup(channel, 'channel', getAssignmentState, 'mixer'));
      }
      mixerGroup.subGroups.push(channelsSubGroup);
    }

    // Sub-Channels
    const subChannels = mixer.getSubChannels();
    if (subChannels.length > 0) {
      const subChannelsGroup: AutomationTargetGroupSnapshot = { groupId: 'mixer-subchannels', label: 'Sub-Channels', subGroups: [], targets: [] };
      for (const channel of subChannels) {
        subChannelsGroup.subGroups.push(buildChannelSubGroup(channel, 'subchannel', getAssignmentState, 'mixer'));
      }
      mixerGroup.subGroups.push(subChannelsGroup);
    }

    // Master (directly, not under a "Channels" wrapper)
    mixerGroup.subGroups.push(buildChannelSubGroup(mixer.getMaster(), 'master', getAssignmentState, 'mixer'));

    rootGroups.push(mixerGroup);
  }

  return rootGroups;
}

function buildTrackAutomationTargetGroups(
  automatableLayer: BlueDataAutomatableLayer,
  currentLayerAssignedIds: string[],
  assignedElsewhere: Map<string, { layerId: string; layerName: string }>,
  mixer: BlueDataMixer,
): AutomationTargetGroupSnapshot[] {
  const getUniqueId = (automatableLayer as unknown as { getUniqueId?: () => string }).getUniqueId;
  const trackId = typeof getUniqueId === 'function' ? getUniqueId.call(automatableLayer) : '';
  if (!trackId) return [];

  const channel = mixer.getAllSourceChannels()
    .find((candidate) => candidate.getAssociation().trim() === trackId);
  if (!channel) return [];

  function getAssignmentState(id: string): {
    assignmentState: AutomationAssignmentState;
    ownerLayerId?: string;
    ownerLayerName?: string;
  } {
    if (currentLayerAssignedIds.includes(id)) {
      return { assignmentState: 'assignedCurrentLayer' };
    }
    const elsewhere = assignedElsewhere.get(id);
    if (elsewhere) {
      return {
        assignmentState: 'assignedOtherLayer',
        ownerLayerId: elsewhere.layerId,
        ownerLayerName: elsewhere.layerName,
      };
    }
    return { assignmentState: 'available' };
  }

  const channelGroup = buildChannelSubGroup(
    channel,
    'trackChannel',
    getAssignmentState,
    'mixer',
  );

  return [{
    groupId: 'track-channel',
    label: 'Track Channel',
    subGroups: channelGroup.subGroups,
    targets: channelGroup.targets,
  }];
}

function buildChannelSubGroup(
  channel: any,
  kind: string,
  getAssignmentState: (id: string) => { assignmentState: AutomationAssignmentState; ownerLayerId?: string; ownerLayerName?: string },
  sourceKind: AutomationTargetSourceKind,
): AutomationTargetGroupSnapshot {
  const channelGroup: AutomationTargetGroupSnapshot = {
    groupId: `mixer-${kind}-${channel.getName?.() ?? 'unknown'}`,
    label: kind === 'master' ? 'Master' : (channel.getName?.() ?? 'Channel'),
    subGroups: [],
    targets: [],
  };

  function makeTarget(param: BlueDataParameter): AutomationTargetSnapshot {
    const id = param.getUniqueId();
    const { assignmentState, ownerLayerId, ownerLayerName } = getAssignmentState(id);
    return {
      parameterId: id,
      label: param.getLabel() || param.getName() || id,
      sourceKind,
      automationEnabled: param.isAutomationEnabled(),
      assignmentState,
      ownerLayerId,
      ownerLayerName,
    };
  }

  function buildEffectSubGroup(effect: any): AutomationTargetGroupSnapshot | null {
    const params = effect.getParameters?.();
    if (!params || params.length === 0) return null;
    return {
      groupId: `effect-${effect.getName?.() ?? 'unknown'}`,
      label: (effect.constructor as any).name === 'Send' ? `Send: ${(effect as any).getSendChannel?.() ?? 'unknown'}` : (effect.getName?.() ?? 'Effect'),
      subGroups: [],
      targets: params
        .slice()
        .sort((a: BlueDataParameter, b: BlueDataParameter) => a.getName().localeCompare(b.getName()))
        .map((p: BlueDataParameter) => makeTarget(p)),
    };
  }

  // Pre-Effects
  const preEffects = channel.getPreEffects?.();
  if (preEffects && preEffects.length > 0) {
    const preGroup: AutomationTargetGroupSnapshot = { groupId: `${channelGroup.groupId}-pre`, label: 'Pre-Effects', subGroups: [], targets: [] };
    for (const effect of preEffects) {
      const sub = buildEffectSubGroup(effect);
      if (sub) preGroup.subGroups.push(sub);
    }
    if (preGroup.subGroups.length > 0) channelGroup.subGroups.push(preGroup);
  }

  // Volume (channel level parameter)
  const levelParam = channel.getLevelParameter?.();
  if (levelParam) {
    channelGroup.targets.push(makeTarget(levelParam));
  }

  // Post-Effects
  const postEffects = channel.getPostEffects?.();
  if (postEffects && postEffects.length > 0) {
    const postGroup: AutomationTargetGroupSnapshot = { groupId: `${channelGroup.groupId}-post`, label: 'Post-Effects', subGroups: [], targets: [] };
    for (const effect of postEffects) {
      const sub = buildEffectSubGroup(effect);
      if (sub) postGroup.subGroups.push(sub);
    }
    if (postGroup.subGroups.length > 0) channelGroup.subGroups.push(postGroup);
  }

  return channelGroup;
}

function resolveParameterSourceKind(param: BlueDataParameter): AutomationTargetSourceKind {
  const compilationVar = param.getCompilationVarName();
  if (compilationVar && compilationVar.includes('mixer')) {
    return 'mixer';
  }
  return 'instrument';
}

function buildAssignedAutomationLayerMap(
  score: Score,
): Map<string, { layerId: string; layerName: string }> {
  const result = new Map<string, { layerId: string; layerName: string }>();

  function visitGroup(group: unknown): void {
    if (!(group instanceof PolyObject) && !(group instanceof TrackLayerGroup)) {
      return;
    }

    const groupId = assignLayerGroupId(group);
    for (let li = 0; li < group.length; li++) {
      const layer = group[li] as BlueDataAutomatableLayer;
      const layerId = group instanceof TrackLayerGroup
        ? (group[li] as TrackLayer).getUniqueId()
        : `${groupId}-layer-${li}`;
      for (const id of layer.getAutomationParameters().getIds()) {
        result.set(id, { layerId, layerName: layer.getName() });
      }

      if (group instanceof PolyObject) {
        const soundLayer = group[li];
        if (!soundLayer) {
          continue;
        }
        for (const sObj of soundLayer) {
          if (sObj instanceof PolyObject) {
            visitGroup(sObj);
          }
        }
      }
    }
  }

  for (let gi = 0; gi < score.length; gi++) {
    visitGroup(score[gi]);
  }

  return result;
}

function buildAssignedElsewhereMapForLayer(
  layerId: string,
  assignedLayerMap: Map<string, { layerId: string; layerName: string }>,
): Map<string, { layerId: string; layerName: string }> {
  const result = new Map<string, { layerId: string; layerName: string }>();
  for (const [parameterId, owner] of assignedLayerMap) {
    if (owner.layerId !== layerId) {
      result.set(parameterId, owner);
    }
  }
  return result;
}

function buildSoundBSBInstrumentSnapshot(bsb: BlueSynthBuilder): BlueSynthBuilderInstrumentSnapshot {
  return {
    assignmentId: '',
    type: 'blueSynthBuilder',
    name: bsb.getName(),
    enabled: true,
    comment: bsb.getComment(),
    instrumentText: bsb.getInstrumentText(),
    alwaysOnInstrumentText: bsb.getAlwaysOnInstrumentText(),
    globalOrc: bsb.getGlobalOrc(),
    globalSco: bsb.getGlobalSco(),
    objectNames: collectBsbObjectNames(bsb),
    widgets: collectBsbWidgets(bsb),
    editEnabled: bsb.getGraphicInterface().isEditEnabled(),
    gridSettings: buildGridSettingsSnapshot(bsb),
    widgetTree: buildWidgetTreeSnapshot(bsb),
    presetGroup: buildPresetGroupSnapshot(bsb),
    opcodeListText: bsb.getOpcodeListText(),
    udolist: buildUdoListSnapshot(bsb),
    automationParameters: buildSoundAutomationParameters(bsb),
  };
}

const KNOWN_WIDGET_TYPES = new Set([
  'BSBKnob', 'BSBCheckBox', 'BSBHSlider', 'BSBVSlider',
  'BSBHSliderBank', 'BSBVSliderBank', 'BSBValue', 'BSBDropdown',
  'BSBXYController', 'BSBSubChannelDropdown', 'BSBFileSelector',
  'BSBTextField', 'BSBLabel', 'BSBLineObject', 'BSBGroup',
]);

function bsbColorIntToCss(color: number): string {
  const rgb = (color >>> 0) & 0x00ffffff;
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

function normalizeBsbLineColor(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return bsbColorIntToCss(raw);
  }
  if (typeof raw !== 'string') {
    return '#808080';
  }
  const trimmed = raw.trim();
  if (/^-?\d+$/.test(trimmed)) {
    return bsbColorIntToCss(parseInt(trimmed, 10));
  }
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed;
  }
  return '#808080';
}

function buildWidgetTreeNode(widget: unknown): BsbWidgetNodeSnapshot | null {
  return serializeBsbWidgetSnapshot(widget);
}

function buildWidgetTreeSnapshot(bsb: BlueSynthBuilder): BsbWidgetNodeSnapshot {
  const rootGroup = bsb.getGraphicInterface().getRootGroup();
  const rootChildren = rootGroup.getChildren();

  const children: BsbWidgetNodeSnapshot[] = [];
  for (const child of rootChildren) {
    const node = buildWidgetTreeNode(child);
    if (node) children.push(node);
  }

  return {
    id: rootGroup.id || 'root',
    type: 'BSBRootGroup',
    objectName: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    value: 0,
    minimum: 0,
    maximum: 0,
    editable: true,
    properties: {},
    children,
  };
}

function buildGridSettingsSnapshot(bsb: BlueSynthBuilder): GridSettingsSnapshot {
  const gs = bsb.getGraphicInterface().getGridSettings();
  return {
    enabled: gs.enabled,
    snapEnabled: gs.snapEnabled,
    width: gs.width,
    height: gs.height,
    gridStyle: gs.gridStyle,
  };
}

function buildPresetGroupSnapshot(bsb: BlueSynthBuilder): PresetGroupSnapshot | undefined {
  const pg = bsb.getPresetGroup();
  if (!pg) return undefined;

  const convert = (group: PresetGroup): PresetGroupSnapshot => ({
    name: group.getPresetGroupName(),
    currentPresetUniqueId: group.getCurrentPresetUniqueId() || undefined,
    currentPresetModified: group.isCurrentPresetModified(),
    subGroups: group.getSubGroups().map(convert),
    presets: group.getPresets().map((p) => {
      const valuesMap = p.getValuesMap();
      const values: Record<string, string> = {};
      for (const [k, v] of valuesMap) {
        values[k] = v;
      }
      return {
        uniqueId: p.getUniqueId(),
        name: p.getPresetName(),
        values,
      };
    }),
  });

  return convert(pg);
}

function buildUdoListSnapshot(bsb: BlueSynthBuilder): UdoDefinitionSnapshot[] {
  const udos = bsb.getUdoList();
  return udos.map((udo: OpcodeDefinition) => ({
    name: udo.getName(),
    style: udo.getStyle(),
    outTypes: udo.getOutTypes(),
    inTypes: udo.getInTypes(),
    inputArguments: udo.getInputArguments(),
    code: udo.getCode(),
    comments: udo.getComments(),
  }));
}

export function createProjectUdoListSnapshot(data: BlueData): UdoDefinitionSnapshot[] {
  const opcodes = data.getOpcodeList().getOpcodes();
  return opcodes.map((udo) => udoToSnapshot(udo));
}

export function udoToSnapshot(udo: OpcodeDefinition): UdoDefinitionSnapshot {
  return {
    name: udo.getName(),
    style: udo.getStyle(),
    outTypes: udo.getOutTypes(),
    inTypes: udo.getInTypes(),
    inputArguments: udo.getInputArguments(),
    code: udo.getCode(),
    comments: udo.getComments(),
  };
}

export function createInstrumentSnapshot(
  assignmentId: string,
  instrument: Instrument | undefined,
  enabled = true,
): InstrumentSnapshot {
  if (instrument instanceof GenericInstrument) {
    return {
      assignmentId,
      type: 'generic',
      name: instrument.getName(),
      enabled,
      comment: instrument.getComment(),
      text: instrument.getText(),
      globalOrc: instrument.getGlobalOrc(),
      globalSco: instrument.getGlobalSco(),
      udolist: instrument.getOpcodeList().getOpcodes().map(udoToSnapshot),
    };
  }

  if (instrument instanceof JavaScriptInstrument) {
    return {
      assignmentId,
      type: 'javascript',
      name: instrument.getName(),
      enabled,
      comment: instrument.getComment(),
      text: instrument.getText(),
      globalOrc: instrument.getGlobalOrc(),
      globalSco: instrument.getGlobalSco(),
      udolist: instrument.getOpcodeList().getOpcodes().map(udoToSnapshot),
    };
  }

  if (instrument instanceof PythonInstrument) {
    return {
      assignmentId,
      type: 'python',
      name: instrument.getName(),
      enabled,
      comment: instrument.getComment(),
      text: instrument.getText(),
      globalOrc: instrument.getGlobalOrc(),
      globalSco: instrument.getGlobalSco(),
    };
  }

  if (instrument instanceof BlueX7) {
    return {
      assignmentId,
      type: 'blueX7',
      name: instrument.getName(),
      enabled,
      comment: instrument.getComment(),
    };
  }

  if (instrument instanceof BlueSynthBuilder) {
    return {
      assignmentId,
      type: 'blueSynthBuilder',
      name: instrument.getName(),
      enabled,
      comment: instrument.getComment(),
      instrumentText: instrument.getInstrumentText(),
      alwaysOnInstrumentText: instrument.getAlwaysOnInstrumentText(),
      globalOrc: instrument.getGlobalOrc(),
      globalSco: instrument.getGlobalSco(),
      objectNames: collectBsbObjectNames(instrument),
      widgets: collectBsbWidgets(instrument),
      editEnabled: instrument.getGraphicInterface().isEditEnabled(),
      gridSettings: buildGridSettingsSnapshot(instrument),
      widgetTree: buildWidgetTreeSnapshot(instrument),
      presetGroup: buildPresetGroupSnapshot(instrument),
      opcodeListText: instrument.getOpcodeListText(),
      udolist: buildUdoListSnapshot(instrument),
      automationParameters: buildSoundAutomationParameters(instrument),
    };
  }

  return {
    assignmentId,
    type: 'unknown',
    instrumentType: instrument?.constructor.name ?? 'Unknown',
    name: instrument?.getName() ?? '',
    enabled,
    comment: instrument?.getComment() ?? '',
  };
}

/**
 * Projects the live Track-owned instrument into the standalone editor-window
 * contract. The caller is responsible for fencing the request's session and
 * revision before invoking this helper.
 */
export function createTrackInstrumentEditorSnapshot(
  data: BlueData,
  request: TrackInstrumentEditorRequest,
): TrackInstrumentEditorSnapshot | null {
  for (const group of data.getScore()) {
    if (!(group instanceof TrackLayerGroup) || group.getUniqueId() !== request.track.rootGroupId) {
      continue;
    }

    const track = group.find((candidate) => candidate.getUniqueId() === request.track.trackId);
    const instrument = track?.getInstrument();
    if (!track || !instrument) return null;

    return {
      track: {
        ...request.track,
        trackId: track.getUniqueId(),
      },
      instrument: createInstrumentSnapshot(track.getUniqueId(), instrument, instrument.isEnabled()),
      projectUdos: createProjectUdoListSnapshot(data),
    };
  }

  return null;
}

export function createOrchestraSnapshot(data: BlueData): OrchestraSnapshot {
  const assignments = data.getArrangement().getArrangement();
  const rows: ArrangementRowSnapshot[] = [];
  const instruments: InstrumentSnapshot[] = [];

  for (const assignment of assignments) {
    const instrumentType = getInstrumentSnapshotType(assignment.instr);
    rows.push({
      assignmentId: assignment.arrangementId,
      enabled: assignment.enabled,
      instrumentName: assignment.instr?.getName() ?? '',
      instrumentType,
      instrumentSummary: getInstrumentSummary(assignment.instr),
      editable: Boolean(assignment.instr),
    });
    instruments.push(
      createInstrumentSnapshot(
        assignment.arrangementId,
        assignment.instr,
        assignment.enabled,
      ),
    );
  }

  return {
    ...createEmptyOrchestraSnapshot(true),
    arrangement: { rows },
    instruments,
  };
}

function createInstrumentForType(type: SupportedNewInstrumentType): Instrument {
  switch (type) {
    case 'generic':
      return new GenericInstrument();
    case 'python':
      return new PythonInstrument();
    case 'javascript':
      return new JavaScriptInstrument();
    case 'blueX7':
      return new BlueX7();
    case 'blueSynthBuilder':
      return new BlueSynthBuilder();
  }
}

function createInstrumentFromSnapshot(snapshot: InstrumentSnapshot): Instrument {
  const instrument =
    snapshot.type === 'javascript'
      ? new JavaScriptInstrument()
      : snapshot.type === 'python'
        ? new PythonInstrument()
      : snapshot.type === 'blueX7'
        ? new BlueX7()
        : snapshot.type === 'blueSynthBuilder'
          ? new BlueSynthBuilder()
          : new GenericInstrument();

  applyInstrumentPatch(instrument, {
    name: snapshot.name,
    comment: snapshot.comment,
    enabled: snapshot.enabled,
  });

  if (
    snapshot.type === 'generic' ||
    snapshot.type === 'javascript' ||
    snapshot.type === 'python'
  ) {
    applyInstrumentPatch(instrument, {
      text: snapshot.text,
      globalOrc: snapshot.globalOrc,
      globalSco: snapshot.globalSco,
    });

    if (instrument instanceof GenericInstrument || instrument instanceof JavaScriptInstrument) {
      const opcodeList = instrument.getOpcodeList();
      opcodeList.clear();
      const definitions = snapshot.type === 'generic' || snapshot.type === 'javascript'
        ? snapshot.udolist
        : [];
      for (const definition of definitions) {
        opcodeList.addOpcode(snapshotToUdo(definition));
      }
    }
  } else if (snapshot.type === 'blueSynthBuilder') {
    applyInstrumentPatch(instrument, {
      instrumentText: snapshot.instrumentText,
      alwaysOnInstrumentText: snapshot.alwaysOnInstrumentText,
      globalOrc: snapshot.globalOrc,
      globalSco: snapshot.globalSco,
    });

    const bsb = instrument as BlueSynthBuilder;
    const graphicInterface = bsb.getGraphicInterface();
    const rootGroup = graphicInterface.getRootGroup();
    rootGroup.clearChildren();
    for (const childSnapshot of snapshot.widgetTree.children ?? []) {
      const widget = createWidgetFromSnapshot(graphicInterface, childSnapshot);
      if (widget) rootGroup.addChild(widget);
    }
    bsb.setGraphicInterface(graphicInterface);
    bsb.setBsbEditEnabled(snapshot.editEnabled);
    bsb.setBsbGridSettings(snapshot.gridSettings);
    bsb.setPresetGroup(createPresetGroupFromSnapshot(snapshot.presetGroup));

    if (snapshot.udolist !== undefined) {
      bsb.setOpcodeList(createOpcodeListFromSnapshots(snapshot.udolist));
    } else if (snapshot.opcodeListText !== undefined) {
      bsb.setOpcodeListText(snapshot.opcodeListText);
    }

    restoreBsbAutomationParameters(bsb, snapshot.automationParameters);
  }

  return instrument;
}

function createOpcodeListFromSnapshots(snapshots: UdoDefinitionSnapshot[]): OpcodeList {
  const opcodeList = new OpcodeList();
  for (const snapshot of snapshots) {
    opcodeList.addOpcode(snapshotToUdo(snapshot));
  }
  return opcodeList;
}

function createPresetGroupFromSnapshot(snapshot?: PresetGroupSnapshot): PresetGroup | null {
  if (!snapshot) return null;

  const presetIdMap = new Map<string, string>();
  const createGroup = (groupSnapshot: PresetGroupSnapshot): PresetGroup => {
    const group = new PresetGroup();
    group.setPresetGroupName(groupSnapshot.name);
    group.setCurrentPresetModified(groupSnapshot.currentPresetModified);

    for (const presetSnapshot of groupSnapshot.presets) {
      const preset = new Preset();
      preset.setPresetName(presetSnapshot.name);
      preset.setValuesMap(new Map(Object.entries(presetSnapshot.values ?? {})));
      presetIdMap.set(presetSnapshot.uniqueId, preset.getUniqueId());
      group.presets.push(preset);
    }

    for (const childSnapshot of groupSnapshot.subGroups) {
      group.subGroups.push(createGroup(childSnapshot));
    }

    if (groupSnapshot.currentPresetUniqueId) {
      group.setCurrentPresetUniqueId(
        presetIdMap.get(groupSnapshot.currentPresetUniqueId) ?? '',
      );
    }
    return group;
  };

  return createGroup(snapshot);
}

function restoreBsbAutomationParameters(
  bsb: BlueSynthBuilder,
  snapshots?: SoundAutomationParameterSnapshot[],
): void {
  if (!snapshots) return;

  const snapshotByName = new Map(snapshots.map((snapshot) => [snapshot.name, snapshot]));
  for (const parameter of bsb.getParameters()) {
    const snapshot = snapshotByName.get(parameter.getName());
    if (!snapshot) continue;

    parameter.setLabel(snapshot.label);
    parameter.setMinimum(snapshot.minimum, true);
    parameter.setMaximum(snapshot.maximum, true);
    if (snapshot.resolution !== undefined) parameter.setResolution(snapshot.resolution);
    parameter.setFixedValue(snapshot.value);
    parameter.setPoints(snapshot.points.map((point) => ({ time: point.x, value: point.y })));
    const curve = snapshot.curve as keyof typeof BlueDataAutomationCurve;
    if (curve in BlueDataAutomationCurve) {
      parameter.setCurve(BlueDataAutomationCurve[curve]);
    }
    parameter.setAutomationEnabled(snapshot.automationEnabled);
  }
}

function applyEmbeddedOpcodeListPatch(opcodeList: OpcodeList, patch: EmbeddedOpcodeListPatch): boolean {
  switch (patch.type) {
    case 'addUdo': {
      const definition = patch.definition
        ? snapshotToUdo(patch.definition)
        : new OpcodeDefinition();
      const index = patch.index ?? opcodeList.size();
      opcodeList.addOpcodeAt(index, definition);
      return true;
    }
    case 'removeUdo':
      return opcodeList.removeOpcodeAt(patch.index);
    case 'updateUdo': {
      const existing = opcodeList.getOpcode(patch.index);
      if (!existing) return false;
      if (patch.patch.name !== undefined) existing.setName(patch.patch.name);
      if (patch.patch.outTypes !== undefined) existing.setOutTypes(patch.patch.outTypes);
      if (patch.patch.inTypes !== undefined) existing.setInTypes(patch.patch.inTypes);
      if (patch.patch.inputArguments !== undefined) existing.setInputArguments(patch.patch.inputArguments);
      if (patch.patch.code !== undefined) existing.setCode(patch.patch.code);
      if (patch.patch.comments !== undefined) existing.setComments(patch.patch.comments);
      if (patch.patch.style !== undefined) {
        existing.setStyle(UDOStyle[patch.patch.style as keyof typeof UDOStyle]);
      }
      return true;
    }
    case 'convertUdoStyle': {
      const udo = opcodeList.getOpcode(patch.index);
      if (!udo) return false;
      udo.setStyle(UDOStyle[patch.style as keyof typeof UDOStyle]);
      return true;
    }
    case 'reorderUdo': {
      const udo = opcodeList.getOpcode(patch.from);
      if (!udo) return false;
      opcodeList.removeOpcodeAt(patch.from);
      opcodeList.addOpcodeAt(patch.to, udo);
      return true;
    }
  }
}

function applyBsbInterfacePatch(instrument: BlueSynthBuilder, patch: BsbInterfacePatch): boolean {
  switch (patch.type) {
    case 'setEditEnabled':
      instrument.setBsbEditEnabled(patch.value);
      return true;
    case 'selectWidget':
      return false;
    case 'updateWidgetProperties':
      return instrument.updateWidgetProperties(patch.widgetId, patch.properties);
    case 'updateSliderBankValue':
      return instrument.updateSliderBankValue(patch.widgetId, patch.sliderIndex, patch.value);
    case 'moveWidget':
      return instrument.updateWidgetProperties(patch.widgetId, {
        x: patch.x,
        y: patch.y,
      });
    case 'resizeWidget':
      return instrument.updateWidgetProperties(patch.widgetId, {
        width: patch.width,
        height: patch.height,
      });
    case 'addWidget': {
      const gi = instrument.getGraphicInterface();
      const widget = gi.createWidgetByType(patch.widgetType);
      if (!widget) return false;
      widget.x = patch.x;
      widget.y = patch.y;
      if (patch.parentGroupId) {
        const parent = gi.findWidgetById(patch.parentGroupId);
        if (parent && parent instanceof BSBGroup) {
          parent.addChild(widget);
        } else {
          gi.getRootGroup().addChild(widget);
        }
      } else {
        gi.getRootGroup().addChild(widget);
      }
      instrument.invalidateGraphicInterfaceCache();
      return true;
    }
    case 'removeWidget': {
      const gi2 = instrument.getGraphicInterface();
      const removed = gi2.removeWidget(patch.widgetId);
      if (removed) instrument.invalidateGraphicInterfaceCache();
      return removed;
    }
    case 'updateGridSettings':
      instrument.setBsbGridSettings(patch.patch);
      return true;
    case 'applyPreset': {
      return instrument.applyPreset(patch.presetUniqueId);
    }
    case 'updatePreset': {
      const presetGroup = instrument.getPresetGroup();
      if (!presetGroup) return false;
      const preset = presetGroup.findPresetByUniqueId(patch.presetUniqueId);
      if (!preset) return false;
      preset.updatePresets(instrument.getGraphicInterface());
      presetGroup.setCurrentPresetModified(false);
      return true;
    }
    case 'addPreset': {
      const presetGroup = instrument.getPresetGroup();
      if (!presetGroup) return false;
      const preset = new Preset();
      preset.updatePresets(instrument.getGraphicInterface());
      preset.setPresetName(patch.presetName);
      preset['uniqueId'] = crypto.randomUUID();
      presetGroup.getPresets().push(preset);
      presetGroup.getPresets().sort((a, b) => a.getPresetName().localeCompare(b.getPresetName()));
      presetGroup.setCurrentPresetUniqueId(preset.getUniqueId());
      presetGroup.setCurrentPresetModified(false);
      return true;
    }
    case 'addPresetGroup': {
      const presetGroup = instrument.getPresetGroup();
      if (!presetGroup) return false;
      const newFolder = new PresetGroup();
      newFolder.setPresetGroupName(patch.groupName);
      presetGroup.getSubGroups().push(newFolder);
      presetGroup.getSubGroups().sort((a, b) => a.getPresetGroupName().localeCompare(b.getPresetGroupName()));
      return true;
    }
    case 'synchronizePresets': {
      const presetGroup = instrument.getPresetGroup();
      if (!presetGroup) return false;
      // TODO: Implement synchronizePresets functionality
      return false;
    }
    case 'updateEmbeddedOpcodeList':
      instrument.setOpcodeListText(patch.opcodeList);
      return true;
    case 'addUdo': {
      if (!patch.definition) {
        return instrument.addUdo(patch.index, undefined);
      }
      const definition = new OpcodeDefinition();
      definition.setName(patch.definition.name);
      definition.setStyle(UDOStyle[patch.definition.style as keyof typeof UDOStyle]);
      definition.setOutTypes(patch.definition.outTypes);
      definition.setInTypes(patch.definition.inTypes);
      definition.setInputArguments(patch.definition.inputArguments);
      definition.setCode(patch.definition.code);
      definition.setComments(patch.definition.comments);
      return instrument.addUdo(patch.index, definition);
    }
    case 'removeUdo':
      return instrument.removeUdo(patch.index);
    case 'updateUdo': {
      const convertedPatch: Record<string, unknown> = { ...patch.patch };
      if (patch.patch.style !== undefined) {
        convertedPatch.style = UDOStyle[patch.patch.style as keyof typeof UDOStyle];
      }
      return instrument.updateUdo(patch.index, convertedPatch as Parameters<typeof instrument.updateUdo>[1]);
    }
    case 'convertUdoStyle':
      return instrument.convertUdoStyle(
        patch.index,
        UDOStyle[patch.style as keyof typeof UDOStyle],
      );
    case 'reorderUdo':
      return instrument.reorderUdo(patch.from, patch.to);
    case 'randomize':
      instrument.getGraphicInterface().getRootGroup().randomize();
      instrument.invalidateGraphicInterfaceCache();
      return true;
    case 'makeGroup': {
      const gi = instrument.getGraphicInterface();
      const widgetsToGroup: BSBWidget[] = [];
      const collect = (parent: BSBGroup): void => {
        for (const child of parent.getChildren()) {
          if (patch.widgetIds.includes(child.id)) {
            widgetsToGroup.push(child);
            parent.removeChildById(child.id);
          } else if (child instanceof BSBGroup) {
            collect(child as BSBGroup);
          }
        }
      };
      collect(gi.getRootGroup());
      if (widgetsToGroup.length === 0) return false;

      let minX = Infinity, minY = Infinity;
      for (const w of widgetsToGroup) {
        minX = Math.min(minX, w.x);
        minY = Math.min(minY, w.y);
      }

      const group = new BSBGroup();
      group.id = crypto.randomUUID();
      group.x = minX;
      group.y = minY;
      group.groupName = 'Group';

      for (const w of widgetsToGroup) {
        w.x = w.x - minX + 10;
        w.y = w.y - minY + 10;
        group.addChild(w);
      }

      const targetParent = patch.parentGroupId
        ? gi.findWidgetById(patch.parentGroupId)
        : null;
      if (targetParent instanceof BSBGroup) {
        targetParent.addChild(group);
      } else {
        gi.getRootGroup().addChild(group);
      }
      instrument.invalidateGraphicInterfaceCache();
      return true;
    }
    case 'breakGroup': {
      const gi = instrument.getGraphicInterface();
      const group = gi.findWidgetById(patch.widgetId);
      if (!(group instanceof BSBGroup)) return false;

      const findParent = (parent: BSBGroup, targetId: string): BSBGroup | null => {
        for (const child of parent.getChildren()) {
          if (child.id === targetId) return parent;
          if (child instanceof BSBGroup) {
            const found = findParent(child, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      const parentGroup = findParent(gi.getRootGroup(), patch.widgetId) ?? gi.getRootGroup();
      const gx = group.x;
      const gy = group.y;
      const children = group.getChildren();
      for (const child of children) {
        child.x += gx;
        child.y += gy;
        parentGroup.addChild(child);
      }
      group.clearChildren();
      gi.removeWidget(patch.widgetId);
      instrument.invalidateGraphicInterfaceCache();
      return true;
    }
    case 'pasteWidgets': {
      const gi = instrument.getGraphicInterface();
      let parsed: BsbWidgetNodeSnapshot[];
      try {
        parsed = JSON.parse(patch.widgetData);
      } catch { return false; }
      if (!Array.isArray(parsed) || parsed.length === 0) return false;

      const existingNames = new Set<string>();
      const collectNames = (group: BSBGroup): void => {
        for (const child of group.getChildren()) {
          if (child.objectName) {
            existingNames.add(child.objectName);
            for (const dk of getDerivedKeys(child)) existingNames.add(dk);
          }
          if (child instanceof BSBGroup) collectNames(child);
        }
      };
      collectNames(gi.getRootGroup());

      const targetParent = patch.parentGroupId
        ? gi.findWidgetById(patch.parentGroupId)
        : null;
      const parent = targetParent instanceof BSBGroup ? targetParent : gi.getRootGroup();

      for (const node of parsed) {
        ensureUniqueName(node, existingNames);
        const widget = createWidgetFromSnapshot(gi, node);
        if (widget) parent.addChild(widget);
      }
      instrument.invalidateGraphicInterfaceCache();
      return true;
    }
  }
}

function createWidgetFromSnapshot(gi: any, node: BsbWidgetNodeSnapshot): BSBWidget | null {
  const bsbGi = gi as { createWidgetByType(t: string): BSBWidget | null };
  const widget = bsbGi.createWidgetByType(node.type);
  if (!widget) return null;

  const widgetRecord = widget as unknown as Record<string, unknown>;
  widgetRecord.objectName = node.objectName || '';
  widgetRecord.x = node.x;
  widgetRecord.y = node.y;
  widgetRecord.value = node.value;
  widgetRecord.minimum = node.minimum;
  widgetRecord.maximum = node.maximum;

  const applyFontPatch = (prefix: 'font' | 'labelFont', key: string, val: unknown): void => {
    const existing = widgetRecord[prefix];
    const nextFont: Record<string, unknown> = existing && typeof existing === 'object'
      ? cloneBsbSnapshotValue(existing as Record<string, unknown>)
      : {};
    const field = key.substring(prefix.length + 1);
    if (!field) return;
    nextFont[field] = cloneBsbSnapshotValue(val);
    widgetRecord[prefix] = nextFont;
  };

  const dropdownItems = Array.isArray(node.properties?.dropdownItems)
    ? node.properties!.dropdownItems as Array<Record<string, unknown>>
    : null;
  const lines = Array.isArray(node.properties?.lines)
    ? node.properties!.lines as Array<Record<string, unknown>>
    : null;
  const sliders = Array.isArray(node.properties?.sliders)
    ? node.properties!.sliders as Array<Record<string, unknown>>
    : null;

  for (const [key, val] of Object.entries(node.properties ?? {})) {
    if (key === 'dropdownItems' && dropdownItems) {
      widgetRecord.dropdownItems = dropdownItems.map((item) => ({
        name: typeof item.name === 'string' ? item.name : '',
        value: typeof item.value === 'string' ? item.value : '',
        uniqueId: typeof item.uniqueId === 'string' && item.uniqueId.length > 0
          ? item.uniqueId
          : crypto.randomUUID(),
      }));
      continue;
    }

    if (key === 'lines' && lines) {
      widgetRecord.lines = cloneBsbSnapshotValue(lines);
      continue;
    }

    if (key === 'sliders' && sliders) {
      continue;
    }

    if (key.startsWith('font.')) {
      applyFontPatch('font', key, val);
      continue;
    }

    if (key.startsWith('labelFont.')) {
      applyFontPatch('labelFont', key, val);
      continue;
    }

    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) {
      widgetRecord[key] = val;
      continue;
    }

    widgetRecord[key] = cloneBsbSnapshotValue(val);
  }

  if (widget instanceof BSBGroup) {
    widget.width = node.width;
    widget.height = node.height;
    if (node.children) {
      for (const childNode of node.children) {
        const child = createWidgetFromSnapshot(gi, childNode);
        if (child) widget.addChild(child);
      }
    }
    return widget;
  }

  if (widget.constructor.name === 'BSBHSliderBank' || widget.constructor.name === 'BSBVSliderBank') {
    const widgetAny = widget as unknown as Record<string, unknown> & { numberOfSliders?: number };
    const childType = widget.constructor.name === 'BSBHSliderBank' ? 'BSBHSlider' : 'BSBVSlider';
    const nextSliders: BSBWidget[] = [];

    if (node.children && node.children.length > 0) {
      for (const childNode of node.children) {
        const child = createWidgetFromSnapshot(gi, childNode);
        if (child) nextSliders.push(child);
      }
    }

    if (nextSliders.length === 0 && sliders) {
      for (const sliderSnapshot of sliders) {
        const slider = bsbGi.createWidgetByType(childType);
        if (!slider) continue;
        if (typeof sliderSnapshot.value === 'number') {
          slider.setValue(sliderSnapshot.value);
        }
        nextSliders.push(slider);
      }
    }

    if (nextSliders.length > 0) {
      widgetAny.sliders = nextSliders;
    }

    if (typeof widgetAny.numberOfSliders === 'number' && nextSliders.length > 0) {
      widgetAny.numberOfSliders = nextSliders.length;
    }
    return widget;
  }

  if (widget.constructor.name === 'BSBLineObject') {
    widgetRecord.canvasWidth = node.properties?.canvasWidth ?? node.width;
    widgetRecord.canvasHeight = node.properties?.canvasHeight ?? Math.max(40, node.height - BSB_LINE_SELECTOR_HEIGHT);
    if (lines) {
      widgetRecord.lines = cloneBsbSnapshotValue(lines);
    }
    return widget;
  }

  if (widget.constructor.name === 'BSBXYController' || widget.constructor.name === 'BSBGroup') {
    widgetRecord.width = node.width;
    widgetRecord.height = node.height;
  }

  return widget;
}

export function ensureUniqueName(node: BsbWidgetNodeSnapshot, existingNames: Set<string>): void {
  const name = node.objectName;
  if (name && hasCollision(name, node, existingNames)) {
    const prefix = name.replace(/\d+$/, '');
    let i = 1;
    let candidate: string;
    do {
      candidate = `${prefix}${i++}`;
    } while (hasCollision(candidate, node, existingNames));
    node.objectName = candidate;
    existingNames.add(candidate);
    for (const dk of getDerivedKeysForSnapshot(node)) existingNames.add(dk);
  } else if (name) {
    existingNames.add(name);
    for (const dk of getDerivedKeysForSnapshot(node)) existingNames.add(dk);
  }
  if (node.children) {
    for (const child of node.children) ensureUniqueName(child, existingNames);
  }
}

function hasCollision(candidate: string, node: BsbWidgetNodeSnapshot, existingNames: Set<string>): boolean {
  if (existingNames.has(candidate)) return true;
  const origName = node.objectName;
  node.objectName = candidate;
  const derived = getDerivedKeysForSnapshot(node);
  node.objectName = origName;
  for (const dk of derived) {
    if (existingNames.has(dk)) return true;
  }
  return false;
}

function getDerivedKeysForSnapshot(node: BsbWidgetNodeSnapshot): string[] {
  return getDerivedKeysFromSnapshot(node);
}

function getDerivedKeys(widget: BSBWidget): string[] {
  return getDerivedKeysFromWidget(widget);
}

function applyInstrumentPatch(instrument: Instrument, patch: InstrumentPatch): boolean {
  let changed = false;
  if (patch.name !== undefined && instrument.getName() !== patch.name) {
    instrument.setName(patch.name);
    changed = true;
  }
  if (patch.enabled !== undefined && instrument.isEnabled() !== patch.enabled) {
    instrument.setEnabled(patch.enabled);
    changed = true;
  }
  if (patch.comment !== undefined && instrument.getComment() !== patch.comment) {
    instrument.setComment(patch.comment);
    changed = true;
  }

  if (instrument instanceof GenericInstrument) {
    if (patch.text !== undefined && instrument.getText() !== patch.text) {
      instrument.setText(patch.text);
      changed = true;
    }
    if (patch.globalOrc !== undefined && instrument.getGlobalOrc() !== patch.globalOrc) {
      instrument.setGlobalOrc(patch.globalOrc);
      changed = true;
    }
    if (patch.globalSco !== undefined && instrument.getGlobalSco() !== patch.globalSco) {
      instrument.setGlobalSco(patch.globalSco);
      changed = true;
    }
    if (patch.embeddedOpcodeList) {
      changed = applyEmbeddedOpcodeListPatch(instrument.getOpcodeList(), patch.embeddedOpcodeList) || changed;
    }
  } else if (instrument instanceof JavaScriptInstrument || instrument instanceof PythonInstrument) {
    if (patch.text !== undefined && instrument.getText() !== patch.text) {
      instrument.setText(patch.text);
      changed = true;
    }
    if (patch.globalOrc !== undefined && instrument.getGlobalOrc() !== patch.globalOrc) {
      instrument.setGlobalOrc(patch.globalOrc);
      changed = true;
    }
    if (patch.globalSco !== undefined && instrument.getGlobalSco() !== patch.globalSco) {
      instrument.setGlobalSco(patch.globalSco);
      changed = true;
    }
    if (patch.embeddedOpcodeList) {
      changed = applyEmbeddedOpcodeListPatch(instrument.getOpcodeList(), patch.embeddedOpcodeList) || changed;
    }
  } else if (instrument instanceof BlueSynthBuilder) {
    if (
      patch.instrumentText !== undefined &&
      instrument.getInstrumentText() !== patch.instrumentText
    ) {
      instrument.setInstrumentText(patch.instrumentText);
      changed = true;
    }
    if (
      patch.alwaysOnInstrumentText !== undefined &&
      instrument.getAlwaysOnInstrumentText() !== patch.alwaysOnInstrumentText
    ) {
      instrument.setAlwaysOnInstrumentText(patch.alwaysOnInstrumentText);
      changed = true;
    }
    if (patch.globalOrc !== undefined && instrument.getGlobalOrc() !== patch.globalOrc) {
      instrument.setGlobalOrc(patch.globalOrc);
      changed = true;
    }
    if (patch.globalSco !== undefined && instrument.getGlobalSco() !== patch.globalSco) {
      instrument.setGlobalSco(patch.globalSco);
      changed = true;
    }
    if (patch.bsbWidgetValues) {
      for (const [objectName, value] of Object.entries(patch.bsbWidgetValues)) {
        changed = instrument.updateWidgetValue(objectName, value) || changed;
      }
    }
    if (patch.bsbOpcodeListText !== undefined && instrument.getOpcodeListText() !== patch.bsbOpcodeListText) {
      instrument.setOpcodeListText(patch.bsbOpcodeListText);
      changed = true;
    }
    if (patch.bsbInterface) {
      changed = applyBsbInterfacePatch(instrument, patch.bsbInterface) || changed;
    }
  }

  return changed;
}

function convertGenericToBsb(instrument: GenericInstrument): BlueSynthBuilder {
  const bsb = new BlueSynthBuilder();
  bsb.setName(instrument.getName());
  bsb.setComment(instrument.getComment());
  bsb.setGlobalOrc(instrument.getGlobalOrc());
  bsb.setGlobalSco(instrument.getGlobalSco());
  bsb.setInstrumentText(instrument.getText());
  bsb.setOpcodeList(instrument.getOpcodeList());
  return bsb;
}

export function applyProjectPropertiesPatch(
  properties: ProjectProperties,
  patch: Partial<ProjectPropertiesSnapshot>,
): boolean {
  let changed = false;
  const propertyRecord = properties as unknown as Record<string, unknown>;

  const entries = Object.entries(patch) as Array<
    [keyof ProjectPropertiesSnapshot, ProjectPropertiesSnapshot[keyof ProjectPropertiesSnapshot]]
  >;

  for (const [key, value] of entries) {
    switch (key) {
      case 'title':
      case 'author':
      case 'notes':
      case 'sampleRate':
      case 'ksmps':
      case 'nchnls':
      case 'useZeroDbFS':
      case 'zeroDbFS':
      case 'diskSampleRate':
      case 'diskKsmps':
      case 'diskChannels':
      case 'diskUseZeroDbFS':
      case 'diskZeroDbFS':
      case 'useAudioOut':
      case 'useAudioIn':
      case 'useMidiIn':
      case 'useMidiOut':
      case 'noteAmpsEnabled':
      case 'outOfRangeEnabled':
      case 'warningsEnabled':
      case 'benchmarkEnabled':
      case 'advancedSettings':
      case 'completeOverride':
      case 'fileName':
      case 'askOnRender':
      case 'diskNoteAmpsEnabled':
      case 'diskOutOfRangeEnabled':
      case 'diskWarningsEnabled':
      case 'diskBenchmarkEnabled':
      case 'diskAdvancedSettings':
      case 'diskCompleteOverride':
      case 'diskAlwaysRenderEntireProject':
      case 'mediaFolder':
      case 'copyToMediaFileOnImport':
        if (propertyRecord[key] !== value) {
          propertyRecord[key] = value;
          changed = true;
        }
        break;
      default:
        break;
    }
  }

  return changed;
}

function areClojureProjectSnapshotsEqual(
  left: ClojureProjectSnapshot,
  right: ClojureProjectSnapshot,
): boolean {
  if (left.libraryEntries.length !== right.libraryEntries.length) {
    return false;
  }

  return left.libraryEntries.every((entry, index) => {
    const other = right.libraryEntries[index];
    return (
      entry.dependencyCoordinates === other?.dependencyCoordinates &&
      entry.version === other?.version
    );
  });
}

export function applyClojureProjectPatch(
  data: BlueData,
  patch: ClojureProjectSnapshot,
): boolean {
  const currentSnapshot = createClojureProjectSnapshot(data.getClojureProjectData());
  if (areClojureProjectSnapshotsEqual(currentSnapshot, patch)) {
    return false;
  }

  const nextProjectData = new ClojureProjectData();
  nextProjectData.setLibraryEntries(
    patch.libraryEntries.map((entrySnapshot) => {
      const entry = new ClojureLibraryEntry();
      entry.setDependencyCoordinates(entrySnapshot.dependencyCoordinates);
      entry.setVersion(entrySnapshot.version);
      return entry;
    }),
  );
  data.setClojureProjectData(nextProjectData);
  return true;
}

export function createBlueLiveProjectSnapshot(
  liveData: LiveData,
  context: TimeContext = new TimeContext(),
): BlueLiveProjectSnapshot {
  const bins = liveData.getLiveObjectBins();
  const cells: Array<Array<LiveObjectCellSnapshot | null>> = [];
  for (let c = 0; c < bins.getColumnCount(); c++) {
    const col: Array<LiveObjectCellSnapshot | null> = [];
    for (let r = 0; r < bins.getRowCount(); r++) {
      const obj = bins.getLiveObject(c, r);
      if (obj) {
        const soundObject = obj.getSoundObject();
        col.push({
          uniqueId: obj.getUniqueId(),
          enabled: obj.isEnabled(),
          keyTrigger: obj.getKeyTrigger(),
          midiTrigger: obj.getMidiTrigger(),
          displayName: obj.getDisplayName(),
          soundObjectType: obj.getSoundObjectType(),
          hasSoundObject: obj.hasSoundObject,
          serializedXml: soundObject?.saveAsXML().toXml(),
          startBeats: soundObject?.getStartTime().toBeats(context),
          durationBeats: soundObject?.getSubjectiveDuration().toBeats(context),
          startTimeBase: soundObject ? String(soundObject.getStartTime().getTimeBase()) : undefined,
          durationTimeBase: soundObject ? String(soundObject.getSubjectiveDuration().getTimeBase()) : undefined,
          backgroundColor: soundObject?.getBackgroundColor(),
        });
      } else {
        col.push(null);
      }
    }
    cells.push(col);
  }

  return {
    commandLine: liveData.getCommandLine(),
    commandLineEnabled: liveData.isCommandLineEnabled(),
    commandLineOverride: liveData.isCommandLineOverride(),
    tempo: liveData.getTempo(),
    repeat: liveData.getRepeat(),
    repeatEnabled: liveData.isRepeatEnabled(),
    liveCodeText: liveData.getLiveCodeText(),
    bins: { columns: bins.getColumnCount(), rows: bins.getRowCount(), cells },
    sets: liveData.getLiveObjectSets().getSets().map((set) => ({
      name: set.getName(),
      liveObjectIds: set.getLiveObjectIds(),
    })),
  };
}

export function createMidiScaleSnapshot(scale: Scale | null): MidiScaleSnapshot | null {
  if (!scale) {
    return null;
  }

  return {
    scaleName: scale.scaleName,
    baseFrequency: scale.baseFrequency,
    octave: scale.octave,
    ratios: Array.isArray(scale.ratios) ? [...scale.ratios] : [],
  };
}

export function createTrackerColumnSnapshot(
  column: Column,
  sourceIndex: number | null = null,
): TrackerColumnSnapshot {
  return {
    name: column.getName(),
    type: column.getType(),
    restrictedToInteger: column.isRestrictedToInteger(),
    usingRange: column.isUsingRange(),
    rangeMin: column.getRangeMin(),
    rangeMax: column.getRangeMax(),
    outputFrequency: column.isOutputFrequency(),
    scale: createMidiScaleSnapshot(column.getScale()),
    sourceIndex,
  };
}

export function createMidiInputProcessorSnapshot(
  processor: { getKeyMapping(): string; getVelocityMapping(): string; getPitchConstant(): string; getAmpConstant(): string; getScale(): Scale | null },
): MidiInputProcessorSnapshot {
  return {
    keyMapping: processor.getKeyMapping(),
    velocityMapping: processor.getVelocityMapping(),
    pitchConstant: processor.getPitchConstant(),
    ampConstant: processor.getAmpConstant(),
    scale: createMidiScaleSnapshot(processor.getScale()),
  };
}

function createScaleFromSnapshot(snapshot: MidiScaleSnapshot | null): Scale | null {
  if (!snapshot) {
    return null;
  }

  const scale = new Scale();
  scale.scaleName = snapshot.scaleName;
  scale.baseFrequency = snapshot.baseFrequency;
  scale.octave = snapshot.octave;
  scale.ratios = snapshot.ratios.length > 0 ? [...snapshot.ratios] : [...scale.ratios];
  return scale;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function snapshotJMaskValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => snapshotJMaskValue(entry));
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value;
  }
  if (valueType !== 'object') {
    return value;
  }

  const snapshot: Record<string, unknown> = {};
  const ctorName = (value as { constructor?: { name?: string } }).constructor?.name;
  if (ctorName && ctorName !== 'Object') {
    snapshot.kind = ctorName;
  }

  for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof childValue === 'function') {
      continue;
    }
    snapshot[key] = snapshotJMaskValue(childValue);
  }

  return snapshot;
}

export function createJMaskEditorPayload(jmask: JMask): JMaskEditorPayload {
  return {
    seedUsed: jmask.isSeedUsed(),
    seed: jmask.getSeed(),
    field: snapshotJMaskValue(jmask.getField()) as Record<string, unknown>,
  };
}

export function createJMaskPayloadSummary(payload: JMaskEditorPayload): string {
  const parameterCount = Array.isArray(payload.field.parameters) ? payload.field.parameters.length : 0;
  return payload.seedUsed ? `seed: ${payload.seed}; ${parameterCount} params` : `random; ${parameterCount} params`;
}

function mergeJMaskSnapshotValue(baseValue: unknown, patchValue: unknown): unknown {
  if (patchValue === undefined) {
    return snapshotJMaskValue(baseValue);
  }

  if (patchValue === null || typeof patchValue !== 'object') {
    return snapshotJMaskValue(patchValue);
  }

  if (Array.isArray(patchValue)) {
    return patchValue.map((entry) => snapshotJMaskValue(entry));
  }

  const merged: Record<string, unknown> = isPlainObject(baseValue)
    ? { ...baseValue }
    : {};

  for (const [key, value] of Object.entries(merged)) {
    merged[key] = snapshotJMaskValue(value);
  }

  for (const [key, value] of Object.entries(patchValue as Record<string, unknown>)) {
    if (value === undefined) {
      continue;
    }
    merged[key] = mergeJMaskSnapshotValue(merged[key], value);
  }

  return merged;
}

export function applyJMaskPatchToPayload(payload: JMaskEditorPayload, patch: Record<string, unknown>): JMaskEditorPayload {
  const nextPayload: JMaskEditorPayload = {
    ...payload,
    field: { ...payload.field },
  };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }

    if (key === 'seedUsed' || key === 'seed') {
      nextPayload[key] = value as never;
      continue;
    }

    if (key === 'field') {
      nextPayload.field = mergeJMaskSnapshotValue(payload.field, value) as Record<string, unknown>;
      continue;
    }

    nextPayload[key] = mergeJMaskSnapshotValue((payload as Record<string, unknown>)[key], value) as never;
  }

  return nextPayload;
}

function createPianoRollFieldDefSnapshot(fieldDef: FieldDef): {
  fieldName: string;
  fieldType: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
} {
  return {
    fieldName: fieldDef.getFieldName(),
    fieldType: fieldDef.getFieldType(),
    minValue: fieldDef.getMinValue(),
    maxValue: fieldDef.getMaxValue(),
    defaultValue: fieldDef.getDefaultValue(),
  };
}

function createPianoRollFieldDefFromSnapshot(snapshot: {
  fieldName: string;
  fieldType: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
}): FieldDef {
  const fieldDef = new FieldDef();
  fieldDef.setFieldName(snapshot.fieldName);
  fieldDef.setFieldType(snapshot.fieldType as Parameters<FieldDef['setFieldType']>[0]);
  fieldDef.setMinValue(snapshot.minValue);
  fieldDef.setMaxValue(snapshot.maxValue);
  fieldDef.setDefaultValue(snapshot.defaultValue);
  return fieldDef;
}

function getPianoRollFieldDefinitionsSnapshot(pr: PianoRoll): Array<{
  fieldName: string;
  fieldType: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
}> {
  return pr.getFieldDefinitions().map(createPianoRollFieldDefSnapshot);
}

function applyPianoRollFieldDefinitions(
  pr: PianoRoll,
  fieldDefinitions: Array<{
    fieldName: string;
    fieldType: string;
    minValue: number;
    maxValue: number;
    defaultValue: number;
  }>,
): void {
  const nextFieldDefinitions = fieldDefinitions.map(createPianoRollFieldDefFromSnapshot);
  pr.setFieldDefinitions(nextFieldDefinitions);
}

function createTrackerColumnFromSnapshot(snapshot: TrackerColumnSnapshot): Column {
  const column = new Column();
  column.setName(snapshot.name);
  column.setType(snapshot.type);
  column.setRestrictedToInteger(Boolean(snapshot.restrictedToInteger));
  column.setUsingRange(Boolean(snapshot.usingRange));

  const rangeMin = Number(snapshot.rangeMin);
  const rangeMax = Number(snapshot.rangeMax);
  if (Number.isFinite(rangeMin)) {
    column.setRangeMin(rangeMin);
  }
  if (Number.isFinite(rangeMax)) {
    column.setRangeMax(rangeMax);
  }

  const scale = createScaleFromSnapshot(snapshot.scale ?? null);
  if (scale) {
    column.setScale(scale);
  }
  column.setOutputFrequency(Boolean(snapshot.outputFrequency));
  return column;
}

function applyMidiInputPatch(
  data: BlueData,
  patch: MidiInputPatch,
): boolean {
  const midiInput = data.getMidiInputProcessor();

  switch (patch.type) {
    case 'updateKeyMapping':
      midiInput.setKeyMapping(patch.value);
      return true;
    case 'updateVelocityMapping':
      midiInput.setVelocityMapping(patch.value);
      return true;
    case 'updatePitchConstant':
      midiInput.setPitchConstant(patch.value);
      return true;
    case 'updateAmpConstant':
      midiInput.setAmpConstant(patch.value);
      return true;
    case 'updateScale':
      midiInput.setScale(createScaleFromSnapshot(patch.scale));
      return true;
  }
}

function applyBlueLivePatch(data: BlueData, patch: BlueLivePatch): boolean {
  const liveData = data.getLiveData();
  switch (patch.type) {
    case 'updateOptions': {
      let changed = false;
      if (patch.patch.commandLine !== undefined && liveData.getCommandLine() !== patch.patch.commandLine) {
        liveData.setCommandLine(patch.patch.commandLine);
        changed = true;
      }
      if (patch.patch.commandLineEnabled !== undefined && liveData.isCommandLineEnabled() !== patch.patch.commandLineEnabled) {
        liveData.setCommandLineEnabled(patch.patch.commandLineEnabled);
        changed = true;
      }
      if (patch.patch.commandLineOverride !== undefined && liveData.isCommandLineOverride() !== patch.patch.commandLineOverride) {
        liveData.setCommandLineOverride(patch.patch.commandLineOverride);
        changed = true;
      }
      return changed;
    }
    case 'updateTempoRepeat': {
      let changed = false;
      if (patch.patch.tempo !== undefined && liveData.getTempo() !== patch.patch.tempo) {
        liveData.setTempo(patch.patch.tempo);
        changed = true;
      }
      if (patch.patch.repeat !== undefined && liveData.getRepeat() !== patch.patch.repeat) {
        liveData.setRepeat(patch.patch.repeat);
        changed = true;
      }
      if (patch.patch.repeatEnabled !== undefined && liveData.isRepeatEnabled() !== patch.patch.repeatEnabled) {
        liveData.setRepeatEnabled(patch.patch.repeatEnabled);
        changed = true;
      }
      return changed;
    }
    case 'updateLiveCodeText':
      if (liveData.getLiveCodeText() === patch.text) return false;
      liveData.setLiveCodeText(patch.text);
      return true;
    case 'setCellEnabled': {
      const obj = liveData.getLiveObjectBins().getLiveObject(patch.column, patch.row);
      if (!obj) return false;
      if (obj.isEnabled() === patch.enabled) return false;
      obj.setEnabled(patch.enabled);
      return true;
    }
    case 'setCell': {
      const bins = liveData.getLiveObjectBins();
      if (
        patch.column < 0
        || patch.column >= bins.getColumnCount()
        || patch.row < 0
        || patch.row >= bins.getRowCount()
      ) {
        return false;
      }
      const current = bins.getLiveObject(patch.column, patch.row);
      if (patch.cell === null) {
        if (!current) return false;
        bins.setLiveObject(patch.column, patch.row, null);
        return true;
      }
      if (!patch.cell.serializedXml || patch.cell.uniqueId.trim() === '') {
        return false;
      }
      const matchingIdentity = bins.getLiveObjectByUniqueId(patch.cell.uniqueId);
      if (matchingIdentity && matchingIdentity !== current) {
        return false;
      }
      try {
        const serialized = Element.parse(patch.cell.serializedXml);
        const soundObject = loadSoundObjectFromXML(serialized);
        if (!soundObject || !isBlueLiveSoundObjectType(soundObject.constructor.name)) {
          return false;
        }
        soundObject.setStartTime(TimePosition.beats(0));
        const liveObject = new LiveObject();
        liveObject.setUniqueId(patch.cell.uniqueId);
        liveObject.setEnabled(patch.cell.enabled);
        liveObject.setKeyTrigger(patch.cell.keyTrigger);
        liveObject.setMidiTrigger(patch.cell.midiTrigger);
        liveObject.setSoundObject(soundObject);
        bins.setLiveObject(patch.column, patch.row, liveObject);
        return true;
      } catch {
        return false;
      }
    }
    case 'insertRow': {
      return liveData.getLiveObjectBins().insertRow(patch.index);
    }
    case 'removeRow': {
      return liveData.getLiveObjectBins().removeRow(patch.index);
    }
    case 'insertColumn': {
      return liveData.getLiveObjectBins().insertColumn(patch.index);
    }
    case 'removeColumn': {
      return liveData.getLiveObjectBins().removeColumn(patch.index);
    }
    case 'captureEnabledSet': {
      const sets = liveData.getLiveObjectSets();
      const count = sets.getSets().length;
      sets.captureEnabledSet(liveData.getLiveObjectBins(), `Set ${count + 1}`);
      return sets.getSets().length !== count;
    }
    case 'renameSet': {
      return liveData.getLiveObjectSets().rename(patch.index, patch.name);
    }
    case 'removeSet': {
      return liveData.getLiveObjectSets().removeAt(patch.index);
    }
    case 'moveSet': {
      return liveData.getLiveObjectSets().move(patch.from, patch.to);
    }
    case 'applySet': {
      return liveData.getLiveObjectSets().applySet(
        patch.index,
        liveData.getLiveObjectBins(),
      );
    }
  }
}

function findPolyObjectByGroupId(score: Score, groupId: string): PolyObject | null {
  for (let i = 0; i < score.length; i++) {
    const lg = score[i];
    if (lg instanceof PolyObject) {
      if (assignLayerGroupId(lg) === groupId) return lg;
      const found = findPolyObjectByGroupIdRecursive(lg, groupId);
      if (found) return found;
    }
  }
  return null;
}

function findPolyObjectByGroupIdRecursive(pObj: PolyObject, groupId: string): PolyObject | null {
  for (const layer of pObj) {
    for (const sObj of layer) {
      if (sObj instanceof PolyObject) {
        if (assignLayerGroupId(sObj) === groupId) return sObj;
        const found = findPolyObjectByGroupIdRecursive(sObj, groupId);
        if (found) return found;
      }
    }
  }
  return null;
}

type ManagedLayerGroup = PolyObject | TrackLayerGroup | PatternsLayerGroup;

function getManagedLayerGroupId(group: ManagedLayerGroup): string {
  return group instanceof TrackLayerGroup ? group.getUniqueId() : assignLayerGroupId(group);
}

function isManagedLayerGroup(value: unknown): value is ManagedLayerGroup {
  return value instanceof PolyObject
    || value instanceof TrackLayerGroup
    || value instanceof PatternsLayerGroup;
}

function createManagedLayerGroup(
  groupType: ScoreLayerGroupType | undefined,
  defaultLayerGroupType: 'TRACK' | 'SOUND_OBJECT' = 'TRACK',
): ManagedLayerGroup {
  const effectiveGroupType = groupType ?? (defaultLayerGroupType === 'SOUND_OBJECT' ? 'polyObject' : 'track');
  switch (effectiveGroupType) {
    case 'track': {
      const group = new TrackLayerGroup();
      group.newLayerAt(0);
      return group;
    }
    case 'patterns': {
      const group = new PatternsLayerGroup();
      group.newLayerAt(0);
      return group;
    }
    case 'polyObject':
    default: {
      const group = new PolyObject(true);
      group.newLayerAt(0);
      return group;
    }
  }
}

function findLayerGroupByGroupId(score: Score, groupId: string): ManagedLayerGroup | null {
  for (let i = 0; i < score.length; i++) {
    const lg = score[i];
    if (!isManagedLayerGroup(lg)) continue;
    if (getManagedLayerGroupId(lg) === groupId) return lg;
    if (lg instanceof PolyObject) {
      const found = findPolyObjectByGroupIdRecursive(lg, groupId);
      if (found) return found;
    }
  }
  return null;
}

function findRootLayerGroupIndexByGroupId(score: Score, groupId: string): number {
  for (let i = 0; i < score.length; i++) {
    const lg = score[i];
    if (isManagedLayerGroup(lg) && getManagedLayerGroupId(lg) === groupId) {
      return i;
    }
  }
  return -1;
}

function moveLayerInManagedGroup(
  group: ManagedLayerGroup,
  layerIndex: number,
  targetIndex: number,
): boolean {
  if (group instanceof PolyObject) {
    const [layer] = group.splice(layerIndex, 1);
    if (!layer) return false;
    group.splice(targetIndex, 0, layer);
    return true;
  }
  if (group instanceof TrackLayerGroup) {
    const [layer] = group.splice(layerIndex, 1);
    if (!layer) return false;
    group.splice(targetIndex, 0, layer);
    return true;
  }
  const [layer] = group.splice(layerIndex, 1);
  if (!layer) return false;
  group.splice(targetIndex, 0, layer);
  return true;
}

type LayerStateManagedLayer = {
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  isSolo(): boolean;
  setSolo(solo: boolean): void;
};

type LayerHeightManagedLayer = {
  getHeightIndex(): number;
  setHeightIndex(heightIndex: number): void;
};

function isLayerStateManagedLayer(value: unknown): value is LayerStateManagedLayer {
  return typeof value === 'object'
    && value !== null
    && 'isMuted' in value
    && typeof value.isMuted === 'function'
    && 'setMuted' in value
    && typeof value.setMuted === 'function'
    && 'isSolo' in value
    && typeof value.isSolo === 'function'
    && 'setSolo' in value
    && typeof value.setSolo === 'function';
}

function isLayerHeightManagedLayer(value: unknown): value is LayerHeightManagedLayer {
  return typeof value === 'object'
    && value !== null
    && 'getHeightIndex' in value
    && typeof value.getHeightIndex === 'function'
    && 'setHeightIndex' in value
    && typeof value.setHeightIndex === 'function';
}

function applyUpdateLayerStatePatch(
  data: BlueData,
  patch: ScorePatch & { type: 'updateLayerState' },
): boolean {
  const score = data.getScore();
  const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
  if (!targetGroup) return false;
  if (patch.layerIndex < 0 || patch.layerIndex >= targetGroup.length) return false;

  const layer = targetGroup[patch.layerIndex];
  if (!isLayerStateManagedLayer(layer)) return false;

  let changed = false;

  if (patch.patch.muted !== undefined && layer.isMuted() !== patch.patch.muted) {
    layer.setMuted(patch.patch.muted);
    changed = true;
  }

  if (patch.patch.solo !== undefined && layer.isSolo() !== patch.patch.solo) {
    layer.setSolo(patch.patch.solo);
    changed = true;
  }

  if (patch.patch.heightIndex !== undefined && isLayerHeightManagedLayer(layer)) {
    const nextHeightIndex = Math.max(0, patch.patch.heightIndex);
    if (layer.getHeightIndex() !== nextHeightIndex) {
      layer.setHeightIndex(nextHeightIndex);
      changed = true;
    }
  }

  return changed;
}

function applyAddScoreObjectsPatch(data: BlueData, patch: ScorePatch & { type: 'addScoreObjects' }): boolean {
  const score = data.getScore();

  const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
  if (!targetGroup || targetGroup instanceof PatternsLayerGroup) return false;

  const context = score.getTimeContext();
  let changed = false;

  for (const obj of patch.objects) {
    let sObj: SoundObject | null = null;
    let clip: AudioClip | null = null;

    if (obj.serializedXml) {
      try {
        const serialized = Element.parse(obj.serializedXml);
        if (serialized.getName() === 'audioClip') {
          clip = AudioClip.loadFromXML(serialized);
        } else {
          sObj = loadSoundObjectFromXML(serialized)?.deepCopy() ?? null;
        }
      } catch {
        sObj = null;
        clip = null;
      }
    }

    if (!sObj && !clip && obj.sourceTarget?.location) {
      const source = resolveTimelineTarget(score, obj.sourceTarget.location);
      if (source) {
        if (source.sObj instanceof AudioClip) {
          clip = AudioClip.copyFrom(source.sObj);
        } else {
          sObj = source.sObj.deepCopy();
        }
      }
    }

    if (!sObj && !clip && obj.objectType === 'AudioClip') {
      clip = new AudioClip();
    }

    if (!sObj && !clip) {
      sObj = createSoundObject(obj.objectType);
    }

    const targetObject = clip ?? sObj;
    if (!targetObject) continue;

    if (obj.selectionId?.trim()) {
      assignExplicitScoreObjectId(targetObject, obj.selectionId.trim());
    }

    targetObject.setName(obj.name);
    targetObject.setStartTime(
      beatsToTimePosition(obj.startBeats, (obj.startTimeBase ?? TimeBase.BEATS) as TimeBase, context),
    );
    targetObject.setSubjectiveDuration(
      beatsToDuration(obj.durationBeats, (obj.durationTimeBase ?? TimeBase.BEATS) as TimeBase, context),
    );
    targetObject.setBackgroundColor(obj.backgroundColor);

    if (obj.layerIndex < 0 || obj.layerIndex >= targetGroup.length) {
      continue;
    }

    if (targetGroup instanceof TrackLayerGroup) {
      const trackLayer = targetGroup[obj.layerIndex];
      if (!trackLayer) continue;
      if (clip && trackLayer.accepts(clip)) {
        trackLayer.push(clip);
        changed = true;
      } else if (sObj && trackLayer.accepts(sObj)) {
        trackLayer.push(sObj);
        changed = true;
      }
      continue;
    }

    if (targetGroup instanceof PolyObject && sObj) {
      targetGroup[obj.layerIndex].push(sObj);
      changed = true;
    }
  }

  return changed;
}

function applyMoveScoreObjectsPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'moveScoreObjects' },
): boolean {
  const score = data.getScore();
  const resolvedMoves: Array<{
    move: (typeof patch.moves)[number];
    sourceResolved: NonNullable<ReturnType<typeof resolveTimelineTarget>>;
    targetLayer: Array<SoundObject | AudioClip>;
  }> = [];

  for (const move of patch.moves) {
    const sourceLocation = move.target.location ?? move.target.sourceInstanceLocation;
    if (!sourceLocation) continue;

    const sourceResolved = resolveTimelineTarget(score, sourceLocation);
    if (!sourceResolved) continue;

    const targetGroup = findLayerGroupByGroupId(score, move.targetGroupId);
    if (!targetGroup || targetGroup instanceof PatternsLayerGroup) continue;

    if (targetGroup instanceof TrackLayerGroup) {
      const trackLayer = targetGroup[move.targetLayerIndex];
      if (!trackLayer || !trackLayer.accepts(sourceResolved.sObj)) continue;
      resolvedMoves.push({ move, sourceResolved, targetLayer: trackLayer });
      continue;
    }

    if (!(targetGroup instanceof PolyObject) || sourceResolved.sObj instanceof AudioClip) {
      continue;
    }

    const targetLayer = targetGroup[move.targetLayerIndex];
    if (!targetLayer) continue;

    resolvedMoves.push({ move, sourceResolved, targetLayer });
  }

  resolvedMoves.sort((a, b) => b.sourceResolved.objectIndex - a.sourceResolved.objectIndex);

  let changed = false;
  for (const entry of resolvedMoves) {
    // Re-validate the resolved object is still at its index before splicing.
    // A prior splice in this same patch (or a duplicate/stale location) can
    // shift indices; never splice out an object that is not the one we resolved,
    // as that would silently move or delete the wrong score object.
    if (entry.sourceResolved.layer[entry.sourceResolved.objectIndex] !== entry.sourceResolved.sObj) {
      continue;
    }
    const [sObj] = entry.sourceResolved.layer.splice(entry.sourceResolved.objectIndex, 1);
    if (!sObj) continue;

    const targetStartBeats = Math.max(0, entry.move.targetStartBeats);
    if (sObj instanceof AudioClip) {
      const base = sObj.getStartTime().getTimeBase();
      sObj.setStartTime(beatsToTimePosition(targetStartBeats, base, score.getTimeContext()));
    } else if (sObj instanceof AbstractSoundObject) {
      const base = sObj.getStartTime().getTimeBase();
      sObj.setStartTime(beatsToTimePosition(targetStartBeats, base, score.getTimeContext()));
    }

    entry.targetLayer.push(sObj);
    changed = true;
  }

  return changed;
}

function removeScoreObjectByTarget(data: BlueData, target: ScoreObjectEditorTargetSnapshot): boolean {
  const score = data.getScore();
  const location = target.location ?? target.sourceInstanceLocation;
  if (!location) return false;

  const timelineResolved = resolveTimelineTarget(score, location);
  if (!timelineResolved) return false;
  const { layer, objectIndex } = timelineResolved;
  if (objectIndex < 0 || objectIndex >= layer.length) return false;

  layer.splice(objectIndex, 1);
  return true;
}

function applyMoveLayerGroupPatch(data: BlueData, patch: ScorePatch & { type: 'moveLayerGroup' }): boolean {
  const score = data.getScore();
  const sourceIdx = findRootLayerGroupIndexByGroupId(score, patch.groupId);
  if (sourceIdx === -1) return false;
  const clampedTarget = Math.max(0, Math.min(patch.targetIndex, score.length - 1));
  if (sourceIdx === clampedTarget) return false;
  const [removed] = score.splice(sourceIdx, 1);
  score.splice(clampedTarget, 0, removed);
  return true;
}

function applyRenameLayerGroupPatch(data: BlueData, patch: ScorePatch & { type: 'renameLayerGroup' }): boolean {
  const targetGroup = findLayerGroupByGroupId(data.getScore(), patch.groupId);
  if (!targetGroup) return false;
  targetGroup.setName(patch.name);
  return true;
}

function applyRemoveLayerGroupPatch(data: BlueData, patch: ScorePatch & { type: 'removeLayerGroup' }): boolean {
  const score = data.getScore();
  const idx = findRootLayerGroupIndexByGroupId(score, patch.groupId);
  if (idx === -1) return false;
  score.splice(idx, 1);
  return true;
}

function applyScopedNoteProcessorChainPatch(data: BlueData, patch: ScorePatch & { type: 'replaceScopedNoteProcessorChain' }): boolean {
  const score = data.getScore();

  if (patch.scope === 'rootScore') {
    if (patch.chain === null) {
      score.setNoteProcessorChain(new NoteProcessorChain());
    } else {
      const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
      score.setNoteProcessorChain(reified);
    }
    return true;
  }

  const idx = 'groupId' in patch ? findRootLayerGroupIndexByGroupId(score, patch.groupId) : -1;
  if (idx === -1) return false;
  const lg = score[idx];

  if (patch.scope === 'layerGroup') {
    if (lg instanceof PolyObject) {
      if (patch.chain === null) {
        lg.setNoteProcessorChain(new NoteProcessorChain());
      } else {
        const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
        lg.setNoteProcessorChain(reified);
      }
      return true;
    }
    if (lg instanceof PatternsLayerGroup) {
      if (patch.chain === null) {
        lg.setNoteProcessorChain(new NoteProcessorChain());
      } else {
        const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
        lg.setNoteProcessorChain(reified);
      }
      return true;
    }
    return false;
  }

  if (patch.scope === 'soundLayer') {
    const layerIdx = patch.layerIndex;
    if (!(lg instanceof PolyObject)) return false;
    if (layerIdx < 0 || layerIdx >= lg.length) return false;
    const layer = lg[layerIdx];
    if (patch.chain === null) {
      layer.setNoteProcessorChain(new NoteProcessorChain());
    } else {
      const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
      layer.setNoteProcessorChain(reified);
    }
    return true;
  }

  return false;
}

function getAutomationLayerFromGroup(
  group: unknown,
  ref: ScoreAutomationLayerRef,
): BlueDataAutomatableLayer | null {
  if (
    ref.layerKind === 'soundObject'
    && group instanceof PolyObject
    && ref.layerIndex >= 0
    && ref.layerIndex < group.length
  ) {
    return group[ref.layerIndex] as BlueDataAutomatableLayer;
  }

  if (
    ref.layerKind === 'track'
    && group instanceof TrackLayerGroup
    && ref.layerIndex >= 0
    && ref.layerIndex < group.length
  ) {
    return group[ref.layerIndex] as BlueDataAutomatableLayer;
  }

  return null;
}

function findAutomationLayerByGroupId(
  data: BlueData,
  ref: ScoreAutomationLayerRef,
): BlueDataAutomatableLayer | null {
  function visitGroup(group: unknown): BlueDataAutomatableLayer | null {
    if (!(group instanceof PolyObject) && !(group instanceof TrackLayerGroup)) {
      return null;
    }

    if (assignLayerGroupId(group) === ref.groupId) {
      return getAutomationLayerFromGroup(group, ref);
    }

    if (group instanceof PolyObject) {
      for (const layer of group) {
        for (const sObj of layer) {
          if (sObj instanceof PolyObject) {
            const nested = visitGroup(sObj);
            if (nested) return nested;
          }
        }
      }
    }

    return null;
  }

  const score = data.getScore();
  for (let gi = 0; gi < score.length; gi++) {
    const layer = visitGroup(score[gi]);
    if (layer) return layer;
  }

  return null;
}

function resolveAutomationLayerRef(data: BlueData, ref: ScoreAutomationLayerRef): BlueDataAutomatableLayer | null {
  const byGroupId = findAutomationLayerByGroupId(data, ref);
  if (byGroupId) return byGroupId;

  const score = data.getScore();
  const group = score[ref.rootGroupIndex];
  if (!group) return null;
  const directLayer = getAutomationLayerFromGroup(group, ref);
  if (directLayer) return directLayer;
  return null;
}

function findParameterById(data: BlueData, parameterId: string): BlueDataParameter | null {
  const allParams = ParameterHelper.getAllParameters(data.getArrangement(), data.getMixer());
  return allParams.find(p => p.getUniqueId() === parameterId) ?? null;
}

function removeAutomationParameterFromGroup(
  group: unknown,
  parameterId: string,
): void {
    if (!(group instanceof PolyObject) && !(group instanceof TrackLayerGroup)) {
      return;
  }

  for (const layer of group) {
    const paramList = layer.getAutomationParameters();
    if (paramList.contains(parameterId)) {
      paramList.removeParameterId(parameterId);
    }

    if (group instanceof PolyObject) {
      for (const sObj of layer) {
        if (sObj instanceof PolyObject) {
          removeAutomationParameterFromGroup(sObj, parameterId);
        }
      }
    }
  }
}

function removeAutomationParameterFromAllLayers(
  data: BlueData,
  parameterId: string,
): void {
  const score = data.getScore();
  for (let gi = 0; gi < score.length; gi++) {
    removeAutomationParameterFromGroup(score[gi], parameterId);
  }
}

function seedDefaultAutomationPoint(param: BlueDataParameter): void {
  if (param.getPoints().length > 0) {
    return;
  }

  param.setPoints([
    clampAutomationPoint(param, { time: 0, value: param.getFixedValue() }),
  ]);
}

function clampAutomationPoint(
  param: BlueDataParameter,
  point: AutomationPointSnapshot,
): AutomationPointSnapshot {
  return {
    time: Math.max(0, Number.isFinite(point.time) ? point.time : 0),
    value: Math.min(
      param.getMaximum(),
      Math.max(param.getMinimum(), Number.isFinite(point.value) ? point.value : param.getFixedValue()),
    ),
  };
}

function normalizeAutomationPoints(
  param: BlueDataParameter,
  points: AutomationPointSnapshot[],
): AutomationPointSnapshot[] {
  return points
    .map((point) => clampAutomationPoint(param, point))
    .sort((a, b) => a.time - b.time);
}

function findAutomationLayerBySnapshotId(
  data: BlueData,
  layerId: string,
): BlueDataAutomatableLayer | null {
  function visitGroup(group: unknown): BlueDataAutomatableLayer | null {
  if (!(group instanceof PolyObject) && !(group instanceof TrackLayerGroup)) {
      return null;
    }

    const groupId = assignLayerGroupId(group);
    for (let li = 0; li < group.length; li++) {
      const candidateLayerId = group instanceof TrackLayerGroup
        ? group[li]?.getUniqueId()
        : `${groupId}-layer-${li}`;
      if (candidateLayerId === layerId) {
        return group[li] as BlueDataAutomatableLayer;
      }

      if (group instanceof PolyObject) {
        for (const sObj of group[li]!) {
          if (sObj instanceof PolyObject) {
            const nested = visitGroup(sObj);
            if (nested) return nested;
          }
        }
      }
    }

    return null;
  }

  const score = data.getScore();
  for (let gi = 0; gi < score.length; gi++) {
    const layer = visitGroup(score[gi]);
    if (layer) return layer;
  }

  return null;
}

function applyAutomationRangePatch(
  data: BlueData,
  patch: MoveAutomationRangePatch | ScaleAutomationRangePatch,
): boolean {
  const startBeat = Math.min(patch.range.startBeat, patch.range.endBeat);
  const endBeat = Math.max(patch.range.startBeat, patch.range.endBeat);
  let changed = false;

  if (shouldAbortAutomationRangeScaleForPartialObjects(data, patch, startBeat, endBeat)) {
    return false;
  }

  for (const layerId of patch.range.layerIds) {
    const layer = findAutomationLayerBySnapshotId(data, layerId);
    if (!layer) {
      continue;
    }

    const assignedIds = new Set(layer.getAutomationParameters().getIds());
    const parameterIds = patch.range.parameterIdsByLayer[layerId] ?? [];

    for (const parameterId of parameterIds) {
      if (!assignedIds.has(parameterId)) {
        continue;
      }

      const param = findParameterById(data, parameterId);
      if (!param) {
        continue;
      }

      const before = param.getPoints();
      // Use anchored transforms that insert boundary anchor points at the
      // selection edges, preserving line shape outside the selection (Java
      // Line.processLineForSelectionDrag/Scale parity).
      const after = patch.type === 'moveAutomationRange'
        ? moveRangeWithAnchors(before, startBeat, endBeat, patch.beatDelta)
        : scaleRangeWithAnchors(before, startBeat, endBeat, patch.anchorBeat, patch.scaleFactor);

      const normalized = normalizeAutomationPoints(param, after);
      const same = before.length === normalized.length
        && before.every((point, index) => {
          const next = normalized[index];
          return next && point.time === next.time && point.value === next.value;
        });
      if (!same) {
        param.setPoints(normalized);
        changed = true;
      }
    }
  }

  // FR-014: keep selected score objects / audio clips aligned with the moved or
  // scaled automation range by applying the same time transform to objects.
  // Triggered by explicit objectIds (Java shift-gated model) or by the legacy
  // includeScoreObjects/includeAudioClips booleans.
  if (patch.objectIds || patch.includeScoreObjects || patch.includeAudioClips) {
    if (applyAutomationRangeObjectAlignment(data, patch, startBeat, endBeat)) {
      changed = true;
    }
  }

  return changed;
}

function shouldAbortAutomationRangeScaleForPartialObjects(
  data: BlueData,
  patch: MoveAutomationRangePatch | ScaleAutomationRangePatch,
  startBeat: number,
  endBeat: number,
): boolean {
  if (patch.type !== 'scaleAutomationRange') return false;
  if (!patch.objectIds && !patch.includeScoreObjects && !patch.includeAudioClips) return false;

  const context = data.getScore().getTimeContext();
  const explicitIds = patch.objectIds ? new Set(patch.objectIds) : null;
  const includeScoreObjects = explicitIds ? true : !!patch.includeScoreObjects;
  const includeAudioClips = explicitIds ? true : !!patch.includeAudioClips;
  if (!includeScoreObjects && !includeAudioClips) return false;

  for (const layerId of patch.range.layerIds) {
    const layer = findAutomationLayerBySnapshotId(data, layerId);
    if (!layer) continue;

    const objects = layer as unknown as readonly unknown[];
    for (const obj of objects) {
      const isClip = obj instanceof AudioClip;
      const isScoreObject = !isClip && (obj instanceof AbstractSoundObject || obj instanceof PolyObject);
      if (!isClip && !isScoreObject) continue;
      if (isClip ? !includeAudioClips : !includeScoreObjects) continue;

      const timed = obj as {
        getStartTime(): TimePosition;
        getSubjectiveDuration(): TimeDuration;
      };
      const startBeats = timePositionToBeats(timed.getStartTime(), context);

      if (explicitIds) {
        const objId = getScoreObjectId(obj);
        if (!objId || !explicitIds.has(objId)) continue;
      } else if (startBeats < startBeat || startBeats > endBeat) {
        continue;
      }

      const endBeats = startBeats + timed.getSubjectiveDuration().toBeats(context);
      if ((startBeats < startBeat && endBeats > startBeat)
        || (startBeats < endBeat && endBeats > endBeat)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Move or scale score objects / audio clips that participate in a multi-line
 * gesture, applying the same time transform the automation range received.
 * Used by multi-line move/scale to preserve object / clip alignment with the
 * automation lines (US3-4 / FR-014).
 *
 * Two inclusion modes:
 * - Explicit IDs (`objectIds`): Java shift-gated model — only objects the user
 *   explicitly selected via shift-drag move/scale. Object type (score object vs
 *   audio clip) is determined by instanceof, not by the ID.
 * - Legacy booleans (`includeScoreObjects`/`includeAudioClips`): objects whose
 *   start falls within [startBeat, endBeat] on selected layers.
 *
 * For scale, both start time AND subjective duration are scaled (matching Java's
 * MultiLineScaleMouseListener which scales end = start + duration and writes back
 * both values).
 */
function applyAutomationRangeObjectAlignment(
  data: BlueData,
  patch: MoveAutomationRangePatch | ScaleAutomationRangePatch,
  startBeat: number,
  endBeat: number,
): boolean {
  const context = data.getScore().getTimeContext();

  const explicitIds = patch.objectIds ? new Set(patch.objectIds) : null;
  const includeScoreObjects = explicitIds ? true : !!patch.includeScoreObjects;
  const includeAudioClips = explicitIds ? true : !!patch.includeAudioClips;
  if (!includeScoreObjects && !includeAudioClips) return false;

  let changed = false;

  for (const layerId of patch.range.layerIds) {
    const layer = findAutomationLayerBySnapshotId(data, layerId);
    if (!layer) continue;

    const objects = layer as unknown as readonly unknown[];
    for (const obj of objects) {
      const isClip = obj instanceof AudioClip;
      const isScoreObject = !isClip && (obj instanceof AbstractSoundObject || obj instanceof PolyObject);
      if (!isClip && !isScoreObject) continue;

      const timed = obj as {
        getStartTime(): TimePosition;
        setStartTime(value: unknown): void;
        getSubjectiveDuration(): TimeDuration;
        setSubjectiveDuration(value: unknown): void;
      };
      const startTime = timed.getStartTime();
      const startBeats = timePositionToBeats(startTime, context);

      if (isClip ? !includeAudioClips : !includeScoreObjects) continue;

      // Inclusion test: explicit ID match (preferred) or time-range fallback.
      if (explicitIds) {
        const objId = getScoreObjectId(obj);
        if (!objId || !explicitIds.has(objId)) continue;
      } else {
        if (startBeats < startBeat || startBeats > endBeat) continue;
      }

      if (patch.type === 'moveAutomationRange') {
        const newBeats = Math.max(0, startBeats + patch.beatDelta);
        if (newBeats === startBeats) continue;
        timed.setStartTime(beatsToTimePosition(newBeats, startTime.getTimeBase(), context));
        changed = true;
      } else {
        // Scale: transform both start and end (= start + duration), then write
        // back the new start and the new (end - start) duration. Matches Java's
        // MultiLineScaleMouseListener.mouseDragged:185-194.
        const dur = timed.getSubjectiveDuration();
        const durBeats = dur.toBeats(context);
        const endBeats = startBeats + durBeats;

        const newStart = Math.max(0, patch.anchorBeat + (startBeats - patch.anchorBeat) * patch.scaleFactor);
        const newEnd = Math.max(0, patch.anchorBeat + (endBeats - patch.anchorBeat) * patch.scaleFactor);
        const newDur = Math.max(0, newEnd - newStart);

        if (newStart === startBeats && newDur === durBeats) continue;

        timed.setStartTime(beatsToTimePosition(newStart, startTime.getTimeBase(), context));
        timed.setSubjectiveDuration(beatsToDuration(newDur, dur.getTimeBase(), context));
        changed = true;
      }
    }
  }

  return changed;
}

function applyScoreAutomationPatch(data: BlueData, patch: ScorePatch): boolean | undefined {
  switch (patch.type) {
    case 'assignAutomationToLayer': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      if (!layer) return false;
      const paramList = layer.getAutomationParameters();

      removeAutomationParameterFromAllLayers(data, patch.parameterId);

      if (!paramList.contains(patch.parameterId)) {
        paramList.addParameterId(patch.parameterId);
      }
      paramList.setSelectedParameter(patch.parameterId);

      const param = findParameterById(data, patch.parameterId);
      if (param) {
        if (patch.enableAutomation) {
          param.setAutomationEnabled(true);
        }
        seedDefaultAutomationPoint(param);
        const lineColors = new LineColors();
        param.setLineColor(lineColors.getColor(paramList.getIds().indexOf(patch.parameterId)));
      }
      return true;
    }

    case 'removeAutomationFromLayer': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      if (!layer) return false;
      const paramList = layer.getAutomationParameters();
      paramList.removeParameterId(patch.parameterId);
      const param = findParameterById(data, patch.parameterId);
      if (param) param.setAutomationEnabled(false);
      return true;
    }

    case 'moveAutomationToLayer': {
      const fromLayer = resolveAutomationLayerRef(data, patch.fromLayer);
      const toLayer = resolveAutomationLayerRef(data, patch.toLayer);
      if (!fromLayer || !toLayer) return false;
      fromLayer.getAutomationParameters().removeParameterId(patch.parameterId);
      if (!toLayer.getAutomationParameters().contains(patch.parameterId)) {
        toLayer.getAutomationParameters().addParameterId(patch.parameterId);
      }
      toLayer.getAutomationParameters().setSelectedParameter(patch.parameterId);
      return true;
    }

    case 'clearLayerAutomations': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      if (!layer) return false;
      const paramIds = layer.getAutomationParameters().getIds();
      for (const id of paramIds) {
        const param = findParameterById(data, id);
        if (param) param.setAutomationEnabled(false);
      }
      layer.getAutomationParameters().clear();
      return true;
    }

    case 'selectLayerAutomation': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      if (!layer) return false;
      if (patch.parameterId) {
        layer.getAutomationParameters().setSelectedParameter(patch.parameterId);
      }
      return true;
    }

    case 'setAutomationLineColor': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      param.setLineColor(patch.lineColor);
      return true;
    }

    case 'setAutomationPoints': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      param.setPoints(normalizeAutomationPoints(param, patch.points));
      return true;
    }

    case 'insertAutomationPoint': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      const point = clampAutomationPoint(param, patch.point);
      param.addPoint(point.time, point.value);
      return true;
    }

    case 'deleteAutomationPoint': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      const pts = param.getPoints();
      if (patch.pointIndex > 0 && patch.pointIndex < pts.length) {
        const newPts = pts.filter((_, idx) => idx !== patch.pointIndex);
        param.setPoints(newPts);
      }
      return true;
    }

    case 'moveAutomationPoint': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      const pts = param.getPoints();
      if (patch.pointIndex >= 0 && patch.pointIndex < pts.length) {
        const point = clampAutomationPoint(param, patch.point);
        const newPts = pts.map((p, idx) =>
          idx === patch.pointIndex ? point : p
        );
        param.setPoints(normalizeAutomationPoints(param, newPts));
      }
      return true;
    }

    case 'cleanupLayerAutomation': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      if (!layer) return false;
      const paramList = layer.getAutomationParameters();
      const allParams = ParameterHelper.getAllParameters(data.getArrangement(), data.getMixer());
      const validIds = new Set(allParams.map(p => p.getUniqueId()));
      const idsToRemove = patch.parameterIds
        ? patch.parameterIds.filter(id => !validIds.has(id))
        : paramList.getIds().filter(id => !validIds.has(id));
      for (const id of idsToRemove) {
        paramList.removeParameterId(id);
      }
      return idsToRemove.length > 0;
    }

    case 'moveAutomationRange':
    case 'scaleAutomationRange':
      return applyAutomationRangePatch(data, patch);

    default:
      return undefined;
  }
}

function isTrackScorePatch(patch: ScorePatch): patch is TrackScorePatch {
  return patch.type === 'addTrackItem'
    || patch.type === 'moveTrackItems'
    || patch.type === 'resizeTrackItems'
    || patch.type === 'removeTrackItems'
    || patch.type === 'replaceTrackNoteProcessorChain'
    || patch.type === 'createTrackInstrument'
    || patch.type === 'replaceTrackInstrument'
    || patch.type === 'clearTrackInstrument'
    || patch.type === 'updateTrackInstrument';
}

interface ResolvedTrackRef {
  group: TrackLayerGroup;
  track: TrackLayer;
  trackIndex: number;
}

function resolveTrackRef(
  score: Score,
  ref: TrackRef,
  context?: ProjectDocumentPatchContext,
): ResolvedTrackRef | null {
  if (!ref || typeof ref.rootGroupId !== 'string' || !ref.rootGroupId.trim()) return null;
  if (typeof ref.trackId !== 'string' || !ref.trackId.trim()) return null;
  if (!Number.isInteger(ref.projectSessionId) || ref.projectSessionId < 0) return null;
  if (!Number.isInteger(ref.projectRevision) || ref.projectRevision < 0) return null;
  if (!context) return null;
  if (ref.projectSessionId !== context.projectSessionId) return null;
  if (ref.projectRevision !== context.projectRevision) return null;

  for (const group of score) {
    if (!(group instanceof TrackLayerGroup) || group.getUniqueId() !== ref.rootGroupId) continue;
    let found: ResolvedTrackRef | null = null;
    for (let index = 0; index < group.length; index++) {
      const track = group[index];
      if (track.getUniqueId() !== ref.trackId) continue;
      if (found) return null;
      found = { group, track, trackIndex: index };
    }
    return found;
  }
  return null;
}

interface ResolvedTrackItem {
  track: TrackLayer;
  item: TrackLayer[number];
  objectIndex: number;
}

function resolveTrackItem(score: Score, ref: TrackItemRef, context?: ProjectDocumentPatchContext): ResolvedTrackItem | null {
  const resolved = resolveTrackRef(score, ref.track, context);
  if (!resolved) return null;
  if (ref.objectIndex !== undefined) {
    if (!Number.isInteger(ref.objectIndex) || ref.objectIndex < 0 || ref.objectIndex >= resolved.track.length) return null;
    const item = resolved.track[ref.objectIndex];
    if (ref.objectId && assignScoreObjectId(item, item instanceof AudioClip ? 'aclp' : 'sobj') !== ref.objectId) return null;
    return { track: resolved.track, item, objectIndex: ref.objectIndex };
  }
  if (!ref.objectId || !ref.objectId.trim()) return null;
  for (let index = 0; index < resolved.track.length; index++) {
    const item = resolved.track[index];
    if (assignScoreObjectId(item, item instanceof AudioClip ? 'aclp' : 'sobj') === ref.objectId) {
      return { track: resolved.track, item, objectIndex: index };
    }
  }
  return null;
}

function setTrackItemTiming(
  item: TrackLayer[number],
  context: TimeContext,
  startBeats: number,
  durationBeats?: number,
  startTimeBase?: string,
  durationTimeBase?: string,
): void {
  const start = beatsToTimePosition(
    Math.max(0, Number.isFinite(startBeats) ? startBeats : 0),
    (startTimeBase ?? TimeBase.BEATS) as TimeBase,
    context,
  );
  const duration = durationBeats === undefined
    ? undefined
    : beatsToDuration(
      Math.max(0, Number.isFinite(durationBeats) ? durationBeats : 0),
      (durationTimeBase ?? TimeBase.BEATS) as TimeBase,
      context,
    );
  if (item instanceof AudioClip) {
    item.setStartTime(start);
    if (duration) item.setSubjectiveDuration(duration);
  } else if (item instanceof AbstractSoundObject) {
    item.setStartTime(start);
    if (duration) item.setSubjectiveDuration(duration);
  }
}

function reifyTrackItemTransfer(
  transfer: TrackItemTransfer,
  context: TimeContext,
): TrackLayer[number] | null {
  const typeName = transfer.objectType ?? transfer.type ?? '';
  let item: TrackLayer[number] | null = null;
  if (transfer.serializedXml) {
    try {
      const serialized = Element.parse(transfer.serializedXml);
      if (serialized.getName() === 'audioClip') {
        item = AudioClip.loadFromXML(serialized);
      } else {
        item = loadSoundObjectFromXML(serialized)?.deepCopy() ?? null;
      }
    } catch {
      return null;
    }
  } else if (typeName === 'AudioClip') {
    item = new AudioClip();
  } else if (typeName) {
    item = createSoundObject(typeName);
  }

  if (!item) return null;
  if (transfer.name !== undefined) item.setName(transfer.name);
  if (transfer.backgroundColor !== undefined) item.setBackgroundColor(transfer.backgroundColor);
  if (transfer.startBeats !== undefined) {
    setTrackItemTiming(item, context, transfer.startBeats, transfer.durationBeats, transfer.startTimeBase, transfer.durationTimeBase);
  }
  return item;
}

function applyTrackScorePatch(
  data: BlueData,
  patch: TrackScorePatch,
  patchContext?: ProjectDocumentPatchContext,
): boolean {
  const score = data.getScore();
  const context = score.getTimeContext();

  if (patch.type === 'addTrackItem') {
    const target = resolveTrackRef(score, patch.track, patchContext);
    if (!target) return false;
    const item = reifyTrackItemTransfer(patch.item, context);
    if (!item || !target.track.accepts(item)) return false;
    setTrackItemTiming(
      item,
      context,
      patch.startBeats,
      patch.item.durationBeats,
      patch.item.startTimeBase,
      patch.item.durationTimeBase,
    );
    target.track.push(item);
    return true;
  }

  if (patch.type === 'removeTrackItems') {
    const resolved = patch.targets.map((target) => resolveTrackItem(score, target, patchContext));
    if (resolved.some((entry) => !entry)) return false;
    const entries = resolved as ResolvedTrackItem[];
    if (new Set(entries.map((entry) => entry.item)).size !== entries.length) return false;
    for (const entry of entries) {
      const index = entry.track.indexOf(entry.item);
      if (index < 0) return false;
    }
    for (const entry of entries) {
      entry.track.splice(entry.track.indexOf(entry.item), 1);
    }
    return entries.length > 0;
  }

  if (patch.type === 'moveTrackItems') {
    const resolved = patch.moves.map((move) => ({
      move,
      source: resolveTrackItem(score, move.source, patchContext),
      destination: resolveTrackRef(score, move.destination, patchContext),
    }));
    if (resolved.some((entry) => !entry.source || !entry.destination)) return false;
    const entries = resolved as Array<{
      move: TrackItemMove;
      source: ResolvedTrackItem;
      destination: ResolvedTrackRef;
    }>;
    if (new Set(entries.map((entry) => entry.source.item)).size !== entries.length) return false;
    for (const entry of entries) {
      if (!entry.destination.track.accepts(entry.source.item)) return false;
      if (!Number.isFinite(entry.move.targetStartBeats)) return false;
      if (entry.source.track.indexOf(entry.source.item) < 0) return false;
    }
    for (const entry of entries) {
      const sourceIndex = entry.source.track.indexOf(entry.source.item);
      entry.source.track.splice(sourceIndex, 1);
      setTrackItemTiming(entry.source.item, context, entry.move.targetStartBeats);
      entry.destination.track.push(entry.source.item);
    }
    return entries.length > 0;
  }

  if (patch.type === 'resizeTrackItems') {
    const resolved = patch.resizes.map((resize) => ({
      resize,
      target: resolveTrackItem(score, resize.target, patchContext),
    }));
    if (resolved.some((entry) => !entry.target)) return false;
    const entries = resolved as Array<{ resize: TrackItemResize; target: ResolvedTrackItem }>;
    if (new Set(entries.map((entry) => entry.target.item)).size !== entries.length) return false;
    for (const entry of entries) {
      if (!Number.isFinite(entry.resize.targetStartBeats)
        || !Number.isFinite(entry.resize.targetDurationBeats)
        || entry.resize.targetDurationBeats <= 0
        || entry.target.track.indexOf(entry.target.item) < 0) {
        return false;
      }
    }
    for (const entry of entries) {
      setTrackItemTiming(
        entry.target.item,
        context,
        entry.resize.targetStartBeats,
        entry.resize.targetDurationBeats,
      );
    }
    return entries.length > 0;
  }

  const target = resolveTrackRef(score, patch.track, patchContext);
  if (!target) return false;

  if (patch.type === 'replaceTrackNoteProcessorChain') {
    target.track.setNoteProcessorChain(
      patch.chain ? reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot) : new NoteProcessorChain(),
    );
    return true;
  }

  if (patch.type === 'createTrackInstrument') {
    target.track.setInstrument(createInstrumentForType(patch.instrumentType));
    return true;
  }

  if (patch.type === 'replaceTrackInstrument') {
    if (patch.instrument.type === 'unknown') return false;
    target.track.setInstrument(createInstrumentFromSnapshot(patch.instrument));
    return true;
  }

  if (patch.type === 'clearTrackInstrument') {
    if (!target.track.getInstrument()) return false;
    target.track.clearInstrument();
    return true;
  }

  if (patch.type === 'updateTrackInstrument') {
    const instrument = target.track.getInstrument();
    if (!instrument) return false;
    return applyInstrumentPatch(instrument, patch.patch);
  }

  return false;
}

function applyScoreObjectPatch(
  data: BlueData,
  patch: ScorePatch,
  patchContext?: ProjectDocumentPatchContext,
): boolean {
  if (isTrackScorePatch(patch)) {
    return applyTrackScorePatch(data, patch, patchContext);
  }
  if (patch.type === 'addScoreObjects') {
    return applyAddScoreObjectsPatch(data, patch);
  }

  if (patch.type === 'moveScoreObjects') {
    return applyMoveScoreObjectsPatch(data, patch);
  }

  if (patch.type === 'removeScoreObjects') {
    let removedAny = false;
    for (const target of patch.targets) {
      if (removeScoreObjectByTarget(data, target)) {
        removedAny = true;
      }
    }
    return removedAny;
  }

  if (patch.type === 'setSubjectiveDurationToObjective') {
    const context = data.getScore().getTimeContext();
    const resolved = patch.targets.map((target) => resolveEditorTarget(data, target)?.sObj ?? null);
    if (resolved.some((object) => !object || object instanceof AudioClip)) return false;
    const updates = (resolved as SoundObject[]).map((object) => {
      let durationBeats: number | null = null;
      if (object instanceof GenericScore) {
        const notes = parseScoreNotes(object.getScoreText());
        durationBeats = notes.length === 0
          ? null
          : Math.max(...notes.map((note) => note.getStartTime() + note.getObjectiveDuration()));
      } else if (object instanceof Instance && object.getSoundObject()) {
        durationBeats = object.getSoundObject()!.getSubjectiveDuration().toBeats(context);
      } else {
        // Java Blue defines the objective duration of most SoundObject types as
        // their current subjective duration. GenericScore and Instance are the
        // meaningful exceptions supported here.
        durationBeats = object.getSubjectiveDuration().toBeats(context);
      }
      return durationBeats !== null && Number.isFinite(durationBeats) && durationBeats > 0
        ? { object, durationBeats }
        : null;
    });
    if (updates.some((update) => update === null)) return false;
    for (const update of updates as Array<{ object: SoundObject; durationBeats: number }>) {
      update.object.setSubjectiveDuration(beatsToDuration(
        update.durationBeats,
        update.object.getSubjectiveDuration().getTimeBase(),
        context,
      ));
    }
    return updates.length > 0;
  }

  if (patch.type === 'addLayer') {
    const score = data.getScore();
    const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
    if (!targetGroup) return false;
    targetGroup.newLayerAt(patch.layerIndex + 1);
    return true;
  }

  if (patch.type === 'removeLayer') {
    const score = data.getScore();
    const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
    if (!targetGroup) return false;
    if (patch.layerIndex >= 0 && patch.layerIndex < targetGroup.length) {
      targetGroup.removeLayers(patch.layerIndex, patch.layerIndex);
    }
    return true;
  }

  if (patch.type === 'moveLayer') {
    const score = data.getScore();
    const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
    if (!targetGroup) return false;
    const { layerIndex, targetIndex } = patch;
    if (layerIndex < 0 || layerIndex >= targetGroup.length) return false;
    const clampedTarget = Math.max(0, Math.min(targetIndex, targetGroup.length - 1));
    if (layerIndex === clampedTarget) return false;
    return moveLayerInManagedGroup(targetGroup, layerIndex, clampedTarget);
  }

  if (patch.type === 'renameLayer') {
    const score = data.getScore();
    const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
    if (!targetGroup) return false;
    if (patch.layerIndex < 0 || patch.layerIndex >= targetGroup.length) return false;
    targetGroup[patch.layerIndex]!.setName(patch.name);
    return true;
  }

  if (patch.type === 'addLayerGroup') {
    const score = data.getScore();
    const insertAt = patch.insertAtIndex ?? score.length;
    score.splice(insertAt, 0, createManagedLayerGroup(patch.groupType, patchContext?.defaultLayerGroupType));
    return true;
  }

  if (patch.type === 'updateTimeState') {
    return applyScoreTimeStatePatch(data, patch.patch);
  }

  if (patch.type === 'addMarker') {
    const name = patch.name ?? `Marker ${data.getMarkersList().size() + 1}`;
    const context = data.getScore().getTimeContext();
    const targetBase = data.getScore().getTimeState().getTimeDisplay();
    data.getMarkersList().addMarkerPosition(name, beatsToTimePosition(patch.timeBeats, targetBase, context));
    return true;
  }

  if (patch.type === 'updateMarker') {
    const ml = data.getMarkersList();
    if (patch.patch.name !== undefined) {
      ml.setMarkerName(patch.sourceIndex, patch.patch.name);
    }
    if (patch.patch.timeBeats !== undefined || patch.patch.timeBase !== undefined) {
      const context = data.getScore().getTimeContext();
      const currentPosition = ml.getMarkerTimePosition(patch.sourceIndex);
      const targetBase = (patch.patch.timeBase ?? currentPosition.getTimeBase()) as TimeBase;
      const targetBeats = patch.patch.timeBeats ?? currentPosition.toBeats(context);
      ml.setMarkerTimePosition(
        patch.sourceIndex,
        beatsToTimePosition(targetBeats, targetBase, context),
      );
    }
    return true;
  }

  if (patch.type === 'updateLayerState') {
    return applyUpdateLayerStatePatch(data, patch);
  }

  if (patch.type === 'removeMarker') {
    data.getMarkersList().removeMarker(patch.sourceIndex);
    return true;
  }

  if (patch.type === 'moveLayerGroup') {
    return applyMoveLayerGroupPatch(data, patch);
  }

  if (patch.type === 'renameLayerGroup') {
    return applyRenameLayerGroupPatch(data, patch);
  }

  if (patch.type === 'removeLayerGroup') {
    return applyRemoveLayerGroupPatch(data, patch);
  }

  if (patch.type === 'replaceScopedNoteProcessorChain') {
    return applyScopedNoteProcessorChainPatch(data, patch);
  }

  if (patch.type === 'saveNamedNoteProcessorChain') {
    const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
    data.getNoteProcessorChainMap().setChain(patch.name, reified);
    return true;
  }

  if (patch.type === 'deleteNamedNoteProcessorChain') {
    data.getNoteProcessorChainMap().removeChain(patch.name);
    return true;
  }

  const automationResult = applyScoreAutomationPatch(data, patch);
  if (automationResult !== undefined) return automationResult;

  const target = (patch as { target: ScoreObjectEditorTargetSnapshot }).target;
  const resolved = resolveEditorTarget(data, target);
  if (!resolved) return false;

  const { sObj } = resolved;
  const score = data.getScore();
  const context = score.getTimeContext();

  switch (patch.type) {
    case 'updateSharedProperties': {
      const p = patch.patch;
      if (p.name !== undefined) sObj.setName(p.name);
      if (p.backgroundColor !== undefined) {
        if (sObj instanceof AudioClip) {
          sObj.setBackgroundColor(p.backgroundColor);
        } else if (sObj instanceof AbstractSoundObject) {
          sObj.setBackgroundColor(p.backgroundColor);
        }
      }
      if (p.startTime !== undefined) {
        const tb = p.startTime.timeBase as TimeBase;
        const tp = beatsToTimePosition(p.startTime.value, tb, context);
        if (sObj instanceof AudioClip) {
          sObj.setStartTime(tp);
        } else if (sObj instanceof AbstractSoundObject) {
          sObj.setStartTime(tp);
        }
      }
      if (p.subjectiveDuration !== undefined) {
        const tb = p.subjectiveDuration.timeBase as TimeBase;
        const td = beatsToDuration(p.subjectiveDuration.value, tb, context);
        if (sObj instanceof AudioClip) {
          sObj.setSubjectiveDuration(td);
        } else if (sObj instanceof AbstractSoundObject) {
          sObj.setSubjectiveDuration(td);
        }
      }
      return true;
    }
    case 'updateSoundObjectBehavior': {
      if (!(sObj instanceof AbstractSoundObject)) return false;
      const p = patch.patch;
      if (p.timeBehavior !== undefined) {
        sObj.setTimeBehavior(p.timeBehavior as TimeBehavior);
      }
      if (p.repeatPoint !== undefined) {
        if (p.repeatPoint === null) {
          sObj.setRepeatPoint(null);
        } else {
          const tb = p.repeatPoint.timeBase as TimeBase;
          sObj.setRepeatPoint(beatsToDuration(p.repeatPoint.value, tb, context));
        }
      }
      return true;
    }
    case 'replaceNoteProcessorChain': {
      if (!(sObj instanceof AbstractSoundObject)) return false;
      if (patch.chain === null) {
        sObj.setNoteProcessorChain(new NoteProcessorChain());
      } else {
        const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
        sObj.setNoteProcessorChain(reified);
      }
      return true;
    }
    case 'updateTypeSpecificEditor': {
      if (patch.patch.text !== undefined) {
        return setCodeText(sObj as SoundObject, patch.patch.text as string);
      }
      if (sObj instanceof JavaScriptObject) {
        const p = patch.patch;
        if (p.onLoadProcessable !== undefined) {
          sObj.setOnLoadProcessable(p.onLoadProcessable as boolean);
          return true;
        }
      }
      if (sObj instanceof PythonObject) {
        const p = patch.patch;
        if (p.onLoadProcessable !== undefined) {
          sObj.setOnLoadProcessable(p.onLoadProcessable as boolean);
          return true;
        }
      }
      if (sObj instanceof ObjectBuilder) {
        const p = patch.patch;
        let changed = false;
        if (p.commandLine !== undefined) {
          sObj.setCommandLine(p.commandLine as string);
          changed = true;
        }
        if (p.languageType !== undefined) {
          sObj.setLanguageType(p.languageType as string);
          changed = true;
        }
        if (p.editEnabled !== undefined) {
          sObj.setEditEnabled(p.editEnabled as boolean);
          changed = true;
        }
        if (changed) {
          return true;
        }
      }
      if (sObj instanceof ClojureObject) {
        const p = patch.patch;
        if (p.onLoadProcessable !== undefined) {
          sObj.setOnLoadProcessable(p.onLoadProcessable as boolean);
          return true;
        }
      }
      if (sObj instanceof External) {
        const ext = sObj as External;
        const p = patch.patch;
        if (p.scoreText !== undefined) ext.setText(p.scoreText as string);
        if (p.commandLine !== undefined) ext.setCommandLine(p.commandLine as string);
        if (p.syntaxType !== undefined) ext.setSyntaxType(p.syntaxType as string);
        return true;
      }
      if (sObj instanceof TrackerObject) {
        const to = sObj as TrackerObject;
        const p = patch.patch;
        if (p.showNoteNames !== undefined) {
          // stored in tracker payload, not directly on model
        }
        if (p.octave !== undefined) {
          // stored in tracker payload, not directly on model
        }
        if (Array.isArray(p.cellChanges)) {
          const trackList = to.getTracks();
          for (const change of p.cellChanges as Array<{ trackId: string; rowIndex: number; columnId: string; value: string | number | null }>) {
            const trackIdx = parseInt(change.trackId.replace('tracker-track-', ''), 10);
            if (trackIdx >= 0 && trackIdx < trackList.size() && change.columnId.startsWith('track-')) {
              const track = trackList.getTrack(trackIdx)!;
              if (change.rowIndex >= 0 && change.rowIndex < track.getNumSteps()) {
                const trNote = track.getTrackerNote(change.rowIndex);
                const val = String(change.value ?? '').trim();
                if (val === '-') {
                  trNote.setTied(true);
                  trNote.setOff(false);
                } else if (val.toUpperCase() === 'OFF') {
                  trNote.setOff(true);
                  trNote.setTied(false);
                } else {
                  trNote.setTied(false);
                  trNote.setOff(false);
                  trNote.setValue(1, val);
                }
              }
            }
          }
        }
        if (p.stepsPerBeat !== undefined) to.setStepsPerBeat(p.stepsPerBeat as number);
        if (p.steps !== undefined) {
          to.getTracks().setSteps(p.steps as number);
        }
        if (p.updateTrackCell !== undefined) {
          const { trackIndex, columnIndex, stepIndex, value } = p.updateTrackCell as { trackIndex: number; columnIndex: number; stepIndex: number; value: string };
          const trackList = to.getTracks();
          if (trackIndex >= 0 && trackIndex < trackList.size()) {
            const track = trackList.getTrack(trackIndex)!;
            if (stepIndex >= 0 && stepIndex < track.getNumSteps()) {
              const trNote = track.getTrackerNote(stepIndex);
              const val = String(value ?? '').trim();

              if (columnIndex === -1) { // status column
                if (val === '-') {
                  trNote.setTied(true);
                  trNote.setOff(false);
                } else if (val.toUpperCase() === 'OFF') {
                  trNote.setOff(true);
                  trNote.setTied(false);
                } else {
                  trNote.setTied(false);
                  trNote.setOff(false);
                }
              } else {
                if (trNote.isOff()) {
                  return true;
                }
                const col = track.getColumn(columnIndex + 1);
                if (!col) {
                  return true;
                }
                if (!col.isValid(val)) {
                  // Java parity: invalid edits are rejected and prior value is preserved.
                  return true;
                }

                if (!trNote.isActive()) {
                  if (val.length === 0) {
                    return true;
                  }

                  let previousNote: TrackerNote | null = null;
                  for (let i = stepIndex - 1; i >= 0; i--) {
                    const temp = track.getTrackerNote(i);
                    if (temp.isActive()) {
                      previousNote = temp;
                      break;
                    }
                  }

                  if (previousNote) {
                    trNote.copyValues(previousNote);
                  } else {
                    for (let i = 1; i < track.getNumColumns(); i++) {
                      const c = track.getColumn(i);
                      if (c) {
                        trNote.setValue(i, c.getDefaultValue());
                      }
                    }
                  }
                }
                trNote.setValue(columnIndex + 1, val);
              }
            }
          }
        }
        if (p.updateTrackProperties !== undefined) {
          const { trackIndex, name, instrumentId, noteTemplate, columns } = p.updateTrackProperties as {
            trackIndex: number;
            name: string;
            instrumentId: string;
            noteTemplate: string;
            columns?: TrackerColumnSnapshot[];
          };
          const track = to.getTracks().getTrack(trackIndex);
          if (track) {
            track.setName(name);
            track.setInstrumentId(instrumentId);
            track.setNoteTemplate(noteTemplate);

            if (columns) {
              const oldCols: Column[] = [];
              for (let i = 1; i < track.getNumColumns(); i++) {
                const c = track.getColumn(i);
                if (c) oldCols.push(c);
              }
              const priorValues: string[][] = [];
              for (let rowIndex = 0; rowIndex < track.getNumSteps(); rowIndex++) {
                const trNote = track.getTrackerNote(rowIndex);
                const rowValues: string[] = [];
                for (let colIndex = 0; colIndex < oldCols.length; colIndex++) {
                  rowValues.push(trNote.getValue(colIndex + 1));
                }
                priorValues.push(rowValues);
              }
              const sourceIndexMap: Array<number | null> = columns.map((columnDef, newIndex) => {
                if (typeof columnDef.sourceIndex === 'number' && Number.isInteger(columnDef.sourceIndex)) {
                  const sourceIndex = columnDef.sourceIndex;
                  return sourceIndex >= 0 && sourceIndex < oldCols.length ? sourceIndex : null;
                }
                if (columnDef.sourceIndex === undefined) {
                  return newIndex >= 0 && newIndex < oldCols.length ? newIndex : null;
                }
                return null;
              });

              oldCols.forEach((c) => track.removeColumn(c));

              columns.forEach((columnDef) => {
                track.addColumn(createTrackerColumnFromSnapshot(columnDef));
              });

              for (let rowIndex = 0; rowIndex < track.getNumSteps(); rowIndex++) {
                const trNote = track.getTrackerNote(rowIndex);
                if (trNote.isOff()) {
                  continue;
                }
                for (let colIndex = 0; colIndex < columns.length; colIndex++) {
                  const sourceIndex = sourceIndexMap[colIndex];
                  if (sourceIndex === null) {
                    continue;
                  }
                  const priorValue = priorValues[rowIndex]?.[sourceIndex] ?? '';
                  if (priorValue.trim().length > 0) {
                    trNote.setValue(colIndex + 1, priorValue);
                  }
                }
              }
            }
          }
        }
        if (p.addTrack !== undefined) {
          const trackList = to.getTracks();
          const newTrack = new Track();
          trackList.addTrack(newTrack);
        }
        if (p.duplicateTrack !== undefined) {
          const trackIdx = p.duplicateTrack as number;
          const track = to.getTracks().getTrack(trackIdx);
          if (track) {
            to.getTracks().addTrack(Track.fromOther(track), trackIdx + 1);
          }
        }
        if (p.clearTrack !== undefined) {
          const trackIdx = p.clearTrack as number;
          const track = to.getTracks().getTrack(trackIdx);
          if (track) {
            track.clearNotes();
          }
        }
        if (p.removeTrack !== undefined) {
          to.getTracks().removeTrack(p.removeTrack as number);
        }
        if (p.trackerAction !== undefined) {
          const action = p.trackerAction as {
            type: string;
            trackIndex: number;
            stepIndex: number;
            columnIndex: number;
            noteBuffer?: Array<Array<{ tied: boolean; off: boolean; fields: string[] }>>;
          };
          const trackList = to.getTracks();
          const track = trackList.getTrack(action.trackIndex);

          if (track) {
            const note = action.stepIndex >= 0 && action.stepIndex < track.getNumSteps()
              ? track.getTrackerNote(action.stepIndex)
              : null;

            switch (action.type) {
              case 'toggleTie':
                if (note && note.isActive() && !note.isOff()) {
                  note.setTied(!note.isTied());
                }
                break;
              case 'clearOrDuplicate':
                if (note) {
                  if (note.isOff() || note.isActive()) {
                    note.clear();
                  } else {
                    for (let i = action.stepIndex - 1; i >= 0; i--) {
                      const prev = track.getTrackerNote(i);
                      if (prev.isActive()) {
                        note.copyValues(prev);
                        break;
                      }
                    }
                  }
                }
                break;
              case 'setNoteOff':
                if (note) {
                  const wasOff = note.isOff();
                  note.clear();
                  note.setOff(!wasOff);
                }
                break;
              case 'incrementValue':
                if (note && action.columnIndex >= 0) {
                  const col = track.getColumn(action.columnIndex + 1);
                  const val = note.getValue(action.columnIndex + 1);
                  if (col && val && val !== '' && val !== '-' && val !== 'OFF') {
                    const newVal = col.getIncrementValue(val);
                    if (newVal !== null) note.setValue(action.columnIndex + 1, newVal);
                  }
                }
                break;
              case 'decrementValue':
                if (note && action.columnIndex >= 0) {
                  const col = track.getColumn(action.columnIndex + 1);
                  const val = note.getValue(action.columnIndex + 1);
                  if (col && val && val !== '' && val !== '-' && val !== 'OFF') {
                    const newVal = col.getDecrementValue(val);
                    if (newVal !== null) note.setValue(action.columnIndex + 1, newVal);
                  }
                }
                break;
              case 'deleteNote':
                if (note) {
                  note.clear();
                }
                break;
              case 'insertNote':
                if (action.stepIndex < track.getNumSteps() - 1) {
                  track.insertNote(action.stepIndex);
                }
                break;
              case 'removeNote':
                track.removeNote(action.stepIndex);
                break;
              case 'cutNotes': {
                const buffer = action.noteBuffer;
                if (buffer && buffer.length > 0) {
                  for (let i = 0; i < buffer.length; i++) {
                    const rowIndex = action.stepIndex + i;
                    if (rowIndex >= track.getNumSteps()) break;
                    const n = track.getTrackerNote(rowIndex);
                    n.clear();
                  }
                }
                break;
              }
              case 'pasteNotes': {
                const buf = action.noteBuffer;
                if (buf && buf.length > 0) {
                  for (let i = 0; i < buf.length; i++) {
                    const destRow = action.stepIndex + i;
                    if (destRow >= track.getNumSteps()) break;
                    const dest = track.getTrackerNote(destRow);
                    const src = buf[i];
                    const sourceNote = src?.[0];
                    if (!sourceNote) {
                      continue;
                    }
                    dest.clear();
                    if (sourceNote.off) {
                      dest.setOff(true);
                    } else {
                      dest.setTied(sourceNote.tied);
                      for (let f = 0; f < sourceNote.fields.length; f++) {
                        dest.setValue(f + 1, sourceNote.fields[f]);
                      }
                    }
                  }
                }
                break;
              }
              case 'setNoteValue':
                if (note && action.columnIndex >= 0) {
                  const col = track.getColumn(action.columnIndex + 1);
                  if (!col) {
                    break;
                  }
                  const buf2 = action.noteBuffer;
                  if (buf2 && buf2[0] && buf2[0][0]) {
                    const nextValue = String(buf2[0][0].fields[0] ?? '').trim();
                    if (!col.isValid(nextValue)) {
                      break;
                    }
                    if (!note.isActive()) {
                      if (nextValue.length === 0) {
                        break;
                      }

                      let previousNote: TrackerNote | null = null;
                      for (let i = action.stepIndex - 1; i >= 0; i--) {
                        const temp = track.getTrackerNote(i);
                        if (temp.isActive()) {
                          previousNote = temp;
                          break;
                        }
                      }

                      if (previousNote) {
                        note.copyValues(previousNote);
                      } else {
                        for (let i = 1; i < track.getNumColumns(); i++) {
                          const defaultCol = track.getColumn(i);
                          if (defaultCol) {
                            note.setValue(i, defaultCol.getDefaultValue());
                          }
                        }
                      }
                    }
                    note.setValue(action.columnIndex + 1, nextValue);
                  }
                }
                break;
            }
          }
        }
        return true;
      }
      if (sObj instanceof AudioClip) {
        const clip = sObj as AudioClip;
        const p = patch.patch;
        if (p.audioFile !== undefined) clip.setAudioFile(p.audioFile as string);
        if (p.fileStartTime !== undefined) clip.setFileStartTime(p.fileStartTime as number);
        if (p.fadeIn !== undefined) clip.setFadeIn(p.fadeIn as number);
        if (p.fadeInType !== undefined) clip.setFadeInType(toBlueDataFadeType(p.fadeInType as string));
        if (p.fadeOut !== undefined) clip.setFadeOut(p.fadeOut as number);
        if (p.fadeOutType !== undefined) clip.setFadeOutType(toBlueDataFadeType(p.fadeOutType as string));
        if (p.looping !== undefined) clip.setLooping(null, p.looping as boolean);
        return true;
      }
      if (sObj instanceof AudioFile) {
        const af = sObj as AudioFile;
        const p = patch.patch;
        if (p.filePath !== undefined) af.setSoundFileName(p.filePath as string);
        if (p.csoundPostCode !== undefined) af.setCsoundPostCode(p.csoundPostCode as string);
        return true;
      }
      if (sObj instanceof FrozenSoundObject) {
        const fso = sObj as FrozenSoundObject;
        const p = patch.patch;
        if (p.filePath !== undefined) fso.setFrozenWaveFileName(p.filePath as string);
        return true;
      }
      if (sObj instanceof PatternObject) {
        const po = sObj as PatternObject;
        const p = patch.patch;
        if (p.beats !== undefined) po.setBeats(p.beats as number);
        if (p.subDivisions !== undefined) po.setSubDivisions(p.subDivisions as number);
        if (Array.isArray(p.patterns)) {
          const newPatterns = p.patterns as Array<{
            patternName: string;
            patternScore: string;
            muted: boolean;
            solo: boolean;
            values: boolean[];
          }>;
          while (po.size() > 0) {
            (po as unknown as { _patterns: Pattern[] })._patterns.pop();
          }
          for (const sp of newPatterns) {
            const np = new Pattern(sp.values.length);
            np.patternName = sp.patternName;
            np.patternScore = sp.patternScore;
            np.muted = sp.muted;
            np.solo = sp.solo;
            np.values = [...sp.values];
            po.addPattern(np);
          }
        }
        if (p.toggleStep !== undefined) {
          const { patternIndex, stepIndex } = p.toggleStep as { patternIndex: number; stepIndex: number };
          if (patternIndex >= 0 && patternIndex < po.size()) {
            const pat = po.getPattern(patternIndex);
            if (stepIndex >= 0 && stepIndex < pat.values.length) {
              pat.values[stepIndex] = !pat.values[stepIndex];
            }
          }
        }
        if (p.updatePatternScore !== undefined) {
          const { patternIndex, patternScore } = p.updatePatternScore as { patternIndex: number; patternScore: string };
          if (patternIndex >= 0 && patternIndex < po.size()) {
            po.getPattern(patternIndex).patternScore = patternScore;
          }
        }
        if (p.updatePatternName !== undefined) {
          const { patternIndex, patternName } = p.updatePatternName as { patternIndex: number; patternName: string };
          if (patternIndex >= 0 && patternIndex < po.size()) {
            po.getPattern(patternIndex).patternName = patternName;
          }
        }
        if (p.toggleMute !== undefined) {
          const idx = p.toggleMute as number;
          if (idx >= 0 && idx < po.size()) {
            po.getPattern(idx).muted = !po.getPattern(idx).muted;
          }
        }
        if (p.toggleSolo !== undefined) {
          const idx = p.toggleSolo as number;
          if (idx >= 0 && idx < po.size()) {
            po.getPattern(idx).solo = !po.getPattern(idx).solo;
          }
        }
        if (p.addPattern !== undefined) {
          const numSteps = po.getBeats() * po.getSubDivisions();
          po.addPattern(new Pattern(numSteps));
        }
        return true;
      }
      if (sObj instanceof ZakLineObject) {
        const zlo = sObj as ZakLineObject;
        const p = patch.patch;
        if (p.zakSpace !== undefined) zlo.setZakSpace(p.zakSpace as number);
        if (Array.isArray(p.lines)) {
          const existingLines = zlo.getLines();
          const newLines = p.lines as Array<{
            channel: number;
            min?: number;
            max?: number;
            resolution?: string;
            color: number;
            rightBound?: boolean;
            endPointsLinked?: boolean;
            points: Array<{ x: number; y: number }>;
          }>;
          (zlo as unknown as { _lines: typeof newLines })._lines = newLines.map((line, index) => ({
            channel: line.channel,
            min: typeof line.min === 'number' ? line.min : existingLines[index]?.min,
            max: typeof line.max === 'number' ? line.max : existingLines[index]?.max,
            resolution: typeof line.resolution === 'string' ? line.resolution : existingLines[index]?.resolution,
            color: line.color,
            rightBound: typeof line.rightBound === 'boolean' ? line.rightBound : existingLines[index]?.rightBound,
            endPointsLinked: typeof line.endPointsLinked === 'boolean' ? line.endPointsLinked : existingLines[index]?.endPointsLinked,
            points: line.points.map(pt => ({ x: pt.x, y: pt.y })),
          }));
        }
        return true;
      }
      if (sObj instanceof LineObject) {
        const lo = sObj as LineObject;
        const p = patch.patch;
        if (p.lines !== undefined) {
          const existingLines = lo.getLines();
          const inner = lo as unknown as { _lines: Array<{
            varName: string;
            min?: number;
            max?: number;
            resolution?: string;
            color: number;
            rightBound?: boolean;
            endPointsLinked?: boolean;
            points: Array<{ x: number; y: number }>;
          }> };
          inner._lines = (p.lines as Array<{
            varName: string;
            min?: number;
            max?: number;
            resolution?: string;
            color: number;
            rightBound?: boolean;
            endPointsLinked?: boolean;
            points: Array<{ x: number; y: number }>;
          }>).map((line, index) => ({
            varName: line.varName,
            min: typeof line.min === 'number' ? line.min : existingLines[index]?.min,
            max: typeof line.max === 'number' ? line.max : existingLines[index]?.max,
            resolution: typeof line.resolution === 'string' ? line.resolution : existingLines[index]?.resolution,
            color: line.color,
            rightBound: typeof line.rightBound === 'boolean' ? line.rightBound : existingLines[index]?.rightBound,
            endPointsLinked: typeof line.endPointsLinked === 'boolean' ? line.endPointsLinked : existingLines[index]?.endPointsLinked,
            points: line.points.map(pt => ({ x: pt.x, y: pt.y })),
          }));
        }
        return true;
      }
      if (sObj instanceof JMask) {
        const jm = sObj as JMask;
        const p = patch.patch;
        if (p.seedUsed !== undefined) jm.setSeedUsed(p.seedUsed as boolean);
        if (p.seed !== undefined) jm.setSeed(p.seed as number);
        if (p.field !== undefined) {
          const nextFieldSnapshot = mergeJMaskSnapshotValue(createJMaskEditorPayload(jm).field, p.field) as Record<string, unknown>;
          jm.setField(loadFieldFromSnapshot(nextFieldSnapshot));
        }
        return true;
      }
      if (sObj instanceof PianoRoll) {
        const pr = sObj as PianoRoll;
        const p = patch.patch;
        if (p.instrumentId !== undefined) pr.setInstrumentId(p.instrumentId as string);
        if (p.noteTemplate !== undefined) pr.setNoteTemplate(p.noteTemplate as string);
        if (p.pchGenerationMethod !== undefined) pr.setPchGenerationMethod(p.pchGenerationMethod as number);
        if (p.transposition !== undefined) pr.setTransposition(p.transposition as number);
        if (p.pixelSecond !== undefined) pr.setPixelSecond(p.pixelSecond as number);
        if (p.noteHeight !== undefined) pr.setNoteHeight(p.noteHeight as number);
        if (p.snapEnabled !== undefined) pr.setSnapEnabled(p.snapEnabled as boolean);
        if (p.snapValue !== undefined && isValidSnapValueName(p.snapValue as string)) {
          pr.setSnapValueEnum(p.snapValue as SnapValueName);
        }
        if (p.scale !== undefined) {
          const scale = createScaleFromSnapshot(p.scale as MidiScaleSnapshot | null);
          if (scale) {
            pr.setScale(scale);
          }
        }
        if (Array.isArray(p.fieldDefinitions)) {
          applyPianoRollFieldDefinitions(pr, p.fieldDefinitions as Array<{
            fieldName: string;
            fieldType: string;
            minValue: number;
            maxValue: number;
            defaultValue: number;
          }>);
        }
        if (p.addFieldDef !== undefined) {
          const fieldDefinitions = getPianoRollFieldDefinitionsSnapshot(pr);
          fieldDefinitions.push(p.addFieldDef as {
            fieldName: string;
            fieldType: string;
            minValue: number;
            maxValue: number;
            defaultValue: number;
          });
          applyPianoRollFieldDefinitions(pr, fieldDefinitions);
        }
        if (p.updateFieldDef !== undefined) {
          const update = p.updateFieldDef as Partial<{
            fieldName: string;
            fieldType: string;
            minValue: number;
            maxValue: number;
            defaultValue: number;
          }> & { index: number };
          const fieldDefinitions = getPianoRollFieldDefinitionsSnapshot(pr);
          if (update.index >= 0 && update.index < fieldDefinitions.length) {
            fieldDefinitions[update.index] = {
              ...fieldDefinitions[update.index]!,
              ...update,
            };
            applyPianoRollFieldDefinitions(pr, fieldDefinitions);
          }
        }
        if (typeof p.removeFieldDef === 'number') {
          const fieldDefinitions = getPianoRollFieldDefinitionsSnapshot(pr).filter((_, index) => index !== p.removeFieldDef);
          applyPianoRollFieldDefinitions(pr, fieldDefinitions);
        }
        if (p.useGlobalRuler !== undefined) pr.setUseGlobalRuler(p.useGlobalRuler as boolean);
        if (p.primaryTimeDisplay !== undefined && isValidTimeBase(p.primaryTimeDisplay)) {
          pr.setPrimaryTimeDisplay(p.primaryTimeDisplay);
        }
        if (p.secondaryTimeDisplay !== undefined && isValidTimeBase(p.secondaryTimeDisplay)) {
          pr.setSecondaryTimeDisplay(p.secondaryTimeDisplay);
        }
        if (p.secondaryRulerEnabled !== undefined) {
          pr.setSecondaryRulerEnabled(p.secondaryRulerEnabled as boolean);
        }

        if (p.pianoRollNoteBatch !== undefined) {
          const batch = p.pianoRollNoteBatch as {
            operations: Array<{
              kind: string;
              noteIndex?: number;
              note?: { octave: number; scaleDegree: number; start: number; duration: number; fieldValues?: number[]; noteTemplate?: string | null };
              notes?: Array<{ octave: number; scaleDegree: number; start: number; duration: number; fieldValues?: number[]; noteTemplate?: string | null }>;
              noteIndices?: number[];
              deltaStart?: number;
              deltaDuration?: number;
              deltaOctave?: number;
              deltaScaleDegree?: number;
            }>;
          };
          const fieldDefs = pr.getFieldDefinitions();
          for (const op of batch.operations) {
            switch (op.kind) {
              case 'add': {
                if (op.note) {
                  const pn = new PianoNote();
                  pn.initFields(fieldDefs);
                  pn.setOctave(op.note.octave);
                  pn.setScaleDegree(op.note.scaleDegree);
                  pn.setStart(op.note.start);
                  pn.setDuration(op.note.duration);
                  if (op.note.noteTemplate !== undefined) pn.setNoteTemplate(op.note.noteTemplate);
                  if (op.note.fieldValues) {
                    const fields = pn.getFields();
                    for (let fi = 0; fi < op.note.fieldValues.length && fi < fields.length; fi++) {
                      fields[fi]!.setValue(op.note.fieldValues[fi]!);
                    }
                  }
                  pr.addNote(pn);
                }
                break;
              }
              case 'addMany': {
                if (op.notes) {
                  for (const noteData of op.notes) {
                    const pn = new PianoNote();
                    pn.initFields(fieldDefs);
                    pn.setOctave(noteData.octave);
                    pn.setScaleDegree(noteData.scaleDegree);
                    pn.setStart(noteData.start);
                    pn.setDuration(noteData.duration);
                    if (noteData.noteTemplate !== undefined) pn.setNoteTemplate(noteData.noteTemplate);
                    if (noteData.fieldValues) {
                      const fields = pn.getFields();
                      for (let fi = 0; fi < noteData.fieldValues.length && fi < fieldDefs.length; fi++) {
                        if (fi < fields.length) {
                          fields[fi]!.setValue(noteData.fieldValues[fi]!);
                        }
                      }
                    }
                    pr.addNote(pn);
                  }
                }
                break;
              }
              case 'remove': {
                if (op.noteIndices) {
                  const sorted = [...op.noteIndices].sort((a, b) => b - a);
                  const notes = pr.getNotes();
                  for (const idx of sorted) {
                    if (idx >= 0 && idx < notes.length) {
                      notes.splice(idx, 1);
                    }
                  }
                  pr.setNotes(notes);
                }
                break;
              }
              case 'move': {
                if (op.noteIndex !== undefined && (op.deltaStart !== undefined || op.deltaOctave !== undefined || op.deltaScaleDegree !== undefined)) {
                  const notes = pr.getNotes();
                  const note = notes[op.noteIndex];
                  if (note) {
                    if (op.deltaStart !== undefined) note.setStart(note.getStart() + op.deltaStart);
                    if (op.deltaOctave !== undefined) note.setOctave(note.getOctave() + op.deltaOctave);
                    if (op.deltaScaleDegree !== undefined) note.setScaleDegree(note.getScaleDegree() + op.deltaScaleDegree);
                    pr.setNotes(notes);
                  }
                }
                break;
              }
              case 'resize': {
                if (op.noteIndex !== undefined && op.deltaDuration !== undefined) {
                  const notes = pr.getNotes();
                  const note = notes[op.noteIndex];
                  if (note) {
                    note.setDuration(Math.max(0.125, note.getDuration() + op.deltaDuration));
                    pr.setNotes(notes);
                  }
                }
                break;
              }
              case 'update': {
                if (op.noteIndex !== undefined && op.note) {
                  const notes = pr.getNotes();
                  const existing = notes[op.noteIndex];
                  if (existing) {
                    if (op.note.octave !== undefined) existing.setOctave(op.note.octave);
                    if (op.note.scaleDegree !== undefined) existing.setScaleDegree(op.note.scaleDegree);
                    if (op.note.start !== undefined) existing.setStart(op.note.start);
                    if (op.note.duration !== undefined) existing.setDuration(op.note.duration);
                    if (op.note.noteTemplate !== undefined) existing.setNoteTemplate(op.note.noteTemplate);
                    if (op.note.fieldValues) {
                      const fields = existing.getFields();
                      for (let fi = 0; fi < op.note.fieldValues.length && fi < fields.length; fi++) {
                        fields[fi]!.setValue(op.note.fieldValues[fi]!);
                      }
                    }
                    pr.setNotes(notes);
                  }
                }
                break;
              }
              case 'replace': {
                if (op.notes) {
                  const newNotes: PianoNote[] = [];
                  for (const noteData of op.notes) {
                    const pn = new PianoNote();
                    pn.initFields(fieldDefs);
                    pn.setOctave(noteData.octave);
                    pn.setScaleDegree(noteData.scaleDegree);
                    pn.setStart(noteData.start);
                    pn.setDuration(noteData.duration);
                    if (noteData.noteTemplate !== undefined) pn.setNoteTemplate(noteData.noteTemplate);
                    if (noteData.fieldValues) {
                      const fields = pn.getFields();
                      for (let fi = 0; fi < noteData.fieldValues.length && fi < fields.length; fi++) {
                        fields[fi]!.setValue(noteData.fieldValues[fi]!);
                      }
                    }
                    newNotes.push(pn);
                  }
                  pr.setNotes(newNotes);
                }
                break;
              }
            }
          }
        }
        return true;
      }
      if (sObj instanceof Sound) {
        const snd = sObj as Sound;
        const p = patch.patch;
        if (p.comment !== undefined) snd.setComment(p.comment as string);

        if (p.bsbInterfacePatch !== undefined) {
          const bsb = parseSoundBSB(snd.getBSBInstrumentText());
          if (bsb) {
            applyBsbInterfacePatch(bsb, p.bsbInterfacePatch as BsbInterfacePatch);
            snd.setBSBInstrumentText(bsb.saveAsXML().toXml());
          }
        }

        if (p.bsbCodePatch !== undefined) {
          const codePatch = p.bsbCodePatch as Record<string, string>;
          const bsb = parseSoundBSB(snd.getBSBInstrumentText());
          if (bsb) {
            if (codePatch.instrumentText !== undefined) bsb.setInstrumentText(codePatch.instrumentText);
            if (codePatch.alwaysOnInstrumentText !== undefined) bsb.setAlwaysOnInstrumentText(codePatch.alwaysOnInstrumentText);
            if (codePatch.globalOrc !== undefined) bsb.setGlobalOrc(codePatch.globalOrc);
            if (codePatch.globalSco !== undefined) bsb.setGlobalSco(codePatch.globalSco);
            snd.setBSBInstrumentText(bsb.saveAsXML().toXml());
          }
        }

        if (p.bsbOpcodeListPatch !== undefined) {
          const bsb = parseSoundBSB(snd.getBSBInstrumentText());
          if (bsb) {
            applyEmbeddedOpcodeListPatch(bsb.getOpcodeList(), p.bsbOpcodeListPatch as EmbeddedOpcodeListPatch);
            snd.setBSBInstrumentText(bsb.saveAsXML().toXml());
          }
        }

        if (p.automationPatch !== undefined) {
          const autoPatch = p.automationPatch as {
            parameterId: string;
            automationEnabled?: boolean;
            points?: Array<{ x: number; y: number }>;
            curve?: string;
          };
          const bsb = parseSoundBSB(snd.getBSBInstrumentText());
          if (bsb) {
            const params = bsb.getParameters();
            const param = params.find(
              (pr: BlueDataParameter) => pr.getUniqueId() === autoPatch.parameterId || pr.getName() === autoPatch.parameterId,
            );
            if (param) {
              if (autoPatch.automationEnabled !== undefined) param.setAutomationEnabled(autoPatch.automationEnabled);
              if (autoPatch.points !== undefined) {
                param.setPoints(autoPatch.points.map((pt: { x: number; y: number }) => ({ time: pt.x, value: pt.y })));
              }
              if (autoPatch.curve !== undefined) {
                const curveKey = autoPatch.curve as keyof typeof BlueDataAutomationCurve;
                if (curveKey in BlueDataAutomationCurve) {
                  param.setCurve(BlueDataAutomationCurve[curveKey]);
                }
              }
            }
            snd.setBSBInstrumentText(bsb.saveAsXML().toXml());
          }
        }

        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

function validateTempoMapSnapshot(map: TempoMapSnapshot): boolean {
  if (!map.points || map.points.length === 0) return false;
  if (map.points[0].beat !== 0) return false;
  for (const p of map.points) {
    if (!isFinite(p.beat) || p.beat < 0) return false;
    if (!isFinite(p.tempo) || p.tempo <= 0) return false;
    if (p.curveType !== 'constant' && p.curveType !== 'linear') return false;
    if (p.timeBase !== undefined && !isValidTimeBase(p.timeBase)) return false;
  }
  for (let i = 1; i < map.points.length; i++) {
    if (map.points[i].beat <= map.points[i - 1].beat) return false;
  }
  return true;
}

function tempoPointTimeBase(point: Pick<TempoPointSnapshot, 'timeBase'>): TimeBase {
  return isValidTimeBase(point.timeBase) ? point.timeBase : TimeBase.BEATS;
}

function applyTempoMapPatch(data: BlueData, tempoPatch: TempoMapPatch): boolean {
  const context = data.getScore().getTimeContext();
  const tempoMap = context.getTempoMap();

  switch (tempoPatch.type) {
    case 'setTempoEnabled': {
      if (tempoMap.isEnabled() !== tempoPatch.enabled) {
        tempoMap.setEnabled(tempoPatch.enabled);
        return true;
      }
      return false;
    }
    case 'setTempoVisible': {
      if (tempoMap.isVisible() !== tempoPatch.visible) {
        tempoMap.setVisible(tempoPatch.visible);
        return true;
      }
      return false;
    }
    case 'addTempoPoint': {
      const p = tempoPatch.point;
      if (!isFinite(p.beat) || p.beat < 0 || !isFinite(p.tempo) || p.tempo <= 0) return false;
      const existing = tempoMap.getTempoPoints();
      for (const ep of existing) {
        if (Math.abs(ep.beat - p.beat) < 0.001) return false;
      }
      const ct = p.curveType === 'constant' ? CurveType.CONSTANT : CurveType.LINEAR;
      tempoMap.addTempoPoint(
        new TempoPoint(beatsToTimePosition(p.beat, tempoPointTimeBase(p), context), p.tempo, ct),
        context,
      );
      return true;
    }
    case 'updateTempoPoint': {
      const idx = tempoPatch.index;
      if (idx < 0 || idx >= tempoMap.size()) return false;
      const pt = tempoPatch.patch;
      const current = tempoMap.getTempoPoint(idx);
      const newBeat = pt.beat ?? current.beat;
      const newTempo = pt.tempo ?? current.tempo;
      const newCurve = pt.curveType
        ? (pt.curveType === 'constant' ? CurveType.CONSTANT : CurveType.LINEAR)
        : current.curveType;
      const newTimeBase = isValidTimeBase(pt.timeBase) ? pt.timeBase : current.position.getTimeBase();

      if (Math.abs(current.beat) < 0.001 && Math.abs(newBeat) >= 0.001) return false;
      if (!isFinite(newTempo) || newTempo <= 0) return false;

      if (idx > 0) {
        const prev = tempoMap.getTempoPoint(idx - 1);
        if (newBeat <= prev.beat) return false;
      }
      if (idx < tempoMap.size() - 1) {
        const next = tempoMap.getTempoPoint(idx + 1);
        if (newBeat >= next.beat) return false;
      }

      tempoMap.setTempoPoint(idx, beatsToTimePosition(newBeat, newTimeBase, context), newTempo, newCurve, context);
      return true;
    }
    case 'setTempoCurveType': {
      const idx = tempoPatch.index;
      if (idx < 0 || idx >= tempoMap.size()) return false;
      const newCurve = tempoPatch.curveType === 'constant' ? CurveType.CONSTANT : CurveType.LINEAR;
      if (tempoMap.getCurveType(idx) === newCurve) return false;
      const pt = tempoMap.getTempoPoint(idx);
      tempoMap.setTempoPoint(idx, pt.position, pt.tempo, newCurve, context);
      return true;
    }
    case 'removeTempoPoint': {
      const idx = tempoPatch.index;
      if (idx < 0 || idx >= tempoMap.size()) return false;
      if (tempoMap.size() <= 1) return false;
      if (Math.abs(tempoMap.getBeat(idx)) < 0.001) return false;
      tempoMap.removeTempoPoint(idx);
      return true;
    }
    case 'replaceTempoMap': {
      if (!validateTempoMapSnapshot(tempoPatch.map)) return false;
      const source = new TempoMap();
      source.setEnabled(tempoPatch.map.enabled);
      source.setVisible(tempoPatch.map.visible);
      source.reset();
      const points = tempoPatch.map.points.map(
        (p) => new TempoPoint(
          beatsToTimePosition(p.beat, tempoPointTimeBase(p), context),
          p.tempo,
          p.curveType === 'constant' ? CurveType.CONSTANT : CurveType.LINEAR,
        ),
      );
      source.setTempoPoint(0, points[0].position, points[0].tempo, points[0].curveType, context);
      for (let i = 1; i < points.length; i++) {
        source.addTempoPoint(points[i], context);
      }
      tempoMap.replaceAll(source);
      tempoMap.recalculateBeatPositions(context);
      return true;
    }
    default:
      return false;
  }
}

function validateMeterEntryInput(entry: MeterEntryInput): boolean {
  if (!Number.isInteger(entry.measure) || entry.measure < 1) return false;
  if (!Number.isInteger(entry.numBeats) || entry.numBeats < 1) return false;
  if (!Number.isInteger(entry.beatLength) || entry.beatLength < 1) return false;
  return true;
}

function validateMeterMapEntries(entries: MeterEntryInput[]): boolean {
  if (entries.length === 0) return false;
  if (entries[0].measure !== 1) return false;
  for (const entry of entries) {
    if (!validateMeterEntryInput(entry)) return false;
  }
  const measures = entries.map((e) => e.measure);
  const unique = new Set(measures);
  if (unique.size !== measures.length) return false;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].measure <= entries[i - 1].measure) return false;
  }
  return true;
}

function isMeterDependentTimeBase(timeBase: TimeBase): boolean {
  return timeBase === TimeBase.BBT
    || timeBase === TimeBase.BBST
    || timeBase === TimeBase.BBF;
}

function isCloseBeatValue(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

function beatsToDurationAtReferenceBeat(
  beats: number,
  targetBase: TimeBase,
  context: TimeContext,
  referenceBeat: number,
): TimeDuration {
  const fallback = beatsToDuration(beats, targetBase, context);
  if (!isMeterDependentTimeBase(targetBase)) {
    return fallback;
  }

  const meter = context.getMeterMap().getMeterAtBeat(Math.max(0, referenceBeat));
  const beatsPerMeasure = meter.getBeatsPerMeasure();
  const beatScale = meter.getBeatScale();
  const ppq = 960;
  let bars = Math.floor(beats / beatsPerMeasure);
  let remaining = beats - bars * beatsPerMeasure;
  let beat = Math.floor(remaining / beatScale);
  let fractionalBeat = remaining - beat * beatScale;
  let candidate: TimeDuration;

  switch (targetBase) {
    case TimeBase.BBT: {
      let ticks = Math.round(fractionalBeat * ppq / beatScale);
      if (ticks >= ppq) {
        ticks = 0;
        beat += 1;
      }
      if (beat >= meter.numBeats) {
        bars += Math.floor(beat / meter.numBeats);
        beat = beat % meter.numBeats;
      }
      candidate = TimeDuration.bbt(bars, beat, ticks);
      break;
    }
    case TimeBase.BBST: {
      let totalTicks = Math.round((fractionalBeat / beatScale) * ppq);
      if (totalTicks >= ppq) {
        totalTicks = 0;
        beat += 1;
      }
      if (beat >= meter.numBeats) {
        bars += Math.floor(beat / meter.numBeats);
        beat = beat % meter.numBeats;
      }
      const ticksPerSixteenth = ppq / 4;
      const sixteenth = Math.floor(totalTicks / ticksPerSixteenth);
      const ticks = totalTicks % ticksPerSixteenth;
      candidate = TimeDuration.bbst(bars, beat, sixteenth, ticks);
      break;
    }
    case TimeBase.BBF: {
      let fraction = Math.round(fractionalBeat * 100 / beatScale);
      if (fraction >= 100) {
        fraction = 0;
        beat += 1;
      }
      if (beat >= meter.numBeats) {
        bars += Math.floor(beat / meter.numBeats);
        beat = beat % meter.numBeats;
      }
      candidate = TimeDuration.bbf(bars, beat, fraction);
      break;
    }
    default:
      return fallback;
  }

  return isCloseBeatValue(candidate.toBeats(context), beats) ? candidate : fallback;
}

function isScoreObjectLike(value: unknown): value is BlueDataScoreObject {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<BlueDataScoreObject>;
  return typeof candidate.getStartTime === 'function'
    && typeof candidate.setStartTime === 'function'
    && typeof candidate.getSubjectiveDuration === 'function'
    && typeof candidate.setSubjectiveDuration === 'function';
}

function reencodeScoreObjectForMeterMapChange(
  sObj: BlueDataScoreObject,
  oldContext: TimeContext,
  newContext: TimeContext,
): void {
  const startTime = sObj.getStartTime();
  const startBeats = startTime.toBeats(oldContext);
  const startTimeBase = startTime.getTimeBase();
  if (isMeterDependentTimeBase(startTimeBase)) {
    sObj.setStartTime(beatsToTimePosition(startBeats, startTimeBase, newContext));
  }

  const duration = sObj.getSubjectiveDuration();
  const durationBase = duration.getTimeBase();
  if (isMeterDependentTimeBase(durationBase)) {
    const durationBeats = duration.toBeats(oldContext);
    sObj.setSubjectiveDuration(beatsToDurationAtReferenceBeat(durationBeats, durationBase, newContext, startBeats));
  }

  if (sObj instanceof AbstractSoundObject || sObj instanceof PolyObject) {
    const repeatPoint = sObj.getRepeatPoint();
    const repeatPointBase = repeatPoint?.getTimeBase();
    if (repeatPoint && repeatPointBase && isMeterDependentTimeBase(repeatPointBase)) {
      const repeatPointBeats = repeatPoint.toBeats(oldContext);
      sObj.setRepeatPoint(beatsToDurationAtReferenceBeat(repeatPointBeats, repeatPointBase, newContext, startBeats));
    }
  }
}

function reencodeLayerGroupScoreObjectsForMeterMapChange(
  layerGroup: unknown,
  oldContext: TimeContext,
  newContext: TimeContext,
): void {
  if (!Array.isArray(layerGroup)) return;

  for (const layer of layerGroup) {
    if (!Array.isArray(layer)) continue;

    for (const candidate of layer) {
      if (!isScoreObjectLike(candidate)) continue;

      reencodeScoreObjectForMeterMapChange(candidate, oldContext, newContext);

      if (candidate instanceof PolyObject) {
        reencodeLayerGroupScoreObjectsForMeterMapChange(candidate, oldContext, newContext);
      }
    }
  }
}

function reencodeScoreObjectsForMeterMapChange(data: BlueData, oldContext: TimeContext): void {
  const score = data.getScore();
  const newContext = score.getTimeContext();

  for (const layerGroup of score) {
    reencodeLayerGroupScoreObjectsForMeterMapChange(layerGroup, oldContext, newContext);
  }
}

function applyMeterMapPatch(data: BlueData, meterPatch: MeterMapPatch): boolean {
  const context = data.getScore().getTimeContext();
  const oldContext = new TimeContext(context);
  const meterMap = context.getMeterMap();
  let changed = false;

  switch (meterPatch.type) {
    case 'meter-map-set-entry': {
      if (!validateMeterEntryInput(meterPatch)) break;
      const pair = new MeasureMeterPair(meterPatch.measure, new Meter(meterPatch.numBeats, meterPatch.beatLength));
      meterMap.add(pair);
      changed = true;
      break;
    }
    case 'meter-map-update-entry': {
      if (!validateMeterEntryInput(meterPatch)) break;
      const prevMeasure = meterPatch.previousMeasure;
      let entryIndex = -1;
      for (let i = 0; i < meterMap.size(); i++) {
        if (meterMap.get(i).measure === prevMeasure) {
          entryIndex = i;
          break;
        }
      }
      if (entryIndex < 0) break;
      if (entryIndex === 0 && meterPatch.measure !== 1) break;
      if (entryIndex > 0) {
        const prev = meterMap.get(entryIndex - 1);
        if (meterPatch.measure <= prev.measure) break;
      }
      if (entryIndex < meterMap.size() - 1) {
        const next = meterMap.get(entryIndex + 1);
        if (meterPatch.measure >= next.measure) break;
      }
      const pair = new MeasureMeterPair(meterPatch.measure, new Meter(meterPatch.numBeats, meterPatch.beatLength));
      meterMap.set(entryIndex, pair);
      changed = true;
      break;
    }
    case 'meter-map-remove-entry': {
      if (meterPatch.measure <= 1) break;
      let entryIndex = -1;
      for (let i = 0; i < meterMap.size(); i++) {
        if (meterMap.get(i).measure === meterPatch.measure) {
          entryIndex = i;
          break;
        }
      }
      if (entryIndex <= 0 || entryIndex >= meterMap.size()) break;
      if (meterMap.size() <= 1) break;
      const source = new MeterMap();
      for (let i = 0; i < meterMap.size(); i++) {
        if (i !== entryIndex) {
          const e = meterMap.get(i);
          source.add(new MeasureMeterPair(e.measure, new Meter(e.meter.numBeats, e.meter.beatLength)));
        }
      }
      meterMap.replaceAll(source);
      changed = true;
      break;
    }
    case 'meter-map-replace': {
      if (!validateMeterMapEntries(meterPatch.entries)) break;
      const source = new MeterMap();
      for (const entry of meterPatch.entries) {
        source.add(new MeasureMeterPair(entry.measure, new Meter(entry.numBeats, entry.beatLength)));
      }
      meterMap.replaceAll(source);
      changed = true;
      break;
    }
    default:
      break;
  }

  if (!changed) return false;

  context.getTempoMap().recalculateBeatPositions(context);
  reencodeScoreObjectsForMeterMapChange(data, oldContext);
  return true;
}

export function applyProjectDocumentPatch(
  data: BlueData,
  patch: ProjectDocumentPatch,
  context?: ProjectDocumentPatchContext,
): boolean {
  let changed = false;

  if (patch.globalOrc !== undefined) {
    data.getGlobalOrcSco().setGlobalOrc(patch.globalOrc);
    changed = true;
  }

  if (patch.globalSco !== undefined) {
    data.getGlobalOrcSco().setGlobalSco(patch.globalSco);
    changed = true;
  }

  if (patch.tablesText !== undefined) {
    data.getTableSet().setTables(patch.tablesText);
    changed = true;
  }

  if (patch.projectUdo) {
    changed = applyProjectUdoPatch(data, patch.projectUdo) || changed;
  }

  if (patch.projectProperties) {
    changed =
      applyProjectPropertiesPatch(
        data.getProjectProperties(),
        patch.projectProperties,
      ) || changed;
  }

  if (patch.clojureProject) {
    changed = applyClojureProjectPatch(data, patch.clojureProject) || changed;
  }

  if (patch.orchestra) {
    const arrangement = data.getArrangement();
    const orchestraPatch = patch.orchestra;

    switch (orchestraPatch.type) {
      case 'addInstrument':
        arrangement.addInstrument(
          createInstrumentForType(orchestraPatch.instrumentType),
          undefined,
        );
        changed = true;
        break;
      case 'removeAssignment':
        changed = arrangement.removeInstrumentById(orchestraPatch.assignmentId) !== null || changed;
        break;
      case 'duplicateAssignment': {
        const current = arrangement.getInstrumentById(orchestraPatch.sourceAssignmentId);
        if (current) {
          arrangement.addInstrument(current.deepCopy(), undefined);
          changed = true;
        }
        break;
      }
      case 'pasteInstrument':
        arrangement.addInstrument(createInstrumentFromSnapshot(orchestraPatch.instrument), undefined);
        changed = true;
        break;
      case 'updateAssignment': {
        const oldId = orchestraPatch.assignmentId;
        const newId = orchestraPatch.nextAssignmentId?.trim();
        changed =
          arrangement.updateAssignment(oldId, {
            enabled: orchestraPatch.enabled,
            nextArrangementId: newId,
          }) || changed;
        if (newId && newId !== oldId) {
          const channel = data.getMixer().getAllSourceChannels().find(
            (ch) => ch.getAssociation().trim() === oldId,
          );
          if (channel) {
            channel.setAssociation(newId);
            channel.setName(newId);
          }
        }
        break;
      }
      case 'replaceInstrument':
        changed =
          arrangement.replaceInstrument(
            orchestraPatch.assignmentId,
            createInstrumentForType(orchestraPatch.instrumentType),
          ) || changed;
        break;
      case 'convertGenericToBsb': {
        const current = arrangement.getInstrumentById(orchestraPatch.assignmentId);
        if (current instanceof GenericInstrument) {
          changed =
            arrangement.replaceInstrument(
              orchestraPatch.assignmentId,
              convertGenericToBsb(current),
            ) || changed;
        }
        break;
      }
      case 'updateInstrument': {
        const instrument = arrangement.getInstrumentById(orchestraPatch.assignmentId);
        if (instrument) {
          changed = applyInstrumentPatch(instrument, orchestraPatch.patch) || changed;
        }
        break;
      }
      case 'updateInstrumentComment': {
        const instrument = arrangement.getInstrumentById(orchestraPatch.assignmentId);
        if (instrument && instrument.getComment() !== orchestraPatch.comment) {
          instrument.setComment(orchestraPatch.comment);
          changed = true;
        }
        break;
      }
    }
  }

  if (patch.mixer) {
    changed = applyMixerPatchToData(data, patch.mixer) || changed;
  }

  if (patch.transport) {
    if (patch.transport.renderStartTime !== undefined && data.getRenderStartTime() !== patch.transport.renderStartTime) {
      data.setRenderStartTime(patch.transport.renderStartTime);
      changed = true;
    }

    if (patch.transport.renderEndTime !== undefined && data.getRenderEndTime() !== patch.transport.renderEndTime) {
      data.setRenderEndTime(patch.transport.renderEndTime);
      changed = true;
    }

    if (patch.transport.loopRendering !== undefined && data.isLoopRendering() !== patch.transport.loopRendering) {
      data.setLoopRendering(patch.transport.loopRendering);
      changed = true;
    }

    if (patch.transport.tempoMap?.enabled !== undefined) {
      data.getScore().getTimeContext().getTempoMap().setEnabled(patch.transport.tempoMap.enabled);
      changed = true;
    }

    if (patch.transport.tempoMap?.visible !== undefined) {
      data.getScore().getTimeContext().getTempoMap().setVisible(patch.transport.tempoMap.visible);
      changed = true;
    }

    if (patch.transport.tempoMapPatch) {
      changed = applyTempoMapPatch(data, patch.transport.tempoMapPatch) || changed;
    }

    if (patch.transport.meterMapPatch) {
      changed = applyMeterMapPatch(data, patch.transport.meterMapPatch) || changed;
    }
  }

  if (patch.blueLive) {
    changed = applyBlueLivePatch(data, patch.blueLive) || changed;
  }

  if (patch.midiInput) {
    changed = applyMidiInputPatch(data, patch.midiInput) || changed;
  }

  if (patch.score) {
    changed = applyScoreObjectPatch(data, patch.score, context) || changed;
  }

  if (patch.orchestra || patch.mixer || (patch.score && scorePatchTouchesMixerAudioChannels(patch.score))) {
    changed = reconcileMixerWithArrangement(data) || changed;
  }

  return changed;
}

function applyProjectUdoPatch(data: BlueData, patch: ProjectUdoPatch): boolean {
  const opcodeList = data.getOpcodeList();

  switch (patch.type) {
    case 'add': {
      const udo = patch.definition
        ? snapshotToUdo(patch.definition)
        : new OpcodeDefinition();
      const index = patch.index ?? opcodeList.size();
      opcodeList.addOpcodeAt(index, udo);
      return true;
    }
    case 'remove': {
      return opcodeList.removeOpcodeAt(patch.index);
    }
    case 'update': {
      const existing = opcodeList.getOpcode(patch.index);
      if (!existing) return false;
      if (patch.patch.name !== undefined) existing.setName(patch.patch.name);
      if (patch.patch.style !== undefined) existing.setStyle(patch.patch.style as UDOStyle);
      if (patch.patch.outTypes !== undefined) existing.setOutTypes(patch.patch.outTypes);
      if (patch.patch.inTypes !== undefined) existing.setInTypes(patch.patch.inTypes);
      if (patch.patch.inputArguments !== undefined) existing.setInputArguments(patch.patch.inputArguments);
      if (patch.patch.code !== undefined) existing.setCode(patch.patch.code);
      if (patch.patch.comments !== undefined) existing.setComments(patch.patch.comments);
      return true;
    }
    case 'reorder': {
      return opcodeList.moveOpcode(patch.from, patch.to);
    }
    case 'convertStyle': {
      const udo = opcodeList.getOpcode(patch.index);
      if (!udo) return false;
      if (patch.style === 'MODERN') {
        convertToModern(udo);
      } else {
        convertToClassic(udo);
      }
      return true;
    }
  }
}

function snapshotToUdo(snapshot: UdoDefinitionSnapshot): OpcodeDefinition {
  const udo = new OpcodeDefinition();
  udo.setName(snapshot.name);
  udo.setStyle(snapshot.style as UDOStyle);
  udo.setOutTypes(snapshot.outTypes);
  udo.setInTypes(snapshot.inTypes);
  udo.setInputArguments(snapshot.inputArguments);
  udo.setCode(snapshot.code);
  udo.setComments(snapshot.comments);
  return udo;
}

function createEffectFromXml(effectXml: string): Effect {
  return Effect.loadFromXML(Element.parse(effectXml));
}

function generateUniqueSubChannelName(existingNames: ReadonlySet<string>): string {
  let index = existingNames.size + 1;
  while (true) {
    const name = `SubChannel${index}`;
    if (!existingNames.has(name)) {
      return name;
    }
    index++;
  }
}

export function findMixerChannelById(mixer: Mixer, channelId: string): Channel | null {
  if (channelId === 'master') {
    return mixer.getMaster();
  }

  const sourceChannel = mixer.getAllSourceChannels().find(
    (channel) => channel.getAssociation() === channelId || getMixerChannelSnapshotId(channel) === channelId,
  );
  if (sourceChannel) {
    return sourceChannel;
  }

  const subChannel = mixer.getSubChannels().find(
    (channel) => getMixerChannelSnapshotId(channel) === channelId,
  );
  if (subChannel) {
    return subChannel;
  }

  return null;
}

function reconcileSubChannelName(mixer: Mixer, oldName: string, newName: string): void {
  const allChannels = [mixer.getMaster(), ...mixer.getAllSourceChannels(), ...mixer.getSubChannels()];

  for (const channel of allChannels) {
    if (channel.getOutChannel() === oldName) {
      channel.setOutChannel(newName);
    }

    for (const entry of [...channel.getPreEffects(), ...channel.getPostEffects()]) {
      if (entry instanceof Send && entry.getSendChannel() === oldName) {
        entry.setSendChannel(newName);
      }
    }
  }
}

function reconcileSubChannelRemoved(mixer: Mixer, removedName: string): void {
  const allChannels = [mixer.getMaster(), ...mixer.getAllSourceChannels(), ...mixer.getSubChannels()];

  for (const channel of allChannels) {
    if (channel.getOutChannel() === removedName) {
      channel.setOutChannel(Channel.MASTER);
    }

    for (const entry of [...channel.getPreEffects(), ...channel.getPostEffects()]) {
      if (entry instanceof Send && entry.getSendChannel() === removedName) {
        entry.setSendChannel(Channel.MASTER);
      }
    }
  }
}

function findMixerChainForChannel(
  mixer: Mixer,
  channelId: string,
  chain: MixerChainKind,
): Array<Effect | Send> | null {
  const channel = findMixerChannelById(mixer, channelId);
  if (!channel) {
    return null;
  }

  if (channel === mixer.getMaster()) {
    return chain === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
  }

  if (mixer.getSubChannels().includes(channel)) {
    return chain === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
  }

  return chain === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
}

export function applyEffectEditablePatchToEffect(
  effect: Effect,
  patch: EffectEditablePatch,
): boolean {
  let changed = false;

  if (patch.effectXml !== undefined) {
    const loaded = createEffectFromXml(patch.effectXml);
    effect.setName(loaded.getName());
    effect.setEnabled(loaded.isEnabled());
    effect.setNumIns(loaded.getNumIns());
    effect.setNumOuts(loaded.getNumOuts());
    effect.setStyle(loaded.getStyle());
    effect.setCode(loaded.getCode());
    effect.setComments(loaded.getComments());
    effect.getGraphicInterface().loadFromXML(loaded.getGraphicInterface().saveAsXML());
    effect.getOpcodeList().clear();
    effect.getOpcodeList().addAll(loaded.getOpcodeList());
    changed = true;
  }

  if (patch.name !== undefined && effect.getName() !== patch.name) {
    effect.setName(patch.name);
    changed = true;
  }
  if (patch.enabled !== undefined && effect.isEnabled() !== patch.enabled) {
    effect.setEnabled(patch.enabled);
    changed = true;
  }
  if (patch.numIns !== undefined && effect.getNumIns() !== patch.numIns) {
    effect.setNumIns(patch.numIns);
    changed = true;
  }
  if (patch.numOuts !== undefined && effect.getNumOuts() !== patch.numOuts) {
    effect.setNumOuts(patch.numOuts);
    changed = true;
  }
  if (patch.style !== undefined && effect.getStyle() !== patch.style) {
    effect.setStyle(patch.style as UDOStyle);
    changed = true;
  }
  if (patch.code !== undefined && effect.getCode() !== patch.code) {
    effect.setCode(patch.code);
    changed = true;
  }
  if (patch.comments !== undefined && effect.getComments() !== patch.comments) {
    effect.setComments(patch.comments);
    changed = true;
  }
  if (patch.bsbInterface) {
    const temp = new BlueSynthBuilder();
    temp.setGraphicInterface(effect.getGraphicInterface());
    temp.setOpcodeList(effect.getOpcodeList());
    changed = applyBsbInterfacePatch(temp, patch.bsbInterface) || changed;
    syncEffectParametersFromWidgets(effect);
  }
  if (patch.opcodeList) {
    changed = applyEmbeddedOpcodeListPatch(effect.getOpcodeList(), patch.opcodeList) || changed;
  }

  return changed;
}

function syncEffectParametersFromWidgets(effect: Effect): void {
  const params = effect.getParameters();
  const gi = effect.getGraphicInterface();
  const rootGroup = gi.getRootGroup();

  const findParam = (name: string) => params.find((p) => p.getName() === name);

  const visit = (widgets: BSBWidget[]) => {
    for (const widget of widgets) {
      if (widget instanceof BSBGroup) {
        visit(widget.getChildren());
        continue;
      }
      if (!widget.objectName) continue;

      if (widget instanceof BSBXYController) {
        const px = findParam(`${widget.objectName}X`);
        const py = findParam(`${widget.objectName}Y`);
        if (px) px.setFixedValue(widget.xValue);
        if (py) py.setFixedValue(widget.yValue);
      } else if (widget instanceof BSBDropdown) {
        const param = findParam(widget.objectName);
        if (param) param.setFixedValue(widget.selectedIndex);
      } else {
        const param = findParam(widget.objectName);
        if (param) param.setFixedValue(widget.value);
      }
    }
  };

  visit(rootGroup.getChildren());
}

function applyMixerChannelEditablePatch(
  channel: Channel,
  patch: Partial<MixerChannelEditableFields>,
  nameAlreadyApplied = false,
): boolean {
  let changed = false;

  if (!nameAlreadyApplied && patch.name !== undefined && channel.getName() !== patch.name) {
    channel.setName(patch.name);
    changed = true;
  }
  if (patch.outChannel !== undefined && channel.getOutChannel() !== patch.outChannel) {
    channel.setOutChannel(patch.outChannel);
    changed = true;
  }
  if (patch.muted !== undefined && channel.isMuted() !== patch.muted) {
    channel.setMuted(patch.muted);
    changed = true;
  }
  if (patch.solo !== undefined && channel.isSolo() !== patch.solo) {
    channel.setSolo(patch.solo);
    changed = true;
  }
  if (patch.level !== undefined && channel.getLevel() !== patch.level) {
    channel.setLevel(patch.level);
    changed = true;
  }
  if (patch.volume !== undefined && channel.getVolume() !== patch.volume) {
    channel.setVolume(patch.volume);
    changed = true;
  }
  if (patch.pan !== undefined && channel.getPan() !== patch.pan) {
    channel.setPan(patch.pan);
    changed = true;
  }

  return changed;
}

function applyMixerPatchToChain(
  chain: Array<Effect | Send>,
  patch: MixerPatch,
  preferredEntryId?: string,
): boolean {
  switch (patch.type) {
    case 'addEffectFromLibrary': {
      const effectXml = patch.effectXml;
      if (!effectXml) {
        return false;
      }
      const effect = createEffectFromXml(effectXml);
      getMixerEntrySnapshotId(effect, patch.entryId ?? preferredEntryId);
      const insertIndex = patch.insertIndex ?? chain.length;
      chain.splice(Math.min(Math.max(insertIndex, 0), chain.length), 0, effect);
      return true;
    }
    case 'addSend': {
      const send = new Send();
      if (patch.sendChannel !== undefined) {
        send.setSendChannel(patch.sendChannel);
      }
      if (patch.level !== undefined) {
        send.setLevel(patch.level);
      }
      if (preferredEntryId || patch.entryId) {
        getMixerEntrySnapshotId(send, patch.entryId ?? preferredEntryId);
      }
      const insertIndex = patch.insertIndex ?? chain.length;
      chain.splice(Math.min(Math.max(insertIndex, 0), chain.length), 0, send);
      return true;
    }
    case 'updateSend': {
      const index = chain.findIndex(
        (entry) => entry instanceof Send && getMixerEntrySnapshotId(entry) === patch.entryId,
      );
      if (index < 0) {
        return false;
      }
      const send = chain[index] as Send;
      let changed = false;
      if (patch.patch.sendChannel !== undefined && send.getSendChannel() !== patch.patch.sendChannel) {
        send.setSendChannel(patch.patch.sendChannel);
        changed = true;
      }
      if (patch.patch.level !== undefined && send.getLevel() !== patch.patch.level) {
        send.setLevel(patch.patch.level);
        changed = true;
      }
      if (patch.patch.enabled !== undefined && send.isEnabled() !== patch.patch.enabled) {
        send.setEnabled(patch.patch.enabled);
        changed = true;
      }
      return changed;
    }
    case 'updateEffect': {
      const index = chain.findIndex(
        (entry) => entry instanceof Effect && getMixerEntrySnapshotId(entry) === patch.entryId,
      );
      if (index < 0) {
        return false;
      }

      const current = chain[index] as Effect;
      if (patch.patch.effectXml !== undefined) {
        const nextEffect = createEffectFromXml(patch.patch.effectXml);
        getMixerEntrySnapshotId(nextEffect, patch.entryId);
        chain[index] = nextEffect;
        return true;
      }

      return applyEffectEditablePatchToEffect(current, patch.patch);
    }
    case 'removeChainEntry': {
      const index = chain.findIndex((entry) => getMixerEntrySnapshotId(entry) === patch.entryId);
      if (index < 0) {
        return false;
      }
      chain.splice(index, 1);
      return true;
    }
    case 'reorderChainEntry': {
      if (
        patch.from < 0 ||
        patch.to < 0 ||
        patch.from >= chain.length ||
        patch.to >= chain.length ||
        patch.from === patch.to
      ) {
        return false;
      }

      const [moved] = chain.splice(patch.from, 1);
      chain.splice(patch.to, 0, moved);
      return true;
    }
    case 'duplicateChainEntry': {
      const dupIndex = chain.findIndex((entry) => getMixerEntrySnapshotId(entry) === patch.entryId);
      if (dupIndex < 0) return false;
      const original = chain[dupIndex];
      if (original instanceof Effect) {
        const clone = createEffectFromXml(original.saveAsXML().toXml());
        getMixerEntrySnapshotId(clone, crypto.randomUUID());
        chain.splice(dupIndex + 1, 0, clone);
      } else if (original instanceof Send) {
        const clone = new Send();
        clone.setSendChannel(original.getSendChannel());
        clone.setLevel(original.getLevel());
        clone.setEnabled(original.isEnabled());
        getMixerEntrySnapshotId(clone, crypto.randomUUID());
        chain.splice(dupIndex + 1, 0, clone);
      }
      return true;
    }
    case 'copyChainEntry': {
      return true;
    }
    case 'pasteChainEntries': {
      const insertIndex = patch.index ?? chain.length;
      for (let i = 0; i < patch.payload.entries.length; i++) {
        const entry = patch.payload.entries[i];
        if (entry.kind === 'effect') {
          const effect = createEffectFromXml(entry.effectXml);
          getMixerEntrySnapshotId(effect, entry.entryId + '-paste-' + i);
          chain.splice(Math.min(insertIndex + i, chain.length), 0, effect);
        } else if (entry.kind === 'send') {
          const send = new Send();
          send.setSendChannel(entry.sendChannel);
          send.setLevel(entry.level);
          send.setEnabled(entry.enabled);
          getMixerEntrySnapshotId(send, entry.entryId + '-paste-' + i);
          chain.splice(Math.min(insertIndex + i, chain.length), 0, send);
        }
      }
      return true;
    }
    default:
      return false;
  }
}

function applyMixerPatchToData(data: BlueData, patch: MixerPatch): boolean {
  const mixer = data.getMixer();

  switch (patch.type) {
    case 'setMixerEnabled':
      if (mixer.isEnabled() !== patch.value) {
        mixer.setEnabled(patch.value);
        return true;
      }
      return false;
    case 'updateExtraRenderTime':
      if (mixer.getExtraRenderTime() !== patch.value) {
        mixer.setExtraRenderTime(patch.value);
        return true;
      }
      return false;
    case 'renameChannelListGroup': {
      const targetAssociation = patch.association.trim();
      const nextName = patch.name.trim();
      if (targetAssociation.length === 0 || nextName.length === 0) {
        return false;
      }

      let changed = false;

      const group = mixer
        .getChannelListGroups()
        .find((candidate) => (candidate.getAssociation()?.trim() ?? '') === targetAssociation);
      if (group && group.getListName() !== nextName) {
        group.setListName(nextName);
        changed = true;
      }

      const trackLayerGroup = findTrackLayerGroupByAssociation(data, targetAssociation);
      if (trackLayerGroup && trackLayerGroup.getName() !== nextName) {
        trackLayerGroup.setName(nextName);
        changed = true;
      }

      return changed;
    }
    case 'updateChannel': {
      const channel = findMixerChannelById(mixer, patch.channelId);
      if (!channel) {
        return false;
      }

      let changed = false;

      if (patch.patch.name !== undefined) {
        const oldName = channel.getName();
        const isSubChannel = mixer.getSubChannels().includes(channel);
        if (channel.getName() !== patch.patch.name) {
          channel.setName(patch.patch.name);
          changed = true;
          if (isSubChannel) {
            reconcileSubChannelName(mixer, oldName, patch.patch.name);
          }
        }

        const track = findTrackByAssociation(data, channel.getAssociation());
        if (track && track.getName() !== patch.patch.name) {
          track.setName(patch.patch.name);
          changed = true;
        }
      }

      return applyMixerChannelEditablePatch(channel, patch.patch, true) || changed;
    }
    case 'addSubChannel': {
      const nextChannel = new Channel();
      const existingNames = new Set(mixer.getSubChannels().map((ch) => ch.getName()));
      nextChannel.setName(patch.name ?? generateUniqueSubChannelName(existingNames));
      nextChannel.setAssociation('');
      getMixerChannelSnapshotId(nextChannel, patch.channelId);
      const insertIndex =
        patch.insertIndex === undefined
          ? mixer.getSubChannels().length
          : Math.min(Math.max(patch.insertIndex, 0), mixer.getSubChannels().length);
      mixer.getSubChannels().splice(insertIndex, 0, nextChannel);
      return true;
    }
    case 'removeSubChannel': {
      const index = mixer.getSubChannels().findIndex(
        (channel) => getMixerChannelSnapshotId(channel) === patch.channelId,
      );
      if (index < 0) {
        return false;
      }
      const removedName = mixer.getSubChannels()[index].getName();
      mixer.getSubChannels().splice(index, 1);
      reconcileSubChannelRemoved(mixer, removedName);
      return true;
    }
    case 'addEffectFromLibrary':
    case 'addSend':
    case 'updateSend':
    case 'updateEffect':
    case 'removeChainEntry':
    case 'reorderChainEntry':
    case 'duplicateChainEntry':
    case 'copyChainEntry':
    case 'pasteChainEntries': {
      const chain = findMixerChainForChannel(mixer, patch.channelId, patch.chain);
      if (!chain) {
        return false;
      }
      return applyMixerPatchToChain(
        chain,
        patch,
        'entryId' in patch ? patch.entryId : undefined,
      );
    }
    case 'moveChainEntryAcrossChains': {
      const fromChain = findMixerChainForChannel(mixer, patch.fromChannelId, patch.fromChain);
      if (!fromChain) return false;
      const fromIndex = fromChain.findIndex((entry) => getMixerEntrySnapshotId(entry) === patch.entryId);
      if (fromIndex < 0) return false;
      const [removed] = fromChain.splice(fromIndex, 1);
      const toChain = findMixerChainForChannel(mixer, patch.toChannelId, patch.toChain);
      if (!toChain) {
        fromChain.splice(fromIndex, 0, removed);
        return false;
      }
      const insertIndex = patch.index ?? toChain.length;
      toChain.splice(Math.min(Math.max(insertIndex, 0), toChain.length), 0, removed);
      return true;
    }
  }
}

export function reconcileMixerSnapshotWithArrangement(
  mixer: MixerSnapshot,
  orchestra: OrchestraSnapshot,
): MixerSnapshot {
  const nextChannels: MixerChannelSnapshot[] = [];
  const existingByAssociation = new Map(
    mixer.channels
      .filter((channel) => channel.association)
      .map((channel) => [channel.association!, channel] as const),
  );
  const fallbackChannels = mixer.channels.filter((channel) => !channel.association);
  let fallbackIndex = 0;

  for (const row of orchestra.arrangement.rows) {
    const existing = existingByAssociation.get(row.assignmentId) ?? fallbackChannels[fallbackIndex++];
    if (existing) {
      nextChannels.push({
        ...existing,
        association: row.assignmentId,
        channelKind: 'instrument' as MixerChannelKind,
      });
    } else {
      nextChannels.push({
        id: row.assignmentId,
        name: row.instrumentName,
        channelKind: 'instrument' as MixerChannelKind,
        association: row.assignmentId,
        outChannel: Mixer.MASTER_CHANNEL,
        muted: false,
        solo: false,
        level: 0,
        volume: 1,
        pan: 0.5,
        preChain: [],
        postChain: [],
      });
    }
  }

  const nextSubChannels = mixer.subChannels.map((channel) => ({
    ...channel,
    channelKind: 'subChannel' as MixerChannelKind,
  }));

  const nextChannelListGroups = mixer.channelListGroups.map((group) => ({
    ...group,
    channels: group.channels.map((channel) => ({
      ...channel,
      channelKind: 'instrument' as MixerChannelKind,
    })),
  }));

  return {
    ...mixer,
    channelListGroups: nextChannelListGroups,
    channels: nextChannels,
    subChannels: nextSubChannels,
    master: {
      ...mixer.master,
      channelKind: 'master' as MixerChannelKind,
    },
  };
}

interface TrackMixerChannelDescriptor {
  association: string;
  name: string;
}

interface TrackMixerChannelListDescriptor {
  association: string;
  listName: string;
  channels: TrackMixerChannelDescriptor[];
}

function collectTrackMixerChannelListDescriptors(
  data: BlueData,
): TrackMixerChannelListDescriptor[] {
  const descriptors: TrackMixerChannelListDescriptor[] = [];

  for (let index = 0; index < data.getScore().length; index += 1) {
    const group = data.getScore()[index];
    if (!(group instanceof TrackLayerGroup)) {
      continue;
    }

    const channelDescriptors: TrackMixerChannelDescriptor[] = [];
    for (let layerIndex = 0; layerIndex < group.length; layerIndex += 1) {
      const layer = group[layerIndex];
      channelDescriptors.push({
        association: layer.getUniqueId(),
        name: layer.getName(),
      });
    }

    descriptors.push({
      association: group.getUniqueId(),
      listName: group.getName(),
      channels: channelDescriptors,
    });
  }

  return descriptors;
}

function indexFirstByAssociation<T>(
  entries: readonly T[],
  getAssociation: (entry: T) => string | null | undefined,
): Map<string, T> {
  const indexed = new Map<string, T>();
  for (const entry of entries) {
    const association = getAssociation(entry)?.trim() ?? '';
    if (association && !indexed.has(association)) indexed.set(association, entry);
  }
  return indexed;
}

function reconcileTrackChannelListGroups(
  current: MixerSnapshot,
  descriptors: TrackMixerChannelListDescriptor[],
): MixerChannelListSnapshot[] {
  const existingByAssociation = indexFirstByAssociation(
    current.channelListGroups,
    (group) => group.association,
  );
  const fallbackGroups = current.channelListGroups.filter((group) => !group.association);
  let fallbackGroupIndex = 0;

  return descriptors.map((descriptor) => {
    const existingGroup =
      existingByAssociation.get(descriptor.association) ??
      fallbackGroups[fallbackGroupIndex++];
    const existingChannelsByAssociation = indexFirstByAssociation(
      existingGroup?.channels ?? [],
      (channel) => channel.association,
    );
    const fallbackChannels = existingGroup?.channels.filter((channel) => !channel.association) ?? [];
    let fallbackChannelIndex = 0;

    const channels = descriptor.channels.map((channelDescriptor) => {
      const existingChannel =
        existingChannelsByAssociation.get(channelDescriptor.association) ??
        fallbackChannels[fallbackChannelIndex++];
      if (existingChannel) {
        return {
          ...existingChannel,
          channelKind: 'instrument' as MixerChannelKind,
          name: channelDescriptor.name,
          association: channelDescriptor.association,
        };
      }

      return {
        id: channelDescriptor.association,
        name: channelDescriptor.name,
        channelKind: 'instrument' as MixerChannelKind,
        association: channelDescriptor.association,
        outChannel: Mixer.MASTER_CHANNEL,
        muted: false,
        solo: false,
        level: 0,
        volume: 1,
        pan: 0.5,
        preChain: [],
        postChain: [],
      };
    });

    return {
      association: descriptor.association,
      listName: descriptor.listName,
      listNameEditSupported: true,
      channels,
    };
  });
}

function getMixerSourceChannelSnapshots(mixer: MixerSnapshot): MixerChannelSnapshot[] {
  const groupedChannels = mixer.channelListGroups.flatMap((group) => group.channels);
  return [...groupedChannels, ...mixer.channels];
}

function findTrackByAssociation(
  data: BlueData,
  association: string | null | undefined,
): TrackLayer | null {
  const targetAssociation = association?.trim() ?? '';
  if (!targetAssociation) return null;
  for (const group of data.getScore()) {
    if (!(group instanceof TrackLayerGroup)) continue;
    const track = group.find((candidate) => candidate.getUniqueId() === targetAssociation);
    if (track) return track;
  }
  return null;
}

function findTrackLayerGroupByAssociation(
  data: BlueData,
  association: string | null | undefined,
): TrackLayerGroup | null {
  const targetAssociation = association?.trim() ?? '';
  if (!targetAssociation) return null;
  return data.getScore().find(
    (group): group is TrackLayerGroup => group instanceof TrackLayerGroup && group.getUniqueId() === targetAssociation,
  ) ?? null;
}

export function reconcileMixerWithArrangement(data: BlueData): boolean {
  const mixer = data.getMixer();
  const orchestra = createOrchestraSnapshot(data);
  const currentSnapshot = createMixerSnapshot(mixer);
  const reconciled = reconcileMixerSnapshotWithArrangement(currentSnapshot, orchestra);
  const reconciledWithGroups: MixerSnapshot = {
    ...reconciled,
    channelListGroups: reconcileTrackChannelListGroups(
      currentSnapshot,
      collectTrackMixerChannelListDescriptors(data),
    ),
  };

  const sourceChannels = mixer.getAllSourceChannels();
  const sourceByAssociation = indexFirstByAssociation(
    sourceChannels,
    (channel) => channel.getAssociation(),
  );
  const sourceFallbackChannels = sourceChannels.filter(
    (channel) => channel.getAssociation().trim().length === 0,
  );
  let sourceFallbackIndex = 0;
  const reconciledSourceSnapshots = getMixerSourceChannelSnapshots(reconciledWithGroups);
  let changed =
    mixer.isEnabled() !== reconciledWithGroups.enabled ||
    mixer.getExtraRenderTime() !== reconciledWithGroups.extraRenderTime ||
    sourceChannels.length !== reconciledSourceSnapshots.length ||
    mixer.getChannelListGroups().length !== reconciledWithGroups.channelListGroups.length ||
    mixer.getChannels().length !== reconciledWithGroups.channels.length ||
    mixer.getSubChannels().length !== reconciledWithGroups.subChannels.length ||
    mixer.getMaster().getName() !== reconciledWithGroups.master.name ||
    mixer.getMaster().getOutChannel() !== reconciledWithGroups.master.outChannel ||
    mixer.getMaster().isMuted() !== reconciledWithGroups.master.muted ||
    mixer.getMaster().isSolo() !== reconciledWithGroups.master.solo ||
    mixer.getMaster().getLevel() !== reconciledWithGroups.master.level ||
    mixer.getMaster().getVolume() !== reconciledWithGroups.master.volume ||
    mixer.getMaster().getPan() !== reconciledWithGroups.master.pan;
  const nextSourceChannels = reconciledSourceSnapshots.map((snapshot) => {
    const current =
      (snapshot.association
        ? sourceByAssociation.get(snapshot.association)
        : undefined) ?? sourceFallbackChannels[sourceFallbackIndex++];

    const next = current ?? new Channel();
    if (
      !current ||
      current.getAssociation().trim() !== (snapshot.association ?? '') ||
      current.getName() !== snapshot.name ||
      current.getOutChannel() !== snapshot.outChannel ||
      current.isMuted() !== snapshot.muted ||
      current.isSolo() !== snapshot.solo ||
      current.getLevel() !== snapshot.level ||
      current.getVolume() !== snapshot.volume ||
      current.getPan() !== snapshot.pan
    ) {
      changed = true;
    }
    next.setAssociation(snapshot.association ?? '');
    next.setName(snapshot.name);
    next.setOutChannel(snapshot.outChannel);
    next.setMuted(snapshot.muted);
    next.setSolo(snapshot.solo);
    next.setLevel(snapshot.level);
    next.setVolume(snapshot.volume);
    next.setPan(snapshot.pan);
    return next;
  });

  const nextChannelListGroups = reconciledWithGroups.channelListGroups.map((groupSnapshot, index) => {
    const currentGroup = mixer.getChannelListGroups()[index];
    const nextGroup = new ChannelList();
    const targetAssociation = groupSnapshot.association?.trim() ?? '';
    nextGroup.setAssociation(targetAssociation.length > 0 ? targetAssociation : null);
    nextGroup.setListName(groupSnapshot.listName);
    nextGroup.setListNameEditSupported(groupSnapshot.listNameEditSupported);
    if (
      !currentGroup ||
      (currentGroup.getAssociation()?.trim() ?? '') !== targetAssociation ||
      currentGroup.getListName() !== groupSnapshot.listName ||
      currentGroup.isListNameEditSupported() !== groupSnapshot.listNameEditSupported ||
      currentGroup.length !== groupSnapshot.channels.length
    ) {
      changed = true;
    }
    const groupStart = reconciledWithGroups.channelListGroups
      .slice(0, index)
      .reduce((count, group) => count + group.channels.length, 0);
    const groupEnd = groupStart + groupSnapshot.channels.length;
    const groupChannels = nextSourceChannels.slice(groupStart, groupEnd);
    nextGroup.push(...groupChannels);
    return nextGroup;
  });

  const nextFlatChannels = nextSourceChannels.slice(
    reconciledWithGroups.channelListGroups.reduce((count, group) => count + group.channels.length, 0),
  );

  const nextSubChannels = reconciledWithGroups.subChannels.map((snapshot, index) => {
    const current = mixer.getSubChannels()[index] ?? new Channel();
    if (
      !mixer.getSubChannels()[index] ||
      current.getName() !== snapshot.name ||
      current.getOutChannel() !== snapshot.outChannel ||
      current.isMuted() !== snapshot.muted ||
      current.isSolo() !== snapshot.solo ||
      current.getLevel() !== snapshot.level ||
      current.getVolume() !== snapshot.volume ||
      current.getPan() !== snapshot.pan
    ) {
      changed = true;
    }
    current.setName(snapshot.name);
    current.setOutChannel(snapshot.outChannel);
    current.setMuted(snapshot.muted);
    current.setSolo(snapshot.solo);
    current.setLevel(snapshot.level);
    current.setVolume(snapshot.volume);
    current.setPan(snapshot.pan);
    return current;
  });

  if (changed) {
    mixer.setEnabled(reconciledWithGroups.enabled);
    mixer.setExtraRenderTime(reconciledWithGroups.extraRenderTime);
    mixer.clearChannelListGroups();
    mixer.getChannelListGroups().push(...nextChannelListGroups);
    mixer.getChannels().splice(0, mixer.getChannels().length, ...nextFlatChannels);
    mixer.getSubChannels().splice(0, mixer.getSubChannels().length, ...nextSubChannels);
    mixer.getMaster().setName(reconciledWithGroups.master.name);
    mixer.getMaster().setOutChannel(reconciledWithGroups.master.outChannel);
    mixer.getMaster().setMuted(reconciledWithGroups.master.muted);
    mixer.getMaster().setSolo(reconciledWithGroups.master.solo);
    mixer.getMaster().setLevel(reconciledWithGroups.master.level);
    mixer.getMaster().setVolume(reconciledWithGroups.master.volume);
    mixer.getMaster().setPan(reconciledWithGroups.master.pan);
  }

  return changed;
}

export function isEmptyProjectDocumentPatch(patch: ProjectDocumentPatch): boolean {
  const hasProjectProperties =
    patch.projectProperties !== undefined &&
    Object.keys(patch.projectProperties).length > 0;
  const hasTransport =
    patch.transport !== undefined &&
    Object.keys(patch.transport).length > 0;
  const hasOrchestra =
    patch.orchestra !== undefined &&
    Object.keys(patch.orchestra).length > 0;
  const hasProjectUdo =
    patch.projectUdo !== undefined &&
    Object.keys(patch.projectUdo).length > 0;
  const hasBlueLive =
    patch.blueLive !== undefined &&
    Object.keys(patch.blueLive).length > 0;
  const hasMidiInput = patch.midiInput !== undefined;
  const hasMixer = patch.mixer !== undefined;
  const hasScore = patch.score !== undefined && isNonEmptyScorePatch(patch.score);

  return (
    patch.globalOrc === undefined &&
    patch.globalSco === undefined &&
    patch.tablesText === undefined &&
    !hasProjectProperties &&
    !hasTransport &&
    !hasOrchestra &&
    !hasProjectUdo &&
    !hasBlueLive &&
    !hasMidiInput &&
    !hasMixer &&
    !hasScore
  );
}

export function createNestedPolyObjectSnapshot(
  data: BlueData,
  location: ScoreObjectLocationRef,
): PolyObjectLayerGroupSnapshot | null {
  const score = data.getScore();
  const context = score.getTimeContext();
  const arrangement = data.getArrangement();
  const mixer = data.getMixer();
  const allParameters = ParameterHelper.getAllParameters(
    arrangement,
    mixer,
  );
  const assignedLayerMap = buildAssignedAutomationLayerMap(score);
  const lg = score[location.rootGroupIndex];
  if (!lg || !(lg instanceof PolyObject)) return null;

  let container: PolyObject = lg;
  for (const segment of location.containerPath) {
    const containerLayer = container[segment.layerIndex];
    if (!containerLayer) return null;
    const nested = containerLayer[segment.objectIndex];
    if (!(nested instanceof PolyObject)) return null;
    container = nested;
  }

  const layer = container[location.layerIndex];
  if (!layer) return null;

  const sObj = layer[location.objectIndex];
  if (!(sObj instanceof PolyObject)) return null;

  const parentPath: ScoreObjectLocationRef = {
    rootGroupIndex: location.rootGroupIndex,
    containerPath: [...location.containerPath, { layerIndex: location.layerIndex, objectIndex: location.objectIndex }],
    layerIndex: 0,
    objectIndex: 0,
  };

  const groupId = assignLayerGroupId(sObj);
  const layers: ScoreLayerSnapshot[] = [];

  for (let i = 0; i < sObj.length; i++) {
    const subLayer = sObj[i];
    const layerId = `${groupId}-layer-${i}`;
    const items: ScoreRowObjectSnapshot[] = [];
    for (let j = 0; j < subLayer.length; j++) {
      const nestedObj = subLayer[j];
      const itemLocation: ScoreObjectLocationRef = {
        ...parentPath,
        layerIndex: i,
        objectIndex: j,
      };
      const objectId = assignScoreObjectId(nestedObj, 'sobj');
      items.push({
        objectId,
        objectType: nestedObj.constructor.name,
        name: nestedObj.getName(),
        startBeats: nestedObj.getStartTime().toBeats(context),
        durationBeats: nestedObj.getSubjectiveDuration().toBeats(context),
        startTimeBase: String(nestedObj.getStartTime().getTimeBase()),
        durationTimeBase: String(nestedObj.getSubjectiveDuration().getTimeBase()),
        backgroundColor: nestedObj.getBackgroundColor(),
        isContainer: nestedObj instanceof PolyObject,
        editorTarget: buildEditorTargetSnapshot(nestedObj, objectId, itemLocation),
        barRenderer: nestedObj instanceof AbstractSoundObject
          ? createBarRendererForSoundObject(nestedObj, context)
          : { kind: 'fallback' as const, labelLines: splitLabelLines(nestedObj.getName()), reason: 'unknown-type' as const },
      });
    }
    const elsewhereMap = buildAssignedElsewhereMapForLayer(layerId, assignedLayerMap);
    const automation = collectLayerAutomationSnapshot(
      layerId,
      'soundObject',
      subLayer,
      allParameters,
      elsewhereMap,
      groupId,
      arrangement,
      mixer,
    );
    layers.push({
      layerId,
      name: subLayer.getName(),
      height: subLayer.getLayerHeight(),
      muted: subLayer.isMuted(),
      solo: subLayer.isSolo(),
      items,
      noteProcessorChain: subLayer.getNoteProcessorChain().getProcessors().length > 0
        ? createNoteProcessorChainSnapshot(subLayer.getNoteProcessorChain())
        : undefined,
      automation,
    });
  }

  const groupChain = sObj.getNoteProcessorChain();

  return {
    groupId,
    groupType: 'polyObject',
    name: sObj.getName(),
    layerCount: sObj.length,
    isOpenableContainer: true,
    layers,
    noteProcessorChain: groupChain.getProcessors().length > 0 ? createNoteProcessorChainSnapshot(groupChain) : undefined,
  };
}
