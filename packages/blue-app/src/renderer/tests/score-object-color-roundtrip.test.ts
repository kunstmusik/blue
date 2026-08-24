import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  GenericScore,
  PolyObject,
  SoundLayer,
  TrackLayer,
  TrackLayerGroup,
} from '@blue/data';
import {
  __testAwaitPendingPatches,
  __testClearPendingPatches,
  __testFlushPendingPatches,
  useProjectStore,
} from '../stores/project-store';
import {
  applyProjectDocumentPatch,
  createNestedPolyObjectSnapshot,
  createProjectEditorSnapshot,
  type ProjectLoadedPayload,
  type ScoreObjectLocationRef,
} from '../../shared/project-editor';

let liveData: BlueData | null = null;

const mockBlueAPI = {
  commitProjectDocumentPatches: vi.fn(async (patches: Array<Record<string, unknown>>) => {
    let changed = false;
    for (const patch of patches) {
      changed = applyProjectDocumentPatch(liveData!, patch as never) || changed;
    }
    return { revision: 2, sessionId: 0, changed };
  }),
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

function loadDataIntoStore(data: BlueData): void {
  liveData = data;
  const snapshot = createProjectEditorSnapshot(data, null);
  useProjectStore.getState().setProjectInfo({
    ...(snapshot as ProjectLoadedPayload),
    title: 'Color Test',
    author: '',
    sampleRate: '44100',
    projectProperties: {
      ...snapshot.projectProperties,
      title: 'Color Test',
      author: '',
      sampleRate: '44100',
    },
  });
}

function firstStoreItem() {
  const groups = useProjectStore.getState().score.layerGroups;
  for (const group of groups) {
    for (const layer of group.layers) {
      if (layer.items.length > 0) {
        return layer.items[0]!;
      }
    }
  }
  return null;
}

async function flushAndAwait(): Promise<void> {
  __testFlushPendingPatches();
  await __testAwaitPendingPatches();
}

beforeEach(() => {
  vi.stubGlobal('window', { blueAPI: mockBlueAPI });
  vi.stubGlobal('localStorage', mockLocalStorage);
  useProjectStore.getState().clearProject();
  mockBlueAPI.commitProjectDocumentPatches.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  __testClearPendingPatches();
  liveData = null;
});

describe('Score object color round trip (properties panel → timeline → canonical data)', () => {
  it('updates color for an object in a root PolyObject group', async () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Poly Child');
    layer.push(gs);
    poly.push(layer);
    data.getScore().push(poly);
    const originalColor = gs.getBackgroundColor();

    loadDataIntoStore(data);

    const item = firstStoreItem()!;
    expect(item.backgroundColor).toBe(originalColor);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'updateSharedProperties',
        target: item.editorTarget!,
        patch: { backgroundColor: 0xff8833 },
      },
    });

    const optimisticItem = firstStoreItem()!;
    expect(optimisticItem.backgroundColor).toBe(0xff8833);

    await flushAndAwait();

    expect(gs.getBackgroundColor()).toBe(0xff8833);
  });

  it('updates color for an object nested inside a PolyObject container', async () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const root = new PolyObject();
    const layer = new SoundLayer();
    const nested = new PolyObject();
    nested.setName('Nested');
    const nestedLayer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Nested Child');
    nestedLayer.push(gs);
    nested.push(nestedLayer);
    layer.push(nested);
    root.push(layer);
    data.getScore().push(root);
    const originalColor = gs.getBackgroundColor();

    loadDataIntoStore(data);

    const nestedLocation: ScoreObjectLocationRef = {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
    };
    const nestedSnapshot = createNestedPolyObjectSnapshot(data, nestedLocation);
    expect(nestedSnapshot).not.toBeNull();

    const nestedItem = nestedSnapshot!.layers[0]!.items[0]!;
    expect(nestedItem.backgroundColor).toBe(originalColor);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'updateSharedProperties',
        target: nestedItem.editorTarget!,
        patch: { backgroundColor: 0xff8833 },
      },
    });

    await flushAndAwait();

    expect(gs.getBackgroundColor()).toBe(0xff8833);
  });

  it('updates color for an object in a track layer group', async () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = new TrackLayer();
    const gs = new GenericScore();
    gs.setName('Track Child');
    track.push(gs);
    group.push(track);
    data.getScore().push(group);
    const originalColor = gs.getBackgroundColor();

    loadDataIntoStore(data);

    const item = firstStoreItem()!;
    expect(item.backgroundColor).toBe(originalColor);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'updateSharedProperties',
        target: item.editorTarget!,
        patch: { backgroundColor: 0xff8833 },
      },
    });

    const optimisticItem = firstStoreItem()!;
    expect(optimisticItem.backgroundColor).toBe(0xff8833);

    await flushAndAwait();

    expect(gs.getBackgroundColor()).toBe(0xff8833);
  });
});
