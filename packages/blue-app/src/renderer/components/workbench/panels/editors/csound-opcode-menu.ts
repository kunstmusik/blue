import {
  csoundRichOpcodeCatalog,
  type RichOpcodeCatalogEntry,
} from '@kunstmusik/codemirror-lang-csound/rich';

import type {
  CsoundEditorInsertionItem,
  CsoundEditorMenuItem,
  CsoundEditorSubmenuItem,
} from './editor-adapter-types';
import type { CsoundEditorMenuOptions } from './csound-editor-menu';

interface OpcodeCategoryTreeNode {
  readonly name: string;
  readonly subcategories: Map<string, OpcodeCategoryTreeNode>;
  readonly opcodes: RichOpcodeCatalogEntry[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getSyntaxStatements(syntaxLines: readonly string[] | undefined): string[] {
  if (!syntaxLines || syntaxLines.length === 0) {
    return [];
  }

  const statements: string[] = [];
  let current = '';

  for (const line of syntaxLines) {
    if (!current) {
      current = line;
    } else {
      current += '\n' + line;
    }

    if (!line.trimEnd().endsWith('\\')) {
      statements.push(current);
      current = '';
    }
  }

  if (current) {
    statements.push(current);
  }

  return statements;
}

export function getOpcodeInsertText(entry: RichOpcodeCatalogEntry): string {
  const statements = getSyntaxStatements(entry.syntax);
  if (statements.length === 0) {
    return entry.name;
  }

  const standardStatement = statements.find(
    (stmt) => !stmt.includes(' = ') && stmt.includes(entry.name),
  );
  if (standardStatement) {
    return standardStatement.trim();
  }

  const fallbackNamed = statements.find((stmt) => stmt.includes(entry.name));
  if (fallbackNamed) {
    return fallbackNamed.trim();
  }

  return statements[0].trim();
}

function buildOpcodeCategoryTree(
  opcodes: readonly RichOpcodeCatalogEntry[],
): OpcodeCategoryTreeNode {
  const root: OpcodeCategoryTreeNode = {
    name: 'Opcodes',
    subcategories: new Map(),
    opcodes: [],
  };

  for (const entry of opcodes) {
    const rawCategory = entry.category?.trim();
    const parts = rawCategory
      ? rawCategory
          .split(':')
          .map((part) => part.trim())
          .filter(Boolean)
      : ['Miscellaneous'];

    let current = root;
    for (const part of parts) {
      let sub = current.subcategories.get(part);
      if (!sub) {
        sub = {
          name: part,
          subcategories: new Map(),
          opcodes: [],
        };
        current.subcategories.set(part, sub);
      }
      current = sub;
    }
    current.opcodes.push(entry);
  }

  return root;
}

const STATIC_OPCODE_TREE = buildOpcodeCategoryTree(csoundRichOpcodeCatalog.opcodes);

function toInsertionItem(
  entry: RichOpcodeCatalogEntry,
  readOnly: boolean,
  idPrefix: string,
): CsoundEditorInsertionItem {
  return {
    kind: 'insertion',
    id: `${idPrefix}-opcode-${entry.name}`,
    label: entry.name,
    insertText: getOpcodeInsertText(entry),
    detail: 'opcode',
    disabled: readOnly,
    disabledReason: readOnly ? 'Editor is read-only' : undefined,
  };
}

function treeToMenuItems(
  node: OpcodeCategoryTreeNode,
  readOnly: boolean,
  idPrefix: string,
): CsoundEditorMenuItem[] {
  const items: CsoundEditorMenuItem[] = [];

  const sortedSubcategories = Array.from(node.subcategories.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  for (const sub of sortedSubcategories) {
    const subId = `${idPrefix}-${slugify(sub.name)}`;
    items.push(treeToSubmenu(sub, readOnly, subId));
  }

  const sortedOpcodes = [...node.opcodes].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  for (const op of sortedOpcodes) {
    items.push(toInsertionItem(op, readOnly, idPrefix));
  }

  return items;
}

function treeToSubmenu(
  node: OpcodeCategoryTreeNode,
  readOnly: boolean,
  id: string,
): CsoundEditorSubmenuItem {
  const childItems = treeToMenuItems(node, readOnly, id);

  return {
    kind: 'submenu',
    id,
    label: node.name,
    items: childItems,
    disabled: readOnly,
    disabledReason: readOnly ? 'Editor is read-only' : undefined,
  };
}

/**
 * Creates the hierarchical Csound Opcodes submenu with categories and
 * insertion items for all 1,300+ standard Csound opcodes.
 */
export function createOpcodesSubmenu(
  options: CsoundEditorMenuOptions = {},
): CsoundEditorSubmenuItem {
  const readOnly = Boolean(options.readOnly);
  return treeToSubmenu(STATIC_OPCODE_TREE, readOnly, 'opcodes');
}
