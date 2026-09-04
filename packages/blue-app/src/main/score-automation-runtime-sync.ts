import { getProjectParameterCatalog, PolyObject, TrackLayerGroup } from '@blue/data';
import type { AutomatableLayer, BlueData, Parameter, TempoMap } from '@blue/data';
import type {
  ProjectDocumentPatch,
  ScoreAutomationLayerRef,
  ScorePatch,
} from '../shared/project-editor';

export interface AutomationRuntimeTimingContext {
  renderStartTime: number;
  sampleRate?: number;
  ksmps?: number;
  tempoMap?: TempoMap | null;
}

export interface AutomationRuntimeSyncBridge {
  syncAutomationParameter(
    parameter: Parameter,
    automationTiming?: AutomationRuntimeTimingContext,
  ): void | Promise<void>;
}

export function buildAutomationRuntimeTimingContext(
  data: BlueData,
): AutomationRuntimeTimingContext {
  return {
    renderStartTime: data.getRenderStartTime(),
    sampleRate: Number(data.getProjectProperties().sampleRate) || 44100,
    ksmps: Number(data.getProjectProperties().ksmps) || 64,
    tempoMap: data.getScore().getTimeContext().getTempoMap(),
  };
}

export function collectAffectedProjectScoreAutomationParameterIds(
  data: BlueData,
  patch: ProjectDocumentPatch,
): Set<string> {
  if (!patch.score) {
    return new Set();
  }

  return collectAffectedScoreAutomationParameterIds(data, patch.score);
}

export function collectAffectedScoreAutomationParameterIds(
  data: BlueData,
  patch: ScorePatch,
): Set<string> {
  const ids = new Set<string>();
  const add = (id?: string): void => {
    if (id && id.trim().length > 0) {
      ids.add(id);
    }
  };

  switch (patch.type) {
    case 'assignAutomationToLayer':
    case 'removeAutomationFromLayer':
      add(patch.parameterId);
      break;

    case 'moveAutomationToLayer':
      add(patch.parameterId);
      break;

    case 'clearLayerAutomations': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      for (const id of layer?.getAutomationParameters().getIds() ?? []) {
        add(id);
      }
      break;
    }

    case 'setAutomationPoints':
    case 'insertAutomationPoint':
    case 'deleteAutomationPoint':
    case 'moveAutomationPoint':
    case 'setAutomationResolution':
      add(patch.parameterId);
      break;

    case 'moveAutomationRange':
    case 'scaleAutomationRange': {
      const layerIds = new Set(patch.range.layerIds);
      for (const [layerId, parameterIds] of Object.entries(patch.range.parameterIdsByLayer)) {
        if (layerIds.size > 0 && !layerIds.has(layerId)) {
          continue;
        }
        for (const parameterId of parameterIds) {
          add(parameterId);
        }
      }
      break;
    }

    case 'selectLayerAutomation':
    case 'setAutomationLineColor':
    case 'cleanupLayerAutomation':
      break;

    default:
      break;
  }

  return ids;
}

export async function syncScoreAutomationParametersToEngine(
  data: BlueData,
  parameterIds: Iterable<string>,
  bridge: AutomationRuntimeSyncBridge,
  automationTiming: AutomationRuntimeTimingContext = buildAutomationRuntimeTimingContext(data),
): Promise<void> {
  const byId = new Map(
    getProjectParameterCatalog(data).map((entry) => [
      entry.parameter.getUniqueId(),
      entry.parameter,
    ]),
  );

  for (const parameterId of parameterIds) {
    const parameter = byId.get(parameterId);
    if (!parameter) {
      continue;
    }

    await bridge.syncAutomationParameter(parameter, automationTiming);
  }
}

function resolveAutomationLayerRef(
  data: BlueData,
  ref: ScoreAutomationLayerRef,
): AutomatableLayer | null {
  const score = data.getScore();
  const directGroup = score[ref.rootGroupIndex];
  const directLayer = getAutomationLayerFromGroup(directGroup, ref);
  if (directLayer) {
    return directLayer;
  }

  for (const group of score) {
    const layer = findAutomationLayerByRef(group, ref);
    if (layer) {
      return layer;
    }
  }

  return null;
}

function findAutomationLayerByRef(
  group: unknown,
  ref: ScoreAutomationLayerRef,
): AutomatableLayer | null {
  const directLayer = getAutomationLayerFromGroup(group, ref);
  if (directLayer) {
    return directLayer;
  }

  if (!(group instanceof PolyObject)) {
    return null;
  }

  for (const layer of group) {
    for (const soundObject of layer) {
      if (soundObject instanceof PolyObject) {
        const nested = findAutomationLayerByRef(soundObject, ref);
        if (nested) {
          return nested;
        }
      }
    }
  }

  return null;
}

function getAutomationLayerFromGroup(
  group: unknown,
  ref: ScoreAutomationLayerRef,
): AutomatableLayer | null {
  if (
    ref.layerKind === 'soundObject' &&
    group instanceof PolyObject &&
    ref.layerIndex >= 0 &&
    ref.layerIndex < group.length
  ) {
    return group[ref.layerIndex] as AutomatableLayer;
  }

  if (
    ref.layerKind === 'track' &&
    group instanceof TrackLayerGroup &&
    ref.layerIndex >= 0 &&
    ref.layerIndex < group.length
  ) {
    return group[ref.layerIndex] as AutomatableLayer;
  }

  return null;
}
