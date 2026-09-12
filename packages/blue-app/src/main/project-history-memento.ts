import {
  BlueData,
  Channel,
  Effect,
  OpcodeDefinition,
  Parameter,
  Send,
  TrackLayerGroup,
  type MeterProfileKey,
} from '@blue/data';
import type {
  ProjectDocumentPatch,
  ProjectDocumentPatchContext,
} from '../shared/project-editor/contract';
import {
  applyProjectDocumentPatch,
  classifyProjectDocumentPatch,
  findMixerChannelById,
  isEmptyProjectDocumentPatch,
  validateProjectDocumentPatch,
} from '../shared/project-editor';
import {
  getBsbWidgetSnapshotId,
  getKnownMixerChannelSnapshotId,
  getKnownMixerEntrySnapshotId,
  getParameterSnapshotId,
  getScoreObjectId,
  getLayerSelectionId,
  getLayerGroupId,
  transferProjectEditorIdentities,
} from '../shared/project-editor/identity';
import type {
  ProjectHistoryPrecondition,
  ProjectHistoryTargetType,
} from '../shared/project-history';
import type { ProjectSession, ProjectSessionSnapshot } from './project-session';

export interface ScalarFieldRecord {
  targetType: ProjectHistoryTargetType;
  targetId: string;
  field: string;
  beforeValue: unknown;
  afterValue: unknown;
}

export interface PreparedEmptyTransaction {
  readonly kind: 'empty';
  readonly changed: false;
  readonly patchChanged?: readonly boolean[];
  readonly patchAccepted?: readonly boolean[];
}

export interface PreparedScalarTransaction {
  readonly kind: 'scalar';
  readonly records: readonly ScalarFieldRecord[];
  readonly changed: boolean;
  readonly rollback: () => void;
  readonly apply: () => boolean;
  readonly patchChanged?: readonly boolean[];
  readonly patchAccepted?: readonly boolean[];
}

export interface PreparedStructuralTransaction {
  readonly kind: 'structure';
  readonly candidate: BlueData;
  readonly beforeMemento: BlueData;
  readonly afterMemento: BlueData;
  readonly changed: boolean;
  readonly patchChanged?: readonly boolean[];
  readonly patchAccepted?: readonly boolean[];
}

export type PreparedTransaction =
  | PreparedEmptyTransaction
  | PreparedScalarTransaction
  | PreparedStructuralTransaction;

export interface PreconditionValidationResult {
  valid: boolean;
  reason?: string;
}

export interface PrepareTransactionOptions {
  preconditions?: readonly ProjectHistoryPrecondition[];
  context?: ProjectDocumentPatchContext;
  forceStructural?: boolean;
}

export type PrepareTransactionResult =
  | { status: 'prepared'; transaction: PreparedTransaction }
  | { status: 'stale'; reason: string }
  | { status: 'invalid'; reason: string };

interface ResolvedTarget {
  found: boolean;
  value?: unknown;
  identity?: string;
  target?: unknown;
}

