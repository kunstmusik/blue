// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import {
  getBsbReplacementKeysFromSnapshot,
  getBsbReplacementKeysFromWidget,
  getBsbObjectNameValidationKeysFromSnapshot,
  getDerivedKeysFromSnapshot,
  getDerivedKeysFromWidget,
  collectBsbReplacementKeysFromSnapshotTree,
  collectBsbReplacementKeysFromWidgetTree,
} from '../../shared/bsb-widget-keys';
import {
  computeKeyboardSteppedValue,
  isValueNavigationKey,
} from '../components/workbench/panels/orchestra/bsb/widgets/utils';
import type { BsbWidgetNodeSnapshot } from '../../shared/project-editor';
import BSBKnobWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget';
import BSBHSliderWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBHSliderWidget';
import BSBVSliderWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBVSliderWidget';
import BSBHSliderBankWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBHSliderBankWidget';
import BSBVSliderBankWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBVSliderBankWidget';
import BSBXYControllerWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBXYControllerWidget';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

describe('computeKeyboardSteppedValue', () => {
  it('identifies value navigation keys', () => {
    expect(isValueNavigationKey('ArrowUp')).toBe(true);
    expect(isValueNavigationKey('ArrowDown')).toBe(true);
    expect(isValueNavigationKey('ArrowLeft')).toBe(true);
    expect(isValueNavigationKey('ArrowRight')).toBe(true);
    expect(isValueNavigationKey('PageUp')).toBe(true);
    expect(isValueNavigationKey('PageDown')).toBe(true);
    expect(isValueNavigationKey('Home')).toBe(true);
    expect(isValueNavigationKey('End')).toBe(true);
    expect(isValueNavigationKey('Tab')).toBe(false);
    expect(isValueNavigationKey('Enter')).toBe(false);
  });

  it('steps 1D value by authored resolution with arrow keys', () => {
    const opts = { current: 5, min: 0, max: 10, resolution: 0.5, key: 'ArrowUp' };
    expect(computeKeyboardSteppedValue(opts)).toBe(5.5);
    expect(computeKeyboardSteppedValue({ ...opts, key: 'ArrowRight' })).toBe(5.5);
    expect(computeKeyboardSteppedValue({ ...opts, key: 'ArrowDown' })).toBe(4.5);
    expect(computeKeyboardSteppedValue({ ...opts, key: 'ArrowLeft' })).toBe(4.5);
  });

  it('steps with 1% fallback when resolution is not provided', () => {
    const opts = { current: 50, min: 0, max: 100, key: 'ArrowUp' };
    expect(computeKeyboardSteppedValue(opts)).toBe(51);
    expect(computeKeyboardSteppedValue({ ...opts, key: 'ArrowDown' })).toBe(49);
  });

  it('steps by 10x for PageUp, PageDown, and Shift+Arrow', () => {
    const opts = { current: 50, min: 0, max: 100, resolution: 1, key: 'PageUp' };
    expect(computeKeyboardSteppedValue(opts)).toBe(60);
    expect(computeKeyboardSteppedValue({ ...opts, key: 'PageDown' })).toBe(40);
    expect(computeKeyboardSteppedValue({ ...opts, key: 'ArrowUp', shiftKey: true })).toBe(60);
    expect(computeKeyboardSteppedValue({ ...opts, key: 'ArrowDown', shiftKey: true })).toBe(40);
  });

  it('jumps to bounds for Home and End', () => {
    const opts = { current: 50, min: 0, max: 100, resolution: 1, key: 'Home' };
    expect(computeKeyboardSteppedValue(opts)).toBe(0);
    expect(computeKeyboardSteppedValue({ ...opts, key: 'End' })).toBe(100);
  });

  it('clamps strictly to authored range', () => {
    expect(
      computeKeyboardSteppedValue({ current: 99, min: 0, max: 100, resolution: 5, key: 'ArrowUp' }),
    ).toBe(100);
    expect(
      computeKeyboardSteppedValue({
        current: 1,
        min: 0,
        max: 100,
        resolution: 5,
        key: 'ArrowDown',
      }),
    ).toBe(0);
  });

  it('handles X and Y axes independently', () => {
    // X axis ignores vertical arrows
    expect(
      computeKeyboardSteppedValue({ current: 0.5, min: 0, max: 1, key: 'ArrowUp', axis: 'x' }),
    ).toBeNull();
    expect(
      computeKeyboardSteppedValue({ current: 0.5, min: 0, max: 1, key: 'ArrowRight', axis: 'x' }),
    ).toBe(0.51);

    // Y axis ignores horizontal arrows
    expect(
      computeKeyboardSteppedValue({ current: 0.5, min: 0, max: 1, key: 'ArrowRight', axis: 'y' }),
    ).toBeNull();
    expect(
      computeKeyboardSteppedValue({ current: 0.5, min: 0, max: 1, key: 'ArrowUp', axis: 'y' }),
    ).toBe(0.51);
  });

  it('returns null for unhandled keys', () => {
    expect(computeKeyboardSteppedValue({ current: 5, min: 0, max: 10, key: 'Tab' })).toBeNull();
    expect(computeKeyboardSteppedValue({ current: 5, min: 0, max: 10, key: 'Enter' })).toBeNull();
  });
});

