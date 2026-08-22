import type { CodeRepositoryNode } from '@blue/data';
import type {
  CsoundEditorDisabledItem,
  CsoundEditorInsertionItem,
  CsoundEditorMenuItem,
  CsoundEditorSubmenuItem,
} from './editor-adapter-types';
import { createOpcodesSubmenu } from './csound-opcode-menu';

export { createOpcodesSubmenu };

export interface CsoundEditorMenuOptions {
  readOnly?: boolean;
  showEvaluateCode?: boolean;
  evaluateCodeEnabled?: boolean;
  onEvaluateCode?: () => void;
  /** Optional repository snapshot; when absent the Custom menu is disabled. */
  repositoryRoot?: CodeRepositoryNode | null;
  /** Enablement for the Add to Code Repository command (requires a selection). */
  addToCodeRepositoryEnabled?: boolean;
}

interface InsertionDefinition {
  id: string;
  label: string;
  insertText: string;
  detail: string;
}

function getPlatformModifier(): string {
  if (typeof navigator !== 'undefined') {
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? 'Cmd' : 'Ctrl';
  }

  return 'Cmd/Ctrl';
}

function getEvaluateCodeShortcutLabel(): string {
  return `${getPlatformModifier()}-Enter`;
}

const BLUE_VARIABLE_DEFINITIONS: InsertionDefinition[] = [
  {
    id: 'blue-variable-total-dur',
    label: '<TOTAL_DUR>',
    insertText: '<TOTAL_DUR>',
    detail: 'Blue variable',
  },
  {
    id: 'blue-variable-render-start',
    label: '<RENDER_START>',
    insertText: '<RENDER_START>',
    detail: 'Blue variable',
  },
  {
    id: 'blue-variable-processing-start',
    label: '<PROCESSING_START>',
    insertText: '<PROCESSING_START>',
    detail: 'Blue variable',
  },
  {
    id: 'blue-variable-instr-id',
    label: '<INSTR_ID>',
    insertText: '<INSTR_ID>',
    detail: 'Blue variable',
  },
  {
    id: 'blue-variable-instr-name',
    label: '<INSTR_NAME>',
    insertText: '<INSTR_NAME>',
    detail: 'Blue variable',
  },
];

const BLUE_OPCODE_DEFINITIONS: InsertionDefinition[] = [
  {
    id: 'blue-opcode-blue-mixer-out',
    label: 'blueMixerOut',
    insertText: 'blueMixerOut asig1 [, asig2...]',
    detail: 'Blue opcode',
  },
  {
    id: 'blue-opcode-blue-mixer-out-subchannel',
    label: 'blueMixerOut (subchannel)',
    insertText: 'blueMixerOut "subchannelName", asig1 ,asig2 [, asig3...]',
    detail: 'Blue opcode',
  },
  {
    id: 'blue-opcode-blue-mixer-in',
    label: 'blueMixerIn',
    insertText: 'asig1 [, asig2...] blueMixerIn',
    detail: 'Blue opcode',
  },
];

function toInsertionItem(definition: InsertionDefinition, disabled = false): CsoundEditorInsertionItem {
  return {
    kind: 'insertion',
    id: definition.id,
    label: definition.label,
    insertText: definition.insertText,
    detail: definition.detail,
    disabled,
    disabledReason: disabled ? 'Editor is read-only' : undefined,
  };
}

function createDisabledItem(id: string, label: string, disabledReason: string): CsoundEditorDisabledItem {
  return {
    kind: 'disabled',
    id,
    label,
    disabledReason,
  };
}

function createSubmenu(
  id: string,
  label: string,
  items: CsoundEditorMenuItem[],
  disabled = false,
): CsoundEditorSubmenuItem {
  return {
    kind: 'submenu',
    id,
    label,
    items,
    disabled,
    disabledReason: disabled ? 'Editor is read-only' : undefined,
  };
}

export function createBlueVariablesSubmenu(options: CsoundEditorMenuOptions = {}): CsoundEditorSubmenuItem {
  return createSubmenu(
    'blue-variables',
    'Blue Variables',
    BLUE_VARIABLE_DEFINITIONS.map((definition) => toInsertionItem(definition, Boolean(options.readOnly))),
    Boolean(options.readOnly),
  );
}

export function createBlueOpcodesSubmenu(options: CsoundEditorMenuOptions = {}): CsoundEditorSubmenuItem {
  return createSubmenu(
    'blue-opcodes',
    'Blue Opcodes',
    BLUE_OPCODE_DEFINITIONS.map((definition) => toInsertionItem(definition, Boolean(options.readOnly))),
    Boolean(options.readOnly),
  );
}

/**
 * Build a Custom submenu recursively from a repository snapshot. Each group
 * becomes a nested submenu; each snippet becomes an insertion item carrying its
 * exact code text. An empty or missing repository yields a single disabled item.
 */
