// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FreezeOperationDialog from '../components/workbench/panels/FreezeOperationDialog';
import type { ScoreObjectClipboardEntry } from '../stores/score-selection-store';
import { useFreezeOperationStore } from '../stores/freeze-operation-store';
import { useProjectStore } from '../stores/project-store';
import type { FreezeItemStatus, RenderOperationStatus } from '../../shared/render-freeze-contract';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const originalProjectState = useProjectStore.getState();

function entry(overrides: {
  selectionId: string;
  name: string;
  frozen?: boolean;
}): ScoreObjectClipboardEntry {
  return {
    objectId: overrides.selectionId,
    objectType: overrides.frozen ? 'FrozenSoundObject' : 'GenericScore',
    name: overrides.name,
    startBeats: 0,
    durationBeats: 2,
    backgroundColor: 0x336699,
    isContainer: false,
    layerIndex: 0,
    groupId: 'root',
    editorTarget: {
      selectionId: overrides.selectionId,
      selectedObjectType: overrides.frozen ? 'FrozenSoundObject' : 'GenericScore',
      editorObjectType: overrides.frozen ? 'FrozenSoundObject' : 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    },
    barRenderer: overrides.frozen
      ? {
        kind: 'frozenSoundObject' as const,
        labelLines: [overrides.name],
        frozenWaveFileName: 'freeze0.aif',
        waveformKey: null,
        originalDurationBeats: null,
        currentDurationBeats: 2,
      }
      : {
        kind: 'fallback' as const,
        labelLines: [overrides.name],
        reason: 'unknown-type',
      },
  };
}

function freezeItem(operationId: string, overrides: Partial<FreezeItemStatus>): FreezeItemStatus {
  return {
    operationId,
    selectionId: 'score-1',
    name: 'Pattern 1',
    action: 'freeze',
    phase: 'running',
    freezeFile: null,
    reason: null,
    outputAppend: null,
    outputType: null,
    ...overrides,
  };
}

function operationStatus(operationId: string, overrides: Partial<RenderOperationStatus>): RenderOperationStatus {
  return {
    operationId,
    kind: 'freeze',
    phase: 'rendering',
    message: 'Freezing object 1 of 2...',
    progress: 10,
    outputPath: null,
    error: null,
    ...overrides,
  };
}

