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


const MIXER_CHANNEL_IDS = new WeakMap<object, string>();
const MIXER_ENTRY_IDS = new WeakMap<object, string>();
let nextMixerSnapshotId = 1;

export function getArrangementInstrumentOwnerIdentity(assignmentId: string): string {
  return `arrangement:${assignmentId}`;
}

export function getTrackInstrumentOwnerIdentity(rootGroupId: string, trackId: string): string {
  return `track:${rootGroupId}:${trackId}`;
}


export function assignMixerSnapshotId(
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


const LAYER_GROUP_ID_MAP = new WeakMap<object, string>();
let nextLayerGroupId = 1;

const SCORE_OBJECT_ID_MAP = new WeakMap<object, string>();
let nextScoreObjectId = 1;

const PATTERN_LAYER_ID_MAP = new WeakMap<object, string>();
let nextPatternLayerId = 1;

const LAYER_SELECTION_ID_MAP = new WeakMap<object, string>();
let nextLayerSelectionId = 1;

export function assignLayerSelectionId(obj: object): string {
  const existing = LAYER_SELECTION_ID_MAP.get(obj);
  if (existing) return existing;
  const id = `lsel-${nextLayerSelectionId++}`;
  LAYER_SELECTION_ID_MAP.set(obj, id);
  return id;
}

export function assignPatternLayerId(obj: object): string {
  const existing = PATTERN_LAYER_ID_MAP.get(obj);
  if (existing) return existing;
  const id = `pl-${nextPatternLayerId++}`;
  PATTERN_LAYER_ID_MAP.set(obj, id);
  return id;
}

export function assignLayerGroupId(obj: object): string {
  const existing = LAYER_GROUP_ID_MAP.get(obj);
  if (existing) return existing;
  const id = `lg-${nextLayerGroupId++}`;
  LAYER_GROUP_ID_MAP.set(obj, id);
  return id;
}

export function assignScoreObjectId(obj: object, prefix: 'sobj' | 'aclp' = 'sobj'): string {
  const existing = SCORE_OBJECT_ID_MAP.get(obj);
  if (existing) return existing;
  const id = `${prefix}-${nextScoreObjectId++}`;
  SCORE_OBJECT_ID_MAP.set(obj, id);
  return id;
}

export function assignExplicitScoreObjectId(obj: object, id: string): void {
  SCORE_OBJECT_ID_MAP.set(obj, id);
}

/** Returns the stable snapshot ID assigned to an object, or undefined. */
export function getScoreObjectId(obj: object): string | undefined {
  return SCORE_OBJECT_ID_MAP.get(obj);
}

/**
 * Resolve renderer timeline-selection IDs against the main-owned project graph.
 * IDs are assigned while creating score snapshots, so this deliberately returns
 * null for an empty, duplicate, or stale request rather than guessing by index.
 */
