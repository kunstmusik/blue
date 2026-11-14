import { transferHistoryNodeIds } from './history-node-identity';
import {
  BlueData,
  AbstractSoundObject,
  AudioClip,
  TrackLayer,
  SoundLayer,
  Preset,
  TempoPoint,
  MarkersList,
  Channel,
  Effect,
  Send,
  Mixer,
  PolyObject,
  TrackLayerGroup,
  PatternsLayerGroup,
  PatternLayer,
  SoundObject,
  Instance,
  Sound,
  PatternObject,
  Instrument,
  BlueSynthBuilder,
  BSBGroup,
  BSBWidget,
  BSBDropdown,
  PresetGroup,
  Parameter,
  ClojureLibraryEntry,
} from '@blue/data';

// ─── Arrangement & Track Owner Identities ───

export function getArrangementInstrumentOwnerIdentity(assignmentId: string): string {
  return `arrangement:${assignmentId}`;
}

export function getTrackInstrumentOwnerIdentity(rootGroupId: string, trackId: string): string {
  return `track:${rootGroupId}:${trackId}`;
}

// ─── Mixer Snapshot Identities ───

const MIXER_CHANNEL_IDS = new WeakMap<object, string>();
const MIXER_ENTRY_IDS = new WeakMap<object, string>();
let nextMixerSnapshotId = 1;

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

  const id =
    preferredId && preferredId.trim().length > 0
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

export function assignExplicitMixerChannelSnapshotId(channel: Channel, id: string): void {
  MIXER_CHANNEL_IDS.set(channel, id);
}

export function getKnownMixerChannelSnapshotId(channel: Channel): string | undefined {
  return MIXER_CHANNEL_IDS.get(channel);
}

export function getMixerEntrySnapshotId(entry: Effect | Send, preferredId?: string): string {
  return assignMixerSnapshotId(
    MIXER_ENTRY_IDS,
    entry,
    entry instanceof Effect ? 'mixer-effect' : 'mixer-send',
    preferredId,
  );
}

export function assignExplicitMixerEntrySnapshotId(entry: Effect | Send, id: string): void {
  MIXER_ENTRY_IDS.set(entry, id);
}

export function getKnownMixerEntrySnapshotId(entry: Effect | Send): string | undefined {
  return MIXER_ENTRY_IDS.get(entry);
}

// ─── Score, Layer & Object Snapshot Identities ───

const LAYER_GROUP_ID_MAP = new WeakMap<object, string>();
let nextLayerGroupId = 1;

const SCORE_OBJECT_ID_MAP = new WeakMap<object, string>();
const DATA_ASSIGNED_SCORE_OBJECT_IDS = new WeakMap<BlueData, Set<string>>();
let nextScoreObjectId = 1;

const PATTERN_LAYER_ID_MAP = new WeakMap<object, string>();
let nextPatternLayerId = 1;

const LAYER_SELECTION_ID_MAP = new WeakMap<object, string>();
let nextLayerSelectionId = 1;

// Markers are exposed by the data model as detached XML, so their runtime
// identities follow the owning list rather than those temporary elements.
const MARKER_IDS = new WeakMap<object, string[]>();
const TEMPO_POINT_IDS = new WeakMap<object, string>();