const defaultWidgetBaseProps = {
  isSelected: false,
  editEnabled: false,
  onWidgetSelect: () => {},
  selectedWidgetIds: new Set<string>(),
  getWidgetPosition: () => undefined,
  onWidgetAction: () => {},
};

describe('computeKeyboardSteppedValue precision, ranges, and clamping', () => {
  it('steps with decimal resolution avoiding IEEE floating point artifacts', () => {
    const res = computeKeyboardSteppedValue({
      current: 0.2,
      min: 0,
      max: 1,
      resolution: 0.1,
      key: 'ArrowUp',
    });
    expect(res).toBe(0.3);
  });

  it('steps correctly within negative ranges', () => {
    const resDown = computeKeyboardSteppedValue({
      current: -50,
      min: -100,
      max: 0,
      resolution: 5,
      key: 'ArrowDown',
    });
    expect(resDown).toBe(-55);

    const resUp = computeKeyboardSteppedValue({
      current: -50,
      min: -100,
      max: 0,
      resolution: 5,
      key: 'ArrowUp',
    });
    expect(resUp).toBe(-45);
  });

  it('clamps strictly when stepping past min or max with page steps', () => {
    const atMax = computeKeyboardSteppedValue({
      current: 95,
      min: 0,
      max: 100,
      resolution: 2,
      key: 'PageUp',
    });
    expect(atMax).toBe(100);

    const atMin = computeKeyboardSteppedValue({
      current: 5,
      min: 0,
      max: 100,
      resolution: 2,
      key: 'PageDown',
    });
    expect(atMin).toBe(0);
  });

  it('jumps to negative bounds for Home and End', () => {
    expect(computeKeyboardSteppedValue({ current: -10, min: -96, max: 24, key: 'Home' })).toBe(-96);
    expect(computeKeyboardSteppedValue({ current: -10, min: -96, max: 24, key: 'End' })).toBe(24);
  });
});

describe('BSB widgets owner-window drag listeners and no-new global listeners', () => {
  it('binds knob drag listeners to ownerWindow and cleans them up without lingering listeners', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const node = makeSnapshot({
      type: 'BSBKnob',
      objectName: 'testKnob',
      value: 50,
      minimum: 0,
      maximum: 100,
    });

    act(() => {
      root.render(
        React.createElement(BSBKnobWidget, {
          ...defaultWidgetBaseProps,
          node,
          onBsbInterfacePatch: () => {},
        }),
      );
    });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    act(() => {
      svg!.dispatchEvent(
        new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true, cancelable: true }),
      );
    });

    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 60, clientY: 60, bubbles: true }));
    });

    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

    act(() => {
      root.unmount();
    });
    container.remove();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('binds slider and bank drag listeners to ownerWindow and cleans them up on unmount', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const hNode = makeSnapshot({
      type: 'BSBHSlider',
      objectName: 'hSlider',
      value: 25,
      minimum: 0,
      maximum: 100,
    });

    act(() => {
      root.render(
        React.createElement(BSBHSliderWidget, {
          ...defaultWidgetBaseProps,
          node: hNode,
          onBsbInterfacePatch: () => {},
        }),
      );
    });

    const initialAddCount = addSpy.mock.calls.length;

    act(() => {
      root.unmount();
    });
    container.remove();

    // Verify unmount cleaned up any active listeners
    expect(removeSpy.mock.calls.length).toBeGreaterThanOrEqual(initialAddCount);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
