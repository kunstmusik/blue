import {
  BlueData,
  PolyObject,
  TrackLayerGroup,
  PatternLayer,
  PatternsLayerGroup,
  SoundObject,
  AbstractSoundObject,
  AudioClip,
  TimeContext,
  GenericScore,
  Comment,
  AudioFile,
  FrozenSoundObject,
  PatternObject,
  PianoRoll,
  ScratchPadData,
  getProjectParameterCatalog,
} from '@blue/data';
import type {
  Parameter as BlueDataParameter,
  Arrangement as BlueDataArrangement,
  Mixer as BlueDataMixer,
  ProjectParameterEntry,
} from '@blue/data';
import type { ScoreInsertionLocation } from '../unified-library';

import type {
  ScoreTimeStateSnapshot,
  MarkerSnapshot,
  ScoreObjectBarRendererSnapshot,
  PianoRollBarRendererSnapshot,
  AudioClipBarRendererSnapshot,
  ScoreRowObjectSnapshot,
  ScoreLayerSnapshot,
  PolyObjectLayerGroupSnapshot,
  TrackSnapshot,
  TrackLayerGroupSnapshot,
  PatternLayerSnapshot,
  PatternsLayerGroupSnapshot,
  ScoreLayerGroupSnapshot,
  ScoreDocumentSnapshot,
  ScoreObjectLocationRef,
  ScoreObjectEditorTargetSnapshot,
  ProjectPropertiesSnapshot,
  ClojureProjectSnapshot,
  ProjectEditorSnapshot,
  ProjectEditorSnapshotOptions,
  ScratchPadSnapshot,
} from './contract';
import {
  assignLayerGroupId,
  assignLayerSelectionId,
  assignPatternLayerId,
  assignScoreObjectId,
  getMarkerSnapshotIds,
  getTrackInstrumentOwnerIdentity,
} from './identity';
import {
  createBlueLiveProjectSnapshot,
  createClojureProjectSnapshot,
  createEmptyMixerSnapshot,
  createEmptyOrchestraSnapshot,
  createEmptyToolbarProjectTransportSnapshot,
  createInstrumentSnapshot,
  createMidiInputProcessorSnapshot,
  computeLegacyMixerStateNotice,
  createMixerSnapshot,
  createOrchestraSnapshot,
  createProjectPropertiesSnapshot,
  createProjectUdoListSnapshot,
  createToolbarProjectTransportSnapshot,
  getInstrumentSnapshotType,
  reconcileMixerWithArrangement,
} from './snapshot-mixer-orchestra';

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
    const originalDur = inner ? inner.getSubjectiveDuration().toBeats(context) : null;
    return {
      kind: 'frozenSoundObject',
      labelLines,
      frozenWaveFileName: frozenFile,
      waveformKey: frozenFile ? `fso:${frozenFile}` : null,
      originalDurationBeats:
        originalDur != null && Number.isFinite(originalDur) && originalDur > 0 ? originalDur : null,
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
    fadeInType: normalizeAudioFadeType(
      clip.getFadeInType ? String(clip.getFadeInType()) : 'LINEAR',
    ),
    fadeOutBeats: secondsToBeats(clip.getFadeOut ? clip.getFadeOut() : 0),
    fadeOutType: normalizeAudioFadeType(
      clip.getFadeOutType ? String(clip.getFadeOutType()) : 'LINEAR',
    ),
  };
}

// ─── Score Snapshot Helpers ───

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
    smpteDropFrame: ts.isSmpteDropFrame(),
    zoomIterations: ts.getZoomIterations(),
  };
}

