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
    previewProjectLibraryDelete: vi.fn(),
    deleteProjectLibraryItem: vi.fn(),
    copyProjectLibraryItemToUser: vi.fn(),
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

    useLibraryStore.getState().captureClipboard(sharedNode, 'copy');
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
});
