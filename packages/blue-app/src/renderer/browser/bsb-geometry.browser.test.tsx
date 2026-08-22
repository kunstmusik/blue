import React, { useCallback, useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbInterfacePatch,
  BsbWidgetNodeSnapshot,
} from '../../shared/project-editor';
import { createDefaultBsbWidgetSnapshot } from '../../shared/project-editor';
import BSBInterfaceCanvas from '../components/workbench/panels/orchestra/bsb/BSBInterfaceCanvas';
import { getWidgetDisplaySize } from '../components/workbench/panels/orchestra/bsb/widgets/utils';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type WidgetSummary = BlueSynthBuilderInstrumentSnapshot['widgets'][number];

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  if (value === undefined) {
    return value as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeWidgetNode(
  type: string,
  overrides: Partial<BsbWidgetNodeSnapshot> = {},
): BsbWidgetNodeSnapshot {
  const snapshot = createDefaultBsbWidgetSnapshot(type);
  if (!snapshot) {
    throw new Error(`Unable to create widget snapshot for ${type}`);
  }

  return {
    ...clone(snapshot),
    ...overrides,
    properties: {
      ...clone(snapshot.properties),
      ...clone(overrides.properties ?? {}),
    },
    children: overrides.children ? clone(overrides.children) : clone(snapshot.children),
  };
}

function collectObjectNames(node: BsbWidgetNodeSnapshot): string[] {
  const names = new Set<string>();
  const visit = (current: BsbWidgetNodeSnapshot): void => {
    if (current.objectName) {
      names.add(current.objectName);
    }
    current.children?.forEach(visit);
  };

  visit(node);
  return [...names].sort((left, right) => left.localeCompare(right));
}

function collectWidgetSummaries(node: BsbWidgetNodeSnapshot): WidgetSummary[] {
  const widgets: WidgetSummary[] = [];
  const visit = (current: BsbWidgetNodeSnapshot): void => {
    if (current.objectName) {
      widgets.push({
        objectName: current.objectName,
        widgetType: current.type,
        value: current.value,
        minimum: current.minimum,
        maximum: current.maximum,
      });
    }
    current.children?.forEach(visit);
  };

  visit(node);
  return widgets;
}

function makeInstrument(widgetTree: BsbWidgetNodeSnapshot): BlueSynthBuilderInstrumentSnapshot {
  const tree = clone(widgetTree);
  return {
    assignmentId: '1',
    type: 'blueSynthBuilder',
    name: 'Geometry Test',
    enabled: true,
    comment: '',
    instrumentText: 'aout oscili <amp>, <freq>',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: collectObjectNames(tree),
    widgets: collectWidgetSummaries(tree),
    editEnabled: true,
    gridSettings: { enabled: true, snapEnabled: false, width: 10, height: 10, gridStyle: 'NONE' },
    widgetTree: tree,
  };
}

function makeRoot(children: BsbWidgetNodeSnapshot[]): BsbWidgetNodeSnapshot {
  return {
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
    children: clone(children),
  };
}

function updateWidgetById(
  node: BsbWidgetNodeSnapshot,
  widgetId: string,
  updater: (target: BsbWidgetNodeSnapshot) => void,
): boolean {
  if (node.id === widgetId) {
    updater(node);
    return true;
  }

  for (const child of node.children ?? []) {
    if (updateWidgetById(child, widgetId, updater)) {
      return true;
    }
  }

  return false;
}

function removeWidgetById(node: BsbWidgetNodeSnapshot, widgetId: string): boolean {
  if (!node.children) {
    return false;
  }

  const index = node.children.findIndex((child) => child.id === widgetId);
  if (index >= 0) {
    node.children.splice(index, 1);
    return true;
  }

  for (const child of node.children) {
    if (removeWidgetById(child, widgetId)) {
      return true;
    }
  }

  return false;
}

function syncWidgetSize(node: BsbWidgetNodeSnapshot): void {
  const size = getWidgetDisplaySize(node);
  node.width = size.width;
  node.height = size.height;
}

function applyPatchToInstrument(
  instrument: BlueSynthBuilderInstrumentSnapshot,
  patch: BsbInterfacePatch,
): BlueSynthBuilderInstrumentSnapshot {
  const next = clone(instrument);

  switch (patch.type) {
    case 'selectWidget':
    case 'setEditEnabled':
    case 'updateGridSettings':
    case 'applyPreset':
    case 'updatePreset':
    case 'addPreset':
    case 'addPresetGroup':
    case 'addPresetFromSnapshot':
    case 'addPresetGroupFromSnapshot':
    case 'renamePreset':
    case 'renamePresetGroup':
    case 'removePreset':
    case 'removePresetGroup':
    case 'movePreset':
    case 'movePresetGroup':
    case 'synchronizePresets':
    case 'updateEmbeddedOpcodeList':
    case 'addUdo':
    case 'removeUdo':
    case 'updateUdo':
    case 'convertUdoStyle':
    case 'reorderUdo':
    case 'randomize':
    case 'makeGroup':
    case 'breakGroup':
    case 'pasteWidgets':
      return next;
    case 'moveWidget': {
      updateWidgetById(next.widgetTree, patch.widgetId, (node) => {
        node.x = patch.x;
        node.y = patch.y;
      });
      return next;
    }
    case 'resizeWidget': {
      updateWidgetById(next.widgetTree, patch.widgetId, (node) => {
        node.width = patch.width;
        node.height = patch.height;
      });
      return next;
    }
    case 'removeWidget': {
      removeWidgetById(next.widgetTree, patch.widgetId);
      next.objectNames = collectObjectNames(next.widgetTree);
      next.widgets = collectWidgetSummaries(next.widgetTree);
      return next;
    }
    case 'updateSliderBankValue': {
      updateWidgetById(next.widgetTree, patch.widgetId, (node) => {
        const sliders = Array.isArray(node.properties.sliders)
          ? clone(node.properties.sliders as Array<{ value?: number }>)
          : [];
        if (patch.sliderIndex >= 0 && patch.sliderIndex < sliders.length) {
          sliders[patch.sliderIndex] = {
            ...sliders[patch.sliderIndex],
            value: patch.value,
          };
        }
        node.properties.sliders = sliders;
        syncWidgetSize(node);
      });
      next.widgets = collectWidgetSummaries(next.widgetTree);
      return next;
    }
    case 'updateWidgetProperties': {
      updateWidgetById(next.widgetTree, patch.widgetId, (node) => {
        for (const [key, rawValue] of Object.entries(patch.properties)) {
          const value = clone(rawValue);
          switch (key) {
            case 'objectName':
              node.objectName = String(value);
              break;
            case 'x':
              node.x = Number(value);
              break;
            case 'y':
              node.y = Number(value);
              break;
            case 'width':
              node.width = Number(value);
              node.properties.width = Number(value);
              break;
            case 'height':
              node.height = Number(value);
              node.properties.height = Number(value);
              break;
            case 'value':
              node.value = Number(value);
              break;
            case 'minimum':
              node.minimum = Number(value);
              break;
            case 'maximum':
              node.maximum = Number(value);
              break;
            case 'knobWidth':
            case 'canvasWidth':
            case 'canvasHeight':
            case 'textFieldWidth':
            case 'sliderWidth':
            case 'sliderHeight':
            case 'numberOfSliders':
            case 'valueDisplayEnabled':
            case 'gap':
            case 'dropdownItems':
            case 'sliders':
              node.properties[key] = value;
              break;
            default:
              node.properties[key] = value;
              break;
          }
        }
        if (patch.properties.sliderWidth !== undefined || patch.properties.sliderHeight !== undefined) {
          const size = getWidgetDisplaySize(node);
          node.width = size.width;
          node.height = size.height;
          return;
        }
        syncWidgetSize(node);
      });
      next.widgets = collectWidgetSummaries(next.widgetTree);
      return next;
    }
    default:
      return next;
  }
}

function makeHarness(initialInstrument: BlueSynthBuilderInstrumentSnapshot): React.ReactElement {
  function Harness(): React.ReactElement {
    const [instrument, setInstrument] = useState(() => clone(initialInstrument));
    const [selectedWidgetIds, setSelectedWidgetIds] = useState<Set<string>>(() => new Set());

    const handleWidgetSelect = useCallback((widgetId: string | null, shiftKey = false) => {
      setSelectedWidgetIds((current) => {
        if (widgetId === null) {
          return new Set();
        }
        if (!shiftKey) {
          return new Set([widgetId]);
        }
        const next = new Set(current);
        if (next.has(widgetId)) {
          next.delete(widgetId);
        } else {
          next.add(widgetId);
        }
        return next;
      });
    }, []);

    const handlePatch = useCallback((patch: BsbInterfacePatch) => {
      setInstrument((current) => applyPatchToInstrument(current, patch));
    }, []);

    return (
      <div style={{ width: '1280px', height: '960px' }}>
        <BSBInterfaceCanvas
          instrument={instrument}
          selectedWidgetIds={selectedWidgetIds}
          editEnabled
          onWidgetSelect={handleWidgetSelect}
          onBsbInterfacePatch={handlePatch}
          onInstrumentPatch={() => undefined}
        />
      </div>
    );
  }

  return <Harness />;
}

function mount(element: React.ReactElement): { container: HTMLDivElement; root: Root; unmount: () => void } {
  const container = document.createElement('div');
  container.style.width = '1280px';
  container.style.height = '960px';
  container.style.margin = '0';
  document.body.appendChild(container);

  const root = createRoot(container);
  act(() => {
    root.render(element);
  });

  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function getCanvasInner(container: HTMLDivElement): HTMLDivElement {
  const scroll = container.querySelector('[data-shortcut-scope="bsb-interface-canvas"]');
  if (!scroll) {
    throw new Error('Unable to find the BSB canvas scroll container');
  }
  const inner = scroll.firstElementChild;
  if (!(inner instanceof HTMLDivElement)) {
    throw new Error('Unable to find the BSB canvas inner container');
  }
  return inner;
}

function getWidgetElement(container: HTMLDivElement, widgetId: string): HTMLDivElement {
  const element = container.querySelector(`[data-widget-id="${widgetId}"]`);
  if (!(element instanceof HTMLDivElement)) {
    throw new Error(`Unable to find widget ${widgetId}`);
  }
  return element;
}

function dispatchMouse(target: EventTarget, type: string, init: MouseEventInit = {}): void {
  target.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    buttons: type === 'mouseup' ? 0 : 1,
    ...init,
  }));
}

