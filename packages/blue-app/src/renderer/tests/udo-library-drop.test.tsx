// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UdoTable from '../components/workbench/panels/udo/UdoTable';
import { useLibraryStore } from '../stores/library-store';
import { BLUE_LIBRARY_DRAG_MIME } from '../components/libraries/library-drag-drop';
import { createTestDataTransfer, dispatchDragEvent } from './library-interaction-test-helpers';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const previewLibraryTransfer = vi.fn(async (request) => ({
  ok: true as const,
  value: {
    previewToken: 'udo-preview',
    item: {
      key: { scope: 'user' as const, libraryType: 'udo' as const, nodeId: 'udo-source' },
      displayName: 'tone', libraryType: 'udo' as const, scope: 'user' as const,
      objectType: 'OpcodeDefinition', supportStatus: 'supported' as const, supportMessage: null,
      fields: {}, dependencies: { itemOwned: [], unresolvedExternal: [] },
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
  value: { projectSessionId: 2, projectRevision: 6, libraryType: 'udo' as const, insertedIdentity: 'hash', message: 'UDO added.' },
}));
const captureSelection = vi.fn();
const projectNode = {
  key: {
    scope: 'projectOwned' as const,
    libraryType: 'udo' as const,
    projectSessionId: 2,
    locator: {
      kind: 'udo' as const,
      sessionObjectId: 'udo:0',
      persistedFingerprint: { canonicalHash: 'udo-hash', opcodeName: 'tone', style: 'CLASSIC' as const },
    },
  },
  nodeId: 'project-udo-0', parentId: 'project-udos', libraryType: 'udo' as const,
  scope: 'projectOwned' as const, nodeKind: 'item' as const, displayName: 'tone',
  breadcrumb: ['Project UDOs', 'tone'], revision: 'udo-hash', hasChildren: false,
};
const embeddedProjectNode = {
  ...projectNode,
  nodeId: 'instrument-7-udo-0',
  breadcrumb: ['Project Orchestra', '7 Project Pad', 'UDOs', 'tone'],
  key: {
    ...projectNode.key,
    locator: {
      ...projectNode.key.locator,
      instrumentAssignmentId: '7',
      sessionObjectId: 'instrument:7:udo:0',
    },
  },
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  previewLibraryTransfer.mockClear();
  applyLibraryTransfer.mockClear();
  captureSelection.mockClear();
  window.blueAPI = { ...window.blueAPI, previewLibraryTransfer, applyLibraryTransfer };
  useLibraryStore.setState({
    clipboard: { operation: 'copy', source: { kind: 'userNode', libraryType: 'udo', nodeId: 'udo-source', revision: 3 }, capturedAt: 1 },
    transferPreview: null,
    transferSource: null,
    error: null,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <UdoTable
        udolist={[
          { name: 'tone', style: 'CLASSIC', outTypes: 'a', inTypes: 'a', inputArguments: '', code: 'aout = ain', comments: '' },
          { name: 'tone', style: 'MODERN', outTypes: 'a', inTypes: '', inputArguments: 'ain:a', code: 'return ain', comments: '' },
        ]}
        selectedIndices={[0]}
        onSelectIndex={vi.fn()}
        onContextSelectIndex={vi.fn()}
        onAddUdo={vi.fn()}
        onImportBlueUdo={vi.fn()}
        onImportCsoundUdo={vi.fn()}
        onRemoveSelection={vi.fn()}
        onCopySelection={captureSelection}
        onExportBlueUdo={vi.fn()}
        onExportCsoundUdo={vi.fn()}
        onMoveSelectionUp={vi.fn()}
        onMoveSelectionDown={vi.fn()}
        projectNodes={[projectNode]}
        libraryDropTarget={{ projectSessionId: 2, projectRevision: 5 }}
      />,
    );
  });
});

afterEach(() => {
  act(() => { root.unmount(); });
  document.body.replaceChildren();
});

