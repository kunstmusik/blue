import { compactHistoryRuntimePatches } from './project-history-runtime-patches';
import {
  captureProjectGraphDelta,
  applyProjectGraphDelta,
  mergeProjectGraphDeltas,
  isNetZeroProjectGraphDelta,
  estimateProjectGraphDeltaBytes,
  type ProjectGraphDelta,
} from './project-history-graph';

import { createHash, randomUUID } from 'node:crypto';
import {
  BSBCheckBox,
  BSBGroup,
  BSBHSliderBank,
  BSBDropdown,
  BSBVSliderBank,
  BSBWidget,
  BSBXYController,
  BlueSynthBuilder,
  BlueX7,
  cloneBlueX7Voice,
  Effect,
  Instrument,
  TrackLayerGroup,
  getProjectParameterCatalog,
  type BlueData,
  type MeterProfileKey,
} from '@blue/data';
import type {
  ProjectHistoryCommitRequest,
  ProjectHistoryUndoRequest,
  ProjectHistoryRedoRequest,
  ProjectHistoryReadRequest,
  ProjectHistoryResponse,
  ProjectHistoryStateProjection,
  ProjectDocumentUpdatedEvent,
  ProjectHistoryCommittedResponse,
  ProjectHistoryUnchangedResponse,
  ProjectHistoryStaleResponse,
  ProjectHistoryInvalidResponse,
  ProjectHistoryOversizeResponse,
  ProjectHistoryFailedResponse,
  ProjectHistoryBarrierReason,
  ProjectHistoryEntriesSnapshot,
  PrepareHistoryBoundaryEvent,
  PrepareHistoryBoundaryAck,
  ReleaseHistoryBoundaryEvent,
  RegisterHistoryParticipantRequest,
  RegisterHistoryParticipantResponse,
  UnregisterHistoryParticipantRequest,
  CancelOversizeProposalRequest,
  ProjectRuntimeOutcome,
  ProjectHistorySelectionHint,
  ProjectHistoryControlResponse,
  ProjectHistoryOrigin,
  ProjectSaveState,
} from '../shared/project-history';
import type {
  BsbInterfacePatch,
  EffectEditablePatch,
  InstrumentPatch,
  MixerChainKind,
  ProjectDocumentCommitReceipt,
  ProjectDocumentPatch,
} from '../shared/project-editor/contract';
import {
  getKnownMixerChannelSnapshotId,
  getMixerEntrySnapshotId,
  getMarkerSnapshotIds,
  getTempoPointSnapshotId,
  transferProjectEditorIdentities,
} from '../shared/project-editor/identity';
import type { ProjectSession, ProjectSessionSnapshot } from './project-session';
import type { ProjectRuntimeReconciliation } from './project-runtime-reconciliation';
import { collectAffectedScoreAutomationParameterIds } from './score-automation-runtime-sync';
import {
  prepareTransaction,
  rollbackScalarRecords,
  applyScalarFieldRecord,
  validatePreconditions,
  type PreparedTransaction,
  type PreparedScalarTransaction,
  type ScalarFieldRecord,
} from './project-history-memento';

export const DEFAULT_RETAINED_ENTRY_LIMIT = 200;
export const DEFAULT_RETAINED_BYTES_LIMIT = 64 * 1024 * 1024; // 64 MiB
export const GESTURE_GROUPING_TIMEOUT_MS = 500;
export const RECEIPT_CACHE_LIMIT = 500;

export interface HistoryEntry {
  readonly entryId: string;
  readonly documentId: string;
  readonly beforeStateId: string;
  readonly afterStateId: string;
  readonly label: string;
  readonly sourceContextId?: string;
  readonly originViewId?: string;
  readonly originSelectionHints?: readonly ProjectHistorySelectionHint[];
  readonly gestureId?: string;
  readonly fieldId?: string;
  readonly timestamp: number;
  readonly retainedBytes: number;
  readonly record: HistoryRecord;
  /** Stable changed-target hints for reconciliation and selection restore. */
  readonly changedTargets?: readonly string[];
  readonly forwardPatches?: readonly ProjectDocumentPatch[];
  readonly inversePatches?: readonly ProjectDocumentPatch[];
}

/**
 * Derives stable changed-target hints from committed patches so replies and
 * publications identify which canonical owners a transition touched. IDs are
 * the stable canonical identities already carried by the patch members.
 */
function collectChangedTargets(patches: readonly ProjectDocumentPatch[]): string[] {
  const targets = new Set<string>();
  for (const patch of patches) {
    if (patch.globalOrc !== undefined) targets.add('text:globalOrc');
    if (patch.globalSco !== undefined) targets.add('text:globalSco');
    if (patch.tablesText !== undefined) targets.add('text:tablesText');
    if (patch.scratchPad !== undefined) targets.add('text:scratchPad');
    if (patch.clojureProject !== undefined) targets.add('clojureProject');
    if (patch.projectProperties !== undefined) targets.add('property:projectProperties');
    if (patch.transport !== undefined) targets.add('transport');
    if (patch.projectUdo !== undefined) targets.add('udo');
    if (patch.midiInput !== undefined) targets.add('midiInput');
    if (patch.blueLive !== undefined) targets.add('blueLive');
    if (patch.mixer !== undefined) {
      const m = patch.mixer;
      if (m.type === 'updateChannel') {
        targets.add(`mixerChannel:${m.channelId}`);
      } else if (
        m.type === 'setMixerEnabled' ||
        m.type === 'setMeterEnabled' ||
        m.type === 'setMeterProfile' ||
        m.type === 'updateExtraRenderTime'
      ) {
        targets.add('mixerChannel:mixer');
      } else if (
        m.type === 'updateEffect' ||
        m.type === 'updateSend' ||
        m.type === 'removeChainEntry' ||
        m.type === 'reorderChainEntry' ||
        m.type === 'duplicateChainEntry' ||
        m.type === 'copyChainEntry'
      ) {
        if ('entryId' in m) {
          targets.add(`mixerEntry:${m.channelId}:${m.entryId}`);
        } else {
          targets.add('mixer');
        }
      } else {
        targets.add('mixer');
      }
    }
    if (patch.orchestra !== undefined) {
      const o = patch.orchestra;
      if (
        (o.type === 'updateInstrument' ||
          o.type === 'updateInstrumentComment' ||
          o.type === 'replaceInstrument' ||
          o.type === 'convertGenericToBsb') &&
        'assignmentId' in o
      ) {
        targets.add(`instrument:${o.assignmentId}`);
      } else {
        targets.add('orchestra');
      }
    }
    if (patch.score !== undefined) {
      const sp = patch.score;
      if (sp.type === 'updateSharedProperties' || sp.type === 'updateSoundObjectBehavior') {
        targets.add(`scoreObject:${sp.target.selectionId}`);
      } else if (sp.type === 'updateLayerState') {
        targets.add(`layer:${sp.groupId}:${sp.layerIndex}`);
      } else if (sp.type === 'updateTrackInstrument' && 'track' in sp) {
        targets.add(`track:${sp.track.trackId}`);
      } else {
        targets.add('score');
      }
    }
  }
  return [...targets];
}

export type HistoryRecord =
  | { readonly kind: 'values'; readonly records: readonly ScalarFieldRecord[] }
  | { readonly kind: 'bsb'; readonly delta: ProjectGraphDelta }
  | {
      readonly kind: 'structure';
      readonly delta: ProjectGraphDelta;
    };

export interface ActiveGroupState {
  readonly gestureId?: string;
  readonly fieldId?: string;
  readonly sourceContextId?: string;
  readonly lastTimestamp: number;
}

export interface ActiveRollbackCheckpoint {
  readonly gestureId?: string;
  readonly fieldId?: string;
  readonly baseCursor: number;
  readonly redoEntries: readonly HistoryEntry[];
  readonly evictedEntries: HistoryEntry[];
  readonly beforeStateId: string;
  readonly wasDirty: boolean;
  readonly savedStateId: string | null;
  activeEntryId?: string;
}

export function matchesActiveGroup(
  group: ActiveGroupState | null,
  request: { gestureId?: string; fieldId?: string; origin?: { contextId?: string } },
): boolean {
  if (!group) return false;
  if (request.gestureId !== undefined) {
    if (group.gestureId !== request.gestureId) return false;
  } else if (request.fieldId !== undefined) {
    if (group.fieldId !== request.fieldId) return false;
  } else {
    return false;
  }
  if (
    request.origin?.contextId !== undefined &&
    group.sourceContextId !== undefined &&
    group.sourceContextId !== request.origin.contextId
  ) {
    return false;
  }
  return true;
}

export function verifyStableIdentities(baseline: BlueData, current: BlueData): boolean {
  const baselineMarkers = getMarkerSnapshotIds(baseline.getMarkersList());
  const currentMarkers = getMarkerSnapshotIds(current.getMarkersList());
  if (
    baselineMarkers.length !== currentMarkers.length ||
    baselineMarkers.some((id, i) => id !== currentMarkers[i])
  )
    return false;
  const baselineTempo = baseline.getScore().getTimeContext().getTempoMap().getTempoPoints();
  const currentTempo = current.getScore().getTimeContext().getTempoMap().getTempoPoints();
  if (
    baselineTempo.length !== currentTempo.length ||
    baselineTempo.some(
      (point, i) => getTempoPointSnapshotId(point) !== getTempoPointSnapshotId(currentTempo[i]!),
    )
  )
    return false;
  const baselineCatalog = getProjectParameterCatalog(baseline);
  const currentCatalog = getProjectParameterCatalog(current);
  if (baselineCatalog.length !== currentCatalog.length) return false;
  for (let i = 0; i < baselineCatalog.length; i++) {
    if (
      baselineCatalog[i]!.parameter.getUniqueId() !== currentCatalog[i]!.parameter.getUniqueId()
    ) {
      return false;
    }
  }

  const baseArr = baseline.getArrangement();
  const currArr = current.getArrangement();
  if (baseArr.size() !== currArr.size()) return false;
  for (let i = 0; i < baseArr.size(); i++) {
    if (baseArr.getInstrumentId(i) !== currArr.getInstrumentId(i)) {
      return false;
    }
  }

  return true;
}

export function isNetZeroProjectState(baseline: BlueData, current: BlueData): boolean {
  if (baseline.saveToString() !== current.saveToString()) {
    return false;
  }
  return verifyStableIdentities(baseline, current);
}

function consolidateForwardPatchesForRedo(
  forwardPatches: readonly ProjectDocumentPatch[],
  afterMemento: BlueData,
): readonly ProjectDocumentPatch[] {
  const result: ProjectDocumentPatch[] = [];
  const handledAutomationMembers = new Set<string>();
  let catalog: ReturnType<typeof getProjectParameterCatalog> | undefined;

  for (let i = forwardPatches.length - 1; i >= 0; i--) {
    const patch = forwardPatches[i]!;
    const score = patch.score;
    if (
      score &&
      (score.type === 'setAutomationPoints' ||
        score.type === 'insertAutomationPoint' ||
        score.type === 'deleteAutomationPoint' ||
        score.type === 'moveAutomationPoint' ||
        score.type === 'setAutomationResolution' ||
        score.type === 'moveAutomationRange' ||
        score.type === 'scaleAutomationRange')
    ) {
      const affectedIds = collectAffectedScoreAutomationParameterIds(afterMemento, score);
      for (const parameterId of affectedIds) {
        const memberKey =
          score.type === 'setAutomationResolution'
            ? `${parameterId}:resolution`
            : `${parameterId}:points`;
        if (!handledAutomationMembers.has(memberKey)) {
          handledAutomationMembers.add(memberKey);
          const entry = (catalog ??= getProjectParameterCatalog(afterMemento)).find(
            (c) => c.parameter.getUniqueId() === parameterId,
          );
          if (entry) {
            if (score.type === 'setAutomationResolution') {
              result.unshift({
                score: {
                  type: 'setAutomationResolution',
                  parameterId,
                  resolutionDecimal: entry.parameter.getResolutionText(),
                },
              });
            } else {
              result.unshift({
                score: {
                  type: 'setAutomationPoints',
                  parameterId,
                  points: entry.parameter
                    .getPoints()
                    .map((p) => ({ time: p.time, value: p.value })),
                },
              });
            }
          }
        }
      }
    } else {
      result.unshift(patch);
    }
  }

  return result;
}

export interface HistoryParticipantInfo {
  readonly contextId: string;
  readonly documentId: string;
  acceptedRevision: number;
  lastSequence: number;
}

interface ActiveBarrierState {
  readonly barrierId: string;
  readonly reason: ProjectHistoryBarrierReason;
  readonly pendingContextIds: Set<string>;
  readonly participantSequences: ReadonlyMap<string, number>;
  readonly resolve: (result: { ok: boolean; reason?: string }) => void;
  readonly timeoutHandle: ReturnType<typeof setTimeout>;
}