async function flushFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.style.margin = '0';
});

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.margin = '';
});

describe('BSB browser geometry', () => {
  it('renders widget bounds from the shared display-size helpers', async () => {
    const knob = makeWidgetNode('BSBKnob', {
      id: 'knob',
      objectName: 'superGain',
      x: 20,
      y: 24,
      properties: {
        labelEnabled: true,
        label: 'Super Long Knob Label',
        'labelFont.size': 12,
      },
    });
    const xy = makeWidgetNode('BSBXYController', {
      id: 'xy',
      objectName: 'pad',
      x: 240,
      y: 24,
      properties: {
        valueDisplayEnabled: true,
        width: 120,
        height: 88,
      },
    });

    const instrument = makeInstrument(makeRoot([knob, xy]));
    const rendered = mount(makeHarness(instrument));

    try {
      await act(async () => {
        await flushFrame();
      });

      const knobElement = getWidgetElement(rendered.container, 'knob');
      const xyElement = getWidgetElement(rendered.container, 'xy');

      const knobRect = knobElement.getBoundingClientRect();
      const xyRect = xyElement.getBoundingClientRect();

      const expectedKnob = getWidgetDisplaySize(knob);
      const expectedXy = getWidgetDisplaySize(xy);

      expect(Math.round(knobRect.width)).toBe(Math.round(expectedKnob.width));
      expect(Math.round(knobRect.height)).toBe(Math.round(expectedKnob.height));
      expect(Math.round(xyRect.width)).toBe(Math.round(expectedXy.width));
      expect(Math.round(xyRect.height)).toBe(Math.round(expectedXy.height));
    } finally {
      rendered.unmount();
    }
  });

  it('shows resize handles for the representative editable widget types', async () => {
    const widgets = [
      makeWidgetNode('BSBKnob', { id: 'knob', objectName: 'gain', x: 20, y: 24, properties: { labelEnabled: true } }),
      makeWidgetNode('BSBXYController', { id: 'xy', objectName: 'pad', x: 180, y: 24, properties: { valueDisplayEnabled: true } }),
      makeWidgetNode('BSBLineObject', {
        id: 'line',
        objectName: 'curve',
        x: 20,
        y: 180,
        properties: {
          canvasWidth: 200,
          canvasHeight: 120,
          lines: [
            {
              varName: 'amp',
              min: 0,
              max: 1,
              color: '#ff0000',
              points: [{ x: 0, y: 0.2 }, { x: 1, y: 0.8 }],
            },
          ],
        },
      }),
    ];
    const rendered = mount(makeHarness(makeInstrument(makeRoot(widgets))));

    try {
      await act(async () => {
        await flushFrame();
      });

      for (const widgetId of ['knob', 'xy', 'line']) {
        const widget = getWidgetElement(rendered.container, widgetId);
        await act(async () => {
          widget.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0,
          }));
        });

        const handles = Array.from(rendered.container.querySelectorAll('[data-resize-edge]')) as HTMLDivElement[];
        expect(handles.length).toBeGreaterThan(0);
        const edges = handles.map((handle) => handle.getAttribute('data-resize-edge'));
        expect(edges).toEqual(expect.arrayContaining(['right', 'bottom']));
      }
    } finally {
      rendered.unmount();
    }
  });

  it('selects intersecting widgets with marquee bounds based on measured size', async () => {
    const knob = makeWidgetNode('BSBKnob', {
      id: 'knob',
      objectName: 'gain',
      x: 24,
      y: 24,
      properties: { labelEnabled: true, label: 'Gain' },
    });
    const slider = makeWidgetNode('BSBHSlider', {
      id: 'slider',
      objectName: 'freq',
      x: 210,
      y: 28,
      properties: { sliderWidth: 150, valueDisplayEnabled: true },
    });
    const xy = makeWidgetNode('BSBXYController', {
      id: 'xy',
      objectName: 'pad',
      x: 24,
      y: 180,
      properties: { valueDisplayEnabled: true },
    });
    const rendered = mount(makeHarness(makeInstrument(makeRoot([knob, slider, xy]))));

    try {
      await act(async () => {
        await flushFrame();
      });

      const canvasInner = getCanvasInner(rendered.container);
      const knobRect = getWidgetElement(rendered.container, 'knob').getBoundingClientRect();
      const sliderRect = getWidgetElement(rendered.container, 'slider').getBoundingClientRect();

      await act(async () => {
        dispatchMouse(canvasInner, 'mousedown', {
          clientX: 4,
          clientY: 4,
        });
        await flushFrame();
        dispatchMouse(canvasInner, 'mousemove', {
          clientX: Math.max(knobRect.right, sliderRect.right) + 20,
          clientY: Math.max(knobRect.bottom, sliderRect.bottom) + 20,
        });
        await flushFrame();
        dispatchMouse(canvasInner, 'mouseup', {
          clientX: Math.max(knobRect.right, sliderRect.right) + 20,
          clientY: Math.max(knobRect.bottom, sliderRect.bottom) + 20,
        });
        await flushFrame();
      });

      expect(getWidgetElement(rendered.container, 'knob').className).toContain('ring-2');
      expect(getWidgetElement(rendered.container, 'slider').className).toContain('ring-2');
      expect(getWidgetElement(rendered.container, 'xy').className).not.toContain('ring-2');
    } finally {
      rendered.unmount();
    }
  });

  it('resizes widgets through the drag handles and recomputes their displayed bounds', async () => {
    const cases = [
      {
        widget: makeWidgetNode('BSBKnob', {
          id: 'knob',
          objectName: 'gain',
          x: 32,
          y: 28,
          properties: { labelEnabled: true, label: 'Gain', knobWidth: 60 },
        }),
        handle: 'right',
        deltaX: 36,
        deltaY: 0,
        expectedWidthIncrease: 36,
      },
      {
        widget: makeWidgetNode('BSBXYController', {
          id: 'xy',
          objectName: 'pad',
          x: 240,
          y: 28,
          properties: { valueDisplayEnabled: true, width: 120, height: 88 },
        }),
        handle: 'bottom',
        deltaX: 0,
        deltaY: 24,
        expectedHeightIncrease: 24,
      },
      {
        widget: makeWidgetNode('BSBLineObject', {
          id: 'line',
          objectName: 'curve',
          x: 24,
          y: 220,
          properties: {
            canvasWidth: 200,
            canvasHeight: 120,
            lines: [
              {
                varName: 'amp',
                min: 0,
                max: 1,
                color: '#ff0000',
                points: [{ x: 0, y: 0.2 }, { x: 1, y: 0.8 }],
              },
            ],
          },
        }),
        handle: 'right',
        deltaX: 28,
        deltaY: 0,
        expectedWidthIncrease: 28,
      },
    ] as const;

    for (const testCase of cases) {
      const instrument = makeInstrument(makeRoot([testCase.widget]));
      const rendered = mount(makeHarness(instrument));

      try {
        await act(async () => {
          await flushFrame();
        });

        const widget = getWidgetElement(rendered.container, testCase.widget.id);
        const before = widget.getBoundingClientRect();

        await act(async () => {
          widget.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0,
          }));
          await flushFrame();
        });

        const handle = rendered.container.querySelector(`[data-resize-edge="${testCase.handle}"]`);
        if (!(handle instanceof HTMLDivElement)) {
          throw new Error(`Unable to find ${testCase.handle} handle for ${testCase.widget.id}`);
        }
        const handleRect = handle.getBoundingClientRect();

        await act(async () => {
          dispatchMouse(handle, 'mousedown', {
            clientX: handleRect.left + (handleRect.width / 2),
            clientY: handleRect.top + (handleRect.height / 2),
          });
          dispatchMouse(window, 'mousemove', {
            clientX: handleRect.left + (handleRect.width / 2) + testCase.deltaX,
            clientY: handleRect.top + (handleRect.height / 2) + testCase.deltaY,
          });
          await flushFrame();
          dispatchMouse(window, 'mouseup', {
            clientX: handleRect.left + (handleRect.width / 2) + testCase.deltaX,
            clientY: handleRect.top + (handleRect.height / 2) + testCase.deltaY,
          });
          await flushFrame();
        });

        const after = getWidgetElement(rendered.container, testCase.widget.id).getBoundingClientRect();
        const widthIncrease = 'expectedWidthIncrease' in testCase ? testCase.expectedWidthIncrease : undefined;
        const heightIncrease = 'expectedHeightIncrease' in testCase ? testCase.expectedHeightIncrease : undefined;

        if (widthIncrease !== undefined) {
          expect(Math.round(after.width - before.width)).toBe(widthIncrease);
        }
        if (heightIncrease !== undefined) {
          expect(Math.round(after.height - before.height)).toBe(heightIncrease);
        }
      } finally {
        rendered.unmount();
      }
    }
  });
});
