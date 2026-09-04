// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultWindowLayoutSettings } from '../../shared/window-layout-settings';
import UdoWorkspacePanel from '../components/workbench/panels/udo/UdoWorkspacePanel';
import { useLibraryStore } from '../stores/library-store';
import { useLayoutSettingsStore } from '../stores/layout-settings-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../components/workbench/panels/udo/UdoEditor', () => ({
  default: () => <div data-testid="udo-editor" />,
}));

let container: HTMLDivElement;
let root: Root;
let rectSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.blueAPI = {
    ...window.blueAPI,
    browseLibraries: vi.fn(async (request) => ({
      ok: true as const,
      value: {
        contentRevision: 1,
        parent: {
          key: null,
          nodeId: `root-${request.parent.libraryType}`,
          parentId: null,
          libraryType: request.parent.libraryType,
          scope: request.parent.scope,
          nodeKind: 'root' as const,
          displayName: 'Root',
          breadcrumb: ['Root'],
          revision: 1,
          hasChildren: false,
        },
        children: [],
        nextCursor: null,
      },
    })),
    onLibraryChanged: vi.fn(() => () => undefined),
    previewProjectLibraryDelete: vi.fn(async () => ({
      ok: true as const,
      value: {
        confirmationToken: 'cut-project-udo',
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
            clipboardId: 'udo-buffer',
            libraryType: 'udo' as const,
          },
          capturedAt: 100,
        },
        closedEditorSessionIds: [],
      },
    })),
  };
  useLibraryStore.setState({ clipboard: null, error: null });
  useLayoutSettingsStore.setState({ layout: createDefaultWindowLayoutSettings() });
  rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 900,
    bottom: 390,
    width: 900,
    height: 390,
    toJSON: () => ({}),
  } as DOMRect);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  rectSpy.mockRestore();
  document.body.replaceChildren();
});

describe('empty UDO workspace', () => {
  it('keeps an empty drop-ready table and draggable separator visible at docked height', () => {
    act(() => {
      root.render(
        <UdoWorkspacePanel
          udos={[]}
          resetKey="empty-project"
          onInsertUdos={vi.fn()}
          onRemoveIndices={vi.fn()}
          onReorder={vi.fn()}
          onUpdateUdo={vi.fn()}
          onConvertStyle={vi.fn()}
          libraryDropTarget={{ projectSessionId: 7, projectRevision: 3 }}
        />,
      );
    });

    expect(container.querySelector('table')).toBeTruthy();
    expect(container.textContent).toContain('Name');
    expect(container.textContent).toContain('Style');
    expect(container.querySelector('[aria-label^="Insert UDO at end"]')).toBeTruthy();
    expect(container.querySelector('[role="separator"]')).toBeTruthy();
    const tablePane = container.querySelector(
      '[data-split-id="udo.workspace.outer"]',
    ) as HTMLElement;
    expect(tablePane.style.height).toBe('200px');
  });

  it('matches an embedded Instrument UDO source for shared Copy and Cut', async () => {
    vi.mocked(window.blueAPI.browseLibraries).mockImplementation(async (request) => ({
      ok: true as const,
      value:
        request.parent.scope === 'projectOwned'
          ? {
              contentRevision: 1,
              parent: {
                key: null,
                nodeId: 'project-udo-root',
                parentId: null,
                libraryType: 'udo' as const,
                scope: 'projectOwned' as const,
                nodeKind: 'root' as const,
                displayName: 'Project UDOs',
                breadcrumb: ['Project UDOs'],
                revision: 'project-udo-root',
                hasChildren: true,
              },
              children: [
                {
                  key: {
                    scope: 'projectOwned',
                    libraryType: 'udo',
                    projectSessionId: 7,
                    locator: {
                      kind: 'udo',
                      instrumentAssignmentId: '4',
                      sessionObjectId: 'instrument:4:udo:0',
                      persistedFingerprint: {
                        canonicalHash: 'embedded-hash',
                        opcodeName: 'embeddedTone',
                        style: 'CLASSIC',
                      },
                    },
                  },
                  nodeId: 'instrument-4-udo-0',
                  parentId: null,
                  libraryType: 'udo',
                  scope: 'projectOwned',
                  nodeKind: 'item',
                  displayName: 'embeddedTone',
                  breadcrumb: ['Project Orchestra', '4 Host', 'UDOs', 'embeddedTone'],
                  supportStatus: 'supported',
                  objectType: 'blue.udo.UserDefinedOpcode',
                  revision: 'embedded-hash',
                  hasChildren: false,
                },
              ],
              nextCursor: null,
            }
          : {
              contentRevision: 1,
              parent: {
                key: null,
                nodeId: `root-${request.parent.libraryType}`,
                parentId: null,
                libraryType: request.parent.libraryType,
                scope: 'user' as const,
                nodeKind: 'root' as const,
                displayName: 'Root',
                breadcrumb: ['Root'],
                revision: 1,
                hasChildren: false,
              },
              children: [],
              nextCursor: null,
            },
    }));
    act(() => {
      root.render(
        <UdoWorkspacePanel
          udos={[
            {
              name: 'embeddedTone',
              style: 'CLASSIC',
              outTypes: 'a',
              inTypes: 'a',
              inputArguments: '',
              code: 'aout = ain',
              comments: '',
            },
          ]}
          resetKey="instrument-4"
          onInsertUdos={vi.fn()}
          onRemoveIndices={vi.fn()}
          onReorder={vi.fn()}
          onUpdateUdo={vi.fn()}
          onConvertStyle={vi.fn()}
          libraryDropTarget={{
            projectSessionId: 7,
            projectRevision: 3,
            instrumentAssignmentId: '4',
          }}
        />,
      );
    });
    const row = container.querySelector('[data-library-drop-target="udo-row"]') as HTMLElement;
    await vi.waitFor(() => {
      expect(window.blueAPI.browseLibraries).toHaveBeenCalled();
      expect(row.getAttribute('draggable')).toBe('true');
    });
    act(() => row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    await act(async () => {
      await Promise.resolve();
    });
    act(() =>
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const cut = [...document.body.querySelectorAll('[role="menuitem"]')].find(
      (candidate) => candidate.textContent === 'Cut',
    ) as HTMLElement;
    expect(cut.getAttribute('aria-disabled')).not.toBe('true');
    await act(async () => {
      cut.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(useLibraryStore.getState().clipboard).toMatchObject({
      operation: 'cut',
      source: { kind: 'buffer', clipboardId: 'udo-buffer', libraryType: 'udo' },
    });
  });
});