export function resolveTargetValue(
  data: BlueData,
  targetType: ProjectHistoryTargetType,
  targetId: string,
  field?: string,
): ResolvedTarget {
  switch (targetType) {
    case 'property': {
      const props = data.getProjectProperties();
      const val = field ? (props as unknown as Record<string, unknown>)[field] : props;
      return { found: true, value: val, target: props };
    }

    case 'text': {
      if (targetId === 'globalOrc') {
        return { found: true, value: data.getGlobalOrcSco().getGlobalOrc() };
      }
      if (targetId === 'globalSco') {
        return { found: true, value: data.getGlobalOrcSco().getGlobalSco() };
      }
      if (targetId === 'tablesText') {
        return { found: true, value: data.getTableSet().getTables() };
      }
      if (targetId === 'scratchPad') {
        return { found: true, value: data.getScratchPadData().getScratchText() };
      }
      return { found: false };
    }

    case 'transport': {
      if (field === 'renderStartTime') {
        return { found: true, value: data.getRenderStartTime() };
      }
      if (field === 'renderEndTime') {
        return { found: true, value: data.getRenderEndTime() };
      }
      if (field === 'loopRendering') {
        return { found: true, value: data.isLoopRendering() };
      }
      return { found: true };
    }

    case 'mixerChannel': {
      const mixer = data.getMixer();
      let foundChan: Channel | null = null;
      if (targetId === 'master' || targetId === mixer.getMaster().getName()) {
        foundChan = mixer.getMaster();
      } else {
        foundChan = findMixerChannelById(mixer, targetId);
        if (!foundChan) {
          foundChan =
            [...mixer.getChannels(), ...mixer.getSubChannels()].find(
              (c) => c.getName() === targetId,
            ) ?? null;
        }
      }
      if (!foundChan) {
        return { found: false };
      }
      const identity = getKnownMixerChannelSnapshotId(foundChan) ?? foundChan.getName();
      let value: unknown = foundChan;
      if (field === 'level') value = foundChan.getLevel();
      else if (field === 'pan') value = foundChan.getPan();
      else if (field === 'muted' || field === 'mute') value = foundChan.isMuted();
      else if (field === 'solo') value = foundChan.isSolo();
      return { found: true, value, identity, target: foundChan };
    }

    case 'parameter': {
      // Find parameter in mixer or arrangement
      const mixer = data.getMixer();
      for (const ch of [mixer.getMaster(), ...mixer.getChannels(), ...mixer.getSubChannels()]) {
        if (ch.getLevelParameter().getName() === targetId) {
          const p = ch.getLevelParameter();
          return {
            found: true,
            value: p.getFixedValue(),
            identity: getParameterSnapshotId(p) ?? p.getUniqueId(),
            target: p,
          };
        }
        for (const entry of ch.getEffectsChain()) {
          if (entry instanceof Effect) {
            for (const p of entry.getParameters()) {
              if (p.getName() === targetId || getParameterSnapshotId(p) === targetId) {
                return {
                  found: true,
                  value: p.getFixedValue(),
                  identity: getParameterSnapshotId(p) ?? p.getUniqueId(),
                  target: p,
                };
              }
            }
          } else if (entry instanceof Send) {
            const p = entry.getParameter();
            if (p.getName() === targetId || getParameterSnapshotId(p) === targetId) {
              return {
                found: true,
                value: p.getFixedValue(),
                identity: getParameterSnapshotId(p) ?? p.getUniqueId(),
                target: p,
              };
            }
          }
        }
      }
      return { found: false };
    }

    case 'scoreObject': {
      const score = data.getScore();
      for (const lg of score) {
        if (lg instanceof TrackLayerGroup) {
          for (const track of lg) {
            for (const obj of track) {
              if (getScoreObjectId(obj) === targetId) {
                return {
                  found: true,
                  value: obj,
                  identity: getScoreObjectId(obj),
                  target: obj,
                };
              }
            }
          }
        }
      }
      return { found: false };
    }

    case 'layer': {
      const score = data.getScore();
      for (const lg of score) {
        if (getLayerGroupId(lg) === targetId) {
          return { found: true, value: lg, identity: getLayerGroupId(lg), target: lg };
        }
        if (lg instanceof TrackLayerGroup) {
          for (const track of lg) {
            if (getLayerSelectionId(track) === targetId) {
              return {
                found: true,
                value: track,
                identity: getLayerSelectionId(track),
                target: track,
              };
            }
          }
        }
      }
      return { found: false };
    }

    case 'udo': {
      const opcodes = data.getOpcodeList();
      for (let i = 0; i < opcodes.size(); i++) {
        const udo = opcodes.getOpcode(i);
        if (udo && (udo.getName() === targetId || String(i) === targetId)) {
          return {
            found: true,
            value: udo.getCode(),
            identity: udo.getName(),
            target: udo,
          };
        }
      }
      return { found: false };
    }

    default:
      return { found: true };
  }
}

export function validatePreconditions(
  data: BlueData,
  preconditions?: readonly ProjectHistoryPrecondition[],
): PreconditionValidationResult {
  if (!preconditions || preconditions.length === 0) {
    return { valid: true };
  }

  for (const p of preconditions) {
    const resolved = resolveTargetValue(data, p.targetType, p.targetId, p.field);
    if (!resolved.found) {
      return {
        valid: false,
        reason: `Target ${p.targetType}:${p.targetId} not found for precondition`,
      };
    }

    if (p.expectedValue !== undefined && resolved.value !== p.expectedValue) {
      return {
        valid: false,
        reason: `Precondition value mismatch for ${p.targetType}:${p.targetId}.${p.field ?? 'value'}: expected ${JSON.stringify(p.expectedValue)}, found ${JSON.stringify(resolved.value)}`,
      };
    }

    if (p.expectedIdentity !== undefined && resolved.identity !== p.expectedIdentity) {
      return {
        valid: false,
        reason: `Precondition identity mismatch for ${p.targetType}:${p.targetId}: expected ${p.expectedIdentity}, found ${resolved.identity}`,
      };
    }
  }

  return { valid: true };
}

