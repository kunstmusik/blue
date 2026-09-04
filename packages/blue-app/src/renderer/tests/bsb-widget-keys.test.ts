import { describe, it, expect } from 'vitest';
import {
  getBsbReplacementKeysFromSnapshot,
  getBsbReplacementKeysFromWidget,
  getBsbObjectNameValidationKeysFromSnapshot,
  getDerivedKeysFromSnapshot,
  getDerivedKeysFromWidget,
  collectBsbReplacementKeysFromSnapshotTree,
  collectBsbReplacementKeysFromWidgetTree,
} from '../../shared/bsb-widget-keys';
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

describe('getBsbReplacementKeysFromSnapshot', () => {
  describe('simple widgets return [objectName]', () => {
    const simpleTypes = [
      'BSBHSlider',
      'BSBVSlider',
      'BSBKnob',
      'BSBCheckBox',
      'BSBLabel',
      'BSBTextField',
      'BSBDropdown',
      'BSBSubChannelDropdown',
      'BSBValue',
      'BSBFileSelector',
    ];

    it.each(simpleTypes)('%s returns [objectName]', (type) => {
      const node = makeSnapshot({ type, objectName: 'myWidget' });
      expect(getBsbReplacementKeysFromSnapshot(node)).toEqual(['myWidget']);
    });
  });

  describe('BSBXYController returns only derived keys', () => {
    it('returns [objectNameX, objectNameY] without root objectName', () => {
      const node = makeSnapshot({ type: 'BSBXYController', objectName: 'pad' });
      const keys = getBsbReplacementKeysFromSnapshot(node);
      expect(keys).toEqual(['padX', 'padY']);
      expect(keys).not.toContain('pad');
    });
  });

  describe('BSBHSliderBank returns only derived keys', () => {
    it('returns indexed keys without root objectName', () => {
      const node = makeSnapshot({
        type: 'BSBHSliderBank',
        objectName: 'bank',
        properties: { sliders: [{ value: 0 }, { value: 0 }, { value: 0 }] },
      });
      const keys = getBsbReplacementKeysFromSnapshot(node);
      expect(keys).toEqual(['bank_0', 'bank_1', 'bank_2']);
      expect(keys).not.toContain('bank');
    });

    it('uses numberOfSliders when sliders array absent', () => {
      const node = makeSnapshot({
        type: 'BSBHSliderBank',
        objectName: 's',
        properties: { numberOfSliders: 4 },
      });
      const keys = getBsbReplacementKeysFromSnapshot(node);
      expect(keys).toEqual(['s_0', 's_1', 's_2', 's_3']);
    });
  });

  describe('BSBVSliderBank returns only derived keys', () => {
    it('returns indexed keys without root objectName', () => {
      const node = makeSnapshot({
        type: 'BSBVSliderBank',
        objectName: 'vbank',
        properties: { sliders: [{ value: 0 }, { value: 0 }] },
      });
      const keys = getBsbReplacementKeysFromSnapshot(node);
      expect(keys).toEqual(['vbank_0', 'vbank_1']);
      expect(keys).not.toContain('vbank');
    });
  });

  describe('BSBLineObject returns only derived keys', () => {
    it('returns per-line keys without root objectName', () => {
      const node = makeSnapshot({
        type: 'BSBLineObject',
        objectName: 'env',
        properties: { lines: [{ varName: 'amp' }, { varName: 'freq' }] },
      });
      const keys = getBsbReplacementKeysFromSnapshot(node);
      expect(keys).toEqual(['env_amp', 'env_freq']);
      expect(keys).not.toContain('env');
    });

    it('returns empty when lines array is empty', () => {
      const node = makeSnapshot({
        type: 'BSBLineObject',
        objectName: 'env',
        properties: { lines: [] },
      });
      expect(getBsbReplacementKeysFromSnapshot(node)).toEqual([]);
    });
  });

  it('returns empty array for empty objectName', () => {
    const node = makeSnapshot({ type: 'BSBKnob', objectName: '' });
    expect(getBsbReplacementKeysFromSnapshot(node)).toEqual([]);
  });

  it('returns empty array for whitespace-only objectName', () => {
    const node = makeSnapshot({ type: 'BSBKnob', objectName: '   ' });
    expect(getBsbReplacementKeysFromSnapshot(node)).toEqual([]);
  });
});

