// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScratchPadPanel from '../components/workbench/panels/ScratchPadPanel';
import {
  __testClearPendingPatches,
  useProjectStore,
} from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import { getPanel } from '../../shared/workbench-menu';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let commitProjectDocumentPatches: ReturnType<typeof vi.fn>;

function renderPanel(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ScratchPadPanel />);
  });

  return { container, root };
}

beforeEach(() => {
  useProjectStore.getState().clearProject();
  commitProjectDocumentPatches = vi.fn().mockResolvedValue({
    revision: 1,
    sessionId: 1,
    changed: true,
  });
  window.blueAPI = {
    ...window.blueAPI,
    commitProjectDocumentPatches,
  };
});

afterEach(() => {
  __testClearPendingPatches();
  useProjectStore.getState().clearProject();
  document.body.innerHTML = '';
});

describe('ScratchPadPanel', () => {
  it('is registered to open in Properties mode', () => {
    expect(getPanel('ScratchPadTopComponent')).toMatchObject({
      mode: 'properties',
      auxiliaryGroupId: 'properties-main',
    });
  });

  it('shows the project scratch text and persisted word-wrap setting', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.loaded = true;
    snapshot.sessionId = 1;
    snapshot.scratchPad = {
      text: 'Remember the harmonic center',
      wordWrapEnabled: false,
    };
    useProjectStore.getState().setProjectInfo(snapshot);

    const { container, root } = renderPanel();
    const textarea = container.querySelector('textarea');
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

    expect(textarea?.value).toBe('Remember the harmonic center');
    expect(textarea?.getAttribute('wrap')).toBe('off');
    expect(checkbox?.checked).toBe(false);

    await act(async () => {
      checkbox?.click();
      await useProjectStore.getState().flushPendingPatches();
    });

    expect(useProjectStore.getState().scratchPad.wordWrapEnabled).toBe(true);
    expect(commitProjectDocumentPatches).toHaveBeenCalledWith([
      { scratchPad: { wordWrapEnabled: true } },
    ]);

    act(() => {
      root.unmount();
    });
  });

  it('shows an empty state when no project is loaded', () => {
    const { container, root } = renderPanel();

    expect(container.textContent).toContain('No project loaded');
    expect(container.querySelector('textarea')).toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
