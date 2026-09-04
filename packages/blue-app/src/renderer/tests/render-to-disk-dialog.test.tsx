// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RenderToDiskDialog from '../components/workbench/panels/RenderToDiskDialog';
import { DISK_RENDER_OUTPUT_TAB, useRenderToDiskStore } from '../stores/render-to-disk-store';
import { useOutputStore } from '../stores/output-store';
import type { RenderOperationStatus } from '../../shared/render-freeze-contract';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function diskStatus(overrides: Partial<RenderOperationStatus>): RenderOperationStatus {
  return {
    operationId: 'disk-1',
    kind: 'diskRender',
    phase: 'rendering',
    message: 'Rendering to out.wav...',
    progress: 42,
    outputPath: '/tmp/out.wav',
    error: null,
    ...overrides,
  };
}

describe('RenderToDiskDialog', () => {
  let container: HTMLDivElement;
  let root: Root;
  let cancelRenderOperation: ReturnType<typeof vi.fn>;
  let statusCallback!: (status: RenderOperationStatus) => void;

  beforeEach(() => {
    cancelRenderOperation = vi.fn().mockResolvedValue(true);
    window.blueAPI = {
      cancelRenderOperation,
      onRenderOperationStatus: (callback: (status: RenderOperationStatus) => void) => {
        statusCallback = callback;
        return () => {};
      },
    } as typeof window.blueAPI;

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<RenderToDiskDialog />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useRenderToDiskStore.setState({
      open: false,
      operationId: null,
      phase: null,
      progress: null,
      message: '',
      outputPath: null,
      action: null,
      error: null,
      outputExpanded: false,
      cancelRequested: false,
    });
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
  });

  it('opens from the first status broadcast and tracks the render to completion', () => {
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(useRenderToDiskStore.getState().open).toBe(false);

    act(() => {
      statusCallback(
        diskStatus({
          phase: 'preparing',
          message: 'Generating disk CSD...',
          progress: 0,
        }),
      );
    });

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(useRenderToDiskStore.getState().operationId).toBe('disk-1');
    const title = container.querySelector('[data-testid="render-dialog-title"]') as HTMLElement;
    expect(title.textContent).toBe('Render to Disk - Running');
    expect(title.classList).toContain('text-role-title-2');
    expect(title.classList).toContain('font-bold');

    const table = container.querySelector('[data-testid="render-items-table"]') as HTMLTableElement;
    const headers = Array.from(table.querySelectorAll('th'));
    expect(headers.map((th) => th.textContent)).toEqual(['Output', 'Status']);
    for (const header of headers) {
      expect(header.classList).toContain('text-role-headline');
      expect(header.classList).toContain('font-bold');
    }
    const row = table.querySelector('tbody tr') as HTMLElement;
    expect(row.textContent).toContain('/tmp/out.wav');
    expect(row.textContent).toContain('Running');
    expect(row.querySelector('td')?.classList).toContain('text-role-body');

    const okButton = container.querySelector(
      '[data-testid="render-dialog-ok"]',
    ) as HTMLButtonElement;
    const cancelButton = container.querySelector(
      '[data-testid="render-dialog-cancel"]',
    ) as HTMLButtonElement;
    expect(okButton.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(false);
    expect(container.querySelector('[data-testid="render-dialog-summary"]')!.textContent).toBe(
      'Generating disk CSD... (0%)',
    );

    // The console mirrors the Csound (Disk) output tab and starts collapsed.
    act(() => {
      useOutputStore.getState().getOrCreateTab(DISK_RENDER_OUTPUT_TAB);
      useOutputStore.getState().appendToTab(DISK_RENDER_OUTPUT_TAB, 'csound line one\n', 'stdout');
      useOutputStore.getState().appendToTab(DISK_RENDER_OUTPUT_TAB, 'partial line', 'stderr');
    });
    expect(container.querySelector('[data-testid="render-output-text"]')).toBeNull();
    act(() => {
      (container.querySelector('[data-testid="render-output-toggle"]') as HTMLElement).click();
    });
    expect(
      container
        .querySelector('[data-testid="render-output-toggle"]')!
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(container.querySelector('[data-testid="render-output-text"]')!.textContent).toBe(
      'csound line one\npartial line',
    );

    act(() => {
      statusCallback(
        diskStatus({ phase: 'completed', message: 'Render complete.', progress: 100 }),
      );
    });

    expect(container.querySelector('[data-testid="render-dialog-title"]')!.textContent).toBe(
      'Render to Disk - Complete',
    );
    expect(container.querySelector('tbody tr')!.textContent).toContain('Complete');
    expect(
      (container.querySelector('[data-testid="render-dialog-ok"]') as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (container.querySelector('[data-testid="render-dialog-cancel"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(container.querySelector('[data-testid="render-dialog-summary"]')!.textContent).toBe(
      'Render complete.',
    );

    act(() => {
      (container.querySelector('[data-testid="render-dialog-ok"]') as HTMLElement).click();
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(useRenderToDiskStore.getState().open).toBe(false);
  });

  it('cancels the active render from the Cancel button and disables further cancels', () => {
    act(() => {
      statusCallback(
        diskStatus({ phase: 'preparing', progress: 0, message: 'Generating disk CSD...' }),
      );
    });

    act(() => {
      (container.querySelector('[data-testid="render-dialog-cancel"]') as HTMLElement).click();
    });
    expect(cancelRenderOperation).toHaveBeenCalledWith({ operationId: 'disk-1' });
    expect(
      (container.querySelector('[data-testid="render-dialog-cancel"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    act(() => {
      statusCallback(
        diskStatus({
          phase: 'cancelled',
          message: 'Render cancelled.',
          progress: null,
          outputPath: null,
        }),
      );
    });
    expect(container.querySelector('[data-testid="render-dialog-title"]')!.textContent).toBe(
      'Render to Disk - Cancelled',
    );
    expect(container.querySelector('tbody tr')!.textContent).toContain('Cancelled');
  });

  it('surfaces the error and marks the row failed when the render fails', () => {
    act(() => {
      statusCallback(
        diskStatus({ phase: 'preparing', progress: 0, message: 'Generating disk CSD...' }),
      );
      statusCallback(
        diskStatus({
          phase: 'failed',
          message: 'Csound exited with code 1. boom',
          progress: null,
          outputPath: null,
          error: 'Csound exited with code 1. boom',
        }),
      );
    });

    expect(container.querySelector('[data-testid="render-dialog-title"]')!.textContent).toBe(
      'Render to Disk - Failed',
    );
    expect(container.querySelector('tbody tr')!.textContent).toContain('Failed');
    expect(container.querySelector('[data-testid="render-dialog-error"]')!.textContent).toBe(
      'Csound exited with code 1. boom',
    );
    expect(
      (container.querySelector('[data-testid="render-dialog-ok"]') as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('ignores statuses for other operations and freeze statuses', () => {
    act(() => {
      statusCallback(
        diskStatus({ kind: 'freeze' as RenderOperationStatus['kind'], phase: 'rendering' }),
      );
    });
    expect(useRenderToDiskStore.getState().open).toBe(false);

    act(() => {
      statusCallback(
        diskStatus({ phase: 'preparing', progress: 0, message: 'Generating disk CSD...' }),
      );
    });
    expect(useRenderToDiskStore.getState().open).toBe(true);

    act(() => {
      statusCallback(
        diskStatus({
          operationId: 'disk-2',
          phase: 'rendering',
          message: 'Other render...',
          progress: 90,
        }),
      );
    });
    expect(container.querySelector('[data-testid="render-dialog-summary"]')!.textContent).toBe(
      'Generating disk CSD... (0%)',
    );
  });

  it('keeps a terminal dialog settled but still surfaces late open-command failures', () => {
    act(() => {
      statusCallback(
        diskStatus({ phase: 'preparing', progress: 0, message: 'Generating disk CSD...' }),
      );
      statusCallback(
        diskStatus({ phase: 'completed', message: 'Render complete.', progress: 100 }),
      );
    });

    // A late progress broadcast must not reopen the running state.
    act(() => {
      statusCallback(diskStatus({ phase: 'rendering', message: 'Rendering...', progress: 50 }));
    });
    expect(container.querySelector('[data-testid="render-dialog-title"]')!.textContent).toBe(
      'Render to Disk - Complete',
    );

    // The external Open command runs after completion and can report failure.
    act(() => {
      statusCallback(
        diskStatus({
          phase: 'failed',
          message: 'Open command failed: spawn ENOENT',
          progress: null,
          error: 'Open command failed: spawn ENOENT',
        }),
      );
    });
    expect(container.querySelector('[data-testid="render-dialog-title"]')!.textContent).toBe(
      'Render to Disk - Failed',
    );
    expect(container.querySelector('[data-testid="render-dialog-error"]')!.textContent).toBe(
      'Open command failed: spawn ENOENT',
    );
  });

  it('switches a settled dialog to a newly started operation and rejects old events', () => {
    act(() => {
      statusCallback(
        diskStatus({ phase: 'preparing', progress: 0, message: 'Generating first render...' }),
      );
      statusCallback(
        diskStatus({ phase: 'completed', message: 'First render complete.', progress: 100 }),
      );
      statusCallback(
        diskStatus({
          operationId: 'disk-2',
          phase: 'preparing',
          message: 'Generating second render...',
          progress: 0,
          outputPath: '/tmp/second.wav',
        }),
      );
    });

    expect(useRenderToDiskStore.getState().operationId).toBe('disk-2');
    expect(container.querySelector('[data-testid="render-dialog-title"]')!.textContent).toBe(
      'Render to Disk - Running',
    );
    expect(container.querySelector('[data-testid="render-dialog-summary"]')!.textContent).toBe(
      'Generating second render... (0%)',
    );
    expect(container.querySelector('[data-testid="render-row-output"]')!.textContent).toContain(
      '/tmp/second.wav',
    );

    act(() => {
      statusCallback(
        diskStatus({
          operationId: 'disk-1',
          phase: 'failed',
          message: 'First render failed late.',
          progress: null,
          outputPath: null,
          error: 'First render failed late.',
        }),
      );
    });
    expect(useRenderToDiskStore.getState().operationId).toBe('disk-2');
    expect(container.querySelector('[data-testid="render-dialog-summary"]')!.textContent).toBe(
      'Generating second render... (0%)',
    );
  });

  it('does not open in Dockview popout windows', () => {
    (window as { opener: unknown }).opener = {};
    try {
      act(() => {
        statusCallback(
          diskStatus({ phase: 'preparing', progress: 0, message: 'Generating disk CSD...' }),
        );
      });
      expect(useRenderToDiskStore.getState().open).toBe(false);
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      (window as { opener: unknown }).opener = null;
    }
  });
});
