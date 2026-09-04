// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbWidgetNodeSnapshot,
  OrchestraSnapshot,
} from '../../shared/project-editor';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import { useProjectStore, __testClearPendingPatches } from '../stores/project-store';
import OrchestraPanel from '../components/workbench/panels/OrchestraPanel';
import BSBInterfaceCanvas from '../components/workbench/panels/orchestra/bsb/BSBInterfaceCanvas';

const panelRenderCounts = vi.hoisted(() => ({
  arrangement: 0,
  instrument: 0,
}));

const widgetRenderCounts = vi.hoisted(() => ({
  knob: 0,
  value: 0,
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../components/workbench/panels/orchestra/ArrangementPanel', () => ({
  default: React.memo((props: any) => {
    panelRenderCounts.arrangement += 1;
    return React.createElement('div', {
      'data-testid': 'arrangement-panel',
      'data-row-count': String(props.rows.length),
    });
  }),
}));

vi.mock('../components/workbench/panels/orchestra/InstrumentEditorPanel', () => ({
  default: React.memo((props: any) => {
    panelRenderCounts.instrument += 1;
    return React.createElement('div', {
      'data-testid': 'instrument-panel',
      'data-instrument-id': props.instrument?.assignmentId ?? '',
    });
  }),
}));

vi.mock('../components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget', async () => {
  const actual = await vi.importActual<any>(
    '../components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget',
  );

  const CounterWidget = React.memo((props: any) => {
    widgetRenderCounts.knob += 1;
    return React.createElement(actual.default, props);
  });

  CounterWidget.displayName = 'CounterBSBKnobWidget';

  return { default: CounterWidget };
});

vi.mock('../components/workbench/panels/orchestra/bsb/widgets/BSBValueWidget', async () => {
  const actual = await vi.importActual<any>(
    '../components/workbench/panels/orchestra/bsb/widgets/BSBValueWidget',
  );

  const CounterWidget = React.memo((props: any) => {
    widgetRenderCounts.value += 1;
    return React.createElement(actual.default, props);
  });

  CounterWidget.displayName = 'CounterBSBValueWidget';

  return { default: CounterWidget };
});

const mockBlueAPI = {
  commitProjectDocumentPatches: vi.fn().mockResolvedValue({ revision: 1 }),
  sendBsbRealtimeControlUpdate: vi.fn().mockResolvedValue(undefined),
};

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

function makeBsbInstrument(assignmentId: string): BlueSynthBuilderInstrumentSnapshot {
  const ampNode = makeWidgetNode({ id: 'w1', objectName: 'amp', x: 10, y: 10 });
  const freqNode = makeWidgetNode({
    id: 'w2',
    type: 'BSBValue',
    objectName: 'freq',
    x: 120,
    y: 10,
    width: 80,
    height: 24,
    value: 440,
    minimum: 20,
    maximum: 20000,
  });

  return {
    assignmentId,
    type: 'blueSynthBuilder',
    name: `Builder ${assignmentId}`,
    enabled: true,
    comment: '',
    instrumentText: 'aout oscili <amp>, <freq>',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: ['amp', 'freq'],
    widgets: [
      { objectName: 'amp', widgetType: 'BSBKnob', value: 0.5, minimum: 0, maximum: 1 },
      { objectName: 'freq', widgetType: 'BSBValue', value: 440, minimum: 20, maximum: 20000 },
    ],
    editEnabled: true,
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
      maximum: 0,
      editable: true,
      properties: {},
      children: [ampNode, freqNode],
    },
    udolist: [],
  };
}

function makeGenericInstrument(assignmentId: string): {
  assignmentId: string;
  type: 'generic';
  name: string;
  enabled: boolean;
  comment: string;
  text: string;
  globalOrc: string;
  globalSco: string;
} {
  return {
    assignmentId,
    type: 'generic',
    name: `Instrument ${assignmentId}`,
    enabled: true,
    comment: '',
    text: 'aout oscili p4, p5',
    globalOrc: '',
    globalSco: '',
  };
}

function seedProject(): void {
  const baseSnapshot = createEmptyProjectEditorSnapshot();
  const orchestra: OrchestraSnapshot = {
    ...baseSnapshot.orchestra,
    loaded: true,
    arrangement: {
      rows: [
        {
          assignmentId: '1',
          enabled: true,
          instrumentName: 'Builder 1',
          instrumentType: 'blueSynthBuilder',
          instrumentSummary: 'BlueSynthBuilder',
          editable: true,
        },
        {
          assignmentId: '2',
          enabled: true,
          instrumentName: 'Instrument 2',
          instrumentType: 'generic',
          instrumentSummary: 'GenericInstrument',
          editable: true,
        },
      ],
    },
    instruments: [makeBsbInstrument('1'), makeGenericInstrument('2')],
  };

  useProjectStore.getState().setProjectInfo({
    title: 'Test Project',
    author: 'Test Author',
    sampleRate: '44100',
    version: '2.10.0',
    filePath: '/path/to/test.blue',
    loaded: true,
    globalOrc: baseSnapshot.globalOrc,
    globalSco: baseSnapshot.globalSco,
    orchestra,
    projectProperties: {
      ...baseSnapshot.projectProperties,
      title: 'Test Project',
      author: 'Test Author',
    },
    transport: baseSnapshot.transport,
  });
}