describe('getDerivedKeysFromSnapshot', () => {
  it('returns empty for simple widgets', () => {
    const node = makeSnapshot({ type: 'BSBKnob', objectName: 'freq' });
    expect(getDerivedKeysFromSnapshot(node)).toEqual([]);
  });

  it('returns XY derived keys', () => {
    const node = makeSnapshot({ type: 'BSBXYController', objectName: 'pad' });
    expect(getDerivedKeysFromSnapshot(node)).toEqual(['padX', 'padY']);
  });

  it('returns slider bank derived keys', () => {
    const node = makeSnapshot({
      type: 'BSBHSliderBank',
      objectName: 'b',
      properties: { sliders: [{ value: 0 }, { value: 0 }] },
    });
    expect(getDerivedKeysFromSnapshot(node)).toEqual(['b_0', 'b_1']);
  });

  it('returns line object derived keys', () => {
    const node = makeSnapshot({
      type: 'BSBLineObject',
      objectName: 'env',
      properties: { lines: [{ varName: 'amp' }] },
    });
    expect(getDerivedKeysFromSnapshot(node)).toEqual(['env_amp']);
  });
});

describe('getBsbObjectNameValidationKeysFromSnapshot', () => {
  it('uses the raw object name for simple widgets', () => {
    const node = makeSnapshot({ type: 'BSBKnob', objectName: 'freq' });
    expect(getBsbObjectNameValidationKeysFromSnapshot(node, 'freq')).toEqual(['freq']);
  });

  it('uses derived X/Y keys for XY controllers', () => {
    const node = makeSnapshot({ type: 'BSBXYController', objectName: 'pad' });
    expect(getBsbObjectNameValidationKeysFromSnapshot(node, 'pad')).toEqual(['padX', 'padY']);
  });

  it('uses indexed keys for horizontal slider banks', () => {
    const node = makeSnapshot({
      type: 'BSBHSliderBank',
      objectName: 'bank',
      properties: { sliders: [{ value: 0 }, { value: 0 }, { value: 0 }] },
    });
    expect(getBsbObjectNameValidationKeysFromSnapshot(node, 'bank')).toEqual([
      'bank_0',
      'bank_1',
      'bank_2',
    ]);
  });

  it('keeps line-object validation on the raw object name to match Java manual rename behavior', () => {
    const node = makeSnapshot({
      type: 'BSBLineObject',
      objectName: 'env',
      properties: { lines: [{ varName: 'amp' }] },
    });
    expect(getBsbObjectNameValidationKeysFromSnapshot(node, 'env')).toEqual(['env']);
  });
});

describe('getBsbReplacementKeysFromWidget', () => {
  it('returns [objectName] for simple widgets', () => {
    const widget = { type: 'BSBKnob', objectName: 'freq' };
    expect(getBsbReplacementKeysFromWidget(widget)).toEqual(['freq']);
  });

  it('returns only XY derived keys without root name', () => {
    const widget = { type: 'BSBXYController', objectName: 'pad' };
    const keys = getBsbReplacementKeysFromWidget(widget);
    expect(keys).toEqual(['padX', 'padY']);
    expect(keys).not.toContain('pad');
  });

  it('returns only slider bank derived keys without root name', () => {
    const widget = {
      type: 'BSBHSliderBank',
      objectName: 'bank',
      sliders: [{ value: 0 }, { value: 0 }],
    };
    const keys = getBsbReplacementKeysFromWidget(widget);
    expect(keys).toEqual(['bank_0', 'bank_1']);
    expect(keys).not.toContain('bank');
  });

  it('returns only line object derived keys without root name', () => {
    const widget = {
      type: 'BSBLineObject',
      objectName: 'env',
      lines: [{ varName: 'amp' }, { varName: 'freq' }],
    };
    const keys = getBsbReplacementKeysFromWidget(widget);
    expect(keys).toEqual(['env_amp', 'env_freq']);
    expect(keys).not.toContain('env');
  });

  it('falls back to constructor.name when type is absent', () => {
    const widget = { constructor: { name: 'BSBKnob' }, objectName: 'vol' };
    expect(getBsbReplacementKeysFromWidget(widget)).toEqual(['vol']);
  });

  it('falls back to constructor.name for BSBXYController', () => {
    const widget = { constructor: { name: 'BSBXYController' }, objectName: 'xy' };
    expect(getBsbReplacementKeysFromWidget(widget)).toEqual(['xyX', 'xyY']);
  });
});

