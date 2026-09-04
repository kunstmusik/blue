// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileManagerRootSnapshot } from '../../shared/file-manager';
import WorkbenchPanelContent from '../components/workbench/WorkbenchPanelContent';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('File Manager panel routing', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const getFileManagerRoots = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const roots: FileManagerRootSnapshot[] = [
      { id: '/', path: '/', label: '/', kind: 'static', available: true, isDirectory: true },
    ];
    getFileManagerRoots.mockResolvedValue(roots);
    (window as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      getFileManagerRoots,
      listFileManagerDirectory: vi.fn(),
      validateFileManagerDirectory: vi.fn(),
      commitAudioFileDrop: vi.fn(),
    };
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it('routes the registered File Manager identity to the real panel on demand', async () => {
    act(() => {
      root!.render(<WorkbenchPanelContent panelId="BlueFileManagerTopComponent" />);
    });
    await act(async () => {});

    expect(getFileManagerRoots).toHaveBeenCalledOnce();
    // The panel shell carries no redundant title (the tab strip labels it);
    // identity comes from the roots load and the refresh affordance.
    expect(container!.querySelector('[aria-label="Refresh roots"]')).toBeTruthy();
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Placeholder — to be implemented');
    expect(text).not.toContain('[BlueFileManagerTopComponent]');
  });

  it('renders exactly one File Manager surface for the restored identity', async () => {
    act(() => {
      root!.render(<WorkbenchPanelContent panelId="BlueFileManagerTopComponent" />);
    });
    await act(async () => {});

    // One roots load and one panel header mean one real panel instance; no
    // placeholder render or duplicate instance is produced.
    expect(getFileManagerRoots).toHaveBeenCalledOnce();
    const headers = Array.from(document.querySelectorAll('[aria-label="Refresh roots"]'));
    expect(headers).toHaveLength(1);
  });
});
