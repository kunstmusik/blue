import {
  BlueData,
  Channel,
  ChannelList,
  BlueSynthBuilder,
  BlueX7,
  cloneBlueX7Voice,
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
  FadeType,
  ObjectBuilder,
  ScratchPadData,
  getTrackPlacementForSoundObject,
  getNotes as parseScoreNotes,
  createNoteProcessorChainSnapshot as createNoteProcessorChainSnapshotFromData,
  reifyChainFromSnapshot,
  getProjectParameterCatalog,
  getBlueX7Descriptor,
} from '@blue/data';
import type { NoteProcessorChainSnapshot as DataNoteProcessorChainSnapshot, Parameter as BlueDataParameter, ScoreObject as BlueDataScoreObject, AutomatableLayer as BlueDataAutomatableLayer, Arrangement as BlueDataArrangement, Mixer as BlueDataMixer, ProjectParameterEntry } from '@blue/data';
import { AutomationCurve as BlueDataAutomationCurve, LineColors } from '@blue/data';
import { ParameterHelper } from '@blue/data';
import type { SnapValueName, BlueX7Voice, BlueX7Common, BlueX7Lfo, BlueX7Operator, BlueX7EnvelopePoint } from '@blue/data';
import type { MissingAudioAssetsSession } from '../missing-audio-assets';
import type { ScoreInsertionLocation } from '../unified-library';

import { moveRangeWithAnchors, scaleRangeWithAnchors } from '../automation-range-math';
import {
  BSB_LINE_SELECTOR_HEIGHT,
  getBsbWidgetDisplaySize,
} from '../bsb-widget-layout';
import {
  collectBsbReplacementKeysFromSnapshotTree,
  collectBsbReplacementKeysFromWidgetTree,
  getBsbReplacementKeysFromSnapshot,
  getBsbReplacementKeysFromWidget,
  getDerivedKeysFromSnapshot,
  getDerivedKeysFromWidget,
} from '../bsb-widget-keys';