function createMarkerSnapshots(data: BlueData): MarkerSnapshot[] {
  const markers: MarkerSnapshot[] = [];
  const markersList = data.getMarkersList();
  if (!markersList) return markers;
  const context = data.getScore().getTimeContext();
  const elements = markersList.getMarkers();
  const markerIds = getMarkerSnapshotIds(markersList);
  for (let i = 0; i < elements.length; i++) {
    const elem = elements[i];
    if (!elem) continue;
    const name = elem.getAttribute('name') ?? elem.getName() ?? '';
    const position = markersList.getMarkerTimePosition(i);
    const time = position.toBeats(context);
    markers.push({
      markerId: markerIds[i],
      name,
      time,
      timeBase: position.getTimeBase(),
      sourceIndex: i,
    });
  }
  return markers;
}

function createScoreLayerGroupSnapshots(
  data: BlueData,
  includeSerializedXml = true,
): ScoreLayerGroupSnapshot[] {
  const score = data.getScore();
  const context = score.getTimeContext();
  const result: ScoreLayerGroupSnapshot[] = [];

  const arrangement = data.getArrangement();
  const mixer = data.getMixer();

  const projectParameterCatalog = getProjectParameterCatalog(data);
  const allParameters = projectParameterCatalog.map((entry) => entry.parameter);
  const assignedLayerMap = buildAssignedAutomationLayerMap(score);
  const sharedAutomationData = {
    paramMap: buildParameterMap(allParameters),
    metadataMap: buildParameterMetadataMap(arrangement, mixer, projectParameterCatalog),
  };

  for (let i = 0; i < score.length; i++) {
    const lg = score[i];
    if (!lg) continue;

    if (lg instanceof PolyObject) {
      result.push(
        createPolyObjectGroupSnapshot(
          lg,
          context,
          i,
          allParameters,
          arrangement,
          mixer,
          assignedLayerMap,
          projectParameterCatalog,
          sharedAutomationData,
          includeSerializedXml,
        ),
      );
    } else if (lg instanceof TrackLayerGroup) {
      result.push(
        createTrackLayerGroupSnapshot(
          lg,
          context,
          i,
          allParameters,
          arrangement,
          mixer,
          assignedLayerMap,
          projectParameterCatalog,
          sharedAutomationData,
          includeSerializedXml,
        ),
      );
    } else if (lg instanceof PatternsLayerGroup) {
      result.push(createPatternsLayerGroupSnapshot(lg, context, includeSerializedXml));
    }
  }

  return result;
}

