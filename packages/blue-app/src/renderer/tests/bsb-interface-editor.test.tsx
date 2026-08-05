import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, it, expect, vi } from 'vitest';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbWidgetNodeSnapshot,
  BsbInterfacePatch,
  GridSettingsSnapshot,
} from '../../shared/project-editor';
import WidgetWrapper from '../components/workbench/panels/orchestra/bsb/widgets/WidgetWrapper';
import BSBHSliderBankWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBHSliderBankWidget';
import BSBVSliderBankWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBVSliderBankWidget';
import BSBLineObjectWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBLineObjectWidget';
import BSBTextFieldWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBTextFieldWidget';
import BSBValueWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBValueWidget';
import { BSB_WIDGET_RESIZE_META } from '../components/workbench/panels/orchestra/bsb/bsb-widget-meta';
import BSBPropertySheet from '../components/workbench/panels/orchestra/bsb/BSBPropertySheet';
import BSBInterfaceCanvas, {
  buildPastedWidgets,
  createCanvasClipboard,
  getNextMarqueeSelection,
  isGridSnapEnabled,
} from '../components/workbench/panels/orchestra/bsb/BSBInterfaceCanvas';
import { getCommittedTextFieldValue } from '../components/workbench/panels/orchestra/bsb/widgets/BSBTextFieldWidget';
import { getWidgetDisplaySize } from '../components/workbench/panels/orchestra/bsb/widgets/utils';
import { createDefaultBsbWidgetSnapshot } from '../../shared/project-editor';
import { useBsbClipboardStore } from '../stores/bsb-clipboard-store';
import { applyBsbInterfacePatchToSnapshot } from '../stores/project-store';

function makeWidgetNode(overrides: Partial<BsbWidgetNodeSnapshot> = {}): BsbWidgetNodeSnapshot {
  return {
    id: 'w1',
    type: 'BSBKnob',
    objectName: 'amp',
    x: 10,
    y: 20,
    width: 60,
    height: 60,
    value: 0.5,
    minimum: 0,
    maximum: 1,
    editable: true,
    properties: {},
    ...overrides,
  };
}

function makeInstrument(overrides: Partial<BlueSynthBuilderInstrumentSnapshot> = {}): BlueSynthBuilderInstrumentSnapshot {
  return {
    assignmentId: '1',
    type: 'blueSynthBuilder',
    name: 'Test BSB',
    enabled: true,
    comment: '',
    instrumentText: 'aout oscili <amp>, 440',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: ['amp'],
    widgets: [{ objectName: 'amp', widgetType: 'BSBKnob', value: 0.5, minimum: 0, maximum: 1 }],
    editEnabled: true,
    gridSettings: { enabled: true, snapEnabled: true, width: 10, height: 10, gridStyle: 'NONE' },
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
      children: [makeWidgetNode()],
    },
    ...overrides,
  };
}

afterEach(() => {
  useBsbClipboardStore.getState().clearClipboard();
});

