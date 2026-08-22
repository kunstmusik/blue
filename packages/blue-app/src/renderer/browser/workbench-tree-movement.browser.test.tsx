import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DockviewReact, type DockviewApi, type IDockviewPanelProps } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyAuxiliaryLayout,
  createDefaultAuxiliaryLayoutState,
  getGroupInstanceForPanel,
} from '../components/workbench/auxiliary-layout';
import { LibraryTree } from '../components/libraries/LibraryTree';
import { readLibraryDragDescriptor } from '../components/libraries/library-drag-drop';
import FileManagerPanel from '../components/workbench/panels/tools/FileManagerPanel';
import { resetFileManagerTreeSessionState } from '../components/workbench/panels/tools/file-manager/FileManagerTree';
import { sessionTreeState } from '../components/workbench/panels/tools/file-manager/file-manager-tree-state';
import { useWorkbenchStore } from '../stores/workbench-store';
import { BlueTree } from '../components/tree/BlueTree';
import { acquireTreeDndManager, hasActiveTreeDrag } from '../components/tree/tree-dnd-domain';
import type { NodeRendererProps } from 'react-arborist';
import type { FileManagerDirectoryResult, FileManagerRootSnapshot } from '../../../shared/file-manager';
import type { LibraryBrowseNode } from '../../../shared/unified-library';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const LIBRARY_NODES: LibraryBrowseNode[] = [
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
  ...['organic', 'synth', 'reverb'].map((name, index) => ({
    key: { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: `library-item-${name}` },
    nodeId: `library-item-${name}`,
    parentId: 'library-root',
    libraryType: 'instrument' as const,
    scope: 'user' as const,
    nodeKind: 'item' as const,
    displayName: `instruments/${name}`,
    breadcrumb: ['User Instruments', `instruments/${name}`],
    supportStatus: 'supported' as const,
    revision: index + 1,
  })),
];

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
        { id: '/work/project.blue', path: '/work/project.blue', name: 'project.blue', kind: 'file' },
        { id: '/work/audio', path: '/work/audio', name: 'audio', kind: 'directory' },
        ...Array.from({ length: 30 }, (_, index) => ({
          id: `/work/clip-${String(index).padStart(2, '0')}`,
          path: `/work/clip-${String(index).padStart(2, '0')}`,
          name: `clip-${String(index).padStart(2, '0')}`,
          kind: 'file' as const,
        })),
      ],
    },
  };
}

const mountCounts: Record<string, number> = {};
const capturedErrors: string[] = [];

const LAYOUT_FIXTURE_CSS = [
  '.h-full { height: 100%; }',
  '.w-full { width: 100%; }',
  '.flex { display: flex; }',
  '.flex-col { flex-direction: column; }',
  '.flex-1 { flex: 1 1 0%; }',
  '.min-h-0 { min-height: 0; }',
  '.flex-none { flex: none; }',
  '.items-center { align-items: center; }',
  '.overflow-hidden { overflow: hidden; }',
  '.select-none { user-select: none; }',
].join('\n');

