// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CODE_REPOSITORY_ROOT_ID, type CodeRepositoryNode } from '@blue/data';
import CodeRepositoryDialog from './CodeRepositoryDialog';

// This guard covers gross regressions while allowing for React/jsdom cold-start
// and shared-suite scheduling overhead; isolated runs remain substantially faster.
const FIVE_HUNDRED_NODE_RENDER_GUARD_MS = 2_000;

vi.mock('./CodeRepositorySnippetEditor', () => ({
  default: () => <div>Snippet editor</div>,
}));

function makeRoot(name = 'Group'): CodeRepositoryNode {
  return {
    id: CODE_REPOSITORY_ROOT_ID,
    kind: 'root',
    name: 'Code Repository',
    parentId: null,
    order: 0,
    children: [
      {
        id: 'group-1',
        kind: 'group',
        name,
        parentId: CODE_REPOSITORY_ROOT_ID,
        order: 0,
        children: [],
      },
    ],
  };
}

async function openContextMenuForLabel(container: HTMLElement, label: string): Promise<void> {
  const target = [...container.querySelectorAll<HTMLElement>('span')].find(
    (element) => element.textContent === label,
  );
  expect(target).toBeTruthy();
  await act(async () => {
    target!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    await Promise.resolve();
  });
}

function findMenuItem(label: string): HTMLElement | undefined {
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    .filter((item) => item.closest('.editor-context-menu')?.getAttribute('style')?.includes('pointer-events: auto'))
    .reverse()
    .find((item) => item.textContent?.trim() === label);
}

