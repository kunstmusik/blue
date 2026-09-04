import { describe, expect, it } from 'vitest';
import { Preset } from './preset';
import { PresetGroup } from './preset-group';
import { BSBGraphicInterface } from './bsb-graphic-interface';
import { BSBKnob } from './bsb-knob';
import { BSBCheckBox } from './bsb-check-box';
import { BSBTextField } from './bsb-text-field';
import { BSBLabel } from './bsb-label';
import { BSBGroup } from './bsb-group';

/**
 * Helper: create a BSBGraphicInterface with the given widgets added
 * to its root group.
 */
function makeInterface(
  ...widgets: InstanceType<typeof import('./bsb-widget').BSBWidget>[]
): BSBGraphicInterface {
  const gi = new BSBGraphicInterface();
  for (const w of widgets) {
    gi.getRootGroup().addChild(w);
  }
  return gi;
}

function makeKnob(objectName: string, value: number): BSBKnob {
  const knob = new BSBKnob();
  knob.objectName = objectName;
  knob.value = value;
  knob.minimum = 0;
  knob.maximum = 1;
  return knob;
}

function makeCheckBox(objectName: string, selected: boolean): BSBCheckBox {
  const cb = new BSBCheckBox();
  cb.objectName = objectName;
  cb.setValue(selected ? 1 : 0);
  return cb;
}

function makeTextField(objectName: string, text: string): BSBTextField {
  const tf = new BSBTextField();
  tf.objectName = objectName;
  tf.textValue = text;
  return tf;
}

function makeLabel(objectName: string): BSBLabel {
  const label = new BSBLabel();
  label.objectName = objectName;
  return label;
}

describe('Preset.synchronizeWithInterface', () => {
  it('removes stale entries whose widgets were deleted from the interface', () => {
    const preset = new Preset();
    preset.setValue('amp', 'ver2:0.5');
    preset.setValue('freq', 'ver2:440');
    preset.setValue('removed', 'ver2:0.1');

    // Interface only has 'amp' and 'freq', not 'removed'
    const gi = makeInterface(makeKnob('amp', 0.5), makeKnob('freq', 440));
    preset.synchronizeWithInterface(gi);

    expect(preset.getValue('amp')).toBe('ver2:0.5');
    expect(preset.getValue('freq')).toBe('ver2:440');
    expect(preset.getValue('removed')).toBeUndefined();
  });

  it('adds default values for newly-added widgets not yet in the preset', () => {
    const preset = new Preset();
    preset.setValue('amp', 'ver2:0.5');

    // Interface now also has 'freq' (knob) and 'enabled' (checkbox)
    const gi = makeInterface(
      makeKnob('amp', 0.5),
      makeKnob('freq', 0.75),
      makeCheckBox('enabled', true),
    );
    preset.synchronizeWithInterface(gi);

    expect(preset.getValue('amp')).toBe('ver2:0.5'); // unchanged
    expect(preset.getValue('freq')).toBeDefined(); // newly added
    expect(preset.getValue('enabled')).toBe('true'); // checkbox default
  });

  it('preserves existing values for widgets still in the interface', () => {
    const preset = new Preset();
    preset.setValue('amp', 'ver2:0.3');

    const gi = makeInterface(makeKnob('amp', 0.9));
    preset.synchronizeWithInterface(gi);

    // Should keep original preset value, NOT capture the current widget value
    expect(preset.getValue('amp')).toBe('ver2:0.3');
  });

  it('handles combined additions and removals', () => {
    const preset = new Preset();
    preset.setValue('old1', '1.0');
    preset.setValue('old2', '2.0');
    preset.setValue('keep', '3.0');

    const gi = makeInterface(makeKnob('keep', 3.0), makeKnob('new1', 0.5));
    preset.synchronizeWithInterface(gi);

    expect(preset.getValue('old1')).toBeUndefined();
    expect(preset.getValue('old2')).toBeUndefined();
    expect(preset.getValue('keep')).toBe('3.0');
    expect(preset.getValue('new1')).toBeDefined();
  });

  it('skips widgets with empty objectName', () => {
    const preset = new Preset();

    const knobNoName = makeKnob('', 0.5);
    const gi = makeInterface(knobNoName);
    preset.synchronizeWithInterface(gi);

    expect(preset.getValuesMap().size).toBe(0);
  });

  it('skips widgets whose getPresetValue returns null (labels, groups)', () => {
    const preset = new Preset();

    const gi = makeInterface(makeLabel('myLabel'), makeKnob('amp', 0.5));
    preset.synchronizeWithInterface(gi);

    // Labels return null from getPresetValue, so they should not appear
    expect(preset.getValue('myLabel')).toBeUndefined();
    expect(preset.getValue('amp')).toBeDefined();
  });

  it('handles widgets nested inside BSBGroups', () => {
    const preset = new Preset();
    preset.setValue('topLevel', '1.0');
    preset.setValue('stale', '2.0');

    const innerKnob = makeKnob('nested', 0.7);
    const group = new BSBGroup();
    group.objectName = 'myGroup';
    group.addChild(innerKnob);

    const gi = new BSBGraphicInterface();
    gi.getRootGroup().addChild(makeKnob('topLevel', 1.0));
    gi.getRootGroup().addChild(group);

    preset.synchronizeWithInterface(gi);

    expect(preset.getValue('topLevel')).toBe('1.0');
    expect(preset.getValue('stale')).toBeUndefined();
    expect(preset.getValue('nested')).toBeDefined();
  });

  it('handles an empty interface (removes all)', () => {
    const preset = new Preset();
    preset.setValue('a', '1');
    preset.setValue('b', '2');

    const gi = new BSBGraphicInterface();
    preset.synchronizeWithInterface(gi);

    expect(preset.getValuesMap().size).toBe(0);
  });

  it('handles an empty preset (only adds)', () => {
    const preset = new Preset();

    const gi = makeInterface(makeKnob('amp', 0.5), makeCheckBox('on', false));
    preset.synchronizeWithInterface(gi);

    expect(preset.getValuesMap().size).toBe(2);
    expect(preset.getValue('amp')).toBeDefined();
    expect(preset.getValue('on')).toBe('false');
  });

  it('handles text field widgets', () => {
    const preset = new Preset();

    const gi = makeInterface(makeTextField('name', 'hello'));
    preset.synchronizeWithInterface(gi);

    expect(preset.getValue('name')).toBe('hello');
  });
});