function installLayoutFixtureStyles() {
  const existing = document.getElementById('tree-movement-fixture-styles');
  if (existing) return;
  const style = document.createElement('style');
  style.id = 'tree-movement-fixture-styles';
  style.textContent = LAYOUT_FIXTURE_CSS;
  document.head.appendChild(style);
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

function CountingPanel({ id, children }: { id: string; children: React.ReactNode }) {
  React.useEffect(() => {
    mountCounts[id] = (mountCounts[id] ?? 0) + 1;
  }, [id]);
  return (
    <div data-testid={`panel-host-${id}`} className="h-full w-full">
      {children}
    </div>
  );
}

function PanelHost(props: IDockviewPanelProps): React.ReactElement {
  const id = props.api.id;
  if (id === 'LibrariesTopComponent') {
    return (
      <CountingPanel id={id}>
        <LibraryTree label="Libraries" nodes={LIBRARY_NODES} onSelect={() => {}} />
      </CountingPanel>
    );
  }
  if (id === 'BlueFileManagerTopComponent') {
    return (
      <CountingPanel id={id}>
        <FileManagerPanel />
      </CountingPanel>
    );
  }
  return <CountingPanel id={id}>editor</CountingPanel>;
}

describe('workbench tree movement lifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    resetFileManagerTreeSessionState();
    mountCounts['LibrariesTopComponent'] = 0;
    mountCounts['BlueFileManagerTopComponent'] = 0;
    capturedErrors.length = 0;

    host = document.createElement('div');
    host.style.width = '1200px';
    host.style.height = '800px';
    document.body.appendChild(host);
    root = createRoot(host);

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
    await act(async () => root.unmount());
    host.remove();
    useWorkbenchStore.setState({ api: null });
    delete (window as unknown as { blueAPI?: Record<string, unknown> }).blueAPI;
  });

  async function setupWorkbench(): Promise<DockviewApi> {
    let dockviewApi: DockviewApi | undefined;
    await act(async () => {
      root.render(
        <DockviewReact
          components={{ default: PanelHost }}
          onReady={(event) => {
            dockviewApi = event.api;
          }}
        />,
      );
    });
    expect(dockviewApi).toBeDefined();
    return dockviewApi!;
  }

  it(
    'moves populated Libraries across all edges for 20 cycles without losing File Manager',
    { timeout: 60_000 },
    async () => {
    const api = await setupWorkbench();

    await act(async () => {
      api.layout(1200, 800);
      api.addPanel({ id: 'ScoreTopComponent', component: 'default', title: 'Score' });

      const state = createDefaultAuxiliaryLayoutState();
      const properties = state.groups.find(
        (group) => group.kind === 'seeded' && group.seedGroupId === 'properties-main',
      )!;
      properties.edge = 'right';
      properties.panelIds = ['LibrariesTopComponent'];
      properties.dockedPanelIds = ['LibrariesTopComponent'];
      properties.activePanelId = 'LibrariesTopComponent';

      const output = state.groups.find(
        (group) => group.kind === 'seeded' && group.seedGroupId === 'output-main',
      )!;
      output.panelIds = ['OutputTopComponent', 'BlueFileManagerTopComponent'];
      output.dockedPanelIds = [...output.panelIds];
      output.activePanelId = 'BlueFileManagerTopComponent';

      useWorkbenchStore.setState({
        api,
        auxiliary: applyAuxiliaryLayout(api, state),
        floatingOrigins: {},
        closedPanelOrigins: {},
      });
    });

    await act(async () => {});
    await new Promise((resolve) => setTimeout(resolve, 50));

    const waitFor = async (predicate: () => boolean, timeoutMs = 3_000): Promise<void> => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error('Timed out waiting for the File Manager fixture');
    };
    await waitFor(() => Boolean(document.querySelector('[title="/work"]')));
    const workRoot = document.querySelector<HTMLElement>('[title="/work"]')!;
    act(() => {
      workRoot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitFor(() => Boolean(document.querySelector('[title="/work/project.blue"]')));
    await new Promise((resolve) => setTimeout(resolve, 350));

    const audioRow = document
      .querySelector<HTMLElement>('[title="/work/audio"]')!
      .closest<HTMLElement>('div.select-none')!;
    act(() => {
      audioRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {});
    expect(audioRow.className).toContain('bg-app-accent');

    const initialScrollContainer = document.querySelector<HTMLElement>(
      '[data-testid="panel-host-BlueFileManagerTopComponent"] div[style*="overflow: auto"]',
    )!;
    initialScrollContainer.scrollTo(0, 8);
    initialScrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    await act(async () => {});
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(initialScrollContainer.scrollTop).toBe(8);
    expect(sessionTreeState.scrollOffset).toBe(8);
    const bottomHeightBefore = api.groups
      .find((group) => group.id === 'blue-aux-edge-bottom')!
      .element.getBoundingClientRect().height;

    const fileManagerPanel = api.getPanel('BlueFileManagerTopComponent');
    expect(fileManagerPanel).toBeDefined();

    const cycleEdges: Array<'left' | 'bottom' | 'right'> = ['left', 'bottom', 'right', 'right'];

    for (let cycle = 0; cycle < 20; cycle++) {
      const targetEdge = cycleEdges[cycle % cycleEdges.length]!;

      await act(async () => {
        useWorkbenchStore.getState().movePanelToEdge('LibrariesTopComponent', targetEdge);
      });
      await act(async () => {});
      await new Promise((resolve) => setTimeout(resolve, 10));

      const auxiliary = useWorkbenchStore.getState().auxiliary;
      const instance = getGroupInstanceForPanel(auxiliary, 'LibrariesTopComponent');
      expect(instance?.edge, `cycle ${cycle}: requested placement`).toBe(targetEdge);
      expect(instance?.dockedPanelIds).toContain('LibrariesTopComponent');

      expect(
        api.getPanel('BlueFileManagerTopComponent'),
        `cycle ${cycle}: File Manager panel identity`,
      ).toBe(fileManagerPanel);

      await act(async () => {
        api.getPanel('BlueFileManagerTopComponent')?.api.setActive();
      });
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(
        document.querySelector('[title="/work/project.blue"]'),
        `cycle ${cycle}: expansion retained across ${targetEdge}`,
      ).not.toBeNull();
      const selectedRow = document
        .querySelector<HTMLElement>('[title="/work/audio"]')!
        .closest<HTMLElement>('div.select-none')!;
      expect(selectedRow.className, `cycle ${cycle}: selection retained across ${targetEdge}`).toContain(
        'bg-app-accent',
      );
      const scrollContainer = document.querySelector<HTMLElement>(
        '[data-testid="panel-host-BlueFileManagerTopComponent"] div[style*="overflow: auto"]',
      )!;
      expect(scrollContainer.scrollTop, `cycle ${cycle}: scroll retained across ${targetEdge}`).toBe(8);

      const bottomGroupAfter = api.groups.find((group) => group.id === 'blue-aux-edge-bottom')!;
      expect(
        bottomGroupAfter.element.getBoundingClientRect().height,
        `cycle ${cycle}: bottom size retained`,
      ).toBeCloseTo(bottomHeightBefore, 0);
      const fileManagerPresentation = useWorkbenchStore.getState().auxiliary.groups.find((group) =>
        group.panelIds.includes('BlueFileManagerTopComponent'),
      );
      expect(fileManagerPresentation?.isMaximized, `cycle ${cycle}: presentation retained`).toBe(false);
      expect(fileManagerPresentation?.dockedPanelIds, `cycle ${cycle}: panel remains docked`).toContain(
        'BlueFileManagerTopComponent',
      );
      const activeElement = document.activeElement;
      const librariesGroupElement = api.getPanel('LibrariesTopComponent')?.group.element as HTMLElement;
      const fileManagerGroupElement = api.getPanel('BlueFileManagerTopComponent')?.group.element as HTMLElement;
      expect(
        Boolean(librariesGroupElement.contains(activeElement) || fileManagerGroupElement.contains(activeElement)),
        `cycle ${cycle}: focus remains within the affected workbench groups`,
      ).toBe(true);

      const duplicateBackendErrors = capturedErrors.filter((message) =>
        message.includes('two HTML5 backends'),
      );
      expect(duplicateBackendErrors, `cycle ${cycle}: no duplicate backend errors`).toEqual([]);
    }

    expect(mountCounts['BlueFileManagerTopComponent']).toBeGreaterThan(0);
    expect(mountCounts['LibrariesTopComponent']).toBeGreaterThan(0);

    expect(capturedErrors).toEqual([]);

    // Dockview lazily unmounts inactive tab content (the same behavior as the
    // real workbench). Activating the moved panel remounts its content from
    // the preserved live panel object.
    expect(api.getPanel('LibrariesTopComponent')).toBeDefined();
    await act(async () => {
      api.getPanel('LibrariesTopComponent')?.api.setActive();
    });
    await new Promise((resolve) => setTimeout(resolve, 30));

    const librariesRows = document.querySelectorAll('[data-library-node-id]');
    expect(librariesRows.length).toBe(LIBRARY_NODES.length);

    const libraryItem = document.querySelector<HTMLElement>(
      '[data-library-node-id="library-item-organic"]',
    )!;
    const libraryDragData = new DataTransfer();
    act(() => {
      libraryItem.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      libraryItem.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: libraryDragData }),
      );
    });
    expect(readLibraryDragDescriptor(libraryDragData)).toEqual(
      expect.objectContaining({ libraryType: 'instrument', sourceScope: 'user' }),
    );
    libraryDragData.dropEffect = 'copy';
    act(() => {
      libraryItem.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: libraryDragData }));
    });
    });
});

