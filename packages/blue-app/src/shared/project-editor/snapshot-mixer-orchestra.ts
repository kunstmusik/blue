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
  DEFAULT_NEW_METER_ENABLED,
  DEFAULT_NEW_METER_PROFILE_KEY,
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
  ScoreTrack,
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
import {
  computeMixerGateStateForMixer,
  hasEnabledStereoGeneratingEffect,
  hasLegacyMixerStateAtLoad,
  resolveEffectiveTrackLayout,
  type AudioLayoutManifest,
  type MixerChannelRouteIndicator,
} from '@blue/data';
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

import { moveRangeWithAnchors, scaleRangeWithAnchors } from '../automation-range-math';
import { BSB_LINE_SELECTOR_HEIGHT, getBsbWidgetDisplaySize } from '../bsb-widget-layout';
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
  ChannelPositionMode,
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
  applyBsbInterfacePatch,
  applyEmbeddedOpcodeListPatch,
  buildGridSettingsSnapshot,
  buildPresetGroupSnapshot,
  buildSoundAutomationParameters,
  buildUdoListSnapshot,
  buildWidgetTreeSnapshot,
  collectBsbObjectNames,
  collectBsbWidgets,
  createPresetGroupFromSnapshot,
  createWidgetFromSnapshot,
  restoreBsbAutomationParameters,
  snapshotToUdo,
  toGridSettingsSnapshot,
  collectGraphicInterfaceObjectNames,
  collectGraphicInterfaceWidgets,
  buildWidgetTreeSnapshotFromGraphicInterface,
} from './bsb-widgets';
import {
  assignClojureLibraryEntrySnapshotId,
  getArrangementInstrumentOwnerIdentity,
  getMixerChannelSnapshotId,
  getMixerEntrySnapshotId,
  getTrackInstrumentOwnerIdentity,
  getClojureProjectEntrySnapshotIds,
  setClojureProjectEntrySnapshotIds,
} from './identity';

interface MeterMapLike {
  getEntries(): ReadonlyArray<{
    measure: number;
    meter: {
      numBeats: number;
      beatLength: number;
    };
  }>;
}

function createDefaultClojureProjectSnapshot(): ClojureProjectSnapshot {
  return {
    libraryEntries: [],
  };
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
  const parameterCount = Array.isArray(payload.field.parameters)
    ? payload.field.parameters.length
    : 0;
  return payload.seedUsed
    ? `seed: ${payload.seed}; ${parameterCount} params`
    : `random; ${parameterCount} params`;
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
    indicator?: MixerChannelRouteIndicator;
    score?: Score;
    manifest?: AudioLayoutManifest | null;
  },
): MixerChannelSnapshot {
  const id = getMixerChannelSnapshotId(channel);
  const score = refs?.score;
  const manifest = refs?.manifest;
  let positionMode: ChannelPositionMode = 'balance';

  if (
    channelKind !== 'subChannel' &&
    channelKind !== 'master' &&
    score &&
    channel.getAssociation()
  ) {
    let track: ScoreTrack | undefined;
    for (const group of score) {
      if (group instanceof TrackLayerGroup) {
        track = group.find((t) => t.getUniqueId() === channel.getAssociation());
        if (track) break;
      }
    }
    if (track) {
      const clips: AudioClip[] = [];
      let hasNonClip = false;
      for (const item of track) {
        if (item instanceof AudioClip) {
          clips.push(item);
        } else {
          hasNonClip = true;
        }
      }
      const hasUpstreamEffects = hasEnabledStereoGeneratingEffect([
        ...channel.getPreEffects(),
        ...channel.getPostEffects(),
      ]);
      if (clips.length > 0 && manifest) {
        const layout = resolveEffectiveTrackLayout(
          clips.map((c) => c.getAudioFile()),
          manifest,
          { hasUpstreamEffects, hasStereoOrUnclassifiedSource: hasNonClip },
        );
        positionMode = layout === 'mono' ? 'pan' : 'balance';
      }
    }
  }

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
    positionMode,
    stereoPanMode: channel.getStereoPanMode(),
    panWidth: channel.getPanWidth(),
    dualPanLeft: channel.getDualPanLeft(),
    dualPanRight: channel.getDualPanRight(),
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
    outputExcludedBySolo: refs?.indicator?.outputExcludedBySolo,
    hasIncludedSend: refs?.indicator?.hasIncludedSend,
  };
}

