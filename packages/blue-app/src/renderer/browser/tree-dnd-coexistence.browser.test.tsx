import React, { act } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Tree, type NodeRendererProps } from 'react-arborist';
import { createDragDropManager } from 'dnd-core';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BlueTree } from '../components/tree/BlueTree';
import { acquireTreeDndManager, hasActiveTreeDrag } from '../components/tree/tree-dnd-domain';
import FileManagerPanel from '../components/workbench/panels/tools/FileManagerPanel';
import CodeRepositoryTree from '../components/workbench/panels/code-repository/CodeRepositoryTree';
import EffectLibraryTree, {
  type LibraryTreeNode as EffectTreeNode,
} from '../components/workbench/panels/effects-library/EffectLibraryTree';
import { LibraryTree } from '../components/libraries/LibraryTree';
import { readLibraryDragDescriptor } from '../components/libraries/library-drag-drop';
import PresetsManagerDialog from '../components/workbench/panels/orchestra/bsb/PresetsManagerDialog';
import type { CodeRepositoryNode } from '@blue/data';
import type { LibraryBrowseNode } from '../../../shared/unified-library';
import type { PresetGroupSnapshot } from '../../../shared/project-editor';
import type {
  FileManagerDirectoryResult,
  FileManagerRootSnapshot,
} from '../../../shared/file-manager';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface SimpleNode {
  id: string;
  name: string;
}

const capturedErrors: string[] = [];

function SimpleRow({ node, style, dragHandle }: NodeRendererProps<SimpleNode>): React.ReactElement {
  return (
    <div ref={dragHandle} style={style} data-testid={`simple-row-${node.data.name}`}>
      {node.data.name}
    </div>
  );
}

const FUTURE_TREE_DATA: SimpleNode[] = [
  { id: 'future-1', name: 'future-alpha' },
  { id: 'future-2', name: 'future-beta' },
];

const repoRoot: CodeRepositoryNode = {
  id: 'repo-root',
  kind: 'root',
  name: 'Code Repository',
  parentId: null,
  order: 0,
  children: [
    {
      id: 'group-1',
      kind: 'group',
      name: 'Utilities',
      parentId: 'repo-root',
      order: 0,
      children: [
        {
          id: 'snippet-1',
          kind: 'snippet',
          name: 'normalize-udo',
          parentId: 'group-1',
          order: 0,
          code: 'prints "hi"',
        },
      ],
    },
  ],
} as CodeRepositoryNode;

const effectsRoot: EffectTreeNode = {
  id: 'effects-root',
  name: 'Effects',
  kind: 'category',
  children: [
    { id: 'effect-1', name: 'reverb-hall', kind: 'effect' },
    { id: 'effect-2', name: 'delay-tape', kind: 'effect' },
  ],
};

const libraryNodes: LibraryBrowseNode[] = [
  {
    key: null,
    nodeId: 'library-root',
    parentId: null,
    libraryType: 'instrument',
    scope: 'user',
    nodeKind: 'root',
    displayName: 'User Instruments',
    breadcrumb: ['User Instruments'],
    hasChildren: true,
    revision: 1,
  },
  {
    key: { scope: 'user', libraryType: 'instrument', nodeId: 'library-item-1' },
    nodeId: 'library-item-1',
    parentId: 'library-root',
    libraryType: 'instrument',
    scope: 'user',
    nodeKind: 'item',
    displayName: 'sine-cluster',
    breadcrumb: ['User Instruments', 'sine-cluster'],
    supportStatus: 'supported',
    hasChildren: false,
    revision: 1,
  },
];

const presetGroup: PresetGroupSnapshot = {
  name: 'Presets',
  currentPresetUniqueId: 'preset-b',
  currentPresetModified: false,
  subGroups: [
    {
      name: 'Nested',
      currentPresetModified: false,
      subGroups: [],
      presets: [{ uniqueId: 'preset-c', name: 'C' }],
    },
  ],
  presets: [
    { uniqueId: 'preset-a', name: 'A' },
    { uniqueId: 'preset-b', name: 'B' },
  ],
};

function makeRoots(): FileManagerRootSnapshot[] {
  return [
    {
      id: '/work',
      path: '/work',
      label: 'work',
      kind: 'static',
      available: true,
      isDirectory: true,
    },
  ];
}