export interface ProjectHistoryDependencies {
  readonly session: ProjectSession;
  /** Captures an immutable renderer-safe snapshot at publication time. */
  readonly captureSnapshot?: () => unknown;
  readonly publishUpdated?: (event: ProjectDocumentUpdatedEvent) => void | Promise<void>;
  readonly retainedEntryLimit?: number;
  readonly retainedBytesLimit?: number;
  readonly gestureGroupingTimeoutMs?: number;
  readonly broadcastPrepareBoundary?: (event: PrepareHistoryBoundaryEvent) => void | Promise<void>;
  readonly broadcastReleaseBoundary?: (event: ReleaseHistoryBoundaryEvent) => void | Promise<void>;
  readonly barrierTimeoutMs?: number;
  readonly reconciliation?: ProjectRuntimeReconciliation;
  /** Returns false if a participant context is no longer active in the host environment (e.g. closed window). */
  readonly isParticipantActive?: (contextId: string) => boolean;
}

export function scalarRecordsToInversePatches(
  records: readonly ScalarFieldRecord[],
): ProjectDocumentPatch[] {
  const patches: ProjectDocumentPatch[] = [];
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i]!;
    switch (rec.targetType) {
      case 'text':
        if (rec.targetId === 'globalOrc') {
          patches.push({ globalOrc: String(rec.beforeValue ?? '') });
        } else if (rec.targetId === 'globalSco') {
          patches.push({ globalSco: String(rec.beforeValue ?? '') });
        } else if (rec.targetId === 'tablesText') {
          patches.push({ tablesText: String(rec.beforeValue ?? '') });
        } else if (rec.targetId === 'scratchPad') {
          patches.push({
            scratchPad: { [rec.field]: rec.beforeValue } as NonNullable<
              ProjectDocumentPatch['scratchPad']
            >,
          });
        }
        break;
      case 'property':
        patches.push({
          projectProperties: { [rec.field]: rec.beforeValue } as NonNullable<
            ProjectDocumentPatch['projectProperties']
          >,
        });
        break;
      case 'transport':
        patches.push({
          transport: { [rec.field]: rec.beforeValue } as NonNullable<
            ProjectDocumentPatch['transport']
          >,
        });
        break;
      case 'mixerChannel':
        if (rec.targetId === 'mixer') {
          if (rec.field === 'enabled') {
            patches.push({ mixer: { type: 'setMixerEnabled', value: Boolean(rec.beforeValue) } });
          } else if (rec.field === 'enableMeters') {
            patches.push({ mixer: { type: 'setMeterEnabled', value: Boolean(rec.beforeValue) } });
          } else if (rec.field === 'meterProfileKey') {
            patches.push({
              mixer: { type: 'setMeterProfile', value: rec.beforeValue as MeterProfileKey },
            });
          } else if (rec.field === 'extraRenderTime') {
            patches.push({
              mixer: { type: 'updateExtraRenderTime', value: Number(rec.beforeValue) },
            });
          }
        } else {
          patches.push({
            mixer: {
              type: 'updateChannel',
              channelId: rec.targetId,
              patch: { [rec.field]: rec.beforeValue } as never,
            },
          });
        }
        break;
      default:
        break;
    }
  }
  return patches;
}

export function scalarRecordsToForwardPatches(
  records: readonly ScalarFieldRecord[],
): ProjectDocumentPatch[] {
  const patches: ProjectDocumentPatch[] = [];
  for (const rec of records) {
    switch (rec.targetType) {
      case 'text':
        if (rec.targetId === 'globalOrc') {
          patches.push({ globalOrc: String(rec.afterValue ?? '') });
        } else if (rec.targetId === 'globalSco') {
          patches.push({ globalSco: String(rec.afterValue ?? '') });
        } else if (rec.targetId === 'tablesText') {
          patches.push({ tablesText: String(rec.afterValue ?? '') });
        } else if (rec.targetId === 'scratchPad') {
          patches.push({
            scratchPad: { [rec.field]: rec.afterValue } as NonNullable<
              ProjectDocumentPatch['scratchPad']
            >,
          });
        }
        break;
      case 'property':
        patches.push({
          projectProperties: { [rec.field]: rec.afterValue } as NonNullable<
            ProjectDocumentPatch['projectProperties']
          >,
        });
        break;
      case 'transport':
        patches.push({
          transport: { [rec.field]: rec.afterValue } as NonNullable<
            ProjectDocumentPatch['transport']
          >,
        });
        break;
      case 'mixerChannel':
        if (rec.targetId === 'mixer') {
          if (rec.field === 'enabled') {
            patches.push({ mixer: { type: 'setMixerEnabled', value: Boolean(rec.afterValue) } });
          } else if (rec.field === 'enableMeters') {
            patches.push({ mixer: { type: 'setMeterEnabled', value: Boolean(rec.afterValue) } });
          } else if (rec.field === 'meterProfileKey') {
            patches.push({
              mixer: { type: 'setMeterProfile', value: rec.afterValue as MeterProfileKey },
            });
          } else if (rec.field === 'extraRenderTime') {
            patches.push({
              mixer: { type: 'updateExtraRenderTime', value: Number(rec.afterValue) },
            });
          }
        } else {
          patches.push({
            mixer: {
              type: 'updateChannel',
              channelId: rec.targetId,
              patch: { [rec.field]: rec.afterValue } as never,
            },
          });
        }
        break;
      default:
        break;
    }
  }
  return patches;
}

export function hasConcreteInversePatches(
  patches: readonly ProjectDocumentPatch[] | undefined,
): patches is readonly ProjectDocumentPatch[] {
  if (!patches || patches.length === 0) return false;
  return !(
    patches.length === 1 &&
    (patches[0].orchestra as unknown as { type?: string })?.type === 'structuralChange'
  );
}

function instrumentInverseKey(patch: InstrumentPatch | EffectEditablePatch): string {
  const bsb = patch.bsbInterface;
  if (bsb?.type === 'updateWidgetProperties')
    return JSON.stringify([bsb.widgetId, Object.keys(bsb.properties).sort()]);
  if (bsb?.type === 'updateSliderBankValue') return JSON.stringify([bsb.widgetId, bsb.sliderIndex]);
  return JSON.stringify(Object.keys(patch).sort());
}

function getInverseMemberKey(patch: ProjectDocumentPatch): string | null {
  if (patch.score) {
    const s = patch.score;
    if (s.type === 'setAutomationPoints') {
      return `score:automationPoints:${s.parameterId}`;
    }
    if (s.type === 'setAutomationResolution') {
      return `score:automationResolution:${s.parameterId}`;
    }
    if (s.type === 'updateTrackInstrument') {
      return `score:trackInstrument:${s.track.rootGroupId}:${s.track.trackId}:${instrumentInverseKey(s.patch)}`;
    }
  }
  if (patch.orchestra) {
    const o = patch.orchestra;
    if (o.type === 'updateInstrument') {
      return `orchestra:instrument:${o.assignmentId}:${instrumentInverseKey(o.patch)}`;
    }
    if (o.type === 'updateInstrumentComment') {
      return `orchestra:comment:${o.assignmentId}`;
    }
  }
  if (patch.mixer) {
    const m = patch.mixer;
    if (m.type === 'updateEffect') {
      return `mixer:effect:${m.channelId}:${m.chain}:${m.entryId}:${instrumentInverseKey(m.patch)}`;
    }
  }
  return null;
}

export function accumulateConcreteInversePatches(
  priorInverses: readonly ProjectDocumentPatch[] | undefined,
  newInverses: readonly ProjectDocumentPatch[] | null,
): readonly ProjectDocumentPatch[] | null {
  if (!priorInverses || !hasConcreteInversePatches(priorInverses)) {
    return newInverses && hasConcreteInversePatches(newInverses) ? newInverses : null;
  }
  if (!newInverses || !hasConcreteInversePatches(newInverses)) {
    return null;
  }

  const result: ProjectDocumentPatch[] = [...priorInverses];
  const existingKeys = new Set<string>();
  for (const p of priorInverses) {
    const key = getInverseMemberKey(p);
    if (key) existingKeys.add(key);
  }

  for (const p of newInverses) {
    const key = getInverseMemberKey(p);
    if (key) {
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        result.push(p);
      }
      // If already present, preserve earliest baseline from priorInverses
    } else {
      result.push(p);
    }
  }

  return result;
}

interface BsbEditableOwner {
  getGraphicInterface(): {
    findWidgetById(id: string): BSBWidget | null;
    getRootGroup(): BSBGroup;
  };
  getParameters(): Array<{ getName(): string }>;
}

function findBsbWidgetByObjectName(owner: BsbEditableOwner, objectName: string): BSBWidget | null {
  let result: BSBWidget | null = null;
  const visit = (widget: BSBWidget): void => {
    if (result || widget.objectName === objectName) {
      result = widget;
      return;
    }
    if (widget instanceof BSBGroup) {
      for (const child of widget.getChildren()) visit(child);
    }
  };
  visit(owner.getGraphicInterface().getRootGroup());
  return result;
}

function previousBsbPropertyValue(widget: BSBWidget, key: string): unknown | undefined {
  switch (key) {
    case 'value':
      return widget instanceof BSBXYController ||
        widget instanceof BSBHSliderBank ||
        widget instanceof BSBVSliderBank
        ? undefined
        : widget.value;
    case 'selected':
      return widget instanceof BSBCheckBox ? widget.selected : undefined;
    case 'selectedIndex':
      return widget instanceof BSBDropdown ? widget.selectedIndex : undefined;
    case 'xValue':
      return widget instanceof BSBXYController ? widget.xValue : undefined;
    case 'yValue':
      return widget instanceof BSBXYController ? widget.yValue : undefined;
    default:
      return undefined;
  }
}

function invertBsbInterfacePatch(
  owner: BsbEditableOwner,
  patch: BsbInterfacePatch,
): BsbInterfacePatch[] | null {
  const graphicInterface = owner.getGraphicInterface();

  switch (patch.type) {
    case 'selectWidget':
      // Selection is renderer state; this keeps the inverse concrete without
      // turning a cosmetic action into a restart-required placeholder.
      return [{ type: 'selectWidget' }];
    case 'updateWidgetProperties': {
      const widget = graphicInterface.findWidgetById(patch.widgetId);
      if (!widget || Object.keys(patch.properties).length === 0) return null;
      const properties: Record<string, unknown> = {};
      for (const key of Object.keys(patch.properties)) {
        const previousValue = previousBsbPropertyValue(widget, key);
        if (previousValue === undefined) return null;
        properties[key] = previousValue;
      }
      return [{ type: 'updateWidgetProperties', widgetId: patch.widgetId, properties }];
    }
    case 'updateSliderBankValue': {
      const widget = graphicInterface.findWidgetById(patch.widgetId);
      if (
        (!(widget instanceof BSBHSliderBank) && !(widget instanceof BSBVSliderBank)) ||
        patch.sliderIndex < 0 ||
        patch.sliderIndex >= widget.sliders.length
      ) {
        return null;
      }
      return [
        {
          type: 'updateSliderBankValue',
          widgetId: patch.widgetId,
          sliderIndex: patch.sliderIndex,
          value: widget.sliders[patch.sliderIndex]!.value,
        },
      ];
    }
    case 'applyPreset': {
      const inverse: BsbInterfacePatch[] = [];
      const visit = (widget: BSBWidget): void => {
        if (widget instanceof BSBGroup) {
          for (const child of widget.getChildren()) visit(child);
          return;
        }
        if (widget instanceof BSBXYController) {
          inverse.push({
            type: 'updateWidgetProperties',
            widgetId: widget.id,
            properties: { xValue: widget.xValue, yValue: widget.yValue },
          });
          return;
        }
        if (widget instanceof BSBHSliderBank || widget instanceof BSBVSliderBank) {
          for (const [sliderIndex, slider] of widget.sliders.entries()) {
            inverse.push({
              type: 'updateSliderBankValue',
              widgetId: widget.id,
              sliderIndex,
              value: slider.value,
            });
          }
          return;
        }
        if (!widget.objectName) return;
        if (widget instanceof BSBDropdown) {
          inverse.push({
            type: 'updateWidgetProperties',
            widgetId: widget.id,
            properties: { selectedIndex: widget.selectedIndex },
          });
        } else if (widget instanceof BSBCheckBox) {
          inverse.push({
            type: 'updateWidgetProperties',
            widgetId: widget.id,
            properties: { selected: widget.selected },
          });
        } else {
          inverse.push({
            type: 'updateWidgetProperties',
            widgetId: widget.id,
            properties: { value: widget.value },
          });
        }
      };
      visit(graphicInterface.getRootGroup());
      return inverse.length > 0 ? inverse : [{ type: 'selectWidget' }];
    }
    default:
      return null;
  }
}

