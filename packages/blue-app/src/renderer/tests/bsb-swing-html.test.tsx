// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vite-plus/test';
import {
  createDefaultBsbWidgetSnapshot,
  type BlueSynthBuilderInstrumentSnapshot,
} from '../../shared/project-editor';
import { resolveBsbSwingHtmlFontSizePx, stripBsbSwingHtmlText } from '../../shared/bsb-swing-html';
import BSBInterfaceCanvas from '../components/workbench/panels/orchestra/bsb/BSBInterfaceCanvas';
import {
  getSanitizedBsbSwingHtml,
  getWidgetDisplaySize,
} from '../components/workbench/panels/orchestra/bsb/widgets/utils';

function makeInstrument(
  children: BlueSynthBuilderInstrumentSnapshot['widgetTree']['children'],
): BlueSynthBuilderInstrumentSnapshot {
  return {
    assignmentId: '1',
    type: 'blueSynthBuilder',
    name: 'HTML Labels',
    enabled: true,
    comment: '',
    instrumentText: 'aout oscili 0.5, 440',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: [],
    widgets: [],
    editEnabled: false,
    gridSettings: { enabled: false, snapEnabled: false, width: 10, height: 10, gridStyle: 'NONE' },
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

describe('BSB Swing HTML labels', () => {
  it('renders legacy Swing HTML label text instead of showing the raw tags', () => {
    const label = createDefaultBsbWidgetSnapshot('BSBLabel')!;
    label.id = 'label';
    label.x = 10;
    label.y = 10;
    label.properties.label = '<html><font size="+1">OSC 1</font></html>';

    const knob = createDefaultBsbWidgetSnapshot('BSBKnob')!;
    knob.id = 'knob';
    knob.x = 10;
    knob.y = 40;
    knob.properties.labelEnabled = true;
    knob.properties.label = '<html><b>Gain</b></html>';

    const checkBox = createDefaultBsbWidgetSnapshot('BSBCheckBox')!;
    checkBox.id = 'check';
    checkBox.x = 10;
    checkBox.y = 130;
    checkBox.properties.label = '<html><i>Enabled</i></html>';

    const group = createDefaultBsbWidgetSnapshot('BSBGroup')!;
    group.id = 'group';
    group.x = 10;
    group.y = 170;
    group.properties.groupName = '<html><u>Panel</u></html>';

    const dropdown = createDefaultBsbWidgetSnapshot('BSBDropdown')!;
    dropdown.id = 'dropdown';
    dropdown.x = 10;
    dropdown.y = 210;
    dropdown.properties.selectedIndex = 0;
    dropdown.properties.dropdownItems = [
      { name: '<html><font size="+1">Mode A</font></html>', value: 'a', uniqueId: 'mode-a' },
    ];

    const subChannel = createDefaultBsbWidgetSnapshot('BSBSubChannelDropdown')!;
    subChannel.id = 'sub-channel';
    subChannel.x = 10;
    subChannel.y = 250;
    subChannel.properties.channelOutput = '<html><b>Bus 1</b></html>';

    const html = renderToStaticMarkup(
      createElement(BSBInterfaceCanvas, {
        instrument: makeInstrument([label, knob, checkBox, group, dropdown, subChannel]),
        selectedWidgetIds: new Set<string>(),
        editEnabled: false,
        onWidgetSelect: vi.fn(),
        onBsbInterfacePatch: vi.fn(),
        onInstrumentPatch: vi.fn(),
      }),
    );

    expect(html).toContain('OSC 1');
    expect(html).toContain('Gain');
    expect(html).toContain('Enabled');
    expect(html).toContain('Panel');
    expect(html).toContain('Mode A');
    expect(html).toContain('Bus 1');
    expect(html).not.toContain('&lt;html&gt;');
    expect(html).not.toContain('&lt;font');
    expect(html).not.toContain('&lt;b&gt;');
    expect(html).not.toContain('&lt;i&gt;');
  });

  it('sizes HTML labels from their rendered content instead of the raw markup length', () => {
    const plain = createDefaultBsbWidgetSnapshot('BSBLabel')!;
    plain.properties.label = 'OSC 1';

    const htmlLabel = createDefaultBsbWidgetSnapshot('BSBLabel')!;
    htmlLabel.properties.label = '<html><font size="+1">OSC 1</font></html>';

    expect(stripBsbSwingHtmlText(htmlLabel.properties.label as string)).toBe('OSC 1');

    const plainSize = getWidgetDisplaySize(plain);
    const htmlSize = getWidgetDisplaySize(htmlLabel);

    expect(htmlSize.width).toBeGreaterThanOrEqual(plainSize.width);
    expect(htmlSize.width).toBeLessThan(plainSize.width + 40);
    expect(htmlSize.height).toBeGreaterThanOrEqual(plainSize.height);
  });

  it('keeps authored BSB label glyphs inside their measured line box', () => {
    const label = createDefaultBsbWidgetSnapshot('BSBLabel')!;
    label.id = 'label';
    label.properties.label = 'JNO';
    label.properties['font.size'] = 36;

    const html = renderToStaticMarkup(
      createElement(BSBInterfaceCanvas, {
        instrument: makeInstrument([label]),
        selectedWidgetIds: new Set<string>(),
        editEnabled: false,
        onWidgetSelect: vi.fn(),
        onBsbInterfacePatch: vi.fn(),
        onInstrumentPatch: vi.fn(),
      }),
    );

    expect(html).toContain('font-size:36px');
    expect(html).toContain('line-height:normal');
  });

  it('maps legacy Swing font sizes to the same larger bucket Java uses', () => {
    expect(resolveBsbSwingHtmlFontSizePx('+1')).toBe(18);
    expect(resolveBsbSwingHtmlFontSizePx('-1')).toBe(12);
    expect(resolveBsbSwingHtmlFontSizePx('4')).toBe(14);

    const markup = getSanitizedBsbSwingHtml('<html><font size="+1">OSC 1</font></html>');
    expect(markup).toContain('font-size:18px');
  });

  function mockGridViewport(width = 600, height = 400) {
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(width);
    const clientHeight = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockReturnValue(height);
    return () => {
      clientWidth.mockRestore();
      clientHeight.mockRestore();
    };
  }

  it.each(['DOT', 'LINE'] as const)(
    'defers Swing HTML measurement and tiles a fractional %s grid',
    async (gridStyle) => {
      const appendSpy = vi.spyOn(document.body, 'appendChild');
      const restoreViewport = mockGridViewport();
      const htmlLabel = createDefaultBsbWidgetSnapshot('BSBLabel')!;
      htmlLabel.id = 'uncached-defer-label';
      htmlLabel.x = 10;
      htmlLabel.y = 10;
      htmlLabel.properties.label =
        '<html><font size="+2">Unique Deferred Label 48291</font></html>';
      const instrument: BlueSynthBuilderInstrumentSnapshot = {
        ...makeInstrument([htmlLabel]),
        editEnabled: true,
        gridSettings: {
          enabled: true,
          snapEnabled: true,
          width: 10.5,
          height: 10.25,
          gridStyle,
        },
      };

      try {
        // Pure render (renderToStaticMarkup) must not touch document.body for DOM measurement.
        renderToStaticMarkup(
          createElement(BSBInterfaceCanvas, {
            instrument,
            selectedWidgetIds: new Set<string>(),
            onWidgetSelect: vi.fn(),
          }),
        );
        expect(appendSpy).not.toHaveBeenCalled();

        // Mounted canvas with grid enabled must keep the GridOverlay backing bitmap
        // proportional to the canvas bounds instead of allocating a 2000x2000 minimum.
        const originalCanvasCtx = HTMLCanvasElement.prototype.getContext;
        const ctxMock = {
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          stroke: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          translate: vi.fn(),
          createPattern: vi.fn((_tile: HTMLCanvasElement) => ({})),
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
        };
        HTMLCanvasElement.prototype.getContext = vi.fn(
          () => ctxMock as unknown as CanvasRenderingContext2D,
        ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

        const container = document.createElement('div');
        document.body.appendChild(container);
        appendSpy.mockClear();
        const root = createRoot(container);
        try {
          await act(async () => {
            root.render(
              createElement(BSBInterfaceCanvas, {
                instrument,
                selectedWidgetIds: new Set<string>(),
                editEnabled: true,
                onWidgetSelect: vi.fn(),
              }),
            );
          });
          const gridCanvas = container.querySelector('canvas');
          expect(gridCanvas).not.toBeNull();
          expect(gridCanvas!.width).toBe(600);
          expect(gridCanvas!.height).toBe(400);
          expect(gridCanvas!.width).toBeLessThan(2000);
          expect(gridCanvas!.height).toBeLessThan(2000);
          expect(ctxMock.createPattern).toHaveBeenCalledTimes(1);
          const [tile] = ctxMock.createPattern.mock.calls[0]!;
          expect([tile.width, tile.height]).toEqual([21, 41]);
          if (gridStyle === 'DOT') {
            expect(ctxMock.arc).toHaveBeenCalledTimes(3 * 5);
          } else {
            expect(ctxMock.lineTo).toHaveBeenCalledTimes(2 + 4);
            expect(ctxMock.stroke).toHaveBeenCalledOnce();
          }
          expect(ctxMock.fillRect).toHaveBeenCalledWith(0, 0, 600, 400);
        } finally {
          HTMLCanvasElement.prototype.getContext = originalCanvasCtx;
          await act(async () => {
            root.unmount();
          });
          container.remove();
        }
      } finally {
        appendSpy.mockRestore();
        restoreViewport();
      }
    },
  );

  it('batches fallback DOT grid dots into a single beginPath and fill when createPattern returns null', async () => {
    const restoreViewport = mockGridViewport();
    const label = createDefaultBsbWidgetSnapshot('BSBLabel')!;
    label.id = 'dot-fallback-label';
    label.x = 10;
    label.y = 10;
    const instrument: BlueSynthBuilderInstrumentSnapshot = {
      ...makeInstrument([label]),
      editEnabled: true,
      gridSettings: { enabled: true, snapEnabled: true, width: 20, height: 25, gridStyle: 'DOT' },
    };

    const originalCanvasCtx = HTMLCanvasElement.prototype.getContext;
    const ctxMock = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      measureText: vi.fn(() => ({ width: 20 })),
      createPattern: vi.fn(() => null),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    };
    const origCreateElement = document.createElement.bind(document);
    const createElSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'canvas') {
        (el as HTMLCanvasElement).getContext = vi.fn(
          () => ctxMock as unknown as CanvasRenderingContext2D,
        ) as unknown as HTMLCanvasElement['getContext'];
      }
      return el;
    }) as typeof document.createElement);
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctxMock as unknown as CanvasRenderingContext2D,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const container = origCreateElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          createElement(BSBInterfaceCanvas, {
            instrument,
            selectedWidgetIds: new Set<string>(),
            editEnabled: true,
            onWidgetSelect: vi.fn(),
          }),
        );
      });

      const dotBeginPathsAfterTile = ctxMock.beginPath.mock.calls.length;
      const dotFillsAfterTile = ctxMock.fill.mock.calls.length;
      // 1 beginPath+fill on offscreen tile attempt + 1 batched beginPath+fill for all fallback dots.
      expect(dotBeginPathsAfterTile).toBe(2);
      expect(dotFillsAfterTile).toBe(2);
      // 4 tile corner arcs + (600/20)*(400/25) = 4 + 30*16 = 484 arcs.
      expect(ctxMock.arc).toHaveBeenCalledTimes(4 + (600 / 20) * (400 / 25));
    } finally {
      restoreViewport();
      createElSpy.mockRestore();
      HTMLCanvasElement.prototype.getContext = originalCanvasCtx;
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it('draws only a buffered portion of a large irregular grid and keeps its phase after scrolling', async () => {
    const restoreViewport = mockGridViewport(500, 350);
    const context = {
      translate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const frames: FrameRequestCallback[] = [];
    const nextFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const label = createDefaultBsbWidgetSnapshot('BSBLabel')!;
    label.id = 'distant';
    label.x = 9000;
    label.y = 9000;
    const instrument: BlueSynthBuilderInstrumentSnapshot = {
      ...makeInstrument([label]),
      editEnabled: true,
      gridSettings: {
        enabled: true,
        snapEnabled: true,
        width: 10.1,
        height: 11.3,
        gridStyle: 'DOT',
      },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          createElement(BSBInterfaceCanvas, {
            instrument,
            selectedWidgetIds: new Set<string>(),
            editEnabled: true,
            onWidgetSelect: vi.fn(),
          }),
        ),
      );
      const viewport = container.querySelector<HTMLDivElement>(
        '[data-shortcut-scope="bsb-interface-canvas"]',
      )!;
      const canvas = viewport.querySelector('canvas')!;
      expect([canvas.width, canvas.height]).toEqual([596, 446]);
      const firstPaint = context.arc.mock.calls.length;
      expect(firstPaint).toBeGreaterThan(0);
      expect(firstPaint).toBeLessThan(3000);

      await act(async () => {
        viewport.scrollLeft = 2000;
        viewport.scrollTop = 3000;
        viewport.dispatchEvent(new Event('scroll'));
        viewport.dispatchEvent(new Event('scroll'));
        expect(frames).toHaveLength(1);
        frames.shift()!(0);
      });
      expect([canvas.width, canvas.height]).toEqual([692, 542]);
      expect(context.translate).toHaveBeenLastCalledWith(-1904, -2904);
      expect(context.arc.mock.calls[firstPaint]!.slice(0, 2)).toEqual([189 * 10.1, 257 * 11.3]);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      nextFrame.mockRestore();
      getContext.mockRestore();
      restoreViewport();
    }
  });
});