describe('CodeRepositoryDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('offers reachable inline rename and rejects a blank submitted name', async () => {
    const onSave = vi.fn(async () => ({ ok: true as const }));
    act(() =>
      root.render(
        <CodeRepositoryDialog snapshot={{ root: makeRoot(), contentRevision: 1 }} onClose={vi.fn()} onSave={onSave} />,
      ),
    );

    const label = [...container.querySelectorAll('span')].find((element) => element.textContent === 'Group');
    expect(label).toBeTruthy();
    await act(async () => {
      label!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Rename code repository item"]');
    expect(input).toBeTruthy();

    await act(async () => {
      input!.value = 'Renamed group';
      input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Save')!
        .click();
    });
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        children: [expect.objectContaining({ name: 'Renamed group' })],
      }),
    );

    act(() =>
      root.render(
        <CodeRepositoryDialog snapshot={{ root: makeRoot(), contentRevision: 1 }} onClose={vi.fn()} onSave={onSave} />,
      ),
    );
    const secondLabel = [...container.querySelectorAll('span')].find((element) => element.textContent === 'Group');
    await act(async () => {
      secondLabel!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    const blankInput = container.querySelector<HTMLInputElement>('input[aria-label="Rename code repository item"]')!;
    await act(async () => {
      blankInput.value = '   ';
      blankInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Rename code repository item"]')).toBeTruthy();
  });

  it('resets an active draft when an import explicitly requests replacement', async () => {
    const onSave = vi.fn(async () => ({ ok: true as const }));
    act(() =>
      root.render(
        <CodeRepositoryDialog
          snapshot={{ root: makeRoot('Before import'), contentRevision: 1 }}
          onClose={vi.fn()}
          onSave={onSave}
          draftResetToken={0}
        />,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const beforeLabel = [...container.querySelectorAll('span')].find(
      (element) => element.textContent === 'Before import',
    );
    await act(async () => {
      beforeLabel!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    const dirtyName = container.querySelector<HTMLInputElement>('input[aria-label="Rename code repository item"]')!;
    await act(async () => {
      dirtyName.value = 'Unsaved stale draft';
      dirtyName.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    act(() =>
      root.render(
        <CodeRepositoryDialog
          snapshot={{ root: makeRoot('Imported tree'), contentRevision: 2 }}
          onClose={vi.fn()}
          onSave={onSave}
          draftResetToken={1}
        />,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Imported tree');
    const saveButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'Save',
    )!;
    expect(saveButton.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('uses the Java placeholder only when the supplied preference enables it', async () => {
    const withDefaults = vi.fn(async () => ({ ok: true as const }));
    act(() =>
      root.render(
        <CodeRepositoryDialog
          snapshot={{ root: makeRoot(), contentRevision: 1 }}
          onClose={vi.fn()}
          onSave={withDefaults}
          newSnippetCode="Insert your code here"
        />,
      ),
    );
    await openContextMenuForLabel(container, 'Group');
    await act(async () => findMenuItem('Add Code Snippet')?.click());
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Save')!
        .click();
    });
    expect(withDefaults).toHaveBeenCalledWith(
      expect.objectContaining({
        children: [
          expect.objectContaining({
            children: [expect.objectContaining({ code: 'Insert your code here' })],
          }),
        ],
      }),
    );

    act(() => root.unmount());
    root = createRoot(container);
    const withoutDefaults = vi.fn(async () => ({ ok: true as const }));
    act(() =>
      root.render(
        <CodeRepositoryDialog
          snapshot={{ root: makeRoot(), contentRevision: 1 }}
          onClose={vi.fn()}
          onSave={withoutDefaults}
          newSnippetCode=""
        />,
      ),
    );
    await openContextMenuForLabel(container, 'Group');
    await act(async () => findMenuItem('Add Code Snippet')?.click());
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Save')!
        .click();
    });
    expect(withoutDefaults).toHaveBeenCalledWith(
      expect.objectContaining({
        children: [
          expect.objectContaining({
            children: [expect.objectContaining({ code: '' })],
          }),
        ],
      }),
    );
  });

  it('uses Java-style context commands for groups and snippets', async () => {
    const onSave = vi.fn(async () => ({ ok: true as const }));
    const rootWithSnippet: CodeRepositoryNode = {
      ...makeRoot(),
      children: [
        {
          ...makeRoot().children![0],
          children: [
            {
              id: 'snippet-1',
              kind: 'snippet',
              name: 'Snippet',
              parentId: 'group-1',
              order: 0,
              code: 'out oscili .2, 440',
            },
          ],
        },
      ],
    };
    act(() =>
      root.render(
        <CodeRepositoryDialog
          snapshot={{ root: rootWithSnippet, contentRevision: 1 }}
          onClose={vi.fn()}
          onSave={onSave}
        />,
      ),
    );

    await openContextMenuForLabel(container, 'Code Repository');
    expect(findMenuItem('Add Group')).toBeTruthy();
    expect(findMenuItem('Add Code Snippet')).toBeTruthy();
    expect(findMenuItem('Remove Group')).toBeUndefined();

    await openContextMenuForLabel(container, 'Group');
    expect(findMenuItem('Add Group')).toBeTruthy();
    expect(findMenuItem('Add Code Snippet')).toBeTruthy();
    expect(findMenuItem('Remove Group')).toBeTruthy();
    await act(async () => findMenuItem('Add Group')?.click());
    expect([...container.querySelectorAll('span')].some((element) => element.textContent === 'New Group')).toBe(true);

    await openContextMenuForLabel(container, 'Snippet');
    expect(findMenuItem('Remove Code Snippet')).toBeTruthy();
    expect(findMenuItem('Add Group')).toBeUndefined();
    await act(async () => findMenuItem('Remove Code Snippet')?.click());
    expect([...container.querySelectorAll('span')].some((element) => element.textContent === 'Snippet')).toBe(false);

    await openContextMenuForLabel(container, 'Group');
    await act(async () => findMenuItem('Remove Group')?.click());
    expect([...container.querySelectorAll('span')].some((element) => element.textContent === 'Group')).toBe(false);
    expect(container.textContent).not.toContain('+ Group');
    expect(container.textContent).not.toContain('+ Snippet');
  });

  it('exposes an explicit retry action for an interrupted migration', async () => {
    const onRetry = vi.fn(async () => undefined);
    act(() =>
      root.render(
        <CodeRepositoryDialog
          snapshot={{ root: makeRoot(), contentRevision: 1 }}
          onClose={vi.fn()}
          onSave={vi.fn(async () => ({ ok: true as const }))}
          migrationDiagnostic={{
            code: 'migration-interrupted',
            message: 'Code Repository migration was interrupted. Retry to continue.',
          }}
          onRetry={onRetry}
        />,
      ),
    );

    const retryButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Retry Migration');
    expect(retryButton).toBeTruthy();
    await act(async () => retryButton!.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('preserves a conflicted draft but requires reload before another save', async () => {
    act(() =>
      root.render(
        <CodeRepositoryDialog
          snapshot={{ root: makeRoot('Saved elsewhere'), contentRevision: 2 }}
          onClose={vi.fn()}
          onSave={vi.fn(async () => ({ ok: true as const }))}
          conflict={{
            code: 'revision-conflict',
            message: 'Modified elsewhere',
            retryable: true,
            currentSnapshot: {
              root: makeRoot('Saved elsewhere'),
              contentRevision: 2,
              initialized: true,
            },
          }}
          onReloadConflict={vi.fn()}
        />,
      ),
    );
    const label = [...container.querySelectorAll('span')].find((element) => element.textContent === 'Saved elsewhere')!;
    await act(async () => {
      label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Rename code repository item"]')!;
    await act(async () => {
      input.value = 'Stale draft';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    const save = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'Save',
    )!;
    expect(save.disabled).toBe(true);
    expect(container.textContent).toContain('Your draft is preserved');
  });

  it('renders the deterministic 500-node editor fixture within the responsiveness threshold', async () => {
    const rootNode = makeRoot();
    const fixture: CodeRepositoryNode = {
      ...rootNode,
      children: Array.from({ length: 500 }, (_, index) => ({
        id: `group-${index}`,
        kind: 'group' as const,
        name: `Group ${index + 1}`,
        parentId: CODE_REPOSITORY_ROOT_ID,
        order: index,
        children: [],
      })),
    };
    const startedAt = performance.now();
    act(() =>
      root.render(
        <CodeRepositoryDialog
          snapshot={{ root: fixture, contentRevision: 1 }}
          onClose={vi.fn()}
          onSave={vi.fn(async () => ({ ok: true as const }))}
        />,
      ),
    );
    const elapsedMs = performance.now() - startedAt;
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Group 1');
    expect(elapsedMs).toBeLessThan(FIVE_HUNDRED_NODE_RENDER_GUARD_MS);
  });
});
