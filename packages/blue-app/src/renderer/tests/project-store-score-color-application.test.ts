import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import {
  createMockPatternLayerSnapshot,
  createMockPatternSourceTarget,
  createMockScoreLayerSnapshot,
  createMockScoreRowObjectSnapshot,
  createMockScoreObjectTarget,
} from '../../shared/project-editor-layer-color-test-utils';

describe('Project Store Score Color Application (US3)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      blueAPI: {
        commitProjectDocumentPatches: vi.fn(async () => ({ revision: 1, sessionId: 0, changed: true })),
        getProjectDocument: vi.fn(),
      },
    });
    useProjectStore.getState().clearProject();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('optimistically applies setScoreObjectBackgroundColors to multiple items across layers', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    const target1 = createMockScoreObjectTarget({
      selectionId: 'item-1',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    });
    const target2 = createMockScoreObjectTarget({
      selectionId: 'item-2',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 1, objectIndex: 0 },
    });

    snapshot.score.layerGroups = [
      {
        groupId: 'group-1',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 2,
        isOpenableContainer: true,
        layers: [
          createMockScoreLayerSnapshot({
            layerId: 'layer-0',
            items: [createMockScoreRowObjectSnapshot({ objectId: 'item-1', editorTarget: target1, backgroundColor: 0x111111 })],
          }),
          createMockScoreLayerSnapshot({
            layerId: 'layer-1',
            items: [createMockScoreRowObjectSnapshot({ objectId: 'item-2', editorTarget: target2, backgroundColor: 0x222222 })],
          }),
        ],
      },
    ];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: { ...snapshot.orchestra, loaded: true },
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [
          { target: target1, backgroundColor: 0x990000 },
          { target: target2, backgroundColor: 0x009900 },
        ],
      },
    });

    const score = useProjectStore.getState().score;
    const item1 = score.layerGroups[0].layers[0].items[0];
    const item2 = score.layerGroups[0].layers[1].items[0];

    expect(item1.backgroundColor).toBe(-6750208); // normalized 0x990000
    expect(item2.backgroundColor).toBe(-16738048); // normalized 0x009900
  });

  it('rejects batch all-or-nothing if any update has an invalid color or missing target', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    const target1 = createMockScoreObjectTarget({
      selectionId: 'item-1',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    });
    const target2 = createMockScoreObjectTarget({
      selectionId: 'item-2',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 1, objectIndex: 0 },
    });

    snapshot.score.layerGroups = [
      {
        groupId: 'group-1',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 2,
        isOpenableContainer: true,
        layers: [
          createMockScoreLayerSnapshot({
            layerId: 'layer-0',
            items: [createMockScoreRowObjectSnapshot({ objectId: 'item-1', editorTarget: target1, backgroundColor: 0x111111 })],
          }),
          createMockScoreLayerSnapshot({
            layerId: 'layer-1',
            items: [createMockScoreRowObjectSnapshot({ objectId: 'item-2', editorTarget: target2, backgroundColor: 0x222222 })],
          }),
        ],
      },
    ];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: { ...snapshot.orchestra, loaded: true },
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    // One valid target, one with invalid color (NaN)
    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [
          { target: target1, backgroundColor: 0x990000 },
          { target: target2, backgroundColor: Number.NaN },
        ],
      },
    });

    // Neither item should have changed
    const score = useProjectStore.getState().score;
    expect(score.layerGroups[0].layers[0].items[0].backgroundColor).toBe(0x111111);
    expect(score.layerGroups[0].layers[1].items[0].backgroundColor).toBe(0x222222);

    // Nonexistent target in batch
    const nonexistentTarget = createMockScoreObjectTarget({
      selectionId: 'nonexistent',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 99, objectIndex: 99 },
    });
    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [
          { target: target1, backgroundColor: 0x990000 },
          { target: nonexistentTarget, backgroundColor: 0x009900 },
        ],
      },
    });
    expect(score.layerGroups[0].layers[0].items[0].backgroundColor).toBe(0x111111);
  });

  it('rejects selection/location aliases that resolve to the same snapshot item', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    const itemTarget = createMockScoreObjectTarget({
      selectionId: 'item-1',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    });
    const locationTarget = { ...itemTarget, selectionId: 'location-alias' };
    const selectionTarget = {
      ...itemTarget,
      location: { ...itemTarget.location!, objectIndex: 99 },
    };

    snapshot.score.layerGroups = [{
      groupId: 'group-1',
      groupType: 'polyObject',
      name: 'SoundObjects',
      layerCount: 1,
      isOpenableContainer: true,
      layers: [createMockScoreLayerSnapshot({
        layerId: 'layer-0',
        items: [createMockScoreRowObjectSnapshot({
          objectId: 'item-1',
          editorTarget: itemTarget,
          backgroundColor: 0x111111,
        })],
      })],
    }];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: snapshot.orchestra,
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [
          { target: locationTarget, backgroundColor: 0x990000 },
          { target: selectionTarget, backgroundColor: 0x009900 },
        ],
      },
    });

    expect(useProjectStore.getState().score.layerGroups[0].layers[0].items[0].backgroundColor)
      .toBe(0x111111);
  });

  it('rejects Pattern-source and selection aliases that resolve to the same source object', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    const patternTarget = createMockPatternSourceTarget({
      selectionId: 'pattern-source-1',
      patternSource: {
        groupId: 'pattern-group',
        layerId: 'pattern-layer',
        sourceObjectId: 'pattern-source-1',
      },
    });
    const patternLayer = createMockPatternLayerSnapshot({ layerId: 'pattern-layer' });
    patternLayer.sourceObject = {
      ...patternLayer.sourceObject,
      objectId: 'pattern-source-1',
      backgroundColor: 0x111111,
      editorTarget: patternTarget,
    };
    const selectionAlias = createMockScoreObjectTarget({
      selectionId: 'pattern-source-1',
      location: undefined,
    });

    snapshot.score.layerGroups = [{
      groupId: 'pattern-group',
      groupType: 'patterns',
      name: 'Patterns',
      layerCount: 1,
      isOpenableContainer: false,
      patternBeatsLength: 4,
      effectivePatternBeatsLength: 4,
      layers: [patternLayer],
    }];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: snapshot.orchestra,
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [
          { target: patternTarget, backgroundColor: 0x990000 },
          { target: selectionAlias, backgroundColor: 0x009900 },
        ],
      },
    });

    expect(useProjectStore.getState().score.layerGroups[0].layers[0].sourceObject.backgroundColor)
      .toBe(0x111111);
  });

  it('reconciles optimistic changes when canonical commit returns changed: false', async () => {
    const canonicalSnapshot = createEmptyProjectEditorSnapshot();
    const target1 = createMockScoreObjectTarget({
      selectionId: 'item-1',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    });

    canonicalSnapshot.score.layerGroups = [
      {
        groupId: 'group-1',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 1,
        isOpenableContainer: true,
        layers: [
          createMockScoreLayerSnapshot({
            layerId: 'layer-0',
            items: [createMockScoreRowObjectSnapshot({ objectId: 'item-1', editorTarget: target1, backgroundColor: 0x111111 })],
          }),
        ],
      },
    ];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: canonicalSnapshot.score,
      orchestra: canonicalSnapshot.orchestra,
      projectProperties: canonicalSnapshot.projectProperties,
      transport: canonicalSnapshot.transport,
    } as any);

    // Mock canonical returning changed: false and getProjectDocument returning original canonical
    (window.blueAPI.commitProjectDocumentPatches as any).mockResolvedValueOnce({
      revision: 1,
      sessionId: 0,
      changed: false,
    });
    (window.blueAPI.getProjectDocument as any).mockResolvedValueOnce(canonicalSnapshot);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [{ target: target1, backgroundColor: 0x990000 }],
      },
    });

    await expect(
      useProjectStore.getState().flushPendingPatches(),
    ).rejects.toThrow('Score object color change was not applied');

    // Optimistic change was reconciled back to canonical
    const score = useProjectStore.getState().score;
    expect(score.layerGroups[0].layers[0].items[0].backgroundColor).toBe(0x111111);
  });

  it('reconciles optimistic changes when canonical commit rejects with an error', async () => {
    const canonicalSnapshot = createEmptyProjectEditorSnapshot();
    const target1 = createMockScoreObjectTarget({
      selectionId: 'item-1',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    });

    canonicalSnapshot.score.layerGroups = [
      {
        groupId: 'group-1',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 1,
        isOpenableContainer: true,
        layers: [
          createMockScoreLayerSnapshot({
            layerId: 'layer-0',
            items: [createMockScoreRowObjectSnapshot({ objectId: 'item-1', editorTarget: target1, backgroundColor: 0x111111 })],
          }),
        ],
      },
    ];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: canonicalSnapshot.score,
      orchestra: canonicalSnapshot.orchestra,
      projectProperties: canonicalSnapshot.projectProperties,
      transport: canonicalSnapshot.transport,
    } as any);

    (window.blueAPI.commitProjectDocumentPatches as any).mockRejectedValueOnce(
      new Error('IPC network failure'),
    );
    (window.blueAPI.getProjectDocument as any).mockResolvedValueOnce(canonicalSnapshot);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [{ target: target1, backgroundColor: 0x990000 }],
      },
    });

    await expect(
      useProjectStore.getState().flushPendingPatches(),
    ).rejects.toThrow('IPC network failure');

    const score = useProjectStore.getState().score;
    expect(score.layerGroups[0].layers[0].items[0].backgroundColor).toBe(0x111111);
  });
});
