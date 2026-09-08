import { PopoutContextMenuPortal } from '../../../../hooks/host-portals';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type { EditorView } from '@codemirror/view';
import { ChevronRight } from 'lucide-react';
import React, { type MutableRefObject, type ReactNode } from 'react';
import { cn } from '../../../../lib/cn';

import {
  copySelectionToClipboard,
  cutSelectionToClipboard,
  getSelectedText,
  pasteClipboardText,
  type CsoundEditorClipboardBridge,
  insertTextAtSelection,
} from './csound-editor-actions';
import { resolveOpcodeInsertionPlan, applyOpcodeInsertion } from './csound-opcode-insertion';
import { handleOpenManualAtCaret } from './csound-opcode-help';
import type {
  CsoundEditorCommandItem,
  CsoundEditorDisabledItem,
  CsoundEditorInsertionItem,
  CsoundEditorMenuItem,
  CsoundEditorSeparatorItem,
  CsoundEditorSubmenuItem,
} from './editor-adapter-types';

interface CsoundEditorContextMenuProps {
  children: ReactNode;
  editorViewRef: MutableRefObject<EditorView | null>;
  menuItems: CsoundEditorMenuItem[];
  clipboardBridge?: CsoundEditorClipboardBridge;
  onEvaluateCode?: () => void;
  onAddToCodeRepository?: (selectedText: string) => void;
  onOpenManualAtCaret?: () => void;
}

function isSubmenuItem(item: CsoundEditorMenuItem): item is CsoundEditorSubmenuItem {
  return item.kind === 'submenu';
}

function isCommandItem(item: CsoundEditorMenuItem): item is CsoundEditorCommandItem {
  return item.kind === 'command';
}

function isInsertionItem(item: CsoundEditorMenuItem): item is CsoundEditorInsertionItem {
  return item.kind === 'insertion';
}

function isDisabledItem(item: CsoundEditorMenuItem): item is CsoundEditorDisabledItem {
  return item.kind === 'disabled';
}

function isSeparatorItem(item: CsoundEditorMenuItem): item is CsoundEditorSeparatorItem {
  return item.kind === 'separator';
}

function getMenuItemClassName(disabled?: boolean): string {
  return cn('editor-context-menu__item', disabled && 'editor-context-menu__item--disabled');
}

function renderMenuItem(
  item: CsoundEditorMenuItem,
  editorViewRef: MutableRefObject<EditorView | null>,
  clipboardBridge: CsoundEditorClipboardBridge | undefined,
  onEvaluateCode?: () => void,
  onAddToCodeRepository?: (selectedText: string) => void,
  onOpenManualAtCaret?: () => void,
): ReactNode {
  if (isSeparatorItem(item)) {
    return <ContextMenu.Separator key={item.id} className="editor-context-menu__separator" />;
  }

  if (isSubmenuItem(item)) {
    return (
      <ContextMenu.Sub key={item.id}>
        <ContextMenu.SubTrigger
          className={cn(getMenuItemClassName(item.disabled), 'editor-context-menu__subtrigger')}
          disabled={item.disabled}
          title={item.disabledReason}
        >
          <span>{item.label}</span>
          <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 opacity-60" />
        </ContextMenu.SubTrigger>

        <PopoutContextMenuPortal>
          <ContextMenu.SubContent
            className="editor-context-menu editor-context-menu--submenu"
            sideOffset={6}
            alignOffset={-4}
          >
            {item.items.map((childItem) =>
              renderMenuItem(
                childItem,
                editorViewRef,
                clipboardBridge,
                onEvaluateCode,
                onAddToCodeRepository,
                onOpenManualAtCaret,
              ),
            )}
          </ContextMenu.SubContent>
        </PopoutContextMenuPortal>
      </ContextMenu.Sub>
    );
  }

  if (isDisabledItem(item)) {
    return (
      <ContextMenu.Item
        key={item.id}
        className={getMenuItemClassName(true)}
        disabled
        title={item.disabledReason}
      >
        {item.label}
      </ContextMenu.Item>
    );
  }

  if (isInsertionItem(item)) {
    const handleSelect = () => {
      const editorView = editorViewRef.current;
      if (!editorView || item.disabled) {
        return;
      }

      if (item.opcodeMetadata) {
        const from = editorView.state.selection.main.from;
        const to = editorView.state.selection.main.to;
        const docText = editorView.state.doc.toString();
        const plan = resolveOpcodeInsertionPlan(docText, from, to, item.opcodeMetadata);
        applyOpcodeInsertion(editorView, plan);
      } else {
        insertTextAtSelection(editorView, item.insertText);
      }
    };

    return (
      <ContextMenu.Item
        key={item.id}
        className={getMenuItemClassName(item.disabled)}
        disabled={item.disabled}
        title={item.disabledReason}
        onSelect={handleSelect}
      >
        {item.label}
      </ContextMenu.Item>
    );
  }

  if (isCommandItem(item)) {
    const handleSelect = () => {
      const editorView = editorViewRef.current;
      if (!editorView || item.disabled) {
        return;
      }

      switch (item.command) {
        case 'cut':
          void cutSelectionToClipboard(editorView, clipboardBridge);
          break;
        case 'copy':
          void copySelectionToClipboard(editorView, clipboardBridge);
          break;
        case 'paste':
          void pasteClipboardText(editorView, clipboardBridge);
          break;
        case 'evaluate-code':
          onEvaluateCode?.();
          break;
        case 'add-to-code-repository': {
          const selectedText = getSelectedText(editorView.state);
          if (selectedText.length > 0) {
            onAddToCodeRepository?.(selectedText);
          }
          break;
        }
        case 'open-manual':
          if (onOpenManualAtCaret) {
            onOpenManualAtCaret();
          } else {
            void handleOpenManualAtCaret(editorView);
          }
          break;
      }
    };

    return (
      <ContextMenu.Item
        key={item.id}
        className={getMenuItemClassName(item.disabled)}
        disabled={item.disabled}
        title={item.disabledReason}
        onSelect={handleSelect}
      >
        <span>{item.label}</span>
        {item.shortcutLabel ? (
          <span className="editor-context-menu__shortcut">{item.shortcutLabel}</span>
        ) : null}
      </ContextMenu.Item>
    );
  }

  return null;
}

export default function CsoundEditorContextMenu({
  children,
  editorViewRef,
  menuItems,
  clipboardBridge,
  onEvaluateCode,
  onAddToCodeRepository,
  onOpenManualAtCaret,
}: CsoundEditorContextMenuProps): React.ReactElement {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>

      <PopoutContextMenuPortal>
        <ContextMenu.Content className="editor-context-menu" sideOffset={6}>
          {menuItems.map((item) =>
            renderMenuItem(
              item,
              editorViewRef,
              clipboardBridge,
              onEvaluateCode,
              onAddToCodeRepository,
              onOpenManualAtCaret,
            ),
          )}
        </ContextMenu.Content>
      </PopoutContextMenuPortal>
    </ContextMenu.Root>
  );
}
