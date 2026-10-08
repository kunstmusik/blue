// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbInterfacePatch,
  BsbWidgetNodeSnapshot,
} from '../../shared/project-editor';
import BSBInterfaceEditor from '../components/workbench/panels/orchestra/bsb/BSBInterfaceEditor';
import BSBCheckBoxWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBCheckBoxWidget';
import BSBDropdownWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBDropdownWidget';
import BSBHSliderWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBHSliderWidget';
import BSBHSliderBankWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBHSliderBankWidget';
import BSBKnobWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget';
import BSBVSliderWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBVSliderWidget';
import BSBVSliderBankWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBVSliderBankWidget';
import BSBXYControllerWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBXYControllerWidget';
import {
  formatDisplayValue,
  formatValue,
} from '../components/workbench/panels/orchestra/bsb/widgets/ValuePanel';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
});

function makeWidgetNode(
  type: string,
  overrides: Partial<BsbWidgetNodeSnapshot> = {},
): BsbWidgetNodeSnapshot {
  return {
    id: 'widget-1',
    type,
    objectName: 'control',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    value: 0.5,
    minimum: 0,
    maximum: 1,
    editable: true,
    properties: {},
    ...overrides,
  };
}

function makeWidgetProps(onPatch: (patch: BsbInterfacePatch) => void) {
  return {
    isSelected: false,
    editEnabled: false,
    onWidgetSelect: vi.fn(),
    onBsbInterfacePatch: onPatch,
    selectedWidgetIds: new Set<string>(),
    getWidgetPosition: () => undefined,
    onWidgetAction: vi.fn(),
  };
}

function makeInstrument(children: BsbWidgetNodeSnapshot[]): BlueSynthBuilderInstrumentSnapshot {
  return {
    assignmentId: 'bsb-ui-test',
    type: 'blueSynthBuilder',
    name: 'BSB UI Test',
    enabled: true,
    comment: '',
    instrumentText: 'aout oscili <control>, 440',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: children.flatMap((child) =>
      child.type === 'BSBXYController'
        ? [`${child.objectName}X`, `${child.objectName}Y`]
        : [child.objectName],
    ),
    widgets: children.map((child) => ({
      objectName: child.objectName,
      widgetType: child.type,
      value: child.value,
      minimum: child.minimum,
      maximum: child.maximum,
    })),
    editEnabled: false,
    gridSettings: {
      enabled: false,
      snapEnabled: false,
      width: 10,
      height: 10,
      gridStyle: 'NONE',
    },
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
      children,
    },
  };
}

