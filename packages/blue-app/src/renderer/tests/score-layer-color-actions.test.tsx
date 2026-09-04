import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useProjectStore } from '../stores/project-store';
import { useScoreColorHistoryStore } from '../stores/score-color-history-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import {
  createMockScoreLayerSnapshot,
  createMockScoreRowObjectSnapshot,
  createMockScoreObjectTarget,
} from '../../shared/project-editor-layer-color-test-utils';
import {
  buildSetSelectionToLayerColorPatch,
  buildApplyLayerColorToAllClipsPatch,
} from '../components/workbench/panels/score/score-color-actions';

describe('Score Layer Color Actions UI & History (US3)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      blueAPI: {
        commitProjectDocumentPatches: vi.fn(async () => ({
          revision: 1,
          sessionId: 0,
          changed: true,
        })),
        getProjectDocument: vi.fn(),
      },
    });
    useProjectStore.getState().clearProject();
    useScoreColorHistoryStore.getState().reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('records a single undoable history entry when applying layer color to selection and undoes it', async () => {
    const target = createMockScoreObjectTarget({
      selectionId: 'item-1',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    });
    const item = createMockScoreRowObjectSnapshot({
      objectId: 'item-1',
      editorTarget: target,
      backgroundColor: -16711936, // Green
    });

    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.score.layerGroups = [
      {
        groupId: 'group-1',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 1,
        isOpenableContainer: true,
        layers: [
          createMockScoreLayerSnapshot({
            layerId: 'layer-0',
            backgroundColor: -65536, // Red
            items: [item],
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

    const patchPair = buildSetSelectionToLayerColorPatch({
      selection: [item],
      layerGroups: snapshot.score.layerGroups,
    });
    expect(patchPair).not.toBeNull();

    // Dispatch forward patch and push history after flush
    await useProjectStore.getState().applyProjectDocumentPatch(patchPair!.forward);
    await useProjectStore.getState().flushPendingPatches();
    useScoreColorHistoryStore.getState().pushEntry({
      label: 'Set to Layer Color',
      forward: patchPair!.forward,
      inverse: patchPair!.inverse,
    });

    expect(useScoreColorHistoryStore.getState().canUndo).toBe(true);
    expect(useProjectStore.getState().score.layerGroups[0].layers[0].items[0].backgroundColor).toBe(
      -65536,
    );

    // Undo action
    const undone = await useScoreColorHistoryStore.getState().undo();
    expect(undone).toBe(true);
    expect(useProjectStore.getState().score.layerGroups[0].layers[0].items[0].backgroundColor).toBe(
      -16711936,
    );
  });

  it('does not record history entry if patch commit is rejected by backend', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    const item = createMockScoreRowObjectSnapshot({
      objectId: 'clip-1',
      backgroundColor: -16711936,
      editorTarget: createMockScoreObjectTarget({ selectionId: 'clip-1' }),
    });

    snapshot.score.layerGroups = [
      {
        groupId: 'group-1',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 1,
        isOpenableContainer: true,
        layers: [
          createMockScoreLayerSnapshot({
            layerId: 'layer-0',
            backgroundColor: -65536,
            items: [item],
          }),
        ],
      },
    ];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: snapshot.orchestra,
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    (window.blueAPI.commitProjectDocumentPatches as any).mockResolvedValueOnce({
      revision: 1,
      sessionId: 0,
      changed: false,
    });
    (window.blueAPI.getProjectDocument as any).mockResolvedValueOnce(snapshot);

    const patchPair = buildSetSelectionToLayerColorPatch({
      selection: [item],
      layerGroups: snapshot.score.layerGroups,
    });
    expect(patchPair).not.toBeNull();

    let recorded = false;
    try {
      await useProjectStore.getState().applyProjectDocumentPatch(patchPair!.forward);
      await useProjectStore.getState().flushPendingPatches();
      useScoreColorHistoryStore.getState().pushEntry({
        label: 'Set to Layer Color',
        forward: patchPair!.forward,
        inverse: patchPair!.inverse,
      });
      recorded = true;
    } catch {
      // Rejection expected
    }

    expect(recorded).toBe(false);
    expect(useScoreColorHistoryStore.getState().canUndo).toBe(false);
    expect(useScoreColorHistoryStore.getState().entries).toHaveLength(0);
  });
});