export function captureScalarFieldRecords(
  data: BlueData,
  patch: ProjectDocumentPatch,
): ScalarFieldRecord[] {
  const records: ScalarFieldRecord[] = [];

  if (patch.globalOrc !== undefined) {
    records.push({
      targetType: 'text',
      targetId: 'globalOrc',
      field: 'text',
      beforeValue: data.getGlobalOrcSco().getGlobalOrc(),
      afterValue: patch.globalOrc,
    });
  }

  if (patch.globalSco !== undefined) {
    records.push({
      targetType: 'text',
      targetId: 'globalSco',
      field: 'text',
      beforeValue: data.getGlobalOrcSco().getGlobalSco(),
      afterValue: patch.globalSco,
    });
  }

  if (patch.tablesText !== undefined) {
    records.push({
      targetType: 'text',
      targetId: 'tablesText',
      field: 'text',
      beforeValue: data.getTableSet().getTables(),
      afterValue: patch.tablesText,
    });
  }

  if (patch.scratchPad) {
    const sp = data.getScratchPadData();
    if (patch.scratchPad.text !== undefined) {
      records.push({
        targetType: 'text',
        targetId: 'scratchPad',
        field: 'text',
        beforeValue: sp.getScratchText(),
        afterValue: patch.scratchPad.text,
      });
    }
    if (patch.scratchPad.wordWrapEnabled !== undefined) {
      records.push({
        targetType: 'text',
        targetId: 'scratchPad',
        field: 'wordWrapEnabled',
        beforeValue: sp.isWordWrapEnabled(),
        afterValue: patch.scratchPad.wordWrapEnabled,
      });
    }
  }

  if (patch.projectProperties) {
    const props = data.getProjectProperties() as unknown as Record<string, unknown>;
    for (const [key, val] of Object.entries(patch.projectProperties)) {
      if (val !== undefined) {
        records.push({
          targetType: 'property',
          targetId: 'projectProperties',
          field: key,
          beforeValue: props[key],
          afterValue: val,
        });
      }
    }
  }

  if (patch.transport) {
    if (patch.transport.renderStartTime !== undefined) {
      records.push({
        targetType: 'transport',
        targetId: 'transport',
        field: 'renderStartTime',
        beforeValue: data.getRenderStartTime(),
        afterValue: patch.transport.renderStartTime,
      });
    }
    if (patch.transport.renderEndTime !== undefined) {
      records.push({
        targetType: 'transport',
        targetId: 'transport',
        field: 'renderEndTime',
        beforeValue: data.getRenderEndTime(),
        afterValue: patch.transport.renderEndTime,
      });
    }
    if (patch.transport.loopRendering !== undefined) {
      records.push({
        targetType: 'transport',
        targetId: 'transport',
        field: 'loopRendering',
        beforeValue: data.isLoopRendering(),
        afterValue: patch.transport.loopRendering,
      });
    }
  }

  if (patch.mixer) {
    const m = patch.mixer;
    if (m.type === 'setMixerEnabled') {
      records.push({
        targetType: 'mixerChannel',
        targetId: 'mixer',
        field: 'enabled',
        beforeValue: data.getMixer().isEnabled(),
        afterValue: m.value,
      });
    } else if (m.type === 'setMeterEnabled') {
      records.push({
        targetType: 'mixerChannel',
        targetId: 'mixer',
        field: 'enableMeters',
        beforeValue: data.getMixer().isEnableMeters(),
        afterValue: m.value,
      });
    } else if (m.type === 'setMeterProfile') {
      records.push({
        targetType: 'mixerChannel',
        targetId: 'mixer',
        field: 'meterProfileKey',
        beforeValue: data.getMixer().getMeterProfileKey(),
        afterValue: m.value,
      });
    } else if (m.type === 'updateExtraRenderTime') {
      records.push({
        targetType: 'mixerChannel',
        targetId: 'mixer',
        field: 'extraRenderTime',
        beforeValue: data.getMixer().getExtraRenderTime(),
        afterValue: m.value,
      });
    } else if (m.type === 'updateChannel') {
      const ch = findMixerChannelById(data.getMixer(), m.channelId);
      if (ch) {
        if (m.patch.level !== undefined) {
          records.push({
            targetType: 'mixerChannel',
            targetId: m.channelId,
            field: 'level',
            beforeValue: ch.getLevel(),
            afterValue: m.patch.level,
          });
        }
        if (m.patch.pan !== undefined) {
          records.push({
            targetType: 'mixerChannel',
            targetId: m.channelId,
            field: 'pan',
            beforeValue: ch.getPan(),
            afterValue: m.patch.pan,
          });
        }
        if (m.patch.volume !== undefined) {
          records.push({
            targetType: 'mixerChannel',
            targetId: m.channelId,
            field: 'volume',
            beforeValue: ch.getVolume(),
            afterValue: m.patch.volume,
          });
        }
        if (m.patch.muted !== undefined) {
          records.push({
            targetType: 'mixerChannel',
            targetId: m.channelId,
            field: 'muted',
            beforeValue: ch.isMuted(),
            afterValue: m.patch.muted,
          });
        }
        if (m.patch.solo !== undefined) {
          records.push({
            targetType: 'mixerChannel',
            targetId: m.channelId,
            field: 'solo',
            beforeValue: ch.isSolo(),
            afterValue: m.patch.solo,
          });
        }
      }
    }
  }

  return records;
}