/**
 * Derives per-channel route indicators (Spec 111) matched back onto snapshot
 * channels by kind and name. Sources are ordered exactly like the policy's
 * node walk (channel list groups, then Orchestra); subchannels are matched
 * through the same render-order sort the policy uses.
 */
function buildMixerRouteIndicatorIndex(mixer: Mixer): {
  byKey: Map<string, MixerChannelRouteIndicator>;
} {
  const byKey = new Map<string, MixerChannelRouteIndicator>();
  if (!mixer.isEnabled()) return { byKey };
  const state = computeMixerGateStateForMixer(mixer);
  for (const indicator of state.channels) {
    byKey.set(`${indicator.kind}:${indicator.name}`, indicator);
  }
  return { byKey };
}

export function createEmptyMixerSnapshot(): MixerSnapshot {
  const master = new Channel();
  master.setName(Mixer.MASTER_CHANNEL);
  return {
    enabled: true,
    enableMeters: DEFAULT_NEW_METER_ENABLED,
    meterProfileKey: DEFAULT_NEW_METER_PROFILE_KEY,
    extraRenderTime: 0,
    channelListGroups: [],
    channels: [],
    subChannels: [],
    master: createMixerChannelSnapshot(master, 'master'),
  };
}

function createMixerChannelListSnapshot(
  channelList: ChannelList,
  indicatorFor?: (channel: Channel) => MixerChannelRouteIndicator | undefined,
  score?: Score,
  manifest?: AudioLayoutManifest | null,
): MixerChannelListSnapshot {
  return {
    association: channelList.getAssociation() ?? undefined,
    listName: channelList.getListName(),
    listNameEditSupported: channelList.isListNameEditSupported(),
    channels: Array.from(channelList, (channel) =>
      createMixerChannelSnapshot(channel, 'instrument', {
        indicator: indicatorFor?.(channel),
        score,
        manifest,
      }),
    ),
  };
}

export function createMixerSnapshot(
  mixer: Mixer,
  score?: Score,
  manifest?: AudioLayoutManifest | null,
): MixerSnapshot {
  const { byKey } = buildMixerRouteIndicatorIndex(mixer);
  const indicatorFor = (kind: 'source' | 'sub' | 'master', channel: Channel) =>
    byKey.get(`${kind}:${channel.getName()}`);
  return {
    enabled: mixer.isEnabled(),
    enableMeters: mixer.isEnableMeters(),
    meterProfileKey: mixer.getMeterProfileKey(),
    extraRenderTime: mixer.getExtraRenderTime(),
    channelListGroups: mixer
      .getChannelListGroups()
      .map((channelList) =>
        createMixerChannelListSnapshot(
          channelList,
          (channel) => indicatorFor('source', channel),
          score,
          manifest,
        ),
      ),
    channels: Array.from(mixer.getChannels(), (channel) =>
      createMixerChannelSnapshot(channel, 'instrument', {
        indicator: indicatorFor('source', channel),
        score,
        manifest,
      }),
    ),
    subChannels: Array.from(mixer.getSubChannels(), (channel) =>
      createMixerChannelSnapshot(channel, 'subChannel', {
        indicator: indicatorFor('sub', channel),
        score,
        manifest,
      }),
    ),
    master: createMixerChannelSnapshot(mixer.getMaster(), 'master', {
      indicator: indicatorFor('master', mixer.getMaster()),
      score,
      manifest,
    }),
  };
}