describe('BSB Interface Editor', () => {
  it('creates instrument snapshots with widgetTree data', () => {
    const instrument = makeInstrument();
    expect(instrument.widgetTree).not.toBeNull();
    expect(instrument.widgetTree!.children).toHaveLength(1);
    expect(instrument.widgetTree!.children![0].objectName).toBe('amp');
  });

  it('creates instrument snapshots with gridSettings', () => {
    const instrument = makeInstrument();
    expect(instrument.gridSettings.enabled).toBe(true);
    expect(instrument.gridSettings.snapEnabled).toBe(true);
    expect(instrument.gridSettings.width).toBe(10);
    expect(instrument.gridSettings.height).toBe(10);
  });

  it('creates instrument snapshots with editEnabled', () => {
    const enabled = makeInstrument({ editEnabled: true });
    expect(enabled.editEnabled).toBe(true);
    const disabled = makeInstrument({ editEnabled: false });
    expect(disabled.editEnabled).toBe(false);
  });

  it('handles empty widgetTree for empty interfaces', () => {
    const instrument = makeInstrument({
      widgetTree: {
        id: 'root', type: 'BSBRootGroup', objectName: '',
        x: 0, y: 0, width: 0, height: 0,
        value: 0, minimum: 0, maximum: 0,
        editable: true, properties: {}, children: [],
      },
    });
    expect(instrument.widgetTree.children).toHaveLength(0);
  });

  it('handles presetGroup snapshots', () => {
    const instrument = makeInstrument({
      presetGroup: {
        name: 'Test Presets',
        currentPresetUniqueId: 'p1',
        currentPresetModified: false,
        subGroups: [],
        presets: [{ uniqueId: 'p1', name: 'Default' }],
      },
    });
    expect(instrument.presetGroup!.presets).toHaveLength(1);
    expect(instrument.presetGroup!.presets[0].name).toBe('Default');
  });

  it('handles widget nodes with preserved-only flag', () => {
    const node = makeWidgetNode({ preservedOnly: true, editable: false });
    expect(node.preservedOnly).toBe(true);
    expect(node.editable).toBe(false);
  });

  it('handles nested children in widget tree', () => {
    const instrument = makeInstrument({
      widgetTree: {
        id: 'root',
        type: 'BSBRootGroup',
        objectName: '',
        x: 0, y: 0, width: 0, height: 0,
        value: 0,
        minimum: 0,
        maximum: 1,
        editable: true,
        properties: {},
        children: [
          makeWidgetNode({ id: 'w1', objectName: 'knob1' }),
          {
            id: 'g1',
            type: 'BSBGroup',
            objectName: '',
            x: 0, y: 0, width: 200, height: 100,
            value: 0,
            minimum: 0,
            maximum: 1,
            editable: true,
            properties: {},
            children: [makeWidgetNode({ id: 'w2', objectName: 'knob2' })],
          },
        ],
      },
    });
    expect(instrument.widgetTree!.children).toHaveLength(2);
    expect(instrument.widgetTree!.children![1].children).toHaveLength(1);
    expect(instrument.widgetTree!.children![1].children![0].objectName).toBe('knob2');
  });

  it('sizes the canvas to the furthest widget bounds plus Java padding', () => {
    const instrument = makeInstrument({
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
        children: [
          makeWidgetNode({ id: 'edge', x: 700, y: 420, width: 60, height: 24 }),
        ],
      },
    });

    const html = renderToStaticMarkup(
      <BSBInterfaceCanvas
        instrument={instrument}
        selectedWidgetIds={new Set()}
        editEnabled
        onWidgetSelect={vi.fn()}
        onBsbInterfacePatch={vi.fn()}
        onInstrumentPatch={vi.fn()}
      />,
    );

    expect(html).toContain('width:770px');
    expect(html).toContain('height:506px');
  });

  it('uses the Java parity interface background instead of the app canvas surface', () => {
    const instrument = makeInstrument();

    const html = renderToStaticMarkup(
      <BSBInterfaceCanvas
        instrument={instrument}
        selectedWidgetIds={new Set()}
        editEnabled
        onWidgetSelect={vi.fn()}
        onBsbInterfacePatch={vi.fn()}
        onInstrumentPatch={vi.fn()}
      />,
    );

    expect(html).toContain('bg-app-bsb-canvas');
    expect(html).not.toContain('bg-app-canvas');
  });

  it('uses expanded group bounds when sizing the canvas', () => {
    const instrument = makeInstrument({
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
        children: [
          {
            id: 'group-1',
            type: 'BSBGroup',
            objectName: '',
            x: 50,
            y: 20,
            width: 20,
            height: 20,
            value: 0,
            minimum: 0,
            maximum: 1,
            editable: true,
            properties: {},
            children: [
              makeWidgetNode({ id: 'inner', x: 700, y: 410, width: 60, height: 24 }),
            ],
          },
        ],
      },
    });

    const html = renderToStaticMarkup(
      <BSBInterfaceCanvas
        instrument={instrument}
        selectedWidgetIds={new Set()}
        editEnabled
        onWidgetSelect={vi.fn()}
        onBsbInterfacePatch={vi.fn()}
        onInstrumentPatch={vi.fn()}
      />,
    );

    expect(html).toContain('width:830px');
    expect(html).toContain('height:526px');
  });

  it('renders BSBTextField as an input in runtime mode', () => {
    const node = makeWidgetNode({
      type: 'BSBTextField',
      width: 130,
      height: 24,
      properties: { textValue: 'runtime text', textFieldWidth: 100 },
    });

    const html = renderToStaticMarkup(
      <BSBTextFieldWidget
        node={node}
        isSelected={false}
        editEnabled={false}
        onWidgetSelect={vi.fn()}
        onBsbInterfacePatch={vi.fn()}
      />,
    );

    expect(html).toContain('<input');
    expect(html).toContain('value="runtime text"');
  });

  it('computes text field commits only when the value changed', () => {
    expect(getCommittedTextFieldValue('same', 'same')).toBeNull();
    expect(getCommittedTextFieldValue('before', 'after')).toBe('after');
  });

  it('renders BSBLineObject with a selector row and line geometry', () => {
    const node = makeWidgetNode({
      type: 'BSBLineObject',
      width: 200,
      height: 148,
      properties: {
        canvasWidth: 200,
        canvasHeight: 120,
        lines: [
          {
            varName: 'curveA',
            min: 0,
            max: 1,
            color: '#ff0000',
            points: [{ x: 0, y: 0.25 }, { x: 1, y: 0.75 }],
          },
        ],
      },
    });

    const editModeHtml = renderToStaticMarkup(
      <BSBLineObjectWidget
        node={node}
        isSelected={false}
        editEnabled
        onWidgetSelect={vi.fn()}
        onBsbInterfacePatch={vi.fn()}
      />,
    );

    const runtimeHtml = renderToStaticMarkup(
      <BSBLineObjectWidget
        node={node}
        isSelected={false}
        editEnabled={false}
        onWidgetSelect={vi.fn()}
        onBsbInterfacePatch={vi.fn()}
      />,
    );

    expect(editModeHtml).toContain('curveA');
    expect(editModeHtml).toContain('<polyline');
    expect(editModeHtml).toContain('▶');
    expect(editModeHtml).toContain('cursor:default');
    expect(runtimeHtml).toContain('cursor:crosshair');
  });

  it('renders BSBHSliderBank value panels from snapshot slider values', () => {
    const node = makeWidgetNode({
      type: 'BSBHSliderBank',
      width: 170,
      height: 65,
      minimum: 0,
      maximum: 1,
      properties: {
        sliderWidth: 120,
        gap: 5,
        numberOfSliders: 2,
        valueDisplayEnabled: true,
        sliders: [{ value: 0.25 }, { value: 0.75 }],
      },
    });

    const html = renderToStaticMarkup(
      <BSBHSliderBankWidget
        node={node}
        isSelected={false}
        editEnabled={false}
        onWidgetSelect={vi.fn()}
        onBsbInterfacePatch={vi.fn()}
      />,
    );

    expect((html.match(/rgb\(20,29,45\)/g) ?? []).length).toBe(2);
    expect((html.match(/<circle/g) ?? []).length).toBe(4);
  });

  it('renders BSBVSliderBank thumbs with value panels below sliders', () => {
    const node = makeWidgetNode({
      type: 'BSBVSliderBank',
      width: 105,
      height: 180,
      minimum: 0,
      maximum: 1,
      properties: {
        sliderHeight: 120,
        gap: 5,
        numberOfSliders: 1,
        valueDisplayEnabled: true,
        sliders: [{ value: 0.5 }],
      },
    });

    const html = renderToStaticMarkup(
      <BSBVSliderBankWidget
        node={node}
        isSelected={false}
        editEnabled={false}
        onWidgetSelect={vi.fn()}
        onBsbInterfacePatch={vi.fn()}
      />,
    );

    expect(html).toContain('<circle');
    expect(html.indexOf('fill="rgb(63,102,150)"')).toBeLessThan(html.indexOf('fill="rgb(20,29,45)"'));
  });

  it('does not feed group display height back into stored model height', () => {
    const group = createDefaultBsbWidgetSnapshot('BSBGroup')!;
    group.id = 'group-1';
    group.x = 20;
    group.y = 30;
    group.height = 20;

    const instrument = makeInstrument({
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
        children: [group],
      },
    });

    applyBsbInterfacePatchToSnapshot(instrument, {
      type: 'updateWidgetProperties',
      widgetId: 'group-1',
      properties: { x: 40, y: 50 },
    });

    const nextGroup = instrument.widgetTree.children?.[0];
    expect(nextGroup?.x).toBe(40);
    expect(nextGroup?.y).toBe(50);
    expect(nextGroup?.height).toBe(20);
  });

  it('uses the group title width as the visible minimum width', () => {
    const group = createDefaultBsbWidgetSnapshot('BSBGroup')!;
    group.width = 20;
    group.properties.groupName = 'Group';
    group.properties.titleEnabled = true;

    expect(getWidgetDisplaySize(group).width).toBeGreaterThan(20);
  });
});