function validTransientId(id: string, prefix: 'marker' | 'tempo'): boolean {
  return new RegExp(
    `^${prefix}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
    'i',
  ).test(id);
}

export function getMarkerSnapshotIds(list: ReturnType<BlueData['getMarkersList']>): string[] {
  let ids = MARKER_IDS.get(list);
  if (!ids) {
    ids = Array.from({ length: list.size() }, () => `marker-${crypto.randomUUID()}`);
    MARKER_IDS.set(list, ids);
  }
  return ids;
}

export function appendMarkerSnapshotId(
  list: ReturnType<BlueData['getMarkersList']>,
  id?: string,
): void {
  const ids = getMarkerSnapshotIds(list);
  const nextId = id ?? `marker-${crypto.randomUUID()}`;
  if (typeof nextId !== 'string' || !validTransientId(nextId, 'marker') || ids.includes(nextId))
    throw new Error('Marker identity must be a unique marker UUID.');
  ids.push(nextId);
}

export function removeMarkerSnapshotId(
  list: ReturnType<BlueData['getMarkersList']>,
  index: number,
): void {
  getMarkerSnapshotIds(list).splice(index, 1);
}

export function getTempoPointSnapshotId(point: object, preferredId?: string): string {
  let id = TEMPO_POINT_IDS.get(point);
  if (!id) {
    id = preferredId ?? `tempo-${crypto.randomUUID()}`;
    if (typeof id !== 'string' || !validTransientId(id, 'tempo'))
      throw new Error('Tempo point identity must be a tempo UUID.');
    TEMPO_POINT_IDS.set(point, id);
  }
  return id;
}

export function assignLayerSelectionId(obj: object): string {
  const existing = LAYER_SELECTION_ID_MAP.get(obj);
  if (existing) return existing;
  const id = `lsel-${nextLayerSelectionId++}`;
  LAYER_SELECTION_ID_MAP.set(obj, id);
  return id;
}

export function assignExplicitLayerSelectionId(obj: object, id: string): void {
  LAYER_SELECTION_ID_MAP.set(obj, id);
}

export function getLayerSelectionId(obj: object): string | undefined {
  return LAYER_SELECTION_ID_MAP.get(obj);
}

export function assignPatternLayerId(obj: object): string {
  const existing = PATTERN_LAYER_ID_MAP.get(obj);
  if (existing) return existing;
  const id = `pl-${nextPatternLayerId++}`;
  PATTERN_LAYER_ID_MAP.set(obj, id);
  return id;
}

export function assignExplicitPatternLayerId(obj: object, id: string): void {
  PATTERN_LAYER_ID_MAP.set(obj, id);
}

export function getPatternLayerId(obj: object): string | undefined {
  return PATTERN_LAYER_ID_MAP.get(obj);
}

export function assignLayerGroupId(obj: object): string {
  const existing = LAYER_GROUP_ID_MAP.get(obj);
  if (existing) return existing;
  const id = `lg-${nextLayerGroupId++}`;
  LAYER_GROUP_ID_MAP.set(obj, id);
  return id;
}

export function assignExplicitLayerGroupId(obj: object, id: string): void {
  LAYER_GROUP_ID_MAP.set(obj, id);
}

export function getLayerGroupId(obj: object): string | undefined {
  return LAYER_GROUP_ID_MAP.get(obj);
}

export function assignScoreObjectId(obj: object, prefix: 'sobj' | 'aclp' = 'sobj'): string {
  const existing = SCORE_OBJECT_ID_MAP.get(obj);
  if (existing) {
    return existing;
  }
  const id = `${prefix}-${nextScoreObjectId++}`;
  SCORE_OBJECT_ID_MAP.set(obj, id);
  return id;
}

export function assignExplicitScoreObjectId(obj: object, id: string): void {
  SCORE_OBJECT_ID_MAP.set(obj, id);
}

export function getScoreObjectId(obj: object): string | undefined {
  return SCORE_OBJECT_ID_MAP.get(obj);
}

/**
 * Tracks a score object ID that has been bound within `data` so timeline
 * resolution can distinguish a deleted object from an un-ID'd object in a
 * fresh workspace `BlueData` instance.
 */
export function recordScoreObjectIdForData(data: BlueData, id: string): void {
  const trimmed = id.trim();
  if (trimmed.length === 0) return;
  let assigned = DATA_ASSIGNED_SCORE_OBJECT_IDS.get(data);
  if (!assigned) {
    assigned = new Set();
    DATA_ASSIGNED_SCORE_OBJECT_IDS.set(data, assigned);
  }
  assigned.add(trimmed);
}

export function wasScoreObjectIdAssignedInData(data: BlueData, id: string): boolean {
  const trimmed = id.trim();
  if (trimmed.length === 0) return false;
  return DATA_ASSIGNED_SCORE_OBJECT_IDS.get(data)?.has(trimmed) ?? false;
}

// ─── Non-XML Sidecar Maps: Parameters, BSB Widgets, Presets, Dropdown Links, Library References ───

const PARAMETER_ID_MAP = new WeakMap<object, string>();
let nextParameterId = 1;

export function assignParameterSnapshotId(param: object, preferredId?: string): string {
  const existing = PARAMETER_ID_MAP.get(param);
  if (existing) return existing;
  const id =
    preferredId && preferredId.trim().length > 0
      ? preferredId.trim()
      : `param-${nextParameterId++}`;
  PARAMETER_ID_MAP.set(param, id);
  return id;
}

export function assignExplicitParameterSnapshotId(param: object, id: string): void {
  PARAMETER_ID_MAP.set(param, id);
}

export function getParameterSnapshotId(param: object): string | undefined {
  return PARAMETER_ID_MAP.get(param);
}

const BSB_GESTURE_TARGET_IDS = new WeakMap<object, string>();
let nextBsbGestureTargetId = 1;

/** Transient incarnation identity: replacing a widget may reuse its serialized ID. */
export function getBsbGestureTargetId(widget: object): string {
  let id = BSB_GESTURE_TARGET_IDS.get(widget);
  if (!id) {
    id = `bsb-target-${nextBsbGestureTargetId++}`;
    BSB_GESTURE_TARGET_IDS.set(widget, id);
  }
  return id;
}

const BSB_WIDGET_ID_MAP = new WeakMap<object, string>();
let nextBsbWidgetId = 1;

export function assignBsbWidgetSnapshotId(widget: object, preferredId?: string): string {
  const existing = BSB_WIDGET_ID_MAP.get(widget);
  if (existing) return existing;
  const id =
    preferredId && preferredId.trim().length > 0 ? preferredId.trim() : `bsbw-${nextBsbWidgetId++}`;
  BSB_WIDGET_ID_MAP.set(widget, id);
  return id;
}

export function assignExplicitBsbWidgetSnapshotId(widget: object, id: string): void {
  BSB_WIDGET_ID_MAP.set(widget, id);
}

export function getBsbWidgetSnapshotId(widget: object): string | undefined {
  return BSB_WIDGET_ID_MAP.get(widget);
}

const PRESET_ID_MAP = new WeakMap<object, string>();
let nextPresetId = 1;

export function assignPresetSnapshotId(preset: object, preferredId?: string): string {
  const existing = PRESET_ID_MAP.get(preset);
  if (existing) return existing;
  const id =
    preferredId && preferredId.trim().length > 0 ? preferredId.trim() : `preset-${nextPresetId++}`;
  PRESET_ID_MAP.set(preset, id);
  return id;
}

export function assignExplicitPresetSnapshotId(preset: object, id: string): void {
  PRESET_ID_MAP.set(preset, id);
}

export function getPresetSnapshotId(preset: object): string | undefined {
  return PRESET_ID_MAP.get(preset);
}

const DROPDOWN_LINK_ID_MAP = new WeakMap<object, string>();
let nextDropdownLinkId = 1;

export function assignDropdownLinkSnapshotId(item: object, preferredId?: string): string {
  const existing = DROPDOWN_LINK_ID_MAP.get(item);
  if (existing) return existing;
  const id =
    preferredId && preferredId.trim().length > 0
      ? preferredId.trim()
      : `ddlink-${nextDropdownLinkId++}`;
  DROPDOWN_LINK_ID_MAP.set(item, id);
  return id;
}

export function assignExplicitDropdownLinkSnapshotId(item: object, id: string): void {
  DROPDOWN_LINK_ID_MAP.set(item, id);
}

export function getDropdownLinkSnapshotId(item: object): string | undefined {
  return DROPDOWN_LINK_ID_MAP.get(item);
}

const LIBRARY_REFERENCE_ID_MAP = new WeakMap<object, string>();
let nextLibraryRefId = 1;

export function assignLibraryReferenceSnapshotId(ref: object, preferredId?: string): string {
  const existing = LIBRARY_REFERENCE_ID_MAP.get(ref);
  if (existing) return existing;
  const id =
    preferredId && preferredId.trim().length > 0
      ? preferredId.trim()
      : `libref-${nextLibraryRefId++}`;
  LIBRARY_REFERENCE_ID_MAP.set(ref, id);
  return id;
}

export function assignExplicitLibraryReferenceSnapshotId(ref: object, id: string): void {
  LIBRARY_REFERENCE_ID_MAP.set(ref, id);
}

export function getLibraryReferenceSnapshotId(ref: object): string | undefined {
  return LIBRARY_REFERENCE_ID_MAP.get(ref);
}

const CLOJURE_LIBRARY_ENTRY_ID_MAP = new WeakMap<object, string>();
let nextClojureLibraryEntryId = 1;
const CLOJURE_PROJECT_ENTRY_IDS_MAP = new WeakMap<object, string[]>();

export function assignClojureLibraryEntrySnapshotId(
  entry: ClojureLibraryEntry,
  preferredId?: string,
): string {
  const existing = CLOJURE_LIBRARY_ENTRY_ID_MAP.get(entry);
  if (existing) return existing;
  const id =
    preferredId && preferredId.trim().length > 0
      ? preferredId.trim()
      : `clj-lib-${nextClojureLibraryEntryId++}`;
  CLOJURE_LIBRARY_ENTRY_ID_MAP.set(entry, id);
  return id;
}

export function assignExplicitClojureLibraryEntrySnapshotId(
  entry: ClojureLibraryEntry,
  id: string,
): void {
  CLOJURE_LIBRARY_ENTRY_ID_MAP.set(entry, id);
}

export function getClojureLibraryEntrySnapshotId(entry: ClojureLibraryEntry): string | undefined {
  return CLOJURE_LIBRARY_ENTRY_ID_MAP.get(entry);
}

export function getClojureProjectEntrySnapshotIds(owner: object): readonly string[] | undefined {
  return CLOJURE_PROJECT_ENTRY_IDS_MAP.get(owner);
}

export function setClojureProjectEntrySnapshotIds(owner: object, ids: readonly string[]): void {
  CLOJURE_PROJECT_ENTRY_IDS_MAP.set(owner, [...ids]);
}

export function transferClojureProjectEntrySnapshotIds(source: object, target: object): void {
  const ids = CLOJURE_PROJECT_ENTRY_IDS_MAP.get(source);
  if (ids) {
    CLOJURE_PROJECT_ENTRY_IDS_MAP.set(target, [...ids]);
  }
}

// The ordered tuple is internal metadata for app-local history, never a serialized format.
const GRAPH_EDITOR_ID_MAPS = [
  MIXER_CHANNEL_IDS,
  MIXER_ENTRY_IDS,
  LAYER_GROUP_ID_MAP,
  SCORE_OBJECT_ID_MAP,
  PATTERN_LAYER_ID_MAP,
  LAYER_SELECTION_ID_MAP,
  TEMPO_POINT_IDS,
  PARAMETER_ID_MAP,
  BSB_GESTURE_TARGET_IDS,
  BSB_WIDGET_ID_MAP,
  PRESET_ID_MAP,
  DROPDOWN_LINK_ID_MAP,
  LIBRARY_REFERENCE_ID_MAP,
  CLOJURE_LIBRARY_ENTRY_ID_MAP,
] as const;
export interface GraphEditorMetadata {
  ids: Array<string | undefined>;
  markers?: string[];
  clojureEntries?: string[];
}

export function readGraphEditorMetadata(value: object): GraphEditorMetadata {
  if (value instanceof BSBWidget) {
    getBsbGestureTargetId(value);
    assignBsbWidgetSnapshotId(value, value.id);
  }
  if (value instanceof BSBDropdown)
    for (const item of value.dropdownItems) assignDropdownLinkSnapshotId(item, item.uniqueId);
  if (value instanceof AbstractSoundObject)
    assignScoreObjectId(value, value instanceof AudioClip ? 'aclp' : 'sobj');
  if (value instanceof Channel) getMixerChannelSnapshotId(value);
  if (value instanceof Effect || value instanceof Send) getMixerEntrySnapshotId(value);
  if (value instanceof Parameter) assignParameterSnapshotId(value, value.getUniqueId());
  if (value instanceof Preset) assignPresetSnapshotId(value, value.getUniqueId());
  if (
    value instanceof TrackLayerGroup ||
    value instanceof PolyObject ||
    value instanceof PatternsLayerGroup
  )
    assignLayerGroupId(value);
  if (value instanceof TrackLayer || value instanceof SoundLayer) assignLayerSelectionId(value);
  if (value instanceof PatternLayer) assignPatternLayerId(value);
  if (value instanceof TempoPoint) getTempoPointSnapshotId(value);
  if (value instanceof MarkersList) getMarkerSnapshotIds(value);
  if (value instanceof ClojureLibraryEntry) assignClojureLibraryEntrySnapshotId(value);
  return {
    ids: GRAPH_EDITOR_ID_MAPS.map((map) => map.get(value)),
    markers: MARKER_IDS.get(value)?.slice(),
    clojureEntries: CLOJURE_PROJECT_ENTRY_IDS_MAP.get(value)?.slice(),
  };
}

export function restoreGraphEditorMetadata(value: object, metadata: GraphEditorMetadata): void {
  GRAPH_EDITOR_ID_MAPS.forEach((map, i) => {
    const id = metadata.ids[i];
    if (id === undefined) map.delete(value);
    else map.set(value, id);
  });
  if (metadata.markers) MARKER_IDS.set(value, metadata.markers.slice());
  else MARKER_IDS.delete(value);
  if (metadata.clojureEntries)
    CLOJURE_PROJECT_ENTRY_IDS_MAP.set(value, metadata.clojureEntries.slice());
  else CLOJURE_PROJECT_ENTRY_IDS_MAP.delete(value);
}

// ─── Identity Transfer Mapping ───

export interface IdentityTransferMap {
  /** Forward mapping from source model object references to target model object references. */
  sourceToTarget: Map<object, object>;
  /** Reverse mapping from target model object references to source model object references. */
  targetToSource: Map<object, object>;
  /** Total count of sidecar identities transferred. */
  transferredCount: number;
}

/**
 * Traverse corresponding subtrees of `source` and `target` in parallel, recording
 * bidirectional object references and transferring all non-XML identity sidecars
 * so that score objects, layers, mixer entries, parameters, BSB widgets, presets,
 * dropdown links, library references, and Clojure project entries survive history
 * capture and replay.
 */
export function transferProjectEditorIdentities(
  source: BlueData,
  target: BlueData,
): IdentityTransferMap {
  const sourceToTarget = new Map<object, object>();
  const targetToSource = new Map<object, object>();
  let transferredCount = 0;

  function pair(src: object | null | undefined, tgt: object | null | undefined): void {
    if (!src || !tgt || typeof src !== 'object' || typeof tgt !== 'object') return;
    if (sourceToTarget.has(src)) return;

    sourceToTarget.set(src, tgt);
    targetToSource.set(tgt, src);

    if (SCORE_OBJECT_ID_MAP.has(src)) {
      const scoreObjectId = SCORE_OBJECT_ID_MAP.get(src)!;
      SCORE_OBJECT_ID_MAP.set(tgt, scoreObjectId);
      recordScoreObjectIdForData(source, scoreObjectId);
      recordScoreObjectIdForData(target, scoreObjectId);
      transferredCount++;
    }
    if (LAYER_GROUP_ID_MAP.has(src)) {
      LAYER_GROUP_ID_MAP.set(tgt, LAYER_GROUP_ID_MAP.get(src)!);
      transferredCount++;
    }
    if (PATTERN_LAYER_ID_MAP.has(src)) {
      PATTERN_LAYER_ID_MAP.set(tgt, PATTERN_LAYER_ID_MAP.get(src)!);
      transferredCount++;
    }
    if (LAYER_SELECTION_ID_MAP.has(src)) {
      LAYER_SELECTION_ID_MAP.set(tgt, LAYER_SELECTION_ID_MAP.get(src)!);
      transferredCount++;
    }
    if (TEMPO_POINT_IDS.has(src)) {
      TEMPO_POINT_IDS.set(tgt, TEMPO_POINT_IDS.get(src)!);
      transferredCount++;
    }
    if (MIXER_CHANNEL_IDS.has(src)) {
      MIXER_CHANNEL_IDS.set(tgt, MIXER_CHANNEL_IDS.get(src)!);
      transferredCount++;
    }
    if (MIXER_ENTRY_IDS.has(src)) {
      MIXER_ENTRY_IDS.set(tgt, MIXER_ENTRY_IDS.get(src)!);
      transferredCount++;
    }
    if (PARAMETER_ID_MAP.has(src)) {
      PARAMETER_ID_MAP.set(tgt, PARAMETER_ID_MAP.get(src)!);
      transferredCount++;
    }
    if (BSB_GESTURE_TARGET_IDS.has(src)) {
      BSB_GESTURE_TARGET_IDS.set(tgt, BSB_GESTURE_TARGET_IDS.get(src)!);
      transferredCount++;
    }
    if (BSB_WIDGET_ID_MAP.has(src)) {
      BSB_WIDGET_ID_MAP.set(tgt, BSB_WIDGET_ID_MAP.get(src)!);
      transferredCount++;
    }
    if (PRESET_ID_MAP.has(src)) {
      PRESET_ID_MAP.set(tgt, PRESET_ID_MAP.get(src)!);
      transferredCount++;
    }
    if (DROPDOWN_LINK_ID_MAP.has(src)) {
      DROPDOWN_LINK_ID_MAP.set(tgt, DROPDOWN_LINK_ID_MAP.get(src)!);
      transferredCount++;
    }
    if (LIBRARY_REFERENCE_ID_MAP.has(src)) {
      LIBRARY_REFERENCE_ID_MAP.set(tgt, LIBRARY_REFERENCE_ID_MAP.get(src)!);
      transferredCount++;
    }
    if (CLOJURE_LIBRARY_ENTRY_ID_MAP.has(src)) {
      CLOJURE_LIBRARY_ENTRY_ID_MAP.set(tgt, CLOJURE_LIBRARY_ENTRY_ID_MAP.get(src)!);
      transferredCount++;
    }
  }

  const sourceMarkerIds = getMarkerSnapshotIds(source.getMarkersList());
  MARKER_IDS.set(target.getMarkersList(), [...sourceMarkerIds]);
  const sourceTempoPoints = source.getScore().getTimeContext().getTempoMap().getTempoPoints();
  const targetTempoPoints = target.getScore().getTimeContext().getTempoMap().getTempoPoints();
  for (let i = 0; i < Math.min(sourceTempoPoints.length, targetTempoPoints.length); i++) {
    getTempoPointSnapshotId(sourceTempoPoints[i]!);
    pair(sourceTempoPoints[i], targetTempoPoints[i]);
  }

  function pairParameter(
    srcP: Parameter | null | undefined,
    tgtP: Parameter | null | undefined,
  ): void {
    if (!srcP || !tgtP) return;
    pair(srcP, tgtP);
  }

  function traverseBsbWidgets(srcGroup: BSBGroup, tgtGroup: BSBGroup): void {
    pair(srcGroup, tgtGroup);
    const srcChildren = srcGroup.getChildren();
    const tgtChildren = tgtGroup.getChildren();
    const count = Math.min(srcChildren.length, tgtChildren.length);
    for (let i = 0; i < count; i++) {
      const s = srcChildren[i];
      const t = tgtChildren[i];
      if (s && t) {
        pair(s, t);
        if (s instanceof BSBGroup && t instanceof BSBGroup) {
          traverseBsbWidgets(s, t);
        } else if (s instanceof BSBDropdown && t instanceof BSBDropdown) {
          const sItems = s.dropdownItems;
          const tItems = t.dropdownItems;
          const itemCount = Math.min(sItems.length, tItems.length);
          for (let j = 0; j < itemCount; j++) {
            if (sItems[j] && tItems[j]) {
              pair(sItems[j], tItems[j]);
            }
          }
        }
      }
    }
  }

  function traversePresetGroup(srcPG: PresetGroup, tgtPG: PresetGroup): void {
    pair(srcPG, tgtPG);
    const sPresets = srcPG.getPresets();
    const tPresets = tgtPG.getPresets();
    const pCount = Math.min(sPresets.length, tPresets.length);
    for (let i = 0; i < pCount; i++) {
      if (sPresets[i] && tPresets[i]) {
        pair(sPresets[i], tPresets[i]);
      }
    }
    const sSubs = srcPG.getSubGroups();
    const tSubs = tgtPG.getSubGroups();
    const sCount = Math.min(sSubs.length, tSubs.length);
    for (let i = 0; i < sCount; i++) {
      if (sSubs[i] && tSubs[i]) {
        traversePresetGroup(sSubs[i], tSubs[i]);
      }
    }
  }

  function pairInstrument(
    srcInst: Instrument | null | undefined,
    tgtInst: Instrument | null | undefined,
  ): void {
    if (!srcInst || !tgtInst) return;
    pair(srcInst, tgtInst);
    const sCandidate = srcInst as Instrument & { getParameters?: () => Parameter[] };
    const tCandidate = tgtInst as Instrument & { getParameters?: () => Parameter[] };
    const sParams =
      typeof sCandidate.getParameters === 'function' ? sCandidate.getParameters() : [];
    const tParams =
      typeof tCandidate.getParameters === 'function' ? tCandidate.getParameters() : [];
    const pCount = Math.min(sParams.length, tParams.length);
    for (let i = 0; i < pCount; i++) {
      pairParameter(sParams[i], tParams[i]);
    }
    if (srcInst instanceof BlueSynthBuilder && tgtInst instanceof BlueSynthBuilder) {
      traverseBsbWidgets(
        srcInst.getGraphicInterface().rootGroup,
        tgtInst.getGraphicInterface().rootGroup,
      );
      const srcPG = srcInst.getPresetGroup();
      const tgtPG = tgtInst.getPresetGroup();
      if (srcPG && tgtPG) {
        traversePresetGroup(srcPG, tgtPG);
      }
    }
  }

  function pairSoundObject(
    srcObj: SoundObject | null | undefined,
    tgtObj: SoundObject | null | undefined,
  ): void {
    if (!srcObj || !tgtObj) return;
    pair(srcObj, tgtObj);

    if (srcObj instanceof PolyObject && tgtObj instanceof PolyObject) {
      const sCount = Math.min(srcObj.length, tgtObj.length);
      for (let l = 0; l < sCount; l++) {
        const sL = srcObj[l];
        const tL = tgtObj[l];
        if (sL && tL) {
          pair(sL, tL);
          const oCount = Math.min(sL.length, tL.length);
          for (let o = 0; o < oCount; o++) {
            pairSoundObject(sL[o], tL[o]);
          }
        }
      }
    } else if (srcObj instanceof Sound && tgtObj instanceof Sound) {
      pairInstrument(srcObj.getBlueSynthBuilder(), tgtObj.getBlueSynthBuilder());
    } else if (srcObj instanceof Instance && tgtObj instanceof Instance) {
      pairSoundObject(srcObj.getSoundObject(), tgtObj.getSoundObject());
    } else if (srcObj instanceof PatternObject && tgtObj instanceof PatternObject) {
      const pCount = Math.min(srcObj.size(), tgtObj.size());
      for (let p = 0; p < pCount; p++) {
        const sPat = srcObj.getPattern(p);
        const tPat = tgtObj.getPattern(p);
        if (sPat && tPat) {
          pair(sPat, tPat);
          const sCandidate = sPat as { getLayers?: () => any[] };
          const tCandidate = tPat as { getLayers?: () => any[] };
          const sLayers = typeof sCandidate.getLayers === 'function' ? sCandidate.getLayers() : [];
          const tLayers = typeof tCandidate.getLayers === 'function' ? tCandidate.getLayers() : [];
          const lCount = Math.min(sLayers.length, tLayers.length);
          for (let l = 0; l < lCount; l++) {
            if (sLayers[l] && tLayers[l]) {
              pair(sLayers[l], tLayers[l]);
              const sObjs =
                typeof sLayers[l].getSoundObjects === 'function'
                  ? sLayers[l].getSoundObjects()
                  : [];
              const tObjs =
                typeof tLayers[l].getSoundObjects === 'function'
                  ? tLayers[l].getSoundObjects()
                  : [];
              const oCount = Math.min(sObjs.length, tObjs.length);
              for (let o = 0; o < oCount; o++) {
                pairSoundObject(sObjs[o], tObjs[o]);
              }
            }
          }
        }
      }
    }
  }

  function pairChannel(srcCh: Channel | null | undefined, tgtCh: Channel | null | undefined): void {
    if (!srcCh || !tgtCh) return;
    pair(srcCh, tgtCh);
    pairParameter(srcCh.getLevelParameter(), tgtCh.getLevelParameter());

    const chains = [
      [srcCh.getPreEffects(), tgtCh.getPreEffects()],
      [srcCh.getPostEffects(), tgtCh.getPostEffects()],
      [srcCh.getEffectsChain(), tgtCh.getEffectsChain()],
    ] as const;

    for (const [sChain, tChain] of chains) {
      const count = Math.min(sChain.length, tChain.length);
      for (let i = 0; i < count; i++) {
        const sEntry = sChain[i];
        const tEntry = tChain[i];
        if (sEntry && tEntry) {
          pair(sEntry, tEntry);
          if (sEntry instanceof Effect && tEntry instanceof Effect) {
            const sParams = sEntry.getParameters();
            const tParams = tEntry.getParameters();
            const pCount = Math.min(sParams.length, tParams.length);
            for (let p = 0; p < pCount; p++) {
              pairParameter(sParams[p], tParams[p]);
            }
            traverseBsbWidgets(
              sEntry.getGraphicInterface().rootGroup,
              tEntry.getGraphicInterface().rootGroup,
            );
          } else if (sEntry instanceof Send && tEntry instanceof Send) {
            pairParameter(sEntry.getParameter(), tEntry.getParameter());
          }
        }
      }
    }
  }

  // 1. Root & Score
  pair(source, target);
  transferClojureProjectEntrySnapshotIds(source, target);

  // Clojure library entries are not serialized with IDs. Keep their
  // session-only identities aligned by position across detached copies; the
  // patch applier adopts explicit incoming IDs for replacements and reorders.
  const sourceClojureEntries = source.getClojureProjectData()?.getLibraryEntries() ?? [];
  const targetClojureEntries = target.getClojureProjectData()?.getLibraryEntries() ?? [];
  const clojureEntryCount = Math.min(sourceClojureEntries.length, targetClojureEntries.length);
  for (let index = 0; index < clojureEntryCount; index++) {
    pair(sourceClojureEntries[index], targetClojureEntries[index]);
  }

  pair(source.getScore(), target.getScore());
  const srcScore = source.getScore();
  const tgtScore = target.getScore();
  const lgCount = Math.min(srcScore.length, tgtScore.length);

  for (let i = 0; i < lgCount; i++) {
    const sLG = srcScore[i];
    const tLG = tgtScore[i];
    if (!sLG || !tLG) continue;
    pair(sLG, tLG);

    if (sLG instanceof TrackLayerGroup && tLG instanceof TrackLayerGroup) {
      const trkCount = Math.min(sLG.length, tLG.length);
      for (let t = 0; t < trkCount; t++) {
        const sTrk = sLG[t];
        const tTrk = tLG[t];
        if (!sTrk || !tTrk) continue;
        pair(sTrk, tTrk);
        pairInstrument(sTrk.getInstrument(), tTrk.getInstrument());
        const itemCount = Math.min(sTrk.length, tTrk.length);
        for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
          pairSoundObject(sTrk[itemIdx] as SoundObject, tTrk[itemIdx] as SoundObject);
        }
      }
    } else if (sLG instanceof PolyObject && tLG instanceof PolyObject) {
      pairSoundObject(sLG, tLG);
    } else if (sLG instanceof PatternsLayerGroup && tLG instanceof PatternsLayerGroup) {
      const plCount = Math.min(sLG.length, tLG.length);
      for (let p = 0; p < plCount; p++) {
        const sPL = sLG[p];
        const tPL = tLG[p];
        if (!sPL || !tPL) continue;
        pair(sPL, tPL);
        pairSoundObject(sPL.getSoundObject(), tPL.getSoundObject());
      }
    }
  }

  // 2. Mixer
  const srcMixer = source.getMixer();
  const tgtMixer = target.getMixer();
  pair(srcMixer, tgtMixer);
  pairChannel(srcMixer.getMaster(), tgtMixer.getMaster());

  const sChans = srcMixer.getChannels();
  const tChans = tgtMixer.getChannels();
  const chanCount = Math.min(sChans.length, tChans.length);
  for (let c = 0; c < chanCount; c++) {
    pairChannel(sChans[c], tChans[c]);
  }

  const sSubs = srcMixer.getSubChannels();
  const tSubs = tgtMixer.getSubChannels();
  const subCount = Math.min(sSubs.length, tSubs.length);
  for (let s = 0; s < subCount; s++) {
    pairChannel(sSubs[s], tSubs[s]);
  }

  const sGroups = srcMixer.getChannelListGroups();
  const tGroups = tgtMixer.getChannelListGroups();
  const grpCount = Math.min(sGroups.length, tGroups.length);
  for (let g = 0; g < grpCount; g++) {
    const sG = sGroups[g];
    const tG = tGroups[g];
    if (sG && tG) {
      pair(sG, tG);
      const gChanCount = Math.min(sG.length, tG.length);
      for (let gc = 0; gc < gChanCount; gc++) {
        pairChannel(sG[gc], tG[gc]);
      }
    }
  }

  // 3. Arrangement
  const sArr = source.getArrangement().getArrangement();
  const tArr = target.getArrangement().getArrangement();
  const arrCount = Math.min(sArr.length, tArr.length);
  for (let a = 0; a < arrCount; a++) {
    const sA = sArr[a];
    const tA = tArr[a];
    if (sA && tA) {
      pair(sA, tA);
      pairInstrument(sA.instr, tA.instr);
    }
  }

  // 4. SoundObjectLibrary
  const sLib = source.getSoundObjectLibrary().getAllObjects();
  const tLib = target.getSoundObjectLibrary().getAllObjects();
  const libCount = Math.min(sLib.length, tLib.length);
  for (let l = 0; l < libCount; l++) {
    pairSoundObject(sLib[l], tLib[l]);
  }

  // 5. LiveData
  const sLive = source.getLiveData();
  const tLive = target.getLiveData();
  pair(sLive, tLive);

  const sBins = sLive.getLiveObjectBins();
  const tBins = tLive.getLiveObjectBins();
  const cols = Math.min(sBins.getColumnCount(), tBins.getColumnCount());
  const rows = Math.min(sBins.getRowCount(), tBins.getRowCount());
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const sLO = sBins.getLiveObject(c, r);
      const tLO = tBins.getLiveObject(c, r);
      if (sLO && tLO) {
        pair(sLO, tLO);
        pairSoundObject(sLO.getSoundObject(), tLO.getSoundObject());
      }
    }
  }

  const sSets = sLive.getLiveObjectSets().getSets();
  const tSets = tLive.getLiveObjectSets().getSets();
  const setCount = Math.min(sSets.length, tSets.length);
  for (let s = 0; s < setCount; s++) {
    pair(sSets[s], tSets[s]);
  }

  const sourceAssignedIds = DATA_ASSIGNED_SCORE_OBJECT_IDS.get(source);
  if (sourceAssignedIds) {
    for (const assignedId of sourceAssignedIds) {
      recordScoreObjectIdForData(target, assignedId);
    }
  }
  transferHistoryNodeIds(source, target, (a, b) =>
    restoreGraphEditorMetadata(b, readGraphEditorMetadata(a)),
  );
  return { sourceToTarget, targetToSource, transferredCount };
}
