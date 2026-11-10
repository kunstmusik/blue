// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import ArrangementPanel from '../components/workbench/panels/orchestra/ArrangementPanel';
import { HostDocumentContext } from '../hooks/use-host-document';

vi.mock('../components/libraries/LibraryDropMarker', () => ({
  LibraryDropZone: ({
    children,
  }: {
    children: (state: { active: boolean; dropProps: Record<string, unknown> }) => React.ReactNode;
  }) => children({ active: false, dropProps: {} }),
  LibraryTableDropMarker: () => null,
}));

vi.mock('../components/libraries/ProjectLibraryDragSource', () => ({
  ProjectLibraryDragSource: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/libraries/use-project-library-nodes', () => ({
  useProjectLibraryNodes: () => [],
}));

vi.mock('../components/workbench/panels/orchestra/ArrangementContextMenu', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../stores/library-store', () => {
  const state = {
    clipboard: null,
    transferToProject: vi.fn(),
    captureClipboard: vi.fn(),
  };
  const useLibraryStore = (selector: (value: typeof state) => unknown) => selector(state);
  return { useLibraryStore };
});

vi.mock('../stores/midi-routing-store', () => {
  const state = { focusedTarget: null };
  const useMidiRoutingStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => ({ focusOrchestra: vi.fn() }) },
  );
  return { useMidiRoutingStore };
});

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const popout = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://popout.test',
});
const popoutDoc = popout.window.document;
const PopoutMouseEvent = popout.window.MouseEvent;

describe('ArrangementPanel popout dismissal', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = popoutDoc.createElement('div');
    popoutDoc.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
  });

  it('dismisses the add menu from the host document and ignores main-window input', async () => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <ArrangementPanel
            rows={[]}
            selectedAssignmentId={null}
            onSelectAssignment={vi.fn()}
            onOrchestraPatch={vi.fn()}
            projectSessionId={1}
            projectRevision={1}
          />
        </HostDocumentContext.Provider>,
      );
    });

    const addButton = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === '+ Add',
    )!;
    expect(addButton).toBeTruthy();

    act(() => {
      addButton.dispatchEvent(new PopoutMouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const openMenu = () => popoutDoc.body.querySelector<HTMLElement>('[data-host-surface]');
    expect(openMenu()).toBeTruthy();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(openMenu()).toBeTruthy();

    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(openMenu()).toBeFalsy();
  });

  it('resizes columns locally in popout document without persistence and commits on release', () => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <ArrangementPanel
            rows={[
              {
                assignmentId: '1',
                instrumentName: 'Test Instrument',
                enabled: true,
                extraColumns: {},
              },
            ]}
            selectedAssignmentId={'1'}
            onSelectAssignment={vi.fn()}
            onOrchestraPatch={vi.fn()}
            projectSessionId={1}
            projectRevision={1}
          />
        </HostDocumentContext.Provider>,
      );
    });

    const resizer = host.querySelector('.cursor-col-resize') as HTMLElement;
    expect(resizer).toBeTruthy();
    const th = resizer.closest('th') as HTMLTableCellElement;
    const initialWidth = th.style.width;

    act(() => {
      resizer.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true, clientX: 50 }));
    });
    expect(popoutDoc.body.style.cursor).toBe('col-resize');

    act(() => {
      popout.window.dispatchEvent(
        new PopoutMouseEvent('mousemove', { bubbles: true, clientX: 120 }),
      );
    });
    expect(th.style.width).not.toBe(initialWidth);

    act(() => {
      popout.window.dispatchEvent(new PopoutMouseEvent('mouseup', { bubbles: true, clientX: 120 }));
    });
    expect(popoutDoc.body.style.cursor).toBe('');
    expect(th.style.width).not.toBe(initialWidth);
  });

  it('cancels column resize on Escape in popout document and restores baseline width', () => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <ArrangementPanel
            rows={[
              {
                assignmentId: '1',
                instrumentName: 'Test Instrument',
                enabled: true,
                extraColumns: {},
              },
            ]}
            selectedAssignmentId={'1'}
            onSelectAssignment={vi.fn()}
            onOrchestraPatch={vi.fn()}
            projectSessionId={1}
            projectRevision={1}
          />
        </HostDocumentContext.Provider>,
      );
    });

    const resizer = host.querySelector('.cursor-col-resize') as HTMLElement;
    const th = resizer.closest('th') as HTMLTableCellElement;
    const initialWidth = th.style.width;

    act(() => {
      resizer.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true, clientX: 50 }));
    });
    act(() => {
      popout.window.dispatchEvent(
        new PopoutMouseEvent('mousemove', { bubbles: true, clientX: 150 }),
      );
    });
    expect(th.style.width).not.toBe(initialWidth);

    act(() => {
      popout.window.dispatchEvent(
        new popout.window.KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(th.style.width).toBe(initialWidth);
    expect(popoutDoc.body.style.cursor).toBe('');
  });

  it('cancels column resize on host blur in popout document and restores baseline width', () => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <ArrangementPanel
            rows={[
              {
                assignmentId: '1',
                instrumentName: 'Test Instrument',
                enabled: true,
                extraColumns: {},
              },
            ]}
            selectedAssignmentId={'1'}
            onSelectAssignment={vi.fn()}
            onOrchestraPatch={vi.fn()}
            projectSessionId={1}
            projectRevision={1}
          />
        </HostDocumentContext.Provider>,
      );
    });

    const resizer = host.querySelector('.cursor-col-resize') as HTMLElement;
    const th = resizer.closest('th') as HTMLTableCellElement;
    const initialWidth = th.style.width;

    act(() => {
      resizer.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true, clientX: 50 }));
    });
    act(() => {
      popout.window.dispatchEvent(
        new PopoutMouseEvent('mousemove', { bubbles: true, clientX: 150 }),
      );
    });
    expect(th.style.width).not.toBe(initialWidth);

    act(() => {
      popout.window.dispatchEvent(new popout.window.FocusEvent('blur'));
    });

    expect(th.style.width).toBe(initialWidth);
    expect(popoutDoc.body.style.cursor).toBe('');
  });
});
