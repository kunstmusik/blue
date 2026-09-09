import type {
  BlueX7Patch,
  BsbInterfacePatch,
  InstrumentPatch,
  OrchestraPatch,
} from '../../../shared/project-editor';
import type {
  PrepareHistoryBoundaryAck,
  PrepareHistoryBoundaryEvent,
  ReleaseHistoryBoundaryEvent,
} from '../../../shared/project-history';

const LATEST_VALUE_PATCH_KEYS = new Set<keyof InstrumentPatch>([
  'name',
  'enabled',
  'comment',
  'text',
  'instrumentText',
  'alwaysOnInstrumentText',
  'globalOrc',
  'globalSco',
  'bsbOpcodeListText',
]);

function getOnlyPatchKey(patch: InstrumentPatch): keyof InstrumentPatch | null {
  const keys = Object.keys(patch) as Array<keyof InstrumentPatch>;
  return keys.length === 1 ? keys[0]! : null;
}

function mergeBlueX7Patch(previous: BlueX7Patch, next: BlueX7Patch): BlueX7Patch | null {
  if (previous.type !== next.type) return null;

  switch (previous.type) {
    case 'setCommonField':
      return previous.field === (next as typeof previous).field ? next : null;
    case 'setOperatorEnabled':
      return previous.operatorIndex === (next as typeof previous).operatorIndex ? next : null;
    case 'setLfoField':
      return previous.field === (next as typeof previous).field ? next : null;
    case 'setOperatorField': {
      const n = next as typeof previous;
      return previous.operatorIndex === n.operatorIndex && previous.field === n.field ? next : null;
    }
    case 'setSharedOscillatorSync':
    case 'setSharedPitchModulationSensitivity':
    case 'setCsoundPostCode':
    case 'replaceVoice':
      return next;
    case 'setOperatorEnvelopePoint': {
      const n = next as typeof previous;
      return previous.operatorIndex === n.operatorIndex && previous.stageIndex === n.stageIndex
        ? next
        : null;
    }
    case 'setPitchEnvelopePoint':
      return previous.stageIndex === (next as typeof previous).stageIndex ? next : null;
  }
}

function mergeBsbInterfacePatch(
  previous: BsbInterfacePatch,
  next: BsbInterfacePatch,
): BsbInterfacePatch | null {
  if (
    previous.type === 'updateWidgetProperties' &&
    next.type === 'updateWidgetProperties' &&
    previous.widgetId === next.widgetId
  ) {
    return {
      ...next,
      properties: { ...previous.properties, ...next.properties },
    };
  }

  if (
    previous.type === 'updateSliderBankValue' &&
    next.type === 'updateSliderBankValue' &&
    previous.widgetId === next.widgetId &&
    previous.sliderIndex === next.sliderIndex
  ) {
    return next;
  }

  return null;
}

export function mergePendingInstrumentPatch(
  previous: InstrumentPatch,
  next: InstrumentPatch,
): InstrumentPatch | null {
  const previousKey = getOnlyPatchKey(previous);
  if (!previousKey || previousKey !== getOnlyPatchKey(next)) return null;

  if (LATEST_VALUE_PATCH_KEYS.has(previousKey)) return next;
  if (previousKey === 'bsbWidgetValues') {
    return {
      bsbWidgetValues: {
        ...previous.bsbWidgetValues,
        ...next.bsbWidgetValues,
      },
    };
  }
  if (previousKey === 'bsbInterface' && previous.bsbInterface && next.bsbInterface) {
    const merged = mergeBsbInterfacePatch(previous.bsbInterface, next.bsbInterface);
    return merged ? { bsbInterface: merged } : null;
  }
  if (previousKey === 'blueX7' && previous.blueX7 && next.blueX7) {
    const merged = mergeBlueX7Patch(previous.blueX7, next.blueX7);
    return merged ? { blueX7: merged } : null;
  }

  return null;
}

export function toInstrumentPatch(patch: OrchestraPatch): InstrumentPatch | null {
  if (patch.type === 'updateInstrument') return patch.patch;
  if (patch.type === 'updateInstrumentComment') return { comment: patch.comment };
  return null;
}

export interface InstrumentPatchBoundaryControllerDependencies {
  participantContextId: string;
  /** Removes and returns the durable patches that were pending before the boundary. */
  capturePendingPatches(): InstrumentPatch[];
  /**
   * Persists the captured prefix in order for the settling barrier. On
   * rejection the implementation must retain unsent patches as drafts.
   */
  drainPrefix(patches: readonly InstrumentPatch[], barrierId: string): Promise<void>;
  acknowledgeBoundary(ack: PrepareHistoryBoundaryAck): void;
  getAcknowledgedRevision(): number;
  reportError?(error: unknown): void;
  /** Called when the boundary releases so paused drafts can resume draining. */
  onReleased?(): void;
}

export interface InstrumentPatchBoundaryController {
  handlePrepareBoundary(event: PrepareHistoryBoundaryEvent): Promise<void>;
  handleReleaseBoundary(event: ReleaseHistoryBoundaryEvent): void;
  isSettlementPaused(): boolean;
}

export function createInstrumentPatchBoundaryController(
  dependencies: InstrumentPatchBoundaryControllerDependencies,
): InstrumentPatchBoundaryController {
  let activeBarrierId: string | null = null;
  let acknowledgedSequence = 0;

  return {
    isSettlementPaused() {
      return activeBarrierId !== null;
    },

    async handlePrepareBoundary(event) {
      if (activeBarrierId !== null) return;
      activeBarrierId = event.barrierId;

      let prefix: InstrumentPatch[] = [];
      let drained = true;
      try {
        prefix = dependencies.capturePendingPatches();
        if (prefix.length > 0) {
          acknowledgedSequence += 1;
          await dependencies.drainPrefix(prefix, event.barrierId);
        }
      } catch (error) {
        drained = false;
        dependencies.reportError?.(error);
      }

      dependencies.acknowledgeBoundary({
        barrierId: event.barrierId,
        contextId: dependencies.participantContextId,
        lastAcknowledgedRevision: dependencies.getAcknowledgedRevision(),
        lastAcknowledgedSequence: acknowledgedSequence,
        outstandingPrefixCount: drained ? 0 : prefix.length,
      });
    },

    handleReleaseBoundary(event) {
      if (activeBarrierId === null || activeBarrierId !== event.barrierId) return;
      activeBarrierId = null;
      dependencies.onReleased?.();
    },
  };
}
