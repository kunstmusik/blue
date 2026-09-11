import { describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  BlueSynthBuilder,
  BSBCheckBox,
  BSBDropdown,
  BSBHSlider,
  BSBHSliderBank,
  BSBKnob,
  BSBValue,
  BSBVSlider,
  BSBVSliderBank,
  BSBXYController,
  Preset,
  PresetGroup,
  TrackLayerGroup,
} from '@blue/data';
import type { BSBWidget } from '@blue/data';
import type { BsbInterfacePatch, BsbRealtimeControlUpdate } from '../shared/project-editor';
import {
  syncBsbInstrumentRuntimeChannels,
  syncBsbRealtimeControlUpdate,
} from './bsb-instrument-runtime-sync';

interface BsbRuntimeFixture {
  data: BlueData;
  group: TrackLayerGroup;
  trackId: string;
  instrument: BlueSynthBuilder;
  widgetIds: {
    horizontalSlider: string;
    verticalSlider: string;
    knob: string;
    checkBox: string;
    dropdown: string;
    value: string;
    xy: string;
    horizontalSliderBank: string;
    verticalSliderBank: string;
  };
}

function createBsbRuntimeFixture(): BsbRuntimeFixture {
  const data = new BlueData();
  data.getScore().length = 0;

  const group = new TrackLayerGroup();
  const track = group.newLayerAt(0);
  const instrument = new BlueSynthBuilder();
  const root = instrument.getGraphicInterface().getRootGroup();
  const addWidget = <T extends BSBWidget>(widget: T): T => {
    root.addChild(widget);
    return widget;
  };

  const horizontalSlider = new BSBHSlider();
  horizontalSlider.id = 'h-slider';
  horizontalSlider.objectName = 'cutoff';
  horizontalSlider.value = 0.25;
  horizontalSlider.minimum = 0;
  horizontalSlider.maximum = 1;

  const verticalSlider = new BSBVSlider();
  verticalSlider.id = 'v-slider';
  verticalSlider.objectName = 'depth';
  verticalSlider.value = 0.35;
  verticalSlider.minimum = 0;
  verticalSlider.maximum = 1;

  const knob = new BSBKnob();
  knob.id = 'knob';
  knob.objectName = 'gain';
  knob.value = 0.45;

  const checkBox = new BSBCheckBox();
  checkBox.id = 'check-box';
  checkBox.objectName = 'gate';
  checkBox.setValue(1);

  const dropdown = new BSBDropdown();
  dropdown.id = 'dropdown';
  dropdown.objectName = 'mode';
  dropdown.dropdownItems = [
    { name: 'Sine', value: 'sine', uniqueId: 'mode-sine' },
    { name: 'Noise', value: 'noise', uniqueId: 'mode-noise' },
    { name: 'Grain', value: 'grain', uniqueId: 'mode-grain' },
  ];
  dropdown.setValue(1);

  const value = new BSBValue();
  value.id = 'value';
  value.objectName = 'amount';
  value.setValue(0.55);

  const xy = new BSBXYController();
  xy.id = 'xy';
  xy.objectName = 'pad';
  xy.xValue = 0.2;
  xy.yValue = 0.8;

  const horizontalSliderBank = new BSBHSliderBank();
  horizontalSliderBank.id = 'h-bank';
  horizontalSliderBank.objectName = 'harmonics';
  horizontalSliderBank.numberOfSliders = 2;
  horizontalSliderBank.sliders[0]!.value = 0.15;
  horizontalSliderBank.sliders[1]!.value = 0.65;

  const verticalSliderBank = new BSBVSliderBank();
  verticalSliderBank.id = 'v-bank';
  verticalSliderBank.objectName = 'partials';
  verticalSliderBank.numberOfSliders = 2;
  verticalSliderBank.sliders[0]!.value = 0.3;
  verticalSliderBank.sliders[1]!.value = 0.7;

  addWidget(horizontalSlider);
  addWidget(verticalSlider);
  addWidget(knob);
  addWidget(checkBox);
  addWidget(dropdown);
  addWidget(value);
  addWidget(xy);
  addWidget(horizontalSliderBank);
  addWidget(verticalSliderBank);

  track.setInstrument(instrument);
  data.getScore().push(group);
  const trackInstrument = track.getInstrument() as BlueSynthBuilder;

  for (const parameter of trackInstrument.getParameters()) {
    parameter.setCompilationVarName(`gk_${parameter.getName()}`);
  }

  const getWidgetId = (objectName: string): string => {
    const widget = trackInstrument
      .getGraphicInterface()
      .getRootGroup()
      .getChildren()
      .find((candidate) => candidate.objectName === objectName);
    if (!widget) throw new Error(`Missing BSB widget ${objectName}`);
    return widget.id;
  };

  return {
    data,
    group,
    trackId: track.getUniqueId(),
    instrument: trackInstrument,
    widgetIds: {
      horizontalSlider: getWidgetId('cutoff'),
      verticalSlider: getWidgetId('depth'),
      knob: getWidgetId('gain'),
      checkBox: getWidgetId('gate'),
      dropdown: getWidgetId('mode'),
      value: getWidgetId('amount'),
      xy: getWidgetId('pad'),
      horizontalSliderBank: getWidgetId('harmonics'),
      verticalSliderBank: getWidgetId('partials'),
    },
  };
}

interface DurableBsbPatchCase {
  name: string;
  createPatch: (widgetIds: BsbRuntimeFixture['widgetIds']) => BsbInterfacePatch;
  expectedWrites: Array<[string, number]>;
}

