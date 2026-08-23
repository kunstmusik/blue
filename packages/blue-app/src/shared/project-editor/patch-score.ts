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
} from '@blue/data';
import type { NoteProcessorChainSnapshot as DataNoteProcessorChainSnapshot, Parameter as BlueDataParameter, ScoreObject as BlueDataScoreObject, AutomatableLayer as BlueDataAutomatableLayer, Arrangement as BlueDataArrangement, Mixer as BlueDataMixer } from '@blue/data';
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
  getMixerChannelSnapshotId,
  getMixerEntrySnapshotId,
} from './identity';
import {
  applyBsbInterfacePatch,
  applyEmbeddedOpcodeListPatch,
  parseSoundBSB,
} from './bsb-widgets';
import {
  buildEditorTargetSnapshot,
  createBarRendererForAudioClip,
  createBarRendererForSoundObject,
  findPatternsLayerGroupByGroupId,
  resolveEditorTarget,
  resolveTimelineTarget,
  setCodeText,
} from './snapshot-score';
import {
  applyObjectBuilderBsbInterfacePatch,
  applyInstrumentPatch,
  createInstrumentForType,
  createInstrumentFromSnapshot,
  createJMaskEditorPayload,
} from './snapshot-mixer-orchestra';
import {
  applyPianoRollFieldDefinitions,
  createScaleFromSnapshot,
  createTrackerColumnFromSnapshot,
  getPianoRollFieldDefinitionsSnapshot,
  mergeJMaskSnapshotValue,
} from './patch-mixer-bluelive';

