import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useScoreColorHistoryStore,
  type ScoreColorHistoryEntry,
} from '../stores/score-color-history-store';
import { useProjectStore } from '../stores/project-store';

describe('Score Color History Store', () => {
  beforeEach(() => {
    useScoreColorHistoryStore.getState().reset();
  });

  it('starts empty with canUndo and canRedo false', () => {
    const state = useScoreColorHistoryStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.entries).toHaveLength(0);
  });

  it('records one entry for a valid color change and enables undo', () => {
    const entry: ScoreColorHistoryEntry = {
      label: 'Change Layer Color',
      forward: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -16711936 },
        },
      },
      inverse: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -12566464 },
        },
      },
    };

    useScoreColorHistoryStore.getState().pushEntry(entry);

    const state = useScoreColorHistoryStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);
    expect(state.entries).toHaveLength(1);
    expect(state.cursor).toBe(0);
  });

  it('suppresses no-op entries where forward and inverse are identical', () => {
    const noOpEntry: ScoreColorHistoryEntry = {
      label: 'No-op Color Change',
      forward: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -12566464 },
        },
      },
      inverse: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -12566464 },
        },
      },
    };

    useScoreColorHistoryStore.getState().pushEntry(noOpEntry);

    const state = useScoreColorHistoryStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.entries).toHaveLength(0);
  });

  it('undo submits inverse patch and adjusts cursor, redo submits forward patch', async () => {
    const applyPatchSpy = vi.spyOn(useProjectStore.getState(), 'applyProjectDocumentPatch')
      .mockResolvedValue(true as any);

    const entry: ScoreColorHistoryEntry = {
      label: 'Change Layer Color',
      forward: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -65536 },
        },
      },
      inverse: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -12566464 },
        },
      },
    };

    useScoreColorHistoryStore.getState().pushEntry(entry);
    expect(useScoreColorHistoryStore.getState().canUndo).toBe(true);

    // Undo
    const undoSuccess = await useScoreColorHistoryStore.getState().undo();
    expect(undoSuccess).toBe(true);
    expect(applyPatchSpy).toHaveBeenCalledWith(entry.inverse);
    expect(useScoreColorHistoryStore.getState().canUndo).toBe(false);
    expect(useScoreColorHistoryStore.getState().canRedo).toBe(true);
    expect(useScoreColorHistoryStore.getState().cursor).toBe(-1);

    // Redo
    const redoSuccess = await useScoreColorHistoryStore.getState().redo();
    expect(redoSuccess).toBe(true);
    expect(applyPatchSpy).toHaveBeenCalledWith(entry.forward);
    expect(useScoreColorHistoryStore.getState().canUndo).toBe(true);
    expect(useScoreColorHistoryStore.getState().canRedo).toBe(false);
    expect(useScoreColorHistoryStore.getState().cursor).toBe(0);

    applyPatchSpy.mockRestore();
  });

  it('does not advance cursor if patch application fails', async () => {
    const applyPatchSpy = vi.spyOn(useProjectStore.getState(), 'applyProjectDocumentPatch')
      .mockResolvedValue(false as any);

    const entry: ScoreColorHistoryEntry = {
      label: 'Change Layer Color',
      forward: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -65536 },
        },
      },
      inverse: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -12566464 },
        },
      },
    };

    useScoreColorHistoryStore.getState().pushEntry(entry);

    const undoSuccess = await useScoreColorHistoryStore.getState().undo();
    expect(undoSuccess).toBe(false);
    // Cursor must NOT have changed
    expect(useScoreColorHistoryStore.getState().cursor).toBe(0);
    expect(useScoreColorHistoryStore.getState().canUndo).toBe(true);

    applyPatchSpy.mockRestore();
  });

  it('does not advance cursor if flushPendingPatches rejects during undo or redo', async () => {
    const applyPatchSpy = vi.spyOn(useProjectStore.getState(), 'applyProjectDocumentPatch')
      .mockResolvedValue(undefined as any);
    const flushSpy = vi.spyOn(useProjectStore.getState(), 'flushPendingPatches')
      .mockRejectedValue(new Error('Rejected by canonical backend'));

    const entry: ScoreColorHistoryEntry = {
      label: 'Change Layer Color',
      forward: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -65536 },
        },
      },
      inverse: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -12566464 },
        },
      },
    };

    useScoreColorHistoryStore.getState().pushEntry(entry);
    expect(useScoreColorHistoryStore.getState().cursor).toBe(0);

    const undoSuccess = await useScoreColorHistoryStore.getState().undo();
    expect(undoSuccess).toBe(false);
    expect(applyPatchSpy).not.toHaveBeenCalled();
    expect(useScoreColorHistoryStore.getState().cursor).toBe(0);
    expect(useScoreColorHistoryStore.getState().canUndo).toBe(true);

    flushSpy.mockRestore();
    applyPatchSpy.mockRestore();
  });

  it('does not move the cursor when the inverse acknowledgement fails after a successful flush', async () => {
    const applyPatchSpy = vi.spyOn(useProjectStore.getState(), 'applyProjectDocumentPatch')
      .mockResolvedValue(undefined as any);
    const flushSpy = vi.spyOn(useProjectStore.getState(), 'flushPendingPatches')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('inverse was rejected'));

    const entry: ScoreColorHistoryEntry = {
      label: 'Change Layer Color',
      forward: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -65536 },
        },
      },
      inverse: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -12566464 },
        },
      },
    };

    useScoreColorHistoryStore.getState().pushEntry(entry);

    await expect(useScoreColorHistoryStore.getState().undo()).resolves.toBe(false);
    expect(applyPatchSpy).toHaveBeenCalledWith(entry.inverse);
    expect(flushSpy).toHaveBeenCalledTimes(2);
    expect(useScoreColorHistoryStore.getState().cursor).toBe(0);
    expect(useScoreColorHistoryStore.getState().canUndo).toBe(true);
    expect(useScoreColorHistoryStore.getState().canRedo).toBe(false);

    flushSpy.mockRestore();
    applyPatchSpy.mockRestore();
  });

  it('aborts redo before submitting when its prerequisite flush fails', async () => {
    const applyPatchSpy = vi.spyOn(useProjectStore.getState(), 'applyProjectDocumentPatch')
      .mockResolvedValue(undefined as any);
    const flushSpy = vi.spyOn(useProjectStore.getState(), 'flushPendingPatches')
      .mockResolvedValue(undefined);

    const entry: ScoreColorHistoryEntry = {
      label: 'Change Layer Color',
      forward: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -65536 },
        },
      },
      inverse: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -12566464 },
        },
      },
    };

    useScoreColorHistoryStore.getState().pushEntry(entry);
    await expect(useScoreColorHistoryStore.getState().undo()).resolves.toBe(true);
    expect(useScoreColorHistoryStore.getState().cursor).toBe(-1);

    applyPatchSpy.mockClear();
    flushSpy.mockRejectedValue(new Error('redo prerequisite rejected'));
    await expect(useScoreColorHistoryStore.getState().redo()).resolves.toBe(false);
    expect(applyPatchSpy).not.toHaveBeenCalled();
    expect(useScoreColorHistoryStore.getState().cursor).toBe(-1);

    flushSpy.mockRestore();
    applyPatchSpy.mockRestore();
  });

  it('bounds history stack to maximum 100 entries', () => {
    for (let i = 0; i < 110; i++) {
      useScoreColorHistoryStore.getState().pushEntry({
        label: `Color Change ${i}`,
        forward: {
          score: {
            type: 'updateLayerState',
            groupId: 'group-1',
            layerIndex: 0,
            patch: { backgroundColor: i + 1 },
          },
        },
        inverse: {
          score: {
            type: 'updateLayerState',
            groupId: 'group-1',
            layerIndex: 0,
            patch: { backgroundColor: i },
          },
        },
      });
    }

    const state = useScoreColorHistoryStore.getState();
    expect(state.entries.length).toBe(100);
    expect(state.cursor).toBe(99);
  });

  it('clears stack and resets cursor on reset()', () => {
    useScoreColorHistoryStore.getState().pushEntry({
      label: 'Color Change',
      forward: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -65536 },
        },
      },
      inverse: {
        score: {
          type: 'updateLayerState',
          groupId: 'group-1',
          layerIndex: 0,
          patch: { backgroundColor: -12566464 },
        },
      },
    });

    expect(useScoreColorHistoryStore.getState().entries).toHaveLength(1);
    useScoreColorHistoryStore.getState().reset();
    expect(useScoreColorHistoryStore.getState().entries).toHaveLength(0);
    expect(useScoreColorHistoryStore.getState().canUndo).toBe(false);
    expect(useScoreColorHistoryStore.getState().cursor).toBe(-1);
  });
});
