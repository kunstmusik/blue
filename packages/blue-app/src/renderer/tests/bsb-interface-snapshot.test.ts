import { describe, expect, it } from 'vitest';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbWidgetNodeSnapshot,
  PresetGroupSnapshot,
} from '../../shared/project-editor';
import { createDefaultBsbWidgetSnapshot } from '../../shared/project-editor';
import {
  applyBsbInstrumentPatchToSnapshot,
  applyBsbInterfacePatchToSnapshot,
} from '../stores/project-store/bsb-interface-snapshot';

function widget(overrides: Partial<BsbWidgetNodeSnapshot> = {}): BsbWidgetNodeSnapshot {
  return {
    id: 'w1',
    type: 'BSBKnob',
    objectName: 'amp',
    x: 10,
    y: 20,
    width: 60,
    height: 60,
    value: 0.5,
    minimum: 0,
    maximum: 1,
    editable: true,
    properties: {},
    ...overrides,
  };
}

function instrument(
  overrides: Partial<BlueSynthBuilderInstrumentSnapshot> = {},
): BlueSynthBuilderInstrumentSnapshot {
  return {
    assignmentId: '1',
    type: 'blueSynthBuilder',
    name: 'Builder',
    enabled: true,
    comment: '',
    instrumentText: 'aout oscili <amp>, 440',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: ['amp', 'freq'],
    widgets: [{ objectName: 'amp', widgetType: 'BSBKnob', value: 0.5, minimum: 0, maximum: 1 }],
    editEnabled: true,
    gridSettings: { enabled: true, snapEnabled: true, width: 10, height: 10, gridStyle: 'NONE' },
    widgetTree: {
      id: 'root',
      type: 'BSBRootGroup',
      objectName: '',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      value: 0,
      minimum: 0,
      maximum: 1,
      editable: true,
      properties: {},
      children: [widget(), widget({ id: 'w2', objectName: 'freq', x: 100 })],
    },
    ...overrides,
  };
}

