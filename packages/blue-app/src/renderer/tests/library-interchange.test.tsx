// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { LibraryActionsMenu } from '../components/libraries/LibraryActionsMenu';
import { LibraryImportDialog } from '../components/libraries/LibraryImportDialog';
import { chooseAppSelectOption } from './app-select-test-utils';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('library interchange UI', () => {
  it('offers import and Export Current/All without migration or history commands', () => {
    const actions = {
      onImport: vi.fn(),
      onImportDirectory: vi.fn(),
      onExportCurrent: vi.fn(),
      onExportAll: vi.fn(),
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <>
          <LibraryActionsMenu selectedType="udo" {...actions} />
          <LibraryImportDialog
            preview={{
              previewToken: 'p',
              expiresAt: Date.now() + 1000,
              sources: [
                {
                  sourcePath: '/tmp/udoLibrary.xml',
                  sourceHash: 'hash',
                  libraryType: 'udo',
                  folderCount: 1,
                  itemCount: 2,
                  unsupportedCount: 1,
                  exactDuplicateCount: 1,
                  aliasConflictCount: 1,
                  ambiguousFolderCount: 0,
                  folderConflicts: [],
                },
              ],
            }}
            onImport={vi.fn()}
            onCancel={vi.fn()}
          />
        </>,
      ),
    );
    expect(container.textContent).toContain('2 items');
    expect(container.textContent).toContain('1 exact duplicate');
    act(() =>
      (
        container.querySelector('button[aria-label="Library actions"]') as HTMLButtonElement
      ).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })),
    );
    expect(document.body.textContent).toContain('Export Current');
    expect(document.body.textContent).toContain('Import Java Configuration Directory');
    expect(document.body.textContent).not.toContain('Import History');
    expect(document.body.textContent).not.toContain('Migration Report');
    act(() =>
      [...document.body.querySelectorAll('[role="menuitem"]')]
        .find((item) => item.textContent?.startsWith('Export All'))
        ?.dispatchEvent(new Event('click', { bubbles: true })),
    );
    expect(actions.onExportAll).toHaveBeenCalledOnce();
    act(() => root.unmount());
    container.remove();
  });

  it('keeps import blocked until every ambiguous folder has an explicit destination', async () => {
    const onImport = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <LibraryImportDialog
          preview={{
            previewToken: 'p',
            expiresAt: Date.now() + 1000,
            sources: [
              {
                sourcePath: '/tmp/udoLibrary.xml',
                sourceHash: 'hash',
                libraryType: 'udo',
                folderCount: 1,
                itemCount: 1,
                unsupportedCount: 0,
                exactDuplicateCount: 0,
                aliasConflictCount: 0,
                ambiguousFolderCount: 1,
                folderConflicts: [
                  {
                    conflictId: 'hash:0',
                    sourceBreadcrumb: ['UDO Library', 'Shared'],
                    candidates: [
                      { nodeId: 'folder-a', breadcrumb: ['UDO Library', 'A', 'Shared'] },
                      { nodeId: 'folder-b', breadcrumb: ['UDO Library', 'B', 'Shared'] },
                    ],
                  },
                ],
              },
            ],
          }}
          onImport={onImport}
          onCancel={vi.fn()}
        />,
      ),
    );
    const importButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Import',
    )!;
    expect(importButton.disabled).toBe(true);
    const select = container.querySelector<HTMLElement>('[role="combobox"]')!;
    await chooseAppSelectOption(select, 'UDO Library / B / Shared');
    expect(importButton.disabled).toBe(false);
    act(() => importButton.click());
    expect(onImport).toHaveBeenCalledWith({ 'hash:0': 'folder-b' });
    act(() => root.unmount());
    container.remove();
  });
});
