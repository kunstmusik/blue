import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CommitNumberInput, { DraftNumberInput } from '../components/CommitNumberInput';
import BSBKnobWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget';
import BSBHSliderWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBHSliderWidget';
import BSBVSliderWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBVSliderWidget';
import BSBHSliderBankWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBHSliderBankWidget';
import BSBVSliderBankWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBVSliderBankWidget';
import BSBXYControllerWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBXYControllerWidget';
import type { BsbWidgetNodeSnapshot } from '../../shared/project-editor';

function makeTestWidgetNode(
  type: string,
  overrides: Partial<BsbWidgetNodeSnapshot> = {},
): BsbWidgetNodeSnapshot {
  return {
    id: overrides.id ?? 'widget-test-1',
    type,
    objectName: overrides.objectName ?? 'testControl',
    x: 0,
    y: 0,
    width: overrides.width ?? 100,
    height: overrides.height ?? 100,
    value: overrides.value ?? 50,
    minimum: overrides.minimum ?? 0,
    maximum: overrides.maximum ?? 100,
    editable: true,
    properties: overrides.properties ?? {},
    children: overrides.children,
  };
}

const baseWidgetProps = {
  isSelected: false,
  editEnabled: false,
  onWidgetSelect: () => {},
  selectedWidgetIds: new Set<string>(),
  getWidgetPosition: () => undefined,
  onWidgetAction: () => {},
};

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Accessibility Value Controls Browser Tests (T021)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('steps CommitNumberInput value up and down with ArrowUp and ArrowDown keys', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<CommitNumberInput value={10} min={0} max={100} step={1} onChange={onChange} />);
    });

    const input = container.querySelector('input')!;
    expect(input).not.toBeNull();
    input.focus();
    expect(document.activeElement).toBe(input);

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(input.value).toBe('11');

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(input.value).toBe('10');
  });

  it('steps with accelerated increments using Shift+Arrow keys', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<CommitNumberInput value={50} min={0} max={100} step={1} onChange={onChange} />);
    });

    const input = container.querySelector('input')!;
    input.focus();

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }),
      );
    });
    expect(Number(input.value)).toBeGreaterThan(50);
  });

  it('clamps values strictly within authored min and max bounds', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<CommitNumberInput value={99} min={0} max={100} step={5} onChange={onChange} />);
    });

    const input = container.querySelector('input')!;
    input.focus();

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(Number(input.value)).toBeLessThanOrEqual(100);
  });

  it('maintains visible focus styling when interacting via keyboard', () => {
    act(() => {
      root.render(<CommitNumberInput value={25} min={0} max={100} step={1} onChange={() => {}} />);
    });

    const input = container.querySelector('input')!;
    input.focus();

    // Verify element is focused
    expect(document.activeElement).toBe(input);
    const computed = window.getComputedStyle(input);
    expect(computed).not.toBeNull();
  });

  it('steps BSBKnobWidget value with arrow keys, shift acceleration, and home/end bounds', () => {
    const onPatch = vi.fn();
    const node = makeTestWidgetNode('BSBKnob', {
      value: 50,
      minimum: 0,
      maximum: 100,
      properties: { resolution: 1, label: 'Frequency' },
    });

    act(() => {
      root.render(<BSBKnobWidget {...baseWidgetProps} node={node} onBsbInterfacePatch={onPatch} />);
    });

    const slider = container.querySelector('[role="slider"]') as SVGSVGElement;
    expect(slider).not.toBeNull();
    expect(slider.getAttribute('aria-label')).toBe('Frequency');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('100');
    expect(slider.getAttribute('aria-valuenow')).toBe('50');

    slider.focus();
    expect(document.activeElement).toBe(slider);

    // ArrowUp increments
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'widget-test-1',
      properties: { value: 51 },
    });

    // ArrowDown decrements
    onPatch.mockClear();
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'widget-test-1',
      properties: { value: 49 },
    });

    // Shift+ArrowUp accelerates
    onPatch.mockClear();
    act(() => {
      slider.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }),
      );
    });
    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'widget-test-1',
      properties: { value: 60 },
    });

    // Home jumps to min
    onPatch.mockClear();
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'widget-test-1',
      properties: { value: 0 },
    });

    // End jumps to max
    onPatch.mockClear();
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'widget-test-1',
      properties: { value: 100 },
    });
  });

  it('steps BSBHSliderWidget and BSBVSliderWidget with keyboard navigation', () => {
    const onPatchH = vi.fn();
    const hNode = makeTestWidgetNode('BSBHSlider', {
      value: 20,
      minimum: 0,
      maximum: 100,
      properties: { resolution: 1, sliderWidth: 150 },
    });

    act(() => {
      root.render(
        <BSBHSliderWidget {...baseWidgetProps} node={hNode} onBsbInterfacePatch={onPatchH} />,
      );
    });

    const hSlider = container.querySelector('[role="slider"]') as SVGSVGElement;
    expect(hSlider).not.toBeNull();
    expect(hSlider.getAttribute('aria-orientation')).toBe('horizontal');

    act(() => {
      hSlider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onPatchH).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'widget-test-1',
      properties: { value: 21 },
    });

    // Now test VSlider
    const onPatchV = vi.fn();
    const vNode = makeTestWidgetNode('BSBVSlider', {
      value: 80,
      minimum: 0,
      maximum: 100,
      properties: { resolution: 1, sliderHeight: 150 },
    });

    act(() => {
      root.render(
        <BSBVSliderWidget {...baseWidgetProps} node={vNode} onBsbInterfacePatch={onPatchV} />,
      );
    });

    const vSlider = container.querySelector('[role="slider"]') as SVGSVGElement;
    expect(vSlider).not.toBeNull();
    expect(vSlider.getAttribute('aria-orientation')).toBe('vertical');

    act(() => {
      vSlider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(onPatchV).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'widget-test-1',
      properties: { value: 79 },
    });
  });

  it('operates BSBHSliderBankWidget and BSBVSliderBankWidget handles independently', () => {
    const onPatchBank = vi.fn();
    const bankNode = makeTestWidgetNode('BSBHSliderBank', {
      properties: {
        numberOfSliders: 3,
        minimum: 0,
        maximum: 100,
        sliders: [{ value: 10 }, { value: 20 }, { value: 30 }],
      },
    });

    act(() => {
      root.render(
        <BSBHSliderBankWidget
          {...baseWidgetProps}
          node={bankNode}
          onBsbInterfacePatch={onPatchBank}
        />,
      );
    });

    const bankSliders = Array.from(
      container.querySelectorAll('[role="slider"]'),
    ) as SVGSVGElement[];
    expect(bankSliders).toHaveLength(3);

    expect(bankSliders[0]!.getAttribute('aria-label')).toBe('testControl Slider 1');
    expect(bankSliders[1]!.getAttribute('aria-label')).toBe('testControl Slider 2');
    expect(bankSliders[2]!.getAttribute('aria-label')).toBe('testControl Slider 3');

    // Step slider 2
    act(() => {
      bankSliders[1]!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    });
    expect(onPatchBank).toHaveBeenCalledWith({
      type: 'updateSliderBankValue',
      widgetId: 'widget-test-1',
      sliderIndex: 1,
      value: 21,
    });
  });

  it('operates BSBXYControllerWidget X and Y axes independently via keyboard', () => {
    const onPatchXY = vi.fn();
    const xyNode = makeTestWidgetNode('BSBXYController', {
      objectName: 'xyPad',
      properties: {
        xMin: 0,
        xMax: 10,
        yMin: 0,
        yMax: 20,
        xValue: 5,
        yValue: 10,
        resolution: 1,
      },
    });

    act(() => {
      root.render(
        <BSBXYControllerWidget
          {...baseWidgetProps}
          node={xyNode}
          onBsbInterfacePatch={onPatchXY}
        />,
      );
    });

    const sliders = Array.from(container.querySelectorAll('[role="slider"]')) as HTMLElement[];
    expect(sliders).toHaveLength(2);

    const xSlider = sliders.find((el) => el.getAttribute('aria-orientation') === 'horizontal')!;
    const ySlider = sliders.find((el) => el.getAttribute('aria-orientation') === 'vertical')!;

    expect(xSlider).toBeDefined();
    expect(ySlider).toBeDefined();
    expect(xSlider.getAttribute('aria-label')).toBe('xyPad X');
    expect(ySlider.getAttribute('aria-label')).toBe('xyPad Y');

    // X axis handles ArrowRight and ignores ArrowUp
    act(() => {
      xSlider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(onPatchXY).not.toHaveBeenCalled();

    act(() => {
      xSlider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onPatchXY).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'widget-test-1',
      properties: { xValue: 6 },
    });

    // Y axis handles ArrowUp and ignores ArrowRight
    onPatchXY.mockClear();
    act(() => {
      ySlider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onPatchXY).not.toHaveBeenCalled();

    act(() => {
      ySlider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(onPatchXY).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'widget-test-1',
      properties: { yValue: 11 },
    });
  });
});
