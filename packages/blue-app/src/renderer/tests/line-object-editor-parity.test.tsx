// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BSBLineObjectWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBLineObjectWidget';
import LineObjectEditor from '../components/workbench/panels/score-object/editors/LineObjectEditor';
import ZakLineObjectEditor from '../components/workbench/panels/score-object/editors/ZakLineObjectEditor';
import { EditableLineCanvas } from '../components/workbench/panels/shared/line-editor/EditableLineCanvas';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class MockResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe() {
    this.callback([] as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }

  disconnect() {}
  unobserve() {}
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;

function makeTarget(editorObjectType: string) {
  return {
    selectionId: `${editorObjectType.toLowerCase()}-0`,
    selectedObjectType: editorObjectType,
    editorObjectType,
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
    },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

function makeDocument(editorFamily: 'LineObject' | 'ZakLineObject', payload: Record<string, unknown>) {
  const target = makeTarget(editorFamily);
  return {
    id: `${editorFamily}-doc`,
    title: editorFamily,
    target,
    editor: {
      kind: 'structured',
      target,
      editorFamily,
      payloadSummary: '',
      payload,
    },
  } as any;
}

function renderEditor(element: React.ReactElement): { container: HTMLDivElement; root: Root; unmount: () => void } {
  const container = document.createElement('div');
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

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButtonByText(label: string): HTMLButtonElement | null {
  return Array.from(document.body.querySelectorAll('button')).find(
    (button): button is HTMLButtonElement => button.textContent?.trim() === label,
  ) ?? null;
}

function getClientPointForSvg(svg: SVGSVGElement, svgX: number, svgY: number) {
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  return {
    clientX: rect.left + ((svgX / viewBox.width) * rect.width),
    clientY: rect.top + ((svgY / viewBox.height) * rect.height),
  };
}

let rectSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    x: 0,
    y: 0,
    width: 800,
    height: 360,
    top: 0,
    left: 0,
    right: 800,
    bottom: 360,
    toJSON: () => ({}),
  }) as DOMRect);
});

afterEach(() => {
  rectSpy.mockRestore();
  document.body.innerHTML = '';
});

