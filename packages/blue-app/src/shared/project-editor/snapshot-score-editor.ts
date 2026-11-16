import {
  BlueData,
  CurveType,
  Score,
  PolyObject,
  TrackLayerGroup,
  PatternsLayerGroup,
  SoundObject,
  Instance,
  AbstractSoundObject,
  NoteProcessorChain,
  AudioClip,
  TimeContext,
  GenericScore,
  PythonObject,
  ClojureObject,
  JavaScriptObject,
  Comment,
  External,
  AudioFile,
  FrozenSoundObject,
  PatternObject,
  LineObject,
  ZakLineObject,
  PianoRoll,
  TrackerObject,
  JMask,
  Sound,
  ObjectBuilder,
  createNoteProcessorChainSnapshot as createNoteProcessorChainSnapshotFromData,
} from '@blue/data';
import type { ScoreObject as BlueDataScoreObject } from '@blue/data';

import type {
  AudioFadeType,
  ScoreObjectLocationRef,
  PatternSourceObjectLocationRef,
  ScoreObjectEditorTargetSnapshot,
  TimeConversionMeterEntry,
  TimeConversionContext,
  TimeValueSnapshot,
  NoteProcessorChainSnapshot,
  SharedScoreObjectPropertiesSnapshot,
  TrackerColumnSnapshot,
  TypeSpecificScoreObjectEditorSnapshot,
  ScoreObjectEditorDocumentSnapshot,
  ScoreObjectEditorRequest,
  LiveObjectCellSnapshot,
  BlueSynthBuilderInstrumentSnapshot,
  SoundEditorTab,
  SoundAutomationParameterSnapshot,
  SoundEditorPayload,
} from './contract';
import {
  assignLayerGroupId,
  assignPatternLayerId,
  assignScoreObjectId,
  getScoreObjectId,
  recordScoreObjectIdForData,
  wasScoreObjectIdAssignedInData,
} from './identity';
import { buildSoundAutomationParameters, parseSoundBSB } from './bsb-widgets';
import {
  buildObjectBuilderBsbInstrumentSnapshot,
  buildSoundBSBInstrumentSnapshot,
  createJMaskEditorPayload,
  createJMaskPayloadSummary,
  createTrackerColumnSnapshot,
} from './snapshot-mixer-orchestra';

export function normalizeAudioFadeType(value: string | null | undefined): AudioFadeType {
  switch (
    (value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_')
  ) {
    case 'CONSTANT_POWER':
      return 'CONSTANT_POWER';
    case 'SYMMETRIC':
    case 'S_CURVE':
      return 'S_CURVE';
    case 'FAST':
      return 'FAST';
    case 'SLOW':
      return 'SLOW';
    case 'LINEAR':
    default:
      return 'LINEAR';
  }
}

export function resolveTimelineScoreObjects(
  data: BlueData,
  objectIds: readonly string[],
): BlueDataScoreObject[] | null {
  if (
    objectIds.length === 0 ||
    objectIds.some((id) => id.trim().length === 0) ||
    new Set(objectIds).size !== objectIds.length
  )
    return null;
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
    target.selectedObjectType !== 'Instance' ||
    target.displayContext !== 'instance' ||
    !target.sourceInstanceLocation
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
  if (sObj instanceof GenericScore) {
    sObj.setScoreText(text);
    return true;
  }
  if (sObj instanceof PythonObject) {
    sObj.setPythonCode(text);
    return true;
  }
  if (sObj instanceof ObjectBuilder) {
    sObj.setCode(text);
    return true;
  }
  if (sObj instanceof ClojureObject) {
    sObj.setClojureCode(text);
    return true;
  }
  if (sObj instanceof JavaScriptObject) {
    sObj.setJavaScriptCode(text);
    return true;
  }
  if (sObj instanceof Comment) {
    sObj.setText(text);
    return true;
  }
  if (sObj instanceof External) {
    sObj.setText(text);
    return true;
  }
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
    case 'PythonObject':
      return 'python';
    case 'JavaScriptObject':
      return 'javascript';
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
    case 'GenericScore':
      return 'csound-score';
    default:
      return 'text';
  }
}

