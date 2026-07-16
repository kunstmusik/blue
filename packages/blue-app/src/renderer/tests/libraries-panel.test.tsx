// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryBrowseNode } from '../../shared/unified-library';
import { LibraryTree } from '../components/libraries/LibraryTree';
import LibrariesPanel from '../components/workbench/panels/LibrariesPanel';
import { useLibraryStore } from '../stores/library-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const unsupported: LibraryBrowseNode = {
  key: { scope: 'user', libraryType: 'soundObject', nodeId: 'unsupported' },
  nodeId: 'unsupported',
  parentId: 'root',
  libraryType: 'soundObject',
  scope: 'user',
  nodeKind: 'item',
  displayName: 'Legacy Object',
  breadcrumb: ['SoundObjects', 'Legacy Object'],
  supportStatus: 'unsupported',
  objectType: 'future.PluginObject',
  revision: 1,
  hasChildren: false,
};

function render(element: React.ReactElement): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(element); });
  return { container, root };
}

beforeEach(() => {
  window.blueAPI = {
    ...window.blueAPI,
    getLibraryServiceSnapshot: vi.fn(async () => ({
      phase: 'ready' as const,
      contentRevision: 0,
      migrationState: 'never' as const,
      userItemCounts: { instrument: 0, udo: 0, soundObject: 0, effect: 0 },
      projectSessionId: null,
      writable: true,
    })),
    browseLibraries: vi.fn(async (request) => ({
      ok: true as const,
      value: {
        contentRevision: 0,
        parent: {
          ...unsupported,
          key: null,
          nodeId: `root-${request.parent.libraryType}`,
          nodeKind: 'root' as const,
          displayName: request.parent.libraryType,
        },
        children: request.parent.libraryType === 'soundObject' ? [unsupported] : [],
        nextCursor: null,
      },
    })),
    searchLibraries: vi.fn(async () => ({
      ok: true as const,
      value: { contentRevision: 0, normalizedQuery: '', results: [], nextCursor: null },
    })),
    getLibraryItemPreview: vi.fn(),
    onLibraryServiceSnapshot: vi.fn(() => () => undefined),
    onLibraryChanged: vi.fn(() => () => undefined),
  };
  useLibraryStore.getState().reset();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('Libraries panel', () => {
  it('renders without a project and exposes accessible filters and warnings', async () => {
    const { container, root } = render(<LibrariesPanel />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain('User Libraries');
    expect(container.textContent).toContain('No project is open');
    expect(container.querySelector('input[aria-label="Search libraries"]')).toBeTruthy();
    expect(container.querySelectorAll('button[aria-label="Library actions"]')).toHaveLength(1);
    expect(container.textContent).not.toContain('Insert');
    expect(container.textContent).not.toContain('RenameDuplicateDelete');
    expect(container.querySelector('textarea')).toBeNull();
    const warning = container.querySelector('[role="status"]');
    expect(warning?.textContent).toContain('unsupported');
    act(() => { root.unmount(); });
  });

  it('supports keyboard tree navigation and selection', () => {
    const onSelect = vi.fn();
    const first = { ...unsupported, nodeId: 'first', displayName: 'First' };
    const second = { ...unsupported, nodeId: 'second', displayName: 'Second' };
    const { container, root } = render(
      <LibraryTree label="User Instruments" nodes={[first, second]} onSelect={onSelect} />,
    );
    const tree = container.querySelector('[role="tree"]') as HTMLElement;
    tree.focus();
    act(() => { tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    act(() => { tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(onSelect).toHaveBeenCalledWith(second.key);
    act(() => { root.unmount(); });
  });

  it('exposes focused ellipsis commands with an accessible disabled reason', async () => {
    useLibraryStore.setState({ typeFilter: 'all' });
    const { container, root } = render(<LibrariesPanel />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const trigger = container.querySelector('button[aria-label="Library actions"]') as HTMLButtonElement;
    act(() => trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })));
    await act(async () => { await Promise.resolve(); });
    const exportCurrent = document.body.querySelector('[aria-label^="Export Current unavailable"]');
    expect(exportCurrent?.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement?.getAttribute('role')).toBe('menu');
    act(() => { root.unmount(); });
  });

  it('announces affected count and dirty-session choices before destructive deletion', () => {
    useLibraryStore.setState({
      deletePreview: {
        confirmationToken: 'delete-1',
        nodeId: 'folder-1',
        expectedRevision: 4,
        affectedNodeIds: ['folder-1', 'item-1', 'item-2'],
        affectedCount: 3,
        dirtyEditorSessionIds: ['editor-1'],
        expiresAt: Date.now() + 1_000,
        displayName: 'Pads',
      },
    });
    const { container, root } = render(<LibrariesPanel />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('3 Library nodes');
    expect(dialog?.textContent).toContain('unsaved changes');
    expect(dialog?.textContent).toContain('Discard & Delete');
    expect(dialog?.textContent).toContain('Save & Delete');
    act(() => { root.unmount(); });
  });
});
