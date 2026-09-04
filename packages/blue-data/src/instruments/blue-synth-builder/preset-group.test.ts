import { describe, expect, it } from 'vitest';
import { Element } from '../../serialization/xml-reader';
import { PresetGroup } from './preset-group';
import { Preset } from './preset';

describe('PresetGroup', () => {
  it('round-trips through XML with presets and subgroups', () => {
    const xml = `<presetGroup name="My Presets" currentPresetUniqueId="abc123" currentPresetModified="true">
      <preset name="Preset A" uniqueId="abc123">
        <setting name="amp">ver2:0.75</setting>
        <setting name="freq">ver2:440</setting>
      </preset>
      <presetGroup name="Sub Folder">
        <preset name="Preset B" uniqueId="def456">
          <setting name="amp">ver2:0.5</setting>
        </preset>
      </presetGroup>
    </presetGroup>`;

    const group = PresetGroup.loadFromXML(Element.parse(xml));
    expect(group.getPresetGroupName()).toBe('My Presets');
    expect(group.getCurrentPresetUniqueId()).toBe('abc123');
    expect(group.isCurrentPresetModified()).toBe(true);
    expect(group.getPresets()).toHaveLength(1);
    expect(group.getPresets()[0].getPresetName()).toBe('Preset A');
    expect(group.getPresets()[0].getValue('amp')).toBe('ver2:0.75');
    expect(group.getSubGroups()).toHaveLength(1);
    expect(group.getSubGroups()[0].getPresets()).toHaveLength(1);

    const savedXml = group.saveAsXML().toXml();
    expect(savedXml).toContain('name="My Presets"');
    expect(savedXml).toContain('uniqueId="abc123"');
    expect(savedXml).toContain('ver2:0.75');

    const reloaded = PresetGroup.loadFromXML(Element.parse(savedXml));
    expect(reloaded.getPresetGroupName()).toBe('My Presets');
    expect(reloaded.getPresets()).toHaveLength(1);
    expect(reloaded.getPresets()[0].getValue('freq')).toBe('ver2:440');
    expect(reloaded.getSubGroups()[0].getPresets()[0].getPresetName()).toBe('Preset B');
  });

  it('handles empty preset groups', () => {
    const xml = `<presetGroup name="Empty"/>`;
    const group = PresetGroup.loadFromXML(Element.parse(xml));
    expect(group.getPresetGroupName()).toBe('Empty');
    expect(group.getPresets()).toHaveLength(0);
    expect(group.getSubGroups()).toHaveLength(0);
  });

  it('finds presets by unique ID recursively', () => {
    const group = new PresetGroup();
    const p1 = new Preset();
    p1.uniqueId = 'id1';
    p1.presetName = 'A';
    const subGroup = new PresetGroup();
    const p2 = new Preset();
    p2.uniqueId = 'id2';
    p2.presetName = 'B';
    subGroup.presets.push(p2);
    group.presets.push(p1);
    group.subGroups.push(subGroup);

    expect(group.findPresetByUniqueId('id1')?.getPresetName()).toBe('A');
    expect(group.findPresetByUniqueId('id2')?.getPresetName()).toBe('B');
    expect(group.findPresetByUniqueId('id3')).toBeNull();
  });

  it('preserves preset settings sorted by key on save', () => {
    const preset = new Preset();
    preset.presetName = 'Test';
    preset.uniqueId = 'u1';
    preset.setValue('zebra', '1');
    preset.setValue('alpha', '2');

    const group = new PresetGroup();
    group.presets.push(preset);

    const xml = group.saveAsXML().toXml();
    const alphaPos = xml.indexOf('name="alpha"');
    const zebraPos = xml.indexOf('name="zebra"');
    expect(alphaPos).toBeLessThan(zebraPos);
  });

  it('duplicates preset group trees with fresh preset ids', () => {
    const group = new PresetGroup();
    group.presetGroupName = 'Root';
    group.currentPresetUniqueId = 'preset-a';

    const preset = new Preset();
    preset.presetName = 'Preset A';
    preset.uniqueId = 'preset-a';
    preset.setValue('gain', 'ver2:0.5');

    const subGroup = new PresetGroup();
    subGroup.presetGroupName = 'Sub';

    const nestedPreset = new Preset();
    nestedPreset.presetName = 'Preset B';
    nestedPreset.uniqueId = 'preset-b';
    nestedPreset.setValue('gain', 'ver2:0.8');

    subGroup.presets.push(nestedPreset);
    group.presets.push(preset);
    group.subGroups.push(subGroup);

    const copy = group.deepCopy();
    copy.presets[0].setValue('gain', 'ver2:0.2');
    copy.subGroups[0].presets[0].presetName = 'Changed';

    expect(copy).not.toBe(group);
    expect(copy.presets[0]).not.toBe(group.presets[0]);
    expect(copy.subGroups[0]).not.toBe(group.subGroups[0]);
    expect(copy.presets[0].getUniqueId()).not.toBe('preset-a');
    expect(copy.subGroups[0].presets[0].getUniqueId()).not.toBe('preset-b');
    expect(copy.currentPresetUniqueId).toBe(copy.presets[0].getUniqueId());
    expect(group.presets[0].getValue('gain')).toBe('ver2:0.5');
    expect(group.subGroups[0].presets[0].getPresetName()).toBe('Preset B');
  });
});