describe('Line and Zak line score editors', () => {
  it('renders the Java-style line table columns and line overlay canvas for LineObject', () => {
    const tree = renderEditor(
      <LineObjectEditor
        document={makeDocument('LineObject', {
          lines: [
            {
              varName: 'line0',
              min: 0,
              max: 1,
              color: 0x20dd00,
              rightBound: true,
              endPointsLinked: false,
              points: [{ x: 0, y: 0.25 }, { x: 1, y: 0.75 }],
            },
            {
              varName: 'line1',
              min: -2,
              max: 2,
              color: 0x0000ff,
              rightBound: true,
              endPointsLinked: true,
              points: [{ x: 0, y: -1 }, { x: 0.5, y: 1 }, { x: 1, y: -1 }],
            },
          ],
        })}
        onPatch={vi.fn()}
      />,
    );

    expect(tree.container.textContent).toContain('Line Name');
    expect(tree.container.textContent).toContain('Min');
    expect(tree.container.textContent).toContain('Max');
    expect(tree.container.querySelector('[title="Link first/last points"]')).not.toBeNull();
    expect(tree.container.querySelectorAll('polyline')).toHaveLength(2);

    const svg = tree.container.querySelector('polyline')?.ownerSVGElement;
    expect(svg).not.toBeNull();
    const axisLabels = Array.from(svg!.querySelectorAll('text'));
    expect(axisLabels.length).toBeGreaterThan(0);
    for (const label of axisLabels) {
      expect(label.classList).toContain('text-role-subheadline');
      expect(label.hasAttribute('fontSize')).toBe(false);
      expect(label.hasAttribute('font-size')).toBe(false);
    }
    act(() => {
      svg!.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 240,
        clientY: 180,
      }));
    });

    expect(document.body.textContent).toContain('Edit Points');
    expect(document.body.textContent).toContain('Reset Line');

    tree.unmount();
  });

  it('uses the same popup actions and expanded table contract for ZakLineObject', () => {
    const tree = renderEditor(
      <ZakLineObjectEditor
        document={makeDocument('ZakLineObject', {
          zakSpace: 16,
          lines: [
            {
              channel: 3,
              min: 0,
              max: 1,
              color: 0xffa500,
              rightBound: true,
              endPointsLinked: false,
              points: [{ x: 0, y: 0.1 }, { x: 1, y: 0.8 }],
            },
            {
              channel: 7,
              min: -1,
              max: 1,
              color: 0xcd3700,
              rightBound: true,
              endPointsLinked: true,
              points: [{ x: 0, y: -0.5 }, { x: 0.4, y: 0.7 }, { x: 1, y: -0.5 }],
            },
          ],
        })}
        onPatch={vi.fn()}
      />,
    );

    expect(tree.container.textContent).toContain('Zak Lines');
    expect(tree.container.textContent).toContain('zak3');
    expect(tree.container.textContent).toContain('Zak Space');
    expect(tree.container.querySelector('[title="Link first/last points"]')).not.toBeNull();
    expect(tree.container.querySelectorAll('polyline')).toHaveLength(2);

    const svg = tree.container.querySelector('polyline')?.ownerSVGElement;
    expect(svg).not.toBeNull();
    act(() => {
      svg!.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 260,
        clientY: 200,
      }));
    });

    expect(document.body.textContent).toContain('Edit Points');
    expect(document.body.textContent).toContain('Reset Line');

    tree.unmount();
  });

  it('keeps linked endpoints synchronized when editing points in the shared point editor', () => {
    const initialLines = [{
      varName: 'line0',
      min: 0,
      max: 1,
      color: 0x20dd00,
      rightBound: true,
      endPointsLinked: true,
      points: [{ x: 0, y: 0.15 }, { x: 0.5, y: 0.65 }, { x: 1, y: 0.15 }],
    }];
    let latestLines = initialLines;

    function Harness(): React.ReactElement {
      const [lines, setLines] = React.useState(initialLines);
      latestLines = lines;
      return (
        <EditableLineCanvas
          lines={lines}
          selectedLineIndex={0}
          onLinesChange={setLines}
          canvasWidth={200}
          canvasHeight={120}
          interactive
          className="h-full w-full"
        />
      );
    }

    const tree = renderEditor(<Harness />);
    const svg = tree.container.querySelector('polyline')?.ownerSVGElement;
    expect(svg).not.toBeNull();

    const menuPoint = getClientPointForSvg(svg!, 100, 60);
    act(() => {
      svg!.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: menuPoint.clientX,
        clientY: menuPoint.clientY,
      }));
    });

    const editPointsButton = findButtonByText('Edit Points');
    expect(editPointsButton).not.toBeNull();
    act(() => {
      editPointsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const inputs = Array.from(document.body.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
    const firstYInput = inputs[1];
    expect(firstYInput).toBeDefined();

    act(() => {
      setInputValue(firstYInput!, '0.85');
      firstYInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(latestLines[0]!.points[0]!.y).toBeCloseTo(0.85);
    expect(latestLines[0]!.points[2]!.y).toBeCloseTo(0.85);

    tree.unmount();
  });

  it('keeps locked BSB line widgets draggable but blocks popup actions', () => {
    const onBsbInterfacePatch = vi.fn();
    const node = {
      id: 'line-widget',
      type: 'BSBLineObject',
      objectName: 'lineWidget',
      x: 0,
      y: 0,
      width: 200,
      height: 148,
      value: 0,
      minimum: 0,
      maximum: 1,
      editable: true,
      properties: {
        locked: true,
        canvasWidth: 200,
        canvasHeight: 120,
        lines: [
          {
            varName: 'curveA',
            min: 0,
            max: 1,
            color: '#ff0000',
            rightBound: true,
            endPointsLinked: false,
            points: [{ x: 0, y: 0.25 }, { x: 1, y: 0.75 }],
          },
        ],
      },
    } as any;

    const tree = renderEditor(
      <BSBLineObjectWidget
        node={node}
        isSelected={false}
        editEnabled={false}
        onWidgetSelect={vi.fn()}
        onBsbInterfacePatch={onBsbInterfacePatch}
      />,
    );

    const svg = tree.container.querySelector('polyline')?.ownerSVGElement;
    expect(svg).not.toBeNull();

    const menuPoint = getClientPointForSvg(svg!, 100, 60);
    act(() => {
      svg!.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: menuPoint.clientX,
        clientY: menuPoint.clientY,
      }));
    });

    expect(document.body.textContent).not.toContain('Edit Points');
    expect(document.body.textContent).not.toContain('Reset Line');

    const point = getClientPointForSvg(svg!, 5, 90);
    act(() => {
      svg!.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: point.clientX,
        clientY: point.clientY,
      }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: point.clientX,
        clientY: point.clientY - 80,
      }));
      window.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: point.clientX,
        clientY: point.clientY - 80,
      }));
    });

    expect(onBsbInterfacePatch).toHaveBeenCalledTimes(1);
    expect(onBsbInterfacePatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'updateWidgetProperties',
      widgetId: 'line-widget',
    }));

    tree.unmount();
  });
});
