// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { LibraryRecoveryPanel } from '../components/libraries/LibraryRecoveryPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('library recovery UI', () => {
  it('offers explicit recovery choices without blocking unrelated project work', () => {
    const onRetry = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<LibraryRecoveryPanel failure={{ kind: 'integrity', message: 'Database is malformed', retryable: true }} onRetry={onRetry} onRestore={vi.fn()} onFresh={vi.fn()} onManualImport={vi.fn()} />));
    expect(container.firstElementChild?.getAttribute('data-library-blocking-only')).toBe('true');
    expect(container.textContent).toContain('Database is malformed');
    expect(container.textContent).toContain('Restore Backup');
    expect(container.textContent).toContain('Create Fresh');
    act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Retry')?.click());
    expect(onRetry).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });
});