describe('PresetGroup.synchronizePresets', () => {
  it('synchronizes all presets in a flat group', () => {
    const group = new PresetGroup();

    const p1 = new Preset();
    p1.setValue('amp', '0.5');
    p1.setValue('stale', '1.0');

    const p2 = new Preset();
    p2.setValue('amp', '0.8');

    group.presets.push(p1, p2);

    const gi = makeInterface(makeKnob('amp', 0.5), makeKnob('freq', 440));
    group.synchronizePresets(gi);

    // p1: stale removed, freq added
    expect(p1.getValue('stale')).toBeUndefined();
    expect(p1.getValue('amp')).toBe('0.5');
    expect(p1.getValue('freq')).toBeDefined();

    // p2: freq added
    expect(p2.getValue('amp')).toBe('0.8');
    expect(p2.getValue('freq')).toBeDefined();
  });

  it('synchronizes presets recursively in nested sub-groups', () => {
    const root = new PresetGroup();
    root.presetGroupName = 'Root';

    const sub = new PresetGroup();
    sub.presetGroupName = 'Sub';

    const rootPreset = new Preset();
    rootPreset.setValue('old', '1');

    const subPreset = new Preset();
    subPreset.setValue('old', '2');

    root.presets.push(rootPreset);
    sub.presets.push(subPreset);
    root.subGroups.push(sub);

    const gi = makeInterface(makeKnob('new', 0.5));
    root.synchronizePresets(gi);

    // Both root and sub preset should have "old" removed and "new" added
    expect(rootPreset.getValue('old')).toBeUndefined();
    expect(rootPreset.getValue('new')).toBeDefined();
    expect(subPreset.getValue('old')).toBeUndefined();
    expect(subPreset.getValue('new')).toBeDefined();
  });

  it('handles deeply nested groups (3 levels)', () => {
    const root = new PresetGroup();
    const mid = new PresetGroup();
    const deep = new PresetGroup();

    const deepPreset = new Preset();
    deepPreset.setValue('gone', '1');

    deep.presets.push(deepPreset);
    mid.subGroups.push(deep);
    root.subGroups.push(mid);

    const gi = makeInterface(makeKnob('alive', 0.5));
    root.synchronizePresets(gi);

    expect(deepPreset.getValue('gone')).toBeUndefined();
    expect(deepPreset.getValue('alive')).toBeDefined();
  });

  it('handles empty preset group tree', () => {
    const root = new PresetGroup();
    const gi = makeInterface(makeKnob('amp', 0.5));

    // Should not throw
    root.synchronizePresets(gi);
  });
});