export function resolveTimelineTarget(
  score: Score,
  location: ScoreObjectLocationRef,
): {
  sObj: SoundObject | AudioClip;
  layer: Array<SoundObject | AudioClip>;
  objectIndex: number;
} | null {
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

export function findPatternsLayerGroupByGroupId(
  score: Score,
  groupId: string,
): PatternsLayerGroup | null {
  for (const group of score) {
    if (group instanceof PatternsLayerGroup && assignLayerGroupId(group) === groupId) {
      return group;
    }
  }
  return null;
}

/**
 * Records all score object IDs currently bound within `data`'s score tree so
 * subsequent timeline target resolution can tell deleted objects apart from
 * fresh workspace documents.
 */
export function recordExistingScoreObjectIds(data: BlueData): void {
  const recordObj = (obj: object | null | undefined): void => {
    if (!obj) return;
    const id = getScoreObjectId(obj);
    if (id) {
      recordScoreObjectIdForData(data, id);
    }
  };
  const walkPolyObject = (poly: PolyObject): void => {
    recordObj(poly);
    for (const layer of poly) {
      for (const item of layer) {
        recordObj(item);
        if (item instanceof PolyObject) {
          walkPolyObject(item);
        }
      }
    }
  };
  for (const group of data.getScore()) {
    if (group instanceof PolyObject) {
      walkPolyObject(group);
    } else if (group instanceof TrackLayerGroup) {
      for (const layer of group) {
        for (const item of layer) {
          recordObj(item);
          if (item instanceof PolyObject) {
            walkPolyObject(item);
          }
        }
      }
    } else if (group instanceof PatternsLayerGroup) {
      for (const layer of group) {
        recordObj(layer.getSoundObject());
      }
    }
  }
}

export interface ScoreTimelineEntry {
  sObj: SoundObject | AudioClip;
  layer: Array<SoundObject | AudioClip>;
  objectIndex: number;
}

export interface ScoreLookupCache {
  entryBySelectionId?: Map<string, ScoreTimelineEntry>;
}

function collectTimelineEntriesBySelectionId(score: Score): Map<string, ScoreTimelineEntry> {
  const entries = new Map<string, ScoreTimelineEntry>();
  const walkLayers = (layers: Iterable<Array<SoundObject | AudioClip>>): void => {
    for (const layer of layers) {
      for (let objectIndex = 0; objectIndex < layer.length; objectIndex += 1) {
        const sObj = layer[objectIndex];
        if (!sObj) continue;
        const id = getScoreObjectId(sObj);
        if (id && !entries.has(id)) {
          entries.set(id, { sObj, layer, objectIndex });
        }
        if (sObj instanceof PolyObject) {
          walkLayers(sObj as unknown as Iterable<Array<SoundObject | AudioClip>>);
        }
      }
    }
  };
  for (const group of score) {
    if (group instanceof PolyObject || group instanceof TrackLayerGroup) {
      walkLayers(group as unknown as Iterable<Array<SoundObject | AudioClip>>);
    }
  }
  return entries;
}

function findTimelineEntryBySelectionId(
  score: Score,
  targetId: string,
  lookupCache?: ScoreLookupCache,
): ScoreTimelineEntry | null {
  if (lookupCache) {
    lookupCache.entryBySelectionId ??= collectTimelineEntriesBySelectionId(score);
    return lookupCache.entryBySelectionId.get(targetId) ?? null;
  }
  const walkLayers = (
    layers: Iterable<Array<SoundObject | AudioClip>>,
  ): ScoreTimelineEntry | null => {
    for (const layer of layers) {
      for (let objectIndex = 0; objectIndex < layer.length; objectIndex += 1) {
        const sObj = layer[objectIndex];
        if (!sObj) continue;
        if (getScoreObjectId(sObj) === targetId) {
          return { sObj, layer, objectIndex };
        }
        if (sObj instanceof PolyObject) {
          const nested = walkLayers(sObj as unknown as Iterable<Array<SoundObject | AudioClip>>);
          if (nested) return nested;
        }
      }
    }
    return null;
  };
  for (const group of score) {
    if (group instanceof PolyObject || group instanceof TrackLayerGroup) {
      const found = walkLayers(group as unknown as Iterable<Array<SoundObject | AudioClip>>);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Resolves a timeline target at `location`, verifying `selectionId` when present
 * and locating moved objects by stable identity while rejecting deleted IDs.
 */
export function resolveTimelineTargetWithSelectionId(
  data: BlueData,
  location: ScoreObjectLocationRef,
  selectionId?: string,
  lookupCache?: ScoreLookupCache,
): ScoreTimelineEntry | null {
  const score = data.getScore();
  const positional = resolveTimelineTarget(score, location);
  const trimmedId = selectionId?.trim() ?? '';
  if (trimmedId.length === 0) {
    return positional;
  }
  if (positional && getScoreObjectId(positional.sObj) === trimmedId) {
    recordScoreObjectIdForData(data, trimmedId);
    return positional;
  }
  const byId = findTimelineEntryBySelectionId(score, trimmedId, lookupCache);
  if (byId) {
    recordScoreObjectIdForData(data, trimmedId);
    return byId;
  }
  if (wasScoreObjectIdAssignedInData(data, trimmedId)) {
    return null;
  }
  return positional;
}

function resolveTimelineObjectForTarget(
  data: BlueData,
  location: ScoreObjectLocationRef,
  selectionId: string,
  lookupCache?: ScoreLookupCache,
): SoundObject | AudioClip | null {
  return (
    resolveTimelineTargetWithSelectionId(data, location, selectionId, lookupCache)?.sObj ?? null
  );
}

export function resolveEditorTarget(
  data: BlueData,
  target: ScoreObjectEditorTargetSnapshot,
  lookupCache?: ScoreLookupCache,
): { sObj: SoundObject | AudioClip; isLibraryOwned: boolean } | null {
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
        const timelineResolved = resolveTimelineObjectForTarget(
          data,
          instLoc,
          target.selectionId,
          lookupCache,
        );
        if (timelineResolved instanceof Instance) {
          sObj = timelineResolved.getSoundObject();
        }
      }
    }
  } else {
    const loc = target.location;
    if (!loc) {
      const trimmedId = target.selectionId.trim();
      if (trimmedId.length > 0) {
        sObj = lookupCache
          ? (findTimelineEntryBySelectionId(score, trimmedId, lookupCache)?.sObj ?? null)
          : ((resolveTimelineScoreObjects(data, [target.selectionId])?.[0] ?? null) as
              SoundObject | AudioClip | null);
      } else {
        sObj = null;
      }
    } else {
      sObj = resolveTimelineObjectForTarget(data, loc, target.selectionId, lookupCache);
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

function createTimeConversionContext(
  context: TimeContext,
  smpteFrameRate: number,
  smpteDropFrame: boolean,
): TimeConversionContext {
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
    tempoPoints: tempoPoints.map((point) => ({
      beat: point.beat,
      tempo: point.tempo,
      curveType: point.curveType === CurveType.CONSTANT ? 'constant' : 'linear',
    })),
    sampleRate: context.getSampleRate(),
    smpteFrameRate,
    smpteDropFrame,
  };
}

export function createNoteProcessorChainSnapshot(
  chain: NoteProcessorChain,
): NoteProcessorChainSnapshot {
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
      editor: {
        kind: 'fallback',
        target,
        reason: 'removed-target',
        message: 'Score object no longer exists.',
      },
      timeContext: createTimeConversionContext(
        data.getScore().getTimeContext(),
        data.getScore().getTimeState().getSmpteFrameRate(),
        data.getScore().getTimeState().isSmpteDropFrame(),
      ),
    };
  }

  const { sObj } = resolved;
  const score = data.getScore();
  const context = score.getTimeContext();
  const primaryDisplay = score.getTimeState().getTimeDisplay() as string;
  const isSoundObject = sObj instanceof AbstractSoundObject;

  const startTime =
    sObj instanceof AudioClip
      ? sObj.getStartTime().toBeats(context)
      : (sObj as SoundObject).getStartTime().toBeats(context);
  const startTimeBase = String(
    sObj instanceof AudioClip
      ? sObj.getStartTime().getTimeBase()
      : (sObj as SoundObject).getStartTime().getTimeBase(),
  );
  const duration =
    sObj instanceof AudioClip
      ? sObj.getSubjectiveDuration().toBeats(context)
      : (sObj as SoundObject).getSubjectiveDuration().toBeats(context);
  const durationBase = String(
    sObj instanceof AudioClip
      ? sObj.getSubjectiveDuration().getTimeBase()
      : (sObj as SoundObject).getSubjectiveDuration().getTimeBase(),
  );

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
        fadeInType: normalizeAudioFadeType(
          clip.getFadeInType ? String(clip.getFadeInType()) : 'LINEAR',
        ),
        fadeOut: clip.getFadeOut ? clip.getFadeOut() : 0,
        fadeOutType: normalizeAudioFadeType(
          clip.getFadeOutType ? String(clip.getFadeOutType()) : 'LINEAR',
        ),
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
          const childId = assignScoreObjectId(child, 'sobj');
          recordScoreObjectIdForData(data, childId);
          children.push({
            objectId: childId,
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
            lines: lo.getLines().map((l) => ({
              varName: l.varName,
              min: l.min,
              max: l.max,
              resolution: l.resolution,
              color: l.color,
              rightBound: l.rightBound,
              endPointsLinked: l.endPointsLinked,
              points: l.points.map((pt) => ({ x: pt.x, y: pt.y })),
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
            lines: zlo.getLines().map((l) => ({
              channel: l.channel,
              min: l.min,
              max: l.max,
              resolution: l.resolution,
              color: l.color,
              rightBound: l.rightBound,
              endPointsLinked: l.endPointsLinked,
              points: l.points.map((pt) => ({ x: pt.x, y: pt.y })),
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

  return {
    target,
    shared,
    editor,
    timeContext: createTimeConversionContext(
      context,
      score.getTimeState().getSmpteFrameRate(),
      score.getTimeState().isSmpteDropFrame(),
    ),
  };
}

export function createFallbackEditorDocument(
  reason: TypeSpecificScoreObjectEditorSnapshot extends { kind: 'fallback'; reason: infer R }
    ? R
    : never,
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
    timeContext: {
      meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
      tempoEnabled: false,
      initialTempo: 60,
      sampleRate: 44100,
    },
  };
}
