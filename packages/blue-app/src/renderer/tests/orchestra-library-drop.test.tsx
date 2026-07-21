// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ArrangementPanel from '../components/workbench/panels/orchestra/ArrangementPanel';
import { BLUE_LIBRARY_DRAG_MIME } from '../components/libraries/library-drag-drop';
import { useLibraryStore } from '../stores/library-store';
import { createTestDataTransfer, dispatchDragEvent, setElementRect } from './library-interaction-test-helpers';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const previewLibraryTransfer = vi.fn(async (request) => ({
  ok: true as const,
  value: {
    previewToken: 'preview-1',
    item: {
      key: { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'instrument-1' },
      displayName: 'Pad',
      libraryType: 'instrument' as const,
      scope: 'user' as const,
      objectType: 'GenericInstrument',
      supportStatus: 'supported' as const,
      supportMessage: null,
      fields: {},
      dependencies: { itemOwned: [], unresolvedExternal: [] },
    },
    target: request.target,
    requestedMode: 'independent' as const,
    allowedModes: ['independent'] as const,
    canApply: true,
    blockingReasons: [],
  },
}));
const applyLibraryTransfer = vi.fn(async () => ({
  ok: true as const,
  value: { projectSessionId: 7, projectRevision: 13, libraryType: 'instrument' as const, insertedIdentity: '9', message: 'Instrument added.' },
}));
const onOrchestraPatch = vi.fn();
const projectInstrumentNodes = ['1', '2'].map((assignmentId) => ({
  key: {
    scope: 'projectOwned' as const,
    libraryType: 'instrument' as const,
    projectSessionId: 7,
    locator: { kind: 'instrument' as const, assignmentId },
  },
  nodeId: `project-instrument-${assignmentId}`, parentId: 'project-instruments',
  libraryType: 'instrument' as const, scope: 'projectOwned' as const, nodeKind: 'item' as const,
  displayName: assignmentId === '1' ? 'Lead' : 'Bass', breadcrumb: ['Project Orchestra'],
  supportStatus: 'supported' as const, objectType: 'GenericInstrument',
  revision: `hash-${assignmentId}`, hasChildren: false,
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  previewLibraryTransfer.mockClear();
  applyLibraryTransfer.mockClear();
  onOrchestraPatch.mockClear();
  window.blueAPI = {
    ...window.blueAPI,
    previewLibraryTransfer,
    applyLibraryTransfer,
    previewProjectLibraryDelete: vi.fn(async () => ({
      ok: true as const,
      value: {
        confirmationToken: 'cut-project-instrument',
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
          source: { kind: 'buffer' as const, clipboardId: 'instrument-buffer', libraryType: 'instrument' as const },
          capturedAt: 100,
        },
        closedEditorSessionIds: [],
      },
    })),
    browseLibraries: vi.fn(async (request) => ({
      ok: true as const,
      value: {
        contentRevision: 3,
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
        children: request.parent.scope === 'projectOwned' ? projectInstrumentNodes : [],
        nextCursor: null,
      },
    })),
    onLibraryChanged: vi.fn(() => () => undefined),
  };
  useLibraryStore.setState({
    clipboard: {
      operation: 'copy',
      source: { kind: 'userNode', libraryType: 'instrument', nodeId: 'instrument-1', revision: 2 },
      capturedAt: 1,
    },
    transferPreview: null,
    transferSource: null,
    error: null,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <ArrangementPanel
        rows={[
          { assignmentId: '1', enabled: true, instrumentName: 'Lead', instrumentType: 'generic', instrumentSummary: 'GenericInstrument', editable: true },
          { assignmentId: '2', enabled: true, instrumentName: 'Bass', instrumentType: 'generic', instrumentSummary: 'GenericInstrument', editable: true },
        ]}
        selectedAssignmentId={null}
        onSelectAssignment={vi.fn()}
        onOrchestraPatch={onOrchestraPatch}
        projectSessionId={7}
        projectRevision={12}
      />,
    );
  });
});

