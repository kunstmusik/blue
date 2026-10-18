// @vitest-environment jsdom
import React, { act } from 'react';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { createBlueShareQueryClient } from '../components/blueshare/blueshare-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueShareDialog } from '../components/blueshare/BlueShareDialog';
import { useBlueShare } from '../components/blueshare/use-blueshare';
import type { ResourceSummary, AccountSessionSnapshot } from '../../shared/blueshare';

// Keep Query observer notifications inside React's async act boundary.
notifyManager.setScheduler(queueMicrotask);

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mockOwnedResources: readonly ResourceSummary[] = [
  {
    kind: 'instrument',
    id: 201,
    name: 'My Custom Synth',
    description: 'A synth owned by me',
    blueType: 'blue.orchestra.GenericInstrument',
    createdAt: '2026-10-17T14:00:00Z',
    category: { id: 1, name: 'Synthesizers' },
    author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
  },
  {
    kind: 'instrument',
    id: 202,
    name: 'My FM Organ',
    description: null,
    blueType: 'blue.orchestra.GenericInstrument',
    createdAt: '2026-10-17T15:00:00Z',
    category: { id: 1, name: 'Synthesizers' },
    author: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
  },
];

function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('BlueShare Account & Session UI (T024)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: ReturnType<typeof createBlueShareQueryClient>;
  let accountListener: ((snap: AccountSessionSnapshot) => void) | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = createBlueShareQueryClient();
    accountListener = null;

    (window as any).blueAPI = {
      openBlueShare: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          contextId: 'ctx-test-acc',
          serviceScope: 'https://blue3.kunstmusik.com',
          account: { state: 'signedOut', user: null, expiresAt: null, accountEpoch: 1 },
        },
      }),
      closeBlueShare: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      getBlueShareAccount: vi.fn().mockResolvedValue({
        ok: true,
        value: { state: 'signedOut', user: null, expiresAt: null, accountEpoch: 1 },
      }),
      signInBlueShare: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          state: 'signedIn',
          user: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
          expiresAt: '2026-10-18T14:00:00Z',
          accountEpoch: 2,
        },
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
      listBlueShareMine: vi.fn().mockResolvedValue({
        ok: true,
        value: { kind: 'instrument', items: mockOwnedResources, nextBeforeId: null },
      }),
      openBlueShareWebsite: vi.fn().mockResolvedValue({
        ok: true,
        value: { opened: true },
      }),
      getBlueShareCategories: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      getBlueShareLatest: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      listBlueShareResources: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      onBlueShareAccountChanged: vi.fn().mockImplementation((cb) => {
        accountListener = cb;
        return () => {
          accountListener = null;
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
    delete (window as any).blueAPI;
  });

  function TestHarness() {
    const state = useBlueShare();
    return (
      <div>
        <button id="open-btn" onClick={() => void state.open()}>
          Open
        </button>
        <BlueShareDialog state={state} />
      </div>
    );
  }

  it('displays sign-in form on Manage tab when signed out, with register/recover links', async () => {
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

    // Switch to Manage tab
    const manageTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Manage',
    );
    expect(manageTab).toBeDefined();

    await act(async () => {
      manageTab!.click();
    });

    // Verify sign in inputs and button are visible
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(emailInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();

    // Verify recovery and register links are present
    expect(container.textContent).toContain('Create an account');
    expect(container.textContent).toContain('Forgot password');
  });

  it('submits sign-in form, displays visible identity, and clears password from memory/form', async () => {
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

    // Switch to Manage tab
    const manageTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Manage',
    );
    await act(async () => {
      manageTab!.click();
    });

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const remember = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(remember.checked).toBe(false);
    await act(async () => remember.click());

    await act(async () => {
      setInputValue(emailInput, 'steven@example.com');
      setInputValue(passwordInput, 'secret123');
    });

    const submitBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Sign in',
    );
    expect(submitBtn).toBeDefined();

    await act(async () => {
      submitBtn!.click();
    });

    expect((window as any).blueAPI.signInBlueShare).toHaveBeenCalledWith(
      'ctx-test-acc',
      expect.any(String),
      'steven@example.com',
      'secret123',
      true,
    );

    // Verify identity is displayed
    expect(container.textContent).toContain('stevenyi');
    expect(container.textContent).toContain('Sign out');

    // Password input must be cleared or unmounted
    const passwordInputAfter = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    expect(passwordInputAfter).toBeNull();
  });

  it('fetches and displays owned resources on Manage tab when signed in', async () => {
    (window as any).blueAPI.openBlueShare = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        contextId: 'ctx-test-acc',
        serviceScope: 'https://blue3.kunstmusik.com',
        account: {
          state: 'signedIn',
          user: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
          expiresAt: '2026-10-18T14:00:00Z',
          accountEpoch: 2,
        },
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

    const manageTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Manage',
    );
    await act(async () => {
      manageTab!.click();
    });

    // Check Fetch submissions button
    const fetchBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Fetch') || b.textContent?.includes('Refresh'),
    );
    if (fetchBtn) {
      await act(async () => {
        fetchBtn.click();
      });
    }

    expect((window as any).blueAPI.listBlueShareMine).toHaveBeenCalled();
    expect(container.textContent).toContain('My Custom Synth');
    expect(container.textContent).toContain('My FM Organ');
  });

  it('signs out and resets to signed-out view when Sign out button is clicked', async () => {
    (window as any).blueAPI.openBlueShare = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        contextId: 'ctx-test-acc',
        serviceScope: 'https://blue3.kunstmusik.com',
        account: {
          state: 'signedIn',
          user: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
          expiresAt: '2026-10-18T14:00:00Z',
          accountEpoch: 2,
        },
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

    const manageTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Manage',
    );
    await act(async () => {
      manageTab!.click();
    });

    const signOutBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Sign out',
    );
    expect(signOutBtn).toBeDefined();

    await act(async () => {
      signOutBtn!.click();
    });

    expect((window as any).blueAPI.signOutBlueShare).toHaveBeenCalled();
    // After sign out, the sign in form is rendered again
    expect(container.querySelector('input[type="email"]')).not.toBeNull();
  });

  it('displays readable error message on sign-in failure (e.g. 401)', async () => {
    (window as any).blueAPI.signInBlueShare = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'invalid_credentials', message: 'Invalid email or password', status: 401 },
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

    const manageTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Manage',
    );
    await act(async () => {
      manageTab!.click();
    });

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(emailInput, 'steven@example.com');
      setInputValue(passwordInput, 'wrongpassword');
    });

    const submitBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Sign in',
    );
    await act(async () => {
      submitBtn!.click();
    });

    expect(container.textContent).toContain('Invalid email or password');
  });

  it('updates state reactively when onBlueShareAccountChanged fires', async () => {
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

    expect(accountListener).not.toBeNull();

    // Fire event transitioning to signedIn
    await act(async () => {
      accountListener!({
        state: 'signedIn',
        user: { id: 'u9', name: 'External Sign In', username: 'extern' },
        expiresAt: '2026-10-18T20:00:00Z',
        accountEpoch: 3,
      });
    });

    // Switch to Manage tab
    const manageTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Manage',
    );
    await act(async () => {
      manageTab!.click();
    });

    expect(container.textContent).toContain('extern');
  });

  it('surfaces remoteRevocationConfirmed === false warning when offline logout occurs (T064)', async () => {
    // Initial state: signed in
    (window as any).blueAPI.openBlueShare.mockResolvedValueOnce({
      ok: true,
      value: {
        contextId: 'ctx-test-acc',
        serviceScope: 'https://blue3.kunstmusik.com',
        account: {
          state: 'signedIn',
          user: { id: 'u1', name: 'Steven Yi', username: 'stevenyi' },
          expiresAt: '2026-10-18T14:00:00Z',
          accountEpoch: 2,
        },
      },
    });

    window.blueAPI.getBlueShareAccount = vi.fn().mockResolvedValue({
      ok: true,
      value: { state: 'signedOut', user: null, expiresAt: null, accountEpoch: 3 },
    });
    (window as any).blueAPI.signOutBlueShare.mockResolvedValueOnce({
      ok: true,
      value: {
        signedOut: true,
        remoteRevocationConfirmed: false,
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

    // Switch to Manage tab
    const manageTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Manage',
    );
    await act(async () => {
      manageTab!.click();
    });

    expect(container.textContent).toContain('stevenyi');

    // Click Sign out
    const signOutBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Sign out',
    );
    expect(signOutBtn).toBeDefined();
    await act(async () => {
      signOutBtn!.click();
    });

    // Warning notice must be displayed in the login view
    const warning = container.querySelector('[data-testid="remote-revocation-warning"]');
    expect(warning).not.toBeNull();
    expect(warning?.textContent).toContain(
      'Signed out locally, but remote session revocation could not be confirmed with the server.',
    );
    expect(container.textContent).toContain('Sign in to Blue Share');
  });
  it('offers a focusable offline forget action while public browsing remains available', async () => {
    const unavailable = {
      state: 'unavailable' as const,
      user: null,
      expiresAt: null,
      accountEpoch: 2,
      persistenceWarning: 'Saved sign-in could not be verified.',
    };
    vi.mocked(window.blueAPI.openBlueShare).mockResolvedValueOnce({
      ok: true,
      value: {
        contextId: 'ctx-test-acc',
        serviceScope: 'https://blue3.kunstmusik.com',
        account: unavailable,
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
      (container.querySelector('#open-btn') as HTMLButtonElement).click();
    });
    expect(window.blueAPI.getBlueShareLatest).toHaveBeenCalled();
    expect(window.blueAPI.listBlueShareMine).not.toHaveBeenCalled();
    const forget = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Forget saved sign-in',
    )!;
    expect(forget).toBeDefined();
    forget.focus();
    expect(document.activeElement).toBe(forget);
    await act(async () => {
      forget.click();
    });
    expect(window.blueAPI.signOutBlueShare).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('Forget saved sign-in');
    expect(window.blueAPI.signInBlueShare).not.toHaveBeenCalled();
  });
});