function createPolyObjectGroupSnapshot(
  lg: PolyObject,
  context: TimeContext,
  rootGroupIndex: number,
  allParameters: BlueDataParameter[],
  arrangement: BlueDataArrangement,
  mixer: BlueDataMixer,
  assignedLayerMap: Map<string, { layerId: string; layerName: string }>,
  projectParameterCatalog: readonly ProjectParameterEntry[],
  sharedAutomationData?: {
    paramMap: Map<string, BlueDataParameter>;
    metadataMap: Map<string, ParameterMetadata>;
  },
  includeSerializedXml = true,
): PolyObjectLayerGroupSnapshot {
  const groupId = assignLayerGroupId(lg);
  const layers: ScoreLayerSnapshot[] = [];

  for (let i = 0; i < lg.length; i++) {
    const layer = lg[i];
    const layerId = `${groupId}-layer-${i}`;
    const items: ScoreRowObjectSnapshot[] = [];
    for (let j = 0; j < layer.length; j++) {
      const sObj = layer[j];
      const location: ScoreObjectLocationRef = {
        rootGroupIndex,
        containerPath: [],
        layerIndex: i,
        objectIndex: j,
      };
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
        ...(includeSerializedXml ? { serializedXml: sObj.saveAsXML().toXml() } : {}),
        barRenderer:
          sObj instanceof AbstractSoundObject
            ? createBarRendererForSoundObject(sObj, context)
            : {
                kind: 'fallback' as const,
                labelLines: splitLabelLines(sObj.getName()),
                reason: 'unknown-type' as const,
              },
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
      sharedAutomationData,
    );
    layers.push({
      layerId,
      layerSelectionId: assignLayerSelectionId(layer),
      name: layer.getName(),
      height: layer.getLayerHeight(),
      backgroundColor: layer.getBackgroundColor(),
      muted: layer.isMuted(),
      solo: layer.isSolo(),
      items,
      noteProcessorChain:
        layerChain.getProcessors().length > 0
          ? createNoteProcessorChainSnapshot(layerChain)
          : undefined,
      automation,
    });
  }

  const groupChain = lg.getNoteProcessorChain();
  return {
    groupId,
    groupType: 'polyObject',
    name: lg.getName(),
    defaultHeightIndex: lg.getDefaultHeightIndex(),
    layerCount: lg.length,
    isOpenableContainer: true,
    layers,
    noteProcessorChain:
      groupChain.getProcessors().length > 0
        ? createNoteProcessorChainSnapshot(groupChain)
        : undefined,
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
  sharedAutomationData?: {
    paramMap: Map<string, BlueDataParameter>;
    metadataMap: Map<string, ParameterMetadata>;
  },
  includeSerializedXml = true,
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
          ...(includeSerializedXml ? { serializedXml: item.saveAsXML().toXml() } : {}),
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
        ...(includeSerializedXml ? { serializedXml: item.saveAsXML().toXml() } : {}),
        barRenderer:
          item instanceof AbstractSoundObject
            ? createBarRendererForSoundObject(item, context)
            : {
                kind: 'fallback' as const,
                labelLines: splitLabelLines(item.getName()),
                reason: 'unknown-type' as const,
              },
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
      sharedAutomationData,
    );
    const instrument = layer.getInstrument();
    const instrumentType = instrument ? getInstrumentSnapshotType(instrument) : 'unknown';
    layers.push({
      layerKind: 'track',
      layerId,
      layerSelectionId: assignLayerSelectionId(layer),
      name: layer.getName(),
      height: layer.getLayerHeight(),
      backgroundColor: layer.getBackgroundColor(),
      muted: layer.isMuted(),
      solo: layer.isSolo(),
      items,
      noteProcessorChain:
        layer.getNoteProcessorChain().getProcessors().length > 0
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
            snapshot:
              instrumentType === 'unknown'
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

function createPatternsLayerGroupSnapshot(
  lg: PatternsLayerGroup,
  context: TimeContext,
  includeSerializedXml = true,
): PatternsLayerGroupSnapshot {
  const groupId = assignLayerGroupId(lg);
  const rawBeatsLength = lg.getPatternBeatsLength();
  const effectiveBeatsLength =
    Number.isFinite(rawBeatsLength) && rawBeatsLength > 0
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
      backgroundColor: layer.getBackgroundColor(),
      muted: layer.isMuted(),
      solo: layer.isSolo(),
      items: [],
      sourceObject: {
        objectId,
        objectType: source.constructor.name,
        name: source.getName(),
        backgroundColor: source.getBackgroundColor(),
        editorTarget,
        ...(includeSerializedXml ? { serializedXml: source.saveAsXML().toXml() } : {}),
        barRenderer:
          source instanceof AbstractSoundObject
            ? createBarRendererForSoundObject(source, context)
            : {
                kind: 'fallback' as const,
                labelLines: splitLabelLines(source.getName()),
                reason: 'unknown-type' as const,
              },
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
    noteProcessorChain:
      groupChain.getProcessors().length > 0
        ? createNoteProcessorChainSnapshot(groupChain)
        : undefined,
  };
}

export function createScoreDocumentSnapshot(
  data: BlueData,
  options?: ProjectEditorSnapshotOptions,
): ScoreDocumentSnapshot {
  const score = data.getScore();
  const rootChain = score.getNoteProcessorChain();
  const layerGroups = createScoreLayerGroupSnapshots(data, options?.includeSerializedXml ?? true);
  recordExistingScoreObjectIds(data);
  return {
    trackLayerMuteSoloMode: score.trackLayerMuteSoloMode,
    timeState: createScoreTimeStateSnapshot(data),
    markers: createMarkerSnapshots(data),
    layerGroups,
    rootNoteProcessorChain:
      rootChain.getProcessors().length > 0
        ? createNoteProcessorChainSnapshot(rootChain)
        : undefined,
  };
}

export function resolveScoreInsertionLocation(
  data: BlueData,
  location: ScoreInsertionLocation,
): { groupId: string; layerIndex: number } | null {
  const score = data.getScore();
  const root = Array.from(score).find(
    (group) => group instanceof PolyObject && assignLayerGroupId(group) === location.rootGroupId,
  );
  if (!(root instanceof PolyObject)) return null;

  let container = root;
  for (const segment of location.containerPath) {
    const containerId = assignLayerGroupId(container);
    const layerIndex = container.findIndex(
      (_, index) => `${containerId}-layer-${index}` === segment.layerId,
    );
    if (layerIndex < 0) return null;
    const layer = container[layerIndex];
    const nested = layer?.find(
      (object) => assignScoreObjectId(object, 'sobj') === segment.objectIdentity,
    );
    if (!(nested instanceof PolyObject)) return null;
    container = nested;
  }

  const groupId = assignLayerGroupId(container);
  const layerIndex = container.findIndex(
    (_, index) => `${groupId}-layer-${index}` === location.layerId,
  );
  return layerIndex < 0 ? null : { groupId, layerIndex };
}

export function createEmptyScoreDocumentSnapshot(): ScoreDocumentSnapshot {
  return {
    trackLayerMuteSoloMode: 'audio',
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
      smpteDropFrame: false,
      zoomIterations: 0,
    },
    markers: [],
    layerGroups: [],
    rootNoteProcessorChain: undefined,
  };
}

import {
  type ParameterMetadata,
  buildParameterMetadataMap,
  buildParameterMap,
  collectLayerAutomationSnapshot,
  buildAssignedAutomationLayerMap,
  buildAssignedElsewhereMapForLayer,
} from './snapshot-score-automation';
import {
  normalizeAudioFadeType,
  resolveTimelineScoreObjects,
  buildEditorTargetSnapshot,
  createBlueLiveEditorTargetSnapshot,
  createScoreObjectPropertiesTarget,
  setCodeText,
  resolveTimelineTarget,
  findPatternsLayerGroupByGroupId,
  recordExistingScoreObjectIds,
  type ScoreTimelineEntry,
  type ScoreLookupCache,
  resolveTimelineTargetWithSelectionId,
  resolveEditorTarget,
  createNoteProcessorChainSnapshot,
  createScoreObjectEditorDocument,
  createFallbackEditorDocument,
} from './snapshot-score-editor';

export {
  resolveTimelineScoreObjects,
  collectLayerAutomationSnapshot,
  buildAssignedAutomationLayerMap,
  buildAssignedElsewhereMapForLayer,
  buildEditorTargetSnapshot,
  createBlueLiveEditorTargetSnapshot,
  createScoreObjectPropertiesTarget,
  setCodeText,
  resolveTimelineTarget,
  findPatternsLayerGroupByGroupId,
  recordExistingScoreObjectIds,
  type ScoreTimelineEntry,
  type ScoreLookupCache,
  resolveTimelineTargetWithSelectionId,
  resolveEditorTarget,
  createNoteProcessorChainSnapshot,
  createScoreObjectEditorDocument,
  createFallbackEditorDocument,
};

export type ProjectEditorSnapshotSection =
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
  | 'blueLive'
  | 'midiInput'
  | 'score'
  | 'namedChains';

/**
 * Maps canonical changedTargets hints to the snapshot sections they can affect.
 * Returns null when targets are empty or contain an unrecognized hint so
 * callers fall back safely to a full project snapshot.
 */
export function resolveSnapshotSectionsForChangedTargets(
  changedTargets: readonly string[] | undefined,
): ReadonlySet<ProjectEditorSnapshotSection> | null {
  if (!changedTargets || changedTargets.length === 0) {
    return null;
  }
  const sections = new Set<ProjectEditorSnapshotSection>();
  for (const target of changedTargets) {
    if (target === 'text:globalOrc') {
      sections.add('globalOrc');
    } else if (target === 'text:globalSco') {
      sections.add('globalSco');
    } else if (target === 'text:tablesText') {
      sections.add('tablesText');
    } else if (target === 'text:scratchPad') {
      sections.add('scratchPad');
    } else if (target === 'clojureProject') {
      sections.add('clojureProject');
    } else if (target === 'property:projectProperties') {
      sections.add('projectProperties');
    } else if (target === 'transport') {
      sections.add('transport');
    } else if (target === 'transport:timeContext') {
      sections.add('transport');
      sections.add('score');
      sections.add('blueLive');
    } else if (target === 'udo') {
      sections.add('projectUdos');
    } else if (target === 'midiInput') {
      sections.add('midiInput');
    } else if (target === 'blueLive') {
      sections.add('blueLive');
    } else if (target.startsWith('mixerChannel:')) {
      sections.add('mixer');
    } else if (
      target === 'mixer' ||
      target.startsWith('mixerChannelRename:') ||
      target.startsWith('mixerEntry:')
    ) {
      sections.add('mixer');
      sections.add('score');
      sections.add('namedChains');
      sections.add('projectUdos');
    } else if (target === 'orchestra') {
      sections.add('orchestra');
      sections.add('mixer');
      sections.add('projectUdos');
      sections.add('score');
    } else if (target.startsWith('instrument:')) {
      sections.add('orchestra');
      sections.add('mixer');
      sections.add('projectUdos');
    } else if (
      target === 'score' ||
      target.startsWith('scoreObject:') ||
      target.startsWith('layer:') ||
      target.startsWith('track:')
    ) {
      sections.add('score');
      sections.add('mixer');
      sections.add('namedChains');
      sections.add('projectUdos');
    } else {
      return null;
    }
  }
  return sections;
}

function changedTargetsAffectMixerChannels(changedTargets: readonly string[] | undefined): boolean {
  if (!changedTargets || changedTargets.length === 0) return true;
  return changedTargets.some(
    (target) =>
      target === 'score' ||
      target === 'orchestra' ||
      target === 'mixer' ||
      target.startsWith('track:') ||
      target.startsWith('layer:') ||
      target.startsWith('instrument:') ||
      target.startsWith('mixerChannel'),
  );
}

/**
 * Builds only the snapshot sections affected by changedTargets, omitting
 * unchanged sections so IPC publication and renderer store merge reuse existing
 * section references intact. Falls back to createProjectEditorSnapshot when
 * section scope cannot be determined safely.
 */
export function createScopedProjectEditorSnapshot(
  data: BlueData,
  filePath: string | null,
  sessionId = 0,
  documentId?: string,
  changedTargets?: readonly string[],
  options?: ProjectEditorSnapshotOptions,
): Partial<ProjectEditorSnapshot> &
  Pick<ProjectEditorSnapshot, 'filePath' | 'version' | 'sessionId' | 'documentId' | 'loaded'> {
  const sections = resolveSnapshotSectionsForChangedTargets(changedTargets);
  if (!sections) {
    return createProjectEditorSnapshot(data, filePath, sessionId, documentId, options);
  }
  const includeSerializedXml = options?.includeSerializedXml ?? false;
  const result: Partial<ProjectEditorSnapshot> &
    Pick<ProjectEditorSnapshot, 'filePath' | 'version' | 'sessionId' | 'documentId' | 'loaded'> = {
    filePath,
    version: data.getVersion(),
    sessionId,
    documentId,
    loaded: true,
  };
  if (sections.has('orchestra')) {
    const orchestra = createOrchestraSnapshot(data);
    reconcileMixerWithArrangement(data, orchestra);
    result.orchestra = orchestra;
  } else if (sections.has('score') && changedTargetsAffectMixerChannels(changedTargets)) {
    // Score track changes can add/remove channel list groups on the mixer.
    reconcileMixerWithArrangement(data);
  }
  if (sections.has('globalOrc')) {
    result.globalOrc = data.getGlobalOrcSco().getGlobalOrc();
  }
  if (sections.has('globalSco')) {
    result.globalSco = data.getGlobalOrcSco().getGlobalSco();
  }
  if (sections.has('mixer')) {
    result.mixer = {
      ...createMixerSnapshot(data.getMixer(), data.getScore(), undefined, {
        includeSerializedXml,
      }),
      legacyActiveChannelStateNotice: computeLegacyMixerStateNotice(data),
    };
  }
  if (sections.has('projectProperties')) {
    result.projectProperties = createProjectPropertiesSnapshot(data.getProjectProperties());
  }
  if (sections.has('clojureProject')) {
    result.clojureProject = createClojureProjectSnapshot(data.getClojureProjectData(), data);
  }
  if (sections.has('transport')) {
    result.transport = createToolbarProjectTransportSnapshot(data);
  }
  if (sections.has('tablesText')) {
    result.tablesText = data.getTableSet().getTables();
  }
  if (sections.has('scratchPad')) {
    result.scratchPad = createScratchPadSnapshot(data.getScratchPadData());
  }
  if (sections.has('projectUdos')) {
    result.projectUdos = createProjectUdoListSnapshot(data);
  }
  if (sections.has('blueLive')) {
    result.blueLive = createBlueLiveProjectSnapshot(
      data.getLiveData(),
      data.getScore().getTimeContext(),
      { includeSerializedXml },
    );
  }
  if (sections.has('midiInput')) {
    result.midiInput = createMidiInputProcessorSnapshot(data.getMidiInputProcessor());
  }
  if (sections.has('score')) {
    result.score = createScoreDocumentSnapshot(data, { includeSerializedXml });
  }
  if (sections.has('namedChains')) {
    result.namedChains = { names: data.getNoteProcessorChainMap().getChainNames() };
  }
  return result;
}

export function createProjectEditorSnapshot(
  data: BlueData,
  filePath: string | null,
  sessionId = 0,
  documentId?: string,
  options?: ProjectEditorSnapshotOptions,
): ProjectEditorSnapshot {
  const includeSerializedXml = options?.includeSerializedXml ?? false;
  const orchestra = createOrchestraSnapshot(data);
  reconcileMixerWithArrangement(data, orchestra);
  return {
    filePath,
    version: data.getVersion(),
    sessionId,
    documentId,
    globalOrc: data.getGlobalOrcSco().getGlobalOrc(),
    globalSco: data.getGlobalOrcSco().getGlobalSco(),
    orchestra,
    mixer: {
      ...createMixerSnapshot(data.getMixer(), data.getScore(), undefined, {
        includeSerializedXml,
      }),
      legacyActiveChannelStateNotice: computeLegacyMixerStateNotice(data),
    },
    projectProperties: createProjectPropertiesSnapshot(data.getProjectProperties()),
    clojureProject: createClojureProjectSnapshot(data.getClojureProjectData(), data),
    transport: createToolbarProjectTransportSnapshot(data),
    tablesText: data.getTableSet().getTables(),
    scratchPad: createScratchPadSnapshot(data.getScratchPadData()),
    projectUdos: createProjectUdoListSnapshot(data),
    loaded: true,
    blueLive: createBlueLiveProjectSnapshot(data.getLiveData(), data.getScore().getTimeContext(), {
      includeSerializedXml,
    }),
    midiInput: createMidiInputProcessorSnapshot(data.getMidiInputProcessor()),
    score: createScoreDocumentSnapshot(data, { includeSerializedXml }),
    namedChains: { names: data.getNoteProcessorChainMap().getChainNames() },
  };
}

function createScratchPadSnapshot(data: ScratchPadData): ScratchPadSnapshot {
  return {
    text: data.getScratchText(),
    wordWrapEnabled: data.isWordWrapEnabled(),
  };
}
