import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbWidgetNodeSnapshot,
  OrchestraSnapshot,
} from '../../shared/project-editor';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import { useProjectStore, __testClearPendingPatches } from '../stores/project-store';

const mockBlueAPI = {
  commitProjectDocumentPatches: vi.fn().mockResolvedValue({ revision: 1 }),
  sendBsbRealtimeControlUpdate: vi.fn().mockResolvedValue(undefined),
};

function makeWidgetNode(overrides: Partial<BsbWidgetNodeSnapshot> = {}): BsbWidgetNodeSnapshot {
  return {
    id: 'w1',
    type: 'BSBKnob',
    objectName: 'amp',
    x: 20,
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
    objectNames: ['amp', 'freq', 'gain', 'group'],
    widgets: [
      { objectName: 'amp', widgetType: 'BSBKnob', value: 0.5, minimum: 0, maximum: 1 },
      { objectName: 'freq', widgetType: 'BSBValue', value: 440, minimum: 20, maximum: 20000 },
      { objectName: 'gain', widgetType: 'BSBKnob', value: 0.75, minimum: 0, maximum: 1 },
      { objectName: 'group', widgetType: 'BSBGroup', value: 0, minimum: 0, maximum: 0 },
    ],
    editEnabled: true,
    gridSettings: { enabled: false, snapEnabled: false, width: 10, height: 10 },
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
      children: [
        {
          id: 'group-1',
          type: 'BSBGroup',
          objectName: 'group',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          value: 0,
          minimum: 0,
          maximum: 0,
          editable: true,
          properties: {},
          children: [
            makeWidgetNode({ id: 'w1', objectName: 'amp', x: 10, y: 10 }),
            makeWidgetNode({
              id: 'w2',
              objectName: 'freq',
              type: 'BSBValue',
              value: 440,
              minimum: 20,
              maximum: 20000,
              width: 80,
              height: 24,
              x: 90,
              y: 10,
            }),
          ],
        },
        makeWidgetNode({ id: 'w3', objectName: 'gain', x: 240, y: 10 }),
      ],
    },
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

beforeEach(() => {
  vi.stubGlobal('window', { blueAPI: mockBlueAPI });
  useProjectStore.getState().clearProject();
  mockBlueAPI.commitProjectDocumentPatches.mockClear();
  mockBlueAPI.sendBsbRealtimeControlUpdate.mockClear();
});

afterEach(() => {
  __testClearPendingPatches();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('BSB performance store', () => {
  it('preserves untouched rows and metadata caches when editing a single widget value', async () => {
    seedProject();

    const beforeState = useProjectStore.getState();
    const beforeRows = beforeState.orchestra.arrangement.rows;
    const beforeInstruments = beforeState.orchestra.instruments;
    const beforeInstrument = beforeInstruments[0]!;
    const beforeObjectNames = beforeInstrument.objectNames;
    const beforeWidgets = beforeInstrument.widgets;
    const beforeGroup = beforeInstrument.widgetTree?.children?.[0];
    const beforeSibling = beforeInstrument.widgetTree?.children?.[1];
    const beforeTarget = beforeGroup?.children?.[0];

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

    const afterState = useProjectStore.getState();
    const afterInstrument = afterState.orchestra.instruments[0]!;

    expect(afterState.orchestra.arrangement.rows).toBe(beforeRows);
    expect(afterState.orchestra.arrangement.rows[1]).toBe(beforeRows[1]);
    expect(afterState.orchestra.instruments[1]).toBe(beforeInstruments[1]);
    expect(afterInstrument).not.toBe(beforeInstrument);
    expect(afterInstrument.objectNames).toBe(beforeObjectNames);
    expect(afterInstrument.widgets).toBe(beforeWidgets);
    expect(afterInstrument.widgetTree?.children?.[0]).not.toBe(beforeGroup);
    expect(afterInstrument.widgetTree?.children?.[1]).toBe(beforeSibling);
    expect(afterInstrument.widgetTree?.children?.[0]?.children?.[0]).not.toBe(beforeTarget);
    expect(afterInstrument.widgetTree?.children?.[0]?.children?.[1]).toBe(
      beforeGroup?.children?.[1],
    );
  });

  it('rebuilds only the edited widget branch when renaming a widget', async () => {
    seedProject();

    const beforeInstrument = useProjectStore.getState().orchestra.instruments[0]!;
    const beforeRoot = beforeInstrument.widgetTree;
    const beforeGroup = beforeRoot?.children?.[0];
    const beforeSibling = beforeRoot?.children?.[1];
    const beforeObjectNames = beforeInstrument.objectNames;
    const beforeWidgets = beforeInstrument.widgets;

    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'w1',
            properties: { objectName: 'amp2' },
          },
        },
      },
    });

    const afterInstrument = useProjectStore.getState().orchestra.instruments[0]!;

    expect(afterInstrument.widgetTree).not.toBe(beforeRoot);
    expect(afterInstrument.widgetTree?.children?.[0]).not.toBe(beforeGroup);
    expect(afterInstrument.widgetTree?.children?.[1]).toBe(beforeSibling);
    expect(afterInstrument.objectNames).not.toBe(beforeObjectNames);
    expect(afterInstrument.objectNames).toEqual(['amp2', 'freq', 'gain', 'group']);
    expect(afterInstrument.widgets).not.toBe(beforeWidgets);
    expect(afterInstrument.widgets.map((widget) => widget.objectName)).toEqual([
      'amp2',
      'freq',
      'gain',
      'group',
    ]);
  });

  it('preserves untouched instrument references when adding a nested widget', async () => {
    seedProject();

    const beforeState = useProjectStore.getState();
    const beforeRows = beforeState.orchestra.arrangement.rows;
    const beforeInstruments = beforeState.orchestra.instruments;
    const beforeRoot = beforeState.orchestra.instruments[0]!.widgetTree;
    const beforeGroup = beforeRoot?.children?.[0];
    const beforeSibling = beforeRoot?.children?.[1];
    const beforeObjectNames = beforeState.orchestra.instruments[0]!.objectNames;
    const beforeWidgets = beforeState.orchestra.instruments[0]!.widgets;

    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          bsbInterface: {
            type: 'addWidget',
            widgetType: 'BSBValue',
            x: 160,
            y: 20,
            parentGroupId: 'group-1',
          },
        },
      },
    });

    const afterState = useProjectStore.getState();
    const afterInstrument = afterState.orchestra.instruments[0]!;

    expect(afterState.orchestra.arrangement.rows).toBe(beforeRows);
    expect(afterState.orchestra.instruments[1]).toBe(beforeInstruments[1]);
    expect(afterInstrument).not.toBe(beforeState.orchestra.instruments[0]);
    expect(afterInstrument.widgetTree).not.toBe(beforeRoot);
    expect(afterInstrument.widgetTree?.children?.[0]).not.toBe(beforeGroup);
    expect(afterInstrument.widgetTree?.children?.[1]).toBe(beforeSibling);
    expect(afterInstrument.widgetTree?.children?.[0]?.children).toHaveLength(3);
    expect(afterInstrument.objectNames).not.toBe(beforeObjectNames);
    expect(afterInstrument.widgets).not.toBe(beforeWidgets);
  });
});