function invertEditableInstrumentPatches(
  instrument: Instrument,
  patch: InstrumentPatch,
): InstrumentPatch[] | null {
  const inverse: InstrumentPatch[] = [];
  if (patch.blueX7) {
    if (!(instrument instanceof BlueX7)) return null;
    inverse.push({
      blueX7:
        patch.blueX7.type === 'setCsoundPostCode'
          ? { type: 'setCsoundPostCode', text: instrument.getCsoundPostCode() }
          : { type: 'replaceVoice', voice: cloneBlueX7Voice(instrument.getVoice()) },
    });
  }
  if (patch.comment !== undefined || patch.comments !== undefined) {
    inverse.push({ comment: instrument.getComment() });
  }
  if (patch.name !== undefined) {
    inverse.push({ name: instrument.getName() });
  }
  if (patch.bsbWidgetValues) {
    if (!(instrument instanceof BlueSynthBuilder)) return null;
    const values: Record<string, number> = {};
    for (const objectName of Object.keys(patch.bsbWidgetValues)) {
      const widget = findBsbWidgetByObjectName(instrument, objectName);
      if (!widget) return null;
      values[objectName] = widget.value;
    }
    inverse.push({ bsbWidgetValues: values });
  }
  if (patch.bsbInterface) {
    if (!(instrument instanceof BlueSynthBuilder)) return null;
    const interfaceInverses = invertBsbInterfacePatch(instrument, patch.bsbInterface);
    if (!interfaceInverses) return null;
    inverse.push(...interfaceInverses.map((bsbInterface) => ({ bsbInterface })));
  }

  const handledKeys = new Set([
    'blueX7',
    'comment',
    'comments',
    'name',
    'bsbWidgetValues',
    'bsbInterface',
  ]);
  return Object.keys(patch).every((key) => handledKeys.has(key)) ? inverse : null;
}

function findMixerEffect(
  data: BlueData,
  channelId: string,
  chainKind: MixerChainKind,
  entryId: string,
): Effect | null {
  const mixer = data.getMixer();
  const channels = [mixer.getMaster(), ...mixer.getAllSourceChannels(), ...mixer.getSubChannels()];
  const channel = channels.find(
    (candidate) =>
      candidate.getName() === channelId ||
      candidate.getAssociation() === channelId ||
      getKnownMixerChannelSnapshotId(candidate) === channelId,
  );
  if (!channel) return null;
  const chain = chainKind === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
  const entry = chain.find(
    (candidate) =>
      candidate instanceof Effect &&
      (getMixerEntrySnapshotId(candidate) === entryId ||
        (candidate as Effect & { getUniqueId?: () => string }).getUniqueId?.() === entryId),
  );
  return entry instanceof Effect ? entry : null;
}

function invertEditableEffectPatches(
  effect: Effect,
  patch: EffectEditablePatch,
): EffectEditablePatch[] | null {
  const inverse: EffectEditablePatch[] = [];
  if (patch.effectXml !== undefined) return null;
  if (patch.name !== undefined) inverse.push({ name: effect.getName() });
  if (patch.enabled !== undefined) inverse.push({ enabled: effect.isEnabled() });
  if (patch.numIns !== undefined) inverse.push({ numIns: effect.getNumIns() });
  if (patch.numOuts !== undefined) inverse.push({ numOuts: effect.getNumOuts() });
  if (patch.style !== undefined) inverse.push({ style: effect.getStyle() });
  if (patch.code !== undefined) inverse.push({ code: effect.getCode() });
  if (patch.comments !== undefined) inverse.push({ comments: effect.getComments() });
  if (patch.bsbInterface) {
    const interfaceInverses = invertBsbInterfacePatch(effect, patch.bsbInterface);
    if (!interfaceInverses) return null;
    inverse.push(...interfaceInverses.map((bsbInterface) => ({ bsbInterface })));
  }
  if (patch.opcodeList !== undefined) return null;
  return inverse;
}

/**
 * Inverts structural patches that target editable instrument fields (such as
 * BlueX7 voice settings, comments, or names) by reading the pre-mutation
 * canonical values from the project data. Returns null if any patch cannot be
 * inverted into a concrete live-reconcilable inverse patch.
 */
export function computeStructuralInversePatches(
  data: BlueData,
  patches: readonly ProjectDocumentPatch[] | undefined,
): ProjectDocumentPatch[] | null {
  if (!patches || patches.length === 0) return null;
  const inverse: ProjectDocumentPatch[] = [];

  for (const patch of patches) {
    const scorePatch = patch.score;
    if (scorePatch) {
      if (scorePatch.type === 'updateTrackInstrument') {
        const group = data
          .getScore()
          .find(
            (candidate): candidate is TrackLayerGroup =>
              candidate instanceof TrackLayerGroup &&
              candidate.getUniqueId() === scorePatch.track.rootGroupId,
          );
        const track = group?.find(
          (candidate) => candidate.getUniqueId() === scorePatch.track.trackId,
        );
        const instrument = track?.getInstrument();
        if (!instrument) return null;

        const subPatch = scorePatch.patch;
        const invertedInstrumentPatches = invertEditableInstrumentPatches(instrument, subPatch);
        if (!invertedInstrumentPatches) return null;
        for (const invertedInstrumentPatch of invertedInstrumentPatches) {
          inverse.push({
            score: {
              type: 'updateTrackInstrument',
              track: scorePatch.track,
              patch: invertedInstrumentPatch,
            },
          });
        }
        continue;
      }

      const isAutomationPatch =
        scorePatch.type === 'setAutomationPoints' ||
        scorePatch.type === 'insertAutomationPoint' ||
        scorePatch.type === 'deleteAutomationPoint' ||
        scorePatch.type === 'moveAutomationPoint' ||
        scorePatch.type === 'setAutomationResolution' ||
        scorePatch.type === 'moveAutomationRange' ||
        scorePatch.type === 'scaleAutomationRange';

      if (isAutomationPatch) {
        const affectedIds = collectAffectedScoreAutomationParameterIds(data, scorePatch);
        const catalog = getProjectParameterCatalog(data);
        let handled = false;
        for (const parameterId of affectedIds) {
          const entry = catalog.find((c) => c.parameter.getUniqueId() === parameterId);
          if (entry) {
            handled = true;
            if (scorePatch.type === 'setAutomationResolution') {
              inverse.push({
                score: {
                  type: 'setAutomationResolution',
                  parameterId,
                  resolutionDecimal: entry.parameter.getResolutionText(),
                },
              });
            } else {
              inverse.push({
                score: {
                  type: 'setAutomationPoints',
                  parameterId,
                  points: entry.parameter
                    .getPoints()
                    .map((p) => ({ time: p.time, value: p.value })),
                },
              });
            }
          }
        }
        if (handled) {
          continue;
        }
      }
    }

    const orchestraPatch = patch.orchestra;
    if (orchestraPatch?.type === 'updateInstrument') {
      const instrument = data.getArrangement().getInstrumentById(orchestraPatch.assignmentId);
      if (!instrument) return null;

      const subPatch = orchestraPatch.patch;
      const invertedInstrumentPatches = invertEditableInstrumentPatches(instrument, subPatch);
      if (!invertedInstrumentPatches) return null;
      for (const invertedInstrumentPatch of invertedInstrumentPatches) {
        inverse.push({
          orchestra: {
            type: 'updateInstrument',
            assignmentId: orchestraPatch.assignmentId,
            patch: invertedInstrumentPatch,
          },
        });
      }
      continue;
    }

    if (orchestraPatch?.type === 'updateInstrumentComment') {
      const instrument = data.getArrangement().getInstrumentById(orchestraPatch.assignmentId);
      if (!instrument) return null;
      inverse.push({
        orchestra: {
          type: 'updateInstrumentComment',
          assignmentId: orchestraPatch.assignmentId,
          comment: instrument.getComment(),
        },
      });
      continue;
    }

    const mixerPatch = patch.mixer;
    if (mixerPatch?.type === 'updateEffect') {
      const effect = findMixerEffect(
        data,
        mixerPatch.channelId,
        mixerPatch.chain,
        mixerPatch.entryId,
      );
      if (!effect) return null;
      const invertedEffectPatches = invertEditableEffectPatches(effect, mixerPatch.patch);
      if (!invertedEffectPatches) return null;
      for (const invertedEffectPatch of invertedEffectPatches) {
        inverse.push({
          mixer: {
            type: 'updateEffect',
            channelId: mixerPatch.channelId,
            chain: mixerPatch.chain,
            entryId: mixerPatch.entryId,
            patch: invertedEffectPatch,
          },
        });
      }
      continue;
    }

    return null;
  }

  return inverse.length > 0 ? inverse : null;
}

function bsbGroupingEndpoint(data: BlueData, delta: ProjectGraphDelta): BlueData {
  const result = data.historyCopy();
  transferProjectEditorIdentities(data, result);
  applyProjectGraphDelta(result, delta, 'after');
  return result;
}

function payloadFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function mergeScalarRecords(
  prior: readonly ScalarFieldRecord[],
  next: readonly ScalarFieldRecord[],
): ScalarFieldRecord[] {
  const records = new Map(
    prior.map((r) => [JSON.stringify([r.targetType, r.targetId, r.field]), r]),
  );
  for (const r of next) {
    const key = JSON.stringify([r.targetType, r.targetId, r.field]);
    const previous = records.get(key);
    records.set(key, { ...r, beforeValue: previous ? previous.beforeValue : r.beforeValue });
  }
  return [...records.values()];
}

function isNetZeroRecord(record: HistoryRecord | undefined): boolean {
  if (!record) return false;
  if (record.kind !== 'values') return isNetZeroProjectGraphDelta(record.delta);
  return record.records.every((r) => r.beforeValue === r.afterValue);
}

function restoreHistoryRecord(
  session: ProjectSession,
  record: HistoryRecord,
  direction: 'before' | 'after',
  stateId: string,
): void {
  const data = session.read().data!;
  if (record.kind !== 'values') applyProjectGraphDelta(data, record.delta, direction);
  else if (direction === 'before') rollbackScalarRecords(data, record.records);
  else for (const r of record.records) applyScalarFieldRecord(data, r, 'forward');
  session.recordMutation({ changed: true, stateId });
}

function oversizeExplanation(bytes: number, limit: number): string {
  const mib = (value: number): string => (value / (1024 * 1024)).toFixed(2);
  return bytes > limit
    ? `This action needs ${mib(bytes)} MiB of undo data; the per-action limit is ${mib(limit)} MiB. Reset history and apply to continue without retaining this action for undo.`
    : `This gesture cannot retain its cancellation data within the ${mib(limit * 2)} MiB active-history allowance. Cancel the edit or reset history and apply.`;
}

function estimateEntryBytes(record: HistoryRecord): number {
  const baseOverhead = 256;
  if (record.kind === 'values') {
    let bytes = baseOverhead;
    for (const r of record.records) {
      bytes += 64;
      bytes += (r.targetId.length + r.field.length) * 2;
      if (typeof r.beforeValue === 'string') bytes += r.beforeValue.length * 2;
      if (typeof r.afterValue === 'string') bytes += r.afterValue.length * 2;
    }
    return bytes;
  } else return estimateProjectGraphDeltaBytes(record.delta);
}

export class ProjectHistory {
  private readonly session: ProjectSession;
  private readonly captureSnapshot?: () => unknown;
  private readonly publishUpdated?: (event: ProjectDocumentUpdatedEvent) => void | Promise<void>;
  private readonly retainedEntryLimit: number;
  private readonly retainedBytesLimit: number;
  private readonly broadcastPrepareBoundary?: (
    event: PrepareHistoryBoundaryEvent,
  ) => void | Promise<void>;
  private readonly broadcastReleaseBoundary?: (
    event: ReleaseHistoryBoundaryEvent,
  ) => void | Promise<void>;
  private readonly barrierTimeoutMs: number;
  private readonly reconciliation?: ProjectRuntimeReconciliation;
  private readonly isParticipantActive?: (contextId: string) => boolean;

  private entries: HistoryEntry[] = [];
  private cursor = 0;
  private savedStateId: string | null = null;
  private activeGroup: ActiveGroupState | null = null;
  private activeCheckpoint: ActiveRollbackCheckpoint | null = null;
  private receiptCache = new Map<string, ProjectHistoryResponse>();
  private receiptFingerprints = new Map<string, string>();
  private inFlightOperations = new Map<
    string,
    { fingerprint: string; promise: Promise<ProjectHistoryResponse> }
  >();
  // Bounded like operation receipts; delayed input cannot revive rejected live work.
  private rejectedGestures = new Set<string>();
  private pendingOversizeProposal: {
    token: string;
    documentId: string;
    expectedRevision: number;
    payloadFingerprint: string;
  } | null = null;
  private pendingDirectOversizeProposal: {
    token: string;
    documentId: string;
    expectedRevision: number;
    payloadFingerprint: string;
    label: string;
    origin?: {
      contextId?: string;
      viewId?: string;
      selection?: ProjectHistorySelectionHint[];
    };
  } | null = null;

  private readonly participants = new Map<string, HistoryParticipantInfo>();
  private activeBarrier: ActiveBarrierState | null = null;
  private barrierReleasePromise: Promise<void> | null = null;
  private notifyBarrierReleased: (() => void) | null = null;
  private barrierExecutionQueue: Promise<unknown> = Promise.resolve();
  /** Serializes every asynchronous mutation, including direct adapters. */
  private orderedMutationQueue: Promise<void> = Promise.resolve();
  private orderedMutationPending = 0;
  private readonly queuedParticipantCommits = new Map<
    ProjectHistoryCommitRequest,
    (barrierId?: string) => Promise<ProjectHistoryResponse>
  >();