describe('getDerivedKeysFromWidget', () => {
  it('returns empty for simple widgets', () => {
    const widget = { type: 'BSBKnob', objectName: 'freq' };
    expect(getDerivedKeysFromWidget(widget)).toEqual([]);
  });

  it('returns XY derived keys', () => {
    const widget = { type: 'BSBXYController', objectName: 'pad' };
    expect(getDerivedKeysFromWidget(widget)).toEqual(['padX', 'padY']);
  });

  it('returns line object derived keys via widget.lines', () => {
    const widget = {
      type: 'BSBLineObject',
      objectName: 'env',
      lines: [{ varName: 'amp' }],
    };
    expect(getDerivedKeysFromWidget(widget)).toEqual(['env_amp']);
  });
});

describe('collectBsbReplacementKeysFromSnapshotTree', () => {
  it('collects keys from a flat list of widgets and sorts them', () => {
    const root = makeSnapshot({
      type: 'BSBGroup',
      objectName: '',
      children: [
        makeSnapshot({ type: 'BSBKnob', objectName: 'freq' }),
        makeSnapshot({ type: 'BSBXYController', objectName: 'pad' }),
      ],
    });
    const keys = collectBsbReplacementKeysFromSnapshotTree(root);
    expect(keys).toEqual(['freq', 'padX', 'padY']);
    expect(keys).not.toContain('pad');
  });

  it('collects keys from nested groups', () => {
    const root = makeSnapshot({
      type: 'BSBGroup',
      objectName: '',
      children: [
        makeSnapshot({
          type: 'BSBGroup',
          objectName: '',
          children: [
            makeSnapshot({ type: 'BSBKnob', objectName: 'vol' }),
            makeSnapshot({
              type: 'BSBLineObject',
              objectName: 'env',
              properties: { lines: [{ varName: 'amp' }] },
            }),
          ],
        }),
      ],
    });
    const keys = collectBsbReplacementKeysFromSnapshotTree(root);
    expect(keys).toEqual(['env_amp', 'vol']);
    expect(keys).not.toContain('env');
  });

  it('deduplicates keys', () => {
    const root = makeSnapshot({
      type: 'BSBGroup',
      objectName: '',
      children: [
        makeSnapshot({ type: 'BSBKnob', objectName: 'freq' }),
        makeSnapshot({ type: 'BSBHSlider', objectName: 'freq' }),
      ],
    });
    const keys = collectBsbReplacementKeysFromSnapshotTree(root);
    expect(keys).toEqual(['freq']);
  });

  it('does not include root objectName for multi-key widgets in tree', () => {
    const root = makeSnapshot({
      type: 'BSBGroup',
      objectName: '',
      children: [
        makeSnapshot({
          type: 'BSBHSliderBank',
          objectName: 'bank',
          properties: { sliders: [{ value: 0 }, { value: 0 }] },
        }),
        makeSnapshot({
          type: 'BSBXYController',
          objectName: 'xy',
        }),
        makeSnapshot({
          type: 'BSBLineObject',
          objectName: 'line',
          properties: { lines: [{ varName: 'a' }, { varName: 'b' }] },
        }),
        makeSnapshot({ type: 'BSBKnob', objectName: 'knob' }),
      ],
    });
    const keys = collectBsbReplacementKeysFromSnapshotTree(root);
    expect(keys).toEqual(['bank_0', 'bank_1', 'knob', 'line_a', 'line_b', 'xyX', 'xyY']);
    expect(keys).not.toContain('bank');
    expect(keys).not.toContain('xy');
    expect(keys).not.toContain('line');
  });
});

describe('collectBsbReplacementKeysFromWidgetTree', () => {
  it('walks getChildren and collects keys', () => {
    const child1 = { type: 'BSBKnob', objectName: 'freq' };
    const child2 = { type: 'BSBXYController', objectName: 'pad' };
    const root = {
      type: 'BSBGroup',
      objectName: '',
      getChildren: () => [child1, child2],
    };
    const keys = collectBsbReplacementKeysFromWidgetTree(root);
    expect(keys).toEqual(['freq', 'padX', 'padY']);
    expect(keys).not.toContain('pad');
  });
});