describe('unaffected auxiliary session preservation', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    resetFileManagerTreeSessionState();
    mountCounts['LibrariesTopComponent'] = 0;
    mountCounts['BlueFileManagerTopComponent'] = 0;
    capturedErrors.length = 0;

    host = document.createElement('div');
    host.style.width = '1200px';
    host.style.height = '800px';
    document.body.appendChild(host);
    root = createRoot(host);

    installLayoutFixtureStyles();

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
    await act(async () => root.unmount());
    host.remove();
    useWorkbenchStore.setState({ api: null });
    delete (window as unknown as { blueAPI?: Record<string, unknown> }).blueAPI;
  });

  async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  async function setupWorkbenchWithFileManagerActive(): Promise<DockviewApi> {
    let dockviewApi: DockviewApi | undefined;
    await act(async () => {
      root.render(
        <DockviewReact
          components={{ default: PanelHost }}
          onReady={(event) => {
            dockviewApi = event.api;
          }}
        />,
      );
    });

    const api = dockviewApi!;
    await act(async () => {
      api.layout(1200, 800);
      api.addPanel({ id: 'ScoreTopComponent', component: 'default', title: 'Score' });

      const state = createDefaultAuxiliaryLayoutState();
      const properties = state.groups.find(
        (group) => group.kind === 'seeded' && group.seedGroupId === 'properties-main',
      )!;
      properties.edge = 'right';
      properties.panelIds = ['LibrariesTopComponent'];
      properties.dockedPanelIds = ['LibrariesTopComponent'];
      properties.activePanelId = 'LibrariesTopComponent';

      const output = state.groups.find(
        (group) => group.kind === 'seeded' && group.seedGroupId === 'output-main',
      )!;
      output.panelIds = ['OutputTopComponent', 'BlueFileManagerTopComponent'];
      output.dockedPanelIds = [...output.panelIds];
      output.activePanelId = 'BlueFileManagerTopComponent';

      useWorkbenchStore.setState({
        api,
        auxiliary: applyAuxiliaryLayout(api, state),
        floatingOrigins: {},
        closedPanelOrigins: {},
      });
    });

    await waitFor(() => Boolean(document.querySelector('[title="/work"]')));
    return api;
  }

  it(
    'keeps an unrelated panel session intact while Libraries moves between other edges',
    { timeout: 60_000 },
    async () => {
      const api = await setupWorkbenchWithFileManagerActive();

      // Expand the File Manager root (single-click toggle has a short delay)
      // and select one of the loaded children.
      const workRoot = document.querySelector<HTMLElement>('[title="/work"]')!;
      act(() => {
        workRoot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await waitFor(() => Boolean(document.querySelector('[title="/work/project.blue"]')));
      await new Promise((resolve) => setTimeout(resolve, 350));

      const audioLabel = document.querySelector<HTMLElement>('[title="/work/audio"]')!;
      const audioRow = audioLabel.closest<HTMLElement>('div.select-none')!;
      act(() => {
        audioRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await act(async () => {});

      expect(audioRow.className).toContain('bg-app-accent');

      // Scroll the tree away from the top.
      const fileManagerHost = document.querySelector<HTMLElement>(
        '[data-testid="panel-host-BlueFileManagerTopComponent"]',
      )!;
      const scrollContainer = fileManagerHost.querySelector<HTMLElement>(
        'div[style*="overflow: auto"]',
      )!;
      scrollContainer.scrollTop = 8;
      scrollContainer.dispatchEvent(new Event('scroll'));
      await act(async () => {});
      expect(scrollContainer.scrollTop).toBe(8);


      const fileManagerPanel = api.getPanel('BlueFileManagerTopComponent');
      const mountsBefore = mountCounts['BlueFileManagerTopComponent'];
      const focusBefore = document.activeElement;
      const bottomGroup = api.groups.find((group) => group.id === 'blue-aux-edge-bottom')!;
      const bottomHeightBefore = bottomGroup.element.getBoundingClientRect().height;
      const fileManagerFocusedBefore = focusBefore && fileManagerHost.contains(focusBefore);

      // Moves that do not touch the bottom edge must not disturb the session.
      for (const targetEdge of ['left', 'right'] as const) {
        await act(async () => {
          useWorkbenchStore.getState().movePanelToEdge('LibrariesTopComponent', targetEdge);
        });
        await act(async () => {});
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(api.getPanel('BlueFileManagerTopComponent'), `${targetEdge}: identity`).toBe(
          fileManagerPanel,
        );
        expect(mountCounts['BlueFileManagerTopComponent'], `${targetEdge}: no remount`).toBe(
          mountsBefore,
        );

        const expansionRow = document.querySelector('[title="/work/project.blue"]');
        expect(expansionRow, `${targetEdge}: expansion retained`).not.toBeNull();

        const selectedRow = document
          .querySelector<HTMLElement>('[title="/work/audio"]')!
          .closest<HTMLElement>('div.select-none')!;
        expect(selectedRow.className, `${targetEdge}: selection retained`).toContain(
          'bg-app-accent',
        );

        expect(scrollContainer.scrollTop, `${targetEdge}: scroll retained`).toBe(8);

        const bottomGroupAfter = api.groups.find(
          (group) => group.id === 'blue-aux-edge-bottom',
        )!;
        expect(
          bottomGroupAfter.element.getBoundingClientRect().height,
          `${targetEdge}: docked size retained`,
        ).toBeCloseTo(bottomHeightBefore, 0);

        const auxiliary = useWorkbenchStore.getState().auxiliary;
        const fileManagerPresentation = auxiliary.groups.find((group) =>
          group.panelIds.includes('BlueFileManagerTopComponent'),
        );
        expect(fileManagerPresentation?.isMaximized, `${targetEdge}: presentation retained`).toBe(
          false,
        );
        expect(
          fileManagerPresentation?.dockedPanelIds,
          `${targetEdge}: still docked`,
        ).toContain('BlueFileManagerTopComponent');

        const active = document.activeElement;
        const librariesGroupElement = api
          .getPanel('LibrariesTopComponent')
          ?.group.element as HTMLElement | undefined;
        const fileManagerGroupElement = api.getPanel(
          'BlueFileManagerTopComponent',
        )?.group.element as HTMLElement | undefined;
        expect(
          Boolean(
            librariesGroupElement?.contains(active) || fileManagerGroupElement?.contains(active),
          ),
          `${targetEdge}: focus stays with the moved or unaffected panel`,
        ).toBe(true);

        expect(capturedErrors, `${targetEdge}: no errors`).toEqual([]);
      }
    },
  );
});

describe('workbench tree movement edge cases', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    resetFileManagerTreeSessionState();
    mountCounts['LibrariesTopComponent'] = 0;
    mountCounts['BlueFileManagerTopComponent'] = 0;
    capturedErrors.length = 0;

    host = document.createElement('div');
    host.style.width = '1200px';
    host.style.height = '800px';
    document.body.appendChild(host);
    root = createRoot(host);

    installLayoutFixtureStyles();

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
    await act(async () => root.unmount());
    host.remove();
    useWorkbenchStore.setState({ api: null });
    delete (window as unknown as { blueAPI?: Record<string, unknown> }).blueAPI;
  });

  async function setupWorkbench(
    extra?: (state: ReturnType<typeof createDefaultAuxiliaryLayoutState>) => void,
  ): Promise<DockviewApi> {
    let dockviewApi: DockviewApi | undefined;
    await act(async () => {
      root.render(
        <DockviewReact
          components={{ default: PanelHost }}
          onReady={(event) => {
            dockviewApi = event.api;
          }}
        />,
      );
    });

    const api = dockviewApi!;
    await act(async () => {
      api.layout(1200, 800);
      api.addPanel({ id: 'ScoreTopComponent', component: 'default', title: 'Score' });

      const state = createDefaultAuxiliaryLayoutState();
      const properties = state.groups.find(
        (group) => group.kind === 'seeded' && group.seedGroupId === 'properties-main',
      )!;
      properties.edge = 'right';
      properties.panelIds = ['LibrariesTopComponent'];
      properties.dockedPanelIds = ['LibrariesTopComponent'];
      properties.activePanelId = 'LibrariesTopComponent';

      const output = state.groups.find(
        (group) => group.kind === 'seeded' && group.seedGroupId === 'output-main',
      )!;
      output.panelIds = ['OutputTopComponent', 'BlueFileManagerTopComponent'];
      output.dockedPanelIds = [...output.panelIds];
      output.activePanelId = 'BlueFileManagerTopComponent';

      extra?.(state);

      useWorkbenchStore.setState({
        api,
        auxiliary: applyAuxiliaryLayout(api, state),
        floatingOrigins: {},
        closedPanelOrigins: {},
      });
    });
    await act(async () => {});
    return api;
  }

  it(
    'defers an edge move while a tree drag is active and recovers after it ends',
    { timeout: 60_000 },
    async () => {
      const api = await setupWorkbench();
      const fileManagerPanel = api.getPanel('BlueFileManagerTopComponent');

      const manager = acquireTreeDndManager(document)!;
      const sourceId = manager.getRegistry().addSource('blue/test', {
        canDrag: () => true,
        isDragging: () => true,
        beginDrag: () => ({ kind: 'blue/test' }),
        endDrag: () => undefined,
      });
      manager.getActions().beginDrag([sourceId]);

      await act(async () => {
        useWorkbenchStore.getState().movePanelToEdge('LibrariesTopComponent', 'left');
      });

      const auxiliary = useWorkbenchStore.getState().auxiliary;
      const librariesInstance = auxiliary.groups.find((group) =>
        group.panelIds.includes('LibrariesTopComponent'),
      );
      expect(librariesInstance?.edge).toBe('right');
      expect(api.groups.find((group) => group.id === 'blue-aux-edge-left')).toBeUndefined();

      manager.getActions().endDrag();
      manager.getRegistry().removeSource(sourceId);

      await act(async () => {
        useWorkbenchStore.getState().movePanelToEdge('LibrariesTopComponent', 'left');
      });
      await act(async () => {});

      const recovered = useWorkbenchStore.getState().auxiliary;
      expect(
        recovered.groups.find((group) => group.panelIds.includes('LibrariesTopComponent'))?.edge,
      ).toBe('left');
      expect(api.getPanel('BlueFileManagerTopComponent')).toBe(fileManagerPanel);
      expect(capturedErrors).toEqual([]);
    },
  );

  it(
    'recovers after real Arborist and native Library drags are interrupted by edge moves',
    { timeout: 60_000 },
    async () => {
      const api = await setupWorkbench();
      api.getPanel('LibrariesTopComponent')?.api.setActive();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const libraryItem = document.querySelector<HTMLElement>(
        '[data-library-node-id="library-item-organic"]',
      )!;
      const nativeDragData = new DataTransfer();
      act(() => {
        libraryItem.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        libraryItem.dispatchEvent(
          new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer: nativeDragData,
          }),
        );
      });
      expect(readLibraryDragDescriptor(nativeDragData)).not.toBeNull();

      await act(async () => {
        useWorkbenchStore.getState().movePanelToEdge('LibrariesTopComponent', 'left');
      });
      expect(
        getGroupInstanceForPanel(useWorkbenchStore.getState().auxiliary, 'LibrariesTopComponent')?.edge,
      ).toBe('left');

      nativeDragData.dropEffect = 'copy';
      act(() => {
        libraryItem.dispatchEvent(
          new DragEvent('dragend', { bubbles: true, dataTransfer: nativeDragData }),
        );
      });

      const arboristHost = document.createElement('div');
      document.body.appendChild(arboristHost);
      const arboristRoot = createRoot(arboristHost);
      await act(async () => {
        arboristRoot.render(
          <BlueTree<{ id: string; name: string }>
            data={[{ id: 'real-1', name: 'real-drag-row' }]}
            width={320}
            height={24}
            rowHeight={24}
            indent={16}
            idAccessor="id"
          >
            {({ node, style, dragHandle }: NodeRendererProps<{ id: string; name: string }>) => (
              <div ref={dragHandle} style={style} data-testid={`real-drag-${node.data.id}`}>
                {node.data.name}
              </div>
            )}
          </BlueTree>,
        );
      });
      await act(async () => {});

      const arboristRow = arboristHost.querySelector<HTMLElement>('[data-testid="real-drag-real-1"]')!;
      const arboristDragData = new DataTransfer();
      act(() => {
        arboristRow.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        arboristRow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        arboristRow.dispatchEvent(
          new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer: arboristDragData,
          }),
        );
      });
      expect(hasActiveTreeDrag(document)).toBe(true);

      await act(async () => {
        useWorkbenchStore.getState().movePanelToEdge('LibrariesTopComponent', 'bottom');
      });
      expect(
        getGroupInstanceForPanel(useWorkbenchStore.getState().auxiliary, 'LibrariesTopComponent')?.edge,
      ).toBe('left');

      act(() => {
        arboristRow.dispatchEvent(
          new DragEvent('dragend', { bubbles: true, dataTransfer: arboristDragData }),
        );
      });
      await act(async () => {});
      expect(hasActiveTreeDrag(document)).toBe(false);

      await act(async () => {
        useWorkbenchStore.getState().movePanelToEdge('LibrariesTopComponent', 'bottom');
      });
      expect(
        getGroupInstanceForPanel(useWorkbenchStore.getState().auxiliary, 'LibrariesTopComponent')?.edge,
      ).toBe('bottom');
      expect(capturedErrors).toEqual([]);

      await act(async () => arboristRoot.unmount());
      arboristHost.remove();
    },
  );

  it(
    'preserves minimized neighbors while another panel moves',
    { timeout: 60_000 },
    async () => {
      const api = await setupWorkbench((state) => {
        const output = state.groups.find(
          (group) => group.kind === 'seeded' && group.seedGroupId === 'output-main',
        )!;
        output.dockedPanelIds = ['BlueFileManagerTopComponent'];
      });

      const before = useWorkbenchStore.getState().auxiliary;
      const outputBefore = before.groups.find(
        (group) => group.kind === 'seeded' && group.seedGroupId === 'output-main',
      )!;
      expect(outputBefore.dockedPanelIds).not.toContain('OutputTopComponent');

      await act(async () => {
        useWorkbenchStore.getState().movePanelToEdge('LibrariesTopComponent', 'bottom');
      });
      await act(async () => {});

      const after = useWorkbenchStore.getState().auxiliary;
      const outputAfter = after.groups.find(
        (group) => group.kind === 'seeded' && group.seedGroupId === 'output-main',
      )!;
      expect(outputAfter.dockedPanelIds).not.toContain('OutputTopComponent');
      expect(
        after.groups.find((group) => group.panelIds.includes('LibrariesTopComponent'))?.edge,
      ).toBe('bottom');
      expect(capturedErrors).toEqual([]);
    },
  );

  it(
    'survives a tree surface unmounting in the same tick as a panel move',
    { timeout: 60_000 },
    async () => {
      const api = await setupWorkbench();

      const transientHost = document.createElement('div');
      document.body.appendChild(transientHost);
      const transientRoot = createRoot(transientHost);
      await act(async () => {
        transientRoot.render(
          <BlueTree<{ id: string; name: string }>
            data={[
              { id: 't-1', name: 'transient-a' },
              { id: 't-2', name: 'transient-b' },
            ]}
            width={320}
            height={48}
            rowHeight={24}
            indent={16}
            idAccessor="id"
          >
            {({ node, style }: NodeRendererProps<{ id: string; name: string }>) => (
              <div style={style} data-testid={`transient-row-${node.data.name}`}>
                {node.data.name}
              </div>
            )}
          </BlueTree>,
        );
      });

      await act(async () => {
        transientRoot.unmount();
        useWorkbenchStore.getState().movePanelToEdge('LibrariesTopComponent', 'left');
      });
      await act(async () => {});
      transientHost.remove();

      const auxiliary = useWorkbenchStore.getState().auxiliary;
      expect(
        auxiliary.groups.find((group) => group.panelIds.includes('LibrariesTopComponent'))?.edge,
      ).toBe('left');
      expect(capturedErrors.filter((message) => message.includes('two HTML5 backends'))).toEqual([]);
    },
  );
});
