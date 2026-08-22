// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CODE_REPOSITORY_ROOT_ID } from '@blue/data';
import AddToCodeRepositoryDialog from './AddToCodeRepositoryDialog';

function makeRoot() {
  return {
    id: CODE_REPOSITORY_ROOT_ID,
    kind: 'root' as const,
    name: 'Code Repository',
    parentId: null,
    order: 0,
    children: [
      {
        id: 'nested-group',
        kind: 'group' as const,
        name: 'Nested',
        parentId: CODE_REPOSITORY_ROOT_ID,
        order: 0,
        children: [
          {
            id: 'existing',
            kind: 'snippet' as const,
            name: 'Duplicate name',
            parentId: 'nested-group',
            order: 0,
            code: 'existing',
          },
        ],
      },
    ],
  };
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('AddToCodeRepositoryDialog', () => {
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

  it('creates the selected Csound text through the main-owned snippet mutation', async () => {
    const onCreate = vi.fn(async () => ({ ok: true as const }));
    act(() =>
      root.render(
        <AddToCodeRepositoryDialog
          root={makeRoot()}
          initialText="aout oscili 0.2, 440"
          contentRevision={7}
          onClose={vi.fn()}
          onCreate={onCreate}
        />,
      ),
    );
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.className).toContain('w-[760px]');
    expect(dialog.className).toContain('h-[72vh]');
    expect(container.querySelector('label[for="code-repository-snippet-name"]')?.className).toContain('text-role-body');
    expect(container.querySelector('label[for="code-repository-destination"]')?.className).toContain('text-role-body');
    expect(Array.from(container.querySelectorAll('div')).find((element) => element.textContent === 'ORC Code')?.className)
      .toContain('text-role-body');
    expect(container.querySelector('[data-editor-language="csound-orc"]')).not.toBeNull();
    expect(container.querySelector('.cm-editor')).not.toBeNull();
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Add')!
        .click();
      await Promise.resolve();
    });
    expect(onCreate).toHaveBeenCalledWith(CODE_REPOSITORY_ROOT_ID, 'New Snippet', 'aout oscili 0.2, 440', 7);
  });

  it('supports a nested destination, duplicate name, and exact selected whitespace', async () => {
    const onCreate = vi.fn(async () => ({ ok: true as const }));
    act(() =>
      root.render(
        <AddToCodeRepositoryDialog
          root={makeRoot()}
          initialText={'  aout\t= asig\n'}
          contentRevision={8}
          onClose={vi.fn()}
          onCreate={onCreate}
        />,
      ),
    );
    const name = container.querySelector<HTMLInputElement>('#code-repository-snippet-name')!;
    const destination = container.querySelector<HTMLSelectElement>('#code-repository-destination')!;
    await act(async () => {
      changeInput(name, '  Duplicate name  ');
      destination.value = 'nested-group';
      destination.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Add')!
        .click();
      await Promise.resolve();
    });
    expect(onCreate).toHaveBeenCalledWith('nested-group', 'Duplicate name', '  aout\t= asig\n', 8);
  });

  it('keeps a blank-name error inline and closes without creating on cancel', async () => {
    const onCreate = vi.fn(async () => ({ ok: true as const }));
    const onClose = vi.fn();
    act(() =>
      root.render(
        <AddToCodeRepositoryDialog
          root={makeRoot()}
          initialText="code"
          contentRevision={1}
          onClose={onClose}
          onCreate={onCreate}
        />,
      ),
    );
    const name = container.querySelector<HTMLInputElement>('#code-repository-snippet-name')!;
    await act(async () => {
      changeInput(name, '   ');
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Add')!
        .click();
    });
    expect(container.textContent).toContain('Enter a snippet name.');
    expect(container.querySelector('[role="alert"]')?.className).toContain('text-role-callout');
    expect(onCreate).not.toHaveBeenCalled();

    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Cancel')!
        .click();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows retry feedback instead of disappearing when the repository is unavailable', async () => {
    const onRetry = vi.fn();
    act(() =>
      root.render(
        <AddToCodeRepositoryDialog
          root={null}
          initialText="code"
          contentRevision={0}
          onClose={vi.fn()}
          onCreate={vi.fn(async () => ({ ok: true as const }))}
          onRetry={onRetry}
        />,
      ),
    );
    expect(container.textContent).toContain('Code Repository is unavailable');
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Retry')!
        .click();
    });
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