export function applyScalarFieldRecord(
  data: BlueData,
  record: ScalarFieldRecord,
  direction: 'forward' | 'reverse',
): void {
  const value = direction === 'forward' ? record.afterValue : record.beforeValue;

  switch (record.targetType) {
    case 'text':
      if (record.targetId === 'globalOrc') {
        data.getGlobalOrcSco().setGlobalOrc(String(value ?? ''));
      } else if (record.targetId === 'globalSco') {
        data.getGlobalOrcSco().setGlobalSco(String(value ?? ''));
      } else if (record.targetId === 'tablesText') {
        data.getTableSet().setTables(String(value ?? ''));
      } else if (record.targetId === 'scratchPad') {
        if (record.field === 'text') {
          data.getScratchPadData().setScratchText(String(value ?? ''));
        } else if (record.field === 'wordWrapEnabled') {
          data.getScratchPadData().setWordWrapEnabled(Boolean(value));
        }
      }
      break;

    case 'property': {
      const props = data.getProjectProperties() as unknown as Record<string, unknown>;
      props[record.field] = value;
      break;
    }

    case 'transport':
      if (record.field === 'renderStartTime') {
        data.setRenderStartTime(Number(value));
      } else if (record.field === 'renderEndTime') {
        data.setRenderEndTime(Number(value));
      } else if (record.field === 'loopRendering') {
        data.setLoopRendering(Boolean(value));
      }
      break;

    case 'mixerChannel':
      if (record.targetId === 'mixer') {
        if (record.field === 'enabled') {
          data.getMixer().setEnabled(Boolean(value));
        } else if (record.field === 'enableMeters') {
          data.getMixer().setEnableMeters(Boolean(value));
        } else if (record.field === 'meterProfileKey') {
          data.getMixer().setMeterProfileKey(value as MeterProfileKey);
        } else if (record.field === 'extraRenderTime') {
          data.getMixer().setExtraRenderTime(Number(value));
        }
      } else {
        const ch = findMixerChannelById(data.getMixer(), record.targetId);
        if (ch) {
          if (record.field === 'level') ch.setLevel(Number(value));
          else if (record.field === 'pan') ch.setPan(Number(value));
          else if (record.field === 'volume') ch.setVolume(Number(value));
          else if (record.field === 'muted' || record.field === 'mute') ch.setMuted(Boolean(value));
          else if (record.field === 'solo') ch.setSolo(Boolean(value));
        }
      }
      break;

    default:
      break;
  }
}

/**
 * Exact no-throw rollback for scalar records in reverse order.
 * Catches any exceptions per record to guarantee that rollback itself never throws.
 */
