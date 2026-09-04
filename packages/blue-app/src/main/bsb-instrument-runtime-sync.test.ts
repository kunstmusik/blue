import { describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  BlueSynthBuilder,
  BSBKnob,
  Preset,
  PresetGroup,
  TrackLayerGroup,
} from '@blue/data';
import {
  syncBsbInstrumentRuntimeChannels,
  syncBsbRealtimeControlUpdate,
} from './bsb-instrument-runtime-sync';

describe('syncBsbInstrumentRuntimeChannels', () => {
  it('writes every compiled Track instrument parameter after a preset is applied', async () => {
    const instrument = new BlueSynthBuilder();
    const knob = instrument.getGraphicInterface().createWidgetByType('BSBKnob') as BSBKnob;
    knob.objectName = 'gain';
    knob.value = 0.25;
    instrument.getGraphicInterface().getRootGroup().addChild(knob);

    const parameter = instrument.getParameters()[0]!;
    parameter.setCompilationVarName('gk_blue_auto7');
    const preset = new Preset();
    preset.setValue('gain', 'ver2:0.8');
    const presets = new PresetGroup();
    presets.presets.push(preset);
    instrument.setPresetGroup(presets);
    expect(instrument.applyPreset(preset.getUniqueId())).toBe(true);

    const writer = vi.fn(async () => {});
    await syncBsbInstrumentRuntimeChannels(
      instrument,
      { bsbInterface: { type: 'applyPreset', presetUniqueId: preset.getUniqueId() } },
      writer,
    );

    expect(writer).toHaveBeenCalledWith('gk_blue_auto7', 0.8);
  });

  it('routes rapid controls to a Track-owned BSB instrument using the project session fence', async () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const instrument = new BlueSynthBuilder();
    const knob = instrument.getGraphicInterface().createWidgetByType('BSBKnob') as BSBKnob;
    knob.objectName = 'gain';
    instrument.getGraphicInterface().getRootGroup().addChild(knob);
    track.setInstrument(instrument);
    data.getScore().push(group);
    const trackInstrument = track.getInstrument() as BlueSynthBuilder;
    const trackKnob = trackInstrument
      .getGraphicInterface()
      .getRootGroup()
      .getChildren()[0] as BSBKnob;
    trackInstrument.getParameters()[0]!.setCompilationVarName('gk_blue_auto3');

    const writer = vi.fn(async () => {});
    const update = {
      track: {
        projectSessionId: 9,
        rootGroupId: group.getUniqueId(),
        trackId: track.getUniqueId(),
      },
      widgetId: trackKnob.id,
      kind: 'value' as const,
      payload: { value: 0.625 },
    };
    await syncBsbRealtimeControlUpdate(data, update, 9, writer);
    expect(writer).toHaveBeenCalledWith('gk_blue_auto3', 0.625);

    writer.mockClear();
    await syncBsbRealtimeControlUpdate(data, update, 10, writer);
    expect(writer).not.toHaveBeenCalled();
  });
});