/**
 * Spec 111 FR-015 compatibility notice: true only when the loaded document
 * carried active channel mute/non-master solo flags or master mute at load time (provenance
 * recorded by the XML loader) and the flags are still active now. Flags set
 * by live edits in this session never surface the notice.
 */
export function computeLegacyMixerStateNotice(data: BlueData): boolean {
  if (!hasLegacyMixerStateAtLoad(data)) return false;
  const mixer = data.getMixer();
  return (
    [...mixer.getAllSourceChannels(), ...mixer.getSubChannels()].some(
      (channel) => channel.isMuted() || channel.isSolo(),
    ) || mixer.getMaster().isMuted()
  );
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
    tempoMap: createTempoMapSnapshot(data.getScore().getTimeContext().getTempoMap()),
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
    entryId: assignClojureLibraryEntrySnapshotId(entry),
    dependencyCoordinates: entry.getDependencyCoordinates(),
    version: entry.getVersion(),
  };
}

export function createClojureProjectSnapshot(
  projectData: ClojureProjectData | null | undefined,
  identityOwner?: object,
): ClojureProjectSnapshot {
  if (!projectData) {
    if (identityOwner) {
      setClojureProjectEntrySnapshotIds(identityOwner, []);
    }
    return createDefaultClojureProjectSnapshot();
  }

  const owner = identityOwner ?? projectData;
  const knownIds = getClojureProjectEntrySnapshotIds(owner);
  const libraryEntries = projectData.getLibraryEntries();
  const entryIds = libraryEntries.map((entry, index) =>
    assignClojureLibraryEntrySnapshotId(entry, knownIds?.[index]),
  );
  setClojureProjectEntrySnapshotIds(owner, entryIds);

  return {
    libraryEntries: libraryEntries.map((entry, index) => ({
      ...createClojureLibraryEntrySnapshot(entry),
      entryId: entryIds[index]!,
    })),
  };
}

// ─── Bar Renderer Snapshot Helpers ───

export function getInstrumentSnapshotType(
  instrument: Instrument | undefined,
): InstrumentSnapshot['type'] {
  if (instrument instanceof GenericInstrument) return 'generic';
  if (instrument instanceof JavaScriptInstrument) return 'javascript';
  if (instrument instanceof PythonInstrument) return 'python';
  if (instrument instanceof BlueX7) return 'blueX7';
  if (instrument instanceof BlueSynthBuilder) return 'blueSynthBuilder';
  return 'unknown';
}

export function getInstrumentSummary(instrument: Instrument | undefined): string {
  if (!instrument) return 'Unresolved instrument';
  return instrument.constructor.name;
}

