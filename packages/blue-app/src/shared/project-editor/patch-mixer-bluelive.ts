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
  assignLayerGroupId,
  assignLayerSelectionId,
  assignScoreObjectId,
  getScoreObjectId,
  getMixerChannelSnapshotId,
  getMixerEntrySnapshotId,
} from './identity';
import {
  applyBsbInterfacePatch,
  applyEmbeddedOpcodeListPatch,
} from './bsb-widgets';
import {
  buildAssignedAutomationLayerMap,
  buildAssignedElsewhereMapForLayer,
  buildEditorTargetSnapshot,
  collectLayerAutomationSnapshot,
  createBarRendererForSoundObject,
  createNoteProcessorChainSnapshot,
  splitLabelLines,
} from './snapshot-score';
import {
  createClojureProjectSnapshot,
  createMixerSnapshot,
  createOrchestraSnapshot,
  findTrackByAssociation,
  findTrackLayerGroupByAssociation,
} from './snapshot-mixer-orchestra';

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



export function createScaleFromSnapshot(snapshot: MidiScaleSnapshot | null): Scale | null {
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

export function mergeJMaskSnapshotValue(baseValue: unknown, patchValue: unknown): unknown {
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

export function getPianoRollFieldDefinitionsSnapshot(pr: PianoRoll): Array<{
  fieldName: string;
  fieldType: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
}> {
  return pr.getFieldDefinitions().map(createPianoRollFieldDefSnapshot);
}

export function applyPianoRollFieldDefinitions(
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

export function createTrackerColumnFromSnapshot(snapshot: TrackerColumnSnapshot): Column {
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

export function applyMidiInputPatch(
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

export function applyBlueLivePatch(data: BlueData, patch: BlueLivePatch): boolean {
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

export function applyMixerPatchToData(data: BlueData, patch: MixerPatch): boolean {
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
      layerSelectionId: assignLayerSelectionId(subLayer),
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


export { reconcileMixerSnapshotWithArrangement, reconcileMixerWithArrangement } from './snapshot-mixer-orchestra';
