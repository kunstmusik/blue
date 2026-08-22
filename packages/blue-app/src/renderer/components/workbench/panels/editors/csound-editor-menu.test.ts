import { describe, expect, it } from 'vitest';
import type { CodeRepositoryNode } from '@blue/data';
import { CODE_REPOSITORY_ROOT_ID } from '@blue/data';
import {
  createAddToCodeRepositoryItem,
  createCodeRepositorySubmenu,
  createJavaBlueCsoundEditorMenuItems,
  createOpcodesSubmenu,
} from './csound-editor-menu';
import type {
  CsoundEditorInsertionItem,
  CsoundEditorMenuItem,
  CsoundEditorSeparatorItem,
} from './editor-adapter-types';

type LabeledCsoundEditorMenuItem = Exclude<CsoundEditorMenuItem, CsoundEditorSeparatorItem>;

function isLabeledMenuItem(item: CsoundEditorMenuItem): item is LabeledCsoundEditorMenuItem {
  return item.kind !== 'separator';
}

function getLabeledItems(items: readonly CsoundEditorMenuItem[]): LabeledCsoundEditorMenuItem[] {
  return items.filter(isLabeledMenuItem);
}

function findLabeledItem(
  items: readonly CsoundEditorMenuItem[],
  label: string,
): LabeledCsoundEditorMenuItem | undefined {
  return getLabeledItems(items).find((item) => item.label === label);
}

function collectInsertionItems(items: readonly CsoundEditorMenuItem[]): CsoundEditorInsertionItem[] {
  const insertionItems: CsoundEditorInsertionItem[] = [];
  for (const item of items) {
    if (item.kind === 'insertion') {
      insertionItems.push(item);
    } else if (item.kind === 'submenu') {
      insertionItems.push(...collectInsertionItems(item.items));
    }
  }
  return insertionItems;
}

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