describe('FreezeOperationDialog', () => {
  let container: HTMLDivElement;
  let root: Root;
  let freezeScoreObjects: ReturnType<typeof vi.fn>;
  let cancelRenderOperation: ReturnType<typeof vi.fn>;
  let statusCallback!: (status: RenderOperationStatus) => void;
  let itemCallback!: (item: FreezeItemStatus) => void;

  beforeEach(() => {
    freezeScoreObjects = vi.fn().mockReturnValue(new Promise(() => {}));
    cancelRenderOperation = vi.fn().mockResolvedValue(true);
    window.blueAPI = {
      freezeScoreObjects,
      cancelRenderOperation,
      onRenderOperationStatus: (callback: (status: RenderOperationStatus) => void) => {
        statusCallback = callback;
        return () => {};
      },
      onFreezeItemStatus: (callback: (item: FreezeItemStatus) => void) => {
        itemCallback = callback;
        return () => {};
      },
    } as typeof window.blueAPI;
    useProjectStore.setState({
      flushPendingPatches: vi.fn().mockResolvedValue(undefined),
    } as Partial<ReturnType<typeof useProjectStore.getState>>);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<FreezeOperationDialog />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useProjectStore.setState({
      flushPendingPatches: originalProjectState.flushPendingPatches,
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    useFreezeOperationStore.setState({
      open: false,
      operationId: null,
      phase: null,
      progress: null,
      message: '',
      rows: [],
      selectedSelectionId: null,
      selectionLocked: false,
      outputExpanded: false,
      result: null,
      error: null,
      cancelRequested: false,
    });
  });

  async function beginOperation(entries: ScoreObjectClipboardEntry[]): Promise<string> {
    await act(async () => {
      void useFreezeOperationStore.getState().start(entries);
      // Settle the patch flush without awaiting the never-resolving freeze IPC
      // promise used by these tests.
      await Promise.resolve();
      await Promise.resolve();
    });
    const operationId = useFreezeOperationStore.getState().operationId;
    expect(operationId).toMatch(/^freeze-/);
    return operationId!;
  }

  function dialogElement(): HTMLElement {
    return container.querySelector('[role="dialog"]') as HTMLElement;
  }

  it('tracks rows, buttons, and title from running through completion', async () => {
    const entries = [
      entry({ selectionId: 'score-1', name: 'Pattern 1' }),
      entry({ selectionId: 'frozen-1', name: 'F: Frozen', frozen: true }),
    ];
    const operationId = await beginOperation(entries);

    const dialog = dialogElement();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(container.querySelector('[data-testid="freeze-dialog-title"]')!.textContent)
      .toBe('Freeze/Unfreeze - Running');

    const table = container.querySelector('[data-testid="freeze-items-table"]') as HTMLTableElement;
    const headerText = Array.from(table.querySelectorAll('th')).map((th) => th.textContent);
    expect(headerText).toEqual(['Object', 'Freeze File', 'Status']);

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('Pattern 1');
    expect(rows[0]!.textContent).toContain('Waiting');
    expect(rows[1]!.textContent).toContain('F: Frozen');
    expect(rows[1]!.textContent).toContain('freeze0.aif');

    const okButton = container.querySelector('[data-testid="freeze-dialog-ok"]') as HTMLButtonElement;
    const cancelButton = container.querySelector('[data-testid="freeze-dialog-cancel"]') as HTMLButtonElement;
    expect(okButton.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(false);

    act(() => {
      itemCallback(freezeItem(operationId, { phase: 'pending', selectionId: 'score-1' }));
      itemCallback(freezeItem(operationId, { phase: 'running', selectionId: 'score-1' }));
      itemCallback(freezeItem(operationId, {
        selectionId: 'score-1',
        outputAppend: 'csound rendering line\n',
        outputType: 'stderr',
      }));
      itemCallback(freezeItem(operationId, {
        phase: 'complete',
        selectionId: 'score-1',
        freezeFile: 'freeze1.aif',
      }));
    });

    expect(useFreezeOperationStore.getState().rows[0]).toMatchObject({
      status: 'complete',
      freezeFile: 'freeze1.aif',
      output: 'csound rendering line\n',
    });

    // Output console is collapsed by default and expands through the chevron.
    expect(container.querySelector('[data-testid="freeze-output-text"]')).toBeNull();
    act(() => {
      (container.querySelector('[data-testid="freeze-output-toggle"]') as HTMLElement).click();
    });
    const outputText = container.querySelector('[data-testid="freeze-output-text"]') as HTMLElement;
    expect(outputText.textContent).toBe('csound rendering line\n');
    expect(container.querySelector('[data-testid="freeze-output-toggle"]')!.getAttribute('aria-expanded'))
      .toBe('true');

    // Selecting another row switches the console to that row's output.
    act(() => {
      (container.querySelector('[data-testid="freeze-row-frozen-1"]') as HTMLElement).click();
    });
    expect(container.querySelector('[data-testid="freeze-output-text"]')!.textContent).toBe('');

    act(() => {
      statusCallback(operationStatus(operationId, { phase: 'completed', message: 'Freeze/unfreeze complete.', progress: 100 }));
    });

    expect(container.querySelector('[data-testid="freeze-dialog-title"]')!.textContent)
      .toBe('Freeze/Unfreeze - Complete');
    expect((container.querySelector('[data-testid="freeze-dialog-ok"]') as HTMLButtonElement).disabled).toBe(false);
    expect((container.querySelector('[data-testid="freeze-dialog-cancel"]') as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      (container.querySelector('[data-testid="freeze-dialog-ok"]') as HTMLElement).click();
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(useFreezeOperationStore.getState().open).toBe(false);
  });

  it('uses the Freezing verb for freeze-only operations', async () => {
    await beginOperation([entry({ selectionId: 'score-1', name: 'Pattern 1' })]);
    expect(container.querySelector('[data-testid="freeze-dialog-title"]')!.textContent)
      .toBe('Freezing - Running');
  });

  it('uses the Unfreezing verb for unfreeze-only operations', async () => {
    await beginOperation([entry({ selectionId: 'frozen-1', name: 'F: Frozen', frozen: true })]);
    expect(container.querySelector('[data-testid="freeze-dialog-title"]')!.textContent)
      .toBe('Unfreezing - Running');
  });

  it('cancels the active operation from the Cancel button', async () => {
    const operationId = await beginOperation([entry({ selectionId: 'score-1', name: 'Pattern 1' })]);

    act(() => {
      (container.querySelector('[data-testid="freeze-dialog-cancel"]') as HTMLElement).click();
    });
    expect(cancelRenderOperation).toHaveBeenCalledWith({ operationId });

    act(() => {
      statusCallback(operationStatus(operationId, { phase: 'cancelled', message: 'Freeze operation cancelled.', progress: null }));
    });
    expect(container.querySelector('[data-testid="freeze-dialog-title"]')!.textContent)
      .toBe('Freezing - Cancelled');
    expect(container.querySelector('tbody tr')!.textContent).toContain('Cancelled');
  });

  it('marks unfinished rows not applied and surfaces the error when the operation fails', async () => {
    const operationId = await beginOperation([entry({ selectionId: 'score-1', name: 'Pattern 1' })]);

    act(() => {
      itemCallback(freezeItem(operationId, { phase: 'running', selectionId: 'score-1' }));
      statusCallback(operationStatus(operationId, {
        phase: 'failed',
        message: 'Freeze/unfreeze did not change the project.',
        progress: null,
        error: 'Csound exited with code 1.',
      }));
    });

    expect(container.querySelector('[data-testid="freeze-dialog-title"]')!.textContent)
      .toBe('Freezing - Failed');
    expect(container.querySelector('tbody tr')!.textContent).toContain('Not applied');
    expect(container.querySelector('[data-testid="freeze-dialog-error"]')!.textContent)
      .toBe('Csound exited with code 1.');
    expect((container.querySelector('[data-testid="freeze-dialog-ok"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('merges item details delivered after the terminal status', async () => {
    const operationId = await beginOperation([entry({ selectionId: 'score-1', name: 'Pattern 1' })]);

    act(() => {
      statusCallback(operationStatus(operationId, {
        phase: 'completed',
        message: 'Freeze/unfreeze complete.',
        progress: 100,
      }));
      itemCallback(freezeItem(operationId, {
        phase: 'complete',
        freezeFile: 'freeze9.aif',
        outputAppend: 'late output\n',
        outputType: 'stderr',
      }));
    });

    expect(useFreezeOperationStore.getState().rows[0]).toMatchObject({
      status: 'complete',
      freezeFile: 'freeze9.aif',
      output: 'late output\n',
    });
  });

  it('shows a failure when pending project patches cannot be flushed', async () => {
    const flushPendingPatches = vi.fn().mockRejectedValue(new Error('project commit failed'));
    useProjectStore.setState({ flushPendingPatches } as Partial<ReturnType<typeof useProjectStore.getState>>);

    await act(async () => {
      await useFreezeOperationStore.getState().start([entry({ selectionId: 'score-1', name: 'Pattern 1' })]);
    });

    expect(flushPendingPatches).toHaveBeenCalledOnce();
    expect(freezeScoreObjects).not.toHaveBeenCalled();
    expect(useFreezeOperationStore.getState()).toMatchObject({
      open: true,
      phase: 'failed',
      error: 'project commit failed',
    });
    expect(container.querySelector('[data-testid="freeze-dialog-error"]')!.textContent)
      .toBe('project commit failed');
  });

  it('cancels before starting IPC when the user cancels during startup', async () => {
    let releaseFlush!: () => void;
    const flushPendingPatches = vi.fn(() => new Promise<void>((resolve) => {
      releaseFlush = resolve;
    }));
    useProjectStore.setState({ flushPendingPatches } as Partial<ReturnType<typeof useProjectStore.getState>>);

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = useFreezeOperationStore.getState().start([
        entry({ selectionId: 'score-1', name: 'Pattern 1' }),
      ]);
    });

    const cancelButton = container.querySelector('[data-testid="freeze-dialog-cancel"]') as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(false);
    act(() => { cancelButton.click(); });
    expect(cancelButton.disabled).toBe(true);
    expect(cancelRenderOperation).toHaveBeenCalledWith({
      operationId: useFreezeOperationStore.getState().operationId,
    });

    releaseFlush();
    await act(async () => { await startPromise; });

    expect(useFreezeOperationStore.getState()).toMatchObject({
      phase: 'cancelled',
      cancelRequested: true,
    });
    expect(freezeScoreObjects).not.toHaveBeenCalled();
  });

  it('does not start an operation without eligible entries', async () => {
    const entryWithoutTarget: ScoreObjectClipboardEntry = {
      ...entry({ selectionId: 'score-1', name: 'Pattern 1' }),
      editorTarget: undefined,
    };
    await act(async () => {
      void useFreezeOperationStore.getState().start([entryWithoutTarget]);
      await Promise.resolve();
    });
    expect(useFreezeOperationStore.getState().open).toBe(false);
    expect(freezeScoreObjects).not.toHaveBeenCalled();
  });
});
