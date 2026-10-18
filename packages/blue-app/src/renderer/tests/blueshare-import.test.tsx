// @vitest-environment jsdom
import React, { act } from 'react';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { createBlueShareQueryClient } from '../components/blueshare/blueshare-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueShareDialog } from '../components/blueshare/BlueShareDialog';
import BlueShareModal from '../components/blueshare/BlueShareModal';
import { useBlueShare } from '../components/blueshare/use-blueshare';
import type { ResourceSummary, Category } from '../../shared/blueshare';

// Keep Query observer notifications inside React's async act boundary.
notifyManager.setScheduler(queueMicrotask);

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mockCategories: readonly Category[] = [
  { id: 1, kind: 'instrument', parentId: null, name: 'Synthesizers', description: null },
  { id: 2, kind: 'instrument', parentId: null, name: 'Drums', description: null },
];

const mockResources: readonly ResourceSummary[] = [
  {
    kind: 'instrument',
    id: 101,
    name: 'Super Synth',
    description: 'Line 1 of description\nLine 2 of description',
    blueType: 'blue.orchestra.GenericInstrument',
    createdAt: '2026-10-17T12:00:00Z',
    category: { id: 1, name: 'Synthesizers' },
    author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
  },
  {
    kind: 'instrument',
    id: 102,
    name: 'Analog Bass',
    description: 'Punchy bass sound',
    blueType: 'blue.orchestra.GenericInstrument',
    createdAt: '2026-10-17T13:00:00Z',
    category: { id: 1, name: 'Synthesizers' },
    author: { id: 'u2', name: 'Alice', username: 'alice' },
  },
];