describe('createOpcodesSubmenu', () => {
  it('builds a hierarchical categorized submenu of Csound opcodes', () => {
    const menu = createOpcodesSubmenu();
    expect(menu.kind).toBe('submenu');
    expect(menu.label).toBe('Opcodes');
    expect(menu.id).toBe('opcodes');
    expect(menu.disabled).toBe(false);

    // Verify presence of canonical top-level categories
    const categoryLabels = getLabeledItems(menu.items).map((item) => item.label);
    expect(categoryLabels).toContain('Signal Generators');
    expect(categoryLabels).toContain('Signal Modifiers');
    expect(categoryLabels).toContain('Mathematical Operations');
    expect(categoryLabels).toContain('Instrument Control');
    expect(categoryLabels).toContain('Real-time MIDI');

    // Verify subcategory navigation under Signal Generators
    const signalGenerators = findLabeledItem(menu.items, 'Signal Generators');
    if (!signalGenerators || signalGenerators.kind !== 'submenu') {
      throw new Error('Expected Signal Generators submenu');
    }

    const subcategoryLabels = getLabeledItems(signalGenerators.items).map((item) => item.label);
    expect(subcategoryLabels).toContain('Basic Oscillators');
    expect(subcategoryLabels).toContain('Additive Synthesis/Resynthesis');
    expect(subcategoryLabels).toContain('Envelope Generators');
    expect(subcategoryLabels).toContain('FM Synthesis');

    // Verify leaf opcode insertion items under Basic Oscillators
    const basicOscillators = findLabeledItem(signalGenerators.items, 'Basic Oscillators');
    if (!basicOscillators || basicOscillators.kind !== 'submenu') {
      throw new Error('Expected Basic Oscillators submenu');
    }

    const oscilItem = findLabeledItem(basicOscillators.items, 'oscil');
    if (!oscilItem || oscilItem.kind !== 'insertion') {
      throw new Error('Expected oscil insertion item');
    }
    expect(oscilItem.detail).toBe('opcode');
    expect(oscilItem.insertText).toBe('ares oscil xamp, xcps [, ifn, iphs]');
    expect(oscilItem.disabled).toBe(false);

    const poscilItem = findLabeledItem(basicOscillators.items, 'poscil');
    if (!poscilItem || poscilItem.kind !== 'insertion') {
      throw new Error('Expected poscil insertion item');
    }
    expect(poscilItem.insertText).toBe('ares poscil aamp, acps [, ifn, iphs]');
  });

  it('sorts categories and opcodes alphabetically', () => {
    const menu = createOpcodesSubmenu();
    const categoryLabels = getLabeledItems(menu.items).map((item) => item.label);
    const sortedCategoryLabels = [...categoryLabels].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    expect(categoryLabels).toEqual(sortedCategoryLabels);

    const signalGenerators = findLabeledItem(menu.items, 'Signal Generators');
    if (!signalGenerators || signalGenerators.kind !== 'submenu') {
      throw new Error('Expected Signal Generators submenu');
    }
    const subLabels = getLabeledItems(signalGenerators.items).map((item) => item.label);
    const sortedSubLabels = [...subLabels].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    expect(subLabels).toEqual(sortedSubLabels);
  });

  it('disables all submenus and insertion items when editor is read-only', () => {
    const menu = createOpcodesSubmenu({ readOnly: true });
    expect(menu.disabled).toBe(true);
    expect(menu.disabledReason).toBe('Editor is read-only');

    const signalGenerators = findLabeledItem(menu.items, 'Signal Generators');
    if (!signalGenerators || signalGenerators.kind !== 'submenu') {
      throw new Error('Expected Signal Generators submenu');
    }
    expect(signalGenerators.disabled).toBe(true);

    const basicOscillators = findLabeledItem(signalGenerators.items, 'Basic Oscillators');
    if (!basicOscillators || basicOscillators.kind !== 'submenu') {
      throw new Error('Expected Basic Oscillators submenu');
    }
    expect(basicOscillators.disabled).toBe(true);

    const oscilItem = findLabeledItem(basicOscillators.items, 'oscil');
    if (!oscilItem || oscilItem.kind !== 'insertion') {
      throw new Error('Expected oscil insertion item');
    }
    expect(oscilItem.disabled).toBe(true);
    expect(oscilItem.disabledReason).toBe('Editor is read-only');
  });

  it('assigns unique IDs to every opcode insertion item', () => {
    const insertionIds = collectInsertionItems(createOpcodesSubmenu().items).map((item) => item.id);
    expect(new Set(insertionIds).size).toBe(insertionIds.length);
  });

  it('builds the entire 1,300+ opcode menu hierarchy within 50ms', () => {
    const start = performance.now();
    const menu = createOpcodesSubmenu();
    const elapsedMs = performance.now() - start;
    expect(menu.items.length).toBeGreaterThan(15);
    expect(elapsedMs).toBeLessThan(50);
  });
});

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
    const enabled = createAddToCodeRepositoryItem(true, false);
    const noSelection = createAddToCodeRepositoryItem(false, false);
    const readOnly = createAddToCodeRepositoryItem(true, true);
    if (enabled.kind !== 'command' || noSelection.kind !== 'command' || readOnly.kind !== 'command') {
      throw new Error('Expected Add to Code Repository command items');
    }
    expect(enabled.disabled).toBe(false);
    expect(noSelection.disabled).toBe(true);
    expect(readOnly.disabled).toBe(true);
  });

  it('carries the add-to-code-repository command', () => {
    const item = createAddToCodeRepositoryItem(true, false);
    if (item.kind !== 'command') throw new Error('expected command');
    expect(item.command).toBe('add-to-code-repository');
  });
});

describe('createJavaBlueCsoundEditorMenuItems', () => {
  it('includes active Opcodes submenu alongside Blue Variables and Blue Opcodes', () => {
    const menu = createJavaBlueCsoundEditorMenuItems();
    const opcodes = menu.find((item) => item.kind !== 'separator' && item.label === 'Opcodes');
    expect(opcodes).toBeDefined();
    expect(opcodes?.kind).toBe('submenu');

    const blueVars = menu.find((item) => item.kind !== 'separator' && item.label === 'Blue Variables');
    expect(blueVars?.kind).toBe('submenu');

    const blueOps = menu.find((item) => item.kind !== 'separator' && item.label === 'Blue Opcodes');
    expect(blueOps?.kind).toBe('submenu');
  });

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
