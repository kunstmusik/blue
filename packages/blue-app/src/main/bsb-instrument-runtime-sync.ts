import { BlueSynthBuilder, TrackLayerGroup } from '@blue/data';
import type { BlueData } from '@blue/data';
import type { BsbRealtimeControlUpdate, InstrumentPatch } from '../shared/project-editor';

export type RuntimeChannelWriter = (name: string, value: number) => Promise<void>;

function collectParameterChannels(instrument: BlueSynthBuilder) {
  const channels = new Map<string, string | null>();
  for (const parameter of instrument.getParameters()) {
    if (!channels.has(parameter.getName())) {
      channels.set(parameter.getName(), parameter.getCompilationVarName());
    }
  }
  return channels;
}

/** Resolve channel values from an already-applied instrument patch before submitting writes. */
export function collectBsbInstrumentRuntimeChannels(
  instrument: BlueSynthBuilder,
  patch: InstrumentPatch,
): Array<{ name: string; value: number }> {
  if (!patch.bsbWidgetValues && !patch.bsbInterface) return [];
  const channels = collectParameterChannels(instrument);
  const values = new Map<string, number>();
  const record = (name: string, value: number): void => {
    const channel = channels.get(name);
    if (channel) values.set(channel, value);
  };

  for (const [name, value] of Object.entries(patch.bsbWidgetValues ?? {})) record(name, value);

  const edit = patch.bsbInterface;
  if (edit?.type === 'applyPreset') {
    for (const parameter of instrument.getParameters()) {
      const channel = parameter.getCompilationVarName();
      if (channel) values.set(channel, parameter.getFixedValue());
    }
  } else if (edit?.type === 'updateSliderBankValue' || edit?.type === 'updateWidgetProperties') {
    const name = instrument.getGraphicInterface().findWidgetById(edit.widgetId)?.objectName;
    if (name && edit.type === 'updateSliderBankValue') {
      record(`${name}_${edit.sliderIndex}`, edit.value);
    } else if (name && edit.type === 'updateWidgetProperties') {
      const { value, selected, selectedIndex, xValue, yValue } = edit.properties;
      if (typeof value === 'number') record(name, value);
      if (typeof selected === 'boolean') record(name, selected ? 1 : 0);
      if (typeof selectedIndex === 'number') record(name, selectedIndex);
      if (typeof xValue === 'number') record(`${name}X`, xValue);
      if (typeof yValue === 'number') record(`${name}Y`, yValue);
    }
  }

  return Array.from(values, ([name, value]) => ({ name, value }));
}

export async function syncBsbInstrumentRuntimeChannels(
  instrument: BlueSynthBuilder,
  patch: InstrumentPatch,
  writeChannel: RuntimeChannelWriter,
): Promise<void> {
  for (const { name, value } of collectBsbInstrumentRuntimeChannels(instrument, patch)) {
    await writeChannel(name, value);
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
  const group = data
    .getScore()
    .find(
      (candidate): candidate is TrackLayerGroup =>
        candidate instanceof TrackLayerGroup &&
        candidate.getUniqueId() === update.track?.rootGroupId,
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
  writeChannels: (entries: readonly { name: string; value: number }[]) => Promise<void>,
): Promise<void> {
  const instrument = resolveBsbRealtimeControlInstrument(data, update, projectSessionId);
  if (!instrument) return;

  const widget = instrument.getGraphicInterface().findWidgetById(update.widgetId);
  if (!widget?.objectName) return;

  const parameters = instrument.getParameters();
  const entries: { name: string; value: number }[] = [];
  const addParameter = (name: string, value: number) => {
    const channel = parameters
      .find((parameter) => parameter.getName() === name)
      ?.getCompilationVarName();
    if (channel) entries.push({ name: channel, value });
  };

  switch (update.kind) {
    case 'value':
      addParameter(widget.objectName, update.payload.value);
      break;
    case 'selected':
      addParameter(widget.objectName, update.payload.selected ? 1 : 0);
      break;
    case 'selectedIndex':
      addParameter(widget.objectName, update.payload.selectedIndex);
      break;
    case 'xy':
      addParameter(`${widget.objectName}X`, update.payload.xValue);
      addParameter(`${widget.objectName}Y`, update.payload.yValue);
      break;
    case 'sliderBank':
      addParameter(`${widget.objectName}_${update.payload.sliderIndex}`, update.payload.value);
  }
  if (entries.length > 0) await writeChannels(entries);
}