describe('project UDO Library drop targets', () => {
  it('keeps same-name rows and exposes exact row/end Paste positions', async () => {
    expect(container.textContent?.match(/tone/g)).toHaveLength(2);
    const markers = container.querySelectorAll('[aria-label*="Insert UDO"]');
    expect(markers).toHaveLength(3);
    await act(async () => {
      markers[1]!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'v', metaKey: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(previewLibraryTransfer).toHaveBeenCalledWith(expect.objectContaining({
      target: { kind: 'projectUdo', projectSessionId: 2, projectRevision: 5, insertIndex: 1 },
    }));
    expect(applyLibraryTransfer).toHaveBeenCalledWith('udo-preview');
  });

  it('accepts direct row drop and Library paste from the UDO row menu', async () => {
    const row = container.querySelector('[data-library-drop-target="udo-row"]') as HTMLElement;
    const transfer = createTestDataTransfer();
    transfer.setData(BLUE_LIBRARY_DRAG_MIME, JSON.stringify({
      dragSessionId: 'drag-udo', libraryType: 'udo',
    }));
    dispatchDragEvent(row, 'dragover', transfer);
    dispatchDragEvent(row, 'drop', transfer);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(previewLibraryTransfer).toHaveBeenLastCalledWith(expect.objectContaining({
      source: { kind: 'drag', dragSessionId: 'drag-udo' },
      target: { kind: 'projectUdo', projectSessionId: 2, projectRevision: 5, insertIndex: 1 },
    }));

    previewLibraryTransfer.mockClear();
    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    const paste = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((item) => item.textContent === 'Paste') as HTMLElement;
    expect(paste?.getAttribute('aria-disabled')).not.toBe('true');
    expect(document.body.textContent).not.toContain('Paste Library UDO');
    act(() => paste.click());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(previewLibraryTransfer).toHaveBeenCalledWith(expect.objectContaining({
      source: expect.objectContaining({ kind: 'clipboard' }),
      target: { kind: 'projectUdo', projectSessionId: 2, projectRevision: 5, insertIndex: 1 },
    }));
  });

  it('captures project UDO Copy and Cut in the shared Library buffer', async () => {
    const row = container.querySelector('[data-library-drop-target="udo-row"]') as HTMLElement;
    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    expect(document.body.textContent).not.toContain('Copy to User Library');
    const copy = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((candidate) => candidate.textContent === 'Copy') as HTMLElement;
    act(() => copy.click());
    expect(captureSelection).toHaveBeenCalledWith('copy');

    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    const cut = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((candidate) => candidate.textContent === 'Cut') as HTMLElement;
    act(() => cut.click());
    expect(captureSelection).toHaveBeenCalledWith('cut');
  });

  it('keeps the UDO table and its insertion target visible when empty', () => {
    act(() => {
      root.render(
        <UdoTable
          udolist={[]}
          selectedIndices={[]}
          onSelectIndex={vi.fn()}
          onContextSelectIndex={vi.fn()}
          onAddUdo={vi.fn()}
          onImportBlueUdo={vi.fn()}
          onImportCsoundUdo={vi.fn()}
          onRemoveSelection={vi.fn()}
          onCopySelection={captureSelection}
          onExportBlueUdo={vi.fn()}
          onExportCsoundUdo={vi.fn()}
          onMoveSelectionUp={vi.fn()}
          onMoveSelectionDown={vi.fn()}
          libraryDropTarget={{ projectSessionId: 2, projectRevision: 5 }}
        />,
      );
    });
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('th')?.textContent).toBe('Name');
    const emptyRemainder = container.querySelector(
      '[aria-label="Insert UDO at end; paste a Library item here"]',
    ) as HTMLElement;
    expect(emptyRemainder).not.toBeNull();
    expect(emptyRemainder.closest('[data-library-list-end-drop-target]')).not.toBeNull();
    expect(emptyRemainder.className).toContain('flex-1');
  });

  it('uses the blank space below UDO rows as the exact end-drop target', async () => {
    const emptyRemainder = container.querySelector(
      '[aria-label="Insert UDO at end; paste a Library item here"]',
    ) as HTMLElement;
    const transfer = createTestDataTransfer();
    transfer.setData(BLUE_LIBRARY_DRAG_MIME, JSON.stringify({
      dragSessionId: 'drag-udo-remainder', libraryType: 'udo',
    }));

    dispatchDragEvent(emptyRemainder, 'dragover', transfer);
    expect(emptyRemainder.className).toContain('ring-app-accent');
    dispatchDragEvent(emptyRemainder, 'drop', transfer);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(previewLibraryTransfer).toHaveBeenCalledWith(expect.objectContaining({
      source: { kind: 'drag', dragSessionId: 'drag-udo-remainder' },
      target: {
        kind: 'projectUdo', projectSessionId: 2, projectRevision: 5, insertIndex: 2,
      },
    }));
  });

  it('uses the shared transfer buffer and exact Instrument UDO destination', async () => {
    act(() => {
      root.render(
        <UdoTable
          udolist={[
            { name: 'tone', style: 'CLASSIC', outTypes: 'a', inTypes: 'a', inputArguments: '', code: 'aout = ain', comments: '' },
          ]}
          selectedIndices={[0]}
          onSelectIndex={vi.fn()}
          onContextSelectIndex={vi.fn()}
          onAddUdo={vi.fn()}
          onImportBlueUdo={vi.fn()}
          onImportCsoundUdo={vi.fn()}
          onRemoveSelection={vi.fn()}
          onCopySelection={captureSelection}
          onExportBlueUdo={vi.fn()}
          onExportCsoundUdo={vi.fn()}
          onMoveSelectionUp={vi.fn()}
          onMoveSelectionDown={vi.fn()}
          projectNodes={[embeddedProjectNode]}
          libraryDropTarget={{
            projectSessionId: 2,
            projectRevision: 5,
            instrumentAssignmentId: '7',
          }}
        />,
      );
    });

    const marker = container.querySelector('[aria-label^="Insert UDO before"]') as HTMLElement;
    await act(async () => {
      marker.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'v',
        metaKey: true,
      }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(previewLibraryTransfer).toHaveBeenCalledWith(expect.objectContaining({
      target: {
        kind: 'projectUdo',
        projectSessionId: 2,
        projectRevision: 5,
        instrumentAssignmentId: '7',
        insertIndex: 0,
      },
    }));

    const row = container.querySelector('[data-library-drop-target="udo-row"]') as HTMLElement;
    act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    const copy = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((candidate) => candidate.textContent === 'Copy') as HTMLElement;
    const cut = [...document.body.querySelectorAll('[role="menuitem"]')]
      .find((candidate) => candidate.textContent === 'Cut') as HTMLElement;
    expect(copy.getAttribute('aria-disabled')).not.toBe('true');
    expect(cut.getAttribute('aria-disabled')).not.toBe('true');
    act(() => copy.click());
    expect(captureSelection).toHaveBeenCalledWith('copy');
  });
});
