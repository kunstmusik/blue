// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryBrowseNode } from '../../shared/unified-library';
import { LibraryTree } from '../components/libraries/LibraryTree';
import LibrariesPanel from '../components/workbench/panels/LibrariesPanel';
import { isAuxiliaryInteractionTarget } from '../components/workbench/auxiliary-layout';
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

const applyLibraryMutation = vi.fn(async () => ({
  ok: true as const,
  value: { contentRevision: 1, affectedNodes: [] },
}));
const copyLibraryTransferToUser = vi.fn(async () => ({
  ok: true as const,
  value: { contentRevision: 1, affectedNodes: [] },
}));

function render(element: React.ReactElement): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(element); });
  return { container, root };
}

beforeEach(() => {
  applyLibraryMutation.mockClear();
  copyLibraryTransferToUser.mockClear();
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
          libraryType: request.parent.libraryType,
          nodeKind: 'root' as const,
          displayName: request.parent.libraryType,
          hasChildren: request.parent.libraryType === 'soundObject',
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
    applyLibraryMutation,
    copyLibraryTransferToUser,
    onLibraryServiceSnapshot: vi.fn(() => () => undefined),
    onLibraryChanged: vi.fn(() => () => undefined),
  };
  useLibraryStore.getState().reset();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('Libraries panel', () => {
  it('renders a user-only hierarchy with collapsed roots and no migration/project chrome', async () => {
    const { container, root } = render(<LibrariesPanel />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain('User Libraries');
    expect(container.textContent).not.toContain('No project is open');
    expect(container.textContent).not.toContain('Current Project');
    expect(container.querySelector('input[aria-label="Search libraries"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Library source"]')).toBeNull();
    expect(container.querySelectorAll('button[aria-label="Library actions"]')).toHaveLength(1);
    expect(container.textContent).not.toContain('Insert');
    expect(container.textContent).not.toContain('migration');
    expect(container.textContent).not.toContain('RenameDuplicateDelete');
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelector('[aria-selected="true"]')).toBeNull();
    const soundRoot = container.querySelector('#library-node-root-soundObject') as HTMLElement;
    expect(soundRoot.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('Legacy Object');
    act(() => {
      (soundRoot.querySelector('button[aria-label^="Expand"]') as HTMLButtonElement).click();
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const warning = container.querySelector('[role="status"]');
    expect(warning?.textContent).toContain('unsupported');
    act(() => { root.unmount(); });
  });

  it('keeps exactly one selected row across all user-library roots', async () => {
    const { container, root } = render(<LibrariesPanel />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const soundRoot = container.querySelector('#library-node-root-soundObject') as HTMLElement;
    const effectRoot = container.querySelector('#library-node-root-effect') as HTMLElement;

    act(() => soundRoot.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(soundRoot.getAttribute('aria-selected')).toBe('true');
    act(() => effectRoot.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));

    expect(container.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    expect(soundRoot.getAttribute('aria-selected')).toBe('false');
    expect(effectRoot.getAttribute('aria-selected')).toBe('true');
    act(() => { root.unmount(); });
  });

  it('keeps item metadata out of the row and exposes its address as a tooltip', () => {
    const contextual = {
      ...unsupported,
      supportStatus: 'supported' as const,
      objectType: 'blue.soundObject.GenericScore',
      breadcrumb: ['SoundObjects', 'Motifs', 'Legacy Object'],
    };
    const { container, root } = render(
      <LibraryTree label="Search" nodes={[contextual]} onSelect={vi.fn()} />,
    );
    expect(container.textContent).not.toContain('blue.soundObject.GenericScore');
    expect(container.querySelector('#library-node-unsupported')?.getAttribute('title'))
      .toBe('SoundObjects / Motifs / Legacy Object');
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
    expect(document.body.querySelector('.editor-context-menu')).toBeTruthy();
    const menuItem = document.body.querySelector('[role="menuitem"]') as HTMLElement;
    expect(menuItem).toBeTruthy();
    expect(isAuxiliaryInteractionTarget(menuItem)).toBe(true);

    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    const option = document.createElement('div');
    listbox.appendChild(option);
    document.body.appendChild(listbox);
    expect(isAuxiliaryInteractionTarget(option)).toBe(true);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const dialogButton = document.createElement('button');
    dialog.appendChild(dialogButton);
    document.body.appendChild(dialog);
    expect(isAuxiliaryInteractionTarget(dialogButton)).toBe(true);

    const outside = document.createElement('button');
    document.body.appendChild(outside);
    expect(isAuxiliaryInteractionTarget(outside)).toBe(false);
    act(() => { root.unmount(); });
  });

  it('restores the Library viewport after the panel is remounted', () => {
    useLibraryStore.setState({ scrollTop: 240, initialized: true });
    const first = render(<LibrariesPanel />);
    const firstScroller = first.container.querySelector('[data-library-scroll]') as HTMLElement;
    expect(firstScroller.scrollTop).toBe(240);
    act(() => {
      firstScroller.scrollTop = 510;
      firstScroller.dispatchEvent(new Event('scroll', { bubbles: true }));
      first.root.unmount();
    });
    expect(useLibraryStore.getState().scrollTop).toBe(510);

    const second = render(<LibrariesPanel />);
    const secondScroller = second.container.querySelector('[data-library-scroll]') as HTMLElement;
    expect(secondScroller.scrollTop).toBe(510);
    act(() => { second.root.unmount(); });
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
    const surface = dialog?.querySelector('[data-library-dialog-surface]');
    expect(dialog?.textContent).toContain('3 Library nodes');
    expect(dialog?.textContent).toContain('unsaved changes');
    expect(dialog?.textContent).toContain('Discard & Delete');
    expect(dialog?.textContent).toContain('Save & Delete');
    expect(surface?.className).toContain('bg-app-overlay');
    expect(surface?.className).not.toContain('bg-app-panel');
    act(() => { root.unmount(); });
  });

  it('creates a folder with an in-app name dialog instead of Electron window.prompt', async () => {
    const { container, root } = render(<LibrariesPanel />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const instrumentRoot = container.querySelector('#library-node-root-instrument') as HTMLElement;
    act(() => instrumentRoot.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
    await act(async () => { await Promise.resolve(); });
    const createFolder = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((item) => item.textContent === 'Create Folder…') as HTMLElement;
    act(() => createFolder.click());

    const input = container.querySelector('input[aria-label="Folder name"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Textures');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(applyLibraryMutation).toHaveBeenCalledWith({
      type: 'createFolder',
      libraryType: 'instrument',
      parentId: 'root-instrument',
      name: 'Textures',
    });
    expect(container.querySelector('input[aria-label="Folder name"]')).toBeNull();
    act(() => { root.unmount(); });
  });

  it('offers project SoundObject clipboard Paste on the matching user root', async () => {
    useLibraryStore.setState({
      clipboard: {
        operation: 'copy',
        source: {
          kind: 'library',
          key: {
            scope: 'projectShared',
            libraryType: 'soundObject',
            projectSessionId: 7,
            locator: {
              kind: 'soundObject',
              libraryId: 'shared-1',
              persistedFingerprint: {
                canonicalHash: 'sound-hash',
                displayName: 'Shared Phrase',
                objectType: 'GenericScore',
              },
            },
          },
          revision: 'sound-hash',
        },
        capturedAt: 1,
      },
    });
    const { container, root } = render(<LibrariesPanel />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const soundRoot = container.querySelector('#library-node-root-soundObject') as HTMLElement;
    act(() => soundRoot.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    const paste = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((item) => item.textContent === 'Paste') as HTMLElement;
    expect(paste).toBeTruthy();
    expect(paste.getAttribute('data-disabled')).toBeNull();

    await act(async () => {
      paste.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(copyLibraryTransferToUser).toHaveBeenCalledWith(
      {
        kind: 'clipboard',
        source: expect.objectContaining({ kind: 'library', revision: 'sound-hash' }),
      },
      'root-soundObject',
    );
    act(() => { root.unmount(); });
  });
});