export function buildSoundBSBInstrumentSnapshot(
  bsb: BlueSynthBuilder,
): BlueSynthBuilderInstrumentSnapshot {
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

export function createObjectBuilderBsbAdapter(builder: ObjectBuilder): BlueSynthBuilder {
  const adapter = new BlueSynthBuilder();
  adapter.setName(builder.getName());
  adapter.setGraphicInterface(builder.getGraphicInterface());
  adapter.setPresetGroup(builder.getPresetGroup());
  return adapter;
}

export function buildObjectBuilderBsbInstrumentSnapshot(
  builder: ObjectBuilder,
): BlueSynthBuilderInstrumentSnapshot {
  return buildSoundBSBInstrumentSnapshot(createObjectBuilderBsbAdapter(builder));
}

export function applyObjectBuilderBsbInterfacePatch(
  builder: ObjectBuilder,
  patch: BsbInterfacePatch,
): boolean {
  const adapter = createObjectBuilderBsbAdapter(builder);
  const changed = applyBsbInterfacePatch(adapter, patch);
  if (changed) {
    builder.setGraphicInterface(adapter.getGraphicInterface());
    const presetGroup = adapter.getPresetGroup();
    if (presetGroup) {
      builder.setPresetGroup(presetGroup);
    }
  }
  return changed;
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
  ownerIdentity?: string,
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
      udolist: instrument.getOpcodeList().getOpcodes().map(udoToSnapshot),
    };
  }

  if (instrument instanceof BlueX7) {
    const voice = instrument.getVoice();
    const syncs = voice.operators.map((op) => op.sync);
    const pmss = voice.operators.map((op) => op.modulationPitch);
    const allSameSync = syncs.every((s) => s === syncs[0]);
    const allSamePms = pmss.every((p) => p === pmss[0]);

    return {
      assignmentId,
      type: 'blueX7',
      ownerIdentity,
      name: instrument.getName(),
      enabled,
      comment: instrument.getComment(),
      voice: cloneBlueX7Voice(voice),
      sharedOscillatorSync: allSameSync ? syncs[0] : 'mixed',
      sharedPitchModulationSensitivity: allSamePms ? pmss[0] : 'mixed',
      parameters: instrument.getParameters().map((parameter) => ({
        parameterId: parameter.getUniqueId(),
        semanticKey: parameter.getName(),
        fixedValue: parameter.getFixedValue(),
        automationEnabled: parameter.isAutomationEnabled(),
        label: parameter.getLabel(),
        curve: parameter.getCurve(),
        lineColor: parameter.getLineColor(),
        points: parameter.getPoints().map((point) => ({ ...point })),
      })),
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
      instrument: createInstrumentSnapshot(
        track.getUniqueId(),
        instrument,
        instrument.isEnabled(),
        getTrackInstrumentOwnerIdentity(group.getUniqueId(), track.getUniqueId()),
      ),
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
        getArrangementInstrumentOwnerIdentity(assignment.arrangementId),
      ),
    );
  }

  return {
    ...createEmptyOrchestraSnapshot(true),
    arrangement: { rows },
    instruments,
  };
}