describe('BSB Property Sheet', () => {
  it('tracks property sheet patches for widget object names', () => {
    const patches: BsbInterfacePatch[] = [];
    const onPatch = (p: BsbInterfacePatch) => patches.push(p);

    const widget = makeWidgetNode();
    onPatch({
      type: 'updateWidgetProperties',
      widgetId: widget.id,
      properties: { objectName: 'gain' },
    });

    expect(patches).toHaveLength(1);
    expect(patches[0]).toEqual({
      type: 'updateWidgetProperties',
      widgetId: 'w1',
      properties: { objectName: 'gain' },
    });
  });

  it('generates layout patches for x/y/width/height changes', () => {
    const patches: BsbInterfacePatch[] = [];
    const onPatch = (p: BsbInterfacePatch) => patches.push(p);

    onPatch({ type: 'moveWidget', widgetId: 'w1', x: 50, y: 75 });
    onPatch({ type: 'resizeWidget', widgetId: 'w1', width: 100, height: 80 });

    expect(patches[0]).toEqual({ type: 'moveWidget', widgetId: 'w1', x: 50, y: 75 });
    expect(patches[1]).toEqual({ type: 'resizeWidget', widgetId: 'w1', width: 100, height: 80 });
  });
});

describe('BSB Grid Settings', () => {
  it('generates grid settings patches', () => {
    const patches: BsbInterfacePatch[] = [];
    const onPatch = (p: BsbInterfacePatch) => patches.push(p);

    const gridSettings: GridSettingsSnapshot = { enabled: true, snapEnabled: true, width: 10, height: 10, gridStyle: 'NONE' };
    onPatch({ type: 'updateGridSettings', patch: { width: 20 } });
    onPatch({ type: 'updateGridSettings', patch: { snapEnabled: false } });

    expect(patches).toHaveLength(2);
    expect(patches[0]).toEqual({ type: 'updateGridSettings', patch: { width: 20 } });
    expect(patches[1]).toEqual({ type: 'updateGridSettings', patch: { snapEnabled: false } });
  });

  it('merges partial grid settings patches correctly', () => {
    const base: GridSettingsSnapshot = { enabled: true, snapEnabled: true, width: 10, height: 10, gridStyle: 'NONE' };
    const updated = { ...base, ...{ width: 20 } };
    expect(updated).toEqual({ enabled: true, snapEnabled: true, width: 20, height: 10, gridStyle: 'NONE' });
  });

  it('keeps snapping enabled even when grid visibility is off', () => {
    expect(isGridSnapEnabled({ snapEnabled: true })).toBe(true);
    expect(isGridSnapEnabled({ snapEnabled: false })).toBe(false);
  });

  it('builds pasted widgets from an instance clipboard with snapped offsets', () => {
    const clipboard = createCanvasClipboard([
      makeWidgetNode({ id: 'a', x: 12, y: 19 }),
      makeWidgetNode({ id: 'b', x: 32, y: 39 }),
    ]);

    const pasted = buildPastedWidgets(clipboard, 27, 34, true, 10, 10);

    expect(pasted).toHaveLength(2);
    expect(pasted[0].id).toBeUndefined();
    expect(pasted[0].x).toBe(20);
    expect(pasted[0].y).toBe(30);
    expect(pasted[1].x).toBe(40);
    expect(pasted[1].y).toBe(50);
  });

  it('stores copied BSB widgets in a renderer-wide clipboard', () => {
    const clipboard = createCanvasClipboard([
      makeWidgetNode({ id: 'copy-source', objectName: 'amp' }),
    ]);

    useBsbClipboardStore.getState().setClipboard(clipboard);
    if (clipboard) {
      clipboard.widgets[0].objectName = 'mutated';
    }

    expect(useBsbClipboardStore.getState().clipboard?.widgets[0]?.objectName).toBe('amp');
  });

  it('optimistically pastes copied widgets with fresh ids and unique replacement names', () => {
    const instrument = makeInstrument({
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
        children: [makeWidgetNode({ id: 'existing', objectName: 'amp', x: 10, y: 20 })],
      },
    });
    const clipboard = createCanvasClipboard([
      {
        id: 'copy-source',
        type: 'BSBGroup',
        objectName: 'amp',
        x: 10,
        y: 20,
        width: 100,
        height: 100,
        value: 0,
        minimum: 0,
        maximum: 1,
        editable: true,
        properties: { groupName: 'Group', titleEnabled: true },
        children: [
          makeWidgetNode({ id: 'nested-source', objectName: 'nested', x: 4, y: 5 }),
        ],
      },
    ]);
    const pasted = buildPastedWidgets(clipboard, 40, 60, false);

    applyBsbInterfacePatchToSnapshot(instrument, {
      type: 'pasteWidgets',
      widgetData: JSON.stringify(pasted),
    });

    const children = instrument.widgetTree.children ?? [];
    expect(children).toHaveLength(2);
    expect(children[1].id).toBeTruthy();
    expect(children[1].id).not.toBe('copy-source');
    expect(children[1].objectName).toBe('amp1');
    expect(children[1].x).toBe(40);
    expect(children[1].y).toBe(60);
    expect(children[1].children?.[0]?.id).toBeTruthy();
    expect(children[1].children?.[0]?.id).not.toBe('nested-source');
    expect(instrument.objectNames).toContain('amp');
    expect(instrument.objectNames).toContain('amp1');
    expect(instrument.objectNames).toContain('nested');
  });
});

