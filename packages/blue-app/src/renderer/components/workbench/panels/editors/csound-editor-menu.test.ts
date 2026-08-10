import { describe, expect, it } from 'vitest';
import type { CodeRepositoryNode } from '@blue/data';
import { CODE_REPOSITORY_ROOT_ID } from '@blue/data';
import {
  createAddToCodeRepositoryItem,
  createCodeRepositorySubmenu,
  createJavaBlueCsoundEditorMenuItems,
} from './csound-editor-menu';

function makeRoot(children: CodeRepositoryNode[]): CodeRepositoryNode {
  return {
    id: CODE_REPOSITORY_ROOT_ID,
    kind: 'root',
    name: 'Code Repository',
    parentId: null,
    order: 0,
    children,
  };
}

describe('createCodeRepositorySubmenu', () => {
  it('builds nested submenus and snippet insertion items recursively', () => {
    const root = makeRoot([
      {
        id: 'grp-1',
        kind: 'group',
        name: 'envelopes',
        parentId: CODE_REPOSITORY_ROOT_ID,
        order: 0,
        children: [
          {
            id: 'snip-1',
            kind: 'snippet',
            name: 'pan',
            parentId: 'grp-1',
            order: 0,
            code: 'aout pan2 a',
          },
          {
            id: 'grp-2',
            kind: 'group',
            name: 'nested',
            parentId: 'grp-1',
            order: 1,
            children: [
              {
                id: 'snip-2',
                kind: 'snippet',
                name: 'deep',
                parentId: 'grp-2',
                order: 0,
                code: 'deep code',
              },
            ],
          },
        ],
      },
    ]);
    const submenu = createCodeRepositorySubmenu(root);
    if (submenu.kind !== 'submenu') throw new Error('expected submenu');
    expect(submenu.label).toBe('Custom');
    expect(submenu.items).toHaveLength(1);
    const group = submenu.items[0];
    if (group.kind !== 'submenu') throw new Error('expected group submenu');
    expect(group.label).toBe('envelopes');
    expect(group.items).toHaveLength(2);
    const snippet = group.items[0];
    if (snippet.kind !== 'insertion') throw new Error('expected insertion item');
    expect(snippet.insertText).toBe('aout pan2 a');
    expect(snippet.label).toBe('pan');
    const nested = group.items[1];
    if (nested.kind !== 'submenu') throw new Error('expected nested submenu');
    expect(nested.label).toBe('nested');
    expect((nested.items[0] as { insertText: string }).insertText).toBe('deep code');
  });

  it('returns a disabled item when the repository is empty', () => {
    const root = makeRoot([]);
    const item = createCodeRepositorySubmenu(root);
    expect(item.kind).toBe('disabled');
    expect((item as { label: string }).label).toBe('Custom');
  });

  it('returns a disabled item when no repository root is provided', () => {
    const item = createCodeRepositorySubmenu(null);
    expect(item.kind).toBe('disabled');
  });

  it('disables snippet insertion when the editor is read-only', () => {
    const root = makeRoot([
      { id: 'snip-1', kind: 'snippet', name: 's', parentId: CODE_REPOSITORY_ROOT_ID, order: 0, code: 'x' },
    ]);
    const submenu = createCodeRepositorySubmenu(root, true);
    if (submenu.kind !== 'submenu') throw new Error('expected submenu');
    expect(submenu.disabled).toBe(true);
    expect((submenu.items[0] as { disabled: boolean }).disabled).toBe(true);
  });
});

describe('createAddToCodeRepositoryItem', () => {
  it('is enabled only when a selection is present and the editor is editable', () => {
    expect(createAddToCodeRepositoryItem(true, false).disabled).toBe(false);
    expect(createAddToCodeRepositoryItem(false, false).disabled).toBe(true);
    expect(createAddToCodeRepositoryItem(true, true).disabled).toBe(true);
  });

  it('carries the add-to-code-repository command', () => {
    const item = createAddToCodeRepositoryItem(true, false);
    if (item.kind !== 'command') throw new Error('expected command');
    expect(item.command).toBe('add-to-code-repository');
  });
});

describe('createJavaBlueCsoundEditorMenuItems with repository', () => {
  it('includes a populated Custom submenu and the Add command when data is provided', () => {
    const root = makeRoot([
      { id: 'snip-1', kind: 'snippet', name: 'solo', parentId: CODE_REPOSITORY_ROOT_ID, order: 0, code: 'sig' },
    ]);
    const menu = createJavaBlueCsoundEditorMenuItems({
      repositoryRoot: root,
      addToCodeRepositoryEnabled: true,
    });
    const custom = menu.find((item) => item.kind !== 'separator' && item.label === 'Custom');
    if (!custom || custom.kind !== 'submenu') throw new Error('expected Custom submenu');
    expect((custom.items[0] as { insertText: string }).insertText).toBe('sig');
    const add = menu.find((item) => item.kind === 'command' && item.command === 'add-to-code-repository');
    expect(add).toBeDefined();
    expect((add as { disabled?: boolean }).disabled).toBeFalsy();
  });

  it('builds the deterministic 500-node Custom menu fixture within the responsiveness threshold', () => {
    const root = makeRoot(Array.from({ length: 500 }, (_, index) => ({
      id: `snippet-${index}`,
      kind: 'snippet' as const,
      name: `Snippet ${index + 1}`,
      parentId: CODE_REPOSITORY_ROOT_ID,
      order: index,
      code: `instr ${index + 1}`,
    })));
    const startedAt = performance.now();
    const menu = createCodeRepositorySubmenu(root);
    const elapsedMs = performance.now() - startedAt;
    expect(menu.kind).toBe('submenu');
    if (menu.kind !== 'submenu') throw new Error('expected Custom submenu');
    expect(menu.items).toHaveLength(500);
    expect(elapsedMs).toBeLessThan(1_000);
  });
});