export function rollbackScalarRecords(data: BlueData, records: readonly ScalarFieldRecord[]): void {
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i];
    if (!rec) continue;
    try {
      applyScalarFieldRecord(data, rec, 'reverse');
    } catch (e) {
      // Intentionally swallowed for no-throw rollback guarantee
      console.warn('rollbackScalarRecords warning for record:', rec, e);
    }
  }
}

export function prepareTransaction(
  data: BlueData,
  patches: readonly ProjectDocumentPatch[],
  options?: PrepareTransactionOptions,
): PrepareTransactionResult {
  // 0. Patch validation
  for (const patch of patches) {
    const classification = classifyProjectDocumentPatch(patch);
    if (classification === 'invalid') {
      const validation = validateProjectDocumentPatch(patch);
      return {
        status: 'invalid',
        reason:
          validation.reason ?? `Unexpected patch key(s): ${validation.unexpectedKeys?.join(', ')}`,
      };
    }
  }

  // 1. Target and precondition validation
  const validation = validatePreconditions(data, options?.preconditions);
  if (!validation.valid) {
    return {
      status: 'stale',
      reason: validation.reason ?? 'Precondition validation failed',
    };
  }

  // 2. Empty check
  const allEmpty = patches.length === 0 || patches.every(isEmptyProjectDocumentPatch);
  if (allEmpty) {
    return {
      status: 'prepared',
      transaction: {
        kind: 'empty',
        changed: false,
        patchChanged: patches.map(() => false),
        patchAccepted: patches.map(() => true),
      },
    };
  }

  // 3. Classify transaction
  const allScalar =
    !options?.forceStructural && patches.every((p) => classifyProjectDocumentPatch(p) === 'scalar');

  if (allScalar) {
    // Collect records
    const allRecords: ScalarFieldRecord[] = [];
    const patchChanged: boolean[] = [];
    const patchAccepted: boolean[] = [];
    for (const patch of patches) {
      const recs = captureScalarFieldRecords(data, patch);
      allRecords.push(...recs);
      patchChanged.push(recs.some((r) => r.beforeValue !== r.afterValue));
      patchAccepted.push(true);
    }

    // Apply scalar changes with rollback safety
    let appliedCount = 0;
    let anyChanged = false;

    const rollbackFn = (): void => {
      rollbackScalarRecords(data, allRecords.slice(0, appliedCount));
    };

    const applyFn = (): boolean => {
      try {
        for (let i = 0; i < allRecords.length; i++) {
          const rec = allRecords[i]!;
          if (rec.beforeValue !== rec.afterValue) {
            applyScalarFieldRecord(data, rec, 'forward');
            anyChanged = true;
          }
          appliedCount++;
        }
        return anyChanged;
      } catch (err) {
        rollbackFn();
        throw err;
      }
    };

    // Test applicability immediately to ensure valid transaction
    try {
      applyFn();
    } catch (err) {
      return {
        status: 'invalid',
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    return {
      status: 'prepared',
      transaction: {
        kind: 'scalar',
        records: allRecords,
        changed: anyChanged,
        rollback: rollbackFn,
        apply: applyFn,
        patchChanged,
        patchAccepted,
      },
    };
  }

  // 4. Structural transaction: prepare on detached candidate
  const candidate = data.historyCopy();
  transferProjectEditorIdentities(data, candidate);

  const beforeMemento = data.historyCopy();
  transferProjectEditorIdentities(data, beforeMemento);

  let changed = false;
  const patchChanged: boolean[] = [];
  const patchAccepted: boolean[] = [];
  try {
    for (const patch of patches) {
      const c = applyProjectDocumentPatch(candidate, patch, options?.context);
      patchChanged.push(c);
      patchAccepted.push(true);
      changed = c || changed;
    }
  } catch (err) {
    return {
      status: 'invalid',
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  const afterMemento = candidate.historyCopy();
  transferProjectEditorIdentities(candidate, afterMemento);

  return {
    status: 'prepared',
    transaction: {
      kind: 'structure',
      candidate,
      beforeMemento,
      afterMemento,
      changed,
      patchChanged,
      patchAccepted,
    },
  };
}

export function restoreStructuralMemento(
  session: ProjectSession,
  memento: BlueData,
  options?: { stateId?: string; invalidateSession?: boolean },
): ProjectSessionSnapshot {
  const restored = memento.historyCopy();
  transferProjectEditorIdentities(memento, restored);
  return session.publishCommittedDocument(restored, options);
}