export function createCodeRepositorySubmenu(
  root: CodeRepositoryNode | null | undefined,
  readOnly = false,
): CsoundEditorSubmenuItem | CsoundEditorDisabledItem {
  if (!root) {
    return createDisabledItem(
      'custom',
      'Custom',
      'No Code Repository is available.',
    );
  }
  const childItems = buildRepositoryMenuItems(root.children ?? [], readOnly);
  if (childItems.length === 0) {
    return createDisabledItem(
      'custom',
      'Custom',
      'The Code Repository is empty.',
    );
  }
  return {
    kind: 'submenu',
    id: 'custom',
    label: 'Custom',
    items: childItems,
    disabled: readOnly,
    disabledReason: readOnly ? 'Editor is read-only' : undefined,
  };
}

function buildRepositoryMenuItems(
  nodes: readonly CodeRepositoryNode[],
  readOnly: boolean,
): CsoundEditorMenuItem[] {
  const items: CsoundEditorMenuItem[] = [];
  for (const node of nodes) {
    if (node.kind === 'group') {
      const childItems = buildRepositoryMenuItems(node.children ?? [], readOnly);
      items.push({
        kind: 'submenu',
        id: `repository-group-${node.id}`,
        label: node.name,
        items: childItems,
        disabled: readOnly || childItems.length === 0,
        disabledReason: readOnly
          ? 'Editor is read-only'
          : childItems.length === 0
            ? 'This group is empty'
            : undefined,
      });
    } else if (node.kind === 'snippet') {
      items.push({
        kind: 'insertion',
        id: `repository-snippet-${node.id}`,
        label: node.name,
        insertText: node.code ?? '',
        disabled: readOnly,
        disabledReason: readOnly ? 'Editor is read-only' : undefined,
      });
    }
  }
  return items;
}

/**
 * Build the Add to Code Repository command item. Disabled when there is no
 * non-empty selection or the editor is read-only.
 */
export function createAddToCodeRepositoryItem(
  enabled: boolean,
  readOnly = false,
): CsoundEditorMenuItem {
  return {
    kind: 'command',
    id: 'add-to-code-repository',
    label: 'Add to Code Repository',
    command: 'add-to-code-repository',
    disabled: readOnly || !enabled,
    disabledReason: readOnly
      ? 'Editor is read-only'
      : !enabled
        ? 'Select code to add to the Code Repository'
        : undefined,
  };
}

export function createJavaBlueCsoundEditorMenuItems(
  options: CsoundEditorMenuOptions = {},
): CsoundEditorMenuItem[] {
  const readOnly = Boolean(options.readOnly);

  return [
    createBlueVariablesSubmenu(options),
    createOpcodesSubmenu(options),
    createBlueOpcodesSubmenu(options),
    {
      kind: 'separator',
      id: 'editor-menu-separator-1',
    },
    createCodeRepositorySubmenu(options.repositoryRoot, readOnly),
    createAddToCodeRepositoryItem(Boolean(options.addToCodeRepositoryEnabled), readOnly),
    {
      kind: 'separator',
      id: 'editor-menu-separator-2',
    },
    {
      kind: 'command',
      id: 'cut',
      label: 'Cut',
      command: 'cut',
      shortcutLabel: `${getPlatformModifier()}-X`,
      disabled: readOnly,
      disabledReason: readOnly ? 'Editor is read-only' : undefined,
    },
    {
      kind: 'command',
      id: 'copy',
      label: 'Copy',
      command: 'copy',
      shortcutLabel: `${getPlatformModifier()}-C`,
    },
    {
      kind: 'command',
      id: 'paste',
      label: 'Paste',
      command: 'paste',
      shortcutLabel: `${getPlatformModifier()}-V`,
      disabled: readOnly,
      disabledReason: readOnly ? 'Editor is read-only' : undefined,
    },
    ...(options.showEvaluateCode ? [
      {
        kind: 'separator' as const,
        id: 'evaluate-code-separator',
      } satisfies CsoundEditorMenuItem,
      {
        kind: 'command' as const,
        id: 'evaluate-code',
        label: 'Evaluate Code',
        shortcutLabel: getEvaluateCodeShortcutLabel(),
        command: 'evaluate-code' as const,
        disabled: !options.evaluateCodeEnabled,
        disabledReason: !options.evaluateCodeEnabled ? 'Start Blue Live or realtime playback to evaluate code' : undefined,
      } satisfies CsoundEditorMenuItem,
    ] : []),
  ];
}

export function createBasicTextEditorMenuItems(
  options: CsoundEditorMenuOptions = {},
): CsoundEditorMenuItem[] {
  const readOnly = Boolean(options.readOnly);

  return [
    {
      kind: 'command',
      id: 'cut',
      label: 'Cut',
      command: 'cut',
      shortcutLabel: `${getPlatformModifier()}-X`,
      disabled: readOnly,
      disabledReason: readOnly ? 'Editor is read-only' : undefined,
    },
    {
      kind: 'command',
      id: 'copy',
      label: 'Copy',
      command: 'copy',
      shortcutLabel: `${getPlatformModifier()}-C`,
    },
    {
      kind: 'command',
      id: 'paste',
      label: 'Paste',
      command: 'paste',
      shortcutLabel: `${getPlatformModifier()}-V`,
      disabled: readOnly,
      disabledReason: readOnly ? 'Editor is read-only' : undefined,
    },
  ];
}
