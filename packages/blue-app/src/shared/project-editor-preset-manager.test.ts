import { describe, expect, it } from 'vitest';
import { BlueData, BlueSynthBuilder, Preset, PresetGroup } from '@blue/data';
import type { BsbInterfacePatch } from './project-editor';
import { applyProjectDocumentPatch } from './project-editor';

function createPreset(id: string, name: string): Preset {
  const preset = new Preset();
  preset.uniqueId = id;
  preset.setPresetName(name);
  return preset;
}

function createPresetProject(): {
  data: BlueData;
  root: PresetGroup;
} {
  const data = new BlueData();
  const instrument = new BlueSynthBuilder();
  const root = new PresetGroup();
  const nested = new PresetGroup();
  nested.setPresetGroupName('Nested');
  nested.presets.push(createPreset('preset-c', 'C'));
  root.presets.push(createPreset('preset-a', 'A'), createPreset('preset-b', 'B'));
  root.subGroups.push(nested);
  root.setCurrentPresetUniqueId('preset-c');
  root.setCurrentPresetModified(true);
  instrument.setPresetGroup(root);
  data.getArrangement().addInstrument(instrument, '1');
  return { data, root };
}

function applyPresetPatch(data: BlueData, bsbInterface: BsbInterfacePatch): boolean {
  return applyProjectDocumentPatch(data, {
    orchestra: {
      type: 'updateInstrument',
      assignmentId: '1',
      patch: { bsbInterface },
    },
  });
}

describe('BSB preset manager patches', () => {
  it('renames and moves presets without sorting away explicit order', () => {
    const { data, root } = createPresetProject();

    expect(
      applyPresetPatch(data, {
        type: 'renamePreset',
        presetUniqueId: 'preset-b',
        name: 'Renamed',
      }),
    ).toBe(true);
    expect(
      applyPresetPatch(data, {
        type: 'movePreset',
        presetUniqueId: 'preset-b',
        parentGroupPath: [0],
        targetIndex: 1,
      }),
    ).toBe(true);

    expect(root.presets.map((preset) => preset.getUniqueId())).toEqual(['preset-a']);
    expect(root.subGroups[0]?.presets.map((preset) => preset.getPresetName())).toEqual([
      'C',
      'Renamed',
    ]);
  });

  it('reorders presets and groups when moving downward within one parent', () => {
    const { data, root } = createPresetProject();
    const second = new PresetGroup();
    second.setPresetGroupName('Second');
    root.subGroups.push(second);

    expect(
      applyPresetPatch(data, {
        type: 'movePreset',
        presetUniqueId: 'preset-a',
        parentGroupPath: [],
        targetIndex: 4,
      }),
    ).toBe(true);
    expect(root.presets.map((preset) => preset.getUniqueId())).toEqual(['preset-b', 'preset-a']);

    expect(
      applyPresetPatch(data, {
        type: 'movePresetGroup',
        groupPath: [0],
        parentGroupPath: [],
        targetIndex: 2,
      }),
    ).toBe(true);
    expect(root.subGroups.map((group) => group.getPresetGroupName())).toEqual(['Second', 'Nested']);

    const reopened = BlueData.loadFromString(data.saveToString());
    const reopenedInstrument = reopened.getArrangement().getInstrumentById('1') as BlueSynthBuilder;
    const reopenedGroup = reopenedInstrument.getPresetGroup();
    expect(reopenedGroup?.presets.map((preset) => preset.getUniqueId())).toEqual([
      'preset-b',
      'preset-a',
    ]);
    expect(reopenedGroup?.subGroups.map((group) => group.getPresetGroupName())).toEqual([
      'Second',
      'Nested',
    ]);
  });

  it('reorders and renames groups while rejecting descendant moves', () => {
    const { data, root } = createPresetProject();
    const second = new PresetGroup();
    second.setPresetGroupName('Second');
    root.subGroups.push(second);
    const child = new PresetGroup();
    child.setPresetGroupName('Child');
    root.subGroups[0]?.subGroups.push(child);

    expect(
      applyPresetPatch(data, {
        type: 'renamePresetGroup',
        groupPath: [0],
        name: 'Renamed Folder',
      }),
    ).toBe(true);
    expect(
      applyPresetPatch(data, {
        type: 'movePresetGroup',
        groupPath: [1],
        parentGroupPath: [],
        targetIndex: 0,
      }),
    ).toBe(true);
    expect(root.subGroups.map((group) => group.getPresetGroupName())).toEqual([
      'Second',
      'Renamed Folder',
    ]);

    expect(
      applyPresetPatch(data, {
        type: 'movePresetGroup',
        groupPath: [1],
        parentGroupPath: [1, 0],
        targetIndex: 0,
      }),
    ).toBe(false);
    expect(root.subGroups.map((group) => group.getPresetGroupName())).toEqual([
      'Second',
      'Renamed Folder',
    ]);
  });

  it('clears the current preset when deleting it directly or with its group', () => {
    const direct = createPresetProject();
    expect(
      applyPresetPatch(direct.data, {
        type: 'removePreset',
        presetUniqueId: 'preset-c',
      }),
    ).toBe(true);
    expect(direct.root.getCurrentPresetUniqueId()).toBe('');
    expect(direct.root.isCurrentPresetModified()).toBe(false);

    const nested = createPresetProject();
    expect(
      applyPresetPatch(nested.data, {
        type: 'removePresetGroup',
        groupPath: [0],
      }),
    ).toBe(true);
    expect(nested.root.getCurrentPresetUniqueId()).toBe('');
    expect(nested.root.subGroups).toHaveLength(0);
  });

  it('protects the root group from deletion', () => {
    const { data, root } = createPresetProject();
    applyPresetPatch(data, {
      type: 'removePresetGroup',
      groupPath: [],
    });
    expect(root.getPresetGroupName()).toBe('Presets');
    expect(root.subGroups).toHaveLength(1);
  });

  it('inserts copied preset and folder snapshots into the selected group', () => {
    const { data, root } = createPresetProject();

    expect(
      applyPresetPatch(data, {
        type: 'addPresetFromSnapshot',
        parentGroupPath: [0],
        preset: {
          uniqueId: 'preset-pasted',
          name: 'Pasted',
          values: { cutoff: '0.75' },
        },
      }),
    ).toBe(true);

    expect(
      applyPresetPatch(data, {
        type: 'addPresetGroupFromSnapshot',
        parentGroupPath: [],
        group: {
          name: 'Imported Folder',
          currentPresetModified: false,
          subGroups: [],
          presets: [{ uniqueId: 'preset-imported', name: 'Imported' }],
        },
      }),
    ).toBe(true);

    expect(root.subGroups[0]?.presets.map((preset) => preset.getPresetName())).toEqual([
      'C',
      'Pasted',
    ]);
    expect(root.subGroups[0]?.presets[1]?.getValue('cutoff')).toBe('0.75');
    expect(root.subGroups[1]?.getPresetGroupName()).toBe('Imported Folder');
    expect(root.subGroups[1]?.presets[0]?.getUniqueId()).toBe('preset-imported');
  });
});