describe('BSB interface snapshot reducer', () => {
  it('applies a value patch in place and preserves unaffected sibling identity', () => {
    const snapshot = instrument();
    const sibling = snapshot.widgetTree.children![1];

    applyBsbInterfacePatchToSnapshot(snapshot, {
      type: 'updateWidgetProperties',
      widgetId: 'w1',
      properties: { value: 0.75 },
    });

    expect(snapshot.widgetTree.children![0].value).toBe(0.75);
    expect(snapshot.widgetTree.children![1]).toBe(sibling);
    expect(snapshot.objectNames).toEqual(['amp', 'freq']);
  });

  it('preserves metadata arrays for visual/layout-only instrument patches', () => {
    const snapshot = instrument();
    const objectNames = snapshot.objectNames;
    const widgets = snapshot.widgets;

    applyBsbInstrumentPatchToSnapshot(snapshot, {
      type: 'moveWidget',
      widgetId: 'w1',
      x: 80,
      y: 90,
    });

    expect(snapshot.widgetTree.children![0]).toMatchObject({ x: 80, y: 90 });
    expect(snapshot.objectNames).toBe(objectNames);
    expect(snapshot.widgets).toBe(widgets);
  });

  it('updates metadata when an object name changes and rejects malformed targets safely', () => {
    const snapshot = instrument();
    applyBsbInstrumentPatchToSnapshot(snapshot, {
      type: 'updateWidgetProperties',
      widgetId: 'w1',
      properties: { objectName: 'gain' },
    });

    expect(snapshot.widgetTree.children![0].objectName).toBe('gain');
    expect(snapshot.objectNames).toContain('gain');
    expect(() =>
      applyBsbInterfacePatchToSnapshot(snapshot, {
        type: 'removeWidget',
        widgetId: 'missing-widget',
      }),
    ).not.toThrow();
  });

  it('supports nested layout and group creation without deep-cloning siblings', () => {
    const group = createDefaultBsbWidgetSnapshot('BSBGroup')!;
    group.id = 'group-1';
    group.children = [];
    const snapshot = instrument({
      widgetTree: {
        ...instrument().widgetTree,
        children: [group, widget({ id: 'sibling' })],
      },
    });
    const sibling = snapshot.widgetTree.children![1];

    applyBsbInterfacePatchToSnapshot(snapshot, {
      type: 'addWidget',
      widgetType: 'BSBKnob',
      parentGroupId: 'group-1',
      x: 12,
      y: 18,
    });

    expect(snapshot.widgetTree.children![0].children).toHaveLength(1);
    expect(snapshot.widgetTree.children![1]).toBe(sibling);
  });

  it('preserves and edits preset trees through path-based operations', () => {
    const presetGroup: PresetGroupSnapshot = {
      name: 'Presets',
      currentPresetUniqueId: 'p1',
      currentPresetModified: false,
      subGroups: [],
      presets: [{ uniqueId: 'p1', name: 'Default', values: { amp: '0.5' } }],
    };
    const snapshot = instrument({ presetGroup });

    applyBsbInterfacePatchToSnapshot(snapshot, {
      type: 'addPresetFromSnapshot',
      parentGroupPath: [],
      preset: { uniqueId: 'p2', name: 'Bright', values: { amp: '0.9' } },
    });
    applyBsbInterfacePatchToSnapshot(snapshot, {
      type: 'renamePreset',
      presetUniqueId: snapshot.presetGroup!.presets[1].uniqueId,
      name: 'Brighter',
    });

    expect(snapshot.presetGroup!.presets.map((preset) => preset.name)).toEqual([
      'Default',
      'Brighter',
    ]);
  });

  it('updates grid, UDO, and embedded opcode state without replacing unrelated metadata', () => {
    const snapshot = instrument({
      udolist: [
        {
          name: 'foo',
          style: 'CLASSIC',
          outTypes: '',
          inTypes: '',
          inputArguments: '',
          code: 'opcode foo',
          comments: '',
        },
      ],
      opcodeListText: 'old',
    });
    const objectNames = snapshot.objectNames;

    applyBsbInstrumentPatchToSnapshot(snapshot, {
      type: 'updateGridSettings',
      patch: { width: 20 },
    });
    applyBsbInstrumentPatchToSnapshot(snapshot, {
      type: 'updateEmbeddedOpcodeList',
      opcodeList: 'new',
    });
    applyBsbInstrumentPatchToSnapshot(snapshot, {
      type: 'addUdo',
      definition: {
        name: 'bar',
        style: 'CLASSIC',
        outTypes: '',
        inTypes: '',
        inputArguments: '',
        code: 'opcode bar',
        comments: '',
      },
    });

    expect(snapshot.gridSettings.width).toBe(20);
    expect(snapshot.opcodeListText).toContain('opcode bar');
    expect(snapshot.udolist).toHaveLength(2);
    expect(snapshot.objectNames).toBe(objectNames);
  });

  it('keeps structured score-object BSB updates isolated to the selected instrument', () => {
    const selected = instrument({
      assignmentId: 'selected',
      widgetTree: {
        ...instrument().widgetTree,
        children: [widget({ properties: { numberOfSliders: 1, sliders: [{ value: 0.5 }] } })],
      },
    });
    const other = instrument({ assignmentId: 'other' });

    applyBsbInstrumentPatchToSnapshot(selected, {
      type: 'updateSliderBankValue',
      widgetId: 'w1',
      sliderIndex: 0,
      value: 0.25,
    });

    expect(selected.widgetTree.children![0].properties.sliders).toEqual([{ value: 0.25 }]);
    expect(other.widgetTree.children![0].value).toBe(0.5);
  });

  it('clones pasted widget nodes with deep equality, nested mutation independence, and native error on non-serializable values', () => {
    const target = instrument();
    const pastedNode: BsbWidgetNodeSnapshot = {
      id: 'pasted-raw-id',
      type: 'BSBKnob',
      objectName: 'knob1',
      x: 15,
      y: 25,
      width: 50,
      height: 50,
      value: 0.3,
      minimum: 0,
      maximum: 1,
      editable: true,
      properties: {
        customArray: [10, 20, 30],
        nestedConfig: { theme: 'dark', sensitivity: 1.5 },
        optionalProp: undefined,
      },
    };

    applyBsbInterfacePatchToSnapshot(target, {
      type: 'pasteWidgets',
      widgetData: JSON.stringify([pastedNode]),
    });

    const added = target.widgetTree.children!.find((c) => c.objectName === 'knob1')!;
    expect(added).toBeDefined();
    expect(added.properties.customArray).toEqual([10, 20, 30]);
    expect(added.properties.nestedConfig).toEqual({ theme: 'dark', sensitivity: 1.5 });
    expect(added.properties.customArray).not.toBe(pastedNode.properties.customArray);
    expect(added.properties.nestedConfig).not.toBe(pastedNode.properties.nestedConfig);

    // Independent nested mutation
    const initialChildCount = target.widgetTree.children!.length;
    (target.widgetTree.children![initialChildCount - 1].properties.customArray as number[]).push(
      999,
    );
    expect(pastedNode.properties.customArray).toEqual([10, 20, 30]);

    // Native clone failure surfaces on non-serializable values
    (target.widgetTree as any).badProp = () => 'not serializable';
    expect(() => {
      applyBsbInterfacePatchToSnapshot(target, {
        type: 'pasteWidgets',
        widgetData: JSON.stringify([pastedNode]),
      });
    }).toThrow();
  });
});
