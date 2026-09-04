import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __testAwaitPendingPatches,
  __testClearPendingPatches,
  __testFlushPendingPatches,
  useProjectStore,
} from '../stores/project-store';
import {
  createEmptyProjectEditorSnapshot,
  type ProjectLoadedPayload,
  type ScoreObjectEditorTargetSnapshot,
} from '../../shared/project-editor';

const mockBlueAPI = {
  commitProjectDocumentPatches: vi.fn().mockResolvedValue({ revision: 1, sessionId: 0 }),
  sendBsbRealtimeControlUpdate: vi.fn().mockResolvedValue(undefined),
  getProjectDocument: vi.fn(),
};

const mockLocalStorage: Storage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
};

function createPianoRollTarget(): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'piano-roll-1',
    selectedObjectType: 'PianoRoll',
    editorObjectType: 'PianoRoll',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

function loadProjectWithPianoRoll(): ScoreObjectEditorTargetSnapshot {
  const snapshot = createEmptyProjectEditorSnapshot();
  const target = createPianoRollTarget();

  snapshot.loaded = true;
  snapshot.filePath = '/path/to/test.blue';
  snapshot.score.layerGroups = [
    {
      groupId: 'poly-group',
      groupType: 'polyObject',
      name: 'Score',
      layerCount: 1,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 'score-layer-0',
          name: 'Layer 1',
          height: 44,
          muted: false,
          solo: false,
          items: [
            {
              objectId: 'piano-roll-1',
              objectType: 'PianoRoll',
              name: 'Original PianoRoll',
              startBeats: 0,
              durationBeats: 4,
              startTimeBase: 'BEATS',
              durationTimeBase: 'BEATS',
              backgroundColor: 0x669966,
              isContainer: false,
              editorTarget: target,
              barRenderer: {
                kind: 'pianoRoll',
                labelLines: ['Original PianoRoll'],
                timeBehavior: 'SCALE',
                repeatPointBeats: null,
                scaleDegreeCount: 12,
                notesDurationBeats: 4,
                notes: [],
              },
            },
          ],
        },
      ],
    },
  ];

  useProjectStore.getState().setProjectInfo({
    ...(snapshot as ProjectLoadedPayload),
    title: 'Test Project',
    author: 'Test Author',
    sampleRate: '44100',
    projectProperties: {
      ...snapshot.projectProperties,
      title: 'Test Project',
      author: 'Test Author',
      sampleRate: '44100',
    },
  });

  return target;
}

beforeEach(() => {
  vi.stubGlobal('window', { blueAPI: mockBlueAPI });
  vi.stubGlobal('localStorage', mockLocalStorage);
  useProjectStore.getState().clearProject();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  __testClearPendingPatches();
});

describe('Score object properties store updates', () => {
  it('optimistically applies shared PianoRoll properties to score rows and bar labels', async () => {
    const target = loadProjectWithPianoRoll();

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'updateSharedProperties',
        target,
        patch: {
          name: 'Renamed PianoRoll',
          backgroundColor: 0xff8833,
          startTime: { value: 2.5, timeBase: 'TIME' },
          subjectiveDuration: { value: 6.25, timeBase: 'SECONDS' },
        },
      },
    });

    const updatedItem = useProjectStore.getState().score.layerGroups[0]!.layers[0]!.items[0]!;
    expect(updatedItem.name).toBe('Renamed PianoRoll');
    expect(updatedItem.backgroundColor).toBe(0xff8833);
    expect(updatedItem.startBeats).toBeCloseTo(2.5);
    expect(updatedItem.startTimeBase).toBe('TIME');
    expect(updatedItem.durationBeats).toBeCloseTo(6.25);
    expect(updatedItem.durationTimeBase).toBe('SECONDS');
    expect(updatedItem.barRenderer.labelLines).toEqual(['Renamed PianoRoll']);

    __testFlushPendingPatches();
    await __testAwaitPendingPatches();

    expect(mockBlueAPI.commitProjectDocumentPatches).toHaveBeenCalledWith([
      {
        score: {
          type: 'updateSharedProperties',
          target,
          patch: {
            name: 'Renamed PianoRoll',
            backgroundColor: 0xff8833,
            startTime: { value: 2.5, timeBase: 'TIME' },
            subjectiveDuration: { value: 6.25, timeBase: 'SECONDS' },
          },
        },
      },
    ]);
  });

  it('optimistically applies PianoRoll timeBehavior and repeatPoint edits', async () => {
    const target = loadProjectWithPianoRoll();

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'updateSoundObjectBehavior',
        target,
        patch: {
          timeBehavior: 'REPEAT',
          repeatPoint: { value: 1.5, timeBase: 'BEATS' },
        },
      },
    });

    let updatedItem = useProjectStore.getState().score.layerGroups[0]!.layers[0]!.items[0]!;
    expect(updatedItem.barRenderer.kind).toBe('pianoRoll');
    if (updatedItem.barRenderer.kind === 'pianoRoll') {
      expect(updatedItem.barRenderer.timeBehavior).toBe('REPEAT');
      expect(updatedItem.barRenderer.repeatPointBeats).toBeCloseTo(1.5);
    }

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'updateSoundObjectBehavior',
        target,
        patch: {
          timeBehavior: 'NONE',
        },
      },
    });

    updatedItem = useProjectStore.getState().score.layerGroups[0]!.layers[0]!.items[0]!;
    expect(updatedItem.barRenderer.kind).toBe('pianoRoll');
    if (updatedItem.barRenderer.kind === 'pianoRoll') {
      expect(updatedItem.barRenderer.timeBehavior).toBe('NONE');
      expect(updatedItem.barRenderer.repeatPointBeats).toBeCloseTo(1.5);
    }

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'updateSoundObjectBehavior',
        target,
        patch: {
          timeBehavior: 'REPEAT_CLASSIC',
        },
      },
    });

    updatedItem = useProjectStore.getState().score.layerGroups[0]!.layers[0]!.items[0]!;
    expect(updatedItem.barRenderer.kind).toBe('pianoRoll');
    if (updatedItem.barRenderer.kind === 'pianoRoll') {
      expect(updatedItem.barRenderer.timeBehavior).toBe('REPEAT_CLASSIC');
      expect(updatedItem.barRenderer.repeatPointBeats).toBeCloseTo(1.5);
    }

    __testFlushPendingPatches();
    await __testAwaitPendingPatches();

    expect(mockBlueAPI.commitProjectDocumentPatches).toHaveBeenCalledWith([
      {
        score: {
          type: 'updateSoundObjectBehavior',
          target,
          patch: {
            timeBehavior: 'REPEAT',
            repeatPoint: { value: 1.5, timeBase: 'BEATS' },
          },
        },
      },
      {
        score: {
          type: 'updateSoundObjectBehavior',
          target,
          patch: {
            timeBehavior: 'NONE',
          },
        },
      },
      {
        score: {
          type: 'updateSoundObjectBehavior',
          target,
          patch: {
            timeBehavior: 'REPEAT_CLASSIC',
          },
        },
      },
    ]);
  });
});
