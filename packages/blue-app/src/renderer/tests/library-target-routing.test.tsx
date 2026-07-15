// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryTargetBanner } from '../components/libraries/LibraryTargetBanner';
import { useLibraryStore } from '../stores/library-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('library insertion target routing', () => {
  beforeEach(() => {
    useLibraryStore.getState().reset();
  });

  it('shows a valid destination banner and clears it explicitly', () => {
    const clear = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<LibraryTargetBanner context={{
        selectedType: 'effect',
        target: {
          libraryType: 'effect',
          projectSessionId: 3,
          label: 'Main / pre',
          valid: true,
          targetRevision: '7',
        },
      }} onClear={clear} />);
    });
    expect(container.textContent).toContain('Destination:');
    expect(container.textContent).toContain('Main / pre');
    act(() => { (container.querySelector('button') as HTMLButtonElement).click(); });
    expect(clear).toHaveBeenCalledOnce();
    act(() => { root.unmount(); });
  });

  it('retains an explicit stale destination as disabled guidance', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<LibraryTargetBanner context={{
        selectedType: 'soundObject',
        target: {
          libraryType: 'soundObject',
          projectSessionId: 3,
          label: 'Score / Layer 1',
          valid: false,
          invalidReason: 'The layer was removed.',
          targetRevision: '8',
        },
      }} onClear={vi.fn()} />);
    });
    expect(container.textContent).toContain('The layer was removed');
    act(() => { root.unmount(); });
  });
});