function directoryResult(): Extract<FileManagerDirectoryResult, { status: 'ok' }> {
  return {
    status: 'ok',
    snapshot: {
      directoryPath: '/work',
      loadedAt: 1,
      children: [
        {
          id: '/work/project.blue',
          path: '/work/project.blue',
          name: 'project.blue',
          kind: 'file',
        },
        { id: '/work/audio', path: '/work/audio', name: 'audio', kind: 'directory' },
      ],
    },
  };
}

function recordError(event: ErrorEvent | PromiseRejectionEvent) {
  const message =
    'reason' in event && event.reason instanceof Error
      ? event.reason.message
      : 'message' in event
        ? String(event.message)
        : String(event);
  capturedErrors.push(message);
}

describe('tree drag ownership coexistence', () => {
  let hosts: HTMLDivElement[] = [];
  let roots: Root[] = [];

  function mountFixture(host: HTMLDivElement, element: React.ReactElement): Root {
    const root = createRoot(host);
    act(() => {
      root.render(element);
    });
    roots.push(root);
    return root;
  }

  function makeHost(): HTMLDivElement {
    const host = document.createElement('div');
    host.style.width = '420px';
    host.style.height = '320px';
    document.body.appendChild(host);
    hosts.push(host);
    return host;
  }

  beforeEach(() => {
    capturedErrors.length = 0;

    (window as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      getFileManagerRoots: async () => makeRoots(),
      listFileManagerDirectory: async () => directoryResult(),
      validateFileManagerDirectory: async () => ({ status: 'ok' }),
      authorizeAudioFile: async () => true,
      beginLibraryDrag: async () => ({ status: 'ok' }),
      cancelLibraryDrag: async () => undefined,
    };

    window.addEventListener('error', recordError);
    window.addEventListener('unhandledrejection', recordError);
  });

  afterEach(async () => {
    window.removeEventListener('error', recordError);
    window.removeEventListener('unhandledrejection', recordError);
    for (const root of roots.splice(0)) {
      try {
        await act(async () => root.unmount());
      } catch {
        // A canary root may already have been torn down by the expected error.
      }
    }
    for (const host of hosts.splice(0)) {
      host.remove();
    }
    delete (window as unknown as { blueAPI?: Record<string, unknown> }).blueAPI;
  });

  function expectNoBackendConflicts(context: string) {
    expect(
      capturedErrors.filter((message) => message.includes('two HTML5 backends')),
      context,
    ).toEqual([]);
  }

  it(
    'keeps File Manager usable beside every other tree surface for repeated open/close cycles',
    { timeout: 60_000 },
    async () => {
      const fileManagerHost = makeHost();
      mountFixture(fileManagerHost, <FileManagerPanel />);

      for (let cycle = 0; cycle < 10; cycle++) {
        const surfacesHost = makeHost();
        let lastSelectedRepoNode: string | null = null;
        const presetPatches: unknown[] = [];

        await act(async () => {
          mountFixture(
            surfacesHost,
            <div>
              <CodeRepositoryTree
                root={repoRoot}
                selectedId={null}
                onSelect={(nodeId) => {
                  lastSelectedRepoNode = nodeId;
                }}
                onRename={() => {}}
                onMove={() => {}}
                onAddGroup={() => {}}
                onAddSnippet={() => {}}
                onDelete={() => {}}
              />
              <EffectLibraryTree rootNode={effectsRoot} onMove={() => {}} />
              <BlueTree<SimpleNode>
                data={FUTURE_TREE_DATA}
                width={320}
                height={48}
                rowHeight={24}
                indent={16}
                idAccessor="id"
              >
                {SimpleRow}
              </BlueTree>
              <LibraryTree label="Libraries" nodes={libraryNodes} onSelect={() => {}} />
              <PresetsManagerDialog
                presetGroup={presetGroup}
                onBsbInterfacePatch={(patch) => presetPatches.push(patch)}
                onClose={() => {}}
              />
            </div>,
          );
        });
        await act(async () => {});

        const repoRows = surfacesHost.querySelectorAll('[role="treeitem"]');
        expect(repoRows.length, `cycle ${cycle}: code repository rows`).toBeGreaterThan(1);
        const futureRows = surfacesHost.querySelectorAll('[data-testid^="simple-row-"]');
        expect(futureRows.length, `cycle ${cycle}: future tree rows`).toBe(FUTURE_TREE_DATA.length);
        const libraryRows = surfacesHost.querySelectorAll('[data-library-node-id]');
        expect(libraryRows.length, `cycle ${cycle}: native library rows`).toBe(libraryNodes.length);

        // Selection is handled by the intended surface.
        const snippetRow = Array.from(repoRows).find((row) =>
          row.textContent?.includes('normalize-udo'),
        )!;
        act(() => {
          snippetRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(lastSelectedRepoNode, `cycle ${cycle}: selection routed to code repository`).toBe(
          'snippet-1',
        );

        const presetDialog = surfacesHost.querySelector<HTMLElement>('[role="dialog"]')!;
        const presetTreeItems = () =>
          Array.from(presetDialog.querySelectorAll<HTMLElement>('[role="treeitem"]'));
        const nestedTreeItem = presetTreeItems().find((row) =>
          row.textContent?.includes('Nested'),
        )!;
        const nestedRow = nestedTreeItem.querySelector<HTMLElement>('.cursor-pointer')!;
        expect(nestedRow, `cycle ${cycle}: preset group row`).toBeTruthy();
        act(() => {
          nestedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await act(async () => {});
        expect(
          nestedTreeItem.getAttribute('aria-expanded'),
          `cycle ${cycle}: preset collapse`,
        ).toBe('false');
        act(() => {
          nestedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await act(async () => {});
        expect(
          nestedTreeItem.getAttribute('aria-expanded'),
          `cycle ${cycle}: preset expansion`,
        ).toBe('true');

        const presetTreeItem = presetTreeItems().find((row) => row.textContent?.trim() === 'B')!;
        const presetRow = presetTreeItem.querySelector<HTMLElement>('.cursor-pointer')!;
        act(() => {
          presetRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await act(async () => {});
        expect(presetDialog.textContent, `cycle ${cycle}: preset selection`).toContain(
          'Selected: B',
        );

        const selectedPresetTreeItem = presetTreeItems().find(
          (row) => row.textContent?.trim() === 'B',
        )!;
        const renameRow = selectedPresetTreeItem.querySelector<HTMLElement>('.cursor-pointer')!;
        await act(async () => {
          await userEvent.dblClick(renameRow);
        });
        const renameInput = presetDialog.querySelector<HTMLInputElement>('input[type="text"]');
        expect(renameInput, `cycle ${cycle}: preset rename input`).not.toBeNull();
        if (renameInput) {
          await act(async () => {
            const setInputValue = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              'value',
            )?.set;
            setInputValue?.call(renameInput, 'Bravo');
            renameInput.dispatchEvent(new Event('input', { bubbles: true }));
            renameInput.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
          });
        }
        expect(presetPatches, `cycle ${cycle}: preset rename patch`).toContainEqual({
          type: 'renamePreset',
          presetUniqueId: 'preset-b',
          name: 'Bravo',
        });

        const dragData = new DataTransfer();
        const draggedPresetRow = presetTreeItems()
          .find((row) => row.textContent?.trim() === 'B')!
          .querySelector<HTMLElement>('.cursor-pointer')!;
        act(() => {
          draggedPresetRow.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          draggedPresetRow.dispatchEvent(
            new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dragData }),
          );
        });
        expect(hasActiveTreeDrag(document), `cycle ${cycle}: preset drag ownership`).toBe(true);
        act(() => {
          draggedPresetRow.dispatchEvent(
            new DragEvent('dragend', { bubbles: true, dataTransfer: dragData }),
          );
        });
        expect(hasActiveTreeDrag(document), `cycle ${cycle}: preset drag cleanup`).toBe(false);

        expectNoBackendConflicts(`cycle ${cycle}`);

        await act(async () => {
          const root = roots.pop();
          root?.unmount();
        });
        surfacesHost.remove();
        hosts = hosts.filter((candidate) => candidate !== surfacesHost);

        // File Manager survives every cycle of other trees opening and closing.
        expect(fileManagerHost.querySelector('[title="/work"]')).not.toBeNull();
        expectNoBackendConflicts(`cycle ${cycle}: after close`);
      }

      expect(capturedErrors).toEqual([]);
    },
  );

  it('keeps native Libraries drag payloads working beside participating trees', async () => {
    const fileManagerHost = makeHost();
    mountFixture(fileManagerHost, <FileManagerPanel />);

    const librariesHost = makeHost();
    mountFixture(
      librariesHost,
      <LibraryTree label="Libraries" nodes={libraryNodes} onSelect={() => {}} />,
    );
    await act(async () => {});

    const itemRow = librariesHost.querySelector<HTMLElement>(
      '[data-library-node-id="library-item-1"]',
    )!;
    expect(itemRow.draggable).toBe(true);

    act(() => {
      itemRow.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });

    const dataTransfer = new DataTransfer();
    act(() => {
      itemRow.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }),
      );
    });

    const descriptor = readLibraryDragDescriptor(dataTransfer);
    expect(descriptor).not.toBeNull();
    expect(descriptor?.libraryType).toBe('instrument');
    expect(dataTransfer.getData('text/plain')).toBe('Blue Library Item');

    expectNoBackendConflicts('native drag beside participating trees');
  });

  it('gives separate documents independent drag managers', async () => {
    const mainHost = makeHost();
    mountFixture(
      mainHost,
      <BlueTree<SimpleNode>
        data={FUTURE_TREE_DATA}
        width={320}
        height={48}
        rowHeight={24}
        indent={16}
        idAccessor="id"
      >
        {SimpleRow}
      </BlueTree>,
    );

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const popoutDocument = iframe.contentDocument!;
    popoutDocument.body.style.margin = '0';

    const popoutHost = popoutDocument.createElement('div');
    popoutDocument.body.appendChild(popoutHost);

    const popoutRoot = createRoot(popoutHost);
    roots.push(popoutRoot);
    await act(async () => {
      popoutRoot.render(
        createPortal(
          <BlueTree<SimpleNode>
            data={[{ id: 'popout-1', name: 'popout-row' }]}
            width={320}
            height={24}
            rowHeight={24}
            indent={16}
            idAccessor="id"
          >
            {SimpleRow}
          </BlueTree>,
          popoutHost,
        ) as React.ReactElement,
      );
    });
    await act(async () => {});

    const mainManager = acquireTreeDndManager(document);
    const popoutManager = acquireTreeDndManager(popoutDocument);
    expect(mainManager).not.toBeNull();
    expect(popoutManager).not.toBeNull();
    expect(popoutManager).not.toBe(mainManager);

    expect(mainHost.querySelectorAll('[data-testid^="simple-row-"]').length).toBe(
      FUTURE_TREE_DATA.length,
    );
    expect(popoutHost.querySelectorAll('[data-testid^="simple-row-"]').length).toBe(1);

    expectNoBackendConflicts('separate documents');

    await act(async () => popoutRoot.unmount());
    iframe.remove();
  });

  it('coexists with empty and large trees beside a loading File Manager', async () => {
    let resolveRoots: ((roots: FileManagerRootSnapshot[]) => void) | undefined;
    (window as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      ...(window as unknown as { blueAPI: Record<string, unknown> }).blueAPI,
      getFileManagerRoots: () =>
        new Promise<FileManagerRootSnapshot[]>((resolve) => {
          resolveRoots = resolve;
        }),
    };

    const fileManagerHost = makeHost();
    mountFixture(fileManagerHost, <FileManagerPanel />);

    const emptyHost = makeHost();
    mountFixture(
      emptyHost,
      <BlueTree<SimpleNode>
        data={[]}
        width={320}
        height={24}
        rowHeight={24}
        indent={16}
        idAccessor="id"
      >
        {SimpleRow}
      </BlueTree>,
    );

    const largeData: SimpleNode[] = Array.from({ length: 500 }, (_, index) => ({
      id: `large-${index}`,
      name: `large-${index}`,
    }));
    const largeHost = makeHost();
    mountFixture(
      largeHost,
      <BlueTree<SimpleNode>
        data={largeData}
        width={320}
        height={96}
        rowHeight={24}
        indent={16}
        idAccessor="id"
      >
        {SimpleRow}
      </BlueTree>,
    );

    await act(async () => {});
    expect(fileManagerHost.querySelector('[title="/work"]')).toBeNull(); // still loading

    await act(async () => {
      resolveRoots?.(makeRoots());
    });
    await act(async () => {});

    const waitFor = async (predicate: () => boolean) => {
      for (let attempt = 0; attempt < 100 && !predicate(); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    };
    await waitFor(() => Boolean(fileManagerHost.querySelector('[title="/work"]')));
    expect(fileManagerHost.querySelector('[title="/work"]')).not.toBeNull();
    expect(largeHost.querySelectorAll('[data-testid^="simple-row-"]').length).toBeGreaterThan(0);
    expectNoBackendConflicts('empty and large trees beside a loading panel');
  });

  it('keeps the main document usable when a separate document closes mid-drag', async () => {
    const mainHost = makeHost();
    mountFixture(
      mainHost,
      <BlueTree<SimpleNode>
        data={FUTURE_TREE_DATA}
        width={320}
        height={48}
        rowHeight={24}
        indent={16}
        idAccessor="id"
      >
        {SimpleRow}
      </BlueTree>,
    );

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const popoutDocument = iframe.contentDocument!;
    const popoutManager = acquireTreeDndManager(popoutDocument)!;
    const sourceId = popoutManager.getRegistry().addSource('blue/test', {
      canDrag: () => true,
      isDragging: () => true,
      beginDrag: () => ({ kind: 'blue/test' }),
      endDrag: () => undefined,
    });
    popoutManager.getActions().beginDrag([sourceId]);
    expect(acquireTreeDndManager(document)).not.toBe(popoutManager);

    iframe.remove();

    expect(mainHost.querySelectorAll('[data-testid^="simple-row-"]').length).toBe(
      FUTURE_TREE_DATA.length,
    );
    expectNoBackendConflicts('main document after popout document closed mid-drag');
  });

  it('reuses the document domain across a development-style remount', async () => {
    const managerBefore = acquireTreeDndManager(document);

    const remountHost = makeHost();
    const firstRoot = createRoot(remountHost);
    await act(async () => {
      firstRoot.render(
        <BlueTree<SimpleNode>
          data={FUTURE_TREE_DATA}
          width={320}
          height={48}
          rowHeight={24}
          indent={16}
          idAccessor="id"
        >
          {SimpleRow}
        </BlueTree>,
      );
    });
    expect(remountHost.querySelectorAll('[data-testid^="simple-row-"]').length).toBe(
      FUTURE_TREE_DATA.length,
    );

    await act(async () => firstRoot.unmount());
    const secondRoot = createRoot(remountHost);
    await act(async () => {
      secondRoot.render(
        <BlueTree<SimpleNode>
          data={FUTURE_TREE_DATA}
          width={320}
          height={48}
          rowHeight={24}
          indent={16}
          idAccessor="id"
        >
          {SimpleRow}
        </BlueTree>,
      );
    });

    expect(remountHost.querySelectorAll('[data-testid^="simple-row-"]').length).toBe(
      FUTURE_TREE_DATA.length,
    );
    expect(acquireTreeDndManager(document)).toBe(managerBefore);
    expectNoBackendConflicts('development-style remount');
  });

  // SC-006 canary: the coordinated domain must keep a loud failure signal for
  // uncoordinated drag domains. A second backend rooted at the same document
  // throws the documented duplicate-backend error, and a raw Arborist tree
  // (which roots its own backend at the window) bypasses the coordinated
  // domain entirely. Kept last so its extra backend cannot pollute the
  // coexistence cases above.
  it('keeps the failure signal for a raw uncoordinated Arborist tree', async () => {
    const coordinatedHost = makeHost();
    mountFixture(
      coordinatedHost,
      <BlueTree<SimpleNode>
        data={FUTURE_TREE_DATA}
        width={320}
        height={48}
        rowHeight={24}
        indent={16}
        idAccessor="id"
      >
        {SimpleRow}
      </BlueTree>,
    );

    expect(coordinatedHost.querySelectorAll('[data-testid^="simple-row-"]').length).toBe(
      FUTURE_TREE_DATA.length,
    );

    // The coordinated domain owns the document root: a second manager with
    // the same root must fail loudly during setup.
    const rogueManager = createDragDropManager(HTML5Backend, window, {
      rootElement: document,
    });
    expect(() => {
      rogueManager.getRegistry().addSource('text/plain', {
        canDrag: () => true,
        isDragging: () => true,
        beginDrag: () => ({ kind: 'rogue' }),
        endDrag: () => undefined,
      });
    }).toThrow(/two HTML5 backends/);

    // A raw Arborist tree mounts without passing through the seam, so its
    // rows set up a separate HTML5 backend on the window root — a second,
    // uncoordinated ownership domain in the same document.
    const rawHost = makeHost();
    await act(async () => {
      const rawRoot = createRoot(rawHost);
      roots.push(rawRoot);
      rawRoot.render(
        <Tree<SimpleNode>
          data={[{ id: 'raw-1', name: 'raw-row' }]}
          width={320}
          height={24}
          rowHeight={24}
          indent={16}
          idAccessor="id"
        >
          {SimpleRow}
        </Tree>,
      );
    });

    expect(rawHost.querySelectorAll('[data-testid^="simple-row-"]').length).toBe(1);
    expect(
      (window as Window & { __isReactDndBackendSetUp?: unknown }).__isReactDndBackendSetUp,
      'the raw tree must own a second, uncoordinated backend',
    ).toBe(true);
  });
});