export function createInstrumentForType(type: SupportedNewInstrumentType): Instrument {
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

export function createInstrumentFromSnapshot(snapshot: InstrumentSnapshot): Instrument {
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

  if (snapshot.type === 'generic' || snapshot.type === 'javascript' || snapshot.type === 'python') {
    applyInstrumentPatch(instrument, {
      text: snapshot.text,
      globalOrc: snapshot.globalOrc,
      globalSco: snapshot.globalSco,
    });

    if (instrument instanceof GenericInstrument || instrument instanceof JavaScriptInstrument) {
      const opcodeList = instrument.getOpcodeList();
      opcodeList.clear();
      const definitions =
        snapshot.type === 'generic' || snapshot.type === 'javascript' ? snapshot.udolist : [];
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
  } else if (snapshot.type === 'blueX7') {
    if (snapshot.voice && instrument instanceof BlueX7) {
      instrument.setVoice(snapshot.voice);
      const parameterSnapshots = new Map(
        snapshot.parameters?.map((parameter) => [parameter.semanticKey, parameter]) ?? [],
      );
      for (const parameter of instrument.getParameters()) {
        const parameterSnapshot = parameterSnapshots.get(parameter.getName());
        if (!parameterSnapshot) continue;
        if (parameterSnapshot.label !== undefined) parameter.setLabel(parameterSnapshot.label);
        if (
          parameterSnapshot.curve !== undefined &&
          parameterSnapshot.curve in BlueDataAutomationCurve
        ) {
          parameter.setCurve(
            BlueDataAutomationCurve[
              parameterSnapshot.curve as keyof typeof BlueDataAutomationCurve
            ],
          );
        }
        if (parameterSnapshot.lineColor !== undefined) {
          parameter.setLineColor(parameterSnapshot.lineColor);
        }
        if (parameterSnapshot.points) {
          parameter.setPoints(parameterSnapshot.points.map((point) => ({ ...point })));
        }
        parameter.setAutomationEnabled(parameterSnapshot.automationEnabled);
      }
    }
  }

  return instrument;
}

export function createOpcodeListFromSnapshots(snapshots: UdoDefinitionSnapshot[]): OpcodeList {
  const opcodeList = new OpcodeList();
  for (const snapshot of snapshots) {
    opcodeList.addOpcode(snapshotToUdo(snapshot));
  }
  return opcodeList;
}

export function applyInstrumentPatch(instrument: Instrument, patch: InstrumentPatch): boolean {
  let changed = false;
  if (patch.name !== undefined && instrument.getName() !== patch.name) {
    instrument.setName(patch.name);
    changed = true;
  }
  if (patch.enabled !== undefined && instrument.isEnabled() !== patch.enabled) {
    instrument.setEnabled(patch.enabled);
    changed = true;
  }
  const nextComment = patch.comment !== undefined ? patch.comment : patch.comments;
  if (nextComment !== undefined && instrument.getComment() !== nextComment) {
    instrument.setComment(nextComment);
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
      changed =
        applyEmbeddedOpcodeListPatch(instrument.getOpcodeList(), patch.embeddedOpcodeList) ||
        changed;
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
      changed =
        applyEmbeddedOpcodeListPatch(instrument.getOpcodeList(), patch.embeddedOpcodeList) ||
        changed;
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
    if (
      patch.bsbOpcodeListText !== undefined &&
      instrument.getOpcodeListText() !== patch.bsbOpcodeListText
    ) {
      instrument.setOpcodeListText(patch.bsbOpcodeListText);
      changed = true;
    }
    if (patch.bsbInterface) {
      changed = applyBsbInterfacePatch(instrument, patch.bsbInterface) || changed;
    }
  } else if (instrument instanceof BlueX7) {
    if (patch.blueX7 && isValidBlueX7Patch(patch.blueX7)) {
      const p = patch.blueX7;
      switch (p.type) {
        case 'setCommonField':
          instrument.setCommonField(p.field, p.value as BlueX7Common[typeof p.field]);
          changed = true;
          break;
        case 'setOperatorEnabled':
          instrument.setOperatorEnabled(p.operatorIndex, p.enabled);
          changed = true;
          break;
        case 'setLfoField':
          instrument.setLfoField(p.field, p.value as BlueX7Lfo[typeof p.field]);
          changed = true;
          break;
        case 'setOperatorField':
          instrument.setOperatorField(
            p.operatorIndex,
            p.field,
            p.value as BlueX7Operator[typeof p.field],
          );
          changed = true;
          break;
        case 'setSharedOscillatorSync':
          instrument.setSharedOscillatorSync(p.value);
          changed = true;
          break;
        case 'setSharedPitchModulationSensitivity':
          instrument.setSharedPitchModulationSensitivity(p.value);
          changed = true;
          break;
        case 'setOperatorEnvelopePoint':
          instrument.setOperatorEnvelopePoint(p.operatorIndex, p.stageIndex, p.point);
          changed = true;
          break;
        case 'setPitchEnvelopePoint':
          instrument.setPitchEnvelopePoint(p.stageIndex, p.point);
          changed = true;
          break;
        case 'setCsoundPostCode':
          instrument.setCsoundPostCode(p.text);
          changed = true;
          break;
        case 'replaceVoice':
          instrument.replaceVoice(p.voice);
          changed = true;
          break;
      }
    }
  }

  return changed;
}

export function convertGenericToBsb(instrument: GenericInstrument): BlueSynthBuilder {
  const bsb = new BlueSynthBuilder();
  bsb.setName(instrument.getName());
  bsb.setComment(instrument.getComment());
  bsb.setGlobalOrc(instrument.getGlobalOrc());
  bsb.setGlobalSco(instrument.getGlobalSco());
  bsb.setInstrumentText(instrument.getText());
  bsb.setOpcodeList(instrument.getOpcodeList());
  return bsb;
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
          durationTimeBase: soundObject
            ? String(soundObject.getSubjectiveDuration().getTimeBase())
            : undefined,
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
    sets: liveData
      .getLiveObjectSets()
      .getSets()
      .map((set) => ({
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

export function createMidiInputProcessorSnapshot(processor: {
  getKeyMapping(): string;
  getVelocityMapping(): string;
  getPitchConstant(): string;
  getAmpConstant(): string;
  getScale(): Scale | null;
}): MidiInputProcessorSnapshot {
  return {
    keyMapping: processor.getKeyMapping(),
    velocityMapping: processor.getVelocityMapping(),
    pitchConstant: processor.getPitchConstant(),
    ampConstant: processor.getAmpConstant(),
    scale: createMidiScaleSnapshot(processor.getScale()),
  };
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
    const existing =
      existingByAssociation.get(row.assignmentId) ?? fallbackChannels[fallbackIndex++];
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
      existingByAssociation.get(descriptor.association) ?? fallbackGroups[fallbackGroupIndex++];
    const existingChannelsByAssociation = indexFirstByAssociation(
      existingGroup?.channels ?? [],
      (channel) => channel.association,
    );
    const fallbackChannels =
      existingGroup?.channels.filter((channel) => !channel.association) ?? [];
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

export function findTrackByAssociation(
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

export function findTrackLayerGroupByAssociation(
  data: BlueData,
  association: string | null | undefined,
): TrackLayerGroup | null {
  const targetAssociation = association?.trim() ?? '';
  if (!targetAssociation) return null;
  return (
    data
      .getScore()
      .find(
        (group): group is TrackLayerGroup =>
          group instanceof TrackLayerGroup && group.getUniqueId() === targetAssociation,
      ) ?? null
  );
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
  const sourceByAssociation = indexFirstByAssociation(sourceChannels, (channel) =>
    channel.getAssociation(),
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
      (snapshot.association ? sourceByAssociation.get(snapshot.association) : undefined) ??
      sourceFallbackChannels[sourceFallbackIndex++];

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

  const nextChannelListGroups = reconciledWithGroups.channelListGroups.map(
    (groupSnapshot, index) => {
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
    },
  );

  const nextFlatChannels = nextSourceChannels.slice(
    reconciledWithGroups.channelListGroups.reduce(
      (count, group) => count + group.channels.length,
      0,
    ),
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

/**
 * Human-readable history label for a durable orchestra patch so arrangement
 * instrument changes enter project history as meaningful actions.
 */
export interface BsbActionLabelContext {
  /** Resolves a preset's display name for a more specific undo label. */
  presetName?: (presetUniqueId: string) => string | undefined;
  /** Resolves a widget's object name for a more specific undo label. */
  widgetName?: (widgetId: string) => string | undefined;
}

function withResolvedName(label: string, name: string | undefined): string {
  return name ? `${label} ${name}` : label;
}

/**
 * Human-readable action label for a Blue Synth Builder interface patch. The
 * optional context resolves preset and widget display names so project history
 * entries read like "Apply Preset Ocarina" instead of "Edit Instrument".
 */
export function bsbInterfaceActionLabel(
  patch: BsbInterfacePatch,
  context?: BsbActionLabelContext,
): string {
  switch (patch.type) {
    case 'setEditEnabled':
      return patch.value
        ? 'Enable Blue Synth Builder Edit Mode'
        : 'Disable Blue Synth Builder Edit Mode';
    case 'selectWidget':
      return 'Select Blue Synth Builder Widget';
    case 'updateWidgetProperties': {
      const name = context?.widgetName?.(patch.widgetId);
      return withResolvedName('Edit Blue Synth Builder Widget', name);
    }
    case 'updateSliderBankValue': {
      const name = context?.widgetName?.(patch.widgetId);
      return withResolvedName('Edit Blue Synth Builder Slider Bank', name);
    }
    case 'moveWidget':
      return 'Move Blue Synth Builder Widget';
    case 'resizeWidget':
      return 'Resize Blue Synth Builder Widget';
    case 'addWidget':
      return `Add ${patch.widgetType} Widget`;
    case 'removeWidget':
      return 'Remove Blue Synth Builder Widget';
    case 'updateGridSettings':
      return 'Edit Blue Synth Builder Grid';
    case 'applyPreset':
      return withResolvedName('Apply Preset', context?.presetName?.(patch.presetUniqueId));
    case 'updatePreset':
      return withResolvedName('Update Preset', context?.presetName?.(patch.presetUniqueId));
    case 'addPreset':
      return `Add Preset ${patch.presetName}`;
    case 'addPresetGroup':
      return `Add Preset Group ${patch.groupName}`;
    case 'addPresetFromSnapshot':
      return withResolvedName('Add Preset', patch.preset.name);
    case 'addPresetGroupFromSnapshot':
      return withResolvedName('Add Preset Group', patch.group.name);
    case 'renamePreset':
      return withResolvedName('Rename Preset', context?.presetName?.(patch.presetUniqueId));
    case 'renamePresetGroup':
      return `Rename Preset Group ${patch.name}`;
    case 'removePreset':
      return withResolvedName('Remove Preset', context?.presetName?.(patch.presetUniqueId));
    case 'removePresetGroup':
      return 'Remove Preset Group';
    case 'movePreset':
      return 'Reorder Preset';
    case 'movePresetGroup':
      return 'Reorder Preset Group';
    case 'synchronizePresets':
      return 'Synchronize Presets';
    case 'updateEmbeddedOpcodeList':
      return 'Edit Embedded Opcodes';
    case 'addUdo':
      return 'Add Opcode';
    case 'removeUdo':
      return 'Remove Opcode';
    case 'updateUdo':
      return 'Edit Opcode';
    case 'convertUdoStyle':
      return 'Convert Opcode Style';
    case 'reorderUdo':
      return 'Reorder Opcode';
    case 'randomize':
      return 'Randomize Blue Synth Builder Interface';
    case 'makeGroup':
      return 'Group Blue Synth Builder Widgets';
    case 'breakGroup':
      return 'Ungroup Blue Synth Builder Widgets';
    case 'pasteWidgets':
      return 'Paste Blue Synth Builder Widgets';
  }
}

export function orchestraPatchActionLabel(patch: OrchestraPatch): string {
  switch (patch.type) {
    case 'addInstrument':
      return 'Add Instrument';
    case 'removeAssignment':
      return 'Remove Instrument';
    case 'duplicateAssignment':
      return 'Duplicate Instrument';
    case 'pasteInstrument':
      return 'Paste Instrument';
    case 'updateAssignment':
      return patch.enabled === undefined
        ? 'Reorder Instrument'
        : patch.enabled
          ? 'Enable Instrument'
          : 'Disable Instrument';
    case 'replaceInstrument':
      return 'Replace Instrument';
    case 'convertGenericToBsb':
      return 'Convert Instrument to Blue Synth Builder';
    case 'updateInstrument': {
      const keys = Object.keys(patch.patch);
      if (keys.length === 1) {
        switch (keys[0]) {
          case 'name':
            return 'Rename Instrument';
          case 'comment':
            return 'Edit Instrument Comment';
          case 'enabled':
            return patch.patch.enabled ? 'Enable Instrument' : 'Disable Instrument';
          case 'alwaysOnInstrumentText':
          case 'globalOrc':
          case 'globalSco':
            return 'Edit Blue Synth Builder Code';
          case 'blueX7':
            return 'Edit BlueX7 Voice';
          case 'bsbInterface':
            return bsbInterfaceActionLabel(patch.patch.bsbInterface!);
        }
      }
      return 'Edit Instrument';
    }
    case 'updateInstrumentComment':
      return 'Edit Instrument Comment';
  }
}
