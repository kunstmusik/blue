// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryBrowseNode } from '../../shared/unified-library';
import SoundObjectLibraryPanel from '../components/workbench/panels/SoundObjectLibraryPanel';
import { useLibraryEditorStore } from '../stores/library-editor-store';
import { useLibraryStore } from '../stores/library-store';
import { useProjectStore } from '../stores/project-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const originalProjectState = useProjectStore.getState();

const sharedNode: LibraryBrowseNode = {
  key: {
    scope: 'projectShared',
    libraryType: 'soundObject',
    projectSessionId: 8,
    locator: {
      kind: 'soundObject',
      libraryId: 'shared-1',
      persistedFingerprint: {
        canonicalHash: 'shared-hash',
        displayName: 'Shared Motif',
        objectType: 'GenericScore',
      },
    },
  },
  nodeId: 'project-sound-shared-1',
  parentId: null,
  libraryType: 'soundObject',
  scope: 'projectShared',
  nodeKind: 'item',
  displayName: 'Shared Motif',
  breadcrumb: ['Project Shared SoundObjects'],
  supportStatus: 'supported',
  objectType: 'GenericScore',
  revision: 'shared-hash',
  hasChildren: false,
};

let root: Root;
let container: HTMLDivElement;
const beginLibraryDrag = vi.fn(async () => ({
  ok: true as const,
  value: { dragSessionId: 'main-drag', libraryType: 'soundObject' as const },
}));
const openLibraryItemEditor = vi.fn(async () => ({
  ok: true as const,
  value: {
    sessionId: 'shared-editor',
    key: sharedNode.key!,
    displayName: sharedNode.displayName,
    objectType: sharedNode.objectType!,
    breadcrumb: sharedNode.breadcrumb,
    baseRevision: sharedNode.revision,
    document: {
      kind: 'unsupported' as const,
      libraryType: 'soundObject' as const,
      objectType: sharedNode.objectType!,
      message: 'fixture',
      rawXml: '<soundObject />',
    },
    dirty: false,
    pinned: false,
    status: 'ready' as const,
  },
}));

