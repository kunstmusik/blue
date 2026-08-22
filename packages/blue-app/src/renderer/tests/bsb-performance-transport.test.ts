import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbWidgetNodeSnapshot,
  OrchestraSnapshot,
} from '../../shared/project-editor';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import {
  __testAwaitPendingPatches,
  __testClearPendingPatches,
  __testFlushPendingPatches,
  useProjectStore,
} from '../stores/project-store';

const mockBlueAPI = {
  commitProjectDocumentPatches: vi.fn().mockResolvedValue({ revision: 1 }),
  getProjectDocument: vi.fn().mockResolvedValue(null),
  updateProjectDocument: vi.fn(),
  sendBsbRealtimeControlUpdate: vi.fn().mockResolvedValue(undefined),
};

function makeWidgetNode(overrides: Partial<BsbWidgetNodeSnapshot> = {}): BsbWidgetNodeSnapshot {
  return {
    id: 'widget-1',
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
    objectNames: ['amp'],
    widgets: [{ objectName: 'amp', widgetType: 'BSBKnob', value: 0.5, minimum: 0, maximum: 1 }],
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
      children: [makeWidgetNode()],
    },
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
      ],
    },
    instruments: [makeBsbInstrument('1')],
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
  mockBlueAPI.getProjectDocument.mockClear();
  mockBlueAPI.updateProjectDocument.mockClear();
  mockBlueAPI.sendBsbRealtimeControlUpdate.mockClear();
});

afterEach(() => {
  __testClearPendingPatches();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('BSB performance transport', () => {
  it('batches trailing document commits without snapshot echo', async () => {
    seedProject();

    await useProjectStore.getState().updateGlobalOrc('instr 1\nendin');
    await useProjectStore.getState().updateProjectProperties({ title: 'Edited Title' });

    __testFlushPendingPatches();
    await __testAwaitPendingPatches();

    expect(mockBlueAPI.commitProjectDocumentPatches).toHaveBeenCalledOnce();
    expect(mockBlueAPI.commitProjectDocumentPatches).toHaveBeenCalledWith([
      { globalOrc: 'instr 1\nendin' },
      { projectProperties: { title: 'Edited Title' } },
    ]);
    expect(mockBlueAPI.getProjectDocument).not.toHaveBeenCalled();
    expect(mockBlueAPI.updateProjectDocument).not.toHaveBeenCalled();
    expect(useProjectStore.getState().isDirty).toBe(true);
  });

  it('sends realtime updates for live BSB value changes', async () => {
    seedProject();

    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'widget-1',
            properties: { value: 0.75 },
          },
        },
      },
    });

    expect(mockBlueAPI.sendBsbRealtimeControlUpdate).toHaveBeenCalledWith({
      assignmentId: '1',
      widgetId: 'widget-1',
      kind: 'value',
      payload: { value: 0.75 },
    });
  });

  it('recovers from commit failures by resyncing the canonical project document', async () => {
    seedProject();

    const canonicalSnapshot = createEmptyProjectEditorSnapshot();
    mockBlueAPI.commitProjectDocumentPatches.mockRejectedValueOnce(new Error('boom'));
    mockBlueAPI.getProjectDocument.mockResolvedValue({
      title: 'Recovered Project',
      author: 'Test Author',
      sampleRate: '44100',
      version: '2.10.0',
      filePath: '/path/to/test.blue',
      loaded: true,
      globalOrc: 'recovered orchestra',
      globalSco: canonicalSnapshot.globalSco,
      orchestra: {
        ...canonicalSnapshot.orchestra,
        loaded: true,
      },
      projectProperties: {
        ...canonicalSnapshot.projectProperties,
        title: 'Recovered Project',
        author: 'Test Author',
      },
      transport: canonicalSnapshot.transport,
    });

    await useProjectStore.getState().updateGlobalOrc('instr 1\nendin');

    __testFlushPendingPatches();
    await __testAwaitPendingPatches();

    expect(mockBlueAPI.commitProjectDocumentPatches).toHaveBeenCalledOnce();
    expect(mockBlueAPI.getProjectDocument).toHaveBeenCalledOnce();
    expect(useProjectStore.getState().globalOrc).toBe('recovered orchestra');
    expect(useProjectStore.getState().title).toBe('Recovered Project');
    expect(useProjectStore.getState().isDirty).toBe(false);
  });
});
