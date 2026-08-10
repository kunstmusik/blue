// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCodeRepositoryStore } from '../../../../stores/code-repository-store';
import CodeRepositoryEditorModal from './CodeRepositoryEditorModal';

describe('CodeRepositoryEditorModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useCodeRepositoryStore.setState({
      snapshot: null,
      expectedRevision: 0,
      loading: false,
      initialized: false,
      loadError: null,
      conflict: null,
      status: null,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (globalThis as { blueAPI?: unknown }).blueAPI;
  });

  it('shows a recoverable error when the menu opens but the snapshot load fails', async () => {
    (globalThis as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      getCodeRepositorySnapshot: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'storage-unavailable' as const,
          message: 'Repository database could not be opened',
          retryable: true,
        },
      })),
    };
    act(() => root.render(<CodeRepositoryEditorModal />));

    await act(async () => {
      window.dispatchEvent(new CustomEvent('blue-open-code-repository-editor'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Code Repository Editor');
    expect(document.body.textContent).toContain('Repository database could not be opened');
    expect(document.body.textContent).toContain('Retry');
    expect(document.body.textContent).toContain('Recover from XML…');
  });

  it('opens the real editor dialog from the Tools-menu event when storage is available', async () => {
    const snapshot = {
      root: {
        id: '00000000-0000-4000-8000-000000000001',
        kind: 'root' as const,
        name: 'Code Repository',
        parentId: null,
        order: 0,
        children: [],
      },
      contentRevision: 0,
      initialized: true,
    };
    (globalThis as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      getCodeRepositorySnapshot: vi.fn(async () => ({ ok: true as const, value: snapshot })),
      getCodeRepositoryStatus: vi.fn(async () => ({
        available: true,
        migrationStatus: 'skipped' as const,
      })),
      getProgramSettings: vi.fn(async () => ({
        general: { newUserDefaultsEnabled: true },
      })),
    };
    act(() => root.render(<CodeRepositoryEditorModal />));

    await act(async () => {
      window.dispatchEvent(new CustomEvent('blue-open-code-repository-editor'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Code Repository Editor');
    expect(document.body.textContent).toContain('Code Repository');
    expect(document.body.textContent).toContain('Save');
  });

  it('exposes the migration retry from the real Tools-menu dialog', async () => {
    const snapshot = {
      root: {
        id: '00000000-0000-4000-8000-000000000001',
        kind: 'root' as const,
        name: 'Code Repository',
        parentId: null,
        order: 0,
        children: [],
      },
      contentRevision: 0,
      initialized: true,
    };
    const migratedSnapshot = {
      ...snapshot,
      contentRevision: 1,
      root: {
        ...snapshot.root,
        children: [
          {
            id: 'migrated-group',
            kind: 'group' as const,
            name: 'Migrated Group',
            parentId: snapshot.root.id,
            order: 0,
            children: [],
          },
        ],
      },
    };
    let migrationFailed = true;
    const retryCodeRepository = vi.fn(async () => {
      migrationFailed = false;
      return {
        ok: true as const,
        value: { available: true, migrationStatus: 'succeeded' as const },
      };
    });
    (globalThis as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      getCodeRepositorySnapshot: vi.fn(async () => ({
        ok: true as const,
        value: migrationFailed ? snapshot : migratedSnapshot,
      })),
      getCodeRepositoryStatus: vi.fn(async () => ({
        available: true,
        migrationStatus: migrationFailed ? ('failed' as const) : ('succeeded' as const),
        ...(migrationFailed
          ? {
              diagnostic: {
                code: 'migration-interrupted' as const,
                message: 'Code Repository migration was interrupted. Retry to continue.',
              },
            }
          : {}),
      })),
      retryCodeRepository,
      getProgramSettings: vi.fn(async () => ({
        general: { newUserDefaultsEnabled: true },
      })),
    };
    act(() => root.render(<CodeRepositoryEditorModal />));

    await act(async () => {
      window.dispatchEvent(new CustomEvent('blue-open-code-repository-editor'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Retry Migration');
    await act(async () => {
      const retryButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent === 'Retry Migration',
      );
      expect(retryButton).toBeTruthy();
      retryButton!.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(retryCodeRepository).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain('Retry Migration');
    expect(document.body.textContent).toContain('Migrated Group');
  });
});
