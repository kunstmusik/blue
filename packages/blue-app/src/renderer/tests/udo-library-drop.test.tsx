// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UdoTable from '../components/workbench/panels/udo/UdoTable';
import { useLibraryStore } from '../stores/library-store';

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

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  previewLibraryTransfer.mockClear();
  applyLibraryTransfer.mockClear();
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
        selectedIndices={[]}
        onSelectIndex={vi.fn()}
        onContextSelectIndex={vi.fn()}
        onAddUdo={vi.fn()}
        onImportBlueUdo={vi.fn()}
        onImportCsoundUdo={vi.fn()}
        onRemoveSelection={vi.fn()}
        onCopySelection={vi.fn()}
        onCutSelection={vi.fn()}
        onPasteSelection={vi.fn()}
        onExportBlueUdo={vi.fn()}
        onExportCsoundUdo={vi.fn()}
        onMoveSelectionUp={vi.fn()}
        onMoveSelectionDown={vi.fn()}
        canPaste={false}
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
});
