// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlueShareQueryClient } from '../components/blueshare/blueshare-query';
import { BlueShareDialog } from '../components/blueshare/BlueShareDialog';
import { useBlueShare } from '../components/blueshare/use-blueshare';
import type { AccountSessionSnapshot } from '../../shared/blueshare';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
notifyManager.setScheduler(queueMicrotask);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const account: AccountSessionSnapshot = {
  state: 'signedIn',
  user: { id: 'u1', name: 'Synthetic', username: 'synthetic' },
  expiresAt: null,
  accountEpoch: 1,
};
const resource = {
  kind: 'instrument' as const,
  id: 1,
  name: 'Synthetic',
  description: null,
  blueType: 'blue.orchestra.GenericInstrument',
  createdAt: null,
  category: { id: 1, name: 'Synthetic' },
  author: account.user!,
};
const node = {
  nodeId: 'n1',
  key: { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'n1' },
  libraryType: 'instrument' as const,
  scope: 'user' as const,
  nodeKind: 'item' as const,
  displayName: 'Synthetic',
  parentId: null,
  breadcrumb: [],
  revision: 1,
  hasChildren: false,
};

describe('Query workflow lifetime (T077–T079/T084)', () => {
  let root: Root, container: HTMLDivElement;
  let client: ReturnType<typeof createBlueShareQueryClient>;
  let state: ReturnType<typeof useBlueShare>;
  let listener: (snapshot: AccountSessionSnapshot) => void;
  function Harness() {
    state = useBlueShare();
    return <BlueShareDialog state={state} />;
  }
  beforeEach(async () => {
    client = createBlueShareQueryClient();
    container = document.createElement('div');
    root = createRoot(container);
    (window as any).blueAPI = {
      openBlueShare: vi.fn().mockResolvedValue({
        ok: true,
        value: { contextId: 'ctx', serviceScope: 'https://synthetic.invalid', account },
      }),
      closeBlueShare: vi.fn(),
      getBlueShareAccount: vi.fn().mockResolvedValue({ ok: true, value: account }),
      onBlueShareAccountChanged: vi.fn((cb) => {
        listener = cb;
        return vi.fn();
      }),
      getBlueShareCategories: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      getBlueShareLatest: vi.fn().mockResolvedValue({ ok: true, value: { items: [resource] } }),
      getBlueShareResource: vi.fn().mockResolvedValue({ ok: true, value: resource }),
      listBlueShareMine: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { items: [resource], nextBeforeId: null } }),
      browseLibraries: vi.fn().mockResolvedValue({
        ok: true,
        value: { children: [node], nextCursor: null, contentRevision: 1 },
      }),
      prepareBlueSharePublish: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          sourceToken: 'source-one',
          kind: 'instrument',
          name: 'Synthetic',
          blueType: resource.blueType,
          descriptionSeed: 'Seed',
          byteLength: 1,
        },
      }),
      resetBlueSharePublish: vi.fn().mockResolvedValue({ ok: true, value: { cleared: true } }),
      publishBlueShareResource: vi.fn().mockResolvedValue({ ok: true, value: resource }),
    };
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await state.open();
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
  });
  async function prepare() {
    await act(async () => state.setTab('export'));
    await act(async () => {
      await state.selectLibraryItemForExport(node);
      state.setExportCategoryId(1);
      state.setExportDescription('  exact\n  draft  ');
    });
  }
  it('releases a pending import after selection navigation without enabling duplicate dispatch', async () => {
    const pending = deferred<any>();
    (window.blueAPI as any).importBlueShareResource = vi.fn(() => pending.promise);
    await act(async () => state.selectResource({ kind: 'instrument', id: 1 }));
    let operation!: Promise<void>;
    await act(async () => {
      operation = state.importCurrentResource();
    });
    await act(async () => state.selectCategory(2));
    expect(state.isImporting).toBe(true);
    await act(async () => {
      pending.resolve({ ok: true, value: { contentRevision: 1, affectedNodes: [] } });
      await operation;
    });
    expect(state.isImporting).toBe(false);
    expect(state.importReceipt).toBeNull();
    expect(window.blueAPI.importBlueShareResource).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])(
    'keeps removal observed across selection until settlement (success=%s)',
    async (ok) => {
      const pending = deferred<any>();
      (window.blueAPI as any).removeBlueShareResource = vi.fn(() => pending.promise);
      await act(async () => state.setTab('manage'));
      await act(async () => state.selectOwnedResource({ kind: 'instrument', id: 1 }));
      let operation!: Promise<boolean>;
      await act(async () => {
        operation = state.removeOwnedResource({ kind: 'instrument', id: 1 });
      });
      await act(async () => state.selectOwnedResource({ kind: 'instrument', id: 2 }));
      expect(state.isRemoving).toBe(true);
      await act(async () => {
        await state.removeOwnedResource({ kind: 'instrument', id: 2 });
      });
      expect(window.blueAPI.removeBlueShareResource).toHaveBeenCalledTimes(1);
      await act(async () => {
        pending.resolve(
          ok
            ? {
                ok: true,
                value: { kind: 'instrument', id: 1, removed: true, alreadyRemoved: false },
              }
            : { ok: false, error: { code: 'forbidden', message: 'Denied', outcome: 'rejected' } },
        );
        await operation;
      });
      expect(state.isRemoving).toBe(false);
      expect(state.selectedOwnedKey).toEqual({ kind: 'instrument', id: 2 });
      expect(state.removeError).toBeNull();
      expect(state.removeReceipt).toBeNull();
    },
  );
  it.each(['success', 'rejected', 'unknown'])(
    'fences publication across kind navigation (%s)',
    async (outcome) => {
      await prepare();
      const pending = deferred<any>();
      (window.blueAPI as any).publishBlueShareResource = vi.fn(() => pending.promise);
      let operation!: Promise<boolean>;
      await act(async () => {
        operation = state.publishExport();
      });
      await act(async () => state.setGroup('effect'));
      expect(state.isPublishing).toBe(false);
      await act(async () => state.setExportDescription('Effect draft'));
      await act(async () => {
        pending.resolve(
          outcome === 'success'
            ? { ok: true, value: resource }
            : {
                ok: false,
                error: { code: 'network_error', message: 'Instrument failed', outcome },
              },
        );
        await operation;
      });
      expect(state.publishUncertain).toBe(false);
      expect(state.publishError).toBeNull();
      expect(state.publishReceipt).toBeNull();
      expect(state.exportDescription).toBe('Effect draft');
      await act(async () => state.setGroup('instrument'));
      expect(state.publishUncertain).toBe(outcome === 'unknown');
      if (outcome !== 'success') expect(state.exportDescription).toBe('  exact\n  draft  ');
      if (outcome === 'unknown') {
        await act(async () => state.setTab('manage'));
        await act(async () => {
          await state.fetchMine();
        });
        expect(state.canRetryPublish).toBe(true);
      }
      expect(window.blueAPI.publishBlueShareResource).toHaveBeenCalledTimes(1);
    },
  );
  it('keeps uncertain removal on the originating kind through navigation and recovery', async () => {
    const pending = deferred<any>();
    (window.blueAPI as any).removeBlueShareResource = vi.fn(() => pending.promise);
    await act(async () => state.setTab('manage'));
    await act(async () => state.selectOwnedResource({ kind: 'instrument', id: 1 }));
    let operation!: Promise<boolean>;
    await act(async () => {
      operation = state.removeOwnedResource({ kind: 'instrument', id: 1 });
    });
    await act(async () => state.setGroup('effect'));
    await act(async () => state.selectOwnedResource({ kind: 'effect', id: 2 }));
    await act(async () => {
      pending.resolve({
        ok: false,
        error: { code: 'network_error', message: 'Instrument unknown', outcome: 'unknown' },
      });
      await operation;
    });
    expect(state.removeUncertain).toBe(false);
    expect(state.removeError).toBeNull();
    expect(state.selectedOwnedKey).toEqual({ kind: 'effect', id: 2 });
    await act(async () => {
      await state.fetchMine();
    });
    await act(async () => state.setGroup('instrument'));
    expect(state.removeUncertain).toBe(true);
    expect(state.canRetryRemove).toBe(false);
    expect(state.selectedOwnedKey).toEqual({ kind: 'instrument', id: 1 });
    await act(async () => {
      await state.fetchMine();
    });
    expect(state.canRetryRemove).toBe(true);
    expect(window.blueAPI.removeBlueShareResource).toHaveBeenCalledTimes(1);
  });
  it.each(['success', 'rejected'])(
    'keeps removal settlement on its original kind (%s)',
    async (outcome) => {
      const pending = deferred<any>();
      (window.blueAPI as any).removeBlueShareResource = vi.fn(() => pending.promise);
      await act(async () => state.setTab('manage'));
      await act(async () => state.selectOwnedResource({ kind: 'instrument', id: 1 }));
      let operation!: Promise<boolean>;
      await act(async () => {
        operation = state.removeOwnedResource({ kind: 'instrument', id: 1 });
      });
      await act(async () => state.setGroup('effect'));
      await act(async () => state.selectOwnedResource({ kind: 'effect', id: 2 }));
      await act(async () => {
        pending.resolve(
          outcome === 'success'
            ? {
                ok: true,
                value: { kind: 'instrument', id: 1, removed: true, alreadyRemoved: false },
              }
            : {
                ok: false,
                error: { code: 'forbidden', message: 'Instrument denied', outcome: 'rejected' },
              },
        );
        await operation;
      });
      expect(state.selectedOwnedKey).toEqual({ kind: 'effect', id: 2 });
      expect(state.removeError).toBeNull();
      expect(state.removeReceipt).toBeNull();
      await act(async () => state.setGroup('instrument'));
      expect(state.selectedOwnedKey).toEqual(
        outcome === 'success' ? null : { kind: 'instrument', id: 1 },
      );
      if (outcome === 'rejected') expect(state.removeError).toBe('Instrument denied');
    },
  );
  it('retains an uncertain submitted draft separately from a newer editable draft', async () => {
    await prepare();
    const pending = deferred<any>();
    (window.blueAPI as any).publishBlueShareResource = vi.fn(() => pending.promise);
    let operation!: Promise<boolean>;
    await act(async () => {
      operation = state.publishExport();
    });
    await act(async () => state.setExportDescription('newer edit'));
    await act(async () => {
      pending.resolve({
        ok: false,
        error: { code: 'network_error', message: 'Unknown', outcome: 'unknown' },
      });
      await operation;
    });
    expect(state.exportDescription).toBe('newer edit');
    await act(async () => state.setTab('manage'));
    await act(async () => {
      await state.fetchMine();
    });
    await act(async () => state.restoreUncertainPublishDraft());
    expect(state.exportDescription).toBe('  exact\n  draft  ');
    expect(state.exportSourceSeed).toBeNull();
    expect(window.blueAPI.publishBlueShareResource).toHaveBeenCalledTimes(1);
  });
  it.each(['signedOut', 'replacement'])(
    'does not regress an account event when open resolves late (%s)',
    async (mode) => {
      await act(async () => state.close());
      const pending = deferred<any>();
      (window.blueAPI as any).openBlueShare = vi.fn(() => pending.promise);
      let opening!: Promise<void>;
      await act(async () => {
        opening = state.open();
      });
      const newer: AccountSessionSnapshot =
        mode === 'signedOut'
          ? { state: 'signedOut', user: null, expiresAt: null, accountEpoch: 5 }
          : { ...account, user: { id: 'u2', name: 'New', username: 'new' }, accountEpoch: 5 };
      await act(async () => listener(newer));
      await act(async () => {
        pending.resolve({
          ok: true,
          value: { contextId: 'late-ctx', serviceScope: 'https://synthetic.invalid', account },
        });
        await opening;
      });
      expect(state.account).toEqual(newer);
      await act(async () => state.close());
      (window.blueAPI as any).openBlueShare = vi.fn().mockResolvedValue({
        ok: true,
        value: {
          contextId: 'reopen',
          serviceScope: 'https://synthetic.invalid',
          account: { ...newer, accountEpoch: 6 },
        },
      });
      await act(async () => {
        await state.open();
      });
      expect(state.account.accountEpoch).toBe(6);
      expect(state.account.user).toEqual(newer.user);
    },
  );
  it.each(['library', 'preparation'])(
    'recovers a stalled local %s after 30 seconds without accepting its late result',
    async (phase) => {
      vi.useFakeTimers();
      try {
        const pending = deferred<any>();
        if (phase === 'library')
          (window.blueAPI as any).browseLibraries = vi.fn(() => pending.promise);
        else (window.blueAPI as any).prepareBlueSharePublish = vi.fn(() => pending.promise);
        await act(async () => state.setTab('export'));
        let operation: Promise<void> | undefined;
        if (phase === 'preparation')
          await act(async () => {
            operation = state.selectLibraryItemForExport(node);
            state.setExportDescription('keep exact');
          });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30001);
        });
        expect(phase === 'library' ? state.loadingLibraryItems : state.isPreparingPublish).toBe(
          false,
        );
        expect(phase === 'library' ? state.userLibraryError : state.publishError).toMatch(
          /timed out/i,
        );
        await act(async () => {
          pending.resolve(
            phase === 'library'
              ? { ok: true, value: { children: [node], nextCursor: null, contentRevision: 1 } }
              : { ok: true, value: { sourceToken: 'late', descriptionSeed: 'late' } },
          );
          await operation;
        });
        expect(state.exportSourceSeed).toBeNull();
        if (phase === 'preparation') expect(state.exportDescription).toBe('keep exact');
        else expect(state.userLibraryItems).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it('times out unanswered initialization and closes a context returned after recovery (T093)', async () => {
    await act(async () => state.close());
    const pending = deferred<any>();
    (window.blueAPI as any).openBlueShare = vi.fn(() => pending.promise);
    vi.useFakeTimers();
    try {
      let opening!: Promise<void>;
      await act(async () => {
        opening = state.open();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30001);
      });
      expect(state.isOpening).toBe(false);
      expect(state.initializationFailed).toBe(true);
      expect(state.error).toMatch(/timed out/i);
      await act(async () => {
        pending.resolve({
          ok: true,
          value: {
            contextId: 'late-after-timeout',
            serviceScope: 'https://synthetic.invalid',
            account,
          },
        });
        await opening;
      });
      expect(state.contextId).toBeNull();
      expect(window.blueAPI.closeBlueShare).toHaveBeenCalledWith('late-after-timeout');
    } finally {
      vi.useRealTimers();
    }
  });
  it('shows opening feedback, recovery on initialization failure and successful empty results only', async () => {
    await act(async () => state.close());
    const pending = deferred<any>();
    (window.blueAPI as any).openBlueShare = vi.fn(() => pending.promise);
    let opening!: Promise<void>;
    await act(async () => {
      opening = state.open();
    });
    expect(container.textContent).toContain('Opening Blue Share');
    expect(container.textContent).not.toMatch(/No categories|No resources|No submissions|No items/);
    expect(state.loadingCategories).toBe(false);
    await act(async () => {
      pending.resolve({
        ok: false,
        error: { code: 'unavailable', message: 'Initialization failed', outcome: 'rejected' },
      });
      await opening;
    });
    expect(container.textContent).toContain('Retry opening');
    expect(container.textContent).not.toMatch(/No categories|No resources/);
    (window.blueAPI as any).openBlueShare = vi.fn().mockResolvedValue({
      ok: true,
      value: { contextId: 'retry', serviceScope: 'https://synthetic.invalid', account },
    });
    const retry = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Retry opening',
    )!;
    await act(async () => retry.click());
    expect(container.textContent).toContain('No categories available.');
    expect(container.textContent).not.toContain('Opening Blue Share');
    await act(async () => state.setTab('manage'));
    await act(async () => state.close());
    const reopening = deferred<any>();
    (window.blueAPI as any).openBlueShare = vi.fn(() => reopening.promise);
    await act(async () => {
      void state.open();
    });
    expect(container.textContent).toContain('Opening Blue Share');
    expect(container.textContent).not.toContain('No submissions');
    await act(async () =>
      reopening.resolve({
        ok: true,
        value: { contextId: 'last', serviceScope: 'https://synthetic.invalid', account },
      }),
    );
  });
  it('preserves exact reviewed fields on expiry, removes private caches and requires renewed review', async () => {
    await prepare();
    await act(async () =>
      listener({ state: 'signedOut', user: null, expiresAt: null, accountEpoch: 2 }),
    );
    expect(state.exportDescription).toBe('  exact\n  draft  ');
    expect(state.exportSelectedKey).toEqual(node.key);
    expect(state.exportCategoryId).toBe(1);
    expect(state.exportSourceSeed).toBeNull();
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((q) => q.queryKey[3] !== 'mine' || q.queryKey[7] === 2),
    ).toBe(true);
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((m) => m.state),
      ),
    ).not.toContain('source-one');
  });
  it('keeps a newer draft when an older publication settles', async () => {
    await prepare();
    const pending = deferred<any>();
    (window.blueAPI as any).publishBlueShareResource = vi.fn(() => pending.promise);
    let operation!: Promise<boolean>;
    await act(async () => {
      operation = state.publishExport();
    });
    await act(async () => state.setExportDescription('newer draft'));
    await act(async () => {
      pending.resolve({ ok: true, value: resource });
      await operation;
    });
    expect(state.exportDescription).toBe('newer draft');
    expect(state.exportSourceSeed).toBeNull();
    const variables = client
      .getMutationCache()
      .getAll()
      .find((m) => (m.state.variables as any)?.token)?.state.variables as any;
    expect(variables.description).toBe('  exact\n  draft  ');
  });
  it('does not cache credentials or raw IPC exceptions and clears late reads/writes on close', async () => {
    (window.blueAPI as any).signInBlueShare = vi
      .fn()
      .mockResolvedValue({ ok: true, value: { ...account, accountEpoch: 2 } });
    (window.blueAPI as any).getBlueShareAccount = vi
      .fn()
      .mockResolvedValue({ ok: true, value: { ...account, accountEpoch: 2 } });
    await act(async () => {
      await state.signIn('secret-address@example.com', 'secret-password');
    });
    expect(
      JSON.stringify([
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state),
        client
          .getMutationCache()
          .getAll()
          .map((m) => m.state),
      ]),
    ).not.toMatch(/secret-address|secret-password/);
    await prepare();
    const pending = deferred<any>();
    (window.blueAPI as any).publishBlueShareResource = vi.fn(() => pending.promise);
    let operation!: Promise<boolean>;
    await act(async () => {
      operation = state.publishExport();
    });
    await act(async () => state.close());
    await act(async () => {
      pending.resolve({ ok: true, value: resource });
      await operation;
    });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(state.exportSourceSeed).toBeNull();
    expect(state.exportDescription).toBe('');
  });

  it('preserves a draft through publish 401 and failed reauthentication, including blank text', async () => {
    await prepare();
    (window.blueAPI as any).publishBlueShareResource = vi.fn(async () => {
      listener({ state: 'signedOut', user: null, expiresAt: null, accountEpoch: 2 });
      return {
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'Session expired',
          status: 401,
          outcome: 'rejected',
        },
      };
    });
    await act(async () => {
      await state.publishExport();
    });
    expect(state.exportDescription).toBe('  exact\n  draft  ');
    expect(state.exportSelectedKey).toEqual(node.key);
    (window.blueAPI as any).signInBlueShare = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'invalid_credentials', message: 'Sign-in failed' },
    });
    for (const text of ['', '  \n ']) {
      await act(async () => {
        state.setExportDescription(text);
      });
      await act(async () => {
        await state.signIn('synthetic@example.invalid', 'synthetic-password');
      });
      expect(state.exportDescription).toBe(text);
      expect(state.exportSourceSeed).toBeNull();
    }
  });
  it('drops a preparation that finishes after expiry or explicit reset', async () => {
    await act(async () => state.setTab('export'));
    const pending = deferred<any>();
    (window.blueAPI as any).prepareBlueSharePublish = vi.fn(() => pending.promise);
    let preparation!: Promise<void>;
    await act(async () => {
      preparation = state.selectLibraryItemForExport(node);
      state.setExportDescription('preserve');
    });
    await act(async () =>
      listener({ state: 'signedOut', user: null, expiresAt: null, accountEpoch: 2 }),
    );
    await act(async () => {
      pending.resolve({
        ok: true,
        value: {
          sourceToken: 'late-token',
          name: 'Late',
          kind: 'instrument',
          blueType: resource.blueType,
          descriptionSeed: 'overwrite',
          byteLength: 1,
        },
      });
      await preparation;
    });
    expect(state.exportDescription).toBe('preserve');
    expect(state.exportSourceSeed).toBeNull();
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((m) => m.state),
      ),
    ).not.toContain('late-token');
  });
  it('keeps the main-owned newer account when an older logout reply arrives', async () => {
    const pending = deferred<any>();
    (window.blueAPI as any).signOutBlueShare = vi.fn(() => pending.promise);
    let logout!: Promise<boolean>;
    await act(async () => {
      logout = state.signOut();
    });
    const newer = { ...account, user: { id: 'u2', name: 'New', username: 'new' }, accountEpoch: 4 };
    (window.blueAPI as any).getBlueShareAccount = vi
      .fn()
      .mockResolvedValue({ ok: true, value: newer });
    await act(async () => listener(newer));
    await act(async () => {
      pending.resolve({ ok: true, value: { signedOut: true, remoteRevocationConfirmed: false } });
      await logout;
    });
    expect(state.account).toEqual(newer);
    expect(state.remoteRevocationConfirmed).toBeNull();
  });
  it('keeps page-two targets uncertain after page one and resolves only after complete traversal', async () => {
    const pages = Array.from({ length: 26 }, (_, index) => ({
      ...resource,
      id: 26 - index,
      name: `Synthetic ${26 - index}`,
    }));
    (window.blueAPI as any).listBlueShareMine = vi.fn(async (_ctx, _id, _kind, before) => ({
      ok: true,
      value:
        before == null
          ? { items: pages.slice(0, 25), nextBeforeId: 2 }
          : { items: [], nextBeforeId: null },
    }));
    (window.blueAPI as any).removeBlueShareResource = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'network_error', message: 'Unknown', outcome: 'unknown' },
    });
    await act(async () => state.setTab('manage'));
    await act(async () => state.selectOwnedResource({ kind: 'instrument', id: 1 }));
    await act(async () => {
      await state.removeOwnedResource({ kind: 'instrument', id: 1 });
    });
    await act(async () => {
      await state.fetchMine();
    });
    expect(state.ownedResources).toHaveLength(25);
    expect(state.removeUncertain).toBe(true);
    expect(state.removeReceipt).toBeNull();
    expect(state.canRetryRemove).toBe(false);
    await act(async () => {
      await state.loadMoreMine();
    });
    expect(state.removeUncertain).toBe(false);
    expect(state.removeReceipt).toEqual({
      kind: 'instrument',
      id: 1,
      removed: true,
      alreadyRemoved: true,
    });
  });
  it('keeps public queries usable during restoration and accepts checked identity events', async () => {
    await act(async () => state.close());
    const unavailable = {
      state: 'unavailable' as const,
      user: null,
      expiresAt: null,
      accountEpoch: 2,
    };
    vi.mocked(window.blueAPI.openBlueShare).mockResolvedValueOnce({
      ok: true,
      value: {
        contextId: 'restoring',
        serviceScope: 'https://synthetic.invalid',
        account: unavailable,
      },
    });
    vi.mocked(window.blueAPI.getBlueShareLatest).mockClear();
    vi.mocked(window.blueAPI.listBlueShareMine).mockClear();
    await act(async () => state.open());
    expect(state.isOpening).toBe(false);
    expect(window.blueAPI.getBlueShareLatest).toHaveBeenCalled();
    expect(window.blueAPI.listBlueShareMine).not.toHaveBeenCalled();
    (window.blueAPI as any).importBlueShareResource = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        destination: { libraryType: 'instrument', parentId: null },
        nodeId: 'imported',
        contentRevision: 2,
      },
    });
    await act(async () => state.selectResource({ kind: 'instrument', id: 1 }));
    await act(async () => state.importCurrentResource());
    expect(window.blueAPI.importBlueShareResource).toHaveBeenCalledOnce();
    await act(async () => listener({ ...account, accountEpoch: 2 }));
    expect(state.account.state).toBe('signedIn');
    await act(async () => state.close());
    await act(async () => listener({ ...account, accountEpoch: 3 }));
    expect(state.isOpen).toBe(false);
  });

  it('does not overwrite a checked restore event with the older OPEN snapshot', async () => {
    await act(async () => state.close());
    const pending = deferred<any>();
    vi.mocked(window.blueAPI.openBlueShare).mockReturnValueOnce(pending.promise);
    let opening!: Promise<void>;
    await act(async () => {
      opening = state.open();
    });
    await act(async () => listener({ ...account, accountEpoch: 4 }));
    await act(async () => {
      pending.resolve({
        ok: true,
        value: {
          contextId: 'restoring',
          serviceScope: 'https://synthetic.invalid',
          account: { state: 'unavailable', user: null, expiresAt: null, accountEpoch: 4 },
        },
      });
      await opening;
    });
    expect(state.account.state).toBe('signedIn');
  });

  it.each(['signIn', 'signOut'] as const)(
    'recovers the %s observer after unanswered IPC without replay',
    async (operation) => {
      const pending = deferred<any>();
      const api = operation === 'signIn' ? 'signInBlueShare' : 'signOutBlueShare';
      (window.blueAPI as any)[api] = vi.fn(() => pending.promise);
      vi.useFakeTimers();
      try {
        let result!: Promise<boolean>;
        await act(async () => {
          result =
            operation === 'signIn'
              ? state.signIn('synthetic@example.invalid', 'secret', true)
              : state.signOut();
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30_001);
        });
        expect(await result).toBe(false);
        expect(state.isSigningIn).toBe(false);
        expect(state.isSigningOut).toBe(false);
        await act(async () => {
          pending.resolve({ ok: true, value: { ...account, accountEpoch: 99 } });
        });
        expect(state.account.accountEpoch).not.toBe(99);
        expect(window.blueAPI[api]).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    },
  );
});
