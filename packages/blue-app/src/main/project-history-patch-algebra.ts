import { createHash } from 'node:crypto';
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
  BsbInterfacePatch,
  EffectEditablePatch,
  InstrumentPatch,
  MixerChainKind,
  ProjectDocumentPatch,
} from '../shared/project-editor/contract';
import {
  changesBsbAutomationCatalog,
  changesScoreTimeContext,
} from '../shared/project-editor/patch-score-dependencies';
import {
  getKnownMixerChannelSnapshotId,
  getMixerEntrySnapshotId,
} from '../shared/project-editor/identity';
import { collectAffectedScoreAutomationParameterIds } from './score-automation-runtime-sync';
import {
  applyTextChange,
  createTextChange,
  estimateProjectGraphDeltaBytes,
  estimateTextChangeBytes,
  isNetZeroProjectGraphDelta,
  type ProjectGraphDelta,
} from './project-history-graph';
import type { ScalarFieldRecord } from './project-history-memento';

/**
 * Derives stable changed-target hints from committed patches so replies and
 * publications identify which canonical owners a transition touched. IDs are
 * the stable canonical identities already carried by the patch members.
 */
export function collectChangedTargets(patches: readonly ProjectDocumentPatch[]): string[] {
  const targets = new Set<string>();
  for (const patch of patches) {
    if (patch.globalOrc !== undefined) targets.add('text:globalOrc');
    if (patch.globalSco !== undefined) targets.add('text:globalSco');
    if (patch.tablesText !== undefined) targets.add('text:tablesText');
    if (patch.scratchPad !== undefined) targets.add('text:scratchPad');
    if (patch.clojureProject !== undefined) targets.add('clojureProject');
    if (patch.projectProperties !== undefined) targets.add('property:projectProperties');
    if (patch.transport !== undefined) {
      if (changesScoreTimeContext(patch.transport)) {
        targets.add('transport:timeContext');
      } else {
        targets.add('transport');
      }
    }
    if (patch.projectUdo !== undefined) targets.add('udo');
    if (patch.midiInput !== undefined) targets.add('midiInput');
    if (patch.blueLive !== undefined) targets.add('blueLive');
    if (patch.mixer !== undefined) {
      const m = patch.mixer;
      if (m.type === 'updateChannel') {
        targets.add(`mixerChannel:${m.channelId}`);
        if (m.patch.name !== undefined) {
          targets.add(`mixerChannelRename:${m.channelId}`);
          targets.add('score');
        }
      } else if (m.type === 'renameChannelListGroup') {
        targets.add('mixer');
        targets.add('score');
      } else if (m.type === 'updateSend') {
        targets.add(`mixerChannel:${m.channelId}`);
      } else if (
        m.type === 'setMixerEnabled' ||
        m.type === 'setMeterEnabled' ||
        m.type === 'setMeterProfile' ||
        m.type === 'updateMixerPanning' ||
        m.type === 'updateMixerPanLaw' ||
        m.type === 'updateMixerPanBoost' ||
        m.type === 'updateExtraRenderTime'
      ) {
        targets.add('mixerChannel:mixer');
      } else if (
        m.type === 'updateEffect' ||
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
      if (o.type === 'updateInstrumentComment' && 'assignmentId' in o) {
        targets.add(`instrument:${o.assignmentId}`);
      } else if (o.type === 'updateInstrument') {
        if (
          o.patch.name !== undefined ||
          o.patch.enabled !== undefined ||
          changesBsbAutomationCatalog(o.patch.bsbInterface)
        ) {
          targets.add('orchestra');
        } else {
          targets.add(`instrument:${o.assignmentId}`);
        }
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
  | {
      readonly kind: 'values';
      readonly records: readonly ScalarFieldRecord[];
      readonly rootFields: readonly PropertyKey[];
    }
  | { readonly kind: 'bsb'; readonly delta: ProjectGraphDelta }
  | {
      readonly kind: 'structure';
      readonly delta: ProjectGraphDelta;
    };

export function consolidateForwardPatchesForRedo(
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

export function scalarRecordsToInversePatches(
  records: readonly ScalarFieldRecord[],
): ProjectDocumentPatch[] {
  const patches: ProjectDocumentPatch[] = [];
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i]!;
    switch (rec.targetType) {
      case 'text':
        if (rec.targetId === 'globalOrc') {
          patches.push({ globalOrc: rec.textDelta ? '' : String(rec.beforeValue ?? '') });
        } else if (rec.targetId === 'globalSco') {
          patches.push({ globalSco: rec.textDelta ? '' : String(rec.beforeValue ?? '') });
        } else if (rec.targetId === 'tablesText') {
          patches.push({ tablesText: rec.textDelta ? '' : String(rec.beforeValue ?? '') });
        } else if (rec.targetId === 'scratchPad' && !rec.textDelta) {
          patches.push({
            scratchPad: { [rec.field]: rec.beforeValue } as NonNullable<
              ProjectDocumentPatch['scratchPad']
            >,
          });
        }
        break;
      case 'property':
        if (!rec.textDelta) {
          patches.push({
            projectProperties: { [rec.field]: rec.beforeValue } as NonNullable<
              ProjectDocumentPatch['projectProperties']
            >,
          });
        }
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
          patches.push({ globalOrc: rec.textDelta ? '' : String(rec.afterValue ?? '') });
        } else if (rec.targetId === 'globalSco') {
          patches.push({ globalSco: rec.textDelta ? '' : String(rec.afterValue ?? '') });
        } else if (rec.targetId === 'tablesText') {
          patches.push({ tablesText: rec.textDelta ? '' : String(rec.afterValue ?? '') });
        } else if (rec.targetId === 'scratchPad' && !rec.textDelta) {
          patches.push({
            scratchPad: { [rec.field]: rec.afterValue } as NonNullable<
              ProjectDocumentPatch['scratchPad']
            >,
          });
        }
        break;
      case 'property':
        if (!rec.textDelta) {
          patches.push({
            projectProperties: { [rec.field]: rec.afterValue } as NonNullable<
              ProjectDocumentPatch['projectProperties']
            >,
          });
        }
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
  if (!patches) return false;
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
  if (priorInverses === undefined) {
    return newInverses && hasConcreteInversePatches(newInverses) ? newInverses : null;
  }
  if (!hasConcreteInversePatches(priorInverses)) {
    return null;
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

export function invertEditableInstrumentPatches(
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

export function invertEditableEffectPatches(
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

export function payloadFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function compressScalarTextRecord(record: ScalarFieldRecord): ScalarFieldRecord {
  if (
    !record.textDelta &&
    typeof record.beforeValue === 'string' &&
    typeof record.afterValue === 'string'
  ) {
    const textDelta = createTextChange(record.beforeValue, record.afterValue);
    if (textDelta) {
      return {
        targetType: record.targetType,
        targetId: record.targetId,
        field: record.field,
        beforeValue: undefined,
        afterValue: undefined,
        textDelta,
      };
    }
  }
  return record;
}

export function compressScalarTextRecords(
  records: readonly ScalarFieldRecord[],
): ScalarFieldRecord[] {
  return records.map(compressScalarTextRecord);
}

export function isLargeScalarTextRecord(record: ScalarFieldRecord): boolean {
  return (
    record.textDelta !== undefined ||
    (typeof record.beforeValue === 'string' &&
      typeof record.afterValue === 'string' &&
      record.beforeValue.length + record.afterValue.length > 1024)
  );
}

export function mergeScalarRecords(
  prior: readonly ScalarFieldRecord[],
  next: readonly ScalarFieldRecord[],
): ScalarFieldRecord[] {
  const records = new Map(
    prior.map((r) => [JSON.stringify([r.targetType, r.targetId, r.field]), r]),
  );
  for (const r of next) {
    const key = JSON.stringify([r.targetType, r.targetId, r.field]);
    const previous = records.get(key);
    if (!previous) {
      records.set(key, compressScalarTextRecord(r));
      continue;
    }
    const beforeValue =
      previous.textDelta && typeof r.beforeValue === 'string'
        ? applyTextChange(r.beforeValue, previous.textDelta, 'before')
        : previous.beforeValue;
    records.set(key, compressScalarTextRecord({ ...r, beforeValue }));
  }
  return [...records.values()];
}

export function isNetZeroRecord(record: HistoryRecord | undefined): boolean {
  if (!record) return false;
  if (record.kind !== 'values') return isNetZeroProjectGraphDelta(record.delta);
  return record.records.every((r) =>
    r.textDelta
      ? r.textDelta.edits.length === 0 && r.textDelta.beforeHash === r.textDelta.afterHash
      : r.beforeValue === r.afterValue,
  );
}

export function estimateEntryBytes(record: HistoryRecord): number {
  const baseOverhead = 256;
  if (record.kind === 'values') {
    let bytes = baseOverhead;
    for (const r of record.records) {
      bytes += 64;
      bytes += (r.targetId.length + r.field.length) * 2;
      if (typeof r.beforeValue === 'string') bytes += r.beforeValue.length * 2;
      if (typeof r.afterValue === 'string') bytes += r.afterValue.length * 2;
      if (r.textDelta) bytes += estimateTextChangeBytes(r.textDelta);
    }
    return bytes;
  } else return estimateProjectGraphDeltaBytes(record.delta);
}
