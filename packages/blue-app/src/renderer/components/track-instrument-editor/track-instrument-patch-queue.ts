import type {
  BsbInterfacePatch,
  InstrumentPatch,
  OrchestraPatch,
} from '../../../shared/project-editor';

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

function mergeBsbInterfacePatch(
  previous: BsbInterfacePatch,
  next: BsbInterfacePatch,
): BsbInterfacePatch | null {
  if (previous.type === 'updateWidgetProperties'
    && next.type === 'updateWidgetProperties'
    && previous.widgetId === next.widgetId) {
    return {
      ...next,
      properties: { ...previous.properties, ...next.properties },
    };
  }

  if (previous.type === 'updateSliderBankValue'
    && next.type === 'updateSliderBankValue'
    && previous.widgetId === next.widgetId
    && previous.sliderIndex === next.sliderIndex) {
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
  if (previousKey === 'bsbInterface'
    && previous.bsbInterface
    && next.bsbInterface) {
    const merged = mergeBsbInterfacePatch(previous.bsbInterface, next.bsbInterface);
    return merged ? { bsbInterface: merged } : null;
  }

  return null;
}

export function toInstrumentPatch(patch: OrchestraPatch): InstrumentPatch | null {
  if (patch.type === 'updateInstrument') return patch.patch;
  if (patch.type === 'updateInstrumentComment') return { comment: patch.comment };
  return null;
}