  constructor(dependencies: ProjectHistoryDependencies) {
    this.session = dependencies.session;
    this.captureSnapshot = dependencies.captureSnapshot;
    this.publishUpdated = dependencies.publishUpdated;
    this.retainedEntryLimit = dependencies.retainedEntryLimit ?? DEFAULT_RETAINED_ENTRY_LIMIT;
    this.retainedBytesLimit = dependencies.retainedBytesLimit ?? DEFAULT_RETAINED_BYTES_LIMIT;
    this.broadcastPrepareBoundary = dependencies.broadcastPrepareBoundary;
    this.broadcastReleaseBoundary = dependencies.broadcastReleaseBoundary;
    this.barrierTimeoutMs = dependencies.barrierTimeoutMs ?? 5000;
    this.reconciliation = dependencies.reconciliation;
    this.isParticipantActive = dependencies.isParticipantActive;
  }

  private enqueueOrderedMutation<T>(operation: () => Promise<T> | T): Promise<T> {
    const previous = this.orderedMutationQueue;
    const startsImmediately = this.orderedMutationPending === 0;
    let release!: () => void;
    this.orderedMutationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.orderedMutationPending += 1;

    let run: Promise<T>;
    if (startsImmediately) {
      try {
        run = Promise.resolve(operation());
      } catch (error) {
        run = Promise.reject(error);
      }
    } else {
      run = previous.catch(() => undefined).then(operation);
    }
    return run.finally(() => {
      this.orderedMutationPending = Math.max(0, this.orderedMutationPending - 1);
      release();
    });
  }

  private capturePublishedSnapshot(): unknown {
    return this.captureSnapshot?.() ?? null;
  }

  getCursor(): number {
    return this.cursor;
  }

  getEntries(): readonly HistoryEntry[] {
    return this.entries;
  }

  getSavedStateId(): string | null {
    return this.savedStateId;
  }

  setSavedStateId(stateId: string | null): void {
    this.savedStateId = stateId;
  }

  checkpointSave(savedStateId?: string): void {
    this.closeGroup();
    const current = this.session.read();
    this.savedStateId = savedStateId ?? current.stateId;
  }

  markClean(): void {
    this.checkpointSave();
  }

  isDirty(): boolean {
    const current = this.session.read();
    if (!current.data) return false;
    return current.stateId !== this.savedStateId;
  }

  /**
   * Authoritative save state for the active project (spec 109): read-only,
   * constant-time, and derived from the session facts plus the save
   * checkpoint. Never mutates history, the session, or the checkpoint.
   */
  getSaveState(): ProjectSaveState {
    const current = this.session.read();
    if (!current.data) return 'none';
    if (!current.filePath) return 'unsaved';
    return current.stateId === this.savedStateId ? 'saved' : 'modified';
  }

  clear(): void {
    this.entries = [];
    this.cursor = 0;
    this.activeGroup = null;
    this.activeCheckpoint = null;
    this.receiptCache.clear();
    this.receiptFingerprints.clear();
    this.pendingOversizeProposal = null;
    this.pendingDirectOversizeProposal = null;
  }

  closeGroup(): void {
    this.activeGroup = null;
    this.activeCheckpoint = null;
  }

  private getRetainedBytesWithCheckpoint(
    candidateExtraBytes = 0,
    includeCheckpoint = true,
  ): number {
    const retained = new Set(this.entries);
    if (includeCheckpoint && this.activeCheckpoint) {
      for (const entry of this.activeCheckpoint.redoEntries) retained.add(entry);
      for (const entry of this.activeCheckpoint.evictedEntries) retained.add(entry);
    }
    let bytes = 0;
    for (const entry of retained) bytes += entry.retainedBytes;
    return bytes + candidateExtraBytes;
  }

  private async finalizeNetZero(
    request: ProjectHistoryCommitRequest,
    documentId: string,
    gestureIdToDrain?: string,
  ): Promise<ProjectHistoryResponse> {
    if (!this.activeCheckpoint) {
      const snap = this.session.read();
      return {
        status: 'unchanged',
        operationId: request.operationId,
        documentId,
        revision: snap.revision,
        stateId: snap.stateId ?? '',
        isDirty: this.isDirty(),
        history: this.read(),
        receipt: {
          revision: snap.revision,
          sessionId: snap.sessionId,
          changed: false,
          patchChanged: [],
          patchAccepted: [],
          documentId,
          stateId: snap.stateId ?? '',
        },
      };
    }

    let entry: HistoryEntry | undefined;
    if (this.activeCheckpoint.activeEntryId) {
      const idx = this.entries.findIndex((e) => e.entryId === this.activeCheckpoint!.activeEntryId);
      if (idx !== -1) {
        entry = this.entries.splice(idx, 1)[0];
      }
    }
    this.entries.unshift(...this.activeCheckpoint.evictedEntries);
    this.entries.push(...this.activeCheckpoint.redoEntries);
    this.cursor = this.activeCheckpoint.baseCursor;
    this.savedStateId = this.activeCheckpoint.savedStateId;

    if (entry)
      restoreHistoryRecord(
        this.session,
        entry.record,
        'before',
        this.activeCheckpoint.beforeStateId,
      );

    if (this.reconciliation && gestureIdToDrain) {
      await this.reconciliation.drainPreviews(gestureIdToDrain);
    }

    this.activeGroup = null;
    this.activeCheckpoint = null;

    const updatedSnap = this.session.read();
    const projection = this.read();
    const publishedIsDirty = this.isDirty();
    const publishedSnapshot = this.capturePublishedSnapshot();

    const inversePatches =
      entry?.inversePatches ??
      (entry?.record.kind === 'values'
        ? scalarRecordsToInversePatches(entry.record.records)
        : [{ orchestra: { type: 'structuralChange' } as never }]);
    const reconciliationPromise = this.reconciliation?.reconcileCommit({
      documentId: updatedSnap.documentId!,
      revision: updatedSnap.revision,
      patches: inversePatches,
    });

    const updatedEvent: ProjectDocumentUpdatedEvent = {
      documentId: updatedSnap.documentId!,
      sessionId: updatedSnap.sessionId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: publishedIsDirty,
      history: projection,
      acceptedOperationIds: [request.operationId],
      sourceSequence: request.contextSequence,
      snapshot: publishedSnapshot,
      originViewId: request.origin?.viewId,
      originContextId: request.origin?.contextId,
    };
    await this.publishUpdated?.(updatedEvent);
    await reconciliationPromise;

    const resp: ProjectHistoryUnchangedResponse = {
      status: 'unchanged',
      operationId: request.operationId,
      documentId: updatedSnap.documentId ?? documentId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId ?? '',
      isDirty: publishedIsDirty,
      history: projection,
      receipt: {
        revision: updatedSnap.revision,
        sessionId: updatedSnap.sessionId,
        changed: false,
        patchChanged: [],
        patchAccepted: [],
        documentId: updatedSnap.documentId ?? documentId,
        stateId: updatedSnap.stateId ?? '',
      },
    };
    this.cacheReceipt(request.operationId, resp);
    return resp;
  }

  read(request?: ProjectHistoryReadRequest): ProjectHistoryStateProjection {
    const current = this.session.read();
    const canUndo = this.cursor > 0;
    const canRedo = this.cursor < this.entries.length;
    const undoEntry = canUndo ? this.entries[this.cursor - 1] : undefined;
    const redoEntry = canRedo ? this.entries[this.cursor] : undefined;

    const retainedBytes = this.getRetainedBytesWithCheckpoint();

    return {
      canUndo,
      canRedo,
      undoLabel: undoEntry ? undoEntry.label : null,
      redoLabel: redoEntry ? redoEntry.label : null,
      cursor: this.cursor,
      length: this.entries.length,
      retainedBytes,
      savedStateId: this.savedStateId,
      stateId: current.stateId ?? '',
      revision: current.revision,
      limitBytes: this.retainedBytesLimit,
      maxEntries: this.retainedEntryLimit,
      retentionStatus:
        this.entries.length === 0
          ? 'empty'
          : this.entries.length >= this.retainedEntryLimit
            ? 'at-entry-limit'
            : retainedBytes >= this.retainedBytesLimit
              ? 'at-byte-limit'
              : 'within-limit',
    };
  }

  /**
   * Serializable per-entry projection for read-only history views (spec 106).
   * Excludes mementos, patches, and origin metadata; order matches
   * getEntries() (oldest-first) so renderers only derive display order.
   */
  readEntries(request?: ProjectHistoryReadRequest): ProjectHistoryEntriesSnapshot {
    const current = this.session.read();
    return {
      documentId: request?.documentId ?? current.documentId ?? '',
      revision: current.revision,
      cursor: this.cursor,
      entries: this.entries.map((entry) => ({
        entryId: entry.entryId,
        label: entry.label,
        timestamp: entry.timestamp,
        afterStateId: entry.afterStateId,
      })),
    };
  }

  private cacheReceipt(operationId: string, response: ProjectHistoryResponse): void {
    if (this.receiptCache.size >= RECEIPT_CACHE_LIMIT) {
      const firstKey = this.receiptCache.keys().next().value;
      if (firstKey !== undefined) {
        this.receiptCache.delete(firstKey);
        this.receiptFingerprints.delete(firstKey);
      }
    }
    this.receiptCache.set(operationId, response);
  }

  /**
   * Stable identity of a commit's semantic payload. Retries reuse the same
   * operationId with an identical fingerprint; a reused operationId carrying a
   * different payload is a conflict and must be rejected, never reapplied.
   */
  private static commitFingerprint(request: ProjectHistoryCommitRequest): string {
    return JSON.stringify(request);
  }

  private static directMutationFingerprint(
    label: string,
    beforeMemento: BlueData,
    afterMemento: BlueData,
  ): string {
    try {
      return payloadFingerprint([label, beforeMemento.saveToString(), afterMemento.saveToString()]);
    } catch {
      return `${label}:${beforeMemento.constructor.name}:${afterMemento.constructor.name}`;
    }
  }

  private createDirectReceipt(
    current: ProjectSessionSnapshot,
    changed: boolean,
    stateId = current.stateId ?? '',
    extra: Partial<ProjectDocumentCommitReceipt> = {},
  ): ProjectDocumentCommitReceipt {
    return {
      revision: current.revision,
      sessionId: current.sessionId,
      changed,
      documentId: current.documentId ?? undefined,
      stateId,
      ...extra,
    };
  }

  private runIdempotentOperation(
    kind: 'commit' | 'undo' | 'redo',
    operationId: string,
    documentId: string,
    payload: string,
    operation: () => Promise<ProjectHistoryResponse>,
  ): Promise<ProjectHistoryResponse> {
    const fingerprint = payloadFingerprint(payload);
    const knownFingerprint = this.receiptFingerprints.get(operationId);
    if (knownFingerprint !== undefined && knownFingerprint !== fingerprint) {
      return Promise.resolve({
        status: 'invalid',
        operationId,
        documentId,
        reason: `Conflicting reuse of operationId ${operationId}: ${kind} payload differs from the already-processed submission`,
      });
    }

    const cached = this.receiptCache.get(operationId);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.inFlightOperations.get(operationId);
    if (inFlight) {
      return inFlight.fingerprint === fingerprint
        ? inFlight.promise
        : Promise.resolve({
            status: 'invalid',
            operationId,
            documentId,
            reason: `Conflicting reuse of operationId ${operationId}: ${kind} payload differs from the in-flight submission`,
          });
    }

    this.receiptFingerprints.set(operationId, fingerprint);
    let operationPromise: Promise<ProjectHistoryResponse>;
    try {
      operationPromise = operation();
    } catch (error) {
      operationPromise = Promise.reject(error);
    }
    const promise = operationPromise.then((response) => {
      // Individual execution paths cache their richer responses as they
      // settle. Cache every remaining response here as well so an oversize,
      // unchanged, or otherwise early return is still idempotent after the
      // in-flight promise has completed.
      if (!this.receiptCache.has(operationId)) {
        this.cacheReceipt(operationId, response);
      }
      return response;
    });
    this.inFlightOperations.set(operationId, { fingerprint, promise });
    const cleanup = (): void => {
      const current = this.inFlightOperations.get(operationId);
      if (current?.promise === promise) this.inFlightOperations.delete(operationId);
    };
    void promise.then(cleanup, cleanup);
    return promise;
  }

  private enforceLimits(): void {
    let totalBytes = 0;
    for (const e of this.entries) {
      totalBytes += e.retainedBytes;
    }

    while (
      this.entries.length > 0 &&
      (this.entries.length > this.retainedEntryLimit || totalBytes > this.retainedBytesLimit)
    ) {
      const evicted = this.entries.shift()!;
      totalBytes -= evicted.retainedBytes;
      if (this.activeCheckpoint) {
        this.activeCheckpoint.evictedEntries.push(evicted);
      }
      this.cursor = Math.max(0, this.cursor - 1);
    }
  }

