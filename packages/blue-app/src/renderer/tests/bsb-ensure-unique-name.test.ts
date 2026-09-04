import { describe, it, expect } from 'vitest';
import { ensureUniqueName } from '../../shared/project-editor';
import type { BsbWidgetNodeSnapshot } from '../../shared/project-editor';

function makeSnapshot(
  overrides: Partial<BsbWidgetNodeSnapshot> & { type: string; objectName: string },
): BsbWidgetNodeSnapshot {
  return {
    id: overrides.id ?? 'test-id',
    type: overrides.type,
    objectName: overrides.objectName,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 60,
    height: overrides.height ?? 24,
    value: overrides.value ?? 0,
    minimum: overrides.minimum ?? 0,
    maximum: overrides.maximum ?? 1,
    editable: overrides.editable ?? true,
    properties: overrides.properties ?? {},
    children: overrides.children,
  };
}

describe('ensureUniqueName', () => {
  it('renames a colliding top-level widget', () => {
    const existing = new Set(['slider1']);
    const node = makeSnapshot({ type: 'BSBHSlider', objectName: 'slider1' });
    ensureUniqueName(node, existing);
    expect(node.objectName).toBe('slider2');
    expect(existing.has('slider2')).toBe(true);
  });

  it('does not rename if objectName is unique', () => {
    const existing = new Set(['slider1']);
    const node = makeSnapshot({ type: 'BSBHSlider', objectName: 'slider2' });
    ensureUniqueName(node, existing);
    expect(node.objectName).toBe('slider2');
  });

  it('renames BSBGroup children of all widget types', () => {
    const allTypes = [
      'BSBHSlider',
      'BSBVSlider',
      'BSBKnob',
      'BSBCheckBox',
      'BSBLabel',
      'BSBTextField',
      'BSBDropdown',
      'BSBSubChannelDropdown',
      'BSBValue',
      'BSBXYController',
      'BSBFileSelector',
      'BSBLineObject',
      'BSBHSliderBank',
      'BSBVSliderBank',
    ];
    const existing = new Set([...allTypes.map((t) => t.toLowerCase()), 'bsbgroup']);
    const children = allTypes.map((t) => makeSnapshot({ type: t, objectName: t.toLowerCase() }));
    const group = makeSnapshot({
      type: 'BSBGroup',
      objectName: '',
      children: [...children, makeSnapshot({ type: 'BSBGroup', objectName: 'bsbgroup' })],
    });
    ensureUniqueName(group, existing);
    for (let i = 0; i < allTypes.length; i++) {
      expect(group.children![i].objectName, `${allTypes[i]} should be renamed`).toBe(
        allTypes[i].toLowerCase() + '1',
      );
    }
    expect(group.children![allTypes.length].objectName).toBe('bsbgroup1');
  });

  it('renames children inside nested BSBGroups', () => {
    const existing = new Set(['outer', 'innerSlider', 'innerCheck']);
    const group = makeSnapshot({
      type: 'BSBGroup',
      objectName: '',
      children: [
        makeSnapshot({ type: 'BSBHSlider', objectName: 'outer' }),
        makeSnapshot({
          type: 'BSBGroup',
          objectName: '',
          children: [
            makeSnapshot({ type: 'BSBHSlider', objectName: 'innerSlider' }),
            makeSnapshot({ type: 'BSBCheckBox', objectName: 'innerCheck' }),
          ],
        }),
      ],
    });
    ensureUniqueName(group, existing);
    expect(group.children![0].objectName).toBe('outer1');
    const nested = group.children![1];
    expect(nested.children![0].objectName).toBe('innerSlider1');
    expect(nested.children![1].objectName).toBe('innerCheck1');
  });

  it('handles widgets with empty objectName (skips rename but still processes children)', () => {
    const existing = new Set(['child1']);
    const group = makeSnapshot({
      type: 'BSBGroup',
      objectName: '',
      children: [makeSnapshot({ type: 'BSBHSlider', objectName: 'child1' })],
    });
    ensureUniqueName(group, existing);
    expect(group.objectName).toBe('');
    expect(group.children![0].objectName).toBe('child2');
  });

  it('increments correctly when multiple names collide', () => {
    const existing = new Set(['s', 's1', 's2']);
    const node = makeSnapshot({ type: 'BSBHSlider', objectName: 's' });
    ensureUniqueName(node, existing);
    expect(node.objectName).toBe('s3');
  });

  it('strips all trailing digits to find prefix', () => {
    const existing = new Set(['knob42']);
    const node = makeSnapshot({ type: 'BSBKnob', objectName: 'knob42' });
    ensureUniqueName(node, existing);
    expect(node.objectName).toBe('knob1');
  });

  it('adds unique names of earlier pasted widgets so siblings do not collide', () => {
    const existing = new Set(['x']);
    const group = makeSnapshot({
      type: 'BSBGroup',
      objectName: '',
      children: [
        makeSnapshot({ type: 'BSBHSlider', objectName: 'x' }),
        makeSnapshot({ type: 'BSBVSlider', objectName: 'x' }),
        makeSnapshot({ type: 'BSBCheckBox', objectName: 'x' }),
      ],
    });
    ensureUniqueName(group, existing);
    expect(group.children![0].objectName).toBe('x1');
    expect(group.children![1].objectName).toBe('x2');
    expect(group.children![2].objectName).toBe('x3');
  });

  it('rejects candidate if derived XY keys collide', () => {
    const existing = new Set(['pt', 'pt1X']);
    const node = makeSnapshot({ type: 'BSBXYController', objectName: 'pt' });
    ensureUniqueName(node, existing);
    expect(node.objectName).toBe('pt2');
    expect(existing.has('pt2')).toBe(true);
    expect(existing.has('pt2X')).toBe(true);
    expect(existing.has('pt2Y')).toBe(true);
  });

  it('rejects candidate if derived slider bank keys collide', () => {
    const existing = new Set(['bank', 'bank1_0']);
    const node = makeSnapshot({
      type: 'BSBHSliderBank',
      objectName: 'bank',
      properties: {
        sliders: [{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }],
      },
    });
    ensureUniqueName(node, existing);
    expect(node.objectName).toBe('bank2');
    expect(existing.has('bank2')).toBe(true);
    expect(existing.has('bank2_0')).toBe(true);
    expect(existing.has('bank2_3')).toBe(true);
  });

  it('rejects candidate if derived line object keys collide', () => {
    const existing = new Set(['line', 'line1_freq']);
    const node = makeSnapshot({
      type: 'BSBLineObject',
      objectName: 'line',
      properties: { lines: [{ varName: 'freq' }, { varName: 'amp' }] },
    });
    ensureUniqueName(node, existing);
    expect(node.objectName).toBe('line2');
    expect(existing.has('line2_freq')).toBe(true);
    expect(existing.has('line2_amp')).toBe(true);
  });
});
