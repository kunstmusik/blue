// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

import ScoreTimeCanvas from '../components/workbench/panels/score/layer-groups/ScoreTimeCanvas';
import type {
  PolyObjectLayerGroupSnapshot,
  ScoreRowObjectSnapshot,
} from '../components/workbench/panels/score/types';
import { useProjectStore } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { useLibraryStore } from '../stores/library-store';
import { useFreezeOperationStore } from '../stores/freeze-operation-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const originalProjectState = useProjectStore.getState();

function groupWithObject(): PolyObjectLayerGroupSnapshot {
  const target = {
    selectionId: 'score-1',
    selectedObjectType: 'GenericScore',
    editorObjectType: 'GenericScore',
    ownerKind: 'timeline' as const,
    displayContext: 'timeline' as const,
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
  const item: ScoreRowObjectSnapshot = {
    objectId: 'score-1',
    objectType: 'GenericScore',
    name: 'Freeze me',
    startBeats: 0,
    durationBeats: 2,
    startTimeBase: 'BEATS',
    durationTimeBase: 'BEATS',
    backgroundColor: 0x336699,
    isContainer: false,
    editorTarget: target,
    barRenderer: { kind: 'fallback', labelLines: ['Freeze me'], reason: 'unknown-type' },
  };
  const instance: ScoreRowObjectSnapshot = {
    objectId: 'instance-1',
    objectType: 'Instance',
    name: 'Linked instance',
    startBeats: 4,
    durationBeats: 2,
    startTimeBase: 'BEATS',
    durationTimeBase: 'BEATS',
    backgroundColor: 0x336699,
    isContainer: false,
    editorTarget: {
      selectionId: 'instance-1',
      selectedObjectType: 'Instance',
      editorObjectType: 'GenericScore',
      ownerKind: 'library',
      displayContext: 'instance',
      sourceInstanceLocation: {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 1,
      },
      library: { libraryId: 'library-1', libraryIndex: 0, objectType: 'GenericScore' },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    },
    barRenderer: { kind: 'fallback', labelLines: ['Linked instance'], reason: 'unknown-type' },
  };
  return {
    groupId: 'root',
    groupType: 'polyObject',
    name: 'Root',
    layerCount: 1,
    isOpenableContainer: true,
    layers: [
      {
        layerId: 'root-layer-0',
        name: 'Layer 1',
        height: 44,
        muted: false,
        solo: false,
        items: [item, instance],
      },
    ],
  };
}

describe('render/freeze renderer actions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let freezeScoreObjects: ReturnType<typeof vi.fn>;
  let cancelRenderOperation: ReturnType<typeof vi.fn>;
  let captureScoreSoundObjectClipboard: ReturnType<typeof vi.fn>;
  let addScoreSoundObjectToProjectLibrary: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const group = groupWithObject();
    freezeScoreObjects = vi.fn().mockResolvedValue({
      ok: true,
      operationId: 'freeze-1',
      cancelled: false,
      frozenCount: 1,
      unfrozenCount: 0,
      deletedFiles: [],
      rejectedTargets: [],
      error: null,
      project: null,
    });
    cancelRenderOperation = vi.fn().mockResolvedValue(true);
    captureScoreSoundObjectClipboard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        operation: 'copy',
        source: { kind: 'buffer', clipboardId: 'timeline-sound-1', libraryType: 'soundObject' },
        capturedAt: 1,
      },
    });
    addScoreSoundObjectToProjectLibrary = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        projectSessionId: 1,
        projectRevision: 2,
        libraryType: 'soundObject',
        insertedIdentity: 'lib_1',
        message: 'Freeze me was added to Project SoundObjects.',
      },
    });
    window.blueAPI = {
      freezeScoreObjects,
      cancelRenderOperation,
      captureScoreSoundObjectClipboard,
      addScoreSoundObjectToProjectLibrary,
      onRenderOperationStatus: () => () => {},
      onFreezeItemStatus: () => () => {},
    } as typeof window.blueAPI;
    useProjectStore.setState({
      score: { ...originalProjectState.score, layerGroups: [group] },
      flushPendingPatches: vi.fn().mockResolvedValue(undefined),
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    useScoreSelectionStore
      .getState()
      .setSelection([
        { objectId: 'score-1', editorTarget: group.layers[0]!.items[0]!.editorTarget },
      ]);
    useLibraryStore.setState({ clipboard: null, error: null });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ScoreTimeCanvas
          projectSessionId={1}
          projectRevision={1}
          scoreRootGroupId="group-1"
          scoreContainerPath={[]}
          group={group}
          totalBeats={16}
          pixelsPerBeat={50}
          snapEnabled={false}
          snapValue="BEAT"
          tempo={120}
          smpteFrameRate={30}
          meterMap={{ entries: [{ measure: 0, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
        />,
      );
    });
    const surface = container.querySelector('[data-group-id="root"]') as HTMLDivElement;
    Object.defineProperty(surface, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 80,
        width: 800,
        height: 80,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useScoreSelectionStore.getState().clearSelection();
    useProjectStore.setState({
      score: originalProjectState.score,
      flushPendingPatches: originalProjectState.flushPendingPatches,
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    useFreezeOperationStore.getState().close();
    useFreezeOperationStore.setState({
      open: false,
      operationId: null,
      phase: null,
      progress: null,
      message: '',
      rows: [],
      selectedSelectionId: null,
      outputExpanded: false,
      result: null,
      error: null,
      cancelRequested: false,
    });
  });

  it('sends selected timeline targets through the freeze IPC action and tracks them in the operation dialog store', async () => {
    const surface = container.querySelector('[data-group-id="root"]') as HTMLDivElement;
    act(() => {
      surface.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
        }),
      );
    });
    const action = Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) =>
      item.textContent?.includes('Freeze/Unfreeze ScoreObjects'),
    ) as HTMLElement;
    expect(action).toBeTruthy();

    await act(async () => {
      action.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(freezeScoreObjects).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: expect.stringMatching(/^freeze-/),
        targets: [expect.objectContaining({ selectionId: 'score-1', ownerKind: 'timeline' })],
      }),
    );
    const operationId = freezeScoreObjects.mock.calls[0]![0].operationId;

    const state = useFreezeOperationStore.getState();
    expect(state.open).toBe(true);
    expect(state.operationId).toBe(operationId);
    expect(state.phase).toBe('completed');
    expect(state.rows).toEqual([
      expect.objectContaining({
        selectionId: 'score-1',
        name: 'Freeze me',
        action: 'freeze',
        status: 'complete',
      }),
    ]);

    // Freeze/unfreeze no longer surfaces toasts; the dialog owns all reporting.
    expect(toast.loading).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalledWith(
      'Freeze/unfreeze complete: 1 frozen.',
      expect.anything(),
    );

    // A late status broadcast must not regress the settled dialog state.
    act(() => {
      useFreezeOperationStore.getState().handleStatus({
        operationId,
        kind: 'freeze',
        phase: 'preparing',
        message: 'Resolving selected objects...',
        progress: 0,
        outputPath: null,
        error: null,
      });
    });
    expect(useFreezeOperationStore.getState().phase).toBe('completed');
  });

  it('copies one selected timeline SoundObject into the shared Library clipboard', async () => {
    const surface = container.querySelector('[data-group-id="root"]') as HTMLDivElement;
    act(() => {
      surface.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
        }),
      );
    });
    const action = Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) =>
      item.textContent?.startsWith('Copy'),
    ) as HTMLElement;

    await act(async () => {
      action.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(captureScoreSoundObjectClipboard).toHaveBeenCalledWith({
      projectSessionId: 1,
      projectRevision: 1,
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    });
    expect(useLibraryStore.getState().clipboard?.source).toMatchObject({
      kind: 'buffer',
      libraryType: 'soundObject',
    });
  });

  it('adds the selected timeline SoundObject to the project library without a placeholder alert', async () => {
    const surface = container.querySelector('[data-group-id="root"]') as HTMLDivElement;
    act(() => {
      surface.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
        }),
      );
    });
    const action = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
      (item) => item.textContent === 'Add to Project SoundObjects',
    ) as HTMLElement;

    await act(async () => {
      action.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(addScoreSoundObjectToProjectLibrary).toHaveBeenCalledWith({
      projectSessionId: 1,
      projectRevision: 1,
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    });
    expect(toast.success).toHaveBeenCalledWith('Freeze me was added to Project SoundObjects.');
  });

  it('disables adding an Instance under the context-menu pointer to the project library', async () => {
    const surface = container.querySelector('[data-group-id="root"]') as HTMLDivElement;
    act(() => {
      surface.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 210,
          clientY: 10,
        }),
      );
    });
    const action = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
      (item) => item.textContent === 'Add to Project SoundObjects',
    ) as HTMLElement;

    expect(action.classList.contains('editor-context-menu__item')).toBe(true);
    expect(action.closest('.editor-context-menu')).not.toBeNull();
    expect(action.getAttribute('data-disabled')).not.toBeNull();
    await act(async () => {
      action.click();
      await Promise.resolve();
    });
    expect(addScoreSoundObjectToProjectLibrary).not.toHaveBeenCalled();
  });

  it('can cancel an in-flight freeze using the renderer-owned operation id', async () => {
    let finishFreeze!: (
      value: Awaited<ReturnType<typeof window.blueAPI.freezeScoreObjects>>,
    ) => void;
    freezeScoreObjects.mockReturnValue(
      new Promise((resolve) => {
        finishFreeze = resolve;
      }),
    );
    const surface = container.querySelector('[data-group-id="root"]') as HTMLDivElement;

    act(() => {
      surface.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
        }),
      );
    });
    const startAction = Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) =>
      item.textContent?.includes('Freeze/Unfreeze ScoreObjects'),
    ) as HTMLElement;
    await act(async () => {
      startAction.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const request = freezeScoreObjects.mock.calls[0]![0];
    expect(useFreezeOperationStore.getState().phase).toBe('preparing');

    // The context menu no longer offers a cancel entry; the progress dialog's
    // Cancel button drives the store cancel action.
    act(() => {
      useFreezeOperationStore.getState().cancel();
    });
    expect(cancelRenderOperation).toHaveBeenCalledWith({ operationId: request.operationId });

    await act(async () => {
      finishFreeze({
        ok: false,
        operationId: request.operationId,
        cancelled: true,
        frozenCount: 0,
        unfrozenCount: 0,
        deletedFiles: [],
        rejectedTargets: [],
        error: null,
        project: null,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    const state = useFreezeOperationStore.getState();
    expect(state.phase).toBe('cancelled');
    expect(state.rows[0]!.status).toBe('cancelled');
    expect(toast.message).not.toHaveBeenCalled();
  });
});
