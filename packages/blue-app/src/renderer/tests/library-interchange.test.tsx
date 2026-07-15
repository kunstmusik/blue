// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { LibraryActionsMenu } from '../components/libraries/LibraryActionsMenu';
import { LibraryImportDialog } from '../components/libraries/LibraryImportDialog';
import { LibraryHistoryPanel } from '../components/libraries/LibraryHistoryPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('library interchange UI', () => {
  it('offers import, Export Current/All, preview warnings, and undo history', () => {
    const actions = { onImport: vi.fn(), onExportCurrent: vi.fn(), onExportAll: vi.fn(), onHistory: vi.fn() };
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<>
      <LibraryActionsMenu selectedType="udo" {...actions} />
      <LibraryImportDialog preview={{ previewToken: 'p', expiresAt: Date.now() + 1000, sources: [{
        sourcePath: '/tmp/udoLibrary.xml', sourceHash: 'hash', libraryType: 'udo', folderCount: 1,
        itemCount: 2, unsupportedCount: 1, exactDuplicateCount: 1, aliasConflictCount: 1,
        ambiguousFolderCount: 0,
      }] }} onImport={vi.fn()} onCancel={vi.fn()} />
      <LibraryHistoryPanel entries={[{
        id: 'batch', mode: 'manualXmlFiles', status: 'completed', startedAt: 'today',
        completedAt: 'today', sourceCount: 1, counts: { createdNodeCount: 2 }, report: {},
      }]} onUndo={vi.fn()} onClose={vi.fn()} />
    </>));
    expect(container.textContent).toContain('Export Current');
    expect(container.textContent).toContain('2 items');
    expect(container.textContent).toContain('1 exact duplicate');
    expect(container.textContent).toContain('Undo Import');
    act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Export All')?.click());
    expect(actions.onExportAll).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });
});
