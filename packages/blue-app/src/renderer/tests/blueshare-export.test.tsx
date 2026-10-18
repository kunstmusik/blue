// @vitest-environment jsdom
import React, { act } from 'react';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { createBlueShareQueryClient } from '../components/blueshare/blueshare-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueShareDialog } from '../components/blueshare/BlueShareDialog';
import { useBlueShare } from '../components/blueshare/use-blueshare';
import type {
  AccountSessionSnapshot,
  Category,
  PublishSourceSeed,
  ResourceSummary,
} from '../../shared/blueshare';
import type { LibraryBrowseNode } from '../../shared/unified-library';

// Keep Query observer notifications inside React's async act boundary.
notifyManager.setScheduler(queueMicrotask);

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mockCategories: readonly Category[] = [
  { id: 10, kind: 'instrument', parentId: null, name: 'Synthesizers', description: 'Synths' },
  {
    id: 11,
    kind: 'instrument',
    parentId: 10,
    name: 'Subtractive',
    description: 'Subtractive synths',
  },
];

const mockUserLibraryItems: readonly LibraryBrowseNode[] = [
  {
    key: { scope: 'user', libraryType: 'instrument', nodeId: 'item-synth-1' },
    nodeId: 'item-synth-1',
    parentId: null,
    libraryType: 'instrument',
    scope: 'user',
    nodeKind: 'item',
    displayName: 'Lead Synth',
    breadcrumb: ['User Instruments', 'Lead Synth'],
    revision: 3,
    hasChildren: false,
    supportStatus: 'supported',
    objectType: 'blue.orchestra.GenericInstrument',
  },
  {
    key: { scope: 'user', libraryType: 'instrument', nodeId: 'item-synth-2' },
    nodeId: 'item-synth-2',
    parentId: null,
    libraryType: 'instrument',
    scope: 'user',
    nodeKind: 'item',
    displayName: 'Bass Synth',
    breadcrumb: ['User Instruments', 'Bass Synth'],
    revision: 1,
    hasChildren: false,
    supportStatus: 'supported',
    objectType: 'blue.orchestra.GenericInstrument',
  },
];

const mockSourceSeed: PublishSourceSeed = {
  sourceToken: 'token-prep-123',
  kind: 'instrument',
  name: 'Lead Synth',
  blueType: 'blue.orchestra.GenericInstrument',
  descriptionSeed: 'Original comment from synth',
  byteLength: 450,
};

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

function setSelectValue(tree: HTMLElement, value: string) {
  tree
    .querySelector<HTMLButtonElement>(`[data-library-node-id$="-${value}"] > button:last-child`)
    ?.click();
}

