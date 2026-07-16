// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { LibraryMigrationNotice } from '../components/libraries/LibraryMigrationNotice';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('library migration summary', () => {
  it('renders a dismissible non-blocking notice with report access', () => {
    const onHistory = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<LibraryMigrationNotice summary={{
      batchId: 'batch-1', status: 'partial', message: 'Some sources imported.',
      startedAt: '2026-07-15T00:00:00Z', completedAt: '2026-07-15T00:00:01Z',
      sources: [
        { libraryType: 'instrument', sourcePath: '/home/user/.blue/userInstrumentLibrary.xml', status: 'imported', folderCount: 2, itemCount: 5, unsupportedCount: 1, backupAvailable: false },
        { libraryType: 'udo', sourcePath: '/home/user/.blue/udoLibrary.xml', status: 'failed', folderCount: 0, itemCount: 0, unsupportedCount: 0, error: 'Malformed XML', backupAvailable: true },
      ],
    }} onReport={onHistory} onDismiss={vi.fn()} />));
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Some sources imported');
    expect(container.querySelector('[role="status"]')?.className).toContain('absolute');
    act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Report')?.click());
    expect(onHistory).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });
});
