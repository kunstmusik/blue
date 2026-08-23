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
  applyBlueLivePatch,
  applyClojureProjectPatch,
  applyMixerPatchToData,
  applyMidiInputPatch,
  applyProjectPropertiesPatch,
  reconcileMixerWithArrangement,
} from './patch-mixer-bluelive';
import {
  createInstrumentForType,
  createInstrumentFromSnapshot,
  applyInstrumentPatch,
  convertGenericToBsb,
} from './snapshot-mixer-orchestra';
import {
  applyScoreObjectPatch,
  applyMeterMapPatch,
  applyTempoMapPatch,
  scorePatchTouchesMixerAudioChannels,
  isNonEmptyScorePatch,
} from './patch-score';
import {
  snapshotToUdo,
} from './bsb-widgets';

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

  if (patch.scratchPad) {
    const scratchPad = data.getScratchPadData();
    if (patch.scratchPad.text !== undefined && scratchPad.getScratchText() !== patch.scratchPad.text) {
      scratchPad.setScratchText(patch.scratchPad.text);
      changed = true;
    }
    if (
      patch.scratchPad.wordWrapEnabled !== undefined
      && scratchPad.isWordWrapEnabled() !== patch.scratchPad.wordWrapEnabled
    ) {
      scratchPad.setWordWrapEnabled(patch.scratchPad.wordWrapEnabled);
      changed = true;
    }
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
      case 'pasteInstrument': {
        const instrument = createInstrumentFromSnapshot(orchestraPatch.instrument);
        const insertAfterIndex = orchestraPatch.insertAfterAssignmentId
          ? arrangement.getArrangement().findIndex(
              (assignment) => assignment.arrangementId === orchestraPatch.insertAfterAssignmentId,
            )
          : -1;
        if (insertAfterIndex >= 0) {
          arrangement.addInstrumentAtIndex(instrument, insertAfterIndex + 1);
        } else {
          arrangement.addInstrument(instrument, undefined);
        }
        changed = true;
        break;
      }
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
  const hasScratchPad =
    patch.scratchPad !== undefined &&
    Object.keys(patch.scratchPad).length > 0;
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
    !hasScratchPad &&
    !hasMixer &&
    !hasScore
  );
}