describe('BlueShare Export UI & Recovery (T033)', () => {
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
          contextId: 'ctx-test-export',
          serviceScope: 'https://blue3.kunstmusik.com',
          account: {
            state: 'signedIn',
            user: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
            expiresAt: '2026-10-18T14:00:00Z',
            accountEpoch: 1,
          },
        },
      }),
      closeBlueShare: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      getBlueShareAccount: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          state: 'signedIn',
          user: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
          expiresAt: '2026-10-18T14:00:00Z',
          accountEpoch: 1,
        },
      }),
      getBlueShareCategories: vi.fn().mockResolvedValue({
        ok: true,
        value: mockCategories,
      }),
      getBlueShareLatest: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      listBlueShareResources: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      listBlueShareMine: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { items: [], nextBeforeId: null } }),
      browseLibraries: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          parent: { scope: 'user', libraryType: 'instrument', nodeId: 'root' },
          children: mockUserLibraryItems,
          contentRevision: 5,
        },
      }),
      prepareBlueSharePublish: vi.fn().mockResolvedValue({
        ok: true,
        value: mockSourceSeed,
      }),
      publishBlueShareResource: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          kind: 'instrument',
          id: 301,
          name: 'Lead Synth',
          description: 'Published description',
          blueType: 'blue.orchestra.GenericInstrument',
          createdAt: '2026-10-17T16:00:00Z',
          category: { id: 10, name: 'Synthesizers' },
          author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
        },
      }),
      onBlueShareAccountChanged: vi.fn().mockReturnValue(() => {}),
    };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
      queryClient.clear();
    });
    container.remove();
  });

  function TestHarness() {
    const blueshare = useBlueShare();
    return (
      <div>
        <button id="open-btn" onClick={() => void blueshare.open()}>
          Open
        </button>
        <BlueShareDialog state={blueshare} />
      </div>
    );
  }

  it('preserves local folders and uses the shared read-only tree to select nested sources', async () => {
    const libraryRoot = {
      ...mockUserLibraryItems[0],
      nodeId: 'root',
      parentId: null,
      key: undefined,
      nodeKind: 'root',
      displayName: 'Instrument Library',
      hasChildren: true,
    };
    const folder = {
      ...libraryRoot,
      nodeId: 'synths',
      parentId: 'root',
      nodeKind: 'folder',
      displayName: 'Synths',
    };
    const item = { ...mockUserLibraryItems[0], parentId: 'synths' };
    (window as any).blueAPI.browseLibraries.mockImplementation(async ({ parent }: any) => ({
      ok: true,
      value: {
        parent: parent.nodeId === 'synths' ? folder : libraryRoot,
        children: parent.nodeId === 'synths' ? [item] : [folder],
        contentRevision: 5,
      },
    }));
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      ),
    );
    await act(async () => container.querySelector<HTMLButtonElement>('#open-btn')?.click());
    await act(async () =>
      Array.from(container.querySelectorAll('button'))
        .find((b) => b.textContent === 'Export')
        ?.click(),
    );
    const tree = container.querySelector('[aria-label="Your library"]')!;
    expect(tree.textContent).toContain('Instrument Library');
    expect(tree.textContent).toContain('Synths');
    expect(tree.textContent).not.toContain('Lead Synth');
    await act(async () =>
      tree.querySelector<HTMLButtonElement>('[aria-label="Expand Synths"]')?.click(),
    );
    const row = tree.querySelector('[data-library-node-id="item-synth-1"]')!;
    expect(row.getAttribute('aria-level')).toBe('3');
    expect(row.getAttribute('draggable')).toBe('false');
    await act(async () => row.querySelector<HTMLButtonElement>('button')?.click());
    expect((window as any).blueAPI.prepareBlueSharePublish).toHaveBeenCalledWith(
      'ctx-test-export',
      expect.any(String),
      item.key,
      item.revision,
    );
    await act(async () =>
      tree.querySelector<HTMLButtonElement>('[aria-label="Collapse Synths"]')?.click(),
    );
    expect(tree.textContent).not.toContain('Lead Synth');
  });

  it('requires sign-in to export when signed out', async () => {
    (window as any).blueAPI.openBlueShare.mockResolvedValueOnce({
      ok: true,
      value: {
        contextId: 'ctx-test-export-anon',
        serviceScope: 'https://blue3.kunstmusik.com',
        account: { state: 'signedOut', user: null, expiresAt: null, accountEpoch: 1 },
      },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    expect(exportTabBtn).toBeDefined();

    await act(async () => {
      exportTabBtn?.click();
    });

    expect(container.textContent).toContain('Sign in required');
  });

  it('lists matching user-library items and prepares source token on selection', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // Library items should be listed
    expect(container.textContent).toContain('Lead Synth');
    expect(container.textContent).toContain('Bass Synth');

    // Select Lead Synth
    const leadItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Lead Synth'),
    );
    expect(leadItem).toBeDefined();

    await act(async () => {
      leadItem?.click();
    });

    expect((window as any).blueAPI.prepareBlueSharePublish).toHaveBeenCalledWith(
      'ctx-test-export',
      expect.any(String),
      { scope: 'user', libraryType: 'instrument', nodeId: 'item-synth-1' },
      3,
    );

    // Description textarea should be seeded from source comment
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('Original comment from synth');
    expect(container.querySelector('[aria-label="Source comments"]')?.textContent).toContain(
      'Original comment from synth',
    );

    await act(async () => setTextareaValue(textarea, 'Edited public description'));
    expect(textarea.value).toBe('Edited public description');
    expect(container.querySelector('[aria-label="Source comments"]')?.textContent).toContain(
      'Original comment from synth',
    );

    // Resource name and type are displayed
    expect(container.textContent).toContain('Lead Synth');
    expect(container.textContent).toContain('blue.orchestra.GenericInstrument');
  });

  it('only offers real remote categories in the category selector (excludes synthetic root / latest)', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    const select = container.querySelector('[aria-label="Destination categories"]') as HTMLElement;
    expect(select).not.toBeNull();

    const optionValues = Array.from(select.querySelectorAll('[role=treeitem]')).map((node) =>
      node.getAttribute('data-library-node-id')?.split('-').at(-1),
    );
    expect(optionValues).not.toContain('latest');
    expect(optionValues).toContain('10');
    expect(optionValues).toContain('11');
  });

  it('disables submit when invalid (no category or no item) and shows pending state', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Publish to Blue Share'),
    );
    expect(submitBtn).toBeDefined();
    // Initially disabled because no item and no category selected
    expect(submitBtn?.hasAttribute('disabled')).toBe(true);
  });

  it('confirms successful publish, clears draft, and shows receipt', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // Select Lead Synth
    const leadItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Lead Synth'),
    );
    await act(async () => {
      leadItem?.click();
    });

    // Pick category 10
    const select = container.querySelector('[aria-label="Destination categories"]') as HTMLElement;
    await act(async () => {
      setSelectValue(select, '10');
    });

    // Click submit
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Publish to Blue Share'),
    );
    expect(submitBtn?.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      submitBtn?.click();
    });

    expect((window as any).blueAPI.publishBlueShareResource).toHaveBeenCalledWith(
      'ctx-test-export',
      expect.any(String),
      'token-prep-123',
      10,
      'Original comment from synth',
    );

    // Shows success receipt
    expect(container.textContent).toContain('successfully published');
  });

  it('handles stale source by preserving entered description for renewed review', async () => {
    (window as any).blueAPI.publishBlueShareResource.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'stale_source',
        message:
          'Source library item was modified or deleted since review. Please review and export again.',
        outcome: 'rejected',
      },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // Select Lead Synth
    const leadItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Lead Synth'),
    );
    await act(async () => {
      leadItem?.click();
    });

    // Pick category 10
    const select = container.querySelector('[aria-label="Destination categories"]') as HTMLElement;
    await act(async () => {
      setSelectValue(select, '10');
    });

    // Edit description
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      setTextareaValue(textarea, 'My custom edited public description');
    });

    // Click submit (fails with stale_source)
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Publish to Blue Share'),
    );
    await act(async () => {
      submitBtn?.click();
    });

    // Description is preserved in textarea!
    expect(container.querySelector('textarea')?.value).toBe('My custom edited public description');
    expect(container.textContent).toMatch(/modified|deleted/i);
  });

  it('handles uncertain outcome (504/timeout): retains draft, displays uncertainty banner, and allows switching to Manage', async () => {
    (window as any).blueAPI.publishBlueShareResource.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'gateway_timeout',
        message: 'Gateway timeout after publish',
        outcome: 'unknown',
        status: 504,
      },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // Select Lead Synth
    const leadItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Lead Synth'),
    );
    await act(async () => {
      leadItem?.click();
    });

    // Pick category 10
    const select = container.querySelector('[aria-label="Destination categories"]') as HTMLElement;
    await act(async () => {
      setSelectValue(select, '10');
    });

    // Edit description
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      setTextareaValue(textarea, 'Uncertain outcome description');
    });

    // Submit
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Publish to Blue Share'),
    );
    await act(async () => {
      submitBtn?.click();
    });

    // Uncertainty banner is shown
    expect(container.textContent).toMatch(/uncertain|may have received/i);

    // Draft is retained
    expect(container.querySelector('textarea')?.value).toBe('Uncertain outcome description');

    // Switch to Manage tab via banner button
    const manageLink = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('My Submissions') || b.textContent?.includes('Manage'),
    );
    expect(manageLink).toBeDefined();
    await act(async () => {
      manageLink?.click();
    });

    // Verify it switched to Manage tab
    expect(container.textContent).toContain('Fetch submissions');
  });

  it('renders indented hierarchical options in export category selector and retains real top-level destinations', async () => {
    const hierarchicalCategories: readonly Category[] = [
      { id: 20, kind: 'instrument', parentId: null, name: 'Sample Based', description: null },
      { id: 10, kind: 'instrument', parentId: null, name: 'Synthesizers', description: null },
      { id: 12, kind: 'instrument', parentId: 10, name: 'FM Synths', description: null },
      { id: 11, kind: 'instrument', parentId: 10, name: 'Subtractive Synths', description: null },
    ];

    (window as any).blueAPI.getBlueShareCategories = vi.fn().mockResolvedValue({
      ok: true,
      value: hierarchicalCategories,
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    const select = container.querySelector('[aria-label="Destination categories"]') as HTMLElement;
    expect(select).not.toBeNull();

    const rows = Array.from(select.querySelectorAll('[role=treeitem]'));
    expect(rows.map((row) => row.textContent)).toEqual([
      'Synthesizers',
      'Subtractive Synths',
      'FM Synths',
      'Sample Based',
    ]);
    expect(rows.map((row) => row.getAttribute('aria-level'))).toEqual(['1', '2', '2', '1']);
    await act(async () =>
      select.querySelector<HTMLButtonElement>('[aria-label="Collapse Synthesizers"]')?.click(),
    );
    expect(select.textContent).not.toContain('Subtractive Synths');
    await act(async () =>
      select.querySelector<HTMLButtonElement>('[aria-label="Expand Synthesizers"]')?.click(),
    );
    expect(select.textContent).toContain('Subtractive Synths');
  });

  it('discards stale out-of-order source preparation responses (T061)', async () => {
    let resolveLeadSynth: ((val: any) => void) | null = null;

    (window as any).blueAPI.prepareBlueSharePublish = vi
      .fn()
      .mockImplementation((_ctx, _reqId, key, _rev) => {
        if (key.nodeId === 'item-synth-1') {
          // Slow preparation for Lead Synth
          return new Promise((resolve) => {
            resolveLeadSynth = resolve;
          });
        } else if (key.nodeId === 'item-synth-2') {
          // Fast preparation for Bass Synth
          return Promise.resolve({
            ok: true,
            value: {
              sourceToken: 'token-prep-bass',
              kind: 'instrument',
              name: 'Bass Synth',
              blueType: 'blue.orchestra.GenericInstrument',
              descriptionSeed: 'Bass comment',
              byteLength: 500,
            },
          });
        }
        return Promise.resolve({
          ok: false,
          error: { code: 'service_error', message: 'Not found' },
        });
      });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    const leadItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Lead Synth'),
    );
    const bassItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Bass Synth'),
    );
    expect(leadItem).toBeDefined();
    expect(bassItem).toBeDefined();

    // 1. Click Lead Synth (slow/delayed)
    await act(async () => {
      leadItem?.click();
    });
    expect(resolveLeadSynth).not.toBeNull();

    // 2. Click Bass Synth (resolves immediately)
    await act(async () => {
      bassItem?.click();
    });

    // UI should show Bass Synth selected
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Bass comment');
    expect(container.textContent).toContain('Bass Synth');

    // 3. Lead Synth preparation resolves late
    await act(async () => {
      resolveLeadSynth!({
        ok: true,
        value: {
          sourceToken: 'token-prep-lead',
          kind: 'instrument',
          name: 'Lead Synth',
          blueType: 'blue.orchestra.GenericInstrument',
          descriptionSeed: 'Lead comment',
          byteLength: 400,
        },
      });
    });

    // UI must still display Bass Synth; Lead Synth must not overwrite
    expect(textarea.value).toBe('Bass comment');
    expect(container.textContent).toContain('Bass Synth');
  });

  it('resets pending flags and discards late source token on close and reopen during preparation (T062)', async () => {
    let resolvePrep: ((val: any) => void) | null = null;
    (window as any).blueAPI.prepareBlueSharePublish = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolvePrep = resolve;
      });
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // Select Lead Synth
    const leadItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Lead Synth'),
    );
    await act(async () => {
      leadItem?.click();
    });

    expect(resolvePrep).not.toBeNull();

    // Close modal while preparation is pending
    const closeBtn = container.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    await act(async () => {
      closeBtn.click();
    });

    // Reopen dialog
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Navigate to Export tab
    const exportTabBtn2 = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn2?.click();
    });

    // Now late preparation resolves
    await act(async () => {
      resolvePrep!({
        ok: true,
        value: {
          sourceToken: 'token-late-lead',
          kind: 'instrument',
          name: 'Lead Synth',
          blueType: 'blue.orchestra.GenericInstrument',
          descriptionSeed: 'Late seed',
          byteLength: 400,
        },
      });
    });

    // The late prepared token must NOT be applied to reopened state
    expect(container.textContent).toContain(
      'Select an item from the left column to prepare it for export.',
    );
    expect(container.textContent).not.toContain('400 bytes');
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('proves that publish uncertainty cannot be bypassed by ordinary re-selection or immediate second activation, and permits explicit retry after /mine reconciliation (T064)', async () => {
    (window as any).blueAPI.publishBlueShareResource.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'gateway_timeout',
        message: 'Timeout occurred during publish',
        outcome: 'unknown',
        status: 504,
      },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // 1. Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // 2. Select Lead Synth
    const leadItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Lead Synth'),
    );
    await act(async () => {
      leadItem?.click();
    });

    // Pick category 10
    const select = container.querySelector('[aria-label="Destination categories"]') as HTMLElement;
    await act(async () => {
      setSelectValue(select, '10');
    });

    // Type description
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      setTextareaValue(textarea, 'Uncertain Synth Description');
    });

    // Submit publish
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Publish to Blue Share'),
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);

    await act(async () => {
      submitBtn.click();
    });

    // 3. Uncertainty banner is shown, draft retained
    expect(container.textContent).toContain('Publication outcome is uncertain');
    expect(textarea.value).toBe('Uncertain Synth Description');

    // 4. Submit button is disabled: immediate second activation blocked!
    const submitBtnAfter = Array.from(container.querySelectorAll('button')).find(
      (b) =>
        b.textContent?.includes('Publish to Blue Share') ||
        b.textContent?.includes('Retry Publication'),
    ) as HTMLButtonElement;
    expect(submitBtnAfter.disabled).toBe(true);

    // 5. Ordinary re-selection cannot bypass uncertainty
    const prepCallCountBefore = (window as any).blueAPI.prepareBlueSharePublish.mock.calls.length;
    const bassItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Bass Synth'),
    );
    await act(async () => {
      bassItem?.click();
    });

    // Preparation was NOT called for Bass Synth
    expect((window as any).blueAPI.prepareBlueSharePublish.mock.calls.length).toBe(
      prepCallCountBefore,
    );
    // Draft and selected Lead Synth are preserved
    expect(container.textContent).toContain('Lead Synth');
    expect(textarea.value).toBe('Uncertain Synth Description');
    expect(container.textContent).toContain('Publication outcome is uncertain');

    // 6. Draft and uncertainty preserved across tab changes
    const importTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Import',
    );
    await act(async () => {
      importTabBtn?.click();
    });

    const exportTabBtn2 = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn2?.click();
    });

    expect(container.textContent).toContain('Publication outcome is uncertain');
    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'Uncertain Synth Description',
    );

    // 7. Click Check My Submissions in the banner to reconcile
    (window as any).blueAPI.listBlueShareMine = vi.fn().mockResolvedValue({
      ok: true,
      value: { items: [], nextBeforeId: null },
    });

    const checkMineBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Check My Submissions'),
    );
    expect(checkMineBtn).toBeDefined();
    await act(async () => {
      checkMineBtn!.click();
    });

    // Reconciled! Switch back to Export tab
    const exportTabBtn3 = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn3?.click();
    });

    // Banner indicates submissions refreshed
    expect(container.textContent).toContain('Submissions refreshed after uncertain publication');

    // Submit button is now enabled with "Retry Publication" label
    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry Publication'),
    ) as HTMLButtonElement;
    expect(retryBtn).toBeDefined();
    expect(retryBtn.disabled).toBe(false);

    // 8. Explicit retry succeeds
    (window as any).blueAPI.publishBlueShareResource.mockResolvedValueOnce({
      ok: true,
      value: {
        kind: 'instrument',
        id: 501,
        name: 'Lead Synth',
        description: 'Uncertain Synth Description',
        blueType: 'blue.orchestra.GenericInstrument',
        category: { id: 10, name: 'Synthesizers' },
        author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
      },
    });

    await act(async () => {
      retryBtn.click();
    });

    expect(container.textContent).toContain('successfully published to Blue Share');
    expect(container.textContent).not.toContain('Publication outcome is uncertain');
  });

  it('preserves public description exactly without trim() || null and tracks intentional edits separately from comment seed (T066)', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    // Switch to Export tab
    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // 1. Initial selection without edits seeds from comment
    const leadItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Lead Synth'),
    );
    await act(async () => {
      leadItem?.click();
    });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Original comment from synth');

    // 2. Select another item when unedited seeds from that item's comment
    (window as any).blueAPI.prepareBlueSharePublish.mockResolvedValueOnce({
      ok: true,
      value: {
        ...mockSourceSeed,
        sourceToken: 'token-prep-bass',
        name: 'Bass Synth',
        descriptionSeed: 'Bass comment seed',
      },
    });
    const bassItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Bass Synth'),
    );
    await act(async () => {
      bassItem?.click();
    });
    expect(textarea.value).toBe('Bass comment seed');

    // 3. User intentionally edits description (with blank string or leading/trailing whitespace and line breaks)
    const exactDescription = '   \nLine 1 with spaces   \n\nLine 2 with breaks\n   ';
    await act(async () => {
      setTextareaValue(textarea, exactDescription);
    });
    expect(textarea.value).toBe(exactDescription);

    // 4. Selecting another item preserves the intentional edit rather than overwriting with comment seed
    await act(async () => {
      leadItem?.click();
    });
    expect(textarea.value).toBe(exactDescription);

    // Pick category 10
    const select = container.querySelector('[aria-label="Destination categories"]') as HTMLElement;
    await act(async () => {
      setSelectValue(select, '10');
    });

    // 5. Publish sends exact description without trim()
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Publish to Blue Share'),
    );
    await act(async () => {
      submitBtn?.click();
    });

    expect((window as any).blueAPI.publishBlueShareResource).toHaveBeenCalledWith(
      'ctx-test-export',
      expect.any(String),
      expect.any(String),
      10,
      exactDescription, // EXACT string with all leading/trailing whitespace and line breaks preserved
    );
  });

  it('preserves blank string intentional edits during renewed review of a stale source (T066)', async () => {
    (window as any).blueAPI.publishBlueShareResource.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'stale_source',
        message:
          'Source library item was modified or deleted since review. Please review and export again.',
        outcome: 'rejected',
      },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    const leadItem = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Lead Synth'),
    );
    await act(async () => {
      leadItem?.click();
    });

    // User intentionally clears description to empty string
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      setTextareaValue(textarea, '');
    });
    expect(textarea.value).toBe('');

    const select = container.querySelector('[aria-label="Destination categories"]') as HTMLElement;
    await act(async () => {
      setSelectValue(select, '10');
    });

    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Publish to Blue Share'),
    );
    await act(async () => {
      submitBtn?.click();
    });

    expect((window as any).blueAPI.publishBlueShareResource).toHaveBeenCalledWith(
      'ctx-test-export',
      expect.any(String),
      expect.any(String),
      10,
      '', // Blank string preserved, not converted to null or omitted
    );

    // Stale source error displayed
    expect(container.textContent).toMatch(/modified|deleted/i);

    // Renewed review: user clicks item again after stale source
    await act(async () => {
      leadItem?.click();
    });

    // Intentional blank edit is still preserved across renewed review, NOT overwritten with comment seed
    expect(container.querySelector('textarea')?.value).toBe('');
  });

  it('traverses every nextCursor page when a parent has more than 500 children (T067)', async () => {
    const page1Items: LibraryBrowseNode[] = Array.from({ length: 500 }, (_, i) => ({
      key: { scope: 'user', libraryType: 'instrument', nodeId: `item-${i}` },
      nodeId: `item-${i}`,
      parentId: null,
      libraryType: 'instrument',
      scope: 'user',
      nodeKind: 'item',
      displayName: `Instrument Item ${i}`,
      breadcrumb: ['User Instruments', `Instrument Item ${i}`],
      revision: 1,
      hasChildren: false,
    }));
    const page2Items: LibraryBrowseNode[] = Array.from({ length: 5 }, (_, i) => ({
      key: { scope: 'user', libraryType: 'instrument', nodeId: `item-${500 + i}` },
      nodeId: `item-${500 + i}`,
      parentId: null,
      libraryType: 'instrument',
      scope: 'user',
      nodeKind: 'item',
      displayName: `Instrument Item ${500 + i}`,
      breadcrumb: ['User Instruments', `Instrument Item ${500 + i}`],
      revision: 1,
      hasChildren: false,
    }));

    (window as any).blueAPI.browseLibraries = vi.fn().mockImplementation((req: any) => {
      if (req.cursor === 'cursor-p2') {
        return Promise.resolve({
          ok: true,
          value: {
            parent: { scope: 'user', libraryType: 'instrument', nodeId: 'root' },
            children: page2Items,
            nextCursor: null,
            contentRevision: 10,
          },
        });
      }
      return Promise.resolve({
        ok: true,
        value: {
          parent: { scope: 'user', libraryType: 'instrument', nodeId: 'root' },
          children: page1Items,
          nextCursor: 'cursor-p2',
          contentRevision: 10,
        },
      });
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // Both pages requested with pagination and expected revision
    expect((window as any).blueAPI.browseLibraries).toHaveBeenCalledTimes(2);
    expect((window as any).blueAPI.browseLibraries).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        parent: { scope: 'user', libraryType: 'instrument', nodeId: undefined },
        limit: 500,
      }),
    );
    expect((window as any).blueAPI.browseLibraries).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        parent: { scope: 'user', libraryType: 'instrument', nodeId: undefined },
        limit: 500,
        cursor: 'cursor-p2',
        expectedContentRevision: 10,
      }),
    );

    // Items from both pages rendered
    expect(container.textContent).toContain('Instrument Item 0');
    expect(container.textContent).toContain('Instrument Item 499');
    expect(container.textContent).toContain('Instrument Item 500');
    expect(container.textContent).toContain('Instrument Item 504');

    // Page 2 item can be selected for export
    const item504 = Array.from(container.querySelectorAll('button, [role="button"]')).find((el) =>
      el.textContent?.includes('Instrument Item 504'),
    );
    expect(item504).toBeDefined();
    await act(async () => {
      item504?.click();
    });

    expect((window as any).blueAPI.prepareBlueSharePublish).toHaveBeenCalledWith(
      'ctx-test-export',
      expect.any(String),
      { scope: 'user', libraryType: 'instrument', nodeId: 'item-504' },
      1,
    );
  });

  it('discovers and traverses folders found on later pages of a parent (T067)', async () => {
    const page1Items: LibraryBrowseNode[] = Array.from({ length: 500 }, (_, i) => ({
      key: { scope: 'user', libraryType: 'instrument', nodeId: `item-${i}` },
      nodeId: `item-${i}`,
      parentId: null,
      libraryType: 'instrument',
      scope: 'user',
      nodeKind: 'item',
      displayName: `Item ${i}`,
      breadcrumb: ['User Instruments', `Item ${i}`],
      revision: 1,
      hasChildren: false,
    }));
    const page2Children: LibraryBrowseNode[] = [
      {
        key: { scope: 'user', libraryType: 'instrument', nodeId: 'item-500' },
        nodeId: 'item-500',
        parentId: null,
        libraryType: 'instrument',
        scope: 'user',
        nodeKind: 'item',
        displayName: 'Item 500',
        breadcrumb: ['User Instruments', 'Item 500'],
        revision: 1,
        hasChildren: false,
      },
      {
        key: null,
        nodeId: 'folder-sub',
        parentId: null,
        libraryType: 'instrument',
        scope: 'user',
        nodeKind: 'folder',
        displayName: 'Sub Folder',
        breadcrumb: ['User Instruments', 'Sub Folder'],
        revision: 1,
        hasChildren: true,
      },
    ];
    const subfolderChildren: LibraryBrowseNode[] = [
      {
        key: { scope: 'user', libraryType: 'instrument', nodeId: 'item-nested-1' },
        nodeId: 'item-nested-1',
        parentId: 'folder-sub',
        libraryType: 'instrument',
        scope: 'user',
        nodeKind: 'item',
        displayName: 'Nested Synth 1',
        breadcrumb: ['User Instruments', 'Sub Folder', 'Nested Synth 1'],
        revision: 2,
        hasChildren: false,
      },
    ];

    (window as any).blueAPI.browseLibraries = vi.fn().mockImplementation((req: any) => {
      if (req.parent.nodeId === 'folder-sub') {
        return Promise.resolve({
          ok: true,
          value: {
            parent: { scope: 'user', libraryType: 'instrument', nodeId: 'folder-sub' },
            children: subfolderChildren,
            nextCursor: null,
            contentRevision: 12,
          },
        });
      }
      if (req.cursor === 'cursor-root-2') {
        return Promise.resolve({
          ok: true,
          value: {
            parent: { scope: 'user', libraryType: 'instrument', nodeId: 'root' },
            children: page2Children,
            nextCursor: null,
            contentRevision: 12,
          },
        });
      }
      return Promise.resolve({
        ok: true,
        value: {
          parent: { scope: 'user', libraryType: 'instrument', nodeId: 'root' },
          children: page1Items,
          nextCursor: 'cursor-root-2',
          contentRevision: 12,
        },
      });
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // Root page 1, Root page 2, and Subfolder were all browsed
    expect((window as any).blueAPI.browseLibraries).toHaveBeenCalledTimes(3);

    // Items from all pages and subfolders are present
    expect(container.textContent).toContain('Item 500');
    expect(container.textContent).toContain('Nested Synth 1');

    const nestedItem = Array.from(container.querySelectorAll('button, [role="button"]')).find(
      (el) => el.textContent?.includes('Nested Synth 1'),
    );
    expect(nestedItem).toBeDefined();
    await act(async () => {
      nestedItem?.click();
    });

    expect((window as any).blueAPI.prepareBlueSharePublish).toHaveBeenCalledWith(
      'ctx-test-export',
      expect.any(String),
      { scope: 'user', libraryType: 'instrument', nodeId: 'item-nested-1' },
      2,
    );
  });

  it('propagates mid-traversal browse failures as recoverable errors without showing partial list (T067)', async () => {
    const page1Items: LibraryBrowseNode[] = Array.from({ length: 500 }, (_, i) => ({
      key: { scope: 'user', libraryType: 'instrument', nodeId: `item-${i}` },
      nodeId: `item-${i}`,
      parentId: null,
      libraryType: 'instrument',
      scope: 'user',
      nodeKind: 'item',
      displayName: `Partial Item ${i}`,
      breadcrumb: ['User Instruments', `Partial Item ${i}`],
      revision: 1,
      hasChildren: false,
    }));

    (window as any).blueAPI.browseLibraries = vi.fn().mockImplementation((req: any) => {
      if (req.cursor === 'cursor-p2') {
        return Promise.resolve({
          ok: false,
          error: { code: 'io_error', message: 'Failed to read library database' },
        });
      }
      return Promise.resolve({
        ok: true,
        value: {
          parent: { scope: 'user', libraryType: 'instrument', nodeId: 'root' },
          children: page1Items,
          nextCursor: 'cursor-p2',
          contentRevision: 10,
        },
      });
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // Error is propagated
    expect(container.textContent).toContain('Failed to read library database');

    // Partial items from page 1 must NOT be shown
    expect(container.textContent).not.toContain('Partial Item 0');
    expect(container.textContent).not.toContain('Partial Item 499');
  });

  it('fences traversal on group change (T067)', async () => {
    let resolvePage2: (val: any) => void;
    const page2Promise = new Promise((resolve) => {
      resolvePage2 = resolve;
    });

    const page1Inst: LibraryBrowseNode[] = Array.from({ length: 500 }, (_, i) => ({
      key: { scope: 'user', libraryType: 'instrument', nodeId: `inst-${i}` },
      nodeId: `inst-${i}`,
      parentId: null,
      libraryType: 'instrument',
      scope: 'user',
      nodeKind: 'item',
      displayName: `Inst Item ${i}`,
      breadcrumb: ['User Instruments', `Inst Item ${i}`],
      revision: 1,
      hasChildren: false,
    }));

    const effectItems: LibraryBrowseNode[] = [
      {
        key: { scope: 'user', libraryType: 'effect', nodeId: 'fx-reverb' },
        nodeId: 'fx-reverb',
        parentId: null,
        libraryType: 'effect',
        scope: 'user',
        nodeKind: 'item',
        displayName: 'Reverb Effect',
        breadcrumb: ['User Effects', 'Reverb Effect'],
        revision: 1,
        hasChildren: false,
      },
    ];

    (window as any).blueAPI.browseLibraries = vi.fn().mockImplementation((req: any) => {
      if (req.parent.libraryType === 'effect') {
        return Promise.resolve({
          ok: true,
          value: {
            parent: { scope: 'user', libraryType: 'effect', nodeId: 'root' },
            children: effectItems,
            nextCursor: null,
            contentRevision: 5,
          },
        });
      }
      if (req.cursor === 'cursor-p2') {
        return page2Promise;
      }
      return Promise.resolve({
        ok: true,
        value: {
          parent: { scope: 'user', libraryType: 'instrument', nodeId: 'root' },
          children: page1Inst,
          nextCursor: 'cursor-p2',
          contentRevision: 10,
        },
      });
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    // Instrument page 1 returned, page 2 is pending
    // User switches group to Effects
    const effectsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Effects'),
    );
    expect(effectsBtn).toBeDefined();
    await act(async () => {
      effectsBtn?.click();
    });

    // Now late instrument page 2 resolves
    await act(async () => {
      resolvePage2!({
        ok: true,
        value: {
          parent: { scope: 'user', libraryType: 'instrument', nodeId: 'root' },
          children: [
            {
              key: { scope: 'user', libraryType: 'instrument', nodeId: 'late-inst-501' },
              nodeId: 'late-inst-501',
              parentId: null,
              libraryType: 'instrument',
              scope: 'user',
              nodeKind: 'item',
              displayName: 'Late Instrument 501',
              breadcrumb: ['User Instruments', 'Late Instrument 501'],
              revision: 1,
              hasChildren: false,
            },
          ],
          nextCursor: null,
          contentRevision: 10,
        },
      });
    });

    // Active view shows Effects, and late instrument result was fenced out
    expect(container.textContent).toContain('Reverb Effect');
    expect(container.textContent).not.toContain('Late Instrument 501');
  });

  it('renders user library error with retry and avoids empty state text on browse failure (T068)', async () => {
    (window as any).blueAPI.browseLibraries = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'service_error', message: 'Database query failed', status: 500 },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          parent: { scope: 'user', libraryType: 'instrument', nodeId: 'root' },
          children: [mockUserLibraryItems[0]],
          nextCursor: null,
          contentRevision: 1,
        },
      });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#open-btn')?.click();
    });

    const exportTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export'),
    );
    await act(async () => {
      exportTabBtn?.click();
    });

    expect(container.textContent).toContain('Database query failed');
    expect(container.textContent).not.toContain('No items found in your user library.');

    // Click Retry
    const retryBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Retry',
    );
    expect(retryBtn).toBeDefined();
    await act(async () => {
      retryBtn!.click();
    });

    expect(window.blueAPI.browseLibraries).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Lead Synth');
    expect(container.textContent).not.toContain('Database query failed');
  });
});