const durableBsbPatchCases: DurableBsbPatchCase[] = [
  {
    name: 'horizontal slider',
    createPatch: (widgetIds) => ({
      type: 'updateWidgetProperties',
      widgetId: widgetIds.horizontalSlider,
      properties: { value: 0.9 },
    }),
    expectedWrites: [['gk_cutoff', 0.9]],
  },
  {
    name: 'vertical slider',
    createPatch: (widgetIds) => ({
      type: 'updateWidgetProperties',
      widgetId: widgetIds.verticalSlider,
      properties: { value: 0.1 },
    }),
    expectedWrites: [['gk_depth', 0.1]],
  },
  {
    name: 'knob',
    createPatch: (widgetIds) => ({
      type: 'updateWidgetProperties',
      widgetId: widgetIds.knob,
      properties: { value: 0.8 },
    }),
    expectedWrites: [['gk_gain', 0.8]],
  },
  {
    name: 'checkbox',
    createPatch: (widgetIds) => ({
      type: 'updateWidgetProperties',
      widgetId: widgetIds.checkBox,
      properties: { selected: false },
    }),
    expectedWrites: [['gk_gate', 0]],
  },
  {
    name: 'dropdown',
    createPatch: (widgetIds) => ({
      type: 'updateWidgetProperties',
      widgetId: widgetIds.dropdown,
      properties: { selectedIndex: 2 },
    }),
    expectedWrites: [['gk_mode', 2]],
  },
  {
    name: 'value display parameter',
    createPatch: (widgetIds) => ({
      type: 'updateWidgetProperties',
      widgetId: widgetIds.value,
      properties: { value: 0.7 },
    }),
    expectedWrites: [['gk_amount', 0.7]],
  },
  {
    name: 'XY controller',
    createPatch: (widgetIds) => ({
      type: 'updateWidgetProperties',
      widgetId: widgetIds.xy,
      properties: { xValue: 0.4, yValue: 0.6 },
    }),
    expectedWrites: [
      ['gk_padX', 0.4],
      ['gk_padY', 0.6],
    ],
  },
  {
    name: 'horizontal slider bank',
    createPatch: (widgetIds) => ({
      type: 'updateSliderBankValue',
      widgetId: widgetIds.horizontalSliderBank,
      sliderIndex: 1,
      value: 0.82,
    }),
    expectedWrites: [['gk_harmonics_1', 0.82]],
  },
  {
    name: 'vertical slider bank',
    createPatch: (widgetIds) => ({
      type: 'updateSliderBankValue',
      widgetId: widgetIds.verticalSliderBank,
      sliderIndex: 0,
      value: 0.18,
    }),
    expectedWrites: [['gk_partials_0', 0.18]],
  },
];

interface RealtimeBsbPatchCase {
  name: string;
  createUpdate: (fixture: BsbRuntimeFixture) => BsbRealtimeControlUpdate;
  expectedWrites: Array<[string, number]>;
}

const realtimeBsbPatchCases: RealtimeBsbPatchCase[] = [
  {
    name: 'scalar value',
    createUpdate: ({ group, trackId, widgetIds }) => ({
      track: { projectSessionId: 9, rootGroupId: group.getUniqueId(), trackId },
      widgetId: widgetIds.horizontalSlider,
      kind: 'value',
      payload: { value: 0.91 },
    }),
    expectedWrites: [['gk_cutoff', 0.91]],
  },
  {
    name: 'selection',
    createUpdate: ({ group, trackId, widgetIds }) => ({
      track: { projectSessionId: 9, rootGroupId: group.getUniqueId(), trackId },
      widgetId: widgetIds.checkBox,
      kind: 'selected',
      payload: { selected: false },
    }),
    expectedWrites: [['gk_gate', 0]],
  },
  {
    name: 'dropdown selection',
    createUpdate: ({ group, trackId, widgetIds }) => ({
      track: { projectSessionId: 9, rootGroupId: group.getUniqueId(), trackId },
      widgetId: widgetIds.dropdown,
      kind: 'selectedIndex',
      payload: { selectedIndex: 2 },
    }),
    expectedWrites: [['gk_mode', 2]],
  },
  {
    name: 'XY coordinates',
    createUpdate: ({ group, trackId, widgetIds }) => ({
      track: { projectSessionId: 9, rootGroupId: group.getUniqueId(), trackId },
      widgetId: widgetIds.xy,
      kind: 'xy',
      payload: { xValue: 0.41, yValue: 0.59 },
    }),
    expectedWrites: [
      ['gk_padX', 0.41],
      ['gk_padY', 0.59],
    ],
  },
  {
    name: 'slider-bank value',
    createUpdate: ({ group, trackId, widgetIds }) => ({
      track: { projectSessionId: 9, rootGroupId: group.getUniqueId(), trackId },
      widgetId: widgetIds.verticalSliderBank,
      kind: 'sliderBank',
      payload: { sliderIndex: 1, value: 0.73 },
    }),
    expectedWrites: [['gk_partials_1', 0.73]],
  },
];

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

  it.each(durableBsbPatchCases)(
    'routes the durable $name patch to its compiled parameter channel',
    async ({ createPatch, expectedWrites }) => {
      const fixture = createBsbRuntimeFixture();
      const writer = vi.fn(async () => {});

      await syncBsbInstrumentRuntimeChannels(
        fixture.instrument,
        { bsbInterface: createPatch(fixture.widgetIds) },
        writer,
      );

      expect(writer.mock.calls).toEqual(expectedWrites);
    },
  );

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

  it.each(realtimeBsbPatchCases)(
    'routes the realtime $name update to the matching Track parameter channel',
    async ({ createUpdate, expectedWrites }) => {
      const fixture = createBsbRuntimeFixture();
      const writer = vi.fn(async () => {});

      await syncBsbRealtimeControlUpdate(fixture.data, createUpdate(fixture), 9, writer);

      expect(writer.mock.calls).toEqual(expectedWrites);
    },
  );
});