import type {
  ScoreTimeStateSnapshot,
  MarkerSnapshot,
  AudioFadeType,
  ScoreObjectBarRendererSnapshot,
  GenericBarRendererSnapshot,
  CommentBarRendererSnapshot,
  LetterBarRendererSnapshot,
  PianoRollBarRendererSnapshot,
  AudioFileBarRendererSnapshot,
  FrozenSoundObjectBarRendererSnapshot,
  AudioClipBarRendererSnapshot,
  FallbackBarRendererSnapshot,
  ScoreRowObjectSnapshot,
  ScoreLayerSnapshot,
  AutomationLayerKind,
  AutomationTargetSourceKind,
  AutomationPointSnapshot,
  AutomationParameterSnapshot,
  AutomationAssignmentState,
  AutomationTargetSnapshot,
  AutomationTargetGroupSnapshot,
  ScoreLayerAutomationSnapshot,
  ScoreLayerGroupType,
  PolyObjectLayerGroupSnapshot,
  TrackInstrumentSummary,
  TrackSnapshot,
  TrackLayerGroupSnapshot,
  PatternSourceObjectSnapshot,
  PatternLayerSnapshot,
  PatternsLayerGroupSnapshot,
  ScoreLayerGroupSnapshot,
  ScoreDocumentSnapshot,
  ScoreObjectLocationRef,
  ScoreObjectLibraryEntryRef,
  BlueLiveScoreObjectRef,
  PatternSourceObjectLocationRef,
  ScoreObjectEditorTargetSnapshot,
  TimeConversionMeterEntry,
  TimeConversionContext,
  TimeValueSnapshot,
  NoteProcessorEntrySnapshot,
  NoteProcessorChainSnapshot,
  NamedChainListSnapshot,
  SharedScoreObjectPropertiesSnapshot,
  TrackerColumnSnapshot,
  AudioFileMetadataStatus,
  AudioFileMetadataState,
  AudioFileMetadataSnapshot,
  AudioFileSelectionResult,
  FrozenSoundObjectSaveCopyResult,
  TypeSpecificScoreObjectEditorSnapshot,
  JMaskEditorPayload,
  ScoreObjectEditorDocumentSnapshot,
  ScoreObjectEditorRequest,
  ScoreObjectTestResult,
  TrackRef,
  TrackItemRef,
  TrackItemMove,
  TrackItemResize,
  TrackItemTransfer,
  TrackScorePatch,
  PatternCellEdit,
  PatternScorePatch,
  ScorePatch,
  ScoreAutomationLayerRef,
  AutomationRangeRef,
  AssignAutomationToLayerPatch,
  RemoveAutomationFromLayerPatch,
  MoveAutomationToLayerPatch,
  ClearLayerAutomationsPatch,
  SelectLayerAutomationPatch,
  SetAutomationLineColorPatch,
  SetAutomationPointsPatch,
  InsertAutomationPointPatch,
  DeleteAutomationPointPatch,
  MoveAutomationPointPatch,
  SetAutomationResolutionPatch,
  MoveAutomationRangePatch,
  ScaleAutomationRangePatch,
  CleanupLayerAutomationPatch,
  ScoreAutomationPatch,
  TempoCurveTypeSnapshot,
  TempoPointSnapshot,
  TempoMapSnapshot,
  TempoMapPatch,
  MeterEntryInput,
  MeterMapPatch,
  MeterSnapshot,
  MeterMapSnapshot,
  ToolbarProjectTransportSnapshot,
  PlaybackClockSnapshot,
  ProjectPropertiesSnapshot,
  ClojureLibraryEntrySnapshot,
  ClojureProjectSnapshot,
  LiveObjectCellSnapshot,
  BlueLiveSoundObjectType,
  LiveObjectBinsSnapshot,
  LiveObjectSetSnapshot,
  BlueLiveProjectSnapshot,
  MidiScaleSnapshot,
  MidiInputProcessorSnapshot,
  MixerChannelKind,
  MixerChainKind,
  EffectSnapshot,
  EffectEditorSnapshot,
  EffectEditorRequest,
  EffectEditorPatchRequest,
  ProjectEffectRef,
  LibraryEffectRef,
  MixerEffectEntrySnapshot,
  MixerSendEntrySnapshot,
  MixerChainEntrySnapshot,
  MixerChannelSnapshot,
  MixerChannelListSnapshot,
  MixerSnapshot,
  MixerChannelEditableFields,
  EffectEditablePatch,
  MixerEffectPatch,
  MixerFollowUpPatch,
  MixerChainClipboardPayload,
  MixerPatch,
  EffectsLibraryCategorySnapshot,
  LibraryEffectSnapshot,
  EffectsLibrarySnapshot,
  EffectsLibraryPatch,
  MidiInputPatch,
  BlueLiveNoteTarget,
  BlueLiveNoteTriggerRequest,
  BlueLiveNoteTriggerResult,
  LayerIndexRange,
  BlueLivePatch,
  ProjectEditorSnapshot,
  ProjectSummarySnapshot,
  ProjectDocumentPatch,
  ScratchPadSnapshot,
  ScratchPadPatch,
  ProjectDocumentCommitReceipt,
  ProjectDocumentPatchContext,
  LegacyBlueLiveTriggerRequest,
  LegacyBlueLiveTriggerStatus,
  LegacyBlueLiveTriggerErrorCode,
  LegacyBlueLiveTriggerResult,
  BsbRealtimeControlKind,
  BsbRealtimeControlTarget,
  BsbRealtimeControlUpdate,
  MixerRealtimeLevelUpdate,
  EffectRealtimeUpdate,
  SupportedNewInstrumentType,
  InstrumentSnapshot,
  InstrumentSnapshotBase,
  GenericInstrumentSnapshot,
  JavaScriptInstrumentSnapshot,
  PythonInstrumentSnapshot,
  BlueX7Patch,
  BlueX7InstrumentSnapshot,
  BlueSynthBuilderInstrumentSnapshot,
  UdoDefinitionSnapshot,
  EmbeddedOpcodeListPatch,
  ProjectUdoPatch,
  BsbWidgetSnapshot,
  GridSettingsSnapshot,
  BsbWidgetNodeSnapshot,
  PresetGroupSnapshot,
  PresetSnapshot,
  BsbInterfacePatch,
  SoundEditorTab,
  SoundAutomationParameterSnapshot,
  SoundEditorPayload,
  UnknownInstrumentSnapshot,
  ArrangementRowSnapshot,
  ArrangementSnapshot,
  TemporaryInstrumentLibrarySnapshot,
  OrchestraSnapshot,
  InstrumentPatch,
  TrackInstrumentEditorRequest,
  TrackInstrumentEditorSnapshot,
  TrackInstrumentEditorPatchRequest,
  TrackInstrumentEditorPatchStatus,
  TrackInstrumentEditorPatchResult,
  OrchestraPatch,
  ProjectLoadedPayload,
} from './contract';
import {
  BLUE_LIVE_SOUND_OBJECT_TYPES,
  isBlueLiveSoundObjectType,
  isValidLayerRange,
  isValidLayerRangeTarget,
  areLayerRangesValid,
  validateLegacyBlueLiveTriggerRequest,
  createBsbRealtimeControlUpdate,
  isBsbRealtimeControlUpdate,
  isValidBlueX7Voice,
  isValidBlueX7Patch,
} from './contract';
import {
  assignExplicitScoreObjectId,
  assignLayerGroupId,
  assignLayerSelectionId,
  assignPatternLayerId,
  assignScoreObjectId,
  getScoreObjectId,
  getTrackInstrumentOwnerIdentity,
} from './identity';
import {
  buildSoundAutomationParameters,
  parseSoundBSB,
} from './bsb-widgets';
import {
  buildObjectBuilderBsbInstrumentSnapshot,
  createBlueLiveProjectSnapshot,
  createClojureProjectSnapshot,
  createEmptyMeterMapSnapshot,
  createEmptyMixerSnapshot,
  createEmptyOrchestraSnapshot,
  createEmptyTempoMapSnapshot,
  createEmptyToolbarProjectTransportSnapshot,
  createInstrumentSnapshot,
  createMidiInputProcessorSnapshot,
  createMixerSnapshot,
  createOrchestraSnapshot,
  createProjectPropertiesSnapshot,
  createProjectUdoListSnapshot,
  createToolbarProjectTransportSnapshot,
  getInstrumentSnapshotType,
  reconcileMixerWithArrangement,
  buildSoundBSBInstrumentSnapshot,
  createJMaskEditorPayload,
  createJMaskPayloadSummary,
  createTrackerColumnSnapshot,
} from './snapshot-mixer-orchestra';

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