describe('BlueShareDialog and useBlueShare (T014)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: ReturnType<typeof createBlueShareQueryClient>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = createBlueShareQueryClient();

    (window as any).blueAPI = {
      openBlueShare: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          contextId: 'ctx-test-1',
          serviceScope: 'https://blue3.kunstmusik.com',
          account: { state: 'signedOut' },
        },
      }),
      closeBlueShare: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      getBlueShareCategories: vi.fn().mockResolvedValue({
        ok: true,
        value: mockCategories,
      }),
      getBlueShareLatest: vi.fn().mockResolvedValue({
        ok: true,
        value: { kind: 'instrument', items: mockResources },
      }),
      listBlueShareResources: vi.fn().mockResolvedValue({
        ok: true,
        value: { kind: 'instrument', items: mockResources, nextBeforeId: 50 },
      }),
      getBlueShareResource: vi.fn().mockResolvedValue({
        ok: true,
        value: mockResources[0],
      }),
      importBlueShareResource: vi.fn().mockResolvedValue({
        ok: true,
        value: { contentRevision: 2, affectedNodes: [] },
      }),
    };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
      queryClient.clear();
    });
    container.remove();
    delete (window as any).blueAPI;
  });

  function TestHarness() {
    const state = useBlueShare();
    return (
      <div>
        <button id="open-btn" onClick={() => void state.open()}>
          Open
        </button>
        <button id="close-btn" onClick={() => state.close()}>
          Close
        </button>
        <BlueShareDialog state={state} />
      </div>
    );
  }

  it('renders three groups × three tabs and switches between them', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    // Verify modal is open with title
    expect(container.textContent).toContain('Blue Share');

    // Groups present
    expect(container.textContent).toContain('Instruments');
    expect(container.textContent).toContain('Effects');
    expect(container.textContent).toContain('SoundObjects');

    // Tabs present
    expect(container.textContent).toContain('Import');
    expect(container.textContent).toContain('Export');
    expect(container.textContent).toContain('Manage');

    // Switch to Export tab
    const exportTab = [...container.querySelectorAll('button[role="tab"]')].find(
      (b) => b.textContent?.trim() === 'Export',
    );
    expect(exportTab).toBeDefined();
    await act(async () => {
      exportTab!.click();
    });
    expect(container.textContent).toContain('Sign in required');
    expect(container.textContent).toContain(
      'Publishing library resources to Blue Share requires a signed-in account',
    );

    // Switch to Manage tab
    const manageTab = [...container.querySelectorAll('button[role="tab"]')].find(
      (b) => b.textContent?.trim() === 'Manage',
    );
    expect(manageTab).toBeDefined();
    await act(async () => {
      manageTab!.click();
    });
    expect(container.textContent).toContain('Sign in to Blue Share');
  });

  it('loads categories and latest list, displays detail on selection, and shows line breaks', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    // Wait for categories and latest to populate
    expect(container.textContent).toContain('Synthesizers');
    expect(container.textContent).toContain('Super Synth');
    expect(container.textContent).toContain('Analog Bass');

    // Initial state on right pane: select a resource
    expect(container.textContent).toContain('Select a resource to view its details');

    // Click on the first resource
    const row = [...container.querySelectorAll('tr')].find((r) =>
      r.textContent?.includes('Super Synth'),
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.click();
    });

    // Details pane should now display author and description with preserved line breaks
    expect(container.textContent).toContain('Submitted by Steven Yi');
    expect(container.textContent).toContain('Line 1 of description\nLine 2 of description');
    const descP = container.querySelector('p.whitespace-pre-wrap');
    expect(descP).not.toBeNull();
    expect(descP?.textContent).toContain('Line 1 of description\nLine 2 of description');
  });

  it('provides Load More only on category pages when nextBeforeId is present', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    // On 'Latest Submissions', no Load More button
    expect(container.querySelector('button')?.textContent).not.toBe('Load More');

    // Switch to a category (e.g. Synthesizers)
    const catBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Synthesizers',
    );
    expect(catBtn).toBeDefined();
    await act(async () => {
      catBtn!.click();
    });

    // Load More should now appear because nextBeforeId: 50
    const loadMoreBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Load More',
    );
    expect(loadMoreBtn).toBeDefined();
  });

  it('disables Import when no selection, enables on selection, and imports with pending state', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    // Import button is disabled initially
    const importBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Import to Library'),
    ) as HTMLButtonElement;
    expect(importBtn).toBeDefined();
    expect(importBtn.disabled).toBe(true);

    // Select a resource
    const row = [...container.querySelectorAll('tr')].find((r) =>
      r.textContent?.includes('Super Synth'),
    );
    await act(async () => {
      row!.click();
    });

    expect(importBtn.disabled).toBe(false);

    // Click Import
    await act(async () => {
      importBtn.click();
    });

    expect(window.blueAPI.importBlueShareResource).toHaveBeenCalledWith(
      'ctx-test-1',
      expect.stringMatching(/^blue-/),
      { kind: 'instrument', id: 101 },
    );
    expect(container.textContent).toContain('Resource successfully imported to your library!');
  });

  it('displays explicit error banner on service failure', async () => {
    (window as any).blueAPI.getBlueShareLatest = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'service_unavailable', message: 'Blue Share network error' },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    expect(container.textContent).toContain('Blue Share network error');
  });

  it('calls closeBlueShare on modal close', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    const closeBtn = container.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    expect(closeBtn).toBeDefined();

    await act(async () => {
      closeBtn.click();
    });

    expect(window.blueAPI.closeBlueShare).toHaveBeenCalledWith('ctx-test-1');
  });

  it('renders nested category tree with hierarchical indentation and preserves sibling ID order', async () => {
    const nestedCategories: readonly Category[] = [
      { id: 20, kind: 'instrument', parentId: null, name: 'Samples', description: null },
      { id: 10, kind: 'instrument', parentId: null, name: 'Synths', description: null },
      { id: 12, kind: 'instrument', parentId: 10, name: 'FM Synths', description: null },
      { id: 11, kind: 'instrument', parentId: 10, name: 'Subtractive Synths', description: null },
      { id: 13, kind: 'instrument', parentId: 11, name: 'Analog Emulation', description: null },
    ];

    (window as any).blueAPI.getBlueShareCategories = vi.fn().mockResolvedValue({
      ok: true,
      value: nestedCategories,
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    expect(container.textContent).not.toContain('Analog Emulation');
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Expand Subtractive Synths"]')
        ?.click(),
    );
    // Verify all categories appear after expanding their parent
    expect(container.textContent).toContain('Synths');
    expect(container.textContent).toContain('Subtractive Synths');
    expect(container.textContent).toContain('Analog Emulation');
    expect(container.textContent).toContain('FM Synths');
    expect(container.textContent).toContain('Samples');

    // Find the category buttons
    const catButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      ['Synths', 'Subtractive Synths', 'Analog Emulation', 'FM Synths', 'Samples'].includes(
        b.textContent?.trim() ?? '',
      ),
    );

    // Verify pre-order ordering with sibling IDs:
    // Root 10 (Synths) -> Child 11 (Subtractive Synths) -> Child 13 (Analog Emulation) -> Child 12 (FM Synths) -> Root 20 (Samples)
    const buttonNames = catButtons.map((b) => b.textContent?.trim());
    expect(buttonNames).toEqual([
      'Synths',
      'Subtractive Synths',
      'Analog Emulation',
      'FM Synths',
      'Samples',
    ]);

    expect(
      catButtons.map((button) => button.closest('[role="treeitem"]')?.getAttribute('aria-level')),
    ).toEqual(['1', '2', '3', '2', '1']);
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Collapse Synths"]')?.click(),
    );
    expect(container.textContent).not.toContain('Subtractive Synths');
    expect(container.textContent).not.toContain('Analog Emulation');
  });

  it('discards delayed detail when kind or category changes before resolution (T061)', async () => {
    let resolveDetail: ((val: any) => void) | null = null;
    (window as any).blueAPI.getBlueShareResource = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveDetail = resolve;
      });
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    // Click on resource 101 to initiate detail request
    const row = [...container.querySelectorAll('tr')].find((r) =>
      r.textContent?.includes('Super Synth'),
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.click();
    });

    // Detail is pending (resolveDetail is set)
    expect(resolveDetail).not.toBeNull();

    // Now switch category to Drums (id: 2)
    const drumsBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Drums',
    );
    expect(drumsBtn).toBeDefined();
    await act(async () => {
      drumsBtn!.click();
    });

    // Now delayed detail resolves for resource 101
    await act(async () => {
      resolveDetail!({
        ok: true,
        value: mockResources[0],
      });
    });

    // The stale detail must NOT render
    expect(container.textContent).not.toContain('Submitted by Steven Yi');
    expect(container.textContent).toContain('Select a resource to view its details');
  });

  it('applies only current completion on rapid category A->B->A switching (T061)', async () => {
    let resolveCat1First: ((val: any) => void) | null = null;
    let resolveCat2: ((val: any) => void) | null = null;
    let callCount = 0;

    (window as any).blueAPI.listBlueShareResources = vi
      .fn()
      .mockImplementation((_ctx, _reqId, _grp, catId) => {
        callCount++;
        if (catId === 1 && callCount === 1) {
          // Cat 1 first request: slow
          return new Promise((resolve) => {
            resolveCat1First = resolve;
          });
        } else if (catId === 2) {
          // Cat 2 request: slow
          return new Promise((resolve) => {
            resolveCat2 = resolve;
          });
        } else if (catId === 1 && callCount >= 3) {
          // Cat 1 final request: fast
          return Promise.resolve({
            ok: true,
            value: {
              kind: 'instrument',
              items: [
                {
                  kind: 'instrument',
                  id: 999,
                  name: 'Final Synth A3',
                  description: 'Final',
                  blueType: 'blue.orchestra.GenericInstrument',
                  createdAt: '2026-10-17T12:00:00Z',
                  category: { id: 1, name: 'Synthesizers' },
                  author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
                },
              ],
              nextBeforeId: null,
            },
          });
        }
        return Promise.resolve({
          ok: true,
          value: { kind: 'instrument', items: [], nextBeforeId: null },
        });
      });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    const synthsBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Synthesizers',
    );
    const drumsBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Drums',
    );

    // 1. Click Synthesizers (Cat 1) -> triggers callCount 1 (delayed)
    await act(async () => {
      synthsBtn!.click();
    });

    // 2. Click Drums (Cat 2) -> triggers callCount 2 (delayed)
    await act(async () => {
      drumsBtn!.click();
    });

    // 3. Click Synthesizers again (Cat 1) -> triggers callCount 3 (resolves with Final Synth A3)
    await act(async () => {
      synthsBtn!.click();
    });

    // UI should already show Final Synth A3
    expect(container.textContent).toContain('Final Synth A3');

    // Now resolve Cat 1 first request with stale item
    await act(async () => {
      resolveCat1First!({
        ok: true,
        value: {
          kind: 'instrument',
          items: [
            {
              kind: 'instrument',
              id: 111,
              name: 'Stale Synth A1',
              description: 'Old',
              blueType: 'blue.orchestra.GenericInstrument',
              createdAt: '2026-10-17T10:00:00Z',
              category: { id: 1, name: 'Synthesizers' },
              author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
            },
          ],
          nextBeforeId: null,
        },
      });
    });

    // Now resolve Cat 2 request with stale item
    await act(async () => {
      resolveCat2!({
        ok: true,
        value: {
          kind: 'instrument',
          items: [
            {
              kind: 'instrument',
              id: 222,
              name: 'Stale Drum B',
              description: 'Old Drum',
              blueType: 'blue.orchestra.GenericInstrument',
              createdAt: '2026-10-17T11:00:00Z',
              category: { id: 2, name: 'Drums' },
              author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
            },
          ],
          nextBeforeId: null,
        },
      });
    });

    // Only Final Synth A3 should be displayed; neither Stale Synth A1 nor Stale Drum B should overwrite
    expect(container.textContent).toContain('Final Synth A3');
    expect(container.textContent).not.toContain('Stale Synth A1');
    expect(container.textContent).not.toContain('Stale Drum B');
  });

  it('reuses current dialog and context on repeated open without duplicate dispatch (T062)', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    expect(window.blueAPI.openBlueShare).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Blue Share');

    // Repeated call while already open
    await act(async () => {
      openBtn.click();
    });

    // Should NOT dispatch another openBlueShare
    expect(window.blueAPI.openBlueShare).toHaveBeenCalledTimes(1);
  });

  it('fences late open result and closes abandoned context if closed before completion (T062)', async () => {
    let resolveOpen: ((val: any) => void) | null = null;
    (window as any).blueAPI.openBlueShare = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveOpen = resolve;
      });
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    const closeBtn = container.querySelector('#close-btn') as HTMLButtonElement;

    // 1. Dispatch open (pending)
    await act(async () => {
      openBtn.click();
    });
    expect(resolveOpen).not.toBeNull();

    // 2. User closes dialog while open is still pending
    await act(async () => {
      closeBtn.click();
    });

    // 3. Late open resolves with context
    await act(async () => {
      resolveOpen!({
        ok: true,
        value: {
          contextId: 'ctx-abandoned-99',
          serviceScope: 'https://blue3.kunstmusik.com',
          account: { state: 'signedOut' },
        },
      });
    });

    // Abandoned context must be immediately closed
    expect(window.blueAPI.closeBlueShare).toHaveBeenCalledWith('ctx-abandoned-99');
    // Dialog must remain closed
    expect(container.textContent).not.toContain('Instruments');
  });

  it('disposes active context on unmount (T062)', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    expect(container.textContent).toContain('Blue Share');

    // Unmount the component tree
    await act(async () => {
      root.unmount();
      queryClient.clear();
    });

    expect(window.blueAPI.closeBlueShare).toHaveBeenCalledWith('ctx-test-1');
  });

  it('resets pending flags and discards late responses on close and reopen during import and detail (T062)', async () => {
    let resolveImport: ((val: any) => void) | null = null;
    (window as any).blueAPI.importBlueShareResource = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveImport = resolve;
      });
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    // Select resource 101
    const row = [...container.querySelectorAll('tr')].find((r) =>
      r.textContent?.includes('Super Synth'),
    );
    await act(async () => {
      row!.click();
    });

    // Click Import
    const importBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Import to Library'),
    );
    await act(async () => {
      importBtn!.click();
    });

    expect(resolveImport).not.toBeNull();
    // Modal header close
    const modalCloseBtn = container.querySelector(
      'button[aria-label="Close"]',
    ) as HTMLButtonElement;
    await act(async () => {
      modalCloseBtn.click();
    });

    // Reopen dialog
    await act(async () => {
      openBtn.click();
    });

    // Late import resolves
    await act(async () => {
      resolveImport!({
        ok: true,
        value: { contentRevision: 5, affectedNodes: [] },
      });
    });

    // Stale import receipt must NOT render
    expect(container.textContent).not.toContain('Resource successfully imported to your library!');
  });

  it('renders category error with retry button and avoids empty state text on failure (T068)', async () => {
    (window as any).blueAPI.getBlueShareCategories = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'service_error', message: 'Network error fetching categories', status: 503 },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: mockCategories,
      });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    expect(container.textContent).toContain('Network error fetching categories');
    expect(container.textContent).not.toContain('No categories available.');

    // Click Retry
    const retryBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Retry',
    );
    expect(retryBtn).toBeDefined();
    await act(async () => {
      retryBtn!.click();
    });

    expect(window.blueAPI.getBlueShareCategories).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Synthesizers');
    expect(container.textContent).not.toContain('Network error fetching categories');
  });

  it('renders resource list error with retry button and avoids empty state text on failure (T068)', async () => {
    (window as any).blueAPI.getBlueShareLatest = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'service_error', message: 'Failed to load submissions', status: 500 },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { kind: 'instrument', items: mockResources },
      });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    expect(container.textContent).toContain('Failed to load submissions');
    expect(container.textContent).not.toContain('No resources found in this category.');

    // Click Retry
    const retryBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Retry',
    );
    expect(retryBtn).toBeDefined();
    await act(async () => {
      retryBtn!.click();
    });

    expect(window.blueAPI.getBlueShareLatest).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Super Synth');
    expect(container.textContent).not.toContain('Failed to load submissions');
  });

  it('preserves existing results and displays error banner with retry on failed refresh (T068)', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    // Both categories and items loaded
    expect(container.textContent).toContain('Super Synth');
    expect(container.textContent).toContain('Synthesizers');

    // Make next latest call fail
    (window as any).blueAPI.getBlueShareLatest = vi.fn().mockResolvedValueOnce({
      ok: false,
      error: { code: 'service_error', message: 'Refresh timed out', status: 504 },
    });

    // Re-click Latest Submissions to trigger refresh
    const latestBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Latest Submissions'),
    );
    await act(async () => {
      latestBtn!.click();
    });

    // Old results still in DOM
    expect(container.textContent).toContain('Super Synth');
    // Error banner shown
    expect(container.textContent).toContain('Refresh timed out');
    const retryBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Retry',
    );
    expect(retryBtn).toBeDefined();
  });

  it('handles 404, 409, 410, 429, 503 detail error states and disables import (T068)', async () => {
    const errorCases = [
      {
        status: 404,
        error: { code: 'service_error', message: 'Resource missing', status: 404 },
        expectedTitle: 'Resource Not Found (404)',
        expectedText: 'This resource may have been removed or does not exist.',
      },
      {
        status: 410,
        error: { code: 'service_error', message: 'Resource gone', status: 410 },
        expectedTitle: 'Resource Permanently Removed (410)',
        expectedText: 'Resource has been permanently removed (410).',
      },
      {
        status: 429,
        error: {
          code: 'service_error',
          message: 'Rate limited',
          status: 429,
          retryAfterSeconds: 45,
        },
        expectedTitle: 'Rate Limit Exceeded (429)',
        expectedText: 'Rate limit exceeded (429). Please retry after 45 seconds.',
      },
      {
        status: 503,
        error: { code: 'service_error', message: 'Backend down', status: 503 },
        expectedTitle: 'Service Unavailable (503)',
        expectedText: 'Service temporarily unavailable (503). Please retry later.',
      },
      {
        status: 409,
        error: { code: 'service_error', message: 'Resource conflict', status: 409 },
        expectedTitle: 'Conflict Encountered (409)',
        expectedText:
          'Conflict encountered (409). The resource may have been modified or superseded.',
      },
    ];

    for (const testCase of errorCases) {
      (window as any).blueAPI.getBlueShareResource = vi.fn().mockResolvedValueOnce({
        ok: false,
        error: testCase.error,
      });

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <TestHarness />
          </QueryClientProvider>,
        );
      });
      const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
      await act(async () => {
        openBtn.click();
      });

      const row = [...container.querySelectorAll('tr')].find((r) =>
        r.textContent?.includes('Super Synth'),
      );
      await act(async () => {
        row!.click();
      });

      expect(container.textContent).toContain(testCase.expectedTitle);
      expect(container.textContent).toContain(testCase.expectedText);
      expect(container.textContent).not.toContain('Select a resource to view its details.');

      // Import button must be disabled
      const importBtn = [...container.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Import to Library'),
      ) as HTMLButtonElement;
      expect(importBtn).toBeDefined();
      expect(importBtn.disabled).toBe(true);

      // Close and clean up for next case
      const closeBtn = container.querySelector('#close-btn') as HTMLButtonElement;
      await act(async () => {
        closeBtn.click();
      });
    }
  });

  it('renders bounded resource diagnostics with severity, path, member, message, recovery (T068)', async () => {
    const diagnostics = [
      {
        code: 'xml_invalid_syntax',
        severity: 'error' as const,
        path: '/instrument/opcode',
        member: 'opcodeName',
        message: 'Unknown opcode in instrument definition',
        recovery: 'Update opcode syntax to modern form',
      },
      {
        code: 'deprecated_attribute',
        severity: 'warning' as const,
        path: '/instrument',
        member: 'legacyFlag',
        message: 'Attribute is deprecated',
        recovery: 'Remove legacyFlag',
      },
      {
        code: 'diag_3',
        severity: 'error' as const,
        message: 'Diagnostic 3',
      },
      {
        code: 'diag_4',
        severity: 'warning' as const,
        message: 'Diagnostic 4',
      },
      {
        code: 'diag_5',
        severity: 'error' as const,
        message: 'Diagnostic 5',
      },
      {
        code: 'diag_6_overflow',
        severity: 'error' as const,
        message: 'Diagnostic 6 should be truncated',
      },
    ];

    (window as any).blueAPI.getBlueShareResource = vi.fn().mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'invalid_xml',
        message: 'Resource payload validation failed',
        status: 422,
        diagnostics: diagnostics.map((d) => ({
          source: { kind: 'instrument', label: 'Synthetic instrument' },
          path: '/instrument',
          recovery: 'Import rejected',
          ...d,
        })),
      },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    const row = [...container.querySelectorAll('tr')].find((r) =>
      r.textContent?.includes('Super Synth'),
    );
    await act(async () => {
      row!.click();
    });

    // Diagnostics header
    expect(container.textContent).toContain('Diagnostics:');
    // First diagnostic fields
    expect(container.textContent).toContain('[ERROR]');
    expect(container.textContent).toContain('/instrument/opcode');
    expect(container.textContent).toContain('(opcodeName)');
    expect(container.textContent).toContain('Unknown opcode in instrument definition');
    expect(container.textContent).toContain('Recovery: Update opcode syntax to modern form');

    // Warning diagnostic
    expect(container.textContent).toContain('[WARNING]');
    expect(container.textContent).toContain('Attribute is deprecated');

    // Bounded to 5 items with overflow text
    expect(container.textContent).toContain('…and 1 more diagnostic(s)');
    expect(container.textContent).not.toContain('Diagnostic 6 should be truncated');
  });

  it('retries resource detail fetch on clicking retry in detail pane (T068)', async () => {
    (window as any).blueAPI.getBlueShareResource = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'service_error', message: 'Server hiccup', status: 500 },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: mockResources[0],
      });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    const row = [...container.querySelectorAll('tr')].find((r) =>
      r.textContent?.includes('Super Synth'),
    );
    await act(async () => {
      row!.click();
    });

    expect(container.textContent).toContain('Resource Unavailable');

    // Find and click Retry button in detail pane
    const retryBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Retry',
    );
    expect(retryBtn).toBeDefined();
    await act(async () => {
      retryBtn!.click();
    });

    expect(window.blueAPI.getBlueShareResource).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Super Synth');
    expect(container.textContent).toContain('Steven Yi');
  });

  it('supports full keyboard operation for browse -> details -> import (T069)', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    // 1. Kind navigation with keyboard
    const effectKindBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Effects',
    );
    expect(effectKindBtn).toBeDefined();
    await act(async () => {
      effectKindBtn!.focus();
      effectKindBtn!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      effectKindBtn!.click();
    });
    expect(window.blueAPI.getBlueShareLatest).toHaveBeenCalledWith(
      'ctx-test-1',
      expect.any(String),
      'effect',
    );

    // Switch back to instruments
    const instKindBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Instruments',
    );
    await act(async () => {
      instKindBtn!.focus();
      instKindBtn!.click();
    });

    // 2. Select resource row using keyboard (Enter key)
    const row = [...container.querySelectorAll('tr')].find((r) =>
      r.textContent?.includes('Super Synth'),
    );
    expect(row).toBeDefined();
    expect(row!.getAttribute('tabIndex')).toBe('0');
    expect(row!.getAttribute('role')).toBe('button');
    expect(row!.getAttribute('aria-label')).toBe('Select Super Synth');
    expect(row!.getAttribute('aria-selected')).toBe('false');

    await act(async () => {
      row!.focus();
      row!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(row!.getAttribute('aria-selected')).toBe('true');
    expect(window.blueAPI.getBlueShareResource).toHaveBeenCalledWith(
      'ctx-test-1',
      expect.any(String),
      expect.objectContaining({ kind: 'instrument', id: 101 }),
    );
    expect(container.textContent).toContain('Super Synth');

    // 3. Tab to Import button and trigger with keyboard
    const importBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Import to Library',
    );
    expect(importBtn).toBeDefined();
    expect(importBtn!.disabled).toBe(false);

    await act(async () => {
      importBtn!.focus();
      importBtn!.click();
    });

    expect(window.blueAPI.importBlueShareResource).toHaveBeenCalled();
    const statusReceipt = container.querySelector('[role="status"]');
    expect(statusReceipt).toBeDefined();
    expect(statusReceipt?.textContent).toContain('Resource successfully imported');
  });

  it('dismisses dialog on Escape key following dialog conventions (T069)', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    // Press Escape
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