beforeEach(() => {
  beginLibraryDrag.mockClear();
  openLibraryItemEditor.mockClear();
  useLibraryStore.getState().reset();
  useLibraryEditorStore.getState().reset();
  useProjectStore.setState({ loaded: true, sessionId: 8 });
  window.blueAPI = {
    ...window.blueAPI,
    browseLibraries: vi.fn(async (request) => ({
      ok: true as const,
      value: {
        contentRevision: 1,
        parent: { ...sharedNode, key: null, nodeId: 'project-sound-root', nodeKind: 'root' as const },
        children: request.parent.scope === 'projectShared' ? [sharedNode] : [],
        nextCursor: null,
      },
    })),
    beginLibraryDrag,
    openLibraryItemEditor,
    onLibraryEditorSessionChanged: vi.fn(() => () => undefined),
    onLibraryChanged: vi.fn(() => () => undefined),
    previewProjectLibraryDelete: vi.fn(async () => ({
      ok: true as const,
      value: {
        confirmationToken: 'project-sound-cut',
        linkedInstanceCount: 0,
        locations: [],
        requiresConfirmation: true,
      },
    })),
    cutLibraryToClipboard: vi.fn(async () => ({
      ok: true as const,
      value: {
        clipboard: {
          operation: 'cut' as const,
          source: {
            kind: 'buffer' as const,
            clipboardId: 'sound-buffer',
            libraryType: 'soundObject' as const,
          },
          capturedAt: 100,
        },
        closedEditorSessionIds: [],
      },
    })),
    deleteProjectLibraryItem: vi.fn(),
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  useProjectStore.setState(originalProjectState, true);
});

describe('Project SoundObject Library panel', () => {
  it('lists canonical project-shared entries and routes selection and drag by stable key', async () => {
    act(() => root.render(<SoundObjectLibraryPanel />));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(container.textContent).toContain('Shared Motif');
    const row = container.querySelector('#library-node-project-sound-shared-1') as HTMLElement;
    const name = [...row.querySelectorAll('button')].find((button) => button.textContent === 'Shared Motif') as HTMLButtonElement;
    act(() => name.click());
    await act(async () => { await Promise.resolve(); });
    expect(openLibraryItemEditor).toHaveBeenCalledWith({ key: sharedNode.key, pinned: false });

    act(() => row.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    await act(async () => { await Promise.resolve(); });
    expect(beginLibraryDrag).toHaveBeenCalledWith(expect.objectContaining({
      key: sharedNode.key,
      revision: 'shared-hash',
    }));

    await useLibraryStore.getState().captureClipboard(sharedNode, 'copy');
    expect(useLibraryStore.getState().clipboard).toMatchObject({
      operation: 'copy',
      source: {
        kind: 'library',
        key: sharedNode.key,
        revision: 'shared-hash',
      },
    });
  });

  it('shows a compact project-only empty state when no project is loaded', async () => {
    useProjectStore.setState({ loaded: false, sessionId: 0 });
    act(() => root.render(<SoundObjectLibraryPanel />));
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain('No project loaded');
    expect(container.textContent).not.toContain('User Libraries');
  });

  it('uses the shared Copy/Cut buffer for project-shared SoundObjects', async () => {
    act(() => root.render(<SoundObjectLibraryPanel />));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const row = container.querySelector('#library-node-project-sound-shared-1') as HTMLElement;
    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    expect(document.body.textContent).not.toContain('Copy to User Library');
    const copy = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((candidate) => candidate.textContent === 'Copy') as HTMLElement;
    act(() => copy.click());
    expect(useLibraryStore.getState().clipboard).toMatchObject({
      operation: 'copy', source: { kind: 'library', key: sharedNode.key },
    });

    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    const cut = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((candidate) => candidate.textContent === 'Cut') as HTMLElement;
    await act(async () => {
      cut.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(useLibraryStore.getState().clipboard).toMatchObject({
      operation: 'cut',
      source: { kind: 'buffer', clipboardId: 'sound-buffer', libraryType: 'soundObject' },
    });
  });

  it('drains every project SoundObject page without truncating the panel', async () => {
    const allNodes = Array.from({ length: 501 }, (_, index): LibraryBrowseNode => ({
      ...sharedNode,
      key: {
        ...sharedNode.key!,
        locator: {
          kind: 'soundObject',
          libraryId: `shared-${index}`,
          persistedFingerprint: {
            canonicalHash: `hash-${index}`,
            displayName: `Shared ${index}`,
            objectType: 'GenericScore',
          },
        },
      },
      nodeId: `project-sound-${index}`,
      displayName: `Shared ${index}`,
      revision: `hash-${index}`,
    }));
    vi.mocked(window.blueAPI.browseLibraries).mockImplementation(async (request) => {
      const offset = request.cursor ? 500 : 0;
      return { ok: true as const, value: {
        contentRevision: 1,
        parent: { ...sharedNode, key: null, nodeId: 'project-sound-root', nodeKind: 'root' as const },
        children: allNodes.slice(offset, offset + 500),
        nextCursor: offset === 0 ? 'page-500' : null,
      } };
    });
    act(() => root.render(<SoundObjectLibraryPanel />));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain('Shared 500');
    expect(window.blueAPI.browseLibraries).toHaveBeenCalledTimes(2);
  });

  it('confirms deletion with linked instance details and mutates only on accept', async () => {
    vi.mocked(window.blueAPI.previewProjectLibraryDelete).mockResolvedValue({
      ok: true as const,
      value: {
        confirmationToken: 'delete-token-123',
        linkedInstanceCount: 3,
        locations: ['Layer 1', 'Layer 2'],
        requiresConfirmation: true,
      },
    });
    vi.mocked(window.blueAPI.deleteProjectLibraryItem).mockResolvedValueOnce({
      ok: true as const,
      value: {
        contentRevision: 2,
        closedEditorSessionIds: [],
      },
    });

    act(() => root.render(<SoundObjectLibraryPanel />));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const row = container.querySelector('#library-node-project-sound-shared-1') as HTMLElement;
    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });

    const deleteMenuItem = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((candidate) => candidate.textContent?.startsWith('Delete')) as HTMLElement;
    expect(deleteMenuItem).toBeTruthy();

    await act(async () => {
      deleteMenuItem.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    // ConfirmationDialog should appear
    const dialog = document.body.querySelector('[role="alertdialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain('Delete “Shared Motif”?');
    expect(dialog?.textContent).toContain('and 3 linked score instances');

    // Cancel first
    const cancelButton = dialog?.querySelector<HTMLButtonElement>('[data-action-id="cancel"]')!;
    act(() => {
      cancelButton.click();
    });
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
    expect(window.blueAPI.deleteProjectLibraryItem).not.toHaveBeenCalled();

    // Trigger delete again and confirm
    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    const deleteAgain = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((candidate) => candidate.textContent?.startsWith('Delete')) as HTMLElement;
    await act(async () => {
      deleteAgain.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const confirmDialog = document.body.querySelector('[role="alertdialog"]');
    const deleteBtn = confirmDialog?.querySelector<HTMLButtonElement>('[data-action-id="delete"]')!;
    await act(async () => {
      deleteBtn.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.blueAPI.deleteProjectLibraryItem).toHaveBeenCalledWith(
      sharedNode.key,
      'delete-token-123',
    );
    expect(window.blueAPI.previewProjectLibraryDelete).toHaveBeenCalledTimes(3);
  });

  it('does not delete when the linked-instance preview changes after confirmation', async () => {
    vi.mocked(window.blueAPI.previewProjectLibraryDelete)
      .mockResolvedValueOnce({
        ok: true as const,
        value: {
          confirmationToken: 'delete-token-123',
          linkedInstanceCount: 3,
          locations: ['Layer 1', 'Layer 2'],
          requiresConfirmation: true,
        },
      })
      .mockResolvedValueOnce({
        ok: true as const,
        value: {
          confirmationToken: 'stale-token',
          linkedInstanceCount: 4,
          locations: ['Layer 1', 'Layer 2', 'Layer 3'],
          requiresConfirmation: true,
        },
      });

    act(() => root.render(<SoundObjectLibraryPanel />));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const row = container.querySelector('#library-node-project-sound-shared-1') as HTMLElement;
    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const deleteMenuItem = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((candidate) => candidate.textContent?.startsWith('Delete')) as HTMLElement;
    await act(async () => {
      deleteMenuItem.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const deleteButton = document.body.querySelector<HTMLButtonElement>('[data-action-id="delete"]');
    expect(deleteButton).toBeTruthy();
    await act(async () => {
      deleteButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.blueAPI.deleteProjectLibraryItem).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