function toBlueDataFadeType(value: string | null | undefined): FadeType {
  switch ((value ?? '').trim().toUpperCase().replace(/\s+/g, '_')) {
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
    const markers = data.getMarkersList();
    for (let i = 0; i < markers.size(); i++) {
      const markerTime = markers.getMarkerTimePosition(i);
      const shouldUpdate = markerMode === 'UPDATE_ALL'
        || markerTime.getTimeBase() === oldTimeBase;
      if (shouldUpdate) {
        markers.setMarkerTimePosition(i, convertTimePosition(markerTime, newTimeBase, context));
      }
    }
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

export function isNonEmptyScorePatch(patch: ScorePatch): boolean {
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
  if (patch.type === 'updatePatternCells') {
    return patch.changes.length > 0;
  }
  return true;
}

export function scorePatchTouchesMixerAudioChannels(patch: ScorePatch): boolean {
  switch (patch.type) {
    case 'addLayer':
    case 'removeLayer':
    case 'removeLayerRanges':
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
  return collectManagedLayerGroupLocations(score)
    .find((location) => getManagedLayerGroupId(location.group) === groupId)?.group ?? null;
}

interface ManagedLayerGroupLocation {
  group: ManagedLayerGroup;
  parent: unknown[];
  index: number;
  depth: number;
}

function collectManagedLayerGroupLocations(score: Score): ManagedLayerGroupLocation[] {
  const locations: ManagedLayerGroupLocation[] = [];
  const visited = new Set<ManagedLayerGroup>();

  const visit = (group: ManagedLayerGroup, parent: unknown[], index: number, depth: number): void => {
    if (visited.has(group)) return;
    visited.add(group);
    locations.push({ group, parent, index, depth });

    if (!(group instanceof PolyObject)) return;
    for (const layer of group) {
      for (let objectIndex = 0; objectIndex < layer.length; objectIndex++) {
        const soundObject = layer[objectIndex];
        if (soundObject instanceof PolyObject) {
          visit(soundObject, layer, objectIndex, depth + 1);
        }
      }
    }
  };

  for (let index = 0; index < score.length; index++) {
    const group = score[index];
    if (isManagedLayerGroup(group)) {
      visit(group, score, index, 0);
    }
  }

  return locations;
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

function moveLayerRangeInTypedGroup<T>(
  group: T[],
  startIndex: number,
  endIndex: number,
  targetIndex: number,
): boolean {
  if (startIndex === targetIndex) return false;

  const count = endIndex - startIndex + 1;
  const layers = group.splice(startIndex, count);
  group.splice(targetIndex, 0, ...layers);
  return true;
}

function moveLayerInManagedGroup(
  group: ManagedLayerGroup,
  layerIndex: number,
  targetIndex: number,
): boolean {
  return moveLayerRangeInManagedGroup(group, layerIndex, layerIndex, targetIndex);
}

function moveLayerRangeInManagedGroup(
  group: ManagedLayerGroup,
  startIndex: number,
  endIndex: number,
  targetIndex: number,
): boolean {
  if (!isValidLayerRange(startIndex, endIndex, group.length)
    || !isValidLayerRangeTarget(startIndex, endIndex, targetIndex, group.length)) {
    return false;
  }
  if (group instanceof PolyObject) {
    return moveLayerRangeInTypedGroup(group, startIndex, endIndex, targetIndex);
  }
  if (group instanceof TrackLayerGroup) {
    return moveLayerRangeInTypedGroup(group, startIndex, endIndex, targetIndex);
  }
  return moveLayerRangeInTypedGroup(group, startIndex, endIndex, targetIndex);
}

function applyRemoveLayerRangesPatch(
  data: BlueData,
  patch: Extract<ScorePatch, { type: 'removeLayerRanges' }>,
): boolean {
  const score = data.getScore();
  const ranges = patch.ranges;
  if (!areLayerRangesValid(ranges, (groupId) => findLayerGroupByGroupId(score, groupId)?.length)) return false;

  const byGroup = new Map<string, Array<{ startIndex: number; endIndex: number }>>();
  for (const r of ranges) {
    let list = byGroup.get(r.groupId);
    if (!list) {
      list = [];
      byGroup.set(r.groupId, list);
    }
    list.push({ startIndex: r.startIndex, endIndex: r.endIndex });
  }

  for (const [groupId, groupRanges] of byGroup.entries()) {
    const group = findLayerGroupByGroupId(score, groupId);
    if (!group) continue;
    groupRanges.sort((a, b) => b.startIndex - a.startIndex);
    for (const r of groupRanges) {
      group.removeLayers(r.startIndex, r.endIndex);
    }
  }

  if (patch.deleteEmptyLayerGroups) {
    const affectedGroupIds = new Set(byGroup.keys());
    const emptyGroups = collectManagedLayerGroupLocations(score)
      .filter((location) => (
        affectedGroupIds.has(getManagedLayerGroupId(location.group))
        && location.group.length === 0
      ))
      .sort((left, right) => (
        right.depth - left.depth
        || right.index - left.index
      ));
    for (const location of emptyGroups) {
      if (location.parent[location.index] === location.group) {
        location.parent.splice(location.index, 1);
      }
    }
  }

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
  const soundObjectRefMap = new ObjRefLoadMap();
  for (const entry of data.getSoundObjectLibrary().getEntries()) {
    soundObjectRefMap.register(entry.libraryId, entry.object);
  }
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
          sObj = loadSoundObjectFromXML(serialized, soundObjectRefMap)?.deepCopy() ?? null;
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
    if (sObj instanceof PolyObject && obj.serializedXml) {
      // A serialized PolyObject may contain TIME/BBT/etc. child durations.
      // Recompute its envelope in the canonical project context so the outer
      // duration is not tied to the renderer's fallback conversion context.
      sObj.normalizeSoundObjects(context);
    } else {
      targetObject.setSubjectiveDuration(
        beatsToDuration(obj.durationBeats, (obj.durationTimeBase ?? TimeBase.BEATS) as TimeBase, context),
      );
    }
    targetObject.setBackgroundColor(obj.backgroundColor);

    if (obj.layerIndex < 0 || obj.layerIndex >= targetGroup.length) {
      continue;
    }

    let inserted = false;
    if (targetGroup instanceof TrackLayerGroup) {
      const trackLayer = targetGroup[obj.layerIndex];
      if (!trackLayer) continue;
      if (clip && trackLayer.accepts(clip)) {
        trackLayer.push(clip);
        changed = true;
        inserted = true;
      } else if (sObj && trackLayer.accepts(sObj)) {
        trackLayer.push(sObj);
        changed = true;
        inserted = true;
      }
    } else if (targetGroup instanceof PolyObject && sObj) {
      targetGroup[obj.layerIndex].push(sObj);
      changed = true;
      inserted = true;
    }

    if (inserted && sObj) {
      const instances = collectInstanceSoundObjects([sObj]);
      if (instances.length > 0) {
        data.getSoundObjectLibrary().checkAndAddInstanceSoundObjects(instances);
      }
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

/**
 * Converts a single PythonObject or External into an ObjectBuilder, mirroring
 * Java's remove-then-add behavior. The converted object keeps the source's
 * stable selection id so it remains selected after moving to the layer end.
 */
function applyConvertScoreObjectToObjectBuilder(
  data: BlueData,
  target: ScoreObjectEditorTargetSnapshot,
): boolean {
  const score = data.getScore();
  const location = target.location;
  if (!location) return false;

  const resolved = resolveTimelineTarget(score, location);
  if (!resolved) return false;
  const { sObj, layer, objectIndex } = resolved;
  if (!(sObj instanceof PythonObject) && !(sObj instanceof External)) return false;

  const builder = new ObjectBuilder();

  // Common properties copied from the source (matches Java branches).
  builder.setName(sObj.getName());
  builder.setNoteProcessorChain(new NoteProcessorChain(sObj.getNoteProcessorChain()));
  builder.setTimeBehavior(sObj.getTimeBehavior());
  builder.setStartTime(sObj.getStartTime());
  builder.setSubjectiveDuration(sObj.getSubjectiveDuration());
  builder.setBackgroundColor(sObj.getBackgroundColor());

  if (sObj instanceof PythonObject) {
    builder.setCode(sObj.getPythonCode());
    // languageType defaults to PYTHON from the ObjectBuilder constructor.
  } else {
    builder.setCode(sObj.getText());
    builder.setCommandLine(sObj.getCommandLine());
    builder.setLanguageType('EXTERNAL');
  }

  // Preserve the stable selection id so the converted object stays selected.
  const existingId = getScoreObjectId(sObj);
  if (existingId) {
    assignExplicitScoreObjectId(builder, existingId);
  }

  layer.splice(objectIndex, 1);
  layer.push(builder);
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

    case 'setAutomationResolution': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      try {
        // Parameter parses before mutating, so a malformed edit leaves the
        // canonical project document and its existing point values intact.
        param.setResolutionText(patch.resolutionDecimal);
      } catch {
        return false;
      }
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

function applyConvertToPolyObjectPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'convertToPolyObject' },
): boolean {
  const score = data.getScore();
  const context = score.getTimeContext();

  const targetGroup = findLayerGroupByGroupId(score, patch.targetGroupId);
  if (!(targetGroup instanceof PolyObject)) return false;
  if (patch.targetLayerIndex < 0 || patch.targetLayerIndex >= targetGroup.length) return false;

  const destLayer = targetGroup[patch.targetLayerIndex];
  if (!(destLayer instanceof SoundLayer)) return false;

  const resolvedTargets: Array<{
    sObj: SoundObject;
  }> = [];
  const seenObjects = new Set<SoundObject>();

  for (const target of patch.targets) {
    const location = target.ownerKind === 'library' && target.displayContext === 'instance'
      ? target.sourceInstanceLocation
      : target.location;
    if (!location) return false;

    const resolved = resolveTimelineTarget(score, location);
    if (!resolved || resolved.sObj instanceof AudioClip || seenObjects.has(resolved.sObj)) return false;

    seenObjects.add(resolved.sObj);
    resolvedTargets.push({ sObj: resolved.sObj });
  }

  if (resolvedTargets.length === 0 || resolvedTargets.length !== patch.targets.length) return false;

  const allLayers: Array<SoundLayer | TrackLayer> = [];
  const collectLayers = (container: ManagedLayerGroup): void => {
    if (container instanceof PatternsLayerGroup) return;
    for (let i = 0; i < container.length; i += 1) {
      const layer = container[i];
      if (layer) {
        allLayers.push(layer as SoundLayer | TrackLayer);
        for (const child of layer) {
          if (child instanceof PolyObject) {
            collectLayers(child);
          }
        }
      }
    }
  };

  for (const group of score) {
    if (isManagedLayerGroup(group)) {
      collectLayers(group);
    }
  }

  let layerMin = Infinity;
  let layerMax = -Infinity;
  let startBeatsMin = Infinity;

  const targetItems: Array<{
    sObj: SoundObject;
    layer: SoundLayer | TrackLayer;
    globalLayerIndex: number;
  }> = [];

  for (const item of resolvedTargets) {
    const sObj = item.sObj;
    const gIdx = allLayers.findIndex((l) => l.includes(sObj) || ('contains' in l && l.contains(sObj)));
    if (gIdx === -1) return false;
    const layer = allLayers[gIdx]!;

    const startBeats = sObj.getStartTime().toBeats(context);
    if (startBeats < startBeatsMin) {
      startBeatsMin = startBeats;
    }
    if (gIdx < layerMin) {
      layerMin = gIdx;
    }
    if (gIdx > layerMax) {
      layerMax = gIdx;
    }

    targetItems.push({
      sObj,
      layer,
      globalLayerIndex: gIdx,
    });
  }

  if (
    targetItems.length === 0
    || targetItems.length !== resolvedTargets.length
    || !Number.isFinite(layerMin)
    || !Number.isFinite(layerMax)
  ) {
    return false;
  }

  const pObj = new PolyObject(false);
  pObj.setName('polyObject');
  const numLayers = layerMax - layerMin + 1;
  for (let i = 0; i < numLayers; i += 1) {
    pObj.newLayerAt(-1);
  }

  if (!destLayer.accepts(pObj)) return false;

  for (const item of targetItems) {
    item.layer.remove(item.sObj);
    const destLayerIndex = item.globalLayerIndex - layerMin;
    pObj[destLayerIndex].push(item.sObj);
  }

  pObj.normalizeSoundObjects(context);
  pObj.setStartTime(TimePosition.beats(startBeatsMin));

  if (patch.selectionId?.trim()) {
    assignExplicitScoreObjectId(pObj, patch.selectionId.trim());
  }

  destLayer.push(pObj);

  const instances = collectInstanceSoundObjects([pObj]);
  if (instances.length > 0) {
    data.getSoundObjectLibrary().checkAndAddInstanceSoundObjects(instances);
  }

  return true;
}

/**
 * Atomic boolean-cell mutation for one PatternsLayerGroup. All layer IDs and
 * cell indices are validated before any PatternData is touched; duplicate
 * (layerId, cellIndex) writes reduce to the last change in patch order. A
 * valid patch that only repeats existing values is a no-op (changed: false).
 */
function applyUpdatePatternCellsPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'updatePatternCells' },
): boolean {
  if (patch.changes.length === 0) return false;
  const group = findPatternsLayerGroupByGroupId(data.getScore(), patch.groupId);
  if (!group) return false;

  const layerById = new Map<string, PatternLayer>();
  for (const layer of group) {
    layerById.set(assignPatternLayerId(layer), layer);
  }

  const writes: Array<{ layerId: string; cellIndex: number; active: boolean }> = [];
  const writeIndexByKey = new Map<string, number>();
  for (const change of patch.changes) {
    if (!Number.isInteger(change.cellIndex) || change.cellIndex < 0) return false;
    if (!layerById.has(change.layerId)) return false;
    const key = `${change.layerId}:${change.cellIndex}`;
    const existingIndex = writeIndexByKey.get(key);
    if (existingIndex === undefined) {
      writeIndexByKey.set(key, writes.length);
      writes.push({ layerId: change.layerId, cellIndex: change.cellIndex, active: change.active });
    } else {
      writes[existingIndex] = { layerId: change.layerId, cellIndex: change.cellIndex, active: change.active };
    }
  }

  let changed = false;
  for (const write of writes) {
    const layer = layerById.get(write.layerId)!;
    const patternData = layer.getPatternData();
    if (patternData.isPatternSet(write.cellIndex) === write.active) continue;
    patternData.setPattern(write.cellIndex, write.active);
    changed = true;
  }
  return changed;
}

/**
 * Validated group-wide step-length update. Only finite positive integers are
 * accepted (preserving the Java int model); malformed raw values stay in place
 * until an explicit valid resize. An unchanged value is a no-op.
 */
function applyUpdatePatternBeatsLengthPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'updatePatternBeatsLength' },
): boolean {
  const group = findPatternsLayerGroupByGroupId(data.getScore(), patch.groupId);
  if (!group) return false;
  const length = patch.patternBeatsLength;
  if (!Number.isInteger(length) || length <= 0) return false;
  if (group.getPatternBeatsLength() === length) return false;
  group.setPatternBeatsLength(length);
  return true;
}

export function applyScoreObjectPatch(
  data: BlueData,
  patch: ScorePatch,
  patchContext?: ProjectDocumentPatchContext,
): boolean {
  if (isTrackScorePatch(patch)) {
    return applyTrackScorePatch(data, patch, patchContext);
  }
  if (patch.type === 'updatePatternCells') {
    return applyUpdatePatternCellsPatch(data, patch);
  }
  if (patch.type === 'updatePatternBeatsLength') {
    return applyUpdatePatternBeatsLengthPatch(data, patch);
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

  if (patch.type === 'convertScoreObjectToObjectBuilder') {
    return applyConvertScoreObjectToObjectBuilder(data, patch.target);
  }

  if (patch.type === 'convertToPolyObject') {
    return applyConvertToPolyObjectPatch(data, patch);
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

  if (patch.type === 'moveLayerRange') {
    const score = data.getScore();
    const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
    if (!targetGroup) return false;
    const { startIndex, endIndex, targetIndex } = patch;
    return moveLayerRangeInManagedGroup(targetGroup, startIndex, endIndex, targetIndex);
  }

  if (patch.type === 'removeLayerRanges') {
    return applyRemoveLayerRangesPatch(data, patch);
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
    case 'replaceAudioFileSource': {
      if (!(sObj instanceof AudioFile)) return false;
      sObj.setSoundFileName(patch.filePath);
      sObj.setName(patch.name);
      return true;
    }
    case 'updateAudioFilePostCode': {
      if (!(sObj instanceof AudioFile)) return false;
      sObj.setCsoundPostCode(patch.csoundPostCode);
      return true;
    }
    case 'updateTypeSpecificEditor': {
      if (sObj instanceof ObjectBuilder) {
        const p = patch.patch;
        let changed = false;
        if (p.text !== undefined) {
          sObj.setCode(p.text as string);
          changed = true;
        }
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
        if (p.comment !== undefined) {
          sObj.setComment(p.comment as string);
          changed = true;
        }
        if (p.bsbInterfacePatch !== undefined) {
          changed = applyObjectBuilderBsbInterfacePatch(
            sObj,
            p.bsbInterfacePatch as BsbInterfacePatch,
          ) || changed;
        }
        return changed;
      }
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
        if (p.looping !== undefined) clip.setLooping(context, p.looping as boolean);
        return true;
      }
      if (sObj instanceof AudioFile) {
        const af = sObj as AudioFile;
        const p = patch.patch;
        let changed = false;
        if (p.filePath !== undefined) {
          af.setSoundFileName(p.filePath as string);
          changed = true;
        }
        if (p.csoundPostCode !== undefined) {
          af.setCsoundPostCode(p.csoundPostCode as string);
          changed = true;
        }
        return changed;
      }
      if (sObj instanceof FrozenSoundObject) {
        // FrozenSoundObject file path cannot be mutated through editor patch
        return false;
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
            resolutionDecimal?: string;
          };
          const bsb = parseSoundBSB(snd.getBSBInstrumentText());
          if (bsb) {
            const params = bsb.getParameters();
            const param = params.find(
              (pr: BlueDataParameter) => pr.getUniqueId() === autoPatch.parameterId || pr.getName() === autoPatch.parameterId,
            );
            if (param) {
              if (autoPatch.resolutionDecimal !== undefined) {
                try {
                  // Parse before applying the rest of the patch so malformed
                  // exact text cannot partially mutate the canonical sound.
                  param.setResolutionText(autoPatch.resolutionDecimal);
                } catch {
                  return false;
                }
              }
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

export function applyTempoMapPatch(data: BlueData, tempoPatch: TempoMapPatch): boolean {
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

export function applyMeterMapPatch(data: BlueData, meterPatch: MeterMapPatch): boolean {
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
