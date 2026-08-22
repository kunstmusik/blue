import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DockviewReact, type DockviewApi } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyAuxiliaryLayout,
  createDefaultAuxiliaryLayoutState,
  getGroupInstanceForPanel,
  isAuxiliaryPanelId,
} from '../components/workbench/auxiliary-layout';
import {
  getAuxiliaryEdgeFromBounds,
  getAuxiliaryEdgeFromGroupElement,
} from '../components/workbench/auxiliary-drag';
import { useWorkbenchStore } from '../stores/workbench-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const capturedErrors: string[] = [];

function recordError(event: ErrorEvent | PromiseRejectionEvent) {
  const message =
    'reason' in event && event.reason instanceof Error
      ? event.reason.message
      : 'message' in event
        ? String(event.message)
        : String(event);
  capturedErrors.push(message);
}

function isAuxiliaryEdge(value: string | undefined): value is 'left' | 'right' | 'bottom' {
  return value === 'left' || value === 'right' || value === 'bottom';
}

/**
 * Reproduction fixture for the reported app behavior: Dockview wired with the
 * same layout listeners WorkbenchShell registers in onReady, driving the real
 * workbench store. This is the wiring my earlier fixtures lacked.
 */
describe('workbench shell move wiring', () => {
  let host: HTMLDivElement;
  let root: Root;
  let api: DockviewApi | undefined;

  beforeEach(() => {
    capturedErrors.length = 0;
    host = document.createElement('div');
    host.style.width = '1200px';
    host.style.height = '800px';
    document.body.appendChild(host);
    root = createRoot(host);
    window.addEventListener('error', recordError);
    window.addEventListener('unhandledrejection', recordError);
  });

  afterEach(async () => {
    window.removeEventListener('error', recordError);
    window.removeEventListener('unhandledrejection', recordError);
    await act(async () => root.unmount());
    host.remove();
    useWorkbenchStore.setState({ api: null });
  });

  async function setupWorkbench(): Promise<DockviewApi> {
    let dockviewApi: DockviewApi | undefined;
    await act(async () => {
      root.render(
        <DockviewReact
          components={{ default: () => <div className="h-full w-full">panel</div> }}
          onReady={(event) => {
            dockviewApi = event.api;
          }}
        />,
      );
    });

    const workbenchApi = dockviewApi!;
    await act(async () => {
      workbenchApi.layout(1200, 800);
      workbenchApi.addPanel({ id: 'ScoreTopComponent', component: 'default', title: 'Score' });

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
        api: workbenchApi,
        auxiliary: applyAuxiliaryLayout(workbenchApi, state),
        floatingOrigins: {},
        closedPanelOrigins: {},
      });
    });

    // WorkbenchShell-equivalent listeners (WorkbenchShell.tsx onReady).
    const shell = host;
    workbenchApi.onDidLayoutChange(() => {
      useWorkbenchStore.getState().syncAuxiliaryLayout();
    });
    workbenchApi.onDidActivePanelChange(() => {
      useWorkbenchStore.getState().syncAuxiliaryLayout();
    });
    workbenchApi.onDidMovePanel(({ panel, from }) => {
      if (!isAuxiliaryPanelId(panel.id) || panel.group.id === from.id) {
        return;
      }

      const mainElement = shell.querySelector<HTMLElement>('.workbench-shell__main') ?? shell;
      const targetEdge =
        getAuxiliaryEdgeFromGroupElement(panel.group.element) ??
        (mainElement
          ? getAuxiliaryEdgeFromBounds(
              mainElement.getBoundingClientRect(),
              panel.group.element.getBoundingClientRect(),
            )
          : undefined);

      if (!targetEdge) {
        return;
      }

      useWorkbenchStore.getState().movePanelToEdge(panel.id, targetEdge);
    });

    await act(async () => {});
    return workbenchApi;
  }

  it(
    'moves File Manager to the left edge through the real shell wiring',
    { timeout: 60_000 },
    async () => {
      api = await setupWorkbench();

      const fileManagerPanel = api.getPanel('BlueFileManagerTopComponent');
      expect(fileManagerPanel).toBeDefined();

      await act(async () => {
        useWorkbenchStore.getState().movePanelToEdge('BlueFileManagerTopComponent', 'left');
      });
      await act(async () => {});
      await new Promise((resolve) => setTimeout(resolve, 30));

      const auxiliary = useWorkbenchStore.getState().auxiliary;
      const instance = getGroupInstanceForPanel(auxiliary, 'BlueFileManagerTopComponent');
      expect(instance?.edge).toBe('left');
      expect(instance?.dockedPanelIds).toContain('BlueFileManagerTopComponent');

      const leftGroup = api.groups.find((group) => group.id === 'blue-aux-edge-left');
      expect(leftGroup?.panels.map((panel) => panel.id)).toContain('BlueFileManagerTopComponent');

      const output = auxiliary.groups.find(
        (group) => group.kind === 'seeded' && group.seedGroupId === 'output-main',
      );
      expect(output?.dockedPanelIds).not.toContain('BlueFileManagerTopComponent');
    },
  );

  it(
    'minimizes Libraries after moving it to the left edge',
    { timeout: 60_000 },
    async () => {
      api = await setupWorkbench();

      await act(async () => {
        useWorkbenchStore.getState().movePanelToEdge('LibrariesTopComponent', 'left');
      });
      await act(async () => {});
      await new Promise((resolve) => setTimeout(resolve, 30));

      const afterMove = useWorkbenchStore.getState().auxiliary;
      expect(
        getGroupInstanceForPanel(afterMove, 'LibrariesTopComponent')?.edge,
      ).toBe('left');

      await act(async () => {
        useWorkbenchStore.getState().minimizeAuxiliaryPanel('LibrariesTopComponent');
      });
      await act(async () => {});
      await new Promise((resolve) => setTimeout(resolve, 30));

      const afterMinimize = useWorkbenchStore.getState().auxiliary;
      const librariesInstance = getGroupInstanceForPanel(afterMinimize, 'LibrariesTopComponent');
      expect(librariesInstance?.dockedPanelIds).not.toContain('LibrariesTopComponent');
      expect(api.getPanel('LibrariesTopComponent')).toBeUndefined();
      expect(api.groups.find((group) => group.id === 'blue-aux-edge-left')).toBeUndefined();
    },
  );
});