function renderRoot(element: React.ReactElement): {
  root: Root;
  rerender: (nextElement: React.ReactElement) => void;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    root,
    rerender: (nextElement: React.ReactElement) => {
      act(() => {
        root.render(nextElement);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  panelRenderCounts.arrangement = 0;
  panelRenderCounts.instrument = 0;
  widgetRenderCounts.knob = 0;
  widgetRenderCounts.value = 0;
  document.body.innerHTML = '';
  Object.assign(window, { blueAPI: mockBlueAPI });
  useProjectStore.getState().clearProject();
  mockBlueAPI.commitProjectDocumentPatches.mockClear();
  mockBlueAPI.sendBsbRealtimeControlUpdate.mockClear();
});

afterEach(() => {
  __testClearPendingPatches();
  delete (window as Partial<typeof window> & { blueAPI?: typeof mockBlueAPI }).blueAPI;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('BSB performance render isolation', () => {
  it('keeps the arrangement panel stable when editing the selected instrument', async () => {
    seedProject();

    const tree = renderRoot(<OrchestraPanel />);

    const baseline = {
      arrangement: panelRenderCounts.arrangement,
      instrument: panelRenderCounts.instrument,
    };

    await act(async () => {
      await useProjectStore.getState().applyProjectDocumentPatch({
        orchestra: {
          type: 'updateInstrument',
          assignmentId: '1',
          patch: {
            bsbInterface: {
              type: 'updateWidgetProperties',
              widgetId: 'w1',
              properties: { value: 0.75 },
            },
          },
        },
      });
    });

    expect(panelRenderCounts.arrangement).toBe(baseline.arrangement);
    expect(panelRenderCounts.instrument).toBeGreaterThan(baseline.instrument);

    tree.unmount();
  });

  it('does not rerender an unrelated widget when another widget value changes', () => {
    const handlers = {
      onWidgetSelect: vi.fn(),
      onBsbInterfacePatch: vi.fn(),
      onInstrumentPatch: vi.fn(),
    };

    const ampNode = makeWidgetNode({ id: 'w1', objectName: 'amp', x: 10, y: 10, value: 0.5 });
    const freqNode = makeWidgetNode({
      id: 'w2',
      type: 'BSBValue',
      objectName: 'freq',
      x: 120,
      y: 10,
      width: 80,
      height: 24,
      value: 440,
      minimum: 20,
      maximum: 20000,
    });

    const baseInstrument: BlueSynthBuilderInstrumentSnapshot = {
      ...makeBsbInstrument('1'),
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
        maximum: 0,
        editable: true,
        properties: {},
        children: [ampNode, freqNode],
      },
    };

    const tree = renderRoot(
      <BSBInterfaceCanvas
        instrument={baseInstrument}
        selectedWidgetIds={new Set()}
        editEnabled
        onWidgetSelect={handlers.onWidgetSelect}
        onBsbInterfacePatch={handlers.onBsbInterfacePatch}
        onInstrumentPatch={handlers.onInstrumentPatch}
      />,
    );

    const baseline = {
      knob: widgetRenderCounts.knob,
      value: widgetRenderCounts.value,
    };

    const updatedInstrument: BlueSynthBuilderInstrumentSnapshot = {
      ...baseInstrument,
      widgetTree: {
        ...baseInstrument.widgetTree,
        children: [{ ...ampNode, value: 0.75 }, freqNode],
      },
    };

    tree.rerender(
      <BSBInterfaceCanvas
        instrument={updatedInstrument}
        selectedWidgetIds={new Set()}
        editEnabled
        onWidgetSelect={handlers.onWidgetSelect}
        onBsbInterfacePatch={handlers.onBsbInterfacePatch}
        onInstrumentPatch={handlers.onInstrumentPatch}
      />,
    );

    expect(widgetRenderCounts.knob).toBeGreaterThan(baseline.knob);
    expect(widgetRenderCounts.value).toBe(baseline.value);

    tree.unmount();
  });

  it('rerenders only the selected widget when selection changes', () => {
    const handlers = {
      onWidgetSelect: vi.fn(),
      onBsbInterfacePatch: vi.fn(),
      onInstrumentPatch: vi.fn(),
    };

    const ampNode = makeWidgetNode({ id: 'w1', objectName: 'amp', x: 10, y: 10, value: 0.5 });
    const freqNode = makeWidgetNode({
      id: 'w2',
      type: 'BSBValue',
      objectName: 'freq',
      x: 120,
      y: 10,
      width: 80,
      height: 24,
      value: 440,
      minimum: 20,
      maximum: 20000,
    });

    const instrument: BlueSynthBuilderInstrumentSnapshot = {
      ...makeBsbInstrument('1'),
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
        maximum: 0,
        editable: true,
        properties: {},
        children: [ampNode, freqNode],
      },
    };

    const tree = renderRoot(
      <BSBInterfaceCanvas
        instrument={instrument}
        selectedWidgetIds={new Set()}
        editEnabled
        onWidgetSelect={handlers.onWidgetSelect}
        onBsbInterfacePatch={handlers.onBsbInterfacePatch}
        onInstrumentPatch={handlers.onInstrumentPatch}
      />,
    );

    const baseline = {
      knob: widgetRenderCounts.knob,
      value: widgetRenderCounts.value,
    };

    tree.rerender(
      <BSBInterfaceCanvas
        instrument={instrument}
        selectedWidgetIds={new Set(['w1'])}
        editEnabled
        onWidgetSelect={handlers.onWidgetSelect}
        onBsbInterfacePatch={handlers.onBsbInterfacePatch}
        onInstrumentPatch={handlers.onInstrumentPatch}
      />,
    );

    expect(widgetRenderCounts.knob).toBeGreaterThan(baseline.knob);
    expect(widgetRenderCounts.value).toBe(baseline.value);

    tree.unmount();
  });
});
