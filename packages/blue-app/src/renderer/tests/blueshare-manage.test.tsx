// @vitest-environment jsdom
import React, { act } from 'react';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { createBlueShareQueryClient } from '../components/blueshare/blueshare-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueShareDialog } from '../components/blueshare/BlueShareDialog';
import { useBlueShare } from '../components/blueshare/use-blueshare';
import type { ResourceSummary } from '../../shared/blueshare';

// Keep Query observer notifications inside React's async act boundary.
notifyManager.setScheduler(queueMicrotask);

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mockOwnedSubmissions: readonly ResourceSummary[] = [
  {
    kind: 'instrument',
    id: 101,
    name: 'Lead Synth',
    description: 'An aggressive lead synthesizer',
    blueType: 'blue.orchestra.GenericInstrument',
    createdAt: '2026-01-10T12:00:00Z',
    category: { id: 10, name: 'Synthesizers' },
    author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
  },
  {
    kind: 'instrument',
    id: 102,
    name: 'Sub Bass',
    description: 'A deep sub bass instrument',
    blueType: 'blue.orchestra.GenericInstrument',
    createdAt: '2026-01-12T12:00:00Z',
    category: { id: 11, name: 'Subtractive' },
    author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
  },
];

describe('BlueShare Manage Submissions & Removal UI (T043)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: ReturnType<typeof createBlueShareQueryClient>;
  let accountChangedHandler: ((snapshot: any) => void) | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = createBlueShareQueryClient();
    accountChangedHandler = null;

    (window as any).blueAPI = {
      openBlueShare: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          contextId: 'ctx-test-manage',
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
        value: [
          {
            id: 10,
            kind: 'instrument',
            parentId: null,
            name: 'Synthesizers',
            description: 'Synths',
          },
        ],
      }),
      getBlueShareLatest: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      listBlueShareResources: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      listBlueShareMine: vi.fn().mockResolvedValue({
        ok: true,
        value: { items: mockOwnedSubmissions, nextBeforeId: null },
      }),
      removeBlueShareResource: vi.fn().mockResolvedValue({
        ok: true,
        value: { kind: 'instrument', id: 101, removed: true, alreadyRemoved: false },
      }),
      signOutBlueShare: vi.fn().mockImplementation(async () => {
        window.blueAPI.getBlueShareAccount = vi.fn().mockResolvedValue({
          ok: true,
          value: { state: 'signedOut', user: null, expiresAt: null, accountEpoch: 3 },
        });
        return {
          ok: true,
          value: { signedOut: true, remoteRevocationConfirmed: true },
        };
      }),
      onBlueShareAccountChanged: vi.fn().mockImplementation((cb) => {
        accountChangedHandler = cb;
        return () => {
          accountChangedHandler = null;
        };
      }),
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

  async function openAndNavigateToManage() {
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

    const tabs = Array.from(container.querySelectorAll('button[role="tab"]'));
    const manageTab = tabs.find((b) => b.textContent?.trim() === 'Manage') as HTMLButtonElement;
    expect(manageTab).toBeDefined();

    await act(async () => {
      manageTab.click();
    });
  }

  it.each([true, false])(
    'keeps the new selection and disabled removal control while an old DELETE settles (success=%s)',
    async (ok) => {
      let finish!: (value: any) => void;
      (window.blueAPI as any).removeBlueShareResource = vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      await openAndNavigateToManage();
      const select = (name: string) =>
        container.querySelector(`[aria-label="Select ${name}"]`) as HTMLElement;
      await act(async () => select('Lead Synth').click());
      await act(async () =>
        (container.querySelector('[data-testid="manage-remove-btn"]') as HTMLButtonElement).click(),
      );
      await act(async () =>
        (container.querySelector('[data-action-id="remove"]') as HTMLButtonElement).click(),
      );
      await act(async () => select('Sub Bass').click());
      const remove = container.querySelector(
        '[data-testid="manage-remove-btn"]',
      ) as HTMLButtonElement;
      expect(remove.disabled).toBe(true);
      expect(remove.textContent).toContain('Removing');
      await act(async () => remove.click());
      expect(window.blueAPI.removeBlueShareResource).toHaveBeenCalledTimes(1);
      await act(async () =>
        finish(
          ok
            ? {
                ok: true,
                value: { kind: 'instrument', id: 101, removed: true, alreadyRemoved: false },
              }
            : { ok: false, error: { code: 'forbidden', message: 'Denied', outcome: 'rejected' } },
        ),
      );
      expect(select('Sub Bass').getAttribute('aria-selected')).toBe('true');
      expect(container.textContent).not.toContain('successfully removed');
      expect(container.textContent).not.toContain('Denied');
    },
  );
  it('fetches and displays owned submissions and supports pagination (Load More)', async () => {
    (window as any).blueAPI.listBlueShareMine
      .mockResolvedValueOnce({
        ok: true,
        value: { items: [mockOwnedSubmissions[0]], nextBeforeId: 102 },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { items: [mockOwnedSubmissions[1]], nextBeforeId: null },
      });

    await openAndNavigateToManage();

    expect((window as any).blueAPI.listBlueShareMine).toHaveBeenCalledWith(
      'ctx-test-manage',
      expect.any(String),
      'instrument',
      null,
    );

    // Initial page shows Lead Synth and Load More button
    expect(container.textContent).toContain('Lead Synth');
    const loadMoreBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Load More',
    );
    expect(loadMoreBtn).toBeDefined();

    // Click Load More
    await act(async () => {
      loadMoreBtn!.click();
    });

    expect((window as any).blueAPI.listBlueShareMine).toHaveBeenCalledWith(
      'ctx-test-manage',
      expect.any(String),
      'instrument',
      102,
    );

    expect(container.textContent).toContain('Lead Synth');
    expect(container.textContent).toContain('Sub Bass');
  });

  it('handles empty and error states distinctly on Manage tab', async () => {
    (window as any).blueAPI.listBlueShareMine.mockResolvedValueOnce({
      ok: true,
      value: { items: [], nextBeforeId: null },
    });

    await openAndNavigateToManage();
    expect(container.textContent).toContain('No submissions found for this kind.');

    // Now test error state
    (window as any).blueAPI.listBlueShareMine.mockResolvedValueOnce({
      ok: false,
      error: { code: 'server_error', message: 'Failed to retrieve submissions from service' },
    });

    const fetchBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Fetch again',
    );
    expect(fetchBtn).toBeDefined();

    await act(async () => {
      fetchBtn!.click();
    });

    expect(container.textContent).toContain('Failed to retrieve submissions from service');
  });

  it('clears owned selection and results when account changes', async () => {
    await openAndNavigateToManage();

    // Click on Lead Synth row to select it
    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Lead Synth'),
    ) as HTMLTableRowElement;
    expect(row).toBeDefined();

    await act(async () => {
      row.click();
    });

    // Remove button should appear
    const removeBtn = container.querySelector('[data-testid="manage-remove-btn"]');
    expect(removeBtn).not.toBeNull();
    expect(container.textContent).toContain('Selected:');
    expect(container.textContent).toContain('Lead Synth');
    const preview = container.querySelector('[aria-label="Submission details"]');
    expect(preview?.textContent).toContain('An aggressive lead synthesizer');
    expect(preview?.textContent).toContain('blue.orchestra.GenericInstrument');

    // Simulate account change event (e.g. signing out or switching account)
    expect(accountChangedHandler).toBeDefined();
    await act(async () => {
      accountChangedHandler!({
        state: 'signedOut',
        user: null,
        expiresAt: null,
        accountEpoch: 2,
      });
    });

    // Remove button and selection should be completely cleared
    expect(container.querySelector('[data-testid="manage-remove-btn"]')).toBeNull();
    expect(container.textContent).not.toContain('Selected:');
  });

  it('opens named confirmation dialog with Cancel focused and cancels cleanly on backdrop/cancel', async () => {
    await openAndNavigateToManage();

    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Lead Synth'),
    ) as HTMLTableRowElement;
    await act(async () => {
      row.click();
    });

    const removeBtn = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    expect(removeBtn).toBeDefined();

    // Click remove button to open ConfirmationDialog
    await act(async () => {
      removeBtn.click();
    });

    // Confirmation dialog is open
    const confirmTitle = container.querySelector('[role="alertdialog"] h2');
    expect(confirmTitle?.textContent).toBe('Remove Submission');
    // Description names the item
    expect(container.textContent).toContain(
      'Are you sure you want to remove "Lead Synth" from Blue Share?',
    );

    // Cancel action is focused by default
    const cancelBtn = container.querySelector('[data-action-id="cancel"]') as HTMLButtonElement;
    expect(cancelBtn).toBeDefined();
    expect(document.activeElement).toBe(cancelBtn);

    // Click Cancel -> dialog closes, no dispatch to removeBlueShareResource
    await act(async () => {
      cancelBtn.click();
    });

    expect(container.querySelector('[data-action-id="cancel"]')).toBeNull();
    expect((window as any).blueAPI.removeBlueShareResource).not.toHaveBeenCalled();
  });

  it('dispatches removal on confirmation, shows busy indicator while pending, and refreshes list on success', async () => {
    let resolveRemove: (res: any) => void;
    const removePromise = new Promise((resolve) => {
      resolveRemove = resolve;
    });
    (window as any).blueAPI.removeBlueShareResource.mockReturnValueOnce(removePromise);

    await openAndNavigateToManage();

    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Lead Synth'),
    ) as HTMLTableRowElement;
    await act(async () => {
      row.click();
    });

    const removeBtn = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    await act(async () => {
      removeBtn.click();
    });

    const confirmRemoveBtn = container.querySelector(
      '[data-action-id="remove"]',
    ) as HTMLButtonElement;
    expect(confirmRemoveBtn).toBeDefined();

    // Confirm removal
    await act(async () => {
      confirmRemoveBtn.click();
    });

    // Busy state: removal is pending
    const actionBtn = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    expect(actionBtn?.disabled).toBe(true);
    expect(actionBtn?.textContent).toContain('Removing…');

    // Resolve removal and mock subsequent listMine refresh to return updated items
    (window as any).blueAPI.listBlueShareMine = vi.fn().mockResolvedValue({
      ok: true,
      value: { items: [mockOwnedSubmissions[1]], nextBeforeId: null },
    });
    await act(async () => {
      resolveRemove!({
        ok: true,
        value: { kind: 'instrument', id: 101, removed: true, alreadyRemoved: false },
      });
    });

    expect((window as any).blueAPI.removeBlueShareResource).toHaveBeenCalledWith(
      'ctx-test-manage',
      expect.any(String),
      { kind: 'instrument', id: 101 },
    );

    // Removed item is now gone from the table!
    expect(container.querySelector('tbody')?.textContent).not.toContain('Lead Synth');
    expect(container.querySelector('tbody')?.textContent).toContain('Sub Bass');
    expect(container.textContent).toContain('Resource successfully removed from Blue Share.');
  });

  it('handles uncertain removal outcome (timeout/network error) with recovery banner and no auto-retry', async () => {
    (window as any).blueAPI.removeBlueShareResource.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'gateway_timeout',
        message: 'Timeout after removal dispatched',
        outcome: 'unknown',
        status: 504,
      },
    });

    await openAndNavigateToManage();

    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Lead Synth'),
    ) as HTMLTableRowElement;
    await act(async () => {
      row.click();
    });

    const removeBtn = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    await act(async () => {
      removeBtn.click();
    });

    const confirmRemoveBtn = container.querySelector(
      '[data-action-id="remove"]',
    ) as HTMLButtonElement;
    await act(async () => {
      confirmRemoveBtn.click();
    });

    // Uncertainty banner should appear
    expect(container.textContent).toContain('Removal outcome is uncertain');
    expect(container.textContent).toContain(
      'Please refresh your submissions to verify whether the item was removed before trying again.',
    );

    // Should NOT automatically retry removal
    expect((window as any).blueAPI.removeBlueShareResource).toHaveBeenCalledTimes(1);

    // Refresh submissions button re-fetches owned items
    const refreshBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Refresh submissions',
    );
    expect(refreshBtn).toBeDefined();

    await act(async () => {
      refreshBtn!.click();
    });

    expect((window as any).blueAPI.listBlueShareMine).toHaveBeenCalledTimes(2);
  });

  it('discards delayed old-account owned results after sign out or account replacement (T061)', async () => {
    let resolveMineUserA: ((val: any) => void) | null = null;
    (window as any).blueAPI.listBlueShareMine = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveMineUserA = resolve;
      });
    });

    await openAndNavigateToManage();

    // fetchMine was dispatched for User A (epoch 1) and is pending
    expect(resolveMineUserA).not.toBeNull();

    // User signs out
    const signOutBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Sign out',
    );
    expect(signOutBtn).toBeDefined();
    await act(async () => {
      signOutBtn!.click();
    });

    // Now delayed User A submissions resolve
    await act(async () => {
      resolveMineUserA!({
        ok: true,
        value: {
          items: [
            {
              kind: 'instrument',
              id: 999,
              name: 'Secret User A Submission',
              description: 'Classified',
              blueType: 'blue.orchestra.GenericInstrument',
              createdAt: '2026-01-01T00:00:00Z',
              category: { id: 10, name: 'Synthesizers' },
              author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
            },
          ],
          nextBeforeId: null,
        },
      });
    });

    // Stale User A submission must NOT appear in the UI
    expect(container.textContent).not.toContain('Secret User A Submission');
    // UI should show the sign-in form because user signed out
    expect(container.textContent).toContain('Sign in to Blue Share');
  });

  it('discards stale owned results on Manage kind switching (T061)', async () => {
    let resolveInstruments: ((val: any) => void) | null = null;

    (window as any).blueAPI.listBlueShareMine = vi.fn().mockImplementation((_ctx, _reqId, kind) => {
      if (kind === 'instrument') {
        return new Promise((resolve) => {
          resolveInstruments = resolve;
        });
      } else if (kind === 'effect') {
        return Promise.resolve({
          ok: true,
          value: {
            items: [
              {
                kind: 'effect',
                id: 301,
                name: 'My Special Reverb',
                description: 'Spacious reverb effect',
                blueType: null,
                createdAt: '2026-01-15T12:00:00Z',
                category: { id: 20, name: 'Reverbs' },
                author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
              },
            ],
            nextBeforeId: null,
          },
        });
      }
      return Promise.resolve({ ok: true, value: { items: [], nextBeforeId: null } });
    });

    await openAndNavigateToManage();

    // Instrument request is pending
    expect(resolveInstruments).not.toBeNull();

    // Switch kind to Effects
    const effectsBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Effects',
    );
    expect(effectsBtn).toBeDefined();
    await act(async () => {
      effectsBtn!.click();
    });

    // Effects resolved immediately and should be displayed
    expect(container.textContent).toContain('My Special Reverb');

    // Now delayed Instrument results resolve
    await act(async () => {
      resolveInstruments!({
        ok: true,
        value: {
          items: [
            {
              kind: 'instrument',
              id: 101,
              name: 'Stale Instrument Synth',
              description: 'Late synth',
              blueType: 'blue.orchestra.GenericInstrument',
              createdAt: '2026-01-10T12:00:00Z',
              category: { id: 10, name: 'Synthesizers' },
              author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
            },
          ],
          nextBeforeId: null,
        },
      });
    });

    // The Manage view must still display My Special Reverb and must NOT display the stale instrument
    expect(container.textContent).toContain('My Special Reverb');
    expect(container.textContent).not.toContain('Stale Instrument Synth');
  });

  it('binds removal confirmation to the exact item and clears on kind switch, selection change, or close (T062)', async () => {
    let resolveRemove: ((val: any) => void) | null = null;
    (window as any).blueAPI.removeBlueShareResource = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveRemove = resolve;
      });
    });

    await openAndNavigateToManage();

    // 1. Select item 101 (Lead Synth)
    const row1 = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Lead Synth'),
    ) as HTMLTableRowElement;
    await act(async () => {
      row1.click();
    });

    // 2. Open confirmation dialog
    const removeBtn = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    await act(async () => {
      removeBtn.click();
    });

    // Confirmation dialog is open for Lead Synth
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(container.textContent).toContain('Are you sure you want to remove "Lead Synth"');

    // 3. Switch kind to Effects while confirmation is open -> must dismiss confirmation
    const effectsBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Effects',
    );
    await act(async () => {
      effectsBtn!.click();
    });

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();

    // 4. Switch back to Instruments, select Lead Synth, open confirmation again
    const instrumentsBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Instruments',
    );
    await act(async () => {
      instrumentsBtn!.click();
    });

    const row1Again = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Lead Synth'),
    ) as HTMLTableRowElement;
    await act(async () => {
      row1Again.click();
    });

    const removeBtnAgain = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    await act(async () => {
      removeBtnAgain.click();
    });
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

    // 5. Select row 2 (Sub Bass) while confirmation for Lead Synth was open -> must clear confirmation
    const row2 = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Sub Bass'),
    ) as HTMLTableRowElement;
    await act(async () => {
      row2.click();
    });
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();

    // 6. Open confirmation for Sub Bass, confirm removal (deferred), then close dialog
    const removeBtnSubBass = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    await act(async () => {
      removeBtnSubBass.click();
    });
    expect(container.textContent).toContain('Are you sure you want to remove "Sub Bass"');

    const confirmBtn = container.querySelector('[data-action-id="remove"]') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
    });

    // Removal is pending
    expect(resolveRemove).not.toBeNull();

    // Close modal
    const closeBtn = container.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    await act(async () => {
      closeBtn.click();
    });

    // Reopen dialog -> isRemoving must be reset to false
    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    await act(async () => {
      openBtn.click();
    });

    // Resolve deferred removal late
    await act(async () => {
      resolveRemove!({
        ok: true,
        value: { kind: 'instrument', id: 102, removed: true, alreadyRemoved: false },
      });
    });

    // Dialog state is clean
    expect(container.textContent).toContain('Blue Share');
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('proves that remove uncertainty cannot be bypassed by ordinary re-selection, blocks immediate second activation, and enables explicit retry when item remains present (T064)', async () => {
    (window as any).blueAPI.removeBlueShareResource.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'gateway_timeout',
        message: 'Timeout during removal',
        outcome: 'unknown',
        status: 504,
      },
    });

    await openAndNavigateToManage();

    // 1. Select Lead Synth
    const row1 = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Lead Synth'),
    ) as HTMLTableRowElement;
    await act(async () => {
      row1.click();
    });

    // 2. Open confirmation and confirm
    const removeBtn = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    await act(async () => {
      removeBtn.click();
    });

    const confirmBtn = container.querySelector('[data-action-id="remove"]') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
    });

    // 3. Removal returned uncertain outcome
    expect(container.textContent).toContain('Removal outcome is uncertain');

    // 4. Action button is disabled: immediate second activation blocked!
    const removeBtnAfter = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    expect(removeBtnAfter.disabled).toBe(true);

    // 5. Ordinary re-selection cannot bypass uncertainty
    const row2 = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Sub Bass'),
    ) as HTMLTableRowElement;
    await act(async () => {
      row2.click();
    });

    // Selected item is STILL Lead Synth (ordinary selection ignored during uncertainty)
    expect(container.textContent).toContain('Selected:');
    expect(container.textContent).toContain('Lead Synth');
    expect(container.textContent).toContain('Removal outcome is uncertain');

    // 6. Refresh submissions where item is STILL present
    (window as any).blueAPI.listBlueShareMine = vi.fn().mockResolvedValue({
      ok: true,
      value: { items: mockOwnedSubmissions, nextBeforeId: null },
    });

    const refreshBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Refresh submissions',
    );
    await act(async () => {
      refreshBtn!.click();
    });

    // Banner updates to indicate item still present and ready for retry
    expect(container.textContent).toContain('Submissions refreshed after uncertain removal');

    // Remove button now says "Retry Removal" and is ENABLED
    let retryRemoveBtn = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    expect(retryRemoveBtn).not.toBeNull();
    expect(retryRemoveBtn.disabled).toBe(false);
    expect(retryRemoveBtn.textContent).toContain('Retry Removal');

    // 7. Uncertainty and retry readiness preserved across tab changes
    const importTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Import',
    );
    await act(async () => {
      importTabBtn?.click();
    });

    const manageTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Manage',
    );
    await act(async () => {
      manageTabBtn?.click();
    });

    expect(container.textContent).toContain('Submissions refreshed after uncertain removal');
    expect(container.textContent).toContain('Lead Synth');
    retryRemoveBtn = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    expect(retryRemoveBtn.textContent).toContain('Retry Removal');
    expect(retryRemoveBtn.disabled).toBe(false);

    // 8. Explicit retry succeeds and refreshes affected views
    (window as any).blueAPI.removeBlueShareResource.mockResolvedValueOnce({
      ok: true,
      value: { kind: 'instrument', id: 101, removed: true, alreadyRemoved: false },
    });
    (window as any).blueAPI.listBlueShareMine = vi.fn().mockResolvedValue({
      ok: true,
      value: { items: [mockOwnedSubmissions[1]], nextBeforeId: null },
    });

    await act(async () => {
      retryRemoveBtn.click();
    });

    const confirmRetryBtn = container.querySelector(
      '[data-action-id="remove"]',
    ) as HTMLButtonElement;
    await act(async () => {
      confirmRetryBtn.click();
    });

    // Confirmed removal receipt shown
    expect(container.textContent).toContain('Resource successfully removed from Blue Share.');
    // View refreshed
    expect((window as any).blueAPI.listBlueShareMine).toHaveBeenCalled();
    expect((window as any).blueAPI.getBlueShareLatest).toHaveBeenCalled();
  });

  it('confirms absence and displays receipt when item is absent upon refresh after uncertain removal (T064)', async () => {
    (window as any).blueAPI.removeBlueShareResource.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'service_unavailable',
        message: 'Server error during removal',
        outcome: 'unknown',
        status: 503,
      },
    });

    await openAndNavigateToManage();

    // Select Lead Synth and remove
    const row1 = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Lead Synth'),
    ) as HTMLTableRowElement;
    await act(async () => {
      row1.click();
    });

    const removeBtn = container.querySelector(
      '[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    await act(async () => {
      removeBtn.click();
    });

    const confirmBtn = container.querySelector('[data-action-id="remove"]') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
    });

    expect(container.textContent).toContain('Removal outcome is uncertain');

    // Refresh returns items without Lead Synth (id: 101) - server DID remove it!
    (window as any).blueAPI.listBlueShareMine.mockResolvedValueOnce({
      ok: true,
      value: {
        items: [mockOwnedSubmissions[1]], // only Sub Bass
        nextBeforeId: null,
      },
    });

    const refreshBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Refresh submissions',
    );
    await act(async () => {
      refreshBtn!.click();
    });

    // Uncertainty banner is cleared and confirmed absence receipt is shown
    expect(container.textContent).not.toContain('Removal outcome is uncertain');
    expect(container.textContent).toContain('Resource was already removed from Blue Share.');
    expect(container.querySelector('tbody')?.textContent).not.toContain('Lead Synth');
    expect(container.querySelector('tbody')?.textContent).toContain('Sub Bass');
  });

  it('renders owned submissions error with retry and avoids empty state text on failure (T068)', async () => {
    (window as any).blueAPI.listBlueShareMine = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'service_error', message: 'Failed to retrieve submissions', status: 503 },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { items: mockOwnedSubmissions, nextBeforeId: null },
      });

    await openAndNavigateToManage();

    expect(container.textContent).toContain('Failed to retrieve submissions');
    expect(container.textContent).not.toContain('No submissions found for this kind.');

    // Click Retry
    const retryBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Retry',
    );
    expect(retryBtn).toBeDefined();
    await act(async () => {
      retryBtn!.click();
    });

    expect(window.blueAPI.listBlueShareMine).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Lead Synth');
    expect(container.textContent).not.toContain('Failed to retrieve submissions');
  });

  it('preserves existing owned items and displays error banner with retry on failed refresh (T068)', async () => {
    await openAndNavigateToManage();

    expect(container.textContent).toContain('Lead Synth');
    expect(container.textContent).toContain('Sub Bass');

    // Make next listBlueShareMine fail
    (window as any).blueAPI.listBlueShareMine = vi.fn().mockResolvedValueOnce({
      ok: false,
      error: { code: 'service_error', message: 'Mine refresh failed', status: 504 },
    });

    // Click Fetch submissions
    const fetchSubmissionsBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Fetch submissions',
    );
    expect(fetchSubmissionsBtn).toBeDefined();
    await act(async () => {
      fetchSubmissionsBtn!.click();
    });

    // Old submissions preserved in DOM
    expect(container.textContent).toContain('Lead Synth');
    expect(container.textContent).toContain('Sub Bass');

    // Error banner shown with Retry
    expect(container.textContent).toContain('Mine refresh failed');
    const retryBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Retry',
    );
    expect(retryBtn).toBeDefined();
  });

  it('supports keyboard operation for Fetch -> select -> Cancel / Remove with Escape dismissal (T069)', async () => {
    await openAndNavigateToManage();

    // 1. Fetch submissions via keyboard
    const fetchSubmissionsBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Fetch submissions',
    );
    expect(fetchSubmissionsBtn).toBeDefined();
    await act(async () => {
      fetchSubmissionsBtn!.focus();
      fetchSubmissionsBtn!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      fetchSubmissionsBtn!.click();
    });

    // 2. Select owned item using keyboard (Enter key)
    const row = Array.from(container.querySelectorAll('tr')).find((r) =>
      r.textContent?.includes('Lead Synth'),
    );
    expect(row).toBeDefined();
    expect(row!.getAttribute('tabIndex')).toBe('0');
    expect(row!.getAttribute('role')).toBe('button');
    expect(row!.getAttribute('aria-label')).toBe('Select Lead Synth');
    expect(row!.getAttribute('aria-selected')).toBe('false');

    await act(async () => {
      row!.focus();
      row!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(row!.getAttribute('aria-selected')).toBe('true');
    const removeBtn = container.querySelector(
      'button[data-testid="manage-remove-btn"]',
    ) as HTMLButtonElement;
    expect(removeBtn).toBeDefined();

    // 3. Open removal confirmation dialog via keyboard
    await act(async () => {
      removeBtn.focus();
      removeBtn.click();
    });

    expect(container.textContent).toContain('Are you sure you want to remove "Lead Synth"');

    // 4. Escape dismissal dismisses confirmation dialog without closing BlueShareDialog
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container.textContent).not.toContain('Are you sure you want to remove "Lead Synth"');
    // BlueShareDialog is still open and contains Lead Synth
    expect(container.textContent).toContain('Lead Synth');

    // 5. Open confirmation again and confirm removal
    await act(async () => {
      removeBtn.click();
    });
    expect(container.textContent).toContain('Are you sure you want to remove "Lead Synth"');

    const confirmRemoveActionBtn = container.querySelector(
      '[data-action-id="remove"]',
    ) as HTMLButtonElement;
    expect(confirmRemoveActionBtn).toBeDefined();

    await act(async () => {
      confirmRemoveActionBtn.click();
    });

    expect(window.blueAPI.removeBlueShareResource).toHaveBeenCalledWith(
      'ctx-test-manage',
      expect.any(String),
      expect.objectContaining({ kind: 'instrument', id: 101 }),
    );

    // Status receipt is rendered and announced
    const statusReceipt = container.querySelector('[role="status"]');
    expect(statusReceipt).toBeDefined();
    expect(statusReceipt?.textContent).toContain('Resource successfully removed from Blue Share.');
  });

  it('associates email and password inputs with labels and autoComplete in signed-out state (T069)', async () => {
    (window as any).blueAPI.openBlueShare = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        contextId: 'ctx-signed-out',
        serviceScope: 'https://blue3.kunstmusik.com',
        account: { state: 'signedOut' },
      },
    });
    (window as any).blueAPI.getBlueShareAccount = vi.fn().mockResolvedValue({
      ok: true,
      value: { state: 'signedOut' },
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

    const tabs = Array.from(container.querySelectorAll('button[role="tab"]'));
    const manageTab = tabs.find((b) => b.textContent?.trim() === 'Manage') as HTMLButtonElement;
    await act(async () => {
      manageTab.click();
    });

    const emailLabel = container.querySelector('label[for="blueshare-login-email"]');
    const emailInput = container.querySelector('input#blueshare-login-email') as HTMLInputElement;
    expect(emailLabel).toBeDefined();
    expect(emailInput).toBeDefined();
    expect(emailInput.type).toBe('email');
    expect(emailInput.getAttribute('autocomplete')).toBe('email');

    const passwordLabel = container.querySelector('label[for="blueshare-login-password"]');
    const passwordInput = container.querySelector(
      'input#blueshare-login-password',
    ) as HTMLInputElement;
    expect(passwordLabel).toBeDefined();
    expect(passwordInput).toBeDefined();
    expect(passwordInput.type).toBe('password');
    expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');
  });
});