  getActiveBarrier(): PrepareHistoryBoundaryEvent | null {
    if (!this.activeBarrier) return null;
    return {
      barrierId: this.activeBarrier.barrierId,
      reason: this.activeBarrier.reason,
    };
  }

  getParticipants(): readonly HistoryParticipantInfo[] {
    return Array.from(this.participants.values());
  }

  registerParticipant(
    request: RegisterHistoryParticipantRequest,
  ): RegisterHistoryParticipantResponse {
    const current = this.session.read();
    if (!current.data || !current.documentId) {
      return { ok: false, reason: 'No active project document in session' };
    }
    if (current.documentId !== request.documentId) {
      return {
        ok: false,
        reason: 'History participant document does not match the active project',
      };
    }
    if (request.acceptedRevision > current.revision) {
      return {
        ok: false,
        reason: 'History participant revision is ahead of the active document',
      };
    }

    const existing = this.participants.get(request.contextId);
    if (existing?.documentId === request.documentId) {
      // Registration is idempotent for a live context. Preserve its sequence
      // high-watermark so a repeated registration cannot replay old work.
      existing.acceptedRevision = Math.max(existing.acceptedRevision, request.acceptedRevision);
    } else {
      this.participants.set(request.contextId, {
        contextId: request.contextId,
        documentId: request.documentId,
        acceptedRevision: request.acceptedRevision,
        lastSequence: 0,
      });
    }

    if (this.activeBarrier) {
      this.activeBarrier.pendingContextIds.add(request.contextId);
      return {
        ok: true,
        activeBarrier: {
          barrierId: this.activeBarrier.barrierId,
          reason: this.activeBarrier.reason,
        },
      };
    }

    return { ok: true };
  }

  unregisterParticipant(request: UnregisterHistoryParticipantRequest): void {
    this.participants.delete(request.contextId);
    if (this.activeBarrier) {
      this.activeBarrier.pendingContextIds.delete(request.contextId);
      if (this.activeBarrier.pendingContextIds.size === 0) {
        this.activeBarrier.resolve({ ok: true });
      }
    }
  }

  private recordBoundaryCommandSequence(
    request: ProjectHistoryUndoRequest | ProjectHistoryRedoRequest,
  ): void {
    const contextId = request.origin?.contextId;
    if (!contextId) return;
    const participant = this.participants.get(contextId);
    if (!participant) return;
    participant.lastSequence = Math.max(participant.lastSequence, request.contextSequence);
  }

  acknowledgeBoundary(ack: PrepareHistoryBoundaryAck): ProjectHistoryControlResponse {
    const participant = this.participants.get(ack.contextId);
    if (!participant) {
      return { ok: false, reason: 'Unknown history participant context' };
    }

    if (!this.activeBarrier || this.activeBarrier.barrierId !== ack.barrierId) {
      return { ok: false, reason: 'History boundary is not active' };
    }

    const current = this.session.read();
    if (participant.documentId !== current.documentId) {
      const reason = 'History participant document is no longer active';
      this.activeBarrier.resolve({ ok: false, reason });
      return { ok: false, reason };
    }
    if (ack.lastAcknowledgedRevision > current.revision) {
      const reason = 'History boundary revision is ahead of the active document';
      this.activeBarrier.resolve({ ok: false, reason });
      return { ok: false, reason };
    }
    const sequenceAtBoundary = this.activeBarrier.participantSequences.get(ack.contextId) ?? 0;
    if (ack.lastAcknowledgedSequence < sequenceAtBoundary) {
      const reason = 'History boundary acknowledgement sequence is stale';
      this.activeBarrier.resolve({ ok: false, reason });
      return { ok: false, reason };
    }
    // The boundary command itself is allocated a context sequence before its
    // prefix is drained. Permit that one in-flight sequence, while still
    // rejecting acknowledgements that claim multiple unsubmitted operations.
    if (ack.lastAcknowledgedSequence > participant.lastSequence + 1) {
      const reason = 'History boundary acknowledgement sequence is ahead of submitted work';
      this.activeBarrier.resolve({ ok: false, reason });
      return { ok: false, reason };
    }

    if (ack.outstandingPrefixCount > 0) {
      const reason = 'History participant still has outstanding prefix edits';
      this.activeBarrier.resolve({ ok: false, reason });
      return { ok: false, reason };
    }
    if ((ack.failedPrefixCount ?? 0) > 0 || (ack.unresolvedPrefixCount ?? 0) > 0) {
      const reason = 'History participant reported failed or unresolved prefix edits';
      this.activeBarrier.resolve({ ok: false, reason });
      return { ok: false, reason };
    }

    participant.lastSequence = Math.max(participant.lastSequence, ack.lastAcknowledgedSequence);
    participant.acceptedRevision = Math.max(
      participant.acceptedRevision,
      ack.lastAcknowledgedRevision,
    );

    this.activeBarrier.pendingContextIds.delete(ack.contextId);
    if (this.activeBarrier.pendingContextIds.size === 0) {
      this.activeBarrier.resolve({ ok: true });
    }
    return { ok: true };
  }

  cancelOversizeProposal(request: CancelOversizeProposalRequest): ProjectHistoryControlResponse {
    if (this.pendingOversizeProposal?.token === request.proposalToken) {
      this.pendingOversizeProposal = null;
      return { ok: true };
    }
    if (this.pendingDirectOversizeProposal?.token === request.proposalToken) {
      this.pendingDirectOversizeProposal = null;
      return { ok: true };
    }
    return { ok: false, reason: 'Oversize proposal token is invalid or already consumed' };
  }

  abortBoundary(barrierId: string, reason = 'Settlement barrier aborted'): void {
    if (this.activeBarrier && this.activeBarrier.barrierId === barrierId) {
      this.activeBarrier.resolve({ ok: false, reason });
    }
  }