describe('BSB Marquee Selection', () => {
  it('toggles only intersecting widgets during shift-marquee selection', () => {
    const next = getNextMarqueeSelection(new Set(['a', 'b']), ['b', 'c'], true);
    expect(Array.from(next).sort()).toEqual(['a', 'c']);
  });

  it('replaces selection when shift is not held', () => {
    const next = getNextMarqueeSelection(new Set(['a', 'b']), ['c'], false);
    expect(Array.from(next)).toEqual(['c']);
  });
});

describe('BSB Edit-Mode Affordances (T056)', () => {
  const resizableTypes = [
    { type: 'BSBHSlider', expectedEdges: ['left', 'right'] },
    { type: 'BSBVSlider', expectedEdges: ['top', 'bottom'] },
    { type: 'BSBKnob', expectedEdges: ['left', 'right', 'top', 'bottom'] },
    { type: 'BSBLineObject', expectedEdges: ['left', 'right', 'top', 'bottom'] },
    { type: 'BSBXYController', expectedEdges: ['left', 'right', 'top', 'bottom'] },
  ];

  for (const { type, expectedEdges } of resizableTypes) {
    it(`shows resize handles for ${type} when selected in edit mode`, () => {
      const node = makeWidgetNode({ id: 'w1', type, width: 100, height: 100 });
      const meta = BSB_WIDGET_RESIZE_META[type];
      const html = renderToStaticMarkup(
        createElement(WidgetWrapper, {
          node,
          isSelected: true,
          editEnabled: true,
          onWidgetSelect: vi.fn(),
          resizeMeta: meta,
          onBsbInterfacePatch: vi.fn(),
          children: createElement('div', null, 'widget'),
        }),
      );

      for (const edge of expectedEdges) {
        expect(html).toContain(`data-resize-edge="${edge}"`);
      }
    });
  }

  it('does not show resize handles when edit mode is disabled', () => {
    const node = makeWidgetNode({ id: 'w1', type: 'BSBHSlider', width: 100, height: 100 });
    const meta = BSB_WIDGET_RESIZE_META['BSBHSlider'];
    const html = renderToStaticMarkup(
      createElement(WidgetWrapper, {
        node,
        isSelected: true,
        editEnabled: false,
        onWidgetSelect: vi.fn(),
        resizeMeta: meta,
        onBsbInterfacePatch: vi.fn(),
        children: createElement('div', null, 'widget'),
      }),
    );

    expect(html).not.toContain('data-resize-edge');
  });

  it('does not show resize handles when widget is not selected', () => {
    const node = makeWidgetNode({ id: 'w1', type: 'BSBHSlider', width: 100, height: 100 });
    const meta = BSB_WIDGET_RESIZE_META['BSBHSlider'];
    const html = renderToStaticMarkup(
      createElement(WidgetWrapper, {
        node,
        isSelected: false,
        editEnabled: true,
        onWidgetSelect: vi.fn(),
        resizeMeta: meta,
        onBsbInterfacePatch: vi.fn(),
        children: createElement('div', null, 'widget'),
      }),
    );

    expect(html).not.toContain('data-resize-edge');
  });

  it('renders BSBValue as non-interactive label in edit mode', () => {
    const node = makeWidgetNode({ id: 'w1', type: 'BSBValue', objectName: 'gain', width: 60, height: 24 });
    const html = renderToStaticMarkup(
      createElement(BSBValueWidget, {
        node,
        isSelected: false,
        editEnabled: true,
        onWidgetSelect: vi.fn(),
        resizeMeta: BSB_WIDGET_RESIZE_META['BSBValue'],
        onBsbInterfacePatch: vi.fn(),
      }),
    );

    expect(html).toContain('gain');
    expect(html).toContain('pointer-events-none');
  });

  it('renders BSBValue as interactive numeric display in non-edit mode', () => {
    const node = makeWidgetNode({
      id: 'w1',
      type: 'BSBValue',
      objectName: 'gain',
      width: 60,
      height: 24,
      value: 0,
      properties: { defaultValue: 0.75 },
    });
    const html = renderToStaticMarkup(
      createElement(BSBValueWidget, {
        node,
        isSelected: false,
        editEnabled: false,
        onWidgetSelect: vi.fn(),
        resizeMeta: BSB_WIDGET_RESIZE_META['BSBValue'],
        onBsbInterfacePatch: vi.fn(),
      }),
    );

    expect(html).toContain('0.7500');
    expect(html).not.toContain('pointer-events-none');
  });

  it('falls back to the top-level widget value when defaultValue is absent', () => {
    const node = makeWidgetNode({
      id: 'w1',
      type: 'BSBValue',
      objectName: 'gain',
      width: 60,
      height: 24,
      value: 0.5,
      properties: {},
    });
    const html = renderToStaticMarkup(
      createElement(BSBValueWidget, {
        node,
        isSelected: false,
        editEnabled: false,
        onWidgetSelect: vi.fn(),
        resizeMeta: BSB_WIDGET_RESIZE_META['BSBValue'],
        onBsbInterfacePatch: vi.fn(),
      }),
    );

    expect(html).toContain('0.5000');
  });
});