afterEach(() => {
  act(() => { root.unmount(); });
  document.body.replaceChildren();
});

describe('Orchestra Library drop targets', () => {
  it('renders only numerically valid boundaries and pastes at the exact focused boundary', async () => {
    const markers = container.querySelectorAll('[aria-label*="Insert Instrument"]');
    expect(markers).toHaveLength(1);
    expect(container.querySelectorAll('[data-library-drop-target="orchestra-row"]')).toHaveLength(1);
    const end = markers[0] as HTMLElement;
    await act(async () => {
      end.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'v', ctrlKey: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(previewLibraryTransfer).toHaveBeenCalledWith(expect.objectContaining({
      source: expect.objectContaining({ kind: 'clipboard' }),
      target: { kind: 'orchestra', projectSessionId: 7, projectRevision: 12, insertIndex: 2 },
    }));
    expect(applyLibraryTransfer).toHaveBeenCalledWith('preview-1');
  });

  it('auto-scrolls during drag hover and clears its marker on Escape', () => {
    const marker = container.querySelector('[aria-label="Insert Instrument at end; paste a Library item here"]') as HTMLElement;
    const scroller = marker.closest('[data-library-autoscroll]') as HTMLElement;
    setElementRect(scroller, { left: 0, top: 0, width: 300, height: 100 });
    scroller.scrollTop = 40;
    const transfer = createTestDataTransfer();
    transfer.setData(BLUE_LIBRARY_DRAG_MIME, JSON.stringify({ dragSessionId: 'drag-1', libraryType: 'instrument' }));
    dispatchDragEvent(marker, 'dragover', transfer, { clientY: 98 });
    expect(scroller.scrollTop).toBeGreaterThan(40);
    act(() => { marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(marker.className).not.toContain('bg-app-accent ');
  });

  it('accepts a direct row drop and Library paste from the row context menu', async () => {
    const row = container.querySelector('[data-library-drop-target="orchestra-row"]') as HTMLElement;
    const transfer = createTestDataTransfer();
    transfer.setData(BLUE_LIBRARY_DRAG_MIME, JSON.stringify({
      dragSessionId: 'drag-instrument', libraryType: 'instrument',
    }));
    dispatchDragEvent(row, 'dragover', transfer);
    dispatchDragEvent(row, 'drop', transfer);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(previewLibraryTransfer).toHaveBeenLastCalledWith(expect.objectContaining({
      source: { kind: 'drag', dragSessionId: 'drag-instrument' },
      target: { kind: 'orchestra', projectSessionId: 7, projectRevision: 12, insertIndex: 2 },
    }));

    previewLibraryTransfer.mockClear();
    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    const paste = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((item) => item.textContent === 'Paste') as HTMLElement;
    expect(paste?.getAttribute('aria-disabled')).not.toBe('true');
    expect(document.body.textContent).not.toContain('Paste Library Instrument');
    act(() => paste.click());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(previewLibraryTransfer).toHaveBeenCalledWith(expect.objectContaining({
      source: expect.objectContaining({ kind: 'clipboard' }),
      target: { kind: 'orchestra', projectSessionId: 7, projectRevision: 12, insertIndex: 2 },
    }));
  });

  it('captures project Instrument Copy and Cut in the shared Library buffer', async () => {
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const row = container.querySelector('[data-assignment-id="1"]') as HTMLElement;
    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    expect(document.body.textContent).not.toContain('Copy to User Library');
    const copy = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((candidate) => candidate.textContent === 'Copy') as HTMLElement;
    act(() => copy.click());
    expect(useLibraryStore.getState().clipboard).toMatchObject({
      operation: 'copy', source: { kind: 'library', key: projectInstrumentNodes[0]!.key },
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
      source: { kind: 'buffer', clipboardId: 'instrument-buffer', libraryType: 'instrument' },
    });
    expect(onOrchestraPatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'removeAssignment' }));
  });
});