  private async waitForBarrierToRelease(): Promise<void> {
    while (this.activeBarrier !== null) {
      if (this.barrierReleasePromise) {
        await this.barrierReleasePromise;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  private initBarrierReleasePromise(): void {
    this.barrierReleasePromise = new Promise<void>((resolve) => {
      this.notifyBarrierReleased = () => {
        this.barrierReleasePromise = null;
        this.notifyBarrierReleased = null;
        resolve();
      };
    });
  }

  async settleBoundary(reason: ProjectHistoryBarrierReason): Promise<boolean> {
    return this.runSettlementBarrier(reason, async () => true);
  }

  async runSettlementBarrier<T>(
    reason: ProjectHistoryBarrierReason,
    action: () => Promise<T>,
  ): Promise<T> {
    const previousQueue = this.barrierExecutionQueue;
    let runResolve!: (val: unknown) => void;
    this.barrierExecutionQueue = new Promise((resolve) => {
      runResolve = resolve;
    });

    try {
      await previousQueue;
    } catch {
      // Ignore errors from previous barrier runs in the FIFO queue
    }

    try {
      const barrierId = `barrier-${randomUUID()}`;

      // Participants fence transitions for the document they registered
      // against. Renderers never unregister, so after a close or replacement
      // their stale registrations would fence every later barrier waiting for
      // an acknowledgement that can never arrive (spec 109 smoke regression).
      // Drop registrations whose document identity is gone before collecting
      // the contexts to wait on.
      const currentDocumentId = this.session.read().documentId;
      for (const [contextId, info] of this.participants) {
        if (info.documentId !== currentDocumentId) {
          this.participants.delete(contextId);
        } else if (this.isParticipantActive && !this.isParticipantActive(contextId)) {
          this.participants.delete(contextId);
        }
      }

      const contexts = Array.from(this.participants.keys());

      this.closeGroup();

      if (contexts.length > 0) {
        let resolveBarrier!: (result: { ok: boolean; reason?: string }) => void;
        const barrierPromise = new Promise<{ ok: boolean; reason?: string }>((resolve) => {
          resolveBarrier = resolve;
        });

        this.initBarrierReleasePromise();

        const timeoutHandle = setTimeout(() => {
          if (this.activeBarrier?.barrierId === barrierId) {
            const pending = Array.from(this.activeBarrier.pendingContextIds);
            resolveBarrier({
              ok: false,
              reason: `Settlement barrier timed out after ${this.barrierTimeoutMs}ms (pending contexts: ${pending.join(', ')})`,
            });
          }
        }, this.barrierTimeoutMs);

        this.activeBarrier = {
          barrierId,
          reason,
          pendingContextIds: new Set(contexts),
          participantSequences: new Map(
            contexts.map((contextId) => [
              contextId,
              this.participants.get(contextId)?.lastSequence ?? 0,
            ]),
          ),
          resolve: resolveBarrier,
          timeoutHandle,
        };

        // A participant may already be awaiting a submission queued behind
        // this command. Include it in the prefix before asking it to drain.
        for (const [request, run] of this.queuedParticipantCommits) {
          if (this.isPendingParticipantCommit(request)) void run(barrierId);
        }

        const prepEvt: PrepareHistoryBoundaryEvent = { barrierId, reason };
        try {
          await this.broadcastPrepareBoundary?.(prepEvt);
        } catch (err) {
          console.error('Error broadcasting prepare boundary:', err);
        }

        const barrierResult = await barrierPromise;
        clearTimeout(timeoutHandle);

        if (!barrierResult.ok) {
          this.activeBarrier = null;
          this.notifyBarrierReleased?.();
          const releaseEvt: ReleaseHistoryBoundaryEvent = {
            barrierId,
            status: 'aborted',
            reason: barrierResult.reason,
          };
          try {
            await this.broadcastReleaseBoundary?.(releaseEvt);
          } catch (err) {
            console.error('Error broadcasting aborted release boundary:', err);
          }
          throw new Error(barrierResult.reason ?? 'Settlement barrier aborted');
        }
      }

      let result: T;
      try {
        result = await action();
      } finally {
        this.activeBarrier = null;
        this.notifyBarrierReleased?.();
        const releaseEvt: ReleaseHistoryBoundaryEvent = {
          barrierId,
          status: 'ready',
        };
        try {
          await this.broadcastReleaseBoundary?.(releaseEvt);
        } catch (err) {
          console.error('Error broadcasting ready release boundary:', err);
        }
      }

      return result;
    } finally {
      runResolve(undefined);
    }
  }

  commit(request: ProjectHistoryCommitRequest): Promise<ProjectHistoryResponse> {
    const fingerprint = ProjectHistory.commitFingerprint(request);
    const isActiveBarrierPrefix =
      request.barrierId !== undefined && request.barrierId === this.activeBarrier?.barrierId;
    return this.runIdempotentOperation(
      'commit',
      request.operationId,
      request.documentId,
      fingerprint,
      () => {
        if (isActiveBarrierPrefix || this.isPendingParticipantCommit(request)) {
          return this.commitInternal({ ...request, barrierId: this.activeBarrier!.barrierId });
        }
        return new Promise<ProjectHistoryResponse>((resolve, reject) => {
          let execution: Promise<ProjectHistoryResponse> | undefined;
          const run = (barrierId?: string): Promise<ProjectHistoryResponse> => {
            if (!execution) {
              this.queuedParticipantCommits.delete(request);
              execution = this.commitInternal(barrierId ? { ...request, barrierId } : request);
              // Resolve the submission when its prefix finishes, not when its
              // original queue slot is reached after the boundary command.
              void execution.then(resolve, reject);
            }
            return execution;
          };
          this.queuedParticipantCommits.set(request, run);
          void this.enqueueOrderedMutation(() => run()).catch(reject);
        });
      },
    );
  }

  private isPendingParticipantCommit(request: ProjectHistoryCommitRequest): boolean {
    const contextId = request.origin?.contextId;
    // Until this context acknowledges prepare, its untagged arrivals were
    // submitted before it paused. After acknowledgement, ordinary writes wait.
    return (
      request.barrierId === undefined &&
      contextId !== undefined &&
      this.activeBarrier?.pendingContextIds.has(contextId) === true
    );
  }

  private async commitInternal(
    request: ProjectHistoryCommitRequest,
  ): Promise<ProjectHistoryResponse> {
    if (this.activeBarrier) {
      const isPrefix = request.barrierId === this.activeBarrier.barrierId;
      if (!isPrefix) {
        await this.waitForBarrierToRelease();
      }
    }

    const current = this.session.read();

    if (!current.data || !current.documentId) {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: request.documentId,
        reason: 'No active project document in session',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    // Document lifetime mismatch
    if (request.documentId !== current.documentId) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: `Document ID mismatch (expected ${request.documentId}, current ${current.documentId})`,
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    const participant = request.origin?.contextId
      ? this.participants.get(request.origin.contextId)
      : undefined;

    const gestureKey = JSON.stringify([
      request.documentId,
      request.origin?.contextId,
      request.gestureId,
    ]);
    if (request.gestureId && !request.proposalToken && this.rejectedGestures.has(gestureKey)) {
      return {
        status: 'invalid',
        operationId: request.operationId,
        documentId: current.documentId,
        reason: 'Gesture was rolled back after exceeding the history limit',
      };
    }

    // Monotonic sequence high-watermark check per context
    if (participant && request.contextSequence < participant.lastSequence) {
      const resp: ProjectHistoryUnchangedResponse = {
        status: 'unchanged',
        operationId: request.operationId,
        documentId: current.documentId,
        revision: current.revision,
        stateId: current.stateId ?? '',
        isDirty: this.isDirty(),
        history: this.read(),
      };
      return resp;
    }

    // Revision mismatch with bounded stale retry
    if (request.expectedRevision !== current.revision) {
      const canRetry =
        request.preconditions &&
        request.preconditions.length > 0 &&
        validatePreconditions(current.data, request.preconditions).valid;

      if (!canRetry) {
        const resp: ProjectHistoryStaleResponse = {
          status: 'stale',
          operationId: request.operationId,
          documentId: request.documentId,
          currentRevision: current.revision,
          currentStateId: current.stateId ?? '',
          reason: `Revision mismatch (expected ${request.expectedRevision}, current ${current.revision})`,
        };
        this.cacheReceipt(request.operationId, resp);
        return resp;
      }
    }

    if (participant) {
      participant.lastSequence = Math.max(participant.lastSequence, request.contextSequence);
    }

    // Handle gesture cancellation
    if (request.phase === 'cancel') {
      const isMatchingGroup = matchesActiveGroup(this.activeGroup, request);

      if (isMatchingGroup) {
        let entry: HistoryEntry | undefined;
        if (this.activeCheckpoint?.activeEntryId) {
          const idx = this.entries.findIndex(
            (e) => e.entryId === this.activeCheckpoint!.activeEntryId,
          );
          if (idx !== -1) {
            entry = this.entries.splice(idx, 1)[0];
          }
        } else if (this.cursor > 0 && this.cursor === this.entries.length) {
          entry = this.entries.pop();
          this.cursor--;
        }

        const gestureIdToDrain = request.gestureId ?? this.activeGroup?.gestureId;
        if (this.reconciliation && gestureIdToDrain) {
          await this.reconciliation.drainPreviews(gestureIdToDrain);
        }

        if (this.activeCheckpoint) {
          this.entries.unshift(...this.activeCheckpoint.evictedEntries);
          this.entries.push(...this.activeCheckpoint.redoEntries);
          this.cursor = this.activeCheckpoint.baseCursor;
          this.savedStateId = this.activeCheckpoint.savedStateId;

          if (entry)
            restoreHistoryRecord(
              this.session,
              entry.record,
              'before',
              this.activeCheckpoint.beforeStateId,
            );
        } else if (entry) {
          restoreHistoryRecord(this.session, entry.record, 'before', entry.beforeStateId);
        }

        this.activeGroup = null;
        this.activeCheckpoint = null;

        const updatedSnap = this.session.read();
        const projection = this.read();
        const publishedIsDirty = this.isDirty();
        const publishedSnapshot = this.capturePublishedSnapshot();

        const inversePatches =
          entry?.inversePatches ??
          (entry?.record.kind === 'values'
            ? scalarRecordsToInversePatches(entry.record.records)
            : [{ orchestra: { type: 'structuralChange' } as never }]);

        const reconciliationPromise = this.reconciliation
          ? this.reconciliation.reconcileCommit({
              documentId: updatedSnap.documentId!,
              revision: updatedSnap.revision,
              patches: inversePatches,
            })
          : undefined;

        const updatedEvent: ProjectDocumentUpdatedEvent = {
          documentId: updatedSnap.documentId!,
          sessionId: updatedSnap.sessionId,
          revision: updatedSnap.revision,
          stateId: updatedSnap.stateId!,
          isDirty: publishedIsDirty,
          history: projection,
          acceptedOperationIds: [request.operationId],
          sourceSequence: request.contextSequence,
          snapshot: publishedSnapshot,
          originViewId: request.origin?.viewId,
          originContextId: request.origin?.contextId,
        };
        await this.publishUpdated?.(updatedEvent);
        const runtimeOutcomes = reconciliationPromise ? await reconciliationPromise : undefined;

        const resp: ProjectHistoryCommittedResponse = {
          status: 'committed',
          operationId: request.operationId,
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          stateId: updatedSnap.stateId!,
          isDirty: publishedIsDirty,
          history: projection,
          runtimeOutcomes,
          receipt: {
            revision: updatedSnap.revision,
            sessionId: updatedSnap.sessionId,
            changed: true,
            patchChanged: [],
            patchAccepted: [],
            documentId: updatedSnap.documentId!,
            stateId: updatedSnap.stateId!,
          },
        };
        this.cacheReceipt(request.operationId, resp);
        return resp;
      } else {
        // Obsolete or unmatched cancel must not close active group or rollback unrelated work
        const resp: ProjectHistoryUnchangedResponse = {
          status: 'unchanged',
          operationId: request.operationId,
          documentId: current.documentId,
          revision: current.revision,
          stateId: current.stateId ?? '',
          isDirty: this.isDirty(),
          history: this.read(),
          receipt: {
            revision: current.revision,
            sessionId: current.sessionId,
            changed: false,
            patchChanged: [],
            patchAccepted: [],
            documentId: current.documentId,
            stateId: current.stateId ?? '',
          },
        };
        this.cacheReceipt(request.operationId, resp);
        return resp;
      }
    }

    // Explicit gestures close on end or another action; only implicit field edits time out.
    const now = Date.now();
    const canGroup =
      request.phase !== 'begin' &&
      request.phase !== 'single' &&
      this.activeGroup !== null &&
      this.cursor > 0 &&
      ((request.gestureId !== undefined && this.activeGroup.gestureId === request.gestureId) ||
        (request.fieldId !== undefined &&
          now - this.activeGroup.lastTimestamp <= GESTURE_GROUPING_TIMEOUT_MS &&
          this.activeGroup.fieldId === request.fieldId &&
          (request.origin?.contextId === undefined ||
            this.activeGroup.sourceContextId === undefined ||
            this.activeGroup.sourceContextId === request.origin.contextId)));

    const isLiveGesture = request.phase === 'begin' || request.phase === 'update';

    const beforeStateId = current.stateId ?? `state-${randomUUID()}`;
    let baselineBaseCursor = this.cursor;
    let baselineRedoEntries: readonly HistoryEntry[] = [];
    let baselineBeforeStateId = beforeStateId;
    let baselineWasDirty = this.isDirty();
    let baselineSavedStateId = this.savedStateId;

    if (isLiveGesture && !canGroup) {
      baselineRedoEntries = this.entries.slice(this.cursor);
    }

    // Prepare transaction
    const prep = prepareTransaction(current.data, request.patches ?? [], {
      preconditions: request.preconditions,
      context: {
        projectSessionId: current.sessionId,
        projectRevision: current.revision,
      },
    });

    if (prep.status === 'stale') {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: current.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: prep.reason,
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (prep.status === 'invalid') {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: current.documentId,
        reason: prep.reason,
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    const { transaction } = prep;

    // Unchanged / empty transaction
    if (transaction.kind === 'empty' || !transaction.changed) {
      if (request.phase === 'end') {
        const isMatchingGroup = matchesActiveGroup(this.activeGroup, request);

        if (isMatchingGroup) {
          if (this.activeCheckpoint && isNetZeroRecord(this.entries[this.cursor - 1]?.record)) {
            return await this.finalizeNetZero(
              request,
              current.documentId,
              this.activeGroup?.gestureId,
            );
          }

          this.closeGroup();
          this.enforceLimits();

          const resp: ProjectHistoryUnchangedResponse = {
            status: 'unchanged',
            operationId: request.operationId,
            documentId: current.documentId,
            revision: current.revision,
            stateId: current.stateId ?? '',
            isDirty: this.isDirty(),
            history: this.read(),
            receipt: {
              revision: current.revision,
              sessionId: current.sessionId,
              changed: false,
              patchChanged: transaction.patchChanged
                ? [...transaction.patchChanged]
                : (request.patches?.map(() => false) ?? []),
              patchAccepted: transaction.patchAccepted
                ? [...transaction.patchAccepted]
                : (request.patches?.map(() => true) ?? []),
              documentId: current.documentId,
              stateId: current.stateId ?? '',
            },
          };
          this.cacheReceipt(request.operationId, resp);
          return resp;
        }
      }

      const resp: ProjectHistoryUnchangedResponse = {
        status: 'unchanged',
        operationId: request.operationId,
        documentId: current.documentId,
        revision: current.revision,
        stateId: current.stateId ?? '',
        isDirty: this.isDirty(),
        history: this.read(),
        receipt: {
          revision: current.revision,
          sessionId: current.sessionId,
          changed: false,
          patchChanged: transaction.patchChanged
            ? [...transaction.patchChanged]
            : (request.patches?.map(() => false) ?? []),
          patchAccepted: transaction.patchAccepted
            ? [...transaction.patchAccepted]
            : (request.patches?.map(() => true) ?? []),
          documentId: current.documentId,
          stateId: current.stateId ?? '',
        },
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    // Check oversize limit for structural transaction
    const nextStateId = `state-${randomUUID()}`;

    let historyRecord: HistoryRecord;
    if (transaction.kind === 'scalar') {
      if (
        transaction.records.some(
          (record) =>
            typeof record.beforeValue === 'string' &&
            typeof record.afterValue === 'string' &&
            record.beforeValue.length + record.afterValue.length > 1024,
        )
      ) {
        const before = current.data.historyCopy();
        transferProjectEditorIdentities(current.data, before);
        rollbackScalarRecords(before, transaction.records);
        const after = current.data.historyCopy();
        transferProjectEditorIdentities(current.data, after);
        historyRecord = { kind: 'structure', delta: captureProjectGraphDelta(before, after) };
      } else historyRecord = { kind: 'values', records: transaction.records };
    } else if (transaction.kind === 'bsb') {
      historyRecord = { kind: 'bsb', delta: transaction.delta };
    } else {
      historyRecord = {
        kind: 'structure',
        delta: transaction.delta,
      };
    }

    const forwardPatches = request.patches ? [...request.patches] : [];
    const rawComputedInverses =
      transaction.kind === 'scalar'
        ? scalarRecordsToInversePatches(transaction.records)
        : (computeStructuralInversePatches(current.data, request.patches) ?? [
            { orchestra: { type: 'structuralChange' } as never },
          ]);

    const computedInverses =
      historyRecord.kind !== 'values'
        ? compactHistoryRuntimePatches(rawComputedInverses, 'first')
        : rawComputedInverses;

    const entryBytes = (
      record: HistoryRecord,
      forward: readonly ProjectDocumentPatch[],
      inverse: readonly ProjectDocumentPatch[],
    ): number =>
      estimateEntryBytes(record) +
      JSON.stringify({
        forward,
        inverse,
        label: request.label,
        origin: request.origin,
        gestureId: request.gestureId,
        fieldId: request.fieldId,
      }).length *
        2;
    const initialForwardPatches =
      historyRecord.kind !== 'values'
        ? compactHistoryRuntimePatches(forwardPatches)
        : forwardPatches;
    const estimatedBytes = entryBytes(historyRecord, initialForwardPatches, computedInverses);

    let candidateMergedRecord: HistoryRecord | null = null;
    let candidateExtraBytes = 0;
    let candidateBytes = estimatedBytes;
    let candidateForwardPatches = initialForwardPatches;
    let candidateInversePatches = computedInverses;
    let adoptGraphIdentitiesFrom: BlueData | undefined;
    let groupingAfterData = transaction.kind === 'structure' ? transaction.candidate : current.data;

    if (canGroup) {
      const top = this.entries[this.cursor - 1]!;
      if (top.record.kind === 'values' && historyRecord.kind === 'values') {
        candidateMergedRecord = {
          kind: 'values',
          records: mergeScalarRecords(top.record.records, historyRecord.records),
        };
      } else if (top.record.kind !== 'values' && historyRecord.kind !== 'values') {
        candidateMergedRecord = {
          kind: top.record.kind === 'bsb' && historyRecord.kind === 'bsb' ? 'bsb' : 'structure',
          delta: mergeProjectGraphDeltas(
            top.record.delta,
            historyRecord.delta,
            transaction.kind === 'structure'
              ? transaction.candidate
              : transaction.kind === 'bsb'
                ? () => bsbGroupingEndpoint(current.data!, transaction.delta)
                : current.data,
          ),
        };
      } else {
        const beforeMem = current.data.historyCopy();
        transferProjectEditorIdentities(current.data, beforeMem);
        if (transaction.kind === 'scalar') rollbackScalarRecords(beforeMem, transaction.records);
        if (top.record.kind !== 'values')
          applyProjectGraphDelta(beforeMem, top.record.delta, 'before');
        if (top.record.kind === 'values') {
          rollbackScalarRecords(beforeMem, top.record.records);
        }
        const afterMem =
          transaction.kind === 'structure'
            ? transaction.candidate.historyCopy()
            : current.data.historyCopy();
        transferProjectEditorIdentities(
          transaction.kind === 'structure' ? transaction.candidate : current.data,
          afterMem,
        );
        if (transaction.kind === 'bsb')
          applyProjectGraphDelta(afterMem, transaction.delta, 'after');
        groupingAfterData = afterMem;
        adoptGraphIdentitiesFrom = afterMem;
        candidateMergedRecord = {
          kind: 'structure',
          delta: captureProjectGraphDelta(beforeMem, afterMem),
        };
      }
      const mergedRecord = candidateMergedRecord!;
      candidateForwardPatches =
        mergedRecord.kind === 'values'
          ? scalarRecordsToForwardPatches(mergedRecord.records)
          : compactHistoryRuntimePatches(
              consolidateForwardPatchesForRedo(
                [...(top.forwardPatches ?? []), ...initialForwardPatches],
                groupingAfterData,
              ),
            );
      candidateInversePatches =
        mergedRecord.kind === 'values'
          ? scalarRecordsToInversePatches(mergedRecord.records)
          : compactHistoryRuntimePatches(
              [
                ...(accumulateConcreteInversePatches(top.inversePatches, computedInverses) ?? [
                  { orchestra: { type: 'structuralChange' } as never },
                ]),
              ],
              'first',
            );
      candidateBytes = entryBytes(mergedRecord, candidateForwardPatches, candidateInversePatches);
      candidateExtraBytes = Math.max(0, candidateBytes - top.retainedBytes);
    } else {
      candidateExtraBytes = estimatedBytes;
    }

    const totalRetainedBytes = this.getRetainedBytesWithCheckpoint(candidateExtraBytes, canGroup);

    // Oversize proposal handling
    if (request.proposalToken) {
      if (
        this.pendingOversizeProposal &&
        this.pendingOversizeProposal.token === request.proposalToken
      ) {
        if (
          this.pendingOversizeProposal.documentId !== current.documentId ||
          this.pendingOversizeProposal.expectedRevision !== request.expectedRevision ||
          this.pendingOversizeProposal.payloadFingerprint !== payloadFingerprint(request.patches)
        ) {
          this.pendingOversizeProposal = null;
          if (transaction.kind === 'scalar') {
            transaction.rollback();
          }
          return {
            status: 'stale',
            operationId: request.operationId,
            documentId: current.documentId,
            currentRevision: current.revision,
            currentStateId: current.stateId ?? '',
            reason:
              'Oversize proposal confirmation is stale (document, revision, or payload changed)',
          };
        }
        // One-use consumption: clear pending token and reset retained history
        this.pendingOversizeProposal = null;
        this.clear();
      } else {
        if (transaction.kind === 'scalar') {
          transaction.rollback();
        }
        return {
          status: 'invalid',
          operationId: request.operationId,
          documentId: current.documentId,
          reason: 'Oversize proposal token is invalid or already consumed',
        };
      }
    } else if (
      candidateBytes > this.retainedBytesLimit ||
      ((isLiveGesture || canGroup) && totalRetainedBytes > this.retainedBytesLimit * 2)
    ) {
      if (transaction.kind === 'scalar') transaction.rollback();
      if (this.activeCheckpoint && matchesActiveGroup(this.activeGroup, request)) {
        await this.commitInternal({
          ...request,
          operationId: `${request.operationId}-rollback`,
          phase: 'cancel',
          patches: [],
        });
      }

      if (request.gestureId) {
        if (this.rejectedGestures.size >= RECEIPT_CACHE_LIMIT) {
          this.rejectedGestures.delete(this.rejectedGestures.values().next().value!);
        }
        this.rejectedGestures.add(gestureKey);
      }
      const token = `oversize-${randomUUID()}`;
      this.pendingOversizeProposal = {
        token,
        documentId: current.documentId,
        expectedRevision: this.session.read().revision,
        payloadFingerprint: payloadFingerprint(request.patches),
      };
      const oversizeEstimated = candidateBytes;
      const resp: ProjectHistoryOversizeResponse = {
        status: 'oversize',
        operationId: request.operationId,
        documentId: current.documentId,
        proposalToken: token,
        estimatedBytes: oversizeEstimated,
        limitBytes: this.retainedBytesLimit,
        explanation: oversizeExplanation(oversizeEstimated, this.retainedBytesLimit),
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (!canGroup && this.activeGroup !== null) {
      this.closeGroup();
    }

    // Capture active rollback checkpoint if beginning live group
    if (isLiveGesture && !canGroup) {
      this.activeCheckpoint = {
        gestureId: request.gestureId,
        fieldId: request.fieldId,
        baseCursor: baselineBaseCursor,
        redoEntries: baselineRedoEntries,
        evictedEntries: [],
        beforeStateId: baselineBeforeStateId,
        wasDirty: baselineWasDirty,
        savedStateId: baselineSavedStateId,
      };
    }

    // Truncate redo stack on new commit (chronological branch semantics)
    if (this.cursor < this.entries.length) {
      this.entries = this.entries.slice(0, this.cursor);
    }

    if (canGroup) {
      // Merge with top entry: keep original before-state, update after-state
      const top = this.entries[this.cursor - 1]!;
      const mergedRecord = candidateMergedRecord!;

      const mergedEntry: HistoryEntry = {
        entryId: top.entryId,
        documentId: current.documentId,
        beforeStateId: top.beforeStateId,
        afterStateId: nextStateId,
        label: request.label || top.label,
        sourceContextId: request.origin?.contextId ?? top.sourceContextId,
        originViewId: request.origin?.viewId ?? top.originViewId,
        originSelectionHints: request.origin?.selection ?? top.originSelectionHints,
        gestureId: request.gestureId ?? top.gestureId,
        fieldId: request.fieldId ?? top.fieldId,
        timestamp: now,
        retainedBytes: candidateBytes,
        record: mergedRecord,
        changedTargets: [
          ...new Set([
            ...(top.changedTargets ?? []),
            ...collectChangedTargets(request.patches ?? []),
          ]),
        ],
        forwardPatches: candidateForwardPatches,
        inversePatches: candidateInversePatches,
      };

      this.entries[this.cursor - 1] = mergedEntry;
      this.activeGroup = {
        gestureId: request.gestureId,
        fieldId: request.fieldId,
        sourceContextId: request.origin?.contextId,
        lastTimestamp: now,
      };
    } else {
      // New history entry
      const newEntry: HistoryEntry = {
        entryId: `entry-${randomUUID()}`,
        documentId: current.documentId,
        beforeStateId,
        afterStateId: nextStateId,
        label: request.label,
        sourceContextId: request.origin?.contextId,
        originViewId: request.origin?.viewId,
        originSelectionHints: request.origin?.selection,
        gestureId: request.gestureId,
        fieldId: request.fieldId,
        timestamp: now,
        retainedBytes: estimatedBytes,
        record: historyRecord,
        changedTargets: collectChangedTargets(request.patches ?? []),
        forwardPatches: initialForwardPatches,
        inversePatches: computedInverses,
      };

      this.entries.push(newEntry);
      this.cursor = this.entries.length;

      if (this.activeCheckpoint) {
        this.activeCheckpoint.activeEntryId = newEntry.entryId;
      }

      while (this.entries.length > this.retainedEntryLimit) {
        const evicted = this.entries.shift()!;
        if (this.activeCheckpoint) {
          this.activeCheckpoint.evictedEntries.push(evicted);
        }
        this.cursor = Math.max(0, this.cursor - 1);
      }

      if (request.phase === 'begin' || request.phase === 'update') {
        this.activeGroup = {
          gestureId: request.gestureId,
          fieldId: request.fieldId,
          sourceContextId: request.origin?.contextId,
          lastTimestamp: now,
        };
      } else {
        this.activeGroup = null;
      }
    }

    // Apply change to ProjectSession
    if (transaction.kind === 'structure') {
      applyProjectGraphDelta(current.data, transaction.delta, 'after');
      this.session.recordMutation({ changed: true, stateId: nextStateId });
    } else {
      if (transaction.kind === 'bsb') transaction.apply();
      this.session.recordMutation({
        changed: true,
        stateId: nextStateId,
      });
    }

    if (adoptGraphIdentitiesFrom)
      transferProjectEditorIdentities(adoptGraphIdentitiesFrom, this.session.read().data!);

    if (request.phase === 'end') {
      const isMatchingGroup = matchesActiveGroup(this.activeGroup, request);

      if (isMatchingGroup && this.activeCheckpoint) {
        if (isNetZeroRecord(this.entries[this.cursor - 1]?.record)) {
          return await this.finalizeNetZero(
            request,
            current.documentId,
            this.activeGroup?.gestureId,
          );
        }
      }
      this.closeGroup();
    }

    this.enforceLimits();

    const updatedSnap = this.session.read();
    const projection = this.read();
    const publishedIsDirty = this.isDirty();
    const publishedSnapshot = this.capturePublishedSnapshot();

    const reconciliationPromise = this.reconciliation
      ? this.reconciliation.reconcileCommit({
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          patches: request.patches ?? [],
        })
      : undefined;

    const updatedEvent: ProjectDocumentUpdatedEvent = {
      documentId: updatedSnap.documentId!,
      sessionId: updatedSnap.sessionId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: publishedIsDirty,
      history: projection,
      acceptedOperationIds: [request.operationId],
      sourceSequence: request.contextSequence,
      snapshot: publishedSnapshot,
      selectionHints: request.origin?.selection ? [...request.origin.selection] : undefined,
      originViewId: request.origin?.viewId,
      originContextId: request.origin?.contextId,
    };
    await this.publishUpdated?.(updatedEvent);
    const runtimeOutcomes = reconciliationPromise ? await reconciliationPromise : undefined;

    const resp: ProjectHistoryCommittedResponse = {
      status: 'committed',
      operationId: request.operationId,
      documentId: updatedSnap.documentId!,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: publishedIsDirty,
      history: projection,
      changedTargets: [...(this.entries[this.cursor - 1]?.changedTargets ?? [])],
      runtimeOutcomes,
      receipt: {
        revision: updatedSnap.revision,
        sessionId: updatedSnap.sessionId,
        changed: true,
        patchChanged: transaction.patchChanged
          ? [...transaction.patchChanged]
          : (request.patches?.map(() => true) ?? []),
        patchAccepted: transaction.patchAccepted
          ? [...transaction.patchAccepted]
          : (request.patches?.map(() => true) ?? []),
        documentId: updatedSnap.documentId!,
        stateId: updatedSnap.stateId!,
      },
    };
    this.cacheReceipt(request.operationId, resp);
    return resp;
  }

  /**
   * Publishes a structure prepared outside the history coordinator only when
   * its document/session/revision fence is still current. This keeps delayed
   * filesystem or Java work from absorbing edits made while it was running.
   */
  async commitPreparedStructuralMutation(options: {
    label: string;
    candidate: BlueData;
    expectedDocumentId: string;
    expectedSessionId: number;
    expectedRevision: number;
    proposalToken?: string;
    origin?: ProjectHistoryOrigin;
  }): Promise<ProjectDocumentCommitReceipt> {
    return this.enqueueOrderedMutation(async () => {
      const current = this.session.read();
      if (
        !current.data ||
        !current.documentId ||
        current.documentId !== options.expectedDocumentId ||
        current.sessionId !== options.expectedSessionId ||
        current.revision !== options.expectedRevision
      ) {
        return this.createDirectReceipt(current, false, current.stateId ?? '', {
          error: 'Prepared structural mutation is stale and was discarded',
        });
      }

      return this.commitDirectMutationInternal({
        label: options.label,
        preparedCandidate: options.candidate,
        expectedRevision: options.expectedRevision,
        proposalToken: options.proposalToken,
        origin: options.origin,
        mutator: () => true,
      });
    });
  }

  async commitDirectMutation(options: {
    label: string;
    mutator: (candidate: BlueData) => boolean;
    preparedCandidate?: BlueData;
    expectedRevision?: number;
    proposalToken?: string;
    origin?: ProjectHistoryOrigin;
  }): Promise<ProjectDocumentCommitReceipt> {
    return this.enqueueOrderedMutation(() => this.commitDirectMutationInternal(options));
  }

  private async commitDirectMutationInternal(options: {
    label: string;
    mutator: (candidate: BlueData) => boolean;
    preparedCandidate?: BlueData;
    expectedRevision?: number;
    proposalToken?: string;
    origin?: ProjectHistoryOrigin;
  }): Promise<ProjectDocumentCommitReceipt> {
    await this.waitForBarrierToRelease();
    this.closeGroup();
    const current = this.session.read();
    if (!current.data || !current.documentId) {
      throw new Error('No active project session');
    }

    if (options.expectedRevision !== undefined && options.expectedRevision !== current.revision) {
      return this.createDirectReceipt(current, false, current.stateId ?? '', {
        error: `Revision mismatch (expected ${options.expectedRevision}, current ${current.revision})`,
      });
    }

    const beforeStateId = current.stateId ?? `state-${randomUUID()}`;
    const nextStateId = `state-${randomUUID()}`;

    const candidate = options.preparedCandidate ?? current.data.historyCopy();
    if (!options.preparedCandidate) {
      transferProjectEditorIdentities(current.data, candidate);
    }

    const beforeMemento = current.data.historyCopy();
    transferProjectEditorIdentities(current.data, beforeMemento);

    const changed = options.preparedCandidate ? true : options.mutator(candidate);
    if (!changed) {
      return {
        revision: current.revision,
        sessionId: current.sessionId,
        changed: false,
        documentId: current.documentId,
        stateId: current.stateId ?? '',
      };
    }

    const payloadFingerprint = ProjectHistory.directMutationFingerprint(
      options.label,
      beforeMemento,
      candidate,
    );

    const historyRecord: HistoryRecord = {
      kind: 'structure',
      delta: captureProjectGraphDelta(beforeMemento, candidate),
    };
    const estimatedBytes =
      estimateEntryBytes(historyRecord) +
      JSON.stringify({ label: options.label, origin: options.origin }).length * 2 +
      256;
    const expectedRevision = current.revision;

    if (options.proposalToken) {
      const proposal = this.pendingDirectOversizeProposal;
      if (
        !proposal ||
        proposal.token !== options.proposalToken ||
        proposal.documentId !== current.documentId ||
        proposal.expectedRevision !== expectedRevision ||
        proposal.payloadFingerprint !== payloadFingerprint
      ) {
        return this.createDirectReceipt(current, false, current.stateId ?? '', {
          error: 'Oversize proposal token is invalid, stale, or already consumed',
        });
      }
      this.pendingDirectOversizeProposal = null;
      // The confirmation is a one-use branch reset. It is safe to discard all
      // retained history because the proposal explicitly exceeded the limit.
      this.clear();
    } else if (estimatedBytes > this.retainedBytesLimit) {
      const token = `oversize-${randomUUID()}`;
      this.pendingDirectOversizeProposal = {
        token,
        documentId: current.documentId,
        expectedRevision,
        payloadFingerprint,
        label: options.label,
        origin: options.origin,
      };
      return this.createDirectReceipt(current, false, current.stateId ?? '', {
        oversizeProposal: {
          token,
          estimatedBytes,
          limitBytes: this.retainedBytesLimit,
          explanation: oversizeExplanation(estimatedBytes, this.retainedBytesLimit),
        },
      });
    }

    // Truncate redo stack on new commit (chronological branch semantics)
    if (this.cursor < this.entries.length) {
      this.entries.splice(this.cursor);
    }

    const entry: HistoryEntry = {
      entryId: `entry-${randomUUID()}`,
      documentId: current.documentId,
      beforeStateId,
      afterStateId: nextStateId,
      label: options.label,
      sourceContextId: options.origin?.contextId,
      originViewId: options.origin?.viewId,
      originSelectionHints: options.origin?.selection,
      timestamp: Date.now(),
      retainedBytes: estimatedBytes,
      record: historyRecord,
      forwardPatches: [{ orchestra: { type: 'structuralChange' } as never }],
      inversePatches: [{ orchestra: { type: 'structuralChange' } as never }],
    };

    this.entries.push(entry);
    this.cursor = this.entries.length;
    this.activeGroup = null;

    applyProjectGraphDelta(current.data, historyRecord.delta, 'after');
    this.session.recordMutation({ changed: true, stateId: nextStateId });
    this.enforceLimits();

    const updatedSnap = this.session.read();
    const projection = this.read();
    const publishedIsDirty = this.isDirty();
    const publishedSnapshot = this.capturePublishedSnapshot();

    const reconciliationPromise = this.reconciliation
      ? this.reconciliation.reconcileCommit({
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          patches: [{ orchestra: { type: 'structuralChange' } as never }],
        })
      : undefined;

    const updatedEvent: ProjectDocumentUpdatedEvent = {
      documentId: updatedSnap.documentId!,
      sessionId: updatedSnap.sessionId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: publishedIsDirty,
      history: projection,
      acceptedOperationIds: [],
      snapshot: publishedSnapshot,
      selectionHints: options.origin?.selection,
      originViewId: options.origin?.viewId,
      originContextId: options.origin?.contextId,
    };
    await this.publishUpdated?.(updatedEvent);
    const runtimeOutcomes = reconciliationPromise ? await reconciliationPromise : undefined;

    return {
      revision: updatedSnap.revision,
      sessionId: updatedSnap.sessionId,
      changed: true,
      documentId: updatedSnap.documentId!,
      stateId: updatedSnap.stateId!,
    };
  }

  undo(request: ProjectHistoryUndoRequest): Promise<ProjectHistoryResponse> {
    return this.runIdempotentOperation(
      'undo',
      request.operationId,
      request.documentId,
      JSON.stringify(request),
      () => this.enqueueOrderedMutation(() => this.undoInternal(request)),
    );
  }

  private async undoInternal(request: ProjectHistoryUndoRequest): Promise<ProjectHistoryResponse> {
    const initial = this.session.read();
    if (!initial.data || !initial.documentId) {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: request.documentId,
        reason: 'No active project document in session',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (request.documentId !== initial.documentId) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: initial.revision,
        currentStateId: initial.stateId ?? '',
        reason: `Document ID mismatch (expected ${request.documentId}, current ${initial.documentId})`,
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    const expectedRevisionBeforeBarrier = initial.revision;
    this.recordBoundaryCommandSequence(request);

    try {
      return await this.runSettlementBarrier('undo', async () => {
        return this.executeUndo(request, expectedRevisionBeforeBarrier);
      });
    } catch (err) {
      const current = this.session.read();
      const resp: ProjectHistoryFailedResponse = {
        status: 'failed',
        operationId: request.operationId,
        documentId: current.documentId ?? request.documentId,
        error: err instanceof Error ? err.message : String(err),
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }
  }

  private async executeUndo(
    request: ProjectHistoryUndoRequest,
    expectedRevisionBeforeBarrier: number,
  ): Promise<ProjectHistoryResponse> {
    const current = this.session.read();

    if (!current.data || !current.documentId) {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: request.documentId,
        reason: 'No active project document',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (request.documentId !== current.documentId) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: 'Document ID mismatch',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (
      current.revision === expectedRevisionBeforeBarrier &&
      request.expectedRevision !== current.revision
    ) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: 'Revision mismatch',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (this.cursor <= 0) {
      const resp: ProjectHistoryUnchangedResponse = {
        status: 'unchanged',
        operationId: request.operationId,
        documentId: current.documentId,
        revision: current.revision,
        stateId: current.stateId ?? '',
        isDirty: this.isDirty(),
        history: this.read(),
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    // Target entry is at cursor - 1
    const entry = this.entries[this.cursor - 1]!;

    if (this.reconciliation && entry.gestureId) {
      await this.reconciliation.drainPreviews(entry.gestureId);
    }

    restoreHistoryRecord(this.session, entry.record, 'before', entry.beforeStateId);
    this.cursor--;

    const updatedSnap = this.session.read();
    const projection = this.read();
    const publishedIsDirty = this.isDirty();
    const publishedSnapshot = this.capturePublishedSnapshot();

    const inversePatches =
      entry.inversePatches ??
      (entry.record.kind === 'values'
        ? scalarRecordsToInversePatches(entry.record.records)
        : [{ orchestra: { type: 'structuralChange' } as never }]);

    const reconciliationPromise = this.reconciliation
      ? this.reconciliation.reconcileCommit({
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          patches: inversePatches,
        })
      : undefined;

    const updatedEvent: ProjectDocumentUpdatedEvent = {
      documentId: updatedSnap.documentId!,
      sessionId: updatedSnap.sessionId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: publishedIsDirty,
      history: projection,
      acceptedOperationIds: [request.operationId],
      sourceSequence: request.contextSequence,
      snapshot: publishedSnapshot,
      selectionHints: request.origin?.selection
        ? [...request.origin.selection]
        : entry.originSelectionHints
          ? [...entry.originSelectionHints]
          : undefined,
      originViewId: request.origin?.viewId ?? entry.originViewId,
      originContextId: request.origin?.contextId ?? entry.sourceContextId,
    };
    await this.publishUpdated?.(updatedEvent);
    const runtimeOutcomes = reconciliationPromise ? await reconciliationPromise : undefined;

    const resp: ProjectHistoryCommittedResponse = {
      status: 'committed',
      operationId: request.operationId,
      documentId: updatedSnap.documentId!,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: publishedIsDirty,
      history: projection,
      changedTargets: [...(entry.changedTargets ?? [])],
      runtimeOutcomes,
    };
    this.cacheReceipt(request.operationId, resp);
    return resp;
  }

  redo(request: ProjectHistoryRedoRequest): Promise<ProjectHistoryResponse> {
    return this.runIdempotentOperation(
      'redo',
      request.operationId,
      request.documentId,
      JSON.stringify(request),
      () => this.enqueueOrderedMutation(() => this.redoInternal(request)),
    );
  }

  private async redoInternal(request: ProjectHistoryRedoRequest): Promise<ProjectHistoryResponse> {
    const initial = this.session.read();
    if (!initial.data || !initial.documentId) {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: request.documentId,
        reason: 'No active project document in session',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (request.documentId !== initial.documentId) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: initial.revision,
        currentStateId: initial.stateId ?? '',
        reason: `Document ID mismatch (expected ${request.documentId}, current ${initial.documentId})`,
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    const expectedRevisionBeforeBarrier = initial.revision;
    this.recordBoundaryCommandSequence(request);

    try {
      return await this.runSettlementBarrier('redo', async () => {
        return this.executeRedo(request, expectedRevisionBeforeBarrier);
      });
    } catch (err) {
      const current = this.session.read();
      const resp: ProjectHistoryFailedResponse = {
        status: 'failed',
        operationId: request.operationId,
        documentId: current.documentId ?? request.documentId,
        error: err instanceof Error ? err.message : String(err),
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }
  }

  private async executeRedo(
    request: ProjectHistoryRedoRequest,
    expectedRevisionBeforeBarrier: number,
  ): Promise<ProjectHistoryResponse> {
    const current = this.session.read();

    if (!current.data || !current.documentId) {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: request.documentId,
        reason: 'No active project document',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (request.documentId !== current.documentId) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: 'Document ID mismatch',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (
      current.revision === expectedRevisionBeforeBarrier &&
      request.expectedRevision !== current.revision
    ) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: 'Revision mismatch',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (this.cursor >= this.entries.length) {
      const resp: ProjectHistoryUnchangedResponse = {
        status: 'unchanged',
        operationId: request.operationId,
        documentId: current.documentId,
        revision: current.revision,
        stateId: current.stateId ?? '',
        isDirty: this.isDirty(),
        history: this.read(),
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    // Target entry is at cursor
    const entry = this.entries[this.cursor]!;

    if (this.reconciliation && entry.gestureId) {
      await this.reconciliation.drainPreviews(entry.gestureId);
    }

    restoreHistoryRecord(this.session, entry.record, 'after', entry.afterStateId);
    this.cursor++;

    const updatedSnap = this.session.read();
    const projection = this.read();
    const publishedIsDirty = this.isDirty();
    const publishedSnapshot = this.capturePublishedSnapshot();

    let forwardPatches = entry.forwardPatches;
    if (!forwardPatches) {
      forwardPatches =
        entry.record.kind === 'values'
          ? scalarRecordsToForwardPatches(entry.record.records)
          : [{ orchestra: { type: 'structuralChange' } as never }];
    } else if (entry.record.kind === 'structure') {
      forwardPatches = consolidateForwardPatchesForRedo(forwardPatches, updatedSnap.data!);
    }

    const reconciliationPromise = this.reconciliation
      ? this.reconciliation.reconcileCommit({
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          patches: forwardPatches,
        })
      : undefined;

    const updatedEvent: ProjectDocumentUpdatedEvent = {
      documentId: updatedSnap.documentId!,
      sessionId: updatedSnap.sessionId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: publishedIsDirty,
      history: projection,
      acceptedOperationIds: [request.operationId],
      sourceSequence: request.contextSequence,
      snapshot: publishedSnapshot,
      selectionHints: request.origin?.selection
        ? [...request.origin.selection]
        : entry.originSelectionHints
          ? [...entry.originSelectionHints]
          : undefined,
      originViewId: request.origin?.viewId ?? entry.originViewId,
      originContextId: request.origin?.contextId ?? entry.sourceContextId,
    };
    await this.publishUpdated?.(updatedEvent);
    const runtimeOutcomes = reconciliationPromise ? await reconciliationPromise : undefined;

    const resp: ProjectHistoryCommittedResponse = {
      status: 'committed',
      operationId: request.operationId,
      documentId: updatedSnap.documentId!,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: publishedIsDirty,
      history: projection,
      changedTargets: [...(entry.changedTargets ?? [])],
      runtimeOutcomes,
    };
    this.cacheReceipt(request.operationId, resp);
    return resp;
  }
}

export function createProjectHistory(dependencies: ProjectHistoryDependencies): ProjectHistory {
  return new ProjectHistory(dependencies);
}