describe('BSB property sheet parity', () => {
  it('creates optimistic add defaults with Java-sized widget snapshots', () => {
    const hSlider = createDefaultBsbWidgetSnapshot('BSBHSlider')!;
    const vSlider = createDefaultBsbWidgetSnapshot('BSBVSlider')!;
    const knob = createDefaultBsbWidgetSnapshot('BSBKnob')!;
    const bank = createDefaultBsbWidgetSnapshot('BSBHSliderBank')!;
    const fileSelector = createDefaultBsbWidgetSnapshot('BSBFileSelector')!;
    const group = createDefaultBsbWidgetSnapshot('BSBGroup')!;

    expect(hSlider.width).toBe(200);
    expect(hSlider.height).toBe(30);
    expect(hSlider.properties.sliderWidth).toBe(150);

    expect(vSlider.width).toBe(50);
    expect(vSlider.height).toBe(180);
    expect(vSlider.properties.sliderHeight).toBe(150);

    expect(knob.properties.labelEnabled).toBe(true);
    expect(knob.properties['labelFont.size']).toBe(12);

    expect(Array.isArray(bank.properties.sliders)).toBe(true);
    expect(bank.properties.sliders).toHaveLength(1);
    expect(bank.properties.numberOfSliders).toBe(1);

    expect(fileSelector.properties.stringChannelEnabled).toBe(true);

    expect(group.height).toBe(20);
  });

  it('renders label, dropdown, line, and font editors', () => {
    const knob = createDefaultBsbWidgetSnapshot('BSBKnob')!;
    knob.properties.label = 'Gain';
    knob.properties.labelEnabled = true;
    knob.properties['labelFont.name'] = 'Georgia';
    knob.properties['labelFont.size'] = 16;
    knob.properties['labelFont.style'] = 1;

    const dropdown = createDefaultBsbWidgetSnapshot('BSBDropdown')!;
    dropdown.properties.dropdownItems = [
      { name: 'One', value: '1', uniqueId: 'item-1' },
      { name: 'Two', value: '2', uniqueId: 'item-2' },
    ];

    const line = createDefaultBsbWidgetSnapshot('BSBLineObject')!;
    line.properties.lines = [
      {
        varName: 'freq',
        min: 20,
        max: 20000,
        color: '#ff0000',
        rightBound: true,
        endPointsLinked: false,
        points: [
          { x: 0, y: 0.25 },
          { x: 1, y: 0.75 },
        ],
      },
    ];

    const knobHtml = renderToStaticMarkup(
      createElement(BSBPropertySheet, {
        widget: knob,
        editEnabled: true,
        allObjectNames: new Set(['gain']),
        onBsbInterfacePatch: vi.fn(),
      }),
    );

    const dropdownHtml = renderToStaticMarkup(
      createElement(BSBPropertySheet, {
        widget: dropdown,
        editEnabled: true,
        allObjectNames: new Set(['choice']),
        onBsbInterfacePatch: vi.fn(),
      }),
    );

    const lineHtml = renderToStaticMarkup(
      createElement(BSBPropertySheet, {
        widget: line,
        editEnabled: true,
        allObjectNames: new Set(['curve']),
        onBsbInterfacePatch: vi.fn(),
      }),
    );

    expect(knobHtml).toContain('Label Enabled');
    expect(knobHtml).toContain('Label Font');
    expect(knobHtml).toContain('Georgia 16 Bold');

    expect(dropdownHtml).toContain('Dropdown Items');
    expect(dropdownHtml).toContain('One');
    expect(dropdownHtml).toContain('Two');

    expect(lineHtml).toContain('Lines');
    expect(lineHtml).toContain('Line Name');
    expect(lineHtml).toContain('Link First/Last');
    expect(lineHtml).toContain('aria-label="BSB line 1 color"');
    expect(lineHtml).not.toContain('type="color"');
    expect(lineHtml).not.toContain('Right Bound');
  });
});