describe('BSB parameter controls', () => {
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
    document
      .querySelectorAll('[data-radix-popper-content-wrapper]')
      .forEach((node) => node.remove());
  });

  const scalarCases = [
    {
      name: 'horizontal slider',
      render: (onPatch: (patch: BsbInterfacePatch) => void) => (
        <BSBHSliderWidget
          {...makeWidgetProps(onPatch)}
          node={makeWidgetNode('BSBHSlider', {
            id: 'h-slider',
            objectName: 'cutoff',
            properties: { resolution: 0.01, sliderWidth: 150 },
          })}
        />
      ),
      key: 'ArrowRight',
      widgetId: 'h-slider',
    },
    {
      name: 'vertical slider',
      render: (onPatch: (patch: BsbInterfacePatch) => void) => (
        <BSBVSliderWidget
          {...makeWidgetProps(onPatch)}
          node={makeWidgetNode('BSBVSlider', {
            id: 'v-slider',
            objectName: 'depth',
            properties: { resolution: 0.01, sliderHeight: 150 },
          })}
        />
      ),
      key: 'ArrowUp',
      widgetId: 'v-slider',
    },
    {
      name: 'knob',
      render: (onPatch: (patch: BsbInterfacePatch) => void) => (
        <BSBKnobWidget
          {...makeWidgetProps(onPatch)}
          node={makeWidgetNode('BSBKnob', {
            id: 'knob',
            objectName: 'gain',
            properties: { resolution: 0.01 },
          })}
        />
      ),
      key: 'ArrowUp',
      widgetId: 'knob',
    },
  ] as const;

  it.each(scalarCases)('emits a durable value patch for the $name', ({ render, key, widgetId }) => {
    const onPatch = vi.fn();
    act(() => root.render(render(onPatch)));

    const slider = container.querySelector('[role="slider"]');
    expect(slider).not.toBeNull();
    act(() => {
      slider!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId,
      properties: { value: 0.51 },
    });
  });

  it('emits the selected state when a checkbox is clicked', () => {
    const onPatch = vi.fn();
    const node = makeWidgetNode('BSBCheckBox', {
      id: 'checkbox',
      objectName: 'gate',
      properties: { selected: false, label: 'Gate' },
    });
    act(() => root.render(<BSBCheckBoxWidget {...makeWidgetProps(onPatch)} node={node} />));

    const checkboxIcon = container.querySelector('[data-widget-id="checkbox"] svg');
    expect(checkboxIcon).not.toBeNull();
    act(() => {
      checkboxIcon!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'checkbox',
      properties: { selected: true },
    });
  });

  it('emits the selected index when a dropdown item is chosen', async () => {
    const onPatch = vi.fn();
    const node = makeWidgetNode('BSBDropdown', {
      id: 'dropdown',
      objectName: 'mode',
      properties: {
        selectedIndex: 0,
        dropdownItems: [
          { name: 'Sine', value: 'sine', uniqueId: 'sine' },
          { name: 'Noise', value: 'noise', uniqueId: 'noise' },
        ],
      },
    });
    act(() => root.render(<BSBDropdownWidget {...makeWidgetProps(onPatch)} node={node} />));

    const trigger = container.querySelector('[data-widget-id="dropdown"] button');
    expect(trigger).not.toBeNull();
    await act(async () => {
      trigger!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      trigger!.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      await Promise.resolve();
    });

    const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((candidate) =>
      candidate.textContent?.includes('Noise'),
    );
    expect(item).not.toBeUndefined();
    await act(async () => {
      item!.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      await Promise.resolve();
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateWidgetProperties',
      widgetId: 'dropdown',
      properties: { selectedIndex: 1 },
    });
  });

  it('emits independent X and Y patches for an XY controller', () => {
    const onPatch = vi.fn();
    const node = makeWidgetNode('BSBXYController', {
      id: 'xy',
      objectName: 'pad',
      properties: {
        xValue: 0.5,
        yValue: 0.5,
        xMin: 0,
        xMax: 1,
        yMin: 0,
        yMax: 1,
        resolution: 0.01,
      },
    });
    act(() => root.render(<BSBXYControllerWidget {...makeWidgetProps(onPatch)} node={node} />));

    const xSlider = container.querySelector('[role="slider"][aria-label="pad X"]');
    const ySlider = container.querySelector('[role="slider"][aria-label="pad Y"]');
    expect(xSlider).not.toBeNull();
    expect(ySlider).not.toBeNull();

    act(() => {
      xSlider!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      ySlider!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });

    expect(onPatch).toHaveBeenNthCalledWith(1, {
      type: 'updateWidgetProperties',
      widgetId: 'xy',
      properties: { xValue: 0.51 },
    });
    expect(onPatch).toHaveBeenNthCalledWith(2, {
      type: 'updateWidgetProperties',
      widgetId: 'xy',
      properties: { yValue: 0.51 },
    });
  });

  const bankCases = [
    {
      name: 'horizontal slider bank',
      render: (onPatch: (patch: BsbInterfacePatch) => void) => (
        <BSBHSliderBankWidget
          {...makeWidgetProps(onPatch)}
          node={makeWidgetNode('BSBHSliderBank', {
            id: 'h-bank',
            objectName: 'harmonics',
            properties: {
              numberOfSliders: 2,
              minimum: 0,
              maximum: 1,
              resolution: 0.01,
              sliders: [{ value: 0.25 }, { value: 0.5 }],
            },
          })}
        />
      ),
      key: 'ArrowRight',
      widgetId: 'h-bank',
    },
    {
      name: 'vertical slider bank',
      render: (onPatch: (patch: BsbInterfacePatch) => void) => (
        <BSBVSliderBankWidget
          {...makeWidgetProps(onPatch)}
          node={makeWidgetNode('BSBVSliderBank', {
            id: 'v-bank',
            objectName: 'partials',
            properties: {
              numberOfSliders: 2,
              minimum: 0,
              maximum: 1,
              resolution: 0.01,
              sliders: [{ value: 0.25 }, { value: 0.5 }],
            },
          })}
        />
      ),
      key: 'ArrowUp',
      widgetId: 'v-bank',
    },
  ] as const;

  it.each(bankCases)('emits an indexed patch for the $name', ({ render, key, widgetId }) => {
    const onPatch = vi.fn();
    act(() => root.render(render(onPatch)));

    const sliders = container.querySelectorAll('[role="slider"]');
    expect(sliders).toHaveLength(2);
    act(() => {
      sliders[1]!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateSliderBankValue',
      widgetId,
      sliderIndex: 1,
      value: 0.51,
    });
  });

  it('uses the production BSB editor envelope for a runtime slider edit', () => {
    const onInstrumentPatch = vi.fn();
    const node = makeWidgetNode('BSBHSlider', {
      id: 'production-slider',
      objectName: 'cutoff',
      properties: { resolution: 0.01, sliderWidth: 150 },
    });
    act(() => {
      root.render(
        <BSBInterfaceEditor
          instrument={makeInstrument([node])}
          onInstrumentPatch={onInstrumentPatch}
          showEditModeToggle={false}
        />,
      );
    });

    const slider = container.querySelector('[data-widget-id="production-slider"] [role="slider"]');
    expect(slider).not.toBeNull();
    act(() => {
      slider!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(onInstrumentPatch).toHaveBeenCalledWith(
      {
        bsbInterface: {
          type: 'updateWidgetProperties',
          widgetId: 'production-slider',
          properties: { value: 0.51 },
        },
      },
      { phase: 'single', label: 'Edit Blue Synth Builder Widget' },
    );
  });

  describe('resolution snapping on sliders and slider banks', () => {
    function setInputValue(input: HTMLInputElement, val: string) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    it('formatValue formats values cleanly without IEEE-754 noise or trailing zeroes', () => {
      expect(formatValue(5)).toBe('5');
      expect(formatValue(1.7000000000000002)).toBe('1.7');
      expect(formatValue(0.25)).toBe('0.25');
      expect(formatValue(0)).toBe('0');
      expect(formatValue(-0)).toBe('0');
    });

    it('BSBHSliderWidget snaps mouse drag to resolution', () => {
      const onPatch = vi.fn();
      const node = makeWidgetNode('BSBHSlider', {
        id: 'h-slider',
        minimum: 0,
        maximum: 10,
        value: 0,
        properties: { resolution: 1, sliderWidth: 150 },
      });
      act(() => root.render(<BSBHSliderWidget {...makeWidgetProps(onPatch)} node={node} />));

      const svg = container.querySelector('[role="slider"]') as SVGSVGElement;
      expect(svg).not.toBeNull();
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 150, height: 20 }) as DOMRect;

      // mousedown at x=80: (80-7)/(150-14) = 73/136 = 0.5367... -> raw 5.367... -> snapped 5
      act(() => {
        svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 80, bubbles: true }));
      });
      expect(onPatch).toHaveBeenCalledWith({
        type: 'updateWidgetProperties',
        widgetId: 'h-slider',
        properties: { value: 5 },
      });

      // mousemove to x=95: (95-7)/136 = 88/136 = 0.647... -> raw 6.47... -> snapped 6
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 95 }));
      });
      expect(onPatch).toHaveBeenCalledWith({
        type: 'updateWidgetProperties',
        widgetId: 'h-slider',
        properties: { value: 6 },
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });
    });

    it('BSBVSliderWidget snaps mouse drag to resolution', () => {
      const onPatch = vi.fn();
      const node = makeWidgetNode('BSBVSlider', {
        id: 'v-slider',
        minimum: 0,
        maximum: 10,
        value: 0,
        properties: { resolution: 1, sliderHeight: 150 },
      });
      act(() => root.render(<BSBVSliderWidget {...makeWidgetProps(onPatch)} node={node} />));

      const svg = container.querySelector('[role="slider"]') as SVGSVGElement;
      expect(svg).not.toBeNull();
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 50, height: 150 }) as DOMRect;

      // mousedown at y=80: 1 - (80-7)/136 = 1 - 0.5367... = 0.4632... -> raw 4.632... -> snapped 5
      act(() => {
        svg.dispatchEvent(new MouseEvent('mousedown', { clientY: 80, bubbles: true }));
      });
      expect(onPatch).toHaveBeenCalledWith({
        type: 'updateWidgetProperties',
        widgetId: 'v-slider',
        properties: { value: 5 },
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });
    });

    it('BSBHSliderBankWidget snaps mouse drag to resolution', () => {
      const onPatch = vi.fn();
      const node = makeWidgetNode('BSBHSliderBank', {
        id: 'h-bank',
        minimum: 0,
        maximum: 10,
        properties: {
          numberOfSliders: 2,
          resolution: 1,
          sliderWidth: 150,
          sliders: [{ value: 0 }, { value: 0 }],
        },
      });
      act(() => root.render(<BSBHSliderBankWidget {...makeWidgetProps(onPatch)} node={node} />));

      const sliders = container.querySelectorAll('[role="slider"]');
      const svg = sliders[0] as SVGSVGElement;
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 150, height: 20 }) as DOMRect;

      act(() => {
        svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 80, bubbles: true }));
      });
      expect(onPatch).toHaveBeenCalledWith({
        type: 'updateSliderBankValue',
        widgetId: 'h-bank',
        sliderIndex: 0,
        value: 5,
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });
    });

    it('BSBVSliderBankWidget snaps mouse drag to resolution', () => {
      const onPatch = vi.fn();
      const node = makeWidgetNode('BSBVSliderBank', {
        id: 'v-bank',
        minimum: 0,
        maximum: 10,
        properties: {
          numberOfSliders: 2,
          resolution: 1,
          sliderHeight: 150,
          sliders: [{ value: 0 }, { value: 0 }],
        },
      });
      act(() => root.render(<BSBVSliderBankWidget {...makeWidgetProps(onPatch)} node={node} />));

      const sliders = container.querySelectorAll('[role="slider"]');
      const svg = sliders[1] as SVGSVGElement;
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 50, height: 150 }) as DOMRect;

      act(() => {
        svg.dispatchEvent(new MouseEvent('mousedown', { clientY: 80, bubbles: true }));
      });
      expect(onPatch).toHaveBeenCalledWith({
        type: 'updateSliderBankValue',
        widgetId: 'v-bank',
        sliderIndex: 1,
        value: 5,
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });
    });

    it('ValuePanel onCommit snaps input values to resolution across all slider widgets', () => {
      const onPatch = vi.fn();

      // 1. BSBHSliderWidget
      const hNode = makeWidgetNode('BSBHSlider', {
        id: 'h-val',
        minimum: 0,
        maximum: 10,
        value: 2,
        properties: { resolution: 1, valueDisplayEnabled: true },
      });
      act(() => root.render(<BSBHSliderWidget {...makeWidgetProps(onPatch)} node={hNode} />));

      const hValuePanelSvg = container.querySelector('svg:not([role="slider"])');
      expect(hValuePanelSvg).not.toBeNull();
      act(() => {
        hValuePanelSvg!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      });
      let input = container.querySelector('input');
      expect(input).not.toBeNull();
      act(() => {
        setInputValue(input!, '3.7');
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      expect(onPatch).toHaveBeenCalledWith({
        type: 'updateWidgetProperties',
        widgetId: 'h-val',
        properties: { value: 4 },
      });

      // 2. BSBVSliderWidget
      onPatch.mockClear();
      const vNode = makeWidgetNode('BSBVSlider', {
        id: 'v-val',
        minimum: 0,
        maximum: 10,
        value: 2,
        properties: { resolution: 0.5, valueDisplayEnabled: true },
      });
      act(() => root.render(<BSBVSliderWidget {...makeWidgetProps(onPatch)} node={vNode} />));

      const vValuePanelSvg = container.querySelector('svg:not([role="slider"])');
      act(() => {
        vValuePanelSvg!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      });
      input = container.querySelector('input');
      act(() => {
        setInputValue(input!, '6.2');
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      expect(onPatch).toHaveBeenCalledWith({
        type: 'updateWidgetProperties',
        widgetId: 'v-val',
        properties: { value: 6 },
      });

      // 3. BSBHSliderBankWidget
      onPatch.mockClear();
      const hBankNode = makeWidgetNode('BSBHSliderBank', {
        id: 'h-bank-val',
        minimum: 0,
        maximum: 10,
        properties: {
          numberOfSliders: 2,
          resolution: 1,
          valueDisplayEnabled: true,
          sliders: [{ value: 0 }, { value: 0 }],
        },
      });
      act(() =>
        root.render(<BSBHSliderBankWidget {...makeWidgetProps(onPatch)} node={hBankNode} />),
      );

      const hBankValuePanelSvgs = container.querySelectorAll('svg:not([role="slider"])');
      act(() => {
        hBankValuePanelSvgs[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      });
      input = container.querySelector('input');
      act(() => {
        setInputValue(input!, '2.8');
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      expect(onPatch).toHaveBeenCalledWith({
        type: 'updateSliderBankValue',
        widgetId: 'h-bank-val',
        sliderIndex: 0,
        value: 3,
      });

      // 4. BSBVSliderBankWidget
      onPatch.mockClear();
      const vBankNode = makeWidgetNode('BSBVSliderBank', {
        id: 'v-bank-val',
        minimum: 0,
        maximum: 10,
        properties: {
          numberOfSliders: 2,
          resolution: 1,
          valueDisplayEnabled: true,
          sliders: [{ value: 0 }, { value: 0 }],
        },
      });
      act(() =>
        root.render(<BSBVSliderBankWidget {...makeWidgetProps(onPatch)} node={vBankNode} />),
      );

      const vBankValuePanelSvgs = container.querySelectorAll('svg:not([role="slider"])');
      act(() => {
        vBankValuePanelSvgs[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      });
      input = container.querySelector('input');
      act(() => {
        setInputValue(input!, '7.1');
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      expect(onPatch).toHaveBeenCalledWith({
        type: 'updateSliderBankValue',
        widgetId: 'v-bank-val',
        sliderIndex: 1,
        value: 7,
      });
    });

    it('keeps full numeric text in the tooltip and editor while displaying six characters', () => {
      const onPatch = vi.fn();
      const value = 0.0000001;
      const fullValue = formatValue(value);
      const node = makeWidgetNode('BSBHSlider', {
        id: 'precision-slider',
        value,
        properties: { resolution: 0.0000001, valueDisplayEnabled: true },
      });

      act(() => root.render(<BSBHSliderWidget {...makeWidgetProps(onPatch)} node={node} />));

      const valuePanel = container.querySelector('svg:not([role="slider"])');
      expect(valuePanel?.querySelector('text')?.textContent).toBe(formatDisplayValue(fullValue));
      expect(valuePanel?.querySelector('title')?.textContent).toBe(fullValue);
      expect(container.querySelector('[role="slider"]')?.getAttribute('aria-valuetext')).toBe(
        fullValue,
      );

      act(() => {
        valuePanel?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      });
      expect((container.querySelector('input') as HTMLInputElement | null)?.value).toBe(fullValue);
    });
  });
});
