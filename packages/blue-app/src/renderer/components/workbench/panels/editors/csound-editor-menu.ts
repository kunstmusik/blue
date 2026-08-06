import type {
  CsoundEditorDisabledItem,
  CsoundEditorInsertionItem,
  CsoundEditorMenuItem,
  CsoundEditorSubmenuItem,
} from './editor-adapter-types';

export interface CsoundEditorMenuOptions {
  readOnly?: boolean;
  showEvaluateCode?: boolean;
  evaluateCodeEnabled?: boolean;
  onEvaluateCode?: () => void;
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

function createDisabledCategory(label: string, reason: string): CsoundEditorDisabledItem {
  return createDisabledItem(label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, reason);
}

export function createJavaBlueCsoundEditorMenuItems(
  options: CsoundEditorMenuOptions = {},
): CsoundEditorMenuItem[] {
  const readOnly = Boolean(options.readOnly);

  return [
    createBlueVariablesSubmenu(options),
    createDisabledCategory(
      'Opcodes',
      'Opcode browser is deferred until the Java Blue opcode browser is ported into the renderer.',
    ),
    createBlueOpcodesSubmenu(options),
    {
      kind: 'separator',
      id: 'editor-menu-separator-1',
    },
    createDisabledCategory(
      'Custom',
      'Custom repository browsing is deferred until code repository storage is available.',
    ),
    createDisabledCategory(
      'Add to Code Repository',
      'Code repository writes are deferred until the repository editor is implemented.',
    ),
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
