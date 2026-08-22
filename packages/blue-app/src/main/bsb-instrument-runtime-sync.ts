import { BlueSynthBuilder, TrackLayerGroup } from '@blue/data';
import type { BlueData } from '@blue/data';
import type {
  BsbInterfacePatch,
  BsbRealtimeControlUpdate,
  InstrumentPatch,
} from '../shared/project-editor';

export type RuntimeChannelWriter = (name: string, value: number) => Promise<void>;
type ParameterWriter = (name: string, value: number) => Promise<void>;

function createParameterWriter(
  instrument: BlueSynthBuilder,
  writeChannel: RuntimeChannelWriter,
): ParameterWriter {
  return async (name, value) => {
    const parameter = instrument.getParameters().find((candidate) => candidate.getName() === name);
    const compilationName = parameter?.getCompilationVarName();
    if (compilationName) await writeChannel(compilationName, value);
  };
}

async function syncWidgetProperties(
  instrument: BlueSynthBuilder,
  patch: Extract<BsbInterfacePatch, { type: 'updateWidgetProperties' }>,
  writeParameter: ParameterWriter,
): Promise<void> {
  const widget = instrument.getGraphicInterface().findWidgetById(patch.widgetId);
  if (!widget?.objectName) return;

  const properties = patch.properties;
  if (typeof properties.value === 'number') {
    await writeParameter(widget.objectName, properties.value);
  }
  if (typeof properties.selected === 'boolean') {
    await writeParameter(widget.objectName, properties.selected ? 1 : 0);
  }
  if (typeof properties.selectedIndex === 'number') {
    await writeParameter(widget.objectName, properties.selectedIndex);
  }
  if (typeof properties.xValue === 'number') {
    await writeParameter(`${widget.objectName}X`, properties.xValue);
  }
  if (typeof properties.yValue === 'number') {
    await writeParameter(`${widget.objectName}Y`, properties.yValue);
  }
}

async function syncBsbInterfacePatch(
  instrument: BlueSynthBuilder,
  patch: BsbInterfacePatch,
  writeChannel: RuntimeChannelWriter,
  writeParameter: ParameterWriter,
): Promise<void> {
  if (patch.type === 'applyPreset') {
    for (const parameter of instrument.getParameters()) {
      const compilationName = parameter.getCompilationVarName();
      if (compilationName) await writeChannel(compilationName, parameter.getFixedValue());
    }
    return;
  }

  if (patch.type === 'updateSliderBankValue') {
    const widget = instrument.getGraphicInterface().findWidgetById(patch.widgetId);
    if (widget?.objectName) {
      await writeParameter(`${widget.objectName}_${patch.sliderIndex}`, patch.value);
    }
    return;
  }

  if (patch.type === 'updateWidgetProperties') {
    await syncWidgetProperties(instrument, patch, writeParameter);
  }
}

/**
 * Push values from an already-applied BSB instrument patch to a running engine.
 */
export async function syncBsbInstrumentRuntimeChannels(
  instrument: BlueSynthBuilder,
  patch: InstrumentPatch,
  writeChannel: RuntimeChannelWriter,
): Promise<void> {
  const writeParameter = createParameterWriter(instrument, writeChannel);

  for (const [objectName, value] of Object.entries(patch.bsbWidgetValues ?? {})) {
    await writeParameter(objectName, value);
  }

  if (patch.bsbInterface) {
    await syncBsbInterfacePatch(instrument, patch.bsbInterface, writeChannel, writeParameter);
  }
}

export function resolveBsbRealtimeControlInstrument(
  data: BlueData,
  update: BsbRealtimeControlUpdate,
  projectSessionId: number,
): BlueSynthBuilder | null {
  if ('assignmentId' in update && update.assignmentId !== undefined) {
    const instrument = data.getArrangement().getInstrumentById(update.assignmentId);
    return instrument instanceof BlueSynthBuilder ? instrument : null;
  }

  if (!update.track || update.track.projectSessionId !== projectSessionId) return null;
  const group = data.getScore().find(
    (candidate): candidate is TrackLayerGroup => (
      candidate instanceof TrackLayerGroup
      && candidate.getUniqueId() === update.track?.rootGroupId
    ),
  );
  const instrument = group
    ?.find((track) => track.getUniqueId() === update.track?.trackId)
    ?.getInstrument();
  return instrument instanceof BlueSynthBuilder ? instrument : null;
}

/**
 * Route one renderer control gesture directly to an active compiled BSB
 * parameter. This intentionally bypasses durable project-patch sequencing.
 */
export async function syncBsbRealtimeControlUpdate(
  data: BlueData,
  update: BsbRealtimeControlUpdate,
  projectSessionId: number,
  writeChannel: RuntimeChannelWriter,
): Promise<void> {
  const instrument = resolveBsbRealtimeControlInstrument(data, update, projectSessionId);
  if (!instrument) return;

  const widget = instrument.getGraphicInterface().findWidgetById(update.widgetId);
  if (!widget?.objectName) return;

  const writeParameter = createParameterWriter(instrument, writeChannel);

  switch (update.kind) {
    case 'value':
      await writeParameter(widget.objectName, update.payload.value);
      return;
    case 'selected':
      await writeParameter(widget.objectName, update.payload.selected ? 1 : 0);
      return;
    case 'selectedIndex':
      await writeParameter(widget.objectName, update.payload.selectedIndex);
      return;
    case 'xy':
      await writeParameter(`${widget.objectName}X`, update.payload.xValue);
      await writeParameter(`${widget.objectName}Y`, update.payload.yValue);
      return;
    case 'sliderBank':
      await writeParameter(
        `${widget.objectName}_${update.payload.sliderIndex}`,
        update.payload.value,
      );
  }
}