export function createEmptyScratchPadSnapshot(): ScratchPadSnapshot {
  return {
    text: '',
    wordWrapEnabled: true,
  };
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
    scratchPad: createEmptyScratchPadSnapshot(),
    projectUdos: [],
    loaded: false,
    score: createEmptyScoreDocumentSnapshot(),
    namedChains: { names: [] },
  };
}


const JAVA_NEWLINE_RE = /\\n/g;

export function splitLabelLines(name: string): string[] {
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

export function createBarRendererForSoundObject(
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

export function createBarRendererForAudioClip(
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



export function resolveTimelineScoreObjects(
  data: BlueData,
  objectIds: readonly string[],
): BlueDataScoreObject[] | null {
  if (
    objectIds.length === 0
    || objectIds.some((id) => id.trim().length === 0)
    || new Set(objectIds).size !== objectIds.length
  ) return null;
  const wanted = new Set(objectIds);
  const found = new Map<string, BlueDataScoreObject>();

  const visitPolyObject = (polyObject: PolyObject): void => {
    for (const layer of polyObject) {
      for (const object of layer) {
        const id = getScoreObjectId(object);
        if (id && wanted.has(id)) found.set(id, object);
        if (object instanceof PolyObject) visitPolyObject(object);
      }
    }
  };

  for (const layerGroup of data.getScore()) {
    if (layerGroup instanceof PolyObject) {
      visitPolyObject(layerGroup);
      continue;
    }
    if (layerGroup instanceof TrackLayerGroup) {
      for (const track of layerGroup) {
        for (const object of track) {
          const id = getScoreObjectId(object);
          if (id && wanted.has(id)) found.set(id, object);
        }
      }
    }
  }

  if (found.size !== wanted.size) return null;
  return objectIds.map((id) => found.get(id)!);
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

  const projectParameterCatalog = getProjectParameterCatalog(data);
  const allParameters = projectParameterCatalog.map((entry) => entry.parameter);
  const assignedLayerMap = buildAssignedAutomationLayerMap(score);

  for (let i = 0; i < score.length; i++) {
    const lg = score[i];
    if (!lg) continue;

    if (lg instanceof PolyObject) {
      result.push(createPolyObjectGroupSnapshot(lg, context, i, allParameters, arrangement, mixer, assignedLayerMap, projectParameterCatalog));
    } else if (lg instanceof TrackLayerGroup) {
      result.push(createTrackLayerGroupSnapshot(lg, context, i, allParameters, arrangement, mixer, assignedLayerMap, projectParameterCatalog));
    } else if (lg instanceof PatternsLayerGroup) {
      result.push(createPatternsLayerGroupSnapshot(lg, context));
    }
  }

  return result;
}

function createPolyObjectGroupSnapshot(lg: PolyObject, context: TimeContext, rootGroupIndex: number, allParameters: BlueDataParameter[], arrangement: BlueDataArrangement, mixer: BlueDataMixer, assignedLayerMap: Map<string, { layerId: string; layerName: string }>, projectParameterCatalog: readonly ProjectParameterEntry[]): PolyObjectLayerGroupSnapshot {
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
      projectParameterCatalog,
    );
    layers.push({
      layerId,
      layerSelectionId: assignLayerSelectionId(layer),
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
  projectParameterCatalog: readonly ProjectParameterEntry[],
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
      projectParameterCatalog,
    );
    const instrument = layer.getInstrument();
    const instrumentType = instrument ? getInstrumentSnapshotType(instrument) : 'unknown';
    layers.push({
      layerKind: 'track',
      layerId,
      layerSelectionId: assignLayerSelectionId(layer),
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
            : createInstrumentSnapshot(
              layerId,
              instrument,
              instrument.isEnabled(),
              getTrackInstrumentOwnerIdentity(groupId, layerId),
            ),
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

/** Display-only fallback when the raw canonical step length is malformed. */
const PATTERN_BEATS_LENGTH_FALLBACK = 4;

function collectActivePatternCellIndices(layer: PatternLayer): number[] {
  const patternData = layer.getPatternData();
  const indices: number[] = [];
  const maxSelected = patternData.getMaxSelected();
  for (let i = 0; i <= maxSelected; i++) {
    if (patternData.isPatternSet(i)) indices.push(i);
  }
  return indices;
}

function createPatternsLayerGroupSnapshot(lg: PatternsLayerGroup, context: TimeContext): PatternsLayerGroupSnapshot {
  const groupId = assignLayerGroupId(lg);
  const rawBeatsLength = lg.getPatternBeatsLength();
  const effectiveBeatsLength = Number.isFinite(rawBeatsLength) && rawBeatsLength > 0
    ? rawBeatsLength
    : PATTERN_BEATS_LENGTH_FALLBACK;
  const layers: PatternLayerSnapshot[] = [];

  for (let i = 0; i < lg.length; i++) {
    const layer = lg[i];
    if (!layer) continue;
    const layerId = assignPatternLayerId(layer);
    const source = layer.getSoundObject();
    const objectId = assignScoreObjectId(source, 'sobj');
    const editorTarget: ScoreObjectEditorTargetSnapshot = {
      selectionId: objectId,
      selectedObjectType: source.constructor.name,
      editorObjectType: source.constructor.name,
      ownerKind: 'timeline',
      displayContext: 'timeline',
      patternSource: { groupId, layerId, sourceObjectId: objectId },
      supportsTimeBehavior: source instanceof AbstractSoundObject,
      supportsRepeatPoint: source instanceof AbstractSoundObject,
      supportsNoteProcessorChain: source instanceof AbstractSoundObject,
    };
    layers.push({
      layerId,
      layerSelectionId: assignLayerSelectionId(layer),
      name: layer.getName(),
      height: layer.getLayerHeight(),
      muted: layer.isMuted(),
      solo: layer.isSolo(),
      items: [],
      sourceObject: {
        objectId,
        objectType: source.constructor.name,
        name: source.getName(),
        backgroundColor: source.getBackgroundColor(),
        editorTarget,
        serializedXml: source.saveAsXML().toXml(),
        barRenderer: source instanceof AbstractSoundObject
          ? createBarRendererForSoundObject(source, context)
          : { kind: 'fallback' as const, labelLines: splitLabelLines(source.getName()), reason: 'unknown-type' as const },
      },
      activeCellIndices: collectActivePatternCellIndices(layer),
    });
  }

  const groupChain = lg.getNoteProcessorChain();
  return {
    groupId,
    groupType: 'patterns',
    name: lg.getName(),
    layerCount: lg.length,
    isOpenableContainer: false,
    patternBeatsLength: rawBeatsLength,
    effectivePatternBeatsLength: effectiveBeatsLength,
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

export function buildEditorTargetSnapshot(
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
    case 'AudioFile':
      return 'audioFile';
    case 'FrozenSoundObject':
      return 'frozenSoundObject';
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
): 'text' | 'csound-score' | 'python' | 'javascript' | 'clojure' {
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
          case 'CLOJURE':
            return 'clojure';
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

/**
 * Resolve a pattern-source reference by walking the owning PatternsLayerGroup
 * and PatternLayer and verifying the embedded source object's assigned ID.
 */
function resolvePatternSourceTarget(
  score: Score,
  ref: PatternSourceObjectLocationRef,
): SoundObject | null {
  for (const group of score) {
    if (!(group instanceof PatternsLayerGroup)) continue;
    if (assignLayerGroupId(group) !== ref.groupId) continue;
    for (const layer of group) {
      if (assignPatternLayerId(layer) !== ref.layerId) continue;
      const source = layer.getSoundObject();
      return assignScoreObjectId(source, 'sobj') === ref.sourceObjectId ? source : null;
    }
    return null;
  }
  return null;
}

export function findPatternsLayerGroupByGroupId(score: Score, groupId: string): PatternsLayerGroup | null {
  for (const group of score) {
    if (group instanceof PatternsLayerGroup && assignLayerGroupId(group) === groupId) {
      return group;
    }
  }
  return null;
}

export function resolveEditorTarget(data: BlueData, target: ScoreObjectEditorTargetSnapshot): { sObj: SoundObject | AudioClip; isLibraryOwned: boolean } | null {
  const score = data.getScore();

  let sObj: SoundObject | AudioClip | null = null;
  let isLibraryOwned = false;

  if (target.patternSource) {
    const source = resolvePatternSourceTarget(score, target.patternSource);
    return source ? { sObj: source, isLibraryOwned: false } : null;
  }

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
    const locationResolved = resolveTimelineTarget(score, loc)?.sObj ?? null;
    if (locationResolved) {
      sObj = locationResolved;
    } else {
      // During an optimistic cross-layer drag the renderer has the destination
      // location before the main-owned graph commits it. Stable selection
      // identity keeps the same object editable through that short interval.
      sObj = (resolveTimelineScoreObjects(data, [target.selectionId])?.[0]
        ?? null) as SoundObject | AudioClip | null;
    }
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
                comment: sObj.getComment(),
              }
            : undefined;
      editor = {
        kind: 'code',
        target,
        syntax: getSyntaxForType(objectType, sObj as SoundObject),
        text: getCodeText(sObj as SoundObject),
        ...(auxiliaryFlags ? { auxiliaryFlags } : {}),
        ...(sObj instanceof ObjectBuilder
          ? { bsbInstrument: buildObjectBuilderBsbInstrumentSnapshot(sObj) }
          : {}),
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
    case 'audioFile': {
      const af = sObj as AudioFile;
      editor = {
        kind: 'audioFile',
        target,
        filePath: af.getSoundFileName ? af.getSoundFileName() : '',
        csoundPostCode: af.getCsoundPostCode ? af.getCsoundPostCode() : '',
        metadata: { status: 'empty' },
        canChooseFile: true,
      };
      break;
    }
    case 'frozenSoundObject': {
      const fso = sObj as FrozenSoundObject;
      const inner = fso.getFrozenSoundObject ? fso.getFrozenSoundObject() : null;
      const frozenWaveFileName = fso.getFrozenWaveFileName ? fso.getFrozenWaveFileName() : '';
      editor = {
        kind: 'frozenSoundObject',
        target,
        frozenWaveFileName,
        sourceName: inner ? inner.getName() : '',
        sourceType: inner ? inner.constructor.name : '',
        sourceDurationBeats: inner ? inner.getSubjectiveDuration().toBeats(context) : null,
        numChannels: fso.getNumChannels ? fso.getNumChannels() : 0,
        artifactStatus: 'empty',
        canSaveCopy: Boolean(frozenWaveFileName && frozenWaveFileName.length > 0),
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
        showNoteNames: to.isKeyboardNotesEnabled(),
        octave: to.getKeyboardOctave(),
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
    scratchPad: createScratchPadSnapshot(data.getScratchPadData()),
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

function createScratchPadSnapshot(data: ScratchPadData): ScratchPadSnapshot {
  return {
    text: data.getScratchText(),
    wordWrapEnabled: data.isWordWrapEnabled(),
  };
}



interface ParameterMetadata {
  targetPath: string[];
  sourceKind: AutomationTargetSourceKind;
}

function buildParameterMetadataMap(
  arrangement: BlueDataArrangement,
  mixer: BlueDataMixer,
  projectParameterCatalog: readonly ProjectParameterEntry[] = [],
): Map<string, ParameterMetadata> {
  const metadataMap = new Map<string, ParameterMetadata>();

  for (const ia of arrangement.getArrangement()) {
    if (!ia.instr) continue;
    const instr = ia.instr as any;
    if (typeof instr.getParameters !== 'function') continue;
    const instrParams = instr.getParameters();
    if (!instrParams || !Array.isArray(instrParams)) continue;
    const instrId = ia.arrangementId;
    const instrSegment = instrId.startsWith('instr ') ? instrId : `instr ${instrId}`;
    for (const param of instrParams) {
      if (!param) continue;
      const paramName = param.getName() || param.getLabel() || param.getUniqueId();
      metadataMap.set(param.getUniqueId(), {
        targetPath: [instrSegment, paramName],
        sourceKind: 'instrument',
      });
    }
  }

  function indexChannel(channel: any, channelPath: string[]) {
    if (!channel) return;
    const levelParam = channel.getLevelParameter?.();
    if (levelParam) {
      metadataMap.set(levelParam.getUniqueId(), {
        targetPath: [...channelPath, 'Volume'],
        sourceKind: 'mixer',
      });
    }

    const preEffects = channel.getPreEffects?.();
    if (preEffects && preEffects.length > 0) {
      for (const effect of preEffects) {
        const effectName = typeof (effect as any).getSendChannel === 'function'
          ? `Send: ${(effect as any).getSendChannel()}`
          : (effect.getName?.() || 'Effect');
        const params = effect.getParameters?.() ?? [];
        for (const param of params) {
          if (!param) continue;
          const paramName = param.getName() || param.getLabel() || param.getUniqueId();
          metadataMap.set(param.getUniqueId(), {
            targetPath: [...channelPath, 'Pre-Effects', effectName, paramName],
            sourceKind: 'mixer',
          });
        }
      }
    }

    const postEffects = channel.getPostEffects?.();
    if (postEffects && postEffects.length > 0) {
      for (const effect of postEffects) {
        const effectName = typeof (effect as any).getSendChannel === 'function'
          ? `Send: ${(effect as any).getSendChannel()}`
          : (effect.getName?.() || 'Effect');
        const params = effect.getParameters?.() ?? [];
        for (const param of params) {
          if (!param) continue;
          const paramName = param.getName() || param.getLabel() || param.getUniqueId();
          metadataMap.set(param.getUniqueId(), {
            targetPath: [...channelPath, 'Post-Effects', effectName, paramName],
            sourceKind: 'mixer',
          });
        }
      }
    }
  }

  if (mixer) {
    for (const channel of mixer.getAllSourceChannels()) {
      const channelName = channel.getName?.() || 'Channel';
      indexChannel(channel, ['Mixer', channelName]);
    }
    for (const channel of mixer.getSubChannels()) {
      const channelName = channel.getName?.() || 'SubChannel';
      indexChannel(channel, ['Mixer', channelName]);
    }
    if (mixer.getMaster()) {
      indexChannel(mixer.getMaster(), ['Mixer', 'Master']);
    }
  }

  for (const entry of projectParameterCatalog) {
    const parameter = entry.parameter;
    const descriptor = getBlueX7Descriptor(parameter.getName());
    if (!descriptor && metadataMap.has(parameter.getUniqueId())) continue;
    metadataMap.set(parameter.getUniqueId(), {
      targetPath: descriptor
        ? [...entry.path, descriptor.group, descriptor.label]
        : [...entry.path, parameter.getLabel() || parameter.getName()],
      sourceKind: entry.ownerKind === 'mixer' ? 'mixer' : 'instrument',
    });
  }

  return metadataMap;
}

function buildAutomationParameterSnapshot(
  param: BlueDataParameter,
  metadata?: ParameterMetadata,
): AutomationParameterSnapshot {
  const name = param.getName();
  const label = param.getLabel();
  return {
    parameterId: param.getUniqueId(),
    name,
    label,
    displayName: label || name || param.getUniqueId(),
    minimum: param.getMinimum(),
    maximum: param.getMaximum(),
    resolutionDecimal: param.getResolutionText(),
    resolution: param.getResolution(),
    curve: param.getCurve(),
    fixedValue: param.getFixedValue(),
    automationEnabled: param.isAutomationEnabled(),
    lineColor: param.getLineColor(),
    sourceKind: metadata?.sourceKind ?? resolveParameterSourceKind(param),
    targetPath: metadata?.targetPath ?? (name ? [name] : []),
    points: param.getPoints().map((p) => ({ time: p.time, value: p.value })),
  };
}

export function collectLayerAutomationSnapshot(
  layerId: string,
  layerKind: AutomationLayerKind,
  automatableLayer: BlueDataAutomatableLayer,
  allParameters: BlueDataParameter[],
  assignedElsewhere: Map<string, { layerId: string; layerName: string }>,
  layerGroupId: string,
  arrangement: BlueDataArrangement,
  mixer: BlueDataMixer,
  projectParameterCatalog: readonly ProjectParameterEntry[] = [],
): ScoreLayerAutomationSnapshot | undefined {
  const paramIdList = automatableLayer.getAutomationParameters();
  const assignedIds = paramIdList.getIds();

  const paramMap = new Map<string, BlueDataParameter>();
  for (const p of allParameters) {
    paramMap.set(p.getUniqueId(), p);
  }

  const metadataMap = buildParameterMetadataMap(arrangement, mixer, projectParameterCatalog);

  const resolvedParameters: AutomationParameterSnapshot[] = [];
  const missingParameterIds: string[] = [];

  for (const id of assignedIds) {
    const param = paramMap.get(id);
    if (param) {
      resolvedParameters.push(buildAutomationParameterSnapshot(param, metadataMap.get(id)));
    } else {
      missingParameterIds.push(id);
    }
  }

  const selectedIdx = paramIdList.getSelectedIndex();
  const selectedParameterId = selectedIdx >= 0 && selectedIdx < assignedIds.length
    ? assignedIds[selectedIdx]
    : undefined;

  const targetGroups = layerKind === 'track'
    ? buildTrackAutomationTargetGroups(
      automatableLayer,
      assignedIds,
      assignedElsewhere,
      mixer,
      layerGroupId,
      projectParameterCatalog,
    )
    : buildAutomationTargetGroups(
      assignedIds,
      allParameters,
      assignedElsewhere,
      arrangement,
      mixer,
      projectParameterCatalog,
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

function buildBlueX7TargetGroups(
  entries: readonly ProjectParameterEntry[],
  makeTarget: (parameter: BlueDataParameter) => AutomationTargetSnapshot,
): AutomationTargetGroupSnapshot[] {
  const groups = new Map<string, AutomationTargetGroupSnapshot>();
  for (const entry of entries) {
    const descriptor = getBlueX7Descriptor(entry.parameter.getName());
    if (!descriptor) continue;
    let group = groups.get(descriptor.group);
    if (!group) {
      group = {
        groupId: `${entry.ownerIdentity}:${descriptor.group}`,
        label: descriptor.group,
        subGroups: [],
        targets: [],
      };
      groups.set(descriptor.group, group);
    }
    group.targets.push(makeTarget(entry.parameter));
  }
  return [...groups.values()];
}

function buildAutomationTargetGroups(
  currentLayerAssignedIds: string[],
  allParameters: BlueDataParameter[],
  assignedElsewhere: Map<string, { layerId: string; layerName: string }>,
  arrangement: BlueDataArrangement,
  mixer: BlueDataMixer,
  projectParameterCatalog: readonly ProjectParameterEntry[] = [],
): AutomationTargetGroupSnapshot[] {
  const rootGroups: AutomationTargetGroupSnapshot[] = [];

  const paramMap = new Map<string, BlueDataParameter>();
  const catalogById = new Map(
    projectParameterCatalog.map((entry) => [entry.parameter.getUniqueId(), entry]),
  );
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
    const catalogEntry = catalogById.get(id);
    const descriptor = getBlueX7Descriptor(param.getName());
    return {
      parameterId: id,
      label: descriptor?.label ?? (param.getLabel() || param.getName() || id),
      sourceKind: resolveParameterSourceKind(param),
      automationEnabled: param.isAutomationEnabled(),
      assignmentState,
      semanticKey: descriptor?.key,
      ownerIdentity: catalogEntry?.ownerIdentity,
      locationLabel: catalogEntry?.ownerLabel,
      updateClass: descriptor?.updateClass,
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
    const ownerIdentity = `arrangement:${ia.arrangementId}`;
    const ownerEntries = projectParameterCatalog.filter((entry) => entry.ownerIdentity === ownerIdentity);
    const instrParams = ownerEntries.length > 0
      ? ownerEntries.map((entry) => entry.parameter)
      : instr.getParameters();
    if (!instrParams || !Array.isArray(instrParams) || instrParams.length === 0) continue;

    const instrSubGroup: AutomationTargetGroupSnapshot = {
      groupId: `instr-${ia.arrangementId}`,
      label: ownerEntries[0]?.ownerLabel ?? `${ia.arrangementId}) ${(ia.instr as any).getName?.() ?? 'Instrument'}`,
      subGroups: buildBlueX7TargetGroups(ownerEntries, makeTarget),
      targets: ownerEntries.some((entry) => getBlueX7Descriptor(entry.parameter.getName()))
        ? []
        : instrParams
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
  layerGroupId: string,
  projectParameterCatalog: readonly ProjectParameterEntry[] = [],
): AutomationTargetGroupSnapshot[] {
  const getUniqueId = (automatableLayer as unknown as { getUniqueId?: () => string }).getUniqueId;
  const trackId = typeof getUniqueId === 'function' ? getUniqueId.call(automatableLayer) : '';
  if (!trackId) return [];

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

  const result: AutomationTargetGroupSnapshot[] = [];
  const ownerIdentity = `track:${layerGroupId}:${trackId}`;
  const trackEntries = projectParameterCatalog.filter(
    (entry) => entry.ownerIdentity === ownerIdentity,
  );
  if (trackEntries.length > 0) {
    const makeTrackTarget = (parameter: BlueDataParameter): AutomationTargetSnapshot => {
      const id = parameter.getUniqueId();
      const assignment = getAssignmentState(id);
      const descriptor = getBlueX7Descriptor(parameter.getName());
      return {
        parameterId: id,
        label: descriptor?.label ?? (parameter.getLabel() || parameter.getName() || id),
        sourceKind: 'instrument',
        automationEnabled: parameter.isAutomationEnabled(),
        ...assignment,
        semanticKey: descriptor?.key,
        ownerIdentity,
        locationLabel: trackEntries[0]?.ownerLabel,
        updateClass: descriptor?.updateClass,
      };
    };
    result.push({
      groupId: `${ownerIdentity}:instrument`,
      label: trackEntries[0]?.ownerLabel ?? 'Track Instrument',
      subGroups: buildBlueX7TargetGroups(trackEntries, makeTrackTarget),
      targets: trackEntries.some((entry) => getBlueX7Descriptor(entry.parameter.getName()))
        ? []
        : trackEntries.map((entry) => makeTrackTarget(entry.parameter)),
    });
  }

  const channel = mixer.getAllSourceChannels()
    .find((candidate) => candidate.getAssociation().trim() === trackId);
  if (channel) {
    const channelGroup = buildChannelSubGroup(
      channel,
      'trackChannel',
      getAssignmentState,
      'mixer',
    );
    result.push({
      groupId: 'track-channel',
      label: 'Track Channel',
      subGroups: channelGroup.subGroups,
      targets: channelGroup.targets,
    });
  }

  return result;
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

export function buildAssignedAutomationLayerMap(
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

export function buildAssignedElsewhereMapForLayer(
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
